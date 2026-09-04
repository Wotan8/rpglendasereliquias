/**
 * Núcleo v2 — limpeza final do banco (PENDENTE-NUCLEO-V2.md, seção 3).
 *
 *   node functions/v2-limpeza.mjs                       etapa 1, dry-run: adapta refs, textos, fichas, NPCs, itens; apaga coleções mortas
 *   node functions/v2-limpeza.mjs --apply               grava (backup em BACKUP_DIR)
 *   node functions/v2-limpeza.mjs --despublicados       etapa 2, dry-run: apaga os docs despublicados que ninguém cita
 *   node functions/v2-limpeza.mjs --despublicados --apply
 *
 * Regra de EXP (decisão do usuário, 04/09): o que custou EXP e sai devolve; o que rendeu EXP e sai desconta.
 * Cadastro editado sobe a versão (escada de 0.01). Ficha, NPC e item não têm versão.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const FV = admin.firestore.FieldValue;
const FP = admin.firestore.FieldPath;
const APPLY = process.argv.includes('--apply');
const ETAPA2 = process.argv.includes('--despublicados');
const BACKUP_DIR = 'D:/Imagem/US - Universo Soberano/RPG/Reliera/Backup Firestore 2026-09-03/scripts-backups';
const agora = new Date().toISOString();
const col = async (p) => (await db.collection(p).get()).docs.map(d => ({ ...d.data(), id: d.id }));
const proximaVersao = (v) => { const n = parseFloat(String(v ?? '').replace(/[^\d.]/g, '')); return isNaN(n) ? '1.00' : (n + 0.01).toFixed(2); };
const ops = [];   // { ref, pares:[[FieldPath, valor]...], antes, log } | { ref, apagar:true, antes, log }
const fp = (p) => (p instanceof FP ? p : new FP(...String(p).split('.')));
function upd(ref, campos, antes, log, versaoAtual) {
    const pares = Object.entries(campos).map(([k, v]) => [fp(k), v]);
    if (versaoAtual !== undefined) { pares.push([fp('versao'), proximaVersao(versaoAtual)]); pares.push([fp('updatedAt'), Date.now()]); }
    ops.push({ ref, pares, antes, log });
}
function del(ref, antes, log) { ops.push({ ref, apagar: true, antes, log }); }
const walkStrings = (o, f) => {
    if (typeof o === 'string') return f(o);
    if (Array.isArray(o)) return o.map(x => walkStrings(x, f));
    if (o && typeof o === 'object' && !(o instanceof admin.firestore.Timestamp)) { const r = {}; for (const [k, v] of Object.entries(o)) r[k] = walkStrings(v, f); return r; }
    return o;
};
/** Troca textos em todos os campos de string do doc; devolve só os campos de topo que mudaram. */
function trocarTextos(doc, pares) {
    const out = {};
    for (const [k, v] of Object.entries(doc)) {
        if (k === 'id') continue;
        const novo = walkStrings(v, s => pares.reduce((t, [a, b]) => t.split(a).join(b), s));
        if (JSON.stringify(novo) !== JSON.stringify(v)) out[k] = novo;
    }
    return out;
}

// ---------------------------------------------------------------- carga
const sys = {};
for (const c of await db.doc('system/data').listCollections()) sys[c.id] = await col(`system/data/${c.id}`);
const vivo = (cid) => (sys[cid] || []).filter(d => d.publicado !== false);
const vivosIds = new Set(Object.values(sys).flat().filter(d => d.publicado !== false).map(d => d.id));
const nomeDe = (id) => { for (const docs of Object.values(sys)) { const d = docs.find(x => x.id === id); if (d) return `${d.nome || d.titulo || id}${d.publicado === false ? '†' : ''}`; } return `${id}(inexistente)`; };
const condPorNome = Object.fromEntries(vivo('conditions').map(c => [c.nome, c]));
const skillPorNome = Object.fromEntries(vivo('skills').map(s => [s.nome, s]));
const modsVivos = new Set(vivo('classModules').map(m => m.id));
const pecsVivas = new Set(vivo('peculiarities').map(p => p.id));

if (!ETAPA2) {
    // ------------------------------------------------------------ 1. elementos rúnicos: condicaoId pelo NOME vivo
    for (const el of sys.runicElements) {
        const campos = {}; const removidas = []; const remapeadas = [];
        for (const campo of ['condicoesFisicas', 'condicoesEssencia', 'condicaoCritica']) {
            const lista = el[campo]; if (!Array.isArray(lista)) continue;
            const vistos = new Set(); const nova = [];
            for (const e of lista) {
                const c = condPorNome[e.condicao] || (vivosIds.has(e.condicaoId) ? vivo('conditions').find(x => x.id === e.condicaoId) : null);
                if (!c) { removidas.push(`${campo}:${e.condicao}(${nomeDe(e.condicaoId)})`); continue; }
                if (vistos.has(c.id)) continue; vistos.add(c.id);
                if (c.id !== e.condicaoId) remapeadas.push(`${e.condicao}→${c.id}`);
                nova.push({ ...e, condicao: c.nome, condicaoId: c.id });
            }
            if (JSON.stringify(nova) !== JSON.stringify(lista)) campos[campo] = nova;
        }
        if (Object.keys(campos).length) upd(db.doc(`system/data/runicElements/${el.id}`), campos, Object.fromEntries(Object.keys(campos).map(k => [k, el[k]])), `runa ${el.nome}: remapeadas ${remapeadas.length}, removidas ${removidas.length}${removidas.length ? ' [' + removidas.join(', ') + ']' : ''}${(campos.condicoesEssencia || el.condicoesEssencia || []).length === 0 ? ' ⚠️ ESSÊNCIA SEM CONDIÇÃO' : ''}`, el.versao);
    }
    // ------------------------------------------------------------ 2. formas de conjuração
    for (const f of sys.castingForms) {
        const campos = {}; const logs = [];
        if (Array.isArray(f.condicoesBloqueiam)) { const nova = f.condicoesBloqueiam.filter(id => vivosIds.has(id)); if (nova.length !== f.condicoesBloqueiam.length) { campos.condicoesBloqueiam = nova; logs.push(`condicoesBloqueiam −${f.condicoesBloqueiam.filter(id => !vivosIds.has(id)).map(nomeDe).join(',')}`); } }
        if (f.nome === 'Símbolo Sagrado') Object.assign(campos, trocarTextos(f, [['A Graça de Palla passa pelo Símbolo.', 'A Energia da prece passa pelo Símbolo.']])), logs.push('texto Graça→Energia');
        if (Object.keys(campos).length) upd(db.doc(`system/data/castingForms/${f.id}`), campos, Object.fromEntries(Object.keys(campos).map(k => [k, f[k]])), `forma ${f.nome}: ${logs.join('; ')}`, f.versao);
    }
    // ------------------------------------------------------------ 3. classes: ids mortos e textos
    for (const c of sys.classes) {
        const campos = {}; const logs = [];
        const idDe = (e) => (typeof e === 'string' ? e : e?.id);   // as classes guardam { id, ... }
        for (const campo of ['peculiaridadeIds', 'derivedValueIds', 'mecanicaIds']) {
            if (!Array.isArray(c[campo])) continue;
            const mortos = c[campo].filter(e => !vivosIds.has(idDe(e)));
            if (mortos.length) { campos[campo] = c[campo].filter(e => vivosIds.has(idDe(e))); logs.push(`${campo} −${mortos.map(e => nomeDe(idDe(e))).join(',')}`); }
        }
        if (c.nome === 'Bardo') { const t = trocarTextos(c, [[' A Dissonância não fere apenas o Bardo — destrói sua reputação perante todos que ouvem.', '']]); if (Object.keys(t).length) { Object.assign(campos, t); logs.push('texto Dissonância'); } else logs.push('⚠️ frase da Dissonância não achada'); }
        if (c.nome === 'Pallacerdote') { const t = trocarTextos(c, [['recarrega Graça com Prece Breve', 'recupera Energia com Prece Breve']]); if (Object.keys(t).length) { Object.assign(campos, t); logs.push('texto Graça'); } else logs.push('⚠️ frase da Graça não achada'); }
        if (Object.keys(campos).length) upd(db.doc(`system/data/classes/${c.id}`), campos, Object.fromEntries(Object.keys(campos).map(k => [k, c[k]])), `classe ${c.nome}: ${logs.join('; ')}`, c.versao);
    }
    // ------------------------------------------------------------ 4. valores derivados
    for (const v of vivo('derivedValues')) {
        const campos = {}; const logs = [];
        if (Array.isArray(v.mecanicaIds)) { const mortos = v.mecanicaIds.filter(id => !vivosIds.has(id)); if (mortos.length) { campos.mecanicaIds = v.mecanicaIds.filter(id => vivosIds.has(id)); logs.push(`mecanicaIds −${mortos.map(nomeDe).join(',')}`); } }
        if (v.blocoNome === 'Manobras') { campos.blocoNome = 'Manobras de Guerreiro'; logs.push('blocoNome → Manobras de Guerreiro'); }
        if (Object.keys(campos).length) upd(db.doc(`system/data/derivedValues/${v.id}`), campos, Object.fromEntries(Object.keys(campos).map(k => [k, v[k]])), `VD ${v.nome}: ${logs.join('; ')}`, v.versao);
    }
    // ------------------------------------------------------------ 5. mecânicas: perícias por nome e textos
    const TROCAS_MEC = {
        'Ataque Mudo REQ': [['Perícia: Malandragem', 'Perícia: Lábia'], ['Perícia: Agilidade', 'Perícia: Acrobacia'], ['Perícia: Reflexo', 'Perícia: Furtividade'], ['Malandragem', 'Lábia'], ['Agilidade', 'Acrobacia'], ['Reflexo', 'Furtividade']],
        'Perícias Iniciais do Ladino': [['Perícia: Agilidade', 'Perícia: Acrobacia'], ['Agilidade', 'Acrobacia']],
        'Engodo REQ': [['Perícia: Malandragem', 'Perícia: Lábia'], ['Malandragem', 'Lábia']],
        'Condição: Agarrado': [['Agarrado', 'Preso']],
        '-1 Carga': [['Bolha de Sangue', 'Carga de Sangue']], '-2 Cargas': [['Bolha de Sangue', 'Carga de Sangue']], '-3 Cargas': [['Bolha de Sangue', 'Carga de Sangue']], '-4 Cargas': [['Bolha de Sangue', 'Carga de Sangue']],
        'Carga de Sangue': [['Bolha de Sangue', 'Carga de Sangue']],
    };
    for (const m of vivo('mechanics')) {
        const pares = TROCAS_MEC[m.nome]; if (!pares) continue;
        const campos = trocarTextos(m, pares);
        if (Object.keys(campos).length) upd(db.doc(`system/data/mechanics/${m.id}`), campos, Object.fromEntries(Object.keys(campos).map(k => [k, m[k]])), `mecânica ${m.nome}: ${Object.keys(campos).join(',')}`, m.versao);
        else console.log(`⚠️ mecânica ${m.nome}: nenhum texto trocado`);
    }
    // ------------------------------------------------------------ 6. módulos de classe: Pallomancia (coluna Graça) e Espiritismo (Dívida Espiritual)
    {
        const mp = sys.classModules.find(m => m.id === 'mod_pallomancia');
        const campos = {}; const logs = [];
        const iGraca = (mp.schema || []).findIndex(s => s.label === 'Pagar Graça');
        if (iGraca >= 0) {
            const chave = String(mp.schema[iGraca].key ?? mp.schema[iGraca].id ?? '');
            campos.schema = mp.schema.filter((_, i) => i !== iGraca);
            campos.itensPredefinidos = (mp.itensPredefinidos || []).map(p => { const q = { ...p }; delete q[chave]; if (q.valores && typeof q.valores === 'object') { q.valores = { ...q.valores }; delete q.valores[chave]; } return q; });
            logs.push(`coluna "Pagar Graça" (chave ${chave}) removida`);
        }
        const t = trocarTextos({ ...mp, ...campos }, [['Recupera Graça igual', 'Recupera Energia igual']]);
        if (t.itensPredefinidos) { campos.itensPredefinidos = t.itensPredefinidos; logs.push('texto Recupera Graça→Energia'); }
        if (Object.keys(campos).length) upd(db.doc('system/data/classModules/mod_pallomancia'), campos, { schema: mp.schema, itensPredefinidos: mp.itensPredefinidos }, `módulo Pallomancia: ${logs.join('; ')}`, mp.versao);
        const mt = sys.classModules.find(m => m.id === 'mod_totem');
        const t2 = trocarTextos(mt, [['Falha crítica: -1 SAN permanente e Dívida Espiritual.', 'Falha crítica: -1 SAN permanente.']]);
        if (Object.keys(t2).length) upd(db.doc('system/data/classModules/mod_totem'), t2, Object.fromEntries(Object.keys(t2).map(k => [k, mt[k]])), 'módulo Rituais do Espiritismo: Dívida Espiritual removida', mt.versao);
        else console.log('⚠️ mod_totem: frase da Dívida Espiritual não achada');
    }
    // ------------------------------------------------------------ 7. condição Drenado, item Incenso
    {
        const dr = vivo('conditions').find(c => c.nome === 'Drenado');
        const t = trocarTextos(dr, [['(Energia, Graça, Harmonia)', '(Energia, Harmonia, Carga de Sangue)']]);
        if (Object.keys(t).length) upd(db.doc(`system/data/conditions/${dr.id}`), t, Object.fromEntries(Object.keys(t).map(k => [k, dr[k]])), 'condição Drenado: texto Graça', dr.versao); else console.log('⚠️ Drenado: frase não achada');
        const inc = vivo('equipment').find(e => e.nome === 'Incenso Consagrado');
        const t2 = trocarTextos(inc, [['para ajudar a focar a Graça.', 'para ajudar a focar a prece.']]);
        if (Object.keys(t2).length) upd(db.doc(`system/data/equipment/${inc.id}`), t2, Object.fromEntries(Object.keys(t2).map(k => [k, inc[k]])), 'item Incenso Consagrado: texto Graça', inc.versao); else console.log('⚠️ Incenso: frase não achada');
    }
    // ------------------------------------------------------------ 8. catálogo: porta (periciaId) que faltava
    const PORTA = { 'Escudo de Torre': 'Bloquear', 'Escudo Grande': 'Bloquear', 'Escudo Médio': 'Bloquear', 'Broquel': 'Bloquear', 'O Sussurro Final': 'Precisão', 'Rede': 'Arremesso' };
    for (const e of vivo('equipment')) {
        const per = PORTA[e.nome]; if (!per || e.periciaId) continue;
        const s = skillPorNome[per]; if (!s) { console.log(`⚠️ perícia ${per} não achada`); continue; }
        upd(db.doc(`system/data/equipment/${e.id}`), { periciaId: s.id }, { periciaId: e.periciaId ?? null }, `item ${e.nome}: periciaId → ${per}`, e.versao);
    }
    // ------------------------------------------------------------ 9. NPCs: espelho de VDs que saíram
    const npcs = await col('npcs');
    const KEEP_VD = new Set(['overrides', 'atual', 'extras', 'vinculados', 'VIT', 'ENER', 'SAN', 'PERC', 'INI', 'BLD', 'DESLOCAMENTO']);
    for (const n of npcs) {
        const vd = n.valoresDer; if (!vd || typeof vd !== 'object') continue;
        const campos = {}; const antes = {};
        for (const k of Object.keys(vd)) if (!KEEP_VD.has(k)) { campos[`valoresDer.${k}`] = FV.delete(); antes[k] = vd[k]; }
        for (const k of ['REA', 'DET']) if (vd.atual && k in vd.atual) { campos[`valoresDer.atual.${k}`] = FV.delete(); antes[`atual.${k}`] = vd.atual[k]; }
        if (Object.keys(campos).length) upd(db.doc(`npcs/${n.id}`), campos, { valoresDer: antes }, `NPC ${n.nome}: −${Object.keys(antes).join(',')}`);
    }
    // ------------------------------------------------------------ 10. fichas
    const chars = await col('char');
    const SLUGS = ['golpe_titanico', 'guardiao_imponente', 'blindagem_natural', 'olfato_excepcional', 'garras_escavadoras', 'presenca_imponente', 'dominio_espiritismo'];
    const REFUND_PEC = { '0SLKACGxIfOdGxSVRpYx': 1 };   // Magro: mecânica "Custo" −1 EXP na criação (registro no backup). Gordo e os outros: valor desconhecido → 0
    const manobras = sys.classModules.find(m => m.id === 'Manobras');
    const custoItemMorto = (modId, it) => {
        if (modId === 'mod_verde_xama') return Number(it?.['2']) || 0;                       // o nível era o preço
        if (modId === 'Manobras') { const p = (manobras?.itensPredefinidos || []).find(p => p.id === it?._predefId); return Number(p?.custoExpProprio ?? p?.custoExp ?? manobras?.custoExpPorItem) || 0; }
        return 0;
    };
    const custoAcumulado = (n, por) => { let t = 0; for (let i = 1; i <= n; i++) t += i * por; return t; };
    const FIELDS_MORTOS = /^(wpn_|proj_|arm_|inv_name_|inv_qtd_|inv_desc_|cond_name_|cond_tipo_|cond_desc_|cond_tempo_|spec_name_|money_)/;
    const FIELDS_EXATOS = ['det_atual', 'dv_BOLHA_DE_SANGUE_atual', 'dv_GRACA_DE_PALLA_atual', 'blindagem', 'tamanho'];
    for (const c of chars) {
        const campos = {}; const antes = {}; const removido = []; let exp = 0;
        const dots = c.dots || {}; const f = c.fields || {};
        // módulos mortos
        for (const [mid, itens] of Object.entries(c.classModuleData || {})) {
            if (modsVivos.has(mid)) continue;
            campos[`classModuleData.${mid}`] = FV.delete(); antes[`classModuleData.${mid}`] = itens;
            const dev = (Array.isArray(itens) ? itens : []).reduce((s, it) => s + custoItemMorto(mid, it), 0);
            exp += dev; removido.push(`módulo ${mid} (${(itens || []).length} item, +${dev} EXP)`);
        }
        // pecs por slug, pecs apagadas do cadastro
        for (const k of Object.keys(dots)) {
            if (!k.startsWith('pec_')) continue;
            const id = k.slice(4);
            if (SLUGS.includes(id)) { campos[`dots.${k}`] = FV.delete(); antes[`dots.${k}`] = dots[k]; removido.push(`dot ${k} (formato antigo)`); continue; }
            if (!pecsVivas.has(id)) { campos[`dots.${k}`] = FV.delete(); antes[`dots.${k}`] = dots[k]; const dev = REFUND_PEC[id] || 0; exp += dev; removido.push(`dot ${k} (${nomeDe(id)}, +${dev} EXP)`); }
        }
        for (const k of Object.keys(c.peculiaridadeLevels || {})) if (SLUGS.includes(k) || k.startsWith('pec_dominio') || !pecsVivas.has(k)) { campos[`peculiaridadeLevels.${k}`] = FV.delete(); antes[`peculiaridadeLevels.${k}`] = c.peculiaridadeLevels[k]; removido.push(`peculiaridadeLevels.${k}`); }
        if (Array.isArray(c.peculiaridadesIndividuais)) {
            const nova = c.peculiaridadesIndividuais.filter(p => p && p.id && pecsVivas.has(p.id));
            if (nova.length !== c.peculiaridadesIndividuais.length) { campos.peculiaridadesIndividuais = nova; antes.peculiaridadesIndividuais = c.peculiaridadesIndividuais; removido.push(`Dons apagados do cadastro: ${c.peculiaridadesIndividuais.filter(p => !(p && p.id && pecsVivas.has(p.id))).map(p => p?.nome || p?.id || '?').join(',')}`); }
        }
        // especializações
        for (const k of Object.keys(dots)) if (k.startsWith('spec_')) { campos[`dots.${k}`] = FV.delete(); antes[`dots.${k}`] = dots[k]; const dev = custoAcumulado(Number(dots[k]) || 0, 4); exp += dev; removido.push(`especialização ${k} nível ${dots[k]} (+${dev} EXP)`); }
        if ('specs' in c) { campos.specs = FV.delete(); antes.specs = c.specs; }
        // campos da ficha antiga
        const mortos = Object.keys(f).filter(k => FIELDS_MORTOS.test(k) || FIELDS_EXATOS.includes(k));
        if (mortos.length) {
            const temCond = mortos.some(k => k.startsWith('cond_name_'));
            if (temCond && !(Array.isArray(c.conditions) && c.conditions.length)) {
                const migradas = [];
                for (let i = 0; i < 50; i++) { const nome = f['cond_name_' + i]; if (!nome || !String(nome).trim()) continue; migradas.push({ nome: String(nome).trim(), descricao: String(f['cond_desc_' + i] || '').trim(), tempoAtual: '', tempoRestante: f['cond_tempo_' + i] || '', modeloId: null, efeitoMecanicaIds: [], icone: '💀' }); }
                if (migradas.length) { campos.conditions = migradas; antes.conditions = c.conditions ?? null; removido.push(`cond_* → conditions (${migradas.length})`); }
            }
            for (const k of mortos) { campos[`fields.${k}`] = FV.delete(); antes[`fields.${k}`] = f[k]; }
            removido.push(`fields antigos: ${mortos.length}`);
        }
        for (const k of ['inventoryItems', 'equipamento']) if (k in c) { campos[k] = FV.delete(); antes[k] = c[k]; removido.push(`${k} (${Array.isArray(c[k]) ? c[k].length : '?'})`); }
        if (!Object.keys(campos).length) continue;
        if (exp) campos['fields.exp'] = FV.increment(exp);
        campos.limpezaV2 = { em: agora, expDevolvido: exp, removido };
        upd(db.doc(`char/${c.id}`), campos, antes, `ficha ${(f.nome || c.id).slice(0, 18)}: ${removido.join(' · ')}${exp ? ` → +${exp} EXP` : ''}`);
    }
    // ------------------------------------------------------------ 11. itens
    const items = await col('items');
    for (const i of items) {
        if (String(i.characterId) === '__caixa_mestre__TThT6XJyBmY83HXRCEaz') { del(db.doc(`items/${i.id}`), i, `item ${i.nome}: caixa de mesa apagada`); continue; }
        const campos = {}; const antes = {};
        for (const k of ['dominioFamilia', 'name', 'description', 'originalEquipId', 'migradoDe']) if (k in i) { campos[k] = FV.delete(); antes[k] = i[k]; }
        if (Object.keys(campos).length) upd(db.doc(`items/${i.id}`), campos, antes, `item ${i.nome}: −${Object.keys(antes).join(',')}`);
    }
    // ------------------------------------------------------------ 12. coleções sem código
    for (const cid of ['viewmaps', 'viewmap-settings', 'economy-items', 'economy-coisas', 'economy-events', 'economy-locations', 'containers']) {
        const docs = await col(cid);
        for (const d of docs) del(db.doc(`${cid}/${d.id}`), d, `${cid}/${d.id}: coleção sem código`);
    }
} else {
    // ------------------------------------------------------------ etapa 2: apagar despublicados que ninguém cita
    const publicados = Object.entries(sys).flatMap(([cid, docs]) => docs.filter(d => d.publicado !== false).map(d => [cid, d]));
    const txtPublicados = publicados.map(([cid, d]) => [cid, d.nome || d.titulo || d.id, JSON.stringify({ ...d, id: undefined })]);
    const config = (await db.collection('config').get()).docs.map(d => [`config/${d.id}`, JSON.stringify(d.data())]);
    for (const cid of ['conditions', 'derivedValues', 'mechanics', 'peculiarities', 'skills', 'classModules', 'equipment']) {
        for (const d of (sys[cid] || []).filter(d => d.publicado === false)) {
            const cit = txtPublicados.filter(([, , t]) => t.includes(d.id)).map(([c2, n]) => `${c2}/${n}`).concat(config.filter(([, t]) => t.includes(d.id)).map(([p]) => p));
            if (cit.length) { console.log(`⚠️ ${cid}/${d.nome || d.id}: citado por ${cit.join(', ')} — NÃO apaga`); continue; }
            del(db.doc(`system/data/${cid}/${d.id}`), d, `${cid}/${d.nome || d.id}: apagado (despublicado, sem citação)`);
        }
    }
}

// ---------------------------------------------------------------- resumo / gravação
console.log(`\nops: ${ops.length} (${ops.filter(o => o.apagar).length} apagar, ${ops.filter(o => !o.apagar).length} atualizar)`);
for (const o of ops) console.log(' ', o.log);
if (!APPLY) { console.log('\n(dry-run: nada gravado; use --apply)'); process.exit(0); }
fs.mkdirSync(BACKUP_DIR, { recursive: true });
const bk = path.join(BACKUP_DIR, `_backup-limpeza${ETAPA2 ? '-despublicados' : ''}-${agora.replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(bk, JSON.stringify(ops.map(o => ({ doc: o.ref.path, apagar: !!o.apagar, antes: o.antes })), null, 1));
console.log('backup:', bk);
for (let i = 0; i < ops.length; i += 400) {
    const b = db.batch();
    for (const o of ops.slice(i, i + 400)) {
        if (o.apagar) b.delete(o.ref);
        else { const flat = []; for (const [p, v] of o.pares) flat.push(p, v); b.update(o.ref, flat[0], flat[1], ...flat.slice(2)); }
    }
    await b.commit();
}
console.log(`gravado: ${ops.length} operações`);
process.exit(0);
