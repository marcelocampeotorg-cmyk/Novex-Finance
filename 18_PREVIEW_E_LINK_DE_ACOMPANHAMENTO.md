# 18 — Preview e link de acompanhamento

## Requisito obrigatório

Depois de montar a fundação, o Antigravity deve iniciar o sistema e fornecer um link navegável para o usuário acompanhar as alterações.

## Link mínimo

`http://localhost:3000`

O Docker deve publicar essa porta no host. O link deve continuar funcionando enquanto o ambiente de desenvolvimento estiver ativo.

## Entrega em cada marco

Informar:

- URL;
- comando para iniciar;
- comando para parar;
- status dos containers;
- credencial de demonstração, se existir, sem segredo real;
- páginas prontas;
- limitações.

## Acesso em outro dispositivo da rede

Quando necessário, informar também:

`http://IP-LOCAL-DO-COMPUTADOR:3000`

Somente após verificar firewall e sem expor banco ou Redis.

## Preview público temporário

Só criar quando solicitado ou quando a ferramenta já fornecer um preview seguro. Caso use túnel:

- expor apenas a aplicação web;
- usar dados demonstrativos;
- não expor banco, Redis ou painel interno;
- não usar credenciais reais;
- informar que o link é temporário;
- encerrar após uso.

## Regra de acompanhamento

O Antigravity deve manter o servidor de preview rodando durante a validação visual e atualizar o mesmo projeto, evitando gerar cópias paralelas.
