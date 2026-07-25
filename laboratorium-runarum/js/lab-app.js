/* =====================================================================
   ᛟ LAB APP — Interface do Laboratorium Runarum
   ---------------------------------------------------------------------
   Paleta dinâmica (elementos dominados destacados; não dominados em
   modo simulação), auditoria ao vivo (rune-engine), Grimório persistido
   na ficha e Compêndio de consulta. Nada de dados de elementos no
   código: tudo vem de system/data/runicElements.
   ===================================================================== */

(function () {
    let elementsById = {}, canvasEl = null, currentRuna = null; // currentRuna = id no grimório (edição)

    const $ = s => document.querySelector(s);
    const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    const norm = s => RuneEngine.norm(s);
    const learned = () => (window.LabFB?.niveisEfetivos?.()) || (window.LabFB?.runomancia?.aprendidos) || {};

    const CAT_ORDEM = ['captador', 'condutor', 'modulador', 'logico', 'armazenador', 'emissor', 'exaustor'];
    const CAT_LABEL = {
        captador: '🌀 Captadores', condutor: '➰ Condutores', modulador: '🎚️ Moduladores',
        logico: '🧩 Lógicos', armazenador: '🔋 Armazenadores', emissor: '💥 Emissores', exaustor: '♨️ Exaustores',
    };

    // ================= BOOT =================
    window.labBoot = function () {
        elementsById = window.LabFB.elementsById || {};
        canvasEl = $('#labCanvas');

        const ctx = window.LabFB.ctx;
        $('#labCharInfo').innerHTML = ctx.nome
            ? `<b>${esc(ctx.nome)}</b> · ${esc(ctx.classe || '')}<br>
               <small>INT ${ctx.int} · RAC ${ctx.rac} · Runomancia ${ctx.runomancia} · Gravação ${ctx.gravacao} · Mentalização ${ctx.mentalizacao}</small>`
            : `<b>Simulação livre</b><br><small>Abra pela ficha para usar seus atributos e salvar no Grimório.</small>`;

        if (!Object.keys(elementsById).length) {
            $('#labPalette').innerHTML = `<div class="lab-empty">Nenhum Elemento Rúnico cadastrado.<br>
                Use o <b>Painel do Criador → ᛟ Elementos Rúnicos</b> (há um importador do Compêndio com os 64 elementos do livro).</div>`;
        } else {
            renderPalette();
        }

        LabCanvas.init(canvasEl, elementsById, learned(), onCanvasChange);
        renderCompendio();
        renderGrimorio();
        onCanvasChange(LabCanvas.getState());
        bindTabs();

        $('#labBtnLimpar').addEventListener('click', () => { if (confirm('Limpar a mesa de montagem?')) { currentRuna = null; $('#labRunaNome').value = ''; LabCanvas.clear(); } });
        $('#labBtnSalvar').addEventListener('click', salvarRuna);
        $('#labBtnPdf')?.addEventListener('click', exportarMesa);   // ausente se o HTML não foi atualizado
        $('#labSearch').addEventListener('input', renderPalette);
    };

    // ================= PALETA =================
    function renderPalette() {
        const q = norm($('#labSearch')?.value || '');
        const ap = learned();
        const els = Object.values(elementsById)
            .filter(e => !q || norm(e.nome).includes(q) || norm(e.nomeLatim).includes(q))
            .sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0) || String(a.nome).localeCompare(String(b.nome)));

        const grupos = [
            { titulo: '⚙️ Artus — Ações', itens: els.filter(e => norm(e.tipoElemento) === 'artus') },
            { titulo: '✨ Aspectus — Essências', itens: els.filter(e => norm(e.tipoElemento) === 'aspectus') },
            ...CAT_ORDEM.map(c => ({ titulo: CAT_LABEL[c] || c, itens: els.filter(e => norm(e.tipoElemento) === 'sigilus' && norm(e.categoria) === c) })),
            { titulo: '📦 Outros Sigilus', itens: els.filter(e => norm(e.tipoElemento) === 'sigilus' && !CAT_ORDEM.includes(norm(e.categoria))) },
        ].filter(g => g.itens.length);

        $('#labPalette').innerHTML = grupos.map(g => `
            <div class="lab-pal-grupo">
                <div class="lab-pal-titulo">${g.titulo}</div>
                ${g.itens.map(e => {
                    const nv = Number(ap[e.id] || 0);
                    const dom = nv > 0;
                    return `<button class="lab-pal-item ${dom ? 'dom' : 'sim'}" data-el="${e.id}"
                        title="${dom ? `Dominado até Nv${nv}` : 'Não dominado — apenas simulação'}${e.descricao ? ' — ' + esc(e.descricao).slice(0, 120) : ''}">
                        ${e.imagemUrl ? `<img src="${esc(e.imagemUrl)}" alt="">` : `<span class="lab-pal-dot" style="background:${e.cor ? esc(e.cor) : 'var(--muted)'}"></span>`}
                        <span class="lab-pal-nome">${esc(e.nome)}</span>
                        ${dom ? `<span class="lab-pal-nv">Nv${nv}</span>` : `<span class="lab-pal-nv sim">sim.</span>`}
                        <span class="lab-pal-info" data-info="${e.id}" title="Detalhes">ⓘ</span>
                    </button>`;
                }).join('')}
            </div>`).join('');

        $('#labPalette').querySelectorAll('.lab-pal-item').forEach(btn => {
            btn.addEventListener('click', ev => {
                if (ev.target.dataset.info) { window.labOpenElementInfo(ev.target.dataset.info); return; }
                const id = btn.dataset.el;
                const nv = Math.max(1, Number(learned()[id] || 1));
                const x = 40 + (canvasEl.scrollLeft || 0) + Math.random() * 120;
                const y = 40 + (canvasEl.scrollTop || 0) + Math.random() * 120;
                LabCanvas.addNode(id, x, y, Math.min(nv, 5));
            });
        });
    }

    // ================= AUDITORIA AO VIVO =================
    function onCanvasChange(cState) {
        const a = RuneEngine.audit({
            nodes: cState.nodes, links: cState.links, elementsById,
            char: { ...window.LabFB.ctx, aprendidos: learned() },
            tabelas: window.RUNO_TABELAS,
        });
        window._lastAudit = a;

        const natTxt = { plena: '⟐ Runa Plena', auxiliar: 'Runa Auxiliar', incompleta: '⚠️ Núcleo incompleto', vazia: 'Mesa vazia' }[a.natureza];
        const g = a.gravacao;
        $('#labAudit').innerHTML = `
            <div class="lab-aud-topo">
                <div class="lab-aud-ct"><span>CT</span><b>${a.ct}</b><small>Ess/ativação</small></div>
                <div class="lab-aud-nat">${natTxt}</div>
            </div>
            <table class="lab-aud-tab">
                <tr><td>🎯 Alvo (Teste de Construção §6.2)</td><td><b>${a.alvo || '—'}</b>${a.redutorConflu ? ` <small>(inclui ${a.redutorConflu} de Confluência)</small>` : ''}</td></tr>
                <tr><td>⏳ Gravação (§6.4)</td><td>${a.ct ? `<b>${fmtHoras(g.horas)}</b> <small>(CT÷5 h ×${Math.round(g.fatorTempo * 100)}%)</small>` : '—'}</td></tr>
                <tr><td>💰 Material</td><td>${a.ct ? `<b>≈ ${g.material} L$</b>${g.multMaterial > 1 ? ` <small>(×${g.multMaterial} por elemento ${g.multMaterial === 3 ? 'Mestre' : 'Avançado'})</small>` : ''}` : '—'}</td></tr>
                <tr><td>🔋 Armazenamento</td><td>${a.armazenamento.capacidade} Ess ${a.ct ? (a.armazenamento.suficiente ? '✅' : a.armazenamento.regimeContinuoOk ? '♻️ contínuo' : '⚠️ &lt; CT') : ''}</td></tr>
                <tr><td>♨️ Exaustão</td><td>${a.exaustao.presente ? a.exaustao.capacidade + ' Ess' : '— ausente'}</td></tr>
                <tr><td>🧠 Mentalização (§8.4)</td><td>${a.mentalizacao.componentes ? `${a.mentalizacao.classe} · ${a.mentalizacao.tempo}${a.mentalizacao.minPericia ? ` · perícia ${a.mentalizacao.minPericia}+` : ''}${a.mentalizacao.energiaPura ? ` · Pura: ${a.mentalizacao.energiaPura} En + esforço` : ''}` : '—'}</td></tr>
            </table>
            ${a.breakdown.length ? `<details class="lab-aud-det"><summary>Σ Composição (${a.breakdown.length} elementos)</summary>
                ${a.breakdown.map(b => `<div class="lab-aud-row"><span>${esc(b.nome)} Nv${b.nivel}${b.elo ? ' <small>(½ do par)</small>' : ''}</span><b>${b.custo} Ess</b></div>`).join('')}
            </details>` : ''}
            <div class="lab-aud-issues">
                ${a.issues.map(i => `<div class="lab-issue ${i.tipo}">${i.tipo === 'erro' ? '⛔' : i.tipo === 'aviso' ? '⚠️' : 'ℹ️'} ${i.msg}</div>`).join('') || '<div class="lab-issue ok">✅ Nenhuma violação das Regras de Posição.</div>'}
            </div>`;

        // Botão salvar: SOMENTE com todos os elementos dominados
        const btn = $('#labBtnSalvar');
        btn.disabled = !a.podeSalvar || !window.LabFB.charId;
        btn.title = !window.LabFB.charId
            ? 'Abra o Laboratorium pela ficha para salvar no Grimório'
            : a.podeSalvar ? 'Salvar esta runa no Grimório'
                : a.naoAprendidos.length
                    ? 'Elementos em simulação (não dominados): ' + a.naoAprendidos.map(n => `${n.nome} Nv${n.nivel}`).join(', ')
                    : 'Monte um circuito primeiro';
        // 📄 Exportar: diferente do Salvar, funciona TAMBÉM em simulação —
        // só exige que haja algo na mesa.
        const btnPdf = $('#labBtnPdf');
        if (btnPdf) {
            btnPdf.disabled = !cState.nodes.length;
            btnPdf.title = cState.nodes.length
                ? 'Imprimir / salvar em PDF a runa + a Auditoria do Projeto'
                : 'Monte um circuito primeiro';
        }

        $('#labSimAviso').style.display = a.naoAprendidos.length ? '' : 'none';
        $('#labSimAviso').innerHTML = a.naoAprendidos.length
            ? `🔮 Simulação: <b>${a.naoAprendidos.map(n => `${esc(n.nome)} Nv${n.nivel}`).join(' · ')}</b> ainda não dominado(s) — estude-os na Lista de Estudo da ficha para poder gravar.` : '';
    }

    function fmtHoras(h) {
        if (h <= 0) return '—';
        if (h < 1) return Math.round(h * 60) + ' min';
        const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
        return hh + ' h' + (mm ? ` ${mm} min` : '');
    }

    // ================= SALVAR / GRIMÓRIO =================
    async function salvarRuna() {
        const a = window._lastAudit;
        if (!a?.podeSalvar) return;
        const nome = ($('#labRunaNome').value || '').trim() || 'Runa sem nome';
        const cState = LabCanvas.getState();
        const runa = {
            id: currentRuna || ('runa_' + Date.now().toString(36)),
            nome,
            criadaEm: new Date().toISOString(),
            ct: a.ct, alvo: a.alvo, natureza: a.natureza,
            gravacao: { horas: Math.round(a.gravacao.horas * 100) / 100, material: a.gravacao.material },
            composicao: a.breakdown.map(b => ({ nome: b.nome, tipo: b.tipo, nivel: b.nivel, custo: b.custo })),
            canvas: cState,
        };
        const r = window.LabFB.runomancia;
        const idx = r.grimorio.findIndex(x => x.id === runa.id);
        if (idx >= 0) { runa.criadaEm = r.grimorio[idx].criadaEm; runa.atualizadaEm = new Date().toISOString(); r.grimorio[idx] = runa; }
        else r.grimorio.push(runa);

        const ok = await window.LabFB.saveRunomancia();
        toast(ok ? `📖 "${esc(nome)}" gravada no Grimório!` : '❌ Falha ao salvar — tente novamente.');
        if (ok) { currentRuna = runa.id; renderGrimorio(); }
    }

    // ================= EXPORTAR (impressão / PDF) =================
    /**
     * O Service Worker revalida cada recurso por conta própria: se a VERSION
     * do sw.js não for incrementada, um cliente pode ficar com o HTML antigo
     * (sem o <script> de rune-export.js) e o lab-app.js novo. Falha explicada
     * é melhor que ReferenceError.
     */
    function exportDisponivel() {
        if (window.LabExport) return true;
        toast('⚠️ Módulo de exportação não carregado — recarregue a página (Ctrl+F5).');
        return false;
    }

    /** Roda a auditoria completa sobre um estado de canvas qualquer. */
    function auditarEstado(state) {
        return RuneEngine.audit({
            nodes: state?.nodes || [], links: state?.links || [], elementsById,
            char: { ...window.LabFB.ctx, aprendidos: learned() },
            tabelas: window.RUNO_TABELAS,
        });
    }

    /** Mesa de montagem → folha. Usa a auditoria que já está na tela. */
    function exportarMesa() {
        if (!exportDisponivel()) return;
        const state = LabCanvas.getState();
        if (!state.nodes.length) { toast('⚠️ Não há nada na mesa para exportar.'); return; }
        LabExport.open({
            nome: ($('#labRunaNome').value || '').trim() || 'Runa sem nome',
            state,
            audit: window._lastAudit || auditarEstado(state),
            elementsById,
            ctx: window.LabFB.ctx,
        });
    }

    /**
     * Runa do Grimório → folha. A auditoria é RECALCULADA a partir de
     * r.canvas: o registro salvo guarda só o resumo (ct/alvo/composicao),
     * sem issues nem confluências.
     */
    function exportarRuna(r) {
        if (!exportDisponivel()) return;
        if (!r?.canvas?.nodes?.length) {
            toast('⚠️ Esta runa foi salva sem o desenho do circuito.');
            return;
        }
        LabExport.open({
            nome: r.nome,
            state: r.canvas,
            audit: auditarEstado(r.canvas),
            elementsById,
            ctx: window.LabFB.ctx,
        });
    }

    function renderGrimorio() {
        const g = window.LabFB.runomancia.grimorio || [];
        $('#labGrimorio').innerHTML = !g.length
            ? '<div class="lab-empty">O Grimório está em branco.<br>Monte um circuito com elementos dominados e grave sua primeira runa.</div>'
            : g.map(r => `
            <div class="lab-grim-card" data-id="${r.id}">
                <div class="lab-grim-head">
                    <b>ᛟ ${esc(r.nome)}</b>
                    <span class="lab-grim-ct">CT ${r.ct}</span>
                </div>
                <div class="lab-grim-meta">${r.natureza === 'plena' ? 'Runa Plena' : 'Runa Auxiliar'} · Alvo ${r.alvo} · Gravação ${fmtHoras(r.gravacao?.horas || 0)} · ≈ ${r.gravacao?.material || 0} L$</div>
                <div class="lab-grim-comp">${(r.composicao || []).map(c => `<span class="lab-chip">${esc(c.nome)} Nv${c.nivel} <small>${c.custo}</small></span>`).join('')}</div>
                <div class="lab-grim-acoes">
                    <button data-acao="abrir">🛠️ Abrir na mesa</button>
                    <button data-acao="pdf" title="Imprimir / salvar em PDF">📄</button>
                    <button data-acao="excluir" class="perigo">🗑️</button>
                </div>
            </div>`).join('');

        $('#labGrimorio').querySelectorAll('.lab-grim-card button').forEach(b => {
            b.addEventListener('click', async ev => {
                const card = ev.target.closest('.lab-grim-card');
                const id = card.dataset.id;
                const r = window.LabFB.runomancia.grimorio.find(x => x.id === id);
                if (!r) return;
                if (b.dataset.acao === 'abrir') {
                    currentRuna = id;
                    $('#labRunaNome').value = r.nome;
                    LabCanvas.loadState(r.canvas);
                    switchTab('montagem');
                } else if (b.dataset.acao === 'pdf') {
                    exportarRuna(r);
                } else if (b.dataset.acao === 'excluir') {
                    if (!confirm(`Apagar "${r.nome}" do Grimório?`)) return;
                    window.LabFB.runomancia.grimorio = window.LabFB.runomancia.grimorio.filter(x => x.id !== id);
                    if (currentRuna === id) currentRuna = null;
                    await window.LabFB.saveRunomancia();
                    renderGrimorio();
                }
            });
        });
    }

    // ================= COMPÊNDIO =================
    function renderCompendio() {
        $('#labCompendio').innerHTML = (window.RUNO_COMPENDIO || []).map(s => `
            <details class="lab-comp-sec"><summary>${s.icone} ${esc(s.titulo)}</summary>
            <div class="lab-comp-body">${s.html}</div></details>`).join('');
    }

    // ================= MODAL DE ELEMENTO =================
    window.labOpenElementInfo = function (elId, nivelSel) {
        const el = elementsById[elId];
        if (!el) return;
        const nv = Number(learned()[elId] || 0);
        const niveis = Array.isArray(el.niveis) ? el.niveis : [];
        const modal = $('#labModal');
        modal.querySelector('.lab-modal-corpo').innerHTML = `
            <h3>ᛟ ${esc(el.nome)} ${el.nomeLatim ? `<small>(${esc(el.nomeLatim)})</small>` : ''}</h3>
            <div class="lab-modal-tags">
                <span class="lab-chip">${esc(el.tipoElemento)}</span>
                ${el.categoria ? `<span class="lab-chip">${esc(el.categoria)}</span>` : ''}
                ${el.complexidade ? `<span class="lab-chip">${esc(el.complexidade)}</span>` : ''}
                ${el.cor ? `<span class="lab-chip">Essência ${esc(el.cor)}</span>` : ''}
                ${nv ? `<span class="lab-chip dom">Dominado Nv${nv}</span>` : '<span class="lab-chip sim">Não dominado</span>'}
            </div>
            ${el.imagemUrl ? `<img class="lab-modal-img" src="${esc(el.imagemUrl)}" alt="">` : ''}
            <p>${esc(el.descricao || '')}</p>
            ${el.posicaoRegra ? `<p><b>Posição:</b> ${esc(el.posicaoRegra)}</p>` : ''}
            ${el.limites ? `<p><b>Limites:</b> ${esc(el.limites)}</p>` : ''}
            ${niveis.length ? `<table class="lab-modal-tab"><tr><th>Nv</th><th>Ess</th><th>EXP</th><th>Sessões</th><th>Cap.</th><th>Taxa</th><th>Propriedades</th></tr>
                ${niveis.map(n => `<tr class="${nivelSel && Number(n.nivel) === Number(nivelSel) ? 'sel' : ''}">
                    <td>${n.nivel}</td><td>${n.custoEss ?? '—'}</td><td>${n.custoExp ?? '—'}</td><td>${n.sessoesEstudo ?? '—'}</td>
                    <td>${n.capacidade || '—'}</td><td>${n.taxa ? n.taxa + '/h' : '—'}</td><td>${esc(n.propriedades || '')}</td></tr>`).join('')}
            </table>` : ''}`;
        modal.style.display = 'flex';
    };
    $('#labModal')?.addEventListener('click', e => { if (e.target.id === 'labModal' || e.target.classList.contains('lab-modal-x')) $('#labModal').style.display = 'none'; });

    // ================= ABAS / TOAST =================
    function bindTabs() {
        document.querySelectorAll('.lab-tab').forEach(t =>
            t.addEventListener('click', () => switchTab(t.dataset.tab)));
    }
    function switchTab(tab) {
        document.querySelectorAll('.lab-tab').forEach(t => t.classList.toggle('ativo', t.dataset.tab === tab));
        document.querySelectorAll('.lab-pane').forEach(p => p.style.display = p.dataset.pane === tab ? '' : 'none');
    }
    function toast(msg) {
        const t = document.createElement('div');
        t.className = 'lab-toast'; t.innerHTML = msg;
        document.body.appendChild(t);
        setTimeout(() => t.classList.add('show'), 20);
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 2800);
    }
    window.labToast = toast;   // usado por rune-export.js
})();
