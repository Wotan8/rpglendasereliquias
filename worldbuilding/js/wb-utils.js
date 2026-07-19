/* ═══════════════════════════════════════════════════════════
   wb-utils.js — Utilidades das ferramentas + ponte com o núcleo
   Modal enriquecido (lore + mecânica), busca unificada e helpers.
   ═══════════════════════════════════════════════════════════ */

import { Eco } from './wb-ecosystem.js';

export const uid = (p = 'id') =>
    `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const esc = (s = '') =>
    String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const WB = () => window.WB;
export const contentBody = () => document.getElementById('contentBody');
export function setTitle(t) { document.getElementById('contentTitle').textContent = t; }

/* Campo de imagem: WB usa `imagem`, Criador usa `imagemUrl`. */
export const imgOf = (e) => e?.imagem || e?.imagemUrl || '';

/* ── Tipos pesquisáveis ────────────────────────────────────────
   Lore (allData do núcleo) + Mecânica (ecossistema do Criador). */
export const KIND = {
    npcs:      { label: 'NPC',        icon: '👥', origem: 'lore' },
    factions:  { label: 'Tribo',      icon: '⚔️', origem: 'lore' },
    geography: { label: 'Local',      icon: '📍', origem: 'lore' },
    history:   { label: 'História',   icon: '📜', origem: 'lore' },
    cultures:  { label: 'Cultura',    icon: '🎭', origem: 'lore' },
    religion:  { label: 'Religião',   icon: '🏛️', origem: 'lore' },
    magic:     { label: 'Magia',      icon: '✨', origem: 'lore' },
    properties:{ label: 'Propriedade',icon: '🏠', origem: 'lore' },
    rumors:    { label: 'Rumor',      icon: '💬', origem: 'lore' },
    races:     { label: 'Raça',       icon: '🧬', origem: 'mecanica' },
    classes:   { label: 'Classe',     icon: '⚔️', origem: 'mecanica' },
};

function poolOf(cat) {
    if (cat === 'races') return Eco.races;
    if (cat === 'classes') return Eco.classes;
    return WB().data[cat] || [];
}

export function searchables(kinds = Object.keys(KIND)) {
    const out = [];
    for (const cat of kinds) {
        for (const e of poolOf(cat)) {
            out.push({
                cat, id: e.id,
                nome: e.nome || e.titulo || '(sem nome)',
                tipo: e.tipo || e.arquetipo || '',
                descricao: e.descricao || e.especialidade || e.aparencia || '',
                imagem: imgOf(e),
            });
        }
    }
    return out;
}

/* ── Modal próprio das ferramentas ─────────────────────────── */
export const ToolModal = {
    open(html) {
        const root = document.getElementById('wbToolModal');
        root.querySelector('#wbToolModalBody').innerHTML = html;
        root.classList.add('active');
        root.querySelectorAll('[data-close]').forEach(el => (el.onclick = () => this.close()));
        root.querySelectorAll('[data-openentry]').forEach(el => (el.onclick = () => {
            const [c, i] = el.dataset.openentry.split(':');
            this.openEntry(c, i);
        }));
        document.addEventListener('keydown', this._esc);
    },
    close() {
        document.getElementById('wbToolModal').classList.remove('active');
        document.removeEventListener('keydown', this._esc);
    },
    _esc(e) { if (e.key === 'Escape') ToolModal.close(); },

    openEntry(cat, id) {
        const e = poolOf(cat).find(x => x.id === id);
        if (!e) return;
        const k = KIND[cat] || { label: cat, icon: '📄' };
        const nome = e.nome || e.titulo || '';
        const img = imgOf(e);
        let corpo = '';

        if (cat === 'races' || cat === 'classes') {
            corpo = fichaMecanica(cat, e);
        } else {
            corpo = `<p class="wbt-desc">${esc(e.descricao || 'Sem descrição na lore.')}</p>`;
            const mech = Eco.mechanicsFor(e);
            const linhas = [];
            if (mech.raca) linhas.push(refLinha('races', mech.raca, '🧬 Raça'));
            if (mech.classe) linhas.push(refLinha('classes', mech.classe, '⚔️ Classe'));
            if (mech.tribo) linhas.push(`<div class="wbt-relation-line">🏕️ <b>Tribo (mecânica):</b> ${esc(mech.tribo.nome)}</div>`);
            if (linhas.length)
                corpo += `<div class="wbt-mech-box"><span class="wbt-mech-tag">⚙️ Dados do Painel do Criador</span>${linhas.join('')}</div>`;
        }

        this.open(`
            <div class="wbt-entity-head">
                ${img ? `<img src="${esc(img)}" alt="" class="wbt-entity-img">` : ''}
                <div>
                    <span class="wbt-kind">${k.icon} ${k.label}${e.tipo ? ` · ${esc(e.tipo)}` : ''}${e.arquetipo ? ` · ${esc(e.arquetipo)}` : ''}</span>
                    <h2>${esc(nome)}</h2>
                    ${e.subtitulo ? `<p class="wbt-muted">${esc(e.subtitulo)}</p>` : ''}
                </div>
            </div>
            ${corpo}
            <div class="wbt-actions">
                <button class="btn btn-secondary" data-close>Fechar</button>
                ${KIND[cat]?.origem === 'lore'
                    ? `<button class="btn btn-success" id="wbtOpenWiki">📖 Ficha completa na wiki</button>`
                    : `<button class="btn btn-success" id="wbtOpenCriador">🛠️ Abrir no Painel do Criador</button>`}
            </div>
        `);

        const wiki = document.getElementById('wbtOpenWiki');
        if (wiki) wiki.onclick = () => { this.close(); window.openEntry(cat, id); };
        const criador = document.getElementById('wbtOpenCriador');
        if (criador) criador.onclick = () => window.open(`../painel-criador/painel-criador.html#${cat}/${id}`, '_blank');
    },
};

function fichaMecanica(cat, e) {
    let html = `<p class="wbt-desc">${esc(e.descricao || e.especialidade || e.aparencia || 'Sem descrição.')}</p>`;
    const bits = [];
    if (cat === 'races') {
        if (e.expectativaVida) bits.push(['Expectativa de vida', e.expectativaVida]);
        if (e.tendencia) bits.push(['Tendência', e.tendencia]);
        if (e.habitat) bits.push(['Habitat', e.habitat]);
    } else {
        if (e.arquetipo) bits.push(['Arquétipo', e.arquetipo]);
        if (e.especialidade) bits.push(['Especialidade', e.especialidade]);
        if (e.citacao) bits.push(['Citação', `"${e.citacao}"`]);
    }
    if (bits.length)
        html += `<div class="wbt-mech-box"><span class="wbt-mech-tag">⚙️ Ficha mecânica</span>${
            bits.map(([l, v]) => `<div class="wbt-relation-line"><b>${l}:</b> ${esc(v)}</div>`).join('')}</div>`;

    const kindKey = cat === 'races' ? 'raca' : 'classe';
    const usados = Eco.charsOf(kindKey, e.nome);
    if (usados.length)
        html += `<h3 class="wbt-subhead" style="margin-top:1rem">🎭 Personagens com esta ${cat === 'races' ? 'raça' : 'classe'}</h3>
            ${usados.map(c => `<div class="wbt-relation-line">• ${esc(c.nome || c.nomePersonagem || 'Sem nome')} <span class="wbt-muted">${esc(c.classe || c.raca || '')}</span></div>`).join('')}`;
    return html;
}

function refLinha(cat, mech, rotulo) {
    return `<div class="wbt-relation-line" data-openentry="${cat}:${mech.id}" style="cursor:pointer">
        ${rotulo}: <b>${esc(mech.nome)}</b> <span class="wbt-muted">— ver ficha</span></div>`;
}
