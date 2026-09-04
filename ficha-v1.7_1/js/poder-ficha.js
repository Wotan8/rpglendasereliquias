/* =============================================
   ⚡ PODER NA FICHA (Livro de 12 Páginas, p. 12)
   A conta mora em shared/poder.js (window.LR_PODER); aqui só se junta o que a
   ficha sabe — dots, perícias, Dons, habilidades de módulo, inventário — e se
   pinta o selo ao lado da Experiência. Roda no fim de recalcAll.
   ============================================= */
function atualizarPoderFicha() {
    const P = window.LR_PODER;
    if (!P || typeof state === 'undefined' || !state) return;
    const R = window.REGRAS || window.LR_REGRAS?.REGRAS_PADRAO || null;
    const dots = state.dots || {};

    const atributos = Object.entries(dots).filter(([k]) => k.startsWith('attr_')).map(([, v]) => Number(v) || 0);

    const chave = window.LR_DOMINIO?.chaveDaPericia;
    const pericias = (window._systemData?.skills || [])
        .filter(s => s.publicado !== false && chave)
        .map(s => ({ nivel: Number(dots[chave(s)]) || 0, custoEvolucao: Number(s.custoEvolucao) || 0 }))
        .filter(p => p.nivel > 0);

    const dons = (state.peculiaridadesIndividuais || []).length;

    const mods = Object.values(window._classModules || {}).flat();
    const habilidades = [];
    for (const [mid, itens] of Object.entries(state.classModuleData || {})) {
        const mod = mods.find(m => m.id === mid);
        if (!mod || !Array.isArray(itens)) continue;
        for (const it of itens) {
            const pd = (mod.itensPredefinidos || []).find(p => p.id === it._predefId) || it;
            habilidades.push(typeof _cmCustoExpDoItem === 'function' ? _cmCustoExpDoItem(mod, pd) : 0);
        }
    }

    const inv = window._inventoryState;
    const cat = inv?.catalog || [];
    const itens = (inv?.items || []).map(i => {
        const t = i.modeloId ? cat.find(x => x.id === i.modeloId) : null;
        return {
            qualidade: i.qualidade ?? t?.qualidade, afiacao: i.afiacao ?? t?.afiacao, afiacaoArcana: i.afiacaoArcana ?? t?.afiacaoArcana,
            encantamento: i.encantamento ?? t?.encantamento, aura: i.aura ?? t?.aura,
        };
    });

    const r = P.poderTotal({ atributos, pericias, dons, habilidades, itens }, R);
    const pat = P.patamarDoPoder(r.total, R);

    let el = document.getElementById('poderChip');
    if (!el) {
        const rot = document.getElementById('expRotulo');
        if (!rot) return;
        el = document.createElement('span');
        el.id = 'poderChip';
        el.className = 'poder-chip';
        el.style.cssText = 'margin-left:8px;font-size:.8em;opacity:.85;cursor:help;white-space:nowrap';
        rot.appendChild(el);
    }
    el.textContent = `⚡ ${r.total} · ${pat.nome}`;
    el.title = 'Poder (Livro, p. 12): tudo que a ficha tem, em EXP. Não trava nada — é régua para o Narrador.\n'
        + r.partes.map(p => `${p.icone} ${p.label}: ${p.exp}`).join('\n')
        + `\n= ${r.total} EXP · Patamar ${pat.indice} ${pat.nome}`;
}
window.atualizarPoderFicha = atualizarPoderFicha;
