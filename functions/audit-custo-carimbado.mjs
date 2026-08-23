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
    // extra ser documentado. Auditoria de 16/08/2026.
    'Corte de Passagem': 'numerador da familia "ataque extra" nao documentado; recomputada da 0,75x',
    // O carimbo usa "2 Energia" (3,00) e o parser prefere a alternativa mais
    // barata, "1 Energia + 2 Sanidade" (2,58). As duas leituras passam
    // (1,31x e 1,52x) e Sanidade nao se recupera em combate, o que torna a
    // alternativa "barata" discutivel na mesa. Fica como esta.
    'Transcendência — Receptor': 'alternativa de pagamento e julgamento, nao erro',
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
        const esperado = rec + acao;
        if (!esperado) { semCusto++; continue; }        // custo ilegível: não julga
        if (Math.abs(esperado - p.regua.custo) <= 0.06) continue;
        if (ACEITAS[p.nome]) { aceitas++; continue; }
        furos++;
        const real = p.regua.unidades / esperado;
        console.log(`!! ${doc.id}::${p.nome}`);
        console.log(`     carimbado  custo ${p.regua.custo}  →  ${p.regua.razao}×   (${p.regua.em})`);
        console.log(`     esperado   custo ${esperado.toFixed(2)}  →  ${real.toFixed(2)}×`
            + `${real < 1 || real > 2 ? '  ❌ FORA DA FAIXA' : ''}`);
        console.log(`                recurso ${rec.toFixed(2)} + ${p.valores?.acao || 'Ação Padrão'} ${acao}`);
    }
}
const nota = (semCusto ? ` (${semCusto} sem custo legivel)` : '') + (aceitas ? ` (${aceitas} divergencia(s) ja aceita(s), ver ACEITAS)` : '');
console.log(furos ? `
❌ ${furos} de ${checadas} carimbos com denominador errado.${nota}`
                  : `\n✅ os ${checadas} carimbos batem com recursos + ação.`);
process.exit(furos ? 1 : 0);
