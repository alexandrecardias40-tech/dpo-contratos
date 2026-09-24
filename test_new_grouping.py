import pandas as pd
import json
import re
from collections import defaultdict

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

print(f"Total de linhas no Excel: {len(df)}")

# Test new consolidation algorithm
# Group rows by CNPJ
cnpj_groups = defaultdict(list)
for idx, row in df.iterrows():
    emp = parse_br(row.get("empenhado", 0))
    liq = parse_br(row.get("liquidado", 0))
    pago = parse_br(row.get("pago", 0))
    a_liq = parse_br(row.get("a_liquidar", 0))
    if emp == 0 and liq == 0 and pago == 0 and a_liq == 0:
        continue
    cnpj = norm(row["cnpj_cpf"])
    cnpj_groups[cnpj].append((idx, row, emp, liq, pago, a_liq))

final_records = []

for cnpj, rows in cnpj_groups.items():
    # Find all contracts matched by any row in this CNPJ group
    matched_contracts = {}
    for idx, row, emp, liq, pago, a_liq in rows:
        minuta_cod = re.match(r"^\s*(\d{17})", str(row.get("item_info","")).strip())
        if minuta_cod and minuta_cod.group(1) in idx_minuta:
            c = idx_minuta[minuta_cod.group(1)]
            matched_contracts[c['id']] = c

    # If no minuta match, check if CNPJ has contracts in Comprasnet
    if not matched_contracts and cnpj in idx_cnpj:
        c = idx_cnpj[cnpj][0]
        matched_contracts[c['id']] = c

    if len(matched_contracts) <= 1:
        # CONSOLIDATE ALL ROWS OF THIS CNPJ INTO 1 SINGLE CONTRACT/RECORD
        c_obj = list(matched_contracts.values())[0] if matched_contracts else None
        tot_emp  = sum(r[2] for r in rows)
        tot_liq  = sum(r[3] for r in rows)
        tot_pago = sum(r[4] for r in rows)
        tot_aliq = tot_emp - tot_liq

        fav_name = rows[0][1].get("favorecido_nome")
        pi_val = rows[0][1].get("pi")
        pi_nome = rows[0][1].get("pi_nome")

        final_records.append({
            "cnpj": cnpj,
            "favorecido": fav_name,
            "tem_contrato": c_obj is not None,
            "contrato_numero": c_obj.get("numero") if c_obj else "Empenho Direto",
            "emp": round(tot_emp, 2),
            "liq": round(tot_liq, 2),
            "pago": round(tot_pago, 2),
            "a_liquidar": round(tot_aliq, 2),
            "linhas_consolidadas": len(rows)
        })
    else:
        # Multiple matched contracts: group rows by contract ID or sub-key
        sub_groups = defaultdict(list)
        for idx, row, emp, liq, pago, a_liq in rows:
            minuta_cod = re.match(r"^\s*(\d{17})", str(row.get("item_info","")).strip())
            cid = None
            if minuta_cod and minuta_cod.group(1) in idx_minuta:
                cid = idx_minuta[minuta_cod.group(1)]['id']
            else:
                cid = list(matched_contracts.keys())[0]
            sub_groups[cid].append((idx, row, emp, liq, pago, a_liq))

        for cid, s_rows in sub_groups.items():
            c_obj = matched_contracts[cid]
            tot_emp  = sum(r[2] for r in s_rows)
            tot_liq  = sum(r[3] for r in s_rows)
            tot_pago = sum(r[4] for r in s_rows)
            tot_aliq = tot_emp - tot_liq

            final_records.append({
                "cnpj": cnpj,
                "favorecido": s_rows[0][1].get("favorecido_nome"),
                "tem_contrato": True,
                "contrato_numero": c_obj.get("numero"),
                "emp": round(tot_emp, 2),
                "liq": round(tot_liq, 2),
                "pago": round(tot_pago, 2),
                "a_liquidar": round(tot_aliq, 2),
                "linhas_consolidadas": len(s_rows)
            })

print(f"\n✅ Total de registros consolidados gerados: {len(final_records)}")

# Check A A COSTA in final_records
ac_recs = [r for r in final_records if "09664031000111" in r['cnpj']]
print(f"\nRegistros para A A COSTA CONSTRUCOES LTDA ({len(ac_recs)} registro):")
for r in ac_recs:
    print(json.dumps(r, indent=2, ensure_ascii=False))
