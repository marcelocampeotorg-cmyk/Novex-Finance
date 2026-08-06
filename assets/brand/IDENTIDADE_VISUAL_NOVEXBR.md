# IDENTIDADE VISUAL NOVEXBR

**Versão:** 1.0  
**Marca:** NOVEXBR  
**Produto:** NOVEX Finance  
**Idioma da interface:** Português do Brasil (`pt-BR`)  
**Conceito visual:** Dark-First Premium

---

## 1. Regra principal

A marca NOVEXBR **não deve ser redesenhada, reinterpretada ou reconstruída manualmente**.

A implementação deve usar exclusivamente os assets oficiais incluídos na pasta `assets_oficiais/`.

Em qualquer conflito entre descrição textual e interpretação visual, **os arquivos de imagem oficiais prevalecem**.

---

## 2. Assets oficiais

### 2.1 Símbolo isolado

- Arquivo do pacote: `assets_oficiais/novex_symbol_original.png`
- Função: símbolo compacto oficial da NOVEXBR
- Usos autorizados:
  - favicon;
  - sidebar recolhida;
  - splash;
  - loader;
  - ícone compacto.

### 2.2 Composição completa com fundo escuro

- Arquivo do pacote: `assets_oficiais/novex_login_background_original.png`
- Função: composição visual completa da marca em ambiente escuro tecnológico
- Usos autorizados:
  - tela de login;
  - referência visual da interface;
  - splash institucional.

### 2.3 Logo horizontal completa

- Arquivo do pacote: `assets_oficiais/novex_logo_horizontal_original.png`
- Função: logo principal com símbolo e texto NOVEXBR
- Usos autorizados:
  - navbar;
  - sidebar expandida;
  - cabeçalhos;
  - tela de login.

---

## 3. Paleta oficial

### Fundos e superfícies

| Token | Cor |
|---|---|
| Fundo principal | `#0B0E14` |
| Superfície 1 | `#12172B` |
| Superfície 2 | `#1E2638` |
| Bordas | `#2A354D` |

### Acentos da marca

| Token | Cor |
|---|---|
| Ciano principal | `#00E5FF` |
| Ciano hover | `#00B8D4` |
| Ciano ativo | `#00838F` |

### Textos

| Token | Cor |
|---|---|
| Texto principal | `#F1F5F9` |
| Texto secundário | `#94A3B8` |
| Texto desabilitado | `#64748B` |

### Cores semânticas

| Token | Cor |
|---|---|
| Sucesso | `#10B981` |
| Alerta | `#F59E0B` |
| Erro | `#EF4444` |
| Informação | `#3B82F6` |

---

## 4. Direção visual obrigatória

A interface deve transmitir:

- tecnologia;
- precisão;
- profissionalismo;
- sofisticação;
- confiança;
- alto contraste;
- limpeza visual.

O tema deve ser escuro, com superfícies em obsidian e grafite, textos claros e acentos ciano controlados.

A textura tecnológica da composição completa pode ser usada na tela de login. Nas telas operacionais, use fundos limpos e discretos para preservar legibilidade.

---

## 5. Regras da marca

### Obrigatório

- preservar a geometria original do símbolo;
- preservar a proporção original;
- preservar prata/metálico e ciano;
- manter o texto oficial `NOVEXBR`;
- manter o destaque visual de `BR` em ciano;
- usar espaço de respiro ao redor da marca;
- criar somente derivados técnicos necessários.

### Proibido

- redesenhar a logo;
- converter a marca em formas aproximadas;
- trocar o ciano por outro azul;
- achatar, esticar, inclinar ou girar a logo;
- alterar a proporção entre símbolo e texto;
- adicionar contornos ou sombras aleatórias;
- usar SVG provisório como marca final;
- reconstruir a marca com CSS;
- recriar tipografia semelhante;
- apagar ou sobrescrever os arquivos oficiais.

---

## 6. Aplicação na interface

### Login

- usar `novex_login_background_original.png` como referência visual principal;
- usar a logo horizontal oficial;
- formulário com fundo escuro e contraste alto;
- botão principal em ciano;
- campos legíveis;
- mensagens de erro e recuperação de senha visíveis.

### Desk

- navbar escura;
- sidebar escura;
- logo horizontal na navegação expandida;
- símbolo isolado na navegação compacta;
- fundo principal obsidian;
- cards em superfícies escuras;
- botões primários em ciano;
- foco, hover e item ativo visíveis;
- modais, tabelas, campos e dropdowns legíveis.

### Portal

- branding básico coerente;
- não gastar esforço excessivo no portal caso não faça parte da V1;
- manter funcionalidade e legibilidade.

### Favicon

- usar o símbolo isolado;
- gerar derivados 16x16, 32x32, 48x48 e 180x180 apenas quando necessário;
- preservar a forma do símbolo.

---

## 7. Português do Brasil

A interface operacional deve estar em Português do Brasil.

Use primeiro o sistema nativo de idiomas do Frappe/ERPNext. Traduções complementares devem existir apenas dentro da app `novex_finance`, sem alterar o core.

Dicionário funcional prioritário:

| Termo do ERPNext | Termo NOVEX Finance |
|---|---|
| Sales Invoice | Conta a Receber |
| Purchase Invoice | Conta a Pagar |
| Payment Entry | Pagamento, Recebimento ou Movimentação |
| Customer | Cliente |
| Supplier | Fornecedor ou Favorecido |
| Auto Repeat | Recorrência |
| Outstanding Amount | Saldo Pendente |
| Posting Date | Data do Lançamento |
| Due Date | Data de Vencimento |
| Draft | Rascunho |
| Submitted | Efetivado |
| Cancelled | Cancelado |
| Cash Flow | Fluxo de Caixa |

---

## 8. Restrições técnicas

- não alterar o core do Frappe;
- não alterar o core do ERPNext;
- personalizar exclusivamente pela app `novex_finance`;
- usar hooks, assets, configurações e CSS suportados;
- manter rollback documentado;
- manter a branch `feat/marco1-branding`;
- não fazer merge ou tag sem aprovação visual;
- não remover módulos, DocTypes, campos ou tabelas.

---

## 9. Critério de aceite visual

O Marco 1 só pode ser aprovado quando:

- os assets oficiais estiverem visíveis;
- a identidade NOVEXBR estiver evidente;
- o tema escuro estiver realmente aplicado;
- a interface estiver legível;
- login, Desk e portal estiverem tratados separadamente;
- o sistema estiver em Português do Brasil nas telas prioritárias;
- o core permanecer limpo;
- houver aprovação visual explícita do usuário.
