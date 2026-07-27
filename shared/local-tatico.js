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
//     ],
//   }
// =============================================

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
    partes.push(mt.luzAtiva ? (mt.ambiente === 'dia' ? '☀️ dia' : '🌙 noite') : 'sem luz dinâmica');
    return partes.join(' · ');
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
        }
    }
    return out;
}
