/**
 * Rebase dos carimbos `regua` para a unidade 3,90 (§0.2 / §0.2b).
 *
 * Cada carimbo ganha o campo `base`, dizendo em que unidade foi calculado.
 * Sem isso não dá para saber quais medições precedem a troca — e um número
 * sem base é superstição.
 *
 * SÓ recomputa o que eu sei recompor: as habilidades derivadas nesta sessão,
 * onde a composição das unidades está registrada. As demais ficam marcadas
 * `base: 3.445` e a auditoria as acusa — fabricar um reescalonamento cego
 * sobre composição desconhecida seria inventar número.
 *
 *   node functions/rebase-carimbos-390.mjs            (dry-run)
 *   node functions/rebase-carimbos-390.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const D = db.collection('system').doc('data');

/* Recomposto termo a termo com as taxas do §0.2b:
   dano entregue 0,256 · Alvo 0,167 · Blindagem e dano-em-golpe 0,154
   atacar quem nao pode reagir 0,167 · turno roubado 1,000 · Atordoado 1,167 */
const NOVOS = {
    // Oculto 1 rodada 0,167 + Celere 5 x 5 x 0,050
    'pdi_1785100363861_5l': { u: 1.42, c: 1.333, nota: 'Oculto 0,167 + Célere 5 (1,250)' },
    // golpe 1,000 + ignora Blindagem 0,308 + 2/Grau x 3 x 0,154 -- nada mudou
    'pdi_1785100363861_0l': { u: 2.23, c: 2.00, nota: 'só taxas que não mudaram (0,154)' },
    // golpe + ignora Defesa 0,167 + ignora Blindagem 0,308 + 7 dano 1,078 + Atordoado 1,167 + Oculto 0,167
    'pdi_1785100363861_9l': { u: 3.89, c: 2.00, nota: 'Atordoado 1,167 e ignora-Defesa 0,167' },
    // 5 turnos roubados -- inalterado
    'pdi_inv_1785107140941_0': { u: 5.00, c: 3.29, nota: 'turno roubado não mudou' },
    // evento cancelado 1,000 + Atordoado 1,167
    'pdi_inv_1785107140941_7': { u: 2.17, c: 2.29, nota: 'Atordoado caiu de 1,32 para 1,167' },
    // golpe 1,000 + contra-ataque evitado 0,167 + 5+Graus ignora Defesa 0,033
    'pdi_1785100363861_2l': { u: 1.20, c: 1.333, nota: 'contra-ataque evitado caiu à metade' },
    // revelar oculto 0,167x5 + escuridao (metade do Ofuscado 1,80)
    'pdi_sang_1785111472286_12': { u: 1.74, c: 2.742, nota: 'revelar oculto caiu de 1,60 para 0,835' },
    // banimento ~4 rodadas x 1,000
    'pdi_totem_1785111662028_7': { u: 4.00, c: 3.00, nota: 'turno roubado não mudou' },
    // aliados +1 e inimigos -1 (3 alvos x 5 rodadas x 0,167) + redirecionar 5,000
    'pdi_sono_1785112141051_c52': { u: 10.01, c: 6.00, nota: 'Alvo 0,170 → 0,167' },
    // revelar 0,835 + escuridao 0,90
    'pdi_palla_1785110362700_2': { u: 1.74, c: 2.00, nota: 'revelar oculto caiu à metade' },
    // 3 x (-3 Alvo 0,501 + recuo 0,150)
    'pdi_palla_1785110362700_10': { u: 1.95, c: 2.00, nota: 'Alvo 0,170 → 0,167' },
    // 3 alvos x (reposicionar 0,400 + contra-ataque 0,167)
    'pdi_palla_1785110362700_9': { u: 1.70, c: 2.00, nota: 'contra-ataque evitado caiu à metade' },
    // 2 inimigos x 0,85 x 0,667 x 3 rodadas -- base em acao, inalterado
    'pdi_sono_1785112141051_c25': { u: 3.40, c: 3.00, nota: 'valor em ação, não muda com a base' },
    // Encantado 2,000/rodada x 4 -- turno roubado + DPR ganho, inalterado
    'pdi_sono_1785112141051_c51': { u: 8.00, c: 6.00, nota: 'turno roubado não mudou' },
};

let rebase = 0, marcados = 0;
const quedas = [];
for (const doc of (await D.collection('classModules').get()).docs) {
    const m = doc.data();
    if (m.publicado === false) continue;
    let mudou = false;
    const itens = (m.itensPredefinidos || []).map(p => {
        if (!p.regua || p.regua.base === 3.90) return p;
        const n = NOVOS[p.id];
        if (n) {
            const razao = n.c > 0 ? Math.round((n.u / n.c) * 100) / 100 : null;
            const antes = p.regua.razao;
            if (antes != null && antes >= 1 && razao < 1) quedas.push(`${p.nome}: ${antes}× → ${razao}×`);
            mudou = true; rebase++;
            console.log(`  REBASE ${(p.nome || '').padEnd(28)} ${antes}× → ${razao ?? '—'}×   (${n.nota})`);
            return { ...p, regua: { ...p.regua, unidades: n.u, custo: n.c, razao, base: 3.90, em: '2026-08-16' } };
        }
        mudou = true; marcados++;
        return { ...p, regua: { ...p.regua, base: 3.445 } };
    });
    if (mudou && APPLY) await doc.ref.update({ itensPredefinidos: itens });
}
console.log(`\n${rebase} recomputados na base 3,90 · ${marcados} marcados como base 3,445 (pendentes)`);
if (quedas.length) { console.log('\nCAIRAM ABAIXO DO PISO:'); quedas.forEach(q => console.log(`  ! ${q}`)); }
console.log(APPLY ? '\nAPLICADO' : '\nDRY-RUN — rode com --apply');
process.exit(0);
