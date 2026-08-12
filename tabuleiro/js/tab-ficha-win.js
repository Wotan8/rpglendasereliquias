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
    db, doc, setDoc, updateDoc, deleteDoc, addDoc, collection, onSnapshot, query, where, writeBatch
} from '../../painel-mestre/js/firebase-config.js';
import {
    T, esc, toast, markDirty, vNum, dvMesa, normChave, patchVitalAtualNpc, valorComponente, dividirPilha
} from './tab-state.js';
import { refCombate } from './tab-main.js';
import { VITAIS } from './tab-hud.js';
import { addObj } from './tab-objects.js';
import { screenToWorld } from './tab-render.js';
import { pontoVisivelAgora } from './tab-fog.js';
import { criarFilaDeEscrita } from './tab-write-queue.js';
import { escolherCondicao } from './tab-combat.js';
import { cenaAtiva, comCenaAtivaPatch } from '../../shared/combate-cenas.js';
import {
    ESTADO_EQUIP, FORMA_EQUIP, qtdDe, ehContainer, itensIdenticos, escolherQtd,
    tplDoItem as tplDoItemMotor, formulaDanoDoItem as formulaDanoMotor, fmtN,
    htmlInventario as htmlInvMotor, tratarClique as tratarCliqueInv, iniciarArrasto,
} from '../../shared/inventario-motor.js';

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
let _sys = null, _resolveMod = null;
async function carregarSys() {
    if (_sys) return _sys;
    const m = await import('../../painel-mestre/js/npc-system-data.js');
    _resolveMod = m.resolveNpcClassModule;
    _sys = await m.ensureNpcSystemData();
    return _sys;
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

// ===== Abertura / fechamento =====
export async function abrirFichaWin(tipo, id) {
    if (tipo === 'npc' && !(T.isMaster && T.mode === 'secret')) {
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
        render(win);
    }, e => console.warn('itens da janela de ficha', e));

    if (!_sys) carregarSys().then(() => renderTodas()).catch(e => console.warn('registros do sistema', e));
}

function fechar(win) {
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
function criarJanela(tipo, id, chave) {
    const el = document.createElement('div');
    el.className = 'tb-fwin';
    const mob = window.innerWidth < 700;
    const n = WINS.size;
    if (mob) {
        el.style.left = '3vw'; el.style.top = (64 + n * 26) + 'px';
        el.style.width = '94vw'; el.style.height = '72vh';
    } else {
        el.style.left = Math.min(96 + n * 34, window.innerWidth - 420) + 'px';
        el.style.top = Math.min(64 + n * 34, window.innerHeight - 300) + 'px';
    }
    el.innerHTML = `
        <div class="tb-fwin-head">
            <span class="tb-fwin-titulo"></span>
            <button class="tb-mini-btn" data-fechar title="Fechar">✕</button>
        </div>
        <div class="tb-fwin-abas">
            <button class="tb-fwin-aba ativa" data-aba="combate">⚔️ Combate</button>
            <button class="tb-fwin-aba" data-aba="inv">🎒 Inventário <span class="tb-fwin-inv-n"></span></button>
        </div>
        <div class="tb-fwin-body"></div>`;
    document.body.appendChild(el);

    const win = {
        el, tipo, id, chave, aba: 'combate', itens: null,
        abertos: new Set(),       // itens com o detalhe expandido
        contAbertos: new Set(),   // contêineres abertos
        pendente: false, unsubItems: null,
    };

    // Motor de inventário compartilhado com a Ficha de NPC do Painel do Mestre
    // (shared/inventario-motor.js): ele desenha e detecta o alvo do arrasto;
    // as escritas continuam aqui, no ritmo e nos docs do Tabuleiro.
    win.inv = {
        raiz: el,
        get itens() { return win.itens || []; },
        get sys() { return _sys; },
        abertos: win.abertos,
        contAbertos: win.contAbertos,
        idCanvas: 'tbCanvas',
        dica: 'arraste: equipar/desequipar entre seções · contêiner · pilha igual · mapa',
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

    // Arrastar pelo cabeçalho (mesmo padrão da janela de Combate)
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

    el.addEventListener('pointerdown', () => { if ([...WINS.values()].at(-1) !== win) focar(win); }, true);

    el.addEventListener('click', e => {
        if (e.target.closest('[data-fechar]')) { fechar(win); return; }
        const aba = e.target.closest('[data-aba]');
        if (aba) { win.aba = aba.dataset.aba; render(win); return; }
        const vd = e.target.closest('[data-vdelta]');
        if (vd) { setVital(win, vd.dataset.sig, valorVital(win, vd.dataset.sig).cur + Number(vd.dataset.vdelta)); return; }
        if (e.target.closest('[data-condadd]')) {
            escolherCondicao((nome, tpl) => addCondicao(win, nome, tpl));
            return;
        }
        const crm = e.target.closest('[data-condrm]');
        if (crm) { rmCondicao(win, Number(crm.dataset.condrm)); return; }
        tratarCliqueInv(win.inv, e);
    });

    el.addEventListener('input', e => {
        const t = e.target;
        if (t.matches('[data-vcur]')) { setVital(win, t.dataset.sig, parseFloat(String(t.value).replace(',', '.')) || 0); return; }
        if (t.matches('[data-pernivel]')) { setPericiaNpc(win, Number(t.dataset.pernivel), parseInt(t.value) || 0); return; }
        if (t.matches('[data-mod]') && t.type !== 'checkbox') { setCampoMod(win, t); return; }
    });
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
        const patch = patchVitalAtualNpc(n.valoresDer.atual, sig, v);
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

async function addCondicao(win, nome, tpl) {
    const lista = [...condicoesDoc(win), {
        nome: String(nome).trim(), icone: tpl?.icone || '☠️', descricao: tpl?.descricao || '',
        tempoAtual: '', tempoRestante: tpl?.duracao || '',
        modeloId: tpl?.id || null, efeitoMecanicaIds: tpl?.efeitoMecanicaIds || [],
    }];
    try {
        await updateDoc(doc(db, win.tipo === 'npc' ? 'npcs' : 'char', win.id), { conditions: lista });
        toast(`☠️ Condição "${esc(nome)}" aplicada na ficha`);
    } catch (e) { errWrite(e); }
}

async function rmCondicao(win, idx) {
    const lista = condicoesDoc(win).filter((_, i) => i !== idx);
    try { await updateDoc(doc(db, win.tipo === 'npc' ? 'npcs' : 'char', win.id), { conditions: lista }); }
    catch (e) { errWrite(e); }
}

function setQtd(win, itemId, delta) {
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
        partes = dadosNpc(win.id)?.partesDoCorpo || [];
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
            slots[k] = { label: qtd > 1 ? `${bp.nome} ${i + 1}` : bp.nome, icon: bp.icone || '🦴', partId: bp.id };
        }
    }
    return slots;
}

/** Picker de equipar — mesmas opções da ficha: slot anatômico + estado,
 *  desabilitando ocupado/não permitido; slots extras via EquipSlots. */
function abrirEquipar(win, itemId) {
    const item = (win.itens || []).find(x => x.id === itemId);
    if (!item || !_sys) return;
    const partes = partesDoCorpo(win);
    const slots = slotsDoCorpo(partes);
    const chaves = Object.keys(slots);
    if (!chaves.length) { toast('⚠️ A ficha não tem partes do corpo definidas', 'warning'); return; }

    const ES = window.EquipSlots;
    const ocupados = new Set((win.itens || []).filter(i => i.equipado && i.id !== itemId)
        .flatMap(i => ES ? ES.slotsDoItem(i) : [i.slotAnatomico]).filter(Boolean));
    const permitidas = Array.isArray(item.equipavelEm) && item.equipavelEm.length ? new Set(item.equipavelEm) : null;
    const optsSlot = chaves.map(k => {
        const s = slots[k];
        const bloq = permitidas && !permitidas.has(s.partId);
        const ocup = ocupados.has(k);
        return `<option value="${esc(k)}" ${bloq || ocup ? 'disabled' : ''}>${esc(s.icon)} ${esc(s.label)}${ocup ? ' (ocupado)' : ''}${bloq ? ' (não permitido)' : ''}</option>`;
    }).join('');
    const forma = item.formaEquipar;
    const optsEstado = Object.entries(ESTADO_EQUIP).map(([v, rot]) => {
        const [ic, f] = FORMA_EQUIP[v];
        const bloq = forma && f !== forma;
        return `<option value="${v}" ${bloq ? 'disabled' : ''} ${!bloq && forma ? 'selected' : ''}>${ic} ${rot}</option>`;
    }).join('');

    document.getElementById('tbFwinEquip')?.remove();
    const ov = document.createElement('div');
    ov.id = 'tbFwinEquip';
    ov.className = 'tb-cond-picker-overlay';
    ov.innerHTML = `<div class="tb-cond-picker" style="max-width:340px">
        <div class="tb-cond-picker-head"><span>🎽 Equipar: ${esc(item.nome || 'Item')}</span>
            <button class="tb-mini-btn" data-eqx title="Cancelar">✕</button></div>
        <div class="tb-fwin-equip-corpo">
            <div class="tb-form-grid tb-form-grid-1">
                <label>Slot anatômico<select id="tbEqSlot">${optsSlot}</select></label>
                <label>Estado<select id="tbEqEstado">${optsEstado}</select></label>
            </div>
            <div class="tb-modal-actions"><button class="tb-btn tb-btn-success" data-eqok>✅ Equipar</button></div>
        </div>
    </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', async e => {
        if (e.target === ov || e.target.closest('[data-eqx]')) { ov.remove(); return; }
        if (!e.target.closest('[data-eqok]')) return;
        const slot = document.getElementById('tbEqSlot')?.value;
        const estado = document.getElementById('tbEqEstado')?.value;
        if (!slot || !estado) return;
        // Arma de duas mãos e afins: reserva os slots extras ou recusa dizendo o que falta
        let extras = [];
        if (ES) {
            const plano = ES.planejarEquipar(item, slot, win.itens || [], slots, {
                catalog: _sys.equipment,
                labelParte: pid => partes.find(b => b.id === pid)?.nome || pid,
            });
            if (!plano.ok) { toast(`⚠️ "${esc(item.nome)}" precisa de slots livres: ${esc(plano.faltando.join(', '))}`, 'warning'); return; }
            extras = plano.extras;
        }
        try {
            await updateDoc(doc(db, 'items', itemId), {
                equipado: true, slotAnatomico: slot, slotsOcupados: extras,
                estadoEquip: estado, parentItemId: null,
            });
            ov.remove();
            toast(`🎽 ${esc(item.nome || 'Item')} equipado`);
        } catch (err) { errWrite(err); }
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
    const q = escolherQtd(a, `Juntar quantos "${a.nome || 'item'}" nesta pilha?`);
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
    if (ehContainer(i)) { toast('⚠️ Contêiner não entra em contêiner', 'warning'); return; }
    const q = escolherQtd(i, `Mover quantos "${i.nome || 'item'}" para ${c.nome || 'o contêiner'}?`);
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
    const q = cont ? qtdDe(i) : escolherQtd(i, `Dropar quantos "${i.nome || 'item'}" no mapa?`);
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

const chip = (icone, nome, valor, title) =>
    `<span class="tb-fwin-chip" title="${esc(title || nome)}">${icone ? esc(icone) + ' ' : ''}${esc(nome)} <b>${esc(String(valor))}</b></span>`;

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
function dvsVinculadosChar(ch) {
    const ids = new Set();
    const addIds = (lista) => (lista || []).forEach(x => {
        const id = (typeof x === 'object' && x) ? x.id : x;
        if (id) ids.add(id);
    });
    const addPecs = (lista) => (lista || []).forEach(p => {
        const pid = (typeof p === 'object' && p) ? p.id : p;
        addIds(_sys.pecsById?.[pid]?.derivedValueIds);
    });
    const norm = _sys.norm;
    const raca = ch.raca ? _sys.racesByNome?.[norm(ch.raca)] : null;
    const classe = ch.classe ? _sys.classesByNome?.[norm(ch.classe)] : null;
    const tribo = ch.tribo ? _sys.tribesByNome?.[norm(ch.tribo)] : null;
    addIds(raca?.derivedValueIds);
    addIds(classe?.derivedValueIds);
    addPecs(raca?.peculiaridadeIds);
    addPecs(classe?.bonusIniciais);       // a ficha soma bonusIniciais + peculiaridadeIds
    addPecs(classe?.peculiaridadeIds);
    addPecs(tribo?.peculiaridadeIds);
    addPecs(ch.peculiaridadesIndividuais);
    return ids;
}
const dvAplicaChar = (dv, vinc) => dv.todoPersonagem || vinc.has(dv.id);

/** VDs do personagem: SÓ os vinculados (regra da ficha), nos blocos do registro. */
function blocosChar(ch, vinc) {
    const dt = ch.derivedTotals || {};
    const { vitais } = idx();
    const blocos = new Map();
    const add = (nome, ordem, chipHtml) => {
        const b = blocos.get(nome) || { nome, ordem, chips: [] };
        b.ordem = Math.min(b.ordem, ordem);
        b.chips.push(chipHtml);
        blocos.set(nome, b);
    };
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
    return [...blocos.values()].sort((a, b) => a.ordem - b.ordem);
}

/** VDs do NPC (espelhos legados + overrides + extras), agrupados e SEM duplicar:
 *  extra "Iniciativa" não repete o chip que já veio do espelho INI. */
function blocosNpc(n) {
    const vd = n.valoresDer || {};
    const { porChave, vitais } = idx();
    const blocos = new Map();
    const add = (nome, ordem, chipHtml) => {
        const b = blocos.get(nome) || { nome, ordem, chips: [] };
        b.ordem = Math.min(b.ordem, ordem);
        b.chips.push(chipHtml);
        blocos.set(nome, b);
    };
    const vistos = new Set(['VITALIDADE', 'ENERGIA', 'SANIDADE']);
    for (const [sig, rot, icone] of [['PERC', 'Percepção', '👁️'], ['INI', 'Iniciativa', '⚡'], ['REA', 'Reação', '🌀'], ['BLD', 'Blindagem', '🛡️']]) {
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
    return [...blocos.values()].sort((a, b) => a.ordem - b.ordem);
}

/* ---- ⚔️ Ataques ---- */
const tplDoItem = (i) => tplDoItemMotor(i, _sys);
const formulaDanoDoItem = (i) => formulaDanoMotor(i, _sys);

/** Valor de um VD do registro na ficha do NPC (overrides → espelho legado → extras). */
function valorVdNpc(n, dv) {
    const vd = n.valoresDer || {};
    const chave = normChave(dv.nome);
    for (const k of [chave, dv.key, dv.id]) {
        const v = vd.overrides?.[k];
        if (v != null && v !== '') return Number(v);
    }
    const legada = { PERCEPCAO: 'PERC', INICIATIVA: 'INI', REACAO: 'REA', BLINDAGEM: 'BLD' }[chave];
    if (legada && vd[legada] != null && vd[legada] !== '') return Number(vd[legada]);
    for (const x of vd.extras || []) {
        if (normChave(x.nome) === chave) { const v = parseFloat(x.valor); if (!isNaN(v)) return v; }
    }
    return null;
}

/** Linhas de golpe: acerto (VDs de coluna), dano composto e canais de Essência. */
function htmlAtaques(win, fonte, vincChar) {
    const valorDV = win.tipo === 'npc'
        ? (dv) => valorVdNpc(fonte, dv)
        : (dv) => {
            if (!dvAplicaChar(dv, vincChar)) return null;   // golpe só soma VD vinculado
            const v = (fonte.derivedTotals || {})[normChave(dv.nome)];
            return v == null ? null : Number(v);
        };
    const colunas = _sys.derivedValues.filter(d => d.escopoItem === 'coluna')
        .map(d => ({ d, v: valorDV(d) })).filter(x => x.v != null);
    const somaDano = _sys.derivedValues.filter(d => d.escopoItem === 'dano')
        .reduce((s, d) => s + (Number(valorDV(d)) || 0), 0);
    const canais = _sys.derivedValues.filter(d => d.escopoItem === 'dano-canal')
        .map(d => ({ d, v: valorDV(d) })).filter(x => x.v);
    const compor = (formula) => {
        const s = fmtN(somaDano);
        return (formula && s) ? `${formula}${s > 0 ? '+' : ''}${s}` : formula;
    };
    const chipsCol = colunas.map(x =>
        `<span class="tb-fwin-canal" title="${esc(x.d.nome)}">${esc(x.d.icone || '🎯')} ${esc(x.d.nome)} <b>${fmtDV(x.v, x.d)}</b></span>`).join('');

    const armas = (win.itens || []).filter(i => i.tipo === 'Arma' || (i.equipado && formulaDanoDoItem(i)));
    armas.sort((a, b) => (b.equipado === true) - (a.equipado === true));
    const linhas = armas.map(i => {
        const f = formulaDanoDoItem(i);
        return `<div class="tb-fwin-atk ${i.equipado ? 'eq' : ''}">
            <span class="tb-fwin-atk-nome">${i.equipado ? '✊ ' : ''}${esc(i.nome || 'Arma')}</span>
            ${chipsCol}
            <b class="tb-fwin-atk-dano" title="Fórmula de dano">💥 ${esc(f ? compor(f) : '—')}</b>
            ${canais.map(c => `<span class="tb-fwin-canal" title="${esc(c.d.nome)}">${esc(c.d.icone || '💥')}${fmtN(c.v)}</span>`).join('')}
        </div>`;
    }).join('');

    const texto = win.tipo === 'npc' && fonte.ataques ? `<div class="tb-fwin-pre">${esc(fonte.ataques)}</div>` : '';
    return linhas + texto;
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
function htmlCombateNpc(win, n) {
    if (!_sys) return CARREGANDO;

    const atrs = ATRIBUTOS.map(([sig, rot]) =>
        `<div class="tb-fwin-atr" title="${rot}"><span>${sig}</span><b>${fmtN(n.atributos?.[sig] ?? 0)}</b></div>`).join('');
    const pers = (n.periciasEstruturadas || []).map((ps, i) => {
        const s = _sys.skills.find(x => x.id === ps.refId);
        return s ? { idx: i, nome: s.nome, desc: s.descricao, nivel: ps.nivel || 0 } : null;
    }).filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome));
    let periciasHtml = pers.map(p => `<div class="tb-fwin-per" title="${esc(p.desc || p.nome)}">
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

    return secaoValores(blocosNpc(n))
        + detalhe('⚔️ Ataques', htmlAtaques(win, n), true)
        + detalhe('📦 Habilidades & Módulos', htmlModulos(win, n), true)
        + detalhe('💪 Atributos', atrs ? `<div class="tb-fwin-atrs">${atrs}</div>` : '')
        + detalhe('🎯 Perícias', periciasHtml)
        + detalhe('🧬 Peculiaridades', pecs ? `<div class="tb-fwin-chips">${pecs}</div>` : '');
}

function htmlCombateChar(win, ch) {
    if (!_sys) return CARREGANDO;

    const atrs = ATRIBUTOS.map(([sig, rot]) =>
        `<div class="tb-fwin-atr" title="${rot}"><span>${sig}</span><b>${fmtN(ch.dots?.['attr_' + sig.toLowerCase()] ?? 0)}</b></div>`).join('');

    // Perícias: registro resolvido contra os dots da ficha (mesma régua dos 🎯 Testes)
    const pers = _sys.skills.map(s => ({ s, v: valorComponente(s.nome, { dots: ch.dots }) }))
        .filter(x => x.v != null && x.v > 0)
        .sort((a, b) => (a.s.nome || '').localeCompare(b.s.nome || ''));
    const periciasHtml = pers.map(x => `<div class="tb-fwin-per" title="${esc(x.s.descricao || x.s.nome)}">
            <span>${esc(x.s.nome)}</span><b>${fmtN(x.v)}</b>
        </div>`).join('');

    const vinc = dvsVinculadosChar(ch);
    return secaoValores(blocosChar(ch, vinc))
        + detalhe('⚔️ Ataques', htmlAtaques(win, ch, vinc), true)
        + detalhe('📦 Habilidades & Módulos', htmlModulos(win, ch), true)
        + detalhe('💪 Atributos', atrs ? `<div class="tb-fwin-atrs">${atrs}</div>` : '')
        + detalhe('🎯 Perícias', periciasHtml);
}

/* ---- Aba Inventário ----
   Toda a lista (linhas, contêineres, pilhas, detalhe e arrasto) vem do motor
   compartilhado; aqui só se diz de onde vêm os itens e o que cada ação grava. */
function htmlInventario(win) {
    if (!win.itens) return '<div class="tb-muted" style="padding:14px;text-align:center">⏳ Carregando itens…</div>';
    win._slots = null;   // anatomia recalculada uma vez por repinte
    return htmlInvMotor(win.inv);
}
