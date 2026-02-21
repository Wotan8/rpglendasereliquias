/* ===== CLASS TESTS DATA — Testes Principais por Classe ===== */
/* parts: array de tokens para cálculo automático do total.
   - Token simples: 'FOR', 'Briga', etc. (atributo ou perícia)
   - Token com |: 'FOR|DES' = usa o MAIOR dos dois
   - Token @id: lê valor do elemento DOM pelo id (ex: '@rea_display')
   - Tokens não encontrados resolvem para 0 */

const CLASS_TESTS = {
    'Guerreiro': {
        nome: 'Guerreiro',
        testes: [
            { nome: 'Mãos Vazias', formula: 'FOR + Briga + Equip.', quando: 'Combate desarmado, agarrões, imobilizações', parts: ['FOR', 'Briga'] },
            { nome: 'Arma de Haste', formula: 'FOR ou DES + Arma + Armas de Haste + Equip.', quando: 'Atacar com lanças, alabardas, bastões', parts: ['FOR|DES', 'Arma'] },
            { nome: 'Arma Pesada', formula: 'FOR + Arma + Armas Pesadas + Equip.', quando: 'Atacar com montantes, machados grandes, martelos', parts: ['FOR', 'Arma'] },
            { nome: 'Arma de Uma Mão', formula: 'FOR ou DES + Arma + Armas de Uma Mão + Equip.', quando: 'Atacar com espadas curtas, machadinhas, cimitarras', parts: ['FOR|DES', 'Arma'] },
            { nome: 'Arma de Duas Mãos', formula: 'FOR ou DES + Arma + Armas de Duas Mãos + Equip.', quando: 'Atacar com espadões, clavas pesadas', parts: ['FOR|DES', 'Arma'] },
            { nome: 'Armas Duplas', formula: 'FOR ou DES + Arma + Armas Duplas + Equip.', quando: 'Atacar usando duas armas simultaneamente', parts: ['FOR|DES', 'Arma'] },
            { nome: 'Arremesso', formula: 'FOR ou DES + Disparo + Armas Arremessáveis + Equip.', quando: 'Lanças, machados de arremesso, pedras à distância', parts: ['FOR|DES', 'Disparo'] },
            { nome: 'Escudo', formula: 'Escudo', quando: 'Absorver dano, desviar golpes, proteger aliados (custa 1 ação)', parts: [] },
            { nome: 'Contra-Ataque', formula: 'Reação + Contra-Ataque', quando: 'Após defesa contra ataque falho do inimigo (0 acertos)', parts: ['@rea_display', 'Contra-Ataq.'] },
            { nome: 'Percepção', formula: 'RAC + PRE', quando: 'Detectar ameaças, emboscadas, inimigos ocultos', parts: ['RAC', 'PRE'] }
        ]
    },
    'Ladino': {
        nome: 'Ladino',
        testes: [
            { nome: 'Punhal', formula: 'DES + Arma + Punhal + B.Arma', quando: 'Combate com adagas, punhais e armas curtas', parts: ['DES', 'Arma'] },
            { nome: 'Punhal Furtivo', formula: 'DES + Arma + Punhal + B.Arma + Furtividade', quando: 'Atacar estando oculto/despercebido', parts: ['DES', 'Arma', 'Furtividade'] },
            { nome: 'Furto', formula: 'DES + Prestidigitação + Furtividade vs RAC + AUT do alvo', quando: 'Subtrair/plantar objetos, batedor de carteiras', parts: ['DES', 'Prestidigitação', 'Furtividade'] },
            { nome: 'Discrição', formula: 'DES + Furtividade', quando: 'Mover-se sem ser visto, atravessar áreas vigiadas, emboscada', parts: ['DES', 'Furtividade'] },
            { nome: 'Abrir Fechaduras', formula: 'DES + Arrombamento + Ferramentas', quando: 'Abrir portas, cofres, cadeados, mecanismos', parts: ['DES', 'Arrombamento'] },
            { nome: 'Percepção', formula: 'RAC + PRE', quando: 'Detectar armadilhas, patrulhas, vigias, pistas', parts: ['RAC', 'PRE'] }
        ]
    },
    'Caçador': {
        nome: 'Caçador',
        testes: [
            { nome: 'Disparo', formula: 'DES + Disparo + Precisão + Equip.', quando: 'Atacar com arcos, bestas, zarabatanas (2 ações: preparar + mirar)', parts: ['DES', 'Disparo', 'Precisão'] },
            { nome: 'Disparo Furtivo', formula: 'DES + Disparo + Furtividade + Precisão + Equip.', quando: 'Atacar inimigos desprevenidos (ignora Reação do alvo)', parts: ['DES', 'Disparo', 'Furtividade', 'Precisão'] },
            { nome: 'Rastreamento', formula: 'RAC + PRE + Sobrevivência', quando: 'Seguir pegadas, rastros, odores, sinais de passagem', parts: ['RAC', 'PRE', 'Sobrevivência'] },
            { nome: 'Preparar Loção Rápida', formula: 'DES + AUT + Herbalismo + Maceração − 2', quando: 'Em combate, preparar loção aplicada à flecha', parts: ['DES', 'AUT', 'Herbalismo', 'Maceração'] },
            { nome: 'Preparar Loção', formula: 'RAC + Herbalismo + Maceração + Ferramenta', quando: 'Fora de combate, extrair propriedades de ingredientes', parts: ['RAC', 'Herbalismo', 'Maceração'] },
            { nome: 'Dosagem', formula: 'INT + Herbalismo + Dosagem', quando: 'Após preparar loção, definir potência', parts: ['INT', 'Herbalismo', 'Dosagem'] },
            { nome: 'Domar Aliado', formula: 'PRE + Domar + Aliado Animal', quando: 'Fora de combate, estabelecer laço com criatura', parts: ['PRE', 'Domar', 'Aliado Animal'] },
            { nome: 'Comandar Aliado', formula: 'PRE + Liderança + Aliado Animal', quando: 'Dar ordens a aliado animal em cena', parts: ['PRE', 'Liderança', 'Aliado Animal'] },
            { nome: 'Percepção', formula: 'RAC + PRE', quando: 'Notar armadilhas, emboscadas, cheiros e sinais de território', parts: ['RAC', 'PRE'] }
        ]
    },
    'Adepto': {
        nome: 'Adepto',
        testes: [
            { nome: 'Controle da Ruína', formula: 'INT + Selo do Profano', quando: 'Durante ritual de reanimação (1º passo)', parts: ['INT', 'Selo do Profano'] },
            { nome: 'Contato com o Sétimo', formula: 'PRS + Performance + Contato c/ o Sétimo + Talismã Profano', quando: 'Durante ritual de reanimação (2º passo)', parts: ['PRS', 'Performance', 'Contato c/ o Sétimo'] },
            { nome: 'Convocar Fantoches', formula: 'PRS + Liderança + Talismã Profano', quando: 'Ritual de fantoche (erguer cadáveres em combate)', parts: ['PRS', 'Liderança'] },
            { nome: 'Vozes do Túmulo', formula: 'PRE + Empatia + Vozes do Túmulo', quando: 'Investigação espiritual, extrair memórias dos mortos', parts: ['PRE', 'Empatia'] },
            { nome: 'Limite de Fantoches', formula: 'INT + Liderança + Servos', quando: 'Verificar capacidade antes do ritual de fantoches', parts: ['INT', 'Liderança', 'Servos'] },
            { nome: 'Percepção', formula: 'RAC + PRE', quando: 'Detectar morte recente, presença púrpura, rituais ocultos', parts: ['RAC', 'PRE'] }
        ]
    },
    'Invocador': {
        nome: 'Invocador',
        testes: [
            { nome: 'Contato (Abertura)', formula: 'PRS + Performance + CA + Contato c/ o Oitavo + Sacrifício', quando: 'Abrir canal com a Oitava (invocar, viajar, ouvir), puxar Estados', parts: ['PRS', 'Performance', 'Contato c/ o Oitavo', 'Sacrifício'] },
            { nome: 'Selo (Controle)', formula: 'RAC + Abismo + Selo Abissal + Sacrifício', quando: 'Conter criaturas, fechar fendas, ocultar rastros, desconvocar', parts: ['RAC', 'Abismo', 'Selo Abissal', 'Sacrifício'] },
            { nome: 'Percepção', formula: 'RAC + PRE', quando: 'Detectar ameaças, distorções, fendas e anomalias', parts: ['RAC', 'PRE'] }
        ]
    },
    'Druida': {
        nome: 'Druida',
        testes: [
            { nome: 'Domar Aliado', formula: 'PRE + Domar + Aliado Animal', quando: 'Fora de combate, criar vínculo com criatura', parts: ['PRE', 'Domar', 'Aliado Animal'] },
            { nome: 'Comandar Aliado', formula: 'PRE + Liderança + Aliado Animal', quando: 'Dar ordens a aliado animal em cena', parts: ['PRE', 'Liderança', 'Aliado Animal'] },
            { nome: 'Convocar Manada', formula: 'PRE + Liderança + Linguagem Animal', quando: 'Chamar animais próximos (custa 1 DET)', parts: ['PRE', 'Liderança', 'Linguagem Animal'] },
            { nome: 'Fusão Selvagem', formula: 'PRE + Aliado Animal + Linguagem Animal', quando: 'Unir-se espiritualmente a um aliado (custa 1 DET)', parts: ['PRE', 'Aliado Animal', 'Linguagem Animal'] },
            { nome: 'Preparar Loção', formula: 'RAC + Herbalismo + Maceração + Ferramenta', quando: 'Fora de combate, preparar loções', parts: ['RAC', 'Herbalismo', 'Maceração'] },
            { nome: 'Dosagem', formula: 'INT + Herbalismo + Dosagem', quando: 'Definir potência de loções', parts: ['INT', 'Herbalismo', 'Dosagem'] },
            { nome: 'Percepção', formula: 'RAC + PRE', quando: 'Notar armadilhas, emboscadas, rastros e sinais naturais', parts: ['RAC', 'PRE'] }
        ]
    },
    'Pallacerdote': {
        nome: 'Pallacerdote',
        testes: [
            { nome: 'Prece Breve', formula: 'PRE + Fluxomancia + Devoção em Palla', quando: 'Fora de combate, reabastecer ânimo; em luz natural, +1 Graça', parts: ['PRE', 'Fluxomancia', 'Devoção em Palla'] },
            { nome: 'Bênção', formula: 'PRE + Performance + Fluxomancia + Símbolo Sagrado + B.Símbolo', quando: 'Conjurar bênçãos, cura, proteção e luz', parts: ['PRE', 'Performance', 'Fluxomancia', 'Símbolo Sagrado'] },
            { nome: 'Súplica', formula: 'MAN + Performance + Fluxomancia + Símbolo Sagrado + B.Símbolo', quando: 'Conjurar efeitos de controle, debuffs e manipulação divina', parts: ['MAN', 'Performance', 'Fluxomancia', 'Símbolo Sagrado'] },
            { nome: 'Percepção', formula: 'RAC + PRE', quando: 'Detectar ameaças, emboscadas e magia hostil', parts: ['RAC', 'PRE'] }
        ]
    },
    'Runimago': {
        nome: 'Runimago',
        testes: [
            { nome: 'Construção de Runa', formula: 'INT ou RAC + Runomancia + Artus + Aspectus + (Sigilus menor)', quando: 'Criar runas gravadas ou mentalizadas', parts: ['INT|RAC', 'Runomancia'] },
            { nome: 'Mentalização (Combate)', formula: 'INT + Runomancia + Mentalização − Complexidade', quando: 'Criar runa temporária sem gravação em combate', parts: ['INT', 'Runomancia', 'Mentalização'] },
            { nome: 'Diagnóstico Rúnico', formula: 'RAC + Runomancia + Diagnóstico', quando: 'Analisar, identificar falhas e desarmar runas existentes', parts: ['RAC', 'Runomancia', 'Diagnóstico'] },
            { nome: 'Percepção', formula: 'RAC + PRE', quando: 'Detectar runas ativas, fluxos mágicos e anomalias arcanas', parts: ['RAC', 'PRE'] }
        ]
    },
    'Sangral': {
        nome: 'Sangral',
        testes: [
            { nome: 'Moldar Sangue', formula: 'DES + Manip. de Sangue', quando: 'Moldar sangue em formas (cordas, agulhas, névoa)', parts: ['DES', 'Manip. de Sangue'] },
            { nome: 'Solidificar Arma', formula: 'FOR ou DES + Solidif. Hemática', quando: 'Criar armas de sangue sólido', parts: ['FOR|DES', 'Solidif. Hemática'] },
            { nome: 'Escudo Hemático', formula: 'VIG + Solidif. Hemática', quando: 'Criar escudos e barreiras de sangue', parts: ['VIG', 'Solidif. Hemática'] },
            { nome: 'Empatia Sanguínea', formula: 'RAC + Empatia Sanguínea', quando: 'Ler emoções, saúde e contaminações pelo sangue', parts: ['RAC', 'Empatia Sanguínea'] },
            { nome: 'Transfusão', formula: 'INT + Manip. de Sangue', quando: 'Curar aliados ou causar dano por sangue', parts: ['INT', 'Manip. de Sangue'] },
            { nome: 'Absorver Sangue', formula: 'VIG + Manip. de Sangue', quando: 'Absorver sangue derramado para reabastecer Bolha', parts: ['VIG', 'Manip. de Sangue'] },
            { nome: 'Resistir Efeito Hemático', formula: 'AUT + Empatia Sanguínea', quando: 'Resistir manipulação externa do próprio sangue', parts: ['AUT', 'Empatia Sanguínea'] }
        ]
    },
    'Xamã': {
        nome: 'Xamã',
        testes: [
            { nome: 'Cravar Totem', formula: 'RAC + Fluxomancia + Totemismo', quando: 'Posicionar totem espiritual no local', parts: ['RAC', 'Fluxomancia', 'Totemismo'] },
            { nome: 'Buscar Vestígio', formula: 'PRE + Performance + Comunhão c/ Ecos', quando: 'Procurar vestígios de alma ou presença espiritual', parts: ['PRE', 'Performance', 'Comunhão c/ Ecos'] },
            { nome: 'Transcendência (Projetor)', formula: 'AUT + Fluxomancia + Transcendência', quando: 'Projetar consciência além do Véu (custa 2 DET)', parts: ['AUT', 'Fluxomancia', 'Transcendência'] },
            { nome: 'Transcendência (Receptor)', formula: 'PRS + AUT + Transcendência', quando: 'Permitir que Eco compartilhe o corpo (custa 2 DET)', parts: ['PRS', 'AUT', 'Transcendência'] },
            { nome: 'Comunhão Simples', formula: 'PRE + Performance + Comunhão c/ Ecos', quando: 'Comunicar-se com Eco ou espírito (custa 1 DET)', parts: ['PRE', 'Performance', 'Comunhão c/ Ecos'] },
            { nome: 'Exorcismo', formula: 'PRS + Performance + Exorcismo vs PRS do Espírito', quando: 'Expulsar espíritos de pessoas, objetos ou locais', parts: ['PRS', 'Performance', 'Exorcismo'] },
            { nome: 'Percepção Espiritual', formula: 'RAC + PRE + Visão do Véu', quando: 'Perceber essências, Ecos e perturbações espirituais', parts: ['RAC', 'PRE', 'Visão do Véu'] },
            { nome: 'Resistir Possessão', formula: 'AUT + Transcendência vs PRS do Eco', quando: 'Resistir tentativa de possessão espiritual', parts: ['AUT', 'Transcendência'] }
        ]
    },
    'Bardo': {
        nome: 'Bardo',
        testes: [
            { nome: 'Performance Sonora', formula: 'PRE + Performance + Sonoromancia + Instrumento', quando: 'Ativar efeitos musicais (inspirar, debilitar, encantar)', parts: ['PRE', 'Performance'] },
            { nome: 'Inspiração', formula: 'PRE + Performance + Liderança', quando: 'Conceder bônus a aliados com música/palavras', parts: ['PRE', 'Performance', 'Liderança'] },
            { nome: 'Percepção', formula: 'RAC + PRE', quando: 'Detectar sons, vibrações e ameaças', parts: ['RAC', 'PRE'] }
        ]
    }
};
