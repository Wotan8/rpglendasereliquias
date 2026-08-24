/**
 * Conserta as referências que a aba Sanidade acusa como "lida como zero".
 *
 * Não tem régua própria: importa `alvosConhecidos` e `sugerirParecido` de
 * shared/sanidade.js, os mesmos que o Painel do Criador usa. Assim o script não
 * pode discordar da aba — se ela diz que existe um nome parecido, é esse nome
 * que entra aqui.
 *
 * Só mexe onde a sugestão é INEQUÍVOCA (o nome errado é uma abreviatura do
 * certo, palavra por palavra). Ref quebrada sem sugestão fica listada e não é
 * tocada: adivinhar o alvo é inventar regra.
 *
 *   node functions/corrige-refs-quebradas.mjs            (dry-run)
 *   node functions/corrige-refs-quebradas.mjs --apply
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { alvosConhecidos, sugerirParecido } from '../shared/sanidade.js';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const grab = async (c) => (await db.collection(`system/data/${c}`).get())
    .docs.map(d => ({ id: d.id, ...d.data() }));

const cols = ['mechanics', 'skills', 'derivedValues', 'vitalStats', 'conditions',
    'bodyParts', 'classes', 'classModules', 'runicElements'];
const sys = Object.fromEntries(await Promise.all(cols.map(async c => [c, await grab(c)])));
const conhecidos = alvosConhecidos(sys);

const norm = (s) => String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
const PREFIXOS = ['Item: ', 'Projétil: ', 'Elemento Rúnico: ', 'Limite: ', 'Parte do Corpo: '];
const resolve = (n) => {
    const s = String(n ?? '').trim();
    return !s || PREFIXOS.some(p => s.startsWith(p)) || conhecidos.has(norm(s));
};

const trocas = [], semSugestao = [];

for (const mec of sys.mechanics) {
    const cfg = JSON.parse(JSON.stringify(mec.config || {}));
    const calculos = Array.isArray(cfg.calculos) ? cfg.calculos : [];
    let mexeu = false;

    /* Alvo pode ser string ou lista — as duas formas convivem no banco. */
    const consertar = (nome, onde) => {
        if (resolve(nome)) return nome;
        const certo = sugerirParecido(nome, conhecidos);
        if (!certo) { semSugestao.push({ mec, onde, nome }); return nome; }
        trocas.push({ mec, onde, de: nome, para: certo });
        mexeu = true;
        return certo;
    };

    for (const c of calculos) {
        if (Array.isArray(c.alvo)) c.alvo = c.alvo.map(a => consertar(a, 'alvo'));
        else if (c.alvo) c.alvo = consertar(c.alvo, 'alvo');
        for (const t of (Array.isArray(c.equacao) ? c.equacao : [])) {
            if (t && t.tipo === 'ficha' && t.ref) t.ref = consertar(t.ref, 'equação');
        }
    }
    // formato antigo: config.alvo direto, sem calculos[]
    if (!calculos.length && cfg.alvo) cfg.alvo = consertar(cfg.alvo, 'alvo (formato antigo)');

    if (mexeu) mec._novoConfig = cfg;
}

console.log(`${sys.mechanics.length} mecânicas lidas.\n`);

if (semSugestao.length) {
    console.log(`### ${semSugestao.length} ref quebrada SEM nome parecido — não vou adivinhar:`);
    for (const s of semSugestao) console.log(`   · "${s.mec.nome}" [${s.mec.id}] ${s.onde}: "${s.nome}"`);
    console.log('');
}

if (!trocas.length) { console.log('✅ Nada a trocar.'); process.exit(0); }

console.log(`### ${trocas.length} troca(s) inequívoca(s):`);
for (const t of trocas) console.log(`   · "${t.mec.nome}" [${t.mec.id}] ${t.onde}: "${t.de}" → "${t.para}"`);

if (!APPLY) { console.log('\n(dry-run — rode com --apply para gravar)'); process.exit(0); }

// Backup do config ANTES: a troca é irreversível pelo painel.
const alteradas = sys.mechanics.filter(m => m._novoConfig);
// Ao lado do script, nao do diretorio de onde ele foi chamado: rodando da
// raiz do repo o backup caia solto la fora.
const arq = new URL(`./_backup-refs-quebradas-${alteradas.length}.json`, import.meta.url);
writeFileSync(arq, JSON.stringify(
    alteradas.map(m => ({ id: m.id, nome: m.nome, config: m.config })), null, 2));
console.log(`\n💾 backup em ${arq}`);

for (const m of alteradas) {
    await db.collection('system/data/mechanics').doc(m.id)
        .update({ config: m._novoConfig, atualizadoEm: new Date() });
    console.log(`   ✔ ${m.nome} [${m.id}]`);
}
console.log(`\n✅ ${alteradas.length} mecânica(s) gravada(s).`);
process.exit(0);
