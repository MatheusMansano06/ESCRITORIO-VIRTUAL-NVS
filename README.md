# Escritório Virtual NVS

Escritório 3D no navegador onde **agentes de IA trabalham como uma equipe**. Cada agente lê dados reais da operação de e-commerce (Mercado Livre e Shopee), roda em horários fixos e entrega um relatório que aparece na mesa dele, ao vivo.

| | |
|---|---|
| **IA** | Claude Agent SDK · Claude Haiku |
| **Backend** | Node.js 22 · TypeScript nativo (sem build) · Server-Sent Events |
| **Frontend** | Three.js (WebGL) · cena 3D do escritório e painéis |
| **Dados** | API somente leitura do [Sistema Novaes](https://github.com/MatheusMansano06/NOVAES-ESTOQUE) |
| **Deploy** | Docker · Railway, com volume para os relatórios |

## Agentes

| Agente | Tarefa | Quando |
|---|---|---|
| **Luisa** | Conta pacotes pendentes de envio no Mercado Livre e na Shopee, separa urgentes (atrasados) do que sai hoje e escreve a abertura do relatório | Manhã (antes das 8h) e noite (depois das 19h) |
| **Rafael** | Lista anúncios ativos do Mercado Livre sem promoção, com regras para campanha agendada, elegível ou encerrada | 7h, 12h e 16h |

## Decisões de engenharia

- **O LLM só escreve, o código conta.** Contagem, regras de corte (venda até 12h sai no mesmo dia) e comparação de promoções ficam em funções puras e testadas. O modelo recebe só o JSON pronto e escreve duas frases. Resultado: custo baixo em tokens e números que nunca são inventados.
- **Prompt com defesa contra injeção.** As instruções do agente ([agentes/luisa.md](agentes/luisa.md)) mandam tratar o JSON apenas como dados e usar somente os números recebidos.
- **Falha do modelo não vira relatório.** O SDK pode devolver `success` com `is_error`; esse caso é tratado como erro e o texto nunca chega à tela.
- **Uso de tokens medido** em cada chamada (`modelUsage`, incluindo cache).
- **Credenciais isoladas.** Os agentes não guardam tokens de marketplace: leem pelo Sistema Novaes com uma chave de serviço própria, só leitura e sem dados de compradores.
- **Resiliente a reinício.** Se o servidor cair, o relatório perdido sai assim que ele volta, até o início do horário seguinte. Leitura que não responde marca o relatório como **INCOMPLETO** em vez de mostrar números errados.
- **Tempo real sem framework.** O painel recebe atualizações por Server-Sent Events (`/api/eventos`).

## Estrutura

```
agentes/            instruções (prompt) de cada agente
backend/src/
├── main.ts         ciclo de trabalho dos agentes e servidor
├── servidor.ts     HTTP, SSE, proteção CSRF
├── novaes.ts       leitor da API do Sistema Novaes
├── luisa/          contagem de envios + resumo com Claude
└── rafael/         anúncios sem promoção
backend/test/       testes (node:test)
frontend/public/    escritório 3D e painéis
docs/decisoes.md    regras de negócio aprovadas
```

## Rodar localmente

Requer Node.js 22.18+.

```bash
cp .env.example .env   # NOVAES_URL, AGENTES_API_KEY e CLAUDE_CODE_OAUTH_TOKEN (claude setup-token)
npm install
npm run dev            # http://localhost:3000
```

## Testes

```bash
npm test
```
