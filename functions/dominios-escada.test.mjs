/**
 * Regressão da escada de Domínio: cada nível soma +10 no Teto de Ofício.
 * Roda o simulador REAL do wizard contra os dados REAIS do Firestore.
 * node functions/dominios-escada.test.mjs
 */
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

const grab = async col => (await db.collection(`system/data/${col}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [derivedValues, mechanics, races, peculiarities, skills, vitalStats] = await Promise.all(
    ['derivedValues', 'mechanics', 'races', 'peculiarities', 'skills', 'vitalStats'].map(grab));

globalThis.window = {
    _systemData: { mechanics, races, classes: [], tribes: [], peculiarities },
    DERIVED_VALUES: derivedValues.filter(d => d.publicado !== false)
        .map(d => ({ id: d.id, key: d.key || d.id, nome: d.nome, mecanicaIds: d.mecanicaIds || [], campoAtual: !!d.campoAtual })),
    VITAL_STATS: vitalStats.filter(v => v.publicado !== false).map(v => ({ key: v.key || v.id, nome: v.nome, mecanicaIds: v.mecanicaIds || [] })),
    SKILLS: { todas: skills.map(s => ({ name: s.nome, key: s.key || s.id, mecanicaIds: s.mecanicaIds || [] })) },
    REGRAS_CRIACAO: { atributos: { base_inicial: 1 } },
    _adjustMechanicForLevel(m, level) {
        const prog = m.progressao?.[String(level)];
        if (!prog?.termos) return m;
        const out = JSON.parse(JSON.stringify(m));
        for (const c of out.config?.calculos || []) {
            let i = 0;
            for (const t of c.equacao || []) {
                if (!t.tipo || t.tipo === 'fixo') {
                    if (prog.termos[String(i)] !== undefined) t.valor = prog.termos[String(i)];
                    i++;
                }
            }
        }
        return out;
    },
};

const { simulateDerivedValues } = await import('../criar-personagem/js/mechanics-simulator.js');

/* FOR/DES/VIG/etc = 1 → o Teto base vale 1, então esperamos 1 + 10×nível. */
const rodar = (pecs) => {
    window.wizardState = {
        racaSelecionada: 'Humano',
        atributos: { attr_for: 1, attr_des: 1, attr_vig: 1, attr_int: 1, attr_rac: 1, attr_prs: 1, attr_pre: 1, attr_man: 1, attr_aut: 1 },
        pericias: {},
        peculiaridadesIndividuais: pecs,
    };
    return simulateDerivedValues();
};

const dvPorNome = n => window.DERIVED_VALUES.find(d => d.nome === n);
const pecPorNome = n => peculiarities.find(p => p.nome === n);

const CASOS = [
    ['Domínio de Armas de Braço', 'Teto de Ofício: Braço'],
    ['Domínio de Disparo', 'Teto de Ofício: Disparo'],
    ['Domínio de Armas de Precisão', 'Teto de Ofício: Precisão'],
    ['Domínio de Proteção', 'Teto de Ofício: Proteção'],
    ['Domínio de Necromancia', 'Teto de Ofício: Necromancia'],
    ['Domínio de Sonoromancia', 'Teto de Ofício: Sonoromancia'],
    ['Domínio de Abismancia', 'Teto de Ofício: Abismancia'],
    ['Domínio de Pallomancia', 'Teto de Ofício: Pallomancia'],
    ['Domínio de Runomancia', 'Teto de Ofício: Runomancia'],
    ['Domínio de Totemancia', 'Teto de Ofício: Totemancia'],
];

let falhas = 0;
for (const [nomePec, nomeDV] of CASOS) {
    const pec = pecPorNome(nomePec), dv = dvPorNome(nomeDV);
    assert.ok(pec, `peculiaridade "${nomePec}" sumiu do banco`);
    assert.ok(dv, `valor derivado "${nomeDV}" sumiu do banco`);

    const base = rodar([])[dv.id];
    const lidos = [1, 2, 3].map(nv => rodar([{ id: pec.id, nivel: nv }])[dv.id]);
    const esperados = [1, 2, 3].map(nv => base + 10 * nv);

    const ok = lidos.every((v, i) => v === esperados[i]);
    if (!ok) falhas++;
    console.log(`${ok ? '✅' : '❌'} ${nomePec.padEnd(30)} base=${base}  Nv1/2/3 = ${lidos.join(' / ')}${ok ? '' : `  (esperava ${esperados.join(' / ')})`}`);
}

assert.equal(falhas, 0, `${falhas} Domínio(s) com escada errada`);
console.log(`\n✅ ${CASOS.length} Domínios: cada nível soma exatamente +10 no seu Teto.`);

/* As duas pontas: a mecânica calcular não basta — se a peculiaridade não declara
   o Teto em derivedValueIds e o VD não é todoPersonagem, o campo não aparece na
   ficha e o jogador não vê o próprio limite. Foi o bug do Caolho. */
for (const [nomePec, nomeDV] of CASOS) {
    const pec = pecPorNome(nomePec), dv = dvPorNome(nomeDV);
    const declarados = (pec.derivedValueIds || []).map(x => typeof x === 'object' ? x.id : x);
    const visivel = declarados.includes(dv.id) || dv.todoPersonagem;
    assert.ok(visivel, `"${nomePec}" não declara "${nomeDV}" em derivedValueIds e o VD não é universal — o campo some da ficha`);
}
console.log(`✅ ${CASOS.length} Domínios: cada um declara o seu Teto, o campo aparece na ficha.`);
process.exit(0);
