/* =====================================================================
   ᛟ BANCADA — Materiais e carga da gravação (Laboratorium Runarum)
   ---------------------------------------------------------------------
   Lê o inventário do personagem (coleção `items`, characterId == charId),
   reconhece o que serve à gravação (tag "Bancada Rúnica" no catálogo, mais
   os Lunis), deixa selecionar instrumento e quantidades, e fecha duas
   contas que a auditoria genérica não fechava:

     1. MATERIAIS — a lista exata do que o ramo exige para o CT atual,
        contra o que está selecionado. Falta aparece em vermelho, como
        violação.
     2. CARGA/EXAUSTÃO — os Lunis selecionados viram Ess (25/Luni, Ativados
        = 100%), passam pelo teto de absorção do circuito (Sifão Cristalino
        + Amplificador de Captação, §2.4) e pelo Armazenador; o excedente
        corre ao Exaustor; o que sobrar é Sobrecarga, o que faltar é
        Subcarga — com as tabelas §2.8–2.9 que já vivem em RUNO_TABELAS.

   Comportamento de material (campo `comportamentoMaterial` do catálogo):
     consumido    → quantidade desconta ao consumir
     desgastavel  → +1 de `desgaste` na instância; estraga se 1d10 ≤ desgaste
     resistente   → não gasta em uso normal

   Requisitos por ramo (espec RUNIMAGO-CLASSE §6/§7):
     Escripta   pincel ≥1 · tinta ⌈CT÷10⌉ doses · papel 1
     Talha      talhadeira ≥1 (a superfície é o objeto alvo, fora daqui)
     Tatuagem   agulhas max(1,⌈CT÷20⌉) · tinta ⌈CT÷10⌉ · Infusor no circuito
   ===================================================================== */

import { getFirestore, collection, getDocs, query, where, doc, updateDoc, setDoc, addDoc }
    from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { blocoDeCombate } from '../../shared/runa-em-jogo.js?v=1';
import { instanciarDoModelo } from '../../shared/equip-campos.js?v=9';

const LabBancada = (() => {

    const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

    const state = {
        carregado: false,
        instancias: [],      // instâncias do personagem já casadas com o catálogo
        lunsDisponiveis: 0,
        ramo: 'escripta',
        sel: {},             // instId -> qtd selecionada (ferramentas: 1 = em uso)
        lunis: 0,
        ultimaAudit: null,
        // 🎯 O que o PROJETO decide, e que nenhum outro campo sabe: qual marca
        // o Impressor imprime, e o que o Manifestador manifesta.
        escolhas: { condicoes: [], manifestacao: null },
    };

    // ---------- carga do inventário ----------
    async function carregar() {
        const fb = window.LabFB;
        if (!fb?.charId) { state.carregado = true; render(); return; }
        const db = fb.db || getFirestore();
        const [itensSnap, catSnap] = await Promise.all([
            getDocs(query(collection(db, 'items'), where('characterId', '==', fb.charId))),
            getDocs(query(collection(db, 'system', 'data', 'equipment'),
                where('tags', 'array-contains', 'Bancada Rúnica'))),
        ]);
        const catalogo = {};
        catSnap.forEach(d => catalogo[d.id] = { id: d.id, ...d.data() });

        const brutos = [];
        itensSnap.forEach(d => brutos.push({ id: d.id, ...d.data() }));

        /* Equipado direto, ou dentro de container equipado (pai equipado). */
        const paisEquipados = new Set(brutos.filter(i => i.equipado && !i.parentItemId).map(i => i.id));
        const acessivel = i => (i.equipado && !i.parentItemId) || (i.parentItemId && paisEquipados.has(i.parentItemId));

        state.instancias = brutos
            .map(i => ({ ...i, cat: catalogo[i.modeloId] || null }))
            .filter(i => i.cat && acessivel(i));

        /* Lunis: o dinheiro do inventário. Instância cujo nome/modelo contém "lun". */
        state.lunsDisponiveis = brutos
            .filter(i => /\blun/i.test(norm(i.nome || '')) && acessivel(i))
            .reduce((s, i) => s + (Number(i.quantidade) || 0), 0);

        /* pré-seleção: primeira ferramenta de cada tipo */
        state.carregado = true;
        render();
    }

    /* =====================================================================
       🎯 O PROJETO — as escolhas que só o desenho do circuito destrava
       ---------------------------------------------------------------------
       O Impressor e o Manifestador existem no cadastro e no motor desde a
       etapa 3, mas não havia onde escolher: `condicoesEscolhidas` e
       `manifestacao` eram lidos e nunca escritos, então todo Impressor caía no
       fallback (a primeira condição do repertório) e o Manifestador não
       manifestava nada em particular. Esta seção é o lugar da escolha.
       ===================================================================== */

    /** Os nós do circuito com o elemento do catálogo junto. */
    function nosDoCircuito() {
        const nodes = window.LabCanvas?.getState?.()?.nodes || [];
        const els = window.LabFB?.elementsById || {};
        return nodes.map(n => ({ ...n, el: els[n.elementId] })).filter(n => n.el);
    }
    const temFlag = (el, f) => Array.isArray(el?.flags) && el.flags.map(norm).includes(f);
    const maiorPor = (nos, teste) => nos.filter(n => teste(n.el))
        .sort((a, b) => Number(b.nivel) - Number(a.nivel))[0] || null;

    /** O que o circuito destrava agora: Aspectus, Impressor, Sublimador, Manifestador. */
    function projetoAtual() {
        const nos = nosDoCircuito();
        const asp = maiorPor(nos, el => norm(el.tipoElemento) === 'aspectus');
        const imp = maiorPor(nos, el => temFlag(el, 'impressor'));
        const sub = maiorPor(nos, el => temFlag(el, 'sublimador'));
        const man = maiorPor(nos, el => /manifestador/.test(norm(el.nome)));
        const coringa = !!asp?.el?.formaFisicaCoringa;
        const essencia = !!sub || (!!asp?.el?.sublimadorObrigatorio && coringa);
        return {
            asp: asp?.el || null, nvAsp: Number(asp?.nivel) || 0,
            imp: imp?.el || null, nvImp: Number(imp?.nivel) || 0,
            man: man?.el || null, nvMan: Number(man?.nivel) || 0,
            essencia,
            // O repertório que vale AGORA: com Sublimador é o de essência.
            repertorio: essencia ? (asp?.el?.condicoesEssencia || []) : (asp?.el?.condicoesFisicas || []),
            criticas: asp?.el?.condicaoCritica || [],
        };
    }

    /** O painel de escolhas. Vazio quando o circuito não destrava nenhuma. */
    function htmlProjeto() {
        const j = projetoAtual();
        if (!j.imp && !j.man) return '';
        let html = '<div class="lab-banc-projeto"><h5>🎯 Projeto</h5>';

        if (j.imp) {
            const disp = [...j.repertorio.map(c => ({ ...c, critica: false })),
                          ...(j.nvImp >= 3 ? j.criticas.map(c => ({ ...c, critica: true })) : [])];
            const chance = j.nvAsp * (j.essencia ? 20 : 10);
            const marcadas = state.escolhas.condicoes;
            html += `<div class="lab-banc-esc">
                <div class="lab-banc-esc-cab">🔶 ${esc(j.imp.nome)} Nv${j.nvImp}
                    <small>escolhe até ${j.nvImp} · ${j.essencia ? 'repertório de essência' : 'repertório físico'} de ${esc(j.asp?.nome || '?')}</small></div>`;
            if (!disp.length) {
                html += `<small>${j.asp ? esc(j.asp.nome) + ' não tem repertório ' + (j.essencia ? 'de essência' : 'físico') + ' — grave um Sublimador ou troque a natureza.' : 'Sem Aspectus no circuito: não há natureza para moldar.'}</small>`;
            } else {
                html += disp.map(c => {
                    const on = marcadas.includes(c.condicao);
                    const cheio = !on && marcadas.length >= j.nvImp;
                    return `<label class="lab-banc-cond ${c.critica ? 'crit' : ''} ${cheio ? 'cheio' : ''}">
                        <input type="checkbox" data-cond="${esc(c.condicao)}" ${on ? 'checked' : ''} ${cheio ? 'disabled' : ''}>
                        ${esc(c.condicao)} ${j.nvAsp || 1}
                        <small>${c.critica ? 'só em acerto crítico' : chance + '%'}</small></label>`;
                }).join('');
                if (!marcadas.length) html += `<small class="lab-banc-fallback">Nada marcado: vale a primeira do repertório (${esc(disp[0].condicao)}), como o cânone promete.</small>`;
                if (j.nvImp < 3 && j.criticas.length) html += `<small class="lab-banc-fallback">A marca de crítico (${j.criticas.map(c => esc(c.condicao)).join(', ')}) só é alcançada por um Impressor Nv3.</small>`;
            }
            html += '</div>';
        }

        if (j.man) {
            const opcoes = j.man.manifestacoes || [];
            html += `<div class="lab-banc-esc">
                <div class="lab-banc-esc-cab">🧱 ${esc(j.man.nome)} Nv${j.nvMan}
                    <small>${esc(j.man.niveis?.[j.nvMan - 1]?.mira?.volumeM3 ?? '?')} m³ de ${esc(j.man.niveis?.[j.nvMan - 1]?.mira?.material ?? '?')}</small></div>`;
            html += opcoes.map(o => {
                const bloqueado = j.nvMan < Number(o.nivelMin || 1);
                const on = state.escolhas.manifestacao === o.chave;
                return `<label class="lab-banc-cond ${bloqueado ? 'cheio' : ''}">
                    <input type="radio" name="labManif" data-manif="${esc(o.chave)}" ${on ? 'checked' : ''} ${bloqueado ? 'disabled' : ''}>
                    ${esc(o.nome)} <small>${bloqueado ? `exige Nv${o.nivelMin}` : esc(o.desc || '')}</small></label>`;
            }).join('') || '<small>Este Manifestador ainda não tem manifestações cadastradas.</small>';
            if (!state.escolhas.manifestacao) html += '<small class="lab-banc-fallback">Sem escolha, a runa manifesta massa bruta — o Mestre decide na mesa o que ela vira.</small>';
            html += '</div>';
        }
        return html + '</div>';
    }

    // ---------- requisitos por ramo ----------
    const FERRAMENTA = { escripta: 'pincel', talha: 'talhadeira', tatuagem: 'agulha' };
    function requisitos(ct) {
        if (!ct) return [];
        const tintas = Math.ceil(ct / 10);
        if (state.ramo === 'escripta') return [
            { tipo: 'ferramenta', casa: /pincel/i, rotulo: 'Pincel', qtd: 1 },
            { tipo: 'consumo', casa: /tinta/i, rotulo: `Tinta (${tintas} dose${tintas > 1 ? 's' : ''})`, qtd: tintas },
            { tipo: 'consumo', casa: /papel/i, rotulo: 'Papel de Gravação', qtd: 1 },
        ];
        if (state.ramo === 'talha') return [
            { tipo: 'ferramenta', casa: /talhadeira/i, rotulo: 'Talhadeira', qtd: 1 },
            { tipo: 'nota', rotulo: 'Superfície: o objeto alvo (fora do inventário)' },
        ];
        return [
            { tipo: 'ferramenta', casa: /agulha/i, rotulo: `Agulhas (${Math.max(1, Math.ceil(ct / 20))})`, qtd: Math.max(1, Math.ceil(ct / 20)), consome: true },
            { tipo: 'consumo', casa: /tinta/i, rotulo: `Tinta (${tintas} dose${tintas > 1 ? 's' : ''})`, qtd: tintas },
            { tipo: 'circuito', rotulo: 'Infusor no circuito (§6.4 — superfície viva)' },
        ];
    }

    /* Nó do canvas: { elementId, x, y, nivel, id } — id é o uid do NÓ. */
    function circuitoTemInfusor() {
        const nodes = window.LabCanvas?.getState?.()?.nodes || [];
        const els = window.LabFB?.elementsById || {};
        return nodes.some(n => /infusor/.test(norm(els[n.elementId]?.nome || '')));
    }

    /* teto de absorção §2.4: Sifão Cristalino Nv1 = 25 · Nv2–3 = 50;
       + Amplificador de Captação Nv1/2/3 = 75/125/250. */
    function tetoAbsorcao() {
        const nodes = window.LabCanvas?.getState?.()?.nodes || [];
        const els = window.LabFB?.elementsById || {};
        let sifaoNv = 0, ampNv = 0;
        for (const n of nodes) {
            const nome = norm(els[n.elementId]?.nome || '');
            const nv = Number(n.nivel || 1);
            if (/sifao cristalino/.test(nome)) sifaoNv = Math.max(sifaoNv, nv);
            if (/amplificador de captacao/.test(nome)) ampNv = Math.max(ampNv, nv);
        }
        if (!sifaoNv) return 0;
        if (ampNv) return [0, 75, 125, 250][ampNv] || 250;
        return sifaoNv >= 2 ? 50 : 25;
    }

    // ---------- as duas contas ----------
    function contaMateriais(ct) {
        const reqs = requisitos(ct);
        return reqs.map(r => {
            if (r.tipo === 'nota') return { ...r, ok: true, aviso: true };
            if (r.tipo === 'circuito') return { ...r, ok: circuitoTemInfusor() };
            const fontes = state.instancias.filter(i => r.casa.test(norm(i.cat.nome)));
            const selecionado = fontes.reduce((s, i) => s + (Number(state.sel[i.id]) || 0), 0);
            const disponivel = fontes.reduce((s, i) => s + (Number(i.quantidade) || 1), 0);
            return { ...r, ok: selecionado >= r.qtd, selecionado, disponivel };
        });
    }

    function contaCarga(a) {
        const ct = a?.ct || 0;
        const essIn = state.lunis * 25;                       // Ativados = 100% (§2.3)
        const teto = tetoAbsorcao();
        const captado = teto ? Math.min(essIn, teto) : 0;
        const armazem = a?.armazenamento?.capacidade || 0;
        const guardado = Math.min(captado, armazem);
        const excedente = Math.max(0, captado - armazem);
        const exaustor = a?.exaustao?.presente ? (a.exaustao.capacidade || 0) : 0;
        const sobrecarga = Math.max(0, excedente - exaustor);
        const pct = ct ? Math.floor((guardado / ct) * 100) : 0;
        const tabela = (window.RUNO_TABELAS?.subcarga || []).find(r => pct >= r.min);
        return { essIn, teto, captado, armazem, guardado, excedente, exaustor, sobrecarga, pct, faixa: tabela };
    }

    // ---------- UI ----------
    function render() {
        const a = state.ultimaAudit;
        const host = document.getElementById('labBancada');
        if (!host) return;
        if (!window.LabFB?.charId) {
            host.innerHTML = '<div class="lab-banc-vazio">🧰 Abra o Laboratorium pela ficha para usar a Bancada (inventário do personagem).</div>';
            return;
        }
        if (!state.carregado) { host.innerHTML = '<div class="lab-banc-vazio">🧰 Lendo o inventário…</div>'; return; }

        const ct = a?.ct || 0;
        const mats = contaMateriais(ct);
        const carga = contaCarga(a);
        const grupos = { ferramenta: [], consumo: [] };
        for (const i of state.instancias) {
            const comp = i.cat.comportamentoMaterial || 'consumido';
            (comp === 'consumido' ? grupos.consumo : grupos.ferramenta).push(i);
        }

        const linhaItem = i => {
            const comp = i.cat.comportamentoMaterial || 'consumido';
            const desg = Number(i.desgaste || 0);
            const risco = comp === 'desgastavel' && desg >= 7 ? ` <b class="lab-banc-risco">⚠ ${desg * 10}% de estragar</b>` :
                comp === 'desgastavel' && desg > 0 ? ` <small>desgaste ${desg}</small>` : '';
            const dentro = i.parentItemId ? ' <small>📦</small>' : '';
            if (comp === 'consumido') {
                const max = Number(i.quantidade) || 1;
                return `<div class="lab-banc-item"><label>${esc(i.cat.nome)}${dentro} <small>(${max})</small></label>
                    <input type="number" min="0" max="${max}" value="${Number(state.sel[i.id]) || 0}" data-sel="${i.id}"></div>`;
            }
            return `<div class="lab-banc-item"><label><input type="checkbox" data-sel="${i.id}" ${state.sel[i.id] ? 'checked' : ''}>
                ${esc(i.cat.nome)}${dentro}${risco}</label></div>`;
        };

        host.innerHTML = `
            <div class="lab-banc-ramo">
                ${['escripta', 'talha', 'tatuagem'].map(r =>
                    `<button data-ramo="${r}" class="${state.ramo === r ? 'ativo' : ''}">${{ escripta: '🖌️ Escripta', talha: '🪨 Talha', tatuagem: '🪡 Tatuagem' }[r]}</button>`).join('')}
            </div>
            <div class="lab-banc-grupos">
                <div><h5>Ferramentas</h5>${grupos.ferramenta.map(linhaItem).join('') || '<small>nenhuma equipada</small>'}</div>
                <div><h5>Consumíveis</h5>${grupos.consumo.map(linhaItem).join('') || '<small>nenhum equipado</small>'}</div>
                <div><h5>Carga</h5>
                    <div class="lab-banc-item"><label>Lunis <small>(tem ${state.lunsDisponiveis})</small></label>
                    <input type="number" min="0" max="${state.lunsDisponiveis}" value="${state.lunis}" data-lunis></div>
                    <small>${state.lunis * 25} Ess brutos</small>
                </div>
            </div>
            <div class="lab-banc-reqs">
                <h5>Exige (${{ escripta: 'Escripta', talha: 'Talha', tatuagem: 'Tatuagem' }[state.ramo]}, CT ${ct})</h5>
                ${ct ? mats.map(m => `<div class="lab-banc-req ${m.ok ? 'ok' : 'falta'}">${m.ok ? (m.aviso ? 'ℹ️' : '✅') : '⛔'} ${esc(m.rotulo)}${m.selecionado != null ? ` — sel. ${m.selecionado}${m.disponivel != null ? ` / tem ${m.disponivel}` : ''}` : ''}</div>`).join('')
                    : '<small>Monte um circuito para ver os requisitos.</small>'}
            </div>
            ${ct ? `<div class="lab-banc-carga">
                <h5>♨️ Balanço de carga</h5>
                <div class="lab-banc-fluxo">${carga.essIn} Ess ${carga.teto ? `→ teto ${carga.teto}` : '→ <b class="lab-banc-risco">sem Sifão Cristalino</b>'} → armazém ${carga.armazem} → exaustor ${carga.exaustor}</div>
                ${carga.faixa ? `<div class="lab-banc-req ${carga.pct >= 100 ? 'ok' : 'falta'}">${carga.pct >= 100 ? '✅' : '⚠️'} ${carga.pct}% do CT — <b style="color:${carga.faixa.cor}">${carga.faixa.nome}</b><br><small>${esc(carga.faixa.efeito)}</small></div>` : ''}
                ${carga.sobrecarga > 0 ? (() => {
                    const f = (window.RUNO_TABELAS?.sobrecarga || []).find(r => carga.sobrecarga >= r.min && carga.sobrecarga <= r.max);
                    return `<div class="lab-banc-req falta">⛔ Sobrecarga de ${carga.sobrecarga} Ess — <span style="color:${f?.cor}">${esc(f?.efeito || '')}</span></div>`;
                })() : ''}
                ${carga.essIn > carga.teto && carga.teto ? `<div class="lab-banc-req falta">⚠️ ${carga.essIn - carga.teto} Ess acima do teto de absorção — carregue em série (§2.4)</div>` : ''}
            </div>` : ''}
            ${htmlProjeto()}
            <button id="labBancConsumir" ${ct && mats.every(m => m.ok) ? '' : 'disabled'}
                title="Desconta consumíveis, soma desgaste nas ferramentas e debita os Lunis">🔥 Consumir materiais da gravação</button>`;

        host.querySelectorAll('[data-sel]').forEach(el => el.addEventListener('change', ev => {
            const id = ev.target.dataset.sel;
            state.sel[id] = ev.target.type === 'checkbox' ? (ev.target.checked ? 1 : 0) : Number(ev.target.value) || 0;
            render();
        }));
        host.querySelector('[data-lunis]')?.addEventListener('change', ev => {
            state.lunis = Math.max(0, Math.min(state.lunsDisponiveis, Number(ev.target.value) || 0)); render();
        });
        host.querySelectorAll('[data-ramo]').forEach(b => b.addEventListener('click', () => { state.ramo = b.dataset.ramo; render(); }));
        host.querySelectorAll('[data-cond]').forEach(el => el.addEventListener('change', ev => {
            const nome = ev.target.dataset.cond;
            const lista = state.escolhas.condicoes;
            const i = lista.indexOf(nome);
            if (ev.target.checked) { if (i < 0) lista.push(nome); }
            else if (i >= 0) lista.splice(i, 1);
            render();
        }));
        host.querySelectorAll('[data-manif]').forEach(el => el.addEventListener('change', ev => {
            state.escolhas.manifestacao = ev.target.dataset.manif;
            render();
        }));
        host.querySelector('#labBancConsumir')?.addEventListener('click', consumir);
    }

    /* Desconta o que a gravação usa. Escritas mínimas e explícitas. */
    async function consumir() {
        if (!confirm('Consumir os materiais selecionados?\n(desconta consumíveis, +1 desgaste nas ferramentas, debita Lunis)')) return;
        const db = window.LabFB.db || getFirestore();
        const escritas = [];
        for (const i of state.instancias) {
            const q = Number(state.sel[i.id]) || 0;
            if (!q) continue;
            const comp = i.cat.comportamentoMaterial || 'consumido';
            if (comp === 'consumido') {
                escritas.push(updateDoc(doc(db, 'items', i.id), { quantidade: Math.max(0, (Number(i.quantidade) || 0) - q) }));
                i.quantidade = Math.max(0, (Number(i.quantidade) || 0) - q);
            } else if (comp === 'desgastavel') {
                escritas.push(updateDoc(doc(db, 'items', i.id), { desgaste: Number(i.desgaste || 0) + 1 }));
                i.desgaste = Number(i.desgaste || 0) + 1;
            }
        }
        /* Lunis: debita da primeira pilha acessível */
        if (state.lunis > 0) {
            let restante = state.lunis;
            const itensSnap = await getDocs(query(collection(db, 'items'), where('characterId', '==', window.LabFB.charId)));
            const pilhas = []; itensSnap.forEach(d => { const it = { id: d.id, ...d.data() }; if (/\blun/i.test(norm(it.nome || ''))) pilhas.push(it); });
            for (const p of pilhas) {
                if (restante <= 0) break;
                const tira = Math.min(restante, Number(p.quantidade) || 0);
                if (tira > 0) { escritas.push(updateDoc(doc(db, 'items', p.id), { quantidade: (Number(p.quantidade) || 0) - tira })); restante -= tira; }
            }
            state.lunsDisponiveis -= state.lunis; state.lunis = 0;
        }
        await Promise.all(escritas).catch(e => console.error('bancada/consumir', e));
        state.sel = {};
        render();
    }

    // ---------- 🜃 enviar runa do Grimório para a ficha ----------
    /* Cria o item no módulo Cartucho Rúnico (char.classModuleData.cartucho_runico),
       no formato exato que a ficha lê: mapa chave-do-schema → valor.
       Schema do Cartucho: 1 Nome · 2 Ramo · 3 CT · 4 Alvo · 5 Usos (contador) ·
       6 Efeito · 7 Condições · 8 Gatilho/acesso · 9 Ficha técnica (link). */
    /* ᛟ O mapa fixo de "cada Aspectus aplica tal condição" MORREU aqui.
       Cada Aspectus tem repertório próprio no registro (condicoesFisicas /
       condicoesEssencia / condicaoCritica), e quem escolhe é o Impressor
       gravado no circuito. Quem monta isso é shared/runa-em-jogo.js. */

    /** O dot da ficha que casa com um fragmento de nome de perícia. */
    function achaDot(frag) {
        const dots = { ...(window.LabFB.charData?.dots || {}), ...(window.LabFB.charData?.effectiveDots || {}) };
        let best = 0;
        Object.keys(dots).forEach(k => {
            if (norm(k).replace(/[^a-z0-9]/g, '').includes(frag)) best = Math.max(best, Number(dots[k] || 0));
        });
        return best;
    }

    /** Melhor tinta selecionada na Bancada — é ela que define a qualidade. */
    const qualidadeTintaSelecionada = () => Math.max(0, ...state.instancias
        .filter(i => /tinta/i.test(norm(i.cat?.nome)) && (Number(state.sel[i.id]) || 0) > 0)
        .map(i => Number(i.cat.qualidadeMaterial || 0)));

    /** O Domínio do ofício (Peculiaridade de 12 EXP). Sem ele, rascunho. */
    const temDominioDoRamo = () => {
        const pecs = (window.LabFB.charData?.peculiaridades || window.LabFB.charData?.pecs || []);
        const alvo = { escripta: 'dominiodeescripta', talha: 'dominiodetalha', tatuagem: 'dominiodetatuagem' }[state.ramo];
        return (Array.isArray(pecs) ? pecs : Object.values(pecs || {}))
            .some(p => norm(typeof p === 'string' ? p : (p?.nome || '')).replace(/[^a-z0-9]/g, '').includes(alvo));
    };

    /**
     * ᛟ O circuito auditado virando runa jogável. Toda a régua mora no módulo
     * puro; aqui só se junta o que a ficha e a Bancada sabem.
     */
    function blocoDaRuna(runa) {
        const fb = window.LabFB;
        const periciaDoRamo = { escripta: 'escriptarunica', talha: 'talharunica', tatuagem: 'tatuagemrunica' }[state.ramo];
        return blocoDeCombate({
            nodes: runa.canvas?.nodes || [],
            elementsById: fb.elementsById,
            ct: runa.ct || 0,
            ramo: state.ramo,
            runomancia: Number(fb.ctx?.runomancia || 0),
            tetoOficio: fb.ctx?.tetoRunomancia ?? null,
            pericia: achaDot(periciaDoRamo),
            qualidadeTinta: qualidadeTintaSelecionada(),
            temDominio: temDominioDoRamo(),
            // Runa vinda do Grimório traz a própria escolha; a que está sendo
            // montada agora usa a da bancada.
            condicoesEscolhidas: runa.condicoesEscolhidas || state.escolhas.condicoes,
            manifestacao: runa.manifestacao || state.escolhas.manifestacao,
        });
    }

    /* =====================================================================
       ᛟ EMITIR — o projeto vira uma coisa que existe no mundo
       ---------------------------------------------------------------------
       Escripta e Talha gravam SOBRE UMA PEÇA: o papel continua sendo papel, o
       osso continua sendo osso, e agora queimam gente. Por isso a emissão
       copia o cadastro do item-base (instanciarDoModelo) e acrescenta o bloco
       `runa` por cima — não existe "item runa", existe o item que virou runa.

       O MODELO vai para o catálogo e a INSTÂNCIA para a ficha. Quando os usos
       acabam, some a instância e o modelo fica: é o que deixa refazer a peça,
       inspecionar no Laboratorium e o Mestre distribuir cópias como loot.

       Tatuagem não tem peça: vira Peculiaridade, e o Mestre aplica na carne.
       ===================================================================== */

    /** Peças do inventário que servem de superfície para o ramo atual. */
    function basesPossiveis() {
        const bom = state.ramo === 'talha'
            ? /pedra|osso|metal|madeira|placa|tabua|lasca|cristal/
            : /papel|pergaminho|tecido|folha|vitela|couro/;
        const candidatas = state.instancias.filter(i => bom.test(norm(i.nome || i.cat?.nome || '')));
        // Nada com cara de superfície: deixa escolher qualquer coisa acessível.
        return candidatas.length ? candidatas : state.instancias;
    }

    /** Pergunta em que peça a runa vai ser gravada. null = desistiu. */
    function escolherBase() {
        const opts = basesPossiveis();
        if (!opts.length) {
            alert('Nenhuma peça no inventário para gravar.\n\nA runa precisa de uma superfície: papel e pergaminho na Escripta, pedra, osso ou metal na Talha.');
            return null;
        }
        if (opts.length === 1) return opts[0];
        const lista = opts.map((i, k) => (k + 1) + '. ' + (i.nome || i.cat?.nome)).join('\n');
        const r = prompt('Em que peça a runa vai ser gravada?\n\n' + lista + '\n\nDigite o número:', '1');
        if (r === null) return null;
        return opts[parseInt(r, 10) - 1] || null;
    }

    /** Resumo legível do bloco — serve ao confirm e à descrição da peça. */
    function resumoDoBloco(b) {
        const l = [];
        if (b.nucleo.artus) l.push('Núcleo: ' + b.nucleo.artus + ' Nv' + b.nucleo.nvArtus + ' + ' + b.nucleo.aspectus + ' Nv' + b.nucleo.nvAspectus);
        if (b.nucleo.emissor) l.push('Emissor: ' + b.nucleo.emissor + ' Nv' + b.nucleo.nvEmissor);
        if (b.dano) l.push('Dano ' + b.dano + (b.danoVerdadeiro ? ' VERDADEIRO (ignora Blindagem e sai da VIT máxima)' : ' · ' + b.canal));
        if (b.alvo) l.push('Alvo da Runa ' + b.alvo + ' — só erra se o alvo declarar Defesa');
        for (const c of b.condicoesAplicadas) {
            l.push('Aplica ' + c.condicao + ' ' + c.nivel + (c.portao === 'critico' ? ' (só em crítico)' : ' (' + c.chance + '%)'));
        }
        if (b.mira) l.push('Mira: ' + b.mira.tipo + (b.mira.alcanceM != null ? ' · ' + b.mira.alcanceM + ' m' : '') + (b.mira.raioM ? ' · raio ' + b.mira.raioM + ' m' : ''));
        l.push(b.ativacao.rotulo);
        l.push(b.permanente ? 'Permanente no portador' : b.usos + ' uso(s)' + (b.rascunho ? ' — RASCUNHO, sem o Domínio do ofício' : ''));
        if (b.sanidadeGravar) l.push('⚠️ custa ' + b.sanidadeGravar + ' de Sanidade para gravar');
        return l.join('\n');
    }

    async function emitirRuna(runa, toast) {
        const fb = window.LabFB;
        if (!fb?.charId) { toast?.('❌ Abra o Laboratorium pela ficha para emitir runas.'); return; }
        const ramoNome = { escripta: 'Escripta', talha: 'Talha', tatuagem: 'Tatuagem' }[state.ramo];
        const b = blocoDaRuna(runa);

        if (b.problemas.length) {
            const seguir = confirm('⚠️ Este circuito não fecha como runa de combate:\n\n· ' + b.problemas.join('\n· ')
                + '\n\nEmitir assim mesmo? A peça existe, mas o Tabuleiro não vai saber resolvê-la sozinho.');
            if (!seguir) return;
        }
        if (b.periciaExigida && !achaDot(norm(b.periciaExigida).replace(/[^a-z0-9]/g, ''))) {
            alert('🚫 ' + b.nucleo.aspectus + ' exige a perícia ' + b.periciaExigida + ' para ser gravado.');
            return;
        }

        const db = fb.db || getFirestore();
        const agora = new Date().toISOString();
        const base = state.ramo === 'tatuagem' ? null : escolherBase();
        if (state.ramo !== 'tatuagem' && !base) return;

        const cabeca = state.ramo === 'tatuagem'
            ? 'Tatuar "' + runa.nome + '" como Peculiaridade?'
            : 'Gravar "' + runa.nome + '" em ' + (base.nome || base.cat?.nome) + '?';
        if (!confirm(cabeca + '\n(' + ramoNome + ')\n\n' + resumoDoBloco(b))) return;

        try {
            if (state.ramo === 'tatuagem') {
                await addDoc(collection(db, 'system', 'data', 'peculiarities'), {
                    nome: 'ᛟ ' + runa.nome,
                    descricao: 'Runa tatuada (' + ramoNome + ').\n\n' + resumoDoBloco(b),
                    tags: ['Runa', 'Tatuagem'],
                    ehVantagem: true, publicado: true, versao: 1,
                    mecanicaIds: [], derivedValueIds: [],
                    runa: { ...b, nome: runa.nome, ramo: state.ramo, ct: runa.ct, origemGrimorio: runa.id,
                        // 🛠️ O DESENHO vai junto: e o que deixa a Runoteca refazer a
                        // auditoria depois, em vez de guardar a foto de um dia so.
                        canvas: runa.canvas || null },
                    fonte: 'Runomancia', fonteRef: fb.charId,
                    criadoEm: agora, atualizadoEm: agora,
                });
                toast?.('🪡 "' + runa.nome + '" cadastrada como Peculiaridade — o Mestre aplica em quem a carne for.');
            } else {
                /* 1) o MODELO no catálogo: é ele que sobrevive aos usos */
                const modeloBase = base.cat || {};
                const modeloId = 'runa_' + fb.charId + '_' + runa.id;
                const modelo = {
                    ...modeloBase,
                    nome: runa.nome + ' (' + (modeloBase.nome || base.nome) + ')',
                    descricao: ramoNome + ' sobre ' + (modeloBase.nome || base.nome) + '.\n\n' + resumoDoBloco(b),
                    tags: [...new Set([...(modeloBase.tags || []), 'Runa', ramoNome])],
                    runa: { ...b, nome: runa.nome, ramo: state.ramo, ct: runa.ct, origemGrimorio: runa.id,
                        // 🛠️ O DESENHO vai junto: e o que deixa a Runoteca refazer a
                        // auditoria depois, em vez de guardar a foto de um dia so.
                        canvas: runa.canvas || null },
                    publicado: true, atualizadoEm: agora,
                };
                delete modelo.id;
                await setDoc(doc(db, 'system', 'data', 'equipment', modeloId), modelo, { merge: true });

                /* 2) a INSTÂNCIA na ficha, cópia integral do modelo */
                const itemId = 'item-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
                await setDoc(doc(db, 'items', itemId), {
                    ...instanciarDoModelo({ ...modelo, id: modeloId }),
                    id: itemId, characterId: fb.charId, ownerType: 'char',
                    ownerUid: window.currentUser?.uid || null, ownerId: window.currentUser?.uid || null,
                    quantidade: 1, equipado: false, slotAnatomico: null, estadoEquip: null, parentItemId: null,
                    criadoPor: 'runomancia',
                    usosRestantes: b.permanente ? null : b.usos,
                    lastModified: agora,
                });
                toast?.('ᛟ "' + runa.nome + '" gravada em ' + (modeloBase.nome || base.nome) + ' — ' + b.usos + ' uso(s). Recarregue a ficha.');
            }

            /* 3) o Cartucho continua sendo o grimório: registra o que ele sabe */
            await registrarNoCartucho(runa, b, ramoNome, db, fb);
        } catch (e) {
            console.error('bancada/emitirRuna', e);
            toast?.('❌ Falha ao emitir — veja o console.');
        }
    }

    /** O Cartucho Rúnico é o grimório: o que o mago sabe escrever, feito ou não. */
    async function registrarNoCartucho(runa, b, ramoNome, db, fb) {
        const condicoes = b.condicoesAplicadas
            .map(c => c.condicao + ' ' + c.nivel + (c.portao === 'critico' ? ' (crítico)' : ' (' + c.chance + '%)'))
            .join(' · ');
        const item = {
            '1': runa.nome, '2': ramoNome, '3': runa.ct || 0, '4': b.alvo || 0,
            '5': b.permanente ? '∞' : b.usos, '6': resumoDoBloco(b), '7': condicoes,
            '8': b.ativacao.rotulo, '9': '',
            _origemGrimorio: runa.id,
        };
        const atuais = (fb.charData?.classModuleData?.cartucho_runico) || [];
        const novos = [...atuais.filter(i => i._origemGrimorio !== runa.id), item];
        await updateDoc(doc(db, 'char', fb.charId), {
            'classModuleData.cartucho_runico': novos,
            lastUpdate: new Date().toISOString(),
        });
        fb.charData = fb.charData || {};
        fb.charData.classModuleData = { ...(fb.charData.classModuleData || {}), cartucho_runico: novos };
    }

    /** Só anota no grimório da ficha, sem emitir peça nenhuma. */
    async function enviarParaFicha(runa, toast) {
        const fb = window.LabFB;
        if (!fb?.charId) { toast?.('❌ Abra o Laboratorium pela ficha para enviar runas.'); return; }
        const ramoNome = { escripta: 'Escripta', talha: 'Talha', tatuagem: 'Tatuagem' }[state.ramo];
        if (!confirm('Anotar "' + runa.nome + '" no Cartucho Rúnico da ficha?\n\nSó registra o projeto — para criar a peça, use "Gravar".')) return;
        try {
            await registrarNoCartucho(runa, blocoDaRuna(runa), ramoNome, fb.db || getFirestore(), fb);
            toast?.('🜃 "' + runa.nome + '" anotada no Cartucho (' + ramoNome + '). Recarregue a ficha.');
        } catch (e) {
            console.error('bancada/enviarParaFicha', e);
            toast?.('❌ Falha ao anotar — veja o console.');
        }
    }

    return {
        enviarParaFicha, emitirRuna, blocoDaRuna,
        /** O que o projeto escolheu — o Grimório guarda junto com o desenho. */
        escolhas: () => ({ condicoes: [...state.escolhas.condicoes], manifestacao: state.escolhas.manifestacao }),
        /** Abrir uma runa do Grimório na mesa restaura as escolhas dela. */
        restaurarEscolhas(r) {
            state.escolhas = {
                condicoes: Array.isArray(r?.condicoesEscolhidas) ? [...r.condicoesEscolhidas] : [],
                manifestacao: r?.manifestacao || null,
            };
            if (r?.ramo) state.ramo = r.ramo;
            render();
        },
        boot() {
            /* injeta a seção logo abaixo da auditoria */
            const audit = document.getElementById('labAudit');
            if (audit && !document.getElementById('labBancada')) {
                audit.insertAdjacentHTML('afterend', '<h4 class="lab-banc-titulo">🧰 Bancada</h4><div id="labBancada"></div>');
            }
            carregar();
        },
        onAudit(a) { state.ultimaAudit = a; if (state.carregado) render(); },
    };
})();
window.LabBancada = LabBancada;
