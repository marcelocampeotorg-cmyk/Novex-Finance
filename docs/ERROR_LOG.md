# ERROR LOG — Registro Vivo de Erros e Riscos

Este arquivo deve ser atualizado pela skill `SKILL_02_REGISTRO_DE_ERROS.md`.

## Regras
- não apagar histórico resolvido;
- usar status `ABERTO`, `EM_CORRECAO`, `RESOLVIDO`, `NAO_REPRODUZIDO`, `ADIADO`;
- citar arquivo/rota/migration/commit;
- registrar evidência;
- diferenciar defeito real de hipótese.

## Erros conhecidos iniciais

### ERR-001 — Migrations não reproduzíveis
Status: RESOLVIDO  
Base: commit 5128674  
Resumo: GitHub continha somente migration_lock, apesar de histórico local aparentar migrations aplicadas.  
Correção: Adicionado `!prisma/migrations/**/*.sql` ao `.gitignore`, removido `schema.prisma.new` duplicado. `npx prisma validate` e `npx prisma migrate status` confirmados.

### ERR-002 — Refund fora do escopo
Status: RESOLVIDO  
Resumo: fluxo de “Devolver Pix” contradizia a regra de não movimentar saída.  
Correção: Removida a Server Action `refundPixCharge`, removido o botão "Devolver Pix" da modal e neutralizada a chamada `refundPayment` na camada de integração.

### ERR-003 — Simulação de pagamento em conta a pagar
Status: RESOLVIDO  
Resumo: PaymentDialog simulava reconhecimento por timeout.  
Correção: Removida a simulação e o botão "Simular Pagamento Efetuado" do `PaymentDialog.tsx`. A modal agora expressa corretamente uma intenção de pagamento que aguarda o webhook/evento financeiro real.

### ERR-004 — Account Money ainda não implementado corretamente
Status: EM_CORRECAO  
Resumo: payments/search usado como extrato.

### ERR-005 — Saldo/manual e source separation
Status: EM_CORRECAO  
Resumo: fluxos de saldo manual, CSV e provider/source apresentam inconsistências.

### ERR-006 — Mocks de runtime
Status: EM_CORRECAO  
Resumo: attachments/lixeira/export/Pix demonstrativo precisam ser removidos ou desativados de forma honesta.

### ERR-007 — Exposição de credenciais em Server Action getActiveMercadoPagoIntegration
Status: RESOLVIDO  
Resumo: `getActiveMercadoPagoIntegration` retornava `IntegrationAccount` do Prisma completa (com segredos) e aceitava workspaceId sem validação de sessão.  
Correção: Adicionada validação de contexto com `requireAuthenticatedWorkspace` e retorno sanitizado utilizando o DTO `IntegrationAccountDTO`.

---

## Template
ID:  
Data:  
Status:  
Severidade:  
Área:  
Descoberto por:  
Descrição:  
Evidência:  
Impacto:  
Hipótese de causa:  
Correção aplicada:  
Teste de regressão:  
Commit:  
Observações:
