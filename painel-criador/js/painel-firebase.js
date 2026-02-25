// =============================================
// PAINEL DE CRIADOR — Firebase + Auth + CRUD Engine
// Lendas e Relíquias (ficha-v1.7_1 style)
// =============================================

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
            { key: 'tamanho', label: 'Tamanho Base', type: 'number', required: true, placeholder: 'Ex: 5' },
            { key: 'expectativaVida', label: 'Expectativa de Vida', type: 'text', required: true, placeholder: 'Ex: 80 anos' },
            { key: 'tendencia', label: 'Tendência', type: 'text', required: true, placeholder: 'Ex: Ambiciosos — Adaptáveis' },
            { key: 'aparencia', label: 'Aparência', type: 'textarea', required: true, placeholder: 'Descrição física típica da raça' },
            { key: 'habitat', label: 'Habitat', type: 'text', required: true, placeholder: 'Ex: Regiões temperadas, cidades' },
            {
                key: 'peculiaridades', label: 'Peculiaridades Raciais', type: 'array', arrayFields: [
                    { key: 'nome', label: 'Nome', type: 'text', required: true },
                    { key: 'descricao', label: 'Descrição', type: 'textarea' },
                    { key: 'mecanicas', label: 'Mecânicas (JSON)', type: 'json' }
                ]
            },
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
            {
                key: 'pericIniciais', label: 'Perícias Iniciais', type: 'array', arrayFields: [
                    { key: 'nome', label: 'Perícia', type: 'text', required: true },
                    { key: 'nivel', label: 'Nível', type: 'number' },
                    { key: 'opcao', label: 'Opção alternativa', type: 'text' }
                ]
            },
            {
                key: 'especIniciais', label: 'Especializações Iniciais', type: 'array', arrayFields: [
                    { key: 'nome', label: 'Especialização', type: 'text', required: true },
                    { key: 'nivel', label: 'Nível', type: 'number' },
                    { key: 'opcao', label: 'Opção alternativa', type: 'text' }
                ]
            },
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
            {
                key: 'pericClasse', label: 'Perícias de Classe', type: 'array', arrayFields: [
                    { key: 'nome', label: 'Nome', type: 'text', required: true },
                    { key: 'descricao', label: 'Descrição', type: 'textarea' },
                    { key: 'efeito', label: 'Efeito', type: 'textarea' }
                ]
            },
            {
                key: 'especExclusivas', label: 'Especializações Exclusivas', type: 'array', arrayFields: [
                    { key: 'nome', label: 'Nome', type: 'text', required: true },
                    { key: 'descricao', label: 'Descrição', type: 'textarea' }
                ]
            },
            { key: 'manobras', label: 'IDs de Manobras (referências)', type: 'tags', placeholder: 'ID da manobra e Enter' },
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
            { key: 'descricao', label: 'Descrição', type: 'textarea', required: true },
            {
                key: 'fonte', label: 'Fonte', type: 'select', required: true, options: [
                    { value: 'racial', label: 'Racial' },
                    { value: 'classe', label: 'Classe' },
                    { value: 'tribo', label: 'Tribo' },
                    { value: 'condicao', label: 'Condição' },
                    { value: 'generica', label: 'Genérica' }
                ]
            },
            { key: 'fonteRef', label: 'Referência da Fonte (ID)', type: 'text', placeholder: 'ID do registro de origem' },
            { key: 'nivel', label: 'Nível (I=1, II=2...)', type: 'number', placeholder: '1' },
            { key: 'mecanicas', label: 'Mecânicas', type: 'json', placeholder: '[\n  {\n    "tipo": "modificar",\n    "alvo": "...",\n    "operacao": "+",\n    "valor": 1\n  }\n]' },
            { key: 'custo', label: 'Custo em EXP', type: 'text', placeholder: 'Ex: 10 EXP' },
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
                    { value: 'arma_corpo', label: 'Arma Corpo a Corpo' },
                    { value: 'arma_distancia', label: 'Arma à Distância' },
                    { value: 'armadura', label: 'Armadura' },
                    { value: 'escudo', label: 'Escudo' },
                    { value: 'classe', label: 'Classe' },
                    { value: 'magica', label: 'Mágica' }
                ]
            },
            { key: 'pericRelacionada', label: 'Perícia Relacionada', type: 'text', required: true, placeholder: 'Ex: Arma, Disparo' },
            { key: 'exemplos', label: 'Exemplos de Itens', type: 'tags', required: true, placeholder: 'Ex: Espada Curta, Espada Longa' },
            { key: 'ampla', label: 'Especialização Ampla?', type: 'boolean' },
            { key: 'classeExclusiva', label: 'Classe Exclusiva', type: 'text', placeholder: 'Ex: Guerreiro (se ampla)' },
            { key: 'custoEvolucao', label: 'Custo de Evolução', type: 'text', required: true, placeholder: 'Ex: Novo Nível × 2 EXP' },
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
                    { value: 'fisica', label: 'Física' },
                    { value: 'social', label: 'Social' },
                    { value: 'defensiva', label: 'Defensiva' },
                    { value: 'classe', label: 'Classe' }
                ]
            },
            { key: 'atributoBase', label: 'Atributo Base', type: 'text', required: true, placeholder: 'Ex: DES, INT/RAC' },
            { key: 'descricao', label: 'Descrição', type: 'textarea', required: true },
            { key: 'usarPara', label: 'Usar Para', type: 'textarea', required: true, placeholder: 'Exemplos de uso em jogo' },
            { key: 'semTreino', label: 'Pode ser usada sem treino?', type: 'boolean' },
            { key: 'classeExclusiva', label: 'Classe Exclusiva', type: 'text', placeholder: 'Deixe vazio se for genérica' },
            { key: 'custoEvolucao', label: 'Custo de Evolução', type: 'text', required: true, placeholder: 'Ex: Novo Nível × 4 EXP' },
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
            { key: 'mecanicas', label: 'Mecânicas Especiais (JSON)', type: 'json', placeholder: 'Para itens mágicos/relíquias' },
        ]
    },
    conditions: {
        name: 'Condição', namePlural: 'Condições', icon: '💀',
        collection: 'system/data/conditions',
        fields: [
            { key: 'nome', label: 'Nome', type: 'text', required: true, placeholder: 'Ex: Atordoado, Cego' },
            { key: 'descricao', label: 'Descrição', type: 'textarea', required: true },
            { key: 'efeitosMecanicos', label: 'Efeitos Mecânicos (JSON)', type: 'json', required: true, placeholder: '[\n  { "tipo": "modificar", "alvo": "reacao", "op": "-", "valor": 2 }\n]' },
            { key: 'duracao', label: 'Duração', type: 'text', placeholder: 'Ex: 1 turno, permanente' },
            { key: 'removivel', label: 'Removível?', type: 'boolean' },
            { key: 'icone', label: 'Ícone / Emoji', type: 'text', placeholder: 'Ex: 💫' },
        ]
    },
    mechanics: {
        name: 'Mecânica', namePlural: 'Mecânicas', icon: '🔧',
        collection: 'system/data/mechanics',
        fields: [
            { key: 'nome', label: 'Nome', type: 'text', required: true, placeholder: 'Nome da mecânica' },
            { key: 'descricao', label: 'Descrição', type: 'textarea', required: true },
            {
                key: 'fonte', label: 'Fonte', type: 'select', options: [
                    { value: 'raca', label: 'Raça' }, { value: 'classe', label: 'Classe' },
                    { value: 'tribo', label: 'Tribo' }, { value: 'item', label: 'Item' },
                    { value: 'condicao', label: 'Condição' }, { value: 'especializacao', label: 'Especialização' },
                    { value: 'manobra', label: 'Manobra' }, { value: 'universal', label: 'Universal' }
                ]
            },
            { key: 'alvo', label: 'Alvo(s)', type: 'tags', placeholder: 'Ex: FOR, DES, reacao' },
            {
                key: 'operacao', label: 'Operação', type: 'select', options: [
                    { value: 'somar', label: 'Somar (+)' }, { value: 'subtrair', label: 'Subtrair (-)' },
                    { value: 'multiplicar', label: 'Multiplicar (×)' }, { value: 'dividir', label: 'Dividir (÷)' },
                    { value: 'definir_fixo', label: 'Definir Fixo' }, { value: 'dado_extra', label: 'Dado Extra' },
                    { value: 'teto', label: 'Teto (máx)' }, { value: 'piso', label: 'Piso (mín)' },
                    { value: 'clamp', label: 'Clamp' }, { value: 'bloqueio', label: 'Bloqueio' },
                    { value: 'override', label: 'Override' }, { value: 'formula_alt', label: 'Fórmula Alternativa' },
                    { value: 'troca_atributo', label: 'Troca de Atributo' },
                    { value: 'dar_acesso', label: 'Dar Acesso' }, { value: 'remover_acesso', label: 'Remover Acesso' },
                    { value: 'imunidade', label: 'Imunidade' }, { value: 'vulnerabilidade', label: 'Vulnerabilidade' },
                    { value: 'conceder', label: 'Conceder Efeito' },
                    { value: 'por_nivel', label: 'Escalar por Nível' }, { value: 'por_atributo', label: 'Escalar por Atributo' },
                    { value: 'por_tier', label: 'Escalar por Tier' },
                ]
            },
            { key: 'valor', label: 'Valor / Fórmula', type: 'text', placeholder: 'Ex: 2, PRS + Nível' },
            { key: 'condicao', label: 'Condição de Ativação (JSON)', type: 'json', placeholder: '{ "tipo": "sempre" }' },
            {
                key: 'duracao', label: 'Duração', type: 'select', options: [
                    { value: 'permanente', label: 'Permanente' }, { value: 'cena', label: 'Cena' },
                    { value: 'turno', label: 'Turno' }, { value: 'ate_remover', label: 'Até Remover' }
                ]
            },
            {
                key: 'empilhamento', label: 'Empilhamento', type: 'select', options: [
                    { value: 'soma', label: 'Soma' }, { value: 'maior', label: 'Maior Valor' },
                    { value: 'nao_empilha', label: 'Não Empilha' }, { value: 'exclusivo', label: 'Exclusivo' }
                ]
            },
            {
                key: 'escopo', label: 'Escopo', type: 'select', options: [
                    { value: 'proprio', label: 'Próprio' }, { value: 'aliado', label: 'Aliado' },
                    { value: 'inimigo', label: 'Inimigo' }, { value: 'area', label: 'Área' },
                    { value: 'grupo', label: 'Grupo' }
                ]
            },
            { key: 'tags', label: 'Tags', type: 'tags', placeholder: 'Tags de busca' },
        ]
    },
    maneuvers: {
        name: 'Manobra', namePlural: 'Manobras', icon: '💥',
        collection: 'system/data/maneuvers',
        fields: [
            { key: 'nome', label: 'Nome', type: 'text', required: true, placeholder: 'Ex: Postura Ofensiva, Investida' },
            { key: 'classe', label: 'Classe', type: 'text', required: true, placeholder: 'Ex: Guerreiro' },
            { key: 'custo', label: 'Custo (Determinação)', type: 'text', required: true, placeholder: 'Ex: 1 DET' },
            { key: 'efeito', label: 'Efeito', type: 'textarea', required: true },
            { key: 'requisitos', label: 'Requisitos', type: 'tags', placeholder: 'Ex: RAC 3, Performance 3' },
            { key: 'mecanicas', label: 'Mecânicas (JSON)', type: 'json', placeholder: '[\n  { "tipo": "modificar", "alvo": "alvo_ataque", "op": "+", "valor": 3 }\n]' },
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
            { key: 'custo', label: 'Custo', type: 'text', required: true, placeholder: 'Ex: 1 DET + Devoção' },
            { key: 'tempo', label: 'Tempo de Conjuração', type: 'text', required: true, placeholder: 'Ex: 1 ação' },
            { key: 'alcance', label: 'Alcance', type: 'text', required: true, placeholder: 'Ex: Toque, 9m' },
            { key: 'duracao', label: 'Duração', type: 'text', required: true, placeholder: 'Ex: Instantâneo, 1 cena' },
            { key: 'descricao', label: 'Descrição', type: 'textarea', required: true },
            { key: 'mecanicas', label: 'Mecânicas (JSON)', type: 'json', placeholder: 'Mecânicas automáticas da magia' },
            { key: 'classeRequerida', label: 'Classe Requerida', type: 'text', placeholder: 'Ex: Pallacerdote' },
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

    loadModule(moduleName);
};

// ===== LOAD MODULE DATA =====
async function loadModule(moduleName) {
    const modDef = MODULE_DEFS[moduleName];
    if (!modDef) return;

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

        renderItems();
    } catch (error) {
        console.error('Erro ao carregar módulo:', error);
        showAlert('❌ Erro ao carregar: ' + error.message, 'danger');
        grid.innerHTML = '';
    }
}

// ===== RENDER ITEMS =====
function renderItems() {
    const grid = document.getElementById('itemsGrid');
    const emptyState = document.getElementById('emptyState');
    const searchVal = (document.getElementById('searchInput')?.value || '').toLowerCase();
    const onlyPublished = document.getElementById('filterPublished')?.checked || false;

    let filtered = allItems.filter(item => {
        const name = (item.nome || item.titulo || '').toLowerCase();
        if (searchVal && !name.includes(searchVal)) return false;
        if (onlyPublished && !item.publicado) return false;
        return true;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    const modDef = MODULE_DEFS[currentModule];

    grid.innerHTML = filtered.map(item => {
        const name = escapeHtml(item.nome || item.titulo || 'Sem nome');
        const subtitle = item.subtitulo || item.arquetipo || item.categoria || item.escola || item.classe || '';
        const desc = item.descricao || item.conteudo || item.efeito || '';
        const isPublished = item.publicado === true;
        const badgeClass = isPublished ? 'badge-published' : 'badge-draft';
        const badgeText = isPublished ? '✅ Publicado' : '📝 Rascunho';

        return `
            <div class="item-card" onclick="openForm('${item.id}')">
                <div class="item-card-header">
                    <div class="item-card-name">${name}</div>
                    <span class="badge-status ${badgeClass}">${badgeText}</span>
                </div>
                ${subtitle ? `<div class="item-card-subtitle">${escapeHtml(subtitle)}</div>` : ''}
                ${desc ? `<div class="item-card-desc">${escapeHtml(truncate(desc, 100))}</div>` : ''}
                <div class="item-card-footer">
                    <div class="item-card-actions">
                        <button class="btn-edit" onclick="event.stopPropagation(); openForm('${item.id}')" title="Editar">✏️</button>
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
    }).join('');
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
        const value = existingData ? existingData[field.key] : undefined;
        const el = buildField(field, value);
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
    document.getElementById('formModal').classList.add('active');
};

window.closeForm = function () {
    editingItemId = null;
    document.getElementById('formModal').classList.remove('active');
};

// ===== BUILD FORM FIELD =====
function buildField(field, value) {
    const wrap = document.createElement('div');
    wrap.className = 'form-group' + (
        ['textarea', 'array', 'json', 'tags'].includes(field.type) ? ' full-width' : ''
    );

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
        wrap.innerHTML = `${labelHtml}<input type="${field.type}" id="field_${field.key}" value="${escapeHtml(value ?? '')}" placeholder="${escapeHtml(field.placeholder || '')}" ${field.required ? 'required' : ''}>`;
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
        if (field.type === 'array') {
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
