/**
 * Governo e Economia da tribo Tulo.
 *
 * Texto desenvolvido com o usuário e APROVADO por ele em 30/07/2026, após três
 * rodadas de revisão (correção do sistema de provas, correção da estabilidade da
 * liderança, e reescrita para registro afirmativo — sem definir a tribo pelo que
 * lhe falta).
 *
 * Ancorado no canon: 1 em 10 chega à vida adulta · treinamento que mata os fracos
 * · excelência individual sobre quantidade · um campeão vale dez soldados comuns
 * · 9 patentes em 3 unidades (Zalakare/Muha/Tulakare), todas de elite · patente
 * usada como nome (Zuberi — Zalakare Drie, de Sessão 1.md) · rivalidade com os
 * Famo · glorificam sofrimento e provação.
 *
 *   node functions/lore-tulo-governo-economia.mjs            (dry-run)
 *   node functions/lore-tulo-governo-economia.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

const GOVERNO = [
    'As nove patentes não são um exército dentro da sociedade. Elas são a sociedade.',
    'Um Tulo é a sua patente. Zalakare Drie é como ele é chamado, como é julgado e como será enterrado — e quem pergunta quem ele é recebe a mesma resposta que receberia perguntando o que ele vale.',
    'Cada patente se conquista, e se conquista contra o mundo. Caçadas que exigem trazer de volta o que um homem sozinho mal carrega. Travessias de ermo com menos do que basta. Provações medidas em dias sob sol aberto. O que o Tulo traz é visto por todos, contado por todos e lembrado enquanto ele viver.',
    'Por isso a autoridade entre eles se acumula. Um Tulakare Nege carrega quarenta anos de provas nas costas, e quarenta anos pesam mais do que qualquer temporada de ambição. Quem quiser o lugar dele pode tentar — a ganância existe entre os Tulo como existe em toda parte —, mas tentará contra uma memória inteira, e a tribo lembra bem.',
    'Há velhos cuja moral fala antes deles. Quando o ambicioso aparece, são os leais que se põem na frente, e derramariam o próprio sangue ali mesmo. O ambicioso entende que enfrentaria a tribo antes de enfrentar o homem, e recua.',
    'O respeito é cobrado. Os Tulo reconhecem um bom líder quando o veem e exigem exatamente isso. Um chefe que gasta vidas à toa vive sob um peso silencioso que vem de todos ao redor, e para permanecer onde está precisa ser forte o bastante para carregá-lo. É mais comum um líder ruim ceder a esse peso do que cair para um desafiante.',
    'Quando é preciso decidir, decide quem está presente e tem a patente mais alta. Quando a guerra acaba, os Tulo levam o que ganharam e voltam para casa.',
].join('\n\n');

const ECONOMIA = [
    'Os Tulo vendem a única coisa que produzem: a si mesmos — e cobram por um o preço de dez.',
    'Um campeão Tulo vale dez soldados comuns, e isso é uma tabela de preços. Quem contrata um Zalakare paga o que pagaria por uma dezena de lanceiros, e paga sem discutir, porque recebe outra coisa. Tribos, vilas e mercadores os procuram para escoltar o que precisa chegar, guardar o que precisa resistir e, acima de tudo, decidir disputas em combate único.',
    'É aí que está o negócio verdadeiro. Duas partes que preferem poupar uma guerra inteira contratam cada uma o seu campeão e aceitam o resultado do encontro. Os Tulo são chamados para isso mais do que para qualquer outra coisa em Vasteluna, e entendem melhor que os clientes por quê: quem paga dez crianças por um adulto tem interesse sincero em que as guerras sejam pequenas.',
    'O que fabricam é armamento próprio, forjado para a patente de quem vai empunhar, e fica na tribo. Cada par de mãos está na caçada, na estrada ou na prova. Grão, tecido e metal bruto chegam de fora, pagos com serviço — e criar dez crianças para obter um adulto consome quase tudo o que entra.',
    'A economia inteira se apoia na reputação. O preço de um Tulo é o preço da lenda de que um Tulo vale dez, e cada derrota pública corrige esse preço para todos eles antes do fim da estação. Eles carregam o que provaram na última vez em que alguém olhou.',
].join('\n\n');

const snap = await db.collection('system/data/tribes').where('nome', '==', 'Tulo').limit(1).get();
if (snap.empty) { console.log('✖ Tulo não encontrada'); process.exit(1); }
const doc = snap.docs[0], t = doc.data();
const vazio = v => !v || String(v).trim() === '.' || String(v).trim() === '';

console.log(`Tulo ${doc.id}\n`);
for (const [campo, texto] of [['governo', GOVERNO], ['economia', ECONOMIA]]) {
    const atual = String(t[campo] || '').trim();
    console.log(`${campo}: ${vazio(atual) ? '(vazio)' : `(TINHA TEXTO — ${atual.length} chars!)`} -> ${texto.length} chars, ${texto.split('\n\n').length} parágrafos`);
}
const depois = { ...t, governo: GOVERNO, economia: ECONOMIA };
const faltando = ['descricao', 'cultura', 'governo', 'economia', 'militar'].filter(f => vazio(depois[f]));
console.log(`\ncampos que continuam vazios: ${faltando.join(', ') || 'nenhum'}`);
console.log(`publicado: ${t.publicado}  (inalterado — falta cultura e militar)`);

if (!APPLY) { console.log('\nDRY-RUN — nada gravado. Rode com --apply.\n'); process.exit(); }
await doc.ref.update({ governo: GOVERNO, economia: ECONOMIA, atualizadoEm: new Date() });
console.log('\n✔ GRAVADO.\n');
process.exit();
