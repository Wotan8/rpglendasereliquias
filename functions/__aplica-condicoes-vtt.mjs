/**
 * Liga as condições cadastradas ao Tabuleiro.
 *
 * REGRA DESTE SCRIPT: só configura o que a DESCRIÇÃO da condição já diz, com
 * número fechado. Onde o texto diz "N" (Queimadura, Hemorragia, Simbionte), ou
 * onde o efeito não tem botão correspondente no motor (Desvantagem, ±Alvo,
 * Blindagem, Reação), a condição fica como está — inventar valor aqui viraria
 * regra nova entrando pela porta dos fundos.
 *
 * Cada linha abaixo cita o trecho da descrição que a justifica.
 *
 *   node functions/__aplica-condicoes-vtt.mjs            (dry-run — não escreve)
 *   node functions/__aplica-condicoes-vtt.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(
        require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')),
});
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

/* ═══════════════════════════════════════════════════════════════════════
   CONFIGURAÇÃO — por NOME da condição, com a citação que a sustenta
   ═══════════════════════════════════════════════════════════════════════ */
const CONFIG = {
    // ---------- economia de ação ----------
    'Atordoado': {
        porque: '"Perde o turno inteiro — Ação Padrão e Ação de Movimento"',
        afetaTabuleiro: true,
        bloqueiaAcoes: ['padrao', 'movimento', 'completa'],
    },

    // ---------- movimento ----------
    'Imobilizado': {
        porque: '"Deslocamento 0"',
        afetaTabuleiro: true,
        bloqueiaAcoes: ['movimento'],
        multiplicadorDeslocamento: 0,
    },
    'Agarrado': {
        porque: '"Deslocamento 0" + "a única ação que pode gastar é a tentativa de escapar"',
        afetaTabuleiro: true,
        bloqueiaAcoes: ['movimento'],
        multiplicadorDeslocamento: 0,
        testeParaSair: true,
        testeNome: 'FOR + Perícia: Atletismo',
        testeMod: 0,
        testeQuando: 'acao_padrao',
        testeSucessoRemove: 'tudo',
    },
    'Lento': {
        porque: '"Metade do Deslocamento"',
        afetaTabuleiro: true,
        multiplicadorDeslocamento: 0.5,
    },

    // ---------- visão ----------
    'Cego': {
        porque: '"Não enxerga" — escuridão total do §6.10 numa pessoa só',
        afetaTabuleiro: true,
        multiplicadorVisao: 0,
    },

    // ---------- dano/cura por rodada (só onde o número é FECHADO) ----------
    'Afogando': {
        porque: '"2 de dano por rodada" — número fixo na descrição',
        afetaTabuleiro: true,
        porRodadaEfeito: 'dano_vit',
        porRodadaValor: '2',
    },
    'Sobrecarregado': {
        porque: '"o alvo perde 1 Energia ao fim de cada turno" — número fixo',
        afetaTabuleiro: true,
        porRodadaEfeito: 'dano_ener',
        porRodadaValor: '1',
    },

    // ---------- acúmulo em níveis ----------
    'Exaustão': {
        porque: '"Trilha de 0 a 3" · "Empilha em níveis, até 3"',
        acumulaNiveis: true,
        nivelMaximo: 3,
        efeitoPorNivel: [
            { nivel: 1, efeito: 'Cansado: −1 no Alvo de todos os testes.' },
            { nivel: 2, efeito: 'Exausto: −2 no Alvo de todos os testes; metade do Deslocamento; o Teste de Descanso converte no máximo VIG graus em PR.' },
            { nivel: 3, efeito: 'Estafado: efeitos de Exaustão 2 e não pode usar a Reação.' },
        ],
    },
    'Congelamento': {
        porque: '"Trilha de 3 níveis, na forma da Exaustão" · "Empilha em níveis, até 3"',
        acumulaNiveis: true,
        nivelMaximo: 3,
        efeitoPorNivel: [
            { nivel: 1, efeito: 'Enregelado: efeitos de Lento — metade do Deslocamento, −2 na Iniciativa.' },
            { nivel: 2, efeito: 'Cristalizado: efeitos de Enregelado, e perde 2 de Vitalidade a cada ação que gastar (Padrão ou de Movimento).' },
            { nivel: 3, efeito: 'Rompente: não pode agir. Pode forçar com teste de VIG; passando, age e rola 1d10 — 1 a 3 perde um membro, 10 morre. Dura 1 turno e desce sozinho para o Nv 2.' },
        ],
    },
    'Corrompido': {
        porque: '"empilha até 3, e é a única condição do sistema que empilha em combate"',
        acumulaNiveis: true,
        nivelMaximo: 3,
        efeitoPorNivel: [
            { nivel: 1, efeito: '−1 no Alvo de todos os testes.' },
            { nivel: 2, efeito: '−2 no Alvo de todos os testes.' },
            { nivel: 3, efeito: '−3 no Alvo de todos os testes.' },
        ],
    },
    'Abalado': {
        porque: '"Empilha até 3"',
        acumulaNiveis: true,
        nivelMaximo: 3,
        efeitoPorNivel: [
            { nivel: 1, efeito: '−1 no Alvo de todos os testes.' },
            { nivel: 2, efeito: '−2 no Alvo de todos os testes.' },
            { nivel: 3, efeito: '−3 no Alvo de todos os testes.' },
        ],
    },
    'Provocado': {
        // atraiAlvo NÃO entra: ele marcaria ESTE token como ímã de ataques, e a
        // condição faz o contrário — quem está Provocado é que fica preso a
        // outro alvo. O motor não tem "obrigado a mirar em X".
        porque: '"Empilha até Provocado 3 (−6 no Alvo)"',
        acumulaNiveis: true,
        nivelMaximo: 3,
        efeitoPorNivel: [
            { nivel: 1, efeito: '−2 no Alvo em ataques contra quem não seja o provocador.' },
            { nivel: 2, efeito: '−4 no Alvo em ataques contra quem não seja o provocador.' },
            { nivel: 3, efeito: '−6 no Alvo em ataques contra quem não seja o provocador.' },
        ],
    },
};

/* ═══ Aplicação ═══ */
const snap = await db.collection('system/data/conditions').get();
const porNome = new Map();
snap.forEach(d => porNome.set((d.data().nome || '').trim(), { id: d.id, ...d.data() }));

let mudadas = 0, iguais = 0, faltando = [];

for (const [nome, cfg] of Object.entries(CONFIG)) {
    const atual = porNome.get(nome);
    if (!atual) { faltando.push(nome); continue; }

    const { porque, ...campos } = cfg;
    const diff = {};
    for (const [k, v] of Object.entries(campos)) {
        if (JSON.stringify(atual[k]) !== JSON.stringify(v)) diff[k] = v;
    }
    if (!Object.keys(diff).length) { iguais++; continue; }

    console.log(`\n${atual.icone || '?'} ${nome}`);
    console.log(`   porque: ${porque}`);
    for (const [k, v] of Object.entries(diff)) {
        const antes = atual[k] === undefined ? '(vazio)' : JSON.stringify(atual[k]);
        console.log(`   ${k}: ${antes} → ${JSON.stringify(v)}`);
    }
    mudadas++;
    if (APLICAR) {
        await db.doc(`system/data/conditions/${atual.id}`).update({
            ...campos, updatedAt: admin.firestore.Timestamp.now(),
        });
    }
}

console.log('\n' + '═'.repeat(70));
console.log(`${mudadas} condição(ões) a mudar · ${iguais} já batendo · ${Object.keys(CONFIG).length} no plano`);
if (faltando.length) console.log(`⚠️ não encontradas no banco: ${faltando.join(', ')}`);
console.log(APLICAR ? '✅ APLICADO no Firestore' : '🔍 dry-run — rode com --apply para gravar');
process.exit(0);
