# NOVEX Finance Pessoal — Master Blueprint

Versão: **1.0**  
Data: **06/08/2026**  
Idioma: **Português do Brasil**

Este pacote é a fonte de verdade para a criação do novo NOVEX Finance Pessoal. Ele consolida as decisões tomadas após o abandono da adaptação do ERPNext e descreve o produto, os fluxos, a arquitetura, o modelo de dados, a integração com Mercado Pago, a conciliação automática, o Docker, a segurança, os testes e a ordem de implementação.

## ✨ Visão Geral de Funcionalidades

- **Dashboard:** Visão consolidada (receitas, despesas, saldos e histórico).
- **Gestão de Contas:** Controle de pendências, com suporte a parcelamentos e lançamentos recorrentes.
- **Conciliação Bancária:** Integração oficial com **Mercado Pago** para sincronização automática de Pix, transferências, etc.
- **Pagamentos via Pix (BACEN EMV):** Geração nativa e em tempo real do QR Code Pix (Copia e Cola) seguindo os rígidos padrões do Banco Central com cálculo de assinatura CRC16-CCITT, permitindo que a tela seja escaneada por qualquer app bancário.
- **Motor de Notificações WhatsApp (Evolution API):** 
  > ⚠️ **Status Atual:** Módulo em Pausa.
  > A arquitetura deste módulo já está projetada para usar a Evolution API. Porém, como Webhooks externos não conseguem alcançar o servidor em testes locais fechados (`localhost`), a integração das mensagens está temporariamente pausada. O sistema entrará em operação real de disparo via WhatsApp somente quando publicarmos a aplicação na Fase 2 em um ambiente aberto (Servidor Cloud / VPS).
- **Personalização:** Suporte a White Label e relatórios analíticos em gráficos.

## O que este pacote resolve

- elimina contradições entre prompts anteriores;
- separa requisitos confirmados de hipóteses que precisam de teste;
- impede que o projeto copie o ERPNext ou carregue módulos desnecessários;
- orienta o Antigravity a começar em uma pasta nova;
- mantém as imagens apenas como referência visual;
- define como o painel deve importar e conciliar movimentações do Mercado Pago;
- exige um link de preview para acompanhar as alterações.

## Ordem de leitura obrigatória

1. `00_COMECE_AQUI.md`
2. `01_VISAO_DO_PRODUTO.md`
3. `02_ESCOPO_E_NAO_OBJETIVOS.md`
4. `03_REQUISITOS_FUNCIONAIS.md`
5. `04_FLUXOS_DO_USUARIO.md`
6. `05_ARQUITETURA_DO_SISTEMA.md`
7. `06_MODELO_DE_DADOS.md`
8. `07_MERCADO_PAGO_E_PIX.md`
9. `08_CONCILIACAO_AUTOMATICA.md`
10. `09_INTERFACE_E_EXPERIENCIA.md`
11. `10_DOCKER_E_PUBLICACAO.md`
12. `11_SEGURANCA_E_PRIVACIDADE.md`
13. `12_TESTES_E_ACEITE.md`
14. `13_ROADMAP.md`
15. `14_REGRAS_DE_CODIGO.md`
16. `15_DECISOES_CONFIRMADAS.md`
17. `16_RISCOS_E_HIPOTESES.md`
18. `17_AUDITORIA_DA_API_EXISTENTE.md`
19. `18_PREVIEW_E_LINK_DE_ACOMPANHAMENTO.md`
20. `skills/README.md`
21. `PROMPT_MASTER_ANTIGRAVITY.txt`

## Prioridade em caso de conflito

1. `15_DECISOES_CONFIRMADAS.md`
2. requisitos funcionais e fluxos;
3. arquitetura e modelo de dados;
4. regras de integração e segurança;
5. imagens de referência;
6. prompts antigos.

As imagens não substituem os documentos. Elas podem conter nomes, números ou elementos fictícios que não devem ser copiados literalmente.
