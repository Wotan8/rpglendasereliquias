/**
 * Fase C1 — Perícias e EXP do Núcleo v2.
 *
 * 102 perícias → 32 gerais (8 por grupo) + 8 Perícias de Escola. Faz, na ordem:
 *   1. system/data/skills: renomeia/move/cria/despublica (ids preservados onde há doc);
 *      custoEvolucao 4 em todas; descrição pela tabela de verbos do Livro.
 *   2. Equações: toda ref "Perícia: X" em mechanics, derivedValues, equipment e
 *      classModules é traduzida pelo mapa (História → Erudição, Canto → Sonoromancia…).
 *      Iniciativa e Desloc. Terrestre perdem Agilidade/Observação.
 *   3. classes.pericClasse → [perícia da Escola] (marciais ficam vazias).
 *   4. escolas.periciaIds → [id da perícia da Escola].
 *   5. char.dots: chaves antigas (duas convenções + legados) → chaves novas; fusão
 *      leva o maior nível; a diferença de valor em EXP é devolvida a fields.exp.
 *   6. npcs.periciasEstruturadas[].refId → id novo (fusão = maior nível).
 *
 *   node functions/v2-pericias.mjs            (dry-run: relatório completo)
 *   node functions/v2-pericias.mjs --apply
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

// ---------- alvo ----------
const strip = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const slugGeral = s => strip(s).replace(/[^a-z0-9]/g, '_').replace(/__+/g, '_');           // system-data-loader
const slugClasse = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '_');          // core.js (sem tirar acento)
const PREFIXO = { mental: 'sk_mental_', fisico: 'sk_fisico_', social: 'sk_social_', combate: 'sk_combate_' };
const chaveDe = sk => sk.categoria === 'exclusivo' ? 'sk_classe_' + slugClasse(sk.nome) : PREFIXO[sk.categoria] + slugGeral(sk.nome);

// As 40. `de` = nome(s) atual(is) que viram esta perícia; o primeiro que tiver doc dá o id.
const ALVO = [
    // Mental
    { nome: 'Anatomia', cat: 'mental', attr: 'INT', de: ['Anatomia', 'Medicina'], desc: 'Tratar ferida, estabilizar, diagnosticar, operar, ler um corpo.' },
    { nome: 'Erudição', cat: 'mental', attr: 'INT', de: ['Erudição', 'História', 'Tradição', 'Ofício Intelectual'], desc: 'Saber: história, geografia, engenharia, escrita, leis, costumes e etiqueta. Ler mapa, planejar.' },
    { nome: 'Relíquia', cat: 'mental', attr: 'INT', de: ['Relíquia'], desc: 'Identificar, entender e usar artefato antigo; reconhecer maldição.' },
    { nome: 'Fluxomancia', cat: 'mental', attr: 'INT', de: ['Fluxomancia', 'Essência'], desc: 'Sentir, identificar e entender Essência e magia alheia; ler um Nexo.' },
    { nome: 'Herbalismo', cat: 'mental', attr: 'INT', de: ['Herbalismo'], desc: 'Reconhecer, colher e preparar planta, veneno natural, remédio simples, ingrediente.' },
    { nome: 'Investigação', cat: 'mental', attr: 'RAC', de: ['Investigação'], desc: 'Procurar pista, examinar cena, ligar evidências, achar o que foi escondido.' },
    { nome: 'Percepção', cat: 'mental', attr: 'RAC', de: ['Observação', 'Sexto Sentido', 'Marcar Presa'], desc: 'Notar, ouvir, ver, farejar; perceber emboscada; achar quem se esconde.' },
    { nome: 'Resiliência', cat: 'mental', attr: 'PRS', de: ['Resiliência', 'Resistência à Loucura'], desc: 'Aguentar horror, dor, tortura, tentação; não fugir.' },
    // Física
    { nome: 'Acrobacia', cat: 'fisico', attr: 'DES', de: ['Acrobacia', 'Agilidade'], desc: 'Saltar, equilibrar, rolar, cair bem, escapar de amarras.' },
    { nome: 'Atletismo', cat: 'fisico', attr: 'VIG', de: ['Atletismo'], desc: 'Correr, nadar, escalar, empurrar, aguentar esforço longo.' },
    { nome: 'Furtividade', cat: 'fisico', attr: 'DES', de: ['Furtividade'], desc: 'Esconder-se, mover em silêncio, seguir sem ser visto, esconder objeto.' },
    { nome: 'Prestidigitação', cat: 'fisico', attr: 'DES', de: ['Prestidigitação', 'Arrombamento'], desc: 'Furtar, arrombar fechadura, truque de mãos, trapaça de cartas.' },
    { nome: 'Montaria', cat: 'fisico', attr: 'DES', de: ['Montaria'], desc: 'Cavalgar, controlar montaria, saltar obstáculo montado.' },
    { nome: 'Sobrevivência', cat: 'fisico', attr: 'VIG', de: ['Sobrevivência'], desc: 'Rastrear, achar água e comida, fazer abrigo, orientar-se, prever o clima.' },
    { nome: 'Domar', cat: 'fisico', attr: 'AUT', de: ['Domar'], desc: 'Acalmar, treinar e comandar animal.' },
    { nome: 'Labuta', cat: 'fisico', attr: 'FOR', de: ['Labuta', 'Ofício Braçal'], desc: 'Forjar, serrar, minerar, remar, carregar, arrombar na força.' },
    // Social
    { nome: 'Barganha', cat: 'social', attr: 'MAN', de: ['Barganha'], desc: 'Negociar preço, avaliar mercadoria, fechar acordo.' },
    { nome: 'Diplomacia', cat: 'social', attr: 'MAN', de: ['Diplomacia'], desc: 'Convencer com argumento, mediar, pedir formalmente, portar-se na corte.' },
    { nome: 'Lábia', cat: 'social', attr: 'MAN', de: ['Malandragem', 'Submundo', 'Subterfúgio'], desc: 'Mentir, blefar, disfarçar-se, trapacear, mover-se no submundo.' },
    { nome: 'Sedução', cat: 'social', attr: 'MAN', de: ['Sedução'], desc: 'Encantar, distrair, ganhar afeto.' },
    { nome: 'Intimidação', cat: 'social', attr: 'PRE', de: ['Intimidação'], desc: 'Ameaçar, coagir, interrogar pelo medo.' },
    { nome: 'Liderança', cat: 'social', attr: 'PRE', de: ['Liderança'], desc: 'Comandar, inspirar, manter a tropa firme.' },
    { nome: 'Performance', cat: 'social', attr: 'PRE', de: ['Performance'], desc: 'Entreter: música, dança, teatro, oratória.' },
    { nome: 'Empatia', cat: 'social', attr: 'AUT', de: ['Empatia'], desc: 'Ler intenção, perceber mentira, acalmar alguém.' },
    // Combate
    { nome: 'Arma', cat: 'combate', attr: 'FOR', de: ['Arma', 'Guerrilha', 'Ímpeto', 'Postura de Combate'], desc: 'Espada, machado, haste, impacto, foice.' },
    { nome: 'Precisão', cat: 'combate', attr: 'DES', de: ['Precisão'], desc: 'Adaga, faca, estoque, sabre.' },
    { nome: 'Briga', cat: 'combate', attr: 'FOR', de: ['Briga', 'Controle'], desc: 'Soco, chute, agarrar.' },
    { nome: 'Disparo', cat: 'combate', attr: 'DES', de: ['Disparo', 'Pontaria'], desc: 'Arco, besta, funda.' },
    { nome: 'Arremesso', cat: 'combate', attr: 'DES', de: ['Arremessar'], desc: 'Faca, machadinha, lança, pedra.' },
    { nome: 'Esquiva', cat: 'combate', attr: 'DES', de: ['Esquiva', 'Desviar', 'Evadir'], desc: 'Defesa: sair da trajetória. Vale contra tudo, inclusive área. Se segurar o golpe, você se desloca 2 m (Evadir).' },
    { nome: 'Aparar', cat: 'combate', attr: 'FOR', de: ['Aparar', 'Contra-Ataque'], desc: 'Defesa com arma na mão, só corpo a corpo. Quem tira acima do Alvo (ou 10) contra você leva contra-ataque por 1 Energia.' },
    { nome: 'Bloquear', cat: 'combate', attr: 'VIG', de: ['Bloquear', 'Cobertura', 'Proteger'], desc: 'Defesa com escudo: soma a Qualidade do escudo, dá uma segunda defesa grátis na rodada e protege um aliado adjacente.' },
    // Escola (exclusivas: entram pela classe)
    { nome: 'Hemomancia', cat: 'exclusivo', attr: 'INT', escola: 'escola_hemomancia', de: ['Hemomancia', 'Bolha', 'Manipulação de Sangue', 'Empatia Sanguínea', 'Solidificação Hemática', 'Sutura Hemática', 'Resistência Hemática'], desc: 'A Perícia da Escola: conjura toda a Hemomancia.' },
    { nome: 'Abismancia', cat: 'exclusivo', attr: 'PRS', escola: 'escola_abismancia', de: ['Abismancia', 'Abismo', 'Contato com o Oitavo', 'Selo Abissal', 'Ecos do Vazio', 'Sacrifício'], desc: 'A Perícia da Escola: conjura toda a Abismancia.' },
    { nome: 'Necromancia', cat: 'exclusivo', attr: 'PRS', escola: 'escola_necromancia', de: ['Necromancia', 'Contato com o Sétimo', 'Selo Profano', 'Selo do Profano', 'Servos', 'Talismã Profano', 'Vozes do Túmulo', 'Fragmento de Identidade'], desc: 'A Perícia da Escola: conjura toda a Necromancia.' },
    { nome: 'Pallomancia', cat: 'exclusivo', attr: 'PRE', escola: 'escola_pallomancia', de: ['Pallomancia', 'Devoção em Palla', 'Símbolo Sagrado', 'Erudição Litúrgica', 'Resistência à Luz Vacilante'], desc: 'A Perícia da Escola: conjura toda a Pallomancia.' },
    { nome: 'Sonoromancia', cat: 'exclusivo', attr: 'PRE', escola: 'escola_sonoromancia', de: ['Sonoromancia', 'Canto', 'Composição', 'Inst. de Corda', 'Inst. de Percussão', 'Inst. de Sopro', 'Instrumentos de Corda', 'Instrumentos de Percussão', 'Instrumentos de Sopro', 'Presença Sonoral', 'Contracanto', 'Afinação Essêncial', 'Afinação Essencial', 'Leitura de Público'], desc: 'A Perícia da Escola: conjura toda a Sonoromancia.' },
    { nome: 'Totemancia', cat: 'exclusivo', attr: 'PRE', escola: 'escola_totemancia', de: ['Totemancia', 'Totemismo', 'Comunhão com Ecos', 'Transcendência', 'Linguagem Animal', 'Exorcismo', 'Aliado Animal'], desc: 'A Perícia da Escola: conjura toda a Totemancia (Espiritismo, Voduísmo, Ferinismo).' },
    { nome: 'Runomancia', cat: 'exclusivo', attr: 'INT', escola: 'escola_runomancia', de: ['Runomancia', 'Erudição Rúnica', 'Gravação Rúnica', 'Diagnóstico Rúnico', 'Diagnóstico', 'Escripta Rúnica', 'Talha Rúnica', 'Tatuagem Rúnica'], desc: 'A Perícia da Escola: grava e lê toda a Runomancia.' },
    { nome: 'Alquimancia', cat: 'exclusivo', attr: 'RAC', escola: 'escola_alquimancia', de: ['Alquimancia', 'Alquimia', 'Maceração', 'Dosagem', 'Erudição Ofensiva', 'Erudição Defensiva'], desc: 'A Perícia da Escola: macera e dosa toda a Alquimancia.' },
];
// Perícias que somem sem destino (o EXP volta; a função reaparece em outra fase)
const SEM_DESTINO = new Set(['Reflexo', 'Desarmar', 'Ambidestria', 'Mentalização']);

// ---------- carga ----------
const col = async n => (await db.collection(`system/data/${n}`).get()).docs.map(d => ({ ...d.data(), id: d.id }));
const [skills, mechanics, vds, equipment, classModules, classes, escolas, peculiarities] = await Promise.all(
    ['skills', 'mechanics', 'derivedValues', 'equipment', 'classModules', 'classes', 'escolas', 'peculiarities'].map(col));
const skillPorNome = new Map(skills.map(s => [strip(s.nome), s]));

// nome antigo (normalizado) → alvo
const alvoPorNomeAntigo = new Map();
for (const a of ALVO) for (const n of a.de) alvoPorNomeAntigo.set(strip(n), a);
for (const a of ALVO) alvoPorNomeAntigo.set(strip(a.nome), a);

// id do doc de cada alvo: primeiro nome de `de` com doc; senão cria
const NOVOS = [];
for (const a of ALVO) {
    a.doc = a.de.map(n => skillPorNome.get(strip(n))).find(Boolean) || null;
    if (!a.doc) { a.id = 'sk_' + slugGeral(a.nome); NOVOS.push(a); } else a.id = a.doc.id;
    a.chave = chaveDe({ nome: a.nome, categoria: a.cat });
}
// id antigo → alvo, e chave antiga → alvo
const alvoPorIdAntigo = new Map();
const semDestinoIds = new Set();
for (const s of skills) {
    const a = alvoPorNomeAntigo.get(strip(s.nome));
    if (a) alvoPorIdAntigo.set(s.id, a); else if (SEM_DESTINO.has(s.nome)) semDestinoIds.add(s.id);
}
const custoAntigo = new Map(skills.map(s => [s.id, Number(s.custoEvolucao) || 4]));

// ---------- 1. skills ----------
const opsSkills = [];
for (const a of ALVO) {
    const base = { nome: a.nome, categoria: a.cat, atributoBase: a.attr, custoEvolucao: 4, todoPersonagem: a.cat !== 'exclusivo', descricao: a.desc, publicado: true, versao: '2.00', updatedAt: Date.now() };
    if (a.escola) base.escolaId = a.escola;
    opsSkills.push({ id: a.id, data: a.doc ? base : { ...base, mecanicaIds: [], criadoEm: Date.now() }, acao: a.doc ? (a.doc.nome === a.nome ? 'ajusta' : `renomeia "${a.doc.nome}"`) : 'cria' });
}
const idsAlvo = new Set(ALVO.map(a => a.id));
for (const s of skills) {
    if (idsAlvo.has(s.id)) continue;
    const a = alvoPorIdAntigo.get(s.id);
    opsSkills.push({ id: s.id, data: { publicado: false, fundidaEm: a ? a.nome : null, versao: '2.00', updatedAt: Date.now() }, acao: a ? `despublica → ${a.nome}` : (semDestinoIds.has(s.id) ? 'despublica (sem destino, EXP devolvido)' : 'despublica (SEM MAPA)') });
}

// ---------- 2. equações ----------
const renomeRef = ref => {
    if (typeof ref !== 'string' || !ref.startsWith('Perícia: ')) return ref;
    const a = alvoPorNomeAntigo.get(strip(ref.slice(9)));
    return a ? 'Perícia: ' + a.nome : ref;
};
const semMapaRefs = new Map();
const marcaSemMapa = (ref, onde) => { if (typeof ref === 'string' && ref.startsWith('Perícia: ') && !alvoPorNomeAntigo.get(strip(ref.slice(9)))) { if (!semMapaRefs.has(ref)) semMapaRefs.set(ref, []); semMapaRefs.get(ref).push(onde); } };
let eqTrocas = 0;
const walkEq = (eq, onde) => { if (!Array.isArray(eq)) return false; let m = false; for (const t of eq) { if (t && typeof t.ref === 'string') { marcaSemMapa(t.ref, onde); const n = renomeRef(t.ref); if (n !== t.ref) { t.ref = n; m = true; eqTrocas++; } } } return m; };
const opsMech = [];
for (const m of mechanics) {
    const cfg = m.config; if (!cfg) continue; let mudou = false; const onde = `mechanics/${m.id} (${m.nome})`;
    for (const c of cfg.calculos || []) {
        if (walkEq(c.equacao, onde)) mudou = true;
        // o ALVO do cálculo também pode ser perícia ("Perícias Iniciais do X": +1 em Perícia: Agilidade)
        if (typeof c.alvo === 'string' && c.alvo.startsWith('Perícia: ')) { marcaSemMapa(c.alvo, onde); const n = renomeRef(c.alvo); if (n !== c.alvo) { c.alvo = n; mudou = true; eqTrocas++; } }
    }
    if (typeof cfg.alvo === 'string' && cfg.alvo.startsWith('Perícia: ')) { marcaSemMapa(cfg.alvo, onde); const n = renomeRef(cfg.alvo); if (n !== cfg.alvo) { cfg.alvo = n; mudou = true; eqTrocas++; } }
    if (walkEq(cfg.equacaoA, onde)) mudou = true; if (walkEq(cfg.equacaoB, onde)) mudou = true;
    // pool de "Perícias Iniciais": perícia sem destino (Reflexo, Desarmar, Ambidestria) sai da lista
    if (Array.isArray(cfg.poolPersonalizado)) { const novo = [...new Set(cfg.poolPersonalizado.filter(p => !(typeof p === 'string' && p.startsWith('Perícia: ') && SEM_DESTINO.has(p.slice(9)))).map(p => { marcaSemMapa(p, onde); return renomeRef(p); }))]; if (JSON.stringify(novo) !== JSON.stringify(cfg.poolPersonalizado)) { cfg.poolPersonalizado = novo; mudou = true; eqTrocas++; } }
    // Iniciativa e Deslocamento sem Agilidade/Tamanho (Livro, Regra 5)
    for (const c of cfg.calculos || []) {
        if (c.alvo === 'Iniciativa' && Array.isArray(c.equacao) && c.equacao.some(t => t.ref === 'Perícia: Acrobacia' || t.ref === 'AUT' || t.ref === 'Tamanho')) {
            c.equacao = [{ tipo: 'ficha', ref: 'RAC' }, { op: '+', tipo: 'ficha', ref: 'DES' }]; mudou = true; eqTrocas++;
        }
        if (c.alvo === 'Desloc. Terrestre' && Array.isArray(c.equacao) && c.equacao.some(t => t.ref === 'Perícia: Acrobacia')) {
            c.equacao = c.equacao.filter(t => t.ref !== 'Perícia: Acrobacia'); if (c.equacao[0]) delete c.equacao[0].op; mudou = true; eqTrocas++;
        }
    }
    if (mudou) opsMech.push({ id: m.id, config: cfg, nome: m.nome });
}
const opsVd = [];
for (const v of vds) { if (walkEq(v.equacao, `derivedValues/${v.id} (${v.nome})`)) opsVd.push({ id: v.id, equacao: v.equacao, nome: v.nome }); }
const opsEq = [];
for (const e of equipment) {
    let mudou = false;
    for (const v of e.valoresDerivadosVinculados || []) if (walkEq(v.equacao, `equipment/${e.id} (${e.nome})`)) mudou = true;
    for (const p of e.periciasVinculadas || []) { if (walkEq(p.equacao, `equipment/${e.id}`)) mudou = true; const a = alvoPorIdAntigo.get(p.id); if (a && a.id !== p.id) { p.id = a.id; mudou = true; } }
    if (mudou) opsEq.push({ id: e.id, valoresDerivadosVinculados: e.valoresDerivadosVinculados || [], periciasVinculadas: e.periciasVinculadas || [], nome: e.nome });
}
const opsMod = [];
for (const m of classModules) {
    let mudou = false;
    for (const f of m.schema || []) if (walkEq(f.equacao, `classModules/${m.id}.schema`)) mudou = true;
    for (const it of m.itensPredefinidos || []) for (const f of m.schema || []) if (f.tipo === 'redutor' && it.valores?.[f.key]?.equacao && walkEq(it.valores[f.key].equacao, `classModules/${m.id}.item`)) mudou = true;
    if (mudou) opsMod.push({ id: m.id, schema: m.schema, itensPredefinidos: m.itensPredefinidos });
}

// ---------- 3. classes.pericClasse / 4. escolas ----------
const opsClasses = [];
for (const c of classes) {
    const atuais = Array.isArray(c.pericClasse) ? c.pericClasse : [];
    const novas = [...new Set(atuais.map(id => alvoPorIdAntigo.get(id)).filter(a => a && a.cat === 'exclusivo').map(a => a.id))];
    if (JSON.stringify(novas) !== JSON.stringify(atuais)) opsClasses.push({ id: c.id, nome: c.nome, de: atuais.length, para: novas });
}
const opsEscolas = ALVO.filter(a => a.escola).map(a => ({ id: a.escola, periciaIds: [a.id], periciaNome: a.nome }));

// ---------- 5. fichas ----------
// chave antiga → alvo: normaliza a chave (tira prefixo, colapsa '_' ) e compara com os slugs dos nomes antigos
const slugsAntigos = new Map(); // slug normalizado → alvo | 'SEM_DESTINO'
const normChave = k => k.replace(/^sk_(mental|fisico|social|combate|classe|exclusivo)_/, '').replace(/^sk_/, '').replace(/_+/g, '_').replace(/^_|_$/g, '');
for (const [nomeN, a] of alvoPorNomeAntigo) { slugsAntigos.set(slugGeral(nomeN).replace(/^_|_$/g, ''), a); }
for (const n of SEM_DESTINO) slugsAntigos.set(slugGeral(n), 'SEM_DESTINO');
// slug da convenção de classe (acento → '_'): "precis_o" ≈ "precisao": comparar tirando '_' internos também
const semSub = s => s.replace(/_/g, '');
const slugsSemSub = new Map(); for (const [k, v] of slugsAntigos) slugsSemSub.set(semSub(k), v);
// legados soltos
const LEGADO = { abismo: 'Abismancia', medicina: 'Anatomia', oficio_int: 'Erudição', oficio_brac: 'Labuta', essencia: 'Fluxomancia', alquimia: 'Alquimancia', historia: 'Erudição', cobertura: 'Bloquear', diagn_stico: 'Runomancia', contato_c_o_s_timo: 'Necromancia', selo_do_profano: 'Necromancia', mpeto: 'Arma', impeto: 'Arma' };
// convenção de classe exata: 'sk_classe_' + slugClasse(nome antigo) — reproduz a chave que core.js gerou
const slugsClasse = new Map();
for (const [nomeN, a] of alvoPorNomeAntigo) { /* nomeN já está sem acento; precisa do nome original */ }
for (const a of ALVO) for (const n of [...a.de, a.nome]) slugsClasse.set(slugClasse(n), a);
for (const n of SEM_DESTINO) slugsClasse.set(slugClasse(n), 'SEM_DESTINO');
const alvoDaChave = k => {
    if (!k.startsWith('sk_')) return null;
    if (k.startsWith('sk_classe_')) { const r = k.slice(10); if (slugsClasse.has(r)) return slugsClasse.get(r); }
    const n = normChave(k);
    if (LEGADO[n]) return alvoPorNomeAntigo.get(strip(LEGADO[n]));
    if (slugsAntigos.has(n)) return slugsAntigos.get(n);
    const s2 = semSub(n); if (slugsSemSub.has(s2)) return slugsSemSub.get(s2);
    return undefined;
};
const custoAcum = (nivel, porNivel) => porNivel * nivel * (nivel + 1) / 2;
const opsChars = [];
const chavesSemMapa = new Map();
for (const d of (await db.collection('char').get()).docs) {
    const c = d.data(); const dots = c.dots || {}; const novo = { ...dots };
    let valorAntigo = 0, valorNovo = 0; const moves = [];
    for (const [k, v] of Object.entries(dots)) {
        if (!k.startsWith('sk_')) continue;
        const nivel = Number(v) || 0;
        const a = alvoDaChave(k);
        if (a === undefined) { chavesSemMapa.set(k, (chavesSemMapa.get(k) || 0) + 1); continue; }
        // custo do que a chave antiga valia (pelo custoEvolucao da perícia antiga, se houver doc)
        const docAntigo = skills.find(s => chaveDe(s) === k || ('sk_classe_' + slugClasse(s.nome)) === k) || null;
        valorAntigo += custoAcum(nivel, docAntigo ? custoAntigo.get(docAntigo.id) : 4);
        delete novo[k];
        if (a === 'SEM_DESTINO') { moves.push(`${k}(${nivel}) → devolvido`); continue; }
        const nk = a.chave;
        const atual = Number(novo[nk]) || 0;
        if (nivel > atual) novo[nk] = nivel;
        if (nk !== k) moves.push(`${k}(${nivel}) → ${nk}${atual ? `(max ${Math.max(atual, nivel)})` : ''}`);
    }
    for (const [k, v] of Object.entries(novo)) if (k.startsWith('sk_')) valorNovo += custoAcum(Number(v) || 0, 4);
    const devolve = Math.max(0, valorAntigo - valorNovo);
    if (moves.length || devolve) opsChars.push({ id: d.id, nome: c.fields?.nome || '', dots: novo, devolve, expAntes: Number(c.fields?.exp) || 0, moves });
}
// npcs
const opsNpcs = [];
for (const d of (await db.collection('npcs').get()).docs) {
    const n = d.data(); const ps = Array.isArray(n.periciasEstruturadas) ? n.periciasEstruturadas : [];
    if (!ps.length) continue;
    const porId = new Map(); let mudou = false;
    for (const p of ps) {
        const a = alvoPorIdAntigo.get(p.refId);
        const id = a ? a.id : (semDestinoIds.has(p.refId) ? null : p.refId);
        if (id !== p.refId) mudou = true;
        if (!id) continue;
        porId.set(id, Math.max(porId.get(id) || 0, Number(p.nivel) || 0));
    }
    if (porId.size !== ps.length) mudou = true;
    if (mudou) opsNpcs.push({ id: d.id, nome: n.nome, de: ps.length, periciasEstruturadas: [...porId].map(([refId, nivel]) => ({ refId, nivel })) });
}

// ---------- relatório ----------
console.log(`${APPLY ? 'APLICANDO' : 'DRY-RUN'} — Fase C1`);
console.log(`\nSKILLS: ${skills.length} hoje → ${ALVO.length} alvo (${NOVOS.length} criadas: ${NOVOS.map(a => a.nome).join(', ')})`);
for (const o of opsSkills) if (!o.acao.startsWith('despublica →') && o.acao !== 'ajusta') console.log(`  ${o.acao}: ${o.id} ${o.data.nome || ''}`);
console.log(`  despublicadas com destino: ${opsSkills.filter(o => o.acao.startsWith('despublica →')).length}; sem destino: ${opsSkills.filter(o => o.acao.includes('sem destino')).length}; SEM MAPA: ${opsSkills.filter(o => o.acao.includes('SEM MAPA')).map(o => skills.find(s => s.id === o.id)?.nome).join(', ') || 'nenhuma'}`);
console.log(`\nEQUAÇÕES: ${eqTrocas} trocas em ${opsMech.length} mecânicas, ${opsVd.length} VDs, ${opsEq.length} itens, ${opsMod.length} módulos`);
for (const [ref, onde] of semMapaRefs) console.log(`  SEM MAPA: ${ref} ← ${onde.slice(0, 3).join(', ')}${onde.length > 3 ? ' …' : ''}`);
console.log(`\nCLASSES: ${opsClasses.length}`); for (const o of opsClasses) console.log(`  ${o.nome}: ${o.de} → [${o.para.join(', ')}]`);
console.log(`ESCOLAS: ${opsEscolas.map(o => o.periciaNome).join(', ')}`);
console.log(`\nFICHAS: ${opsChars.length} com mudança`);
for (const o of opsChars) console.log(`  ${o.id} ${o.nome}: devolve ${o.devolve} EXP (${o.expAntes} → ${o.expAntes + o.devolve}); ${o.moves.length} chaves movidas`);
if (chavesSemMapa.size) console.log(`  CHAVES SEM MAPA (ficam como estão): ${[...chavesSemMapa].map(([k, n]) => `${k}×${n}`).join(', ')}`);
console.log(`\nNPCS: ${opsNpcs.length} com perícias remapeadas`);

if (!APPLY) process.exit(0);

// ---------- aplicar ----------
const backup = { skills, mechanics: opsMech.map(o => mechanics.find(m => m.id === o.id)), vds: opsVd, equipment: opsEq, classModules: opsMod, classes, escolas, chars: opsChars.map(o => ({ id: o.id })), npcs: opsNpcs.map(o => ({ id: o.id })) };
writeFileSync(new URL(`./_backup-pericias-${Date.now()}.json`, import.meta.url), JSON.stringify(backup, null, 1));
let b = db.batch(), n = 0;
const flush = async () => { if (n) { await b.commit(); b = db.batch(); n = 0; } };
const w = async (ref, data, merge = true) => { b.set(ref, data, { merge }); if (++n >= 400) await flush(); };
// update() troca o campo inteiro: é o que apaga as chaves antigas de `dots` e a lista antiga de perícias do NPC
const u = async (ref, data) => { b.update(ref, data); if (++n >= 400) await flush(); };
for (const o of opsSkills) await w(db.doc(`system/data/skills/${o.id}`), o.data);
for (const o of opsMech) await w(db.doc(`system/data/mechanics/${o.id}`), { config: o.config, updatedAt: Date.now() });
for (const o of opsVd) await w(db.doc(`system/data/derivedValues/${o.id}`), { equacao: o.equacao, updatedAt: Date.now() });
for (const o of opsEq) await w(db.doc(`system/data/equipment/${o.id}`), { valoresDerivadosVinculados: o.valoresDerivadosVinculados, periciasVinculadas: o.periciasVinculadas, updatedAt: Date.now() });
for (const o of opsMod) await w(db.doc(`system/data/classModules/${o.id}`), { schema: o.schema, itensPredefinidos: o.itensPredefinidos, updatedAt: Date.now() });
for (const o of opsClasses) await w(db.doc(`system/data/classes/${o.id}`), { pericClasse: o.para, updatedAt: Date.now() });
for (const o of opsEscolas) await w(db.doc(`system/data/escolas/${o.id}`), { periciaIds: o.periciaIds, periciaNome: o.periciaNome, updatedAt: Date.now() });
for (const o of opsChars) await u(db.doc(`char/${o.id}`), { dots: o.dots, 'fields.exp': o.expAntes + o.devolve, migracaoPericiasV2: { em: new Date().toISOString(), devolvido: o.devolve, moves: o.moves } });
for (const o of opsNpcs) await u(db.doc(`npcs/${o.id}`), { periciasEstruturadas: o.periciasEstruturadas, updatedAt: Date.now() });
await flush();
console.log('\ngravado');
process.exit(0);
