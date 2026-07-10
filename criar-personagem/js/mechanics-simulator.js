/* ===== MECHANICS SIMULATOR PARA CRIAÇÃO DE PERSONAGEM ===== */
/* Este módulo calcula os valores derivados finais baseados no wizardState.
   Replica o motor de cálculo completo do mechanics-engine.js da ficha,
   aplicando TODAS as mecânicas (DVs diretos, peculiaridades, etc.)
   que afetam Valores Derivados. */

export function simulateDerivedValues() {
    const state = window.wizardState;
    if (!state) return {};
    if (!window.DERIVED_VALUES || window.DERIVED_VALUES.length === 0) return {};

    const results = {};
    const initialConstants = {};
    const baseStats = { ...state.atributos };
    
    // Add base_inicial to attributes to get absolute values (normally 1)
    const baseInicial = window.REGRAS_CRIACAO?.atributos?.base_inicial || 1;
    ['attr_int', 'attr_rac', 'attr_prs', 'attr_for', 'attr_des', 'attr_vig', 'attr_pre', 'attr_man', 'attr_aut'].forEach(attr => {
        baseStats[attr] = (baseStats[attr] || 0) + baseInicial;
    });

    // 1. Iniciar com os Valores Iniciais definidos pela Raça, Classe e Tribo
    const raca = window._systemData?.races?.find(r => r.nome === state.racaSelecionada);
    const classe = window._systemData?.classes?.find(c => c.nome === state.classeSelecionada);
    const tribo = window._systemData?.tribes?.find(t => t.nome === state.triboSelecionada);

    window.DERIVED_VALUES.forEach(dv => {
        results[dv.id] = 0;
        initialConstants[dv.id] = 0;
        
        const sumFromSource = (source) => {
            if (!source || !source.derivedValueIds) return;
            const match = source.derivedValueIds.find(x => typeof x === 'object' ? x.id === dv.id : x === dv.id);
            if (match) {
                initialConstants[dv.id] += (typeof match === 'object' ? (match.valorInicial || 0) : 0);
            }
        };

        sumFromSource(raca);
        sumFromSource(classe);
        sumFromSource(tribo);
    });

    // Função auxiliar para obter valor de uma ref (replica _resolveSheetRef do mechanics-engine)
    const getRefValue = (ref) => {
        if (!ref) return 0;
        
        // Atributos (ex: attr_for)
        if (baseStats[ref] !== undefined) return baseStats[ref];
        
        // Atalhos de atributos (ex: FOR, VIG) e nomes completos
        const attrMap = {
            'INT': 'attr_int', 'RAC': 'attr_rac', 'PRS': 'attr_prs',
            'FOR': 'attr_for', 'DES': 'attr_des', 'VIG': 'attr_vig',
            'PRE': 'attr_pre', 'MAN': 'attr_man', 'AUT': 'attr_aut',
            // Aliases por nome completo (como no TARGET_MAP da ficha)
            'Inteligência': 'attr_int', 'Raciocínio': 'attr_rac', 'Perseverança': 'attr_prs',
            'Força': 'attr_for', 'Destreza': 'attr_des', 'Vigor': 'attr_vig',
            'Presença': 'attr_pre', 'Manipulação': 'attr_man', 'Autocontrole': 'attr_aut'
        };
        if (attrMap[ref]) return baseStats[attrMap[ref]];
        
        // Referência a outro Valor Derivado (por key, id ou DERIVED:key)
        const targetDv = window.DERIVED_VALUES.find(d => d.key === ref || d.id === ref || `DERIVED:${d.key}` === ref);
        if (targetDv && results[targetDv.id] !== undefined) {
            return results[targetDv.id];
        }

        // Referência a DV pelo nome legível (como no TARGET_MAP)
        const dvByName = window.DERIVED_VALUES.find(d => d.nome === ref);
        if (dvByName && results[dvByName.id] !== undefined) {
            return results[dvByName.id];
        }

        // Perícias — buscar no wizardState (sk_<key>)
        if (ref.startsWith('sk_')) {
            return state.pericias?.[ref] || 0;
        }
        // Perícia por nome legível
        if (window.SKILLS) {
            for (const [cat, skills] of Object.entries(window.SKILLS)) {
                const found = skills.find(s => s.name === ref);
                if (found) {
                    return state.pericias?.[`sk_${found.key}`] || 0;
                }
            }
        }

        // Caso ref seja um valor constante já processado em string
        const num = parseFloat(ref);
        if (!isNaN(num)) return num;

        return 0;
    };

    // Função para resolver equações da Engine (simulador)
    // Replica resolveEquation do mechanics-engine.js
    const resolveEquation = (equacao) => {
        if (!equacao || equacao.length === 0) return 0;
        
        const resolveTerm = (t) => {
            if (t.tipo === 'ficha') return getRefValue(t.ref);
            return parseFloat(t.valor) || 0;
        };

        let result = resolveTerm(equacao[0]);
        for (let i = 1; i < equacao.length; i++) {
            const t = equacao[i];
            const op = t.op || '+';
            
            const val = resolveTerm(t);
            
            if (op === '+') result += val;
            else if (op === '-') result -= val;
            else if (op === '*' || op === '×') result *= val;
            else if (op === '/' || op === '÷') result = val !== 0 ? result / val : result;
            else if (op === 'min') result = Math.min(result, val);
            else if (op === 'max') result = Math.max(result, val);
        }
        return result; // Sem Math.floor — preserva decimais para precisão
    };

    // Replica resolveCalcValue do mechanics-engine.js
    const resolveCalcValue = (calc) => {
        if (!calc) return 0;
        // New equation format
        if (Array.isArray(calc.equacao) && calc.equacao.length > 0) {
            return resolveEquation(calc.equacao);
        }
        // Legacy format
        if (calc.valorTipo !== 'ficha') {
            return parseFloat(calc.valor) || 0;
        }
        // Resolve valor de ficha (legacy)
        return getRefValue(calc.valorRef) * (calc.valorMultiplicador || 1);
    };

    // 2. Aplicar Mecânicas vinculadas diretamente aos Valores Derivados
    if (window._systemData && window._systemData.mechanics) {
        // Build TARGET_MAP local para resolver alvos por nome
        // Replica a estrutura do TARGET_MAP do mechanics-engine.js
        const targetMap = {};
        
        // Atributos
        const attrEntries = {
            'INT': 'attr_int', 'RAC': 'attr_rac', 'PRS': 'attr_prs',
            'FOR': 'attr_for', 'DES': 'attr_des', 'VIG': 'attr_vig',
            'PRE': 'attr_pre', 'MAN': 'attr_man', 'AUT': 'attr_aut',
            'Inteligência': 'attr_int', 'Raciocínio': 'attr_rac', 'Perseverança': 'attr_prs',
            'Força': 'attr_for', 'Destreza': 'attr_des', 'Vigor': 'attr_vig',
            'Presença': 'attr_pre', 'Manipulação': 'attr_man', 'Autocontrole': 'attr_aut'
        };
        Object.assign(targetMap, attrEntries);

        // Valores Derivados
        window.DERIVED_VALUES.forEach(dv => {
            targetMap[dv.nome] = `DERIVED:${dv.key}`;
            targetMap[`DERIVED:${dv.key}`] = `DERIVED:${dv.key}`;
            targetMap[dv.id] = `DERIVED:${dv.key}`;
            // Variantes com (Atual) e (Máximo) para DVs com campoAtual
            if (dv.campoAtual) {
                targetMap[`${dv.nome} (Máximo)`] = `DERIVED:${dv.key}`;
            }
        });

        // Status Vitais
        if (window.VITAL_STATS) {
            window.VITAL_STATS.forEach(vs => {
                targetMap[`${vs.nome} Máxima`] = `DERIVED:${vs.key}`;
                targetMap[`${vs.nome} Máximo`] = `DERIVED:${vs.key}`;
            });
        }

        // Helper: dado um field resolvido (DERIVED:key), encontra o DV e aplica
        // Replica applyMechanicToSheet (tipo=modificar) do mechanics-engine.js
        const applyCalcToDV = (calc, field) => {
            if (!field || !field.startsWith('DERIVED:')) return;
            const dvKey = field.replace('DERIVED:', '');
            const targetDv = window.DERIVED_VALUES.find(d => d.key === dvKey);
            if (!targetDv) return;
            const val = resolveCalcValue(calc);
            const op = calc.operacao || '+';
            if (op === '+') results[targetDv.id] += val;
            else if (op === '-') results[targetDv.id] -= val;
            else if (op === 'set' || op === '=') results[targetDv.id] = val;
            else if (op === '*' || op === '×') results[targetDv.id] *= val;
            else if (op === '/' || op === '÷') results[targetDv.id] = val !== 0 ? results[targetDv.id] / val : 0;
        };

        // Helper: aplicar uma mecânica completa (tipo modificar com calculos)
        // Suporta novo formato multi-calc E formato legacy de calc único
        const applyMechanic = (mech) => {
            if (!mech || mech.tipo !== 'modificar' || !mech.config) return;
            // Verificar condições — só aplica permanentes e sem condição
            const isConditional = mech.condicaoAplicacao && mech.condicaoAplicacao.trim() !== '';
            const isPermanent = !mech.duracao || mech.duracao === 'permanente';
            if (!isPermanent || isConditional) return;

            const calculos = Array.isArray(mech.config.calculos) ? mech.config.calculos
                : mech.config.alvo ? [{ alvo: mech.config.alvo, operacao: mech.config.operacao, valor: mech.config.valor, valorTipo: mech.config.valorTipo || 'fixo', valorRef: mech.config.valorRef, valorMultiplicador: mech.config.valorMultiplicador, equacao: mech.config.equacao }]
                : [];
            calculos.forEach(calc => {
                // Ignorar mecânicas de EXP (não afetam DVs)
                if (calc.alvo === 'EXP') return;
                const alvos = Array.isArray(calc.alvo) ? calc.alvo : [calc.alvo];
                alvos.forEach(alvo => {
                    if (!alvo) return;
                    const field = targetMap[alvo];
                    if (field) applyCalcToDV(calc, field);
                });
            });
        };

        // 2a. Mecânicas vinculadas diretamente aos DVs (via dv.mecanicaIds)
        // Usa o mesmo applyMechanic para consistência total com o motor da ficha
        const processedMechIds = new Set();

        window.DERIVED_VALUES.forEach(dv => {
            if (dv.mecanicaIds && dv.mecanicaIds.length > 0) {
                dv.mecanicaIds.forEach(mechId => {
                    if (processedMechIds.has(mechId)) return;
                    processedMechIds.add(mechId);
                    const mech = window._systemData.mechanics.find(m => m.id === mechId);
                    if (mech) applyMechanic(mech);
                });
            }
        });

        // 3. Aplicar mecânicas de peculiaridades (Raça, Classe, Tribo, Individuais)
        // que tenham alvo em valores derivados
        const applyPecMechanics = (pecIds) => {
            if (!pecIds || pecIds.length === 0) return;
            pecIds.forEach(pecIdEntry => {
                const pecId = typeof pecIdEntry === 'object' ? pecIdEntry.id : pecIdEntry;
                const pec = window._systemData.peculiarities.find(p => p.id === pecId);
                if (!pec || !pec.mecanicaIds || pec.mecanicaIds.length === 0) return;
                pec.mecanicaIds.forEach(mechId => {
                    if (processedMechIds.has(mechId)) return;
                    processedMechIds.add(mechId);
                    const mech = window._systemData.mechanics.find(m => m.id === mechId);
                    applyMechanic(mech);
                });
            });
        };

        // Raça: peculiaridadeIds
        if (raca && raca.peculiaridadeIds) applyPecMechanics(raca.peculiaridadeIds);
        // Classe: peculiaridadeIds + bonusIniciais
        if (classe) {
            if (classe.peculiaridadeIds) applyPecMechanics(classe.peculiaridadeIds);
            if (classe.bonusIniciais) applyPecMechanics(classe.bonusIniciais);
        }
        // Tribo: peculiaridadeIds
        if (tribo && tribo.peculiaridadeIds) applyPecMechanics(tribo.peculiaridadeIds);
        // Individuais selecionadas pelo jogador
        if (state.peculiaridadesIndividuais && state.peculiaridadesIndividuais.length > 0) {
            applyPecMechanics(state.peculiaridadesIndividuais.map(p => p.id));
        }

        // 4. Aplicar mecânicas vinculadas a perícias que afetam DVs
        if (window.SKILLS) {
            for (const [cat, skills] of Object.entries(window.SKILLS)) {
                for (const sk of skills) {
                    if (!sk.mecanicaIds || sk.mecanicaIds.length === 0) continue;
                    sk.mecanicaIds.forEach(mechId => {
                        if (processedMechIds.has(mechId)) return;
                        processedMechIds.add(mechId);
                        const mech = window._systemData.mechanics.find(m => m.id === mechId);
                        applyMechanic(mech);
                    });
                }
            }
        }
    }

    // Aplicar as Constantes Iniciais de Raça/Classe/Tribo APÓS todas as mecânicas
    for (const key in initialConstants) {
        if (results[key] !== undefined) {
            results[key] += initialConstants[key];
        }
    }

    // Arredondar resultados para até 2 casas decimais (preserva flutuantes)
    for (const key in results) {
        results[key] = parseFloat(results[key].toFixed(2));
    }

    return results;
}

export function getDynamicCreationLimit(targetKey, defaultLimit, state) {
    if (!state || !window._systemData || !window._systemData.mechanics) return defaultLimit;

    let dynamicMax = defaultLimit;
    const processedMechIds = new Set();

    const applyMechForLimit = (mechId) => {
        if (processedMechIds.has(mechId)) return;
        processedMechIds.add(mechId);
        
        const mech = window._systemData.mechanics.find(m => m.id === mechId);
        if (!mech || mech.tipo !== 'limitar' || !mech.config) return;
        
        // Verifica se a mecânica se aplica na criação ou permanente
        const isCreation = mech.duracao === 'criacao' || mech.quandoAplica === 'na_criacao' || !mech.duracao || mech.duracao === 'permanente';
        const isConditional = mech.condicaoAplicacao && mech.condicaoAplicacao.trim() !== '';
        if (!isCreation || isConditional) return;

        const calculos = Array.isArray(mech.config.calculos) ? mech.config.calculos 
            : mech.config.alvo ? [mech.config] 
            : [];
            
        calculos.forEach(calc => {
            if (calc.tipoLimite !== 'maximo') return;
            
            const alvos = Array.isArray(calc.alvo) ? calc.alvo : [calc.alvo];
            if (alvos.includes(targetKey)) {
                // Suporte para o novo formato de equações, caso seja um valor fixo
                let rawValor = null;
                if (Array.isArray(calc.equacao) && calc.equacao.length > 0 && calc.equacao[0].tipo === 'fixo') {
                    rawValor = calc.equacao[0].valor;
                } else {
                    rawValor = (calc.valor !== undefined && calc.valor !== "") ? calc.valor : calc.valorMaximo;
                }
                
                const valor = rawValor !== undefined && rawValor !== null ? Number(rawValor) : null;
                if (valor !== null && !isNaN(valor) && valor > dynamicMax) {
                    dynamicMax = valor;
                }
            }
        });
    };

    const applyPecMechanicsForLimit = (pecIds) => {
        if (!pecIds || pecIds.length === 0) return;
        pecIds.forEach(pecIdEntry => {
            const pecId = typeof pecIdEntry === 'object' ? pecIdEntry.id : pecIdEntry;
            const pec = window._systemData.peculiarities.find(p => p.id === pecId);
            if (pec) {
                if (pec.mecanicaIds) pec.mecanicaIds.forEach(applyMechForLimit);
                if (pec.mecanicaExpCriacao) pec.mecanicaExpCriacao.forEach(applyMechForLimit);
            }
        });
    };

    const raca = window._systemData.races?.find(r => r.nome === state.racaSelecionada);
    const classe = window._systemData.classes?.find(c => c.nome === state.classeSelecionada);
    const tribo = window._systemData.tribes?.find(t => t.nome === state.triboSelecionada);

    if (raca && raca.peculiaridadeIds) applyPecMechanicsForLimit(raca.peculiaridadeIds);
    if (classe) {
        if (classe.peculiaridadeIds) applyPecMechanicsForLimit(classe.peculiaridadeIds);
        if (classe.bonusIniciais) applyPecMechanicsForLimit(classe.bonusIniciais);
    }
    if (tribo && tribo.peculiaridadeIds) applyPecMechanicsForLimit(tribo.peculiaridadeIds);
    
    if (state.peculiaridadesIndividuais && state.peculiaridadesIndividuais.length > 0) {
        applyPecMechanicsForLimit(state.peculiaridadesIndividuais.map(p => p.id));
    }

    return dynamicMax;
}
