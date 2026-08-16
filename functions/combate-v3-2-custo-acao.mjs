/**
 * Combate v3 — passo 2: o custo de ação vira campo, em todos os módulos de classe.
 *
 * A regra já existia (Régua §0.5: toda habilidade custa 1 Ação Padrão salvo
 * declaração em contrário), mas só 15 das 108 habilidades diziam qualquer coisa
 * sobre ação, e nenhuma num campo. O jogador não tinha onde olhar.
 *
 * Este script acrescenta um `select` somente-leitura "Ação:" ao schema de cada
 * módulo e preenche o valor de todas as habilidades. O padrão é Ação Padrão;
 * só as exceções abaixo saem dele.
 *
 *   node functions/combate-v3-2-custo-acao.mjs            (dry-run)
 *   node functions/combate-v3-2-custo-acao.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const CHAVE = 'acao';
const PADRAO = 'Ação Padrão';
const OPCOES = ['Ação Padrão', 'Ação de Movimento', 'Ação Livre',
    'Ação Completa (turno inteiro)', 'Reação', 'Sustentada (1 Padrão/turno)', 'Fora de combate'];

/* Exceções, por nome exato da habilidade. Tudo que não está aqui é Ação Padrão. */
const EXCECOES = {
    // Postura se adota no início do turno, sem gastar o golpe (Livro §6.9).
    'Postura Ofensiva': 'Ação Livre',
    'Postura Defensiva': 'Ação Livre',
    // Cólera reescrita (combate v3): entra de graça no fluxo do turno.
    'Cólera': 'Ação Livre',
    // Já declarado no próprio texto.
    'Passos Sombrios': 'Ação de Movimento',
    'Salto Predatório': 'Ação Completa (turno inteiro)',
    // "ação gratuita" não existe no sistema (§0.5); a intenção é Ação Livre.
    'Troca de Mãos': 'Ação Livre',
    // Converte economia de ação no próprio turno.
    'Sombra Acelerada': 'Ação Livre',
    // Transe / preparação longa: consomem o turno inteiro.
    'Armadura Sanguínea': 'Ação Completa (turno inteiro)',
    'Fechamento de Fenda': 'Ação Completa (turno inteiro)',
    'Transcendência — Projetor': 'Ação Completa (turno inteiro)',
    'Fusão Selvagem': 'Ação Completa (turno inteiro)',
    // Ritual: não cabe numa rodada.
    'Reconsagração do Santuário': 'Fora de combate',
    'Exorcismo Menor': 'Fora de combate',
    'Peregrinação do Amanhecer': 'Fora de combate',
    'Cura de Nexo Menor': 'Fora de combate',
    'RITUAL DE REANIMAÇÃO': 'Fora de combate',
    'Vincular Eco (Antiqua)': 'Fora de combate',
    'Libertar Eco Aprisionado': 'Fora de combate',
    'Plano Mental Inferior': 'Fora de combate',
    'Ocultação de Eco Abissal': 'Fora de combate',
};

/* Ficam no padrão, mas o texto original é ambíguo — o relatório destaca. */
const A_CONFIRMAR = {
    'Engodo': '"custa 1 ação adicional" — adicional a quê?',
    'Loção de Veneno Simples I': 'preparar é fora de combate; aplicar na lâmina é Padrão ou Movimento?',
};
const PREFIXO_LOCAO = 'Loção';

const snap = await db.collection('system/data/classModules').get();
const mods = snap.docs.map(d => ({ _ref: d.ref, id: d.id, ...d.data() }));

const mudancas = [], relatorio = [], semDescricao = [], locoes = [];
const contagem = Object.fromEntries(OPCOES.map(o => [o, 0]));

for (const m of mods) {
    if (m.id === 'Manobras') continue;                     // módulo aposentado
    const schema = Array.isArray(m.schema) ? [...m.schema] : [];
    if (schema.some(f => f.key === CHAVE)) { relatorio.push(`  ⚠ já tem campo Ação: ${m.titulo}`); continue; }

    const campo = {
        key: CHAVE, tipo: 'select', label: 'Ação:', largura: 'quarto',
        placeholder: '', somenteLeitura: true, opcoes: OPCOES,
    };
    // Entra logo depois do "Custo:" (onde existe) — os dois custos ficam juntos.
    const iCusto = schema.findIndex(f => /^custo/i.test(f.label || ''));
    schema.splice(iCusto >= 0 ? iCusto + 1 : Math.min(1, schema.length), 0, campo);

    const itens = (m.itensPredefinidos || []).map(it => {
        const nome = it.nome || '';
        const valor = EXCECOES[nome] || PADRAO;
        contagem[valor]++;
        if (valor !== PADRAO) relatorio.push(`  ${valor.padEnd(30)} ${nome}`);
        if (nome.startsWith(PREFIXO_LOCAO)) locoes.push(nome);
        const semDesc = !(it.descricao || '').trim() || (it.descricao || '').trim() === nome;
        if (semDesc) semDescricao.push(`${m.titulo} :: ${nome}`);
        return { ...it, valores: { ...(it.valores || {}), [CHAVE]: valor } };
    });

    mudancas.push({ ref: m._ref, titulo: m.titulo || m.id, schema, itens, n: itens.length });
}

console.log('='.repeat(72));
console.log('COMBATE v3 — passo 2: campo "Ação:" nos módulos de classe');
console.log('='.repeat(72));
console.log(`\nCampo: select somente-leitura, ${OPCOES.length} opções, inserido após "Custo:".`);
console.log(`Módulos: ${mudancas.length}   Habilidades: ${mudancas.reduce((s, m) => s + m.n, 0)}\n`);

console.log('EXCEÇÕES APLICADAS (o resto fica em Ação Padrão):');
relatorio.sort().forEach(l => console.log(l));

console.log('\nDISTRIBUIÇÃO:');
for (const [o, n] of Object.entries(contagem)) if (n) console.log(`  ${String(n).padStart(3)} × ${o}`);

console.log('\n⚠ FICAM NO PADRÃO MAS PRECISAM DA SUA DECISÃO:');
for (const [nome, motivo] of Object.entries(A_CONFIRMAR)) console.log(`  ${nome.padEnd(28)} ${motivo}`);
console.log(`  ${String(locoes.length).padStart(2)} Loções no total — a decisão vale para todas.`);

console.log(`\n⚠ ${semDescricao.length} HABILIDADES SEM TEXTO DE EFEITO (ficam no padrão por falta de base):`);
semDescricao.forEach(l => console.log('  ' + l));

/* auto-verificação */
const erros = [];
const totalItens = mudancas.reduce((s, m) => s + m.n, 0);
if (totalItens !== 108) erros.push(`esperava 108 habilidades, contei ${totalItens}`);
if (mudancas.length !== 23) erros.push(`esperava 23 módulos, contei ${mudancas.length}`);
for (const m of mudancas) {
    if (!m.schema.some(f => f.key === CHAVE)) erros.push(`${m.titulo}: campo não entrou no schema`);
    const semValor = m.itens.filter(it => !OPCOES.includes(it.valores[CHAVE]));
    if (semValor.length) erros.push(`${m.titulo}: ${semValor.length} item(ns) sem valor válido`);
}
const naoCasou = Object.keys(EXCECOES).filter(n =>
    !mudancas.some(m => m.itens.some(it => (it.nome || '') === n)));
if (naoCasou.length) erros.push(`exceções que não casaram com nenhuma habilidade: ${naoCasou.join(', ')}`);

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
console.log('\n✅ auto-verificação: 23 módulos, 108 habilidades, todas com valor válido, todas as exceções casaram.');

if (!APPLY) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const batch = db.batch();
for (const m of mudancas) batch.update(m.ref, { schema: m.schema, itensPredefinidos: m.itens, updatedAt: Date.now() });
await batch.commit();
console.log(`\n✅ Gravado: ${mudancas.length} módulos, ${totalItens} habilidades com custo de ação.`);
process.exit(0);
