// Rodar: node tabuleiro/js/tab-write-queue.test.mjs
// A regressão que este teste tranca: o write FINAL do fim do arrasto sendo
// atropelado por um write pendente do meio do arrasto (token tremia e voltava).
import assert from 'node:assert/strict';
import { criarFilaDeEscrita } from './tab-write-queue.js';

/** Relógio + agenda falsos: nada de esperar de verdade. */
function bancada() {
    let t = 0;
    const timers = new Map();
    let seq = 0;
    const gravado = [];
    const fila = criarFilaDeEscrita({
        write: (id, patch) => gravado.push({ t, id, ...patch }),
        agora: () => t,
        agendar: (fn, ms) => { const k = ++seq; timers.set(k, { fn, quando: t + ms }); return k; },
        cancelar: (k) => timers.delete(k),
    });
    return {
        fila, gravado,
        avancar(ms) {
            const alvo = t + ms;
            // dispara na ordem cronológica, como o event loop faria
            for (;;) {
                const proximo = [...timers.entries()].filter(([, x]) => x.quando <= alvo).sort((a, b) => a[1].quando - b[1].quando)[0];
                if (!proximo) break;
                t = proximo[1].quando;
                timers.delete(proximo[0]);
                proximo[1].fn();
            }
            t = alvo;
        },
        get agora() { return t; },
    };
}

// =====================================================================
// 🔴 O BUG: final sem throttle não podia ser atropelado pelo pendente
// =====================================================================
{
    const b = bancada();
    b.fila.enviar('tk', { x: 0 }, 100);      // t=0  → grava já
    b.avancar(50);
    b.fila.enviar('tk', { x: 50 }, 100);     // t=50 → agenda p/ t=100
    assert.deepEqual(b.fila.pendentes(), ['tk'], 'ficou um write agendado');
    b.avancar(10);
    b.fila.enviar('tk', { x: 999 }, 0);      // t=60 → FIM do arrasto: grava já
    assert.deepEqual(b.fila.pendentes(), [], 'o final descarta o pendente');
    b.avancar(500);                          // deixa qualquer timer velho estourar

    assert.deepEqual(b.gravado.map(g => g.x), [0, 999],
        'o intermediário (50) morreu; a última gravação é a posição final');
    assert.equal(b.gravado.at(-1).x, 999, 'o objeto termina onde foi solto');
}

// =====================================================================
// O throttle continua fazendo o serviço dele: agrupar o arrasto
// =====================================================================
{
    const b = bancada();
    b.fila.enviar('tk', { x: 1 }, 100);   // grava (t=0)
    b.avancar(10); b.fila.enviar('tk', { x: 2 }, 100);
    b.avancar(10); b.fila.enviar('tk', { x: 3 }, 100);
    b.avancar(10); b.fila.enviar('tk', { x: 4 }, 100);
    assert.deepEqual(b.gravado.map(g => g.x), [1], 'no meio da janela não grava');
    b.avancar(200);
    assert.deepEqual(b.gravado.map(g => g.x), [1, 4], 'ao fim da janela grava só o MAIS NOVO');
}

// Writes espaçados além da janela passam direto, um a um
{
    const b = bancada();
    b.fila.enviar('tk', { x: 1 }, 100);
    b.avancar(150); b.fila.enviar('tk', { x: 2 }, 100);
    b.avancar(150); b.fila.enviar('tk', { x: 3 }, 100);
    assert.deepEqual(b.gravado.map(g => g.x), [1, 2, 3]);
    assert.deepEqual(b.fila.pendentes(), [], 'nada pendente');
}

// =====================================================================
// Um objeto não interfere no outro (o arrasto em grupo depende disso)
// =====================================================================
{
    const b = bancada();
    b.fila.enviar('a', { x: 1 }, 100);
    b.fila.enviar('b', { x: 1 }, 100);
    b.avancar(20);
    b.fila.enviar('a', { x: 2 }, 100);
    b.fila.enviar('b', { x: 2 }, 100);
    b.fila.enviar('a', { x: 3 }, 0);       // 'a' finaliza; 'b' segue pendente
    assert.deepEqual(b.fila.pendentes(), ['b'], 'só o pendente de b sobrou');
    b.avancar(300);
    assert.deepEqual(b.gravado.filter(g => g.id === 'a').map(g => g.x), [1, 3], 'a: sem intermediário');
    assert.deepEqual(b.gravado.filter(g => g.id === 'b').map(g => g.x), [1, 2], 'b: agrupado normalmente');
}

// Write único sem throttle grava na hora
{
    const b = bancada();
    b.fila.enviar('x', { cor: '#fff' }, 0);
    assert.equal(b.gravado.length, 1);
    assert.deepEqual(b.fila.pendentes(), []);
}

console.log('✅ tab-write-queue: final do arrasto nunca é atropelado; throttle agrupa e isola por objeto');
