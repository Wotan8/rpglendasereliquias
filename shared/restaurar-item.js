// =============================================================
// RESTAURAR ITEM AO CADASTRO
//
// Um item do jogo é CÓPIA do modelo do catálogo, não espelho: depois de
// criado ele tem vida própria e afinar o cadastro no Criador não o alcança
// (ver instanciarDoModelo em equip-campos.js). Isso é de propósito — mas
// deixava o Mestre sem saída quando a peça foi mexida por engano, ou quando o
// cadastro melhorou e ele quer a versão nova naquela peça.
//
// Aqui mora o PATCH que puxa a peça de volta ao cadastro. Grava-se com
// merge:true de propósito: o que é do DONO — onde o item está, com quem, em
// que slot, quantas unidades — não é campo de cadastro e não pode ser tocado.
// Por isso o patch só carrega chave de CAMPOS_EQUIPAMENTO, e campo que o
// modelo não define vira `null` explícito: sem isso o merge deixaria viva
// justamente a alteração que o Mestre mandou apagar.
// =============================================================
import { CAMPOS_EQUIPAMENTO, instanciarDoModelo, normalizaFormaEquipar } from './equip-campos.js?v=13';

/** Campos que a instância guarda com OUTRO nome que o catálogo. */
const RENOME = { imagemUrl: 'imagem', mecanicaIds: 'mecanicaIdsProprias' };

/** O modelo deste item, se ele veio de um. `null` = peça personalizada. */
export function modeloDoItem(item, catalogo) {
    const ref = item?.modeloId || item?.origemTemplateId;
    return ref ? (catalogo || []).find(t => t.id === ref) || null : null;
}

/**
 * O que gravar em `items/<id>` (merge:true) para a peça voltar ao cadastro.
 * Devolve `null` se não há modelo — aí não há a que restaurar.
 */
export function patchRestauracao(tpl) {
    if (!tpl || !tpl.id) return null;
    const doModelo = instanciarDoModelo(tpl);   // mesma cópia integral do "criar do catálogo"

    const p = {};
    for (const f of CAMPOS_EQUIPAMENTO) {
        // "Quantidade (Padrão ao instanciar)" é do catálogo: a pilha que o dono
        // tem na mão não é cadastro, e restaurar não pode criar nem sumir item.
        if (f.key === 'quantidade') continue;
        const v = f.key === 'imagemUrl' ? doModelo.imagem : doModelo[f.key];
        p[RENOME[f.key] || f.key] = v === undefined ? null : v;
    }

    const tipo = p.tipo || 'Objeto';
    p.peso = Number(p.peso) || 1;
    p.tamanho = Number(p.tamanho) || 1;
    p.pressaoBase = p.pressaoBase != null ? Number(p.pressaoBase) : p.peso;
    p.ehContainer = !!p.ehContainer || tipo === 'Container';
    if (!p.ehContainer) { p.pesoMaximoContainer = null; p.multiplicadorPressao = null; p.capacidadeContainer = null; }
    p.categoriaArma = tipo === 'Arma' ? (p.categoriaArma || null) : null;
    p.equipavelEm = (p.equipavelEm || []).length ? p.equipavelEm : null;
    p.mecanicaIdsProprias = p.mecanicaIdsProprias || [];

    /* 🧱 Restaurar CONSERTA: a peça volta inteira. `avaria` não é campo de
       CAMPOS_EQUIPAMENTO, então não vinha junto pela iteração acima — e sem
       esta linha a Integridade seria uma barra que só desce, o jeito mais
       rápido de uma regra morrer. É o conserto do ferreiro, e é a única UI de
       conserto que existe: o botão já está em cinco telas. */
    p.avaria = 0;

    // "Segurar" desliga TODO efeito da peça. A checagem roda sobre o MODELO
    // porque lá as mecânicas ainda se chamam `mecanicaIds`.
    const espelho = { ...doModelo, formaEquipar: p.formaEquipar };
    if (normalizaFormaEquipar(espelho)) p.formaEquipar = espelho.formaEquipar;

    // Telas antigas (repertório do Mestre) leem `name`/`description`.
    p.name = p.nome;
    p.description = p.descricao || '';

    p.modeloId = tpl.id;
    p.lastModified = new Date().toISOString();
    return p;
}

/** Texto do confirm — igual nas cinco telas, para o aviso ser sempre o mesmo. */
export function textoConfirmacao(item, tpl) {
    return `Restaurar "${item?.nome || item?.name || 'este item'}" ao cadastro de "${tpl?.nome || 'modelo'}"?\n\n`
        + 'Tudo que foi alterado NESTA peça volta ao que o catálogo diz — nome, dano, '
        + 'vínculos, tags, imagem.\n'
        + 'A peça também volta INTEIRA: a Integridade é restaurada ao máximo.\n'
        + 'Onde ela está, com quem, em que slot e quantas unidades NÃO mudam.';
}

/** Botãozinho do rodapé. Some quando a peça é personalizada (sem modelo). */
export function botaoRestaurarHTML(onclick, classe = 'inv-btn-cancel') {
    return `<button class="${classe}" style="margin-right:auto" onclick="${onclick}"
        title="Traz de volta o cadastro do catálogo por cima do que foi alterado nesta peça">♻️ Restaurar do cadastro</button>`;
}
