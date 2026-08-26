/* ROLETA — a curva do giro
   ------------------------
   Era `easeOutQuart`: 1-(1-t)^4. Ela freia, mas freia ERRADO para uma roda —
   despeja quase todo o ângulo no primeiro terço e depois se arrasta, então a
   roda parece que travou e só então escorrega até parar.

   Uma roda de verdade perde força por ATRITO: a velocidade cai um tanto
   PROPORCIONAL a ela mesma a cada instante, ω(t) = ω₀·e^(−k·t). E ela não
   arranca no talo: quem gira dá um empurrão, que leva um instante.

   A soma dos dois não tem primitiva bonita, então em vez de espremer uma
   fórmula fechada a gente integra numericamente UMA vez, no carregamento, e
   guarda numa tabela. São 240 amostras — custo irrisório, e a cada quadro do
   giro sobra uma interpolação linear.

   O que a curva promete (e o teste ao lado cobra):
   - sai do zero e chega exatamente em 1;
   - nunca anda para trás;
   - a velocidade sobe no arranque, chega ao pico cedo e cai daí em diante;
   - termina quase parada, para o último grau ser um sussurro. */

/** Atrito. Maior = perde força mais rápido e para mais cedo. */
const K = 5.6;
/** Fatia do tempo gasta no empurrão inicial. */
const ARRANQUE = 0.10;
const AMOSTRAS = 240;

/* Suavizada de Hermite: começa e termina com aceleração zero, então o
   empurrão não dá solavanco nem no início nem ao encostar no atrito. */
const suave = (x) => x * x * (3 - 2 * x);

/** Velocidade angular (em unidade arbitrária) no instante t ∈ [0,1]. */
const velocidade = (t) =>
    (t < ARRANQUE ? suave(t / ARRANQUE) : 1) * Math.exp(-K * t);

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
export const _curvaInterna = { K, ARRANQUE, AMOSTRAS, velocidade };
