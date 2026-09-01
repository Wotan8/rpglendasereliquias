/* =====================================================================
   🔖 VERSÃO DE CÂNONE — a escada decimal, num lugar só
   ---------------------------------------------------------------------
   A regra está escrita por extenso no CLAUDE.md do projeto ("Versionamento
   de cânone"). Aqui mora a aritmética dela, para que a tela, o script de
   migração e a IA que edita direto contem do mesmo jeito.

       1.02 → 1.03 → … → 1.98 → 1.99 → 2.00

   O incremento é de UM CENTÉSIMO, sempre. A casa inteira só vira quando a
   decimal estoura — nunca por "essa mudança foi grande". Quem quiser marcar
   uma virada de era digita a versão à mão; só o criador decide pular.

   O campo é texto livre no banco. Isso é de propósito: "Ed. revista" e
   "3 — revisão de combate" são versões válidas que um autor escreve. O que
   NÃO dá é adivinhar a próxima delas — e é isso que `proximaVersao`
   devolve `null` para dizer, em vez de inventar um número.
   ===================================================================== */

/** `1.02` → `{ inteiro: 1, centesimos: 2 }`. `null` se não for da escada. */
export function partesDaVersao(v) {
    const m = String(v ?? '').trim().match(/^(\d+)[.,](\d{1,2})$/);
    if (m) return { inteiro: +m[1], centesimos: +m[2].padEnd(2, '0') };
    // "3" sozinho é a casa inteira sem decimal — vale, e vira 3.00.
    const so = String(v ?? '').trim().match(/^(\d+)$/);
    return so ? { inteiro: +so[1], centesimos: 0 } : null;
}

/** Formata sempre com duas casas: 1.3 nunca aparece, 1.30 sim. */
export function formatarVersao(inteiro, centesimos) {
    return `${inteiro}.${String(centesimos).padStart(2, '0')}`;
}

/**
 * A próxima da escada.
 *
 *   ''      → '1.00'   (primeira gravação)
 *   '1.02'  → '1.03'
 *   '1.99'  → '2.00'   (a decimal estourou — SÓ aqui a casa inteira vira)
 *   '2'     → '2.01'
 *   'Ed. revista' → null (não dá para adivinhar; quem chama pergunta)
 */
export function proximaVersao(atual) {
    const bruta = String(atual ?? '').trim();
    if (!bruta) return '1.00';
    const p = partesDaVersao(bruta);
    if (!p) return null;
    return p.centesimos >= 99
        ? formatarVersao(p.inteiro + 1, 0)
        : formatarVersao(p.inteiro, p.centesimos + 1);
}

/**
 * As duas versões são a mesma coisa? Compara pela escada quando as duas
 * estão nela ('1.2' e '1.20' são a mesma), e por texto quando não estão —
 * senão 'Ed. revista' nunca seria igual a si mesma.
 */
export function mesmaVersao(a, b) {
    const pa = partesDaVersao(a), pb = partesDaVersao(b);
    if (pa && pb) return pa.inteiro === pb.inteiro && pa.centesimos === pb.centesimos;
    return String(a ?? '').trim() === String(b ?? '').trim();
}
