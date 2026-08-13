/* =====================================================================
   ⚔️ MAPA DE CONFLITO — o que uma classe pode fazer num turno
   ---------------------------------------------------------------------
   A página não tem cadastro próprio: tudo aqui é LEITURA de
   system/data/*. Mexeu no Painel do Criador, mudou aqui — classes e
   módulos entram por onSnapshot (ao vivo); as tabelas de consulta
   (perícias, condições, Defesas) por leitura única.

   A espinha é a economia de ação: o turno tem 2 ações e toda habilidade
   custa 1 Ação Padrão salvo declaração em contrário. O campo
   `valores.acao` de cada habilidade é o que define a faixa.

   Leitura dos campos e templates: conflito-dados.js (com teste).
   Este arquivo é só Firebase, DOM e eventos.
   ===================================================================== */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    getFirestore, collection, getDocs, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { colunaClasse, cardDefesa, esc, norm, perfilDaClasse, mapaSVG, radarSVG, PALETA,
         auditoriaDaClasse, auditoriaSVG, tabelaAuditoria } from './conflito-dados.js?v=4';

const firebaseConfig = {
    apiKey: "AIzaSyA6r79XcsMr3KZUT1YZ8vQntIGspgULXcE",
    authDomain: "rpg-lendasereliquias.firebaseapp.com",
    projectId: "rpg-lendasereliquias",
    storageBucket: "rpg-lendasereliquias.firebasestorage.app",
    messagingSenderId: "546994339773",
    appId: "1:546994339773:web:0116cf7c8667f113075cd4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);

/* ── Estado ───────────────────────────────────────────────────────── */
let classes = [];
let modulos = {};   // id → doc
let mapas = { vds: {}, pericias: {} };
let visao = localStorage.getItem('mc_visao') || 'turno';
/* Quais classes entram no radar. `null` = ainda não escolheram nada, e aí
   valem TODAS — abrir o mapa mostrando o sistema inteiro é o ponto dele. */
let noRadar = null;
try { const g = localStorage.getItem('mc_radar'); if (g) noRadar = new Set(JSON.parse(g)); } catch { /* storage podre, segue com todas */ }

let _comHab = [];   // perfis com repertório de verdade — a lista das fichas
const gravarRadar = () => noRadar
    ? localStorage.setItem('mc_radar', JSON.stringify([...noRadar]))
    : localStorage.removeItem('mc_radar');

/* ── Render ───────────────────────────────────────────────────────── */
function render() {
    const escolhidas = [$('selA').value, $('selB').value]
        .map(id => classes.find(c => c.id === id))
        .filter(Boolean);

    const noMapa = visao === 'mapa', naAudit = visao === 'audit';
    $('colunas').hidden = noMapa || naAudit;
    $('visaoMapa').hidden = !noMapa;
    $('visaoAudit').hidden = !naAudit;
    $('busca').hidden = noMapa || naAudit;   // a busca é da lista, não do gráfico
    for (const [id, qual] of [['vTurno', 'turno'], ['vMapa', 'mapa'], ['vAudit', 'audit']]) {
        $(id).classList.toggle('is-ativa', visao === qual);
        $(id).setAttribute('aria-selected', String(visao === qual));
    }

    if (naAudit) {
        /* Ordena pela pior razão: o que estoura a faixa aparece primeiro, e as
           classes sem medição nenhuma ficam no fim, que é onde incomodam. */
        const aud = classes.map(c => auditoriaDaClasse(c, modulos, mapas))
            .filter(a => a.n)
            .sort((a, b) => (b.foraDaFaixa[0]?.razao || 0) - (a.foraDaFaixa[0]?.razao || 0)
                || b.cobertura - a.cobertura);
        $('grafAudit').innerHTML = auditoriaSVG(aud);
        $('tabAudit').innerHTML = tabelaAuditoria(aud);
        return;
    }

    if (noMapa) {
        /* O mapa mostra TODAS as classes — o que interessa nele é onde ninguém
           está. Os selects só destacam. */
        const perfis = classes.map(c => perfilDaClasse(c, modulos, mapas));
        $('grafMapa').innerHTML = mapaSVG(perfis, escolhidas.map(c => c.id));
        /* Fichas e séries saem do MESMO array: a cor da ficha é a posição da
           classe entre as séries, e classe com módulo mas sem habilidade
           (Runimago) não pode entrar numa lista e sair da outra — isso
           deslocava a cor de todas as classes depois dela. */
        _comHab = perfis.filter(p => p.n);
        const series = _comHab.filter(p => !noRadar || noRadar.has(p.id));
        renderFichas(_comHab, series);
        $('grafRadar').innerHTML = radarSVG(series);
        return;
    }

    $('colunas').innerHTML = escolhidas.length
        ? escolhidas.map(c => colunaClasse(c, modulos, mapas)).join('')
        : '<p class="mc-vazio">Escolha uma classe acima.</p>';
    filtrar();
}

/** Esconde os cards que não batem com a busca, e a faixa que esvaziou. */
function filtrar() {
    const q = norm($('busca').value.trim());
    for (const faixa of document.querySelectorAll('.mc-faixa')) {
        let visiveis = 0;
        for (const card of faixa.querySelectorAll('.mc-card')) {
            const bate = !q || card.dataset.busca.includes(q);
            card.hidden = !bate;
            if (bate) visiveis++;
        }
        faixa.hidden = visiveis === 0;
        faixa.querySelector('.mc-faixa-conta').textContent = visiveis;
    }
}

/* Uma ficha por classe. A cor da ficha marcada é a MESMA da linha dela no
   radar — sem isso, com dez séries ninguém liga legenda a polígono. */
function renderFichas(todos, series) {
    $('fichas').innerHTML = todos.map(p => {
        const i = series.findIndex(s => s.id === p.id);
        const on = i >= 0;
        return `<button class="mc-ficha${on ? ' is-on' : ''}" data-classe="${esc(p.id)}"
            ${on ? `style="--ficha:${PALETA[i % PALETA.length]}"` : ''}
            aria-pressed="${on}" title="${p.n} habilidades">${esc(p.nome)}</button>`;
    }).join('') || '<span class="mc-vazio">Nenhuma classe com repertório.</span>';

    for (const b of $('fichas').querySelectorAll('[data-classe]'))
        b.onclick = () => {
            if (!noRadar) noRadar = new Set(_comHab.map(p => p.id));   // null = todas
            const id = b.dataset.classe;
            noRadar.has(id) ? noRadar.delete(id) : noRadar.add(id);
            gravarRadar(); render();
        };
}

function preencherSelects() {
    const ops = classes.map(c => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('');
    for (const [id, vazio, chave] of [['selA', '— classe —', 'mc_a'], ['selB', '— comparar com… —', 'mc_b']]) {
        const sel = $(id);
        const antes = sel.value || localStorage.getItem(chave) || '';
        sel.innerHTML = `<option value="">${vazio}</option>` + ops;
        if (classes.some(c => c.id === antes)) sel.value = antes;
        sel.onchange = () => { localStorage.setItem(chave, sel.value); render(); };
    }
}

/* ── Carga ────────────────────────────────────────────────────────── */
const lista = async (nome) =>
    (await getDocs(collection(db, 'system/data/' + nome))).docs.map(d => ({ id: d.id, ...d.data() }));

async function iniciar() {
    const [peric, vds] = await Promise.all(['skills', 'derivedValues'].map(lista));
    mapas = {
        vds: Object.fromEntries(vds.map(v => [v.id, v.nome])),
        pericias: Object.fromEntries(peric.map(p => [p.id, p.nome])),
    };

    const defesas = vds.filter(v => v.blocoId === 'defesa').sort((a, b) => (a.ordem || 0) - (b.ordem || 0));
    $('gradeDefesas').innerHTML = defesas.map(cardDefesa).join('')
        || '<p class="mc-vazio">Nenhuma Defesa cadastrada.</p>';

    /* Ao vivo: é o que faz a tela acompanhar o Painel do Criador sozinha. */
    onSnapshot(collection(db, 'system/data/classModules'), snap => {
        modulos = Object.fromEntries(snap.docs.map(d => [d.id, { id: d.id, ...d.data() }]));
        render();
    });
    onSnapshot(collection(db, 'system/data/classes'), snap => {
        classes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
        preencherSelects();
        render();
    });
}

$('busca').addEventListener('input', filtrar);
for (const [id, qual] of [['vTurno', 'turno'], ['vMapa', 'mapa'], ['vAudit', 'audit']])
    $(id).addEventListener('click', () => { visao = qual; localStorage.setItem('mc_visao', qual); render(); });
/* `null` já significa "todas", e sobrevive a uma classe nova entrar no
   Painel do Criador — enumerar os ids de hoje não sobreviveria. */
$('fichasTodas').addEventListener('click', () => { noRadar = null; gravarRadar(); render(); });
$('fichasNenhuma').addEventListener('click', () => { noRadar = new Set(); gravarRadar(); render(); });

/* Firestore só libera system/data para quem está logado (firestore.rules). */
onAuthStateChanged(auth, user => {
    if (!user) { location.href = '../menu/menu.html'; return; }
    iniciar().catch(e => {
        console.error(e);
        $('colunas').innerHTML = '<p class="mc-vazio">Não foi possível carregar os cadastros.</p>';
    });
});
