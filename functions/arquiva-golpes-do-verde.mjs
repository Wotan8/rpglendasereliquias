/**
 * Arquiva "Golpes do Verde" num livro de ideias e apaga o módulo do registro.
 *
 * O módulo saiu do Xamã (o Eco virou o core). Está despublicado, sem classe
 * vinculada e sem nenhum personagem com item dele — mas os 5 golpes já estavam
 * escritos, balanceados e com régua carimbada. Jogar fora seria perder trabalho
 * pronto, então antes de apagar o doc tudo vai para um capítulo do Escritório do
 * Cronista, completo o bastante para recriar o módulo lendo só o livro.
 *
 * O livro nasce SEM publicação nenhuma (as quatro marcações de
 * shared/livros-pub.js em false): não aparece na ficha, nem para o mestre, nem
 * na wiki. Vive no Escritório do Cronista.
 *
 *   node functions/arquiva-golpes-do-verde.mjs            (dry-run)
 *   node functions/arquiva-golpes-do-verde.mjs --apply
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const MOD_ID = 'mod_verde_xama';
const BOOK_ID = 'book-ideias-futuras';
const ART_ID = 'art-golpes-do-verde';
const ESTANTE_REF_INTERNA = 'est_mt4z0ceeabfrs';   // "Referência interna"
const CRIADOR_UID = 'M2rZzlQkzxTrrddeFQ10S6zsfX62';

const esc = (s = '') => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ── O capítulo é MONTADO do documento, não digitado ──────────────────
   Todo texto de mesa (nome, efeito, descrição) sai do cadastro palavra por
   palavra. O que escrevo aqui é só a moldura: títulos, rótulos e a nota de
   por que o módulo foi aposentado. */
function montarHTML(mod) {
    const { itensPredefinidos: predefs = [], schema = [], ...cfg } = mod;
    const linha = (rot, val) => `<tr><th>${esc(rot)}</th><td>${esc(val)}</td></tr>`;
    const p = [];

    p.push(`<h1>Golpes do Verde</h1>`);
    p.push(`<p><em>Módulo de classe aposentado do Xamã — o Eco virou o core da classe e este
        conjunto saiu antes de entrar em mesa. Nenhum personagem chegou a ter um destes golpes.
        Está aqui inteiro: se algum dia nascer uma classe que combine com a Essência Verde,
        dá para recriar o módulo lendo só este capítulo.</em></p>`);

    p.push(`<h2>O módulo</h2>`);
    p.push(`<table><tbody>
        ${linha('Título', cfg.titulo || '')}
        ${linha('Ícone', cfg.icone || '')}
        ${linha('Id no registro', MOD_ID)}
        ${linha('Tipo', cfg.tipo || '')}
        ${linha('Criação livre pelo jogador', cfg.permitirCriacaoJogador ? 'sim' : 'não')}
        ${linha('Custo de EXP por item', cfg.custoExpPorItem == null ? 'nenhum' : String(cfg.custoExpPorItem))}
        ${linha('Limite de itens', cfg.limiteFixo == null ? 'sem limite fixo' : String(cfg.limiteFixo))}
    </tbody></table>`);

    p.push(`<h3>Campos da ficha (schema)</h3>`);
    p.push(`<table><thead><tr><th>Chave</th><th>Tipo</th><th>Rótulo</th><th>🔒</th></tr></thead><tbody>`
        + schema.map(f => `<tr><td>${esc(f.key)}</td><td>${esc(f.tipo)}</td><td>${esc(f.label || '')}</td>`
            + `<td>${f.somenteLeitura ? 'sim' : 'não'}</td></tr>`).join('')
        + `</tbody></table>`);

    p.push(`<h2>Os cinco golpes</h2>`);
    p.push(`<p>A escada é por <strong>Perícia mínima em Totemismo</strong> (1 a 5), e o custo em
        Energia acompanha o degrau. Todos são <strong>Ação Padrão</strong>, dano de Natureza, e
        <strong>só ferem alvo vivo</strong>. A coluna “Régua” é o carimbo da auditoria de
        balanceamento do dia 13/08/2026 — razão, unidades e custo medidos contra a base 3,445.</p>`);

    for (const pd of predefs) {
        const v = pd.valores || {};
        const conds = (pd.condicoesAplicadas || [])
            .map(c => `${c.condicao} · ${c.rodadas} rodada(s) · até ${c.alvos} alvo(s)`
                + (c.portao ? ` · portão: ${c.portao}` : ''))
            .join('; ') || '—';
        const area = pd.formaArea && pd.formaArea !== 'nenhuma'
            ? `${pd.formaArea} de ${pd.tamanhoArea}m${pd.anguloCone ? ` (cone de ${pd.anguloCone}°)` : ''}`
            : 'alvo único';
        const r = pd.regua || {};

        p.push(`<h3>${esc(pd.nome)}</h3>`);
        p.push(`<p>${esc(pd.descricao || '')}</p>`);
        p.push(`<table><tbody>
            ${linha('Perícia mínima (Totemismo)', v['2'])}
            ${linha('Custo', v['3'])}
            ${linha('Ação', v.acao || 'Ação Padrão')}
            ${linha('Alcance', v['5'])}
            ${linha('Área', area)}
            ${linha('Alvos máximos', pd.alvosMax)}
            ${linha('Duração', pd.duracaoUnidade === 'instantaneo' ? 'instantâneo' : `${pd.duracaoValor} ${pd.duracaoUnidade}`)}
            ${linha('Condições aplicadas', conds)}
            ${linha('Economia', pd.economia || '')}
            ${linha('Régua', r.razao ? `razão ${r.razao} · ${r.unidades} unidades · custo ${r.custo} · base ${r.base} (${r.em})` : '—')}
        </tbody></table>`);
    }

    p.push(`<h2>O documento cru</h2>`);
    p.push(`<p>O doc inteiro como estava em <code>system/data/classModules/${MOD_ID}</code> na hora de
        apagar. Colar isto de volta recria o módulo exatamente como ele era, com régua e tudo.</p>`);
    p.push(`<pre><code>${esc(JSON.stringify(mod, null, 2))}</code></pre>`);

    return p.join('\n');
}

const snap = await db.doc(`system/data/classModules/${MOD_ID}`).get();
if (!snap.exists) {
    console.log(`❌ ${MOD_ID} não existe — nada a arquivar.`);
    process.exit(1);
}
const mod = snap.data();

/* Guarda de segurança: só apago um módulo despublicado, sem classe e sem
   nenhum personagem com item dele. */
if (mod.publicado !== false) {
    console.log('❌ o módulo está publicado — não apago. Despublique antes.');
    process.exit(1);
}
const chars = await db.collection('characters').get();
const comItens = [];
chars.forEach(d => {
    const its = d.data()?.classModuleData?.[MOD_ID];
    if (Array.isArray(its) && its.length) comItens.push(d.data().nome || d.id);
});
if (comItens.length) {
    console.log('❌ personagens ainda têm itens deste módulo:', comItens.join(', '));
    process.exit(1);
}

const html = montarHTML(mod);
const agora = Date.now();

const livro = {
    title: 'Ideias Futuras',
    description: 'Gaveta do que foi escrito e não entrou (ou saiu) do sistema. Cada capítulo guarda '
        + 'uma ideia completa o bastante para ser recriada no cadastro sem reescrever nada. '
        + 'Sem publicação nenhuma: só existe aqui no Escritório do Cronista.',
    cover: '', versao: '',
    estanteIds: [ESTANTE_REF_INTERNA], estanteId: null,
    pub: { geral: false, conhGeral: false, conhVinculo: false, mestre: false },
    public: false,
    order: 99,
    createdAt: agora, updatedAt: agora, updatedBy: CRIADOR_UID,
};

const capitulo = {
    title: 'Golpes do Verde — módulo aposentado do Xamã',
    synopsis: 'Os 5 golpes de Essência Verde, com custo, área, condições e régua carimbada, '
        + 'mais o documento cru do módulo. Pronto para recriar se nascer uma classe do Verde.',
    contentHTML: html,
    bookId: BOOK_ID, order: 0,
    status: 'rascunho', public: false,
    mentions: [],
    words: html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
    createdAt: agora, updatedAt: agora, updatedBy: CRIADOR_UID,
};

console.log(`📗 livro  "${livro.title}" (${BOOK_ID}) — pub: nenhuma`);
console.log(`📄 capítulo "${capitulo.title}" (${ART_ID}) — ${capitulo.words} palavras, ${html.length} bytes de HTML`);
console.log(`🗑️  apagar system/data/classModules/${MOD_ID} ("${mod.titulo}", ${(mod.itensPredefinidos || []).length} golpes)`);

if (!APPLY) {
    writeFileSync('__previa-golpes-do-verde.html', html, 'utf8');
    console.log('\n(dry-run — prévia do capítulo em functions/__previa-golpes-do-verde.html)');
    console.log('rode com --apply para gravar o livro e apagar o módulo');
    process.exit(0);
}

const jaTem = await db.doc(`worldbuilding-books/${BOOK_ID}`).get();
if (jaTem.exists) {
    console.log('📗 o livro já existia — mantido, só o capítulo entra');
} else {
    await db.doc(`worldbuilding-books/${BOOK_ID}`).set(livro);
    console.log('📗 livro criado');
}
await db.doc(`worldbuilding-articles/${ART_ID}`).set(capitulo);
console.log('📄 capítulo gravado');

// Só depois do capítulo no lugar é que o módulo vai embora.
const conferir = await db.doc(`worldbuilding-articles/${ART_ID}`).get();
if (!conferir.exists || !conferir.data().contentHTML) {
    console.log('❌ o capítulo não gravou — o módulo NÃO foi apagado');
    process.exit(1);
}
await db.doc(`system/data/classModules/${MOD_ID}`).delete();
console.log('🗑️  módulo apagado');
console.log('\n✅ pronto');
process.exit(0);
