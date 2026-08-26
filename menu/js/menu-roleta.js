// =============================================
// ROLETA DOS APOIADORES — janela do Portal
//
// O sorteio NÃO acontece aqui. O servidor (`girarRoleta`) decide, debita o
// giro e entrega o prêmio antes de responder; esta tela só encena o que já
// aconteceu, parando a agulha na fatia que veio na resposta. Fechar a aba no
// meio do giro custa a animação, nunca o prêmio.
// =============================================

import { doc, getDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js';
import { toast } from '../../shared/dialogo.js?v=2';
import { fatias, rotacaoFinal, fatiaSobASeta, ANGULO_SETA } from '../../shared/roleta-geometria.js?v=1';
import { curvaGiro } from '../../shared/roleta-curva.js?v=1';

let janela = null;        // <dialog>, criado uma vez
let premios = [];         // o que está desenhado na roda
let listaFatias = [];
let rotacao = 0;          // graus, estado da roda
let girando = false;
let itensDeGiro = [];     // itens da Loja que vendem giros

const CHAVE_SOM = 'lr_roleta_som';
let somLigado = localStorage.getItem(CHAVE_SOM) !== '0';

const menosMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------
// SOM — sem arquivo e sem <audio>: um oscilador curto por fatia que passa.
// O AudioContext nasce dentro do clique em Girar, que já é o gesto do usuário
// que o navegador exige para deixar tocar.
// ---------------------------------------------
let audio = null;

function garantirAudio() {
    if (audio) return audio;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { audio = new AC(); } catch (e) { audio = null; }
    return audio;
}

function tic() {
    if (!somLigado || !audio) return;
    const t = audio.currentTime;
    const osc = audio.createOscillator();
    const vol = audio.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1080, t);
    vol.gain.setValueAtTime(0.0001, t);
    vol.gain.exponentialRampToValueAtTime(0.09, t + 0.004);
    vol.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(vol).connect(audio.destination);
    osc.start(t);
    osc.stop(t + 0.06);
}

/** Acorde curto de vitória, quando a roda para. */
function fanfarra() {
    if (!somLigado || !audio) return;
    [523.25, 659.25, 783.99].forEach((hz, i) => {
        const t = audio.currentTime + i * 0.09;
        const osc = audio.createOscillator();
        const vol = audio.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(hz, t);
        vol.gain.setValueAtTime(0.0001, t);
        vol.gain.exponentialRampToValueAtTime(0.14, t + 0.02);
        vol.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        osc.connect(vol).connect(audio.destination);
        osc.start(t);
        osc.stop(t + 0.55);
    });
}

window.roletaAlternarSom = function () {
    somLigado = !somLigado;
    localStorage.setItem(CHAVE_SOM, somLigado ? '1' : '0');
    const b = document.getElementById('roletaSom');
    if (b) {
        b.textContent = somLigado ? '🔊' : '🔇';
        b.title = somLigado ? 'Som ligado' : 'Som desligado';
    }
};

// ---------------------------------------------
// DESENHO
// As cores saem dos tokens do tema, nunca de hex cravado: assim a roda
// acompanha claro/escuro sozinha, como o selo do Portal faz.
// ---------------------------------------------
function paleta() {
    const css = getComputedStyle(document.documentElement);
    const t = n => css.getPropertyValue(n).trim();
    return {
        fatias: [t('--lr-gold') || '#D4AF37', t('--lr-blood-2') || '#A33',
                 t('--lr-bronze') || '#8a6a2f', t('--lr-arcane') || '#4F46E5'],
        borda: t('--lr-gold-2') || '#f0d060',
        aro: t('--lr-bronze') || '#8a6a2f',
        texto: t('--lr-divine') || '#F6F7FB',
        fundo: t('--lr-surface') || '#151A21',
        seta: t('--lr-gold') || '#D4AF37',
    };
}

/* O DISCO É CACHEADO FORA DA TELA.
   Antes `desenhar()` repintava as ~30 fatias e todos os rótulos a CADA quadro
   do giro — e o giro tem uns quatro segundos de quadros. Mas a roda não muda
   enquanto gira: ela só roda. Então ela é pintada uma vez num canvas
   auxiliar, e cada quadro vira um `rotate` mais um `drawImage`.
   O cache cai quando muda o que ele desenhou: tamanho, tema ou lista de
   prêmios. É a mesma disciplina do Tabuleiro — camada estática é blit. */
let disco = null;          // canvas auxiliar
let discoChave = '';       // o que ele foi pintado para representar

function chaveDoDisco(px) {
    return px + '|' + document.documentElement.className + '|' + listaFatias.length
        + '|' + listaFatias.map(f => f.indice).join(',');
}

function construirDisco(px) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = px;
    const ctx = cv.getContext('2d');
    const c = paleta();
    const raio = px / 2;
    const rad = g => (g * Math.PI) / 180;
    const rDisco = raio - px * 0.045;
    ctx.translate(raio, raio);

    listaFatias.forEach((f, i) => {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, rDisco, rad(f.inicio), rad(f.fim));
        ctx.closePath();
        ctx.fillStyle = c.fatias[i % c.fatias.length];
        ctx.fill();
        // Fatia de 1 grau não comporta contorno: a linha comeria a cor toda.
        if (f.tamanho > 2) {
            ctx.strokeStyle = 'rgba(0,0,0,.28)';
            ctx.lineWidth = Math.max(1, px * 0.002);
            ctx.stroke();
        }

        // Texto só onde cabe — nas fatias de 0,3% ele viraria borrão.
        if (f.tamanho >= 4) {
            const nome = premios[f.indice]?.nome || '';
            ctx.save();
            ctx.rotate(rad(f.meio));
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            const tam = Math.max(8, Math.min(px * 0.030, f.tamanho * px * 0.010));
            ctx.font = `700 ${tam}px system-ui, sans-serif`;
            const max = 26;
            const txt = nome.length > max ? nome.slice(0, max - 1) + '…' : nome;
            // Realce claro por baixo: o mesmo rótulo cai em fatia escura e em
            // fatia clara, e sem ele some numa das duas.
            ctx.fillStyle = 'rgba(255,255,255,.28)';
            ctx.fillText(txt, rDisco - px * 0.025, Math.max(1, px * 0.0015));
            ctx.fillStyle = '#1a1208';
            ctx.fillText(txt, rDisco - px * 0.025, 0);
            ctx.restore();
        }
    });

    /* Volume: um véu radial que escurece só a borda. É o que tira a roda do
       "leque de papel" e a põe de pé — e custa um gradiente por construção,
       não por quadro. */
    const veu = ctx.createRadialGradient(0, 0, rDisco * 0.35, 0, 0, rDisco);
    veu.addColorStop(0, 'rgba(255,255,255,.06)');
    veu.addColorStop(0.62, 'rgba(0,0,0,0)');
    veu.addColorStop(1, 'rgba(0,0,0,.30)');
    ctx.beginPath(); ctx.arc(0, 0, rDisco, 0, Math.PI * 2);
    ctx.fillStyle = veu; ctx.fill();

    /* Aro duplo: bronze por fora, ouro por dentro. Um anel só de uma cor lia
       como contorno de desenho; dois leem como metal. */
    ctx.beginPath(); ctx.arc(0, 0, rDisco, 0, Math.PI * 2);
    ctx.strokeStyle = c.aro; ctx.lineWidth = Math.max(3, px * 0.020); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, rDisco - px * 0.011, 0, Math.PI * 2);
    ctx.strokeStyle = c.borda; ctx.lineWidth = Math.max(1, px * 0.005); ctx.stroke();

    /* Cravos no aro — mas só quando há folga entre eles. Com trinta fatias
       eles encostariam e virariam uma linha pontilhada suja. */
    if (listaFatias.length <= 16) {
        const rc = rDisco - px * 0.004;
        listaFatias.forEach(f => {
            const a = rad(f.inicio);
            ctx.beginPath();
            ctx.arc(Math.cos(a) * rc, Math.sin(a) * rc, Math.max(1.5, px * 0.007), 0, Math.PI * 2);
            ctx.fillStyle = c.borda; ctx.fill();
        });
    }
    return cv;
}

function desenhar() {
    const canvas = document.getElementById('roletaCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const lado = canvas.clientWidth || 300;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = Math.round(lado * dpr);
    if (canvas.width !== px) { canvas.width = px; canvas.height = px; }

    const c = paleta();
    const raio = px / 2;
    const rad = g => (g * Math.PI) / 180;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, px, px);

    if (!listaFatias.length) {
        ctx.translate(raio, raio);
        ctx.fillStyle = c.fundo;
        ctx.beginPath(); ctx.arc(0, 0, raio - 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c.texto;
        ctx.font = `600 ${Math.round(px * 0.045)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('Roleta ainda não configurada', 0, 0);
        return;
    }

    const chave = chaveDoDisco(px);
    if (chave !== discoChave) { disco = construirDisco(px); discoChave = chave; }

    // O disco gira; o miolo e a agulha ficam parados por cima dele.
    ctx.save();
    ctx.translate(raio, raio);
    ctx.rotate(rad(rotacao));
    ctx.drawImage(disco, -raio, -raio);
    ctx.restore();

    ctx.translate(raio, raio);
    const rDisco = raio - px * 0.045;

    // Miolo: anel de ouro com poço escuro, para a agulha ter de onde sair
    ctx.beginPath(); ctx.arc(0, 0, px * 0.082, 0, Math.PI * 2);
    ctx.fillStyle = c.borda; ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, px * 0.066, 0, Math.PI * 2);
    ctx.fillStyle = c.fundo; ctx.fill();
    const brilho = ctx.createRadialGradient(-px * 0.02, -px * 0.02, 1, 0, 0, px * 0.066);
    brilho.addColorStop(0, 'rgba(255,255,255,.16)');
    brilho.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = brilho; ctx.fill();

    /* Agulha no topo, apontando para dentro — é ela que lê o resultado.
       A sombra é o que a levanta do disco em vez de deixá-la colada nele. */
    ctx.save();
    ctx.rotate(rad(ANGULO_SETA));
    ctx.shadowColor = 'rgba(0,0,0,.55)';
    ctx.shadowBlur = Math.max(2, px * 0.012);
    ctx.shadowOffsetX = Math.max(1, px * 0.004);
    ctx.beginPath();
    ctx.moveTo(rDisco - px * 0.012, 0);
    ctx.lineTo(rDisco + px * 0.048, -px * 0.030);
    ctx.lineTo(rDisco + px * 0.048, px * 0.030);
    ctx.closePath();
    ctx.fillStyle = c.seta;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(0,0,0,.45)';
    ctx.lineWidth = Math.max(1, px * 0.003);
    ctx.stroke();
    ctx.restore();
}

// Repinta quando o tema troca — mesmo truque do selo do Portal
new MutationObserver(() => { if (janela?.open) desenhar(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
window.addEventListener('resize', () => { if (janela?.open) desenhar(); });

// ---------------------------------------------
// GIRO
// ---------------------------------------------
/* A curva mora em roleta-curva.js, com teste ao lado: atrito de verdade,
   em vez de um easeOut que despejava o giro no primeiro terco. */

function animarAte(alvo, duracaoMs) {
    return new Promise(resolve => {
        let terminou = false;
        let guarda = 0;
        // Aba escondida: o navegador congela o requestAnimationFrame. Esperar
        // por ele seria esperar para sempre, e o botão ficaria preso em
        // "Girando..." — com o prêmio já entregue. Vai direto ao fim: ninguém
        // está olhando a roda mesmo.
        const terminarSeco = () => {
            if (terminou) return;
            terminou = true;
            clearTimeout(guarda);
            document.removeEventListener('visibilitychange', aoEsconder);
            rotacao = alvo % 360;
            desenhar();
            resolve();
        };
        const aoEsconder = () => { if (document.hidden) terminarSeco(); };

        if (document.hidden) return terminarSeco();
        document.addEventListener('visibilitychange', aoEsconder);

        // Rede de segurança: se por qualquer motivo os quadros não chegarem
        // (aba em segundo plano que o navegador não sinaliza, renderizador
        // engasgado), a promessa TEM de terminar mesmo assim — senão o botão
        // fica preso em "Girando..." com o prêmio já entregue.
        guarda = setTimeout(terminarSeco, duracaoMs * 1.5 + 500);

        const inicio = performance.now();
        const de = rotacao;
        const delta = alvo - de;

        // Bordas em ordem, para saber quando a agulha cruza uma linha e tocar
        const bordas = listaFatias.map(f => f.inicio).sort((a, b) => a - b);
        let ultimaContagem = -1;

        function quadro(agora) {
            if (terminou) return;
            const t = Math.min(1, (agora - inicio) / duracaoMs);
            rotacao = de + delta * curvaGiro(t);
            desenhar();

            // Uma fatia cruzada = um tic. Conta pelo total de bordas já
            // ultrapassadas, então nenhum tic se perde num quadro engasgado.
            const cruzadas = Math.floor((rotacao - de) / 360 * bordas.length);
            if (cruzadas !== ultimaContagem) {
                if (ultimaContagem >= 0 && cruzadas > ultimaContagem) tic();
                ultimaContagem = cruzadas;
            }

            if (t < 1) requestAnimationFrame(quadro);
            else terminarSeco();   // o laço morre aqui
        }
        requestAnimationFrame(quadro);
    });
}

window.girarRoletaAgora = async function () {
    if (girando) return;
    const btn = document.getElementById('roletaBtnGirar');
    const painel = document.getElementById('roletaResultado');
    girando = true;
    if (btn) { btn.disabled = true; btn.textContent = 'Girando...'; }
    if (painel) painel.innerHTML = '';

    garantirAudio();
    if (audio?.state === 'suspended') { try { await audio.resume(); } catch (e) { /* segue mudo */ } }

    let dados;
    try {
        const girar = httpsCallable(window.lrFunctions, 'girarRoleta');
        dados = (await girar({})).data;
    } catch (e) {
        toast('❌ ' + (e.message || 'Não foi possível girar.'), 'danger', 6000);
        girando = false;
        if (btn) { btn.disabled = false; btn.textContent = '🎰 GIRAR'; }
        return;
    }

    // O mestre pode ter salvo a roleta entre o desenho e o clique: sem
    // redesenhar com a lista que o servidor usou, a agulha para na fatia errada.
    if (JSON.stringify(dados.premios) !== JSON.stringify(premios)) {
        premios = dados.premios || [];
        listaFatias = fatias(premios);
        renderLegenda();
    }

    if (typeof window.updateGirosDisplay === 'function') window.updateGirosDisplay(dados.novosGiros);

    const desvio = (Math.random() - 0.5) * 0.7;
    const alvo = rotacaoFinal(listaFatias, dados.indice, 6, desvio);

    if (menosMovimento()) {
        rotacao = alvo % 360;
        desenhar();
    } else {
        await animarAte(alvo, 5200);
    }
    fanfarra();

    if (painel) {
        painel.innerHTML = `
            <div class="roleta-premio">
                ${dados.premio.imagem ? `<img src="${esc(dados.premio.imagem)}" alt="" onerror="this.remove()">` : ''}
                <div>
                    <div class="roleta-premio-nome">${esc(dados.premio.nome)}</div>
                    ${dados.premio.descricao ? `<div class="roleta-premio-desc">${esc(dados.premio.descricao)}</div>` : ''}
                    <div class="roleta-premio-pe">Já está no seu Repertório.${dados.premio.giros > 0
                        ? ` E ainda devolveu ${dados.premio.giros} giro${dados.premio.giros > 1 ? 's' : ''}!` : ''}</div>
                </div>
            </div>`;
    }

    /* A roda ocupa quase toda a coluna, então o cartão do prêmio nasce abaixo
       da dobra do corpo que rola — e o prêmio é justamente o que a pessoa
       acabou de ganhar. Em vez de espremer a roda para os dois caberem juntos
       (o que estragaria a roda em toda tela), o corpo rola até ele. */
    const cartao = painel?.firstElementChild;
    if (cartao?.scrollIntoView) {
        cartao.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    if (typeof window.loadInventory === 'function') { try { await window.loadInventory(); } catch (e) { /* a tela do Repertório se vira */ } }

    girando = false;
    if (btn) {
        btn.disabled = false;
        btn.textContent = '🎰 GIRAR';
    }
    atualizarBotaoGirar(dados.novosGiros);
};

// Bancada: anima até um índice e diz onde a agulha parou de fato. Não concede
// nada — o prêmio vem do servidor —, então não abre brecha nenhuma.
window.__roletaAnimarPara = async function (indice, ms = 350) {
    await animarAte(rotacaoFinal(listaFatias, indice, 2, (Math.random() - 0.5) * 0.7), ms);
    return fatiaSobASeta(listaFatias, rotacao).indice;
};

function atualizarBotaoGirar(saldo) {
    const btn = document.getElementById('roletaBtnGirar');
    if (!btn) return;
    const semGiros = (Number(saldo) || 0) < 1;
    btn.disabled = semGiros || !listaFatias.length;
    btn.title = semGiros ? 'Compre giros para poder girar' : '';
}

// ---------------------------------------------
// JANELA
// ---------------------------------------------
function renderLegenda() {
    const el = document.getElementById('roletaLegenda');
    if (!el) return;
    const total = premios.reduce((s, p) => s + (Number(p.chance) > 0 ? Number(p.chance) : 0), 0);
    el.innerHTML = listaFatias.map((f, i) => {
        const p = premios[f.indice];
        const pct = total > 0 ? (Number(p.chance) / total * 100) : 0;
        return `<li><i style="background:${paleta().fatias[i % 4]}"></i>
            <span>${esc(p.nome)}</span><b>${pct.toFixed(pct < 1 ? 2 : 1)}%</b></li>`;
    }).join('');
}

window.roletaComprarGiros = function (itemId, comFrag) {
    // O checkout é `.modal` com z-index; a roleta é <dialog> em camada de topo.
    // Sem fechar a roleta antes, o checkout abre atrás dela.
    janela?.close();
    if (comFrag) window.openCheckoutFrag(itemId);
    else window.openCheckoutReal(itemId);
};

function renderCompraDeGiros() {
    const el = document.getElementById('roletaCompra');
    if (!el) return;
    if (!itensDeGiro.length) {
        el.innerHTML = '<span class="roleta-vazio">Nenhum item de giro à venda na Loja.</span>';
        return;
    }
    el.innerHTML = itensDeGiro.map(i => {
        const rs = i.valorReal > 0 ? (i.valorReal / 100) : Number(i.valorRs || 0);
        return `
        <div class="roleta-compra-item">
            <span>${esc(i.nome)} <b>+${Number(i.roletaGiros) || 1}</b></span>
            <span class="roleta-compra-bts">
                ${i.valorFrag > 0 ? `<button class="loja-btn loja-btn-frag" onclick="roletaComprarGiros('${esc(i.id)}', true)">💎 ${i.valorFrag}</button>` : ''}
                ${rs > 0 ? `<button class="loja-btn loja-btn-real" onclick="roletaComprarGiros('${esc(i.id)}', false)">🛒 R$ ${rs.toFixed(2).replace('.', ',')}</button>` : ''}
            </span>
        </div>`;
    }).join('');
}

async function carregarDados() {
    // Fresta da bancada (__check-roleta.html): a janela só abre logada, porque
    // `config` exige login nas rules — sem isto não há como conferir o desenho
    // da roda fora do site publicado. Em produção a flag nunca existe.
    if (window.__roletaBancada) {
        premios = window.__roletaBancada.premios || [];
        itensDeGiro = window.__roletaBancada.itensDeGiro || [];
        listaFatias = fatias(premios);
        return;
    }

    const snap = await getDoc(doc(window.db, 'config', 'roleta'));
    premios = (snap.exists() ? snap.data().premios : null) || [];
    listaFatias = fatias(premios);

    const loja = await getDocs(collection(window.db, 'loja_itens'));
    itensDeGiro = [];
    loja.forEach(d => {
        const v = d.data();
        if (v.isRoleta && v.isVendaAtiva !== false) itensDeGiro.push({ id: d.id, ...v });
    });
    itensDeGiro.sort((a, b) => (Number(a.roletaGiros) || 0) - (Number(b.roletaGiros) || 0));
}

function montarJanela() {
    janela = document.createElement('dialog');
    janela.className = 'lr-roleta';
    janela.innerHTML = `
        <div class="roleta-topo">
            <div class="roleta-titulo">🎰 Roleta dos Apoiadores</div>
            <div class="roleta-topo-bts">
                <button id="roletaSom" class="roleta-icone" onclick="roletaAlternarSom()"
                    title="${somLigado ? 'Som ligado' : 'Som desligado'}">${somLigado ? '🔊' : '🔇'}</button>
                <button class="roleta-icone" onclick="this.closest('dialog').close()" aria-label="Fechar">✕</button>
            </div>
        </div>

        <div class="roleta-corpo">
            <div class="roleta-roda">
                <canvas id="roletaCanvas" aria-label="Roleta de prêmios"></canvas>
                <div class="roleta-saldo-linha">
                    Giros: <strong id="roletaSaldo">0</strong>
                </div>
                <button class="btn-modal btn-confirm roleta-girar" id="roletaBtnGirar"
                    onclick="girarRoletaAgora()">🎰 GIRAR</button>
                <div id="roletaResultado"></div>
            </div>

            <div class="roleta-lado">
                <div class="roleta-secao">Comprar giros</div>
                <div id="roletaCompra"></div>
                <div class="roleta-secao">Prêmios e chances</div>
                <ul id="roletaLegenda" class="roleta-legenda"></ul>
            </div>
        </div>`;
    document.body.appendChild(janela);
    // Clique fora fecha, como a janela de leitura do Repertório
    janela.addEventListener('click', e => { if (e.target === janela && !girando) janela.close(); });
    janela.addEventListener('cancel', e => { if (girando) e.preventDefault(); });
}

window.abrirRoleta = async function () {
    if (!window.__roletaBancada && (!window.db || !window.lrFunctions)) {
        toast('Entre na sua conta para girar a roleta.', 'warning');
        return;
    }
    if (!janela) montarJanela();

    try {
        await carregarDados();
    } catch (e) {
        console.error('Erro ao carregar a roleta:', e);
        toast('❌ Não foi possível carregar a roleta.', 'danger');
        return;
    }

    renderLegenda();
    renderCompraDeGiros();

    const badge = document.getElementById('girosBadge');
    const saldo = Number(badge?.textContent) || 0;
    const saldoEl = document.getElementById('roletaSaldo');
    if (saldoEl) saldoEl.textContent = saldo;
    atualizarBotaoGirar(saldo);

    janela.showModal();
    // Direto, sem esperar quadro: ler clientWidth já força o layout, e depender
    // de requestAnimationFrame para a PRIMEIRA pintura deixava a roda em branco
    // em qualquer aba que o navegador não estivesse compondo.
    desenhar();
};
