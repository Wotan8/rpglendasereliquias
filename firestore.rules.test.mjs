/* =============================================
   RULES DE `users` — o que o navegador NÃO pode fazer
   =============================================
   Roda contra o emulador do Firestore, sem tocar em produção e sem
   dependência nova no projeto (tudo baixado na hora pelo npx/npm):

     mkdir -p /tmp/rt && cd /tmp/rt && npm i @firebase/rules-unit-testing firebase
     cd <raiz do repo>
     npx firebase-tools@13 emulators:exec --only firestore --project demo-rules \
       "node /tmp/rt/node_modules/.bin/../../<este arquivo> firestore.rules"

   (mais simples: copie este arquivo para a pasta /tmp/rt e rode de lá,
    passando o caminho de firestore.rules como argumento.)

   Precisa de Java. O firebase-tools atual exige JDK 21; o 13 roda com 17,
   daí o `@13` acima.

   Por que existe: em 31/08/2026 esta mesma suíte rodou contra as rules de
   antes das correções e OITO destes casos PASSARAM — dava para se promover a
   criador, gravar o `uid` de outra pessoa no próprio documento e trocar o
   e-mail pelo de outro. Não é hipótese, foi reproduzido.

   Os "evaluation error" que o emulador imprime nos casos negados são ruído
   conhecido e anterior a estas correções: ao decidir um `create`, ele também
   avalia a regra de `update`, onde `resource.data` é nulo. Erro em regra nega
   por padrão, então o resultado continua certo.
   ============================================= */
// Roda dentro de `firebase emulators:exec --only firestore`.
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, collection } from 'firebase/firestore';
import fs from 'node:fs';

const JOG = 'uid-jogador';
const VIT = 'uid-vitima';
const EMAIL = 'jogador@teste.com';
const MESA = 'mesa-1';
const CAIXA = '__caixa_mestre__' + MESA;

const env = await initializeTestEnvironment({
  projectId: 'demo-rules',
  firestore: { rules: fs.readFileSync(process.argv[2], 'utf8'), host: '127.0.0.1', port: 8532 },
});

// Estado de partida, gravado sem rules.
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, 'users', JOG), { email: EMAIL, displayName: 'Jogador', role: 'jogador', fragmentos: 10 });
  await setDoc(doc(db, 'users', VIT), { email: 'vitima@teste.com', displayName: 'Vítima', fragmentos: 999 });
  // O espelho público, como o gatilho o grava.
  await setDoc(doc(db, 'users_public', VIT), { displayName: 'Vítima', apoios: [] });
  // Um NPC do cenário, com a ficha que o mestre escreveu.
  await setDoc(doc(db, 'npcs', 'npc-1'), {
    nome: 'Guarda de Vasteluna', tipo: 'npc',
    atributos: { FOR: 3 }, ataques: 'Lança', loot: { luns: '50' },
    rolePlay: { segredos: 'trabalha para a Guilda' },
    valoresDer: { VIT: 20, atual: { VIT: 20 } }, conditions: [],
  });
  // Um NPC ALIADO do jogador: `vinculos` tem {tipo:'personagem'} para a ficha
  // dele, e o gatilho achatou isso em `donosUids`.
  await setDoc(doc(db, 'npcs', 'npc-aliado'), {
    nome: 'Escudeiro', tipo: 'npc',
    vinculos: [{ tipo: 'personagem', id: 'char-do-jogador' }],
    donosUids: [JOG],
  });
  await setDoc(doc(db, 'items', 'item-do-aliado'), {
    nome: 'Adaga do escudeiro', characterId: 'npc-aliado', ownerUid: 'foi-o-mestre-que-criou',
  });
  // Item de um NPC que não é aliado de ninguém (a esmagadora maioria: 228
  // itens de NPC no banco, só 14 de aliado).
  await setDoc(doc(db, 'items', 'item-de-npc-alheio'), {
    nome: 'Espada do Guarda', characterId: 'npc-1', ownerUid: '',
  });
  // Uma peça na Caixa do Mestre, como o servidor a grava.
  await setDoc(doc(db, 'items', 'item-na-caixa'), {
    nome: 'Bugiganga', characterId: CAIXA, ownerUid: '', ownerType: 'caixa',
    quantidade: 1, origemItemNome: 'Bugiganga', origemJogadorUid: JOG,
  });
});

const db = env.authenticatedContext(JOG, { email: EMAIL }).firestore();
const eu = doc(db, 'users', JOG);
const ok = [], falhou = [];
const teste = async (nome, fn) => {

  try { await fn(); ok.push(nome); } catch (e) { falhou.push(`${nome} → ${e.message}`); }
};

// ===== O QUE TEM DE SER NEGADO =====
await teste('não promove a si mesmo a criador',
  () => assertFails(updateDoc(eu, { role: 'criador' })));
await teste('não promove a si mesmo a mestre',
  () => assertFails(updateDoc(eu, { role: 'mestre' })));
await teste('não grava uid de outra pessoa (update)',
  () => assertFails(updateDoc(eu, { uid: VIT })));
await teste('não grava o próprio uid depois (identidade é imutável)',
  () => assertFails(updateDoc(eu, { uid: JOG })));
await teste('não troca o e-mail para o de outra pessoa',
  () => assertFails(updateDoc(eu, { email: 'vitima@teste.com' })));
await teste('não se dá Frag$',
  () => assertFails(updateDoc(eu, { fragmentos: 99999 })));
await teste('não escreve no doc de outra pessoa',
  () => assertFails(updateDoc(doc(db, 'users', VIT), { displayName: 'roubado' })));

// Conta nova: create
const novo = env.authenticatedContext('uid-novo', { email: 'novo@teste.com' }).firestore();
const dNovo = doc(novo, 'users', 'uid-novo');
await teste('conta nova não nasce criadora',
  () => assertFails(setDoc(dNovo, { email: 'novo@teste.com', role: 'criador' })));
await teste('conta nova não nasce com o uid de outra pessoa',
  () => assertFails(setDoc(dNovo, { email: 'novo@teste.com', uid: VIT })));
await teste('conta nova não nasce com o e-mail de outra pessoa',
  () => assertFails(setDoc(dNovo, { email: 'vitima@teste.com' })));
await teste('conta nova não nasce com Frag$',
  () => assertFails(setDoc(dNovo, { email: 'novo@teste.com', fragmentos: 500 })));
await teste('conta nova não nasce com inventário',
  () => assertFails(setDoc(dNovo, { email: 'novo@teste.com', inventario: [{ nome: 'EXP', quantidade: 99 }] })));

// ===== A CAIXA DO MESTRE (item 3) =====
// A cadeia era: criar `char/__caixa_mestre__<mesaId>` em nome próprio → virar
// "dono do personagem" de tudo que está na caixa → reescrever a própria peça
// com 999 unidades e o nome da linha mais cara → pedir a recusa ao mestre.
await teste('não cria personagem no namespace do servidor (__)',
  () => assertFails(setDoc(doc(db, 'char', CAIXA), { ownerUid: JOG, nome: 'fake' })));
await teste('não cria personagem com qualquer outro id reservado',
  () => assertFails(setDoc(doc(db, 'char', '__seja_o_que_for'), { ownerUid: JOG })));

// Mesmo que o doc de char existisse, a peça na caixa não é editável pelo cliente.
await env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'char', CAIXA), { ownerUid: JOG, nome: 'plantado' });
});
await teste('não edita peça na Caixa do Mestre nem sendo "dono" do char da caixa',
  () => assertFails(updateDoc(doc(db, 'items', 'item-na-caixa'), { quantidade: 999, origemItemNome: 'Pacote de 500 EXP' })));
await teste('não apaga peça na Caixa do Mestre',
  () => assertFails(deleteDoc(doc(db, 'items', 'item-na-caixa'))));

// ===== LOGS: trilha de auditoria (item 13) =====
// O create e aberto porque quem escreve e o JOGADOR (a ficha registra cada
// mudanca dele). O que faltava era conferencia: dava para assinar log com o
// e-mail de outra pessoa, numa colecao que existe para dizer quem fez o que.
const logBase = { user: EMAIL, action: 'mexeu na ficha', timestamp: '2026-08-31T00:00:00Z', character: 'Fulano' };
await teste('grava log em nome próprio',
  () => assertSucceeds(setDoc(doc(db, 'logs', 'log-1'), logBase)));
await teste('não assina log com o e-mail de outra pessoa',
  () => assertFails(setDoc(doc(db, 'logs', 'log-2'), { ...logBase, user: 'vitima@teste.com' })));
await teste('não grava log sem autor',
  () => assertFails(setDoc(doc(db, 'logs', 'log-3'), { action: 'anônimo', timestamp: 'x' })));
await teste('não grava ação gigante',
  () => assertFails(setDoc(doc(db, 'logs', 'log-4'), { ...logBase, action: 'a'.repeat(1001) })));
await teste('não reescreve log já gravado',
  () => assertFails(updateDoc(doc(db, 'logs', 'log-1'), { action: 'não fui eu' })));
await teste('não apaga log',
  () => assertFails(deleteDoc(doc(db, 'logs', 'log-1'))));
await teste('jogador não lê a trilha dos outros',
  () => assertFails(getDocs(collection(db, 'logs'))));

// ===== PRIVACIDADE DE `users` (item 6) =====
// A leitura era aberta: uma consulta trazia e-mail, saldo, Repertório e
// histórico de compras em reais de todo mundo.
await teste('não lê o documento de outra pessoa',
  () => assertFails(getDoc(doc(db, 'users', VIT))));
await teste('não lista a coleção users inteira',
  () => assertFails(getDocs(collection(db, 'users'))));
// ...mas o que a mesa precisa saber dos outros continua acessível
await teste('lê o espelho público de outra pessoa',
  () => assertSucceeds(getDoc(doc(db, 'users_public', VIT))));
await teste('lista users_public (soma coletiva das Metas)',
  () => assertSucceeds(getDocs(collection(db, 'users_public'))));
await teste('não escreve no espelho público',
  () => assertFails(setDoc(doc(db, 'users_public', JOG), { displayName: 'forjado' })));
await teste('não escreve no espelho público de outra pessoa',
  () => assertFails(updateDoc(doc(db, 'users_public', VIT), { apoios: [{ montante: 9999, meta: 'x' }] })));

// ===== NPCs (item 5) =====
// Vinha `allow update: if isSignedIn()`: qualquer conta reescrevia qualquer NPC.
const npc = doc(db, 'npcs', 'npc-1');
await teste('não reescreve a ficha de um NPC',
  () => assertFails(updateDoc(npc, { atributos: { FOR: 99 } })));
await teste('não renomeia um NPC',
  () => assertFails(updateDoc(npc, { nome: 'vandalizado' })));
await teste('não mexe no loot de um NPC',
  () => assertFails(updateDoc(npc, { loot: { luns: '99999' } })));
await teste('não reescreve os segredos do NPC',
  () => assertFails(updateDoc(npc, { rolePlay: { segredos: 'nada' } })));
await teste('não muda a visibilidade da ficha do NPC (é do mestre)',
  () => assertFails(updateDoc(npc, { visibilidade: 'publico' })));
await teste('não desvincula o NPC da mesa',
  () => assertFails(updateDoc(npc, { mesaId: '', vinculos: [] })));
await teste('não apaga NPC',
  () => assertFails(deleteDoc(npc)));
await teste('não cria NPC',
  () => assertFails(setDoc(doc(db, 'npcs', 'npc-novo'), { nome: 'meu' })));
// ===== ITENS DE NPC (a outra metade do item 5) =====
// Era `exists(npcs/<characterId>)`: a mera existência do NPC bastava, então
// qualquer conta logada editava e apagava item de qualquer NPC do cenário.
await teste('não edita item de NPC que não é aliado seu',
  () => assertFails(updateDoc(doc(db, 'items', 'item-de-npc-alheio'), { nome: 'roubada' })));
await teste('não apaga item de NPC que não é aliado seu',
  () => assertFails(deleteDoc(doc(db, 'items', 'item-de-npc-alheio'))));
// ...mas o inventário do PRÓPRIO aliado continua nas mãos do jogador
await teste('edita item do próprio aliado (mesmo criado pelo mestre)',
  () => assertSucceeds(updateDoc(doc(db, 'items', 'item-do-aliado'), { nome: 'Adaga afiada' })));
await teste('apaga item do próprio aliado',
  () => assertSucceeds(deleteDoc(doc(db, 'items', 'item-do-aliado'))));

// ...mas o combate na mesa continua funcionando, e é isso que torna a regra usável
await teste('aplica dano no NPC em combate (valoresDer.atual)',
  () => assertSucceeds(updateDoc(npc, { 'valoresDer.atual.VIT': 12 })));
await teste('põe condição no NPC',
  () => assertSucceeds(updateDoc(npc, { conditions: ['Sangrando'] })));
await teste('não passa dano junto com edição de ficha',
  () => assertFails(updateDoc(npc, { 'valoresDer.atual.VIT': 12, nome: 'de carona' })));

// ===== O QUE TEM DE CONTINUAR FUNCIONANDO =====
await teste('cadastro normal passa (sem role, e-mail do próprio token)',
  () => assertSucceeds(setDoc(dNovo, { email: 'novo@teste.com', displayName: 'Novo', createdAt: 'hoje' })));
await teste('pedido de cargo passa (cargoSolicitado é livre)',
  () => assertSucceeds(updateDoc(eu, { cargoSolicitado: 'mestre' })));
await teste('marcar notificação como lida passa',
  () => assertSucceeds(updateDoc(eu, { notifications: [{ id: 'x', isNew: false }] })));
await teste('trocar o próprio nome passa',
  () => assertSucceeds(updateDoc(eu, { displayName: 'Outro nome' })));
await teste('ler o próprio doc passa',
  () => assertSucceeds(getDoc(eu)));
await teste('criar personagem normal passa',
  () => assertSucceeds(setDoc(doc(db, 'char', 'char_123_abc'), { ownerUid: JOG, nome: 'Personagem' })));
// O mestre continua com a caneta inteira — esta é a asserção que impede a
// regra de NPC de virar um tiro no pé do painel do mestre.
const MESTRE = 'uid-mestre';
await env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'masters', MESTRE), { desde: 'sempre' });
});
const dbMestre = env.authenticatedContext(MESTRE, { email: 'mestre@teste.com' }).firestore();
await teste('MESTRE edita a ficha inteira do NPC',
  () => assertSucceeds(updateDoc(doc(dbMestre, 'npcs', 'npc-1'), {
    nome: 'Guarda veterano', atributos: { FOR: 5 }, loot: { luns: '80' },
  })));
await teste('MESTRE edita peça na Caixa do Mestre',
  () => assertSucceeds(updateDoc(doc(dbMestre, 'items', 'item-na-caixa'), { quantidade: 2 })));
await teste('MESTRE lista a coleção users (é o que o painel faz)',
  () => assertSucceeds(getDocs(collection(dbMestre, 'users'))));
await teste('MESTRE lê o documento de um jogador',
  () => assertSucceeds(getDoc(doc(dbMestre, 'users', JOG))));
await teste('MESTRE lê a trilha de auditoria',
  () => assertSucceeds(getDocs(collection(dbMestre, 'logs'))));
await teste('MESTRE edita item de qualquer NPC',
  () => assertSucceeds(updateDoc(doc(dbMestre, 'items', 'item-de-npc-alheio'), { nome: 'ajustada pelo mestre' })));
await teste('MESTRE apaga NPC',
  () => assertSucceeds(deleteDoc(doc(dbMestre, 'npcs', 'npc-1'))));

await teste('editar item da própria ficha passa',
  async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'items', 'item-meu'), {
        nome: 'Espada', characterId: 'char_123_abc', ownerUid: 'outro-qualquer',
      });
    });
    await assertSucceeds(updateDoc(doc(db, 'items', 'item-meu'), { nome: 'Espada afiada' }));
  });

console.log('\n══════ RULES: users ══════');
for (const t of ok) console.log('  OK   ' + t);
for (const t of falhou) console.log('  FALHOU ' + t);
console.log(`\n${ok.length} passaram, ${falhou.length} falharam`);
await env.cleanup();
process.exit(falhou.length ? 1 : 0);
