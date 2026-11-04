# Decisões do projeto

## Visual do escritório: aprovado em 04/11/2026

O protótipo está em `prototipo/escritorio-nvs.html` e serve de referência para a versão final.

- **Planta:** sala principal com o mural da NVS, sala de reunião com o mural da Novaes, corredor, cabine com vidro e estoque um andar abaixo.
- **Postos de trabalho:** 6 baias na sala principal e 1 mesa na cabine.
- **Estoque:** a escada preta sai direto do corredor e desce em linha reta, e as prateleiras laranja seguem a mesma direção.
- **Medidas:** são estimativas feitas a partir das fotos.

## Agentes

- **Por enquanto:** Rafael, Julio e Matheus.
- **Funções:** ainda serão definidas, assim como a IA de cada um (Claude ou Codex).
- **Hoje no protótipo:** falas e tarefas são simuladas, sem IA conectada.

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
- **Onde roda:** Railway, 24 horas.
- **No Sistema Novaes:** a leitura de envio pendente e a chave de serviço estão prontas no ramo `feat/agentes-leitura`, ainda sem commit e fora do ar.

## Onde o projeto fica

Neste PC, fora do OneDrive. É um projeto separado do NOVAES-ESTOQUE: terá repositório Git e projeto no Railway próprios, ainda não criados.
