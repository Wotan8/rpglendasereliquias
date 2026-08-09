/**
 * Confere se TODA avulsa está íntegra para o site: replica o cálculo de
 * `nivelMax` e de `niveis` do `_resolvePeculiaridade` (system-data-loader.js:166-252)
 * e acusa os dois jeitos silenciosos de quebrar um nível novo:
 *
 *   [nivelMaximo divergente] mecânicas irmãs discordando — Math.max vence e a
 *      atrasada aplica a equação BASE naquele nível (_adjustMechanicForLevel
 *      devolve a mecânica intacta quando falta progressao[nv]).
 *   [progressao faltando]    nível dentro do nivelMax sem entrada.
 *
 * node functions/audit-niveis-avulsas.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [pecs, mechs] = await Promise.all([grab('peculiarities'), grab('mechanics')]);
const M = Object.fromEntries(mechs.map(m => [m.id, m]));

const avulsas = pecs.filter(p => p.fonte === 'individual' && p.quandoSeAplica === 'na_criacao')
  .sort((a, b) => a.nome.localeCompare(b.nome));

const problemas = [];
console.log(`${avulsas.length} avulsas\n`);
console.log('Peculiaridade         nvMax  EXP por nível (acumulado)          Sinal');
console.log('─'.repeat(78));

for (const p of avulsas) {
  const mecanicas = (p.mecanicaIds || []).map(i => M[i]).filter(Boolean);
  const orfas = (p.mecanicaIds || []).filter(i => !M[i]);
  if (orfas.length) problemas.push(`${p.nome}: mecanicaIds órfão(s) ${orfas.join(', ')}`);

  const evoluiveis = mecanicas.filter(m => m.evoluivel === true);
  const nivelMax = evoluiveis.length ? Math.max(...evoluiveis.map(m => m.nivelMaximo || 3)) : 1;
  const isGanho = evoluiveis.some(m => m.progressaoTipoExp === 'ganho');

  // divergência de nivelMaximo entre irmãs
  const maximos = [...new Set(evoluiveis.map(m => m.nivelMaximo || 3))];
  if (maximos.length > 1) {
    problemas.push(`${p.nome}: nivelMaximo divergente → ` +
      evoluiveis.map(m => `${m.nome}=${m.nivelMaximo}`).join(', '));
  }
  // sinal misturado (isGanhoExp usa .some(): uma solta inverte o card inteiro)
  const sinais = [...new Set(evoluiveis.map(m => m.progressaoTipoExp))];
  if (sinais.length > 1) problemas.push(`${p.nome}: progressaoTipoExp misturado (${sinais.join('/')})`);
  // ehVantagem tem de casar com o sinal das evolutivas
  if (evoluiveis.length && p.ehVantagem === isGanho) {
    problemas.push(`${p.nome}: ehVantagem=${p.ehVantagem} mas as evolutivas são '${isGanho ? 'ganho' : 'custo'}'`);
  }

  // progressao faltando dentro do nivelMax
  for (const m of evoluiveis) {
    const faltam = [];
    for (let i = 1; i <= nivelMax; i++) if (!m.progressao?.[String(i)]) faltam.push(i);
    if (faltam.length) problemas.push(`${p.nome}: "${m.nome}" sem progressao nos níveis ${faltam.join(',')} (aplica a equação BASE lá)`);
  }

  // EXP: nv1 vem da mecanicaExpCriacao, 2+ da soma dos custoExp
  const em = M[(p.mecanicaExpCriacao || [])[0]];
  if ((p.mecanicaExpCriacao || []).length && !em) problemas.push(`${p.nome}: mecanicaExpCriacao aponta para mecânica inexistente`);
  const nv1 = em ? ((em.config?.calculos || []).find(c => c.alvo === 'EXP')?.equacao || []).reduce((s, t) => s + Math.abs(parseFloat(t.valor) || 0), 0) : 0;

  const degraus = [nv1];
  let acc = nv1;
  const acumulado = [nv1];
  for (let i = 2; i <= nivelMax; i++) {
    const c = evoluiveis.reduce((s, m) => s + (m.progressao?.[String(i)]?.custoExp || 0), 0);
    degraus.push(c); acc += c; acumulado.push(acc);
  }
  const sinal = p.ehVantagem ? '−' : '+';
  console.log(`${p.nome.padEnd(21)} ${String(nivelMax).padStart(2)}    ` +
    `${degraus.join('/').padEnd(18)} → ${sinal}${acumulado[acumulado.length - 1]}`.padEnd(34) +
    (p.ehVantagem ? 'vantagem' : 'desvantagem'));
}

console.log('\n' + '─'.repeat(78));
if (problemas.length) { console.log(`⚠️  ${problemas.length} problema(s):`); problemas.forEach(x => console.log('  • ' + x)); }
else console.log('✅ Nenhuma divergência: nivelMaximo, progressao, sinal e ehVantagem batem em todas.');
process.exit();
