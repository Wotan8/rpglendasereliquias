/* ===== 🎲 A JANELA DE SORTEIO DAS DÁDIVAS =====
 *
 * Módulo próprio porque é só DOM e não sabe de cena, token nem Firestore — o
 * que permite abrir a janela de verdade no arnês __check-dadiva-sorteio.html
 * em vez de conferir uma cópia do markup.
 *
 * Depende de três globais que o Tabuleiro fornece: `_tbAbrirModal`,
 * `tbFecharModal` e `toast`.
 */
import { candidatoDoDado, rolarSorteio } from '../../shared/dadiva.js?v=3';

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * 🎲 A JANELA DE SORTEIO DAS DÁDIVAS — quem incorpora recebe as nove, e cada
 * uma rola o seu dado.
 *
 * O Mestre digita o que os dados FÍSICOS deram, ou manda o sistema rolar. As
 * duas saídas passam pelo mesmo `rolarSorteio`, então mesa e sistema não
 * divergem.
 *
 * Cada linha tem `n+1` saídas: os n candidatos e o NENHUM, que é sempre a
 * última. Face acima do nenhum a mesa manda rerrolar, e o campo recusa — é
 * melhor pedir outra rolagem do que aceitar um número que a regra não tem.
 *
 * Campo em branco NÃO vira nenhum em silêncio: ao aplicar, o que estiver vazio
 * é rolado na hora. Anular uma Dádiva é resultado de dado, nunca de descuido.
 *
 * @returns objeto { [nome da categoria]: face } ou null se cancelar
 */
export function janelaDeSorteio(hospede, linhas, modo) {
    const idDe = (i) => `dad_${i}`;
    return new Promise(resolve => {
        const limpar = () => { delete window.__tbDadOk; delete window.__tbDadCancel; delete window.__tbDadRolar; };
        window.__tbDadRolar = (i) => {
            const alvo = i == null ? linhas.map((_, k) => k) : [Number(i)];
            for (const k of alvo) {
                const el = document.getElementById(idDe(k));
                if (el) el.value = rolarSorteio(linhas[k].candidatos.length);
            }
        };
        window.__tbDadOk = () => {
            const escolhas = {};
            for (let k = 0; k < linhas.length; k++) {
                const l = linhas[k];
                const el = document.getElementById(idDe(k));
                let v = parseInt(el?.value, 10);
                if (!Number.isFinite(v)) v = rolarSorteio(l.candidatos.length);   // vazio: rola agora
                if (v < 1 || v > l.dado.nenhumEm) {
                    window.toast?.(`⚠️ ${l.categoria}: ${v} rerrola — vale de 1 a ${l.dado.nenhumEm}`, 'warning');
                    if (el) el.focus();
                    return;
                }
                escolhas[l.categoria] = v;
            }
            limpar(); window.tbFecharModal(); resolve(escolhas);
        };
        window.__tbDadCancel = () => { limpar(); window.tbFecharModal(); resolve(null); };

        const corpo = linhas.map((l, k) => {
            const d = l.dado;
            const legenda = l.candidatos.map(c => `<b>${c.n}</b> ${esc(c.nome)}`).join(' · ')
                + ` · <b>${d.nenhumEm}</b> <span style="opacity:.75">nenhum</span>`;
            return `<div style="display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-top:1px solid rgba(255,255,255,.08)">
                <div style="flex:1;min-width:0">
                    <div><span>${l.icone}</span> <b>${esc(l.categoria)}</b>
                        <span class="tb-muted" style="font-size:.78rem">${d.rotulo}${d.rerrolaAcimaDe ? ` · rerrola acima de ${d.rerrolaAcimaDe}` : ''}</span></div>
                    <div class="tb-muted" style="font-size:.76rem;line-height:1.45">${legenda}</div>
                </div>
                <input type="number" id="${idDe(k)}" min="1" max="${d.nenhumEm}" step="1"
                       style="width:62px;text-align:center" placeholder="?">
                <button class="tb-btn tb-btn-small" title="Rolar só esta" onclick="__tbDadRolar(${k})">🎲</button>
            </div>`;
        }).join('');

        window._tbAbrirModal(`🎲 Dádivas de ${esc(hospede.nome || 'hóspede')}`, `
            <div class="tb-muted" style="font-size:.8rem;margin-bottom:8px">
                ${modo === 'projetor'
                ? 'A projeção não leva as Dádivas, mas a entrega mede o custo em Sanidade — role assim mesmo.'
                : 'Cada Dádiva rola o seu dado. A última face é <b>nenhum</b>: a sorte pode anular.'}
                Digite o que os dados de mesa deram, ou role aqui. Campo em branco é rolado ao aplicar.
            </div>
            ${corpo || '<div class="tb-muted">Este hóspede não tem nada a sortear.</div>'}
            <div class="tb-modal-actions">
                <button class="tb-btn" onclick="__tbDadRolar()">🎲 Rolar tudo</button>
                <button class="tb-btn tb-btn-success" onclick="__tbDadOk()">✅ Aplicar</button>
                <button class="tb-btn" onclick="__tbDadCancel()">✖ Cancelar</button>
            </div>`);
    });
}

/** Traduz o que a janela devolveu no `sorteio` que o motor da Dádiva espera. */
export const sorteioDoMestre = (escolhas) => (candidatos, cat) =>
    candidatoDoDado(candidatos, escolhas?.[cat?.nome]);

/**
 * 🌫️ ATÉ QUE VÉU — só para o Projetor.
 *
 * A projeção não leva Dádiva; o que ela cobra é o Poder do hóspede mais a
 * profundidade da camada. Quanto mais fundo, menos o lugar se parece com um
 * lugar, e é isso que a Sanidade paga.
 *
 * As exigências (Transcendência 3+ para o Etérico, Eco que transcendeu para o
 * Astral) aparecem escritas, mas NÃO são travadas aqui: quem julga requisito de
 * ficha é o Mestre, e inventar a trava seria inventar regra.
 *
 * @returns 'material' | 'eterico' | 'astral', ou null se cancelar
 */
export function janelaDoVeu(hospede, custoDe, alvoBase) {
    const OPCOES = [
        ['material', '🌍 Véu Material', 'O mundo físico. O Eco anda por onde os vivos andam.'],
        ['eterico', '🌫️ Véu Etérico', 'A camada entre o físico e o espiritual. Exige Transcendência 3+.'],
        ['astral', '✨ Véu Astral', 'A camada profunda dos Ecos Ancestrais. Exige um Eco que tenha transcendido.'],
    ];
    return new Promise(resolve => {
        const limpar = () => { delete window.__tbVeuOk; delete window.__tbVeuCancel; };
        window.__tbVeuOk = (v) => { limpar(); window.tbFecharModal(); resolve(v); };
        window.__tbVeuCancel = () => { limpar(); window.tbFecharModal(); resolve(null); };
        window._tbAbrirModal(`🌫️ Projetar-se em ${esc(hospede.nome || 'hóspede')} — até onde?`, `
            <div class="tb-muted" style="font-size:.8rem;margin-bottom:10px">
                A projeção não recebe Dádiva. Ela cobra <b>Sanidade</b> pelo Poder do hóspede
                (${custoDe('material').poder}) e pela camada, e a camada ainda põe <b>Redutor</b>
                no teste de Transcendência (Projetor).${alvoBase != null ? ` Alvo dele hoje: <b>${alvoBase}</b>.` : ''}
            </div>
            ${OPCOES.map(([chave, titulo, nota]) => {
            const c = custoDe(chave);
            return `<button class="tb-btn tb-btn-small" style="display:block;width:100%;margin-bottom:6px;text-align:left"
                        onclick="__tbVeuOk('${chave}')">
                        <b>${titulo}</b> — <b>−${c.sanidade} Sanidade</b>${c.redutor
                ? ` · <b>Redutor ${c.redutor}</b>${alvoBase != null ? ` <span style="opacity:.7">(Alvo ${alvoBase - c.redutor})</span>` : ''}`
                : ' · <span style="opacity:.7">sem Redutor</span>'}
                        <div class="tb-muted" style="font-size:.76rem;font-weight:400">${nota}</div>
                    </button>`;
        }).join('')}
            <div class="tb-modal-actions">
                <button class="tb-btn" onclick="__tbVeuCancel()">✖ Cancelar</button>
            </div>`);
    });
}
