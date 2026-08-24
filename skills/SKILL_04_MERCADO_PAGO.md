# SKILL 04 — Mercado Pago

Documentos: `05_MERCADO_PAGO_INTEGRACAO.md`, `23_FONTES_OFICIAIS.md`.

## Antes de alterar
Revalidar documentação oficial do endpoint específico.

## Separação
- cobrança Pix != extrato;
- Orders/Payment status != Dinheiro em Conta;
- Sandbox != Production.

## Proibido
Implementar operação que retire/devolva dinheiro.

## Evidência
Sandbox oficial pode testar integração, mas nunca substituir resposta remota por “sucesso simulado”.
