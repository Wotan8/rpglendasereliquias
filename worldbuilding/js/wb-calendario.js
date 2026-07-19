/* ═══════════════════════════════════════════════════════════
   wb-calendario.js — Calendário customizado do mundo
   ───────────────────────────────────────────────────
   • Regras (semana, meses, luas) → doc worldbuilding-settings/calendario
   • ERAS não são duplicadas: são as entradas tipo "Era" da
     coleção worldbuilding-history (ecossistema real). Este
     módulo apenas acrescenta anoInicio/anoFim/cor a elas.
   • Matemática de datas usada pela Linha do Tempo.
   ═══════════════════════════════════════════════════════════ */

import { db, doc, getDoc, setDoc, updateDoc } from './firebase-config.js';
import { WB, esc } from './wb-utils.js';

export const DEFAULT_CAL = {
    weekDays: ['Solis', 'Lunae', 'Ferrun', 'Aquae', 'Ventis', 'Umbrae'],
    months: [
        { name: 'Alvorecer', days: 30 }, { name: 'Semeadura', days: 30 },
        { name: 'Fogo Alto', days: 32 }, { name: 'Colheita', days: 30 },
        { name: 'Névoas', days: 28 },    { name: 'Gelo Longo', days: 30 },
    ],
    moons: [
        { name: 'Olho de Prata', cycleDays: 27, offset: 0 },
        { name: 'Lua Rubra', cycleDays: 61, offset: 12 },
    ],
};

export const Calendario = (() => {
    let cal = null;

    /* ── Matemática ─────────────────────────────────────── */
    const daysPerYear = () => cal.months.reduce((s, m) => s + m.days, 0) || 1;

    function toAbsoluteDay({ ano = 0, mes = 0, dia = 1 }) {
        const before = cal.months.slice(0, mes).reduce((s, m) => s + m.days, 0);
        return ano * daysPerYear() + before + (dia - 1);
    }
    function weekDayOf(d) {
        const w = cal.weekDays.length;
        return w ? cal.weekDays[((toAbsoluteDay(d) % w) + w) % w] : '';
    }
    function moonPhases(d) {
        const abs = toAbsoluteDay(d);
        return cal.moons.map(m => {
            const p = (((abs + m.offset) % m.cycleDays) + m.cycleDays) % m.cycleDays / m.cycleDays;
            const icon = p < .1 || p > .9 ? '●' : p < .4 ? '◐' : p < .6 ? '○' : '◑';
            return { name: m.name, icon };
        });
    }
    function formatDate(d) {
        if (d == null || d.ano == null) return '';
        const m = cal.months[d.mes];
        if (!m) return `Ano ${d.ano}`;
        return `${d.dia} de ${m.name}, ${d.ano} — ${weekDayOf(d)}`;
    }

    /** Eras vêm da coleção real worldbuilding-history (tipo 'Era'). */
    function eras() {
        return (WB().data.history || [])
            .filter(h => h.tipo === 'Era')
            .sort((a, b) => (a.anoInicio ?? 0) - (b.anoInicio ?? 0));
    }
    function eraOf(ano) {
        return eras().find(e =>
            e.anoInicio != null && ano >= e.anoInicio &&
            (e.anoFim == null || e.anoFim === '' || ano <= e.anoFim)) || null;
    }

    /* ── UI do painel de regras (renderizada pela Timeline) ── */
    function configPanelHTML() {
        const eraRows = eras().map(e => `
            <div class="wbt-row" data-era-id="${e.id}">
                <span class="wbt-era-name" title="Entrada da wiki (História → Era)">⏳ ${esc(e.nome)}</span>
                <input class="wbt-input wbt-input--num" type="number" data-era-ini value="${e.anoInicio ?? ''}" placeholder="início">
                <input class="wbt-input wbt-input--num" type="number" data-era-fim value="${e.anoFim ?? ''}" placeholder="fim (—)">
                <input class="wbt-input wbt-input--color" type="color" data-era-cor value="${e.cor || '#D4AF37'}">
            </div>`).join('') ||
            `<p class="wbt-muted">Nenhuma Era cadastrada. Crie entradas do tipo "Era" na categoria 📜 História — elas aparecem aqui automaticamente.</p>`;

        return `
        <details class="wbt-panel" id="calPanel">
            <summary class="wbt-panel__head"><h3>⚙️ Regras do Calendário</h3>
                <span class="wbt-muted">semana, meses, luas e eras do mundo</span></summary>
            <div class="wbt-panel__body wbt-cal-grid">
                <div><h4 class="wbt-subhead">Dias da semana</h4>
                    <div id="calWeek" class="wbt-chiped">${cal.weekDays.map((d, i) =>
                        `<span class="wbt-row"><input class="wbt-input" data-wk="${i}" value="${esc(d)}"><button class="wbt-x" data-del-wk="${i}">✕</button></span>`).join('')}</div>
                    <button class="btn btn-secondary btn-sm" id="calAddWk">+ dia</button></div>
                <div><h4 class="wbt-subhead">Meses do ano</h4>
                    <div id="calMonths">${cal.months.map((m, i) => `
                        <div class="wbt-row"><input class="wbt-input" data-mn="${i}" value="${esc(m.name)}">
                        <input class="wbt-input wbt-input--num" type="number" min="1" data-md="${i}" value="${m.days}">
                        <button class="wbt-x" data-del-mn="${i}">✕</button></div>`).join('')}</div>
                    <button class="btn btn-secondary btn-sm" id="calAddMonth">+ mês</button></div>
                <div><h4 class="wbt-subhead">Luas & ciclos mágicos</h4>
                    <div id="calMoons">${cal.moons.map((m, i) => `
                        <div class="wbt-row"><input class="wbt-input" data-lu="${i}" value="${esc(m.name)}">
                        <input class="wbt-input wbt-input--num" type="number" min="2" data-lc="${i}" value="${m.cycleDays}">
                        <button class="wbt-x" data-del-lu="${i}">✕</button></div>`).join('')}</div>
                    <button class="btn btn-secondary btn-sm" id="calAddMoon">+ ciclo</button></div>
                <div><h4 class="wbt-subhead">Eras (📜 História)</h4>
                    <div id="calEras">${eraRows}</div></div>
                <div class="wbt-panel__footer">
                    <button class="btn btn-success" id="calSave">💾 Salvar calendário</button>
                    <span class="wbt-muted">${cal.weekDays.length} dias/semana · ${cal.months.length} meses · ${daysPerYear()} dias/ano</span>
                </div>
            </div>
        </details>`;
    }

    function readConfigFromDOM() {
        document.querySelectorAll('[data-wk]').forEach(i => cal.weekDays[+i.dataset.wk] = i.value.trim());
        document.querySelectorAll('[data-mn]').forEach(i => cal.months[+i.dataset.mn].name = i.value.trim());
        document.querySelectorAll('[data-md]').forEach(i => cal.months[+i.dataset.md].days = Math.max(1, +i.value || 1));
        document.querySelectorAll('[data-lu]').forEach(i => cal.moons[+i.dataset.lu].name = i.value.trim());
        document.querySelectorAll('[data-lc]').forEach(i => cal.moons[+i.dataset.lc].cycleDays = Math.max(2, +i.value || 2));
    }

    function bindConfig(rerender) {
        const panel = document.getElementById('calPanel');
        if (!panel) return;

        document.getElementById('calAddWk').onclick = () => { readConfigFromDOM(); cal.weekDays.push('Novo'); rerender(true); };
        document.getElementById('calAddMonth').onclick = () => { readConfigFromDOM(); cal.months.push({ name: 'Novo Mês', days: 30 }); rerender(true); };
        document.getElementById('calAddMoon').onclick = () => { readConfigFromDOM(); cal.moons.push({ name: 'Nova Lua', cycleDays: 28, offset: 0 }); rerender(true); };

        panel.addEventListener('click', (ev) => {
            const b = ev.target.closest('[data-del-wk],[data-del-mn],[data-del-lu]');
            if (!b) return;
            readConfigFromDOM();
            if (b.dataset.delWk != null) cal.weekDays.splice(+b.dataset.delWk, 1);
            if (b.dataset.delMn != null) cal.months.splice(+b.dataset.delMn, 1);
            if (b.dataset.delLu != null) cal.moons.splice(+b.dataset.delLu, 1);
            rerender(true);
        });

        document.getElementById('calSave').onclick = async () => {
            readConfigFromDOM();
            await setDoc(doc(db, 'worldbuilding-settings', 'calendario'), cal);

            // Salva anoInicio/anoFim/cor de cada Era DIRETO na entrada da wiki
            for (const row of document.querySelectorAll('[data-era-id]')) {
                const ini = row.querySelector('[data-era-ini]').value;
                const fim = row.querySelector('[data-era-fim]').value;
                const cor = row.querySelector('[data-era-cor]').value;
                await updateDoc(doc(db, 'worldbuilding-history', row.dataset.eraId), {
                    anoInicio: ini === '' ? null : +ini,
                    anoFim: fim === '' ? null : +fim,
                    cor,
                });
            }
            await WB().reload();
            WB().showAlert('✅ Calendário salvo!', 'success');
            rerender(false);
        };
    }

    /* ── API pública ────────────────────────────────────── */
    return {
        async load() {
            const snap = await getDoc(doc(db, 'worldbuilding-settings', 'calendario'));
            cal = snap.exists() ? { ...structuredClone(DEFAULT_CAL), ...snap.data() } : structuredClone(DEFAULT_CAL);
        },
        get cal() { return cal; },
        toAbsoluteDay, formatDate, weekDayOf, moonPhases, eraOf, eras,
        configPanelHTML, bindConfig,
        monthOptions(sel = 0) {
            return cal.months.map((m, i) =>
                `<option value="${i}" ${i === sel ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
        },
    };
})();
