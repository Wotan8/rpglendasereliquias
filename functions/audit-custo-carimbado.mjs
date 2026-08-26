// =============================================
// AUDITORIA — o `regua.custo` bate com recursos + ação (§0.6)?
// ---------------------------------------------
// A v1 da régua media unidades ÷ recurso e esquecia a ação. A correção do §0.6
// diz: custo total = recursos + ação. Carimbo que não foi refeito depois disso
// tem denominador pequeno demais e a razão sai INFLADA — a habilidade parece
// aprovada sem estar.
//
// O parse do campo de custo mora em parse-custo.mjs, com teste próprio. Não
// reimplemente aqui: a primeira versão desta auditoria tinha parser próprio,
// somava as alternativas de "ou" e acusou 18 furos onde havia 4.
//
// SÓ LEITURA. Sai com 1 se achar divergência.
// =============================================
import { createRequire } from 'node:module';
import { ACAO, recursoDoPredef } from './parse-custo.mjs';

const UNIDADE_POR_EXP = 0.10;
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

// degrau no título do módulo ("Custo 3 — Clímax") é o preço, na moeda do módulo

// Divergências JÁ examinadas e aceitas. Auditoria que grita sobre o que já foi
// julgado vira ruído — mas o motivo fica aqui, para ninguém "consertar" de novo.
const ACEITAS = {
    // O numerador 2,75 desta e do Golpe Cruzado (mesma familia "ataque extra")
    // nao e reproduzivel por "1 golpe = 1,000". Recomputada, ela entrega ~1,000
    // por 1,333 = 0,75x: SUBdimensionada. Nao mexer ate o modelo de ataque
    // extra ficar decidido. Ver memoria numerador-ataque-extra.
    //
    // 'Transcendência — Receptor' saiu daqui em 25/08/2026: a alternativa de
    // pagamento que justificava a excecao ("1 Energia + 2 Sanidade") deixou de
    // existir. O custo agora e "2 Energia" e toda a Sanidade dela e a
    // escalonada de shared/incorporacao.js, que nao passa por este parser.
};

const degrau = t => Number((String(t || '').match(/custo\s+(\d+)/i) || [])[1] || 0);

let furos = 0, checadas = 0, semCusto = 0, aceitas = 0;
for (const doc of (await db.collection('system').doc('data').collection('classModules').get()).docs) {
    const m = doc.data();
    if (m.publicado === false) continue;
    const campos = (m.schema || []).filter(f => /custo/i.test(f.label || '') && f.tipo !== 'select_botao');
    const d = degrau(m.titulo);
    for (const p of (m.itensPredefinidos || [])) {
        if (p.economia !== 'combate' || p.regua?.custo == null) continue;
        checadas++;
        const acao = ACAO[p.valores?.acao] ?? 1.0;
        const rec = recursoDoPredef(campos, p.valores) || d;
        // O EXP entra no denominador desde 24/08/2026: a habilidade custa recurso
        // e ação POR USO, mais 0,10 unidade por EXP que ela custou para existir.
        // Ver functions/exp-no-denominador.mjs para a derivação do 0,10.
        const exp = UNIDADE_POR_EXP * (Number(p.custoExpProprio) || 0);

        // §0.8 continua mandando onde o custo POR USO é zero (Ação Livre sem
        // recurso). O termo de EXP não salva a divisão: 0,53 ÷ 0,10 dá 5,30×,
        // que é ruído e não medida. Ali se mede por TETO, e o carimbo guarda
        // custo 0 de propósito.
        if (rec + acao === 0) {
            if (p.regua.custo !== 0) { furos++; console.log(`!! ${doc.id}::${p.nome}: custo por uso é 0 (§0.8), mas o carimbo diz ${p.regua.custo}`); }
            continue;
        }

        const esperado = rec + acao + exp;
        if (!esperado) { semCusto++; continue; }        // custo ilegível: não julga
        if (Math.abs(esperado - p.regua.custo) <= 0.06) continue;
        if (ACEITAS[p.nome]) { aceitas++; continue; }
        furos++;
        const real = p.regua.unidades / esperado;
        console.log(`!! ${doc.id}::${p.nome}`);
        console.log(`     carimbado  custo ${p.regua.custo}  →  ${p.regua.razao}×   (${p.regua.em})`);
        console.log(`     esperado   custo ${esperado.toFixed(2)}  →  ${real.toFixed(2)}×`
            + `${real < 1 || real > 2 ? '  ❌ FORA DA FAIXA' : ''}`);
        console.log(`                recurso ${rec.toFixed(2)} + ${p.valores?.acao || 'Ação Padrão'} ${acao} + EXP ${exp.toFixed(2)}`);
    }
}
const nota = (semCusto ? ` (${semCusto} sem custo legivel)` : '') + (aceitas ? ` (${aceitas} divergencia(s) ja aceita(s), ver ACEITAS)` : '');
console.log(furos ? `
❌ ${furos} de ${checadas} carimbos com denominador errado.${nota}`
                  : `\n✅ os ${checadas} carimbos batem com recursos + ação.`);
process.exit(furos ? 1 : 0);
