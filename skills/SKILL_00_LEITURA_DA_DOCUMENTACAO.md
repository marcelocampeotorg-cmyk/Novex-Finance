# SKILL 00 — Leitura da Documentação

## Objetivo
Impedir que o agente comece a codar por associação ou memória incompleta.

## Sempre
1. Ler `docs/21_DECISOES_CONFIRMADAS.md`.
2. Ler `docs/02_REGRAS_INEGOCIAVEIS.md`.
3. Identificar a área afetada.
4. Ler o documento funcional correspondente.
5. Se a área já existe no código, ler `docs/20_AUDITORIA_ESTADO_ATUAL.md`.
6. Inspecionar o código real.
7. Só então propor/executar.

## Regra de conflito
Se código e documentação discordam, não “corrigir” a documentação para combinar com o código. Tratar como possível desvio e comparar evidências.

## Saída esperada do agente
Antes de uma mudança grande, conseguir resumir:
- requisito;
- estado real;
- diferença;
- risco;
- critério de aceite.
