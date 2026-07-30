/**
 * Preenche formulaDano nas armas cadastradas fora do Livro, usando a tabela de
 * dano do Capítulo 6 de "Lendas e Relíquias v1.7" (sistema antigo e lore/).
 *
 * Cada valor abaixo é o dado da arma EQUIVALENTE no Livro, escolhida pela
 * descrição da peça (comprimento, empunhadura, categoria) — não é arbitragem
 * nova. As 45 armas do Livro já cadastradas batem 1:1 com a tabela, então isto
 * só estende a mesma escala.
 *
 * Tabela do Livro (Cap. 6):
 *   Facas/Adagas: Faca 1d4 · Adaga 1d4 · Estilete 1d4 · Punhal 1d6
 *   Espadas: Curta 1d6 · Longa 1d8 · Bastarda 1d8/1d10 · Montante 1d12 · Sabre 1d8
 *   Machados: Machadinha 1d6 · de Batalha 1d8 · de Guerra 1d12
 *   Hastes: Lança Curta 1d6 · Lança 1d8 · Alabarda/Glaive/Foice de Guerra 1d10
 *   Arcos: Curto 1d6 · Longo 1d8 · Composto 1d8 · de Guerra 1d10
 *   Bestas: de Mão 1d4 · Leve 1d6 · de Repetição 1d6 · Pesada 1d10
 *
 * NÃO recebem dano (o Livro é explícito): escudos dão só Blindagem (+1 a +4),
 * a Rede tem dano "—", e as Aljavas são porta-munição, não arma.
 *
 * node functions/preencher-dano-armas.mjs          → dry-run
 * node functions/preencher-dano-armas.mjs --write  → grava
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const WRITE = process.argv.includes('--write');

const DANO = {
    // --- Adagas e facas: todas ~22cm, lâmina curta → Faca/Adaga 1d4
    'Adaga de Lastro': ['1d4', 'adaga urbana de 22 cm → Adaga (1d4)'],
    'Faca celene': ['1d4', 'faca de campo de 22 cm → Faca (1d4)'],
    'Faca de Caça': ['1d4', 'lâmina utilitária de caça → Faca (1d4)'],
    'Faca de Sangria': ['1d4', 'lâmina curta de emergência, peso 0.5 → Faca (1d4)'],

    // --- Espadas: ambas descritas como lâmina longa de ~85cm
    'Espada de Infantaria': ['1d8', 'espada longa de 85 cm, uma mão → Espada Longa (1d8)'],
    'Espada Simples': ['1d8', 'lâmina longa e equilibrada → Espada Longa (1d8)'],

    // --- Haste
    'Foice Simples de Guerra': ['1d10', 'versão militar da foice → Foice de Guerra (1d10)'],

    // --- Machado: 35cm é machadinha, não machado de guerra
    'Machado de Mão Karu': ['1d6', 'machado de mão de 35 cm → Machadinha (1d6)'],

    // --- Arcos
    'Arco Simples': ['1d6', 'arco genérico de entrada → Arco Curto (1d6)'],
    'Arco Garnute': ['1d6', 'a descrição diz "arco curto de 80 cm" → Arco Curto (1d6)'],

    // --- Bestas
    'Besta Menin': ['1d4', 'a descrição abre com "Besta de Mão", 45 cm → Besta de Mão (1d4)'],
    'Besta de Caça': ['1d4', 'compacta e "menos poderosa que uma besta convencional" → Besta de Mão (1d4)'],
    // AMBÍGUA: "pesada de repetição" mistura duas linhas do Livro (Pesada 1d10 /
    // Repetição 1d6). "de Sítio" + 1,10 m + duas mãos pesa para a Pesada.
    'Besta de Sítio Gélida': ['1d10', 'besta pesada de sítio, 1,10 m, duas mãos → Besta Pesada (1d10)'],
};

// Sem dano por regra do Livro — não são omissão.
const SEM_DANO = ['Escudo', 'Aljava', 'Enredante'];

const snap = await db.collection('system/data/equipment').get();
const itens = snap.docs.map(d => ({ ref: d.ref, ...d.data() }));
const lote = db.batch();
let mudados = 0;

console.log('########## A PREENCHER ##########');
for (const [nome, [dado, motivo]] of Object.entries(DANO)) {
    const item = itens.find(i => (i.nome || '').trim() === nome);
    if (!item) { console.log(`  ❌ não encontrado: ${nome}`); continue; }
    if (String(item.formulaDano || '').trim()) {
        console.log(`  = ${nome}: já tem ${item.formulaDano}`);
        continue;
    }
    lote.update(item.ref, { formulaDano: dado });
    console.log(`  + ${nome.padEnd(26)} ${dado.padEnd(5)} ${motivo}`);
    mudados++;
}

const armas = itens.filter(i => i.tipo === 'Arma');
// Só conta como "sem dano por regra" quem de fato está vazio — a Boleadeira é
// Enredante mas o Livro dá 1d4 a ela, então ela não entra nesta lista.
const semDanoOk = armas.filter(i => !String(i.formulaDano || '').trim()
    && (i.tags || []).some(t => SEM_DANO.includes(t)));
const restam = armas.filter(i => !String(i.formulaDano || '').trim()
    && !(i.nome in DANO) && !semDanoOk.includes(i));

console.log(`\n########## SEM DANO POR REGRA (${semDanoOk.length}) ##########`);
semDanoOk.forEach(i => console.log(`  ${i.nome} — ${(i.tags || []).filter(t => SEM_DANO.includes(t))}`));

console.log(`\n########## AINDA SEM DANO E SEM EXPLICAÇÃO (${restam.length}) ##########`);
restam.forEach(i => console.log(`  ⚠️ ${i.nome}`));
if (!restam.length) console.log('  nenhuma.');

console.log(`\narmas: ${armas.length} | com dano após esta rodada: ${armas.length - semDanoOk.length - restam.length}`);

if (!mudados) { console.log('\nNada a gravar.'); process.exit(); }
if (WRITE) { await lote.commit(); console.log(`\n✅ ${mudados} armas preenchidas.`); }
else console.log('\n(dry-run — rode com --write para gravar)');
process.exit();
