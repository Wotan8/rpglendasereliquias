# ⚔️ Lendas e Relíquias - Sistema de Fichas Digitais

<div align="center">

![Status](https://img.shields.io/badge/status-ativo-success.svg)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?logo=firebase&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)

Sistema online de fichas digitais para o RPG **Lendas e Relíquias**

[📖 Reportar Bug](https://github.com/Wotan8/rpglendasereliquias/issues)

</div>


---

## 🜲 Identidade Visual / Design System

Toda a interface segue a identidade **"Tecnologia Rúnica Ancestral"** documentada em
[`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md) — **leitura obrigatória antes de qualquer alteração de UI**
(vale para devs humanos e IAs de desenvolvimento).

Em resumo:
- **Tokens globais** em [`/shared/tokens.css`](shared/tokens.css) (cores, tipografia, espaçamentos, raios, sombras, transições, z-index) — nenhum componente usa valores fixos;
- **Camada de identidade** em [`/shared/lendas-reliquias.css`](shared/lendas-reliquias.css), que estiliza componentes (botões, inputs, tabelas, abas, modais…) de forma global e data-driven;
- Ordem de carregamento em toda página: `CSS local → tokens.css → lendas-reliquias.css`;
- Fontes: **Cinzel** (títulos), **Cormorant Garamond** (subtítulos), **Inter** (texto e UI);
- Paleta oficial: pedra escura `#0E1117`, superfícies de ferro `#1F2630`, ouro discreto `#D4AF37`, azul arcano `#3AA6FF`, roxo abissal `#5B3FB8`, verde natureza `#3FAE6A`, vermelho sangue `#8B1E2D`.

Novos módulos herdam a identidade automaticamente ao usar os componentes e tokens existentes.

## 📖 Sobre o Projeto

Sistema web **completo e robusto** para gerenciamento de personagens do RPG **Lendas e Relíquias**, desenvolvido com foco em experiência do usuário, performance e segurança. Inclui autenticação Firebase, sistema multi-personagem, salvamento automático em nuvem, painel do mestre em tempo real e muito mais.

### 🎲 Sobre o RPG

**Lendas e Relíquias** é um sistema de RPG criado por **Igor Estevam A.S.**, mestre com mais de 12 anos de experiência, que desenvolveu todo o sistema de regras, mecânicas, ambientação e balanceamento do jogo.

### 💻 Desenvolvimento

Este sistema online foi originalmente iniciado por **Lucas Gabriel** em uma versão 0 (básica). A partir dessa versão inicial, **Igor Estevam A.S.** assumiu o desenvolvimento completo, refatorando todo o código, corrigindo bugs, expandindo funcionalidades e transformando o projeto no sistema robusto e completo que é hoje.

---

## ✨ Funcionalidades Principais

### 👥 Sistema de Autenticação
- ✅ **Login seguro** com Firebase Authentication
- ✅ **Cadastro diferenciado** para Jogadores, Mestres e Criadores
- ✅ **Pedido de cargo com aprovação**: conta nasce Jogador e só muda quando um Criador aprova
- ✅ **Persistência de sessão** com localStorage
- ✅ **Logout seguro** com limpeza de dados

### 🎭 Gerenciamento de Personagens
- ✅ **Múltiplos personagens** por usuário
- ✅ **Tela de seleção** com cards informativos
- ✅ **Criação ilimitada** de personagens
- ✅ **Exclusão segura** com confirmação
- ✅ **Sincronização automática** com Firebase
- ✅ **Visualização rápida** de status (HP, Classe, Nível)

### 📋 Sistema de Ficha Completo
- ✅ **9 Atributos principais** (Inteligência, Força, Presença, Raciocínio, Destreza, Manha, Perseverança, Vigor, Autocontrole)
- ✅ **Sistema de pontos** visual com 5 níveis por atributo
- ✅ **Skills especializadas** com rastreamento individual
- ✅ **Cálculos automáticos** de bônus e penalidades
- ✅ **HP, Energia e Sanidade** com barras visuais
- ✅ **Sistema de defesas** (Física, Mental, Bélica)
- ✅ **Rastreamento de EXP** e progressão de nível
- ✅ **Sistema monetário** (Luns)
- ✅ **Condições de estado** (Ferido, Envenenado, etc.)
- ✅ **Notas integradas** para anotações do jogador

### 🎒 Sistema de Inventário Avançado
- ✅ **Containers personalizados** (Mochilas, Bolsas, Baús, etc.)
- ✅ **Sistema de peso** e capacidade
- ✅ **Container "Equipados"** para itens em uso
- ✅ **Gestão de itens** com descrição, quantidade e peso
- ✅ **Drag & Drop** entre containers
- ✅ **Coleções separadas** no Firebase (containers + items)
- ✅ **Sincronização em tempo real**

### 🤝 Sistema de Aliados
- ✅ **Gerenciamento de NPCs aliados**
- ✅ **Rastreamento de HP** e status
- ✅ **Notas individuais** para cada aliado
- ✅ **Interface dedicada** (aliado.html)
- ✅ **Sincronização com personagem**

### 🏠 Sistema de Propriedades
- ✅ **Gestão de propriedades** (Casas, Lojas, Terras, etc.)
- ✅ **Descrição detalhada** de cada propriedade
- ✅ **Localização e características**
- ✅ **Interface dedicada** (propriedade.html)
- ✅ **Vínculo com personagem**

### 🎲 Rolador de Dados
- ✅ **Sistema D10** com explosão de dados
- ✅ **Rolagem automática** baseada em atributos
- ✅ **Histórico de rolagens**
- ✅ **Animações visuais**

### 👑 Painel do Mestre
- ✅ **Visualização em tempo real** de todos os personagens
- ✅ **Sistema de abas** organizado (Visão Geral, Personagens, Detalhes)
- ✅ **Monitoramento de status críticos** (HP baixo, sanidade crítica)
- ✅ **Histórico de mudanças** automático com logs
- ✅ **Detecção de anomalias** (valores suspeitos)
- ✅ **Visualização completa** de fichas, inventário, aliados e propriedades
- ✅ **Estatísticas da mesa** (EXP médio, total de jogadores)
- ✅ **Filtros e busca** inteligente
- ✅ **Acesso somente leitura** às fichas dos jogadores

### 🔒 Segurança e Performance
- ✅ **Firestore Rules** robustas com validação de propriedade
- ✅ **Coleções otimizadas** (characters, containers, items, npcs, logs, masters, users)
- ✅ **Validação de permissões** (dono OU mestre)
- ✅ **Auto-save inteligente** com debounce
- ✅ **Proteção contra edição cruzada** de personagens
- ✅ **Sistema de logs** para auditoria
- ✅ **Criptografia de senha** via Firebase Auth

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Backend:** Firebase (Authentication + Firestore Database)
- **Hosting:** Firebase Hosting
- **Tempo Real:** Firestore Realtime Listeners
- **Autenticação:** Firebase Auth (Email/Password)
- **Arquitetura:** SPA (Single Page Application) multi-página

---

## 🚀 Como Usar

### Para Jogadores:

1. Acesse o sistema hospedado no Firebase
2. Crie sua conta escolhendo **"Jogador"**
3. Na tela de personagens, clique em **"Criar Novo Personagem"**
4. Preencha sua ficha com informações do personagem
5. Gerencie inventário, aliados e propriedades
6. Tudo é salvo automaticamente na nuvem ☁️

### Para Mestres:

1. Crie conta escolhendo **"Mestre"** — isso registra um **pedido**, não concede o cargo
2. Um Criador aprova em **Painel do Criador → ⚙️ Configurações → 🔐 Permissões**
3. Depois da aprovação, recarregue a página e o painel do mestre aparece
4. Monitore todos os jogadores em tempo real
5. Visualize fichas completas, inventários, aliados e propriedades
6. Acompanhe estatísticas da mesa e histórico de mudanças

---

## ⚙️ Configuração do Firebase

### 1️⃣ Criar Projeto no Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Clique em **"Adicionar projeto"**
3. Dê um nome (ex: `lendas-reliquias-rpg`)
4. Desabilite o Google Analytics (opcional)
5. Clique em **"Criar projeto"**

### 2️⃣ Configurar Authentication

1. No menu lateral, vá em **Authentication**
2. Clique em **"Vamos começar"**
3. Na aba **"Sign-in method"**, ative:
   - ✅ **Email/Password** (método de login)
4. Salve as alterações

### 3️⃣ Configurar Firestore Database

1. No menu lateral, vá em **Firestore Database**
2. Clique em **"Criar banco de dados"**
3. Escolha **"Produção"** (production mode)
4. Selecione a localização (ex: `southamerica-east1` para Brasil)
5. Clique em **"Ativar"**

### 4️⃣ Regras de Segurança do Firestore

Na aba **"Regras"** do Firestore, cole as regras do arquivo `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isMaster() {
      return isSignedIn() &&
        exists(/databases/$(database)/documents/masters/$(request.auth.uid));
    }

    // Coleção de mestres
    match /masters/{uid} {
      allow read: if isMaster();
      allow write: if false;
    }

    // Coleção de usuários
    match /users/{userId} {
      allow read: if isSignedIn();
      allow write: if isSignedIn() && request.auth.uid == userId;
    }

    // Coleção de personagens
    match /char/{charId} {
      allow read: if isSignedIn() && (
        resource.data.ownerUid == request.auth.uid || isMaster()
      );
      allow create: if isSignedIn() && 
        request.resource.data.ownerUid == request.auth.uid;
      allow update: if isSignedIn() && (
        (resource.data.ownerUid == request.auth.uid && 
         request.resource.data.ownerUid == resource.data.ownerUid) || 
        isMaster()
      );
      allow delete: if isSignedIn() && (
        resource.data.ownerUid == request.auth.uid || isMaster()
      );
    }

    // Coleção de logs
    match /logs/{logId} {
      allow create: if isSignedIn();
      allow read: if isMaster();
      allow update, delete: if false;
    }
    
    // Coleção de NPCs
    match /npcs/{npcId} {
      allow read: if isSignedIn();
      allow create, update, delete: if isMaster();
    }
    
    // Coleção de Containers
    match /containers/{containerId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() && 
        request.resource.data.ownerId == request.auth.uid;
      allow update: if isSignedIn() && (
        (resource.data.ownerId == request.auth.uid && 
         request.resource.data.ownerId == resource.data.ownerId) || 
        isMaster()
      );
      allow delete: if isSignedIn() && (
        resource.data.ownerId == request.auth.uid || 
        isMaster()
      );
    }
    
    // Coleção de Itens
    match /items/{itemId} {
      allow read: if isSignedIn();
      allow create: if isSignedIn() && 
        request.resource.data.ownerId == request.auth.uid;
      allow update: if isSignedIn() && (
        (resource.data.ownerId == request.auth.uid && 
         request.resource.data.ownerId == resource.data.ownerId) || 
        isMaster()
      );
      allow delete: if isSignedIn() && (
        resource.data.ownerId == request.auth.uid || 
        isMaster()
      );
    }
  }
}
```

**📌 Explicação das Regras:**

- **Usuários:** Qualquer pessoa autenticada pode ler (para verificar roles), mas só pode editar seus próprios dados
- **Personagens:** 
  - ✅ Jogadores podem ler/escrever apenas personagens onde `ownerUid` seja igual ao seu UID
  - ✅ Mestres podem ler TODOS os personagens (para o painel)
  - ❌ Ninguém pode editar personagens de outros jogadores
  - ✅ Sistema protege contra mudança de `ownerUid` em updates
- **Containers e Itens:** Mesma lógica de personagens (dono OU mestre)
- **NPCs:** Apenas mestres podem criar/editar/deletar
- **Logs:** Qualquer um pode criar, apenas mestres podem ler

**Clique em "Publicar"** após colar as regras.

### 5️⃣ Configurar Hosting

1. No menu lateral, vá em **Hosting**
2. Clique em **"Vamos começar"**
3. Siga os passos (ou use Firebase CLI)

### 6️⃣ Obter Configurações do Firebase

1. Vá em **Configurações do Projeto** (ícone de engrenagem)
2. Role até **"Seus aplicativos"**
3. Clique em **"Web"** (`</>`)
4. Registre o app com um nome
5. **Copie o objeto `firebaseConfig`**

### 7️⃣ Configurar o Código

Abra os arquivos HTML (`index.html`, `ficha.html`, `mestre.html`, `personagens.html`, `aliado.html`, `propriedade.html`) e substitua o `firebaseConfig` pelo seu:

```javascript
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto-id",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### 8️⃣ O primeiro Criador

Não existe mais código secreto no cadastro: ele ficava no bundle público e as
rules nunca o conferiam, então qualquer visitante virava mestre. Hoje `role` é
campo protegido nas rules e só a Cloud Function `definirCargo` o move — e ela
só aceita ordem de quem já é Criador.

Por isso o **primeiro** Criador é criado à mão, uma vez, no Firebase Console:
abra `users/<uid>` e grave `role: "criador"`. Daí em diante as promoções são
feitas na tela, em **Painel do Criador → ⚙️ Configurações → 🔐 Permissões**.

### 9️⃣ Criar Documento de Mestre Manualmente

Após criar a conta de mestre pela primeira vez, você precisa adicionar o UID do mestre na coleção `masters`:

1. No Firebase Console, vá em **Authentication**
2. Copie o **UID** do usuário mestre
3. Vá em **Firestore Database**
4. Crie a coleção `masters` (se não existir)
5. Adicione um documento com o **UID do mestre** como ID do documento
6. Adicione um campo qualquer (ex: `role: "mestre"`)

Isso é necessário para que as regras de segurança reconheçam o usuário como mestre.

### 🔟 Deploy

```bash
# Instale o Firebase CLI (apenas uma vez)
npm install -g firebase-tools

# Faça login
firebase login

# Inicialize o projeto (se necessário)
firebase init

# Selecione:
# - Hosting
# - Use um projeto existente
# - Public directory: . (ponto - diretório atual)
# - Single-page app: No
# - GitHub actions: No

# Faça o deploy
firebase deploy
```

---

## 📋 Estrutura do Projeto

```
lendas-reliquias-rpg/
│
├── index.html          # Página de login/cadastro
├── personagens.html    # Tela de seleção de personagens
├── ficha.html          # Sistema completo de ficha do jogador
├── mestre.html         # Painel do mestre com múltiplas abas
├── aliado.html         # Gestão de aliados/NPCs
├── propriedade.html    # Gestão de propriedades
├── 404.html            # Página de erro
├── firebase.json       # Configuração do Firebase Hosting
├── firestore.rules     # Regras de segurança do Firestore
├── .firebaserc         # Configuração do projeto Firebase
└── .gitignore          # Arquivos ignorados pelo Git
```

---

## 🎮 Classes Disponíveis

- ⚔️ **Guerreiro** - Combate direto, controle de campo e resistência
- 🏹 **Caçador** - Rastreio, combate à distância e sobrevivência
- 🌿 **Druida** - Comunhão animal, alquimancia e cura natural
- 💀 **Adepto (Necromante)** - Controle de mortos-vivos e necromancia
- 🗡️ **Ladino** - Furtividade, dano oportunista e habilidades sociais
- ✨ **Pallacerdote** - Suporte divino, cura e proteção
- 🔮 **Ritualista (Abismancia)** - Controle por rituais abissais e magias de controle

---

## 🔒 Segurança

- ✅ Autenticação obrigatória para acessar o sistema
- ✅ Dados isolados por usuário no Firestore
- ✅ Código de mestre para prevenir acesso não autorizado
- ✅ Firestore Rules robustas com validação de propriedade (`ownerUid`, `ownerId`)
- ✅ Mestres têm acesso read-only às fichas dos jogadores
- ✅ Jogadores não podem editar personagens de outros jogadores
- ✅ Sistema de logs para auditoria
- ✅ Proteção contra mudança de propriedade em atualizações
- ✅ Coleções separadas para melhor isolamento de dados

---

## 📝 Roadmap Futuro

- [ ] Sistema de combate integrado
- [ ] Chat entre jogadores em tempo real
- [ ] Rolador de dados compartilhado na mesa
- [ ] Sistema de iniciativa automática
- [ ] Modo offline com sincronização
- [ ] Exportação de fichas em PDF
- [ ] Sistema de campanhas com progressão
- [ ] Sistema de quests/missões
- [ ] Marketplace de itens entre jogadores
- [ ] App mobile nativo (iOS/Android)

---

## 🐛 Reportar Bugs

Encontrou algum problema? 

1. Verifique se já não foi reportado em [Issues](https://github.com/Wotan8/rpglendasereliquias/issues)
2. Abra uma nova issue com:
   - Descrição detalhada do problema
   - Passos para reproduzir
   - Screenshots (se possível)
   - Navegador e versão
   - Se é jogador ou mestre
   - Mensagens de erro do console (F12 no navegador)

---

## 💥 Créditos

### 🎲 Criador do Sistema de RPG
**Igor Estevam A.S.**
- Criador do RPG Lendas e Relíquias
- Desenvolvimento de mecânicas, regras, ambientação e balanceamento
- Mestre há mais de 12 anos
- Desenvolvedor principal do sistema online (refatoração completa, correção de bugs, expansão de funcionalidades e arquitetura atual)

### 💻 Versão Inicial (v0)
**Lucas Gabriel**
- Desenvolvimento da primeira versão básica do sistema
- Implementação inicial da estrutura HTML
- **Participação apenas na versão 0 (inicial/básica) do projeto**
- Sem envolvimento no desenvolvimento posterior

---

## 📄 Licença

Este projeto é de código aberto para fins educacionais e de entretenimento. 

O sistema de RPG **Lendas e Relíquias**, incluindo suas mecânicas, regras, ambientação e balanceamento, são propriedade intelectual de **Igor Estevam A.S.**

---

## 📞 Suporte

- **Issues:** [GitHub Issues](https://github.com/Wotan8/rpglendasereliquias/issues)
- **Desenvolvedor:** Igor Estevam A.S.
- **Sistema RPG:** Igor Estevam A.S.

---

<div align="center">

**⚔️ Que suas aventuras sejam lendárias! ⚔️**

</div>
