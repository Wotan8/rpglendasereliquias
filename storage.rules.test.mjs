/* =============================================
   RULES DO STORAGE — quem sobe o quê, e de que tamanho
   =============================================
   Mesmo harness do firestore.rules.test.mjs (ver o cabeçalho de lá), mas
   sobe também o emulador de Storage:

     npx firebase-tools@13 emulators:exec --only firestore,storage \
       --project demo-rules "node storage.rules.test.mjs"

   Precisa de um firebase.json ao lado apontando as portas e os dois arquivos
   de rules, e de `npm i @firebase/rules-unit-testing firebase`.

   Por que existe: até 31/08/2026 todo caminho era `allow write: if
   request.auth != null`. Qualquer conta registrada trocava o favicon e o hero
   do Portal — que são de leitura pública e aparecem ANTES do login — e a
   imagem de qualquer item da Loja. Sem limite de tamanho nem de tipo.

   O papel vem do Firestore, então o teste grava os `users` antes: um jogador
   SEM campo `role` (o caso que fazia a regra errar em vez de negar), um
   mestre e um criador.
   ============================================= */
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes } from 'firebase/storage';
import fs from 'node:fs';

const JOG = 'uid-jogador', MESTRE = 'uid-mestre', CRIADOR = 'uid-criador';
const env = await initializeTestEnvironment({
  projectId: 'demo-rules',
  firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8532 },
  storage:   { rules: fs.readFileSync('storage.rules', 'utf8'),   host: '127.0.0.1', port: 9299 },
});

// Os papéis vivem no Firestore — é de lá que a rule do Storage os lê.
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  const { doc, setDoc } = await import('firebase/firestore');
  await setDoc(doc(db, 'users', JOG), { displayName: 'Jogador' });          // SEM role
  await setDoc(doc(db, 'users', MESTRE), { displayName: 'M', role: 'mestre' });
  await setDoc(doc(db, 'users', CRIADOR), { displayName: 'C', role: 'criador' });
});

const png = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const st = (uid) => env.authenticatedContext(uid).storage();
const ok = [], falhou = [];
const teste = async (nome, fn) => { try { await fn(); ok.push(nome); } catch (e) { falhou.push(`${nome} → ${e.message}`); } };
const sobe = (uid, caminho, dados = png, tipo = 'image/png') =>
  uploadBytes(ref(st(uid), caminho), dados, { contentType: tipo });

// ===== JOGADOR NAO MEXE NO QUE E DE ADMINISTRACAO =====
await teste('jogador não troca o favicon do site',
  () => assertFails(sobe(JOG, 'app-assets/favicons/index.png')));
await teste('jogador não troca o hero do Portal',
  () => assertFails(sobe(JOG, 'app-assets/portal-hero/1.png')));
await teste('jogador não troca imagem de item da Loja',
  () => assertFails(sobe(JOG, 'loja-itens/exp500.png')));
await teste('jogador não sobe glifo rúnico',
  () => assertFails(sobe(JOG, 'runic-elements/fogo.png')));
await teste('jogador não sobe terreno do Hexmap',
  () => assertFails(sobe(JOG, 'hexmap-terrain/mata.png')));
await teste('jogador não sobe imagem do Cronista',
  () => assertFails(sobe(JOG, 'worldbuilding-images/conto.png')));
// mestre não é criador
await teste('mestre não troca o favicon (é do Criador)',
  () => assertFails(sobe(MESTRE, 'app-assets/favicons/index.png')));

// ===== SO IMAGEM, E SO ATE O TETO =====
await teste('não sobe arquivo que não é imagem',
  () => assertFails(sobe(JOG, 'imagens/malware.html', png, 'text/html')));
await teste('não sobe imagem acima de 10 MB',
  () => assertFails(sobe(JOG, 'imagens/gigante.png', new Uint8Array(11 * 1024 * 1024))));
await teste('não sobe em caminho fora dos previstos',
  () => assertFails(sobe(JOG, 'qualquer-outra-pasta/x.png')));

// ===== O QUE TEM DE CONTINUAR FUNCIONANDO =====
await teste('jogador sobe imagem do personagem',
  () => assertSucceeds(sobe(JOG, 'char-images/meu.png')));
await teste('jogador sobe imagem de item (campo padrão)',
  () => assertSucceeds(sobe(JOG, 'imagens/adaga.png')));
await teste('jogador sobe token no Tabuleiro',
  () => assertSucceeds(sobe(JOG, 'tabuleiro-images/mesa1/token.png')));
await teste('imagem de 7 MB passa (o cliente já corta em 8)',
  () => assertSucceeds(sobe(JOG, 'imagens/mapa.png', new Uint8Array(7 * 1024 * 1024))));
await teste('MESTRE sobe imagem de item da Loja',
  () => assertSucceeds(sobe(MESTRE, 'loja-itens/exp500.png')));
await teste('MESTRE sobe terreno do Hexmap',
  () => assertSucceeds(sobe(MESTRE, 'hexmap-terrain/mata.png')));
await teste('CRIADOR troca o favicon',
  () => assertSucceeds(sobe(CRIADOR, 'app-assets/favicons/index.png')));
await teste('CRIADOR troca o hero do Portal',
  () => assertSucceeds(sobe(CRIADOR, 'app-assets/portal-hero/1.png')));
await teste('CRIADOR sobe glifo rúnico',
  () => assertSucceeds(sobe(CRIADOR, 'runic-elements/fogo.png')));
await teste('hero do Portal é lido SEM login (aparece antes de entrar)',
  () => assertSucceeds(getBytes(ref(env.unauthenticatedContext().storage(), 'app-assets/portal-hero/1.png'))));

console.log('\n══════ STORAGE ══════');
for (const t of ok) console.log('  OK   ' + t);
for (const t of falhou) console.log('  FALHOU ' + t);
console.log(`\n${ok.length} passaram, ${falhou.length} falharam`);
await env.cleanup();
process.exit(falhou.length ? 1 : 0);
