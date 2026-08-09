/**
 * Passo 7 — campos tipados nos itens de módulo de classe.
 *
 * Hoje alcance, área, alvos e duração vivem dentro de prosa em textarea. Isso
 * obriga régua e Tabuleiro a adivinhar por regex, e foi a origem de quatro bugs
 * de medição seguidos. Estes campos passam a existir de verdade.
 *
 * Moram FORA de `valores`, como irmãos de `custoExpProprio` e `custoEquipamentos`
 * — que já vivem lá. Renderer, ficha e mesa não mudam; a régua e o Tabuleiro
 * passam a ler direto. Campo ausente cai no comportamento de hoje.
 *
 *   alcance        número, metros
 *   formaArea      nenhuma | circulo | cone | linha | adjacentes | zona
 *   tamanhoArea    número, metros (raio, comprimento do cone, lado da zona)
 *   alvosMax       número — só quando o texto declara ("até 2 alvos"); com área
 *                  preenchida fica null, porque quem decide é o desenho na mesa
 *   duracaoValor   número
 *   duracaoUnidade instantaneo | turno | cena | dia | permanente | sustentada
 *
 * "sustentada" é categoria própria: "enquanto tocar" custa uma ação por turno
 * para manter, e isso não é a mesma coisa que "1 cena".
 *
 *   node functions/soquete-7-campos-tipados.mjs            (dry-run)
 *   node functions/soquete-7-campos-tipados.mjs --apply
 *   node functions/soquete-7-campos-tipados.mjs --faltas   (só o que não extraiu)
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

/* ═══ EXTRAÇÃO ═══ */

export function extrairArea(txt) {
    const s = String(txt || '');
    let m;
    if ((m = /cone de (?:\()?([\d,.]+)/i.exec(s)))        return { formaArea: 'cone', tamanhoArea: num(m[1]) };
    if ((m = /explos[ãa]o de ([\d,.]+)\s*m/i.exec(s)))    return { formaArea: 'circulo', tamanhoArea: num(m[1]) };
    if ((m = /(?:raio|c[íi]rculo) de ([\d,.]+)\s*m/i.exec(s))) return { formaArea: 'circulo', tamanhoArea: num(m[1]) };
    if ((m = /num? raio de ([\d,.]+)\s*m/i.exec(s)))      return { formaArea: 'circulo', tamanhoArea: num(m[1]) };
    if ((m = /zona de ([\d,.]+)\s*m/i.exec(s)))           return { formaArea: 'zona', tamanhoArea: num(m[1]) };
    if ((m = /barreira \w+ de ([\d,.]+)\s*m/i.exec(s)))   return { formaArea: 'zona', tamanhoArea: num(m[1]) };
    if (/adjacent/i.test(s))                              return { formaArea: 'adjacentes', tamanhoArea: null };
    /* "Aliados em 6m" / "Inimigos em 8m" — plural + distância é área circular. */
    if ((m = /(?:aliados|inimigos)\s+(?:em|a|num)\s+(?:at[ée]\s+)?([\d,.]+)\s*m/i.exec(s)))
        return { formaArea: 'circulo', tamanhoArea: num(m[1]) };
    return { formaArea: 'nenhuma', tamanhoArea: null };
}

export function extrairAlcance(txt) {
    const s = String(txt || '');
    let m;
    if ((m = /alcance\s+(?:de\s+)?([\d,.]+)\s*m/i.exec(s))) return num(m[1]);
    /* "1 aliado a 6m", "1 inimigo a 6m", "alvo a 6m" */
    if ((m = /\b(?:aliado|inimigo|alvo|alvos)\s+(?:em|a|num)\s+(?:at[ée]\s+)?([\d,.]+)\s*m/i.exec(s))) return num(m[1]);
    if ((m = /\bat[ée]\s+([\d,.]+)\s*m\b/i.exec(s))) return num(m[1]);
    return null;
}

export function extrairAlvos(txt) {
    const m = /at[ée]\s+(\d+)\s+alvos?/i.exec(String(txt || ''));
    if (m) return +m[1];
    if (/\b1\s+(?:aliado|inimigo|alvo)\b/i.test(String(txt || ''))) return 1;
    return null;
}

export function extrairDuracao(txt) {
    const s = String(txt || '').toLowerCase().trim();
    if (!s) return { duracaoValor: null, duracaoUnidade: null };
    if (/instant[âa]neo/.test(s))                    return { duracaoValor: 0, duracaoUnidade: 'instantaneo' };
    if (/permanente|at[ée] remover/.test(s))         return { duracaoValor: null, duracaoUnidade: 'permanente' };
    if (/enquanto (tocar|mantiver|durar)|manter ritmo|sustentad/.test(s)) return { duracaoValor: 1, duracaoUnidade: 'sustentada' };
    if (/cena/.test(s))                              return { duracaoValor: 1, duracaoUnidade: 'cena' };
    let m;
    if ((m = /(\d+)\s*dias?/.exec(s)))               return { duracaoValor: +m[1], duracaoUnidade: 'dia' };
    if ((m = /(\d+)\s*(?:turnos?|rodadas?)/.exec(s))) return { duracaoValor: +m[1], duracaoUnidade: 'turno' };
    if (/graus? de sucesso\s*=\s*(turnos|rodadas)|por grau/.test(s)) return { duracaoValor: null, duracaoUnidade: 'turno' };
    return { duracaoValor: null, duracaoUnidade: null };
}

const num = v => parseFloat(String(v).replace(',', '.'));

/* ═══ ASSERTS ═══ */
assert.deepEqual(extrairArea('Cone de 3m: 1 de dano sônico'), { formaArea: 'cone', tamanhoArea: 3 });
assert.deepEqual(extrairArea('Explosão de 5m: dano de impacto'), { formaArea: 'circulo', tamanhoArea: 5 });
assert.deepEqual(extrairArea('Aliados em 6m ganham +1 no Alvo'), { formaArea: 'circulo', tamanhoArea: 6 });
assert.deepEqual(extrairArea('Cria uma zona de 3m sem som'), { formaArea: 'zona', tamanhoArea: 3 });
assert.deepEqual(extrairArea('Ataca todos os inimigos adjacentes'), { formaArea: 'adjacentes', tamanhoArea: null });
assert.equal(extrairArea('1 inimigo recebe -2 no Alvo').formaArea, 'nenhuma');
assert.equal(extrairAlcance('1 aliado a 6m recupera 1 Energia'), 6);
assert.equal(extrairAlcance('Alcance 15m'), 15);
assert.equal(extrairAlcance('sem distância nenhuma'), null);
assert.equal(extrairAlvos('Até 2 alvos em 6m'), 2);
assert.equal(extrairAlvos('1 inimigo recebe -2'), 1);
assert.deepEqual(extrairDuracao('1 cena'), { duracaoValor: 1, duracaoUnidade: 'cena' });
assert.deepEqual(extrairDuracao('Enquanto tocar'), { duracaoValor: 1, duracaoUnidade: 'sustentada' });
assert.deepEqual(extrairDuracao('1 cena (manter ritmo)'), { duracaoValor: 1, duracaoUnidade: 'sustentada' });
assert.deepEqual(extrairDuracao('Instantâneo'), { duracaoValor: 0, duracaoUnidade: 'instantaneo' });
assert.deepEqual(extrairDuracao('3 turnos'), { duracaoValor: 3, duracaoUnidade: 'turno' });
assert.deepEqual(extrairDuracao(''), { duracaoValor: null, duracaoUnidade: null });
console.log('✅ 17 asserts passaram.\n');

/* ═══ LEITURA E PLANO ═══ */
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const SO_FALTAS = process.argv.includes('--faltas');

const col = db.collection('system/data/classModules');
const mods = (await col.get()).docs.map(d => ({ id: d.id, ...d.data() }));

let total = 0, comArea = 0, comAlcance = 0, comDuracao = 0;
const faltas = [];
for (const m of mods) {
    const lbl = Object.fromEntries((m.schema || []).map(f => [f.key, String(f.label || '')]));
    const kEfeito = Object.keys(lbl).find(k => /efeito|o que faz/i.test(lbl[k]));
    const kDur = Object.keys(lbl).find(k => /dura|alcance/i.test(lbl[k]));
    let mexeu = false;
    const itens = (m.itensPredefinidos || []).map(it => {
        const v = it.valores || {};
        const texto = [String(it.descricao || ''), String(v[kEfeito] || '')]
            .filter(Boolean).reduce((a, b) => (a.includes(b) || b.includes(a) ? (a.length >= b.length ? a : b) : a + ' ' + b), '');
        const durTxt = String(v[kDur] || '') || texto;

        const area = extrairArea(texto);
        const alcance = extrairAlcance(texto) ?? extrairAlcance(String(v[kDur] || ''));
        const dur = extrairDuracao(durTxt);
        /* alvosMax só quando o texto declara. Com área, quem decide é o desenho. */
        const alvosMax = area.formaArea === 'nenhuma' ? extrairAlvos(texto) : null;

        total++;
        if (area.formaArea !== 'nenhuma') comArea++;
        if (alcance != null) comAlcance++;
        if (dur.duracaoUnidade) comDuracao++;
        if (!dur.duracaoUnidade || (area.formaArea === 'nenhuma' && alvosMax == null)) {
            faltas.push(`${(m.titulo || m.id).slice(0, 26).padEnd(27)} ${(it.nome || '').slice(0, 30).padEnd(31)} ` +
                `${!dur.duracaoUnidade ? 'sem duração ' : ''}${area.formaArea === 'nenhuma' && alvosMax == null ? 'sem alvo' : ''}`);
        }
        mexeu = true;
        return { ...it, alcance, ...area, alvosMax, ...dur };
    });
    if (mexeu) m._novos = itens;
}

console.log('=== Passo 7: campos tipados ===\n');
console.log(`  ${total} itens em ${mods.length} módulos`);
console.log(`    com área extraída .... ${String(comArea).padStart(3)}  (${(comArea / total * 100).toFixed(0)}%)`);
console.log(`    com alcance .......... ${String(comAlcance).padStart(3)}  (${(comAlcance / total * 100).toFixed(0)}%)`);
console.log(`    com duração .......... ${String(comDuracao).padStart(3)}  (${(comDuracao / total * 100).toFixed(0)}%)`);
console.log(`\n  ${faltas.length} itens com lacuna — o campo fica null e a régua cai no comportamento de hoje.`);
if (SO_FALTAS) { console.log(); faltas.forEach(f => console.log('    ' + f)); }
else console.log('  (rode com --faltas para ver quais)');

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
for (const m of mods.filter(x => x._novos)) {
    await col.doc(m.id).update({ itensPredefinidos: m._novos, updatedAt: Date.now() });
}
console.log(`\n✅ Campos tipados gravados em ${total} itens.`);
process.exit(0);
