// Rodar: node functions/taxa-gateway.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { TAXAS_PADRAO, calcularCobranca, EXCLUIR_POR_MEIO } = require('./taxa-gateway.js');

// O que a mesa recebe depois da taxa tem que ser >= o valor do item.
// É o teste que importa: se ele passar, ninguém fica desfalcado.
function liquido(totalCentavos, taxa) {
    return totalCentavos - Math.round(totalCentavos * taxa.pct) - taxa.fixo;
}

for (const [meio, taxa] of Object.entries(TAXAS_PADRAO)) {
    for (const subtotal of [100, 500, 999, 1000, 2500, 12345, 100000]) {
        const { totalCentavos, taxaCentavos } = calcularCobranca(subtotal, taxa);
        assert.ok(liquido(totalCentavos, taxa) >= subtotal,
            `${meio} R$${subtotal / 100}: sobrariam ${liquido(totalCentavos, taxa)} de ${subtotal}`);
        assert.equal(taxaCentavos, totalCentavos - subtotal);
        assert.ok(taxaCentavos >= 0, 'taxa nunca é negativa');
    }
}

// Caso concreto conferido na conta real: R$ 5,00 no Pix chegou como R$ 4,95.
const pix5 = calcularCobranca(500, TAXAS_PADRAO.pix);
assert.equal(pix5.totalCentavos, 505, 'R$ 5,00 no Pix vira R$ 5,05 cobrados');
assert.equal(pix5.taxaCentavos, 5);

// Boleto é taxa FIXA: some R$ 3,49 e o item barato quase dobra de preço.
const bol5 = calcularCobranca(500, TAXAS_PADRAO.boleto);
assert.equal(bol5.totalCentavos, 849);

// Por isso ele só aparece a partir de R$ 20 — e os outros não têm mínimo.
assert.equal(TAXAS_PADRAO.boleto.minimoCentavos, 2000);
assert.ok(!TAXAS_PADRAO.pix.minimoCentavos && !TAXAS_PADRAO.credito.minimoCentavos);

// Taxa zero não muda nada
assert.deepEqual(calcularCobranca(500, { pct: 0, fixo: 0 }), { totalCentavos: 500, taxaCentavos: 0 });

// Configuração corrompida não pode virar cobrança silenciosa e errada
assert.throws(() => calcularCobranca(500, { pct: 1 }), /inválido/);
assert.throws(() => calcularCobranca(500, { pct: -0.5 }), /inválido/);

// Cada meio precisa esconder os outros, senão a taxa cobrada não é a paga
assert.ok(EXCLUIR_POR_MEIO.pix.includes('credit_card'));
assert.ok(EXCLUIR_POR_MEIO.credito.includes('bank_transfer'));
assert.ok(EXCLUIR_POR_MEIO.boleto.includes('credit_card'));

console.log('✅ taxa-gateway: todos os casos passaram');
