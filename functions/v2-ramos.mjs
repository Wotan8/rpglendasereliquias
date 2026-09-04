/**
 * Fase C7 do Núcleo v2 — Escola e Ramo aplicados.
 * Livro de 12 Páginas, p. 7 (Escola e Ramo; comprar habilidade = Qualidade × 4 EXP; segundo ramo)
 * e p. 8 (Necromancia por Qualidade, Lealdade, Voduísmo, Ferinismo).
 *
 *   node functions/v2-ramos.mjs            dry-run: lista tudo, não grava nada
 *   node functions/v2-ramos.mjs --apply    grava (antes salva o estado atual em BACKUP_DIR)
 *
 * O que faz:
 *  1. Habilidade de ramo custa Qualidade × 4 EXP (config/regras exp.habilidadePorQualidade): o
 *     `custoExpProprio` fixo dos predefs com Qualidade sai, e o código passa a calcular
 *  2. Rituais Necromânticos por Qualidade: Fantoche (Q1), Servo (Q2), Servo Hábil (Q3), Servo
 *     Consciente (Q4), Servo Quase Perfeito (Q5, com Lealdade); Vozes do Túmulo fica; o limite de
 *     rituais conhecidos sai (o limite do Livro é de servos DE PÉ, e mora no texto)
 *  3. Espiritismo e Voduísmo viram ramos opcionais do Xamã (`ramoOpcional`): um na criação, o
 *     outro por 10 EXP com Totemancia 2 (config/regras exp.segundoRamo / segundoRamoPericiaMinima)
 *  4. Ferinismo e Voduísmo ganham a regra própria no texto do módulo
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
const op = (caminho, data, antes, log) => ops.push({ ref: db.doc(caminho), data, antes, log });

const mods = await col('system/data/classModules');

// ---------- 2. Necromancia por Qualidade ----------
const necro = mods.find(m => m.id === 'ritual_necro');
if (necro && !(necro.itensPredefinidos || []).some(p => p.id === 'pdi_necro_servo_q2')) {
    const antigos = necro.itensPredefinidos || [];
    const fant = antigos.find(p => /fantoche/i.test(p.nome)) || {};
    const rean = antigos.find(p => /reanima/i.test(p.nome)) || {};
    const vozes = antigos.find(p => /vozes/i.test(p.nome));
    const REQUER = 'Talismã Profano; cadáver que nunca foi reanimado (ritual falho consome o cadáver)';
    const COMUM = 'O servo nasce Abalado (3 − Graus do ritual), mínimo 0, para sempre. Cada servo de pé come 1 Sanidade sua por sessão; fantoche não. De pé ao mesmo tempo: até Necromancia servos e outros tantos fantoches.';
    const nec = (id, nome, q, custo, tempo, duracao, quando, acao, descricao, teste, extra = {}) => ({
        id, nome, qualidade: q, custoExpProprio: null, custoCriacaoMecanicaIds: null, custoEquipamentos: null,
        descricao, alcance: null, formaArea: 'nenhuma', tamanhoArea: null, alvosMax: null, duracaoValor: null, duracaoUnidade: null,
        condicoesAplicadas: [], economia: 'cena',
        valores: { 1: nome, 2: descricao, 3: custo, 4: REQUER, 5: tempo, 6: duracao, 7: '', 8: quando, 10: teste || '', 11: 'Teste: PRS + Necromancia (o Alvo da Escola). Graus abaixo de 0: o cadáver é consumido.', 13: '', 14: '', 16: '', 17: '', 19: '', 20: '', 21: q, acao },
        ...extra,
    });
    const novos = [
        nec('pdi_necro_fantoche_q1', 'ERGUER FANTOCHE', 1, '1 Energia', 'Ação Completa, em combate', '1 cena', 'Em combate ou fora dele', 'Ação Completa (turno inteiro)',
            `Carne obediente: ordem de uma palavra, nada de quem foi. Dura 1 cena e não come Sanidade. ${COMUM}`, fant.valores?.['10'],
            { formaArea: fant.formaArea || 'onda', tamanhoArea: fant.tamanhoArea ?? null, economia: 'invocacao', criaturasVinculadas: fant.criaturasVinculadas || [], faccao: 'aliado', duracaoValor: 1, duracaoUnidade: 'cena' }),
        nec('pdi_necro_servo_q2', 'RITUAL DE REANIMAÇÃO — SERVO', 2, '1 Energia', '30 min a 1 h', 'até morrer de novo', 'Fora de combate', 'Fora de combate',
            `Levanta um servo que obedece ordens simples. ${COMUM}`, rean.valores?.['10'], { criaturasVinculadas: rean.criaturasVinculadas || [], faccao: 'aliado' }),
        nec('pdi_necro_servo_q3', 'RITUAL DE REANIMAÇÃO — SERVO HÁBIL', 3, '2 Energia', '30 min a 1 h', 'até morrer de novo', 'Fora de combate', 'Fora de combate',
            `Levanta um servo que obedece e usa UMA perícia de quem foi (o Narrador escolhe pela vida que teve). ${COMUM}`, rean.valores?.['10'], { criaturasVinculadas: rean.criaturasVinculadas || [], faccao: 'aliado' }),
        nec('pdi_necro_servo_q4', 'RITUAL DE REANIMAÇÃO — SERVO CONSCIENTE', 4, '2 Energia', '30 min a 1 h', 'até morrer de novo', 'Fora de combate', 'Fora de combate',
            `Levanta um servo que reconhece rostos e cumpre tarefa complexa. ${COMUM}`, rean.valores?.['10'], { criaturasVinculadas: rean.criaturasVinculadas || [], faccao: 'aliado' }),
        nec('pdi_necro_servo_q5', 'RITUAL DE REANIMAÇÃO — SERVO QUASE PERFEITO', 5, '3 Energia', 'uma noite', 'até morrer de novo', 'Fora de combate', 'Fora de combate',
            `Levanta um servo que lembra quem foi; tem Lealdade (0 a 10, limiar máx(6, 10 − Necromancia)) e pode recusar. O Narrador escreve na ficha do servo o que ele não faria em vida; ordem que bate nisso só é cumprida com a Lealdade no limiar. Forçar: 1 Energia e um teste de Necromancia; passando, ele cumpre e a Lealdade cai 1. ${COMUM}`, rean.valores?.['10'], { criaturasVinculadas: rean.criaturasVinculadas || [], faccao: 'aliado' }),
    ];
    if (vozes) novos.push({ ...vozes, qualidade: 1, custoExpProprio: null, valores: { ...vozes.valores, 3: '1 Energia', 21: 1 } });
    const schema = (necro.schema || []).map(f => f.key === '21' ? { ...f, label: 'Perícia mínima (Necromancia):' } : f);
    op(`system/data/classModules/${necro.id}`, {
        itensPredefinidos: novos, schema, limiteFixo: null, custoExpPorItem: 0,
        descricao: 'Todo ritual exige o Talismã Profano e um cadáver que nunca foi reanimado; ritual falho consome o cadáver. A Qualidade do ritual diz o que levanta (Livro, p. 8). Comprar um ritual custa Qualidade × 4 EXP.',
        versao: proximaVersao(necro.versao), updatedAt: Date.now(),
    }, { itensPredefinidos: antigos, schema: necro.schema, limiteFixo: necro.limiteFixo ?? null, custoExpPorItem: necro.custoExpPorItem ?? null }, `módulo ${necro.titulo}: 5 rituais por Qualidade + Vozes do Túmulo; sem limite de rituais conhecidos`);
}

// ---------- 1, 3, 4. os demais ramos ----------
const TEXTO = {
    mod_totem: { ramoOpcional: true, descricao: 'Espiritismo (Xamã). Quem vem é um Eco, morto; consentimento a cada vez. Regra própria: a Supressão, como está no Compêndio. O Xamã escolhe um ramo na criação e compra o outro por 10 EXP com Totemancia 2 (Livro, p. 7–8).' },
    mod_vodu: { ramoOpcional: true, descricao: 'Voduísmo (Xamã). Quem vem é um vivo, sem saber, por uma parte dele. Regra própria: Elos ativos ≤ Totemancia; o Elo é o nível da condição. O Xamã escolhe um ramo na criação e compra o outro por 10 EXP com Totemancia 2 (Livro, p. 7–8).' },
    ally_animal: { descricao: 'Ferinismo (Druida). Quem vem é um bicho, por vontade, em sessões. Regra própria: Lealdade no limiar (máx(6, 10 − Totemancia)) sela o vínculo; só o vínculo abre a Fusão Selvagem (Livro, p. 8).' },
};
let semCustoFixo = 0;
for (const m of mods) {
    if (m.id === 'ritual_necro') continue;
    const data = {}; const antes = {}; const log = [];
    if (TEXTO[m.id]) {
        for (const [k, v] of Object.entries(TEXTO[m.id])) if (m[k] !== v) { data[k] = v; antes[k] = m[k] ?? null; }
        if (Object.keys(data).length) log.push(Object.keys(data).join('+'));
    }
    if (m.escolaId) {
        const itens = (m.itensPredefinidos || []).map(p => {
            const q = Number(p.qualidade ?? p.valores?.qualidade) || 0;
            if (q >= 1 && p.custoExpProprio !== null && p.custoExpProprio !== undefined) { semCustoFixo++; return { ...p, custoExpProprio: null }; }
            return p;
        });
        if (JSON.stringify(itens) !== JSON.stringify(m.itensPredefinidos || [])) { data.itensPredefinidos = itens; antes.itensPredefinidos = m.itensPredefinidos; log.push('custoExpProprio → Qualidade × 4'); }
    }
    if (!Object.keys(data).length) continue;
    data.versao = proximaVersao(m.versao); data.updatedAt = Date.now();
    op(`system/data/classModules/${m.id}`, data, antes, `módulo ${m.titulo}: ${log.join('; ')}`);
}

// ---------- relatório ----------
console.log(`ops: ${ops.length} | predefs sem custo fixo (Q × 4 pelo código): ${semCustoFixo}`);
for (const o of ops) console.log(' ', o.log);
if (!APPLY) { console.log('\n(dry-run: nada gravado; use --apply)'); process.exit(0); }

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const bk = path.join(BACKUP_DIR, `_backup-ramos-${agora.replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(bk, JSON.stringify(ops.map(o => ({ doc: o.ref.path, antes: o.antes })), null, 1));
console.log('backup:', bk);
for (let i = 0; i < ops.length; i += 400) {
    const b = db.batch();
    ops.slice(i, i + 400).forEach(o => b.update(o.ref, o.data));
    await b.commit();
}
console.log(`gravado: ${ops.length} documentos`);
process.exit(0);
