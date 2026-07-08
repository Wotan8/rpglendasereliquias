/* ===== RECURSOS DE CLASSE ===== */
/* Runimago, Rituais, Ritos, Loções, Marca de Caça */

/* --- RUNIMAGO --- */
function renderRunimago(container) {
    container.innerHTML = '';
}

function createDots3HTML(k) {
    state.dots[k] = state.dots[k] || 0;
    const div = document.createElement('div'); div.className = 'dots3';
    for (let i = 1; i <= 3; i++) {
        const d = document.createElement('button'); d.className = 'dot'; d.dataset.val = i; d.title = 'Nível ' + i;
        d.addEventListener('click', () => { state.dots[k] = (state.dots[k] === i) ? i - 1 : i; refreshDots(div, k); scheduleAutosave(); });
        div.appendChild(d);
    }
    refreshDots(div, k); return div;
}

function addSigilus(data) {
    const c = document.getElementById('sigilusContainer'); if (!c) return;
    const i = sigilusCount++;
    const dk = (data && data.dotsKey) || ('sigilus_' + i + '_' + Date.now());
    const item = document.createElement('div'); item.className = 'sigilus-item'; item.dataset.sigilusId = i;
    const inp = document.createElement('input'); inp.type = 'text'; inp.placeholder = 'Nome do Sigilus';
    if (data && data.name) inp.value = data.name;
    inp.addEventListener('input', scheduleAutosave);
    const sel = document.createElement('select');
    SIGILUS_CATS.forEach(cat => { const o = document.createElement('option'); o.value = cat; o.textContent = cat; sel.appendChild(o); });
    if (data && data.cat) sel.value = data.cat;
    sel.addEventListener('change', scheduleAutosave);
    const rm = document.createElement('button'); rm.className = 'rm-spec no-print'; rm.textContent = '✕';
    rm.addEventListener('click', () => { item.remove(); scheduleAutosave(); });
    item.appendChild(inp); item.appendChild(sel); item.appendChild(createDots3HTML(dk)); item.appendChild(rm);
    item.dataset.dotsKey = dk;
    c.appendChild(item);
    if (data && data.level) { state.dots[dk] = data.level; const dotsEl = item.querySelector('.dots3'); if (dotsEl) refreshDots(dotsEl, dk); }
}

function addRunaPrep(data) {
    const c = document.getElementById('runasPrepContainer'); if (!c) return;
    const i = runaPrepCount++;
    const card = document.createElement('div'); card.className = 'runa-card'; card.dataset.runaId = i;
    // Header
    const hdr = document.createElement('div'); hdr.className = 'runa-card-header';
    hdr.innerHTML = `<span class="rp-label">⚡</span><input class="rp-name" type="text" data-rpkey="rp_name_${i}" placeholder="Nome da Runa" value="${(data && data.name) || ''}"><span class="rp-label">Alvo:</span><input class="rp-small" type="text" data-rpkey="rp_alvo_${i}" placeholder="0" value="${(data && data.alvo) || ''}"><span class="rp-label">Qtd:</span><input class="rp-small" type="text" data-rpkey="rp_qtd_${i}" placeholder="0" value="${(data && data.qtd) || ''}"><span class="rp-label">Suporte:</span><input class="rp-suporte" type="text" data-rpkey="rp_suporte_${i}" placeholder="Pergaminho, Pedra..." value="${(data && data.suporte) || ''}"><button class="rm-btn no-print" onclick="this.closest('.runa-card').remove();scheduleAutosave()" style="margin-left:auto">✕</button>`;
    card.appendChild(hdr);
    // Body - component list
    const body = document.createElement('div'); body.className = 'runa-card-body';
    body.innerHTML = '<div class="runa-card-body-title">Estrutura da Runa</div>';
    const compList = document.createElement('div'); compList.className = 'runa-comp-list'; compList.id = 'runaCompList_' + i;
    body.appendChild(compList);
    const addCompBtn = document.createElement('button');
    addCompBtn.className = 'add-btn no-print'; addCompBtn.textContent = '+ Componente';
    addCompBtn.style.cssText = 'padding:6px;font-size:10px;margin-top:4px';
    addCompBtn.addEventListener('click', () => { addRunaComp(i); renumberComps(i); });
    body.appendChild(addCompBtn);
    card.appendChild(body);
    // Footer
    const ftr = document.createElement('div'); ftr.className = 'runa-card-footer';
    ftr.innerHTML = `<label>Efeito</label><textarea data-rpkey="rp_efeito_${i}" placeholder="Descreva o efeito da runa..." rows="2">${(data && data.efeito) || ''}</textarea><label>Notas</label><textarea data-rpkey="rp_notas_${i}" placeholder="Gatilho, condições, restrições..." rows="2">${(data && data.notas) || ''}</textarea>`;
    card.appendChild(ftr);
    c.appendChild(card);
    card.querySelectorAll('input,textarea').forEach(x => x.addEventListener('input', scheduleAutosave));
    // Load saved components
    if (data && data.comps && data.comps.length) {
        data.comps.forEach(comp => addRunaComp(i, comp));
    }
    renumberComps(i);
}

function addRunaComp(runaIdx, data) {
    const list = document.getElementById('runaCompList_' + runaIdx); if (!list) return;
    const row = document.createElement('div'); row.className = 'runa-comp-row';
    const cat = (data && data.cat) || 'Captador';
    row.dataset.cat = cat;
    const icon = (cat === 'Artus' || cat === 'Aspectus') ? '★' : '⬡';
    row.innerHTML = `<span class="runa-comp-num">1.</span><span class="runa-comp-icon">${icon}</span><input type="text" placeholder="Nome" value="${(data && data.name) || ''}"><select>${RUNA_COMP_CATS.map(c => `<option value="${c}"${c === cat ? ' selected' : ''}>${c}</option>`).join('')}</select><button class="rc-rm no-print" onclick="this.closest('.runa-comp-row').remove();renumberComps(${runaIdx});scheduleAutosave()">✕</button>`;
    row.querySelector('select').addEventListener('change', function () {
        row.dataset.cat = this.value;
        row.querySelector('.runa-comp-icon').textContent = (this.value === 'Artus' || this.value === 'Aspectus') ? '★' : '⬡';
        scheduleAutosave();
    });
    row.querySelector('input').addEventListener('input', scheduleAutosave);
    list.appendChild(row);
}

function renumberComps(runaIdx) {
    const list = document.getElementById('runaCompList_' + runaIdx); if (!list) return;
    list.querySelectorAll('.runa-comp-row').forEach((row, i) => {
        row.querySelector('.runa-comp-num').textContent = (i + 1) + '.';
    });
}

function addEstudo(data) {
    const c = document.getElementById('estudosContainer'); if (!c) return;
    const i = estudoCount++;
    const r = document.createElement('div'); r.className = 'estudo-row';
    r.innerHTML = `<input type="text" data-eskey="es_name_${i}" placeholder="Ex: Criar, Fogo, Temporizador" value="${(data && data.name) || ''}"><select data-eskey="es_tipo_${i}"><option value="Artus">Artus</option><option value="Aspectus">Aspectus</option><option value="Sigilus">Sigilus</option></select><input type="text" data-eskey="es_nivel_${i}" placeholder="2 → 3" value="${(data && data.nivel) || ''}"><div class="estudo-progress"><input type="text" data-eskey="es_prog_atual_${i}" placeholder="0" value="${(data && data.progAtual) || ''}"><span class="sep">/</span><input type="text" data-eskey="es_prog_total_${i}" placeholder="0" value="${(data && data.progTotal) || ''}"></div><button class="rm-btn no-print" onclick="this.parentElement.remove();updateEstudoSlots();scheduleAutosave()">✕</button>`;
    if (data && data.tipo) r.querySelector('select').value = data.tipo;
    c.appendChild(r);
    r.querySelectorAll('input,select').forEach(x => x.addEventListener('input', scheduleAutosave));
    updateEstudoSlots();
}

function updateEstudoSlots() {
    const el = document.getElementById('estudoSlots'); if (!el) return;
    const count = document.querySelectorAll('.estudo-row').length;
    // Slots based on Erudição Rúnica level (sk_classe prefix)
    const erudKey = 'sk_classe_erud__r_nica';
    const erudLevel = state.dots[erudKey] || 0;
    const maxSlots = 2 + erudLevel;
    el.textContent = count + ' / ' + maxSlots;
    el.style.color = count > maxSlots ? '#dc2626' : '';
}

/* ===== RECEITA DE LOÇÕES (Caçador / Druida) ===== */

function renderReceitaLocoes(container) {
    const sec = document.createElement('div'); sec.className = 'receita-section';
    sec.innerHTML = `<div class="section-title">🧪 Receita de Loções</div><div id="locoesContainer"></div><button class="add-btn no-print" onclick="addLocao()">+ Adicionar Loção</button>`;
    container.appendChild(sec);
    state.locacoes.forEach((l, idx) => addLocao(l));
}

function addLocao(data) {
    const c = document.getElementById('locoesContainer'); if (!c) return;
    const i = locaoCount++;
    const item = document.createElement('div'); item.className = 'receita-item'; item.dataset.locaoId = i;
    item.innerHTML = `<div class="receita-header"><input type="text" data-lkey="locao_name_${i}" placeholder="Nome da Loção" value="${(data && data.name) || ''}"><button class="rm-btn no-print" onclick="removeLocao(this)" style="margin-left:8px">✕</button></div><div class="receita-fields"><div class="field"><label>Tipo</label><input type="text" data-lkey="locao_tipo_${i}" placeholder="Ex: Combate, Cura..." value="${(data && data.tipo) || ''}"></div><div class="field"><label>Duração</label><input type="text" data-lkey="locao_duracao_${i}" placeholder="Ex: 3 rodadas" value="${(data && data.duracao) || ''}"></div><div class="field"><label>Custo</label><input type="text" data-lkey="locao_custo_${i}" placeholder="Ex: 2 kits" value="${(data && data.custo) || ''}"></div><div class="field"><label>Redutor</label><input type="text" data-lkey="locao_redutor_${i}" placeholder="Redutor" value="${(data && data.redutor) || ''}"></div><div class="field"><label>Dosagem Máx.</label><input type="text" data-lkey="locao_dosagem_${i}" placeholder="Ex: 3" value="${(data && data.dosagem) || ''}"></div><div class="field full"><label>Ingredientes</label><input type="text" data-lkey="locao_ingred_${i}" placeholder="Ex: Erva-lunar, Pó de cristal..." value="${(data && data.ingredientes) || ''}"></div><div class="field full"><label>Efeito</label><textarea data-lkey="locao_efeito_${i}" placeholder="Descreva o efeito da loção..." rows="2">${(data && data.efeito) || ''}</textarea></div></div>`;
    c.appendChild(item);
    item.querySelectorAll('input,textarea').forEach(x => x.addEventListener('input', scheduleAutosave));
}

function removeLocao(btn) { btn.closest('.receita-item').remove(); scheduleAutosave(); }

function renderMarcaCaca(container) {
    const box = document.createElement('div'); box.className = 'marca-caca';
    box.innerHTML = `<label>🎯 Marcar Caça</label><textarea id="marcaCacaField" data-key="marca_caca" placeholder="Anote sua caça atual aqui..." rows="3"></textarea>`;
    container.appendChild(box);
    const sv = localStorage.getItem('lr_marca_caca');
    if (sv) box.querySelector('textarea').value = sv;
    box.querySelector('textarea').addEventListener('input', scheduleAutosave);
}

/* ===== RITUAIS (Adepto / Invocador) ===== */

function renderRituais() {
    const c = document.getElementById('rituaisContainer'); if (!c) return;
    c.innerHTML = '';
    ritualCount = 0;
    state.rituais.forEach(r => addRitual(r));
}

function addRitual(data) {
    const c = document.getElementById('rituaisContainer'); if (!c) return;
    const i = ritualCount++;
    const item = document.createElement('div'); item.className = 'ritual-item'; item.dataset.ritualId = i;
    const numPassos = (data && data.passos) ? data.passos.length : 0;
    const demoDesc = `Teste de Convocar:\n(PRS + Liderança + Talismã Profano)\nRedutor: Quantidade de Cadáveres no alcance.\nSe falhar perde Sanidade igual à quantidade de\ncadáveres próximos\nSe sucesso, todos eles levantam, salvo exceção se o\ntotal exceder o Limite de Fantoches.`;
    item.innerHTML = `<div class="ritual-header"><input type="text" data-rkey="ritual_name_${i}" placeholder="Nome do Ritual" value="${(data && data.name) || ''}"><button class="rm-btn no-print" onclick="removeRitual(this)" style="margin-left:8px">✕</button></div><div class="ritual-fields"><div class="field"><label>Objetivo</label><input type="text" data-rkey="ritual_obj_${i}" placeholder="Objetivo" value="${(data && data.objetivo) || ''}"></div><div class="field"><label>Requer</label><input type="text" data-rkey="ritual_req_${i}" placeholder="Requer" value="${(data && data.requer) || ''}"></div><div class="field"><label>Custo</label><input type="text" data-rkey="ritual_custo_${i}" placeholder="Custo" value="${(data && data.custo) || ''}"></div><div class="field"><label>Tempo</label><input type="text" data-rkey="ritual_tempo_${i}" placeholder="Tempo" value="${(data && data.tempo) || ''}"></div><div class="field"><label>Alcance</label><input type="text" data-rkey="ritual_alcance_${i}" placeholder="Alcance" value="${(data && data.alcance) || ''}"></div><div class="field"><label>Quando</label><input type="text" data-rkey="ritual_quando_${i}" placeholder="Quando" value="${(data && data.quando) || ''}"></div></div><div class="ritual-steps-header">Passos: <input type="number" min="0" max="20" value="${numPassos}" onchange="updateRitualSteps(${i}, this.value)"></div><div class="ritual-steps" id="ritualSteps_${i}"></div>`;
    const c2 = item;
    if (data && data.passos) {
        const stepsDiv = item.querySelector('.ritual-steps');
        data.passos.forEach((p, pi) => {
            const step = document.createElement('div'); step.className = 'ritual-step';
            const ordinal = getOrdinal(pi + 1);
            step.innerHTML = `<div class="ritual-step-title">${ordinal} PASSO: <input type="text" data-rskey="ritual_${i}_step_name_${pi}" placeholder="Nome do passo" value="${p.name || ''}"></div><textarea data-rskey="ritual_${i}_step_desc_${pi}" placeholder="Descrição do passo...">${p.desc || ''}</textarea>`;
            stepsDiv.appendChild(step);
        });
    }
    c.appendChild(item);
    item.querySelectorAll('input,textarea').forEach(x => x.addEventListener('input', scheduleAutosave));
}

function removeRitual(btn) { btn.closest('.ritual-item').remove(); scheduleAutosave(); }

function updateRitualSteps(ritualIdx, count) {
    count = Math.max(0, Math.min(20, parseInt(count) || 0));
    const stepsDiv = document.getElementById('ritualSteps_' + ritualIdx); if (!stepsDiv) return;
    const demoPlaceholder = `Teste de Convocar:\n(PRS + Liderança + Talismã Profano)\nRedutor: Quantidade de Cadáveres no alcance.\nSe falhar perde Sanidade igual à quantidade de\ncadáveres próximos\nSe sucesso, todos eles levantam, salvo exceção se o\ntotal exceder o Limite de Fantoches.`;
    stepsDiv.innerHTML = '';
    for (let pi = 0; pi < count; pi++) {
        const step = document.createElement('div'); step.className = 'ritual-step';
        const ordinal = getOrdinal(pi + 1);
        step.innerHTML = `<div class="ritual-step-title">${ordinal} PASSO: <input type="text" data-rskey="ritual_${ritualIdx}_step_name_${pi}" placeholder="Nome do passo"></div><textarea data-rskey="ritual_${ritualIdx}_step_desc_${pi}" placeholder="${demoPlaceholder}"></textarea>`;
        stepsDiv.appendChild(step);
    }
    stepsDiv.querySelectorAll('input,textarea').forEach(x => x.addEventListener('input', scheduleAutosave));
    scheduleAutosave();
}

function getOrdinal(n) { return n + 'º'; }

/* ===== RITOS (Pallacerdote) ===== */

function renderRitos(container) {
    const sec = document.createElement('div'); sec.className = 'ritos-section';
    sec.innerHTML = `<div class="section-title">🙏 Ritos</div><div id="ritosContainer"></div><button class="add-btn no-print" onclick="addRito()">+ Adicionar Rito</button>`;
    container.appendChild(sec);
    state.ritos.forEach(r => addRito(r));
}

function addRito(data) {
    const c = document.getElementById('ritosContainer'); if (!c) return;
    const i = ritoCount++;
    const item = document.createElement('div'); item.className = 'rito-item'; item.dataset.ritoId = i;
    item.innerHTML = `<div class="rito-header"><input type="text" data-rtkey="rito_name_${i}" placeholder="Nome do Rito" value="${(data && data.name) || ''}"><button class="rm-btn no-print" onclick="removeRito(this)" style="margin-left:8px">✕</button></div><div class="rito-fields"><div class="field"><label>Teste</label><input type="text" data-rtkey="rito_teste_${i}" placeholder="Teste" value="${(data && data.teste) || ''}"></div><div class="field"><label>Redutor</label><input type="text" data-rtkey="rito_redutor_${i}" placeholder="Redutor" value="${(data && data.redutor) || ''}"></div><div class="field"><label>Custo</label><input type="text" data-rtkey="rito_custo_${i}" placeholder="Custo" value="${(data && data.custo) || ''}"></div><div class="field full"><label>Efeito</label><textarea data-rtkey="rito_efeito_${i}" placeholder="Efeito do rito..." rows="2">${(data && data.efeito) || ''}</textarea></div><div class="field full"><label>Falha</label><textarea data-rtkey="rito_falha_${i}" placeholder="O que acontece em caso de falha..." rows="2">${(data && data.falha) || ''}</textarea></div></div>`;
    c.appendChild(item);
    item.querySelectorAll('input,textarea').forEach(x => x.addEventListener('input', scheduleAutosave));
}

function removeRito(btn) { btn.closest('.rito-item').remove(); scheduleAutosave(); }
