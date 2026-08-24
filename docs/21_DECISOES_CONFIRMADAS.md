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
11. Movimentação não reconhecida ainda entra no ledger e afeta saldo.
12. O usuário não precisa cadastrar previamente toda empresa/instituição que gerar débito/crédito.
13. Sistema pode aprender recorrências, nomes e categorias.
14. Sistema pode criar/sugerir categorias; usuário também pode criar.
15. Regra aprendida pode ser editada/desfeita.
16. Conta a receber: NOVEX gera cobrança Pix específica.
17. Cobrança pode ser enviada por WhatsApp via Evolution API.
18. Preservar a cadência/forma de cobrança já existente/configurada; não inventar uma nova sem auditoria.
19. Pagamento confirmado de cobrança baixa automaticamente.
20. QR de cobrança tem valor definido; entrada de valor diferente não vira “parcial” automaticamente.
21. Suporte a pagamento parcial pode existir como exceção, mas precisa de evidência.
22. Pagamento duplicado gera alerta e aguarda decisão do usuário.
23. Conta a pagar: NOVEX gera QR/Pix Copia e Cola.
24. O usuário realiza e confirma o Pix no aplicativo externo.
25. NOVEX observa a saída e tenta conciliá-la.
26. NOVEX nunca envia dinheiro.
27. NOVEX nunca executa refund/estorno/devolução/payout/transferência.
28. Estorno ocorrido externamente pode ser detectado, importado e contabilizado.
29. Notificações para o proprietário: painel + push/PWA, não WhatsApp como requisito.
30. LLM é opcional e auxiliar, não fonte da verdade financeira.
31. Deploy em Cloudflare é objetivo, não autorização automática.
32. Documentação e skills deste pacote substituem orientações antigas conflitantes.
