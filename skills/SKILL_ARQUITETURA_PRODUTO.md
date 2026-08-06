# Skill — Arquitetura de produto

## Objetivo

Converter os requisitos em módulos simples, evitando ERP, microserviços e abstrações prematuras.

## Entradas

- decisões confirmadas;
- fluxos do usuário;
- roadmap;
- riscos.

## Saídas

- árvore de módulos;
- contratos entre domínio e infraestrutura;
- migrations coerentes;
- ADRs curtos para decisões importantes.

## Regras

- uma aplicação + worker;
- provider adapter;
- workspace desde o início;
- dinheiro em centavos;
- nenhuma funcionalidade empresarial fora do escopo.

## Pronto quando

A arquitetura permite UI, banco, worker e Mercado Pago sem depender do projeto antigo.
