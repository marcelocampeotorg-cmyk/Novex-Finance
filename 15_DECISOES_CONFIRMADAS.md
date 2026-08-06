# 15 — Decisões confirmadas

Estas decisões prevalecem sobre documentos e prompts anteriores.

1. O projeto será criado do zero em nova pasta e novo repositório.
2. ERPNext e Frappe não serão utilizados.
3. O produto inicial é financeiro pessoal.
4. O sistema será preparado para vários usuários no futuro.
5. O login será por e-mail e senha.
6. O sistema será preparado para Docker desde o começo.
7. Todas as movimentações reais relevantes ocorrerão na conta Mercado Pago.
8. O usuário atualmente não usa cartão de crédito Mercado Pago.
9. O usuário já possui conta Mercado Pago e integração/API em um painel existente.
10. Recebimentos serão automatizados por cobrança Pix e webhook.
11. O sistema não fará pagamentos automáticos.
12. Para pagar contas, o painel gera QR Code/Copia e Cola; o usuário confirma no Mercado Pago.
13. Depois do pagamento, o painel deve reconhecer a saída e atualizar automaticamente.
14. Compras feitas fora do painel devem ser importadas automaticamente.
15. Movimentações não reconhecidas entram como não categorizadas, sem exigir lançamento manual.
16. Saldo atual deve vir da API quando possível; fallback deve ser calculado e identificado.
17. Saldo previsto deve considerar compromissos e recebimentos futuros.
18. Existem negociações com valor total, parcelamento e valores variáveis.
19. Pagamentos e recebimentos parciais são necessários.
20. Recorrências são necessárias.
21. Lembretes serão configuráveis.
22. Exclusão e lixeira serão permitidas, sem apagar transações externas imutáveis.
23. Comprovante automático não é requisito bloqueador; upload manual é suficiente inicialmente.
24. O Antigravity deve fornecer um link de preview para acompanhar o desenvolvimento.
