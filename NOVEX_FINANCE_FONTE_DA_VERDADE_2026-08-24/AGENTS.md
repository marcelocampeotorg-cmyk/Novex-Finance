# AGENTS.md — Protocolo obrigatório para qualquer agente de IA

Este repositório possui uma **Fonte da Verdade**. Antes de alterar código, esquema, interface, integração, infraestrutura ou testes:

1. leia `docs/21_DECISOES_CONFIRMADAS.md`;
2. leia `docs/02_REGRAS_INEGOCIAVEIS.md`;
3. leia o documento funcional correspondente ao trabalho solicitado;
4. leia a skill correspondente em `skills/`;
5. leia `docs/20_AUDITORIA_ESTADO_ATUAL.md` quando tocar em área já implementada;
6. registre qualquer erro novo em `docs/ERROR_LOG.md`;
7. confirme no código real o estado atual antes de assumir que uma feature existe.

## Proibição de escopo inventado

Não implementar funcionalidade que não esteja autorizada pela documentação. Ideias novas devem ser registradas como proposta, não codificadas silenciosamente.

## Regra financeira máxima

O NOVEX pode:
- observar;
- importar;
- interpretar;
- categorizar;
- conciliar;
- gerar QR/Pix para o usuário pagar;
- gerar cobrança Pix para receber;
- enviar cobrança por WhatsApp;
- atualizar painel, ledger e notificações.

O NOVEX **não pode executar saída de dinheiro**:
- não envia Pix;
- não paga boleto;
- não faz payout;
- não transfere;
- não saca;
- não executa refund/estorno/devolução pela API.

Se o código atual fizer algo disso, tratar como incongruência a corrigir, não como requisito.

## Evidência

Build verde isolado não prova funcionamento. Uma entrega só pode ser declarada concluída com evidências apropriadas: lint/typecheck/testes, banco/migrations quando aplicável, integração real ou sandbox oficial quando aplicável, QA visual e ausência de mocks/simulações no fluxo de produção.
