# 11 — Atualização sem F5, PWA e Notificações

## Requisito UX
O painel deve permanecer atualizado sem o usuário pressionar F5.

## Estratégia
Usar eventos do backend/webhooks quando disponíveis e mecanismo leve de atualização do cliente. Onde a fonte for assíncrona, usar polling controlado do estado já persistido, não disparar operação remota cara a cada poll.

A implementação pode escolher SSE, WebSocket, invalidation/polling inteligente ou combinação compatível com a infraestrutura. O critério é comportamento, segurança e eficiência.

## PWA
**PWA = Progressive Web App, site instalável na tela inicial e com experiência próxima de app.**
Requisitos:
- web app manifest;
- ícones oficiais;
- modo standalone quando suportado;
- service worker quando necessário;
- layout mobile-first;
- instalação sem criar app nativo;
- domínio `app.novexfinance.com.br`.

## Push
Notificações úteis:
- pagamento de cliente confirmado;
- possível duplicidade;
- movimentação que exige decisão;
- conta vencendo;
- falha persistente de sincronização;
- situação financeira relevante configurada.

Push deve ser opt-in e ter configuração. O painel também mantém central de notificações.

## Não prometer
“Tempo real” só deve ser usado se o fluxo foi testado. Caso contrário, usar “atualizado automaticamente” e exibir timestamp.
