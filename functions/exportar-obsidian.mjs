/**
 * Espelha o Firestore num cofre Obsidian, só leitura: uma nota por cadastro
 * (Raças, Classes, Equipamentos, NPCs...) e uma por capítulo de cânone, com
 * [[wikilinks]] entre elas. Roda por comando, reescreve o cofre inteiro toda
 * vez — não é pra editar nota daqui à mão, ela some no próximo export.
 *
 * node functions/exportar-obsidian.mjs [pasta-do-cofre]
 */
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const sa = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const VAULT = process.argv[2]
    || 'D:/Imagem/US - Universo Soberano/RPG/Reliera/Lendas E Relíquias';

/* --- cadastros: coleção → pasta/título da nota, e o ícone do painel -------- */
const CADASTROS = [
    ['races',         'Raças',             '🧝'],
    ['tribes',        'Tribos',            '⛺'],
    ['classes',       'Classes',           '⚔️'],
    ['classModules',  'Módulos de Classe', '🧩'],
    ['equipment',     'Equipamentos',      '🛡️'],
    ['conditions',    'Condições',         '🩸'],
    ['derivedValues', 'Valores Derivados', '📐'],
    ['skills',        'Perícias',          '🎯'],
    ['peculiarities', 'Peculiaridades',    '✨'],
    ['npcs',          'NPCs',              '👤'],
];

const NOMES = ['nome', 'titulo', 'title'];
const nomeDe = d => NOMES.map(k => d[k]).find(v => v) || '(sem nome)';
const limpo = s => String(s).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t\u00a0]+/g, ' ').trim();
const arquivo = s => limpo(s).replace(/[\\/:*?"<>|]/g, '-').slice(0, 150) || '(sem nome)';

/** Coleções que só entram para dar nome a id (ex: partesDoCorpo vira slots=6
 *  em vez de "Torso"), não viram nota própria. */
const SO_PARA_NOMEAR = ['bodyParts'];

/* --- tudo de uma vez, pra nomear ids antes de escrever ---------------------
   'npcs' é coleção raiz; o resto do cadastro vive sob system/data/<col>. */
const SNAPS = new Map();
const ID_NOME = new Map();
await Promise.all([...CADASTROS.map(c => c[0]), ...SO_PARA_NOMEAR].map(async col => {
    const s = await db.collection(col === 'npcs' ? 'npcs' : `system/data/${col}`).get();
    SNAPS.set(col, s);
    s.docs.forEach(d => ID_NOME.set(d.id, limpo(nomeDe(d.data()))));
}));

/** Um valor do Firestore virando texto de nota, com [[wikilink]] quando o
 *  valor é (ou contém) o id de outro documento nomeado acima. */
function valor(v) {
    if (v == null || v === '' || v === false) return '';
    if (v === true) return 'sim';
    if (Array.isArray(v)) return v.map(valor).filter(Boolean).join('; ');
    if (typeof v === 'object') {
        if (v._seconds) return new Date(v._seconds * 1000).toLocaleDateString('pt-BR');
        const resto = Object.entries(v).filter(([k]) => k !== 'id')
            .map(([k, x]) => { const t = valor(x); return t && t !== '0' ? `${k}=${t}` : ''; })
            .filter(Boolean).join(', ');
        const nome = v.id && ID_NOME.get(v.id);
        if (nome) return resto ? `[[${nome}]] (${resto})` : `[[${nome}]]`;
        return resto;
    }
    const nome = ID_NOME.get(v);
    return nome ? `[[${nome}]]` : limpo(v);
}

/** HTML de capítulo de cânone → markdown simples o bastante pro Obsidian. */
function htmlParaMd(html) {
    return limpo(String(html || '')
        .replace(/<\/(p|div|li|h[1-6])>/gi, '\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<(strong|b)>/gi, '**').replace(/<\/(strong|b)>/gi, '**')
        .replace(/<(em|i)>/gi, '_').replace(/<\/(em|i)>/gi, '_')
        .replace(/<li>/gi, '- '))
        .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

const CAMPOS_FORA = new Set(['nome', 'titulo', 'title', 'id']);

function notaDoDoc(d, singular) {
    const dados = d.data();
    const linhas = [`# ${nomeDe(dados)}`, ''];
    for (const [campo, val] of Object.entries(dados)) {
        if (CAMPOS_FORA.has(campo)) continue;
        const t = valor(val);
        if (t) linhas.push(`**${campo}:** ${t}`, '');
    }
    return { nome: nomeDe(dados), texto: linhas.join('\n') };
}

/* A Home mora numa pasta prefixada com 00 porque o explorador do Obsidian
   sempre lista pasta antes de arquivo: no raiz ela cairia embaixo de tudo. */
const HOME_DIR = '00 🏠 Home';

/* --- limpa e recria as pastas conhecidas ----------------------------------- */
mkdirSync(VAULT, { recursive: true });
for (const [, titulo] of CADASTROS) rmSync(path.join(VAULT, titulo), { recursive: true, force: true });
rmSync(path.join(VAULT, 'Cânone'), { recursive: true, force: true });
rmSync(path.join(VAULT, 'Home.md'), { force: true });   // versão antiga, no raiz
mkdirSync(path.join(VAULT, HOME_DIR), { recursive: true });

const resumo = [];
const contagem = [];   // [icone, titulo, n] — alimenta o painel da Home

/* --- cadastros + npcs: uma nota por doc, mais o índice da pasta ------------- */
for (const [col, titulo, icone] of CADASTROS) {
    const snap = SNAPS.get(col);
    const pasta = path.join(VAULT, titulo);
    mkdirSync(pasta, { recursive: true });
    const nomes = [];
    for (const d of snap.docs) {
        const { nome, texto } = notaDoDoc(d, titulo);
        writeFileSync(path.join(pasta, `${arquivo(nome)}.md`), texto, 'utf8');
        nomes.push(arquivo(nome));
    }
    // O índice existe para a Home ter para onde apontar: wikilink abre nota,
    // não pasta. Nome único por pasta senão o [[link]] fica ambíguo.
    nomes.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    writeFileSync(path.join(pasta, `Índice — ${titulo}.md`), [
        `# ${icone} ${titulo}`, '',
        `> [!abstract] ${nomes.length} ${nomes.length === 1 ? 'registro' : 'registros'}`,
        '> Espelho do cadastro do site. Não edite estas notas — o próximo',
        '> [[Home|sincronismo]] reescreve todas.', '',
        ...nomes.map(n => `- [[${n}]]`),
    ].join('\n'), 'utf8');
    resumo.push(`${titulo}: ${nomes.length}`);
    contagem.push([icone, titulo, nomes.length]);
}

/* --- cânone: um livro por pasta, um capítulo por nota ----------------------- */
const [bSnap, aSnap] = await Promise.all([
    db.collection('worldbuilding-books').get(),
    db.collection('worldbuilding-articles').get(),
]);
const livros = bSnap.docs.map(d => ({ id: d.id, ...d.data() }));
const artigos = aSnap.docs.map(d => d.data())
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

let capitulos = 0;
const indiceLivros = [];
for (const l of livros) {
    const nomeLivro = arquivo(l.title || l.id);
    const pasta = path.join(VAULT, 'Cânone', nomeLivro);
    mkdirSync(pasta, { recursive: true });
    const meus = artigos.filter(c => c.bookId === l.id);
    writeFileSync(path.join(pasta, `${nomeLivro} — Sumário.md`), [
        `# 📖 ${limpo(l.title || '')}`, '',
        l.description ? `> [!quote] ${limpo(l.description)}` : '', '',
        `**${meus.length} ${meus.length === 1 ? 'capítulo' : 'capítulos'}**`, '',
        ...meus.map(c => `- [[${arquivo(c.title || '')}]]`),
    ].join('\n'), 'utf8');
    for (const c of meus) {
        writeFileSync(path.join(pasta, `${arquivo(c.title || '')}.md`), [
            `# ${limpo(c.title || '')}`, '',
            c.synopsis ? `_${limpo(c.synopsis)}_` : '', '',
            htmlParaMd(c.contentHTML), '',
            '---', `📖 [[${nomeLivro} — Sumário|${limpo(l.title || '')}]]`,
        ].join('\n'), 'utf8');
        capitulos++;
    }
    indiceLivros.push(`- [[${nomeLivro} — Sumário|${limpo(l.title || '')}]] — ${meus.length} cap.`);
}
writeFileSync(path.join(VAULT, 'Cânone', 'Índice — Cânone.md'), [
    '# 📚 Cânone', '',
    `> [!abstract] ${livros.length} livros · ${capitulos} capítulos`, '',
    ...indiceLivros,
].join('\n'), 'utf8');
resumo.push(`Cânone: ${livros.length} livros, ${capitulos} capítulos`);

/* --- Home: o painel. Regerada a cada sync para os números não mentirem. ----- */
const agora = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
const total = contagem.reduce((s, [, , n]) => s + n, 0) + capitulos;
const botao = (rotulo, href, primario) =>
    `<a href="${href}" style="display:inline-block;padding:10px 20px;margin:4px 6px 4px 0;`
    + `border-radius:8px;text-decoration:none;font-weight:600;font-size:0.95em;`
    + (primario
        ? `background:var(--interactive-accent);color:var(--text-on-accent);`
        : `background:var(--background-modifier-border);color:var(--text-normal);`)
    + `">${rotulo}</a>`;

writeFileSync(path.join(VAULT, HOME_DIR, 'Home.md'), `---
cssclasses:
  - wide-page
---

# ⚔️ Lendas & Relíquias

> [!quote] Espelho do banco em ${agora} — ${total} notas.
> Este cofre é gerado. As notas das pastas abaixo são reescritas do zero a cada
> sincronismo: anotação sua feita nelas **se perde**. Para notas próprias, crie
> pastas fora das listadas aqui.

${botao('🔄 &nbsp;Sincronizar com o banco', 'obsidian://shell-commands?execute=sincronizar-cofre', true)}${botao('🌐 &nbsp;Abrir o site', 'https://rpg-lendasereliquias.web.app', false)}

---

## 🎲 Sistema

| | Cadastro | Registros |
|:--:|:--|--:|
${contagem.map(([i, t, n]) => `| ${i} | [[Índice — ${t}\\|${t}]] | **${n}** |`).join('\n')}

## 📚 Cânone

| | | |
|:--:|:--|--:|
| 📖 | [[Índice — Cânone\\|Livros de Worldbuilding]] | **${livros.length}** |
| 📄 | Capítulos publicados e de mestre | **${capitulos}** |

---

## 🧭 Como usar

> [!tip] O grafo já nasce ligado
> Toda referência entre cadastros virou \`[[wikilink]]\` — abra o **Graph View**
> (\`Ctrl+G\`) para ver classe puxando perícia, raça puxando peculiaridade, item
> puxando valor derivado. É o mapa do sistema inteiro sem ninguém ter desenhado.

> [!warning] Mão única
> O fluxo é **banco → cofre**, nunca o contrário. Mudança de regra se faz no
> site; aqui você lê, busca (\`Ctrl+Shift+F\`) e navega.

> [!info] Quando o botão não responde
> Ele depende do plugin *Shell commands* ativo e do \`node\` no PATH. Alternativa:
> \`Ctrl+P\` → *Execute: Sincronizar cofre com o banco*.

---

> **Sistema:** Lendas e Relíquias v1.7 · **Cenário:** Universo Soberano — Vasteluna
> **Origem:** \`functions/exportar-obsidian.mjs\`
`, 'utf8');

console.log(resumo.join('\n'));
console.log(`\n${total} notas · cofre atualizado em: ${VAULT}`);
process.exit(0);
