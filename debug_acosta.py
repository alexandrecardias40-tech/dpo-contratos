import pandas as pd
import json

df = pd.read_excel("BI CONTRATOS (5).xlsx", header=None, skiprows=3)
df.columns = [
    "ug_exec","ug_exec_nome","uo_cod","uo_nome","cnpj_cpf","favorecido_nome",
    "pi","pi_nome","ug_resp","ug_resp_nome","item_info",
    "credito","empenhado","a_liquidar","liquidado","pago",
    "rap_a_liq","rap_liq","rap_bloq","total"
]

df = df.dropna(subset=["cnpj_cpf"])
df["cnpj_cpf"] = df["cnpj_cpf"].astype(str)

# Filter for A A COSTA
acosta = df[df["cnpj_cpf"].str.contains("09664031000111|09\.664\.031", regex=True)]

print(f"Total de linhas no Excel para A A COSTA: {len(acosta)}")
for idx, row in acosta.iterrows():
    print(f"\n--- Linha {idx} ---")
    print(f"Favorecido: {row['favorecido_nome']}")
    print(f"Item Info: {row['item_info']}")
    print(f"PI: {row['pi']} - {row['pi_nome']}")
    print(f"Empenhado: {row['empenhado']} | Liquidado: {row['liquidado']} | Pago: {row['pago']} | A Liquidar: {row['a_liquidar']}")
