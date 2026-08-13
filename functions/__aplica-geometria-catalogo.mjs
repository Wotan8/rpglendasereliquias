/**
 * Régua geométrica — grava forma, alcance e bloqueio no catálogo, e recalcula
 * `alvosMax` a partir da geometria em vez de aceitar o número digitado.
 *
 *   node functions/__aplica-geometria-catalogo.mjs            (dry-run)
 *   node functions/__aplica-geometria-catalogo.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(
        require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')),
});
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

const CELULA = 9;
/* Teto pelo lado hostil: um combate tem 2–15 tokens no total, e quem conjura
   não mira nos aliados. Sem isso a geometria literal dava 52 alvos para um
   cone de 30 m — mais gente do que cabe no combate inteiro. */
const TETO_HOSTIL = 7;
const areaDe = {
    circulo: (g) => Math.PI * g.raio ** 2,
    onda: (g) => Math.PI * g.raio ** 2,
    zona: (g) => Math.PI * g.raio ** 2,
    cone: (g) => (g.angulo / 360) * Math.PI * g.raio ** 2,
    linha: (g) => g.comprimento * g.largura,
    retangulo: (g) => g.a * g.b,
};
function alvosDe(g) {
    if (!areaDe[g.forma]) return 1;                       // unico, proprio, ponto, nenhuma
    /* Ordem: geometria → teto de quantos existem → sombra do bloqueio. */
    const cheio = Math.min(Math.floor(areaDe[g.forma](g) / CELULA), TETO_HOSTIL);
    if (!g.bloqueavel) return Math.max(1, cheio);
    if (g.forma === 'linha') return 1;
    return Math.max(1, Math.ceil(cheio / 2));
}
assert.equal(alvosDe({ forma: 'circulo', raio: 3 }), 3);
assert.equal(alvosDe({ forma: 'onda', raio: 6 }), 7, 'onda de 6 m satura no teto hostil');
assert.equal(alvosDe({ forma: 'cone', raio: 30, angulo: 60 }), 7, 'cone de 30 m nao pode pegar 52');
assert.equal(alvosDe({ forma: 'onda', raio: 2 }), 1, 'o Golpe Giratório adjacente pega 1, não 5');
assert.equal(alvosDe({ forma: 'cone', raio: 9, angulo: 60, bloqueavel: true }), 2);
assert.equal(alvosDe({ forma: 'unico' }), 1);

/* ── Os 9 grupos aprovados ─────────────────────────────────────────── */
const G = {};
const por = (nomes, g) => nomes.forEach((n) => { G[n] = g; });

/* 1 · Loções — economia de Receita */
const LOCOES = ['Loção de Veneno Simples I', 'Loção Entorpecente Simples I', 'Loção Corrosiva Simples I',
    'Loção Ilusória Simples I', 'Loção de Cura Rápida', 'Loção de Antídoto Simples I',
    'Loção de Estímulo Simples I', 'Loção de Regeneração Simples I'];
por(LOCOES, { forma: 'unico', alcance: 0 });

/* 2 · Golpe corpo a corpo — já está adjacente, não paga alcance */
por(['Atordoar', 'Imobilizar', 'Romper Defesa', 'Investida', 'Golpe Preciso', 'Golpe pelas Costas',
    'Desarme', 'Golpe Cruzado', 'Ataque Mudo'], { forma: 'unico', alcance: 2 });

/* 3 · Auto-buff — o alvo é você */
por(['Postura Ofensiva', 'Postura Defensiva', 'Cólera', 'Sombra Acelerada', 'Escudo Hemático',
    'Armadura Sanguínea', 'Membros Sanguíneos', 'Visão Hemática', 'Passos Sombrios',
    'Retirada Ágil', 'Salto Predatório', 'Troca de Mãos', 'Dança das Lâminas',
    'Corte de Passagem', 'Engodo', 'Inspirar'], { forma: 'proprio', alcance: 0 });

/* 4 · Área centrada em si */
por(['Golpe Giratório'], { forma: 'onda', raio: 2, alcance: 0 });
por(['Agulhas Sanguíneas', 'Lâmina Hemática', 'Corda de Sangue', 'Marca de Sangue',
    'Absorção Hemática', 'Transfusão Forçada'], { forma: 'unico', alcance: 6 });

/* 5 · Bardo — onda centrada no bardo, raio = o número que o texto já declarava */
por(['RITMO DE MARCHA [P]'], { forma: 'onda', raio: 10, alcance: 0 });
por(['MARCHA DO CATACLISMO [P, S]'], { forma: 'onda', raio: 8, alcance: 0 });
por(['RITMO DE GUERRA [P, V]', 'FÚRIA INSPIRADA [V]', 'COMPOSIÇÃO DE BATALHA [Qualquer]',
    'RÉQUIEM [V, C]', 'LETARGIA TEMPORAL [P, C]', 'DISTORÇÃO ESPACIAL ILUSÓRIA [C, S]',
    'LAMENTO DA BANSHEE [V, S]', 'A SINFONIA [Todas]', 'ACORDE DEBILITANTE [C, P]',
    'GRITO DISSONANTE [V, S]', 'INTIMIDAÇÃO SÔNICA [V, P]', 'NANA DO ENTORPECIMENTO [V, C]',
    'CANÇÃO DO VIGOR [V, C]', 'CADÊNCIA ACELERADORA [P, C]'], { forma: 'onda', raio: 6, alcance: 0 });
por(['ONDA DE CHOQUE SONORAL [P, S]'], { forma: 'onda', raio: 5, alcance: 0 });
por(['TROMBETA DO JULGAMENTO [S]'], { forma: 'cone', raio: 30, angulo: 60, alcance: 0 });

/* 6 · Som de alcance longo */
por(['SUSSURRO DE ALCANCE [V, S]', 'CHAMADO DO LONGE [S]'], { forma: 'ponto', alcance: 0 });
por(['NOTA PENETRANTE [S]'], { forma: 'cone', raio: 9, angulo: 60, bloqueavel: true, alcance: 0 });

/* 7 · Luz — buff alcança, debuff é cone bloqueável ("viaja reta") */
por(['Luz do Manto de Palla I', 'Luz Revigorante I', 'Luz Cauterizante I', 'Luz da Vontade I'],
    { forma: 'unico', alcance: 15 });
por(['Cegueira da Fé I', 'Distração da Fé I', 'Penitência da Fé I',
    'Brilho Chamativo da Fé I', 'Brilho Provocativo da Fé I', 'Luz da Expulsão I'],
    { forma: 'cone', raio: 9, angulo: 60, bloqueavel: true, alcance: 0 });

/* 8 · Zona persistente */
por(['Poça de Controle', 'Névoa Sanguínea', 'SILÊNCIO COMANDADO [V]'], { forma: 'zona', raio: 3, alcance: 6 });
por(['Reconsagração do Santuário'], { forma: 'zona', raio: 6, alcance: 0 });

/* ── Aplicação ─────────────────────────────────────────────────────── */
const col = db.collection('system/data/classModules');
const mods = (await col.get()).docs.map((d) => ({ id: d.id, ...d.data() }));
const plano = [];
const achados = new Set();
for (const m of mods) {
    let mexeu = false;
    const itens = (m.itensPredefinidos || []).map((it) => {
        const g = G[it.nome];
        if (!g) return it;
        achados.add(it.nome);
        const n = alvosDe(g);
        if (it.formaArea === g.forma && it.alvosMax === n && it.alcance === (g.alcance ?? null)) return it;
        mexeu = true;
        plano.push({ nome: it.nome, de: `${it.formaArea || '-'}/${it.alvosMax ?? '-'}`, forma: g.forma,
            medida: g.raio ? `R${g.raio}${g.angulo ? ` ${g.angulo}°` : ''}` : '—',
            bloq: !!g.bloqueavel, alc: g.alcance ?? 0, alvos: n });
        return { ...it, formaArea: g.forma, alcance: g.alcance ?? null, tamanhoArea: g.raio ?? null,
            anguloCone: g.angulo ?? null, bloqueavel: !!g.bloqueavel, alvosMax: n };
    });
    if (mexeu) m._novos = itens;
}

console.log('=== PLANO ===');
console.log('habilidade                     de        forma      medida    bloq  alc  alvos');
for (const p of plano)
    console.log(`${p.nome.slice(0, 29).padEnd(31)}${p.de.padEnd(10)}${p.forma.padEnd(11)}${p.medida.padEnd(10)}${(p.bloq ? 'sim' : '—').padEnd(6)}${String(p.alc).padStart(3)}  ${String(p.alvos).padStart(4)}`);
const naoAchados = Object.keys(G).filter((n) => !achados.has(n));
console.log(`\n  itens tocados: ${plano.length}   nomes do plano não encontrados: ${naoAchados.length ? naoAchados.join(', ') : 'nenhum'}`);
console.log(`  módulos: ${mods.filter((m) => m._novos).length}`);

if (!APLICAR) { console.log('\n(dry-run — nada gravado.)'); process.exit(0); }
const lote = db.batch();
for (const m of mods.filter((x) => x._novos)) lote.update(col.doc(m.id), { itensPredefinidos: m._novos });
await lote.commit();
console.log('\n✅ gravado.');
