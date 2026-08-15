/**
 * Preenche a MIRA de habilidades que já tinham a mira escrita no texto do
 * próprio cadastro, mas não nos campos estruturados que o Tabuleiro lê.
 *
 * REGRA DESTE SCRIPT: nenhum número sai da cabeça de ninguém. Cada mudança
 * carrega a FRASE do cadastro de onde o número veio, e o script recusa
 * aplicar se a frase não estiver mais lá — se alguém reescrever o efeito, a
 * migração para de valer em vez de gravar um número velho por cima.
 *
 * O que NÃO entra aqui, de propósito:
 *   · rituais marcados "Fora de combate" no campo Ação — não têm alvo no
 *     mapa, e o Tabuleiro passou a respeitar esse campo (tab-turno.js);
 *   · Selo Negativo ("jaula de 2–4m": faixa, não medida) e ERGUER FANTOCHES
 *     ("Raio: (Liderança + PRE) metros": fórmula, e o cadastro não tem campo
 *     de fórmula de área) — precisam de decisão de regra, não de transcrição;
 *   · Ferinismo (Fusão Selvagem, Convocar Manada, Vínculo Animal): o texto
 *     não dá medida nenhuma.
 *
 *   node functions/__aplica-mira-faltante.mjs            (só mostra)
 *   node functions/__aplica-mira-faltante.mjs --apply    (grava)
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

/**
 * `prova` é o trecho que precisa existir no texto do pré-definido para a
 * mudança valer. `campos` é só o que muda — nada mais é tocado.
 */
const MUDANCAS = [
    {
        modulo: 'sonoro_c2', predef: 'pdi_sono_1785112141051_c25', nome: 'CANÇÃO DO ABRIGO [V, C]',
        prova: 'Barreira harmônica de 3m',
        porque: 'a barreira é de 3 m e são os inimigos que testam para entrar',
        campos: { formaArea: 'onda', tamanhoArea: 3, faccao: 'inimigo' },
    },
    {
        modulo: 'sonoro_c3', predef: 'pdi_sono_1785112141051_c32', nome: 'ECO FANTASMA [V, S]',
        prova: 'Ilusão auditiva complexa em 10m',
        porque: 'a ilusão cobre 10 m e quem estiver nela testa para distinguir — vale para os dois lados',
        campos: { formaArea: 'onda', tamanhoArea: 10, faccao: 'ambos' },
    },
    {
        modulo: 'sonoro_c5', predef: 'pdi_sono_1785112141051_c51', nome: 'NOTA FUNDAMENTAL [V]',
        prova: 'Concede controle sobre 1 Essência',
        porque: 'quem recebe o controle da Essência é o próprio Bardo: não há alvo nem área',
        campos: { formaArea: 'proprio', alcance: 0, alvosMax: 1 },
    },
    {
        modulo: 'TbRKh68m2hvr9KUVrOXb', predef: 'pdi_inv_1785107140941_3', nome: 'Plano Inferior',
        prova: 'Raio 4m',
        porque: 'a passagem abre num raio de 4 m em volta de quem conjura',
        campos: { formaArea: 'onda', tamanhoArea: 4 },
    },
    {
        modulo: 'TbRKh68m2hvr9KUVrOXb', predef: 'pdi_inv_1785107140941_0', nome: 'Selo Negativo',
        prova: 'jaula de Tecido Espacial Físico (2–4m)',
        porque: 'decisão de mesa: a jaula vale 4 m (o texto dava a faixa 2–4)',
        campos: { formaArea: 'onda', tamanhoArea: 4, faccao: 'inimigo' },
    },
    {
        // 📏 Primeiro cadastro com medida por FÓRMULA: o raio depende da ficha
        // de quem conjura, e o campo passou a aceitar isso (medida-formula.js).
        modulo: 'ritual_necro', predef: 'pdi_1783818960240_52weue', nome: 'ERGUER FANTOCHES',
        prova: '(Liderança + PRE) metros',
        porque: 'o raio é (Liderança + PRE) — agora cabe no campo, resolvido na hora do uso',
        campos: { formaArea: 'onda', tamanhoArea: '(Liderança + PRE)', faccao: 'aliado' },
    },
];

/**
 * Cadastro que se contradiz: o campo "Ação" diz Ação Padrão, mas o texto da
 * própria habilidade diz que ela acontece fora do combate. O Tabuleiro segue
 * o CAMPO, então a habilidade aparecia como ação de turno e pedia mira.
 * Aqui o campo passa a dizer o que o texto já dizia.
 */
const ACOES = [
    {
        modulo: 'mod_totem', predef: 'pdi_totem_1785111662028_0', nome: 'Cravar Totem',
        prova: '1 Ação Prolongada (10 min)',
        porque: 'o próprio Custo diz que leva 10 minutos — não cabe num turno',
        acao: 'Fora de combate',
    },
    {
        modulo: 'ritual_necro', predef: 'pdi_1783825555194_7ncvwc', nome: 'VOZES DO TÚMULO',
        prova: 'Fora de combate',
        porque: 'o campo "Quando" já diz Fora de combate; só o campo Ação discordava',
        acao: 'Fora de combate',
    },
];

const textoDoPredef = (pd) => [pd.descricao, ...Object.values(pd.valores || {})]
    .filter(v => typeof v === 'string').join(' \n ');

let mudou = 0, pulou = 0;
for (const m of MUDANCAS) {
    const ref = db.doc(`system/data/classModules/${m.modulo}`);
    const snap = await ref.get();
    if (!snap.exists) { console.log(`❌ módulo ${m.modulo} não existe`); pulou++; continue; }
    const doc = snap.data();
    const lista = [...(doc.itensPredefinidos || [])];
    const i = lista.findIndex(p => p.id === m.predef);
    if (i < 0) { console.log(`❌ ${m.nome}: pré-definido ${m.predef} não achado`); pulou++; continue; }

    const pd = lista[i];
    if (!textoDoPredef(pd).includes(m.prova)) {
        console.log(`⏭️  ${m.nome}: a frase "${m.prova}" não está mais no cadastro — não gravo por cima`);
        pulou++; continue;
    }
    const antes = { formaArea: pd.formaArea, tamanhoArea: pd.tamanhoArea, alcance: pd.alcance, alvosMax: pd.alvosMax, faccao: pd.faccao };
    lista[i] = { ...pd, ...m.campos };
    console.log(`\n✔ ${m.nome}`);
    console.log(`   fonte : "${m.prova}"`);
    console.log(`   porquê: ${m.porque}`);
    console.log(`   antes : ${JSON.stringify(antes)}`);
    console.log(`   depois: ${JSON.stringify({ ...antes, ...m.campos })}`);
    if (APLICAR) {
        await ref.update({ itensPredefinidos: lista, atualizadoEm: new Date() });
    }
    mudou++;
}

for (const a of ACOES) {
    const ref = db.doc(`system/data/classModules/${a.modulo}`);
    const snap = await ref.get();
    if (!snap.exists) { console.log(`❌ módulo ${a.modulo} não existe`); pulou++; continue; }
    const lista = [...(snap.data().itensPredefinidos || [])];
    const i = lista.findIndex(p => p.id === a.predef);
    if (i < 0) { console.log(`❌ ${a.nome}: pré-definido não achado`); pulou++; continue; }
    const pd = lista[i];
    if (!textoDoPredef(pd).includes(a.prova)) {
        console.log(`⏭️  ${a.nome}: "${a.prova}" não está mais no cadastro — não mexo`);
        pulou++; continue;
    }
    const antes = pd.valores?.acao ?? '';
    if (antes === a.acao) { console.log(`⏭️  ${a.nome}: o campo Ação já está certo`); pulou++; continue; }
    lista[i] = { ...pd, valores: { ...(pd.valores || {}), acao: a.acao } };
    console.log(`\n✔ ${a.nome} — campo Ação`);
    console.log(`   fonte : "${a.prova}"`);
    console.log(`   porquê: ${a.porque}`);
    console.log(`   antes : ${JSON.stringify(antes)}  →  depois: ${JSON.stringify(a.acao)}`);
    if (APLICAR) await ref.update({ itensPredefinidos: lista, atualizadoEm: new Date() });
    mudou++;
}

console.log(`\n${APLICAR ? 'GRAVADO' : 'SIMULAÇÃO (rode com --apply para gravar)'} — ${mudou} mudança(s), ${pulou} pulada(s)`);
process.exit(0);
