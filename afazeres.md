# Pendências Ativas do NOVEX Finance (Sistema Atual: Correções & Bugs)

> **PROPÓSITO DESTE ARQUIVO (BACKLOG OPERACIONAL):**
> Este arquivo contém **exclusivamente pendências imediatas, correções de bugs e estabilizações operacionais do sistema atual**.
> Correções já implantadas, tarefas canceladas e relatórios históricos não permanecem neste backlog.
>
> **Diferença importante para não confundir:**
> - [`afazeres.md`](afazeres.md) (este arquivo) ➔ **Sistema Atual:** Correções de bugs, falhas operacionais ativas, estabilizações críticas e manutenção imediata.
> - [`PROXIMAS_ATUALIZACOES.md`](PROXIMAS_ATUALIZACOES.md) ➔ **Sistema Futuro:** Novas funcionalidades, melhorias de interface (UX/UI), novas integrações e updates planejados para janelas de evolução técnica.

> **Atenção — trabalhos sensíveis adiados:** as pendências que envolvem produção, banco, configuração de ambiente, deploy, integrações reais ou chaves de API não devem ser executadas com pressa. Elas ficam deliberadamente reservadas para um período com tempo suficiente para backup, teste controlado, acompanhamento do servidor e rollback. Nenhuma delas autoriza alteração em produção sem pedido expresso do dono do produto.

---

## 📌 Status Atual do Sistema (Base Consolidada em Produção)
- **Infraestrutura em Produção:** Stack `novexfinance-prod` ativa e saudável no servidor Linux (`192.168.4.12`), acessível via túnel Cloudflare em `https://finance.novexbr.com.br` com healthcheck `{"status":"ok"}`.
- **Autenticação:** Sessão JWT via cookies com isolamento multi-tenant por workspace.
- **Dashboard:** Grid executivo limpo com 4 cards (Saldo Mercado Pago Oficial, Entradas, Saídas e Resultado Líquido).
- **Cobrança Pix em 2 Etapas (WhatsApp):** O bot da Evolution API dispara cobranças em 2 mensagens consecutivas (1ª: texto explicativo formatado; 2ª: chave Pix Copia e Cola isolada para cópia com 1 toque no celular).
- **QR Code Visual Nativo:** Modal de cobrança Pix (`ReceivablePixChargeModal.tsx`) renderiza QR Code dinâmico via `QRCodeSVG`.
- **Card WhatsApp Compacto:** Configurações exibe resumo minimizado quando conectado, com verificação de integridade e teste de envio rápido.
- **Contas a Receber:** Abas separadas ("A Receber", "Recebidas", "Todas") com filtro de saldo restante para evitar misturar contas quitadas nos pendentes.
- **Caixa em Espécie (Carteira física):** Saldo ajustado no banco de produção para exatamente **R$ 120,00** via ledger auditável.
- **Saúde do Código:** 165 testes unitários passando (100% de sucesso), typecheck TypeScript sem erros.
- **Regra Financeira Máxima:** Nenhuma funcionalidade executa saída de dinheiro (proibição absoluta de envio de Pix, pagamento de boletos ou saques automáticos).

---

## 📋 Lista de Afazeres Detalhada (Sistema Atual)

---

### Tarefa 1: Homologação Visual Externa do Saldo Oficial do Mercado Pago

* **O que fazer:**
  1. Abrir o aplicativo ou painel web do Mercado Pago na conta real vinculada.
  2. Consultar o extrato/saldo no corte exato de **31/08/2026 às 23:59:59 (BRT)**.
  3. Confrontar visualmente se o saldo disponível no Mercado Pago nesse horário era exatamente **R$ 137,66**.
* **Por que fazer:**
  * O NOVEX gerou e processou o Relatório de Liberações oficial (task `888929868`, arquivo oficial `64840669`) que extraiu a âncora oficial `BALANCE_AMOUNT` de R$ 137,66.
  * O Dinheiro em Conta cobriu até 01/09/2026 sem movimentações posteriores ao corte.
  * Precisamos da confirmação humana de que a âncora capturada pela API bate 1:1 com o extrato visual do aplicativo do banco.
* **Para que serve (Impacto no MVP):**
  * Cumprir o princípio da Verdade Financeira: o sistema nunca deve inventar ou estimar saldo. Com essa conferência visual, o saldo passa de `EM_HOMOLOGACAO` para `HOMOLOGADO`, dando 100% de segurança de que o valor exibido no painel representa o dinheiro real na conta.
* **Critérios de Aceite:**
  * [ ] Valor de R$ 137,66 confirmado no extrato do Mercado Pago no corte de 31/08/2026 23:59:59 BRT.
  * [ ] Atualizar status de `ERR-059` e `ERR-060` no [docs/ERROR_LOG.md](docs/ERROR_LOG.md) para `RESOLVIDO`.

---

### Tarefa 2: Homologação da Cobrança Pix via Orders API de Ponta a Ponta

* **O que fazer:**
  1. No painel NOVEX, em "Contas a Receber" ou gerador de cobrança Pix, criar uma cobrança Pix real de teste no valor de R$ 1,00 a R$ 5,00 via Orders API (`POST /v1/orders`).
  2. Conferir na tela a renderização correta do QR Code dinâmico e da chave copia-e-cola (EMV / BR Code).
  3. Efetuar o pagamento real desse Pix utilizando um aplicativo bancário qualquer.
  4. Verificar o recebimento do Webhook do Mercado Pago no endpoint `/api/webhooks/mercado-pago`:
     * Validar assinatura criptográfica oficial (`x-signature`);
     * Extrair `data.id` e consultar `GET /v1/orders/{id}` de forma autenticada;
     * Confirmar que o status retornado seja `processed` com `status_detail: accredited`.
  5. Confirmar que a função atômica `settlePixChargeAtomic` dê baixa automática na parcela (`Installment.status = SETTLED`), preenchendo a data de liquidação e o comprovante.
  6. Confirmar que o Ledger registre um único lançamento de crédito e que o próximo ciclo do Relatório de Extrato não duplique a entrada.
* **Por que fazer:**
  * O código da Orders API, idempotência por `X-Idempotency-Key`, webhook seguro e proteção contra pagamentos divergentes já foram implementados e cobertos por testes unitários, mas a liquidação real de ponta a ponta precisa ser homologada em ambiente real antes de ir para o ar.
* **Para que serve (Impacto no MVP):**
  * Permitir que o NOVEX emita cobranças reais para clientes/devedores e dê baixa automática no fluxo financeiro assim que o cliente pagar, sem necessidade de conciliação manual.
* **Critérios de Aceite:**
  * [ ] Cobrança Pix gerada com sucesso via Orders API com dados do pagador.
  * [ ] Pagamento efetuado via app bancário.
  * [ ] Webhook recebido com HTTP 200 e validado sem erros nos logs.
  * [ ] Parcela alterada para status `SETTLED` automaticamente no painel.
  * [ ] Ledger sem lançamentos duplicados.

---

### Tarefa 3: Auditoria do Ciclo Autônomo em Segundo Plano (Worker Daemon)

* **O que fazer:**
  1. Monitorar os logs do container `novexfinance-prod-worker` durante múltiplos ciclos intradiários.
  2. Confirmar que o worker:
     * Retome `SyncRuns` pendentes caso ocorra reinicialização;
     * Respeite a cadência de backoff progressivo quando o Mercado Pago estiver sem relatórios novos;
     * Avalie as regras de notificação sem travar ou consumir memória excessiva;
     * Não crie tarefas duplicadas no Mercado Pago enquanto houver tarefas em `processing`.
* **Por que fazer:**
  * O worker é o motor que mantém o sistema vivo em segundo plano. Ele não pode vazar memória, nem disparar chamadas excessivas que levem a bloqueios de rate limit (429) no Mercado Pago ou na Evolution.
* **Para que serve (Impacto no MVP):**
  * Assegurar que o sistema funcione de forma 100% autônoma no servidor sem intervenção técnica constante.
* **Critérios de Aceite:**
  * [ ] Logs do worker limpos, registrando ciclos com sucesso e sem requisições HTTP duplicadas.
  * [ ] Backoff progressivo confirmado em caso de ausência de novos dados.

---

### Tarefa 4: Enriquecimento Contínuo de Nomes de Fornecedores e Contrapartes Reais

* **O que fazer:**
  1. Concluir o preenchimento automático das contrapartes reais das movimentações históricas e recentes, garantindo que o banco de dados armazene o nome da empresa ou pessoa (`counterpart_name`) e não códigos técnicos como `Ref: QR...`, `Ref: RESN...` ou `Ref: CIELO...`.
  2. Consolidar os nomes comprovados pelo extrato do Mercado Pago:
     * `176977551400` (-R$ 2,00): **Facebook Servicos Online Do Brasil Ltda**
     * `175963571301` (-R$ 12,52): **Facebook Servicos Online Do Brasil Ltda**
     * `176866825828` (+R$ 75,00): **Jovani Rosa Dos Santos** (Origem: Itaú Unibanco S.A.)
     * `175901588737` (-R$ 22,00): **Drogaria Jaranapolis Ltda**
     * `176855934846` (-R$ 22,00): **Santos E Peixoto Supermercado Ltda**
     * `175714580829` (-R$ 9,99): **Google Brasil Pagamentos Ltda.**
     * `176652347016` (-R$ 20,03): **Posto Pelicano 10 Ltda**
     * `176650847124` (-R$ 48,00): **N J De Oliveira Ltda**
     * `175551646863` (-R$ 13,00): **Barao Acessorios Ltda**
  3. Fortalecer o motor de memória viva (`CounterpartRule` / `applyCounterpartMemoryToTransactions`) para que cada novo lançamento capturado pelo `worker-daemon` seja identificado automaticamente sem intervenção manual.
* **Por que fazer:**
  * A API de relatórios do Mercado Pago (`Settlement Report`) omite o nome do favorecido em débitos Pix (`PAYOUTS`) e omite o nome do pagador pessoa física em créditos Pix, fornecendo apenas códigos de referência de transação ou a instituição financeira intermediária.
* **Para que serve (Impacto no MVP):**
  * Entrega usabilidade e clareza bancária imediata: o extrato do NOVEX espelha 1:1 o aplicativo do Mercado Pago, permitindo conciliação, categorização e DRE precisos sem retrabalho do usuário.
* **Critérios de Aceite:**
  * [ ] Nenhuma movimentação de fornecedor conhecido exibe código técnico genérico (`QR...`, `RESN...`).
  * [ ] Transações de saída comprovadas vinculadas aos fornecedores catalogados.
  * [ ] Pix recebido de R$ 75,00 exibindo `Jovani Rosa Dos Santos` como pagador principal e `Origem: Itaú Unibanco S.A.` no subtítulo.
  * [ ] Tabela `counterpart_rules` com as regras ativas de memória para o workspace do usuário.
