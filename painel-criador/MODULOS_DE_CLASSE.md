# 📦 Módulos de Classe - Guia de Uso e Funcionamento

Os **Módulos de Classe** são recursos flexíveis no Painel do Criador que permitem criar pacotes dinâmicos de mecânicas, itens ou habilidades para serem vinculados a uma Classe específica no sistema. Eles substituem a necessidade de criar regras complexas fixas no código, dando ao Criador controle total sobre "listas" ou "coleções" atreladas à ficha de um personagem.

Exemplos de uso comuns:
- **O Grimório de um Mago**: Uma lista onde o jogador anota as magias que aprendeu.
- **Receitas de um Alquimista**: Uma lista de poções que custa EXP ou ingredientes para serem descobertas.
- **Elementos Rúnicos (Runomancia)**: O sistema de estudo de runas de um Runomago.

---

## 1. Como Funcionam?

Quando você cria um Módulo de Classe, você está essencialmente construindo um **mini-aplicativo/banco de dados embutido** para a Ficha de Personagem.
O funcionamento do Módulo é baseado nos seguintes pilares:

### 🪪 Identidade e Tipo
Você define um **ID único** (ex: `mod_grimorio`), um **Título** e um **Ícone**.
O módulo pode ser de três tipos:
- **Lista:** O formato padrão e genérico. Serve para listas de habilidades, companheiros animais, técnicas de combate, etc.
- **Grimório:** Semântica voltada para magia e feitiços.
- **Runomancia (Lista de Estudo):** Um módulo especial voltado para o sistema Rúnico. Quando selecionado, ativa configurações exclusivas baseadas na regra do sistema (Slots Base, Perícia/Atributo dos Slots, Perícia de Desconto de tempo, Multiplicador de EXP).

### 🎯 Limites e 🔒 Bloqueios
Você pode restringir quantos itens o jogador pode ter neste módulo.
- **Limite Fixo:** Um número máximo fixo (ex: máximo de 5 habilidades).
- **Mecânicas de Limite:** Permite vincular mecânicas que calculam o limite dinamicamente (ex: O limite é igual ao seu Atributo Inteligência). Se ambos existirem, a ficha usará o *maior valor*.
- **Bloqueio de Módulo:** Permite vincular *Mecânicas Booleanas*. Se o jogador não cumprir o requisito da mecânica, o módulo todo fica bloqueado na ficha.

### 💰 Custos Condicionais
Você pode definir que adicionar, editar ou remover itens do módulo tem um "Custo".
- **Ao criar (adicionar item):** Pode custar EXP (Experiência), consumir ou exigir certos Equipamentos (ex: Exige "Kit de Alquimia", consome "Erva Curativa"), e pode ativar Mecânicas de Custo na criação (ex: subtrair Presas ou algum outro recurso).
- **Ao editar/remover:** Você pode ligar opções (Custo de Edição / Custo de Remoção) e vincular mecânicas de custo que são cobradas sempre que o jogador tentar modificar ou apagar um item da ficha.

### 📋 Schema de Campos
Esta é a parte mais poderosa. O "Schema" é a estrutura de dados de cada item. Você define quais "colunas" ou "perguntas" formam um item desse módulo.
- Exemplo: Num módulo de "Receitas", você cria os campos: *Nome da Receita* (Texto), *Ingredientes* (Texto longo), *Dano/Cura* (Dado).
- **Tipos de campo suportados:**
    - **Texto:** Um campo de texto curto (ex: Nome).
    - **Número:** Um campo apenas para valores numéricos.
    - **Texto Longo:** Uma área de texto expansível para descrições longas.
    - **Seleção (Select):** Um menu de opções onde o jogador escolhe um dos valores disponíveis (as opções devem ser definidas separadas por vírgula no painel).
    - **Progresso (x/y):** Uma barra com valor atual e valor máximo (ex: HP de um familiar 10/20).
    - **Passos:** Um rastreador visual de marcadores sequenciais.
    - **🔢 Contador (+/−):** Um número acompanhado de botões para incrementar ou decrementar rapidamente.
    - **☑️ Checkbox:** Uma caixa de marcação simples (Sim/Não ou Ativo/Inativo).
    - **⭐ Avaliação (0–5):** Um sistema de classificação por estrelas, útil para nível de domínio ou rank.
    - **🏷️ Tags:** Campo para inserir múltiplas etiquetas textuais coloridas.
    - **📅 Data:** Um campo de seleção de data (calendário).
    - **🎨 Cor:** Um seletor de cor (color picker).
    - **🔗 Link:** Um campo para guardar e acessar uma URL externa (ex: Link para uma imagem de referência ou música).
    - **🖼️ Imagem (URL):** Uma caixa que irá renderizar uma imagem na ficha usando o endereço (URL) da imagem fornecida.
    - **🎲 Dado (rolagem):** Exibe um botão na ficha que, ao clicado, rola dados com base em uma fórmula fixa definida no painel (ex: `2d6+1`).
    - **🔘 Botão (mecânicas):** Um botão interativo na ficha. Ao ser clicado pelo jogador, aplica imediatamente as mecânicas vinculadas a ele (ex: curar PV, gastar Mana).
    - **🔘 Select Botão:** Semelhante a uma seleção, mas ao invés de apenas escolher uma opção, o jogador pode "ativar" essa opção (úteis para listas de opções que ativam diferentes mecânicas ou buffs temporários).
    - **➖ Separador de seção:** Não é um dado propriamente dito; serve apenas para criar divisórias visuais no formulário da ficha e organizar melhor.
    - **📊 Valor Derivado:** Vincula este campo diretamente a um *Valor Derivado* configurado no sistema. Seu valor será dinâmico na ficha (ex: Bônus de Proficiência, ou Atributo Força).
    - **📊 Select VD (Valor Derivado):** Permite que o jogador selecione, a partir de um menu de opções, qual Valor Derivado ele quer referenciar e utilizar.

### 🗂️ Itens Pré-cadastrados
Se você não quiser que o jogador crie itens do zero, você pode usar a configuração **"Jogador pode criar itens livremente"** e desmarcá-la. Então, você cria itens **Pré-cadastrados**. O jogador apenas verá um catálogo e escolherá quais quer adicionar.

Para cada item pré-cadastrado, você pode configurar as seguintes propriedades (muitas servem para sobrescrever as regras gerais do módulo):

- **Nome:** O nome do item que aparecerá no catálogo.
- **Descrição:** Uma breve explicação ou lore exibida ao jogador antes de ele adquirir o item.
- **Custo EXP próprio:** Um custo de EXP específico para este item. Se preenchido, ele *sobrescreve* o custo de EXP padrão definido no Módulo. Se vazio, utiliza o custo do módulo.
- **🎒 Custos de Equipamento próprios:** Permite habilitar e exigir/consumir itens de inventário exclusivos para a aquisição deste item, substituindo a configuração global do Módulo.
- **⚙️ Mecânica de Custo própria:** Permite definir mecânicas que serão ativadas apenas quando o jogador criar *este* item (substituindo as mecânicas de custo de criação do módulo).
- **🧬 Valores dos Campos (Pré-preenchidos):** Uma área gerada automaticamente a partir do *Schema de Campos* que você montou acima. Permite que você preencha os dados definitivos do item. Ex: se no schema você criou "Ingredientes", aqui você digita quais são. *Dica:* Lembre-se de clicar em **🔄 Sincronizar com Schema** sempre que alterar as regras do seu módulo para atualizar o formulário interno dos itens pré-cadastrados.

---

## 2. Passo a Passo: Como Usar os Módulos de Classe

### Passo 1: Acessar a Interface
1. Abra o **Painel do Criador**.
2. No menu lateral, clique em **📦 Módulos de Classe**.

### Passo 2: Criar um Novo Módulo
1. Clique no botão de criar um novo item.
2. Preencha a aba de Identidade: Dê um ID (`mod_locoes`), Título (`Minhas Loções`), selecione o Tipo (`lista`).
3. Se desejar, configure um Limite de itens na seção correspondente.

### Passo 3: Definir o Schema de Campos (A estrutura do item)
Vá até a seção **📋 Schema de Campos** e adicione os campos que compõem esse módulo.
Por exemplo, para um "Familiar":
- **Campo 1:** `key: nome`, `label: Nome do Familiar`, `tipo: text`.
- **Campo 2:** `key: hp`, `label: Pontos de Vida`, `tipo: number`.
- **Campo 3:** `key: ataque`, `label: Ataque do Familiar`, `tipo: dado`, `opções: 1d6+2`.

### Passo 4: Definir Custos (Opcional)
Na seção **💰 Custos por Item**, determine o que custa adicionar um Familiar.
- *Custo EXP:* 10
- *Equipamento:* Se ele precisa usar uma coleira mágica, adicione aqui (marcando se será consumido ou apenas precisar estar equipado).

### Passo 5: Itens Pré-Cadastrados (Opcional)
Se você quer que existam Familiares fixos no mundo do jogo:
1. Desmarque "Jogador pode criar itens livremente neste módulo".
2. Na seção **🗂️ Itens Pré-cadastrados**, adicione as opções (ex: Gato Sombrio, Corvo Observador). Cada item receberá automaticamente os campos definidos no seu *Schema*.

### Passo 6: Salvar o Módulo
Guarde suas alterações no Painel.

### Passo 7: Vincular o Módulo à Classe
1. Vá até a aba **⚔️ Classes** no Painel do Criador.
2. Selecione a classe que vai receber o módulo (ex: "Mago" ou "Domador").
3. Localize o campo **📦 Módulos da Classe**.
4. Clique para adicionar/vincular um Módulo.
5. Selecione o Módulo recém-criado na lista (`mod_locoes` ou `mod_familiares`).
6. Salve a classe.

Pronto! Quando um jogador criar um personagem desta Classe, o módulo aparecerá na ficha dele, respeitando todos os custos, schemas e restrições configuradas por você no Painel do Criador.
