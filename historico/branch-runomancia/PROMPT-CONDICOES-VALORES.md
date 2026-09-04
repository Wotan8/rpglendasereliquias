# Recado para a frente de condições — duas condições sem valor legível

A régua (`functions/audit-regua-controle.mjs`) lê as 30 condições de
`system/data/conditions` e extrai o valor em unidades da **prosa da
descrição** — é o padrão que vocês mesmos estabeleceram ("valor declarado na
descrição de cada condição"). Duas da fase 2 não têm valor legível:

```
⚠ sem valor legível: Eletrocutado, Hemorragia
```

**Consequência:** qualquer habilidade que aplique uma das duas é medida como se
a condição não existisse. A Hemorragia é o par da 14ª Essência — vai aparecer
em magia de Sangral, em loção alquímica e em runa de Carmesim, e hoje as três
seriam subcontadas.

## O que resolve

Uma frase no padrão das outras 28, com o número explícito. Exemplo do formato
que a régua lê hoje (Atordoado): *"Vale 1,32 unidades na Régua: 1,00 pelo turno
roubado e 0,32 por não poder reagir (§1.1)."*

Para a **Hemorragia N** há uma sutileza que vocês já anteciparam: ela dobra se
o alvo gastar a Ação de Movimento. Pelo §6.13 (imposto sobre ação, que é de
vocês), o valor não pode passar de 1,000 pelo componente que o alvo controla —
o alvo simplesmente para de se mover. Sugestão: precificar o dano-base por
rodada cheio e tratar o dobro como teto do imposto, deixando isso escrito.

Para o **Eletrocutado** eu não sei nem o que ele faz — não estava na mensagem
de vocês e não aparece no mapa de confluências (o Raio foi mapeado para
Atordoado). Se ele existe de propósito, ele precisa do valor; se sobrou de um
teste, provavelmente precisa sair.

## Duas conferências pequenas

1. Vocês anunciaram **31 condições**; a régua conta **30** no banco. Vale
   conferir se uma não foi gravada.
2. Confirmem que Congelamento, Hemorragia e Pacto de Sangue estão todos com
   valor legível — os outros dois passaram, mas vale a auditoria de vocês.

## De onde veio o recado

Frente de Runomancia/Criaturas. Nada aqui muda condição nenhuma — só reporta o
que a régua não consegue ler. O campo `condicoesAplicadas` dos módulos passou a
carregar `alvos` e `rodadas` por condição (além de `portao`/`chance`), então a
régua agora respeita a duração declarada pela condição em vez da duração do
item — o que conserta magia de dano instantâneo com condição que dura.
