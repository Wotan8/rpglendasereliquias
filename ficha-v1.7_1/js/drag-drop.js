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
