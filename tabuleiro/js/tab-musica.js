// =============================================
// TABULEIRO — Playlists de Música (sincronizadas com a mesa)
// Mestre (secreto): barra compacta para tocar/parar várias faixas ao mesmo tempo
// + modal com todas as configurações. Jogadores (público): tocam as mesmas faixas,
// em fase com o mestre, com volume próprio.
//
// Fonte da verdade: mesas/{id}/tabuleiro-meta/musica
//   { playlists: [{id,nome,faixas:[{id,nome,url,volume,loop}]}], ativa, tocando: { faixaId: t0 } }
// `t0` = instante em que a faixa começou → quem chega depois entra no ponto certo.
//
// Dois tipos de faixa, mesma interface interna (`tocador`):
//   · arquivo direto (mp3/ogg)  → <audio>
//   · link do YouTube           → IFrame Player API oficial
// Não dá para extrair o áudio do YouTube: o jeito suportado é embutir o player.
// Ele fica como uma miniatura na barra — os termos do YouTube não permitem um
// player totalmente escondido, e navegador nenhum deixa iframe oculto tocar sozinho.
// =============================================
import { onSnapshot, setDoc } from '../../painel-mestre/js/firebase-config.js';
import { T, esc, uid, toast } from './tab-state.js';
import { refMusica, abrirModal } from './tab-main.js';
import { uploadArquivo } from './tab-objects.js';
import { planoDeReproducao, posicaoInicial, idDoYoutube } from './tab-musica-calc.js';

import { confirmar, perguntar } from '../../shared/dialogo.js?v=2';
let dados = { playlists: [], ativa: null, tocando: {} };
const tocadores = new Map();   // faixaId -> tocador (áudio ou YouTube)
// faixaId -> t0 que falhou. Sem isto, arquivo 404 ou vídeo sem permissão de
// incorporar seria recriado a cada snapshot, num laço de retentativa.
const falhas = new Map();
let barra = null, caixaYT = null, caixaUI = null;
let recolhida = true;   // abre recolhido: o player aberto tapa a barra de ferramentas
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
    // Os players do YouTube ficam FORA da parte que o render() reescreve — recriar
    // o iframe a cada snapshot cortaria a música.
    caixaYT = document.createElement('div'); caixaYT.className = 'tb-mus-yt';
    caixaUI = document.createElement('div');
    barra.append(caixaYT, caixaUI);
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

    // 🔓 Autoplay barrado era o "às vezes não toca": o jogador abria a página com
    // música no ar, o navegador segurava o play e o botão de destravar passava
    // batido. Qualquer gesto na página (que é o que o navegador exige) já
    // destrava e retenta — o botão continua existindo como aviso.
    const destravarPorGesto = () => { if (bloqueado) window.tbMusDestravar(); };
    document.addEventListener('pointerdown', destravarPorGesto, true);
    document.addEventListener('keydown', destravarPorGesto, true);

    render();
}

// ---------- motor de reprodução (segue o doc; vale para mestre e jogador) ----------
function aplicar() {
    const alvo = tocandoAgora();
    const plano = planoDeReproducao(alvo, fid => !!acharFaixa(fid)?.url && falhas.get(fid) !== alvo[fid], [...tocadores.keys()]);
    plano.parar.forEach(pararLocal);
    plano.iniciar.forEach(fid => tocadores.set(fid, criarTocador(fid, acharFaixa(fid), alvo[fid])));
    // troca de arquivo / volume / loop mexidos pelo mestre
    for (const [fid, t] of [...tocadores]) {
        const f = acharFaixa(fid);
        if (!f) continue;
        if (t.url !== f.url) { pararLocal(fid); tocadores.set(fid, criarTocador(fid, f, alvo[fid])); continue; }
        t.setLoop(f.loop !== false);
        t.setVolume(volFaixa(f) * volumeLocal);
    }
    render();
}

function criarTocador(fid, f, t0) {
    const vid = idDoYoutube(f.url);
    return vid ? tocadorYoutube(fid, f, vid, t0) : tocadorAudio(fid, f, t0);
}

function pararLocal(fid) {
    tocadores.get(fid)?.destruir();
    tocadores.delete(fid);
}


/** Faixa que não toca: marca a falha e tira do ar (o mestre tira para a mesa toda). */
function falharFaixa(fid, t0, msg) {
    falhas.set(fid, t0);
    if (ehMestre()) { toast(msg, 'danger'); pararRemoto(fid); }
    else pararLocal(fid);
}

// ---------- arquivo direto (mp3/ogg) ----------
function tocadorAudio(fid, f, t0) {
    const a = new Audio(f.url);
    a.preload = 'auto';
    a.loop = f.loop !== false;
    a.volume = volFaixa(f) * volumeLocal;
    let parando = false;
    // entra em fase com quem já estava tocando
    a.addEventListener('loadedmetadata', () => {
        const pos = posicaoInicial(t0, Date.now(), a.duration, a.loop);
        if (pos !== null) a.currentTime = pos;
    }, { once: true });
    a.addEventListener('error', () => {
        if (parando) return;   // limpar o src ao parar também dispara `error`
        falharFaixa(fid, t0, `❌ Não consegui tocar "${f.nome || 'faixa'}"`);
    });
    a.addEventListener('ended', () => { if (!a.loop && ehMestre()) pararRemoto(fid); });
    const tentar = () => a.play().then(() => { if (bloqueado) { bloqueado = false; render(); } })
                                .catch(() => { bloqueado = true; render(); });
    tentar();
    return {
        url: f.url, youtube: false,
        setVolume: v => { a.volume = v; },
        setLoop: b => { a.loop = b; },
        retomar: tentar,
        destruir: () => { parando = true; a.pause(); a.removeAttribute('src'); a.load(); },
    };
}

// ---------- YouTube (IFrame Player API) ----------
let promessaYT = null;
function carregarYT() {
    if (window.YT?.Player) return Promise.resolve();
    if (promessaYT) return promessaYT;
    promessaYT = new Promise((ok, erro) => {
        const antes = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => { try { antes?.(); } catch (e) {} ok(); };
        const s = document.createElement('script');
        s.src = 'https://www.youtube.com/iframe_api';
        s.onerror = () => { promessaYT = null; erro(new Error('iframe_api')); };
        document.head.appendChild(s);
    });
    return promessaYT;
}

function tocadorYoutube(fid, f, videoId, t0) {
    const box = document.createElement('div');
    box.className = 'tb-mus-ytitem';
    box.title = f.nome || 'YouTube';
    const alvo = document.createElement('div');   // o YT substitui este nó pelo iframe
    box.appendChild(alvo);
    caixaYT.appendChild(box);

    const tocador = {
        url: f.url, youtube: true, p: null, errou: false,
        _vol: volFaixa(f) * volumeLocal,
        _loop: f.loop !== false,
        setVolume(v) { this._vol = v; try { this.p?.setVolume(Math.round(v * 100)); } catch (e) {} },
        setLoop(b) { this._loop = b; try { this.p?.setLoop(b); } catch (e) {} },
        retomar() { try { this.p?.playVideo(); } catch (e) {} },
        destruir() { try { this.p?.destroy(); } catch (e) {} box.remove(); },
    };

    carregarYT().then(() => {
        if (!box.isConnected) return;   // parou antes da API carregar
        tocador.p = new YT.Player(alvo, {
            width: 112, height: 63, videoId,
            playerVars: {
                autoplay: 1, controls: 0, disablekb: 1, fs: 0,
                modestbranding: 1, rel: 0, playsinline: 1, iv_load_policy: 3,
                // loop de vídeo único exige `playlist` com o próprio id
                loop: tocador._loop ? 1 : 0, playlist: tocador._loop ? videoId : undefined,
            },
            events: {
                onReady: (e) => {
                    e.target.setVolume(Math.round(tocador._vol * 100));
                    const pos = posicaoInicial(t0, Date.now(), e.target.getDuration(), tocador._loop);
                    if (pos !== null) e.target.seekTo(pos, true);
                    e.target.playVideo();
                    // o YT não rejeita promessa quando o autoplay é barrado: confere o estado
                    setTimeout(() => {
                        if (tocador.errou || !tocadores.has(fid)) return;   // erro do vídeo ≠ autoplay barrado
                        const st = e.target.getPlayerState?.();
                        if (st !== YT.PlayerState.PLAYING && st !== YT.PlayerState.BUFFERING) { bloqueado = true; render(); }
                        else if (bloqueado) { bloqueado = false; render(); }
                    }, 1500);
                },
                onStateChange: (e) => {
                    if (e.data !== YT.PlayerState.ENDED) return;
                    if (tocador._loop) { e.target.seekTo(0, true); e.target.playVideo(); }
                    else if (ehMestre()) pararRemoto(fid);
                },
                onError: () => {
                    tocador.errou = true;
                    falharFaixa(fid, t0, `❌ O YouTube recusou "${f.nome || 'a faixa'}" — vídeo privado, removido ou que não permite incorporar`);
                },
            },
        });
    }).catch(() => {
        pararLocal(fid);
        if (ehMestre()) toast('❌ Não consegui carregar o player do YouTube', 'danger');
    });

    return tocador;
}

// ---------- comandos do mestre (escrevem no doc; todo mundo obedece) ----------
function tocarRemoto(fid) {
    const f = acharFaixa(fid);
    if (!f?.url) { toast('⚠️ Faixa sem arquivo/URL', 'warning'); return; }
    falhas.delete(fid);   // o mestre mandou de novo: vale tentar de novo
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
// Destravar retoma o que está pausado E retenta o que falhou (faixa que deu erro
// de rede uma vez ficava marcada em `falhas` e este cliente nunca mais a tocava).
window.tbMusDestravar = () => {
    bloqueado = false;
    falhas.clear();
    for (const t of tocadores.values()) t.retomar();
    aplicar();   // recria os tocadores das faixas que falharam (e já re-renderiza)
};

/** Volume da faixa (sincroniza com a mesa). Aplica na hora, grava com folga. */
window.tbMusVolume = (fid, v) => {
    const f = acharFaixa(fid); if (!f) return;
    f.volume = (parseInt(v) || 0) / 100;
    tocadores.get(fid)?.setVolume(volFaixa(f) * volumeLocal);
    clearTimeout(timerVol);
    timerVol = setTimeout(salvar, 600);
};

/** Volume geral DESTE dispositivo (cada jogador regula o seu). */
window.tbMusVolumeLocal = (v) => {
    volumeLocal = Math.max(0, Math.min(1, (parseInt(v) || 0) / 100));
    localStorage.setItem(CHAVE_VOL, Math.round(volumeLocal * 100));
    for (const [fid, t] of tocadores) { const f = acharFaixa(fid); if (f) t.setVolume(volFaixa(f) * volumeLocal); }
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
        caixaUI.innerHTML = `<button class="tb-mus-pill ${ativos ? 'on' : ''}" onclick="tbMusRecolher()" title="Abrir o player">
            🎵${ativos ? `<span class="tb-mus-badge">${ativos}</span>` : ''}</button>`;
        return;
    }

    barra.className = 'tb-musica';
    const faixas = pl?.faixas || [];
    caixaUI.innerHTML = `
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
                    <span class="tb-mus-nome" title="${esc(f.nome || '')}">${idDoYoutube(f.url) ? '<span class="tb-mus-yticon">▶</span>' : ''}${esc(f.nome || 'faixa')}${f.loop === false ? '' : ' <span class="tb-mus-loop">↻</span>'}</span>
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
    if (!nomes.length) { barra.className = 'tb-musica oculta'; caixaUI.innerHTML = ''; return; }

    barra.className = 'tb-musica tb-musica-jogador';
    caixaUI.innerHTML = `
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
                <label>Link do YouTube ou URL do áudio<input type="text" id="mu_url" placeholder="youtube.com/watch?v=... ou https://.../som.mp3"></label>
                <label class="tb-form-full">…ou envie um arquivo<input type="file" id="mu_file" accept="audio/*"></label>
            </div>
            <div class="tb-muted" style="font-size:.74rem;margin-top:6px">
                ▶️ <b>YouTube</b>: cole o link normal. O player oficial fica como uma miniatura na barra (o YouTube não permite esconder) e você só ouve o áudio — vídeo privado ou que proíbe incorporar não toca.<br>
                🎵 <b>Arquivo</b>: mp3/ogg enviado aqui é o mais confiável. Spotify não dá.
            </div>
            <div class="tb-modal-actions"><button class="tb-btn tb-btn-success" onclick="tbMusAddFaixa()">✅ Adicionar</button></div>
        ` : '<div class="tb-muted" style="margin-top:12px">Crie uma playlist para começar.</div>'}
    `);
};

function faixaHtml(f) {
    const on = noAr(f.id);
    return `<div class="tb-list-row tb-mus-edit">
        <button class="tb-mini-btn" onclick="tbMusToggleFaixa('${f.id}');tbMusModal()" title="${on ? 'Parar' : 'Tocar'}">${on ? '⏹' : '▶'}</button>
        <span title="${idDoYoutube(f.url) ? 'YouTube' : 'Arquivo de áudio'}" style="flex:none">${idDoYoutube(f.url) ? '▶️' : '🎵'}</span>
        <input class="tb-input" style="flex:1" value="${esc(f.nome || '')}" onchange="tbMusFaixa('${f.id}','nome',this.value)" placeholder="Nome">
        <label class="tb-check tb-check-sm" title="Repetir"><input type="checkbox" ${f.loop !== false ? 'checked' : ''} onchange="tbMusFaixa('${f.id}','loop',this.checked)"> ↻</label>
        <input type="range" min="0" max="100" value="${Math.round(volFaixa(f) * 100)}" style="width:70px" onchange="tbMusFaixa('${f.id}','volume',this.value/100)" title="Volume da faixa">
        <button class="tb-mini-btn tb-danger" onclick="tbMusRemoverFaixa('${f.id}')" title="Remover">🗑️</button>
    </div>`;
}

window.tbMusNovaPlaylist = async function() {
    const nome = await perguntar('Como se chama a playlist?',
        { titulo: 'Nova playlist', valor: 'Playlist ' + (dados.playlists.length + 1), ok: 'Criar' });
    if (!nome) return;
    const p = { id: uid(), nome: nome.trim(), faixas: [] };
    dados.playlists.push(p);
    dados.ativa = p.id;
    await salvar(); render(); window.tbMusModal();
};
window.tbMusRenomearPlaylist = async function() {
    const p = playlistAtiva(); if (!p) return;
    const nome = await perguntar('Novo nome da playlist:', { titulo: 'Renomear playlist', valor: p.nome });
    if (!nome) return;
    p.nome = nome.trim();
    await salvar(); render(); window.tbMusModal();
};
window.tbMusExcluirPlaylist = async function() {
    const p = playlistAtiva(); if (!p) return;
    if (!await confirmar(`A playlist “${p.nome}” e as faixas dela somem.`,
        { titulo: 'Excluir playlist', ok: 'Excluir', perigo: true })) return;
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
    if (!nome) { const v = idDoYoutube(url); nome = v ? '▶ ' + v : 'Faixa'; }
    p.faixas = [...(p.faixas || []), { id: uid(), nome: nome || 'Faixa', url, volume: 0.7, loop: true }];
    await salvar(); render(); window.tbMusModal();
};
window.tbMusFaixa = async function(fid, campo, valor) {
    const f = acharFaixa(fid); if (!f) return;
    f[campo] = valor;
    const t = tocadores.get(fid);
    if (t) { if (campo === 'volume') t.setVolume(volFaixa(f) * volumeLocal); if (campo === 'loop') t.setLoop(!!valor); }
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
