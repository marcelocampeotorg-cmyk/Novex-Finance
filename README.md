# NOVEX Finance — Fonte da Verdade do Produto

**Versão:** 1.0  
**Data:** 24/08/2026  
**Objetivo:** substituir a documentação e as skills conflitantes do projeto por uma única fonte de verdade coerente.

Este pacote foi escrito para orientar a continuação do repositório existente **NOVEX Finance**, sem recriar o projeto do zero e sem permitir que uma IA de desenvolvimento invente escopo, fluxo financeiro, estética ou comportamento.

## Regra de precedência

Quando houver conflito, use esta ordem:

1. `docs/21_DECISOES_CONFIRMADAS.md`
2. `docs/02_REGRAS_INEGOCIAVEIS.md`
3. documentos funcionais específicos em `docs/`
4. `docs/20_AUDITORIA_ESTADO_ATUAL.md`
5. `.agents/skills/`
6. código existente
7. documentação antiga fora deste pacote

O código atual pode estar errado. Portanto, **o código não prevalece sobre as decisões confirmadas**.

## Instalação recomendada no repositório local

1. Faça um backup/commit do estado atual antes de substituir documentação.
2. Copie esta pasta para dentro do repositório local.
3. As skills operacionais do agente ficam exclusivamente em `.agents/skills/`. Não mantenha duas coleções de skills ativas.
4. Use os documentos deste pacote como `docs/` oficial. Documentos antigos conflitantes devem ser arquivados como históricos, não usados como fonte de verdade.
5. Preserve os assets oficiais já existentes no repositório; os dois arquivos em `assets/brand/` deste pacote são cópias fornecidas pelo usuário para conferência visual.
6. Faça o agente iniciar sempre por `AGENTS.md`.

## O que este pacote define

- visão definitiva do produto;
- limite absoluto entre observar dinheiro e movimentar dinheiro;
- contas a receber e cobrança Pix;
- contas a pagar com QR Code gerado pelo NOVEX e confirmação externa pelo usuário;
- Mercado Pago como fonte das movimentações reais;
- saldo automático e ledger;
- conciliação inteligente;
- reconhecimento de recorrências, instituições e categorias;
- cobrança via Evolution API;
- interface atualizada sem F5;
- PWA e notificações push;
- estética NOVEX premium;
- segurança, migrations, idempotência, testes e critérios de aceite;
- uso opcional de LLM como camada auxiliar, nunca como fonte da verdade financeira;
- auditoria das incongruências já detectadas no código atual;
- skills operacionais específicas para impedir desvio de escopo e “sucesso falso”.

## Resultado esperado

O NOVEX Finance deve funcionar como um gestor financeiro pessoal altamente automático. A pessoa cadastra apenas o que precisa planejar, cobrar ou controlar. Movimentações reais que já aconteceram devem nascer automaticamente da integração financeira sempre que os dados oficiais permitirem.
