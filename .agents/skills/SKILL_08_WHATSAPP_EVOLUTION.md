# SKILL 08 — WhatsApp / Evolution API

Documento: `10_EVOLUTION_WHATSAPP_COBRANCAS.md`.

## Regra
Preservar a cadência configurada no produto. Auditar antes de alterar.

## Confiabilidade
Envio deve ser idempotente e registrado.
Falha de mensagem não muda status financeiro.
Worker só envia com instância `open`; `connecting` e QR disponível não significam conexão.
Conclusão exige envio real controlado, ID retornado pelo provedor e tentativa persistida, além do teste de não duplicação.

## Segurança
API key server-only e nenhum payload em logs. A imagem oficial Evolution v2.3.7 possui `console.log` direto de mensagens fora do logger configurável; portanto `LOG_LEVEL=ERROR,WARN` e `LOG_BAILEYS=fatal` são insuficientes sozinhos. Enquanto o upstream não comprovar a correção, exigir `logging.driver=none` no container Evolution e diagnosticar pelo healthcheck/endpoints autenticados.
