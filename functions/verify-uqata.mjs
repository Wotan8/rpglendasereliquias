/**
 * Roda o simulador REAL do wizard contra os dados REAIS do Firestore e confere
 * se a tribo Uqatá está entregando o que foi arquitetado.
 * node functions/verify-uqata.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

const grab = async col => (await db.collection(`system/data/${col}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [derivedValues, mechanics, races, classes, tribes, peculiarities, skills, vitalStats] = await Promise.all(
    ['derivedValues', 'mechanics', 'races', 'classes', 'tribes', 'peculiarities', 'skills', 'vitalStats'].map(grab));

globalThis.window = {
    _systemData: { mechanics, races, classes, tribes, peculiarities },
    DERIVED_VALUES: derivedValues.filter(d => d.publicado !== false)
        .map(d => ({ id: d.id, key: d.key || d.id, nome: d.nome, mecanicaIds: d.mecanicaIds || [], campoAtual: !!d.campoAtual })),
    VITAL_STATS: vitalStats.filter(v => v.publicado !== false).map(v => ({ key: v.key || v.id, nome: v.nome, mecanicaIds: v.mecanicaIds || [] })),
    // MESMA transformação de key do loader real (system-data-loader.js:361):
    // key vem do nome normalizado quando o registro não tem `key`.
    SKILLS: {
        todas: skills.filter(s => s.publicado !== false).map(s => ({
            name: s.nome,
            key: (s.key || s.nome || '').toLowerCase()
                .normalize('NFD').replace(/[̀-ͯ]/g, '')
                .replace(/[^a-z0-9]/g, '_'),
            mecanicaIds: s.mecanicaIds || [],
        })),
    },
    REGRAS_CRIACAO: { atributos: { base_inicial: 1 } },
    _adjustMechanicForLevel: m => m,
};

const { simulateDerivedValues } = await import('../criar-personagem/js/mechanics-simulator.js');
const dvId = nome => window.DERIVED_VALUES.find(d => d.nome === nome)?.id;

const ATTRS = { attr_for: 3, attr_des: 2, attr_vig: 2, attr_int: 1, attr_rac: 1, attr_prs: 1, attr_pre: 1, attr_man: 1, attr_aut: 1 };
const rodar = (tribo, impeto) => {
    window.wizardState = {
        racaSelecionada: 'Humano', classeSelecionada: 'Guerreiro', triboSelecionada: tribo,
        atributos: { ...ATTRS },
        pericias: { sk_impeto: impeto },
        peculiaridadesIndividuais: [],
    };
    return simulateDerivedValues();
};

console.log('Cenário: Humano/Guerreiro, FOR 3 (1 base + 2).  Dano base = FOR.\n');
for (const [tribo, imp] of [[null, 0], ['Uqatá', 0], ['Uqatá', 3]]) {
    const r = rodar(tribo, imp);
    console.log(`  tribo=${String(tribo).padEnd(12)} Ímpeto=${imp}  ->  Dano = ${r[dvId('Dano')]}`);
}

console.log('\n=== ESTADO DA TRIBO NO BANCO ===');
const uq = tribes.find(t => t.nome === 'Uqatá');
console.log(`  publicado: ${uq.publicado}`);
for (const pid of uq.peculiaridadeIds || []) {
    const p = peculiarities.find(x => x.id === pid);
    const mecs = (p.mecanicaIds || []).map(m => mechanics.find(x => x.id === m)).filter(Boolean);
    console.log(`  • ${p.nome}  [pub=${p.publicado}]`);
    for (const m of mecs) console.log(`      ${m.tipo.padEnd(11)} ${m.nome}  -> ${m.previewTexto || ''}`);
    const faltando = (p.mecanicaIds || []).length - mecs.length;
    if (faltando) console.log(`      ⚠️ ${faltando} mecânica(s) referenciada(s) mas inexistente(s)`);
}
process.exit();
