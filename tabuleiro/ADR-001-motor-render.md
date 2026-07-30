# ADR-001 — Motor de render do Tabuleiro: Canvas 2D otimizado vs PIXI.js (WebGL)

**Status:** Aceito (FASE 1) · **Data:** 2026-07

## Contexto
O Tabuleiro (VTT) renderiza mapas grandes, dezenas de tokens, desenhos, fog e
iluminação dinâmica com raycasting. A avaliação pedia considerar migrar o motor
para PIXI.js (WebGL) caso o Canvas 2D não sustentasse 60fps.

## Decisão
**Manter Canvas 2D**, com as otimizações da FASE 1:
1. Culling por viewport (só desenha o que intersecta a tela);
2. Cache offscreen da camada estática (grid + mapa) — pan vira um único `drawImage`;
3. Fog com cache de polígonos — raycasting só roda quando paredes/portas/fontes mudam;
4. Raycasting por varredura de vértices (3 raios/vértice) + hash espacial de segmentos;
5. Mipmaps manuais para mapas >2MP + `imageSmoothingQuality: 'high'`.

Com isso, o custo por frame em uso típico (1 mapa 8k, ~40 tokens, ~200 desenhos,
fog ativo) cai para blits e strokes com culling — dentro do orçamento de 16ms.

## Justificativa
- O projeto é 100% ES modules servidos estaticamente (sem bundler). PIXI adicionaria
  ~450KB de dependência via CDN, um segundo pipeline de assets (texturas) e
  reescrita completa de `tab-render.js` (~600 linhas) e de todo o hit-testing.
- O gargalo real medido era (a) redesenhar o mapa inteiro a cada frame e
  (b) recalcular polígonos de visibilidade a cada frame — ambos resolvidos com cache,
  independentemente da API de desenho.
- Risco de regressão alto (fog usa `destination-out` + gradientes radiais, que em
  WebGL exigem shaders/máscaras próprios) sem ganho perceptível no cenário-alvo.

## Consequências / Critérios de reversão
Migrar para PIXI.js **se** qualquer um ocorrer:
- Frames > 16ms sustentados com as otimizações ativas em hardware mediano;
- Necessidade de efeitos por-pixel (luz colorida composta, sombras suaves reais);
- Adoção de bundler no projeto (viabiliza tree-shaking do PIXI).

### Caminho de migração (se necessário)
1. Isolar todo acesso a `ctx` atrás de uma interface `Renderer` (draw*, blit, fog);
2. Implementar `PixiRenderer` com `RenderTexture` para a camada estática e
   `Graphics` + máscara para o fog;
3. Manter o hit-testing atual (matemático, independente do renderer);
4. Feature-flag `?renderer=pixi` para rollout gradual.
