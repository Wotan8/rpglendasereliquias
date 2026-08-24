// =============================================
// CAMPOS QUE VÊM DO PRÉ-CADASTRO — uma regra só
//
// A habilidade pré-cadastrada de um Módulo de Classe é COPIADA para a ficha
// quando alguém a adquire (_doAddModuleItem, em class-modules-renderer.js).
// A cópia congelava: corrigir a habilidade no Painel do Criador não chegava a
// quem já a tinha, e cada personagem ficava com uma versão diferente da mesma
// habilidade.
//
// Aqui a cópia volta a seguir o cadastro — mas só nos campos marcados
// "🔒 Somente leitura para o jogador" (schema.somenteLeitura). Esses o jogador
// não pode ter escrito, então reescrevê-los não perde nada dele. Contador,
// checkbox, tags e anotação são estado de mesa e ficam como estão, mesmo que o
// pré-cadastro tenha semeado um valor inicial neles.
//
// Consequência prática para quem cadastra: campo que o sistema manda precisa do
// 🔒 marcado. Sem ele, o campo é do jogador e nunca é atualizado.
//
// Ninguém precisa gravar nada: as quatro telas que mostram esses itens
// (ficha do personagem, ficha do aliado, janela do Tabuleiro e ficha de NPC do
// Painel do Mestre) chamam daqui na hora de desenhar. O que estiver salvo velho
// é corrigido na próxima vez que aquela tela salvar, sem migração.
//
// Script CLÁSSICO como shared/equip-slots.js: dois dos quatro consumidores não
// são módulos. Sem Firebase e sem DOM — testável fora do navegador.
// =============================================
(function (raiz) {
    'use strict';

    /** As chaves de dado que o cadastro manda: as travadas com 🔒 no schema. */
    function chavesTravadas(mod) {
        const out = [];
        for (const f of (mod && mod.schema) || []) {
            if (!f || !f.somenteLeitura || !f.key) continue;
            // Botão e separador não guardam dado; progresso guarda em duas chaves.
            if (f.tipo === 'botao' || f.tipo === 'separador') continue;
            if (f.tipo === 'progress') out.push(f.key + '_atual', f.key + '_total');
            else out.push(String(f.key));
        }
        return out;
    }

    /**
     * O pré-definido de onde este item saiu, ou null.
     * Só por `_predefId`: item antigo sem o campo, ou criado à mão pelo jogador,
     * é dele e não segue cadastro nenhum. (A cadeia de recurso por nome existe
     * em shared/skill-runtime.js, para o runtime do Tabuleiro.)
     */
    function predefDoItem(mod, item) {
        const id = item && item._predefId;
        if (!id || !mod || !Array.isArray(mod.itensPredefinidos)) return null;
        return mod.itensPredefinidos.find(p => p && p.id === id) || null;
    }

    /**
     * Traz de volta ao item os campos travados do pré-cadastro.
     * Muda o item no lugar e devolve as chaves que mudaram ([] = já em dia).
     */
    function sincronizarItem(mod, item) {
        const pd = predefDoItem(mod, item);
        if (!pd) return [];

        const mudou = [];
        if (pd.nome && item._predefNome !== pd.nome) {
            item._predefNome = pd.nome;
            mudou.push('_predefNome');
        }

        const valores = pd.valores || {};
        for (const key of chavesTravadas(mod)) {
            // Campo travado que o cadastro não preenche: não há o que copiar, e
            // apagar o que está na ficha não ajudaria ninguém.
            if (!(key in valores)) continue;
            const novo = valores[key];
            if (mesmoValor(item[key], novo)) continue;
            // Cópia do array: senão a ficha e o registro passam a apontar para o
            // MESMO array, e mexer num mexe no outro.
            item[key] = Array.isArray(novo) ? novo.slice() : novo;
            mudou.push(key);
        }
        return mudou;
    }

    /** Comparação frouxa de propósito: o cadastro grava "2" e a ficha, 2. */
    function mesmoValor(a, b) {
        if (Array.isArray(a) || Array.isArray(b)) {
            return JSON.stringify(a || []) === JSON.stringify(b || []);
        }
        return String(a === undefined || a === null ? '' : a)
            === String(b === undefined || b === null ? '' : b);
    }

    /** Sincroniza a lista de itens de um módulo. Devolve quantos itens mudaram. */
    function sincronizarItens(mod, itens) {
        if (!mod || !Array.isArray(itens)) return 0;
        let n = 0;
        for (const it of itens) {
            if (it && typeof it === 'object' && sincronizarItem(mod, it).length) n++;
        }
        return n;
    }

    raiz.PredefCampos = { chavesTravadas, predefDoItem, sincronizarItem, sincronizarItens };
})(typeof window !== 'undefined' ? window : globalThis);
