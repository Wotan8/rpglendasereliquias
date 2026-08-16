/**
 * Frente 2 — o foco mágico volta a valer alguma coisa.
 *
 * Havia DOIS caminhos paralelos que não se falavam:
 *
 *   A) `Acerto Mágico` — coluna do foco na tabela de Ataques.
 *      Talismã Abissal = Qualidade(min Teto) + PRS + Perícia: Abismancia
 *   B) o campo `Teste:` do módulo de classe, apontando para um VD de escola.
 *      Contato Abismântico = PRS + Performance + Conexão + Contato c/ o Oitavo − 3
 *
 * A magia resolve pelo caminho B. O caminho A duplicava o atributo e a perícia,
 * e — pior — a QUALIDADE DO FOCO só existia no caminho A. Comprar um talismã
 * melhor não ajudava a conjurar nada.
 *
 * Decisão: o caminho B é o oficial. O foco passa a contribuir com o que é dele
 * e só isso — a Qualidade, limitada pelo Teto de Ofício da escola — por um VD
 * novo, `Qualidade do Foco`, que as fórmulas de escola somam.
 *
 *     foco equipado ....... Qualidade do Foco = Item: Qualidade (min Teto da escola)
 *     VD de escola ........ atributo + perícias + Qualidade do Foco
 *
 * O `Acerto Mágico` deixa de ser alimentado. Como o foco não tem fórmula de dano
 * (e não deve ter — quem dá dano é a magia), ele some da tabela de Ataques, que
 * é onde ele nunca devia ter estado.
 *
 *   node functions/foco-magico-qualidade.mjs            (dry-run)
 *   node functions/foco-magico-qualidade.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const AUTOR = 'M2rZzlQkzxTrrddeFQ10S6zsfX62';
const VD_ACERTO_MAGICO = '2XFDxbiiu22nJ76qrOzd';
const NOVO_VD = 'Qualidade do Foco';

/* Módulos cuja escola TEM foco no catálogo. Módulo sem foco (Sangral, Druida,
 * Caçador) fica de fora: não existe peça para melhorar. */
const MODULOS_COM_FOCO = [
    'Círculo do Bispo da Luz', 'Círculo do Diácono da Luz', 'Círculo do Sábio da Luz',
    'Rituais e Liturgia', 'Rituais de Invocação Abissal', 'Rituais Necromânticos',
    'Rituais da Totemancia', 'Cartucho Rúnico',
    'Custo 1 — Abertura', 'Custo 2 — Desenvolvimento', 'Custo 3 — Clímax',
    'Custo 4 — Apoteose', 'Custo 5 — Opus Magnum',
];

const colVD = db.collection('system/data/derivedValues');
const colMec = db.collection('system/data/mechanics');
const colEq = db.collection('system/data/equipment');

const [vdSnap, mecSnap, eqSnap, modSnap] = await Promise.all([
    colVD.get(), colMec.get(), colEq.get(), db.collection('system/data/classModules').get()]);
const vds = vdSnap.docs.map(d => ({ _ref: d.ref, id: d.id, ...d.data() }));
const mecs = Object.fromEntries(mecSnap.docs.map(d => [d.id, { _ref: d.ref, id: d.id, ...d.data() }]));
const erros = [];

if (vds.some(v => v.nome === NOVO_VD)) erros.push(`VD "${NOVO_VD}" já existe`);

/* ---- 1. os 20 focos: Acerto Mágico → Qualidade do Foco, só a Qualidade ---- */
const focos = [];
for (const d of eqSnap.docs) {
    const e = d.data();
    const v = (e.valoresDerivadosVinculados || []).find(x => x.id === VD_ACERTO_MAGICO);
    if (!v || !Array.isArray(v.equacao)) continue;
    // Só a parte do item: Qualidade e o Teto de Ofício que a limita.
    const soDoItem = v.equacao.filter(t =>
        t.ref === 'Item: Qualidade' || /^Teto de Ofício/.test(t.ref || ''));
    if (!soDoItem.length) { erros.push(`${e.nome}: equação sem Qualidade nem Teto`); continue; }
    if (soDoItem[0].op) { const { op, ...r } = soDoItem[0]; soDoItem[0] = r; }
    const teto = (soDoItem.find(t => /^Teto de Ofício/.test(t.ref || '')) || {}).ref || '(sem teto)';
    focos.push({
        ref: d.ref, nome: e.nome, teto, novaEq: soDoItem,
        antes: v.equacao.map(t => (t.op ? t.op + ' ' : '') + t.ref).join(' '),
        outros: (e.valoresDerivadosVinculados || []).filter(x => x.id !== VD_ACERTO_MAGICO),
    });
}

/* ---- 2. VDs de escola que ganham o termo ---- */
const alvos = new Map();
for (const d of modSnap.docs) {
    const m = d.data();
    if (!MODULOS_COM_FOCO.includes(m.titulo || '')) continue;
    const campos = (m.schema || []).filter(f => f.tipo === 'select_vd');
    for (const it of (m.itensPredefinidos || [])) for (const f of campos) {
        const id = it.valores?.[f.key];
        const vd = id && vds.find(v => v.id === id);
        if (!vd) continue;
        if (!alvos.has(vd.id)) alvos.set(vd.id, { vd, modulos: new Set() });
        alvos.get(vd.id).modulos.add(m.titulo);
    }
}

const patchMec = [], semFormula = [];
for (const { vd, modulos } of alvos.values()) {
    const donos = (vd.mecanicaIds || []).map(i => mecs[i]).filter(Boolean)
        .filter(m => (m.config?.calculos || []).some(c => c.alvo === vd.nome && c.operacao === '+'));
    if (!donos.length) { semFormula.push(`${vd.nome} (usado por ${[...modulos].join(', ')})`); continue; }
    if (donos.length > 1) { erros.push(`${vd.nome}: ${donos.length} mecânicas de fórmula — ambíguo`); continue; }
    const mec = donos[0];
    /* a mecânica não pode ser compartilhada com outro VD */
    const compartilhada = vds.filter(v => v.id !== vd.id && (v.mecanicaIds || []).includes(mec.id));
    if (compartilhada.length) { erros.push(`${vd.nome}: mecânica ${mec.id} também usada por ${compartilhada.map(v => v.nome).join(', ')}`); continue; }
    const calc = mec.config.calculos.find(c => c.alvo === vd.nome && c.operacao === '+');
    if ((calc.equacao || []).some(t => t.ref === NOVO_VD)) continue;   // idempotente
    patchMec.push({ mec, calc, vd, modulos: [...modulos] });
}

console.log('='.repeat(76));
console.log('FOCO MÁGICO — a Qualidade volta a valer, pelo caminho oficial');
console.log('='.repeat(76));
console.log(`\n1) NOVO VD: "${NOVO_VD}" (global, base 0)\n`);
console.log(`2) OS ${focos.length} FOCOS — deixam de alimentar "Acerto Mágico":`);
for (const f of focos) console.log(`   ${f.nome.slice(0, 30).padEnd(32)} ${f.antes}\n${' '.repeat(35)}→ ${f.novaEq.map(t => (t.op ? t.op + ' ' : '') + t.ref).join(' ')}`);
console.log(`\n3) VDs DE ESCOLA QUE GANHAM "+ ${NOVO_VD}" (${patchMec.length}):`);
for (const p of patchMec) console.log(`   ${p.vd.nome.padEnd(28)} ← ${p.modulos.join(', ')}`);
if (semFormula.length) {
    console.log(`\n⚠ SEM FÓRMULA PRÓPRIA — ficam de fora (somar o foco sozinho daria um Alvo sem atributo):`);
    semFormula.forEach(s => console.log('   ' + s));
}
console.log(`\n4) "Acerto Mágico" fica sem nenhum item alimentando. O foco some da tabela de`);
console.log(`   Ataques — correto: foco não é arma, e quem dá dano é a magia.`);

if (focos.length !== 20) erros.push(`esperava 20 focos, achei ${focos.length}`);
if (!patchMec.length) erros.push('nenhum VD de escola casou');
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
console.log(`\n✅ auto-verificação: ${focos.length} focos, ${patchMec.length} fórmulas de escola, nenhuma mecânica compartilhada.`);

if (!APPLY) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const agora = admin.firestore.Timestamp.now();
const refNovo = colVD.doc();
const batch = db.batch();

batch.set(refNovo, {
    nome: NOVO_VD, icone: '🔮', ordem: 25,
    blocoId: 'ataque-item', blocoNome: 'Modificadores de Ataque', blocoOrdem: 30,
    descricao: 'Quanto o seu foco equipado (talismã, tomo, totem, símbolo, instrumento) acrescenta '
        + 'aos testes da escola dele. Sai da Qualidade da peça, limitada pelo Teto de Ofício da escola. '
        + 'A base é 0 — sem foco equipado, vale 0. Este valor entra nas fórmulas de teste de magia '
        + '(Bênção, Contato Abismântico, Inst. Cordas...), não numa coluna de ataque: quem causa dano '
        + 'é a magia, não o foco.',
    escopoItem: '', arredondaMesa: false, todoPersonagem: true,
    prefixo: '', sufixo: '', mecanicaIds: [],
    campoAtual: false, campoEditavel: false, statusCombate: false,
    characterCreationRule: false, characterCreationMin: null, characterCreationMax: null,
    publicado: true, criadoPor: AUTOR, criadoEm: agora, createdAt: agora, updatedAt: agora, versao: 1,
});

for (const f of focos) {
    batch.update(f.ref, {
        valoresDerivadosVinculados: [...f.outros, { id: refNovo.id, escopo: 'global', equacao: f.novaEq }],
        updatedAt: Date.now(),
    });
}

for (const p of patchMec) {
    const calculos = p.mec.config.calculos.map(c =>
        (c === p.calc || (c.alvo === p.vd.nome && c.operacao === '+'))
            ? { ...c, equacao: [...(c.equacao || []), { tipo: 'ficha', op: '+', ref: NOVO_VD }] }
            : c);
    batch.update(p.mec._ref, {
        config: { ...p.mec.config, calculos },
        previewTexto: String(p.mec.previewTexto || '').replace(/\) em /, ` + [${NOVO_VD}]) em `),
        atualizadoEm: agora,
    });
}

await batch.commit();
console.log(`\n✅ Gravado: VD "${NOVO_VD}", ${focos.length} focos religados, ${patchMec.length} fórmulas de escola.`);
process.exit(0);
