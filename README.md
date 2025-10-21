# ⚔️ Lendas e Relíquias - Sistema de Fichas Digitais

<div align="center">

![Status](https://img.shields.io/badge/status-ativo-success.svg)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?logo=firebase&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)

Sistema online de fichas digitais para o RPG **Lendas e Relíquias**

[🎮 Acessar Sistema](https://lendasereliquiasrpg.web.app) | [📖 Reportar Bug](https://github.com/lucasgabriel-fiap/lendas-reliquias-rpg/issues)

</div>

---

## 📖 Sobre o Projeto

Sistema web completo para gerenciamento de personagens do RPG **Lendas e Relíquias**, com funcionalidades de autenticação, salvamento automático na nuvem e painel do mestre em tempo real.

### 🎲 Sobre o RPG

**Lendas e Relíquias** é um sistema de RPG criado por **Igor Estevam AS**, mestre com mais de 12 anos de experiência, que desenvolveu todo o sistema de regras, mecânicas e ambientação.

### 💻 Desenvolvimento

Sistema online desenvolvido por **Lucas Gabriel**, transformando as regras físicas em uma plataforma digital interativa com Firebase.

---

## ✨ Funcionalidades

### 👥 Para Jogadores
- ✅ **Autenticação segura** com Firebase Auth
- ✅ **Ficha digital completa** com todos atributos, habilidades e características
- ✅ **Auto-save na nuvem** - nunca perca seus dados
- ✅ **Sistema de classes** com habilidades específicas
- ✅ **Gerenciamento de inventário** com múltiplos containers
- ✅ **Rastreamento de recursos** (HP, Determinação, Sanidade)
- ✅ **Notas do personagem** integradas
- ✅ **Rolador de dados** D10 com explosão
- ✅ **Sistema de EXP** e evolução

### 👑 Para Mestres
- ✅ **Painel em tempo real** com todos os jogadores
- ✅ **Monitoramento de status** (HP crítico, sanidade baixa)
- ✅ **Histórico de mudanças** automático
- ✅ **Detecção de anomalias** (valores suspeitos)
- ✅ **Visualização completa** de fichas, inventário e notas
- ✅ **Estatísticas da mesa** (EXP médio, jogadores ativos)
- ✅ **Filtros e busca** inteligente

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Backend:** Firebase (Authentication + Firestore)
- **Hosting:** Firebase Hosting
- **Tempo Real:** Firestore Realtime Listeners
- **Autenticação:** Firebase Auth (Email/Password)

---

## 🚀 Como Usar

### Para Jogadores:

1. Acesse: [lendasereliquiasrpg.web.app](https://lendasereliquiasrpg.web.app)
2. Crie sua conta escolhendo **"Jogador"**
3. Preencha sua ficha de personagem
4. Tudo é salvo automaticamente na nuvem ☁️

### Para Mestres:

1. Crie conta escolhendo **"Mestre"**
2. Insira o código secreto (fornecido pelo administrador)
3. Acesse o painel para monitorar todos os jogadores
4. Acompanhe em tempo real todas as mudanças

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
4. Selecione a localização (ex: `southamerica-east1`)
5. Clique em **"Ativar"**

### 4️⃣ Regras de Segurança do Firestore

Na aba **"Regras"** do Firestore, cole estas regras:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Coleção de usuários (roles)
    match /users/{userId} {
      // Qualquer um autenticado pode ler (para verificar role)
      allow read: if request.auth != null;
      
      // Apenas o próprio usuário pode escrever seus dados
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Coleção de personagens (fichas)
    match /characters/{characterId} {
      // Leitura permitida para:
      // 1. O dono da ficha
      // 2. Usuários com role 'mestre'
      allow read: if request.auth != null && (
        request.auth.uid == characterId ||
        isMaster()
      );
      
      // Escrita permitida apenas para o dono da ficha
      allow write: if request.auth != null && request.auth.uid == characterId;
    }
    
    // Função auxiliar para verificar se é mestre
    function isMaster() {
      return request.auth != null && 
             exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'mestre';
    }
  }
}
```

**📌 Explicação das Regras:**

- **Usuários:** Qualquer pessoa autenticada pode ler (para verificar roles), mas só pode editar seus próprios dados
- **Personagens:** 
  - ✅ Jogadores podem ler/escrever apenas sua própria ficha
  - ✅ Mestres podem ler TODAS as fichas (para o painel)
  - ❌ Ninguém pode editar ficha de outro jogador

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

Abra os arquivos `index.html`, `ficha.html` e `mestre.html` e substitua o `firebaseConfig` pelo seu:
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

### 8️⃣ Código Secreto do Mestre

No arquivo `index.html`, procure pela linha (~200) e altere o código:
```javascript
const MASTER_SECRET_CODE = "SEUCÓDIGOAQUI";
```

⚠️ **Importante:** Mude este código antes de fazer deploy! Este código é necessário para que alguém possa criar uma conta de Mestre.

### 9️⃣ Deploy
```bash
# Instale o Firebase CLI (apenas uma vez)
npm install -g firebase-tools

# Faça login
firebase login

# Inicialize o projeto (se necessário)
firebase init

# Faça o deploy
firebase deploy
```

---

## 📋 Estrutura do Projeto
```
lendas-reliquias-rpg/
│
├── index.html          # Página de login/cadastro
├── ficha.html          # Sistema de ficha do jogador
├── mestre.html         # Painel do mestre
├── 404.html            # Página de erro
├── firebase.json       # Configuração do Firebase Hosting
├── .firebaserc         # Configuração do projeto Firebase
└── .gitignore          # Arquivos ignorados pelo Git
```

---

## 🎮 Classes Disponíveis

- ⚔️ **Guerreiro** - Combate direto e controle de campo
- 🏹 **Caçador** - Rastreio e combate à distância
- 🌿 **Druida** - Comunhão animal e alquimancia
- 💀 **Adepto (Necromante)** - Controle de mortos-vivos
- 🗡️ **Ladino** - Furtividade e dano oportunista
- ✨ **Pallacerdote** - Suporte e cura divina
- 🔮 **Ritualista (Abismancia)** - Controle por rituais abissais

---

## 🔐 Segurança

- Autenticação obrigatória para acessar o sistema
- Dados isolados por usuário no Firestore
- Código de mestre para prevenir acesso não autorizado
- Firestore Rules configuradas para máxima segurança
- Mestres têm acesso read-only às fichas dos jogadores
- Jogadores não podem editar fichas de outros jogadores

---

## 📝 Roadmap

- [ ] Sistema de combate integrado
- [ ] Chat entre jogadores
- [ ] Dados compartilhados na mesa
- [ ] Sistema de iniciativa automática
- [ ] Modo offline com sincronização
- [ ] Exportação de fichas em PDF
- [ ] Sistema de campanhas

---

## 🐛 Reportar Bugs

Encontrou algum problema? 

1. Verifique se já não foi reportado em [Issues](https://github.com/lucasgabriel-fiap/lendas-reliquias-rpg/issues)
2. Abra uma nova issue com:
   - Descrição detalhada do problema
   - Passos para reproduzir
   - Screenshots (se possível)
   - Navegador e versão

---

## 👥 Créditos

### 🎲 Criador do Sistema de RPG
**Igor Estevam AS**
- Criador do RPG Lendas e Relíquias
- Desenvolvimento de mecânicas, regras e ambientação
- Mestre há mais de 12 anos

### 💻 Desenvolvedor do Sistema Online
**Lucas Gabriel**
- Desenvolvimento da plataforma web
- Integração com Firebase
- Interface e experiência do usuário
- [GitHub](https://github.com/lucasgabriel-fiap)

---

## 📄 Licença

Este projeto é de código aberto para fins educacionais e de entretenimento. 

O sistema de RPG **Lendas e Relíquias**, incluindo suas mecânicas, regras e ambientação, são propriedade intelectual de **Igor Estevam AS**.

---

## 📞 Suporte

- **Issues:** [GitHub Issues](https://github.com/lucasgabriel-fiap/lendas-reliquias-rpg/issues)
- **Desenvolvedor:** Lucas Gabriel
- **Sistema RPG:** Igor Estevam AS

---

<div align="center">


</div>
