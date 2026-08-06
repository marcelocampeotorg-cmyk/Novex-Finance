# 03 — Requisitos funcionais

## 3.1 Autenticação e isolamento

- Login por e-mail e senha.
- Recuperação de senha preparada para etapa posterior.
- Cada usuário pertence a um workspace pessoal.
- Todos os registros financeiros possuem `workspace_id`.
- Um usuário nunca pode acessar dados de outro workspace.

## 3.2 Contatos

Cadastrar pessoa ou empresa com:

- nome;
- tipo: pessoa ou empresa;
- documento opcional;
- telefone e e-mail opcionais;
- observações;
- uma ou mais chaves Pix;
- tipo de chave Pix;
- relacionamento: devedor, favorecido ou ambos;
- ativo, arquivado ou na lixeira.

## 3.3 Contas a pagar

Uma conta pode ser:

- avulsa;
- parcelada;
- recorrente;
- renegociada.

Campos mínimos:

- título;
- descrição;
- favorecido;
- categoria;
- valor total;
- parcelas;
- vencimentos;
- chave Pix escolhida;
- lembretes;
- observações;
- anexos.

Ações:

- gerar QR Code e Pix Copia e Cola;
- copiar código;
- abrir detalhes;
- ajustar parcelas futuras;
- encerrar recorrência;
- excluir para lixeira;
- restaurar;
- consultar pagamento conciliado.

O fluxo normal não exige “marcar como paga”. O status deve mudar após conciliação com uma saída importada do Mercado Pago.

## 3.4 Contas a receber

Cadastrar:

- devedor;
- descrição;
- valor total;
- parcelas e vencimentos;
- valores diferentes por parcela;
- cobrança Pix Mercado Pago;
- external reference única;
- status de cobrança;
- recebimentos parciais;
- histórico.

Quando a cobrança for paga:

- receber webhook;
- validar origem e assinatura;
- consultar a transação na API;
- registrar a entrada;
- atualizar parcela;
- recalcular saldo;
- evitar processamento duplicado.

## 3.5 Parcelamentos e negociações

- O valor total pode ser dividido em qualquer quantidade de parcelas.
- As parcelas podem ter valores e vencimentos diferentes.
- A soma das parcelas deve ser igual ao total, salvo diferença explicitamente registrada como desconto, juros ou ajuste.
- Uma parcela pode ser paga parcialmente.
- Uma renegociação deve preservar o histórico anterior e criar uma nova versão ou novo acordo relacionado.

## 3.6 Movimentações externas

Toda movimentação importada do Mercado Pago deve ser registrada automaticamente.

- Débito sem conta prevista correspondente: criar despesa não planejada.
- Crédito sem conta a receber correspondente: criar receita não identificada.
- A movimentação não deve exigir lançamento manual.
- Caso a categoria não seja identificada, usar “Não categorizada”.
- O usuário pode corrigir a categoria depois.

## 3.7 Saldo

Exibir:

- saldo atual sincronizado ou calculado;
- fonte do saldo;
- data e hora da última sincronização;
- entradas realizadas;
- saídas realizadas;
- contas a receber previstas;
- contas a pagar previstas;
- saldo projetado por período.

Fórmula conceitual:

`saldo projetado = saldo atual + recebimentos previstos - pagamentos previstos`

Não apresentar saldo como “ao vivo” se a API não oferecer atualização em tempo real.

## 3.8 Recorrências

- Regra configurável por frequência e data.
- Geração automática de ocorrências.
- Cada ocorrência tem status e anexos próprios.
- Alterar somente uma ocorrência ou as futuras.
- Encerrar sem apagar histórico.

## 3.9 Lembretes

- Padrão configurável por usuário.
- Valores iniciais sugeridos: 7, 3 e 1 dia antes, no vencimento e após atraso.
- Cada conta pode sobrescrever a regra global.
- Horário configurável.
- Canais inicialmente: painel.
- Estrutura preparada para e-mail, push e WhatsApp.

## 3.10 Exclusão

- Itens planejados podem ir para lixeira.
- Lixeira padrão: 30 dias, configurável.
- Movimentações importadas de provedores não podem ser apagadas do registro de auditoria; podem ser arquivadas ou excluídas dos cálculos por motivo registrado.
- Exclusão definitiva exige confirmação reforçada.
- Relações financeiras devem impedir exclusões que corrompam o histórico.

## 3.11 Comprovantes

- Upload manual na V1.
- Tentar obter metadados ou comprovante pela API somente após confirmar que a conta possui esse recurso.
- A ausência de comprovante automático não deve bloquear o sistema.
- Arquivo fora do container efêmero, com metadados no banco.
