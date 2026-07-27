/* ═══════════════════════════════════════════════════════════
   wb-mapa-local.js — Editor de MAPA TÁTICO de um Local
   ───────────────────────────────────────────────────────────
   Aberto de dentro da ficha de um Local (Geografia). O mestre
   sobe o mapa, define a escala real e desenha por cima:

     ✏️ Paredes  — bloqueiam luz e visão (polilinha)
     🚪 Portas   — bloqueiam fechadas, abrem no tabuleiro
     🪟 Janelas  — deixam passar luz, bloqueiam visão fechadas
     💡 Luzes    — fontes com alcance (em unidades reais) e cor

   Tudo é salvo em `mapaTatico` no doc do Local (coordenadas em
   px da imagem natural). O tabuleiro importa este pacote pronto
   via shared/local-tatico.js — o Local vira um "prefab".
   ═══════════════════════════════════════════════════════════ */

import { db, doc, updateDoc, storage, ref, uploadBytes, getDownloadURL } from './firebase-config.js';
import { localPronto } from '../../shared/local-tatico.js';

const esc = (s = '') => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const FERRAMENTAS = [
    ['parede', '✏️ Parede', 'Clique para cada vértice; duplo-clique ou Enter encerra. Esc cancela.'],
    ['porta', '🚪 Porta', 'Dois cliques: início e fim da porta.'],
    ['janela', '🪟 Janela', 'Dois cliques: início e fim da janela.'],
    ['luz', '💡 Luz', 'Um clique posiciona a luz (alcance e cor ao lado).'],
    ['apagar', '🗑️ Apagar', 'Clique sobre um elemento para removê-lo.'],
];

const E = {                    // estado do editor aberto
    geoId: null, nome: '',
    mt: null,                  // mapaTatico em edição (cópia de trabalho)
    tool: 'parede',
    atual: null,               // pontos da parede/porta em andamento
    zoom: 1, panX: 0, panY: 0,
    arrastando: null,
};

const $ = (s) => document.querySelector(s);

/* ── Abertura / fechamento ───────────────────────────────── */
window.abrirMapaLocal = async function (geoId, nome) {
    // Doc mais fresco possível — a ficha pode estar aberta há tempo
    const { getDoc } = await import('./firebase-config.js');
    let dados = null;
    try { dados = (await getDoc(doc(db, 'worldbuilding-geography', geoId))).data(); }
    catch (e) { console.warn('[mapa-local] load', e); }

    E.geoId = geoId;
    E.nome = nome || dados?.nome || 'Local';
    E.mt = dados?.mapaTatico ? JSON.parse(JSON.stringify(dados.mapaTatico)) : {
        url: '', imgW: 0, imgH: 0, larguraReal: 30, unidade: 'm',
        ambiente: 'noite', luzAtiva: true, objetos: [],
    };
    E.tool = 'parede'; E.atual = null; E.zoom = 1; E.panX = 0; E.panY = 0;
    montar();
};

function fechar() {
    document.getElementById('wbMapaLocal')?.remove();
    document.removeEventListener('keydown', teclas);
}

/* ── Montagem da UI ──────────────────────────────────────── */
function montar() {
    fechar();
    const mt = E.mt;
    const root = document.createElement('div');
    root.id = 'wbMapaLocal';
    root.innerHTML = `
    <div class="wbml-top">
        <b>🗺️ Mapa Tático — ${esc(E.nome)}</b>
        <span class="wbml-sep"></span>
        <label>Largura real <input type="number" id="wbmlLargura" value="${mt.larguraReal}" min="1" step="0.5" style="width:70px"></label>
        <select id="wbmlUnidade">${['m', 'cm', 'km', 'ft', 'mi', 'passos'].map(u => `<option ${u === (mt.unidade || 'm') ? 'selected' : ''}>${u}</option>`).join('')}</select>
        <label>Ambiente <select id="wbmlAmbiente">
            <option value="noite" ${mt.ambiente !== 'dia' ? 'selected' : ''}>🌙 Noite (escuro)</option>
            <option value="dia" ${mt.ambiente === 'dia' ? 'selected' : ''}>☀️ Dia (tudo iluminado)</option>
        </select></label>
        <label class="wbml-check"><input type="checkbox" id="wbmlLuzAtiva" ${mt.luzAtiva !== false ? 'checked' : ''}> Luz dinâmica</label>
        <span class="wbml-sep"></span>
        <button class="btn btn-secondary btn-sm" id="wbmlTrocarImg">🖼️ ${mt.url ? 'Trocar mapa' : 'Enviar mapa'}</button>
        <span style="flex:1"></span>
        <button class="btn btn-success btn-sm" id="wbmlSalvar">💾 Salvar</button>
        <button class="btn btn-secondary btn-sm" id="wbmlFechar">✖ Fechar</button>
    </div>
    <div class="wbml-tools">
        ${FERRAMENTAS.map(([id, rotulo, dica]) => `<button data-wbml-tool="${id}" title="${esc(dica)}" class="${id === E.tool ? 'is-on' : ''}">${rotulo}</button>`).join('')}
        <span class="wbml-sep"></span>
        <label>Alcance da luz <input type="number" id="wbmlAlcance" value="6" min="0.5" step="0.5" style="width:60px"> <span id="wbmlUnLuz">${esc(mt.unidade || 'm')}</span></label>
        <label>Cor <input type="color" id="wbmlCorLuz" value="#ffdd99"></label>
        <select id="wbmlAnimLuz">
            <option value="">Sem animação</option>
            <option value="tocha">🔥 Tocha</option>
            <option value="pulso">💗 Pulso</option>
        </select>
        <span style="flex:1"></span>
        <span class="wbml-dica" id="wbmlDica"></span>
    </div>
    <div class="wbml-viewport" id="wbmlViewport">
        <div class="wbml-stage" id="wbmlStage"></div>
        <div class="wbml-vazio" id="wbmlVazio" ${mt.url ? 'hidden' : ''}>
            <p>Nenhum mapa ainda.</p>
            <button class="btn btn-success" onclick="document.getElementById('wbmlTrocarImg').click()">🖼️ Enviar imagem do mapa</button>
        </div>
    </div>
    <input type="file" id="wbmlArquivo" accept="image/*" hidden>`;
    document.body.appendChild(root);

    $('#wbmlFechar').onclick = fechar;
    $('#wbmlSalvar').onclick = salvar;
    $('#wbmlTrocarImg').onclick = () => $('#wbmlArquivo').click();
    $('#wbmlArquivo').addEventListener('change', enviarMapa);
    $('#wbmlUnidade').addEventListener('change', () => { $('#wbmlUnLuz').textContent = $('#wbmlUnidade').value; desenhar(); });
    $('#wbmlLargura').addEventListener('change', desenhar);
    root.querySelectorAll('[data-wbml-tool]').forEach(b => b.onclick = () => {
        E.tool = b.dataset.wbmlTool; E.atual = null;
        root.querySelectorAll('[data-wbml-tool]').forEach(x => x.classList.toggle('is-on', x === b));
        dica(FERRAMENTAS.find(f => f[0] === E.tool)?.[2] || '');
        desenhar();
    });
    document.addEventListener('keydown', teclas);
    ligarViewport();
    desenhar();
    dica(FERRAMENTAS[0][2]);
}

function dica(t) { const el = $('#wbmlDica'); if (el) el.textContent = t; }

/* ── Upload do mapa ──────────────────────────────────────── */
async function enviarMapa() {
    const file = $('#wbmlArquivo').files[0];
    $('#wbmlArquivo').value = '';
    if (!file || !file.type.startsWith('image/')) return;
    dica('⏳ Enviando mapa…');
    try {
        const nome = `${Date.now()}_${file.name.replace(/[^\w.-]/g, '_')}`;
        const snap = await uploadBytes(ref(storage, `worldbuilding-images/locais/${nome}`), file);
        const url = await getDownloadURL(snap.ref);
        const dim = await new Promise(res => {
            const i = new Image();
            i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight });
            i.onerror = () => res({ w: 0, h: 0 });
            i.src = url;
        });
        E.mt.url = url; E.mt.imgW = dim.w; E.mt.imgH = dim.h;
        $('#wbmlVazio').hidden = true;
        $('#wbmlTrocarImg').textContent = '🖼️ Trocar mapa';
        E.zoom = 1; E.panX = 0; E.panY = 0;
        desenhar();
        dica('✅ Mapa carregado. Desenhe as paredes por cima.');
    } catch (e) { console.error(e); dica('❌ Falha no upload — tente de novo.'); }
}

/* ── Render (img + svg) ──────────────────────────────────── */
function pxPorUnidade() {
    const lr = parseFloat($('#wbmlLargura')?.value) || E.mt.larguraReal || 30;
    return E.mt.imgW > 0 ? E.mt.imgW / lr : 10;
}

function desenhar() {
    const stage = $('#wbmlStage');
    if (!stage) return;
    const mt = E.mt;
    if (!mt.url) { stage.innerHTML = ''; return; }

    const linhas = [];
    const seg = (pts, cor, dash, extra = '') =>
        linhas.push(`<polyline points="${pts.map(p => `${p.x},${p.y}`).join(' ')}" stroke="${cor}" ${dash ? `stroke-dasharray="${dash}"` : ''} ${extra}/>`);

    (mt.objetos || []).forEach((o, i) => {
        if (o.tipo === 'parede') seg(o.pontos, '#ef4444', null, `data-i="${i}"`);
        if (o.tipo === 'porta') seg(o.pontos, '#f59e0b', null, `data-i="${i}" stroke-width="6"`);
        if (o.tipo === 'janela') seg(o.pontos, '#38bdf8', '10 6', `data-i="${i}" stroke-width="5"`);
        if (o.tipo === 'luz') {
            const r = (Number(o.alcance) || 6) * pxPorUnidade();
            linhas.push(`<circle cx="${o.x}" cy="${o.y}" r="${r}" fill="${o.cor || '#ffdd99'}" fill-opacity=".14" stroke="${o.cor || '#ffdd99'}" stroke-dasharray="6 6" data-i="${i}"/>`);
            linhas.push(`<circle cx="${o.x}" cy="${o.y}" r="9" fill="${o.cor || '#ffdd99'}" data-i="${i}"/>`);
        }
    });

    // traço em andamento
    if (E.atual?.length) {
        const cor = E.tool === 'porta' ? '#f59e0b' : E.tool === 'janela' ? '#38bdf8' : '#ef4444';
        seg(E.atual, cor, '4 4', 'stroke-width="2.5"');
        E.atual.forEach(p => linhas.push(`<circle cx="${p.x}" cy="${p.y}" r="5" fill="${cor}"/>`));
    }

    stage.style.width = mt.imgW + 'px';
    stage.style.height = mt.imgH + 'px';
    stage.style.transform = `translate(${E.panX}px, ${E.panY}px) scale(${E.zoom})`;
    stage.innerHTML = `
        <img src="${esc(mt.url)}" draggable="false" alt="">
        <svg viewBox="0 0 ${mt.imgW} ${mt.imgH}" preserveAspectRatio="none"
             stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round">${linhas.join('')}</svg>`;
}

/* ── Interação no viewport ───────────────────────────────── */
function pontoDoEvento(ev) {
    // O stage tem exatamente imgW×imgH px de CSS, escalado por zoom —
    // então basta desfazer o zoom para cair em px da imagem natural.
    const r = $('#wbmlStage').getBoundingClientRect();
    return {
        x: Math.round((ev.clientX - r.left) / E.zoom),
        y: Math.round((ev.clientY - r.top) / E.zoom),
    };
}

function ligarViewport() {
    const vp = $('#wbmlViewport');

    vp.addEventListener('wheel', (ev) => {
        ev.preventDefault();
        const fator = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
        const novo = Math.min(8, Math.max(0.1, E.zoom * fator));
        // zoom ancorado no cursor
        const r = vp.getBoundingClientRect();
        const mx = ev.clientX - r.left, my = ev.clientY - r.top;
        E.panX = mx - (mx - E.panX) * (novo / E.zoom);
        E.panY = my - (my - E.panY) * (novo / E.zoom);
        E.zoom = novo;
        aplicarTransform();
    }, { passive: false });

    vp.addEventListener('pointerdown', (ev) => {
        if (ev.button === 2 || ev.button === 1) {   // pan com botão direito/meio
            E.arrastando = { x: ev.clientX, y: ev.clientY };
            vp.setPointerCapture(ev.pointerId);
            ev.preventDefault();
        }
    });
    vp.addEventListener('pointermove', (ev) => {
        if (!E.arrastando) return;
        E.panX += ev.clientX - E.arrastando.x;
        E.panY += ev.clientY - E.arrastando.y;
        E.arrastando = { x: ev.clientX, y: ev.clientY };
        aplicarTransform();
    });
    vp.addEventListener('pointerup', () => { E.arrastando = null; });
    vp.addEventListener('contextmenu', (ev) => ev.preventDefault());

    vp.addEventListener('click', (ev) => {
        if (!E.mt.url || ev.target.closest('.wbml-vazio')) return;
        const p = pontoDoEvento(ev);
        clique(p);
    });
    vp.addEventListener('dblclick', (ev) => {
        ev.preventDefault();
        encerrarParede();
    });
}

function aplicarTransform() {
    const stage = $('#wbmlStage');
    if (stage) stage.style.transform = `translate(${E.panX}px, ${E.panY}px) scale(${E.zoom})`;
}

function clique(p) {
    const mt = E.mt;
    if (E.tool === 'parede') {
        (E.atual = E.atual || []).push(p);
        desenhar();
    } else if (E.tool === 'porta' || E.tool === 'janela') {
        if (!E.atual) { E.atual = [p]; desenhar(); return; }
        mt.objetos.push({ tipo: E.tool, pontos: [E.atual[0], p] });
        E.atual = null;
        desenhar();
    } else if (E.tool === 'luz') {
        mt.objetos.push({
            tipo: 'luz', x: p.x, y: p.y,
            alcance: parseFloat($('#wbmlAlcance').value) || 6,
            cor: $('#wbmlCorLuz').value,
            ...($('#wbmlAnimLuz').value ? { animacao: $('#wbmlAnimLuz').value } : {}),
        });
        desenhar();
    } else if (E.tool === 'apagar') {
        const i = acharPerto(p);
        if (i >= 0) { mt.objetos.splice(i, 1); desenhar(); }
    }
}

function encerrarParede() {
    if (E.tool === 'parede' && E.atual?.length >= 2) {
        E.mt.objetos.push({ tipo: 'parede', pontos: E.atual });
    }
    E.atual = null;
    desenhar();
}

function teclas(ev) {
    if (ev.key === 'Escape') {
        if (E.atual) { E.atual = null; desenhar(); }
        else fechar();
    }
    if (ev.key === 'Enter') encerrarParede();
}

/** Índice do objeto mais próximo do ponto (tolerância em px da imagem, compensada pelo zoom). */
function acharPerto(p) {
    const tol = 12 / Math.min(E.zoom, 1);
    const dSeg = (p, a, b) => {
        const dx = b.x - a.x, dy = b.y - a.y;
        const l2 = dx * dx + dy * dy;
        const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
        return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    };
    let melhor = -1, melhorD = tol;
    (E.mt.objetos || []).forEach((o, i) => {
        let d = Infinity;
        if (o.tipo === 'luz') d = Math.hypot(p.x - o.x, p.y - o.y) - 6;
        else if (Array.isArray(o.pontos)) {
            for (let k = 0; k < o.pontos.length - 1; k++) d = Math.min(d, dSeg(p, o.pontos[k], o.pontos[k + 1]));
        }
        if (d < melhorD) { melhorD = d; melhor = i; }
    });
    return melhor;
}

/* ── Salvar ──────────────────────────────────────────────── */
async function salvar() {
    const mt = E.mt;
    mt.larguraReal = parseFloat($('#wbmlLargura').value) || 30;
    mt.unidade = $('#wbmlUnidade').value;
    mt.ambiente = $('#wbmlAmbiente').value;
    mt.luzAtiva = $('#wbmlLuzAtiva').checked;
    mt.atualizadoEm = Date.now();

    if (!localPronto(mt)) { dica('⚠️ Envie o mapa e defina a largura real antes de salvar.'); return; }
    dica('⏳ Salvando…');
    try {
        await updateDoc(doc(db, 'worldbuilding-geography', E.geoId), { mapaTatico: mt });
        dica('✅ Salvo! Este Local já pode ser adicionado no Tabuleiro.');
        if (typeof window.showAlert === 'function') window.showAlert('✅ Mapa tático salvo!', 'success');
    } catch (e) {
        console.error(e);
        dica('❌ Erro ao salvar — veja o console.');
    }
}
