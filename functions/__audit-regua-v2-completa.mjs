/**
 * Régua v2 completa: custo = recursos + ação, alvos = geometria.
 *   node functions/__audit-regua-v2-completa.mjs
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

const U = 3.445, PISO = 1.00, TETO = 1.70, TETO_RESIST = 2.00, TETO_HOSTIL = 7, CELULA = 9;
/* §0.7 — faixa dupla. Quem precisa vencer resistência entrega em ~40% das
   vezes; quem abençoa aliado, em ~70%. A folga não é desconto, é tolerância:
   permite entregar mais QUANDO entrega. Só mexe no teto, nunca no piso. */
const enfrentaResistencia = it =>
  (it.condicoesAplicadas || []).some(c => c.portao === 'resistencia' || c.portao === 'chance')
  || /\b(?:testa|testam|vs|contra)\b[^.;]{0,30}\b(?:GS|Graus|AUT|VIG|PRS|PRE|RAC|Percep)/i.test(
       String(it.descricao || '') + ' ' + Object.values(it.valores || {}).filter(v => typeof v === 'string').join(' '));
const ACAO = { 'Ação Livre': 0, 'Ação de Movimento': 0.333, 'Ação Padrão': 1, 
  'Ação Completa (turno inteiro)': 1.333, 'Sustentada (1 Padrão/turno)': 1, 'Fora de combate': 0 };
const ENERGIA = 1, VIT = 1/U, CARGA = 3*VIT, SAN = VIT;
const POR_METRO = 0.333/10;
const areaDe = { circulo:g=>Math.PI*g.r**2, onda:g=>Math.PI*g.r**2, zona:g=>Math.PI*g.r**2,
  cone:g=>(g.ang/360)*Math.PI*g.r**2, linha:g=>g.r*1.5, retangulo:g=>g.r*g.r };
function alvosGeo(it) {
  const f = it.formaArea, r = Number(it.tamanhoArea)||0;
  if (!areaDe[f] || !r) return 1;
  const cheio = Math.min(Math.floor(areaDe[f]({r, ang:Number(it.anguloCone)||60})/CELULA), TETO_HOSTIL);
  if (!it.bloqueavel) return Math.max(1,cheio);
  if (f==='linha') return 1;
  return Math.max(1, Math.ceil(cheio/2));
}
const custoRec = (txt) => { const s=String(txt||'').toLowerCase(); let t=0;
  const n=(re)=>{const m=s.match(re); if(!m)return 0; const v=m[1].includes('-')?Number(m[1].split('-')[1]):Number(m[1]); return Number.isFinite(v)?v:1;};
  t+=n(/([\d-]+)\s*(de\s+)?energia/)*ENERGIA; t+=n(/([\d-]+)\s*(de\s+)?gra[çc]a/)*ENERGIA;
  t+=n(/([\d-]+)\s*(de\s+)?carga/)*CARGA; t+=n(/([\d-]+)\s*(de\s+)?sanidade/)*SAN;
  t+=n(/([\d-]+)\s*(de\s+)?vitalidade/)*VIT; return t; };

const lista = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d=>({id:d.id,...d.data()}));
const [classes, mods] = await Promise.all(['classes','classModules'].map(lista));
const M = Object.fromEntries(mods.map(m=>[m.id,m]));
const linhas=[];
for (const c of classes) for (const ref of (c.modulosDaClasse||[])) {
  const m=M[ref?.id??ref]; if(!m) continue;
  const lbl=Object.fromEntries((m.schema||[]).map(f=>[f.key,String(f.label||'')]));
  const kC=Object.keys(lbl).find(x=>/^custo/i.test(lbl[x]));
  const tier=/^Custo (\d)/.exec(m.titulo);
  for (const it of (m.itensPredefinidos||[])) {
    if (!it.regua) continue;
    const acao = it.valores?.acao || 'Ação Padrão';
    const cA = ACAO[acao] ?? 1;
    const cR = tier ? Number(tier[1]) : custoRec(it.valores?.[kC]);
    const alc = (Number(it.alcance)||0) * POR_METRO;
    const total = cR + cA;
    /* Reescala as unidades gravadas pelo novo número de alvos. */
    const alvosAntigo = it.regua.alvosUsados || null;
    const nAlvos = alvosGeo(it);
    const un = it.regua.unidades + alc;
    const hostil = enfrentaResistencia(it);
    linhas.push({ classe:c.nome, nome:it.nome, acao, forma:it.formaArea||'-', alvos:nAlvos,
      cR, cA, total, un, r: un/total, hostil, teto: hostil ? TETO_RESIST : TETO });
  }
}
linhas.sort((a,b)=>a.r-b.r);
console.log('RÉGUA v2 COMPLETA — custo = recursos + ação · faixa 1,00–1,70× (2,00× se enfrenta resistência, §0.7)\n');
console.log('  habilidade                    classe       ação      forma    alv  rec +ação  un    razão');
for (const l of linhas) {
  const mk = l.r<PISO?'↓':l.r>l.teto?'↑':' ';
  console.log(`${mk} ${l.nome.slice(0,28).padEnd(30)}${l.classe.slice(0,11).padEnd(13)}${l.acao.replace('Ação ','').replace(' (turno inteiro)','').slice(0,9).padEnd(10)}${l.forma.slice(0,8).padEnd(9)}${String(l.alvos).padStart(3)} ${l.cR.toFixed(1).padStart(4)}+${l.cA.toFixed(2)} ${l.un.toFixed(2).padStart(5)} ${l.r.toFixed(2).padStart(5)}x`);
}
const ab=linhas.filter(l=>l.r<PISO), ac=linhas.filter(l=>l.r>l.teto);
console.log(`\n  ${linhas.length} medidas · abaixo ${ab.length} · dentro ${linhas.length-ab.length-ac.length} · acima ${ac.length}`);
