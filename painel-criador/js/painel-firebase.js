// =============================================
// PAINEL DE CRIADOR — Firebase + Auth + CRUD Engine
// Lendas e Relíquias (ficha-v1.7_1 style)
// =============================================

import { openMechanicEditor, renderMechanicCard, generatePreviewText, buildMechanicSelectorHTML, buildPecSelectorHTML, buildSkillSelectorHTML, buildDerivedValueSelectorHTML, buildSpecSelectorHTML, buildManeuverSelectorHTML, buildSpecLimiterHTML, FONTE_LABELS, TIPO_ICONS, TIPO_LABELS } from './painel-mechanics.js';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    getFirestore, collection, query, where, getDocs, getDoc, setDoc,
    deleteDoc, updateDoc, doc, orderBy, Timestamp, addDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// ===== CONFIG =====
const firebaseConfig = {
    apiKey: "AIzaSyA6r79XcsMr3KZUT1YZ8vQntIGspgULXcE",
    authDomain: "rpg-lendasereliquias.firebaseapp.com",
    projectId: "rpg-lendasereliquias",
    storageBucket: "rpg-lendasereliquias.firebasestorage.app",
    messagingSenderId: "546994339773",
    appId: "1:546994339773:web:0116cf7c8667f113075cd4"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentModule = 'races';
let allItems = [];
let itemToDelete = null;
let editingItemId = null;
let mechanicsCache = [];
let peculiaritiesCache = [];
let skillsCache = [];
let derivedValuesCache = [];
let vitalStatsCache = [];
let specsCache = [];
let aurasCache = [];
let maneuversCache = [];

// ====================================================================
// MODULE DEFINITIONS — each module defines its fields and Firestore path
// ====================================================================
const MODULE_DEFS = {
    races: {
        name: 'Raça', namePlural: 'Raças', icon: '🧬',
        collection: 'system/data/races',
        fields: [
            { key: 'nome', label: 'Nome', type: 'text', required: true, placeholder: 'Ex: Humano, Elorin, Karu-Selvagem' },
            { key: 'subtitulo', label: 'Subtítulo / Epíteto', type: 'text', placeholder: 'Ex: Sem Essência — Os Ungidos' },
            { key: 'expectativaVida', label: 'Expectativa de Vida', type: 'text', required: true, placeholder: 'Ex: 80 anos' },
            { key: 'tendencia', label: 'Tendência', type: 'text', required: true, placeholder: 'Ex: Ambiciosos — Adaptáveis' },
            { key: 'aparencia', label: 'Aparência', type: 'textarea', required: true, placeholder: 'Descrição física típica da raça' },
            { key: 'habitat', label: 'Habitat', type: 'text', required: true, placeholder: 'Ex: Regiões temperadas, cidades' },
            { key: 'peculiaridadeIds', label: 'Peculiaridades Raciais', type: 'mechanic_selector', selectorTarget: 'peculiarities', fontePreFilter: 'raca' },
            { key: 'derivedValueIds', label: 'Valores Derivados da Raça', type: 'mechanic_selector', selectorTarget: 'derivedValues' },
            { key: 'historia', label: 'História / Lore', type: 'textarea', placeholder: 'Lore da raça em Vasteluna' },
            { key: 'curiosidades', label: 'Curiosidades', type: 'tags', placeholder: 'Digite e pressione Enter' },
            { key: 'imagemUrl', label: 'URL da Imagem', type: 'text', placeholder: 'https://...' },
            { key: 'ordem', label: 'Ordem no Select', type: 'number', placeholder: '0' },
        ]
    },
    classes: {
        name: 'Classe', namePlural: 'Classes', icon: '⚔️',
        collection: 'system/data/classes',
        fields: [
            { key: 'nome', label: 'Nome', type: 'text', required: true, placeholder: 'Ex: Guerreiro, Ladino' },
            { key: 'arquetipo', label: 'Arquétipo', type: 'text', required: true, placeholder: 'Ex: Combate Direto' },
            { key: 'especialidade', label: 'Especialidade', type: 'text', required: true, placeholder: 'Resumo da especialidade' },
            { key: 'descricao', label: 'Descrição', type: 'textarea', required: true },
            { key: 'citacao', label: 'Citação Icônica', type: 'text', placeholder: 'Frase emblemática da classe' },
            { key: 'bonusIniciais', label: 'Bônus Iniciais', type: 'mechanic_selector', selectorTarget: 'peculiarities', fontePreFilter: 'classe' },
            {
                key: 'papelEmCena', label: 'Papel em Cena', type: 'array', arrayFields: [
                    { key: 'combate', label: 'Em Combate', type: 'textarea' },
                    { key: 'foraCombate', label: 'Fora de Combate', type: 'textarea' }
                ], maxItems: 1
            },
            {
                key: 'recursosDaClasse', label: 'Recursos da Classe', type: 'array', arrayFields: [
                    { key: 'primario', label: 'Recurso Primário', type: 'text' },
                    { key: 'secundario', label: 'Recurso Secundário', type: 'text' },
                    { key: 'risco', label: 'Recurso de Risco', type: 'text' }
                ], maxItems: 1
            },
            { key: 'pericClasse', label: 'Perícias de Classe', type: 'mechanic_selector', selectorTarget: 'skills' },
            { key: 'especDaClasse', label: 'Especializações da Classe', type: 'mechanic_selector', selectorTarget: 'specializations' },
            { key: 'manobras', label: '💥 Manobras da Classe', type: 'mechanic_selector', selectorTarget: 'maneuvers' },
            { key: 'mecanicaIds', label: 'Mecânicas da Classe', type: 'mechanic_selector', fontePreFilter: 'classe' },
            { key: 'derivedValueIds', label: 'Valores Derivados da Classe', type: 'mechanic_selector', selectorTarget: 'derivedValues' },
            { key: 'testesDeClasse', label: '🎯 Testes de Classe (Rolagens)', type: 'class_tests_editor' },
            { key: 'modulosDaClasse', label: '📦 Módulos da Classe', type: 'class_modules_editor' },
            { key: 'imagemUrl', label: 'URL da Imagem', type: 'text', placeholder: 'https://...' },
        ]
    },
    tribes: {
        name: 'Tribo', namePlural: 'Tribos', icon: '🏕️',
        collection: 'system/data/tribes',
        fields: [
            { key: 'nome', label: 'Nome', type: 'text', required: true, placeholder: 'Ex: Comuno, Famo, Pogtara' },
            { key: 'lema', label: 'Lema / Citação', type: 'text', placeholder: 'Lema da tribo' },
            { key: 'descricao', label: 'Descrição', type: 'textarea', required: true },
            { key: 'peculiaridadeIds', label: '✨ Peculiaridades da Tribo', type: 'mechanic_selector', selectorTarget: 'peculiarities', fontePreFilter: 'tribo' },
            {
                key: 'pericias', label: 'Perícias Tribais', type: 'array', arrayFields: [
                    { key: 'nome', label: 'Perícia', type: 'text', required: true },
                    { key: 'nivel', label: 'Nível', type: 'number' },
                    { key: 'opcao', label: 'Opção alternativa', type: 'text' }
                ]
            },
            { key: 'cultura', label: 'Cultura e Costumes', type: 'textarea', required: true },
            { key: 'governo', label: 'Governo', type: 'textarea', required: true },
            { key: 'economia', label: 'Economia', type: 'textarea', required: true },
            { key: 'militar', label: 'Estrutura Militar', type: 'textarea', required: true },
            {
                key: 'unidadesMilitares', label: 'Unidades Militares', type: 'array', arrayFields: [
                    { key: 'nome', label: 'Unidade', type: 'text', required: true },
                    { key: 'descricao', label: 'Descrição', type: 'textarea' },
                    { key: 'funcao', label: 'Função', type: 'text' }
                ]
            },
            { key: 'imagemUrl', label: 'URL da Imagem', type: 'text', placeholder: 'https://...' },
        ]
    },
    peculiarities: {
        name: 'Peculiaridade', namePlural: 'Peculiaridades', icon: '✨',
        collection: 'system/data/peculiarities',
        fields: [
            { key: 'nome', label: 'Nome', type: 'text', required: true, placeholder: 'Ex: Aprendizado Acelerado IV' },
            {
                key: 'fonte', label: 'Fonte', type: 'select', required: true, options: [
                    { value: 'raca', label: 'Raça' },
                    { value: 'classe', label: 'Classe' },
                    { value: 'tribo', label: 'Tribo' },
                    { value: 'condicao', label: 'Condição' },
                    { value: 'individual', label: 'Individual' },
                    { value: 'generica', label: 'Genérica' }
                ]
            },
            { key: 'descricao', label: 'Descrição', type: 'textarea', required: true },
            {
                key: 'quandoSeAplica', label: 'Quando se Aplica', type: 'select', options: [
                    { value: 'passivo', label: 'Passivo' },
                    { value: 'na_criacao', label: 'Na criação' }
                ], defaultValue: 'passivo'
            },
            { key: 'ehVantagem', label: '🟢 É Vantagem? (custar EXP)', type: 'boolean', showWhen: { field: 'quandoSeAplica', value: 'na_criacao' } },
            { key: 'mecanicaExpCriacao', label: '⭐ Mecânica de Modificar EXP (aplicada na criação)', type: 'mechanic_selector', showWhen: { field: 'quandoSeAplica', value: 'na_criacao' } },
            { key: 'fonteRef', label: '(ID)', type: 'text', placeholder: 'ID do registro de origem' },
            { key: 'concedeAura', label: 'Concede Aura?', type: 'boolean' },
            { key: 'auraVinculadaId', label: '🌟 Aura Vinculada', type: 'aura_selector', showWhenBoolean: 'concedeAura' },
            { key: 'auraGrauConcedido', label: 'Grau Concedido da Aura', type: 'number', placeholder: '1', showWhenBoolean: 'concedeAura' },
            { key: 'mecanicaIds', label: 'Mecânicas Vinculadas', type: 'mechanic_selector', fontePreFilter: '' },
            { key: 'tags', label: 'Tags', type: 'tags', placeholder: 'Ex: bônus, racial' },
        ]
    },
    specializations: {
        name: 'Especialização', namePlural: 'Especializações', icon: '🎯',
        collection: 'system/data/specializations',
        fields: [
            { key: 'nome', label: 'Nome', type: 'text', required: true, placeholder: 'Ex: Espadas, Armaduras Leves' },
            {
                key: 'categoria', label: 'Categoria', type: 'select', required: true, options: [
                    { value: 'mental', label: 'Mental' },
                    { value: 'fisico', label: 'Físico' },
                    { value: 'social', label: 'Social' },
                    { value: 'combate', label: 'Combate' },
                    { value: 'exclusivo', label: 'Exclusivo' }
                ]
            },
            { key: 'descricao', label: 'Descrição', type: 'textarea', placeholder: 'Descreva a especialização' },
            { key: 'limitadores', label: 'Limitadores de Upgrade (Atributos e Perícias)', type: 'spec_limiter' },
            { key: 'custoEvolucao', label: 'Custo de Evolução (EXP por nível)', type: 'number', placeholder: '2' },
            { key: 'todoPersonagem', label: 'Todo personagem tem esta especialização?', type: 'boolean' },
            { key: 'mecanicaIds', label: 'Mecânicas Vinculadas', type: 'mechanic_selector', fontePreFilter: '' },
            { key: 'exemplos', label: 'Exemplos de Itens', type: 'tags', placeholder: 'Ex: Espada Curta, Espada Longa' },
        ]
    },
    skills: {
        name: 'Perícia', namePlural: 'Perícias', icon: '📚',
        collection: 'system/data/skills',
        fields: [
            { key: 'nome', label: 'Nome', type: 'text', required: true, placeholder: 'Ex: Furtividade, Diplomacia' },
            {
                key: 'categoria', label: 'Categoria', type: 'select', required: true, options: [
                    { value: 'mental', label: 'Mental' },
                    { value: 'fisico', label: 'Físico' },
                    { value: 'social', label: 'Social' },
                    { value: 'combate', label: 'Combate' },
                    { value: 'exclusivo', label: 'Exclusivo' }
                ]
            },
            {
                key: 'atributoBase', label: 'Atributo Base', type: 'multi_select', required: true, options: [
                    { value: 'FOR', label: 'FOR — Força' },
                    { value: 'DES', label: 'DES — Destreza' },
                    { value: 'VIG', label: 'VIG — Vigor' },
                    { value: 'INT', label: 'INT — Inteligência' },
                    { value: 'RAC', label: 'RAC — Raciocínio' },
                    { value: 'PRS', label: 'PRS — Perseverança' },
                    { value: 'PRE', label: 'PRE — Presença' },
                    { value: 'MAN', label: 'MAN — Manipulação' },
                    { value: 'AUT', label: 'AUT — Autocontrole' }
                ]
            },
            { key: 'descricao', label: 'Descrição', type: 'textarea', required: true },
            { key: 'custoEvolucao', label: 'Custo de Evolução (EXP por nível)', type: 'number', placeholder: '4' },
            { key: 'todoPersonagem', label: 'Todo personagem tem esta perícia?', type: 'boolean' },
            { key: 'mecanicaIds', label: 'Mecânicas Vinculadas', type: 'mechanic_selector', fontePreFilter: '' },
        ]
    },
    equipment: {
        name: 'Equipamento', namePlural: 'Equipamentos', icon: '🗡️',
        collection: 'system/data/equipment',
        fields: [
            { key: 'nome', label: 'Nome', type: 'text', required: true, placeholder: 'Ex: Espada Longa, Cota de Malha' },
            {
                key: 'tipo', label: 'Tipo', type: 'select', required: true, options: [
                    { value: 'arma', label: 'Arma' },
                    { value: 'armadura', label: 'Armadura' },
                    { value: 'escudo', label: 'Escudo' },
                    { value: 'consumivel', label: 'Consumível' },
                    { value: 'geral', label: 'Geral' },
                    { value: 'reliquia', label: 'Relíquia' }
                ]
            },
            { key: 'subtipo', label: 'Subtipo', type: 'text', placeholder: 'Ex: Uma Mão, Pesada' },
            { key: 'tier', label: 'Tier', type: 'number', required: true, placeholder: '0-5' },
            { key: 'danoBase', label: 'Dano Base', type: 'text', placeholder: 'Ex: FOR + Arma + Espec.' },
            { key: 'blindagem', label: 'Blindagem', type: 'number', placeholder: '0' },
            { key: 'peso', label: 'Peso', type: 'number', required: true, placeholder: '1' },
            { key: 'dureza', label: 'Dureza', type: 'number', placeholder: '5' },
            { key: 'integridade', label: 'Integridade', type: 'number', placeholder: '10' },
            { key: 'alcance', label: 'Alcance', type: 'text', placeholder: 'Para armas de distância' },
            { key: 'penalidades', label: 'Penalidades', type: 'text', placeholder: 'Ex: -2 Furtividade' },
            { key: 'propriedades', label: 'Propriedades', type: 'tags', placeholder: 'Ex: Versátil, Pesado' },
            { key: 'preco', label: 'Preço (Luns)', type: 'number', placeholder: '100' },
            { key: 'descricao', label: 'Descrição', type: 'textarea', required: true },
            { key: 'mecanicaIds', label: 'Mecânicas Especiais', type: 'mechanic_selector', fontePreFilter: 'item' },
        ]
    },
    conditions: {
        name: 'Condição', namePlural: 'Condições', icon: '💀',
        collection: 'system/data/conditions',
        fields: [
            { key: 'nome', label: 'Nome', type: 'text', required: true, placeholder: 'Ex: Atordoado, Cego' },
            { key: 'descricao', label: 'Descrição', type: 'textarea', required: true },
            { key: 'efeitoMecanicaIds', label: 'Efeitos Mecânicos', type: 'mechanic_selector', fontePreFilter: 'condicao' },
            { key: 'duracao', label: 'Duração', type: 'text', placeholder: 'Ex: 1 turno, permanente' },
            { key: 'removivel', label: 'Removível?', type: 'boolean' },
            { key: 'icone', label: 'Ícone / Emoji', type: 'text', placeholder: 'Ex: 💫' },
        ]
    },
    mechanics: {
        name: 'Mecânica', namePlural: 'Mecânicas', icon: '🔧',
        collection: 'system/data/mechanics',
        useCustomEditor: true,
        fields: []
    },
    derivedValues: {
        name: 'Valor Derivado', namePlural: 'Valores Derivados', icon: '📊',
        collection: 'system/data/derivedValues',
        fields: [
            { key: 'nome', label: 'Nome', type: 'text', required: true, placeholder: 'Ex: Percepção, Iniciativa, Carga' },
            { key: 'ordem', label: 'Ordem na Ficha', type: 'number', required: true, placeholder: '1' },
            { key: 'icone', label: 'Ícone / Emoji', type: 'text', placeholder: 'Ex: 👁️, ⚡' },
            { key: 'prefixo', label: 'Prefixo (exibido antes do valor)', type: 'text', placeholder: 'Ex: +, ≥, ~' },
            { key: 'sufixo', label: 'Sufixo (exibido após o valor)', type: 'text', placeholder: 'Ex: metros, kg, %' },
            { key: 'descricao', label: 'Descrição', type: 'textarea', required: true, placeholder: 'Descreva o que este valor representa e como é calculado' },
            { key: 'todoPersonagem', label: 'Todo personagem tem este valor?', type: 'boolean' },
            { key: 'mecanicaIds', label: 'Mecânicas Vinculadas', type: 'mechanic_selector', fontePreFilter: '' },
            { key: 'campoAtual', label: 'Tem campo "Atual" (editável)?', type: 'boolean' },
            { key: 'campoEditavel', label: 'Campo editável pelo jogador?', type: 'boolean' },
        ]
    },
    vitalStats: {
        name: 'Status Vital', namePlural: 'Status Vitais', icon: '❤️',
        collection: 'system/data/vitalStats',
        fields: [
            { key: 'nome', label: 'Nome', type: 'text', required: true, placeholder: 'Ex: Vitalidade, Sanidade, Energia' },
            { key: 'chaveInterna', label: 'Campo na Ficha', type: 'select', required: true, options: [
                { value: 'VIT_MAX', label: '❤️ Vitalidade (vit_atual / vit_max)' },
                { value: 'SAN_MAX', label: '🧠 Sanidade (san_atual / san_max)' },
                { value: 'ENER_MAX', label: '⚡ Energia (ener_atual / ener_max)' },
            ] },
            { key: 'ordem', label: 'Ordem na Ficha', type: 'number', required: true, placeholder: '1' },
            { key: 'icone', label: 'Ícone / Emoji', type: 'text', placeholder: 'Ex: ❤️, 🧠, ⚡' },
            { key: 'descricao', label: 'Descrição', type: 'textarea', required: true, placeholder: 'Descreva o que este status vital representa e como é calculado' },
            { key: 'mecanicaIds', label: 'Mecânicas Vinculadas (definem a fórmula)', type: 'mechanic_selector', fontePreFilter: '' },
        ]
    },
    maneuvers: {
        name: 'Manobra', namePlural: 'Manobras', icon: '💥',
        collection: 'system/data/maneuvers',
        fields: [
            { key: 'nome', label: 'Nome', type: 'text', required: true, placeholder: 'Ex: Postura Ofensiva, Investida' },
            { key: 'classe', label: 'Classe', type: 'text', required: true, placeholder: 'Ex: Guerreiro' },
            { key: 'custo', label: 'Custo (Energia)', type: 'text', required: true, placeholder: 'Ex: 1 ENER' },
            { key: 'efeito', label: 'Efeito', type: 'textarea', required: true },
            { key: 'requisitos', label: 'Requisitos', type: 'tags', placeholder: 'Ex: RAC 3, Performance 3' },
            { key: 'mecanicaIds', label: 'Mecânicas', type: 'mechanic_selector', fontePreFilter: 'manobra' },
            { key: 'falhaCritica', label: 'Falha Crítica', type: 'text', placeholder: 'O que acontece em Falha Crítica' },
        ]
    },
    spells: {
        name: 'Magia', namePlural: 'Magias', icon: '🔮',
        collection: 'system/data/spells',
        fields: [
            { key: 'nome', label: 'Nome', type: 'text', required: true, placeholder: 'Nome da magia' },
            {
                key: 'escola', label: 'Escola Mágica', type: 'select', required: true, options: [
                    { value: 'pallomancia', label: 'Pallomancia' }, { value: 'necromancia', label: 'Necromancia' },
                    { value: 'runomancia', label: 'Runomancia' }, { value: 'sonoromancia', label: 'Sonoromancia' },
                    { value: 'hemomancia', label: 'Hemomancia' }, { value: 'geomancia', label: 'Geomancia' },
                    { value: 'cronomancia', label: 'Cronomancia' }, { value: 'piromancia', label: 'Piromancia' },
                    { value: 'hidromancia', label: 'Hidromancia' }, { value: 'aeromancia', label: 'Aeromancia' },
                    { value: 'outra', label: 'Outra' }
                ]
            },
            { key: 'nivel', label: 'Nível', type: 'number', required: true, placeholder: '1' },
            { key: 'custo', label: 'Custo', type: 'text', required: true, placeholder: 'Ex: 1 ENER + Devoção' },
            { key: 'tempo', label: 'Tempo de Conjuração', type: 'text', required: true, placeholder: 'Ex: 1 ação' },
            { key: 'alcance', label: 'Alcance', type: 'text', required: true, placeholder: 'Ex: Toque, 9m' },
            { key: 'duracao', label: 'Duração', type: 'text', required: true, placeholder: 'Ex: Instantâneo, 1 cena' },
            { key: 'descricao', label: 'Descrição', type: 'textarea', required: true },
            { key: 'mecanicaIds', label: 'Mecânicas', type: 'mechanic_selector', fontePreFilter: 'magia' },
            { key: 'classeRequerida', label: 'Classe Requerida', type: 'text', placeholder: 'Ex: Pallacerdote' },
        ]
    },
    auras: {
        name: 'Aura', namePlural: 'Auras', icon: '🌟',
        collection: 'system/data/auras',
        useCustomAuraEditor: true,
        fields: [
            { key: 'nome', label: 'Nome da Aura', type: 'text', required: true, placeholder: 'Ex: Aura de Força' },
            {
                key: 'tipo', label: 'Tipo de Aura', type: 'select', required: true, options: [
                    { value: 'propriedade', label: '📊 Propriedade (Atributo/Perícia/Especialização)' },
                    { value: 'mortalidade', label: '💀 Mortalidade' }
                ]
            },
            {
                key: 'propriedadeTipo', label: 'Tipo de Propriedade', type: 'select', options: [
                    { value: 'atributo', label: '💪 Atributo' },
                    { value: 'pericia', label: '📚 Perícia' },
                    { value: 'especializacao', label: '🎯 Especialização' }
                ], showWhen: { field: 'tipo', value: 'propriedade' }
            },
            { key: 'propriedadeVinculada', label: 'Propriedade Vinculada', type: 'aura_property_selector', showWhen: { field: 'tipo', value: 'propriedade' } },
            { key: 'graus', label: 'Graus da Aura', type: 'aura_graus_editor' },
        ]
    },
    lore: {
        name: 'Entrada de Lore', namePlural: 'Lore & Mundo', icon: '🌍',
        collection: 'system/data/lore',
        fields: [
            { key: 'titulo', label: 'Título', type: 'text', required: true, placeholder: 'Ex: A Grande Calamidade' },
            {
                key: 'categoria', label: 'Categoria', type: 'select', required: true, options: [
                    { value: 'historia', label: 'História' }, { value: 'geografia', label: 'Geografia' },
                    { value: 'religiao', label: 'Religião' }, { value: 'organizacao', label: 'Organização' },
                    { value: 'npc', label: 'NPC' }, { value: 'evento', label: 'Evento' }
                ]
            },
            { key: 'conteudo', label: 'Conteúdo', type: 'textarea', required: true, placeholder: 'Texto completo da entrada' },
            { key: 'imagemUrl', label: 'URL da Imagem', type: 'text', placeholder: 'https://...' },
            { key: 'referencias', label: 'Referências (IDs)', type: 'tags', placeholder: 'IDs de lore relacionados' },
        ]
    }
};

// ===== THEME =====
function initTheme() {
    const saved = localStorage.getItem('painel-theme');
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        updateThemeBtn();
    }
}
window.toggleTheme = function () {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('painel-theme', isDark ? 'dark' : 'light');
    updateThemeBtn();
};
function updateThemeBtn() {
    const btn = document.getElementById('btnThemeToggle');
    if (btn) btn.textContent = document.documentElement.classList.contains('dark') ? '☀️' : '🌙';
}
initTheme();

// ===== AUTH STATE =====
onAuthStateChanged(auth, async (user) => {
    const loadingScreen = document.getElementById('loadingScreen');
    const toolbar = document.querySelector('.toolbar');
    const wrap = document.querySelector('.wrap');

    if (!user) { window.location.href = '../index.html'; return; }

    currentUser = user;

    // Check role
    const userDoc = await findUserDoc(user);
    if (!userDoc || userDoc.data().role !== 'criador') {
        window.location.href = '../menu/menu.html';
        return;
    }

    // Show name
    const nameEl = document.getElementById('userDisplayName');
    if (nameEl) { nameEl.textContent = user.displayName || user.email; nameEl.title = user.email; }

    // Load initial module
    await loadModule(currentModule);

    if (loadingScreen) loadingScreen.style.display = 'none';
    if (toolbar) toolbar.style.display = '';
    if (wrap) wrap.style.display = '';
});

// ===== FIND USER DOC =====
async function findUserDoc(user) {
    const u = user || currentUser;
    if (!u) return null;

    let q = query(collection(db, 'users'), where('uid', '==', u.uid));
    let snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0];

    q = query(collection(db, 'users'), where('email', '==', u.email));
    snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0];

    try {
        const docRef = doc(db, 'users', u.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) return docSnap;
    } catch (e) { /* ignore */ }

    return null;
}

// ===== NAVIGATION =====
window.goToMenu = () => { window.location.href = '../menu/menu.html'; };
window.logout = async function () {
    if (confirm('🚪 Tem certeza que deseja sair?')) {
        try { await signOut(auth); window.location.href = '../index.html'; }
        catch (e) { showAlert('❌ Erro ao sair: ' + e.message, 'danger'); }
    }
};

// ===== MODULE SWITCHING =====
window.switchModule = function (moduleName, btnEl) {
    currentModule = moduleName;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    const modDef = MODULE_DEFS[moduleName];
    const titleEl = document.getElementById('createCardTitle');
    if (titleEl) titleEl.textContent = `Criar ${modDef.name}`;

    // Hide mechanics editor when switching away
    const mechArea = document.getElementById('mechanicsEditorArea');
    if (mechArea) mechArea.style.display = 'none';
    document.getElementById('moduleContent').style.display = '';

    // Remove/add mechanic extra filters
    const oldFilters = document.getElementById('mechFiltersExtra');
    if (oldFilters) oldFilters.remove();
    if (moduleName === 'mechanics') renderMechExtraFilters();

    // Remove/add skills extra filters
    const oldSkillFilters = document.getElementById('skillsFiltersExtra');
    if (oldSkillFilters) oldSkillFilters.remove();
    if (moduleName === 'skills') renderSkillsExtraFilters();

    // Remove/add specializations extra filters
    const oldSpecFilters = document.getElementById('specsFiltersExtra');
    if (oldSpecFilters) oldSpecFilters.remove();
    if (moduleName === 'specializations') renderSpecsExtraFilters();

    // Remove/add tag filter for modules that have tags
    const oldTagFilter = document.getElementById('tagFilterArea');
    if (oldTagFilter) oldTagFilter.remove();

    loadModule(moduleName);
};

function renderMechExtraFilters() {
    const filterBar = document.getElementById('filterBar');
    if (!filterBar || document.getElementById('mechFiltersExtra')) return;
    const div = document.createElement('div');
    div.className = 'mech-filters';
    div.id = 'mechFiltersExtra';
    div.innerHTML = `
        <select id="mechFilterFonte" onchange="filterItems()">
            <option value="">📌 Fonte: Todas</option>
            ${Object.entries(FONTE_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
        </select>
        <select id="mechFilterTipo" onchange="filterItems()">
            <option value="">🔧 Tipo: Todos</option>
            ${Object.entries(TIPO_LABELS).map(([k, v]) => `<option value="${k}">${TIPO_ICONS[k]} ${v}</option>`).join('')}
        </select>`;
    filterBar.after(div);
}

const SKILL_CATEGORIA_ORDER = ['fisico', 'mental', 'social', 'combate', 'exclusivo'];
const SKILL_CATEGORIA_LABELS = {
    fisico: '💪 Físico',
    mental: '🧠 Mental',
    social: '🗣️ Social',
    combate: '⚔️ Combate',
    exclusivo: '🌟 Exclusivo'
};

function renderSkillsExtraFilters() {
    const filterBar = document.getElementById('filterBar');
    if (!filterBar || document.getElementById('skillsFiltersExtra')) return;
    const div = document.createElement('div');
    div.className = 'mech-filters';
    div.id = 'skillsFiltersExtra';
    div.innerHTML = `
        <select id="skillFilterCategoria" onchange="filterItems()">
            <option value="">📂 Categoria: Todas</option>
            ${SKILL_CATEGORIA_ORDER.map(k => `<option value="${k}">${SKILL_CATEGORIA_LABELS[k]}</option>`).join('')}
        </select>
        <label style="display:flex;align-items:center;gap:6px;font-size:.78rem;font-weight:700;color:var(--muted);cursor:pointer;white-space:nowrap">
            <input type="checkbox" id="skillGroupByCategoria" onchange="filterItems()" checked
                style="width:16px;height:16px;accent-color:var(--primary);flex:none">
            Agrupar por Categoria
        </label>`;
    filterBar.after(div);
}

function renderSpecsExtraFilters() {
    const filterBar = document.getElementById('filterBar');
    if (!filterBar || document.getElementById('specsFiltersExtra')) return;
    const div = document.createElement('div');
    div.className = 'mech-filters';
    div.id = 'specsFiltersExtra';
    div.innerHTML = `
        <select id="specFilterCategoria" onchange="filterItems()">
            <option value="">📂 Categoria: Todas</option>
            ${SKILL_CATEGORIA_ORDER.map(k => `<option value="${k}">${SKILL_CATEGORIA_LABELS[k]}</option>`).join('')}
        </select>
        <label style="display:flex;align-items:center;gap:6px;font-size:.78rem;font-weight:700;color:var(--muted);cursor:pointer;white-space:nowrap">
            <input type="checkbox" id="specGroupByCategoria" onchange="filterItems()" checked
                style="width:16px;height:16px;accent-color:var(--primary);flex:none">
            Agrupar por Categoria
        </label>`;
    filterBar.after(div);
}

// Modules that support tag filtering
const TAG_MODULES = ['peculiarities', 'mechanics'];
const selectedTagsMap = {};  // per-module tag selections
function getSelectedTags() { return selectedTagsMap[currentModule] || (selectedTagsMap[currentModule] = new Set()); }

function renderTagFilter() {
    const old = document.getElementById('tagFilterArea');
    if (old) old.remove();
    if (!TAG_MODULES.includes(currentModule)) return;

    const allTags = new Set();
    allItems.forEach(item => {
        if (Array.isArray(item.tags)) item.tags.forEach(t => allTags.add(t));
    });
    if (allTags.size === 0) return;

    const selected = getSelectedTags();
    const sorted = [...allTags].sort((a, b) => a.localeCompare(b));
    const div = document.createElement('div');
    div.className = 'tag-filter-area';
    div.id = 'tagFilterArea';
    div.innerHTML = `<span class="tag-filter-label">🏷️ Tags:</span>` +
        sorted.map(t => {
            const active = selected.has(t) ? ' active' : '';
            return `<button class="tag-filter-chip${active}" data-tag="${escapeHtml(t)}" onclick="toggleTagFilter(this)">${escapeHtml(t)}</button>`;
        }).join('');

    // Insert after mechFiltersExtra if exists, otherwise after filterBar
    const mechFilters = document.getElementById('mechFiltersExtra');
    const filterBar = document.getElementById('filterBar');
    (mechFilters || filterBar).after(div);
}

window.toggleTagFilter = function (btn) {
    const tag = btn.dataset.tag;
    const selected = getSelectedTags();
    if (selected.has(tag)) {
        selected.delete(tag);
        btn.classList.remove('active');
    } else {
        selected.add(tag);
        btn.classList.add('active');
    }
    renderItems();
};

// ===== LOAD MODULE DATA =====
async function loadModule(moduleName) {
    const modDef = MODULE_DEFS[moduleName];
    if (!modDef) return;

    // Always refresh mechanics cache (needed for selectors in all modules)
    await refreshMechanicsCache();
    if (moduleName === 'races' || moduleName === 'classes' || moduleName === 'tribes') await refreshPeculiaritiesCache();
    if (moduleName === 'classes' || moduleName === 'mechanics' || moduleName === 'skills' || moduleName === 'specializations') await refreshSkillsCache();
    if (moduleName === 'races' || moduleName === 'classes' || moduleName === 'mechanics' || moduleName === 'derivedValues') await refreshDerivedValuesCache();
    if (moduleName === 'mechanics' || moduleName === 'vitalStats') await refreshVitalStatsCache();
    if (moduleName === 'classes' || moduleName === 'specializations') await refreshSpecsCache();
    if (moduleName === 'classes') await refreshManeuversCache();
    if (moduleName === 'auras') { await refreshSkillsCache(); await refreshSpecsCache(); }
    if (moduleName === 'peculiarities') await refreshAurasCache();

    const grid = document.getElementById('itemsGrid');
    const emptyState = document.getElementById('emptyState');
    grid.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted)">⏳ Carregando...</div>';
    emptyState.style.display = 'none';

    try {
        const colRef = collection(db, modDef.collection);
        const snapshot = await getDocs(colRef);
        allItems = [];
        snapshot.forEach(d => allItems.push({ id: d.id, ...d.data() }));

        // Sort by ordem or nome
        allItems.sort((a, b) => {
            if (a.ordem !== undefined && b.ordem !== undefined) return a.ordem - b.ordem;
            const nameA = (a.nome || a.titulo || '').toLowerCase();
            const nameB = (b.nome || b.titulo || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });

        // Render tag filter chips (preserve existing selections)
        renderTagFilter();

        renderItems();
    } catch (error) {
        console.error('Erro ao carregar módulo:', error);
        showAlert('❌ Erro ao carregar: ' + error.message, 'danger');
        grid.innerHTML = '';
    }
}

async function refreshMechanicsCache() {
    try {
        const snap = await getDocs(collection(db, 'system/data/mechanics'));
        mechanicsCache = [];
        snap.forEach(d => mechanicsCache.push({ id: d.id, ...d.data() }));
        mechanicsCache.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        window._mechCache = mechanicsCache;
    } catch (e) { console.error('Erro cache mecânicas:', e); }
}

async function refreshPeculiaritiesCache() {
    try {
        const snap = await getDocs(collection(db, 'system/data/peculiarities'));
        peculiaritiesCache = [];
        snap.forEach(d => peculiaritiesCache.push({ id: d.id, ...d.data() }));
        peculiaritiesCache.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    } catch (e) { console.error('Erro cache peculiaridades:', e); }
}

async function refreshSkillsCache() {
    try {
        const snap = await getDocs(collection(db, 'system/data/skills'));
        skillsCache = [];
        snap.forEach(d => skillsCache.push({ id: d.id, ...d.data() }));
        skillsCache.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        window._skillsCache = skillsCache;
    } catch (e) { console.error('Erro cache skills:', e); }
}

async function refreshDerivedValuesCache() {
    try {
        const snap = await getDocs(collection(db, 'system/data/derivedValues'));
        derivedValuesCache = [];
        snap.forEach(d => derivedValuesCache.push({ id: d.id, ...d.data() }));
        derivedValuesCache.sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
        window._derivedValuesCache = derivedValuesCache;
    } catch (e) { console.error('Erro cache derivedValues:', e); }
}

async function refreshVitalStatsCache() {
    try {
        const snap = await getDocs(collection(db, 'system/data/vitalStats'));
        vitalStatsCache = [];
        snap.forEach(d => vitalStatsCache.push({ id: d.id, ...d.data() }));
        vitalStatsCache.sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
        window._vitalStatsCache = vitalStatsCache;
    } catch (e) { console.error('Erro cache vitalStats:', e); }
}

async function refreshSpecsCache() {
    try {
        const snap = await getDocs(collection(db, 'system/data/specializations'));
        specsCache = [];
        snap.forEach(d => specsCache.push({ id: d.id, ...d.data() }));
        specsCache.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        window._specsCache = specsCache;
    } catch (e) { console.error('Erro cache specializations:', e); }
}

async function refreshAurasCache() {
    try {
        const snap = await getDocs(collection(db, 'system/data/auras'));
        aurasCache = [];
        snap.forEach(d => aurasCache.push({ id: d.id, ...d.data() }));
        aurasCache.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    } catch (e) { console.error('Erro cache auras:', e); }
}

async function refreshManeuversCache() {
    try {
        const snap = await getDocs(collection(db, 'system/data/maneuvers'));
        maneuversCache = [];
        snap.forEach(d => maneuversCache.push({ id: d.id, ...d.data() }));
        maneuversCache.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        window._maneuversCache = maneuversCache;
    } catch (e) { console.error('Erro cache maneuvers:', e); }
}

// ===== RENDER ITEMS =====
function buildItemCardHTML(item) {
    const name = escapeHtml(item.nome || item.titulo || 'Sem nome');
    const subtitle = item.subtitulo || item.arquetipo || item.categoria || item.escola || item.classe || '';
    const desc = item.descricao || item.conteudo || item.efeito || '';
    const isPublished = item.publicado === true;
    const badgeClass = isPublished ? 'badge-published' : 'badge-draft';
    const badgeText = isPublished ? '✅ Publicado' : '📝 Rascunho';
    const imageUrl = item.imagemUrl || '';

    return `
        <div class="item-card" onclick="openForm('${item.id}')">
            <div class="item-card-header">
                <div class="item-card-name">${name}</div>
                <span class="badge-status ${badgeClass}">${badgeText}</span>
            </div>
            ${subtitle ? `<div class="item-card-subtitle">${escapeHtml(subtitle)}</div>` : ''}
            ${imageUrl ? `<div class="item-card-image" style="margin-top:8px; border-radius:4px; overflow:hidden; height:150px; background:#000;"><img src="${escapeHtml(imageUrl)}" alt="Preview" style="width:100%; height:100%; object-fit:cover; object-position:top;"></div>` : ''}
            ${desc ? `<div class="item-card-desc">${escapeHtml(truncate(desc, 100))}</div>` : ''}
            <div class="item-card-footer">
                <div class="item-card-actions">
                    <button class="btn-edit" onclick="event.stopPropagation(); openForm('${item.id}')" title="Editar">✏️</button>
                    <button class="btn-edit" onclick="event.stopPropagation(); duplicateItem('${item.id}')" title="Duplicar" style="border-color:var(--warning);color:var(--warning)">📋</button>
                    <button class="btn-delete-card" onclick="event.stopPropagation(); openDeleteModal('${item.id}', '${escapeHtml(name).replace(/'/g, "\\'")}')" title="Excluir">🗑️</button>
                </div>
                <label onclick="event.stopPropagation()" style="display:flex;align-items:center;gap:6px;cursor:pointer">
                    <span style="font-size:.68rem;color:var(--muted);font-weight:700">PUB</span>
                    <div class="toggle-publish">
                        <input type="checkbox" ${isPublished ? 'checked' : ''} onchange="togglePublish('${item.id}', this.checked)">
                        <span class="toggle-slider"></span>
                    </div>
                </label>
            </div>
        </div>
    `;
}

function renderItems() {
    const grid = document.getElementById('itemsGrid');
    const emptyState = document.getElementById('emptyState');
    const searchVal = (document.getElementById('searchInput')?.value || '').toLowerCase();
    const onlyPublished = document.getElementById('filterPublished')?.checked || false;

    let filtered = allItems.filter(item => {
        const name = (item.nome || item.titulo || '').toLowerCase();
        if (searchVal && !name.includes(searchVal)) return false;
        if (onlyPublished && !item.publicado) return false;
        // Extra mechanic filters
        if (currentModule === 'mechanics') {
            const fonteF = document.getElementById('mechFilterFonte')?.value || '';
            const tipoF = document.getElementById('mechFilterTipo')?.value || '';
            if (fonteF && item.fonte !== fonteF) return false;
            if (tipoF && item.tipo !== tipoF) return false;
        }
        // Skills category filter
        if (currentModule === 'skills') {
            const catF = document.getElementById('skillFilterCategoria')?.value || '';
            if (catF && item.categoria !== catF) return false;
        }
        // Specializations category filter
        if (currentModule === 'specializations') {
            const catF = document.getElementById('specFilterCategoria')?.value || '';
            if (catF && item.categoria !== catF) return false;
        }
        // Tag filter
        const selTags = getSelectedTags();
        if (selTags.size > 0) {
            const itemTags = Array.isArray(item.tags) ? item.tags : [];
            if (!itemTags.some(t => selTags.has(t))) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    // Use custom card renderer for mechanics
    if (currentModule === 'mechanics') {
        grid.innerHTML = filtered.map(item => renderMechanicCard(item)).join('');
        return;
    }

    const modDef = MODULE_DEFS[currentModule];

    // Skills: group by category if checkbox is checked
    if (currentModule === 'skills' && document.getElementById('skillGroupByCategoria')?.checked) {
        const groups = {};
        SKILL_CATEGORIA_ORDER.forEach(k => { groups[k] = []; });
        filtered.forEach(item => {
            const cat = (item.categoria || 'mental').toLowerCase();
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(item);
        });

        let html = '';
        SKILL_CATEGORIA_ORDER.forEach(cat => {
            const items = groups[cat];
            if (!items || items.length === 0) return;
            html += `<div class="skills-category-header">${SKILL_CATEGORIA_LABELS[cat] || cat} <span class="skills-category-count">${items.length}</span></div>`;
            html += items.map(item => buildItemCardHTML(item)).join('');
        });
        grid.innerHTML = html;
        return;
    }

    // Specializations: group by category if checkbox is checked
    if (currentModule === 'specializations' && document.getElementById('specGroupByCategoria')?.checked) {
        const groups = {};
        SKILL_CATEGORIA_ORDER.forEach(k => { groups[k] = []; });
        filtered.forEach(item => {
            const cat = (item.categoria || 'combate').toLowerCase();
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(item);
        });

        let html = '';
        SKILL_CATEGORIA_ORDER.forEach(cat => {
            const items = groups[cat];
            if (!items || items.length === 0) return;
            html += `<div class="skills-category-header">${SKILL_CATEGORIA_LABELS[cat] || cat} <span class="skills-category-count">${items.length}</span></div>`;
            html += items.map(item => buildItemCardHTML(item)).join('');
        });
        grid.innerHTML = html;
        return;
    }

    grid.innerHTML = filtered.map(item => buildItemCardHTML(item)).join('');
}

window.filterItems = function () { renderItems(); };

// ===== TOGGLE PUBLISH =====
window.togglePublish = async function (itemId, value) {
    const modDef = MODULE_DEFS[currentModule];
    try {
        const docRef = doc(db, modDef.collection, itemId);
        await updateDoc(docRef, { publicado: value, atualizadoEm: Timestamp.now() });
        const item = allItems.find(i => i.id === itemId);
        if (item) item.publicado = value;
        renderItems();
        showAlert(value ? '✅ Publicado!' : '📝 Movido para rascunho', 'success');
    } catch (e) {
        console.error('Erro ao alterar publicação:', e);
        showAlert('❌ Erro: ' + e.message, 'danger');
    }
};

// ===== DELETE MODAL =====
window.openDeleteModal = function (id, name) {
    itemToDelete = id;
    document.getElementById('deleteItemName').textContent = name;
    document.getElementById('deleteModal').classList.add('active');
};
window.closeDeleteModal = function () {
    itemToDelete = null;
    document.getElementById('deleteModal').classList.remove('active');
};
window.confirmDelete = async function () {
    if (!itemToDelete) return;
    const modDef = MODULE_DEFS[currentModule];
    try {
        await deleteDoc(doc(db, modDef.collection, itemToDelete));
        showAlert('✅ Registro excluído!', 'success');
        closeDeleteModal();
        await loadModule(currentModule);
    } catch (e) {
        console.error('Erro ao excluir:', e);
        showAlert('❌ Erro ao excluir: ' + e.message, 'danger');
    }
};

// ===== FORM MODAL =====
window.openForm = function (itemId) {
    const modDef = MODULE_DEFS[currentModule];

    // Redirect to visual editor for mechanics
    if (modDef.useCustomEditor) {
        _openMechEditor(itemId);
        return;
    }

    // Aura uses standard form but with custom field types
    // (handled by buildField)

    editingItemId = itemId || null;
    const isEditing = !!itemId;
    const existingData = isEditing ? allItems.find(i => i.id === itemId) : null;

    document.getElementById('formTitle').textContent = isEditing
        ? `✏️ Editar ${modDef.name}` : `➕ Criar ${modDef.name}`;

    const container = document.getElementById('formFields');
    container.innerHTML = '';

    // Build form fields
    const formGrid = document.createElement('div');
    formGrid.className = 'form-grid';

    modDef.fields.forEach(field => {
        let value = existingData ? existingData[field.key] : undefined;
        // Pre-populate tags field with selected filter tags when creating a new item
        if (!isEditing && field.type === 'tags' && field.key === 'tags' && TAG_MODULES.includes(currentModule)) {
            const selectedTags = [...getSelectedTags()];
            if (selectedTags.length > 0) value = selectedTags;
        }
        // Apply defaultValue for fields when value is undefined (new or missing field)
        if (value === undefined && field.defaultValue !== undefined) {
            value = field.defaultValue;
        }
        // Auto-derive concedeAura from existing auraVinculadaId for backward compatibility
        if (field.key === 'concedeAura' && value === undefined && existingData && existingData.auraVinculadaId) {
            value = true;
        }
        const el = buildField(field, value, existingData);
        formGrid.appendChild(el);
    });

    // Publicado toggle (always)
    const pubDiv = document.createElement('div');
    pubDiv.className = 'full-width';
    pubDiv.innerHTML = `
        <div class="form-toggle">
            <label class="toggle-publish">
                <input type="checkbox" id="field_publicado" ${existingData?.publicado ? 'checked' : ''}>
                <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label">Publicado (visível nas fichas)</span>
        </div>
    `;
    formGrid.appendChild(pubDiv);

    container.appendChild(formGrid);

    // Wire up showWhen visibility for conditional fields
    _wireShowWhenFields(modDef, formGrid);

    // Wire up showWhenBoolean visibility for boolean toggle conditional fields
    _wireShowWhenBooleanFields(modDef, formGrid);

    document.getElementById('formModal').classList.add('active');
};

window.closeForm = function () {
    editingItemId = null;
    document.getElementById('formModal').classList.remove('active');
};

// ===== BUILD FORM FIELD =====
function buildField(field, value, existingData) {
    const wrap = document.createElement('div');
    wrap.className = 'form-group' + (
        ['textarea', 'array', 'json', 'tags', 'mechanic_selector', 'aura_graus_editor', 'class_tests_editor', 'class_modules_editor'].includes(field.type) ? ' full-width' : ''
    );
    if (field.showWhen) {
        wrap.dataset.showWhenField = field.showWhen.field;
        wrap.dataset.showWhenValue = field.showWhen.value;
    }
    if (field.showWhenBoolean) {
        wrap.dataset.showWhenBoolean = field.showWhenBoolean;
    }

    if (field.type === 'mechanic_selector') {
        const ids = Array.isArray(value) ? value : [];
        if (field.selectorTarget === 'peculiarities') {
            wrap.innerHTML = buildPecSelectorHTML(field.key, field.label, ids, peculiaritiesCache, field.fontePreFilter);
        } else if (field.selectorTarget === 'skills') {
            wrap.innerHTML = buildSkillSelectorHTML(field.key, field.label, ids, skillsCache);
        } else if (field.selectorTarget === 'derivedValues') {
            wrap.innerHTML = buildDerivedValueSelectorHTML(field.key, field.label, ids, derivedValuesCache);
        } else if (field.selectorTarget === 'specializations') {
            wrap.innerHTML = buildSpecSelectorHTML(field.key, field.label, ids, specsCache);
        } else if (field.selectorTarget === 'maneuvers') {
            wrap.innerHTML = buildManeuverSelectorHTML(field.key, field.label, ids, maneuversCache);
        } else {
            wrap.innerHTML = buildMechanicSelectorHTML(field.key, field.label, ids, mechanicsCache, field.fontePreFilter);
        }
        return wrap;
    }

    // === AURA PROPERTY SELECTOR ===
    if (field.type === 'aura_property_selector') {
        wrap.innerHTML = _buildAuraPropertySelectorHTML(field.key, field.label, value, existingData);
        return wrap;
    }

    // === AURA SELECTOR (for linking an aura to a peculiarity) ===
    if (field.type === 'aura_selector') {
        let options = '<option value="">— Nenhuma —</option>';
        aurasCache.forEach(a => {
            const tipoLabel = a.tipo === 'mortalidade' ? '💀' : '📊';
            const sel = value === a.id ? 'selected' : '';
            options += `<option value="${a.id}" ${sel}>${tipoLabel} ${escapeHtml(a.nome || a.id)}</option>`;
        });
        wrap.innerHTML = `
            <label>${escapeHtml(field.label)}</label>
            <select id="field_${field.key}">${options}</select>
        `;
        return wrap;
    }

    // === AURA GRAUS EDITOR ===
    if (field.type === 'aura_graus_editor') {
        wrap.innerHTML = _buildAuraGrausEditorHTML(field.key, field.label, value || []);
        return wrap;
    }

    if (field.type === 'spec_limiter') {
        wrap.className = 'form-group full-width';
        wrap.innerHTML = buildSpecLimiterHTML(field.key, field.label, value, skillsCache);
        return wrap;
    }

    // === CLASS TESTS EDITOR ===
    if (field.type === 'class_tests_editor') {
        wrap.innerHTML = _buildClassTestsEditorHTML(field.key, field.label, Array.isArray(value) ? value : []);
        return wrap;
    }

    // === CLASS MODULES EDITOR ===
    if (field.type === 'class_modules_editor') {
        wrap.innerHTML = _buildClassModulesEditorHTML(field.key, field.label, Array.isArray(value) ? value : []);
        return wrap;
    }

    if (field.type === 'multi_select') {
        const selected = Array.isArray(value) ? value : (typeof value === 'string' && value ? value.split('/') : []);
        const checkboxes = (field.options || []).map(o => {
            const checked = selected.includes(o.value) ? 'checked' : '';
            return `<label class="multi-select-option"><input type="checkbox" value="${o.value}" ${checked} data-multiselect="${field.key}"> ${escapeHtml(o.label)}</label>`;
        }).join('');
        wrap.innerHTML = `
            <label>${escapeHtml(field.label)} ${field.required ? '<span class="required">*</span>' : ''}</label>
            <div class="multi-select-container" id="multisel_${field.key}">${checkboxes}</div>
            <input type="hidden" id="field_${field.key}" value="${escapeHtml(JSON.stringify(selected))}">
        `;
        // Sync hidden input on change
        setTimeout(() => {
            const container = document.getElementById(`multisel_${field.key}`);
            if (container) {
                container.addEventListener('change', () => {
                    const vals = Array.from(container.querySelectorAll('input:checked')).map(cb => cb.value);
                    document.getElementById(`field_${field.key}`).value = JSON.stringify(vals);
                });
            }
        }, 0);
        return wrap;
    }

    if (field.type === 'array') {
        wrap.innerHTML = buildArrayEditor(field, value || []);
        return wrap;
    }

    if (field.type === 'json') {
        const jsonStr = value ? JSON.stringify(value, null, 2) : (field.placeholder || '');
        wrap.innerHTML = `
            <div class="mechanics-editor">
                <label>${escapeHtml(field.label)} ${field.required ? '<span class="required">*</span>' : ''}</label>
                <textarea id="field_${field.key}" placeholder='${escapeHtml(field.placeholder || '')}'
                    oninput="previewMechanics(this)">${value ? escapeHtml(JSON.stringify(value, null, 2)) : ''}</textarea>
                <div class="mechanics-preview" id="preview_${field.key}">Insira JSON válido para ver o preview</div>
            </div>
        `;
        return wrap;
    }

    if (field.type === 'tags') {
        const tags = Array.isArray(value) ? value : [];
        wrap.innerHTML = `
            <label>${escapeHtml(field.label)} ${field.required ? '<span class="required">*</span>' : ''}</label>
            <div class="tags-container" id="tags_${field.key}" onclick="this.querySelector('input').focus()">
                ${tags.map(t => `<span class="tag">${escapeHtml(t)}<button type="button" onclick="removeTag(this)">×</button></span>`).join('')}
                <input type="text" placeholder="${escapeHtml(field.placeholder || '')}"
                    onkeydown="handleTagKey(event, '${field.key}')">
            </div>
        `;
        return wrap;
    }

    if (field.type === 'boolean') {
        wrap.innerHTML = `
            <div class="form-toggle">
                <label class="toggle-publish">
                    <input type="checkbox" id="field_${field.key}" ${value ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                </label>
                <span class="toggle-label">${escapeHtml(field.label)}</span>
            </div>
        `;
        return wrap;
    }

    const labelHtml = `<label>${escapeHtml(field.label)} ${field.required ? '<span class="required">*</span>' : ''}</label>`;

    if (field.type === 'select') {
        const opts = (field.options || []).map(o =>
            `<option value="${o.value}" ${value === o.value ? 'selected' : ''}>${escapeHtml(o.label)}</option>`
        ).join('');
        wrap.innerHTML = `${labelHtml}<select id="field_${field.key}"><option value="">— Selecionar —</option>${opts}</select>`;
    } else if (field.type === 'textarea') {
        wrap.innerHTML = `${labelHtml}<textarea id="field_${field.key}" placeholder="${escapeHtml(field.placeholder || '')}" ${field.required ? 'required' : ''}>${value || ''}</textarea>`;
    } else {
        if (field.key === 'imagemUrl') {
            wrap.innerHTML = `${labelHtml}<input type="${field.type}" id="field_${field.key}" value="${escapeHtml(value ?? '')}" placeholder="${escapeHtml(field.placeholder || '')}" ${field.required ? 'required' : ''} oninput="document.getElementById('img_preview_${field.key}').src = this.value; document.getElementById('img_preview_${field.key}').style.display = this.value ? 'block' : 'none';">
            <img id="img_preview_${field.key}" src="${escapeHtml(value ?? '')}" style="display: ${value ? 'block' : 'none'}; width: 100%; height: 260px; margin-top: 8px; border-radius: 4px; object-fit: cover; object-position: top;">`;
        } else {
            wrap.innerHTML = `${labelHtml}<input type="${field.type}" id="field_${field.key}" value="${escapeHtml(value ?? '')}" placeholder="${escapeHtml(field.placeholder || '')}" ${field.required ? 'required' : ''}>`;
        }
    }

    return wrap;
}

// ===== ARRAY EDITOR =====
function buildArrayEditor(field, items) {
    const itemsHtml = items.map((item, idx) => buildArrayItem(field, item, idx)).join('');
    return `
        <div class="array-editor" id="array_${field.key}" data-field-key="${field.key}">
            <div class="array-editor-header">
                <label>${escapeHtml(field.label)} ${field.required ? '<span class="required">*</span>' : ''}</label>
                <button type="button" class="btn-array-add" onclick="addArrayItem('${field.key}')">➕ Adicionar</button>
            </div>
            <div class="array-items" id="arrayItems_${field.key}">${itemsHtml}</div>
        </div>
    `;
}

function buildArrayItem(field, data, idx) {
    const subfields = field.arrayFields || [];
    const innerHtml = subfields.map(sf => {
        const val = data ? (data[sf.key] ?? '') : '';
        if (sf.type === 'textarea') {
            return `<div class="form-group"><label>${escapeHtml(sf.label)}</label><textarea data-subkey="${sf.key}" placeholder="${escapeHtml(sf.placeholder || '')}">${val}</textarea></div>`;
        }
        if (sf.type === 'json') {
            const jsonVal = val ? (typeof val === 'string' ? val : JSON.stringify(val, null, 2)) : '';
            return `<div class="form-group"><label>${escapeHtml(sf.label)}</label><textarea data-subkey="${sf.key}" style="font-family:monospace;font-size:.78rem;background:#0f1120;color:#a5f3fc;min-height:60px" placeholder="${escapeHtml(sf.placeholder || '')}">${escapeHtml(jsonVal)}</textarea></div>`;
        }
        return `<div class="form-group"><label>${escapeHtml(sf.label)}</label><input type="${sf.type || 'text'}" data-subkey="${sf.key}" value="${escapeHtml(String(val))}" placeholder="${escapeHtml(sf.placeholder || '')}"></div>`;
    }).join('');

    return `
        <div class="array-item" data-index="${idx}">
            <div class="array-item-header">
                <span class="array-item-number">#${idx + 1}</span>
                <button type="button" class="btn-array-remove" onclick="removeArrayItem(this)">✕</button>
            </div>
            ${innerHtml}
        </div>
    `;
}

window.addArrayItem = function (fieldKey) {
    const modDef = MODULE_DEFS[currentModule];
    const field = modDef.fields.find(f => f.key === fieldKey);
    if (!field) return;

    const container = document.getElementById(`arrayItems_${fieldKey}`);
    const idx = container.children.length;

    // Check maxItems
    if (field.maxItems && idx >= field.maxItems) {
        showAlert(`⚠️ Máximo de ${field.maxItems} item(ns) permitido(s)`, 'danger');
        return;
    }

    const temp = document.createElement('div');
    temp.innerHTML = buildArrayItem(field, {}, idx);
    container.appendChild(temp.firstElementChild);
};

window.removeArrayItem = function (btn) {
    const item = btn.closest('.array-item');
    item.remove();
    // Re-index
    const container = item.parentElement || document.querySelector('.array-items');
    if (container) {
        container.querySelectorAll('.array-item').forEach((el, i) => {
            el.dataset.index = i;
            const num = el.querySelector('.array-item-number');
            if (num) num.textContent = `#${i + 1}`;
        });
    }
};

// ===== AURA SYSTEM: SHOW-WHEN FIELD VISIBILITY =====
function _wireShowWhenFields(modDef, container) {
    const conditionalFields = container.querySelectorAll('[data-show-when-field]');
    if (conditionalFields.length === 0) return;

    // Find trigger fields
    const triggerKeys = new Set();
    conditionalFields.forEach(el => triggerKeys.add(el.dataset.showWhenField));

    function updateVisibility() {
        conditionalFields.forEach(wrap => {
            const triggerKey = wrap.dataset.showWhenField;
            const triggerValue = wrap.dataset.showWhenValue;
            const triggerEl = document.getElementById(`field_${triggerKey}`);
            if (!triggerEl) return;
            const currentVal = triggerEl.value;
            wrap.style.display = (currentVal === triggerValue) ? '' : 'none';
        });
    }

    // Initial update
    setTimeout(updateVisibility, 0);

    // Listen for changes
    triggerKeys.forEach(key => {
        const el = document.getElementById(`field_${key}`);
        if (el) el.addEventListener('change', updateVisibility);
    });
}

// ===== SHOW-WHEN-BOOLEAN: FIELD VISIBILITY BASED ON BOOLEAN TOGGLE =====
function _wireShowWhenBooleanFields(modDef, container) {
    const conditionalFields = container.querySelectorAll('[data-show-when-boolean]');
    if (conditionalFields.length === 0) return;

    // Find trigger boolean field keys
    const triggerKeys = new Set();
    conditionalFields.forEach(el => triggerKeys.add(el.dataset.showWhenBoolean));

    function updateVisibility() {
        conditionalFields.forEach(wrap => {
            const triggerKey = wrap.dataset.showWhenBoolean;
            const triggerEl = document.getElementById(`field_${triggerKey}`);
            if (!triggerEl) return;
            wrap.style.display = triggerEl.checked ? '' : 'none';
        });
    }

    // Initial update
    setTimeout(updateVisibility, 0);

    // Listen for changes on checkbox triggers
    triggerKeys.forEach(key => {
        const el = document.getElementById(`field_${key}`);
        if (el) el.addEventListener('change', updateVisibility);
    });
}

// ===== AURA SYSTEM: PROPERTY SELECTOR =====
function _buildAuraPropertySelectorHTML(fieldKey, label, value, existingData) {
    // Build options from attributes, skills, and specializations
    let options = '<option value="">— Selecionar Propriedade —</option>';

    // Attributes (hardcoded keys matching the sheet)
    const attrs = [
        { key: 'FOR', name: 'Força' }, { key: 'DES', name: 'Destreza' }, { key: 'VIG', name: 'Vigor' },
        { key: 'INT', name: 'Inteligência' }, { key: 'RAC', name: 'Raciocínio' }, { key: 'PRS', name: 'Perseverança' },
        { key: 'PRE', name: 'Presença' }, { key: 'MAN', name: 'Manipulação' }, { key: 'AUT', name: 'Autocontrole' }
    ];

    options += '<optgroup label="💪 Atributos">';
    attrs.forEach(a => {
        const sel = value === a.key ? 'selected' : '';
        options += `<option value="${a.key}" ${sel}>${a.name} (${a.key})</option>`;
    });
    options += '</optgroup>';

    // Skills from cache
    if (skillsCache.length > 0) {
        options += '<optgroup label="📚 Perícias">';
        skillsCache.forEach(sk => {
            const sel = value === sk.nome ? 'selected' : '';
            options += `<option value="${escapeHtml(sk.nome)}" ${sel}>${escapeHtml(sk.nome)}</option>`;
        });
        options += '</optgroup>';
    }

    // Specializations from cache
    if (specsCache.length > 0) {
        options += '<optgroup label="🎯 Especializações">';
        specsCache.forEach(sp => {
            const sel = value === sp.nome ? 'selected' : '';
            options += `<option value="${escapeHtml(sp.nome)}" ${sel}>${escapeHtml(sp.nome)}</option>`;
        });
        options += '</optgroup>';
    }

    return `
        <label>${escapeHtml(label)}</label>
        <select id="field_${fieldKey}">${options}</select>
    `;
}

// ===== AURA SYSTEM: GRAUS EDITOR =====
function _buildAuraGrausEditorHTML(fieldKey, label, graus) {
    const grausHtml = graus.map((g, idx) => _buildAuraGrauItemHTML(idx, g)).join('');
    return `
        <div class="aura-graus-editor" id="auraGraus_${fieldKey}" data-field-key="${fieldKey}">
            <div class="array-editor-header">
                <label>${escapeHtml(label)}</label>
                <button type="button" class="btn-array-add" onclick="addAuraGrau('${fieldKey}')">➕ Adicionar Grau</button>
            </div>
            <div class="aura-graus-items" id="auraGrausItems_${fieldKey}">${grausHtml}</div>
        </div>
    `;
}

function _buildAuraGrauItemHTML(idx, data) {
    data = data || {};
    const grauNum = data.grau ?? (idx + 1);
    const nomeGrau = data.nomeGrau || '';
    const descricaoNarrativa = data.descricaoNarrativa || '';
    const cor = data.cor || '#8b5cf6';
    const mecanicaIds = Array.isArray(data.mecanicaIds) ? data.mecanicaIds : [];
    const mecanicasSelectedHtml = mecanicaIds.map(id => {
        const mech = mechanicsCache.find(m => m.id === id);
        return mech ? `<span class="mech-tag" data-id="${id}">${escapeHtml(mech.nome || id)} <button type="button" onclick="this.parentElement.remove()">×</button></span>` : '';
    }).join('');

    return `
        <div class="aura-grau-item" data-grau-index="${idx}">
            <div class="aura-grau-header">
                <span class="aura-grau-badge" style="background:${escapeHtml(cor)}">Grau ${grauNum}</span>
                <button type="button" class="btn-array-remove" onclick="removeAuraGrau(this)">✕</button>
            </div>
            <div class="form-grid aura-grau-fields">
                <div class="form-group">
                    <label>Número do Grau</label>
                    <input type="number" data-grau-key="grau" value="${grauNum}" min="1" onchange="updateAuraGrauBadge(this)">
                </div>
                <div class="form-group">
                    <label>Nome do Grau</label>
                    <input type="text" data-grau-key="nomeGrau" value="${escapeHtml(nomeGrau)}" placeholder="Ex: Aura de Força I">
                </div>
                <div class="form-group">
                    <label>🎨 Cor do Grau (hex)</label>
                    <div style="display:flex;gap:8px;align-items:center">
                        <input type="color" data-grau-key="cor" value="${escapeHtml(cor)}" style="width:48px;height:36px;border:none;cursor:pointer;border-radius:6px" onchange="updateAuraGrauBadge(this)">
                        <input type="text" data-grau-key="corText" value="${escapeHtml(cor)}" placeholder="#8b5cf6" style="flex:1" oninput="syncAuraColorInput(this)">
                    </div>
                </div>
                <div class="form-group full-width">
                    <label>Descrição Narrativa</label>
                    <textarea data-grau-key="descricaoNarrativa" placeholder="Texto narrativo do grau...">${escapeHtml(descricaoNarrativa)}</textarea>
                </div>
                <div class="form-group full-width">
                    <label>Mecânicas Vinculadas</label>
                    <div class="aura-grau-mechs" data-grau-key="mecanicaIds">
                        <div class="mech-tags-container">${mecanicasSelectedHtml}</div>
                        <select class="aura-mech-select" onchange="addAuraGrauMech(this)">
                            <option value="">+ Vincular Mecânica...</option>
                            ${mechanicsCache.map(m => `<option value="${m.id}">${escapeHtml(m.nome || m.id)}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>
        </div>
    `;
}

window.addAuraGrau = function(fieldKey) {
    const container = document.getElementById(`auraGrausItems_${fieldKey}`);
    if (!container) return;
    const idx = container.children.length;
    const temp = document.createElement('div');
    temp.innerHTML = _buildAuraGrauItemHTML(idx, { grau: idx + 1 });
    container.appendChild(temp.firstElementChild);
};

window.removeAuraGrau = function(btn) {
    const item = btn.closest('.aura-grau-item');
    if (item) item.remove();
};

window.updateAuraGrauBadge = function(input) {
    const item = input.closest('.aura-grau-item');
    if (!item) return;
    const grauInput = item.querySelector('[data-grau-key="grau"]');
    const corInput = item.querySelector('[data-grau-key="cor"]');
    const badge = item.querySelector('.aura-grau-badge');
    if (badge && grauInput) {
        badge.textContent = `Grau ${grauInput.value}`;
    }
    if (badge && corInput) {
        badge.style.background = corInput.value;
    }
    // Sync text input
    const corText = item.querySelector('[data-grau-key="corText"]');
    if (corText && corInput && input === corInput) {
        corText.value = corInput.value;
    }
};

window.syncAuraColorInput = function(textInput) {
    const item = textInput.closest('.aura-grau-item');
    if (!item) return;
    const corInput = item.querySelector('[data-grau-key="cor"]');
    const badge = item.querySelector('.aura-grau-badge');
    const val = textInput.value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        if (corInput) corInput.value = val;
        if (badge) badge.style.background = val;
    }
};

window.addAuraGrauMech = function(select) {
    const mechId = select.value;
    if (!mechId) return;
    const mech = mechanicsCache.find(m => m.id === mechId);
    if (!mech) return;
    const container = select.closest('[data-grau-key="mecanicaIds"]')?.querySelector('.mech-tags-container');
    if (!container) return;
    // Check if already added
    if (container.querySelector(`[data-id="${mechId}"]`)) { select.value = ''; return; }
    const tag = document.createElement('span');
    tag.className = 'mech-tag';
    tag.dataset.id = mechId;
    tag.innerHTML = `${escapeHtml(mech.nome || mechId)} <button type="button" onclick="this.parentElement.remove()">×</button>`;
    container.appendChild(tag);
    select.value = '';
};

function collectAuraGrausData(fieldKey) {
    const container = document.getElementById(`auraGrausItems_${fieldKey}`);
    if (!container) return [];
    const items = container.querySelectorAll('.aura-grau-item');
    const graus = [];
    items.forEach(item => {
        const grau = {
            grau: parseInt(item.querySelector('[data-grau-key="grau"]')?.value || '1', 10),
            nomeGrau: item.querySelector('[data-grau-key="nomeGrau"]')?.value || '',
            cor: item.querySelector('[data-grau-key="cor"]')?.value || '#8b5cf6',
            descricaoNarrativa: item.querySelector('[data-grau-key="descricaoNarrativa"]')?.value || '',
            mecanicaIds: []
        };
        const mechTags = item.querySelectorAll('.mech-tags-container .mech-tag');
        mechTags.forEach(tag => {
            if (tag.dataset.id) grau.mecanicaIds.push(tag.dataset.id);
        });
        graus.push(grau);
    });
    return graus;
}

// ===== CLASS TESTS EDITOR =====

function _buildClassTestsEditorHTML(fieldKey, label, tests) {
    const testsHtml = tests.map((t, idx) => _buildClassTestRow(idx, t)).join('');
    return `
        <div class="class-tests-editor" id="classTests_${fieldKey}" data-field-key="${fieldKey}">
            <div class="array-editor-header">
                <label>${escapeHtml(label)}</label>
                <button type="button" class="btn-array-add" onclick="addClassTest('${fieldKey}')">➕ Adicionar Teste</button>
            </div>
            <div class="class-tests-items" id="classTestsItems_${fieldKey}">${testsHtml}</div>
        </div>
    `;
}

function _buildClassTestRow(idx, data) {
    data = data || {};
    const mechId = data.mecanicaId || '';
    const mechChip = mechId ? _buildClassTestMechChip(idx, mechId) : '<span style="color:var(--muted);font-size:.75rem">Nenhuma mecânica vinculada</span>';
    return `
        <div class="array-item class-test-item" data-index="${idx}">
            <div class="array-item-header">
                <span class="array-item-number">#${idx + 1}</span>
                <button type="button" class="btn-array-remove" onclick="removeClassTest(this)">✕</button>
            </div>
            <div class="form-grid">
                <div class="form-group full-width">
                    <label>Nome do Teste <span class="required">*</span></label>
                    <input type="text" data-ct-key="nome" value="${escapeHtml(data.nome || '')}" placeholder="Ex: Mãos Vazias, Disparo">
                </div>
                <div class="form-group full-width">
                    <label>Mecânica Vinculada (tipo Modificar)</label>
                    <input type="hidden" data-ct-key="mecanicaId" value="${escapeHtml(mechId)}">
                    <div class="ct-mech-chip" id="ctMechChip_${idx}">${mechChip}</div>
                    <button type="button" class="mechsel-add-btn" onclick="window._classTestSelectMech(${idx})" style="margin-top:6px">🔗 Vincular Mecânica</button>
                </div>
            </div>
        </div>
    `;
}

function _buildClassTestMechChip(idx, mechId) {
    const m = (typeof mechanicsCache !== 'undefined' ? mechanicsCache : []).find(x => x.id === mechId);
    if (!m) return `<div class="mechsel-chip" style="border-left-color:var(--muted)"><div class="mechsel-chip-info"><div class="mechsel-chip-name">⚠️ Mecânica não encontrada</div><div class="mechsel-chip-preview">${escapeHtml(mechId)}</div></div><button type="button" class="mechsel-chip-remove" onclick="window._classTestRemoveMech(${idx})">✕</button></div>`;
    const preview = m.previewTexto || generatePreviewText(m);
    return `<div class="mechsel-chip" style="border-left-color:var(--type-modificar, #10b981)"><div class="mechsel-chip-info"><div class="mechsel-chip-name">➕ ${escapeHtml(m.nome)}</div><div class="mechsel-chip-preview">${escapeHtml(preview)}</div></div><button type="button" class="mechsel-chip-remove" onclick="window._classTestRemoveMech(${idx})">✕</button></div>`;
}

window.addClassTest = function(fieldKey) {
    const container = document.getElementById(`classTestsItems_${fieldKey}`);
    if (!container) return;
    const idx = container.children.length;
    const temp = document.createElement('div');
    temp.innerHTML = _buildClassTestRow(idx, {});
    container.appendChild(temp.firstElementChild);
};

window.removeClassTest = function(btn) {
    const item = btn.closest('.class-test-item');
    if (!item) return;
    const container = item.parentElement;
    item.remove();
    // Re-index remaining items
    if (container) {
        container.querySelectorAll('.class-test-item').forEach((el, i) => {
            el.dataset.index = i;
            const num = el.querySelector('.array-item-number');
            if (num) num.textContent = `#${i + 1}`;
        });
    }
};

// --- Class Test mechanics selector helpers ---

window._classTestSelectMech = function(idx) {
    // Build a mini-modal that lists only 'modificar' type mechanics
    const existing = document.getElementById('ctMechModal');
    if (existing) existing.remove();

    const modifyMechanics = (typeof mechanicsCache !== 'undefined' ? mechanicsCache : [])
        .filter(m => m.publicado && m.tipo === 'modificar');

    const opts = modifyMechanics.map(m => {
        const preview = m.previewTexto || generatePreviewText(m);
        return `<label class="mechsel-result" onclick="window._classTestConfirmMech(${idx}, '${m.id}')"><span class="mechsel-result-name">➕ ${escapeHtml(m.nome)}</span><span class="mechsel-result-preview">${escapeHtml(preview)}</span></label>`;
    }).join('');

    const modal = document.createElement('div');
    modal.id = 'ctMechModal';
    modal.className = 'ct-mech-modal-overlay';
    modal.innerHTML = `
        <div class="ct-mech-modal">
            <div class="ct-mech-modal-header">
                <strong>🔗 Selecionar Mecânica (Modificar)</strong>
                <button type="button" onclick="this.closest('.ct-mech-modal-overlay').remove()">✕</button>
            </div>
            <div class="mechsel-search-bar" style="padding:8px">
                <input type="text" placeholder="🔍 Buscar mecânica..." oninput="window._classTestFilterMech(this.value)">
            </div>
            <div class="mechsel-results" id="ctMechModalResults" style="max-height:300px;overflow-y:auto">
                ${opts || '<div style="padding:12px;color:var(--muted);text-align:center">Nenhuma mecânica do tipo Modificar encontrada</div>'}
            </div>
        </div>
    `;
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
};

window._classTestFilterMech = function(text) {
    const results = document.getElementById('ctMechModalResults');
    if (!results) return;
    const lower = text.toLowerCase();
    results.querySelectorAll('.mechsel-result').forEach(l => {
        const name = l.querySelector('.mechsel-result-name')?.textContent.toLowerCase() || '';
        const preview = l.querySelector('.mechsel-result-preview')?.textContent.toLowerCase() || '';
        l.style.display = (name.includes(lower) || preview.includes(lower)) ? '' : 'none';
    });
};

window._classTestConfirmMech = function(idx, mechId) {
    // Set the hidden input and update the chip
    const items = document.querySelectorAll('.class-test-item');
    const item = Array.from(items).find(el => parseInt(el.dataset.index) === idx);
    if (!item) return;
    const hidden = item.querySelector('[data-ct-key="mecanicaId"]');
    if (hidden) hidden.value = mechId;
    const chipEl = document.getElementById(`ctMechChip_${idx}`);
    if (chipEl) chipEl.innerHTML = _buildClassTestMechChip(idx, mechId);
    // Close modal
    const modal = document.getElementById('ctMechModal');
    if (modal) modal.remove();
};

window._classTestRemoveMech = function(idx) {
    const items = document.querySelectorAll('.class-test-item');
    const item = Array.from(items).find(el => parseInt(el.dataset.index) === idx);
    if (!item) return;
    const hidden = item.querySelector('[data-ct-key="mecanicaId"]');
    if (hidden) hidden.value = '';
    const chipEl = document.getElementById(`ctMechChip_${idx}`);
    if (chipEl) chipEl.innerHTML = '<span style="color:var(--muted);font-size:.75rem">Nenhuma mecânica vinculada</span>';
};

function _collectClassTestsData(fieldKey) {
    const container = document.getElementById(`classTestsItems_${fieldKey}`);
    if (!container) return [];
    const tests = [];
    container.querySelectorAll('.class-test-item').forEach(item => {
        const nome = (item.querySelector('[data-ct-key="nome"]')?.value || '').trim();
        if (!nome) return; // Skip empty tests
        const mecanicaId = (item.querySelector('[data-ct-key="mecanicaId"]')?.value || '').trim();
        tests.push({ nome, mecanicaId });
    });
    return tests;
}


// ===== CLASS MODULES EDITOR =====

function _buildClassModulesEditorHTML(fieldKey, label, modules) {
    const modulesHtml = modules.map((m, idx) => _buildClassModuleEditorRow(idx, m)).join('');
    return `
        <div class="class-modules-editor" id="classModules_${fieldKey}" data-field-key="${fieldKey}">
            <div class="array-editor-header">
                <label>${escapeHtml(label)}</label>
                <button type="button" class="btn-array-add" onclick="addClassModule('${fieldKey}')">➕ Adicionar Módulo</button>
            </div>
            <div class="class-modules-items" id="classModulesItems_${fieldKey}">${modulesHtml}</div>
        </div>
    `;
}

function _buildClassModuleEditorRow(idx, data) {
    data = data || {};
    const schemaArr = Array.isArray(data.schema) ? data.schema : [];
    const schemaRowsHtml = schemaArr.map((sf, si) => _buildSchemaFieldRow(idx, si, sf)).join('');
    const limitId = data.mecanicaLimiteId || '';
    const limitMechName = limitId ? _findMechName(limitId) : '';
    return `
        <div class="array-item class-module-editor-item" data-index="${idx}">
            <div class="array-item-header">
                <span class="array-item-number">📦 Módulo #${idx + 1}</span>
                <button type="button" class="btn-array-remove" onclick="removeClassModule(this)">✕</button>
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label>ID do Módulo <span class="required">*</span></label>
                    <input type="text" data-cm-key="id" value="${escapeHtml(data.id || '')}" placeholder="Ex: mod_locoes">
                </div>
                <div class="form-group">
                    <label>Tipo</label>
                    <select data-cm-key="tipo">
                        <option value="lista" ${data.tipo === 'lista' || !data.tipo ? 'selected' : ''}>Lista</option>
                        <option value="grimorio" ${data.tipo === 'grimorio' ? 'selected' : ''}>Grimório</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Título <span class="required">*</span></label>
                    <input type="text" data-cm-key="titulo" value="${escapeHtml(data.titulo || '')}" placeholder="Ex: Receita de Loções">
                </div>
                <div class="form-group">
                    <label>Ícone</label>
                    <input type="text" data-cm-key="icone" value="${escapeHtml(data.icone || '')}"
                        placeholder="🧪" style="max-width:60px">
                </div>
                <div class="form-group">
                    <label>Custo EXP por Item</label>
                    <input type="number" data-cm-key="custoExpPorItem" value="${data.custoExpPorItem ?? 0}" placeholder="0" min="0">
                </div>
                <div class="form-group">
                    <label>Label de Custo</label>
                    <input type="text" data-cm-key="custoExpLabel" value="${escapeHtml(data.custoExpLabel || '')}" placeholder="Ex: 5 EXP por receita">
                </div>
                <div class="form-group full-width">
                    <label>Mecânica de Limite (define máx. de itens)</label>
                    <div style="display:flex;gap:8px;align-items:center">
                        <input type="text" data-cm-key="mecanicaLimiteId" value="${escapeHtml(limitId)}" 
                            placeholder="ID da mecânica ou deixe vazio (ilimitado)" style="flex:1">
                        ${limitMechName ? `<span style="font-size:.72rem;color:var(--accent)">${escapeHtml(limitMechName)}</span>` : ''}
                    </div>
                    <div style="font-size:.65rem;color:var(--muted);margin-top:2px">Crie uma mecânica "modificar" com operação "=" (definir fixo) apontando para "Limite: Título". Cole o ID aqui.</div>
                </div>
            </div>
            <div style="padding:0 10px 10px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                    <label style="font-weight:700;font-size:.78rem;color:var(--text)">📋 Schema de Campos</label>
                    <button type="button" class="btn-array-add" style="font-size:.7rem;padding:3px 8px" onclick="addSchemaField(${idx})">+ Campo</button>
                </div>
                <div style="font-size:.6rem;color:var(--muted);margin-bottom:6px">key · label · tipo · largura · placeholder · opções (para select) · remover</div>
                <div class="schema-fields-container" id="schemaFields_${idx}">${schemaRowsHtml}</div>
            </div>
        </div>
    `;
}

function _findMechName(mechId) {
    if (!mechId) return '';
    const m = (typeof mechanicsCache !== 'undefined' ? mechanicsCache : []).find(x => x.id === mechId);
    return m ? m.nome : '';
}

function _buildSchemaFieldRow(moduleIdx, fieldIdx, data) {
    data = data || {};
    const tipoOpts = ['text', 'number', 'textarea', 'select', 'progress', 'steps'].map(t =>
        `<option value="${t}" ${data.tipo === t ? 'selected' : ''}>${t}</option>`
    ).join('');
    return `
        <div class="schema-field-row" data-field-index="${fieldIdx}" style="display:flex;gap:4px;align-items:center;margin-bottom:4px;flex-wrap:wrap">
            <input type="text" data-sf-key="key" value="${escapeHtml(data.key || '')}" placeholder="key" style="width:80px;font-size:.72rem">
            <input type="text" data-sf-key="label" value="${escapeHtml(data.label || '')}" placeholder="label" style="width:100px;font-size:.72rem">
            <select data-sf-key="tipo" style="width:80px;font-size:.72rem">${tipoOpts}</select>
            <select data-sf-key="largura" style="width:65px;font-size:.72rem">
                <option value="" ${!data.largura ? 'selected' : ''}>½</option>
                <option value="full" ${data.largura === 'full' ? 'selected' : ''}>Full</option>
            </select>
            <input type="text" data-sf-key="placeholder" value="${escapeHtml(data.placeholder || '')}" placeholder="placeholder" style="width:80px;font-size:.72rem">
            <input type="text" data-sf-key="opcoes" value="${escapeHtml(Array.isArray(data.opcoes) ? data.opcoes.join(', ') : (data.opcoes || ''))}"
                placeholder="opções (vírgula)" style="width:100px;font-size:.72rem" title="Apenas para tipo select">
            <button type="button" onclick="this.closest('.schema-field-row').remove()" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:.8rem;padding:2px 4px">✕</button>
        </div>
    `;
}

window.addClassModule = function(fieldKey) {
    const container = document.getElementById(`classModulesItems_${fieldKey}`);
    if (!container) return;
    const idx = container.children.length;
    const temp = document.createElement('div');
    temp.innerHTML = _buildClassModuleEditorRow(idx, {});
    container.appendChild(temp.firstElementChild);
};

window.removeClassModule = function(btn) {
    const item = btn.closest('.class-module-editor-item');
    if (!item) return;
    const container = item.parentElement;
    item.remove();
    if (container) {
        container.querySelectorAll('.class-module-editor-item').forEach((el, i) => {
            el.dataset.index = i;
            const num = el.querySelector('.array-item-number');
            if (num) num.textContent = `📦 Módulo #${i + 1}`;
        });
    }
};

window.addSchemaField = function(moduleIdx) {
    const container = document.getElementById(`schemaFields_${moduleIdx}`);
    if (!container) return;
    const fieldIdx = container.children.length;
    const temp = document.createElement('div');
    temp.innerHTML = _buildSchemaFieldRow(moduleIdx, fieldIdx, {});
    container.appendChild(temp.firstElementChild);
};

function _collectClassModulesData(fieldKey) {
    const container = document.getElementById(`classModulesItems_${fieldKey}`);
    if (!container) return [];
    const modules = [];
    container.querySelectorAll('.class-module-editor-item').forEach(item => {
        const id = (item.querySelector('[data-cm-key="id"]')?.value || '').trim();
        const titulo = (item.querySelector('[data-cm-key="titulo"]')?.value || '').trim();
        if (!id && !titulo) return; // skip empty
        const mod = {
            id: id || ('mod_' + titulo.toLowerCase().replace(/[^a-z0-9]/g, '_')),
            tipo: item.querySelector('[data-cm-key="tipo"]')?.value || 'lista',
            titulo: titulo,
            icone: (item.querySelector('[data-cm-key="icone"]')?.value || '').trim() || '📦',
            custoExpPorItem: parseInt(item.querySelector('[data-cm-key="custoExpPorItem"]')?.value || '0', 10) || 0,
            custoExpLabel: (item.querySelector('[data-cm-key="custoExpLabel"]')?.value || '').trim(),
            mecanicaLimiteId: (item.querySelector('[data-cm-key="mecanicaLimiteId"]')?.value || '').trim() || null,
            schema: []
        };
        // Collect schema fields
        const schemaContainer = item.querySelector('.schema-fields-container');
        if (schemaContainer) {
            schemaContainer.querySelectorAll('.schema-field-row').forEach(row => {
                const key = (row.querySelector('[data-sf-key="key"]')?.value || '').trim();
                if (!key) return;
                const sf = {
                    key: key,
                    label: (row.querySelector('[data-sf-key="label"]')?.value || '').trim(),
                    tipo: row.querySelector('[data-sf-key="tipo"]')?.value || 'text',
                    largura: row.querySelector('[data-sf-key="largura"]')?.value || '',
                    placeholder: (row.querySelector('[data-sf-key="placeholder"]')?.value || '').trim()
                };
                const opcoesRaw = (row.querySelector('[data-sf-key="opcoes"]')?.value || '').trim();
                if (opcoesRaw && sf.tipo === 'select') {
                    sf.opcoes = opcoesRaw.split(',').map(o => o.trim()).filter(Boolean);
                }
                mod.schema.push(sf);
            });
        }
        modules.push(mod);
    });
    return modules;
}

// ===== TAGS =====
window.handleTagKey = function (e, fieldKey) {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const input = e.target;
        const val = input.value.trim().replace(/,$/g, '');
        if (!val) return;
        const container = document.getElementById(`tags_${fieldKey}`);
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.innerHTML = `${escapeHtml(val)}<button type="button" onclick="removeTag(this)">×</button>`;
        container.insertBefore(tag, input);
        input.value = '';
    }
};

window.removeTag = function (btn) {
    btn.closest('.tag').remove();
};

// ===== MECHANICS PREVIEW =====
window.previewMechanics = function (textarea) {
    const id = textarea.id.replace('field_', 'preview_');
    const preview = document.getElementById(id);
    if (!preview) return;
    const val = textarea.value.trim();
    if (!val) { preview.textContent = 'Insira JSON válido para ver o preview'; preview.classList.remove('error'); return; }
    try {
        const obj = JSON.parse(val);
        preview.classList.remove('error');
        if (Array.isArray(obj)) {
            preview.textContent = `✅ ${obj.length} mecânica(s) definida(s)`;
        } else {
            preview.textContent = `✅ Mecânica válida: ${obj.tipo || obj.operacao || 'OK'}`;
        }
    } catch (e) {
        preview.classList.add('error');
        preview.textContent = `❌ JSON inválido: ${e.message}`;
    }
};

// ===== FORM SUBMIT =====
window.handleFormSubmit = async function (e) {
    e.preventDefault();
    const modDef = MODULE_DEFS[currentModule];
    const data = {};

    // Collect field values
    modDef.fields.forEach(field => {
        if (field.type === 'class_tests_editor') {
            data[field.key] = _collectClassTestsData(field.key);
        } else if (field.type === 'class_modules_editor') {
            data[field.key] = _collectClassModulesData(field.key);
        } else if (field.type === 'aura_graus_editor') {
            data[field.key] = collectAuraGrausData(field.key);
        } else if (field.type === 'aura_property_selector' || field.type === 'aura_selector') {
            const el = document.getElementById(`field_${field.key}`);
            data[field.key] = el ? el.value : '';
        } else if (field.type === 'array') {
            data[field.key] = collectArrayData(field);
        } else if (field.type === 'tags') {
            const container = document.getElementById(`tags_${field.key}`);
            if (container) {
                data[field.key] = Array.from(container.querySelectorAll('.tag')).map(t =>
                    t.textContent.replace('×', '').trim()
                );
            }
        } else if (field.type === 'json') {
            const el = document.getElementById(`field_${field.key}`);
            if (el && el.value.trim()) {
                try { data[field.key] = JSON.parse(el.value); }
                catch { data[field.key] = el.value; }
            }
        } else if (field.type === 'mechanic_selector') {
            const el = document.getElementById(`field_${field.key}`);
            if (el) {
                try { data[field.key] = JSON.parse(el.value || '[]'); }
                catch { data[field.key] = []; }
            } else { data[field.key] = []; }
        } else if (field.type === 'multi_select') {
            const el = document.getElementById(`field_${field.key}`);
            if (el) {
                try { data[field.key] = JSON.parse(el.value || '[]'); }
                catch { data[field.key] = []; }
            } else { data[field.key] = []; }
        } else if (field.type === 'spec_limiter') {
            const el = document.getElementById(`field_${field.key}`);
            if (el) {
                try { data[field.key] = JSON.parse(el.value || '{}'); }
                catch { data[field.key] = { atributos: [], pericias: [] }; }
            } else { data[field.key] = { atributos: [], pericias: [] }; }
        } else if (field.type === 'boolean') {
            const el = document.getElementById(`field_${field.key}`);
            data[field.key] = el ? el.checked : false;
        } else if (field.type === 'number') {
            const el = document.getElementById(`field_${field.key}`);
            data[field.key] = el?.value ? Number(el.value) : null;
        } else {
            const el = document.getElementById(`field_${field.key}`);
            data[field.key] = el ? el.value : '';
        }
    });

    // Publicado
    const pubEl = document.getElementById('field_publicado');
    data.publicado = pubEl ? pubEl.checked : false;

    // Metadata
    data.atualizadoEm = Timestamp.now();
    if (!editingItemId) {
        data.criadoPor = currentUser.uid;
        data.criadoEm = Timestamp.now();
        data.versao = 1;
    } else {
        const existing = allItems.find(i => i.id === editingItemId);
        data.versao = (existing?.versao || 0) + 1;
    }

    // Validate required
    for (const field of modDef.fields) {
        if (field.required) {
            const val = data[field.key];
            if (val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
                showAlert(`⚠️ Campo obrigatório: ${field.label}`, 'danger');
                return;
            }
        }
    }

    // Save
    const btnSave = document.getElementById('btnSave');
    btnSave.disabled = true;
    btnSave.textContent = '⏳ Salvando...';

    try {
        if (editingItemId) {
            await updateDoc(doc(db, modDef.collection, editingItemId), data);
            showAlert('✅ Registro atualizado!', 'success');
        } else {
            await addDoc(collection(db, modDef.collection), data);
            showAlert('✅ Registro criado!', 'success');
        }
        closeForm();
        await loadModule(currentModule);
    } catch (e) {
        console.error('Erro ao salvar:', e);
        showAlert('❌ Erro ao salvar: ' + e.message, 'danger');
    } finally {
        btnSave.disabled = false;
        btnSave.textContent = '💾 Salvar';
    }
};

function collectArrayData(field) {
    const container = document.getElementById(`arrayItems_${field.key}`);
    if (!container) return [];
    const items = [];
    container.querySelectorAll('.array-item').forEach(itemEl => {
        const obj = {};
        field.arrayFields.forEach(sf => {
            const el = itemEl.querySelector(`[data-subkey="${sf.key}"]`);
            if (!el) return;
            if (sf.type === 'number') {
                obj[sf.key] = el.value ? Number(el.value) : null;
            } else if (sf.type === 'json') {
                try { obj[sf.key] = el.value.trim() ? JSON.parse(el.value) : null; }
                catch { obj[sf.key] = el.value; }
            } else {
                obj[sf.key] = el.value;
            }
        });
        items.push(obj);
    });
    return items;
}

// ===== MECHANICS EDITOR BRIDGE =====
function _openMechEditor(itemId) {
    // When creating a new mechanic, pass currently selected filter tags
    const initialTags = (!itemId && currentModule === 'mechanics') ? [...getSelectedTags()] : [];
    openMechanicEditor(itemId, allItems, mechanicsCache, {
        db, collection, addDoc, updateDoc, doc, Timestamp,
        currentUser, showAlert, loadModule, escapeHtml
    }, initialTags);
}
window.openMechanicEditor = function (itemId) { _openMechEditor(itemId); };

// ===== DUPLICATE ITEM =====
window.duplicateItem = async function (itemId) {
    const modDef = MODULE_DEFS[currentModule];
    const source = allItems.find(i => i.id === itemId);
    if (!source) { showAlert('❌ Item não encontrado', 'danger'); return; }

    // Clone data, strip metadata
    const clone = JSON.parse(JSON.stringify(source));
    delete clone.id;
    delete clone.criadoEm;
    delete clone.criadoPor;
    delete clone.atualizadoEm;
    delete clone.versao;
    clone.publicado = false;
    if (clone.nome) clone.nome = clone.nome + ' (cópia)';
    else if (clone.titulo) clone.titulo = clone.titulo + ' (cópia)';

    // For mechanics, open visual editor with cloned data
    if (modDef.useCustomEditor) {
        // Open editor as "new" (no id), pre-fill after render
        openMechanicEditor(null, allItems, mechanicsCache, {
            db, collection, addDoc, updateDoc, doc, Timestamp,
            currentUser, showAlert, loadModule, escapeHtml
        });
        setTimeout(() => {
            // Pre-fill basic fields
            const nomeEl = document.getElementById('mech_nome');
            if (nomeEl) nomeEl.value = clone.nome || '';
            const descEl = document.getElementById('mech_descricao');
            if (descEl) descEl.value = clone.descricao || '';
            const fonteEl = document.getElementById('mech_fonte');
            if (fonteEl) fonteEl.value = clone.fonte || '';
            const tipoEl = document.getElementById('mech_tipo');
            if (tipoEl && clone.tipo) tipoEl.value = clone.tipo;
            // Re-render config for the type
            window._mechEditingId = null;
            window._mechTipoChange();
            setTimeout(() => {
                const cfg = clone.config || {};
                if (clone.tipo === 'modificar') {
                    const a = document.getElementById('mech_config_alvo'); if (a) a.value = cfg.alvo || '';
                    const o = document.getElementById('mech_config_operacao'); if (o) o.value = cfg.operacao || '+';
                    const v = document.getElementById('mech_config_valor'); if (v) v.value = cfg.valor ?? '';
                } else if (clone.tipo === 'limitar') {
                    const a = document.getElementById('mech_config_alvo'); if (a) a.value = cfg.alvo || '';
                    const t = document.getElementById('mech_config_tipoLimite'); if (t) { t.value = cfg.tipoLimite || ''; window._mechLimitChange(); }
                    const mx = document.getElementById('mech_config_valorMaximo'); if (mx && cfg.valorMaximo != null) mx.value = cfg.valorMaximo;
                    const mn = document.getElementById('mech_config_valorMinimo'); if (mn && cfg.valorMinimo != null) mn.value = cfg.valorMinimo;
                } else if (clone.tipo === 'conceder') {
                    const tc = document.getElementById('mech_config_tipoConcessao'); if (tc) tc.value = cfg.tipoConcessao || '';
                    const dc = document.getElementById('mech_config_descricaoConcessao'); if (dc) dc.value = cfg.descricaoConcessao || '';
                } else if (clone.tipo === 'condicional') {
                    const g = document.getElementById('mech_config_gatilho'); if (g) g.value = cfg.gatilho || '';
                } else if (clone.tipo === 'narrativo') {
                    const t = document.getElementById('mech_config_textoEfeito'); if (t) t.value = cfg.textoEfeito || '';
                } else if (clone.tipo === 'distribuir') {
                    const p = document.getElementById('mech_config_pool');
                    if (p) p.value = cfg.pool || '';
                    const q = document.getElementById('mech_config_quantidadeAlvos');
                    if (q) q.value = cfg.quantidadeAlvos || '';
                    const v = document.getElementById('mech_config_valorPorAlvo');
                    if (v) v.value = cfg.valorPorAlvo || '';
                    const od = document.getElementById('mech_config_operacao_dist');
                    if (od) od.value = cfg.operacao || '+';
                    const r = document.getElementById('mech_config_restricao');
                    if (r) r.value = cfg.restricao || 'diferentes';
                    // Trigger pool change to show/hide custom
                    window._mechPoolChange?.();
                    // Check custom pool checkboxes
                    if (cfg.pool === 'Personalizado' && Array.isArray(cfg.poolPersonalizado)) {
                        const poolEl = document.getElementById('mech_config_poolPersonalizado');
                        if (poolEl) {
                            poolEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                                cb.checked = cfg.poolPersonalizado.includes(cb.value);
                            });
                        }
                    }
                }
                // Progression / evoluível
                if (clone.evoluivel) {
                    const evoEl = document.getElementById('mech_evoluivel');
                    if (evoEl) { evoEl.checked = true; window._mechEvoluivelChange(); }
                    setTimeout(() => {
                        const maxEl = document.getElementById('mech_nivelMaximo');
                        if (maxEl && clone.nivelMaximo) { maxEl.value = clone.nivelMaximo; window._mechNivelMaxChange(); }
                        // Pre-fill progression values
                        setTimeout(() => {
                            const progressao = clone.progressao || {};
                            const tbody = document.getElementById('mech_progressaoBody');
                            if (tbody) {
                                tbody.querySelectorAll('tr').forEach(row => {
                                    const custoEl = row.querySelector('.prog-custo');
                                    const valorEl = row.querySelector('.prog-valor');
                                    if (custoEl && valorEl) {
                                        const nv = custoEl.dataset.nivel;
                                        const p = progressao[nv];
                                        if (p) {
                                            custoEl.value = p.custoExp ?? '';
                                            valorEl.value = p.valor ?? '';
                                        }
                                    }
                                });
                            }
                        }, 50);
                    }, 50);
                }
                // Duration/scope
                const durEl = document.getElementById('mech_duracao'); if (durEl && clone.duracao) { durEl.value = clone.duracao; window._mechDuracaoChange(); }
                const dtEl = document.getElementById('mech_duracaoTurnos'); if (dtEl && clone.duracaoTurnos) dtEl.value = clone.duracaoTurnos;
                const deEl = document.getElementById('mech_duracaoEspecial'); if (deEl && clone.duracaoEspecial) deEl.value = clone.duracaoEspecial;
                const escEl = document.getElementById('mech_escopo'); if (escEl && clone.escopo) escEl.value = clone.escopo;
                const condEl = document.getElementById('mech_condicaoAplicacao'); if (condEl && clone.condicaoAplicacao) condEl.value = clone.condicaoAplicacao;
                const empEl = document.getElementById('mech_empilhamento'); if (empEl && clone.empilhamento) empEl.value = clone.empilhamento;
                window._mechUpdatePreview();
            }, 100);
        }, 50);
        showAlert('📋 Duplicado! Edite e salve como novo registro.', 'success');
        return;
    }

    // For standard modules: save directly
    try {
        clone.criadoPor = currentUser.uid;
        clone.criadoEm = Timestamp.now();
        clone.atualizadoEm = Timestamp.now();
        clone.versao = 1;
        await addDoc(collection(db, modDef.collection), clone);
        showAlert('📋 Registro duplicado com sucesso!', 'success');
        await loadModule(currentModule);
    } catch (e) {
        console.error('Erro ao duplicar:', e);
        showAlert('❌ Erro ao duplicar: ' + e.message, 'danger');
    }
};

// ===== HELPERS =====
function showAlert(message, type) {
    const alertArea = document.getElementById('alertArea');
    if (!alertArea) return;
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    alertArea.appendChild(alert);
    setTimeout(() => { if (alert.parentNode === alertArea) alertArea.removeChild(alert); }, 3000);
}

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

function truncate(str, maxLen) {
    if (!str) return '';
    return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}
