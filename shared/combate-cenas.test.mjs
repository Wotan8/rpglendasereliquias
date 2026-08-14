// Rodar: node shared/combate-cenas.test.mjs
// O que está trancado aqui: o ESPELHO. O painel de combate da ficha lê
// `participantes` direto do doc — se um write montado na mão deixar o espelho
// para trás, o jogador vê a iniciativa da cena errada (ou nenhuma).
import assert from 'node:assert/strict';
import {
    CENA_PADRAO, novaCena, cenasDoDoc, cenaAtiva, idCenaAtiva,
    docDeCenas, comCena, comCenaAtivaPatch, comCenaNova, semCena, comTrocaDeCena,
    condDoParticipante, tirarCondicoesExpiradas,
    faccaoDoParticipante, acoesNovas, podeGastar, gastarAcao, alvoValido,
    alcanceGolpe, participanteDaVez, indiceNaOrdem, guardadoValido,
    custoVital, recursoInsuficiente, custoDaMecanica,
    efeitoDasCondicoes, porqueCondicao, alvoDoTickRodada,
} from './combate-cenas.js';

const p = (n) => ({ id: n, name: n, initiative: 1 });

// --- doc ANTIGO (participantes soltos) vira uma cena, sem migração ---
const antigo = { participantes: [p('a'), p('b')], turnoAtual: 1, rodada: 3 };
assert.equal(cenasDoDoc(antigo).length, 1);
assert.equal(cenaAtiva(antigo).nome, CENA_PADRAO.nome);
assert.deepEqual(cenaAtiva(antigo).participantes.map(x => x.id), ['a', 'b']);
assert.equal(cenaAtiva(antigo).turnoAtual, 1, 'turno e rodada do doc antigo entram na cena');
assert.equal(cenaAtiva(antigo).rodada, 3);

// doc vazio/inexistente também dá uma cena utilizável
assert.equal(cenasDoDoc(null).length, 1);
assert.deepEqual(cenaAtiva(undefined).participantes, []);

// --- espelho: o que a ficha lê é SEMPRE a cena aberta ---
const duas = docDeCenas([
    { ...novaCena('c1', 'Emboscada'), participantes: [p('a')], turnoAtual: 2, rodada: 5 },
    { ...novaCena('c2', 'Taverna'), participantes: [p('z')] },
], 'c1');
assert.equal(duas.cenaAtiva, 'c1');
assert.deepEqual(duas.participantes.map(x => x.id), ['a'], '🔒 espelho = participantes da cena ativa');
assert.equal(duas.turnoAtual, 2);
assert.equal(duas.rodada, 5);

const trocado = comTrocaDeCena(duas, 'c2');
assert.equal(trocado.cenaAtiva, 'c2');
assert.deepEqual(trocado.participantes.map(x => x.id), ['z'], '🔒 trocar de cena move o espelho junto');
assert.equal(trocado.turnoAtual, 0, 'cada cena tem o próprio turno');
assert.equal(trocado.cenas.length, 2, 'trocar não perde a outra cena');

// --- id que não existe mais (cena apagada em outro aparelho) cai na primeira ---
assert.equal(idCenaAtiva({ cenas: duas.cenas, cenaAtiva: 'sumiu' }), 'c1');

// --- alterar a cena ativa não encosta nas outras ---
const mexido = comCenaAtivaPatch(duas, { participantes: [p('a'), p('novo')], turnoAtual: 0 });
assert.deepEqual(mexido.cenas.find(c => c.id === 'c1').participantes.map(x => x.id), ['a', 'novo']);
assert.deepEqual(mexido.cenas.find(c => c.id === 'c2').participantes.map(x => x.id), ['z'], '🔒 a outra cena fica intacta');
assert.deepEqual(mexido.participantes.map(x => x.id), ['a', 'novo'], 'espelho acompanha');

// alterar uma cena que NÃO está aberta não mexe no espelho
const noFundo = comCena(duas, 'c2', { participantes: [] });
assert.deepEqual(noFundo.participantes.map(x => x.id), ['a'], 'espelho continua na cena aberta');
assert.deepEqual(noFundo.cenas.find(c => c.id === 'c2').participantes, []);

// --- cena nova entra já aberta e vazia ---
const comNova = comCenaNova(duas, 'c3', 'Ponte');
assert.equal(comNova.cenaAtiva, 'c3');
assert.equal(comNova.cenas.length, 3);
assert.deepEqual(comNova.participantes, [], 'cena nova começa sem ninguém');
assert.equal(comNova.rodada, 1);
assert.equal(comCenaNova(duas, 'c4').cenas.find(c => c.id === 'c4').nome, 'Nova cena', 'sem nome tem padrão');

// --- apagar ---
const semC1 = semCena(duas, 'c1');
assert.equal(semC1.cenas.length, 1);
assert.equal(semC1.cenaAtiva, 'c2', 'apagar a aberta abre a que sobrou');
assert.deepEqual(semC1.participantes.map(x => x.id), ['z']);
const semC2 = semCena(duas, 'c2');
assert.equal(semC2.cenaAtiva, 'c1', 'apagar outra não muda a que está aberta');

// 🔒 apagar a ÚLTIMA cena não pode deixar o doc sem cena nenhuma
const semNada = semCena(docDeCenas([novaCena('unica', 'Só essa')], 'unica'), 'unica');
assert.equal(semNada.cenas.length, 1, 'sempre sobra uma cena para o combate existir');
assert.deepEqual(semNada.participantes, []);

// =====================================================================
// CONDIÇÕES — legado (string) e objeto convivem no mesmo array
// =====================================================================
assert.deepEqual(condDoParticipante('Caído'),
    { nome: 'Caído', icone: '☠️', descricao: '', expiraNaRodada: null, nivel: 1 }, 'string legada vira objeto completo');
assert.equal(condDoParticipante({ nome: 'Queimando', icone: '🔥', expiraNaRodada: 4 }).icone, '🔥');
assert.equal(condDoParticipante({ nome: 'X' }).expiraNaRodada, null, 'sem prazo = permanente');
assert.equal(condDoParticipante(null).nome, '', 'lixo não explode');
// Condição que acumula guarda o nível; a comum é o nível 1 de uma escada de um degrau.
assert.equal(condDoParticipante({ nome: 'Exaustão', nivel: 3 }).nivel, 3);
assert.equal(condDoParticipante({ nome: 'X' }).nivel, 1, 'sem nível gravado = nível 1');
assert.equal(condDoParticipante({ nome: 'X', nivel: 0 }).nivel, 1, 'nível 0 não existe');

// expiração pela rodada (mesma régua dos templates: rodada >= expiraNaRodada)
const emCena = [
    { id: 'p1', name: 'Goblin', condicoes: ['Caído', { nome: 'Queimando', icone: '🔥', expiraNaRodada: 3 }] },
    { id: 'p2', name: 'Orc', condicoes: [{ nome: 'Lento', icone: '🐌', expiraNaRodada: 5 }] },
    { id: 'p3', name: 'Mago' },   // sem condições — não pode explodir
];
const r3 = tirarCondicoesExpiradas(emCena, 3);
assert.deepEqual(r3.expiradas.map(e => e.cond.nome), ['Queimando'], 'expira exatamente na rodada marcada');
assert.deepEqual(r3.participantes[0].condicoes, ['Caído'], '🔒 string legada (sem prazo) nunca expira');
assert.equal(r3.participantes[1].condicoes.length, 1, 'prazo futuro fica');
assert.equal(r3.expiradas[0].pid, 'p1');
assert.equal(r3.expiradas[0].pNome, 'Goblin');
const r2 = tirarCondicoesExpiradas(emCena, 2);
assert.equal(r2.expiradas.length, 0, 'antes do prazo nada sai');
// pureza: a lista original não pode ser alterada
assert.equal(emCena[0].condicoes.length, 2, '🔒 função pura: entrada intacta');
assert.deepEqual(tirarCondicoesExpiradas(null, 1), { participantes: [], expiradas: [] });

// =====================================================================
// TURNO MECÂNICO — economia de ações (§6.2: 1 Padrão + 1 Movimento)
// =====================================================================
const cheias = acoesNovas();
assert.deepEqual(cheias, { padrao: true, movimento: true });
assert.equal(podeGastar(cheias, 'padrao'), true);
assert.equal(podeGastar(cheias, 'completa'), true);
assert.equal(podeGastar(cheias, undefined), true, 'custo ausente = padrão do sistema (1 Ação Padrão)');

const semPadrao = gastarAcao(cheias, 'padrao');
assert.deepEqual(semPadrao, { padrao: false, movimento: true });
assert.equal(cheias.padrao, true, '🔒 gastarAcao não muta o estado recebido');
assert.equal(podeGastar(semPadrao, 'padrao'), false, 'segunda Padrão no mesmo turno não existe');
assert.equal(podeGastar(semPadrao, 'completa'), false, 'Completa exige as DUAS ações');
assert.equal(podeGastar(semPadrao, 'movimento'), true);
assert.equal(podeGastar(semPadrao, 'livre'), true, 'Livre é incidental — nunca bloqueia');
assert.deepEqual(gastarAcao(semPadrao, 'livre'), semPadrao, 'Livre não consome nada');
assert.deepEqual(gastarAcao(cheias, 'completa'), { padrao: false, movimento: false });
assert.equal(podeGastar(gastarAcao(cheias, 'completa'), 'livre'), true, 'sem ações ainda dá para a Livre');
assert.equal(podeGastar(null, 'padrao'), true, 'cena antiga sem acoesTurno = turno cheio');

// facções
assert.equal(faccaoDoParticipante({ characterId: 'c1' }), 'aliados', 'jogador nasce aliado');
assert.equal(faccaoDoParticipante({ npcId: 'n1' }), 'inimigos', 'NPC nasce inimigo');
assert.equal(faccaoDoParticipante({ npcId: 'n1', faccao: 'aliados' }), 'aliados', 'a gravada vence o palpite');
assert.equal(alvoValido('todos', 'aliados', 'inimigos'), true);
assert.equal(alvoValido('inimigos', 'aliados', 'inimigos'), true);
assert.equal(alvoValido('inimigos', 'aliados', 'aliados'), false, 'skill hostil não pega aliado');
assert.equal(alvoValido('aliados', 'aliados', 'aliados'), true, 'buff pega a própria facção (inclui a si)');
assert.equal(alvoValido('aliados', 'aliados', 'neutros'), false);
assert.equal(alvoValido('inimigos', 'aliados', 'neutros'), true, 'neutro é "diferente" para skill hostil');
assert.equal(alvoValido(undefined, 'aliados', 'inimigos'), true, 'sem cadastro = todos');

// alcance do golpe CaC: arma + 5% do Tamanho, mínimo 1 m
assert.equal(alcanceGolpe(0, 5.1), 1, 'desarmado humano (Tam 5,1): 0,255 → piso de 1 m');
assert.equal(alcanceGolpe(2, 5.1), 2.255, 'lança 2 m + 5% de 5,1');
assert.equal(alcanceGolpe(0, 15.75), 1, 'Yotun desarmado (Tam 15,75): 0,79 → ainda no piso');
assert.equal(alcanceGolpe(2, 15.75), 2.7875, 'Yotun com lança sente o tamanho');
assert.equal(alcanceGolpe(null, null), 1, 'sem cadastro nenhum: 1 m');

// participante da vez segue a MESMA ordenação da janela (iniciativa desc)
const cenaT = { participantes: [{ id: 'a', initiative: 3 }, { id: 'b', initiative: 9 }, { id: 'c', initiative: 6 }], turnoAtual: 0 };
assert.equal(participanteDaVez(cenaT).id, 'b', 'turno 0 = maior iniciativa');
assert.equal(participanteDaVez({ ...cenaT, turnoAtual: 2 }).id, 'a');
assert.equal(participanteDaVez({ ...cenaT, turnoAtual: 3 }).id, 'b', 'wrap de rodada');
assert.equal(participanteDaVez({ participantes: [] }), null);

// turno GUARDADO (delay): vale só dentro da mesma rodada
assert.equal(indiceNaOrdem(cenaT, 'b'), 0, 'maior iniciativa é o índice 0');
assert.equal(indiceNaOrdem(cenaT, 'a'), 2);
assert.equal(indiceNaOrdem(cenaT, 'sumiu'), -1);
assert.equal(guardadoValido({ rodada: 3 }, { guardadoNaRodada: 3 }), true, 'guardou nesta rodada: pode agir');
assert.equal(guardadoValido({ rodada: 4 }, { guardadoNaRodada: 3 }), false, '🔒 virou a rodada sem usar: perdeu o turno');
assert.equal(guardadoValido({ rodada: 3 }, {}), false, 'sem guardar não há o que usar');
assert.equal(guardadoValido({}, { guardadoNaRodada: 1 }), true, 'cena sem rodada = rodada 1');

// 💰 custo vital das habilidades
assert.deepEqual(custoVital('2 ENER'), [{ recurso: 'ener', qtd: 2 }]);
assert.deepEqual(custoVital('1 Energia e 1 SAN'), [{ recurso: 'ener', qtd: 1 }, { recurso: 'san', qtd: 1 }]);
assert.deepEqual(custoVital('-1 ENER'), [{ recurso: 'ener', qtd: 1 }], 'sinal do cadastro de mecânica não muda o custo');
assert.deepEqual(custoVital('custa 0,5 Sanidade'), [{ recurso: 'san', qtd: 0.5 }], 'vírgula decimal');
assert.deepEqual(custoVital('nenhum'), [], 'texto sem par número+sigla não vira custo');
assert.deepEqual(custoVital('2'), [], 'número sem sigla: não inventa recurso');
assert.equal(recursoInsuficiente('2 ENER', { ener: 4 }), null, 'tem: pode usar');
assert.deepEqual(recursoInsuficiente('2 ENER', { ener: 1 }), { recurso: 'ener', qtd: 2, tem: 1 }, 'falta Energia');
assert.equal(recursoInsuficiente('2 ENER', {}), null, 'atual desconhecido não bloqueia (não inventa)');
assert.deepEqual(recursoInsuficiente('1 VIT e 3 SAN', { vit: 5, san: 2 }), { recurso: 'san', qtd: 3, tem: 2 }, 'checa todos os recursos do custo');
assert.equal(recursoInsuficiente('', { ener: 0 }), null, 'sem custo nada falta');

// custo declarado por MECÂNICA (é assim que o cadastro guarda: "-1 ENER")
const mechEner = { nome: '-1 ENER', tipo: 'modificar', config: { calculos: [{ alvo: 'Energia Atual', operacao: '-', equacao: [{ valor: 1, tipo: 'fixo' }] }] } };
const mechGraca = { nome: '-2 Graça', tipo: 'modificar', config: { calculos: [{ alvo: 'Graça de Palla', operacao: '-', equacao: [{ valor: 2, tipo: 'fixo' }] }] } };
assert.deepEqual(custoDaMecanica(mechEner), { rotulo: '-1 ENER', alvo: 'Energia Atual', qtd: 1 });
assert.deepEqual(custoDaMecanica(mechGraca), { rotulo: '-2 Graça', alvo: 'Graça de Palla', qtd: 2 }, 'recurso de classe é VD, não vital');
assert.equal(custoDaMecanica({ nome: '+1 ENER', tipo: 'modificar', config: { calculos: [{ alvo: 'Energia Atual', operacao: '+', equacao: [{ valor: 1 }] }] } }), null, 'somar não é custo');
assert.equal(custoDaMecanica({ tipo: 'booleano' }), null, 'mecânica de outro tipo não é custo');
assert.equal(custoDaMecanica(null), null);
assert.equal(custoDaMecanica({ tipo: 'modificar', config: { calculos: [{ alvo: 'X', operacao: '-', equacao: [] }] } }), null, 'sem valor não vira custo');

// =============================================
// 🎲 EFEITO DAS CONDIÇÕES — o que o Tabuleiro lê do cadastro do Criador
// =============================================
const REG = [
    { nome: 'Imobilizado', afetaTabuleiro: true, bloqueiaAcoes: ['movimento'], multiplicadorDeslocamento: 0 },
    { nome: 'Atordoado', afetaTabuleiro: true, bloqueiaAcoes: ['padrao', 'completa'], perdeTurno: false },
    { nome: 'Lento', afetaTabuleiro: true, multiplicadorDeslocamento: 0.5, multiplicadorVisao: 0.5 },
    { nome: 'Cego', afetaTabuleiro: true, multiplicadorVisao: 0 },
    { nome: 'Asas Quebradas', afetaTabuleiro: true, deslocamentosBloqueados: ['Aéreo'] },
    { nome: 'Etéreo', afetaTabuleiro: true, naoPodeSerAlvo: true, deixaInvisivel: true },
    { nome: 'Dominado', afetaTabuleiro: true, faccaoForcada: 'inimigos' },
    { nome: 'Enfeitiçado', afetaTabuleiro: true, faccaoForcada: 'aliados' },
    { nome: 'Sangrando', afetaTabuleiro: true, porRodadaEfeito: 'dano_vit', porRodadaValor: '1d4' },
    { nome: 'Inconsciente', afetaTabuleiro: true, perdeTurno: true, bloqueiaAcoes: ['padrao', 'movimento', 'livre', 'completa'] },
    { nome: 'Inspirado', afetaTabuleiro: false, bloqueiaAcoes: ['padrao'], multiplicadorDeslocamento: 0 },
    {
        nome: 'Exaustão', acumulaNiveis: true, nivelMaximo: 6,
        efeitoPorNivel: [{ nivel: 1, efeito: 'Desvantagem' }, { nivel: 2, efeito: 'Deslocamento pela metade' }],
        testeParaSair: true, testeNome: 'Vigor + Resistência', testeMod: -2,
        testeQuando: 'virada_da_rodada', testeSucessoRemove: 'um_nivel',
    },
    { nome: 'Preso', afetaTabuleiro: true, bloqueiaAcoes: ['movimento'], testeParaSair: true, testeNome: 'Força', testeMod: 0 },
];

const ef = (nomes) => efeitoDasCondicoes(nomes.map(n => (typeof n === 'string' ? { nome: n } : n)), REG);

// nada aplicado = tudo neutro (nunca undefined — quem lê não precisa checar)
const zero = efeitoDasCondicoes([], REG);
assert.deepEqual(zero.bloqueia, { padrao: false, movimento: false, livre: false, completa: false });
assert.equal(zero.multDesloc, 1);
assert.equal(zero.multVisao, 1);
assert.equal(zero.faccaoForcada, null);

// bloqueio de ação: OU entre condições
assert.equal(ef(['Imobilizado']).bloqueia.movimento, true);
assert.equal(ef(['Imobilizado']).bloqueia.padrao, false, 'imobilizado ainda ataca');
const atordImob = ef(['Atordoado', 'Imobilizado']);
assert.equal(atordImob.bloqueia.padrao, true);
assert.equal(atordImob.bloqueia.movimento, true, 'duas condições somam os bloqueios');

// o interruptor do cadastro manda: sem afetaTabuleiro, nada de VTT sai
assert.equal(ef(['Inspirado']).bloqueia.padrao, false, 'afetaTabuleiro:false não bloqueia ação');
assert.equal(ef(['Inspirado']).multDesloc, 1, 'afetaTabuleiro:false não mexe no deslocamento');

// condição personalizada do mestre (sem cadastro) não configura nada
assert.deepEqual(ef(['Amaldiçoado pelo Bardo']).bloqueia, zero.bloqueia);

// multiplicadores multiplicam — duas metades dão um quarto, e o zero vence
assert.equal(ef(['Lento']).multDesloc, 0.5);
assert.equal(ef([{ nome: 'Lento' }, { nome: 'Lento' }]).multDesloc, 0.25, 'duas metades = um quarto');
assert.equal(ef(['Lento', 'Imobilizado']).multDesloc, 0, 'zero come qualquer multiplicador');
assert.equal(ef(['Lento', 'Cego']).multVisao, 0, 'cego zera mesmo com outra visão parcial');

// deslocamento por tipo: união, sem repetir
assert.deepEqual(ef(['Asas Quebradas']).deslocBloqueados, ['Aéreo']);
assert.deepEqual(ef([{ nome: 'Asas Quebradas' }, { nome: 'Asas Quebradas' }]).deslocBloqueados, ['Aéreo'], 'não duplica');

// liga/desliga é OU
assert.equal(ef(['Etéreo']).naoPodeSerAlvo, true);
assert.equal(ef(['Etéreo']).deixaInvisivel, true);
assert.equal(ef(['Inconsciente']).perdeTurno, true);
assert.equal(ef(['Atordoado']).perdeTurno, false, 'atordoado age no turno seguinte, não some da ordem');

// facção forçada: a última aplicada manda (a magia mais recente domina)
assert.equal(ef(['Dominado']).faccaoForcada, 'inimigos');
assert.equal(ef(['Dominado', 'Enfeitiçado']).faccaoForcada, 'aliados', 'a última aplicada vence');

// tick de rodada vira lista, com a condição que causou
assert.deepEqual(ef(['Sangrando']).porRodada, [{ condicao: 'Sangrando', icone: '☠️', efeito: 'dano_vit', valor: '1d4' }]);
assert.deepEqual(alvoDoTickRodada('dano_vit'), { sinal: -1, stat: 'VIT' });
assert.deepEqual(alvoDoTickRodada('cura_san'), { sinal: 1, stat: 'SAN' });
assert.equal(alvoDoTickRodada('explodir'), null, 'efeito desconhecido não vira tick');
assert.equal(alvoDoTickRodada(''), null);

// nível: pega o texto do nível certo, e o número NÃO escala multiplicador
const exa2 = ef([{ nome: 'Exaustão', nivel: 2 }]);
assert.deepEqual(exa2.niveis, [{ nome: 'Exaustão', icone: '☠️', nivel: 2, maximo: 6, efeito: 'Deslocamento pela metade' }]);
assert.equal(exa2.multDesloc, 1, 'efeitoPorNivel é texto de mesa — não vira multiplicador sozinho');
assert.equal(ef([{ nome: 'Exaustão', nivel: 9 }]).niveis[0].efeito, '', 'nível sem linha cadastrada não inventa efeito');
assert.equal(ef(['Exaustão']).niveis[0].nivel, 1, 'sem nível gravado, é o nível 1');

// teste para sair: sai no formato que o Tabuleiro já pede (nome + mod)
assert.deepEqual(ef(['Preso']).testes, [{ condicao: 'Preso', icone: '☠️', nome: 'Força', mod: 0, quando: 'fim_do_turno', sucessoRemove: 'tudo' }]);
const tExa = ef(['Exaustão']).testes[0];
assert.equal(tExa.mod, -2);
assert.equal(tExa.quando, 'virada_da_rodada');
assert.equal(tExa.sucessoRemove, 'um_nivel');
assert.deepEqual(ef(['Lento']).testes, [], 'condição sem teste cadastrado não pede rolagem');

// nível e teste valem MESMO fora do interruptor do Tabuleiro
assert.equal(ef([{ nome: 'Exaustão', nivel: 2 }]).niveis.length, 1, 'acúmulo não depende de afetaTabuleiro');
assert.equal(ef(['Exaustão']).testes.length, 1, 'teste não depende de afetaTabuleiro');

// motivo: quem pergunta "por que estou travado?" recebe o nome da condição
assert.equal(porqueCondicao(atordImob, 'bloqueia_padrao'), 'Atordoado');
assert.equal(porqueCondicao(ef(['Lento', 'Imobilizado']), 'multDesloc'), 'Lento, Imobilizado');
assert.equal(porqueCondicao(zero, 'bloqueia_padrao'), '', 'sem motivo devolve string vazia, não undefined');

// o nome casa sem ligar para acento/caixa (o mestre digita como quiser)
assert.equal(ef(['imobilizado']).bloqueia.movimento, true);
assert.equal(ef(['EXAUSTAO']).testes.length, 1, 'casa sem acento');

console.log('✅ combate-cenas: doc antigo, espelho da cena ativa, troca, patch isolado, criar e apagar, condições, turno mecânico, turno guardado, custo vital e de mecânica, efeito das condições OK');
