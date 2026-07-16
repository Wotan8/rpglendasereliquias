// =============================================
// TABULEIRO — Objetos (CRUD), Uploads, Tokens, Camadas, Propriedades
// =============================================
import { db, storage, ref, uploadBytes, getDownloadURL, setDoc, updateDoc, deleteDoc, doc } from '../../painel-mestre/js/firebase-config.js';
import { T, esc, uid, toast, markDirty, gridSize, getCamada, escalaCanvas } from './tab-state.js';
import { refObjeto, refObjetos, refCanvas, abrirModal, fecharModal } from './tab-main.js';
import { bboxOf, centerCamera, screenToWorld } from './tab-render.js';

// ===== CRUD =====
export async function addObj(data) {
    const id = uid();
    const obj = {
        z: Date.now(),
        visivelPublico: data.layerId === 'dm' ? false : true,
        criadoPor: T.user?.uid || null,
        atualizadoEm: Date.now(),
        ...data,
    };
    T.objects.set(id, { id, ...obj }); markDirty();
    try { await setDoc(refObjeto(id), obj); } catch (e) { console.error(e); toast('❌ Erro ao salvar objeto', 'danger'); T.objects.delete(id); markDirty(); }
    return id;
}

const _throttles = new Map();
export function updObj(id, patch, throttleMs = 0) {
    const o = T.objects.get(id);
    if (o) { Object.assign(o, patch); markDirty(); }
    const write = async () => {
        try { await updateDoc(refObjeto(id), { ...patch, atualizadoEm: Date.now() }); }
        catch (e) { console.warn('updObj', e); }
    };
    if (!throttleMs) { write(); return; }
    const th = _throttles.get(id) || { t: 0, timer: null, last: null };
    th.last = patch;
    const agora = Date.now();
    if (agora - th.t > throttleMs) { th.t = agora; write(); }
    else {
        clearTimeout(th.timer);
        th.timer = setTimeout(() => { th.t = Date.now(); updateDoc(refObjeto(id), { ...th.last, atualizadoEm: Date.now() }).catch(()=>{}); }, throttleMs);
    }
    _throttles.set(id, th);
}

export async function delObj(id) {
    T.objects.delete(id);
    if (T.selection === id) { T.selection = null; abrirPropriedades(null); }
    markDirty();
    try { await deleteDoc(refObjeto(id)); } catch (e) { console.warn(e); }
}

export function maxZ() {
    let m = 0; for (const o of T.objects.values()) m = Math.max(m, o.z || 0); return m;
}
export function minZ() {
    let m = Infinity; for (const o of T.objects.values()) m = Math.min(m, o.z || 0); return m === Infinity ? 0 : m;
}

// ===== UPLOAD =====
export async function uploadArquivo(file) {
    const path = `tabuleiro-images/${T.mesaId}/${Date.now()}_${file.name.replace(/[^\w.\-]/g, '_')}`;
    const r = ref(storage, path);
    await uploadBytes(r, file);
    return await getDownloadURL(r);
}

function lerDimensoes(url) {
    return new Promise(res => { const i = new Image(); i.onload = () => res({ w: i.width, h: i.height }); i.onerror = () => res({ w: 400, h: 400 }); i.src = url; });
}

export function initObjects() {
    document.getElementById('tbFileInput').addEventListener('change', async (e) => {
        const file = e.target.files[0]; e.target.value = '';
        if (!file) return;
        toast('⏳ Enviando imagem...', 'warning');
        try {
            const url = await uploadArquivo(file);
            abrirModalNovaImagem(url);
        } catch (err) { console.error(err); toast('❌ Erro no upload', 'danger'); }
    });
    window._renderCamadasPanel = renderCamadasPanel;
}

window.tbUploadImagem = () => document.getElementById('tbFileInput').click();

function abrirModalNovaImagem(url) {
    const camadas = (T.canvas?.camadas || []).filter(c => c.tipo !== 'luz');
    const podeMapa = T.mode === 'secret';
    abrirModal('🖼️ Nova Imagem', `
        <img src="${url}" style="max-width:100%;max-height:220px;border-radius:8px;display:block;margin:0 auto 12px">
        <div class="tb-form-grid">
            <label>Camada<select id="ni_layer">
                ${camadas.filter(c => podeMapa || (c.tipo !== 'dm')).map(c => `<option value="${c.id}" ${c.id === (podeMapa?'mapa':'tokens') ? 'selected':''}>${esc(c.nome)}</option>`).join('')}
            </select></label>
            <label>É um mapa? Largura real (para a régua) — deixe 0 se não for mapa
                <input type="number" id="ni_larguraReal" value="0" min="0" step="0.5">
            </label>
            <label>Unidade<select id="ni_un">${['m','cm','ft'].map(u=>`<option ${escalaCanvas().unidade===u?'selected':''}>${u}</option>`).join('')}</select></label>
        </div>
        <div class="tb-modal-actions"><button class="tb-btn tb-btn-success" onclick="tbConfirmarImagem('${url}')">✅ Adicionar</button></div>
    `);
}
window.tbConfirmarImagem = async function(url) {
    const layerId = document.getElementById('ni_layer').value;
    const larguraReal = parseFloat(document.getElementById('ni_larguraReal').value) || 0;
    const unidade = document.getElementById('ni_un').value;
    const dim = await lerDimensoes(url);
    const centro = screenToWorld({ x: window.innerWidth/2, y: window.innerHeight/2 });
    let w = dim.w, h = dim.h;
    if (larguraReal > 0) {
        // dimensiona para que a escala do grid bata: larguraReal unidades => (larguraReal/vpc)*gridSize px
        const e = escalaCanvas();
        w = (larguraReal / (e.valorPorCelula || 1)) * gridSize();
        h = w * (dim.h / dim.w);
    }
    await addObj({ tipo: 'imagem', layerId, url, x: centro.x - w/2, y: centro.y - h/2, w, h, larguraReal, unidade, propW: dim.w, propH: dim.h });
    fecharModal(); toast('✅ Imagem adicionada');
};

// ===== TOKENS =====
window.tbAbrirToken = function() {
    const chars = T.chars.map(c => `<option value="char:${c.id}">${esc(c.nome)}</option>`).join('');
    const npcs = T.npcs.map(n => `<option value="npc:${n.id}">${esc(n.nome || 'NPC')}</option>`).join('');
    abrirModal('🎭 Novo Token', `
        <div class="tb-form-grid">
            <label>Vincular a<select id="tk_vinculo" onchange="tbTokenVinculoChange()">
                <optgroup label="Personagens da mesa">${chars || '<option disabled>— nenhum —</option>'}</optgroup>
                <optgroup label="NPCs da mesa">${npcs || '<option disabled>— nenhum —</option>'}</optgroup>
                <option value="custom">✨ Custom (sem vínculo)</option>
            </select></label>
            <label id="tk_nomeWrap" style="display:none">Nome<input type="text" id="tk_nome" placeholder="Nome do token"></label>
            <label>Camada<select id="tk_layer">
                <option value="tokens" selected>🎭 Tokens</option>
                <option value="dm">🕵️ DM (só modo secreto)</option>
            </select></label>
            <label>Tamanho (células)<input type="number" id="tk_tam" value="1" min="0.25" step="0.25"></label>
            <label class="tb-check"><input type="checkbox" id="tk_visPub" checked> Visível ao público</label>
        </div>
        <hr class="tb-hr">
        <div class="tb-section-title">👁️ Visão do token (revela o mapa no modo público)</div>
        <div class="tb-form-grid">
            <label class="tb-check"><input type="checkbox" id="tk_visao" checked> Tem visão</label>
            <label>Alcance da visão (${escalaCanvas().unidade})<input type="number" id="tk_alcance" value="9" min="0" step="0.5"></label>
            <label>Amplitude (graus)<input type="number" id="tk_angulo" value="360" min="10" max="360"></label>
        </div>
        <div class="tb-form-grid" style="margin-top:6px">
            <label class="tb-check"><input type="checkbox" id="tk_temImg"> Usar imagem personalizada (upload)</label>
        </div>
        <div class="tb-modal-actions"><button class="tb-btn tb-btn-success" onclick="tbCriarToken()">✅ Criar Token</button></div>
    `);
    window.tbTokenVinculoChange();
};
window.tbTokenVinculoChange = function() {
    const v = document.getElementById('tk_vinculo')?.value || '';
    document.getElementById('tk_nomeWrap').style.display = v === 'custom' ? '' : 'none';
};
window.tbCriarToken = async function() {
    const v = document.getElementById('tk_vinculo').value;
    let vinculo = { tipo: 'custom', id: null }, nome = document.getElementById('tk_nome').value.trim() || 'Token', url = '';
    if (v.startsWith('char:')) { const c = T.chars.find(x => x.id === v.slice(5)); vinculo = { tipo: 'char', id: c.id }; nome = c.nome; url = c.charImg || ''; }
    else if (v.startsWith('npc:')) { const n = T.npcs.find(x => x.id === v.slice(4)); vinculo = { tipo: 'npc', id: n.id }; nome = n.nome || 'NPC'; url = n.imagem || ''; }
    const finish = async (finalUrl) => {
        const centro = screenToWorld({ x: window.innerWidth/2, y: window.innerHeight/2 });
        const gs = gridSize();
        const pos = T.canvas?.grid?.snap !== false
            ? { x: Math.round(centro.x / gs) * gs + gs/2 - gs/2, y: Math.round(centro.y / gs) * gs }
            : centro;
        await addObj({
            tipo: 'token', layerId: document.getElementById('tk_layer').value,
            x: pos.x, y: pos.y, nome, url: finalUrl,
            tamanhoCelulas: parseFloat(document.getElementById('tk_tam').value) || 1,
            visivelPublico: document.getElementById('tk_visPub').checked,
            vinculo, rot: 0,
            visao: { ativa: document.getElementById('tk_visao').checked, alcance: parseFloat(document.getElementById('tk_alcance').value) || 9, angulo: parseInt(document.getElementById('tk_angulo').value) || 360 },
            luz: { ativa: false, alcance: 3 },
            mostrarNome: true,
        });
        fecharModal(); toast('✅ Token criado');
    };
    if (document.getElementById('tk_temImg').checked) {
        const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
        input.onchange = async () => {
            if (!input.files[0]) return finish(url);
            toast('⏳ Enviando imagem...', 'warning');
            try { finish(await uploadArquivo(input.files[0])); } catch (e) { toast('❌ Upload falhou', 'danger'); finish(url); }
        };
        input.click();
    } else finish(url);
};

// ===== PAINEL DE CAMADAS =====
window.tbToggleCamadas = function() {
    const p = document.getElementById('tbCamadasPanel');
    p.classList.toggle('open');
    renderCamadasPanel();
};

export function renderCamadasPanel() {
    const p = document.getElementById('tbCamadasBody');
    if (!p || !T.canvas) return;
    const cs = (T.canvas.camadas || []).slice().sort((a, b) => (b.ordem||0) - (a.ordem||0));
    p.innerHTML = cs.map(c => `
        <div class="tb-layer-row ${T.activeLayerId === c.id ? 'active' : ''}" onclick="tbSetCamadaAtiva('${c.id}')">
            <span class="tb-layer-name">${esc(c.nome)}</span>
            <span class="tb-layer-btns" onclick="event.stopPropagation()">
                <button class="tb-mini-btn" title="Visível ao público" onclick="tbToggleCamadaPub('${c.id}')">${c.visivelPublico !== false && c.tipo !== 'dm' && c.tipo !== 'luz' ? '👁️' : '🚫'}</button>
                <button class="tb-mini-btn" title="Subir" onclick="tbMoverCamada('${c.id}',1)">⬆️</button>
                <button class="tb-mini-btn" title="Descer" onclick="tbMoverCamada('${c.id}',-1)">⬇️</button>
                ${c.tipo === 'custom' ? `<button class="tb-mini-btn" title="Configurar" onclick="tbConfigCamada('${c.id}')">⚙️</button><button class="tb-mini-btn tb-danger" onclick="tbExcluirCamada('${c.id}')">🗑️</button>` : ''}
            </span>
        </div>`).join('') +
        `<button class="tb-btn tb-btn-small" style="width:100%;margin-top:8px" onclick="tbNovaCamada()">➕ Nova camada</button>
        <div class="tb-muted" style="font-size:.72rem;margin-top:6px">Camada ativa recebe desenhos, textos e uploads. Riscos na camada 💡 Luz bloqueiam a visão.</div>`;
}
window.tbSetCamadaAtiva = (id) => { T.activeLayerId = id; renderCamadasPanel(); toast('Camada ativa: ' + (getCamada(id)?.nome || id)); };
window.tbToggleCamadaPub = async (id) => {
    const cs = (T.canvas.camadas || []).map(c => c.id === id ? { ...c, visivelPublico: !(c.visivelPublico !== false) } : c);
    await updateDoc(refCanvas(), { camadas: cs });
};
window.tbMoverCamada = async (id, dir) => {
    const cs = (T.canvas.camadas || []).slice().sort((a,b)=>(a.ordem||0)-(b.ordem||0));
    const i = cs.findIndex(c => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= cs.length) return;
    [cs[i], cs[j]] = [cs[j], cs[i]];
    cs.forEach((c, k) => c.ordem = k);
    await updateDoc(refCanvas(), { camadas: cs });
};
window.tbNovaCamada = function() {
    abrirModal('➕ Nova Camada', `
        <div class="tb-form-grid">
            <label>Nome<input type="text" id="nc_nome" placeholder="Ex: Objetos, Clima, Teto..."></label>
            <label class="tb-check"><input type="checkbox" id="nc_pub" checked> Visível ao público</label>
            <label class="tb-check"><input type="checkbox" id="nc_abaixo" checked> Abaixo da luz (coberta pelo fog)</label>
            <label class="tb-check"><input type="checkbox" id="nc_mapa"> Faz parte do mapa (régua usa a escala do mapa)</label>
            <label>Altura do chão do mapa (${escalaCanvas().unidade})<input type="number" id="nc_altura" value="0" step="0.5"></label>
            <label class="tb-check"><input type="checkbox" id="nc_ilus"> Apenas ilustrativa</label>
        </div>
        <div class="tb-modal-actions"><button class="tb-btn tb-btn-success" onclick="tbCriarCamada()">✅ Criar</button></div>
    `);
};
window.tbCriarCamada = async function() {
    const cs = (T.canvas.camadas || []).slice();
    cs.push({
        id: uid(), nome: '🧩 ' + (document.getElementById('nc_nome').value.trim() || 'Camada'),
        tipo: 'custom', ordem: cs.length,
        visivelPublico: document.getElementById('nc_pub').checked,
        abaixoDaLuz: document.getElementById('nc_abaixo').checked,
        parteDoMapa: document.getElementById('nc_mapa').checked,
        altura: parseFloat(document.getElementById('nc_altura').value) || 0,
        ilustrativa: document.getElementById('nc_ilus').checked,
    });
    await updateDoc(refCanvas(), { camadas: cs });
    fecharModal(); toast('✅ Camada criada'); renderCamadasPanel();
};
window.tbConfigCamada = function(id) {
    const c = getCamada(id); if (!c) return;
    abrirModal('⚙️ Camada: ' + esc(c.nome), `
        <div class="tb-form-grid">
            <label>Nome<input type="text" id="cc_nome" value="${esc(c.nome)}"></label>
            <label class="tb-check"><input type="checkbox" id="cc_pub" ${c.visivelPublico!==false?'checked':''}> Visível ao público</label>
            <label class="tb-check"><input type="checkbox" id="cc_abaixo" ${c.abaixoDaLuz!==false?'checked':''}> Abaixo da luz (coberta pelo fog)</label>
            <label class="tb-check"><input type="checkbox" id="cc_mapa" ${c.parteDoMapa?'checked':''}> Faz parte do mapa</label>
            <label>Altura do chão (${escalaCanvas().unidade})<input type="number" id="cc_altura" value="${c.altura||0}" step="0.5"></label>
            <label class="tb-check"><input type="checkbox" id="cc_ilus" ${c.ilustrativa?'checked':''}> Apenas ilustrativa</label>
        </div>
        <div class="tb-modal-actions"><button class="tb-btn tb-btn-success" onclick="tbSalvarCamada('${id}')">💾 Salvar</button></div>
    `);
};
window.tbSalvarCamada = async function(id) {
    const cs = (T.canvas.camadas || []).map(c => c.id !== id ? c : {
        ...c,
        nome: document.getElementById('cc_nome').value.trim() || c.nome,
        visivelPublico: document.getElementById('cc_pub').checked,
        abaixoDaLuz: document.getElementById('cc_abaixo').checked,
        parteDoMapa: document.getElementById('cc_mapa').checked,
        altura: parseFloat(document.getElementById('cc_altura').value) || 0,
        ilustrativa: document.getElementById('cc_ilus').checked,
    });
    await updateDoc(refCanvas(), { camadas: cs });
    fecharModal(); toast('✅ Camada salva');
};
window.tbExcluirCamada = async function(id) {
    if (!confirm('Excluir camada? Os objetos dela serão apagados.')) return;
    for (const o of [...T.objects.values()]) if (o.layerId === id) await delObj(o.id);
    const cs = (T.canvas.camadas || []).filter(c => c.id !== id);
    await updateDoc(refCanvas(), { camadas: cs });
    if (T.activeLayerId === id) T.activeLayerId = 'tokens';
    toast('🗑️ Camada excluída');
};

// ===== PAINEL DE PROPRIEDADES =====
export function abrirPropriedades(id, soAtualizar) {
    const p = document.getElementById('tbPropsPanel');
    if (!id) { p.classList.remove('open'); return; }
    const o = T.objects.get(id); if (!o) { p.classList.remove('open'); return; }
    if (T.mode !== 'secret') { p.classList.remove('open'); return; }
    p.classList.add('open');
    const camadas = (T.canvas?.camadas || []);
    const b = bboxOf(o);
    let extra = '';
    if (o.tipo === 'imagem') extra = `
        <label>Largura (px)<input type="number" id="pr_w" value="${Math.round(o.w||0)}" onchange="tbProp('${id}','w',parseFloat(this.value)||10,true)"></label>
        <label>Altura (px)<input type="number" id="pr_h" value="${Math.round(o.h||0)}" onchange="tbProp('${id}','h',parseFloat(this.value)||10)"></label>
        <label>Largura real p/ régua (0 = não é mapa)<input type="number" id="pr_lr" value="${o.larguraReal||0}" step="0.5" onchange="tbProp('${id}','larguraReal',parseFloat(this.value)||0)"></label>
        <label>Unidade<select onchange="tbProp('${id}','unidade',this.value)">${['m','cm','ft'].map(u=>`<option ${o.unidade===u?'selected':''}>${u}</option>`).join('')}</select></label>`;
    if (o.tipo === 'token') extra = `
        <label>Nome<input type="text" value="${esc(o.nome||'')}" onchange="tbProp('${id}','nome',this.value)"></label>
        <label>Tamanho (células)<input type="number" step="0.25" min="0.25" value="${o.tamanhoCelulas||1}" onchange="tbProp('${id}','tamanhoCelulas',parseFloat(this.value)||1)"></label>
        <label class="tb-check"><input type="checkbox" ${o.mostrarNome!==false?'checked':''} onchange="tbProp('${id}','mostrarNome',this.checked)"> Mostrar nome</label>
        <label class="tb-check"><input type="checkbox" ${o.visao?.ativa?'checked':''} onchange="tbPropDeep('${id}','visao','ativa',this.checked)"> Tem visão</label>
        <label>Alcance visão<input type="number" step="0.5" value="${o.visao?.alcance||9}" onchange="tbPropDeep('${id}','visao','alcance',parseFloat(this.value)||0)"></label>
        <label>Amplitude (°)<input type="number" min="10" max="360" value="${o.visao?.angulo||360}" onchange="tbPropDeep('${id}','visao','angulo',parseInt(this.value)||360)"></label>
        <label>Direção (°)<input type="number" value="${o.rot||0}" onchange="tbProp('${id}','rot',parseFloat(this.value)||0)"></label>
        <label class="tb-check"><input type="checkbox" ${o.luz?.ativa?'checked':''} onchange="tbPropDeep('${id}','luz','ativa',this.checked)"> Emite luz</label>
        <label>Alcance luz<input type="number" step="0.5" value="${o.luz?.alcance||3}" onchange="tbPropDeep('${id}','luz','alcance',parseFloat(this.value)||0)"></label>`;
    if (o.tipo === 'texto') extra = `
        <label>Texto<textarea rows="3" onchange="tbProp('${id}','texto',this.value)">${esc(o.texto||'')}</textarea></label>
        <label>Cor<input type="color" value="${o.cor||'#ffffff'}" onchange="tbProp('${id}','cor',this.value)"></label>
        <label class="tb-check"><input type="checkbox" ${o.usaBorda?'checked':''} onchange="tbProp('${id}','usaBorda',this.checked)"> Borda</label>
        <label>Cor da borda<input type="color" value="${o.corBorda||'#000000'}" onchange="tbProp('${id}','corBorda',this.value)"></label>
        <label>Fonte<select onchange="tbProp('${id}','fonte',this.value)">${['Arial','Georgia','Times New Roman','Courier New','Verdana','Trebuchet MS','Impact'].map(f=>`<option ${o.fonte===f?'selected':''}>${f}</option>`).join('')}</select></label>
        <label>Tamanho<input type="number" value="${o.tamanho||28}" min="8" onchange="tbProp('${id}','tamanho',parseInt(this.value)||28)"></label>
        <label class="tb-check"><input type="checkbox" ${o.bold?'checked':''} onchange="tbProp('${id}','bold',this.checked)"> <b>Negrito</b></label>
        <label class="tb-check"><input type="checkbox" ${o.italico?'checked':''} onchange="tbProp('${id}','italico',this.checked)"> <i>Itálico</i></label>`;
    if (o.tipo === 'alfinete') extra = `
        <label>Título<input type="text" value="${esc(o.titulo||'')}" onchange="tbProp('${id}','titulo',this.value)"></label>
        <label>Descrição<textarea rows="3" onchange="tbProp('${id}','descricao',this.value)">${esc(o.descricao||'')}</textarea></label>
        <label>Cor<input type="color" value="${o.cor||'#ef4444'}" onchange="tbProp('${id}','cor',this.value)"></label>`;
    if (o.tipo === 'luz') extra = `
        <label>Alcance (${escalaCanvas().unidade})<input type="number" step="0.5" value="${o.alcance||6}" onchange="tbProp('${id}','alcance',parseFloat(this.value)||1)"></label>`;
    if (o.tipo === 'porta') extra = `
        <label class="tb-check"><input type="checkbox" ${o.aberta?'checked':''} onchange="tbProp('${id}','aberta',this.checked)"> Porta aberta (não bloqueia a luz)</label>`;
    if (o.tipo === 'desenho') extra = `
        <label>Cor<input type="color" value="${o.cor||'#3b82f6'}" onchange="tbProp('${id}','cor',this.value)"></label>
        <label>Grossura<input type="number" min="1" max="60" value="${o.grossura||4}" onchange="tbProp('${id}','grossura',parseInt(this.value)||4)"></label>`;

    document.getElementById('tbPropsBody').innerHTML = `
        <div class="tb-props-title">${iconeTipo(o.tipo)} ${esc(o.nome || o.titulo || o.tipo)}</div>
        <div class="tb-form-grid tb-form-grid-1">
            <label class="tb-check"><input type="checkbox" ${o.visivelPublico!==false?'checked':''} onchange="tbProp('${id}','visivelPublico',this.checked)"> 👁️ Visível ao público</label>
            <label>Camada<select onchange="tbProp('${id}','layerId',this.value)">${camadas.map(c=>`<option value="${c.id}" ${o.layerId===c.id?'selected':''}>${esc(c.nome)}</option>`).join('')}</select></label>
            ${extra}
        </div>
        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
            <button class="tb-btn tb-btn-small" onclick="tbZOrdem('${id}',1)">⬆️ Frente</button>
            <button class="tb-btn tb-btn-small" onclick="tbZOrdem('${id}',-1)">⬇️ Trás</button>
            <button class="tb-btn tb-btn-small" onclick="tbDuplicar('${id}')">📄 Duplicar</button>
            <button class="tb-btn tb-btn-small tb-btn-danger" onclick="tbExcluirObj('${id}')">🗑️ Excluir</button>
        </div>`;
}
function iconeTipo(t) { return { imagem:'🖼️', token:'🎭', texto:'🔤', desenho:'✏️', medida:'📏', alfinete:'📌', luz:'💡', porta:'🚪', janela:'🪟', mostrar:'🎁' }[t] || '⬜'; }

window.tbProp = function(id, campo, valor, manterProporcao) {
    const patch = { [campo]: valor };
    const o = T.objects.get(id);
    if (manterProporcao && campo === 'w' && o?.propW) patch.h = valor * (o.propH / o.propW);
    updObj(id, patch);
    if (campo === 'layerId' || campo === 'visivelPublico') markDirty();
};
window.tbPropDeep = function(id, grupo, campo, valor) {
    const o = T.objects.get(id); if (!o) return;
    const g = { ...(o[grupo] || {}) , [campo]: valor };
    updObj(id, { [grupo]: g });
};
window.tbZOrdem = (id, dir) => updObj(id, { z: dir > 0 ? maxZ() + 1 : minZ() - 1 });
window.tbDuplicar = async (id) => {
    const o = T.objects.get(id); if (!o) return;
    const { id: _, ...cp } = o;
    await addObj({ ...cp, x: (cp.x||0) + 40, y: (cp.y||0) + 40, pontos: cp.pontos ? cp.pontos.map(p => ({ x: p.x + 40, y: p.y + 40 })) : undefined, z: maxZ() + 1 });
};
window.tbExcluirObj = (id) => { delObj(id); };

// ===== LIMPAR DESENHOS E TEXTO =====
window.tbLimparDesenhos = async function() {
    if (!confirm('Limpar todos os desenhos, textos e medições permanentes (exceto camada Luz)?')) return;
    for (const o of [...T.objects.values()]) {
        if (o.layerId === 'luz') continue;
        if (['desenho', 'texto', 'medida'].includes(o.tipo)) await delObj(o.id);
    }
    toast('🧹 Desenhos e textos limpos');
};

window.tbCentralizar = () => centerCamera();
