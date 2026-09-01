/* =====================================================================
   🎵 TRILHA DO CAPÍTULO — a música que começa quando a leitura começa
   ---------------------------------------------------------------------
   O capítulo guarda `musica: { url, nome, loop }`. Quem abre o capítulo
   ganha um controle discreto no topo, e a trilha entra.

   O QUE O NAVEGADOR NÃO DEIXA. Chrome, Safari e Firefox BLOQUEIAM áudio
   que começa sem o leitor ter tocado em nada na página. Isso não é uma
   configuração que dá para contornar — é política de autoplay, e existe
   porque som que começa sozinho é o pior que uma página faz.

   Então o comportamento honesto é:

     · primeira vez na sessão → o controle mostra ▶ e espera um toque;
     · depois desse toque → o navegador libera a origem, e trocar de
       capítulo já emenda a próxima trilha sozinho.

   É por isso que `tentarTocar()` não trata a rejeição como erro: ela é o
   estado normal do primeiro capítulo, e virar um alerta ensinaria o leitor
   a ignorar alertas.

   UM ÁUDIO SÓ NO SITE INTEIRO. O elemento é singleton de propósito: abrir
   o capítulo 3 com o 2 ainda tocando daria duas trilhas sobrepostas, e o
   leitor não teria como saber qual pausar.

   O QUE O LEITOR PODE: pausar e ajustar o volume. Não pode trocar a
   música, não pode buscar no tempo — a trilha é do autor, é parte da
   diagramação. O volume fica porque som alto sem controle é hostil, e
   quem estiver no ônibus precisa de um jeito de baixar sem parar.
   ===================================================================== */

/* Reusa a leitura de link do YouTube do Tabuleiro — a playlist da mesa e a
   trilha do capítulo aceitam as MESMAS formas de link, e duas cópias dessa
   expressão regular divergiriam no dia em que o YouTube inventar mais uma
   forma de URL. */
export { idDoYoutube } from '../tabuleiro/js/tab-musica-calc.js';
import { idDoYoutube } from '../tabuleiro/js/tab-musica-calc.js';

/**
 * A trilha do capítulo, tolerante a doc velho e a campo virado lixo.
 * `tipo` diz como tocar: 'arquivo' (um <audio>) ou 'youtube' (o player
 * embutido — não dá para extrair o áudio do YouTube, e os termos deles não
 * permitem player escondido).
 */
export function musicaDoCapitulo(cap) {
    const m = cap && cap.musica;
    if (!m || typeof m !== 'object') return null;
    const url = String(m.url || '').trim();
    const yt = idDoYoutube(url);
    if (!yt && !/^https?:\/\//i.test(url)) return null;   // só endereço de verdade toca
    return { url, yt, tipo: yt ? 'youtube' : 'arquivo', nome: String(m.nome || '').trim(), loop: m.loop !== false };
}

/* Singleton. `_liberado` lembra que o leitor já tocou em algo NESTA aba:
   depois disso o navegador deixa a próxima trilha começar sozinha. */
let _audio = null, _liberado = false, _caixa = null;

function audio() {
    if (!_audio) {
        _audio = new Audio();
        _audio.preload = 'none';   // capítulo aberto e não lido não baixa MB à toa
    }
    return _audio;
}

function pararArquivo() {
    if (_audio) { _audio.pause(); _audio.removeAttribute('src'); _audio.load(); }
}

/** Corta a trilha. Chamado ao fechar o capítulo, e ao trocar de livro.
 *  Remover a caixa também mata o <iframe> do YouTube — é assim que ele para,
 *  já que o player embutido não obedece a `pause()` de fora. */
export function pararMusica() {
    pararArquivo();
    _caixa?.remove();
    _caixa = null;
}

/**
 * Põe o controle no topo de `host` e tenta tocar.
 * `cap` é o capítulo; sem trilha, remove um controle anterior e sai.
 */
export function montarMusica(host, cap) {
    const m = musicaDoCapitulo(cap);
    const a = audio();
    _caixa?.remove(); _caixa = null;
    if (!host || !m) { if (!m) pararMusica(); return null; }

    const cx = document.createElement('div');
    cx.className = 'tm-musica';
    host.prepend(cx);
    _caixa = cx;

    /* YouTube não dá para tocar como arquivo: não há como extrair o áudio, e
       os termos deles não permitem player escondido. O jeito suportado é
       embutir — então o controle vira uma miniatura, do mesmo jeito que a
       playlist do Tabuleiro faz. O leitor pausa pelo próprio player. */
    if (m.tipo === 'youtube') {
        pararArquivo();
        cx.classList.add('tm-musica--yt');
        cx.innerHTML =
            `<iframe class="tm-musica__yt" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(m.yt)}`
            + `?rel=0&modestbranding=1${m.loop ? `&loop=1&playlist=${encodeURIComponent(m.yt)}` : ''}"`
            + ' title="Trilha do capítulo" frameborder="0" allow="autoplay; encrypted-media"></iframe>'
            + `<span class="tm-musica__nome">${escapar(m.nome || 'Trilha do capítulo')}</span>`;
        return { parar: pararMusica };
    }

    /* Mesma faixa do capítulo anterior: NÃO reinicia. Ler dois capítulos
       seguidos da mesma trilha e ouvir a introdução duas vezes quebra
       justamente a imersão que a trilha existe para criar. */
    const mesma = a.src === m.url && !a.ended;
    if (!mesma) { a.src = m.url; a.currentTime = 0; }
    a.loop = m.loop;

    cx.innerHTML =
        '<button type="button" class="tm-musica__btn" data-play aria-label="Tocar ou pausar a trilha">▶</button>'
        + `<span class="tm-musica__nome">${escapar(m.nome || 'Trilha do capítulo')}</span>`
        + '<input type="range" class="tm-musica__vol" min="0" max="100" step="1" value="70" aria-label="Volume">';

    const btn = cx.querySelector('[data-play]');
    const vol = cx.querySelector('.tm-musica__vol');
    const pintar = () => {
        btn.textContent = a.paused ? '▶' : '⏸';
        cx.classList.toggle('is-tocando', !a.paused);
    };
    a.onplay = pintar; a.onpause = pintar;
    a.volume = Number(vol.value) / 100;
    vol.oninput = () => { a.volume = Number(vol.value) / 100; };
    btn.onclick = () => {
        _liberado = true;
        if (a.paused) a.play().catch(() => {}); else a.pause();
        pintar();
    };

    tentarTocar(a, mesma).finally(pintar);
    return { parar: pararMusica };
}

/**
 * Tenta começar. A rejeição do autoplay NÃO é erro: é o estado esperado do
 * primeiro capítulo da sessão, e o controle já está na tela mostrando ▶.
 */
async function tentarTocar(a, jaTocando) {
    if (jaTocando && !a.paused) return;
    try { await a.play(); _liberado = true; }
    catch { /* o navegador quer um toque antes — o ▶ está ali para isso */ }
}

/** O leitor já destravou o áudio nesta aba? (para a tela poder avisar) */
export const audioLiberado = () => _liberado;

function escapar(s) {
    return String(s ?? '').replace(/[&<>"']/g, c =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
