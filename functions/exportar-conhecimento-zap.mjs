/**
 * Gera o CODEX que o Morik do WhatsApp lê: cânone público + cadastros do sistema.
 *
 * É um arquivo de texto, e é assim de propósito. O agente do zap roda sem
 * ferramenta nenhuma (`claude -p --tools ""`), então ele não abre o Firestore:
 * o que ele sabe cabe no prompt. Exportar em vez de dar acesso é o que torna
 * "só lê, nunca edita" verdade por incapacidade, e não por obediência.
 *
 * Cânone: entra o livro com geral / conhGeral / conhVinculo (a mesma conta do
 * shared/livros-pub.js, legado incluído). Livro só de mestre fica fora.
 * Cadastro: entra o que está publicado.
 *
 * node functions/exportar-conhecimento-zap.mjs [destino.md]
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const sa = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const DESTINO = process.argv[2]
    || 'C:/Users/Soberano/Documents/Morik/zap/conhecimento.md';
const DESTINO_FORMULAS = DESTINO.replace(/[^/\\]+$/, 'formulas.md');

/* --- as quatro marcações do livro, igual ao shared/livros-pub.js ---------- */
const pubDoLivro = l => (l.pub && typeof l.pub === 'object')
    ? { geral: !!l.pub.geral, conhGeral: !!l.pub.conhGeral,
        conhVinculo: !!l.pub.conhVinculo, mestre: !!l.pub.mestre }
    : { geral: false, conhGeral: false, conhVinculo: !!l.public, mestre: true };
const liberado = l => { const p = pubDoLivro(l); return p.geral || p.conhGeral || p.conhVinculo; };

/* --- cadastros: coleção, título e os campos que uma pessoa pergunta ------- */
const CADASTROS = [
    ['races',         'Raças',              ['subtitulo', 'expectativaVida', 'tendencia', 'habitat', 'aparencia', 'historia', 'curiosidades']],
    ['tribes',        'Tribos',             ['lema', 'descricao', 'cultura', 'governo', 'economia', 'militar', 'unidadesMilitares', 'pericias']],
    ['classes',       'Classes',            ['arquetipo', 'especialidade', 'atributoChave', 'citacao', 'descricao', 'papelEmCena', 'recursosDaClasse', 'manobras', 'testesDeClasse', 'pericClasse', 'modulosDaClasse', 'bonusIniciais', 'kitsIniciais']],
    ['classModules',  'Módulos de Classe',  ['tipo', 'custoExpLabel', 'limiteFixo', 'permitirCriacaoJogador']],
    ['equipment',     'Equipamentos',       ['tipo', 'categoriaArma', 'formaEquipar', 'equipavelEm', 'formulaDano', 'peso', 'tamanho', 'preco', 'liga', 'ehContainer', 'capacidadeContainer', 'tags', 'descricao']],
    ['conditions',    'Condições',          ['duracao', 'removivel', 'descricao']],
    ['derivedValues', 'Valores Derivados',  ['blocoNome', 'prefixo', 'sufixo', 'todoPersonagem', 'descricao']],
    ['skills',        'Perícias',           ['atributoBase', 'categoria', 'custoEvolucao', 'descricao']],
    ['peculiarities', 'Peculiaridades',     ['ehVantagem', 'fonte', 'quandoSeAplica', 'tags', 'descricao']],
];

/** Coleções que só entram para dar nome a id (id cru no texto é ruído). */
const SO_PARA_NOMEAR = ['bodyParts', 'mechanics'];

/* As Mecânicas não viram lista de cadastro: elas SÃO a conta que a ficha faz,
   e saem no formulas.md agrupadas pelo alvo que cada uma escreve. Listar as
   322 duas vezes só engordaria o prompt. */

const NOMES = ['nome', 'titulo', 'title'];
const nomeDe = d => NOMES.map(k => d[k]).find(v => v) || '(sem nome)';

/** id do Firestore → nome legível, de tudo que o site cadastra. */
const ID_NOME = new Map();
const limpo = s => String(s).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t\u00a0]+/g, ' ').trim();

/** Um valor do Firestore virando texto de leitura. Vazio = o campo some. */
function valor(v) {
    if (v == null || v === '' || v === false) return '';
    if (v === true) return 'sim';
    if (Array.isArray(v)) return v.map(valor).filter(Boolean).join('; ');
    if (typeof v === 'object') {
        if (v._seconds) return '';                       // timestamp não interessa
        // vínculo do tipo { id, valorInicial, characterCreationMin... }: o que
        // importa é o NOME. Zero e vazio somem, senão metade da linha é ruído.
        const resto = Object.entries(v).filter(([k]) => k !== 'id')
            .map(([k, x]) => { const t = valor(x); return t && t !== '0' ? `${k}=${t}` : ''; })
            .filter(Boolean).join(', ');
        const nome = v.id && ID_NOME.get(v.id);
        if (nome) return resto ? `${nome} (${resto})` : nome;
        return resto;
    }
    return ID_NOME.get(v) || limpo(v);
}

/* O agente NAO le isto inteiro: o morik.py fatia e manda so os trechos que a
   pergunta pede (_zap_buscar). Entao aqui cabe muito - o teto existe so para
   o INDICE, que esse sim vai inteiro em toda resposta, nao explodir sem
   ninguem perceber. Bateu? O .bat diz qual livro ficou de fora. */
const LIMITE = 4_000_000;
const CAMPO_MAX = 220;   // descricao de cadastro e referencia, nao literatura

const corta = (s, n = CAMPO_MAX) =>
    s.length > n ? s.slice(0, n).replace(/\s+\S*$/, '') + '…' : s;

const partes = [];
const resumo = [];

/* --- tudo do sistema de uma vez, para nomear os ids antes de escrever ----- */
const SNAPS = new Map();
await Promise.all([...CADASTROS.map(c => c[0]), ...SO_PARA_NOMEAR].map(async col => {
    const s = await db.collection(`system/data/${col}`).get();
    SNAPS.set(col, s);
    s.docs.forEach(d => ID_NOME.set(d.id, limpo(nomeDe(d.data()))));
}));

/* --- cânone --------------------------------------------------------------- */
const [bSnap, aSnap] = await Promise.all([
    db.collection('worldbuilding-books').get(),
    db.collection('worldbuilding-articles').get(),
]);
const livros = bSnap.docs.map(d => ({ id: d.id, ...d.data() }));
// Ordem de prioridade quando falta espaço: o quanto o livro está publicado.
// Geral (todo mundo vê) na frente, Vínculo (só quem é da matéria) no fim —
// é a régua do próprio site, e é a que faz sentido num bot público.
const peso = l => { const p = pubDoLivro(l); return (p.geral ? 4 : 0) + (p.conhGeral ? 2 : 0) + (p.conhVinculo ? 1 : 0); };
const abertos = livros.filter(liberado)
    .sort((a, b) => peso(b) - peso(a) || (a.order ?? 0) - (b.order ?? 0));
const idsAbertos = new Set(abertos.map(l => l.id));
const caps = aSnap.docs.map(d => d.data())
    .filter(c => idsAbertos.has(c.bookId) && c.status === 'publicado')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

// cada livro vira um bloco fechado: no fim, o que não couber no orçamento sai
// inteiro, e livro pela metade seria pior que livro de fora.
const blocos = abertos.map(l => {
    const meus = caps.filter(c => c.bookId === l.id);
    const p = [`\n## 📖 ${limpo(l.title || '')}`];
    if (l.description) p.push(limpo(l.description));
    for (const c of meus) {
        p.push(`\n### ${limpo(c.title || '')}`);
        if (c.synopsis) p.push(`_${limpo(c.synopsis)}_`);
        const texto = limpo(c.contentHTML || '');
        if (texto) p.push(texto);
    }
    return { titulo: l.title || '(sem título)', caps: meus.length, txt: p.join('\n') };
});
const fora = livros.filter(l => !liberado(l));

/* --- cadastros ------------------------------------------------------------ */
for (const [col, titulo, campos] of CADASTROS) {
    const snap = SNAPS.get(col);
    const docs = snap.docs.map(d => d.data()).filter(d => d.publicado !== false)
        .sort((a, b) => nomeDe(a).localeCompare(nomeDe(b), 'pt-BR'));
    partes.push(`\n\n# ${titulo.toUpperCase()} (${docs.length})\n`);
    for (const d of docs) {
        const bits = campos.map(c => { const t = corta(valor(d[c])); return t ? `${c}: ${t}` : ''; })
            .filter(Boolean).join(' · ');
        partes.push(`- **${limpo(nomeDe(d))}** — ${bits}`);
    }
    resumo.push(`${titulo}: ${docs.length}/${snap.size}`);
}

/* ==========================================================================
   FÓRMULAS — a conta que a Ficha de Personagem faz, mecânica por mecânica.
   A fórmula legível já existe: o Painel do Criador grava `previewTexto` a cada
   save (generatePreviewText, no mechanics-engine.js). Só cai no desenho a
   partir do config.calculos quando a mecânica é velha e não tem preview.
   ========================================================================== */
const MEC = new Map(SNAPS.get('mechanics').docs
    .map(d => [d.id, { id: d.id, ...d.data() }]));

/** Quem aponta para cada mecânica. Varre o doc inteiro atrás de id de
 *  mecânica em vez de listar campo por campo: são 30 nomes de campo
 *  diferentes (mecanicaIds, custoCriacaoMecanicaIds, efeitoSucessoIds...) e
 *  aparece um novo a cada módulo de classe novo. */
const usos = new Map();
const varre = (v, quem) => {
    if (typeof v === 'string') {
        if (MEC.has(v)) { if (!usos.has(v)) usos.set(v, new Set()); usos.get(v).add(quem); }
    } else if (Array.isArray(v)) v.forEach(x => varre(x, quem));
    else if (v && typeof v === 'object' && !v._seconds) Object.values(v).forEach(x => varre(x, quem));
};
const SINGULAR = { 'Raças': 'Raça', 'Tribos': 'Tribo', 'Classes': 'Classe',
    'Módulos de Classe': 'Módulo', 'Equipamentos': 'Equipamento',
    'Condições': 'Condição', 'Valores Derivados': 'Valor Derivado',
    'Perícias': 'Perícia', 'Peculiaridades': 'Peculiaridade' };
for (const [col, titulo] of CADASTROS)
    SNAPS.get(col).docs.forEach(d => varre(d.data(), `${SINGULAR[titulo]} ${nomeDe(d.data())}`));
MEC.forEach(m => varre({ ...m, id: null }, `Mecânica ${m.nome}`));

/** Mecânicas presas a um Valor Derivado: elas formam a BASE dele, e a ficha
 *  aplica antes de tudo (BASE:, no _applyMechanicModifiers). */
const daBase = new Set();
SNAPS.get('derivedValues').docs.forEach(d =>
    (d.data().mecanicaIds || []).forEach(id => daBase.add(id)));

const termo = t => t.tipo === 'ficha' ? `[${limpo(t.ref || '?')}]`
    : t.tipo === 'sort' ? `sorteio ${t.min ?? '?'}~${t.max ?? '?'}`
    : String(t.valor ?? '?');
const equacao = eq => (eq || []).map((t, i) => (i ? ` ${t.op || '+'} ` : '') + termo(t)).join('');
const conta = c => `${c.operacao || '+'} ${(c.equacao || []).length > 1
    ? `(${equacao(c.equacao)})` : equacao(c.equacao) || c.valor || '?'}`;

/** Uma linha de mecânica: fórmula, de onde vem, e o que a condiciona. */
function linhaMec(m, c) {
    const bits = [c ? conta(c) : (limpo(m.previewTexto || '') || valor(m.config?.textoEfeito) || m.descricao && limpo(m.descricao) || '—')];
    bits.push(`_${limpo(m.nome)}_`);
    if (daBase.has(m.id)) bits.push('BASE do valor');
    if (m.condicaoAplicacao) bits.push(`só quando: ${limpo(m.condicaoAplicacao)}`);
    if (m.duracao && m.duracao !== 'permanente') bits.push(`duração: ${limpo(m.duracao)}`);
    if (m.empilhamento && m.empilhamento !== 'soma') bits.push(`empilhamento: ${limpo(m.empilhamento)}`);
    if (m.evoluivel) bits.push(`evolui até nível ${m.nivelMaximo ?? '?'}`);
    const quem = [...(usos.get(m.id) || [])];
    if (quem.length) bits.push(`vem de: ${quem.join(', ')}`);
    return `- ${bits.join(' · ')}`;
}

const mecs = [...MEC.values()].filter(m => m.publicado !== false);
const porAlvo = new Map();
const semConta = [];
for (const m of mecs) {
    const cs = (m.config?.calculos || []).filter(c => c && c.alvo);
    if (!cs.length) { semConta.push(m); continue; }
    for (const c of cs) for (const a of (Array.isArray(c.alvo) ? c.alvo : [c.alvo])) {
        if (!porAlvo.has(a)) porAlvo.set(a, []);
        porAlvo.get(a).push([m, c]);
    }
}

const f = [];
f.push(`# COMO A FICHA DE PERSONAGEM CALCULA — Lendas & Relíquias

Isto é o motor, não o resumo: cada valor da ficha nasce de mecânicas
cadastradas, e é isso que está listado aqui. Notação: **[Algo]** é um valor
lido da própria ficha (atributo, perícia, Nível, um outro valor derivado);
número solto é constante; \`sorteio a~b\` é rolagem.

## A ordem em que a ficha aplica (derived-values.js, _applyMechanicModifiers)

1. **Base zero.** Nenhum valor derivado tem número embutido no código — ele
   começa em 0 e as mecânicas dizem quanto vale.
2. **Fórmula BASE** (as mecânicas presas ao próprio Valor Derivado, marcadas
   "BASE do valor" abaixo): primeiro um \`=\` se houver, depois \`+\`, depois
   \`×\`, depois \`÷\`.
3. **Constante de Raça / Classe / Tribo** entra na base — então o × e o ÷
   gerais do passo 4 também incidem sobre ela.
4. **Modificadores gerais** (peculiaridade, item, condição): \`=\` primeiro,
   depois \`+\`, depois o teto do que veio de PEÇAS, depois \`×\` e \`÷\`.
5. **Limites** por último: bloqueio zera, máximo trunca, mínimo levanta.
   Teto em atributo e perícia corta os pontos gastos, não só a exibição.
6. Arredondamento: × e ÷ guardam 2 casas — 1,70 de Altura não vira 1.

Consequência prática: bônus de peculiaridade e de item NÃO entram dentro do
parêntese da fórmula base; entram depois dela. E teto é sempre a última
palavra.`);

f.push(`\n\n# O QUE FORMA CADA VALOR (${porAlvo.size} alvos)\n`);
for (const alvo of [...porAlvo.keys()].sort((a, b) => a.localeCompare(b, 'pt-BR'))) {
    f.push(`\n## ${limpo(alvo)}`);
    for (const [m, c] of porAlvo.get(alvo)) f.push(linhaMec(m, c));
}

f.push(`\n\n# MECÂNICAS SEM CONTA (narrativas, booleanas, concessões) (${semConta.length})\n`);
for (const m of semConta.sort((a, b) => nomeDe(a).localeCompare(nomeDe(b), 'pt-BR')))
    f.push(`- **${limpo(m.nome)}** (${limpo(m.tipo || '?')}) ${linhaMec(m, null).slice(2)}`);

f.push('\n\n# POR CLASSE — o que cada uma usa\n');
for (const d of SNAPS.get('classes').docs.map(x => x.data())
        .sort((a, b) => nomeDe(a).localeCompare(nomeDe(b), 'pt-BR'))) {
    f.push(`\n## ${limpo(nomeDe(d))}`);
    for (const [rot, campo] of [['Atributo-chave', 'atributoChave'], ['Perícias de classe', 'pericClasse'],
                                ['Valores Derivados', 'derivedValueIds'], ['Módulos', 'modulosDaClasse'],
                                ['Testes de classe', 'testesDeClasse'], ['Bônus iniciais', 'bonusIniciais']]) {
        const t = valor(d[campo]);
        if (t) f.push(`- ${rot}: ${t}`);
    }
    // derivedValueIds ora é id cru, ora é { id, valorInicial... } — a ficha
    // aceita os dois, então aqui também.
    const dvIds = (d.derivedValueIds || []).map(v => (typeof v === 'string' ? v : v && v.id))
        .filter(Boolean);
    const ids = [...new Set((d.mecanicaIds || []).concat(
        ...SNAPS.get('derivedValues').docs.filter(v => dvIds.includes(v.id))
            .map(v => v.data().mecanicaIds || [])))];
    const minhas = ids.map(id => MEC.get(id)).filter(m => m && m.publicado !== false);
    if (minhas.length) {
        f.push('- Fórmulas:');
        for (const m of minhas)
            for (const c of ((m.config?.calculos || []).filter(c => c && c.alvo).length
                             ? m.config.calculos.filter(c => c && c.alvo) : [null]))
                f.push(`  ${linhaMec(m, c)}${c ? ` → em ${valor(c.alvo)}` : ''}`);
    }
}

const formulas = f.join('\n') + '\n';
writeFileSync(DESTINO_FORMULAS, formulas, 'utf8');
resumo.push(`Mecânicas: ${mecs.length}/${MEC.size} (${porAlvo.size} alvos, `
    + `${mecs.filter(m => (m.previewTexto || '').trim()).length} com fórmula pronta)`);

/* --- fecha a conta: cadastros e fórmulas são intocáveis (é o que mais
   perguntam e é o que tem número exato); o cânone entra até o orçamento
   acabar, na ordem do site, e o que sobrar fica de fora com nome e tudo. --- */
const cadastrosTxt = partes.join('\n');
let disponivel = LIMITE - cadastrosTxt.length - formulas.length;
const dentro = [], cortados = [];
for (const b of blocos) {
    if (b.txt.length <= disponivel) { dentro.push(b); disponivel -= b.txt.length; }
    else cortados.push(b);
}
for (const b of dentro) resumo.push(`cânone: ${b.titulo} (${b.caps} cap.)`);

const texto = ['# CÂNONE — Lendas & Relíquias\n', ...dentro.map(b => b.txt),
    cortados.length ? `\n_(Fora por falta de espaço: ${cortados.map(b => b.titulo)
        .join(', ')}. Se perguntarem, você não sabe.)_` : '',
    cadastrosTxt].join('\n') + '\n';
writeFileSync(DESTINO, texto, 'utf8');
console.log(resumo.join('\n'));
console.log(`\nfora (só mestre): ${fora.map(l => l.title).join(', ') || '—'}`);
if (cortados.length)
    console.log('\n*** NAO COUBE ***\n'
        + cortados.map(b => `  - ${b.titulo} (${(b.txt.length / 1024).toFixed(0)} KB)`).join('\n')
        + '\nPara caber, tire a publicacao de algum livro no site.');
console.log(`\n${(texto.length / 1024).toFixed(0)} KB → ${DESTINO}`);
console.log(`${(formulas.length / 1024).toFixed(0)} KB → ${DESTINO_FORMULAS}`);
console.log(`total ${((texto.length + formulas.length) / 1024).toFixed(0)} KB `
    + `de ${(LIMITE / 1024).toFixed(0)} KB de orçamento`);
process.exit(0);
