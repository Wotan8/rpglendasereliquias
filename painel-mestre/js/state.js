// =============================================
// PAINEL DO MESTRE — Shared Application State
// =============================================

// ===== USER STATE =====
export let currentUser = null;
export function setCurrentUser(user) { currentUser = user; }

// ===== CHARACTER STATE =====
export let allCharacters = [];
export function setAllCharacters(chars) { allCharacters = chars; }

export let currentEditingCharacter = null;
export function setCurrentEditingCharacter(char) { currentEditingCharacter = char; }

// ===== NPC STATE =====
export let allNpcs = [];
export function setAllNpcs(npcs) { allNpcs = npcs; }

export let currentEditingNpcId = null;
export function setCurrentEditingNpcId(id) { currentEditingNpcId = id; }

// ===== ALLIES STATE =====
export let allAllies = [];
export function setAllAllies(allies) { allAllies = allies; }

export let filteredAllies = [];
export function setFilteredAllies(allies) { filteredAllies = allies; }

// ===== COMBAT STATE =====
export let combatParticipants = [];
export function setCombatParticipants(p) { combatParticipants = p; }

// ===== APOIO STATE =====
export let todosApoiosCarregados = [];
export function setTodosApoiosCarregados(apoios) { todosApoiosCarregados = apoios; }

export let currentSelectedUserId = null;
export function setCurrentSelectedUserId(id) { currentSelectedUserId = id; }

// ===== ECONOMY STATE =====
export let economyItems = [];
export function setEconomyItems(items) { economyItems = items; }

export let economyLocations = [];
export function setEconomyLocations(locations) { economyLocations = locations; }

export let economyEvents = [];
export function setEconomyEvents(events) { economyEvents = events; }

export let economyCoisas = [];
export function setEconomyCoisas(coisas) { economyCoisas = coisas; }

export let currentEditingEconomyId = null;
export function setCurrentEditingEconomyId(id) { currentEditingEconomyId = id; }

export let currentEditingEconomyType = null;
export function setCurrentEditingEconomyType(type) { currentEditingEconomyType = type; }

export let currentEditingCoisaId = null;
export function setCurrentEditingCoisaId(id) { currentEditingCoisaId = id; }

// ===== ITEM AVULSO STATE =====
export let avulsosItems = [];
export function setAvulsosItems(items) { avulsosItems = items; }

export let currentEditingAvulsoItemId = null;
export function setCurrentEditingAvulsoItemId(id) { currentEditingAvulsoItemId = id; }

export let isAvulsoMode = false;
export function setIsAvulsoMode(mode) { isAvulsoMode = mode; }

export let currentOpenContainerId = null;
export function setCurrentOpenContainerId(id) { currentOpenContainerId = id; }

export let openAvulsoContainerStack = [];
export function setOpenAvulsoContainerStack(stack) { openAvulsoContainerStack = stack; }

// ===== INVENTARIO MESTRE STATE =====
export let currentInventarioPersonagemId = null;
export function setCurrentInventarioPersonagemId(id) { currentInventarioPersonagemId = id; }

export let currentInventarioContainers = [];
export function setCurrentInventarioContainers(c) { currentInventarioContainers = c; }

export let currentInventarioItems = [];
export function setCurrentInventarioItems(items) { currentInventarioItems = items; }

export let currentEditingContainerIdMestre = null;
export function setCurrentEditingContainerIdMestre(id) { currentEditingContainerIdMestre = id; }

export let currentEditingItemIdMestre = null;
export function setCurrentEditingItemIdMestre(id) { currentEditingItemIdMestre = id; }

export let currentItemImageBase64Mestre = null;
export function setCurrentItemImageBase64Mestre(img) { currentItemImageBase64Mestre = img; }

export let currentOpenPersonagemContainerId = null;
export function setCurrentOpenPersonagemContainerId(id) { currentOpenPersonagemContainerId = id; }

// ===== DRAG AND DROP STATE =====
export let draggedItemId = null;
export function setDraggedItemId(id) { draggedItemId = id; }

export let dragSourceType = null;
export function setDragSourceType(type) { dragSourceType = type; }

export let avulsosDisplayOrder = [];
export function setAvulsosDisplayOrder(order) { avulsosDisplayOrder = order; }

export let personagensDisplayOrder = [];
export function setPersonagensDisplayOrder(order) { personagensDisplayOrder = order; }

// ===== METAS STATE =====
export let metasData = {
    classe: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
    raca: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
    lore: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]
};
export function setMetasData(data) { metasData = data; }

export let totaisApoios = { classe: 0, raca: 0, lore: 0 };
export function setTotaisApoios(totais) { totaisApoios = totais; }

export let desbloquearMetas = {};
export function setDesbloquearMetas(metas) { desbloquearMetas = metas; }

// ===== LISTA DE PRODUÇÃO =====
export let listaProducao = [];
export function setListaProducao(lista) { listaProducao = lista; }

// ===== NOTIFICATION CACHE =====
export let notificationUsersCache = [];
export function setNotificationUsersCache(cache) { notificationUsersCache = cache; }

// ===== PARSED JSON ITEMS =====
export let parsedJsonItems = [];
export function setParsedJsonItems(items) { parsedJsonItems = items; }

// ===== MESA STATE =====
export let currentMesaId = null;
export function setCurrentMesaId(id) { currentMesaId = id; }

export let currentMesaData = null;
export function setCurrentMesaData(data) { currentMesaData = data; }

export let allMesas = [];
export function setAllMesas(mesas) { allMesas = mesas; }

export let mesaCharacters = [];
export function setMesaCharacters(chars) { mesaCharacters = chars; }

export let mesaSessionLogs = [];
export function setMesaSessionLogs(logs) { mesaSessionLogs = logs; }

export let isExpMode = false;
export function setIsExpMode(mode) { isExpMode = mode; }
