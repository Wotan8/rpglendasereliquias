// =============================================
// DONO DE NPC ALIADO — parte pura
//
// A ficha mostra como "aliados" os NPCs que têm, em `vinculos`, uma entrada
// `{ tipo: 'personagem', id: <charId> }` — e o jogador edita o inventário
// desses aliados. Era isso que sustentava a cláusula aberta das rules de
// `items` (`exists(npcs/<characterId>)`), que dava a QUALQUER conta logada
// poder de editar e apagar item de QUALQUER NPC do cenário: 228 documentos
// hoje, dos quais só 14 são de aliado de alguém.
//
// Rules não sabem varrer lista de objetos procurando `tipo == 'personagem'`.
// Então o vínculo é achatado num campo que elas sabem ler: `donosUids`, a
// lista de uids dos jogadores donos das fichas vinculadas. Quem calcula é o
// gatilho `espelharDonoDoNpc`; o que está aqui é a parte que decide, sem
// banco — `node functions/npc-donos.test.mjs`.
// =============================================

/**
 * IDs de ficha vinculados a este NPC como personagem de jogador.
 * Ignora vínculo de mesa, de facção e o que estiver malformado.
 */
function charIdsVinculados(npc) {
  const v = Array.isArray(npc?.vinculos) ? npc.vinculos : [];
  const ids = v
    .filter((x) => x && x.tipo === "personagem" && x.id)
    .map((x) => String(x.id));
  return [...new Set(ids)];
}

/**
 * Normaliza a lista de donos: sem vazio, sem repetido, em ordem.
 * A ordem importa por causa de `mudou()` — sem ela, a mesma lista em outra
 * sequência pareceria diferente e o gatilho gravaria de novo, para sempre.
 */
function normalizarDonos(uids) {
  return [...new Set((uids || []).filter(Boolean).map(String))].sort();
}

/**
 * Vale a pena gravar? O gatilho escreve no próprio documento que o disparou,
 * então sem esta comparação ele se chama em laço infinito.
 */
function mudou(antes, depois) {
  const a = normalizarDonos(antes);
  const b = normalizarDonos(depois);
  return a.length !== b.length || a.some((x, i) => x !== b[i]);
}

module.exports = { charIdsVinculados, normalizarDonos, mudou };
