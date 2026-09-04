// =============================================
// CENAS DE COMBATE — o doc `mesas/{id}/tabuleiro-meta/combate`
// ---------------------------------------------
// Uma mesa pode ter várias cenas armadas ao mesmo tempo (a emboscada da estrada,
// a briga da taverna), cada uma com a própria lista de participantes, turno e
// rodada. Só UMA fica aberta por vez.
//
// Formato:
//   { cenas: [{ id, nome, participantes, turnoAtual, rodada }], cenaAtiva,
//     participantes, turnoAtual, rodada }   ← ESPELHO da cena ativa
//
// O espelho não é redundância à toa: o painel de combate da FICHA lê
// `participantes` direto do doc para mostrar a iniciativa do jogador, e o mesmo
// vale para o HUD do tabuleiro. Sem ele, cada leitor precisaria conhecer cenas.
// A regra que segura os dois lados iguais: NINGUÉM escreve o doc na mão —
// todo write sai de `docDeCenas` (ou de quem chama ele).
//
// Doc antigo (só `participantes`) vira uma cena única, sem migração.
// =============================================

export const CENA_PADRAO = { id: 'cena-1', nome: 'Combate' };

export function novaCena(id, nome) {
    return { id, nome: nome || 'Nova cena', participantes: [], turnoAtual: 0, rodada: 1 };
}

/** Cenas do doc. Doc antigo (participantes soltos) = uma cena só. */
export function cenasDoDoc(c) {
    if (Array.isArray(c?.cenas) && c.cenas.length) return c.cenas;
    return [{
        ...CENA_PADRAO,
        participantes: c?.participantes || [],
        turnoAtual: c?.turnoAtual || 0,
        rodada: c?.rodada || 1,
    }];
}

/** A cena aberta agora. Cai na primeira quando o id salvo não existe mais. */
export function cenaAtiva(c) {
    const cs = cenasDoDoc(c);
    return cs.find(x => x.id === c?.cenaAtiva) || cs[0];
}

export function idCenaAtiva(c) { return cenaAtiva(c).id; }

/**
 * Doc completo a partir da lista de cenas — inclui o espelho da ativa.
 * É a ÚNICA porta de escrita: quem monta o doc por fora quebra o espelho.
 */
export function docDeCenas(cenas, ativaId) {
    const cs = (cenas || []).length ? cenas : [novaCena(CENA_PADRAO.id, CENA_PADRAO.nome)];
    const ativa = cs.find(x => x.id === ativaId) || cs[0];
    return {
        cenas: cs,
        cenaAtiva: ativa.id,
        participantes: ativa.participantes || [],
        turnoAtual: ativa.turnoAtual || 0,
        rodada: ativa.rodada || 1,
    };
}

/** Doc com a cena `id` alterada. */
export function comCena(c, id, patch) {
    return docDeCenas(cenasDoDoc(c).map(x => x.id === id ? { ...x, ...patch } : x), idCenaAtiva(c));
}

/** Doc com a cena ATIVA alterada — o caminho de todo dia. */
export function comCenaAtivaPatch(c, patch) {
    return comCena(c, idCenaAtiva(c), patch);
}

/** Doc com uma cena a mais, já aberta. */
export function comCenaNova(c, id, nome) {
    return docDeCenas([...cenasDoDoc(c), novaCena(id, nome)], id);
}

/** Doc sem a cena `id`. Tirar a última deixa uma cena vazia no lugar. */
export function semCena(c, id) {
    const cs = cenasDoDoc(c).filter(x => x.id !== id);
    return docDeCenas(cs, idCenaAtiva(c) === id ? cs[0]?.id : idCenaAtiva(c));
}

/** Doc com outra cena aberta. */
export function comTrocaDeCena(c, id) {
    return docDeCenas(cenasDoDoc(c), id);
}

// =============================================
// TURNO MECÂNICO (Livro §6.2)
// O turno tem 1 Ação Padrão + 1 Ação de Movimento; a Livre é incidental
// (não tem contador). "Ação Completa" consome as duas. A cena guarda:
//   iniciado: bool            — o mestre deu start (turno 1 só existe depois)
//   acoesTurno: {padrao, movimento} — o que o participante da vez ainda tem
// e cada participante ganha `faccao` (aliados|inimigos|neutros).
// =============================================

export const FACCOES = [
    ['aliados', '🟢 Aliados'],
    ['inimigos', '🔴 Inimigos'],
    ['neutros', '⚪ Neutros'],
];

/** Facção efetiva: a gravada, ou o palpite pelo tipo (jogador↔aliado, resto inimigo). */
export function faccaoDoParticipante(p) {
    if (p?.faccao) return p.faccao;
    return (p?.characterId || p?.type === 'Jogador') ? 'aliados' : 'inimigos';
}

/** Ações cheias de um turno recém-começado. */
export function acoesNovas() { return { padrao: true, movimento: true }; }

/** custoAcao: 'padrao' | 'movimento' | 'livre' | 'completa' (default padrao). */
export function podeGastar(acoes, custo) {
    const a = acoes || acoesNovas();
    if (custo === 'livre') return true;                    // incidental — não consome
    if (custo === 'movimento') return !!a.movimento;
    if (custo === 'completa') return !!a.padrao && !!a.movimento;
    return !!a.padrao;                                     // padrao (default)
}

/** Devolve o novo estado de ações após pagar `custo` (não muta o recebido). */
export function gastarAcao(acoes, custo) {
    const a = { ...(acoes || acoesNovas()) };
    if (custo === 'movimento') a.movimento = false;
    else if (custo === 'completa') { a.padrao = false; a.movimento = false; }
    else if (custo !== 'livre') a.padrao = false;
    return a;
}

/**
 * A skill com `afeta` pode atingir alguém da `faccaoAlvo`?
 * 'aliados' = mesma facção do agente (inclui ele mesmo);
 * 'inimigos' = facção diferente; 'todos'/ausente = qualquer um.
 */
export function alvoValido(afeta, minhaFaccao, faccaoAlvo) {
    if (!afeta || afeta === 'todos') return true;
    if (afeta === 'aliados') return minhaFaccao === faccaoAlvo;
    return minhaFaccao !== faccaoAlvo;
}

/**
 * Alcance do golpe corpo a corpo, em metros:
 * alcance da arma (cadastro; 0 quando não houver) + 5% do VD Tamanho,
 * nunca menor que 1 m. O raio conta a partir da BORDA do token.
 */
export function alcanceGolpe(alcanceArmaM, tamanhoVD) {
    const arma = Number(alcanceArmaM) || 0;
    const tam = Number(tamanhoVD) || 0;
    return Math.max(1, arma + tam * 0.05);
}

/** Participante da vez, na MESMA ordenação da janela (iniciativa desc). */
export function participanteDaVez(cena) {
    const parts = (cena?.participantes || []).slice().sort((a, b) => (b.initiative || 0) - (a.initiative || 0));
    if (!parts.length) return null;
    const turno = ((cena?.turnoAtual || 0) % parts.length + parts.length) % parts.length;
    return parts[turno];
}

/** Posição do participante na ordem de iniciativa (desc). −1 se não está na cena. */
export function indiceNaOrdem(cena, pid) {
    return (cena?.participantes || []).slice()
        .sort((a, b) => (b.initiative || 0) - (a.initiative || 0))
        .findIndex(p => p.id === pid);
}

/**
 * Turno GUARDADO (delay): guarda as duas ações e pode agir depois, antes de
 * qualquer outro turno — mas só DENTRO DA MESMA RODADA. Virou a rodada sem
 * usar? Perdeu (não acumula, e ninguém joga dois turnos seguidos).
 */
export function guardadoValido(cena, p) {
    if (p?.guardadoNaRodada == null) return false;
    return (cena?.rodada || 1) === p.guardadoNaRodada;
}

// ---- 💰 Custo vital das habilidades ("2 ENER", "1 Energia e 1 SAN") ----
// Os recursos são os vitalStats canônicos do sistema: Vitalidade, Energia,
// Sanidade. Texto sem par número+sigla não vira custo (nada é inventado).
const SIGLA_RECURSO = { ENER: 'ener', ENERGIA: 'ener', VIT: 'vit', VITALIDADE: 'vit', SAN: 'san', SANIDADE: 'san' };
export const RECURSO_NOME = { vit: 'Vitalidade', ener: 'Energia', san: 'Sanidade' };

/** "2 ENER + 1 SAN" → [{ recurso: 'ener', qtd: 2 }, { recurso: 'san', qtd: 1 }] */
export function custoVital(texto) {
    const out = [];
    for (const m of String(texto || '').matchAll(/(\d+(?:[.,]\d+)?)\s*(ENERGIA|ENER|VITALIDADE|VIT|SANIDADE|SAN)\b/gi)) {
        out.push({ recurso: SIGLA_RECURSO[m[2].toUpperCase()], qtd: parseFloat(m[1].replace(',', '.')) });
    }
    return out;
}

/**
 * Custo declarado por uma MECÂNICA de custo ("-1 ENER", "-2 Graça"): o
 * cadastro usa `modificar` com operação '-' sobre o recurso. O alvo pode ser
 * um Status Vital ("Energia Atual") OU um Valor Derivado ("Graça de Palla",
 * "Bolha de Sangue") — recurso de classe é VD com campo Atual.
 * @returns { rotulo, alvo, qtd } ou null quando não é uma mecânica de custo.
 */
export function custoDaMecanica(mech) {
    if (!mech || mech.tipo !== 'modificar') return null;
    const calc = (mech.config?.calculos || [])[0];
    if (!calc || calc.operacao !== '-') return null;
    const eq = (calc.equacao || [])[0];
    const qtd = Number(eq?.valor);
    if (!(qtd > 0) || !calc.alvo) return null;
    return { rotulo: mech.nome || `−${qtd} ${calc.alvo}`, alvo: String(calc.alvo), qtd };
}

/**
 * O personagem paga o custo? `atuais` = { vit, ener, san } (valores atuais).
 * @returns null quando paga (ou o custo não é parseável/o atual é desconhecido);
 *          senão { recurso, qtd, tem } do primeiro recurso que falta.
 */
export function recursoInsuficiente(custoTexto, atuais) {
    for (const c of custoVital(custoTexto)) {
        const tem = atuais?.[c.recurso];
        if (tem != null && Number(tem) < c.qtd) return { recurso: c.recurso, qtd: c.qtd, tem: Number(tem) };
    }
    return null;
}

// =============================================
// CONDIÇÕES DO PARTICIPANTE (`p.condicoes`)
// Duas gerações no mesmo array: string solta (legado) e objeto
// { nome, icone, descricao, expiraNaRodada } — sempre leia por aqui.
// `expiraNaRodada` null/ausente = dura até alguém remover.
// =============================================

export function condDoParticipante(c) {
    if (typeof c === 'string') return { nome: c, icone: '☠️', descricao: '', expiraNaRodada: null, nivel: 1 };
    return {
        nome: c?.nome || '',
        icone: c?.icone || '☠️',
        descricao: c?.descricao || '',
        expiraNaRodada: c?.expiraNaRodada ?? null,
        // Condição que acumula guarda em que nível está. Ausente = nível 1:
        // a condição comum é só o nível 1 de uma escada de um degrau.
        nivel: Number(c?.nivel) > 0 ? Number(c.nivel) : 1,
        // Quem aplicou. Quase toda condição não liga; a Presa do Caçador liga,
        // porque o bônus dela é de quem marcou e não do marcado.
        porPid: c?.porPid || null,
    };
}

/**
 * Junta a MESMA condição numa entrada só, para exibição.
 *
 * A mesma condição chega por dois caminhos: a lista do participante da cena e a
 * cópia espelhada na ficha (ver sincAdicaoFicha). Somando as duas listas sem
 * juntar, o token ficava com dois ☠️ idênticos em volta. Aqui vira um ícone,
 * com o NÍVEL de quem estiver mais alto — que é o número que a mesa lê.
 *
 * @param condicoes lista crua (string legada ou objeto), de qualquer fonte
 * @returns [{ nome, icone, descricao, expiraNaRodada, nivel, porPid }] sem repetição
 */
export function condicoesAgrupadas(condicoes) {
    const porNome = new Map();
    for (const bruta of (condicoes || [])) {
        const c = condDoParticipante(bruta);
        if (!c.nome) continue;
        const k = _normCond(c.nome);
        const ja = porNome.get(k);
        if (!ja) { porNome.set(k, { ...c }); continue; }
        // mesma condição de duas fontes: fica o nível maior e o prazo mais longo
        if (c.nivel > ja.nivel) ja.nivel = c.nivel;
        if (c.expiraNaRodada != null && (ja.expiraNaRodada == null || c.expiraNaRodada > ja.expiraNaRodada)) {
            ja.expiraNaRodada = c.expiraNaRodada;
        }
        if (!ja.descricao && c.descricao) ja.descricao = c.descricao;
    }
    return [...porNome.values()];
}

// =============================================
// O QUE AS CONDIÇÕES FAZEM (leitura do cadastro do Criador)
// ---------------------------------------------
// O participante guarda a condição por NOME; o que ela faz mora no registro
// `system/data/conditions`. Esta é a única função que junta os dois — todo
// consumidor (turno, deslocamento, visão, mira, render) lê daqui em vez de
// reinterpretar o cadastro por conta própria.
//
// Regras de soma, porque duas condições ao mesmo tempo é o caso normal:
//   · bloqueio e demais liga/desliga → OU (uma que proíbe já proíbe)
//   · multiplicadores               → PRODUTO (duas metades = um quarto)
//   · facção forçada                → a última aplicada manda
//   · por-rodada e testes           → lista, cada condição com a sua linha
//
// ⚠️ NÍVEL não escala número: `efeitoPorNivel` é texto de mesa, não fórmula.
// O nível entra em `niveis` para o mestre ler; os multiplicadores valem uma vez
// só. Escalar por nível sem o cadastro mandar seria inventar regra.
// =============================================

const _normCond = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/** Efeito somado das condições de um participante. `registro` = system/data/conditions. */
export function efeitoDasCondicoes(condicoes, registro) {
    const out = {
        bloqueia: { padrao: false, movimento: false, livre: false, completa: false },
        perdeTurno: false,
        multDesloc: 1, deslocBloqueados: [],
        multVisao: 1, enxergaNoEscuro: false, deixaInvisivel: false,
        naoPodeSerAlvo: false, atraiAlvo: false, faccaoForcada: null,
        porRodada: [], testes: [], niveis: [],
        modAlvo: 0,    // soma dos modificadores no Alvo de QUALQUER teste (§2)
        desvantagem: false, // 🎲 rola dois d10 e fica com o pior (Livro, p. 9–10); flag, nunca soma
        modVd: {},     // VD normalizado -> quanto as condições somam nele
        modVdNome: {}, // o mesmo VD com o nome como está no cadastro
        motivos: {},   // campo -> [nomes das condições] — para dizer POR QUE travou
    };
    const mapa = new Map();
    for (const r of registro || []) mapa.set(_normCond(r.nome), r);

    // ⚠️ Duas cópias da MESMA condição multiplicam de novo, de propósito
    // (ver o teste "duas metades = um quarto"). Quem agrupa é só a EXIBIÇÃO,
    // em porqueCondicao — o efeito continua contando cada cópia.
    for (const cd of condicoes || []) {
        const c = condDoParticipante(cd);
        const reg = mapa.get(_normCond(c.nome));
        if (!reg) continue;   // condição personalizada (sem cadastro) não configura nada
        const marca = campo => { (out.motivos[campo] = out.motivos[campo] || []).push(c.nome); };

        const linhaNivel = reg.acumulaNiveis
            ? (reg.efeitoPorNivel || []).find(l => Number(l?.nivel) === c.nivel) : null;
        if (reg.acumulaNiveis) {
            out.niveis.push({ nome: c.nome, icone: c.icone, nivel: c.nivel, maximo: reg.nivelMaximo ?? null, efeito: linhaNivel?.efeito || '' });
        }

        // 🎯 MODIFICADOR NO ALVO (§2). O "−2 no Alvo de todos os testes" do
        // Abalado era só texto na tela — ninguém subtraía nada. Agora é número:
        // o nível manda quando a linha dele traz um valor; senão vale o da
        // condição inteira. Vários modificadores SOMAM (−2 e −1 dão −3).
        // Só mexe no ALVO: dano não é teste e não entra aqui.
        const modNivel = Number(linhaNivel?.modAlvo);
        const modGeral = Number(reg.modAlvoTestes);
        const mod = !isNaN(modNivel) && linhaNivel?.modAlvo !== '' && linhaNivel?.modAlvo != null
            ? modNivel : (isNaN(modGeral) ? 0 : modGeral);
        if (mod) { out.modAlvo += mod; marca('modAlvo'); }

        // 🛡️ MODIFICADOR EM VALOR DERIVADO. "Blindado: +N de Blindagem" era só
        // texto — a Amamoia ficava com o chip na tela e Blindagem 0 na ficha.
        // O N vem do NÍVEL: `modVdPorNivel` diz quanto vale cada degrau, então
        // Blindado nv 5 é +5. Condições diferentes somam no mesmo VD.
        const porNivel = Number(reg.modVdPorNivel);
        if (reg.modVd && !isNaN(porNivel) && porNivel) {
            const chave = _normCond(reg.modVd);
            out.modVd[chave] = (out.modVd[chave] || 0) + porNivel * c.nivel;
            out.modVdNome[chave] = reg.modVd;
            marca('modVd');
        }
        // 🎲 DESVANTAGEM (Livro, p. 9–10): Prostrado, Cego, o nível 3 das trilhas.
        // Nunca soma com outra Desvantagem — é uma flag, não um número.
        if (reg.desvantagem || (Number(reg.desvantagemNoNivel) > 0 && c.nivel >= Number(reg.desvantagemNoNivel))) { out.desvantagem = true; marca('desvantagem'); }

        if (reg.testeParaSair && reg.testeNome) {
            out.testes.push({
                condicao: c.nome, icone: c.icone, nome: reg.testeNome,
                mod: Number(reg.testeMod) || 0, quando: reg.testeQuando || 'fim_do_turno',
                sucessoRemove: reg.testeSucessoRemove || 'tudo',
                // Beira da Morte: falhou → Acuado; Morrendo: é o Teste de Morte (Livro, p. 10)
                falhaAplica: reg.testeFalhaAplica || null, falhaRodadas: Number(reg.testeFalhaRodadas) || 1,
                testeMorte: !!reg.testeMorte,
            });
        }

        if (!reg.afetaTabuleiro) continue;

        for (const a of reg.bloqueiaAcoes || []) {
            if (a in out.bloqueia) { out.bloqueia[a] = true; marca('bloqueia_' + a); }
        }
        if (reg.perdeTurno) { out.perdeTurno = true; marca('perdeTurno'); }

        if (reg.multiplicadorDeslocamento != null && !isNaN(reg.multiplicadorDeslocamento)) {
            out.multDesloc *= Number(reg.multiplicadorDeslocamento);
            marca('multDesloc');
        }
        for (const d of reg.deslocamentosBloqueados || []) {
            if (!out.deslocBloqueados.some(x => _normCond(x) === _normCond(d))) out.deslocBloqueados.push(d);
            marca('deslocBloqueados');
        }

        if (reg.multiplicadorVisao != null && !isNaN(reg.multiplicadorVisao)) {
            out.multVisao *= Number(reg.multiplicadorVisao);
            marca('multVisao');
        }
        if (reg.enxergaNoEscuro) { out.enxergaNoEscuro = true; marca('enxergaNoEscuro'); }
        if (reg.deixaInvisivel) { out.deixaInvisivel = true; marca('deixaInvisivel'); }

        if (reg.naoPodeSerAlvo) { out.naoPodeSerAlvo = true; marca('naoPodeSerAlvo'); }
        if (reg.atraiAlvo) { out.atraiAlvo = true; marca('atraiAlvo'); }
        if (reg.faccaoForcada) { out.faccaoForcada = reg.faccaoForcada; marca('faccaoForcada'); }

        if (reg.porRodadaEfeito) {
            // Sangrando N = N por rodada: o valor multiplica pelo nível quando o cadastro pede.
            const valor = reg.porRodadaPorNivel ? String((parseFloat(reg.porRodadaValor) || 1) * c.nivel) : (reg.porRodadaValor || '');
            out.porRodada.push({ condicao: c.nome, icone: c.icone, efeito: reg.porRodadaEfeito, valor });
        }
    }
    return out;
}

/** Nomes das condições que causaram `campo`, prontos para um title/tooltip. */
/**
 * POR QUE este campo travou/mudou — os nomes das condições responsáveis, cada
 * uma dita UMA vez. Duas cópias da mesma condição contam duas vezes no efeito
 * (é a regra), mas ler "(Imobilizado, Imobilizado)" na tela não informa nada.
 */
export function porqueCondicao(efeito, campo) {
    return [...new Set(efeito?.motivos?.[campo] || [])].join(', ');
}

/** 'dano_vit' → { sinal: -1, stat: 'VIT' }. Devolve null para efeito desconhecido. */
export function alvoDoTickRodada(efeito) {
    const m = /^(dano|cura)_(vit|ener|san)$/.exec(String(efeito || ''));
    if (!m) return null;
    return { sinal: m[1] === 'dano' ? -1 : 1, stat: m[2].toUpperCase() };
}

/**
 * Tira dos participantes as condições cujo tempo acabou (mesma régua dos
 * templates: expira quando `rodada >= expiraNaRodada`).
 * Pura: devolve cópias, não mexe na lista recebida.
 * @returns { participantes, expiradas: [{ pid, pNome, cond }] }
 */
export function tirarCondicoesExpiradas(participantes, rodada) {
    const expiradas = [];
    const parts = (participantes || []).map(p => {
        if (!(p.condicoes || []).length) return { ...p };
        const ficam = [];
        for (const cd of p.condicoes) {
            const c = condDoParticipante(cd);
            if (c.expiraNaRodada != null && rodada >= c.expiraNaRodada) {
                expiradas.push({ pid: p.id, pNome: p.name || '?', cond: c });
            } else ficam.push(cd);
        }
        return { ...p, condicoes: ficam };
    });
    return { participantes: parts, expiradas };
}

// =============================================
// 🚪 O PORTÃO DA CONDIÇÃO (Livro de 12 Páginas, p. 9)
// É a condição que diz como pega, não a habilidade:
//   direto  — o golpe entrou, a condição entra junto
//   corpo   — só se os Graus do golpe ≥ VIG do alvo (+ a Resistência da cena)
//   mente   — só se os Graus ≥ PRS do alvo (+ a Resistência da cena)
//   nenhum  — só em quem quer (buff, marca)
// Ninguém rola um segundo dado: a Resistência é um número do alvo, como a
// Defesa. Crítico sempre pega.
// =============================================
export const PORTOES = ['direto', 'corpo', 'mente', 'nenhum'];

/**
 * A condição pega?
 * @param portao       o portão da condição (cadastro)
 * @param graus        Graus do golpe ou da habilidade
 * @param critico      dado 1: sempre pega
 * @param resistencia  VIG ou PRS do alvo já somado ao +1 por vez que a mesma
 *                     condição pegou nele nesta cena
 */
export function condicaoPega({ portao = 'direto', graus = 0, critico = false, resistencia = 0 } = {}) {
    if (portao !== 'corpo' && portao !== 'mente') return true;
    if (critico) return true;
    return (Number(graus) || 0) >= (Number(resistencia) || 0);
}

/**
 * 💊 Cura por potência: tira toda Aflição de nível ≤ potência. Condição comum
 * não é Aflição e não entra aqui — sai por descanso, teste ou cura comum.
 * @returns { condicoes, curadas: [nomes] }
 */
export function curarAflicoes(condicoes, registro, potencia) {
    const pot = Number(potencia) || 0;
    if (pot <= 0) return { condicoes: condicoes || [], curadas: [] };
    const mapa = new Map();
    for (const r of registro || []) mapa.set(_normCond(r.nome), r);
    const curadas = [];
    const resto = (condicoes || []).filter(cd => {
        const c = condDoParticipante(cd);
        const reg = mapa.get(_normCond(c.nome));
        if (!reg?.aflicao || c.nivel > pot) return true;
        curadas.push(c.nome);
        return false;
    });
    return { condicoes: resto, curadas };
}

// =============================================
// 🩹 AS TRILHAS AUTOMÁTICAS (Livro de 12 Páginas, p. 10)
// Ferimento pela Vitalidade e Sobrecarga pelo peso: a ficha e o Tabuleiro
// põem e tiram a condição sozinhos. Nenhuma trilha toca a Defesa.
// =============================================
export const FAIXAS_FERIMENTO = ['Ferido', 'Grave', 'Beira da Morte', 'Morrendo'];

/** Em que faixa a Vitalidade está. `faixas` = % [75, 50, 25] (config/regras ferimento.faixas). null = inteiro. */
export function faixaDeFerimento(atual, max, faixas = [75, 50, 25]) {
    const m = Number(max) || 0, a = Number(atual);
    if (!(m > 0) || !Number.isFinite(a)) return null;
    if (a <= 0) return 'Morrendo';
    const pct = (a / m) * 100;
    const [f1 = 75, f2 = 50, f3 = 25] = (faixas || []).map(Number);
    if (pct <= f3) return 'Beira da Morte';
    if (pct <= f2) return 'Grave';
    if (pct <= f1) return 'Ferido';
    return null;
}

/**
 * As condições do participante com a faixa de Ferimento certa: tira as quatro
 * e põe a que vale. As condições manuais ficam como estão.
 * @returns { condicoes, entrou, saiu } — nomes, para o log
 */
export function condicoesDeFerimento(condicoes, faixa, registro) {
    const daTrilha = (registro || []).filter(r => r.trilha === 'ferimento' || FAIXAS_FERIMENTO.includes(r.nome));
    const nomes = new Set([...daTrilha.map(r => _normCond(r.nome)), ...FAIXAS_FERIMENTO.map(_normCond)]);
    const nomeDe = (c) => _normCond(condDoParticipante(c).nome);
    const atuais = (condicoes || []).filter(c => nomes.has(nomeDe(c)));
    const resto = (condicoes || []).filter(c => !nomes.has(nomeDe(c)));
    const alvo = _normCond(faixa || '');
    const saiu = atuais.filter(c => nomeDe(c) !== alvo).map(c => condDoParticipante(c).nome);
    if (!faixa) return { condicoes: resto, entrou: null, saiu };
    const jaTinha = atuais.find(c => nomeDe(c) === alvo);
    if (jaTinha) return { condicoes: [...resto, jaTinha], entrou: null, saiu };
    const reg = daTrilha.find(r => _normCond(r.nome) === alvo) || null;
    const nova = { nome: reg?.nome || faixa, icone: reg?.icone || '🩸', descricao: reg?.descricao || '', expiraNaRodada: null, nivel: 1, automatica: 'ferimento' };
    return { condicoes: [...resto, nova], entrou: nova.nome, saiu };
}

/** Sobrecarga: nível pela % acima da Carga — faixas [25, 50] de config/regras. 0 = sem. */
export function nivelDeSobrecarga(pressao, carga, faixas = [25, 50]) {
    const c = Number(carga) || 0, p = Number(pressao) || 0;
    if (!(c > 0) || p <= c) return 0;
    const pct = ((p - c) / c) * 100;
    const [f1 = 25, f2 = 50] = (faixas || []).map(Number);
    return pct <= f1 ? 1 : pct <= f2 ? 2 : 3;
}
