/* ===== DADOS E CONSTANTES ===== */

const SKILLS = {
    mental: [{ key: 'abismo', name: 'Abismo', sub: 'PRS' }, { key: 'alquimia', name: 'Alquimia', sub: 'RAC' }, { key: 'essencia', name: 'Fluxomancia', sub: 'INT/RAC/PRS' }, { key: 'herbalismo', name: 'Herbalismo', sub: 'INT/PRS' }, { key: 'historia', name: 'História', sub: 'INT' }, { key: 'investigacao', name: 'Investigação', sub: 'RAC/INT' }, { key: 'medicina', name: 'Medicina', sub: 'INT/RAC' }, { key: 'oficio_int', name: 'Ofício Intel.', sub: '—' }, { key: 'reliquia', name: 'Relíquia', sub: 'INT' }, { key: 'runomancia', name: 'Runomancia', sub: 'INT/RAC' }],
    fisico: [{ key: 'agilidade', name: 'Agilidade', sub: 'DES' }, { key: 'arma', name: 'Arma', sub: 'FOR/DES' }, { key: 'arremessar', name: 'Arremessar', sub: 'FOR/DES' }, { key: 'atletismo', name: 'Atletismo', sub: 'VIG' }, { key: 'briga', name: 'Briga', sub: 'FOR' }, { key: 'disparo', name: 'Disparo', sub: 'DES' }, { key: 'furtividade', name: 'Furtividade', sub: 'DES' }, { key: 'montaria', name: 'Montaria', sub: 'DES' }, { key: 'oficio_brac', name: 'Ofício Braç.', sub: '—' }, { key: 'sobrevivencia', name: 'Sobrevivência', sub: 'VIG' }],
    social: [{ key: 'barganha', name: 'Barganha', sub: 'MAN' }, { key: 'diplomacia', name: 'Diplomacia', sub: 'MAN' }, { key: 'domar', name: 'Domar', sub: 'AUT' }, { key: 'empatia', name: 'Empatia', sub: 'AUT' }, { key: 'intimidacao', name: 'Intimidação', sub: 'PRE' }, { key: 'lideranca', name: 'Liderança', sub: 'PRE' }, { key: 'malandragem', name: 'Malandragem', sub: 'AUT' }, { key: 'performance', name: 'Performance', sub: 'PRE/MAN' }, { key: 'seducao', name: 'Sedução', sub: 'PRE/MAN' }, { key: 'observacao', name: 'Observação', sub: 'PRE' }],
    combate: [{ key: 'esquiva', name: 'Esquiva', sub: 'DES' }, { key: 'aparar', name: 'Aparar', sub: 'DES/FOR' }, { key: 'bloquear', name: 'Bloquear', sub: 'FOR' }, { key: 'desviar', name: 'Desviar', sub: 'DES' }, { key: 'evadir', name: 'Evadir', sub: 'DES' }, { key: 'cobertura', name: 'Cobertura', sub: 'RAC' }, { key: 'proteger', name: 'Proteger', sub: 'VIG' }, { key: 'reflexo', name: 'Reflexo', sub: 'RAC/DES' }, { key: 'contra_ataque', name: 'Contra-Ataq.', sub: 'DES' }, { key: 'ambidestria', name: 'Ambidestria', sub: 'DES' }]
};

const CLASS_SKILLS = {
    'Guerreiro': ['Postura de Combate', 'Ímpeto', 'Guerrilha', 'Controle'],
    'Ladino': ['Precisão', 'Arrombamento', 'Prestidigitação', 'Submundo', 'Subterfúgio'],
    'Caçador': ['Erudição Ofensiva', 'Maceração', 'Dosagem', 'Precisão', 'Marcar Presa'],
    'Adepto': ['Contato c/ o Sétimo', 'Selo do Profano', 'Servos', 'Sacrifício', 'Fragmento de Identidade'],
    'Invocador': ['Contato c/ o Oitavo', 'Selo Abissal', 'Sacrifício'],
    'Druida': ['Erudição Ofensiva', 'Erudição Defensiva', 'Maceração', 'Dosagem', 'Aliado Animal', 'Linguagem Animal'],
    'Pallacerdote': ['Símbolo Sagrado', 'Devoção em Palla'],
    'Runimago': ['Gravação Rúnica', 'Mentalização', 'Erudição Rúnica', 'Diagnóstico'],
    'Sangral': ['Manip. de Sangue', 'Solidif. Hemática', 'Empatia Sanguínea'],
    'Xamã': ['Totemismo', 'Comunhão c/ Ecos', 'Transcendência', 'Exorcismo', 'Visão do Véu'],
    'Bardo': ['Composição', 'Afinação Essencial', 'Presença Sonoral', 'Contracanto', 'Leitura de Público'],
};

const CLASS_RESOURCES = {
    'Guerreiro': [], 'Ladino': [],
    'Caçador': [],
    'Druida': [],
    'Adepto': [{ label: '⚰️ Servos', keys: ['cr_servos_atual', 'cr_servos_max'] }, { label: '🎭 Fantoches', keys: ['cr_fant_atual', 'cr_fant_max'] }],
    'Invocador': [{ label: '🌀 CA', keys: ['cr_ca'], single: true }, { label: '⚡ RV', keys: ['cr_rv_atual', 'cr_rv_max'] }],
    'Pallacerdote': [{ label: '🌟 Círculo', keys: ['cr_circulo'], single: true, placeholder: 'Ex: Diácono da Luz' }, { label: '💎 Graça', keys: ['cr_graca_atual', 'cr_graca_max'] }],
    'Runimago': [], 'Sangral': [{ label: '🩸 Bolha Sang.', keys: ['cr_bolha_atual', 'cr_bolha_max'] }],
    'Xamã': [{ label: '🪶 Totens Ativos', keys: ['cr_totens_atual', 'cr_totens_max'] }],
    'Bardo': [{ label: '🎵 Dissonância', keys: ['cr_dissonancia'], single: true }],
};

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
