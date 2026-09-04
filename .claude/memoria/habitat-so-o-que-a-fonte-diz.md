---
name: habitat-so-o-que-a-fonte-diz
description: "Ao traduzir ficha do cofre, habitat genérico fica genérico — escolher um lugar do banco \"porque combina\" é inventar lore."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ac772b56-3371-4678-a838-c5f783eaa1cd
  modified: 2026-09-01T03:22:56.582Z
---

Traduzindo o bestiário do cofre para o banco em 31/08/2026, inventei dois habitats e o usuário me pegou:

| Criatura | O cofre diz | Eu gravei |
|---|---|---|
| Espectro da Seiva Negra | "Floresta densas e árvores corrompidas" + link `[[Floresta de Sylmari]]` | ~~Floresta de Velmora~~ |
| Avarbus Azire | "Ruínas/Masmorras · Lugares Abandonados" | ~~Ruínas de Velmora~~ |

Nenhum dos dois cita Velmora. Eu raciocinei "Velmora é o lugar corrompido/arruinado, combina melhor" — e isso é exatamente inventar. Pior: escrevi um capítulo inteiro do Bestiário ("O Que Velmora Cria") em cima da invenção, com uma ecologia de Velmora que eu tinha acabado de fabricar. O capítulo foi apagado.

**Why:** habitat genérico não é lacuna a preencher. "Ruínas/Masmorras" é a resposta, não a pergunta. Escolher um lugar concreto do banco porque ele "encaixa" é criar cânone sem autorização — e o custo é alto, porque outras coisas passam a ser escritas em cima. Velmora é pequena; pôr um alfa raro lá contradiz o mundo. Ver [[nunca-inventar-lore]].

**How to apply:** ao traduzir criatura de fonte externa, o campo `habitat` recebe **as palavras da fonte, verbatim**, mesmo genéricas. O padrão certo já estava no banco e eu não olhei: o **Avarbus comum** guarda `Ruínas/Masmorras, Lugares Abandonados. Clima Temperado ou Tropical.` — antes de escrever habitat de uma variante, **leia o da espécie que já está cadastrada e copie**. Se a fonte linka um lugar (`[[Floresta de Sylmari]]`), use aquele, convertendo a grafia velha (Sylmari → Silmari). Se não linka nenhum, deixe genérico e pergunte antes de ancorar.

Trava barata que eu já uso e que NÃO pega este caso: o script confere se o habitat existe em `worldbuilding-geography`. "Ruínas de Velmora" existe — passou na conferência e mesmo assim estava errado. **Existir no banco não é a mesma coisa que estar na fonte.**
