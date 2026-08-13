/** Xamã na régua v2 — Golpes do Verde e as Dádivas do Receptor.
 *  Mesma convenção dos irmãos (__aplica-marciais/pallacerdote/sangral-v2):
 *  unidades calculadas à mão aqui, nunca por regex.
 *  node functions/__aplica-xama-v2.mjs [--apply] */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore(); const APLICAR = process.argv.includes('--apply'); const HOJE = '2026-08-13';
const U = 3.445, ALVO = 0.585 / U, BLIND = 0.53 / U, DANO = 1 / U, GOLPE = 0.53 * DANO;
const EN = 1.00, PADRAO = 1.00, CENA = 5, TETO = 7;
const pB = r => Math.max(0, Math.min(7 + r, 9)) / 10;          // buff em si/aliado
const pD = r => Math.max(0, Math.min(7 + r, 9) - 3) / 10;      // contra defesa
const alvosArea = (f, R) => { const a = f === 'cone' ? (60 / 360) * Math.PI * R * R : Math.PI * R * R;
    return Math.max(1, Math.min(Math.floor(a / 9), TETO)); };
const IMOB = 0.69;
const T_RES = 2.00, T_BUFF = 1.70;
const med = (n, f) => n * (f + 1) / 2;

/* GOLPES DO VERDE — hostis. A Verde morde a Azul antes da hora, então só
   ferem alvo VIVO: contra morto-vivo, construto ou Eco não há o que morder.
   [energia, dados, forma, raio, rodadasImob, texto] */
const G = {
 'Toque do Húmus': [1, [5, 8], 'nenhuma', null, 0,
   'A terra sob o alvo lembra do que ele vai ser. 5d8 de dano de Natureza num alvo a 3m. Só fere alvo VIVO — onde não há Essência Azul, a Verde não tem o que morder.'],
 'Mordida Verde': [2, [6, 10], 'nenhuma', null, 2,
   'Raízes finas atravessam a bota e procuram o sangue quente. 6d10 de dano de Natureza num alvo a 9m, e ele fica Imobilizado por 2 rodadas. Só fere alvo VIVO.'],
 'Colheita Antecipada': [3, [8, 10], 'nenhuma', null, 2,
   'A Natureza cobra adiantado o que receberia de qualquer jeito. 8d10 de dano de Natureza num alvo a 9m, e ele fica Imobilizado por 2 rodadas. Só fere alvo VIVO.'],
 'A Terra Reclama': [4, [5, 10], 'cone', 6, 2,
   'O chão abre a boca num arco à sua frente. Cone de 6m: 5d10 de dano de Natureza em cada um dentro, e todos ficam Imobilizados por 2 rodadas. Só fere alvos VIVOS.'],
 'Retorno ao Rio': [5, [12, 10], 'nenhuma', null, 3,
   'O Xamã não espera a gota cair: puxa o rio até ela. 12d10 de dano de Natureza num alvo a 9m, e ele fica Imobilizado por 3 rodadas. Só fere alvo VIVO. Se o alvo cair por este golpe, o Eco dele se forma na hora e pode ser buscado sem Cravar Totem novo.'],
};

/* DÁDIVAS — buff em si mesmo, 1 cena, dentro do Receptor (2 Energia). */
const DADIVAS = [
    ['BRAÇO', 'lutou, caçou, matou', '+4 de dano e +3 no Alvo dos seus ataques', pB(0) * (4 * GOLPE + 3 * ALVO) * CENA],
    ['PELE', 'aguentou; fera de couro', '+7 de Blindagem', pB(0) * (7 * BLIND) * CENA],
    ['OLHO', 'batedor, vigia, ave', '+5 no Alvo de ataques à distância e +5 em Observação', pB(0) * (5 * ALVO + 5 * ALVO * 0.25) * CENA],
    ['PASSO', 'corria; fera veloz', '+9m de Deslocamento, +5 em Furtividade e Atletismo', null],
    ['BOCA', 'orador, líder, sacerdote', '+5 no Alvo de testes sociais', null],
];

/* ═══ CONTAS ═══ */
const linhas = [];
for (const [nome, [en, [n, f], forma, raio, rod]] of Object.entries(G)) {
    const alvos = forma === 'cone' ? alvosArea(forma, raio) : 1;
    const un = pD(0) * (med(n, f) * DANO + rod * IMOB) * alvos;
    const custo = en * EN + PADRAO;
    linhas.push({ nome, en, un, custo, r: un / custo, alvos, forma, raio, rod, dados: `${n}d${f}` });
}
const dadivaMax = Math.max(...DADIVAS.filter(d => d[3]).map(d => d[3]));
const custoRec = 2 * EN + PADRAO;

for (const l of linhas) {
    assert.ok(l.r >= 1.00, `${l.nome}: ${l.r.toFixed(2)}× abaixo do piso`);
    assert.ok(l.r <= T_RES, `${l.nome}: ${l.r.toFixed(2)}× acima do teto hostil ${T_RES}`);
}
assert.ok(dadivaMax / custoRec >= 1.00 && dadivaMax / custoRec <= T_BUFF,
    `Dádiva maior: ${(dadivaMax / custoRec).toFixed(2)}× fora da faixa de buff`);
assert.equal(linhas.length, 5, 'um golpe por estágio');

console.log('XAMÃ v2 — hostil pD(0)=0,40 · buff pB(0)=0,70 · faixa 1,00–2,00× (hostil) / 1,00–1,70× (buff)\n');
console.log('  golpe                  En  dados      forma      alv  un     custo  razão');
for (const l of linhas) console.log(`  ${l.nome.padEnd(22)} ${l.en}  ${l.dados.padEnd(9)} ${(l.forma === 'cone' ? `cone ${l.raio}m` : 'único').padEnd(10)} ${String(l.alvos).padStart(3)}  ${l.un.toFixed(2).padStart(5)}  ${l.custo.toFixed(2)}   ${(l.r).toFixed(2)}×`);
console.log('\n  Dádivas do Receptor (custo 2 Energia + Ação Padrão = 3,00):');
for (const [nome, quem, efeito, un] of DADIVAS)
    console.log(`  ${nome.padEnd(7)} ${efeito.padEnd(52)} ${un ? `${un.toFixed(2)} un → ${(un / custoRec).toFixed(2)}×` : 'economia de cena'}`);

const mods = await db.collection('system/data/classModules').get();
const verde = mods.docs.find(d => d.id === 'mod_verde_xama');
const totem = mods.docs.find(d => d.id === 'mod_totem');
if (!verde || !totem) { console.error('🔴 módulo não achado'); process.exit(1); }

const itensVerde = (verde.data().itensPredefinidos || []).map(it => {
    const l = linhas.find(x => x.nome === it.nome); if (!l) return it;
    const [en, , forma, raio, rod, txt] = G[it.nome];
    return { ...it, descricao: txt,
        valores: { ...(it.valores || {}), 3: `${en} Energia`, 6: txt, acao: 'Ação Padrão' },
        formaArea: forma, tamanhoArea: raio, alvosMax: l.alvos,
        condicoesAplicadas: rod ? [{ condicao: 'Imobilizado', portao: 'resistencia', chance: null, alvos: l.alvos, rodadas: rod }] : [],
        regua: { razao: Math.round(l.r * 100) / 100, unidades: Math.round(l.un * 100) / 100, custo: l.custo, em: HOJE },
    };
});
const DE = '· BRAÇO (lutou, caçou, matou) — +2 de dano e +2 no Alvo dos seus ataques';
const bloco = DADIVAS.map(([n, quem, ef]) => `· ${n} (${quem}) — ${ef}`).join('\n');
let erroTxt = null;
const itensTotem = (totem.data().itensPredefinidos || []).map(it => {
    if (it.nome !== 'Transcendência — Receptor') return it;
    const t = String(it.descricao || '');
    const i = t.indexOf('· BRAÇO'), j = t.indexOf('Eco ANCESTRAL');
    if (i < 0 || j < 0) { erroTxt = 'Receptor: âncora das Dádivas não achada'; return it; }
    const novo = t.slice(0, i) + bloco + '\n' + t.slice(j);
    return { ...it, descricao: novo, valores: { ...(it.valores || {}), 6: novo },
        regua: { razao: Math.round(dadivaMax / custoRec * 100) / 100, unidades: Math.round(dadivaMax * 100) / 100, custo: custoRec, em: HOJE } };
});
if (erroTxt) { console.error('\n🔴 ' + erroTxt); process.exit(1); }
console.log(`\n  itens: ${itensVerde.length}/5 golpes · Receptor recarimbado`);
if (!APLICAR) { console.log('\n(dry-run)'); process.exit(0); }
const ts = admin.firestore.Timestamp.now();
await verde.ref.update({ itensPredefinidos: itensVerde, atualizadoEm: ts });
await totem.ref.update({ itensPredefinidos: itensTotem, atualizadoEm: ts });
console.log('\n✅ gravado.');
process.exit(0);
