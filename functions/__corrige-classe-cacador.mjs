/**
 * Furo da migração do Caçador: troquei o módulo `marcar_presa` por
 * `manobras_cacador` e migrei quem USAVA (fichas e NPCs), mas não a CLASSE.
 * `classes/Caçador.modulosDaClasse` continuou apontando para o módulo apagado.
 *
 * Consequência em mesa: o registro do sistema monta os módulos a partir da
 * lista da classe, então `manobras_cacador` nunca era carregado. A skill
 * aparecia na ficha do NPC (que guarda a própria cópia), mas o Tabuleiro não
 * achava o predefinido — e sem predefinido não há mira, então A PRESA caía no
 * diálogo de "mira não cadastrada".
 *
 * Este script varre TODAS as classes atrás de referência a módulo que não
 * existe mais, não só a do Caçador — se houver outra órfã, ela aparece aqui.
 *
 *   node functions/__corrige-classe-cacador.mjs            (dry-run)
 *   node functions/__corrige-classe-cacador.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(
        require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')),
});
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

// De quem saiu para quem entrou. Só o que este passe trocou.
const TROCA = { marcar_presa: 'manobras_cacador' };

const modsSnap = await db.collection('system/data/classModules').get();
const existentes = new Set(modsSnap.docs.map(d => d.id));
console.log(`${existentes.size} módulos de classe existem hoje\n`);

const classes = await db.collection('system/data/classes').get();
let n = 0;

for (const d of classes.docs) {
    const c = d.data();
    const lista = c.modulosDaClasse;
    if (!Array.isArray(lista) || !lista.length) continue;

    const nova = lista.map(id => TROCA[id] || id).filter(id => existentes.has(id));
    const orfaos = lista.filter(id => !TROCA[id] && !existentes.has(id));
    const trocados = lista.filter(id => TROCA[id]);

    if (JSON.stringify(nova) === JSON.stringify(lista)) continue;

    console.log(`── ${c.nome || d.id}`);
    if (trocados.length) console.log(`   troca: ${trocados.map(x => `${x} -> ${TROCA[x]}`).join(', ')}`);
    if (orfaos.length) console.log(`   ÓRFÃOS removidos (módulo não existe): ${orfaos.join(', ')}`);
    console.log(`   antes: ${JSON.stringify(lista)}`);
    console.log(`   depois: ${JSON.stringify(nova)}`);
    n++;
    if (APLICAR) await d.ref.update({ modulosDaClasse: nova, updatedAt: admin.firestore.Timestamp.now() });
}

console.log(`\n${n} classe(s) a mudar`);
console.log(APLICAR ? 'APLICADO no Firestore' : 'dry-run - rode com --apply para gravar');
process.exit(0);
