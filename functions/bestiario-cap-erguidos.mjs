/**
 * Bestiário · capítulo "Os Erguidos" — realinhar com a ficha.
 *
 * O capítulo foi escrito antes do `bestiario-consertos-03`, que mexeu no
 * Fantoche. Ficou dizendo "Alvo 5, 1d4, Vitalidade 6, meia marcha" quando a
 * ficha hoje é 1d4+1 com Necrose 1, Vitalidade 9, Blindagem 2 e 3m — e a
 * Blindagem é justamente o que explica o bicho, porque é ela que o segura de
 * pé, não a Vitalidade.
 *
 * TODO NÚMERO É GERADO DA FICHA: Alvo, dado, condição do golpe, Vitalidade,
 * Blindagem, Deslocamento, Grau e força saem de `npcs`. Só a prosa é escrita à
 * mão, e ela vem do capítulo que já estava lá — o que muda é a linha de
 * números e as duas frases que o Fantoche perdeu quando a ficha mudou.
 *
 * "As Respostas do Abismo" foi conferido e está correto contra as cinco fichas;
 * este script não encosta nele.
 *
 *   node functions/bestiario-cap-erguidos.mjs            (dry-run)
 *   node functions/bestiario-cap-erguidos.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';
const BOOK = 'book_mrs9ur4aw1m6a';
const TITULO = 'Os Erguidos';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const num = v => String(v).replace('.', ',');

/* a prosa, escrita à mão; `${ficha}` é o único buraco que o script preenche */
const PARAGRAFOS = [
    { nome: 'Fantoche', texto: p =>
        `<p><strong>Fantoche</strong> — ${p}. Não desvia, não recua, não pensa — e não sente; executa a `
        + `última ordem até cair. O corpo já está deteriorado quando é erguido: lento, inchado e `
        + `insensível. <strong>Não é a Vitalidade que o segura de pé, é a Blindagem</strong> — golpe fraco `
        + `quase não o marca, golpe forte o derruba de uma vez. O valor nunca esteve no golpe: está no `
        + `corpo, e cada machadada que um fantoche come é uma que o grupo não comeu. O Adepto sustenta `
        + `<strong>PRE + Servos</strong> de pé ao mesmo tempo (Limite de Fantoches), e o gargalo verdadeiro `
        + `é outro: precisa de cadáver no chão.</p>` },
    { nome: 'Servo Reanimado', texto: p =>
        `<p><strong>Servo Reanimado</strong> — ${p}. O produto do Ritual de Reanimação, com o Fragmento de `
        + `Identidade preservado no 4º Passo: lembra de quem foi, e obedece quem o trouxe. É companheiro `
        + `permanente — mesma régua do aliado do Druida, sem a Lealdade: o vínculo dele foi selado de outro `
        + `jeito, e não cresce.</p>` },
];

const FECHO = `<p>Nenhum dos dois se doma. Erguido não tem Lealdade que cresça nem Disposição que se `
    + `negocie: obedece quem o levantou, e é só isso que há. O eixo dos dois é <strong>p = 1</strong> — `
    + `não desobedecem, e é justamente por não desobedecerem que valem tão pouco por corpo.</p>`;

const erros = [];
const npcs = (await db.collection('npcs').get()).docs.map(d => d.data());
const arts = (await db.collection('worldbuilding-articles').where('bookId', '==', BOOK).get()).docs;
const cap = arts.find(d => (d.data().title || '') === TITULO);
if (!cap) { console.log(`❌ capítulo "${TITULO}" não achado no livro ${BOOK}`); process.exit(1); }

/* a linha de números, montada da ficha e de mais lugar nenhum */
const fichaDe = nome => {
    const n = npcs.find(x => x.nome === nome && x.tipo === 'criatura');
    if (!n) { erros.push(`"${nome}" não achado em npcs`); return null; }
    if (n.mesaId) { erros.push(`"${nome}" tem mesa — não entra no bestiário`); return null; }
    const vd = n.valoresDer || {};
    const atq = (String(n.ataques || '').split('\n').find(l => /Alvo\s*\d/.test(l)) || '').trim();
    const g = /Alvo (\d+)(?: \(\+(\d+) Transbordo\))?, (\d+d\d+(?:\+\d+)?)(.*)$/.exec(atq);
    if (!g) { erros.push(`"${nome}": golpe não legível — "${atq}"`); return null; }
    /* o que vem depois do dado é a condição do golpe: " e Necrose 1 — a carne que ele toca apodrece." */
    const cond = (/^\s*e ([^—.]+)/.exec(g[4] || '') || [])[1];
    const am = String(n.criatura?.nivelAmeaca || '');
    const grau = am.split(' · ')[0], forca = (/(\d+,\d+)×/.exec(am) || [])[1];
    if (!grau || !forca) { erros.push(`"${nome}": nivelAmeaca sem Grau ou força — "${am}"`); return null; }

    const partes = [`Alvo ${g[1]}${g[2] ? ` (+${g[2]} Transbordo)` : ''}`,
        g[3] + (cond ? ` e ${cond.trim()}` : ''), `Vitalidade ${num(vd.VIT)}`];
    if (Number(vd.BLD)) partes.push(`Blindagem ${num(vd.BLD)}`);
    if (vd.DESLOCAMENTO) partes.push(String(vd.DESLOCAMENTO));
    return { n, linha: esc(`${partes.join(', ')} — ${grau}, ${forca}× o guerreiro`) };
};

const blocos = PARAGRAFOS.map(p => { const f = fichaDe(p.nome); return f ? { ...p, ...f, html: p.texto(f.linha) } : null; });
if (blocos.some(b => !b) || erros.length) { console.log('❌ ERROS — nada foi gravado:'); erros.forEach(e => console.log('   ' + e)); process.exit(1); }

const html = blocos.map(b => b.html).join('\n') + '\n' + FECHO;
for (const t of ['p', 'strong', 'em', 'table', 'tr', 'td', 'th', 'ul', 'li']) {
    const abre = (html.match(new RegExp(`<${t}[ >]`, 'g')) || []).length;
    const fecha = (html.match(new RegExp(`</${t}>`, 'g')) || []).length;
    if (abre !== fecha) erros.push(`tag <${t}> desbalanceada: ${abre} abre, ${fecha} fecha`);
}
if (erros.length) { console.log('❌ ERROS — nada foi gravado:'); erros.forEach(e => console.log('   ' + e)); process.exit(1); }

const words = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
const antigo = String(cap.data().contentHTML || '');

console.log(`\n=== ${TITULO} · ${cap.id} — ${antigo.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length} → ${words} palavras ===`);
console.log('\n--- linha de números, gerada da ficha ---');
for (const b of blocos) console.log(`   ${b.nome.padEnd(17)} ${b.linha}`);
console.log('\n--- ANTES ---\n' + antigo.replace(/<[^>]+>/g, '').split('\n').filter(s => s.trim()).map(s => '   ' + s.trim()).join('\n'));
console.log('\n--- DEPOIS ---\n' + html.replace(/<[^>]+>/g, '').split('\n').filter(s => s.trim()).map(s => '   ' + s.trim()).join('\n'));

if (!APLICAR) { console.log('\n(dry-run — rode com --apply para gravar)'); process.exit(0); }

await cap.ref.update({ contentHTML: html, words, updatedAt: new Date().toISOString(), updatedBy: AUTOR });
console.log('\n✅ capítulo atualizado.');
process.exit(0);
