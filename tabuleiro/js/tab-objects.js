// =============================================
// TABULEIRO — Objetos (CRUD), Uploads, Tokens, Camadas, Propriedades
// =============================================
import { db, storage, ref, uploadBytes, getDownloadURL, setDoc, updateDoc, deleteDoc, doc, writeBatch } from '../../painel-mestre/js/firebase-config.js';
import { T, esc, uid, toast, markDirty, gridSize, getCamada, escalaCanvas, optsUnidade, tokenPadrao, pxDeLarguraReal, larguraRealDePx, alcanceDeVisaoDoToken, fonteDoAlcance } from './tab-state.js';
import { npcNaMesa, patchVinculoMesa } from '../../shared/npc-mesas.js';
import { refObjeto, refObjetos, refCanvas, abrirModal, fecharModal } from './tab-main.js';
import { notifyObjectChange } from './tab-perf.js';
import { bboxOf, centerCamera, screenToWorld, derivedDoToken } from './tab-render.js';
import { detectarGradeDeArquivo, faixaDe } from './tab-grid.js';
import { registrarOp } from './tab-undo.js';
import { SENSORES } from './tab-fog.js';
import { criarFilaDeEscrita } from './tab-write-queue.js';
import { logChat } from './tab-chat.js';

import { confirmar } from '../../shared/dialogo.js?v=2';
// ===== CRUD =====
export async function addObj(data) {
    const id = uid();
    const obj = {
        z: Date.now(),
        visivelPublico: data.layerId === 'dm' ? false : true,
        criadoPor: T.user?.uid || null,
        lastWriter: T.user?.uid || null,
        atualizadoEm: Date.now(),
        ...data,
    };
    T.objects.set(id, { id, ...obj });
    registrarOp({ tipo: 'add', id, dados: obj });
    notifyObjectChange(obj);
    markDirty();
    // 💬 todo loot nasce por aqui (drop do Mostrar, da janela de ficha, soltos)
    if (obj.tipo === 'loot') logChat(`🧰 ${obj.nome || 'Item'}${(obj.quantidade || 1) > 1 ? ` x${obj.quantidade}` : ''} ficou no mapa`);
    try { await setDoc(refObjeto(id), obj); } catch (e) { console.error(e); toast('❌ Erro ao salvar objeto', 'danger'); T.objects.delete(id); markDirty(); }
    return id;
}

const CAMPOS_MOVIMENTO = new Set(['x', 'y', 'pontos', 'movendo']);

// F2.2: todo write carrega lastWriter (anti-eco do lerp) e timestamp.
// O try/catch não é decoração: trocar de canvas no meio de um arrasto deixava
// erro solto no console do jogador. A fila garante que o write final do arrasto
// não seja atropelado por um pendente antigo (ver tab-write-queue.js).
const fila = criarFilaDeEscrita({
    write: (id, p) => {
        const stamp = Date.now();
        // `__meuWrite` = o write mais recente que EU emiti para este objeto. O
        // snapshot handler usa isso para descartar eco atrasado do próprio
        // arrasto (ver tab-main.js): sem essa marca, um write intermediário que
        // ainda estava em trânsito chegava depois do final e o token pulava de
        // volta — o tremor ao soltar.
        const o = T.objects.get(id);
        if (o) o.__meuWrite = stamp;
        updateDoc(refObjeto(id), { ...p, atualizadoEm: stamp, lastWriter: T.user?.uid || null })
            .catch(e => console.warn('updObj', e));
    },
});

export function updObj(id, patch, throttleMs = 0) {
    const o = T.objects.get(id);
    // F7.3: undo automático para patches de PROPRIEDADES (movimento é registrado nas tools)
    if (o && !throttleMs && !Object.keys(patch).some(k => CAMPOS_MOVIMENTO.has(k))) {
        const antes = {};
        for (const k of Object.keys(patch)) antes[k] = o[k] !== undefined ? o[k] : null;
        registrarOp({ tipo: 'patch', id, antes, depois: { ...patch } });
    }
    if (o) { Object.assign(o, patch); notifyObjectChange(o); markDirty(); }
    fila.enviar(id, patch, throttleMs);
}

/** Patch só no objeto local: preview de arrasto, sem tocar no Firestore. */
export function updObjLocal(id, patch) {
    const o = T.objects.get(id);
    if (!o) return;
    Object.assign(o, patch);
    notifyObjectChange(o);
    markDirty();
}

/**
 * Move vários objetos numa ÚNICA transação — o conjunto laçado se comporta como
 * um objeto só. Com um write por objeto durante o arrasto, os ecos do Firestore
 * voltavam intercalados e embaralhavam as posições relativas do grupo.
 */
export async function moverEmLote(itens) {
    const meta = { atualizadoEm: Date.now(), lastWriter: T.user?.uid || null };
    for (let i = 0; i < itens.length; i += 400) {
        const lote = writeBatch(db);
        for (const it of itens.slice(i, i + 400)) {
            lote.update(refObjeto(it.id), { ...it.patch, ...meta });
            const o = T.objects.get(it.id);
            if (o) o.__meuWrite = meta.atualizadoEm;   // mesma proteção contra eco atrasado
        }
        await lote.commit();
    }
}

export async function delObj(id) {
    const atual = T.objects.get(id);
    if (atual) registrarOp({ tipo: 'del', id, dados: { ...atual } });
    // 💬 loot só some do mapa quando alguém pega/devolve/apaga
    if (atual?.tipo === 'loot') logChat(`🎒 ${atual.nome || 'Item'} saiu do mapa`);
    notifyObjectChange(atual);
    T.objects.delete(id);
    T.selecionados = T.selecionados.filter(x => x !== id);
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

/* `uploadArquivo` morava aqui e so servia a playlist de musica, que agora
   sobe pela pasta compartilhada `audio/` (shared/audio-arquivo.js). Imagem
   do canvas ja subia pelo CampoImagem. Sem chamador, saiu — o git lembra. */

function lerDimensoes(url) {
    return new Promise(res => { const i = new Image(); i.onload = () => res({ w: i.width, h: i.height }); i.onerror = () => res({ w: 400, h: 400 }); i.src = url; });
}

export function initObjects() {
    window._renderCamadasPanel = renderCamadasPanel;
}

// Imagem nova no canvas: URL colada ou arquivo do aparelho, pelo campo padrão.
// F7.5: a grade só dá para detectar no ARQUIVO local (o Storage devolve imagem
// "tainted" para o canvas) — por isso o `comArquivo`. Quem cola URL entra sem
// detecção e dimensiona na mão, como sempre foi para imagem de fora.
window.tbUploadImagem = async () => {
    const { url, file } = await CampoImagem.escolher({
        titulo: '🖼️ Nova imagem', pasta: `tabuleiro-images/${T.mesaId}`, comArquivo: true,
    });
    if (!url) return;
    const grade = file ? await detectarGradeDeArquivo(file).catch(() => null) : null;
    window._tbGradeDetectada = (grade && grade.forca > 0.2 && grade.cell >= 20) ? grade : null;
    abrirModalNovaImagem(url);
};

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
            <label>Unidade<select id="ni_un">${optsUnidade(escalaCanvas().unidade)}</select></label>
            ${window._tbGradeDetectada ? `<label class="tb-check"><input type="checkbox" id="ni_useGrade" checked> 🧮 Detectamos grade de ~${window._tbGradeDetectada.cell}px — dimensionar para casar com o grid</label>` : ''}
            ${T.mode === 'secret' ? `<label class="tb-check"><input type="checkbox" id="ni_telhado"> 🏠 É um telhado (fica acima dos tokens e some quando alguém entra)</label>` : ''}
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
    const useGrade = document.getElementById('ni_useGrade')?.checked && window._tbGradeDetectada;
    if (useGrade && larguraReal <= 0) {
        // dimensiona para que a célula detectada = célula do grid
        w = (dim.w / window._tbGradeDetectada.cell) * gridSize();
        h = w * (dim.h / dim.w);
    }
    if (larguraReal > 0) {
        // dimensiona para que a escala do grid bata: larguraReal unidades => (larguraReal/vpc)*gridSize px
        w = pxDeLarguraReal(larguraReal);
        h = w * (dim.h / dim.w);
    }
    const telhado = document.getElementById('ni_telhado')?.checked || false;
    await addObj({ tipo: 'imagem', layerId, url, x: centro.x - w/2, y: centro.y - h/2, w, h, larguraReal, unidade, propW: dim.w, propH: dim.h, telhado });
    window._tbGradeDetectada = null;
    fecharModal(); toast('✅ Imagem adicionada');
};

// ===== VÍNCULO DE NPC COM A MESA =====
// `vinculos` é a lista canônica do editor de NPCs; `mesaId` é o espelho legado que
// o Tabuleiro e a área de Mesas leem. Os dois têm que andar juntos: escrever só
// `mesaId` deixa `vinculos` desatualizado e o editor desfaz o vínculo no próximo save.
export async function vincularNpcNaMesa(npcId, vincular) {
    const n = T.npcsTodos.find(x => x.id === npcId);
    const patch = patchVinculoMesa(n, T.mesaId, vincular);
    await updateDoc(doc(db, 'npcs', npcId), patch);
    if (n) Object.assign(n, patch);   // eco local até o snapshot
}

// ===== TOKENS =====
/** Opções de NPC do criador de token: os da mesa primeiro, o resto abaixo. */
window.tbTokenFiltraNpcs = function() {
    const busca = (document.getElementById('tk_busca')?.value || '').trim().toLowerCase();
    const sel = document.getElementById('tk_vinculo'); if (!sel) return;
    const escolhido = sel.value;
    const bate = n => !busca || (n.nome || '').toLowerCase().includes(busca) || (n.papel || '').toLowerCase().includes(busca);
    const opt = n => `<option value="npc:${n.id}">${esc(n.nome || 'NPC')}${n.tipo === 'criatura' ? ' 🐉' : ''}${n.papel ? ' · ' + esc(n.papel) : ''}</option>`;
    const daMesa = T.npcs.filter(bate);
    const fora = T.npcsTodos.filter(n => !npcNaMesa(n, T.mesaId)).filter(bate);
    const chars = T.chars.filter(c => !busca || (c.nome || '').toLowerCase().includes(busca))
        .map(c => `<option value="char:${c.id}">${esc(c.nome)}</option>`).join('');
    sel.innerHTML =
        `<optgroup label="Personagens da mesa">${chars || '<option disabled>— nenhum —</option>'}</optgroup>` +
        `<optgroup label="NPCs da mesa (${daMesa.length})">${daMesa.map(opt).join('') || '<option disabled>— nenhum —</option>'}</optgroup>` +
        `<optgroup label="Outros NPCs (${fora.length}) — serão vinculados à mesa">${fora.map(opt).join('') || '<option disabled>— nenhum —</option>'}</optgroup>` +
        `<option value="custom">✨ Custom (sem vínculo)</option>`;
    if ([...sel.options].some(o => o.value === escolhido)) sel.value = escolhido;
    window.tbTokenVinculoChange();
};

window.tbAbrirToken = function() {
    const tp = tokenPadrao();   // ⚙️ Configurações → 🎭 Padrão de Tokens Novos
    abrirModal('🎭 Novo Token', `
        <div class="tb-form-grid tb-form-grid-1">
            <label>🔍 Buscar personagem ou NPC<input type="text" id="tk_busca" placeholder="Nome ou papel — busca em todos os NPCs, não só os da mesa" oninput="tbTokenFiltraNpcs()"></label>
        </div>
        <div class="tb-form-grid">
            <label>Vincular a<select id="tk_vinculo" size="6" style="height:150px" onchange="tbTokenVinculoChange()"></select></label>
            <label id="tk_nomeWrap" style="display:none">Nome<input type="text" id="tk_nome" placeholder="Nome do token"></label>
            <label>Camada<select id="tk_layer">
                <option value="tokens" ${tp.camada !== 'dm' ? 'selected' : ''}>🎭 Tokens</option>
                <option value="dm" ${tp.camada === 'dm' ? 'selected' : ''}>🕵️ DM (só modo secreto)</option>
            </select></label>
            <label>Tamanho (células)<input type="number" id="tk_tam" value="${tp.tamanho}" min="0.25" step="0.25"></label>
            <label class="tb-check"><input type="checkbox" id="tk_visPub" ${tp.visivelPublico !== false ? 'checked' : ''}> Visível ao público</label>
        </div>
        <hr class="tb-hr">
        <div class="tb-section-title">👁️ Visão do token (revela o mapa no modo público)</div>
        <div class="tb-form-grid">
            <label class="tb-check"><input type="checkbox" id="tk_visao" ${tp.visaoAtiva !== false ? 'checked' : ''}> Tem visão</label>
            <label>Fonte do alcance<select id="tk_alcFonte">
                <option value="fixo" ${tp.alcanceFonte !== 'percepcao' ? 'selected' : ''}>🔢 Valor fixo</option>
                <option value="percepcao" ${tp.alcanceFonte === 'percepcao' ? 'selected' : ''}>👁️ Percepção Visual +2 (da ficha)</option>
            </select></label>
            <label>Alcance da visão (${escalaCanvas().unidade})<input type="number" id="tk_alcance" value="${tp.alcance}" min="0" step="0.5"></label>
            <label>Amplitude (graus)<input type="number" id="tk_angulo" value="${tp.angulo}" min="10" max="360"></label>
            <label>Tipo de visão<select id="tk_sensor">${SENSORES.map(x => `<option value="${x.id}" ${tp.sensor === x.id ? 'selected' : ''}>${x.nome}</option>`).join('')}</select></label>
        </div>
        <div class="tb-form-grid" style="margin-top:6px">
            <label class="tb-check"><input type="checkbox" id="tk_temImg"> Usar imagem personalizada (URL ou arquivo)</label>
        </div>
        <div class="tb-modal-actions"><button class="tb-btn tb-btn-success" onclick="tbCriarToken()">✅ Criar Token</button></div>
    `);
    window.tbTokenFiltraNpcs();
};
window.tbTokenVinculoChange = function() {
    const v = document.getElementById('tk_vinculo')?.value || '';
    const wrap = document.getElementById('tk_nomeWrap');
    if (wrap) wrap.style.display = v === 'custom' ? '' : 'none';
};
window.tbCriarToken = async function() {
    const v = document.getElementById('tk_vinculo').value;
    let vinculo = { tipo: 'custom', id: null }, nome = document.getElementById('tk_nome').value.trim() || 'Token', url = '';
    if (v.startsWith('char:')) { const c = T.chars.find(x => x.id === v.slice(5)); vinculo = { tipo: 'char', id: c.id }; nome = c.nome; url = c.charImg || ''; }
    else if (v.startsWith('npc:')) {
        const n = T.npcsTodos.find(x => x.id === v.slice(4));
        if (!n) { toast('⚠️ NPC não encontrado', 'warning'); return; }
        vinculo = { tipo: 'npc', id: n.id }; nome = n.nome || 'NPC'; url = n.imagem || '';
        // NPC de fora da mesa: vincula junto, senão o token fica sem vitais nem ficha
        if (n.mesaId !== T.mesaId) {
            const outra = !!n.mesaId;
            if (outra && !await confirmar(`“${n.nome || 'NPC'}” está vinculado a outra mesa.`,
                { titulo: 'Trazer para esta mesa?', ok: 'Trazer' })) return;
            try { await vincularNpcNaMesa(n.id, true); toast(`🔗 ${n.nome || 'NPC'} vinculado a esta mesa`); }
            catch (e) { console.error(e); toast('❌ Não consegui vincular o NPC à mesa', 'danger'); return; }
        }
    }
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
            visao: {
                ativa: document.getElementById('tk_visao').checked,
                alcance: parseFloat(document.getElementById('tk_alcance').value) || 9,
                alcanceFonte: document.getElementById('tk_alcFonte').value || 'fixo',
                angulo: parseInt(document.getElementById('tk_angulo').value) || 360,
                tipo: document.getElementById('tk_sensor').value || 'padrao',
            },
            luz: { ativa: false, alcance: 3 },
            mostrarNome: true,
        });
        fecharModal(); toast('✅ Token criado');
    };
    if (document.getElementById('tk_temImg').checked) {
        const escolhida = await CampoImagem.escolher({
            titulo: '🎭 Imagem do token', valor: url, pasta: `tabuleiro-images/${T.mesaId}`,
        });
        finish(escolhida || url);
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
        (T.mode === 'secret' ? `<div style="margin-top:8px"><label class="tb-muted" style="font-size:.72rem">🪜 Andar ativo (filtra tokens/paredes por elevação)</label>
        <select style="width:100%" onchange="tbSetAndarAtivo(this.value)">
            <option value="" ${T.andarAtivo==null?'selected':''}>Todos os andares</option>
            ${andaresDisponiveis().map(a => `<option value="${a}" ${T.andarAtivo===a?'selected':''}>Andar ${a} (${a*(T.canvas?.andarAltura||5)}–${(a+1)*(T.canvas?.andarAltura||5)})</option>`).join('')}
        </select></div>` : '') +
        `<button class="tb-btn tb-btn-small" style="width:100%;margin-top:8px" onclick="tbNovaCamada()">➕ Nova camada</button>
        <div class="tb-muted" style="font-size:.72rem;margin-top:6px">Camada ativa recebe desenhos, textos e uploads. Riscos na camada 💡 Luz bloqueiam a visão.</div>`;
}
window.tbSetCamadaAtiva = (id) => { T.activeLayerId = id; renderCamadasPanel(); toast('Camada ativa: ' + (getCamada(id)?.nome || id)); };
function andaresDisponiveis() {
    const alt = T.canvas?.andarAltura || 5;
    const set = new Set([0]);
    for (const o of T.objects.values()) {
        if (o.elev != null) set.add(faixaDe(o.elev, alt));
    }
    return [...set].sort((a, b) => a - b);
}
window.tbSetAndarAtivo = (v) => { T.andarAtivo = v === '' ? null : parseInt(v); markDirty(); };
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
    if (!await confirmar('Os objetos dessa camada serão apagados junto.',
        { titulo: 'Excluir camada', ok: 'Excluir', perigo: true })) return;
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
    // `soAtualizar` = repinte vindo do snapshot. Com o painel fechado ele não
    // abre nada: quem abre é sempre o menu (toque longo / botão direito).
    if (soAtualizar && !p.classList.contains('open')) return;
    p.classList.add('open');
    // 🔒 F8: objeto bloqueado — sem campos de edição; só o Mestre vê o botão de desbloqueio
    if (o.bloqueado) {
        document.getElementById('tbPropsBody').innerHTML = `
            <div class="tb-props-title">🔒 ${iconeTipo(o.tipo)} ${esc(o.nome || o.titulo || o.tipo)}</div>
            <div class="tb-muted" style="font-size:.78rem;line-height:1.6;margin:6px 0 10px">
                Este objeto está <b>bloqueado</b>: arrastar, redimensionar e editar estão desativados para todos, inclusive o Mestre.
            </div>
            ${T.isMaster ? `<button class="tb-btn tb-btn-small" style="width:100%" onclick="tbDesbloquearObj('${id}')">🔒 Desbloquear objeto</button>` : ''}`;
        return;
    }
    const camadas = (T.canvas?.camadas || []);
    const b = bboxOf(o);
    let extra = '';
    if (o.tipo === 'imagem') extra = `
        <label>Largura (px)<input type="number" id="pr_w" value="${Math.round(o.w||0)}" onchange="tbProp('${id}','w',parseFloat(this.value)||10,true)"></label>
        <label>Altura (px)<input type="number" id="pr_h" value="${Math.round(o.h||0)}" onchange="tbProp('${id}','h',parseFloat(this.value)||10)"></label>
        <label>Largura real p/ régua (0 = não é mapa)<input type="number" id="pr_lr" value="${o.larguraReal||0}" step="0.5" onchange="tbProp('${id}','larguraReal',parseFloat(this.value)||0)"></label>
        <label>Unidade<select onchange="tbProp('${id}','unidade',this.value)">${optsUnidade(o.unidade)}</select></label>
        ${o.larguraReal > 0 ? `<label class="tb-muted tb-form-full" style="font-size:.72rem;font-weight:600">📏 ${(o.w / gridSize()).toFixed(1)} células · 1 célula = ${escalaCanvas().valorPorCelula || 1} ${esc(o.unidade || escalaCanvas().unidade)} — mudar a largura real redimensiona o mapa; redimensionar o mapa recalcula a largura real.</label>` : ''}
        <label class="tb-check"><input type="checkbox" ${o.telhado?'checked':''} onchange="tbProp('${id}','telhado',this.checked)"> 🏠 Telhado (acima dos tokens; some quando alguém entra)</label>`;
    if (o.tipo === 'token') extra = `
        <label>Nome<input type="text" value="${esc(o.nome||'')}" onchange="tbProp('${id}','nome',this.value)"></label>
        <label>Tamanho (células)<input type="number" step="0.25" min="0.25" value="${o.tamanhoCelulas||1}" onchange="tbProp('${id}','tamanhoCelulas',parseFloat(this.value)||1)"></label>
        <label class="tb-check"><input type="checkbox" ${o.mostrarNome!==false?'checked':''} onchange="tbProp('${id}','mostrarNome',this.checked)"> Mostrar nome</label>
        <label class="tb-check"><input type="checkbox" ${o.visao?.ativa?'checked':''} onchange="tbPropDeep('${id}','visao','ativa',this.checked)"> Tem visão</label>
        <label>Fonte do alcance<select onchange="tbPropDeep('${id}','visao','alcanceFonte',this.value)">
            <option value="fixo" ${(o.visao?.alcanceFonte||'fixo')==='fixo'?'selected':''}>🔢 Valor fixo</option>
            <option value="percepcao" ${o.visao?.alcanceFonte==='percepcao'?'selected':''}>👁️ Percepção Visual +2 (da ficha)</option>
        </select></label>
        <label>Alcance visão (valor fixo)<input type="number" step="0.5" value="${o.visao?.alcance||9}" onchange="tbPropDeep('${id}','visao','alcance',parseFloat(this.value)||0)"></label>
        ${o.visao?.ativa ? `<label class="tb-muted tb-form-full" style="font-size:.72rem;font-weight:600">${esc(rotuloAlcance(o))}</label>` : ''}
        <label>Amplitude (°)<input type="number" min="10" max="360" value="${o.visao?.angulo||360}" onchange="tbPropDeep('${id}','visao','angulo',parseInt(this.value)||360)"></label>
        <label>Direção (°)<input type="number" value="${o.rot||0}" onchange="tbProp('${id}','rot',parseFloat(this.value)||0)"></label>
        <label>Tipo de visão<select onchange="tbPropDeep('${id}','visao','tipo',this.value)">${SENSORES.map(x=>`<option value="${x.id}" ${((o.visao?.tipo)||'padrao')===x.id?'selected':''}>${x.nome}</option>`).join('')}</select></label>
        <label class="tb-check"><input type="checkbox" ${o.invisivel?'checked':''} onchange="tbProp('${id}','invisivel',this.checked)"> 👻 Invisível</label>
        <label>Elevação<input type="number" step="0.5" value="${o.elev||0}" onchange="tbProp('${id}','elev',parseFloat(this.value)||0)"></label>
        <label>Barras de vitais<select onchange="tbProp('${id}','barras',this.value)">${[['','Padrão da mesa'],['todos','Todos veem'],['dono','Só o dono'],['mestre','Só o mestre'],['off','Ocultas']].map(x=>`<option value="${x[0]}" ${((o.barras)||'')===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select></label>
        <label class="tb-check"><input type="checkbox" ${o.luz?.ativa?'checked':''} onchange="tbPropDeep('${id}','luz','ativa',this.checked)"> Emite luz</label>
        <label>Alcance luz<input type="number" step="0.5" value="${o.luz?.alcance||3}" onchange="tbPropDeep('${id}','luz','alcance',parseFloat(this.value)||0)"></label>
        <label>Cor da luz<input type="color" value="${o.luz?.cor||'#ffdd99'}" onchange="tbPropDeep('${id}','luz','cor',this.value)"></label>
        <label>Ângulo da luz (° · 360 = tudo)<input type="number" min="10" max="360" value="${o.luz?.angulo||360}" onchange="tbPropDeep('${id}','luz','angulo',parseInt(this.value)||360)"></label>
        <label>Animação da luz<select onchange="tbPropDeep('${id}','luz','animacao',this.value)">${[['nenhuma','Nenhuma'],['tocha','🔥 Tocha'],['pulso','💗 Pulso'],['estrobo','⚡ Estroboscópica']].map(x=>`<option value="${x[0]}" ${((o.luz?.animacao)||'nenhuma')===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select></label>`;
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
        <label>Cor<input type="color" value="${o.cor||'#ef4444'}" onchange="tbProp('${id}','cor',this.value)"></label>
        <button class="tb-btn tb-btn-small" onclick="tbEditarAlfinete('${id}')">📝 Editar completo (imagem/vínculo)</button>`;
    if (o.tipo === 'luz') extra = `
        <label class="tb-check"><input type="checkbox" ${!o.apagada?'checked':''} onchange="tbProp('${id}','apagada',!this.checked)"> 💡 Acesa</label>
        <label>Alcance (${escalaCanvas().unidade})<input type="number" step="0.5" value="${o.alcance||6}" onchange="tbProp('${id}','alcance',parseFloat(this.value)||1)"></label>
        <label>Cor<input type="color" value="${o.cor||'#ffdd99'}" onchange="tbProp('${id}','cor',this.value)"></label>
        <label>Animação<select onchange="tbProp('${id}','animacao',this.value)">${[['nenhuma','Nenhuma'],['tocha','🔥 Tocha'],['pulso','💗 Pulso'],['estrobo','⚡ Estroboscópica']].map(x=>`<option value="${x[0]}" ${((o.animacao)||'nenhuma')===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select></label>
        <label>Intensidade da animação<input type="number" min="0.1" max="1" step="0.1" value="${o.intensidadeAnim||0.5}" onchange="tbProp('${id}','intensidadeAnim',parseFloat(this.value)||0.5)"></label>
        <label>Elevação<input type="number" step="0.5" value="${o.elev||0}" onchange="tbProp('${id}','elev',parseFloat(this.value)||0)"></label>`;
    if (o.tipo === 'porta') extra = `
        <label class="tb-check"><input type="checkbox" ${o.aberta?'checked':''} onchange="tbProp('${id}','aberta',this.checked)"> Porta aberta (não bloqueia luz nem movimento)</label>
        <label>Elevação<input type="number" step="0.5" value="${o.elev||0}" onchange="tbProp('${id}','elev',parseFloat(this.value)||0)"></label>
        ${trancaConfigHtml(id, o)}`;
    if (o.tipo === 'janela') extra = `
        <label class="tb-check"><input type="checkbox" ${o.aberta?'checked':''} onchange="tbProp('${id}','aberta',this.checked)"> 🪟 Janela aberta (deixa passar o movimento)</label>
        <label class="tb-muted" style="font-size:.72rem">🪟 Fechada: a luz passa, o movimento não.</label>
        <label>Elevação<input type="number" step="0.5" value="${o.elev||0}" onchange="tbProp('${id}','elev',parseFloat(this.value)||0)"></label>
        ${trancaConfigHtml(id, o)}`;
    if (o.tipo === 'desenho') extra = `
        <label>Cor<input type="color" value="${o.cor||'#3b82f6'}" onchange="tbProp('${id}','cor',this.value)"></label>
        <label>Grossura<input type="number" min="1" max="60" value="${o.grossura||4}" onchange="tbProp('${id}','grossura',parseInt(this.value)||4)"></label>
        ${o.layerId === 'luz' ? `<label>Elevação da parede<input type="number" step="0.5" value="${o.elev||0}" onchange="tbProp('${id}','elev',parseFloat(this.value)||0)"></label>` : ''}
        ${o.ehRota ? `<label class="tb-muted tb-form-full" style="font-size:.76rem;font-weight:600">${esc(window._tbInfoRota?.(id) || '')}<br>Velocidade em ⚙️ Configurações → 🛤️ Viagem do grupo por dia.</label>` : ''}`;
    if (o.tipo === 'template') extra = `
        <label>Cor<input type="color" value="${o.cor||'#f97316'}" onchange="tbProp('${id}','cor',this.value)"></label>
        <label>Opacidade (%)<input type="number" min="5" max="90" value="${Math.round((o.alpha??0.35)*100)}" onchange="tbProp('${id}','alpha',(parseInt(this.value)||35)/100)"></label>
        <label>Duração (rodadas · 0 = permanente)<input type="number" min="0" value="${o.duracao||0}" onchange="tbProp('${id}','duracao',parseInt(this.value)||0)"></label>`;
    if (o.tipo === 'relogio') extra = `
        <label>Nome<input type="text" value="${esc(o.nome||'')}" onchange="tbProp('${id}','nome',this.value)"></label>
        <label>Fatias<select onchange="tbProp('${id}','fatias',parseInt(this.value))">${[4,6,8,10,12].map(f=>`<option ${((o.fatias)||6)===f?'selected':''}>${f}</option>`).join('')}</select></label>
        <label>Preenchidas<input type="number" min="0" value="${o.cheias||0}" onchange="tbProp('${id}','cheias',parseInt(this.value)||0)"></label>
        <label>Cor<input type="color" value="${o.cor||'#ef4444'}" onchange="tbProp('${id}','cor',this.value)"></label>`;
    if (o.tipo === 'terreno') extra = `
        <label>Multiplicador de movimento<select onchange="tbProp('${id}','mult',parseFloat(this.value))">${[1.5,2,3,4].map(m=>`<option ${((o.mult)||2)===m?'selected':''}>x${m}</option>`).join('')}</select></label>`;
    if (o.tipo === 'loot') extra = `
        <label>Nome do item<input type="text" value="${esc(o.nome||'')}" onchange="tbProp('${id}','nome',this.value)"></label>
        <label>Quantidade<input type="number" value="${o.quantidade||1}" min="1" onchange="tbProp('${id}','quantidade',parseInt(this.value)||1)"></label>
        ${o.item?.ehContainer ? `<label class="tb-check"><input type="checkbox" ${o.fixo?'checked':''} onchange="tbProp('${id}','fixo',this.checked)"> 📌 Fixo no mapa</label>` : ''}
        ${T.mode === 'secret' ? `
        <label>🔍 Oculto por teste — Graus p/ enxergar (vazio = sempre visível)
            <input type="number" value="${o.testeGraus ?? ''}" placeholder="ex.: 2 (0 = sucesso sem Graus)"
                onchange="tbProp('${id}','testeGraus',this.value===''?null:(parseInt(this.value)||0))"></label>
        ${o.testeGraus != null ? `
        <label class="tb-check"><input type="checkbox" ${o.reveladoPublico?'checked':''} onchange="tbProp('${id}','reveladoPublico',this.checked)"> 👁️ Revelado a todos</label>
        <label class="tb-muted tb-form-full" style="font-size:.72rem">Compara com o MELHOR resultado do jogador nos 🎯 Testes da cena ativa. Com teste configurado, ninguém vê o item antes de bater os Graus; quem vê e interage revela para o resto.</label>` : ''}` : ''}
        <label class="tb-muted" style="font-size:.72rem">📦 Duplo-clique entrega/abre · arraste sobre um token para entregar.</label>`;

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
            ${T.isMaster ? `<button class="tb-btn tb-btn-small" title="Protege contra movimentações acidentais" onclick="tbBloquearObj('${id}')">🔒 Bloquear</button>` : ''}
            <button class="tb-btn tb-btn-small tb-btn-danger" onclick="tbExcluirObj('${id}')">🗑️ Excluir</button>
        </div>`;
}
function iconeTipo(t) { return { imagem:'🖼️', token:'🎭', texto:'🔤', desenho:'✏️', medida:'📏', alfinete:'📌', luz:'💡', porta:'🚪', janela:'🪟', mostrar:'🎁', template:'🎯', terreno:'⛰️', relogio:'⏱️', loot:'📦' }[t] || '⬜'; }

// ===== TRANCA (baú, porta e janela) =====
// Config do mestre: o estado (`trancado` + `tranca`) vive no próprio objeto e
// sincroniza pelo snapshot, como qualquer campo. Usada no painel de
// propriedades (porta/janela) e no modal do baú (tab-mostrar).
export function trancaConfigHtml(objId, o) {
    const tr = o.tranca || {};
    const tipo = o.trancado ? (tr.tipo || 'item') : '';
    return `
    <div class="tb-form-grid" style="margin-bottom:8px">
        <label>🔒 Tranca<select id="bau_tr_tipo" onchange="tbTrancaCfg('${objId}')">
            <option value="">🔓 Livre</option>
            <option value="item" ${tipo === 'item' ? 'selected' : ''}>🔒 Chave: item</option>
            <option value="tag" ${tipo === 'tag' ? 'selected' : ''}>🔒 Chave: tag</option>
        </select></label>
        <label id="bau_tr_nome_w" style="${tipo === 'item' ? '' : 'display:none'}">Item-chave<input type="text" id="bau_tr_nome" list="bau_tr_dl" placeholder="🔍 buscar no catálogo…" value="${esc(tr.itemNome || '')}" onfocus="tbTrancaDatalist&&tbTrancaDatalist()" onchange="tbTrancaCfg('${objId}')"><datalist id="bau_tr_dl"></datalist></label>
        <label id="bau_tr_tag_w" style="${tipo === 'tag' ? '' : 'display:none'}">Tag da chave<input type="text" id="bau_tr_tag" value="${esc(tr.tag || '')}" onchange="tbTrancaCfg('${objId}')"></label>
        <label class="tb-check" id="bau_tr_exibir_w" style="${tipo ? '' : 'display:none'}"><input type="checkbox" id="bau_tr_exibir" ${tr.exibirChave ? 'checked' : ''} onchange="tbTrancaCfg('${objId}')"> 👁️ Exibir a chave ao jogador (nome e imagem)</label>
        <label id="bau_tr_consumo_w" style="${tipo ? '' : 'display:none'}">Consumo da chave<select id="bau_tr_consumo" onchange="tbTrancaCfg('${objId}')">
            <option value="nao" ${(tr.consumo || 'nao') === 'nao' ? 'selected' : ''}>não consome</option>
            <option value="sim" ${tr.consumo === 'sim' ? 'selected' : ''}>consome</option>
            <option value="chance" ${tr.consumo === 'chance' ? 'selected' : ''}>chance de consumir</option>
        </select></label>
        <label id="bau_tr_chance_w" style="${tipo && tr.consumo === 'chance' ? '' : 'display:none'}">Chance %<input type="number" id="bau_tr_chance" value="${Number(tr.chance) || 50}" min="1" max="100" onchange="tbTrancaCfg('${objId}')"></label>
    </div>`;
}

window.tbTrancaCfg = function(objId) {
    const v = (id) => document.getElementById(id)?.value;
    const tipo = v('bau_tr_tipo') || '';
    const mostra = (id, on) => { const el = document.getElementById(id); if (el) el.style.display = on ? '' : 'none'; };
    mostra('bau_tr_nome_w', tipo === 'item');
    mostra('bau_tr_tag_w', tipo === 'tag');
    mostra('bau_tr_exibir_w', !!tipo);
    mostra('bau_tr_consumo_w', !!tipo);
    mostra('bau_tr_chance_w', !!tipo && v('bau_tr_consumo') === 'chance');
    if (!tipo) { updObj(objId, { trancado: false, tranca: null }); return; }
    const tranca = { tipo, consumo: v('bau_tr_consumo') || 'nao' };
    tranca.exibirChave = !!document.getElementById('bau_tr_exibir')?.checked;
    if (tranca.consumo === 'chance') tranca.chance = Math.min(100, Math.max(1, parseInt(v('bau_tr_chance'), 10) || 50));
    if (tipo === 'item') {
        tranca.itemNome = (v('bau_tr_nome') || '').trim();
        // nome que bate com o catálogo carrega id e imagem (p/ "Exibir chave")
        const cat = (window._tbEquipLista || []).find(x => (x.nome || '').trim().toLowerCase() === tranca.itemNome.toLowerCase());
        if (cat) { tranca.itemId = cat.id; if (cat.imagem || cat.imagemUrl) tranca.itemImg = cat.imagem || cat.imagemUrl; }
    } else tranca.tag = (v('bau_tr_tag') || '').trim();
    // chave em branco tranca do mesmo jeito — o mestre está no meio da digitação;
    // o jogador só destrava com chave que "serve", e nada serve até preencher.
    updObj(objId, { trancado: true, tranca });
};

/** Alcance de visão realmente aplicado, com a origem e o efeito do dia. */
function rotuloAlcance(o) {
    const dia = T.canvas?.luzDinamica?.modo === 'dia';
    const der = derivedDoToken(o);
    const v = alcanceDeVisaoDoToken(o, der, dia);
    const f = fonteDoAlcance(o.visao, der);
    const porPercepcao = o.visao?.alcanceFonte === 'percepcao';
    // Personagem vinculado mas sem VDs espelhados: a ficha nunca foi aberta desde
    // que o espelho passou a existir. Sem dizer isso, a queda para o valor fixo
    // fica indiagnosticável da cadeira do mestre.
    const fichaSemVds = porPercepcao && o.vinculo?.tipo === 'char' && !Object.keys(der || {}).length;
    const origem = f === 'visual' ? 'Percepção Visual +2'
        : f === 'geral' ? 'Percepção +2 (a ficha não tem Percepção Visual)'
        : fichaSemVds ? `valor fixo — ⚠️ abra a ficha de ${esc(o.nome || 'este personagem')} uma vez para o Tabuleiro ler a Percepção`
        : porPercepcao ? 'valor fixo (token sem ficha vinculada)'
        : 'valor fixo';
    return `👁️ Em uso: ${Math.round(v * 10) / 10} ${escalaCanvas().unidade} — ${origem}${dia ? ' · ×3 por ser DIA' : ''}`;
}

window.tbProp = function(id, campo, valor, manterProporcao) {
    const patch = { [campo]: valor };
    const o = T.objects.get(id);
    if (manterProporcao && campo === 'w' && o?.propW) patch.h = valor * (o.propH / o.propW);
    // 🖼️ Mapa: largura real e largura em px são dois lados da mesma escala — mexer em um move o outro.
    if (o?.tipo === 'imagem') {
        if (campo === 'larguraReal' && valor > 0) {
            const prop = (o.propW && o.propH) ? (o.propH / o.propW) : (o.w > 0 ? (o.h || o.w) / o.w : 1);
            patch.w = pxDeLarguraReal(valor);
            patch.h = patch.w * prop;
        } else if (campo === 'w' && o.larguraReal > 0) {
            patch.larguraReal = larguraRealDePx(valor);
        }
    }
    updObj(id, patch);
    if (o?.tipo === 'imagem' && (patch.w !== undefined || patch.larguraReal !== undefined)) abrirPropriedades(id, true);
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
    // `undefined` é recusado pelo Firestore — só mande `pontos` quando existir; e
    // nunca copie campo local. Filtrar por prefixo `__` em vez de listar um a um:
    // cada campo local novo (ex.: __meuWrite) vazava para o banco em silêncio.
    const cp = {};
    for (const [k, v] of Object.entries(o)) {
        if (k === 'id' || k.startsWith('__')) continue;
        cp[k] = v;
    }
    if (cp.pontos) cp.pontos = cp.pontos.map(p => ({ x: p.x + 40, y: p.y + 40 }));
    await addObj({ ...cp, x: (cp.x||0) + 40, y: (cp.y||0) + 40, z: maxZ() + 1 });
};
window.tbExcluirObj = (id) => { delObj(id); };

// ===== 🔒 BLOQUEIO DE OBJETOS (F8) =====
// Bloqueado: arrastar, redimensionar e editar ficam desativados para TODOS (inclusive o Mestre).
// Somente o Mestre pode bloquear/desbloquear, por ação explícita.
window.tbBloquearObj = (id) => {
    if (!T.isMaster) { toast('⚠️ Apenas o Mestre pode bloquear objetos', 'warning'); return; }
    const o = T.objects.get(id); if (!o) return;
    updObj(id, { bloqueado: true });
    abrirPropriedades(id, true);
    markDirty();
    toast('🔒 Objeto bloqueado — protegido contra movimentações');
};
window.tbDesbloquearObj = (id) => {
    if (!T.isMaster) { toast('⚠️ Apenas o Mestre pode desbloquear objetos', 'warning'); return; }
    const o = T.objects.get(id); if (!o) return;
    updObj(id, { bloqueado: false });
    abrirPropriedades(id, true);
    markDirty();
    toast('🔓 Objeto desbloqueado — manipulação reabilitada');
};

// ===== LIMPAR DESENHOS E TEXTO =====
window.tbLimparDesenhos = async function() {
    if (!await confirmar('Some com todo desenho, texto e medição permanente. A camada Luz fica.',
        { titulo: 'Limpar desenhos', ok: 'Limpar', perigo: true })) return;
    const alvos = [...T.objects.values()].filter(o => o.layerId !== 'luz' && ['desenho', 'texto', 'medida'].includes(o.tipo));
    // F7.2: exclusão em LOTE (1 commit a cada 400 docs em vez de 1 write por doc)
    for (let i = 0; i < alvos.length; i += 400) {
        const lote = writeBatch(db);
        for (const o of alvos.slice(i, i + 400)) {
            lote.delete(refObjeto(o.id));
            T.objects.delete(o.id);
        }
        await lote.commit().catch(e => console.warn('batch', e));
    }
    if (T.selection && !T.objects.has(T.selection)) { T.selection = null; abrirPropriedades(null); }
    markDirty();
    toast(`🧹 ${alvos.length} objeto(s) limpos em lote`);
};

window.tbCentralizar = () => centerCamera();
