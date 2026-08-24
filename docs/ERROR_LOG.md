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
Status: ABERTO  
Base: commit 5128674  
Resumo: GitHub continha somente migration_lock, apesar de histórico local aparentar migrations aplicadas.  
Risco: bloqueador de deploy.

### ERR-002 — Refund fora do escopo
Status: ABERTO  
Resumo: fluxo de “Devolver Pix” contradiz a regra de não movimentar saída.

### ERR-007 — Exposição de credenciais em Server Action getActiveMercadoPagoIntegration
Status: RESOLVIDO  
Resumo: `getActiveMercadoPagoIntegration` retornava `IntegrationAccount` do Prisma completa (com segredos) e aceitava workspaceId sem validação de sessão.  
Correção: Adicionada validação de contexto com `requireAuthenticatedWorkspace` e retorno sanitizado utilizando o DTO `IntegrationAccountDTO`.

### ERR-008 — Duplicidade da Fonte da Verdade e localização de Skills
Status: RESOLVIDO  
Resumo: As novas skills e documentos permaneciam em uma subpasta duplicada (`NOVEX_FINANCE_FONTE_DA_VERDADE_2026-08-24`), violando a regra de Fonte da Verdade única na raiz.  
Correção: A estrutura completa de `skills/` (18 arquivos), `docs/` (25 arquivos), `templates/` e `assets/` foi centralizada exclusivamente na raiz do repositório e a subpasta duplicada foi permanentemente removida.

### ERR-003 — Simulação de pagamento em conta a pagar
Status: ABERTO  
Resumo: PaymentDialog simula reconhecimento por timeout.

### ERR-004 — Account Money ainda não implementado corretamente
Status: ABERTO  
Resumo: payments/search usado como extrato.

### ERR-005 — Saldo/manual e source separation
Status: ABERTO  
Resumo: fluxos de saldo manual, CSV e provider/source apresentam inconsistências.

### ERR-006 — Mocks de runtime
Status: ABERTO  
Resumo: attachments/lixeira/export/Pix demonstrativo precisam ser removidos ou desativados de forma honesta.

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
