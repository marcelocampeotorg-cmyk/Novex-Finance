---
name: gestao-lista-afazeres
description: Regras e padrão obrigatório para registrar, detalhar e auditar pendências e tarefas a fazer na lista de afazeres do projeto. Usar sempre que for pausar uma sessão, registrar pendências técnicas, planejar etapas de um MVP ou documentar afazeres detalhados com o que fazer, por que fazer, para que serve (impacto) e critérios de aceite.
---

# Gestão da Lista de Afazeres

Documento oficial: `tarefas a fazer.md` (espelho em `docs/TAREFAS_A_FAZER.md`).

## Quando usar
- Ao pausar qualquer sessão de desenvolvimento ou auditoria;
- Ao identificar pendências técnicas que não puderem ser resolvidas no mesmo ciclo;
- Ao planejar marcos do MVP ou subida para produção/servidor;
- Antes de iniciar o trabalho em uma nova sessão, para leitura do estado e da ordem de execução.

## Estrutura Obrigatória de Cada Tarefa
Nenhuma tarefa pode ser anotada de forma rasa ou vaga (ex.: "arrumar webhook", "verificar tela"). Cada item deve conter obrigatoriamente:

1. **O que fazer:** Ação técnica cirúrgica, arquivos, rotas, telas, tabelas ou endpoints envolvidos e os passos práticos para execução.
2. **Por que fazer:** A justificativa técnica baseada em evidências, a causa raiz identificada ou a deficiência do estado atual que torna o trabalho indispensável.
3. **Para que serve (Impacto no MVP):** O valor funcional entregue ao usuário, a proteção financeira/operacional garantida e o risco caso o item não seja implementado.
4. **Critérios de Aceite:** Checklist verificável com testes automatizados, consultas de banco, requisições HTTP ou validações visuais humanas que comprovem a conclusão sem presunções.

## Regras de Conduta
- **Riqueza de Detalhes:** Descrever cenários de teste, payloads esperados e casos de borda conhecidos.
- **Verdade Financeira:** Nunca presumir que uma tarefa de integração está concluída sem evidência externa oficial (Relatório Liberações, Orders API, status `open` da Evolution).
- **Sem Afazeres Fantasmas:** Somente registrar tarefas autorizadas pela documentação canônica e pelas orientações expressas do usuário.
- **Ciclo de Fechamento:** Ao concluir uma tarefa, registrar a evidência correspondente, o commit/teste e atualizar o checklist para `[x]`.
