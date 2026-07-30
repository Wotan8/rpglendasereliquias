/**
 * Migra os Recursos Avulsos (items sem characterId) para o catálogo
 * system/data/equipment, adaptando o schema antigo ao atual, e depois apaga
 * apenas os docs migrados.
 *
 * NÃO apaga a coleção "items": ela guarda o inventário vivo dos personagens
 * (docs COM characterId). Só os avulsos listados em PLANO saem.
 *
 * Adaptações de schema:
 *   name → nome              description → descricao
 *   basePrice → preco        imagem (http) → imagemUrl   (base64 → arquivo)
 *   packSize → quantidade    maxCapacity → pesoMaximoContainer
 *   dureza → liga (0-10 → "0"-"5", só em peça manufaturada)
 *   maxSize → capacidadeContainer
 *   dano (número) → NÃO vai para formulaDano (que espera dado, ex "1d6");
 *                   fica registrado na descrição para revisão manual.
 *   dureza/integridade/reforco → descartados (nada no motor atual lê durabilidade)
 *
 * node functions/migrar-avulsos.mjs          → dry-run
 * node functions/migrar-avulsos.mjs --write  → grava e apaga os migrados
 */
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const WRITE = process.argv.includes('--write');
const IMG_DIR = new URL('./avulsos-imagens/', import.meta.url);

const MAO = '6r4QB7jnlln8WpehKzS4';
const COSTAS = 'LlkbcV44ucq3bu0qT8fd';
const CINTURA = 'P881bM97Ahm1No9dTGAX';

const naMao = { formaEquipar: 'segurar', equipavelEm: [MAO] };

/**
 * Uma entrada por MODELO a criar. `de` lista os nomes antigos que colapsam
 * nele (as triplicatas de Carne e as duas pilhas de Penas são o mesmo objeto
 * em pilhas separadas — modelo é um, instância é que era várias).
 */
const PLANO = [
    // ===== CONTÊINERES =====
    { de: ['Mochila Pequena de Couro'], tipo: 'Container', tags: ['Mochila'], formaEquipar: 'vestir', equipavelEm: [COSTAS], container: 1, ligaDeDureza: true },
    { de: ['Mochila Menor de Couro'], tipo: 'Container', tags: ['Mochila'], formaEquipar: 'vestir', equipavelEm: [COSTAS], container: 1, ligaDeDureza: true },
    { de: ['Mochila Média de Couro'], tipo: 'Container', tags: ['Mochila'], formaEquipar: 'vestir', equipavelEm: [COSTAS], container: 1, ligaDeDureza: true },
    { de: ['Mochila Maior de Couro'], tipo: 'Container', tags: ['Mochila'], formaEquipar: 'vestir', equipavelEm: [COSTAS], container: 1, ligaDeDureza: true },
    // multiplicador 0.5 acompanha a irmã já cadastrada "Bolsa de Couro (Luns)"
    { de: ['Saco de Luns Simples'], tipo: 'Container', tags: ['Bolsa'], formaEquipar: 'fixar', equipavelEm: [CINTURA], container: 0.5, ligaDeDureza: true },

    // ===== COMIDA =====
    { de: ['Carne de Penacho-Bravo Alfa'], tipo: 'Consumível', tags: ['Comida'], ...naMao },
    { de: ['Ração de viagem'], tipo: 'Consumível', tags: ['Comida'], ...naMao, descricao: 'Comida seca de marcha: mantém o viajante de pé sem precisar de fogo.' },
    { de: ['Pão Rústico'], tipo: 'Consumível', tags: ['Comida'], ...naMao, descricao: 'Pão de fermentação lenta, casca dura. Barato e onipresente.' },
    { de: ['Ensopado do Dia'], tipo: 'Consumível', tags: ['Comida'], ...naMao, descricao: 'O que a taverna tinha na panela. Quente, e isso já é muito.' },
    { de: ['Cheiro Verde de Vasteluna'], tipo: 'Consumível', tags: ['Comida'], ...naMao, descricao: 'Maço de ervas de tempero. Também serve de insumo em preparos simples.' },

    // ===== BEBIDA =====
    { de: ['Cerveja de Cevada'], tipo: 'Consumível', tags: ['Bebida'], ...naMao, descricao: 'Cerveja turva de cevada, servida em caneca de barro.' },
    { de: ['Hidromel da Casa'], tipo: 'Consumível', tags: ['Bebida'], ...naMao, descricao: 'Hidromel da produção local. Doce e mais forte do que parece.' },
    { de: ['Vinho Tinto'], tipo: 'Consumível', tags: ['Bebida'], ...naMao, descricao: 'Vinho tinto comum, de mesa.' },
    { de: ['Porção de Hidromel'], tipo: 'Consumível', tags: ['Bebida'], ...naMao, descricao: 'Ração de hidromel para levar na estrada.' },
    { de: ['Porção de Água Potável'], tipo: 'Consumível', tags: ['Bebida'], ...naMao, descricao: 'Água limpa racionada. O item que decide viagens longas.' },

    // ===== MATÉRIA-PRIMA =====
    { de: ['Pena de Urubu Rei-Coveiro'], tipo: 'Objeto', tags: ['Matéria'], ...naMao, descricao: 'Pena de urubu rei-coveiro. Insumo de preparos e de escrita.' },
    { de: ['Penas Duras de Penacho-Bravo Alfa'], tipo: 'Objeto', tags: ['Matéria'], ...naMao, descricao: 'Penas rígidas de penacho-bravo alfa. Insumo de empenamento e artesanato.' },
    { de: ['Babosa'], tipo: 'Objeto', tags: ['Matéria'], ...naMao, descricao: 'Folha carnuda de babosa. Insumo de Herbalismo.' },

    // ===== PROJÉTEIS =====
    { de: ['Flecha de Penacho'], tipo: 'Projétil', tags: ['Flecha'], ...naMao, ligaDeDureza: true },
    { de: ['Flecha de Penacho Envenenada +1'], tipo: 'Projétil', tags: ['Flecha'], ...naMao, ligaDeDureza: true },

    // ===== FERRAMENTA =====
    { de: ['Gazua Simples'], tipo: 'Objeto', tags: ['Ferramenta'], ...naMao, ligaDeDureza: true, descricao: 'Gazua de ferro torto, peça avulsa. Abre fechaduras comuns.' },

    // ===== RELÍQUIA =====
    { de: ['[Relíquia] Especulum Fatu'], nome: 'Especulum Fatu', tipo: 'Relíquia', tags: ['Espelho'], ...naMao, ligaDeDureza: true },
];

const snap = await db.collection('items').get();
const avulsos = snap.docs.filter(d => !d.data().characterId);
const acharDocs = nome => avulsos.filter(d => (d.data().name || '').trim() === nome);

const num = v => (v === undefined || v === null || v === '' ? null : Number(v));
const ligaDe = dureza => String(Math.max(0, Math.min(5, Math.round((Number(dureza) || 0) / 2))));

mkdirSync(IMG_DIR, { recursive: true });

const criar = [];
const apagar = [];
const imagensSalvas = [];
const avisos = [];

for (const p of PLANO) {
    const docs = p.de.flatMap(acharDocs);
    if (!docs.length) { avisos.push(`❌ não encontrado no banco: ${p.de.join(' / ')}`); continue; }

    // Modelo = o doc mais completo do grupo (o que tem imagem/preço/descrição)
    const base = docs.slice().sort((a, b) =>
        Object.keys(b.data()).length - Object.keys(a.data()).length)[0].data();
    const nome = p.nome || (base.name || '').trim();

    const eq = {
        nome,
        tipo: p.tipo,
        tags: p.tags,
        descricao: (base.description || '').trim() || p.descricao || `${nome}.`,
        peso: num(base.peso) ?? 1,
        tamanho: num(base.tamanho) ?? 1,
        quantidade: num(base.packSize) ?? 1,
        formaEquipar: p.formaEquipar,
        equipavelEm: p.equipavelEm,
        publicado: true,
        versao: 1,
        criadoPor: base.ownerId || base.createdBy || null,
        criadoEm: admin.firestore.FieldValue.serverTimestamp(),
        migradoDe: docs.map(d => d.id),
    };

    const preco = num(base.basePrice);
    if (preco !== null) eq.preco = preco;
    if (p.ligaDeDureza) eq.liga = ligaDe(base.dureza);

    if (p.container) {
        eq.ehContainer = true;
        eq.pesoMaximoContainer = num(base.maxCapacity) ?? 10;
        eq.capacidadeContainer = num(base.maxSize) ?? 5;
        eq.multiplicadorPressao = p.container;
    }

    // Imagem: URL entra direto; base64 vira arquivo (o catálogo não usa data:)
    const img = String(base.imagem || '');
    if (img.startsWith('http')) {
        eq.imagemUrl = img;
    } else if (img.startsWith('data:')) {
        const m = img.match(/^data:image\/(\w+);base64,(.*)$/s);
        if (m) {
            const arquivo = `${nome.replace(/[^\wÀ-ſ -]/g, '')}.${m[1]}`;
            if (WRITE) writeFileSync(new URL(arquivo, IMG_DIR), Buffer.from(m[2], 'base64'));
            imagensSalvas.push(`${arquivo}  (${(m[2].length / 1365).toFixed(0)} KB)`);
        }
    }

    // Dano numérico do sistema antigo: não cabe em formulaDano (que espera dado)
    if (base.dano !== undefined && base.dano !== null && Number(base.dano) > 0) {
        eq.descricao += `  [Sistema antigo: dano ${base.dano} — definir fórmula de dado.]`;
        avisos.push(`⚠️ ${nome}: dano antigo ${base.dano} foi para a descrição; formulaDano segue vazia.`);
    }

    criar.push(eq);
    docs.forEach(d => apagar.push({ id: d.id, nome: (d.data().name || '').trim() }));
}

console.log(`########## MODELOS A CRIAR (${criar.length}) ##########`);
for (const e of criar) {
    console.log(`\n${e.nome}   [${e.tipo}]  tags: ${e.tags.join(', ')}`);
    console.log(`   peso=${e.peso} tam=${e.tamanho} qtd=${e.quantidade} preco=${e.preco ?? '—'} liga=${e.liga ?? '—'}`);
    console.log(`   forma=${e.formaEquipar} corpo=${e.equipavelEm.length}  ${e.ehContainer ? `container: pesoMax=${e.pesoMaximoContainer} cap=${e.capacidadeContainer} mult=${e.multiplicadorPressao}` : ''}`);
    console.log(`   img=${e.imagemUrl ? 'url' : '—'}  de ${e.migradoDe.length} doc(s)`);
    console.log(`   "${e.descricao.slice(0, 130)}"`);
}

console.log(`\n########## AVULSOS A APAGAR (${apagar.length}) ##########`);
apagar.forEach(a => console.log(`  ${a.nome}  [${a.id}]`));

const restantes = avulsos.length - apagar.length;
console.log(`\nAvulsos que PERMANECEM (não pedidos nesta rodada): ${restantes}`);
avulsos.filter(d => !apagar.some(a => a.id === d.id))
    .forEach(d => console.log(`  ${(d.data().name || '?')}`));

if (imagensSalvas.length) {
    console.log(`\n########## IMAGENS BASE64 EXTRAÍDAS (${imagensSalvas.length}) ##########`);
    console.log(`  destino: functions/avulsos-imagens/`);
    imagensSalvas.forEach(i => console.log('  ' + i));
}
if (avisos.length) {
    console.log(`\n########## REVISAR ##########`);
    avisos.forEach(a => console.log('  ' + a));
}

console.log(`\nitems: ${snap.size} total, ${snap.size - avulsos.length} de personagens (INTOCADOS)`);

if (!WRITE) { console.log('\n(dry-run — rode com --write para gravar e apagar)'); process.exit(); }
if (avisos.some(a => a.startsWith('❌'))) { console.log('\n⛔ Item faltando — nada gravado.'); process.exit(1); }

const lote = db.batch();
criar.forEach(e => lote.set(db.collection('system/data/equipment').doc(), e));
apagar.forEach(a => lote.delete(db.collection('items').doc(a.id)));
await lote.commit();
console.log(`\n✅ ${criar.length} modelos criados, ${apagar.length} avulsos apagados.`);
process.exit();
