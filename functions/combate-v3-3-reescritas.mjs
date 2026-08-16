/**
 * Combate v3 — passo 3: reescreve a Cólera e as habilidades que falavam em Reação.
 *
 * A Reação deixou de ter fórmula própria (passo 1), e a defesa virou um número
 * estático de 0 a 4 em vez de um Alvo de 3 a 12. Um "−2 na Reação" que antes
 * valia 1/6 da defesa de alguém passaria a valer metade dela. Tudo que fala em
 * Reação é reescrito na escala nova.
 *
 * A Cólera é reescrita inteira: a cláusula de contra-ataque grátis dela valia
 * +84% de DPR num duelo e +354% cercado, e tornava a perícia Contra-Ataque
 * obsoleta. A versão nova troca isso por +2/+2 com a Defesa zerada — continua
 * a manobra mais forte do Guerreiro (+78% contra +63% da Investida), mas o
 * saldo vira negativo a partir de três inimigos.
 *
 *   node functions/combate-v3-3-reescritas.mjs            (dry-run)
 *   node functions/combate-v3-3-reescritas.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const COLERA_NOVA =
    'Estado de fúria marcial: você abandona a guarda e entrega o corpo ao avanço. '
    + 'Dura até o fim do combate ou até você passar um turno sem atacar. '
    + '+2 no seu Alvo de Ataque e +2 de dano em todo golpe. '
    + 'Sua Defesa é 0: você não declara defesa e não contra-ataca — a fúria não espera a abertura, ela avança. '
    + 'Ao derrubar um inimigo, recupere 1 Energia (até o seu máximo). '
    + 'Você não pode recuar do combate nem recusar um alvo à sua frente. '
    + 'Se um aliado cair, a ativação é grátis (uma vez por combate).';

/* nome da habilidade → [ [trecho exato a trocar, trecho novo], ... ]
 * Trecho não encontrado = ABORTA. Nada de troca silenciosa. */
const REESCRITAS = {
    'Cólera': [[
        'Estado de fúria marcial e hiperfoco. Ativação: se um aliado NPC cair, ative 1x sem custo; se um jogador cair, ative pelo resto do combate. Se matar um inimigo: +1 ação. Se for atingido: teste Reação + Reflexo vs Agilidade + Reflexo do atacante; se sucesso, cause metade do dano de volta. Se o inimigo errar: faça 1 ação de contra-ataque sem reação do inimigo, somando Ímpeto no ataque.',
        COLERA_NOVA]],

    'Postura Ofensiva': [[
        '+2 de dano em cada golpe e -2 na sua Reação.',
        '+2 de dano em cada golpe e −1 na sua Defesa.']],

    'Distração da Fé I': [[
        '-2 Reação do alvo por 1 cena.',
        '−1 na Defesa do alvo por 1 cena.']],

    'Salto Predatório': [[
        'Com 5+ Graus de acerto, ignora 6 de Reação.',
        'Com 5+ Graus de acerto, ignora a Defesa do alvo.']],

    'Retirada Ágil': [[
        'sem provocar contra-ataques e sem reduzir a Reação.',
        'sem provocar contra-ataques e sem gastar a sua defesa da rodada.']],

    'Engodo': [[
        'no próximo ataque, ignora a Reação do alvo.',
        'no próximo ataque, ignora a Defesa do alvo.']],

    'Sombra Acelerada': [[
        'No seu turno, pode abdicar da Reação para ganhar 1 ação extra.',
        'No seu turno, pode zerar a sua Defesa até o próximo turno para ganhar 1 ação extra.']],

    'Ataque Mudo': [[
        'Ignora Reação e Blindagem.',
        'Ignora a Defesa e a Blindagem.']],

    'Vórtice na Fenda': [[
        'Falha: volta perdido (perde a Reação por 1 cena).',
        'Falha: volta perdido (Defesa 0 por 1 cena).']],

    'Luz do Teleporte I': [[
        '4m por Grau de Sucesso, sem provocar reação,',
        '4m por Grau de Sucesso, sem provocar contra-ataque,']],

    // O defensor não rola mais — "desvantagem em defesas" ficou sem referente.
    'Cegueira da Fé I': [[
        'Ofuscado por 1 cena: Desvantagem em ataques e defesas.',
        'Ofuscado por 1 cena: Desvantagem em ataques e −1 na Defesa.']],
};

const snap = await db.collection('system/data/classModules').get();
const mods = snap.docs.map(d => ({ _ref: d.ref, id: d.id, ...d.data() }));

const mudancas = [], erros = [], vistos = new Set();

for (const m of mods) {
    if (m.id === 'Manobras') continue;
    let mexeu = false;
    const itens = (m.itensPredefinidos || []).map(it => {
        const regras = REESCRITAS[it.nome || ''];
        if (!regras) return it;
        vistos.add(it.nome);

        const troca = txt => {
            if (typeof txt !== 'string') return txt;
            let out = txt;
            for (const [de, para] of regras) if (out.includes(de)) out = out.split(de).join(para);
            return out;
        };

        const antes = it.descricao || '';
        const depois = troca(antes);
        // Todo trecho precisa ter casado em algum lugar do item.
        for (const [de] of regras) {
            const emAlgumLugar = antes.includes(de)
                || Object.values(it.valores || {}).some(v => typeof v === 'string' && v.includes(de));
            if (!emAlgumLugar) erros.push(`${it.nome}: trecho não encontrado → "${de.slice(0, 60)}…"`);
        }

        const valores = Object.fromEntries(
            Object.entries(it.valores || {}).map(([k, v]) => [k, troca(v)]));

        if (depois !== antes || JSON.stringify(valores) !== JSON.stringify(it.valores || {})) {
            mexeu = true;
            mudancas.push({ modulo: m.titulo, nome: it.nome, antes, depois });
        }
        return { ...it, descricao: depois, valores };
    });
    if (mexeu) m._novosItens = itens;
}

const naoAchados = Object.keys(REESCRITAS).filter(n => !vistos.has(n));
if (naoAchados.length) erros.push(`habilidades não encontradas: ${naoAchados.join(', ')}`);

console.log('='.repeat(72));
console.log('COMBATE v3 — passo 3: Cólera + habilidades que falavam em Reação');
console.log('='.repeat(72));
for (const c of mudancas) {
    console.log(`\n### ${c.nome}   [${c.modulo}]`);
    console.log(`  ANTES: ${c.antes}`);
    console.log(`  DEPOIS: ${c.depois}`);
}

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
if (mudancas.length !== Object.keys(REESCRITAS).length) {
    console.error(`\n🔴 ABORTADO: ${Object.keys(REESCRITAS).length} reescritas previstas, ${mudancas.length} aplicadas.`);
    process.exit(1);
}
const sobrouReacao = mudancas.filter(c => /Reação/.test(c.depois) && c.nome !== 'Cólera');
if (sobrouReacao.length) console.log(`\n⚠ ainda citam "Reação" (confira): ${sobrouReacao.map(c => c.nome).join(', ')}`);
console.log(`\n✅ auto-verificação: ${mudancas.length}/${Object.keys(REESCRITAS).length} reescritas, todos os trechos casaram.`);

if (!APPLY) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const batch = db.batch();
let n = 0;
for (const m of mods) if (m._novosItens) { batch.update(m._ref, { itensPredefinidos: m._novosItens, updatedAt: Date.now() }); n++; }
await batch.commit();
console.log(`\n✅ Gravado: ${mudancas.length} habilidades em ${n} módulos.`);
process.exit(0);
