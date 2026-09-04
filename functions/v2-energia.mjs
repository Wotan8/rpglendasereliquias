/**
 * Fase C6 do Núcleo v2 — Energia e os contadores de cena.
 * Livro de 12 Páginas, p. 4 (as três barras, o contador de cena) e p. 8 (Carga, Harmonia).
 *
 *   node functions/v2-energia.mjs            dry-run: lista tudo, não grava nada
 *   node functions/v2-energia.mjs --apply    grava (antes salva o estado atual em BACKUP_DIR)
 *
 * O que faz:
 *  1. Energia Máxima = PRS + AUT + Melhor Perícia de Arte; as 13 Perícias de Arte ganham `arte: true`
 *  2. Graça de Palla sai: o VD e as 4 mecânicas são despublicados; as preces pagam em Energia
 *     (o botão "Pagar Custo" que apontava para -1/-2 Graça passa a apontar para -1/-2 ENER)
 *  3. "Bolha de Sangue" vira o contador "Carga de Sangue" (contadorDeCena), teto = VIG + Hemomancia;
 *     as mecânicas -N Carga apontam para o nome novo; Explosão Hemática idem; entram duas fontes
 *     de Carga como habilidades: Sangria da Veia (3 VIT → +1 Carga) e Colher Sangue Derramado
 *  4. Harmonia vira contador de cena com Clímax, teto = Sonoromancia; o Bardo ganha +1 fixo por
 *     canção que passa (retornoFixo) em vez de "devolve o que gastou"
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

const [skills, vds, mecs, mods, vitals] = await Promise.all([
    col('system/data/skills'), col('system/data/derivedValues'), col('system/data/mechanics'), col('system/data/classModules'), col('system/data/vitalStats'),
]);
const mec = (id) => mecs.find(m => m.id === id);
const vd = (n) => vds.find(v => v.nome === n);

// ---------- 1. Energia e as Artes ----------
const ARTES = ['Arma', 'Precisão', 'Briga', 'Disparo', 'Arremesso', 'Hemomancia', 'Abismancia', 'Necromancia', 'Pallomancia', 'Sonoromancia', 'Totemancia', 'Runomancia', 'Alquimancia'];
for (const nome of ARTES) {
    const s = skills.find(x => x.publicado !== false && x.nome === nome);
    if (!s) { console.error('perícia de Arte não encontrada:', nome); process.exit(1); }
    if (s.arte === true) continue;
    op(`system/data/skills/${s.id}`, { arte: true, versao: proximaVersao(s.versao), updatedAt: Date.now() }, { arte: s.arte ?? null }, `perícia ${nome}: arte`);
}
const energia = mec('4k7OVx5tQN2UwfnBJkpW');
if (energia && !JSON.stringify(energia).includes('Melhor Perícia de Arte')) {
    const calc = energia.config.calculos[0];
    op(`system/data/mechanics/${energia.id}`, {
        'config.calculos': [{ ...calc, equacao: [{ tipo: 'ficha', ref: 'PRS' }, { tipo: 'ficha', op: '+', ref: 'AUT' }, { tipo: 'ficha', op: '+', ref: 'Melhor Perícia de Arte' }] }],
        previewTexto: '+([PRS] + [AUT] + [Melhor Perícia de Arte]) em Energia Máxima', versao: proximaVersao(energia.versao), updatedAt: Date.now(),
    }, { calculos: energia.config.calculos, previewTexto: energia.previewTexto ?? null }, 'mecânica Energia: PRS + AUT + Melhor Perícia de Arte');
}

// ---------- 2. Graça sai ----------
const graca = vd('Graça de Palla');
if (graca && graca.publicado !== false)
    op(`system/data/derivedValues/${graca.id}`, { publicado: false, aposentadoEm: agora, aposentadoPor: 'v2-C6: as preces pagam em Energia (Livro, p. 4)', versao: proximaVersao(graca.versao), updatedAt: Date.now() }, { publicado: graca.publicado ?? null }, 'VD Graça de Palla: despublicado');
const MEC_GRACA = ['qtgmImldOytYawsE7mys', 'dRvq70VLI3srmMCdVUSv', 'crxDlfCATvoOPtU1Y2C7', 'j8XgFpUZ6o1Udzdmh68t'];
const TROCA_MEC = { crxDlfCATvoOPtU1Y2C7: 'gT5DZcIaG69aYuEjdXwQ', j8XgFpUZ6o1Udzdmh68t: 'tnDqEc9gTObQY7Fs7xHU' };   // -1/-2 Graça → -1/-2 ENER
for (const id of MEC_GRACA) {
    const m = mec(id); if (!m || m.publicado === false) continue;
    op(`system/data/mechanics/${id}`, { publicado: false, aposentadoEm: agora, aposentadoPor: 'v2-C6', updatedAt: Date.now() }, { publicado: m.publicado ?? null }, `mecânica ${m.nome}: despublicada`);
}
const trocaGraca = (s) => String(s)
    .replace(/(\d+)\s*Energia\s+ou\s+\d+\s*Graça(\s+de\s+Palla)?/gi, '$1 Energia')
    .replace(/(\d+)\s*Graça(\s+de\s+Palla)?/gi, '$1 Energia')
    .replace(/\bGraça de Palla\b/g, 'Energia');

// ---------- 3 + 4. módulos ----------
const CARGA = vd('Bolha de Sangue') || vd('Carga de Sangue');
const HARMONIA = vd('Harmonia');
if (!CARGA || !HARMONIA) { console.error('VDs Bolha de Sangue / Harmonia não encontrados'); process.exit(1); }
if (CARGA.nome !== 'Carga de Sangue' || !CARGA.contadorDeCena)
    op(`system/data/derivedValues/${CARGA.id}`, { nome: 'Carga de Sangue', contadorDeCena: true, climax: false, campoEditavel: true, icone: '🩸', versao: proximaVersao(CARGA.versao), updatedAt: Date.now() },
        { nome: CARGA.nome, contadorDeCena: CARGA.contadorDeCena ?? null }, 'VD Bolha de Sangue → Carga de Sangue (contador de cena)');
if (!HARMONIA.contadorDeCena || !HARMONIA.climax)
    op(`system/data/derivedValues/${HARMONIA.id}`, { contadorDeCena: true, climax: true, versao: proximaVersao(HARMONIA.versao), updatedAt: Date.now() },
        { contadorDeCena: HARMONIA.contadorDeCena ?? null, climax: HARMONIA.climax ?? null }, 'VD Harmonia: contador de cena com Clímax');
const tetoCarga = mec('kBANx5Y4m6Oq8LnoXMJR');
if (tetoCarga) op(`system/data/mechanics/${tetoCarga.id}`, {
    nome: 'Carga de Sangue', 'config.calculos': [{ ...tetoCarga.config.calculos[0], alvo: 'Carga de Sangue (Máximo)', operacao: '+', equacao: [{ tipo: 'ficha', ref: 'VIG' }, { tipo: 'ficha', op: '+', ref: 'Perícia: Hemomancia' }] }],
    previewTexto: '+([VIG] + [Hemomancia]) em Carga de Sangue (Máximo) — Livro, p. 8', versao: proximaVersao(tetoCarga.versao), updatedAt: Date.now(),
}, { nome: tetoCarga.nome, calculos: tetoCarga.config.calculos }, 'mecânica teto da Carga: VIG + Hemomancia');
const tetoHarm = mec('tZhVju6f3CKwLigH3RP2');
if (tetoHarm) op(`system/data/mechanics/${tetoHarm.id}`, {
    'config.calculos': [{ ...tetoHarm.config.calculos[0], alvo: 'Harmonia (Máximo)', operacao: '+', equacao: [{ tipo: 'ficha', ref: 'Perícia: Sonoromancia' }] }],
    previewTexto: '+([Sonoromancia]) em Harmonia (Máximo) — Livro, p. 8', versao: proximaVersao(tetoHarm.versao), updatedAt: Date.now(),
}, { calculos: tetoHarm.config.calculos }, 'mecânica teto da Harmonia: Sonoromancia');
for (const m of mecs.filter(m => m.publicado !== false && (m.config?.calculos || []).some(c => c.alvo === 'Bolha de Sangue' || (c.equacao || []).some(t => t.ref === 'Bolha de Sangue')))) {
    const novo = m.config.calculos.map(c => ({ ...c, alvo: c.alvo === 'Bolha de Sangue' ? 'Carga de Sangue' : c.alvo, equacao: (c.equacao || []).map(t => t.ref === 'Bolha de Sangue' ? { ...t, ref: 'Carga de Sangue' } : t) }));
    op(`system/data/mechanics/${m.id}`, { 'config.calculos': novo, versao: proximaVersao(m.versao), updatedAt: Date.now() }, { calculos: m.config.calculos }, `mecânica ${m.nome}: Bolha de Sangue → Carga de Sangue`);
}

for (const m of mods) {
    let mudou = false; const log = [];
    let itens = (m.itensPredefinidos || []).map(p => {
        let q = p;
        // Graça → Energia nos textos e no botão de pagar
        const s = JSON.stringify(q);
        if (/Graça/.test(s) || Object.values(TROCA_MEC).length && Object.keys(TROCA_MEC).some(id => s.includes(id))) {
            const valores = { ...(q.valores || {}) };
            for (const [k, v] of Object.entries(valores)) {
                if (typeof v !== 'string') continue;
                if (TROCA_MEC[v]) {
                    const jaTem = Object.entries(valores).some(([k2, v2]) => k2 !== k && v2 === TROCA_MEC[v]);
                    valores[k] = jaTem ? '' : TROCA_MEC[v];
                } else if (/Graça/.test(v)) valores[k] = trocaGraca(v);
            }
            const desc = typeof q.descricao === 'string' ? trocaGraca(q.descricao) : q.descricao;
            const custoIds = Array.isArray(q.custoCriacaoMecanicaIds) ? q.custoCriacaoMecanicaIds.map(id => TROCA_MEC[id] || id) : q.custoCriacaoMecanicaIds;
            q = { ...q, valores, descricao: desc, custoCriacaoMecanicaIds: custoIds };
            if (JSON.stringify(q) !== s) { mudou = true; log.push(`${p.nome}: Graça → Energia`); }
        }
        // Bolha de Sangue → Carga de Sangue nas fórmulas (refs entre colchetes)
        const s2 = JSON.stringify(q);
        if (s2.includes('[Bolha de Sangue]')) { q = JSON.parse(s2.replace(/\[Bolha de Sangue\]/g, '[Carga de Sangue]')); mudou = true; log.push(`${p.nome}: [Carga de Sangue]`); }
        return q;
    });
    const data = {};
    if (m.id === 'mod_pallomancia') {
        const schema = (m.schema || []).map(f => f.key === '11' ? { ...f, label: 'Perícia mínima (Pallomancia):' } : f);
        if (JSON.stringify(schema) !== JSON.stringify(m.schema)) { data.schema = schema; mudou = true; log.push('schema: Devoção em Palla → Pallomancia'); }
    }
    if (m.id === 'mod_sonoromancia' && (m.retornoFixo !== 1 || m.retornoBonusParado !== 0)) {
        Object.assign(data, { retornoFixo: 1, retornoBonusParado: 0, retornoExigeSucesso: true, retornoZeraSeFalhar: true, custoRecurso: 'Harmonia ou Energia' });
        mudou = true; log.push('Harmonia: +1 fixo por canção que passa; errar zera (Livro, p. 8)');
    }
    if (m.id === 'mod_hemomancia' && !itens.some(p => p.id === 'pdi_sang_veia')) {
        const base = itens[0] || {};
        const predef = (id, nome, acao, custo, descricao, extra = {}) => ({
            id, nome, descricao, custoExpProprio: 0, custoCriacaoMecanicaIds: null, custoEquipamentos: null,
            valores: { 1: nome, 2: '', 3: '', 4: custo, 5: descricao, 6: '', 7: '', 8: '', acao, qualidade: 0, dado: '', essencia: '', ataqueDireto: false },
            alcance: 0, formaArea: 'proprio', tamanhoArea: null, alvosMax: 1, duracaoValor: null, duracaoUnidade: null,
            condicoesAplicadas: [], anguloCone: null, bloqueavel: false, economia: 'cena', qualidade: 0, ...extra,
        });
        itens = [
            predef('pdi_sang_veia', 'Sangria da Veia', 'Ação Livre', '3 Vitalidade',
                'Abre a própria veia: 3 de Vitalidade viram 1 Carga de Sangue. Essa Vitalidade conta na trilha de Ferimento; no fim da cena, o sangue da veia que voltou devolve a Vitalidade (Livro, p. 8).',
                { ganhoRecurso: { nome: 'Carga de Sangue', qtd: 1 } }),
            predef('pdi_sang_colher', 'Colher Sangue Derramado', 'Ação de Movimento', '',
                'Sangue derramado na cena, de qualquer um, ao alcance: cada 3 de dano de corte ou perfuração no chão vira 1 Carga de Sangue. O Narrador diz quanto há; ajuste o contador. Sangue solto no chão morre no fim da cena (Livro, p. 8).',
                { alcance: 6, formaArea: 'unico' }),
            ...itens,
        ];
        mudou = true; log.push('+ Sangria da Veia, + Colher Sangue Derramado');
        void base;
    }
    if (!mudou) continue;
    data.itensPredefinidos = itens; data.versao = proximaVersao(m.versao); data.updatedAt = Date.now();
    op(`system/data/classModules/${m.id}`, data, { itensPredefinidos: m.itensPredefinidos, retornoFixo: m.retornoFixo ?? null, schema: m.schema ?? null }, `módulo ${m.titulo}: ${log.join('; ')}`);
}

// ---------- relatório ----------
console.log(`ops: ${ops.length}`);
for (const o of ops) console.log(' ', o.log);
if (!APPLY) { console.log('\n(dry-run: nada gravado; use --apply)'); process.exit(0); }

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const bk = path.join(BACKUP_DIR, `_backup-energia-${agora.replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(bk, JSON.stringify(ops.map(o => ({ doc: o.ref.path, antes: o.antes })), null, 1));
console.log('backup:', bk);
for (let i = 0; i < ops.length; i += 400) {
    const b = db.batch();
    ops.slice(i, i + 400).forEach(o => b.update(o.ref, o.data));
    await b.commit();
}
console.log(`gravado: ${ops.length} documentos`);
process.exit(0);
