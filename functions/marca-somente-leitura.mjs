/**
 * Marca 🔒 "Somente leitura para o jogador" nos campos de schema que o cadastro
 * manda, mas estavam soltos — os únicos módulos que ficaram fora da regra de
 * shared/predef-campos.js (campo 🔒 na cópia da ficha volta a seguir o
 * pré-cadastro quando a habilidade é editada no Painel do Criador).
 *
 * Os quatro casos, e por que cada um:
 *   · Custo 5 — Opus Magnum  → schema idêntico ao Custo 1–4, que travam os 10.
 *   · Círculo do Sábio da Luz, campo "Falha:" → os outros Círculos o travam.
 *   · Receita de Loções Ofensiva/Defensiva → os 7 campos descrevem a RECEITA
 *     (dificuldade, variedade mínima, propriedades exigidas), não o estado de
 *     mesa do jogador. Esses dois módulos aceitam criação livre, e o 🔒 só vale
 *     para item vindo do pré-cadastro (class-modules-renderer: doPreCadastro),
 *     então a receita que o jogador inventa continua editável.
 *
 *   node functions/marca-somente-leitura.mjs            (dry-run)
 *   node functions/marca-somente-leitura.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

/** id do módulo → chaves de schema que passam a ser 🔒. '*' = todas. */
const ALVOS = [
    { id: 'sonoro_c5', titulo: 'Custo 5 — Opus Magnum', chaves: '*' },
    { id: 'oWJHvVaZZctpOdFyeZXx', titulo: 'Círculo do Sábio da Luz', chaves: ['8'] },
    { id: 'WxIUefCzMIAcupHjqqxw', titulo: 'Receita de Loções Ofensiva', chaves: '*' },
    { id: 'gX31tLk7vRsTPDuay4h9', titulo: 'Receita de Loções Defensiva', chaves: '*' },

    /* Módulos novos do Xamã/Caçador, cadastrados depois: mesma forma do
       "Espiritismo — o Eco que o Verde guardou", que trava tudo menos o botão.
       Chave a chave, e não '*', porque cada um tem um campo que é do jogador.

       "Golpes do Verde" (mod_verde_xama) saiu do Xamã — está `publicado: false`,
       sem classe vinculada e sem nenhum personagem com item dele. Não entra. */
    // deixa o 6 solto: "Presa atual (anotação):" é o bloco de notas do jogador
    { id: 'manobras_cacador', titulo: 'Manobras de Caçador', chaves: ['1', 'acao', '2', '3', '4', '5'] },
    { id: 'mod_vodu', titulo: 'Voduísmo — o elo pelo que ainda vive', chaves: ['1', '2', '3', 'acao', '4', '5', '6'] },
];

/* Tipo que não guarda dado do jogador nem é preenchido por ele: travar não muda
   nada, mas também não custa. Fica de fora só o que o motor calcula sozinho. */
const NUNCA_TRAVAR = new Set(['valor_derivado', 'botao']);

let erros = 0;
for (const alvo of ALVOS) {
    const ref = db.doc(`system/data/classModules/${alvo.id}`);
    const snap = await ref.get();
    if (!snap.exists) {
        console.log(`❌ ${alvo.titulo} (${alvo.id}): documento não encontrado`);
        erros++;
        continue;
    }
    const dados = snap.data();
    if ((dados.titulo || '') !== alvo.titulo) {
        console.log(`❌ ${alvo.id}: esperava "${alvo.titulo}", achei "${dados.titulo}" — não mexo`);
        erros++;
        continue;
    }

    const schema = Array.isArray(dados.schema) ? dados.schema : [];
    const mudados = [];
    const novo = schema.map(f => {
        const key = String(f?.key ?? '');
        const alvoDoCampo = alvo.chaves === '*' || alvo.chaves.includes(key);
        if (!alvoDoCampo || f.somenteLeitura === true || NUNCA_TRAVAR.has(f.tipo)) return f;
        mudados.push(`${key} (${f.tipo}) "${f.label || ''}"`);
        return { ...f, somenteLeitura: true };
    });

    console.log(`\n${alvo.titulo} · ${mudados.length} campo(s) a travar`);
    mudados.forEach(m => console.log(`   🔒 ${m}`));
    if (!mudados.length) { console.log('   (já estava tudo travado)'); continue; }

    if (APPLY) {
        await ref.update({ schema: novo });
        console.log('   ✔️ gravado');
    }
}

console.log(APPLY ? '\n✅ aplicado' : '\n(dry-run — rode com --apply para gravar)');
process.exit(erros ? 1 : 0);
