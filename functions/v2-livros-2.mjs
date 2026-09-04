/**
 * Núcleo v2 — segunda passada nos livros do Cronista: sai o que ainda descrevia a versão antiga.
 *
 *   node functions/v2-livros-2.mjs            dry-run (mostra o que muda)
 *   node functions/v2-livros-2.mjs --apply    grava (backup em BACKUP_DIR), sobe versão de capítulo e de livro
 *
 * Livro do Jogador 2.00 → 2.01 (caps. 1, 5, 6, 10) · Livro de 12 Páginas 1.00 → 1.01 (pp. 5, 6) ·
 * Compêndio de Pallomancia (recurso = Energia) · Compêndio de Runomancia XIV (porta = perícia) ·
 * Ideias Futuras · Régua de Balanceamento 1.03 → 1.04 (caps. 0, 1, 4, 11; caps. 12 e 13 apagados).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const BACKUP_DIR = 'D:/Imagem/US - Universo Soberano/RPG/Reliera/Backup Firestore 2026-09-03/scripts-backups';
const agora = new Date().toISOString();
const proximaVersao = (v) => { const n = parseFloat(String(v ?? '').replace(/[^\d.]/g, '')); return isNaN(n) ? '1.00' : (n + 0.01).toFixed(2); };
const ops = [];
const avisos = [];

/** pares: [[de, para]] — cada "de" tem de existir exatamente uma vez (ou nenhuma, se "para" já está lá). */
function editar(id, pares, extra = {}) {
    return async () => {
        const ref = db.doc(`worldbuilding-articles/${id}`);
        const d = (await ref.get()).data();
        let html = d.contentHTML || '';
        let mudou = false;
        for (const [de, para] of pares) {
            const n = html.split(de).length - 1;
            if (n === 0) { if (para && html.includes(para)) continue; avisos.push(`⚠️ ${d.title}: não achei ${JSON.stringify(de.slice(0, 70))}`); continue; }
            if (n > 1) { avisos.push(`⚠️ ${d.title}: ${n} ocorrências de ${JSON.stringify(de.slice(0, 60))} — troco todas`); }
            html = html.split(de).join(para); mudou = true;
        }
        if (extra.prefixo && !html.startsWith(extra.prefixo)) { html = extra.prefixo + html; mudou = true; }
        if (!mudou) { console.log(`  = ${d.title}: sem mudança`); return; }
        ops.push({ ref, antes: { contentHTML: d.contentHTML, versao: d.versao ?? null }, data: { contentHTML: html, versao: proximaVersao(d.versao), updatedAt: Date.now() }, log: `${d.title}: ${pares.length} trocas → v${proximaVersao(d.versao)}` });
    };
}
function apagar(id) {
    return async () => {
        const ref = db.doc(`worldbuilding-articles/${id}`);
        const s = await ref.get(); if (!s.exists) { console.log(`  = ${id}: já não existe`); return; }
        ops.push({ ref, antes: s.data(), apagar: true, log: `${s.data().title}: apagado (registro do Domínio; backup no JSON)` });
    };
}
function livro(id, versaoNova) {
    return async () => {
        const ref = db.doc(`worldbuilding-books/${id}`);
        const d = (await ref.get()).data();
        if (d.versao === versaoNova) return;
        ops.push({ ref, antes: { versao: d.versao ?? null }, data: { versao: versaoNova, updatedAt: Date.now() }, log: `livro ${d.title}: v${d.versao ?? '-'} → v${versaoNova}` });
    };
}

const ITENS_V2 = `<ul>
<li><strong>Determinação virou Energia (ENER)</strong>: PRS + AUT + sua melhor Perícia de Arte.</li>
<li><strong>Especializações e Domínios saíram.</strong> A perícia é a porta: peça ou magia de Qualidade acima da sua Perícia de Arte entra com redutor no Alvo igual à diferença (Capítulo 5).</li>
<li><strong>Toda peça tem Qualidade de 0 a 5</strong>; por cima dela, Afiação, Encantamento e Aura. Liga e Integridade não existem mais.</li>
<li><strong>Blindagem é uma só</strong>: Leve 1, Média 2, Pesada 3, mais a Qualidade da armadura. Dano de Essência só a Blindagem Arcana barra, e todo golpe que acerta causa no mínimo 1 de dano.</li>
<li><strong>Três defesas</strong>: Esquiva, Aparar e Bloquear, cada uma igual ao nível da perícia (Capítulo 6).</li>
<li><strong>Doze condições e as Aflições</strong>, cada uma com o seu portão (Capítulo 6); Ferimento e Sobrecarga entram sozinhos pela Vitalidade e pelo peso.</li>
<li><strong>Carga em quilos</strong>: (FOR + VIG) × Tamanho; o site soma o peso.</li>
<li><strong>As perícias são 32 gerais em quatro grupos de oito</strong>, mais a Perícia de Escola de quem conjura.</li>
<li><strong>Poder</strong>: o site converte tudo que a ficha tem em EXP e diz o Patamar (Capítulo 3).</li>
</ul>`;
const ITENS_ANTIGOS_INI = '<ul>\n<li><strong>Determinação virou Energia (ENER)</strong> — mesmo recurso, novo nome.</li>';
const ITENS_ANTIGOS_FIM = 'além das perícias exclusivas de cada classe.</li>\n</ul>';

const passos = [
    // ---- Livro do Jogador
    async () => {   // cap. 1: a lista "O que mudou" inteira
        const ref = db.doc('worldbuilding-articles/art-regras-jogador-01');
        const d = (await ref.get()).data(); let html = d.contentHTML;
        const i = html.indexOf(ITENS_ANTIGOS_INI); const j = html.indexOf(ITENS_ANTIGOS_FIM);
        if (i < 0 || j < 0) { if (!html.includes('Especializações e Domínios saíram')) avisos.push('⚠️ cap. 1: lista antiga não achada'); return; }
        html = html.slice(0, i) + ITENS_V2 + html.slice(j + ITENS_ANTIGOS_FIM.length);
        html = html.split('<tr><td><strong>Manobra</strong></td><td>Técnica especial de combate que consome Energia.</td></tr>\n').join('');
        html = html.split('Gasta para ativar manobras, magias e melhorar resultados. <em>(Nas versões antigas do livro chamava-se Determinação.)</em>').join('Gasta para ativar habilidades de classe, magias e defesas além da primeira.');
        ops.push({ ref, antes: { contentHTML: d.contentHTML, versao: d.versao ?? null }, data: { contentHTML: html, versao: proximaVersao(d.versao), updatedAt: Date.now() }, log: `${d.title}: lista v2, glossário sem Manobra/Determinação → v${proximaVersao(d.versao)}` });
    },
    editar('art-regras-jogador-05', [['Não existe Domínio à parte: a perícia é a porta.', 'A perícia é a porta; não existe outra licença para usar a peça.']]),
    editar('art-livro-12p-06', [['Não existe Domínio à parte: a perícia é a porta.', 'A perícia é a porta; não existe outra licença para usar a peça.']]),
    editar('art-regras-jogador-06', [['<p>Manobras de classe (posturas, golpes com nome)', '<p>Habilidades de classe (posturas, golpes com nome)']]),
    editar('art-livro-12p-05', [['<p>Manobras de classe (posturas, golpes com nome)', '<p>Habilidades de classe (posturas, golpes com nome)']]),
    editar('art-regras-jogador-09', [
        ['<li><strong>Defesas</strong> — sua Defesa e as perícias de defesa para calcular o Alvo na hora;</li>', '<li><strong>Defesas</strong> — Esquiva, Aparar e Bloquear, cada uma igual ao nível da perícia (Bloquear soma a Qualidade do escudo);</li>'],
        ['<li><strong>Manobras</strong> — as manobras da sua classe com custo em Energia, requisitos e efeito. Manobras bloqueadas mostram o que falta (perícia, atributo ou EXP).</li>', '<li><strong>Módulos de classe</strong> — as habilidades da sua classe com custo em Energia, requisitos e efeito. Habilidade bloqueada mostra o que falta (perícia, atributo ou EXP).</li>'],
    ]),
    livro('book-regras-jogador-v17', '2.01'),
    livro('book-livro-12-paginas', '1.01'),
    // ---- Compêndios
    editar('DWWLpYsx2qOVCMDfZlNh', [['<p><b>Domínio</b> (Peculiaridade, 12 EXP por ofício): sem ele, qualquer um com a perícia grava <em>rascunho</em> — usos travados em 1 e −2 no Teste de Construção. <b>Gravação Rúnica</b> segue sendo a teoria comum dos três: −10% de tempo por nível, em qualquer ofício.</p>',
        '<p><b>A porta é a perícia Runomancia</b>: sem ela, qualquer um grava <em>rascunho</em> — usos travados em 1. É ela também a teoria comum dos três ofícios: −10% de tempo por nível, em qualquer um deles.</p>']]),
    editar('art_ms3gb8qyw3pvwr', [
        ['<p><em>Núcleo v2: as preces pagam Energia; a Graça de Palla saiu (Livro do Jogador, Capítulos 2 e 8). Onde este Compêndio fala em Graça, leia Energia.</em></p>\n', ''],
        ['<h2>Recurso Espiritual</h2>\n<p>A Pallomancia opera com um recurso: a Energia (Núcleo v2 — a Graça saiu; o que segue sobre Graça é registro do modelo anterior). ENERGIA O custo básico para ativar milagres, dobras e golpes radiantes. Gastar Energia como custo de prece não concede o bônus de +3 dados (isso é Impulso, opcional e separado).</p>\n<h2>Graça De Palla</h2>\n<p>Sub-reserva luminosa pessoal — a porção de luz divina que o devoto carrega consigo.</p>\n<h2>Capacidade Máxima Por Arquétipo</h2>\n<p>Arquétipo Fórmula Atributo-chave Pallacerdote maior(PRE, PRS) + Pallomancia (mínimo 1) Presença ou Persuasão Pallamago INT + Pallomancia (mínimo 1) Inteligência Palladino PRS + Pallomancia (mínimo 1) Persuasão</p>\n<h2>Formas De Recarga</h2>',
         '<h2>Recurso</h2>\n<p>A Pallomancia opera com um recurso só: a <strong>Energia</strong> (PRS + AUT + Pallomancia). É o custo de milagres, dobras e golpes radiantes. Gastar Energia como custo de prece não concede o bônus de +3 dados (isso é Impulso, opcional e separado).</p>\n<h2>Formas De Recarga</h2>'],
        ['<tr><td>Prece Breve</td><td>1×/cena; requer luz natural</td><td>+1 Graça</td></tr>', '<tr><td>Prece Breve</td><td>1×/cena; requer luz natural</td><td>+1 Energia</td></tr>'],
        ['<tr><td>Rito de Devoção</td><td>10 min, fora de combate</td><td>+2 Graça</td></tr>', '<tr><td>Rito de Devoção</td><td>10 min, fora de combate</td><td>+2 Energia</td></tr>'],
        ['<tr><td>Exposição Solar direta</td><td>10 min; máx. 1/hora</td><td>+1 Graça</td></tr>', '<tr><td>Exposição Solar direta</td><td>10 min; máx. 1/hora</td><td>+1 Energia</td></tr>'],
        ['<tr><td>Nexo Desperto a ≤30m</td><td>1×/cena; risco de Sifão</td><td>+1 Graça</td></tr>', '<tr><td>Nexo Desperto a ≤30m</td><td>1×/cena; risco de Sifão</td><td>+1 Energia</td></tr>'],
        ['<tr><td>Cura/bênção simples</td><td>1D ou 1G</td></tr>\n<tr><td>Dobra/escudo</td><td>1D + 0–1G</td></tr>\n<tr><td>Rajada ofensiva</td><td>1–2D</td></tr>', '<tr><td>Cura/bênção simples</td><td>1 Energia</td></tr>\n<tr><td>Dobra/escudo</td><td>1–2 Energia</td></tr>\n<tr><td>Rajada ofensiva</td><td>1–2 Energia</td></tr>'],
        ['</table></div><p>A Graça pode substituir Energia em preces — o custo é intercambiável (1D ou 1G). Isso dá ao devoto flexibilidade tática, mas exige gestão cuidadosa de ambos os recursos. ESSÊNCIAS E</p>', '</table></div>'],
        ['permite recarga de Graça (+1/cena)', 'permite recarga de Energia (+1/cena)'],
        ['a cada uso de Graça na cena, o devoto deve fazer', 'a cada prece na cena, o devoto deve fazer'],
        ['Falha: Perde 1 Graça e 1 Energia (exaustão espacial).', 'Falha: Perde 2 Energia (exaustão espacial).'],
        ['Efeito: Recarga total de Graça e suspende Luz Vacilante por 1 cena. Falha: +2 Graça apenas (sem suspender Luz Vacilante).', 'Efeito: recupera Energia igual aos Graus de Sucesso do teste de Devoção e suspende Luz Vacilante por 1 cena. Falha: +2 Energia apenas (sem suspender Luz Vacilante).'],
    ]),
    livro('book_ms3gb8part7b7i', '1.00'),
    livro('book_ms3gb8w3l8qous', '1.00'),
    // ---- Ideias Futuras
    editar('art-classes-futuras', [
        ['Nada aqui está balanceado nem tem Domínio, escada de módulo ou custo em Energia', 'Nada aqui está balanceado nem tem Perícia de Escola, escada de módulo ou custo em Energia'],
        ['As perícias de combate são as onze de defesa e manobra (Aparar, Bloquear, Contra-Ataque…); quem acerta o golpe é a perícia <strong>Arma</strong>.', 'As perícias de combate são oito: Arma, Precisão, Briga, Disparo, Arremesso e as três defesas (Esquiva, Aparar, Bloquear); quem acerta o golpe é a perícia <strong>Arma</strong>.'],
    ]),
    // ---- Régua de Balanceamento
    editar('8aLc6aTVahCWswWdhngK', [['<tr><td>1 Graça, 1 Harmonia</td><td>1,000</td><td>recurso de escola equivale à Energia</td></tr>', '<tr><td>1 Harmonia</td><td>1,000</td><td>recurso de escola equivale à Energia</td></tr>']],
        { prefixo: '<p><em>Núcleo v2 (04/09/2026): o par de referência do §0.2 mudou de regra — Defesa = nível da perícia (Esquiva 2 → Defesa 2) e Blindagem Média Q0 = 2. Refeita a conta com o combate v2: P = 0,50, líquido 6,5, unidade <strong>3,25</strong>. Os carimbos gravados na base 3,90 não são comparáveis com medição nova até serem recompostos. Os capítulos 12 e 13 (Domínio e os schemas da arte) saíram junto com o Domínio.</em></p>\n' }),
    editar('0p00vfreClWjXlAGR9YM', [
        ['Uma magia de 2 Energia + 1 Graça custa', 'Uma magia de 2 Energia + 1 Harmonia custa'],
        ['"Manobras" guarda 19 habilidades de Guerreiro <em>e</em> de Ladino; agrupar por módulo compara', '"Manobras de Guerreiro" e "Manobras de Ladino" guardam 19 habilidades; agrupar por módulo compara'],
    ]),
    editar('9sTazY2j3pqMErvSgkqP', [['"1 Energia <strong>OU</strong> 1 Graça", nunca "1 Energia <strong>e</strong> 1 Graça"', '"1 Energia <strong>OU</strong> 1 Harmonia", nunca "1 Energia <strong>e</strong> 1 Harmonia"']]),
    editar('OOfXN6MfGxSuOeumIifC', [
        ['1 Carga · 1 Energia OU 1 Sanidade · 2 Graça', '1 Carga · 1 Energia OU 1 Sanidade · 2 Harmonia'],
        ['1 Energia = 1 Graça = 1 Harmonia = 1,000', '1 Energia = 1 Harmonia = 1,000'],
        ['recarregava a Graça inteira', 'recarregava a Energia inteira'],
        ['recupera Graça igual aos', 'recupera Energia igual aos'],
        ['· <strong>Pool de Graça de referência</strong> — o ~7 acima é analogia com a Energia (§4.1), não derivação. [A DEFINIR]<br>\n', ''],
    ]),
    apagar('1VveJz9x5MgFGKNkPAoO'),
    apagar('B3G6yZNQmcnEqvLqwb6Z'),
    livro('book-regua-balanceamento', '1.04'),
];
for (const p of passos) await p();

console.log(`\nops: ${ops.length}`);
for (const o of ops) console.log(' ', o.log);
for (const a of avisos) console.log(' ', a);
if (!APPLY) { console.log('\n(dry-run: nada gravado; use --apply)'); process.exit(0); }
fs.mkdirSync(BACKUP_DIR, { recursive: true });
const bk = path.join(BACKUP_DIR, `_backup-livros-2-${agora.replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(bk, JSON.stringify(ops.map(o => ({ doc: o.ref.path, apagar: !!o.apagar, antes: o.antes })), null, 1));
console.log('backup:', bk);
const b = db.batch();
for (const o of ops) o.apagar ? b.delete(o.ref) : b.update(o.ref, o.data);
await b.commit();
console.log(`gravado: ${ops.length}`);
process.exit(0);
