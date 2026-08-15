/**
 * As 8 últimas que o Tabuleiro não aplicava sozinho. Cada uma é a MESMA
 * pergunta — é rito ou é ação de turno? — e o texto de cada cadastro responde.
 * O script carrega a frase de origem e recusa gravar se ela sumiu.
 *
 *   node functions/__aplica-mira-restantes.mjs           (só mostra)
 *   node functions/__aplica-mira-restantes.mjs --apply   (grava)
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const M = [
    /* ---- RITOS: o texto diz que levam tempo, não cabem num turno ---- */
    {
        mod: 'ally_animal', predef: 'pdi_1784476430077_wft41f', nome: 'Vínculo Animal',
        prova: 'Sela o vínculo com um Aliado Animal',
        porque: 'selar um vínculo de Lealdade é rito, não lance de combate',
        acao: 'Fora de combate',
    },
    {
        mod: 'TbRKh68m2hvr9KUVrOXb', predef: 'pdi_inv_1785107140941_6', nome: 'Fechamento de Fenda',
        prova: 'Tempo: 6 Ações (3 turnos)',
        porque: 'o próprio texto dá 6 Ações em 3 turnos — é rito prolongado',
        acao: 'Fora de combate',
    },
    {
        mod: 'TbRKh68m2hvr9KUVrOXb', predef: 'pdi_inv_1785107140941_7', nome: 'Estilhaçar Causa',
        prova: 'cancela o último evento',
        porque: 'desfaz um evento já ocorrido: não há alvo no mapa para mirar',
        acao: 'Fora de combate',
    },
    {
        mod: 'TbRKh68m2hvr9KUVrOXb', predef: 'pdi_1784604406980_bbkqom', nome: 'Invocação Abissal',
        prova: 'Reporte ao Mestre seu CA atual',
        porque: 'quem gera a criatura é o Mestre, em segredo — o Tabuleiro não tem o que mirar',
        acao: 'Fora de combate',
    },

    /* ---- AÇÃO DE TURNO: têm alvo, e o texto diz qual ---- */
    {
        mod: 'TbRKh68m2hvr9KUVrOXb', predef: 'pdi_inv_1785107140941_2', nome: 'Laço de Nome',
        prova: 'Dominar uma criatura abissal',
        porque: 'domina UMA criatura invocada, que está no mapa e à vista',
        campos: { formaArea: 'alvo', alvosMax: 1, alcanceVisao: true, faccao: 'inimigo' },
    },
    {
        mod: 'TbRKh68m2hvr9KUVrOXb', predef: 'pdi_inv_1785107140941_5', nome: 'Vórtice na Fenda',
        prova: 'o usuário e mais um alvo tocado',
        porque: 'leva quem conjura e mais um, tocado — dois alvos, ao alcance do toque',
        campos: { formaArea: 'alvo', alvosMax: 2, alcance: 3, faccao: 'aliado' },
    },
    {
        mod: 'mod_totem', predef: 'pdi_totem_1785111662028_4', nome: 'Comunhão Simples',
        prova: 'Conversa com um Eco sem incorporação',
        porque: 'conversa com UM Eco — o mesmo alvo e alcance da Transcendência',
        campos: { formaArea: 'alvo', alvosMax: 1, alcanceVisao: true, exigeVinculo: null },
    },
    {
        mod: 'mod_totem', predef: 'pdi_totem_1785111662028_7', nome: 'Exorcismo',
        prova: 'Expulsa um espírito invasor de pessoa, objeto ou local',
        porque: 'expulsa o espírito de UM alvo à vista (pessoa, objeto ou local)',
        campos: { formaArea: 'alvo', alvosMax: 1, alcanceVisao: true },
    },
];

const texto = (pd) => [pd.descricao, ...Object.values(pd.valores || {})]
    .filter(v => typeof v === 'string').join(' \n ');

const porModulo = new Map();
for (const m of M) {
    if (!porModulo.has(m.mod)) porModulo.set(m.mod, []);
    porModulo.get(m.mod).push(m);
}

let mudou = 0, pulou = 0;
for (const [modId, itens] of porModulo) {
    const ref = db.doc(`system/data/classModules/${modId}`);
    const snap = await ref.get();
    if (!snap.exists) { console.log(`❌ módulo ${modId} não existe`); pulou += itens.length; continue; }
    const lista = [...(snap.data().itensPredefinidos || [])];
    let tocou = false;

    for (const m of itens) {
        const i = lista.findIndex(p => p.id === m.predef);
        if (i < 0) { console.log(`❌ ${m.nome}: não achado`); pulou++; continue; }
        const pd = lista[i];
        if (!texto(pd).includes(m.prova)) {
            console.log(`⏭️  ${m.nome}: a frase "${m.prova}" não está mais no cadastro — não gravo por cima`);
            pulou++; continue;
        }
        if (m.acao) {
            lista[i] = { ...pd, valores: { ...(pd.valores || {}), acao: m.acao } };
            console.log(`\n🕯️  ${m.nome} → Ação "${m.acao}"`);
        } else {
            lista[i] = { ...pd, ...m.campos };
            console.log(`\n🎯 ${m.nome} → ${JSON.stringify(m.campos)}`);
        }
        console.log(`   fonte : "${m.prova}"`);
        console.log(`   porquê: ${m.porque}`);
        tocou = true; mudou++;
    }
    if (tocou && APLICAR) await ref.update({ itensPredefinidos: lista, atualizadoEm: new Date() });
}

console.log(`\n${APLICAR ? 'GRAVADO' : 'SIMULAÇÃO (rode com --apply para gravar)'} — ${mudou} mudança(s), ${pulou} pulada(s)`);
process.exit(0);
