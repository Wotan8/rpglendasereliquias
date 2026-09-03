/**
 * Gera a arte dos prêmios da Roleta que ainda não têm imagem.
 *
 * De onde vêm os textos: `prompts-premios-roleta.md` na raiz — o
 * prompt-master de Item (o bloco que garante que todas as peças pareçam do
 * mesmo artista) mais o bloco de cada prêmio. Os dois VERBATIM, nunca
 * resumidos: o master é o que segura o estilo, e resumir a descrição do
 * prêmio é inventar arte que o autor não pediu.
 *
 * O que ele NÃO faz: subir. Gerar é barato de refazer, publicar não. O upload
 * é `node functions/upload-and-update.mjs "<png>" "loja_itens" "<Nome>"`,
 * depois de olhar o resultado.
 *
 *   node functions/__gera-arte-premios-roleta.mjs --lista        # o que falta
 *   node functions/__gera-arte-premios-roleta.mjs "Influência"   # um só
 *   node functions/__gera-arte-premios-roleta.mjs --todos        # os que faltam
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(
        require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')),
});
const db = admin.firestore();

const RAIZ = path.resolve(import.meta.dirname, '..');
const MD = path.join(RAIZ, 'prompts-premios-roleta.md');
const SAIDA = path.join(RAIZ, 'functions', 'avulsos-imagens');
const MODELO = 'gemini-3-pro-image-preview';

const chave = process.env.GEMINI_API_KEY;
if (!chave) { console.error('falta GEMINI_API_KEY no ambiente.'); process.exit(1); }

/* ── os textos, recortados do .md ───────────────────────────── */
/* O .md está gravado com CRLF (Windows). Sem normalizar, todo `\n` dos
   recortes abaixo falha e o script diz que não achou nada. */
const md = fs.readFileSync(MD, 'utf8').split('\r\n').join('\n');

const blocos = [...md.matchAll(/```\n([\s\S]*?)\n```/g)].map(m => m[1]);
const master = blocos.find(b => b.includes('DIRETRIZES FUNDAMENTAIS PARA ITENS'));
if (!master) { console.error('não achei o prompt-master de Item no .md'); process.exit(1); }

const premios = new Map();
for (const m of md.matchAll(/^### \d+\.\s+(.+)$\n\*[^*]*\*\n\n```\n([\s\S]*?)\n```/gm)) {
    premios.set(m[1].trim(), m[2].trim());
}

/* ── quem ainda não tem arte ────────────────────────────────── */
const snap = await db.collection('loja_itens').get();
const semArte = [];
for (const d of snap.docs) {
    const x = d.data();
    const ehPremio = x.ocultoNaLoja || x.isPremioRoleta || /roleta/i.test(x.categoria || '');
    if (!ehPremio) continue;
    if (x.imagem || x.imagemUrl || x.icone) continue;
    semArte.push(x.nome);
}

const alvo = process.argv[2];
if (!alvo || alvo === '--lista') {
    console.log(`${premios.size} prompts no .md · ${semArte.length} prêmios sem arte:`);
    for (const n of semArte) {
        console.log(`  ${premios.has(n) ? '✓' : '✗ SEM PROMPT'}  ${n}`);
    }
    process.exit(0);
}

const fila = alvo === '--todos' ? semArte.filter(n => premios.has(n)) : [alvo];

/* ── geração ────────────────────────────────────────────────── */
async function gerar(nome) {
    const desc = premios.get(nome);
    if (!desc) { console.error(`  ✗ "${nome}" não tem prompt no .md`); return false; }

    const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent?key=${chave}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: master + '\n\n' + desc }] }],
            }),
        });

    if (!r.ok) { console.error(`  ✗ ${nome}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`); return false; }
    const j = await r.json();
    const parte = (j.candidates?.[0]?.content?.parts || []).find(p => p.inlineData);
    if (!parte) {
        console.error(`  ✗ ${nome}: a resposta não trouxe imagem (${j.candidates?.[0]?.finishReason || '?'})`);
        return false;
    }

    const arquivo = path.join(SAIDA, `${nome}.png`);
    fs.writeFileSync(arquivo, Buffer.from(parte.inlineData.data, 'base64'));
    console.log(`  ✓ ${nome} → ${path.relative(RAIZ, arquivo)}`);
    return true;
}

let ok = 0;
for (const nome of fila) {
    console.log(`gerando "${nome}"…`);
    if (await gerar(nome)) ok++;
}
console.log(`\n${ok}/${fila.length} gerada(s). Confira antes de subir.`);
process.exit(0);
