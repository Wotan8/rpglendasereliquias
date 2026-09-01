/* Dublê do Firestore para os harness __check-*. Guarda o que foi gravado
   em GRAVADO, para o teste conferir os writes sem tocar na nuvem. */
export const GRAVADO = [];

const DADOS = {
    'worldbuilding-books': [
        { id: 'b1', title: 'Crônicas de Vaugh', versao: '2.1', description: 'A vila e a dívida.',
          cover: '', estanteIds: ['e1'], order: 0,
          pub: { geral: true, conhGeral: false, conhVinculo: true, mestre: false } },
        { id: 'b2', title: 'Livro sem capítulo', order: 1, pub: {} },
    ],
    /* O aviso de versao escreve em `users.notifications` — o mesmo campo que
       o sino do Portal escuta. Tres jogadores e dois mestres, para o recorte
       por publicacao ter o que separar. */
    'users': [
        { id: 'u1', email: 'igor@x', role: 'criador', notifications: [] },
        { id: 'u2', email: 'mestre@x', role: 'mestre', notifications: [{ id: 'velha', message: 'antiga', timestamp: 1, isNew: false }] },
        { id: 'u3', email: 'jog1@x' },
        { id: 'u4', email: 'jog2@x', role: 'jogador', notifications: [] },
        // Dono de ficha que nao e salva desde que o espelho passou a existir.
        { id: 'u9', email: 'sumido@x', role: 'jogador', notifications: [] },
    ],
    /* Fichas, para o aviso de livro de VINCULO saber quem alcanca o que.
       `livrosAlcance` e o espelho gravado pela ficha; a ultima NAO tem o
       campo de proposito — e o estado "nao da para saber". */
    'char': [
        { id: 'p1', ownerUid: 'u3', fields: { raca: 'Elorin' }, livrosAlcance: ['b1'] },
        { id: 'p2', ownerUid: 'u4', fields: { raca: 'Humano' }, livrosAlcance: [] },
        { id: 'p3', ownerUid: 'u9', fields: { raca: 'Elorin' } },
    ],
    /* Um punhado dos cadastros NOVOS que o campo vinculado passou a alcancar
       — inclusive os tres jeitos de guardar o nome (nome/titulo/title). */
    'system/data/races': [{ id: 'r1', nome: 'Elorin', expectativaVida: '210 anos', habitat: 'Florestas altas' }],
    'system/data/peculiarities': [{ id: 'pec1', nome: 'Couro Endurecido', descricao: 'A pele engrossa onde ja apanhou.' }],
    'system/data/bodyParts': [{ id: 'bp1', nome: 'Torso', formulaDano: '1d4' }],
    'system/data/derivedValues': [{ id: 'vd1', nome: 'Iniciativa', formula: 'DES + PRE' }],
    'system/data/classModules': [{ id: 'cm1', titulo: 'Senda do Ferreiro', descricao: 'Modulo de classe.' }],
    'system/data/tribes': [{ id: 'tm1', nome: 'Pogtara', lema: 'O ferro lembra.' }],
    'worldbuilding-lineages': [{ id: 'lin1', nome: 'Casa Vaugh' }],
    'worldbuilding-articles': [
        { id: 'a1', bookId: 'b1', order: 0, title: 'A Noite da Bigorna Fria', synopsis: 'Brida descobre quem comprou a dívida.', status: 'rascunho', public: false, contentHTML: '<p>um dois tres</p>' },
        { id: 'a2', bookId: 'b1', order: 1, title: 'O Recibo Falso', status: 'publicado', public: true, words: 900, contentHTML: '<p>quatro cinco</p>' },
        { id: 'a3', bookId: 'b1', order: 2, title: 'Ferro Nao Mente', status: 'rascunho', public: false, contentHTML: '' },
        { id: 'a9', bookId: null, title: 'Nota solta', status: 'rascunho', public: false, contentHTML: '' },
    ],
};

/* Docs avulsos, por caminho. Guardam de verdade: o historico de versao e a
   lixeira fazem ler-alterar-gravar, e um duble que so anota o write faria o
   teste passar com uma lista que nunca cresce. */
const DOCS = {
    'worldbuilding-settings/estantes': { lista: [{ id: 'e1', nome: 'Regras do sistema', icone: '📐' }, { id: 'e2', nome: 'Contos', icone: '📜' }] },
};

export const db = { _fake: true };
export const collection = (_db, nome) => ({ nome });
export const doc = (_db, nome, id) => ({ nome, id });
export const getDocs = async (c) => ({ docs: (DADOS[c.nome] || []).map(d => ({ id: d.id, data: () => ({ ...d }) })) });
export const getDoc = async (d) => {
    /* Cai na COLECAO quando nao ha doc avulso: no Firestore de verdade
       `getDoc(users/u1)` acha o mesmo doc que `getDocs(users)` lista. O
       duble so olhava os avulsos, e por isso todo `users/{uid}` voltava
       "nao existe" — o aviso de versao saia com zero enviados e o teste
       acusava um bug que era do duble. */
    const avulso = DOCS[`${d.nome}/${d.id}`];
    const naColecao = (DADOS[d.nome] || []).find(x => x.id === d.id);
    const v = avulso || (naColecao ? { ...naColecao } : null);
    return { exists: () => !!v, data: () => v };
};
export const setDoc = async (d, data, opts) => {
    GRAVADO.push({ col: d.nome, id: d.id, data, merge: !!(opts && opts.merge) });
    const chave = `${d.nome}/${d.id}`;
    DOCS[chave] = opts && opts.merge ? { ...(DOCS[chave] || {}), ...data } : { ...data };
    const col = DADOS[d.nome];
    if (col) {
        const i = col.findIndex(x => x.id === d.id);
        if (i > -1) col[i] = { ...(opts && opts.merge ? col[i] : {}), ...data, id: d.id };
        else col.push({ ...data, id: d.id });
    }
};
export const deleteDoc = async (d) => {
    GRAVADO.push({ col: d.nome, id: d.id, apagado: true });
    delete DOCS[`${d.nome}/${d.id}`];
    const col = DADOS[d.nome];
    if (col) { const i = col.findIndex(x => x.id === d.id); if (i > -1) col.splice(i, 1); }
};
/* Os outros modulos do Worldbuilding (calendario, mural, grafos...) tambem
   importam daqui — o duble precisa exportar a superficie inteira, senao o
   import do wb-main.js estoura antes de qualquer teste rodar. */
export const updateDoc = (d, data) => setDoc(d, data, { merge: true });
export const addDoc = async (c, data) => {
    const id = 'novo_' + ((DADOS[c.nome] || []).length + 1);
    await setDoc({ nome: c.nome, id }, data);
    return { id };
};
export const storage = null;
export const ref = () => null;
export const uploadBytes = async () => null;
export const getDownloadURL = async () => '';
