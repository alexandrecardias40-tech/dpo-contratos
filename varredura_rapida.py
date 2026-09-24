import json, requests

headers = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}

# Test explicitly with a few contracts
contratos_list = [9633, 154040, 10000, 12000, 15000]
sub_resources = ['historico', 'empenhos', 'cronograma', 'garantias', 'itens', 'prepostos', 'responsaveis', 'faturas', 'ocorrencias', 'arquivos']

for cid in [9633, 10500, 11200, 13000, 14500]:
    print(f"=== CONTRATO ID {cid} ===", flush=True)
    for sr in sub_resources:
        url = f"https://contratos.comprasnet.gov.br/api/contrato/{cid}/{sr}"
        r = requests.get(url, headers=headers)
        if r.status_code == 200:
            data = r.json()
            if isinstance(data, list) and len(data) > 0:
                print(f"  -> {sr}: {len(data)} itens", flush=True)
                keys = list(data[0].keys())
                print(f"     Campos: {keys}", flush=True)
