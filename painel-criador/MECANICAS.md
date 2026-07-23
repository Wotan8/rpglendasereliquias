# ⚙️ Compêndio de Mecânicas - Guia Completo

O sistema de **Mecânicas** do Painel do Criador é o coração lógico do *Lendas e Relíquias*. Ele permite que você crie regras automatizadas, modificadores e efeitos condicionais sem precisar escrever uma linha de código. As mecânicas podem ser vinculadas a Raças, Classes, Itens, Condições ou qualquer outro elemento, e a ficha do jogador se encarregará de aplicá-las em tempo real.

Abaixo, detalhamos todos os **7 Tipos de Mecânicas** disponíveis e suas configurações.

---

## 1. ➕ Modificar
Usada para alterar numericamente os atributos, perícias, valores derivados, EXP ou status de um personagem. Ela suporta uma cadeia de múltiplos cálculos.

**O que é afetado (Alvo):**
- Atributos (FOR, DES, INT, etc).
- Status Vitais (Vitalidade Máxima/Atual, Energia, Sanidade).
- Valores Derivados e Campos da Ficha (Blindagem, Tamanho).
- Perícias específicas ou Grupos (Qualquer Perícia Física, Social, etc).
- Propriedades de Equipamento e Combate (Dano, Dano Crítico, Pressão do Item, etc).
- Experiência (EXP Total, Restante ou Ambos).

**Operação:**
- **+ Somar**, **− Subtrair**, **× Multiplicar**, **÷ Dividir**, ou **= Definir** (sobrescreve o valor fixo).

**Equação de Valor:**
Em vez de apenas colocar um número, você pode montar uma equação termo a termo. Cada termo pode ser:
1. **🔢 Fixo:** Um número exato (ex: `2`).
2. **📋 Ficha:** Pega o valor atual de outro campo da ficha do personagem (ex: `[VIG]`).
3. **🎲 Sort:** Uma rolagem dinâmica (ex: sorteia entre `1` e `6`).
- *Operadores Especiais:* Além das quatro operações básicas, você pode usar os operadores lógicos **↓ Menor entre (min)** e **↑ Maior entre (max)** para comparar os termos e usar apenas o mais vantajoso (ou desvantajoso).

---

## 2. 🔒 Limitar
Funciona como uma trava ou teto de segurança para valores da ficha. Útil para regras que dizem "A penalidade máxima é X" ou "O Atributo não pode passar de Y".

**Tipo de Limite:**
- **Teto (máximo):** Impede que o valor exceda a equação determinada.
- **Piso (mínimo):** Impede que o valor caia abaixo da equação determinada.
- **Ambos (clamp):** Define o mínimo e o máximo aceitáveis simultaneamente.
- **Bloqueio (= 0):** Zera completamente o valor, bloqueando o acesso/uso.

**Equação de Valor:**
Funciona de maneira idêntica à mecânica *Modificar*, permitindo montar um limite dinâmico (ex: Limite máximo é `[FOR] × 2`).

---

## 3. 🎁 Conceder
É o canivete suíço para regras e habilidades de natureza interpretativa, qualitativa ou anatômica.

**Tipos de Concessão:**
- **Vantagens / Imunidades / Vulnerabilidades:** (Ex: "Imunidade a Dano de Fogo" ou "Vantagem em testes Sociais"). 
- **Acesso / Remover Acesso:** Permite ou proíbe a utilização de um tipo de arma, um idioma ou uma mecânica específica.
- **Capacidade especial:** Qualquer outro talento interpretativo (Ex: "Visão no Escuro", "Pode respirar embaixo d'água").
- **Adicionar / Remover Parte do Corpo:** Mexe diretamente na anatomia do personagem (Ex: uma Raça aracnídea que ganha 4 Braços Extras). Você seleciona a parte do corpo e (opcionalmente) os "Slots" que ela tem disponíveis.
- **🎒 Conceder Equipamento:** Cria fisicamente um item no inventário do personagem (como um "Item Solto"). Excelente para kits iniciais de classe ou raça. A concessão ocorre uma única vez.

---

## 4. ⚡ Condicional
Permite criar ramificações nas regras, aplicando efeitos *se, e somente se* uma condição for atendida.

**Gatilho / Condição:**
- **Gatilho Narrativo:** Um campo de texto para o jogador (ex: "Sempre que for atingido por fogo").
- **🔀 Condição Mecânica (Mecânica Booleana):** Se ativada, você vincula outra mecânica (do tipo *Booleana*) para o sistema calcular automaticamente a condição. Ex: "Só ative se HP < 10".

**Efeitos (Se Sucesso / Se Falha):**
- Você vincula *outras mecânicas* que serão ativadas caso o gatilho/condição seja cumprido (**Sucesso**) e outras caso seja reprovado (**Falha**).
- Inclui campos narrativos de texto para detalhar o que acontece em ambos os casos na ficha (útil para magias com Teste de Resistência que aplicam metade do dano se houver sucesso na resistência).

---

## 5. 📝 Narrativo
Mecânicas textuais livres.
- **Descrição do efeito:** Não altera os cálculos matemáticos da ficha, mas grava o texto no diário/habilidades do personagem. Útil para regras estritas de *roleplay* que precisam aparecer no resumo de habilidades.

---

## 6. 🎲 Distribuir
Mecânica poderosa para criação de fichas e progressão de níveis, permitindo que o jogador divida um pacote de pontos.

**Configurações:**
- **Pool de Alvos:** Onde os pontos podem ser colocados. Pode ser genérico ("Perícias Sociais") ou "Personalizado" (onde você seleciona manualmente a dedo quais atributos/perícias são candidatos).
- **Quantos alvos diferentes?** Ex: "Escolha 3 perícias".
- **Valor por alvo:** Ex: "+2".
- **Operação:** O que acontece na perícia escolhida (Somar, Subtrair, Definir).
- **Restrição:** Define se o jogador deve obrigatoriamente escolher alvos *diferentes*, ou se é *livre* e ele pode empilhar o bônus diversas vezes no mesmo alvo (caso o sistema permita).

---

## 7. 🔀 Booleano
Mecânicas de comparação lógica. O próprio sistema as utiliza nos bastidores de *Módulos de Classe* e *Condicionais* para autorizar se o personagem tem requisitos ou não.

**Configuração da Equação (Lado A e Lado B):**
- Você monta uma Equação de Valor no lado esquerdo (Lado A) e outra no lado direito (Lado B). Assim como a mecânica de Modificar, eles aceitam valores da Ficha.
- Ex: Lado A é `[VIG]` e Lado B é `10`.

**Comparador:**
- Opções disponíveis: Igual (`==`), Diferente (`!=`), Maior (`>`), Maior ou igual (`>=`), Menor (`<`), Menor ou igual (`<=`). No exemplo acima, a condição checa se a Vitalidade é >= 10.

**Retorno Personalizado (Opcional):**
- Você pode definir o "Valor Verdadeiro" ou "Valor Falso". Em integrações avançadas de sistema, o painel pode extrair esse retorno numérico para ativar bônus com base no resultado da Booleana.

**⚔️ Tipo de Lógica: Verificação de Classe:**
- Além da Lógica Numérica e da Verificação de Equipamento, o Booleano aceita a **Verificação de Classe**.
- O lado esquerdo (A) é preenchido **automaticamente** com as classes do personagem na ficha; no lado direito (B) você seleciona uma ou mais classes do registro.
- Retorna **✅ Verdadeiro** se o personagem tiver **todas** as classes selecionadas; se faltar alguma delas, retorna **❌ Falso**.

---

## 8. 🔗 Condicional Encadeado
Uma evolução da mecânica Booleana, operando como uma lista de condições avaliadas em ordem (estilo *if/else if* ou "graus de sucesso"). Muito útil para rolagens que possuem diferentes efeitos baseados no total atingido (Ex: se rolar < 10 é Falha, se 10 a 15 é Parcial, se > 15 é Crítico).

**🧮 Equação de Valor:**
- A base da avaliação. Você monta uma Equação de Valor (idêntica à das mecânicas Modificar/Booleana) que servirá como o valor de entrada para ser comparado em todas as etapas abaixo. Ex: Uma rolagem `1d20 + [FOR]`.

**🔗 Condicionais (Avaliadas em ordem):**
- Você adiciona múltiplas condições (linhas). O sistema lerá de cima para baixo e a **primeira** condição que for satisfeita definirá o resultado final da mecânica.
- **Comparação:** Opções como Menor (`<`), Maior (`>`), Igual (`==`), Diferente (`!=`), e até **Entre** (que compara se o valor está dentro de uma faixa entre X e Y).
- **Resultado:** O valor (numérico ou textual) que a mecânica retornará caso essa linha seja satisfeita. Ex: "Fraco", "Forte", ou `2`.

**🛟 Resultado Padrão:**
- Se o valor calculado não casar com nenhuma das condições cadastradas acima, a mecânica retornará o que estiver definido neste campo. (Ex: "Indefinido" ou `0`).

**⚔️ Tipo de Lógica: Verificação de Classe:**
- No Tipo de Lógica, além da Lógica Numérica e da Verificação de Equipamento, há a **Verificação de Classe**.
- O lado esquerdo é preenchido **automaticamente** com as classes do personagem. Em cada condição ("Se") você marca **uma ou mais classes**.
- As condições são avaliadas em ordem: a primeira cujas classes estiverem **todas** entre as do personagem casa — exibindo a **Mensagem/Resultado** definida e acionando as **Mecânicas vinculadas** daquela condição. Se nenhuma casar, vale o **Resultado Padrão**.
