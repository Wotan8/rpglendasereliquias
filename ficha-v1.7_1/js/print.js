/* PRINT MODAL LOGIC */

function initPrintModal() {
    if (document.getElementById('printOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'printOverlay';

    const modal = document.createElement('div');
    modal.id = 'printModal';

    modal.innerHTML = `
        <h2>Imprimir Ficha</h2>
        <div class="print-options">
            <label class="print-option"><input type="checkbox" value="tabPrincipal" checked> Principal</label>
            <label class="print-option"><input type="checkbox" value="tabCombate" checked> Combate</label>
            <label class="print-option"><input type="checkbox" value="tabInventario" checked> Inventário</label>
            <label class="print-option"><input type="checkbox" value="tabPeculiaridades" checked> Peculiaridades</label>
            <label class="print-option"><input type="checkbox" value="tabNotas"> Notas</label>
        </div>
        <div class="print-actions">
            <button class="btn-cancel" onclick="closePrintModal()">Cancelar</button>
            <button class="btn-print" onclick="confirmPrint()">Imprimir</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closePrintModal();
    });
}

function openPrintModal() {
    initPrintModal();
    const overlay = document.getElementById('printOverlay');
    const modal = document.getElementById('printModal');
    overlay.style.display = 'flex';
    modal.style.display = 'flex';
}

function closePrintModal() {
    const overlay = document.getElementById('printOverlay');
    if (overlay) overlay.style.display = 'none';
}

function confirmPrint() {
    const checkboxes = document.querySelectorAll('#printModal input[type="checkbox"]');
    const selectedTabs = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);

    if (selectedTabs.length === 0) {
        alert('Selecione pelo menos uma aba para imprimir.');
        return;
    }

    // Apply classes for printing
    document.querySelectorAll('.tab-content').forEach(tab => {
        if (selectedTabs.includes(tab.id)) {
            tab.classList.add('print-visible');
        } else {
            tab.classList.remove('print-visible');
        }
    });

    closePrintModal();

    // Small delay to allow DOM updates before print dialog
    setTimeout(() => {
        window.print();

        // Cleanup after print (optional, but good for UI state)
        // We can leave them, or remove them.
        // For standard "active" properties, the CSS handles display based on 'active' class.
        // But our print CSS overrides display based on 'print-visible'.
        // We should cleanup so user continuing to use the page isn't confused if we messed with classes,
        // although 'print-visible' only affects @media print.
        // Actually, it's safer to remove them so subsequent prints don't have stale state if we re-open modal.
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('print-visible'));
    }, 500);
}

// Expose to window
window.openPrintModal = openPrintModal;
window.closePrintModal = closePrintModal;
window.confirmPrint = confirmPrint;
