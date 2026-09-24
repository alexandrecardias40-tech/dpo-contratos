import requests
import json
import os
import datetime
import re
import pandas as pd
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import defaultdict

# ══════════════════════════════════════════════════════════════════
# CONFIGURAÇÃO
# ══════════════════════════════════════════════════════════════════
UG = "154040"
BASE = "https://contratos.comprasnet.gov.br/api"
OUTPUT_DIR = "dashboard/public"
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs("dashboard/src", exist_ok=True)

EXCEL_FILE = "BI CONTRATOS (5).xlsx"
CACHE_CONTRATOS  = "/tmp/contratos_raw.json"
CACHE_EMPENHOS   = "/tmp/empenhos_cache.json"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
}

def norm(v):
    """Remove formatação de CNPJ/CPF para comparação."""
    if v is None: return ""
    return re.sub(r"[^0-9A-Za-z]", "", str(v).strip())

def parse_br(v):
    """Converte valor BR (1.234,56) para float."""
    if v is None: return 0.0
    try:
        if pd.isna(v): return 0.0
    except: pass
    if isinstance(v, (int, float)): return float(v)
    s = str(v).strip().replace("R$","").replace(" ","").replace(".","").replace(",",".")
    try: return float(s)
    except: return 0.0

def ext_minuta(v):
    """Extrai código UASG Minuta de 17 dígitos do item_info."""
    m = re.match(r"^\s*(\d{17})", str(v).strip())
    return m.group(1) if m else None

def ext_lic_de_minuta(cod17):
    """Decodifica o número de licitação contido no código de minuta.
       Formato: 154040 + 2 dígitos tipo + 5 dígitos lic + 4 dígitos ano
       Retorna string normalizada (só dígitos) do estilo '900112026'."""
    if not cod17: return None
    m = re.match(r"^154040(\d{2})(\d{5})(\d{4})$", cod17)
    if m:
        lic = m.group(2)  # ex: '90011'
        ano = m.group(3)  # ex: '2026'
        return re.sub(r"[^0-9]", "", f"{lic}/{ano}")
    return None

def ext_num_contrato_de_minuta(cod17):
    """Extrai número/ano do contrato embutido no código de minuta de 17 dígitos.
       Exemplo: 15404005011102024 -> ('01110/2024', '1110/2024')"""
    if not cod17: return None
    m = re.match(r"^154040\d{2}(\d{5})(\d{4})$", str(cod17))
    if m:
        c_full = f"{m.group(1)}/{m.group(2)}"
        try:
            c_short = f"{int(m.group(1))}/{m.group(2)}"
            return (c_full, c_short)
        except:
            return (c_full,)
    return None


# ══════════════════════════════════════════════════════════════════
# 1. LER EXCEL DO TESOURO GERENCIAL
# ══════════════════════════════════════════════════════════════════
print("📊 Lendo BI Contratos (Tesouro Gerencial)...")
df = pd.read_excel(EXCEL_FILE, header=None, skiprows=3)
df.columns = [
    "ug_exec","ug_exec_nome","uo_cod","uo_nome","cnpj_cpf","favorecido_nome",
    "pi","pi_nome","ug_resp","ug_resp_nome","item_info",
    "credito","empenhado","a_liquidar","liquidado","pago",
    "rap_a_liq","rap_liq","rap_bloq","total"
]

# Filtrar linhas com CNPJ válido (excluir nulos e linha de Total)
df = df.dropna(subset=["cnpj_cpf"])
df["cnpj_cpf"] = df["cnpj_cpf"].astype(str)
df = df[~df["cnpj_cpf"].str.lower().str.contains("total", na=False)]

# Extrair chaves de cruzamento
df["cnpj_norm"]    = df["cnpj_cpf"].apply(norm)
df["minuta_cod"]   = df["item_info"].apply(ext_minuta)
df["lic_de_minuta"]= df["minuta_cod"].apply(ext_lic_de_minuta)

print(f"  ✅ {len(df)} linhas válidas | "
      f"{df['minuta_cod'].notna().sum()} com código Minuta | "
      f"{(df['item_info'].astype(str).str.strip()=='NAO SE APLICA').sum()} NAO SE APLICA")


# ══════════════════════════════════════════════════════════════════
# 2. CARREGAR CONTRATOS DO COMPRASNET (com cache)
# ══════════════════════════════════════════════════════════════════
print("\n🌐 Carregando contratos Comprasnet...")
if os.path.exists(CACHE_CONTRATOS) and os.path.getsize(CACHE_CONTRATOS) > 100_000:
    print("  📂 Cache local encontrado...")
    contratos_raw = json.load(open(CACHE_CONTRATOS, encoding="utf-8"))
else:
    print("  🔄 Baixando via API (pode demorar 2-3 min)...")
    try:
        r = requests.get(f"{BASE}/contrato/ug/{UG}", headers=HEADERS, timeout=300)
        contratos_raw = r.json() if r.status_code == 200 else []
        json.dump(contratos_raw, open(CACHE_CONTRATOS,"w",encoding="utf-8"), ensure_ascii=False)
    except Exception as e:
        print(f"  ❌ Erro: {e}"); contratos_raw = []

# Filtrar só despesas
contratos = [c for c in contratos_raw if c.get("receita_despesa") == "Despesa"]
print(f"  ✅ {len(contratos)} contratos de Despesa")


# ══════════════════════════════════════════════════════════════════
# 3. CONSTRUIR ÍNDICES COMPRASNET
# ══════════════════════════════════════════════════════════════════
print("\n🔗 Construindo índices de cruzamento...")
idx_minuta   = {}   # codigo_minuta_17  → contrato
idx_cnpj_num = {}   # (cnpj_norm, numero_contrato) → contrato
idx_cnpj_lic = defaultdict(list)  # (cnpj_norm, lic_norm) → [contratos]
idx_cnpj     = defaultdict(list)  # cnpj_norm → [contratos]

for c in contratos:
    cnpj = norm((c.get("fornecedor") or {}).get("cnpj_cpf_idgener",""))
    ic   = ext_minuta(c.get("informacao_complementar","") or "")
    lic  = re.sub(r"[^0-9]", "", c.get("licitacao_numero","") or "")
    num  = str(c.get("numero","")).strip()

    if ic:
        idx_minuta[ic] = c
    if cnpj:
        idx_cnpj[cnpj].append(c)
        if lic:
            idx_cnpj_lic[(cnpj, lic)].append(c)
        if num:
            idx_cnpj_num[(cnpj, num)] = c
            if "/" in num:
                parts = num.split("/")
                try:
                    idx_cnpj_num[(cnpj, f"{int(parts[0])}/{parts[1]}")] = c
                except: pass

# Ordenar contratos do mesmo CNPJ por vigência mais recente (data de término/assinatura descendente)
for c_key in idx_cnpj:
    idx_cnpj[c_key].sort(key=lambda x: str(x.get("vigencia_fim") or x.get("data_assinatura") or ""), reverse=True)

print(f"  idx_minuta:   {len(idx_minuta)} contratos")
print(f"  idx_cnpj_num: {len(idx_cnpj_num)} pares CNPJ+N°Contrato")
print(f"  idx_cnpj:     {len(idx_cnpj)} CNPJs distintos")
print(f"  idx_cnpj_lic: {len(idx_cnpj_lic)} pares CNPJ+Licitação")


# ══════════════════════════════════════════════════════════════════
# 4. CRUZAMENTO BI CONTRATOS ↔ COMPRASNET (5 chaves em cascata)
# ══════════════════════════════════════════════════════════════════
print("\n🔀 Cruzando dados (5 chaves em cascata para máxima precisão)...")
hoje = datetime.date.today()

stat = defaultdict(int)
records = []

for _, row in df.iterrows():
    cnpj        = norm(str(row["cnpj_cpf"]))
    minuta_cod  = row.get("minuta_cod")
    lic_de_min  = row.get("lic_de_minuta")
    item_info   = str(row.get("item_info","")).strip()

    emp   = parse_br(row.get("empenhado", 0))
    liq   = parse_br(row.get("liquidado", 0))
    pago  = parse_br(row.get("pago", 0))
    a_liq = parse_br(row.get("a_liquidar", 0))

    # Linhas sem valor financeiro e sem chave (ex: "NAO SE APLICA")
    if emp == 0 and liq == 0 and pago == 0 and a_liq == 0:
        if item_info in ("NAO SE APLICA", "nan", ""):
            stat["sem_valor_skip"] += 1
            continue

    # ── CHAVE 1: Código UASG Minuta (17 dígitos exatos = Informação Complementar) ──
    contrato = None
    chave_usada = "sem_match"
    if minuta_cod and minuta_cod in idx_minuta:
        contrato = idx_minuta[minuta_cod]
        chave_usada = "minuta"
        stat["chave1_minuta"] += 1

    # ── CHAVE 2: CNPJ + N° Contrato decodificado da Minuta ──
    if not contrato and minuta_cod:
        c_cands = ext_num_contrato_de_minuta(minuta_cod)
        if c_cands:
            for c_cand in c_cands:
                if (cnpj, c_cand) in idx_cnpj_num:
                    contrato = idx_cnpj_num[(cnpj, c_cand)]
                    chave_usada = "cnpj_num_minuta"
                    stat["chave2_num_minuta"] += 1
                    break

    # ── CHAVE 3: CNPJ + Licitação decodificada da Minuta ──
    if not contrato and lic_de_min and (cnpj, lic_de_min) in idx_cnpj_lic:
        contratos_cand = idx_cnpj_lic[(cnpj, lic_de_min)]
        contrato = contratos_cand[0]
        chave_usada = "cnpj_lic"
        stat["chave3_cnpj_lic"] += 1

    # ── CHAVE 4: CNPJ único no Comprasnet ──
    elif not contrato and cnpj in idx_cnpj and len(idx_cnpj[cnpj]) == 1:
        contrato = idx_cnpj[cnpj][0]
        chave_usada = "cnpj_unico"
        stat["chave4_cnpj_unico"] += 1

    # ── CHAVE 5: CNPJ (Associação ao contrato mais recente do fornecedor no Comprasnet) ──
    elif not contrato and cnpj in idx_cnpj:
        contrato = idx_cnpj[cnpj][0]
        chave_usada = "cnpj_recente"
        stat["chave5_cnpj_recente"] += 1

    # ── Sem match: registrar despesa direta no BI Contratos ──
    else:
        stat["sem_match_total"] += 1

    # Vigência e alerta
    vi = vf = alerta = ""
    dias_restantes = None
    if contrato:
        vi = contrato.get("vigencia_inicio","") or ""
        vf = contrato.get("vigencia_fim","") or ""
        if vf:
            try:
                vf_d = datetime.datetime.strptime(vf, "%Y-%m-%d").date()
                dias_restantes = (vf_d - hoje).days
                if dias_restantes < 0:     alerta = "Vencido"
                elif dias_restantes <= 30: alerta = "Vence 30d"
                elif dias_restantes <= 90: alerta = "Vence 90d"
                elif dias_restantes <= 180:alerta = "Vence 180d"
                else:                      alerta = "Vigente"
            except: pass

    pct_exec = (pago / emp * 100) if emp > 0 else 0
    if emp <= 0:        status, cor = "Sem Valor", "cinza"
    elif pct_exec >= 95: status, cor = "Executado",   "verde"
    elif pct_exec >= 40: status, cor = "Em Execução",  "amarelo"
    else:               status, cor = "A Executar",  "vermelho"

    def sg(key, default=""):
        if not contrato: return default
        v = contrato.get(key)
        return v if v is not None else default

    forn = (contrato or {}).get("fornecedor") or {}

    records.append({
        # ── FINANCEIRO (TG) ──
        "emp":            round(emp, 2),
        "liq":            round(liq, 2),
        "pago":           round(pago, 2),
        "a_liquidar":     round(a_liq, 2),
        "pct_execucao":   round(pct_exec, 1),
        "status":         status,
        "status_cor":     cor,
        # ── FAVORECIDO (TG) ──
        "cnpj_cpf":       str(row.get("cnpj_cpf","")).strip(),
        "favorecido_nome":str(row.get("favorecido_nome","")).strip(),
        "pi":             str(row.get("pi","")).strip(),
        "pi_nome":        str(row.get("pi_nome","")).strip(),
        "ug_resp":        str(row.get("ug_resp","")).strip(),
        "ug_resp_nome":   str(row.get("ug_resp_nome","")).strip(),
        "item_info":      item_info,
        # ── CONTRATO (COMPRASNET) ──
        "chave_usada":        chave_usada,
        "tem_contrato":       contrato is not None,
        "contrato_id":        sg("id"),
        "contrato_numero":    sg("numero"),
        "contrato_tipo":      sg("tipo"),
        "contrato_situacao":  sg("situacao"),
        "contrato_objeto":    sg("objeto"),
        "contrato_categoria": sg("categoria"),
        "contrato_modalidade":sg("modalidade"),
        "contrato_processo":  sg("processo"),
        "contrato_lic":       sg("licitacao_numero"),
        "contrato_amparo":    sg("amparo_legal"),
        "contrato_valor_global":    parse_br(sg("valor_global","0")),
        "contrato_valor_acumulado": parse_br(sg("valor_acumulado","0")),
        "vigencia_inicio":    vi,
        "vigencia_fim":       vf,
        "dias_restantes":     dias_restantes,
        "alerta_vigencia":    alerta,
        "fornecedor_nome":    forn.get("nome",""),
        "fornecedor_cnpj":    forn.get("cnpj_cpf_idgener",""),
    })

# ── AGRUPAMENTO E CONSOLIDAÇÃO DE LINHAS (CNPJ + CONTRATO) ──
def clean_name(nome):
    if not nome: return ""
    n = re.sub(r"^\d+[\.\/\-]?\d*[\.\/\-]?\d*\s*", "", str(nome)).strip()
    return n if n else str(nome).strip()

def format_cnpj_cpf(val):
    digits = re.sub(r"\D", "", str(val))
    if len(digits) == 14:
        return f"{digits[:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:]}"
    elif len(digits) == 11:
        return f"{digits[:3]}.{digits[3:6]}.{digits[6:9]}-{digits[9:]}"
    return str(val).strip()

# ── AGRUPAMENTO E CONSOLIDAÇÃO DE LINHAS POR CNPJ E CONTRATO ──
def clean_name(nome):
    if not nome: return ""
    n = re.sub(r"^\d+[\.\/\-]?\d*[\.\/\-]?\d*\s*", "", str(nome)).strip()
    return n if n else str(nome).strip()

def format_cnpj_cpf(val):
    digits = re.sub(r"\D", "", str(val))
    if len(digits) == 14:
        return f"{digits[:2]}.{digits[2:5]}.{digits[5:8]}/{digits[8:12]}-{digits[12:]}"
    elif len(digits) == 11:
        return f"{digits[:3]}.{digits[3:6]}.{digits[6:9]}-{digits[9:]}"
    return str(val).strip()

# Group records by CNPJ
cnpj_groups = defaultdict(list)
for r in records:
    c_digits = re.sub(r"\D", "", str(r.get("cnpj_cpf","")))
    cnpj_groups[c_digits].append(r)

def compute_ugr_breakdown(rows):
    breakdown = defaultdict(lambda: {"emp": 0.0, "liq": 0.0, "pago": 0.0})
    for g in rows:
        cod = str(g.get("ug_resp") or "").strip()
        nome = str(g.get("ug_resp_nome") or "").strip()
        if not cod and not nome:
            key = "Outras Unidades"
        elif cod and nome and not nome.startswith(cod):
            key = f"{cod} - {nome}"
        else:
            key = nome or cod
        
        breakdown[key]["emp"] += g.get("emp", 0.0)
        breakdown[key]["liq"] += g.get("liq", 0.0)
        breakdown[key]["pago"] += g.get("pago", 0.0)

    res = []
    for k, v in breakdown.items():
        emp = round(v["emp"], 2)
        liq = round(v["liq"], 2)
        pago = round(v["pago"], 2)
        aliq = round(emp - liq, 2)
        res.append({
            "ug_key": k,
            "emp": emp,
            "liq": liq,
            "pago": pago,
            "a_liquidar": aliq,
        })
    res.sort(key=lambda x: (x["emp"], x["liq"]), reverse=True)
    return res

new_records = []

for c_digits, group in cnpj_groups.items():
    # Encontrar o contrato principal do CNPJ (dando prioridade a Chave 1/2/3 da Minuta/Licitação)
    minuta_contracts = {}
    other_contracts = {}
    for g in group:
        if g.get("tem_contrato") and g.get("contrato_id"):
            if g.get("chave_usada") in ("minuta", "cnpj_num_minuta", "cnpj_lic"):
                minuta_contracts[g["contrato_id"]] = g
            else:
                other_contracts[g["contrato_id"]] = g

    # Se houve match de minuta/licitação, ele é o contrato principal do CNPJ
    primary_contract = None
    if minuta_contracts:
        primary_contract = list(minuta_contracts.values())[0]
    elif other_contracts:
        primary_contract = list(other_contracts.values())[0]

    # Se todas as linhas do CNPJ pertencem ao mesmo contrato principal (ou se é 1 contrato com restos a pagar/NAO SE APLICA)
    if primary_contract and (len(minuta_contracts) <= 1):
        # Associar todas as linhas do CNPJ (inclusive as NAO SE APLICA) ao contrato principal
        emp_tot  = sum(g["emp"] for g in group)
        liq_tot  = sum(g["liq"] for g in group)
        pago_tot = sum(g["pago"] for g in group)
        aliq_tot = emp_tot - liq_tot
        
        pct_exec = (pago_tot / emp_tot * 100) if emp_tot > 0 else (100.0 if pago_tot > 0 else 0)
        if emp_tot <= 0 and pago_tot <= 0 and liq_tot <= 0:
            status, cor = "Sem Valor", "cinza"
        elif pct_exec >= 95: status, cor = "Executado", "verde"
        elif pct_exec >= 40: status, cor = "Em Execução", "amarelo"
        else: status, cor = "A Executar", "vermelho"
        
        best_info = next((g["item_info"] for g in group if g.get("item_info") not in ("NAO SE APLICA", "nan", "")), primary_contract.get("item_info",""))
        
        rec = dict(primary_contract)
        rec["favorecido_nome"] = clean_name(group[0].get("favorecido_nome") or primary_contract.get("favorecido_nome"))
        rec["cnpj_cpf_fmt"] = format_cnpj_cpf(group[0].get("cnpj_cpf"))
        rec["emp"] = round(emp_tot, 2)
        rec["liq"] = round(liq_tot, 2)
        rec["pago"] = round(pago_tot, 2)
        rec["a_liquidar"] = round(aliq_tot, 2)
        rec["pct_execucao"] = round(pct_exec, 1)
        rec["status"] = status
        rec["status_cor"] = cor
        rec["item_info"] = best_info

        ugr_list = compute_ugr_breakdown(group)
        rec["ugr_breakdown"] = ugr_list
        rec["qtd_ugrs"] = len(ugr_list)
        if len(ugr_list) > 1:
            rec["ug_resp"] = "MÚLTIPLAS"
            rec["ug_resp_nome"] = f"Múltiplas Unidades ({len(ugr_list)} UGRs)"
        elif len(ugr_list) == 1:
            u_key = ugr_list[0]["ug_key"]
            if " - " in u_key:
                parts = u_key.split(" - ", 1)
                rec["ug_resp"] = parts[0]
                rec["ug_resp_nome"] = parts[1]
            else:
                rec["ug_resp_nome"] = u_key

        new_records.append(rec)

    else:
        # Se não há contrato ou se há múltiplos contratos com minutas diferentes no mesmo CNPJ
        sub_groups = defaultdict(list)
        for g in group:
            c_key = g.get("contrato_id") if g.get("tem_contrato") else (g.get("item_info") or "SIAFI")
            sub_groups[c_key].append(g)

        for c_key, s_group in sub_groups.items():
            best_record = next((g for g in s_group if g.get("tem_contrato")), s_group[0])
            
            emp_tot  = sum(g["emp"] for g in s_group)
            liq_tot  = sum(g["liq"] for g in s_group)
            pago_tot = sum(g["pago"] for g in s_group)
            aliq_tot = emp_tot - liq_tot
            
            pct_exec = (pago_tot / emp_tot * 100) if emp_tot > 0 else (100.0 if pago_tot > 0 else 0)
            if emp_tot <= 0 and pago_tot <= 0 and liq_tot <= 0:
                status, cor = "Sem Valor", "cinza"
            elif pct_exec >= 95: status, cor = "Executado", "verde"
            elif pct_exec >= 40: status, cor = "Em Execução", "amarelo"
            else: status, cor = "A Executar", "vermelho"
            
            best_info = next((g["item_info"] for g in s_group if g.get("item_info") not in ("NAO SE APLICA", "nan", "")), best_record.get("item_info",""))
            
            rec = dict(best_record)
            rec["favorecido_nome"] = clean_name(s_group[0].get("favorecido_nome") or best_record.get("favorecido_nome"))
            rec["cnpj_cpf_fmt"] = format_cnpj_cpf(s_group[0].get("cnpj_cpf"))
            rec["emp"] = round(emp_tot, 2)
            rec["liq"] = round(liq_tot, 2)
            rec["pago"] = round(pago_tot, 2)
            rec["a_liquidar"] = round(aliq_tot, 2)
            rec["pct_execucao"] = round(pct_exec, 1)
            rec["status"] = status
            rec["status_cor"] = cor
            rec["item_info"] = best_info

            ugr_list = compute_ugr_breakdown(s_group)
            rec["ugr_breakdown"] = ugr_list
            rec["qtd_ugrs"] = len(ugr_list)
            if len(ugr_list) > 1:
                rec["ug_resp"] = "MÚLTIPLAS"
                rec["ug_resp_nome"] = f"Múltiplas Unidades ({len(ugr_list)} UGRs)"
            elif len(ugr_list) == 1:
                u_key = ugr_list[0]["ug_key"]
                if " - " in u_key:
                    parts = u_key.split(" - ", 1)
                    rec["ug_resp"] = parts[0]
                    rec["ug_resp_nome"] = parts[1]
                else:
                    rec["ug_resp_nome"] = u_key

            new_records.append(rec)

records = new_records

# ── VARREDURA COMPLETA E ENRIQUECIMENTO DE REGISTROS SEM CONTRATO ──
for r in records:
    if not r.get("tem_contrato"):
        m_info = str(r.get("item_info","")).strip()
        min_match = re.match(r"^\s*(\d{17})", m_info)
        if min_match:
            parsed = ext_num_contrato_de_minuta(min_match.group(1))
            if parsed:
                # 154040 + 2 digitos mod + 5 digitos num + 4 digitos ano
                m_g = re.match(r"^154040(\d{2})(\d{5})(\d{4})$", min_match.group(1))
                if m_g:
                    mod_c, num_c, ano_c = m_g.group(1), m_g.group(2), m_g.group(3)
                    mod_map = {
                        "01": "Convite", "02": "Tomada de Preços", "03": "Concorrência",
                        "05": "Inexigibilidade", "06": "Pregão", "07": "Dispensa de Licitação",
                        "08": "Suprimento de Fundo", "09": "Outros"
                    }
                    m_nome = mod_map.get(mod_c, "Empenho Direto")
                    ne_num = f"{ano_c}NE{num_c.zfill(6)}"
                    r["contrato_numero"] = f"{num_c}/{ano_c}" if mod_c in ("05","06","03") else ne_num
                    r["contrato_modalidade"] = m_nome
                    r["contrato_tipo"] = "Empenho"
                    r["contrato_processo"] = f"NE {ne_num}"
        elif m_info in ("SEM INFORMACAO", "NAO SE APLICA", ""):
            clean_cpf = re.sub(r"\D", "", str(r.get("cnpj_cpf","")))
            if clean_cpf == "154040":
                r["contrato_numero"] = "Execução Interna UnB"
                r["contrato_modalidade"] = r.get("pi_nome") or "Gestão Orçamentária Interna"
                r["contrato_processo"] = f"PI: {r.get('pi')}"
            elif len(clean_cpf) == 11:
                r["contrato_numero"] = "Empenho Direto (PF)"
                r["contrato_modalidade"] = "Auxílio / Bolsa / Diária"
                r["contrato_processo"] = "SIAFI (Direto)"
            else:
                r["contrato_numero"] = "Empenho Direto (PJ)"
                r["contrato_modalidade"] = "Execução Direta (SIAFI)"
                r["contrato_processo"] = "SIAFI (Direto)"
                r["contrato_processo"] = "SIAFI (Direto)"
                r["contrato_processo"] = "SIAFI (Direto)"

records.sort(key=lambda x: x["emp"], reverse=True)

print(f"\n  📋 Chave 1 (Minuta exata):       {stat['chave1_minuta']}")
print(f"  📋 Chave 2 (CNPJ+N°Contrato):    {stat['chave2_num_minuta']}")
print(f"  📋 Chave 3 (CNPJ+Licitação):     {stat['chave3_cnpj_lic']}")
print(f"  📋 Chave 4 (CNPJ único):          {stat['chave4_cnpj_unico']}")
print(f"  📋 Chave 5 (CNPJ mais recente):  {stat['chave5_cnpj_recente']}")
print(f"  ❌ Sem match no Comprasnet:       {stat['sem_match_total']}")
print(f"  ⏭️  Linhas sem valor (skip):       {stat['sem_valor_skip']}")
print(f"  ✅ Total registros gerados (consolidados): {len(records)}")

# ── CARREGAR DETALHES SUB-RECURSOS DOS CONTRATOS (HISTÓRICO, EMPENHOS, ITENS, RESPONSÁVEIS) ──
print("\n🔍 Baixando detalhes dos contratos (Aditivos, Empenhos, Itens, Fiscais)...")
CACHE_DETALHES = "/tmp/detalhes_cache.json"
detalhes_map = {}
if os.path.exists(CACHE_DETALHES):
    try:
        detalhes_map = json.load(open(CACHE_DETALHES, "r", encoding="utf-8"))
        print(f"  📂 Cache de detalhes encontrado ({len(detalhes_map)} contratos)")
    except Exception:
        detalhes_map = {}

unique_cids = list(set(str(r["contrato_id"]) for r in records if r.get("tem_contrato") and r.get("contrato_id")))
missing_cids = [cid for cid in unique_cids if cid not in detalhes_map]

if missing_cids:
    print(f"  🌐 Baixando detalhes de {len(missing_cids)} novos contratos via API Comprasnet...")
    def fetch_detalhe(cid):
        res = {}
        for sub in ['historico', 'empenhos', 'itens', 'responsaveis']:
            try:
                r = requests.get(f"https://contratos.comprasnet.gov.br/api/contrato/{cid}/{sub}", headers=HEADERS, timeout=6)
                if r.status_code == 200:
                    data = r.json()
                    if isinstance(data, list):
                        res[sub] = data
            except Exception:
                pass
        return cid, res

    with ThreadPoolExecutor(max_workers=15) as executor:
        futures = {executor.submit(fetch_detalhe, cid): cid for cid in missing_cids}
        for future in as_completed(futures):
            cid, res = future.result()
            detalhes_map[cid] = res

    try:
        json.dump(detalhes_map, open(CACHE_DETALHES, "w", encoding="utf-8"), ensure_ascii=False)
    except Exception:
        pass

# Vincular detalhes aos registros
det_count = 0
for r in records:
    if r.get("tem_contrato") and r.get("contrato_id"):
        cid_str = str(r["contrato_id"])
        if cid_str in detalhes_map:
            r["detalhes"] = detalhes_map[cid_str]
            det_count += 1

print(f"  ✅ {det_count} registros enriquecidos com detalhes completos!")



# ══════════════════════════════════════════════════════════════════
# 5. SALVAR DATA.JSON E METADATA.JSON
# ══════════════════════════════════════════════════════════════════
for path in [f"{OUTPUT_DIR}/data.json", "dashboard/src/data.json"]:
    json.dump(records, open(path,"w",encoding="utf-8"), ensure_ascii=False, indent=2)


total_emp  = sum(r["emp"]         for r in records)
total_liq  = sum(r["liq"]         for r in records)
total_pago = sum(r["pago"]        for r in records)
total_aliq = sum(r["a_liquidar"]  for r in records)
qtd_com_contrato  = sum(1 for r in records if r["tem_contrato"])
qtd_vencidos      = sum(1 for r in records if r["alerta_vigencia"] == "Vencido")
qtd_vence30       = sum(1 for r in records if r["alerta_vigencia"] == "Vence 30d")
qtd_vence90       = sum(1 for r in records if r["alerta_vigencia"] == "Vence 90d")
qtd_vence180      = sum(1 for r in records if r["alerta_vigencia"] == "Vence 180d")
qtd_vigente       = sum(1 for r in records if r["alerta_vigencia"] == "Vigente")

agora = datetime.datetime.now().strftime("%d/%m/%Y às %H:%M")
meta = {
    "lastUpdated":        agora,
    "source":             "Tesouro Gerencial (Excel) + Comprasnet (API)",
    "ug":                 UG,
    "totalRegistros":     len(records),
    "totalComContrato":   qtd_com_contrato,
    "totalVencidos":      qtd_vencidos,
    "totalVence30":       qtd_vence30,
    "totalVence90":       qtd_vence90,
    "totalVence180":      qtd_vence180,
    "totalVigente":       qtd_vigente,
    "totalEmpenhado":     round(total_emp, 2),
    "totalLiquidado":     round(total_liq, 2),
    "totalPago":          round(total_pago, 2),
    "totalALiquidar":     round(total_aliq, 2),
    "matchMinuta":        stat["chave1_minuta"],
    "matchCnpjLic":       stat["chave2_cnpj_lic"],
    "matchCnpjUnico":     stat["chave3_cnpj_unico"],
}
for path in [f"{OUTPUT_DIR}/metadata.json", "dashboard/src/metadata.json"]:
    json.dump(meta, open(path,"w",encoding="utf-8"), ensure_ascii=False, indent=2)

def fmt(v): return f"R$ {v:,.2f}".replace(",","_").replace(".",",").replace("_",".")
print(f"\n{'═'*58}")
print(f"✅ CONCLUÍDO — {len(records)} registros | {qtd_com_contrato} com contrato")
print(f"  📋 Empenhado:  {fmt(total_emp)}")
print(f"  💧 Liquidado:  {fmt(total_liq)}")
print(f"  💳 Pago:       {fmt(total_pago)}")
print(f"  ⏳ A Liquidar: {fmt(total_aliq)}")
print(f"  🔴 Vencidos:   {qtd_vencidos}  🟠 Vence 30d: {qtd_vence30}  🟡 Vence 90d: {qtd_vence90}")
print(f"  🕐 Atualizado: {agora}")
print(f"{'═'*58}")
