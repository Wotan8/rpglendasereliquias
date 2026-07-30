// =============================================
// TABULEIRO — Locais do Worldbuilding como "prefabs"
// O mestre escolhe um Local com mapa tático configurado
// (Worldbuilding → Geografia → 🗺️ Mapa Tático) e ele entra
// no canvas pronto: mapa com escala p/ régua, paredes,
// portas, janelas, luzes e a iluminação ambiente do Local.
// A conversão de coordenadas é pura: shared/local-tatico.js.
// =============================================
import { db, collection, doc, getDoc, getDocs, updateDoc } from '../../painel-mestre/js/firebase-config.js';
import { T, esc, toast, pxDeLarguraReal, camposRevelados } from './tab-state.js';
import { refCanvas, abrirModal, fecharModal } from './tab-main.js';
import { addObj, maxZ, updObj } from './tab-objects.js';
import { screenToWorld, centerCamera } from './tab-render.js';
import { localPronto, resumoDoLocal, objetosDoLocal } from '../../shared/local-tatico.js';

let _locais = null;   // cache da sessão — a lista muda pouco durante o jogo
let _props = null;    // idem, propriedades
const _fichas = new Map();   // geoRef -> doc (cache dos cards já abertos)

async function catalogoGeo() {
    if (!_locais) {
        const snap = await getDocs(collection(db, 'worldbuilding-geography'));
        _locais = [];
        snap.forEach(d => _locais.push({ id: d.id, ...d.data() }));
        _locais.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    }
    return _locais;
}
async function catalogoProp() {
    if (!_props) {
        const snap = await getDocs(collection(db, 'worldbuilding-properties'));
        _props = [];
        snap.forEach(d => _props.push({ id: d.id, ...d.data() }));
        _props.sort((a, b) => (a.nome || a.titulo || '').localeCompare(b.nome || b.titulo || ''));
    }
    return _props;
}

window.tbAbrirLocal = async function () {
    if (T.mode !== 'secret' || !T.isMaster) return;
    abrirModal('📍 Adicionar Local do Worldbuilding', '<div class="tb-muted">⏳ Carregando Locais…</div>');
    try {
        await catalogoGeo();
    } catch (e) {
        console.error(e);
        abrirModal('📍 Adicionar Local', '<div class="tb-muted">❌ Não consegui ler os Locais do Worldbuilding.</div>');
        return;
    }

    const prontos = _locais.filter(l => localPronto(l.mapaTatico));
    const lista = prontos.map(l => `
        <div class="tb-list-row" style="cursor:pointer" onclick="tbAddLocal('${l.id}')">
            ${l.mapaTatico.url ? `<img src="${esc(l.mapaTatico.url)}" style="width:52px;height:38px;object-fit:cover;border-radius:6px;flex-shrink:0">` : ''}
            <div style="flex:1;min-width:0">
                <div><b>${esc(l.nome || 'Sem nome')}</b> <span class="tb-muted">${esc(l.tipo || '')}</span></div>
                <div class="tb-muted" style="font-size:.74rem">${esc(resumoDoLocal(l.mapaTatico))}</div>
            </div>
        </div>`).join('');

    abrirModal('📍 Adicionar Local do Worldbuilding', `
        <div class="tb-list">${lista || '<div class="tb-muted">Nenhum Local com mapa tático ainda.<br>Configure em <b>Worldbuilding → Geografia → 🗺️ Mapa Tático</b>.</div>'}</div>
        <div class="tb-muted" style="margin-top:8px;font-size:.76rem">O Local entra no centro da tela com mapa, paredes, portas, janelas, luzes e a iluminação ambiente configurada.</div>
    `);
};

window.tbAddLocal = async function (geoId) {
    const local = (_locais || []).find(l => l.id === geoId);
    if (!local || !localPronto(local.mapaTatico)) return;
    fecharModal();
    const mt = local.mapaTatico;

    // Largura no mundo: casa a escala real do Local com o grid do canvas
    // (mesma régua: N unidades reais = N/valorPorCelula células).
    const w = pxDeLarguraReal(mt.larguraReal);
    const h = w * (mt.imgH / mt.imgW);
    const centro = screenToWorld({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const destino = { x: centro.x - w / 2, y: centro.y - h / 2, w };

    toast(`⏳ Montando ${local.nome}…`, 'warning');
    try {
        const payloads = objetosDoLocal(mt, destino);
        let z = maxZ();
        for (const p of payloads) {
            // A imagem do mapa fica no fundo; o resto segue a ordem normal.
            await addObj(p.tipo === 'imagem' ? { ...p, z: ++z } : { ...p, z: ++z });
        }
        // Iluminação ambiente do Local. Regra: importar só REFORÇA o fog, nunca
        // enfraquece. Trazer um Local de dia (ou sem luz dinâmica) para um canvas
        // que já tinha fog montado apagava a névoa dos JOGADORES em silêncio — e a
        // tela do mestre continua mostrando fog, então não havia como perceber.
        const luzAtual = T.canvas?.luzDinamica || {};
        const querFog = mt.luzAtiva !== false && mt.ambiente !== 'dia';
        const jaTemFog = !!luzAtual.ativa && luzAtual.modo !== 'dia';
        if (querFog && !jaTemFog) {
            await updateDoc(refCanvas(), { 'luzDinamica.ativa': true, 'luzDinamica.modo': 'noite' });
        }
        centerCamera();
        toast(`📍 ${local.nome} montado — ${payloads.length - 1} elemento(s) de cenário`);
        if (querFog && !jaTemFog) {
            toast('🌙 Luz dinâmica ligada em modo NOITE — jogadores só enxergam onde houver luz', 'warning');
        } else if (!querFog && jaTemFog) {
            toast('ℹ️ O Local é de dia / sem luz dinâmica, mas preservei o fog deste canvas — troque em ⚙️ se quiser', 'warning');
        }
    } catch (e) {
        console.error(e);
        toast('❌ Erro ao montar o Local', 'danger');
    }
};

// =============================================
// 📖 PIN DE GEOGRAFIA/PROPRIEDADE — card de informações
// O alfinete guarda `geoRef` ('geo:<id>' | 'prop:<id>') e `camposPublicos`
// ({campo: true}). No modo secreto o mestre vê tudo que tem conteúdo e
// alterna, campo a campo, o que os jogadores podem ler; o público só
// recebe os campos liberados.
// =============================================
const CAMPOS_GEO = [
    ['imagem', '🖼️ Imagem'], ['tipo', 'Tipo'], ['descricao', 'Descrição'],
    ['clima', 'Clima'], ['populacao', 'População'], ['recursos', 'Recursos'],
    ['governo', 'Governo'], ['landmarks', '🏛️ Pontos de Referência'],
    ['perigos', '⚠️ Perigos'], ['historiaLocal', '📜 História'],
    ['linkedNpcs', '👥 NPCs/Criaturas'], ['linkedTribos', '🏕️ Tribos'],
    ['notas', '🔒 Notas Privadas'],
];
const CAMPOS_PROP = [
    ['imagem', '🖼️ Imagem'], ['tipo', 'Tipo'], ['estado', 'Estado'],
    ['titulo', 'Título'], ['descricao', 'Descrição'], ['localizacao', 'Localização'],
    ['proprietario', 'Proprietário'], ['valor', 'Valor Estimado'], ['tamanho', 'Tamanho'],
    ['comodos', '🚪 Cômodos/Áreas'], ['segredos', '🔮 Segredos'],
    ['linkedNpcsProperty', '👥 NPCs'], ['linkedItems', '📦 Itens'],
    ['notas', '🔒 Notas Privadas'],
];

/** Preenche o select #pin_geo do editor de alfinete (chamado pelo tab-tools). */
window.tbPreencherGeoSelect = async function () {
    const sel = document.getElementById('pin_geo'); if (!sel) return;
    const atual = sel.options[0]?.value || '';
    try {
        const [geos, props] = await Promise.all([catalogoGeo(), catalogoProp()]);
        const opt = (v, nome, tipo) => `<option value="${v}" ${atual === v ? 'selected' : ''}>${esc(nome)}${tipo ? ` · ${esc(tipo)}` : ''}</option>`;
        sel.innerHTML = '<option value="">— nenhum —</option>' +
            `<optgroup label="📍 Geografia">${geos.map(g => opt('geo:' + g.id, g.nome || 'Sem nome', g.tipo)).join('')}</optgroup>` +
            `<optgroup label="🏠 Propriedades">${props.map(p => opt('prop:' + p.id, p.nome || p.titulo || 'Sem nome', p.tipo)).join('')}</optgroup>`;
        if (atual) sel.value = atual;
    } catch (e) { console.error(e); sel.innerHTML = `<option value="${esc(atual)}" selected>❌ erro ao carregar (mantém o atual)</option>`; }
};

/** Um doc por card, com cache — jogador não precisa baixar a coleção inteira. */
async function fichaDe(geoRef) {
    if (_fichas.has(geoRef)) return _fichas.get(geoRef);
    const [tipo, id] = geoRef.split(':');
    const col = tipo === 'prop' ? 'worldbuilding-properties' : 'worldbuilding-geography';
    const s = await getDoc(doc(db, col, id));
    const dados = s.exists() ? { id: s.id, ...s.data() } : null;
    _fichas.set(geoRef, dados);
    return dados;
}

function valorHtml(v) {
    if (Array.isArray(v)) {
        return `<div style="display:flex;flex-wrap:wrap;gap:6px">${v.map(it =>
            `<span class="tb-tag-off" style="font-size:.76rem">${esc(it.name || it.nome || '?')}${(it.title || it.titulo) ? ` — <i>${esc(it.title || it.titulo)}</i>` : ''}</span>`).join('')}</div>`;
    }
    return `<div style="line-height:1.55">${esc(v).replace(/\n/g, '<br>')}</div>`;
}

window.tbAbrirInfoGeo = async function (pinId) {
    const o = T.objects.get(pinId);
    if (!o || !o.geoRef) return;
    const ehProp = o.geoRef.startsWith('prop:');
    abrirModal(ehProp ? '🏠 Propriedade' : '📍 Local', '<div class="tb-muted">⏳ Carregando…</div>');

    let dados = null;
    try { dados = await fichaDe(o.geoRef); }
    catch (e) { console.error(e); abrirModal('📖 Informações', '<div class="tb-muted">❌ Erro ao carregar do Worldbuilding.</div>'); return; }
    if (!dados) { abrirModal('📖 Informações', '<div class="tb-muted">⚠️ A entrada vinculada não existe mais no Worldbuilding.</div>'); return; }

    const mestre = T.mode === 'secret' && T.isMaster;
    const campos = camposRevelados(ehProp ? CAMPOS_PROP : CAMPOS_GEO, dados, o.camposPublicos, mestre);
    const linhas = campos.map(([k, rotulo]) => {
        const pub = !!o.camposPublicos?.[k];
        const olho = mestre
            ? `<button class="tb-mini-btn" title="${pub ? 'Visível aos jogadores — clique para ocultar' : 'Oculto dos jogadores — clique para revelar'}" onclick="tbToggleCampoGeo('${pinId}','${k}')">${pub ? '👁️' : '🚫'}</button>`
            : '';
        const corpo = k === 'imagem'
            ? `<img src="${esc(dados.imagem)}" style="max-width:100%;max-height:200px;border-radius:8px;display:block" onerror="this.style.display='none'">`
            : valorHtml(dados[k]);
        return `<div style="margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:8px;font-weight:700;margin-bottom:4px">${olho}<span>${rotulo}</span></div>
            ${corpo}</div>`;
    }).join('');

    abrirModal(`${ehProp ? '🏠' : '📍'} ${esc(dados.nome || dados.titulo || o.titulo || 'Local')}`, `
        ${mestre ? '<div class="tb-muted" style="font-size:.76rem;margin-bottom:10px">👁️ = os jogadores veem este campo · 🚫 = só você. A escolha vale para este alfinete.</div>' : ''}
        ${linhas || '<div class="tb-muted">O mestre ainda não revelou detalhes deste local.</div>'}
    `);
};

window.tbToggleCampoGeo = function (pinId, campo) {
    const o = T.objects.get(pinId);
    if (!o || !T.isMaster || T.mode !== 'secret') return;
    const camposPublicos = { ...(o.camposPublicos || {}), [campo]: !o.camposPublicos?.[campo] };
    updObj(pinId, { camposPublicos });
    window.tbAbrirInfoGeo(pinId);   // re-render com o novo estado
};
