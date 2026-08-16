/**
 * Combate v3 — passo 6: as cinco pendências rápidas.
 *
 *  1. Engodo         gastava a Ação Padrão (3,10 de dano) para dar +1,10 no golpe
 *                    seguinte — saldo −2,00. Vira Ação Livre e perde o teste
 *                    disputado (que não cabe num sistema de uma rolagem) e o
 *                    reembolso de Energia, que não existe em nenhuma outra manobra.
 *                    → +1,10 por ENER, o piso da faixa, que é o lugar certo de um
 *                      efeito repetível e sem requisito.
 *  2. Loções         nada a fazer: §6.2 já diz que usar item é Ação Padrão. Só
 *                    acrescenta "aplicar loção em arma ou projétil" à lista da
 *                    Ação de Movimento, por analogia com recarregar projétil.
 *  3. Cólera         custoExpProprio 1 → 5. Sinaliza o ápice do Guerreiro.
 *  4. Salto Predat.  confirma sem custo em Energia (o turno inteiro é o preço) e
 *                    limpa o "Custa 2 ações" que hoje duplica o campo Ação.
 *  5. Golpe Preciso  o Livro dizia "metade da Blindagem" (+0,50/ENER, morta) e o
 *                    módulo do Ladino dizia "a Blindagem" (+1,00). Alinha o Livro:
 *                    mata a contradição e tira a manobra básica do cemitério.
 *
 *   node functions/combate-v3-6-pendencias.mjs            (dry-run)
 *   node functions/combate-v3-6-pendencias.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const ENGODO_NOVO =
    'Você finge um golpe para abrir a guarda do inimigo. '
    + 'O seu próximo ataque neste turno ignora a Defesa do alvo.';

/* nome → { acao, doc, descricao: [de, para] | texto novo, motivo } */
const AJUSTES = {
    'Engodo': {
        acao: 'Ação Livre',
        descricaoNova: ENGODO_NOVO,
        motivo: 'Ação Padrão → Livre, sem teste disputado, sem reembolso de Energia · −2,00 → +1,10 por ENER',
    },
    'Cólera': {
        doc: { custoExpProprio: 5 },
        motivo: 'custava 1 EXP, igual à Postura Ofensiva, valendo 3× o que ela vale',
    },
    'Salto Predatório': {
        trecho: ['Custa 2 ações. Com o alvo visível', 'Com o alvo visível'],
        motivo: 'o "Custa 2 ações" duplicava o campo Ação; sem custo em Energia, o turno é o preço',
    },
};

/* Livro de Regras. Trecho não encontrado = ABORTA. */
const LIVRO = [
    ['§6.2 — aplicar loção entra na Ação de Movimento',
        '<li><strong>1 Ação de Movimento</strong> — mover-se até seu Deslocamento, recarregar arma de projétil, pegar item;</li>',
        '<li><strong>1 Ação de Movimento</strong> — mover-se até seu Deslocamento, recarregar arma de projétil, aplicar loção em arma ou projétil, pegar item;</li>'],
    ['§6.9 — Golpe Preciso alinhado ao módulo do Ladino',
        '<tr><td><strong>Golpe Preciso</strong></td><td>1 ENER</td><td>Ignora metade da Blindagem do alvo (arredonda para baixo).</td></tr>',
        '<tr><td><strong>Golpe Preciso</strong></td><td>1 ENER</td><td>Ignora a Blindagem do alvo neste golpe. O Ladino tem uma versão própria dela na ficha, que também troca o Alvo para Precisão.</td></tr>'],
];

const snap = await db.collection('system/data/classModules').get();
const mods = snap.docs.map(d => ({ _ref: d.ref, id: d.id, ...d.data() }));

const feitos = [], erros = [];
for (const m of mods) {
    if (m.id === 'Manobras') continue;              // módulo aposentado, fica fora
    let mexeu = false;
    const itens = (m.itensPredefinidos || []).map(it => {
        const aj = AJUSTES[it.nome || ''];
        if (!aj) return it;
        mexeu = true;

        const antes = it.descricao || '';
        let depois = antes;
        if (aj.descricaoNova) depois = aj.descricaoNova;
        if (aj.trecho) {
            const [de, para] = aj.trecho;
            if (!antes.includes(de)) erros.push(`${it.nome}: trecho não encontrado → "${de}"`);
            depois = antes.split(de).join(para);
        }

        const valores = { ...(it.valores || {}) };
        if (aj.acao) valores.acao = aj.acao;
        // O campo "Efeito:" (5) espelha a descrição nos módulos de manobra.
        if (depois !== antes && typeof valores['5'] === 'string') valores['5'] = depois;

        feitos.push({
            modulo: m.titulo, nome: it.nome, motivo: aj.motivo,
            acao: aj.acao ? `${(it.valores || {}).acao} → ${aj.acao}` : null,
            exp: aj.doc ? `${it.custoExpProprio} → ${aj.doc.custoExpProprio}` : null,
            antes: depois !== antes ? antes : null, depois: depois !== antes ? depois : null,
        });
        return { ...it, descricao: depois, valores, ...(aj.doc || {}) };
    });
    if (mexeu) m._novosItens = itens;
}

const naoAchados = Object.keys(AJUSTES).filter(n => !feitos.some(f => f.nome === n));
if (naoAchados.length) erros.push(`habilidades não encontradas: ${naoAchados.join(', ')}`);

const refLivro = db.collection('worldbuilding-articles').doc('art-regras-jogador-06');
let html = (await refLivro.get()).data().contentHTML || '';
const livroFeitos = [];
for (const [rot, de, para] of LIVRO) {
    if (!html.includes(de)) { erros.push(`Livro: trecho não encontrado — ${rot}`); continue; }
    html = html.split(de).join(para);
    livroFeitos.push(rot);
}

console.log('='.repeat(74));
console.log('COMBATE v3 — passo 6: pendências');
console.log('='.repeat(74));
for (const f of feitos) {
    console.log(`\n  ${f.nome}   [${f.modulo}]`);
    if (f.acao) console.log(`    Ação: ${f.acao}`);
    if (f.exp) console.log(`    custoExpProprio: ${f.exp}`);
    if (f.antes) {
        console.log(`    ANTES:  ${f.antes}`);
        console.log(`    DEPOIS: ${f.depois}`);
    }
    console.log(`    ${f.motivo}`);
}
console.log('\nLIVRO DE REGRAS:');
livroFeitos.forEach(r => console.log(`  ✔ ${r}`));
console.log('\nAS 8 LOÇÕES: nenhuma mudança de campo — §6.2 já as põe em Ação Padrão ("usar item").');

/* auto-verificação */
if (feitos.length !== Object.keys(AJUSTES).length)
    erros.push(`${Object.keys(AJUSTES).length} ajustes previstos, ${feitos.length} aplicados`);
if (livroFeitos.length !== LIVRO.length)
    erros.push(`${LIVRO.length} trocas no Livro previstas, ${livroFeitos.length} aplicadas`);
if (/metade da Blindagem/.test(html)) erros.push('Livro ainda diz "metade da Blindagem"');

const conferir = {
    'Engodo': it => it.valores.acao === 'Ação Livre' && it.descricao === ENGODO_NOVO
        && !/teste|adicional/i.test(it.descricao) && it.valores['5'] === ENGODO_NOVO,
    'Cólera': it => it.custoExpProprio === 5,
    'Salto Predatório': it => !it.descricao.includes('Custa 2 ações')
        && it.descricao.startsWith('Com o alvo visível') && it.valores['3'] === '—',
};
for (const m of mods) for (const it of (m._novosItens || [])) {
    const chk = conferir[it.nome];
    if (chk && !chk(it)) erros.push(`${it.nome}: patch não passou na conferência`);
}

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
console.log(`\n✅ auto-verificação: ${feitos.length} habilidades, ${livroFeitos.length} trechos do Livro, tudo conferido.`);

if (!APPLY) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const batch = db.batch();
let nMods = 0;
for (const m of mods) if (m._novosItens) { batch.update(m._ref, { itensPredefinidos: m._novosItens, updatedAt: Date.now() }); nMods++; }
batch.update(refLivro, {
    contentHTML: html, updatedAt: Date.now(),
    words: html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
});
await batch.commit();
console.log(`\n✅ Gravado: ${feitos.length} habilidades em ${nMods} módulos + 2 trechos do Livro.`);
process.exit(0);
