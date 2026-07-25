/* =====================================================================
   ᛟ RUNE EXPORT — Folha de Impressão / PDF do Laboratorium Runarum
   ---------------------------------------------------------------------
   Gera uma "Ficha Técnica da Runa" pronta para imprimir ou salvar como
   PDF (diálogo do navegador → "Salvar como PDF"). Sem dependências.

   A figura da runa NÃO é um print da tela: é um SVG reconstruído a
   partir do MODELO (LabCanvas.getState()), com viewBox calculado pela
   bounding box real do circuito — incluindo badges de nível, rótulos de
   custo, marcadores de "simulação", pontos de conexão e o estufamento
   das curvas bézier. Assim nada é cortado, independentemente de zoom,
   rolagem ou tamanho da janela no momento da exportação.

   A auditoria vem inteira do RuneEngine (mesmos números da coluna
   "Auditoria do Projeto", §6 do Compêndio), incluindo o que na tela
   fica escondido dentro do <details> de composição.
   ===================================================================== */

const LabExport = (() => {

    const PAD = 44;             // margem ao redor do circuito (unidades do canvas)
    const IMG_WAIT = 6000;      // ms máximos esperando as imagens dos glifos

    const esc = s => String(s ?? '').replace(/[&<>"']/g, m =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

    // Paletas da figura. A escura reproduz a mesa de montagem; a clara
    // existe para quem vai imprimir em papel de verdade.
    const TEMAS = {
        escuro: {
            bg: '#0e1018', grid: 'rgba(139,147,167,.30)', nodeFill: '#1a1e2c',
            ink: '#e8eaf2', muted: '#8b93a7', chip: '#151827',
            lume: '#d4af37', sinal: '#8a6fe0', borda: '#2a2f45',
        },
        claro: {
            bg: '#faf8f2', grid: 'rgba(70,74,90,.22)', nodeFill: '#ffffff',
            ink: '#1a1c22', muted: '#5b6070', chip: '#f0ece0',
            lume: '#8a6d16', sinal: '#5b43a8', borda: '#c9c2ad',
        },
    };

    const G = () => window.LabCanvas.getGeometry();

    // ==================================================================
    // 1. BOUNDING BOX — a garantia de "não corta nada"
    // ==================================================================
    function bbox(state, elementsById, simSet) {
        const g = G();
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        const put = (x, y) => {
            if (!isFinite(x) || !isFinite(y)) return;
            if (x < x0) x0 = x; if (y < y0) y0 = y;
            if (x > x1) x1 = x; if (y > y1) y1 = y;
        };
        const byId = id => state.nodes.find(n => n.id === id);

        state.nodes.forEach(n => {
            const sim = simSet.has(n.id);
            // badge "NvX" vaza 9px para cima/esquerda; o custo em Ess fica
            // 13px abaixo (26px quando há o rótulo "simulação" no meio).
            put(n.x - 12, n.y - 12);
            put(n.x + g.NODE_W + 6, n.y + g.NODE_H + (sim ? 36 : 22));

            const el = elementsById[n.elementId];
            g.pointsOf(el).forEach((p, i) => {
                const q = g.ptPos(n, i);
                put(q.x - 9, q.y - 9);
                put(q.x + 9, q.y + 9);
            });
        });

        // As curvas usam controle em a.x±max(24,|dx|/2): numa ligação "para
        // trás" a curva estufa para FORA dos dois extremos. Amostrar o bézier
        // é mais barato (e mais seguro) do que resolver os extremos na mão.
        state.links.forEach(l => {
            const na = byId(l.a.nodeId), nb = byId(l.b.nodeId);
            if (!na || !nb) return;
            const a = g.ptPos(na, l.a.pt), b = g.ptPos(nb, l.b.pt);
            const dx = Math.max(24, Math.abs(b.x - a.x) / 2);
            const c1 = { x: a.x + dx, y: a.y }, c2 = { x: b.x - dx, y: b.y };
            for (let i = 0; i <= 32; i++) {
                const t = i / 32, u = 1 - t;
                put(u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
                    u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y);
            }
        });

        if (!isFinite(x0)) return { x: 0, y: 0, w: 420, h: 300 };
        return { x: x0 - PAD, y: y0 - PAD, w: (x1 - x0) + PAD * 2, h: (y1 - y0) + PAD * 2 };
    }

    // ==================================================================
    // 2. FIGURA — SVG standalone a partir do modelo
    // ==================================================================
    /** Quebra de linha manual (SVG não tem wrap automático). */
    function wrap(txt, maxPx, fontPx) {
        const max = Math.max(4, Math.floor(maxPx / (fontPx * 0.56)));
        const linhas = [];
        let cur = '';
        String(txt || '').split(/\s+/).filter(Boolean).forEach(w => {
            if (!cur) cur = w;
            else if ((cur + ' ' + w).length <= max) cur += ' ' + w;
            else { linhas.push(cur); cur = w; }
        });
        if (cur) linhas.push(cur);

        const out = [];
        linhas.forEach(l => {
            while (l.length > max) { out.push(l.slice(0, max - 1) + '-'); l = l.slice(max - 1); }
            out.push(l);
        });
        // Nome longo demais para o nó: marca a supressão em vez de sumir
        // silenciosamente com o resto (o nome completo vai na Σ Composição).
        if (out.length > 3) {
            const corte = out.slice(0, 3);
            corte[2] = corte[2].replace(/[-\s]$/, '') + '…';
            return corte;
        }
        return out;
    }

    function svgNode(n, el, sim, g, T) {
        const p = [];
        p.push(`<g${sim ? ' opacity="0.62"' : ''}>`);

        if (el.imagemUrl) {
            // object-fit: contain  ⇒  preserveAspectRatio="xMidYMid meet"
            const u = esc(el.imagemUrl);
            p.push(`<image href="${u}" xlink:href="${u}" x="${n.x}" y="${n.y}" ` +
                `width="${g.NODE_W}" height="${g.NODE_H}" preserveAspectRatio="xMidYMid meet"/>`);
        } else {
            const cor = el.cor ? g.cssColor(el.cor) : '#94a3b8';
            p.push(`<rect x="${n.x}" y="${n.y}" width="${g.NODE_W}" height="${g.NODE_H}" rx="14" ry="14" ` +
                `fill="${T.nodeFill}" stroke="${cor}" stroke-width="1.5"${sim ? ' stroke-dasharray="5 4"' : ''}/>`);

            const linhas = wrap(el.nome, g.NODE_W - 14, 11.5);
            const temLatim = el.nomeLatim ? 1 : 0;
            const total = linhas.length + temLatim;
            const cx = n.x + g.NODE_W / 2;
            let cy = n.y + g.NODE_H / 2 - ((total - 1) * 13) / 2 + 4;

            linhas.forEach(l => {
                p.push(`<text x="${cx}" y="${cy}" text-anchor="middle" font-size="11.5" ` +
                    `font-weight="700" fill="${T.ink}">${esc(l)}</text>`);
                cy += 13;
            });
            if (temLatim) {
                p.push(`<text x="${cx}" y="${cy}" text-anchor="middle" font-size="9.2" ` +
                    `font-style="italic" fill="${T.muted}">${esc(el.nomeLatim)}</text>`);
            }
        }

        // Pontos de conexão (mesmas cores da mesa)
        g.pointsOf(el).forEach((pt, i) => {
            const q = g.ptPos(n, i);
            p.push(`<circle cx="${q.x}" cy="${q.y}" r="6" fill="${g.CP_CORES[pt.tipo] || '#888'}" ` +
                `stroke="${T.bg}" stroke-width="2"/>`);
        });

        // Badge de nível
        const nvTxt = 'Nv' + n.nivel;
        const nvW = 13 + nvTxt.length * 5.6;
        p.push(`<rect x="${n.x - 9}" y="${n.y - 9}" width="${nvW}" height="16" rx="8" ry="8" ` +
            `fill="${T.chip}" stroke="${T.lume}" stroke-width="1"/>`);
        p.push(`<text x="${n.x - 9 + nvW / 2}" y="${n.y + 2.5}" text-anchor="middle" font-size="9.6" ` +
            `font-weight="700" fill="${T.lume}">${nvTxt}</text>`);

        // Custo em Essência
        const custo = window.RuneEngine.custoEss(el, n.nivel) + ' Ess';
        p.push(`<text x="${n.x + g.NODE_W}" y="${n.y + g.NODE_H + (sim ? 26 : 13)}" text-anchor="end" ` +
            `font-size="9.3" fill="${T.lume}">${esc(custo)}</text>`);

        if (sim) {
            p.push(`<text x="${n.x + g.NODE_W / 2}" y="${n.y + g.NODE_H + 14}" text-anchor="middle" ` +
                `font-size="8.8" font-style="italic" fill="${T.sinal}">simulação</text>`);
        }

        p.push('</g>');
        return p.join('');
    }

    function buildSvg(state, elementsById, simSet, tema) {
        const g = G();
        const T = TEMAS[tema] || TEMAS.escuro;
        const bb = bbox(state, elementsById, simSet);
        const byId = id => state.nodes.find(n => n.id === id);
        const body = [];

        // Fundo + grade pontilhada (mesmo passo de 26px da mesa)
        body.push(`<rect x="${bb.x}" y="${bb.y}" width="${bb.w}" height="${bb.h}" fill="${T.bg}"/>`);
        body.push(`<rect x="${bb.x}" y="${bb.y}" width="${bb.w}" height="${bb.h}" fill="url(#labGrid)"/>`);

        // Ligações primeiro (ficam atrás dos nós, como na mesa)
        state.links.forEach(l => {
            const na = byId(l.a.nodeId), nb = byId(l.b.nodeId);
            if (!na || !nb) return;
            const a = g.ptPos(na, l.a.pt), b = g.ptPos(nb, l.b.pt);
            const sinal = a.tipo === 'sinal' || b.tipo === 'sinal';
            body.push(`<path d="${g.linkPath(a, b)}" fill="none" stroke="${g.linkColor(sinal)}" ` +
                `stroke-width="3" stroke-linecap="round"${sinal ? ' stroke-dasharray="6 5"' : ''}/>`);
        });

        state.nodes.forEach(n => {
            const el = elementsById[n.elementId];
            if (!el) return;   // elemento removido do Painel do Criador
            body.push(svgNode(n, el, simSet.has(n.id), g, T));
        });

        const svg =
            `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
            `viewBox="${bb.x} ${bb.y} ${bb.w} ${bb.h}" preserveAspectRatio="xMidYMid meet" ` +
            `role="img" aria-label="Circuito rúnico" ` +
            `font-family="Inter, system-ui, -apple-system, sans-serif">` +
            `<defs><pattern id="labGrid" x="0" y="0" width="26" height="26" patternUnits="userSpaceOnUse">` +
            `<circle cx="1" cy="1" r="1" fill="${T.grid}"/></pattern></defs>` +
            body.join('') +
            `</svg>`;

        return { svg, bb };
    }

    // ==================================================================
    // 3. AUDITORIA DO PROJETO
    // ==================================================================
    function fmtHoras(h) {
        if (!h || h <= 0) return '—';
        if (h < 1) return Math.round(h * 60) + ' min';
        const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
        return hh + ' h' + (mm ? ` ${mm} min` : '');
    }

    function linha(rot, val) {
        return `<tr><th>${rot}</th><td>${val}</td></tr>`;
    }

    function auditHtml(a, ctx) {
        const natTxt = {
            plena: '⟐ Runa Plena', auxiliar: 'Runa Auxiliar',
            incompleta: '⚠️ Núcleo incompleto', vazia: 'Mesa vazia',
        }[a.natureza] || '—';
        const g = a.gravacao, arm = a.armazenamento, m = a.mentalizacao;

        const tabela = [
            linha('🎯 Alvo — Teste de Construção (§6.2)',
                `<b>${a.alvo || '—'}</b>` +
                (a.redutorConflu ? ` <small>(inclui ${a.redutorConflu} de Confluência)</small>` : '')),
            linha('⏳ Gravação (§6.4)', a.ct
                ? `<b>${fmtHoras(g.horas)}</b> <small>(CT ÷ 5 h × ${Math.round(g.fatorTempo * 100)}% — perícia Gravação Nv${ctx.gravacao || 0})</small>`
                : '—'),
            linha('💰 Material', a.ct
                ? `<b>≈ ${g.material} L$</b>` + (g.multMaterial > 1
                    ? ` <small>(×${g.multMaterial} — elemento ${g.multMaterial === 3 ? 'Mestre' : 'Avançado'})</small>` : '')
                : '—'),
            linha('🔋 Armazenamento', `<b>${arm.capacidade} Ess</b>` + (a.ct
                ? (arm.suficiente ? ' <small>✅ cobre o CT</small>'
                    : arm.regimeContinuoOk ? ' <small>♻️ opera em Regime Contínuo</small>'
                        : ' <small>⚠️ menor que o CT — Subcarga permanente (§2.8)</small>')
                : '') + (arm.taxaContinua ? `<br><small>Captação contínua: ${arm.taxaContinua} Ess/h</small>` : '')),
            linha('♨️ Exaustão', a.exaustao.presente
                ? `<b>${a.exaustao.capacidade} Ess</b>`
                : '<b>— ausente</b> <small>(todo excedente vira Sobrecarga, §2.9)</small>'),
            linha('🧠 Mentalização (§8.4)', m.componentes
                // A classe/tempo vêm de RUNO_TABELAS.complexidadeRuna; se a faixa
                // não resolver, não deixa separador solto na folha.
                ? [`<b>${esc(m.classe || '—')}</b>`, esc(m.tempo || ''),
                m.minPericia ? `perícia ${m.minPericia}+` : ''].filter(Boolean).join(' · ') +
                (m.energiaPura ? `<br><small>Energia Pura: ${m.energiaPura} En + esforço dos componentes</small>` : '')
                : '—'),
            linha('🧩 Componentes', `${m.componentes || 0} elemento(s)`),
        ].join('');

        const comp = a.breakdown.length ? `
            <h3>Σ Composição</h3>
            <table class="lab-pr-comp">
                <thead><tr><th>Elemento</th><th>Tipo</th><th>Nv</th><th>Ess</th></tr></thead>
                <tbody>${a.breakdown.map(b => `<tr>
                    <td>${esc(b.nome)}${b.elo ? ' <small>(½ do par — Elo)</small>' : ''}</td>
                    <td>${esc(b.tipo || '—')}</td>
                    <td class="num">${b.nivel}</td>
                    <td class="num">${b.custo}</td></tr>`).join('')}
                </tbody>
                <tfoot><tr><td colspan="3">Custo Total (CT)</td><td class="num">${a.ct}</td></tr></tfoot>
            </table>` : '';

        const conflu = (a.confluencias && a.confluencias.length) ? `
            <h3>⚗️ Confluências detectadas</h3>
            <ul class="lab-pr-lista">${a.confluencias.map(c => `<li>
                <b>${esc(c.elemento)}</b> — classe ${esc(c.classe)}; grau exigido: ${esc(c.grau)}${c.redutor ? `; redutor ${c.redutor}` : ''}${c.consequencia ? `<br><small>Consequência: ${esc(c.consequencia)}</small>` : ''}
            </li>`).join('')}</ul>` : '';

        const issues = `
            <h3>📋 Regras de Posição e Advertências</h3>
            <div class="lab-pr-issues">${a.issues.length
                ? a.issues.map(i => `<div class="lab-pr-issue ${i.tipo}">${i.tipo === 'erro' ? '⛔' : i.tipo === 'aviso' ? '⚠️' : 'ℹ️'} ${esc(i.msg)}</div>`).join('')
                : '<div class="lab-pr-issue ok">✅ Nenhuma violação das Regras de Posição.</div>'}</div>`;

        const naoDom = a.naoAprendidos.length ? `
            <h3>🔮 Elementos não dominados (simulação)</h3>
            <p class="lab-pr-nota">Esta runa <b>não pode ser gravada</b> enquanto estes elementos não forem
            estudados na Lista de Estudo da ficha:</p>
            <ul class="lab-pr-lista">${a.naoAprendidos.map(n =>
            `<li><b>${esc(n.nome)}</b> — exigido Nv${n.nivel}, dominado Nv${n.dominado}</li>`).join('')}</ul>` : '';

        return `
            <section class="lab-pr-audit">
                <h2>Auditoria do Projeto <small>(§6 — Compêndio de Runomancia)</small></h2>
                <div class="lab-pr-destaque">
                    <div class="lab-pr-ct"><span>CT</span><b>${a.ct}</b><small>Ess / ativação</small></div>
                    <div class="lab-pr-nat">${natTxt}</div>
                </div>
                <table class="lab-pr-tab">${tabela}</table>
                ${comp}${conflu}${issues}${naoDom}
            </section>`;
    }

    // ==================================================================
    // 4. FOLHA
    // ==================================================================
    function cabecalho(nome, ctx, sim) {
        const data = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        const attrs = ctx && ctx.nome
            ? `INT ${ctx.int} · RAC ${ctx.rac} · Runomancia ${ctx.runomancia} · Gravação ${ctx.gravacao} · Mentalização ${ctx.mentalizacao}`
            : 'Simulação livre — sem ficha vinculada';
        return `
            <header class="lab-pr-topo">
                <div>
                    <h1><span class="runa">ᛟ</span> ${esc(nome)}</h1>
                    <div class="lab-pr-sub">
                        ${ctx && ctx.nome ? `<b>${esc(ctx.nome)}</b>${ctx.classe ? ' · ' + esc(ctx.classe) : ''}<br>` : ''}
                        <small>${esc(attrs)}</small>
                    </div>
                </div>
                <div class="lab-pr-selo">
                    Laboratorium Runarum<br><small>Lendas &amp; Relíquias · ${esc(data)}</small>
                    ${sim ? '<div class="lab-pr-simtag">SIMULAÇÃO</div>' : ''}
                </div>
            </header>`;
    }

    /** Espera as imagens dos glifos carregarem (com teto de tempo). */
    function aguardarImagens(root) {
        const imgs = Array.from(root.querySelectorAll('image'))
            .map(el => el.getAttribute('href') || el.getAttribute('xlink:href'))
            .filter(Boolean);
        if (!imgs.length) return Promise.resolve();

        const cada = src => new Promise(res => {
            const im = new Image();
            im.onload = im.onerror = () => res();
            im.src = src;
        });
        return Promise.race([
            Promise.all(imgs.map(cada)),
            new Promise(res => setTimeout(res, IMG_WAIT)),
        ]);
    }

    const slug = s => String(s || 'runa').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'runa';

    // ==================================================================
    // 5. MODAL DE OPÇÕES + IMPRESSÃO
    // ==================================================================
    let pendente = null;   // payload aguardando confirmação no modal

    function modal() {
        let ov = document.getElementById('labPrintOverlay');
        if (ov) return ov;

        ov = document.createElement('div');
        ov.id = 'labPrintOverlay';
        ov.innerHTML = `
            <div id="labPrintModal" role="dialog" aria-modal="true" aria-labelledby="labPrintTitulo">
                <h2 id="labPrintTitulo">ᛟ Exportar Runa</h2>
                <label class="lab-pr-opt"><input type="checkbox" id="labPrOptFig" checked> Imagem da runa</label>
                <label class="lab-pr-opt"><input type="checkbox" id="labPrOptAud" checked> Auditoria do Projeto</label>
                <label class="lab-pr-opt"><input type="checkbox" id="labPrOptClaro"> Fundo claro na figura <small>(economiza tinta)</small></label>
                <p class="lab-pr-dica">No diálogo do navegador, escolha <b>“Salvar como PDF”</b> em Destino
                   para baixar o arquivo — ou envie direto para a impressora.</p>
                <div class="lab-pr-acoes">
                    <button type="button" class="cancelar" id="labPrCancelar">Cancelar</button>
                    <button type="button" class="confirmar" id="labPrConfirmar">📄 Gerar</button>
                </div>
            </div>`;
        document.body.appendChild(ov);

        ov.addEventListener('click', e => { if (e.target === ov) fechar(); });
        ov.querySelector('#labPrCancelar').addEventListener('click', fechar);
        ov.querySelector('#labPrConfirmar').addEventListener('click', confirmar);
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && ov.style.display === 'flex') fechar();
        });
        return ov;
    }

    function fechar() {
        const ov = document.getElementById('labPrintOverlay');
        if (ov) ov.style.display = 'none';
        pendente = null;
    }

    /**
     * Abre o modal de exportação.
     * @param {Object} p
     * @param {String} p.nome        nome da runa
     * @param {Object} p.state       {nodes, links} — LabCanvas.getState() ou runa.canvas
     * @param {Object} p.audit       resultado de RuneEngine.audit
     * @param {Object} p.elementsById catálogo
     * @param {Object} p.ctx         contexto do personagem (LabFB.ctx)
     */
    function open(p) {
        if (!p || !p.state || !p.state.nodes || !p.state.nodes.length) {
            window.labToast?.('⚠️ Não há nada na mesa para exportar.');
            return;
        }
        pendente = p;
        const ov = modal();
        ov.style.display = 'flex';
        ov.querySelector('#labPrConfirmar').focus();
    }

    async function confirmar() {
        const p = pendente;
        if (!p) return;

        const comFig = document.getElementById('labPrOptFig').checked;
        const comAud = document.getElementById('labPrOptAud').checked;
        const claro = document.getElementById('labPrOptClaro').checked;
        if (!comFig && !comAud) {
            window.labToast?.('⚠️ Selecione ao menos uma seção.');
            return;
        }
        fechar();

        const btn = document.getElementById('labPrConfirmar');
        if (btn) btn.disabled = true;
        window.labToast?.('📄 Montando a folha…');

        try {
            await gerar(p, { comFig, comAud, claro });
        } catch (e) {
            console.error('❌ Falha ao gerar a folha:', e);
            window.labToast?.('❌ Não foi possível gerar a folha — veja o console.');
            limpar();
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async function gerar(p, opts) {
        const a = p.audit;
        const simSet = new Set((a?.naoAprendidos || []).map(n => n.nodeId));
        const nome = (p.nome || '').trim() || 'Runa sem nome';

        let figura = '', paisagem = false;
        if (opts.comFig) {
            const { svg, bb } = buildSvg(p.state, p.elementsById, simSet, opts.claro ? 'claro' : 'escuro');
            // Circuito largo em A4 retrato encolhe até ficar ilegível:
            // gira a folha inteira em vez de espremer a figura.
            paisagem = (bb.w / bb.h) > 1.35;
            figura = `<figure class="lab-pr-fig">${svg}
                <figcaption>Circuito completo — ${p.state.nodes.length} elemento(s),
                ${p.state.links.length} ligação(ões). Enquadramento automático: nada foi cortado.</figcaption>
            </figure>`;
        }

        const sheet = document.getElementById('labPrintSheet');
        sheet.className = 'lab-print-sheet' + (paisagem ? ' paisagem' : '');
        sheet.innerHTML =
            cabecalho(nome, p.ctx, simSet.size > 0) +
            figura +
            (opts.comAud && a ? auditHtml(a, p.ctx || {}) : '') +
            `<footer class="lab-pr-rodape">Gerado pelo Laboratorium Runarum · Lendas &amp; Relíquias</footer>`;
        sheet.setAttribute('aria-hidden', 'false');

        // @page não aceita seletor de classe — a orientação vai por <style> injetado.
        let ps = document.getElementById('labPageStyle');
        if (!ps) {
            ps = document.createElement('style');
            ps.id = 'labPageStyle';
            document.head.appendChild(ps);
        }
        ps.textContent = `@page { size: A4 ${paisagem ? 'landscape' : 'portrait'}; margin: 12mm; }`;

        await aguardarImagens(sheet);

        // O navegador usa document.title como nome sugerido do PDF.
        const tituloOriginal = document.title;
        const hoje = new Date().toISOString().slice(0, 10);
        document.title = `runa-${slug(nome)}-${hoje}`;

        document.body.classList.add('lab-printing');

        const depois = () => {
            document.title = tituloOriginal;
            limpar();
            window.removeEventListener('afterprint', depois);
        };
        window.addEventListener('afterprint', depois);

        // Um frame para o layout de impressão assentar antes do diálogo.
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        window.print();

        // Safari/iOS nem sempre disparam afterprint.
        setTimeout(() => { if (document.body.classList.contains('lab-printing')) depois(); }, 60000);
    }

    function limpar() {
        document.body.classList.remove('lab-printing');
        const sheet = document.getElementById('labPrintSheet');
        if (sheet) { sheet.innerHTML = ''; sheet.setAttribute('aria-hidden', 'true'); }
    }

    return { open, buildSvg, bbox };
})();

if (typeof window !== 'undefined') window.LabExport = LabExport;
