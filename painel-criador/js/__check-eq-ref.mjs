/* Autoteste da marcação de Ref nos termos de Equação de Valor.
 * Roda com: node painel-criador/js/__check-eq-ref.mjs
 *
 * O bug que isto trava: `getValueSourceHTML()` montava as opções sem marcar a
 * referência salva, então todo <select> de Ref abria em "— Ref —". Como o
 * coletor lê o DOM, o primeiro evento de edição regravava a equação com
 * `ref: ""` e a fórmula do item sumia.
 */
import assert from 'node:assert';

// O módulo mexe em `window` já na carga (é código de painel, não de node).
globalThis.window = globalThis.window || {};

const { _marcarRefSelecionada: marcar } = await import('./painel-mechanics.js');

const HTML = '\n<optgroup label="Atributos">'
    + '\n<option value="FOR">FOR</option><option value="DES">DES</option>'
    + '\n</optgroup>'
    + '\n<optgroup label="Propriedades de Item (só com item em escopo)">'
    + '\n<option value="Item: Qualidade">⭐ Qualidade do Item (0–5)</option>'
    + '\n<option value="Item: Afiação">🗡️ Afiação do Item</option>'
    + '\n</optgroup>';

// 1) A ref salva vem marcada — o caso que estava quebrado.
{
    const r = marcar(HTML, 'Item: Qualidade');
    assert.ok(r.includes('value="Item: Qualidade" selected'), 'ref salva precisa vir selected');
    assert.strictEqual((r.match(/ selected/g) || []).length, 1, 'só um selected');
}

// 2) Marca a certa quando um valor é prefixo de outro.
{
    const r = marcar(HTML, 'FOR');
    assert.ok(r.includes('value="FOR" selected'));
    assert.ok(!r.includes('value="DES" selected'));
}

// 3) Sem ref (termo novo) o HTML sai intacto — abre em "— Ref —".
{
    for (const vazio of [undefined, null, '', '   ']) {
        assert.strictEqual(marcar(HTML, vazio), HTML, `ref vazia (${JSON.stringify(vazio)}) não pode marcar nada`);
    }
}

// 4) Ref órfã (VD despublicado, perícia renomeada) vira opção própria em vez
//    de sumir. Apagar em silêncio foi exatamente o que causou o bug.
{
    const r = marcar(HTML, 'Perícia: Coisa Que Não Existe Mais');
    assert.ok(r.includes('Referência não encontrada'), 'órfã precisa de optgroup de aviso');
    assert.ok(r.includes('value="Perícia: Coisa Que Não Existe Mais" selected'), 'órfã precisa vir selected');
    assert.ok(r.includes('value="Item: Qualidade"'), 'o resto das opções continua lá');
}

// 5) Aspas na ref não podem quebrar o atributo HTML.
{
    const html = '\n<option value="Item: 5&quot; de aço">x</option>';
    const r = marcar(html, 'Item: 5" de aço');
    assert.ok(r.includes('selected'), 'ref com aspas precisa casar depois do escape');
}

console.log('✅ eq-ref: 5 grupos de asserções passaram.');
