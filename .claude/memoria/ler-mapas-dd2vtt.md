---
name: ler-mapas-dd2vtt
description: Como abrir e enxergar os mapas .dd2vtt do Dungeon Alchemist (imagem embutida + paredes/portas).
metadata: 
  node_type: memory
  type: reference
  originSessionId: a83c376e-e690-472e-aca0-bbbac589f358
  modified: 2026-08-01T22:09:17.680Z
---

Os mapas do Dungeon Alchemist ficam em `D:\Imagem\US - Universo Soberano\RPG\Reliera\10 🗃️ Anexos\Mapas\Mapa do Dungeon Alchemist\*.dd2vtt`.

`.dd2vtt` é JSON: `resolution` (map_size em quadros + pixels_per_grid), `line_of_sight` (paredes), `portals` (portas/vãos), `lights`, e `image` = PNG inteiro em base64.

Como ler (arquivo pode ter 40 MB+, não jogar inteiro no contexto):
1. `[IO.File]::ReadAllText($p)`, achar `"image"`, extrair o base64 e gravar como .png no scratchpad.
2. O PNG sai gigante (ex.: 15900x11850). Usar `System.Drawing` para gerar um panorama reduzido (~1500px) e depois recortes ampliados da região perguntada.
3. O trecho antes de `"image"` é a metadata — dá pra contar paredes/portas e localizar vãos em coordenadas de quadro.

A imagem embutida do Dungeon Alchemist é **JPEG** (`/9j/`), não PNG — código que assume PNG-ou-WEBP erra o content-type.

Com isso dá pra responder "o que tem na sala X" olhando o recorte. Ver [[mapa-de-mesa-uma-pagina]].
