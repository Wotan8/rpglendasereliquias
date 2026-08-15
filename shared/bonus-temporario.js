/* ===== BÔNUS TEMPORÁRIO — o que vale só enquanto a cena durar =====
 *
 * A Dádiva do Receptor (shared/dadiva.js) entrega sobras que o personagem usa
 * enquanto está incorporado e perde quando sai. Isso NÃO pode ir para a ficha
 * no banco: a ficha é o que o personagem é, e um urso emprestado por uma cena
 * não é. O bônus mora no PARTICIPANTE da cena (`p.bonusTemp`), ao lado das
 * condições — some junto com a cena, e nunca suja o doc do personagem.
 *
 * Este arquivo faz uma coisa só: dado o doc da ficha e a lista de bônus,
 * devolve uma CÓPIA da ficha com os valores já somados. Quem lê a ficha por
 * fonteDoParticipante() enxerga os números com o empréstimo dentro, sem que
 * nenhum dos leitores (mira, conflito, HUD, golpes) precise saber que existe
 * incorporação acontecendo.
 *
 * Sem bônus, devolve a MESMA referência — isto é chamado a cada quadro do
 * canvas, e clonar a ficha à toa custaria caro.
 */

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/**
 * Um bônus temporário.
 * @typedef {{ tipo: 'vd'|'atributo'|'pericia'|'vital', chave: string, nome?: string,
 *             valor: number, fonte?: string, subeAtual?: boolean }} BonusTemp
 */

/**
 * Ficha com os bônus temporários somados.
 *
 * @param {object} ficha  doc de char (derivedTotals/dots) ou de npc (valoresDer)
 * @param {BonusTemp[]} bonus
 * @returns {object} a mesma ficha quando não há bônus; senão uma cópia somada
 */
export function fichaComBonus(ficha, bonus) {
    if (!ficha || !Array.isArray(bonus) || !bonus.length) return ficha;

    const out = { ...ficha };
    for (const b of bonus) {
        const v = Number(b?.valor) || 0;
        if (!v) continue;
        if (b.tipo === 'atributo') somaAtributo(out, b.chave, v);
        else if (b.tipo === 'pericia') somaPericia(out, b.chave, v);
        else if (b.tipo === 'vital') somaVital(out, b.chave, v, b.subeAtual);
        else somaVd(out, b.chave, b.nome, v);
    }
    return out;
}

/** VD: char espelha em `derivedTotals` (chave normalizada); NPC em `valoresDer`. */
function somaVd(f, chave, nome, v) {
    if (f.derivedTotals) {
        f.derivedTotals = { ...f.derivedTotals };
        // A ficha grava por nome normalizado; o registro conhece a key. Soma na
        // que já existir, e na do nome quando nenhuma existir ainda.
        const alvo = [chave, norm(nome), norm(chave)].find(k => k && f.derivedTotals[k] != null)
            || norm(nome) || chave;
        f.derivedTotals[alvo] = (Number(f.derivedTotals[alvo]) || 0) + v;
    }
    if (f.valoresDer) {
        const vd = { ...f.valoresDer, overrides: { ...(f.valoresDer.overrides || {}) } };
        const atual = Number(vd.overrides[chave]);
        vd.overrides[chave] = (isNaN(atual) ? 0 : atual) + v;
        f.valoresDer = vd;
    }
}

function somaAtributo(f, sigla, v) {
    const s = String(sigla || '').toUpperCase();
    if (f.dots) {
        f.dots = { ...f.dots };
        const k = 'attr_' + s.toLowerCase();
        f.dots[k] = (Number(f.dots[k]) || 0) + v;
    }
    if (f.atributos) {
        f.atributos = { ...f.atributos };
        f.atributos[s] = (Number(f.atributos[s]) || 0) + v;
    }
}

/** Perícia: char guarda em `dots` (sk_<grupo>_<nome>); NPC, em texto por linha. */
function somaPericia(f, nome, v) {
    if (!f.dots) return;
    const alvo = norm(nome);
    f.dots = { ...f.dots };
    for (const k of Object.keys(f.dots)) {
        if (!k.startsWith('sk_')) continue;
        if (norm(k.replace(/^sk_[a-z]+_/, '')) !== alvo) continue;
        f.dots[k] = (Number(f.dots[k]) || 0) + v;
        return;
    }
    // Perícia que o personagem não tem: entra como exclusiva emprestada
    f.dots['sk_exclusivo_' + alvo] = v;
}

/** Vital: sobe o Máximo e, quando pedido, o Atual junto (regra da Dádiva). */
function somaVital(f, stat, v, subeAtual) {
    const s = String(stat || '').toUpperCase();
    if (f.valoresDer) {
        const vd = { ...f.valoresDer, atual: { ...(f.valoresDer.atual || {}) } };
        if (subeAtual) vd.atual[s] = (Number(vd.atual[s]) || 0) + v;
        f.valoresDer = vd;
    }
    if (f.derivedTotals) {
        f.derivedTotals = { ...f.derivedTotals };
        const k = s === 'VIT' ? 'vitalidade' : s === 'ENER' ? 'energia' : 'sanidade';
        f.derivedTotals[k] = (Number(f.derivedTotals[k]) || 0) + v;
    }
}

/**
 * Os ganhos de uma Dádiva viram bônus temporários gravaveis no participante.
 * @param {object[]} ganhos  saída de calcularDadiva().ganhos
 * @param {string} fonte     de quem veio ("Fusão Selvagem: Urso Pardo")
 */
export function bonusDosGanhos(ganhos, fonte) {
    return (ganhos || []).map(g => ({
        tipo: g.atributo ? 'atributo' : g.pericia ? 'pericia'
            : (g.chave === 'VIT' || g.chave === 'ENER') ? 'vital' : 'vd',
        chave: g.chave, nome: g.nome, valor: g.sobra,
        subeAtual: !!g.subeAtual, fonte: fonte || '',
    }));
}

/** Texto de uma linha de bônus, para o HUD e o chat. */
export function rotuloDoBonus(b) {
    return `${b.nome || b.chave} +${b.valor}`;
}
