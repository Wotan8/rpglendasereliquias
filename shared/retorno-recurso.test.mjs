// Rodar: node shared/retorno-recurso.test.mjs
// A regra do Bardo, dita pelo mestre: no fim do turno ele recupera em Harmonia
// o mesmo que gastou para conjurar; +1 se ficou parado; e se falhou no teste,
// a música quebra e a Harmonia acumulada vai a zero.
import assert from 'node:assert/strict';
import { retornoDoTurno } from './retorno-recurso.js';

const BARDO = {
    retornoRecurso: 'Harmonia',
    retornoBonusParado: 1,
    retornoExigeSucesso: true,
    retornoZeraSeFalhar: true,
};

/* ═══ o caso do Bardo, os três desfechos ═══ */
// gastou 3, ficou parado, acertou → 3 + 1
assert.deepEqual(retornoDoTurno(BARDO, { gastou: 3, parado: true, falhou: false }),
    { ganho: 4, zera: false, motivo: '3 gasto +1 parado' });

// gastou 3, andou, acertou → só os 3
assert.equal(retornoDoTurno(BARDO, { gastou: 3, parado: false, falhou: false }).ganho, 3);

// falhou → nada, e zera o que tinha
assert.deepEqual(retornoDoTurno(BARDO, { gastou: 3, parado: true, falhou: true }),
    { ganho: 0, zera: true, motivo: 'falhou — Harmonia zerada' });

/* ═══ o furo que o +1 abriria ═══ */
// Turno sem conjurar nenhuma: não ganha o +1 de graça só por ficar parado.
assert.equal(retornoDoTurno(BARDO, { gastou: 0, parado: true, falhou: false }).ganho, 0,
    'sem gastar não houve música — parado não vale +1 sozinho');

/* ═══ o bônus é fixo, não escala com o gasto ═══ */
assert.equal(retornoDoTurno(BARDO, { gastou: 10, parado: true, falhou: false }).ganho, 11);

/* ═══ classe sem retorno cadastrado nunca é tocada ═══ */
assert.deepEqual(retornoDoTurno({}, { gastou: 5, parado: true, falhou: true }),
    { ganho: 0, zera: false, motivo: '' }, 'sem recurso configurado o motor não mexe em nada');
assert.equal(retornoDoTurno(null, { gastou: 5, parado: true }).ganho, 0);
assert.equal(retornoDoTurno({ retornoRecurso: '  ' }, { gastou: 5 }).ganho, 0, 'campo em branco = desligado');

/* ═══ falhar sem zerar: outra classe pode só perder o retorno ═══ */
const SEM_ZERAR = { ...BARDO, retornoZeraSeFalhar: false };
assert.deepEqual(retornoDoTurno(SEM_ZERAR, { gastou: 3, parado: true, falhou: true }),
    { ganho: 0, zera: false, motivo: 'falhou — sem retorno' });

/* ═══ classe sem bônus de imobilidade ═══ */
const SEM_BONUS = { retornoRecurso: 'Graça', retornoBonusParado: 0 };
assert.equal(retornoDoTurno(SEM_BONUS, { gastou: 2, parado: true, falhou: false }).ganho, 2);
assert.equal(retornoDoTurno(SEM_BONUS, { gastou: 2, parado: false, falhou: false }).ganho, 2);

/* ═══ bordas ═══ */
assert.equal(retornoDoTurno(BARDO, {}).ganho, 0, 'turno vazio não inventa ganho');
assert.equal(retornoDoTurno(BARDO, { gastou: -5, parado: true }).ganho, 0, 'gasto negativo não vira crédito');
assert.equal(retornoDoTurno(BARDO, { gastou: '3', parado: true }).ganho, 4, 'aceita número vindo como texto');

console.log('✅ retorno-recurso: Bardo parado/andando/falhando, +1 fixo, turno sem conjurar e classe sem cadastro OK');
