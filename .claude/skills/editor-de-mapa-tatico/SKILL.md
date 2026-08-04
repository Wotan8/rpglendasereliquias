---
name: editor-de-mapa-tatico
description: Monta o Mapa Tático de um Local do Worldbuilding direto no banco — sobe o mapa (.dd2vtt do Dungeon Alchemist ou imagem), posiciona tokens de NPC, itens e baús trancados, e ajusta portas, janelas e luzes. Use quando o usuário pedir para "upar o mapa X pro site", "põe o token do NPC X na sala Y", "coloca um baú com tal item dentro trancado com chave", "converte essas portas em janelas" ou "acende uma luz em tal lugar".
---

# Editor de Mapa Tático

Faz pelo banco o que o editor `wb-mapa-local.js` faz pela tela: grava `mapaTatico` no doc do Local
em `worldbuilding-geography`. Depois é só abrir o Tabuleiro → painel de Locais → um clique.

**Nunca invente NPC, item ou lore.** Se um nome pedido não existir no banco, pare e pergunte —
o script já explode nesse caso, e é para continuar assim.

## 1. Entender o pedido

Precisa sair daqui: **qual Local**, **qual mapa** (se for trocar), **quem/o quê vai onde**.
"Na sala do altar", "no canto nordeste do pátio" já basta — você resolve a coordenada no passo 2.
O que **não** se adivinha: nome de NPC, nome de item, nome do item-chave. Sem isso, pergunte.

## 2. Olhar o mapa e achar as coordenadas

As posições do plano são em **quadros do grid** (o mesmo quadriculado do Dungeon Alchemist),
não em pixel — assim o redimensionamento da imagem não desalinha nada.

Para enxergar o mapa e localizar a sala, siga [[ler-mapas-dd2vtt]] na memória: extraia o PNG
embutido, gere um panorama reduzido e depois recortes ampliados. Com o recorte na mão, converta:

```
quadroX = pxNaImagemCheia / pixels_per_grid     (pixels_per_grid vem do resolution do .dd2vtt)
```

Se o Local já tem mapa e você não vai trocar, use `mt.imgW / (larguraReal / metrosPorQuadro)`
como px-por-quadro. Confira sempre num recorte antes de cravar o número.

## 3. Escrever o plano

Um JSON no scratchpad. Só as chaves que o pedido precisa — chave ausente = não mexe.

```jsonc
{
  "local": "Bosque de Velmora",          // nome no Worldbuilding (Geografia)
  "dd2vtt": "D:\\...\\Bosque de Velmora.dd2vtt",  // opcional: troca imagem + geometria
  "maxLargura": 5000,                    // reduz a imagem antes de subir (recomendado)
  "metrosPorQuadro": 1.5,                // padrão do Dungeon Alchemist
  "ambiente": "noite",                   // "noite" | "dia"
  "luzAtiva": true,

  "npcs": [
    { "nome": "Nome exato do NPC", "quadro": [72, 64], "camada": "tokens" }  // ou "dm"
  ],

  "itens": [
    {
      "nome": "Baú de Carvalho", "quadro": [70, 62], "quantidade": 1, "fixo": true,
      "dentro": [
        { "nome": "Poção de Cura", "quantidade": 2 },
        { "nome": "Adaga Élfica" }
      ],
      "tranca": { "chave": "Chave Enferrujada", "consumo": "nao", "exibirChave": false },
      "notaSecreta": "só o mestre vê"
    }
  ],

  "aberturas": [                         // portas/janelas novas
    { "tipo": "janela", "de": [64, 59], "ate": [64, 60] },
    { "tipo": "porta",  "de": [72, 71], "ate": [73, 71],
      "tranca": { "tag": "chave-do-templo", "consumo": "sim" } }
  ],

  "luzes": [
    { "quadro": [72, 64], "alcance": 6, "cor": "#ffdd99", "animacao": "tocha" }  // ou "pulso"
  ],

  "converter": [                         // mexe na abertura mais próxima do ponto
    { "perto": [83, 64], "para": "janela" },
    { "perto": [64, 67], "para": "remover" }
  ]
}
```

Regras de substituição, para não apagar nada sem querer:

| chave no plano | efeito |
|---|---|
| `dd2vtt` | troca imagem, paredes, portas e luzes; **preserva** NPCs e itens já posicionados |
| `npcs` | substitui **todos** os tokens de NPC do mapa |
| `itens` | substitui **todos** os itens/baús do mapa |
| ausente | não toca naquilo |

Ou seja: para acrescentar um NPC a um mapa que já tem outros, liste **todos** eles em `npcs`.

## 4. Rodar em dry-run, mostrar, e só então gravar

```bash
node .claude/skills/editor-de-mapa-tatico/aplicar-mapa.mjs <plano.json>
```

O dry-run resolve todo mundo pelo nome, monta o `mapaTatico` inteiro e imprime o resultado —
sem escrever uma linha no banco. Mostre esse relatório ao usuário (posições, conteúdo do baú,
tranca, avisos) e **espere o ok**. Só então:

```bash
node .claude/skills/editor-de-mapa-tatico/aplicar-mapa.mjs <plano.json> --apply
```

## Notas

- **Vínculo do NPC.** O token só sobrevive se o NPC estiver em `linkedNpcs` da ficha do Local —
  o editor apaga token de NPC não vinculado toda vez que abre ([wb-mapa-local.js:90](../../../worldbuilding/js/wb-mapa-local.js#L90)).
  O script adiciona o vínculo sozinho quando falta, mas isso **mexe na ficha do Local**: avise antes.
- **Baú.** `dentro`, `tranca`, `fixo` e `notaSecreta` só valem em item com `ehContainer: true`
  no catálogo. Baú dentro de baú é recusado, igual ao Tabuleiro.
- **Tranca.** `chave` = nome de item do catálogo; `tag` = texto livre. `consumo`:
  `"nao"` | `"sim"` | `"chance"` (com `"chance": 1..100`).
- **UVTT não separa janela de porta.** Todo `portal` do `.dd2vtt` entra como porta — use
  `converter` para virar janela, parede ou sumir.
- **Peso da imagem.** O PNG embutido do Dungeon Alchemist passa fácil de 30 MB. Sempre ponha
  `maxLargura` (4000–6000 já é folgado para mesa) — cada jogador baixa esse arquivo na sessão.
- **`baked_lighting`.** Se o aviso aparecer, a luz já está pintada na imagem; para luz dinâmica
  limpa o usuário precisa reexportar no DA com *Lighting: "Only export lights to VTT"*.
- **Feche a ficha no navegador antes de aplicar.** A escrita é direta no Firestore; se o Local
  estiver aberto e o usuário salvar depois, a versão dele vence.
- **Parede à mão o script não faz** — desenhar contorno novo é trabalho do editor gráfico do site.
  O `.dd2vtt` já traz as paredes prontas; se precisar de uma parede inventada, mande o usuário
  desenhar no editor.
