/* =============================================
   CHAR LOGGER — Auditoria completa da Ficha
   =============================================
   Registra TODA alteração que o personagem sofrer na coleção
   Firestore 'logs'. Funciona por "diff": após cada save bem-sucedido,
   compara o estado novo com o último snapshot e gera entradas de log
   legíveis, agrupadas por categoria, com detalhes (antes → depois).

   Também expõe logEvent() para eventos diretos (ex.: inventário,
   que grava na coleção 'items' fora do documento do personagem).

   Esquema do documento de log:
   {
     user, userName, character, charId, mesaId,
     section: 'ficha', origin: 'ficha',
     category: 'Atributos & Perícias' | 'Vitais & Derivados' | ...,
     action: 'resumo legível',
     changes: [{ label, from, to }],
     timestamp: ISO string
   }
============================================= */

window.CharLogger = (function () {
    'use strict';

    const FIRESTORE_URL = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
    const MAX_CHANGES_PER_LOG = 60;
    const MAX_VALUE_LEN = 140;

    let _prev = null;       // snapshot do último estado salvo/logado
    let _primed = false;

    /* ================= HELPERS ================= */

    function safeClone(obj) {
        try { return JSON.parse(JSON.stringify(obj ?? null)); } catch (e) { return null; }
    }

    function truncate(s, n) {
        s = String(s ?? '');
        return s.length > n ? s.slice(0, n - 1) + '…' : s;
    }

    function fmt(v) {
        if (v === null || v === undefined) return '—';
        if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
        if (typeof v === 'object') {
            try { return truncate(JSON.stringify(v), MAX_VALUE_LEN); } catch (e) { return '[objeto]'; }
        }
        const s = String(v).trim();
        return s === '' ? '—' : truncate(s, MAX_VALUE_LEN);
    }

    function norm(v) {
        if (v === null || v === undefined) return '';
        if (typeof v === 'object') { try { return JSON.stringify(v); } catch (e) { return ''; } }
        return String(v).trim();
    }

    function humanize(key) {
        return String(key || '')
            .replace(/^attr_/, 'Atributo ')
            .replace(/^pec_/, 'Peculiaridade ')
            .replace(/^cr_/, 'Recurso ')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase())
            .trim();
    }

    /* ============ RÓTULOS DE CAMPOS ============ */

    const FIELD_LABELS = {
        nome: 'Nome', jogador: 'Jogador', raca: 'Raça', classe: 'Classe', tribo: 'Tribo',
        idade: 'Idade', aparencia: 'Aparência', motivacao: 'Motivação', medo: 'Medo',
        vicio: 'Vício', virtude: 'Virtude', arrependimento: 'Arrependimento',
        exp: 'EXP Disponível', exp_total: 'EXP Total', sessoes: 'Sessões', nivel: 'Nível',
        vit_atual: 'Vitalidade Atual', ener_atual: 'Energia Atual', san_atual: 'Sanidade Atual',
        blindagem: 'Blindagem', marca_caca: 'Marca de Caça'
    };

    const ATTR_LABELS = {
        attr_for: 'Força', attr_des: 'Destreza', attr_vig: 'Vigor', attr_int: 'Inteligência',
        attr_rac: 'Raciocínio', attr_pre: 'Presença', attr_man: 'Manipulação',
        attr_aut: 'Autocontrole', attr_prs: 'Percepção'
    };

    function skillLabel(key) {
        try {
            if (window.SKILLS) {
                for (const cat of Object.keys(window.SKILLS)) {
                    const s = (window.SKILLS[cat] || []).find(x => x.key === key);
                    if (s) return s.name;
                }
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function fieldLabel(key) {
        if (FIELD_LABELS[key]) return FIELD_LABELS[key];
        if (ATTR_LABELS[key]) return 'Atributo ' + ATTR_LABELS[key];
        const sk = skillLabel(key);
        if (sk) return 'Perícia ' + sk;
        // Campos indexados: inv_name_3, wpn_dano_1, cond_desc_0...
        const m = key.match(/^(inv|wpn|arm|proj|cond)_([a-z]+)_(\d+)$/);
        if (m) {
            const grp = { inv: 'Inventário (ficha)', wpn: 'Arma', arm: 'Armadura', proj: 'Projétil', cond: 'Condição' }[m[1]];
            const sub = { name: 'Nome', desc: 'Descrição', qtd: 'Qtd', dano: 'Dano', integ: 'Integridade', tam: 'Tamanho', bld: 'Blindagem', rea: 'Reação', tipo: 'Tipo', tempo: 'Tempo' }[m[2]] || humanize(m[2]);
            return `${grp} #${Number(m[3]) + 1} — ${sub}`;
        }
        return humanize(key);
    }

    function fieldCategory(key) {
        if (/^attr_/.test(key)) return 'Atributos & Perícias';
        if (skillLabel(key)) return 'Atributos & Perícias';
        if (/^(vit|ener|san|dv_|dv[a-z]*_|blind|esquiva|bloqueio|marca)/.test(key)) return 'Vitais & Derivados';
        if (/^(exp|sessoes|nivel)/.test(key)) return 'Progressão & EXP';
        if (/^(inv_|wpn_|arm_|proj_)/.test(key)) return 'Inventário';
        if (/^cond_/.test(key)) return 'Condições';
        if (/^cr_/.test(key)) return 'Recursos de Classe';
        if (/^(nome|jogador|raca|classe|tribo|idade|aparencia|motivacao|medo|vicio|virtude|arrependimento)$/.test(key)) return 'Identidade';
        return 'Campos da Ficha';
    }

    function dotCategory(key) {
        return key.startsWith('pec_') ? 'Peculiaridades' : 'Atributos & Perícias';
    }

    function dotLabel(key) {
        if (key.startsWith('pec_')) return 'Peculiaridade ' + humanize(key.replace(/^pec_/, ''));
        if (ATTR_LABELS[key]) return 'Atributo ' + ATTR_LABELS[key];
        const sk = skillLabel(key);
        if (sk) return 'Perícia ' + sk;
        return humanize(key);
    }

    /* ============ SNAPSHOT (pick) ============ */
    // Seções do gatherData() consideradas na auditoria.
    // Ignorados (caches internos de recálculo, que gerariam ruído):
    // fieldBaseValues, appliedFieldBonuses, mecanicasAplicadas, derivedValues (duplicado de fields).

    function pick(data) {
        if (!data) return {};
        return safeClone({
            fields: data.fields || {},
            dots: data.dots || {},
            notes: data.notes || [],
            conditions: data.conditions || [],
            charImg: data.charImg ? ('#' + String(data.charImg).length + ':' + String(data.charImg).slice(0, 40)) : '',
            locacoes: data.locacoes || [],
            rituais: data.rituais || [],
            ritos: data.ritos || [],
            sigilus: data.sigilus || [],
            runasPrep: data.runasPrep || [],
            estudos: data.estudos || [],
            customTests: data.customTests || [],
            testColors: data.testColors || {},
            mainTestsOrder: data.mainTestsOrder || [],
            peculiaridadeLevels: data.peculiaridadeLevels || {},
            peculiaridadesIndividuais: data.peculiaridadesIndividuais || [],
            derivedOverrides: data.derivedOverrides || {},
            derivedModifiers: data.derivedModifiers || {},
            dvAtual: data.dvAtual || {},
            expApplied: data.expApplied || {},
            auras: data.auras || {},
            classModuleData: data.classModuleData || {},
            runomancia: data.runomancia || {},
            partesDoCorpo: data.partesDoCorpo || [],
            inventoryItems: data.inventoryItems || []
        });
    }

    /* ============ DIFF ENGINE ============ */

    function diffFlatObject(oldO, newO, labelFn) {
        const changes = [];
        oldO = oldO || {}; newO = newO || {};
        const keys = new Set([...Object.keys(oldO), ...Object.keys(newO)]);
        for (const k of keys) {
            if (norm(oldO[k]) !== norm(newO[k])) {
                changes.push({ label: labelFn(k), from: fmt(oldO[k]), to: fmt(newO[k]) });
            }
        }
        return changes;
    }

    /**
     * Diff genérico de arrays de objetos.
     * @param keyOf  função que extrai a chave de identidade do item
     * @param nameOf função que extrai o nome exibível
     * @param noun   substantivo ("Anotação", "Ritual"...)
     */
    function diffArray(oldA, newA, keyOf, nameOf, noun) {
        const changes = [];
        oldA = Array.isArray(oldA) ? oldA : [];
        newA = Array.isArray(newA) ? newA : [];
        const oldMap = new Map(), newMap = new Map();
        oldA.forEach((it, i) => oldMap.set(String(keyOf(it, i)), it));
        newA.forEach((it, i) => newMap.set(String(keyOf(it, i)), it));

        for (const [k, it] of newMap) {
            if (!oldMap.has(k)) {
                changes.push({ label: `${noun} adicionada(o)`, from: '—', to: fmt(nameOf(it)) });
            }
        }
        for (const [k, it] of oldMap) {
            if (!newMap.has(k)) {
                changes.push({ label: `${noun} removida(o)`, from: fmt(nameOf(it)), to: '—' });
            }
        }
        for (const [k, newIt] of newMap) {
            const oldIt = oldMap.get(k);
            if (!oldIt) continue;
            if (typeof newIt === 'object' && newIt !== null && typeof oldIt === 'object' && oldIt !== null) {
                const sub = new Set([...Object.keys(oldIt), ...Object.keys(newIt)]);
                for (const f of sub) {
                    if (norm(oldIt[f]) !== norm(newIt[f])) {
                        changes.push({
                            label: `${noun} "${truncate(nameOf(newIt) || nameOf(oldIt), 40)}" — ${humanize(f)}`,
                            from: fmt(oldIt[f]), to: fmt(newIt[f])
                        });
                    }
                }
            } else if (norm(oldIt) !== norm(newIt)) {
                changes.push({ label: `${noun} alterada(o)`, from: fmt(oldIt), to: fmt(newIt) });
            }
        }
        return changes;
    }

    const byName = it => (it && (it.name || it.nome || it.title || it.titulo)) || '(sem nome)';

    /**
     * Compara dois snapshots e devolve entradas de log agrupadas por categoria.
     */
    function computeEntries(prev, cur) {
        const buckets = {}; // category → changes[]
        const push = (cat, arr) => {
            if (!arr || !arr.length) return;
            (buckets[cat] = buckets[cat] || []).push(...arr);
        };

        // fields — categorizados individualmente
        {
            const oldF = prev.fields || {}, newF = cur.fields || {};
            const keys = new Set([...Object.keys(oldF), ...Object.keys(newF)]);
            for (const k of keys) {
                if (norm(oldF[k]) !== norm(newF[k])) {
                    push(fieldCategory(k), [{ label: fieldLabel(k), from: fmt(oldF[k]), to: fmt(newF[k]) }]);
                }
            }
        }

        // dots (bolinhas de atributos, perícias e peculiaridades)
        {
            const oldD = prev.dots || {}, newD = cur.dots || {};
            const keys = new Set([...Object.keys(oldD), ...Object.keys(newD)]);
            for (const k of keys) {
                const a = Number(oldD[k] || 0), b = Number(newD[k] || 0);
                if (a !== b) push(dotCategory(k), [{ label: dotLabel(k), from: String(a), to: String(b) }]);
            }
        }

        // imagem
        if (norm(prev.charImg) !== norm(cur.charImg)) {
            push('Identidade', [{ label: 'Imagem do personagem', from: prev.charImg ? '(imagem anterior)' : '—', to: cur.charImg ? '(nova imagem)' : '—' }]);
        }

        // anotações
        push('Anotações', diffArray(prev.notes, cur.notes, (n, i) => (n && n.id) || 'idx' + i, byName, 'Anotação'));

        // condições
        push('Condições', diffArray(prev.conditions, cur.conditions, (c, i) => (c && (c.id || c.nome)) || 'idx' + i, byName, 'Condição'));

        // magia, receitas e afins
        push('Magia & Receitas', diffArray(prev.locacoes, cur.locacoes, (x, i) => byName(x) || 'idx' + i, byName, 'Loção'));
        push('Magia & Receitas', diffArray(prev.rituais, cur.rituais, (x, i) => byName(x) || 'idx' + i, byName, 'Ritual'));
        push('Magia & Receitas', diffArray(prev.ritos, cur.ritos, (x, i) => byName(x) || 'idx' + i, byName, 'Rito'));
        push('Magia & Receitas', diffArray(prev.sigilus, cur.sigilus, (x, i) => (x && (x.dotsKey || x.name)) || 'idx' + i, byName, 'Sigilus'));
        push('Magia & Receitas', diffArray(prev.runasPrep, cur.runasPrep, (x, i) => byName(x) || 'idx' + i, byName, 'Runa Preparada'));
        push('Magia & Receitas', diffArray(prev.estudos, cur.estudos, (x, i) => byName(x) || 'idx' + i, byName, 'Estudo'));

        // runomancia
        if (prev.runomancia || cur.runomancia) {
            const pr = prev.runomancia || {}, cr = cur.runomancia || {};
            push('Magia & Receitas', diffArray(pr.estudos, cr.estudos, (x, i) => byName(x) || 'idx' + i, byName, 'Estudo Rúnico'));
            push('Magia & Receitas', diffArray(pr.grimorio, cr.grimorio, (x, i) => byName(x) || 'idx' + i, byName, 'Runa do Grimório'));
            push('Magia & Receitas', diffFlatObject(pr.aprendidos, cr.aprendidos, k => 'Elemento aprendido: ' + humanize(k)));
        }

        // testes
        push('Testes', diffArray(prev.customTests, cur.customTests, (x, i) => (x && (x.id || x.name)) || 'idx' + i, byName, 'Teste Customizado'));
        push('Testes', diffFlatObject(prev.testColors, cur.testColors, k => 'Cor do teste ' + humanize(k)));
        if (norm(prev.mainTestsOrder) !== norm(cur.mainTestsOrder)) {
            push('Testes', [{ label: 'Ordem dos testes principais', from: '(ordem anterior)', to: '(nova ordem)' }]);
        }

        // peculiaridades
        push('Peculiaridades', diffFlatObject(prev.peculiaridadeLevels, cur.peculiaridadeLevels, k => 'Nível de ' + humanize(k)));
        push('Peculiaridades', diffArray(prev.peculiaridadesIndividuais, cur.peculiaridadesIndividuais, (x, i) => (x && (x.id || x.nome)) || 'idx' + i, byName, 'Peculiaridade Individual'));

        // vitais/derivados extras
        push('Vitais & Derivados', diffFlatObject(prev.derivedOverrides, cur.derivedOverrides, k => 'Override de ' + humanize(k)));
        push('Vitais & Derivados', diffFlatObject(prev.derivedModifiers, cur.derivedModifiers, k => 'Modificador de ' + humanize(k)));
        push('Vitais & Derivados', diffFlatObject(prev.dvAtual, cur.dvAtual, k => 'Valor atual de ' + humanize(k)));

        // progressão
        push('Progressão & EXP', diffFlatObject(prev.expApplied, cur.expApplied, k => 'EXP aplicada em ' + humanize(k)));

        // auras
        push('Auras', diffFlatObject(prev.auras, cur.auras, k => 'Aura ' + humanize(k)));

        // recursos/módulos de classe
        push('Recursos de Classe', diffFlatObject(prev.classModuleData, cur.classModuleData, k => humanize(k)));

        // corpo
        push('Corpo', diffArray(prev.partesDoCorpo, cur.partesDoCorpo, (x, i) => (x && (x.id || x.nome)) || 'idx' + i, byName, 'Parte do Corpo'));

        // inventário salvo na ficha (wizard)
        push('Inventário', diffArray(prev.inventoryItems, cur.inventoryItems, (x, i) => byName(x) || 'idx' + i, byName, 'Item (ficha)'));

        // montar entradas finais
        const entries = [];
        for (const [category, changes] of Object.entries(buckets)) {
            const limited = changes.slice(0, MAX_CHANGES_PER_LOG);
            if (changes.length > MAX_CHANGES_PER_LOG) {
                limited.push({ label: `… e mais ${changes.length - MAX_CHANGES_PER_LOG} alteração(ões)`, from: '', to: '' });
            }
            const action = limited.length === 1
                ? `${limited[0].label}: ${limited[0].from} → ${limited[0].to}`
                : `${changes.length} alterações em ${category}`;
            entries.push({ category, action: truncate(action, 220), changes: limited });
        }
        return entries;
    }

    /* ============ ESCRITA NO FIRESTORE ============ */

    async function write(entries) {
        try {
            if (!entries || !entries.length) return;
            if (!window.db || !window.currentUser) return;
            const { collection, addDoc } = await import(FIRESTORE_URL);
            const charName = (document.querySelector('[data-key="nome"]') || {}).value
                || (window.state && window.state.fields && window.state.fields.nome) || '';
            const mesaId = (typeof state !== 'undefined' && state && state.mesaId) ? state.mesaId : null;
            const base = {
                user: window.currentUser.email || 'Jogador',
                userName: window.currentUser.displayName || window.currentUser.email || 'Jogador',
                character: charName || '(sem nome)',
                charId: window.currentCharacterId || null,
                mesaId: mesaId,
                section: 'ficha',
                origin: window.isMestre ? 'ficha (mestre)' : 'ficha',
                timestamp: new Date().toISOString()
            };
            for (const e of entries) {
                await addDoc(collection(window.db, 'logs'), Object.assign({}, base, {
                    category: e.category || 'Geral',
                    action: e.action || '',
                    changes: e.changes || []
                }));
            }
            console.log(`📜 CharLogger: ${entries.length} log(s) registrado(s).`);
        } catch (err) {
            console.warn('⚠️ CharLogger: falha ao gravar log:', err);
        }
    }

    /* ============ API PÚBLICA ============ */

    /** Registra o snapshot inicial (após carregar a ficha). Não gera logs. */
    function prime(data) {
        _prev = pick(data);
        _primed = true;
        console.log('📜 CharLogger: snapshot inicial registrado.');
    }

    /** Prime a partir do gatherData() atual (chamado após o load da UI). */
    function primeFromGather() {
        try {
            if (typeof gatherData === 'function' && window._dataReady) prime(gatherData());
        } catch (e) { console.warn('CharLogger.primeFromGather:', e); }
    }

    /** Chamado após cada save bem-sucedido no Firestore. Faz o diff e grava os logs. */
    function afterSave(data) {
        try {
            const cur = pick(data);
            if (!_primed || _prev === null) {
                _prev = cur; _primed = true;
                write([{ category: 'Sistema', action: '📄 Ficha criada / primeiro salvamento registrado', changes: [] }]);
                return;
            }
            const entries = computeEntries(_prev, cur);
            _prev = cur;
            if (entries.length) write(entries);
        } catch (err) {
            console.warn('⚠️ CharLogger.afterSave:', err);
        }
    }

    /** Log direto de um evento (ex.: inventário). entry = {category, action, changes} */
    function logEvent(entry) { write([entry]); }

    /* ============ LOGS DE INVENTÁRIO (coleção 'items') ============ */

    const ITEM_FIELD_LABELS = {
        nome: 'Nome', name: 'Nome', quantidade: 'Quantidade', equipado: 'Equipado',
        estadoEquip: 'Estado de Equipamento', parentItemId: 'Container',
        durabilidade: 'Durabilidade', durabilidadeAtual: 'Durabilidade Atual',
        peso: 'Peso', descricao: 'Descrição', notas: 'Notas', preco: 'Preço',
        categoria: 'Categoria', raridade: 'Raridade'
    };
    const ITEM_SKIP_FIELDS = new Set(['lastModified', 'characterId', 'ownerId', 'ownerUid', 'createdAt', 'imagem', 'imagemUrl']);

    function _findItem(itemId) {
        try { return (window._inventoryState.items || []).find(i => i.id === itemId) || null; } catch (e) { return null; }
    }
    function _itemName(it) { return (it && (it.nome || it.name)) || '(item)'; }
    function _containerName(id) {
        if (!id) return 'Fora de container';
        const c = _findItem(id);
        return c ? `Container "${_itemName(c)}"` : 'Container';
    }

    /** Constrói o log de criação/edição de item ANTES do write (compara com o cache local). */
    function buildItemLog(itemId, data) {
        const old = _findItem(itemId);
        if (!old) {
            return {
                category: 'Inventário',
                action: `🎒 Item adicionado: "${truncate(_itemName(data), 60)}"` + (data.quantidade ? ` (x${data.quantidade})` : ''),
                changes: Object.keys(data || {})
                    .filter(k => !ITEM_SKIP_FIELDS.has(k) && norm(data[k]) !== '')
                    .slice(0, MAX_CHANGES_PER_LOG)
                    .map(k => ({ label: ITEM_FIELD_LABELS[k] || humanize(k), from: '—', to: k === 'parentItemId' ? _containerName(data[k]) : fmt(data[k]) }))
            };
        }
        const changes = [];
        for (const k of Object.keys(data || {})) {
            if (ITEM_SKIP_FIELDS.has(k)) continue;
            if (norm(old[k]) === norm(data[k])) continue;
            if (k === 'parentItemId') {
                changes.push({ label: 'Localização', from: _containerName(old[k]), to: _containerName(data[k]) });
            } else {
                changes.push({ label: ITEM_FIELD_LABELS[k] || humanize(k), from: fmt(old[k]), to: fmt(data[k]) });
            }
        }
        if (!changes.length) return null;
        const name = truncate(_itemName(old), 60);
        const action = changes.length === 1
            ? `🎒 Item "${name}" — ${changes[0].label}: ${changes[0].from} → ${changes[0].to}`
            : `🎒 Item "${name}" atualizado (${changes.length} alterações)`;
        return { category: 'Inventário', action: truncate(action, 220), changes };
    }

    /** Constrói o log de remoção de item ANTES do delete. */
    function buildItemDeleteLog(itemId) {
        const old = _findItem(itemId);
        const name = truncate(_itemName(old), 60);
        return {
            category: 'Inventário',
            action: `🗑️ Item removido: "${name}"`,
            changes: old ? [
                { label: 'Nome', from: fmt(_itemName(old)), to: '—' },
                { label: 'Quantidade', from: fmt(old.quantidade || 1), to: '—' }
            ] : []
        };
    }

    return { prime, primeFromGather, afterSave, logEvent, buildItemLog, buildItemDeleteLog, _debugDiff: (a, b) => computeEntries(pick(a), pick(b)) };
})();
