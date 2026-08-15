/**
 * Fusão Selvagem vira DUAS (Receptor e Projetor), espelhando a Transcendência
 * do Xamã, e as quatro habilitam a mira de incorporação:
 *
 *   mira de alvo-token · 1 alvo · afeta aliados
 *   exigeVinculo   'aliado-animal' (Druida) · 'eco' (Xamã)
 *   incorporacao   'receptor' | 'projetor'
 *
 * Não há seletor de aliado: quem conjura MIRA o token no mapa, e a validação
 * (vinculado à ficha + tipo certo) acontece no clique. "Só com quem está na
 * cena" sai de graça — fora dela não há token para clicar.
 *
 * O custo em Sanidade NÃO vai no cadastro: é escalonado pelo que a Dádiva
 * entregar, calculado na hora (shared/incorporacao.js).
 *
 *   node functions/__aplica-incorporacao.mjs           (só mostra)
 *   node functions/__aplica-incorporacao.mjs --apply   (grava)
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

/** Mira comum às quatro: o alvo é um token, e o que sai é empréstimo. */
const miraBase = (exige, modo) => ({
    formaArea: 'nenhuma',
    alcance: 3,             // toque: o hóspede tem de estar ao lado
    alvosMax: 1,
    faccao: 'aliado',
    exigeVinculo: exige,
    incorporacao: modo,
});

let mudou = 0;

/* ===== 1) Druida — Fusão Selvagem vira duas ===== */
const refFer = db.doc('system/data/classModules/ally_animal');
const snapFer = await refFer.get();
if (!snapFer.exists) {
    console.log('❌ módulo Ferinismo não encontrado');
} else {
    const lista = [...(snapFer.data().itensPredefinidos || [])];
    const i = lista.findIndex(p => p.id === 'pdi_1784476430077_5t33mz');
    if (i < 0) {
        console.log('❌ Fusão Selvagem não encontrada');
    } else if (lista.some(p => /Receptor/i.test(p.nome || ''))) {
        console.log('⏭️  Fusão Selvagem já foi partida — não duplico');
    } else {
        const base = lista[i];
        const receptor = {
            ...base,
            id: base.id + '_receptor',
            nome: 'Fusão Selvagem — Receptor',
            descricao: 'O Druida abre espaço na própria carne e o Aliado Animal entra. '
                + 'O corpo do bicho fica inerte; o Druida ganha o que o animal tem de melhor, '
                + 'e só o que for melhor que o dele. Acaba quando a fusão acaba.',
            ...miraBase('aliado-animal', 'receptor'),
        };
        const projetor = {
            ...base,
            id: base.id + '_projetor',
            nome: 'Fusão Selvagem — Projetor',
            descricao: 'O Druida sai de si e vai para o Aliado Animal. O corpo DELE fica inerte, '
                + 'e ele passa a jogar pelo bicho — na iniciativa do bicho, que já está na cena. '
                + 'Pode abrir a ficha do animal para consultar; não pode editá-la.',
            ...miraBase('aliado-animal', 'projetor'),
        };
        lista.splice(i, 1, receptor, projetor);
        console.log('\n✔ Fusão Selvagem partida em duas');
        console.log(`   · ${receptor.nome}  [${receptor.id}]`);
        console.log(`   · ${projetor.nome}  [${projetor.id}]`);
        console.log(`   mira: alvo-token · 1 alvo · aliados · exige aliado-animal vinculado`);
        if (APLICAR) await refFer.update({ itensPredefinidos: lista, atualizadoEm: new Date() });
        mudou++;
    }
}

/* ===== 2) Xamã — as duas Transcendências já existem: só a mira ===== */
const refTot = db.doc('system/data/classModules/mod_totem');
const snapTot = await refTot.get();
if (!snapTot.exists) {
    console.log('❌ módulo Totemancia não encontrado');
} else {
    const lista = [...(snapTot.data().itensPredefinidos || [])];
    let n = 0;
    for (let i = 0; i < lista.length; i++) {
        const pd = lista[i];
        const eProjetor = /Transcend.ncia.*Projetor/i.test(pd.nome || '');
        const eReceptor = /Transcend.ncia.*Receptor/i.test(pd.nome || '');
        if (!eProjetor && !eReceptor) continue;
        const modo = eProjetor ? 'projetor' : 'receptor';
        lista[i] = { ...pd, ...miraBase('eco', modo) };
        console.log(`\n✔ ${pd.nome} → mira de incorporação (${modo}, exige Eco vinculado)`);
        n++;
    }
    if (!n) console.log('⏭️  Nenhuma Transcendência encontrada no módulo de Totemancia');
    else {
        if (APLICAR) await refTot.update({ itensPredefinidos: lista, atualizadoEm: new Date() });
        mudou++;
    }
}

console.log(`\n${APLICAR ? 'GRAVADO' : 'SIMULAÇÃO (rode com --apply para gravar)'} — ${mudou} módulo(s) tocado(s)`);
console.log('\nO custo em Sanidade não está no cadastro de propósito: é escalonado pelo que');
console.log('a Dádiva entregar, e sai de shared/incorporacao.js na hora do uso.');
process.exit(0);
