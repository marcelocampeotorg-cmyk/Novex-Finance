# 09 — Interface e experiência

## Fonte visual

Imagens em `assets/screens/`. Elas representam direção visual e organização, não uma obrigação de copiar textos fictícios, erros gerados ou elementos comerciais.

## Identidade

- Dark-first premium.
- Fundo obsidian.
- Superfícies grafite.
- Ciano elétrico como ação principal.
- Branco/prata para texto.
- Verde para concluído.
- Âmbar para atenção.
- Vermelho para atraso/erro.
- Tokens centralizados.
- Assets oficiais em `assets/brand/` prevalecem.

## Não copiar das imagens

- “NOVEXBR PRO” e cards de upgrade;
- CNPJ fictício;
- nome “Lucas Oliveira” como dado real;
- datas e valores demonstrativos como produção;
- textos com erros de geração;
- qualquer imagem usada como fundo de interface.

## Navegação

- Início;
- Contas a Pagar;
- Contas a Receber;
- Devedores;
- Movimentações;
- Recorrências;
- Lembretes;
- Relatórios;
- Configurações.

## Dashboard

Mostrar:

- saldo atual;
- indicador de sincronização;
- saldo projetado;
- a pagar;
- a receber;
- vencidas;
- entradas versus saídas;
- próximos vencimentos;
- devedores;
- movimentações recentes;
- movimentações não conciliadas;
- compras não categorizadas.

## Contas a pagar

- tabela/lista responsiva;
- filtros;
- detalhes em drawer;
- parcelas;
- botão Pagar;
- QR Code e Copia e Cola;
- status de conciliação;
- histórico importado.

## Contas a receber

- devedores;
- parcelas;
- cobrança Mercado Pago;
- QR Code;
- status de webhook;
- recebimento parcial;
- histórico.

## Movimentações

É uma tela central, mesmo que não apareça detalhada nas imagens:

- todas as entradas e saídas importadas;
- origem Mercado Pago;
- categoria;
- conciliação;
- filtros;
- status;
- ação de corrigir categoria;
- ação de vincular quando ambígua;
- nunca exigir recriar manualmente o movimento.

## Modal Nova conta

- pagar ou receber;
- contato;
- total;
- parcelamento editável;
- vencimentos;
- recorrência;
- Pix;
- anexos;
- lembretes.

## Estados obrigatórios

- carregando;
- vazio;
- erro recuperável;
- offline/sincronização atrasada;
- integração desconectada;
- não conciliado;
- não categorizado;
- lixeira.

## Responsividade

- Desktop como referência principal.
- Sidebar recolhível.
- Tabelas com scroll controlado ou cards no celular.
- Drawers em telas menores.
- Ações primárias sempre acessíveis.

## Acessibilidade

- contraste AA;
- foco visível;
- labels reais;
- navegação por teclado;
- aria attributes;
- sem depender apenas de cor;
- redução de movimento.
