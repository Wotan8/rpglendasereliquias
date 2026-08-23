// Parse do campo de custo do cadastro -> unidades da régua (§0.6).
// Puro, sem Firestore. Teste embutido: node functions/parse-custo.mjs
export const ACAO = { 'Ação Padrão': 1.0, 'Ação Livre': 0, 'Ação de Movimento': 0.333,
    'Ação Completa (turno inteiro)': 1.333, 'Sustentada (1 Padrão/turno)': 1.0,
    'Reação': 1.0, 'Fora de combate': 0 };
// "3 ENER" é o mesmo que "3 Energia" — o cadastro abrevia.
export const MOEDA = { energia: 1.0, ener: 1.0, graca: 1.0, harmonia: 1.0,
    carga: 0.871, cargas: 0.871, vitalidade: 0.290, vit: 0.290, sanidade: 0.290, san: 0.290 };
const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Uma alternativa de pagamento ("1 Energia + 2 Sanidade") em unidades. */
const somaAlternativa = (alt) => {
    let s = 0;
    for (const [, n, moeda] of alt.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:de\s+)?([A-Za-z\u00C0-\u00FF]+)/g)) {
        const taxa = MOEDA[norm(moeda)];
        if (taxa) s += parseFloat(n.replace(',', '.')) * taxa;
    }
    return s;
};

/**
 * Recurso pago, em unidades. `campos` são os campos de custo do schema.
 * Campos NUMÉRICOS somam entre si (o Invocador tem "Custo Sanidade" e "Custo em
 * Energia" separados). Campo de TEXTO vale sozinho, e "ou" nele escolhe a
 * alternativa mais barata (§4.2) — somar as alternativas dobra o preço.
 */
export function recursoDoPredef(campos, valores) {
    let numericos = 0, texto = null;
    for (const f of campos) {
        const txt = String(valores?.[f.key] ?? '').trim();
        if (!txt) continue;
        if (f.tipo === 'number' || /^\d+$/.test(txt)) {
            // \b obrigatorio: sem ele o /de/ come o "de" de SaniDAde, a moeda
            // some do mapa e cai no fallback 1,0 - 3,4x de erro, em silencio.
            const moeda = norm(String(f.label).replace(/\b(custo|em|de)\b|:/gi, ''));
            numericos += (Number(txt) || 0) * (MOEDA[moeda] ?? 1.0);
        } else if (texto == null) {
            const alts = txt.split(/\bou\b/i).map(somaAlternativa).filter(x => x > 0);
            if (alts.length) texto = Math.min(...alts);
        }
    }
    return numericos + (texto ?? 0);
}

if (/parse-custo\.mjs$/.test(process.argv[1] || '')) {
    const { default: assert } = await import('node:assert/strict');
    const T = (tipo, label, key) => ({ tipo, label, key });
    const texto = [T('text', 'Custo:', '4')];
    assert.equal(recursoDoPredef(texto, { 4: '1 Energia' }), 1.0);
    assert.equal(recursoDoPredef(texto, { 4: '1 Energia ou 1 Graça' }), 1.0, '"ou" escolhe, não soma');
    assert.equal(recursoDoPredef(texto, { 4: '2 Energia ou 1 Energia + 2 Sanidade' }), 1.58,
        'a alternativa mais barata é 1 Energia + 2 Sanidade');
    assert.equal(recursoDoPredef(texto, { 4: '3 ENER' }), 3.0, 'abreviatura do cadastro');
    assert.equal(recursoDoPredef(texto, { 4: '2 Cargas' }), 1.742);
    assert.equal(recursoDoPredef(texto, { 4: '2 Cargas + 1 Energia' }), 2.742, '"+" soma na mesma alternativa');
    assert.equal(recursoDoPredef(texto, { 4: '1 Energia (raio 3m)' }), 1.0, 'parêntese não é moeda');
    assert.equal(recursoDoPredef(texto, { 4: '' }), 0);
    // Invocador: dois campos numéricos, somam
    const nums = [T('number', 'Custo Sanidade:', '5'), T('number', 'Custo em Energia', '6')];
    assert.equal(recursoDoPredef(nums, { 5: '1', 6: '2' }), 2.29, '2 Energia + 1 Sanidade');
    assert.equal(recursoDoPredef(nums, { 5: '0', 6: '1' }), 1.0);
    console.log('✅ parse-custo: "ou" escolhe, "+" soma, campos numéricos somam, abreviatura e parêntese OK');
}
