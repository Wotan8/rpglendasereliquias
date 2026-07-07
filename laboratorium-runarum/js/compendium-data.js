/* =====================================================================
   ᛟ COMPÊNDIO DA MAGIA RÚNICA — Dados de referência (regras estáticas)
   ---------------------------------------------------------------------
   Contém TODAS as regras do livro exceto os Elementos Rúnicos em si
   (Artus/Aspectus/Sigilus), que são cadastrados no Painel do Criador e
   lidos dinamicamente do Firestore. Usado pelas abas do Laboratorium e
   pela engine de auditoria (rune-engine.js).
   ===================================================================== */

// ---------- Tabelas usadas pela engine ----------
const RUNO_TABELAS = {
    subcarga: [
        { min: 100, nome: 'Ativação plena', efeito: 'Funciona como projetado; drena o CT.', cor: '#22c55e' },
        { min: 80, nome: 'Ativação Anêmica', efeito: 'Artus e Aspectus operam 1 nível abaixo (mín. 1); −1 no Alvo. Consome toda a carga.', cor: '#eab308' },
        { min: 50, nome: 'Engasgo', efeito: 'Teste de Runomancia (Alvo −2). Sucesso: efeito mínimo (Nv1). Falha: fiasco + Rastro forte (+2). Consome toda a carga.', cor: '#f97316' },
        { min: 25, nome: 'Circuito Faminto', efeito: 'Não ativa. Essência presa emite Rastro contínuo (+2) até completar. Sem Armazenador: perde 10%/h.', cor: '#ef4444' },
        { min: 0, nome: 'Inerte', efeito: 'A Essência não vence a resistência do circuito. Reflui ou dissipa a 10%/h.', cor: '#64748b' },
    ],
    sobrecarga: [
        { min: 1, max: 3, efeito: 'Aquecimento leve. Brilho residual, zumbido. Sem dano mecânico.', cor: '#eab308' },
        { min: 4, max: 8, efeito: 'Instabilidade. Efeito oscila, −1 no Alvo. Pode desligar após 1d6 min.', cor: '#f97316' },
        { min: 9, max: 15, efeito: 'Efeito colateral do Aspectus (+1d6 dano afim). A runa desativa.', cor: '#ef4444' },
        { min: 16, max: 25, efeito: 'Falha estrutural. Explosão = (excedente ÷ 5)d6. Runa destruída.', cor: '#dc2626' },
        { min: 26, max: Infinity, efeito: 'Colapso total. (excedente ÷ 3)d6 em raio de 5 m. Ressonância Caótica possível.', cor: '#991b1b' },
    ],
    // Confluências: nomes normalizados minúsculos
    confluencias: [
        { elemento: 'Vapor', a: 'fogo', b: 'agua', grau: 'Qualquer', redutor: 0, classe: 'fisica' },
        { elemento: 'Névoa', a: 'agua', b: 'vento', grau: 'IGUAL ou Água MAIOR', redutor: 0, classe: 'fisica' },
        { elemento: 'Gelo', a: 'agua', b: 'vento', grau: 'Vento MAIOR', redutor: 0, classe: 'fisica' },
        { elemento: 'Lava', a: 'fogo', b: 'terra', grau: 'Qualquer', redutor: 0, classe: 'fisica' },
        { elemento: 'Metal', a: 'terra', b: 'fogo', grau: 'Terra MAIOR ou IGUAL', redutor: 0, classe: 'fisica' },
        { elemento: 'Areia', a: 'terra', b: 'vento', grau: 'Qualquer', redutor: 0, classe: 'fisica' },
        { elemento: 'Lama/Argila', a: 'agua', b: 'terra', grau: 'IGUAL ou Água MAIOR', redutor: 0, classe: 'fisica' },
        { elemento: 'Sal', a: 'agua', b: 'terra', grau: 'Terra MAIOR', redutor: 0, classe: 'fisica' },
        { elemento: 'Fumaça', a: 'fogo', b: 'vento', grau: 'Qualquer', redutor: 0, classe: 'fisica' },
        { elemento: 'Cinzas', a: 'fogo', b: 'natureza', grau: 'Fogo MAIOR ou IGUAL', redutor: 0, classe: 'fisica' },
        { elemento: 'Raio', a: 'luz', b: 'vento', grau: '—', redutor: -2, classe: 'arcana' },
        { elemento: 'Plasma', a: 'fogo', b: 'luz', grau: '—', redutor: -3, classe: 'arcana' },
        { elemento: 'Gravidade', a: 'terra', b: 'espacial', grau: '—', redutor: -3, classe: 'arcana' },
        { elemento: 'Vácuo', a: 'espacial', b: 'vento', grau: '—', redutor: -2, classe: 'arcana' },
        { elemento: 'Cristal de Gelo', a: 'agua', b: 'cristal', grau: '—', redutor: -1, classe: 'arcana' },
        { elemento: 'Miasma', a: 'vento', b: 'necrotico', grau: '—', redutor: -3, classe: 'proibida', consequencia: 'Crime' },
        { elemento: 'Fogo Fátuo', a: 'fogo', b: 'necrotico', grau: '—', redutor: -3, classe: 'proibida', consequencia: 'Heresia' },
        { elemento: 'Névoa Abissal', a: 'vento', b: 'abissal', grau: '—', redutor: -4, classe: 'proibida', consequencia: 'Caça' },
        { elemento: 'Cronogelo', a: 'temporal', b: 'agua', grau: '—', redutor: -4, classe: 'proibida', consequencia: 'Proibido' },
        { elemento: 'Luz Inversa', a: 'luz', b: 'abissal', grau: '—', redutor: -5, classe: 'proibida', consequencia: 'Pena de morte' },
        { elemento: 'Chama Eterna', a: 'fogo', b: 'temporal', grau: '—', redutor: -4, classe: 'proibida', consequencia: 'Exige licença' },
    ],
    intensidade: [
        { nv: 1, intensidade: 'Fraca / Efêmera', duracao: 'Segundos a 1 min', ex: 'Faísca, brisa, brilho tênue' },
        { nv: 2, intensidade: 'Moderada', duracao: 'Até 10 min', ex: 'Chama de tocha, vento forte' },
        { nv: 3, intensidade: 'Intensa', duracao: 'Até 1 hora', ex: 'Fogueira, ventania, tremor leve' },
        { nv: 4, intensidade: 'Poderosa', duracao: 'Até 1 cena', ex: 'Incêndio, furacão localizado' },
        { nv: 5, intensidade: 'Absoluta', duracao: 'Permanente', ex: 'Fusão, tormenta, colapso' },
    ],
    complexidadeRuna: [
        { faixa: [3, 4], nome: 'Simples', mentalizacao: 1, tempo: '1 ação' },
        { faixa: [5, 7], nome: 'Moderada', mentalizacao: 2, tempo: '2 ações' },
        { faixa: [8, 12], nome: 'Complexa', mentalizacao: 3, tempo: '1 turno completo' },
        { faixa: [13, 999], nome: 'Obra-prima', mentalizacao: null, tempo: 'Não pode ser mentalizada' },
    ],
};

// ---------- Seções do Compêndio (aba de consulta) ----------
const RUNO_COMPENDIO = [
    {
        id: 'fundamentos', icone: '📖', titulo: 'Parte I — Fundamentos', html: `
<p><em>"A magia não é um dom. É uma linguagem. E como toda linguagem, pode ser aprendida."</em></p>
<p>A Runomancia é a única escola verdadeiramente científica de magia em Vasteluna. O Runomago não implora a deuses — ele <b>escreve</b>. Cada runa é um circuito; cada traço, um componente.</p>
<h4>Elementos Rúnicos</h4>
<table><tr><th>Elemento</th><th>Papel</th><th>Níveis</th><th>Analogia</th></tr>
<tr><td><b>Artus</b></td><td>O verbo: Criar, Destruir, Entender, Modificar, Controlar</td><td>1–5</td><td>O programa</td></tr>
<tr><td><b>Aspectus</b></td><td>A natureza da energia (Fogo, Água, Vida…)</td><td>1–5</td><td>O combustível refinado</td></tr>
<tr><td><b>Sigilus</b></td><td>Captação, condução, modulação, lógica, armazenamento, emissão, exaustão</td><td>1–3</td><td>A fiação, as válvulas, os sensores</td></tr></table>
<p>⟐ <b>Runa Plena</b> tem Núcleo (Artus + Aspectus) e produz efeito. <b>Runa Auxiliar</b> não tem Núcleo: só Sigilus — sente, decide, armazena ou retransmite (essencial em Cadeias).</p>
<h4>O Caminho da Essência (fluxo canônico)</h4>
<ol><li><b>Captação</b> — a Essência entra, ainda genérica</li><li><b>Armazenamento</b> — a carga acumula até a ativação</li>
<li><b>Lógica</b> — válvulas e decisões: quando, para quem, quantas vezes</li><li><b>Condução</b> — a Essência viaja, divide-se, une-se</li>
<li><b>Núcleo</b> (Aspectus → Artus) — ganha natureza e depois ação</li><li><b>Modulação</b> — ajustes finos de potência e pureza</li>
<li><b>Emissão</b> — o efeito sai; sempre a posição final do ramo</li><li><b>Exaustão</b> — o residual é eliminado; daqui nasce o Rastro</li></ol>
<p>⟐ <b>Regra dos Veios Estruturais:</b> cada elemento já inclui no custo os traços curtos que o conectam aos vizinhos. Veios só são custeados à parte quando têm função própria (trechos longos, capacidade extra, canais de Confluência).</p>`
    },
    {
        id: 'leis', icone: '⚖️', titulo: 'As Cinco Leis da Runomancia', html: `
<ol>
<li><b>Lei da Conservação</b> — "A Essência que entra deve sair." Tudo vira efeito + trabalho interno + residual. O residual precisa de Exaustor ou cobra seu preço (Sobrecarga). Nenhum arranjo produz mais energia do que consome — inclusive a Âncora Temporal.</li>
<li><b>Lei da Forma</b> — A runa executa exatamente o que está gravado, nunca o que se quis gravar. Um traço a mais é um componente a mais; um traço torto é um defeito.</li>
<li><b>Lei do Circuito</b> — A Essência só flui por caminhos gravados. Circuito interrompido = runa morta; fluxos que se cruzam sem Ponte se misturam ou entram em curto. Nada "pula" — exceto o filamento do Elo.</li>
<li><b>Lei do Rastro</b> (⟐ antes "Lei do Eco") — Todo circuito ativo emite assinatura detectável, proporcional às perdas e à exaustão. Quanto melhor o Exaustor, mais discreta a runa — mas o rastro nunca é zero.</li>
<li><b>Lei da Afinidade</b> — Essência aspectada interage com matéria viva conforme a afinidade entre naturezas. Governa o Infusor, o Sifão Vital e todo contato entre essência e carne.</li>
</ol>`
    },
    {
        id: 'fluxos', icone: '🌊', titulo: 'Tipos de Fluxo (§1.5)', html: `
<table><tr><th>Fluxo</th><th>Carrega</th><th>Quem lê/consome</th><th>Riscos</th></tr>
<tr><td><b>Essência Genérica</b></td><td>Energia bruta, cinza-perolada</td><td>Aspectus, Armazenadores, Exaustores</td><td>Só o volume</td></tr>
<tr><td><b>Essência Aspectada</b></td><td>Energia com natureza (Vermelha=Fogo…)</td><td>Artus, Emissores, Infusor</td><td>Afinidade (Lei V); contamina Armazenadores comuns</td></tr>
<tr><td><b>Elemento Confluído</b></td><td>Duas naturezas fundidas (Vapor, Lava…)</td><td>Artus, Emissores</td><td>Instabilidade (Redutores); misturas múltiplas exigem Harmonizador</td></tr>
<tr><td><b>Sinal Lógico</b></td><td>Sim/não, valores, contagens (&lt;0,1 Ess)</td><td>Gatilho, Comparador, Contador, Selector, Elo</td><td>Interferência se cruzar fluxo pesado sem Ponte</td></tr>
<tr><td><b>Padrão</b></td><td>Biometria, forma, sequência, mapa</td><td>Reconhecedores, Selector Nv3, Âncora Temporal, Elo Nv3</td><td>Não trafega por Veios comuns; corrompe misturado a fluxo aspectado</td></tr>
<tr><td><b>Essência Contaminada</b></td><td>Traços de Púrpura/Preta</td><td>Filtro (remove)</td><td>Colaterais imprevisíveis; corrói Filtros fracos</td></tr></table>
<p><b>Regra de bolso:</b> Genérica entra → vira Aspectada no Aspectus → (opcional) vira Elemento na Confluência → sai pelo Emissor. Se um trecho mistura dois tipos sem um Sigilus que lide com ambos, você desenhou um defeito.</p>`
    },
    {
        id: 'energia', icone: '⚡', titulo: 'Parte II — Sistema Energético', html: `
<h4>Fontes de Essência (§2.2)</h4>
<table><tr><th>Fonte</th><th>Rende</th><th>Velocidade</th><th>Sigilus</th></tr>
<tr><td>Cristal de Luni (Ativado)</td><td>25 Ess</td><td>1–6 s</td><td>Sifão Cristalino ⟐ (obrigatório)</td></tr>
<tr><td>Captação ambiental</td><td>1–6 Ess/h</td><td>Muito lenta</td><td>Raiz</td></tr>
<tr><td>Linha de Ley (temporária)</td><td>3–15 Ess/h</td><td>Lenta</td><td>Sifão de Fluxo</td></tr>
<tr><td>Ley/Nexo (fixa)</td><td>5–20 Ess/h</td><td>Moderada</td><td>Âncora</td></tr>
<tr><td>Corpo do Runomago</td><td>5 Ess/pulso (1 En)</td><td>Rítmica</td><td>Pulso</td></tr>
<tr><td>Corpo de terceiros</td><td>2–8 Ess/s</td><td>Rápida e criminosa</td><td>Sifão Vital</td></tr>
<tr><td>Outra runa (cadeia)</td><td>Sinal + até 40 Ess</td><td>Quase instantânea</td><td>Elo</td></tr></table>
<h4>Lunis (§2.3)</h4>
<p>Luni = moeda (1 L$) e célula de energia. Cunhagem: cristal Ativado, 25 Ess certificados, selo tribal. Extração total fragmenta o cristal — alimentar runas é queimar moeda. <b>Lunis Reacesos</b> (recarregados por Dreno Nv3/Âncoras) são legais como combustível (~0,5 L$), mas passá-los como moeda é falsificação — crime capital Ganute. <b>Extração Parcial</b> (Sifão Nv3 ou Atenuador) preserva o "troco".</p>
<table><tr><th>Qualidade</th><th>Carga</th><th>Eficiência (Sifão Nv1/2/3)</th></tr>
<tr><td>Bruto</td><td>10–25 Ess</td><td>30% / 50% / 70%</td></tr>
<tr><td>Trabalhado</td><td>20–25 Ess</td><td>70% / 85% / 95%</td></tr>
<tr><td>Ativado (moeda)</td><td>25 Ess</td><td>100% em qualquer nível ⟐</td></tr></table>
<h4>Limite de Absorção (§2.4)</h4>
<table><tr><th>Configuração</th><th>Teto simultâneo</th></tr>
<tr><td>Sifão Cristalino Nv1</td><td>25 Ess (1 Luni)</td></tr>
<tr><td>Sifão Cristalino Nv2–3</td><td>50 Ess (2 Lunis)</td></tr>
<tr><td>+ Amplificador de Captação Nv1/2/3</td><td>75 / 125 / 250 Ess (3/5/10 Lunis)</td></tr></table>
<p><b>Carregamento em Série ⟐:</b> inserções sucessivas são permitidas enquanto houver capacidade de armazenamento. Captação contínua sem Armazenador só sustenta Regime Contínuo — não "acumula no ar".</p>
<h4>Contabilidade da Ativação (§2.6) ⟐</h4>
<p><b>CT = Artus + Aspectus + Σ Sigilus</b>, consumido por ativação. Na entrada: tudo vai ao Armazenador até a capacidade; o excedente corre ao Exaustor; se exceder também o Exaustor, é Sobrecarga. Na ativação: drena exatamente o CT; a sobra permanece armazenada. Elementos consomem seu custo como trabalho próprio.</p>
<h4>⟐ Regime Contínuo (§2.7)</h4>
<p>Efeitos <b>estáticos e não-adversos</b> (luz, calor morno, alarme, tranca) mantêm-se indefinidamente se: <b>taxa de captação contínua (Ess/h) ≥ 2 × nível do Aspectus</b>. Efeitos dinâmicos/adversos: cada uso é uma ativação plena.</p>`
    },
    {
        id: 'subsobre', icone: '📉', titulo: 'Subcarga e Sobrecarga (§2.8–2.9)', html: `
<h4>⟐ Subcarga — carga disponível ÷ CT no acionamento</h4>
<table><tr><th>Carga</th><th>Resultado</th><th>Efeito</th></tr>
${RUNO_TABELAS.subcarga.map(r => `<tr><td>${r.min === 100 ? '≥100%' : r.min === 0 ? '&lt;25%' : r.min + '–' + (r.min === 80 ? 99 : r.min === 50 ? 79 : 49) + '%'}</td><td style="color:${r.cor}"><b>${r.nome}</b></td><td>${r.efeito}</td></tr>`).join('')}
</table>
<p><b>Boa prática:</b> um Comparador de Carga entre Armazenador e Gatilho (4 Ess) só abre o circuito com carga ≥ CT — elimina Anêmicas e Engasgos.</p>
<h4>Sobrecarga — excedente não escoado</h4>
<table><tr><th>Excedente</th><th>Consequência</th></tr>
${RUNO_TABELAS.sobrecarga.map(r => `<tr><td>${r.max === Infinity ? '26+' : r.min + '–' + r.max} Ess</td><td style="color:${r.cor}">${r.efeito}</td></tr>`).join('')}
</table>
<p><b>Exaustão (§2.10):</b> Respiro dissipa no ambiente (origem do Rastro), Dreno devolve à fonte, Reciclador reaproveita. Uma runa sem Exaustor não é uma runa: é uma aposta.</p>`
    },
    {
        id: 'artus', icone: '⚙️', titulo: 'Parte III — Artus, as Cinco Ações', html: `
<p>Cinco verbos, custo idêntico (5/10/20/40/80 Ess), métricas de escala distintas. Nv4 permite Mentalização Pura em combate; Nv5 é maestria.</p>
<table><tr><th>Nv</th><th>CRIAR (volume)</th><th>DESTRUIR</th><th>ENTENDER (raio)</th><th>MODIFICAR</th><th>CONTROLAR</th></tr>
<tr><td>1</td><td>20 cm³ — chama de vela</td><td>10 cm³ — corroer cadeado</td><td>3 m</td><td>5 kg / 10 cm³</td><td>5 m / 10 kg</td></tr>
<tr><td>2</td><td>1 m³ — barreira pessoal</td><td>0,5 m³ — porta</td><td>10 m</td><td>50 kg / 0,5 m³</td><td>15 m / 100 kg</td></tr>
<tr><td>3</td><td>8 m³ — parede 2×4 m</td><td>4 m³ — parede</td><td>30 m</td><td>500 kg / 5 m³</td><td>30 m / 500 kg</td></tr>
<tr><td>4</td><td>27 m³ — cúpula 3×3×3</td><td>20 m³ — cômodo</td><td>100 m</td><td>2.000 kg / 20 m³</td><td>60 m / 2.000 kg</td></tr>
<tr><td>5</td><td>125 m³ — portal</td><td>100 m³ — estrutura</td><td>500 m</td><td>10.000 kg / 100 m³</td><td>150 m / 10.000 kg</td></tr></table>`
    },
    {
        id: 'aspectus', icone: '✨', titulo: 'Parte IV — Aspectus e Afinidade', html: `
<h4>Intensidade e Duração por Nível (§4.2)</h4>
<table><tr><th>Nv</th><th>Intensidade</th><th>Duração (1 carga do CT)</th><th>Exemplo</th></tr>
${RUNO_TABELAS.intensidade.map(r => `<tr><td>${r.nv}</td><td>${r.intensidade}</td><td>${r.duracao}</td><td>${r.ex}</td></tr>`).join('')}
</table>
<h4>Afinidade (§4.3)</h4>
<table><tr><th>Alvo</th><th>Afinidade</th></tr>
<tr><td>Praticante daquela magia</td><td>Alta</td></tr><tr><td>Raça/tribo com ligação elemental</td><td>Alta</td></tr>
<tr><td>Fluxomancia + conhece o Aspectus</td><td>Moderada</td></tr><tr><td>Ser vivo comum</td><td>Baixa</td></tr>
<tr><td>Aspectus oposto à natureza do alvo</td><td>Sem Afinidade</td></tr><tr><td>Necrótico/Abissal em alvo vivo</td><td>Sem Afinidade + corrupção</td></tr></table>
<h4>Reação por Dose Infundida (§4.4)</h4>
<table><tr><th>Dose (Ess)</th><th>Alta</th><th>Moderada</th><th>Baixa</th><th>Sem afinidade</th></tr>
<tr><td>Mínima (1–3)</td><td>Benefício sutil</td><td>Formigamento</td><td>Náusea, tremores</td><td>Dor aguda, −1 Alvo</td></tr>
<tr><td>Baixa (4–8)</td><td>Terapêutico</td><td>Moderado + colaterais</td><td>1d6</td><td>2d6, hemorragia</td></tr>
<tr><td>Moderada (9–20)</td><td>Bônus temporários</td><td>Forte mas instável</td><td>3d6, falência parcial</td><td>5d6, morte provável</td></tr>
<tr><td>Alta (21–40)</td><td>Transformação</td><td>Sobrecarga perigosa</td><td>Morte quase certa</td><td>Morte instantânea</td></tr></table>
<p><b>Protocolo de Valdris:</b> nunca injetar mais de 3 Ess em um ser vivo sem supervisão de um Mestre Runomante.</p>`
    },
    {
        id: 'confluencia', icone: '🜄', titulo: 'Confluência Elemental (§4.5)', html: `
<p>Requisitos: <b>2 Aspectus</b> dominados + <b>2 Veios</b> próprios + <b>1 Confluência</b> + 1 Artus + Runomancia 2+. O <b>Grau</b> (proporção de níveis) decide qual essência domina; Atenuador em um canal gera desequilíbrio (+2 Ess no Nv1).</p>
<table><tr><th>Elemento</th><th>A + B</th><th>Grau exigido ⟐</th><th>Redutor</th><th>Classe</th></tr>
${RUNO_TABELAS.confluencias.map(c => `<tr><td><b>${c.elemento}</b></td><td>${c.a} + ${c.b}</td><td>${c.grau}</td><td>${c.redutor || 0}</td><td>${c.classe}${c.consequencia ? ' — ' + c.consequencia : ''}</td></tr>`).join('')}
</table>
<p>Confluência Nv1 só aceita Físicas (Arcanas/Proibidas = falha automática). Harmonizador reduz o Redutor de Proibidas (−1 Nv2 / −2 Nv3). Falha em runas elementais: por 1 = essências se manifestam separadas; por 2–3 = Grau errado; por 4–5 = explosão (maior Aspectus)d6; crítica = Colapso Elemental (soma dos níveis)d6.</p>`
    },
    {
        id: 'projeto', icone: '📐', titulo: 'Parte VI — Projetando e Gravando', html: `
<h4>O Projeto em Sete Passos</h4>
<ol><li><b>Efeito</b> — Artus + Aspectus e níveis pela escala física</li><li><b>Fonte</b> — Lunis exigem Sifão Cristalino; verifique o teto</li>
<li><b>Armazenamento</b> — capacidade ≥ CT (ou Regime Contínuo)</li><li><b>Lógica</b> — quando dispara e quando NÃO dispara</li>
<li><b>Condução/modulação</b> — Confluência (+2 Veios); Raiz pede Filtro; Amplificadores pedem Estabilizador; cruzamentos pedem Ponte</li>
<li><b>Emissão</b> — Emissor na posição final; Infusor para corpos; Elo para cadeias</li>
<li><b>Exaustão</b> — dimensione para a maior inserção possível − espaço livre típico; nunca menor que Respiro Nv1</li></ol>
<h4>Teste de Construção (§6.2)</h4>
<p><b>Alvo = INT ou RAC + Runomancia + Artus + Aspectus + (menor Sigilus usado)</b>. Redutores de Confluência se aplicam. Sigilus Nv2 crucial: +1. Eficiência Arcana: +1/nível com Essência limitada ou cristais ruins.</p>
<h4>Regras de Posição (§6.3)</h4>
<table><tr><th>Elemento</th><th>Posição</th></tr>
<tr><td>Captadores / Elo receptor</td><td>Início do circuito (a boca)</td></tr>
<tr><td>Emissores / Infusor / Elo emissor</td><td>Posição final do ramo (a saída)</td></tr>
<tr><td>Exaustores</td><td>Ramificam de junções — após Armazenador e após Núcleo</td></tr>
<tr><td>Reconhecedores</td><td>Sempre pareados a uma Memória (sem exceção)</td></tr>
<tr><td>Núcleo (Aspectus → Artus)</td><td>Após lógica/condução; antes da modulação final e emissão</td></tr>
<tr><td>Cruzamentos de fluxo</td><td>Exigem Ponte</td></tr>
<tr><td>2+ Confluências</td><td>Exigem Harmonizador Nv2+</td></tr>
<tr><td>Amplificador (qualquer) Nv3</td><td>Exige Estabilizador no mesmo ramo</td></tr></table>
<h4>⟐ Tempo e Custo de Gravação (§6.4)</h4>
<p><b>Tempo = CT ÷ 5 horas</b> (−10% por nível de Gravação Rúnica, mín. 30%). <b>Material ≈ 2 L$ × CT</b> (×2 com elemento Avançado; ×3 com Mestre). Superfícies vivas exigem Infusor ou tatuagem ritual.</p>
<h4>⟐ Falha de Gravação (§6.5)</h4>
<table><tr><th>Margem</th><th>Consequência</th></tr>
<tr><td>1</td><td>Traço defeituoso detectável; corrigir: 10 min × nível do elemento</td></tr>
<tr><td>2–3</td><td>Defeito oculto — 1ª ativação: teste de Runomancia ou Engasgo</td></tr>
<tr><td>4–5</td><td>Circuito inviável; metade do material perdida</td></tr>
<tr><td>Crítica</td><td>Ativa parcialmente na gravação: Sobrecarga com excedente = CT ÷ 5</td></tr></table>
<h4>Checklist do Gravador (§6.6)</h4>
<ol><li>CT somado e conferido?</li><li>Fonte cobre o CT e respeita o teto?</li><li>Armazenador ≥ CT (ou Regime Contínuo)?</li>
<li>Exaustor dimensionado para a pior inserção?</li><li>A lógica cobre "quando NÃO disparar"?</li>
<li>Reconhecedor tem Memória? Cruzamento tem Ponte? Amplificador Nv3 tem Estabilizador?</li>
<li>Redutores de Confluência aplicados?</li><li>Tempo e material orçados — e pagos?</li></ol>
<h4>Erros Comuns (e Célebres)</h4>
<ul><li>Esquecer o Sifão Cristalino e apoiar o Luni esperando osmose</li><li>Armazenador menor que o CT — Subcarga perpétua</li>
<li>Runa sem Exaustor — funciona até alguém usar um cristal melhor</li><li>Reconhecedor sem Memória — reconhece exatamente ninguém</li>
<li>Cruzar fluxos sem Ponte</li><li>Receita Arcana em Confluência Nv1 — falha automática</li>
<li>Dose &lt; 5 Ess em Infusor Nv1</li><li>Contar com Raiz em combate — ela abastece por hora, não por turno</li></ul>`
    },
    {
        id: 'estetica', icone: '🎨', titulo: 'Parte VII — Estética Rúnica', html: `
<p>Pela Lei da Forma, o desenho é o componente. Um olhar treinado (Percepção + Runomancia) lê: complexidade pela <b>geometria-base</b>, nível pelo <b>refinamento</b>, essência pela <b>cor do lume</b>, estado pela <b>qualidade da luz</b>.</p>
<table><tr><th>Complexidade</th><th>Geometria-base</th></tr>
<tr><td>Iniciante</td><td>Traço único, forma aberta (a Raiz é um Y de radículas)</td></tr>
<tr><td>Intermediário</td><td>Forma fechada composta, 2+ traços encadeados</td></tr>
<tr><td>Avançado</td><td>Geometria entrelaçada — nós deliberados</td></tr>
<tr><td>Mestre</td><td>Glifo fractal com ilusão de tridimensionalidade</td></tr></table>
<table><tr><th>Nível</th><th>Refinamento</th><th>Tolerância ⟐</th></tr>
<tr><td>Nv1</td><td>O esqueleto</td><td>±1 mm</td></tr><tr><td>Nv2</td><td>+ anel de refinamento e encaixes exatos</td><td>±0,5 mm</td></tr>
<tr><td>Nv3</td><td>+ microinscrições e filigranas</td><td>±0,1 mm</td></tr>
<tr><td>Nv4 (Núcleo)</td><td>+ coroa orbital</td><td>±0,1 mm, simetria radial</td></tr>
<tr><td>Nv5 (Núcleo)</td><td>+ profundidade lavrada; brilho latente</td><td>de mestre; erros irreparáveis</td></tr></table>
<p><b>Miniaturização (§7.4):</b> cada nível de Gravação Rúnica acima do exigido reduz o glifo — até ⅓ com Gravação 3+. Elementos Mestre não miniaturizam.</p>
<table><tr><th>Estado de carga</th><th>Aparência</th></tr>
<tr><td>Descarregada</td><td>Fosca e inerte</td></tr><tr><td>Carregando</td><td>Lume percorre as linhas na cor da essência</td></tr>
<tr><td>Carregada</td><td>Brilho constante; Armazenadores pulsam devagar</td></tr>
<tr><td>Subcarga</td><td>Pulsação falhada — o lume avança e recua</td></tr>
<tr><td>Sobrecarga</td><td>Tremulação e branqueamento — afaste-se</td></tr>
<tr><td>Contaminada</td><td>Manchas púrpuras/negras contra o fluxo</td></tr></table>`
    },
    {
        id: 'mentalizacao', icone: '🧠', titulo: 'Parte VIII — Energia e Mentalização', html: `
<p>⟐ <b>Energia Máxima = (VIG + PRS) × 3</b>. Descanso curto restaura ¼; longo, o total. Energia ≠ Determinação (DET paga Manobras; Energia paga magia que passa pelo corpo).</p>
<p>⟐ <b>Taxa de Conversão Vital: 1 Energia = 5 Ess</b> — universal (Pulso, Sifão Vital, Mentalização Pura).</p>
<h4>Custo da Mentalização (§8.4)</h4>
<table><tr><th>Componente mentalizado</th><th>Esforço (En)</th><th>Requisito</th></tr>
<tr><td>Emissor/Lógico/Modulador Iniciante</td><td>2</td><td>Mentalização 1</td></tr>
<tr><td>Emissor/Lógico Intermediário</td><td>4</td><td>Mentalização 2</td></tr>
<tr><td>Emissor Avançado (Manifestador, Infusor)</td><td>8</td><td>Mentalização 3</td></tr>
<tr><td>Runa inteira</td><td>Mentalização Pura (§8.7)</td><td>Mentalização 4</td></tr></table>
<table><tr><th>Complexidade da runa</th><th>Mentalização mín.</th><th>Tempo</th></tr>
${RUNO_TABELAS.complexidadeRuna.map(r => `<tr><td>${r.nome} (${r.faixa[1] > 100 ? r.faixa[0] + '+' : r.faixa[0] + '–' + r.faixa[1]} componentes)</td><td>${r.mentalizacao ?? '—'}</td><td>${r.tempo}</td></tr>`).join('')}
</table>
<p><b>Runas de Reação</b> (Mentalização 3+): até 3 componentes, fora do turno, 2 DET.</p>
<h4>Mentalização Pura (§8.7)</h4>
<p>Mentalização 4 (+ Artus Nv4 para combate). Custo: <b>CT ÷ 5 em Energia + esforço dos componentes</b>. Redutor −3; apenas runas Simples. Toda falha atinge o corpo: por 1 = reflui; 2–3 = emissão parcial, 1 dano; 4–5 = curto no corpo, (nível do Aspectus)d6; crítica = Colapso Mental, dano total em 3 m.</p>
<h4>Limites do Corpo (§8.6)</h4>
<ul><li>Energia a 0: colapso</li><li>&gt;50% da Energia máx. em &lt;1 min: teste de VIG ou desmaia</li><li>&lt;25% da Energia: −2 em todos os testes</li></ul>`
    },
    {
        id: 'cadeias', icone: '🔗', titulo: 'Parte IX — Cadeias Rúnicas', html: `
<p>Runas fisicamente separadas interligadas pelo sigilo <b>Elo</b>. Cadeias lineares (A→B→C) ou ramificadas (Elo Nv3 alimenta 2 receptores). Runas Auxiliares são os nós baratos que dão inteligência à cadeia.</p>
<p>⟐ <b>Regra de Ouro: cada runa paga o próprio CT.</b> O Elo transmite comando (e, nos níveis altos, um complemento modesto de Ess) — nunca substitui a alimentação da runa a jusante.</p>
<table><tr><th>Modo de disparo</th><th>Comportamento</th></tr>
<tr><td><b>Imediato</b></td><td>Ativa assim que o pulso chega (respeitando a Subcarga)</td></tr>
<tr><td><b>Condicionado</b></td><td>Elo receptor → Lógico que segura o pulso: Gatilho Nv2+ (E/OU), Temporizador (atraso), Comparador (valor), Contador (acumula pulsos)</td></tr></table>
<p><b>Harmonização (§9.5):</b> limite base <b>2 runas por cadeia</b>; cada Harmonizador NvX em qualquer runa permite +X. Exceder: risco cumulativo de 10% por runa excedente de Ressonância em Cascata a cada disparo.</p>
<p><b>Cascata (§9.6):</b> Sobrecarga numa runa viaja pelos Elos — cada adjacente recebe (excedente ÷ 2), decaindo pela metade a cada salto. <b>Laços (A→B→A) são proibidos</b> — Ressonância Caótica garantida na 2ª volta.</p>
<p><b>Cortar (§9.7):</b> dano direto, Destruir Nv2+, ou afastar além do alcance. Cortar o Elo não derruba as runas — o pulso se perde no vão.</p>
<p><b>O que atravessa (§9.9):</b> Nv1 só Sinais; Nv2 + Essência Genérica; Nv3 + Padrões. Essência Aspectada e Elementos Confluídos despem-se da natureza no trajeto e chegam genéricos.</p>`
    },
    {
        id: 'pericias', icone: '📚', titulo: 'Parte XI — Aprendizado, Perícias e Manobras', html: `
<p><b>Lista de Estudo (§11.1):</b> 2 slots base; ao menos um momento de estudo por sessão — sem o roleplay, nada progride.</p>
<h4>Erudição Rúnica (§11.3)</h4>
<table><tr><th>Nível</th><th>Slots</th><th>Bônus</th></tr>
<tr><td>0</td><td>2</td><td>—</td></tr><tr><td>1</td><td>3</td><td>−1 sessão p/ Sigilus Iniciantes</td></tr>
<tr><td>2</td><td>4</td><td>−1 até Intermediário</td></tr><tr><td>3</td><td>5</td><td>−1 p/ todos os Sigilus</td></tr>
<tr><td>4</td><td>6</td><td>−1 também p/ Artus e Aspectus</td></tr><tr><td>5</td><td>7</td><td>2 itens do mesmo tipo</td></tr></table>
<h4>Perícias do Runomago (§11.4)</h4>
<table><tr><th>Perícia</th><th>Função</th><th>Limitada por</th></tr>
<tr><td>Gravação Rúnica</td><td>Gravar; −tempo; +durabilidade</td><td>Runomancia</td></tr>
<tr><td>Mentalização</td><td>Completar componentes por concentração</td><td>Runomancia</td></tr>
<tr><td>Erudição Rúnica</td><td>Slots e descontos; +1 identificar runas</td><td>INT</td></tr>
<tr><td>Diagnóstico Rúnico</td><td>Analisar/desmontar runas; desarma armadilhas</td><td>menor(Runomancia, Investigação)</td></tr>
<tr><td>Eficiência Arcana</td><td>+1/nível com Essência limitada</td><td>RAC</td></tr></table>
<h4>Runas em Combate (§11.5)</h4>
<ul><li><b>Preparadas:</b> gravadas antes; ação simples; sem DET</li><li><b>Mentalizadas:</b> completadas na hora via runas-base — Energia e ações pela complexidade</li><li><b>De Reação:</b> Mentalização 3+, 2 DET, até 3 componentes</li></ul>
<h4>Manobras do Runimago (§11.6 — custam DET; 1/turno)</h4>
<table><tr><th>Manobra</th><th>Custo</th><th>Efeito / Requisitos</th></tr>
<tr><td>Inscrição Veloz</td><td>1</td><td>Grava runa simples (3 comp.) como ação de movimento; ativa até o fim da cena</td></tr>
<tr><td>Sobrecarga</td><td>2</td><td>+50% potência; teste −4 ou a runa colapsa. Req.: Eficiência Arcana 2</td></tr>
<tr><td>Desconstrução</td><td>1</td><td>Diagnóstico vs. dificuldade; sucesso desativa. Req.: Diagnóstico 2</td></tr>
<tr><td>Encadeamento</td><td>2</td><td>Par de Elos Nv1 temporários (5 m, só sinal) até o fim da cena. Req.: Gravação 3</td></tr>
<tr><td>Improvisação</td><td>3</td><td>Artus/Aspectus sem nível (1×/cena), +2 Redutor. Req.: Mentalização 3</td></tr>
<tr><td>Escudo Rúnico</td><td>2</td><td>REAÇÃO: barreira que absorve Runomancia×3. Req.: Mentalização 2, Criar 2</td></tr>
<tr><td>Gatilho Remoto</td><td>1</td><td>Ativa runa preparada a até 30 m</td></tr>
<tr><td>Análise de Campo</td><td>1</td><td>Detecta runas/magias/Leys em 15 m. Req.: Fluxomancia 5</td></tr>
<tr><td>Ruína</td><td>3</td><td>Colapsa runa inimiga: (nível)d6 em 3 m. Req.: Diagnóstico 3, Destruir 2</td></tr>
<tr><td>Transferência</td><td>2</td><td>Move uma runa de superfície (até 5 m)</td></tr></table>`
    },
    {
        id: 'etica', icone: '⚖️', titulo: 'Parte XII — Ética, Lei e Sociedade', html: `
<p><b>Protocolo de Valdris:</b> juramento de nunca injetar mais de 3 Ess em um ser vivo sem supervisão de um Mestre Runomante. Violação = expulsão e perseguição pelo Conselho de Sábios Ganute.</p>
<table><tr><th>Prática</th><th>Status</th><th>Consequência</th></tr>
<tr><td>Sifão Vital em pessoas</td><td>Proibido</td><td>Agressão; crime capital contra prisioneiros em território Ganute</td></tr>
<tr><td>Infusão &gt; 3 Ess sem supervisão</td><td>Violação do Protocolo</td><td>Expulsão e perseguição acadêmica</td></tr>
<tr><td>Armadilhas letais com Infusor</td><td>Proibidas</td><td>Caça ao gravador; a runa é evidência</td></tr>
<tr><td>Combinações Proibidas</td><td>Conforme a receita</td><td>De crime a pena de morte; Chama Eterna exige licença</td></tr>
<tr><td>Lunis Reacesos como moeda</td><td>Falsificação</td><td>Crime capital Ganute</td></tr>
<tr><td>Efeito Sifão deliberado (drenar Ley)</td><td>Crime ambiental/tribal</td><td>Vingança garantida</td></tr>
<tr><td>Laços de Elo (A→B→A)</td><td>Banidos</td><td>"Não é crime — é seleção natural"</td></tr></table>
<p><b>Rastreabilidade (§12.3):</b> a Lei do Rastro faz de toda runa uma testemunha — o Respiro denuncia, o Diagnóstico reconstitui, o Reconhecedor Arcano identifica a assinatura do gravador.</p>`
    },
    {
        id: 'referencia', icone: '⚡', titulo: 'Parte XIII — Fórmulas Essenciais', html: `
<table><tr><th>Fórmula</th><th>Valor</th></tr>
<tr><td>Custo Total</td><td>Artus + Aspectus + Σ Sigilus (por ativação)</td></tr>
<tr><td>Teste de Construção</td><td>INT ou RAC + Runomancia + Artus + Aspectus + menor Sigilus</td></tr>
<tr><td>Tempo de gravação</td><td>CT ÷ 5 horas (−10%/nível de Gravação Rúnica, mín. 30%)</td></tr>
<tr><td>Material de gravação</td><td>≈ 2 L$ × CT (×2 c/ Avançado; ×3 c/ Mestre)</td></tr>
<tr><td>Energia Máxima</td><td>(VIG + PRS) × 3</td></tr>
<tr><td>Taxa de Conversão Vital</td><td>1 Energia = 5 Ess</td></tr>
<tr><td>Regime Contínuo</td><td>Captação ≥ 2 × nível do Aspectus (Ess/h)</td></tr>
<tr><td>Limite de cadeia</td><td>2 runas + nível do maior Harmonizador presente</td></tr></table>`
    },
];

if (typeof window !== 'undefined') {
    window.RUNO_TABELAS = RUNO_TABELAS;
    window.RUNO_COMPENDIO = RUNO_COMPENDIO;
}
