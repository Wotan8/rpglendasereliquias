/* Extratores compartilhados do passo 7 — importados por 7b. */
export function extrairArea(txt) {
    const s = String(txt || '');
    let m;
    if ((m = /cone de (?:\()?([\d,.]+)/i.exec(s)))        return { formaArea: 'cone', tamanhoArea: num(m[1]) };
    if ((m = /explos[ãa]o de ([\d,.]+)\s*m/i.exec(s)))    return { formaArea: 'circulo', tamanhoArea: num(m[1]) };
    /* Aceita "Raio de 5m" e "Raio 5m" — o campo de alcance escreve sem o "de". */
    if ((m = /(?:raio|c[íi]rculo)\s+(?:de\s+)?([\d,.]+)\s*m/i.exec(s))) return { formaArea: 'circulo', tamanhoArea: num(m[1]) };
    if ((m = /num? raio de ([\d,.]+)\s*m/i.exec(s)))      return { formaArea: 'circulo', tamanhoArea: num(m[1]) };
    if ((m = /zona de ([\d,.]+)\s*m/i.exec(s)))           return { formaArea: 'zona', tamanhoArea: num(m[1]) };
    if ((m = /barreira \w+ de ([\d,.]+)\s*m/i.exec(s)))   return { formaArea: 'zona', tamanhoArea: num(m[1]) };
    if (/adjacent/i.test(s))                              return { formaArea: 'adjacentes', tamanhoArea: null };
    /* "Aliados em 6m" / "Inimigos em 8m" — plural + distância é área circular. */
    if ((m = /(?:aliados|inimigos)\s+(?:em|a|num)\s+(?:at[ée]\s+)?([\d,.]+)\s*m/i.exec(s)))
        return { formaArea: 'circulo', tamanhoArea: num(m[1]) };
    return { formaArea: 'nenhuma', tamanhoArea: null };
}

export function extrairAlcance(txt) {
    const s = String(txt || '');
    let m;
    if ((m = /alcance\s+(?:de\s+)?([\d,.]+)\s*m/i.exec(s))) return num(m[1]);
    /* "1 aliado a 6m", "1 inimigo a 6m", "alvo a 6m" */
    if ((m = /\b(?:aliado|inimigo|alvo|alvos)\s+(?:em|a|num)\s+(?:at[ée]\s+)?([\d,.]+)\s*m/i.exec(s))) return num(m[1]);
    if ((m = /\bat[ée]\s+([\d,.]+)\s*m\b/i.exec(s))) return num(m[1]);
    return null;
}

export function extrairAlvos(txt) {
    const m = /at[ée]\s+(\d+)\s+alvos?/i.exec(String(txt || ''));
    if (m) return +m[1];
    if (/\b1\s+(?:aliado|inimigo|alvo)\b/i.test(String(txt || ''))) return 1;
    return null;
}

export function extrairDuracao(txt) {
    const s = String(txt || '').toLowerCase().trim();
    if (!s) return { duracaoValor: null, duracaoUnidade: null };
    if (/instant[âa]neo/.test(s))                    return { duracaoValor: 0, duracaoUnidade: 'instantaneo' };
    if (/permanente|at[ée] remover/.test(s))         return { duracaoValor: null, duracaoUnidade: 'permanente' };
    if (/enquanto (tocar|mantiver|durar)|manter ritmo|sustentad/.test(s)) return { duracaoValor: 1, duracaoUnidade: 'sustentada' };
    if (/cena/.test(s))                              return { duracaoValor: 1, duracaoUnidade: 'cena' };
    let m;
    if ((m = /(\d+)\s*dias?/.exec(s)))               return { duracaoValor: +m[1], duracaoUnidade: 'dia' };
    if ((m = /(\d+)\s*(?:turnos?|rodadas?)/.exec(s))) return { duracaoValor: +m[1], duracaoUnidade: 'turno' };
    /* "por Grau" sozinho NÃO é duração: "recuam 1,5m por Grau" é distância.
       Só conta quando a unidade de tempo está explícita ao lado. */
    if (/graus? de sucesso\s*=\s*(turnos|rodadas)|(turnos?|rodadas?)\s*por\s*grau/.test(s))
        return { duracaoValor: null, duracaoUnidade: 'turno' };
    return { duracaoValor: null, duracaoUnidade: null };
}

const num = v => parseFloat(String(v).replace(',', '.'));
