/**
 * Estende Gigantismo e Nanismo até o Nível 5 (±40% e ±50% de Altura).
 *
 * A cascata é linear: cada nível move Tamanho, Vitalidade, Carga, Deslocamento
 * e Iniciativa na mesma proporção. Já a penalidade narrativa satura no Nv3
 * (furtividade impossível, montaria não suporta / armas padrão −2). Preço linear
 * sobre valor que continua subindo faria do Nv4-5 a compra ótima — por isso a
 * escada sobe: 8 / 8 / 8 / 10 / 12.
 *
 *   node functions/gigantismo-nanismo-nv5.mjs            (dry-run)
 *   node functions/gigantismo-nanismo-nv5.mjs --aplicar
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const APLICAR = process.argv.includes('--aplicar');

/* nome da mecânica → { 4: termos|null, 5: ... }. termos null = mecânica narrativa
   (leva custoExp e descrição em vez de termos). */
const PLANO = {
  'GIGANTISMO — Altura':     { 4: { 0: 1.4 }, 5: { 0: 1.5 } },
  'GIGANTISMO — D.Vertical': { 4: { 0: 4 },   5: { 0: 5 } },
  'NANISMO — Altura':        { 4: { 0: 0.6 }, 5: { 0: 0.5 } },
  'NANISMO — D.Vertical':    { 4: { 0: 4 },   5: { 0: 5 } },
  'Gigantismo (Níveis)': {
    4: { custoExp: 10, descricao: '▲ +40% de altura — precisa se agachar por completo em qualquer porta comum. ▼ Equipamento sob medida ×4; nenhuma montaria ou embarcação de escala humana o suporta; a Iniciativa já está no negativo pelo próprio Tamanho.' },
    5: { custoExp: 12, descricao: '▲ +50% de altura — porte que a maioria das pessoas só ouviu falar em história. ▼ Equipamento só por encomenda, ×5 ou mais; nenhuma construção de escala humana o acomoda; cabe de pé em pouquíssimos interiores.' },
  },
  'Nanismo (Níveis)': {
    4: { custoExp: 10, descricao: '▲ −40% de altura; passa por vãos que ninguém mais tenta. ▼ Armas padrão −2 no Alvo; equipamento sob medida ×3; a Carga já não comporta armadura pesada e mochila cheia ao mesmo tempo.' },
    5: { custoExp: 12, descricao: '▲ −50% de altura — some atrás de qualquer móvel. ▼ Armas padrão −2 no Alvo; equipamento sob medida ×4; com FOR 3 ou menos não carrega armadura completa e arma juntas; não alcança quase nada feito para adultos.' },
  },
};

const snap = await db.collection('system/data/mechanics').get();
const alvos = snap.docs.filter(d => PLANO[d.data().nome]);
const faltando = Object.keys(PLANO).filter(n => !alvos.some(d => d.data().nome === n));
if (faltando.length) { console.error('MECÂNICAS NÃO ENCONTRADAS:', faltando); process.exit(1); }

const backup = {};
const linhas = [];
for (const doc of alvos) {
  const m = doc.data();
  backup[doc.id] = { nome: m.nome, nivelMaximo: m.nivelMaximo, progressao: m.progressao };

  const prog = JSON.parse(JSON.stringify(m.progressao || {}));
  const molde = prog['3'];
  if (!molde) { console.error(`${m.nome}: sem nível 3 para servir de molde`); process.exit(1); }

  for (const nv of ['4', '5']) {
    const d = PLANO[m.nome][nv];
    const entrada = JSON.parse(JSON.stringify(molde));
    if (d.custoExp === undefined) {                        // mecânica de cálculo
      entrada.termos = { ...d };                            // { "0": valor }
      entrada.custoExp = 0;                                 // custoExp mora só na narrativa
    } else {
      entrada.custoExp = d.custoExp;
      entrada.descricao = d.descricao;
      delete entrada.termos;
    }
    prog[nv] = entrada;
    linhas.push(`${m.nome.padEnd(24)} nv${nv}: ${JSON.stringify(entrada.termos ?? { custoExp: entrada.custoExp })}`);
  }

  if (APLICAR) await doc.ref.update({ progressao: prog, nivelMaximo: 5 });
}

console.log(linhas.join('\n'));
console.log('\nnivelMaximo 3 → 5 nas 6 mecânicas.');
if (APLICAR) {
  const arq = `functions/_backup-gig-nan-${Date.now()}.json`;
  fs.writeFileSync(arq, JSON.stringify(backup, null, 2));
  console.log(`✅ Aplicado. Backup em ${arq}`);
} else {
  console.log('(dry-run — rode com --aplicar para gravar)');
}
process.exit();
