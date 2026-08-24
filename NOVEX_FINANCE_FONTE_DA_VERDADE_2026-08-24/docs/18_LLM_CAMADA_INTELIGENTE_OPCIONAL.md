# 18 — LLM como Camada Inteligente Opcional

**LLM = modelo de linguagem usado para interpretação contextual.**

## Prioridade
Não é dependência da V1. A arquitetura pode deixar uma porta limpa para integração futura.

## Onde soma
- interpretar descrições confusas;
- sugerir nome amigável de estabelecimento;
- sugerir categoria;
- explicar variações de gasto;
- resumir mês;
- responder perguntas em linguagem natural;
- sugerir regra de classificação;
- ajudar a identificar recorrências ambíguas.

## Onde não decide
- valor;
- direção crédito/débito;
- ocorrência da transação;
- saldo;
- pagamento confirmado;
- baixa financeira;
- autorização para movimentar dinheiro.

## Arquitetura
Dados financeiros estruturados primeiro. A LLM recebe somente o contexto necessário, com dados minimizados e política de privacidade. Sua resposta é uma sugestão com confiança/explicação, não uma mutação financeira direta.

## Controle de custo
Cachear classificações, usar regras antes da LLM e chamar o modelo apenas quando o ganho esperado justificar.

## Critério para ativação
Adicionar quando houver evidência de que regras determinísticas estão gerando volume relevante de pendências que uma LLM realmente resolve com qualidade mensurável.
