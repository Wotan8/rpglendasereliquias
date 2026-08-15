// =============================================
// TABULEIRO — Geometria da MIRA (decisões puras, testável em Node)
// Módulo "folha": não importa nada.
//
// Regra da mesa: todo posicionamento com o token como eixo conta o alcance a
// partir do FIM DA BORDA do token, nunca do centro. Por isso as funções
// recebem o raio do token em px e somam/deslocam por ele.
//
// O shape devolvido usa o MESMO formato dos templates de área
// ({ forma, origem, destino, raio, ang }) — o hit-test é o
// templateAtingeCirculo de tab-templates.js, já testado.
// =============================================

/** Ângulo (rad) do centro do token até o cursor. 0 quando coincidem. */
export function direcaoAte(centro, ponto) {
    const dx = (ponto?.x || 0) - centro.x, dy = (ponto?.y || 0) - centro.y;
    if (!dx && !dy) return 0;
    return Math.atan2(dy, dx);
}

/** Ponto na BORDA do token na direção `dir` (rad). */
export function origemNaBorda(centro, rTokenPx, dir) {
    return { x: centro.x + Math.cos(dir) * rTokenPx, y: centro.y + Math.sin(dir) * rTokenPx };
}

/** Clampa `ponto` ao disco de alcance (borda do token + alcance). */
export function clampAoAlcance(centro, rTokenPx, alcancePx, ponto) {
    const max = rTokenPx + Math.max(0, alcancePx);
    const dx = ponto.x - centro.x, dy = ponto.y - centro.y;
    const d = Math.hypot(dx, dy);
    if (d <= max || d === 0) return { x: ponto.x, y: ponto.y };
    return { x: centro.x + dx / d * max, y: centro.y + dy / d * max };
}

/** O alvo está ao alcance? Medido BORDA a BORDA (agente e alvo). */
export function alvoAoAlcance(centroA, rA, centroB, rB, alcancePx) {
    return Math.hypot(centroB.x - centroA.x, centroB.y - centroA.y) - rA - rB <= alcancePx + 1e-6;
}

/**
 * ⛔ O CONJURADOR entra na própria área?
 *
 * O toque simples não serve: um cone nasce na BORDA do token de quem conjura,
 * então ele encosta sempre — e o conjurador virava alvo do próprio cone.
 * Aqui medimos QUANTO do disco do token cai dentro da forma, amostrando pontos
 * em anéis concêntricos, e só conta quem está com boa parte do corpo lá dentro.
 *
 * @param centro  { x, y } do token
 * @param raio    raio do token em px
 * @param dentro  (ponto) => bool — teste de ponto na forma (raio 0 do template)
 * @param aneis   quantos anéis amostrar (o centro conta como anel 0)
 * @returns fração de 0 a 1
 */
export function fracaoCoberta(centro, raio, dentro, aneis = 3) {
    if (!(raio > 0)) return dentro(centro) ? 1 : 0;
    let n = 0, total = 0;
    for (let a = 0; a <= aneis; a++) {
        const r = (raio * a) / aneis;
        // 1 ponto no centro, 8 por anel: barato e simétrico o bastante
        const passos = a === 0 ? 1 : 8;
        for (let k = 0; k < passos; k++) {
            const ang = (k / passos) * Math.PI * 2;
            total++;
            if (dentro({ x: centro.x + Math.cos(ang) * r, y: centro.y + Math.sin(ang) * r })) n++;
        }
    }
    return total ? n / total : 0;
}

/** Quanto do próprio token precisa estar na área para o conjurador virar alvo. */
export const COBERTURA_MINIMA_CONJURADOR = 0.5;

/**
 * Shape do preview/confirmação da mira, no formato dos templates.
 * @param mira  { tipo: 'cac'|'geometria', forma, alcancePx, raioPx, angGraus,
 *                larguraPx, comprimentoPx, origem: 'token'|'livre' }
 * @param token { x, y, r }  — centro e raio em px
 * @param cursor{ x, y }     — último clique/movimento (direção ou posição)
 * @returns { forma, origem, destino, raio, ang } ou null (mira de alvos não tem shape)
 */
/**
 * 📍 Um LOCAL escolhido é válido?
 *
 * A terceira forma de mirar (além de token-alvo e forma geométrica): quem
 * conjura aponta pontos VAZIOS do mapa dentro do alcance — é assim que a
 * manada aparece, que a armadilha é plantada, que a invocação chega.
 * Duas regras, e as duas medidas da BORDA do token de quem conjura:
 *   · o ponto tem de estar ao alcance;
 *   · não pode ter token em cima (o ponto é o chão, não uma criatura).
 *
 * @param centro   { x, y } do token de quem conjura
 * @param rTokenPx raio do token dele
 * @param alcancePx alcance em px
 * @param ponto    { x, y } clicado
 * @param tokens   iterável de { x, y, r } dos tokens do mapa
 * @param folgaPx  distância mínima entre dois locais escolhidos (0 = sem folga)
 * @param jaEscolhidos pontos já marcados, para não empilhar dois no mesmo lugar
 * @returns '' quando vale, ou o motivo da recusa
 */
export function porqueLocalInvalido(centro, rTokenPx, alcancePx, ponto, tokens, folgaPx = 0, jaEscolhidos = []) {
    const d = Math.hypot(ponto.x - centro.x, ponto.y - centro.y) - rTokenPx;
    if (d > alcancePx + 1e-6) return 'fora do alcance';
    for (const t of tokens || []) {
        if (Math.hypot(t.x - ponto.x, t.y - ponto.y) <= (t.r || 0)) return 'já tem alguém aí';
    }
    for (const q of jaEscolhidos) {
        if (Math.hypot(q.x - ponto.x, q.y - ponto.y) < folgaPx) return 'perto demais de outro local';
    }
    return '';
}

/** Índice do local marcado sob o ponto (para desmarcar no segundo clique). */
export function localSob(pontos, ponto, raioPx) {
    for (let i = 0; i < (pontos || []).length; i++) {
        if (Math.hypot(pontos[i].x - ponto.x, pontos[i].y - ponto.y) <= raioPx) return i;
    }
    return -1;
}

export function shapeDaMira(mira, token, cursor) {
    // 'alvos' escolhe criatura e 'locais' escolhe chão: nenhum dos dois desenha
    // forma seguindo o cursor — o que aparece são os pontos já marcados.
    if (!mira || mira.tipo === 'alvos' || mira.tipo === 'locais') return null;
    const c = { x: token.x, y: token.y };
    const dir = direcaoAte(c, cursor);

    if (mira.tipo === 'cac') {
        // golpe: setor a partir da borda, comprimento = alcance do golpe
        const o = origemNaBorda(c, token.r, dir);
        return {
            forma: 'cone', origem: o,
            destino: { x: o.x + Math.cos(dir) * mira.alcancePx, y: o.y + Math.sin(dir) * mira.alcancePx },
            ang: mira.angGraus || 90,
        };
    }

    const forma = mira.forma || 'circulo';
    if (forma === 'circulo') {
        if (mira.origem === 'livre') {
            const pos = clampAoAlcance(c, token.r, mira.alcancePx || 0, cursor || c);
            return { forma: 'circulo', origem: pos, destino: pos, raio: mira.raioPx || 0 };
        }
        // centrado no token: o raio conta a partir da borda
        return { forma: 'circulo', origem: c, destino: c, raio: token.r + (mira.raioPx || 0) };
    }
    if (forma === 'cone') {
        const o = origemNaBorda(c, token.r, dir);
        const L = mira.comprimentoPx || mira.alcancePx || 0;
        return { forma: 'cone', origem: o, destino: { x: o.x + Math.cos(dir) * L, y: o.y + Math.sin(dir) * L }, ang: mira.angGraus || 60 };
    }
    if (forma === 'linha') {
        const o = origemNaBorda(c, token.r, dir);
        const L = mira.comprimentoPx || mira.alcancePx || 0;
        return { forma: 'linha', origem: o, destino: { x: o.x + Math.cos(dir) * L, y: o.y + Math.sin(dir) * L }, raio: mira.larguraPx || 0 };
    }
    // retângulo: centrado no ponto clicado (clampado ao alcance), cantos opostos
    const pos = clampAoAlcance(c, token.r, mira.alcancePx || 0, cursor || c);
    const mw = (mira.larguraPx || 0) / 2, mh = (mira.comprimentoPx || mira.larguraPx || 0) / 2;
    return { forma: 'ret', origem: { x: pos.x - mw, y: pos.y - mh }, destino: { x: pos.x + mw, y: pos.y + mh } };
}
