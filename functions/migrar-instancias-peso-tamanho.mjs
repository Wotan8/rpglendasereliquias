// =============================================
// MIGRAÇÃO pós-passe de realismo (25/08/2026): re-copia peso/tamanho do
// catálogo corrigido para TODA cópia viva.
// ---------------------------------------------
// Três moradas de cópia:
//   1. `items` — instâncias de jogador, NPC, aliado e Caixa do Mestre.
//   2. `worldbuilding-geography` → mapaTatico.objetos[] — item solto (campo
//      `item`, ref em `itemId`) e itensDentro[] de baú (sem ref; casa por nome).
//   3. `mesas/*/tabuleiros/*/objetos` — loot dropado na cena (mesmo formato).
//
// Regras:
//   · template = modeloId || origemTemplateId; sem ref, casa nome+tipo
//     normalizados; sem casamento = NÃO TOCA (item único de mesa) e lista.
//   · grava peso/tamanho só se diferem do template.
//   · pressaoBase: se a instância tem pressaoBase === peso VELHO (o espelho
//     que a instanciação fazia), acompanha o peso novo; se foi personalizada
//     (≠ peso), fica e é listada.
//   · moedeiras (Bolsa de Couro (Luns), Saco de Luns Simples): o teto
//     pesoMaximoContainer corrigido também desce para a instância.
//   · avaria NUNCA muda; instância que ficaria rompida com o novo máximo
//     (avaria ≥ integridadeMax nova) é listada para o mestre decidir.
//
//   node functions/migrar-instancias-peso-tamanho.mjs            (dry-run)
//   node functions/migrar-instancias-peso-tamanho.mjs --apply
// =============================================
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const norm = (s) => String(s || '').trim().toLowerCase();
const integ = (liga, tam) => Math.max(3, Math.round(((Number.isFinite(Number(liga)) ? Number(liga) : 1) + (Number(tam) || 1) * 3) * 3));
const MOEDEIRAS = new Set(['TUjJU3tmhRqiK4OwhKxo', 'dVPAnCIFH6Br5wBjGzgb']);

// ── catálogo ──
const catSnap = await db.collection('system/data/equipment').get();
const porId = new Map(), porNomeTipo = new Map(), porNome = new Map();
catSnap.forEach(d => {
    const x = { id: d.id, ...d.data() };
    porId.set(d.id, x);
    porNomeTipo.set(norm(x.nome) + '|' + norm(x.tipo), x);
    // nome sozinho só vale se for único no catálogo (legado v1.6 não tem tipo confiável)
    porNome.set(norm(x.nome), porNome.has(norm(x.nome)) ? null : x);
});

const acha = (obj) => {
    const ref = obj.modeloId || obj.origemTemplateId || obj.itemId;
    if (ref && porId.has(ref)) return porId.get(ref);
    const nome = norm(obj.nome ?? obj.name);
    return porNomeTipo.get(nome + '|' + norm(obj.tipo)) || porNome.get(nome) || null;
};

/** patch de peso/tamanho(/pressaoBase/teto) para uma cópia. null = nada a fazer.
 *  pressaoBase: só o ESPELHO re-sincroniza (vazio, ou igual ao peso da cópia —
 *  o que a instanciação antiga gravava); valor personalizado nunca é tocado.
 *  O alvo é o conforto do catálogo (pressaoBase do modelo) ou o peso novo;
 *  cópia sem o campo só o ganha se o conforto difere do peso (×1 = vazio). */
function patchDe(copia, tpl) {
    const p = {};
    if (Number(copia.peso) !== Number(tpl.peso)) p.peso = tpl.peso;
    if (Number(copia.tamanho) !== Number(tpl.tamanho)) p.tamanho = tpl.tamanho;
    const pesoNovo = Number(p.peso ?? copia.peso);
    const alvo = tpl.pressaoBase != null ? Number(tpl.pressaoBase) : pesoNovo;
    const atual = copia.pressaoBase == null ? null : Number(copia.pressaoBase);
    const eEspelho = atual == null || atual === Number(copia.peso);
    if (eEspelho && atual !== alvo && (atual != null || alvo !== pesoNovo)) p.pressaoBase = alvo;
    if (MOEDEIRAS.has(tpl.id) && Number(copia.pesoMaximoContainer) !== Number(tpl.pesoMaximoContainer)) {
        p.pesoMaximoContainer = tpl.pesoMaximoContainer;
    }
    return Object.keys(p).length ? p : null;
}

const rel = { semTemplate: [], pressaoCustom: [], romperia: [] };

// ── 1. items ──
const itemsSnap = await db.collection('items').get();
let iTotal = 0, iPorRef = 0, iPorNome = 0, iPatch = 0;
const writesItems = [];
itemsSnap.forEach(d => {
    const x = { id: d.id, ...d.data() };
    iTotal++;
    const tpl = acha(x);
    if (!tpl) { rel.semTemplate.push(`items/${d.id} · ${x.nome || x.name || '?'} (${x.tipo || '—'})`); return; }
    (x.modeloId || x.origemTemplateId) ? iPorRef++ : iPorNome++;
    if (x.pressaoBase != null && Number(x.pressaoBase) !== Number(x.peso)) {
        rel.pressaoCustom.push(`items/${d.id} · ${x.nome}: pressaoBase ${x.pressaoBase} ≠ peso ${x.peso} — mantida`);
    }
    const p = patchDe(x, tpl);
    if (!p) return;
    const avaria = Number(x.avaria) || 0;
    if (avaria > 0 && avaria >= integ(x.liga ?? tpl.liga, p.tamanho ?? x.tamanho)) {
        rel.romperia.push(`items/${d.id} · ${x.nome}: avaria ${avaria} ≥ novo máximo ${integ(x.liga ?? tpl.liga, p.tamanho ?? x.tamanho)}`);
    }
    iPatch++;
    writesItems.push([d.ref, p]);
});

// ── 2. mapaTatico nos Locais ──
const geoSnap = await db.collection('worldbuilding-geography').get();
let gLocais = 0, gTop = 0, gDentro = 0;
const writesGeo = [];
geoSnap.forEach(d => {
    const mt = d.data().mapaTatico;
    if (!mt?.objetos?.length) return;
    let mudou = false;
    const objetos = mt.objetos.map(o => {
        if (o.tipo !== 'item' || !o.item) return o;
        const novo = { ...o };
        const tpl = acha({ ...o.item, itemId: o.itemId, nome: o.item.nome || o.nome });
        if (tpl) {
            const p = patchDe(o.item, tpl);
            if (p) { novo.item = { ...o.item, ...p }; gTop++; mudou = true; }
        } else rel.semTemplate.push(`geo/${d.id} · objeto "${o.nome}"`);
        if (Array.isArray(o.itensDentro)) {
            const dentro = o.itensDentro.map(it => {
                const t2 = acha(it);
                if (!t2) { rel.semTemplate.push(`geo/${d.id} · dentro de "${o.nome}": ${it.nome}`); return it; }
                const p2 = patchDe(it, t2);
                if (p2) { gDentro++; mudou = true; return { ...it, ...p2 }; }
                return it;
            });
            novo.itensDentro = dentro;
        }
        return novo;
    });
    if (mudou) { gLocais++; writesGeo.push([d.ref, { mapaTatico: { ...mt, objetos } }]); }
});

// ── 3. objetos das cenas do Tabuleiro ──
const cenaSnap = await db.collectionGroup('objetos').get();
let cObjs = 0, cDentro = 0;
const writesCena = [];
cenaSnap.forEach(d => {
    if (!d.ref.path.includes('/tabuleiros/')) return;
    const o = d.data();
    if (o.tipo !== 'item' || !o.item) return;
    const patch = {};
    const tpl = acha({ ...o.item, itemId: o.itemId, nome: o.item.nome || o.nome });
    if (tpl) {
        const p = patchDe(o.item, tpl);
        if (p) { patch.item = { ...o.item, ...p }; cObjs++; }
    } else rel.semTemplate.push(`${d.ref.path} · "${o.nome}"`);
    if (Array.isArray(o.itensDentro)) {
        let mudouDentro = false;
        const dentro = o.itensDentro.map(it => {
            const t2 = acha(it);
            if (!t2) { rel.semTemplate.push(`${d.ref.path} · dentro: ${it.nome}`); return it; }
            const p2 = patchDe(it, t2);
            if (p2) { cDentro++; mudouDentro = true; return { ...it, ...p2 }; }
            return it;
        });
        if (mudouDentro) patch.itensDentro = dentro;
    }
    if (Object.keys(patch).length) writesCena.push([d.ref, patch]);
});

// ── relatório ──
console.log(`ITEMS: ${iTotal} docs · casados por ref ${iPorRef} · por nome+tipo ${iPorNome} · com mudança ${iPatch}`);
console.log(`MAPAS (Locais): ${gLocais} locais tocados · ${gTop} itens soltos · ${gDentro} itens de baú`);
console.log(`CENAS: ${writesCena.length} objetos tocados (${cObjs} soltos, ${cDentro} de baú)`);
console.log(`\nSem template (ficam como estão): ${rel.semTemplate.length}`);
rel.semTemplate.slice(0, 30).forEach(l => console.log('  · ' + l));
if (rel.semTemplate.length > 30) console.log(`  … +${rel.semTemplate.length - 30}`);
console.log(`\npressaoBase personalizada (mantida): ${rel.pressaoCustom.length}`);
rel.pressaoCustom.slice(0, 10).forEach(l => console.log('  · ' + l));
console.log(`\nFicariam ROMPIDOS com o novo máximo (avaria mantida): ${rel.romperia.length}`);
rel.romperia.forEach(l => console.log('  · ' + l));

if (!APLICAR) { console.log('\nDRY-RUN — rode com --apply para gravar.'); process.exit(0); }

let n = 0, batch = db.batch();
const flush = async () => { await batch.commit(); batch = db.batch(); n = 0; };
for (const [ref, p] of [...writesItems, ...writesGeo, ...writesCena]) {
    batch.update(ref, p);
    if (++n >= 400) await flush();
}
if (n) await batch.commit();
console.log(`\n✅ gravado: ${writesItems.length} instâncias + ${writesGeo.length} locais + ${writesCena.length} objetos de cena.`);
process.exit(0);
