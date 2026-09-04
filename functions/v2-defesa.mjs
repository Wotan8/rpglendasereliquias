/**
 * Fase C4 do Núcleo v2 — defesa e combate.
 * Livro de 12 Páginas, p. 5: três defesas (= nível da perícia), cada uma com um trunfo.
 *
 *   node functions/v2-defesa.mjs            dry-run: lista tudo, não grava nada
 *   node functions/v2-defesa.mjs --apply    grava (antes salva o estado atual em BACKUP_DIR)
 *
 * O que faz:
 *  1. Defesa: Esquiva / Aparar / Bloquear = Perícia (a fórmula deixa de somar o VD raiz
 *     "Defesa" e o +1); os limites por DES/RAC saem; o teto do Bloquear vira
 *     Perícia: Bloquear + VIG (a Qualidade do escudo soma até VIG)
 *  2. Defesa: Desviar / Evadir / Proteger / Cobertura / Absorver despublicados com as
 *     10 mecânicas deles; o VD raiz "Defesa" também sai (só as fórmulas o citavam)
 *  3. Escudo: a Qualidade passa a somar em "Defesa: Bloquear" (não mais na perícia, para
 *     o teto não ficar circular) e o escudo deixa de dar Blindagem (p. 6: escudo = +Q no Bloquear)
 *  4. Armadura com penalidade de DES espelha a mesma penalidade em "Defesa: Esquiva"
 *     (p. 6: a Esquiva é a perícia, e a armadura pesada desconta dela)
 *  5. Dom Ambidestria (peculiaridade avulsa, 3 níveis): −3 no Alvo com duas armas, −1 a
 *     menos por nível; Golpe Cruzado e Corte de Passagem passam a exigir o Dom em texto
 *     (a mecânica "Ambidestria 5 REQ" apontava para uma perícia que não existe mais)
 *  6. Módulo "Ações de combate" (Desarmar, Derrubar, Agarrar, Recuperar Fôlego) em todas
 *     as classes — o que qualquer um faz, custando só a Ação
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

const [vds, mecs, eq, skills, pecs, mods, classes, conds] = await Promise.all([
    col('system/data/derivedValues'), col('system/data/mechanics'), col('system/data/equipment'), col('system/data/skills'),
    col('system/data/peculiarities'), col('system/data/classModules'), col('system/data/classes'), col('system/data/conditions'),
]);
const vd = (n) => vds.find(v => v.nome === n);
const skill = (n) => skills.find(s => s.publicado !== false && s.nome === n);
for (const n of ['Defesa: Esquiva', 'Defesa: Aparar', 'Defesa: Bloquear', 'Defesa', 'Blindagem']) if (!vd(n)) { console.error('VD não encontrado:', n); process.exit(1); }
for (const n of ['Esquiva', 'Aparar', 'Bloquear']) if (!skill(n)) { console.error('perícia não encontrada:', n); process.exit(1); }

// ---------- 1. as três fórmulas e o teto do Bloquear ----------
const FICAM = { 'Defesa: Esquiva': 'Perícia: Esquiva', 'Defesa: Aparar': 'Perícia: Aparar', 'Defesa: Bloquear': 'Perícia: Bloquear' };
for (const m of mecs) {
    if (m.publicado === false) continue;
    const calc = m.config?.calculos?.[0];
    if (!calc || !(calc.alvo in FICAM)) continue;
    if (m.tipo === 'modificar') {
        const novo = [{ ...calc, equacao: [{ tipo: 'ficha', ref: FICAM[calc.alvo] }] }];
        op(`system/data/mechanics/${m.id}`, { 'config.calculos': novo, previewTexto: `${calc.alvo} = [${FICAM[calc.alvo].replace('Perícia: ', '')}]`, versao: proximaVersao(m.versao), updatedAt: Date.now() },
            { calculos: m.config.calculos, previewTexto: m.previewTexto ?? null }, `mecânica ${m.nome}: ${calc.alvo} = ${FICAM[calc.alvo]}`);
    } else if (m.tipo === 'limitar') {
        if (calc.alvo === 'Defesa: Bloquear') {
            const novo = [{ ...calc, tipoLimite: 'clamp', valorMinimo: 0, equacao: [{ tipo: 'ficha', ref: 'Perícia: Bloquear' }, { tipo: 'ficha', op: '+', ref: 'VIG' }] }];
            op(`system/data/mechanics/${m.id}`, { 'config.calculos': novo, previewTexto: 'Defesa: Bloquear: entre 0 e [Bloquear] + [VIG] — a Qualidade do escudo soma até VIG', versao: proximaVersao(m.versao), updatedAt: Date.now() },
                { calculos: m.config.calculos, previewTexto: m.previewTexto ?? null }, `mecânica ${m.nome}: teto = Perícia: Bloquear + VIG`);
        } else {
            op(`system/data/mechanics/${m.id}`, { publicado: false, aposentadoEm: agora, aposentadoPor: 'v2-C4: Defesa = perícia, sem teto por atributo', updatedAt: Date.now() },
                { publicado: m.publicado ?? null }, `mecânica ${m.nome}: despublicada (limite por DES/RAC saiu)`);
        }
    }
}

// ---------- 2. as defesas que saem ----------
const SAEM = ['Defesa: Desviar', 'Defesa: Evadir', 'Defesa: Proteger', 'Defesa: Cobertura', 'Defesa: Absorver', 'Defesa'];
for (const n of SAEM) {
    const v = vd(n); if (!v || v.publicado === false) continue;
    op(`system/data/derivedValues/${v.id}`, { publicado: false, aposentadoEm: agora, aposentadoPor: 'v2-C4: três defesas — Esquiva, Aparar, Bloquear', versao: proximaVersao(v.versao), updatedAt: Date.now() },
        { publicado: v.publicado ?? null }, `VD ${n}: despublicado`);
    for (const m of mecs.filter(m => m.publicado !== false && (m.config?.calculos || []).some(c => c.alvo === n)))
        op(`system/data/mechanics/${m.id}`, { publicado: false, aposentadoEm: agora, aposentadoPor: 'v2-C4', updatedAt: Date.now() }, { publicado: m.publicado ?? null }, `mecânica ${m.nome}: despublicada`);
}
// quem mais cita o VD raiz "Defesa" fora das 8 fórmulas? (só aviso)
const outrosDefesa = mecs.filter(m => m.publicado !== false && !/^Defesa: .* \(fórmula\)$/.test(m.nome) && (m.config?.calculos || []).some(c => c.alvo === 'Defesa' || (c.equacao || []).some(t => t.ref === 'Defesa')));
if (outrosDefesa.length) console.log('⚠️ ainda citam o VD raiz "Defesa":', outrosDefesa.map(m => m.nome).join(', '));

// ---------- 3 + 4. escudos e armaduras ----------
const BLOQ = vd('Defesa: Bloquear'), ESQ = vd('Defesa: Esquiva'), BLIND = vd('Blindagem'), SK_BLOQ = skill('Bloquear');
let escudos = 0, espelhos = 0;
for (const e of eq) {
    const data = {}; const antes = {}; const log = [];
    if (e.categoriaArma === 'escudo') {
        const per = (e.periciasVinculadas || []).filter(p => p.id !== SK_BLOQ.id);
        const vinc = (e.valoresDerivadosVinculados || []).filter(v => v.id !== BLIND.id && v.id !== BLOQ.id);
        vinc.push({ id: BLOQ.id, modificador: 0, equacao: [{ tipo: 'ficha', ref: 'Item: Qualidade' }] });
        data.periciasVinculadas = per; data.valoresDerivadosVinculados = vinc;
        antes.periciasVinculadas = e.periciasVinculadas ?? null; antes.valoresDerivadosVinculados = e.valoresDerivadosVinculados ?? null;
        escudos++; log.push('Qualidade → Defesa: Bloquear; sem Blindagem');
    }
    const des = (e.atributosVinculados || []).find(a => a.id === 'attr_des' && Number(a.modificador) < 0);
    if (des && !(e.valoresDerivadosVinculados || []).some(v => v.id === ESQ.id)) {
        const vinc = data.valoresDerivadosVinculados || (e.valoresDerivadosVinculados || []).map(v => ({ ...v }));
        vinc.push({ id: ESQ.id, modificador: 0, equacao: [{ tipo: 'fixo', valor: Number(des.modificador) }] });
        data.valoresDerivadosVinculados = vinc;
        if (!('valoresDerivadosVinculados' in antes)) antes.valoresDerivadosVinculados = e.valoresDerivadosVinculados ?? null;
        espelhos++; log.push(`Defesa: Esquiva ${des.modificador} (espelho da DES)`);
    }
    if (!Object.keys(data).length) continue;
    data.versao = proximaVersao(e.versao); data.updatedAt = Date.now();
    op(`system/data/equipment/${e.id}`, data, antes, `equipment ${e.nome}: ${log.join('; ')}`);
}

// ---------- 5. Dom Ambidestria ----------
const AMBI_PEC = 'pec_dom_ambidestria', AMBI_MEC = 'mec_dom_ambidestria';
const custo10 = mecs.find(m => /custo avulsa -10 exp/i.test(m.nome || ''));
if (!pecs.some(p => p.id === AMBI_PEC)) {
    if (!custo10) op(`system/data/mechanics/mec_custo_avulsa_10`, {
        nome: 'Custo Avulsa -10 EXP', tipo: 'modificar', fonte: 'individual', duracao: 'permanente', escopo: 'proprio', empilhamento: 'soma',
        tags: ['Criação', 'Dom'], publicado: true, versao: '1.00', criadoEm: Date.now(), updatedAt: Date.now(),
        previewTexto: '−10 EXP na criação (o preço de um Dom, Livro p. 12)',
        config: { calculos: [{ alvo: 'EXP', qualExp: 'ambos', operacao: '-', quandoAplica: 'na_criacao', equacao: [{ tipo: 'fixo', valor: 10 }] }] },
    }, null, 'mecânica Custo Avulsa -10 EXP: criada (o preço do Dom)', true);
    op(`system/data/mechanics/${AMBI_MEC}`, {
        nome: 'Dom: Ambidestria — nível', tipo: 'modificar', fonte: 'individual', duracao: 'permanente', escopo: 'proprio', empilhamento: 'soma',
        condicaoAplicacao: '', tags: ['Dom'], publicado: true, versao: '1.00', criadoEm: Date.now(), updatedAt: Date.now(),
        previewTexto: 'Nível do Dom Ambidestria: com duas armas, o −3 no Alvo perde 1 por nível',
        config: { calculos: [] }, evoluivel: true, nivelMaximo: 3,
        progressao: { 1: { custoExp: 0, termos: {} }, 2: { custoExp: 8, termos: {} }, 3: { custoExp: 12, termos: {} } },
        progressaoTipoExp: 'custo', progressaoApenasCriacao: false,
    }, null, 'mecânica Dom: Ambidestria — nível: criada (níveis 2 e 3 a 4N)', true);
    op(`system/data/peculiarities/${AMBI_PEC}`, {
        nome: 'Ambidestria', icone: '🤹', fonte: 'individual', fonteRef: '', quandoSeAplica: 'na_criacao', ehVantagem: true,
        concedeAura: false, auraVinculadaId: '', auraGrauConcedido: null,
        mecanicaExpCriacao: [custo10?.id || 'mec_custo_avulsa_10'], mecanicaIds: [AMBI_MEC], derivedValueIds: [],
        tags: ['Criação', 'Avulsa', 'Dom'], publicado: true, versao: '1.00', criadoEm: Date.now(), updatedAt: Date.now(),
        descricao: 'Dom de três níveis (Livro, p. 5). Lutar com duas armas dá −3 no Alvo dos dois golpes; cada nível deste Dom tira 1 dessa penalidade. O segundo golpe usa o seu Movimento. Nível 1 custa 10 EXP (o preço de um Dom); os níveis 2 e 3 custam 4 × o nível novo.',
    }, null, 'peculiaridade Ambidestria (Dom, 3 níveis): criada', true);
}
const REQ = 'DDqEQQMitcZygUEdfKuV';
const reqMec = mecs.find(m => m.id === REQ);
if (reqMec && reqMec.publicado !== false)
    op(`system/data/mechanics/${REQ}`, { publicado: false, aposentadoEm: agora, aposentadoPor: 'v2-C4: Ambidestria virou Dom; a exigência é texto no predef', updatedAt: Date.now() }, { publicado: reqMec.publicado ?? null }, 'mecânica Ambidestria 5 REQ: despublicada');
for (const m of mods) {
    if (!(m.itensPredefinidos || []).some(p => (p.custoCriacaoMecanicaIds || []).includes(REQ))) continue;
    const novos = m.itensPredefinidos.map(p => {
        if (!(p.custoCriacaoMecanicaIds || []).includes(REQ)) return p;
        const desc = String(p.descricao || '');
        const marca = 'Requer o Dom Ambidestria.';
        const q = { ...p, custoCriacaoMecanicaIds: p.custoCriacaoMecanicaIds.filter(id => id !== REQ), descricao: desc.includes(marca) ? desc : `${desc}${desc.endsWith('.') || !desc ? '' : '.'} ${marca}`.trim() };
        if (q.valores?.['5'] !== undefined) q.valores = { ...q.valores, 5: q.descricao };
        return q;
    });
    op(`system/data/classModules/${m.id}`, { itensPredefinidos: novos, versao: proximaVersao(m.versao), updatedAt: Date.now() }, { itensPredefinidos: m.itensPredefinidos },
        `módulo ${m.titulo}: ${m.itensPredefinidos.filter(p => (p.custoCriacaoMecanicaIds || []).includes(REQ)).map(p => p.nome).join(', ')} exigem o Dom em texto`);
}

// ---------- 6. Ações de combate ----------
const ACOES_ID = 'acoes_combate';
const cond = (n) => conds.find(c => c.publicado !== false && c.nome === n);
const PROSTRADO = cond('Prostrado'), AGARRADO = cond('Agarrado') || cond('Preso');
if (!mods.some(m => m.id === ACOES_ID)) {
    const base = mods.find(m => m.id === 'manobras_guerreiro');
    const predef = (id, nome, acao, efeito, extra = {}) => ({
        id, nome, descricao: efeito, custoExpProprio: 0, custoCriacaoMecanicaIds: [], custoEquipamentos: null,
        valores: { 1: nome, 2: '', 3: '—', 4: '', 5: efeito, acao },
        alcance: 0, formaArea: 'alvo', tamanhoArea: null, alvosMax: 1, duracaoValor: 0, duracaoUnidade: 'instantanea',
        condicoesAplicadas: [], anguloCone: null, bloqueavel: true, economia: 'combate', ...extra,
    });
    const itens = [
        predef('pdi_acao_desarmar', 'Desarmar', 'Ação Padrão', 'Ataque normal com a sua arma. Passando a Defesa, a arma do alvo cai a 1d4 m em vez de causar dano.'),
        predef('pdi_acao_derrubar', 'Derrubar', 'Ação Padrão', 'Ataque normal. Passando a Defesa e com Graus ≥ VIG do alvo, ele fica Prostrado.',
            { condicoesAplicadas: PROSTRADO ? [{ condicao: PROSTRADO.nome, portao: 'corpo', chance: null, alvos: 1, rodadas: 0, nivel: 1 }] : [] }),
        predef('pdi_acao_agarrar', 'Agarrar', 'Ação Padrão', `Ataque com Briga. Passando a Defesa e com Graus ≥ VIG do alvo, ele fica ${AGARRADO?.nome || 'Preso'}.`,
            { condicoesAplicadas: AGARRADO ? [{ condicao: AGARRADO.nome, portao: 'corpo', chance: null, alvos: 1, rodadas: 0, nivel: 1 }] : [] }),
        predef('pdi_acao_folego', 'Recuperar Fôlego', 'Ação Completa (turno inteiro)', 'O turno inteiro parado: +1 Energia.', { formaArea: 'proprio', bloqueavel: false }),
    ];
    op(`system/data/classModules/${ACOES_ID}`, {
        titulo: 'Ações de combate', icone: '⚔️', tipo: 'lista', publicado: true, versao: '1.00', criadoEm: Date.now(), updatedAt: Date.now(),
        custoExpPorItem: 0, custoExpLabel: '', escolaId: null, periciaId: null,
        cadastrarBloqueio: false, bloqueioMecanicaIds: [], limiteFixo: null, limiteMecanicaIds: [], mecanicaLimiteId: null,
        custoCriacaoMecanicaIds: [], custoCriacaoMecanicaId: null, custoEdicaoAtivo: false, custoEdicaoMecanicaIds: [], custoEdicaoMecanicaId: null,
        custoRemocaoAtivo: false, custoRemocaoMecanicaIds: [], custoRemocaoMecanicaId: null, custoEquipamentos: [],
        permitirCriacaoJogador: false,
        schema: base?.schema || [],
        itensPredefinidos: itens,
        descricao: 'O que qualquer um faz em combate (Livro, p. 5). Custam a Ação; nenhuma custa Energia.',
    }, null, 'módulo Ações de combate: criado com 4 ações', true);
}
for (const c of classes) {
    const lista = c.modulosDaClasse || [];
    if (lista.includes(ACOES_ID)) continue;
    op(`system/data/classes/${c.id}`, { modulosDaClasse: [...lista, ACOES_ID], versao: proximaVersao(c.versao), updatedAt: Date.now() }, { modulosDaClasse: lista }, `classe ${c.nome}: + Ações de combate`);
}

// ---------- relatório ----------
console.log(`ops: ${ops.length} | escudos: ${escudos} | espelhos de DES: ${espelhos}`);
for (const o of ops) console.log(' ', o.log);
if (!APPLY) { console.log('\n(dry-run: nada gravado; use --apply)'); process.exit(0); }

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const bk = path.join(BACKUP_DIR, `_backup-defesa-${agora.replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(bk, JSON.stringify(ops.map(o => ({ doc: o.ref.path, antes: o.antes })), null, 1));
console.log('backup:', bk);
for (let i = 0; i < ops.length; i += 400) {
    const b = db.batch();
    ops.slice(i, i + 400).forEach(o => o.set ? b.set(o.ref, o.data) : b.update(o.ref, o.data));
    await b.commit();
}
console.log(`gravado: ${ops.length} documentos`);
process.exit(0);
