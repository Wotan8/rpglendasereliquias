/* ===== 🎼 A ÁREA DE UM INSTRUMENTO =====
 *
 * Instrumento não dá bordoada: ele SOA. Tocar é encher um espaço de som, e o
 * espaço tem a forma da família do instrumento — não o arco de um golpe.
 * Enquanto isso não existia, a Rabeca da barda mirava como uma espada.
 *
 *   🥁 Percussão — CÍRCULO em volta de quem toca. Raio = 2 × Qualidade.
 *      O tambor bate para todo lado; não há para onde apontar.
 *   🎺 Sopro     — CONE estreito, 30°. Comprimento = 4 × Qualidade.
 *      A trompa projeta longe e concentrado.
 *   🎻 Corda     — CONE largo, 90°. Comprimento = 3 × Qualidade.
 *      A rabeca espalha na frente, sem alcançar o que a trompa alcança.
 *
 * A QUALIDADE é o poder da peça (0–5, ver shared/equip-campos.js). Um
 * instrumento improvisado (Qualidade 0) não enche espaço nenhum — e é isso que
 * `area()` devolve, para a mesa ver que falta cadastrar a peça em vez de a
 * habilidade sair com um alcance inventado.
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
    return { familia: chave, nome: f.nome, icone: f.icone, forma: f.forma, ang: f.ang, metros: f.mult * q, qualidade: q };
}

/** Frase para a mesa ler na mira: de onde saiu aquele número. */
export function explicaArea(a) {
    if (!a) return '';
    const conta = `${FAMILIAS[a.familia].mult} × Qualidade ${a.qualidade}`;
    return a.forma === 'circulo'
        ? `${a.icone} ${a.nome}: círculo de ${a.metros} m de raio (${conta})`
        : `${a.icone} ${a.nome}: cone de ${a.ang}° e ${a.metros} m (${conta})`;
}
