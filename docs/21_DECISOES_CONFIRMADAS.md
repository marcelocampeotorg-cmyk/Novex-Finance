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
10. O produto possui somente dois modos operacionais: **Manual** e **Híbrido**.
11. No modo Manual existe uma única conta geral, com saldo inicial datado e lançamentos manuais auditáveis.
12. No modo Híbrido coexistem a conta geral manual e a conta Mercado Pago sincronizada; o saldo da conta Mercado Pago nunca pode ser sobrescrito manualmente.
13. Alterações em fatos manuais já contabilizados preservam o histórico por reversão e substituição; não reescrevem silenciosamente o Ledger.
14. Dados financeiros sem evidência suficiente entram em quarentena, deixam de afetar totais e permanecem disponíveis para revisão; não são apagados automaticamente.
15. Movimentação líquida importada não é saldo atual. Saldo Mercado Pago só pode ser exibido como oficial quando houver âncora oficial validada, com data de referência.
16. Se o saldo oficial do Mercado Pago estiver indisponível, o produto não exibe total consolidado; mostra separadamente os valores conhecidos e o estado de reconciliação.
17. A sincronização histórica do Mercado Pago busca a maior cobertura realmente disponibilizada pelo provedor, em janelas oficiais de no máximo 60 dias, com progresso e retomada.
18. A Evolution API é integrada e administrada localmente pelo NOVEX nesta fase; o usuário realiza apenas o pareamento real pelo QR Code.
19. Movimentação não reconhecida ainda entra no ledger e afeta o saldo da conta de origem, desde que sua fonte seja autorizada.
20. O usuário não precisa cadastrar previamente toda empresa/instituição que gerar débito/crédito.
21. Sistema pode aprender recorrências, nomes e categorias.
22. Sistema pode criar/sugerir categorias; usuário também pode criar.
23. Regra aprendida pode ser editada/desfeita.
24. Conta a receber: NOVEX gera cobrança Pix específica.
25. Cobrança pode ser enviada por WhatsApp via Evolution API.
26. Preservar a cadência/forma de cobrança já existente/configurada; não inventar uma nova sem auditoria.
27. Pagamento confirmado de cobrança baixa automaticamente.
28. QR de cobrança tem valor definido; entrada de valor diferente não vira “parcial” automaticamente.
29. Suporte a pagamento parcial pode existir como exceção, mas precisa de evidência.
30. Pagamento duplicado gera alerta e aguarda decisão do usuário.
31. Conta a pagar: NOVEX gera QR/Pix Copia e Cola.
32. O usuário realiza e confirma o Pix no aplicativo externo.
33. NOVEX observa a saída e tenta conciliá-la.
34. NOVEX nunca envia dinheiro.
35. NOVEX nunca executa refund/estorno/devolução/payout/transferência.
36. Estorno ocorrido externamente pode ser detectado, importado e contabilizado.
37. Notificações para o proprietário: painel + push/PWA, não WhatsApp como requisito.
38. LLM é opcional e auxiliar, não fonte da verdade financeira.
39. Deploy em Cloudflare é objetivo, não autorização automática.
40. Documentação e skills deste pacote substituem orientações antigas conflitantes.
