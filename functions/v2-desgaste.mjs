/**
 * Fase C8 do Núcleo v2 — desgaste, Sanidade e Trauma no cadastro de condições.
 * Livro de 12 Páginas, p. 10 (as trilhas) e p. 11 (Trauma).
 *
 *   node functions/v2-desgaste.mjs            dry-run: lista tudo, não grava nada
 *   node functions/v2-desgaste.mjs --apply    grava (antes salva o estado atual em BACKUP_DIR)
 *
 * O que faz:
 *  1. Ferimento: Ferido (−1), Grave (−2), Beira da Morte (Desvantagem + teste PRS + Resiliência no
 *     início do turno; falhou → Acuado) e Morrendo (não age; Teste de Morte VIG + PRS a cada turno)
 *     como condições da trilha `ferimento`, que a ficha e o Tabuleiro aplicam sozinhos pela Vitalidade
 *  2. Fome, Sede, Exaustão e Sobrecarregado como condições de 3 níveis (nível 3 = Desvantagem);
 *     Sobrecarregado é da trilha `sobrecarga`, aplicada pela ficha a partir do inventário
 *  3. Trauma (card: Gatilho, Origem, Intensidade) e Enlouquecendo como condições sem portão
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
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

const conds = await col('system/data/conditions');
const cond = (n) => conds.find(c => norm(c.nome) === norm(n));
const niveis = (linhas) => linhas.map((efeito, i) => ({ nivel: i + 1, efeito, modAlvo: i === 2 ? null : -(i + 1) }));

const BASE = { publicado: true, efeitoMecanicaIds: [], removivel: true, portao: 'nenhum', aflicao: false };
const NOVAS = {
    cond_ferido: { nome: 'Ferido', icone: '🩹', trilha: 'ferimento', modAlvoTestes: -1, duracao: 'enquanto a Vitalidade estiver na faixa', descricao: 'Vitalidade até 75%: −1 em tudo. Cura tira você da faixa na hora (Livro, p. 10).' },
    cond_grave: { nome: 'Grave', icone: '🩸', trilha: 'ferimento', modAlvoTestes: -2, duracao: 'enquanto a Vitalidade estiver na faixa', descricao: 'Vitalidade até 50%: −2 em tudo. Cura tira você da faixa na hora (Livro, p. 10).' },
    cond_beira: { nome: 'Beira da Morte', icone: '💀', trilha: 'ferimento', desvantagem: true, duracao: 'enquanto a Vitalidade estiver na faixa',
        testeParaSair: true, testeNome: 'Perseverança + Resiliência', testeMod: 0, testeQuando: 'inicio_do_turno', testeSucessoRemove: 'nenhuma', testeFalhaAplica: 'Acuado', testeFalhaRodadas: 1,
        descricao: 'Vitalidade até 25%: Desvantagem em tudo. No início de cada turno seu, teste PRS + Resiliência (1 Energia dá +2). Falhou: neste turno você não ataca nem se aproxima de quem te feriu por último; só foge, se defende ou se cura (Livro, p. 10).' },
    cond_morrendo: { nome: 'Morrendo', icone: '☠️', trilha: 'ferimento', duracao: 'até estabilizar', afetaTabuleiro: true, bloqueiaAcoes: ['padrao', 'movimento', 'livre', 'completa'], perdeTurno: false,
        testeParaSair: true, testeNome: 'Vigor + Perseverança', testeMod: 0, testeQuando: 'inicio_do_turno', testeSucessoRemove: 'nenhuma', testeMorte: true,
        descricao: 'Vitalidade 0: cai, não age. Teste de Morte (VIG + PRS) a cada turno: passou, +1 Vitalidade e estabiliza em 1; falhou, −1; desastre, −2. Morre no negativo do máximo (Livro, p. 10).' },
    cond_acuado: { nome: 'Acuado', icone: '😰', duracao: '1 rodada', descricao: 'Falhou no teste da Beira da Morte: neste turno não ataca nem se aproxima de quem o feriu por último; só foge, se defende ou se cura.' },
    cond_fome: { nome: 'Fome', icone: '🍖', acumulaNiveis: true, nivelMaximo: 3, desvantagemNoNivel: 3, duracao: 'até comer e descansar', efeitoPorNivel: niveis(['−1 nos testes físicos (FOR, DES, VIG)', '−2 nos testes físicos; o Descanso Longo não recupera Vitalidade', 'Desvantagem nos testes físicos; −1 Vitalidade ao acordar']),
        descricao: 'Sobe a cada dia sem a ração do dia; desce com um dia com ração e Descanso Longo (Livro, p. 10).' },
    cond_sede: { nome: 'Sede', icone: '💧', acumulaNiveis: true, nivelMaximo: 3, desvantagemNoNivel: 3, duracao: 'até beber e descansar', efeitoPorNivel: niveis(['−1 em tudo', '−2 em tudo; o Descanso Longo não recupera nada', 'Desvantagem em tudo; −3 Vitalidade ao acordar; sem marcha forçada']),
        descricao: 'Sobe a cada dia sem água (calor: +2); desce com um dia com água e Descanso Longo (Livro, p. 10).' },
    cond_trauma: { nome: 'Trauma', icone: '🧠', duracao: 'até fechar', descricao: 'Card que o Narrador escreve: Gatilho (a coisa, não a categoria), Origem (quem causou) e Intensidade (a do horror, 1 a 5). Enquanto percebe o Gatilho, Desvantagem em todos os testes; 1 Energia ignora isso por um turno. Fecha derrotando a Origem ou com uma semana de tratamento (AUT + Empatia do tratador, Graus somados até a Intensidade). Intensidade 5 só fecha derrotando a Origem (Livro, p. 11).' },
    cond_enlouquecendo: { nome: 'Enlouquecendo', icone: '🌀', duracao: 'até fechar um Trauma', descricao: 'Três Traumas abertos: o Narrador joga o personagem até um fechar. Não existe morte por Sanidade (Livro, p. 11).' },
};
for (const [id, campos] of Object.entries(NOVAS)) {
    const ja = cond(campos.nome);
    if (ja) {
        op(`system/data/conditions/${ja.id}`, { ...BASE, ...campos, versao: proximaVersao(ja.versao), updatedAt: Date.now() }, Object.fromEntries(Object.keys(campos).map(k => [k, ja[k] ?? null])), `condição ${campos.nome}: atualizada (${ja.id})`);
    } else {
        op(`system/data/conditions/${id}`, { ...BASE, ...campos, versao: '1.00', criadoEm: Date.now(), updatedAt: Date.now() }, null, `condição ${campos.nome}: criada`, true);
    }
}
// Exaustão e Sobrecarregado: viram trilhas de 3 níveis
const ex = cond('Exaustão');
if (ex) op(`system/data/conditions/${ex.id}`, {
    acumulaNiveis: true, nivelMaximo: 3, desvantagemNoNivel: 3, portao: 'nenhum', duracao: 'até um Descanso Longo com 1 Grau',
    efeitoPorNivel: niveis(['−1 em tudo', '−2 em tudo; sem marcha forçada', 'Desvantagem em tudo; ao fim de cena de esforço, desmaia 1 h salvo VIG + Atletismo']),
    descricao: 'Sobe com noite sem Descanso Longo, dia de marcha forçada ou habilidade que aplica; desce com Descanso Longo com 1 Grau (Livro, p. 10).',
    versao: proximaVersao(ex.versao), updatedAt: Date.now(),
}, { nivelMaximo: ex.nivelMaximo ?? null, efeitoPorNivel: ex.efeitoPorNivel ?? null }, 'condição Exaustão: trilha de 3 níveis');
const sob = cond('Sobrecarregado');
if (sob) op(`system/data/conditions/${sob.id}`, {
    acumulaNiveis: true, nivelMaximo: 3, desvantagemNoNivel: 3, portao: 'nenhum', trilha: 'sobrecarga', duracao: 'enquanto o peso passar da Carga',
    efeitoPorNivel: niveis(['−1 nos testes físicos', '−2 nos testes físicos e Lento', 'Desvantagem nos testes físicos, Lento; cada trecho de viagem sobe 1 de Exaustão']),
    descricao: 'Peso acima da Carga: +25% nível 1, +50% nível 2, mais que isso nível 3. Larga peso, sai na hora. A ficha aplica sozinha (Livro, p. 10).',
    versao: proximaVersao(sob.versao), updatedAt: Date.now(),
}, { nivelMaximo: sob.nivelMaximo ?? null, efeitoPorNivel: sob.efeitoPorNivel ?? null, trilha: sob.trilha ?? null }, 'condição Sobrecarregado: trilha de 3 níveis (automática pela ficha)');

// ---------- relatório ----------
console.log(`ops: ${ops.length}`);
for (const o of ops) console.log(' ', o.log);
if (!APPLY) { console.log('\n(dry-run: nada gravado; use --apply)'); process.exit(0); }

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const bk = path.join(BACKUP_DIR, `_backup-desgaste-${agora.replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(bk, JSON.stringify(ops.map(o => ({ doc: o.ref.path, antes: o.antes })), null, 1));
console.log('backup:', bk);
for (let i = 0; i < ops.length; i += 400) {
    const b = db.batch();
    ops.slice(i, i + 400).forEach(o => o.set ? b.set(o.ref, o.data, { merge: true }) : b.update(o.ref, o.data));
    await b.commit();
}
console.log(`gravado: ${ops.length} documentos`);
process.exit(0);
