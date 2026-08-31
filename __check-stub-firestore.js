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
    const v = DOCS[`${d.nome}/${d.id}`] || null;
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
export const storage = null;
export const ref = () => null;
export const uploadBytes = async () => null;
export const getDownloadURL = async () => '';
