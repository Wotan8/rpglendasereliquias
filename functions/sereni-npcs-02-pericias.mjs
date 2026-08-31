/**
 * NPCs de Sereni · passada 2 — perícias do campo legado para o catálogo.
 *
 * 45 das 46 fichas têm o campo `skills` preenchido, com 243 nomes distintos dos
 * quais só 29 existem no catálogo. "Engenharia", "Olaria", "Direito", "Combate
 * Corpo a Corpo" são vocabulário do sistema velho.
 *
 * REGRAS DA CONVERSÃO
 *  · Vários nomes legados caem na mesma perícia do catálogo. Vale o MAIOR nível,
 *    nunca a soma — Darian Voss tem sete perícias jurídicas e elas são uma
 *    Erudição, não sete.
 *  · Teto 5. O legado chega a 6 e o catálogo aceita 10, mas 5 já é o especialista
 *    da região; acima disso o Poder da ficha estoura sem motivo.
 *  · Especialização e manobra NÃO são perícia ("Armas de Uma Mão", "Escudos",
 *    "Armaduras Pesadas", "Investida (custo…"). São descartadas, não mapeadas.
 *  · Nome que não estiver no mapa é LISTADO e ignorado. Não se chuta perícia.
 *  · Perícia já cadastrada em `periciasEstruturadas` vence o legado.
 *
 * Junto, as 4 alturas que faltavam: Severus 1,88 · Zuberi 1,75 · Vexia 1,70.
 * Fabo Griz não tem altura declarada em lugar nenhum — fica de fora, e é o único.
 *
 *   node functions/sereni-npcs-02-pericias.mjs            (dry-run)
 *   node functions/sereni-npcs-02-pericias.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';
const ALTURA_VD = 'XPv2i5GhoHfz2QSH3pCl';
const TETO = 5;

const ALTURAS_FALTANTES = { 'Severus Romus': 1.88, 'Zuberi Mbombo': 1.75, 'Vexia Attak': 1.70 };

/* legado → catálogo. Chave em minúscula sem acento. */
const M = {
    /* ── observação e percepção ── */
    'percepcao': 'Observação', 'percepcao social': 'Observação', 'percepcao aguçada': 'Observação',
    'percepcao agucada': 'Observação', 'percepcao visual': 'Observação', 'percepcao tatil': 'Observação',
    'percepcao de falhas': 'Observação', 'percepcao de argila': 'Observação', 'percepcao de qualidade': 'Observação',
    'percepcao de marcas': 'Observação', 'percepcao de perigo': 'Observação', 'percepcao de sombras': 'Observação',
    'percepcao topografica': 'Observação', 'visao aguçada': 'Observação', 'visao agucada': 'Observação',
    'olfato refinado': 'Observação', 'vigilancia': 'Observação', 'acustica': 'Observação', 'optica': 'Observação',
    /* ── social ── */
    'negociacao': 'Barganha', 'regatear': 'Barganha', 'avaliacao': 'Barganha', 'avaliacao de bens': 'Barganha',
    'avaliacao de armas': 'Barganha', 'avaliacao artistica': 'Barganha', 'contabilidade': 'Barganha',
    'manipulacao de mercado': 'Barganha', 'politica comercial': 'Barganha', 'controle de qualidade': 'Barganha',
    'atendimento': 'Barganha', 'gerenciamento': 'Barganha',
    'intimidar': 'Intimidação', 'intimidar (fisico)': 'Intimidação', 'intimidar (presenca)': 'Intimidação',
    'intimidar (autoridade)': 'Intimidação', 'intimidacao intelectual': 'Intimidação',
    'intimidacao moral': 'Intimidação', 'intimidacao sutil': 'Intimidação', 'tortura': 'Intimidação',
    'interrogatorio': 'Intimidação',
    'persuasao': 'Diplomacia', 'persuasao legal': 'Diplomacia', 'labia': 'Diplomacia', 'oratoria': 'Diplomacia',
    'diplomacia religiosa': 'Diplomacia', 'mediacao de luto': 'Diplomacia',
    'enganacao': 'Malandragem', 'falsificacao': 'Malandragem', 'falsificacao de mapas': 'Malandragem',
    'avaliacao (falsa)': 'Malandragem', 'armadilhas de papel': 'Malandragem', 'contra-informacao': 'Malandragem',
    'manipulacao': 'Malandragem', 'historias inventadas': 'Malandragem',
    'deteccao de mentiras': 'Empatia', 'leitura social': 'Empatia', 'leitura de micro-expressoes': 'Empatia',
    'empat': 'Empatia', 'empata': 'Empatia', 'resistencia emocional': 'Empatia',
    'contacao de historias': 'Performance', 'fala enigmatica': 'Performance',
    'etiqueta': 'Tradição', 'cultura famo': 'Tradição', 'religiao': 'Tradição', 'teologia': 'Tradição',
    'lider': 'Liderança', 'taticas': 'Liderança', 'taticas militares': 'Liderança', 'estrategia': 'Liderança',
    'coordenacao de operacoes': 'Liderança', 'administracao': 'Liderança', 'organizacao': 'Liderança',
    'treinamento de aprendizes': 'Liderança', 'disciplina': 'Liderança',
    'manejo de animais': 'Domar', 'primeiros socorros (animais)': 'Domar',
    /* ── físico ── */
    'combate corpo a corpo': 'Arma', 'punhal': 'Arma', 'armas leves': 'Arma',
    'arqueirismo': 'Disparo', 'arquearia': 'Disparo', 'armas de precisao a distancia': 'Disparo', 'cacador': 'Disparo',
    'forca bruta': 'Atletismo', 'forca de trabalho': 'Atletismo', 'forca controlada': 'Atletismo',
    'escalada': 'Atletismo', 'natacao': 'Atletismo', 'atlet': 'Atletismo',
    'briga de bar': 'Briga', 'arremesso': 'Arremessar', 'cavalear': 'Montaria', 'combate montado': 'Montaria',
    'agili': 'Agilidade', 'furti': 'Furtividade', 'silencio': 'Furtividade',
    'rastreamento': 'Sobrevivência', 'rastreamento urbano': 'Sobrevivência', 'rastreamento aquatico': 'Sobrevivência',
    'sobrev': 'Sobrevivência', 'sobrevivencia (aquatica)': 'Sobrevivência', 'exploracao': 'Sobrevivência',
    'conhecimento de estradas': 'Sobrevivência', 'conhecimento de atoleiros': 'Sobrevivência',
    'conhecimento (masmorras)': 'Sobrevivência', 'navegacao em rios': 'Sobrevivência',
    'percepcao natural': 'Sobrevivência', 'perceçao natural': 'Sobrevivência', 'percecao natural': 'Sobrevivência',
    'conexao com raizes': 'Sobrevivência', 'forrageiro': 'Sobrevivência', 'pesca': 'Labuta',
    'olaria': 'Labuta', 'escultura': 'Labuta', 'pedreiro': 'Labuta', 'ferraria basica': 'Labuta',
    'reparo de equipamento': 'Labuta', 'culinaria': 'Labuta', 'fermentacao': 'Labuta', 'cordas e nos': 'Labuta',
    'criacao de receitas': 'Labuta', 'coleta de ingredientes': 'Labuta', 'desenho tecnico': 'Labuta',
    'demolicao controlada': 'Labuta', 'estetica': 'Labuta', 'paciencia artistica': 'Labuta',
    'colecionar timbres': 'Labuta', 'identificacao de especiarias': 'Labuta', 'conhecimento (bebidas)': 'Labuta',
    /* ── combate ── */
    'defesa com escudo': 'Bloquear', 'escudo': 'Bloquear', 'taticas de bloqueio': 'Bloquear',
    'postura defensiva': 'Bloquear', 'reacao rapida': 'Reflexo',
    /* ── mental ── */
    'engenharia': 'Erudição', 'calculo estrutural': 'Erudição', 'arquitetura defensiva': 'Erudição',
    'cartografia': 'Erudição', 'geografia': 'Erudição', 'geologia basica': 'Erudição', 'quimica basica': 'Erudição',
    'direito': 'Erudição', 'analise contratual': 'Erudição', 'deteccao de clausulas ocultas': 'Erudição',
    'redacao juridica': 'Erudição', 'burocracia': 'Erudição', 'politica': 'Erudição',
    'escrita e leitura': 'Erudição', 'decifracao': 'Erudição', 'criptografia': 'Erudição',
    'criptografia basica': 'Erudição', 'codigos e cifras': 'Erudição', 'codigos de apito': 'Erudição',
    'sinalizacao': 'Erudição', 'memoria fotografica': 'Erudição', 'memoria de padroes': 'Erudição',
    'memoria de precedentes': 'Erudição', 'conhecimento de livros': 'Erudição', 'linguas antigas': 'Erudição',
    'interpretacao de enigmas': 'Erudição', 'organizacao de sistemas': 'Erudição',
    'conhecimento (botanica)': 'Erudição',
    'historia local': 'História', 'historia legal': 'História', 'historia de sereni': 'História',
    'historia (parcial)': 'História',
    'medicina': 'Anatomia', 'cirurgia': 'Anatomia', 'diagnostico': 'Anatomia', 'primeiros socorros': 'Anatomia',
    'herbologia': 'Herbalismo', 'identificacao de plantas': 'Herbalismo', 'cura com ervas': 'Herbalismo',
    'toxicologia': 'Herbalismo',
    'alquimia': 'Alquimancia', 'preparo de pocoes': 'Alquimancia',
    'resistencia': 'Resiliência', 'resistencia mental': 'Resiliência', 'meditacao': 'Resiliência',
    'meditacao profunda': 'Resiliência', 'concentracao': 'Resiliência', 'paciencia': 'Resiliência',
    'silencio interior': 'Resiliência',
    'conhecimento arcano': 'Fluxomancia', 'percepcao mistica': 'Fluxomancia', 'sentir essencia': 'Fluxomancia',
    'essencia (sentir medo)': 'Fluxomancia', 'leitura de aura': 'Fluxomancia', 'rituais': 'Fluxomancia',
    'rituais basicos': 'Fluxomancia', 'memorizacao de feiticos': 'Fluxomancia',
    'abismo': 'Abismancia', 'runas antigas': 'Runomancia',
    /* ── exclusivas ── */
    'armadilhas': 'Arrombamento',
    'conhecimento (submundo)': 'Submundo', 'rede de contatos': 'Submundo',
    'visoes profeticas': 'Sexto Sentido', 'presciencia': 'Sexto Sentido', 'percepcao alem da vista': 'Sexto Sentido',
    'rituais de palla': 'Devoção em Palla', 'cura pela luz': 'Devoção em Palla',
    'banir trevas': 'Devoção em Palla', 'protecao sagrada': 'Devoção em Palla',
    'cura mistica': 'Comunhão com Ecos', 'rituais de cura': 'Comunhão com Ecos',
    'cura espiritual': 'Comunhão com Ecos', 'diagnostico por ecos': 'Comunhão com Ecos',
    'percepcao espiritual': 'Comunhão com Ecos',
};
/* especializações e manobras — descartadas, não são perícia */
const LIXO = /^(armas de |armaduras |escudos$|postura (ofensiva|de combate)|imobilizar|atordoar|investida|—|-\s*per|especializ|manobra)/i;

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const grab = async c => (await db.collection(c).get()).docs;
const [npcDocs, skDocs] = await Promise.all([grab('npcs'), grab('system/data/skills')]);
const skills = skDocs.map(d => ({ id: d.id, ...d.data() }));
const skPorNome = {}; for (const s of skills) skPorNome[norm(s.nome)] = s;

const naoMapeados = new Map();
const plano = [];
const alvos = npcDocs.filter(d => {
    const n = d.data();
    return /sereni/i.test(String(n.local || '')) && n.tipo !== 'criatura';
});

for (const doc of alvos) {
    const n = doc.data();
    const melhor = new Map();   // skillId → nível
    const de = new Map();       // skillId → nomes legados que caíram nela
    for (const linha of String(n.skills || '').split(/\n|\|/)) {
        const m = /^\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ()'.\-]*?)\s+(\d+)/.exec(linha.trim());
        if (!m) continue;
        const bruto = m[1].trim(), nv = Math.min(TETO, Number(m[2]));
        if (LIXO.test(bruto)) continue;
        const destino = skPorNome[norm(bruto)] ? skPorNome[norm(bruto)].nome : M[norm(bruto)];
        if (!destino) { naoMapeados.set(bruto, (naoMapeados.get(bruto) || 0) + 1); continue; }
        const s = skPorNome[norm(destino)];
        if (!s) { naoMapeados.set(`${bruto} → "${destino}" NÃO EXISTE`, 1); continue; }
        melhor.set(s.id, Math.max(melhor.get(s.id) || 0, nv));
        de.set(s.id, [...(de.get(s.id) || []), bruto]);
    }
    /* o que já está cadastrado vence */
    const jaTem = new Map((n.periciasEstruturadas || []).filter(p => p.refId && Number(p.nivel) > 0)
        .map(p => [p.refId, Number(p.nivel)]));
    for (const [id, nv] of jaTem) melhor.set(id, Math.max(melhor.get(id) || 0, nv));

    if (!melhor.size) continue;
    plano.push({
        ref: doc.ref, nome: n.nome, jaTem: jaTem.size,
        altura: ALTURAS_FALTANTES[n.nome] ?? null,
        pericias: [...melhor].map(([refId, nivel]) => ({ refId, nivel })),
        detalhe: [...melhor].map(([id, nv]) => ({
            nome: skills.find(s => s.id === id).nome, nv, de: (de.get(id) || []).join(', ') })),
        vig: Number(n.atributos?.VIG) || 0, doc: n,
    });
}

/* ── relatório ── */
console.log(`\n=== NPCs de Sereni · perícias (${plano.length} de ${alvos.length}) ===\n`);
for (const p of plano.sort((a, b) => a.nome.localeCompare(b.nome))) {
    console.log(`── ${p.nome}   ${p.jaTem ? `(${p.jaTem} já cadastradas, preservadas)` : ''}`);
    for (const d of p.detalhe.sort((x, y) => y.nv - x.nv))
        console.log(`     ${d.nome.padEnd(22)} ${d.nv}   ← ${d.de || '(já cadastrada)'}`);
}
const semNada = alvos.filter(d => !plano.some(p => p.ref.id === d.id)).map(d => d.data().nome);
if (semNada.length) console.log(`\nSem perícia nenhuma extraível: ${semNada.join(', ')}`);
console.log(`\nAlturas que faltavam: ${Object.entries(ALTURAS_FALTANTES).map(([k, v]) => `${k} ${v} m`).join(' · ')}`);
if (naoMapeados.size) {
    console.log(`\n⚠ NÃO MAPEADOS — ignorados, não chutados (${naoMapeados.size}):`);
    console.log('   ' + [...naoMapeados].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}${v > 1 ? ` ×${v}` : ''}`).join(' · '));
}
console.log(`\n   ${plano.reduce((s, p) => s + p.pericias.length, 0)} vínculos de perícia no total.`);

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const iso = new Date().toISOString();
const batch = db.batch();
for (const p of plano) {
    const patch = { periciasEstruturadas: p.pericias, schemaVersion: 2, lastUpdate: iso, lastUpdateBy: AUTOR };
    if (p.altura != null) {
        const vd = p.doc.valoresDer || {};
        const ov = { ...(vd.overrides || {}), [ALTURA_VD]: p.altura };
        delete ov['173WnYtDJuLBjr8Yuyy4']; delete ov.VIT;
        patch.modoFicha = p.doc.modoFicha || 'mecanico';
        patch.valoresDer = { ...vd, overrides: ov, atual: vd.atual || {}, extras: vd.extras || [],
            VIT: (p.vig + p.altura * 3) * 3 };
    }
    batch.update(p.ref, patch);
}
await batch.commit();
console.log(`\n✅ ${plano.length} fichas com perícias do catálogo.`);
process.exit(0);
