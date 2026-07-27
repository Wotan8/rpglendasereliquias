// =============================================
// TABULEIRO — Locais do Worldbuilding como "prefabs"
// O mestre escolhe um Local com mapa tático configurado
// (Worldbuilding → Geografia → 🗺️ Mapa Tático) e ele entra
// no canvas pronto: mapa com escala p/ régua, paredes,
// portas, janelas, luzes e a iluminação ambiente do Local.
// A conversão de coordenadas é pura: shared/local-tatico.js.
// =============================================
import { db, collection, getDocs, updateDoc } from '../../painel-mestre/js/firebase-config.js';
import { T, esc, toast, pxDeLarguraReal } from './tab-state.js';
import { refCanvas, abrirModal, fecharModal } from './tab-main.js';
import { addObj, maxZ } from './tab-objects.js';
import { screenToWorld, centerCamera } from './tab-render.js';
import { localPronto, resumoDoLocal, objetosDoLocal } from '../../shared/local-tatico.js';

let _locais = null;   // cache da sessão — a lista muda pouco durante o jogo

window.tbAbrirLocal = async function () {
    if (T.mode !== 'secret' || !T.isMaster) return;
    abrirModal('📍 Adicionar Local do Worldbuilding', '<div class="tb-muted">⏳ Carregando Locais…</div>');
    try {
        if (!_locais) {
            const snap = await getDocs(collection(db, 'worldbuilding-geography'));
            _locais = [];
            snap.forEach(d => _locais.push({ id: d.id, ...d.data() }));
            _locais.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        }
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
        // Iluminação ambiente do Local vale para o canvas inteiro
        await updateDoc(refCanvas(), {
            'luzDinamica.ativa': mt.luzAtiva !== false,
            'luzDinamica.modo': mt.ambiente === 'dia' ? 'dia' : 'noite',
        });
        centerCamera();
        toast(`📍 ${local.nome} montado — ${payloads.length - 1} elemento(s) de cenário`);
    } catch (e) {
        console.error(e);
        toast('❌ Erro ao montar o Local', 'danger');
    }
};
