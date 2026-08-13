/**
 * Bardo — padrão sonoro: forma, raio e facção. Sem "até N alvos".
 * Som não seleciona alvo: pega quem está no raio. O raio vira o botão de
 * balanceamento — efeito forte compra raio pequeno.
 *   node functions/__aplica-bardo-geometria.mjs [--apply]
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

const U=3.445, ALVO=0.585/U, BLIND=0.53/U, DANO=1/U, PRE=4;
const P_BUFF=0.70, P_DEB=0.40, P_CH8=0.56, CENA=5, TETO=7;
const alvos=(R)=>Math.min(Math.floor(Math.PI*R*R/9),TETO);
const sonico=(dado)=>(dado+PRE)*DANO;          // Blindagem Arcana 0
const fisico=(dado)=>(dado+PRE-2)*DANO;
const ATORD=1.32, AMED=0.17, OFUSC=0.37, LENTO=0.10, ACEL=1.43, CELERE=0.05, EN=1.00, EMP=0.333;
assert.equal(alvos(3),3); assert.equal(alvos(5),7); assert.equal(alvos(2),1);

const C = {
 'GRITO DISSONANTE [V, S]':        [1,3,'inimigo',P_CH8, ATORD, 'Todos os inimigos no raio ficam Atordoados por 1 turno (Chance 8).'],
 'NOTA PENETRANTE [S]':            [1,3,'inimigo',P_DEB, sonico(2.5), 'Todos os inimigos no raio sofrem 1d4 de dano sônico e ficam Surdos por 1 cena.'],
 'INTIMIDAÇÃO SÔNICA [V, P]':      [1,5,'inimigo',P_DEB, AMED*CENA, 'Todos os inimigos no raio testam AUT vs GS. Falha: Amedrontado por 1 cena.'],
 'CANÇÃO DO VIGOR [V, C]':         [1,3,'aliado', P_BUFF, 1*EN, 'Todos os aliados no raio recuperam 1 de Energia.'],
 'MELODIA CALMANTE [V, C]':        [1,3,'aliado', P_BUFF, 1.00, 'Remove 1 condição mental leve de todos os aliados no raio.'],
 'RITMO DE MARCHA [P]':            [1,4,'aliado', P_BUFF, 3*CELERE*CENA, 'Todos os aliados no raio ficam Célere 3 por 1 cena (+4,5 m de Deslocamento).'],
 'ACORDE DEBILITANTE [C, P]':      [2,3,'inimigo',P_DEB, 2*ALVO*CENA+EN, 'Todos os inimigos no raio testam AUT vs GS. Falha: Abalado 2 e Drenado 1 por 1 cena.'],
 'RITMO DE GUERRA [P, V]':         [2,5,'aliado', P_BUFF, ALVO*CENA, 'Todos os aliados no raio ficam Fortalecido 1 por 1 cena (+1 no Alvo de Ataque).'],
 'NANA DO ENTORPECIMENTO [V, C]':  [2,4,'inimigo',P_DEB, (LENTO+OFUSC)*CENA, 'Todos os inimigos no raio testam AUT vs GS. Falha: Lento e Ofuscado por 1 cena.'],
 'DISTORÇÃO ESPACIAL ILUSÓRIA [C, S]':[2,5,'inimigo',P_DEB, 2*ALVO*CENA, 'Todos os inimigos no raio ficam Abalado 2 por 1 cena; mover-se exige teste de RAC.'],
 'FÚRIA INSPIRADA [V]':            [3,4,'aliado', P_BUFF, EN+ALVO*CENA, 'Todos os aliados no raio recuperam 1 de Energia e ficam Fortalecido 1 por 1 cena.'],
 'ONDA DE CHOQUE SONORAL [P, S]':  [3,3,'inimigo',P_DEB, fisico(5.5)+ATORD+EMP, 'Explosão: todos os inimigos no raio sofrem 1d10 de impacto, são empurrados 1,5m por GS e testam VIG ou ficam Atordoados.'],
 'CADÊNCIA ACELERADORA [P, C]':    [3,2,'aliado', P_BUFF, ACEL*CENA, 'Todos os aliados no raio ficam Acelerado por 1 cena (+1 ação adicional por turno).'],
 'COMPOSIÇÃO DE BATALHA [Qualquer]':[3,4,'ambos', P_BUFF, 2*ALVO*CENA, 'Escolha na conjuração: todos os aliados no raio ficam Fortalecido 2, ou todos os inimigos ficam Abalado 2, pela cena.'],
 'RÉQUIEM [V, C]':                 [4,5,'inimigo',P_DEB, 3*EN, 'Todos os inimigos no raio testam PRS + AUT vs GS. Falha: Drenado 3 — perdem 3 de Energia e não a recuperam até o fim da cena.'],
 'LETARGIA TEMPORAL [P, C]':       [4,5,'inimigo',P_DEB, (0.50+LENTO)*CENA, 'Todos os inimigos no raio testam AUT vs GS. Falha: Entorpecido e Lento por 1 cena. Falha Crítica: inverte no Bardo.'],
 'LAMENTO DA BANSHEE [V, S]':      [4,4,'inimigo',P_DEB, sonico(6.5)+AMED, 'Todos os inimigos no raio sofrem 1d12 de dano sônico e testam AUT vs GS. Falha: Amedrontado. Necróticos e abissais: dano dobrado.'],
 'MARCHA DO CATACLISMO [P, S]':    [4,4,'inimigo',P_DEB, fisico(8.5)+0.47, 'Todos os inimigos no raio testam VIG vs GS. Falha: 1d12 de dano e Prostrado. Causa dano estrutural em construções.'],
 'A SINFONIA [Todas]':             [5,3,'aliado', P_BUFF, (2*ALVO+BLIND)*CENA+2*EN, 'Todos os aliados no raio ficam Fortalecido 2 e Blindado 1 por 1 cena e recuperam 2 de Energia. Você lança 1 efeito de Custo 1 por turno sem gastar Harmonia. Após o fim: +3 Dissonância.'],
 'TROMBETA DO JULGAMENTO [S]':     [5,4,'inimigo',P_DEB, fisico(9)+ATORD+EMP, 'Todos os inimigos no raio testam VIG vs GS. Falha: 2d6 de dano, empurrados 3m por GS e Atordoados por 1 turno. Ouvido a 1km. Falha Crítica: ricocheteia.'],
};

console.log('canção                        tier R  facção   alvos  razão');
const fora=[];
for (const [n,[t,R,f,p,ef]] of Object.entries(C)) {
  const custo=t+1.00, r=(p*ef*alvos(R))/custo;
  if (r<1.00||r>1.70) fora.push(`${n} ${r.toFixed(2)}x`);
  console.log(`${n.slice(0,29).padEnd(31)}${t}  R${String(R).padEnd(2)} ${f.padEnd(8)}${String(alvos(R)).padStart(3)}   ${r.toFixed(2)}x ${r<1?'↓':r>1.7?'↑':''}`);
}
assert.equal(fora.length,0,`fora da faixa: ${fora.join(' | ')}`);

const col=db.collection('system/data/classModules');
const mods=(await col.get()).docs.map(d=>({id:d.id,...d.data()}));
const achados=new Set();
for (const m of mods) {
  const lbl=Object.fromEntries((m.schema||[]).map(f=>[f.key,String(f.label||'')]));
  const kE=Object.keys(lbl).find(x=>/^efeito/i.test(lbl[x]));
  let mexeu=false;
  const itens=(m.itensPredefinidos||[]).map(it=>{
    const c=C[it.nome]; if(!c) return it;
    const [t,R,f,p,ef,txt]=c; achados.add(it.nome); mexeu=true;
    const un=p*ef*alvos(R), custo=t+1.00;
    const novo={...it, valores:{...it.valores}, formaArea:'onda', tamanhoArea:R, alcance:null,
      alvosMax:null, faccao:f, bloqueavel:false,
      regua:{razao:Number((un/custo).toFixed(2)), unidades:Number(un.toFixed(2)), custo, em:HOJE}};
    if (kE) novo.valores[kE]=txt;
    if (it.descricao && it.descricao!==it.nome) novo.descricao=txt;
    return novo;
  });
  if (mexeu) m._novos=itens;
}
console.log(`\n  itens: ${achados.size}/${Object.keys(C).length}`);
const falta=Object.keys(C).filter(n=>!achados.has(n));
assert.equal(falta.length,0,`não achei: ${falta.join(', ')}`);
if (!APLICAR) { console.log('\n(dry-run)'); process.exit(0); }
const lote=db.batch();
for (const m of mods.filter(x=>x._novos)) lote.update(col.doc(m.id),{itensPredefinidos:m._novos});
await lote.commit();
console.log('\n✅ gravado.');
