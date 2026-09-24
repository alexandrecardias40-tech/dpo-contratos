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

# Count how many CNPJs have multiple lines in BI Contratos
counts = df.groupby("cnpj_norm").size()
multi_cnpjs = counts[counts > 1]
print(f"Total de CNPJs com múltiplas linhas no Excel: {len(multi_cnpjs)}")

# Print 10 examples of CNPJs with split lines (where one line has NAO SE APLICA and another has minuta/contract)
split_examples = []
for cnpj, sub_df in df.groupby("cnpj_norm"):
    infos = sub_df["item_info"].astype(str).tolist()
    has_minuta = any("UASG MINUTA" in info or re.search(r"\d{17}", info) for info in infos)
    has_nao_aplica = any("NAO SE APLICA" in info or "SEM INFORMACAO" in info for info in infos)
    if has_minuta and has_nao_aplica:
        fav_name = sub_df["favorecido_nome"].iloc[0]
        emp_tot = sub_df["empenhado"].apply(parse_br).sum()
        pago_tot = sub_df["pago"].apply(parse_br).sum()
        split_examples.append((cnpj, fav_name, len(sub_df), emp_tot, pago_tot))

print(f"\nCNPJs que possuem LINHAS DE CONTRATO + LINHAS 'NAO SE APLICA': {len(split_examples)}")
print("\nPrimeiros 10 exemplos:")
for ex in split_examples[:10]:
    print(f"  - CNPJ: {ex[0]} | {ex[1]} | Linhas: {ex[2]} | Total Emp: R$ {ex[3]:,.2f} | Total Pago: R$ {ex[4]:,.2f}")
