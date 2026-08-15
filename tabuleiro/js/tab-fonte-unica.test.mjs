/**
 * A ficha do participante sai de UM lugar só.
 *
 * `fonteDoParticipante` mora em tab-hud e é onde os bônus TEMPORÁRIOS da
 * Dádiva entram na leitura. Havia duas cópias locais idênticas na aparência —
 * uma em tab-turno, outra em tab-combat — que sombreavam a importada. O painel
 * do turno lia custo e mira sem o empréstimo, e o Alvo dos testes da cena saía
 * com a ficha crua: um Xamã incorporado testava como se não estivesse.
 *
 * Cópia nova = furo novo, e silencioso. Este teste existe para a próxima não
 * passar despercebida.
 *
 * Roda com: node tabuleiro/js/tab-fonte-unica.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('./', import.meta.url);
const arquivos = readdirSync(dir).filter(f => f.endsWith('.js'));

const definidoresEsperados = ['tab-hud.js'];
const definidores = [];
const importadores = [];

for (const f of arquivos) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    // Definição própria: `function fonteDoParticipante` ou `const fonteDoParticipante =`
    if (/(^|\n)\s*(export\s+)?(function|const|let|var)\s+fonteDoParticipante\b/.test(src)) definidores.push(f);
    // Uso vindo de fora
    if (/import\s*\{[^}]*\bfonteDoParticipante\b[^}]*\}\s*from\s*['"]\.\/tab-hud\.js/.test(src)) importadores.push(f);
}

assert.deepEqual(definidores, definidoresEsperados,
    `fonteDoParticipante tem de ser definida SÓ em tab-hud.js — achei em: ${definidores.join(', ')}.\n`
    + 'Uma cópia local sombreia a importada e apaga os bônus temporários da Dádiva sem avisar.');

// Quem usa, usa a de tab-hud
for (const f of arquivos) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    if (f === 'tab-hud.js' || !/\bfonteDoParticipante\s*\(/.test(src)) continue;
    assert.ok(importadores.includes(f), `${f} usa fonteDoParticipante sem importar de tab-hud.js`);
}

assert.ok(importadores.includes('tab-turno.js'), 'o painel do turno tem de ler a ficha com bônus');
assert.ok(importadores.includes('tab-combat.js'), 'os testes da cena têm de ler a ficha com bônus');

// E a de tab-hud tem mesmo de aplicar os bônus
const hud = readFileSync(new URL('tab-hud.js', dir), 'utf8');
assert.match(hud, /fichaComBonus\s*\(\s*base\s*,\s*p\.bonusTemp\s*\)/,
    'a fonte única precisa somar p.bonusTemp — senão o empréstimo nunca chega em ninguém');

console.log(`✅ fonte única da ficha OK — definida só em tab-hud, importada por ${importadores.length} módulo(s)`);
