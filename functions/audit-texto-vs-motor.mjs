// =============================================
// AUDITORIA — o TEXTO que o jogador lê bate com o MOTOR que roda?
// ---------------------------------------------
// Toda regra deste sistema existe em três cópias: o código (shared/), o texto
// dos predefs no banco e os livros. Só a primeira tem teste — e a sessão de
// 25/08/2026 achou cinco divergências que rodaram em silêncio por semanas:
// lista de 7 Dádivas contra catálogo de 9, campo raso contra campo aninhado,
// "+7 de Blindagem" fixo contra cálculo por ficha, §9 precificando um modelo
// morto, custo "2 ENER + 2 SAN" que já não existia.
//
// Esta auditoria fixa INVARIANTES: frases e números que o texto TEM de conter
// (ou não conter) enquanto o motor for o que é. Cada checagem deriva o valor
// do código na hora — mudou a constante, a auditoria cobra o texto no mesmo
// commit. Ela não entende prosa: fixa âncoras. Se uma âncora sumir porque o
// texto foi legitimamente reescrito, atualize a âncora AQUI, no mesmo commit.
//
// SÓ LEITURA. Sai com 1 se achar divergência.
// =============================================
import { createRequire } from 'node:module';
import { DADIVAS, TAXA, TETO_SEM_AURA, dadoSugerido } from '../shared/dadiva.js';
import { ORCAMENTO_BASE, UNIDADES_POR_SANIDADE, SANIDADE_PROJETOR_PISO,
    PODER_POR_SANIDADE, REDUTOR_DO_VEU, dadivasDoHospede } from '../shared/incorporacao.js';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

let furos = 0, checagens = 0;
const furo = (onde, msg) => { furos++; console.log(`!! ${onde}\n     ${msg}`); };
const ok = () => { checagens++; };
const contem = (onde, txt, ancora, motivo) => {
    checagens++;
    if (!txt.includes(ancora)) furo(onde, `falta ${JSON.stringify(ancora)} — ${motivo}`);
};
const naoContem = (onde, txt, ancora, motivo) => {
    checagens++;
    if (txt.includes(ancora)) furo(onde, `sobrou ${JSON.stringify(ancora)} — ${motivo}`);
};

const plano = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const artigo = async (id) => plano((await db.collection('worldbuilding-articles').doc(id).get()).data()?.contentHTML);
const modulo = async (id) => (await db.collection('system').doc('data').collection('classModules').doc(id).get()).data();

/* ═══ 1 · o número de Dádivas, em todo lugar que o cita ═══ */
const N = Object.keys(DADIVAS).length;                    // hoje 9 — derivado, não digitado
const NOMES = Object.values(DADIVAS).map(d => d.nome);
const POR_EXTENSO = { 9: 'nove', 10: 'dez', 8: 'oito' }[N] || String(N);
{
    checagens++;
    const doMotor = dadivasDoHospede({}, 'eco');
    if (doMotor.length !== N) furo('shared/incorporacao.js', `dadivasDoHospede devolve ${doMotor.length}, o catálogo tem ${N} — a lista fixa voltou`);

    const cap1 = await artigo('pH0cqjh74rGy5qJZc3H5');     // Espiritismo
    contem('artigo Espiritismo', cap1, `são ${POR_EXTENSO}:`, `o catálogo tem ${N} Dádivas`);
    for (const nome of NOMES) contem('artigo Espiritismo', cap1, nome, 'Dádiva do catálogo sem menção');
    contem('artigo Espiritismo', cap1, 'rola-se um dado', 'o sorteio por dado é a regra, e o jogador precisa saber');
    contem('artigo Espiritismo', cap1, 'nenhum', 'a face de nenhum é a regra central do dado');

    const m = await modulo('mod_totem');
    const receptor = m.itensPredefinidos.find(p => p.nome === 'Transcendência — Receptor');
    const efeito = receptor?.valores?.['6'] || '';
    contem('predef Transcendência — Receptor', efeito, `são ${POR_EXTENSO.toUpperCase()}`, `o catálogo tem ${N}`);
    for (const nome of NOMES) contem('predef Transcendência — Receptor', efeito, `· ${nome.toUpperCase()}`, 'Dádiva do catálogo fora do predef');
}

/* ═══ 2 · nenhum texto vivo descreve o modelo morto ═══ */
{
    const MORTO = [
        ['+7 de Blindagem', 'efeito fixo da Pele, modelo de 5 Dádivas'],
        ['+9m de Deslocamento', 'efeito fixo do Passo'],
        ['o Mestre define ao gerar', 'a Dádiva não é escolhida no cadastro'],
        ['o que for melhor que o dele', 'regra da sobra, morta em 24/08/2026'],
        ['no valor 3 (Eco Comum)', 'perícia de valor fixo, virou Dádiva por tipo'],
    ];
    for (const id of ['mod_totem', 'ally_animal']) {
        const j = JSON.stringify(await modulo(id));
        for (const [ancora, motivo] of MORTO) naoContem(`classModules/${id}`, j, ancora, motivo);
    }
    for (const id of ['pH0cqjh74rGy5qJZc3H5', 'MD1Z9RdcBQo3wKL15KVD', 'art_ms3gb93y6turqk', 'K2LSQ7VqQfZEyLyepL1E']) {
        const t = await artigo(id);
        for (const [ancora, motivo] of MORTO) naoContem(`artigo ${id}`, t, ancora, motivo);
        naoContem(`artigo ${id}`, t, 'Mandingu', 'nome removido do cânone em 24/08/2026');
        naoContem(`artigo ${id}`, t, 'vertente', 'o termo é RAMO desde 25/08/2026');
    }
}

/* ═══ 3 · a escalonada do Receptor: parâmetros do motor no texto ═══ */
{
    const m = await modulo('mod_totem');
    const efeito = m.itensPredefinidos.find(p => p.nome === 'Transcendência — Receptor')?.valores?.['6'] || '';
    contem('predef Transcendência — Receptor', efeito,
        `entrega acima de ${ORCAMENTO_BASE} unidades cobra +1`, 'orçamento da escalonada divergiu do motor');
    contem('predef Transcendência — Receptor', efeito,
        `a cada ${UNIDADES_POR_SANIDADE} unidades`, 'divisor da escalonada divergiu do motor');
    naoContem('predef Transcendência — Receptor', JSON.stringify(m.itensPredefinidos.find(p => p.nome === 'Transcendência — Receptor')),
        '1 Energia + 2 Sanidade', 'a Sanidade fixa saiu em 25/08/2026 — só existe a escalonada');
}

/* ═══ 4 · o Projetor: fórmula de Poder+Véu e Redutor, nos dois textos ═══ */
{
    const m = await modulo('mod_totem');
    const p = m.itensPredefinidos.find(x => x.nome === 'Transcendência — Projetor');
    const efeito = p?.valores?.['6'] || '';
    contem('predef Transcendência — Projetor', efeito,
        `${SANIDADE_PROJETOR_PISO} + (Poder do Eco ÷ ${PODER_POR_SANIDADE}`, 'fórmula da Sanidade divergiu do motor');
    contem('predef Transcendência — Projetor', efeito,
        `Redutor ${REDUTOR_DO_VEU.eterico}. Exige Transcendência`, 'Redutor do Etérico divergiu do motor');
    contem('predef Transcendência — Projetor', efeito,
        `Redutor ${REDUTOR_DO_VEU.astral}. Exige um Eco`, 'Redutor do Astral divergiu do motor');
    contem('predef Transcendência — Projetor', efeito, 'NÃO recebe Dádiva', 'a projeção não sorteia — regra central');
    checagens++;
    if (p?.valores?.['4'] !== '2 Energia') furo('predef Transcendência — Projetor', `custo é ${JSON.stringify(p?.valores?.['4'])}, esperado "2 Energia" — Sanidade é calculada, não fixa`);

    const cap1 = await artigo('pH0cqjh74rGy5qJZc3H5');
    contem('artigo Espiritismo', cap1, `Redutor ${REDUTOR_DO_VEU.eterico} no Etérico, ${REDUTOR_DO_VEU.astral} no Astral`,
        'o Redutor do Véu no capítulo público divergiu do motor');
}

/* ═══ 5 · o dado sugerido: o exemplo canônico do 1d4 ═══ */
{
    checagens++;
    const d = dadoSugerido(3);
    if (d.rotulo !== '1d4' || d.nenhumEm !== 4)
        furo('shared/dadiva.js', `dadoSugerido(3) = ${d.rotulo}/nenhum em ${d.nenhumEm} — o exemplo "três atributos pedem 1d4, e o 4 não é nenhum" dos textos ficou falso`);
    const cap1 = await artigo('pH0cqjh74rGy5qJZc3H5');
    contem('artigo Espiritismo', cap1, 'pedem 1d4, e o 4 não é nenhum dos três', 'exemplo canônico do dado');
}

/* ═══ 6 · o teto e as taxas citados no §9 batem com o motor ═══ */
{
    const cap9 = await artigo('DA76qGdp3QZp8VCCUQPF');
    const n3 = (x) => x.toFixed(3).replace('.', ',');
    contem('§9 da Régua', cap9, `teto (${TETO_SEM_AURA} sem Aura`, 'TETO_SEM_AURA divergiu');
    for (const [nome, taxa] of [['alvo', TAXA.alvo], ['blindagem', TAXA.blindagem], ['vitalidade', TAXA.vitalidade]]) {
        contem('§9 da Régua', cap9, n3(taxa), `taxa de ${nome} divergiu do motor (TAXA.${nome} = ${taxa})`);
    }
    contem('§9 da Régua', cap9, `Sanidade = ⌊(unidades entregues − ${ORCAMENTO_BASE}) ÷ ${UNIDADES_POR_SANIDADE}⌋`, 'fórmula da escalonada divergiu');
    contem('§9 da Régua', cap9, `${SANIDADE_PROJETOR_PISO} + ⌊Poder do hóspede ÷ ${PODER_POR_SANIDADE}⌋`, 'fórmula da projeção divergiu');
    naoContem('§9 da Régua', cap9.replace(/Mudou em 25\/08\/2026[^.]*(\.[^.]*){0,4}\./, ''), '3,445', 'base velha fora do parágrafo de aviso');
}

/* ═══ 7 · Painel: os campos mortos não voltaram ═══ */
{
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../painel-mestre/js/area-npcs.js', import.meta.url), 'utf8');
    naoContem('painel-mestre/area-npcs.js', src, 'ecoDadiva', 'o select de Dádiva saiu — o hóspede entrega todas');
    naoContem('painel-mestre/area-npcs.js', src, 'ecoPRS', 'o campo de Poder duplicado saiu — a fonte é a PRS da ficha');
}

console.log(furos
    ? `\n❌ ${furos} divergência(s) texto-vs-motor em ${checagens} checagens.`
    : `\n✅ as ${checagens} checagens batem: o texto descreve o motor que roda.`);
process.exit(furos ? 1 : 0);
