// Rodar: node shared/restaurar-item-fiacao.test.mjs
//
// O botão "♻️ Restaurar do cadastro" nasce dentro de uma template string e
// chama o handler por NOME, num `onclick`. Nome errado não quebra nada na
// hora: o botão aparece, o Mestre clica, e o console diz "is not a function"
// enquanto ele acha que restaurou. Este teste lê as quatro telas e cobra que
// cada botão aponte para um handler que existe naquele arquivo.
//
// As quatro telas cobrem os três lugares que o Mestre usa: Painel do Mestre
// (NPC e caixas/mesa), Ficha (personagem e aliado) e Tabuleiro — que reabre
// justamente a ficha de NPC do Painel e o inventário de aliado da Ficha.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const TELAS = [
    { arq: '../painel-mestre/js/npc-inventario.js',       onde: 'Ficha de NPC (Painel do Mestre e Tabuleiro)' },
    { arq: '../painel-mestre/js/area-mesas-inventario.js', onde: 'Caixa do Mestre / inventário da mesa' },
    { arq: '../ficha-v1.7_1/js/inventory.js',              onde: 'Ficha de Personagem' },
    { arq: '../ficha-v1.7_1/js/aliado-inventario.js',      onde: 'Inventário do Aliado (Ficha e Tabuleiro)' },
];

for (const { arq, onde } of TELAS) {
    const src = readFileSync(new URL(arq, import.meta.url), 'utf8');

    const m = src.match(/botaoRestaurarHTML\('([^']+)'/);
    assert.ok(m, `${onde}: falta o botão de restaurar (botaoRestaurarHTML)`);

    // 'window.foo()' | 'AliadoInventario.restaurar()' | 'foo()' → 'foo' | 'restaurar'
    const nome = m[1].replace(/\(\)\s*$/, '').split('.').pop();
    const definido = new RegExp(`(window\\.${nome}\\s*=|function\\s+${nome}\\s*\\()`);
    assert.match(src, definido, `${onde}: o botão chama "${m[1]}" mas ${nome} não é definido neste arquivo`);

    // Sem o guarda, um item personalizado (sem modelo) ganharia um botão que
    // não tem o que restaurar.
    assert.match(src, /isEdit && [^\n]*(modelo|modeloDoItem)/,
        `${onde}: o botão só pode aparecer editando peça que veio do catálogo`);

    // O patch é gravado com merge — sem isso, posse e slot iriam junto.
    assert.match(src, /patchRestauracao\(/, `${onde}: o handler tem de usar patchRestauracao`);
    assert.match(src, /textoConfirmacao\(/, `${onde}: restaurar apaga alteração; tem de perguntar antes`);
}

console.log(`✅ fiação do restaurar OK — ${TELAS.length} telas, botão e handler batendo`);
