---
name: novex-brand-identity
description: >
  Diretrizes de identidade visual, paleta de cores, tipografia, logotipos e design system
  oficial da marca NOVEX / NOVEXBR no ecossistema NOVEX Finance e outros produtos.
  Usar sempre que for criar ou alterar telas, componentes visuais, logos, badges,
  cores, cartões, relatórios ou estilos de interface.
---

# Diretrizes Oficiais de Marca — NOVEXBR

## 1. Conceito e Estética da Marca

A NOVEXBR transmite solidez financeira, precisão institucional e alta tecnologia com estética **dark-first premium**, combinando acabamento metálico escovado/polido com o brilho elétrico do ciano neon.

## 2. Paleta Oficial de Cores

### Fundos e Superfícies (Dark-First)
* **Background Principal:** `#0B0E14` (Preto azulado ultra-profundo)
* **Superfície 1 (Cards, Sidebar, Navbar):** `#12172B` (Navy Escuro Corporativo)
* **Superfície 2 (Hover, Inputs, Badges internos):** `#1A2238` (Slate Navy elevado)
* **Bordas & Divisórias:** `#2A354D` (Borda sutil de contenção, sem poluição)

### Acentos de Marca
* **Ciano Neon NOVEX:** `#00E5FF` (Destaque do detalhe diagonal do 'N' e da sigla 'BR')
* **Metal Escovado / Prata:** Gradiente `#FFFFFF` -> `#E2E8F0` -> `#94A3B8` (Monograma 'N' e texto 'NOVEX')
* **Esmeralda / Ganhos:** `#10B981` (Superávit, receitas, status quitado)
* **Vermelho / Despesas:** `#EF4444` / `#F43F5E` (Saídas, contas a pagar, vencidos)
* **Âmbar / Alerta:** `#F59E0B` (Avisos de vencimento iminente)

## 3. Logotipos Oficiais e Arquivos de Imagem

Todos os arquivos canônicos da marca estão localizados em `public/brand/`:

* **`public/brand/novex_official_brand_identity.png`**: Arquivo master original em alta definição (1024x576) fornecido pelo proprietário.
* **`public/brand/novex_symbol_transparent.png`**: Símbolo do 'N' estilizado com acabamento metálico 3D e corte ciano neon superior, com transparência alfa para Sidebar e Favicon.
* **`public/brand/novex_brand_full_transparent.png`**: Logo horizontal completa (símbolo + texto NOVEXBR) com transparência alfa.

## 4. Regras Obrigatórias de Aplicação Visual

1. **Nunca usar placeholders genéricos:** Sempre utilizar os assets oficiais de marca em `public/brand/`.
2. **Harmonia da Tipografia:** A marca é escrita como **NOVEX** (em branco/prata) e **BR** (em ciano `#00E5FF`), seguida pelo identificador do produto (ex: `Finance`) em tracking aberto e caixa alta sutil.
3. **Limpeza e Sofisticação:** Evitar avisos berrantes desnecessários no cockpit. Indicadores de status devem ser refinados, compactos e perfeitamente alinhados ao grid.
4. **Hierarquia e Contraste:** Dados financeiros críticos (valores, datas e saldos) sempre devem ter destaque nítido sobre o fundo escuro, com tipografia legível e contraste WCAG AA.
