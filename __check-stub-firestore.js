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
        { id: 'a2', bookId: 'b1', order: 1, title: 'O Recibo Falso', status: 'publicado', public: true, contentHTML: '<p>quatro cinco</p>' },
        { id: 'a3', bookId: 'b1', order: 2, title: 'Ferro Nao Mente', status: 'rascunho', public: false, contentHTML: '' },
        { id: 'a9', bookId: null, title: 'Nota solta', status: 'rascunho', public: false, contentHTML: '' },
    ],
};

export const db = { _fake: true };
export const collection = (_db, nome) => ({ nome });
export const doc = (_db, nome, id) => ({ nome, id });
export const getDocs = async (c) => ({ docs: (DADOS[c.nome] || []).map(d => ({ id: d.id, data: () => ({ ...d }) })) });
export const getDoc = async (d) => {
    const lista = d.nome === 'worldbuilding-settings' && d.id === 'estantes'
        ? { lista: [{ id: 'e1', nome: 'Regras do sistema', icone: '📐' }, { id: 'e2', nome: 'Contos', icone: '📜' }] }
        : null;
    return { exists: () => !!lista, data: () => lista };
};
export const setDoc = async (d, data, opts) => { GRAVADO.push({ col: d.nome, id: d.id, data, merge: !!(opts && opts.merge) }); };
export const deleteDoc = async (d) => { GRAVADO.push({ col: d.nome, id: d.id, apagado: true }); };
export const storage = null;
export const ref = () => null;
export const uploadBytes = async () => null;
export const getDownloadURL = async () => '';
