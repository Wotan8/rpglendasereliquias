/**
 * Refs mortas de condição — passo 1: as três trocas que são seguras.
 *
 * A varredura achou 11 nomes de efeito escritos no texto de ataque que não
 * existem no catálogo de condições. Este script conserta as TRÊS em que o
 * nome escrito é sinônimo exato de uma condição que já existe — a regra
 * sempre esteve lá, só com a palavra errada:
 *
 *   Derrubada  → Prostrado      10 fichas
 *   Sangrar N  → Hemorragia N    3 fichas
 *   Medo       → Amedrontado     1 ficha
 *
 * NÃO É BUFF. O texto já dizia "e Derrubada" e a mesa já derrubava o alvo;
 * o que muda é que agora existe regra escrita atrás da palavra, e o
 * Tabuleiro consegue aplicar sozinho. O que este relatório mostra é
 * QUANTO o carimbo dessas fichas vinha subestimando — não quanto elas
 * ganharam.
 *
 * As outras oito NÃO entram aqui, e cada uma tem um motivo:
 *
 *   Faísca (3)             o texto diz "perde a Reação até o fim do turno".
 *                          Trocar por Eletrocutado seria buff GIGANTE — o
 *                          Eletrocutado é dano + condução pela Blindagem +
 *                          descarga no aliado, 1,77 un no N=2 contra os
 *                          ~0,32 un que "perder a Reação" vale sozinho.
 *   Envenenar 1 (1)        Papa-Noite. Peçonha 1 custa 1,16 un e ele já é
 *                          Grave 1,85× — a troca precisa de decisão, não de
 *                          sinônimo.
 *   Infecção · Náusea ·    uma ficha cada, e as cinco JÁ TÊM a regra escrita
 *   Veneno Cristalizante · inline no próprio texto de ataque. Funcionam na
 *   Dilacerar ·            mesa; o que não funciona é o Tabuleiro aplicar
 *   Dreno de Luz           sozinho. Formalizar cada uma é criar condição
 *                          nova, e isso é decisão de design.
 *
 *   node functions/refs-mortas-renomeia.mjs            (dry-run)
 *   node functions/refs-mortas-renomeia.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';
const U = 3.90;

const br = (x, c = 2) => x.toFixed(c).replace('.', ',');
const medio = d => { const m = /(\d+)d(\d+)/.exec(String(d)); return m ? Number(m[1]) * (Number(m[2]) + 1) / 2 : NaN; };
const GRAUS = [[0.15, 'Inofensiva'], [0.35, 'Praga'], [0.75, 'Comum'], [1.5, 'Séria'], [3.0, 'Grave']];
const grauDe = x => (GRAUS.find(([t]) => x < t) || [null, 'Calamidade'])[1];

/* as três trocas. `un` = o que a condição vale por rodada, do próprio catálogo. */
const TROCAS = [
    { de: /\bDerrubada\b/g, para: 'Prostrado', un: 0.47,
      nota: 'Prostrado: +4 no Alvo de quem ataca corpo-a-corpo, −4 de quem atira, levantar custa 1 Ação de Movimento. O catálogo declara +0,47 un/rodada contra atacante corpo-a-corpo.' },
    { de: /\bSangrar\b/g, para: 'Hemorragia', un: 0.29,
      nota: 'Hemorragia N: N de dano por rodada, dobra se o alvo se mover, estanca com 1 Ação Padrão + Perícia: Anatomia. 0,29 un/rodada por nível, parado.' },
    { de: /\bMedo\b/g, para: 'Amedrontado', un: 0.17,
      nota: 'Amedrontado: −1 no Alvo de todos os testes enquanto puder ver a fonte, e não pode se aproximar dela. 0,17 un/rodada.' },
];

const conds = (await db.collection('system/data/conditions').get()).docs.map(d => d.data().nome);
const npcs = (await db.collection('npcs').get()).docs.map(d => ({ id: d.id, ...d.data() }));
const erros = [];
for (const t of TROCAS) if (!conds.includes(t.para)) erros.push(`condição-destino "${t.para}" não existe no catálogo`);

const plano = [];
for (const n of npcs) {
    const atq = String(n.ataques || '');
    if (!atq) continue;
    let novo = atq;
    const aplicadas = [];
    for (const t of TROCAS) {
        if (!t.de.test(atq)) continue;
        t.de.lastIndex = 0;
        novo = novo.replace(t.de, t.para);
        aplicadas.push(t);
    }
    if (!aplicadas.length) continue;

    /* a força da LINHA que carrega o rider, e a da ficha inteira (o carimbo) */
    const linhas = novo.split('\n').filter(l => /Alvo\s*\d/.test(l));
    const forcaDaLinha = l => {
        const g = /Alvo (\d+)[^,]*, (\d+d\d+)(?:\+(\d+))?/.exec(l);
        if (!g) return null;
        const P = Math.max(0, Math.min((Math.min(+g[1], 9) - 1) / 10, 0.9));
        return { P, x: P * Math.max(1, medio(g[2]) + (g[3] ? +g[3] : 0) - 2) / U };
    };
    const comRider = [];
    for (const l of linhas) {
        const t = aplicadas.find(t => l.includes(t.para));
        if (!t) continue;
        const f = forcaDaLinha(l);
        if (!f) continue;
        const nivel = (new RegExp(`${t.para}\\s+(\\d+)`).exec(l) || [])[1];
        const custo = t.un * (nivel ? +nivel : 1) * f.P;
        comRider.push({ linha: l.trim(), cond: t.para, nivel: nivel || '—', golpe: f.x, rider: custo, total: f.x + custo, P: f.P });
    }
    const carimbo = (/(\d+,\d+)×/.exec(String(n.criatura?.nivelAmeaca || '')) || [])[1];
    const melhorTotal = Math.max(...comRider.map(c => c.total), ...linhas.map(l => forcaDaLinha(l)?.x || 0));

    plano.push({ ref: db.collection('npcs').doc(n.id), nome: n.nome, tipo: n.tipo,
        antes: atq, depois: novo, aplicadas: aplicadas.map(t => t.para), comRider,
        carimbo: carimbo ? Number(carimbo.replace(',', '.')) : null, melhorTotal });
}

/* ── relatório ── */
console.log(`\n=== Refs mortas · passo 1: as três trocas seguras ===\n`);
for (const t of TROCAS) {
    const quantas = plano.filter(p => p.aplicadas.includes(t.para)).length;
    console.log(`   ${String(t.de).replace(/[/\\bg]/g, '').padEnd(12)} → ${t.para.padEnd(13)} ${quantas} ficha(s)`);
    console.log(`      ${t.nota}\n`);
}

console.log('--- o texto, ficha a ficha ---');
for (const p of plano) {
    console.log(`\n── ${p.nome}`);
    const la = p.antes.split('\n'), ld = p.depois.split('\n');
    for (let i = 0; i < ld.length; i++) if (la[i] !== ld[i]) {
        console.log(`   de:   ${la[i].trim().slice(0, 110)}`);
        console.log(`   para: ${ld[i].trim().slice(0, 110)}`);
    }
}

console.log('\n\n--- ⚠ quanto o carimbo dessas fichas vinha SUBESTIMANDO ---');
console.log('   (o efeito já acontecia na mesa; o que não existia era o preço)\n');
/* A comparação honesta é a MELHOR linha da ficha (com o rider dela, se tiver)
   contra o carimbo. Comparar uma linha secundária fraca contra o carimbo — que
   veio da linha principal — dá falso alarme: o Buffo Trovejante do Nímbaro
   Alfa vale 0,38× e a criatura vale 2,67×, e isso não a rebaixa a Comum. */
console.log('ficha                     carimbo   melhor linha COM rider   rider que entrou            Grau do carimbo → real');
const estouram = [];
for (const p of plano.sort((a, b) => (b.melhorTotal || 0) - (a.melhorTotal || 0))) {
    const grauNovo = grauDe(p.melhorTotal);
    const grauVelho = p.carimbo != null ? grauDe(p.carimbo) : null;
    const mudou = grauVelho && grauVelho !== grauNovo;
    if (mudou) estouram.push({ nome: p.nome, de: grauVelho, para: grauNovo, carimbo: p.carimbo, total: p.melhorTotal });
    const riders = p.comRider.map(c => `${c.cond}${c.nivel !== '—' ? ' ' + c.nivel : ''} (+${br(c.rider)})`).join(', ');
    console.log(`${p.nome.slice(0, 24).padEnd(25)} ${(p.carimbo != null ? br(p.carimbo) + '×' : '—').padStart(7)}   ${(br(p.melhorTotal) + '×').padStart(20)}   ${riders.slice(0, 26).padEnd(27)} ${(grauVelho || '—')}${mudou ? ` → ${grauNovo}  ⚠` : '  ✓'}`);
}

if (estouram.length) {
    console.log(`\n⚠ ${estouram.length} ficha(s) mudam de Grau quando o rider é contado:`);
    for (const e of estouram) console.log(`   ${e.nome.padEnd(24)} ${e.de} → ${e.para}   (carimbo ${br(e.carimbo)}× · com rider ${br(e.total)}×)`);
    console.log(`
   NÃO recarimbei nenhuma. O carimbo é campo separado (criatura.nivelAmeaca)
   e mexer nele é decisão sua — inclusive porque a régua conta o rider da
   linha em que ele está, e nem sempre essa é a linha principal da criatura.`);
}

if (erros.length) { console.log('\n❌ ERROS — nada foi gravado:'); erros.forEach(e => console.log('   ' + e)); process.exit(1); }
console.log(`\n✅ ${plano.length} fichas para atualizar. Só o texto de ataque muda; carimbo, dado e Alvo ficam como estão.`);

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const iso = new Date().toISOString();
const batch = db.batch();
for (const p of plano) batch.update(p.ref, { ataques: p.depois, lastUpdate: iso, lastUpdateBy: AUTOR });
await batch.commit();
console.log(`\n✅ ${plano.length} fichas com o nome certo da condição.`);
process.exit(0);
