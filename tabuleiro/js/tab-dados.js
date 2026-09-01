// =============================================
// TABULEIRO — Rolador de Dados (sincronizado com a mesa)
// Todo mundo rola; o resultado aparece em toast para a mesa inteira.
// Fonte: mesas/{id}/tabuleiro-meta/dados { ultimo } — 1 write por rolagem
// (ação explícita, sem throttle; mesmo padrão do ping).
// O histórico é local da sessão: guardar rolagem velha no doc seria write à toa.
// =============================================
import { db, doc, getDoc, setDoc, onSnapshot,
    functions, httpsCallable } from '../../painel-mestre/js/firebase-config.js';
import { T, esc, toast, uid } from './tab-state.js';
import { abrirModal } from './tab-main.js';
import { logChat } from './tab-chat.js';

const refDados = () => doc(db, 'mesas', T.mesaId, 'tabuleiro-meta', 'dados');
const JANELA = uid();          // esta aba já mostrou a própria rolagem na hora
const FACES = [4, 6, 8, 10, 12, 20, 100];
const historico = [];          // últimas rolagens vistas nesta sessão (mais nova primeiro)

export function initDados() {
    T.unsubs.push(onSnapshot(refDados(), s => {
        const r = s.exists() ? s.data().ultimo : null;
        if (!r || !r.t || Date.now() - r.t > 15000) return;   // rolagem velha (reload) não re-anuncia
        if (r.janela === JANELA) return;
        registrar(r);
        toast(msgRolagem(r));
    }, e => console.warn('dados', e)));
}

function registrar(r) {
    historico.unshift(r);
    if (historico.length > 30) historico.pop();
    const el = document.getElementById('tbDadosHist');
    if (el) el.innerHTML = histHtml();
}

/** Texto puro: o toast usa textContent; o histórico escapa com esc(). */
function msgRolagem(r) {
    const mod = r.mod ? (r.mod > 0 ? ` + ${r.mod}` : ` − ${Math.abs(r.mod)}`) : '';
    return `${r.reroll ? '🔁' : '🎲'} ${r.nome} ${r.reroll ? 're-rolou' : 'rolou'} ${r.qtd}d${r.faces}${mod}: [${r.dados.join(', ')}]${mod} = ${r.total}`;
}

// ===== RE-ROLAGENS =====
// O saldo mora em `users/{doc}.rerolagens` e só o servidor escreve nele. Aqui
// só se lê para mostrar, e se gasta pela callable.
let saldoReroll = null;      // null = ainda não li
let ultimaMinha = null;      // a última rolagem FEITA nesta janela

/** O doc do jogador é `users/{uid}`. A busca pelos campos `uid`/`email` saiu:
    eram campos graváveis pelo dono, e aqui se lê saldo de re-rolagem. */
async function meuDocUsuario() {
    const u = T.user;
    if (!u) return null;
    const s = await getDoc(doc(db, 'users', u.uid));
    return s.exists() ? s : null;
}

async function carregarSaldoReroll() {
    try {
        const d = await meuDocUsuario();
        saldoReroll = d ? (d.data().rerolagens || 0) : 0;
    } catch (e) { console.warn('rerolagens', e); saldoReroll = 0; }
    pintarReroll();
}

function pintarReroll() {
    const el = document.getElementById('tbRerollBox');
    if (el) el.innerHTML = rerollHtml();
}

function rerollHtml() {
    if (saldoReroll === null) return '<span class="tb-muted">carregando re-rolagens…</span>';
    if (saldoReroll < 1) {
        return '<span class="tb-muted">Sem re-rolagens. Compre na Loja do Portal para poder rolar de novo.</span>';
    }
    const alvo = ultimaMinha
        ? `re-rolar ${ultimaMinha.qtd}d${ultimaMinha.faces}`
        : 'anunciar na mesa (você rola o teste onde ele estiver)';
    return `<button class="tb-btn tb-btn-small tb-btn-primary" id="tbRerollBtn" onclick="tbUsarRerolagem()"
                title="Gasta 1 re-rolagem e ${esc(alvo)}">🔁 Usar re-rolagem (${saldoReroll})</button>
            <span class="tb-muted" style="font-size:.72rem">${esc(alvo)}</span>`;
}

/**
 * Gasta UMA re-rolagem. Se esta janela já rolou algo, re-rola o mesmo dado; se
 * não, só cobra e anuncia — assim a re-rolagem serve para QUALQUER teste da
 * mesa (Acerto, Dano, perícia, dado físico), sem o rolador precisar saber deles.
 * ponytail: o débito é do servidor, mas quem confere se o teste cabia
 * re-rolagem é o mestre lendo o anúncio no chat. Automatizar isso exigiria
 * enfiar o saldo dentro do motor de conflito — não vale o acoplamento.
 */
window.tbUsarRerolagem = async function() {
    const btn = document.getElementById('tbRerollBtn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ gastando…'; }
    try {
        const gastar = httpsCallable(functions, 'gastarRerolagem');
        const r = await gastar({
            mesaId: T.mesaId,
            motivo: ultimaMinha ? `${ultimaMinha.qtd}d${ultimaMinha.faces}` : 'teste da mesa',
        });
        saldoReroll = r.data.restantes;
    } catch (e) {
        toast('❌ ' + (e.message || 'A re-rolagem não foi cobrada'), 'danger');
        pintarReroll();
        return;
    }
    if (ultimaMinha) {
        await rolar(ultimaMinha.faces, { reroll: true, qtd: ultimaMinha.qtd, mod: ultimaMinha.mod });
    } else {
        const nome = meuNome();
        toast(`🔁 Re-rolagem gasta — restam ${saldoReroll}`);
        logChat(`🔁 ${nome} gastou 1 re-rolagem (restam ${saldoReroll}) para rolar de novo`);
    }
    pintarReroll();
};

const meuNome = () => T.isMaster ? 'Mestre' : (T.usersMap[T.user?.uid]?.nome || 'Jogador');

window.tbRolarDado = function(faces) { return rolar(faces); };

async function rolar(faces, opts = {}) {
    // A re-rolagem repete o dado que ela pagou, e não o que estiver no campo
    // agora: a janela continua aberta e o jogador pode ter mexido no número.
    const qtd = opts.qtd ?? Math.max(1, Math.min(20, parseInt(document.getElementById('dd_qtd')?.value) || 1));
    const mod = opts.mod ?? (parseInt(document.getElementById('dd_mod')?.value) || 0);
    const secreta = !!document.getElementById('dd_secreta')?.checked;
    const dados = Array.from({ length: qtd }, () => 1 + Math.floor(Math.random() * faces));
    const nome = meuNome();
    const r = {
        id: uid(), nome: secreta ? nome + ' (secreta)' : nome,
        qtd, faces, mod, dados,
        total: dados.reduce((a, b) => a + b, 0) + mod,
        t: Date.now(), janela: JANELA,
        ...(opts.reroll ? { reroll: true } : {}),
    };
    ultimaMinha = r;
    registrar(r);
    pintarReroll();   // o botão passa a oferecer re-rolar ESTE dado
    toast(msgRolagem(r) + (secreta ? ' 🤫' : ''));
    if (!secreta) {
        logChat(msgRolagem(r));   // fica no diário do canvas
        try { await setDoc(refDados(), { ultimo: r }, { merge: true }); }
        catch (e) { console.error(e); toast('❌ A rolagem não chegou na mesa', 'danger'); }
    }
}

function histHtml() {
    if (!historico.length) return '<div class="tb-muted" style="text-align:center;padding:10px">Nenhuma rolagem ainda nesta sessão.</div>';
    return historico.map(r => `<div class="tb-list-row" style="gap:8px">
        <span style="flex:1;min-width:0">${esc(msgRolagem(r))}</span>
        <span class="tb-muted" style="font-size:.7rem;flex:none">${new Date(r.t).toLocaleTimeString().slice(0, 5)}</span>
    </div>`).join('');
}

window.tbAbrirDados = function() {
    abrirModal('🎲 Rolador de Dados', `
        <div class="tb-form-grid">
            <label>Quantidade<input type="number" id="dd_qtd" value="1" min="1" max="20"></label>
            <label>Modificador<input type="number" id="dd_mod" value="0"></label>
        </div>
        ${T.mode === 'secret' ? `<label class="tb-check" style="margin-top:6px"><input type="checkbox" id="dd_secreta"> 🤫 Rolagem secreta (só você vê)</label>` : ''}
        <div class="tb-subrow" style="margin-top:10px;flex-wrap:wrap">
            ${FACES.map(f => `<button class="tb-btn tb-btn-small" onclick="tbRolarDado(${f})" title="Rolar ${f} faces">🎲 d${f}</button>`).join('')}
        </div>
        <div class="tb-muted" style="font-size:.75rem;margin-top:6px">📡 O resultado aparece para a mesa toda.</div>
        <div class="tb-subrow" id="tbRerollBox" style="margin-top:8px;align-items:center;gap:8px;flex-wrap:wrap">${rerollHtml()}</div>
        <hr class="tb-hr">
        <div class="tb-section-title">🕘 Rolagens da sessão</div>
        <div class="tb-list" id="tbDadosHist" style="max-height:240px;overflow:auto">${histHtml()}</div>
    `);
    // O saldo é lido ao abrir: uma leitura por abertura, e o resto da sessão
    // ele vem de graça na resposta da própria callable.
    if (saldoReroll === null) carregarSaldoReroll(); else pintarReroll();
};
