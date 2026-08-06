# 14 — Regras de código

## Gerais

- TypeScript strict.
- Sem `any` não justificado.
- Funções pequenas e nomes explícitos.
- Regras de negócio fora de componentes React.
- Nenhuma chamada Mercado Pago diretamente na UI.
- Nenhuma query sem escopo de workspace.
- Dinheiro nunca em ponto flutuante.
- Datas e timezone tratados explicitamente.
- Erros tipados.
- Logs estruturados.
- Migrations versionadas.

## Frontend

- componentes reutilizáveis;
- server/client components escolhidos conscientemente;
- formulários validados no cliente e servidor;
- loading e error boundaries;
- sem screenshot como interface;
- tokens de design;
- acessibilidade.

## Backend

- casos de uso idempotentes;
- transações de banco onde necessário;
- locks para jobs concorrentes;
- webhooks respondem rápido e delegam processamento;
- provider payload não contamina o domínio;
- adapters testáveis.

## Git

- branch por marco/feature;
- commits pequenos e descritivos;
- não versionar `.env`, tokens, bancos, logs ou uploads;
- não fazer push sem informar estado e testes;
- criar tag somente após aceite do marco.

## Proibições

- não usar ERPNext/Frappe;
- não copiar código desconhecido sem licença e auditoria;
- não inventar resposta da API;
- não dizer que algo é “tempo real” sem medição;
- não esconder erros com fallback silencioso;
- não fazer alteração destrutiva no projeto antigo;
- não colocar segredo em prompt, commit ou screenshot.
