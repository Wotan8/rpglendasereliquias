---
name: limitacao-dano-nao-estruturado
description: "Dano de arma é texto manual na ficha, não valor calculável — efeitos de \"modificar/dobrar dano\" só podem ser informativos"
metadata: 
  node_type: memory
  type: project
  originSessionId: b84f74d3-53ae-4c6b-9e85-e867d96f7e1e
  modified: 2026-07-30T03:42:31.921Z
---

O **dano de arma** é texto livre, mas **existe um VD `Dano` calculável**.
Corrigido em 28/07/2026 (a versão anterior desta nota dizia que não existia
alvo "Dano" — estava errada).

Fatos do motor:
- **EXISTE** o valor derivado `Dano` (`key=JYISs9MKSNeQ9MdJzkyT`, publicado)
  com a mecânica "Dano (base)" = `Dano += FOR`. Logo, `modificar` no alvo
  `"Dano"` FUNCIONA — dá pra somar perícia/atributo nele. Existe também
  `Dano da Língua` (Tamano) = FOR + 1, mesmo padrão.
- O que continua NÃO estruturado: armas (`system/data/equipment`,
  `tipo: "Arma"`) não têm campo de dano — têm `categoriaArma`, `tags`, `peso`,
  `pressaoBase`. Na ficha o dano por arma é campo de texto livre (`wpn_dano`,
  placeholder `"1d10+2"`).
- Dano recebido também é manual (jogador subtrai da Vitalidade).
- **Piso de dano é regra de mesa, deliberadamente NÃO mecanizada** (decidido em
  29/07/2026): se `dano − Blindagem ≤ 0`, o jogador subtrai 1 da Vitalidade do
  alvo à mão. Não existe caminho no motor para isso porque a subtração de dano
  já é manual — não há o que interceptar. Não tente cadastrar mecânica pra isso.
- Equipment TEM campo `tags`, mas nada no motor lê a tag de um item equipado
  para modificar dano.

**Why importa:** efeito do tipo "soma X no dano" É mecanizável (alvo `Dano`).
O que NÃO é mecanizável é qualquer coisa que dependa da **arma específica**:
"+X de dano com adaga", "2× contra alvo marcado", "dobra o dano da arma" —
porque a arma não carrega valor de dano e nada no motor lê a tag de um item
equipado para modificar dano.

**How to apply:** somar atributo/perícia no VD `Dano` → mecânica `modificar`
normal. Efeito condicionado a arma ou alvo → peculiaridade informativa (regra
pro mestre). Ex.: "Fragilidade Letal" do Ladino. Cuidado com escalar sem teto:
`Dano += Perícia` cresce 1:1 pra sempre pós-criação — usar `÷ 2` ou `limitar`
se a fonte for raça/tribo em vez de classe.

Relacionado: [[especializacoes-removidas-do-sistema]] [[padrao-de-cadastro-de-manobras]]
