/**
 * Item 9: o contra-jogo do arnês estava sem oferta.
 *
 * O catálogo tinha 28 armas cortantes, 23 perfurantes e 7 contundentes — e é o
 * contundente que fura placa (§5.4). Quem quisesse responder a um arnês pesado
 * tinha um sétimo das opções de quem responde a couro.
 *
 * Estas quatro fecham buracos MECÂNICOS da família, não de sabor:
 *   1d6 duas mãos   — não existia contundente de haste longa e alcance
 *   1d8 uma mão     — só o Mangual ocupava a faixa, e ele é arma de perito
 *   1d10 duas mãos  — degrau vazio entre o Mangual (1d8) e o Malho (1d12)
 *   1d4 arremesso   — a família não tinha NENHUMA arma de arremesso
 *
 * Nomes históricos comuns, nada de cultura ou lugar inventado.
 *
 *   node functions/cadastrar-contundentes.mjs            (dry-run)
 *   node functions/cadastrar-contundentes.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'M2rZzlQkzxTrrddeFQ10S6zsfX62';

const NOVAS = [
    {
        nome: 'Bordão', dado: '1d6', cat: 'duas_maos', peso: 2, tamanho: 3, preco: 100,
        descricao: 'Vara de madeira rija da altura de um homem, ponteira de ferro nas duas extremidades. '
            + 'Arma de peregrino e de quem não pode andar armado: ninguém prende um viajante por levar bengala.'
    },
    {
        nome: 'Maça de Armas', dado: '1d8', cat: 'uma_mao', peso: 3, tamanho: 2, preco: 900,
        descricao: 'Cabeça de aletas de aço soldadas em torno do eixo. As arestas concentram a pancada num ponto '
            + 'só e afundam a placa em vez de escorregar nela. É a arma que o cavaleiro leva para enfrentar outro cavaleiro.'
    },
    {
        nome: 'Marreta de Guerra', dado: '1d10', cat: 'duas_maos', peso: 6, tamanho: 3, preco: 800,
        descricao: 'Cabeça de ferro maciço em cabo longo, feita para quebrar o que está dentro da armadura sem '
            + 'precisar abrir a armadura. Lenta de erguer, e quem erra fica exposto o bastante para lamentar.'
    },
    {
        nome: 'Funda', dado: '1d4', cat: 'distancia', peso: 0.5, tamanho: 1, preco: 40,
        descricao: 'Tira de couro e uma pedra do chão. Arma de pastor, e a mais barata que existe — o projétil '
            + 'está em todo lugar. A pedra não corta nem fura: quebra o que acerta.'
    },
];

const grab = async c => (await db.collection(`system/data/${c}`).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [eq, vds] = await Promise.all(['equipment', 'derivedValues'].map(grab));
const vdId = nome => { const v = vds.find(x => x.nome === nome); if (!v) { console.error(`🔴 VD "${nome}" não existe.`); process.exit(1); } return v.id; };

/* Copia o esqueleto de uma contundente que já existe, para não divergir do padrão. */
const modelo = eq.find(e => e.nome === 'Maça');
if (!modelo) { console.error('🔴 "Maça" não encontrada — sem modelo para copiar.'); process.exit(1); }
const MAO = modelo.equipavelEm;
if (!Array.isArray(MAO) || !MAO.length) { console.error('🔴 modelo sem equipavelEm.'); process.exit(1); }

const ACERTO_CC = vdId('Acerto Corpo a Corpo');
const ACERTO_DIST = vdId('Acerto à Distância');
const DANO = vdId('Dano');

const erros = [];
const nomes = new Set(eq.map(e => e.nome));
for (const n of NOVAS) if (nomes.has(n.nome)) erros.push(`já existe: ${n.nome}`);

console.log('\n=== armas contundentes novas ===\n');
const contAntes = eq.filter(e => (e.tags || []).includes('Impacto')).length;
for (const n of NOVAS) {
    const disparo = n.cat === 'distancia';
    console.log(`  ${n.nome.padEnd(18)} ${n.dado.padEnd(5)} ${n.cat.padEnd(11)} ${String(n.preco).padStart(5)} L$   Acerto: ${disparo ? 'DES + Disparo' : 'FOR + Arma'}`);
}
console.log(`\ncontundentes: ${contAntes} → ${contAntes + NOVAS.length}   (cortantes 28 · perfurantes 23)`);
if (erros.length) { console.error('\n🔴 ABORTADO:\n' + erros.map(e => '  - ' + e).join('\n')); process.exit(1); }
console.log('\n✅ Sem colisão de nomes.');
if (!APLICAR) { console.log('\n(dry-run — nada gravado. Use --apply.)'); process.exit(0); }

const agora = admin.firestore.Timestamp.now();
const col = db.collection('system/data/equipment');
const batch = db.batch();
const P = (op, ref) => ({ op, tipo: 'ficha', ref });

for (const n of NOVAS) {
    const disparo = n.cat === 'distancia';
    // Mesmas equações do resto do catálogo: o Acerto sai da entrega, o Dano
    // passa pelo teto do Domínio (min) antes de somar o atributo.
    const acerto = disparo
        ? { id: ACERTO_DIST, equacao: [{ tipo: 'ficha', ref: 'DES' }, P('+', 'Perícia: Disparo'), P('+', 'Acerto')] }
        : { id: ACERTO_CC, equacao: [{ tipo: 'ficha', ref: 'FOR' }, P('+', 'Perícia: Arma'), P('+', 'Acerto')] };
    // Funda dispara pedra: quem carrega o poder é o projétil, como arco e besta.
    const dano = disparo
        ? { id: DANO, equacao: [{ tipo: 'ficha', ref: 'Projétil: Qualidade' }, P('+', 'Projétil: Afiação'),
              { op: 'min', tipo: 'ficha', ref: 'Teto de Ofício: Disparo' }, { op: '+', valor: 2 }] }
        : { id: DANO, equacao: [{ tipo: 'ficha', ref: 'Item: Qualidade' }, P('+', 'Item: Afiação'),
              { op: 'min', tipo: 'ficha', ref: 'Teto de Ofício: Braço' }, P('+', 'FOR')] };

    batch.set(col.doc(), {
        nome: n.nome, tipo: 'Arma', descricao: n.descricao,
        categoriaArma: n.cat, formaEquipar: 'empunhar', equipavelEm: MAO,
        peso: n.peso, tamanho: n.tamanho, formulaDano: n.dado, preco: n.preco,
        pressaoBase: null, multiplicadorPressao: null, quantidade: null,
        ehContainer: false, capacidadeContainer: null, pesoMaximoContainer: null,
        mecanicaIds: [], imagemUrl: '', publicado: true,
        liga: '1', qualidade: '0', afiacao: 0,
        tags: ['Impacto'],
        valoresDerivadosVinculados: [acerto, dano],
        criadoPor: AUTOR, criadoEm: agora, atualizadoEm: agora, updatedAt: agora, versao: 1
    });
}
await batch.commit();
console.log(`\n✅ ${NOVAS.length} armas contundentes criadas.`);
process.exit(0);
