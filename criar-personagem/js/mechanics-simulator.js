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
    
    // Nível efetivo = base + pontos iniciais + níveis comprados com EXP na criação.
    // O comprado com EXP pesa nos derivados igual ao que veio da pool de pontos.
    const baseInicial = window.REGRAS_CRIACAO?.atributos?.base_inicial || 1;
    /* O bônus que a peculiaridade põe no atributo/perícia entra aqui pelo mesmo
       motivo que o EXP entra: a ficha soma dots + mechanicBonuses antes de
       resolver qualquer fórmula. Sem isso o +1 Vigor da classe não engorda a
       Vitalidade na prévia, mas engorda depois, na ficha. */
    const bonusMec = (typeof window.bonusDeMecanicas === 'function') ? window.bonusDeMecanicas() : {};
    ['attr_int', 'attr_rac', 'attr_prs', 'attr_for', 'attr_des', 'attr_vig', 'attr_pre', 'attr_man', 'attr_aut'].forEach(attr => {
        baseStats[attr] = (baseStats[attr] || 0) + (state.atributosExp?.[attr] || 0) + baseInicial + (bonusMec[attr] || 0);
    });

    /** Nível da perícia somando ponto inicial, nível comprado com EXP e bônus de mecânica. */
    const nivelPericia = (dotKey) => (state.pericias?.[dotKey] || 0) + (state.periciasExp?.[dotKey] || 0) + (bonusMec[dotKey] || 0);

    // 1. Iniciar com os Valores Iniciais definidos pela Raça, Classe e Tribo
    const raca = window._systemData?.races?.find(r => r.nome === state.racaSelecionada);
    const classe = window._systemData?.classes?.find(c => c.nome === state.classeSelecionada);
    const tribo = window._systemData?.tribes?.find(t => t.nome === state.triboSelecionada);

    // Valores iniciais de VDs trazidos por peculiaridade (de qualquer fonte)
    const pecInitials = {};
    const coletarPecInitials = (pecIds) => {
        (pecIds || []).forEach(entry => {
            const pecId = typeof entry === 'object' && entry !== null ? entry.id : entry;
            const pec = (window._systemData?.peculiarities || []).find(p => p.id === pecId);
            (pec?.derivedValueIds || []).forEach(x => {
                if (typeof x !== 'object' || x === null) return;
                pecInitials[x.id] = (pecInitials[x.id] || 0) + (parseFloat(x.valorInicial) || 0);
            });
        });
    };
    coletarPecInitials(raca?.peculiaridadeIds);
    coletarPecInitials(classe?.peculiaridadeIds);
    coletarPecInitials(classe?.bonusIniciais);
    coletarPecInitials(tribo?.peculiaridadeIds);
    coletarPecInitials(state.peculiaridadesIndividuais);

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
        // A ficha já conta o valorInicial de VD trazido por peculiaridade
        // (pecDVInitials em renderDerivedValuesGrid); aqui também, senão wizard e
        // ficha divergem no dia em que uma peculiaridade trouxer um VD com valor ≠ 0.
        initialConstants[dv.id] += (pecInitials[dv.id] || 0);
    });

    // A constante de Raça/Classe/Tribo é a BASE do valor derivado — as mecânicas
    // incidem sobre ela, não depois dela (senão "×1,1 na Altura" multiplica zero).
    for (const id in initialConstants) results[id] = initialConstants[id];

    /* Snapshot da passada anterior. Refs a OUTRO valor derivado leem daqui, não de
       `results`, replicando a ficha (onde `[Altura]` resolve pelo state.derived da
       recalculada anterior). Sem isso, `Peso = (18+FOR+VIG) × [Altura]²` lê Altura
       antes de a constante da raça e o ×% do Gigantismo entrarem — e sai zerado. */
    let snapshot = {};

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
        
        // Perícia com prefixo explícito ("Perícia: X") — resolve ANTES dos VDs,
        // porque o prefixo existe justamente para desambiguar nomes que existem
        // nos dois lados (Exorcismo, Transcendência, Dosagem, Contracanto...).
        if (ref.startsWith('Perícia: ')) {
            const nome = ref.slice('Perícia: '.length);
            for (const skills of Object.values(window.SKILLS || {})) {
                const found = skills.find(s => s.name === nome);
                if (found) return nivelPericia(`sk_${found.key}`);
            }
            return 0;
        }

        // Referência a outro Valor Derivado (por key, id ou DERIVED:key)
        const targetDv = window.DERIVED_VALUES.find(d => d.key === ref || d.id === ref || `DERIVED:${d.key}` === ref);
        if (targetDv && snapshot[targetDv.id] !== undefined) {
            return snapshot[targetDv.id];
        }

        // Referência a DV pelo nome legível (como no TARGET_MAP)
        const dvByName = window.DERIVED_VALUES.find(d => d.nome === ref);
        if (dvByName && snapshot[dvByName.id] !== undefined) {
            return snapshot[dvByName.id];
        }

        // Perícias — buscar no wizardState (sk_<key>)
        if (ref.startsWith('sk_')) {
            return nivelPericia(ref);
        }
        // Perícia por nome legível
        if (window.SKILLS) {
            for (const [cat, skills] of Object.entries(window.SKILLS)) {
                const found = skills.find(s => s.name === ref);
                if (found) {
                    return nivelPericia(`sk_${found.key}`);
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

        // Limites (tipo=limitar) coletados durante a passada e aplicados no fim dela,
        // como faz _applyMechanicModifiers na ficha — um teto/piso não pode clampar
        // no meio da soma, senão um modificador posterior fura o limite.
        let limites = {};
        const collectLimite = (calc) => {
            const field = targetMap[calc.alvo];
            if (!field || !field.startsWith('DERIVED:')) return;
            const dv = window.DERIVED_VALUES.find(d => d.key === field.replace('DERIVED:', ''));
            if (!dv) return;
            const val = resolveCalcValue(calc);
            const lim = limites[dv.id] || (limites[dv.id] = {});
            if (calc.tipoLimite === 'bloqueio') lim.bloqueio = true;
            else if (calc.tipoLimite === 'minimo') lim.min = lim.min === undefined ? val : Math.max(lim.min, val);
            else if (calc.tipoLimite === 'maximo') lim.max = lim.max === undefined ? val : Math.min(lim.max, val);
            else if (calc.tipoLimite === 'clamp') {
                const min = parseFloat(calc.valorMinimo) || 0;
                lim.max = lim.max === undefined ? val : Math.min(lim.max, val);
                lim.min = lim.min === undefined ? min : Math.max(lim.min, min);
            }
        };

        // Helper: aplicar uma mecânica completa
        const applyMechanic = (mech) => {
            if (!mech || !mech.config) return;
            // Verificar condições — só aplica permanentes e sem condição
            const isConditional = mech.condicaoAplicacao && mech.condicaoAplicacao.trim() !== '';
            const isPermanent = !mech.duracao || mech.duracao === 'permanente';
            // Distribuir vale na criação também — é a mesma regra da ficha
            // (applyMechanicToSheet: isCreation || isPermanent).
            const valeAqui = isPermanent || (mech.tipo === 'distribuir' && mech.duracao === 'criacao');
            if (!valeAqui || isConditional) return;

            if (mech.tipo === 'limitar') {
                (mech.config.calculos || []).forEach(collectLimite);
            } else if (mech.tipo === 'modificar') {
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
            } else if (mech.tipo === 'distribuir') {
                // Alvo escolhido na etapa de Peculiaridades. Só alvo de Valor
                // Derivado aparece aqui — bônus de mecânica em atributo o wizard
                // já não simula (nem para 'modificar').
                const alvos = (state.distribuicoes || {})[mech.id] || [];
                alvos.forEach(alvo => {
                    const field = targetMap[alvo.nome];
                    if (field) applyCalcToDV({ valor: alvo.valor, operacao: mech.config.operacao || '+' }, field);
                });
            } else if (mech.tipo === 'condicional') {
                const config = mech.config;
                const condicaoMecanica = config.condicaoMecanica || false;
                if (condicaoMecanica && config.condicaoMecanicaIds && config.condicaoMecanicaIds.length > 0) {
                    let allTrue = true;
                    for (const boolId of config.condicaoMecanicaIds) {
                        const boolMech = window._systemData?.mechanics?.find(m => m.id === boolId);
                        if (boolMech && boolMech.tipo === 'booleano') {
                            let res = false;
                            if (boolMech.config.modoVerificacao === 'classe') {
                                // Verificação de Classe: verdadeiro se o personagem tiver TODAS as classes exigidas
                                const reqs = (Array.isArray(boolMech.config.classesReq) ? boolMech.config.classesReq : []).filter(Boolean);
                                const have = state.classeSelecionada ? [String(state.classeSelecionada).trim().toLowerCase()] : [];
                                res = reqs.length > 0 && reqs.every(c => have.includes(String(c).trim().toLowerCase()));
                            } else {
                                const eqA = Array.isArray(boolMech.config.equacaoA) ? boolMech.config.equacaoA : [];
                                const eqB = Array.isArray(boolMech.config.equacaoB) ? boolMech.config.equacaoB : [];
                                const valA = resolveEquation(eqA);
                                const valB = resolveEquation(eqB);
                                const op = boolMech.config.operadorComparacao || '>=';
                                if (op === '==') res = valA === valB;
                                else if (op === '!=') res = valA !== valB;
                                else if (op === '>') res = valA > valB;
                                else if (op === '>=') res = valA >= valB;
                                else if (op === '<') res = valA < valB;
                                else if (op === '<=') res = valA <= valB;
                            }

                            if (!res) allTrue = false;
                        } else {
                            allTrue = false;
                        }
                    }
                    const targetIds = allTrue ? (config.efeitoSucessoIds || []) : (config.efeitoFalhaIds || []);
                    for (const targetId of targetIds) {
                        const targetMech = window._systemData?.mechanics?.find(m => m.id === targetId);
                        if (targetMech) applyMechanic(targetMech);
                    }
                }
            }
        };

        // Nível escolhido de uma peculiaridade (individual selecionada no wizard ou
        // herdada e evoluída). Mecânicas evoluíveis rendem o valor DAQUELE nível.
        const nivelDaPec = (pecId, entry) => {
            const ind = (state.peculiaridadesIndividuais || []).find(p => p.id === pecId);
            if (ind && ind.nivel) return ind.nivel;
            const herdado = (state.niveisPeculiaridadesHerdadas || {})[pecId];
            if (herdado) return herdado;
            return (entry && typeof entry === 'object' && entry.nivelInicial) || 1;
        };

        const applyPecMechanics = (pecIds, processed) => {
            if (!pecIds || pecIds.length === 0) return;
            pecIds.forEach(pecIdEntry => {
                const pecId = typeof pecIdEntry === 'object' ? pecIdEntry.id : pecIdEntry;
                const pec = window._systemData.peculiarities.find(p => p.id === pecId);
                if (!pec || !pec.mecanicaIds || pec.mecanicaIds.length === 0) return;
                const nivel = nivelDaPec(pecId, pecIdEntry);
                pec.mecanicaIds.forEach(mechId => {
                    if (processed.has(mechId)) return;
                    processed.add(mechId);
                    let mech = window._systemData.mechanics.find(m => m.id === mechId);
                    if (mech && mech.evoluivel && typeof window._adjustMechanicForLevel === 'function') {
                        mech = window._adjustMechanicForLevel(mech, nivel);
                    }
                    applyMechanic(mech);
                });
            });
        };

        /* Uma passada resolve tudo do zero. São necessárias várias porque as fórmulas
           encadeiam (Altura → Tamanho/Peso → Vitalidade/Carga/Deslocamento) e cada
           passada só enxerga o snapshot da anterior. 4 cobrem a cadeia mais longa. */
        const runPass = () => {
            for (const id in initialConstants) results[id] = initialConstants[id];
            const processed = new Set();
            limites = {};

            // 2a. Mecânicas vinculadas diretamente aos DVs (via dv.mecanicaIds)
            window.DERIVED_VALUES.forEach(dv => {
                (dv.mecanicaIds || []).forEach(mechId => {
                    if (processed.has(mechId)) return;
                    processed.add(mechId);
                    const mech = window._systemData.mechanics.find(m => m.id === mechId);
                    if (mech) applyMechanic(mech);
                });
            });

            // 3. Peculiaridades (Raça, Classe, Tribo, Individuais)
            if (raca && raca.peculiaridadeIds) applyPecMechanics(raca.peculiaridadeIds, processed);
            if (classe) {
                if (classe.peculiaridadeIds) applyPecMechanics(classe.peculiaridadeIds, processed);
                if (classe.bonusIniciais) applyPecMechanics(classe.bonusIniciais, processed);
            }
            if (tribo && tribo.peculiaridadeIds) applyPecMechanics(tribo.peculiaridadeIds, processed);
            if (state.peculiaridadesIndividuais && state.peculiaridadesIndividuais.length > 0) {
                applyPecMechanics(state.peculiaridadesIndividuais.map(p => p.id), processed);
            }

            // 4. Mecânicas vinculadas a perícias que afetam DVs
            if (window.SKILLS) {
                for (const skills of Object.values(window.SKILLS)) {
                    for (const sk of skills) {
                        (sk.mecanicaIds || []).forEach(mechId => {
                            if (processed.has(mechId)) return;
                            processed.add(mechId);
                            const mech = window._systemData.mechanics.find(m => m.id === mechId);
                            applyMechanic(mech);
                        });
                    }
                }
            }

            // Limites por último, sobre o valor já somado
            for (const [dvId, lim] of Object.entries(limites)) {
                if (results[dvId] === undefined) continue;
                if (lim.bloqueio) { results[dvId] = 0; continue; }
                if (lim.max !== undefined) results[dvId] = Math.min(results[dvId], lim.max);
                if (lim.min !== undefined) results[dvId] = Math.max(results[dvId], lim.min);
            }
        };

        /* O snapshot que as refs leem carrega a Constante de Criação junto, como
           na ficha: lá `state.derived[key]` é mecânicas + derivedModifiers, e é
           dele que `[Altura]` sai quando o Peso é calculado. Sem somar aqui, subir
           a Altura na Véspera não engordava o Peso no wizard — mas engordava na
           ficha. `results` fica sem a constante: o slider a soma na exibição. */
        const mods = state.derivedModifiers || {};
        for (let pass = 0; pass < 4; pass++) {
            runPass();
            snapshot = {};
            for (const id in results) snapshot[id] = results[id] + (mods[id] || 0);
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
