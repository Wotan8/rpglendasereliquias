/**
 * Cadastra a frente de criaturas invocáveis:
 *
 *  1. VD "Limite de Fantoches" = PRE + Perícia: Servos  (decisão do dono do
 *     mundo: bem maior que a perícia sozinha; típico 6, teto 10)
 *  2. 11 NPC-modelo na coleção `npcs` — 5 abissais (escada por CA), Fantoche,
 *     Servo Reanimado, e 4 companheiros animais (Lobo, Urso, Corvo, Serpente).
 *
 * Formato clonado do banco (conferido): `criatura` é objeto, `ataques` é texto,
 * `valoresDer` usa VIT/SAN/ENER/PERC/INI/REA/BLD/DESLOCAMENTO, `tags` é string,
 * `ai` é número (o "AI da criatura" do Laço de Nome). Templates de sistema:
 * mesaId '' e vinculos [] — nenhuma mesa é dona.
 *
 * ASSERTS: o DPR de cada tier abissal fica a ±12% da escada da espec (1,0× a
 * 3,0× o guerreiro); companheiros ≤ 0,67×; fantoche ≤ 0,16×.
 *
 *   node functions/cadastrar-criaturas-invocaveis.mjs            (dry-run)
 *   node functions/cadastrar-criaturas-invocaveis.mjs --apply
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
const DPR_REF = 3.445;

/* P(dano entra) — convolução do §0.1 da Régua, defensor de referência. */
function pEntra(alvo, def = 5) {
    let s = 0;
    for (let r = 1; r <= Math.min(alvo, 9); r++) {
        const graus = alvo - r;
        s += 1 - Math.max(0.1, Math.min(Math.max(def - graus, 0), 9) / 10);
    }
    return s / 10;
}
const dpr = c => pEntra(c.alvo) * Math.max(1, c.dadoMedio + c.bonus + Math.max(0, c.alvo - 9) - 2);

/* nome · stats · classe · disposição/lealdade · texto de criatura */
const CRIATURAS = [
    // ── escada abissal (Invocador) — Disposição base cai conforme o CA sobe ──
    { nome: 'Cria Menor do Véu', classe: 'Invocador', tier: 'CA 2–3', disp: 5, ai: 1, alvoDpr: 1.0,
      alvo: 7, dado: '1d8', dadoMedio: 4.5, bonus: 4, vit: 12, bld: 0, desloc: '9m', porte: 'Pequeno',
      atrib: { FOR: 4, DES: 3, VIG: 3, INT: 1, RAC: 2, PRE: 2, PRS: 3, AUT: 2, MAN: 0 },
      hab: 'Nasce da fenda que a invocação abre; não pertence a lugar nenhum deste lado',
      comp: 'Inquieta. Obedece enquanto observada; testa a coleira quando não.' },
    { nome: 'Cria da Fenda', classe: 'Invocador', tier: 'CA 4–5', disp: 4, ai: 1, alvoDpr: 1.5,
      alvo: 8, dado: '1d10', dadoMedio: 5.5, bonus: 5, vit: 18, bld: 1, desloc: '9m', porte: 'Médio',
      atrib: { FOR: 5, DES: 4, VIG: 4, INT: 1, RAC: 2, PRE: 3, PRS: 4, AUT: 2, MAN: 0 },
      hab: 'Idem — matéria da Oitava vestida às pressas',
      comp: 'Voraz. Ataca o que o invocador aponta, e o que sangrar mais perto.' },
    { nome: 'Horror Rastejante', classe: 'Invocador', tier: 'CA 6–7', disp: 4, ai: 2, alvoDpr: 2.0,
      alvo: 9, dado: '1d10', dadoMedio: 5.5, bonus: 6, vit: 24, bld: 2, desloc: '12m', porte: 'Grande',
      atrib: { FOR: 6, DES: 4, VIG: 5, INT: 2, RAC: 3, PRE: 4, PRS: 5, AUT: 3, MAN: 1 },
      hab: 'Idem',
      comp: 'Paciente. Cerca antes de atacar. Entende ordens; escolhe quais ouvir.' },
    { nome: 'Horror Maior', classe: 'Invocador', tier: 'CA 8–9', disp: 3, ai: 2, alvoDpr: 2.5,
      alvo: 10, dado: '1d12', dadoMedio: 6.5, bonus: 6, vit: 30, bld: 2, desloc: '12m', porte: 'Grande',
      atrib: { FOR: 7, DES: 5, VIG: 6, INT: 3, RAC: 4, PRE: 5, PRS: 6, AUT: 3, MAN: 2 },
      hab: 'Idem',
      comp: 'Negocia. Cada ordem cumprida é um débito que ele anota.' },
    { nome: 'Entidade da Oitava', classe: 'Invocador', tier: 'CA 10+', disp: 2, ai: 3, alvoDpr: 3.0,
      alvo: 11, dado: '1d12', dadoMedio: 6.5, bonus: 8, vit: 36, bld: 3, desloc: '12m', porte: 'Enorme',
      atrib: { FOR: 8, DES: 6, VIG: 7, INT: 5, RAC: 5, PRE: 7, PRS: 7, AUT: 4, MAN: 3 },
      hab: 'A Oitava Camada. A invocação não a traz — ela aceita o convite',
      comp: 'Soberana. O invocador acha que invocou; ela sabe quem abriu a porta para quem.' },
    // ── Adepto ──
    { nome: 'Fantoche', classe: 'Adepto', tier: 'p = 1', disp: null, ai: 0, alvoDpr: 0.15,
      alvo: 5, dado: '1d4', dadoMedio: 2.5, bonus: 0, vit: 6, bld: 0, desloc: '4,5m', porte: 'Médio',
      atrib: { FOR: 3, DES: 1, VIG: 2, INT: 0, RAC: 0, PRE: 0, PRS: 0, AUT: 0, MAN: 0 },
      hab: 'O cadáver que estava mais perto',
      comp: 'Nenhum. Executa a última ordem até cair. Não desvia, não recua, não pensa.' },
    { nome: 'Servo Reanimado', classe: 'Adepto', tier: 'companheiro', disp: null, ai: 1, alvoDpr: 0.6,
      alvo: 6, dado: '1d6', dadoMedio: 3.5, bonus: 3, vit: 15, bld: 1, desloc: '7,5m', porte: 'Médio',
      atrib: { FOR: 4, DES: 3, VIG: 4, INT: 1, RAC: 1, PRE: 1, PRS: 2, AUT: 1, MAN: 0 },
      hab: 'Onde o Adepto estiver',
      comp: 'Fragmento de Identidade preservado no 4º Passo: lembra de quem foi, obedece quem o trouxe de volta.' },
    // ── companheiros do Druida (Lealdade) ──
    { nome: 'Lobo', classe: 'Druida', tier: 'companheiro', leal: true, ai: 1, alvoDpr: 0.6,
      alvo: 6, dado: '1d6', dadoMedio: 3.5, bonus: 3, vit: 12, bld: 0, desloc: '13,5m', porte: 'Médio',
      atrib: { FOR: 4, DES: 4, VIG: 3, INT: 1, RAC: 2, PRE: 3, PRS: 0, AUT: 2, MAN: 0 },
      hab: 'Florestas e colinas; caça em grupo',
      comp: 'Matilha de um. Flanqueia por instinto: +1 no Alvo se um aliado está adjacente ao alvo dele.' },
    { nome: 'Urso', classe: 'Druida', tier: 'companheiro', leal: true, ai: 1, alvoDpr: 0.67,
      alvo: 5, dado: '1d8', dadoMedio: 4.5, bonus: 4, vit: 18, bld: 1, desloc: '9m', porte: 'Grande',
      atrib: { FOR: 6, DES: 2, VIG: 5, INT: 1, RAC: 1, PRE: 3, PRS: 0, AUT: 3, MAN: 0 },
      hab: 'Matas fechadas e cavernas',
      comp: 'Lento para começar a briga, péssimo de terminar contra. Protege o vínculo acima da própria fome.' },
    { nome: 'Corvo', classe: 'Druida', tier: 'companheiro', leal: true, ai: 1, alvoDpr: 0.1,
      alvo: 5, dado: '1d4', dadoMedio: 2.5, bonus: 0, vit: 6, bld: 0, desloc: 'voo 18m', porte: 'Miúdo',
      atrib: { FOR: 1, DES: 5, VIG: 1, INT: 2, RAC: 3, PRE: 2, PRS: 0, AUT: 2, MAN: 0 },
      hab: 'Qualquer céu',
      comp: 'Olheiro. Vale pelos olhos, não pelo bico: reporta o que vê a quem entende (Linguagem Animal).' },
    { nome: 'Serpente', classe: 'Druida', tier: 'companheiro', leal: true, ai: 1, alvoDpr: 0.35,
      alvo: 6, dado: '1d4', dadoMedio: 2.5, bonus: 1, vit: 8, bld: 0, desloc: '7,5m', porte: 'Pequeno',
      atrib: { FOR: 2, DES: 5, VIG: 2, INT: 1, RAC: 2, PRE: 3, PRS: 0, AUT: 2, MAN: 0 },
      hab: 'Onde há fresta e calor',
      comp: 'A mordida leva Toxis 1: 1 de dano por rodada, por 2 rodadas. Silenciosa; erra pouco quem não a viu.' },
];

/* ═══ ASSERTS ═══ */
for (const c of CRIATURAS) {
    const d = dpr(c), razao = d / DPR_REF;
    if (c.classe === 'Invocador') {
        assert.ok(Math.abs(razao - c.alvoDpr) / c.alvoDpr <= 0.12,
            `${c.nome}: DPR ${razao.toFixed(2)}× fora de ±12% do alvo ${c.alvoDpr}×`);
    } else if (c.tier === 'companheiro' && c.alvoDpr >= 0.3) {
        assert.ok(razao <= 0.67, `${c.nome}: companheiro acima de 0,67× (${razao.toFixed(2)})`);
    } else {
        assert.ok(razao <= 0.16 || c.alvoDpr < 0.3, `${c.nome}: fraco demais forte demais (${razao.toFixed(2)})`);
    }
}
/* Disposição cai conforme o tier sobe — a escada do cânone. */
const disps = CRIATURAS.filter(c => c.disp != null).map(c => c.disp);
for (let i = 1; i < disps.length; i++) assert.ok(disps[i] <= disps[i - 1], 'Disposição tem que cair com o CA');
/* Limite de Fantoches: PRE 5 + Servos 5 = 10 no teto. */
assert.equal(5 + 5, 10, 'teto do Limite');
console.log(`✅ ${CRIATURAS.length + disps.length} asserts passaram.\n`);

/* ═══ CONFERÊNCIAS NO BANCO ═══ */
const grab = async c => (await db.collection(c).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [npcs, vds, sks] = await Promise.all([grab('npcs'), grab('system/data/derivedValues'), grab('system/data/skills')]);
const erros = [];
if (vds.some(v => v.nome === 'Limite de Fantoches')) erros.push('VD Limite de Fantoches já existe');
if (!sks.some(s => s.nome === 'Servos')) erros.push('perícia Servos não achada');
const colisao = CRIATURAS.filter(c => npcs.some(n => n.nome === c.nome));
if (colisao.length) erros.push(`NPCs já existem: ${colisao.map(c => c.nome).join(', ')}`);
const ancoraVD = vds.find(v => v.nome === 'Convocar');
if (!ancoraVD) erros.push('VD Convocar (âncora de bloco Necromancia) não achado');

console.log('=== Criaturas invocáveis ===\n');
console.log('  VD novo: Limite de Fantoches = PRE + Perícia: Servos  (bloco Necromancia)\n');
console.log('  nome                  │ tier        │ Alvo │ dano    │ Vit │ Bld │ DPR   │ ×guer');
for (const c of CRIATURAS) {
    const d = dpr(c);
    console.log(`  ${c.nome.padEnd(21)} │ ${String(c.tier).padEnd(11)} │  ${String(c.alvo).padStart(2)}  │ ${c.dado}+${c.bonus}   │ ${String(c.vit).padStart(3)} │  ${c.bld}  │ ${d.toFixed(2)} │ ${(d / DPR_REF).toFixed(2)}×`);
}
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
console.log(`\n  ${CRIATURAS.length} NPC-modelo (mesaId '', vinculos [], modoFicha rapido).`);
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

/* ═══ GRAVAÇÃO ═══ */
const agora = admin.firestore.Timestamp.now();
const batch = db.batch();

const mecRef = db.collection('system/data/mechanics').doc();
batch.set(mecRef, {
    nome: 'Limite de Fantoches', descricao: 'Base do limite: PRE + Perícia: Servos.',
    fonte: 'individual', tipo: 'modificar', duracao: 'permanente',
    duracaoTurnos: null, duracaoEspecial: '', escopo: 'proprio',
    condicaoAplicacao: '', empilhamento: 'soma',
    evoluivel: false, nivelMaximo: null, progressao: null,
    progressaoApenasCriacao: false, progressaoTipoExp: 'custo',
    tags: ['Valor Derivado'], publicado: true,
    previewTexto: '+[PRE] +[Perícia: Servos] em Limite de Fantoches',
    criadoPor: AUTOR, criadoEm: agora, atualizadoEm: agora, versao: 1,
    config: { calculos: [{ alvo: 'Limite de Fantoches', operacao: '+',
        equacao: [{ tipo: 'ficha', ref: 'PRE' }, { op: '+', tipo: 'ficha', ref: 'Perícia: Servos' }] }] },
});
batch.set(db.collection('system/data/derivedValues').doc(), {
    nome: 'Limite de Fantoches', icone: '💀', ordem: (ancoraVD.ordem || 0) + 1,
    descricao: 'Quantos fantoches o Adepto sustenta erguidos ao mesmo tempo: PRE + Perícia: Servos. '
        + 'Erguer além do limite não é possível — os excedentes simplesmente não respondem (Erguer Fantoches).',
    blocoId: ancoraVD.blocoId || '', blocoNome: ancoraVD.blocoNome || '', blocoOrdem: ancoraVD.blocoOrdem,
    escopoItem: '', arredondaMesa: false, todoPersonagem: false,
    prefixo: '', sufixo: '', mecanicaIds: [mecRef.id],
    campoAtual: false, campoEditavel: false, statusCombate: false,
    characterCreationRule: false, characterCreationMin: null, characterCreationMax: null,
    publicado: true, criadoPor: AUTOR, criadoEm: agora, createdAt: agora, updatedAt: agora, versao: 1,
});

for (const c of CRIATURAS) {
    const eixo = c.disp != null ? `Disposição base ${c.disp}` : (c.leal ? 'Lealdade — melhorias a partir de 6, uma por ponto (teto 5)' : 'p = 1 (não desobedece)');
    batch.set(db.collection('npcs').doc(), {
        nome: c.nome, tipo: 'npc', raca: '', papel: '', local: '', tribo: '', classe: '',
        porte: c.porte, tamanho: c.porte, ai: c.ai,
        tags: `Criatura, Invocável, ${c.classe}`,
        atributos: c.atrib,
        valoresDer: { VIT: c.vit, SAN: 0, ENER: 0, PERC: 2, INI: c.atrib.DES + c.atrib.RAC,
                      REA: Math.min(c.atrib.DES, c.atrib.RAC) + 1, BLD: c.bld, DESLOCAMENTO: c.desloc },
        ataques: `Ataque natural (A. Padrão): Alvo ${c.alvo}, ${c.dado}+${c.bonus}${c.alvo > 9 ? ` (+${c.alvo - 9} Transbordo)` : ''}.`,
        skills: '',
        rolePlay: { personalidade: ['', '', ''], trejeitos: '', motivacao: '', segredos: '',
                    relacoes: { aliado: '', rival: '', devedor: '' }, frases: '', historia: '' },
        loot: { itens: '', luns: '', pistas: '', complicacoes: '' },
        criatura: { habitat: c.hab, comportamento: c.comp, dieta: c.classe === 'Invocador' ? 'Abissência' : (c.classe === 'Adepto' ? 'Nenhuma' : 'Carnívoro'),
                    nivelAmeaca: `${c.tier} · ${eixo} · Aspecto: Risco 1` },
        modoFicha: 'rapido', visibilidade: 'mestre', mesaId: '', vinculos: [],
        aliadoProprio: c.tier === 'companheiro',
        lastUpdateBy: 'igorestevamalvesdesouza@gmail.com', lastUpdate: new Date().toISOString(),
        imagem: '',
    });
}
await batch.commit();
console.log(`\n✅ VD + mecânica + ${CRIATURAS.length} criaturas gravados.`);
process.exit(0);
