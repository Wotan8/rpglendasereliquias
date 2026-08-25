import assert from 'node:assert';
import { zoomParaCurso, cursoParaZoom, ZOOM_MIN, ZOOM_MAX, CURSO_MAX }
    from './tab-zoom-curso.js';

// as pontas batem
assert.equal(zoomParaCurso(ZOOM_MIN), 0);
assert.equal(zoomParaCurso(ZOOM_MAX), CURSO_MAX);
assert.ok(Math.abs(cursoParaZoom(0) - ZOOM_MIN) < 1e-9);
assert.ok(Math.abs(cursoParaZoom(CURSO_MAX) - ZOOM_MAX) < 1e-9);

// ida e volta não escorrega
for (const z of [0.04, 0.1, 0.25, 0.5, 1, 1.5, 3, 6]) {
    assert.ok(Math.abs(cursoParaZoom(zoomParaCurso(z)) - z) < z * 0.01,
        `ida e volta perdeu ${z}`);
}

// o motivo de existir: o meio do curso é meio do ALCANCE, não (4%+600%)/2
const meio = cursoParaZoom(CURSO_MAX / 2);
assert.ok(meio > 0.3 && meio < 0.6, `meio do curso deu ${meio}, esperado ~0,49`);

// passos iguais na barra = razões iguais no zoom (é o que "logarítmico" quer dizer)
const r1 = cursoParaZoom(400) / cursoParaZoom(300);
const r2 = cursoParaZoom(800) / cursoParaZoom(700);
assert.ok(Math.abs(r1 - r2) < 1e-9, `razões diferentes: ${r1} vs ${r2}`);

// fora do alcance não vira NaN nem estoura a barra
assert.equal(zoomParaCurso(0), 0);
assert.equal(zoomParaCurso(99), CURSO_MAX);
assert.equal(zoomParaCurso('nada'), 0);
assert.ok(cursoParaZoom(-5) >= ZOOM_MIN && cursoParaZoom(9999) <= ZOOM_MAX);

console.log('ok — curso do zoom: pontas, ida e volta, meio do alcance e razões');
