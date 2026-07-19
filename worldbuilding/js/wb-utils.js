/* ═══════════════════════════════════════════════════════════
   wb-utils.js — Utilidades das ferramentas novas
   Ponte com o núcleo legado (window.WB), modal próprio,
   helpers de segurança e busca unificada no ecossistema.
   ═══════════════════════════════════════════════════════════ */

export const uid = (p = 'id') =>
    `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const esc = (s = '') =>
    String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Acesso ao núcleo legado (dados reais do ecossistema). */
export const WB = () => window.WB;

/** Corpo principal da página (mesmo container das categorias legadas). */
export const contentBody = () => document.getElementById('contentBody');

export function setTitle(t) { document.getElementById('contentTitle').textContent = t; }

/* ── Busca unificada: NPCs, Tribos, Geografia, História… ───────
   Fonte ÚNICA para @mentions, painel de consulta e grafos.
   Tudo vem de allData do núcleo (coleções reais do Firestore). */
export const KIND = {
    npcs:      { label: 'NPC',        icon: '👥', cor: 'var(--lr-arcane)'  },
    factions:  { label: 'Tribo',      icon: '⚔️', cor: 'var(--lr-blood-2, var(--lr-blood))' },
    geography: { label: 'Local',      icon: '📍', cor: 'var(--lr-nature)'  },
    history:   { label: 'História',   icon: '📜', cor: 'var(--lr-gold)'    },
    cultures:  { label: 'Cultura',    icon: '🎭', cor: 'var(--lr-abyssal)' },
    religion:  { label: 'Religião',   icon: '🏛️', cor: 'var(--lr-divine)'  },
    magic:     { label: 'Magia',      icon: '✨', cor: 'var(--lr-abyssal)' },
    properties:{ label: 'Propriedade',icon: '🏠', cor: 'var(--lr-bronze)'  },
};

export function searchables(kinds = Object.keys(KIND)) {
    const data = WB().data;
    const out = [];
    for (const cat of kinds) {
        for (const e of (data[cat] || [])) {
            out.push({
                cat, id: e.id,
                nome: e.nome || e.titulo || '(sem nome)',
                tipo: e.tipo || '',
                descricao: e.descricao || '',
                imagem: e.imagem || '',
            });
        }
    }
    return out;
}

/* ── Modal próprio das ferramentas (não conflita com entryModal) ── */
export const ToolModal = {
    open(html) {
        const root = document.getElementById('wbToolModal');
        root.querySelector('#wbToolModalBody').innerHTML = html;
        root.classList.add('active');
        root.querySelectorAll('[data-close]').forEach(el => (el.onclick = () => this.close()));
        document.addEventListener('keydown', this._esc);
    },
    close() {
        document.getElementById('wbToolModal').classList.remove('active');
        document.removeEventListener('keydown', this._esc);
    },
    _esc(e) { if (e.key === 'Escape') ToolModal.close(); },

    /** Ficha-resumo de qualquer entrada do ecossistema. */
    openEntry(cat, id) {
        const e = (WB().data[cat] || []).find(x => x.id === id);
        if (!e) return;
        const k = KIND[cat] || { label: cat, icon: '📄' };
        this.open(`
            <div class="wbt-entity-head">
                ${e.imagem ? `<img src="${esc(e.imagem)}" alt="" class="wbt-entity-img">` : ''}
                <div>
                    <span class="wbt-kind">${k.icon} ${k.label}${e.tipo ? ` · ${esc(e.tipo)}` : ''}</span>
                    <h2>${esc(e.nome || e.titulo || '')}</h2>
                </div>
            </div>
            <p class="wbt-desc">${esc(e.descricao || 'Sem descrição cadastrada.')}</p>
            ${e.tags ? `<p class="wbt-muted">🏷️ ${esc(e.tags)}</p>` : ''}
            <div class="wbt-actions">
                <button class="btn btn-secondary" data-close>Fechar</button>
                <button class="btn btn-success" id="wbtOpenWiki">📖 Abrir ficha completa na wiki</button>
            </div>
        `);
        document.getElementById('wbtOpenWiki').onclick = () => {
            this.close();
            window.openEntry(cat, id);   // reusa o modal de edição do núcleo legado
        };
    },
};
