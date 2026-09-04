/**
 * Fase C5 do Núcleo v2 — condições: doze, com portão, e as Aflições.
 * Livro de 12 Páginas, p. 9.
 *
 *   node functions/v2-condicoes.mjs            dry-run: lista tudo, não grava nada
 *   node functions/v2-condicoes.mjs --apply    grava (antes salva o estado atual em BACKUP_DIR)
 *
 * O que faz:
 *  1. As doze condições do Livro ganham `portao` (direto | corpo | mente | nenhum), níveis,
 *     Desvantagem e o efeito por rodada por nível; Sangrando, Queimando e Envenenado nascem;
 *     Agarrado vira Preso
 *  2. Peçonha vira Aflição (`aflicao: true`, com piora, cura por potência e desfecho)
 *  3. Estados de habilidade que o código ou os predefs citam (Presa, Blindado, Exposto…)
 *     ficam, com o portão marcado; condições sem nenhuma citação são despublicadas
 *  4. Predefs: Agarrado/Imobilizado → Preso, Queimadura/Inflamado → Queimando,
 *     Hemorragia/Dilacerar/Chaga → Sangrando; `chance` some e o `portao` do predef só
 *     sobrevive como 'nenhum'/'automatico' — o portão agora é da condição
 *  5. Itens com `condicaoIds` apontando para condição fundida apontam para a nova
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const DEL = admin.firestore.FieldValue.delete();
const APPLY = process.argv.includes('--apply');
const BACKUP_DIR = 'D:/Imagem/US - Universo Soberano/RPG/Reliera/Backup Firestore 2026-09-03/scripts-backups';

const col = async (p) => (await db.collection(p).get()).docs.map(d => ({ ...d.data(), id: d.id }));
const proximaVersao = (v) => {
    const n = parseFloat(String(v ?? '').replace(',', '.').replace(/[^\d.]/g, ''));
    return Number.isFinite(n) && n > 0 ? (Math.round(n * 100 + 1) / 100).toFixed(2) : '1.00';
};
const agora = new Date().toISOString();
const ops = [];
const op = (caminho, data, antes, log, set = false) => ops.push({ ref: db.doc(caminho), data, antes, log, set });
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const [conds, mods, eq, runic, mecs] = await Promise.all([
    col('system/data/conditions'), col('system/data/classModules'), col('system/data/equipment'), col('system/data/runicElements'), col('system/data/mechanics'),
]);
const cond = (n) => conds.find(c => norm(c.nome) === norm(n));
const niveis = (sinal, texto) => [1, 2, 3, 4, 5].map(n => ({ nivel: n, efeito: texto.replace('N', String(n)), modAlvo: sinal * n }));

// ---------- 1. as doze ----------
const DOZE = {
    'Atordoado': { portao: 'corpo', afetaTabuleiro: true, perdeTurno: true, descricao: 'Perde o turno.' },
    'Prostrado': { portao: 'corpo', desvantagem: true, descricao: 'Desvantagem em tudo; levantar custa o Movimento.' },
    'Preso': { portao: 'corpo', afetaTabuleiro: true, multiplicadorDeslocamento: 0, testeParaSair: true, testeNome: 'Força + Briga', testeMod: 0, testeQuando: 'acao_padrao', testeSucessoRemove: 'tudo', icone: '🪢',
        descricao: 'Não se move (agarrado, rede, raiz, gelo). Sair é uma Ação: FOR + Briga ou DES + Acrobacia; contra quem agarra, Graus ≥ VIG dele.' },
    'Lento': { portao: 'direto', afetaTabuleiro: true, multiplicadorDeslocamento: 0.5, descricao: 'Metade do deslocamento.' },
    'Cego': { portao: 'corpo', desvantagem: true, modAlvoTestes: DEL, afetaTabuleiro: true, multiplicadorVisao: 0, descricao: 'Desvantagem; não mira o que não percebe.' },
    'Surdo': { portao: 'corpo', descricao: 'Desvantagem em Percepção; magia verbal não funciona nele.' },
    'Amedrontado': { portao: 'mente', modAlvoTestes: -1, descricao: '−1 em tudo; não se aproxima da fonte.' },
    'Sangrando': { id: 'cond_sangrando', icone: '🩸', portao: 'direto', acumulaNiveis: true, nivelMaximo: 5, afetaTabuleiro: true, porRodadaEfeito: 'dano_vit', porRodadaValor: '1', porRodadaPorNivel: true, duracao: 'até ser tratado', removivel: true,
        descricao: 'N de dano por rodada até ser tratado.', efeitoPorNivel: niveis(0, 'N de dano por rodada').map(l => ({ ...l, modAlvo: null })) },
    'Queimando': { id: 'cond_queimando', icone: '🔥', portao: 'direto', acumulaNiveis: true, nivelMaximo: 5, afetaTabuleiro: true, porRodadaEfeito: 'dano_vit', porRodadaValor: '1', porRodadaPorNivel: true, duracao: 'até apagar', removivel: true,
        descricao: 'N de dano por rodada, ignora Blindagem.', efeitoPorNivel: niveis(0, 'N de dano por rodada, ignora Blindagem').map(l => ({ ...l, modAlvo: null })) },
    'Envenenado': { id: 'cond_envenenado', icone: '🧪', portao: 'direto', acumulaNiveis: true, nivelMaximo: 5, duracao: '1 cena', removivel: true,
        descricao: '−N em todos os testes.', efeitoPorNivel: niveis(-1, '−N em todos os testes') },
    'Oculto': { portao: 'nenhum', descricao: 'Seus ataques ignoram a Defesa; acaba quando você age.' },
    'Fortalecido': { portao: 'nenhum', acumulaNiveis: true, nivelMaximo: 5, descricao: '+N em todos os testes.', efeitoPorNivel: niveis(1, '+N em todos os testes') },
    'Abalado': { portao: 'mente', acumulaNiveis: true, nivelMaximo: 5, descricao: '−N em todos os testes.', efeitoPorNivel: niveis(-1, '−N em todos os testes') },
};
const RENOMES = { 'Agarrado': 'Preso' };
for (const [nome, patch] of Object.entries(DOZE)) {
    const antigo = Object.entries(RENOMES).find(([, novo]) => novo === nome)?.[0];
    const doc = cond(nome) || (antigo ? cond(antigo) : null);
    const { id: novoId, ...campos } = patch;
    if (doc) {
        const data = { ...campos, aflicao: false, versao: proximaVersao(doc.versao), updatedAt: Date.now() };
        if (antigo && norm(doc.nome) === norm(antigo)) data.nome = nome;
        op(`system/data/conditions/${doc.id}`, data, Object.fromEntries(Object.keys(data).map(k => [k, doc[k] ?? null])), `condição ${doc.nome}${data.nome ? ' → ' + data.nome : ''}: portão ${campos.portao}`);
    } else {
        op(`system/data/conditions/${novoId}`, { nome, aflicao: false, publicado: true, versao: '1.00', criadoEm: Date.now(), updatedAt: Date.now(), efeitoMecanicaIds: [], ...campos }, null, `condição ${nome}: criada (portão ${campos.portao})`, true);
    }
}

// ---------- 2. Peçonha vira Aflição ----------
const peconha = cond('Peçonha');
if (peconha) op(`system/data/conditions/${peconha.id}`, {
    aflicao: true, portao: 'direto', acumulaNiveis: true, nivelMaximo: 5, afetaTabuleiro: true, porRodadaEfeito: 'dano_vit', porRodadaValor: '1', porRodadaPorNivel: false,
    descricao: '1 de dano por rodada, durante 4N rodadas. Não para com o fim da cena.',
    aflicaoPiora: 'Mordida nova no mesmo alvo sobe +1 nível, até 5.',
    aflicaoCura: 'Só Caltra de potência ≥ N. Descanso, Herbalismo e cura comum não tiram.',
    aflicaoDesfecho: 'O que acontece se ninguém curar: o Narrador decide pela criatura que mordeu.',
    versao: proximaVersao(peconha.versao), updatedAt: Date.now(),
}, { aflicao: peconha.aflicao ?? null, portao: peconha.portao ?? null }, 'condição Peçonha: vira Aflição (cura por potência)');

// ---------- 3. estados que ficam, e o resto sai ----------
const ESTADOS = {
    'Presa': 'nenhum', 'Blindado': 'nenhum', 'Exposto': 'nenhum', 'Encantado': 'mente', 'Provocado': 'mente', 'Drenado': 'direto',
    'Célere': 'nenhum', 'Acelerado': 'nenhum', 'Consagrado': 'nenhum', 'Erosão': 'direto', 'Em Transe': 'nenhum', 'Corrompido': 'mente',
    'Entorpecido': 'corpo', 'Exaustão': 'nenhum', 'Sobrecarregado': 'nenhum', 'Inabalável': 'nenhum', 'Congelamento': 'corpo', 'Ofuscado': 'corpo',
};
for (const [nome, portao] of Object.entries(ESTADOS)) {
    const c = cond(nome); if (!c || c.publicado === false) continue;
    if (c.portao === portao) continue;
    op(`system/data/conditions/${c.id}`, { portao, aflicao: false, versao: proximaVersao(c.versao), updatedAt: Date.now() }, { portao: c.portao ?? null }, `estado ${nome}: portão ${portao}`);
}
const FUNDIDAS = { 'Imobilizado': 'Preso', 'Queimadura': 'Queimando', 'Inflamado': 'Queimando', 'Hemorragia': 'Sangrando', 'Dilacerar': 'Sangrando', 'Chaga': 'Sangrando' };
const SAEM = ['Afogando', 'Alento', 'Amplificado', 'Ancorado', 'Definhado', 'Delírio', 'Desorientado', 'Dreno de Luz', 'Eletrocutado', 'Envelhecido',
    'Estagnado', 'Fratura', 'Infecção', 'Ligeireza', 'Náusea', 'Necrose', 'Opaco', 'Pacto de Sangue', 'Purificado', 'Reanimado', 'Rejuvenescido',
    'Serenidade', 'Simbionte', 'Veneno Cristalizante', 'Vennire', 'Vigorado', ...Object.keys(FUNDIDAS)];
const mantidas = new Set([...Object.keys(DOZE), 'Peçonha', ...Object.keys(ESTADOS)].map(norm));
for (const nome of SAEM) {
    const c = cond(nome); if (!c || c.publicado === false) continue;
    if (mantidas.has(norm(nome))) continue;
    op(`system/data/conditions/${c.id}`, { publicado: false, aposentadoEm: agora, aposentadoPor: FUNDIDAS[nome] ? `v2-C5: fundida em ${FUNDIDAS[nome]}` : 'v2-C5: doze condições + Aflições', fundidaEm: FUNDIDAS[nome] || null, updatedAt: Date.now() },
        { publicado: c.publicado ?? null }, `condição ${nome}: despublicada${FUNDIDAS[nome] ? ' → ' + FUNDIDAS[nome] : ''}`);
}
const semDestino = conds.filter(c => c.publicado !== false && !mantidas.has(norm(c.nome)) && !SAEM.map(norm).includes(norm(c.nome)));
if (semDestino.length) console.log('⚠️ condições publicadas fora de qualquer lista (ficam como estão):', semDestino.map(c => c.nome).join(', '));

// ---------- 4. predefs ----------
const RENOME_NOME = { ...RENOMES, ...FUNDIDAS, 'Ofuscado': 'Ofuscado' };
const portaoDaCondicao = (nome) => DOZE[RENOME_NOME[nome] || nome]?.portao ?? ESTADOS[nome] ?? cond(nome)?.portao ?? null;
for (const m of mods) {
    let mudou = false;
    const novos = (m.itensPredefinidos || []).map(p => {
        let q = p;
        if (Array.isArray(p.condicoesAplicadas) && p.condicoesAplicadas.length) {
            const lista = p.condicoesAplicadas.map(c => {
                const nomeNovo = RENOME_NOME[c.condicao] || c.condicao;
                const portao = c.portao === 'automatico' ? 'automatico' : (portaoDaCondicao(nomeNovo) === 'nenhum' ? 'nenhum' : null);
                const { chance, ...resto } = c;
                const n = { ...resto, condicao: nomeNovo, portao };
                if (JSON.stringify(n) !== JSON.stringify(c)) mudou = true;
                return n;
            });
            q = { ...q, condicoesAplicadas: lista };
        }
        if (q.condicaoNome && RENOME_NOME[q.condicaoNome] && RENOME_NOME[q.condicaoNome] !== q.condicaoNome) { q = { ...q, condicaoNome: RENOME_NOME[q.condicaoNome] }; mudou = true; }
        if (typeof q.descricao === 'string') {
            let d = q.descricao;
            for (const [a, b] of Object.entries({ ...RENOMES, ...FUNDIDAS })) d = d.replace(new RegExp(`\\b${a}\\b`, 'g'), b);
            if (d !== q.descricao) { q = { ...q, descricao: d, valores: q.valores?.['5'] === q.descricao ? { ...q.valores, 5: d } : q.valores }; mudou = true; }
        }
        return q;
    });
    if (mudou) op(`system/data/classModules/${m.id}`, { itensPredefinidos: novos, versao: proximaVersao(m.versao), updatedAt: Date.now() }, { itensPredefinidos: m.itensPredefinidos }, `módulo ${m.titulo}: condições dos predefs no vocabulário novo (sem chance)`);
}
for (const r of runic) {
    // só os campos que citam condição mudam — Timestamp e o resto ficam intocados
    const data = {}; const antes = {};
    for (const [k, v] of Object.entries(r)) {
        if (k === 'id' || v == null || typeof v !== 'object') continue;
        const s = JSON.stringify(v); let s2 = s;
        for (const [a, b] of Object.entries({ ...RENOMES, ...FUNDIDAS })) s2 = s2.replace(new RegExp(`"condicao":"${a}"`, 'g'), `"condicao":"${b}"`);
        if (s2 !== s) { data[k] = JSON.parse(s2); antes[k] = v; }
    }
    if (Object.keys(data).length) op(`system/data/runicElements/${r.id}`, { ...data, versao: proximaVersao(r.versao), updatedAt: Date.now() }, antes, `elemento rúnico ${r.nome}: condições renomeadas em ${Object.keys(data).join(', ')}`);
}

// ---------- 5. itens ----------
const idNovo = {};
for (const [a, b] of Object.entries(FUNDIDAS)) { const ca = cond(a), cb = cond(b); if (ca) idNovo[ca.id] = cb?.id || DOZE[b]?.id || null; }
for (const e of eq) {
    const ids = e.condicaoIds || []; if (!ids.length) continue;
    const novos = ids.map(x => (typeof x === 'string' ? idNovo[x] || x : (idNovo[x.id] ? { ...x, id: idNovo[x.id] } : x)));
    if (JSON.stringify(novos) === JSON.stringify(ids)) continue;
    op(`system/data/equipment/${e.id}`, { condicaoIds: novos, versao: proximaVersao(e.versao), updatedAt: Date.now() }, { condicaoIds: ids }, `equipment ${e.nome}: condição fundida reapontada`);
}
const citamMorta = mecs.filter(m => m.publicado !== false && Object.keys(FUNDIDAS).some(n => JSON.stringify(m).includes(`"${n}"`)));
if (citamMorta.length) console.log('⚠️ mecânicas ainda citam condição fundida por nome:', citamMorta.map(m => m.nome).join(', '));

// ---------- relatório ----------
console.log(`ops: ${ops.length}`);
for (const o of ops) console.log(' ', o.log);
if (!APPLY) { console.log('\n(dry-run: nada gravado; use --apply)'); process.exit(0); }

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const bk = path.join(BACKUP_DIR, `_backup-condicoes-${agora.replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(bk, JSON.stringify(ops.map(o => ({ doc: o.ref.path, antes: o.antes })), null, 1));
console.log('backup:', bk);
for (let i = 0; i < ops.length; i += 400) {
    const b = db.batch();
    ops.slice(i, i + 400).forEach(o => o.set ? b.set(o.ref, o.data, { merge: true }) : b.update(o.ref, o.data));
    await b.commit();
}
console.log(`gravado: ${ops.length} documentos`);
process.exit(0);
