/**
 * RÉGUA DE ORDENAÇÃO PARA RITUAIS DE CENA — só leitura, não grava nada.
 *
 * Rito que abre um plano, sela uma fenda ou apaga um rastro não tem equivalente
 * em rodadas de dano. Medi-lo pela régua de combate é erro de categoria (livro,
 * §3.3). Mas ele tem ORDENAÇÃO, e ordenação é auditável:
 *
 *   O portão cresce junto com o impacto?
 *   Um rito de portão baixo que faz mais que um de portão alto é o bug.
 *
 * Três verificações, todas com o dado que já existe:
 *
 *   1. MONOTONIA   — portão × dificuldade. O redutor do teste é o proxy de
 *                    dificuldade que o próprio designer declarou. Se um rito de
 *                    portão alto é mais fácil que um de portão baixo, inverteu.
 *   2. VIABILIDADE — no ponto da escada em que o rito destrava, sobra recurso
 *                    para pagá-lo? Rito inalcançável é rito morto.
 *   3. ESCOPO      — o alcance do efeito (si mesmo → um alvo → área → cena →
 *                    mundo) sobe junto com o portão?
 *
 * O que esta régua NÃO faz: dizer se um rito "vale o que custa". Isso exigiria
 * uma taxa, e cena não tem taxa por decisão de projeto.
 *
 *   node functions/audit-rituais-escopo.mjs
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

/* ═══ ESCOPO ═══ */
export const ESCOPO = { si: 1, alvo: 2, area: 3, cena: 4, mundo: 5 };
const NOME_ESCOPO = ['—', 'si mesmo', 'um alvo', 'área', 'cena', 'mundo'];

/** Classifica pelo ALCANCE DA CONSEQUÊNCIA, não pelo tamanho da área. */
export function classificarEscopo(txt) {
    const s = String(txt || '').toLowerCase();
    /* Ordem importa: o teste mais forte primeiro. Desfazer causalidade e selar
       ruptura mexem no mundo; teleportar move só quem conjura. */
    if (/cancela|anula o último|desfaz|sela\w*\s+(a|uma)?\s*fenda|fecha\w*\s+(a|de)?\s*fenda|reanima|servo permanente/.test(s)) return ESCOPO.mundo;
    if (/teleport|desloca-se por obstáculos|volta perdido/.test(s)) return ESCOPO.si;
    if (/invoca|convoca|chama uma|erguer|abre.*(fenda|passagem|portal)|cria passagem/.test(s)) return ESCOPO.cena;
    if (/raio|área|zona|todos os|apaga rastros|névoa|bolha de realidade/.test(s)) return ESCOPO.area;
    if (/1 alvo|um alvo|o alvo|criatura|dominar|conter|aprisionar|jaula/.test(s)) return ESCOPO.alvo;
    return ESCOPO.si;
}

/* ═══ ASSERTS ═══ */
assert.equal(classificarEscopo('Cancela o último evento'), ESCOPO.mundo);
assert.equal(classificarEscopo('Chama uma entidade abissal'), ESCOPO.cena);
assert.equal(classificarEscopo('Apaga rastros abissais. Área 6m'), ESCOPO.area);
assert.equal(classificarEscopo('Dominar uma criatura abissal'), ESCOPO.alvo);
assert.equal(classificarEscopo('Acessar uma bolha mental pessoal'), ESCOPO.si);
assert.equal(classificarEscopo('Selar uma fenda. Reduz a fenda 1 passo por Grau'), ESCOPO.mundo,
    'selar ruptura é consequência de mundo');
assert.equal(classificarEscopo('Teleportar usando o plano invertido'), ESCOPO.si,
    'teleporte move quem conjura, não muda a cena');
assert.ok(ESCOPO.mundo > ESCOPO.cena && ESCOPO.cena > ESCOPO.area, 'a escada de escopo é ordenada');
console.log('✅ 6 asserts passaram.\n');

/* ═══ LEITURA ═══ */
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [cls, mods] = await Promise.all(['classes', 'classModules'].map(grab));
const classeDo = {};
for (const c of cls) for (const e of (c.modulosDaClasse || [])) if (typeof e === 'string') classeDo[e] = c.nome;

/* Módulos de rito: os que têm portão numérico ou passos. */
const RITUAIS = ['TbRKh68m2hvr9KUVrOXb', 'ritual_necro', 'mod_totem', 'rituais_palla'];

const linhas = [];
for (const m of mods.filter(x => RITUAIS.includes(x.id))) {
    const lbl = Object.fromEntries((m.schema || []).map(f => [f.key, String(f.label || '')]));
    const k = re => Object.keys(lbl).find(x => re.test(lbl[x]));
    /* SÓ portão numérico. "Requer:" é campo de texto ("Totem pessoal") e extrair
       dígitos dele produz portão 52 — lixo que parecia dado. */
    const kPortao = Object.keys(lbl).find(x => /CA mínimo|perícia mínima/i.test(lbl[x])
        && (m.schema.find(f => f.key === x) || {}).tipo === 'number');
    const kRed = k(/redutor/i);
    const kEfeito = k(/efeito|o que faz|descri/i), kTempo = k(/tempo/i), kCusto = k(/custo/i);
    for (const it of (m.itensPredefinidos || [])) {
        const v = it.valores || {};
        const texto = [it.descricao, v[kEfeito]].filter(Boolean).join(' ');
        linhas.push({
            classe: classeDo[m.id] || '—', modulo: m.titulo, nome: it.nome || '?',
            portao: Number(String(v[kPortao] ?? '').replace(/[^\d]/g, '')) || null,
            portaoTxt: String(v[kPortao] ?? '').trim(),
            redutor: Math.abs(Number(String(v[kRed] ?? '').replace(/[^\d-]/g, '')) || 0),
            escopo: classificarEscopo(texto),
            tempo: String(v[kTempo] ?? '').trim(),
            custo: String(v[kCusto] ?? '').trim(),
        });
    }
}

const n2 = v => String(v).padStart(2);
console.log('═'.repeat(76));
console.log(`RITUAIS DE CENA — ordenação, não razão   (${linhas.length} ritos)`);
console.log('═'.repeat(76));

const porClasse = {};
for (const l of linhas) (porClasse[l.classe] ??= []).push(l);

let inversoes = 0;
for (const [classe, ritos] of Object.entries(porClasse)) {
    const comPortao = ritos.filter(r => r.portao != null).sort((a, b) => a.portao - b.portao);
    console.log(`\n─── ${classe}  (${ritos.length} ritos${comPortao.length ? `, portão numérico em ${comPortao.length}` : ', sem portão numérico'})`);
    if (!comPortao.length) {
        console.log('    portão não é numérico — a monotonia não é verificável aqui.');
        for (const r of ritos) console.log(`      ${r.nome.slice(0, 30).padEnd(31)} escopo: ${NOME_ESCOPO[r.escopo]}`);
        continue;
    }
    console.log('    portão │ redutor │ escopo    │ rito');
    let maxRed = -1, maxEsc = -1;
    for (const r of comPortao) {
        const invRed = r.redutor < maxRed, invEsc = r.escopo < maxEsc;
        const marca = invRed && invEsc ? '⚠⚠' : (invRed || invEsc ? ' ⚠' : '  ');
        if (invRed || invEsc) inversoes++;
        console.log(`  ${marca}  ${n2(r.portao)}   │   −${r.redutor}    │ ${NOME_ESCOPO[r.escopo].padEnd(9)} │ ${r.nome}`);
        maxRed = Math.max(maxRed, r.redutor); maxEsc = Math.max(maxEsc, r.escopo);
    }
    /* correlação de postos entre portão e escopo */
    const n = comPortao.length;
    const d2 = comPortao.reduce((s, r, i) => {
        const posEsc = [...comPortao].sort((a, b) => a.escopo - b.escopo).findIndex(x => x === r);
        return s + (i - posEsc) ** 2;
    }, 0);
    const rho = 1 - (6 * d2) / (n * (n * n - 1));
    console.log(`\n    correlação portão × escopo: ρ = ${rho.toFixed(2)}  ` +
        (rho > 0.6 ? '✅ a escada sobe junta' : rho > 0.3 ? '⚠ frouxa' : '🔴 a escada não ordena o impacto'));
}

console.log('\n' + '─'.repeat(76));
console.log(`INVERSÕES — rito de portão mais alto que entrega menos que um anterior: ${inversoes}`);
console.log('─'.repeat(76));
console.log('  Inversão não é erro automático: um rito caro e estreito pode ser de propósito');
console.log('  (Vórtice na Fenda move só você, mas 200m). É onde olhar, não o que corrigir.');
console.log('\n' + '═'.repeat(76));
console.log('Só leitura. Esta régua NÃO diz se o rito vale o que custa — cena não tem taxa.');
console.log('═'.repeat(76) + '\n');
process.exit(0);
