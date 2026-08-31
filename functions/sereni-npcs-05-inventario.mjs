/**
 * NPCs de Sereni · passada 5 — inventário estruturado.
 *
 * Nenhum dos 46 tinha `items` de verdade — a arma era só o texto de `ataques`
 * e o resto era prosa em `loot.itens`, misturando posse pessoal com estoque de
 * loja à venda e serviço prestado. Escopo desta passada (decidido com o
 * usuário em 31/08/2026): arma de combate + armadura/escudo quando o texto
 * declara + itens pessoais NOTÁVEIS (o que carrega peso narrativo — segredo,
 * lembrança, ferramenta de ofício). Estoque de mercador para venda e serviço
 * (as seções "PRODUTOS"/"ESTOQUE"/"SERVIÇOS" de Brym, Darva, Fabo Griz, Gando,
 * Nenya, Rorek, Velmir, Zathro) NÃO vira item — não é posse do NPC.
 *
 * REGRA DO USUÁRIO: nada fica solto. Todo item ou está `equipado: true`
 * (arma na mão, armadura no corpo, contêiner vestido) ou tem `parentItemId`
 * apontando para um contêiner que o NPC carrega. Por isso todo NPC ganha pelo
 * menos um contêiner — mochila, cinto ou estojo, o que o próprio texto já
 * sugere, ou uma Mochila Pequena de Couro quando não sugere nada.
 *
 * A arma principal é lida de `ataques` (já em v3, rótulo = nome exato do
 * catálogo, graças à passada 3). Armadura/escudo/arma secundária declarados
 * em `loot.itens` viram item de catálogo equipado. Item pessoal notável vira
 * item genérico (nome, tipo e descrição escritos à mão a partir do que a
 * própria ficha já diz — nada inventado) dentro do contêiner.
 *
 * Vexia Attak fica de fora: mesa em andamento, e o inventário dela já existe
 * e já está correto (mochila com tudo dentro, nada solto). Raknar tinha um
 * item solto de teste (Loção de cura sem contêiner) — este script arruma,
 * põe dentro da mochila nova em vez de duplicar.
 *
 *   node functions/sereni-npcs-05-inventario.mjs            (dry-run)
 *   node functions/sereni-npcs-05-inventario.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');
const AUTOR = 'igorestevamalvesdesouza@gmail.com';

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/* peso/tamanho default por tipo genérico, quando o item não tem template no catálogo */
const DEFAULT_POR_TIPO = {
    'Objeto': { peso: 0.2, tamanho: 0.15 },
    'Acessório': { peso: 0.1, tamanho: 0.1 },
    'Consumível': { peso: 0.2, tamanho: 0.1 },
    'Relíquia': { peso: 0.2, tamanho: 0.15 },
};

/* ═══════════════ dados por NPC — hand-curado do loot.itens de cada ficha ═══════════════
   equipados: nomes exatos do catálogo, além da arma principal (já resolvida de `ataques`)
   container: nome exato do catálogo — todo NPC tem pelo menos um
   notaveis: [nome, tipo, descrição curta] — só o que pesa na história, não a lista inteira */
const DADOS = {
    'Albrix Muro-de-Ferro': { equipados: ['Escudo Grande', 'Cota de Placas'], container: 'Cinturão Rebitado',
        notaveis: [['Medalhão de cobre com retrato de Lenna', 'Acessório', 'Retrato grosseiro de uma jovem chamada Lenna.'],
            ['Pergaminho selado de Morik', 'Objeto', 'Ordens da missão, escondido dentro do forro do escudo.']] },
    "Bren Tor 'Dedo de Pedreira'": { equipados: ['Gibão Acolchoado', 'Braçadeiras de Couro'], container: 'Cinturão Rebitado',
        notaveis: [['Projetos de muralha modular', 'Objeto', 'Plantas técnicas de reforço estrutural.'],
            ['Explosivos de demolição controlada', 'Consumível', '3 cargas prontas para uso.']] },
    'Brym': { equipados: [], container: 'Mochila Pequena de Couro',
        notaveis: [['Ferramentas de oleiro', 'Objeto', 'Jogo de tamanho grande, para o torno.']] },
    'Burkan': { equipados: ['Escudo Grande', 'Cota de Malha'], container: 'Cinturão Rebitado',
        notaveis: [['Insígnia de guarda', 'Acessório', ''], ['Apito de códigos', 'Objeto', 'Sinaliza entre os guardas da vila.']] },
    'Capanga de Thalion': { equipados: ['Couro Leve', 'Besta Leve'], container: 'Mochila Pequena de Couro',
        notaveis: [['Bilhete com símbolo de Velmora', 'Objeto', 'Marca a localização de Velmora.'],
            ['Os Contos de Thalion Vassek', 'Objeto', '★ Cópia manuscrita, item de valor.']] },
    'Darian Voss': { equipados: [], container: 'Mochila Pequena de Couro',
        notaveis: [['Dossiê da Casa Arne', 'Objeto', 'Registros confidenciais.'], ['Sinetes oficiais', 'Acessório', '']] },
    'Darin dos Ecos': { equipados: ['Couro Cravejado', 'Arco Curto'], container: 'Mochila Pequena de Couro',
        notaveis: [['Mapa incompleto da gruta de Ibirá', 'Objeto', 'Vale 150 Luns; leva a uma gruta específica.'],
            ['Kit de armadilhas', 'Objeto', '']] },
    'Darva Torvel': { equipados: [], container: 'Mochila Pequena de Couro',
        notaveis: [['Caderno de receitas ancestral de Elara', 'Objeto', 'Cifrado, com anotações de três gerações.'],
            ['Pulseira de cerâmica das três gerações Torvel', 'Acessório', '']] },
    'Ebrus da Areia': { equipados: ['Escudo Médio', 'Couro Reforçado', 'Arco Curto'], container: 'Mochila Pequena de Couro',
        notaveis: [['Insígnia de capitão', 'Acessório', ''], ['Manual de táticas Famo', 'Objeto', '']] },
    'Fabo Griz': { equipados: [], container: 'Mochila Pequena de Couro', notaveis: [] },
    "Fennick 'Dedo-Fino' Maren": { equipados: ['Dardo'], container: 'Mochila Pequena de Couro',
        notaveis: [['Cristal menor autêntico', 'Relíquia', 'Vale 200 Luns.'], ['Lista cifrada de compradores', 'Objeto', '']] },
    'Fontrix Olho-de-Corvo': { equipados: ['Couro Reforçado', 'Faca de Caça'], container: 'Manto do Viajante',
        notaveis: [['Correntinha de prata com aliança de casamento (Ilena)', 'Acessório', 'Item sentimental.'],
            ['3 frascos de loção ofensiva', 'Consumível', '2 Cegante, 1 Incendiária.']] },
    'Gando Bravolume': { equipados: [], container: 'Mochila Pequena de Couro',
        notaveis: [['Códice rasgado pré-Silmari', 'Relíquia', 'Genuíno, vale 300 Luns — o único item real em meio às falsificações.'],
            ['Modelos de selos antigos', 'Objeto', 'Usados para falsificar autenticidade.']] },
    'Gertrok Carrasombra': { equipados: [], container: 'Cinturão Rebitado',
        notaveis: [['Chaveiro com 12 chaves', 'Objeto', 'Acessos secretos da Caneca Preta.'],
            ['Caderneta cifrada com contatos do Submundo', 'Objeto', '']] },
    'Halena Varn': { equipados: [], container: 'Mochila Pequena de Couro',
        notaveis: [['Selo pessoal de escriba', 'Acessório', ''], ['Óculos de aumento', 'Objeto', 'Para trabalho detalhado.']] },
    'Ina Nó-de-Pedra': { equipados: [], container: 'Cinturão Rebitado',
        notaveis: [['Livro-caixa com fecho metálico', 'Objeto', 'Códigos contábeis do Submundo.'],
            ['Moeda Sombria', 'Objeto', 'De alta denominação — 5 unidades.']] },
    'Isvena': { equipados: [], container: 'Mochila Pequena de Couro',
        notaveis: [['Espada Longa', 'Arma', 'Guardada no porão secreto, não empunhada.']] },
    'Julo': { equipados: [], container: 'Mochila Pequena de Couro',
        notaveis: [['Queijo de fenor', 'Consumível', 'Caseiro.'], ['Apito de pastor', 'Acessório', '']] },
    'Kael Rastreio da Névoa': { equipados: ['Faca de Caça'], container: 'Manto do Viajante',
        notaveis: [['3 Loções de Cura', 'Consumível', 'Cura 2d6 VIT cada.'], ['Diário de rastreamento', 'Objeto', 'Descrições de 15 criaturas.']] },
    'Kirael Sombaluz': { equipados: [], container: 'Mochila Pequena de Couro',
        notaveis: [['Amuleto de proteção neutra', 'Acessório', ''], ['Diário de visões', 'Objeto', 'Cifrado.']] },
    "Lúcia 'Vara de Névoa' Ardan": { equipados: [], container: 'Cinturão Rebitado',
        notaveis: [['Adaga cerimonial Laqueus', 'Acessório', 'Cerimonial, distinta da adaga de combate.'],
            ['Caderno cifrado com códigos', 'Objeto', '']] },
    'Minae Torvel': { equipados: [], container: 'Mochila Pequena de Couro',
        notaveis: [['Pingente de madeira em forma de caneca', 'Acessório', 'Último presente de Isvena.'],
            ['Chaves dos depósitos da Caneca Preta', 'Objeto', 'Confiadas por Gertrok.']] },
    'Míria Sálea': { equipados: [], container: 'Estojo de Campo',
        notaveis: [['Loções "cinzentas" para sustento', 'Consumível', 'SECRETO — 4 doses.'],
            ['Faixa de braço com máscara tripla bordada', 'Acessório', '']] },
    'Morik Varn, o Ancião': { equipados: [], container: 'Mochila Pequena de Couro',
        notaveis: [['Selo oficial de Sereni', 'Acessório', ''], ['Dossiê Confidencial', 'Objeto', 'Entregue aos jogadores conforme a trama.']] },
    'Nenya Mossara': { equipados: [], container: 'Estojo do Herborista',
        notaveis: [['Livro de receitas', 'Objeto', 'Cifrado.']] },
    'Noryel': { equipados: [], container: 'Mochila Pequena de Couro',
        notaveis: [['Grimório iniciante', 'Objeto', 'Incompleto.']] },
    'Odara Valmera': { equipados: [], container: 'Mochila Pequena de Couro',
        notaveis: [['Caderno de contas', 'Objeto', 'Registro de Fennick reservando a sala dos fundos.']] },
    'Ormus, o Cego': { equipados: [], container: 'Mochila Pequena de Couro',
        notaveis: [['Amuleto do mestre desaparecido', 'Acessório', ''], ['Pedras rúnicas', 'Objeto', 'Divinação.']] },
    'Orsik Keld': { equipados: [], container: 'Mochila Pequena de Couro',
        notaveis: [['Caixa de doações parcialmente desviada', 'Objeto', '']] },
    "Pelion 'Pisca' Varne": { equipados: [], container: 'Mochila Pequena de Couro',
        notaveis: [['Livreto de códigos', 'Objeto', 'Rascunho em desenvolvimento.'], ['Coleção pessoal de timbres raros', 'Acessório', '']] },
    'Raknar Sombra Sangrenta': { equipados: ['Couro Reforçado', 'Machado de Guerra'], container: 'Mochila Maior de Couro',
        notaveis: [['Colar com 23 dentes', 'Acessório', 'Troféus de vítimas.'], ['Marca dos Coletores', 'Objeto', 'Token de membro.']] },
    'Rorek Pic': { equipados: [], container: 'Mochila Pequena de Couro',
        notaveis: [['Kit de falsificação básico', 'Objeto', '']] },
    'Severus Romus': { equipados: [], container: 'Mochila Pequena de Couro',
        notaveis: [['Rascunho de Contrato de Tributo', 'Objeto', 'Notas à margem "revisadas" por F. Dorius.'],
            ['Mapa de Patrulha da Borda de Sereni', 'Objeto', 'Marca um celeiro "neutro" em vermelho.']] },
    "Sorelle 'Linha-Partida'": { equipados: [], container: 'Cinturão Rebitado',
        notaveis: [['Compasso de ouro e penas especiais', 'Objeto', ''], ['Lacres numerados e criptografados', 'Objeto', '']] },
    'Talion de Inéria': { equipados: ['Adaga simples'], container: 'Mochila Pequena de Couro',
        notaveis: [['Colar de Frederica', 'Acessório', 'Item sentimental.'], ['3 cartas de Frederica', 'Objeto', 'Escondidas no alforje.']] },
    'Thalion Vassek': { equipados: ['Besta Leve'], container: 'Mochila Pequena de Couro',
        notaveis: [['Diário pessoal com reflexões anti-Aslial', 'Objeto', '']] },
    'Thorkan': { equipados: ['Espada Curta', 'Couro Reforçado'], container: 'Cinturão Rebitado',
        notaveis: [['Insígnia de guarda', 'Acessório', ''], ['Caderno de anotações', 'Objeto', 'Lista de suspeitos.']] },
    'Tiric': { equipados: ['Faca de Caça'], container: 'Mochila Pequena de Couro', notaveis: [] },
    'Valon Kruk': { equipados: ['Cota de Malha', 'Escudo Médio'], container: 'Mochila Pequena de Couro',
        notaveis: [['Colar do sol', 'Acessório', 'Sagrado.'], ['Tomo de orações', 'Objeto', '']] },
    "Velhen 'O Que Se Repete'": { equipados: [], container: 'Mochila Pequena de Couro',
        notaveis: [['Fragmento de Manto Sussurrante', 'Relíquia', 'Tecido que sempre tremula.'],
            ['Núcleo de Presença', 'Relíquia', 'Se extraído do corpo antes de se dissipar.']] },
    'Velmir Trok': { equipados: [], container: 'Mochila Pequena de Couro',
        notaveis: [['Balança de precisão', 'Objeto', '']] },
    'Zathro': { equipados: [], container: 'Mochila Pequena de Couro',
        notaveis: [['Diário de símbolos', 'Objeto', 'Cifrado.']] },
    'Zorkan': { equipados: ['Espada Curta', 'Couro Reforçado'], container: 'Mochila Pequena de Couro',
        notaveis: [['Binóculo simples', 'Acessório', ''], ['Mapas de patrulha', 'Objeto', '']] },
    'Zuberi Mbombo': { equipados: [], container: 'Mochila Pequena de Couro',
        notaveis: [['Pingente de Pedra lisa (Talhado: Zira)', 'Acessório', 'Colar da sua filha.']] },
    'Zyra Vento Veloz': { equipados: ['Couro Leve', 'Adaga'], container: 'Mochila Média de Couro',
        notaveis: [['Besta quebrada de Voros', 'Relíquia', 'Item sentimental — pertencia a alguém chamado Voros.'],
            ['Pedaço de tecido ensanguentado', 'Objeto', 'Pista.']] },
};
/* de propósito fora da tabela: Vexia Attak — mesa em andamento, inventário já existe e já está correto */
const FORA_DO_ESCOPO = ['Vexia Attak'];

const grab = async c => (await db.collection(c).get()).docs.map(d => ({ id: d.id, ...d.data() }));
const [npcs, equip, itemsExistentes] = await Promise.all([grab('npcs'), grab('system/data/equipment'), grab('items')]);
const equipPorNome = {}; for (const e of equip) equipPorNome[norm(e.nome)] = e;

const erros = [];
const alvos = npcs.filter(n => /sereni/i.test(String(n.local || '')) && n.tipo !== 'criatura' && !FORA_DO_ESCOPO.includes(n.nome));

let novoId = 0;
const gerarId = () => `item-inv05-${Date.now()}-${(novoId++).toString(36)}`;

const TEMPLATE_FIELDS = ['tipo', 'categoriaArma', 'peso', 'tamanho', 'descricao', 'imagem', 'equipavelEm',
    'formaEquipar', 'ehContainer', 'pesoMaximoContainer', 'multiplicadorPressao', 'mecanicaIds', 'formulaDano',
    'liga', 'preco', 'tags'];
const deCatalogo = (nomeCatalogo) => {
    const t = equipPorNome[norm(nomeCatalogo)];
    if (!t) return null;
    const item = {};
    for (const f of TEMPLATE_FIELDS) if (t[f] !== undefined) item[f] = t[f];
    item.nome = t.nome;
    item.mecanicaIdsProprias = t.mecanicaIds || [];
    delete item.mecanicaIds;
    return item;
};

const plano = [];
for (const n of alvos) {
    const dados = DADOS[n.nome];
    if (!dados) { erros.push(`"${n.nome}": sem entrada na tabela DADOS`); continue; }

    const itensDoNpc = [];
    const idContainer = gerarId();

    /* arma principal — lida de `ataques`, já em v3 (rótulo = nome do catálogo) */
    const primeiraLinha = String(n.ataques || '').split('\n')[0] || '';
    const mArma = /^([^(]+?)\s*\(A\. Padrão\)/.exec(primeiraLinha);
    const nomeArma = mArma ? mArma[1].trim() : null;
    if (nomeArma && nomeArma !== 'Desarmado') {
        const base = deCatalogo(nomeArma);
        if (!base) { erros.push(`"${n.nome}": arma principal "${nomeArma}" não achada no catálogo`); }
        else itensDoNpc.push({ ...base, equipado: true, estadoEquip: base.formaEquipar === 'vestir' ? 'vestido' : 'empunhado',
            slotAnatomico: (base.equipavelEm || [])[0] || null, parentItemId: null, quantidade: 1 });
    }

    /* armadura / escudo / arma secundária declarados no loot */
    for (const nomeEq of dados.equipados) {
        const base = deCatalogo(nomeEq);
        if (!base) { erros.push(`"${n.nome}": equipado "${nomeEq}" não achado no catálogo`); continue; }
        itensDoNpc.push({ ...base, equipado: true, estadoEquip: base.formaEquipar === 'vestir' ? 'vestido' : base.formaEquipar === 'empunhar' ? 'empunhado' : base.formaEquipar,
            slotAnatomico: (base.equipavelEm || [])[0] || null, parentItemId: null, quantidade: 1 });
    }

    /* o contêiner — todo NPC tem pelo menos um, vestido */
    const baseContainer = deCatalogo(dados.container);
    if (!baseContainer) { erros.push(`"${n.nome}": contêiner "${dados.container}" não achado no catálogo`); }
    else itensDoNpc.push({ ...baseContainer, id: idContainer, equipado: true, estadoEquip: 'vestido',
        slotAnatomico: (baseContainer.equipavelEm || [])[0] || null, parentItemId: null, quantidade: 1 });

    /* itens pessoais notáveis — genéricos, dentro do contêiner, nunca soltos */
    for (const [nome, tipo, descricao] of dados.notaveis) {
        const baseCat = deCatalogo(nome);   // se por acaso existir template exato (ex.: "Espada Longa" da Isvena)
        const dflt = DEFAULT_POR_TIPO[tipo] || DEFAULT_POR_TIPO.Objeto;
        itensDoNpc.push({
            nome, tipo: baseCat?.tipo || tipo, categoriaArma: baseCat?.categoriaArma ?? null,
            peso: baseCat?.peso ?? dflt.peso, tamanho: baseCat?.tamanho ?? dflt.tamanho,
            descricao, imagem: baseCat?.imagem || '',
            equipavelEm: baseCat?.equipavelEm || [], formaEquipar: baseCat?.formaEquipar || null,
            ehContainer: false, pesoMaximoContainer: null, multiplicadorPressao: null,
            mecanicaIdsProprias: [], quantidade: 1,
            equipado: false, estadoEquip: null, slotAnatomico: null, parentItemId: idContainer,
        });
    }

    plano.push({ npcId: n.id, nome: n.nome, itens: itensDoNpc, idContainer });
}

/* Raknar tinha um item de teste solto (Loção de cura, equipado:false, sem contêiner) —
   em vez de duplicar, este item passa a apontar pro contêiner novo dele. */
const raknarSolto = itemsExistentes.filter(i => i.characterId === plano.find(p => p.nome === 'Raknar Sombra Sangrenta')?.npcId
    && !i.equipado && !i.parentItemId);

/* ── relatório ── */
console.log(`\n=== Inventário de Sereni · ${plano.length} de ${alvos.length} fichas (fora do escopo: ${FORA_DO_ESCOPO.join(', ')}) ===\n`);
let totalItens = 0;
for (const p of plano) {
    totalItens += p.itens.length;
    console.log(`── ${p.nome} (${p.itens.length} itens)`);
    for (const it of p.itens) {
        const onde = it.equipado ? `equipado (${it.estadoEquip})` : `dentro do contêiner`;
        console.log(`     ${it.nome.padEnd(32)} ${it.tipo.padEnd(11)} ${onde}`);
    }
}
console.log(`\nTotal: ${totalItens} itens em ${plano.length} fichas.`);
if (raknarSolto.length) console.log(`\nRaknar: ${raknarSolto.length} item(ns) solto(s) de teste será(ão) reparentado(s) pro contêiner novo (não duplicado).`);

if (erros.length) { console.log('\n❌ ERROS — nada foi gravado:'); erros.forEach(e => console.log('   ' + e)); process.exit(1); }

if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }

const iso = new Date().toISOString();
const batch = db.batch();
for (const p of plano) {
    for (const it of p.itens) {
        const id = it.id || gerarId();
        const { id: _drop, ...resto } = it;
        batch.set(db.collection('items').doc(id), {
            ...resto, characterId: p.npcId, ownerType: 'npc', criadoPor: AUTOR, lastModified: iso,
        });
    }
}
for (const s of raknarSolto) {
    const container = plano.find(p => p.nome === 'Raknar Sombra Sangrenta').idContainer;
    batch.update(db.collection('items').doc(s.id), { parentItemId: container, lastModified: iso });
}
await batch.commit();
console.log(`\n✅ ${totalItens} itens gravados em ${plano.length} fichas.${raknarSolto.length ? ` ${raknarSolto.length} item(ns) do Raknar reparentado(s).` : ''}`);
process.exit(0);
