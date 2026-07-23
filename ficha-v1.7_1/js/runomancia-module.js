/* =====================================================================
   ᛟ RUNOMANCIA — Módulo da Ficha de Personagem
   ---------------------------------------------------------------------
   - Renderização condicional: só aparece se a classe tem usaRunomancia=ON
   - Instancia o "Módulo da Lista de Estudo" (tipo 'runomancia', configurado
     no Painel do Criador) acima do botão "Laboratorium Runarum"
   - Lê dinamicamente TODOS os Elementos Rúnicos de system/data/runicElements
     (window._systemData.runicElements) — nada hardcoded
   - Modal de detalhes com custo de EXP e tempo de estudo (com descontos)
   - Persistência em state.runomancia → gatherData()/loadFromData()
   ===================================================================== */

(function () {
    // ---- estado ----
    function _runoState() {
        if (!window.state) window.state = {};
        if (!state.runomancia) state.runomancia = { estudos: [], aprendidos: {}, grimorio: [] };
        state.runomancia.estudos = state.runomancia.estudos || [];
        state.runomancia.aprendidos = state.runomancia.aprendidos || {};
        state.runomancia.grimorio = state.runomancia.grimorio || [];
        // ᛟ Níveis concedidos por mecânicas (ex.: Distribuir com pool rúnico).
        // Reconstruído a cada recálculo pelo mechanics-engine — aqui é só leitura.
        state.runomancia.concedidos = state.runomancia.concedidos || {};
        return state.runomancia;
    }

    // Nível vindo do estudo (gasto de EXP + sessões)
    function _nivelEstudado(elId) { return Number(_runoState().aprendidos[elId] || 0); }
    // Nível vindo de mecânicas (classe, raça, peculiaridade…)
    function _nivelConcedido(elId) { return Number(_runoState().concedidos[elId] || 0); }
    // Nível efetivo do personagem no elemento
    function _nivelEfetivo(elId) { return _nivelEstudado(elId) + _nivelConcedido(elId); }

    window.runoNivelEstudado = _nivelEstudado;
    window.runoNivelConcedido = _nivelConcedido;
    window.runoNivelEfetivo = _nivelEfetivo;

    window.gatherRunomanciaData = function () { return _runoState(); };
    window.applyRunomanciaData = function (d) {
        if (!window.state) window.state = {};
        state.runomancia = (d && typeof d === 'object') ? d : { estudos: [], aprendidos: {}, grimorio: [] };
        _runoState();
    };

    // ---- helpers de dados ----
    function _classDoc(nome) {
        return (window._systemData?.classes || []).find(c => c.nome === nome) || null;
    }
    function _elements() {
        return (window._systemData?.runicElements || []).slice()
            .sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999) || (a.nome || '').localeCompare(b.nome || ''));
    }
    function _elById(id) { return _elements().find(e => e.id === id) || null; }
    function _dot(key) { return (window.state?.dots?.[key]) || 0; }

    function _runoModuleConfig(classe) {
        const cls = _classDoc(classe);
        const rawMods = Array.isArray(cls?.modulosDaClasse) ? cls.modulosDaClasse : [];
        const classModulesCol = window._systemData?.classModules || [];
        // Resolver referências: strings -> objetos
        const mods = rawMods.map(entry => {
            if (typeof entry === 'string') return classModulesCol.find(m => m.id === entry) || null;
            if (typeof entry === 'object' && entry !== null) return entry;
            return null;
        }).filter(Boolean);
        return mods.find(m => m.tipo === 'runomancia') || null;
    }

    function _slots(cfg) {
        const base = cfg?.runoSlotsBase ?? 2;
        const perLv = cfg?.runoSlotsPorNivel ?? 1;
        const lv = cfg?.runoSlotsDotKey ? _dot(cfg.runoSlotsDotKey) : 0;
        return Math.max(0, Math.floor(base + lv * perLv));
    }
    function _desconto(cfg) {
        const perLv = cfg?.runoDescontoPorNivel ?? 0;
        const lv = cfg?.runoDescontoDotKey ? _dot(cfg.runoDescontoDotKey) : 0;
        return Math.floor(lv * perLv);
    }
    function _nivelInfo(el, nivel) {
        const rows = Array.isArray(el.niveis) ? el.niveis : [];
        return rows.find(r => r.nivel === nivel) || null;
    }
    function _sessoesNecessarias(el, nivel, cfg) {
        const info = _nivelInfo(el, nivel);
        const base = info?.sessoesEstudo ?? 0;
        return Math.max(1, base - _desconto(cfg));
    }
    function _custoExp(el, nivel, cfg) {
        const info = _nivelInfo(el, nivel);
        const mult = cfg?.runoCustoExpMult ?? 1;
        return Math.round((info?.custoExp ?? 0) * mult);
    }

    const TIPO_LABEL = { artus: 'Artus', aspectus: 'Aspectus', sigilus: 'Sigilus' };
    const TIPO_ICON = { artus: '⚙️', aspectus: '✨', sigilus: 'ᛟ' };
    const CAT_LABEL = { captador: 'Captador', condutor: 'Condutor', modulador: 'Modulador', logico: 'Lógico', armazenador: 'Armazenador', emissor: 'Emissor', exaustor: 'Exaustor' };

    // ---- CSS ----
    (function () {
        if (document.getElementById('runoModuleCSS')) return;
        const s = document.createElement('style');
        s.id = 'runoModuleCSS';
        s.textContent = `
        .runo-mod{border:1px solid rgba(139,92,246,.25);border-radius:12px;background:rgba(30,27,58,.45);margin-top:14px;overflow:hidden}
        .runo-mod-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px;background:linear-gradient(90deg,rgba(139,92,246,.14),transparent);border-bottom:1px solid rgba(139,92,246,.2)}
        .runo-mod-head h4{margin:0;font-size:.9rem;color:var(--text,#e2e8f0)}
        .runo-slots{font-size:.75rem;color:#c4b5fd;background:rgba(139,92,246,.16);padding:2px 10px;border-radius:999px}
        .runo-body{padding:10px}
        .runo-study-row{display:grid;grid-template-columns:1fr auto auto auto;gap:8px;align-items:center;border:1px solid rgba(148,163,184,.12);border-radius:8px;padding:6px 10px;margin-bottom:6px;background:rgba(15,23,42,.4);font-size:.8rem}
        .runo-study-row .nm{cursor:pointer;color:var(--text,#e2e8f0);font-weight:600}
        .runo-study-row .nm:hover{color:#a78bfa}
        .runo-prog{font-size:.72rem;color:var(--muted,#94a3b8)}
        .runo-btn{background:rgba(139,92,246,.15);border:1px solid rgba(139,92,246,.35);color:#c4b5fd;border-radius:6px;padding:3px 9px;font-size:.72rem;cursor:pointer}
        .runo-btn:hover{background:rgba(139,92,246,.3)}
        .runo-btn.ok{background:rgba(34,197,94,.14);border-color:rgba(34,197,94,.4);color:#86efac}
        .runo-btn.rm{background:none;border:none;color:#ef4444;font-size:.8rem}
        .runo-learned{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
        .runo-chip{font-size:.72rem;border:1px solid rgba(148,163,184,.2);border-radius:999px;padding:3px 10px;cursor:pointer;background:rgba(15,23,42,.5);color:var(--text,#e2e8f0)}
        .runo-chip b{color:#a78bfa}
        .runo-chip .runo-conc{font-style:normal;font-size:.66rem;color:#fbbf24;margin-left:4px}
        .runo-chip:hover{border-color:#a78bfa}
        .runo-add-select{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
        .runo-add-select select{flex:1;min-width:180px;background:rgba(15,23,42,.6);border:1px solid rgba(148,163,184,.15);color:var(--text,#e2e8f0);border-radius:6px;padding:5px 8px;font-size:.78rem}
        .runo-lab-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;margin-top:12px;padding:14px;border-radius:12px;
            border:1px solid rgba(139,92,246,.5);background:linear-gradient(135deg,rgba(76,29,149,.5),rgba(30,27,58,.7));
            color:#e9d5ff;font-weight:800;font-size:1rem;letter-spacing:.06em;cursor:pointer;text-transform:uppercase}
        .runo-lab-btn:hover{box-shadow:0 0 18px rgba(139,92,246,.35)}
        .runo-modal-bk{position:fixed;inset:0;background:rgba(2,6,23,.75);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px}
        .runo-modal{width:min(560px,96vw);max-height:88vh;overflow:auto;background:#141327;border:1px solid rgba(139,92,246,.4);border-radius:14px;padding:18px;color:#e2e8f0}
        .runo-modal h3{margin:0 0 4px;display:flex;align-items:center;gap:8px}
        .runo-modal .sub{font-size:.72rem;color:#94a3b8;font-style:italic;margin-bottom:10px}
        .runo-modal table{width:100%;border-collapse:collapse;font-size:.74rem;margin:8px 0}
        .runo-modal th,.runo-modal td{border:1px solid rgba(148,163,184,.15);padding:4px 6px;text-align:left}
        .runo-modal th{background:rgba(139,92,246,.12);color:#c4b5fd}
        .runo-modal .img{float:right;width:86px;height:86px;object-fit:contain;margin:0 0 8px 8px;border-radius:8px;background:rgba(15,23,42,.5);border:1px solid rgba(148,163,184,.15)}
        `;
        document.head.appendChild(s);
    })();

    // =====================================================================
    // RENDERIZAÇÃO PRINCIPAL — chamada por onClassChange()
    // =====================================================================
    /**
     * Garante que exista um container para o módulo de Runomancia.
     * O HTML antigo tinha <div id="runimagoSection"> dentro da aba Combate, mas
     * ele foi removido numa refatoração — por isso o botão "Laboratorium Runarum"
     * (e todo o módulo) deixou de aparecer. Agora criamos dinamicamente uma aba
     * "ᛟ Runomancia" logo APÓS a aba "Notas" (mesmo padrão de mesa-tab.js),
     * contendo a Lista de Estudo e o botão do Laboratorium.
     */
    function _ensureRunoTab() {
        // Já existe (de HTML legado ou criada antes)?
        let sec = document.getElementById('runimagoSection');
        if (sec) return sec;

        const tabBar = document.getElementById('tabBar');
        const sheet = document.querySelector('.sheet');
        if (!tabBar || !sheet) return null;

        const notasBtn = tabBar.querySelector('[data-tab="tabNotas"]');
        const notasContent = document.getElementById('tabNotas');

        // 1) Botão da aba — inserido logo após "Notas"
        let tabBtn = document.getElementById('tabRunomanciaBtn');
        if (!tabBtn) {
            tabBtn = document.createElement('button');
            tabBtn.className = 'tab';
            tabBtn.id = 'tabRunomanciaBtn';
            tabBtn.dataset.tab = 'tabRunomancia';
            tabBtn.textContent = 'ᛟ Runomancia';
            if (notasBtn) notasBtn.after(tabBtn); else tabBar.appendChild(tabBtn);
            // initTabs() já rodou; adicionamos o handler manualmente
            tabBtn.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
                tabBtn.classList.add('active');
                document.getElementById('tabRunomancia')?.classList.add('active');
            });
        }

        // 2) Conteúdo da aba — inserido logo após o conteúdo de "Notas"
        let content = document.getElementById('tabRunomancia');
        if (!content) {
            content = document.createElement('div');
            content.className = 'tab-content';
            content.id = 'tabRunomancia';
            content.innerHTML =
                '<div class="section" id="runimagoSection">' +
                '<div class="section-title">ᛟ Runomancia</div>' +
                '<div id="runimagoContent"></div>' +
                '</div>';
            if (notasContent) notasContent.after(content); else sheet.appendChild(content);
        }
        return document.getElementById('runimagoSection');
    }

    window.renderRunomanciaModule = function (classeNome) {
        const cls = _classDoc(classeNome);
        const usa = !!cls?.usaRunomancia;

        // Classe SEM runomancia: esconde a aba (se existir) e limpa o módulo.
        if (!usa) {
            const tabBtn = document.getElementById('tabRunomanciaBtn');
            const content = document.getElementById('tabRunomancia');
            if (tabBtn) tabBtn.style.display = 'none';
            if (content) {
                content.querySelectorAll('.runo-mod, .runo-lab-btn').forEach(e => e.remove());
                // Se a aba de runomancia estava ativa, volta para Principal
                if (content.classList.contains('active')) {
                    document.querySelectorAll('.tab, .tab-content').forEach(t => t.classList.remove('active'));
                    document.querySelector('[data-tab="tabPrincipal"]')?.classList.add('active');
                    document.getElementById('tabPrincipal')?.classList.add('active');
                }
            }
            return;
        }

        const sec = _ensureRunoTab();
        if (!sec) return;

        // Classe COM runomancia: garante a aba visível
        const tabBtn = document.getElementById('tabRunomanciaBtn');
        if (tabBtn) tabBtn.style.display = '';

        // Remove instância anterior
        sec.querySelectorAll('.runo-mod, .runo-lab-btn').forEach(e => e.remove());
        sec.style.display = '';

        // Classe genérica com Runomancia (≠ Runimago legado): limpa conteúdo
        // legado obsoleto e ajusta o título da seção
        const secTitle = sec.querySelector('.section-title');
        const legacyContent = document.getElementById('runimagoContent');
        if (classeNome !== 'Runimago') {
            if (legacyContent) legacyContent.innerHTML = '';
            if (secTitle) secTitle.textContent = 'ᛟ Runomancia';
        } else if (secTitle) {
            secTitle.textContent = '📜 Recursos do Runimago';
        }

        const cfg = _runoModuleConfig(classeNome) || {
            titulo: 'Lista de Estudo', icone: 'ᛟ',
            runoSlotsBase: 2, runoSlotsPorNivel: 1, runoSlotsDotKey: '',
            runoDescontoDotKey: '', runoDescontoPorNivel: 0, runoCustoExpMult: 1
        };

        const mod = document.createElement('div');
        mod.className = 'runo-mod';
        mod.appendChild(_buildHead(cfg));
        mod.appendChild(_buildBody(cfg));
        sec.appendChild(mod);

        // Botão Laboratorium Runarum — ao final da aba "ᛟ Runomancia" (logo após "Notas")
        const btn = document.createElement('button');
        btn.className = 'runo-lab-btn no-print';
        btn.innerHTML = 'ᛟ&nbsp; Laboratorium Runarum';
        btn.title = 'Abrir a bancada de criação de runas';
        btn.onclick = () => {
            const id = window.currentCharacterId || new URLSearchParams(location.search).get('id') || '';
            window.location.href = `../laboratorium-runarum/laboratorium.html?id=${encodeURIComponent(id)}`;
        };
        sec.appendChild(btn);
    };

    function _buildHead(cfg) {
        const runo = _runoState();
        const total = _slots(cfg);
        const usados = runo.estudos.length;
        const head = document.createElement('div');
        head.className = 'runo-mod-head';
        head.innerHTML = `
            <h4>${cfg.icone || 'ᛟ'} ${cfg.titulo || 'Lista de Estudo'}</h4>
            <span class="runo-slots" id="runoSlotsBadge">Slots: ${usados} / ${total}</span>`;
        return head;
    }

    function _buildBody(cfg) {
        const body = document.createElement('div');
        body.className = 'runo-body';
        body.id = 'runoModBody';
        _renderBody(body, cfg);
        return body;
    }

    function _renderBody(body, cfg) {
        const runo = _runoState();
        const els = _elements();
        body.innerHTML = '';

        if (!els.length) {
            body.innerHTML = '<div style="font-size:.78rem;color:var(--muted)">Nenhum Elemento Rúnico cadastrado. Cadastre-os no Painel do Criador (ᛟ Elementos Rúnicos) ou importe o Compêndio.</div>';
            return;
        }

        // --- Em estudo ---
        const title = document.createElement('div');
        title.style.cssText = 'font-size:.72rem;color:#94a3b8;margin-bottom:4px;font-weight:700;text-transform:uppercase;letter-spacing:.04em';
        title.textContent = '📖 Em estudo (1 momento de estudo por sessão — §11.1)';
        body.appendChild(title);

        if (!runo.estudos.length) {
            const empty = document.createElement('div');
            empty.style.cssText = 'font-size:.76rem;color:var(--muted);padding:6px 2px 10px';
            empty.textContent = 'Nenhum elemento em estudo. Escolha abaixo para ocupar um slot.';
            body.appendChild(empty);
        }

        runo.estudos.forEach((es, idx) => {
            const el = _elById(es.elementId);
            if (!el) return;
            const need = _sessoesNecessarias(el, es.nivelAlvo, cfg);
            const exp = _custoExp(el, es.nivelAlvo, cfg);
            const done = es.sessoesFeitas || 0;
            const row = document.createElement('div');
            row.className = 'runo-study-row';
            row.innerHTML = `
                <span class="nm" title="Ver detalhes">${TIPO_ICON[el.tipoElemento] || 'ᛟ'} ${el.nome} <small style="color:#94a3b8">Nv${es.nivelAlvo}</small></span>
                <span class="runo-prog">Sessões: ${done}/${need} · EXP: ${exp}</span>
                <span>
                    <button class="runo-btn" title="Registrar sessão de estudo (roleplay)">+1 sessão</button>
                    ${done >= need ? `<button class="runo-btn ok" title="Concluir aprendizado gastando ${exp} EXP">✓ Aprender (${exp} EXP)</button>` : ''}
                </span>
                <button class="runo-btn rm" title="Abandonar estudo">✕</button>`;
            row.querySelector('.nm').onclick = () => window.runoOpenElementModal(el.id, es.nivelAlvo);
            const btns = row.querySelectorAll('.runo-btn:not(.rm)');
            btns[0].onclick = () => { es.sessoesFeitas = done + 1; _refresh(cfg); _save(); };
            if (btns[1]) btns[1].onclick = () => _concluirEstudo(idx, cfg);
            row.querySelector('.rm').onclick = () => { if (confirm('Abandonar este estudo? O progresso será perdido.')) { runo.estudos.splice(idx, 1); _refresh(cfg); _save(); } };
            body.appendChild(row);
        });

        // --- Adicionar estudo ---
        const total = _slots(cfg);
        if (runo.estudos.length < total) {
            const add = document.createElement('div');
            add.className = 'runo-add-select no-print';
            const opts = els.map(el => {
                const atual = _nivelEfetivo(el.id);
                const max = el.maxNivel || (el.tipoElemento === 'sigilus' ? 3 : 5);
                if (atual >= max) return '';
                const emEstudo = runo.estudos.some(e => e.elementId === el.id);
                if (emEstudo) return '';
                const alvo = atual + 1;
                const grupo = el.tipoElemento === 'sigilus' ? (CAT_LABEL[el.categoria] || 'Sigilus') : TIPO_LABEL[el.tipoElemento];
                return `<option value="${el.id}">${grupo} · ${el.nome} → Nv${alvo} (${_sessoesNecessarias(el, alvo, cfg)} sessões, ${_custoExp(el, alvo, cfg)} EXP)</option>`;
            }).filter(Boolean).join('');
            add.innerHTML = `
                <select id="runoAddSelect"><option value="">— Adicionar elemento à Lista de Estudo —</option>${opts}</select>
                <button class="runo-btn" id="runoAddBtn">➕ Estudar</button>
                <button class="runo-btn" id="runoBrowseBtn" title="Ver todos os elementos">🔎 Catálogo</button>`;
            body.appendChild(add);
            add.querySelector('#runoAddBtn').onclick = () => {
                const id = add.querySelector('#runoAddSelect').value;
                if (!id) return;
                const el = _elById(id);
                const alvo = _nivelEfetivo(id) + 1;
                runo.estudos.push({ elementId: id, nivelAlvo: alvo, sessoesFeitas: 0 });
                _refresh(cfg); _save();
            };
            add.querySelector('#runoBrowseBtn').onclick = () => window.runoOpenCatalog();
        } else {
            const full = document.createElement('div');
            full.style.cssText = 'font-size:.72rem;color:#f59e0b;margin-top:4px';
            full.textContent = '⚠️ Lista de Estudo cheia — conclua ou abandone um estudo para liberar um slot.';
            body.appendChild(full);
        }

        // --- Aprendidos ---
        const t2 = document.createElement('div');
        t2.style.cssText = 'font-size:.72rem;color:#94a3b8;margin:12px 0 4px;font-weight:700;text-transform:uppercase;letter-spacing:.04em';
        t2.textContent = '✅ Elementos dominados';
        body.appendChild(t2);
        const learned = document.createElement('div');
        learned.className = 'runo-learned';
        // União de estudados + concedidos por mecânicas
        const ids = [...new Set([
            ...Object.keys(runo.aprendidos || {}),
            ...Object.keys(runo.concedidos || {})
        ])].filter(id => _nivelEfetivo(id) > 0);

        if (!ids.length) {
            learned.innerHTML = '<span style="font-size:.74rem;color:var(--muted)">Nenhum ainda — todo Runomago começa do traço zero.</span>';
        } else {
            ids.forEach(id => {
                const el = _elById(id);
                if (!el) return;
                const lv = _nivelEfetivo(id);
                const conc = _nivelConcedido(id);
                const est = _nivelEstudado(id);
                const c = document.createElement('span');
                c.className = 'runo-chip';
                c.innerHTML = `${TIPO_ICON[el.tipoElemento] || 'ᛟ'} ${el.nome} <b>Nv${lv}</b>` +
                    (conc > 0 ? ` <em class="runo-conc" title="${est} de estudo + ${conc} concedido(s) por mecânica">⚙️+${conc}</em>` : '');
                c.onclick = () => window.runoOpenElementModal(id, lv);
                learned.appendChild(c);
            });
        }
        body.appendChild(learned);

        // Legenda das concessões (de onde vieram os níveis automáticos)
        const detalhe = Array.isArray(runo.concedidosDetalhe) ? runo.concedidosDetalhe : [];
        if (detalhe.length) {
            const fontes = [...new Set(detalhe.map(d => d.fonte).filter(Boolean))];
            const leg = document.createElement('div');
            leg.style.cssText = 'font-size:.68rem;color:#c4b5fd;margin-top:6px';
            leg.innerHTML = `⚙️ Níveis concedidos automaticamente por: ${fontes.join(', ') || 'mecânicas'} — não consomem EXP nem slots de estudo.`;
            body.appendChild(leg);
        }
    }

    function _concluirEstudo(idx, cfg) {
        const runo = _runoState();
        const es = runo.estudos[idx];
        const el = _elById(es.elementId);
        if (!el) return;
        const exp = _custoExp(el, es.nivelAlvo, cfg);
        const atual = typeof getCurrentExp === 'function' ? getCurrentExp() : 0;
        if (atual < exp) {
            alert(`EXP insuficiente: aprender ${el.nome} Nv${es.nivelAlvo} custa ${exp} EXP (você tem ${atual}).`);
            return;
        }
        if (!confirm(`Concluir o estudo de ${el.nome} Nv${es.nivelAlvo}?\nCusto: ${exp} EXP.`)) return;
        if (typeof spendExp === 'function') spendExp(exp);
        // Incrementa o nível ESTUDADO em 1. O nível efetivo (estudado +
        // concedido por mecânicas) sobe junto, sem sobrescrever concessões.
        runo.aprendidos[es.elementId] = _nivelEstudado(es.elementId) + 1;
        runo.estudos.splice(idx, 1);
        _refresh(cfg); _save();
    }

    function _refresh(cfg) {
        const body = document.getElementById('runoModBody');
        if (body) _renderBody(body, cfg);
        const badge = document.getElementById('runoSlotsBadge');
        if (badge) badge.textContent = `Slots: ${_runoState().estudos.length} / ${_slots(cfg)}`;
    }
    function _save() { if (typeof scheduleAutosave === 'function') scheduleAutosave(); }

    /**
     * Re-renderiza o módulo após um recálculo de mecânicas, para refletir
     * níveis rúnicos concedidos (state.runomancia.concedidos).
     * Seguro para chamar sempre: não faz nada se a aba não estiver montada.
     */
    window.runoRefreshFromMechanics = function () {
        const body = document.getElementById('runoModBody');
        if (!body) return;
        const classe = document.getElementById('selClasse')?.value || '';
        const cfg = _runoModuleConfig(classe) || {
            titulo: 'Lista de Estudo', icone: 'ᛟ',
            runoSlotsBase: 2, runoSlotsPorNivel: 1, runoSlotsDotKey: '',
            runoDescontoDotKey: '', runoDescontoPorNivel: 0, runoCustoExpMult: 1
        };
        _refresh(cfg);
    };

    // =====================================================================
    // MODAL DE DETALHES DO ELEMENTO
    // =====================================================================
    window.runoOpenElementModal = function (elementId, nivelDestaque) {
        const el = _elById(elementId);
        if (!el) return;
        const classe = document.getElementById('selClasse')?.value || '';
        const cfg = _runoModuleConfig(classe) || {};
        const desconto = _desconto(cfg);
        const runo = _runoState();
        const atual = _nivelEfetivo(el.id);
        const concedido = _nivelConcedido(el.id);
        const estudado = _nivelEstudado(el.id);
        const grupo = el.tipoElemento === 'sigilus'
            ? `Sigilus · ${CAT_LABEL[el.categoria] || ''} · ${el.complexidade || ''}`
            : TIPO_LABEL[el.tipoElemento];

        const rows = (Array.isArray(el.niveis) ? el.niveis : []).map(n => {
            const sess = Math.max(1, (n.sessoesEstudo || 0) - desconto);
            const exp = Math.round((n.custoExp || 0) * (cfg.runoCustoExpMult ?? 1));
            const hl = n.nivel === nivelDestaque ? 'style="background:rgba(139,92,246,.14)"' : '';
            const st = n.nivel <= atual ? '✅' : (n.nivel === atual + 1 ? '🎯' : '');
            return `<tr ${hl}><td>${st} Nv${n.nivel}</td><td>${n.custoEss ?? '—'} Ess</td><td>${exp} EXP</td>
                <td>${sess} sessões${desconto ? ` <small style="color:#86efac">(−${desconto})</small>` : ''}</td>
                <td>${n.propriedades || '—'}</td></tr>`;
        }).join('');

        const bk = document.createElement('div');
        bk.className = 'runo-modal-bk';
        bk.onclick = e => { if (e.target === bk) bk.remove(); };
        bk.innerHTML = `
        <div class="runo-modal">
            ${el.imagemUrl ? `<img class="img" src="${el.imagemUrl}" alt="">` : ''}
            <h3>${TIPO_ICON[el.tipoElemento] || 'ᛟ'} ${el.nome}</h3>
            <div class="sub">${el.nomeLatim ? el.nomeLatim + ' · ' : ''}${grupo}${el.cor ? ' · Essência ' + el.cor : ''}</div>
            <div style="font-size:.8rem;line-height:1.5">${el.descricao || ''}</div>
            ${el.posicaoRegra ? `<div style="font-size:.74rem;margin-top:8px"><b style="color:#c4b5fd">Posição:</b> ${el.posicaoRegra}</div>` : ''}
            ${el.limites ? `<div style="font-size:.74rem;margin-top:4px"><b style="color:#fca5a5">Limites:</b> ${el.limites}</div>` : ''}
            <table><thead><tr><th>Nível</th><th>Custo (CT)</th><th>EXP</th><th>Tempo de Estudo</th><th>Propriedades</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="5">Sem níveis cadastrados.</td></tr>'}</tbody></table>
            <div style="font-size:.68rem;color:#94a3b8">Nível dominado pelo personagem: <b style="color:#a78bfa">${atual || 'nenhum'}</b>${concedido > 0 ? ` <span style="color:#fbbf24">(${estudado} estudado + ${concedido} concedido por mecânica)</span>` : ''}.
                Custos e tempos vêm do cadastro no Painel do Criador; descontos aplicados pela configuração do módulo (Parte XI).</div>
            <div style="text-align:right;margin-top:10px"><button class="runo-btn" onclick="this.closest('.runo-modal-bk').remove()">Fechar</button></div>
        </div>`;
        document.body.appendChild(bk);
    };

    // Catálogo completo (lista clicável de todos os elementos)
    window.runoOpenCatalog = function () {
        const els = _elements();
        const runo = _runoState();
        const groups = {};
        els.forEach(el => {
            const g = el.tipoElemento === 'sigilus' ? `Sigilus — ${CAT_LABEL[el.categoria] || 'Outros'}` : TIPO_LABEL[el.tipoElemento] || 'Outros';
            (groups[g] = groups[g] || []).push(el);
        });
        const bk = document.createElement('div');
        bk.className = 'runo-modal-bk';
        bk.onclick = e => { if (e.target === bk) bk.remove(); };
        bk.innerHTML = `<div class="runo-modal"><h3>ᛟ Catálogo de Elementos Rúnicos</h3>
            <div class="sub">${els.length} elementos cadastrados — clique para ver custos de EXP e tempo de estudo</div>
            ${Object.entries(groups).map(([g, list]) => `
                <div style="font-size:.72rem;color:#c4b5fd;font-weight:700;margin:10px 0 4px;text-transform:uppercase">${g}</div>
                <div class="runo-learned">${list.map(el => {
            const lv = _nivelEfetivo(el.id);
            const conc = _nivelConcedido(el.id);
            return `<span class="runo-chip" onclick="runoOpenElementModal('${el.id}')">${el.nome}${lv ? ` <b>Nv${lv}</b>` : ''}${conc ? ` <em class="runo-conc">⚙️+${conc}</em>` : ''}</span>`;
        }).join('')}</div>`).join('')}
            <div style="text-align:right;margin-top:10px"><button class="runo-btn" onclick="this.closest('.runo-modal-bk').remove()">Fechar</button></div>
        </div>`;
        document.body.appendChild(bk);
    };
})();
