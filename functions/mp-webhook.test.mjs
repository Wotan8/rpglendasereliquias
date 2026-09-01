// Rodar: node functions/mp-webhook.test.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { conferirAssinatura, classificarPagamento, conferirValorPago, valorEsperado, reais } = require('./mp-webhook.js');

// ===== ASSINATURA =====
const SEGREDO = 'segredo-de-teste';
const assinar = (id, reqId, ts, secret = SEGREDO) => {
    let m = '';
    if (id) m += `id:${String(id).toLowerCase()};`;
    if (reqId) m += `request-id:${reqId};`;
    m += `ts:${ts};`;
    return crypto.createHmac('sha256', secret).update(m).digest('hex');
};

const boa = { xSignature: `ts=1700000000,v1=${assinar('123', 'req-1', '1700000000')}`, xRequestId: 'req-1', dataId: '123', secret: SEGREDO };
assert.equal(conferirAssinatura(boa).ok, true, 'assinatura correta passa');

// espaco em volta das partes: o MP manda "ts=..., v1=..."
assert.equal(conferirAssinatura({ ...boa, xSignature: ` ts=1700000000 , v1=${assinar('123', 'req-1', '1700000000')} ` }).ok, true);

// id alfanumerico entra em minusculas (regra do MP)
assert.equal(conferirAssinatura({
    xSignature: `ts=1,v1=${assinar('abc', 'r', '1')}`, xRequestId: 'r', dataId: 'ABC', secret: SEGREDO,
}).ok, true, 'ID maiusculo assina igual ao minusculo');

// ===== o que tem de ser RECUSADO =====
const recusa = (entrada, motivo) => {
    const r = conferirAssinatura(entrada);
    assert.equal(r.ok, false);
    assert.equal(r.motivo, motivo);
};
recusa({ ...boa, secret: '' }, 'sem-secret');
recusa({ ...boa, xSignature: '' }, 'sem-assinatura');
recusa({ ...boa, xSignature: 'ts=1700000000' }, 'assinatura-incompleta');
recusa({ ...boa, xSignature: 'v1=abc' }, 'assinatura-incompleta');
recusa({ ...boa, xSignature: `ts=1700000000,v1=${'0'.repeat(64)}` }, 'assinatura-invalida');
recusa({ ...boa, secret: 'outro-segredo' }, 'assinatura-invalida');
// trocar o id do pagamento invalida (é o ponto: o manifesto amarra o id)
recusa({ ...boa, dataId: '999' }, 'assinatura-invalida');
// trocar o request-id invalida
recusa({ ...boa, xRequestId: 'req-2' }, 'assinatura-invalida');
// v1 de tamanho diferente nao pode explodir no timingSafeEqual
recusa({ ...boa, xSignature: 'ts=1700000000,v1=abc' }, 'assinatura-invalida');

// ===== CLASSIFICACAO DO PAGAMENTO =====
assert.equal(classificarPagamento({ status: 'approved' }), 'aprovado');
assert.equal(classificarPagamento({ status: 'pending' }), 'pendente');
assert.equal(classificarPagamento({ status: 'in_process' }), 'pendente');
assert.equal(classificarPagamento({ status: 'rejected' }), 'pendente');
assert.equal(classificarPagamento({ status: 'refunded' }), 'estornado');
assert.equal(classificarPagamento({ status: 'charged_back' }), 'estornado', 'chargeback e estorno');
assert.equal(classificarPagamento({ status: 'cancelled' }), 'cancelado', 'cancelado nao e estorno');
assert.equal(classificarPagamento({ status: 'approved', transaction_amount_refunded: 5 }), 'estornado',
    'estorno PARCIAL nao muda o status no MP: aparece so no valor devolvido');
assert.equal(classificarPagamento({ status: 'approved', transaction_amount_refunded: 0 }), 'aprovado');
assert.equal(classificarPagamento({}), 'pendente');
assert.equal(classificarPagamento(null), 'pendente');

// ===== VALOR =====
// canonico: cobradoCentavos (item + taxa do gateway)
assert.equal(valorEsperado({ cobradoCentavos: 1010, totalCentavos: 1000 }), 1010);
// pendencia da era pre-taxa: so tem totalCentavos
assert.equal(valorEsperado({ totalCentavos: 500 }), 500);
assert.equal(valorEsperado({}), 0);

const pend = { cobradoCentavos: 1010, totalCentavos: 1000 };
assert.equal(conferirValorPago(pend, { transaction_amount: 10.10 }).ok, true, 'valor exato passa');
assert.equal(conferirValorPago(pend, { transaction_amount: 10.11 }).ok, true, 'pagar a mais passa');
assert.equal(conferirValorPago(pend, { transaction_amount: 10.099 }).ok, true, 'tolerancia de 1 centavo (ponto flutuante do MP)');

const menor = conferirValorPago(pend, { transaction_amount: 5.00 });
assert.equal(menor.ok, false);
assert.equal(menor.motivo, 'valor-menor');
assert.equal(menor.esperado, 1010);
assert.equal(menor.pago, 500);

// um centavo a menos que a tolerancia ja nao passa
assert.equal(conferirValorPago(pend, { transaction_amount: 10.08 }).ok, false);

assert.equal(conferirValorPago(pend, {}).motivo, 'sem-valor-pago');
assert.equal(conferirValorPago(pend, { transaction_amount: 0 }).motivo, 'sem-valor-pago');
assert.equal(conferirValorPago({}, { transaction_amount: 10 }).motivo, 'sem-valor-de-referencia',
    'sem saber quanto era, nao entrega');
// a pendencia legada (so totalCentavos) continua conferindo
assert.equal(conferirValorPago({ totalCentavos: 500 }, { transaction_amount: 5 }).ok, true);
assert.equal(conferirValorPago({ totalCentavos: 500 }, { transaction_amount: 1 }).ok, false);

// ===== formatacao da mensagem de aviso =====
assert.equal(reais(1010), 'R$ 10,10');
assert.equal(reais(0), 'R$ 0,00');
assert.equal(reais(1), 'R$ 0,01');
assert.doesNotThrow(() => reais(undefined), 'aviso com valor ausente nao pode derrubar o webhook');

console.log('mp-webhook.test.mjs: OK');
