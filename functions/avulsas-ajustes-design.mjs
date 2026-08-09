/**
 * Os quatro ajustes de design fechados na auditoria:
 *
 *   Cicatriz Notável  — o −1 PERMANENTE em Diplomacia/Sedução vira Desvantagem.
 *       Subtrair ponto é grátis para quem dumpa a perícia (o piso do Alvo 1 protege
 *       o min-maxer); Desvantagem é proporcional e cobra de todo mundo. Sinal fica
 *       uniforme ('ganho') e o Nv1 deixa de ser bônus de graça: 0/0/12 → +4/+4/+6.
 *   Roncador          — custo internalizado: penaliza o próprio sono, não o dos aliados.
 *   Veterano de Guerra— Iniciativa +1/+1/+3 → +1/+2/+3 (o Nv2 não dava nada).
 *   Percepção         — piso 0, como a Percepção Visual e os três Deslocamentos.
 *
 *   node functions/avulsas-ajustes-design.mjs            (dry-run)
 *   node functions/avulsas-ajustes-design.mjs --aplicar
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const APLICAR = process.argv.includes('--aplicar');
const VD_PERCEPCAO = 'nFaeIo9iz8KwNA0lKhNa';
const MOLDE_PISO = '1QTlCmmHYNXdPWPfcHgQ';   // "Desloc. Terrestre — piso 0"

const grab = async c => (await db.collection(`system/data/${c}`).get()).docs;
const [pecDocs, mechDocs] = await Promise.all([grab('peculiarities'), grab('mechanics')]);
const pec = n => pecDocs.find(d => d.data().nome === n);
const mec = n => mechDocs.find(d => d.data().nome === n);

const backup = {}, log = [];
const grava = async (ref, patch) => { if (APLICAR) await ref.update(patch); };

/* ---- 1. Cicatriz Notável ---- */
{
  const p = pec('Cicatriz Notável'), pd = p.data();
  const remover = ['CICATRIZ NOTÁVEL — Diplomacia', 'CICATRIZ NOTÁVEL — Sedução'].map(mec);
  backup['pec:' + p.id] = { nome: pd.nome, mecanicaIds: pd.mecanicaIds, mecanicaExpCriacao: pd.mecanicaExpCriacao };
  for (const m of remover) backup['mec:' + m.id] = m.data();

  const nar = mec('Cicatriz Notável (Níveis)'), nd = nar.data();
  backup['mec:' + nar.id] = { nome: nd.nome, progressao: nd.progressao };
  const prog = JSON.parse(JSON.stringify(nd.progressao));
  prog['1'] = { custoExp: 0, descricao: '▲ +1 situacional em Intimidação quando a cicatriz está à vista. ▼ Desvantagem em Sedução na primeira impressão — a marca chega antes de você.' };
  prog['2'] = { custoExp: 4, descricao: '▲ +1 situacional em Intimidação; +1 situacional em AUT contra dor. ▼ Desvantagem em Sedução e em Diplomacia na primeira impressão.' };
  prog['3'] = { custoExp: 6, descricao: '▲ +2 situacional em Intimidação; +1 situacional em AUT contra dor; reputação de sobrevivente. ▼ Desvantagem em qualquer interação social com quem não o conhece; civis se afastam ao vê-lo.' };
  await grava(nar.ref, { progressao: prog });

  const ganho4 = mechDocs.find(d => d.data().nome === 'Ganho Avulsa +4 EXP');
  await grava(p.ref, {
    mecanicaIds: (pd.mecanicaIds || []).filter(i => !remover.some(m => m.id === i)),
    mecanicaExpCriacao: [ganho4.id],
  });
  for (const m of remover) if (APLICAR) await m.ref.delete();
  log.push('Cicatriz Notável   −1 permanente em Diplomacia/Sedução → Desvantagem (2 mecânicas apagadas)');
  log.push('Cicatriz Notável   EXP 0/0/+12 → +4/+4/+6');
}

/* ---- 2. Roncador: o custo passa a ser seu ---- */
{
  const m = mec('Roncador (Níveis)'), md = m.data();
  backup['mec:' + m.id] = { nome: md.nome, progressao: md.progressao };
  const prog = JSON.parse(JSON.stringify(md.progressao));
  prog['1'].descricao = '▼ Você mesmo dorme mal com o próprio ronco: −1 na sua recuperação de descanso. Acampamento oculto é impossível enquanto você dormir.';
  prog['2'].descricao = '▼ −2 na sua recuperação de descanso; você acorda quase tão cansado quanto deitou. Inimigos a até 50m localizam o acampamento automaticamente.';
  await grava(m.ref, { progressao: prog });
  log.push('Roncador           penalidade sai dos aliados e passa para o próprio descanso (EXP +2/+5 mantida)');
}

/* ---- 3. Veterano de Guerra: Iniciativa +1/+1/+3 → +1/+2/+3 ---- */
{
  const m = mec('VETERANO DE GUERRA — Iniciativa'), md = m.data();
  backup['mec:' + m.id] = { nome: md.nome, progressao: md.progressao };
  const prog = JSON.parse(JSON.stringify(md.progressao));
  prog['2'].termos = { 0: 2 };
  await grava(m.ref, { progressao: prog });
  log.push('Veterano de Guerra Iniciativa +1/+1/+3 → +1/+2/+3 (o Nv2 não entregava nada)');
}

/* ---- 4. Percepção: piso 0 ---- */
{
  const ja = mechDocs.find(d => d.data().nome === 'Percepção — piso 0');
  if (ja) log.push('Percepção          piso 0 já existia');
  else {
    const molde = mechDocs.find(d => d.id === MOLDE_PISO).data();
    const doc = { ...molde,
      nome: 'Percepção — piso 0',
      descricao: 'Percepção não fica negativa: no mínimo o personagem nota o que qualquer um notaria.',
      previewTexto: 'Percepção: mínimo 0',
      config: { calculos: [{ alvo: 'Percepção', tipoLimite: 'minimo', equacao: [{ tipo: 'fixo', valor: 0 }] }] },
      criadoEm: admin.firestore.Timestamp.now(), atualizadoEm: admin.firestore.Timestamp.now() };
    const dvRef = db.doc(`system/data/derivedValues/${VD_PERCEPCAO}`);
    const dv = (await dvRef.get()).data();
    backup['dv:' + VD_PERCEPCAO] = { nome: dv.nome, mecanicaIds: dv.mecanicaIds };
    if (APLICAR) {
      const ref = await db.collection('system/data/mechanics').add(doc);
      await dvRef.update({ mecanicaIds: [...new Set([...(dv.mecanicaIds || []), ref.id])] });
    }
    log.push('Percepção          + mecânica "Percepção — piso 0", vinculada ao VD');
  }
}

console.log(log.join('\n'));
if (APLICAR) {
  const arq = `functions/_backup-ajustes-design-${Date.now()}.json`;
  fs.writeFileSync(arq, JSON.stringify(backup, null, 2));
  console.log(`\n✅ Aplicado. Backup em ${arq}`);
} else console.log('\n(dry-run — rode com --aplicar para gravar)');
process.exit();
