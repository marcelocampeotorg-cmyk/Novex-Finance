# 07 — Mercado Pago e Pix

## Objetivos da integração

1. Criar cobranças Pix para contas a receber.
2. Confirmar recebimentos por webhook.
3. Importar entradas e saídas da conta Mercado Pago.
4. Atualizar saldo, quando a API permitir.
5. Conciliar pagamentos de contas e compras externas.

## Requisito crítico

A integração existente do usuário deve ser auditada antes de qualquer reescrita. O novo sistema pode reutilizar conceitos ou código isolado, mas não deve copiar credenciais, dependências antigas ou acoplamento ruim.

## Recebimentos

- Criar cobrança no servidor.
- Usar `external_reference` vinculada à parcela.
- Usar chave de idempotência.
- Guardar somente dados necessários.
- Processar webhook em fila.
- Verificar assinatura.
- Buscar o pagamento oficial antes de alterar o domínio.
- Tratar approved, pending, rejected, canceled, expired, refunded e reversed.

## Pagamentos de contas

O NOVEX não inicia transferência e não movimenta dinheiro.

- Gera payload Pix padrão com chave, valor, descrição e `txid` único.
- Exibe QR Code e Copia e Cola.
- O usuário confirma no aplicativo Mercado Pago.
- O worker importa a saída.
- O motor de conciliação vincula a saída à parcela.

## Compras fora do painel

- Importar todos os débitos disponíveis pela API ou relatório da conta.
- Criar despesa não planejada quando não houver conta correspondente.
- Não exigir digitação manual.

## Saldo

Implementar estratégia por capacidade:

1. Se a API disponibilizar saldo atual confiável: armazenar snapshot e exibir fonte/provider.
2. Se apenas relatórios/movimentações estiverem disponíveis: calcular saldo local a partir de saldo inicial/snapshot e ledger.
3. Exibir sempre `última sincronização` e tipo de saldo: `SINCRONIZADO` ou `CALCULADO`.

Não prometer tempo real antes do teste com credenciais reais.

## Sincronização

- O intervalo é configurável.
- Usar cursor e janela com sobreposição para evitar perdas.
- Deduplicar por identificador externo.
- Respeitar rate limits e backoff.
- Fazer reconciliação histórica após reconexão.
- Ter botão “Sincronizar agora”, com proteção contra chamadas concorrentes.

## Segurança de credenciais

- Tokens apenas no backend.
- Criptografia em repouso.
- Nunca registrar tokens em logs.
- Nunca enviar token para o navegador.
- `.env` não versionado.
- OAuth por usuário será necessário antes de transformar em SaaS para terceiros.

## Comprovante

Criar um capability flag `supports_receipt`.

- Se suportado, guardar referência segura.
- Se não suportado, manter upload manual.
- Não atrasar o núcleo por causa deste recurso.
