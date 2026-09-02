# 10 — Evolution API e Cobranças por WhatsApp

## Função
WhatsApp é canal de cobrança para devedores, não canal principal de notificações do proprietário.

## Operação local

Nesta fase, a Evolution API faz parte do ambiente local administrado pelo NOVEX. O bootstrap local preserva ou gera os segredos necessários, sobe banco, Redis, Evolution, aplicação e worker, cria/recupera a instância de forma idempotente e apresenta o QR real. O usuário precisa apenas escanear o QR; conexão só existe quando a Evolution informar estado `open`.

A interface deve distinguir as etapas: serviço acessível, autenticação aceita, instância existente, QR disponível, pareamento pendente e conexão aberta.

## Fluxo
- cobrança elegível;
- regra/cadência persistida decide quando enviar, incluindo aproximação do vencimento e atraso;
- NOVEX monta mensagem;
- inclui valor, contexto e Pix da cobrança;
- envia via Evolution API;
- registra tentativa, resultado e identificador da mensagem;
- retry controlado em falha transitória;
- não duplica envio por reprocessamento.

O worker local deve avaliar cobranças elegíveis periodicamente, retomar tentativas transitórias e nunca enviar antes de a instância estar `open`. A homologação exige QR escaneado, estado `open`, envio controlado real, identificador retornado pela Evolution e registro persistido da tentativa.

A instância administrada pelo NOVEX opera em perfil de saída: `syncFullHistory=false`, `groupsIgnore=true`, `readMessages=false` e `readStatus=false`. O bot de cobrança não precisa importar conversas, grupos, áudios ou histórico pessoal do WhatsApp.

## Conteúdo
Tom profissional, claro e não agressivo. Evitar spam. O usuário escolhe/configura a forma de cobrar onde o sistema já permite isso.

## Segurança
- API key server-only;
- instância e base URL tratadas como configuração;
- não expor chave no client;
- nenhum payload ou chave de sessão pode ser persistido em logs;
- na imagem oficial v2.3.7, `LOG_LEVEL`/`LOG_BAILEYS` não controlam todos os `console.log` diretos de mensagens; por isso o container Evolution usa `logging.driver=none` até correção comprovada do upstream;
- diagnóstico de serviço, autenticação, instância, QR, pareamento e estado `open` usa healthcheck e endpoints autenticados, sem depender de stdout;
- normalizar telefone;
- timeout;
- idempotência de envio.

## Falhas
Falha no WhatsApp não deve alterar o estado financeiro da dívida. Cobrança “enviada” e dívida “paga” são estados independentes.

## Notificação do proprietário
Preferir painel/PWA/push. Não enviar WhatsApp ao proprietário como requisito da V1.
