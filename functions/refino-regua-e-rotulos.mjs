/**
 * Três refinamentos que não dependem de decisão do dono do mundo.
 *
 * 1. DOSAGEM — o preparo virou UM teste (Régua §8.7: "o preparo canônico tinha
 *    DOIS testes (Maceração + Dosagem). Virou um; a perícia Dosagem foi
 *    repropositada para a criação livre"). Os módulos de Receita já estão
 *    certos — quem não foi atualizado foi a DESCRIÇÃO do VD e da perícia
 *    Dosagem, que ainda se anunciam como "a etapa final e decisiva". Alinha.
 *
 * 2. condicoesAplicadas GANHA `alvos` e `rodadas` POR CONDIÇÃO. Hoje a régua
 *    lê a duração do ITEM — e erra quando o dano é instantâneo e a condição
 *    dura (Lamento da Banshee, Marcha do Cataclismo: dur=0 instantaneo com
 *    Amedrontado/Prostrado pendurados).
 *
 * 3. `requer` — Golpe pelas Costas exige estar furtivo, o que só Passos
 *    Sombrios entrega. A régua media a segunda como se fosse avulsa.
 *
 * Valores de rodadas: 1 turno = 1 · 1 cena = 5 (§0.1). Onde o texto NÃO
 * declara duração, arbitra-se o PISO (1 rodada) — nunca infla, e fica
 * listado na saída para conferência.
 *
 *   node functions/refino-regua-e-rotulos.mjs            (dry-run)
 *   node functions/refino-regua-e-rotulos.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

/* ── 1. Dosagem: da "etapa final do preparo" para a criação livre ── */
const DOSAGEM_VD = 'Cálculo de proporção na criação de uma receita NOVA: quanto de cada propriedade entra, '
    + 'onde a soma vira amplificação e onde vira reação. Não é mais etapa do preparo — preparar uma receita '
    + 'conhecida é um teste só, o Macerar (Régua §8.7). A Dosagem é a mesa de projeto do alquimista.';
const DOSAGEM_PER = 'A perícia de PROJETAR loções: equilibrar propriedades numa receita inédita, prever se o par '
    + 'soma, amplifica ou reage, e fechar a potência sem estourar a Lei da Dosagem. Preparar receita já conhecida '
    + 'não a usa — isso é o Macerar.';

/* ── 2. alvos/rodadas por condição, lidos do texto de cada item ── */
const T = 1, CENA = 5;
const COND = {
    'Atordoar':                      { alvos: 1, rodadas: T },
    'Imobilizar':                    { alvos: 1, rodadas: CENA, nota: 'até escapar — precificado como cena (1,65×)' },
    'Cegueira da Fé I':              { alvos: 1, rodadas: CENA },
    'GRITO DISSONANTE [V, S]':       { alvos: 1, rodadas: T },
    'INTIMIDAÇÃO SÔNICA [V, P]':     { alvos: 1, rodadas: CENA },
    'NANA DO ENTORPECIMENTO [V, C]': { alvos: 1, rodadas: CENA },
    'ONDA DE CHOQUE SONORAL [P, S]': { alvos: 3, rodadas: T },
    'LAMENTO DA BANSHEE [V, S]':     { alvos: 3, rodadas: T, piso: true },
    'MARCHA DO CATACLISMO [P, S]':   { alvos: 3, rodadas: T, nota: 'Prostrado custa 1 ação para levantar' },
    'TROMBETA DO JULGAMENTO [S]':    { alvos: 3, rodadas: T, piso: true },
};

/* ── 3. encadeamento ── */
const REQUER = { 'Golpe pelas Costas': 'Passos Sombrios' };

assert.ok(Object.values(COND).every(c => c.rodadas >= 1 && c.alvos >= 1), 'sem zero');
assert.ok(!Object.values(COND).some(c => c.piso && c.rodadas > 1), 'piso é 1 rodada');

const [mods, vds, sks] = await Promise.all(
    ['classModules', 'derivedValues', 'skills'].map(c => db.collection('system/data/' + c).get()));

const erros = [], plano = { dosagem: [], cond: [], requer: [] };

for (const d of vds.docs) if (d.data().nome === 'Dosagem') plano.dosagem.push({ ref: d.ref, campo: 'VD', texto: DOSAGEM_VD });
for (const d of sks.docs) if (d.data().nome === 'Dosagem') plano.dosagem.push({ ref: d.ref, campo: 'perícia', texto: DOSAGEM_PER });
if (plano.dosagem.length !== 2) erros.push(`Dosagem: ${plano.dosagem.length} alvos (esperado 2)`);

const modsAlterados = new Map();
for (const d of mods.docs) {
    const m = d.data();
    let mexeu = false;
    const itens = (m.itensPredefinidos || []).map(it => {
        let novo = it;
        const c = COND[it.nome];
        if (c && Array.isArray(it.condicoesAplicadas) && it.condicoesAplicadas.length) {
            if (it.condicoesAplicadas.some(x => x.rodadas != null)) { erros.push(`${it.nome}: já tem rodadas`); return it; }
            novo = { ...novo, condicoesAplicadas: it.condicoesAplicadas.map(x => ({ ...x, alvos: c.alvos, rodadas: c.rodadas })) };
            plano.cond.push({ nome: it.nome, conds: it.condicoesAplicadas.map(x => x.condicao), ...c });
            mexeu = true;
        }
        if (REQUER[it.nome]) {
            if (it.requer) { erros.push(`${it.nome}: já tem requer`); return novo; }
            novo = { ...novo, requer: REQUER[it.nome] };
            plano.requer.push({ nome: it.nome, requer: REQUER[it.nome], modulo: m.titulo });
            mexeu = true;
        }
        return novo;
    });
    if (mexeu) modsAlterados.set(d.ref, itens);
}
const faltando = Object.keys(COND).filter(n => !plano.cond.some(p => p.nome === n));
if (faltando.length) erros.push(`não achados: ${faltando.join(', ')}`);
if (!plano.requer.length) erros.push('Golpe pelas Costas não achado');

console.log('=== Refinamentos ===\n');
console.log('1. Dosagem — descrição alinhada ao preparo de UM teste:');
for (const p of plano.dosagem) console.log(`   ${p.campo} Dosagem → "${p.texto.slice(0, 72)}…"`);
console.log(`\n2. condicoesAplicadas ganha alvos/rodadas (${plano.cond.length} itens):`);
for (const p of plano.cond) console.log(`   ${p.nome.padEnd(30)} ${p.conds.join('+').padEnd(16)} alvos ${p.alvos} · ${p.rodadas} rod${p.piso ? '  ⚠ piso arbitrado (texto não declara)' : p.nota ? `  — ${p.nota}` : ''}`);
console.log('\n3. Encadeamento:');
for (const p of plano.requer) console.log(`   ${p.nome} → requer "${p.requer}"  [${p.modulo}]`);

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
console.log(`\n  ${modsAlterados.size} módulos tocados.`);
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const batch = db.batch();
for (const p of plano.dosagem) batch.update(p.ref, { descricao: p.texto, atualizadoEm: admin.firestore.Timestamp.now() });
for (const [ref, itens] of modsAlterados) batch.update(ref, { itensPredefinidos: itens, atualizadoEm: admin.firestore.Timestamp.now() });
await batch.commit();
console.log('\n✅ Gravado.');
process.exit(0);
