/**
 * Campos configuráveis de cadastro.
 *
 * O documento `config/campos` guarda, por coleção e por bloco, a lista de campos
 * que um cadastro tem: chave, rótulo, tipo, caminho no documento, seção, onde
 * aparece e qual a função. O Criador edita essa lista na aba Campos; as telas
 * renderizam e coletam pelo schema, com este módulo, em vez de campos fixos.
 *
 *   campo = {
 *     chave: 'trejeitos', rotulo: 'Trejeitos', tipo: 'textarea',
 *     caminho: 'rolePlay.trejeitos',        // onde grava no doc (pontilhado; índice numérico entra em array)
 *     secao: 'Personalidade', largura: 'full' | 'metade' | 'terco',
 *     onde: ['painel', 'card', 'ficha', 'tabuleiro', 'wiki'],
 *     funcao: 'narrativo' | 'mecanico' | 'equacao',
 *     opcoes: ['a', 'b'] (select), placeholder, ocultarSeVazio, ordem
 *   }
 *
 * ES module (import) e global (`globalThis.LR_CAMPOS`) para os scripts clássicos.
 * Auto-teste: `node shared/campos-cadastro.js`.
 */

export const TIPOS = ['text', 'textarea', 'number', 'select', 'checkbox', 'tags', 'link', 'imagem', 'separador', 'equacao', 'mecanica'];
export const ONDE = ['painel', 'card', 'ficha', 'tabuleiro', 'wiki'];
export const FUNCOES = ['narrativo', 'mecanico', 'equacao'];
export const LARGURAS = { full: '1 / -1', metade: 'span 6', terco: 'span 4' };

/** O que o cadastro tem hoje, campo a campo. A semente de `config/campos`; nada some na migração. */
export const CAMPOS_PADRAO = {
    versao: '1.00',
    npcs: {
        lore: [
            { chave: 'personalidade1', rotulo: 'Personalidade 1', tipo: 'text', caminho: 'rolePlay.personalidade.0', secao: 'Personalidade', largura: 'terco', onde: ['painel', 'card', 'ficha', 'wiki'], funcao: 'narrativo', ordem: 1 },
            { chave: 'personalidade2', rotulo: 'Personalidade 2', tipo: 'text', caminho: 'rolePlay.personalidade.1', secao: 'Personalidade', largura: 'terco', onde: ['painel', 'ficha', 'wiki'], funcao: 'narrativo', ordem: 2 },
            { chave: 'personalidade3', rotulo: 'Personalidade 3', tipo: 'text', caminho: 'rolePlay.personalidade.2', secao: 'Personalidade', largura: 'terco', onde: ['painel', 'ficha', 'wiki'], funcao: 'narrativo', ordem: 3 },
            { chave: 'trejeitos', rotulo: 'Trejeitos', tipo: 'textarea', caminho: 'rolePlay.trejeitos', secao: 'Personalidade', largura: 'full', onde: ['painel', 'card', 'ficha', 'wiki'], funcao: 'narrativo', ordem: 4 },
            { chave: 'frases', rotulo: '💬 Frases', tipo: 'textarea', caminho: 'rolePlay.frases', secao: 'Personalidade', largura: 'full', onde: ['painel', 'ficha', 'wiki'], funcao: 'narrativo', ordem: 5 },
            { chave: 'motivacao', rotulo: 'Motivação', tipo: 'textarea', caminho: 'rolePlay.motivacao', secao: 'Motivos', largura: 'metade', onde: ['painel', 'ficha', 'wiki'], funcao: 'narrativo', ordem: 6 },
            { chave: 'segredos', rotulo: 'Segredos', tipo: 'textarea', caminho: 'rolePlay.segredos', secao: 'Motivos', largura: 'metade', onde: ['painel', 'wiki'], funcao: 'narrativo', ordem: 7 },
            { chave: 'aliado', rotulo: 'Aliado', tipo: 'text', caminho: 'rolePlay.relacoes.aliado', secao: 'Relações', largura: 'terco', onde: ['painel', 'ficha', 'wiki'], funcao: 'narrativo', ordem: 8 },
            { chave: 'rival', rotulo: 'Rival', tipo: 'text', caminho: 'rolePlay.relacoes.rival', secao: 'Relações', largura: 'terco', onde: ['painel', 'ficha', 'wiki'], funcao: 'narrativo', ordem: 9 },
            { chave: 'devedor', rotulo: 'Devedor', tipo: 'text', caminho: 'rolePlay.relacoes.devedor', secao: 'Relações', largura: 'terco', onde: ['painel', 'ficha', 'wiki'], funcao: 'narrativo', ordem: 10 },
            { chave: 'historia', rotulo: '📖 História', tipo: 'textarea', caminho: 'rolePlay.historia', secao: 'História', largura: 'full', onde: ['painel', 'ficha', 'wiki'], funcao: 'narrativo', ordem: 11 },
        ],
    },
};

// ---------- caminhos ----------
const partes = c => String(c || '').split('.').filter(Boolean);
export function lerCaminho(obj, caminho) {
    let o = obj;
    for (const p of partes(caminho)) { if (o == null) return undefined; o = o[p]; }
    return o;
}
export function gravarCaminho(obj, caminho, valor) {
    const ps = partes(caminho);
    if (!ps.length) return obj;
    let o = obj;
    for (let i = 0; i < ps.length - 1; i++) {
        const p = ps[i], prox = ps[i + 1];
        if (o[p] == null || typeof o[p] !== 'object') o[p] = /^\d+$/.test(prox) ? [] : {};
        o = o[p];
    }
    o[ps[ps.length - 1]] = valor;
    return obj;
}

// ---------- schema ----------
const ehObjeto = v => v && typeof v === 'object' && !Array.isArray(v);
export function mesclarCampos(doc, padrao = CAMPOS_PADRAO) {
    const out = { ...padrao };
    if (!ehObjeto(doc)) return out;
    for (const [k, v] of Object.entries(doc)) out[k] = (ehObjeto(v) && ehObjeto(out[k])) ? { ...out[k], ...v } : v;
    return out;
}
/** Lista de campos de `colecao.bloco`, ordenada. `campos` é o doc já mesclado (ou nada: padrão). */
export function camposDe(campos, colecao, bloco) {
    const src = campos || CAMPOS_PADRAO;
    const lista = (src[colecao] && src[colecao][bloco]) || (CAMPOS_PADRAO[colecao] && CAMPOS_PADRAO[colecao][bloco]) || [];
    return lista.slice().sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999));
}
export const aparece = (campo, onde) => !campo.onde || !campo.onde.length || campo.onde.includes(onde);

// ---------- valores ----------
export function valoresDoDoc(schema, docu) {
    const v = {};
    for (const f of schema) v[f.chave] = lerCaminho(docu, f.caminho || f.chave);
    return v;
}
export function aplicarNoDoc(schema, valores, docu = {}) {
    for (const f of schema) if (f.tipo !== 'separador' && f.funcao !== 'equacao') gravarCaminho(docu, f.caminho || f.chave, valores[f.chave]);
    return docu;
}

// ---------- html ----------
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const idDe = (f, prefixo) => `${prefixo || 'campo'}__${f.chave}`;

/** HTML de um campo para edição. `opts.resolver(f)` devolve o valor de um campo `equacao` (só leitura). */
export function campoHtml(f, valor, opts = {}) {
    const id = idDe(f, opts.prefixo), grid = `style="grid-column:${LARGURAS[f.largura] || LARGURAS.full}"`;
    const rot = `<label for="${id}">${esc(f.rotulo || f.chave)}</label>`;
    const attrs = `id="${id}" data-campo="${esc(f.chave)}" data-tipo="${esc(f.tipo)}"${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''}`;
    let inp;
    switch (f.tipo) {
        case 'separador': return `<div class="cc-separador" ${grid}><span>${esc(f.rotulo || '')}</span></div>`;
        case 'textarea': inp = `<textarea ${attrs} rows="${f.linhas || 3}">${esc(valor)}</textarea>`; break;
        case 'number': inp = `<input type="number" step="any" ${attrs} value="${esc(valor ?? '')}">`; break;
        case 'checkbox': inp = `<input type="checkbox" ${attrs} ${valor ? 'checked' : ''}>`; break;
        case 'select': inp = `<select ${attrs}><option value="">—</option>${(f.opcoes || []).map(o => `<option value="${esc(o)}" ${String(valor) === String(o) ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`; break;
        case 'tags': inp = `<input type="text" ${attrs} value="${esc(Array.isArray(valor) ? valor.join(', ') : (valor ?? ''))}" title="separe por vírgula">`; break;
        case 'equacao': { const v = opts.resolver ? opts.resolver(f) : valor; inp = `<input type="text" ${attrs} value="${esc(v ?? '')}" readonly title="calculado">`; break; }
        case 'mecanica': inp = `<input type="text" ${attrs} value="${esc(valor ?? '')}" readonly title="mecânica vinculada (edite no Criador)">`; break;
        default: inp = `<input type="${f.tipo === 'link' || f.tipo === 'imagem' ? 'url' : 'text'}" ${attrs} value="${esc(valor ?? '')}">`;
    }
    return `<div class="cc-campo cc-${esc(f.tipo)}" ${grid}>${rot}${inp}</div>`;
}

/** Formulário inteiro: campos agrupados por seção, em grade de 12 colunas. */
export function formularioHtml(schema, valores = {}, opts = {}) {
    const onde = opts.onde || 'painel';
    const visiveis = schema.filter(f => aparece(f, onde));
    const secoes = [];
    for (const f of visiveis) { const s = f.secao || ''; let sec = secoes.find(x => x.nome === s); if (!sec) { sec = { nome: s, campos: [] }; secoes.push(sec); } sec.campos.push(f); }
    return secoes.map(s => `${s.nome ? `<div class="cc-secao">${esc(s.nome)}</div>` : ''}<div class="cc-grid">${s.campos.map(f => campoHtml(f, valores[f.chave], opts)).join('')}</div>`).join('');
}

/** Lê os valores de volta do container (por `data-campo`). */
export function coletarCampos(schema, container, opts = {}) {
    const v = {};
    for (const f of schema) {
        if (f.tipo === 'separador' || f.tipo === 'equacao' || f.tipo === 'mecanica') continue;
        const el = container.querySelector ? container.querySelector(`#${idDe(f, opts.prefixo)}`) : null;
        if (!el) continue;
        if (f.tipo === 'checkbox') v[f.chave] = !!el.checked;
        else if (f.tipo === 'number') v[f.chave] = el.value === '' ? null : Number(el.value);
        else if (f.tipo === 'tags') v[f.chave] = String(el.value || '').split(',').map(s => s.trim()).filter(Boolean);
        else v[f.chave] = el.value;
    }
    return v;
}

/** Só leitura: linhas "rótulo: valor", pulando vazios quando o campo pedir. Útil para card, wiki e ficha. */
export function leituraHtml(schema, docu, onde = 'wiki') {
    const v = valoresDoDoc(schema, docu);
    return schema.filter(f => aparece(f, onde) && f.tipo !== 'separador').map(f => {
        const val = v[f.chave];
        const vazio = val == null || val === '' || (Array.isArray(val) && !val.length);
        if (vazio && (f.ocultarSeVazio !== false)) return '';
        const txt = Array.isArray(val) ? val.join(', ') : String(val ?? '');
        return `<div class="cc-leitura"><b>${esc(f.rotulo || f.chave)}:</b> ${esc(txt).replace(/\n/g, '<br>')}</div>`;
    }).join('');
}

if (typeof globalThis !== 'undefined') {
    globalThis.LR_CAMPOS = { TIPOS, ONDE, FUNCOES, LARGURAS, CAMPOS_PADRAO, lerCaminho, gravarCaminho, mesclarCampos, camposDe, aparece, valoresDoDoc, aplicarNoDoc, campoHtml, formularioHtml, coletarCampos, leituraHtml };
}

// ---- auto-teste: node shared/campos-cadastro.js ----
const ehMain = typeof process !== 'undefined' && process.argv && process.argv[1] && /campos-cadastro\.js$/.test(process.argv[1].replace(/\\/g, '/'));
if (ehMain) {
    const assert = (c, m) => { if (!c) { console.error('FALHOU:', m); process.exit(1); } };
    const sch = camposDe(null, 'npcs', 'lore');
    assert(sch.length === 11 && sch[0].chave === 'personalidade1', 'schema padrão');
    const npc = { rolePlay: { personalidade: ['Rude', 'Leal'], relacoes: { rival: 'Bram' }, historia: 'x' } };
    const v = valoresDoDoc(sch, npc);
    assert(v.personalidade1 === 'Rude' && v.personalidade2 === 'Leal' && v.rival === 'Bram' && v.personalidade3 === undefined, 'valoresDoDoc por caminho');
    const d = aplicarNoDoc(sch, { personalidade1: 'A', personalidade3: 'C', aliado: 'Zé' }, {});
    assert(Array.isArray(d.rolePlay.personalidade) && d.rolePlay.personalidade[0] === 'A' && d.rolePlay.personalidade[2] === 'C' && d.rolePlay.relacoes.aliado === 'Zé', 'aplicarNoDoc cria array e objeto');
    assert(mesclarCampos({ npcs: { lore: [{ chave: 'x', tipo: 'text' }] } }).npcs.lore.length === 1, 'doc por cima do padrão');
    assert(mesclarCampos({ equipment: { extra: [] } }).npcs.lore.length === 11, 'padrão preservado');
    const html = formularioHtml(sch, v, { onde: 'painel' });
    assert(html.includes('id="campo__trejeitos"') && html.includes('cc-secao'), 'formulário');
    assert(leituraHtml(sch, npc, 'card').includes('Rude') && !leituraHtml(sch, npc, 'card').includes('Leal'), 'leitura filtra por onde e vazio');
    console.log('campos-cadastro: ok');
}
