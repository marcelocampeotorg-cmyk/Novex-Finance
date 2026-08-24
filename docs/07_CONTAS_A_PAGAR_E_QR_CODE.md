# 07 — Contas a Pagar e QR Code

## Objetivo
Facilitar pagamento no computador sem conceder ao NOVEX autoridade de movimentação.

## Cadastro
- favorecido;
- descrição;
- chave Pix;
- valor;
- vencimento;
- parcelas/recorrência quando necessário;
- categoria opcional.

## Ação “Pagar”
O NOVEX gera:
- Pix Copia e Cola/BR Code válido;
- QR Code renderizado de verdade;
- valor e favorecido visíveis;
- referência interna única quando o padrão permitir.

O usuário escaneia o QR com o celular e confirma o Pix no aplicativo financeiro.

## Estado
Gerar QR cria uma **intenção de pagamento**, não um pagamento.
Estados possíveis:
- aguardando pagamento;
- provável correspondência encontrada;
- pago/conciliado;
- divergente;
- cancelado/expirado conforme a regra do produto.

## Conciliação
Quando uma saída real aparece, o sistema tenta relacionar usando os dados disponíveis: referência, valor, chave/favorecido quando exposto, descrição, horário, instituição, janela temporal e contexto.

Não assumir que `txId`/external reference será devolvido em toda transferência de saída. A arquitetura deve funcionar mesmo quando alguns campos não forem retornados.

## Proibido
- botão “Simular Pagamento Efetuado” em produção;
- marcar pago após timeout;
- endpoint que envia o Pix;
- refund automático;
- fallback que cria sucesso local sem evento financeiro real.
