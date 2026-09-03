/**
 * Varredor de referências: percorre toda equação e todo vínculo dos cadastros do
 * sistema e lista cada nome referenciado (atributo, "Perícia: X", VD, vital,
 * "Item: X"), acusando os que não existem em lugar nenhum. Só leitura.
 *
 *   node functions/v2-refs.mjs            (resumo + órfãs)
 *   node functions/v2-refs.mjs --tudo     (também a lista completa de refs por origem)
 *   node functions/v2-refs.mjs --ref "Perícia: Agilidade"   (quem cita essa ref)
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const TUDO = process.argv.includes('--tudo');
const iRef = process.argv.indexOf('--ref');
const PROCURA = iRef > -1 ? process.argv[iRef + 1] : null;

const norm = s => String(s || '').trim();
const col = async n => { const s = await db.collection(`system/data/${n}`).get(); return s.docs.map(d => ({ ...d.data(), id: d.id })); };

const [skills, vds, vitals, mechanics, equipment, classModules, peculiarities, conditions, classes, races, tribes, runicElements] = await Promise.all(
    ['skills', 'derivedValues', 'vitalStats', 'mechanics', 'equipment', 'classModules', 'peculiarities', 'conditions', 'classes', 'races', 'tribes', 'runicElements'].map(col));

// ---- universo de nomes válidos ----
const ATTR = new Set(['INT', 'RAC', 'PRS', 'FOR', 'DES', 'VIG', 'PRE', 'MAN', 'AUT']);
const skillNames = new Set(skills.filter(s => s.publicado !== false).map(s => norm(s.nome)));   // despublicada é órfã: ninguém deve citar
const vdNames = new Set();
for (const v of vds) { const n = norm(v.nome); ['', ' (Atual)', ' (Máximo)', ' (Máxima)'].forEach(suf => vdNames.add(n + suf)); }
// alvos que o motor conhece sem serem VD: EXP livre da ficha e a pressão do inventário
['EXP', 'Pressão Total (Equipados)'].forEach(n => vdNames.add(n));
for (const r of runicElements) vdNames.add('Elemento Rúnico: ' + norm(r.nome));
const vitalNames = new Set();
for (const v of vitals) { const n = norm(v.nome); ['', ' Atual', ' Máxima', ' Máximo', ' Max', ' (Atual)', ' (Máximo)', ' (Máxima)'].forEach(suf => vitalNames.add(n + suf)); }
const ITEM_PROPS = new Set(['Item: Qualidade', 'Item: Afiação', 'Item: Afiação Arcana', 'Item: Reforço', 'Item: Liga', 'Item: Integridade', 'Projétil: Qualidade', 'Projétil: Afiação']);
const mechIds = new Set(mechanics.map(m => m.id));
const vdIds = new Set(vds.map(v => v.id));
const skillIds = new Set(skills.map(s => s.id));

const classify = ref => {
    const r = norm(ref);
    if (ATTR.has(r)) return 'atributo';
    if (r.startsWith('Perícia: ')) return skillNames.has(r.slice(9)) ? 'perícia' : 'ÓRFÃ perícia';
    if (r.startsWith('Item: ') || r.startsWith('Projétil: ')) return ITEM_PROPS.has(r) ? 'item' : 'ÓRFÃ item';
    if (vdNames.has(r)) return 'vd';
    if (vitalNames.has(r)) return 'vital';
    return 'ÓRFÃ vd/vital';
};

// ---- coleta ----
const refs = []; // {origem, doc, nome, ref, classe}
const add = (origem, doc, nome, ref) => { if (ref == null || ref === '') return; refs.push({ origem, doc, nome, ref: norm(ref), classe: classify(ref) }); };
const walkEq = (origem, doc, nome, eq) => { if (!Array.isArray(eq)) return; for (const t of eq) if (t && (t.tipo === 'ficha' || t.tipo === 'item' || t.ref)) add(origem, doc, nome, t.ref); };
const walkConfig = (origem, doc, nome, cfg) => {
    if (!cfg || typeof cfg !== 'object') return;
    for (const c of cfg.calculos || []) { add(origem, doc, nome, c.alvo); walkEq(origem, doc, nome, c.equacao); }
    walkEq(origem, doc, nome, cfg.equacaoA); walkEq(origem, doc, nome, cfg.equacaoB);
    for (const p of cfg.poolPersonalizado || []) add(origem, doc, nome, p);
    if (cfg.alvo) add(origem, doc, nome, cfg.alvo);
};

for (const m of mechanics) walkConfig('mechanics', m.id, m.nome, m.config);
for (const v of vds) walkEq('derivedValues', v.id, v.nome, v.equacao);
for (const e of equipment) {
    for (const v of e.valoresDerivadosVinculados || []) { walkEq('equipment', e.id, e.nome, v.equacao); if (v.id && !vdIds.has(v.id)) refs.push({ origem: 'equipment', doc: e.id, nome: e.nome, ref: `vdId:${v.id}`, classe: 'ÓRFÃ vdId' }); }
    for (const p of e.periciasVinculadas || []) { if (p.id && !skillIds.has(p.id)) refs.push({ origem: 'equipment', doc: e.id, nome: e.nome, ref: `skillId:${p.id}`, classe: 'ÓRFÃ skillId' }); walkEq('equipment', e.id, e.nome, p.equacao); }
}
for (const m of classModules) {
    for (const f of m.schema || []) walkEq('classModules.schema', m.id, m.nome || m.titulo, f.equacao);
    for (const it of m.itensPredefinidos || []) {
        for (const f of m.schema || []) if (f.tipo === 'redutor' && it.valores && it.valores[f.key] && Array.isArray(it.valores[f.key].equacao)) walkEq('classModules.item', m.id, it.nome, it.valores[f.key].equacao);
    }
}
// ids de mecânica citados por quem
const mechUso = new Map();
const cite = (origem, id, mid) => { if (!mid) return; if (!mechUso.has(mid)) mechUso.set(mid, []); mechUso.get(mid).push(`${origem}/${id}`); if (!mechIds.has(mid)) refs.push({ origem, doc: id, nome: '', ref: `mechId:${mid}`, classe: 'ÓRFÃ mechId' }); };
for (const v of vds) for (const mid of v.mecanicaIds || []) cite('derivedValues', v.id, mid);
for (const v of vitals) for (const mid of v.mecanicaIds || []) cite('vitalStats', v.id, mid);
for (const p of peculiarities) { for (const mid of p.mecanicaIds || []) cite('peculiarities', p.id, mid); for (const mid of p.mecanicaExpCriacao || []) cite('peculiarities', p.id, mid); for (const n of p.niveis || []) for (const mid of n.mecanicaIds || []) cite('peculiarities', p.id, mid); }
for (const c of conditions) for (const mid of c.efeitoMecanicaIds || []) cite('conditions', c.id, mid);
for (const e of equipment) for (const mid of e.mecanicaIds || []) cite('equipment', e.id, mid);
for (const s of skills) for (const mid of s.mecanicaIds || []) cite('skills', s.id, mid);
for (const c of classes) for (const mid of c.mecanicaIds || []) cite('classes', c.id, mid);
for (const r of races) for (const mid of r.mecanicaIds || []) cite('races', r.id, mid);
for (const t of tribes) for (const mid of t.mecanicaIds || []) cite('tribes', t.id, mid);
for (const m of classModules) for (const k of ['custoCriacaoMecanicaIds', 'custoEdicaoMecanicaIds', 'custoRemocaoMecanicaIds', 'limiteMecanicaIds', 'bloqueioMecanicaIds']) for (const mid of m[k] || []) cite('classModules', m.id, mid);
for (const m of classModules) for (const it of m.itensPredefinidos || []) { for (const mid of it.custoCriacaoMecanicaIds || []) cite('classModules.item', m.id, mid); for (const [k, v] of Object.entries(it.valores || {})) if (typeof v === 'string' && mechIds.has(v)) cite('classModules.item', m.id, v); }

// ---- relatórios ----
if (PROCURA) {
    const hits = refs.filter(r => r.ref === PROCURA);
    console.log(`"${PROCURA}" citada ${hits.length}×:`);
    for (const h of hits) console.log(`  ${h.origem} ${h.doc} (${h.nome})`);
    process.exit(0);
}
const porClasse = {};
for (const r of refs) porClasse[r.classe] = (porClasse[r.classe] || 0) + 1;
console.log('REFERÊNCIAS POR TIPO'); for (const [k, v] of Object.entries(porClasse).sort()) console.log(`  ${k.padEnd(16)} ${v}`);
const orfas = refs.filter(r => r.classe.startsWith('ÓRFÃ'));
console.log(`\nÓRFÃS: ${orfas.length}`);
const agrup = {};
for (const o of orfas) { agrup[o.ref] = agrup[o.ref] || []; agrup[o.ref].push(`${o.origem}/${o.doc}${o.nome ? ' (' + o.nome + ')' : ''}`); }
for (const [ref, quem] of Object.entries(agrup).sort()) console.log(`  ${ref}  ←  ${quem.slice(0, 4).join(', ')}${quem.length > 4 ? ` … +${quem.length - 4}` : ''}`);
const mecOrfas = mechanics.filter(m => !mechUso.has(m.id));
console.log(`\nMECÂNICAS SEM NINGUÉM CITANDO: ${mecOrfas.length} de ${mechanics.length}`);
for (const m of mecOrfas.slice(0, TUDO ? 1000 : 40)) console.log(`  ${m.id}  ${m.tipo?.padEnd(11)} ${m.nome}${m.publicado === false ? '  (despublicada)' : ''}`);
if (!TUDO && mecOrfas.length > 40) console.log(`  … +${mecOrfas.length - 40} (use --tudo)`);
const vdSemLeitor = vds.filter(v => !refs.some(r => r.ref === norm(v.nome)) && !classes.some(c => (c.derivedValueIds || []).some(x => (x.id || x) === v.id)) && !peculiarities.some(p => (p.derivedValueIds || []).includes(v.id)) && !equipment.some(e => (e.valoresDerivadosVinculados || []).some(x => x.id === v.id)));
console.log(`\nVDs QUE NENHUMA EQUAÇÃO, CLASSE, PEC OU ITEM CITA: ${vdSemLeitor.length} de ${vds.length} (podem ser lidos só por código/tela)`);
for (const v of vdSemLeitor.slice(0, TUDO ? 1000 : 40)) console.log(`  ${v.id}  ${v.nome}  [${v.blocoId || ''}]${v.publicado === false ? ' (despublicado)' : ''}`);
if (TUDO) { console.log('\nTODAS AS REFS'); for (const r of refs) console.log(`  ${r.classe.padEnd(16)} ${r.ref.padEnd(40)} ${r.origem}/${r.doc} ${r.nome}`); }
process.exit(0);
