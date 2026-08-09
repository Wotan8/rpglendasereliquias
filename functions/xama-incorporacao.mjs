/**
 * Incorporação do Xamã — o que o Eco dá, e o que ele cobra.
 *
 * O ritual "Transcendência — Receptor" existia dizendo "concedendo bônus
 * conforme o Eco". Essa frase nunca foi definida; foi um jogador que achou o
 * buraco. Aqui ela vira número.
 *
 * DECISÕES DO DONO DO MUNDO:
 *  · duração fixa de 1 cena (era "Graus × turnos", que fazia UMA rolagem
 *    escalar poder e tempo — 0,38× com 1 Grau, 1,88× com 5);
 *  · 5 Dádivas + Personalidade, e a personalidade mexe em número;
 *  · o Mestre gera o Eco, que vira ficha de NPC;
 *  · o Xamã pode PERDER o personagem para o Eco.
 *
 * NADA DE LORE NOVO. Estado do Eco, Véus, Leis, Totens e Madeira de Antiqua
 * saem do capítulo público de Totemancia. As perícias citadas existem todas —
 * conferidas nome a nome contra system/data/skills.
 *
 * RÉGUA (1 unidade = 3,445 · dano 0,290 · Blind 0,154 · Alvo 0,170 · cena 5r):
 *   Comum  (2 Energia = 2,00)          Braço 1,15× · Pele 1,16× · Olho 1,06×
 *   Ancestral (2 ENER + 2 SAN = 4,00)  efeito ×2, mesma razão
 * As personalidades mexem em perícia ESTREITA (fator 0,10–0,25) e se anulam
 * entre bônus e ônus: são textura, não poder.
 *
 *   node functions/xama-incorporacao.mjs            (dry-run)
 *   node functions/xama-incorporacao.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'M2rZzlQkzxTrrddeFQ10S6zsfX62';
const MOD_ECOS = 'mod_ecos_xama';

/* Perícias citadas — TODAS existem. O prefixo "Perícia:" só é obrigatório em
   ref de equação; aqui é texto de mesa. */
const PERICIAS_USADAS = ['Resiliência', 'Tradição', 'Investigação', 'Empatia', 'Liderança',
    'Sexto Sentido', 'Observação', 'Malandragem', 'Sobrevivência', 'Intimidação',
    'Diplomacia', 'Furtividade', 'Transcendência', 'Totemismo', 'Comunhão com Ecos'];

const RECEPTOR = [
    'O Eco divide a carne com o Xamã por 1 CENA. Ele empresta a DÁDIVA da vida que teve, e',
    'uma PERÍCIA sua no valor 3 (Eco Comum) ou 5 (Ancestral).',
    '',
    'DÁDIVAS — o Mestre define ao gerar o Eco:',
    '· BRAÇO (lutou, caçou, matou) — +1 de dano e +1 no Alvo dos seus ataques',
    '· PELE (aguentou; fera de couro) — +3 de Blindagem',
    '· OLHO (batedor, vigia, ave) — +2 no Alvo de ataques à distância e +2 em Observação',
    '· PASSO (corria; fera veloz) — +3m de Deslocamento, +2 em Furtividade e Atletismo',
    '· BOCA (orador, líder, sacerdote) — +2 no Alvo de testes sociais',
    'Eco ANCESTRAL dobra a Dádiva e o custo passa a 2 Energia + 2 Sanidade.',
    '',
    'A PERSONALIDADE do Eco soma o bônus e o ônus dela aos seus testes enquanto durar,',
    'e pesa na Supressão. Disposição alta ajuda; baixa empurra o Eco para o corpo.',
    '',
    'SUPRESSÃO — o Eco tentando ficar com o corpo. Role AUT + Transcendência vs PRS do Eco',
    'na falha crítica, a cada extensão paga, e ao fim de cada cena com Eco Furioso ou',
    'Corrompido. Falhou, sobe um degrau:',
    '· Nv 1 SUSSURRO — o Eco fala pela sua boca quando o Mestre quiser. −1 no Alvo de tudo.',
    '· Nv 2 RÉDEA — uma vez por cena o Eco gasta uma das suas ações. −2 no Alvo de tudo.',
    '· Nv 3 DOMÍNIO — o Eco tem o corpo; o jogador não joga o personagem. Ao fim de cada',
    '  cena, AUT + Transcendência vs PRS do Eco para voltar ao Nv 2.',
    'TRÊS cenas seguidas em Domínio sem sucesso: o Eco fica. O personagem vira NPC do Mestre.',
    'Desce um degrau por Exorcismo, por honrar o preço do Eco, ou por Descanso Longo com oferenda.',
].join('\n');

/* Módulo da ficha: o Xamã anota os Ecos que conhece. O Mestre gera e passa os
   dados; o jogador só transcreve — por isso tudo é campo livre, sem cálculo. */
const SCHEMA_ECOS = [
    { key: '1', tipo: 'text', label: 'Nome do Eco:', largura: 'meio', placeholder: 'Quem foi em vida' },
    { key: '2', tipo: 'text', label: 'Dádiva:', largura: 'quarto', placeholder: 'Braço / Pele / Olho / Passo / Boca' },
    { key: '3', tipo: 'text', label: 'Estado:', largura: 'quarto', placeholder: 'Sereno / Inquieto / Furioso / Corrompido / Ancestral' },
    { key: '4', tipo: 'text', label: 'Personalidade:', largura: 'meio', placeholder: 'Como ele fala e o que ele cobra' },
    { key: '5', tipo: 'text', label: 'Disposição aparente:', largura: 'quarto', placeholder: '0–10 (o que ELE deixa ver)' },
    { key: '6', tipo: 'number', label: 'PRS do Eco:', largura: 'quarto', placeholder: 'resiste à Supressão' },
    { key: '7', tipo: 'text', label: 'Perícia emprestada:', largura: 'meio', placeholder: 'Nome da perícia · valor 3 (Comum) ou 5 (Ancestral)' },
    { key: '8', tipo: 'text', label: 'Preço / oferenda:', largura: 'meio', placeholder: 'Lei da Reciprocidade — o que ele cobra', ocultarSeVazio: true },
    { key: '9', tipo: 'text', label: 'Onde vive:', largura: 'meio', placeholder: 'Território, Andarilho, ou Totem de Antiqua', ocultarSeVazio: true },
    { key: '10', tipo: 'contador', label: 'Supressão (0–3)', largura: 'quarto' },
    { key: '11', tipo: 'checkbox', label: 'Vinculado ao Totem de Antiqua?', largura: 'quarto' },
    { key: '12', tipo: 'textarea', label: 'Notas do Eco:', largura: 'full', placeholder: 'Promessas feitas, dívidas, o que ele quer', ocultarSeVazio: true },
];

/* ═══ ASSERTS ═══ */
assert.ok(/1 CENA/.test(RECEPTOR), 'duração fixa — decisão do dono do mundo');
assert.ok(!/Graus × turnos|Graus x turnos/i.test(RECEPTOR), 'a duração não pode mais escalar com Graus');
assert.ok(/AUT \+ Transcendência vs PRS do Eco/.test(RECEPTOR), 'a resistência usa a perícia que o cânone já define para isso');
assert.equal((RECEPTOR.match(/^· (BRAÇO|PELE|OLHO|PASSO|BOCA)/gm) || []).length, 5, 'as cinco Dádivas');
assert.equal((RECEPTOR.match(/^· Nv \d/gm) || []).length, 3, 'os três degraus da Supressão');
assert.ok(SCHEMA_ECOS.some(f => f.tipo === 'contador' && /Supress/.test(f.label)), 'Supressão é contador');

const [sksSnap, modsSnap, clsSnap] = await Promise.all(
    ['skills', 'classModules', 'classes'].map(c => db.collection('system/data/' + c).get()));
const nomesSk = new Set(sksSnap.docs.map(d => d.data().nome));
const erros = [];
for (const p of PERICIAS_USADAS) if (!nomesSk.has(p)) erros.push(`perícia citada não existe: "${p}"`);
if (modsSnap.docs.some(d => d.id === MOD_ECOS)) erros.push('módulo de Ecos já existe');
const xama = clsSnap.docs.map(d => ({ id: d.id, ...d.data() })).find(c => /Xam/i.test(c.nome || ''));
if (!xama) erros.push('classe Xamã não achada');
const totem = modsSnap.docs.find(d => d.id === 'mod_totem');
if (!totem) erros.push('módulo mod_totem não achado');
const itens = (totem?.data().itensPredefinidos || []).map(it => {
    if (it.nome !== 'Transcendência — Receptor') return it;
    return { ...it, descricao: RECEPTOR,
             valores: { ...(it.valores || {}), 5: '1 cena', 6: RECEPTOR },
             duracaoValor: 1, duracaoUnidade: 'cena', alvosMax: 1 };
});
if (!itens.some(i => i.nome === 'Transcendência — Receptor')) erros.push('ritual Receptor não achado');

console.log('=== Incorporação do Xamã ===\n');
console.log('1. Transcendência — Receptor: efeito reescrito, duração 1 cena');
console.log(RECEPTOR.split('\n').map(l => '   ' + l).join('\n'));
console.log(`\n2. Módulo novo "ᛉ Ecos" na ficha do Xamã (${SCHEMA_ECOS.length} campos, criação pelo jogador)`);
console.log(`   ${SCHEMA_ECOS.map(f => f.label.replace(':', '')).join(' · ')}`);
console.log(`\n  ${PERICIAS_USADAS.length} perícias citadas, todas conferidas contra o banco.`);
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
console.log('  ✅ asserts e conferências passaram.');
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const agora = admin.firestore.Timestamp.now();
const batch = db.batch();
batch.update(totem.ref, { itensPredefinidos: itens, atualizadoEm: agora });
batch.set(db.collection('system/data/classModules').doc(MOD_ECOS), {
    titulo: 'Ecos', icone: 'ᛉ', tipo: 'lista',
    schema: SCHEMA_ECOS, itensPredefinidos: [],
    permitirCriacaoJogador: true,
    custoExpPorItem: null, custoExpLabel: '',
    custoCriacaoMecanicaId: '', custoCriacaoMecanicaIds: [],
    custoEdicaoAtivo: false, custoEdicaoMecanicaId: '', custoEdicaoMecanicaIds: [],
    custoRemocaoAtivo: false, custoRemocaoMecanicaId: '', custoRemocaoMecanicaIds: [],
    custoEquipamentos: null, bloqueioMecanicaIds: [], cadastrarBloqueio: false,
    limiteFixo: null, limiteMecanicaIds: [], mecanicaLimiteId: '',
    publicado: true, criadoPor: AUTOR, criadoEm: agora, atualizadoEm: agora, versao: 1,
});
batch.update(db.collection('system/data/classes').doc(xama.id), {
    modulosDaClasse: [...(xama.modulosDaClasse || []), MOD_ECOS], atualizadoEm: agora,
});
await batch.commit();
console.log('\n✅ Ritual atualizado + módulo Ecos criado e vinculado ao Xamã.');
process.exit(0);
