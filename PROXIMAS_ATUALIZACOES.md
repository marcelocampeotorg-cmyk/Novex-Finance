# Próximas Atualizações — NOVEX Finance (Evoluções, Melhorias & Updates)

> **PROPÓSITO DESTE ARQUIVO (ROADMAP EVOLUTIVO):**
> Este arquivo reúne **novas funcionalidades, melhorias de experiência de produto (UX/UI), ideias de expansão e updates planejados** para o sistema NOVEX Finance.
> Ele deve ser consultado e executado quando abrirmos janelas de evolução técnica ou pausas planejadas para novos desenvolvimentos.
>
> **Diferença importante para não confundir:**
> - [`afazeres.md`](afazeres.md) ➔ **Sistema Atual:** Correções de bugs, pendências operacionais ativas, estabilizações críticas e manutenção imediata.
> - [`PROXIMAS_ATUALIZACOES.md`](PROXIMAS_ATUALIZACOES.md) (este arquivo) ➔ **Sistema Futuro:** Novas ideias, melhorias arquiteturais de interface, novas integrações e updates de produto.

---

## 1. Arquitetura de Navegação por Abas Horizontais (Tabs) e Eliminação de Scroll Vertical Longo

> **STATUS DA FUNCIONALIDADE:**
> ⚠️ **PLANEJADA | NÃO EXECUTAR NESTA SESSÃO | AGENDADA PARA IMPLEMENTAÇÃO AMANHÃ**
> Este item define a reestruturação da tela de `/configuracoes` e estabelece o padrão arquitetural de interface para eliminar rolagem vertical excessiva (scroll do mouse), mantendo as páginas contidas e profissionais.

---

### 1.1 Motivação e Diagnóstico de UX (Feedback do Usuário)

1. **Problema do Scroll Excessivo e Falta de Profissionalismo:**
   - Atualmente, a página `/configuracoes` acumula verticalmente quatro grandes blocos densos:
     1. `Dados do Workspace` (Nome da conta e fuso horário);
     2. `Segurança & Alteração de Senha` (Campos de senha e confirmação);
     3. `Integração Mercado Pago` (Status, chaves públicas, tokens, validação remota, substituição e desconexão);
     4. `Conexão WhatsApp (Evolution API)` (Resumo do aparelho, QR Code, teste de disparo e configurações avançadas).
   - O usuário precisa rolar exaustivamente a roda do mouse para transitar entre o topo e o final da página. Quando está no rodapé, o menu lateral e o cabeçalho ficam distantes.
   - Rolagem vertical longa em painéis administrativos quebra a sensação de dashboard moderno e reduz a percepção de produto profissional.

2. **Integrações Já Conectadas Não Precisam Ocupar a Tela Inteira:**
   - Tanto a integração do **Mercado Pago** quanto a do **WhatsApp Evolution API** são configuradas uma única vez ou raramente manipuladas após estarem conectadas e ativas.
   - Deixar formulários de credenciais ou cards extensos abertos o tempo todo gera poluição visual desnecessária.
   - Quando ativas, essas integrações devem ficar em modo compacto/minimizado com badges de saúde verdes (`Conectado`), permitindo expansão apenas sob clique ou em sua aba dedicada.

3. **Padrão de Produto Almejado:**
   - Criar uma **Barra Superior de Abas Horizontais (Tabs)** no topo da página de Configurações, no estilo dashboard executivo dark:
     - 🏢 **Aba 1: `Dados do Workspace`** ➔ Nome do Workspace, identificadores e preferências de conta;
     - 💳 **Aba 2: `Mercado Pago`** ➔ Resumo compacto de credencial mascarada, ambiente de execução (Produção/Sandbox), última validação remota e botão de troca/desconexão;
     - 💬 **Aba 3: `Conexão WhatsApp`** ➔ Resumo minimalista do aparelho conectado (`Frank Oliveira • +55 62 9475-2418`), status do socket, teste rápido de envio e opções de servidor;
     - 🔒 **Aba 4: `Segurança & Senha`** ➔ Formulário de alteração de senha de acesso.
   - Apenas o conteúdo da aba selecionada é renderizado, ocupando exatamente a altura visível da tela sem scroll do mouse em monitores desktop padrão.
   - **Extensibilidade:** Esse padrão de abas deve ser replicado para outras telas do sistema que começarem a acumular blocos verticais (ex.: Extrato, Conciliação e Relatórios).

---

### 1.2 Especificação Técnica da Interface

* **Componente de Navegação por Abas (`ConfigTabsNav`):**
  - Barra horizontal contínua logo abaixo do `PageHeader`:
    ```tsx
    const TABS = [
      { id: "workspace", label: "Dados do Workspace", icon: Building },
      { id: "mercadopago", label: "Integração Mercado Pago", icon: ShieldCheck, badge: mpStatus?.isConnected ? "Conectado" : null },
      { id: "whatsapp", label: "Conexão WhatsApp", icon: MessageSquare, badge: waConnected ? "Ativo" : null },
      { id: "security", label: "Segurança & Senha", icon: Lock },
    ];
    ```
  - Estilização seguindo os tokens de design do NOVEX (`border-b border-novex-border`, `hover:text-novex-cyan`, indicador inferior ciano na aba ativa: `border-b-2 border-novex-cyan text-novex-cyan font-bold`).
* **Preservação de Estado e Reatividade:**
  - A alternância entre abas ocorre por estado React local (`activeTab`), sem causar recarregamento de página nem perda de dados digitados em formulários.
  - Suporte opcional a sincronização por hash na URL (ex: `/configuracoes#whatsapp` ou `/configuracoes#mercadopago`) para que notificações e atalhos externos abram diretamente a aba correta.
* **Layout Minimizado / Compacto dos Cards:**
  - **Mercado Pago Conectado:** Um card enxuto com fundo `bg-novex-surface1`, badge verde `● Conectado (Produção)` e token mascarado. Os formulários de substituição de token só se abrem se o usuário clicar explicitamente em "Substituir Credenciais".
  - **WhatsApp Conectado:** Card compacto já preparado com avatar, nome e telefone do titular, botão "Verificar" e campo de disparo de teste. QR Code e formulários de endpoint avançado só aparecem se a instância estiver desconectada ou em caso de clique em "Configurações Avançadas".

---

### 1.3 Critérios de Aceite para a Execução (Amanhã)

- [ ] A página `/configuracoes` cabe na altura visível em monitores desktop normais (1080p e laptops), eliminando o scroll vertical forçado.
- [ ] A troca entre as 4 abas é instantânea, suave e sem recarregamento de tela.
- [ ] Formulários mantêm seus estados e mensagens de feedback (sucesso/erro) isolados no contexto de cada aba.
- [ ] As integrações Mercado Pago e WhatsApp exibem visual minimalista quando conectadas, sem exibir formulários abertos desnecessariamente.
- [ ] 100% de aprovação na suíte de testes automatizados (`npm test`) e `npm run typecheck` sem erros de tipagem.
- [ ] Deploy concluído no servidor Linux de produção (`192.168.4.12`) e homologação visual no navegador.

---

## 2. Ingestor Contínuo e Resolução Inteligente de Contrapartes Bancárias

> **STATUS DA FUNCIONALIDADE:**
> ⚠️ **PLANEJADA | EM DESENHO DE ARQUITETURA**
> Identificação automática e enriquecimento de favorecidos para transferências Pix bancárias que a API do Mercado Pago devolve sem identificador nominal.

---

## 3. Gestão Centralizada de Regras de Categorização Financeira e DRE

> **STATUS DA FUNCIONALIDADE:**
> ⚠️ **PLANEJADA | EM DESENHO DE ARQUITETURA**
> Painel executivo com visualização de despesas por categoria, regras de correspondência determinísticas e relatórios de fluxo de caixa em tempo real.

---

## 4. Arquitetura SaaS Multi-Tenant & API de Integração com o Painel Master

> **STATUS DA FUNCIONALIDADE:**
> ⚠️ **PLANEJADA | EM DESENHO DE ARQUITETURA E PREPARAÇÃO LOCAL**
> Transição oficial do NOVEX Finance para arquitetura multilocatária (*multi-tenant*), governada e provisionada pelo **Painel Master** (painel administrativo exclusivo do proprietário Frank), com instâncias individuais de WhatsApp na Evolution API e isolamento estrito de dados.

---

### 4.1 Princípios e Modelo Operacional

1. **Papel do Painel Master (Control Plane Interno):**
   - O Painel Master é de uso exclusivo do proprietário (Frank). Clientes finais não acessam o Master.
   - O cliente contrata o produto com a NOVEX. O proprietário cadastra o cliente no Master e seleciona o produto (*NOVEX Finance*).
   - O Painel Master faz uma chamada autenticada via API REST para o NOVEX Finance para criar/gerenciar o cliente.
2. **Acesso do Cliente Final no Finance:**
   - O cliente entra diretamente pela URL do sistema (`https://finance.novexbr.com.br`) usando seu e-mail e senha.
   - O cliente enxerga apenas o seu Workspace e os seus dados financeiros (isolamento estrito por `workspaceId`).
3. **Preservação dos Dados do Proprietário:**
   - O workspace e os dados financeiros reais atuais do proprietário (caixa físico de R$ 120,00, credenciais do Mercado Pago, histórico e regras) permanecem como o **Workspace Principal / Dono** no mesmo banco de dados. Nada é resetado ou perdido.
4. **WhatsApp Dedicado por Cliente (Evolution API):**
   - Não será utilizada a API oficial da Meta nesta fase (baixo volume e economia de custos operacionais).
   - Cada cliente no SaaS possui sua própria instância dedicada na Evolution API local (ex: `ws_<workspaceId>`), escaneando seu próprio QR Code na aba de Configurações para enviar cobranças pelo seu número próprio.
5. **Política de Deploy Zero:**
   - Todo o desenvolvimento, refatoração e testes serão executados exclusivamente em ambiente local (Docker / banco local).
   - **Nenhum deploy em produção será realizado** até que o SaaS esteja 100% pronto, testado e expressamente aprovado pelo proprietário.

---

### 4.2 Especificação da API de Integração com o Painel Master

Endpoints protegidos por cabeçalho de autorização com segredo compartilhado (`Authorization: Bearer <MASTER_API_SECRET>`):

| Endpoint | Método | Descrição |
| :--- | :--- | :--- |
| `/api/master/tenants` | `POST` | Cria um novo cliente no Finance: gera o `User`, cria o `Workspace`, vincula como `MembershipRole.OWNER`, provisiona categorias padrão e conta geral manual. |
| `/api/master/tenants/:id/subscription` | `PUT` | Atualiza o plano (`STARTER`, `PRO`, etc.) ou o status do cliente (`ACTIVE`, `SUSPENDED`, `CANCELED`). Se suspenso, o middleware bloqueia o acesso do cliente no Finance. |
| `/api/master/tenants/:id/usage` | `GET` | Retorna métricas de uso do workspace (quantidade de transações do mês, saldo de lançamentos, instâncias ativas) para exibição no painel administrativo do Master. |
| `/api/master/tenants/:id/reset-access` | `POST` | Gera um link de primeiro acesso ou redefinição de senha para o cliente final. |

---

### 4.3 Gestão Multi-Instância da Evolution API

* **Módulo:** `src/integrations/evolution/instance-manager.ts`
* **Comportamento:**
  - Ao abrir a aba de WhatsApp nas Configurações, o Finance verifica se a instância `ws_<workspaceId>` existe na Evolution.
  - Se não existir, chama `POST /instance/create` com o nome da instância e webhook direcionado para o callback do Finance.
  - Exibe o QR Code Base64 nativo na tela do cliente.
  - O status do socket (`open`, `close`, `connecting`) é consultado e armazenado por workspace, permitindo desconexão ou reinicialização sem afetar outros clientes.

---

### 4.4 Critérios de Aceite para Conclusão da Fase SaaS

- [ ] Contrato da API do Master implementado e coberto por testes automatizados com validação de token `MASTER_API_SECRET`.
- [ ] Criação de novos tenants cria usuário, workspace isolado e categorias padrão sem interferir no workspace do proprietário.
- [ ] Testes de isolamento garantem que nenhum endpoint ou Server Action vaze dados de um `workspaceId` para outro.
- [ ] Suporte a múltiplas instâncias da Evolution API verificado localmente.
- [ ] Suíte de testes automatizados (`npm test`) passando com 100% de sucesso.
- [ ] Homologação em Docker local sem regressão.
