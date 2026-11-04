# Escritório NVS Tech

Escritório virtual em 3D onde agentes de IA trabalham como uma equipe.

Hoje a Luisa funciona com dados reais. Rafael, Julio e Matheus ainda aguardam função.

## Organização

| Pasta | O que guarda |
|---|---|
| `frontend/public/` | A tela: escritório 3D e painéis |
| `backend/src/` | O servidor: horários, relatórios e leitura do Sistema Novaes |
| `backend/test/` | Testes automáticos |
| `agentes/` | As instruções de cada agente |
| `docs/` | Decisões do projeto |

## Rodar no computador

Copie `.env.example` para `.env`, preencha os valores e rode:

```bash
npm install
npm run dev
```

O site abre em `http://localhost:3000`.

## Testes

```bash
npm test
```

## Publicação

O Railway publica a partir do `Dockerfile`. Os relatórios ficam no volume montado em `/data`.
