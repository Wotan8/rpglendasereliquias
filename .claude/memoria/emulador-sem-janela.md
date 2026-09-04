---
name: emulador-sem-janela
description: "Nunca subir o emulador do Firestore por `emulators:exec` — abre janela de Java e não morre; usar javaw oculto e fechar no fim."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: fc158354-422d-4adf-bbdf-dc27c9eee460
  modified: 2026-09-03T03:36:02.032Z
---

Rodar as rules com `npx firebase-tools emulators:exec` está **proibido** nesta
máquina. Ele sobe o emulador com `java.exe`, que no Windows cria console e
ícone na barra de tarefas — e o processo **não morre** no fim do exec. Cada
rodada deixa mais um.

**Why:** em 03/09/2026 eu empilhei 11 processos de Java na barra do usuário
caçando duas falhas de rules. Ele: *"MANO, muito chato esses cmd de java
abrindo aqui na minha cara PQP"* e depois *"FAZ ESSA MERDA SEM ESSAS DESGRAÇA
ABRINDO NA MINHA CARA"*. É a tela dele; ferramenta minha não invade.

**How to apply:** UM emulador com `javaw.exe` (não tem console), oculto,
reaproveitado entre rodadas, e fechado no fim — sempre em `finally`:

```powershell
$jar = "$env:USERPROFILE\.cache\firebase\emulators\cloud-firestore-emulator-v1.19.8.jar"
$p = Start-Process "C:\Program Files\Java\jdk-17\bin\javaw.exe" -WindowStyle Hidden -PassThru `
     -ArgumentList @("-Duser.language=en","-jar",$jar,"--host","127.0.0.1","--port","8532",
                     "--websocket_port","9151","--project_id","demo-rules","--single_project_mode","true")
# roda: FIRESTORE_EMULATOR_HOST=127.0.0.1:8532 node <suite> <rules>
Stop-Process -Id $p.Id -Force
```

Duas armadilhas que custaram tempo:

- **`--websocket_port` não é opcional.** Sem ele a suíte trava no meio, com o
  SDK repetindo `UNKNOWN: Application error processing RPC` em backoff
  infinito. Parece bug de regra e não é.
- **A suíte precisa de `env.clearFirestore()` no começo.** Sem isso ela só
  passa na primeira rodada contra um banco novo: depois tropeça no próprio
  rastro (o `logs/log-1` da rodada anterior faz o `setDoc` virar update
  negado) e acusa furo de regra onde não há.

Se `Stop-Process` for negado pelo classificador, PARE e peça — não deixe
processo acumulando.

Relacionado: [[varredura-seguranca-2026-08-31]], [[eu-nao-defino-tarefa]].
