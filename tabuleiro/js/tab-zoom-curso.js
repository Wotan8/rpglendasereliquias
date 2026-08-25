/* TABULEIRO — o curso da barra de zoom
   ------------------------------------
   O zoom vai de 4% a 600%, e multiplicando: cada passo da roda multiplica por
   1,12. Numa barra LINEAR isso fica inútil — 100% cairia a 16% do curso, e a
   metade esquerda inteira serviria só para o intervalo de 4% a 30%. Em
   logaritmo, o mesmo pedaço de barra vale sempre a mesma PROPORÇÃO: ir de 25%
   para 50% custa o que custa ir de 200% para 400%.

   Mora separado de tab-tools.js porque é conta pura, e conta pura tem teste
   ao lado (tab-zoom-curso.test.mjs). */

export const ZOOM_MIN = 0.04, ZOOM_MAX = 6, CURSO_MAX = 1000;

const L0 = Math.log(ZOOM_MIN), LV = Math.log(ZOOM_MAX) - L0;

/** Zoom (0,04–6) → posição na barra (0–1000), inteira. */
export const zoomParaCurso = (z) => {
    const seguro = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(z) || ZOOM_MIN));
    return Math.round(((Math.log(seguro) - L0) / LV) * CURSO_MAX);
};

/** Posição na barra (0–1000) → zoom. */
export const cursoParaZoom = (v) => {
    const seguro = Math.min(CURSO_MAX, Math.max(0, Number(v) || 0));
    return Math.exp(L0 + (seguro / CURSO_MAX) * LV);
};
