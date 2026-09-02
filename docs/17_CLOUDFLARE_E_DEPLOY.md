# 17 — Deploy no servidor e camada de acesso

## Alvo operacional atual

O NOVEX Finance roda no servidor Linux próprio em uma stack Docker Compose autônoma, sob o project name `novexfinance-prod`. O diretório, os containers, as redes, os volumes, o banco, o Redis e a Evolution pertencem exclusivamente ao Finance.

Cloudflare pode ser usado como DNS, proxy ou túnel para `www.app.novexfinance.com.br`. Isso não autoriza compartilhar processos, bancos, redes ou arquivos com NOVEX Master, NOVEX Oficina/Options ou outros sistemas do host.

## Contrato de isolamento

- diretório exclusivo do Finance;
- Compose exclusivo `docker-compose.prod.yml`;
- redes `novexfinance-prod-edge` e `novexfinance-prod-backend`;
- volumes `novexfinance-prod-*`;
- PostgreSQL e Redis somente na rede interna Docker;
- Evolution acessível apenas internamente e pelo loopback do host para diagnóstico;
- aplicação vinculada a `127.0.0.1`, recebendo tráfego externo somente pelo proxy/túnel autorizado;
- nenhum comando de deploy pode parar, remover ou recriar recursos de outro project name.

Apagar a pasta do Finance não apaga volumes Docker automaticamente. Remover a stack ou seus volumes deve exigir comando explícito e escopado ao project name `novexfinance-prod`. Nenhum volume do Master ou Oficina/Options é referenciado.

## Ordem de deploy

1. confirmar worktree, commit e origem do artefato;
2. validar `.env.production` sem imprimir segredos;
3. validar o Compose renderizado e portas livres;
4. gerar backup verificado se já existir banco do Finance;
5. construir imagem imutável;
6. subir PostgreSQL/Redis exclusivos;
7. executar `prisma migrate deploy` em serviço one-shot;
8. subir Evolution, app, worker e backup;
9. aguardar healthcheck;
10. provar containers, redes, volumes, logs, migrações, login e integrações;
11. somente então configurar ou trocar proxy/DNS.

## Domínio e HTTPS

Domínio canônico: `www.app.novexfinance.com.br`. Enquanto o DNS não existir e o proxy/túnel não estiver configurado, o deploy no servidor pode ser validado internamente, mas não deve ser chamado de publicação HTTPS concluída. Better Auth deve receber exatamente a origem pública real em `NEXT_PUBLIC_APP_URL`/`BETTER_AUTH_URL`.

## Backup e restauração

O serviço `backup` gera dump PostgreSQL exclusivo do Finance, checksum SHA-256 e retenção configurável. Backup só é evidência válida depois de validar o checksum e executar uma restauração controlada em banco descartável.

## Gates

- lint, typecheck, testes e build;
- Prisma validate/generate/status;
- migrations em banco limpo;
- `docker compose config` com variáveis obrigatórias;
- health e logs do runtime do servidor;
- login pelo endereço final;
- saldo/extrato Mercado Pago reais;
- Evolution `open` e envio controlado autorizado;
- QA desktop/mobile;
- prova de que containers, redes e volumes dos outros projetos não mudaram.
