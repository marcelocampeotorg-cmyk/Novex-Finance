# NOVEX FINANCE — Lista de Tarefas a Fazer (Rumo ao MVP e Deploy no Servidor)

> **Documento de Controle e Retomada:** Criado em 2026-09-01.
> **Objetivo:** Registrar com riqueza de detalhes todas as pendências que faltam para o sistema estar 100% funcional, homologado e pronto para produção no servidor, especificando o **o que fazer**, o **porquê fazer**, o **para que serve (impacto)** e os **critérios de aceite**.

---

## 📌 Status Atual do Sistema (Base Consolidada)
- **Autenticação:** fluxo de API local validado na fotografia de 01/09; login visual e origem precisam ser revalidados no endereço final do servidor. Credenciais não são documentadas aqui.
- **Dashboard:** Grid executivo limpo com 4 cards (Saldo Mercado Pago Oficial, Entradas, Saídas e Resultado Líquido). Cards manuais removidos da tela principal.
- **Extrato & Movimentações:** Camada de apresentação humanizada ativa (`formatTransactionDisplay`). Rótulos técnicos como `PAYOUTS` e `SETTLEMENT` agora são exibidos como descrições bancárias claras. Filtros com "Mês Anterior" e "Últimos 30 dias" funcionando.
- **Saúde do Código:** 122 testes (119 aprovados e 3 isolados sem banco de teste; 122/122 em PostgreSQL descartável), Typecheck e Linter sem erros.
- **Ambiente:** stack local saudável; no servidor existe a pasta vazia `/home/servidor/Área de trabalho/Sistemas/novex finance`, ainda sem stack Finance implantada.
- **Regra Financeira Máxima:** Nenhuma funcionalidade executa saída de dinheiro (proibição absoluta de envio de Pix, pagamento de boletos ou saques automáticos).

---

## 📋 Lista de Afazeres Detalhada

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

### Tarefa 3: Pareamento e Ativação do Bot de Cobrança WhatsApp (Evolution API)

* **O que fazer:**
  1. Acessar a Evolution API local (`novexfinance-evolution` na porta `8081`).
  2. Obter o QR Code da instância `novex-finance` e escanear com o celular no WhatsApp que fará os disparos.
  3. Verificar no painel/API se a conexão assumiu o estado `open`.
  4. Configurar ou validar a regra de notificação para incluir o canal `WHATSAPP` (atualmente está configurada para `DASHBOARD`).
  5. Cadastrar um compromisso de teste a vencer com contato contendo número de WhatsApp real (no formato com DDI e DDD: `55 + DDD + Número`).
  6. Disparar ou aguardar o tick do `WorkerDaemon` e verificar o envio da mensagem formatada com saudação, valor, data de vencimento e link/Pix copia-e-cola.
  7. Inspecionar a tabela `WhatsAppDeliveryLog`:
     * Verificar que o status seja atualizado para `SENT`;
     * Verificar que `sentAt` seja preenchido com a data/hora exata do envio;
     * Verificar que o `messageId` retornado pela Evolution esteja gravado;
     * Testar a idempotência: reexecutar o worker e confirmar que nenhuma mensagem repetida seja disparada para a mesma parcela no mesmo ciclo de cobrança.
* **Por que fazer:**
  * Requisito prioritário estabelecido pelo usuário: *"Tem que funcionar o WhatsApp, porque ele vai ser meio que um bot para fazer a cobrança do pessoal quando tiver chegando a data de vencimento."*
* **Para que serve (Impacto no MVP):**
  * Cobrar clientes e devedores de forma totalmente automática dias antes do vencimento e no dia do vencimento, enviando o Pix pronto para pagamento e reduzindo o esforço de cobrança manual a zero.
* **Critérios de Aceite:**
  * [ ] WhatsApp conectado com status `open`.
  * [ ] Mensagem de cobrança entregue com sucesso no celular de teste.
  * [ ] Mensagem contendo texto claro, valor e código Pix.
  * [ ] `WhatsAppDeliveryLog` registrando a entrega de forma auditável e idempotente.

---

### Tarefa 4: Auditoria do Ciclo Autônomo em Segundo Plano (Worker Daemon)

* **O que fazer:**
  1. Manter o worker em execução e monitorar os logs do container `novexfinance-worker` durante múltiplos ciclos.
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

### Tarefa 5: Deploy independente no servidor Linux

* **O que fazer:**
  1. Revisar e versionar `docker-compose.prod.yml`, `.env.production.example`, scripts de backup/deploy e proxy.
  2. Usar project name, redes, volumes e containers exclusivos `novexfinance-prod`; não referenciar nenhum recurso de Master ou Oficina/Options.
  3. Manter PostgreSQL e Redis somente na rede interna; app e Evolution somente no loopback do host para proxy/diagnóstico.
  4. Decidir e executar a migração do banco local real e da sessão Evolution, preservando a chave de criptografia; nunca iniciar a mesma sessão WhatsApp simultaneamente em dois hosts.
  5. Configurar origem final de autenticação, DNS/HTTPS e webhook no domínio `www.app.novexfinance.com.br`.
  6. Aplicar migrations, subir a stack, provar health, login, worker, backup, saldo/extrato e Evolution no servidor.
* **Por que fazer:**
  * O Compose antigo de produção era incompleto e genérico. O host já executa Master e Oficina; qualquer nome, porta, rede ou volume compartilhado pode causar indisponibilidade cruzada ou perda de dados.
* **Para que serve (Impacto no MVP):**
  * Colocar o Finance no servidor com ciclo de vida autônomo: apagar ou recriar o Finance não interrompe nem altera os outros sistemas.
* **Critérios de Aceite:**
  * [x] Diretório remoto exclusivo localizado e confirmado vazio antes do deploy.
  * [x] Portas, Compose projects, redes e volumes existentes auditados sem alterações.
  * [x] Compose exclusivo, migrator, worker, Evolution, backup e bind em loopback preparados no código.
  * [x] Migração dos dados, credenciais e sessão reais definida para preservar a operação atual; dumps restaurados em banco descartável.
  * [x] `docker compose config` validado com sucesso no servidor.
  * [x] Build das imagens Docker `migrate`, `app` e `worker` concluído no servidor sem erros.
  * [x] Teardown dos serviços locais conflitantes (`app`, `worker`, `evolution`) executado para liberar sessão única no servidor.
  * [ ] Executar `prisma migrate deploy` e subir stack completa (`app`, `worker`, `evolution`, `backup`) no servidor.
  * [ ] Stack `novexfinance-prod` saudável no loopback (`127.0.0.1:3001/api/health`) sem mudança nos containers vizinhos.
  * [x] Restore dos bancos principal e Evolution validado em PostgreSQL descartável.
  * [ ] Delegação de nameservers na Hostinger concluída e DNS de `www.app.novexfinance.com.br` propagado via Cloudflare Tunnel.
  * [ ] Login funcionando pela origem final sem `INVALID_ORIGIN`.
  * [ ] Mercado Pago e Evolution novamente comprovados no runtime do servidor.

---

## 🔄 Fluxo de Retomada e Estado Atual

### Tarefa 6: Inteligência de gastos, categorização explicável e painel executivo

* **O que fazer:**
  1. Concluir a normalização determinística de fornecedores e produtos, preservando a descrição original do provedor.
  2. Exibir fornecedor, produto, categoria sugerida, origem da regra e confiança em Movimentações.
  3. Criar gestão de regras visíveis, editáveis, desativáveis e reversíveis, incluindo recategorização em lote com prévia dos itens afetados.
  4. Separar identificação, categorização e conciliação; fornecedor isolado nunca confirma baixa.
  5. Implementar indicadores de gastos por categoria, fornecedor, recorrência e período, além de uma fila única de itens que precisam de atenção.
  6. Acrescentar orçamento, projeção, estornos líquidos, duplicidades e anomalias somente depois de comprovada a qualidade dos dados-base.
* **Por que fazer:**
  * As descrições do provedor variam e um mesmo grupo, como Google, representa produtos com finalidades diferentes. A correspondência genérica reduz a qualidade do painel e pode propagar uma correção indevida pelo histórico.
* **Para que serve (Impacto no MVP):**
  * Responder com clareza quanto foi gasto, com quem, em qual finalidade e o que ainda precisa de decisão, sem alterar o fato financeiro ou produzir falsa conciliação.
* **Critérios de Aceite:**
  * [x] Google Ads, Google Cloud, Google Workspace, Google One, YouTube Premium e Meta Ads possuem identificação determinística testada.
  * [x] Regra textual não coincide dentro de outra palavra e o usuário escolhe o alcance temporal do aprendizado.
  * [x] Tela mostra a justificativa e a confiança de cada categorização automática.
  * [ ] Gestão permite editar, desativar, desfazer e visualizar os lançamentos afetados por uma regra.
  * [ ] Conciliação ambígua permanece como sugestão e nunca baixa conta apenas pelo fornecedor.
  * [ ] Dashboard mostra gastos por categoria e fornecedor, comparação temporal, recorrências e pendências sem converter erros em zero.
  * [ ] Estornos, transferências internas e itens não classificados não inflam artificialmente o total de despesas.
  * [ ] Testes unitários, integração com PostgreSQL descartável, lint, typecheck, build, QA desktop/mobile e `git diff --check` aprovados.


### Tarefa 7: Enriquecimento Contínuo de Nomes de Fornecedores e Contrapartes Reais (Igual ao Extrato do Mercado Pago)

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
  3. Fortalecer o motor de memória viva (`CounterpartRule` / `applyCounterpartMemoryToTransactions`) para que cada novo lançamento capturado pelo `worker-daemon` a cada 15 segundos seja identificado automaticamente sem intervenção manual.
  4. Avaliar rota complementar ou ingestor contínuo de extrato para novas contrapartes não catalogadas pela API de relatórios do Mercado Pago.
* **Por que fazer:**
  * A API de relatórios públicos do Mercado Pago (`Settlement Report`) omite o nome do favorecido em débitos Pix (`PAYOUTS`) e omite o nome do pagador pessoa física em créditos Pix, fornecendo apenas códigos de referência de transação ou a instituição financeira intermediária.
  * No aplicativo e portal web do Mercado Pago, esses nomes constam oficialmente. Para que o empresário saiba exatamente de onde veio ou saiu o dinheiro sem ter que ficar inserindo manualmente no dia a dia, o sistema precisa cruzar e memorizar essas entidades no piloto automático.
* **Para que serve (Impacto no MVP):**
  * Entrega usabilidade e clareza bancária imediata: o extrato do NOVEX espelha 1:1 o aplicativo do Mercado Pago, permitindo conciliação, categorização e DRE precisos sem retrabalho do usuário.
* **Critérios de Aceite:**
  * [ ] Nenhuma movimentação de fornecedor conhecido exibe código técnico genérico (`QR...`, `RESN...`).
  * [ ] Transações de saída comprovadas vinculadas a `Facebook`, `Drogaria Jaranapolis`, `Santos E Peixoto`, `Google`, `Posto Pelicano`, `N J de Oliveira` e `Barão Acessórios`.
  * [ ] Pix recebido de R$ 75,00 exibindo `Jovani Rosa Dos Santos` como pagador principal e `Origem: Itaú Unibanco S.A.` no subtítulo.
  * [ ] Tabela `counterpart_rules` com as regras ativas de memória para o workspace do usuário.
  * [ ] `WorkerDaemon` executando o enriquecimento por memória viva a cada ciclo intradiário.
  * [ ] 100% de aprovação na suíte de testes unitários e de apresentação.

---

### Ponto consolidado — 2026-09-03 17:30 BRT

- **Infraestrutura em Produção:** Stack `novexfinance-prod` ativa e saudável no servidor (`192.168.4.12`), acessível via túnel Cloudflare em `https://finance.novexbr.com.br` com healthcheck `{"status":"ok"}`.
- **Apresentação Bancária Estilo App:** Eliminados títulos genéricos (`Transferência ou retirada registrada`, `Entrada na conta MP`). Lançamentos de centavos mapeados como `Rendimento do saldo` e `Imposto sobre rendimento`. Pix recebido com identificação limpa de banco emissor.
- **Memória de Fornecedores:** Modelo e tabela `counterpart_rules` criados e migrados no PostgreSQL de produção. Loop de aprendizado integrado ao `worker-daemon`.
- **Pendência Registrada:** Tarefa 7 anotada para conclusão do mapeamento contínuo de contrapartes.
