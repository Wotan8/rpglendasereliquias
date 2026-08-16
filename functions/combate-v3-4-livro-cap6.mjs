/**
 * Combate v3 — passo 4: reescreve o Capítulo 6 do Livro de Regras do Jogador.
 *
 * Cirurgia por seção: o capítulo é cortado nos <h2>, as seções afetadas são
 * substituídas e o resto (6.5 Dano, 6.11 Ferimentos, 6.12 Morte) fica intacto.
 * 6.8 (Crítico na Defesa) é removida — o defensor não rola mais.
 *
 *   node functions/combate-v3-4-livro-cap6.mjs            (dry-run)
 *   node functions/combate-v3-4-livro-cap6.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const ID = 'art-regras-jogador-06';

/* ===== As seções novas ===== */

const S61 = `<h2>6.1 Visão Geral</h2>
<p>O combate funciona em <strong>rodadas</strong> de aproximadamente 6 segundos. Em cada rodada, cada participante age uma vez, na ordem da Iniciativa.</p>
<p><strong>Só o atacante rola.</strong> O defensor não faz teste: ele tem um número, a <strong>Defesa</strong>, e o atacante precisa vencê-lo com Graus de Sucesso. Todo golpe se resolve assim:</p>
<ol>
<li><strong>ATAQUE</strong> — o atacante rola 1d10. Graus = Alvo − resultado.</li>
<li><strong>DEFESA</strong> — o defensor escolhe como se defende. Se os Graus forem <strong>iguais ou maiores</strong> que a Defesa escolhida, o golpe passa.</li>
<li><strong>DANO</strong> — o atacante rola o dano e subtrai a Blindagem.</li>
</ol>
<p>Uma rolagem por golpe, uma comparação, um dado de dano. O defensor só pega o dado em casos excepcionais — quando uma habilidade, uma condição ou a situação pedirem um teste dele por escrito.</p>`;

const S62_REACAO = `<h3>Defesa da rodada</h3>
<p>Fora do seu turno você não rola nada, mas <strong>escolhe</strong>: ao ser atacado, você declara qual defesa está usando (Esquiva, Aparar, Bloquear…) depois de ver a rolagem do atacante. Se não declarar nenhuma, sua Defesa contra aquele golpe é <strong>0</strong>.</p>
<p>Quantas defesas você declara por rodada depende de <strong>Reflexo</strong>:</p>
<blockquote><p><strong>Defesas por rodada = Reflexo − 1</strong> (mínimo 1). Cada defesa além dessa custa <strong>1 Energia</strong>.</p></blockquote>
<p>Cercado, isso vira decisão: qual golpe você para, e quanto de Energia está disposto a queimar para parar o próximo.</p>`;

const S64 = `<h2>6.4 Etapa 2: Defesa</h2>
<p>A Defesa é um <strong>número</strong>, não um teste. Ela aparece pronta na sua ficha, na aba Combate, uma para cada perícia de defesa:</p>
<blockquote><p><strong>Defesa = Reação + Perícia de defesa − 1</strong>, limitada ao <strong>menor entre DES e RAC</strong>.</p></blockquote>
<p>A <strong>Reação</strong> não tem mais fórmula própria: ela nasce 0 e só muda por peculiaridade, condição, postura ou magia. Serve para que um "−1 na Reação" desça de uma vez para todas as suas defesas.</p>
<table>
<thead><tr><th>Defesa</th><th>Some</th><th>Observações</th></tr></thead>
<tbody>
<tr><td>Esquiva</td><td>Perícia: Esquiva</td><td>Sair da trajetória do golpe.</td></tr>
<tr><td>Aparar</td><td>Perícia: Aparar</td><td>Requer arma empunhada.</td></tr>
<tr><td>Bloquear</td><td>Perícia: Bloquear</td><td>Requer escudo. A Qualidade dele já soma na perícia.</td></tr>
<tr><td>Desviar</td><td>Perícia: Desviar</td><td>Defesa desarmada; −1 contra ataques com arma.</td></tr>
<tr><td>Evadir</td><td>Perícia: Evadir</td><td>Escapar de área; falhando, pode cair.</td></tr>
<tr><td>Dar Cobertura</td><td>Perícia: Cobertura</td><td>Protege um aliado sem você virar alvo.</td></tr>
<tr><td>Proteger</td><td>Perícia: Proteger</td><td>Você vira o alvo no lugar do aliado.</td></tr>
<tr><td>Absorver</td><td>VIG</td><td>Recebe no corpo: metade do dano, não letal. Teto: <strong>VIG</strong>, não DES/RAC.</td></tr>
</tbody>
</table>
<p><strong>Se os Graus do atacante forem iguais ou maiores que a sua Defesa, o golpe passa.</strong> Senão, você aparou.</p>
<p>Você NÃO tem Defesa se: já gastou as defesas da rodada e não pagou Energia; está surpreso ou inconsciente; uma manobra anula sua Defesa; ou não sabe que está sendo atacado. Nesses casos a Defesa é 0 — qualquer sucesso do atacante passa.</p>
<p><em>Exemplo:</em> o atacante tem Alvo 7 e rola 4 — 3 Graus. Você tem Defesa: Aparar 2. Três é maior que dois: o golpe passa. Se tivesse rolado 6, seriam 1 Grau, e a sua arma teria desviado a lâmina.</p>`;

const S66 = `<h2>6.6 Acertos Críticos</h2>
<p>Rolar <strong>1</strong> no ataque:</p>
<ul>
<li><strong>Acerto automático</strong> — passa por qualquer Defesa;</li>
<li><strong>Graus máximos</strong> — iguais ao seu Alvo total;</li>
<li><strong>Dado cheio</strong> — o dado de dano não é rolado: vale o valor máximo dele (espada 1d8 → 8 + Dano − Blindagem).</li>
</ul>
<p>Dado cheio em vez de dado dobrado troca uma rolagem por um número que já está impresso na ficha da arma. O crítico fica levemente menos explosivo e muito mais rápido.</p>`;

const S67 = `<h2>6.7 Falhas Críticas</h2>
<p>Rolar <strong>10</strong> no ataque é um desastre:</p>
<ul>
<li><strong>Erro automático</strong>, independente do Alvo;</li>
<li><strong>Consequência narrativa</strong> — o Narrador escolhe uma: a arma escapa da mão (cai a 1d6 metros), você perde o equilíbrio, a arma prende num obstáculo, ou você atinge um aliado adjacente (dano normal);</li>
<li><strong>Abre a guarda</strong> — quem você atacou pode contra-atacar (6.8), se tiver a perícia e a Energia.</li>
</ul>`;

const S68 = `<h2>6.8 Contra-Ataque</h2>
<p>Errar feio custa caro. Quando um atacante <strong>não alcança o próprio Alvo</strong> (Graus 0 ou menos) ou tira <strong>10</strong>, quem foi atacado pode contra-atacar — se tiver a perícia <strong>Contra-Ataque</strong>.</p>
<blockquote><p><strong>O contra-ataque acerta automaticamente.</strong> Não há rolagem de ataque e a Defesa do agressor é ignorada. A Blindagem dele continua valendo.</p>
<p><strong>Dano = dado da arma + Contra-Ataque − Blindagem</strong> (mínimo 1).</p>
<p><strong>Custa 1 Energia</strong> e <strong>consome uma defesa da rodada</strong>.</p></blockquote>
<p>Repare no que o dano <em>não</em> inclui: nem o seu valor de Dano, nem os bônus da arma. Uma lâmina muito afiada continua valendo tudo no seu golpe e nada no seu contra-ataque — a estocada na abertura é técnica, não força.</p>
<ul>
<li><strong>Desarmado:</strong> o dado é 1d4.</li>
<li><strong>Com escudo:</strong> o contra-ataque sai da arma da outra mão. Se o escudo tiver dado de dano próprio, você escolhe qual usar.</li>
<li><strong>Com duas armas:</strong> você rola o dado de <strong>uma</strong> arma, e gasta a defesa como qualquer outro.</li>
<li><strong>Um contra-ataque não pode ser contra-atacado.</strong></li>
</ul>
<p>A Energia é o freio: com a reserva típica, são poucos contra-ataques por descanso. Cercado por inimigos desastrados as oportunidades sobram, mas a Energia não.</p>`;

const S610_DUAS_ARMAS = `<h3>Lutar com Duas Armas</h3>
<ul>
<li><strong>Ação:</strong> Ação Padrão + Ação de Movimento — <strong>o turno inteiro</strong>. Você não se desloca nesta rodada.</li>
<li><strong>Penalidade:</strong> <strong>−3 no Alvo</strong> de ambos os ataques, reduzida em 1 por nível de <strong>Ambidestria</strong>, até o mínimo de <strong>−1</strong>. Ela nunca chega a zero.</li>
<li>A arma secundária deve ser leve ou média (adaga, espada curta).</li>
<li>Você escolhe a ordem dos golpes.</li>
</ul>
<p>Sem treino, duas armas atrapalham de verdade: você erra mais, e cada erro feio abre a guarda para o contra-ataque do outro. O ganho só aparece com Ambidestria comprada.</p>`;

const S610_COBERTURA = `<h3>Cobertura (contra ataques à distância)</h3>
<table>
<thead><tr><th>Cobertura</th><th>Modificador</th><th>Exemplo</th></tr></thead>
<tbody>
<tr><td>Parcial (25%)</td><td>+1 na Defesa</td><td>Atrás de barril, pilar estreito</td></tr>
<tr><td>Meia (50%)</td><td>+1 na Defesa</td><td>Muro baixo, janela</td></tr>
<tr><td>Três quartos (75%)</td><td>+2 na Defesa</td><td>Só a cabeça exposta, seteira</td></tr>
<tr><td>Total (100%)</td><td>Não pode ser alvo</td><td>Completamente escondido</td></tr>
</tbody>
</table>`;

const S610_PROSTRADO = `<h3>Luta no Chão (Prostrado)</h3>
<ul>
<li><strong>−2 na Defesa</strong> contra ataques corpo-a-corpo;</li>
<li><strong>+1 na Defesa</strong> contra ataques à distância;</li>
<li>Levantar custa 1 ação de movimento.</li>
</ul>`;

/* [rótulo, regex que casa a seção inteira, texto novo (ou null para remover)] */
const CIRURGIAS = [
    ['6.1 Visão Geral', /<h2>6\.1 Visão Geral<\/h2>[\s\S]*?(?=<h2>6\.2)/, S61 + '\n\n'],
    ['6.2 › Reação → Defesa da rodada', /<h3>Reação<\/h3>[\s\S]*?(?=<h2>6\.3)/, S62_REACAO + '\n\n'],
    ['6.4 Defesa', /<h2>6\.4 Etapa 2: Defesa<\/h2>[\s\S]*?(?=<h2>6\.5)/, S64 + '\n\n'],
    ['6.6 Acertos Críticos', /<h2>6\.6 Acertos Críticos<\/h2>[\s\S]*?(?=<h2>6\.7)/, S66 + '\n\n'],
    ['6.7 Falhas Críticas', /<h2>6\.7 Falhas Críticas<\/h2>[\s\S]*?(?=<h2>6\.8)/, S67 + '\n\n'],
    ['6.8 Crítico na Defesa → Contra-Ataque', /<h2>6\.8 Crítico na Defesa<\/h2>[\s\S]*?(?=<h2>6\.9)/, S68 + '\n\n'],
    ['6.10 › Lutar com Duas Armas', /<h3>Lutar com Duas Armas<\/h3>[\s\S]*?(?=<h3>Cobertura)/, S610_DUAS_ARMAS + '\n\n'],
    ['6.10 › Cobertura', /<h3>Cobertura \(contra ataques à distância\)<\/h3>[\s\S]*?(?=<h2>6\.11)/, S610_COBERTURA + '\n\n'],
    ['6.10 › Prostrado', /<h3>Luta no Chão \(Prostrado\)<\/h3>[\s\S]*?(?=<h3>Combate Montado)/, S610_PROSTRADO + '\n\n'],
];

/* Trocas pontuais fora das seções reescritas. */
const PONTUAIS = [
    ['6.2 › Ações no Turno (armas duplas)',
        'armas duplas</strong> pode usar a ação de movimento para atacar com a segunda arma (ver 6.10).',
        'armas duplas</strong> gasta o turno inteiro nisso (ver 6.10).'],
    ['6.3 › Graus',
        'Eles representam a precisão do golpe: quanto mais Graus, mais difícil será para o defensor escapar.',
        'Eles representam a precisão do golpe: o golpe só passa se os Graus forem iguais ou maiores que a Defesa do alvo (6.4).'],
    ['6.3 › exemplo',
        'Rola 2: acertou com 5 Graus. O defensor terá −5 no teste de defesa.',
        'Rola 2: 5 Graus. Passa por qualquer Defesa até 5.'],
    ['6.3 › Transbordo', 'Vale para ataque e para defesa.', 'Vale para o ataque.'],
    ['6.9 › Ataque Total', 'Sua Reação = 0 até seu próximo turno.', 'Sua Defesa = 0 até seu próximo turno.'],
    ['6.9 › Postura Ofensiva', '+2 no Alvo de Ataque. Reação = 0 até o próximo turno.',
        '+2 de dano em cada golpe e −1 na sua Defesa. Dura até trocar de postura.'],
    ['6.9 › Postura Defensiva', '+2 no Alvo de Defesa. Só 1 ação de movimento; não pode atacar.',
        '+3 de Blindagem e −2 no Alvo dos seus ataques. Dura até trocar de postura.'],
    ['6.9 › Romper Defesa', 'O defensor não pode rolar defesa contra este ataque.',
        'Ignora a Defesa e a Blindagem do alvo neste golpe; com sucesso, ele fica Prostrado.'],
    ['6.10 › Surpresa', 'não age na primeira rodada e não pode usar Reação',
        'não age na primeira rodada e tem Defesa 0'],
    ['6.10 › pelas Costas', 'o defensor não usa Reação e o atacante tem <strong>Vantagem</strong>',
        'o defensor tem Defesa 0 e o atacante tem <strong>Vantagem</strong>'],
    ['6.11 › redutor de ferimento',
        'O redutor não se aplica à Defesa.</strong> Desviar de um golpe é reflexo, e reflexo não pergunta como você está. Ele entra em todo o resto: Ataque, perícias, magia, Iniciativa se o combate recomeçar. Sem essa exceção o ferido erra mais, apanha por errar, e erra mais ainda por ter apanhado — a luta acabaria antes de ser luta.',
        'O redutor não toca a Defesa.</strong> Ela é um número, não um teste — e é justamente isso que impede a espiral em que o ferido erra mais, apanha por errar, e erra mais ainda por ter apanhado. O redutor entra em todo o resto: Ataque, perícias, magia, e Iniciativa se o combate recomeçar.'],
    ['6.11 › Vacilar', 'Vacila</strong> — perde a Ação Padrão do próximo turno. Ainda se move, ainda reage.',
        'Vacila</strong> — perde a Ação Padrão do próximo turno. Ainda se move, ainda se defende.'],
    ['6.11 › Falha Crítica', 'Falha Crítica (10):</strong> Vacila e perde a Reação até o início do seu próximo turno.',
        'Falha Crítica (10):</strong> Vacila e fica com Defesa 0 até o início do seu próximo turno.'],
];

const ref = db.collection('worldbuilding-articles').doc(ID);
const snap = await ref.get();
if (!snap.exists) { console.error(`🔴 ABORTADO: ${ID} não encontrado.`); process.exit(1); }
let html = snap.data().contentHTML || '';
const original = html;

console.log('='.repeat(72));
console.log('COMBATE v3 — passo 4: Capítulo 6 do Livro de Regras');
console.log('='.repeat(72));
console.log(`\nTamanho original: ${original.length} chars\n`);

const erros = [];
console.log('SEÇÕES REESCRITAS:');
for (const [rot, rx, novo] of CIRURGIAS) {
    if (!rx.test(html)) { erros.push(`seção não encontrada: ${rot}`); continue; }
    const antes = html.length;
    html = html.replace(rx, novo);
    console.log(`  ✔ ${rot.padEnd(42)} ${antes} → ${html.length}`);
}

console.log('\nTROCAS PONTUAIS:');
for (const [rot, de, para] of PONTUAIS) {
    if (!html.includes(de)) { erros.push(`trecho não encontrado: ${rot} → "${de.slice(0, 50)}…"`); continue; }
    html = html.split(de).join(para);
    console.log(`  ✔ ${rot}`);
}

/* Aviso do topo do capítulo. */
html = html.replace(
    'O sistema usa a mesma mecânica Roll Under do Capítulo 2, expandida em três etapas claras: <strong>Ataque, Defesa e Dano</strong>.',
    'O sistema usa a mesma mecânica Roll Under do Capítulo 2. <strong>Só o atacante rola:</strong> a Defesa do alvo é um número que os Graus de Sucesso precisam vencer, e a Blindagem subtrai do dano.');

/* ===== auto-verificação ===== */
const deveTer = [
    '6.8 Contra-Ataque', 'Defesa = Reação + Perícia de defesa − 1', 'menor entre DES e RAC',
    'Defesas por rodada = Reflexo − 1', 'dado da arma + Contra-Ataque − Blindagem',
    'Dado cheio', 'até o mínimo de <strong>−1</strong>',
];
const naoDeveTer = [
    '6.8 Crítico na Defesa', 'Alvo de Defesa = Reação + Perícia de defesa − Graus do Atacante',
    'Forçar Reação', 'Reação = 0 até seu próximo turno', 'O redutor não se aplica à Defesa.',
];
for (const s of deveTer) if (!html.includes(s)) erros.push(`faltou no resultado: "${s}"`);
for (const s of naoDeveTer) if (html.includes(s)) erros.push(`sobrou no resultado: "${s}"`);

const h2s = [...html.matchAll(/<h2>(6\.\d+[^<]*)<\/h2>/g)].map(m => m[1]);
console.log('\nSEÇÕES FINAIS:\n  ' + h2s.join('\n  '));
if (h2s.length !== 12) erros.push(`esperava 12 seções h2, contei ${h2s.length}`);

if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
console.log(`\n✅ auto-verificação passou. ${original.length} → ${html.length} chars (${html.length - original.length >= 0 ? '+' : ''}${html.length - original.length}).`);

if (!APPLY) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

await ref.update({
    contentHTML: html, updatedAt: Date.now(),
    words: html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
});
console.log('\n✅ Capítulo 6 gravado.');
process.exit(0);
