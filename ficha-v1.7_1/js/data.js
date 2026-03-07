/* ===== DADOS E CONSTANTES ===== */

/* SKILLS agora vêm do Firebase (system-data-loader.js → buildSkillsFromFirebase())
   Inicializado como objeto vazio em window.SKILLS */
window.SKILLS = {
    mental: [],
    fisico: [],
    social: [],
    combate: [],
    exclusivo: []
};

/* CLASS_SKILLS e CLASS_RESOURCES agora vêm do Firebase (system-data-loader.js)
   Inicializados como {} em window.CLASS_SKILLS / window.CLASS_RESOURCES */

/* ===== RUNIMAGO DATA ===== */
const ARTUS = [
    { key: 'artus_criar', name: 'Criar', desc: 'Trazer à existência' },
    { key: 'artus_destruir', name: 'Destruir', desc: 'Desfazer, dissipar' },
    { key: 'artus_entender', name: 'Entender', desc: 'Perceber, analisar' },
    { key: 'artus_modificar', name: 'Modificar', desc: 'Alterar propriedades' },
    { key: 'artus_controlar', name: 'Controlar', desc: 'Direcionar, mover' }
];
const ASPECTUS = [
    { key: 'asp_temporal', name: 'Temporal' }, { key: 'asp_necrotico', name: 'Necrótico' },
    { key: 'asp_espacial', name: 'Espacial' }, { key: 'asp_poder', name: 'Poder' },
    { key: 'asp_natureza', name: 'Natureza' }, { key: 'asp_cristal', name: 'Cristal' },
    { key: 'asp_abissal', name: 'Abissal' }, { key: 'asp_vento', name: 'Vento' },
    { key: 'asp_agua', name: 'Água' }, { key: 'asp_fogo', name: 'Fogo' },
    { key: 'asp_terra', name: 'Terra' }, { key: 'asp_luz', name: 'Luz' },
    { key: 'asp_vida', name: 'Vida' }, { key: 'asp_sangue', name: 'Sangue' }
];
const SIGILUS_CATS = ['Captador', 'Condutor', 'Modulador', 'Lógico', 'Armazenador', 'Emissor'];
const RUNA_COMP_CATS = ['Captador', 'Condutor', 'Modulador', 'Lógico', 'Armazenador', 'Emissor', 'Artus', 'Aspectus'];
