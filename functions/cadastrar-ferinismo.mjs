/**
 * Reestruturação da Totemancia em três ramos (Espiritismo / Patuísmo / Ferinismo).
 * Aplica os textos de classe aprovados, as fórmulas novas do Druida e a seção
 * 7.7 do Livro de Regras do Jogador.
 *
 *   node functions/cadastrar-ferinismo.mjs           → só mostra o plano
 *   node functions/cadastrar-ferinismo.mjs --apply   → grava
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const APLICAR = process.argv.includes('--apply');
const agora = admin.firestore.Timestamp.now();
const fixo1 = (alvo) => ({ operacao: '+', alvo, equacao: [{ tipo: 'fixo', valor: 1 }] });
const ficha = (ref, op) => (op ? { tipo: 'ficha', ref, op } : { tipo: 'ficha', ref });

/* ---------------------------------------------------------------- textos --- */

const DRUIDA_DESC =
  'O Druida é o canal vivo entre o mundo animal e os segredos das plantas. Com um olhar, acalma feras. ' +
  'Com um punhado de folhas, cria loções capazes de curar ou destruir. Mas seu poder maior não se colhe ' +
  'nem se prepara: conquista-se. Pelo Ferinismo — o ramo feral da Totemancia — ele partilha a própria ' +
  'carne com um aliado que aprendeu a confiar nele, e por um instante os dois deixam de ser dois. ' +
  'Nenhuma fera é obrigada a isso. Ele não impõe sua vontade à natureza: interpreta e conduz o fluxo ' +
  'vivo do mundo, e espera o tempo que a lealdade levar.\n';

const XAMA_DESC =
  'O Xamã é um conjurador espiritual que caminha entre os mundos: o dos vivos e o dos Ecos. Pelo ' +
  'Espiritismo — o ramo da Totemancia que olha para trás, para os que já partiram — ele crava totens, ' +
  'busca vestígios de alma nas nuances da Essência Verde e negocia com o que restou dos mortos. Sua ' +
  'força vem da transcendência: projetar a consciência para além do Véu, ou abrir a própria carne para ' +
  'que um Eco a divida com ele. Os Ecos sem morada precisam ser chamados a cada vez; só a Madeira de ' +
  'Antiqua os guarda perto o bastante para dispensar o chamado.\n';

/* Seção nova do Livro de Regras — entra depois de 7.6, no fim do capítulo. */
const SECAO_77 = `
<h2>7.7 Domando Criaturas</h2>
<p>Domar não é privilégio de classe. Qualquer personagem pode tentar ganhar a confiança de uma criatura — o que muda entre um Druida e um ferreiro é a facilidade, não a permissão.</p>
<p><strong>Alvo = AUT + Domar.</strong> <strong>Redutor = o Redutor da criatura.</strong></p>
<p>Cada criatura carrega o próprio Redutor, e ele não está aqui: está na ficha dela, no <strong>Bestiário</strong>. Um animal de carga criado entre pessoas resiste pouco; um predador adulto, muito; algo que nunca viu um humano de perto pode nem ter número — o Narrador decide se é domável.</p>
<p><strong>A abordagem altera o Redutor.</strong> O teste não mede só a sua perícia: mede a situação em que a criatura te encontra. Chegar por cima, encurralar, cheirar a sangue, aproximar-se de uma ninhada, insistir depois de uma recusa — tudo isso <em>soma</em> ao Redutor, e uma abordagem ruim pode empurrar uma criatura fácil para fora do seu alcance. O contrário também vale: paciência, comida, ferimento tratado e a distância certa podem reduzi-lo.</p>
<p>É por isso que <strong>consultar o Bestiário antes vale mais do que rolar bem</strong>. A entrada da criatura diz o que ela teme, o que ela come e o que ela entende como ameaça. Quem lê primeiro faz o teste que quer; quem não lê faz o teste que a criatura permite.</p>
<p><strong>Com sucesso</strong>, a criatura passa a acompanhar você e aparece na <strong>Aba Aliados</strong> da ficha. <strong>Na falha</strong>, ela se afasta, ataca ou simplesmente ignora — e uma nova tentativa parte de um Redutor pior, porque agora ela já te conhece.</p>
<p><strong>Aliado não é obediência.</strong> Ter uma criatura como Aliada significa apenas que ela está com você — por interesse, por hábito, por comida ou por afeto. Ela não obedece cegamente, não se joga na frente de uma lâmina e pode ir embora. Uma companhia mais profunda que isso — em que o animal empresta os sentidos, ou o corpo — é o <strong>vínculo</strong>, e vínculo não se ganha num teste: constrói-se com Lealdade, ao longo de sessões, e é o que o Druida faz pelo Ferinismo (Capítulo de classe).</p>
`.trim();

/* ------------------------------------------------------------- alterações --- */

const plano = [];
const add = (ref, o) => plano.push({ ref, ...o });

/* 1. Druida — textos aprovados (Opção 1 de especialidade) */
add('system/data/classes/l7zlhsuXN6PIXCetcaj3', {
  rotulo: 'Classe Druida — textos',
  patch: {
    arquetipo: 'Guardião, Vínculo Selvagem e Loções',
    especialidade: 'Natureza | Suporte | Alquimancia e Totemancia',
    descricao: DRUIDA_DESC,
    papelEmCena: [{
      combate: '•  Convoca e comanda aliados selvagens\n' +
        '•  Usa loções defensivas/ofensivas e imbui projéteis ou áreas\n' +
        '•  Entra em Fusão Selvagem para ampliar os próprios sentidos ou agir pelo corpo do aliado',
      foraCombate: '•  Identifica ingredientes e prepara receitas\n' +
        '•  Doma criaturas e cultiva a lealdade delas até o vínculo\n' +
        '•  Media conflitos em territórios naturais',
    }],
  },
});

/* 2. Xamã — textos aprovados */
add('system/data/classes/sNk4fBoUt4DGxUQThIZb', {
  rotulo: 'Classe Xamã — textos',
  patch: {
    especialidade: 'Espiritismo | Comunhão | Totemancia',
    descricao: XAMA_DESC,
    papelEmCena: [{
      combate: '•  Incorpora Ecos para ganhar poderes, atributos e conhecimentos temporários\n' +
        '•  Projeta a consciência no Eco e age por meio dele, com o próprio corpo em transe\n' +
        '•  Expulsa espíritos invasores de aliados, objetos ou lugares\n' +
        '•  Percebe presenças e correntes de essência que ninguém mais enxerga',
      foraCombate: '•  Interroga Ecos sobre eventos passados, locais ou segredos\n' +
        '•  Crava totens e lê os vestígios de alma que a Essência Verde guardou\n' +
        '•  Realiza rituais de purificação e exorcismo; liberta Ecos aprisionados\n' +
        '•  Negocia com espíritos por informações, favores ou poder — e honra o que prometeu',
    }],
  },
});

/* 3. Fusão Selvagem — Aliado Animal sai, Fluxomancia entra */
add('system/data/mechanics/LkQ3fv05wvgc5sSK2qlh', {
  rotulo: 'Mecânica Fusão Selvagem — fórmula',
  patch: {
    config: { calculos: [{ operacao: '+', alvo: 'Fusão Selvagem', equacao: [
      ficha('PRE'), ficha('Perícia: Fluxomancia', '+'), ficha('Perícia: Linguagem Animal', '+')] }] },
    previewTexto: '+([PRE] + [Perícia: Fluxomancia] + [Perícia: Linguagem Animal]) em Fusão Selvagem',
  },
});

/* 4. Convocar Manada — Liderança fica, Linguagem Animal sai, Fluxomancia entra */
add('system/data/mechanics/nvo91aBHb6aQ73oLvr2U', {
  rotulo: 'Mecânica Convocar Manada — fórmula',
  patch: {
    config: { calculos: [{ operacao: '+', alvo: 'Convocar Manada', equacao: [
      ficha('PRE'), ficha('Perícia: Liderança', '+'), ficha('Perícia: Fluxomancia', '+')] }] },
    previewTexto: '+([PRE] + [Perícia: Liderança] + [Perícia: Fluxomancia]) em Convocar Manada',
  },
});

/* 5. Domar Aliado -> Vínculo Animal (mecânica): muda de nome e de função. */
add('system/data/mechanics/xMj0n6gunC6AT3B3tyWB', {
  rotulo: 'Mecânica Domar Aliado -> Vínculo Animal',
  patch: {
    nome: 'Vínculo Animal',
    config: { calculos: [{ operacao: '+', alvo: 'Vínculo Animal', equacao: [
      ficha('PRE'), ficha('Perícia: Domar', '+'), ficha('Perícia: Fluxomancia', '+')] }] },
    previewTexto: '+([PRE] + [Perícia: Domar] + [Perícia: Fluxomancia]) em Vínculo Animal',
  },
});

/* 6. VD Domar Aliado -> Vínculo Animal */
add('system/data/derivedValues/JXaPuGDZCqW8P48EUVrV', {
  rotulo: 'VD Domar Aliado -> Vínculo Animal',
  patch: {
    nome: 'Vínculo Animal',
    descricao: 'Sela o vínculo entre o Druida e um Aliado Animal que já acompanha o grupo. ' +
      'Exige Lealdade igual ou maior que o limiar do Druida. Só depois do vínculo selado o ' +
      'Druida pode usar a Fusão Selvagem com aquele aliado. Conseguir a criatura é outro teste, ' +
      'universal a qualquer classe (AUT + Domar, com o Redutor da criatura).',
  },
});

/* 7. Módulo do Druida: Animalomancia -> Ferinismo, e o item renomeado */
add('system/data/classModules/ally_animal', {
  rotulo: 'Módulo Animalomancia -> Ferinismo',
  patchFn: (atual) => ({
    titulo: 'Ferinismo',
    itensPredefinidos: (atual.itensPredefinidos || []).map(it =>
      it.id === 'pdi_1784476430077_wft41f'
        ? { ...it, nome: 'Vínculo Animal',
            descricao: 'Sela o vínculo com um Aliado Animal que já tenha Lealdade suficiente. ' +
              'Só depois do vínculo selado a Fusão Selvagem pode ser usada com aquele aliado.' }
        : it),
  }),
});

/* 8. Perícias iniciais do Druida ganham Fluxomancia (portão dos três testes) */
add('system/data/mechanics/xUeykrUZUUdSBGFV4JlN', {
  rotulo: 'Perícias Iniciais do Druida MOD — +1 Fluxomancia',
  patch: {
    config: { calculos: [fixo1('Perícia: Domar'), fixo1('Perícia: Herbalismo'), fixo1('Perícia: Fluxomancia')] },
    previewTexto: '+1 em Perícia: Domar; +1 em Perícia: Herbalismo; +1 em Perícia: Fluxomancia',
  },
});

/* 9. Livro de Regras do Jogador — seção 7.7 no fim do Capítulo 7 */
add('worldbuilding-articles/art-regras-jogador-07', {
  rotulo: 'Livro de Regras — nova seção 7.7 Domando Criaturas',
  patchFn: (atual) => {
    if ((atual.contentHTML || '').includes('7.7 Domando Criaturas')) return null;  // idempotente
    const html = (atual.contentHTML || '').trimEnd() + '\n\n' + SECAO_77 + '\n';
    return {
      contentHTML: html,
      words: html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
      synopsis: 'Descanso e Pontos de Recuperação, fome e sede, ritmos de viagem, clima, condições, ' +
        'perigos naturais e como domar criaturas.',
      updatedAt: Date.now(),
    };
  },
  timestamps: false,   // este doc usa updatedAt numérico, tratado acima
});

/* ------------------------------------------------------------------ run --- */

console.log(`\n===== PLANO (${plano.length} documentos) =====\n`);
const gravar = [];
for (const p of plano) {
  const snap = await db.doc(p.ref).get();
  if (!snap.exists) { console.log(`❌ ${p.rotulo}\n   ${p.ref} NAO EXISTE — abortando`); process.exit(1); }
  const atual = snap.data();
  const patch = p.patchFn ? p.patchFn(atual) : p.patch;
  if (!patch) { console.log(`⏭️  ${p.rotulo}\n   já aplicado, pulando\n`); continue; }

  console.log(`• ${p.rotulo}\n  ${p.ref}`);
  for (const [k, v] of Object.entries(patch)) {
    const antes = JSON.stringify(atual[k]);
    const depois = JSON.stringify(v);
    if (antes === depois) { console.log(`    ${k}: (sem mudança)`); continue; }
    const corta = (s) => (s || '').length > 150 ? (s || '').slice(0, 150) + '…' : (s || '(vazio)');
    console.log(`    ${k}:\n       antes : ${corta(antes)}\n       depois: ${corta(depois)}`);
  }
  console.log('');

  if (p.timestamps !== false) {
    patch.updatedAt = agora;
    if (atual.atualizadoEm) patch.atualizadoEm = agora;
    if (typeof atual.versao === 'number') patch.versao = atual.versao + 1;
  }
  gravar.push({ ref: p.ref, patch, rotulo: p.rotulo });
}

if (!APLICAR) { console.log('\n(dry-run — rode com --apply para gravar)'); process.exit(0); }

for (const g of gravar) {
  await db.doc(g.ref).update(g.patch);
  console.log(`✅ ${g.rotulo}`);
}
console.log(`\n${gravar.length} documento(s) atualizado(s).`);
process.exit(0);
