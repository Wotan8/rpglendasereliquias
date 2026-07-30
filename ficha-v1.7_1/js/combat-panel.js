/* ===== PAINEL DE COMBATE — HUD de Status Vitais + Valores rápidos =====
 *
 * Espelha (NÃO duplica) os campos canônicos da aba Principal: escreve no
 * mesmo <input data-key="..."> / #dv_*_atual e dispara 'input' para o
 * autosave e as mecânicas existentes cuidarem do resto. Nenhum novo
 * data-key é criado — gatherData() continua vendo um campo por chave.
 *
 * Chamado no fim de recalcAll() (derived-values.js), junto de
 * renderActiveEffects(). Nunca deve chamar recalcAll de volta.
 */
(function () {
    'use strict';

    const VITAL_COLORS = {
        VIT_MAX: 'var(--lr-blood-2)',
        SAN_MAX: 'var(--lr-abyssal-2)',
        ENER_MAX: 'var(--lr-arcane)',
    };

    let _sig = '';   // assinatura da estrutura montada (evita rebuild a cada recalc)

    const _esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const _fmt = (v) => {
        const n = parseFloat(v);
        if (isNaN(n)) return 0;
        return Number.isInteger(n) ? n : parseFloat(n.toFixed(1));
    };

    /* ===== FONTES DE DADOS =====
     * A grid de Valores Derivados da aba Principal já resolve quais valores
     * se aplicam a este personagem (raça/classe/tribo/peculiaridades).
     * Lemos dela em vez de repetir o filtro.
     */

    const _dvByKey = (key) => (window.DERIVED_VALUES || []).find(d => d.key === key);

    /** Status Vitais + Valores Derivados marcados como "Status de Combate"
     *  no Painel do Criador (statusCombate). VD com campo Atual/Máx vira card
     *  com barra e −/+; sem campo Atual, vira card só de leitura. */
    function collectVitals() {
        const list = [];
        const map = typeof DERIVED_FIELDS_MAP !== 'undefined' ? DERIVED_FIELDS_MAP : {};

        for (const vs of (window.VITAL_STATS || [])) {
            const m = map[vs.key];
            if (!m) continue;
            const curSel = `[data-key="${m.atual}"]`;
            const maxSel = `#${m.display}`;
            if (!document.querySelector(curSel) || !document.querySelector(maxSel)) continue;
            list.push({
                id: vs.key, nome: vs.nome, icone: vs.icone,
                cor: VITAL_COLORS[vs.key] || 'var(--lr-gold)',
                curSel, maxSel, prefixo: '', sufixo: '',
            });
        }

        document.querySelectorAll('#derivedValuesGrid .mini-field[data-dv-key]').forEach(mf => {
            const key = mf.dataset.dvKey;
            const dv = _dvByKey(key);
            if (!dv || !dv.statusCombate) return;
            const temAtual = !!document.getElementById(`dv_${key}_atual`);
            list.push({
                id: 'DV_' + key, nome: dv.nome, icone: dv.icone || '📊',
                cor: 'var(--lr-gold)',
                curSel: temAtual ? `#dv_${key}_atual` : null,
                maxSel: `#dv_${key}_display`,
                prefixo: dv.prefixo || '', sufixo: dv.sufixo || '',
            });
        });

        return list;
    }

    /** Demais Valores Derivados, agrupados pelos mesmos blocos da aba Principal. */
    function collectBlocks() {
        const blocks = [];
        document.querySelectorAll('#derivedValuesGrid .dv-block-container').forEach(bc => {
            const nome = bc.querySelector('.attr-block-title')?.textContent?.trim() || 'Geral';
            const dvs = [];
            bc.querySelectorAll('.mini-field[data-dv-key]').forEach(mf => {
                const dv = _dvByKey(mf.dataset.dvKey);
                if (dv && !dv.statusCombate) dvs.push(dv);   // o resto já está no HUD
            });
            if (dvs.length) blocks.push({ nome, dvs });
        });
        return blocks;
    }

    /* ===== RENDER ===== */

    function vitalCardHTML(v) {
        const cabecalho = `<div class="cbt-vital-top">
                <span class="cbt-ic">${_esc(v.icone)}</span>
                <span class="cbt-nm" title="${_esc(v.nome)}">${_esc(v.nome)}</span>
                ${v.curSel ? '<span class="cbt-pct">—</span>' : ''}
            </div>`;

        // VD sem campo Atual: só leitura, sem barra nem botões.
        if (!v.curSel) {
            return `<div class="cbt-vital is-static" style="--cbt-c:${v.cor}"
                         data-max-sel="${_esc(v.maxSel)}" data-pre="${_esc(v.prefixo)}" data-suf="${_esc(v.sufixo)}">
                ${cabecalho}
                <div class="cbt-vital-ctl"><span class="cbt-static-val">—</span></div>
            </div>`;
        }

        return `<div class="cbt-vital" style="--cbt-c:${v.cor}"
                     data-cur-sel="${_esc(v.curSel)}" data-max-sel="${_esc(v.maxSel)}">
            ${cabecalho}
            <div class="cbt-vital-ctl">
                <button type="button" class="cbt-step no-print" data-delta="-1" title="Reduzir (usa o passo Δ)">−</button>
                <input type="text" class="cbt-cur" inputmode="numeric" placeholder="0" aria-label="${_esc(v.nome)} atual">
                <span class="cbt-sep">/</span>
                <span class="cbt-max">0</span>${v.sufixo ? `<span class="cbt-sfx">${_esc(v.sufixo)}</span>` : ''}
                <button type="button" class="cbt-step no-print" data-delta="1" title="Aumentar (usa o passo Δ)">+</button>
            </div>
            <div class="cbt-bar"><i></i></div>
        </div>`;
    }

    /** Condições ativas em miniatura, no rodapé do bloco de Status de Combate. */
    function renderCombatConditionTags() {
        const el = document.getElementById('cbtCondTags');
        if (!el) return;
        const conds = (window.state && window.state.conditions) || [];
        if (!conds.length) { el.innerHTML = ''; el.hidden = true; return; }

        el.innerHTML = conds.map((c, i) => {
            const tempo = String(c.tempoRestante || '').trim();
            const titulo = c.descricao || c.nome || '';
            return `<button type="button" class="cbt-cond-tag" data-cond-idx="${i}"
                        title="${_esc(titulo)}${tempo ? ' — restam ' + _esc(tempo) : ''}">
                <span class="cbt-cond-ic">${_esc(c.icone || '💀')}</span>
                <span class="cbt-cond-nm">${_esc(c.nome || 'Sem nome')}</span>
                ${tempo ? `<b class="cbt-cond-t">⏱️ ${_esc(tempo)}</b>` : ''}
            </button>`;
        }).join('');
        el.hidden = false;
    }

    function blockHTML(b, open) {
        const chips = b.dvs.map(dv => `<button type="button" class="cbt-chip" data-dv-id="${_esc(dv.id)}"
                data-dv-key="${_esc(dv.key)}" data-pre="${_esc(dv.prefixo)}" data-suf="${_esc(dv.sufixo)}"
                title="${_esc(dv.descricao || dv.nome)}${dv.escopoItem ? ' — valor base; total por item na tabela de Ataques' : ''}">
            <span class="cbt-chip-ic">${_esc(dv.icone)}</span>
            <span class="cbt-chip-nm">${_esc(dv.nome)}${dv.escopoItem ? ' 🎒' : ''}</span>
            <b class="cbt-chip-vl">—</b>
        </button>`).join('');

        return `<details class="cbt-block"${open ? ' open' : ''}>
            <summary>${_esc(b.nome)}<span class="cbt-block-n">${b.dvs.length}</span></summary>
            <div class="cbt-chips">${chips}</div>
        </details>`;
    }

    function renderCombatPanel() {
        const hud = document.getElementById('combatVitalsGrid');
        const blocksEl = document.getElementById('combatValuesBlocks');
        if (!hud || !blocksEl) return;

        const vitals = collectVitals();
        const blocks = collectBlocks();
        const sig = vitals.map(v => v.id).join(',') + '|' +
            blocks.map(b => b.nome + ':' + b.dvs.map(d => d.key).join('-')).join(',');

        // Só remonta quando a estrutura muda — preserva foco de digitação e
        // quais blocos o jogador deixou abertos.
        if (sig !== _sig) {
            _sig = sig;
            hud.innerHTML = vitals.length
                ? vitals.map(vitalCardHTML).join('')
                : '<div class="cbt-empty">Nenhum status vital configurado.</div>';
            blocksEl.innerHTML = blocks.length
                ? blocks.map((b, i) => blockHTML(b, i === 0)).join('')
                : '<div class="cbt-empty">Nenhum valor derivado aplicável.</div>';
            bindChipTooltips();
        }

        renderCombatConditionTags();
        syncCombatPanel();
    }

    /* ===== SYNC (valores) ===== */

    function syncCombatPanel() {
        document.querySelectorAll('#combatVitalsGrid .cbt-vital').forEach(card => {
            const max = document.querySelector(card.dataset.maxSel);
            if (!max) return;

            // Card só de leitura (VD sem campo Atual)
            if (card.classList.contains('is-static')) {
                card.querySelector('.cbt-static-val').textContent =
                    `${card.dataset.pre || ''}${_fmt(max.value)}${card.dataset.suf || ''}`;
                return;
            }

            const cur = document.querySelector(card.dataset.curSel);
            if (!cur) return;

            const input = card.querySelector('.cbt-cur');
            if (document.activeElement !== input) input.value = cur.value;

            const maxV = parseFloat(max.value) || 0;
            const curV = parseFloat(cur.value) || 0;
            const pct = maxV > 0 ? Math.max(0, Math.min(100, (curV / maxV) * 100)) : 0;

            card.querySelector('.cbt-max').textContent = _fmt(max.value);
            card.querySelector('.cbt-pct').textContent = maxV > 0 ? Math.round(pct) + '%' : '—';
            card.querySelector('.cbt-bar > i').style.width = pct + '%';
            card.classList.toggle('is-low', maxV > 0 && pct <= 25);
            card.classList.toggle('is-mid', maxV > 0 && pct > 25 && pct <= 50);
        });

        const derived = (window.state && window.state.derived) || {};
        document.querySelectorAll('#combatValuesBlocks .cbt-chip').forEach(chip => {
            const v = derived[chip.dataset.dvKey];
            chip.querySelector('.cbt-chip-vl').textContent =
                (v === undefined ? '—' : `${chip.dataset.pre || ''}${_fmt(v)}${chip.dataset.suf || ''}`);
        });
    }

    /* ===== EDIÇÃO ===== */

    /** Escreve no campo canônico e deixa o listener original salvar/recalcular. */
    function writeCanonical(el, value) {
        el.value = String(value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    function stepAmount() {
        const n = parseFloat(document.getElementById('cbtStep')?.value);
        return (isNaN(n) || n <= 0) ? 1 : n;
    }

    function initEvents() {
        const hud = document.getElementById('combatVitalsGrid');
        if (!hud) return;

        hud.addEventListener('click', e => {
            const btn = e.target.closest('.cbt-step');
            if (!btn) return;
            const card = btn.closest('.cbt-vital');
            const cur = document.querySelector(card.dataset.curSel);
            if (!cur) return;
            // Piso em 0; sem teto — mecânicas de "limitar" cuidam de excessos.
            const novo = Math.max(0, (parseFloat(cur.value) || 0) + (+btn.dataset.delta) * stepAmount());
            writeCanonical(cur, novo);
            syncCombatPanel();
        });

        hud.addEventListener('input', e => {
            if (!e.target.classList.contains('cbt-cur')) return;
            const cur = document.querySelector(e.target.closest('.cbt-vital').dataset.curSel);
            if (cur) writeCanonical(cur, e.target.value);
            syncCombatPanel();
        });

        // Miniatura de condição abre o bloco completo e rola até ele.
        document.getElementById('cbtCondTags')?.addEventListener('click', e => {
            if (!e.target.closest('.cbt-cond-tag')) return;
            const sec = document.getElementById('conditionsSection');
            if (!sec) return;
            sec.classList.remove('cbt-collapsed');
            sec.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });

        // Edição feita na aba Principal reflete no HUD.
        document.addEventListener('input', e => {
            const t = e.target;
            if (!t || !t.matches || t.closest('#combatHudSection')) return;
            if (t.matches('[data-key$="_atual"], [id^="dv_"][id$="_atual"]')) syncCombatPanel();
        });

        initCollapsibles();
    }

    /** Tooltips dos chips reusam o tooltip flutuante dos Valores Derivados. */
    function bindChipTooltips() {
        if (typeof showDvTooltip !== 'function') return;
        document.querySelectorAll('#combatValuesBlocks .cbt-chip').forEach(chip => {
            chip.addEventListener('mouseenter', showDvTooltip);
            chip.addEventListener('mouseleave', hideDvTooltip);
            chip.addEventListener('touchstart', showDvTooltip, { passive: true });
            chip.addEventListener('touchend', hideDvTooltip);
        });
    }

    /** Seções da aba Combate viram sanfona (clique no título) — economia de tela. */
    function initCollapsibles() {
        document.querySelectorAll('#tabCombate > .section').forEach(sec => {
            if (sec.id === 'combatHudSection') return;
            const title = sec.querySelector(':scope > .section-title');
            if (!title) return;
            title.classList.add('cbt-collapsible');
            title.addEventListener('click', e => {
                if (e.target.closest('button, input, a, select')) return;
                sec.classList.toggle('cbt-collapsed');
            });
            // Equipamentos ocupa muita altura: começa fechado no celular.
            if (sec.id === 'equipSection' && window.innerWidth < 600) sec.classList.add('cbt-collapsed');
            // Condições nascem fechadas: o resumo delas já está no topo, em miniatura.
            if (sec.id === 'conditionsSection') sec.classList.add('cbt-collapsed');
        });
    }

    /* ===== INICIATIVA — combate montado pelo Mestre =====
     * Doc: mesas/{mesaId}/tabuleiro-meta/combate  { participantes: [...] }
     * (mesmo doc que o Painel do Mestre grava e o Tabuleiro lê).
     */

    /** Parte pura de DOM — participante deste personagem (ou null) + turno/rodada.
     *  Só expõe o que é DESTE personagem: nunca "vez de Fulano", que é
     *  informação do Mestre. */
    function setCombatInitiative(eu, participantes, meta) {
        const strip = document.getElementById('cbtInitStrip');
        if (!strip) return;
        if (!eu) { strip.hidden = true; strip.classList.remove('is-turn'); return; }

        // Mesma ordenação da janela de Combate do Tabuleiro: iniciativa desc.
        const ordem = (participantes || [])
            .slice()
            .sort((a, b) => (b.initiative || 0) - (a.initiative || 0));
        const idx = ordem.findIndex(p => p.id === eu.id);
        const turno = meta?.turnoAtual;
        const minhaVez = idx >= 0 && ordem.length > 0 &&
            Number.isInteger(turno) && (turno % ordem.length) === idx;

        const detalhes = [];
        if (idx >= 0 && ordem.length > 1) detalhes.push(`${idx + 1}º de ${ordem.length}`);
        if (meta?.rodada) detalhes.push(`Rodada ${meta.rodada}`);

        document.getElementById('cbtInitTag').textContent = minhaVez ? '🎯 Sua vez!' : '⚔️ Em combate';
        document.getElementById('cbtInitVal').textContent = eu.initiative ?? 0;
        document.getElementById('cbtInitPos').textContent = detalhes.join(' · ');
        strip.classList.toggle('is-turn', minhaVez);
        strip.hidden = false;
    }

    let _watching = false;

    async function watchCombatInitiative(mesaId) {
        if (!mesaId || _watching) return;
        _watching = true;
        try {
            const { getFirestore, doc, onSnapshot } =
                await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const db = window.db || getFirestore();
            onSnapshot(doc(db, 'mesas', mesaId, 'tabuleiro-meta', 'combate'), snap => {
                const d = snap.exists() ? snap.data() : {};
                const parts = d.participantes || [];
                setCombatInitiative(
                    parts.find(p => p.characterId === window.currentCharacterId),
                    parts,
                    { turnoAtual: d.turnoAtual, rodada: d.rodada });
            }, e => console.warn('Iniciativa do combate:', e));
        } catch (e) {
            _watching = false;
            console.warn('Iniciativa do combate:', e);
        }
    }

    window.renderCombatPanel = renderCombatPanel;
    window.syncCombatPanel = syncCombatPanel;
    window.setCombatInitiative = setCombatInitiative;
    window.renderCombatConditionTags = renderCombatConditionTags;
    window.watchCombatInitiative = watchCombatInitiative;

    document.addEventListener('DOMContentLoaded', initEvents);
})();
