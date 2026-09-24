import json, requests

headers = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}

# Fetch list of active contracts
res = requests.get("https://contratos.comprasnet.gov.br/api/contrato/ug/154040", headers=headers)
contratos = res.json()

print(f"Total de contratos na UG 154040: {len(contratos)}")

sub_resources = ['historico', 'empenhos', 'cronograma', 'garantias', 'itens', 'prepostos', 'responsaveis', 'faturas', 'ocorrencias', 'arquivos']

summary_counts = {sr: 0 for sr in sub_resources}
examples = {}

for c in contratos[:30]:
    cid = c['id']
    for sr in sub_resources:
        url = f"https://contratos.comprasnet.gov.br/api/contrato/{cid}/{sr}"
        r = requests.get(url, headers=headers)
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, list) and len(data) > 0:
                summary_counts[sr] += 1
                if sr not in examples:
                    examples[sr] = (cid, c['numero'], data[0])

print("\n--- RESUMO DE DISPONIBILIDADE NOS 30 PRIMEIROS CONTRATOS ---")
for sr, count in summary_counts.items():
    print(f"{sr}: {count}/30 contratos possuem dados")

print("\n--- EXEMPLOS DE ESTRUTURA DE CADA SUB-RECURSO ---")
for sr, ex in examples.items():
    print(f"\n>>> Sub-recurso: {sr} (Exemplo do Contrato {ex[1]}, ID {ex[0]})")
    print(json.dumps(ex[2], indent=2, ensure_ascii=False)[:600])
