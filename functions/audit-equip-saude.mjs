/**
 * Raio-x do catálogo de equipamento: o que ainda está inconsistente.
 * node functions/audit-equip-saude.mjs
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const eq = (await db.collection('system/data/equipment').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const nome = i => i.nome || '(sem nome)';
const bloco = (t, arr, fmt = nome) => {
    console.log(`\n### ${t} — ${arr.length}`);
    arr.slice(0, 40).forEach(i => console.log('   ' + fmt(i)));
    if (arr.length > 40) console.log(`   … +${arr.length - 40}`);
};

console.log(`CATÁLOGO: ${eq.length} itens`);
const porTipo = {};
eq.forEach(i => porTipo[i.tipo || '(sem)'] = (porTipo[i.tipo || '(sem)'] || 0) + 1);
console.log('por tipo: ' + Object.entries(porTipo).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join('  '));

// 1) Campos obrigatórios para equipar
bloco('SEM formaEquipar', eq.filter(i => !i.formaEquipar));
bloco('SEM equipavelEm (não dá para equipar)', eq.filter(i => !(i.equipavelEm || []).length));

// 1b) Segurar em peça que aplica efeito = item MUDO na ficha.
// Pega o que a UI não pega: script que grava direto no Firestore (inclusive IA).
// Conserto: node functions/corrigir-forma-segurar.mjs --aplicar
const aplicaEfeito = i => !!((i.mecanicaIds || []).length || (i.valoresDerivadosVinculados || []).length
    || (i.statusVitaisVinculados || []).length || (i.condicaoIds || []).length
    || (i.atributosVinculados || []).length || (i.periciasVinculadas || []).length
    || String(i.formulaDano || '').trim() || i.tipo === 'Arma');
bloco('🔴 formaEquipar=segurar COM EFEITO (item mudo — use empunhar)',
    eq.filter(i => i.formaEquipar === 'segurar' && aplicaEfeito(i)),
    i => `${nome(i)}  [${i.tipo}]`);

// 2) Obrigatórios do formulário
bloco('SEM descrição', eq.filter(i => !String(i.descricao || '').trim()));
bloco('SEM peso ou tamanho', eq.filter(i => i.peso == null || i.tamanho == null),
    i => `${nome(i)}  peso=${i.peso ?? '—'} tam=${i.tamanho ?? '—'}`);

// 3) Armas
const armas = eq.filter(i => i.tipo === 'Arma');
bloco('ARMA sem categoriaArma', armas.filter(i => !i.categoriaArma));
bloco('ARMA sem fórmula de dano', armas.filter(i => !String(i.formulaDano || '').trim()));
bloco('categoriaArma em item que NÃO é arma', eq.filter(i => i.tipo !== 'Arma' && i.categoriaArma),
    i => `${nome(i)}  [${i.tipo}] categoriaArma=${i.categoriaArma}`);

// 4) Container
bloco('tipo=Container mas ehContainer falso', eq.filter(i => i.tipo === 'Container' && !i.ehContainer));
bloco('ehContainer sem limite de peso', eq.filter(i => i.ehContainer && !i.pesoMaximoContainer));

// 5) Tags
const tagCount = {};
eq.forEach(i => (i.tags || []).forEach(t => tagCount[t] = (tagCount[t] || 0) + 1));
bloco('SEM tag nenhuma', eq.filter(i => !(i.tags || []).length));
const soUma = Object.entries(tagCount).filter(([, n]) => n === 1).map(([t]) => t);
console.log(`\n### TAGS DE USO ÚNICO — ${soUma.length}\n   ${soUma.join(', ')}`);
console.log(`\n### TOTAL DE TAGS: ${Object.keys(tagCount).length}`);

// 6) Nomes: duplicados e sujeira
const porNome = {};
eq.forEach(i => (porNome[nome(i).trim().toLowerCase()] ||= []).push(i));
bloco('NOMES DUPLICADOS', Object.values(porNome).filter(a => a.length > 1).flat(),
    i => `${nome(i)}  [${i.tipo}] ${i.id}`);
bloco('nome com espaço nas pontas', eq.filter(i => nome(i) !== nome(i).trim()),
    i => JSON.stringify(nome(i)));

// 7) Publicação e imagem
bloco('NÃO publicado (invisível na ficha)', eq.filter(i => i.publicado === false));
bloco('imagemUrl em base64 (incha o cache)', eq.filter(i => String(i.imagemUrl || '').startsWith('data:')));
console.log(`\n### SEM IMAGEM — ${eq.filter(i => !String(i.imagemUrl || '').trim()).length} de ${eq.length}`);

// 8) Efeito: item que não faz nada mecanicamente
const inerte = i => !(i.mecanicaIds || []).length && !(i.valoresDerivadosVinculados || []).length
    && !(i.statusVitaisVinculados || []).length && !(i.condicaoIds || []).length
    && !String(i.formulaDano || '').trim();
console.log(`\n### SEM EFEITO MECÂNICO NENHUM — ${eq.filter(inerte).length} de ${eq.length}`);
console.log('   (normal para cenário//vestuário comum; problema se for arma ou armadura)');
bloco('  → destes, ARMA ou ARMADURA', eq.filter(i => inerte(i)
    && (i.tipo === 'Arma' || (i.tags || []).includes('Armadura'))),
    i => `${nome(i)}  [${i.tipo}] ${(i.tags || []).join('/')}`);

process.exit();
