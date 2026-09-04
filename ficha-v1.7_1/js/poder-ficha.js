/* =============================================
   ⚡ PODER NA FICHA (Livro de 12 Páginas, p. 12)
   A conta mora em shared/poder.js (window.LR_PODER); aqui só se junta o que a
   ficha sabe — dots, perícias, Dons, habilidades de módulo, inventário — e se
   pinta o selo ao lado da Experiência. O detalhe vai para o tooltip da
   Experiência (exp-vip.js lê `expRotulo.dataset.poderTexto`). Roda no fim de recalcAll.
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

    /* Dons pelo preço do cadastro (mecânica de EXP da criação + escada de níveis).
       Desvantagem rendeu EXP — não é Poder: entra 0. */
    const regs = window._systemData?.peculiarities || [];
    const mecs = Object.fromEntries((window._systemData?.mechanics || []).map(m => [m.id, m]));
    const dons = (state.peculiaridadesIndividuais || []).map(p => {
        const reg = regs.find(r => r.id === p.id) || regs.find(r => r.nome === p.nome) || null;
        return Math.max(0, P.custoDeDom(reg, p.nivel, mecs, R));
    });

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

    const rot = document.getElementById('expRotulo');
    if (!rot) return;
    let el = document.getElementById('poderChip');
    if (!el) {
        el = document.createElement('span');
        el.id = 'poderChip';
        el.className = 'poder-chip';
        el.style.cssText = 'margin-left:8px;font-size:.8em;opacity:.85;white-space:nowrap';
        rot.appendChild(el);
    }
    el.textContent = `⚡ ${r.total} · ${pat.nome}`;
    rot.dataset.poderTexto = `⚡ Poder ${r.total} · Patamar ${pat.indice} ${pat.nome}\n`
        + r.partes.map(p => `${p.icone} ${p.label}: ${p.exp}`).join('\n')
        + '\nTudo que a ficha tem, em EXP (Livro, cap. 3). Não trava nada — é régua para o Narrador.';
}
window.atualizarPoderFicha = atualizarPoderFicha;
