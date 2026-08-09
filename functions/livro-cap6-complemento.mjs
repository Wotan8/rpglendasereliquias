/**
 * Régua de Balanceamento, capítulo 6 — complemento.
 *
 * A frente de condições já escreveu o capítulo (regra, fórmula, valor cheio de
 * cada condição). Este script NÃO reescreve nada disso; acrescenta o que veio da
 * frente de classes mágicas e corrige uma linha que ficou desatualizada:
 *
 *   §6.10 Piso de Chance = 5           — a decisão de variância
 *   §6.11 Somar condições é subaditivo — o piso de 10% trava a soma
 *   §6.12 O que a régua não vê          — remoção da luta (o caso Atordoar)
 *   correção: o campo `condicoesAplicadas` passou a existir no passo 8
 *
 *   node functions/livro-cap6-complemento.mjs            (dry-run)
 *   node functions/livro-cap6-complemento.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const col = db.collection('worldbuilding-articles');
const docs = (await col.where('bookId', '==', 'book-regua-balanceamento').get()).docs;
const alvo = docs.find(d => /Condi[çc][õo]es e a Chance/i.test(d.data().title || ''));
if (!alvo) { console.error('🔴 ABORTADO: capítulo de condições não encontrado.'); process.exit(1); }

const original = alvo.data().contentHTML || '';

/* A frente de condições escreveu que não há campo. O passo 8 criou. */
const DE_CAMPO = 'Habilidade de classe carrega a Chance no texto do efeito — não há campo, e nada a lê automaticamente.';
const PARA_CAMPO = 'Habilidade de classe declara em <code>condicoesAplicadas: [{ condicao, portao, chance }]</code>, '
    + 'campo tipado no item do módulo (passo 8). <code>portao</code> é <code>\'chance\'</code> ou '
    + '<code>\'resistencia\'</code>, e a régua lê direto de lá — não mais por regex sobre a prosa.';

const NOVO = `
<h2>6.10 Piso de Chance = 5</h2>
<blockquote><p>Nenhuma habilidade declara Chance abaixo de <strong>5</strong>.</p></blockquote>
<p><strong>Por quê:</strong> a régua mede valor esperado e é cega para variância. Cego com Chance 3 custa 1 ponto e entrega 1,57 de valor esperado — passa folgado. E <strong>falha em 70% das vezes</strong>. Uma habilidade que na maioria dos turnos não faz nada tem a mesma nota na planilha e uma experiência de mesa completamente diferente de uma magia que sempre entrega alguma coisa.</p>
<p>Exemplo fechado: Cego cheio vale 5,23; com o piso, o mínimo possível é 2,61. Não cabe em custo 1 nem em 2. <strong>Cegar deixa de ser efeito barato</strong>, que é como tem que ser.</p>
<p><strong>Alternativa, se o piso apertar demais:</strong> efeito parcial na falha — a Chance que não pega aplica a condição menor da mesma família, Cego virando Ofuscado. Mantém o desconto, some com a rodada morta, e usa a hierarquia que as condições já têm.</p>

<h2>6.11 Somar condições é subaditivo</h2>
<p>Os valores somam linear, mas o sistema não. Cego (−4 no Alvo) mais Amedrontado (−1) dão −5 num defensor cujo Alvo é ~5 — e a chance de o golpe entrar <strong>trava em 0,90</strong>, porque o crítico natural na defesa sempre salva. O quinto ponto de redução não compra nada.</p>
<blockquote><p>Ao empilhar condições que mexem no mesmo Alvo, a soma linear é <strong>teto</strong>, não estimativa. Desconte.</p></blockquote>

<h2>6.12 O que a régua não vê: remoção da luta</h2>
<p>Perder 5 turnos não é cinco vezes perder 1 turno — é sair do combate. A régua mede por conjuração e não enxerga a diferença.</p>
<p>Caso real do catálogo: a manobra <em>Atordoar</em> dizia <em>"a cada Grau de Sucesso o alvo perde 1 turno + 1d4 turnos"</em>. Com 3 Graus médios são 5,5 a 10,5 turnos perdidos — por 1 Energia, sem Chance e sem resistência. <strong>A régua marcava 0,73× e não acusava nada</strong>, porque o texto <em>descrevia</em> o efeito em vez de <em>nomear</em> a condição. Corrigida para "Atordoado por 1 turno" (1,32×).</p>
<blockquote><p><strong>Regra de projeto:</strong> condição que rouba turno não escala com Graus de Sucesso. Os Graus já derrubam o Alvo de defesa (Livro §6.4) — deixá-los escalar a duração paga duas vezes pelo mesmo acerto.</p></blockquote>
<p><strong>[A DEFINIR]</strong> — Atordoado repetível no mesmo alvo. Com pool de Energia 7 e combate de 5 rodadas, um conjurador sozinho remove um inimigo da luta inteira <em>dentro do orçamento</em>. Precisa de janela de imunidade ou retorno decrescente na repetição.</p>
`;

let html = original;
const trocou = html.includes(DE_CAMPO);
if (trocou) html = html.replace(DE_CAMPO, PARA_CAMPO);
html = html.trimEnd() + '\n' + NOVO.trim() + '\n';

const limpo = s => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
console.log('=== Complemento ao capítulo 6 ===\n');
console.log(`  correção do campo: ${trocou ? '✅ âncora encontrada' : '⚠ âncora NÃO encontrada — texto já mudou'}`);
console.log(`  seções novas: 6.10 Piso de Chance · 6.11 Soma subaditiva · 6.12 Remoção da luta`);
console.log(`\n  ${original.length} → ${html.length} chars (+${html.length - original.length})`);

/* assert rodável */
const deveTer = ['Piso de Chance = 5', 'subaditivo', 'não escala com Graus de Sucesso', 'condicoesAplicadas'];
const falta = deveTer.filter(s => !html.includes(s));
if (falta.length) { console.error('\n🔴 auto-verificação falhou: faltou ' + falta.join(', ')); process.exit(1); }
if (/6\.10 Piso[\s\S]*6\.10 Piso/.test(html)) { console.error('\n🔴 ABORTADO: seção duplicada.'); process.exit(1); }
console.log('  ✅ auto-verificação passou.');

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
await col.doc(alvo.id).update({
    contentHTML: html, updatedAt: Date.now(),
    words: html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
});
console.log('\n✅ Gravado.');
process.exit(0);
