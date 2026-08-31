/**
 * NPCs de Sereni · passada 4 — a perícia da arma que eles empunham.
 *
 * 24 fichas carregavam arma com a perícia dela em 0, porque o campo `skills`
 * legado nunca teve "Arma". O capitão da guarda acertava menos que o pastor.
 *
 * A escada sai do PAPEL, e é curta de propósito:
 *
 *     4  capitão, comandante, general
 *     3  guarda, soldado, guerreiro, mercenário, caçador, batedor, engenheiro militar
 *     2  quem trabalha com ferro, pedra ou faca o dia inteiro, e quem vive do
 *        Submundo — ferreiro, açougueiro, oleiro, corredor, executor, mestre de feira
 *     1  todo o resto. Adulto de vila carrega faca e sabe segurar; não sabe brigar.
 *
 * A perícia atribuída é a que a arma DELE usa — quem anda de besta ganha Disparo,
 * não Arma. Sai do próprio texto de ataque gravado na passada 3.
 *
 * Depois de atribuir, o texto do ataque é reescrito com o Alvo novo.
 *
 *   node functions/sereni-npcs-04-arma.mjs            (dry-run)
 *   node functions/sereni-npcs-04-arma.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';
const U = 3.90;

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const medio = d => { const m = /(\d+)d(\d+)/.exec(String(d)); return m ? Number(m[1]) * (Number(m[2]) + 1) / 2 : 0; };
const vg = n => n.toFixed(2).replace('.', ',');
const GRAUS = [[0.15, 'Inofensiva'], [0.35, 'Praga'], [0.75, 'Comum'], [1.5, 'Séria'], [3.0, 'Grave']];
const grauDe = x => (GRAUS.find(([t]) => x < t) || [null, 'Calamidade'])[1];

const nivelPorPapel = (txt) => {
    const t = norm(txt);
    if (/capit[ãa]o|comandante|general|pretorio/.test(t)) return 4;
    if (/guarda|soldado|guerreiro|combatente|mercenario|militar|executor|assassino|cacador|batedor|explorador|arqueiro|gladiador|tank|linha de frente|scutum/.test(t)) return 3;
    if (/ferreir|armeir|acougueir|oleir|artesao|artesa|pedreir|engenheir|corredor|ladino|submundo|mestre de feira|intermediario|fence|contra-informa/.test(t)) return 2;
    return 1;
};

const grab = async c => (await db.collection(c).get()).docs;
const [npcDocs, skDocs] = await Promise.all([grab('npcs'), grab('system/data/skills')]);
const skills = skDocs.map(d => ({ id: d.id, ...d.data() }));
const skPorNome = {}; for (const s of skills) skPorNome[norm(s.nome)] = s;

const alvos = npcDocs.filter(d => {
    const n = d.data();
    return /sereni/i.test(String(n.local || '')) && n.tipo !== 'criatura';
});

const plano = [];
for (const doc of alvos) {
    const n = doc.data();
    const a = n.atributos || {};
    const FOR = Number(a.FOR) || 0, DES = Number(a.DES) || 0;
    const linhas = String(n.ataques || '').split('\n').filter(Boolean);
    /* "Espada Longa (A. Padrão): Alvo 4, 1d8+4.   [Arma 0 + FOR/DES 4]" */
    const parsed = linhas.map(l => {
        const m = /^(.+?) \(A\. Padrão\): Alvo (\d+)(?: \(\+(\d+) Transbordo\))?, (\d+d\d+)\+(\d+)\.\s*\[(\w+) (\d+) \+ ([^\]]+)\]/.exec(l);
        return m ? { arma: m[1], dado: m[4], bonus: Number(m[5]), per: m[6], nivel: Number(m[7]), termo: m[8] } : null;
    }).filter(Boolean);
    if (!parsed.length) continue;
    const principal = parsed[0];
    if (principal.arma === 'Desarmado' || principal.nivel > 0) continue;

    const s = skPorNome[norm(principal.per)];
    if (!s) continue;
    const nivel = nivelPorPapel(`${n.papel} ${n.classe}`);
    const per = [...(n.periciasEstruturadas || []).filter(p => p.refId !== s.id), { refId: s.id, nivel }];

    /* reescreve o texto com o Alvo novo */
    const texto = parsed.map(p => {
        const usaEste = p.per === principal.per;
        const nv = usaEste ? nivel : p.nivel;
        const base = /DES (\d+)$/.test(p.termo) && !/FOR/.test(p.termo) ? DES : Math.max(FOR, DES);
        const cru = base + nv, alvo = Math.min(cru, 9);
        return `${p.arma} (A. Padrão): Alvo ${alvo}${cru > 9 ? ` (+${cru - 9} Transbordo)` : ''}, ${p.dado}+${p.bonus}.`
            + `   [${p.per} ${nv} + ${p.termo}]`;
    }).join('\n');

    const cru = Math.max(FOR, DES) + nivel;
    const alvoNovo = Math.min(/Disparo|Arremessar/.test(principal.per) ? DES + nivel : cru, 9);
    const P = Math.max(0, Math.min((alvoNovo - 1) / 10, 0.9));
    const x = P * Math.max(1, medio(principal.dado) + principal.bonus - 2) / U;
    const Pa = Math.max(0, Math.min((Math.min(Math.max(FOR, DES), 9) - 1) / 10, 0.9));
    const xAntes = Pa * Math.max(1, medio(principal.dado) + principal.bonus - 2) / U;

    plano.push({ ref: doc.ref, nome: n.nome, papel: n.papel || n.classe || '—',
        per: principal.per, nivel, arma: principal.arma,
        alvoAntes: Math.min(Math.max(FOR, DES), 9), alvoNovo, xAntes, x,
        grau: grauDe(x), pericias: per, texto });
}

/* ── relatório ── */
console.log(`\n=== Passada 4 · perícia da arma pelo papel (${plano.length} fichas) ===\n`);
console.log('nome                          papel                                    perícia      Alvo      força          grau');
for (const p of plano.sort((a, b) => b.nivel - a.nivel || b.x - a.x)) {
    console.log(`${p.nome.slice(0, 28).padEnd(29)} ${String(p.papel).slice(0, 38).padEnd(39)} ${(p.per + ' ' + p.nivel).padEnd(11)} ${String(p.alvoAntes).padStart(2)}→${String(p.alvoNovo).padStart(2)}   ${vg(p.xAntes)}× → ${vg(p.x)}×  ${p.grau}`);
}
console.log('\nExemplo do texto reescrito:\n');
for (const p of plano.slice(0, 2)) console.log(`   ── ${p.nome}\n${p.texto.split('\n').map(s => '      ' + s).join('\n')}\n`);
const conta = {}; for (const p of plano) conta[p.nivel] = (conta[p.nivel] || 0) + 1;
console.log(`   Distribuição: ${Object.entries(conta).sort((a, b) => b[0] - a[0]).map(([k, v]) => `nível ${k}: ${v}`).join(' · ')}`);

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const iso = new Date().toISOString();
const batch = db.batch();
for (const p of plano) batch.update(p.ref, {
    periciasEstruturadas: p.pericias, ataques: p.texto, lastUpdate: iso, lastUpdateBy: AUTOR });
await batch.commit();
console.log(`\n✅ ${plano.length} fichas com a perícia da própria arma.`);
process.exit(0);
