/**
 * Aljava é porta-munição, não arma. Converte tipo Arma → Container.
 *
 * Capacidade vem do Livro (Cap. 6, pág. 100): "Flechas (aljava) | 20 | ⚖1" e
 * "Virotes (bolsa) | 20 | ⚖1" — 20 unidades pesando 1 no total.
 *
 * node functions/corrigir-aljavas.mjs          → dry-run
 * node functions/corrigir-aljavas.mjs --write  → grava
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
const serviceAccount = require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

const WRITE = process.argv.includes('--write');
const COSTAS = 'LlkbcV44ucq3bu0qT8fd';
const CINTURA = 'P881bM97Ahm1No9dTGAX';

const PLANO = {
    // 75 cm, carregada nas costas
    'Aljava de Caça': { equipavelEm: [COSTAS] },
    // 35 cm, a descrição chama de "bolsa de virotes" → cinto
    'Aljava Virotes': { equipavelEm: [CINTURA] },
};

const snap = await db.collection('system/data/equipment').get();
const lote = db.batch();
let mudados = 0;

for (const [nome, extra] of Object.entries(PLANO)) {
    const doc = snap.docs.find(d => (d.data().nome || '').trim() === nome);
    if (!doc) { console.log(`  ❌ não encontrado: ${nome}`); continue; }
    const a = doc.data();

    const patch = {
        tipo: 'Container',
        ehContainer: true,
        pesoMaximoContainer: 1,
        capacidadeContainer: 20,
        multiplicadorPressao: 1,
        formaEquipar: 'fixar',
        // categoriaArma só vale para tipo=Arma; o painel limpa campo condicional
        // oculto ao salvar, então deixar preenchido viraria lixo silencioso.
        categoriaArma: null,
        ...extra,
    };

    console.log(`\n${nome}`);
    console.log(`  tipo          ${a.tipo} → ${patch.tipo}`);
    console.log(`  categoriaArma ${a.categoriaArma || '—'} → (limpo)`);
    console.log(`  formaEquipar  ${a.formaEquipar || '—'} → ${patch.formaEquipar}`);
    console.log(`  equipavelEm   ${JSON.stringify(a.equipavelEm)} → ${JSON.stringify(patch.equipavelEm)}`);
    console.log(`  container     peso máx ${patch.pesoMaximoContainer}, capacidade ${patch.capacidadeContainer}`);
    console.log(`  tags          ${(a.tags || []).join('/')}  (mantidas)`);
    lote.update(doc.ref, patch);
    mudados++;
}

if (!mudados) { console.log('\nNada a fazer.'); process.exit(); }
if (WRITE) { await lote.commit(); console.log(`\n✅ ${mudados} aljavas convertidas.`); }
else console.log('\n(dry-run — rode com --write para gravar)');
process.exit();
