// =============================================
// CONHECIMENTO — decisão pura de "este capítulo está liberado?"
// Módulo "folha": não importa nada, não toca no DOM nem no Firebase.
// Toda leitura da ficha entra por `leitor`, o que deixa a regra testável
// fora do navegador (conhecimento-calc.test.mjs).
//
// Formato do requisito (gravado em system/data/knowledge pelo Painel do Criador):
//   { tipo:'ficha',       ref:'FOR'|'Perícia: Briga'|'<Valor Derivado>', op:'>=', valor:3 }
//   { tipo:'mecanica',    mecanicaId:'...' }      → mecânica booleana verdadeira
//   { tipo:'equipamento', equipamentoId:'...' }   → item EQUIPADO (não basta ter)
// =============================================

export const OPS = {
    '>=': (a, b) => a >= b,
    '>': (a, b) => a > b,
    '<=': (a, b) => a <= b,
    '<': (a, b) => a < b,
    '==': (a, b) => a === b,
    '!=': (a, b) => a !== b,
};

/**
 * @param req    um requisito no formato acima
 * @param leitor { ficha(ref)->number, mecanica(id)->{ok,label}, equipamento(id)->{ok,nome} }
 * @returns { ok, label, atual? , alvo? }
 */
export function avaliarRequisito(req, leitor) {
    if (!req || !req.tipo) return { ok: true, label: '—' };

    if (req.tipo === 'mecanica') {
        const r = leitor.mecanica(req.mecanicaId) || {};
        return { ok: !!r.ok, label: r.label || 'Mecânica exigida' };
    }

    if (req.tipo === 'equipamento') {
        const r = leitor.equipamento(req.equipamentoId) || {};
        return { ok: !!r.ok, label: `Estar com ${r.nome || 'o equipamento'} equipado` };
    }

    const op = OPS[req.op] ? req.op : '>=';
    const atual = Number(leitor.ficha(req.ref)) || 0;
    const alvo = Number(req.valor) || 0;
    return { ok: OPS[op](atual, alvo), label: `${req.ref} ${op} ${alvo}`, atual, alvo };
}

/**
 * Avalia a regra inteira. Sem requisitos = liberado (a regra existe só para
 * tornar o capítulo visível).
 */
export function avaliarRegra(regra, leitor) {
    const reqs = Array.isArray(regra && regra.requisitos) ? regra.requisitos : [];
    const resultados = reqs.map(r => Object.assign({ req: r }, avaliarRequisito(r, leitor)));
    const modo = (regra && regra.modo) === 'qualquer' ? 'qualquer' : 'todos';
    const liberado = resultados.length === 0
        ? true
        : (modo === 'qualquer' ? resultados.some(r => r.ok) : resultados.every(r => r.ok));
    return { liberado, modo, resultados };
}

/**
 * Estado de um capítulo para ESTE personagem.
 *   'liberado'   → pode ler
 *   'bloqueado'  → aparece com cadeado e a lista do que falta
 *   'oculto'     → nem aparece (rascunho privado sem regra de conhecimento)
 * Sem regra cadastrada, quem manda é a marcação 🌐 Público do capítulo.
 */
export function statusDoCapitulo(capitulo, regra, leitor) {
    if (regra) {
        const a = avaliarRegra(regra, leitor);
        return Object.assign({ estado: a.liberado ? 'liberado' : 'bloqueado' }, a);
    }
    const publico = !!(capitulo && capitulo.public);
    return { estado: publico ? 'liberado' : 'oculto', liberado: publico, modo: 'todos', resultados: [] };
}
