/* ═══════════════════════════════════════════════════════════
   wb-busca.js — Busca Global (Ctrl/Cmd-K)
   ────────────────────────────────────────
   Palette único sobre searchables() — que já unifica LORE
   (NPCs, Tribos, Locais, História…) e MECÂNICA (Raças, Classes).
   Salta para a ficha da entidade (modal). Também lista linhagens.
   ═══════════════════════════════════════════════════════════ */

import { esc, searchables, KIND, ToolModal } from './wb-utils.js';
import { Eco } from './wb-ecosystem.js';

export const Busca = (() => {
    let itens = [];      // índice achatado
    let sel = 0;
    let visivel = false;

    function buildIndex() {
        itens = searchables().map(x => ({
            tipo: 'entity', cat: x.cat, id: x.id, nome: x.nome,
            sub: `${KIND[x.cat]?.label || x.cat}${x.tipo ? ' · ' + x.tipo : ''}`,
            icon: KIND[x.cat]?.icon || '📄', busca: `${x.nome} ${x.descricao}`.toLowerCase(),
        }));
        for (const l of (Eco.lineages || [])) {
            itens.push({
                tipo: 'lineage', id: l.id, nome: l.nome,
                sub: `Linhagem · ${(l.members || []).length} membros`,
                icon: '⚜️', busca: `${l.nome} ${l.descricao || ''}`.toLowerCase(),
            });
        }
    }

    function ensureDOM() {
        if (document.getElementById('wbBusca')) return;
        const el = document.createElement('div');
        el.id = 'wbBusca';
        el.className = 'wbt-palette';
        el.innerHTML = `
            <div class="wbt-palette__backdrop" data-close></div>
            <div class="wbt-palette__box" role="dialog" aria-modal="true">
                <input id="wbBuscaInput" class="wbt-palette__input" placeholder="Buscar em todo o mundo — NPCs, tribos, raças, classes, locais, linhagens…" autocomplete="off">
                <div id="wbBuscaList" class="wbt-palette__list"></div>
                <div class="wbt-palette__foot"><span>↑↓ navegar · ↵ abrir · esc fechar</span></div>
            </div>`;
        document.body.appendChild(el);
        el.querySelector('[data-close]').onclick = close;
        const input = el.querySelector('#wbBuscaInput');
        input.addEventListener('input', () => renderList(input.value));
        input.addEventListener('keydown', onKey);
    }

    function renderList(q = '') {
        const query = q.trim().toLowerCase();
        const res = (query ? itens.filter(i => i.busca.includes(query)) : itens).slice(0, 40);
        sel = 0;
        const list = document.getElementById('wbBuscaList');
        list.innerHTML = res.length ? res.map((i, idx) => `
            <button class="wbt-palette__item ${idx === 0 ? 'is-sel' : ''}" data-idx="${idx}">
                <span class="wbt-palette__icon">${i.icon}</span>
                <span class="wbt-palette__name">${esc(i.nome)}</span>
                <span class="wbt-palette__sub">${esc(i.sub)}</span>
            </button>`).join('')
            : `<div class="wbt-palette__empty">Nada encontrado.</div>`;
        list._res = res;
        list.querySelectorAll('[data-idx]').forEach(b =>
            b.onclick = () => choose(res[+b.dataset.idx]));
    }

    function onKey(e) {
        const list = document.getElementById('wbBuscaList');
        const res = list._res || [];
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + res.length) % res.length;
            list.querySelectorAll('[data-idx]').forEach((b, i) => b.classList.toggle('is-sel', i === sel));
            list.querySelector('.is-sel')?.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            e.preventDefault(); if (res[sel]) choose(res[sel]);
        } else if (e.key === 'Escape') { e.preventDefault(); close(); }
    }

    function choose(item) {
        if (!item) return;
        close();
        if (item.tipo === 'lineage') {
            // abre a aba de grafos em modo linhagem, se a ferramenta expuser hook
            document.dispatchEvent(new CustomEvent('wb:goto-lineage', { detail: item.id }));
        } else {
            ToolModal.openEntry(item.cat, item.id);
        }
    }

    function open() {
        ensureDOM(); buildIndex();
        document.getElementById('wbBusca').classList.add('active');
        renderList('');
        const input = document.getElementById('wbBuscaInput');
        input.value = ''; setTimeout(() => input.focus(), 20);
        visivel = true;
    }
    function close() {
        document.getElementById('wbBusca')?.classList.remove('active');
        visivel = false;
    }

    function init() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault(); visivel ? close() : open();
            }
        });
    }

    return { init, open, close };
})();
