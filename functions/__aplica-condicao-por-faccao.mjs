/**
 * COMPOSIÇÃO DE BATALHA — a metade que faltava no cadastro.
 *
 * O que a mesa viu: um aliado e um inimigo dentro da onda, e os DOIS ficaram
 * Fortalecido. O Tabuleiro fez exatamente o que estava escrito — o cadastro
 * tinha `faccao: 'ambos'` e UMA condição só (Fortalecido). A metade "ou todos
 * os inimigos ficam Abalado 2" existia apenas na descrição, em português.
 *
 * Este script escreve o que a descrição já diz:
 *   · Fortalecido, nível 2, só em ALIADO;
 *   · Abalado, nível 2, só em INIMIGO;
 *   · `condicoesExclusivas: true` — "Escolha na conjuração", uma OU a outra.
 *
 * 💰 A Régua não muda: só um dos ramos dispara, e Abalado e Fortalecido custam
 * o mesmo (0,170 un/rodada por nível, §1.1). O ramo espelhado cabe no mesmo
 * orçamento que já foi pago — por isso o bloco `regua` fica intacto.
 *
 * Recusa-se a gravar se a descrição no banco não for mais a que motivou a
 * mudança: cadastro que mudou de texto tem de ser relido por gente.
 *
 *   node functions/__aplica-condicao-por-faccao.mjs           (só mostra)
 *   node functions/__aplica-condicao-por-faccao.mjs --apply   (grava)
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

/** A frase do cadastro que justifica a mudança. Sumiu = não gravo. */
const FRASE = /escolha na conjura[çc][ãa]o.*aliados.*fortalecido.*ou.*inimigos.*abalado/i;
const ALVO = /composi[çc][ãa]o de batalha/i;

const snap = await db.collection('system/data/classModules').get();
let achou = 0, gravados = 0;

for (const d of snap.docs) {
    const mod = d.data();
    const itens = mod.itensPredefinidos || [];
    let mexeu = false;
    const novos = itens.map(it => {
        if (!ALVO.test(it.nome || '')) return it;
        achou++;
        const desc = String(it.descricao || it.efeito || '');
        console.log(`\n📜 ${it.nome}   [módulo ${d.id}]`);
        console.log(`   descrição: ${desc}`);
        if (!FRASE.test(desc)) {
            console.log('   ⛔ a descrição não é mais a que motivou esta mudança — NÃO gravo.');
            return it;
        }
        const antes = it.condicoesAplicadas || [];
        const modelo = antes[0] || {};
        const base = { portao: modelo.portao ?? null, chance: modelo.chance ?? null,
            alvos: Number(modelo.alvos) || 3, rodadas: Number(modelo.rodadas) || 5 };
        const depois = [
            { ...base, condicao: 'Fortalecido', nivel: 2, faccao: 'aliado', rotulo: 'Fortalecido 2 nos aliados' },
            { ...base, condicao: 'Abalado',     nivel: 2, faccao: 'inimigo', rotulo: 'Abalado 2 nos inimigos' },
        ];
        console.log(`   antes:  ${JSON.stringify(antes)}`);
        console.log(`   depois: ${JSON.stringify(depois)}`);
        console.log(`   + condicoesExclusivas: true  (a onda segue pegando os dois lados: faccao="${it.faccao}")`);
        mexeu = true;
        return { ...it, condicoesAplicadas: depois, condicoesExclusivas: true };
    });

    if (mexeu) {
        writeFileSync(`functions/_backup-modulo-${d.id}.json`, JSON.stringify(itens, null, 2));
        if (APLICAR) { await d.ref.update({ itensPredefinidos: novos }); gravados++; }
        else gravados++;
    }
}

console.log(`\n${APLICAR ? 'GRAVADO' : 'SIMULAÇÃO (rode com --apply para gravar)'} — ${achou} item(ns) encontrado(s), ${gravados} módulo(s) alterado(s)`);
if (!achou) console.log('⚠️ Nenhuma "Composição de Batalha" no registro — confira o nome.');
process.exit(0);
