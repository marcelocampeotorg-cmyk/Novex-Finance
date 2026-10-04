# 03 — Arquitetura Funcional de Ponta a Ponta

## Fluxo A — Conta a receber
Cadastro de devedor + telefone + valor + vencimento + parcelas + regras de cobrança.
→ NOVEX cria cobrança Pix identificável.
→ NOVEX envia a cobrança via Evolution API conforme a cadência já configurada no sistema.
→ Mercado Pago confirma pagamento real.
→ NOVEX valida identidade/status/valor/idempotência.
→ baixa a parcela.
→ Account Money importa posteriormente o impacto real e cria o crédito correspondente no ledger, sem duplicar o efeito da Order.
→ atualiza dashboard e notificações sem F5.

## Fluxo B — Conta a pagar
Cadastro de favorecido + chave Pix + valor + vencimento.
→ NOVEX gera BR Code/Pix Copia e Cola e QR Code no desktop.
→ usuário escaneia no celular e confirma o pagamento no Mercado Pago/banco.
→ NOVEX não muda o status só porque o QR foi gerado.
→ integração detecta a saída real.
→ motor tenta conciliar com a intenção de pagamento/conta.
→ em correspondência forte, baixa automaticamente.
→ em ambiguidade, solicita decisão.

## Fluxo C — Movimentação não planejada
Mercado Pago registra entrada/saída que não corresponde a item planejado.
→ NOVEX importa mesmo assim.
→ ledger recebe o impacto financeiro.
→ identificação/categoria ocorre separadamente.
→ sistema cria registro de movimentação.
→ se conseguir reconhecer instituição/estabelecimento/categoria com segurança, classifica.
→ se não, mostra “não identificada” ou sugestão.

## Fluxo D — Débito automático
Não é obrigatório pré-cadastrar Claro, Mercado Livre, assinatura etc.
→ fonte financeira entrega a movimentação e os metadados disponíveis.
→ NOVEX normaliza o nome.
→ aplica regra aprendida se existir.
→ cria/categoriza automaticamente.
→ caso seja recorrente, pode reconhecer padrão e melhorar previsão.

## Fluxo E — Exceções
Duplicidade, ambiguidade, valor divergente, estorno observado, chargeback e dados insuficientes entram em estado explícito. Nunca são “resolvidos” por suposição silenciosa.

## Fluxo F — Provisionamento e Governança via Painel Master (SaaS)
Proprietário cadastra o cliente e seleciona o produto NOVEX Finance no Painel Master interno.
→ Master envia requisição REST assinada com `MASTER_API_SECRET` (`POST /api/master/tenants`).
→ NOVEX Finance cria o `User`, o `Workspace` do cliente e o `Membership` com papel `OWNER`.
→ NOVEX Finance provisiona categorias financeiras padrão e a conta manual inicial.
→ Master gerencia o status da assinatura (`PUT /api/master/tenants/:id/subscription` -> `ACTIVE`, `SUSPENDED`).
→ Cliente acessa diretamente a interface web do Finance (`finance.novexbr.com.br`) com seu e-mail e senha.
→ Cliente acessa Configurações e escaneia seu próprio QR Code na Evolution API (instância `ws_<workspaceId>`).
→ Todo dado financeiro (lançamentos, contatos, cobranças e extrato) é estritamente isolado pelo `workspaceId`.
