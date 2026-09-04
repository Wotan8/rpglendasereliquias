---
name: escada-do-veneno-toxis-peconha
description: Toxis e Caltra são propriedades alquímicas (não condições); Peçonha é a condição de criatura que vale o dobro e só sai com Caltra.
metadata: 
  node_type: memory
  type: project
  originSessionId: ac772b56-3371-4678-a838-c5f783eaa1cd
  modified: 2026-09-01T01:26:01.442Z
---

**Toxis e Caltra NÃO são condições.** São **propriedades alquímicas** com potência P, do catálogo de Calinor Ivien — livro "As Oito da Bancada" (`book_ms3gb8iq5q9k0i`), régua em `book-regua-balanceamento` §8. Eu criei uma condição "Veneno" sem saber disso e tive de apagar; não repita o erro.

```
Toxis P    1 de dano por rodada, durante 2P rodadas (no máx. a cena)   0,58 un/ponto
Caltra P   remove P níveis de condição ou de veneno
Peçonha N  1 de dano/rodada por 4N rodadas, NÃO acaba na cena          1,16 un/nível
```

**Peçonha** (condição, criada 31/08/2026 a pedido do usuário) é o degrau acima do que a bancada produz: **Peçonha N ≡ Toxis 2N** — cada nível vale dois pontos da propriedade. Acumula até 5. **Não estanca, não apaga e não acaba com o fim da cena**: sai *só* com loção/poção de **Caltra de nível igual ou maior**. Nem Herbalismo, nem descanso, nem cura comum tiram.

A intenção declarada do usuário: é **o primeiro degrau de uma escada de condições que não se resolvem com tempo**, porque vêm criaturas com efeitos mais nocivos e mais difíceis de curar. Ao criar as próximas, siga o padrão — o que trava a cura é um item de nível correspondente, não um teste.

⚠️ **O travamento da cura em item não está precificado.** Peçonha custa 1,16 un/nível pela taxa do Toxis; o "só sai com Caltra" é valor a mais que a Régua ainda não cobra. Está declarado dentro da própria condição.

**Onde isso já mordeu:**
- **Serpente** estreia Peçonha 1 e vai a **0,77×** — acima do alvo de projeto (0,35×) *e* do teto de companheiro do Druida (0,6×). Reportado, **não recalibrado**. Decisão pendente: subir o carimbo dela para Comum, ou tornar a peçonha efeito de cena.
- **Fantoche** perdeu a Necrose. Com o rider precificado e pesado pela chance de acerto ele ia a 0,26× contra alvo de 0,15×, e não havia dado que resolvesse — a Necrose sozinha custa mais que o teto dele. Importa por causa do Limite de Fantoches (PRE + Servos de pé ao mesmo tempo). A podridão virou prosa.

**Régua para rider de ataque:** o valor de uma condição pendurada num golpe é **pesado pela chance de acerto** (`un × P`), porque o efeito só existe se o golpe entrar. Eu errei isso na primeira conta e inflei o estouro do Fantoche em mais do dobro. Ver [[bestiario-regua-v3-e-grau]] e [[livro-regua-balanceamento]].
