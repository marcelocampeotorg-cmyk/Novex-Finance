# 21 — Decisões Confirmadas

Este é o documento de maior precedência.

1. Produto: NOVEX Finance / NOVEX.
2. Domínio alvo: `finance.novexbr.com.br` (subdomínio exclusivo da zona `novexbr.com.br`).
3. Uso atual: uma única pessoa. Não projetar telas ou permissões multiusuário como requisito.
4. Interface: desktop e mobile; site instalável como PWA.
5. Paleta: identidade NOVEX/NOVEXBR fornecida pelo usuário.
6. Estética: premium, limpa, moderna, dark-first.
7. Gráficos: dados reais; linhas/áreas/ondas; sem candlestick.
8. UI atualiza sem F5.
9. Mercado Pago é integração financeira principal da V1.
10. Existem somente dois modos oficiais: **Manual** e **Híbrido**.
11. No modo Manual existe uma única conta geral, com saldo inicial datado e lançamentos manuais auditáveis. No modo Híbrido essa conta continua existindo separadamente da conta Mercado Pago.
12. A conta Mercado Pago nunca aceita ajuste ou sobrescrita manual.
13. Movimentação líquida isolada não é saldo atual. A âncora Mercado Pago vem do `BALANCE_AMOUNT` do Relatório de Liberações; atualização após o corte só usa cobertura contínua do Dinheiro em Conta. Sem essa cadeia, exibir o último corte ou reconciliação.
14. Como o relatório é assíncrono, a interface deve dizer “Saldo disponível em <horário do corte>” e nunca “tempo real” ou “agora” sem qualificação.
15. Movimentação não reconhecida ainda entra no ledger e afeta saldo, desde que oriunda de fonte financeira autorizada (Account Money / Settlement Report).
16. O usuário não precisa cadastrar previamente toda empresa/instituição que gerar débito/crédito.
17. Sistema pode aprender recorrências, nomes e categorias.
18. Sistema pode criar/sugerir categorias; usuário também pode criar.
19. Regra aprendida pode ser editada/desfeita.
20. Conta a receber: NOVEX gera cobrança Pix específica.
21. Cobrança pode ser enviada por WhatsApp via Evolution API.
22. Preservar a cadência/forma de cobrança já existente/configurada; não inventar uma nova sem auditoria.
23. Pagamento confirmado de cobrança baixa automaticamente.
24. QR de cobrança tem valor definido; entrada de valor diferente não vira “parcial” automaticamente.
25. Suporte a pagamento parcial pode existir como exceção, mas precisa de evidência.
26. Pagamento duplicado gera alerta e aguarda decisão do usuário.
27. Conta a pagar: NOVEX gera QR/Pix Copia e Cola.
28. O usuário realiza e confirma o Pix no aplicativo externo.
29. NOVEX observa a saída e tenta conciliá-la.
30. NOVEX nunca envia dinheiro.
31. NOVEX nunca executa refund/estorno/devolução/payout/transferência.
32. Estorno ocorrido externamente pode ser detectado, importado e contabilizado.
33. Notificações para o proprietário: painel + push/PWA, não WhatsApp como requisito.
34. LLM é opcional e auxiliar, não fonte da verdade financeira.
35. O alvo operacional atual é o servidor Linux próprio, em stack Docker Compose exclusiva. Cloudflare pode fornecer DNS/túnel/edge futuramente, mas não é requisito para o processo da aplicação.
36. No modo Manual, o saldo exibido é saldo inicial + créditos − débitos da conta manual. No modo Híbrido, o total consolidado é conta manual + saldo oficial Mercado Pago e só aparece quando ambos estiverem comprovados.
37. Documentação e skills deste pacote substituem orientações antigas conflitantes.
38. A prioridade de aceite atual é o modo Híbrido para uso real do proprietário; ampliações do modo Manual ficam para fase posterior.
39. No Mercado Pago, `total` do Relatório Liberações não é saldo. A âncora é `BALANCE_AMOUNT`; atualização posterior exige cobertura contínua do Dinheiro em Conta.
40. O NOVEX Finance não compartilha banco, Redis, Evolution, volumes, redes Docker, nomes de projeto ou ciclo de vida com NOVEX Master, NOVEX Oficina/Options ou qualquer outro sistema no mesmo host.
41. Remover, recriar ou restaurar a stack `novexfinance-prod` deve afetar somente recursos prefixados por `novexfinance-prod`; nenhuma rotina de deploy pode usar `docker compose down` ou remoção de volumes fora desse projeto.
42. PostgreSQL, Redis e Evolution não são publicados na rede externa. A aplicação é vinculada ao loopback do host e recebe tráfego somente por proxy/túnel autorizado.
