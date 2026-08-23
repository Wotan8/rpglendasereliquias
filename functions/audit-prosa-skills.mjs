/**
 * AUDITORIA — a prosa das habilidades cita coisa que não existe mais?
 *
 * O sistema passou por renomeações e remoções que não foram propagadas para o
 * texto das habilidades. Prosa errada é pior que prosa ausente: ela tem
 * credibilidade e manda o jogador procurar uma regra que não existe.
 *
 * SÓ LEITURA. Sai com 1 se achar ocorrência.
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const D = db.collection('system').doc('data');

const REGRAS = [
    [/especializa[çc]/i, 'Especializações foram REMOVIDAS do sistema na v1.7'],
    [/\bDetermina[çc][ãa]o\b/i, 'Determinação virou Energia'],
    [/\bFio\b|\bGrau de Fio\b/i, 'Grau e Fio viraram Qualidade 0-5'],
    [/sem gastar a[çc][ãa]o|sem custo de a[çc][ãa]o|n[ãa]o gasta a[çc][ãa]o/i, 'o §0.5 proíbe: nenhuma habilidade é isenta de Ação'],
    [/usar a Rea[çc][ãa]o|usa a Rea[çc][ãa]o|Rea[çc][ãa]o de \*\*|gasta.{0,12}Rea[çc][ãa]o/i, 'Reação como AÇÃO não existe: o v3 tirou o dado do defensor'],
    [/\bRea[çc][ãa]o\b(?!.{0,30}(qu[íi]mica|humana))/i, 'o VD Reação virou "Defesa" em 16/08/2026'],
    [/rola.{0,25}defesa|defensor rola|teste de defesa/i, 'no v3 só o atacante rola; a Defesa é um número'],
];

const classeDe = {};
for (const doc of (await D.collection('classes').get()).docs)
    for (const m of (doc.data().modulosDaClasse || [])) classeDe[m] = doc.data().nome;

const achados = {};
let n = 0;
for (const doc of (await D.collection('classModules').get()).docs) {
    const m = doc.data();
    if (m.publicado === false) continue;
    for (const p of (m.itensPredefinidos || [])) {
        const texto = [p.descricao, ...Object.values(p.valores || {})]
            .filter(v => typeof v === 'string' && v.length > 12).join(' · ');
        for (const [re, porque] of REGRAS) {
            const mt = texto.match(re);
            if (!mt) continue;
            n++;
            const cls = classeDe[doc.id] || '?';
            const i = texto.indexOf(mt[0]);
            (achados[cls] = achados[cls] || []).push(
                `${p.nome}\n        "...${texto.slice(Math.max(0, i - 55), i + 75).replace(/\s+/g, ' ')}..."\n        -> ${porque}`);
        }
    }
}
for (const [cls, arr] of Object.entries(achados)) {
    console.log(`\n===== ${cls} =====`);
    arr.forEach(x => console.log(`  ! ${x}`));
}
console.log(n ? `\n${n} ocorrencias de prosa desatualizada.` : '\nProsa limpa.');
process.exit(n ? 1 : 0);
