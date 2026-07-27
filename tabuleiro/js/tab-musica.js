// =============================================
// TABULEIRO — Playlists de Música (sincronizadas com a mesa)
// Mestre (secreto): barra compacta para tocar/parar várias faixas ao mesmo tempo
// + modal com todas as configurações. Jogadores (público): tocam as mesmas faixas,
// em fase com o mestre, com volume próprio.
//
// Fonte da verdade: mesas/{id}/tabuleiro-meta/musica
//   { playlists: [{id,nome,faixas:[{id,nome,url,volume,loop}]}], ativa, tocando: { faixaId: t0 } }
// `t0` = instante em que a faixa começou → quem chega depois entra no ponto certo.
// =============================================
import { onSnapshot, setDoc } from '../../painel-mestre/js/firebase-config.js';
import { T, esc, uid, toast } from './tab-state.js';
import { refMusica, abrirModal } from './tab-main.js';
import { uploadArquivo } from './tab-objects.js';
import { planoDeReproducao, posicaoInicial } from './tab-musica-calc.js';

let dados = { playlists: [], ativa: null, tocando: {} };
const audios = new Map();   // faixaId -> HTMLAudioElement
let barra = null;
let recolhida = false;
let bloqueado = false;      // navegador barrou o autoplay (precisa de um clique)
let volumeLocal = 1;        // por dispositivo — NÃO sincroniza
let timerVol = null;

const ehMestre = () => T.mode === 'secret';
const CHAVE_VOL = 'tbMusicaVolume';

// ---------- helpers ----------
const playlistAtiva = () => dados.playlists.find(p => p.id === dados.ativa) || dados.playlists[0] || null;
const todasFaixas = () => dados.playlists.flatMap(p => p.faixas || []);
const acharFaixa = (fid) => todasFaixas().find(f => f.id === fid) || null;
const volFaixa = (f) => Math.max(0, Math.min(1, f.volume ?? 0.7));
const tocandoAgora = () => dados.tocando || {};
const noAr = (fid) => Object.prototype.hasOwnProperty.call(tocandoAgora(), fid);

function salvar() {
    return setDoc(refMusica(), dados).catch(e => { console.error(e); toast('❌ Erro ao salvar a playlist', 'danger'); });
}

// ---------- boot ----------
export function initMusica() {
    barra = document.createElement('div');
    barra.id = 'tbMusica';
    barra.className = 'tb-musica';
    document.body.appendChild(barra);

    // O mestre costuma deixar a aba pública aberta ao lado da secreta: ali o som
    // começa mudo para não duplicar o que já sai pela aba do mestre.
    const salvo = localStorage.getItem(CHAVE_VOL);
    volumeLocal = salvo !== null ? (parseInt(salvo) || 0) / 100 : (T.isMaster && !ehMestre() ? 0 : 1);

    T.unsubs.push(onSnapshot(refMusica(), s => {
        const d = s.exists() ? s.data() : {};
        dados = {
            playlists: Array.isArray(d.playlists) ? d.playlists : [],
            ativa: d.ativa || null,
            tocando: (d.tocando && typeof d.tocando === 'object') ? d.tocando : {},
        };
        aplicar();
    }, e => console.warn('musica', e)));

    render();
}

// ---------- motor de reprodução (segue o doc; vale para mestre e jogador) ----------
function aplicar() {
    const alvo = tocandoAgora();
    const plano = planoDeReproducao(alvo, fid => !!acharFaixa(fid)?.url, [...audios.keys()]);
    plano.parar.forEach(pararLocal);
    plano.iniciar.forEach(fid => audios.set(fid, criarAudio(fid, acharFaixa(fid), alvo[fid])));
    // troca de arquivo / volume / loop mexidos pelo mestre
    // (compara com a url que pedimos, não com `a.src`: o navegador devolve ela absoluta)
    for (const [fid, a] of [...audios]) {
        const f = acharFaixa(fid);
        if (!f) continue;
        if (a.dataset.url !== f.url) { pararLocal(fid); audios.set(fid, criarAudio(fid, f, alvo[fid])); continue; }
        a.loop = f.loop !== false;
        a.volume = volFaixa(f) * volumeLocal;
    }
    render();
}

function criarAudio(fid, f, t0) {
    const a = new Audio(f.url);
    a.dataset.url = f.url;
    a.preload = 'auto';
    a.loop = f.loop !== false;
    a.volume = volFaixa(f) * volumeLocal;
    // entra em fase com quem já estava tocando
    a.addEventListener('loadedmetadata', () => {
        const pos = posicaoInicial(t0, Date.now(), a.duration, a.loop);
        if (pos !== null) a.currentTime = pos;
    }, { once: true });
    a.addEventListener('error', () => {
        if (a.dataset.parando) return;   // limpar o src ao parar também dispara `error`
        pararLocal(fid);
        if (ehMestre()) toast(`❌ Não consegui tocar "${f.nome || 'faixa'}"`, 'danger');
    });
    a.addEventListener('ended', () => { if (!a.loop && ehMestre()) pararRemoto(fid); });
    tentarTocar(a);
    return a;
}

/** `play()` só é liberado depois de um gesto do usuário — daí o botão "Ativar som". */
function tentarTocar(a) {
    a.play().then(() => { if (bloqueado) { bloqueado = false; render(); } })
            .catch(() => { bloqueado = true; render(); });
}

function pararLocal(fid) {
    const a = audios.get(fid);
    if (a) { a.dataset.parando = '1'; a.pause(); a.removeAttribute('src'); a.load(); }
    audios.delete(fid);
}

// ---------- comandos do mestre (escrevem no doc; todo mundo obedece) ----------
function tocarRemoto(fid) {
    const f = acharFaixa(fid);
    if (!f?.url) { toast('⚠️ Faixa sem arquivo/URL', 'warning'); return; }
    dados.tocando = { ...tocandoAgora(), [fid]: Date.now() };
    aplicar(); salvar();
}
function pararRemoto(fid) {
    const t = { ...tocandoAgora() }; delete t[fid];
    dados.tocando = t;
    aplicar(); salvar();
}

window.tbMusToggleFaixa = (fid) => noAr(fid) ? pararRemoto(fid) : tocarRemoto(fid);
window.tbMusPararTudo = () => { dados.tocando = {}; aplicar(); salvar(); };
window.tbMusRecolher = () => { recolhida = !recolhida; render(); };
window.tbMusPlaylist = (pid) => { dados.ativa = pid; salvar(); render(); };
window.tbMusDestravar = () => { bloqueado = false; for (const a of audios.values()) tentarTocar(a); render(); };

/** Volume da faixa (sincroniza com a mesa). Aplica na hora, grava com folga. */
window.tbMusVolume = (fid, v) => {
    const f = acharFaixa(fid); if (!f) return;
    f.volume = (parseInt(v) || 0) / 100;
    const a = audios.get(fid); if (a) a.volume = volFaixa(f) * volumeLocal;
    clearTimeout(timerVol);
    timerVol = setTimeout(salvar, 600);
};

/** Volume geral DESTE dispositivo (cada jogador regula o seu). */
window.tbMusVolumeLocal = (v) => {
    volumeLocal = Math.max(0, Math.min(1, (parseInt(v) || 0) / 100));
    localStorage.setItem(CHAVE_VOL, Math.round(volumeLocal * 100));
    for (const [fid, a] of audios) { const f = acharFaixa(fid); if (f) a.volume = volFaixa(f) * volumeLocal; }
    const ic = barra?.querySelector('.tb-mus-icvol');
    if (ic) ic.textContent = volumeLocal === 0 ? '🔇' : '🔊';
};

// ---------- barra ----------
function render() {
    if (!barra) return;
    if (!ehMestre()) { renderJogador(); return; }

    const pl = playlistAtiva();
    const ativos = Object.keys(tocandoAgora()).length;

    if (recolhida) {
        barra.className = 'tb-musica recolhida';
        barra.innerHTML = `<button class="tb-mus-pill ${ativos ? 'on' : ''}" onclick="tbMusRecolher()" title="Abrir o player">
            🎵${ativos ? `<span class="tb-mus-badge">${ativos}</span>` : ''}</button>`;
        return;
    }

    barra.className = 'tb-musica';
    const faixas = pl?.faixas || [];
    barra.innerHTML = `
        <div class="tb-mus-head">
            <span title="Playlists da mesa">🎵</span>
            <select class="tb-mus-sel" onchange="tbMusPlaylist(this.value)" title="Playlist ativa">
                ${dados.playlists.length
                    ? dados.playlists.map(p => `<option value="${p.id}" ${p.id === pl?.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')
                    : '<option>— sem playlists —</option>'}
            </select>
            <button class="tb-mini-btn ${ativos ? 'tb-danger' : ''}" onclick="tbMusPararTudo()" title="Parar tudo"${ativos ? '' : ' disabled'}>⏹</button>
            <button class="tb-mini-btn" onclick="tbMusModal()" title="Editar / adicionar músicas">⚙️</button>
            <button class="tb-mini-btn" onclick="tbMusRecolher()" title="Recolher">▾</button>
        </div>
        <div class="tb-mus-lista">
            ${faixas.length ? faixas.map(f => {
                const on = noAr(f.id);
                return `<div class="tb-mus-row ${on ? 'on' : ''}">
                    <button class="tb-mus-play" onclick="tbMusToggleFaixa('${f.id}')" title="${on ? 'Parar para todos' : 'Tocar para todos'}">${on ? '⏹' : '▶'}</button>
                    <span class="tb-mus-nome" title="${esc(f.nome || '')}">${esc(f.nome || 'faixa')}${f.loop === false ? '' : ' <span class="tb-mus-loop">↻</span>'}</span>
                    <input class="tb-mus-vol" type="range" min="0" max="100" value="${Math.round(volFaixa(f) * 100)}"
                        oninput="tbMusVolume('${f.id}',this.value)" title="Volume da faixa (vale para todos)">
                </div>`;
            }).join('')
            : `<div class="tb-mus-vazio">Nenhuma faixa — clique em ⚙️ para adicionar</div>`}
        </div>
        <div class="tb-mus-pe">
            <span class="tb-mus-icvol">${volumeLocal === 0 ? '🔇' : '🔊'}</span>
            <input class="tb-mus-vol" style="flex:1" type="range" min="0" max="100" value="${Math.round(volumeLocal * 100)}"
                oninput="tbMusVolumeLocal(this.value)" title="Volume só deste aparelho">
            ${ativos ? `<span class="tb-mus-sync" title="Tocando para a mesa toda">📡 ${ativos}</span>` : ''}
        </div>
        ${bloqueado ? `<button class="tb-mus-destravar" onclick="tbMusDestravar()">🔇 Clique para ativar o som</button>` : ''}`;
}

/** Jogador: só volume e o aviso de autoplay — aparece apenas quando há música no ar. */
function renderJogador() {
    const nomes = Object.keys(tocandoAgora()).map(fid => acharFaixa(fid)?.nome).filter(Boolean);
    if (!nomes.length) { barra.className = 'tb-musica oculta'; barra.innerHTML = ''; return; }

    barra.className = 'tb-musica tb-musica-jogador';
    barra.innerHTML = `
        <div class="tb-mus-pe">
            <span class="tb-mus-icvol" title="${esc(nomes.join(' · '))}">${volumeLocal === 0 ? '🔇' : '🔊'}</span>
            <input class="tb-mus-vol" style="flex:1" type="range" min="0" max="100" value="${Math.round(volumeLocal * 100)}"
                oninput="tbMusVolumeLocal(this.value)" title="Volume só deste aparelho">
        </div>
        ${bloqueado ? `<button class="tb-mus-destravar" onclick="tbMusDestravar()">🔇 Clique para ativar o som</button>` : ''}`;
}

// ---------- modal de configuração (mestre) ----------
window.tbMusModal = function() {
    if (!ehMestre()) return;
    const pl = playlistAtiva();
    abrirModal('🎵 Playlists de Música', `
        <div class="tb-muted" style="font-size:.78rem;margin-bottom:10px">📡 O que você tocar aqui toca também na tela dos jogadores, no mesmo ponto da música. Cada um regula o volume no próprio aparelho.</div>
        <div class="tb-mus-plrow">
            <label style="flex:1">Playlist
                <select id="mu_pl" class="tb-input" onchange="tbMusPlaylist(this.value);tbMusModal()">
                    ${dados.playlists.length
                        ? dados.playlists.map(p => `<option value="${p.id}" ${p.id === pl?.id ? 'selected' : ''}>${esc(p.nome)} (${(p.faixas||[]).length})</option>`).join('')
                        : '<option>— nenhuma —</option>'}
                </select>
            </label>
            <button class="tb-btn tb-btn-small" onclick="tbMusNovaPlaylist()">➕ Nova</button>
            ${pl ? `<button class="tb-btn tb-btn-small" onclick="tbMusRenomearPlaylist()">✏️</button>
                    <button class="tb-btn tb-btn-small tb-btn-danger" onclick="tbMusExcluirPlaylist()">🗑️</button>` : ''}
        </div>
        ${pl ? `
            <hr class="tb-hr">
            <div class="tb-section-title">🎧 Faixas de “${esc(pl.nome)}”</div>
            <div class="tb-list" id="mu_faixas">${(pl.faixas || []).map(faixaHtml).join('') || '<div class="tb-muted">Nenhuma faixa ainda.</div>'}</div>
            <hr class="tb-hr">
            <div class="tb-section-title">➕ Adicionar faixa</div>
            <div class="tb-form-grid">
                <label>Nome<input type="text" id="mu_nome" placeholder="Ex: Taverna animada"></label>
                <label>URL do áudio (mp3/ogg)<input type="text" id="mu_url" placeholder="https://..."></label>
                <label class="tb-form-full">…ou envie um arquivo<input type="file" id="mu_file" accept="audio/*"></label>
            </div>
            <div class="tb-muted" style="font-size:.74rem;margin-top:6px">Links do YouTube/Spotify não funcionam — precisa ser um arquivo de áudio direto. Prefira enviar o arquivo: URL de outro site pode ser bloqueada no navegador dos jogadores.</div>
            <div class="tb-modal-actions"><button class="tb-btn tb-btn-success" onclick="tbMusAddFaixa()">✅ Adicionar</button></div>
        ` : '<div class="tb-muted" style="margin-top:12px">Crie uma playlist para começar.</div>'}
    `);
};

function faixaHtml(f) {
    const on = noAr(f.id);
    return `<div class="tb-list-row tb-mus-edit">
        <button class="tb-mini-btn" onclick="tbMusToggleFaixa('${f.id}');tbMusModal()" title="${on ? 'Parar' : 'Tocar'}">${on ? '⏹' : '▶'}</button>
        <input class="tb-input" style="flex:1" value="${esc(f.nome || '')}" onchange="tbMusFaixa('${f.id}','nome',this.value)" placeholder="Nome">
        <label class="tb-check tb-check-sm" title="Repetir"><input type="checkbox" ${f.loop !== false ? 'checked' : ''} onchange="tbMusFaixa('${f.id}','loop',this.checked)"> ↻</label>
        <input type="range" min="0" max="100" value="${Math.round(volFaixa(f) * 100)}" style="width:70px" onchange="tbMusFaixa('${f.id}','volume',this.value/100)" title="Volume da faixa">
        <button class="tb-mini-btn tb-danger" onclick="tbMusRemoverFaixa('${f.id}')" title="Remover">🗑️</button>
    </div>`;
}

window.tbMusNovaPlaylist = async function() {
    const nome = prompt('Nome da playlist:', 'Playlist ' + (dados.playlists.length + 1));
    if (!nome) return;
    const p = { id: uid(), nome: nome.trim(), faixas: [] };
    dados.playlists.push(p);
    dados.ativa = p.id;
    await salvar(); render(); window.tbMusModal();
};
window.tbMusRenomearPlaylist = async function() {
    const p = playlistAtiva(); if (!p) return;
    const nome = prompt('Novo nome:', p.nome);
    if (!nome) return;
    p.nome = nome.trim();
    await salvar(); render(); window.tbMusModal();
};
window.tbMusExcluirPlaylist = async function() {
    const p = playlistAtiva(); if (!p) return;
    if (!confirm(`Excluir a playlist “${p.nome}” e suas faixas?`)) return;
    const t = { ...tocandoAgora() };
    (p.faixas || []).forEach(f => delete t[f.id]);
    dados.tocando = t;
    dados.playlists = dados.playlists.filter(x => x.id !== p.id);
    dados.ativa = dados.playlists[0]?.id || null;
    aplicar();
    await salvar(); window.tbMusModal();
};

window.tbMusAddFaixa = async function() {
    const p = playlistAtiva(); if (!p) return;
    const nomeEl = document.getElementById('mu_nome');
    const urlEl = document.getElementById('mu_url');
    const file = document.getElementById('mu_file').files[0];
    let url = urlEl.value.trim();
    let nome = nomeEl.value.trim();
    if (!url && !file) { toast('⚠️ Informe uma URL ou envie um arquivo', 'warning'); return; }
    if (file) {
        toast('⏳ Enviando áudio...', 'warning');
        // ponytail: reusa o bucket `tabuleiro-images/` (já liberado nas storage.rules);
        // se um dia quiser um prefixo próprio, é criar a regra `tabuleiro-audio/` e trocar aqui.
        try { url = await uploadArquivo(file); }
        catch (e) { console.error(e); toast('❌ Falha no upload', 'danger'); return; }
        if (!nome) nome = file.name.replace(/\.[^.]+$/, '');
    }
    p.faixas = [...(p.faixas || []), { id: uid(), nome: nome || 'Faixa', url, volume: 0.7, loop: true }];
    await salvar(); render(); window.tbMusModal();
};
window.tbMusFaixa = async function(fid, campo, valor) {
    const f = acharFaixa(fid); if (!f) return;
    f[campo] = valor;
    const a = audios.get(fid);
    if (a) { if (campo === 'volume') a.volume = volFaixa(f) * volumeLocal; if (campo === 'loop') a.loop = !!valor; }
    await salvar(); render();
};
window.tbMusRemoverFaixa = async function(fid) {
    const p = playlistAtiva(); if (!p) return;
    const t = { ...tocandoAgora() }; delete t[fid];
    dados.tocando = t;
    p.faixas = (p.faixas || []).filter(f => f.id !== fid);
    aplicar();
    await salvar(); window.tbMusModal();
};
