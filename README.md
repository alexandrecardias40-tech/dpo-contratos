# 📄 Dashboard de Contratos UnB — DPO

Sistema de gestão visual e acompanhamento financeiro de contratos, notas de empenho e vigências da Fundação Universidade de Brasília (UnB), alimentado por dados do **Tesouro Gerencial (SIAFI)** e integrado com a **API Oficial do Comprasnet (UG 154040)**.

## 🚀 Live Demo
- **URL no Render**: [https://dpo-contratos.onrender.com/](https://dpo-contratos.onrender.com/)
- **Repositório GitHub**: [https://github.com/alexandrecardias40-tech/dpo-contratos](https://github.com/alexandrecardias40-tech/dpo-contratos)

---

## 📌 Funcionalidades
- **Painel Executivo de KPIs**: Valores empenhados, liquidados, pagos e saldo a liquidar acumulados.
- **Calendário de Vigências**: Alertas visuais e contagem regressiva dinâmica para contratos a vencer em 30, 90 e 180 dias.
- **Leitor Inline de PDF Original**: Visualização em tela dos arquivos oficiais de Nota de Empenho via Gescon com botão de download sob demanda.
- **Rateio Orçamentário por Unidade (UGR)**: Transparência completa da distribuição de recursos entre as faculdades e institutos da UnB.
- **Auditoria de Execução**: Prevenção e explicação de divergências contábeis e liquidações de Restos a Pagar.

---

## 🛠️ Tecnologias
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Wouter.
- **Processamento de Dados**: Python 3 (Pandas, Requests, Regex).
- **Hospedagem Estática**: Render Static Sites (Gratuito e sem consumo de créditos).

---

## 💻 Como Rodar Localmente

```bash
# 1. Clonar o repositório
git clone https://github.com/alexandrecardias40-tech/dpo-contratos.git
cd dpo-contratos/dashboard

# 2. Instalar dependências
npm install

# 3. Iniciar servidor de desenvolvimento
npm run dev
```

---

## ⚙️ Como Atualizar os Dados Orçamentários

```bash
# Executar script de sincronização dos dados do Tesouro Gerencial + Comprasnet API
python3 build_data.py
```
