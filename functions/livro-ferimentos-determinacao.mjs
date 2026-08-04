/**
 * Insere a seção "6.11 Ferimentos e Determinação" no Capítulo 6 do Livro de
 * Regras do Jogador e renumera a antiga 6.11 (Morte e Incapacitação) para 6.12.
 *
 *   node functions/livro-ferimentos-determinacao.mjs            (dry-run)
 *   node functions/livro-ferimentos-determinacao.mjs --aplicar
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const APLICAR = process.argv.includes('--aplicar');
const REF = db.doc('worldbuilding-articles/art-regras-jogador-06');
const ANCORA = '<h2>6.11 Morte e Incapacitação</h2>';

const SECAO = `<h2>6.11 Ferimentos e Determinação</h2>
<p>Perder Vitalidade não é só encurtar a distância até a morte. Um corpo furado responde pior — a mão treme, o braço demora meio segundo a mais do que deveria. Isso é um redutor, e ele cresce conforme a barra desce.</p>
<p>A faixa se lê em <strong>porcentagem da Vitalidade Máxima</strong>, nunca em pontos soltos. Um Yotun de 60 e um Picxi de 14 medem o próprio sangue na mesma régua.</p>
<table>
<thead><tr><th>Faixa</th><th>Vitalidade</th><th>Redutor</th><th>Ao entrar</th></tr></thead>
<tbody>
<tr><td><strong>Íntegro</strong></td><td>acima de 50%</td><td>—</td><td>—</td></tr>
<tr><td><strong>Ferido</strong></td><td>50% a 31%</td><td>−1</td><td>—</td></tr>
<tr><td><strong>Grave</strong></td><td>30% a 11%</td><td>−2</td><td>Teste de Determinação</td></tr>
<tr><td><strong>Beira da Morte</strong></td><td>10% a 1%</td><td>−3</td><td>Teste de Determinação</td></tr>
<tr><td><strong>Morrendo</strong></td><td>0 ou menos</td><td>—</td><td>Teste de Morte por turno (6.12)</td></tr>
</tbody>
</table>
<p><strong>O redutor não se aplica à Defesa.</strong> Desviar de um golpe é reflexo, e reflexo não pergunta como você está. Ele entra em todo o resto: Ataque, perícias, magia, Iniciativa se o combate recomeçar. Sem essa exceção o ferido erra mais, apanha por errar, e erra mais ainda por ter apanhado — a luta acabaria antes de ser luta.</p>
<p>A faixa é sempre a atual. Curar de volta para cima devolve o Alvo cheio na hora.</p>
<h3>Teste de Determinação</h3>
<p>Chegar a <strong>Grave</strong> é o ponto em que o corpo começa a pedir para parar. Ao <strong>entrar</strong> em Grave, e de novo ao entrar em Beira da Morte, teste:</p>
<p><strong>Teste de Determinação: Alvo = VIG + PRS</strong></p>
<ul>
<li><strong>Sucesso:</strong> você continua. O redutor da faixa vale normalmente.</li>
<li><strong>Falha:</strong> você <strong>Vacila</strong> — perde a Ação Padrão do próximo turno. Ainda se move, ainda reage.</li>
<li><strong>Crítico (1):</strong> <strong>Fôlego de Morte</strong>. Até o fim da cena, ignore o redutor de ferimento.</li>
<li><strong>Falha Crítica (10):</strong> Vacila e perde a Reação até o início do seu próximo turno.</li>
</ul>
<p>É <strong>um teste por faixa, por cena</strong> — não um por rodada. Descer e voltar não cobra de novo. Gastar <strong>1 ENER</strong> dá +2 no Alvo, como no Teste de Morte.</p>
<p>É o mesmo Alvo do Teste de Morte de propósito: quem largou Perseverança de lado descobre isso duas vezes na mesma noite.</p>
<p>Quem tem a peculiaridade <strong>Resistente à Dor</strong> ignora o redutor de uma faixa por nível, começando pela mais leve — Nv.1 ignora <em>Ferido</em>, Nv.2 ignora também <em>Grave</em>, Nv.3 ignora também <em>Beira da Morte</em> — e dispensa o Teste de Determinação da faixa que ignora. Em troca, o Narrador para de anunciar em que faixa você está.</p>

`;

const snap = await REF.get();
const html = snap.data().contentHTML;
if (!html.includes(ANCORA)) { console.error('Âncora não encontrada — o capítulo mudou.'); process.exit(1); }
if (html.includes('6.11 Ferimentos e Determinação')) { console.log('Seção já existe — nada a fazer.'); process.exit(0); }

const novo = html.replace(ANCORA, SECAO + '<h2>6.12 Morte e Incapacitação</h2>');
const words = novo.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

console.log(`contentHTML ${html.length} → ${novo.length} caracteres · words ${snap.data().words} → ${words}`);
if (!APLICAR) {
  const arq = 'functions/_preview-6.11.html';
  fs.writeFileSync(arq, SECAO);
  console.log(`(dry-run — prévia da seção em ${arq}; rode com --aplicar para gravar)`);
} else {
  await REF.update({ contentHTML: novo, words, updatedAt: Date.now() });
  console.log('✅ Capítulo 6 atualizado.');
}
process.exit();
