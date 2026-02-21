/* ===== CLASS TESTS — Renderização e Cálculo de Testes Principais ===== */

/* Mapa de atributos para chaves de dots */
const ATTR_MAP = {
    'FOR': 'attr_for', 'DES': 'attr_des', 'VIG': 'attr_vig',
    'INT': 'attr_int', 'RAC': 'attr_rac', 'PRS': 'attr_prs',
    'PRE': 'attr_pre', 'MAN': 'attr_man', 'AUT': 'attr_aut'
};

const COLOR_OPTIONS = [
    { name: 'gray', label: 'Padrão', hex: '#e5e7eb' },
    { name: 'red', label: 'Vermelho', hex: '#fecaca' },
    { name: 'green', label: 'Verde', hex: '#bbf7d0' },
    { name: 'blue', label: 'Azul', hex: '#bfdbfe' },
    { name: 'yellow', label: 'Amarelo', hex: '#fef08a' },
    { name: 'purple', label: 'Roxo', hex: '#e9d5ff' },
    { name: 'orange', label: 'Laranja', hex: '#fed7aa' }
];

let globalColorMode = false;

/* Resolver: converte um token (nome de atributo, perícia ou classe) em valor numérico */
function resolveTestPart(token, currentClass) {
    if (token.includes('|')) {
        return Math.max(...token.split('|').map(p => resolveTestPart(p.trim(), currentClass)));
    }
    // Atributo?
    if (ATTR_MAP[token]) return state.dots[ATTR_MAP[token]] || 0;
    // Valor derivado? (@id do elemento)
    if (token.startsWith('@')) {
        const el = document.getElementById(token.substring(1));
        return parseInt(el ? el.value : '0', 10) || 0;
    }
    // Perícia regular?
    const skillCategories = [
        { list: SKILLS.mental, prefix: 'sk_mental_' },
        { list: SKILLS.fisico, prefix: 'sk_fisico_' },
        { list: SKILLS.social, prefix: 'sk_social_' },
        { list: SKILLS.combate, prefix: 'sk_combate_' },
    ];
    for (const { list, prefix } of skillCategories) {
        const found = list.find(s => s.name === token);
        if (found) return state.dots[prefix + found.key] || 0;
    }
    // Perícia de classe?
    if (currentClass && CLASS_SKILLS[currentClass]) {
        if (CLASS_SKILLS[currentClass].includes(token)) {
            const key = 'sk_classe_' + token.toLowerCase().replace(/[^a-z0-9]/g, '_');
            return state.dots[key] || 0;
        }
    }
    return 0;
}

function calcTestTotal(parts, currentClass) {
    if (!parts || parts.length === 0) return 0;
    return parts.reduce((sum, token) => sum + resolveTestPart(token, currentClass), 0);
}

/* Renderizar TODOS os testes (Classe + Customizados) no container único */
function renderMainTests(classeKey) {
    const container = document.getElementById('mainTestsContainer');
    if (!container) return;

    container.innerHTML = '';

    // 1. Identificar testes de classe ativos
    let activeTests = [];
    if (classeKey && CLASS_TESTS[classeKey]) {
        CLASS_TESTS[classeKey].testes.forEach((t, i) => {
            activeTests.push({
                type: 'class',
                id: `class_${classeKey}_${i}`,
                name: t.nome,
                formula: t.formula,
                parts: t.parts,
                idx: i,
                quando: t.quando
            });
        });
    }

    // 2. Identificar testes customizados ativos
    if (state.customTests) {
        state.customTests.forEach((t, i) => {
            activeTests.push({
                type: 'custom',
                id: t.id,
                name: t.name,
                formula: t.formula,
                parts: null, // Custom implementation might vary, for now just formula string
                idx: i,
                isCustom: true
            });
        });
    }

    // 3. Ordenar
    let orderedTests = [];
    let usedIds = new Set();

    // Primeiro, adicionar na ordem salva
    if (state.mainTestsOrder && state.mainTestsOrder.length > 0) {
        state.mainTestsOrder.forEach(savedId => {
            const found = activeTests.find(t => t.id === savedId);
            if (found) {
                orderedTests.push(found);
                usedIds.add(savedId);
            }
        });
    }

    // Depois, adicionar quaisquer novos (que não estavam na ordem salva)
    activeTests.forEach(t => {
        if (!usedIds.has(t.id)) {
            orderedTests.push(t);
        }
    });

    // 4. Renderizar
    orderedTests.forEach(t => {
        const row = document.createElement('div');
        row.className = 'test-row';
        if (t.type === 'class') row.classList.add('class-test-row');
        row.draggable = true;
        row.dataset.id = t.id;
        row.dataset.type = t.type;

        // Apply saved color
        if (state.testColors && state.testColors[t.id]) {
            row.classList.add('bg-' + state.testColors[t.id]);
        }

        // Show color trigger if global mode is active
        // Logic handled by button creation below

        // Color Trigger Button (Flex)
        const colorBtn = document.createElement('button');
        colorBtn.className = 'test-color-trigger no-print';
        colorBtn.textContent = '🎨';
        colorBtn.title = 'Mudar cor';
        colorBtn.style.display = globalColorMode ? 'flex' : 'none';

        // Prevent Drag on the button from triggering row drag
        colorBtn.draggable = false;
        colorBtn.onmousedown = (e) => e.stopPropagation();

        colorBtn.onclick = (e) => {
            console.log('Color button clicked via handler');
            e.stopPropagation();
            e.preventDefault();
            showColorPicker(e, t.id);
        };
        row.appendChild(colorBtn);

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = t.name;
        nameInput.placeholder = 'Nome do Teste';
        nameInput.className = t.type === 'class' ? 'class-test-field' : '';
        nameInput.style.flex = "1"; // Flex scaling
        if (t.type === 'class') {
            nameInput.readOnly = true;
            nameInput.title = t.quando || '';
        } else {
            nameInput.dataset.key = `test_name_${t.id}`;
            nameInput.addEventListener('input', (e) => {
                const testObj = state.customTests.find(ct => ct.id === t.id);
                if (testObj) { testObj.name = e.target.value; scheduleAutosave(); }
            });
        }

        const formulaInput = document.createElement('input');
        formulaInput.type = 'text';
        formulaInput.value = t.formula;
        formulaInput.placeholder = 'Fórmula';
        formulaInput.className = t.type === 'class' ? 'class-test-field' : '';
        formulaInput.style.flex = "1"; // Flex scaling
        if (t.type === 'class') {
            formulaInput.readOnly = true;
            formulaInput.title = t.quando || '';
        } else {
            formulaInput.dataset.key = `test_formula_${t.id}`;
            formulaInput.addEventListener('input', (e) => {
                const testObj = state.customTests.find(ct => ct.id === t.id);
                if (testObj) { testObj.formula = e.target.value; scheduleAutosave(); }
            });
        }

        const totalInput = document.createElement('input');
        totalInput.type = 'text';
        totalInput.className = 'test-total-field';
        totalInput.style.width = "60px"; // Fixed width
        totalInput.style.textAlign = "center";

        if (t.type === 'class') {
            totalInput.value = calcTestTotal(t.parts, classeKey);
            totalInput.dataset.classTestIdx = t.idx; // Para recálculo
        } else {
            const testObj = state.customTests.find(ct => ct.id === t.id);
            totalInput.value = testObj ? (testObj.total || '') : '';
            totalInput.dataset.key = `test_total_${t.id}`;
            totalInput.addEventListener('input', (e) => {
                const testObj = state.customTests.find(ct => ct.id === t.id);
                if (testObj) { testObj.total = e.target.value; scheduleAutosave(); }
            });
        }

        row.appendChild(nameInput);
        row.appendChild(formulaInput);
        row.appendChild(totalInput);

        // Remove button for custom tests
        if (t.type === 'custom') {
            const rmBtn = document.createElement('button');
            rmBtn.className = 'rm-btn no-print';
            rmBtn.textContent = '✕';
            rmBtn.style.marginLeft = '4px';
            rmBtn.onclick = () => {
                state.customTests = state.customTests.filter(ct => ct.id !== t.id);
                // Also remove color data
                if (state.testColors && state.testColors[t.id]) {
                    delete state.testColors[t.id];
                }
                row.remove();
                saveOrder();
                scheduleAutosave();
            };
            row.appendChild(rmBtn);
        }

        container.appendChild(row);
    });

    // Initialize Drag and Drop on the container (idempotent usually, but good to call)
    if (typeof initDragAndDrop === 'function') {
        initDragAndDrop('mainTestsContainer', () => {
            saveOrder();
            scheduleAutosave();
        });
    }
}

function saveOrder() {
    const ids = getContainerOrder('mainTestsContainer');
    state.mainTestsOrder = ids;
}

/* Recalcular apenas os totais dos testes de classe (sem re-renderizar) */
function recalcMainTests() {
    const classeEl = document.getElementById('selClasse');
    if (!classeEl) return;
    const cl = classeEl.value;

    // Só podemos recalcular os de classe de forma automática por enquanto
    if (!cl || !CLASS_TESTS[cl]) return;

    const container = document.getElementById('mainTestsContainer');
    if (!container) return;

    CLASS_TESTS[cl].testes.forEach((teste, idx) => {
        // Encontrar o input que corresponde a este índice de teste de classe
        // A estrutura mudou, mas salvamos data-class-test-idx
        const totalEl = container.querySelector(`input[data-class-test-idx="${idx}"]`);
        if (totalEl) {
            totalEl.value = calcTestTotal(teste.parts, cl);
        }
    });
}

/* ===== COLOR CUSTOMIZATION FUNCTIONS ===== */

function toggleGlobalColorMode() {
    globalColorMode = !globalColorMode;
    const btn = document.getElementById('btnToggleColorMode');
    if (btn) btn.style.background = globalColorMode ? 'rgba(139, 92, 246, 0.2)' : 'none'; // Visual feedback

    document.querySelectorAll('.test-row').forEach(row => {
        const trigger = row.querySelector('.test-color-trigger');
        if (trigger) {
            trigger.style.display = globalColorMode ? 'flex' : 'none';
        }
    });
}

function showColorPicker(event, testId) {
    console.log('showColorPicker called for', testId);
    event.stopPropagation();
    event.preventDefault();

    // Remove existing popovers
    document.querySelectorAll('.color-picker-popover').forEach(el => el.remove());

    const triggerBtn = event.currentTarget || event.target.closest('.test-color-trigger');
    const rect = triggerBtn.getBoundingClientRect();

    const popover = document.createElement('div');
    popover.className = 'color-picker-popover';

    // Position fixed logic to ensure it's always visible regardless of parent overflow
    popover.style.position = 'fixed'; // Use fixed to ignore parent scroll/stacking
    popover.style.left = (rect.right + 10) + 'px';
    popover.style.top = (rect.top + (rect.height / 2)) + 'px';
    popover.style.transform = 'translateY(-50%)';
    popover.style.zIndex = '999999'; // Super high z-index

    COLOR_OPTIONS.forEach(opt => {
        const circle = document.createElement('div');
        circle.className = 'color-option';
        circle.style.backgroundColor = opt.hex;
        circle.title = opt.label;
        circle.onclick = (e) => {
            console.log('Color selected:', opt.name);
            e.stopPropagation();
            e.preventDefault();
            applyTestColor(testId, opt.name);
            popover.remove();
        };
        popover.appendChild(circle);
    });

    // Close on click outside
    const closeHandler = (e) => {
        if (!popover.contains(e.target) && e.target !== triggerBtn) {
            popover.remove();
            document.removeEventListener('click', closeHandler);
        }
    };

    setTimeout(() => document.addEventListener('click', closeHandler), 50);

    document.body.appendChild(popover);
}

function applyTestColor(testId, colorName) {
    if (!state.testColors) state.testColors = {};

    // Update State
    if (colorName === 'gray') {
        delete state.testColors[testId];
    } else {
        state.testColors[testId] = colorName;
    }

    // Update DOM
    const row = document.querySelector(`.test-row[data-id="${testId}"]`);
    if (row) {
        // Remove all bg- classes
        COLOR_OPTIONS.forEach(opt => row.classList.remove('bg-' + opt.name));

        if (colorName !== 'gray') {
            row.classList.add('bg-' + colorName);
        }
    }

    scheduleAutosave();
}

