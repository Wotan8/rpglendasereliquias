// Rodar: node shared/marca-de-caca.test.mjs
// Vireu, a Contadora, marca uma presa e passa a acertar e machucar mais ELA.
// O bônus é do caçador, não do alvo: outro atirador não herda a marca.
import assert from 'node:assert/strict';
import { bonusDoAtaque, bonusDaPresa, presaDe, TETO_PRESA } from './marca-de-caca.js';

const VIREU = 'p_vireu', UMBE = 'p_umbe', LOBO = 'p_lobo', URSO = 'p_urso';
const marcadoPor = pid => [{ nome: 'Presa', icone: '🎯', porPid: pid }];

/* ═══ o caso normal: um tiro, uma presa ═══ */
const um = bonusDoAtaque([{ pid: LOBO, condicoes: marcadoPor(VIREU) }],
    { cacadorPid: VIREU, marcaDeCaca: 3 });
assert.equal(um.acerto, 3, 'alvo único e marcado: a rolagem inteira ganha');
assert.deepEqual(um.danoPorPid, { [LOBO]: 3 });
assert.equal(um.presaPid, LOBO);

/* ═══ a marca é de quem marcou ═══ */
// Umbe atira na presa da Vireu: não ganha nada.
assert.deepEqual(bonusDoAtaque([{ pid: LOBO, condicoes: marcadoPor(VIREU) }],
    { cacadorPid: UMBE, marcaDeCaca: 3 }),
    { acerto: 0, danoPorPid: {}, presaPid: null });

// Alvo sem marca nenhuma.
assert.equal(bonusDoAtaque([{ pid: LOBO, condicoes: [] }],
    { cacadorPid: VIREU, marcaDeCaca: 3 }).acerto, 0);

/* ═══ o furo da área ═══ */
// O dado do Acerto é UM para o ataque todo. Numa área que pega a presa e mais
// um, somar a marca na rolagem daria bônus contra quem não foi marcado.
const area = bonusDoAtaque([
    { pid: LOBO, condicoes: marcadoPor(VIREU) },
    { pid: URSO, condicoes: [] },
], { cacadorPid: VIREU, marcaDeCaca: 3 });
assert.equal(area.acerto, 0, 'área com alvo não-marcado: sem bônus na rolagem');
assert.deepEqual(area.danoPorPid, { [LOBO]: 3 }, 'mas o dano é por alvo — só a presa leva');

/* ═══ o teto é o que segura a régua ═══ */
assert.equal(bonusDaPresa(9), TETO_PRESA, 'Marca alta bate no teto padrão');
assert.equal(bonusDaPresa(9, 4), 4, 'teto do cadastro manda');
assert.equal(bonusDaPresa(2, 4), 2, 'abaixo do teto vale o valor cheio');
assert.equal(bonusDoAtaque([{ pid: LOBO, condicoes: marcadoPor(VIREU) }],
    { cacadorPid: VIREU, marcaDeCaca: 99, teto: 3 }).acerto, 3);

/* ═══ bordas ═══ */
assert.equal(bonusDaPresa(0), 0, 'sem Marca de Caça não há bônus');
assert.equal(bonusDaPresa(-5), 0, 'valor negativo não vira penalidade nem crédito');
assert.equal(bonusDaPresa(2.7), 2, 'fração arredonda para baixo');
assert.equal(bonusDaPresa(null), 0);
assert.equal(bonusDoAtaque([], { cacadorPid: VIREU, marcaDeCaca: 3 }).acerto, 0);
assert.equal(bonusDoAtaque(null, { cacadorPid: VIREU, marcaDeCaca: 3 }).acerto, 0);
assert.equal(bonusDoAtaque([{ pid: LOBO, condicoes: marcadoPor(VIREU) }], {}).acerto, 0,
    'sem caçador identificado não há marca a cobrar');

// condição em texto legado ("Presa" como string) não carrega quem marcou
assert.equal(presaDe(['Presa'], VIREU), null, 'string legada não vira marca de ninguém');
assert.equal(presaDe(marcadoPor(VIREU), VIREU)?.nome, 'Presa');
assert.equal(presaDe(marcadoPor(VIREU), null), null);

console.log('✅ marca-de-caca: presa própria, marca alheia ignorada, furo da área fechado, teto e bordas OK');
