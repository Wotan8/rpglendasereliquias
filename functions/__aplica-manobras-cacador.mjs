/**
 * O Caçador ganha uma manobra que FUNCIONA no Tabuleiro.
 *
 * SAI: módulo `marcar_presa` — uma lista vazia com um textarea "Alvo:" onde o
 * jogador anotava o nome da presa à mão. Bloco de notas, não mecânica: o
 * Tabuleiro não tinha como ler nada dali.
 *
 * ENTRA:
 *   1. Condição "Presa" — o alvo marcado. Não faz nada COM o alvo; o efeito é
 *      de quem marcou (`porPid`), e por isso ela é exclusiva por aplicador:
 *      marcar outra presa solta a anterior.
 *   2. Módulo `manobras_cacador` com A PRESA.
 *
 * ═══ BALANCEAMENTO (Régua §0.3, §1.1, §4.1) ═══
 *
 * Taxas da régua, todas derivadas da unidade U = 3,445 (DPR do guerreiro Q0):
 *   +1 no Alvo, por rodada .... 0,170
 *   +1 de dano, por rodada .... 0,290
 *   Ação Padrão ............... 0,667  (a de Movimento é 1/3 do turno, §0.5)
 *
 * A cena de referência tem 5 rodadas — é a conta que o Corrompido registra
 * ("0,51 un/rodada no teto, 2,55 na cena" = 5 rodadas). A rodada em que o
 * Caçador marca ele NÃO atira, então rendem 4 rodadas de bônus.
 *
 *   ganho = 4 × N × (0,170 + 0,290)
 *   pago  = 0,667 (a Ação Padrão gasta marcando, que não virou tiro)
 *   custo = 3 Energia = 3,00 un (1 Energia = 1,00, a âncora do §4.1)
 *
 *   N=2 (Marca típica no Q0) -> 3,01 un / 3 = razão 1,00
 *   N=3 (no teto)            -> 4,85 un / 3 = razão 1,62
 *
 * Os dois caem na FAIXA_REGUA [1,00 - 1,70] (buff em si mesmo; não enfrenta
 * resistência — o Caçador está se concentrando, o alvo não resiste a isso).
 *
 * O TETO 3 é o que segura a régua, não é enfeite: `Marca de Caça` é
 * `Perícia: Marcar Presa + 1` e cresce com a ficha. Sem teto, N=6 daria
 * razão 3,5 — o mesmo defeito que o Eletrocutado registra sobre a Blindagem.
 *
 *   node functions/__aplica-manobras-cacador.mjs            (dry-run)
 *   node functions/__aplica-manobras-cacador.mjs --apply
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(
        require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')),
});
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const agora = () => admin.firestore.Timestamp.now();
const AUTOR = 'M2rZzlQkzxTrrddeFQ10S6zsfX62';

/* ═══ A conta, verificada aqui mesmo ═══ */
const ALVO_R = 0.585 / 3.445;
const DANO_R = 1.00 / 3.445;
const ACAO_PADRAO = 0.667;
const RODADAS_UTEIS = 4;
const TETO = 3;
const CUSTO_ENER = 3;

const unidades = N => RODADAS_UTEIS * N * (ALVO_R + DANO_R) - ACAO_PADRAO;
const razao = N => unidades(N) / CUSTO_ENER;
const r2 = razao(2), r3 = razao(TETO);

console.log('-- REGUA --');
console.log(`   +1 Alvo/rodada = ${ALVO_R.toFixed(3)} | +1 dano/rodada = ${DANO_R.toFixed(3)}`);
console.log(`   N=2  -> ${unidades(2).toFixed(2)} un / ${CUSTO_ENER} = razao ${r2.toFixed(2)}`);
console.log(`   N=${TETO}  -> ${unidades(TETO).toFixed(2)} un / ${CUSTO_ENER} = razao ${r3.toFixed(2)}`);
assert.ok(r2 >= 1.00 && r2 <= 1.70, `razao em N=2 fora da faixa: ${r2}`);
assert.ok(r3 >= 1.00 && r3 <= 1.70, `razao no teto fora da faixa: ${r3}`);
console.log('   OK: os dois extremos caem em [1,00 - 1,70]');

/* ═══ 1. Condição Presa ═══ */
console.log('\n-- CONDICAO Presa --');
const condSnap = await db.collection('system/data/conditions').get();
const jaPresa = condSnap.docs.find(d => (d.data().nome || '').trim().toLowerCase() === 'presa');
const PRESA = {
    nome: 'Presa', icone: '🎯',
    descricao: 'Escolhido como presa por um Caçador.\n'
        + `· os ataques **daquele Caçador** contra este alvo somam a **Marca de Caça** dele no Alvo e no dano, até **+${TETO}**;\n`
        + '· a marca é de quem marcou — outro atirador não a aproveita;\n'
        + '· cada Caçador mantém **uma** presa: marcar outra solta esta.\n\n'
        + `Vale ${unidades(TETO).toFixed(2)} un no teto (§1.1: ${ALVO_R.toFixed(3)} por ponto de Alvo + ${DANO_R.toFixed(3)} por ponto de dano, por rodada).`,
    duracao: '1 cena',
    removivel: true,
    afetaTabuleiro: true,
    // Não mexe em NADA do alvo: não bloqueia ação, não muda deslocamento nem
    // visão. Quem carrega o efeito é o caçador — por isso só o marcador.
    exclusivaPorAplicador: true,
    publicado: true,
    updatedAt: agora(),
};
console.log(`   ${jaPresa ? 'atualiza' : 'cria'} Presa (exclusivaPorAplicador, teto +${TETO})`);
if (APLICAR) {
    if (jaPresa) await jaPresa.ref.update(PRESA);
    else await db.collection('system/data/conditions').add({ ...PRESA, criadoPor: AUTOR, criadoEm: agora() });
}

/* ═══ 2. Módulo Manobras de Caçador ═══ */
console.log('\n-- MODULO manobras_cacador --');
const vdSnap = await db.collection('system/data/derivedValues').get();
const vdMarca = vdSnap.docs.find(d => /^marca de ca[çc]a$/i.test((d.data().nome || '').trim()));
if (!vdMarca) { console.log('   ABORTA: VD "Marca de Caca" nao encontrado'); process.exit(1); }
console.log(`   VD Marca de Caca = ${vdMarca.id}`);

const EFEITO = `Escolhe um alvo ao alcance do seu disparo. Enquanto durar, todo ataque SEU contra ele soma a sua Marca de Caça no Alvo e no dano (até +${TETO}). Você mantém uma presa por vez.`;

const MOD = {
    id: 'manobras_cacador',
    titulo: 'Manobras de Caçador',
    icone: '🏹',
    tipo: 'lista',
    publicado: true,
    permitirCriacaoJogador: false,
    custoExpPorItem: 0,
    limiteFixo: 0,
    schema: [
        { key: '1', label: 'Nome', tipo: 'text', largura: 'full' },
        { key: 'acao', label: 'Ação:', tipo: 'select', opcoes: ['Ação Padrão', 'Ação de Movimento', 'Ação Livre', 'Ação Completa'] },
        { key: '2', label: 'Custo:', tipo: 'text' },
        { key: '3', label: 'Marca de Caça:', tipo: 'select_vd' },
        { key: '4', label: 'Duração', tipo: 'text' },
        { key: '5', label: 'Efeito', tipo: 'textarea', largura: 'full' },
        // O módulo velho servia para UMA coisa de verdade: anotar quem é a
        // presa. Isso volta — é onde a nota do Grakkun da Vireu continua.
        { key: '6', label: 'Presa atual (anotação):', tipo: 'textarea', largura: 'full', placeholder: 'Quem está sendo caçado, e por quê' },
    ],
    itensPredefinidos: [{
        id: 'pdi_cacador_presa_1',
        nome: 'A PRESA',
        descricao: EFEITO,
        valores: {
            '1': 'A PRESA',
            'acao': 'Ação Padrão',
            '2': `${CUSTO_ENER} ENER`,
            '3': vdMarca.id,
            '4': '1 cena, ou até marcar outra presa',
            '5': EFEITO,
        },
        custoAcao: 'padrao',
        // Mira: 1 alvo, no alcance da arma a distância equipada.
        mira: { tipo: 'alvos', origem: 'token', maxAlvos: 1, alcanceDoDisparo: true, alcanceM: 0, afeta: 'inimigos' },
        condicoesAplicadas: [{ condicao: 'Presa', portao: 'nenhum', alvos: 1, rodadas: 0 }],
        formaArea: 'nenhuma', tamanhoArea: null, alvosMax: 1,
        duracaoValor: 1, duracaoUnidade: 'cena',
        bloqueavel: false, faccao: 'inimigo',
        regua: { razao: Number(r3.toFixed(2)), unidades: Number(unidades(TETO).toFixed(2)), custo: CUSTO_ENER, em: '2026-08-14' },
    }],
    updatedAt: agora(),
};
console.log(`   Manobras de Cacador | A PRESA (${CUSTO_ENER} ENER, razao ${r3.toFixed(2)})`);
if (APLICAR) await db.doc('system/data/classModules/manobras_cacador').set({ ...MOD, criadoPor: AUTOR, criadoEm: agora() }, { merge: true });

/* ═══ 3. Quem usava o módulo velho ═══ */
// Apagar o módulo do sistema NÃO apaga o que as fichas guardaram — vira
// referência órfã, que é pior: o dado continua lá e some da tela. A Vireu tem
// nota de campanha nesse campo (o Grakkun), então ela é migrada, não descartada.
console.log('\n-- MIGRA QUEM USAVA --');
const backup = { em: new Date().toISOString(), chars: [], npcs: [] };

for (const col of ['char', 'npcs']) {
    const snap = await db.collection(col).get();
    for (const d of snap.docs) {
        const x = d.data();

        // ficha de personagem: classModuleData é um mapa por refId
        if (col === 'char' && x.classModuleData && x.classModuleData.marcar_presa !== undefined) {
            const dados = x.classModuleData.marcar_presa;
            backup.chars.push({ id: d.id, nome: x.nome || null, dados });
            const cmd = { ...x.classModuleData };
            const tinha = Array.isArray(dados) && dados.length;
            delete cmd.marcar_presa;
            if (tinha) cmd.manobras_cacador = [...(cmd.manobras_cacador || []), ...dados];
            console.log(`   char/${x.nome || d.id}: ${tinha ? dados.length + ' entrada(s) movida(s)' : 'vazio, so remove'}`);
            if (APLICAR) await d.ref.update({ classModuleData: cmd });
            continue;
        }

        // NPC: modulosClasse é uma lista de { refId, itens }
        if (col === 'npcs' && Array.isArray(x.modulosClasse)) {
            const alvo = x.modulosClasse.find(m => m.refId === 'marcar_presa');
            if (!alvo) continue;
            backup.npcs.push({ id: d.id, nome: x.nome || null, modulo: alvo });
            const novos = x.modulosClasse.map(m => m.refId !== 'marcar_presa' ? m : {
                ...m, refId: 'manobras_cacador',
                itens: (m.itens || []).map(it => ({
                    ...it,
                    _predefId: 'pdi_cacador_presa_1',
                    _predefNome: 'A PRESA',
                    '1': 'A PRESA',
                    '2': `${CUSTO_ENER} ENER`,
                    '3': it['2'] || vdMarca.id,   // o VD morava na chave 2 do schema velho
                    '4': '1 cena, ou até marcar outra presa',
                    '5': EFEITO,
                    '6': it['1'] || '',           // a anotação da presa (o Grakkun da Vireu)
                })),
            });
            for (const it of alvo.itens || []) {
                if (it['1']) console.log(`   npcs/${x.nome}: nota preservada -> "${String(it['1']).slice(0, 62)}..."`);
            }
            console.log(`   npcs/${x.nome}: marcar_presa -> manobras_cacador`);
            if (APLICAR) await d.ref.update({ modulosClasse: novos });
        }
    }
}

const arq = `functions/_backup-marcar-presa-${Date.now()}.json`;
if (APLICAR) { fs.writeFileSync(arq, JSON.stringify(backup, null, 1)); console.log(`   backup: ${arq}`); }

console.log('\n-- REMOVE marcar_presa --');
const velho = await db.doc('system/data/classModules/marcar_presa').get();
if (!velho.exists) console.log('   = ja nao existe');
else {
    console.log(`   - remove "${velho.data().titulo}"`);
    if (APLICAR) await velho.ref.delete();
}

console.log('\n' + '='.repeat(70));
console.log(APLICAR ? 'APLICADO no Firestore' : 'dry-run - rode com --apply para gravar');
process.exit(0);
