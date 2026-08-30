# 02 — Regras Inegociáveis

1. O NOVEX nunca executa saída de dinheiro.
2. O NOVEX pode gerar QR/Pix para o usuário pagar, mas a confirmação ocorre fora do sistema.
3. O NOVEX pode gerar cobranças Pix de recebimento e enviá-las ao devedor.
4. Uma conta só pode ser baixada automaticamente quando existir evidência real suficiente do pagamento.
5. “Gerar QR”, “abrir modal”, “clicar em paguei” ou “aguardar 1,5 s” nunca equivalem a pagamento.
6. Não usar mock, simulação ou fallback fictício em fluxo produtivo financeiro.
7. Saldo inicial manual é permitido somente na conta geral manual, com data, origem e trilha de auditoria; nunca pode ser usado para fazer a conta Mercado Pago “bater”.
8. Uma transação não identificada continua alterando o ledger/saldo se a fonte oficial comprovar o impacto financeiro.
9. Identificação/categoria e impacto financeiro são problemas separados.
10. O sistema deve atualizar a UI sem exigir F5.
11. O sistema deve ser flexível e aprender padrões; não deve depender de igualdade rígida de nome/valor para tudo.
12. Aprendizado automático precisa ser auditável e reversível.
13. Pagamento duplicado não é aplicado silenciosamente a outra dívida.
14. Divergência não vira pagamento parcial automaticamente.
15. A LLM, se usada, é auxiliar; nunca é fonte da verdade financeira.
16. Credenciais e segredos nunca vão para frontend, Git, logs ou screenshots.
17. Alteração de banco deve usar migrations reproduzíveis e auditáveis.
18. O agente não pode declarar concluído sem evidência.
19. Não fazer deploy sem autorização explícita.
20. A estética deve seguir a identidade NOVEX e a documentação visual.
21. Movimentação líquida de um período nunca pode ser rotulada ou apresentada como saldo atual.
22. Saldo oficial do Mercado Pago exige âncora oficial validada e horário de referência; sem isso, mostrar estado indisponível/em reconciliação.
23. Total consolidado só pode ser exibido quando todos os saldos que o compõem estiverem comprovados.
24. Registros em quarentena não afetam saldo, totais ou relatórios, mas continuam auditáveis.
25. Alterações de fatos manuais contabilizados usam reversão e substituição; o Ledger não é reescrito silenciosamente.
