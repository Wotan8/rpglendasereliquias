/**
 * Itens da Sessão 47 que não existem em system/data/equipment.
 * Descrições transcritas dos documentos do Mestre (Feira 11 Bancas, Guia da 47,
 * Consequencias_Pendentes) — nada de lore inventado.
 *
 * Cada item herda tipo/formaEquipar/equipavelEm/categoriaArma de um item-modelo
 * que já existe, para não chutar enum nenhum.
 *
 *   node functions/cadastrar-itens-sessao47.mjs           (dry-run)
 *   node functions/cadastrar-itens-sessao47.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const AUTOR = 'M2rZzlQkzxTrrddeFQ10S6zsfX62';

const NOVOS = [
    /* ---- containers ---- */
    {
        nome: 'Caixote da Feira', modelo: 'Mochila Média de Couro',
        tags: ['Container', 'Feira'], peso: 8, tamanho: 6, preco: 20,
        ehContainer: true, capacidadeContainer: 3, pesoMaximoContainer: 40, multiplicadorPressao: 1,
        descricao: 'Caixote de madeira bruta com aro de ferro, do tipo que os Armadores usam para montar a Feira do Submundo. Sem marca, sem etiqueta e sem nome de dono — a mercadoria chega anônima e sai anônima. Empilhados aos pares junto às lonas, ainda por abrir.',
    },
    {
        nome: 'Caixa de Ferro sem Fechadura', modelo: 'Mochila Média de Couro',
        tags: ['Container'], peso: 6, tamanho: 4, preco: 0,
        ehContainer: true, capacidadeContainer: 1, pesoMaximoContainer: 5, multiplicadorPressao: 1,
        descricao: 'Caixa de ferro batido do tamanho de dois antebraços. Não tem fechadura nenhuma: dois fechos laterais e a tampa levanta. Quem guarda o que está aqui dentro não confia em chave — confia em quem está na sala.',
    },

    /* ---- banca 2: Ferro Fundo ---- */
    {
        nome: 'Virote Perfurante', modelo: 'Flecha de Penacho Envenenada +1',
        tags: ['Virote'], peso: 0.08, tamanho: 1, quantidade: 5, preco: 8,
        descricao: 'Virote de ponta afilada em cone longo, forjado por Bren Tor "Dedo de Pedreira". Feito para atravessar placa em vez de rasgar carne. Vendido em maços de cinco.\n\nEm mesa: ignora 2 pontos de Blindagem do alvo.',
    },
    {
        nome: 'Pó de Derrubada', modelo: 'Loção de cura 2 (+4)',
        tags: ['Alquimancia', 'Demolição'], peso: 0.4, tamanho: 1, preco: 200,
        descricao: 'Saquinho de couro com pó cinza-esverdeado, pesado como areia molhada. Aplicado numa junta de alvenaria e deixado agir, faz cerca de dois metros quadrados de pedra ceder sozinha, sem estrondo — o material simplesmente perde a vontade de continuar inteiro.\n\nUm uso. Bren Tor mede a dose com o polegar antes de vender.',
    },

    /* ---- banca 3: A Erva Torta ---- */
    {
        nome: 'Loção de Cegueira I', modelo: 'Loção de cura 2 (+4)',
        tags: ['Loção', 'Alquimancia', 'Herbalismo'], peso: 0.5, tamanho: 1, preco: 120,
        descricao: 'Frasco pequeno de vidro leitoso, tampa de cera. Aplicada nos olhos ou lançada no rosto, a mistura fecha a visão do alvo por tempo suficiente para uma briga acabar. Da banca da Erva Torta, em Velmora.',
    },
    {
        nome: 'Loção Paralisante I', modelo: 'Loção de cura 2 (+4)',
        tags: ['Loção', 'Alquimancia', 'Herbalismo'], peso: 0.5, tamanho: 1, preco: 140,
        descricao: 'Líquido âmbar espesso, quase parado dentro do frasco. Trava a musculatura do alvo sem apagar a consciência — ele continua ouvindo tudo. Da banca da Erva Torta, em Velmora.',
    },
    {
        nome: 'Loção de Medo I', modelo: 'Loção de cura 2 (+4)',
        tags: ['Loção', 'Alquimancia', 'Herbalismo'], peso: 0.5, tamanho: 1, preco: 120,
        descricao: 'Frasco de vidro fumê com sedimento escuro no fundo. Não fere: convence. Quem recebe a dose passa a ter uma certeza física de que precisa sair dali. Da banca da Erva Torta, em Velmora.',
    },
    {
        nome: 'Pó de Cristal de Sono', modelo: 'Loção de cura 2 (+4)',
        tags: ['Alquimancia', 'Herbalismo'], peso: 0.2, tamanho: 1, preco: 90,
        descricao: 'Cristal moído fino, quase branco, guardado em papel encerado. Nenya Mossara vende com o mesmo sorriso com que vende chá: "Isso não é pra ferir. É pra fazer dormir. Muito. Muito tempo."',
    },

    /* ---- banca 1: a aguadeira ---- */
    {
        nome: 'Vela que Não Apaga com Vento', modelo: 'Loção de cura 2 (+4)',
        tags: ['Utilidade', 'Luz'], peso: 0.2, tamanho: 1, preco: 15,
        descricao: 'Vela grossa de sebo escuro com pavio trançado em três fios. A chama deita com o vento mas não morre. A menina Pogtara que vende água na Feira também vende estas, e não explica de onde vêm.',
    },

    /* ---- moeda do Submundo ---- */
    {
        nome: 'Moeda Sombria', modelo: 'Lun',
        tags: ['Moeda', 'Submundo'], peso: 0.02, tamanho: 1, quantidade: 1, preco: 0,
        descricao: 'Disco de metal escuro, sem efígie e sem valor gravado. Não compra nada acima do chão. No Submundo é ficha de entrada e prova de que alguém já respondeu por você uma vez.',
    },

    /* ---- papéis ---- */
    {
        nome: 'Planta do Subsolo de Velmora', modelo: 'Caderno de Notas de Vasteluna',
        tags: ['Documento', 'Mapa'], peso: 0.1, tamanho: 1, preco: 250,
        descricao: 'Planta desenhada à mão por Sorelle "Linha-Partida", cartógrafa negra. Mostra a escadaria, o salão, o salão do leilão e — o que ninguém mais vende — a pedra solta no canto nordeste e a passagem secreta de duzentos metros que sai na mata.\n\nÀ margem, na letra dela: "O túnel foi cavado por quem construiu a fortaleza, não pela Feira. É mais velho que qualquer um lá dentro, e não está no plano de segurança de ninguém." E embaixo: "Um metro e quarenta de altura. Se algum de vocês for grande, calcule isso antes e não depois."',
    },
    {
        nome: 'Os Contos de Thalion Vassek', modelo: 'Caderno de Notas de Vasteluna',
        tags: ['Documento', 'Conto'], peso: 0.2, tamanho: 1, preco: 0,
        descricao: 'Dois textos manuscritos em papel bom, dobrados juntos: "O Céu Ficou Parado" e "Eu Cedi". O primeiro conta o dia em que a família dele morreu. O segundo é o acerto de contas com Morik Varn, e termina numa linha só: "Ibirá… você vai pagar por matar minha família e todos naquele dia."\n\nO papel é de um bloco comprado da Sorelle há três anos.',
    },

    /* ---- a adaga ---- */
    {
        nome: 'O Sussurro Final', modelo: 'Punhal',
        tags: ['Adaga', 'Relíquia'], peso: 1, tamanho: 1, preco: 0, formulaDano: '1d6',
        // ponytail: sem mecanicaIds e sem valoresDerivadosVinculados de propósito —
        // as regras especiais são decisão de mesa, não bônus de item (ver memória
        // "evitar-mecanica-vinculada-a-item"). Se virarem mecânica, cadastre à parte.
        descricao: 'Lâmina de trinta centímetros, metal dourado escurecido, com veios internos negros que se movem devagar. A sala escurece quando a caixa abre — os veios bebem a luz dos lampiões.\n\nContra mortais é uma adaga comum. Contra divindade, ignora Blindagem.\n\nNão entra em bainha: carrega-se na mão ou enrolada em pano. Custa 1 de Sanidade por dia de posse, e os sussurros começam na hora.',
    },
];

/* ================= EXECUÇÃO ================= */
const snap = await db.collection('system/data/equipment').get();
const cat = snap.docs.map(d => ({ id: d.id, ...d.data() }));
const porNome = n => cat.find(x => (x.nome || '').trim().toLowerCase() === n.trim().toLowerCase());

console.log(APPLY ? '=== APLICANDO ===' : '=== DRY-RUN (nada será gravado) ===');
console.log(`Catálogo atual: ${cat.length} itens\n`);

let criados = 0;
for (const it of NOVOS) {
    if (porNome(it.nome)) { console.log('  = já existe:', it.nome); continue; }
    const m = porNome(it.modelo);
    if (!m) { console.log(`  ❌ modelo "${it.modelo}" não existe — pulando ${it.nome}`); continue; }
    const { modelo, ...campos } = it;
    const doc = {
        tipo: m.tipo, formaEquipar: m.formaEquipar, equipavelEm: m.equipavelEm || [],
        categoriaArma: m.categoriaArma ?? null,
        peso: 0.5, tamanho: 1, quantidade: null, preco: 0, imagemUrl: '',
        ehContainer: false, capacidadeContainer: null, pesoMaximoContainer: null,
        multiplicadorPressao: null, pressaoBase: null,
        mecanicaIds: [], valoresDerivadosVinculados: [], statusVitaisVinculados: [],
        publicado: true, versao: 1, criadoPor: AUTOR,
        criadoEm: admin.firestore.Timestamp.now(), atualizadoEm: admin.firestore.Timestamp.now(),
        ...campos,
    };
    console.log(`  + ${it.nome}  [${doc.tipo}${doc.ehContainer ? ' · CONTAINER' : ''}]  peso ${doc.peso} · tam ${doc.tamanho} · ${doc.preco} Luns`);
    criados++;
    if (APPLY) await db.collection('system/data/equipment').add(doc);
}

console.log(`\n=== RESUMO ===\n Criados: ${criados} de ${NOVOS.length}`);
if (!APPLY) console.log('\n Rode de novo com --apply para gravar.');
process.exit(0);
