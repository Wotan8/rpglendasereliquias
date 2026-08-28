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
        .runo-mod{border:1px solid rgba(139,92,246,.25);border-radius:12px;background:var(--lr-abyssal-soft);margin-top:14px;overflow:hidden}
        .runo-mod-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px;background:linear-gradient(90deg,rgba(139,92,246,.14),transparent);border-bottom:1px solid rgba(139,92,246,.2)}
        .runo-mod-head h4{margin:0;font-size:.9rem;color:var(--text,#e2e8f0)}
        .runo-slots{font-size:.75rem;color:var(--lr-abyssal);background:rgba(139,92,246,.16);padding:2px 10px;border-radius:999px}
        .runo-body{padding:10px}
        .runo-study-row{display:grid;grid-template-columns:1fr auto auto auto;gap:8px;align-items:center;border:1px solid rgba(148,163,184,.12);border-radius:8px;padding:6px 10px;margin-bottom:6px;background:var(--lr-bg-1);font-size:.8rem}
        .runo-study-row .nm{cursor:pointer;color:var(--text,#e2e8f0);font-weight:600}
        .runo-study-row .nm:hover{color:var(--lr-abyssal)}
        .runo-prog{font-size:.72rem;color:var(--muted,#94a3b8)}
        .runo-btn{background:rgba(139,92,246,.15);border:1px solid rgba(139,92,246,.35);color:var(--lr-abyssal);border-radius:6px;padding:3px 9px;font-size:.72rem;cursor:pointer}
        .runo-btn:hover{background:rgba(139,92,246,.3)}
        .runo-btn.ok{background:rgba(34,197,94,.14);border-color:rgba(34,197,94,.4);color:#86efac}
        .runo-btn.rm{background:none;border:none;color:#ef4444;font-size:.8rem}
        .runo-learned{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
        .runo-chip{font-size:.72rem;border:1px solid rgba(148,163,184,.2);border-radius:999px;padding:3px 10px;cursor:pointer;background:var(--lr-bg-1);color:var(--text,#e2e8f0)}
        .runo-chip b{color:var(--lr-abyssal)}
        .runo-chip .runo-conc{font-style:normal;font-size:.66rem;color:#fbbf24;margin-left:4px}
        .runo-chip:hover{border-color:var(--lr-abyssal)}
        .runo-search{position:relative;margin-top:8px}
        .runo-search-bar{display:flex;gap:6px;align-items:center;flex-wrap:wrap}
        .runo-search-in{flex:1;min-width:200px;background:var(--lr-bg-1);border:1px solid rgba(148,163,184,.15);color:var(--text,#e2e8f0);border-radius:6px;padding:6px 10px;font-size:.78rem}
        .runo-search-in:focus{outline:none;border-color:rgba(139,92,246,.55);box-shadow:0 0 0 2px rgba(139,92,246,.15)}
        .runo-filters{display:flex;gap:4px;flex-wrap:wrap;margin-top:6px}
        .runo-fchip{font-size:.68rem;border:1px solid rgba(148,163,184,.2);border-radius:999px;padding:2px 9px;cursor:pointer;color:var(--lr-text-2);background:var(--lr-bg-1);user-select:none}
        .runo-fchip:hover{border-color:rgba(139,92,246,.45)}
        .runo-fchip.on{border-color:rgba(139,92,246,.6);background:rgba(139,92,246,.18);color:#e9d5ff}
        /* A lista mora no <body> e é fixed: dentro do módulo ela era cortada
           pelo overflow:hidden do cartão. Posição calculada na abertura. */
        .runo-pop{position:fixed;box-sizing:border-box;z-index:8500;max-height:min(320px,45vh);overflow:auto;background:#141327;border:1px solid rgba(139,92,246,.35);border-radius:10px;box-shadow:0 12px 30px rgba(2,6,23,.6);padding:4px}
        .runo-pop[hidden]{display:none}
        .runo-grp{position:sticky;top:0;background:#141327;font-size:.64rem;letter-spacing:.06em;text-transform:uppercase;color:var(--lr-abyssal);font-weight:700;padding:6px 8px 3px}
        .runo-opt{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:5px 8px;border-radius:7px;cursor:pointer;font-size:.78rem;color:var(--text,#e2e8f0)}
        .runo-opt:hover,.runo-opt.hl{background:rgba(139,92,246,.18)}
        .runo-opt .lat{font-size:.66rem;color:var(--lr-text-2);font-style:italic;margin-left:4px}
        .runo-opt .cost{font-size:.68rem;color:var(--lr-text-2);white-space:nowrap}
        .runo-opt mark,.runo-chip mark{background:rgba(139,92,246,.35);color:#e9d5ff;border-radius:3px;padding:0 1px}
        .runo-opt.off{opacity:.45;cursor:not-allowed}
        .runo-opt.off:hover{background:none}
        .runo-opt .tag{font-size:.62rem;border:1px solid rgba(148,163,184,.25);border-radius:999px;padding:1px 6px;color:var(--lr-text-2);white-space:nowrap}
        .runo-pop-empty{font-size:.74rem;color:var(--muted,#94a3b8);padding:10px}
        .runo-sel{font-size:.72rem;color:var(--lr-text-2);margin-top:6px;min-height:1em}
        .runo-link{color:var(--lr-abyssal);text-decoration:underline;cursor:pointer}
        .runo-cat-bar{position:sticky;top:-18px;z-index:2;background:#141327;padding:8px 0 6px;margin-bottom:2px;box-shadow:0 6px 10px -8px rgba(2,6,23,.9)}
        .runo-cat-bar .runo-search-in{width:100%;box-sizing:border-box}
        .runo-cat-grp{font-size:.72rem;color:var(--lr-abyssal);font-weight:700;margin:10px 0 4px;text-transform:uppercase}
        .runo-cat-n{font-size:.64rem;color:var(--lr-text-2);font-weight:600}
        .runo-cat-rodape{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px;font-size:.7rem;color:var(--lr-text-2)}
        .runo-btn:disabled{opacity:.45;cursor:not-allowed}
        .runo-lab-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;margin-top:12px;padding:14px;border-radius:12px;
            border:1px solid rgba(139,92,246,.5);background:linear-gradient(135deg,var(--lr-abyssal-soft),var(--lr-abyssal-soft));
            color:#e9d5ff;font-weight:800;font-size:1rem;letter-spacing:.06em;cursor:pointer;text-transform:uppercase}
        .runo-lab-btn:hover{box-shadow:0 0 18px rgba(139,92,246,.35)}
        .runo-modal-bk{position:fixed;inset:0;background:rgba(2,6,23,.75);z-index:9000;display:flex;align-items:center;justify-content:center;padding:16px}
        .runo-modal{width:min(560px,96vw);max-height:88vh;overflow:auto;background:#141327;border:1px solid rgba(139,92,246,.4);border-radius:14px;padding:18px;color:#e2e8f0}
        .runo-modal h3{margin:0 0 4px;display:flex;align-items:center;gap:8px}
        .runo-modal .sub{font-size:.72rem;color:var(--lr-text-2);font-style:italic;margin-bottom:10px}
        .runo-modal table{width:100%;border-collapse:collapse;font-size:.74rem;margin:8px 0}
        .runo-modal th,.runo-modal td{border:1px solid rgba(148,163,184,.15);padding:4px 6px;text-align:left}
        .runo-modal th{background:rgba(139,92,246,.12);color:var(--lr-abyssal)}
        .runo-modal .img{float:right;width:86px;height:86px;object-fit:contain;margin:0 0 8px 8px;border-radius:8px;background:var(--lr-bg-1);border:1px solid rgba(148,163,184,.15)}
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
        title.style.cssText = 'font-size:.72rem;color:var(--lr-text-2);margin-bottom:4px;font-weight:700;text-transform:uppercase;letter-spacing:.04em';
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
            const restante = Math.max(0, need - done);
            const metade = Math.floor(restante / 2);
            /* O botão caro leva o estudo ATÉ FALTAR 1 sessão — não acelera uma
               sessão. Com 4 restando ele queima 3. A última sessão nunca é
               comprável: sempre sobra uma de bancada de verdade. */
            const ateUma = Math.max(0, restante - 1);
            const pl = n => `${n} sess${n === 1 ? 'ão' : 'ões'}`;
            row.innerHTML = `
                <span class="nm" title="Ver detalhes">${TIPO_ICON[el.tipoElemento] || 'ᛟ'} ${el.nome} <small style="color:var(--lr-text-2)">Nv${es.nivelAlvo}</small></span>
                <span class="runo-prog">Sessões: ${done}/${need} · EXP: ${exp}</span>
                <span>
                    ${_podeSomarSessao() ? '<button class="runo-btn add" title="Registrar sessão de estudo (Mestre, Criador ou personagem avulso)">+1 sessão</button>' : ''}
                    ${metade >= 1 ? `<button class="runo-btn ace" data-n="${metade}" data-exp="${exp * 2}" title="Queima ${pl(metade)} das ${restante} que faltam, por ${exp * 2} EXP">⏩ ${pl(metade)} (${exp * 2} EXP)</button>` : ''}
                    ${ateUma > metade ? `<button class="runo-btn ace1" data-n="${ateUma}" data-exp="${exp * 4}" title="Queima ${pl(ateUma)} das ${restante} que faltam e deixa faltando 1, por ${exp * 4} EXP">⏩ ${pl(ateUma)} · resta 1 (${exp * 4} EXP)</button>` : ''}
                    ${done >= need ? `<button class="runo-btn ok" title="Concluir aprendizado gastando ${exp} EXP">✓ Aprender (${exp} EXP)</button>` : ''}
                </span>
                <button class="runo-btn rm" title="Abandonar estudo">✕</button>`;
            row.querySelector('.nm').onclick = () => window.runoOpenElementModal(el.id, es.nivelAlvo);
            const bAdd = row.querySelector('.runo-btn.add');
            if (bAdd) bAdd.onclick = () => { es.sessoesFeitas = done + 1; _refresh(cfg); _save(); };
            const bAce = row.querySelector('.runo-btn.ace');
            if (bAce) bAce.onclick = () => _acelerar(idx, +bAce.dataset.n, +bAce.dataset.exp, cfg);
            const bAce1 = row.querySelector('.runo-btn.ace1');
            if (bAce1) bAce1.onclick = () => _acelerar(idx, +bAce1.dataset.n, +bAce1.dataset.exp, cfg);
            const bOk = row.querySelector('.runo-btn.ok');
            if (bOk) bOk.onclick = () => _concluirEstudo(idx, cfg);
            row.querySelector('.rm').onclick = async () => {
                if (!await LRDialogo.confirmar('O progresso deste estudo será perdido.',
                    { titulo: 'Abandonar estudo?', ok: 'Abandonar', perigo: true })) return;
                runo.estudos.splice(idx, 1); _refresh(cfg); _save();
            };
            body.appendChild(row);
        });

        // --- Adicionar estudo ---
        const total = _slots(cfg);
        if (runo.estudos.length < total) {
            body.appendChild(_buildBuscaEstudo(runo, els, cfg));
        } else {
            const full = document.createElement('div');
            full.style.cssText = 'font-size:.72rem;color:var(--lr-gold);margin-top:4px';
            full.textContent = '⚠️ Lista de Estudo cheia — conclua ou abandone um estudo para liberar um slot.';
            body.appendChild(full);
        }

        // --- Aprendidos ---
        const t2 = document.createElement('div');
        t2.style.cssText = 'font-size:.72rem;color:var(--lr-text-2);margin:12px 0 4px;font-weight:700;text-transform:uppercase;letter-spacing:.04em';
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
            leg.style.cssText = 'font-size:.68rem;color:var(--lr-abyssal);margin-top:6px';
            leg.innerHTML = `⚙️ Níveis concedidos automaticamente por: ${fontes.join(', ') || 'mecânicas'} — não consomem EXP nem slots de estudo.`;
            body.appendChild(leg);
        }
    }

    // =====================================================================
    // BUSCA DE ELEMENTOS PARA A LISTA DE ESTUDO
    // =====================================================================

    /** Sem acento e em minúsculas: "sifao" acha "Sifão". */
    function _norm(s) {
        return (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    }
    function _esc(s) {
        return (s || '').toString().replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }

    /** Grifa no texto original os trechos que casaram com a busca. */
    function _grifar(texto, tokens) {
        texto = (texto || '').toString();
        if (!tokens.length) return _esc(texto);
        const alvo = _norm(texto);
        const faixas = [];
        tokens.forEach(t => {
            let i = alvo.indexOf(t);
            while (i >= 0) { faixas.push([i, i + t.length]); i = alvo.indexOf(t, i + t.length); }
        });
        if (!faixas.length) return _esc(texto);
        faixas.sort((a, b) => a[0] - b[0]);
        let out = '', cur = 0;
        faixas.forEach(([a, b]) => {
            if (b <= cur) return;
            a = Math.max(a, cur);
            out += _esc(texto.slice(cur, a)) + '<mark>' + _esc(texto.slice(a, b)) + '</mark>';
            cur = b;
        });
        return out + _esc(texto.slice(cur));
    }

    /** Peso do casamento: nome pelo começo > nome > latim > resto do verbete. */
    function _score(el, tokens) {
        if (!tokens.length) return 0;
        const nome = _norm(el.nome);
        if (tokens.every(t => nome.includes(t))) return tokens.some(t => nome.startsWith(t)) ? 3 : 2;
        const latim = _norm(el.nomeLatim);
        if (tokens.every(t => (nome + ' ' + latim).includes(t))) return 1;
        return 0;
    }

    /** Tudo que a busca varre num elemento, já normalizado. */
    function _palheiro(el, grupo) {
        return _norm([el.nome, el.nomeLatim, grupo, TIPO_LABEL[el.tipoElemento],
            CAT_LABEL[el.categoria], el.complexidade, el.cor, el.descricao]
            .filter(Boolean).join(' '));
    }

    /** Grupo de exibição: Sigilus abre por categoria; o resto vai pelo tipo. */
    function _grupoDe(el, sep) {
        return el.tipoElemento === 'sigilus'
            ? `Sigilus ${sep} ${CAT_LABEL[el.categoria] || 'Outros'}`
            : (TIPO_LABEL[el.tipoElemento] || 'Outros');
    }

    /**
     * Campo de busca da Lista de Estudo. O <select> antigo empilhava dezenas
     * de elementos numa lista rolante única: para achar um Sigilus a pessoa
     * tinha que varrer tudo com o olho. Aqui ela digita ("sifao", "sigilus",
     * "captador", "vermelha") e a lista filtra na hora — agrupada por tipo,
     * com o custo do próximo nível à direita e seta/Enter no teclado.
     *
     * Elementos que não podem entrar (já em estudo, nível máximo) continuam
     * aparecendo, apagados e com o motivo: sumir sem explicação faz a pessoa
     * procurar de novo achando que digitou errado.
     */
    function _buildBuscaEstudo(runo, els, cfg) {
        const wrap = document.createElement('div');
        wrap.className = 'runo-search no-print';

        const cands = els.map(el => {
            const atual = _nivelEfetivo(el.id);
            const max = el.maxNivel || (el.tipoElemento === 'sigilus' ? 3 : 5);
            const alvo = Math.min(atual + 1, max);
            const emEstudo = runo.estudos.some(e => e.elementId === el.id);
            const grupo = _grupoDe(el, '·');
            return {
                el, atual, alvo, grupo,
                bloqueio: emEstudo ? 'já em estudo' : (atual >= max ? `nível máximo (Nv${max})` : ''),
                sess: _sessoesNecessarias(el, alvo, cfg),
                exp: _custoExp(el, alvo, cfg),
                hay: _palheiro(el, grupo)
            };
        });

        const tipos = [...new Set(cands.map(c => c.el.tipoElemento).filter(Boolean))];
        let filtro = '';    // tipoElemento ativo ('' = todos)
        let sel = null;     // candidato escolhido
        let hl = -1;        // índice destacado pelo teclado
        let visiveis = [];  // candidatos livres na ordem renderizada

        wrap.innerHTML = `
            <div class="runo-search-bar">
                <input id="runoBuscaIn" class="runo-search-in" type="text" autocomplete="off" spellcheck="false"
                       placeholder="🔎 Buscar elemento por nome, tipo ou categoria…">
                <button class="runo-btn" id="runoAddBtn" disabled>➕ Estudar</button>
                <button class="runo-btn" id="runoBrowseBtn" title="Ver todos os elementos">📖 Catálogo</button>
            </div>
            ${tipos.length > 1 ? `<div class="runo-filters">
                <span class="runo-fchip on" data-t="">Todos</span>
                ${tipos.map(t => `<span class="runo-fchip" data-t="${t}">${TIPO_ICON[t] || 'ᛟ'} ${TIPO_LABEL[t] || t}</span>`).join('')}
            </div>` : ''}
            <div class="runo-sel" id="runoBuscaSel"></div>`;

        const input = wrap.querySelector('#runoBuscaIn');
        // A lista de resultados vive no <body>, não dentro do módulo: o cartão
        // da Runomancia tem overflow:hidden e cortava a lista na borda de baixo.
        document.getElementById('runoBuscaPop')?.remove();
        const pop = document.createElement('div');
        pop.className = 'runo-pop';
        pop.id = 'runoBuscaPop';
        pop.hidden = true;
        document.body.appendChild(pop);
        const btn = wrap.querySelector('#runoAddBtn');
        const selInfo = wrap.querySelector('#runoBuscaSel');

        function _destacar() {
            pop.querySelectorAll('.runo-opt.hl').forEach(n => n.classList.remove('hl'));
            if (hl < 0) return;
            const n = pop.querySelector(`.runo-opt[data-i="${hl}"]`);
            if (n) { n.classList.add('hl'); n.scrollIntoView({ block: 'nearest' }); }
        }

        function _pintar() {
            const tokens = _norm(input.value).split(/\s+/).filter(Boolean);
            const lista = cands.filter(c =>
                (!filtro || c.el.tipoElemento === filtro) &&
                tokens.every(t => c.hay.includes(t)));
            visiveis = [];

            if (!lista.length) {
                pop.innerHTML = `<div class="runo-pop-empty">Nenhum elemento casa com “${_esc(input.value)}”.</div>`;
                hl = -1;
                return;
            }

            // Quem casou pelo NOME vem antes de quem casou só pelo tipo ou pela
            // descrição — digitar "si" tem que mostrar Sifão antes de todo
            // Sigilus do compêndio. O agrupamento sobrevive: ordenamos os
            // grupos pelo melhor casamento que cada um tem dentro.
            const porGrupo = new Map();
            lista.filter(c => !c.bloqueio).forEach(c => {
                const g = porGrupo.get(c.grupo) || { best: -1, itens: [] };
                const s = _score(c.el, tokens);
                g.best = Math.max(g.best, s);
                g.itens.push({ c, s });
                porGrupo.set(c.grupo, g);
            });

            let html = '';
            [...porGrupo.entries()].sort((a, b) => b[1].best - a[1].best).forEach(([grupo, info]) => {
                html += `<div class="runo-grp">${_esc(grupo)}</div>`;
                info.itens.sort((a, b) => b.s - a.s).forEach(({ c }) => {
                    const i = visiveis.push(c) - 1;
                    html += `<div class="runo-opt" data-i="${i}">
                    <span>${TIPO_ICON[c.el.tipoElemento] || 'ᛟ'} ${_grifar(c.el.nome, tokens)}${c.el.nomeLatim ? `<span class="lat">${_grifar(c.el.nomeLatim, tokens)}</span>` : ''}
                        <small style="color:var(--lr-text-2)">${c.atual ? `Nv${c.atual} → ` : ''}Nv${c.alvo}</small></span>
                    <span class="cost">${c.sess} sess · ${c.exp} EXP</span>
                </div>`;
                });
            });

            const presos = lista.filter(c => c.bloqueio);
            if (presos.length) {
                html += '<div class="runo-grp">Indisponíveis</div>';
                presos.forEach(c => {
                    html += `<div class="runo-opt off" title="${_esc(c.bloqueio)}">
                        <span>${TIPO_ICON[c.el.tipoElemento] || 'ᛟ'} ${_grifar(c.el.nome, tokens)}</span>
                        <span class="tag">${_esc(c.bloqueio)}</span></div>`;
                });
            }

            pop.innerHTML = html;
            hl = (tokens.length && visiveis.length) ? 0 : -1;
            _destacar();
            _posicionar();   // a lista encolheu ou cresceu: refaz a conta do espaço
        }

        /**
         * Cola a lista embaixo do campo. Se não couber para baixo — campo perto
         * do rodapé da janela —, abre para cima; a altura máxima é o espaço que
         * sobrar, para nunca vazar da tela.
         */
        function _posicionar() {
            if (pop.hidden) return;
            const r = input.getBoundingClientRect();
            // clientHeight, e não innerHeight: é a mesma altura contra a qual o
            // position:fixed resolve, e ela desconta a barra de rolagem.
            const vh = document.documentElement.clientHeight || window.innerHeight;
            const folgaAbaixo = vh - r.bottom - 8;
            const folgaAcima = r.top - 8;
            const paraCima = folgaAbaixo < 180 && folgaAcima > folgaAbaixo;
            const espaco = Math.max(120, Math.min(320, paraCima ? folgaAcima : folgaAbaixo));
            pop.style.left = `${r.left}px`;
            pop.style.width = `${r.width}px`;
            pop.style.maxHeight = `${espaco}px`;
            if (paraCima) {
                pop.style.top = 'auto';
                pop.style.bottom = `${vh - r.top + 4}px`;
            } else {
                pop.style.bottom = 'auto';
                pop.style.top = `${r.bottom + 4}px`;
            }
        }

        function _abrir() {
            _pintar();
            pop.hidden = false;
            _posicionar();
            window.addEventListener('scroll', _posicionar, true);
            window.addEventListener('resize', _posicionar);
        }
        function _fechar() {
            pop.hidden = true;
            window.removeEventListener('scroll', _posicionar, true);
            window.removeEventListener('resize', _posicionar);
        }

        function _limparEscolha() {
            sel = null;
            btn.disabled = true;
            selInfo.textContent = '';
        }

        function _escolher(c) {
            sel = c;
            input.value = c.el.nome;
            btn.disabled = false;
            selInfo.innerHTML = `Selecionado: <b style="color:var(--lr-abyssal)">${_esc(c.el.nome)} → Nv${c.alvo}</b> — ${c.sess} sessões, ${c.exp} EXP · <span class="runo-link">ver detalhes</span>`;
            selInfo.querySelector('.runo-link').onclick = () => window.runoOpenElementModal(c.el.id, c.alvo);
            _fechar();
        }

        function _estudar() {
            if (!sel) { input.focus(); return; }
            _fechar(); pop.remove();   // o módulo vai ser redesenhado; a lista não pode ficar órfã
            runo.estudos.push({ elementId: sel.el.id, nivelAlvo: sel.alvo, sessoesFeitas: 0 });
            _refresh(cfg); _save();
        }

        input.addEventListener('input', () => { _limparEscolha(); _abrir(); });
        input.addEventListener('focus', _abrir);
        input.addEventListener('keydown', e => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                if (pop.hidden) { _abrir(); if (hl < 0 && visiveis.length) { hl = 0; _destacar(); return; } }
                if (!visiveis.length) return;
                hl = e.key === 'ArrowDown'
                    ? (hl + 1) % visiveis.length
                    : (hl <= 0 ? visiveis.length - 1 : hl - 1);
                _destacar();
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (!pop.hidden && hl >= 0 && visiveis[hl]) _escolher(visiveis[hl]);
                else if (sel) _estudar();
            } else if (e.key === 'Escape') {
                if (!pop.hidden) { e.stopPropagation(); _fechar(); }
            }
        });

        pop.addEventListener('mousedown', e => e.preventDefault()); // não rouba o foco do campo
        pop.addEventListener('click', e => {
            const opt = e.target.closest('.runo-opt');
            if (!opt || opt.classList.contains('off')) return;
            const c = visiveis[+opt.dataset.i];
            if (c) _escolher(c);
        });

        wrap.querySelectorAll('.runo-fchip').forEach(chip => {
            chip.onclick = () => {
                filtro = chip.dataset.t || '';
                wrap.querySelectorAll('.runo-fchip').forEach(c => c.classList.toggle('on', c === chip));
                input.focus(); _abrir();
            };
        });

        btn.onclick = _estudar;
        wrap.querySelector('#runoBrowseBtn').onclick = () => window.runoOpenCatalog();

        // Clique fora fecha a lista. O listener se remove sozinho quando o
        // módulo é re-renderizado e este wrap sai do DOM.
        const onDoc = e => {
            if (!wrap.isConnected) {
                document.removeEventListener('click', onDoc, true);
                _fechar(); pop.remove();   // a lista mora no body: sai junto com o módulo
                return;
            }
            if (!wrap.contains(e.target) && !pop.contains(e.target)) _fechar();
        };
        document.addEventListener('click', onDoc, true);

        return wrap;
    }

    /**
     * Quem pode somar sessão à mão. O progresso do estudo é do MESTRE — ele
     * decide, ao fechar a sessão, quem estudou. O jogador não avança sozinho.
     * Exceção: personagem avulso (sem mesa) não tem mestre para marcar.
     */
    /** Mestre/Criador concede sem cobrar, igual ao resto da ficha. */
    function _podeConcederDeGraca() {
        return typeof podeGastarDeGraca === 'function' && podeGastarDeGraca();
    }

    /** Cobra do Restante, ou registra a concessão do mestre no Total. */
    function _cobrar(custo, comExp) {
        if (comExp) { if (typeof spendExp === 'function') spendExp(custo); }
        else if (typeof concederSemGastar === 'function') concederSemGastar(custo);
    }

    function _podeSomarSessao() {
        if (window.isMestre || window.isCreator) return true;
        const semMesa = !(window.state?.mesaId || window.currentMesaId);
        return semMesa;
    }

    /**
     * Acelera o estudo queimando EXP. Duas ofertas, e a diferença de preço é
     * de propósito: cortar METADE do que falta sai por 2× o custo de aprender;
     * cortar UMA sessão sai por 4×. Quem tem muito caminho pela frente compra
     * no atacado; quem está a uma sessão do fim paga caro pela pressa — é lá
     * que a metade arredonda para zero e o botão caro é a única saída.
     *
     * Acelerar NÃO substitui o aprendizado: ao completar as sessões, o custo
     * normal continua sendo cobrado, como sempre foi.
     */
    function _acelerar(idx, sessoes, custo, cfg) {
        const runo = _runoState();
        const es = runo.estudos[idx];
        const el = _elById(es?.elementId);
        if (!el || sessoes < 1) return;
        const need = _sessoesNecessarias(el, es.nivelAlvo, cfg);
        const done = es.sessoesFeitas || 0;
        const real = Math.min(sessoes, Math.max(0, need - done));
        if (real < 1) return;
        const sobra = Math.max(0, need - done - real);
        const plural = n => `${n} sess${n === 1 ? 'ão' : 'ões'}`;

        // Mesmo toast do resto da ficha: mestre/criador escolhe se paga, e o
        // custo concedido entra no EXP Total em vez de sair do Restante.
        const atual = typeof getCurrentExp === 'function' ? getCurrentExp() : 0;
        const semExp = custo > atual;
        if (semExp && !_podeConcederDeGraca()) {
            showUpgradeBlocked(`EXP insuficiente: adiantar ${plural(real)} custa ${custo} EXP (você tem ${atual}).`);
            return;
        }

        const restante = sobra === 0
            ? 'depois disso o estudo fica pronto para concluir'
            : `depois disso ainda ${sobra === 1 ? 'falta' : 'faltam'} ${plural(sobra)}`;

        showUpgradeConfirm(el.nome, es.nivelAlvo, custo, (comExp) => {
            _cobrar(custo, comExp);
            es.sessoesFeitas = done + real;
            es.aceleradas = (es.aceleradas || 0) + real;
            _refresh(cfg); _save();
            const efeito = comExp ? `-${custo} EXP` : `🛡️ concedido pelo mestre · +${custo} no EXP Total`;
            showExpToast(`⏩ ${el.nome} Nv${es.nivelAlvo}: ${plural(real)} adiantada(s)! (${efeito})`, 'success');
            setTimeout(dismissExpToast, 2000);
        }, {
            semExp,
            mensagem: `⏩ Adiantar ${plural(real)} de ${el.nome} Nv${es.nivelAlvo} — ${restante}.`
                + ` Aprender ainda custará ${_custoExp(el, es.nivelAlvo, cfg)} EXP ao concluir.`
        });
    }

    function _concluirEstudo(idx, cfg) {
        const runo = _runoState();
        const es = runo.estudos[idx];
        const el = _elById(es.elementId);
        if (!el) return;
        const exp = _custoExp(el, es.nivelAlvo, cfg);
        const atual = typeof getCurrentExp === 'function' ? getCurrentExp() : 0;
        const semExp = exp > atual;
        if (semExp && !_podeConcederDeGraca()) {
            showUpgradeBlocked(`EXP insuficiente: aprender ${el.nome} Nv${es.nivelAlvo} custa ${exp} EXP (você tem ${atual}).`);
            return;
        }

        showUpgradeConfirm(el.nome, es.nivelAlvo, exp, (comExp) => {
            _cobrar(exp, comExp);
            // Incrementa o nível ESTUDADO em 1. O nível efetivo (estudado +
            // concedido por mecânicas) sobe junto, sem sobrescrever concessões.
            runo.aprendidos[es.elementId] = _nivelEstudado(es.elementId) + 1;
            runo.estudos.splice(idx, 1);
            _refresh(cfg); _save();
            showUpgradeSuccess(el.nome, es.nivelAlvo, exp, comExp);
        }, { semExp, mensagem: `📖 Concluir o estudo de ${el.nome} → Nível ${es.nivelAlvo}?` });
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
    // MODAIS
    // =====================================================================

    /**
     * Fecha o modal com Esc — e só o do topo. Com o detalhe de um elemento
     * aberto por cima do catálogo, o primeiro Esc tira o detalhe e o segundo
     * tira o catálogo. Devolve a função de fechar, que também tira o listener.
     */
    function _fecharComEsc(bk) {
        function onKey(e) {
            if (e.key !== 'Escape') return;
            const abertos = [...document.querySelectorAll('.runo-modal-bk')];
            if (abertos[abertos.length - 1] !== bk) return;
            e.stopPropagation();
            fechar();
        }
        function fechar() {
            document.removeEventListener('keydown', onKey, true);
            bk.remove();
        }
        document.addEventListener('keydown', onKey, true);
        return fechar;
    }

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
                <td>${sess} sessões${desconto ? ` <small style="color:var(--lr-nature)">(−${desconto})</small>` : ''}</td>
                <td>${n.propriedades || '—'}</td></tr>`;
        }).join('');

        const bk = document.createElement('div');
        bk.className = 'runo-modal-bk';
        const fechar = _fecharComEsc(bk);
        bk.onclick = e => { if (e.target === bk) fechar(); };
        bk.innerHTML = `
        <div class="runo-modal">
            ${el.imagemUrl ? `<img class="img" src="${el.imagemUrl}" alt="">` : ''}
            <h3>${TIPO_ICON[el.tipoElemento] || 'ᛟ'} ${el.nome}</h3>
            <div class="sub">${el.nomeLatim ? el.nomeLatim + ' · ' : ''}${grupo}${el.cor ? ' · Essência ' + el.cor : ''}</div>
            <div style="font-size:.8rem;line-height:1.5">${el.descricao || ''}</div>
            ${el.posicaoRegra ? `<div style="font-size:.74rem;margin-top:8px"><b style="color:var(--lr-abyssal)">Posição:</b> ${el.posicaoRegra}</div>` : ''}
            ${el.limites ? `<div style="font-size:.74rem;margin-top:4px"><b style="color:var(--lr-blood-2)">Limites:</b> ${el.limites}</div>` : ''}
            <table><thead><tr><th>Nível</th><th>Custo (CT)</th><th>EXP</th><th>Tempo de Estudo</th><th>Propriedades</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="5">Sem níveis cadastrados.</td></tr>'}</tbody></table>
            <div style="font-size:.68rem;color:var(--lr-text-2)">Nível dominado pelo personagem: <b style="color:var(--lr-abyssal)">${atual || 'nenhum'}</b>${concedido > 0 ? ` <span style="color:var(--lr-gold)">(${estudado} estudado + ${concedido} concedido por mecânica)</span>` : ''}.
                Custos e tempos vêm do cadastro no Painel do Criador; descontos aplicados pela configuração do módulo (Parte XI).</div>
            <div style="text-align:right;margin-top:10px"><button class="runo-btn" id="runoElFechar">Fechar</button></div>
        </div>`;
        bk.querySelector('#runoElFechar').onclick = fechar;
        document.body.appendChild(bk);
    };

    // Catálogo completo (lista clicável de todos os elementos), com a mesma
    // busca da Lista de Estudo: digita e filtra na hora, sem acento, por nome,
    // tipo, categoria, cor ou descrição — e com o casamento grifado.
    window.runoOpenCatalog = function () {
        const els = _elements();
        const itens = els.map(el => {
            const grupo = _grupoDe(el, '—');
            return { el, grupo, hay: _palheiro(el, grupo) };
        });
        const tipos = [...new Set(els.map(e => e.tipoElemento).filter(Boolean))];
        let filtro = '';

        const bk = document.createElement('div');
        bk.className = 'runo-modal-bk';
        bk.innerHTML = `<div class="runo-modal">
            <h3>ᛟ Catálogo de Elementos Rúnicos</h3>
            <div class="sub">${els.length} elementos cadastrados — clique para ver custos de EXP e tempo de estudo</div>
            <div class="runo-cat-bar">
                <input id="runoCatIn" class="runo-search-in" type="text" autocomplete="off" spellcheck="false"
                       placeholder="🔎 Buscar por nome, tipo, categoria ou descrição…">
                ${tipos.length > 1 ? `<div class="runo-filters">
                    <span class="runo-fchip on" data-t="">Todos</span>
                    ${tipos.map(t => `<span class="runo-fchip" data-t="${t}">${TIPO_ICON[t] || 'ᛟ'} ${TIPO_LABEL[t] || t}</span>`).join('')}
                </div>` : ''}
            </div>
            <div id="runoCatLista"></div>
            <div class="runo-cat-rodape">
                <span id="runoCatCont"></span>
                <button class="runo-btn" id="runoCatFechar">Fechar</button>
            </div>
        </div>`;

        const input = bk.querySelector('#runoCatIn');
        const lista = bk.querySelector('#runoCatLista');
        const cont = bk.querySelector('#runoCatCont');
        let achados = [];

        function _pintarCat() {
            const tokens = _norm(input.value).split(/\s+/).filter(Boolean);
            achados = itens.filter(it =>
                (!filtro || it.el.tipoElemento === filtro) &&
                tokens.every(t => it.hay.includes(t)));

            cont.textContent = achados.length === els.length
                ? `${els.length} elementos`
                : `${achados.length} de ${els.length} elementos`;

            if (!achados.length) {
                lista.innerHTML = `<div class="runo-pop-empty">Nenhum elemento casa com “${_esc(input.value)}”.</div>`;
                return;
            }

            // Mesma regra da Lista de Estudo: o grupo com o melhor casamento de
            // nome sobe, e dentro dele o nome vem antes do tipo/descrição.
            const porGrupo = new Map();
            achados.forEach(it => {
                const g = porGrupo.get(it.grupo) || { best: -1, itens: [] };
                const s = _score(it.el, tokens);
                g.best = Math.max(g.best, s);
                g.itens.push({ it, s });
                porGrupo.set(it.grupo, g);
            });

            lista.innerHTML = [...porGrupo.entries()]
                .sort((a, b) => b[1].best - a[1].best)
                .map(([grupo, info]) => `
                <div class="runo-cat-grp">${_esc(grupo)} <span class="runo-cat-n">${info.itens.length}</span></div>
                <div class="runo-learned">${info.itens.sort((a, b) => b.s - a.s).map(({ it }) => {
                    const lv = _nivelEfetivo(it.el.id);
                    const conc = _nivelConcedido(it.el.id);
                    return `<span class="runo-chip" data-id="${it.el.id}">${TIPO_ICON[it.el.tipoElemento] || 'ᛟ'} ${_grifar(it.el.nome, tokens)}${lv ? ` <b>Nv${lv}</b>` : ''}${conc ? ` <em class="runo-conc">⚙️+${conc}</em>` : ''}</span>`;
                }).join('')}</div>`).join('');
        }

        const _fecharCat = _fecharComEsc(bk);

        bk.onclick = e => { if (e.target === bk) _fecharCat(); };
        bk.querySelector('#runoCatFechar').onclick = _fecharCat;
        lista.addEventListener('click', e => {
            const chip = e.target.closest('.runo-chip[data-id]');
            if (chip) window.runoOpenElementModal(chip.dataset.id);
        });
        input.addEventListener('input', _pintarCat);
        input.addEventListener('keydown', e => {
            // Um resultado só: Enter abre direto, sem precisar do mouse.
            if (e.key === 'Enter' && achados.length === 1) {
                e.preventDefault();
                window.runoOpenElementModal(achados[0].el.id);
            }
        });
        bk.querySelectorAll('.runo-fchip').forEach(chip => {
            chip.onclick = () => {
                filtro = chip.dataset.t || '';
                bk.querySelectorAll('.runo-fchip').forEach(c => c.classList.toggle('on', c === chip));
                input.focus(); _pintarCat();
            };
        });

        _pintarCat();
        document.body.appendChild(bk);
        input.focus();
    };
})();
