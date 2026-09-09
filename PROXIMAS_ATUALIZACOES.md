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
