/**
 * Acerto: o modificador genérico passa a descer pelos VDs tipados.
 *
 * Como o motor calcula uma coluna de item (item-scope-calc.js:78):
 *     total do item = base global do VD  +  delta da Equação de Valor do item
 *
 * Desenho ANTIGO: a base dos tipados era 0 e cada equação de item precisava
 * lembrar de somar `+ Acerto` no fim. Sessenta e duas lembraram; vinte não —
 * e essas vinte (todos os focos mágicos e instrumentos do Bardo) não recebiam
 * peculiaridade, condição nem a penalidade de escudo. Esquecer o termo num item
 * novo era um bug silencioso.
 *
 * Desenho NOVO: cada VD tipado recebe `+ [Acerto]` como mecânica, então a base
 * global dele JÁ é o modificador genérico. A equação do item volta a ser só o
 * que é do item: atributo + perícia. O termo `+ Acerto` sai das 62.
 *
 *     Acerto ................. modificador que vale para TODOS os tipos
 *     Acerto <tipo> .......... base = Acerto, mais o que for só daquele tipo
 *     equação do item ........ atributo + perícia daquela arma
 *
 * Ganho: os 20 focos passam a receber modificador sem eu tocar em nenhum deles.
 *
 * Nota de motor: VD que lê VD usa o valor do recálculo anterior e converge no
 * passe seguinte — mesmo comportamento de Iniciativa→Tamanho e das Defesas.
 *
 * Também despublica a Lança de Simples: publicada, sem fórmula de dano, sem
 * preço, sem liga, descrição cortada no meio e sem nenhum dono entre os 13
 * personagens. Completá-la é decidir dano e preço — trabalho do /balancear-item.
 *
 *   node functions/fix-acerto-arquitetura.mjs            (dry-run)
 *   node functions/fix-acerto-arquitetura.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const AUTOR = 'M2rZzlQkzxTrrddeFQ10S6zsfX62';
const LANCA = 'YSxegZYHfaxOtpjI3Rkw';

const TIPADOS = {
    '20CCFbc4ngJIOorNb9K0': 'Acerto Corpo a Corpo',
    'N1JLG2HeKHOL9UEzrQU4': 'Acerto à Distância',
    'H9VopkYPpDz3MXssdHP9': 'Acerto Desarmado',
    '2XFDxbiiu22nJ76qrOzd': 'Acerto Mágico',
};

const DESC = nome => `Acerto para este tipo de entrega, e é a coluna dele na aba Combate. `
    + `A base deste campo é o Valor Derivado "Acerto" — o modificador genérico (peculiaridade, `
    + `condição, classe, raça, escudo), que desce automaticamente para cá. Some aqui só o que `
    + `valer SÓ para ${nome.replace('Acerto ', '').toLowerCase()}. O atributo e a perícia de cada `
    + `arma NÃO entram aqui: saem da Equação de Valor montada no próprio item, no cadastro de `
    + `Equipamentos. Total por arma = este valor + a equação daquela arma.`;

const colVD = db.collection('system/data/derivedValues');
const colMec = db.collection('system/data/mechanics');
const colEq = db.collection('system/data/equipment');

const [vdSnap, eqSnap] = await Promise.all([colVD.get(), colEq.get()]);
const vds = vdSnap.docs.map(d => ({ _ref: d.ref, id: d.id, ...d.data() }));
const erros = [];

/* ---- 1. mecânica "+ [Acerto]" em cada tipado ---- */
const novasMecs = [];
for (const [id, nome] of Object.entries(TIPADOS)) {
    const vd = vds.find(v => v.id === id);
    if (!vd) { erros.push(`VD tipado não encontrado: ${nome} (${id})`); continue; }
    if (vd.nome !== nome) erros.push(`${id} se chama "${vd.nome}", esperado "${nome}"`);
    if ((vd.mecanicaIds || []).length) erros.push(`${nome} já tem mecânica: ${JSON.stringify(vd.mecanicaIds)}`);
    novasMecs.push({ vd, nome });
}

/* ---- 2. tirar o termo "+ Acerto" das equações de item ---- */
const itensPatch = [];
let termosRemovidos = 0;
for (const d of eqSnap.docs) {
    const e = d.data();
    const vs = e.valoresDerivadosVinculados;
    if (!Array.isArray(vs)) continue;
    let mexeu = false;
    const novo = vs.map(v => {
        if (!TIPADOS[v.id] || !Array.isArray(v.equacao)) return v;
        const limpa = v.equacao.filter(t => !(t && t.ref === 'Acerto' && t.tipo === 'ficha'));
        if (limpa.length === v.equacao.length) return v;
        if (limpa.length === 0) { erros.push(`${e.nome}: remover "Acerto" esvaziaria a equação`); return v; }
        // o primeiro termo não pode carregar operador
        if (limpa[0].op) { const { op, ...resto } = limpa[0]; limpa[0] = resto; }
        termosRemovidos += v.equacao.length - limpa.length;
        mexeu = true;
        return { ...v, equacao: limpa };
    });
    if (mexeu) itensPatch.push({ ref: d.ref, nome: e.nome, valoresDerivadosVinculados: novo });
}

/* ---- 3. Lança de Simples ---- */
const lanca = eqSnap.docs.find(d => d.id === LANCA);
if (!lanca) erros.push('Lança de Simples não encontrada');
else {
    const l = lanca.data();
    if (l.formulaDano) erros.push('Lança de Simples agora TEM fórmula de dano — confira antes de despublicar');
    if (l.publicado === false) erros.push('Lança de Simples já está despublicada');
}

console.log('='.repeat(74));
console.log('ACERTO — o genérico desce pelos VDs tipados');
console.log('='.repeat(74));
console.log('\n1) MECÂNICA "+ [Acerto]" NOS TIPADOS:');
novasMecs.forEach(m => console.log(`   ✔ ${m.nome.padEnd(24)} base passa a ser o Acerto genérico`));
console.log('\n2) TERMO "+ Acerto" REMOVIDO DAS EQUAÇÕES DE ITEM:');
console.log(`   ${itensPatch.length} itens, ${termosRemovidos} termos`);
console.log(`   exemplo — ${itensPatch[0]?.nome}: ${JSON.stringify(
    itensPatch[0]?.valoresDerivadosVinculados.find(v => TIPADOS[v.id])?.equacao)}`);
console.log('\n3) OS 20 FOCOS MÁGICOS: nenhuma edição — passam a receber o genérico pela base.');
console.log('\n4) LANÇA DE SIMPLES: publicado true → false (incompleta, sem dono).');

/* ---- auto-verificação ---- */
if (novasMecs.length !== 4) erros.push(`esperava 4 VDs tipados, achei ${novasMecs.length}`);
if (itensPatch.length !== 62) erros.push(`esperava 62 itens com o termo, achei ${itensPatch.length}`);
if (termosRemovidos !== itensPatch.length) erros.push(`${itensPatch.length} itens mas ${termosRemovidos} termos — algum item tinha o termo duas vezes`);
for (const p of itensPatch) for (const v of p.valoresDerivadosVinculados) {
    if (!TIPADOS[v.id] || !Array.isArray(v.equacao)) continue;
    if (v.equacao.some(t => t.ref === 'Acerto')) erros.push(`${p.nome}: sobrou o termo Acerto`);
    if (v.equacao[0] && v.equacao[0].op) erros.push(`${p.nome}: primeiro termo ficou com operador`);
    if (!v.equacao.length) erros.push(`${p.nome}: equação vazia`);
}

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
console.log(`\n✅ auto-verificação: 4 tipados livres, ${itensPatch.length} equações limpas, nenhuma vazia, nenhum operador solto.`);

if (!APPLY) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const agora = admin.firestore.Timestamp.now();
const baseMec = {
    fonte: 'individual', tipo: 'modificar', duracao: 'permanente', duracaoTurnos: null,
    duracaoEspecial: '', escopo: 'proprio', condicaoAplicacao: '', empilhamento: 'soma',
    evoluivel: false, nivelMaximo: null, progressao: null, progressaoApenasCriacao: false,
    progressaoTipoExp: 'custo', tags: ['Valor Derivado', 'Acerto'], publicado: true,
    criadoPor: AUTOR, criadoEm: agora, atualizadoEm: agora, versao: 1,
};

const batch = db.batch();
for (const { vd, nome } of novasMecs) {
    const ref = colMec.doc();
    batch.set(ref, {
        ...baseMec, nome: `${nome} (genérico)`,
        descricao: 'O modificador genérico de Acerto desce para este tipo de entrega.',
        previewTexto: `+[Acerto] em ${nome}`,
        config: { calculos: [{ alvo: nome, operacao: '+', equacao: [{ tipo: 'ficha', ref: 'Acerto' }] }] },
    });
    batch.update(vd._ref, { mecanicaIds: [ref.id], descricao: DESC(nome), updatedAt: agora, atualizadoEm: agora });
}
for (const p of itensPatch) batch.update(p.ref, { valoresDerivadosVinculados: p.valoresDerivadosVinculados, updatedAt: agora });
batch.update(colEq.doc(LANCA), {
    publicado: false,
    descricao: (lanca.data().descricao || '').trim()
        + ' [INCOMPLETA — sem fórmula de dano, preço nem liga. Despublicada até ser balanceada.]',
    updatedAt: agora,
});
await batch.commit();
console.log(`\n✅ Gravado: 4 mecânicas novas, ${itensPatch.length} equações limpas, Lança de Simples despublicada.`);
process.exit(0);
