// Censo do Domínio antes da Fase C2: quem referencia os Domínios e quanto EXP está neles. Só leitura.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const col = async (p) => (await db.collection(p).get()).docs.map(d => ({ ...d.data(), id: d.id }));
const pecs = await col('system/data/peculiarities');
const doms = pecs.filter(p => /dom[ií]nio/i.test(p.nome || '') || /^pec_dominio/.test(p.id) || p.tipo === 'dominio' || p.categoria === 'dominio');
console.log('DOMÍNIOS (' + doms.length + ')');
for (const d of doms) console.log(' ', d.id, '|', d.nome, '| pub=' + d.publicado, '| custoNivel=' + d.custoNivel, '| custoExp=' + d.custoExp, '| niveis=' + JSON.stringify(d.niveis ?? d.nivelMax ?? d.maxNivel), '| tipo=' + d.tipo, '| chaves=' + Object.keys(d).filter(k => !['descricao','nome','id'].includes(k)).join(','));
const domIds = new Set(doms.map(d => d.id));
const classes = await col('system/data/classes');
for (const c of classes) {
    const refs = Object.entries(c).filter(([k, v]) => JSON.stringify(v).match(/pec_dominio|dominio/i)).map(([k]) => k);
    if (refs.length) console.log('CLASSE', c.id, c.nome, 'campos com domínio:', refs.join(','), JSON.stringify(c.peculiaridadeIds || c.bonusIniciais || '').slice(0, 300));
}
const eq = await col('system/data/equipment');
const comDom = eq.filter(e => e.dominioId);
const dist = {}; comDom.forEach(e => { dist[e.dominioId] = (dist[e.dominioId] || 0) + 1; });
console.log('EQUIPMENT com dominioId:', comDom.length, '/', eq.length, JSON.stringify(dist));
const mods = await col('system/data/classModules');
const modsDom = mods.filter(m => m.dominioId);
const distM = {}; modsDom.forEach(m => { distM[m.dominioId] = (distM[m.dominioId] || 0) + 1; });
console.log('CLASSMODULES com dominioId:', modsDom.length, '/', mods.length, JSON.stringify(distM));
console.log('  sem escolaId mas com dominioId:', modsDom.filter(m => !m.escolaId).map(m => m.id + ':' + (m.titulo || m.nome)).join(', '));
const skills = await col('system/data/skills');
console.log('ESCOLA SKILLS:', skills.filter(s => s.publicado !== false && /mancia$/i.test(s.nome)).map(s => s.id + ':' + s.nome + ':' + s.categoria).join(' | '));
const escolas = await col('system/data/escolas');
console.log('ESCOLAS:', escolas.map(e => e.id + ' pericia=' + JSON.stringify(e.periciaIds)).join(' | '));
const chars = await col('char');
let n = 0, exp = 0;
for (const ch of chars) {
    const dots = ch.dots || {};
    const ks = Object.keys(dots).filter(k => domIds.has(k.replace(/^pec_/, '')) && Number(dots[k]) > 0);
    const ind = (ch.peculiaridadesIndividuais || []).filter(p => domIds.has(typeof p === 'string' ? p : p?.id));
    if (ks.length || ind.length) { n++; console.log('CHAR', ch.id, (ch.fields?.nome || ch.nome || '').slice(0, 20), 'classe=' + (ch.fields?.classe || ch.classeId || ''), 'dots:', ks.map(k => k + '=' + dots[k]).join(','), 'ind:', ind.map(p => typeof p === 'string' ? p : p.id).join(',')); }
}
console.log('CHARS com Domínio:', n, '/', chars.length);
// itens instanciados nas fichas (subcoleção?) — campo dominioId em char.inventario?
const inst = chars.filter(c => JSON.stringify(c).includes('dominioId')).length;
console.log('CHARS cujo doc menciona dominioId:', inst);
process.exit(0);
