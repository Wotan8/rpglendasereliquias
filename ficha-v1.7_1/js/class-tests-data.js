/* ===== CLASS TESTS DATA — Testes Principais por Classe ===== */
/* parts: array de tokens para cálculo automático do total.
   - Token simples: 'FOR', 'Briga', etc. (atributo ou perícia)
   - Token com |: 'FOR|DES' = usa o MAIOR dos dois
   - Token @id: lê valor do elemento DOM pelo id (ex: '@rea_display')
   - Tokens não encontrados resolvem para 0 */

const CLASS_TESTS_FALLBACK = {};

/* Se o Firebase ainda não populou window.CLASS_TESTS, usar o fallback hardcoded */
if (!window.CLASS_TESTS) {
    window.CLASS_TESTS = CLASS_TESTS_FALLBACK;
}
