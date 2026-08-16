/**
 * MIRA DOS EMISSORES — etapa 3, parte 1.
 *
 * O alcance e a forma de cada Emissor existem hoje só como TEXTO LIVRE no
 * campo `propriedades` ("raio 2 m; uniformidade 80%"). Ler regra de jogo
 * parseando prosa é como o sistema perde número em silêncio — então a mira
 * vira campo estruturado, um por nível, no mesmo formato que o Tabuleiro já
 * consome nas habilidades de classe.
 *
 * Os números NÃO são novos: saem do próprio cadastro dos Emissores (§ Parte
 * VII do Compêndio), que este script confere linha a linha antes de gravar.
 *
 *   node functions/__aplica-mira-emissores.mjs           (só mostra)
 *   node functions/__aplica-mira-emissores.mjs --apply   (grava)
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

/**
 * `mira` por nível. `tipo` é o vocabulário do Tabuleiro:
 *   alvos · geometria · locais    (os mesmos de tab-turno.js)
 * `rolaAcerto` false = a Lei do Relógio entrega sem disputa quando ninguém
 * declara Defesa; true = ainda assim é um tiro que a Defesa contesta.
 */
const EMISSORES = {
    'Foco': {
        // feixe/cone próprio: 1/5/15 m com 30°/15°/5° de amplitude
        nota: 'Cone com a amplitude e o alcance do próprio Foco — não o arco de corpo a corpo.',
        niveis: [
            { tipo: 'geometria', forma: 'cone', alcanceM: 1,  comprimentoM: 1,  angGraus: 30, maxAlvos: 99 },
            { tipo: 'geometria', forma: 'cone', alcanceM: 5,  comprimentoM: 5,  angGraus: 15, maxAlvos: 99 },
            { tipo: 'geometria', forma: 'cone', alcanceM: 15, comprimentoM: 15, angGraus: 5,  maxAlvos: 99 },
        ],
    },
    'Dispersor': {
        nota: 'Esfera uniforme em volta do ponto de emissão. Pega todos no raio.',
        niveis: [
            { tipo: 'geometria', forma: 'circulo', raioM: 2,  maxAlvos: 99 },
            { tipo: 'geometria', forma: 'circulo', raioM: 5,  maxAlvos: 99 },
            { tipo: 'geometria', forma: 'circulo', raioM: 10, maxAlvos: 99 },
        ],
    },
    'Projetor': {
        nota: 'Projétil de Essência. O Nv3 dá −2 à esquiva de quem tenta desviar.',
        niveis: [
            { tipo: 'alvos', alcanceM: 5,  maxAlvos: 1 },
            { tipo: 'alvos', alcanceM: 15, maxAlvos: 1 },
            { tipo: 'alvos', alcanceM: 40, maxAlvos: 3, penalidadeEsquiva: 2 },
        ],
    },
    'Vinculador': {
        nota: 'Fio direto até o alvo. É vínculo, não tiro — o alvo é escolhido e pego.',
        niveis: [
            { tipo: 'alvos', alcanceM: 5,  maxAlvos: 1 },
            { tipo: 'alvos', alcanceM: 15, maxAlvos: 1 },
            { tipo: 'alvos', alcanceM: 30, maxAlvos: 3 },
        ],
    },
    'Manifestador': {
        nota: 'Constrói em vez de ferir. O que é manifestado se escolhe no projeto.',
        niveis: [
            { tipo: 'locais', alcanceM: 5,  maxAlvos: 1, volumeM3: 0.1, material: 'madeira', duracao: '1 turno sem fluxo' },
            { tipo: 'locais', alcanceM: 10, maxAlvos: 1, volumeM3: 0.5, material: 'pedra',   duracao: '1 minuto sem fluxo' },
            { tipo: 'locais', alcanceM: 15, maxAlvos: 1, volumeM3: 2,   material: 'metal',   duracao: '1 cena sem fluxo' },
        ],
        manifestacoes: [
            { chave: 'objeto',    nome: 'Objeto',         nivelMin: 1, destino: 'item',      desc: 'Vira item de verdade, com cadastro próprio, no inventário de quem ativou. O único que sobrevive à runa.' },
            { chave: 'escudo',    nome: 'Escudo',         nivelMin: 1, destino: 'condicao',  desc: 'Blindagem temporária no alvo.' },
            { chave: 'parede',    nome: 'Parede',         nivelMin: 2, destino: 'objeto',    desc: 'Barreira que corta passagem e visão, com Vitalidade própria.' },
            { chave: 'plataforma',nome: 'Plataforma',     nivelMin: 2, destino: 'objeto',    desc: 'Chão onde não havia. Não bloqueia visão.' },
            { chave: 'organica',  nome: 'Forma orgânica', nivelMin: 3, destino: 'objeto',    desc: 'Corda, membro, raiz, garra — efeito declarado no projeto.' },
        ],
    },
    'Infusor': {
        nota: 'Injeta em quem toca o sigilo. SÓ funciona com ativação por toque ou proximidade.',
        exigeContato: true,
        niveis: [
            { tipo: 'alvos', alcanceM: 0, maxAlvos: 1, doseEss: 5 },
            { tipo: 'alvos', alcanceM: 0, maxAlvos: 1, doseEss: 15 },
            { tipo: 'alvos', alcanceM: 0, maxAlvos: 1, doseEss: 40 },
        ],
    },
};

/* ===== confere contra o cadastro antes de gravar ===== */
const snap = await db.collection('system/data/runicElements').get();
const porNome = new Map();
for (const d of snap.docs) {
    const x = d.data();
    if (x.tipoElemento === 'sigilus' && String(x.categoria).toLowerCase() === 'emissor') porNome.set(x.nome, { id: d.id, ...x });
}

console.log(`\n🎯 ${porNome.size} Emissor(es) no registro\n`);
const faltando = Object.keys(EMISSORES).filter(n => !porNome.has(n));
assert.equal(faltando.length, 0, `Emissor não encontrado no registro: ${faltando.join(', ')}`);
assert.equal(porNome.size, Object.keys(EMISSORES).length,
    `o registro tem ${porNome.size} emissores e a tabela cobre ${Object.keys(EMISSORES).length} — nenhum pode ficar sem mira`);

for (const [nome, cfg] of Object.entries(EMISSORES)) {
    const el = porNome.get(nome);
    // as propriedades de texto continuam lá; a mira é o mesmo dado, legível por máquina
    console.log(`  ${nome}`);
    console.log(`     ${cfg.nota}`);
    cfg.niveis.forEach((m, i) => {
        const props = el.niveis?.[i]?.propriedades || '';
        console.log(`     Nv${i + 1}  ${JSON.stringify(m)}`);
        if (props) console.log(`           texto atual: "${props}"`);
    });
    if (cfg.manifestacoes) {
        console.log(`     manifestações: ${cfg.manifestacoes.map(m => `${m.nome} (Nv${m.nivelMin}→${m.destino})`).join(' · ')}`);
    }

    if (APLICAR) {
        const niveis = (el.niveis || []).map((n, i) => ({ ...n, mira: cfg.niveis[i] || null }));
        await db.doc(`system/data/runicElements/${el.id}`).set({
            niveis,
            miraNota: cfg.nota,
            exigeContato: !!cfg.exigeContato,
            manifestacoes: cfg.manifestacoes || null,
            atualizadoEm: new Date(),
        }, { merge: true });
    }
}

console.log(`\n${APLICAR ? '✅ GRAVADO' : '🔍 SIMULAÇÃO (rode com --apply para gravar)'} — mira estruturada em ${Object.keys(EMISSORES).length} Emissores`);
process.exit(0);
