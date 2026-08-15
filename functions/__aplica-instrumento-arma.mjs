/**
 * 🎻 INSTRUMENTO COMO FORMA DE ATAQUE.
 *
 * O que a mesa viu: a Vespa com a Rabeca empunhada na Mão 1, e a lista
 * ⚔️ ATAQUES só com o Estilete e os golpes desarmados. Causa — um item vira
 * linha de ataque quando tem fórmula de dano ou alimenta alguma coluna de
 * acerto (tab-ficha-win.js), e nenhum dos 11 instrumentos do catálogo tinha
 * fórmula nem vínculo. Faltava CADASTRO, não motor.
 *
 * Este script põe nos instrumentos o MESMO molde das armas, trocando só os
 * dois Valores Derivados, como pedido:
 *
 *   arma       →  Acerto Corpo a Corpo  +  Dano
 *   instrumento→  Acerto Mágico         +  Dano Eólico
 *
 * A equação do dano é a das armas, peça por peça:
 *   Item: Qualidade + Item: Afiação (min Teto de Ofício: Sonoromancia) + PRE
 * e a do acerto é atributo + a perícia da FAMÍLIA — que já existe no registro:
 * Inst. de Corda, Inst. de Sopro, Inst. de Percussão.
 *
 * 🎲 Dados por família (percussão bate mais que corda, e a régua já tem esses
 * degraus: 1d4 é a Adaga, 1d6 a Espada Curta):
 *   Percussão 1d6 · Sopro 1d4 · Corda 1d4
 * Mudar isto é mudar a constante DADO abaixo e rodar de novo.
 *
 * 🛡️ O dano é canal EÓLICO (Dano Eólico tem escopoItem "dano-canal"), então
 * quem barra é a Blindagem Eólica do alvo, não a física. Por isso os
 * instrumentos NÃO recebem tipoGolpe: som não corta, não perfura e não esmaga.
 *
 * Mantém `tipo: 'Objeto'` de propósito: virar `Arma` forçaria categoria de
 * arma obrigatória em todo formulário e travaria a pilha em 1. O que faz a
 * linha de ataque aparecer é a fórmula de dano, não o tipo.
 *
 *   node functions/__aplica-instrumento-arma.mjs           (só mostra)
 *   node functions/__aplica-instrumento-arma.mjs --apply   (grava)
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const VD_ACERTO_MAGICO = '2XFDxbiiu22nJ76qrOzd';
const VD_DANO_EOLICO   = 'SNkuKK3K3HD0RbxkalhH';

/** Dado, perícia e atributo por família. A tag do item diz qual é. */
const FAMILIA = {
    corda:     { dado: '1d4', pericia: 'Perícia: Inst. de Corda',     atributo: 'DES' },
    sopro:     { dado: '1d4', pericia: 'Perícia: Inst. de Sopro',     atributo: 'DES' },
    percussao: { dado: '1d6', pericia: 'Perícia: Inst. de Percussão', atributo: 'FOR' },
};
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const familiaDe = (tags) => {
    for (const t of tags || []) {
        const n = norm(t);
        if (FAMILIA[n]) return n;
    }
    return null;
};

const snap = await db.collection('system/data/equipment').get();
const alvos = snap.docs
    .map(d => ({ id: d.id, ref: d.ref, ...d.data() }))
    .filter(e => (e.tags || []).some(t => norm(t) === 'instrumento'));

console.log(`\n🎻 ${alvos.length} instrumento(s) no catálogo\n`);
const backup = [];
let gravados = 0, pulados = 0;

for (const e of alvos) {
    const fam = familiaDe(e.tags);
    if (!fam) { console.log(`  ⏭️  ${e.nome}: sem tag de família (Corda/Sopro/Percussão) — pulo`); pulados++; continue; }
    const F = FAMILIA[fam];

    // Vínculos que NÃO são os dois nossos ficam como estão.
    const outros = (e.valoresDerivadosVinculados || [])
        .filter(v => v.id !== VD_ACERTO_MAGICO && v.id !== VD_DANO_EOLICO);
    const vincs = [
        ...outros,
        { id: VD_ACERTO_MAGICO, equacao: [
            { tipo: 'ficha', ref: F.atributo },
            { op: '+', tipo: 'ficha', ref: F.pericia },
        ] },
        { id: VD_DANO_EOLICO, equacao: [
            { tipo: 'ficha', ref: 'Item: Qualidade' },
            { op: '+', tipo: 'ficha', ref: 'Item: Afiação' },
            { op: 'min', tipo: 'ficha', ref: 'Teto de Ofício: Sonoromancia' },
            { op: '+', tipo: 'ficha', ref: 'PRE' },
        ] },
    ];

    const patch = {
        formulaDano: F.dado,
        // Som não corta nem esmaga: o canal é Eólico, barrado pela Blindagem Eólica.
        tipoGolpe: [],
        // Peça que aplica efeito é EMPUNHAR — "Segurar" desliga todo vínculo.
        formaEquipar: 'empunhar',
        valoresDerivadosVinculados: vincs,
    };

    console.log(`  🎵 ${String(e.nome).padEnd(24)} [${fam}] dano=${F.dado} · acerto=${F.atributo} + ${F.pericia}`);
    if (e.formaEquipar && e.formaEquipar !== 'empunhar') console.log(`     ↳ forma de equipar "${e.formaEquipar}" → "empunhar" (Segurar não aplica efeito)`);
    if (e.formulaDano) console.log(`     ↳ ⚠️ já tinha dano "${e.formulaDano}" — sobrescrevo com ${F.dado}`);

    backup.push({ id: e.id, nome: e.nome, formulaDano: e.formulaDano ?? null, tipoGolpe: e.tipoGolpe ?? null,
        formaEquipar: e.formaEquipar ?? null, valoresDerivadosVinculados: e.valoresDerivadosVinculados ?? null });

    if (APLICAR) await e.ref.update(patch);
    gravados++;
}

if (backup.length) writeFileSync('functions/_backup-instrumentos.json', JSON.stringify(backup, null, 2));
console.log(`\n${APLICAR ? 'GRAVADO' : 'SIMULAÇÃO (rode com --apply para gravar)'} — ${gravados} instrumento(s), ${pulados} pulado(s)`);
console.log('Backup do estado anterior: functions/_backup-instrumentos.json');
process.exit(0);
