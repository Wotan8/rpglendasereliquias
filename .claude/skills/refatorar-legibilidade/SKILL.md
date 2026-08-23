---
name: refatorar-legibilidade
description: Refatora código já funcionando para ficar mais legível — quebra função gigante em pedaços nomeados, remove duplicação, limpa console.log e arquivo morto — sem mudar nenhum comportamento observável. Use quando o usuário pedir para "refatorar", "deixar mais legível/organizado", "quebrar essa função grande", "tirar a duplicação", "limpar os logs" de um arquivo ou frente específica, ou invocar /refatorar-legibilidade. Complementa varredura-otimizacao: aquela varre e propõe o QUE mexer (foco em desempenho/complexidade, com aprovação por tabela); esta executa COMO mexer com segurança (foco em estrutura/legibilidade, técnica de verificação byte a byte).
---

# Refatorar para legibilidade — sem quebrar nada

Uma regra domina todas: **comportamento observável não muda**. Mesmo HTML
gerado, mesmos ids no DOM, mesma ordem de efeitos colaterais, mesmas entradas
e saídas de cada função pública. Se a "melhoria" muda algo disso, não é
refatoração — é proposta separada para o usuário aprovar.

Isso aqui é a execução (o "como"), não a varredura de oportunidades (o "onde
mexer" é `varredura-otimizacao`). Use esta skill quando o escopo já está
definido — um arquivo, uma função gigante, uma frente inteira que o usuário
apontou — e o trabalho é reestruturar sem alterar o que a tela ou o motor
fazem.

## Ordem de trabalho (não pule etapas)

1. **Baseline antes de tocar em qualquer arquivo.** Rode a suíte inteira e
   anote o placar exato — quantos passam, quais falham. Falha pré-existente
   não é sua; mas precisa ser identificada AGORA, não descoberta depois como
   se fosse regressão sua.
   ```bash
   for f in $(find . -name "*.test.mjs" -not -path "./.claude/*" -not -path "*/node_modules/*"); do node "$f" >/dev/null 2>&1 || echo "FALHOU: $f"; done
   ```
2. **Leia a função inteira e todos os chamadores antes de reescrever.**
   Não refatore a partir de leitura parcial — a duplicação que parece boba pode
   esconder uma diferença de um caractere entre as duas cópias (categoria
   diferente, chave diferente). Ache essa diferença ANTES de unificar.
3. **Verifique a equivalência FORA do arquivo real, antes de aplicar.**
   Três técnicas, escolha pela natureza do código — detalhe de cada uma abaixo.
4. **Só depois de a equivalência bater, aplique no arquivo real.** Nunca edite
   o arquivo de produção primeiro para "ver se funciona" — o teste vem antes.
5. **Rode a suíte de novo a cada mudança significativa**, não só no final.
   Se caiu de um placar verde para vermelho, a última mudança é a suspeita —
   reverta ela, não a sessão inteira.
6. **Verifique ao vivo quando o resultado é visível** (página, formulário,
   janela do Tabuleiro) — suíte de `.test.mjs` não pega regressão de DOM/CSS.
   Use o harness `__check-*.html` mais próximo do que você mexeu.
7. **Commit por frente**, um por área (`ficha-v1.7_1/`, `painel-mestre/`,
   `tabuleiro/`...), com contagem de linhas antes/depois na mensagem.

## As três técnicas de verificação

Escolha pela natureza do código que está sendo extraído/quebrado:

| Natureza | Técnica |
|---|---|
| Gera HTML por template string (formulário, modal, linha de lista) | **Sandbox de equivalência** — rode a versão antiga e a nova no mesmo `vm` e compare byte a byte |
| Lógica pura (cálculo, filtro, regra de negócio) | Extraia para função nomeada; se não há `.test.mjs` cobrindo, escreva um cobrindo a peça pura extraída |
| Fiação de eventos / orquestração (a função só chama outras) | Checagem de sintaxe (`node --check`) + suíte completa + harness `__check-*.html` ao vivo |

### Técnica 1 — Sandbox de equivalência (a mais valiosa aqui)

Para qualquer função que monta HTML por concatenação de string (é o padrão
predominante neste projeto: `buildXForm()`, `openForm()`, `render*()`), a
suíte de testes não prova nada sozinha — o jeito de saber que o refactor não
mudou um `<option>` ou um `id` é rodar as DUAS versões e comparar a saída.

```js
const fs = require('fs'), vm = require('vm');

// stubs: mock só o que a função toca (globais, helpers externos) — nunca o
// próprio código sob teste
const stub = () => ({
  CampoImagem: { html: o => `<<IMG ${o.id}>>` },
  esc: t => String(t ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;'),
  console,
});
const roda = (codigo, chamada) => {
  const s = stub(); s.globalThis = s;
  vm.createContext(s);
  vm.runInContext(`${codigo}\nglobalThis.__out = ${chamada};`, s);
  return s.__out;
};
// espaço em branco não importa; comentário HTML não importa
const norm = h => h.replace(/<!--[\s\S]*?-->/g, '').replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();

const antigo = norm(roda(codigoAntigo, 'buildForm()'));
const novo   = norm(roda(codigoNovo,   'buildForm()'));
console.log('idêntico?', antigo === novo, '|', antigo.length, novo.length);
if (antigo !== novo) {
  for (let i = 0; i < Math.max(antigo.length, novo.length); i++) {
    if (antigo[i] !== novo[i]) {
      console.log('divergiu no char', i);
      console.log('ANTIGO:', JSON.stringify(antigo.slice(Math.max(0,i-150), i+150)));
      console.log('NOVO  :', JSON.stringify(novo.slice(Math.max(0,i-150), i+150)));
      break;
    }
  }
}
```

Passos práticos:
1. Recorte o trecho de origem (função antiga de `git show HEAD:arquivo` ou do
   arquivo atual antes de editar) e o trecho novo (seu rascunho, ainda **fora**
   do arquivo real — escreva primeiro num arquivo de scratchpad).
2. Rode os dois no mesmo sandbox, para vários casos de entrada (item null,
   item de cada tipo relevante, edição vs criação) — não só um caso feliz.
3. Só depois de bater byte a byte (ou normalizado, se espaço em branco de
   fato não importa) é que o trecho novo substitui o antigo no arquivo real.
4. Depois de aplicar, rode a MESMA comparação apontando para `git show
   HEAD:arquivo` vs o arquivo já editado — prova que a árvore de trabalho
   bate com o que você validou no sandbox, não só o rascunho solto.
5. Se o formulário tem ids que outro módulo acha por `getElementById`,
   escreva um `.test.mjs` que lista os ids obrigatórios e falha se algum
   sumir — a comparação de HTML prova equivalência hoje, o teste prova que
   não regride amanhã (veja `ficha-v1.7_1/js/aliado-form.test.mjs` como
   exemplo já no repo).

### Técnica 2 — Lógica pura extraída

Puxe o corpo do cálculo para fora do `if/else` gigante, dê nome à peça, e
prove com `assert` — casos de borda incluídos, não só o caminho feliz. Exemplo
do padrão da casa (veja `ficha-v1.7_1/js/derived-values-render.test.mjs`):
piso/teto de uma mecânica, pintura de um conjunto de "dots", montagem de um
bloco de tooltip — cada peça pura ganha 3-5 `assert` cobrindo os limites.

### Técnica 3 — Fiação/orquestração

Quando a função só decide "quem chama quem" (delegação de evento, handler de
clique, boot de uma janela), não há o que comparar byte a byte. Confie em:
`node --check arquivo.js` (sintaxe), suíte completa, e o harness `__check-*.html`
mais próximo rodando ao vivo no browser antes e depois.

## O padrão de recorte de trecho (já é convenção da casa)

Vários `.test.mjs` do projeto extraem uma função do arquivo fonte por
`indexOf` até o fechamento `\n}\n` — reuse esse padrão em vez de inventar
outro:

```js
const src = readFileSync(new URL('./arquivo.js', import.meta.url), 'utf8')
  .replace(/\r\n/g, '\n');   // CRLF quebra o indexOf('\n}\n') — normalize SEMPRE
const trecho = (assinatura) => {
  const ini = src.indexOf(assinatura);
  assert.ok(ini > 0, `${assinatura} não encontrada`);
  const fim = src.indexOf('\n}\n', ini) + 3;
  return src.slice(ini, fim);
};
```

Esqueceu o `.replace(/\r\n/g, '\n')` já quebrou um teste real deste repo
(`pericia-exclusiva-escopo.test.mjs` — arquivo salvo com CRLF por editor do
Windows, `indexOf` nunca achava o fecho). Se um teste que usa esse padrão
falhar do nada, suspeite disso antes de suspeitar do seu refactor.

## O que é seguro remover, e o que exige grep antes

- **`console.log` de boot/rastro** ("✅ X carregado", "🔧 [debug]...") — seguro
  remover em lote. **`console.warn`/`console.error` ficam sempre** — sinalizam
  problema real, não são ruído.
- **Log que aparece na mesa/sessão** (ex.: resumo do que um consumível fez) —
  NÃO é ruído de boot, é funcional. Se um teste existente falhar depois de você
  remover um log, ele pode estar checando esse texto — leia o teste antes de
  assumir que é flutuação.
- **Arquivo aparentemente morto** — grep em TODOS os lugares antes de apagar:
  `<script src=` nos `.html`, `PRECACHE_URLS` do `sw.js`, `onclick="Foo.bar()"`
  em template string, e não só chamada direta no JS. Prefira `git rm` (fica no
  histórico, reversível) a `rm`.
- **Duplicação entre dois arquivos "irmãos"** (ex.: ficha do personagem vs
  ficha de NPC) — confirme que as duas cópias fazem exatamente a mesma coisa
  antes de unificar. Se uma tem um `if` a mais, esse `if` é a razão de existir
  duas cópias — não apague a diferença sem entender por quê.

## Investigar falha "pré-existente" antes de descartar como não-sua

Um harness `__check-*.html` vermelho ANTES de você tocar em qualquer coisa não
é motivo para ignorar — pode ser um bug de verdade escondido atrás do rótulo
"já estava assim". Compare o comportamento da versão de HEAD sob o MESMO
harness:

```bash
git stash push -q -- arquivo/que/voce/mexeu.js   # ou: rode contra git show HEAD:arquivo
# abra o __check-*.html de novo, confira o placar
git stash pop
```

Se o placar é idêntico com HEAD, a falha é preexistente e fora do escopo desta
sessão — mas ainda vale diagnosticar a causa raiz e, se for barato corrigir
(era o caso de um teste medindo geometria antes do CSS assentar — um
`await` de um turno do event loop resolveu), corrija e registre separado do
resto do refactor.

## Contratos observáveis deste projeto (herdados de varredura-otimizacao)

Os mesmos quatro valem aqui: nomes de campo do Firestore já gravado, globais
`window.*` chamados só por `onclick=` no HTML, `sw.js` (arquivo tocado que
está em `PRECACHE_URLS` exige subir `VERSION`), e `firestore.rules`/
`storage.rules` (não mexa nelas nesta skill — são segurança, não legibilidade;
se um refactor esbarrar numa rule, pare e avise o usuário).

## Quando NÃO usar esta skill

- Escopo ainda não está definido — primeiro rode `varredura-otimizacao` para
  mapear e aprovar o quê, depois volte aqui para o como.
- A "melhoria" exige mudar uma saída, uma mensagem, ou o shape de um documento
  do Firestore — isso é mudança de comportamento, trate como feature/fix
  normal com aprovação explícita, não como refactor silencioso.
- Não existe NENHUM portão de verificação para o código em questão (nem
  `.test.mjs` possível, nem harness `__check-*.html`, nem forma de testar ao
  vivo) — registre como "sem portão" e não mexa; refatorar às cegas é como se
  perdeu 4/28 testes do inventário de NPC por confundir timing de layout com
  regressão real.
