# 21 — Decisões Confirmadas

Este é o documento de maior precedência.

1. Produto: NOVEX Finance / NOVEX.
2. Domínio alvo: `app.novexfinance.com.br`.
3. Uso atual: uma única pessoa. Não projetar telas ou permissões multiusuário como requisito.
4. Interface: desktop e mobile; site instalável como PWA.
5. Paleta: identidade NOVEX/NOVEXBR fornecida pelo usuário.
6. Estética: premium, limpa, moderna, dark-first.
7. Gráficos: dados reais; linhas/áreas/ondas; sem candlestick.
8. UI atualiza sem F5.
9. Mercado Pago é integração financeira principal da V1.
10. Saldo manual não é arquitetura oficial.
11. Movimentação líquida importada não é saldo atual. Saldo Mercado Pago só pode ser exibido como oficial quando houver âncora oficial validada, com data de referência. Sem isso, exibir como indisponível ou em reconciliação.
12. Movimentação não reconhecida ainda entra no ledger e afeta saldo, desde que oriunda de fonte financeira autorizada (Account Money / Settlement Report).
13. O usuário não precisa cadastrar previamente toda empresa/instituição que gerar débito/crédito.
14. Sistema pode aprender recorrências, nomes e categorias.
15. Sistema pode criar/sugerir categorias; usuário também pode criar.
16. Regra aprendida pode ser editada/desfeita.
17. Conta a receber: NOVEX gera cobrança Pix específica.
18. Cobrança pode ser enviada por WhatsApp via Evolution API.
19. Preservar a cadência/forma de cobrança já existente/configurada; não inventar uma nova sem auditoria.
20. Pagamento confirmado de cobrança baixa automaticamente.
21. QR de cobrança tem valor definido; entrada de valor diferente não vira “parcial” automaticamente.
22. Suporte a pagamento parcial pode existir como exceção, mas precisa de evidência.
23. Pagamento duplicado gera alerta e aguarda decisão do usuário.
24. Conta a pagar: NOVEX gera QR/Pix Copia e Cola.
25. O usuário realiza e confirma o Pix no aplicativo externo.
26. NOVEX observa a saída e tenta conciliá-la.
27. NOVEX nunca envia dinheiro.
28. NOVEX nunca executa refund/estorno/devolução/payout/transferência.
29. Estorno ocorrido externamente pode ser detectado, importado e contabilizado.
30. Notificações para o proprietário: painel + push/PWA, não WhatsApp como requisito.
31. LLM é opcional e auxiliar, não fonte da verdade financeira.
32. Deploy em Cloudflare é objetivo, não autorização automática.
33. Documentação e skills deste pacote substituem orientações antigas conflitantes.
