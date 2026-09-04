/**
 * Fase E do Núcleo v2 — os livros do Cronista.
 *
 *   node functions/v2-livros.mjs --mostrar   imprime os trechos que serão trocados (HTML cru)
 *   node functions/v2-livros.mjs             dry-run
 *   node functions/v2-livros.mjs --apply     grava (backup do HTML anterior em BACKUP_DIR)
 *
 * O que faz:
 *  1. Livro de Regras do Jogador → 2.00: os capítulos 2 a 7 passam a ser as páginas do Livro de
 *     12 Páginas (HTML já publicado no livro interno), entra o Capítulo 8 — Magia (páginas 7 e 8),
 *     os guias do site viram capítulos 9–11 e o guia da Ficha ganha "O que mudou no Núcleo v2".
 *  2. Compêndios: Sonoromancia sem Dissonância e sem os ±1 das Vozes; Totemancia sem Dívida
 *     Espiritual; Pallomancia sem Graça (preces em Energia) e "Devoção em Palla" → Pallomancia.
 *  3. Régua de Balanceamento → 1.03: termos mortos trocados, aviso de Núcleo v2 nas seções que
 *     descrevem o modelo anterior, e o capítulo 14 — Contadores e trilhas.
 *  4. Bestiário: Hemorragia → Sangrando e a nota de leitura (Blindagem única, Arcana, Poder).
 *  5. Livro de 12 Páginas marcado como aprovado.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const MOSTRAR = process.argv.includes('--mostrar');
const BACKUP_DIR = 'D:/Imagem/US - Universo Soberano/RPG/Reliera/Backup Firestore 2026-09-03/scripts-backups';
const col = async (p) => (await db.collection(p).get()).docs.map(d => ({ ...d.data(), id: d.id }));
const agora = new Date().toISOString();
const ops = [];
const op = (caminho, data, antes, log, set = false) => ops.push({ ref: db.doc(caminho), data, antes, log, set });
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const [books, arts] = await Promise.all([col('worldbuilding-books'), col('worldbuilding-articles')]);
const art = (id) => arts.find(a => a.id === id);
const html = (id) => String(art(id)?.contentHTML || '');
const textoDe = (h) => String(h).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

if (MOSTRAR) {
    const mostra = (id, termo, antes = 300, depois = 500) => { const h = html(id); const i = h.indexOf(termo); console.log(`\n### ${id} / ${termo}\n`, i < 0 ? '(não achou)' : h.slice(Math.max(0, i - antes), i + depois)); };
    mostra('art_ms3gb964zpmmow', 'Dissonância');
    mostra('art_ms3gb964zpmmow', 'Quatro Vozes', 100, 2600);
    mostra('art_ms3gb93y6turqk', 'Dívida Espiritual', 700, 900);
    mostra('art_ms3gb8qyw3pvwr', 'Graça', 300, 600);
    mostra('art-regras-jogador-09', 'Graça de Palla', 200, 300);
    mostra('art-regras-jogador-09', 'Bolha de Sangue', 200, 300);
    mostra('art_ms3gb964zpmmow', 'Dissonância', 0, 0);
    console.log('\nocorrências: Dissonância =', (html('art_ms3gb964zpmmow').match(/Dissonância/g) || []).length, '| Dívida =', (html('art_ms3gb93y6turqk').match(/Dívida/g) || []).length, '| Graça (Palla) =', (html('art_ms3gb8qyw3pvwr').match(/Graça/g) || []).length);
    process.exit(0);
}

// ---------- 1. Livro do Jogador 2.00 ----------
// Mapa capítulo novo ← páginas do Livro de 12 Páginas
const CAPS = [
    { id: 'art-regras-jogador-02', title: 'Capítulo 2 — Regras Básicas', paginas: ['01', '02', '04'] },
    { id: 'art-regras-jogador-03', title: 'Capítulo 3 — Criação de Personagem', paginas: ['12'] },
    { id: 'art-regras-jogador-04', title: 'Capítulo 4 — Perícias', paginas: ['03'] },
    { id: 'art-regras-jogador-05', title: 'Capítulo 5 — Equipamento', paginas: ['06'] },
    { id: 'art-regras-jogador-06', title: 'Capítulo 6 — Combate, Condições e Aflições', paginas: ['05', '09'] },
    { id: 'art-regras-jogador-07', title: 'Capítulo 7 — Desgaste, Sanidade e Trauma', paginas: ['10', '11'] },
    { id: 'art-regras-jogador-11', title: 'Capítulo 8 — Magia: Escola e Ramo', paginas: ['07', '08'], order: 7, novo: true },
];
const PAGINA_PARA_CAP = { 1: 2, 2: 2, 4: 2, 12: 3, 3: 4, 6: 5, 5: 6, 9: 6, 10: 7, 11: 7, 7: 8, 8: 8 };
const refsDeCapitulo = (h) => h.replace(/P[áa]gina (\d{1,2})\b/g, (m, n) => PAGINA_PARA_CAP[Number(n)] ? `Capítulo ${PAGINA_PARA_CAP[Number(n)]}` : m);
const tiraTituloDaPagina = (h) => h.replace(/^\s*<h[12][^>]*>[^<]*<\/h[12]>\s*/i, '');
for (const cap of CAPS) {
    const partes = cap.paginas.map(p => { const a = art(`art-livro-12p-${p}`); if (!a) throw new Error('página faltando: ' + p); return `<h2>${esc(String(a.title).replace(/^Página \d+ — /, ''))}</h2>\n${tiraTituloDaPagina(a.contentHTML)}`; });
    const conteudo = refsDeCapitulo(partes.join('\n<hr>\n'));
    const antes = art(cap.id);
    const data = { title: cap.title, contentHTML: conteudo, synopsis: `Núcleo v2 — ${cap.paginas.map(p => String(art(`art-livro-12p-${p}`).title).replace(/^Página \d+ — /, '')).join(' · ')}`, updatedAt: Date.now() };
    if (cap.novo) op(`worldbuilding-articles/${cap.id}`, { ...data, bookId: 'book-regras-jogador-v17', order: cap.order, status: 'publicado', public: true, createdAt: Date.now() }, antes ? { contentHTML: antes.contentHTML, title: antes.title } : null, `Livro do Jogador: ${cap.title} (novo)`, true);
    else op(`worldbuilding-articles/${cap.id}`, data, { contentHTML: antes.contentHTML, title: antes.title, synopsis: antes.synopsis ?? null }, `Livro do Jogador: ${cap.title} ← páginas ${cap.paginas.join(', ')}`);
}
// guias do site: renumeram e o da Ficha ganha o que mudou
const GUIAS = [['art-regras-jogador-08', 8, 'Capítulo 9 — Guia do Site: Primeiros Passos'], ['art-regras-jogador-09', 9, 'Capítulo 10 — Guia do Site: A Ficha'], ['art-regras-jogador-10', 10, 'Capítulo 11 — Guia do Site: Tabuleiro e Ferramentas']];
const NOVIDADES_FICHA = `
<h2>O que mudou na ficha com o Núcleo v2</h2>
<ul>
<li><b>⚡ Poder e Patamar</b> aparecem ao lado da Experiência: tudo que a ficha tem, convertido em EXP (Capítulo 3). Não trava nada — é régua para o Narrador.</li>
<li><b>Três defesas</b> na aba Combate: Esquiva, Aparar e Bloquear, cada uma igual ao nível da perícia (Capítulo 6). Desviar, Evadir, Proteger, Cobertura e Absorver saíram; Evadir e Proteger viraram trunfos da Esquiva e do Bloquear.</li>
<li><b>Perícias</b>: quatro grupos de oito, mais a Perícia de Escola de quem conjura. Não existe mais Domínio à parte: a perícia é a porta da arma e da escola.</li>
<li><b>Energia</b> = PRS + AUT + sua melhor Perícia de Arte. A Graça de Palla saiu; as preces pagam Energia.</li>
<li><b>Contadores de cena</b> (Carga de Sangue, Harmonia): começam em 0 e somem quando a cena acaba. No Tabuleiro, o Bardo pode gastar toda a Harmonia num Clímax antes de rolar.</li>
<li><b>Ferimento e Sobrecarga</b> entram e saem sozinhos: a ficha lê a Vitalidade e o peso e aplica Ferido, Grave, Beira da Morte, Morrendo ou Sobrecarregado.</li>
<li><b>Itens</b>: Qualidade 0–5, Afiação comum e arcana, Encantamento, Aura da peça e o estado Danificada. Liga e Integridade saíram; o desastre no dado come Afiação e depois marca a peça.</li>
<li><b>Ramo opcional</b>: classe com mais de um ramo (Xamã) escolhe um na criação e compra o outro na ficha por EXP.</li>
<li><b>Condições</b> têm portão: direto, resistido pelo corpo (VIG) ou pela mente (PRS). Aflições só saem com cura da potência certa — um consumível com potência de cura tira Aflição de nível igual ou menor.</li>
</ul>`;
for (const [id, order, title] of GUIAS) {
    const a = art(id); if (!a) continue;
    let h = String(a.contentHTML);
    h = h.replace(/Graça de Palla,\s*/g, '').replace(/Graça de Palla/g, 'Energia').replace(/Bolha de Sangue/g, 'Carga de Sangue');
    if (id === 'art-regras-jogador-09' && !h.includes('O que mudou na ficha com o Núcleo v2')) h += NOVIDADES_FICHA;
    if (h !== a.contentHTML || a.title !== title || a.order !== order) op(`worldbuilding-articles/${id}`, { title, order, contentHTML: h, updatedAt: Date.now() }, { title: a.title, order: a.order, contentHTML: a.contentHTML }, `Livro do Jogador: ${title}`);
}
const livroJ = books.find(b => b.id === 'book-regras-jogador-v17');
if (livroJ) op(`worldbuilding-books/${livroJ.id}`, { versao: '2.00', updatedAt: Date.now() }, { versao: livroJ.versao ?? null }, `Livro do Jogador: versão ${livroJ.versao} → 2.00 (Núcleo v2)`);

// ---------- 2. Compêndios ----------
const TROCAS = {
    art_ms3gb964zpmmow: [   // Sonoromancia
        [/Frequência errada: Dissonância Essencial \(choque de retorno\)\.?/g, 'Frequência errada: a canção não pega, e a Harmonia zera (Livro do Jogador, Capítulo 8).'],
        [/Dissonância Essencial/g, 'quebra da Harmonia'],
        [/Dissonância/g, 'quebra da Harmonia'],
        [/Tom errado: -2 no Alvo\.?/g, 'Tom errado: Desvantagem no teste (Lei da escola).'],
        // os ±1 das Vozes saem: a Forma é exigência, não bônus; a cena que favorece ou contraria uma Lei dá Vantagem ou Desvantagem (Livro, p. 7)
        [/A voz carrega emoção diretamente: \+1 no Alvo para efeitos emocionais\/mentais\./g, 'A voz carrega emoção diretamente.'],
        [/a Voz mais precisa\. \+1 no Alvo para efeitos de precisão e alvos únicos\./g, 'a Voz mais precisa, para alvos únicos.'],
        [/Impacto bruto máximo\. \+1 no Alvo para efeitos em área\./g, 'Impacto bruto máximo: é a Voz da área.'],
        [/Aliados sincronizados amplificam o efeito \(\+1 ao Alvo por aliado sincronizado, máximo = nível de Composição\)\./g, 'Aliados sincronizados amplificam o efeito: cena que favorece a Lei dá Vantagem.'],
        [/Pouca precisão \(-1 para frequências específicas\)\./g, 'Pouca precisão.'],
        [/\+1 no Alvo em linha\/cone\./g, 'É a Voz da linha e do cone.'],
        [/Contra vento forte: -1 a -3\./g, 'Contra vento forte: Desvantagem.'],
        [/Subaquático: -2 no Alvo \(efeitos de Água \+1\)\./g, 'Subaquático: Desvantagem (efeitos de Água ganham Vantagem).'],
        [/Através da terra: -3 no Alvo \(efeitos de Terra \+2\)\./g, 'Através da terra: Desvantagem (efeitos de Terra ganham Vantagem).'],
        [/\bComposição\b/g, 'Sonoromancia'],
    ],
    art_ms3gb93y6turqk: [   // Totemancia
        [/Falhar em cumprir acordos atrai a ira dos espíritos e acumula Dívida Espiritual\.\s*A Dívida Espiritual é cumulativa\.[^<]*?(?=<)/g,
            'Não existe dívida contada em números: o Tributo da Totemancia é o consentimento de quem vem (Livro do Jogador, Capítulo 8). Xamã que quebra a palavra perde o consentimento — o Eco não volta, e o Narrador decide como a quebra reverbera. '],
        [/dívidas espirituais pendentes/g, 'quebras de palavra pendentes'],
        [/Dívida Espiritual/g, 'quebra de consentimento'],
    ],
    art_ms3gb8qyw3pvwr: [   // Pallomancia
        [/A Pallomancia opera com dois recursos interligados: Energia e Graça\./g, 'A Pallomancia opera com um recurso: a Energia (Núcleo v2 — a Graça saiu; o que segue sobre Graça é registro do modelo anterior).'],
        [/Devoção em Palla/g, 'Pallomancia'],
    ],
};
for (const [id, lista] of Object.entries(TROCAS)) {
    const a = art(id); if (!a) continue;
    let h = String(a.contentHTML); const antes = h; const feitas = [];
    for (const [rx, sub] of lista) { const n = (h.match(rx) || []).length; if (n) { h = h.replace(rx, sub); feitas.push(`${rx.source.slice(0, 30)}… ×${n}`); } }
    if (id === 'art_ms3gb8qyw3pvwr' && !h.includes('Núcleo v2: as preces pagam Energia')) h = `<p><em>Núcleo v2: as preces pagam Energia; a Graça de Palla saiu (Livro do Jogador, Capítulos 2 e 8). Onde este Compêndio fala em Graça, leia Energia.</em></p>\n` + h;
    if (h !== antes) op(`worldbuilding-articles/${id}`, { contentHTML: h, updatedAt: Date.now() }, { contentHTML: antes }, `Compêndio ${a.title}: ${feitas.join(' | ') || 'nota v2'}`);
}

// ---------- 3. Régua de Balanceamento ----------
const TERMOS_REGUA = [[/Domínio de ([A-ZÁ-Ú][\wçãõáéíóú]+)/g, 'Perícia de $1'], [/\bTotemismo\b/g, 'Totemancia'], [/\bObservação\b/g, 'Percepção'], [/\bMalandragem\b/g, 'Lábia'],
    [/\bAgarrado\b/g, 'Preso'], [/\bQueimadura\b/g, 'Queimando'], [/\bHemorragia\b/g, 'Sangrando'], [/\bBlindagem Cortante\b/g, 'Blindagem'], [/\bGraça de Palla\b/g, 'Energia']];
const AVISO = (secoes) => `<p><em>⚠️ Núcleo v2 (04/09/2026): esta seção descreve o modelo anterior. A regra vigente está no Livro do Jogador 2.00 (${secoes}). O texto fica como registro da calibração.</em></p>\n`;
const AVISOS = { '8aLc6aTVahCWswWdhngK': 'Capítulos 2 e 6', '9sTazY2j3pqMErvSgkqP': 'Capítulo 2 — Energia e contadores de cena', 'gc3xRb9UpDWKq2CGjzh8': 'Capítulo 6 — condições com portão, sem Chance', '1VveJz9x5MgFGKNkPAoO': 'Capítulo 5 — a perícia é a porta; o Domínio saiu', 'B3G6yZNQmcnEqvLqwb6Z': 'Capítulo 8 — Escola e Ramo', '0p00vfreClWjXlAGR9YM': 'Capítulo 6 — Blindagem única e Blindagem Arcana' };
for (const a of arts.filter(x => x.bookId === 'book-regua-balanceamento')) {
    let h = String(a.contentHTML); const antes = h; const feitas = [];
    for (const [rx, sub] of TERMOS_REGUA) { const n = (h.match(rx) || []).length; if (n) { h = h.replace(rx, sub); feitas.push(`${rx.source.slice(0, 22)} ×${n}`); } }
    if (AVISOS[a.id] && !h.includes('Núcleo v2 (04/09/2026)')) { h = AVISO(AVISOS[a.id]) + h; feitas.push('aviso v2'); }
    if (h !== antes) op(`worldbuilding-articles/${a.id}`, { contentHTML: h, updatedAt: Date.now() }, { contentHTML: antes }, `Régua ${a.title}: ${feitas.join(' | ')}`);
}
if (!art('art-regua-14-contadores-trilhas')) {
    const p4 = html('art-livro-12p-04'), p8 = html('art-livro-12p-08'), p10 = html('art-livro-12p-10');
    const pega = (h, ini, fim) => { const i = h.indexOf(ini); if (i < 0) return ''; const j = fim ? h.indexOf(fim, i) : -1; return j < 0 ? h.slice(i) : h.slice(i, j); };
    const conteudo = `<p><em>Núcleo v2. Este capítulo registra as duas famílias de número que não são barra nem Valor Derivado fixo: o contador de cena e a trilha. Os números vivem em config/regras (contadores.*, ferimento.*, sobrecarga.*, trilhas.*).</em></p>
<h2>14.1 — Contador de cena</h2>
${pega(p4, '<p><strong>Contador de cena', '') || '<p>Contador de cena: começa quando a cena começa, sobe e desce pelas regras da escola, tem teto na ficha e some quando a cena acaba.</p>'}
<h3>Carga de Sangue (Sangral)</h3>
${pega(p8, '<p><strong>Hemomancia', '<p><strong>Abismancia')}
<h3>Harmonia (Bardo)</h3>
${pega(p8, '<p><strong>Sonoromancia', '<p><strong>Totemancia')}
<p>Na Régua: 1 Carga = 3 pontos de Vitalidade de sangue vivo; o teto de Carga é VIG + Hemomancia. A Harmonia sobe 1 por canção que passa (paga com Energia ou com Harmonia), zera ao errar, e o Clímax converte cada ponto gasto em 1 Grau. Nenhum contador vale EXP nem sobrevive à cena — por isso não entra no Poder.</p>
<h2>14.2 — Trilhas</h2>
${tiraTituloDaPagina(p10)}
<p>Na Régua: a trilha é o único desgaste que não passa por Vitalidade. Nível 1 = −1, nível 2 = −2 mais uma trava, nível 3 = Desvantagem mais um perigo. Trilhas diferentes somam; Desvantagem nunca soma com Desvantagem. Nenhuma trilha toca a Defesa. Ferimento e Sobrecarga são automáticos (a ficha e o Tabuleiro aplicam); Fome, Sede e Exaustão são do Narrador.</p>`;
    op('worldbuilding-articles/art-regua-14-contadores-trilhas', { bookId: 'book-regua-balanceamento', title: '14 — Contadores de cena e trilhas', order: 14, contentHTML: conteudo, synopsis: 'Núcleo v2: Carga, Harmonia, Ferimento, Fome, Sede, Exaustão, Sobrecarga', status: 'publicado', public: false, createdAt: Date.now(), updatedAt: Date.now() }, null, 'Régua: capítulo 14 — Contadores de cena e trilhas (novo)', true);
}
const regua = books.find(b => b.id === 'book-regua-balanceamento');
if (regua) op(`worldbuilding-books/${regua.id}`, { versao: '1.03', updatedAt: Date.now() }, { versao: regua.versao ?? null }, `Régua: versão ${regua.versao} → 1.03`);

// ---------- 4. Bestiário ----------
for (const a of arts.filter(x => x.bookId === 'book_mrs9ur4aw1m6a')) {
    let h = String(a.contentHTML); const antes = h; const feitas = [];
    for (const [rx, sub] of [[/\bHemorragia\b/g, 'Sangrando'], [/\bQueimadura\b/g, 'Queimando'], [/\bAgarrado\b/g, 'Preso']]) { const n = (h.match(rx) || []).length; if (n) { h = h.replace(rx, sub); feitas.push(`${rx.source} ×${n}`); } }
    if (/Como se lê uma fera/i.test(a.title || '') && !h.includes('Núcleo v2')) {
        h += `\n<h2>Núcleo v2: o que mudou na leitura</h2>
<ul>
<li><b>Blindagem única.</b> A fera tem uma Blindagem, contra dano físico, e uma Blindagem Arcana, contra dano de Essência. As Blindagens por tipo (cortante, perfurante, contundente) e por Essência saíram.</li>
<li><b>Condições com portão.</b> O que a fera aplica pega direto, ou só se os Graus do golpe vencerem VIG (corpo) ou PRS (mente) do alvo. Peçonha é Aflição: só sai com Caltra de potência igual ou maior.</li>
<li><b>⚡ Poder e Patamar.</b> O card mostra o Poder da fera (tudo que ela tem, em EXP). Fera no Patamar do grupo é luta justa; dois Patamares acima é chefe.</li>
</ul>`;
        feitas.push('nota v2');
    }
    if (h !== antes) op(`worldbuilding-articles/${a.id}`, { contentHTML: h, updatedAt: Date.now() }, { contentHTML: antes }, `Bestiário ${a.title}: ${feitas.join(' | ')}`);
}

// ---------- 5. Livro de 12 Páginas aprovado ----------
const l12 = books.find(b => b.id === 'book-livro-12-paginas');
if (l12 && !l12.aprovadoEm) op(`worldbuilding-books/${l12.id}`, { aprovadoEm: agora, aprovadoPor: 'Núcleo v2 — Fases A a F implementadas', updatedAt: Date.now() }, { aprovadoEm: null }, 'Livro de 12 Páginas: marcado como aprovado');

console.log(`ops: ${ops.length}`);
for (const o of ops) console.log(' ', o.log);
if (!APPLY) { console.log('\n(dry-run: nada gravado; use --apply)'); process.exit(0); }
fs.mkdirSync(BACKUP_DIR, { recursive: true });
const bk = path.join(BACKUP_DIR, `_backup-livros-${agora.replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(bk, JSON.stringify(ops.map(o => ({ doc: o.ref.path, antes: o.antes })), null, 1));
console.log('backup:', bk);
for (let i = 0; i < ops.length; i += 400) {
    const b = db.batch();
    ops.slice(i, i + 400).forEach(o => o.set ? b.set(o.ref, o.data, { merge: true }) : b.update(o.ref, o.data));
    await b.commit();
}
console.log(`gravado: ${ops.length} documentos`);
process.exit(0);
