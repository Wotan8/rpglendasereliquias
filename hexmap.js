// Estado da aplicação
let state = {
    mapWidth: 15,
    mapHeight: 12,
    hexSize: 40,
    currentTerrain: 'cursor',
    editMode: 'paint',
    brushSize: 1,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    hexMap: [],
    annotations: {},
    layers: {
        terrain: true,
        annotations: true,
        grid: true
    },
    selectedHex: null,
    isDragging: false,
    lastX: 0,
    lastY: 0,
    history: [],
    historyIndex: -1,
    maxHistory: 50,
    terrainImages: {},
    loadedImages: {},
    isFullscreen: false,
    isViewMode: false,
    measurementStart: null,
    measurementEnd: null,
    isMeasuring: false,
    kmPerHex: 10,
    hoursPerHex: 3
};

// Definições de terrenos
const terrains = {
    cursor: { color: '#666666', name: 'Cursor', symbol: '🖱️', isCursor: true },
    grass: { color: '#8BC34A', name: 'Planície', symbol: '🌾' },
    forest: { color: '#388E3C', name: 'Floresta', symbol: '🌲' },
    darkforest: { color: '#1B5E20', name: 'F. Escura', symbol: '🌳' },
    mountain: { color: '#616161', name: 'Montanha', symbol: '⛰️' },
    highmountain: { color: '#424242', name: 'Pico', symbol: '🏔️' },
    water: { color: '#2196F3', name: 'Água', symbol: '🌊' },
    deepwater: { color: '#0D47A1', name: 'Mar', symbol: '🌊' },
    desert: { color: '#FFA000', name: 'Deserto', symbol: '🏜️' },
    sand: { color: '#FFD54F', name: 'Areia', symbol: '⛱️' },
    snow: { color: '#E1F5FE', name: 'Neve', symbol: '❄️' },
    ice: { color: '#B3E5FC', name: 'Gelo', symbol: '🧊' },
    swamp: { color: '#5D4037', name: 'Pântano', symbol: '🌿' },
    city: { color: '#9C27B0', name: 'Cidade', symbol: '🏰' },
    ruins: { color: '#9E9E9E', name: 'Ruínas', symbol: '🏛️' },
    lava: { color: '#D32F2F', name: 'Lava', symbol: '🌋' },
    cave: { color: '#3E2723', name: 'Caverna', symbol: '🕳️' }
};

let canvas, ctx, minimap, minimapCtx;

// Inicialização - chamada após autenticação
function init() {
    // Obter elementos do DOM
    canvas = document.getElementById('hexCanvas');
    ctx = canvas.getContext('2d');
    minimap = document.getElementById('minimap');
    minimapCtx = minimap.getContext('2d');

    resizeCanvas();
    initializeMap();
    loadTerrainImagesFromStorage();
    createTerrainGrid();
    drawMap();
    drawMinimap();
    updateStats();
    updateUndoRedoButtons();

    window.addEventListener('resize', () => {
        resizeCanvas();
        drawMap();
        drawMinimap();
    });

    window.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            undo();
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
            e.preventDefault();
            redo();
        }

        if (state.selectedHex && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            navigateWithArrows(e.key);
        }
    });

    canvas.addEventListener('mousedown', startDrag);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', endDrag);
    canvas.addEventListener('mouseleave', endDrag);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
}

// Expor init para ser chamado pelo HTML após autenticação
window.initHexmap = init;
console.log('[hexmap.js] ✅ window.initHexmap definido:', typeof window.initHexmap);

function resizeCanvas() {
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
}

function initializeMap() {
    state.hexMap = [];
    for (let row = 0; row < state.mapHeight; row++) {
        state.hexMap[row] = [];
        for (let col = 0; col < state.mapWidth; col++) {
            state.hexMap[row][col] = 'grass';
        }
    }
    state.annotations = {};

    state.history = [{
        hexMap: JSON.parse(JSON.stringify(state.hexMap)),
        annotations: JSON.parse(JSON.stringify(state.annotations))
    }];
    state.historyIndex = 0;

    updateMapDimensions();
    updateUndoRedoButtons();
}

function createTerrainGrid() {
    const grid = document.getElementById('terrainGrid');
    grid.innerHTML = '';

    Object.keys(terrains).forEach(key => {
        const terrain = terrains[key];
        const div = document.createElement('div');
        div.className = 'terrain-item' + (key === state.currentTerrain ? ' active' : '');

        if (key === 'cursor') {
            div.style.background = 'linear-gradient(135deg, #555 0%, #333 100%)';
            div.style.border = '2px dashed rgba(255, 255, 255, 0.4)';
        } else if (state.terrainImages[key] && state.loadedImages[key]) {
            div.style.background = 'none';
            div.style.position = 'relative';
            div.style.overflow = 'hidden';

            const imgBg = document.createElement('div');
            imgBg.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-image: url(${state.terrainImages[key]});
                background-size: cover;
                background-position: center;
                opacity: 0.8;
            `;
            div.appendChild(imgBg);
        } else {
            div.style.background = `linear-gradient(135deg, ${terrain.color}, ${darkenColor(terrain.color, 20)})`;
        }

        const content = document.createElement('div');
        content.style.position = 'relative';
        content.style.zIndex = '1';
        content.innerHTML = `
            <div style="font-size: 28px;">${state.terrainImages[key] ? '🖼️' : terrain.symbol}</div>
            <div class="terrain-name">${terrain.name}</div>
        `;
        div.appendChild(content);

        div.onclick = () => selectTerrain(key);
        grid.appendChild(div);
    });
}

function selectTerrain(terrain) {
    state.currentTerrain = terrain;
    document.querySelectorAll('.terrain-item').forEach(el => el.classList.remove('active'));
    event.target.closest('.terrain-item').classList.add('active');
}

function darkenColor(color, percent) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max((num >> 16) - amt, 0);
    const G = Math.max((num >> 8 & 0x00FF) - amt, 0);
    const B = Math.max((num & 0x0000FF) - amt, 0);
    return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

function drawHexagon(x, y, size, terrain, selected = false) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle_deg = 60 * i - 30;
        const angle_rad = Math.PI / 180 * angle_deg;
        const xPos = x + size * Math.cos(angle_rad);
        const yPos = y + size * Math.sin(angle_rad);

        if (i === 0) ctx.moveTo(xPos, yPos);
        else ctx.lineTo(xPos, yPos);
    }
    ctx.closePath();

    const hasCustomImage = state.terrainImages[terrain] && state.loadedImages[terrain];

    if (state.layers.terrain) {
        if (hasCustomImage) {
            ctx.save();
            ctx.clip();

            const img = state.loadedImages[terrain];
            const imgSize = size * 2;
            ctx.drawImage(img, x - imgSize / 2, y - imgSize / 2, imgSize, imgSize);

            ctx.restore();
        } else {
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
            const color = terrains[terrain].color;
            gradient.addColorStop(0, lightenColor(color, 25));
            gradient.addColorStop(0.7, color);
            gradient.addColorStop(1, darkenColor(color, 15));
            ctx.fillStyle = gradient;
            ctx.fill();
        }
    }

    if (state.layers.grid) {
        ctx.strokeStyle = selected ? '#FFD700' : 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = selected ? 3 : 2;
        ctx.stroke();
    }

    if (state.layers.terrain && !hasCustomImage) {
        ctx.font = `${size * 0.6}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillText(terrains[terrain].symbol, x, y);

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }
}

function lightenColor(color, percent) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min((num >> 16) + amt, 255);
    const G = Math.min((num >> 8 & 0x00FF) + amt, 255);
    const B = Math.min((num & 0x0000FF) + amt, 255);
    return "#" + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

function drawMap() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(state.offsetX, state.offsetY);
    ctx.scale(state.scale, state.scale);

    const size = state.hexSize;
    const width = size * Math.sqrt(3);
    const height = size * 2;
    const vertDist = size * 1.5;
    const horizOffset = width / 2;

    const totalWidth = state.mapWidth * width;
    const totalHeight = state.mapHeight * vertDist + size * 0.5;
    const startX = canvas.width / (2 * state.scale) - totalWidth / 2;
    const startY = canvas.height / (2 * state.scale) - totalHeight / 2;

    for (let row = 0; row < state.mapHeight; row++) {
        for (let col = 0; col < state.mapWidth; col++) {
            const xOffset = (row % 2) * horizOffset;
            const x = startX + col * width + xOffset;
            const y = startY + row * vertDist;

            const isSelected = state.selectedHex &&
                state.selectedHex.row === row &&
                state.selectedHex.col === col;

            drawHexagon(x, y, size, state.hexMap[row][col], isSelected);

            if (state.layers.annotations) {
                const key = `${row},${col}`;
                if (state.annotations[key]) {
                    ctx.font = `${size * 0.5}px Arial`;
                    ctx.fillStyle = '#FFD700';
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                    ctx.shadowBlur = 5;
                    ctx.fillText('📌', x, y - size * 0.6);
                    ctx.shadowColor = 'transparent';
                    ctx.shadowBlur = 0;
                }
            }
        }
    }

    ctx.restore();

    if (state.isViewMode && state.measurementStart) {
        drawMeasurementLine();
    }
}

function drawMinimap() {
    minimapCtx.clearRect(0, 0, minimap.width, minimap.height);

    const cellWidth = minimap.width / state.mapWidth;
    const cellHeight = minimap.height / state.mapHeight;

    for (let row = 0; row < state.mapHeight; row++) {
        for (let col = 0; col < state.mapWidth; col++) {
            const terrain = state.hexMap[row][col];
            minimapCtx.fillStyle = terrains[terrain].color;
            minimapCtx.fillRect(col * cellWidth, row * cellHeight, cellWidth, cellHeight);
        }
    }

    minimapCtx.strokeStyle = '#FFD700';
    minimapCtx.lineWidth = 3;
    minimapCtx.strokeRect(0, 0, minimap.width, minimap.height);
}

function getHexFromPoint(mouseX, mouseY) {
    const size = state.hexSize;
    const width = size * Math.sqrt(3);
    const vertDist = size * 1.5;
    const horizOffset = width / 2;

    const x = (mouseX - state.offsetX) / state.scale;
    const y = (mouseY - state.offsetY) / state.scale;

    const totalWidth = state.mapWidth * width;
    const totalHeight = state.mapHeight * vertDist + size * 0.5;
    const startX = canvas.width / (2 * state.scale) - totalWidth / 2;
    const startY = canvas.height / (2 * state.scale) - totalHeight / 2;

    let closest = null;
    let minDist = Infinity;

    for (let row = 0; row < state.mapHeight; row++) {
        for (let col = 0; col < state.mapWidth; col++) {
            const xOffset = (row % 2) * horizOffset;
            const hexX = startX + col * width + xOffset;
            const hexY = startY + row * vertDist;

            const dist = Math.sqrt((x - hexX) ** 2 + (y - hexY) ** 2);
            if (dist < size && dist < minDist) {
                closest = { row, col };
                minDist = dist;
            }
        }
    }

    return closest;
}

function handleClick(e) {
    if (state.isDragging) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const hex = getHexFromPoint(mouseX, mouseY);
    if (hex) {
        state.selectedHex = hex;

        if (state.isViewMode) {
            if (!state.measurementStart) {
                state.measurementStart = hex;
                state.measurementEnd = null;
            } else if (!state.measurementEnd) {
                state.measurementEnd = hex;
                calculateDistance();
            } else {
                state.measurementStart = hex;
                state.measurementEnd = null;
            }
            updateHexInfo(hex);
            drawMap();
            document.getElementById('selectedHex').textContent = `[${hex.row}, ${hex.col}]`;
            return;
        }

        if (state.currentTerrain === 'cursor') {
            updateHexInfo(hex);
            drawMap();
            document.getElementById('selectedHex').textContent = `[${hex.row}, ${hex.col}]`;
            return;
        }

        saveState();

        if (state.editMode === 'paint') {
            paintHex(hex.row, hex.col);
        } else if (state.editMode === 'annotate') {
            showAnnotationModal(hex);
        } else if (state.editMode === 'erase') {
            eraseHex(hex.row, hex.col);
        }

        updateHexInfo(hex);
        drawMap();
        document.getElementById('selectedHex').textContent = `[${hex.row}, ${hex.col}]`;
    }
}

function paintHex(row, col) {
    const radius = state.brushSize;
    for (let r = -radius + 1; r < radius; r++) {
        for (let c = -radius + 1; c < radius; c++) {
            const newRow = row + r;
            const newCol = col + c;
            if (newRow >= 0 && newRow < state.mapHeight &&
                newCol >= 0 && newCol < state.mapWidth) {
                state.hexMap[newRow][newCol] = state.currentTerrain;
            }
        }
    }
    drawMinimap();
}

function eraseHex(row, col) {
    state.hexMap[row][col] = 'grass';
    const key = `${row},${col}`;
    delete state.annotations[key];
    updateAnnotationList();
    updateStats();
    drawMinimap();
}

function showAnnotationModal(hex) {
    document.getElementById('annotationModal').style.display = 'flex';
    state.pendingAnnotation = hex;
}

function saveAnnotation() {
    const title = document.getElementById('annotationTitle').value;
    const text = document.getElementById('annotationText').value;
    const type = document.getElementById('annotationType').value;

    if (title || text) {
        saveState();

        const key = `${state.pendingAnnotation.row},${state.pendingAnnotation.col}`;
        state.annotations[key] = { title, text, type };
        updateAnnotationList();
        updateStats();
        drawMap();
    }

    closeModal('annotationModal');
    document.getElementById('annotationTitle').value = '';
    document.getElementById('annotationText').value = '';
}

function saveState() {
    if (state.historyIndex < state.history.length - 1) {
        state.history = state.history.slice(0, state.historyIndex + 1);
    }

    const currentState = {
        hexMap: JSON.parse(JSON.stringify(state.hexMap)),
        annotations: JSON.parse(JSON.stringify(state.annotations))
    };

    state.history.push(currentState);

    if (state.history.length > state.maxHistory) {
        state.history.shift();
    } else {
        state.historyIndex++;
    }

    updateUndoRedoButtons();
}

function undo() {
    if (state.historyIndex > 0) {
        state.historyIndex--;
        const previousState = state.history[state.historyIndex];
        state.hexMap = JSON.parse(JSON.stringify(previousState.hexMap));
        state.annotations = JSON.parse(JSON.stringify(previousState.annotations));

        drawMap();
        drawMinimap();
        updateStats();
        updateAnnotationList();
        updateUndoRedoButtons();
    }
}

function redo() {
    if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        const nextState = state.history[state.historyIndex];
        state.hexMap = JSON.parse(JSON.stringify(nextState.hexMap));
        state.annotations = JSON.parse(JSON.stringify(nextState.annotations));

        drawMap();
        drawMinimap();
        updateStats();
        updateAnnotationList();
        updateUndoRedoButtons();
    }
}

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');

    if (undoBtn) {
        if (state.historyIndex > 0) {
            undoBtn.style.opacity = '1';
            undoBtn.style.cursor = 'pointer';
            undoBtn.disabled = false;
        } else {
            undoBtn.style.opacity = '0.5';
            undoBtn.style.cursor = 'not-allowed';
            undoBtn.disabled = true;
        }
    }

    if (redoBtn) {
        if (state.historyIndex < state.history.length - 1) {
            redoBtn.style.opacity = '1';
            redoBtn.style.cursor = 'pointer';
            redoBtn.disabled = false;
        } else {
            redoBtn.style.opacity = '0.5';
            redoBtn.style.cursor = 'not-allowed';
            redoBtn.disabled = true;
        }
    }
}

function updateHexInfo(hex) {
    const terrain = state.hexMap[hex.row][hex.col];
    const key = `${hex.row},${hex.col}`;
    const annotation = state.annotations[key];

    let html = `
        <div><strong>Posição:</strong> [${hex.row}, ${hex.col}]</div>
        <div><strong>Terreno:</strong> ${terrains[terrain].symbol} ${terrains[terrain].name}</div>
    `;

    if (annotation) {
        html += `
            <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.2);">
                <strong>📌 ${annotation.title || 'Sem título'}</strong>
                <div style="margin-top: 5px; font-size: 12px;">${annotation.text || ''}</div>
            </div>
        `;
    }

    document.getElementById('hexInfo').innerHTML = html;
}

function updateAnnotationList() {
    const list = document.getElementById('annotationList');
    const annotations = Object.entries(state.annotations);

    if (annotations.length === 0) {
        list.innerHTML = '<p style="color: #888; text-align: center; font-size: 12px;">Nenhuma anotação</p>';
        return;
    }

    list.innerHTML = annotations.slice(-5).reverse().map(([key, ann]) => {
        const [row, col] = key.split(',');
        return `
            <div class="annotation-item">
                <strong>${ann.title || 'Sem título'}</strong>
                <div style="font-size: 11px; color: var(--lr-text-2); margin-top: 5px;">[${row}, ${col}]</div>
            </div>
        `;
    }).join('');
}

function updateStats() {
    document.getElementById('statTotal').textContent = state.mapWidth * state.mapHeight;
    document.getElementById('statAnnotations').textContent = Object.keys(state.annotations).length;
}

function startDrag(e) {
    state.isDragging = false;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
}

function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const hex = getHexFromPoint(e.clientX - rect.left, e.clientY - rect.top);

    if (hex) {
        document.getElementById('mouseCoords').textContent = `Mouse: [${hex.row}, ${hex.col}]`;
    }

    if (e.buttons !== 1) return;

    const deltaX = e.clientX - state.lastX;
    const deltaY = e.clientY - state.lastY;

    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        state.isDragging = true;
        state.offsetX += deltaX;
        state.offsetY += deltaY;
        drawMap();
    }

    state.lastX = e.clientX;
    state.lastY = e.clientY;
}

function endDrag() {
    setTimeout(() => state.isDragging = false, 100);
}

function handleWheel(e) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.3, Math.min(4, state.scale * delta));

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    state.offsetX = mouseX - (mouseX - state.offsetX) * (newScale / state.scale);
    state.offsetY = mouseY - (mouseY - state.offsetY) * (newScale / state.scale);

    state.scale = newScale;
    drawMap();
    updateZoomLevel();
}

function zoomIn() {
    state.scale = Math.min(4, state.scale * 1.2);
    drawMap();
    updateZoomLevel();
}

function zoomOut() {
    state.scale = Math.max(0.3, state.scale / 1.2);
    drawMap();
    updateZoomLevel();
}

function resetView() {
    state.scale = 1;
    state.offsetX = 0;
    state.offsetY = 0;
    drawMap();
    updateZoomLevel();
}

function updateZoomLevel() {
    document.getElementById('zoomLevel').textContent = Math.round(state.scale * 100) + '%';
}

function updateMapDimensions() {
    document.getElementById('mapDimensions').textContent = `${state.mapWidth}x${state.mapHeight}`;
}

function changeEditMode() {
    state.editMode = document.getElementById('editMode').value;
}

function updateBrushSize() {
    state.brushSize = parseInt(document.getElementById('brushSize').value);
    document.getElementById('brushSizeDisplay').textContent = state.brushSize;
}

function toggleLayer(layer) {
    state.layers[layer] = !state.layers[layer];
    document.getElementById(layer + 'Toggle').classList.toggle('active');
    drawMap();
}

function showNewMapDialog() {
    document.getElementById('newMapModal').style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function createNewMap() {
    const mapName = document.getElementById('newMapName')?.value || 'Novo Mapa';
    state.mapWidth = parseInt(document.getElementById('newMapWidth').value);
    state.mapHeight = parseInt(document.getElementById('newMapHeight').value);

    // Atualizar nome do mapa no Firebase
    if (window.setMapName) {
        window.setMapName(mapName);
    }

    initializeMap();
    drawMap();
    drawMinimap();
    updateStats();
    closeModal('newMapModal');

    if (window.showAlert) {
        window.showAlert(`✅ Novo mapa "${mapName}" criado!`, 'success');
    }
}

function clearMap() {
    if (confirm('Tem certeza que deseja limpar todo o mapa?')) {
        saveState();
        initializeMap();
        drawMap();
        drawMinimap();
        updateStats();
        updateAnnotationList();
    }
}

function generateRandom() {
    saveState();
    const terrainKeys = Object.keys(terrains).filter(t => t !== 'cursor');
    for (let row = 0; row < state.mapHeight; row++) {
        for (let col = 0; col < state.mapWidth; col++) {
            const rand = Math.random();
            if (rand < 0.3) state.hexMap[row][col] = 'grass';
            else if (rand < 0.5) state.hexMap[row][col] = 'forest';
            else if (rand < 0.6) state.hexMap[row][col] = 'mountain';
            else if (rand < 0.75) state.hexMap[row][col] = 'water';
            else if (rand < 0.85) state.hexMap[row][col] = 'desert';
            else state.hexMap[row][col] = terrainKeys[Math.floor(Math.random() * terrainKeys.length)];
        }
    }
    drawMap();
    drawMinimap();
}

// Salvar no Firebase
function saveProject() {
    if (window.saveProjectToFirebase) {
        window.saveProjectToFirebase({
            mapWidth: state.mapWidth,
            mapHeight: state.mapHeight,
            hexMap: state.hexMap,
            annotations: state.annotations,
            terrainImages: state.terrainImages // Incluir imagens de terreno
        });
    } else {
        // Fallback para localStorage se Firebase não disponível
        const project = {
            mapWidth: state.mapWidth,
            mapHeight: state.mapHeight,
            hexMap: state.hexMap,
            annotations: state.annotations,
            version: '1.0',
            timestamp: new Date().toISOString()
        };
        localStorage.setItem('lendasHexmap', JSON.stringify(project));
        if (window.showAlert) {
            window.showAlert('✅ Projeto salvo localmente!', 'success');
        } else {
            alert('✅ Projeto salvo localmente!');
        }
    }
}

// Carregar dados de mapa (chamado pelo Firebase)
window.loadMapData = function (data) {
    state.mapWidth = data.mapWidth;
    state.mapHeight = data.mapHeight;
    state.hexMap = data.hexMap;
    state.annotations = data.annotations || {};

    // Carregar imagens de terreno do mapa
    state.terrainImages = data.terrainImages || {};
    state.loadedImages = {};

    // Recriar os objetos Image para cada terreno com imagem
    Object.keys(state.terrainImages).forEach(key => {
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Permite CORS para imagens do Firebase Storage
        img.onload = function () {
            state.loadedImages[key] = img;
            drawMap();
            drawMinimap();
            createTerrainGrid();
        };
        img.src = state.terrainImages[key];
    });


    state.history = [{
        hexMap: JSON.parse(JSON.stringify(state.hexMap)),
        annotations: JSON.parse(JSON.stringify(state.annotations))
    }];
    state.historyIndex = 0;

    updateMapDimensions();
    updateStats();
    updateAnnotationList();
    drawMap();
    drawMinimap();
    createTerrainGrid();
    updateUndoRedoButtons();
};

function exportToJSON() {


    const project = {
        mapWidth: state.mapWidth,
        mapHeight: state.mapHeight,
        hexMap: state.hexMap,
        annotations: state.annotations,
        terrains: terrains,
        version: '1.0',
        timestamp: new Date().toISOString()
    };
    const dataStr = JSON.stringify(project, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportName = `lendas-hexmap_${new Date().getTime()}.json`;
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', exportName);
    link.click();
}

function importFromJSON() {
    document.getElementById('jsonFileInput').click();
}

function handleJSONImport(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const project = JSON.parse(e.target.result);
                state.mapWidth = project.mapWidth;
                state.mapHeight = project.mapHeight;
                state.hexMap = project.hexMap;
                state.annotations = project.annotations || {};

                state.history = [{
                    hexMap: JSON.parse(JSON.stringify(state.hexMap)),
                    annotations: JSON.parse(JSON.stringify(state.annotations))
                }];
                state.historyIndex = 0;

                updateMapDimensions();
                updateStats();
                updateAnnotationList();
                drawMap();
                drawMinimap();
                updateUndoRedoButtons();
                alert('✅ Mapa importado com sucesso!');
            } catch (error) {
                alert('❌ Erro ao importar arquivo JSON!');
            }
        };
        reader.readAsText(file);
    }
}

function toggleViewMode() {
    state.isViewMode = !state.isViewMode;
    const container = document.querySelector('.app-container');
    const btn = document.getElementById('viewModeBtn');
    const icon = document.getElementById('viewModeIcon');
    const text = document.getElementById('viewModeText');
    const measurementConfig = document.getElementById('measurementConfigSection');

    if (state.isViewMode) {
        container.classList.add('view-mode');
        icon.textContent = '✏️';
        text.textContent = 'Modo Edição';
        btn.style.background = 'rgba(255,215,0,0.3)';
        measurementConfig.style.display = 'block';
        document.getElementById('measurementPanel').classList.add('active');
        state.currentTerrain = 'cursor';
        createTerrainGrid();
    } else {
        container.classList.remove('view-mode');
        icon.textContent = '👁️';
        text.textContent = 'Modo Exibição';
        btn.style.background = 'rgba(255,255,255,0.2)';
        measurementConfig.style.display = 'none';
        document.getElementById('measurementPanel').classList.remove('active');
        clearMeasurement();
    }
}

function toggleFullscreen() {
    state.isFullscreen = !state.isFullscreen;
    const container = document.querySelector('.app-container');
    const btn = document.getElementById('fullscreenBtn');

    if (state.isFullscreen) {
        container.classList.add('fullscreen');
        btn.textContent = '📐 Normal';
        btn.style.background = 'rgba(255,215,0,0.3)';
    } else {
        container.classList.remove('fullscreen');
        btn.textContent = '🖥️ Maximizar';
        btn.style.background = 'rgba(255,255,255,0.2)';
    }

    setTimeout(() => {
        resizeCanvas();
        drawMap();
    }, 100);
}

function updateMeasurementConfig() {
    state.kmPerHex = parseFloat(document.getElementById('kmPerHexInput').value) || 10;
    state.hoursPerHex = parseFloat(document.getElementById('hoursPerHexInput').value) || 3;

    if (state.measurementStart && state.measurementEnd) {
        calculateDistance();
    }
}

function calculateDistance() {
    if (!state.measurementStart || !state.measurementEnd) return;

    const start = state.measurementStart;
    const end = state.measurementEnd;

    const dx = end.col - start.col;
    const dy = end.row - start.row;
    const dz = -dx - dy;

    const adjustedDx = dx - (end.row - start.row + (end.row & 1) - (start.row & 1)) / 2;

    const hexDistance = Math.max(
        Math.abs(adjustedDx),
        Math.abs(dy),
        Math.abs(adjustedDx + dy)
    );

    const km = hexDistance * state.kmPerHex;
    const hours = hexDistance * state.hoursPerHex;
    const days = Math.floor(hours / 8);
    const remainingHours = hours % 8;

    document.getElementById('measurementDistance').textContent = `${km} km (${hexDistance} hexs)`;

    let timeText = '';
    if (days > 0) {
        timeText = `${days} ${days === 1 ? 'dia' : 'dias'}`;
        if (remainingHours > 0) {
            timeText += ` ${Math.round(remainingHours)}h`;
        }
    } else {
        timeText = `${Math.round(hours)} horas`;
    }
    document.getElementById('measurementTime').textContent = timeText;
}

function clearMeasurement() {
    state.measurementStart = null;
    state.measurementEnd = null;
    state.isMeasuring = false;
    drawMap();
}

function drawMeasurementLine() {
    if (!state.measurementStart || !state.isViewMode) return;

    const size = state.hexSize;
    const width = size * Math.sqrt(3);
    const vertDist = size * 1.5;
    const horizOffset = width / 2;

    const totalWidth = state.mapWidth * width;
    const totalHeight = state.mapHeight * vertDist + size * 0.5;
    const startX = canvas.width / (2 * state.scale) - totalWidth / 2;
    const startY = canvas.height / (2 * state.scale) - totalHeight / 2;

    const startHex = state.measurementStart;
    const xOffsetStart = (startHex.row % 2) * horizOffset;
    const x1 = startX + startHex.col * width + xOffsetStart;
    const y1 = startY + startHex.row * vertDist;

    ctx.save();

    if (state.measurementEnd) {
        const endHex = state.measurementEnd;
        const xOffsetEnd = (endHex.row % 2) * horizOffset;
        const x2 = startX + endHex.col * width + xOffsetEnd;
        const y2 = startY + endHex.row * vertDist;

        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 5]);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#00FF00';
        ctx.beginPath();
        ctx.arc(x1, y1, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FF0000';
        ctx.beginPath();
        ctx.arc(x2, y2, 8, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.fillStyle = '#00FF00';
        ctx.beginPath();
        ctx.arc(x1, y1, 8, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();
}

function navigateWithArrows(key) {
    if (!state.selectedHex) return;

    const { row, col } = state.selectedHex;
    let newRow = row;
    let newCol = col;

    const isOddRow = row % 2 === 1;

    switch (key) {
        case 'ArrowUp':
            newRow = row - 1;
            break;
        case 'ArrowDown':
            newRow = row + 1;
            break;
        case 'ArrowLeft':
            newCol = col - 1;
            break;
        case 'ArrowRight':
            newCol = col + 1;
            break;
    }

    if (newRow >= 0 && newRow < state.mapHeight &&
        newCol >= 0 && newCol < state.mapWidth) {
        state.selectedHex = { row: newRow, col: newCol };
        updateHexInfo(state.selectedHex);
        drawMap();
        document.getElementById('selectedHex').textContent = `[${newRow}, ${newCol}]`;
    }
}

function openTerrainEditor() {
    const modal = document.getElementById('terrainEditorModal');
    const list = document.getElementById('terrainEditorList');
    list.innerHTML = '';

    Object.keys(terrains).forEach(key => {
        if (key === 'cursor') return;

        const terrain = terrains[key];
        const hasImage = state.terrainImages[key];

        const item = document.createElement('div');
        item.style.cssText = `
            background:var(--lr-bg-1);
            padding: 15px;
            margin: 10px 0;
            border-radius: 10px;
            border-left: 4px solid ${terrain.color};
            display: flex;
            align-items: center;
            gap: 15px;
        `;

        item.innerHTML = `
            <div style="font-size: 32px; min-width: 50px; text-align: center;">
                ${hasImage ? '🖼️' : terrain.symbol}
            </div>
            <div style="flex: 1;">
                <div style="font-weight: 700; margin-bottom: 5px;">${terrain.name}</div>
                <div style="font-size: 11px; color: var(--lr-text-2);">
                    ${hasImage ? '✓ Imagem personalizada carregada' : 'Usando cor e emoji padrão'}
                </div>
            </div>
            <div style="display: flex; gap: 10px;">
                <button onclick="selectTerrainImage('${key}')" 
                    style="padding: 8px 16px; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: 600;">
                    ${hasImage ? '📝 Trocar' : '📤 Upload'}
                </button>
                ${hasImage ? `
                <button onclick="removeTerrainImage('${key}')" 
                    style="padding: 8px 16px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: 600;">
                    🗑️
                </button>
                ` : ''}
            </div>
        `;

        list.appendChild(item);
    });

    modal.style.display = 'flex';
}

function selectTerrainImage(terrainKey) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => handleTerrainImageUpload(e, terrainKey);
    input.click();
}

function handleTerrainImageUpload(event, terrainKey) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('❌ Por favor, selecione um arquivo de imagem!');
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        const imageData = e.target.result;

        state.terrainImages[terrainKey] = imageData;

        const img = new Image();
        img.onload = function () {
            state.loadedImages[terrainKey] = img;

            saveTerrainImagesToStorage();

            drawMap();
            drawMinimap();
            createTerrainGrid();
            openTerrainEditor();

            alert('✅ Imagem carregada com sucesso!');
        };
        img.src = imageData;
    };
    reader.readAsDataURL(file);
}

function removeTerrainImage(terrainKey) {
    if (confirm(`Remover imagem personalizada de ${terrains[terrainKey].name}?\\n\\n⚠️ Lembre-se de SALVAR o mapa depois!`)) {
        delete state.terrainImages[terrainKey];
        delete state.loadedImages[terrainKey];

        drawMap();
        drawMinimap();
        createTerrainGrid();
        openTerrainEditor();

        if (window.showAlert) {
            window.showAlert('✅ Imagem removida! Clique em SALVAR para confirmar.', 'warning');
        } else {
            alert('✅ Imagem removida! Clique em SALVAR para confirmar.');
        }
    }
}

function clearAllTerrainImages() {
    if (confirm('Remover TODAS as imagens personalizadas?\\n\\n⚠️ Lembre-se de SALVAR o mapa depois!')) {
        state.terrainImages = {};
        state.loadedImages = {};

        drawMap();
        drawMinimap();
        createTerrainGrid();
        closeModal('terrainEditorModal');

        if (window.showAlert) {
            window.showAlert('✅ Imagens removidas! Clique em SALVAR para confirmar.', 'warning');
        } else {
            alert('✅ Imagens removidas! Clique em SALVAR para confirmar.');
        }
    }
}

// As imagens de terreno agora são salvas junto com o mapa no Firebase
// Não usamos mais localStorage para evitar limite de espaço
function saveTerrainImagesToStorage() {
    // Mostrar lembrete para salvar o mapa
    if (window.showAlert) {
        window.showAlert('🖼️ Imagem definida! Clique em SALVAR para guardar no servidor.', 'success');
    }
    console.log('[Terrain] Imagem adicionada. Total:', Object.keys(state.terrainImages).length);
}

function loadTerrainImagesFromStorage() {
    // As imagens agora são carregadas junto com o mapa via loadMapData
    // Tentar migrar dados antigos do localStorage se existirem
    try {
        const saved = localStorage.getItem('lendasHexmap_terrainImages');
        if (saved) {
            const oldImages = JSON.parse(saved);
            if (Object.keys(oldImages).length > 0) {
                console.log('[Terrain] Migrando imagens do localStorage para o mapa atual...');
                state.terrainImages = oldImages;

                // Carregar as imagens
                Object.keys(state.terrainImages).forEach(key => {
                    const img = new Image();
                    img.onload = function () {
                        state.loadedImages[key] = img;
                        drawMap();
                        drawMinimap();
                        createTerrainGrid();
                    };
                    img.src = state.terrainImages[key];
                });

                // Limpar localStorage antigo para liberar espaço
                localStorage.removeItem('lendasHexmap_terrainImages');

                if (window.showAlert) {
                    window.showAlert('📦 Imagens migradas do cache local. Salve o mapa para manter!', 'warning');
                }
            }
        }
    } catch (e) {
        console.log('[Terrain] Nenhum dado antigo no localStorage');
    }
}

// Nota: init() é chamado pelo HTML após autenticação via window.initHexmap()
