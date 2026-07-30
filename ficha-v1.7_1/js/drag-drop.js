/* ===== DRAG AND DROP HANDLER ===== */

function initDragAndDrop(containerId, onReorderCallback) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let draggedItem = null;

    container.addEventListener('dragstart', (e) => {
        draggedItem = e.target.closest('[draggable="true"]');
        if (!draggedItem) return;

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedItem.dataset.id);
        
        // Timeout to let the drag verify start before hiding
        setTimeout(() => draggedItem.classList.add('dragging'), 0);
    });

    container.addEventListener('dragend', () => {
        if (draggedItem) {
            draggedItem.classList.remove('dragging');
            draggedItem = null;
            if (typeof onReorderCallback === 'function') {
                onReorderCallback();
            }
        }
        
        // Remove helpers
        container.querySelectorAll('.drag-over-top').forEach(el => el.classList.remove('drag-over-top'));
        container.querySelectorAll('.drag-over-bottom').forEach(el => el.classList.remove('drag-over-bottom'));
    });

    container.addEventListener('dragover', (e) => {
        e.preventDefault(); // Necessary to allow dropping
        const target = e.target.closest('[draggable="true"]');
        if (!target || target === draggedItem) return;

        const rect = target.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        
        // Remove previous styles
        container.querySelectorAll('.drag-over-top').forEach(el => el.classList.remove('drag-over-top'));
        container.querySelectorAll('.drag-over-bottom').forEach(el => el.classList.remove('drag-over-bottom'));

        if (e.clientY < midY) {
            target.classList.add('drag-over-top');
        } else {
            target.classList.add('drag-over-bottom');
        }
    });
    
    container.addEventListener('dragleave', (e) => {
         const target = e.target.closest('[draggable="true"]');
         if (target) {
            target.classList.remove('drag-over-top');
            target.classList.remove('drag-over-bottom');
         }
    });

    container.addEventListener('drop', (e) => {
        e.preventDefault();
        const target = e.target.closest('[draggable="true"]');
        if (!draggedItem || !target || draggedItem === target) return;

        const rect = target.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        if (e.clientY < midY) {
            container.insertBefore(draggedItem, target);
        } else {
            container.insertBefore(draggedItem, target.nextSibling);
        }

        // Cleanup
        target.classList.remove('drag-over-top');
        target.classList.remove('drag-over-bottom');
    });

    /* ===== FALLBACK PARA TOQUE (celular/tablet) =====
       Os eventos HTML5 dragstart/dragover NÃO disparam em telas touch.
       Aqui, um toque longo (~350ms) no item ativa o modo de reordenação;
       arrastar o dedo move o item; soltar confirma. Um toque curto ou
       deslizar antes do tempo continua rolando a página normalmente. */
    let touchItem = null;
    let touchTimer = null;
    let touchStartY = 0;
    let touchActive = false;

    function clearTouchState() {
        if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; }
        if (touchItem) touchItem.classList.remove('dragging');
        container.querySelectorAll('.drag-over-top, .drag-over-bottom')
            .forEach(el => el.classList.remove('drag-over-top', 'drag-over-bottom'));
        touchItem = null;
        touchActive = false;
    }

    container.addEventListener('touchstart', (e) => {
        const item = e.target.closest('[draggable="true"]');
        if (!item) return;
        // Não sequestrar toques em campos/botões dentro da linha
        if (e.target.closest('input, select, textarea, button, a')) return;

        touchStartY = e.touches[0].clientY;
        touchItem = item;
        touchActive = false;
        touchTimer = setTimeout(() => {
            touchActive = true;
            item.classList.add('dragging');
            if (navigator.vibrate) navigator.vibrate(20);
        }, 350);
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
        if (!touchItem) return;

        const y = e.touches[0].clientY;

        // Ainda no período de long-press: se o dedo deslizar, é rolagem — cancela
        if (!touchActive) {
            if (Math.abs(y - touchStartY) > 8) clearTouchState();
            return;
        }

        // Modo reordenação ativo: impedir a rolagem e mover o item
        e.preventDefault();

        const over = document.elementFromPoint(e.touches[0].clientX, y);
        const target = over && over.closest('[draggable="true"]');
        if (!target || target === touchItem || !container.contains(target)) return;

        const rect = target.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        container.querySelectorAll('.drag-over-top, .drag-over-bottom')
            .forEach(el => el.classList.remove('drag-over-top', 'drag-over-bottom'));

        if (y < midY) {
            target.classList.add('drag-over-top');
            container.insertBefore(touchItem, target);
        } else {
            target.classList.add('drag-over-bottom');
            container.insertBefore(touchItem, target.nextSibling);
        }
    }, { passive: false });

    container.addEventListener('touchend', () => {
        const moved = touchActive;
        clearTouchState();
        if (moved && typeof onReorderCallback === 'function') onReorderCallback();
    });

    container.addEventListener('touchcancel', clearTouchState);
}

function getContainerOrder(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    
    const ids = [];
    container.querySelectorAll('[draggable="true"]').forEach(el => {
        if (el.dataset.id) ids.push(el.dataset.id);
    });
    return ids;
}
