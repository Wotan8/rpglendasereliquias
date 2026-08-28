/* ROLETA — a curva do giro
   ------------------------
   Duas trocas, nesta ordem:

   1) Era `easeOutQuart`: 1-(1-t)^4. Ela freia, mas freia ERRADO para uma roda —
      despeja quase todo o ângulo no primeiro terço e depois se arrasta.

   2) Era atrito só VISCOSO, ω(t) = ω₀·e^(−k·t), com k alto. Corrigiu o formato,
      mas trouxe dois defeitos próprios: o pico ficava tão alto que o primeiro
      meio segundo virava borrão ilegível, e uma exponencial NUNCA chega a zero
      — a roda ia morrendo por assíntota, sem nunca dar o clique final. O olho
      lê isso como "a animação acabou antes da roda parar".

   Roda de verdade tem os DOIS atritos: o viscoso, que é forte enquanto ela voa,
   e o SECO do eixo, uma força constante que não liga para a velocidade e é
   quem de fato a mata. Juntos:

       dω/dt = −(a + b·ω)   →   ω(t) = (ω₀ + a/b)·e^(−b·t) − a/b

   Isso para em tempo FINITO. Escolhendo a/b para o zero cair exatamente em
   t = 1, a roda chega ao fim andando de fatia em fatia e trava — que é o que
   dá o último clique. E como o seco já faz o serviço da freada, o viscoso pode
   ser bem mais brando: o giro sustenta velocidade legível por mais tempo em
   vez de gastar tudo no arranque.

   A soma não tem primitiva bonita depois do empurrão inicial, então a gente
   integra numericamente UMA vez, no carregamento, e guarda numa tabela. São
   240 amostras — custo irrisório, e a cada quadro do giro sobra uma
   interpolação linear.

   O que a curva promete (e o teste ao lado cobra):
   - sai do zero e chega exatamente em 1;
   - nunca anda para trás;
   - a velocidade sobe no arranque, chega ao pico cedo e cai daí em diante;
   - termina quase parada, para o último grau ser um sussurro. */

/* Atrito viscoso: some proporcional à própria velocidade. Menor = voa mais.
   Já foi 5,6 (só viscoso) e depois 3,0. Caiu para 2,6 porque a queixa era de
   giro CURTO: com 3,0 a roda ainda cumpria os cinco segundos e meio de relógio,
   mas os últimos dois ela andava tão pouco que o olho já a dava por parada.
   Em 2,6 ela ainda faz uns 90°/s aos quatro segundos — continua visivelmente
   girando até quase o fim, que é onde mora a espera. */
const K = 2.6;
/** Fatia do tempo gasta no empurrão inicial. */
const ARRANQUE = 0.10;
const AMOSTRAS = 240;

/* Atrito seco, calibrado para ω(1) === 0: é ele que dá a parada de verdade.
   De (1+c)·e^(−K) − c = 0. */
const C = Math.exp(-K) / (1 - Math.exp(-K));

/* Suavizada de Hermite: começa e termina com aceleração zero, então o
   empurrão não dá solavanco nem no início nem ao encostar no atrito. */
const suave = (x) => x * x * (3 - 2 * x);

/** Velocidade angular (em unidade arbitrária) no instante t ∈ [0,1]. */
const velocidade = (t) =>
    (t < ARRANQUE ? suave(t / ARRANQUE) : 1) * Math.max(0, (1 + C) * Math.exp(-K * t) - C);

/* Integra a velocidade e normaliza para o percurso total dar 1. */
const TABELA = (() => {
    const acum = new Float64Array(AMOSTRAS + 1);
    const dt = 1 / AMOSTRAS;
    for (let i = 1; i <= AMOSTRAS; i++) {
        // trapézio: com 240 passos o erro é bem menor que um pixel de roda
        acum[i] = acum[i - 1] + (velocidade((i - 1) * dt) + velocidade(i * dt)) / 2 * dt;
    }
    const total = acum[AMOSTRAS];
    for (let i = 0; i <= AMOSTRAS; i++) acum[i] /= total;
    return acum;
})();

/**
 * Fração do percurso já andada no instante `t` ∈ [0,1].
 * `curvaGiro(0) === 0` e `curvaGiro(1) === 1`.
 */
export function curvaGiro(t) {
    if (!(t > 0)) return 0;          // pega NaN junto com o ≤ 0
    if (t >= 1) return 1;
    const x = t * AMOSTRAS;
    const i = Math.floor(x);
    return TABELA[i] + (TABELA[i + 1] - TABELA[i]) * (x - i);
}

/** Exposto só para o teste conferir o formato do movimento. */
export const _curvaInterna = { K, C, ARRANQUE, AMOSTRAS, velocidade };
