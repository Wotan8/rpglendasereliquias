// =============================================
// ÁREA MESAS — Preferências de tela do mestre
// ---------------------------------------------
// Três coisas, todas locais ao navegador (nenhuma vai para o Firestore — é
// preferência de tela de quem está sentado aqui, não dado de campanha):
//   1. qual sub-aba abre sozinha, a partir da FASE da sessão
//   2. quais sub-abas aparecem, e em que ordem dentro do grupo
//   3. densidade (compacto / confortável)
// =============================================
import { db, collection, getDocs, query, where, limit } from './firebase-config.js';
import * as S from './state.js';

const CHAVE = 'lr_mesa_prefs';

// { densidade: 'confortavel'|'compacto', ocultas: {mesaId:[subtab]}, ordem: {mesaId:[subtab]} }
function lerPrefs() {
    try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { return {}; }
}
function gravarPrefs(p) {
    try { localStorage.setItem(CHAVE, JSON.stringify(p)); } catch (e) { /* modo privado: só não persiste */ }
}

const todasAsAbas = () =>
    [...document.querySelectorAll('#mesaSubTabs .sub-tab-btn')].map(b => b.dataset.subtab);

const rotuloDaAba = id =>
    document.querySelector(`#mesaSubTabs [data-subtab="${id}"]`)?.textContent.trim() || id;

// ===== 1. QUAL ABA ABRE =====
/**
 * A sessão já sabe em que ponto do ciclo a mesa está (`fase: preparo → aoVivo
 * → fechada`), mas ninguém lia isso para navegar: o painel abria SEMPRE em
 * Jogadores, a aba mais administrativa que existe. Uma leitura por entrada de
 * mesa resolve.
 */
export async function abaInicialDaMesa(mesaId) {
    let alvo = 'm-frentes';   // sem sessão aberta, o trabalho é preparar a próxima
    try {
        const snap = await getDocs(query(
            collection(db, 'mesas', mesaId, 'sessoes'),
            where('fase', 'in', ['preparo', 'aoVivo']),
            limit(1)
        ));
        if (!snap.empty) alvo = 'm-sessao';
    } catch (e) { /* offline ou sem permissão: cai no alvo padrão */ }

    // O mestre pode ter escondido justamente essa aba — nesse caso abre na
    // primeira que ele deixou visível, nunca numa aba oculta.
    const ocultas = lerPrefs().ocultas?.[mesaId] || [];
    if (!ocultas.includes(alvo)) return alvo;
    return todasAsAbas().find(a => !ocultas.includes(a)) || alvo;
}

// ===== 2. QUAIS ABAS APARECEM, E EM QUE ORDEM =====
export function aplicarAbas(mesaId) {
    const p = lerPrefs();
    const ocultas = p.ocultas?.[mesaId] || [];
    const ordem = p.ordem?.[mesaId] || [];

    document.querySelectorAll('#mesaSubTabs .sub-tab-btn').forEach(b => {
        b.hidden = ocultas.includes(b.dataset.subtab);
    });

    // Reordenar é mover dentro do PRÓPRIO grupo: a ordem entre grupos carrega
    // o significado (o que é da sessão, o que é da campanha, o que é da mesa)
    // e não é do mestre desmanchar sem querer.
    document.querySelectorAll('#mesaSubTabs .sub-tabs').forEach(grupo => {
        [...grupo.children]
            .filter(b => ordem.includes(b.dataset.subtab))
            .sort((a, b) => ordem.indexOf(a.dataset.subtab) - ordem.indexOf(b.dataset.subtab))
            .forEach(b => grupo.appendChild(b));
    });
}

function montarConfigAbas(mesaId) {
    const cx = document.getElementById('mesaAbasConfig');
    if (!cx) return;
    const ocultas = lerPrefs().ocultas?.[mesaId] || [];
    cx.innerHTML = '<div class="mesa-abas-config-titulo">Sub-abas visíveis</div>' +
        [...document.querySelectorAll('#mesaSubTabs .sub-tabs')].map(grupo =>
            [...grupo.children].map(b => {
                const id = b.dataset.subtab;
                return `<label><input type="checkbox" data-aba="${id}"${ocultas.includes(id) ? '' : ' checked'}>
                    <span style="flex:1">${rotuloDaAba(id)}</span>
                    <button class="mesa-ajuste-btn" data-mover="${id}" data-dir="-1" title="Subir no grupo">↑</button>
                    <button class="mesa-ajuste-btn" data-mover="${id}" data-dir="1" title="Descer no grupo">↓</button>
                </label>`;
            }).join('')
        ).join('');

    cx.querySelectorAll('input[data-aba]').forEach(inp => {
        inp.onchange = () => {
            const p = lerPrefs();
            p.ocultas = p.ocultas || {};
            const lista = new Set(p.ocultas[mesaId] || []);
            inp.checked ? lista.delete(inp.dataset.aba) : lista.add(inp.dataset.aba);
            // Nunca deixar a barra inteira vazia — sem aba nenhuma o mestre
            // perde o acesso a tudo e não sobra nem por onde desfazer.
            if (lista.size >= todasAsAbas().length) { lista.delete(inp.dataset.aba); inp.checked = true; return; }
            p.ocultas[mesaId] = [...lista];
            gravarPrefs(p);
            aplicarAbas(mesaId);
        };
    });

    cx.querySelectorAll('button[data-mover]').forEach(btn => {
        btn.onclick = (ev) => {
            ev.preventDefault();
            const id = btn.dataset.mover, dir = +btn.dataset.dir;
            const grupo = document.querySelector(`#mesaSubTabs [data-subtab="${id}"]`)?.parentElement;
            if (!grupo) return;
            const irmaos = [...grupo.children].map(b => b.dataset.subtab);
            const i = irmaos.indexOf(id), j = i + dir;
            if (j < 0 || j >= irmaos.length) return;
            [irmaos[i], irmaos[j]] = [irmaos[j], irmaos[i]];
            const p = lerPrefs();
            p.ordem = p.ordem || {};
            // Guarda a ordem dos OUTROS grupos junto, senão mover num grupo
            // apagaria o que já tinha sido ajustado nos demais.
            p.ordem[mesaId] = [...new Set([...irmaos, ...(p.ordem[mesaId] || [])])];
            gravarPrefs(p);
            aplicarAbas(mesaId);
            montarConfigAbas(mesaId);
        };
    });
}

window.mesaAlternarConfigAbas = function () {
    const cx = document.getElementById('mesaAbasConfig');
    if (!cx) return;
    const abrindo = !cx.classList.contains('open');
    if (abrindo) montarConfigAbas(S.currentMesaId);
    cx.classList.toggle('open', abrindo);
    document.getElementById('btnMesaAbas')?.classList.toggle('active', abrindo);
    if (abrindo) {
        setTimeout(() => document.addEventListener('pointerdown', function fecha(ev) {
            if (cx.contains(ev.target) || ev.target.closest('#btnMesaAbas')) return;
            cx.classList.remove('open');
            document.getElementById('btnMesaAbas')?.classList.remove('active');
            document.removeEventListener('pointerdown', fecha);
        }), 0);
    }
};

// ===== 3. DENSIDADE =====
export function aplicarDensidade() {
    const d = lerPrefs().densidade === 'compacto' ? 'compacto' : 'confortavel';
    const alvo = document.getElementById('mesa-content');
    if (alvo) {
        alvo.classList.toggle('mesa-densidade-compacto', d === 'compacto');
        alvo.classList.toggle('mesa-densidade-confortavel', d !== 'compacto');
    }
    const btn = document.getElementById('btnMesaDensidade');
    if (btn) {
        btn.textContent = d === 'compacto' ? '▤ Compacto' : '▤ Confortável';
        btn.classList.toggle('active', d === 'compacto');
    }
}

window.mesaAlternarDensidade = function () {
    const p = lerPrefs();
    p.densidade = p.densidade === 'compacto' ? 'confortavel' : 'compacto';
    gravarPrefs(p);
    aplicarDensidade();
};

// ===== SELOS =====
/**
 * Um número na aba de Combate quando há gente no combate. É o único aviso que
 * atravessa aba: o mestre precisa saber que tem combate rolando sem ter de ir
 * conferir. Chamado por `renderCombatList` (combat.js), que é por onde toda
 * mudança de combate passa.
 */
window._mesaAtualizarSelos = function () {
    const b = document.querySelector('#mesaSubTabs [data-subtab="m-combate"]');
    if (!b) return;
    const n = (S.combatParticipants || []).length;
    if (n) b.dataset.selo = n; else delete b.dataset.selo;
};

/** Chamado uma vez ao abrir uma mesa. */
export async function initPrefsDaMesa(mesaId) {
    aplicarAbas(mesaId);
    aplicarDensidade();
    window._mesaAtualizarSelos();
    return abaInicialDaMesa(mesaId);
}
