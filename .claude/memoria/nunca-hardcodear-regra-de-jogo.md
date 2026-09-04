---
name: nunca-hardcodear-regra-de-jogo
description: PROIBIDO hardcodear valor/regra de jogo no código — o sistema é 100% personalizável em nuvem; toda régua vem do cadastro no Firestore
metadata: 
  node_type: memory
  type: feedback
  originSessionId: f2b5d71b-b528-403e-b9b5-b42d5ccb7889
  modified: 2026-08-13T17:47:10.095Z
---

O usuário foi explícito (13/08/2026, em maiúsculas): **hardcoded é inaceitável
neste projeto**. O sistema inteiro é data-driven do Firestore — atributos,
VDs, perícias, partes do corpo, equipamento, mecânicas. Um número ou regra de
jogo cravado no JS quebra a promessa central do produto: o Mestre personaliza
TUDO pelo Painel do Criador, sem tocar em código.

Caso que gerou a bronca: `DADO_DESARMADO = '1d4'` e o tipo Contundente fixos
em item-scope-calc.js (golpe desarmado), com tooltip "FOR + Perícia: Briga"
em texto. O certo: dado, tipos e vínculos de acerto do golpe vêm do cadastro
de **Partes do Corpo** (`system/data/bodyParts` — formulaDano, tipoGolpe,
valoresDerivadosVinculados), como equipamento já faz.

A regra vale também DENTRO do dado, não só no código (bronca de 13/08/2026):
valor de vínculo (`valoresDerivadosVinculados`) mora na **Equação de Valor**,
nunca no campo `modificador`. `modificador` é o formato legado — os motores só
o leem quando não há equação, e o editor do Criador o zera assim que a equação
existe. Gravar bônus ali é hardcode disfarçado: número morto, que não escala,
não referencia nada da ficha e some no primeiro toque pela UI. Caso: gravei
`{maos: 2, modificador: 2}` no Dano das armas Versáteis em vez de
`{maos: 2, equacao: [{tipo:'fixo', valor:2}]}`.

**Why:** o diferencial do sistema é ser 100% personalizável em nuvem; hardcode
transfere decisão de design do Mestre para o programador — e número cravado
num campo legado ainda apodrece sem avisar.

**How to apply:** ao implementar QUALQUER regra que envolva número, dado,
fórmula, rótulo de jogo ou vínculo: perguntar "de que cadastro isso deveria
vir?". Se o cadastro não tem o campo, **criar o campo** (spec compartilhada +
formulários) e migrar os dados — nunca cravar o valor no código. Fallback de
migração aceitável: cair no REGISTRO pelo id (dado em nuvem), nunca numa
constante. Constantes permitidas são só de infraestrutura (throttle, z-index,
cache), jamais de regra de jogo.
