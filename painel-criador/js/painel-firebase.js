// =============================================
// PAINEL DE CRIADOR — Firebase + Auth + CRUD Engine
// Lendas e Relíquias (ficha-v1.7_1 style)
// =============================================

import { openMechanicEditor, renderMechanicCard, generatePreviewText, buildMechanicSelectorHTML, buildPecSelectorHTML, buildSkillSelectorHTML, buildDerivedValueSelectorHTML, buildEquipmentDerivedValueSelectorHTML, buildConditionSelectorHTML, vitalStatusOptions, ATRIBUTOS_VINCULAVEIS, periciaOptions, buildManeuverSelectorHTML, getMechanicTargetsHTML, FONTE_LABELS, TIPO_ICONS, TIPO_LABELS } from './painel-mechanics.js?v=16';
import {
    CAMPOS_EQUIPAMENTO, normalizaFormaEquipar,
    SECOES_EQUIPAMENTO, htmlBarraFerramentas, ligarFormulario, agruparEmSecoesDOM, atualizarResumo,
} from '../../shared/equip-campos.js?v=14';
import {
    SECOES_CONDICAO, SECOES_CLASSE, SECOES_TRIBO, SECOES_VALOR_DERIVADO,
} from './cadastro-secoes.js?v=1';

/** Gaveta nasce aberta quando o registro já tem algo dentro dela. */
const _preenchidoNoDado = (dado, k) => {
    const v = dado ? dado[k] : undefined;
    return !(v === undefined || v === null || v === '' || v === false || (Array.isArray(v) && !v.length));
};
import { RUNIC_MODULE_DEF, buildRunicField, collectRunicField, importRunicSeed } from './painel-runic.js?v=1';
import { versaoDoLivro } from '../../shared/livros-pub.js';

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
    getFirestore, collection, query, where, getDocs, getDoc, setDoc,
    deleteDoc, updateDoc, doc, orderBy, limit, getCountFromServer, Timestamp, addDoc
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

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
// 💾 PERSISTÊNCIA OFFLINE (Firebase v10+): cache local em IndexedDB.
// Leituras funcionam offline e escritas ficam na fila e sincronizam
// automaticamente quando a conexão voltar. Multi-tab habilitado.
let db;
try {
    db = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
    console.log('💾 Firestore: cache offline (IndexedDB) ativado.');
} catch (e) {
    console.warn('💾 Firestore: cache offline indisponível, usando memória.', e);
    db = getFirestore(app);
}

let currentUser = null;
let currentModule = 'dashboard';
let allItems = [];
let itemToDelete = null;
let editingItemId = null;
let mechanicsCache = [];
let peculiaritiesCache = [];
let skillsCache = [];
let derivedValuesCache = [];
let vitalStatsCache = [];
let conditionsCache = [];
let bodyPartsCache = [];

let aurasCache = [];
let maneuversCache = [];
let equipmentCache = [];
let classModulesCache = [];
// 📚 Livros e capítulos escritos no Worldbuilding (Escritório do Cronista).
// Só a aba Conhecimento usa — carregado sob demanda.
let wbBooksCache = [];
let wbChaptersCache = [];

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
            { key: 'livrosVinculados', label: '📖 Livros Vinculados (Worldbuilding)', type: 'book_link' },
            { key: 'partesDoCorpo', label: '🦴 Anatomia — Partes do Corpo', type: 'body_parts_editor' },
        ]
    },
    classes: {
        name: 'Classe', namePlural: 'Classes', icon: '⚔️',
        collection: 'system/data/classes',
        // Gavetas: identidade, papel, com o que comeca, o que concede,
        // progressao e mundo. Ver cadastro-secoes.js.
        sections: SECOES_CLASSE,
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
            { key: 'peculiaridadeIds', label: '✨ Peculiaridades da Classe', type: 'mechanic_selector', selectorTarget: 'peculiarities', fontePreFilter: 'classe' },
            { key: 'manobras', label: '💥 Manobras da Classe', type: 'mechanic_selector', selectorTarget: 'maneuvers' },
            { key: 'mecanicaIds', label: 'Mecânicas da Classe', type: 'mechanic_selector', fontePreFilter: 'classe' },
            { key: 'derivedValueIds', label: 'Valores Derivados da Classe', type: 'mechanic_selector', selectorTarget: 'derivedValues' },
            { key: 'kitsIniciais', label: '🎒 Kits Iniciais', type: 'class_kits_editor' },
            { key: 'testesDeClasse', label: '🎯 Testes de Classe (Rolagens)', type: 'class_tests_editor' },
            { key: 'usaRunomancia', label: 'ᛟ Usa Runomancia? (ON/OFF)', type: 'boolean' },
            { key: 'modulosDaClasse', label: '📦 Módulos da Classe', type: 'class_module_linker' },
            { key: 'livrosVinculados', label: '📖 Livros Vinculados (Worldbuilding)', type: 'book_link' },
            { key: 'imagemUrl', label: 'URL da Imagem', type: 'text', placeholder: 'https://...' },
        ]
    },
    tribes: {
        name: 'Tribo', namePlural: 'Tribos', icon: '🏕️',
        collection: 'system/data/tribes',
        // Gavetas: identidade, o que concede, sociedade, militar, mundo.
        sections: SECOES_TRIBO,
        fields: [
            { key: 'nome', label: 'Nome', type: 'text', required: true, placeholder: 'Ex: Comuno, Famo, Pogtara' },
            { key: 'lema', label: 'Lema / Citação', type: 'text', placeholder: 'Lema da tribo' },
            { key: 'descricao', label: 'Descrição', type: 'textarea', required: true },
            { key: 'peculiaridadeIds', label: '✨ Peculiaridades da Tribo', type: 'mechanic_selector', selectorTarget: 'peculiarities', fontePreFilter: 'tribo' },
            { key: 'derivedValueIds', label: 'Valores Derivados da Tribo', type: 'mechanic_selector', selectorTarget: 'derivedValues' },
            {
                key: 'pericias', label: 'Perícias Tribais', type: 'array', arrayFields: [
                    { key: 'nome', label: 'Perícia', type: 'text', required: true },
                    { key: 'nivel', label: 'Nível', type: 'number' },
                    { key: 'opcao', label: 'Opção alternativa', type: 'text' }
                ]
            },
            { key: 'livrosVinculados', label: '📖 Livros Vinculados (Worldbuilding)', type: 'book_link' },
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
            { key: 'derivedValueIds', label: '📊 Valores Derivados Vinculados', type: 'mechanic_selector', selectorTarget: 'derivedValues' },
            { key: 'tags', label: 'Tags', type: 'tags', placeholder: 'Ex: bônus, racial' },
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
        // Mesma lista que a Ficha de NPC usa para editar UMA instância
        // (shared/equip-campos.js). Campo novo aqui aparece nos dois.
        fields: CAMPOS_EQUIPAMENTO,
        // ...e as mesmas gavetas do formulário de item da Ficha: 39 campos
        // numa coluna só ninguém varre. Único módulo que declara seções.
        sections: SECOES_EQUIPAMENTO,
    },
    conditions: {
        name: 'Condição', namePlural: 'Condições', icon: '💀',
        collection: 'system/data/conditions',
        // 30 campos, 11 pendurados no interruptor do Tabuleiro: em coluna
        // corrida ninguem varre. Mapa das gavetas em cadastro-secoes.js.
        sections: SECOES_CONDICAO,
        fields: [
            { key: 'nome', label: 'Nome', type: 'text', required: true, placeholder: 'Ex: Atordoado, Cego' },
            { key: 'descricao', label: 'Descrição', type: 'textarea', required: true },
            { key: 'efeitoMecanicaIds', label: 'Efeitos Mecânicos', type: 'mechanic_selector', fontePreFilter: 'condicao' },
            { key: 'duracao', label: 'Duração', type: 'text', placeholder: 'Ex: 1 turno, permanente' },
            { key: 'removivel', label: 'Removível?', type: 'boolean' },
            { key: 'icone', label: 'Ícone / Emoji', type: 'text', placeholder: 'Ex: 💫' },

            // ===== 📈 ACÚMULO EM NÍVEIS =====
            // Condição que empilha em vez de repetir: aplicar de novo sobe o
            // nível (Exaustão 1→6). Fica FORA do interruptor do Tabuleiro de
            // propósito — o nível vale na ficha também, não só no mapa.
            { key: 'acumulaNiveis', label: '📈 Acumula em níveis (aplicar de novo sobe o nível)', type: 'boolean' },
            {
                key: 'nivelMaximo', label: 'Nível máximo', type: 'number',
                placeholder: 'Ex: 6 — vazio = sem teto', showWhenBoolean: 'acumulaNiveis'
            },
            {
                key: 'efeitoPorNivel', label: '📊 O que muda em cada nível', type: 'array', showWhenBoolean: 'acumulaNiveis',
                arrayFields: [
                    { key: 'nivel', label: 'Nível', type: 'number', placeholder: '1' },
                    { key: 'efeito', label: 'Efeito neste nível', type: 'textarea', placeholder: 'Ex: Deslocamento pela metade' },
                    // 🎯 O número que o Tabuleiro subtrai sozinho. O campo de
                    // cima é texto de mesa (o motor não lê); este é a regra.
                    { key: 'modAlvo', label: '🎯 Modificador no Alvo neste nível', type: 'number', placeholder: 'Ex: -2 (vazio = usa o da condição)' },
                ]
            },
            // Vale enquanto a condição durar, em QUALQUER teste (ataque incluso).
            // Nível com `modAlvo` próprio manda nele; sem isso, vale este aqui.
            // Só mexe no Alvo — dano não é teste.
            {
                key: 'modAlvoTestes', label: '🎯 Modificador no Alvo de todos os testes', type: 'number',
                placeholder: 'Ex: -2 · vazio = a condição não mexe no Alvo'
            },
            // 🛡️ "Blindado: +N de Blindagem". O N vem do NÍVEL: aqui se diz
            // QUAL Valor Derivado e quanto vale CADA degrau, então Blindado
            // nível 5 soma +5. Sem os dois campos a condição não mexe em VD.
            {
                key: 'modVd', label: '📊 Valor Derivado que a condição altera', type: 'text',
                placeholder: 'Ex: Blindagem · vazio = não altera VD nenhum'
            },
            {
                key: 'modVdPorNivel', label: '📊 Quanto soma nesse VD por nível', type: 'number',
                placeholder: 'Ex: 1 → nível 5 soma +5 · negativo também vale',
                showWhenNotNull: 'modVd'
            },

            // ===== 🎲 TESTE PARA SAIR =====
            // Mesmo formato do "🎯 Pedir teste" do Tabuleiro (tab-combat.js):
            // um NOME de componentes somados que `alvoDoTeste` sabe ler, mais um
            // modificador de dificuldade. A rolagem é 1d10 vs Alvo e o resultado
            // sai em Graus — passar é Grau positivo. Nada de "CD 15" aqui: esse
            // número não existe neste sistema.
            { key: 'testeParaSair', label: '🎲 Sai com teste?', type: 'boolean' },
            {
                key: 'testeNome', label: 'Teste (componentes somados)', type: 'text',
                placeholder: 'Ex: Vigor + Resistência — mesmo formato do "Pedir teste" do Tabuleiro',
                showWhenBoolean: 'testeParaSair'
            },
            {
                key: 'testeMod', label: 'Modificador de dificuldade', type: 'number',
                placeholder: '0 — negativo é mais difícil (−2), positivo é mais fácil (+1)',
                showWhenBoolean: 'testeParaSair'
            },
            {
                key: 'testeQuando', label: 'Quando o teste acontece', type: 'select', showWhenBoolean: 'testeParaSair',
                options: [
                    { value: 'fim_do_turno', label: '🔚 No fim do turno do afetado' },
                    { value: 'inicio_do_turno', label: '🔛 No início do turno do afetado' },
                    { value: 'virada_da_rodada', label: '🔄 Na virada da rodada' },
                    { value: 'acao_padrao', label: '⚔️ Gastando uma Ação Padrão' },
                ]
            },
            {
                key: 'testeSucessoRemove', label: 'Passando no teste, a condição...', type: 'select', showWhenBoolean: 'testeParaSair',
                options: [
                    { value: 'tudo', label: '✅ Sai inteira' },
                    { value: 'um_nivel', label: '📉 Cai um nível (só para condição que acumula)' },
                ]
            },

            // ===== 🎲 TABULEIRO (VTT) =====
            // O que a condição TIRA ou MUDA no token, em vocabulário que o motor
            // do Tabuleiro já fala. Número que muda VD continua sendo trabalho
            // das Mecânicas (`efeitoMecanicaIds`) — aqui é só o que Mecânica não
            // consegue dizer: bloquear ação, andar, enxergar, ser alvo.
            // Os valores batem com shared/combate-cenas.js na letra: 'padrao' |
            // 'movimento' | 'livre' | 'completa' (podeGastar), 'vit' | 'ener' |
            // 'san' (RECURSO_NOME) e as facções de FACCOES. Renomear aqui sem
            // renomear lá quebra em silêncio.
            { key: 'afetaTabuleiro', label: '🎲 Configura o Tabuleiro (VTT)?', type: 'boolean' },

            {
                key: 'bloqueiaAcoes', label: '🚫 Ações que a condição impede', type: 'multi_select', showWhenBoolean: 'afetaTabuleiro',
                options: [
                    { value: 'padrao', label: '⚔️ Ação Padrão' },
                    { value: 'movimento', label: '🏃 Ação de Movimento' },
                    { value: 'livre', label: '🤏 Ação Livre' },
                    { value: 'completa', label: '💫 Ação Completa' },
                ]
            },
            { key: 'perdeTurno', label: '💤 Perde o turno inteiro (o Tabuleiro pula a vez)', type: 'boolean', showWhenBoolean: 'afetaTabuleiro' },

            {
                key: 'multiplicadorDeslocamento', label: '🏃 Multiplicador de Deslocamento', type: 'number',
                placeholder: 'Vazio = normal · 0 = não sai do lugar · 0.5 = metade · 2 = dobro',
                showWhenBoolean: 'afetaTabuleiro'
            },
            {
                key: 'deslocamentosBloqueados', label: '⛔ Tipos de Deslocamento bloqueados', type: 'tags',
                placeholder: 'Ex: Aéreo, Aquático — digite e pressione Enter',
                showWhenBoolean: 'afetaTabuleiro'
            },

            {
                key: 'multiplicadorVisao', label: '👁️ Multiplicador de Alcance de Visão', type: 'number',
                placeholder: 'Vazio = normal · 0 = cego · 0.5 = metade',
                showWhenBoolean: 'afetaTabuleiro'
            },
            { key: 'enxergaNoEscuro', label: '🌑 Enxerga sem luz (ignora a exigência de iluminação)', type: 'boolean', showWhenBoolean: 'afetaTabuleiro' },
            { key: 'deixaInvisivel', label: '👻 Deixa o token invisível', type: 'boolean', showWhenBoolean: 'afetaTabuleiro' },

            { key: 'naoPodeSerAlvo', label: '🛡️ Não pode ser escolhido como alvo', type: 'boolean', showWhenBoolean: 'afetaTabuleiro' },
            { key: 'atraiAlvo', label: '🎯 Atrai os ataques (provocação)', type: 'boolean', showWhenBoolean: 'afetaTabuleiro' },
            {
                key: 'faccaoForcada', label: '🔀 Força a facção enquanto durar', type: 'select', showWhenBoolean: 'afetaTabuleiro',
                options: [
                    { value: 'aliados', label: '🟢 Aliados' },
                    { value: 'inimigos', label: '🔴 Inimigos' },
                    { value: 'neutros', label: '⚪ Neutros' },
                ]
            },

            {
                key: 'porRodadaEfeito', label: '🩸 Efeito a cada virada de rodada', type: 'select', showWhenBoolean: 'afetaTabuleiro',
                options: [
                    { value: 'dano_vit', label: '🩸 Dano à Vitalidade' },
                    { value: 'dano_ener', label: '⚡ Dano à Energia' },
                    { value: 'dano_san', label: '🧠 Dano à Sanidade' },
                    { value: 'cura_vit', label: '💚 Cura de Vitalidade' },
                    { value: 'cura_ener', label: '🔋 Cura de Energia' },
                    { value: 'cura_san', label: '🕯️ Cura de Sanidade' },
                ]
            },
            {
                key: 'porRodadaValor', label: 'Quanto por rodada', type: 'text',
                placeholder: 'Ex: 1d4, 2, 1d6+1 — sempre positivo; quem diz dano ou cura é o campo acima',
                showWhenNotNull: 'porRodadaEfeito'
            },
        ]
    },
    castingForms: {
        name: 'Forma de Conjuração', namePlural: 'Formas de Conjuração', icon: '🪄',
        collection: 'system/data/castingForms',
        fields: [
            { key: 'nome', label: 'Nome', type: 'text', required: true, placeholder: 'Ex: Vocal, Inst. Sopro, Bênção, Moldar Sangue' },
            { key: 'icone', label: 'Ícone / Emoji', type: 'text', placeholder: 'Ex: 🗣️ 🎺 🪕 ✨' },
            { key: 'descricao', label: 'Descrição', type: 'textarea', placeholder: 'O que é essa forma de conjurar, em uma frase de mesa.' },

            // ═══ O ELO COM O QUE JÁ ESTÁ CADASTRADO ═══
            // Toda coluna de módulo marcada como "🪄 forma de conjurar" aponta um
            // Valor Derivado (é ele que dá o Acerto). A Forma se declara dona
            // desses VDs — assim os módulos que já existem continuam iguais, sem
            // remigração: o Tabuleiro casa pelo VD que a coluna já usava.
            {
                key: 'derivedValueIds', label: '📊 Valores Derivados que esta forma cobre (é daqui que sai o Acerto)',
                type: 'mechanic_selector', selectorTarget: 'derivedValues'
            },

            // ═══ O QUE ELA EXIGE PARA PODER SER USADA ═══
            {
                key: 'requisito', label: '🔒 Para usar esta forma, o conjurador precisa de...', type: 'select',
                options: [
                    { value: 'nenhum', label: '— Nada (a forma está sempre disponível)' },
                    { value: 'item_tag', label: '🎒 Um item equipado (arma, foco, instrumento)' },
                    { value: 'parte_corpo', label: '🦴 Uma parte do corpo funcional' },
                ]
            },
            {
                key: 'itemTags', label: 'Tags do item que serve', type: 'tags',
                placeholder: 'Ex: instrumento-sopro — o item equipado precisa ter UMA destas tags',
                showWhen: { field: 'requisito', value: 'item_tag' }
            },
            {
                key: 'partesDoCorpoNomes', label: 'Partes do corpo que servem', type: 'tags',
                placeholder: 'Ex: Cabeça, Boca — basta UMA delas estar inteira',
                showWhen: { field: 'requisito', value: 'parte_corpo' }
            },

            // ═══ O QUE A IMPEDE ═══
            // É o que faz o "não pode falar" do Afogando virar regra executável.
            {
                key: 'condicoesBloqueiam', label: '💀 Condições que impedem esta forma',
                type: 'mechanic_selector', selectorTarget: 'conditions'
            },
            { key: 'ordem', label: 'Ordem no Select', type: 'number', placeholder: '0' },
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
        // Gavetas: identidade, exibicao, calculo, campos editaveis e criacao.
        sections: SECOES_VALOR_DERIVADO,
        fields: [
            { key: 'nome', label: 'Nome', type: 'text', required: true, placeholder: 'Ex: Percepção, Iniciativa, Carga' },
            { key: 'blocoId', label: 'ID do Bloco', type: 'text', placeholder: 'ex: combat, senses, etc' },
            { key: 'blocoNome', label: 'Nome do Bloco', type: 'text', placeholder: 'Ex: Combate, Sentidos' },
            { key: 'blocoOrdem', label: 'Ordem do Bloco', type: 'number', placeholder: '1' },
            { key: 'ordem', label: 'Ordem na Ficha', type: 'number', required: true, placeholder: '1' },
            { key: 'icone', label: 'Ícone / Emoji', type: 'text', placeholder: 'Ex: 👁️, ⚡' },
            { key: 'prefixo', label: 'Prefixo (exibido antes do valor)', type: 'text', placeholder: 'Ex: +, ≥, ~' },
            { key: 'sufixo', label: 'Sufixo (exibido após o valor)', type: 'text', placeholder: 'Ex: metros, kg, %' },
            { key: 'descricao', label: 'Descrição', type: 'textarea', required: true, placeholder: 'Descreva o que este valor representa e como é calculado' },
            { key: 'todoPersonagem', label: 'Todo personagem tem este valor?', type: 'boolean' },
            { key: 'mecanicaIds', label: 'Mecânicas Vinculadas', type: 'mechanic_selector', fontePreFilter: '' },
            {
                // O renderer de 'select' já injeta um <option value=""> — deixar o
                // vazio fora daqui evita opção duplicada. Vazio = global (padrão).
                key: 'escopoItem', label: '🎒 Escopo por Item Equipado (vazio = global, um valor só para o personagem)', type: 'select', options: [
                    { value: 'coluna', label: '📊 Por item equipado: coluna própria em "Ataques e Efeitos Ativos"' },
                    { value: 'dano', label: '💥 Por item equipado: soma na Fórmula de Dano (ex: 1d10 → 1d10+5)' },
                    { value: 'dano-canal', label: '🌈 Canal de Essência: parcela SEPARADA do golpe (reduzida pela Blindagem daquela cor, não pela física)' }
                ]
            },
            { key: 'arredondaMesa', label: '🎲 Arredonda na mesa? (exibe o inteiro — p/ baixo, mín. 1 se > 0 — e mostra a fração exata no tooltip do nome. Ex.: Blindagem)', type: 'boolean' },
            { key: 'campoAtual', label: 'Tem campo "Atual" (editável)?', type: 'boolean' },
            { key: 'campoEditavel', label: 'Campo editável pelo jogador?', type: 'boolean' },
            { key: 'statusCombate', label: '⚔️ Status de Combate? (fixa no topo da aba Combate da ficha)', type: 'boolean' },
            { key: 'characterCreationRule', label: 'Regra de Criação de Personagem', type: 'boolean' },
            { key: 'characterCreationMin', label: 'Valor Mínimo', type: 'number', showWhenBoolean: 'characterCreationRule' },
            { key: 'characterCreationMax', label: 'Valor Máximo', type: 'number', showWhenBoolean: 'characterCreationRule' },
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
                    { value: 'propriedade', label: '📊 Propriedade (Atributo/Perícia)' },
                    { value: 'mortalidade', label: '💀 Mortalidade' }
                ]
            },
            {
                key: 'propriedadeTipo', label: 'Tipo de Propriedade', type: 'select', options: [
                    { value: 'atributo', label: '💪 Atributo' },
                    { value: 'pericia', label: '📚 Perícia' }
                ], showWhen: { field: 'tipo', value: 'propriedade' }
            },
            { key: 'propriedadeVinculada', label: 'Propriedade Vinculada', type: 'aura_property_selector', showWhen: { field: 'tipo', value: 'propriedade' } },
            { key: 'graus', label: 'Graus da Aura', type: 'aura_graus_editor' },
        ]
    },
    // 📚 CONHECIMENTO — trava de leitura dos capítulos escritos no Worldbuilding.
    // Um registro por capítulo: sem registro, o capítulo só aparece na ficha se
    // estiver marcado como Público no Escritório do Cronista. Com registro, a
    // liberação passa a depender dos requisitos abaixo.
    knowledge: {
        name: 'Regra de Conhecimento', namePlural: 'Conhecimento', icon: '📚',
        collection: 'system/data/knowledge',
        fields: [
            { key: 'capituloId', label: '📖 Capítulo (Worldbuilding)', type: 'wb_chapter_selector', required: true },
            { key: 'titulo', label: 'Título de exibição (preenchido pelo capítulo)', type: 'text', placeholder: 'Preenchido automaticamente' },
            {
                key: 'modo', label: 'Como liberar', type: 'select', options: [
                    { value: 'todos', label: '🔗 Exige TODOS os requisitos' },
                    { value: 'qualquer', label: '🔀 Basta UM dos requisitos' }
                ]
            },
            { key: 'requisitos', label: '🔐 Requisitos de Desbloqueio', type: 'knowledge_reqs_editor' },
            { key: 'dica', label: '💡 Dica exibida enquanto bloqueado', type: 'text', placeholder: 'Ex: Dizem que só quem treinou na Torre entende estas linhas.' },
        ]
    },
    itemRules: {
        name: 'Regra de Item', namePlural: 'Regras de Itens', icon: '⚙️',
        collection: 'system/data/itemRules',
        fields: [
            { key: 'nome', label: 'Nome da Regra', type: 'text', required: true, placeholder: 'Ex: Pressão soma na Carga' },
            { key: 'descricao', label: 'Descrição', type: 'textarea', required: true, placeholder: 'Descreva quando e como esta regra se aplica' },
            { key: 'mecanicaIds', label: 'Mecânicas Vinculadas', type: 'mechanic_selector', fontePreFilter: 'item' },
            { key: 'ativo', label: 'Regra Ativa?', type: 'boolean' },
            { key: 'ordem', label: 'Ordem de Aplicação', type: 'number', placeholder: '0' },
        ]
    },
    bodyParts: {
        name: 'Parte do Corpo', namePlural: 'Partes do Corpo', icon: '🦴',
        collection: 'system/data/bodyParts',
        fields: [
            { key: 'nome', label: 'Nome', type: 'text', required: true, placeholder: 'Ex: Cabeça, Braço, Perna, Torso' },
            { key: 'descricao', label: 'Descrição', type: 'textarea', placeholder: 'Descreva esta parte do corpo e sua função anatômica' },
            { key: 'icone', label: 'Ícone / Emoji', type: 'text', placeholder: 'Ex: 🗣️, 💪, 🦵' },
            { key: 'ordem', label: 'Ordem de Exibição', type: 'number', placeholder: '0' },
            { key: 'ehPadrao', label: 'Esta é uma parte padrão?', type: 'boolean' },
            { key: 'podeGolpear', label: 'Pode Golpear?', type: 'boolean' },
            // O golpe desarmado é 100% daqui: dado, tipos e vínculos vêm DESTE
            // cadastro — nada de 1d4 ou Contundente cravado no código.
            { key: 'formulaDano', label: '💥 Fórmula de Dano do golpe (ex: 1d4)', type: 'text', placeholder: 'Ex: 1d4 — vazio = a parte golpeia sem dado de dano', showWhenBoolean: 'podeGolpear' },
            {
                key: 'tipoGolpe', label: '🗡️ Tipos de Golpe (qual Blindagem tipada barra — 1 ou mais)', type: 'multi_select',
                options: [
                    { value: 'cortante', label: '🗡️ Cortante' },
                    { value: 'perfurante', label: '🏹 Perfurante' },
                    { value: 'contundente', label: '🔨 Contundente' },
                ], showWhenBoolean: 'podeGolpear'
            },
            // Muda o Acerto e o Dano do golpe desarmado DESTA parte, e só dele.
            { key: 'valoresDerivadosVinculados', label: 'Valores Derivados Vinculados (golpe desta parte)', type: 'mechanic_selector', selectorTarget: 'equipmentDerivedValues' },
            { key: 'podeSegurar', label: 'Pode Segurar?', type: 'boolean' },
            { key: 'podeEmpunhar', label: 'Pode Empunhar?', type: 'boolean' },
            { key: 'podeVestir', label: 'Pode Vestir?', type: 'boolean' },
            { key: 'podeFixar', label: 'Pode Fixar?', type: 'boolean' },
        ]
    },
    classModules: {
        name: 'Módulo de Classe', namePlural: 'Módulos de Classe', icon: '📦',
        collection: 'system/data/classModules',
        fields: [
            { key: '_moduleData', label: '', type: 'class_module_standalone_editor' }
        ]
    },
    runicElements: RUNIC_MODULE_DEF
};

// =====================================================================
// FILTROS DINÂMICOS POR MÓDULO (data-driven)
// Cada aba pode declarar filtros baseados nos campos importantes daquele
// cadastro, tornando a busca mais precisa. Tipos:
//   'auto'    → gera um dropdown com os valores distintos existentes nos
//               registros (ex.: "Nome do Bloco" em Valores Derivados).
//   'static'  → reaproveita as opções fixas definidas no campo (MODULE_DEFS).
//   'boolean' → filtro de 3 estados (Todos / Sim / Não).
// =====================================================================
const MODULE_FILTERS = {
    races: [
        { key: 'habitat', label: 'Habitat', icon: '🌍', type: 'auto' },
        { key: 'tendencia', label: 'Tendência', icon: '☯️', type: 'auto' },
    ],
    classes: [
        { key: 'arquetipo', label: 'Arquétipo', icon: '🎭', type: 'auto' },
        { key: 'usaRunomancia', label: 'Runomancia', icon: 'ᛟ', type: 'boolean' },
    ],
    peculiarities: [
        { key: 'fonte', label: 'Fonte', icon: '📌', type: 'static' },
        { key: 'quandoSeAplica', label: 'Aplicação', icon: '⏱️', type: 'static' },
        { key: 'concedeAura', label: 'Concede Aura', icon: '🌟', type: 'boolean' },
    ],
    skills: [
        { key: 'todoPersonagem', label: 'Universal', icon: '👥', type: 'boolean' },
    ],
    derivedValues: [
        { key: 'blocoNome', label: 'Bloco', icon: '🧱', type: 'auto' },
        { key: 'todoPersonagem', label: 'Universal', icon: '👥', type: 'boolean' },
        { key: 'characterCreationRule', label: 'Regra de Criação', icon: '🎯', type: 'boolean' },
    ],
    equipment: [
        { key: 'tipo', label: 'Tipo', icon: '📦', type: 'static' },
        { key: 'categoriaArma', label: 'Cat. Arma', icon: '⚔️', type: 'static' },
        { key: 'liga', label: 'Liga', icon: '⚒️', type: 'static' },
        { key: 'formulaDano', label: 'Dano', icon: '💥', type: 'static' },
        { key: 'ehContainer', label: 'Container', icon: '🎒', type: 'boolean' },
    ],
    castingForms: [
        { key: 'requisito', label: 'Requisito', icon: '🔒', type: 'static' },
    ],
    conditions: [
        { key: 'removivel', label: 'Removível', icon: '♻️', type: 'boolean' },
        { key: 'afetaTabuleiro', label: 'Configura o Tabuleiro', icon: '🎲', type: 'boolean' },
    ],
    auras: [
        { key: 'tipo', label: 'Tipo', icon: '🌟', type: 'static' },
    ],
    bodyParts: [
        { key: 'ehPadrao', label: 'Padrão', icon: '⭐', type: 'boolean' },
    ],
    itemRules: [
        { key: 'ativo', label: 'Ativa', icon: '⚙️', type: 'boolean' },
    ],
    vitalStats: [
        { key: 'chaveInterna', label: 'Campo', icon: '❤️', type: 'static' },
    ],
    knowledge: [
        { key: 'modo', label: 'Liberação', icon: '🔐', type: 'static' },
    ],
    maneuvers: [
        { key: 'classe', label: 'Classe', icon: '⚔️', type: 'auto' },
    ],
    spells: [
        { key: 'escola', label: 'Escola', icon: '🔮', type: 'static' },
        { key: 'nivel', label: 'Nível', icon: '🔢', type: 'auto' },
        { key: 'classeRequerida', label: 'Classe', icon: '⚔️', type: 'auto' },
    ],
    runicElements: [
        { key: 'tipoElemento', label: 'Família', icon: 'ᛟ', type: 'static' },
        { key: 'categoria', label: 'Categoria', icon: '🔧', type: 'static' },
        { key: 'complexidade', label: 'Complexidade', icon: '📈', type: 'static' },
    ],
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

// =====================================================================
// GERENCIADOR DE CAMADAS DE MODAIS (Z-INDEX STACK)
// Garante que todo modal recém-aberto SEMPRE fique acima dos demais,
// independentemente da ordem no DOM ou de valores fixos de z-index.
// =====================================================================
let _modalZTop = 10000;
window.bringModalToTop = function (el) {
    if (!el) return;
    _modalZTop += 10;
    el.style.zIndex = String(_modalZTop);
    return _modalZTop;
};

// Lista de overlays conhecidos com sua função de fechamento.
// Usado por closeTopModal() (tecla ESC / clique fora) para fechar
// sempre o modal que estiver visualmente no topo.
function _getOpenOverlays() {
    const candidates = [
        { el: document.getElementById('ctMechModal'), close: () => document.getElementById('ctMechModal')?.remove() },
        { el: document.getElementById('subFormModalPeculiaridade'), close: () => window.closeSubFormPeculiaridade && window.closeSubFormPeculiaridade() },
        { el: document.getElementById('subFormModalValorDerivado'), close: () => window.closeSubFormValorDerivado && window.closeSubFormValorDerivado() },
        { el: document.getElementById('settingsModal'), close: () => window.closeSettingsModal && window.closeSettingsModal() },
        { el: document.getElementById('deleteModal'), close: () => window.closeDeleteModal && window.closeDeleteModal() },
        { el: document.getElementById('formModal'), close: () => window.closeForm && window.closeForm() },
    ];
    return candidates.filter(c => {
        if (!c.el) return false;
        const style = window.getComputedStyle(c.el);
        return style.display !== 'none' && style.visibility !== 'hidden';
    });
}

// Fecha o modal visível com maior z-index (o que está no topo da pilha)
window.closeTopModal = function () {
    const open = _getOpenOverlays();
    if (open.length === 0) {
        // Fallback: editor inline de mecânicas
        const editorArea = document.getElementById('mechanicsEditorArea');
        if (editorArea && editorArea.style.display !== 'none') {
            window._mechBack && window._mechBack();
            return true;
        }
        return false;
    }
    open.sort((a, b) => (parseInt(b.el.style.zIndex || 0, 10)) - (parseInt(a.el.style.zIndex || 0, 10)));
    open[0].close();
    return true;
};

// ===== SETTINGS MODAL (abre/fecha com controle de camada) =====
window.openSettingsModal = function () {
    const m = document.getElementById('settingsModal');
    if (!m) return;
    m.style.display = 'flex';
    m.classList.add('active');
    window.bringModalToTop(m);
};
window.closeSettingsModal = function () {
    const m = document.getElementById('settingsModal');
    if (!m) return;
    m.style.display = 'none';
    m.classList.remove('active');
};

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

    // Load initial module (Dashboard é a primeira aba)
    await window.switchModule('dashboard', document.querySelector('.tab[data-module="dashboard"]'));

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
    if (await LRDialogo.confirmar('🚪 Tem certeza que deseja sair?')) {
        try { await signOut(auth); window.location.href = '../index.html'; }
        catch (e) { showAlert('❌ Erro ao sair: ' + e.message, 'danger'); }
    }
};

// ===== MODULE SWITCHING =====
window.switchModule = function (moduleName, btnEl) {
    currentModule = moduleName;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    // Hide mechanics editor when switching away + limpar estado residual
    const mechArea = document.getElementById('mechanicsEditorArea');
    if (mechArea) mechArea.style.display = 'none';
    window._mechParentFieldKey = null;

    // O cabeçalho do painel vive só no Dashboard — as demais abas vão direto ao conteúdo.
    const isDash = moduleName === 'dashboard';
    const header = document.querySelector('.menu-header');
    if (header) header.style.display = isDash ? '' : 'none';
    document.getElementById('dashboardArea').style.display = isDash ? '' : 'none';
    document.getElementById('moduleContent').style.display = isDash ? 'none' : '';
    if (isDash) return loadDashboard();

    const modDef = MODULE_DEFS[moduleName];
    const titleEl = document.getElementById('createCardTitle');
    if (titleEl) titleEl.textContent = `Criar ${modDef.name}`;

    // Limpar busca da aba anterior (evita filtro "fantasma" ao trocar de módulo)
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';

    // Remove/add mechanic extra filters
    const oldFilters = document.getElementById('mechFiltersExtra');
    if (oldFilters) oldFilters.remove();
    if (moduleName === 'mechanics') renderMechExtraFilters();

    // Remove/add skills extra filters
    const oldSkillFilters = document.getElementById('skillsFiltersExtra');
    if (oldSkillFilters) oldSkillFilters.remove();
    if (moduleName === 'skills') renderSkillsExtraFilters();

    // Remove filtros dinâmicos do módulo anterior (serão remontados em loadModule)
    const oldModuleFilters = document.getElementById('moduleFiltersExtra');
    if (oldModuleFilters) oldModuleFilters.remove();



    // Remove/add tag filter for modules that have tags
    const oldTagFilter = document.getElementById('tagFilterArea');
    if (oldTagFilter) oldTagFilter.remove();

    // Botão de importação do Compêndio (Elementos Rúnicos)
    const seedBtn = document.getElementById('runicSeedBtn');
    if (seedBtn) seedBtn.style.display = moduleName === 'runicElements' ? '' : 'none';

    return loadModule(moduleName);
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

// =====================================================================
// FILTROS DINÂMICOS POR MÓDULO — renderização e estado
// =====================================================================
// Guarda as seleções por módulo para que a escolha do Criador seja
// preservada ao recarregar a aba (ex.: após salvar um registro).
const moduleFilterState = {};
function _getModuleFilterState() {
    return moduleFilterState[currentModule] || (moduleFilterState[currentModule] = {});
}

// Retorna a lista de filtros do módulo atual que estão realmente ativos.
function _getActiveModuleFilters() {
    const defs = MODULE_FILTERS[currentModule] || [];
    const active = [];
    defs.forEach(f => {
        const el = document.getElementById('modFilter_' + f.key);
        const val = el ? el.value : '';
        if (val === '') return;
        active.push({ key: f.key, type: f.type, value: val });
    });
    return active;
}

// Monta os dropdowns de filtro específicos do módulo atual.
function renderModuleFilters() {
    const old = document.getElementById('moduleFiltersExtra');
    if (old) old.remove();

    const defs = MODULE_FILTERS[currentModule];
    if (!defs || !defs.length) return;

    const modDef = MODULE_DEFS[currentModule] || {};
    const saved = _getModuleFilterState();

    const selects = defs.map(f => {
        let optionsHtml = `<option value="">${f.icon || '📌'} ${escapeHtml(f.label)}: Todos</option>`;

        if (f.type === 'boolean') {
            optionsHtml += `<option value="1">✅ ${escapeHtml(f.label)}: Sim</option>`;
            optionsHtml += `<option value="0">⬜ ${escapeHtml(f.label)}: Não</option>`;
        } else if (f.type === 'static') {
            const fieldDef = (modDef.fields || []).find(fl => fl.key === f.key);
            const opts = f.options || (fieldDef && fieldDef.options) || [];
            optionsHtml += opts.map(o => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join('');
        } else { // 'auto' — valores distintos existentes nos registros carregados
            const seen = new Map(); // normalizado -> valor original (para exibir)
            allItems.forEach(it => {
                const raw = it[f.key];
                if (raw === undefined || raw === null || raw === '') return;
                const norm = _norm(raw);
                if (!seen.has(norm)) seen.set(norm, String(raw));
            });
            let values = [...seen.values()];
            const allNumeric = values.length > 0 && values.every(v => v.trim() !== '' && !isNaN(Number(v)));
            values.sort(allNumeric
                ? (a, b) => Number(a) - Number(b)
                : (a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
            optionsHtml += values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
        }

        return `<select id="modFilter_${escapeHtml(f.key)}" class="filter-select" onchange="onModuleFilterChange(this)" title="Filtrar por ${escapeHtml(f.label)}">${optionsHtml}</select>`;
    });

    const div = document.createElement('div');
    div.className = 'mech-filters';
    div.id = 'moduleFiltersExtra';
    div.innerHTML = selects.join('');

    // Insere logo após os filtros específicos existentes (ou a barra de filtros)
    const anchor = document.getElementById('skillsFiltersExtra')
        || document.getElementById('mechFiltersExtra')
        || document.getElementById('filterBar');
    if (anchor) anchor.after(div);

    // Restaura seleções anteriores (descarta as que não existem mais)
    defs.forEach(f => {
        if (saved[f.key] == null) return;
        const el = document.getElementById('modFilter_' + f.key);
        if (!el) return;
        el.value = saved[f.key];
        if (el.value !== String(saved[f.key])) delete saved[f.key]; // opção sumiu
    });
}

window.onModuleFilterChange = function (sel) {
    const key = sel.id.replace('modFilter_', '');
    const state = _getModuleFilterState();
    if (sel.value === '') delete state[key];
    else state[key] = sel.value;
    renderItems();
};



// Modules that support tag filtering
const TAG_MODULES = ['peculiarities', 'mechanics', 'equipment'];
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

// ====================================================================
// DASHBOARD — contagem por coleção + últimas edições do cenário
// A contagem usa agregação no servidor (1 leitura por coleção); as
// últimas edições são 5 docs por coleção. Relê sempre que a aba abre —
// é barato e evita mostrar número velho depois de salvar algo.
// ====================================================================
let dashCache = null;

async function loadDashboard() {
    const area = document.getElementById('dashboardArea');
    if (!area) return;

    area.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted)">⏳ Lendo o cenário...</div>';
    dashCache = await Promise.all(Object.entries(MODULE_DEFS).map(async ([key, def]) => {
        const colRef = collection(db, def.collection);
        const [total, recentes] = await Promise.all([
            getCountFromServer(colRef).then(s => s.data().count).catch(() => null),
            getDocs(query(colRef, orderBy('updatedAt', 'desc'), limit(5)))
                .then(s => s.docs.map(d => ({ ...d.data(), id: d.id })))
                .catch(() => [])
        ]);
        return { key, def, total, recentes };
    }));
    renderDashboard();
}

function _dashData(item) {
    const secs = item.updatedAt?.seconds || item.atualizadoEm?.seconds || item.criadoEm?.seconds || 0;
    if (!secs) return '—';
    return new Date(secs * 1000).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function renderDashboard() {
    const area = document.getElementById('dashboardArea');
    if (!area || !dashCache) return;

    const totalGeral = dashCache.reduce((n, m) => n + (m.total || 0), 0);

    const cards = dashCache.map(m => `
        <button type="button" class="dash-card" onclick="dashOpen('${m.key}')" title="Abrir ${escapeHtml(m.def.namePlural || m.def.name)}">
            <span class="dash-card-icon">${m.def.icon || '📁'}</span>
            <span class="dash-card-count">${m.total ?? '—'}</span>
            <span class="dash-card-label">${escapeHtml(m.def.namePlural || m.def.name)}</span>
        </button>`).join('');

    const recentes = dashCache
        .flatMap(m => m.recentes.map(it => ({ it, m })))
        .sort((a, b) => (b.it.updatedAt?.seconds || 0) - (a.it.updatedAt?.seconds || 0))
        .slice(0, 15);

    const linhas = recentes.length ? recentes.map(({ it, m }) => `
        <tr onclick="dashOpen('${m.key}', '${it.id}')">
            <td><strong>${escapeHtml(it.nome || it.titulo || 'Sem nome')}</strong></td>
            <td>${m.def.icon || '📁'} ${escapeHtml(m.def.name)}</td>
            <td><span class="badge-status ${it.publicado ? 'badge-published' : 'badge-draft'}">${it.publicado ? '✅ Pub' : '📝 Rasc'}</span></td>
            <td class="td-sub">${_dashData(it)}</td>
        </tr>`).join('')
        : '<tr><td colspan="4" style="text-align:center;color:var(--muted)">Nada editado ainda.</td></tr>';

    area.innerHTML = `
        <div class="dash-head">
            <div class="dash-total">🗂️ <strong>${totalGeral}</strong> registros em ${dashCache.length} coleções</div>
            <button type="button" class="btn-edit" onclick="dashRefresh()" title="Recarregar contagens">🔄 Atualizar</button>
        </div>
        <div class="dash-grid">${cards}</div>
        <div id="dashTabuleiro"></div>
        <div class="skills-category-header">🕒 Últimas edições <span class="skills-category-count">${recentes.length}</span></div>
        <div class="table-container">
            <table class="users-table items-table">
                <thead><tr><th>Registro</th><th>Coleção</th><th>Status</th><th>Editado em</th></tr></thead>
                <tbody>${linhas}</tbody>
            </table>
        </div>`;

    // Diagnóstico do Tabuleiro: precisa dos módulos de classe e das mecânicas
    // carregados, então vem depois e por conta própria.
    Promise.all([refreshClassModulesCache?.(), refreshMechanicsCache?.()])
        .then(() => renderDiagnosticoTabuleiro())
        .catch(() => renderDiagnosticoTabuleiro());
}

/* ============================================================
   🎲 O QUE O TABULEIRO NÃO INTERPRETA — e por quê
   Roda o MESMO interpretador do Tabuleiro (shared/skill-runtime.js) sobre
   todas as habilidades pré-definidas. O painel não pode discordar da mesa:
   se aqui aparece "ok", lá funciona; se aqui falta um campo, lá cai no
   diálogo "Como aplicar". A lista diz qual campo preencher.
   ============================================================ */
async function renderDiagnosticoTabuleiro() {
    const box = document.getElementById('dashTabuleiro');
    if (!box) return;
    box.innerHTML = '<div class="skills-category-header">🎲 Leitura do Tabuleiro <span class="skills-category-count">…</span></div>';

    try {
        const [{ indexarPredefs, interpretarSkill }, { custosDaSkill, moduloDeclaraCusto, custoDeclaradoZero }, { custoDaMecanica }] = await Promise.all([
            import('../../shared/skill-runtime.js?v=3'),
            import('../../shared/skill-custo.js?v=2'),
            import('../../shared/combate-cenas.js'),
        ]);

        const modulos = (classModulesCache || []).filter(m => m && m.publicado !== false);
        const idx = indexarPredefs(modulos);
        const mechPorId = (id) => (mechanicsCache || []).find(m => m.id === id);

        const problemas = [];
        let total = 0;
        for (const mod of modulos) {
            for (const pd of mod.itensPredefinidos || []) {
                total++;
                // O item da ficha nasce do pré-definido: é assim que a mesa o vê.
                const r = interpretarSkill({ _predefId: pd.id, _predefNome: pd.nome }, {
                    idx, custosDaSkill, moduloDeclaraCusto, custoDeclaradoZero, mechPorId, custoDaMecanica, registroOk: true,
                });
                if (!r.diagnostico.ok) problemas.push({ mod, pd, d: r.diagnostico });
            }
        }

        const ok = total - problemas.length;
        const pct = total ? Math.round((ok / total) * 100) : 100;

        const linhas = problemas.map(({ mod, pd, d }) => `
            <tr>
                <td><strong>${escapeHtml(pd.nome || '(sem nome)')}</strong></td>
                <td>${escapeHtml(mod.icone || '📦')} ${escapeHtml(mod.titulo || mod.id)}</td>
                <td>${d.faltas.map(f => `<div class="dash-falta"><code>${escapeHtml(f.campo)}</code> ${escapeHtml(f.porque)}</div>`).join('')}</td>
            </tr>`).join('');

        box.innerHTML = `
            <div class="skills-category-header">🎲 Leitura do Tabuleiro
                <span class="skills-category-count">${ok}/${total} · ${pct}%</span>
            </div>
            <div class="dash-tab-resumo ${problemas.length ? 'tem-falta' : 'tudo-ok'}">
                ${problemas.length
                    ? `⚠️ <strong>${problemas.length}</strong> habilidade(s) o Tabuleiro NÃO consegue aplicar sozinho — vão cair na janela “Como aplicar”. O que falta em cada uma está abaixo.`
                    : '✅ Todas as habilidades cadastradas são aplicadas automaticamente pelo Tabuleiro.'}
            </div>
            ${problemas.length ? `<div class="table-container">
                <table class="users-table items-table">
                    <thead><tr><th>Habilidade</th><th>Módulo</th><th>O que falta preencher</th></tr></thead>
                    <tbody>${linhas}</tbody>
                </table>
            </div>` : ''}`;
    } catch (e) {
        console.error(e);
        box.innerHTML = `<div class="skills-category-header">🎲 Leitura do Tabuleiro</div>
            <div class="dash-tab-resumo tem-falta">❌ Não foi possível rodar o diagnóstico: ${escapeHtml(String(e.message || e))}</div>`;
    }
}

window.dashRefresh = () => loadDashboard();

// Abre uma aba a partir do Dashboard — e, com id, já abre o registro.
window.dashOpen = async function (moduleName, itemId) {
    await window.switchModule(moduleName, document.querySelector(`.tab[data-module="${moduleName}"]`));
    if (!itemId) return;
    if (moduleName === 'mechanics') window.openMechanicEditor(itemId);
    else window.openForm(itemId);
};

// ===== LOAD MODULE DATA =====
async function loadModule(moduleName) {
    const modDef = MODULE_DEFS[moduleName];
    if (!modDef) return;

    // Always refresh essential caches used by Mechanics Editor across any module
    await Promise.all([
        refreshMechanicsCache(),
        refreshSkillsCache(),
        refreshDerivedValuesCache(),
        refreshVitalStatsCache(),
        refreshConditionsCache(),
        refreshBodyPartsCache(),
        refreshClassesCache(),
        // ᛟ Elementos Rúnicos: usados como alvos no pool da mecânica "Distribuir"
        refreshRunicElementsCache(),
        // Equipamentos agora são usados pelo editor de Módulos da Classe (custos)
        // e pelo editor de Mecânicas (Conceder Equipamento) em qualquer aba
        refreshEquipmentCache()
    ]);

    // Module-specific caches
    if (moduleName === 'races' || moduleName === 'classes' || moduleName === 'tribes') await refreshPeculiaritiesCache();
    if (moduleName === 'classes' || moduleName === 'classModules') {
        await refreshManeuversCache();
        await refreshEquipmentCache();
    }
    if (moduleName === 'classes' || moduleName === 'classModules') {
        await refreshClassModulesCache();
        // Migração automática: módulos inline -> coleção centralizada
        await _migrateInlineModulesToCollection();
    }
    if (moduleName === 'peculiarities') await refreshAurasCache();
    // Livros: a aba Conhecimento tranca capítulos; raça/classe/tribo vinculam um livro.
    if (['knowledge', 'races', 'classes', 'tribes'].includes(moduleName)) await refreshWorldbuildingCache();

    const grid = document.getElementById('itemsGrid');
    const emptyState = document.getElementById('emptyState');
    grid.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted)">⏳ Carregando...</div>';
    emptyState.style.display = 'none';

    try {
        const colRef = collection(db, modDef.collection);
        const snapshot = await getDocs(colRef);
        allItems = [];
        snapshot.forEach(d => allItems.push({ ...d.data(), id: d.id }));

        // Sort by ordem or nome
        allItems.sort((a, b) => {
            if (a.ordem !== undefined && b.ordem !== undefined) return a.ordem - b.ordem;
            const nameA = (a.nome || a.titulo || '').toLowerCase();
            const nameB = (b.nome || b.titulo || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });

        // Render tag filter chips (preserve existing selections)
        renderTagFilter();

        // Filtros dinâmicos específicos do módulo (ex.: Bloco em Valores Derivados)
        renderModuleFilters();

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
        snap.forEach(d => mechanicsCache.push({ ...d.data(), id: d.id }));
        mechanicsCache.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        window._mechCache = mechanicsCache;
    } catch (e) { console.error('Erro cache mecânicas:', e); }
}

async function refreshPeculiaritiesCache() {
    try {
        const snap = await getDocs(collection(db, 'system/data/peculiarities'));
        peculiaritiesCache = [];
        snap.forEach(d => peculiaritiesCache.push({ ...d.data(), id: d.id }));
        peculiaritiesCache.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        window._peculiaritiesCache = peculiaritiesCache;
    } catch (e) { console.error('Erro cache peculiaridades:', e); }
}

async function refreshSkillsCache() {
    try {
        const snap = await getDocs(collection(db, 'system/data/skills'));
        skillsCache = [];
        snap.forEach(d => skillsCache.push({ ...d.data(), id: d.id }));
        skillsCache.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        window._skillsCache = skillsCache;
    } catch (e) { console.error('Erro cache skills:', e); }
}

async function refreshDerivedValuesCache() {
    try {
        const snap = await getDocs(collection(db, 'system/data/derivedValues'));
        derivedValuesCache = [];
        snap.forEach(d => derivedValuesCache.push({ ...d.data(), id: d.id }));
        derivedValuesCache.sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
        window._derivedValuesCache = derivedValuesCache;
    } catch (e) { console.error('Erro cache derivedValues:', e); }
}

async function refreshConditionsCache() {
    try {
        const snap = await getDocs(collection(db, 'system/data/conditions'));
        conditionsCache = [];
        snap.forEach(d => conditionsCache.push({ ...d.data(), id: d.id }));
        conditionsCache.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        window._conditionsCache = conditionsCache;
    } catch (e) { console.error('Erro cache conditions:', e); }
}

async function refreshVitalStatsCache() {
    try {
        const snap = await getDocs(collection(db, 'system/data/vitalStats'));
        vitalStatsCache = [];
        snap.forEach(d => vitalStatsCache.push({ ...d.data(), id: d.id }));
        vitalStatsCache.sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
        window._vitalStatsCache = vitalStatsCache;
    } catch (e) { console.error('Erro cache vitalStats:', e); }
}



async function refreshAurasCache() {
    try {
        const snap = await getDocs(collection(db, 'system/data/auras'));
        aurasCache = [];
        snap.forEach(d => aurasCache.push({ ...d.data(), id: d.id }));
        aurasCache.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    } catch (e) { console.error('Erro cache auras:', e); }
}

async function refreshManeuversCache() {
    try {
        const snap = await getDocs(collection(db, 'system/data/maneuvers'));
        maneuversCache = [];
        snap.forEach(d => maneuversCache.push({ ...d.data(), id: d.id }));
        maneuversCache.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        window._maneuversCache = maneuversCache;
    } catch (e) { console.error('Erro cache maneuvers:', e); }
}

async function refreshEquipmentCache() {
    try {
        const snap = await getDocs(collection(db, 'system/data/equipment'));
        equipmentCache = [];
        snap.forEach(d => equipmentCache.push({ ...d.data(), id: d.id }));
        equipmentCache.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        window._equipmentCache = equipmentCache;
    } catch (e) { console.error('Erro cache equipment:', e); }
}

async function refreshClassesCache() {
    try {
        const snap = await getDocs(collection(db, 'system/data/classes'));
        const classes = [];
        snap.forEach(d => classes.push({ ...d.data(), id: d.id }));
        classes.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        // Consumido por _getModuleLimitOptions() no editor de mecânicas
        // (opções "Limite: <módulo>") — antes nunca era populado.
        window._classesCache = classes;
    } catch (e) { console.error('Erro cache classes:', e); }
}

async function refreshClassModulesCache() {
    try {
        const snap = await getDocs(collection(db, 'system/data/classModules'));
        classModulesCache = [];
        snap.forEach(d => classModulesCache.push({ ...d.data(), id: d.id }));
        classModulesCache.sort((a, b) => (a.titulo || '').localeCompare(b.titulo || ''));
        window._classModulesCache = classModulesCache;
    } catch (e) { console.error('Erro cache classModules:', e); }
}

// ᛟ Elementos Rúnicos — consumidos pelo editor de Mecânicas
// (pool de alvos da mecânica "Distribuir").
async function refreshRunicElementsCache() {
    try {
        const snap = await getDocs(collection(db, 'system/data/runicElements'));
        const list = [];
        snap.forEach(d => list.push({ ...d.data(), id: d.id }));
        list.sort((a, b) => (a.ordem ?? 999) - (b.ordem ?? 999) || (a.nome || '').localeCompare(b.nome || ''));
        window._runicElementsCache = list;
    } catch (e) { console.error('Erro cache runicElements:', e); }
}

// 📚 Livros + capítulos do Escritório do Cronista (coleções raiz, fora de system/data).
async function refreshWorldbuildingCache() {
    try {
        const [bSnap, aSnap] = await Promise.all([
            getDocs(collection(db, 'worldbuilding-books')),
            getDocs(collection(db, 'worldbuilding-articles')),
        ]);
        wbBooksCache = [];
        bSnap.forEach(d => wbBooksCache.push({ ...d.data(), id: d.id }));
        wbBooksCache.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.title || '').localeCompare(b.title || ''));
        wbChaptersCache = [];
        aSnap.forEach(d => wbChaptersCache.push({ ...d.data(), id: d.id }));
        wbChaptersCache.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    } catch (e) { console.error('Erro cache worldbuilding:', e); }
}

async function refreshBodyPartsCache() {
    try {
        const snap = await getDocs(collection(db, 'system/data/bodyParts'));
        bodyPartsCache = [];
        snap.forEach(d => bodyPartsCache.push({ ...d.data(), id: d.id }));
        bodyPartsCache.sort((a, b) => (a.ordem || 99) - (b.ordem || 99));
        window._bodyPartsCache = bodyPartsCache;
    } catch (e) { console.error('Erro cache bodyParts:', e); }
}

// ===== RENDER ITEMS =====

// Meta-chips específicos por módulo — mostram só o que importa em cada aba,
// tornando os cards mais informativos sem abrir o formulário.
const SKILL_CAT_SHORT = { fisico: '💪 Físico', mental: '🧠 Mental', social: '🗣️ Social', combate: '⚔️ Combate', exclusivo: '🌟 Exclusivo' };
const PEC_FONTE_SHORT = { raca: '🧬 Raça', classe: '⚔️ Classe', tribo: '🏕️ Tribo', condicao: '💀 Condição', individual: '👤 Individual', generica: '⚙️ Genérica' };

function _countLinks(item, keys) {
    let n = 0;
    keys.forEach(k => { if (Array.isArray(item[k])) n += item[k].length; });
    return n;
}

function _buildCardMetaChips(item) {
    const chips = [];
    const add = (text, cls = '') => { if (text) chips.push(`<span class="meta-chip ${cls}">${text}</span>`); };
    const mechCount = _countLinks(item, ['mecanicaIds', 'efeitoMecanicaIds']);
    const pecCount = _countLinks(item, ['peculiaridadeIds', 'bonusIniciais']);

    switch (currentModule) {
        case 'races':
            add(item.expectativaVida ? `⏳ ${escapeHtml(item.expectativaVida)}` : '');
            if (pecCount) add(`✨ ${pecCount} pecul.`);
            if (Array.isArray(item.partesDoCorpo) && item.partesDoCorpo.length) add(`🦴 ${item.partesDoCorpo.length} partes`);
            break;
        case 'classes':
            add(item.usaRunomancia ? 'ᛟ Runomancia' : '', 'chip-accent');
            if (pecCount) add(`✨ ${pecCount} pecul.`);
            if (Array.isArray(item.manobras) && item.manobras.length) add(`💥 ${item.manobras.length} manobras`);
            if (Array.isArray(item.modulosDaClasse) && item.modulosDaClasse.length) add(`📦 ${item.modulosDaClasse.length} módulos`);
            break;
        case 'tribes':
            if (pecCount) add(`✨ ${pecCount} pecul.`);
            if (Array.isArray(item.unidadesMilitares) && item.unidadesMilitares.length) add(`🛡️ ${item.unidadesMilitares.length} unidades`);
            break;
        case 'peculiarities':
            add(PEC_FONTE_SHORT[item.fonte] || '', 'chip-accent');
            add(item.quandoSeAplica === 'na_criacao' ? '🎲 Na criação' : '♻️ Passivo');
            if (item.concedeAura || item.auraVinculadaId) add('🌟 Concede Aura', 'chip-gold');
            if (mechCount) add(`🔧 ${mechCount}`);
            break;
        case 'skills':
            add(SKILL_CAT_SHORT[(item.categoria || '').toLowerCase()] || '', 'chip-accent');
            if (Array.isArray(item.atributoBase) && item.atributoBase.length) add(`🎯 ${item.atributoBase.map(escapeHtml).join('/')}`);
            if (item.custoEvolucao != null && item.custoEvolucao !== '') add(`⭐ ${escapeHtml(item.custoEvolucao)} EXP/nv`);
            if (item.todoPersonagem) add('👥 Todos', 'chip-gold');
            break;
        case 'equipment':
            add(item.tipo ? escapeHtml(item.tipo) : '', 'chip-accent');
            // Peso em kg, Tamanho em metros (fracionado: 0,1 = 10 cm).
            if (item.peso != null) add(`⚖️ ${escapeHtml(item.peso)} kg`);
            if (item.tamanho != null) add(`📐 ${escapeHtml(item.tamanho)} m`);
            if (item.ehContainer) add(`📦 Container${item.capacidadeContainer ? ' ×' + escapeHtml(item.capacidadeContainer) : ''}`, 'chip-gold');
            if (mechCount) add(`🔧 ${mechCount}`);
            break;
        case 'castingForms': {
            const REQ = { item_tag: '🎒 Exige item', parte_corpo: '🦴 Exige parte do corpo', nenhum: '✅ Sempre disponível' };
            add(REQ[item.requisito] || REQ.nenhum, 'chip-accent');
            if (Array.isArray(item.derivedValueIds) && item.derivedValueIds.length) add(`📊 ${item.derivedValueIds.length} VD`);
            if (Array.isArray(item.itemTags) && item.itemTags.length) add(`🏷️ ${item.itemTags.map(escapeHtml).join(', ')}`);
            if (Array.isArray(item.partesDoCorpoNomes) && item.partesDoCorpoNomes.length) add(`🦴 ${item.partesDoCorpoNomes.map(escapeHtml).join(', ')}`);
            if (Array.isArray(item.condicoesBloqueiam) && item.condicoesBloqueiam.length) add(`💀 ${item.condicoesBloqueiam.length} bloqueiam`, 'chip-gold');
            break;
        }
        case 'conditions': {
            add(item.duracao ? `⏱️ ${escapeHtml(item.duracao)}` : '');
            add(item.removivel ? '🔓 Removível' : '🔒 Permanente');
            if (mechCount) add(`🔧 ${mechCount}`);
            if (item.acumulaNiveis) add(`📈 Até nv ${item.nivelMaximo ?? '∞'}`, 'chip-accent');
            if (item.testeParaSair) add(`🎲 ${escapeHtml(item.testeNome || 'teste')}`, 'chip-accent');
            // O que a condição faz no Tabuleiro, resumido — dá para bater o olho
            // na lista e ver quais já estão configuradas e quais faltam.
            if (item.afetaTabuleiro) {
                const vtt = [];
                if (Array.isArray(item.bloqueiaAcoes) && item.bloqueiaAcoes.length) vtt.push(`🚫 ${item.bloqueiaAcoes.length} ação(ões)`);
                if (item.perdeTurno) vtt.push('💤 Perde o turno');
                if (item.multiplicadorDeslocamento != null) vtt.push(`🏃 ×${escapeHtml(item.multiplicadorDeslocamento)}`);
                if (item.multiplicadorVisao != null) vtt.push(`👁️ ×${escapeHtml(item.multiplicadorVisao)}`);
                if (item.naoPodeSerAlvo) vtt.push('🛡️ Sem alvo');
                if (item.atraiAlvo) vtt.push('🎯 Atrai');
                if (item.porRodadaEfeito) vtt.push(`🩸 ${escapeHtml(item.porRodadaValor || '?')}/rodada`);
                add('🎲 Tabuleiro', 'chip-gold');
                vtt.forEach(t => add(t));
            }
            break;
        }
        case 'derivedValues':
            add(item.blocoNome ? `🗂️ ${escapeHtml(item.blocoNome)}` : '', 'chip-accent');
            if (item.ordem != null) add(`#${escapeHtml(item.ordem)}`);
            if (item.todoPersonagem) add('👥 Todos', 'chip-gold');
            if (item.campoAtual) add('✏️ Atual');
            if (item.statusCombate) add('⚔️ Combate', 'chip-gold');
            if (mechCount) add(`🔧 ${mechCount}`);
            break;
        case 'vitalStats':
            add(item.chaveInterna ? `🔑 ${escapeHtml(item.chaveInterna)}` : '', 'chip-accent');
            if (item.ordem != null) add(`#${escapeHtml(item.ordem)}`);
            if (mechCount) add(`🔧 ${mechCount}`);
            break;
        case 'maneuvers':
            add(item.classe ? `⚔️ ${escapeHtml(item.classe)}` : '', 'chip-accent');
            add(item.custo ? `⚡ ${escapeHtml(item.custo)}` : '');
            if (mechCount) add(`🔧 ${mechCount}`);
            break;
        case 'spells':
            add(item.escola ? `🔮 ${escapeHtml(item.escola)}` : '', 'chip-accent');
            if (item.nivel != null) add(`Nv ${escapeHtml(item.nivel)}`);
            add(item.custo ? `⚡ ${escapeHtml(item.custo)}` : '');
            add(item.alcance ? `📏 ${escapeHtml(item.alcance)}` : '');
            break;
        case 'auras':
            add(item.tipo === 'mortalidade' ? '💀 Mortalidade' : '📊 Propriedade', 'chip-accent');
            if (item.propriedadeVinculada) add(`🔗 ${escapeHtml(item.propriedadeVinculada)}`);
            if (Array.isArray(item.graus) && item.graus.length) add(`🌟 ${item.graus.length} graus`);
            break;
        case 'itemRules':
            add(item.ativo ? '🟢 Ativa' : '🔴 Inativa', item.ativo ? 'chip-gold' : '');
            if (item.ordem != null) add(`#${escapeHtml(item.ordem)}`);
            if (mechCount) add(`🔧 ${mechCount}`);
            break;
        case 'bodyParts':
            if (item.ehPadrao) add('⭐ Padrão', 'chip-gold');
            if (item.podeSegurar) add('🤲 Segura');
            if (item.podeEmpunhar) add('🗡️ Empunha');
            if (item.podeVestir) add('🧥 Veste');
            if (item.podeFixar) add('📌 Fixa');
            break;
        case 'classModules': {
            const TIPO_CM = { lista: '📋 Lista', grimorio: '📖 Grimório', runomancia: 'ᛟ Runomancia' };
            add(TIPO_CM[item.tipo] || '', 'chip-accent');
            if (Array.isArray(item.schema) && item.schema.length) add(`📋 ${item.schema.length} campos`);
            if (Array.isArray(item.itensPredefinidos) && item.itensPredefinidos.length) add(`🗂️ ${item.itensPredefinidos.length} pré-def`);
            if (item.custoExpPorItem) add(`⭐ ${item.custoExpPorItem} EXP/item`);
            if (item.limiteFixo != null) add(`🎯 Limite: ${item.limiteFixo}`);
            break;
        }
        case 'knowledge': {
            const reqs = Array.isArray(item.requisitos) ? item.requisitos : [];
            add(item.modo === 'qualquer' ? '🔀 Basta um' : '🔗 Todos', 'chip-accent');
            add(reqs.length ? `🔐 ${reqs.length} requisito${reqs.length > 1 ? 's' : ''}` : '🔓 Sem requisito — liberado');
            if (item.dica) add('💡 Com dica', 'chip-tag');
            break;
        }
        case 'runicElements': {
            const fam = { artus: 'ᛞ Artus', aspectus: 'ᛟ Aspectus', sigilus: 'ᛝ Sigilus' };
            add(fam[item.tipoElemento] || '', 'chip-accent');
            if (item.categoria) add(`⚙️ ${escapeHtml(item.categoria)}`);
            if (item.complexidade) add(`🎓 ${escapeHtml(item.complexidade)}`);
            if (item.maxNivel != null) add(`📈 Máx Nv ${escapeHtml(item.maxNivel)}`);
            if (item.nomeLatim) add(`🏛️ ${escapeHtml(item.nomeLatim)}`, 'chip-tag');
            break;
        }
    }

    // Tags (comum a vários módulos) — mostra até 3
    if (Array.isArray(item.tags) && item.tags.length) {
        item.tags.slice(0, 3).forEach(t => add(`🏷️ ${escapeHtml(t)}`, 'chip-tag'));
        if (item.tags.length > 3) add(`+${item.tags.length - 3}`, 'chip-tag');
    }

    return chips.length ? `<div class="item-card-meta">${chips.join('')}</div>` : '';
}

function buildItemCardHTML(item) {
    const name = escapeHtml(item.nome || item.titulo || 'Sem nome');
    const subtitle = item.subtitulo || item.arquetipo || '';
    const desc = item.descricao || item.conteudo || item.efeito || '';
    const isPublished = item.publicado === true;
    const badgeClass = isPublished ? 'badge-published' : 'badge-draft';
    const badgeText = isPublished ? '✅ Publicado' : '📝 Rascunho';
    const imageUrl = item.imagemUrl || '';
    const icon = item.icone ? `<span class="item-card-icon">${escapeHtml(item.icone)}</span> ` : '';

    return `
        <div class="item-card" onclick="openForm('${item.id}')">
            <div class="item-card-header">
                <div class="item-card-name">${icon}${name}</div>
                <span class="badge-status ${badgeClass}">${badgeText}</span>
            </div>
            ${subtitle ? `<div class="item-card-subtitle">${escapeHtml(subtitle)}</div>` : ''}
            ${_buildCardMetaChips(item)}
            ${imageUrl ? `<div class="item-card-image"><img src="${escapeHtml(imageUrl)}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'"></div>` : ''}
            ${desc ? `<div class="item-card-desc">${escapeHtml(truncate(desc, 120))}</div>` : ''}
            <div class="item-card-footer">
                <div class="item-card-actions">
                    <button class="btn-edit" onclick="event.stopPropagation(); openForm('${item.id}')" title="Editar">✏️</button>
                    <button class="btn-edit" onclick="event.stopPropagation(); duplicateItem('${item.id}')" title="Duplicar" style="border-color:var(--warning);color:var(--warning)">📋</button>
                    <button class="btn-delete-card" onclick="event.stopPropagation(); openDeleteModal('${item.id}')" title="Excluir">🗑️</button>
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

// Normaliza texto para busca: minúsculas + remove acentos (ex.: "condição" ⇔ "condicao")
function _norm(str) {
    return String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Retorna true se algum filtro estiver ativo (usado no empty-state inteligente)
function _hasActiveFilters() {
    if ((document.getElementById('searchInput')?.value || '').trim()) return true;
    if (document.getElementById('filterPublished')?.checked) return true;
    if (document.getElementById('mechFilterFonte')?.value) return true;
    if (document.getElementById('mechFilterTipo')?.value) return true;
    if (document.getElementById('skillFilterCategoria')?.value) return true;
    if (getSelectedTags().size > 0) return true;
    if (_getActiveModuleFilters().length > 0) return true;
    return false;
}

window.clearAllFilters = function () {
    const search = document.getElementById('searchInput');
    if (search) search.value = '';
    const pub = document.getElementById('filterPublished');
    if (pub) pub.checked = false;
    const fonte = document.getElementById('mechFilterFonte');
    if (fonte) fonte.value = '';
    const tipo = document.getElementById('mechFilterTipo');
    if (tipo) tipo.value = '';
    const cat = document.getElementById('skillFilterCategoria');
    if (cat) cat.value = '';
    getSelectedTags().clear();
    document.querySelectorAll('#tagFilterArea .tag-filter-chip.active').forEach(b => b.classList.remove('active'));
    // Limpar filtros dinâmicos do módulo atual
    (MODULE_FILTERS[currentModule] || []).forEach(f => {
        const el = document.getElementById('modFilter_' + f.key);
        if (el) el.value = '';
    });
    delete moduleFilterState[currentModule];
    renderItems();
};

window.clearSearch = function () {
    const search = document.getElementById('searchInput');
    if (search) { search.value = ''; search.focus(); }
    renderItems();
};

function _updateResultsCount(shown, total) {
    const el = document.getElementById('resultsCount');
    if (!el) return;
    if (total === 0) { el.textContent = ''; return; }
    el.textContent = shown === total ? `${total} registro(s)` : `${shown} de ${total}`;
}

// ===== MODO DE EXIBIÇÃO (cards / lista / planilha) — lembrado no navegador =====
const VIEW_KEY = 'painel-criador-view';
let currentView = localStorage.getItem(VIEW_KEY) || 'cards';

window.setViewMode = function (view) {
    currentView = view;
    localStorage.setItem(VIEW_KEY, view);
    _syncViewButtons();
    renderItems();
};

function _syncViewButtons() {
    document.querySelectorAll('#viewSwitch .view-btn')
        .forEach(b => b.classList.toggle('active', b.dataset.view === currentView));
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _syncViewButtons);
else _syncViewButtons();

// Onde o clique na linha/card leva: mecânica tem editor próprio.
function _openCall(id) {
    return currentModule === 'mechanics' ? `openMechanicEditor('${id}')` : `openForm('${id}')`;
}

function _buildItemsTableHTML(section) {
    const rows = section.items.map(item => {
        const isPub = item.publicado === true;
        const name = escapeHtml(item.nome || item.titulo || 'Sem nome');
        const icon = item.icone ? escapeHtml(item.icone) + ' ' : '';
        const sub = item.subtitulo || item.arquetipo || '';
        const desc = item.descricao || item.conteudo || item.efeito || item.previewTexto || '';
        return `
        <tr onclick="${_openCall(item.id)}">
            <td><strong>${icon}${name}</strong>${sub ? `<div class="td-sub">${escapeHtml(sub)}</div>` : ''}</td>
            <td>${_buildCardMetaChips(item) || '<span class="td-sub">—</span>'}</td>
            <td class="td-desc">${desc ? escapeHtml(truncate(desc, 110)) : '—'}</td>
            <td><span class="badge-status ${isPub ? 'badge-published' : 'badge-draft'}">${isPub ? '✅ Pub' : '📝 Rasc'}</span></td>
            <td onclick="event.stopPropagation()">
                <div class="item-card-actions">
                    <button class="btn-edit" onclick="${_openCall(item.id)}" title="Editar">✏️</button>
                    <button class="btn-edit" onclick="duplicateItem('${item.id}')" title="Duplicar" style="border-color:var(--warning);color:var(--warning)">📋</button>
                    <button class="btn-delete-card" onclick="openDeleteModal('${item.id}')" title="Excluir">🗑️</button>
                    <div class="toggle-publish" title="Publicado">
                        <input type="checkbox" ${isPub ? 'checked' : ''} onchange="togglePublish('${item.id}', this.checked)">
                        <span class="toggle-slider"></span>
                    </div>
                </div>
            </td>
        </tr>`;
    }).join('');

    return `${_sectionHeaderHTML(section)}
        <div class="table-container">
            <table class="users-table items-table">
                <thead><tr><th>Registro</th><th>Informações</th><th class="td-desc">Descrição</th><th>Status</th><th>Ações</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}

function _sectionHeaderHTML(section) {
    if (!section.title) return '';
    return `<div class="skills-category-header">${escapeHtml(section.title)} <span class="skills-category-count">${section.items.length}</span></div>`;
}

function _updateClearSearchBtn() {
    const btn = document.getElementById('btnClearSearch');
    const search = document.getElementById('searchInput');
    if (btn) btn.style.display = (search && search.value) ? '' : 'none';
}

function renderItems() {
    const grid = document.getElementById('itemsGrid');
    const emptyState = document.getElementById('emptyState');
    const searchVal = _norm(document.getElementById('searchInput')?.value || '').trim();
    const onlyPublished = document.getElementById('filterPublished')?.checked || false;
    const activeModFilters = _getActiveModuleFilters();

    _updateClearSearchBtn();

    let filtered = allItems.filter(item => {
        // Busca profunda: nome/título, subtítulo, descrição, conteúdo, efeito e tags
        if (searchVal) {
            const haystack = _norm([
                item.nome, item.titulo, item.subtitulo, item.arquetipo,
                item.descricao, item.conteudo, item.efeito, item.categoria,
                item.escola, item.classe, item.fonte,
                Array.isArray(item.tags) ? item.tags.join(' ') : ''
            ].filter(Boolean).join(' '));
            if (!haystack.includes(searchVal)) return false;
        }
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

        // Tag filter
        const selTags = getSelectedTags();
        if (selTags.size > 0) {
            const itemTags = Array.isArray(item.tags) ? item.tags : [];
            if (!itemTags.some(t => selTags.has(t))) return false;
        }

        // Filtros dinâmicos por módulo (data-driven)
        for (const mf of activeModFilters) {
            if (mf.type === 'boolean') {
                const want = mf.value === '1';
                if (Boolean(item[mf.key]) !== want) return false;
            } else {
                if (_norm(item[mf.key]) !== _norm(mf.value)) return false;
            }
        }
        return true;
    });

    // Ordenação escolhida pelo usuário
    const sortVal = document.getElementById('sortSelect')?.value || 'padrao';
    if (sortVal === 'nome') {
        filtered = [...filtered].sort((a, b) => _norm(a.nome || a.titulo).localeCompare(_norm(b.nome || b.titulo)));
    } else if (sortVal === 'recente') {
        filtered = [...filtered].sort((a, b) => {
            const ta = a.atualizadoEm?.seconds || a.updatedAt?.seconds || 0;
            const tb = b.atualizadoEm?.seconds || b.updatedAt?.seconds || 0;
            return tb - ta;
        });
    }

    _updateResultsCount(filtered.length, allItems.length);

    if (filtered.length === 0) {
        grid.innerHTML = '';
        emptyState.style.display = 'block';
        // Estado vazio inteligente: distingue "nenhum registro" de "nenhum resultado"
        const emptyIcon = emptyState.querySelector('.icon');
        const emptyText = emptyState.querySelector('.text');
        const emptyHint = emptyState.querySelector('.hint');
        if (_hasActiveFilters() && allItems.length > 0) {
            if (emptyIcon) emptyIcon.textContent = '🔍';
            if (emptyText) emptyText.textContent = 'Nenhum resultado para os filtros aplicados';
            if (emptyHint) emptyHint.innerHTML = '<button type="button" class="btn-clear-filters" onclick="clearAllFilters()">🧹 Limpar filtros</button>';
        } else {
            if (emptyIcon) emptyIcon.textContent = '📭';
            if (emptyText) emptyText.textContent = 'Nenhum registro encontrado';
            if (emptyHint) emptyHint.textContent = 'Clique no card acima para criar o primeiro!';
        }
        return;
    }

    emptyState.style.display = 'none';

    // Seções (com cabeçalho de grupo). A lista é a mesma nos três modos de exibição.
    let sections = [{ title: null, items: filtered }];

    // Skills: group by category if checkbox is checked
    if (currentModule === 'skills' && document.getElementById('skillGroupByCategoria')?.checked) {
        const groups = {};
        filtered.forEach(item => {
            const cat = (item.categoria || 'mental').toLowerCase();
            (groups[cat] || (groups[cat] = [])).push(item);
        });
        const cats = [...SKILL_CATEGORIA_ORDER, ...Object.keys(groups).filter(c => !SKILL_CATEGORIA_ORDER.includes(c))];
        sections = cats.filter(c => groups[c]?.length)
            .map(c => ({ title: SKILL_CATEGORIA_LABELS[c] || c, items: groups[c] }));
    }

    // Derived Values: group by block
    if (currentModule === 'derivedValues') {
        const groups = {};
        const blockOrders = {};
        const blockNames = {};

        filtered.forEach(item => {
            const blockId = item.blocoId || 'uncategorized';
            if (!groups[blockId]) {
                groups[blockId] = [];
                blockOrders[blockId] = item.blocoOrdem || 999;
                blockNames[blockId] = item.blocoNome || 'Sem Bloco (Desagrupado)';
            }
            if (item.blocoOrdem && blockOrders[blockId] === 999) blockOrders[blockId] = item.blocoOrdem;
            if (item.blocoNome && blockNames[blockId] === 'Sem Bloco (Desagrupado)') blockNames[blockId] = item.blocoNome;

            groups[blockId].push(item);
        });

        sections = Object.keys(groups).sort((a, b) => {
            if (blockOrders[a] !== blockOrders[b]) return blockOrders[a] - blockOrders[b];
            return blockNames[a].localeCompare(blockNames[b]);
        }).map(id => ({ title: blockNames[id], items: groups[id] }));
    }

    grid.className = 'items-grid view-' + currentView;
    if (currentView === 'planilha') {
        grid.innerHTML = sections.map(_buildItemsTableHTML).join('');
        return;
    }

    // Cards e lista compacta compartilham o mesmo HTML — a diferença é só CSS.
    const cardOf = currentModule === 'mechanics' ? renderMechanicCard : buildItemCardHTML;
    grid.innerHTML = sections.map(s => _sectionHeaderHTML(s) + s.items.map(cardOf).join('')).join('');
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
    // Busca o nome direto do item (fonte da verdade) — o parâmetro `name`
    // fica como fallback para chamadas legadas.
    const item = allItems.find(i => i.id === id);
    const displayName = item ? (item.nome || item.titulo || name || 'Sem nome') : (name || 'Sem nome');
    document.getElementById('deleteItemName').textContent = displayName;
    const modal = document.getElementById('deleteModal');
    modal.classList.add('active');
    window.bringModalToTop(modal);
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

// ===== SUB-FORM MODAL (PECULIARIDADES) =====
window._openSubFormPeculiaridade = function (pid, parentFieldKey = null) {
    // Mascarar temporariamente os IDs do modal principal para evitar colisão no DOM
    document.querySelectorAll('.form-modal, #formModal').forEach(modal => {
        if (modal.id !== 'subFormModalPeculiaridade') {
            modal.querySelectorAll('[id]').forEach(el => {
                if (el.id.startsWith('field_') || el.id.startsWith('tags_') || el.id.startsWith('img_preview_') || el.id.startsWith('multisel_') || el.id.startsWith('btnSave')) {
                    if (!el.hasAttribute('data-temp-id-pec')) {
                        el.dataset.tempIdPec = el.id;
                        el.id = 'temp_pec_' + el.id;
                    }
                }
            });
        }
    });

    // Criar overlay do sub-modal
    const overlay = document.createElement('div');
    overlay.className = 'modal form-modal active';
    overlay.id = 'subFormModalPeculiaridade';
    window.bringModalToTop(overlay); // Sempre acima do modal atualmente no topo
    
    const isEdit = !!pid;
    overlay.innerHTML = `
      <div class="modal-content" style="max-height: 90vh; overflow: hidden; padding: 0;">
          <div class="form-header">
              <h2>${isEdit ? '✏️ Editar Peculiaridade' : '➕ Criar Peculiaridade'}</h2>
              <button type="button" class="btn-close-form" onclick="window.closeSubFormPeculiaridade()">✕</button>
          </div>
          <form onsubmit="window.saveSubFormPeculiaridade(event, '${pid || ''}', '${parentFieldKey || ''}')" style="display: flex; flex-direction: column; overflow: hidden; flex: 1;">
              <div class="form-body">
                  <div id="subFormFields" class="form-grid"></div>
              </div>
              <!-- Controle visual de 'Publicado' removido em sub-modais (salvo como true automaticamente) -->
              <div class="form-actions" style="justify-content: flex-end;">
                  <button type="button" class="btn-modal btn-cancel" onclick="window.closeSubFormPeculiaridade()">Cancelar</button>
                  <button type="submit" class="btn-save" id="btnSaveSubPec">💾 Salvar Alterações</button>
              </div>
          </form>
      </div>
    `;
    document.body.appendChild(overlay);

    // Carregar os campos com buildField()
    const modDef = MODULE_DEFS['peculiarities'];
    const existingData = peculiaritiesCache.find(p => p.id === pid) || {};
    const container = overlay.querySelector('#subFormFields');

    // Precisamos ajustar o currentModule para o mechanic_selector interno funcionar
    window._moduleStack = window._moduleStack || [];
    window._moduleStack.push(currentModule);
    currentModule = 'peculiarities';

    modDef.fields.forEach(field => {
        let value = existingData[field.key];
        if (value === undefined && field.defaultValue !== undefined) {
            value = field.defaultValue;
        }
        if (field.key === 'concedeAura' && value === undefined && existingData.auraVinculadaId) {
            value = true;
        }
        const el = buildField(field, value, existingData);
        container.appendChild(el);
    });

};

window.closeSubFormPeculiaridade = function () {
    const overlay = document.getElementById('subFormModalPeculiaridade');
    if (overlay) overlay.remove();

    // Restaurar currentModule
    if (window._moduleStack && window._moduleStack.length > 0) {
        currentModule = window._moduleStack.pop();
    }

    // Desmascarar IDs
    document.querySelectorAll('.form-modal, #formModal').forEach(modal => {
        modal.querySelectorAll('[data-temp-id-pec]').forEach(el => {
            el.id = el.dataset.tempIdPec;
            el.removeAttribute('data-temp-id-pec');
        });
    });
};

window.saveSubFormPeculiaridade = async function (e, pid, parentFieldKey) {
    e.preventDefault();
    const btn = document.getElementById('btnSaveSubPec');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Salvando...'; }

    try {
        const modDef = MODULE_DEFS['peculiarities'];
        const data = {};

        modDef.fields.forEach(field => {
            if (field.type === 'aura_property_selector' || field.type === 'aura_selector') {
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
                } else {
                    data[field.key] = [];
                }
            } else if (field.type === 'mechanic_selector') {
                const el = document.getElementById(`field_${field.key}`);
                data[field.key] = el ? safeJsonParse(el.value || '[]', []) : [];
            } else if (field.type === 'boolean') {
                const el = document.getElementById(`field_${field.key}`);
                data[field.key] = el ? el.checked : false;
            } else if (field.type === 'multi_select') {
                const el = document.getElementById(`field_${field.key}`);
                data[field.key] = el ? safeJsonParse(el.value || '[]', []) : [];
            } else if (field.type === 'number') {
                const el = document.getElementById(`field_${field.key}`);
                data[field.key] = el && el.value !== '' ? Number(el.value) : null;
            } else {
                const el = document.getElementById(`field_${field.key}`);
                if (el) {
                    if (field.type === 'textarea') {
                        data[field.key] = el.value.replace(/\r\n/g, '\n');
                    } else {
                        data[field.key] = el.value;
                    }
                }
            }
        });

        data.publicado = true;
        
        let savedPid = pid;
        if (pid) {
            data.updatedAt = Timestamp.now();
            await updateDoc(doc(db, modDef.collection, pid), data);
        } else {
            data.createdAt = Timestamp.now();
            data.updatedAt = Timestamp.now();
            const newDocRef = await addDoc(collection(db, modDef.collection), data);
            savedPid = newDocRef.id;
        }

        // Atualizar cache local
        const idx = peculiaritiesCache.findIndex(p => p.id === savedPid);
        if (idx >= 0) {
            peculiaritiesCache[idx] = { id: savedPid, ...data, updatedAt: new Date() };
        } else {
            peculiaritiesCache.push({ id: savedPid, ...data, createdAt: new Date(), updatedAt: new Date() });
        }

        // Fechar sub-modal
        window.closeSubFormPeculiaridade();

        // Se parentFieldKey foi fornecido
        if (parentFieldKey && parentFieldKey !== 'null') {
            const parentFieldPeculiaridade = document.getElementById('temp_vd_temp_pec_field_' + parentFieldKey) || document.getElementById('temp_vd_field_' + parentFieldKey) || document.getElementById('temp_pec_field_' + parentFieldKey) || document.getElementById('temp_field_' + parentFieldKey) || document.getElementById('field_' + parentFieldKey);
            if (parentFieldPeculiaridade) {
                let currentIds = JSON.parse(parentFieldPeculiaridade.value || '[]');
                
                if (!pid) {
                    const isObjectFormat = currentIds.length > 0 && typeof currentIds[0] === 'object';
                    if (isObjectFormat || currentIds.length === 0) {
                        currentIds.push({ id: savedPid, nivelInicial: 1 });
                    } else {
                        currentIds.push(savedPid);
                    }
                    parentFieldPeculiaridade.value = JSON.stringify(currentIds);
                }
                
                const wrap = document.getElementById(parentFieldPeculiaridade.id + '_wrap');
                if (wrap) {
                    import('./painel-mechanics.js?v=16').then(m => {
                        const labelSpan = wrap.querySelector('.mechsel-label');
                        const labelText = labelSpan ? labelSpan.textContent : 'Peculiaridades';
                        
                        const prefixMatch = parentFieldPeculiaridade.id.match(/^(temp_vd_temp_pec_|temp_vd_|temp_pec_|temp_)/);
                        const tempId = prefixMatch ? prefixMatch[1] : '';
                        
                        let modifiedHtml = m.buildPecSelectorHTML(parentFieldKey, labelText, currentIds, peculiaritiesCache, '');
                        if (tempId) {
                            modifiedHtml = modifiedHtml.replace(new RegExp(`id="field_${parentFieldKey}"`, 'g'), `id="${tempId}field_${parentFieldKey}"`);
                            modifiedHtml = modifiedHtml.replace(new RegExp(`window._mechSelFilter\\('field_${parentFieldKey}'\\)`, 'g'), `window._mechSelFilter('${tempId}field_${parentFieldKey}')`);
                            modifiedHtml = modifiedHtml.replace(new RegExp(`window._mechSelRemove\\('field_${parentFieldKey}'`, 'g'), `window._mechSelRemove('${tempId}field_${parentFieldKey}'`);
                            modifiedHtml = modifiedHtml.replace(new RegExp(`window._pecSelLevelChange\\('field_${parentFieldKey}'`, 'g'), `window._pecSelLevelChange('${tempId}field_${parentFieldKey}'`);
                            modifiedHtml = modifiedHtml.replace(new RegExp(`window._pecSelConfirm\\('field_${parentFieldKey}'\\)`, 'g'), `window._pecSelConfirm('${tempId}field_${parentFieldKey}')`);
                            modifiedHtml = modifiedHtml.replace(new RegExp(`window._mechSelConfirm\\('field_${parentFieldKey}'\\)`, 'g'), `window._mechSelConfirm('${tempId}field_${parentFieldKey}')`);
                        }
                        
                        wrap.outerHTML = modifiedHtml;
                    });
                }
            }
        } else {
            // Fallback for generic peculiaridadeIds field if no parentFieldKey is provided
            const legacyField = document.getElementById('temp_vd_temp_pec_field_peculiaridadeIds') || document.getElementById('temp_vd_field_peculiaridadeIds') || document.getElementById('temp_pec_field_peculiaridadeIds') || document.getElementById('temp_field_peculiaridadeIds') || document.getElementById('field_peculiaridadeIds');
            if (legacyField) {
                const wrap = document.getElementById(legacyField.id + '_wrap');
                if (wrap) {
                    const currentIds = JSON.parse(legacyField.value || '[]');
                    import('./painel-mechanics.js?v=16').then(m => {
                        const labelSpan = wrap.querySelector('.mechsel-label');
                        const labelText = labelSpan ? labelSpan.textContent : 'Peculiaridades';
                        
                        const prefixMatch = legacyField.id.match(/^(temp_vd_temp_pec_|temp_vd_|temp_pec_|temp_)/);
                        const tempId = prefixMatch ? prefixMatch[1] : '';
                        
                        let newHtml = m.buildPecSelectorHTML('peculiaridadeIds', labelText, currentIds, peculiaritiesCache, '');
                        if (tempId) {
                            newHtml = newHtml.replace(new RegExp(`id="field_peculiaridadeIds"`, 'g'), `id="${tempId}field_peculiaridadeIds"`);
                        }
                        wrap.outerHTML = newHtml;
                    });
                }
            }
        }
        
        showAlert('✅ Peculiaridade atualizada com sucesso!', 'success');
    } catch (e) {
        console.error('Erro ao salvar sub-form:', e);
        showAlert('❌ Erro ao salvar: ' + e.message, 'danger');
        if (btn) { btn.disabled = false; btn.textContent = '💾 Salvar Alterações'; }
    }
};

// ===== SUB-FORM MODAL (VALORES DERIVADOS) =====
window._openSubFormValorDerivado = function (vid, parentFieldKey = null) {
    document.querySelectorAll('.form-modal, #formModal').forEach(modal => {
        if (modal.id !== 'subFormModalValorDerivado') {
            modal.querySelectorAll('[id]').forEach(el => {
                if (el.id.startsWith('field_') || el.id.startsWith('tags_') || el.id.startsWith('img_preview_') || el.id.startsWith('multisel_') || el.id.startsWith('btnSave')) {
                    if (!el.hasAttribute('data-temp-id-vd')) {
                        el.dataset.tempIdVd = el.id;
                        el.id = 'temp_vd_' + el.id;
                    }
                }
            });
        }
    });

    const overlay = document.createElement('div');
    overlay.className = 'modal form-modal active';
    overlay.id = 'subFormModalValorDerivado';
    window.bringModalToTop(overlay); // Sempre acima do modal atualmente no topo
    
    const isEdit = !!vid;
    overlay.innerHTML = `
      <div class="modal-content" style="max-height: 90vh; overflow: hidden; padding: 0;">
          <div class="form-header">
              <h2>${isEdit ? '✏️ Editar Valor Derivado' : '➕ Criar Valor Derivado'}</h2>
              <button type="button" class="btn-close-form" onclick="window.closeSubFormValorDerivado()">✕</button>
          </div>
          <form onsubmit="window.saveSubFormValorDerivado(event, '${vid || ''}', '${parentFieldKey || ''}')" style="display: flex; flex-direction: column; overflow: hidden; flex: 1;">
              <div class="form-body">
                  <div id="subFormFields" class="form-grid"></div>
              </div>
              <!-- Controle visual de 'Publicado' removido em sub-modais (salvo como true automaticamente) -->
              <div class="form-actions" style="justify-content: flex-end;">
                  <button type="button" class="btn-modal btn-cancel" onclick="window.closeSubFormValorDerivado()">Cancelar</button>
                  <button type="submit" class="btn-save" id="btnSaveSubVD">💾 Salvar Alterações</button>
              </div>
          </form>
      </div>
    `;
    document.body.appendChild(overlay);

    const modDef = MODULE_DEFS['derivedValues'];
    const existingData = derivedValuesCache.find(p => p.id === vid) || {};
    const container = overlay.querySelector('#subFormFields');

    window._moduleStack = window._moduleStack || [];
    window._moduleStack.push(currentModule);
    currentModule = 'derivedValues';

    modDef.fields.forEach(field => {
        let value = existingData[field.key];
        if (value === undefined && field.defaultValue !== undefined) {
            value = field.defaultValue;
        }
        const el = buildField(field, value, existingData);
        container.appendChild(el);
    });

};

window.closeSubFormValorDerivado = function () {
    const overlay = document.getElementById('subFormModalValorDerivado');
    if (overlay) overlay.remove();

    if (window._moduleStack && window._moduleStack.length > 0) {
        currentModule = window._moduleStack.pop();
    }

    document.querySelectorAll('.form-modal, #formModal').forEach(modal => {
        modal.querySelectorAll('[data-temp-id-vd]').forEach(el => {
            el.id = el.dataset.tempIdVd;
            el.removeAttribute('data-temp-id-vd');
        });
    });
};

window.saveSubFormValorDerivado = async function (e, vid, parentFieldKey) {
    e.preventDefault();
    const btn = document.getElementById('btnSaveSubVD');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Salvando...'; }

    try {
        const modDef = MODULE_DEFS['derivedValues'];
        const data = {};

        modDef.fields.forEach(field => {
            if (field.type === 'aura_property_selector' || field.type === 'aura_selector') {
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
                } else {
                    data[field.key] = [];
                }
            } else if (field.type === 'mechanic_selector') {
                const el = document.getElementById(`field_${field.key}`);
                data[field.key] = el ? safeJsonParse(el.value || '[]', []) : [];
            } else if (field.type === 'boolean') {
                const el = document.getElementById(`field_${field.key}`);
                data[field.key] = el ? el.checked : false;
            } else if (field.type === 'multi_select') {
                const el = document.getElementById(`field_${field.key}`);
                data[field.key] = el ? safeJsonParse(el.value || '[]', []) : [];
            } else if (field.type === 'number') {
                const el = document.getElementById(`field_${field.key}`);
                data[field.key] = el && el.value !== '' ? Number(el.value) : null;
            } else {
                const el = document.getElementById(`field_${field.key}`);
                if (el) {
                    if (field.type === 'textarea') {
                        data[field.key] = el.value.replace(/\r\n/g, '\n');
                    } else {
                        data[field.key] = el.value;
                    }
                }
            }
        });

        data.publicado = true;
        
        let savedVid = vid;
        if (vid) {
            data.updatedAt = Timestamp.now();
            await updateDoc(doc(db, modDef.collection, vid), data);
        } else {
            data.createdAt = Timestamp.now();
            data.updatedAt = Timestamp.now();
            const newDocRef = await addDoc(collection(db, modDef.collection), data);
            savedVid = newDocRef.id;
        }

        const idx = derivedValuesCache.findIndex(p => p.id === savedVid);
        if (idx >= 0) {
            derivedValuesCache[idx] = { id: savedVid, ...data, updatedAt: new Date() };
        } else {
            derivedValuesCache.push({ id: savedVid, ...data, createdAt: new Date(), updatedAt: new Date() });
        }

        window.closeSubFormValorDerivado();

        if (parentFieldKey && parentFieldKey !== 'null') {
            const parentFieldValorDerivado = document.getElementById('temp_vd_temp_pec_field_' + parentFieldKey) || document.getElementById('temp_vd_field_' + parentFieldKey) || document.getElementById('temp_pec_field_' + parentFieldKey) || document.getElementById('temp_field_' + parentFieldKey) || document.getElementById('field_' + parentFieldKey);
            if (parentFieldValorDerivado) {
                let currentIds = JSON.parse(parentFieldValorDerivado.value || '[]');
                
                if (!vid) {
                    const isObjectFormat = currentIds.length > 0 && typeof currentIds[0] === 'object';
                    if (isObjectFormat || currentIds.length === 0) {
                        currentIds.push({ id: savedVid, valorInicial: data.valorInicial || 0 });
                    } else {
                        currentIds.push(savedVid);
                    }
                    parentFieldValorDerivado.value = JSON.stringify(currentIds);
                }
                
                const wrap = document.getElementById(parentFieldValorDerivado.id + '_wrap');
                if (wrap) {
                    import('./painel-mechanics.js?v=16').then(m => {
                        const labelSpan = wrap.querySelector('.mechsel-label');
                        const labelText = labelSpan ? labelSpan.textContent : 'Valores Derivados';
                        
                        const prefixMatch = parentFieldValorDerivado.id.match(/^(temp_vd_temp_pec_|temp_vd_|temp_pec_|temp_)/);
                        const tempId = prefixMatch ? prefixMatch[1] : '';
                        
                        let modifiedHtml = m.buildDerivedValueSelectorHTML(parentFieldKey, labelText, currentIds, derivedValuesCache, '');
                        if (tempId) {
                            modifiedHtml = modifiedHtml.replace(new RegExp(`id="field_${parentFieldKey}"`, 'g'), `id="${tempId}field_${parentFieldKey}"`);
                            modifiedHtml = modifiedHtml.replace(new RegExp(`window._mechSelFilter\\('field_${parentFieldKey}'\\)`, 'g'), `window._mechSelFilter('${tempId}field_${parentFieldKey}')`);
                            modifiedHtml = modifiedHtml.replace(new RegExp(`window._mechSelRemove\\('field_${parentFieldKey}'`, 'g'), `window._mechSelRemove('${tempId}field_${parentFieldKey}'`);
                            modifiedHtml = modifiedHtml.replace(new RegExp(`window._dvSelLevelChange\\('field_${parentFieldKey}'`, 'g'), `window._dvSelLevelChange('${tempId}field_${parentFieldKey}'`);
                            modifiedHtml = modifiedHtml.replace(new RegExp(`window._dvSelConfirm\\('field_${parentFieldKey}'\\)`, 'g'), `window._dvSelConfirm('${tempId}field_${parentFieldKey}')`);
                            modifiedHtml = modifiedHtml.replace(new RegExp(`window._mechSelConfirm\\('field_${parentFieldKey}'\\)`, 'g'), `window._mechSelConfirm('${tempId}field_${parentFieldKey}')`);
                        }
                        
                        wrap.outerHTML = modifiedHtml;
                    });
                }
            }
        }
        
        showAlert('✅ Valor Derivado atualizado com sucesso!', 'success');
    } catch (e) {
        console.error('Erro ao salvar sub-form:', e);
        showAlert('❌ Erro ao salvar: ' + e.message, 'danger');
        if (btn) { btn.disabled = false; btn.textContent = '💾 Salvar Alterações'; }
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

    const dynamicForm = document.getElementById('dynamicForm');
    if (dynamicForm) {
        dynamicForm.dataset.module = currentModule;
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
        el.dataset.campo = field.key;   // o agrupador em seções acha o campo por aqui
        formGrid.appendChild(el);
    });

    // Publicado toggle (statically in form-actions)
    const pubField = document.getElementById('field_publicado');
    if (pubField) {
        pubField.checked = existingData ? !!existingData.publicado : false;
    }

    if (modDef.sections) {
        container.insertAdjacentHTML('beforeend', htmlBarraFerramentas());
        agruparEmSecoesDOM(formGrid, modDef.sections, (k) => _preenchidoNoDado(existingData, k), 'form-grid');
    }
    container.appendChild(formGrid);

    // Wire up showWhen visibility for conditional fields
    _wireShowWhenFields(modDef, formGrid);

    // Wire up showWhenBoolean visibility for boolean toggle conditional fields
    _wireShowWhenBooleanFields(modDef, formGrid);

    // Wire up showWhenNotNull visibility
    _wireShowWhenNotNullFields(modDef, formGrid);

    // Busca de campo, abrir/recolher seções e o contador de cada uma. Só uma
    // vez por container: openForm reusa o MESMO #formFields a cada abertura.
    if (!container.dataset.efLigado) {
        ligarFormulario(container, '', { visibilidade: false });
        container.dataset.efLigado = '1';
    } else if (modDef.sections) {
        // reabrir reusa o MESMO #formFields: os ouvintes ficam, o contador não.
        // Depois do setTimeout(0) do _wireShowWhen*, senão conta como visível o
        // campo que ele ainda vai esconder.
        setTimeout(() => atualizarResumo(container), 0);
    }

    const formModal = document.getElementById('formModal');
    formModal.classList.add('active');
    window.bringModalToTop(formModal);
    // Reset scroll do corpo do form (evita abrir no meio ao reutilizar o modal)
    const formBody = formModal.querySelector('.form-body');
    if (formBody) formBody.scrollTop = 0;
};

window.closeForm = function () {
    editingItemId = null;
    document.getElementById('formModal').classList.remove('active');
};

// ===== BUILD FORM FIELD =====
function buildField(field, value, existingData) {
    const wrap = document.createElement('div');
    wrap.className = 'form-group' + (
        ['textarea', 'array', 'json', 'tags', 'mechanic_selector', 'aura_graus_editor', 'class_tests_editor', 'class_modules_editor', 'class_module_standalone_editor', 'class_module_linker', 'body_parts_editor', 'class_kits_editor', 'wb_chapter_selector', 'book_link', 'knowledge_reqs_editor'].includes(field.type) ? ' full-width' : ''
    );
    if (field.showWhen) {
        wrap.dataset.showWhenField = field.showWhen.field;
        wrap.dataset.showWhenValue = field.showWhen.value;
    }
    if (field.showWhenBoolean) {
        wrap.dataset.showWhenBoolean = field.showWhenBoolean;
    }
    if (field.showWhenNotNull) {
        wrap.dataset.showWhenNotNull = field.showWhenNotNull;
    }

    // === CAMPOS RÚNICOS (Runomancia) ===
    if (field.type && field.type.startsWith('runic_')) {
        wrap.classList.add('full-width');
        wrap.innerHTML = buildRunicField(field, value);
        if (field.type === 'runic_connection_points') {
            setTimeout(() => window.runicCPInit && window.runicCPInit(field.key), 0);
        }
        return wrap;
    }

    if (field.type === 'mechanic_selector') {
        const ids = Array.isArray(value) ? value : [];
        if (field.selectorTarget === 'peculiarities') {
            wrap.innerHTML = buildPecSelectorHTML(field.key, field.label, ids, peculiaritiesCache, field.fontePreFilter);
        } else if (field.selectorTarget === 'skills') {
            wrap.innerHTML = buildSkillSelectorHTML(field.key, field.label, ids, skillsCache);
        } else if (field.selectorTarget === 'derivedValues') {
            wrap.innerHTML = buildDerivedValueSelectorHTML(field.key, field.label, ids, derivedValuesCache);
        } else if (field.selectorTarget === 'equipmentDerivedValues') {
            wrap.innerHTML = buildEquipmentDerivedValueSelectorHTML(field.key, field.label, ids, derivedValuesCache, 'Valor Derivado', 'modificador', 'Modificador', true);
        } else if (field.selectorTarget === 'vitalStatus') {
            wrap.innerHTML = buildEquipmentDerivedValueSelectorHTML(field.key, field.label, ids, vitalStatusOptions(vitalStatsCache), 'Status Vital');
        } else if (field.selectorTarget === 'bodyPartsQuantidade') {
            wrap.innerHTML = buildEquipmentDerivedValueSelectorHTML(field.key, field.label, ids, bodyPartsCache, 'Parte do Corpo', 'quantidade', 'Slots');
        } else if (field.selectorTarget === 'attributes') {
            wrap.innerHTML = buildEquipmentDerivedValueSelectorHTML(field.key, field.label, ids, ATRIBUTOS_VINCULAVEIS, 'Atributo');
        } else if (field.selectorTarget === 'skillsModificador') {
            wrap.innerHTML = buildEquipmentDerivedValueSelectorHTML(field.key, field.label, ids, periciaOptions(skillsCache), 'Perícia');
        } else if (field.selectorTarget === 'conditions') {
            wrap.innerHTML = buildConditionSelectorHTML(field.key, field.label, ids, conditionsCache);
        } else if (field.selectorTarget === 'maneuvers') {
            wrap.innerHTML = buildManeuverSelectorHTML(field.key, field.label, ids, maneuversCache);
        } else {
            wrap.innerHTML = buildMechanicSelectorHTML(field.key, field.label, ids, mechanicsCache, field.fontePreFilter);
        }
        return wrap;
    }

    // === BODY PARTS EDITOR (for races) ===
    if (field.type === 'body_parts_editor') {
        const parts = Array.isArray(value) ? value : [];
        wrap.innerHTML = _buildBodyPartsEditorHTML(field.key, field.label, parts);
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



    // === CLASS TESTS EDITOR ===
    if (field.type === 'class_tests_editor') {
        wrap.innerHTML = _buildClassTestsEditorHTML(field.key, field.label, Array.isArray(value) ? value : []);
        return wrap;
    }

    // === CLASS MODULES EDITOR (inline, legado — mantido para retro-compat) ===
    if (field.type === 'class_modules_editor') {
        wrap.innerHTML = _buildClassModulesEditorHTML(field.key, field.label, Array.isArray(value) ? value : []);
        return wrap;
    }

    // === CLASS MODULE STANDALONE EDITOR (centralizado, nova aba) ===
    if (field.type === 'class_module_standalone_editor') {
        const moduleData = (typeof value === 'object' && value) ? value : (existingData || {});
        wrap.innerHTML = _buildClassModuleEditorRow(0, moduleData);
        // Remove header com botão de remover (não faz sentido no standalone)
        const header = wrap.querySelector('.array-item-header');
        if (header) header.style.display = 'none';
        return wrap;
    }

    // === CLASS MODULE LINKER (vinculação nas classes) ===
    if (field.type === 'class_module_linker') {
        const ids = Array.isArray(value) ? value : [];
        // Resolver IDs para nomes — suporta formato legado (objetos) e novo (strings)
        const chipsHtml = ids.map(entry => {
            if (typeof entry === 'object' && entry !== null) {
                // Formato legado: objeto inline, mostrar como chip não-removível
                const titulo = entry.titulo || entry.id || 'Módulo';
                const icone = entry.icone || '📦';
                return `<span class="mech-tag cm-linker-chip" data-id="_legacy_${escapeHtml(entry.id || '')}" style="opacity:0.7;cursor:default" title="Módulo inline (legado) — migre para o repositório central">${icone} ${escapeHtml(titulo)} <small style='color:var(--lr-gold)'>(legado)</small></span>`;
            }
            const mod = classModulesCache.find(m => m.id === entry);
            const titulo = mod ? mod.titulo : `⚠️ ${entry}`;
            const icone = mod ? (mod.icone || '📦') : '📦';
            return `<span class="mech-tag cm-linker-chip" data-id="${escapeHtml(entry)}" onclick="event.stopPropagation(); window._openClassModuleFromLinker('${escapeHtml(entry)}')" style="cursor:pointer" title="Clique para editar">${icone} ${escapeHtml(titulo)} <button type="button" onclick="event.stopPropagation(); this.parentElement.remove(); window._syncClassModuleLinkerHidden()" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:.8rem;padding:0 2px">✕</button></span>`;
        }).join('');
        const selectOptions = classModulesCache
            .filter(m => m.publicado !== false)
            .map(m => `<option value="${escapeHtml(m.id)}">${escapeHtml((m.icone || '📦') + ' ' + (m.titulo || m.id))}</option>`).join('');
        wrap.innerHTML = `
            <label>${escapeHtml(field.label)}</label>
            <div class="aura-grau-mechs cm-linker-area" data-field-key="${field.key}">
                <div class="mech-tags-container cm-linker-chips">${chipsHtml}</div>
                <select class="aura-mech-select" onchange="window._addClassModuleLink(this)">
                    <option value="">+ Vincular Módulo...</option>
                    ${selectOptions}
                </select>
            </div>
            <input type="hidden" id="field_${field.key}" value="${escapeHtml(JSON.stringify(ids.filter(e => typeof e === 'string')))}">
        `;
        return wrap;
    }

    // === CLASS KITS EDITOR ===
    if (field.type === 'class_kits_editor') {
        wrap.innerHTML = _buildClassKitsEditorHTML(field.key, field.label, Array.isArray(value) ? value : []);
        return wrap;
    }

    // === 📖 SELETOR DE CAPÍTULO DO WORLDBUILDING ===
    if (field.type === 'wb_chapter_selector') {
        wrap.innerHTML = _buildWbChapterSelectorHTML(field.key, field.label, value, field.required);
        return wrap;
    }

    // === 📖 LIVRO VINCULADO (raça / classe / tribo) ===
    if (field.type === 'book_link') {
        // Normaliza aqui (e não pelo `value`) para a entidade que só tem o
        // campo legado `livroVinculado` abrir com ele já na lista.
        wrap.innerHTML = _buildBookLinkHTML(field.key, field.label, window.lvNormalizar(existingData));
        return wrap;
    }

    // === 🔐 REQUISITOS DE CONHECIMENTO ===
    if (field.type === 'knowledge_reqs_editor') {
        wrap.innerHTML = _buildKnowledgeReqsEditorHTML(field.key, field.label, Array.isArray(value) ? value : []);
        setTimeout(() => _knApplySelValues(document.getElementById(`knReqItems_${field.key}`)), 0);
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

    // === BODY PARTS SELECTOR ===
    if (field.type === 'body_parts_selector') {
        const selected = Array.isArray(value) ? value : [];
        const checkboxes = bodyPartsCache.map(bp => {
            const checked = selected.includes(bp.id) ? 'checked' : '';
            return `<label class="multi-select-option"><input type="checkbox" value="${bp.id}" ${checked} data-multiselect="${field.key}"> ${escapeHtml(bp.icone || '🦴')} ${escapeHtml(bp.nome)}</label>`;
        }).join('');
        wrap.innerHTML = `
            <label>${escapeHtml(field.label)} ${field.required ? '<span class="required">*</span>' : ''}</label>
            <div class="multi-select-container" style="max-height: 150px; overflow-y: auto;" id="multisel_${field.key}">${checkboxes}</div>
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
            wrap.innerHTML = `${labelHtml}${CampoImagem.html({ id: `field_${field.key}`, valor: value ?? '', pasta: 'imagens/catalogo', preview: false, attrs: `${field.required ? 'required' : ''} oninput="document.getElementById('img_preview_${field.key}').src = this.value; document.getElementById('img_preview_${field.key}').style.display = this.value ? 'block' : 'none';"` })}
            <img id="img_preview_${field.key}" src="${escapeHtml(value ?? '')}" style="display: ${value ? 'block' : 'none'}; width: 100%; height: 260px; margin-top: 8px; border-radius: 4px; object-fit: cover; object-position: top;">`;
        } else {
            let extraAttrs = '';
            if (field.type === 'number') extraAttrs = 'step="0.01"';
            wrap.innerHTML = `${labelHtml}<input type="${field.type}" id="field_${field.key}" value="${escapeHtml(value ?? '')}" placeholder="${escapeHtml(field.placeholder || '')}" ${field.required ? 'required' : ''} ${extraAttrs}>`;
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

// ===== SHOW-WHEN-NOT-NULL: FIELD VISIBILITY =====
function _wireShowWhenNotNullFields(modDef, container) {
    const conditionalFields = container.querySelectorAll('[data-show-when-not-null]');
    if (conditionalFields.length === 0) return;

    const triggerKeys = new Set();
    conditionalFields.forEach(el => triggerKeys.add(el.dataset.showWhenNotNull));

    function updateVisibility() {
        conditionalFields.forEach(wrap => {
            const triggerKey = wrap.dataset.showWhenNotNull;
            const triggerEl = document.getElementById(`field_${triggerKey}`);
            if (!triggerEl) return;
            wrap.style.display = (triggerEl.value && String(triggerEl.value).trim() !== '') ? '' : 'none';
        });
    }

    setTimeout(updateVisibility, 0);

    triggerKeys.forEach(key => {
        const el = document.getElementById(`field_${key}`);
        if (el) el.addEventListener('change', updateVisibility);
    });
}

// ===== AURA SYSTEM: PROPERTY SELECTOR =====
function _buildAuraPropertySelectorHTML(fieldKey, label, value, existingData) {
    // Build options from attributes and skills
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
    window.bringModalToTop(modal); // Sempre acima do modal atual (mesmo dentro de sub-modais)
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


// ===== CLASS KITS EDITOR =====
function _buildClassKitsEditorHTML(fieldKey, label, kits) {
    const kitsHtml = kits.map((k, idx) => _buildClassKitRow(idx, k)).join('');
    return `
        <div class="class-kits-editor" id="classKits_${fieldKey}" data-field-key="${fieldKey}">
            <div class="array-editor-header">
                <label>${escapeHtml(label)}</label>
                <button type="button" class="btn-array-add" onclick="addClassKit('${fieldKey}')">➕ Adicionar Kit</button>
            </div>
            <div class="class-kits-items" id="classKitsItems_${fieldKey}">${kitsHtml}</div>
        </div>
    `;
}

function _buildClassKitRow(idx, data) {
    data = data || {};
    const equipmentIds = Array.isArray(data.equipamentos) ? data.equipamentos : [];
    
    const eqChips = equipmentIds.map(eqItem => {
        const eqId = typeof eqItem === 'string' ? eqItem : eqItem.id;
        const eqQtd = typeof eqItem === 'string' ? 1 : (eqItem.qtd || 1);
        const eq = (typeof equipmentCache !== 'undefined' ? equipmentCache : []).find(x => x.id === eqId);
        const qtyInput = `<input type="number" class="ck-eq-qtd" style="width: 45px; padding: 2px 4px; margin: 0 6px; border-radius: 4px; border: 1px solid var(--soft); background: var(--bg-card); color: var(--text);" value="${eqQtd}" min="1" onchange="this.parentElement.dataset.qtd = this.value" title="Quantidade">`;
        if (!eq) return `<span class="mech-tag" data-id="${escapeHtml(eqId)}" data-qtd="${eqQtd}">⚠️ Desconhecido ${qtyInput} <button type="button" onclick="this.parentElement.remove()">✕</button></span>`;
        return `<span class="mech-tag" data-id="${escapeHtml(eqId)}" data-qtd="${eqQtd}">${escapeHtml(eq.nome)} ${qtyInput} <button type="button" onclick="this.parentElement.remove()">✕</button></span>`;
    }).join('');

    return `
        <div class="array-item class-kit-item" data-index="${idx}" data-kit-id="${escapeHtml(data.id || '')}">
            <div class="array-item-header">
                <span class="array-item-number">#${idx + 1}</span>
                <button type="button" class="btn-array-remove" onclick="removeClassKit(this)">✕</button>
            </div>
            <div class="form-grid">
                <div class="form-group full-width">
                    <label>Nome do Kit <span class="required">*</span></label>
                    <input type="text" data-ck-key="nome" value="${escapeHtml(data.nome || '')}" placeholder="Ex: Kit de Aventureiro Básico">
                </div>
                <div class="form-group full-width">
                    <label>Equipamentos</label>
                    <div class="aura-grau-mechs ck-eq-container" data-ck-key="equipamentos">
                        <div class="mech-tags-container ck-eq-tags">${eqChips}</div>
                        <select class="aura-mech-select" onchange="addClassKitEquip(this)">
                            <option value="">+ Vincular Equipamento...</option>
                            ${(typeof equipmentCache !== 'undefined' ? equipmentCache : []).map(e => `<option value="${e.id}">${escapeHtml(e.nome)}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>
        </div>
    `;
}

window.addClassKit = function(fieldKey) {
    const container = document.getElementById(`classKitsItems_${fieldKey}`);
    if (!container) return;
    const idx = container.children.length;
    const temp = document.createElement('div');
    temp.innerHTML = _buildClassKitRow(idx, {});
    container.appendChild(temp.firstElementChild);
};

window.removeClassKit = function(btn) {
    const item = btn.closest('.class-kit-item');
    if (!item) return;
    const container = item.parentElement;
    item.remove();
    if (container) {
        container.querySelectorAll('.class-kit-item').forEach((el, i) => {
            el.dataset.index = i;
            const num = el.querySelector('.array-item-number');
            if (num) num.textContent = `#${i + 1}`;
        });
    }
};

window.addClassKitEquip = function(select) {
    const eqId = select.value;
    if (!eqId) return;
    const eq = equipmentCache.find(e => e.id === eqId);
    if (!eq) return;
    const container = select.closest('[data-ck-key="equipamentos"]')?.querySelector('.ck-eq-tags');
    if (!container) return;
    if (container.querySelector(`[data-id="${eqId}"]`)) { select.value = ''; return; }
    const tag = document.createElement('span');
    tag.className = 'mech-tag';
    tag.dataset.id = eqId;
    tag.dataset.qtd = "1";
    const qtyInput = `<input type="number" class="ck-eq-qtd" style="width: 45px; padding: 2px 4px; margin: 0 6px; border-radius: 4px; border: 1px solid var(--soft); background: var(--bg-card); color: var(--text);" value="1" min="1" onchange="this.parentElement.dataset.qtd = this.value" title="Quantidade">`;
    tag.innerHTML = `${escapeHtml(eq.nome || eqId)} ${qtyInput} <button type="button" onclick="this.parentElement.remove()">✕</button>`;
    container.appendChild(tag);
    select.value = '';
};

// =====================================================================
// 📚 CONHECIMENTO — seletor de capítulo + editor de requisitos
// ---------------------------------------------------------------------
// O requisito de "ficha" (Atributo / Perícia / Valor Derivado / Status
// Vital / EXP) reaproveita EXATAMENTE o mesmo dropdown de alvos das
// Mecânicas — e a ficha resolve o valor com o mesmo _resolveSheetRef().
// Um alvo só precisa existir lá para funcionar aqui.
// =====================================================================
function _buildWbChapterSelectorHTML(fieldKey, label, value, required) {
    const byBook = {};
    wbChaptersCache.forEach(c => { (byBook[c.bookId] = byBook[c.bookId] || []).push(c); });

    let opts = '<option value="">— escolha o capítulo —</option>';
    wbBooksCache.forEach(b => {
        const caps = byBook[b.id] || [];
        if (!caps.length) return;
        opts += `<optgroup label="📗 ${escapeHtml(b.title || 'Livro sem título')}${versaoDoLivro(b) ? ' · ' + escapeHtml(versaoDoLivro(b)) : ''}">`;
        caps.forEach((c, i) => {
            const titulo = `${b.title || 'Livro'} — ${i + 1}. ${c.title || 'Sem título'}`;
            opts += `<option value="${escapeHtml(c.id)}" data-titulo="${escapeHtml(titulo)}" ${value === c.id ? 'selected' : ''}>${i + 1}. ${escapeHtml(c.title || 'Sem título')}</option>`;
        });
        opts += '</optgroup>';
    });

    const vazio = wbBooksCache.length === 0
        ? `<div class="cm-hint">⚠️ Nenhum livro encontrado no Worldbuilding. Crie livros e capítulos no <b>Escritório do Cronista</b> primeiro.</div>` : '';

    return `
        <label>${escapeHtml(label)} ${required ? '<span class="required">*</span>' : ''}</label>
        <select id="field_${fieldKey}" onchange="window._knSyncChapterTitle(this)">${opts}</select>
        ${vazio}
        <div class="cm-hint">Capítulos sem regra aqui seguem a marcação 🌐 Público do próprio capítulo.</div>
    `;
}

// ---------------------------------------------------------------------
// 📖 LIVROS VINCULADOS — N livros por raça/classe/tribo + quais capítulos
// o jogador enxerga em cada um. Nenhum capítulo marcado = o livro inteiro.
// Salvo como livrosVinculados: [{ bookId, capituloIds: [] }] e lido por
// shared/livro-vinculado.js. Entidade com o campo legado `livroVinculado`
// abre com ele na lista e passa a gravar no campo novo — o legado fica no
// doc, intocado, e é ignorado assim que o array existe.
// ---------------------------------------------------------------------
function _buildBookLinkHTML(fieldKey, label, vincs) {
    return `
        <label>${escapeHtml(label)}</label>
        <div id="lvRows_${fieldKey}">${(vincs || []).map(v => _buildBookLinkRowHTML(fieldKey, v)).join('')}</div>
        <button type="button" class="btn-array-add" onclick="window._lvAddBook('${fieldKey}')">➕ Adicionar livro</button>
        <div class="cm-hint">Sem nenhum capítulo marcado, o livro inteiro fica visível para o jogador.</div>
    `;
}

function _buildBookLinkRowHTML(fieldKey, vinc) {
    vinc = vinc || {};
    const opts = '<option value="">— nenhum livro —</option>' + wbBooksCache
        .map(b => `<option value="${escapeHtml(b.id)}" ${vinc.bookId === b.id ? 'selected' : ''}>📗 ${escapeHtml(b.title || 'Livro sem título')}${versaoDoLivro(b) ? ' · ' + escapeHtml(versaoDoLivro(b)) : ''}</option>`)
        .join('');

    return `
        <div class="lv-row" data-lv-row="${fieldKey}" style="border:1px solid var(--soft,#333);border-radius:8px;padding:10px;margin-bottom:8px">
            <div style="display:flex;gap:8px;align-items:center">
                <select style="flex:1" data-lv-book onchange="window._lvOnBookChange(this)">${opts}</select>
                <button type="button" class="btn-array-remove" onclick="this.closest('.lv-row').remove()">✕</button>
            </div>
            <div class="multi-select-container" style="max-height:200px;overflow-y:auto;margin-top:8px" data-lv-caps>
                ${_buildBookChaptersHTML(vinc.bookId, Array.isArray(vinc.capituloIds) ? vinc.capituloIds : [])}
            </div>
        </div>`;
}

function _buildBookChaptersHTML(bookId, marcados) {
    if (!bookId) return '<div class="cm-hint" style="margin:0">Escolha um livro para liberar capítulos.</div>';
    const caps = wbChaptersCache.filter(c => c.bookId === bookId);
    if (!caps.length) return '<div class="cm-hint" style="margin:0">⚠️ Este livro ainda não tem capítulos.</div>';
    return caps.map((c, i) => `
        <label class="multi-select-option"><input type="checkbox" value="${escapeHtml(c.id)}"
            ${marcados.includes(c.id) ? 'checked' : ''}> ${i + 1}. ${escapeHtml(c.title || 'Sem título')}</label>`).join('');
}

window._lvAddBook = function (fieldKey) {
    document.getElementById(`lvRows_${fieldKey}`)
        ?.insertAdjacentHTML('beforeend', _buildBookLinkRowHTML(fieldKey, null));
};

// Trocar de livro zera os capítulos marcados (eram de outro livro).
window._lvOnBookChange = function (sel) {
    const box = sel.closest('.lv-row')?.querySelector('[data-lv-caps]');
    if (box) box.innerHTML = _buildBookChaptersHTML(sel.value, []);
};

function _collectBookLink(fieldKey) {
    return Array.from(document.querySelectorAll(`[data-lv-row="${fieldKey}"]`)).map(row => {
        const bookId = row.querySelector('[data-lv-book]')?.value || '';
        if (!bookId) return null;
        return {
            bookId,
            capituloIds: Array.from(row.querySelectorAll('[data-lv-caps] input:checked')).map(cb => cb.value),
        };
    }).filter(Boolean);
}

window._knSyncChapterTitle = function (sel) {
    const tituloEl = document.getElementById('field_titulo');
    const opt = sel.selectedOptions[0];
    if (tituloEl && opt) tituloEl.value = opt.dataset.titulo || '';
};

const KN_REQ_OPS = ['>=', '>', '==', '!=', '<=', '<'];

function _buildKnowledgeReqsEditorHTML(fieldKey, label, reqs) {
    return `
        <div class="class-kits-editor" id="knReqs_${fieldKey}" data-field-key="${fieldKey}">
            <div class="array-editor-header">
                <label>${escapeHtml(label)}</label>
                <button type="button" class="btn-array-add" onclick="window.addKnowledgeReq('${fieldKey}')">➕ Adicionar Requisito</button>
            </div>
            <div class="class-kits-items" id="knReqItems_${fieldKey}">${reqs.map((r, i) => _buildKnowledgeReqRow(i, r)).join('')}</div>
            <div class="cm-hint">Sem nenhum requisito, o capítulo fica liberado para todos os jogadores.</div>
        </div>
    `;
}

function _buildKnowledgeReqRow(idx, r) {
    r = r || {};
    const tipo = r.tipo || 'ficha';
    const opOpts = KN_REQ_OPS.map(o => `<option value="${o}" ${r.op === o ? 'selected' : ''}>${o}</option>`).join('');
    const mechOpts = '<option value="">— escolha a mecânica —</option>' + mechanicsCache
        .filter(m => m.tipo === 'booleano')
        .map(m => `<option value="${escapeHtml(m.id)}" ${r.mecanicaId === m.id ? 'selected' : ''}>🔀 ${escapeHtml(m.nome || m.id)}</option>`).join('');
    const eqOpts = '<option value="">— escolha o equipamento —</option>' + equipmentCache
        .map(e => `<option value="${escapeHtml(e.id)}" ${r.equipamentoId === e.id ? 'selected' : ''}>${escapeHtml(e.nome || e.id)}</option>`).join('');

    const show = (t) => tipo === t ? '' : 'style="display:none"';

    return `
        <div class="array-item kn-req-item" data-index="${idx}">
            <div class="array-item-header">
                <span class="array-item-number">#${idx + 1}</span>
                <button type="button" class="btn-array-remove" onclick="window.removeKnowledgeReq(this)">✕</button>
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label>Tipo de requisito</label>
                    <select data-kn-key="tipo" onchange="window._knToggleReqTipo(this)">
                        <option value="ficha" ${tipo === 'ficha' ? 'selected' : ''}>📊 Valor da Ficha (Atributo / Perícia / VD)</option>
                        <option value="mecanica" ${tipo === 'mecanica' ? 'selected' : ''}>🔀 Mecânica Booleana</option>
                        <option value="equipamento" ${tipo === 'equipamento' ? 'selected' : ''}>🗡️ Equipamento Equipado</option>
                    </select>
                </div>
                <div class="form-group kn-req-ficha" ${show('ficha')}>
                    <label>Alvo na ficha</label>
                    <select data-kn-key="ref" data-sel-value="${escapeHtml(r.ref || '')}">${getMechanicTargetsHTML()}</select>
                </div>
                <div class="form-group kn-req-ficha" ${show('ficha')}>
                    <label>Comparação</label>
                    <div style="display:flex;gap:6px">
                        <select data-kn-key="op" style="width:90px">${opOpts}</select>
                        <input type="number" data-kn-key="valor" value="${escapeHtml(r.valor ?? '')}" placeholder="0">
                    </div>
                </div>
                <div class="form-group full-width kn-req-mecanica" ${show('mecanica')}>
                    <label>Mecânica Booleana (precisa dar verdadeiro)</label>
                    <select data-kn-key="mecanicaId">${mechOpts}</select>
                </div>
                <div class="form-group full-width kn-req-equipamento" ${show('equipamento')}>
                    <label>Equipamento que precisa estar equipado (mochila não conta)</label>
                    <select data-kn-key="equipamentoId">${eqOpts}</select>
                </div>
            </div>
        </div>
    `;
}

/** Aplica o valor salvo nos selects montados por HTML puro (getMechanicTargetsHTML não marca `selected`). */
function _knApplySelValues(root) {
    if (!root) return;
    root.querySelectorAll('select[data-sel-value]').forEach(sel => { sel.value = sel.dataset.selValue || ''; });
}

window._knToggleReqTipo = function (sel) {
    const row = sel.closest('.kn-req-item');
    if (!row) return;
    ['ficha', 'mecanica', 'equipamento'].forEach(t => {
        row.querySelectorAll(`.kn-req-${t}`).forEach(el => { el.style.display = sel.value === t ? '' : 'none'; });
    });
};

window.addKnowledgeReq = function (fieldKey) {
    const container = document.getElementById(`knReqItems_${fieldKey}`);
    if (!container) return;
    const temp = document.createElement('div');
    temp.innerHTML = _buildKnowledgeReqRow(container.children.length, {});
    const row = temp.firstElementChild;
    container.appendChild(row);
    _knApplySelValues(row);
};

window.removeKnowledgeReq = function (btn) {
    const item = btn.closest('.kn-req-item');
    if (!item) return;
    const container = item.parentElement;
    item.remove();
    container?.querySelectorAll('.kn-req-item').forEach((el, i) => {
        el.dataset.index = i;
        const num = el.querySelector('.array-item-number');
        if (num) num.textContent = `#${i + 1}`;
    });
};

function _collectKnowledgeReqs(fieldKey) {
    const container = document.getElementById(`knReqItems_${fieldKey}`);
    if (!container) return [];
    const out = [];
    container.querySelectorAll('.kn-req-item').forEach(item => {
        const val = (k) => item.querySelector(`[data-kn-key="${k}"]`)?.value || '';
        const tipo = val('tipo') || 'ficha';
        if (tipo === 'mecanica') {
            const mecanicaId = val('mecanicaId');
            if (mecanicaId) out.push({ tipo, mecanicaId });
        } else if (tipo === 'equipamento') {
            const equipamentoId = val('equipamentoId');
            if (equipamentoId) out.push({ tipo, equipamentoId });
        } else {
            const ref = val('ref');
            if (ref) out.push({ tipo: 'ficha', ref, op: val('op') || '>=', valor: Number(val('valor')) || 0 });
        }
    });
    return out;
}

function _collectClassKitsData(fieldKey) {
    const container = document.getElementById(`classKitsItems_${fieldKey}`);
    if (!container) return [];
    const kits = [];
    container.querySelectorAll('.class-kit-item').forEach(item => {
        const nome = (item.querySelector('[data-ck-key="nome"]')?.value || '').trim();
        if (!nome) return; // Skip empty kits
        
        const equipamentos = [];
        item.querySelectorAll('.ck-eq-tags .mech-tag').forEach(tag => {
            if (tag.dataset.id) {
                equipamentos.push({
                    id: tag.dataset.id,
                    qtd: parseInt(tag.dataset.qtd || 1, 10)
                });
            }
        });
        
        // Preserve existing ID from DOM dataset if available, otherwise generate new one
        const existingId = item.dataset.kitId;
        const kitId = existingId && existingId !== 'undefined' ? existingId : 'kit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        
        kits.push({ id: kitId, nome, equipamentos });
    });
    return kits;
}

// ===== CLASS MODULES EDITOR =====

// --- Tipos de campo disponíveis no Schema de Campos ---
const CM_SCHEMA_TIPOS = [
    { v: 'text', label: 'Texto' },
    { v: 'number', label: 'Número' },
    { v: 'textarea', label: 'Texto Longo' },
    { v: 'select', label: 'Seleção' },
    { v: 'progress', label: 'Progresso (x/y)' },
    { v: 'steps', label: 'Passos' },
    { v: 'contador', label: '🔢 Contador (+/−)' },
    { v: 'checkbox', label: '☑️ Checkbox' },
    { v: 'avaliacao', label: '⭐ Avaliação (0–5)' },
    { v: 'tags', label: '🏷️ Tags' },
    { v: 'data', label: '📅 Data' },
    { v: 'cor', label: '🎨 Cor' },
    { v: 'link', label: '🔗 Link' },
    { v: 'imagem', label: '🖼️ Imagem (URL)' },
    { v: 'dado', label: '🎲 Dado (rolagem)' },
    { v: 'botao', label: '🔘 Botão (mecânicas)' },
    { v: 'select_botao', label: '🔘 Select Botão' },
    { v: 'separador', label: '➖ Separador de seção' },
    { v: 'valor_derivado', label: '📊 Valor Derivado' },
    { v: 'select_vd', label: '📊 Select VD (Valor Derivado)' }
];

const CM_LARGURAS = [
    { v: '', label: '½ (padrão)' },
    { v: 'terco', label: '⅓' },
    { v: 'quarto', label: '¼' },
    { v: 'dois_tercos', label: '⅔' },
    { v: 'tres_quartos', label: '¾' },
    { v: 'full', label: 'Largura total' }
];

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

// --- Chips helpers ---
function _cmMechChip(mechId) {
    const m = (typeof mechanicsCache !== 'undefined' ? mechanicsCache : []).find(x => x.id === mechId);
    const nome = m ? m.nome : `⚠️ ${mechId}`;
    // Tooltip com o preview (resumo dos efeitos) — é este texto que o jogador verá na ficha
    const preview = m && m.previewTexto ? ` title="${escapeHtml(m.previewTexto)}"` : '';
    return `<span class="mech-tag" data-id="${escapeHtml(mechId)}"${preview}>⚙️ ${escapeHtml(nome)} <button type="button" onclick="this.parentElement.remove()">✕</button></span>`;
}

function _cmMechSelectOptionsBooleana() {
    return (typeof mechanicsCache !== 'undefined' ? mechanicsCache : [])
        .filter(m => m.tipo === 'booleano')
        .map(m => `<option value="${m.id}">${escapeHtml(m.nome)}</option>`).join('');
}

function _cmMechSelectOptions() {
    return (typeof mechanicsCache !== 'undefined' ? mechanicsCache : [])
        .map(m => `<option value="${m.id}">${escapeHtml(m.nome)}</option>`).join('');
}


function _cmEquipName(eqId) {
    const e = (typeof equipmentCache !== 'undefined' ? equipmentCache : []).find(x => x.id === eqId);
    return e ? e.nome : `⚠️ ${eqId}`;
}

// --- Derived Value chips helpers ---
function _cmDVChip(dvId) {
    const d = (typeof derivedValuesCache !== 'undefined' ? derivedValuesCache : []).find(x => x.id === dvId);
    const nome = d ? d.nome : `⚠️ ${dvId}`;
    const icon = d ? (d.icone || '📊') : '📊';
    return `<span class="mech-tag" data-id="${escapeHtml(dvId)}">${icon} ${escapeHtml(nome)} <button type="button" onclick="this.parentElement.remove()">✕</button></span>`;
}

function _cmDVChipReadOnly(dvId) {
    const d = (typeof derivedValuesCache !== 'undefined' ? derivedValuesCache : []).find(x => x.id === dvId);
    if (!d) return `<span style="color:#ef4444;font-size:.72rem">⚠️ DV não encontrado</span>`;
    const icon = d.icone || '📊';
    return `<span class="mech-tag" style="cursor:default">${icon} ${escapeHtml(d.nome)}</span>`;
}

function _cmDVSelectOptions() {
    return (typeof derivedValuesCache !== 'undefined' ? derivedValuesCache : [])
        .filter(d => d.publicado !== false)
        .map(d => `<option value="${d.id}">${escapeHtml((d.icone || '📊') + ' ' + (d.nome || d.id))}</option>`).join('');
}

/** Lista de tipos de equipamento (espelha o campo "tipo" da entidade Equipamento). */
function _cmEquipTipos() {
    const f = MODULE_DEFS?.equipment?.fields?.find(x => x.key === 'tipo');
    if (f && Array.isArray(f.options)) return f.options.map(o => ({ value: o.value, label: o.label }));
    return ['Arma', 'Vestimenta', 'Acessório', 'Projétil', 'Container', 'Objeto', 'Consumível', 'Relíquia']
        .map(t => ({ value: t, label: t }));
}

/** Todas as tags existentes no catálogo de equipamentos. */
function _cmEquipAllTags() {
    const set = new Set();
    (typeof equipmentCache !== 'undefined' ? equipmentCache : []).forEach(e => {
        if (Array.isArray(e.tags)) e.tags.forEach(t => { if (t) set.add(String(t)); });
    });
    return [...set].sort((a, b) => a.localeCompare(b));
}

/** Normaliza o alvo de um requisito de equipamento (compatível com formato legado). */
function _cmReqTarget(req) {
    req = req || {};
    if (req.targetTipo === 'tag' || (req.tag && !req.equipamentoId)) return { kind: 'tag', value: req.tag || '' };
    if (req.targetTipo === 'tipo' || (req.tipoEquipamento && !req.equipamentoId)) return { kind: 'tipo', value: req.tipoEquipamento || '' };
    return { kind: 'equipamento', value: req.equipamentoId || req.id || '' };
}

/** Rótulo de exibição do alvo de um requisito. */
function _cmReqTargetLabel(req) {
    const t = _cmReqTarget(req);
    if (t.kind === 'tag') return `🏷️ Tag: ${escapeHtml(t.value)}`;
    if (t.kind === 'tipo') {
        const opt = _cmEquipTipos().find(o => o.value === t.value);
        return `${escapeHtml(opt ? opt.label : t.value)} <small style="opacity:.7">(tipo)</small>`;
    }
    return `🎒 ${escapeHtml(_cmEquipName(t.value))}`;
}

/** Normaliza as formas de equipar exigidas (compat: exigeEfeitosOn legado → ['efeitos']). */
function _cmReqFormas(req) {
    req = req || {};
    if (Array.isArray(req.formasEquip)) return req.formasEquip.filter(f => ['efeitos', 'segurando', 'fixado'].includes(f));
    return req.exigeEfeitosOn === true ? ['efeitos'] : [];
}

/**
 * Linha de custo de equipamento — chip expandido com configurações:
 * alvo (equipamento específico, tag ou tipo), consumir (sim/não),
 * quantidade mínima e formas de equipar exigidas
 * (Efeitos Ativos / Segurando / Fixado — nenhuma marcada = qualquer forma equipada).
 * req = { targetTipo, equipamentoId|tag|tipoEquipamento, quantidade, consumir, formasEquip, exigeEfeitosOn(legado) }
 */
function _buildEquipCostRow(req) {
    req = req || {};
    const target = _cmReqTarget(req);
    const consumir = req.consumir === true;
    const formas = _cmReqFormas(req);
    const formaChk = (key, icon, label) => `
        <label class="cm-forma-check">
            <input type="checkbox" data-ce-forma="${key}" ${formas.includes(key) ? 'checked' : ''} ${consumir ? 'disabled' : ''}>
            <span>${icon} ${label}</span>
        </label>`;
    return `
        <div class="cm-equip-cost-row" data-target-tipo="${target.kind}" data-eq-id="${target.kind === 'equipamento' ? escapeHtml(target.value) : ''}" data-eq-tag="${target.kind === 'tag' ? escapeHtml(target.value) : ''}" data-eq-tipo="${target.kind === 'tipo' ? escapeHtml(target.value) : ''}">
            <span class="cm-equip-cost-name">${_cmReqTargetLabel(req)}</span>
            <label class="cm-mini-label">Qtd mín.
                <input type="number" min="1" data-ce-key="quantidade" value="${Math.max(1, parseInt(req.quantidade, 10) || 1)}">
            </label>
            <label class="cm-mini-label">Modo
                <select data-ce-key="consumir" onchange="cmEquipCostModoChanged(this)">
                    <option value="equipado" ${!consumir ? 'selected' : ''}>Precisa estar equipado</option>
                    <option value="consumir" ${consumir ? 'selected' : ''}>Será consumido</option>
                </select>
            </label>
            <div class="cm-equip-cost-formas ${consumir ? 'cm-formas-disabled' : ''}">
                <span class="cm-mini-label">Precisa estar (nenhum = qualquer forma):</span>
                <div class="cm-forma-checks">
                    ${formaChk('efeitos', '⚡', 'Efeitos Ativos')}
                    ${formaChk('segurando', '🖐️', 'Segurando')}
                    ${formaChk('fixado', '📌', 'Fixado')}
                </div>
            </div>
            <button type="button" class="cm-chip-remove" onclick="this.closest('.cm-equip-cost-row').remove()">✕</button>
        </div>
    `;
}

window.cmEquipCostModoChanged = function (select) {
    const row = select.closest('.cm-equip-cost-row');
    const consumir = select.value === 'consumir';
    row.querySelectorAll('[data-ce-forma]').forEach(c => { c.disabled = consumir; });
    row.querySelector('.cm-equip-cost-formas')?.classList.toggle('cm-formas-disabled', consumir);
};

function _buildEquipCostArea(reqs, cssClass) {
    reqs = Array.isArray(reqs) ? reqs : [];
    const rows = reqs.map(r => _buildEquipCostRow(r)).join('');
    const tagOpts = _cmEquipAllTags().map(t => `<option value="tag::${escapeHtml(t)}">🏷️ ${escapeHtml(t)}</option>`).join('');
    const tipoOpts = _cmEquipTipos().map(o => `<option value="tipo::${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join('');
    return `
        <div class="cm-equip-cost-area ${cssClass || ''}">
            <div class="cm-equip-cost-list">${rows}</div>
            <select class="aura-mech-select" onchange="cmAddEquipCost(this)">
                <option value="">+ Vincular Equipamento, Tag ou Tipo (custo)...</option>
                <optgroup label="🗡️ Equipamentos específicos">
                    ${(typeof equipmentCache !== 'undefined' ? equipmentCache : [])
                        .map(e => `<option value="eq::${escapeHtml(e.id)}">${escapeHtml(e.nome)}</option>`).join('')}
                </optgroup>
                ${tagOpts ? `<optgroup label="🏷️ Por Tag (qualquer equipamento com a tag)">${tagOpts}</optgroup>` : ''}
                <optgroup label="📦 Por Tipo (qualquer equipamento do tipo)">${tipoOpts}</optgroup>
            </select>
        </div>
    `;
}

window.cmAddEquipCost = function (select) {
    const raw = select.value;
    if (!raw) return;
    const area = select.closest('.cm-equip-cost-area');
    const list = area?.querySelector('.cm-equip-cost-list');
    if (!list) { select.value = ''; return; }

    let req, dupKind, dupValue;
    if (raw.startsWith('tag::')) {
        const tag = raw.slice(5);
        req = { targetTipo: 'tag', tag, quantidade: 1, consumir: false, formasEquip: [] };
        dupKind = 'tag'; dupValue = tag;
    } else if (raw.startsWith('tipo::')) {
        const tipo = raw.slice(6);
        req = { targetTipo: 'tipo', tipoEquipamento: tipo, quantidade: 1, consumir: false, formasEquip: [] };
        dupKind = 'tipo'; dupValue = tipo;
    } else {
        const eqId = raw.startsWith('eq::') ? raw.slice(4) : raw;
        req = { targetTipo: 'equipamento', equipamentoId: eqId, quantidade: 1, consumir: false, formasEquip: [] };
        dupKind = 'equipamento'; dupValue = eqId;
    }
    const isDup = [...list.querySelectorAll('.cm-equip-cost-row')].some(r => {
        if ((r.dataset.targetTipo || 'equipamento') !== dupKind) return false;
        const v = dupKind === 'tag' ? r.dataset.eqTag : (dupKind === 'tipo' ? r.dataset.eqTipo : r.dataset.eqId);
        return v === dupValue;
    });
    if (isDup) { select.value = ''; return; }

    const temp = document.createElement('div');
    temp.innerHTML = _buildEquipCostRow(req);
    list.appendChild(temp.firstElementChild);
    select.value = '';
};

function _collectEquipCostArea(areaEl) {
    if (!areaEl) return [];
    const reqs = [];
    areaEl.querySelectorAll('.cm-equip-cost-row').forEach(row => {
        const targetTipo = row.dataset.targetTipo || 'equipamento';
        const consumir = row.querySelector('[data-ce-key="consumir"]')?.value === 'consumir';
        const formasEquip = consumir ? [] : [...row.querySelectorAll('[data-ce-forma]')]
            .filter(c => c.checked).map(c => c.dataset.ceForma);
        const req = {
            targetTipo,
            quantidade: Math.max(1, parseInt(row.querySelector('[data-ce-key="quantidade"]')?.value, 10) || 1),
            consumir,
            formasEquip,
            // Compat com fichas antigas: exigeEfeitosOn = exige exclusivamente "Efeitos Ativos"
            exigeEfeitosOn: formasEquip.length === 1 && formasEquip[0] === 'efeitos'
        };
        if (targetTipo === 'tag') {
            if (!row.dataset.eqTag) return;
            req.tag = row.dataset.eqTag;
        } else if (targetTipo === 'tipo') {
            if (!row.dataset.eqTipo) return;
            req.tipoEquipamento = row.dataset.eqTipo;
        } else {
            if (!row.dataset.eqId) return;
            req.equipamentoId = row.dataset.eqId;
        }
        reqs.push(req);
    });
    return reqs;
}

/**
 * Linha completa de um Módulo da Classe no editor.
 */
function _buildClassModuleEditorRow(idx, data) {
    data = data || {};
    const schemaArr = Array.isArray(data.schema) ? data.schema : [];
    const schemaRowsHtml = schemaArr.map((sf, si) => _buildSchemaFieldRow(idx, si, sf)).join('');

    // Limite: mecânicas vinculadas (novo) + compatibilidade com mecanicaLimiteId legado
    const limiteMecIds = Array.isArray(data.limiteMecanicaIds) ? data.limiteMecanicaIds.slice() : [];
    if (data.mecanicaLimiteId && !limiteMecIds.includes(data.mecanicaLimiteId)) limiteMecIds.push(data.mecanicaLimiteId);
    const limiteChips = limiteMecIds.map(id => _cmMechChip(id)).join('');

    const bloqueioMecIds = Array.isArray(data.bloqueioMecanicaIds) ? data.bloqueioMecanicaIds.slice() : [];
    const bloqueioChips = bloqueioMecIds.map(id => _cmMechChip(id)).join('');

    const custoCriacaoMecIds = Array.isArray(data.custoCriacaoMecanicaIds) ? data.custoCriacaoMecanicaIds.slice() : [];
    if (data.custoCriacaoMecanicaId && !custoCriacaoMecIds.includes(data.custoCriacaoMecanicaId)) custoCriacaoMecIds.push(data.custoCriacaoMecanicaId);
    const custoCriacaoChips = custoCriacaoMecIds.map(id => _cmMechChip(id)).join('');

    const custoEdicaoMecIds = Array.isArray(data.custoEdicaoMecanicaIds) ? data.custoEdicaoMecanicaIds.slice() : [];
    if (data.custoEdicaoMecanicaId && !custoEdicaoMecIds.includes(data.custoEdicaoMecanicaId)) custoEdicaoMecIds.push(data.custoEdicaoMecanicaId);
    const custoEdicaoChips = custoEdicaoMecIds.map(id => _cmMechChip(id)).join('');

    const custoRemocaoMecIds = Array.isArray(data.custoRemocaoMecanicaIds) ? data.custoRemocaoMecanicaIds.slice() : [];
    if (data.custoRemocaoMecanicaId && !custoRemocaoMecIds.includes(data.custoRemocaoMecanicaId)) custoRemocaoMecIds.push(data.custoRemocaoMecanicaId);
    const custoRemocaoChips = custoRemocaoMecIds.map(id => _cmMechChip(id)).join('');

    const permitirCriacao = data.permitirCriacaoJogador !== false;
    const predefArr = Array.isArray(data.itensPredefinidos) ? data.itensPredefinidos : [];
    const predefHtml = predefArr.map((it, pi) => _buildPredefItemRow(idx, pi, it, schemaArr)).join('');

    return `
        <div class="array-item class-module-editor-item" data-index="${idx}">
            <div class="array-item-header">
                <span class="array-item-number">📦 Módulo #${idx + 1}${data.titulo ? ` — ${escapeHtml(data.titulo)}` : ''}</span>
                <button type="button" class="btn-array-remove" onclick="removeClassModule(this)">✕</button>
            </div>

            <div class="cm-section">
                <div class="cm-section-title">🪪 Identidade</div>
                <div class="form-grid">
                    <div class="form-group">
                        <label>ID do Módulo <span class="required">*</span></label>
                        <input type="text" data-cm-key="id" value="${escapeHtml(data.id || '')}" placeholder="Ex: mod_locoes">
                    </div>
                    <div class="form-group">
                        <label>Tipo</label>
                        <select data-cm-key="tipo" onchange="this.closest('.class-module-editor-item').querySelector('.runo-config').style.display = this.value === 'runomancia' ? '' : 'none'">
                            <option value="lista" ${data.tipo === 'lista' || !data.tipo ? 'selected' : ''}>Lista</option>
                            <option value="grimorio" ${data.tipo === 'grimorio' ? 'selected' : ''}>Grimório</option>
                            <option value="runomancia" ${data.tipo === 'runomancia' ? 'selected' : ''}>ᛟ Runomancia — Lista de Estudo</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Título <span class="required">*</span></label>
                        <input type="text" data-cm-key="titulo" value="${escapeHtml(data.titulo || '')}" placeholder="Ex: Receita de Loções">
                    </div>
                    <div class="form-group">
                        <label>Ícone</label>
                        <input type="text" data-cm-key="icone" value="${escapeHtml(data.icone || '')}" placeholder="🧪" style="max-width:60px">
                    </div>
                </div>
            </div>

            <div class="cm-section">
                <div class="cm-section-title">🎯 Limite de Itens</div>
                <div class="form-grid">
                    <div class="form-group">
                        <label>Limite Fixo (nº de itens)</label>
                        <input type="number" min="0" data-cm-key="limiteFixo" value="${data.limiteFixo ?? ''}" placeholder="Vazio = sem limite fixo">
                    </div>
                    <div class="form-group">
                        <label>⚙️ Mecânicas de Limite</label>
                        <div class="aura-grau-mechs cm-limite-mechs" data-cm-key="limiteMecanicaIds">
                            <div class="mech-tags-container cm-limite-tags">${limiteChips}</div>
                            <select class="aura-mech-select" onchange="cmAddLimitMech(this)">
                                <option value="">+ Vincular Mecânica...</option>
                                ${_cmMechSelectOptions()}
                            </select>
                        </div>
                    </div>
                </div>
                <div class="cm-hint">O valor resolvido das mecânicas vinculadas (somadas) define o máximo de itens. Se houver limite fixo <b>e</b> mecânicas, a ficha usa <b>o maior valor</b>. Sem nada configurado = ilimitado.</div>
            </div>

            <div class="cm-section">
                <div class="cm-section-title">🔒 Bloqueio de Módulo</div>
                <div class="form-grid">
                    <div class="form-group full-width">
                        <label class="switch-label" style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                            <label class="switch">
                                <input type="checkbox" data-cm-key="cadastrarBloqueio" ${data.cadastrarBloqueio ? 'checked' : ''} onchange="this.closest('.cm-section').querySelector('.cm-bloqueio-area').style.display = this.checked ? 'block' : 'none'">
                                <span class="slider round"></span>
                            </label>
                            <span>Cadastrar Bloqueio no Módulo?</span>
                        </label>
                    </div>
                    <div class="form-group full-width cm-bloqueio-area" style="display: ${data.cadastrarBloqueio ? 'block' : 'none'}">
                        <label>⚙️ Mecânicas de Bloqueio (Requisitos)</label>
                        <div class="aura-grau-mechs cm-bloqueio-mechs" data-cm-key="bloqueioMecanicaIds">
                            <div class="mech-tags-container cm-bloqueio-tags">${bloqueioChips}</div>
                            <select class="aura-mech-select" onchange="cmAddBlockMech(this)">
                                <option value="">+ Vincular Mecânica (Booleana)...</option>
                                ${_cmMechSelectOptionsBooleana()}
                            </select>
                        </div>
                        <div class="cm-hint">Apenas mecânicas do tipo <b>Booleana</b>. Se qualquer uma falhar, o módulo inteiro ficará bloqueado na Ficha de Personagem.</div>
                    </div>
                </div>
            </div>

            <div class="cm-section">
                <div class="cm-section-title">💰 Custos por Item</div>
                <div class="form-grid">
                    <div class="form-group">
                        <label>Custo EXP por Item</label>
                        <input type="number" data-cm-key="custoExpPorItem" value="${data.custoExpPorItem ?? 0}" placeholder="0" min="0">
                    </div>
                    <div class="form-group">
                        <label>Label de Custo</label>
                        <input type="text" data-cm-key="custoExpLabel" value="${escapeHtml(data.custoExpLabel || '')}" placeholder="Ex: 5 EXP por receita">
                    </div>
                    <div class="form-group full-width">
                        <label>🎒 Custo de Equipamento</label>
                        ${_buildEquipCostArea(data.custoEquipamentos, 'cm-custo-eq-modulo')}
                        <div class="cm-hint">O jogador só poderá adicionar um novo item se cumprir <b>todos</b> os requisitos configurados. O requisito pode ser um <b>equipamento específico</b>, qualquer equipamento com uma <b>🏷️ Tag</b> ou de um <b>📦 Tipo</b>. "Será consumido" remove do inventário; "Precisa estar equipado" exige o item equipado — marque <b>⚡ Efeitos Ativos</b>, <b>🖐️ Segurando</b> e/ou <b>📌 Fixado</b> para exigir formas específicas (nenhum marcado = qualquer forma equipada vale).</div>
                    </div>
                    <div class="form-group full-width" style="margin-top: 10px;">
                        <label>Mecânica de Custo (Aplicada ao adicionar/criar item)</label>
                        <div class="aura-grau-mechs cm-custo-criacao-mechs" data-cm-key="custoCriacaoMecanicaIds">
                            <div class="mech-tags-container cm-custo-criacao-tags">${custoCriacaoChips}</div>
                            <select class="aura-mech-select" onchange="cmAddModuleMech(this, '.cm-custo-criacao-tags')">
                                <option value="">+ Vincular Mecânica...</option>
                                ${_cmMechSelectOptions()}
                            </select>
                        </div>
                        <div class="cm-hint">A adição do item será bloqueada se o jogador não tiver saldo suficiente para as mecânicas vinculadas. Mecânicas de soma ou bônus também podem ser atreladas aqui e serão aplicadas na criação. Na confirmação, o jogador vê o <b>preview dos efeitos</b> de cada mecânica (ex: "-1 em Presas"), não o nome interno.</div>
                    </div>
                </div>
            </div>

            <div class="cm-section">
                <div class="cm-section-title">⚙️ Custos Condicionais de Ação</div>
                <div class="form-grid">
                    <!-- Custo de Edição -->
                    <div class="form-group full-width" style="margin-bottom: 12px; padding: 10px; background:var(--lr-bg-1); border-radius: 6px; border: 1px solid rgba(139,92,246,0.2);">
                        <label class="switch-label" style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                            <label class="switch">
                                <input type="checkbox" data-cm-key="custoEdicaoAtivo" ${data.custoEdicaoAtivo ? 'checked' : ''} onchange="this.closest('.form-group').querySelector('.cm-edicao-mech').style.display = this.checked ? 'block' : 'none'">
                                <span class="slider round"></span>
                            </label>
                            <span style="font-weight: 600;">Custo por Edição</span>
                        </label>
                        <div class="cm-edicao-mech" style="display: ${data.custoEdicaoAtivo ? 'block' : 'none'}">
                            <label style="font-size: 0.75rem;">Mecânica de Custo (Aplicada ao editar um item na ficha)</label>
                            <div class="aura-grau-mechs cm-custo-edicao-mechs" data-cm-key="custoEdicaoMecanicaIds">
                                <div class="mech-tags-container cm-custo-edicao-tags">${custoEdicaoChips}</div>
                                <select class="aura-mech-select" onchange="cmAddModuleMech(this, '.cm-custo-edicao-tags')">
                                    <option value="">+ Vincular Mecânica...</option>
                                    ${_cmMechSelectOptions()}
                                </select>
                            </div>
                            <div class="cm-hint">Ao habilitar, a edição de itens na ficha ficará bloqueada até o jogador pagar este custo. Mecânicas de subtração irão deduzir valores; outras serão apenas aplicadas. O jogador vê o <b>preview dos efeitos</b> ao confirmar.</div>
                        </div>
                    </div>

                    <!-- Custo de Remoção -->
                    <div class="form-group full-width" style="padding: 10px; background:var(--lr-bg-1); border-radius: 6px; border: 1px solid rgba(239,68,68,0.2);">
                        <label class="switch-label" style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                            <label class="switch">
                                <input type="checkbox" data-cm-key="custoRemocaoAtivo" ${data.custoRemocaoAtivo ? 'checked' : ''} onchange="this.closest('.form-group').querySelector('.cm-remocao-mech').style.display = this.checked ? 'block' : 'none'">
                                <span class="slider round"></span>
                            </label>
                            <span style="font-weight: 600;">Custo de Remoção</span>
                        </label>
                        <div class="cm-remocao-mech" style="display: ${data.custoRemocaoAtivo ? 'block' : 'none'}">
                            <label style="font-size: 0.75rem;">Mecânica de Custo (Aplicada ao excluir um item da ficha)</label>
                            <div class="aura-grau-mechs cm-custo-remocao-mechs" data-cm-key="custoRemocaoMecanicaIds">
                                <div class="mech-tags-container cm-custo-remocao-tags">${custoRemocaoChips}</div>
                                <select class="aura-mech-select" onchange="cmAddModuleMech(this, '.cm-custo-remocao-tags')">
                                    <option value="">+ Vincular Mecânica...</option>
                                    ${_cmMechSelectOptions()}
                                </select>
                            </div>
                            <div class="cm-hint">Se as mecânicas definidas subtraírem recursos, o jogador não poderá deletar o item caso não tenha saldo suficiente para todas elas.</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="cm-section">
                <div class="cm-section-title">🎛️ Comportamento</div>
                <label class="cm-toggle-row">
                    <input type="checkbox" data-cm-key="permitirCriacaoJogador" ${permitirCriacao ? 'checked' : ''}>
                    <span>✏️ Jogador pode criar itens livremente neste módulo</span>
                </label>
                <div class="cm-hint">Desmarcado: o jogador só poderá <b>selecionar</b> itens pré-cadastrados (seção 🗂️ abaixo).</div>
            </div>

            <div class="runo-config full-width" style="display:${data.tipo === 'runomancia' ? '' : 'none'};grid-column:1/-1;border:1px dashed rgba(139,92,246,.4);border-radius:8px;padding:8px;margin:4px 10px">
                <div style="font-weight:700;font-size:.75rem;color:var(--lr-abyssal);margin-bottom:6px">ᛟ Parâmetros da Lista de Estudo (Compêndio, Parte XI)</div>
                <div class="form-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px">
                    <div class="form-group">
                        <label>Slots Base</label>
                        <input type="number" min="0" data-cm-key="runoSlotsBase" value="${data.runoSlotsBase ?? 2}" placeholder="2">
                        <div style="font-size:.6rem;color:var(--muted)">§11.1: todo Runomago começa com 2 slots.</div>
                    </div>
                    <div class="form-group">
                        <label>Perícia/Atributo dos Slots (dotKey)</label>
                        <input type="text" data-cm-key="runoSlotsDotKey" value="${escapeHtml(data.runoSlotsDotKey || '')}" placeholder="Ex: sk_classe_erudi__o_r_nica">
                        <div style="font-size:.6rem;color:var(--muted)">Cada nível expande a Lista de Estudo (§11.3).</div>
                    </div>
                    <div class="form-group">
                        <label>Slots por Nível</label>
                        <input type="number" min="0" step="0.5" data-cm-key="runoSlotsPorNivel" value="${data.runoSlotsPorNivel ?? 1}" placeholder="1">
                    </div>
                    <div class="form-group">
                        <label>Perícia/Atributo de Desconto (dotKey)</label>
                        <input type="text" data-cm-key="runoDescontoDotKey" value="${escapeHtml(data.runoDescontoDotKey || '')}" placeholder="Ex: sk_classe_erudi__o_r_nica">
                        <div style="font-size:.6rem;color:var(--muted)">Reduz o tempo de estudo dos elementos.</div>
                    </div>
                    <div class="form-group">
                        <label>Sessões Descontadas por Nível</label>
                        <input type="number" min="0" step="0.5" data-cm-key="runoDescontoPorNivel" value="${data.runoDescontoPorNivel ?? 1}" placeholder="1">
                        <div style="font-size:.6rem;color:var(--muted)">Tempo mínimo: 1 sessão.</div>
                    </div>
                    <div class="form-group">
                        <label>Multiplicador de EXP</label>
                        <input type="number" min="0" step="0.1" data-cm-key="runoCustoExpMult" value="${data.runoCustoExpMult ?? 1}" placeholder="1">
                        <div style="font-size:.6rem;color:var(--muted)">Multiplica o EXP definido em cada Elemento Rúnico.</div>
                    </div>
                </div>
                <div style="font-size:.62rem;color:var(--muted);margin-top:4px">O módulo lê dinamicamente todos os Elementos Rúnicos cadastrados (ᛟ) e seus custos de EXP/tempo por nível — nada é fixo no código.</div>
            </div>

            <!-- 🔁 RETORNO DE RECURSO — regra da CLASSE, não da magia.
                 O Bardo recupera Harmonia igual ao que gastou, +1 se ficou
                 parado, e perde tudo se a música quebrar. Cadastrar isso por
                 skill repetiria a mesma linha em trinta itens. -->
            <div class="cm-bloco">
                <div class="cm-mini-title">🔁 Retorno de Recurso no fim do turno</div>
                <div style="font-size:.62rem;color:var(--muted);margin-bottom:6px">
                    Deixe o recurso em branco para desligar. Vale para quem usa habilidade DESTE módulo.
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label>Recurso que volta</label>
                        <input type="text" data-cm-key="retornoRecurso" value="${escapeHtml(data.retornoRecurso || '')}" placeholder="Ex: Harmonia">
                        <div style="font-size:.6rem;color:var(--muted)">Volta o MESMO valor que foi gasto dele na conjuração.</div>
                    </div>
                    <div class="form-group">
                        <label>Bônus se não gastou a Ação de Movimento</label>
                        <input type="number" step="1" data-cm-key="retornoBonusParado" value="${data.retornoBonusParado ?? 0}" placeholder="0">
                        <div style="font-size:.6rem;color:var(--muted)">Valor fixo. Só entra se houve conjuração no turno.</div>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group">
                        <label style="display:flex;align-items:center;gap:6px">
                            <input type="checkbox" data-cm-key="retornoExigeSucesso" ${data.retornoExigeSucesso ? 'checked' : ''}>
                            Exige sucesso no teste
                        </label>
                    </div>
                    <div class="form-group">
                        <label style="display:flex;align-items:center;gap:6px">
                            <input type="checkbox" data-cm-key="retornoZeraSeFalhar" ${data.retornoZeraSeFalhar ? 'checked' : ''}>
                            Falhou → zera o recurso acumulado
                        </label>
                    </div>
                </div>
            </div>

            <div class="cm-section">
                <div class="cm-section-title-row">
                    <div class="cm-section-title">📋 Schema de Campos</div>
                    <button type="button" class="btn-array-add" style="font-size:.7rem;padding:3px 8px" onclick="addSchemaField(${idx}, this)">+ Campo</button>
                </div>
                <div class="cm-hint">key · label · tipo · largura · placeholder/fórmula · opções · 🔒 somente leitura. Tipos especiais: <b>Botão</b> aplica mecânicas ao clicar; <b>Dado</b> usa fórmula no campo "opções/fórmula" (ex: 2d6+1); <b>Imagem/Link</b> recebem URL do jogador.</div>
                <div class="schema-fields-container" id="schemaFields_${idx}">${schemaRowsHtml}</div>
            </div>

            <div class="cm-section">
                <div class="cm-section-title-row">
                    <div class="cm-section-title">🗂️ Itens Pré-cadastrados</div>
                    <button type="button" class="btn-array-add" style="font-size:.7rem;padding:3px 8px" onclick="addPredefItem(this)">+ Item</button>
                </div>
                <div class="cm-hint">Opções que o jogador pode escolher ao adicionar itens neste módulo. Cada item pode ter custos próprios (EXP / equipamentos) que substituem os custos padrão do módulo.</div>
                <div class="cm-predef-items">${predefHtml}</div>
            </div>
        </div>
    `;
}

window.cmAddBlockMech = function (select) {
    const mechId = select.value;
    if (!mechId) return;
    const container = select.closest('[data-cm-key="bloqueioMecanicaIds"]')?.querySelector('.cm-bloqueio-tags');
    if (!container) { select.value = ''; return; }
    if (container.querySelector(`[data-id="${mechId}"]`)) { select.value = ''; return; }
    const temp = document.createElement('div');
    temp.innerHTML = _cmMechChip(mechId);
    container.appendChild(temp.firstElementChild);
    select.value = '';
};

window.cmAddLimitMech = function (select) {
    const mechId = select.value;
    if (!mechId) return;
    const container = select.closest('[data-cm-key="limiteMecanicaIds"]')?.querySelector('.cm-limite-tags');
    if (!container) { select.value = ''; return; }
    if (container.querySelector(`[data-id="${mechId}"]`)) { select.value = ''; return; }
    const temp = document.createElement('div');
    temp.innerHTML = _cmMechChip(mechId);
    container.appendChild(temp.firstElementChild);
    select.value = '';
};

window.cmAddModuleMech = function (select, containerSelector) {
    const mechId = select.value;
    if (!mechId) return;
    const container = select.parentElement.querySelector(containerSelector);
    if (!container) { select.value = ''; return; }
    if (container.querySelector(`[data-id="${mechId}"]`)) { select.value = ''; return; }
    const temp = document.createElement('div');
    temp.innerHTML = _cmMechChip(mechId);
    container.appendChild(temp.firstElementChild);
    select.value = '';
};

function _findMechName(mechId) {
    if (!mechId) return '';
    const m = (typeof mechanicsCache !== 'undefined' ? mechanicsCache : []).find(x => x.id === mechId);
    return m ? m.nome : '';
}

// --- Schema field row ---
function _buildSchemaFieldRow(moduleIdx, fieldIdx, data) {
    data = data || {};
    const tipoOpts = CM_SCHEMA_TIPOS.map(t =>
        `<option value="${t.v}" ${data.tipo === t.v ? 'selected' : ''}>${t.label}</option>`
    ).join('');
    const largOpts = CM_LARGURAS.map(l =>
        `<option value="${l.v}" ${(data.largura || '') === l.v ? 'selected' : ''}>${l.label}</option>`
    ).join('');
    const extraVal = data.tipo === 'dado'
        ? (data.formula || '')
        : (Array.isArray(data.opcoes) ? data.opcoes.join(', ') : (data.opcoes || ''));
    const btnMechIds = Array.isArray(data.mecanicaIds) ? data.mecanicaIds : [];
    const btnChips = btnMechIds.map(id => _cmMechChip(id)).join('');
    const dvChip = data.tipo === 'valor_derivado' && data.derivedValueId ? _cmDVChip(data.derivedValueId) : '';
    return `
        <div class="schema-field-row" data-field-index="${fieldIdx}">
            <div class="schema-field-main">
                <button type="button" class="btn-array-move" onclick="cmMoveSchemaFieldUp(this)" title="Mover para cima" style="padding: 2px 5px; font-size: 0.7rem;">↑</button>
                <button type="button" class="btn-array-move" onclick="cmMoveSchemaFieldDown(this)" title="Mover para baixo" style="padding: 2px 5px; font-size: 0.7rem;">↓</button>
                <input type="text" data-sf-key="key" value="${escapeHtml(data.key || '')}" placeholder="key" style="width:80px">
                <input type="text" data-sf-key="label" value="${escapeHtml(data.label || '')}" placeholder="label" style="width:100px">
                <select data-sf-key="tipo" style="width:130px" onchange="cmSchemaTipoChange(this)">${tipoOpts}</select>
                <select data-sf-key="largura" style="width:95px">${largOpts}</select>
                <input type="text" data-sf-key="placeholder" value="${escapeHtml(data.placeholder || '')}" placeholder="placeholder" style="width:85px">
                <input type="text" data-sf-key="opcoes" value="${escapeHtml(extraVal)}"
                    placeholder="opções/fórmula" style="width:105px" title="select: opções separadas por vírgula · dado: fórmula fixa (ex: 2d6+1)">
                <label class="cm-sf-ro" title="Somente leitura para o jogador">🔒<input type="checkbox" data-sf-key="somenteLeitura" ${data.somenteLeitura ? 'checked' : ''}></label>
                <label class="cm-sf-ro" title="Ocultar se vazio na ficha de personagem" style="margin-left:4px">👁️<input type="checkbox" data-sf-key="ocultarSeVazio" ${data.ocultarSeVazio ? 'checked' : ''}></label>
                <label class="cm-sf-ro cm-sf-veiculo" title="Esta coluna é uma FORMA DE CONJURAR: o VD dela dá o Acerto, e o Tabuleiro oferece esta opção em vez de arma/parte do corpo" style="margin-left:4px;display:${data.tipo === 'select_vd' ? '' : 'none'}">🪄<input type="checkbox" data-sf-key="ehVeiculo" ${data.ehVeiculo ? 'checked' : ''}></label>
                <button type="button" class="cm-chip-remove" onclick="this.closest('.schema-field-row').remove()">✕</button>
            </div>
            <div class="schema-field-botao-mechs" style="display:${data.tipo === 'botao' ? '' : 'none'}">
                <div class="aura-grau-mechs" data-sf-key="mecanicaIds">
                    <span class="cm-mini-title">⚙️ Mecânicas aplicadas ao clicar:</span>
                    <div class="mech-tags-container sf-botao-tags">${btnChips}</div>
                    <select class="aura-mech-select" onchange="cmAddSchemaBtnMech(this)">
                        <option value="">+ Vincular Mecânica...</option>
                        ${_cmMechSelectOptions()}
                    </select>
                </div>
            </div>
            <div class="schema-field-dv-selector" style="display:${data.tipo === 'valor_derivado' ? '' : 'none'}">
                <div class="aura-grau-mechs" data-sf-key="derivedValueId">
                    <span class="cm-mini-title">📊 Valor Derivado vinculado:</span>
                    <div class="mech-tags-container sf-dv-tag">${dvChip}</div>
                    <select class="aura-mech-select" onchange="cmSetSchemaDV(this)">
                        <option value="">+ Vincular Valor Derivado...</option>
                        ${_cmDVSelectOptions()}
                    </select>
                </div>
            </div>
        </div>
    `;
}

window.cmSchemaTipoChange = function (select) {
    const row = select.closest('.schema-field-row');
    if (!row) return;
    const btnArea = row.querySelector('.schema-field-botao-mechs');
    if (btnArea) btnArea.style.display = select.value === 'botao' ? '' : 'none';
    const dvArea = row.querySelector('.schema-field-dv-selector');
    if (dvArea) dvArea.style.display = select.value === 'valor_derivado' ? '' : 'none';
    // 🪄 "É forma de conjurar" só faz sentido em coluna que aponta um VD.
    const veic = row.querySelector('.cm-sf-veiculo');
    if (veic) {
        veic.style.display = select.value === 'select_vd' ? '' : 'none';
        if (select.value !== 'select_vd') veic.querySelector('input').checked = false;
    }
};

window.cmSetSchemaDV = function (select) {
    const dvId = select.value;
    if (!dvId) return;
    const container = select.closest('[data-sf-key="derivedValueId"]')?.querySelector('.sf-dv-tag');
    if (!container) { select.value = ''; return; }
    // Substituir: apenas 1 DV vinculado por vez
    container.innerHTML = '';
    const temp = document.createElement('div');
    temp.innerHTML = _cmDVChip(dvId);
    container.appendChild(temp.firstElementChild);
    select.value = '';
};

window.cmAddSchemaBtnMech = function (select) {
    const mechId = select.value;
    if (!mechId) return;
    const container = select.closest('[data-sf-key="mecanicaIds"]')?.querySelector('.sf-botao-tags');
    if (!container) { select.value = ''; return; }
    if (container.querySelector(`[data-id="${mechId}"]`)) { select.value = ''; return; }
    const temp = document.createElement('div');
    temp.innerHTML = _cmMechChip(mechId);
    container.appendChild(temp.firstElementChild);
    select.value = '';
};

// --- Itens pré-cadastrados ---
function _buildPredefValoresGrid(schema, valores) {
    valores = valores || {};
    schema = Array.isArray(schema) ? schema : [];
    const editaveis = schema.filter(f => f.key && !['botao', 'separador'].includes(f.tipo));
    if (editaveis.length === 0) {
        return '<div class="cm-hint" style="margin:4px 0">Nenhum campo do schema disponível. Adicione campos ao 📋 Schema e clique em 🔄 Sincronizar.</div>';
    }
    return editaveis.map(f => {
        const lbl = escapeHtml(f.label || f.key);
        if (f.tipo === 'textarea') {
            return `<div class="cm-pv-field full"><label>${lbl}</label><textarea data-pv-key="${escapeHtml(f.key)}">${escapeHtml(valores[f.key] || '')}</textarea></div>`;
        }
        if (f.tipo === 'select') {
            const opts = (Array.isArray(f.opcoes) ? f.opcoes : []).map(o =>
                `<option value="${escapeHtml(o)}" ${valores[f.key] === o ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('');
            return `<div class="cm-pv-field"><label>${lbl}</label><select data-pv-key="${escapeHtml(f.key)}"><option value="">—</option>${opts}</select></div>`;
        }
        if (f.tipo === 'checkbox') {
            return `<div class="cm-pv-field"><label>${lbl}</label><input type="checkbox" data-pv-key="${escapeHtml(f.key)}" ${valores[f.key] ? 'checked' : ''}></div>`;
        }
        if (f.tipo === 'select_botao') {
            const mechOpts = (typeof mechanicsCache !== 'undefined' ? mechanicsCache : []).map(m =>
                `<option value="${escapeHtml(m.id)}" ${valores[f.key] === m.id ? 'selected' : ''}>${escapeHtml(m.nome)}</option>`).join('');
            return `<div class="cm-pv-field full"><label>${lbl} (Selecione a mecânica do botão)</label><select data-pv-key="${escapeHtml(f.key)}"><option value="">— Nenhuma mecânica vinculada —</option>${mechOpts}</select></div>`;
        }
        if (f.tipo === 'progress') {
            return `<div class="cm-pv-field"><label>${lbl} (atual/total)</label>
                <div style="display:flex;gap:4px;align-items:center">
                    <input type="text" data-pv-key="${escapeHtml(f.key)}_atual" value="${escapeHtml(valores[f.key + '_atual'] || '')}" placeholder="0" style="width:50px">
                    <span>/</span>
                    <input type="text" data-pv-key="${escapeHtml(f.key)}_total" value="${escapeHtml(valores[f.key + '_total'] || '')}" placeholder="0" style="width:50px">
                </div></div>`;
        }
        if (f.tipo === 'steps') {
            const steps = Array.isArray(valores[f.key]) ? valores[f.key] : [];
            const stepsHtml = steps.map((s, i) => {
                const sObj = (typeof s === 'object' && s !== null) ? s : {};
                return `<div class="cm-pv-step" style="border:1px solid rgba(148,163,184,.1);border-radius:6px;padding:6px 8px;margin-bottom:4px;background:var(--lr-bg-1)">
                    <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">
                        <input type="text" data-pv-step-name placeholder="Passo ${i + 1}" value="${escapeHtml(sObj.name || '')}" style="flex:1">
                        <button type="button" class="cm-chip-remove" onclick="cmPredefRemoveStep(this)">✕</button>
                    </div>
                    <textarea data-pv-step-desc placeholder="Descrição do passo..." style="width:100%;min-height:32px;resize:vertical;box-sizing:border-box">${escapeHtml(sObj.desc || '')}</textarea>
                </div>`;
            }).join('');
            return `<div class="cm-pv-field full"><label>${lbl}</label>
                <div class="cm-pv-steps" data-pv-steps-key="${escapeHtml(f.key)}">
                    ${stepsHtml}
                    <button type="button" class="btn-array-add" style="font-size:.65rem;padding:3px 8px" onclick="cmPredefAddStep(this, '${escapeHtml(f.key)}')">+ Passo</button>
                </div></div>`;
        }
        if (f.tipo === 'valor_derivado') {
            const dvId = f.derivedValueId || '';
            const dvChipHtml = dvId ? _cmDVChipReadOnly(dvId) : '<span style="color:var(--muted);font-size:.72rem">Nenhum DV vinculado no schema</span>';
            return `<div class="cm-pv-field"><label>${lbl}</label>${dvChipHtml}</div>`;
        }
        if (f.tipo === 'select_vd') {
            const dvArr = (typeof derivedValuesCache !== 'undefined' ? derivedValuesCache : []).filter(d => d.publicado !== false);
            const dvOpts = dvArr.map(d => {
                const icon = d.icone || '📊';
                return `<option value="${escapeHtml(d.id)}" ${valores[f.key] === d.id ? 'selected' : ''}>${escapeHtml(icon + ' ' + (d.nome || d.id))}</option>`;
            }).join('');
            return `<div class="cm-pv-field"><label>${lbl}</label><select data-pv-key="${escapeHtml(f.key)}"><option value="">— Selecionar Valor Derivado —</option>${dvOpts}</select></div>`;
        }
        const inputType = f.tipo === 'number' || f.tipo === 'contador' || f.tipo === 'avaliacao' ? 'number'
            : f.tipo === 'data' ? 'date'
            : f.tipo === 'cor' ? 'color' : 'text';
        const val = valores[f.key] !== undefined && valores[f.key] !== null ? valores[f.key] : (inputType === 'color' ? '#8b5cf6' : '');
        return `<div class="cm-pv-field"><label>${lbl}</label><input type="${inputType}" data-pv-key="${escapeHtml(f.key)}" value="${escapeHtml(String(val))}"></div>`;
    }).join('');
}

function _buildPredefItemRow(moduleIdx, itemIdx, data, schema) {
    data = data || {};
    const usaCustoEq = Array.isArray(data.custoEquipamentos);
    const predefId = data.id || '';
    return `
        <div class="cm-predef-item" data-predef-id="${escapeHtml(predefId)}">
            <div class="cm-predef-header">
                <span class="cm-predef-num">🗂️ Item #${itemIdx + 1}</span>
                <button type="button" class="cm-chip-remove" onclick="removePredefItem(this)">✕</button>
            </div>
            <div class="form-grid">
                <div class="form-group">
                    <label>Nome <span class="required">*</span></label>
                    <input type="text" data-pd-key="nome" value="${escapeHtml(data.nome || '')}" placeholder="Ex: Loção Revigorante">
                </div>
                <div class="form-group">
                    <label>Custo EXP próprio</label>
                    <input type="number" min="0" data-pd-key="custoExpProprio" value="${data.custoExpProprio ?? ''}" placeholder="Vazio = usa custo do módulo">
                </div>
                <div class="form-group full-width">
                    <label>Descrição (exibida na seleção)</label>
                    <textarea data-pd-key="descricao" rows="2" placeholder="Descrição curta do item...">${escapeHtml(data.descricao || '')}</textarea>
                </div>
            </div>
            <label class="cm-toggle-row">
                <input type="checkbox" data-pd-key="usarCustoEqProprio" ${usaCustoEq ? 'checked' : ''} onchange="cmPredefToggleCustoEq(this)">
                <span>🎒 Definir Custos de Equipamento próprios (substituem os do módulo)</span>
            </label>
            <div class="cm-predef-custo-eq" style="display:${usaCustoEq ? '' : 'none'}">
                ${_buildEquipCostArea(usaCustoEq ? data.custoEquipamentos : [], 'cm-custo-eq-predef')}
            </div>
            <label class="cm-toggle-row">
                <input type="checkbox" data-pd-key="usarMecanicaPropria" ${Array.isArray(data.custoCriacaoMecanicaIds) ? 'checked' : ''} onchange="cmPredefToggleMecanica(this)">
                <span>⚙️ Definir Mecânica de Custo própria (substitui a do módulo)</span>
            </label>
            <div class="cm-predef-mecanica" style="display:${Array.isArray(data.custoCriacaoMecanicaIds) ? '' : 'none'}">
                <label style="font-size: 0.75rem; margin-top: 5px; display: block;">Mecânica de Custo (Aplicada ao adicionar/criar item)</label>
                <div class="aura-grau-mechs cm-predef-custo-criacao-mechs" data-pd-key="custoCriacaoMecanicaIds">
                    <div class="mech-tags-container cm-predef-custo-criacao-tags">${(Array.isArray(data.custoCriacaoMecanicaIds) ? data.custoCriacaoMecanicaIds : []).map(id => _cmMechChip(id)).join('')}</div>
                    <select class="aura-mech-select" onchange="cmAddModuleMech(this, '.cm-predef-custo-criacao-tags')">
                        <option value="">+ Vincular Mecânica...</option>
                        ${_cmMechSelectOptions()}
                    </select>
                </div>
            </div>
            <div class="cm-predef-valores">
                <div class="cm-section-title-row">
                    <span class="cm-mini-title">🧬 Valores dos Campos (pré-preenchidos na ficha)</span>
                    <button type="button" class="btn-array-add" style="font-size:.65rem;padding:2px 6px" onclick="cmSyncPredefFields(this)">🔄 Sincronizar com Schema</button>
                </div>
                <div class="cm-pv-grid">${_buildPredefValoresGrid(schema, data.valores)}</div>
            </div>
            ${_buildPredefMira(data)}
        </div>
    `;
}

/**
 * 🎯 Mira & Ação do TABULEIRO (combate por turno). Distâncias em METROS;
 * todo alcance com o token como eixo conta a partir da BORDA dele.
 * `tipo` vazio = sem mira cadastrada (o Tabuleiro pergunta na hora de usar).
 */
/**
 * Campo de medida da mira (alcance/raio/comprimento/largura).
 *
 * É `text` e não `number` de propósito: a medida pode ser um número OU uma
 * fórmula da ficha de quem conjura — "Raio: (Liderança + PRE) metros" é regra
 * do Adepto, e antes só cabia na prosa, onde o Tabuleiro não lia.
 * A conferência ao vivo (shared/medida-formula.js) mostra os componentes que
 * a fórmula cita, para um nome digitado errado aparecer na hora e não na mesa.
 */
function _medidaField(label, key, valor, dica) {
    const v = valor ?? '';
    return `<div class="form-group">
        <label>${label} <span class="cm-medida-hint" title="Aceita número (4) ou fórmula com nomes da ficha: (Liderança + PRE), Percepção * 2">ƒ</span></label>
        <input type="text" inputmode="text" data-pd-key="${key}" value="${escapeHtml(String(v))}"
            placeholder="${escapeHtml(dica || 'número ou fórmula')}"
            oninput="window._conferirMedida(this)">
        <small class="cm-medida-check" data-for="${key}"></small>
    </div>`;
}

/** Conferência ao vivo do campo de medida — só avisa, nunca impede de salvar. */
window._conferirMedida = async function (input) {
    const saida = input.parentElement?.querySelector('.cm-medida-check');
    if (!saida) return;
    try {
        const { conferirMedida } = await import('../../shared/medida-formula.js?v=1');
        const r = conferirMedida(input.value);
        if (r.vazio) { saida.textContent = ''; saida.className = 'cm-medida-check'; return; }
        if (!r.ok) {
            saida.textContent = `⚠️ ${r.erro}`;
            saida.className = 'cm-medida-check erro';
            return;
        }
        if (!r.formula) { saida.textContent = ''; saida.className = 'cm-medida-check'; return; }
        saida.textContent = `ƒ usa da ficha: ${r.componentes.join(' · ')}`;
        saida.className = 'cm-medida-check ok';
    } catch (e) { /* sem conferência, o campo continua salvando */ }
};

function _buildPredefMira(data) {
    const m = data.mira || {};
    const custoAcao = data.custoAcao || 'padrao';
    const sel = (v, atual) => v === atual ? 'selected' : '';
    return `
        <details class="cm-predef-mira" ${m.tipo ? 'open' : ''}>
            <summary class="cm-mini-title">🎯 Mira & Ação (Tabuleiro — combate por turno)</summary>
            <div class="form-grid" style="margin-top:6px">
                <div class="form-group">
                    <label>Custo de ação (§6.2: padrão = 1 Ação Padrão)</label>
                    <select data-pd-key="custoAcao">
                        <option value="padrao" ${sel('padrao', custoAcao)}>⚡ Ação Padrão</option>
                        <option value="movimento" ${sel('movimento', custoAcao)}>👣 Ação de Movimento</option>
                        <option value="livre" ${sel('livre', custoAcao)}>🕊️ Ação Livre</option>
                        <option value="completa" ${sel('completa', custoAcao)}>⏳ Ação Completa (as duas)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Tipo de mira</label>
                    <select data-pd-key="miraTipo">
                        <option value="" ${sel('', m.tipo || '')}>— sem mira (pergunta na hora) —</option>
                        <option value="alvos" ${sel('alvos', m.tipo)}>🎯 Alvos escolhidos (tokens)</option>
                        <option value="locais" ${sel('locais', m.tipo)}>📍 Locais no mapa (chão vazio)</option>
                        <option value="geometria" ${sel('geometria', m.tipo)}>📐 Área geométrica</option>
                        <option value="cac" ${sel('cac', m.tipo)}>⚔️ Golpe (arco no token)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Forma (área)</label>
                    <select data-pd-key="miraForma">
                        <option value="circulo" ${sel('circulo', m.forma || 'circulo')}>⭕ Círculo</option>
                        <option value="cone" ${sel('cone', m.forma)}>📐 Cone</option>
                        <option value="linha" ${sel('linha', m.forma)}>📏 Linha</option>
                        <option value="ret" ${sel('ret', m.forma)}>⬛ Retângulo</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Origem da área</label>
                    <select data-pd-key="miraOrigem">
                        <option value="token" ${sel('token', m.origem || 'token')}>No conjurador (da borda do token)</option>
                        <option value="livre" ${sel('livre', m.origem)}>Ponto livre dentro do alcance</option>
                    </select>
                </div>
                ${_medidaField('Alcance (m)', 'miraAlcanceM', m.alcanceM, 'até onde mira/alvo')}
                ${_medidaField('Raio (m — círculo)', 'miraRaioM', m.raioM, 'raio da área')}
                ${_medidaField('Comprimento (m — cone/linha)', 'miraComprimentoM', m.comprimentoM, '')}
                ${_medidaField('Largura (m — linha/retângulo)', 'miraLarguraM', m.larguraM, '')}
                <div class="form-group"><label>Ângulo (graus — cone)</label><input type="number" min="10" max="180" data-pd-key="miraAngGraus" value="${m.angGraus ?? ''}" placeholder="60"></div>
                <div class="form-group"><label>Máx. de alvos <span class="cm-medida-hint" title="Em 📍 Locais no mapa, é quantos pontos de chão quem conjura pode marcar">?</span></label><input type="number" min="1" data-pd-key="miraMaxAlvos" value="${m.maxAlvos ?? ''}" placeholder="1"></div>
                <div class="form-group">
                    <label>🎲 Quantidade pelos Graus</label>
                    <label class="npcv2-check" style="font-weight:400;font-size:.75rem">
                        <input type="checkbox" data-pd-key="miraAlvosPorGraus" ${m.alvosPorGraus ? 'checked' : ''}>
                        Rola a conjuração antes de mirar; cada Grau de Sucesso vale um alvo (mínimo 1 ao passar), até o máximo acima.
                    </label>
                </div>
                <div class="form-group">
                    <label>Afeta</label>
                    <select data-pd-key="miraAfeta">
                        <option value="todos" ${sel('todos', m.afeta || 'todos')}>Todos na área</option>
                        <option value="inimigos" ${sel('inimigos', m.afeta)}>Só inimigos (outra facção)</option>
                        <option value="aliados" ${sel('aliados', m.afeta)}>Só aliados (mesma facção)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>☠️ Aplica condição (nome exato do registro de Condições)</label>
                    <input type="text" data-pd-key="miraCondicaoNome" value="${escapeHtml(m.condicaoNome || '')}" placeholder="Ex: Atordoado — vazio = nenhuma">
                </div>
                <div class="form-group">
                    <label>⏱️ Por quantas rodadas (vazio = até remover)</label>
                    <input type="number" min="0" data-pd-key="miraCondicaoRodadas" value="${m.condicaoRodadas ?? ''}" placeholder="Ex: 1">
                </div>
            </div>
        </details>`;
}

window.addPredefItem = function (btn) {
    const modItem = btn.closest('.class-module-editor-item');
    const container = modItem?.querySelector('.cm-predef-items');
    if (!container) return;
    const idx = container.children.length;
    const schema = _readSchemaFromDOM(modItem);
    const temp = document.createElement('div');
    temp.innerHTML = _buildPredefItemRow(0, idx, {}, schema);
    container.appendChild(temp.firstElementChild);
};

window.removePredefItem = function (btn) {
    const item = btn.closest('.cm-predef-item');
    const container = item?.parentElement;
    if (item) item.remove();
    if (container) {
        container.querySelectorAll('.cm-predef-item').forEach((el, i) => {
            const num = el.querySelector('.cm-predef-num');
            if (num) num.textContent = `🗂️ Item #${i + 1}`;
        });
    }
};

window.cmPredefToggleCustoEq = function (checkbox) {
    const area = checkbox.closest('.cm-predef-item')?.querySelector('.cm-predef-custo-eq');
    if (area) area.style.display = checkbox.checked ? '' : 'none';
};

window.cmPredefToggleMecanica = function (checkbox) {
    const area = checkbox.closest('.cm-predef-item')?.querySelector('.cm-predef-mecanica');
    if (area) area.style.display = checkbox.checked ? '' : 'none';
};

window.cmPredefAddStep = function (btn, fieldKey) {
    const wrap = btn.closest('[data-pv-steps-key]');
    if (!wrap) return;
    const idx = wrap.querySelectorAll('.cm-pv-step').length;
    const temp = document.createElement('div');
    temp.innerHTML = `<div class="cm-pv-step" style="border:1px solid rgba(148,163,184,.1);border-radius:6px;padding:6px 8px;margin-bottom:4px;background:var(--lr-bg-1)">
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">
            <input type="text" data-pv-step-name placeholder="Passo ${idx + 1}" value="" style="flex:1">
            <button type="button" class="cm-chip-remove" onclick="cmPredefRemoveStep(this)">✕</button>
        </div>
        <textarea data-pv-step-desc placeholder="Descrição do passo..." style="width:100%;min-height:32px;resize:vertical;box-sizing:border-box"></textarea>
    </div>`;
    wrap.insertBefore(temp.firstElementChild, btn);
};

window.cmPredefRemoveStep = function (btn) {
    const step = btn.closest('.cm-pv-step');
    if (step) step.remove();
};

/** Lê o schema atual diretamente das linhas do DOM (para sincronizar itens pré-cadastrados). */
function _readSchemaFromDOM(modItemEl) {
    const schema = [];
    modItemEl?.querySelectorAll('.schema-fields-container .schema-field-row').forEach(row => {
        const key = (row.querySelector('[data-sf-key="key"]')?.value || '').trim();
        if (!key) return;
        const tipo = row.querySelector('[data-sf-key="tipo"]')?.value || 'text';
        const sf = {
            key,
            label: (row.querySelector('[data-sf-key="label"]')?.value || '').trim(),
            tipo
        };
        const raw = (row.querySelector('[data-sf-key="opcoes"]')?.value || '').trim();
        if (raw && tipo === 'select') sf.opcoes = raw.split(',').map(o => o.trim()).filter(Boolean);
        if (row.querySelector('[data-sf-key="somenteLeitura"]')?.checked) sf.somenteLeitura = true;
        if (row.querySelector('[data-sf-key="ocultarSeVazio"]')?.checked) sf.ocultarSeVazio = true;
        if (row.querySelector('[data-sf-key="ehVeiculo"]')?.checked) sf.ehVeiculo = true;
        schema.push(sf);
    });
    return schema;
}

window.cmSyncPredefFields = function (btn) {
    const predefItem = btn.closest('.cm-predef-item');
    const modItem = btn.closest('.class-module-editor-item');
    if (!predefItem || !modItem) return;
    const grid = predefItem.querySelector('.cm-pv-grid');
    if (!grid) return;
    // Preservar valores atuais
    const valores = {};
    grid.querySelectorAll('[data-pv-key]').forEach(el => {
        valores[el.dataset.pvKey] = el.type === 'checkbox' ? el.checked : el.value;
    });
    // Preservar steps
    grid.querySelectorAll('[data-pv-steps-key]').forEach(stepsWrap => {
        const stepsKey = stepsWrap.dataset.pvStepsKey;
        const stepsArr = [];
        stepsWrap.querySelectorAll('.cm-pv-step').forEach(stepEl => {
            stepsArr.push({
                name: stepEl.querySelector('[data-pv-step-name]')?.value || '',
                desc: stepEl.querySelector('[data-pv-step-desc]')?.value || ''
            });
        });
        valores[stepsKey] = stepsArr;
    });
    const schema = _readSchemaFromDOM(modItem);
    grid.innerHTML = _buildPredefValoresGrid(schema, valores);
};

window.addClassModule = function (fieldKey) {
    const container = document.getElementById(`classModulesItems_${fieldKey}`);
    if (!container) return;
    const idx = container.children.length;
    const temp = document.createElement('div');
    temp.innerHTML = _buildClassModuleEditorRow(idx, {});
    container.appendChild(temp.firstElementChild);
};

window.removeClassModule = function (btn) {
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

window.addSchemaField = function (moduleIdx, btnEl) {
    // Preferir contexto do botão (índices podem mudar após remoções)
    let container = btnEl ? btnEl.closest('.class-module-editor-item')?.querySelector('.schema-fields-container') : null;
    if (!container) container = document.getElementById(`schemaFields_${moduleIdx}`);
    if (!container) return;
    
    let maxKey = 0;
    container.querySelectorAll('input[data-sf-key="key"]').forEach(input => {
        const val = parseInt(input.value, 10);
        if (!isNaN(val) && val > maxKey) {
            maxKey = val;
        }
    });
    const nextKey = (maxKey + 1).toString();

    const fieldIdx = container.children.length;
    const temp = document.createElement('div');
    temp.innerHTML = _buildSchemaFieldRow(moduleIdx, fieldIdx, { key: nextKey });
    container.appendChild(temp.firstElementChild);
};

/**
 * Coleta dados de um ÚNICO item .class-module-editor-item do DOM.
 * Reutilizado tanto pelo editor inline (classes) quanto pelo standalone (aba classModules).
 */
function _collectSingleModuleData(item) {
    const id = (item.querySelector('[data-cm-key="id"]')?.value || '').trim();
    const titulo = (item.querySelector('[data-cm-key="titulo"]')?.value || '').trim();
    if (!id && !titulo) return null; // skip empty

    // Mecânicas de limite (chips)
    const limiteMecanicaIds = [];
    item.querySelectorAll('.cm-limite-tags .mech-tag').forEach(tag => {
        if (tag.dataset.id) limiteMecanicaIds.push(tag.dataset.id);
    });
    const limiteFixoRaw = item.querySelector('[data-cm-key="limiteFixo"]')?.value ?? '';
    const limiteFixo = limiteFixoRaw !== '' ? Math.max(0, parseInt(limiteFixoRaw, 10) || 0) : null;

    const cadastrarBloqueio = item.querySelector('[data-cm-key="cadastrarBloqueio"]')?.checked || false;
    const bloqueioMecanicaIds = [];
    if (cadastrarBloqueio) {
        item.querySelectorAll('.cm-bloqueio-tags .mech-tag').forEach(tag => {
            if (tag.dataset.id) bloqueioMecanicaIds.push(tag.dataset.id);
        });
    }

    const mod = {
        id: id || ('mod_' + titulo.toLowerCase().replace(/[^a-z0-9]/g, '_')),
        tipo: item.querySelector('[data-cm-key="tipo"]')?.value || 'lista',
        titulo: titulo,
        icone: (item.querySelector('[data-cm-key="icone"]')?.value || '').trim() || '📦',
        custoExpPorItem: parseInt(item.querySelector('[data-cm-key="custoExpPorItem"]')?.value || '0', 10) || 0,
        custoExpLabel: (item.querySelector('[data-cm-key="custoExpLabel"]')?.value || '').trim(),
        cadastrarBloqueio: cadastrarBloqueio,
        bloqueioMecanicaIds: bloqueioMecanicaIds,
        limiteFixo: limiteFixo,
        limiteMecanicaIds: limiteMecanicaIds,
        // Compatibilidade legada: primeira mecânica vinculada
        mecanicaLimiteId: limiteMecanicaIds[0] || null,
        custoEquipamentos: _collectEquipCostArea(item.querySelector('.cm-custo-eq-modulo')),
        permitirCriacaoJogador: item.querySelector('[data-cm-key="permitirCriacaoJogador"]')?.checked !== false,
        custoEdicaoAtivo: item.querySelector('[data-cm-key="custoEdicaoAtivo"]')?.checked || false,
        custoEdicaoMecanicaIds: Array.from(item.querySelectorAll('[data-cm-key="custoEdicaoMecanicaIds"] .mech-tag')).map(t => t.dataset.id).filter(Boolean),
        custoEdicaoMecanicaId: null, // Legado compatível, não salva mais string única
        custoRemocaoAtivo: item.querySelector('[data-cm-key="custoRemocaoAtivo"]')?.checked || false,
        custoRemocaoMecanicaIds: Array.from(item.querySelectorAll('[data-cm-key="custoRemocaoMecanicaIds"] .mech-tag')).map(t => t.dataset.id).filter(Boolean),
        custoRemocaoMecanicaId: null,
        custoCriacaoMecanicaIds: Array.from(item.querySelectorAll('[data-cm-key="custoCriacaoMecanicaIds"] .mech-tag')).map(t => t.dataset.id).filter(Boolean),
        custoCriacaoMecanicaId: null,
        schema: [],
        itensPredefinidos: []
    };

    // Parâmetros do módulo Runomancia (Lista de Estudo)
    if (mod.tipo === 'runomancia') {
        const g = k => item.querySelector(`[data-cm-key="${k}"]`)?.value ?? '';
        mod.runoSlotsBase = parseInt(g('runoSlotsBase'), 10) || 0;
        mod.runoSlotsDotKey = (g('runoSlotsDotKey') || '').trim();
        mod.runoSlotsPorNivel = parseFloat(g('runoSlotsPorNivel')) || 0;
        mod.runoDescontoDotKey = (g('runoDescontoDotKey') || '').trim();
        mod.runoDescontoPorNivel = parseFloat(g('runoDescontoPorNivel')) || 0;
        mod.runoCustoExpMult = parseFloat(g('runoCustoExpMult')) || 1;
    }

    // 🔁 Retorno de recurso no fim do turno (ver shared/retorno-recurso.js)
    mod.retornoRecurso = (g('retornoRecurso') || '').trim();
    mod.retornoBonusParado = parseInt(g('retornoBonusParado'), 10) || 0;
    mod.retornoExigeSucesso = !!item.querySelector('[data-cm-key="retornoExigeSucesso"]')?.checked;
    mod.retornoZeraSeFalhar = !!item.querySelector('[data-cm-key="retornoZeraSeFalhar"]')?.checked;

    // Collect schema fields
    const schemaContainer = item.querySelector('.schema-fields-container');
    if (schemaContainer) {
        schemaContainer.querySelectorAll('.schema-field-row').forEach(row => {
            const key = (row.querySelector('[data-sf-key="key"]')?.value || '').trim();
            const tipo = row.querySelector('[data-sf-key="tipo"]')?.value || 'text';
            if (!key && tipo !== 'separador') return;
            const sf = {
                key: key || ('sep_' + Math.random().toString(36).substr(2, 5)),
                label: (row.querySelector('[data-sf-key="label"]')?.value || '').trim(),
                tipo: tipo,
                largura: row.querySelector('[data-sf-key="largura"]')?.value || '',
                placeholder: (row.querySelector('[data-sf-key="placeholder"]')?.value || '').trim()
            };
            if (row.querySelector('[data-sf-key="somenteLeitura"]')?.checked) sf.somenteLeitura = true;
            if (row.querySelector('[data-sf-key="ocultarSeVazio"]')?.checked) sf.ocultarSeVazio = true;
            // 🪄 Coluna que é FORMA DE CONJURAR — o Tabuleiro pergunta por ela
            // em vez de oferecer arma e parte do corpo.
            if (row.querySelector('[data-sf-key="ehVeiculo"]')?.checked) sf.ehVeiculo = true;
            const opcoesRaw = (row.querySelector('[data-sf-key="opcoes"]')?.value || '').trim();
            if (opcoesRaw && sf.tipo === 'select') {
                sf.opcoes = opcoesRaw.split(',').map(o => o.trim()).filter(Boolean);
            }
            if (opcoesRaw && sf.tipo === 'dado') {
                sf.formula = opcoesRaw;
            }
            if (sf.tipo === 'botao') {
                const mecanicaIds = [];
                row.querySelectorAll('.sf-botao-tags .mech-tag').forEach(tag => {
                    if (tag.dataset.id) mecanicaIds.push(tag.dataset.id);
                });
                sf.mecanicaIds = mecanicaIds;
            }
            if (sf.tipo === 'valor_derivado') {
                const dvTag = row.querySelector('.sf-dv-tag .mech-tag');
                sf.derivedValueId = dvTag?.dataset.id || '';
            }
            mod.schema.push(sf);
        });
    }

    // Collect itens pré-cadastrados
    item.querySelectorAll('.cm-predef-items .cm-predef-item').forEach(pd => {
        const nome = (pd.querySelector('[data-pd-key="nome"]')?.value || '').trim();
        if (!nome) return;
        const existingId = pd.dataset.predefId;
        const pdId = existingId && existingId !== 'undefined' && existingId !== ''
            ? existingId
            : 'pdi_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        const custoExpRaw = pd.querySelector('[data-pd-key="custoExpProprio"]')?.value ?? '';
        const usarCustoEq = pd.querySelector('[data-pd-key="usarCustoEqProprio"]')?.checked === true;
        const usarMecanica = pd.querySelector('[data-pd-key="usarMecanicaPropria"]')?.checked === true;
        const valores = {};
        pd.querySelectorAll('.cm-pv-grid [data-pv-key]').forEach(el => {
            valores[el.dataset.pvKey] = el.type === 'checkbox' ? el.checked : el.value;
        });
        // Coletar steps pré-cadastrados
        pd.querySelectorAll('.cm-pv-grid [data-pv-steps-key]').forEach(stepsWrap => {
            const stepsKey = stepsWrap.dataset.pvStepsKey;
            const stepsArr = [];
            stepsWrap.querySelectorAll('.cm-pv-step').forEach(stepEl => {
                stepsArr.push({
                    name: stepEl.querySelector('[data-pv-step-name]')?.value || '',
                    desc: stepEl.querySelector('[data-pv-step-desc]')?.value || ''
                });
            });
            valores[stepsKey] = stepsArr;
        });
        // 🎯 Mira & Ação do Tabuleiro (combate por turno)
        const pdv = (k) => pd.querySelector(`[data-pd-key="${k}"]`)?.value ?? '';
        const num = (k) => { const n = parseFloat(pdv(k)); return isNaN(n) ? null : n; };
        // 📏 Medida: número vira número (o formato de sempre); fórmula é
        // guardada como TEXTO e resolvida na hora do uso, contra a ficha de
        // quem conjura (shared/medida-formula.js).
        const medida = (k) => {
            const s = String(pdv(k)).trim();
            if (s === '') return 0;
            const n = parseFloat(s.replace(',', '.'));
            return (!isNaN(n) && String(n) === s.replace(',', '.')) ? n : s;
        };
        const miraTipo = pdv('miraTipo');
        const mira = miraTipo ? {
            tipo: miraTipo,
            forma: pdv('miraForma') || 'circulo',
            origem: pdv('miraOrigem') || 'token',
            alcanceM: medida('miraAlcanceM'),
            raioM: medida('miraRaioM'),
            comprimentoM: medida('miraComprimentoM'),
            larguraM: medida('miraLarguraM'),
            angGraus: num('miraAngGraus') ?? 60,
            maxAlvos: Math.max(1, parseInt(pdv('miraMaxAlvos'), 10) || 1),
            alvosPorGraus: !!pd.querySelector('[data-pd-key="miraAlvosPorGraus"]')?.checked,
            afeta: pdv('miraAfeta') || 'todos',
            condicaoNome: (pdv('miraCondicaoNome') || '').trim() || null,
            condicaoRodadas: num('miraCondicaoRodadas') ?? 0,
        } : null;

        mod.itensPredefinidos.push({
            id: pdId,
            nome,
            descricao: (pd.querySelector('[data-pd-key="descricao"]')?.value || '').trim(),
            custoExpProprio: custoExpRaw !== '' ? Math.max(0, parseInt(custoExpRaw, 10) || 0) : null,
            custoEquipamentos: usarCustoEq ? _collectEquipCostArea(pd.querySelector('.cm-custo-eq-predef')) : null,
            custoCriacaoMecanicaIds: usarMecanica ? Array.from(pd.querySelectorAll('.cm-predef-custo-criacao-mechs .mech-tag')).map(t => t.dataset.id).filter(Boolean) : null,
            custoAcao: pdv('custoAcao') || 'padrao',
            mira,
            valores
        });
    });

    return mod;
}

function _collectClassModulesData(fieldKey) {
    const container = document.getElementById(`classModulesItems_${fieldKey}`);
    if (!container) return [];
    const modules = [];
    container.querySelectorAll('.class-module-editor-item').forEach(item => {
        const mod = _collectSingleModuleData(item);
        if (mod) modules.push(mod);
    });
    return modules;
}

// ===== CLASS MODULE LINKER HELPERS =====

/** Adicionar um módulo ao linker (select -> chip) */
window._addClassModuleLink = function (select) {
    const modId = select.value;
    if (!modId) return;
    const area = select.closest('.cm-linker-area');
    const container = area?.querySelector('.cm-linker-chips');
    if (!container) { select.value = ''; return; }
    // Evitar duplicatas
    if (container.querySelector(`[data-id="${modId}"]`)) { select.value = ''; return; }
    const mod = classModulesCache.find(m => m.id === modId);
    const titulo = mod ? mod.titulo : modId;
    const icone = mod ? (mod.icone || '📦') : '📦';
    const temp = document.createElement('div');
    temp.innerHTML = `<span class="mech-tag cm-linker-chip" data-id="${escapeHtml(modId)}" onclick="event.stopPropagation(); window._openClassModuleFromLinker('${escapeHtml(modId)}')" style="cursor:pointer" title="Clique para editar">${icone} ${escapeHtml(titulo)} <button type="button" onclick="event.stopPropagation(); this.parentElement.remove(); window._syncClassModuleLinkerHidden()" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:.8rem;padding:0 2px">✕</button></span>`;
    container.appendChild(temp.firstElementChild);
    select.value = '';
    window._syncClassModuleLinkerHidden();
};

/** Sincronizar hidden input com chips atuais */
window._syncClassModuleLinkerHidden = function () {
    const container = document.querySelector('.cm-linker-chips');
    const hidden = document.getElementById('field_modulosDaClasse');
    if (!container || !hidden) return;
    const ids = Array.from(container.querySelectorAll('.cm-linker-chip'))
        .map(chip => chip.dataset.id)
        .filter(id => id && !id.startsWith('_legacy_'));
    hidden.value = JSON.stringify(ids);
};

/** Abrir modal de edição do módulo a partir do chip do linker */
window._openClassModuleFromLinker = function (moduleId) {
    // Abrir em sub-modal estilo peculiaridades (push/pop module stack)
    if (!window._moduleStack) window._moduleStack = [];
    window._moduleStack.push(currentModule);
    const prevEditingId = editingItemId;
    const prevAllItems = allItems;
    // Salvar referência do modal atual
    const mainFormModal = document.getElementById('formModal');
    // Mascarar IDs do form principal
    mainFormModal.querySelectorAll('[id]').forEach(el => {
        if (el.id.startsWith('field_') || el.id.startsWith('tags_') || el.id.startsWith('img_preview_') || el.id.startsWith('multisel_') || el.id.startsWith('classModules') || el.id.startsWith('schemaFields') || el.id === 'btnSave' || el.id === 'formTitle' || el.id === 'formFields' || el.id === 'dynamicForm') {
            if (!el.hasAttribute('data-temp-id-cml')) {
                el.dataset.tempIdCml = el.id;
                el.id = 'temp_cml_' + el.id;
            }
        }
    });
    // Criar overlay do sub-modal
    const overlay = document.createElement('div');
    overlay.className = 'modal form-modal active';
    overlay.id = 'subFormModalClassModule';
    window.bringModalToTop(overlay);
    overlay.innerHTML = `
        <div class="modal-content">
            <div class="form-header">
                <h2 id="formTitle">✏️ Editar Módulo de Classe</h2>
                <button class="btn-close-form" onclick="window._closeClassModuleSubForm()">✕</button>
            </div>
            <form id="dynamicForm" onsubmit="window._saveClassModuleSubForm(event)">
                <div id="formFields" class="form-body"></div>
                <div class="form-actions">
                    <div class="form-toggle toggle-publicado-container" style="padding:0">
                        <label class="toggle-publish"><input type="checkbox" id="field_publicado"><span class="toggle-slider"></span></label>
                        <span class="toggle-label">Publicado</span>
                    </div>
                    <div class="buttons-group" style="display:flex; gap:10px;">
                        <button type="button" class="btn-modal btn-cancel" onclick="window._closeClassModuleSubForm()">Cancelar</button>
                        <button type="submit" class="btn-save" id="btnSave">💾 Salvar Módulo</button>
                    </div>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(overlay);
    // Trocar contexto
    currentModule = 'classModules';
    // Carregar dados do módulo
    const modData = classModulesCache.find(m => m.id === moduleId);
    editingItemId = moduleId;
    allItems = classModulesCache;
    // Preencher form
    const container = overlay.querySelector('#formFields');
    const formGrid = document.createElement('div');
    formGrid.className = 'form-grid';
    const modDef = MODULE_DEFS.classModules;
    modDef.fields.forEach(field => {
        const value = modData ? modData[field.key] : undefined;
        const el = buildField(field, value, modData);
        formGrid.appendChild(el);
    });
    container.appendChild(formGrid);
    const pubField = overlay.querySelector('#field_publicado');
    if (pubField && modData) pubField.checked = !!modData.publicado;
    overlay.querySelector('#dynamicForm').dataset.module = 'classModules';
};

/** Salvar módulo editado a partir do sub-modal do linker */
window._saveClassModuleSubForm = async function (e) {
    e.preventDefault();
    const overlay = document.getElementById('subFormModalClassModule');
    if (!overlay) return;
    const btn = overlay.querySelector('#btnSave');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Salvando...'; }
    const moduleItem = overlay.querySelector('.class-module-editor-item');
    if (!moduleItem) { window._closeClassModuleSubForm(); return; }
    const modData = _collectSingleModuleData(moduleItem);
    if (!modData) { window._closeClassModuleSubForm(); return; }
    
    // Forçar ID a permanecer o mesmo do documento que está sendo editado
    modData.id = editingItemId;
    
    const pubEl = overlay.querySelector('#field_publicado');
    modData.publicado = pubEl ? pubEl.checked : false;
    modData.updatedAt = Timestamp.now();
    try {
        const docRef = doc(db, 'system/data/classModules', editingItemId);
        await updateDoc(docRef, modData);
        showAlert('✅ Módulo atualizado!', 'success');
        await refreshClassModulesCache();
        // Atualizar chip no linker
        document.querySelectorAll(`.cm-linker-chip[data-id="${editingItemId}"]`).forEach(chip => {
            const icone = modData.icone || '📦';
            const btnHtml = chip.querySelector('button')?.outerHTML || '';
            chip.innerHTML = `${icone} ${escapeHtml(modData.titulo)} ${btnHtml}`;
        });
    } catch (err) {
        console.error('Erro ao salvar módulo:', err);
        showAlert('❌ Erro ao salvar: ' + err.message, 'danger');
    }
    window._closeClassModuleSubForm();
};

/** Fechar sub-modal do módulo de classe */
window._closeClassModuleSubForm = function () {
    const overlay = document.getElementById('subFormModalClassModule');
    if (overlay) overlay.remove();
    // Restaurar IDs mascarados
    document.querySelectorAll('[data-temp-id-cml]').forEach(el => {
        el.id = el.dataset.tempIdCml;
        delete el.dataset.tempIdCml;
    });
    // Restaurar contexto
    if (window._moduleStack && window._moduleStack.length) {
        currentModule = window._moduleStack.pop();
    }
    editingItemId = null;
};

// ===== MIGRAÇÃO AUTOMÁTICA: MÓDULOS INLINE -> COLEÇÃO CENTRALIZADA =====

let _migrationDone = false;

/**
 * Migra módulos inline (objetos em modulosDaClasse das classes) para a coleção
 * system/data/classModules e converte os arrays para referências por ID.
 * Executada automaticamente ao carregar a aba classModules ou classes.
 */
async function _migrateInlineModulesToCollection() {
    if (_migrationDone) return;
    _migrationDone = true;
    try {
        const classesSnap = await getDocs(collection(db, 'system/data/classes'));
        const classes = [];
        classesSnap.forEach(d => classes.push({ ...d.data(), id: d.id }));
        let totalMigrated = 0;
        for (const cls of classes) {
            if (!Array.isArray(cls.modulosDaClasse) || cls.modulosDaClasse.length === 0) continue;
            // Verificar se há objetos inline (formato legado)
            const hasInline = cls.modulosDaClasse.some(m => typeof m === 'object' && m !== null);
            if (!hasInline) continue;
            const newIds = [];
            for (const mod of cls.modulosDaClasse) {
                if (typeof mod === 'string') {
                    newIds.push(mod); // Já é referência
                    continue;
                }
                if (typeof mod !== 'object' || mod === null) continue;
                // Verificar se já existe um módulo com esse ID na coleção
                const modId = mod.id || ('mod_' + (mod.titulo || '').toLowerCase().replace(/[^a-z0-9]/g, '_'));
                const existingSnap = await getDoc(doc(db, 'system/data/classModules', modId));
                if (existingSnap.exists()) {
                    // Módulo já migrado, apenas referenciar
                    newIds.push(modId);
                    continue;
                }
                // Criar documento na coleção centralizada
                const moduleData = { ...mod, id: modId, publicado: true, criadoEm: Timestamp.now(), criadoPor: currentUser?.uid || 'migration', updatedAt: Timestamp.now(), versao: 1 };
                await setDoc(doc(db, 'system/data/classModules', modId), moduleData);
                newIds.push(modId);
                totalMigrated++;
            }
            // Atualizar classe com referências
            await updateDoc(doc(db, 'system/data/classes', cls.id), { modulosDaClasse: newIds, updatedAt: Timestamp.now() });
        }
        if (totalMigrated > 0) {
            showAlert(`✅ Migração concluída: ${totalMigrated} módulo(s) migrado(s) para o repositório central.`, 'success');
            await refreshClassModulesCache();
            await refreshClassesCache();
        }
    } catch (err) {
        console.error('Erro na migração de módulos:', err);
        showAlert('⚠️ Erro na migração automática de módulos: ' + err.message, 'danger');
    }
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

// ===== CREATE/UPDATE ITEM =====
window.handleFormSubmit = async function (e) {
    e.preventDefault();
    
    // Fallback to currentModule if dataset is empty (though it should be set by openForm)
    const targetModule = e.target.dataset.module || currentModule;
    const modDef = MODULE_DEFS[targetModule];
    const data = {};
    const btn = document.getElementById('btnSave');

    // Collect field values
    modDef.fields.forEach(field => {
        if (field.type === 'class_tests_editor') {
            data[field.key] = _collectClassTestsData(field.key);
        } else if (field.type === 'class_modules_editor') {
            data[field.key] = _collectClassModulesData(field.key);
        } else if (field.type === 'class_module_standalone_editor') {
            // Standalone: coletar dados do único editor row e spread diretamente no data
            const moduleItem = document.querySelector('#formFields .class-module-editor-item');
            if (moduleItem) {
                const modData = _collectSingleModuleData(moduleItem);
                if (modData) Object.assign(data, modData);
            }
        } else if (field.type === 'class_module_linker') {
            const el = document.getElementById(`field_${field.key}`);
            if (el) {
                try { data[field.key] = JSON.parse(el.value || '[]'); }
                catch { data[field.key] = []; }
            } else { data[field.key] = []; }
        } else if (field.type === 'class_kits_editor') {
            data[field.key] = _collectClassKitsData(field.key);
        } else if (field.type === 'knowledge_reqs_editor') {
            data[field.key] = _collectKnowledgeReqs(field.key);
        } else if (field.type === 'book_link') {
            data[field.key] = _collectBookLink(field.key);
        } else if (field.type === 'wb_chapter_selector') {
            const el = document.getElementById(`field_${field.key}`);
            data[field.key] = el ? el.value : '';
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
        } else if (field.type === 'body_parts_editor') {
            data[field.key] = _collectBodyPartsData(field.key);
        } else if (field.type === 'multi_select' || field.type === 'body_parts_selector') {
            const el = document.getElementById(`field_${field.key}`);
            if (el) {
                try { data[field.key] = JSON.parse(el.value || '[]'); }
                catch { data[field.key] = []; }
            } else { data[field.key] = []; }

        } else if (field.type && field.type.startsWith('runic_')) {
            data[field.key] = collectRunicField(field);
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

    // Limpar valores obsoletos de campos condicionais ocultos.
    // Ex.: equipamento era "Arma" (categoriaArma preenchida) e virou "Vestimenta" —
    // sem isso, categoriaArma antiga era salva junto.
    modDef.fields.forEach(field => {
        if (field.showWhen && data[field.showWhen.field] !== field.showWhen.value) {
            data[field.key] = Array.isArray(data[field.key]) ? [] : (typeof data[field.key] === 'boolean' ? false : null);
        }
        if (field.showWhenBoolean && !data[field.showWhenBoolean]) {
            data[field.key] = Array.isArray(data[field.key]) ? [] : (typeof data[field.key] === 'boolean' ? false : null);
        }
    });

    // Peça de mão que aplica efeito nunca pode sair daqui como "Segurar"
    if (targetModule === 'equipment' && normalizaFormaEquipar(data)) {
        showAlert('⚠️ "Segurar" não aciona efeito — forma trocada para Empunhar.', 'danger');
    }

    // Publicado
    const pubEl = document.getElementById('field_publicado');
    data.publicado = pubEl ? pubEl.checked : false;

    // Metadata
    data.updatedAt = Timestamp.now();
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
        let isRequired = field.required;

        // Custom validation for categoriaArma (Tipo de Arma)
        if (field.key === 'categoriaArma' && data.tipo === 'Arma') {
            isRequired = true;
        }

        // Ignore required if field is hidden by conditional logic
        if (isRequired && field.showWhen) {
            if (data[field.showWhen.field] !== field.showWhen.value) {
                isRequired = false;
            }
        }
        if (isRequired && field.showWhenBoolean) {
            if (!data[field.showWhenBoolean]) {
                isRequired = false;
            }
        }

        if (isRequired) {
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
            // Impedir que o ID mude durante a edição (quebra de referências)
            if (targetModule === 'classModules') {
                data.id = editingItemId;
            }

            await updateDoc(doc(db, modDef.collection, editingItemId), data);
            showAlert('✅ Registro atualizado!', 'success');

            // === AUTO-LINK on update: vincular parte padrão a todas as raças ===
            if (targetModule === 'bodyParts' && data.ehPadrao === true) {
                await _autoLinkBodyPartToAllRaces(editingItemId);
            }
        } else {
            let newDocId;
            if (targetModule === 'classModules' && data.id) {
                // Usar setDoc com o ID manual provido pelo usuário
                const docRef = doc(db, modDef.collection, data.id);
                const existing = await getDoc(docRef);
                if (existing.exists()) {
                    showAlert('❌ Já existe um módulo com esse ID.', 'danger');
                    btnSave.disabled = false;
                    btnSave.textContent = '💾 Salvar';
                    return;
                }
                await setDoc(docRef, data);
                newDocId = data.id;
            } else {
                // Criar com ID aleatório gerado pelo Firebase
                const newDocRef = await addDoc(collection(db, modDef.collection), data);
                newDocId = newDocRef.id;
            }
            showAlert('✅ Registro criado!', 'success');

            // === AUTO-LINK: vincular parte padrão a todas as raças ===
            if (targetModule === 'bodyParts' && data.ehPadrao === true) {
                await _autoLinkBodyPartToAllRaces(newDocId);
            }
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
function _openMechEditor(itemId, parentFieldKey = null) {
    // When creating a new mechanic, pass currently selected filter tags
    const initialTags = (!itemId && currentModule === 'mechanics') ? [...getSelectedTags()] : [];
    openMechanicEditor(itemId, allItems, mechanicsCache, {
        db, collection, addDoc, updateDoc, doc, Timestamp,
        currentUser, showAlert, loadModule, escapeHtml
    }, initialTags, parentFieldKey);
}
window.openMechanicEditor = function (itemId, parentFieldKey) { _openMechEditor(itemId, parentFieldKey); };

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
        }, clone.tags || [], null, clone);
        
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

// ===== BODY PARTS EDITOR (for Races form) =====

function _buildBodyPartsEditorHTML(fieldKey, label, linkedParts) {
    // linkedParts = [{ id: 'docId', slots: 2 }, ...]
    const partsHtml = linkedParts.map((lp, idx) => {
        const bp = bodyPartsCache.find(b => b.id === lp.id);
        const nome = bp ? (bp.icone ? bp.icone + ' ' : '') + (bp.nome || lp.id) : '⚠️ ' + lp.id;
        const slots = lp.slots ?? 1;
        return `
            <div class="bp-linked-item" data-bp-id="${escapeHtml(lp.id)}" data-bp-index="${idx}">
                <div class="bp-linked-name">${escapeHtml(nome)}</div>
                <div class="bp-linked-slots">
                    <label>Slots:</label>
                    <input type="number" class="bp-slot-input" value="${slots}" min="0" max="99"
                        onchange="window._bpUpdateSlot(this)">
                </div>
                <button type="button" class="bp-linked-remove" onclick="window._bpRemovePart(this)"
                    title="Desvincular parte">✕</button>
            </div>
        `;
    }).join('');

    // Build dropdown of available parts (not yet linked)
    const linkedIds = new Set(linkedParts.map(lp => lp.id));
    const availableParts = bodyPartsCache.filter(bp => !linkedIds.has(bp.id));
    const optionsHtml = availableParts.map(bp => {
        const icon = bp.icone ? bp.icone + ' ' : '';
        return `<option value="${bp.id}">${escapeHtml(icon + (bp.nome || bp.id))}</option>`;
    }).join('');

    return `
        <div class="bp-editor" id="bpEditor_${fieldKey}" data-field-key="${fieldKey}">
            <div class="array-editor-header">
                <label>${escapeHtml(label)}</label>
            </div>
            <div class="bp-linked-list" id="bpLinkedList_${fieldKey}">
                ${partsHtml || '<div class="bp-empty-hint">Nenhuma parte do corpo vinculada. Use o seletor abaixo para adicionar.</div>'}
            </div>
            <div class="bp-add-bar">
                <select id="bpAddSelect_${fieldKey}" class="bp-add-select">
                    <option value="">+ Vincular Parte do Corpo...</option>
                    ${optionsHtml}
                </select>
                <button type="button" class="btn-array-add" onclick="window._bpAddPart('${fieldKey}')">➕ Vincular</button>
            </div>
        </div>
    `;
}

window._bpAddPart = function(fieldKey) {
    const select = document.getElementById(`bpAddSelect_${fieldKey}`);
    if (!select || !select.value) return;
    const bpId = select.value;

    // Check if already linked
    const list = document.getElementById(`bpLinkedList_${fieldKey}`);
    if (!list) return;
    if (list.querySelector(`[data-bp-id="${bpId}"]`)) {
        select.value = '';
        return;
    }

    // Remove empty hint
    const hint = list.querySelector('.bp-empty-hint');
    if (hint) hint.remove();

    // Find body part info
    const bp = bodyPartsCache.find(b => b.id === bpId);
    const nome = bp ? (bp.icone ? bp.icone + ' ' : '') + (bp.nome || bpId) : bpId;
    const idx = list.children.length;

    const div = document.createElement('div');
    div.className = 'bp-linked-item';
    div.dataset.bpId = bpId;
    div.dataset.bpIndex = idx;
    div.innerHTML = `
        <div class="bp-linked-name">${escapeHtml(nome)}</div>
        <div class="bp-linked-slots">
            <label>Slots:</label>
            <input type="number" class="bp-slot-input" value="1" min="0" max="99"
                onchange="window._bpUpdateSlot(this)">
        </div>
        <button type="button" class="bp-linked-remove" onclick="window._bpRemovePart(this)"
            title="Desvincular parte">✕</button>
    `;
    list.appendChild(div);

    // Remove option from dropdown
    const option = select.querySelector(`option[value="${bpId}"]`);
    if (option) option.remove();
    select.value = '';
};

window._bpRemovePart = function(btn) {
    const item = btn.closest('.bp-linked-item');
    if (!item) return;
    const bpId = item.dataset.bpId;
    const editor = item.closest('.bp-editor');
    const fieldKey = editor?.dataset.fieldKey;

    // Add back to dropdown
    if (fieldKey) {
        const select = document.getElementById(`bpAddSelect_${fieldKey}`);
        if (select) {
            const bp = bodyPartsCache.find(b => b.id === bpId);
            const icon = bp?.icone ? bp.icone + ' ' : '';
            const opt = document.createElement('option');
            opt.value = bpId;
            opt.textContent = icon + (bp?.nome || bpId);
            select.appendChild(opt);
        }
    }

    item.remove();

    // Show empty hint if no parts left
    const list = editor?.querySelector('.bp-linked-list');
    if (list && list.children.length === 0) {
        list.innerHTML = '<div class="bp-empty-hint">Nenhuma parte do corpo vinculada. Use o seletor abaixo para adicionar.</div>';
    }
};

window._bpUpdateSlot = function(input) {
    // No extra logic needed — value is collected on save
};

function _collectBodyPartsData(fieldKey) {
    const list = document.getElementById(`bpLinkedList_${fieldKey}`);
    if (!list) return [];
    const result = [];
    list.querySelectorAll('.bp-linked-item').forEach(item => {
        const id = item.dataset.bpId;
        const slotsInput = item.querySelector('.bp-slot-input');
        const slots = slotsInput ? parseInt(slotsInput.value, 10) || 0 : 1;
        if (id) result.push({ id, slots });
    });
    return result;
}

// ===== AUTO-LINK: Body Part padrão → todas as raças =====
async function _autoLinkBodyPartToAllRaces(bodyPartId) {
    try {
        const racesSnap = await getDocs(collection(db, 'system/data/races'));
        let linked = 0;
        const promises = [];

        racesSnap.forEach(raceDoc => {
            const raceData = raceDoc.data();
            const partes = Array.isArray(raceData.partesDoCorpo) ? raceData.partesDoCorpo : [];
            const alreadyLinked = partes.some(p => p.id === bodyPartId);

            if (!alreadyLinked) {
                const updatedPartes = [...partes, { id: bodyPartId, slots: 1 }];
                promises.push(
                    updateDoc(doc(db, 'system/data/races', raceDoc.id), {
                        partesDoCorpo: updatedPartes,
                        atualizadoEm: Timestamp.now()
                    })
                );
                linked++;
            }
        });

        if (promises.length > 0) {
            await Promise.all(promises);
            showAlert(`🦴 Parte padrão vinculada automaticamente a ${linked} raça(s)!`, 'success');
        }
    } catch (e) {
        console.error('Erro ao auto-vincular parte do corpo:', e);
        showAlert('⚠️ Parte criada, mas houve erro na vinculação automática: ' + e.message, 'danger');
    }
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
    // Escapa também aspas (simples e duplas): essencial porque este helper é
    // usado dentro de atributos HTML (value="...", data-*="..."). Sem isso,
    // valores contendo aspas quebravam o atributo e corrompiam dados
    // (ex.: o input hidden do multi_select com JSON ["FOR","DES"]).
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function safeJsonParse(str, fallback) {
    try { return JSON.parse(str); } catch { return fallback; }
}

function truncate(str, maxLen) {
    if (!str) return '';
    return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}

// =====================================================================
// ᛟ RUNOMANCIA — Importação do Compêndio (5 Artus + 14 Aspectus + 45 Sigilus)
// =====================================================================
window.runicImportSeed = async function () {
    if (!await LRDialogo.confirmar('Importar os 64 Elementos Rúnicos do Compêndio da Magia Rúnica?\n(Reimportar sobrescreve os elementos importados anteriormente, preservando os criados manualmente.)')) return;
    const btn = document.getElementById('runicSeedBtn');
    try {
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Importando…'; }
        const total = await importRunicSeed(db, { doc, setDoc }, (done, all, nome) => {
            if (btn) btn.textContent = `⏳ ${done}/${all} — ${nome}`;
        });
        showAlert(`✅ ${total} Elementos Rúnicos importados do Compêndio.`, 'success');
        loadModule('runicElements');
    } catch (e) {
        console.error(e);
        showAlert('❌ Falha na importação: ' + e.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '📥 Importar Compêndio (64 elementos)'; }
    }
};

window.cmMoveSchemaFieldUp = function(btn) {
    const row = btn.closest('.schema-field-row');
    if (row && row.previousElementSibling) {
        row.parentNode.insertBefore(row, row.previousElementSibling);
    }
};

window.cmMoveSchemaFieldDown = function(btn) {
    const row = btn.closest('.schema-field-row');
    if (row && row.nextElementSibling) {
        row.parentNode.insertBefore(row.nextElementSibling, row);
    }
};
