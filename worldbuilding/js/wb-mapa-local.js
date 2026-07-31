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
import { localPronto, pontosDaForma, comprimentoDaLinha, importarDungeonAlchemist } from '../../shared/local-tatico.js';

const esc = (s = '') => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const FERRAMENTAS = [
    ['parede', '✏️ Parede', 'Escolha a forma ao lado. Linha: um clique por vértice, duplo-clique ou Enter encerra. Esc cancela.'],
    ['porta', '🚪 Porta', 'Dois cliques: início e fim da porta.'],
    ['janela', '🪟 Janela', 'Dois cliques: início e fim da janela.'],
    ['luz', '💡 Luz', 'Um clique posiciona a luz (alcance e cor ao lado).'],
    ['npc', '🎭 NPC', 'Escolha o NPC e a camada ao lado, depois clique onde ele fica.'],
    ['apagar', '🗑️ Apagar', 'Clique sobre um elemento para removê-lo.'],
];

/** Formas de parede. Todas terminam como `pontos[]` — o tabuleiro e o
 *  raycasting não precisam saber qual foi usada. */
const FORMAS = [
    ['linha', '📐 Linha', 'clique a clique'],
    ['livre', '🖌️ Livre', 'arraste como caneta'],
    ['ret', '⬜ Retângulo', 'arraste de canto a canto'],
    ['elipse', '⚪ Elipse', 'arraste a área'],
];

const E = {                    // estado do editor aberto
    geoId: null, nome: '',
    mt: null,                  // mapaTatico em edição (cópia de trabalho)
    tool: 'parede',
    forma: 'linha',            // forma da parede (FORMAS)
    atual: null,               // pontos da parede/porta em andamento
    desenhando: null,          // arrasto em andamento (livre/ret/elipse)
    npcs: [],                  // NPCs vinculados a este Local
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
    // NPCs vinculados na ficha do Local; a imagem vem do catálogo carregado
    // pelo núcleo (window.WB.data.npcs), então o token já nasce com retrato.
    const catalogo = window.WB?.data?.npcs || [];
    E.npcs = (dados?.linkedNpcs || []).map(n => {
        const full = catalogo.find(x => x.id === n.id);
        return { id: n.id, nome: n.name || full?.nome || 'NPC', url: full?.imagem || full?.imagemUrl || '' };
    });
    // Faxina: NPC que saiu da ficha não pode continuar no mapa (o vínculo é
    // a fonte da verdade — a mesma regra que o wb-core aplica ao salvar).
    E.mt.objetos = (E.mt.objetos || []).filter(o => o.tipo !== 'npc' || E.npcs.some(n => n.id === o.npcId));

    E.tool = 'parede'; E.forma = 'linha';
    E.atual = null; E.desenhando = null;
    E.zoom = 1; E.panX = 0; E.panY = 0;
    montar();
};

function fechar() {
    document.getElementById('wbMapaLocal')?.remove();
    document.removeEventListener('keydown', teclas);
    // Devolve o botão de menu do worldbuilding (escondido enquanto editava)
    document.body.classList.remove('wbml-aberto');
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
        <button class="btn btn-secondary btn-sm" id="wbmlImportDA" title="Selecione o .jpg e o .txt que o Dungeon Alchemist gera no export Roll20 — paredes, portas, janelas e luzes entram prontas.">⚗️ Dungeon Alchemist</button>
        <span style="flex:1"></span>
        <button class="btn btn-success btn-sm" id="wbmlSalvar">💾 Salvar</button>
        <button class="btn btn-secondary btn-sm" id="wbmlFechar">✖ Fechar</button>
    </div>
    <div class="wbml-tools">
        ${FERRAMENTAS.map(([id, rotulo, dica]) => `<button data-wbml-tool="${id}" title="${esc(dica)}" class="${id === E.tool ? 'is-on' : ''}">${rotulo}</button>`).join('')}
        <span class="wbml-sep"></span>
        <span class="wbml-grupo" id="wbmlGrupoParede">Forma
            ${FORMAS.map(([id, rotulo, dica]) => `<button data-wbml-forma="${id}" title="${esc(dica)}" class="${id === E.forma ? 'is-on' : ''}">${rotulo}</button>`).join('')}
        </span>
        <span class="wbml-grupo" id="wbmlGrupoLuz">
            <label>Alcance <input type="number" id="wbmlAlcance" value="6" min="0.5" step="0.5" style="width:60px"> <span id="wbmlUnLuz">${esc(mt.unidade || 'm')}</span></label>
            <label>Cor <input type="color" id="wbmlCorLuz" value="#ffdd99"></label>
            <select id="wbmlAnimLuz">
                <option value="">Sem animação</option>
                <option value="tocha">🔥 Tocha</option>
                <option value="pulso">💗 Pulso</option>
            </select>
        </span>
        <span class="wbml-grupo" id="wbmlGrupoNpc">
            <label>NPC <select id="wbmlNpc">
                ${E.npcs.length
                    ? E.npcs.map(n => `<option value="${esc(n.id)}">${esc(n.nome)}</option>`).join('')
                    : '<option value="">— nenhum NPC vinculado a este Local —</option>'}
            </select></label>
            <label>Camada <select id="wbmlNpcCamada">
                <option value="tokens">🎭 Tokens (todos veem)</option>
                <option value="dm">🕵️ DM (só o mestre)</option>
            </select></label>
        </span>
        <span style="flex:1"></span>
        <span class="wbml-dica" id="wbmlDica"></span>
    </div>
    <div class="wbml-viewport" id="wbmlViewport">
        <div class="wbml-stage" id="wbmlStage"></div>
        <div class="wbml-vazio" id="wbmlVazio" ${mt.url ? 'hidden' : ''}>
            <p>Nenhum mapa ainda.</p>
            <button class="btn btn-success" onclick="document.getElementById('wbmlTrocarImg').click()">🖼️ Enviar imagem do mapa</button>
            <button class="btn btn-secondary" onclick="document.getElementById('wbmlImportDA').click()">⚗️ Importar do Dungeon Alchemist</button>
        </div>
    </div>
    <input type="file" id="wbmlArquivo" accept="image/*" hidden>
    <input type="file" id="wbmlArquivoDA" accept=".txt,image/*" multiple hidden>`;
    document.body.appendChild(root);

    $('#wbmlFechar').onclick = fechar;
    $('#wbmlSalvar').onclick = salvar;
    $('#wbmlTrocarImg').onclick = () => $('#wbmlArquivo').click();
    $('#wbmlArquivo').addEventListener('change', enviarMapa);
    $('#wbmlImportDA').onclick = () => $('#wbmlArquivoDA').click();
    $('#wbmlArquivoDA').addEventListener('change', importarDA);
    $('#wbmlUnidade').addEventListener('change', () => { $('#wbmlUnLuz').textContent = $('#wbmlUnidade').value; desenhar(); });
    $('#wbmlLargura').addEventListener('change', desenhar);
    root.querySelectorAll('[data-wbml-tool]').forEach(b => b.onclick = () => {
        E.tool = b.dataset.wbmlTool; E.atual = null; E.desenhando = null;
        root.querySelectorAll('[data-wbml-tool]').forEach(x => x.classList.toggle('is-on', x === b));
        dica(FERRAMENTAS.find(f => f[0] === E.tool)?.[2] || '');
        sincronizarGrupos();
        desenhar();
    });
    root.querySelectorAll('[data-wbml-forma]').forEach(b => b.onclick = () => {
        E.forma = b.dataset.wbmlForma; E.atual = null; E.desenhando = null;
        root.querySelectorAll('[data-wbml-forma]').forEach(x => x.classList.toggle('is-on', x === b));
        dica(E.forma === 'linha'
            ? 'Linha: um clique por vértice; duplo-clique ou Enter encerra.'
            : `${FORMAS.find(f => f[0] === E.forma)?.[1]}: ${FORMAS.find(f => f[0] === E.forma)?.[2]}.`);
        desenhar();
    });

    // O botão flutuante de menu do worldbuilding (z-index acima deste
    // overlay) cobria o título e não tinha função aqui — some enquanto edita.
    document.body.classList.add('wbml-aberto');

    document.addEventListener('keydown', teclas);
    ligarViewport();
    sincronizarGrupos();
    desenhar();
    dica(FERRAMENTAS[0][2]);
}

/** Mostra só os controles da ferramenta ativa — a barra estava virando um mural. */
function sincronizarGrupos() {
    const mostra = (id, v) => { const el = $(id); if (el) el.style.display = v ? '' : 'none'; };
    mostra('#wbmlGrupoParede', E.tool === 'parede');
    mostra('#wbmlGrupoLuz', E.tool === 'luz');
    mostra('#wbmlGrupoNpc', E.tool === 'npc');
}

function dica(t) { const el = $('#wbmlDica'); if (el) el.textContent = t; }

/* ── Upload do mapa ──────────────────────────────────────── */
async function subirImagem(file) {
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
}

async function enviarMapa() {
    const file = $('#wbmlArquivo').files[0];
    $('#wbmlArquivo').value = '';
    if (!file || !file.type.startsWith('image/')) return;
    dica('⏳ Enviando mapa…');
    try {
        await subirImagem(file);
        desenhar();
        dica('✅ Mapa carregado. Desenhe as paredes por cima.');
    } catch (e) { console.error(e); dica('❌ Falha no upload — tente de novo.'); }
}

/* ── Import Dungeon Alchemist (export Roll20: .jpg + .txt) ── */
async function importarDA() {
    const files = [...$('#wbmlArquivoDA').files];
    $('#wbmlArquivoDA').value = '';
    const txt = files.find(f => /\.txt$/i.test(f.name));
    const img = files.find(f => f.type.startsWith('image/'));
    if (!txt) { dica('⚠️ Inclua o .txt do export Roll20 (pode selecionar o .jpg junto para já trocar o mapa).'); return; }
    dica('⏳ Importando Dungeon Alchemist…');
    try {
        if (img) await subirImagem(img);
        if (!E.mt.url) { dica('⚠️ Este Local ainda não tem mapa — selecione o .jpg junto com o .txt.'); return; }
        const res = importarDungeonAlchemist(await txt.text(), E.mt.imgW, E.mt.imgH);
        if (!res) { dica('❌ Este .txt não parece um export Roll20 do Dungeon Alchemist.'); return; }
        // Substitui o que veio do DA; NPCs posicionados à mão ficam.
        E.mt.objetos = (E.mt.objetos || []).filter(o => o.tipo === 'npc').concat(res.objetos);
        E.mt.larguraReal = res.larguraReal;
        E.mt.unidade = res.unidade;
        $('#wbmlLargura').value = res.larguraReal;
        $('#wbmlUnidade').value = res.unidade;
        $('#wbmlUnLuz').textContent = res.unidade;
        desenhar();
        const n = (t) => res.objetos.filter(o => o.tipo === t).length;
        dica(`✅ Importado: ${n('parede')} paredes, ${n('porta')} portas, ${n('janela')} janelas, ${n('luz')} luzes · escala ${res.larguraReal} m (1 tile = 1,5 m — ajuste se preciso).`
            + (res.avisos.length ? ` ⚠️ ${res.avisos.join(' ')}` : ''));
    } catch (e) { console.error(e); dica('❌ Falha na importação — veja o console.'); }
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

    const raioNpc = () => Math.max(14, pxPorUnidade() * 0.5);

    (mt.objetos || []).forEach((o, i) => {
        if (o.tipo === 'parede') seg(o.pontos, '#ef4444', null, `data-i="${i}"`);
        if (o.tipo === 'porta') seg(o.pontos, '#f59e0b', null, `data-i="${i}" stroke-width="6"`);
        if (o.tipo === 'janela') seg(o.pontos, '#38bdf8', '10 6', `data-i="${i}" stroke-width="5"`);
        if (o.tipo === 'luz') {
            const r = (Number(o.alcance) || 6) * pxPorUnidade();
            linhas.push(`<circle cx="${o.x}" cy="${o.y}" r="${r}" fill="${o.cor || '#ffdd99'}" fill-opacity=".14" stroke="${o.cor || '#ffdd99'}" stroke-dasharray="6 6" data-i="${i}"/>`);
            linhas.push(`<circle cx="${o.x}" cy="${o.y}" r="9" fill="${o.cor || '#ffdd99'}" data-i="${i}"/>`);
        }
        if (o.tipo === 'npc') {
            const r = raioNpc();
            const cor = o.camada === 'dm' ? '#8A6FE0' : '#3FAE6A';
            if (o.url) {
                linhas.push(`<clipPath id="cnpc${i}"><circle cx="${o.x}" cy="${o.y}" r="${r}"/></clipPath>`);
                linhas.push(`<image href="${esc(o.url)}" x="${o.x - r}" y="${o.y - r}" width="${r * 2}" height="${r * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#cnpc${i})" data-i="${i}"/>`);
            } else {
                linhas.push(`<circle cx="${o.x}" cy="${o.y}" r="${r}" fill="${cor}" fill-opacity=".35" data-i="${i}"/>`);
            }
            linhas.push(`<circle cx="${o.x}" cy="${o.y}" r="${r}" fill="none" stroke="${cor}" stroke-width="3" data-i="${i}"/>`);
            linhas.push(`<text x="${o.x}" y="${o.y - r - 6}" fill="${cor}" font-size="${r * 0.8}" text-anchor="middle" stroke="none">${esc(o.camada === 'dm' ? '🕵️ ' : '')}${esc(o.nome || 'NPC')}</text>`);
        }
    });

    // traço em andamento
    const corAtual = E.tool === 'porta' ? '#f59e0b' : E.tool === 'janela' ? '#38bdf8' : '#ef4444';
    if (E.atual?.length) {
        seg(E.atual, corAtual, '4 4', 'stroke-width="2.5"');
        E.atual.forEach(p => linhas.push(`<circle cx="${p.x}" cy="${p.y}" r="5" fill="${corAtual}"/>`));
    }
    if (E.desenhando?.length >= 2) seg(E.desenhando, corAtual, '4 4', 'stroke-width="2.5"');

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
            return;
        }
        // Parede em forma de arrasto (livre/retângulo/elipse) começa aqui;
        // a forma 'linha' continua clique a clique, tratada no 'click'.
        if (ev.button === 0 && E.mt.url && E.tool === 'parede' && E.forma !== 'linha'
            && !ev.target.closest('.wbml-vazio')) {
            E.ancora = pontoDoEvento(ev);      // canto fixo de ret/elipse
            E.desenhando = [E.ancora];
            vp.setPointerCapture(ev.pointerId);
            ev.preventDefault();
        }
    });
    vp.addEventListener('pointermove', (ev) => {
        if (E.arrastando) {
            E.panX += ev.clientX - E.arrastando.x;
            E.panY += ev.clientY - E.arrastando.y;
            E.arrastando = { x: ev.clientX, y: ev.clientY };
            aplicarTransform();
            return;
        }
        if (!E.desenhando) return;
        const p = pontoDoEvento(ev);
        if (E.forma === 'livre') {
            // 1 ponto a cada ~4px: sem isso o arrasto vira milhares de vértices
            // e o raycasting do tabuleiro engasga.
            const u = E.desenhando[E.desenhando.length - 1];
            if (Math.hypot(p.x - u.x, p.y - u.y) >= 4) E.desenhando.push(p);
        } else {
            // A âncora é o canto onde o arrasto começou — reler de `desenhando`
            // não serve, ele é substituído a cada movimento.
            E.desenhando = pontosDaForma(E.forma, E.ancora, p);
        }
        desenhar();
    });
    vp.addEventListener('pointerup', () => {
        E.arrastando = null;
        if (!E.desenhando) return;
        const pts = E.desenhando;
        E.desenhando = null; E.ancora = null;
        // Clique seco (sem arrasto) não vira parede
        if (pts.length >= 2 && comprimentoDaLinha(pts) > 3) {
            E.mt.objetos.push({ tipo: 'parede', pontos: pts });
        }
        desenhar();
    });
    vp.addEventListener('contextmenu', (ev) => ev.preventDefault());

    vp.addEventListener('click', (ev) => {
        if (!E.mt.url || ev.target.closest('.wbml-vazio')) return;
        if (E.tool === 'parede' && E.forma !== 'linha') return;  // já tratado no arrasto
        clique(pontoDoEvento(ev));
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
    } else if (E.tool === 'npc') {
        const id = $('#wbmlNpc').value;
        if (!id) { dica('⚠️ Vincule um NPC a este Local na ficha (seção “NPCs/Criaturas neste Local”) antes.'); return; }
        const n = E.npcs.find(x => x.id === id);
        mt.objetos.push({
            tipo: 'npc', npcId: id, nome: n?.nome || 'NPC', url: n?.url || '',
            camada: $('#wbmlNpcCamada').value === 'dm' ? 'dm' : 'tokens',
            x: p.x, y: p.y,
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
    const raioNpc = Math.max(14, (E.mt.imgW > 0 ? E.mt.imgW / (E.mt.larguraReal || 30) : 10) * 0.5);
    (E.mt.objetos || []).forEach((o, i) => {
        let d = Infinity;
        if (o.tipo === 'luz') d = Math.hypot(p.x - o.x, p.y - o.y) - 6;
        else if (o.tipo === 'npc') d = Math.hypot(p.x - o.x, p.y - o.y) - raioNpc;
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
