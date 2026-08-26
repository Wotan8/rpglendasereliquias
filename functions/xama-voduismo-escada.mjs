/**
 * XAMÃ — a escada do Voduísmo (5 degraus) e o módulo do Espiritismo.
 *
 * O Voduísmo age pelo ELO: uma parte viva do alvo (cabelo, sangue, carne)
 * mantém a Essência Azul por uma janela curta antes do Verde consumi-la. Quem
 * amarra o elo antes que apague age sobre o dono a qualquer distância.
 *
 * DOIS ORÇAMENTOS, e é isso que faz a vertente caber na régua sem regra nova:
 *   · conseguir o Fragmento = economia de CENA (§11, as cinco peças)
 *   · usar o boneco         = economia de COMBATE (§1, unidades)
 *
 * GATE: o Custo de cada degrau exige o mesmo nível na Peculiaridade Voduísmo.
 * Custo 4 pede Voduísmo 4. É o que faz especializar valer mais que espalhar.
 *
 *   node functions/xama-voduismo-escada.mjs            (dry-run)
 *   node functions/xama-voduismo-escada.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const D = db.collection('system').doc('data');
const APPLY = process.argv.includes('--apply');
const ts = () => admin.firestore.FieldValue.serverTimestamp();
const MOD = 'mod_vodu';
const r2 = n => Math.round(n * 100) / 100;

const C = (condicao, nivel, alvos, rodadas, portao = 'resistencia') =>
    ({ condicao, portao, chance: null, alvos, rodadas, ...(nivel ? { nivel } : {}) });

/* Custo N + Ação Padrão (1,000). Taxas §1.1 na base 3,90:
   dano entregue 0,256 · Alvo/Defesa 0,167 · turno roubado 1,000
   portão de resistência 0,85 (§6.6: contra alvo comum é Chance 8–9 disfarçada) */
const ESCADA = [
    { id: 'pdi_vodu_1', custo: 1, nome: 'AGULHA',
        efeito: 'Espeta o boneco. O dono do fragmento, onde estiver, sofre 5 de dano e fica Abalado no nível do Elo por 1 cena. Não mata: para em 1 de Vitalidade.',
        conds: [C('Abalado', 2, 1, 5)],
        u: 2.70, conta: '5 de dano (1,28) + Abalado 2 x 5 rodadas x 0,85 (1,42)' },

    { id: 'pdi_vodu_2', custo: 2, nome: 'AMARRAÇÃO',
        efeito: 'Amarra os membros do boneco com linha de cabelo. O dono fica Imobilizado por 3 rodadas e Exposto 3 enquanto durar — preso onde estava, sem saber por quê.',
        conds: [C('Agarrado', null, 1, 3), C('Exposto', 3, 1, 3)],
        u: 3.83, conta: 'turno roubado 1,000 x 3 rodadas x 0,85 (2,55) + Exposto 3 (1,28)' },

    { id: 'pdi_vodu_3', custo: 3, nome: 'BOCA COSIDA',
        efeito: 'Costura a boca do boneco. O dono não conjura, não canta e não fala por 1 cena. Escrever ainda funciona.',
        conds: [],
        u: 4.25, conta: 'nega a Ação Padrão de um conjurador: 1,000 x 5 rodadas x 0,85' },

    { id: 'pdi_vodu_4', custo: 4, nome: 'O PESO',
        efeito: 'Enche o boneco de terra de cemitério. O dono fica Cego e Amedrontado por 1 cena, esmagado por um luto que não é dele.',
        conds: [C('Cego', null, 1, 5), C('Amedrontado', null, 1, 5)],
        u: 5.09, conta: 'Cego 1,03/rodada (4,38) + Amedrontado 0,167/rodada (0,71), ambos x 5 x 0,85' },

    { id: 'pdi_vodu_5', custo: 5, nome: 'ESPELHO DE CARNE',
        efeito: 'O boneco vira condutor de mão dupla por 1 cena: todo dano que o Xamã sofrer é transferido ao dono do fragmento, até 20 pontos. Ao esgotar o orçamento o boneco racha e o elo se desfaz.',
        conds: [],
        u: 10.24, conta: '20 pontos x 0,256 x 2 — negado ao Xamã E causado ao alvo são dois ganhos' },
];

const modulo = {
    nome: 'Rituais do Voduísmo',
    titulo: 'Voduísmo — o elo pelo que ainda vive',
    tipo: 'lista',
    publicado: true,
    schema: [
        { key: '1', label: 'Nome:', tipo: 'text' },
        { key: '2', label: 'Vertente mínima (Voduísmo):', tipo: 'number' },
        { key: '3', label: 'Custo:', tipo: 'text' },
        { key: 'acao', label: 'Ação:', tipo: 'select',
            opcoes: ['Ação Padrão', 'Ação de Movimento', 'Ação Livre',
                'Ação Completa (turno inteiro)', 'Sustentada (1 Padrão/turno)', 'Fora de combate'] },
        { key: '4', label: 'Duração:', tipo: 'text' },
        { key: '5', label: 'Efeito:', tipo: 'textarea' },
        { key: '6', label: 'Falha:', tipo: 'text' },
    ],
    itensPredefinidos: ESCADA.map(e => {
        const custoTotal = e.custo + 1;
        return {
            id: e.id, nome: e.nome, descricao: e.efeito,
            economia: 'combate',
            custoExpProprio: 1,
            custoCriacaoMecanicaIds: [], custoEquipamentos: null,
            valores: {
                1: e.nome,
                2: e.custo,                                  // gate: exige Voduísmo N
                3: `${e.custo} Energia`,
                4: '1 cena',
                5: e.efeito,
                6: 'O elo falha e o fragmento se apaga — o boneco fica inerte.',
                acao: 'Ação Padrão',
            },
            alcance: null, formaArea: 'unico', tamanhoArea: null, alvosMax: 1,
            duracaoValor: 1, duracaoUnidade: 'cena',
            condicoesAplicadas: e.conds,
            regua: { unidades: e.u, custo: custoTotal, razao: r2(e.u / custoTotal), base: 3.90, em: '2026-08-24' },
            anguloCone: null, bloqueavel: false,
        };
    }),
    criadoEm: ts(), atualizadoEm: ts(),
};

console.log(`${APPLY ? 'APLICANDO' : 'DRY-RUN'}\n`);
for (const e of ESCADA) {
    const ct = e.custo + 1;
    console.log(`  Custo ${e.custo}  ${e.nome.padEnd(18)} ${e.u} / ${ct} = ${r2(e.u / ct)}x   (exige Voduísmo ${e.custo})`);
    console.log(`            ${e.conta}`);
}

const jaExiste = (await D.collection('classModules').doc(MOD).get()).exists;
console.log(`\n  módulo ${MOD}: ${jaExiste ? 'JÁ EXISTE — abortando' : 'novo'}`);
if (jaExiste) process.exit(1);

const xamaDoc = (await D.collection('classes').get()).docs.find(d => d.data().nome === 'Xamã');
const mods = [...new Set([...(xamaDoc.data().modulosDaClasse || []), MOD])];
console.log(`  modulosDaClasse: ${JSON.stringify(xamaDoc.data().modulosDaClasse)} → ${JSON.stringify(mods)}`);
console.log(`  mod_totem passa a se chamar "Rituais do Espiritismo" (é 100% Eco)`);

if (APPLY) {
    await D.collection('classModules').doc(MOD).set(modulo);
    await xamaDoc.ref.update({ modulosDaClasse: mods, atualizadoEm: ts() });
    await D.collection('classModules').doc('mod_totem').update({
        nome: 'Rituais do Espiritismo', titulo: 'Espiritismo — o Eco que o Verde guardou',
    });
    console.log('\nAPLICADO');
} else console.log('\nDRY-RUN — rode com --apply');
process.exit(0);
