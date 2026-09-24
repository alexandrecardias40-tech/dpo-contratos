import pandas as pd
import json
import re
from collections import defaultdict

# Test grouping by Minuta Code / Licitação
df = pd.read_excel("BI CONTRATOS (5).xlsx", header=None, skiprows=3)
df.columns = [
    "ug_exec","ug_exec_nome","uo_cod","uo_nome","cnpj_cpf","favorecido_nome",
    "pi","pi_nome","ug_resp","ug_resp_nome","item_info",
    "credito","empenhado","a_liquidar","liquidado","pago",
    "rap_a_liq","rap_liq","rap_bloq","total"
]
df = df.dropna(subset=["cnpj_cpf"])
df["cnpj_cpf"] = df["cnpj_cpf"].astype(str)
df = df[~df["cnpj_cpf"].str.lower().str.contains("total", na=False)]

def norm(v): return re.sub(r"[^0-9A-Za-z]", "", str(v).strip())
def parse_br(v):
    if v is None: return 0.0
    try:
        if pd.isna(v): return 0.0
    except: pass
    if isinstance(v, (int, float)): return float(v)
    s = str(v).strip().replace("R$","").replace(" ","").replace(".","").replace(",",".")
    try: return float(s)
    except: return 0.0

df["cnpj_norm"] = df["cnpj_cpf"].apply(norm)

# Load raw contracts from Comprasnet
contratos_raw = json.load(open("/tmp/contratos_raw.json", "r"))
idx_minuta = {}

for c in contratos_raw:
    info = str(c.get("informacao_complementar","")).strip()
    m_info = re.match(r"^\s*(\d{17})", info)
    if m_info:
        # Map minuta code to contract
        idx_minuta[m_info.group(1)] = c

# Group Excel rows by (CNPJ, Minuta Code or Primary Contract Key)
primary_groups = defaultdict(list)

for idx, row in df.iterrows():
    emp   = parse_br(row.get("empenhado", 0))
    liq   = parse_br(row.get("liquidado", 0))
    pago  = parse_br(row.get("pago", 0))
    a_liq = parse_br(row.get("a_liquidar", 0))
    item_info = str(row.get("item_info","")).strip()

    if emp == 0 and liq == 0 and pago == 0 and a_liq == 0:
        if item_info in ("NAO SE APLICA", "nan", ""):
            continue

    cnpj = norm(row["cnpj_cpf"])
    minuta_cod = re.match(r"^\s*(\d{17})", item_info)
    m_key = minuta_cod.group(1) if minuta_cod else "SEM_MINUTA"

    # Group key: CNPJ + Minuta (or CNPJ alone if only 1 contract)
    primary_groups[(cnpj, m_key)].append((idx, row, emp, liq, pago, a_liq, item_info))

print(f"Total de grupos por CNPJ + Minuta: {len(primary_groups)}")

# Now for each CNPJ, if there are SEM_MINUTA rows alongside a Minuta group, merge them into the Minuta group!
cnpj_to_minutas = defaultdict(list)
for (cnpj, m_key) in primary_groups.keys():
    if m_key != "SEM_MINUTA":
        cnpj_to_minutas[cnpj].append(m_key)

consolidated_final = []

for (cnpj, m_key), rows in list(primary_groups.items()):
    if m_key == "SEM_MINUTA" and cnpj in cnpj_to_minutas:
        # Merge into the first/main minuta of this CNPJ
        main_m_key = cnpj_to_minutas[cnpj][0]
        primary_groups[(cnpj, main_m_key)].extend(rows)
        continue

for (cnpj, m_key), rows in primary_groups.items():
    if m_key == "SEM_MINUTA" and cnpj in cnpj_to_minutas:
        continue # Already merged above

    tot_emp  = sum(r[2] for r in rows)
    tot_liq  = sum(r[3] for r in rows)
    tot_pago = sum(r[4] for r in rows)
    tot_aliq = tot_emp - tot_liq

    fav_name = rows[0][1].get("favorecido_nome")
    c_obj = idx_minuta.get(m_key)

    consolidated_final.append({
        "cnpj": cnpj,
        "favorecido": fav_name,
        "minuta": m_key,
        "tem_contrato": c_obj is not None,
        "contrato_numero": c_obj.get("numero") if c_obj else "Empenho Direto",
        "emp": round(tot_emp, 2),
        "liq": round(tot_liq, 2),
        "pago": round(tot_pago, 2),
        "a_liquidar": round(tot_aliq, 2),
        "qtd_linhas": len(rows)
    })

print(f"\n✅ Total de registros consolidados perfeitos: {len(consolidated_final)}")

ac_recs = [r for r in consolidated_final if "09664031000111" in r['cnpj']]
print(f"\nRegistros para A A COSTA CONSTRUCOES LTDA ({len(ac_recs)} registro):")
for r in ac_recs:
    print(json.dumps(r, indent=2, ensure_ascii=False))
