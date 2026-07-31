---
name: gerar-arte
description: Gera imagem via Gemini (Nano Banana 2) para Lendas e Relíquias usando os prompts-master fixos do usuário. Use quando pedirem para gerar/criar/desenhar arte de um Personagem/Criatura, Item, Local/Construção ou cena de Terror ("gera uma imagem do NPC X", "cria o ícone desse item", "desenha essa taverna", "gera a criatura do abismo dessa masmorra").
---

# Gerar arte — Lendas e Relíquias

Script: [gerar-imagem.mjs](../../../gerar-imagem.mjs) na raiz do projeto, modelo `gemini-3.1-flash-image-preview` (Nano Banana 2). Requer `GEMINI_API_KEY` já configurada no ambiente (se faltar, o script avisa e para).

## 1. Identifique a categoria

Se não estiver óbvio pelo pedido, pergunte qual das 4:

| Categoria | Sempre enviar | Envie só o bloco pedido |
|---|---|---|
| Personagem / Criatura | `references/personagens/estilo.md` | `references/personagens/racas/<raça>.md` |
| Item | `references/itens.md` (já é curto, sem divisão) | — |
| Local / Construção | `references/locais/estilo.md` | `references/locais/tribos/<tribo>.md` |
| Terror | `references/terror/estilo.md` | `references/terror/categorias/<categoria>.md` |

## 2. Monte o prompt — só o necessário, pra economizar token

Os templates originais eram um documento único com todas as raças/tribos/categorias juntas (a maior parte do peso do prompt). Eles já foram divididos: o arquivo `estilo.md` de cada categoria tem só a parte de arte/formato (o que garante que todas as imagens pareçam do mesmo artista) e é sempre enviado; o guia específico (raça, tribo, categoria de horror) vira um arquivo à parte e só esse é lido e enviado — nunca os outros 7-12 irmãos dele.

Passo a passo:
1. Leia **só** o `estilo.md` da categoria.
2. Descubra qual raça/tribo/categoria de horror o usuário pediu (pergunte se não disse — não adivinhe, ver [[nunca-inventar-lore]]).
3. Leia **só** o arquivo correspondente dentro de `racas/`, `tribos/` ou `categorias/`.
4. Concatene: `estilo.md` + arquivo específico + a descrição que o usuário deu (verbatim nos dois primeiros, nunca resumidos ou parafraseados).

Para **Item**, não tem divisão — é só `itens.md` (já é uma linha) + a descrição do item.

## 3. Defina o arquivo de saída

- **Item**: salve em `functions/avulsos-imagens/<Nome do Item>.png` — é a pasta que já existe pra ícones de item.
- **Personagem / Local / Terror**: pergunte onde o usuário quer, ou use `imagens-geradas/<nome-descritivo>.png` na raiz por padrão (crie a pasta se não existir).

## 4. Rode o script

```bash
node gerar-imagem.mjs "<estilo.md + bloco específico + descrição do usuário>" "<caminho de saída>"
```

Mostre o caminho final ao usuário depois de gerar.
