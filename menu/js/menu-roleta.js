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
import { fatias, rotacaoFinal, fatiaSobASeta, fatiaNoPonto, ANGULO_SETA } from '../../shared/roleta-geometria.js?v=3';
import { curvaGiro } from '../../shared/roleta-curva.js?v=3';

let janela = null;        // <dialog>, criado uma vez
let premios = [];         // o que está desenhado na roda
let listaFatias = [];
let rotacao = 0;          // graus, estado da roda
let girando = false;
let itensDeGiro = [];     // itens da Loja que vendem giros
let descricoes = {};      // itemId -> descrição, só para a janela de espiada
let espiando = null;      // índice do prêmio aberto na espiada, ou null

/* ESTADO DA ENCENAÇÃO — três números que o laço do giro escreve e o desenho lê.
   Ficam fora de `animarAte` porque `desenhar()` é chamado de outros quatro
   lugares (tema, resize, abertura, fim do giro) e nenhum deles sabe nada sobre
   giro: com a roda parada os três valem zero/null e o desenho volta a ser o de
   sempre, sem um `if` espalhado por cada chamada. */
let forcaAtual = 0;       // 0 parada, 1 a toda — comanda rastro, agulha e som
let flickAgulha = 0;      // graus de torção da agulha pelo cravo que acabou de passar
let destaque = null;      // { indice, pulso } da fatia que ganhou

/** Quanto dura um giro, em ms. Igual para todo mundo — ver o comentário em
 *  `girarRoletaAgora` sobre por que o caso calmo não encurta mais. */
const DURACAO_GIRO = 5600;
/* Velocidade, em graus por segundo, a partir da qual o borrão está no máximo.
   `forcaAtual` é medida em graus por segundo DE VERDADE, quadro a quadro, e não
   na curva: assim um giro manso (poucas voltas no mesmo tempo) borra pouco
   sozinho, sem precisar de um segundo caminho no desenho. */
const VELOCIDADE_CHEIA = 900;

const CHAVE_SOM = 'lr_roleta_som';
let somLigado = localStorage.getItem(CHAVE_SOM) !== '0';

const menosMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------
// SOM — sem arquivo e sem <audio>, tudo sintetizado na hora.
// O AudioContext nasce dentro do clique em Girar, que já é o gesto do usuário
// que o navegador exige para deixar tocar.
//
// A primeira versão era onda quadrada pura no cravo e um arpejo maior de
// triângulo no fim: soava a console de oito bits, não a roda de madeira numa
// taverna. Onda pura NÃO faz barulho de impacto — madeira, couro e metal
// batendo são um transiente de RUÍDO filtrado, com um corpo grave por baixo.
// É essa a receita aqui.
// ---------------------------------------------
let audio = null;

function garantirAudio() {
    if (audio) return audio;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { audio = new AC(); } catch (e) { audio = null; }
    return audio;
}

/* Ruído branco, quatro décimos de segundo, gerado UMA vez e reaproveitado por
   todos os estalos do giro. São uns dezoito mil números: refazer isso a cada
   cravo, cento e poucas vezes por segundo, engasgaria a animação junto. */
let ruidoBuf = null;
function ruido() {
    if (ruidoBuf) return ruidoBuf;
    const n = Math.floor(audio.sampleRate * 0.4);
    ruidoBuf = audio.createBuffer(1, n, audio.sampleRate);
    const dados = ruidoBuf.getChannelData(0);
    for (let i = 0; i < n; i++) dados[i] = Math.random() * 2 - 1;
    return ruidoBuf;
}

/* O ESTALO DO CRAVO.
   Duas camadas: o ruído filtrado, que é o estalo, e um corpo grave por baixo,
   que é a madeira ressoando. O que a velocidade muda é o BRILHO, não a
   afinação — cravo nenhum troca de nota porque a roda desacelerou. Roda a toda
   dá um estalo curto e claro; roda morrendo dá um baque escuro e mais demorado,
   e é assim que o ouvido percebe a desaceleração antes do olho. */
function tic(forca = 1) {
    if (!somLigado || !audio) return;
    const f = Math.max(0, Math.min(1, forca));
    const t = audio.currentTime;
    const dur = 0.05 + 0.045 * (1 - f);   // devagar, o baque demora mais a morrer

    const estalo = audio.createBufferSource();
    estalo.buffer = ruido();
    const banda = audio.createBiquadFilter();
    banda.type = 'bandpass';
    banda.Q.value = 1.4;
    // O filtro fecha durante o próprio estalo: é isso que faz um golpe, e não
    // um chiado de meio segundo.
    banda.frequency.setValueAtTime(1250 + 1750 * f, t);
    banda.frequency.exponentialRampToValueAtTime(420 + 380 * f, t + dur);
    const volEstalo = audio.createGain();
    volEstalo.gain.setValueAtTime(0.0001, t);
    volEstalo.gain.exponentialRampToValueAtTime(0.10 + 0.26 * f, t + 0.003);
    volEstalo.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    estalo.connect(banda).connect(volEstalo).connect(audio.destination);
    estalo.start(t);
    estalo.stop(t + dur + 0.02);

    const corpo = audio.createOscillator();
    const volCorpo = audio.createGain();
    corpo.type = 'triangle';
    corpo.frequency.setValueAtTime(190, t);
    corpo.frequency.exponentialRampToValueAtTime(85, t + dur * 0.7);
    volCorpo.gain.setValueAtTime(0.0001, t);
    /* Quanto mais lenta, mais o corpo PESA na mistura — o estalo some e sobra o
       baque. Mas o conjunto fica mais BAIXO, porque cravo batido devagar bate
       mais fraco. Os ganhos brutos enganam: passar ruído por um passa-banda de
       Q 1,4 come quase dois terços da amplitude, então 0,36 aqui sai como 0,12
       de pico. Medido em OfflineAudioContext, não estimado. */
    volCorpo.gain.exponentialRampToValueAtTime(0.06 + 0.06 * (1 - f), t + 0.005);
    volCorpo.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    corpo.connect(volCorpo).connect(audio.destination);
    corpo.start(t);
    corpo.stop(t + dur + 0.02);
}

/* A BADALADA DA PARADA.
   Era um arpejo dó-mi-sol de triângulo — som de fase completa de videogame, e o
   Portal não é isso. Agora são dois sinos, o segundo uma quinta acima.
   Sino não é acorde: as parciais dele são DESAFINADAS entre si (2,00 / 2,98 /
   4,12 / 5,43 do fundamental, em vez de 2 / 3 / 4), cada uma com cauda de
   tamanho diferente. É essa desafinação que separa bronze batido de teclado. */
function badalada(base, atraso, peso) {
    const t = audio.currentTime + 0.03 + atraso;
    [[1.00, 1.00, 2.4], [2.00, 0.52, 1.6], [2.98, 0.34, 1.1],
     [4.12, 0.20, 0.7], [5.43, 0.11, 0.45]].forEach(([mult, forca, cauda]) => {
        const osc = audio.createOscillator();
        const vol = audio.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(base * mult, t);
        vol.gain.setValueAtTime(0.0001, t);
        vol.gain.exponentialRampToValueAtTime(0.12 * forca * peso, t + 0.006);
        vol.gain.exponentialRampToValueAtTime(0.0001, t + cauda);
        osc.connect(vol).connect(audio.destination);
        osc.start(t);
        osc.stop(t + cauda + 0.05);
    });
}

function fanfarra() {
    if (!somLigado || !audio) return;
    badalada(196.00, 0, 1);        // sol grave
    badalada(293.66, 0.20, 0.8);   // ré, uma quinta acima

    /* E um sopro grave por baixo das duas, para a badalada ter chão. Sem ele o
       sino fica pendurado no ar e o momento não pesa nada. */
    const t = audio.currentTime + 0.03;
    const chao = audio.createOscillator();
    const vol = audio.createGain();
    chao.type = 'sine';
    chao.frequency.setValueAtTime(98, t);
    vol.gain.setValueAtTime(0.0001, t);
    vol.gain.exponentialRampToValueAtTime(0.10, t + 0.09);
    vol.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    chao.connect(vol).connect(audio.destination);
    chao.start(t);
    chao.stop(t + 1.85);
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

    const rDisco = raio - px * 0.045;

    // O disco gira; o miolo e a agulha ficam parados por cima dele.
    ctx.save();
    ctx.translate(raio, raio);
    ctx.save();
    ctx.rotate(rad(rotacao));
    ctx.drawImage(disco, -raio, -raio);
    ctx.restore();

    /* RASTRO. Um disco nítido a 1000°/s não parece rápido: parece um desenho
       trocando de ângulo. Falta o borrão que o olho espera de algo girando.
       Como o disco já está cacheado, o borrão sai de graça — quatro cópias
       dele por cima, defasadas de alguns graus e quase transparentes. O
       espalhamento e a opacidade penduram na força do momento, então o rastro
       nasce no arranque, engrossa no pico e some sozinho quando ela morre.
       Nada disso roda com a roda parada: `forcaAtual` é 0 fora do giro. */
    if (forcaAtual > 0.05) {
        const espalho = 6 * forcaAtual;          // graus entre uma cópia e outra
        ctx.globalAlpha = 0.26 * forcaAtual;
        for (let i = 1; i <= 2; i++) {
            for (const lado of [-1, 1]) {
                ctx.save();
                ctx.rotate(rad(rotacao + lado * espalho * i));
                ctx.drawImage(disco, -raio, -raio);
                ctx.restore();
            }
        }
        ctx.globalAlpha = 1;
    }

    /* A FATIA QUE GANHOU. Quando a roda para, o cartão do prêmio nasce lá
       embaixo — e nada na roda dizia ONDE ela parou. Sem isto o olho tem de
       conferir a agulha contra 37 rótulos girados. */
    if (destaque) {
        const f = listaFatias.find(x => x.indice === destaque.indice);
        if (f) {
            const cunha = () => {
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, rDisco, rad(f.inicio), rad(f.fim));
                ctx.closePath();
            };
            ctx.save();
            ctx.rotate(rad(rotacao));

            /* Clarear a fatia sozinha não bastava: numa roda de 37 cores todas
               berrando, mais uma cor clara é só mais uma cor. O que separa é
               apagar as OUTRAS — véu escuro na roda inteira e a vencedora
               recortada de volta ao brilho pleno. Vira holofote. */
            ctx.beginPath();
            ctx.arc(0, 0, rDisco, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(6,8,12,${0.36 + 0.16 * destaque.pulso})`;
            ctx.fill();

            ctx.save();
            cunha();
            ctx.clip();
            ctx.drawImage(disco, -raio, -raio);   // a cor original, sem o véu
            cunha();
            ctx.fillStyle = `rgba(255,246,214,${0.08 + 0.22 * destaque.pulso})`;
            ctx.fill();
            ctx.restore();

            cunha();
            ctx.strokeStyle = `rgba(255,228,130,${0.55 + 0.45 * destaque.pulso})`;
            ctx.lineWidth = Math.max(1.5, px * 0.006);
            ctx.shadowColor = 'rgba(255,215,110,.9)';
            ctx.shadowBlur = px * 0.025 * (0.4 + destaque.pulso);
            ctx.stroke();
            ctx.restore();
        }
    }
    ctx.restore();

    ctx.translate(raio, raio);

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
       A sombra é o que a levanta do disco em vez de deixá-la colada nele.

       E ela BALANÇA: cada cravo que passa por baixo a empurra no sentido da
       roda, e ela volta. O giro inteiro é um disco de cor rodando, sem nada
       parado por perto para o olho medir contra — a agulha tremendo é essa
       referência, e é ela que transforma "a imagem mudou" em "tem uma coisa
       batendo aqui". O pino fica na BASE, lá no aro: girar em torno do centro
       da roda faria a agulha inteira orbitar, que é outro movimento. */
    ctx.save();
    ctx.rotate(rad(ANGULO_SETA));
    if (flickAgulha) {
        const pino = rDisco + px * 0.048;
        ctx.translate(pino, 0);
        ctx.rotate(rad(flickAgulha));
        ctx.translate(-pino, 0);
    }
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

/* MEDIDAS DA RODA EM PIXELS DE TELA.
   `desenhar()` trabalha no buffer, que é a tela vezes o devicePixelRatio. O
   dedo chega em pixels de CSS. Estas três frações são as MESMAS de lá — mudar
   o desenho sem mudar aqui faz o toque cair na fatia errada, que é um erro que
   ninguém vê acontecer, só acredita no resultado. */
const FRACAO_ARO = 0.045;    // quanto do lado sobra entre o disco e a borda
const FRACAO_MIOLO = 0.082;  // raio do eixo, que não é fatia de ninguém

function medidasNaTela(canvas) {
    const caixa = canvas.getBoundingClientRect();
    const lado = caixa.width;
    return { caixa, lado, centro: lado / 2, raio: lado / 2 - lado * FRACAO_ARO, miolo: lado * FRACAO_MIOLO };
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
            // Parada é parada: sem rastro e com a agulha de volta ao prumo.
            forcaAtual = 0;
            flickAgulha = 0;
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
        let rotacaoAnterior = de;
        let instanteAnterior = inicio;

        // Bordas em ordem, para saber quando a agulha cruza uma linha e tocar
        const bordas = listaFatias.map(f => f.inicio).sort((a, b) => a - b);
        let ultimaContagem = -1;

        function quadro(agora) {
            if (terminou) return;
            const t = Math.min(1, (agora - inicio) / duracaoMs);
            rotacao = de + delta * curvaGiro(t);

            /* Quão rápida ela está AGORA, medido entre este quadro e o anterior.
               Vem daqui e não da curva porque borrão é distância percorrida
               DURANTE o quadro: numa tela de 30 Hz, num giro de poucas voltas ou
               num aparelho engasgado a conta muda, e a curva não saberia. */
            const dt = Math.max(1, agora - instanteAnterior);
            forcaAtual = Math.min(1, Math.abs(rotacao - rotacaoAnterior) / dt * 1000 / VELOCIDADE_CHEIA);
            rotacaoAnterior = rotacao;
            instanteAnterior = agora;

            /* Quantos cravos já passaram, com casa decimal. A parte inteira diz
               QUANDO tocar o tic; a fracionária diz QUANTO a agulha ainda está
               torcida pelo último — ela é chutada no instante da passagem e
               volta ao prumo antes do cravo seguinte.
               O expoente 0.35 é o que salva o final: se a torção fosse
               proporcional à força, os últimos cravos — os que importam — a
               moveriam meio pixel. Assim ela ainda bate visivelmente quando a
               roda está andando de fatia em fatia. */
            const passos = (rotacao - de) / 360 * bordas.length;
            const cruzadas = Math.floor(passos);
            const golpe = Math.min(1, Math.pow(forcaAtual, 0.35) * 1.6);
            flickAgulha = 20 * golpe * (0.22 + 0.78 * Math.exp(-6 * (passos - cruzadas)));

            desenhar();

            // Uma fatia cruzada = um tic. Conta pelo total de bordas já
            // ultrapassadas, então nenhum tic se perde num quadro engasgado.
            if (cruzadas !== ultimaContagem) {
                if (ultimaContagem >= 0 && cruzadas > ultimaContagem) tic(forcaAtual);
                ultimaContagem = cruzadas;
            }

            if (t < 1) requestAnimationFrame(quadro);
            else terminarSeco();   // o laço morre aqui
        }
        requestAnimationFrame(quadro);
    });
}

/* ESPIAR UMA FATIA.
   A roda diz a chance de cada prêmio em porcentagem miúda girada de lado; a
   legenda diz em texto, mas ao lado. Ninguém liga uma coisa na outra sem
   apontar o dedo. Tocar a fatia abre o prêmio dela por cima da roda, e o
   holofote que já existia para a vitória marca QUAL fatia é — é a mesma
   pergunta ("esta aqui"), então é o mesmo desenho. */
function abrirEspiada(indice) {
    const cartao = document.getElementById('roletaEspiada');
    const premio = premios[indice];
    if (!cartao || !premio) return;

    const total = premios.reduce((soma, x) => soma + (Number(x.chance) > 0 ? Number(x.chance) : 0), 0);
    const pct = total > 0 ? Number(premio.chance) / total * 100 : 0;
    const desc = descricoes[premio.itemId] || '';
    /* "1 em 21 giros" existe porque 4,7% não diz nada a quase ninguém. É a
       mesma informação, na unidade em que a pessoa vive: giros. */
    const umEm = pct > 0 ? Math.round(100 / pct) : 0;

    espiando = indice;
    destaque = { indice, pulso: 0.55 };
    desenhar();

    cartao.innerHTML = `
        <button class="roleta-espiada-x" onclick="roletaFecharEspiada()" aria-label="Fechar">✕</button>
        ${premio.imagem ? `<img src="${esc(premio.imagem)}" alt="" onerror="this.remove()">` : ''}
        <div class="roleta-espiada-nome">${esc(premio.nome)}</div>
        ${desc ? `<div class="roleta-espiada-desc">${esc(desc)}</div>` : ''}
        <div class="roleta-espiada-chance">
            <b>${pct.toFixed(pct < 1 ? 2 : 1).replace('.', ',')}%</b>
            <span>${umEm > 0 ? `cerca de 1 em ${umEm} giro${umEm > 1 ? 's' : ''}` : 'não sai nesta roda'}</span>
        </div>`;
    cartao.hidden = false;
}

window.roletaFecharEspiada = function () {
    const cartao = document.getElementById('roletaEspiada');
    if (cartao) { cartao.hidden = true; cartao.innerHTML = ''; }
    // Só apaga o holofote se era a espiada que o tinha aceso: fechar a espiada
    // não pode apagar a fatia que a pessoa acabou de ganhar.
    if (espiando !== null) { espiando = null; destaque = null; desenhar(); }
};

/** Toque na legenda — é o mesmo cartão, e é o caminho de quem usa teclado. */
window.roletaEspiar = function (indice) {
    if (girando) return;
    if (espiando === indice) window.roletaFecharEspiada();
    else abrirEspiada(indice);
};

function aoTocarNaRoda(ev) {
    if (girando || !listaFatias.length) return;
    const { caixa, centro, raio, miolo } = medidasNaTela(ev.currentTarget);
    const fatia = fatiaNoPonto(listaFatias, rotacao,
        ev.clientX - caixa.left - centro, ev.clientY - caixa.top - centro, raio, miolo);
    if (!fatia) return window.roletaFecharEspiada();   // aro ou eixo: só fecha
    window.roletaEspiar(fatia.indice);
}

/* Acende a fatia vencedora: três batidas fortes e depois um brilho fixo, que
   fica até o próximo giro. Não é aguardado — o cartão do prêmio não tem por que
   esperar uma luz piscar. */
function acenderFatia(indice, animar) {
    destaque = { indice, pulso: animar ? 1 : 0.5 };
    desenhar();
    if (!animar) return;
    const inicio = performance.now();
    const DURACAO = 1100;
    (function pulso(agora) {
        if (!destaque || destaque.indice !== indice) return;   // outro giro assumiu
        const u = Math.min(1, (agora - inicio) / DURACAO);
        destaque.pulso = 0.35 + 0.65 * Math.abs(Math.cos(Math.PI * 3 * u)) * (1 - u);
        desenhar();
        if (u < 1) requestAnimationFrame(pulso);
    })(inicio);
}

window.girarRoletaAgora = async function () {
    if (girando) return;
    const btn = document.getElementById('roletaBtnGirar');
    const painel = document.getElementById('roletaResultado');
    girando = true;
    if (btn) { btn.disabled = true; btn.textContent = 'Girando...'; }
    if (painel) painel.innerHTML = '';
    window.roletaFecharEspiada();
    destaque = null;   // a fatia acesa é a do giro passado; apaga antes de rodar

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

    /* MENOS MOVIMENTO NÃO É MOVIMENTO NENHUM, E TAMBÉM NÃO É MOVIMENTO CURTO.
       Isto já errou duas vezes. Primeiro quem tinha `prefers-reduced-motion` —
       e no Windows basta ter desligado as animações do sistema — pulava direto
       para a rotação final: a roleta "girava" mostrando só o resultado. Depois
       ganhou um giro de um segundo e meio, que continuou parecendo um resultado
       piscando na tela.

       O TEMPO é a espera, e a espera é a graça da roleta: ele não muda para
       ninguém. O que o caso calmo perde são VOLTAS — duas em vez de cinco a
       sete, então a roda passeia em vez de voar, e o borrão some sozinho porque
       `forcaAtual` mede graus por segundo de verdade. */
    const calmo = menosMovimento();
    const voltas = calmo ? 2 : 5 + Math.floor(Math.random() * 3);
    const desvio = (Math.random() - 0.5) * 0.7;
    const alvo = rotacaoFinal(listaFatias, dados.indice, voltas, desvio);

    await animarAte(alvo, DURACAO_GIRO);
    acenderFatia(dados.indice, !calmo);
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

// Janelinha para a bancada ler a encenação: força, torção da agulha e fatia
// acesa. Só lê — quem escreve esses três é o laço do giro.
window.__roletaEstado = () => ({ forcaAtual, flickAgulha, destaque, rotacao });
// E a mão contrária: posa a roda num instante do giro sem precisar cronometrar
// a animação. É como a bancada fotografa o rastro e o destaque.
// E os sons, que só tocam num giro de verdade: a bancada precisa poder
// dispará-los sem servidor para saber se explodem.
window.__roletaSoar = { garantirAudio, tic, fanfarra };
window.__roletaEspiada = () => ({ espiando, medidas: medidasNaTela(document.getElementById('roletaCanvas')) });
window.__roletaPor = (e = {}) => {
    if (e.rotacao != null) rotacao = e.rotacao;
    if (e.forcaAtual != null) forcaAtual = e.forcaAtual;
    if (e.flickAgulha != null) flickAgulha = e.flickAgulha;
    if ('destaque' in e) destaque = e.destaque;
    desenhar();
};
window.__roletaAcender = acenderFatia;

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
    /* DO MAIS RARO PARA O MAIS COMUM.
       Em ordem de roda a lista era a ordem em que o mestre cadastrou, que não
       diz nada a ninguém. O que a pessoa procura aqui é o prêmio grande — e o
       prêmio grande é justamente o improvável. Ele agora abre a lista, em vez
       de estar enterrado no meio de trinta e sete linhas.
       O quadradinho de cor continua saindo da posição na RODA, não da posição
       na lista: é ele que liga a linha à fatia, e se mudasse com a ordenação
       deixaria de ligar coisa nenhuma. */
    const cor = paleta().fatias;
    const linhas = listaFatias.map((f, naRoda) => ({
        f, cor: cor[naRoda % cor.length], chance: Number(premios[f.indice].chance) || 0,
    })).sort((a, b) => a.chance - b.chance);

    /* Cada linha é um BOTÃO, não um <li> com onclick: a roda só responde a
       ponteiro, e a fatia mais rara é a mais fina de todas. A legenda é o
       caminho de quem usa teclado e o de quem não consegue acertar a fatia. */
    el.innerHTML = linhas.map(({ f, cor, chance }) => {
        const p = premios[f.indice];
        const pct = total > 0 ? (chance / total * 100) : 0;
        return `<li><button type="button" class="roleta-legenda-bt" data-indice="${f.indice}" onclick="roletaEspiar(${f.indice})">
            <i style="background:${cor}"></i>
            <span>${esc(p.nome)}</span><b>${pct.toFixed(pct < 1 ? 2 : 1)}%</b></button></li>`;
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
        descricoes = window.__roletaBancada.descricoes || {};
        listaFatias = fatias(premios);
        return;
    }

    const snap = await getDoc(doc(window.db, 'config', 'roleta'));
    premios = (snap.exists() ? snap.data().premios : null) || [];
    listaFatias = fatias(premios);

    const loja = await getDocs(collection(window.db, 'loja_itens'));
    itensDeGiro = [];
    descricoes = {};
    loja.forEach(d => {
        const v = d.data();
        // `config/roleta` guarda só nome, imagem e chance — a descrição fica no
        // item da Loja. Como a Loja já está sendo lida aqui para achar os itens
        // de giro, colher as descrições de carona não custa uma leitura a mais.
        if (v.descricao) descricoes[d.id] = v.descricao;
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
                <div class="roleta-palco">
                    <canvas id="roletaCanvas" aria-label="Roleta de prêmios — toque numa fatia para ver o prêmio"></canvas>
                    <div id="roletaEspiada" class="roleta-espiada" hidden></div>
                </div>
                <div class="roleta-saldo-linha">
                    Giros: <strong id="roletaSaldo">0</strong>
                </div>
                <div class="roleta-dica">Toque numa fatia para ver o prêmio e a chance.</div>
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
    document.getElementById('roletaCanvas').addEventListener('click', aoTocarNaRoda);

    // Clique fora fecha, como a janela de leitura do Repertório
    janela.addEventListener('click', e => {
        if (e.target === janela && !girando) return janela.close();
        // Clique em qualquer outro lugar da janela desfaz a espiada. A roda e a
        // legenda ficam de fora porque elas TROCAM de fatia, não fecham.
        if (!e.target.closest('#roletaEspiada, #roletaCanvas, .roleta-legenda')) {
            window.roletaFecharEspiada();
        }
    });
    janela.addEventListener('cancel', e => {
        if (girando) return e.preventDefault();
        // Esc com a espiada aberta fecha só a espiada: a pessoa está lendo um
        // prêmio, não pedindo para sair da roleta.
        if (espiando !== null) { e.preventDefault(); window.roletaFecharEspiada(); }
    });
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

    window.roletaFecharEspiada();
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
