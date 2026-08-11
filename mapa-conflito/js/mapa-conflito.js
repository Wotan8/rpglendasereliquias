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
import { colunaClasse, cardDefesa, esc, norm } from './conflito-dados.js';

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
let mapas = { pericias: {}, condicoes: {} };

/* ── Render ───────────────────────────────────────────────────────── */
function render() {
    const escolhidas = [$('selA').value, $('selB').value]
        .map(id => classes.find(c => c.id === id))
        .filter(Boolean);
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
    const [peric, conds, vds] = await Promise.all(
        ['skills', 'conditions', 'derivedValues'].map(lista));
    mapas = {
        pericias: Object.fromEntries(peric.map(p => [p.id, p.nome])),
        condicoes: Object.fromEntries(conds.map(c => [c.id, c.nome])),
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

/* Firestore só libera system/data para quem está logado (firestore.rules). */
onAuthStateChanged(auth, user => {
    if (!user) { location.href = '../menu/menu.html'; return; }
    iniciar().catch(e => {
        console.error(e);
        $('colunas').innerHTML = '<p class="mc-vazio">Não foi possível carregar os cadastros.</p>';
    });
});
