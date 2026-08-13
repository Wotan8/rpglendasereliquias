/**
 * Sangral com a régua v2: custo = Cargas + Energia + Sanidade + ação.
 *   node functions/__aplica-sangral-v2.mjs [--apply]
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const HOJE = '2026-08-13';

const U=3.445, ALVO=0.585/U, BLIND=0.53/U, DANO=1/U, DES=4;
const CARGA=3/U, EN=1.00, SAN=1/U, PADRAO=1.00, COMPLETA=1.333;
/* Redutor zerado nas hostis (lote anterior); mantido nas auto-buff.
   FAIXA DUPLA: quem enfrenta resistencia tem teto 2,00 em vez de 1,70 —
   enfrentar a Defesa do alvo e preco, e vira tolerancia, nao denominador. */
const CENA=5, TETO=7;
const P_DEB=0.40;
const pB=(red)=>Math.max(0,Math.min(7+red,9))/10;
const TETO_RESIST=2.00, TETO_BUFF=1.70;
const alvos=(R)=>Math.min(Math.floor(Math.PI*R*R/9),TETO);
const fis=(d)=>(d+DES-2)*DANO;
assert.ok(Math.abs(CARGA-0.871)<0.002);

/* [cargas, energia, sanidade, acao, forma, raio, unidades, texto] */
const S = {
 'Agulhas Sanguíneas': [1,0,0,PADRAO,'unico',null, P_DEB*fis(10.5)*2, true,
   'Cria 2 agulhas de sangue que atacam alvos à sua escolha em 6m. Cada uma causa 3d6.'],
 'Escudo Hemático': [1,0,0,PADRAO,'proprio',null, pB(-2)*7*BLIND*CENA, false,
   'Cria um escudo de sangue solidificado: Blindado 7 por 1 cena. O sangue não é perdido ao fim do efeito.'],
 'Lâmina Hemática': [2,0,0,PADRAO,'proprio',null, pB(0)*6*0.53*DANO*CENA, false,
   'Cria uma arma de sangue (espada, machado, lança): +6 de dano por golpe pela cena. Requer Especialização.'],
 'Armadura Sanguínea': [1,0,0,COMPLETA,'proprio',null, pB(-4)*10*BLIND*CENA, false,
   'Armadura completa de sangue: Blindado 10 por 1 cena (+5 de Blindagem, mais os 5 pontos que ela absorve de cada ataque).'],
 'Névoa Sanguínea': [3,0,0,PADRAO,'zona',4, P_DEB*4*ALVO*CENA*alvos(4), true,
   'Névoa que obscurece a visão num raio de 4m: todos os inimigos dentro ficam Abalado 4 por 1 cena em testes visuais. O Sangral sente através dela.'],
 'Explosão Hemática': [4,0,1,PADRAO,'circulo',4, P_DEB*fis(10.5)*alvos(4), true,
   'A Bolha explode num raio de 4m: 3d6 de dano em todos os inimigos dentro. Destrói a Bolha completamente.'],
 'Transfusão Forçada': [2,0,0,PADRAO,'unico',null, pB(0)*(14*DANO)+P_DEB*fis(14), true,
   'Aliado: cura 4d6 de Vitalidade. Inimigo: causa 4d6 de dano necrótico e rastreamento por 24h. Risco: −1 Sanidade por uso.'],
 'Absorção Hemática': [0,1,0,PADRAO,'proprio',null, 3*CARGA, false,
   'Absorve sangue derramado ao alcance: recupera Cargas iguais ao dano derramado ÷ 3, até o máximo dos seus Graus de Sucesso.'],
 'Membros Sanguíneos': [2,0,0,PADRAO,'proprio',null, pB(-4)*(4*0.333+4*ALVO)*CENA, false,
   'Cria 4 membros de sangue (braços, asas ou cauda): cada um concede uma Ação de Movimento extra ou +1 no Alvo, pela cena.'],
};

console.log('habilidade                custo(un)  unidades  razão');
const fora=[];
for (const [n,[cg,en,sn,ac,,,un,resiste]] of Object.entries(S)) {
  const custo=cg*CARGA+en*EN+sn*SAN+ac, r=un/custo;
  const teto=resiste?TETO_RESIST:TETO_BUFF;
  if (r<1.00||r>teto) fora.push(`${n} ${r.toFixed(2)}x (teto ${teto})`);
  console.log(`${n.padEnd(26)}${custo.toFixed(2).padStart(6)}  ${un.toFixed(2).padStart(6)}  ${r.toFixed(2)}x ${r<1?'↓':r>teto?'↑':' '} teto ${teto.toFixed(2)}`);
}
assert.equal(fora.length,0,`fora da faixa: ${fora.join(' | ')}`);

const col=db.collection('system/data/classModules');
const mods=(await col.get()).docs.map(d=>({id:d.id,...d.data()}));
const achados=new Set();
for (const m of mods) {
  const lbl=Object.fromEntries((m.schema||[]).map(f=>[f.key,String(f.label||'')]));
  const kE=Object.keys(lbl).find(x=>/^efeito/i.test(lbl[x]));
  const kC=Object.keys(lbl).find(x=>/^custo/i.test(lbl[x]));
  let mexeu=false;
  const itens=(m.itensPredefinidos||[]).map(it=>{
    const s=S[it.nome]; if(!s) return it;
    const [cg,en,sn,ac,forma,raio,un,,txt]=s; achados.add(it.nome); mexeu=true;
    const custo=cg*CARGA+en*EN+sn*SAN+ac;
    const partes=[cg&&`${cg} Carga${cg>1?'s':''}`, en&&`${en} Energia`, sn&&`${sn} Sanidade`].filter(Boolean);
    const novo={...it, valores:{...it.valores}, formaArea:forma, tamanhoArea:raio,
      alvosMax: raio?null:1, bloqueavel:false,
      regua:{razao:Number((un/custo).toFixed(2)), unidades:Number(un.toFixed(2)),
             custo:Number(custo.toFixed(2)), em:HOJE}};
    if (kE) novo.valores[kE]=txt;
    if (kC) novo.valores[kC]=partes.join(' + ');
    if (it.descricao && it.descricao!==it.nome) novo.descricao=txt;
    return novo;
  });
  if (mexeu) m._novos=itens;
}
console.log(`\n  itens: ${achados.size}/${Object.keys(S).length}`);
const falta=Object.keys(S).filter(n=>!achados.has(n));
assert.equal(falta.length,0,`não achei: ${falta.join(', ')}`);
if(!APLICAR){console.log('\n(dry-run)');process.exit(0);}
const lote=db.batch();
for (const m of mods.filter(x=>x._novos)) lote.update(col.doc(m.id),{itensPredefinidos:m._novos});
await lote.commit();
console.log('\n✅ gravado.');
