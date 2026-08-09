// =====================================================================
// PAINEL DO CRIADOR — Módulo de Elementos Rúnicos (Runomancia)
// Compêndio da Magia Rúnica — Edição Unificada e Revisada
// ---------------------------------------------------------------------
// Este módulo é importado por painel-firebase.js e fornece:
//  - RUNIC_MODULE_DEF  → definição do módulo "Elementos Rúnicos"
//  - buildRunicField / collectRunicField → tipos de campo customizados:
//      runic_image_upload      (imagem do glifo — shared/campo-imagem.js)
//      runic_connection_points (editor visual de pontos de conexão)
//      runic_levels_editor     (tabela de níveis: Ess/EXP/sessões/props)
//  - importRunicSeed → importa os 64 elementos do Compêndio (5 Artus,
//    14 Aspectus, 45 Sigilus) para o Firestore, uma única vez.
// =====================================================================

function _esc(t) {
    return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// =====================================================================
// 1) DEFINIÇÃO DO MÓDULO (colecão system/data/runicElements)
// =====================================================================
export const RUNIC_MODULE_DEF = {
    name: 'Elemento Rúnico', namePlural: 'Elementos Rúnicos', icon: 'ᛟ',
    collection: 'system/data/runicElements',
    fields: [
        { key: 'nome', label: 'Nome', type: 'text', required: true, placeholder: 'Ex: Raiz, Criar, Fogo' },
        { key: 'nomeLatim', label: 'Nome em Latim', type: 'text', placeholder: 'Ex: Radix, Sipho Crystallinus' },
        {
            key: 'tipoElemento', label: 'Família do Elemento', type: 'select', required: true, options: [
                { value: 'artus', label: 'Artus (a Ação)' },
                { value: 'aspectus', label: 'Aspectus (a Essência)' },
                { value: 'sigilus', label: 'Sigilus (as Engrenagens)' },
            ]
        },
        {
            key: 'categoria', label: 'Categoria (Sigilus)', type: 'select', options: [
                { value: 'captador', label: 'Captador' },
                { value: 'condutor', label: 'Condutor' },
                { value: 'modulador', label: 'Modulador' },
                { value: 'logico', label: 'Lógico' },
                { value: 'armazenador', label: 'Armazenador' },
                { value: 'emissor', label: 'Emissor' },
                { value: 'exaustor', label: 'Exaustor' },
            ]
        },
        {
            key: 'complexidade', label: 'Complexidade (Sigilus)', type: 'select', options: [
                { value: 'iniciante', label: 'Iniciante' },
                { value: 'intermediario', label: 'Intermediário' },
                { value: 'avancado', label: 'Avançado' },
                { value: 'mestre', label: 'Mestre' },
            ]
        },
        { key: 'maxNivel', label: 'Nível Máximo', type: 'number', placeholder: '3 (Sigilus) ou 5 (Artus/Aspectus)' },
        { key: 'cor', label: 'Cor da Essência (Aspectus)', type: 'text', placeholder: 'Ex: Vermelha, Prateada' },
        { key: 'descricao', label: 'Descrição / Função', type: 'textarea', required: true, placeholder: 'O que este elemento faz no circuito' },
        { key: 'limites', label: 'Limites e Regras Especiais', type: 'textarea', placeholder: 'Ex: exige Memória acoplada; não miniaturiza…' },
        { key: 'posicaoRegra', label: 'Regra de Posição', type: 'text', placeholder: 'Ex: início do circuito, posição final do ramo' },
        { key: 'flags', label: 'Flags de Engine (validação)', type: 'tags', placeholder: 'Ex: reconhecedor, memoria, confluencia, estabilizador…' },
        { key: 'niveis', label: '📈 Níveis — Custos e Propriedades', type: 'runic_levels_editor' },
        { key: 'imagemUrl', label: '🖼️ Imagem do Glifo (upload)', type: 'runic_image_upload' },
        { key: 'pontosConexao', label: '🔗 Pontos de Conexão (snap no Canvas)', type: 'runic_connection_points' },
        { key: 'ordem', label: 'Ordem de Exibição', type: 'number', placeholder: '0' },
    ]
};

// =====================================================================
// 2) CAMPOS CUSTOMIZADOS — BUILD
// =====================================================================
export function buildRunicField(field, value) {
    if (field.type === 'runic_image_upload') return _buildImageUpload(field, value);
    if (field.type === 'runic_connection_points') return _buildConnPoints(field, value);
    if (field.type === 'runic_levels_editor') return _buildLevelsEditor(field, value);
    return '';
}

// ---- Imagem do glifo (campo padrão: URL colada ou arquivo do aparelho) ----
function _buildImageUpload(field, value) {
    const url = typeof value === 'string' ? value : '';
    return `
    <label>${_esc(field.label)}</label>
    <div class="runic-img-upload" id="runicImg_${field.key}">
        <div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap">
            <div class="runic-img-preview" id="runicImgPrev_${field.key}"
                 style="width:120px;height:120px;border:1px dashed var(--soft,#334);border-radius:10px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:var(--lr-bg-1)">
                ${url ? `<img src="${_esc(url)}" style="width:100%;height:100%;object-fit:contain">` : '<span style="font-size:.65rem;color:var(--muted)">sem imagem</span>'}
            </div>
            <div style="flex:1;min-width:200px">
                ${CampoImagem.html({ id: `field_${field.key}`, valor: url, pasta: 'runic-elements', preview: false, attrs: `oninput="window.runicSetImageUrl(this.value,'${field.key}')"` })}
                <div style="font-size:.68rem;color:var(--muted);margin-top:6px">
                    PNG/SVG com fundo transparente rende melhor no Canvas.
                </div>
            </div>
        </div>
    </div>`;
}

window.runicSetImageUrl = function (url, key) {
    const prev = document.getElementById(`runicImgPrev_${key}`);
    if (prev) prev.innerHTML = url ? `<img src="${_esc(url)}" style="width:100%;height:100%;object-fit:contain">` : '<span style="font-size:.65rem;color:var(--muted)">sem imagem</span>';
    // Atualiza o fundo do editor de pontos, se aberto
    const stage = document.querySelector('.runic-cp-stage');
    if (stage) stage.style.backgroundImage = url ? `url("${url}")` : 'none';
};

// ---- Editor de Pontos de Conexão ----
// Estrutura salva: [{x, y, tipo:'entrada'|'saida'|'sinal', rotulo}]
// x/y em porcentagem (0–100) relativos à caixa do elemento no Canvas.
const CP_TIPOS = { entrada: '#38bdf8', saida: '#f59e0b', sinal: '#a78bfa' };

function _buildConnPoints(field, value) {
    const pts = Array.isArray(value) ? value : [];
    const imgUrl = document.getElementById('field_imagemUrl')?.value || '';
    return `
    <label>${_esc(field.label)}</label>
    <div class="runic-cp-editor" id="runicCP_${field.key}" data-field-key="${field.key}">
        <input type="hidden" id="field_${field.key}" value="${_esc(JSON.stringify(pts))}">
        <div style="display:flex;gap:12px;flex-wrap:wrap">
            <div class="runic-cp-stage" onclick="window.runicCPStageClick(event,'${field.key}')"
                style="position:relative;width:220px;height:220px;border:1px solid var(--soft,#334);border-radius:12px;
                       background:var(--lr-bg-1) ${imgUrl ? `url('${_esc(imgUrl)}')` : ''};background-size:contain;background-repeat:no-repeat;background-position:center;cursor:crosshair">
            </div>
            <div style="flex:1;min-width:220px">
                <div style="font-size:.7rem;color:var(--muted);margin-bottom:6px">
                    Clique no palco para adicionar um ponto. Tipos:
                    <b style="color:${CP_TIPOS.entrada}">entrada</b> ·
                    <b style="color:${CP_TIPOS.saida}">saída</b> ·
                    <b style="color:${CP_TIPOS.sinal}">sinal</b>.
                    Saída conecta a Entrada; Sinal conecta a Sinal (Lei do Circuito).
                </div>
                <div id="runicCPList_${field.key}"></div>
            </div>
        </div>
    </div>`;
}

function _cpGet(key) {
    try { return JSON.parse(document.getElementById(`field_${key}`).value || '[]'); } catch { return []; }
}
function _cpSet(key, pts) {
    document.getElementById(`field_${key}`).value = JSON.stringify(pts);
    _cpRender(key);
}
function _cpRender(key) {
    const pts = _cpGet(key);
    const stage = document.querySelector(`#runicCP_${key} .runic-cp-stage`);
    const list = document.getElementById(`runicCPList_${key}`);
    if (stage) {
        stage.querySelectorAll('.runic-cp-dot').forEach(d => d.remove());
        pts.forEach((p, i) => {
            const dot = document.createElement('div');
            dot.className = 'runic-cp-dot';
            dot.title = `${p.tipo} ${p.rotulo || ''}`;
            dot.style.cssText = `position:absolute;left:${p.x}%;top:${p.y}%;width:14px;height:14px;margin:-7px;border-radius:50%;
                border:2px solid #0f172a;background:${CP_TIPOS[p.tipo] || '#888'};box-shadow:0 0 6px ${CP_TIPOS[p.tipo] || '#888'}`;
            dot.onclick = (ev) => { ev.stopPropagation(); window.runicCPRemove(key, i); };
            stage.appendChild(dot);
        });
    }
    if (list) {
        list.innerHTML = pts.map((p, i) => `
            <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px;font-size:.72rem">
                <span style="width:10px;height:10px;border-radius:50%;background:${CP_TIPOS[p.tipo] || '#888'};display:inline-block"></span>
                <select onchange="window.runicCPEdit('${key}',${i},'tipo',this.value)" style="font-size:.72rem">
                    ${['entrada', 'saida', 'sinal'].map(t => `<option value="${t}" ${p.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
                <input value="${_esc(p.rotulo || '')}" placeholder="rótulo" style="flex:1;font-size:.72rem"
                    oninput="window.runicCPEdit('${key}',${i},'rotulo',this.value)">
                <span style="color:var(--muted)">${Math.round(p.x)}%, ${Math.round(p.y)}%</span>
                <button type="button" onclick="window.runicCPRemove('${key}',${i})" style="background:none;border:none;color:#ef4444;cursor:pointer">✕</button>
            </div>`).join('') || '<div style="font-size:.72rem;color:var(--muted)">Nenhum ponto definido — o Canvas usará entrada à esquerda e saída à direita.</div>';
    }
}
window.runicCPStageClick = function (ev, key) {
    const stage = ev.currentTarget;
    const r = stage.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * 100;
    const y = ((ev.clientY - r.top) / r.height) * 100;
    const pts = _cpGet(key);
    pts.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, tipo: 'entrada', rotulo: '' });
    _cpSet(key, pts);
};
window.runicCPRemove = function (key, i) { const p = _cpGet(key); p.splice(i, 1); _cpSet(key, p); };
window.runicCPEdit = function (key, i, prop, val) { const p = _cpGet(key); if (p[i]) { p[i][prop] = val; document.getElementById(`field_${key}`).value = JSON.stringify(p); if (prop === 'tipo') _cpRender(key); } };
window.runicCPInit = function (key) { _cpRender(key); };

// ---- Editor de Níveis ----
// Estrutura salva: [{nivel, custoEss, custoExp, sessoesEstudo, capacidade, taxa, propriedades}]
function _buildLevelsEditor(field, value) {
    const rows = Array.isArray(value) ? value : [];
    return `
    <div class="runic-levels-editor" id="runicLv_${field.key}" data-field-key="${field.key}">
        <div class="array-editor-header">
            <label>${_esc(field.label)}</label>
            <button type="button" class="btn-array-add" onclick="window.runicLvAdd('${field.key}')">➕ Nível</button>
        </div>
        <div style="font-size:.65rem;color:var(--muted);margin:4px 0 6px">
            <b>Custo Ess</b> = custo no CT (Compêndio §5.1 / Parte III–IV) · <b>EXP</b> e <b>Sessões</b> = aprendizado (Parte XI) ·
            <b>Capacidade</b> (Ess — Armazenadores/Exaustores) e <b>Taxa</b> (Ess/h — Captadores contínuos) alimentam a auditoria do Laboratorium.
        </div>
        <div class="runic-lv-head" style="display:grid;grid-template-columns:44px 70px 70px 70px 80px 80px 1fr 24px;gap:4px;font-size:.62rem;color:var(--muted);padding:0 2px">
            <span>Nv</span><span>Ess</span><span>EXP</span><span>Sessões</span><span>Capac.</span><span>Taxa/h</span><span>Propriedades do nível</span><span></span>
        </div>
        <div id="runicLvRows_${field.key}">${rows.map((r, i) => _lvRow(field.key, r, i)).join('')}</div>
    </div>`;
}
function _lvRow(key, r, i) {
    r = r || {};
    return `
    <div class="runic-lv-row" style="display:grid;grid-template-columns:44px 70px 70px 70px 80px 80px 1fr 24px;gap:4px;margin-bottom:4px">
        <input data-lv="nivel" type="number" min="1" value="${r.nivel ?? (i + 1)}">
        <input data-lv="custoEss" type="number" min="0" value="${r.custoEss ?? ''}" placeholder="Ess">
        <input data-lv="custoExp" type="number" min="0" value="${r.custoExp ?? ''}" placeholder="EXP">
        <input data-lv="sessoesEstudo" type="number" min="0" value="${r.sessoesEstudo ?? ''}" placeholder="sess.">
        <input data-lv="capacidade" type="number" min="0" value="${r.capacidade ?? ''}" placeholder="—">
        <input data-lv="taxa" type="number" min="0" step="0.5" value="${r.taxa ?? ''}" placeholder="—">
        <input data-lv="propriedades" type="text" value="${_esc(r.propriedades || '')}" placeholder="Ex: raio 3 m; eficiência 90%">
        <button type="button" onclick="this.closest('.runic-lv-row').remove()" style="background:none;border:none;color:#ef4444;cursor:pointer">✕</button>
    </div>`;
}
window.runicLvAdd = function (key) {
    const box = document.getElementById(`runicLvRows_${key}`);
    const n = box.querySelectorAll('.runic-lv-row').length;
    box.insertAdjacentHTML('beforeend', _lvRow(key, { nivel: n + 1 }, n));
};

// =====================================================================
// 3) CAMPOS CUSTOMIZADOS — COLLECT
// =====================================================================
export function collectRunicField(field) {
    if (field.type === 'runic_image_upload') {
        return document.getElementById(`field_${field.key}`)?.value || '';
    }
    if (field.type === 'runic_connection_points') {
        try { return JSON.parse(document.getElementById(`field_${field.key}`)?.value || '[]'); } catch { return []; }
    }
    if (field.type === 'runic_levels_editor') {
        const rows = [];
        document.querySelectorAll(`#runicLvRows_${field.key} .runic-lv-row`).forEach(row => {
            const g = k => row.querySelector(`[data-lv="${k}"]`)?.value ?? '';
            const nivel = parseInt(g('nivel'), 10);
            if (!nivel) return;
            const num = k => { const v = parseFloat(g(k)); return isNaN(v) ? null : v; };
            rows.push({
                nivel,
                custoEss: num('custoEss') ?? 0,
                custoExp: num('custoExp') ?? 0,
                sessoesEstudo: num('sessoesEstudo') ?? 0,
                capacidade: num('capacidade'),
                taxa: num('taxa'),
                propriedades: g('propriedades').trim()
            });
        });
        rows.sort((a, b) => a.nivel - b.nivel);
        return rows;
    }
    return null;
}

// =====================================================================
// 4) SEED — Importa o Compêndio (5 Artus + 14 Aspectus + 45 Sigilus)
// =====================================================================
// Pontos de conexão padrão por papel no fluxo canônico (§1.3):
const CP = {
    fonte: [{ x: 92, y: 50, tipo: 'saida', rotulo: 'fluxo' }],
    fim: [{ x: 8, y: 50, tipo: 'entrada', rotulo: 'fluxo' }],
    passagem: [{ x: 8, y: 50, tipo: 'entrada', rotulo: 'in' }, { x: 92, y: 50, tipo: 'saida', rotulo: 'out' }],
    logico: [{ x: 8, y: 50, tipo: 'entrada', rotulo: 'fluxo in' }, { x: 92, y: 50, tipo: 'saida', rotulo: 'fluxo out' }, { x: 50, y: 8, tipo: 'sinal', rotulo: 'sinal' }],
    sensor: [{ x: 50, y: 92, tipo: 'sinal', rotulo: 'sinal' }],
    bifurc: [{ x: 8, y: 50, tipo: 'entrada' }, { x: 92, y: 25, tipo: 'saida', rotulo: 'A' }, { x: 92, y: 75, tipo: 'saida', rotulo: 'B' }],
    conflu: [{ x: 8, y: 25, tipo: 'entrada', rotulo: 'A' }, { x: 8, y: 75, tipo: 'entrada', rotulo: 'B' }, { x: 92, y: 50, tipo: 'saida', rotulo: 'elemento' }],
    eloEm: [{ x: 8, y: 50, tipo: 'entrada' }, { x: 50, y: 8, tipo: 'sinal', rotulo: 'filamento' }],
    eloRec: [{ x: 50, y: 8, tipo: 'sinal', rotulo: 'filamento' }, { x: 92, y: 50, tipo: 'saida' }],
};
// Sessões de estudo por complexidade (§11.2): Nv1/Nv2/Nv3
const SESS = { iniciante: [2, 3, 4], intermediario: [4, 5, 6], avancado: [6, 8, 10], mestre: [10, 12, 15] };
// Custos Ess por categoria/complexidade (§5.1)
const CUSTO = {
    captador: { iniciante: [2, 4, 8], intermediario: [4, 8, 16], avancado: [8, 16, 32] },
    condutor: { iniciante: [1, 3, 6], intermediario: [3, 6, 12], avancado: [6, 12, 24], mestre: [12, 24, 48] },
    modulador: { iniciante: [2, 5, 10], intermediario: [5, 10, 20], avancado: [10, 20, 40] },
    logico: { iniciante: [2, 4, 8], intermediario: [4, 8, 16], avancado: [8, 16, 32], mestre: [16, 32, 64] },
    armazenador: { iniciante: [3, 6, 12], intermediario: [6, 12, 24], avancado: [12, 24, 48], mestre: [24, 48, 96] },
    emissor: { iniciante: [2, 5, 10], intermediario: [5, 10, 20], avancado: [10, 20, 40] },
    exaustor: { iniciante: [1, 2, 4], intermediario: [2, 4, 8], avancado: [4, 8, 16] },
};

function _lv(custos, sess, extra) {
    return custos.map((c, i) => ({
        nivel: i + 1, custoEss: c, custoExp: c, sessoesEstudo: sess[i],
        capacidade: extra?.cap?.[i] ?? null, taxa: extra?.taxa?.[i] ?? null,
        propriedades: extra?.props?.[i] || ''
    }));
}

// [ordem, nome, latim, categoria, complexidade, cp, flags, desc, limites, posicao, {cap/taxa/props}]
const SIGILUS = [
    [1, 'Raiz', 'Radix', 'captador', 'iniciante', 'fonte', ['captador_continuo'], 'Absorve Essência do ambiente passivo — uma esponja que absorve a essência dispersa que permeia todo espaço.', 'Mais de 3 Raízes em 5 m: todas a −50%. Perto de Nexos Corrompidos absorve impurezas (use Filtro). Inútil em combate.', 'Início do circuito', { taxa: [1, 3, 6], props: ['raio 0,5 m', 'raio 1,5 m', 'raio 3 m; funciona em Essência morta (taxa ÷10)'] }],
    [2, 'Sifão Cristalino', 'Sipho Crystallinus', 'captador', 'intermediario', 'fonte', ['sifao_cristalino'], 'Extrai Essência de cristais e Lunis encaixados na runa. Obrigatório em qualquer runa alimentada por Lunis (⟐).', 'Cristal fragmenta após extração total. Teto: Nv1 = 1 Luni; Nv2–3 = 2 Lunis (50 Ess) por operação.', 'Início do circuito', { props: ['1 Luni; 25 Ess em 6 s; Ativado 100%', '2 Lunis; 25 Ess em 3 s; detecta qualidade', '2 Lunis; 1 s; Extração Parcial nativa'] }],
    [3, 'Sifão de Fluxo', 'Sipho Fluxi', 'captador', 'intermediario', 'fonte', ['captador_continuo'], 'Conexão temporária e portátil com uma Linha de Ley.', 'Exige proximidade da Ley; reconexão após tempo máximo: 10 min de recalibração + teste de Runomancia (⟐).', 'Início do circuito', { taxa: [3, 8, 15], props: ['contato; máx 1 h; só Capilar', '1 m; máx 4 h; Capilar/Ramo', '3 m; máx 12 h; todas (Tronco c/ risco 15%)'] }],
    [4, 'Sifão Vital', 'Sipho Vitalis', 'captador', 'avancado', 'fonte', ['sifao_vital', 'proibido'], 'Drena Essência de Vida de seres vivos que não são o usuário. PROIBIDO pelo Protocolo de Valdris — equivale a agressão.', 'Cada 5 Ess drenados = 1 Energia do alvo; além do 0 drena Vitalidade (1 VIT/5 Ess) — e mata. Rastro forte.', 'Início do circuito', { props: ['2 Ess/s; toque; eficiência 50%', '4 Ess/s; 1 m; 70%', '8 Ess/s; 3 m; 90%; drena mortos-vivos (Púrpura)'] }],
    [5, 'Pulso', 'Pulsus', 'captador', 'intermediario', 'fonte', [], 'Drena Energia do próprio usuário ao toque, no ritmo dos batimentos: 1 En → 5 Ess (Taxa de Conversão Vital).', 'Exige contato de pele; não acumula. Gastar >50% da Energia máx. em <1 min: teste de VIG ou desmaia.', 'Início do circuito', { props: ['1 pulso/3 s (2 s em combate); dor leve', '1 pulso/2 s (1,5 s); desconforto mínimo', '1 pulso/1 s (0,7 s); sem colateral'] }],
    [6, 'Âncora', 'Ancora', 'captador', 'avancado', 'fonte', ['captador_continuo'], 'Conexão permanente e fixa com Nexo ou Linha de Ley — a tomada elétrica da Runomancia.', 'Estacionária; degrada 1%/mês (recalibração periódica). Nexo Desperto: ×2 (Nv3 ×3).', 'Início do circuito', { taxa: [5, 10, 20], props: ['Ramo+/contato; Efeito Sifão 5%/mês', 'Ramo+/2 m; 3%/mês', 'Capilar+/5 m; reconexão 1 h; 1%/mês'] }],
    [7, 'Veio', 'Vena', 'condutor', 'iniciante', 'passagem', [], 'O canal fundamental — o "fio" do circuito. Custeie apenas Veios com função própria (Regra dos Veios Estruturais ⟐).', 'Perda do Nv1 dissipa como calor (fonte de Rastro em circuitos longos).', 'Condução', { props: ['eficiência 90%; 30 cm; 25 Ess/s', '95%; 1 m; 50 Ess/s', '100%; 3 m; 100 Ess/s'] }],
    [8, 'Bifurcação', 'Bifurcatio', 'condutor', 'iniciante', 'bifurc', [], 'Divide um fluxo em exatamente dois caminhos, na proporção definida na gravação.', 'Nv3 tem 3 saídas (trifurcação) e ajuste dinâmico via Selector.', 'Condução', { props: ['50/50 fixo; perda 5%', '10/90 a 90/10; perda 3%', '3 saídas; qualquer proporção; perda 0%'] }],
    [9, 'Confluência', 'Confluentia', 'condutor', 'intermediario', 'conflu', ['confluencia'], 'Une exatamente dois fluxos aspectados num canal combinado — o componente que cria Elementos (Vapor, Lava, Gelo…). Regras em §4.5.', 'Nv1 só combinações Físicas (Arcanas/Proibidas = falha automática). Exige 2 Aspectus + 2 Veios próprios.', 'Após os Aspectus, antes do Artus', { props: ['2 entradas; fusão 85%; só Físicos', '93%; + Orgânicos', '3 entradas; 100%; todos (inclui Proibidos)'] }],
    [10, 'Espiral', 'Spiralis', 'condutor', 'intermediario', 'passagem', [], 'Acelera o fluxo por padrão helicoidal — antes de Emissores (velocidade) ou Confluências (mistura homogênea).', 'Risco de ruptura em Veio Nv1: 10/20/40% (Nv3 exige Veio Nv2+).', 'Condução', { props: ['×1,5 veloc.; +20% pressão', '×2; +40%', '×3; +80%'] }],
    [11, 'Ponte', 'Pons', 'condutor', 'avancado', 'passagem', ['ponte'], 'Permite que um fluxo "pule" sobre outro sem interferência — sem Ponte, fluxos que se cruzam se misturam ou entram em curto (Lei do Circuito).', '', 'Sobre cruzamentos', { props: ['pula 1 linha; perda 5%/linha', '2 linhas; 3%; bidirecional', '3 linhas; 1%; bidirecional'] }],
    [12, 'Ciclo', 'Cyclus', 'condutor', 'avancado', 'passagem', [], 'Recircula parte da Essência ao início do circuito, reduzindo o consumo de efeitos contínuos.', 'Compatível com Reciclador a partir do Nv2 (+5% no Nv3).', 'Condução', { props: ['recircula 10%; perda 5%; 5 ciclos', '20%; 3%; 10 ciclos', '30%; 1%; 20 ciclos'] }],
    [13, 'Elo', 'Catena', 'condutor', 'mestre', 'eloEm', ['elo'], 'Par de sigilos gêmeos gravados em runas distintas, ligados por filamento sintonizado. O único elemento que atravessa a Lei do Circuito — coração das Cadeias Rúnicas (Parte IX). Custo listado é POR METADE.', 'Metades gravadas na mesma sessão/tinta. Filamento visível a Sensor de Essência; rompe além do alcance. Laços (A→B→A) são proibidos. Não miniaturiza.', 'Emissora: posição final a montante · Receptora: captador a jusante', { props: ['10 m; só Sinal Lógico; 1 receptor; 30 m/s', '50 m; Sinal + até 15 Ess (perda 10%)', '300 m; Sinal + 40 Ess + Padrões (perda 3%); 2 receptores'] }],
    [14, 'Atenuador', 'Attenuator', 'modulador', 'iniciante', 'passagem', ['atenuador'], 'Reduz a intensidade do fluxo — um resistor. Essencial para dosagem (antes de Infusores), Grau em Confluências e Extração Parcial.', 'Essência removida vai ao Exaustor (Nv3: ou Armazenador + Reciclador).', 'Modulação', { props: ['redução fixa a 75%; ±15%', 'ajustável 25–75%; ±5%', 'ajustável 1–99%; ±1% (cirúrgica)'] }],
    [15, 'Amplificador de Potência', 'Amplificator Potentiae', 'modulador', 'intermediario', 'passagem', ['amplificador'], 'Aumenta a intensidade consumindo mais Essência de entrada — não cria energia, comprime. Opera DENTRO do circuito.', 'Nv3 exige Estabilizador. Risco de sobrecarga no Veio: 10/15/25%.', 'Modulação', { props: ['×1,5; consome +50%', '×2; +100%; Estabilizador recomendado', '×3; +200%; Estabilizador obrigatório'] }],
    [16, 'Amplificador de Captação', 'Amplificator Captionis', 'modulador', 'avancado', 'passagem', ['amplificador', 'amp_captacao'], 'Expande o teto de absorção simultânea do conjunto de captação (⟐ custo corrigido: Modulador Avançado). Acopla-se a um Sifão Cristalino.', 'Exige Sifão Cristalino. Nv2 recomenda Estabilizador; Nv3 exige. Sempre entra no CT.', 'Acoplado ao Sifão Cristalino', { props: ['teto 75 Ess (3 Lunis)', 'teto 125 Ess (5 Lunis)', 'teto 250 Ess (10 Lunis)'] }],
    [17, 'Filtro', 'Filtrum', 'modulador', 'intermediario', 'passagem', ['filtro'], 'Remove impurezas do fluxo — indispensável com Raiz e Sifão de Fluxo (essência ambiental misturada).', 'Nv1 não trata Púrpura (corrompe o Filtro); Preta só no Nv3 (uso único).', 'Modulação', { props: ['1 tipo; perda 10%', 'até 3 tipos; 5%; Púrpura (desgasta)', 'todas exceto a desejada; 2%; Preta (uso único)'] }],
    [18, 'Estabilizador', 'Stabilizator', 'modulador', 'intermediario', 'passagem', ['estabilizador'], 'Mantém o fluxo constante apesar de variações na entrada — absorve picos, compensa quedas.', 'Obrigatório com Amplificador (Potência ou Captação) Nv3.', 'Modulação', { props: ['tolera ±10%; saída ±10%; buffer 2 Ess', '±25%; ±5%; 5 Ess', '±50%; ±2%; 10 Ess'] }],
    [19, 'Conversor', 'Conversor', 'modulador', 'avancado', 'passagem', [], 'Transforma parcialmente um tipo de essência em outro — decompõe em genérica e recompõe, sempre com perdas. Para emergências.', 'De/para Abissal: impossível (limite absoluto). Subproduto: calor (exige Exaustor).', 'Modulação', { props: ['eficiência 40%; só Físicas', '60%; + Orgânicas', '80%; todas'] }],
    [20, 'Harmonizador', 'Harmonizator', 'modulador', 'avancado', 'passagem', ['harmonizador'], 'Sincroniza fluxos distintos, alinhando frequências. Sem ele, fluxos dessincronizados geram Ressonância Caótica. Regulador das Cadeias Rúnicas (§9.5).', 'Obrigatório em runas com 2+ Confluências (Nv2+). Reduz Redutor de Confluência Proibida (−1 Nv2 / −2 Nv3). Cadeia: +Nv runas.', 'Modulação', { props: ['sincroniza 2 fluxos; interferência −50%; cadeia +1', '3 fluxos; −80%; cadeia +2', '5 fluxos; −100%; cadeia +3'] }],
    [21, 'Toque', 'Tactus', 'logico', 'iniciante', 'logico', [], 'Válvula binária: bloqueia o fluxo até haver contato físico com a runa. Não detecta nem decide — só abre e fecha.', 'Nv1 exige pele (não funciona com luvas).', 'Lógica', { props: ['liga enquanto tocado; mão firme', '+ modo toggle; ponta do dedo; distingue forte/fraco', '+ temporizado; roçar; padrões (2 toques = modo B)'] }],
    [22, 'Gatilho', 'Claustrum', 'logico', 'iniciante', 'logico', ['gatilho'], 'Porta lógica: libera ou bloqueia o fluxo conforme sinal de outro componente. "Quando o Sensor diz SIM, o Gatilho abre."', 'Não detecta nada por si — responde.', 'Lógica', { props: ['1 entrada; momentâneo; 0,5 s; reset manual', '2 entradas (E/OU); sustentado; 0,1 s', '3+ (E/OU/NÃO/SE-ENTÃO); programável; instantâneo'] }],
    [23, 'Sensor de Presença', 'Sensor Praesentiae', 'logico', 'iniciante', 'sensor', ['sensor'], 'Detecta presença física e movimento de corpos sólidos por perturbação no campo de essência ambiental.', 'Não detecta temperatura, luz, magia ou identidade.', 'Lógica', { props: ['raio 3 m; humano adulto', '10 m; criança/animal médio; estima quantidade', '30 m; rato/inseto grande; conta até 20; através de 50 cm de parede'] }],
    [24, 'Sensor Térmico', 'Sensor Caloris', 'logico', 'iniciante', 'sensor', ['sensor'], 'Detecta variações de temperatura por ressonância com Essência Vermelha residual.', '', 'Lógica', { props: ['3 m; ±10 °C; 0–200 °C', '10 m; ±3 °C; −50 a 500 °C; gradiente', '30 m; ±0,5 °C; −100 a 1.500 °C; mapa térmico'] }],
    [25, 'Sensor Luminoso', 'Sensor Lucis', 'logico', 'iniciante', 'sensor', ['sensor'], 'Detecta variações de luminosidade por ressonância com Essência Amarela ambiental.', '', 'Lógica', { props: ['3 m; claro/escuro binário', '10 m; gradientes; limiar ajustável', '30 m; espectro (cores/intensidade); direção da fonte'] }],
    [26, 'Sensor de Essência', 'Sensor Essentiae', 'logico', 'intermediario', 'sensor', ['sensor'], 'Detecta presença e tipo de Essência mágica: fluxos, runas ativas, magias, criaturas saturadas.', 'Nv1 é cego a Essência Abissal.', 'Lógica', { props: ['5 m; binário + tipo dominante', '15 m; + intensidade/direção; runas + complexidade; Leys Capilares; Abissal (risco)', '50 m; + composição das runas; Capilares + Ramos'] }],
    [27, 'Comparador', 'Comparator', 'logico', 'intermediario', 'logico', ['comparador'], 'Recebe dois sinais e direciona o fluxo pela relação entre eles. Vigilante da Subcarga (Comparador de Carga, §2.8 — só abre com carga ≥ CT).', '', 'Lógica', { props: ['Igual/Diferente; 2 in/2 out; 0,5 s', '+ Maior/Menor; 0,1 s', '+ faixas, múltiplas; 4/4; instantâneo'] }],
    [28, 'Contador', 'Numerator', 'logico', 'intermediario', 'logico', [], 'Rastreia quantas vezes um sinal foi recebido e dispara em contagens definidas. Limitador de usos; em cadeias, acumula pulsos de Elo.', '', 'Lógica', { props: ['até 10; 1 gatilho; uso único', 'até 100; 3 gatilhos; reset manual; regressiva', 'até 1.000; 10 + ciclos; reset automático'] }],
    [29, 'Temporizador', 'Horologium', 'logico', 'intermediario', 'logico', [], 'O relógio da runa: atrasa a ativação, define duração, cria ciclos liga/desliga.', '', 'Lógica', { props: ['atraso máx 1 h; ±5 min; efeito 4 h', '1 semana; ±30 s; 7 dias; ciclos fixos', '1 ano; ±1 s; indefinido; agendamento data-hora'] }],
    [30, 'Selector', 'Selector', 'logico', 'avancado', 'logico', [], 'Interruptor de múltiplas posições: escolhe entre caminhos/efeitos dentro da mesma runa, ligado a Bifurcações.', '', 'Lógica', { props: ['2 caminhos; manual na ativação', '4; + automático (condição); 1 troca/cena', '8; + sequencial/prioridade; troca livre'] }],
    [31, 'Reconhecedor Biométrico', 'Cognitor Corporis', 'logico', 'mestre', 'logico', ['reconhecedor'], 'Identifica características físicas únicas: voz, rosto, toque, assinatura cardíaca. Compara Sensores com padrões gravados.', 'Exige Memória acoplada — sem exceção, nem no Nv1. Não miniaturiza.', 'Pareado a uma Memória', { props: ['1 biometria; 1 pessoa; 90%', '2 simultâneas; 5 pessoas; 97%', '3+; 20 pessoas; 99,5%'] }],
    [32, 'Reconhecedor Arcano', 'Cognitor Arcanis', 'logico', 'mestre', 'logico', ['reconhecedor'], 'Identifica assinaturas mágicas — a impressão digital de essência de cada praticante. Diz QUEM.', 'Exige Memória acoplada. Não miniaturiza.', 'Pareado a uma Memória', { props: ['1 assinatura; 3 m', '5; 10 m; distingue escola', '20; 30 m; + nível aproximado'] }],
    [33, 'Reservatório', 'Receptaculum', 'armazenador', 'iniciante', 'passagem', ['armazenador'], 'Retém Essência em estado latente até liberação. A bateria pequena.', '', 'Após a captação', { cap: [25, 40, 60], props: ['retenção 95%/dia; 10 recargas', '98%; 50 recargas', '99,5%; 200 recargas'] }],
    [34, 'Tanque', 'Cisterna', 'armazenador', 'intermediario', 'passagem', ['armazenador'], 'Reservatório de alta capacidade — mais volume, material melhor para conter a pressão.', 'Risco de ruptura a 100%: 5/2/0,5%.', 'Após a captação', { cap: [40, 75, 125], props: ['retenção 97%/dia', '99%', '99,8%'] }],
    [35, 'Memória', 'Memoria', 'armazenador', 'avancado', 'logico', ['memoria'], 'Não armazena Essência — armazena Padrões (§1.5): biometrias, sequências, limiares, mapas. Obrigatória junto a qualquer Reconhecedor.', 'Padrões não trafegam por Veios comuns.', 'Acoplada aos Reconhecedores', { props: ['1 padrão simples; não reescrevível', '5 padrões moderados; reescrevível (Runomancia 3+)', '20 padrões complexos; reescrevível (Runomancia 2+)'] }],
    [36, 'Âncora Temporal', 'Ancora Temporis', 'armazenador', 'mestre', 'passagem', ['armazenador'], 'Congela o estado exato de um sistema rúnico e o restaura depois. ⟐ Cláusula de Estase: a carga salva sai do presente; restaurar devolve, nunca duplica.', 'Exige Aspectus Temporal no nível equivalente. Não miniaturiza.', 'Após a captação', { cap: [75, 150, 300], props: ['1 estado / 1 restauração; degrada 1%/semana', '1 / 3; 1%/mês', '3 / ilimitadas; 1%/ano'] }],
    [37, 'Foco', 'Focus', 'emissor', 'iniciante', 'fim', ['emissor'], 'Concentra o efeito em um ponto ou direção: feixe ou cone estreito. Precisão.', '', 'Posição final do ramo', { props: ['1 m; ±30 cm; 30°', '5 m; ±10 cm; 15°; giro lento', '15 m; ±1 cm; 5° (laser); redirecionamento instantâneo'] }],
    [38, 'Dispersor', 'Dispersor', 'emissor', 'iniciante', 'fim', ['emissor'], 'Espalha o efeito em área esférica (ou hemisférica sobre superfícies): iluminação, aquecimento, alarmes.', '', 'Posição final do ramo', { props: ['raio 2 m; uniformidade 80%', '5 m; 90%; escolhe hemisfério', '10 m; 100%; cone 90–360°'] }],
    [39, 'Projetor', 'Proiector', 'emissor', 'intermediario', 'fim', ['emissor'], 'Lança o efeito como projétil de Essência — ataque a distância, sinalização, iluminação remota.', '', 'Posição final do ramo', { props: ['5 m; lento; ±1 m', '15 m; rápido; ±30 cm', '40 m; muito rápido (−2 p/ esquivar); ±5 cm; 3 projéteis c/ Bifurcação'] }],
    [40, 'Manifestador', 'Manifestator', 'emissor', 'avancado', 'fim', ['emissor'], 'Cria formas tangíveis de Essência — paredes, escudos, plataformas. Existe enquanto o fluxo alimentar.', '', 'Posição final do ramo', { props: ['0,1 m³ (escudo); dureza madeira; 1 turno sem fluxo', '0,5 m³; pedra; 1 min', '2 m³; metal; 1 cena; formas orgânicas'] }],
    [41, 'Vinculador', 'Vinculator', 'emissor', 'avancado', 'fim', ['emissor'], 'Conecta o efeito a um alvo específico a distância por um fio direto de Essência. Tipo de alvo fixado na gravação.', '', 'Posição final do ramo', { props: ['1 alvo; 5 m; contato prévio; fio brilhante', '1; 15 m; amostra mínima; translúcido', '3; 30 m; visão direta; invisível'] }],
    [42, 'Infusor', 'Infusor', 'emissor', 'avancado', 'fim', ['emissor', 'infusor'], 'Injeta a essência processada diretamente no corpo de quem toca o sigilo — o inverso do Pulso. Afinidade e dose: §4.3–4.4; Protocolo de Valdris: Parte XII.', '⟐ Doses < 5 Ess exigem Infusor Nv2+ ou Atenuador Nv3 a montante (Nv1 é tudo ou nada).', 'Posição final do ramo', { props: ['5 Ess/toque; dose fixa (tudo ou nada)', '15 Ess; dose definida; gradual', '40 Ess; dose exata; múltiplos toques'] }],
    [43, 'Respiro', 'Halitus', 'exaustor', 'iniciante', 'fim', ['exaustor'], 'Dissipa o residual no ambiente como subproduto inofensivo (calor, brilho, vibração). É por ele que a Lei do Rastro opera.', 'Nv1: detecção fácil (+2 ao Alvo); Nv3: difícil (−2).', 'Ramifica de junções', { cap: [5, 10, 20], props: ['dissipa 10 s/Ess; subproduto visível', '5 s/Ess; moderado', '1 s/Ess; quase imperceptível'] }],
    [44, 'Dreno', 'Detrimentum', 'exaustor', 'intermediario', 'fim', ['exaustor'], 'Devolve o residual à fonte de origem ou a uma Ley próxima. Mais discreto que o Respiro — desde que haja receptor. Nv3 recarrega cristais vazios (Lunis Reacesos).', 'Sem receptor: Sobrecarga (Nv3: converte-se em Respiro).', 'Ramifica de junções', { cap: [10, 20, 40], props: ['Ley até 1 m; perda 10%; detecção −3', 'Ley 3 m ou cristal vazio; 5%', 'Ley 5 m/cristal/ambiente; 0%; praticamente indetectável'] }],
    [45, 'Reciclador', 'Recyclator', 'exaustor', 'avancado', 'passagem', ['exaustor'], 'Redireciona o residual de volta a um Armazenador da própria runa, para reuso na próxima ativação.', 'Requer Armazenador. Sinergia com Ciclo (Nv2+; Nv3 +5%).', 'Ramifica de junções → Armazenador', { cap: [5, 15, 30], props: ['perda 20%; 10 ciclos', '10%; 50 ciclos', '3%; 200 ciclos'] }],
];

const ARTUS = [
    ['Criar', 'Volume Criado: Nv1 20 cm³ (chama de vela) · Nv2 1 m³ (barreira pessoal) · Nv3 8 m³ (parede 2×4 m) · Nv4 27 m³ (cúpula 3×3×3) · Nv5 125 m³ (portal dimensional).'],
    ['Destruir', 'Volume Afetado: Nv1 10 cm³ (corroer cadeado) · Nv2 0,5 m³ (porta) · Nv3 4 m³ (parede) · Nv4 20 m³ (cômodo) · Nv5 100 m³ (estrutura inteira).'],
    ['Entender', 'Alcance de Percepção: Nv1 3 m · Nv2 10 m (cômodo) · Nv3 30 m (edifício) · Nv4 100 m (quarteirão) · Nv5 500 m (vila; detecta Leys).'],
    ['Modificar', 'Massa/Volume Alterável: Nv1 5 kg/10 cm³ · Nv2 50 kg/0,5 m³ · Nv3 500 kg/5 m³ · Nv4 2.000 kg/20 m³ · Nv5 10.000 kg/100 m³.'],
    ['Controlar', 'Alcance e Força: Nv1 5 m/10 kg · Nv2 15 m/100 kg · Nv3 30 m/500 kg · Nv4 60 m/2.000 kg · Nv5 150 m/10.000 kg.'],
];
// Sessões de Artus (§11.2): 1→2:4, 2→3:6, 3→4:8, 4→5:12. Nv1 (fundamento inicial): 3.
const ARTUS_SESS = [3, 4, 6, 8, 12];
const ASPECTUS_SESS = [4, 5, 7, 10, 14]; // Nv1 inicial 4; 1→2:5, 2→3:7, 3→4:10, 4→5:14
const NUCLEO_CUSTOS = [5, 10, 20, 40, 80];

const ASPECTUS = [
    ['Fogo', 'Vermelha', 'Consome e expande; a mais fácil de acender, a mais difícil de deter. Nv1 chama ~200 °C · Nv3 fogueira ~800 °C · Nv5 fusão de metal ~1.500 °C.'],
    ['Água', 'Azul-Clara', 'Adapta-se e acumula; paciente, incompressível. Nv1 copo d\'água · Nv3 torrente · Nv5 maremoto localizado.'],
    ['Terra', 'Ocre', 'Sustenta e resiste; lenta para agir, lenta para ceder. Nv1 punhado de areia · Nv3 muro de pedra · Nv5 colapso de terreno.'],
    ['Vento', 'Branco-Acinzentada', 'Move e dispersa; nunca ocupa, sempre atravessa. Nv1 brisa · Nv3 ventania · Nv5 furacão compacto.'],
    ['Luz', 'Amarela / Dourada', 'Revela e alcança; viaja reta. Nv1 brilho de vela · Nv3 holofote/flash · Nv5 sol artificial localizado.'],
    ['Vida', 'Azul', 'Cresce e repara; a única que "quer" algo. Nv1 fechar corte · Nv3 regenerar fratura · Nv5 restaurar membro.'],
    ['Cristal', 'Iridescente', 'Ressoa e amplifica; espelho de outras essências. Nv1 ressonância fraca · Nv3 amplificar ×2 · Nv5 ×5.'],
    ['Temporal', 'Prateada', 'Adia e preserva; raríssima, cobra juros. Nv1 atrasar 0,5 s · Nv3 congelar alvo 3 s · Nv5 acelerar/congelar 30 s+.'],
    ['Espacial', 'Índigo', 'Dobra e conecta; ignora a distância, não a estrutura. Nv1 distorção 10 cm · Nv3 portal pessoal · Nv5 portal permanente.'],
    ['Necrótico', 'Púrpura', 'Desfaz e drena; o avesso da Vida. Nv1 drenar vitalidade leve · Nv3 animar cadáver · Nv5 drenar vida em área.'],
    ['Natureza', 'Verde', 'Enraíza e desperta; nela lingram os Ecos da Alma. Nv1 acelerar broto · Nv3 dominar árvore · Nv5 despertar floresta.'],
    ['Sangue', 'Carmesim-Escura', 'Vincula e cobra; toda gota é um contrato. Nv1 sentir pulsação · Nv3 manipular sangue · Nv5 pacto de sangue.'],
    ['Poder', 'Âmbar-Incandescente', 'Força bruta arcana; não pergunta "como", só "quanto". Nv1 pulso bruto · Nv3 explosão concentrada · Nv5 devastação arcana.'],
    ['Abissal', 'Negra', 'Rasga e sussurra; nenhuma runa a domestica — apenas a aponta. Nv1 sussurro do Abismo · Nv3 invocação menor · Nv5 rasgar véu.'],
];

export function buildSeedDocs() {
    const docs = [];
    SIGILUS.forEach(([ordem, nome, latim, cat, comp, cp, flags, desc, limites, pos, extra]) => {
        docs.push({
            _seedId: 'sig_' + ordem,
            nome, nomeLatim: latim, tipoElemento: 'sigilus', categoria: cat, complexidade: comp,
            maxNivel: 3, descricao: desc, limites, posicaoRegra: pos, flags: flags || [],
            niveis: _lv(CUSTO[cat][comp], SESS[comp], extra),
            pontosConexao: CP[cp] || CP.passagem,
            imagemUrl: '', ordem, publicado: true, cor: ''
        });
    });
    ARTUS.forEach(([nome, desc], i) => {
        docs.push({
            _seedId: 'artus_' + nome.toLowerCase(),
            nome, nomeLatim: '', tipoElemento: 'artus', categoria: '', complexidade: '',
            maxNivel: 5, descricao: 'O verbo da runa. ' + desc,
            limites: 'Nv5 reduz tempo de criação.',
            posicaoRegra: 'Núcleo — após o Aspectus', flags: ['artus', 'nucleo'],
            niveis: NUCLEO_CUSTOS.map((c, n) => ({ nivel: n + 1, custoEss: c, custoExp: c, sessoesEstudo: ARTUS_SESS[n], capacidade: null, taxa: null, propriedades: '' })),
            pontosConexao: CP.passagem, imagemUrl: '', ordem: 100 + i, publicado: true, cor: ''
        });
    });
    ASPECTUS.forEach(([nome, cor, desc], i) => {
        docs.push({
            _seedId: 'asp_' + nome.toLowerCase(),
            nome, nomeLatim: '', tipoElemento: 'aspectus', categoria: '', complexidade: '',
            maxNivel: 5, cor, descricao: 'A natureza da Essência manipulada. ' + desc,
            limites: 'Nv5: comunhão — pode ignorar 1 limitação por cena.',
            posicaoRegra: 'Núcleo — após lógica/condução, antes do Artus', flags: ['aspectus', 'nucleo'],
            niveis: NUCLEO_CUSTOS.map((c, n) => ({ nivel: n + 1, custoEss: c, custoExp: c, sessoesEstudo: ASPECTUS_SESS[n], capacidade: null, taxa: null, propriedades: '' })),
            pontosConexao: CP.passagem, imagemUrl: '', ordem: 200 + i, publicado: true, cor
        });
    });
    return docs;
}

/**
 * Importa o seed do Compêndio para system/data/runicElements.
 * Usa _seedId como ID do documento (idempotente: reimportar sobrescreve).
 */
export async function importRunicSeed(db, { doc, setDoc }, onProgress) {
    const docs = buildSeedDocs();
    let done = 0;
    for (const d of docs) {
        const id = d._seedId; delete d._seedId;
        await setDoc(doc(db, 'system/data/runicElements', id), d);
        done++;
        if (onProgress) onProgress(done, docs.length, d.nome);
    }
    return done;
}
