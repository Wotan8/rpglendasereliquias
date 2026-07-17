// =============================================
// TABULEIRO — Undo / Redo (FASE 7)
// Pilha local (modo secreto) de operações reversíveis sobre objetos:
// add ↔ del ↔ patch (posição/propriedades). Ctrl+Z / Ctrl+Y (ou Ctrl+Shift+Z).
// Instrumentado por tab-objects (add/upd/del) e tab-tools (fim de arrasto).
// =============================================
import { setDoc, updateDoc, deleteDoc } from '../../painel-mestre/js/firebase-config.js';
import { T, toast, markDirty } from './tab-state.js';
import { refObjeto } from './tab-main.js';

const LIMITE = 60;
const undoStack = [];
const redoStack = [];
let aplicando = false;

export function podeRegistrar() {
    return T.mode === 'secret' && T.isMaster && !aplicando;
}

/**
 * Registra uma operação reversível.
 * op: { tipo:'add'|'del'|'patch', id, dados?, antes?, depois? }
 */
export function registrarOp(op) {
    if (!podeRegistrar()) return;
    undoStack.push({ ...op, canvasId: T.canvasId });
    if (undoStack.length > LIMITE) undoStack.shift();
    redoStack.length = 0;
}

function limparCampos(o) {
    // remove campos locais (__*) antes de regravar
    const out = {};
    for (const [k, v] of Object.entries(o || {})) {
        if (k.startsWith('__') || k === 'id') continue;
        out[k] = v;
    }
    return out;
}

export async function desfazer() {
    const op = undoStack.pop();
    if (!op) { toast('Nada para desfazer', 'warning'); return; }
    if (op.canvasId !== T.canvasId) { toast('⚠️ A ação era de outro canvas', 'warning'); return; }
    aplicando = true;
    try {
        if (op.tipo === 'add') {
            T.objects.delete(op.id);
            await deleteDoc(refObjeto(op.id));
        } else if (op.tipo === 'del') {
            const dados = limparCampos(op.dados);
            T.objects.set(op.id, { id: op.id, ...dados });
            await setDoc(refObjeto(op.id), dados);
        } else if (op.tipo === 'patch') {
            const o = T.objects.get(op.id);
            if (o) Object.assign(o, op.antes);
            await updateDoc(refObjeto(op.id), { ...op.antes, atualizadoEm: Date.now(), lastWriter: T.user?.uid || null });
        }
        redoStack.push(op);
        markDirty();
        toast('↩️ Desfeito');
    } catch (e) { console.warn('undo', e); toast('❌ Não foi possível desfazer', 'danger'); }
    finally { aplicando = false; }
}

export async function refazer() {
    const op = redoStack.pop();
    if (!op) { toast('Nada para refazer', 'warning'); return; }
    if (op.canvasId !== T.canvasId) { toast('⚠️ A ação era de outro canvas', 'warning'); return; }
    aplicando = true;
    try {
        if (op.tipo === 'add') {
            const dados = limparCampos(op.dados);
            T.objects.set(op.id, { id: op.id, ...dados });
            await setDoc(refObjeto(op.id), dados);
        } else if (op.tipo === 'del') {
            T.objects.delete(op.id);
            await deleteDoc(refObjeto(op.id));
        } else if (op.tipo === 'patch') {
            const o = T.objects.get(op.id);
            if (o) Object.assign(o, op.depois);
            await updateDoc(refObjeto(op.id), { ...op.depois, atualizadoEm: Date.now(), lastWriter: T.user?.uid || null });
        }
        undoStack.push(op);
        markDirty();
        toast('↪️ Refeito');
    } catch (e) { console.warn('redo', e); toast('❌ Não foi possível refazer', 'danger'); }
    finally { aplicando = false; }
}
