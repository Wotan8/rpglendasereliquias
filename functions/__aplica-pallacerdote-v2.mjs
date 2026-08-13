/** Pallacerdote na régua v2: geometria, custo de ação, Redutor por critério, faixa dupla.
 *  node functions/__aplica-pallacerdote-v2.mjs [--apply] */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore(); const APLICAR = process.argv.includes('--apply');
const HOJE='2026-08-13';
const U=3.445, ALVO=0.585/U, BLIND=0.53/U, DANO=1/U, EN=1.00, PADRAO=1.00, CENA=5, TETO=7;
const pB=r=>Math.max(0,Math.min(7+r,9))/10, pD=r=>Math.max(0,Math.min(7+r,9)-3)/10;
const alvosArea=(f,R,bloq)=>{const a=f==='cone'?(60/360)*Math.PI*R*R:Math.PI*R*R;
  const c=Math.min(Math.floor(a/9),TETO); return bloq?Math.max(1,Math.ceil(c/2)):Math.max(1,c);};
const CEGO=1.05, EXPOSTO=0.17, PROVOC=0.34, ABALADO=0.17, FORT=0.17;
const T_RES=2.00, T_BUFF=1.70;

/* [energia, forma, raio, bloq, unidades, resiste, texto] — todas Ação Padrão */
const P = {
 'Cegueira da Fé I':[1,'cone',6,true, pD(0)*CEGO*CENA*alvosArea('cone',6,true), true,
   'Feixe de luz em cone de 6m: quem estiver dentro fica Cego por 1 cena se os seus Graus alcançarem a AUT dele. A luz não atravessa corpo.'],
 'Distração da Fé I':[1,'cone',9,true, pD(0)*3*EXPOSTO*CENA*alvosArea('cone',9,true), true,
   'Feixe de luz em cone de 9m: quem estiver dentro fica Exposto 3 por 1 cena (−3 na Defesa) se os seus Graus alcançarem a AUT dele.'],
 'Penitência da Fé I':[1,'cone',9,true, pD(0)*4*ABALADO*CENA*alvosArea('cone',9,true), true,
   'Feixe de luz em cone de 9m: quem estiver dentro fica Abalado 4 por 1 cena numa perícia escolhida pelo orador da súplica.'],
 'Brilho Chamativo da Fé I':[1,'cone',9,true, pD(0)*2*PROVOC*CENA*alvosArea('cone',9,true), true,
   'Feixe de luz em cone de 9m: quem estiver dentro fica Provocado 2 por 1 cena (−4 no Alvo de qualquer ataque que não seja contra você).'],
 'Brilho Provocativo da Fé I':[1,'cone',6,true, pD(0)*3*PROVOC*CENA*alvosArea('cone',6,true), true,
   'Feixe de luz em cone de 6m: quem estiver dentro fica Provocado 3 por 1 cena (−6 no Alvo de qualquer ataque que não seja contra você).'],
 'Luz do Manto de Palla I':[1,'unico',null,false, pB(-3)*8*BLIND*CENA, false,
   'Um aliado a 15m fica Blindado 8 por 1 cena e ignora Exaustão.'],
 'Luz Revigorante I':[1,'unico',null,false, pB(-3)*8*FORT*CENA, false,
   'Um aliado a 15m fica Fortalecido 8 por 1 cena (+8 no Alvo de testes de VIG e AUT).'],
 'Luz Cauterizante I':[1,'unico',null,false, pB(-2)*20*DANO, false,
   'Cura 20 de Vitalidade num aliado a 15m, ou remove 1 condição leve.'],
 'Luz da Vontade I':[2,'unico',null,false, pB(0)*(4*EN+1.00), false,
   'Restaura 4 de Energia a 1 aliado a 15m e remove 1 condição mental (Amedrontado, Ofuscado ou Cego).'],
 'Moral Cintilante I':[2,'circulo',5,false, pB(0)*FORT*CENA*alvosArea('circulo',5,false), false,
   'Raio de 5m: todos os aliados dentro ganham +1 no Alvo pela cena.'],
 'Luz do Expurgo I':[1,'circulo',3,false, pB(0)*2*FORT*3*alvosArea('circulo',3,false), false,
   'Raio de 3m: todos os aliados dentro ganham +2 no Alvo contra Necrótico e Abissal por 3 rodadas.'],
};

console.log('habilidade                   custo  un    razão  teto');
const fora=[];
for (const [n,[en,f,R,bl,un,res]] of Object.entries(P)) {
  const custo=en*EN+PADRAO, r=un/custo, t=res?T_RES:T_BUFF;
  if(r<1.00||r>t) fora.push(`${n} ${r.toFixed(2)}x`);
  console.log(`${n.slice(0,28).padEnd(30)}${custo.toFixed(2).padStart(5)} ${un.toFixed(2).padStart(5)}  ${r.toFixed(2)}x ${r<1?'↓':r>t?'↑':' '} ${t.toFixed(2)}`);
}
assert.equal(fora.length,0,`fora: ${fora.join(' | ')}`);

const col=db.collection('system/data/classModules');
const mods=(await col.get()).docs.map(d=>({id:d.id,...d.data()}));
const ach=new Set();
for (const m of mods) {
  const l=Object.fromEntries((m.schema||[]).map(f=>[f.key,String(f.label||'')]));
  const kE=Object.keys(l).find(x=>/^efeito/i.test(l[x]));
  let mex=false;
  const itens=(m.itensPredefinidos||[]).map(it=>{
    const p=P[it.nome]; if(!p) return it;
    const [en,f,R,bl,un,res,txt]=p; ach.add(it.nome); mex=true;
    const custo=en*EN+PADRAO;
    const novo={...it, valores:{...it.valores}, formaArea:f, tamanhoArea:R, bloqueavel:bl,
      alvosMax: R?null:1, alcance: R?null:15,
      regua:{razao:Number((un/custo).toFixed(2)),unidades:Number(un.toFixed(2)),custo,em:HOJE}};
    if(kE) novo.valores[kE]=txt;
    if(it.descricao && it.descricao!==it.nome) novo.descricao=txt;
    return novo;
  });
  if(mex) m._novos=itens;
}
console.log(`\n  itens: ${ach.size}/${Object.keys(P).length}`);
assert.equal(ach.size,Object.keys(P).length,`não achei: ${Object.keys(P).filter(n=>!ach.has(n)).join(', ')}`);
if(!APLICAR){console.log('\n(dry-run)');process.exit(0);}
const lote=db.batch();
for (const m of mods.filter(x=>x._novos)) lote.update(col.doc(m.id),{itensPredefinidos:m._novos});
await lote.commit(); console.log('\n✅ gravado.');
