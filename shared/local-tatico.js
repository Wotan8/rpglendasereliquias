// =============================================
// LOCAL TÁTICO — conversão pura entre o mapa configurado no
// Worldbuilding (Locais → mapaTatico) e os objetos do Tabuleiro.
// Módulo "folha": não importa nada — testável em Node
// (local-tatico.test.mjs) e usado pelas duas telas.
//
// Formato gravado no doc de worldbuilding-geography:
//   mapaTatico: {
//     url, imgW, imgH,            // imagem e dimensões NATURAIS (px)
//     larguraReal, unidade,       // escala real do mapa (régua)
//     ambiente: 'noite'|'dia',    // iluminação ambiente do canvas
//     luzAtiva: bool,             // liga a luz dinâmica ao importar
//     objetos: [                  // coordenadas em px da imagem natural
//       { tipo:'parede', pontos:[{x,y},...] },
//       { tipo:'porta',  pontos:[a,b] },
//       { tipo:'janela', pontos:[a,b] },
//       { tipo:'luz', x, y, alcance, cor, animacao? },  // alcance em unidades
//       { tipo:'npc', npcId, nome, url, camada:'tokens'|'dm', x, y },
//     ],
//   }
// =============================================

/**
 * Pontos de uma parede desenhada por arrasto entre dois cantos.
 * Retângulo e elipse viram POLILINHA fechada: o raycasting do tabuleiro
 * só entende segmentos de reta, então a forma é aproximada aqui e o resto
 * do sistema nem sabe que existiu uma "elipse".
 * @param forma 'ret' | 'elipse' | qualquer outra (= segmento reto a→b)
 */
export function pontosDaForma(forma, a, b, lados = 32) {
    if (!a || !b) return [];
    if (forma === 'ret') {
        return [{ x: a.x, y: a.y }, { x: b.x, y: a.y }, { x: b.x, y: b.y }, { x: a.x, y: b.y }, { x: a.x, y: a.y }];
    }
    if (forma === 'elipse') {
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        const rx = Math.abs(b.x - a.x) / 2, ry = Math.abs(b.y - a.y) / 2;
        const pts = [];
        for (let i = 0; i <= lados; i++) {
            const t = (i / lados) * Math.PI * 2;
            pts.push({ x: Math.round(cx + rx * Math.cos(t)), y: Math.round(cy + ry * Math.sin(t)) });
        }
        return pts;
    }
    return [{ x: a.x, y: a.y }, { x: b.x, y: b.y }];
}

/** Comprimento total de uma polilinha — usado para descartar clique seco. */
export function comprimentoDaLinha(pts) {
    let d = 0;
    for (let i = 1; i < (pts || []).length; i++) {
        d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    return d;
}

/** O Local tem um mapa tático completo o bastante para ir ao tabuleiro? */
export function localPronto(mt) {
    return !!(mt && mt.url && mt.imgW > 0 && mt.imgH > 0 && mt.larguraReal > 0);
}

/** Resumo humano do que está configurado (usado nas listagens). */
export function resumoDoLocal(mt) {
    if (!localPronto(mt)) return '';
    const os = Array.isArray(mt.objetos) ? mt.objetos : [];
    const n = (t) => os.filter(o => o && o.tipo === t).length;
    const partes = [`${mt.larguraReal} ${mt.unidade || 'm'}`];
    if (n('parede')) partes.push(`${n('parede')} parede${n('parede') > 1 ? 's' : ''}`);
    if (n('porta')) partes.push(`${n('porta')} porta${n('porta') > 1 ? 's' : ''}`);
    if (n('janela')) partes.push(`${n('janela')} janela${n('janela') > 1 ? 's' : ''}`);
    if (n('luz')) partes.push(`${n('luz')} luz${n('luz') > 1 ? 'es' : ''}`);
    if (n('npc')) partes.push(`${n('npc')} NPC${n('npc') > 1 ? 's' : ''}`);
    partes.push(mt.luzAtiva ? (mt.ambiente === 'dia' ? '☀️ dia' : '🌙 noite') : 'sem luz dinâmica');
    return partes.join(' · ');
}

/**
 * Importa o export "Roll20" do Dungeon Alchemist (o .txt que acompanha o .jpg).
 * O arquivo é um comando `!dungeonalchemist {json}` com:
 *   walls[]: { wall3D:{p1:{bottom:{x,y}},p2:{bottom:{x,y}},wallHeight}, type, open }
 *     type 0 = parede · 1 = porta · 2 = janela · 3 = contorno de objeto · 4 = muro baixo
 *     (paredes com p1==p2 são marcadores de ponta — ignoradas)
 *   lights[]: { color:"#RRGGBBAA", intensity, range(px), position:{x,y} }
 *   pixelsPerTile, grid: "W H" (tiles) — espaço-fonte = W*ppt × H*ppt px
 *
 * Coordenadas são reescaladas para px da imagem natural (imgW×imgH) e a
 * escala real assume o padrão do DA de 1 tile = 1,5 m (ajustável depois).
 * @returns { larguraReal, unidade, objetos, avisos } ou null se não for um export válido
 */
export function importarDungeonAlchemist(texto, imgW, imgH, metrosPorTile = 1.5) {
    const i = (texto || '').indexOf('{');
    if (i < 0) return null;
    let d;
    try { d = JSON.parse(texto.slice(i)); } catch { return null; }
    if (!Array.isArray(d.walls) || !d.grid) return null;
    const ppt = Number(d.pixelsPerTile) || 150;
    const [gw, gh] = String(d.grid).trim().split(/\s+/).map(Number);
    if (!(gw > 0) || !(gh > 0)) return null;
    const sx = imgW > 0 ? imgW / (gw * ppt) : 1;
    const sy = imgH > 0 ? imgH / (gh * ppt) : 1;
    const P = (p) => ({ x: Math.round(p.x * sx), y: Math.round(p.y * sy) });

    const objetos = [];
    let cadeia = null;              // polilinha de parede em crescimento
    for (const w of d.walls) {
        const p1 = w?.wall3D?.p1?.bottom, p2 = w?.wall3D?.p2?.bottom;
        if (!p1 || !p2 || Math.hypot(p2.x - p1.x, p2.y - p1.y) < 1) continue;
        const tipo = w.type === 1 ? 'porta' : w.type === 2 ? 'janela' : 'parede';
        if (tipo !== 'parede') {
            cadeia = null;
            objetos.push({ tipo, pontos: [P(p1), P(p2)] });
            continue;
        }
        // Segmentos consecutivos que se emendam viram UMA polilinha — os
        // contornos de árvore/pedra (type 3) são dezenas de tracinhos de 30px
        // e virariam centenas de objetos no raycasting do tabuleiro.
        const a = P(p1), b = P(p2);
        const fim = cadeia?.pontos[cadeia.pontos.length - 1];
        if (fim && Math.hypot(fim.x - a.x, fim.y - a.y) <= 2) {
            cadeia.pontos.push(b);
        } else {
            cadeia = { tipo: 'parede', pontos: [a, b] };
            objetos.push(cadeia);
        }
    }

    for (const l of (Array.isArray(d.lights) ? d.lights : [])) {
        if (!l?.position) continue;
        const p = P(l.position);
        objetos.push({
            tipo: 'luz', x: p.x, y: p.y,
            // range em px do espaço-fonte → unidades reais (o tabuleiro espera unidades)
            alcance: Math.round(((Number(l.range) || 0) / ppt) * metrosPorTile * 10) / 10 || metrosPorTile,
            cor: /^#[0-9a-fA-F]{8}$/.test(l.color || '') ? l.color.slice(0, 7) : (l.color || '#ffdd99'),
        });
    }

    const avisos = [];
    if (imgW > 0 && imgH > 0 && Math.abs((imgW / imgH) / (gw / gh) - 1) > 0.02) {
        avisos.push('A proporção da imagem não bate com o grid do .txt (imagem cortada ou reexportada?) — paredes podem desalinhar.');
    }
    return { larguraReal: Math.round(gw * metrosPorTile * 10) / 10, unidade: 'm', objetos, avisos };
}

/**
 * Importa o export UniversalVTT do Dungeon Alchemist (.dd2vtt — serve também
 * para .uvtt/.df2vtt de outros geradores). JSON com a imagem EMBUTIDA:
 *   resolution: { map_size:{x,y} (quadrados), pixels_per_grid }
 *   line_of_sight / objects_line_of_sight: polilinhas em QUADRADOS → parede
 *   portals: { bounds:[a,b], closed, ... } → porta (o formato NÃO distingue
 *            janela de porta — quem era janela o mestre converte no editor)
 *   lights: { position, range (quadrados), color "AARRGGBB", intensity }
 *   environment.baked_lighting: luz já pintada na imagem (gera aviso)
 *   image: base64 (PNG ou WEBP)
 * @returns { larguraReal, unidade, objetos, avisos, imagemBase64, imgW, imgH } ou null
 */
export function importarUVTT(texto, metrosPorTile = 1.5) {
    let d;
    try { d = JSON.parse(texto); } catch { return null; }
    const ppg = Number(d?.resolution?.pixels_per_grid);
    const gw = Number(d?.resolution?.map_size?.x), gh = Number(d?.resolution?.map_size?.y);
    if (!(ppg > 0) || !(gw > 0) || !(gh > 0) || typeof d.image !== 'string') return null;
    const P = (p) => ({ x: Math.round(p.x * ppg), y: Math.round(p.y * ppg) });

    const objetos = [];
    for (const linha of [...(d.line_of_sight || []), ...(d.objects_line_of_sight || [])]) {
        if (Array.isArray(linha) && linha.length >= 2) {
            objetos.push({ tipo: 'parede', pontos: linha.map(P) });
        }
    }
    for (const p of (Array.isArray(d.portals) ? d.portals : [])) {
        if (Array.isArray(p?.bounds) && p.bounds.length >= 2) {
            objetos.push({ tipo: 'porta', pontos: [P(p.bounds[0]), P(p.bounds[p.bounds.length - 1])] });
        }
    }
    for (const l of (Array.isArray(d.lights) ? d.lights : [])) {
        if (!l?.position) continue;
        const p = P(l.position);
        objetos.push({
            tipo: 'luz', x: p.x, y: p.y,
            alcance: Math.round((Number(l.range) || 0) * metrosPorTile * 10) / 10 || metrosPorTile,
            // cor vem AARRGGBB (alpha PRIMEIRO — o oposto do export Roll20)
            cor: /^[0-9a-fA-F]{8}$/.test(l.color || '') ? '#' + l.color.slice(2) : '#ffdd99',
        });
    }

    const avisos = [];
    if (d.environment?.baked_lighting) {
        avisos.push('A imagem veio com a luz já pintada (baked) — para a luz dinâmica ficar limpa, exporte com Lighting: "Only export lights to VTT".');
    }
    return {
        larguraReal: Math.round(gw * metrosPorTile * 10) / 10, unidade: 'm',
        objetos, avisos,
        imagemBase64: d.image, imgW: Math.round(gw * ppg), imgH: Math.round(gh * ppg),
    };
}

/**
 * Converte o mapa tático em payloads de objetos do Tabuleiro.
 * @param mt       o mapaTatico validado por localPronto()
 * @param destino  { x, y, w } — canto superior-esquerdo no mundo e largura
 *                 em px de mundo (o chamador decide via pxDeLarguraReal)
 * @returns array de payloads prontos para addObj() — a imagem vem primeiro
 */
export function objetosDoLocal(mt, destino) {
    if (!localPronto(mt) || !destino || !(destino.w > 0)) return [];
    const s = destino.w / mt.imgW;
    const P = (p) => ({ x: destino.x + p.x * s, y: destino.y + p.y * s });

    const out = [{
        tipo: 'imagem', layerId: 'mapa',
        url: mt.url,
        x: destino.x, y: destino.y,
        w: destino.w, h: mt.imgH * s,
        larguraReal: mt.larguraReal, unidade: mt.unidade || 'm',
    }];

    for (const o of (Array.isArray(mt.objetos) ? mt.objetos : [])) {
        if (!o || !o.tipo) continue;
        if (o.tipo === 'parede' && Array.isArray(o.pontos) && o.pontos.length >= 2) {
            out.push({
                tipo: 'desenho', layerId: 'luz', forma: 'livre',
                pontos: o.pontos.map(P), cor: '#ef4444', grossura: 3,
            });
        } else if ((o.tipo === 'porta' || o.tipo === 'janela') && Array.isArray(o.pontos) && o.pontos.length >= 2) {
            const a = P(o.pontos[0]), b = P(o.pontos[1]);
            out.push({ tipo: o.tipo, layerId: 'luz', pontos: [a, b], aberta: false, x: a.x, y: a.y });
        } else if (o.tipo === 'luz' && o.x != null && o.y != null) {
            const p = P(o);
            const luz = {
                tipo: 'luz', layerId: 'luz', x: p.x, y: p.y,
                // alcance fica em UNIDADES: o tabuleiro converte na hora de
                // renderizar usando a escala do próprio mapa importado.
                alcance: Number(o.alcance) || 6,
                cor: o.cor || '#ffdd99', visivelPublico: true,
            };
            if (o.animacao) luz.animacao = o.animacao;
            out.push(luz);
        } else if (o.tipo === 'npc' && o.npcId && o.x != null && o.y != null) {
            const p = P(o);
            const naDM = o.camada === 'dm';
            out.push({
                tipo: 'token', layerId: naDM ? 'dm' : 'tokens',
                x: p.x, y: p.y,
                nome: o.nome || 'NPC', url: o.url || '',
                vinculo: { tipo: 'npc', id: o.npcId },
                tamanhoCelulas: 1, rot: 0, mostrarNome: true,
                // Token na camada DM nunca vaza para o jogador; na de tokens,
                // vale a visibilidade normal do canvas.
                visivelPublico: !naDM,
                visao: { ativa: false, alcance: 9, angulo: 360, tipo: 'padrao' },
                luz: { ativa: false, alcance: 3 },
            });
        }
    }
    return out;
}
