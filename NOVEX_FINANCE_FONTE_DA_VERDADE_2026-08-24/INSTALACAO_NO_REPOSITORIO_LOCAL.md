# Como colocar este pacote no repositório local

## Objetivo
Evitar conflito entre documentação/skills antigas e esta nova fonte de verdade.

## Procedimento seguro
1. Antes de copiar, faça um commit local ou cópia de segurança do repositório.
2. Extraia o ZIP.
3. Copie `AGENTS.md` para a raiz do repositório.
4. Copie `docs/` para a documentação ativa do projeto.
5. **Substitua a coleção de skills antiga pela pasta `skills/` deste pacote.** Não faça merge cego das duas coleções.
6. Copie `assets/brand/` sem sobrescrever os assets oficiais originais existentes; use as imagens deste pacote como referência de identidade.
7. Copie `templates/`.
8. Se houver documentação antiga com decisões incompatíveis, mova-a para uma pasta histórica/legado claramente marcada como não normativa.
9. Não altere código só para “acomodar” a documentação antes de uma auditoria do estado atual.

## Verificação
Ao abrir o projeto com o Antigravity, a primeira instrução deve ser apenas:
“Leia integralmente `AGENTS.md`, a documentação indicada por ele e as skills aplicáveis antes de propor ou executar qualquer mudança.”

A documentação já contém a auditoria conhecida do estado atual e os critérios para organizar a correção.
