# Prompts de arte — os 37 prêmios da Roleta

Para colar no Gem Gerador de Itens. Cole o **prompt-master** uma vez e depois a
descrição do prêmio que quiser gerar — ou os dois juntos, de uma vez.

A ordem e o número são o índice da fatia na roda (`config/roleta`), e a porcentagem
é a chance daquele prêmio. Soma das chances: 100,6 — não fecha 100 de propósito,
porque o sorteio usa proporção.

Página com botão de copiar em cada um:
https://claude.ai/code/artifact/93614823-3b57-4fef-b5ac-88a4bedacec0

Salvar a imagem em `functions/avulsos-imagens/<Nome do Prêmio>.png` e subir com
`node functions/upload-and-update.mjs "<caminho>" "loja_itens" "<Nome do Prêmio>"`.

---

## Prompt-master de Item

```
Crie uma imagem com uma estética de anime detalhada: coloração suave com cel shading, traços limpos. Cenas típica de anime épico. Fundo branco sólido simples (solid white background, sem sombras no chão, sem cenários, sem bordas).

**DIRETRIZES FUNDAMENTAIS PARA ITENS:**
1. **NUNCA COLOQUE PERSONAGENS, PESSOAS OU CRIATURAS:** A imagem deve conter EXCLUSIVAMENTE o item solicitado.
2. **SEM NENHUM TEXTO:** NUNCA escreva nomes, palavras, letras, rótulos, legendas ou números na imagem. Ilustração pura.
3. **LOÇÕES / POMADAS / UNGUENTOS (MUITO IMPORTANTE):**
   - Loção NUNCA é uma poção líquida de beber em frasco de poção mágica. É sempre uma pomada, creme, unguento ou pasta untosa de aplicação tópica.
   - **Loções Nível 1 / Rústicas:** Ilustrar SEMPRE a pasta/pomada densa disposta sobre uma folha vegetal natural larga (estilo botânico/fantasia medieval rústica).
   - **Exceção (Corrosivos/Ácidos):** Se a loção for de algo que não combina ou corroi folhas (ex: ácido, corrosivo, fogo grego), coloque a pasta/creme sobre um pedaço de pano/tecido de linho rústico ou atadura.
4. **MÓVEIS / BAÚS / OBJETOS DE CHÃO:** Se o item for um móvel, caixa, baú ou objeto grande que fica no chão, a imagem DEVE ser em visão TOP-DOWN (visto estritamente de cima), para uso em VTT.
5. **GRADES 2x2 (SPRITE SHEETS):** Ao gerar em lotes de 4 itens, manter margens amplas de fundo branco ao redor de cada objeto para que pontas de lanças, lâminas e cabos longos nunca toquem as bordas.
```

---

## Os 37 prêmios

### 1. Lunis x250
*1%*

```
**ITEM: Lunis x250**
Usa a arte oficial remasterizada do Lun (cristal de luz neutra de Vasteluna): functions/avulsos-imagens/Lun.png
```

### 2. Lunis x500
*1%*

```
**ITEM: Lunis x500**
Usa a arte oficial remasterizada do Lun (cristal de luz neutra de Vasteluna): functions/avulsos-imagens/Lun.png
```

### 3. Lunis x800
*1%*

```
**ITEM: Lunis x800**
Usa a arte oficial remasterizada do Lun (cristal de luz neutra de Vasteluna): functions/avulsos-imagens/Lun.png
```

### 4. EXP 3
*1%*

```
**ITEM A GERAR: EXP 3**
Três estrelas douradas brilhantes de luz estelar pura, com lapidação facetada em ouro solar radiante, flutuando juntas em formação harmoniosa com centelhas cintilantes ao redor. Contornos cel-shading nítidos e limpos, sem névoa, sem fumaça, sem sombras. Fundo branco sólido simples.
```

### 5. EXP 4
*3%*

```
**ITEM A GERAR: EXP 4**
Quatro estrelas douradas brilhantes de luz estelar pura, com lapidação facetada em ouro solar radiante, flutuando em leque dinâmico com centelhas cintilantes ao redor. Contornos cel-shading nítidos e limpos, sem névoa, sem fumaça, sem sombras. Fundo branco sólido simples.
```

### 6. Re-roleta 1x
*3%*

```
**ITEM A GERAR: Re-roleta 1x**
Uma ficha circular de madeira escura entalhada como uma pequena roda de prêmios, com raios em relevo e aro de bronze polido.
```

### 7. Vale-Compra 20% (até 500 Lunis)
*5%*

```
**ITEM A GERAR: Vale-Compra 20% (até 500 Lunis)**
Um pequeno pergaminho enrolado e amarrado com fita vermelha, lacrado com um selo de cera lisa, e duas moedas de prata encostadas na base.
```

### 8. Informação x1
*5%*

```
**ITEM A GERAR: Informação x1**
Uma carta de pergaminho dobrada e fechada com um selo de cera vermelha liso, levemente amassada nas bordas.
```

### 9. Recurso Comum x10
*3%*

```
**ITEM A GERAR: Recurso Comum x10**
Um fardo de materiais brutos amarrado com corda: tora de madeira, pedra bruta, lingote de ferro e rolo de couro juntos.
```

### 10. Benção Menor
*5%*

```
**ITEM A GERAR: Benção Menor**
Um amuleto pequeno de prata em forma de folha lisa, pendurado em cordão de couro, com brilho dourado suave ao redor.
```

### 11. Lunis x1200
*5%*

```
**ITEM: Lunis x1200**
Usa a arte oficial remasterizada do Lun (cristal de luz neutra de Vasteluna): functions/avulsos-imagens/Lun.png
```

### 12. Lunis x1500
*1%*

```
**ITEM: Lunis x1500**
Usa a arte oficial remasterizada do Lun (cristal de luz neutra de Vasteluna): functions/avulsos-imagens/Lun.png
```

### 13. EXP 5
*3%*

```
**ITEM A GERAR: EXP 5**
Cinco estrelas douradas brilhantes de luz estelar pura, com lapidação facetada em ouro solar radiante, flutuando em semicírculo ascendente majestoso com centelhas cintilantes ao redor. Contornos cel-shading nítidos e limpos, sem névoa, sem fumaça, sem sombras. Fundo branco sólido simples.
```

### 14. EXP VIP 2
*3%*

```
**ITEM A GERAR: EXP VIP 2**
Duas grandes estrelas douradas soberanas de rara beleza cósmica, núcleo reluzente em ouro divino e coroa de partículas estelares reluzentes ao redor. Contornos cel-shading nítidos e limpos, sem névoa, sem fumaça, sem sombras. Fundo branco sólido simples.
```

### 15. Permitir Upgrade +1 (item) [até +3]
*3%*

```
**ITEM A GERAR: Permitir Upgrade +1 (item) [até +3]**
Um martelo de ferreiro pequeno cruzado com um cinzel de aço sobre uma placa de metal polido, com faíscas douradas discretas.
```

### 16. Seguidor 1x (tarefas simples, risco baixo)
*3%*

```
**ITEM A GERAR: Seguidor 1x (tarefas simples, risco baixo)**
Uma mochila de viagem simples de lona e couro, fechada, com uma lanterna pequena de mão pendurada na alça.
```

### 17. Mapa/Atalho (revela 1 rota segura)
*5%*

```
**ITEM A GERAR: Mapa/Atalho (revela 1 rota segura)**
Um mapa de pergaminho parcialmente desenrolado, com uma trilha marcada em tinta vermelha serpenteando entre montanhas desenhadas, sem nenhuma letra.
```

### 18. Contato Local (+1 favor)
*5%*

```
**ITEM A GERAR: Contato Local (+1 favor)**
Um anel-sinete de bronze com a face lisa e sem gravação, apoiado de lado, com um lacre de cera ao lado.
```

### 19. Aliado 1x (por 1 missão)
*5%*

```
**ITEM A GERAR: Aliado 1x (por 1 missão)**
Um bracelete de couro trançado com fivela de bronze, aberto e apoiado em curva.
```

### 20. Propriedade Pequena
*3%*

```
**ITEM A GERAR: Propriedade Pequena**
Uma escritura de pergaminho enrolada com fita, com uma chave de ferro grande e antiga amarrada ao cordão.
```

### 21. Informação x2
*5%*

```
**ITEM A GERAR: Informação x2**
Duas cartas de pergaminho lacradas com cera vermelha, uma sobre a outra, levemente desalinhadas.
```

### 22. Ka'Lunis x1
*3%*

```
**ITEM A GERAR: Ka'Lunis x1**
Uma única moeda grande de prata, grossa e polida, vista de frente e levemente inclinada, com brilho metálico forte.
```

### 23. Contrato de Troca (preço justo)
*3%*

```
**ITEM A GERAR: Contrato de Troca (preço justo)**
Uma pequena balança de dois pratos em bronze, equilibrada, com uma moeda em cada prato.
```

### 24. Manter Inventário 1x
*1%*

```
**ITEM A GERAR: Manter Inventário 1x**
Um cadeado de ferro maciço e antigo, fechado, com uma corrente grossa enrolada em volta.
```

### 25. Desejo Narrativo 1x
*1%*

```
**ITEM A GERAR: Desejo Narrativo 1x**
Uma pena de escrever branca apoiada em um tinteiro de vidro escuro, com uma gota de tinta brilhando na ponta.
```

### 26. Salvar da Morte 1x
*1%*

```
**ITEM A GERAR: Salvar da Morte 1x**
Uma ampulheta de madeira e vidro, inclinada, com pouquíssima areia dourada restando na parte de cima.
```

### 27. Mi'Lunis x1
*0,5% · raríssimo*

```
**ITEM A GERAR: Mi'Lunis x1**
Uma única moeda de ouro enorme e reluzente, vista de frente, com raios de luz dourada intensa saindo das bordas.
```

### 28. Contrato de Mão de Obra 1x
*3%*

```
**ITEM A GERAR: Contrato de Mão de Obra 1x**
Um pergaminho lacrado com cera, com um serrote e um martelo de carpinteiro cruzados apoiados sobre ele.
```

### 29. Item +1
*5%*

```
**ITEM A GERAR: Item +1**
Uma espada curta de aço simples e bem cuidada, com um pequeno cristal azul engastado no pomo.
```

### 30. Item +5
*3%*

```
**ITEM A GERAR: Item +5**
Uma espada longa ornamentada de aço claro, guarda dourada trabalhada e cinco pequenos cristais azuis engastados ao longo da guarda.
```

### 31. Item Raro +6
*3%*

```
**ITEM A GERAR: Item Raro +6**
Uma espada élfica de lâmina prateada e curva suave, com entalhes geométricos brilhando em azul-claro ao longo da lâmina, guarda em folhas de ouro.
```

### 32. Influência
*5%*

```
**ITEM A GERAR: Influência**
Uma coroa pequena de louros em bronze polido, apoiada de lado, com um lacre de cera vermelha ao pé.
```

### 33. Aliado 1x (Perma)
*1%*

```
**ITEM A GERAR: Aliado 1x (Perma)**
Dois braceletes de couro idênticos, atados um ao outro por um cordão de prata trançado.
```

### 34. Contato Menor do Submundo
*1%*

```
**ITEM A GERAR: Contato Menor do Submundo**
Um par de luvas de couro escuro dobradas, com duas gazuas finas de metal apoiadas por cima.
```

### 35. Contato Maior do Submundo
*0,5% · raríssimo*

```
**ITEM A GERAR: Contato Maior do Submundo**
Um estojo de couro preto aberto com um jogo completo de gazuas de aço, e um anel de sinete negro com pedra ônix ao lado.
```

### 36. Re-rolagens x3
*0,3% · raríssimo*

```
**ITEM A GERAR: Re-rolagens x3**
Três dados de osso talhados à mão, brancos e levemente amarelados, dispostos em triângulo.
```

### 37. Re-rolagens x6
*0,3% · raríssimo*

```
**ITEM A GERAR: Re-rolagens x6**
Seis dados de osso talhados à mão, brancos e levemente amarelados, espalhados em pequeno monte.
```
