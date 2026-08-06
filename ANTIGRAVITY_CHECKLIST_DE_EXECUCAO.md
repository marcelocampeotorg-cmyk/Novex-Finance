# Checklist de execução do Antigravity

## Antes de codar

- [ ] Confirmar nova pasta vazia.
- [ ] Confirmar que o ERPNext não será alterado.
- [ ] Copiar este pacote para `docs/blueprint/` do novo repositório.
- [ ] Ler todos os documentos na ordem.
- [ ] Inspecionar os assets oficiais e as telas.
- [ ] Registrar dúvidas técnicas como hipóteses, sem inventar respostas.

## Marco 0

- [ ] Inicializar Git.
- [ ] Criar branch `feat/foundation`.
- [ ] Criar aplicação Next.js/TypeScript.
- [ ] Configurar lint, typecheck e testes.
- [ ] Criar Docker web, worker, postgres e redis.
- [ ] Criar `.env.example` sem segredos.
- [ ] Criar healthchecks.
- [ ] Iniciar preview.
- [ ] Informar `http://localhost:3000`.

## Marco 1

- [ ] Criar tokens NOVEXBR.
- [ ] Implementar layout.
- [ ] Implementar dashboard.
- [ ] Contas a pagar.
- [ ] Contas a receber/devedores.
- [ ] Movimentações.
- [ ] Nova conta.
- [ ] Lembretes/recorrências.
- [ ] Estados de sync/conciliação.
- [ ] Responsividade.
- [ ] Capturas e validação.

## Antes de entregar

- [ ] `lint` passa.
- [ ] `typecheck` passa.
- [ ] testes passam.
- [ ] build passa.
- [ ] Docker build passa.
- [ ] nenhuma credencial versionada.
- [ ] preview acessível.
- [ ] relatório objetivo.
- [ ] aguardar aprovação.
