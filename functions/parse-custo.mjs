// O parser mudou de casa: agora o navegador também precisa dele (a aba Sanidade
// do Painel do Criador roda a mesma conta do audit-custo-carimbado). Este
// arquivo fica como ponte para os scripts de functions/ que já o importavam.
export * from '../shared/parse-custo.js';
