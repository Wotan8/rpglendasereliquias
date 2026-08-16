/* =====================================================================
   ᛟ RUNOTECA — tudo que já foi gravado, de qualquer mão
   ---------------------------------------------------------------------
   O Grimório é do personagem: o que ELE sabe escrever. A Runoteca é do
   mundo: toda runa que existe cadastrada, venha de onde vier — peça
   gravada (system/data/equipment com a tag "Runa") ou tatuagem que virou
   Peculiaridade (system/data/peculiarities, mesma tag).

   Serve ao Mestre: escolher qualquer runa do mundo e ver a ficha técnica
   inteira. E serve ao Runomago: puxar de volta para a bancada um circuito
   que já foi gravado — porque a peça guarda o próprio desenho, a auditoria
   é RECALCULADA na hora, e não uma foto congelada do dia da gravação.
   ===================================================================== */

import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const LabRunoteca = (() => {
    const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

    const state = { itens: [], carregado: false, busca: '', abertos: new Set() };

    /** Runa de qualquer origem, normalizada para a mesma ficha. */
    function normalizar(doc, origem) {
        const b = doc.runa || {};
        return {
            id: `${origem}:${doc.id}`,
            docId: doc.id, origem,
            nome: b.nome || doc.nome || 'Runa sem nome',
            peca: origem === 'peculiaridade' ? 'Tatuagem' : (doc.nome || ''),
            ramo: b.ramo || '—',
            ct: b.ct ?? doc.ct ?? 0,
            bloco: b,
            canvas: b.canvas || null,
            tags: doc.tags || [],
        };
    }

    async function carregar() {
        const db = window.LabFB?.db || getFirestore();
        const [eq, pec] = await Promise.all([
            getDocs(collection(db, 'system', 'data', 'equipment')),
            getDocs(collection(db, 'system', 'data', 'peculiarities')),
        ]);
        const temRuna = d => d.runa && (d.runa.nome || d.runa.mira || d.runa.nucleo);
        const out = [];
        eq.forEach(d => { const x = { id: d.id, ...d.data() }; if (temRuna(x)) out.push(normalizar(x, 'item')); });
        pec.forEach(d => { const x = { id: d.id, ...d.data() }; if (temRuna(x)) out.push(normalizar(x, 'peculiaridade')); });
        out.sort((a, b) => a.nome.localeCompare(b.nome));
        state.itens = out;
        state.carregado = true;
        render();
    }

    /** Busca por nome, peça, ramo, Aspectus, Emissor ou condição aplicada. */
    function casa(r, q) {
        if (!q) return true;
        const b = r.bloco || {};
        const campos = [r.nome, r.peca, r.ramo, b.canal,
            b.nucleo?.artus, b.nucleo?.aspectus, b.nucleo?.emissor,
            ...(b.condicoesAplicadas || []).map(c => c.condicao),
            ...(r.tags || [])];
        return campos.some(c => norm(c).includes(q));
    }

    /** A ficha técnica: o que esta runa faz quando alguém a ativa. */
    function fichaHTML(r) {
        const b = r.bloco || {};
        const linha = (rot, val) => val ? `<div class="lab-rt-linha"><span>${rot}</span><b>${esc(val)}</b></div>` : '';
        const conds = (b.condicoesAplicadas || [])
            .map(c => `${c.condicao} ${c.nivel}` + (c.portao === 'critico' ? ' (só em crítico)' : ` (${c.chance}%)`))
            .join(' · ');
        const mira = b.mira ? `${b.mira.tipo}`
            + (b.mira.alcanceM != null ? ` · ${b.mira.alcanceM} m` : '')
            + (b.mira.raioM ? ` · raio ${b.mira.raioM} m` : '')
            + (b.mira.angGraus ? ` · ${b.mira.angGraus}°` : '') : '';
        return `<div class="lab-rt-ficha">
            ${linha('Núcleo', b.nucleo?.artus ? `${b.nucleo.artus} Nv${b.nucleo.nvArtus} + ${b.nucleo.aspectus} Nv${b.nucleo.nvAspectus}` : '')}
            ${linha('Emissor', b.nucleo?.emissor ? `${b.nucleo.emissor} Nv${b.nucleo.nvEmissor}` : '')}
            ${linha('Alvo da Runa', b.alvo || '')}
            ${linha('Dano', b.dano ? `${b.dano}${b.danoVerdadeiro ? ' — VERDADEIRO, sai da VIT máxima' : ` · ${b.canal || ''}`}` : '')}
            ${linha('Condições', conds)}
            ${linha('Mira', mira)}
            ${linha('Ativação', b.ativacao?.rotulo || '')}
            ${linha('Usos', b.permanente ? 'permanente no portador' : (b.usos != null ? String(b.usos) : ''))}
            ${linha('Sublimador', b.nucleo?.sublimador ? `Nv${b.nucleo.sublimador} — fere como essência` : '')}
            ${linha('Impressor', b.nucleo?.impressor ? `Nv${b.nucleo.impressor}` : '')}
            ${linha('Erosor', b.erosor ? `Nv${b.erosor.nivel} — ${b.erosor.usosPorCena} uso(s) por cena` : '')}
            ${linha('Sanidade ao gravar', b.sanidadeGravar || '')}
            ${linha('Exige perícia', b.periciaExigida || '')}
            ${(b.problemas || []).length ? `<div class="lab-rt-alerta">⚠️ ${b.problemas.map(esc).join('<br>⚠️ ')}</div>` : ''}
            <div class="lab-rt-acoes">
                ${r.canvas?.nodes?.length
                    ? `<button data-rt="mesa">🛠️ Abrir o circuito na mesa</button>`
                    : `<span class="lab-rt-semdesenho">Gravada antes de o circuito passar a ser guardado na peça — só a ficha técnica sobreviveu.</span>`}
            </div>
        </div>`;
    }

    function render() {
        const el = document.getElementById('labRunoteca');
        if (!el) return;
        if (!state.carregado) { el.innerHTML = '<div class="lab-empty">ᛟ Consultando a Runoteca…</div>'; return; }

        const q = norm(state.busca);
        const achados = state.itens.filter(r => casa(r, q));
        const busca = `<input type="search" id="labRunotecaBusca" class="lab-rt-busca" value="${esc(state.busca)}"
            placeholder="🔎 Buscar por nome, peça, Aspectus, Emissor ou condição — ${state.itens.length} runa(s) cadastrada(s)">`;

        el.innerHTML = busca + (!achados.length
            ? `<div class="lab-empty">${state.itens.length
                ? 'Nenhuma runa casa com essa busca.'
                : 'Nada gravado ainda. Grave uma runa pelo Grimório e ela aparece aqui.'}</div>`
            : achados.map(r => {
                const aberto = state.abertos.has(r.id);
                return `<div class="lab-rt-card ${aberto ? 'aberto' : ''}" data-id="${esc(r.id)}">
                    <div class="lab-rt-head" data-rt="alternar">
                        <b>ᛟ ${esc(r.nome)}</b>
                        <span class="lab-rt-peca">${r.origem === 'peculiaridade' ? '🪡' : '📜'} ${esc(r.peca)}</span>
                        <span class="lab-rt-ct">${esc(r.ramo)} · CT ${r.ct}</span>
                    </div>
                    ${aberto ? fichaHTML(r) : ''}
                </div>`;
            }).join(''));

        const input = document.getElementById('labRunotecaBusca');
        if (input) {
            input.addEventListener('input', ev => {
                state.busca = ev.target.value;
                const pos = ev.target.selectionStart;
                render();
                const novo = document.getElementById('labRunotecaBusca');
                if (novo) { novo.focus(); novo.setSelectionRange(pos, pos); }
            });
        }
        el.querySelectorAll('[data-rt]').forEach(b => b.addEventListener('click', ev => {
            const card = ev.target.closest('.lab-rt-card');
            const r = state.itens.find(x => x.id === card?.dataset.id);
            if (!r) return;
            if (b.dataset.rt === 'alternar') {
                state.abertos.has(r.id) ? state.abertos.delete(r.id) : state.abertos.add(r.id);
                render();
            } else if (b.dataset.rt === 'mesa') {
                // A auditoria é REFEITA a partir do desenho: a peça guarda o
                // circuito, não o resultado de um dia.
                window.LabCanvas?.loadState?.(r.canvas);
                const nome = document.getElementById('labRunaNome');
                if (nome) nome.value = r.nome;
                window.labSwitchTab?.('montagem');
            }
        }));
    }

    return {
        boot() { carregar().catch(e => { console.error('runoteca', e); state.carregado = true; render(); }); },
        recarregar: carregar,
    };
})();
window.LabRunoteca = LabRunoteca;
