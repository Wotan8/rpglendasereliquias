/**
 * Badge de versão — a parte pura: ler a VERSION do sw.js e montar o rótulo.
 *
 * Regras verificadas:
 *  • extrai a VERSION do sw.js real do projeto, e tolera aspas/espaços;
 *  • ignora texto sem VERSION em vez de estourar;
 *  • ativo == servidor → rótulo curto, sem alerta;
 *  • ativo != servidor → mostra a seta, marca desatualizado e explica no title;
 *  • sem Service Worker (dev, primeira visita) mostra só o do servidor;
 *  • versão da página entra só quando existe.
 *
 * Roda com: node js/version-badge.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { extrairVersao, montarRotulo } from './version-badge.js';

// --- extrairVersao ---------------------------------------------------------
{
    const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
    const v = extrairVersao(sw);
    assert.ok(v, 'precisa achar a VERSION no sw.js de verdade');
    assert.match(v, /^v\d+$/, `VERSION do projeto deveria ser vNNN, veio "${v}"`);

    assert.equal(extrairVersao(`const VERSION = "v7";`), 'v7', 'aceita aspas duplas');
    assert.equal(extrairVersao(`const   VERSION='v8'`), 'v8', 'tolera espaçamento');
    assert.equal(extrairVersao('nada aqui'), null);
    assert.equal(extrairVersao(''), null);
    assert.equal(extrairVersao(null), null, 'não estoura com entrada nula');
}

// --- em dia: rótulo curto -------------------------------------------------
{
    const r = montarRotulo({ ativo: 'v104', servidor: 'v104', pagina: null });
    assert.equal(r.texto, 'v104', 'só o número, sem prefixo');
    assert.equal(r.desatualizado, false);
    assert.doesNotMatch(r.titulo, /Recarregue/);
}

// --- aba velha: seta, alerta e explicação --------------------------------
{
    const r = montarRotulo({ ativo: 'v103', servidor: 'v104', pagina: null });
    assert.equal(r.desatualizado, true, 'versões diferentes = aba desatualizada');
    assert.equal(r.texto, 'v103 → v104 ↻', 'seta e o ↻ sem depender de versão de página');
}
// o ↻ tem de sobreviver quando há versão de página
{
    const r = montarRotulo({ ativo: 'v103', servidor: 'v104', pagina: '1.7.1' });
    assert.equal(r.texto, 'v103 → v104 ↻  ·  pág 1.7.1');
    assert.equal(r.desatualizado, true);
    assert.match(r.titulo, /Clique aqui para atualizar/, 'o title diz o que fazer');
}

// --- sem Service Worker controlando (dev / primeira visita) --------------
{
    const r = montarRotulo({ ativo: null, servidor: 'v104', pagina: null });
    assert.equal(r.texto, 'v104', 'só o número, sem prefixo');
    assert.equal(r.desatualizado, false, 'sem worker não é "desatualizado", é "sem cache"');
    assert.match(r.titulo, /nenhum/, 'o title deixa claro que não há worker');
}

// --- servidor ilegível: mostra o que tem, sem falso alarme --------------
{
    const r = montarRotulo({ ativo: 'v104', servidor: null, pagina: null });
    assert.equal(r.texto, 'v104', 'só o número, sem prefixo');
    assert.equal(r.desatualizado, false);
}
{
    const r = montarRotulo({ ativo: null, servidor: null, pagina: null });
    assert.equal(r.texto, '—', 'sem nada, não quebra a badge');
}

// --- versão da página é opcional ----------------------------------------
{
    const com = montarRotulo({ ativo: 'v104', servidor: 'v104', pagina: '1.7.1' });
    assert.match(com.texto, /^v104 {2}· {2}pág 1\.7\.1$/);
    assert.match(com.titulo, /Versão da página: 1\.7\.1/);

    const sem = montarRotulo({ ativo: 'v104', servidor: 'v104', pagina: null });
    assert.equal(sem.texto, 'v104');
    assert.doesNotMatch(sem.texto, /pág/, 'página sem meta não polui a badge');
}

console.log('✅ version-badge: todos os casos passaram');
