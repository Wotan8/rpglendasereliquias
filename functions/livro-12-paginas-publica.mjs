/**
 * Publica o Livro de 12 Páginas no Cronista como livro INTERNO (public: false, só mestre).
 *   node functions/livro-12-paginas-publica.mjs            (dry-run)
 *   node functions/livro-12-paginas-publica.mjs --apply
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const BOOK_ID = 'book-livro-12-paginas';
const MD = readFileSync(new URL('../LIVRO-DE-12-PAGINAS.md', import.meta.url), 'utf8');

// ---------- markdown → html (subconjunto usado no livro) ----------
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = s => esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');

function mdToHtml(md) {
    const lines = md.split('\n');
    const out = [];
    let i = 0;
    const isTable = l => /^\|.*\|\s*$/.test(l);
    while (i < lines.length) {
        const l = lines[i];
        if (!l.trim()) { i++; continue; }
        if (l.startsWith('```')) {
            const buf = []; i++;
            while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
            i++;
            out.push('<pre>' + esc(buf.join('\n')) + '</pre>');
            continue;
        }
        const h = l.match(/^(#{1,4})\s+(.*)$/);
        if (h) { const n = Math.min(h[1].length + 1, 4); out.push(`<h${n}>${inline(h[2])}</h${n}>`); i++; continue; }
        if (l.startsWith('---')) { out.push('<hr>'); i++; continue; }
        if (l.startsWith('>')) {
            const buf = [];
            while (i < lines.length && lines[i].startsWith('>')) buf.push(lines[i++].replace(/^>\s?/, ''));
            out.push('<blockquote><p>' + inline(buf.join(' ')) + '</p></blockquote>');
            continue;
        }
        if (isTable(l)) {
            const rows = [];
            while (i < lines.length && isTable(lines[i])) rows.push(lines[i++]);
            const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
            const header = cells(rows[0]);
            const body = rows.slice(1).filter(r => !/^\|\s*-+/.test(r) && !/^\|(\s*-+\s*\|)+\s*$/.test(r));
            let t = '<table><tr>' + header.map(c => `<th>${inline(c)}</th>`).join('') + '</tr>';
            for (const r of body) t += '<tr>' + cells(r).map(c => `<td>${inline(c)}</td>`).join('') + '</tr>';
            out.push(t + '</table>');
            continue;
        }
        if (/^(-|\d+\.)\s/.test(l)) {
            const ordered = /^\d+\./.test(l);
            const items = [];
            while (i < lines.length && /^(-|\d+\.)\s/.test(lines[i])) items.push(lines[i++].replace(/^(-|\d+\.)\s+/, ''));
            out.push((ordered ? '<ol>' : '<ul>') + items.map(x => `<li>${inline(x)}</li>`).join('') + (ordered ? '</ol>' : '</ul>'));
            continue;
        }
        const buf = [];
        while (i < lines.length && lines[i].trim() && !isTable(lines[i]) && !lines[i].startsWith('```') && !/^(#{1,4})\s/.test(lines[i]) && !lines[i].startsWith('---') && !lines[i].startsWith('>') && !/^(-|\d+\.)\s/.test(lines[i])) buf.push(lines[i++]);
        out.push('<p>' + inline(buf.join(' ')) + '</p>');
    }
    return out.join('\n').replace(/(\n<hr>)+$/, '');
}

// ---------- fatiar em capítulos ----------
const parts = MD.split(/^## /m);
const preface = parts[0].replace(/^# .*\n/, '');
const chapters = parts.slice(1).map(p => { const nl = p.indexOf('\n'); return { title: p.slice(0, nl).trim(), body: p.slice(nl + 1) }; });

const synopsis = {
    'Antes de ler': 'O que este livro assume e o que ficou de fora.',
    1: 'Um d10, Alvo = Atributo + Perícia, Graus, crítico, desastre, Transbordo e os cinco botões do Narrador.',
    2: 'Os nove atributos em grade 3×3, teto 5 e Aura.',
    3: 'As 32 perícias gerais com verbos, a Perícia de Escola e a tabela única de EXP.',
    4: 'Vitalidade, Energia e Sanidade; como a Energia volta; Vício e Virtude; contador de cena.',
    5: 'Turno, iniciativa, ataque em três passos, as três defesas e seus trunfos, crítico e desastre, ações de combate.',
    6: 'Qualidade, quem pode usar, Afiação, Encantamento, Aura da peça, Danificada e Carga.',
    7: 'Escola e Ramo, conjurar, Tributo por escola, Lealdade.',
    8: 'Hemomancia, Abismancia, Necromancia, Pallomancia, Sonoromancia, Totemancia, Runomancia e Alquimancia na mesa.',
    9: 'As doze condições, os portões direto e resistido, e as Aflições.',
    10: 'Ferimento, Morrendo, Fome, Sede, Exaustão, Sobrecarga, descanso e viagem.',
    11: 'Teste de Sanidade, Colapso, Trauma e tratamento.',
    12: 'Criação de personagem, os eixos de build, Poder e Patamar, glossário.',
};

const docs = [];
docs.push({ id: 'art-livro-12p-00', title: 'Antes de ler', order: 0, html: '<h2>Antes de ler</h2>\n' + mdToHtml(preface), synopsis: synopsis['Antes de ler'] });
chapters.forEach((c, idx) => {
    const n = idx + 1;
    docs.push({ id: `art-livro-12p-${String(n).padStart(2, '0')}`, title: c.title, order: n, html: `<h2>${inline(c.title)}</h2>\n` + mdToHtml(c.body), synopsis: synopsis[n] || '' });
});

const now = Date.now();
const regua = (await db.doc('worldbuilding-books/book-regua-balanceamento').get()).data();
const book = {
    title: 'Lendas & Relíquias — Livro de 12 Páginas (Núcleo v2)',
    description: 'Proposta de núcleo v2 do sistema, escrita para playtest: as regras inteiras em 12 páginas. Livro interno, não é cânone até ser aprovado em mesa.',
    cover: '', public: false,
    pub: { geral: false, conhGeral: false, conhVinculo: false, mestre: true },
    estanteIds: regua.estanteIds || [], estanteId: null,
    order: -3, versao: '1.00', updatedBy: regua.updatedBy || '',
    createdAt: now, updatedAt: now,
};

console.log(`${APPLY ? 'APLICANDO' : 'DRY-RUN'} — livro ${BOOK_ID}, ${docs.length} capítulos`);
for (const d of docs) console.log(`  [${d.order}] ${d.title} — ${d.html.length} chars html`);
if (!APPLY) { console.log('\n--- amostra do cap. 1 ---\n' + docs[1].html.slice(0, 900)); process.exit(0); }

const existing = await db.doc(`worldbuilding-books/${BOOK_ID}`).get();
if (existing.exists) { book.createdAt = existing.data().createdAt || now; }
await db.doc(`worldbuilding-books/${BOOK_ID}`).set(book, { merge: true });
const batch = db.batch();
for (const d of docs) {
    batch.set(db.doc(`worldbuilding-articles/${d.id}`), {
        bookId: BOOK_ID, title: d.title, order: d.order, contentHTML: d.html, synopsis: d.synopsis,
        status: 'publicado', public: false, versao: '1.00', createdAt: now, updatedAt: now,
    }, { merge: true });
}
await batch.commit();
const chk = await db.collection('worldbuilding-articles').where('bookId', '==', BOOK_ID).get();
console.log(`gravado: livro + ${chk.size} capítulos`);
process.exit(0);
