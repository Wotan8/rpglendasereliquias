/**
 * Gera markdown com TODAS as tribos (publicadas ou não) + contexto encontrado no banco.
 * node functions/_tmp-dump-tribos-md.mjs > TRIBOS.md
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const grab = async col => {
  const s = await db.collection(col).get();
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
};
const sys = c => grab(`system/data/${c}`);

const [tribes, peculiarities, derivedValues, mechanics, skills] = await Promise.all(
  ['tribes', 'peculiarities', 'derivedValues', 'mechanics', 'skills'].map(sys));

// ---------- varredura de contexto ----------
const CTX_COLS = {
  npcs: 'NPCs',
  'worldbuilding-geography': 'Locais',
  'worldbuilding-factions': 'Facções',
  'worldbuilding-cultures': 'Culturas',
  'worldbuilding-lineages': 'Linhagens',
  'worldbuilding-properties': 'Propriedades',
  'worldbuilding-relations': 'Relações',
  'worldbuilding-articles': 'Artigos / capítulos de livro',
  'worldbuilding-books': 'Livros',
  items: 'Itens',
};
const ctxDocs = Object.fromEntries(await Promise.all(
  Object.keys(CTX_COLS).map(async c => [c, await grab(c)])));

const books = ctxDocs['worldbuilding-books'] || [];
const bookName = id => books.find(b => b.id === id)?.titulo || books.find(b => b.id === id)?.nome;

// texto pesquisável: só strings de prosa, sem URL/id/token
const IGNORE_KEY = /^(id|.*Id|.*Ids|imagemUrl|.*Url|.*URL|token|slug|criadoEm|atualizadoEm)$/;
const isNoise = s => /^https?:\/\//.test(s) || (/\d/.test(s) && !/\s/.test(s)) || s.length < 3;
function proseOf(v, key = '', acc = []) {
  if (typeof v === 'string') { if (!IGNORE_KEY.test(key) && !isNoise(v)) acc.push(v); return acc; }
  if (Array.isArray(v)) { v.forEach(x => proseOf(x, key, acc)); return acc; }
  if (v && typeof v === 'object') { for (const [k, x] of Object.entries(v)) proseOf(x, k, acc); return acc; }
  return acc;
}
const rxOf = n => new RegExp(`(?<![\\p{L}])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?(?![\\p{L}])`, 'giu');
const clean = s => String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function contextFor(nome) {
  const rx = rxOf(nome);
  const found = [];
  for (const [col, label] of Object.entries(CTX_COLS)) {
    for (const d of ctxDocs[col]) {
      const snippets = [];
      for (const raw of proseOf(d)) {
        const t = clean(raw);
        rx.lastIndex = 0;
        let m;
        while ((m = rx.exec(t)) && snippets.length < 3) {
          const ini = Math.max(0, m.index - 160), fim = Math.min(t.length, m.index + 200);
          snippets.push((ini ? '…' : '') + t.slice(ini, fim) + (fim < t.length ? '…' : ''));
          rx.lastIndex = fim;
        }
        if (snippets.length >= 3) break;
      }
      if (!snippets.length) continue;
      const titulo = d.nome || d.titulo || d.name || d.id;
      const extra = d.livroId ? ` (livro: ${bookName(d.livroId) || d.livroId})` : '';
      found.push({ label, titulo: titulo + extra, snippets: [...new Set(snippets)] });
    }
  }
  return found;
}

// ---------- markdown ----------
const out = [];
const w = s => out.push(s);
const txt = v => (v == null || v === '' ? '_(vazio)_' : String(v).trim());
const anchor = n => String(n).toLowerCase().replace(/[^a-z0-9à-ú ]/gi, '').replace(/ /g, '-');

const KNOWN = new Set(['id', 'nome', 'lema', 'publicado', 'ordem', 'imagemUrl',
  'descricao', 'cultura', 'governo', 'economia', 'militar',
  'unidadesMilitares', 'pericias', 'peculiaridadeIds', 'derivedValueIds']);

const sorted = tribes.slice().sort((a, b) => (a.ordem ?? 99) - (b.ordem ?? 99) || a.nome.localeCompare(b.nome));

w('# Tribos — Lendas e Relíquias');
w('');
w(`Dump completo do banco (\`system/data/tribes\`) em ${new Date().toISOString().slice(0, 10)}. Inclui tribos não publicadas.`);
w('Cada tribo traz também o **contexto** encontrado no resto do banco — NPCs, locais, facções, artigos e itens que a citam.');
w('');
w('## Índice');
w('');
w('| # | Tribo | Status | Lema |');
w('|---|-------|--------|------|');
sorted.forEach((t, i) => w(`| ${i + 1} | [${t.nome}](#${anchor(t.nome)}) | ${t.publicado === false ? '🚫 não publicada' : '✅ publicada'} | ${(t.lema || '—').replace(/\|/g, '\\|').replace(/\s+/g, ' ')} |`));
w('');
w('---');
w('');

for (const t of sorted) {
  w(`## ${t.nome}`);
  w('');
  w(`- **Status:** ${t.publicado === false ? '🚫 NÃO PUBLICADA' : '✅ publicada'}`);
  w(`- **ID:** \`${t.id}\``);
  w(`- **Ordem:** ${t.ordem ?? '—'}`);
  w(`- **Lema:** ${t.lema || '—'}`);
  w(`- **Imagem:** ${t.imagemUrl ? `[link](${t.imagemUrl})` : '❌ faltando'}`);
  w('');

  for (const [label, f] of [['Descrição', 'descricao'], ['Cultura', 'cultura'],
    ['Governo', 'governo'], ['Economia', 'economia'], ['Militar', 'militar']]) {
    w(`### ${label}`);
    w('');
    w(txt(t[f]));
    w('');
  }

  w('### Unidades militares');
  w('');
  if (t.unidadesMilitares?.length) {
    for (const u of t.unidadesMilitares) {
      w(`- **${u.nome}**${u.funcao ? ` — _${u.funcao}_` : ''}`);
      if (u.descricao) w(`  - ${clean(u.descricao)}`);
    }
  } else w('_(nenhuma)_');
  w('');

  w('### Perícias iniciais');
  w('');
  if (t.pericias?.length) {
    for (const p of t.pericias) {
      const o = typeof p === 'object' ? p : { nome: p };
      w(`- ${o.nome}${o.nivel ? ` — Nível ${o.nivel}` : ''}${o.opcao ? ` _(ou ${o.opcao})_` : ''}`);
    }
  } else w('_(nenhuma)_');
  w('');

  w('### Peculiaridades');
  w('');
  if (t.peculiaridadeIds?.length) {
    for (const id of t.peculiaridadeIds) {
      const p = peculiarities.find(x => x.id === id);
      if (!p) { w(`- ⚠️ \`${id}\` — peculiaridade NÃO ENCONTRADA no banco`); w(''); continue; }
      const tags = [p.fonte && `fonte: ${p.fonte}`, p.quandoSeAplica || 'passivo',
        p.ehVantagem ? 'VANTAGEM' : null, p.custoExp != null ? `${p.custoExp} EXP` : null]
        .filter(Boolean).join(' · ');
      w(`#### ${p.nome}`);
      w('');
      w(`_${tags}_`);
      w('');
      w(txt(p.descricao));
      w('');
      const mec = (p.mecanicaIds || []).map(m => mechanics.find(x => x.id === m)?.nome || `?${m}`);
      const dv = (p.derivedValueIds || []).map(d => derivedValues.find(x => x.id === d)?.nome || `?${d}`);
      const per = (p.periciaIds || []).map(s => skills.find(x => x.id === s)?.nome || `?${s}`);
      if (mec.length) w(`- **Mecânicas:** ${mec.join(', ')}`);
      if (dv.length) w(`- **Valores derivados:** ${dv.join(', ')}`);
      if (per.length) w(`- **Perícias:** ${per.join(', ')}`);
      if (mec.length || dv.length || per.length) w('');
    }
  } else w('_(nenhuma)_');
  w('');

  w('### Valores derivados da tribo');
  w('');
  w((t.derivedValueIds || []).map(d => `- ${derivedValues.find(x => x.id === d)?.nome || `?${d}`}`).join('\n') || '_(nenhum)_');
  w('');

  const extras = Object.keys(t).filter(k => !KNOWN.has(k));
  if (extras.length) {
    w('### Outros campos do cadastro');
    w('');
    w('```json');
    w(JSON.stringify(Object.fromEntries(extras.map(k => [k, t[k]])), null, 2));
    w('```');
    w('');
  }

  // ---- contexto ----
  const ctx = contextFor(t.nome);
  w('### Contexto no mundo (menções no banco)');
  w('');
  if (!ctx.length) w('_Nenhuma menção encontrada fora do cadastro da tribo._');
  else {
    const porTipo = ctx.reduce((a, c) => ((a[c.label] ||= []).push(c), a), {});
    for (const [tipo, lista] of Object.entries(porTipo)) {
      w(`**${tipo}** (${lista.length})`);
      w('');
      for (const c of lista) {
        w(`- **${c.titulo}**`);
        for (const s of c.snippets) w(`  - "${s}"`);
      }
      w('');
    }
  }
  w('---');
  w('');
}

console.log(out.join('\n'));
process.exit();
