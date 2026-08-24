/**
 * Quem alcança os diálogos por `import`, e quem ainda depende do global.
 *
 * `window.LRDialogo` existe só como ponte para os scripts CLÁSSICOS — os da
 * Ficha, da Criação, do Laboratorium e o hexmap.js, que não têm como importar.
 * Módulo que usa o global transforma a ordem de carga da página num requisito
 * invisível: funciona até alguém mover uma tag de `<script>`, e aí quebra sem
 * mensagem que aponte para a causa.
 *
 * Também confere o que `node --check` não vê: se o caminho relativo do import
 * existe no disco e se o nome importado é mesmo exportado. Errar o `../` numa
 * pasta só aparece no navegador, e mata o módulo inteiro em silêncio.
 *
 *   node shared/dialogo.test.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');
const PULAR = new Set(['node_modules', '.git', '.claude', 'graphify-out', 'functions']);
const FONTE = join(AQUI, 'dialogo.js');

function varrer(dir, achados = []) {
    for (const nome of readdirSync(dir)) {
        if (PULAR.has(nome)) continue;
        const caminho = join(dir, nome);
        if (statSync(caminho).isDirectory()) varrer(caminho, achados);
        else if (nome.endsWith('.js')) achados.push(caminho);
    }
    return achados;
}

const rel = (p) => p.replace(RAIZ + sep, '').split(sep).join('/');
const ehModulo = (src) => /^\s*(import|export)\s/m.test(src);

const exportados = new Set(
    [...readFileSync(FONTE, 'utf8').matchAll(/export function (\w+)/g)].map(m => m[1]));

const problemas = [];
let comGlobal = 0, comImport = 0;

for (const caminho of varrer(RAIZ)) {
    const src = readFileSync(caminho, 'utf8');
    if (caminho === FONTE) continue;

    // 1. módulo não pode depender do global
    if (/LRDialogo\s*\./.test(src)) {
        if (ehModulo(src)) {
            problemas.push(`${rel(caminho)}: é módulo e usa window.LRDialogo — importe de shared/dialogo.js`);
        } else {
            comGlobal++;   // script clássico: é para isso que a ponte existe
        }
    }

    // 2. todo import de dialogo.js tem de resolver, em caminho e em nome
    const imports = src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]*dialogo\.js[^'"]*)['"]/g);
    for (const m of imports) {
        comImport++;
        const alvo = resolve(dirname(caminho), m[2].split('?')[0]);
        if (!existsSync(alvo)) {
            problemas.push(`${rel(caminho)}: import aponta para "${m[2]}", que não existe`);
        }
        for (const nome of m[1].split(',').map(x => x.trim()).filter(Boolean)) {
            if (!exportados.has(nome)) {
                problemas.push(`${rel(caminho)}: importa "${nome}", que dialogo.js não exporta`);
            }
        }
    }
}

if (problemas.length) {
    console.error('❌ diálogos:\n  ' + problemas.join('\n  '));
    process.exit(1);
}
console.log(`✅ dialogo: ${comImport} imports resolvem · ${comGlobal} scripts clássicos na ponte `
    + `window.LRDialogo · nenhum módulo dependendo do global`);
