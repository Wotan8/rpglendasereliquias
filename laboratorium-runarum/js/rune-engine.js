/* =====================================================================
   ᛟ RUNE ENGINE — Auditoria de circuitos rúnicos (puro, sem DOM)
   ---------------------------------------------------------------------
   Recebe o estado do canvas (nós + ligações) e o catálogo de elementos
   vindo do Firestore e devolve a auditoria completa do projeto:
   CT, Alvo do Teste de Construção, gravação (tempo/custo), dimensiona-
   mento de armazenamento/exaustão, confluências e violações das Regras
   de Posição (§6.3). Nenhum dado de elemento é fixo no código — tudo
   deriva do cadastro dinâmico + flags de engine.
   ===================================================================== */

const RuneEngine = (() => {

    const norm = (s) => String(s || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    const hasFlag = (el, f) => Array.isArray(el?.flags) && el.flags.map(norm).includes(f);
    const isTipo = (el, t) => norm(el?.tipoElemento) === t;
    const isCat = (el, c) => norm(el?.categoria) === c;

    /** Dados do nível escolhido de um elemento (fallback: último nível registrado). */
    function nivelData(el, nv) {
        const ns = Array.isArray(el?.niveis) ? el.niveis : [];
        return ns.find(n => Number(n.nivel) === Number(nv)) || ns[ns.length - 1] || null;
    }

    function custoEss(el, nv) {
        const nd = nivelData(el, nv);
        return nd ? Number(nd.custoEss || 0) : 0;
    }

    // ---------- Grafo ----------
    function buildGraph(nodes, links) {
        const inn = {}, out = {};
        nodes.forEach(n => { inn[n.id] = []; out[n.id] = []; });
        links.forEach(l => {
            if (out[l.a.nodeId]) out[l.a.nodeId].push(l);
            if (inn[l.b.nodeId]) inn[l.b.nodeId].push(l);
        });
        return { inn, out };
    }

    /** Componentes conexos (ligações tratadas como não-direcionadas). */
    function connectedComponents(nodes, links) {
        const adj = {}; nodes.forEach(n => adj[n.id] = new Set());
        links.forEach(l => { adj[l.a.nodeId]?.add(l.b.nodeId); adj[l.b.nodeId]?.add(l.a.nodeId); });
        const seen = new Set(); const comps = [];
        nodes.forEach(n => {
            if (seen.has(n.id)) return;
            const comp = []; const stack = [n.id];
            while (stack.length) {
                const id = stack.pop();
                if (seen.has(id)) continue;
                seen.add(id); comp.push(id);
                adj[id]?.forEach(v => { if (!seen.has(v)) stack.push(v); });
            }
            comps.push(comp);
        });
        return comps;
    }

    // ---------- Confluência: casar Aspectus presentes com as receitas ----------
    function detectConfluencias(aspNodes, elementsById, tabelas) {
        const receitas = tabelas?.confluencias || [];
        const nomes = aspNodes.map(n => ({ node: n, nome: norm(elementsById[n.elementId]?.nome) }));
        const found = [];
        for (let i = 0; i < nomes.length; i++) {
            for (let j = i + 1; j < nomes.length; j++) {
                const a = nomes[i], b = nomes[j];
                const rec = receitas.find(r =>
                    (norm(r.a) === a.nome && norm(r.b) === b.nome) ||
                    (norm(r.a) === b.nome && norm(r.b) === a.nome));
                if (rec) found.push({ rec, nvA: Number(a.node.nivel), nvB: Number(b.node.nivel), nomeA: a.nome, nomeB: b.nome });
            }
        }
        return found;
    }

    // ---------- Auditoria principal ----------
    /**
     * @param {Object} p
     * @param {Array}  p.nodes  [{id, elementId, nivel, x, y}]
     * @param {Array}  p.links  [{id, a:{nodeId,pt}, b:{nodeId,pt}}]
     * @param {Object} p.elementsById  catálogo Firestore
     * @param {Object} p.char   {baseAttr, runomancia, gravacao, eficiencia, aprendidos:{elId:nv}}
     * @param {Object} p.tabelas  RUNO_TABELAS (confluências, complexidade…)
     */
    function audit({ nodes = [], links = [], elementsById = {}, char = {}, tabelas = {} }) {
        const issues = [];  // {tipo:'erro'|'aviso'|'info', msg}
        const err = m => issues.push({ tipo: 'erro', msg: m });
        const warn = m => issues.push({ tipo: 'aviso', msg: m });
        const info = m => issues.push({ tipo: 'info', msg: m });

        const withEl = nodes.map(n => ({ ...n, el: elementsById[n.elementId] })).filter(n => n.el);
        const { inn, out } = buildGraph(nodes, links);

        // ---- CT e breakdown ----
        let ct = 0;
        const breakdown = withEl.map(n => {
            const c = custoEss(n.el, n.nivel);
            ct += c;
            return { nodeId: n.id, nome: n.el.nome, tipo: n.el.tipoElemento, nivel: Number(n.nivel), custo: c, elo: hasFlag(n.el, 'elo') };
        });

        const artusN = withEl.filter(n => isTipo(n.el, 'artus'));
        const aspN = withEl.filter(n => isTipo(n.el, 'aspectus'));
        const sigN = withEl.filter(n => isTipo(n.el, 'sigilus'));

        // ---- Natureza da runa ----
        const plena = artusN.length >= 1 && aspN.length >= 1;
        let natureza = 'vazia';
        if (withEl.length === 0) natureza = 'vazia';
        else if (plena) natureza = 'plena';
        else if (artusN.length === 0 && aspN.length === 0) natureza = 'auxiliar';
        else natureza = 'incompleta';

        if (natureza === 'incompleta') {
            if (artusN.length && !aspN.length) err('Núcleo incompleto: há Artus sem Aspectus — o verbo não tem combustível (Parte I).');
            if (aspN.length && !artusN.length) err('Núcleo incompleto: há Aspectus sem Artus — energia com natureza, mas sem ação.');
        }
        if (natureza === 'auxiliar' && withEl.length) info('Runa Auxiliar (sem Núcleo): sente, decide, armazena ou retransmite — típica de Cadeias Rúnicas (Parte IX).');
        if (artusN.length > 1) warn('Mais de um Artus no mesmo circuito: cada Núcleo executa um verbo — confirme se é uma runa composta intencional.');

        // ---- Fonte de captação ----
        const captadores = sigN.filter(n => isCat(n.el, 'captador'));
        const eloNodes = withEl.filter(n => hasFlag(n.el, 'elo'));
        if (withEl.length && !captadores.length && !eloNodes.length) {
            warn('Sem Captador (nem Elo receptor): a runa depende de inserção manual de Essência (§2.2).');
        }

        // ---- Regras de Posição (§6.3) via grafo ----
        withEl.forEach(n => {
            if (isCat(n.el, 'captador') && inn[n.id]?.length) {
                err(`"${n.el.nome}" é Captador e deve ficar no INÍCIO do circuito — remova as ligações que chegam nele.`);
            }
            const ehSaidaFinal = isCat(n.el, 'emissor') || hasFlag(n.el, 'infusor');
            if (ehSaidaFinal && !hasFlag(n.el, 'elo') && out[n.id]?.length) {
                err(`"${n.el.nome}" ocupa a POSIÇÃO FINAL do ramo (§6.3) — nada pode sair dele.`);
            }
        });

        // ---- Pareamentos obrigatórios ----
        const tem = f => withEl.some(n => hasFlag(n.el, f));
        const reconhecedores = withEl.filter(n => hasFlag(n.el, 'reconhecedor'));
        if (reconhecedores.length && !tem('memoria')) {
            err('Reconhecedor sem Memória acoplada: "reconhece exatamente ninguém" (§6.6). Pareamento é obrigatório, sem exceção.');
        }
        withEl.filter(n => hasFlag(n.el, 'amplificador')).forEach(n => {
            if (Number(n.nivel) >= 3 && !tem('estabilizador')) {
                err(`"${n.el.nome}" Nv3 exige Estabilizador no mesmo ramo (§6.3).`);
            } else if (Number(n.nivel) === 2 && !tem('estabilizador')) {
                warn(`"${n.el.nome}" Nv2: Estabilizador é recomendado.`);
            }
        });
        withEl.filter(n => hasFlag(n.el, 'amp_captacao')).forEach(n => {
            if (!tem('sifao_cristalino')) err(`"${n.el.nome}" acopla-se a um Sifão Cristalino — inclua-o no conjunto de captação.`);
        });

        // ---- Confluências ----
        const confluNodes = withEl.filter(n => hasFlag(n.el, 'confluencia'));
        let redutorConflu = 0;
        const confluDetect = [];
        if (confluNodes.length) {
            if (aspN.length < 2) err('Confluência exige DOIS Aspectus dominados alimentando o componente (§4.5).');
            if (confluNodes.length >= 2) {
                const harmoOk = withEl.some(n => hasFlag(n.el, 'harmonizador') && Number(n.nivel) >= 2);
                if (!harmoOk) err('Duas ou mais Confluências no mesmo circuito exigem Harmonizador Nv2+ (§6.3).');
            }
            detectConfluencias(aspN, elementsById, tabelas).forEach(({ rec, nvA, nvB, nomeA, nomeB }) => {
                confluDetect.push(rec);
                const nvConflu = Math.max(...confluNodes.map(c => Number(c.nivel)));
                if (rec.classe !== 'fisica' && nvConflu < 2) {
                    err(`Receita ${rec.classe.toUpperCase()} ("${rec.elemento}") em Confluência Nv1 = falha automática (§4.5).`);
                }
                if (rec.classe === 'proibida') {
                    warn(`⚠️ COMBINAÇÃO PROIBIDA: ${rec.elemento} (${nomeA} + ${nomeB}) — consequência: ${rec.consequencia || 'crime'} (Parte XII).`);
                }
                let red = Number(rec.redutor || 0);
                if (red < 0) {
                    // Harmonizador reduz o Redutor de Proibidas: −1 Nv2 / −2 Nv3
                    const h = withEl.filter(n => hasFlag(n.el, 'harmonizador')).map(n => Number(n.nivel));
                    const hMax = h.length ? Math.max(...h) : 0;
                    if (rec.classe === 'proibida' && hMax >= 2) red = Math.min(0, red + (hMax - 1));
                    redutorConflu += red;
                }
                info(`Confluência detectada: ${nomeA} + ${nomeB} → ${rec.elemento} (grau exigido: ${rec.grau}${rec.redutor ? `; redutor ${rec.redutor}` : ''}).`);
                if (nvA === nvB && /MAIOR/i.test(rec.grau) && !/IGUAL/i.test(rec.grau)) {
                    warn(`"${rec.elemento}" exige Grau com um Aspectus MAIOR — os dois estão em nível igual (${nvA}). Ajuste níveis ou use um Atenuador (+2 Ess no Nv1).`);
                }
            });
            if (!confluDetect.length && aspN.length >= 2) {
                info('Combinação de Aspectus fora das receitas catalogadas — trate como pesquisa original (a critério do Mestre).');
            }
        }

        // ---- Armazenamento vs CT / Regime Contínuo (§2.6–2.7) ----
        const armazenadores = withEl.filter(n => isCat(n.el, 'armazenador') || hasFlag(n.el, 'armazenador'));
        const capTotal = armazenadores.reduce((s, n) => s + Number(nivelData(n.el, n.nivel)?.capacidade || 0), 0);
        const taxaContinua = captadores.reduce((s, n) => {
            const nd = nivelData(n.el, n.nivel);
            return s + (hasFlag(n.el, 'captador_continuo') ? Number(nd?.taxa || 0) : 0);
        }, 0);
        const nvAspMax = aspN.length ? Math.max(...aspN.map(n => Number(n.nivel))) : 0;
        const regimeContinuoOk = nvAspMax > 0 && taxaContinua >= 2 * nvAspMax;

        if (natureza === 'plena' && capTotal > 0 && capTotal < ct) {
            warn(`Armazenamento (${capTotal} Ess) menor que o CT (${ct} Ess): a runa nunca sai da Subcarga por conta própria (§2.8).`);
        }
        if (natureza === 'plena' && !armazenadores.length && !regimeContinuoOk) {
            warn('Sem Armazenador: só funciona em Regime Contínuo (captação ≥ 2 × nível do Aspectus) ou com inserção instantânea completa (§2.5).');
        }
        if (regimeContinuoOk) info(`Regime Contínuo viável: captação ${taxaContinua} Ess/h ≥ ${2 * nvAspMax} Ess/h (2 × Aspectus Nv${nvAspMax}) — apenas para efeitos estáticos e não-adversos.`);

        // ---- Exaustão (§2.10) ----
        const exaustores = withEl.filter(n => isCat(n.el, 'exaustor') || hasFlag(n.el, 'exaustor'));
        if (natureza === 'plena' && !exaustores.length) {
            warn('Sem Exaustor: "uma runa sem Exaustor não é uma runa — é uma aposta" (§2.10). Todo excedente vira Sobrecarga (§2.9).');
        }
        const capExaust = exaustores.reduce((s, n) => s + Number(nivelData(n.el, n.nivel)?.capacidade || 0), 0);

        // ---- Lei do Circuito: nós soltos / componentes separados ----
        if (withEl.length > 1) {
            const comps = connectedComponents(nodes, links);
            if (comps.length > 1) {
                const soltos = comps.filter(c => c.length === 1).length;
                if (soltos) warn(`${soltos} elemento(s) sem nenhuma ligação — circuito interrompido = runa morta (Lei do Circuito).`);
                if (comps.filter(c => c.length > 1).length > 1) warn('O desenho contém sub-circuitos separados. Se são runas distintas de uma Cadeia, ligue-as por Elos (Parte IX).');
            }
        }

        // ---- Elo / Cadeias (Parte IX) ----
        if (eloNodes.length) {
            info(`Elo presente (custo listado é POR METADE): a metade gêmea deve ser gravada na outra runa, na mesma sessão. Laços A→B→A são proibidos (§9.6).`);
            const harmoNv = withEl.filter(n => hasFlag(n.el, 'harmonizador')).map(n => Number(n.nivel));
            const limite = 2 + (harmoNv.length ? Math.max(...harmoNv) : 0);
            info(`Limite de runas nesta cadeia: ${limite} (base 2 + Harmonizador; §9.5).`);
        }

        // ---- Ética (Parte XII) ----
        withEl.forEach(n => {
            if (hasFlag(n.el, 'sifao_vital')) warn(`⚠️ "${n.el.nome}" é PROIBIDO pelo Protocolo de Valdris — uso em pessoas equivale a agressão (Parte XII).`);
            else if (hasFlag(n.el, 'proibido')) warn(`⚠️ "${n.el.nome}" tem uso restrito/proibido — verifique a Parte XII.`);
            if (hasFlag(n.el, 'infusor')) info('Infusor presente: lembre o Protocolo de Valdris — nunca mais de 3 Ess em ser vivo sem supervisão de um Mestre Runomante.');
        });

        // ---- Teste de Construção (§6.2) ----
        const nvArtus = artusN.length ? Math.max(...artusN.map(n => Number(n.nivel))) : 0;
        const menorSig = sigN.length ? Math.min(...sigN.map(n => Number(n.nivel))) : 0;
        const baseAttr = Number(char.baseAttr || 0);
        const runom = Number(char.runomancia || 0);
        const alvo = (natureza === 'plena')
            ? baseAttr + runom + nvArtus + nvAspMax + menorSig + redutorConflu
            : (withEl.length ? baseAttr + runom + menorSig + redutorConflu : 0);

        // ---- Gravação (§6.4) ----
        const gravNv = Number(char.gravacao || 0);
        const fatorTempo = Math.max(0.30, 1 - 0.10 * gravNv);
        const horas = ct > 0 ? (ct / 5) * fatorTempo : 0;
        const comps = sigN.map(n => norm(n.el.complexidade));
        const multMaterial = comps.includes('mestre') ? 3 : comps.includes('avancado') ? 2 : 1;
        const material = ct * 2 * multMaterial;

        // ---- Aprendizado: pode salvar? ----
        const aprendidos = char.aprendidos || {};
        const naoAprendidos = withEl
            .filter(n => Number(aprendidos[n.elementId] || 0) < Number(n.nivel))
            .map(n => ({ nodeId: n.id, nome: n.el.nome, nivel: Number(n.nivel), dominado: Number(aprendidos[n.elementId] || 0) }));

        return {
            ct, breakdown, natureza, alvo, redutorConflu, confluencias: confluDetect,
            gravacao: { horas, material, multMaterial, fatorTempo },
            armazenamento: { capacidade: capTotal, suficiente: capTotal >= ct, regimeContinuoOk, taxaContinua },
            exaustao: { capacidade: capExaust, presente: exaustores.length > 0 },
            issues,
            naoAprendidos,
            podeSalvar: withEl.length > 0 && naoAprendidos.length === 0 && natureza !== 'vazia',
        };
    }

    /** Faixa de Subcarga para uma % de carga (§2.8). */
    function subcarga(pct, tabelas) {
        return (tabelas?.subcarga || []).find(r => pct >= r.min) || null;
    }
    /** Consequência de Sobrecarga para um excedente (§2.9). */
    function sobrecarga(exc, tabelas) {
        return (tabelas?.sobrecarga || []).find(r => exc >= r.min && exc <= r.max) || null;
    }

    return { audit, subcarga, sobrecarga, nivelData, custoEss, norm };
})();

if (typeof window !== 'undefined') window.RuneEngine = RuneEngine;
