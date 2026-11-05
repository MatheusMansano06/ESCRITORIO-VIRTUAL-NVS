# Decisões do projeto

## Visual do escritório: aprovado em 04/11/2026

A tela está em `frontend/public/index.html`.

- **Planta:** sala principal com o mural da NVS, sala de reunião com o mural da Novaes, corredor e cabine com vidro. Um andar abaixo ficam o estoque e, depois da porta CONVERSE, a expedição e a área coberta da entrada.
- **Postos de trabalho:** 6 baias na sala principal, 1 mesa na cabine e, na expedição, a bancada da Luisa, o pós-venda e o notebook do estoque.
- **Estoque:** a escada preta sai direto do corredor e desce em linha reta, e as prateleiras laranja seguem a mesma direção.
- **Medidas:** são estimativas feitas a partir das fotos.

## Agentes

- **Equipe:** Luisa e Rafael (ativos), Julio e Matheus (sem função definida).
- **IA:** cada agente usa só o necessário. Tarefas de conta e comparação são feitas por código comum, sem gastar tokens.

## Integração com a operação: aprovada em 04/11/2026

- **Caminho:** os agentes acessam Mercado Livre, Shopee e Olist pelo Sistema Novaes (projeto NOVAES-ESTOQUE), que já mantém as conexões.
- **Chaves:** não são copiadas para cá, porque renovar o mesmo acesso em dois sistemas derruba a conexão. O Escritório usa uma chave de serviço própria.
- **Permissões:** começa só com leitura. Alterações virão depois, com aprovação humana.
- **Chave de serviço:** variável `AGENTES_API_KEY`, que abre só a leitura em `/api/agentes/*`.

## Agente Luisa: regra aprovada em 04/11/2026

- **Plataformas:** Mercado Livre e Shopee. Mercado Livre Full e canceladas ficam de fora. Conta por pacote.
- **Corte:** venda até 12:00 (Brasília) sai no mesmo dia. Venda depois disso sai no dia seguinte.
- **Relatório da manhã, todo dia antes das 8:00:** atrasadas como urgentes, mais a quantidade a enviar hoje que não está atrasada.
- **Relatório da noite, todo dia depois das 19:00:** o que ficou para trás.
- **Cérebro:** Claude Haiku 5.5 só escreve o relatório. A contagem é feita por código comum.
- **Onde roda:** Railway. O painel só consulta os canais das 7:00 às 19:30 (Brasília), todos os dias.
- **No Sistema Novaes:** a leitura de envio pendente e a chave de serviço estão no ar.

## Agente Rafael: regra aprovada em 04/11/2026

- **Plataforma:** Mercado Livre, anúncios ativos.
- **Horários:** todo dia às 7:00, 12:00 e 16:00 (Brasília). Se o servidor reiniciar, o relatório sai assim que ele voltar, até o começo do horário seguinte. O último vai até 19:30.
- **Tarefa:** listar só o SKU e o MLB dos anúncios sem promoção.
- **Regra:** anúncio só com desconto próprio (`PRICE_DISCOUNT`) entra na lista, porque ainda falta a promoção. Campanha agendada (`pending`) conta como promoção. Campanha só elegível (`candidate`) ou encerrada (`finished`) não conta.
- **Anúncio que não respondeu:** não entra na lista e o relatório sai marcado como INCOMPLETO.
- **Cérebro:** código comum, sem gastar tokens.
- **No Sistema Novaes:** a leitura `/api/agentes/anuncios-sem-promocao` está no ar.

## Onde o projeto fica

É um projeto separado do NOVAES-ESTOQUE, com Git e Railway próprios.

- **Site:** https://escritorio-production-17e6.up.railway.app, sem login por decisão do dono. Quem tiver o link vê as contagens e pode gerar um relatório a cada 5 minutos. A tela não traz dados de clientes.
- **Git:** https://github.com/MatheusMansano06/ESCRITORIO-VIRTUAL-NVS (privado).
- **Railway:** projeto `ESCRITORIO-VIRTUAL-NVS`, serviço `escritorio`, com os relatórios no volume `/data`.
- **IA:** Claude Haiku 5.5 pelo plano, com `CLAUDE_CODE_OAUTH_TOKEN`, que vale 1 ano.

## Pendências da Luisa

- Os atrasados do Mercado Livre saltaram de 13 (04/11, 16:55) para 93 (05/11, de manhã). Falta comparar com o painel do Mercado Livre para saber se é real ou erro de contagem.
- O relatório às vezes cita "JSON" no texto. Falta ajustar as instruções em `agentes/luisa.md`.
- O prazo de despacho do Mercado Livre ainda vem vazio. A contagem usa a regra das 12:00, então os números não dependem dele.
- O relatório aparece só no site. Telegram ou WhatsApp ainda não foram ligados.
- Pedidos da Shopee em "tentar novamente" (`RETRY_SHIP`) não entram na leitura. Na conferência com o painel, os números bateram sem eles.
