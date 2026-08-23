// =============================================
// ESCRITA — marca a ECONOMIA de cada habilidade de classe (§3.3 da Régua).
// ---------------------------------------------
// O §3.3 diz que forçar tudo numa régua só é erro de categoria. São quatro
// economias, e só uma delas se mede em rodadas de dano:
//
//   combate    dano, cura, Alvo, Blindagem, ação negada, desarme, furtividade
//   cena       planos, selos, ocultação, detecção pura, viagem, ritual
//   invocacao  fantoches, aliados animais, Ecos — mede pela ficha da criatura (§3.1)
//   receita    loções, poções, patuás — régua de item
//
// Sem esse campo, toda auditoria acusa ritual de estar desbalanceado, e um
// carimbo de combate numa habilidade de cena é ruído em vez de diagnóstico
// (caso real: Reconsagração do Santuário, carimbada 0,51× sendo Fora de combate).
//
// O padrão é `combate`. As listas abaixo são as exceções, uma a uma, decididas
// lendo a descrição contra a pergunta do §3.3: "esse efeito muda o resultado
// de um combate?".
//
// Rodar: node functions/marcar-economia-predefs.mjs
// =============================================
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

const RECEITA = [   // módulos inteiros: são itens, não habilidades
    'WxIUefCzMIAcupHjqqxw', 'gX31tLk7vRsTPDuay4h9',
];

const INVOCACAO = new Set([
    'pdi_1784604406980_bbkqom',   // Invocação Abissal — o §3.2 já tem a tabela dela
    'pdi_inv_1785107140941_2',    // Laço de Nome — é o que move o `p` da disposição (§3.2)
    'pdi_1783818960240_52weue',   // ERGUER FANTOCHES
    'pdi_1783905351642_t1jlgn',   // RITUAL DE REANIMAÇÃO — servo permanente
    'pdi_1784476430077_ymj2z5',   // Convocar Manada
    'pdi_1784476430077_wft41f',   // Vínculo Animal — sela o vínculo com o Aliado
]);

const CENA = new Set([
    'pdi_inv_1785107140941_1',    // Ocultação de Eco Abissal
    'pdi_inv_1785107140941_4',    // Plano Mental Inferior
    'pdi_inv_1785107140941_6',    // Fechamento de Fenda
    'pdi_inv_1785107140941_3',    // Plano Inferior — passagem para outra camada, é viagem
    'pdi_totem_1785111662028_0',  // Cravar Totem
    'pdi_totem_1785111662028_1',  // Buscar Vestígio
    'pdi_totem_1785111662028_2',  // Transcendência — Projetor: corpo em transe, sobe ao Véu
    'pdi_totem_1785111662028_4',  // Comunhão Simples — conversa e perguntas, informação pura
    'pdi_totem_1785111662028_5',  // Vincular Eco (Antiqua)
    'pdi_totem_1785111662028_6',  // Libertar Eco Aprisionado
    'pdi_ritual_palla_1785556323350_1', // Reconsagração do Santuário
    'pdi_ritual_palla_1785556323350_2', // Exorcismo Menor
    'pdi_ritual_palla_1785556323350_3', // Peregrinação do Amanhecer
    'pdi_ritual_palla_1785556323350_4', // Cura de Nexo Menor
    'pdi_1783825555194_7ncvwc',   // VOZES DO TÚMULO
    'pdi_sang_1785111472286_2',   // Corda de Sangue — escalar, amarrar, puxar
    'pdi_sang_1785111472286_3',   // Marca de Sangue — rastreio a 1 km
]);

// Descrição vazia (é o próprio nome repetido): não dá para classificar sem
// inventar o que a habilidade faz. Ficam SEM o campo, de propósito.
const SEM_DESCRICAO = new Set([
    'pdi_sono_1785112141051_c11', 'pdi_sono_1785112141051_c23',
    'pdi_sono_1785112141051_c24', 'pdi_sono_1785112141051_c25',
    'pdi_sono_1785112141051_c32', 'pdi_sono_1785112141051_c51',
]);

const conta = { combate: 0, cena: 0, invocacao: 0, receita: 0, pulado: 0 };
for (const doc of (await db.collection('system').doc('data').collection('classModules').get()).docs) {
    const m = doc.data();
    if (m.publicado === false) continue;
    let mudou = false;
    const itens = (m.itensPredefinidos || []).map(p => {
        if (SEM_DESCRICAO.has(p.id)) { conta.pulado++; return p; }
        const econ = RECEITA.includes(doc.id) ? 'receita'
            : INVOCACAO.has(p.id) ? 'invocacao'
            : CENA.has(p.id) ? 'cena'
            : 'combate';
        conta[econ]++;
        if (p.economia === econ) return p;
        mudou = true;
        return { ...p, economia: econ };
    });
    if (mudou) await doc.ref.update({ itensPredefinidos: itens });
}

console.log(`combate=${conta.combate}  cena=${conta.cena}  invocacao=${conta.invocacao}  `
    + `receita=${conta.receita}  sem descrição (pulados)=${conta.pulado}`);
console.log(`total marcado: ${conta.combate + conta.cena + conta.invocacao + conta.receita}`);
process.exit(0);
