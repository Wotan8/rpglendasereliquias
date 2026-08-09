---
name: Gerar Arte
description: Gera imagem via script para Lendas e Relíquias usando os prompts-master fixos do usuário. Use quando pedirem para gerar/criar/desenhar arte de um Personagem/Criatura, Item, Local/Construção ou cena de Terror ("gera uma imagem do NPC X", "cria o ícone desse item", "desenha essa taverna", "gera a criatura do abismo dessa masmorra").
---

# Gerar arte — Lendas e Relíquias

SEMPRE USE a sua ferramenta nativa `generate_image`. NÃO USE o script `node gerar-imagem.mjs` (a cota da API daquele script costuma esgotar rapidamente).

## 1. Identifique a categoria

Se não estiver óbvio pelo pedido, pergunte qual das 4:

| Categoria | Sempre enviar | Envie só o bloco pedido |
|---|---|---|
| Personagem / Criatura | `references/personagens/estilo.md` | `references/personagens/racas/<raça>.md` |
| Item | `references/itens.md` (já é curto, sem divisão) | — |
| Local / Construção | `references/locais/estilo.md` | `references/locais/tribos/<tribo>.md` |
| Terror | `references/terror/estilo.md` | `references/terror/categorias/<categoria>.md` |

## 2. Monte o prompt — só o necessário, pra economizar token

Os templates originais foram divididos para otimizar tokens.
Passo a passo:
1. Leia **só** o `estilo.md` da categoria.
2. Descubra qual raça/tribo/categoria de horror o usuário pediu (pergunte se não disse — não adivinhe).
3. Leia **só** o arquivo correspondente dentro de `racas/`, `tribos/` ou `categorias/`.
4. Concatene: `estilo.md` + arquivo específico + a descrição que o usuário deu (verbatim nos dois primeiros, nunca resumidos ou parafraseados).

Para **Item**, não tem divisão — é só `itens.md` (já é uma linha) + a descrição do item.

## 3. Defina o arquivo de saída

- **Item**: salve em `functions/avulsos-imagens/<Nome do Item>.png` — é a pasta que já existe pra ícones de item.
- **Personagem / Local / Terror**: pergunte onde o usuário quer, ou use `imagens-geradas/<nome-descritivo>.png` na raiz por padrão (crie a pasta se não existir).

## 4. Gere a imagem e mova para o destino

Use a sua ferramenta nativa `generate_image` passando o prompt completo (estilo.md + bloco específico + descrição do usuário).

Depois que a ferramenta gerar a imagem (ela será salva na sua pasta de artefatos local e o caminho será retornado na saída), use o comando `Copy-Item` no terminal (via `run_command`) para copiar a imagem para o `<caminho de saída>` definido no passo anterior:

```powershell
Copy-Item "<caminho_da_imagem_gerada_pela_ferramenta>" "<caminho de saída>" -Force
```

Em seguida, aplique a remoção de fundo automática chamando o script em Python configurado no projeto:

```powershell
python functions/remove-bg.py "<caminho de saída>"
```

Mostre o caminho final ao usuário depois de gerar.

## 5. Integração com Banco de Dados (Opcional)

Se o pedido envolver **"banco de dados"** ou **"site"**:
- Execute o script de automação via terminal (`run_command`):
- Script: `functions/upload-and-update.mjs`
- Comando: `node upload-and-update.mjs "<caminho_local_da_imagem_gerada>" "<colecao_do_firestore>" "<Nome do Documento>"`
- Exemplo: `node upload-and-update.mjs "C:\...\artefato.png" "system/data/tribes" "Forasteiro"`
