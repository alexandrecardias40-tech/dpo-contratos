import pandas as pd
import json
import re
from collections import defaultdict

# Test the full grouping fix
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

# Load cache of contracts
contratos_raw = json.load(open("/tmp/contratos_raw.json", "r"))
idx_minuta = {}
idx_cnpj = defaultdict(list)
idx_cnpj_num = {}

for c in contratos_raw:
    info = str(c.get("informacao_complementar","")).strip()
    m_info = re.match(r"^\s*(\d{17})", info)
    if m_info:
        idx_minuta[m_info.group(1)] = c
    forn = c.get("fornecedor") or {}
    cnpj = norm(forn.get("cnpj_cpf_idgener"))
    num = str(c.get("numero","")).strip()
    if cnpj:
        idx_cnpj[cnpj].append(c)
        if num:
            idx_cnpj_num[(cnpj, num)] = c

raw_records = []
for idx, row in df.iterrows():
    cnpj = norm(row["cnpj_cpf"])
    emp   = parse_br(row.get("empenhado", 0))
    liq   = parse_br(row.get("liquidado", 0))
    pago  = parse_br(row.get("pago", 0))
    a_liq = parse_br(row.get("a_liquidar", 0))
    item_info = str(row.get("item_info","")).strip()

    if emp == 0 and liq == 0 and pago == 0 and a_liq == 0:
        if item_info in ("NAO SE APLICA", "nan", ""):
            continue

    minuta_cod = re.match(r"^\s*(\d{17})", item_info)
    contrato = None
    if minuta_cod and minuta_cod.group(1) in idx_minuta:
        contrato = idx_minuta[minuta_cod.group(1)]

    raw_records.append({
        "cnpj_digits": cnpj,
        "row": row,
        "emp": emp,
        "liq": liq,
        "pago": pago,
        "a_liq": a_liq,
        "item_info": item_info,
        "contrato": contrato,
    })

# Group raw records by CNPJ
cnpj_map = defaultdict(list)
for r in raw_records:
    cnpj_map[r["cnpj_digits"]].append(r)

consolidated_records = []

for cnpj, group_rows in cnpj_map.items():
    # Check matched contracts in this group
    matched = {}
    for r in group_rows:
        if r["contrato"]:
            matched[r["contrato"]["id"]] = r["contrato"]

    # Fallback to Comprasnet index if no minuta match
    if not matched and cnpj in idx_cnpj:
        c = idx_cnpj[cnpj][0]
        matched[c["id"]] = c

    if len(matched) <= 1:
        # 1 or 0 matched contracts -> ALL rows of this CNPJ consolidate into 1 record!
        c_obj = list(matched.values())[0] if matched else None
        tot_emp  = sum(r["emp"] for r in group_rows)
        tot_liq  = sum(r["liq"] for r in group_rows)
        tot_pago = sum(r["pago"] for r in group_rows)
        tot_aliq = tot_emp - tot_liq

        fav_name = group_rows[0]["row"].get("favorecido_nome")

        consolidated_records.append({
            "favorecido": fav_name,
            "cnpj": cnpj,
            "tem_contrato": c_obj is not None,
            "contrato_numero": c_obj.get("numero") if c_obj else "Empenho Direto",
            "emp": round(tot_emp, 2),
            "liq": round(tot_liq, 2),
            "pago": round(tot_pago, 2),
            "a_liquidar": round(tot_aliq, 2),
        })
    else:
        # Multiple matched contracts for this CNPJ -> group by contract ID
        sub_groups = defaultdict(list)
        for r in group_rows:
            cid = r["contrato"]["id"] if r["contrato"] else list(matched.keys())[0]
            sub_groups[cid].append(r)

        for cid, s_rows in sub_groups.items():
            c_obj = matched[cid]
            tot_emp  = sum(r["emp"] for r in s_rows)
            tot_liq  = sum(r["liq"] for r in s_rows)
            tot_pago = sum(r["pago"] for r in s_rows)
            tot_aliq = tot_emp - tot_liq

            consolidated_records.append({
                "favorecido": s_rows[0]["row"].get("favorecido_nome"),
                "cnpj": cnpj,
                "tem_contrato": True,
                "contrato_numero": c_obj.get("numero"),
                "emp": round(tot_emp, 2),
                "liq": round(tot_liq, 2),
                "pago": round(tot_pago, 2),
                "a_liquidar": round(tot_aliq, 2),
            })

print(f"Total de registros finais consolidados: {len(consolidated_records)}")

# Totais gerais
total_emp = sum(r["emp"] for r in consolidated_records)
total_liq = sum(r["liq"] for r in consolidated_records)
total_pago = sum(r["pago"] for r in consolidated_records)
total_aliq = sum(r["a_liquidar"] for r in consolidated_records)

print(f"Empenhado Total: R$ {total_emp:,.2f}")
print(f"Liquidado Total: R$ {total_liq:,.2f}")
print(f"Pago Total:      R$ {total_pago:,.2f}")
print(f"A Liquidar Tot:  R$ {total_aliq:,.2f}")
