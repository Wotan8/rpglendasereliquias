// =============================================
// TABULEIRO — Janelas de Ficha de Combate (flutuantes, multi-instância)
// Mestre abre uma por NPC; jogador abre a do próprio personagem.
// Abas: ⚔️ Combate (vitais, condições, VDs por bloco, ataques, módulos,
//       atributos, perícias) · 🎒 Inventário (completo, com arrastar-e-soltar)
// Tudo que se edita aqui grava NA FICHA (doc npcs/char/items) — a janela é a
// ficha ao vivo, não uma cópia. Fontes de leitura já existentes e de custo
// zero: T.npcs (snapshot da coleção) e VITAIS/T.chars (listeners por char).
// Único listener novo: os itens do dono, enquanto a janela estiver aberta.
//
// ⚠️ Chaves de VD: a ficha grava `derivedTotals` com a chave DERIVADA DO NOME
// ("Percepção Visual" → PERCEPCAO_VISUAL, ver system-data-loader.js:895); o
// registro carregado aqui (npc-system-data) usa `dv.key || dv.id` — que cai no
// id do doc. Casar os dois é por normChave(dv.nome), nunca por dv.key direto.
// =============================================
import {
    db, doc, setDoc, updateDoc, deleteDoc, addDoc, collection, onSnapshot, getDocs, query, where, writeBatch
} from '../../painel-mestre/js/firebase-config.js';
import {
    T, esc, toast, markDirty, vNum, dvMesa, normChave, patchVitalAtualNpc, valorComponente, dividirPilha
} from './tab-state.js';
import { refCombate } from './tab-main.js';
import { VITAIS, dvsVinculadosChar, dvAplicaChar, espelhosDoVitalNpc } from './tab-hud.js';
// tab-golpes importa ESTE arquivo só dinamicamente, então não fecha ciclo.
import { limparCacheGolpes } from './tab-golpes.js';
import { addObj } from './tab-objects.js';
import { screenToWorld } from './tab-render.js';
import { pontoVisivelAgora } from './tab-fog.js';
import { criarFilaDeEscrita } from './tab-write-queue.js';
import { escolherCondicao } from './tab-combat.js';
import { cenaAtiva, comCenaAtivaPatch } from '../../shared/combate-cenas.js';
import {
    ESTADO_EQUIP, FORMA_EQUIP, qtdDe, ehContainer, itensIdenticos, escolherQtd,
    tplDoItem as tplDoItemMotor, formulaDanoDoItem as formulaDanoMotor, fmtN,
    htmlInventario as htmlInvMotor, tratarClique as tratarCliqueInv, iniciarArrasto, cabeNoConteiner,
    integridadeZerada, integridadeDe, integridadeMax, perdaSobrecarga, perdaFalhaCritica, GATILHO,
} from '../../shared/inventario-motor.js?v=7';

// Mesmo ritmo do painel de combate (ver CUSTOS-FIRESTORE.md): cliques rápidos
// em ± não viram um write por clique.
const THROTTLE = 600;

const WINS = new Map();   // 'npc:id' | 'char:id' -> win
export const _WINS = WINS;   // exposto para __check-ficha-win.html (injeção de itens sem Firestore)

function errWrite(e) { console.warn('ficha-win write', e); toast('❌ Erro ao salvar na ficha', 'danger'); }

// Chaves da fila: 'combate' | '<colecao>/<docId>[#fluxo]' — o #fluxo separa os
// throttles (VIT e ENER do mesmo NPC não podem se atropelar: são campos
// diferentes do mesmo doc, cada um com seu patch).
const fila = criarFilaDeEscrita({
    write: (chave, patch) => {
        if (chave === 'combate') { setDoc(refCombate(), patch, { merge: true }).catch(errWrite); return; }
        const [col, id] = chave.split('#')[0].split('/');
        updateDoc(doc(db, col, id), patch).catch(errWrite);
    },
});

// ===== Registros do sistema (nomes de perícias, VDs, módulos, peculiaridades) =====
// Mesmo cache do modal de NPC do Painel do Mestre (window._npcSys): abrir os
// dois não carrega nada duas vezes. ~10 leituras de coleção, uma vez por sessão.
let _sys = null, _resolveMod = null, _calcNpc = null, _golpes = null;
async function carregarSys() {
    if (_sys) return _sys;
    // O motor de cálculo vem junto: os golpes do NPC saem de calcularNpc — a
    // MESMA conta do modal do Painel do Mestre (?v igual = mesma instância).
    // item-scope-calc é script clássico (só window.*): o import executa e
    // publica computeGolpesDesarmados — a MESMA função da tabela da ficha.
    const [m, eng] = await Promise.all([
        import('../../painel-mestre/js/npc-system-data.js'),
        import('../../painel-mestre/js/npc-calc-engine.js?v=1.10'),
        import('../../ficha-v1.7_1/js/item-scope-calc.js?v=3'),
    ]);
    _resolveMod = m.resolveNpcClassModule;
    _calcNpc = eng.calcularNpc;
    _golpes = window.computeGolpesDesarmados;
    const sys = await m.ensureNpcSystemData();
    // Carga incompleta (`loaded` false) não é memoizada: pinar aqui deixaria a
    // sessão inteira sem os módulos de classe — e portanto sem custo nem mira
    // nas habilidades — até recarregar a página.
    if (sys?.loaded !== false) _sys = sys;
    /* Uma vez por sessão: a janelinha de detalhe passa a valer para todo
       rótulo com `data-det-nome` desta janela. `_sys` vai por função porque
       ele só existe depois desta carga. */
    if (window.LRDetalhe) window.LRDetalhe.ligarDetalhe(document.body, () => _sys);
    return sys;
}

// Índice de VD por TODAS as chaves possíveis (nome normalizado da ficha, key
// do registro, id do doc) + o conjunto de chaves que são Status Vitais.
let _idx = null;
function idx() {
    if (_idx || !_sys) return _idx;
    const porChave = new Map();
    for (const dv of _sys.derivedValues) {
        for (const k of [normChave(dv.nome), dv.key, dv.id]) {
            if (k && !porChave.has(k)) porChave.set(k, dv);
        }
    }
    const vitais = new Set();
    for (const vs of _sys.vitalStats) {
        vitais.add(normChave(vs.nome));
        if (vs.key) vitais.add(vs.key);
    }
    _idx = { porChave, vitais };
    return _idx;
}

/**
 * 🌀 Este NPC é o hóspede em que ALGUM personagem meu está projetado?
 * Enquanto durar, o dono do personagem abre a ficha dele — só para ler.
 */
function projetadoNeste(npcId) {
    const c = cenaAtiva(T.combate);
    const p = (c?.participantes || []).find(x => x.npcId === npcId && x.controladoPor);
    if (!p) return false;
    return T.chars.find(ch => ch.id === p.controladoPor)?.ownerUid === T.user?.uid;
}

// ===== Abertura / fechamento =====
export async function abrirFichaWin(tipo, id) {
    // 🌀 Quem está projetado num hóspede PRECISA ler a ficha dele para jogar
    // com ele — só ler: a janela é a mesma, sem edição. Fora esse caso, a
    // ficha de NPC continua sendo do Mestre no modo secreto.
    if (tipo === 'npc' && !(T.isMaster && T.mode === 'secret') && !projetadoNeste(id)) {
        toast('⚠️ A janela de NPC é do Mestre (modo secreto)', 'warning'); return;
    }
    if (tipo === 'char') {
        const ch = T.chars.find(c => c.id === id);
        if (!ch) { toast('❌ Personagem não encontrado na mesa', 'danger'); return; }
        if (ch.ownerUid !== T.user?.uid && !(T.isMaster && T.mode === 'secret')) {
            toast('⚠️ Só o dono do personagem abre esta janela', 'warning'); return;
        }
    }
    const chave = tipo + ':' + id;
    const aberta = WINS.get(chave);
    if (aberta) { focar(aberta); return; }

    const win = criarJanela(tipo, id, chave);
    WINS.set(chave, win);
    focar(win);
    render(win);

    // Itens do dono, ao vivo enquanto a janela existir (loot entregue no meio
    // do combate aparece sozinho). Solto no fechamento.
    win.unsubItems = onSnapshot(query(collection(db, 'items'), where('characterId', '==', id)), s => {
        win.itens = [];
        s.forEach(d => win.itens.push({ id: d.id, ...d.data() }));
        win.itens.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        // ⚠️ Existem DOIS caches do mesmo inventário: este da janela, que é ao
        // vivo, e o `_itensPorChave` que alimenta o Painel do Turno. Só o de
        // cima recebia as mudanças — a caçadora dropava as flechas, a janela
        // esvaziava e o painel seguia oferecendo munição que não existia mais.
        // O listener manda nos dois.
        invalidarItens(tipo, id);
        render(win);
    }, e => console.warn('itens da janela de ficha', e));

    if (!_sys) carregarSys().then(() => renderTodas()).catch(e => console.warn('registros do sistema', e));
}

function fechar(win) {
    win.ro?.disconnect();
    win.unsubItems?.();
    WINS.delete(win.chave);
    win.el.remove();
}

/** Traz para a frente: reordena o Map e renumera os z (faixa 60–99, abaixo dos modais). */
function focar(win) {
    WINS.delete(win.chave); WINS.set(win.chave, win);
    let z = 60;
    for (const w of WINS.values()) w.el.style.zIndex = z++;
}

// ===== DOM da janela =====
const HTML_JANELA = `
        <div class="tb-fwin-head">
            <span class="tb-fwin-titulo"></span>
            <button class="tb-mini-btn" data-fechar title="Fechar">✕</button>
        </div>
        <div class="tb-fwin-abas">
            <button class="tb-fwin-aba ativa" data-aba="combate">⚔️ Combate</button>
            <button class="tb-fwin-aba" data-aba="inv">🎒 Inventário <span class="tb-fwin-inv-n"></span></button>
        </div>
        <div class="tb-fwin-body"></div>`;

/** Onde a próxima janela nasce: no celular ocupa a tela, no desktop escalona. */
function posicionarNova(el, n) {
    if (window.innerWidth < 700) {
        el.style.left = '3vw'; el.style.top = (64 + n * 26) + 'px';
        el.style.width = '94vw'; el.style.height = '72vh';
        return;
    }
    el.style.left = Math.min(96 + n * 34, window.innerWidth - 420) + 'px';
    el.style.top = Math.min(64 + n * 34, window.innerHeight - 300) + 'px';
}

/**
 * Contexto do motor de inventário compartilhado com a Ficha de NPC do Painel do
 * Mestre (shared/inventario-motor.js): ele desenha e detecta o alvo do arrasto;
 * as escritas continuam aqui, no ritmo e nos docs do Tabuleiro.
 */
function ctxInventario(win) {
    return {
        raiz: win.el,
        get itens() { return win.itens || []; },
        get sys() { return _sys; },
        abertos: win.abertos,
        contAbertos: win.contAbertos,
        idCanvas: 'tbCanvas',
        dica: 'arraste: equipar/desequipar entre seções · contêiner · pilha igual · mapa',
        semQtd: !T.isMaster,   // quantidade de item é coisa do mestre

        // Cache por repinte: a anatomia não muda no meio de uma lista
        rotuloSlot: (k) => {
            if (!_sys) return k;
            win._slots = win._slots || slotsDoCorpo(partesDoCorpo(win));
            return win._slots[k]?.label || k;
        },
        repintar: () => render(win, true),
        acoes: {
            equipar: (iid) => abrirEquipar(win, iid),
            desequipar: (iid) => desequipar(win, iid),
            mover: (iid, alvo) => moverItem(win, iid, alvo),
            fundir: (a, b) => fundirPilhas(win, a, b),
            mapa: (iid, ponto) => droparNoMapa({ win: win.chave, id: iid }, ponto),
            qtd: (iid, d) => setQtd(win, iid, d),
        },
    };
}

/** Arrastar a janela pelo cabeçalho (mesmo padrão da janela de Combate). */
function ligarArrastoDaJanela(el) {
    const head = el.querySelector('.tb-fwin-head');
    let drag = null;
    head.addEventListener('pointerdown', e => {
        if (e.target.closest('button')) return;
        drag = { x: e.clientX, y: e.clientY, l: el.offsetLeft, t: el.offsetTop };
        try { head.setPointerCapture(e.pointerId); } catch (err) { /* evento sintético (__check) não tem pointer ativo */ }
    });
    head.addEventListener('pointermove', e => {
        if (!drag) return;
        el.style.left = Math.max(0, Math.min(drag.l + e.clientX - drag.x, window.innerWidth - 64)) + 'px';
        el.style.top = Math.max(0, Math.min(drag.t + e.clientY - drag.y, window.innerHeight - 48)) + 'px';
    });
    head.addEventListener('pointerup', () => drag = null);
}

/** Um clique na janela: fechar, trocar de aba, mexer em vital/condição, ou inventário. */
function tratarClique(win, e) {
    if (e.target.closest('[data-fechar]')) return fechar(win);
    const aba = e.target.closest('[data-aba]');
    if (aba) { win.aba = aba.dataset.aba; return render(win); }
    const vd = e.target.closest('[data-vdelta]');
    if (vd) return setVital(win, vd.dataset.sig, valorVital(win, vd.dataset.sig).cur + Number(vd.dataset.vdelta));
    if (e.target.closest('[data-condadd]')) return escolherCondicao((cond, tpl) => addCondicao(win, cond, tpl));
    const crm = e.target.closest('[data-condrm]');
    if (crm) return rmCondicao(win, Number(crm.dataset.condrm));
    tratarCliqueInv(win.inv, e);
}

/** Digitação num campo da janela: vital, nível de perícia de NPC ou modificador. */
function tratarInput(win, t) {
    if (t.matches('[data-vcur]')) return setVital(win, t.dataset.sig, parseFloat(String(t.value).replace(',', '.')) || 0);
    if (t.matches('[data-pernivel]')) return setPericiaNpc(win, Number(t.dataset.pernivel), parseInt(t.value) || 0);
    if (t.matches('[data-mod]') && t.type !== 'checkbox') return setCampoMod(win, t);
}

/** Toda a delegação de eventos da janela num lugar só. */
function ligarEventos(win) {
    const el = win.el;
    el.addEventListener('pointerdown', () => { if ([...WINS.values()].at(-1) !== win) focar(win); }, true);
    el.addEventListener('click', e => tratarClique(win, e));
    el.addEventListener('input', e => tratarInput(win, e.target));
    el.addEventListener('change', e => {
        if (e.target.matches('[data-mod]') && e.target.type === 'checkbox') setCampoMod(win, e.target);
    });
    // Digitação segura: o snapshot não re-renderiza com um input focado (senão o
    // foco morre no meio do número); o repinte adiado sai quando o campo solta.
    el.addEventListener('focusout', () => {
        if (win.pendente) { win.pendente = false; render(win); }
    });
    // Arrastar-e-soltar do inventário (item → contêiner / raiz / mapa / pilha)
    el.addEventListener('pointerdown', e => {
        const grab = e.target.closest?.('[data-grab]');
        if (grab) iniciarArrasto(win.inv, grab, e);
    });
}

function criarJanela(tipo, id, chave) {
    const el = document.createElement('div');
    el.className = 'tb-fwin';
    posicionarNova(el, WINS.size);
    el.innerHTML = HTML_JANELA;
    document.body.appendChild(el);

    const win = {
        el, tipo, id, chave, aba: 'combate', itens: null,
        abertos: new Set(),       // itens com o detalhe expandido
        contAbertos: new Set(),   // contêineres abertos
        pendente: false, unsubItems: null,
    };
    win.inv = ctxInventario(win);

    ligarArrastoDaJanela(el);
    ligarEventos(win);

    // Resize nativo da janela não repinta nada — só o compacto precisa ser
    // re-medido (era o furo: estreitar a janela nunca recolhia os nomes).
    win.compactar = () => compactarAtaques(win);   // exposto: o __check chama direto (RO não entrega em aba sem compositor)
    win.ro = new ResizeObserver(win.compactar);
    win.ro.observe(el);

    clampJanela(win);
    return win;
}

// Rotação/resize do navegador não pode deixar janela fora da área visível.
window.addEventListener('resize', () => { for (const w of WINS.values()) clampJanela(w); });

/** Mantém a janela inteira dentro do viewport (abre, arrasta, gira o celular). */
function clampJanela(win) {
    const el = win.el;
    if (!el.isConnected) return;
    if (el.offsetHeight > window.innerHeight - 8) el.style.height = Math.max(220, window.innerHeight - 8) + 'px';
    if (el.offsetWidth > window.innerWidth - 6) el.style.width = Math.max(240, window.innerWidth - 6) + 'px';
    el.style.left = Math.max(0, Math.min(el.offsetLeft, window.innerWidth - el.offsetWidth)) + 'px';
    el.style.top = Math.max(0, Math.min(el.offsetTop, window.innerHeight - Math.min(el.offsetHeight, 48))) + 'px';
}

// ===== Fontes de dados =====
const dadosNpc = (id) => T.npcs.find(x => x.id === id) || null;
const dadosChar = (id) => T.chars.find(c => c.id === id) || null;

const SIGLAS_VITAIS = [
    ['VIT', 'Vitalidade', 'linear-gradient(90deg,#10b981,#34d399)'],
    ['ENER', 'Energia', 'linear-gradient(90deg,#f59e0b,#fbbf24)'],
    ['SAN', 'Sanidade', 'linear-gradient(90deg,#6366f1,#8b5cf6)'],
];
const CAMPO_CHAR = { VIT: ['hp', 'hpMax', 'hpCurrent', 'vit_atual'], ENER: ['ener', 'enerMax', 'enerCurrent', 'ener_atual'], SAN: ['san', 'sanMax', 'sanCurrent', 'san_atual'] };
const CAMPO_PART = { VIT: 'hpCurrent', ENER: 'enerCurrent', SAN: 'sanCurrent' };

/** {cur, max} de um vital, na mesma leitura da janela de Combate. */
function valorVital(win, sig) {
    if (win.tipo === 'npc') {
        const vd = dadosNpc(win.id)?.valoresDer || {};
        const max = Number(vd[sig]) || 0;
        const atual = (vd.atual || {})[sig];
        return { max, cur: (atual !== undefined && atual !== null) ? Math.min(Number(atual), max) : max };
    }
    const v = VITAIS.get(win.id);
    if (!v) return { cur: 0, max: 0 };
    const [c, m] = CAMPO_CHAR[sig];
    return { cur: Number(v[c]) || 0, max: Number(v[m]) || 0 };
}

function condicoesDoc(win) {
    if (win.tipo === 'npc') return dadosNpc(win.id)?.conditions || [];
    return VITAIS.get(win.id)?.condsFull || [];
}

// ===== Edições (auto-save na ficha) =====
function setVital(win, sig, val) {
    const { max } = valorVital(win, sig);
    const v = vNum(Math.max(0, Math.min(val, max)));
    if (win.tipo === 'npc') {
        const n = dadosNpc(win.id); if (!n) return;
        n.valoresDer = n.valoresDer || {};
        n.valoresDer.atual = n.valoresDer.atual || {};
        const patch = patchVitalAtualNpc(n.valoresDer.atual, sig, v, espelhosDoVitalNpc(sig));
        // otimista: o snapshot da coleção confirma depois
        for (const campo of Object.keys(patch)) n.valoresDer.atual[campo.split('.').pop()] = v;
        fila.enviar(`npcs/${win.id}#${sig}`, patch, THROTTLE);
        espelharCombateNpc(win.id, sig, v);
    } else {
        const vit = VITAIS.get(win.id); if (!vit) return;
        const [c, , curDoc, atualDoc] = CAMPO_CHAR[sig];
        vit[c] = v;   // otimista: o listener do char confirma
        fila.enviar(`char/${win.id}#${sig}`, { [curDoc]: v, [`derivedValues.${atualDoc}`]: String(v) }, THROTTLE);
    }
    markDirty();                    // barras do token no canvas
    window._renderCombate?.();      // card na janela de Combate
    render(win);
}

/**
 * O HUD do token e o Painel do Mestre leem o vital do PARTICIPANTE quando o NPC
 * está no combate — sem este espelho, a barra do token ficava velha. Mesma
 * dupla-escrita que o tbCombStat faz no sentido inverso.
 */
function espelharCombateNpc(npcId, sig, v) {
    const cena = cenaAtiva(T.combate);
    const p = (cena.participantes || []).find(x => x.npcId === npcId);
    if (!p) return;
    p[CAMPO_PART[sig]] = v;   // no doc vivo: writes seguintes já saem com ele
    const parts = (cena.participantes || []).map(x => ({ ...x }));
    fila.enviar('combate', { ...comCenaAtivaPatch(T.combate, { participantes: parts }), atualizadoEm: Date.now() }, THROTTLE);
}

async function addCondicao(win, cond, tpl) {
    const lista = [...condicoesDoc(win), {
        nome: String(cond.nome).trim(), icone: cond.icone || tpl?.icone || '☠️',
        descricao: cond.descricao || tpl?.descricao || '',
        tempoAtual: '', tempoRestante: cond.duracao > 0 ? `${cond.duracao} rodada(s)` : (tpl?.duracao || ''),
        modeloId: tpl?.id || null, efeitoMecanicaIds: tpl?.efeitoMecanicaIds || [],
    }];
    try {
        await updateDoc(doc(db, win.tipo === 'npc' ? 'npcs' : 'char', win.id), { conditions: lista });
        toast(`☠️ Condição "${esc(cond.nome)}" aplicada na ficha`);
    } catch (e) { errWrite(e); }
}

async function rmCondicao(win, idx) {
    const lista = condicoesDoc(win).filter((_, i) => i !== idx);
    try { await updateDoc(doc(db, win.tipo === 'npc' ? 'npcs' : 'char', win.id), { conditions: lista }); }
    catch (e) { errWrite(e); }
}

function setQtd(win, itemId, delta) {
    if (!T.isMaster) return;   // botão nem aparece (ctx.semQtd); aqui é a tranca
    const i = (win.itens || []).find(x => x.id === itemId); if (!i) return;
    const q = Math.max(1, (parseInt(i.quantidade) || 1) + delta);
    if (q === (parseInt(i.quantidade) || 1)) return;
    i.quantidade = q;   // otimista: o listener de itens confirma
    fila.enviar(`items/${itemId}`, { quantidade: q }, THROTTLE);
    render(win, true);
}

function setPericiaNpc(win, idx, nivel) {
    const n = dadosNpc(win.id);
    const ps = n?.periciasEstruturadas?.[idx]; if (!ps) return;
    ps.nivel = nivel;
    fila.enviar(`npcs/${win.id}#per`, { periciasEstruturadas: JSON.parse(JSON.stringify(n.periciasEstruturadas)) }, THROTTLE);
}

/** Campo editável de item de Módulo de Classe (contador, progresso, checkbox). */
function setCampoMod(win, input) {
    const { mtipo, mref, mii, mkey } = input.dataset;
    let itens, salvar;
    if (mtipo === 'npc') {
        const nn = dadosNpc(win.id);
        itens = nn?.modulosClasse?.[mref]?.itens;
        salvar = () => fila.enviar(`npcs/${win.id}#mods`, { modulosClasse: JSON.parse(JSON.stringify(nn.modulosClasse)) }, THROTTLE);
    } else {
        const ch = dadosChar(win.id);
        itens = ch?.classModuleData?.[mref];
        // delta: só o módulo tocado, não o mapa inteiro
        salvar = () => fila.enviar(`char/${win.id}#mod-${mref}`, { ['classModuleData.' + mref]: JSON.parse(JSON.stringify(itens)) }, THROTTLE);
    }
    const item = itens?.[mii]; if (!item) return;
    if (input.type === 'checkbox') item[mkey] = input.checked;
    else if (input.dataset.mtxt) item[mkey] = input.value;               // progresso guarda texto, como na ficha
    else item[mkey] = input.value === '' ? '' : (parseFloat(input.value) || 0);
    salvar();
}

// ===== Mover / dropar itens =====
// Mesmo recorte do tab-mostrar: o item embutido no loot não leva ids nem estado de equipe.
const semId = ({ id, parentItemId, characterId, equipado, ...campos }) => campos;

// ===== Equipar / desequipar (arrasto entre as seções) =====

/** Partes do corpo do dono: NPC = da ficha; personagem = da RAÇA (registro);
 *  fallback: anatomia padrão do sistema (ehPadrao) — mesma ordem da ficha. */
function partesDoCorpo(win) {
    let partes = [];
    if (win.tipo === 'npc') {
        // Cópia congelada na ficha do NPC + o CADASTRO por cima (regra da
        // ficha do jogador: o catálogo manda em golpe/dado/tipos/vínculos;
        // a cópia responde por slots e pelo que o catálogo não tiver).
        partes = (dadosNpc(win.id)?.partesDoCorpo || []).map(bp => {
            const cat = (_sys?.bodyParts || []).find(b => b.id === bp.id);
            return cat ? { ...bp, podeGolpear: !!cat.podeGolpear, formulaDano: cat.formulaDano,
                tipoGolpe: cat.tipoGolpe, valoresDerivadosVinculados: cat.valoresDerivadosVinculados,
                // como o golpe: quem decide como a peça prende no corpo é o cadastro
                podeSegurar: !!cat.podeSegurar, podeEmpunhar: !!cat.podeEmpunhar,
                podeVestir: !!cat.podeVestir, podeFixar: !!cat.podeFixar } : bp;
        });
    } else {
        const ch = dadosChar(win.id);
        const raca = ch?.raca ? _sys.racesByNome?.[_sys.norm(ch.raca)] : null;
        partes = (raca?.partesDoCorpo || []).map(ref => {
            const bp = (_sys.bodyParts || []).find(b => b.id === ref.id);
            return bp ? { ...bp, slots: ref.slots || 1 } : null;
        }).filter(Boolean);
    }
    if (!partes.length) partes = (_sys.bodyParts || []).filter(b => b.ehPadrao).map(b => ({ ...b, slots: b.slots || 1 }));
    return partes;
}

/** slotKey → {label, icon, partId}; parte com N slots vira `${id}_1..N` (padrão da ficha). */
function slotsDoCorpo(partes) {
    const slots = {};
    for (const bp of partes) {
        const qtd = Math.max(1, parseInt(bp.slots) || 1);
        for (let i = 0; i < qtd; i++) {
            const k = qtd > 1 ? `${bp.id}_${i + 1}` : bp.id;
            // `parte`/`podeGolpear` são o que computeGolpesDesarmados espera:
            // o nome da parte funde "Mão 1"/"Mão 2" numa linha ×2 de golpe.
            slots[k] = { label: qtd > 1 ? `${bp.nome} ${i + 1}` : bp.nome, icon: bp.icone || '🦴',
                partId: bp.id, parte: bp.nome, podeGolpear: !!bp.podeGolpear,
                formulaDano: bp.formulaDano || '', tiposGolpe: bp.tipoGolpe || null };
        }
    }
    return slots;
}

/** Picker de equipar — mesmas opções da ficha: slot anatômico + estado,
 *  desabilitando ocupado/não permitido; slots extras via EquipSlots. */
/** Slots do corpo, com os já tomados e os que a peça não aceita desabilitados. */
function optsSlotEquipar(item, slots, itens, itemId) {
    const ES = window.EquipSlots;
    const ocupados = new Set(itens.filter(i => i.equipado && i.id !== itemId)
        .flatMap(i => ES ? ES.slotsDoItem(i) : [i.slotAnatomico]).filter(Boolean));
    const permitidas = Array.isArray(item.equipavelEm) && item.equipavelEm.length ? new Set(item.equipavelEm) : null;
    // Onde a peça é só carregada, sem efeito (arco nas Costas, escudo no Braço).
    const guardaveis = new Set(ES ? ES.partesDeGuarda(item, _sys.equipment) : []);

    return Object.keys(slots).map(k => {
        const s = slots[k];
        const ehGuarda = guardaveis.has(s.partId);
        const bloq = permitidas && !permitidas.has(s.partId) && !ehGuarda;
        const ocup = ocupados.has(k);
        const estados = ES ? ES.estadosNoSlot(item, s, _sys.equipment) : [];
        const semEstado = !bloq && estados.length === 0;
        return `<option value="${esc(k)}" data-estados="${esc(estados.join(','))}" ${bloq || ocup || semEstado ? 'disabled' : ''}>${esc(s.icon)} ${esc(s.label)}${ocup ? ' (ocupado)' : ''}${bloq ? ' (não permitido)' : ''}${ehGuarda ? ' 🎒 guardar' : ''}${semEstado ? ' (não aceita)' : ''}</option>`;
    }).join('');
}

/** O estado segue o slot: parte de guarda só aceita Fixado. */
function estadoSegueSlot() {
    const sSlot = document.getElementById('tbEqSlot');
    const sEstado = document.getElementById('tbEqEstado');
    if (!sSlot || !sEstado) return;
    const permitidos = (sSlot.selectedOptions[0]?.dataset.estados || '').split(',').filter(Boolean);
    let primeiro = null;
    for (const op of sEstado.options) {
        op.disabled = permitidos.length > 0 && !permitidos.includes(op.value);
        if (!op.disabled && primeiro === null) primeiro = op.value;
    }
    if (primeiro !== null) sEstado.value = primeiro;
}
window._tbEstadoSegueSlot = estadoSegueSlot;

/** Estados de equipe; a `formaEquipar` da peça tranca os que não servem. */
function optsEstadoEquipar(item) {
    const forma = item.formaEquipar;
    return Object.entries(ESTADO_EQUIP).map(([v, rot]) => {
        const [ic, f] = FORMA_EQUIP[v];
        const bloq = forma && f !== forma;
        return `<option value="${v}" ${bloq ? 'disabled' : ''} ${!bloq && forma ? 'selected' : ''}>${ic} ${rot}</option>`;
    }).join('');
}

/**
 * Grava o equipar. Cobertura extra (armadura de várias peças) ocupa o que
 * estiver livre e nunca impede; só a 2ª mão da arma de duas mãos é requisito.
 */
async function confirmarEquipar(win, item, slots, partes) {
    const ES = window.EquipSlots;
    const slot = document.getElementById('tbEqSlot')?.value;
    const estado = document.getElementById('tbEqEstado')?.value;
    if (!slot || !estado) return false;

    const maos = Number(document.getElementById('tbEqMaos')?.value) || (ES ? ES.maosDoItem(item) : 1);
    const plano = ES
        ? ES.planejarEquipar({ ...item, maosUsadas: maos }, slot, win.itens || [], slots, {
            catalog: _sys.equipment,
            labelParte: pid => partes.find(b => b.id === pid)?.nome || pid,
        })
        : { extras: [], maoExtra: null, faltaMao: null };

    if (plano.faltaMao) {
        toast(`⚠️ Falta ${plano.faltaMao} livre para empunhar esta arma`, 'warning');
        return false;
    }
    try {
        await updateDoc(doc(db, 'items', item.id), {
            equipado: true, slotAnatomico: slot, slotsOcupados: plano.extras,
            slotAnatomico2: plano.maoExtra, maosUsadas: maos,
            estadoEquip: estado, parentItemId: null,
        });
        toast(`🎽 ${esc(item.nome || 'Item')} equipado`);
        return true;
    } catch (err) { errWrite(err); return false; }
}

function abrirEquipar(win, itemId) {
    const item = (win.itens || []).find(x => x.id === itemId);
    if (!item || !_sys) return;
    const partes = partesDoCorpo(win);
    const slots = slotsDoCorpo(partes);
    if (!Object.keys(slots).length) { toast('⚠️ A ficha não tem partes do corpo definidas', 'warning'); return; }

    const ES = window.EquipSlots;
    document.getElementById('tbFwinEquip')?.remove();
    const ov = document.createElement('div');
    ov.id = 'tbFwinEquip';
    ov.className = 'tb-cond-picker-overlay';
    ov.innerHTML = `<div class="tb-cond-picker" style="max-width:340px">
        <div class="tb-cond-picker-head"><span>🎽 Equipar: ${esc(item.nome || 'Item')}</span>
            <button class="tb-mini-btn" data-eqx title="Cancelar">✕</button></div>
        <div class="tb-fwin-equip-corpo">
            <div class="tb-form-grid tb-form-grid-1">
                <label>Slot anatômico<select id="tbEqSlot" onchange="window._tbEstadoSegueSlot()">${optsSlotEquipar(item, slots, win.itens || [], itemId)}</select></label>
                <label>Estado<select id="tbEqEstado">${optsEstadoEquipar(item)}</select></label>
                ${ES && ES.escolheMaos(item) ? `<label>✋ Mãos<select id="tbEqMaos">
                    <option value="1" ${Number(item.maosUsadas) === 2 ? '' : 'selected'}>🤚 1 Mão</option>
                    <option value="2" ${Number(item.maosUsadas) === 2 ? 'selected' : ''}>🤲 2 Mãos</option>
                </select></label>` : ''}
            </div>
            <div class="tb-modal-actions"><button class="tb-btn tb-btn-success" data-eqok>✅ Equipar</button></div>
        </div>
    </div>`;
    document.body.appendChild(ov);
    estadoSegueSlot();
    ov.addEventListener('click', async e => {
        if (e.target === ov || e.target.closest('[data-eqx]')) { ov.remove(); return; }
        if (!e.target.closest('[data-eqok]')) return;
        if (await confirmarEquipar(win, item, slots, partes)) ov.remove();
    });
}

/** Arrastar de Equipados para Soltos: solta o item (mesmo patch da ficha). */
async function desequipar(win, itemId) {
    const item = (win.itens || []).find(x => x.id === itemId);
    if (!item?.equipado) return;
    try {
        await updateDoc(doc(db, 'items', itemId), {
            equipado: false, slotAnatomico: null, slotsOcupados: [], estadoEquip: null,
        });
        toast(`📤 ${esc(item.nome || 'Item')} desequipado`);
    } catch (e) { errWrite(e); }
}

/** Soltar sobre pilha idêntica: soma as quantidades e junta. */
async function fundirPilhas(win, origemId, alvoId) {
    const a = (win.itens || []).find(x => x.id === origemId);
    const b = (win.itens || []).find(x => x.id === alvoId);
    if (!a || !b || !itensIdenticos(a, b)) return;
    const q = await escolherQtd(a, `Juntar quantos "${a.nome || 'item'}" nesta pilha?`);
    if (q == null) return;
    const plano = dividirPilha(a, q);
    const total = qtdDe(b) + plano.qtd;
    try {
        const lote = writeBatch(db);
        lote.update(doc(db, 'items', b.id), { quantidade: total });
        if (plano.move) lote.delete(doc(db, 'items', a.id));
        else lote.update(doc(db, 'items', a.id), { quantidade: plano.restante });
        await lote.commit();
        toast(`🧺 ${plano.qtd}× ${esc(a.nome || 'Item')} juntado — pilha com ${total}`);
    } catch (e) { errWrite(e); }
}

/** Drop DENTRO da janela: `alvo` = 'root' (fora de contêiner) ou 'cont:<id>'. */
async function moverItem(win, id, alvo) {
    const i = (win.itens || []).find(x => x.id === id); if (!i) return;
    if (alvo === 'root') {
        if (!i.parentItemId) return;
        try {
            await updateDoc(doc(db, 'items', id), { parentItemId: null });
            toast(`📤 ${esc(i.nome || 'Item')} fora do contêiner`);
        } catch (e) { errWrite(e); }
        return;
    }
    const contId = alvo.slice(5);
    if (contId === id || i.parentItemId === contId) return;
    const c = (win.itens || []).find(x => x.id === contId); if (!c) return;
    /* Capacidade trava, peso avisa — a régua é a do cadastro e mora no motor
       compartilhado, para a mesma bolsa não aceitar coisas diferentes em cada
       inventário. */
    const veredito = cabeNoConteiner(i, c, win.itens, tplDoItemMotor(c, _sys));
    if (!veredito.ok) { if (veredito.motivo) toast('📦 ' + veredito.motivo, 'warning'); return; }
    const q = await escolherQtd(i, `Mover quantos "${i.nome || 'item'}" para ${c.nome || 'o contêiner'}?`);
    if (q == null) return;
    const plano = dividirPilha(i, q);
    try {
        if (plano.move) {
            await updateDoc(doc(db, 'items', id), { parentItemId: contId, equipado: false, estadoEquip: null, slotAnatomico: null });
        } else {
            // divide a pilha: o original fica com o resto, o clone entra no contêiner
            const lote = writeBatch(db);
            lote.update(doc(db, 'items', id), { quantidade: plano.restante });
            const { id: _id, ...campos } = i;
            lote.set(doc(collection(db, 'items')), { ...campos, quantidade: plano.qtd, parentItemId: contId, equipado: false, estadoEquip: null, slotAnatomico: null });
            await lote.commit();
        }
        win.contAbertos.add(contId);
        toast(`📦 ${plano.qtd}× ${esc(i.nome || 'Item')} → ${esc(c.nome || 'contêiner')}`);
    } catch (e) { errWrite(e); }
}

/** Drop sobre o canvas: vira loot no mapa (contêiner vai inteiro, com o conteúdo). */
async function droparNoMapa(dados, ponto) {
    const win = WINS.get(dados.win); if (!win) return;
    const i = (win.itens || []).find(x => x.id === dados.id); if (!i) return;
    const p = screenToWorld(ponto);
    // Só onde o personagem enxerga — mesma regra do inventário do jogador (tab-mostrar)
    if (!T.isMaster && T.mode === 'public' && T.canvas?.luzDinamica?.ativa && !pontoVisivelAgora(p)) {
        toast('🌫️ Seu personagem não enxerga esse ponto — solte dentro da visão dele', 'warning');
        return;
    }
    const cont = ehContainer(i);
    const q = cont ? qtdDe(i) : await escolherQtd(i, `Dropar quantos "${i.nome || 'item'}" no mapa?`);
    if (q == null) return;
    const plano = dividirPilha(i, q);
    const filhos = cont ? (win.itens || []).filter(x => x.parentItemId === i.id) : [];
    try {
        const lote = writeBatch(db);
        if (plano.move) {
            lote.delete(doc(db, 'items', i.id));
            filhos.forEach(f => lote.delete(doc(db, 'items', f.id)));
        } else {
            lote.update(doc(db, 'items', i.id), { quantidade: plano.restante });
        }
        await lote.commit();
        const obj = {
            tipo: 'loot', layerId: 'tokens', x: p.x, y: p.y,
            nome: i.nome || 'Item', url: i.imagem || i.imagemUrl || '',
            quantidade: plano.qtd,
            item: { ...semId(i), quantidade: plano.qtd }, visivelPublico: true,
        };
        if (cont) { obj.itensDentro = filhos.map(f => ({ id: f.id, ...semId(f) })); obj.fixo = false; }
        await addObj(obj);
        toast(`🗺️ ${plano.qtd}× ${esc(i.nome || 'Item')} dropado no mapa`);
    } catch (e) { errWrite(e); }
}

// ===== RENDER =====
function renderTodas() { for (const w of WINS.values()) render(w); }
window._renderFichaWins = renderTodas;

const fmtDV = (v, dv) => `${dv?.prefixo || ''}${dv?.arredondaMesa ? dvMesa(Number(v) || 0) : fmtN(v)}${dv?.sufixo || ''}`;
const tituloDeChave = (k) => String(k).split('_').map(p => p.charAt(0) + p.slice(1).toLowerCase()).join(' ');
const CARREGANDO = '<div class="tb-muted" style="padding:10px">⏳ Carregando registros do sistema…</div>';

function render(win, forcar) {
    if (!win.el.isConnected) return;
    // Não repinta com um campo da própria janela focado (o clique/toggle força)
    const ae = document.activeElement;
    if (!forcar && ae && win.el.contains(ae) && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) {
        win.pendente = true; return;
    }

    const fonte = win.tipo === 'npc' ? dadosNpc(win.id) : dadosChar(win.id);
    win.el.querySelector('.tb-fwin-inv-n').textContent = win.itens ? win.itens.length : '…';

    const titulo = win.el.querySelector('.tb-fwin-titulo');
    if (!fonte) {
        titulo.textContent = '—';
        win.el.querySelector('.tb-fwin-body').innerHTML = '<div class="tb-muted" style="padding:14px;text-align:center">Ficha não encontrada nesta mesa.</div>';
        return;
    }
    const img = win.tipo === 'npc' ? fonte.imagem : fonte.charImg;
    const meta = win.tipo === 'npc'
        ? [fonte.nivel ? 'Nv ' + fonte.nivel : '', fonte.classe || fonte.tipo || ''].filter(Boolean).join(' · ')
        : [fonte.raca, fonte.classe].filter(Boolean).join(' · ');
    titulo.innerHTML = `${img ? `<img class="tb-fwin-avatar" src="${esc(img)}" alt="">` : (win.tipo === 'npc' ? '👹' : '🎭')}
        <b>${esc(fonte.nome || '?')}</b>${meta ? `<span class="tb-fwin-meta">${esc(meta)}</span>` : ''}`;

    win.el.querySelectorAll('.tb-fwin-aba').forEach(b => b.classList.toggle('ativa', b.dataset.aba === win.aba));
    win.el.querySelector('.tb-fwin-body').innerHTML =
        win.aba === 'inv' ? htmlInventario(win) : htmlCombate(win, fonte);
    if (win.aba !== 'inv') compactarAtaques(win);
}

// ---- Aba Combate ----
function htmlCombate(win, fonte) {
    const vitais = SIGLAS_VITAIS.map(([sig, rot, cor]) => {
        const { cur, max } = valorVital(win, sig);
        const pct = max > 0 ? Math.max(0, Math.min(100, (cur / max) * 100)) : 0;
        return `<div class="tb-fwin-vital">
            <span class="tb-fwin-vlb" title="${rot}">${sig}</span>
            <button class="tb-cstat-btn" data-vdelta="-1" data-sig="${sig}">−</button>
            <div class="tb-fwin-vwrap">
                <div class="tb-fwin-vbar"><i style="width:${pct}%;background:${cor}"></i></div>
            </div>
            <input class="tb-fwin-vcur" data-vcur data-sig="${sig}" inputmode="decimal" value="${vNum(cur)}" aria-label="${rot} atual">
            <span class="tb-fwin-vmax">/ ${vNum(max)}</span>
            <button class="tb-cstat-btn" data-vdelta="1" data-sig="${sig}">+</button>
        </div>`;
    }).join('');

    const conds = condicoesDoc(win).map((c, i) =>
        `<span class="tb-cond" title="${esc([c.descricao, c.tempoRestante ? 'restam ' + c.tempoRestante : ''].filter(Boolean).join(' — '))}">
            ${esc(c.icone || '💀')} ${esc(c.nome || '?')}${c.tempoRestante ? ` <i class="tb-fwin-ctempo">⏱️${esc(c.tempoRestante)}</i>` : ''}
            <b data-condrm="${i}" title="Remover da ficha">✕</b>
        </span>`).join('');
    const secConds = `<div class="tb-conds">${conds}<button class="tb-cond-add" data-condadd>➕ condição</button></div>`;

    const corpo = win.tipo === 'npc' ? htmlCombateNpc(win, fonte) : htmlCombateChar(win, fonte);
    return `<div class="tb-fwin-vitais">${vitais}</div>${secConds}${corpo}`;
}

const detalhe = (titulo, html, aberto) => html
    ? `<details class="tb-fwin-sec"${aberto ? ' open' : ''}><summary>${titulo}</summary><div class="tb-fwin-sec-body">${html}</div></details>`
    : '';

/* `title=` virou a janelinha compartilhada (shared/detalhe.js): a caixinha do
   sistema operacional não aparece no celular — que é onde a mesa lê a ficha —
   e não cabe fórmula nenhuma nela. A fórmula e o "usado em" saem do registro. */
const chip = (icone, nome, valor, title) =>
    `<span class="tb-fwin-chip" data-det-nome="${esc(nome)}" data-det-icone="${esc(icone || '')}"
        data-det-desc="${esc(title || '')}">${icone ? esc(icone) + ' ' : ''}${esc(nome)} <b>${esc(String(valor))}</b></span>`;

const ATRIBUTOS = [['INT', 'Inteligência'], ['RAC', 'Raciocínio'], ['PRS', 'Perseverança'], ['FOR', 'Força'], ['DES', 'Destreza'], ['VIG', 'Vigor'], ['PRE', 'Presença'], ['MAN', 'Manipulação'], ['AUT', 'Autocontrole']];

/* ---- 📊 Valores de Combate: blocos aninhados, 2 primeiros abertos ---- */
function secaoValores(blocos) {
    if (!blocos.length) return '';
    const inner = blocos.map((b, ix) => `<details class="tb-fwin-bloco"${ix < 2 ? ' open' : ''}>
        <summary>${esc(b.nome)}<span class="tb-fwin-bloco-n">${b.chips.length}</span></summary>
        <div class="tb-fwin-chips">${b.chips.join('')}</div>
    </details>`).join('');
    return detalhe('📊 Valores de Combate', inner, true);
}

/**
 * IDs de VD VINCULADOS ao personagem — mesma regra do renderDerivedValuesGrid
 * da ficha (derived-values.js): raça e classe por `derivedValueIds`, mais os
 * VDs trazidos por peculiaridade de raça, classe, tribo e individuais.
 * `derivedTotals` sozinho não serve de filtro: o motor calcula TODOS os VDs do
 * registro, mas a ficha só EXIBE os vinculados.
 */
// dvsVinculadosChar / dvAplicaChar moraram aqui; foram para tab-hud.js quando o
// HUD do token e o card do combate passaram a filtrar pela MESMA regra da ficha.

/**
 * Junta chips nos blocos do registro. O bloco fica com a MENOR ordem que
 * apareceu — um VD sem `blocoOrdem` não empurra o bloco para o fim.
 * Usado pelas duas fontes (personagem e NPC), que só diferem em de onde
 * tiram os números.
 */
function agrupadorDeBlocos() {
    const blocos = new Map();
    return {
        add(nome, ordem, chipHtml) {
            const b = blocos.get(nome) || { nome, ordem, chips: [] };
            b.ordem = Math.min(b.ordem, ordem);
            b.chips.push(chipHtml);
            blocos.set(nome, b);
        },
        ordenados: () => [...blocos.values()].sort((a, b) => a.ordem - b.ordem),
    };
}

/** VDs do personagem: SÓ os vinculados (regra da ficha), nos blocos do registro. */
function blocosChar(ch, vinc) {
    const dt = ch.derivedTotals || {};
    const { vitais } = idx();
    const { add, ordenados } = agrupadorDeBlocos();
    const usados = new Set();
    for (const dv of _sys.derivedValues) {                    // ordem do registro
        const k = normChave(dv.nome);
        if (usados.has(k) || dt[k] == null || vitais.has(k)) continue;
        if (!dvAplicaChar(dv, vinc)) continue;
        // Espelho valendo o mesmo que o espelhado só repete o número — a ficha
        // também o esconde (dv-espelho-igual).
        if (dv.espelhaVD) {
            const base = _sys.derivedValues.find(d => d.nome === dv.espelhaVD);
            if (base && Number(dt[normChave(base.nome)] ?? 0) === Number(dt[k])) continue;
        }
        usados.add(k);
        add(dv.blocoNome || 'Geral', dv.blocoOrdem ?? 999, chip(dv.icone, dv.nome, fmtDV(dt[k], dv), dv.descricao));
    }
    return ordenados();
}

/** VDs do NPC (espelhos legados + overrides + extras), agrupados e SEM duplicar:
 *  extra "Iniciativa" não repete o chip que já veio do espelho INI. */
function blocosNpc(n) {
    const vd = n.valoresDer || {};
    const { porChave, vitais } = idx();
    const { add, ordenados } = agrupadorDeBlocos();
    const vistos = new Set(['VITALIDADE', 'ENERGIA', 'SANIDADE']);
    for (const [sig, rot, icone] of [['PERC', 'Percepção', '👁️'], ['INI', 'Iniciativa', '⚡'], ['REA', 'Defesa', '🌀'], ['BLD', 'Blindagem', '🛡️']]) {
        if (vd[sig] == null || vd[sig] === '') continue;
        const dv = porChave.get(normChave(rot));
        vistos.add(normChave(rot));
        add(dv?.blocoNome || 'Combate', dv?.blocoOrdem ?? 1, chip(dv?.icone || icone, dv?.nome || rot, fmtDV(vd[sig], dv), dv?.descricao));
    }
    for (const [k, v] of Object.entries(vd.overrides || {})) {
        if (v == null || v === '') continue;
        const dv = porChave.get(k);
        const chave = dv ? normChave(dv.nome) : normChave(k);
        if (vitais.has(chave) || vistos.has(chave)) continue;
        vistos.add(chave);
        add(dv?.blocoNome || 'Outros', dv?.blocoOrdem ?? 9998, chip(dv?.icone || '📊', dv?.nome || tituloDeChave(k), fmtDV(v, dv), dv?.descricao));
    }
    for (const x of (vd.extras || [])) {
        if (!x.nome) continue;
        const chave = normChave(x.nome);
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        add('Extras', 9999, chip('📎', x.nome, x.valor ?? ''));
    }
    return ordenados();
}

/* ---- ⚔️ Ataques ---- */
const tplDoItem = (i) => tplDoItemMotor(i, _sys);
const formulaDanoDoItem = (i) => formulaDanoMotor(i, _sys);

/* Linhas de golpe POR ITEM, como na ficha e no modal do Painel do Mestre —
 * nunca os totais globais repetidos em cada arma (era o bug: cinco Acertos
 * iguais em toda linha, nenhum com o delta da arma).
 *   NPC        → calcularNpc (o MESMO motor do modal) devolve porItem: base do
 *                NPC + ops presas a cada item, com override e Equação de Valor.
 *   Personagem → derivedTotals dá a base global persistida pela ficha; o delta
 *                vem dos Valores Derivados Vinculados do próprio item
 *                (instância vence modelo), com a Equação de Valor resolvida
 *                por valorComponente — a mesma régua dos 🎯 Testes. O
 *                state.itemBonuses da ficha não é persistido; o que dá para
 *                reproduzir daqui são os vínculos do item, que é onde arma
 *                guarda acerto e dano.
 * Chips por linha: SÓ as colunas onde o item mete a mão (bônus ≠ 0) — os
 * valores globais já moram em 📊 Valores de Combate, repetir cada um em cada
 * arma era o ruído da tela. */

/** Item com Efeitos Ativos — mesma régua de _npcItemFormas (npc-calc-engine)
 *  e itemFormasAtuais (ficha): equipado, fora de contêiner, no estado que a
 *  forma de equipar pede; segurar/fixado não ligam os efeitos. */
function temEfeitosAtivos(i) {
    /* Integridade zerada silencia a peca: continua equipada, continua pesando,
       nao faz mais nada. O predicado esta duplicado em tres arquivos (ficha,
       Tabuleiro, motor de NPC) e o corte tem de ser nos tres — senao item
       arruinado segue dando bonus em duas telas. */
    if (integridadeZerada(i, tplDoItemMotor(i, _sys))) return false;

    if (!i.equipado || i.parentItemId || i.estadoEquip === 'armazenado') return false;
    if (i.estadoEquip === 'fixado' || i.estadoEquip === 'segurar') return false;
    if (i.formaEquipar) {
        const map = { segurar: 'segurar', empunhar: 'empunhado', vestir: 'vestido', fixar: 'fixado' };
        return i.estadoEquip === map[i.formaEquipar];
    }
    return true;
}

/* Propriedades de item nas refs "Item: ..." — espelho de _NPC_ITEM_PROPS
 * (npc-calc-engine) e _ME_ITEM_PROPS (ficha). `fio` é o nome antigo da
 * Qualidade, mantido para item não migrado. */
const PROP_ITEM = {
    'Peso/Pressão': (it) => it.pressaoOverride ?? it.pressaoBase ?? it.peso,
    'Tamanho': (it) => it.tamanho,
    'Multiplicador de Pressão': (it, tpl) => it.multiplicadorPressao ?? tpl?.multiplicadorPressao ?? 1,
    'Capacidade do Container': (it, tpl) => it.capacidadeContainer ?? tpl?.capacidadeContainer,
    'Preço': (it, tpl) => it.preco ?? tpl?.preco,
    'Liga': (it, tpl) => it.liga ?? tpl?.liga,
    'Qualidade': (it, tpl) => it.qualidade ?? tpl?.qualidade ?? it.fio ?? tpl?.fio ?? 0,
    'Fio': (it, tpl) => it.qualidade ?? tpl?.qualidade ?? it.fio ?? tpl?.fio ?? 0,
    'Afiação': (it, tpl) => it.afiacao ?? tpl?.afiacao ?? 0,
    'Quantidade': (it) => it.quantidade ?? 1,
};
function propDoItem(i, prop) {
    const fn = PROP_ITEM[prop];
    if (!fn || !i) return 0;
    const n = parseFloat(fn(i, tplDoItem(i)));   // Liga vem como string ('0'..'5')
    return isNaN(n) ? 0 : n;
}

/** Ref de equação no contexto do DONO da janela (personagem ou NPC).
 *  O prefixo "Perícia:" resolve SÓ como perícia — é ele que separa a perícia
 *  de um VD homônimo; cair no lookup geral pegaria o VD. NPC guarda perícia
 *  em periciasEstruturadas (refId+nível), que valorComponente não conhece. */
function refFonte(win, fonte, ref, item) {
    if (!ref) return 0;
    if (ref === 'Nível') return Number(fonte.nivel) || 0;
    if (ref.startsWith('Item: ')) return propDoItem(item, ref.slice(6));
    if (ref.startsWith('Projétil: ')) {
        const p = (win.itens || []).find(x => x.id === item?.projetilId);
        return p ? propDoItem(p, ref.slice(10)) : 0;
    }
    if (ref.startsWith('Perícia: ')) {
        const nome = ref.slice(9);
        const s = (_sys?.skills || []).find(x => x.nome === nome);
        const ps = s && (fonte.periciasEstruturadas || []).find(p => p.refId === s.id);
        if (ps) return ps.nivel || 0;
        return valorComponente(nome, { dots: fonte.dots, pericias: fonte.pericias }) ?? 0;
    }
    return valorComponente(ref, fonte) ?? 0;
}

/** Equação de Valor de um vínculo, com o item em escopo (mesmas ops do motor). */
function eqFonte(win, fonte, eq, item) {
    // ponytail: termo 'sort' vale o mínimo — sortear a cada repinte faria o número dançar na tela
    const termo = (t) => !t ? 0
        : t.tipo === 'ficha' ? refFonte(win, fonte, t.ref, item)
        : t.tipo === 'sort' ? Math.min(parseFloat(t.min) || 0, parseFloat(t.max) || parseFloat(t.min) || 0)
        : parseFloat(t.valor) || 0;
    let r = termo(eq[0]);
    for (let k = 1; k < eq.length; k++) {
        const t = eq[k], v = termo(t);
        switch (t.op || '+') {
            case '-': r -= v; break;
            case '×': case '*': r *= v; break;
            case '÷': case '/': r = v !== 0 ? r / v : r; break;
            case 'min': r = Math.min(r, v); break;
            case 'max': r = Math.max(r, v); break;
            default: r += v;
        }
    }
    return r;
}

/** Linhas de golpe DESARMADO — computeGolpesDesarmados, a MESMA função da
 *  tabela da ficha: parte com podeGolpear e slot livre vira golpe 1d4, e
 *  partes idênticas fundem numa linha só com ×N (Mão 1/Mão 2 → "Mão ×2").
 *  `dvsCtx`/`derived` chegam na MESMA chave: o personagem usa normChave(nome)
 *  contra derivedTotals; o NPC usa a key do registro contra os finais do motor. */
function linhasDesarmado(win, fonte, dvsCtx, derived) {
    if (!_golpes) return [];
    const partes = partesDoCorpo(win);
    const bodySlots = slotsDoCorpo(partes);
    if (!Object.values(bodySlots).some(s => s.podeGolpear)) return [];
    const ES = window.EquipSlots;
    const ocupados = (win.itens || []).filter(i => i.equipado)
        .flatMap(i => ES ? ES.slotsDoItem(i) : [i.slotAnatomico]).filter(Boolean);
    // Vínculos de VD da própria parte ("golpe desta parte", do registro de
    // Partes do Corpo): a Perna sobe o chute sem mexer no soco.
    const parteBonuses = {};
    const keyDe = new Map(dvsCtx.map(d => [d.id, d.key]));
    for (const bp of partes) {
        for (const v of (bp.valoresDerivadosVinculados || [])) {
            const k = keyDe.get(v.id || v);
            if (!k) continue;
            const val = (Array.isArray(v.equacao) && v.equacao.length)
                ? eqFonte(win, fonte, v.equacao, null) : (Number(v.modificador) || 0);
            if (!val) continue;
            const bag = parteBonuses[bp.id] = parteBonuses[bp.id] || {};
            bag['DERIVED:' + k] = (bag['DERIVED:' + k] || 0) + val;
        }
    }
    return _golpes({ derivedValues: dvsCtx, derived, bodySlots, slotsOcupados: ocupados, parteBonuses });
}

/** Golpes do NPC: porItem do motor + desarmados, cacheado por identidade (os
 *  snapshots trocam o objeto do NPC e o array de itens — identidade nova =
 *  reconta). */
function linhasAtaqueNpc(win, n) {
    if (win._atkNpc === n && win._atkItens === win.itens) return win._atkLinhas;
    let linhas = [];
    if (_calcNpc) {
        try {
            // O motor só conhece `modeloId`; item legado guarda o modelo em
            // `origemTemplateId` e perderia dano e vínculos em silêncio.
            const itens = (win.itens || []).map(i =>
                (!i.modeloId && i.origemTemplateId) ? { ...i, modeloId: i.origemTemplateId } : i);
            const r = _calcNpc(n, _sys, { items: itens });
            linhas = (r.porItem || []).map(l => ({
                nome: l.nome, estadoEquip: ESTADO_EQUIP[l.estadoEquip] || l.estadoEquip || '',
                dano: l.dano, canais: [], colunas: l.colunas || [],
                tiposGolpe: l.tiposGolpe || [],
            }));
            const finais = {};
            for (const [k, d] of Object.entries(r.derived || {})) finais[k] = d.final;
            linhas.push(...linhasDesarmado(win, n, _sys.derivedValues, finais));
        } catch (e) { console.warn('golpes do NPC', e); }
    }
    win._atkNpc = n; win._atkItens = win.itens; win._atkLinhas = linhas;
    return linhas;
}

/** Golpes do personagem: base persistida + delta dos vínculos do item. */
function linhasAtaqueChar(win, ch) {
    const dt = ch.derivedTotals || {};
    const linhas = [];
    for (const i of (win.itens || []).filter(temEfeitosAtivos)) {
        const tpl = tplDoItem(i);
        const vincs = (Array.isArray(i.valoresDerivadosVinculados) && i.valoresDerivadosVinculados.length)
            ? i.valoresDerivadosVinculados : (tpl?.valoresDerivadosVinculados || []);
        const delta = {};   // normChave(nome do VD) → soma deste item
        for (const v of vincs) {
            // Vínculo preso a uma pegada (v.maos) só vale naquela pegada.
            if (!window.EquipSlots.vinculoValeComMaos(v, i)) continue;
            const def = _sys.derivedValues.find(d => d.id === (v.id || v));
            if (!def || !def.escopoItem) continue;   // vínculo global: a ficha já somou em derivedTotals
            if (v.escopo === 'global') continue;      // idem — forçado ao total pelo cadastro
            const val = (Array.isArray(v.equacao) && v.equacao.length)
                ? eqFonte(win, ch, v.equacao, i) : (Number(v.modificador) || 0);
            if (!val) continue;
            const k = normChave(def.nome);
            delta[k] = (delta[k] || 0) + val;
        }

        const colunas = [];
        const canais = [];
        let somaDano = 0;
        for (const d of _sys.derivedValues) {
            if (!d.escopoItem) continue;
            const k = normChave(d.nome);
            const base = Number(dt[k]) || 0;
            const bonus = delta[k] || 0;
            const total = base + bonus;
            if (d.escopoItem === 'dano') { somaDano += total; continue; }
            if (d.escopoItem === 'dano-canal') { if (total) canais.push({ icone: d.icone, nome: d.nome, total }); continue; }
            colunas.push({ nome: d.nome, icone: d.icone, prefixo: d.prefixo, sufixo: d.sufixo, base, bonus, total });
        }

        // SEM fórmula não há dano nem canal: bônus só significa algo grudado num dado
        const formula = formulaDanoDoItem(i);
        let dano = '';
        if (formula) { const s = fmtN(somaDano); dano = s !== 0 ? `${formula}${s > 0 ? '+' : ''}${s}` : formula; }

        if (dano || colunas.some(c => c.bonus !== 0)) {
            linhas.push({ nome: i.nome || 'Item', estadoEquip: ESTADO_EQUIP[i.estadoEquip] || '',
                dano, canais: formula ? canais : [], colunas,
                // getItemTiposGolpe só conhece modeloId; item legado usa origemTemplateId
                tiposGolpe: window.getItemTiposGolpe?.(
                    (!i.modeloId && i.origemTemplateId) ? { ...i, modeloId: i.origemTemplateId } : i,
                    _sys.equipment) || [] });
        }
    }
    const dvsCtx = _sys.derivedValues.map(d => ({ ...d, key: normChave(d.nome) }));
    linhas.push(...linhasDesarmado(win, ch, dvsCtx, dt));
    return linhas;
}

/** Registros do sistema para o ⚔️ Painel do Turno (mira dos itens pré-definidos). */
export async function registroSistema() { return carregarSys(); }

/**
 * Golpes prontos para o ⚔️ Painel do Turno: mesma conta das janelas, mas com
 * UMA query de itens (sem listener — o painel pede na hora de abrir o menu).
 * Cada linha ganha `alcanceM` (instância > modelo > 0) para a régua do golpe.
 */
// Inventário da última consulta de golpes, por participante. O picker de
// projétil precisa do inventário INTEIRO (a flecha pode estar na aljava), e
// não só das linhas de ataque — refazer a query seria uma leitura a mais por
// disparo.
const _itensPorChave = new Map();

/** Inventário cru de quem já teve os golpes carregados (ou [] se não teve). */
export function itensCarregados(tipo, id) {
    return _itensPorChave.get(`${tipo}:${id}`) || [];
}

/**
 * 🗑️ O inventário mudou: a próxima consulta refaz a query.
 *
 * Sem isto o cache mentia. A caçadora dropou as flechas no mapa, o painel
 * continuou oferecendo "Flecha de Penacho ×20" e o disparo tentou descontar de
 * um doc que não existia mais — errava calado e o tiro saía de graça.
 *
 * Sem argumento limpa TUDO: quem mexeu no inventário nem sempre sabe de quem
 * ele é (loot no chão, pilha fundida), e uma query a mais é barata perto de
 * gastar munição fantasma.
 */
export function invalidarItens(tipo, id) {
    if (tipo && id) _itensPorChave.delete(`${tipo}:${id}`);
    else _itensPorChave.clear();
    limparCacheGolpes();
}

/**
 * A COLUNA de Acerto que vale para esta linha (distância, desarmado ou c.a.c).
 * Devolve a coluna inteira e não só o número: a janela de conflito precisa do
 * NOME para dizer "Acerto à Distância" em vez de um "Acerto" genérico que não
 * corresponde a Valor Derivado nenhum da ficha.
 */
function colunaDeAcerto(l) {
    const cols = l.colunas || [];
    const acha = re => cols.find(c => re.test(c.nome || ''));

    // 1º) A coluna que O PRÓPRIO ITEM alimenta. É o cadastro falando: a espada
    // vincula Acerto Corpo a Corpo, o arco vincula Acerto à Distância, e o
    // instrumento vincula Acerto Mágico. Decidir pelo TIPO da linha dava
    // "Corpo a Corpo" (quase sempre 0) para tudo que não fosse arco nem soco —
    // uma rabeca entregava o Alvo errado sem avisar ninguém.
    const alimentadas = cols.filter(c => /acerto/i.test(c.nome || '') && c.bonus !== 0 && c.bonus != null);
    if (alimentadas.length === 1) return alimentadas[0];

    const porTipo = l.distancia ? /dist[âa]ncia/i : l.desarmado ? /desarmad/i : /corpo a corpo/i;
    // Mais de uma alimentada: desempata pelo tipo da linha, senão a primeira.
    if (alimentadas.length > 1) return alimentadas.find(c => porTipo.test(c.nome || '')) ?? alimentadas[0];

    // 2º) Item sem vínculo de acerto: vale o tipo da linha, como sempre valeu.
    const generico = cols.find(c => /^\s*acerto\s*$/i.test(c.nome || ''));
    return acha(porTipo) ?? generico ?? null;
}

/** Só o número, para quem não liga para o nome. */
function acertoDaLinha(l) {
    return colunaDeAcerto(l)?.total ?? null;
}

export async function linhasDeAtaque(tipo, id) {
    await carregarSys();
    let itens = [];
    try {
        const s = await getDocs(query(collection(db, 'items'), where('characterId', '==', id)));
        s.forEach(d => itens.push({ id: d.id, ...d.data() }));
    } catch (e) { console.warn('itens do turno', e); }
    _itensPorChave.set(`${tipo}:${id}`, itens);
    const win = { tipo, id, itens };
    const linhas = tipo === 'npc'
        ? (() => { const n = dadosNpc(id); return n ? linhasAtaqueNpc(win, n) : []; })()
        : (() => { const ch = dadosChar(id); return ch ? linhasAtaqueChar(win, ch) : []; })();
    // alcance do golpe: o item da linha (match por nome — as linhas saem do item)
    for (const l of linhas) {
        // ⚠️ O Acerto é calculado NO FIM: ele depende de `l.distancia`, que só
        // fica sabido algumas linhas abaixo.
        if (l.desarmado) {
            l.alcanceM = 0; l.distancia = false;
            const c = colunaDeAcerto(l);
            l.acerto = c?.total ?? null; l.acertoNome = c?.nome || ''; l.acertoIcone = c?.icone || '';
            continue;
        }
        const i = itens.find(x => (x.nome || 'Item') === l.nome);
        // 🧱 Qual peca deu este golpe: e ela que paga a Falha Critica (§5.5).
        l.itemId = i?.id || null;
        l.alcanceM = Number(i?.alcanceM ?? (i ? tplDoItem(i)?.alcanceM : 0)) || 0;
        // 🏹 Arma a distância não tem arco de balanço: mira por alvo (ver tab-turno)
        l.distancia = (i?.categoriaArma || (i ? tplDoItem(i)?.categoriaArma : '')) === 'distancia';
        // 🏷️ Tags do item + do modelo: é por elas que a Forma de Conjuração
        // reconhece o foco/instrumento equipado ("instrumento-sopro" na Rabeca).
        const tpl = i ? tplDoItem(i) : null;
        l.tags = [...new Set([...(i?.tags || []), ...(tpl?.tags || [])])];
        // 🎼 A Qualidade da peça dá o TAMANHO da área de um instrumento
        // (shared/instrumento-area.js). A instância manda; o modelo é o padrão.
        l.qualidade = Number(i?.qualidade ?? tpl?.qualidade) || 0;
        // 🏹 Besta e afins: o alcance delas não passa pelo braço (ver
        // shared/alcance-disparo.js).
        l.ignoraLimiteForDisparo = !!(i?.ignoraLimiteForDisparo ?? tpl?.ignoraLimiteForDisparo);
        // 🤾 Peça arremessável: o inverso da besta. Não tem alcance próprio —
        // chega a (FOR + Atletismo + Arremessar) × este fator. A linha continua
        // corpo a corpo (`distancia` false): a adaga ainda é uma adaga na mão.
        l.alcanceFator = Number(i?.alcanceFator ?? tpl?.alcanceFator) || 0;
        // 🎯 Alvo do ataque. Existem CINCO VDs de acerto (Corpo a Corpo, à
        // Distância, Mágico, Desarmado e o genérico) e todos chegam como
        // coluna — pegar o primeiro que casasse com /acerto/ dava "Corpo a
        // Corpo" para um arco, que é 0. Agora escolhe pelo tipo da linha, e
        // por isso precisa de `l.distancia` já resolvido.
        l.acerto = acertoDaLinha(l);
        // 🏹 Munição que esta arma gasta — vazio quer dizer "não gasta".
        l.tipoProjetil = i?.tipoProjetil?.length ? i.tipoProjetil : (tpl?.tipoProjetil || []);
        // 💀 O que a PEÇA aplica ao acertar (cadastro: "Condições Aplicadas ao
        // Usar"). É por aqui que a lâmina serrilhada sangra e a flecha envenena.
        l.condicaoIds = i?.condicaoIds?.length ? i.condicaoIds : (tpl?.condicaoIds || []);
        l.itemId = i?.id || null;
    }
    return linhas;
}

/** Espremeu? Esconde os NOMES (fica emoji + valor); hover/toque revela.
 *  Linha 1 aperta = nome da arma truncou; linha 2 aperta = dano encostou no
 *  estado. Medido depois do repinte, uma classe por linha de golpe. */
function compactarAtaques(win) {
    for (const atk of win.el.querySelectorAll('.tb-fwin-atk')) {
        // Mede sempre do estado EXPANDIDO: tira as classes, força o layout e
        // decide de novo — senão alargar a janela nunca traria os nomes de
        // volta (e a medição com nome escondido mentiria).
        atk.classList.remove('c1', 'c2');
        const nome = atk.querySelector('.tb-fwin-atk-nome');
        if (nome && nome.scrollWidth > nome.clientWidth + 1) atk.classList.add('c1');
        const l2 = atk.querySelector('.tb-fwin-atk-l2');
        if (l2 && l2.scrollWidth > l2.clientWidth + 1) atk.classList.add('c2');
    }
}

function htmlAtaques(win, fonte) {
    const linhas = win.tipo === 'npc' ? linhasAtaqueNpc(win, fonte) : linhasAtaqueChar(win, fonte);
    const html = linhas.map(l => {
        // Chip só onde a LINHA mete a mão (bônus ≠ 0) — vale para item E para
        // parte do corpo: o acerto do golpe desarmado vem do VÍNCULO que a
        // parte carrega no cadastro, e o valor global mora em 📊.
        const chips = l.colunas
            .filter(c => c.bonus !== 0)
            .map(c => `<span class="tb-fwin-canal" title="${esc(`${c.nome}: base ${fmtN(c.base)} ${c.bonus >= 0 ? '+' : '−'} ${fmtN(Math.abs(c.bonus))} (${l.desarmado ? 'parte' : 'item'})`)}">${esc(c.icone || '🎯')} <span class="tb-fwin-chip-nome">${esc(c.nome)}</span> <b>${esc(String(c.prefixo || ''))}${fmtN(c.total)}${esc(String(c.sufixo || ''))}</b></span>`)
            .join('');
        const nome = l.desarmado ? `${l.nome}${l.qtd > 1 ? ` ×${l.qtd}` : ''}` : l.nome;
        const rotulo = l.desarmado ? '👊 Desarmado' : l.estadoEquip;
        const tgs = l.tiposGolpe || (l.tipoGolpe ? [l.tipoGolpe] : []);
        return `<div class="tb-fwin-atk eq">
        <div class="tb-fwin-atk-l1">
            <span class="tb-fwin-atk-nome">${l.desarmado ? esc(l.icone || '👊') : '✊'} ${esc(nome)}</span>
            ${chips ? `<span class="tb-fwin-atk-chips">${chips}</span>` : ''}
        </div>
        <div class="tb-fwin-atk-l2">
            ${rotulo ? `<i class="tb-fwin-atk-est">${esc(rotulo)}</i>` : ''}
            <span class="tb-fwin-atk-fim">
                ${l.dano ? `<b class="tb-fwin-atk-dano" title="Fórmula de dano">💥 ${esc(l.dano)}</b>` : ''}
                ${tgs.map(tg => `<i class="tb-fwin-tg" title="Barrado pela Blindagem ${esc(tg.nome)} do alvo">${esc(tg.icone)} <span class="tb-fwin-tg-nome">${esc(tg.nome)}</span></i>`).join('')}
                ${(l.canais || []).map(c => `<span class="tb-fwin-canal" title="${esc(c.nome)}">${esc(c.icone || '💥')}${fmtN(c.total)}</span>`).join('')}
            </span>
        </div>
    </div>`;
    }).join('');

    // Arsenal fora de uso: arma carregada mas sem efeitos ativos — só a fórmula
    const guardadas = (win.itens || [])
        .filter(i => i.tipo === 'Arma' && !temEfeitosAtivos(i))
        .map(i => `<div class="tb-fwin-atk off">
            <div class="tb-fwin-atk-l1">
                <span class="tb-fwin-atk-nome">${esc(i.nome || 'Arma')} <i class="tb-fwin-atk-est">guardada</i></span>
                <b class="tb-fwin-atk-dano">💥 ${esc(formulaDanoDoItem(i) || '—')}</b>
            </div>
        </div>`).join('');

    const texto = win.tipo === 'npc' && fonte.ataques ? `<div class="tb-fwin-pre">${esc(fonte.ataques)}</div>` : '';
    return html + guardadas + texto;
}

/* ---- 📦 Habilidades & Módulos (NPC e personagem) ---- */
function campoModHtml(ctx, ii, f, item) {
    const label = esc(f.label || f.key || '');
    if (f.tipo === 'separador') return `<div class="tb-fwin-sep">${label}</div>`;
    if (f.tipo === 'botao') return '';
    const base = `data-mod data-mtipo="${ctx.mtipo}" data-mref="${esc(String(ctx.mref))}" data-mii="${ii}"`;
    if (f.tipo === 'checkbox') {
        const v = item[f.key] === true || item[f.key] === 'true';
        return `<label class="tb-fwin-mf tb-fwin-chk"><input type="checkbox" ${base} data-mkey="${esc(f.key)}" ${v ? 'checked' : ''}> ${label}</label>`;
    }
    if (f.tipo === 'number' || f.tipo === 'contador' || f.tipo === 'avaliacao') {
        return `<span class="tb-fwin-mf"><b>${label}</b><input type="number" class="tb-fwin-mnum" ${base} data-mkey="${esc(f.key)}" value="${esc(String(item[f.key] ?? ''))}"></span>`;
    }
    if (f.tipo === 'progress') {
        return `<span class="tb-fwin-mf"><b>${label}</b>
            <input class="tb-fwin-mnum" ${base} data-mkey="${esc(f.key)}_atual" data-mtxt="1" inputmode="numeric" value="${esc(String(item[f.key + '_atual'] ?? ''))}">/<input class="tb-fwin-mnum" ${base} data-mkey="${esc(f.key)}_total" data-mtxt="1" inputmode="numeric" value="${esc(String(item[f.key + '_total'] ?? ''))}"></span>`;
    }
    const v = item[f.key];
    if (v == null || v === '') return '';
    return `<div class="tb-fwin-mf"><b>${label}:</b> ${esc(String(v))}</div>`;
}

function blocoModulo(def, itens, ctx) {
    const linhas = itens.map((item, ii) => `<div class="tb-fwin-mod-item">
        <div class="tb-fwin-mod-nome">${esc(item._predefNome || item.nome || `${def.titulo} #${ii + 1}`)}</div>
        ${def.schema.map(f => campoModHtml(ctx, ii, f, item)).join('')}
    </div>`).join('');
    return `<div class="tb-fwin-mod"><div class="tb-fwin-mod-head">${esc(def.icone)} ${esc(def.titulo)}</div>${linhas || '<div class="tb-muted">Nenhum item.</div>'}</div>`;
}

/** Item de módulo sem definição no registro: exibe cru, só leitura — nada some. */
function camposGenericos(item) {
    return Object.entries(item)
        .filter(([k, v]) => !k.startsWith('_') && v !== '' && v != null && typeof v !== 'object')
        .map(([k, v]) => `<div class="tb-fwin-mf"><b>${esc(tituloDeChave(k))}:</b> ${esc(String(v))}</div>`).join('');
}

function htmlModulos(win, fonte) {
    if (win.tipo === 'npc') {
        return (fonte.modulosClasse || []).map((vinc, mi) => {
            const def = _resolveMod ? _resolveMod(vinc, _sys) : null;
            if (!def) return '';
            return blocoModulo(def, vinc.itens || [], { mtipo: 'npc', mref: mi });
        }).join('') + (fonte.skills ? `<div class="tb-fwin-pre">${esc(fonte.skills)}</div>` : '');
    }
    // Personagem: classModuleData = { moduleId: itens[] } (gravado pela ficha)
    const dados = fonte.classModuleData || {};
    return Object.entries(dados)
        .filter(([, its]) => Array.isArray(its) && its.length)
        .map(([mid, its]) => {
            const def = _sys.classModulesById?.[mid];
            if (def) return blocoModulo(def, its, { mtipo: 'char', mref: mid });
            const itens = its.map((item, ii) => `<div class="tb-fwin-mod-item">
                <div class="tb-fwin-mod-nome">${esc(item._predefNome || item.nome || item.titulo || '#' + (ii + 1))}</div>
                ${camposGenericos(item)}</div>`).join('');
            return `<div class="tb-fwin-mod"><div class="tb-fwin-mod-head">📦 ${esc(tituloDeChave(mid))}</div>${itens}</div>`;
        }).join('');
}

/* ---- Corpo da aba Combate ---- */
/** Grade dos 9 atributos. `ler(sig)` diz de onde sai o número em cada fonte:
 *  o NPC guarda por sigla, o personagem guarda em dots.attr_xxx. */
const htmlAtributos = (ler) => ATRIBUTOS.map(([sig, rot]) =>
    `<div class="tb-fwin-atr" data-det-nome="${esc(rot)}"><span>${sig}</span><b>${fmtN(ler(sig))}</b></div>`).join('');

/**
 * Espinha da aba Combate. Personagem e NPC mostram as MESMAS seções, na mesma
 * ordem — só mudam de onde vêm os números. `extra` é o que só uma das duas tem
 * (as peculiaridades do NPC).
 */
function htmlCombateBase(win, fonte, { blocos, atrs, pericias, extra = '' }) {
    return secaoValores(blocos)
        + detalhe('⚔️ Ataques', htmlAtaques(win, fonte), true)
        + detalhe('📦 Habilidades & Módulos', htmlModulos(win, fonte), true)
        + detalhe('💪 Atributos', atrs ? `<div class="tb-fwin-atrs">${atrs}</div>` : '')
        + detalhe('🎯 Perícias', pericias)
        + extra;
}

function htmlCombateNpc(win, n) {
    if (!_sys) return CARREGANDO;

    const atrs = htmlAtributos(sig => n.atributos?.[sig] ?? 0);
    const pers = (n.periciasEstruturadas || []).map((ps, i) => {
        const s = _sys.skills.find(x => x.id === ps.refId);
        return s ? { idx: i, nome: s.nome, desc: s.descricao, nivel: ps.nivel || 0 } : null;
    }).filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome));
    let periciasHtml = pers.map(p => `<div class="tb-fwin-per" data-det-nome="${esc(p.nome)}" data-det-desc="${esc(p.desc || '')}">
            <span>${esc(p.nome)}</span>
            <input type="number" data-pernivel="${p.idx}" value="${p.nivel}" min="0" max="10">
        </div>`).join('');
    if (typeof n.pericias === 'string' && n.pericias.trim()) periciasHtml += `<div class="tb-fwin-pre">${esc(n.pericias)}</div>`;

    const pecs = (n.peculiaridades || []).map(p => {
        const reg = p?.refId ? _sys.pecsById[p.refId] : null;
        const nome = reg?.nome || p?.nome || (typeof p === 'string' ? p : null);
        if (!nome) return '';
        return chip(reg?.icone || '🧬', nome, p?.nivel ? 'Nv ' + p.nivel : '', reg?.descricao || '');
    }).join('');

    return htmlCombateBase(win, n, {
        blocos: blocosNpc(n),
        atrs,
        pericias: periciasHtml,
        extra: detalhe('🧬 Peculiaridades', pecs ? `<div class="tb-fwin-chips">${pecs}</div>` : ''),
    });
}

function htmlCombateChar(win, ch) {
    if (!_sys) return CARREGANDO;

    const atrs = htmlAtributos(sig => ch.dots?.['attr_' + sig.toLowerCase()] ?? 0);

    // Perícias: registro resolvido contra os dots da ficha (mesma régua dos 🎯 Testes)
    const pers = _sys.skills.map(s => ({ s, v: valorComponente(s.nome, { dots: ch.dots }) }))
        .filter(x => x.v != null && x.v > 0)
        .sort((a, b) => (a.s.nome || '').localeCompare(b.s.nome || ''));
    const periciasHtml = pers.map(x => `<div class="tb-fwin-per" title="${esc(x.s.descricao || x.s.nome)}">
            <span>${esc(x.s.nome)}</span><b>${fmtN(x.v)}</b>
        </div>`).join('');

    const vinc = dvsVinculadosChar(ch, _sys);
    return htmlCombateBase(win, ch, {
        blocos: blocosChar(ch, vinc),
        atrs,
        pericias: periciasHtml,
    });
}

/* ---- Aba Inventário ----
   Toda a lista (linhas, contêineres, pilhas, detalhe e arrasto) vem do motor
   compartilhado; aqui só se diz de onde vêm os itens e o que cada ação grava. */
function htmlInventario(win) {
    if (!win.itens) return '<div class="tb-muted" style="padding:14px;text-align:center">⏳ Carregando itens…</div>';
    win._slots = null;   // anatomia recalculada uma vez por repinte
    return htmlInvMotor(win.inv);
}
