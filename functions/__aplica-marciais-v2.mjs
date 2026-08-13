/** Guerreiro e Ladino na régua v2. Todas unico/proprio, sem Redutor.
 *  node functions/__aplica-marciais-v2.mjs [--apply] */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore(); const APLICAR = process.argv.includes('--apply'); const HOJE='2026-08-13';
const U=3.445, ALVO=0.585/U, BLIND=0.53/U, DANO=1/U, GOLPE=0.53*DANO;
const EN=1.00, LIVRE=0, MOV=0.333, PADRAO=1.00, COMPLETA=1.333, CENA=5;
const P_S=0.70, P_I=0.40, T_RES=2.00, T_BUFF=1.70;
const ATORD=1.32, IMOB=0.69, PROSTR=0.47, EXPOSTO=0.17, FORT=0.17, IGN_DEF=0.320, REPOS=0.333;

/* [energia, acao, unidades, resiste, texto] */
const M = {
 /* ─ Guerreiro ─ */
 'Postura Ofensiva':[1,LIVRE, P_S*(4*GOLPE-1*EXPOSTO)*CENA, false,
  'Ação Livre. Você causa +4 de dano em cada golpe e fica Exposto 1 até trocar de postura.'],
 'Postura Defensiva':[1,LIVRE, P_S*(5*BLIND-2*ALVO)*CENA, false,
  'Ação Livre. Você fica Blindado 5 e Abalado 2 até trocar de postura.'],
 'Inspirar':[1,LIVRE, P_S*FORT*2*5, false,
  'Ação Livre. Até 5 aliados em 6m ficam Fortalecido 1 por 2 rodadas (+1 no Alvo).'],
 'Cólera':[1,LIVRE, P_S*(5*GOLPE-2*EXPOSTO)*CENA, false,
  'Ação Livre. Estado de fúria marcial: +5 de dano em cada golpe e Exposto 2, até o fim do combate ou até você passar um turno sem atacar.'],
 'Investida':[1,PADRAO, 1.00+P_I*(PROSTR+EXPOSTO)*CENA, true,
  'Uma carga que usa o próprio peso: ataque com deslocamento. Se acertar, o alvo fica Prostrado e Exposto 1 por 1 cena.'],
 'Romper Defesa':[1,PADRAO, 1.00+P_I*3*EXPOSTO*CENA, true,
  'Ataque avassalador contra a guarda: se acertar, o alvo fica Exposto 3 por 1 cena (−3 na Defesa).'],
 'Atordoar':[1,PADRAO, 1.00+P_S*2*ATORD, true,
  'Se acertar, o alvo fica Atordoado por 2 turnos.'],
 'Imobilizar':[1,PADRAO, 1.00+P_I*IMOB*CENA, true,
  'Teste disputado (seu Ataque vs FOR + Atletismo). Se vencer, o alvo fica Imobilizado por 1 cena.'],
 'Golpe Giratório':[1,PADRAO, 3.30, true,
  'Ataca todos os inimigos adjacentes num raio de 2m. −2 no Alvo. Cada alvo defende separadamente.'],
 'Golpe Cruzado':[1,PADRAO, 2.75, false,
  'Sua Ação Padrão rende dois golpes em vez de um, sem penalidade. A Ação de Movimento continua como na regra base.'],
 /* ─ Ladino ─ */
 'Golpe pelas Costas':[1,PADRAO, 2.57, true,
  'Condição: estar furtivo. Alvo = + Furtividade. Ignora a Blindagem. +1 de dano por Grau de Sucesso.'],
 'Golpe Preciso':[1,PADRAO, 1.00+P_I*4*EXPOSTO*CENA, true,
  'Alvo = + Precisão. Ignora a Blindagem do alvo neste ataque, e ele fica Exposto 4 por 1 cena.'],
 'Ataque Mudo':[1,PADRAO, 1.00+P_S*IGN_DEF*CENA, true,
  'Ignora a Defesa. 1× por cena no mesmo alvo. Só funciona contra alvos vivos e orgânicos.'],
 'Engodo':[1,LIVRE, P_I*3*EXPOSTO*CENA, true,
  'Ação Livre. Você finge um golpe: o inimigo fica Exposto 3 por 1 cena (−3 na Defesa).'],
 'Passos Sombrios':[1,MOV, P_S*IGN_DEF*CENA+P_S*2*0.05*CENA, false,
  'Ação de Movimento. Move o Deslocamento Terrestre inteiro e fica Oculto e Célere 2 por 1 cena — seus ataques ignoram a Defesa.'],
 'Sombra Acelerada':[1,LIVRE, P_S*(2*1.00-3*ALVO), false,
  'Ação Livre. No seu turno, zera a sua Defesa até o próximo turno para ganhar 2 ações extras. Não combina com Ataque Total.'],
 'Corte de Passagem':[2,MOV, 2.75, false,
  'Ação de Movimento. Você corta em qualquer ponto do trajeto e segue andando.'],
 'Retirada Ágil':[1,MOV, P_S*REPOS*CENA+P_S*2*0.05*CENA, false,
  'Ação de Movimento. Após atacar, move até metade do Deslocamento Terrestre sem provocar contra-ataque, e fica Célere 2 por 1 cena.'],
 'Desarme':[1,PADRAO, 1.00+P_I*1.00+P_I*3*EXPOSTO*CENA, true,
  'Teste disputado: DES + Arma + Precisão vs FOR + Briga ou Arma. Sucesso: o alvo perde a arma, gasta uma ação para recuperá-la e fica Exposto 3 até recuperá-la.'],
};

console.log('habilidade                 ação      custo  un    razão teto');
const fora=[];
for (const [n,[en,ac,un,res]] of Object.entries(M)) {
  const custo=en*EN+ac, r=un/custo, t=res?T_RES:T_BUFF;
  if(r<1.00||r>t) fora.push(`${n} ${r.toFixed(2)}x`);
  const na=ac===0?'Livre':ac===0.333?'Movimento':ac===1?'Padrão':'Completa';
  console.log(`${n.slice(0,26).padEnd(28)}${na.padEnd(10)}${custo.toFixed(2).padStart(5)} ${un.toFixed(2).padStart(5)}  ${r.toFixed(2)}x ${r<1?'↓':r>t?'↑':' '} ${t.toFixed(2)}`);
}
assert.equal(fora.length,0,`fora: ${fora.join(' | ')}`);

const col=db.collection('system/data/classModules');
const mods=(await col.get()).docs.map(d=>({id:d.id,...d.data()}));
const ach=new Set();
for (const m of mods.filter(x=>/Manobras de/.test(x.titulo))) {
  const l=Object.fromEntries((m.schema||[]).map(f=>[f.key,String(f.label||'')]));
  const kE=Object.keys(l).find(x=>/^efeito/i.test(l[x]));
  let mex=false;
  const itens=(m.itensPredefinidos||[]).map(it=>{
    const p=M[it.nome]; if(!p) return it;
    const [en,ac,un,,txt]=p; ach.add(it.nome); mex=true;
    const custo=en*EN+ac;
    const novo={...it, valores:{...it.valores},
      regua:{razao:Number((un/custo).toFixed(2)),unidades:Number(un.toFixed(2)),custo:Number(custo.toFixed(2)),em:HOJE}};
    if(kE) novo.valores[kE]=txt;
    if(it.descricao && it.descricao!==it.nome) novo.descricao=txt;
    return novo;
  });
  if(mex) m._novos=itens;
}
console.log(`\n  itens: ${ach.size}/${Object.keys(M).length}`);
if(!APLICAR){console.log('(dry-run)');process.exit(0);}
const lote=db.batch();
for (const m of mods.filter(x=>x._novos)) lote.update(col.doc(m.id),{itensPredefinidos:m._novos});
await lote.commit(); console.log('\n✅ gravado.');
