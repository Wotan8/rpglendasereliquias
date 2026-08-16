/* ===== 🎼 A ÁREA DE UM INSTRUMENTO =====
 *
 * Instrumento não dá bordoada: ele SOA. Tocar é encher um espaço de som, e o
 * espaço tem a forma da família do instrumento — não o arco de um golpe.
 * Enquanto isso não existia, a Rabeca da barda mirava como uma espada.
 *
 *   🥁 Percussão — CÍRCULO em volta de quem toca. Raio  = 2 × (Qualidade + 1).
 *      O tambor bate para todo lado; não há para onde apontar.
 *   🎺 Sopro     — CONE estreito, 30°. Comprimento = 4 × (Qualidade + 1).
 *      A trompa projeta longe e concentrado.
 *   🎻 Corda     — CONE largo, 90°. Comprimento = 3 × (Qualidade + 1).
 *      A rabeca espalha na frente, sem alcançar o que a trompa alcança.
 *
 * ⚠️ O "+1" é o que faz a peça INICIAL soar. A Qualidade começa em 0 (0 —
 * Inicial, ver shared/equip-campos.js) e não existe instrumento acima de 1 no
 * jogo: multiplicar direto pela Qualidade dava 0 m em todo instrumento que
 * existe. O multiplicador é o tamanho do DEGRAU, não o total — Qualidade 0
 * paga um degrau, Qualidade 1 paga dois.
 *
 * A família vem das TAGS do item ("Instrumento" + "Sopro"/"Corda"/"Percussão"),
 * que é como o catálogo já marca os instrumentos.
 */

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** [família, forma, ângulo (cone) e multiplicador da Qualidade] */
export const FAMILIAS = {
    percussao: { nome: 'Percussão', icone: '🥁', forma: 'circulo', ang: 0,  mult: 2 },
    sopro:     { nome: 'Sopro',     icone: '🎺', forma: 'cone',    ang: 30, mult: 4 },
    corda:     { nome: 'Corda',     icone: '🎻', forma: 'cone',    ang: 90, mult: 3 },
};

/**
 * A família do instrumento, pelas tags. `null` quando o item não é um
 * instrumento (ou é um instrumento sem família marcada — que também não vira
 * área, para não chutar a forma errada).
 */
export function familiaDoInstrumento(tags) {
    const t = (tags || []).map(norm);
    if (!t.includes('instrumento')) return null;
    for (const chave of Object.keys(FAMILIAS)) {
        if (t.includes(chave)) return chave;
    }
    return null;
}

/**
 * A área que este instrumento enche.
 * @param tags      tags do item (instância + modelo)
 * @param qualidade Qualidade da peça (0–5)
 * @returns { familia, nome, icone, forma, ang, metros } ou null se não é instrumento
 */
export function areaDoInstrumento(tags, qualidade) {
    const chave = familiaDoInstrumento(tags);
    if (!chave) return null;
    const f = FAMILIAS[chave];
    const q = Math.max(0, Number(qualidade) || 0);
    return { familia: chave, nome: f.nome, icone: f.icone, forma: f.forma, ang: f.ang,
             metros: f.mult * (q + 1), qualidade: q };
}

/** Frase para a mesa ler na mira: de onde saiu aquele número. */
export function explicaArea(a) {
    if (!a) return '';
    const conta = `${FAMILIAS[a.familia].mult} × (Qualidade ${a.qualidade} + 1)`;
    return a.forma === 'circulo'
        ? `${a.icone} ${a.nome}: círculo de ${a.metros} m de raio (${conta})`
        : `${a.icone} ${a.nome}: cone de ${a.ang}° e ${a.metros} m (${conta})`;
}
