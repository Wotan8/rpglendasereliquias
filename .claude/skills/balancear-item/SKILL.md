---
name: balancear-item
description: Balanceia armas, armaduras e escudos de Lendas e Relíquias pelo modelo de combate do Núcleo v2. Use ao criar item novo com potência-alvo ("cria uma espada Q2 com Afiação 1", "uma armadura que aguente uma arma Q3"), ao auditar item já cadastrado ("balanceia a Armadura X"), ou ao decidir Qualidade, dado de dano, classe de armadura (Leve/Média/Pesada), Afiação, Encantamento ou Aura de qualquer equipamento.
---

# Balancear item — Lendas e Relíquias (Núcleo v2)

A régua é o **Livro de Regras do Jogador 2.0x**, Capítulos 5 (Equipamento) e 6 (Combate),
e os números vivem em `config/regras` (aba Regras do Painel do Criador). Confirme lá antes
de calcular: o texto abaixo é de 04/09/2026.

## 1. O modelo do item

Toda peça tem **Qualidade (Q), de 0 a 5** — 5 é o limite da forja mortal.

| Peça | O que a Qualidade faz |
|---|---|
| Arma | +Q no dano |
| Armadura (o conjunto tem uma Q) | Blindagem = **Leve 1 / Média 2 / Pesada 3**, + Q |
| Escudo | +Q no Bloquear |
| Foco mágico | conjura magia até Q sem redutor |
| Arco e besta | a Qualidade vive no maço de projéteis |

**A perícia é a porta.** Qualidade acima da Perícia de Arte do usuário dá **redutor no Alvo
igual à diferença** (Arma 3 com um montante Q5: −2). A peça não bate mais fraco; quem a
usa acerta menos. Não existe Domínio, Especialização nem Liga.

Por cima da Qualidade:

| | O que é | Limite |
|---|---|---|
| **Afiação** (na armadura: Reforço) | +1 por ponto. Comum (ferreiro): dano físico ou Blindagem. Arcano (forjarcanista): +1 de dano de **uma** Essência, ou +1 de Blindagem Arcana | até Q pontos, comum e arcano somados |
| **Encantamento** | um efeito com nome: na arma, condição direta de nível 1 ao acertar (Sangrando, Queimando, Lento); na peça vestida, imunidade a uma condição ou Vantagem numa perícia que não seja de Arte nem de defesa. Nunca mexe em número | 1 por peça (2 no Graal) |
| **Aura da peça** | Qualidade 6 a 10, um degrau por ponto; pede portador com perícia igual | 0 a 5 |

**Danificada.** Desastre no dado come 1 ponto de Afiação (comum antes do arcano); sem
ponto, a peça fica Danificada: −1 Q até um ferreiro. Não existe Integridade.

**Penalidade** é da peça e mora no catálogo (`atributosVinculados`, `periciasVinculadas`):
pesada desconta DES (e por isso a Esquiva), Furtividade e às vezes Deslocamento; escudo
grande desconta Acerto. Não crie mecânica só para somar penalidade.

**Slots do corpo** (`equipavelEm`, `slotsAdicionais`) só dizem **onde** a peça encaixa e o
que ela exclui. A Blindagem não é mais por slot: é a classe + Q, uma vez, do conjunto.

## 2. O dano e a Blindagem na mesa (Cap. 6)

```
Acerto     = atributo + Perícia de Arte, contra a Defesa do alvo (Esquiva, Aparar ou Bloquear = nível da perícia)
Dano bruto = dado + FOR (ou DES) + Q + Afiação comum
Dano final = ⌊ bruto − Blindagem ⌋, piso 1 por golpe que acerta
Essência   = a parcela arcana (Afiação arcana, magia, runa) só a Blindagem Arcana barra
Crítico    = Alvo + 2 Graus e dado cheio; Defesa maior segura
```

Uma Blindagem só — não existe dano tipado nem 17 Blindagens. Piso de 1 é do golpe inteiro.

## 3. A janela letal — o alvo de todo cálculo

```
passa  = (dado_médio + FOR + Q_arma + Afiação) − (Blindagem_classe + Q_armadura + Reforço)
golpes = Vitalidade ÷ max(1, passa)
```

Referência: Vitalidade `(VIG + Tamanho) × 3` do humano de criação (VIG 2, Tamanho 5 →
21; use o valor real da ficha quando houver). Par de referência do Livro: Guerreiro FOR 4
+ Arma 3, Espada Longa 1d8 Q0 contra Média Q0.

| Alvo veste | Blindagem | Q0 contra Q0 | Q2 contra Q2 | Q5 contra Q5 |
|---|---|---|---|---|
| nada | 0 | 21 ÷ 8,5 = 2,5 | 21 ÷ 10,5 = 2,0 | 21 ÷ 13,5 = 1,6 |
| Leve | 1 + Q | 2,8 | 2,8 | 2,8 |
| Média | 2 + Q | 3,2 | 3,2 | 3,2 |
| Pesada | 3 + Q | 3,8 | 3,8 | 3,8 |

Leia a tabela: **arma e armadura da mesma Qualidade se cancelam** — a progressão real está
na classe da armadura, no dado da arma e no atributo. Quem está mal equipado morre;
descasamento de Qualidade é desejado (arma Q3 contra pele nua: 1,8 golpes; arma Q0 contra
Pesada Q3: 21 ÷ 1 = 21).

**Faixa aceitável pareada: 3 a 10 golpes** (o Livro pede 4 a 5 no par de referência com
perícias de criação). Abaixo de 3 é morte sem decisão; acima de 10 o combate não resolve.
Fora da faixa, avise e ajuste.

## 4. Poder do item e Patamar (Cap. 3 / Página 12)

```
Poder da peça = (Q + Afiação comum + Afiação arcana) × 5 + 10 por Encantamento + 25 por ponto de Aura
```

| Patamar | Poder do personagem | Qualidade "de casa" |
|---|---|---|
| 0 Inicial | até 500 | Q0 |
| 1 Veterano | 500 a 850 | Q1 |
| 2 Especialista | 850 a 1.300 | Q2 |
| 3 Mestre | 1.300 a 1.800 | Q3 |
| 4 Obra-Prima | 1.800 a 2.500 | Q4 |
| 5 Graal | acima de 2.500 | Q5 |

A tabela (`config/regras` → `poder.patamares`) é régua para o Narrador, nunca trava: uma
peça acima do Patamar do grupo é tesouro, não erro. Mas **avise** quando o item que você
cadastra está dois Patamares acima da mesa que vai recebê-lo.

## 5. Os três pedidos e como resolver cada um

### A) "Cria uma arma Q N (com Afiação, Encantamento…)"

1. Escolha o dado pela categoria (uma mão 1d6–1d8, duas mãos 1d10–1d12, distância 1d4–1d10).
   O dado diz mãos e alcance, não força: Montante 1d12 e Adaga 1d4 são ambos Q0.
2. `Q` = o que foi pedido; Afiação ≤ Q; 1 Encantamento (condição direta de nível 1).
3. Rode a janela contra **nada**, **Média Q0** e **Pesada Q igual**. Confira a faixa 3 a 10.
4. Diga a porta: quem tem Perícia de Arte abaixo de Q acerta com redutor.

### B) "Cria uma armadura que aguenta arma Q N"

Resolva para trás, escolhendo quantos golpes quer aguentar (4 se o usuário não disser):

```
passa_desejado = Vitalidade ÷ golpes_desejados
Blindagem      = dado_médio + FOR + N − passa_desejado
```

Compare com `classe + Q`: Leve 1–6, Média 2–7, Pesada 3–8 (Reforço soma até Q). Se não
couber em Pesada Q5 + Reforço 5 (13), é peça de Aura: diga isso e não invente classe nova.

### C) "Balanceia a armadura X do site"

1. Leia o item (seção 7): `tags` (Leve/Média/Pesada), `qualidade`, `reforco`,
   `valoresDerivadosVinculados` (o modificador de Blindagem), `equipavelEm`, `slotsAdicionais`.
2. Confira que a Blindagem gravada = classe + Q + Reforço. Diferença é erro de cadastro,
   não escolha de design — reporte antes de mexer.
3. Rode a janela e mostre os golpes antes e depois.
4. Só grave depois de aprovação, com dry-run primeiro.

## 6. Escudo

Escudo não dá Blindagem: dá **+Q no Bloquear** e uma segunda defesa grátis por rodada
(`config/regras` → `combate`). Bloquear não vale contra magia. Ao balancear, olhe o Bloquear
resultante (perícia + Q, teto VIG) contra o Acerto da mesa, não a Blindagem.

## 7. Como ler e gravar

Padrão de acesso ao Firestore (copie de `functions/v2-limpeza.mjs`: dry-run por padrão,
`--apply` grava, backup do "antes" em `D:\…\scripts-backups`):

```js
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
  require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const grab = async c => (await db.collection(`system/data/${c}`).get())
  .docs.map(d => ({ id: d.id, ...d.data() }));
```

**Sempre dry-run primeiro, imprimindo o que vai mudar. Só grave com aprovação explícita.**
Cadastro editado sobe a versão (`versao`, escada de 0.01).

Campos de `system/data/equipment` que importam (o schema é `shared/equip-campos.js`):

| Campo | Uso |
|---|---|
| `formulaDano` | string do dado: `"1d8"`, `"1d8 / 1d10"` (versátil) |
| `qualidade` | 0 a 5 |
| `afiacao` / `reforco` | pontos comuns (≤ Q) |
| `afiacaoArcana` + `essenciaArcana` | ponto arcano e a Essência dele |
| `encantamento` | o efeito com nome (condição, imunidade ou Vantagem) |
| `aura` | 0 a 5, o que passa do 5 |
| `periciaId` | **a porta** — a Perícia de Arte que a peça exige |
| `valoresDerivadosVinculados` | `[{id: <id do VD Blindagem>, modificador: N}]` — busque o id por nome |
| `tags` | `Leve` \| `Média` \| `Pesada`, `Escudo`, `Livro` |
| `equipavelEm`, `slotsAdicionais` | onde encaixa (`bodyParts`) e o que exclui |
| `atributosVinculados`, `periciasVinculadas` | a penalidade da peça |

## 8. Refs em mecânica: o prefixo é obrigatório

Ao escrever qualquer mecânica que leia perícia, use **`"Perícia: X"`**, nunca o nome puro.
Há perícias homônimas de VD (Abismancia, Alquimancia…); sem o prefixo o motor lê o VD em
silêncio. Refs de item: `Item: Qualidade`, `Item: Afiação`, `Item: Afiação Arcana`,
`Item: Reforço`, `Item: Aura`. Nomes antigos (`Item: Liga`, `Fio`, `Grau`) não resolvem.

## 9. Sempre reporte junto

1. A conta da janela — golpes contra nada, Média Q0 e Pesada da mesma Q.
2. A porta (periciaId) e o redutor que um usuário de criação teria.
3. O Poder da peça e o Patamar em que ela cai.
4. Se cair fora da faixa de 3 a 10 golpes, diga e proponha o ajuste.
5. O que ficou de fora (Afiação acima de Q, Encantamento sem condição cadastrada, penalidade não cadastrada).
