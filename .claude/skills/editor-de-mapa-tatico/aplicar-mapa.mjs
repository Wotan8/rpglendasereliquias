/**
 * Aplica um "plano de mapa tático" no doc do Local (worldbuilding-geography).
 * A geometria sai do MESMO módulo que o editor do site usa (shared/local-tatico.js),
 * então o resultado é idêntico ao de importar o .dd2vtt na mão.
 *
 *   node .claude/skills/editor-de-mapa-tatico/aplicar-mapa.mjs plano.json           → só mostra o plano
 *   node .claude/skills/editor-de-mapa-tatico/aplicar-mapa.mjs plano.json --apply   → grava
 *
 * O dry-run é a verificação: resolve todos os nomes (Local, NPC, itens, chave),
 * monta o mapaTatico inteiro e explode se qualquer um não existir — sem escrever nada.
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importarUVTT } from '../../../shared/local-tatico.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const require = createRequire(join(RAIZ, 'functions/index.js'));
const admin = require('firebase-admin');
const serviceAccount = require(join(RAIZ, 'functions/rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json'));
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: `${serviceAccount.project_id}.firebasestorage.app`,
});
const db = admin.firestore();

const APLICAR = process.argv.includes('--apply');
const planoPath = process.argv.slice(2).find(a => a.endsWith('.json'));
if (!planoPath) {
    console.error('Uso: node aplicar-mapa.mjs <plano.json> [--apply]');
    process.exit(1);
}
const plano = JSON.parse(readFileSync(planoPath, 'utf8'));

const norm = (s) => String(s || '').trim().toLowerCase();
/** Nome exato primeiro; só depois "contém" — evita casar "Chave" com "Chaveiro" à toa. */
const porNome = (docs, nome) =>
    docs.find(d => norm(d.nome) === norm(nome)) || docs.find(d => norm(d.nome).includes(norm(nome)));
/** Mesmo contrato do editor: o item embutido vai sem os campos de posse/aninhamento. */
const limparItem = ({ id, parentItemId, characterId, equipado, ...campos }) => campos;

const avisos = [];

/* ── Imagem ─────────────────────────────────────────────── */
/** O Dungeon Alchemist embute JPEG; outros geradores mandam PNG ou WEBP. */
const TIPOS = [['/9j/', 'jpg', 'image/jpeg'], ['iVBOR', 'png', 'image/png'], ['UklGR', 'webp', 'image/webp']];
const tipoDaImagem = (b64) => TIPOS.find(([p]) => b64.startsWith(p));

// ponytail: redimensiona com System.Drawing (Windows) e devolve JPEG — mapa é
// foto, PNG de 5000px ficaria maior que o original. Em Linux, troque por sharp.
function reduzirImagem(entrada, saida, maxLargura) {
    const ps = `Add-Type -AssemblyName System.Drawing
$i=[System.Drawing.Image]::FromFile('${entrada}')
$w=[Math]::Min(${maxLargura},$i.Width); $h=[int]($i.Height*$w/$i.Width)
$b=New-Object System.Drawing.Bitmap $w,$h
$g=[System.Drawing.Graphics]::FromImage($b); $g.InterpolationMode='HighQualityBicubic'
$g.DrawImage($i,0,0,$w,$h)
$c=[System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders()|Where-Object{$_.MimeType -eq 'image/jpeg'}
$p=New-Object System.Drawing.Imaging.EncoderParameters 1
$p.Param[0]=New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality),88
$b.Save('${saida}',$c,$p)
$g.Dispose();$b.Dispose();$i.Dispose()
Write-Output "$w $h"`;
    return execFileSync('powershell', ['-NoProfile', '-Command', ps], { encoding: 'utf8' })
        .trim().split(/\s+/).map(Number);
}

const escalar = (o, s) => s === 1 ? o : {
    ...o,
    ...(o.pontos ? { pontos: o.pontos.map(p => ({ x: Math.round(p.x * s), y: Math.round(p.y * s) })) } : {}),
    ...(o.x != null ? { x: Math.round(o.x * s), y: Math.round(o.y * s) } : {}),
};

/* ── Catálogo de equipamentos (carregado só se o plano usar) ── */
let _cat = null;
async function catalogo() {
    if (_cat) return _cat;
    const snap = await db.collection('system/data/equipment').get();
    _cat = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => x.publicado !== false);
    return _cat;
}

/** Tranca de baú/porta/janela — mesmo formato que trancaAtual() monta no editor. */
async function montarTranca(tr) {
    if (!tr) return null;
    const t = { tipo: tr.tag ? 'tag' : 'item', consumo: tr.consumo || 'nao', exibirChave: !!tr.exibirChave };
    if (t.consumo === 'chance') t.chance = Math.min(100, Math.max(1, Number(tr.chance) || 50));
    if (t.tipo === 'tag') {
        t.tag = String(tr.tag).trim();
        if (!t.tag) return null;
    } else {
        const c = porNome(await catalogo(), tr.chave);
        if (!c) throw new Error(`Item-chave "${tr.chave}" não existe em system/data/equipment.`);
        t.itemId = c.id;
        t.itemNome = c.nome;
        if (c.imagem || c.imagemUrl) t.itemImg = c.imagem || c.imagemUrl;
    }
    return t;
}

/* ── Principal ──────────────────────────────────────────── */
async function main() {
    const geos = (await db.collection('worldbuilding-geography').get()).docs.map(d => ({ id: d.id, ...d.data() }));
    const local = porNome(geos, plano.local);
    if (!local) throw new Error(`Local "${plano.local}" não existe em worldbuilding-geography.`);

    const mpq = Number(plano.metrosPorQuadro) || 1.5;
    const mt = local.mapaTatico
        ? JSON.parse(JSON.stringify(local.mapaTatico))
        : { url: '', imgW: 0, imgH: 0, larguraReal: 30, unidade: 'm', ambiente: 'noite', luzAtiva: true, objetos: [] };
    mt.objetos = Array.isArray(mt.objetos) ? mt.objetos : [];
    let novaImagem = null;

    // 1. .dd2vtt → imagem + paredes/portas/luzes (substitui a geometria antiga)
    if (plano.dd2vtt) {
        const res = importarUVTT(readFileSync(plano.dd2vtt, 'utf8'), mpq);
        if (!res) throw new Error(`"${plano.dd2vtt}" não é um export UniversalVTT válido.`);
        avisos.push(...res.avisos);
        const tipo = tipoDaImagem(res.imagemBase64);
        if (!tipo) throw new Error('A imagem embutida não é JPEG, PNG nem WEBP.');
        const [, ext] = tipo;
        const bruto = join(tmpdir(), `mapa-${Date.now()}.${ext}`);
        writeFileSync(bruto, Buffer.from(res.imagemBase64, 'base64'));

        let arquivo = bruto, imgW = res.imgW, imgH = res.imgH;
        if (plano.maxLargura > 0 && imgW > plano.maxLargura) {
            if (ext === 'webp') throw new Error('System.Drawing não lê WEBP — reduza a imagem antes ou tire maxLargura do plano.');
            arquivo = join(tmpdir(), `mapa-${Date.now()}-menor.jpg`);
            [imgW, imgH] = reduzirImagem(bruto, arquivo, plano.maxLargura);
        }
        const s = imgW / res.imgW;
        mt.objetos = [...mt.objetos.filter(o => o.tipo === 'npc' || o.tipo === 'item'), ...res.objetos.map(o => escalar(o, s))];
        mt.larguraReal = res.larguraReal;
        mt.unidade = res.unidade;
        mt.imgW = imgW;
        mt.imgH = imgH;
        novaImagem = { arquivo, imgW, imgH };
    }
    if (!mt.imgW || !mt.larguraReal) throw new Error('O Local não tem mapa e o plano não trouxe .dd2vtt — não dá para posicionar nada.');
    if (plano.ambiente) mt.ambiente = plano.ambiente;
    if (plano.luzAtiva != null) mt.luzAtiva = !!plano.luzAtiva;

    // 2. Quadro do grid → px da imagem natural (já com o redimensionamento aplicado)
    const gridW = mt.larguraReal / mpq;
    const ppq = mt.imgW / gridW;
    const Q = (q) => {
        if (!Array.isArray(q) || q.length < 2) throw new Error(`Posição inválida: ${JSON.stringify(q)} (esperado [quadroX, quadroY]).`);
        return { x: Math.round(q[0] * ppq), y: Math.round(q[1] * ppq) };
    };

    // 3. Aberturas novas (porta/janela) e luzes avulsas
    for (const a of (plano.aberturas || [])) {
        const o = { tipo: a.tipo === 'janela' ? 'janela' : 'porta', pontos: [Q(a.de), Q(a.ate)] };
        const t = await montarTranca(a.tranca);
        if (t) { o.trancado = true; o.tranca = t; }
        mt.objetos.push(o);
    }
    for (const l of (plano.luzes || [])) {
        const p = Q(l.quadro);
        const o = { tipo: 'luz', x: p.x, y: p.y, alcance: Number(l.alcance) || 6, cor: l.cor || '#ffdd99' };
        if (l.animacao) o.animacao = l.animacao;
        mt.objetos.push(o);
    }

    // 4. Alterar aberturas existentes (o UVTT traz tudo como porta)
    for (const c of (plano.converter || [])) {
        const alvo = Q(c.perto);
        let melhor = -1, dist = Infinity;
        mt.objetos.forEach((o, i) => {
            if ((o.tipo !== 'porta' && o.tipo !== 'janela') || !(o.pontos?.length >= 2)) return;
            const m = { x: (o.pontos[0].x + o.pontos[1].x) / 2, y: (o.pontos[0].y + o.pontos[1].y) / 2 };
            const d = Math.hypot(m.x - alvo.x, m.y - alvo.y);
            if (d < dist) { dist = d; melhor = i; }
        });
        if (melhor < 0) { avisos.push(`Nenhuma porta/janela para converter perto de [${c.perto}].`); continue; }
        if (dist > ppq * 3) avisos.push(`A abertura mais próxima de [${c.perto}] está a ${(dist / ppq).toFixed(1)} quadros — confira se é essa mesmo.`);
        if (c.para === 'remover') { mt.objetos.splice(melhor, 1); continue; }
        const o = mt.objetos[melhor];
        if (c.para) o.tipo = c.para;
        const t = await montarTranca(c.tranca);
        if (t) { o.trancado = true; o.tranca = t; }
    }

    // 5. NPCs — o vínculo na ficha é obrigatório, senão o editor apaga o token ao abrir
    const novosVinculos = [];
    if (plano.npcs) {
        const npcs = (await db.collection('npcs').get()).docs.map(d => ({ id: d.id, ...d.data() }));
        mt.objetos = mt.objetos.filter(o => o.tipo !== 'npc');
        for (const n of plano.npcs) {
            const c = porNome(npcs, n.nome);
            if (!c) throw new Error(`NPC "${n.nome}" não existe na coleção npcs.`);
            const p = Q(n.quadro);
            const url = c.imagem || c.imagemUrl || '';
            if (!url) avisos.push(`O NPC "${c.nome}" não tem imagem — o token nasce sem retrato.`);
            mt.objetos.push({
                tipo: 'npc', npcId: c.id, nome: c.nome || 'NPC', url,
                camada: n.camada === 'dm' ? 'dm' : 'tokens', x: p.x, y: p.y,
            });
            // O mesmo NPC pode ter vários tokens (8 Armadores, 4 capangas) — o vínculo é um só.
            if (!(local.linkedNpcs || []).some(v => v.id === c.id) && !novosVinculos.some(v => v.id === c.id)) {
                novosVinculos.push({ id: c.id, name: c.nome, type: c.tipo || 'NPC', title: '' });
            }
        }
    }

    // 6. Itens e baús
    if (plano.itens) {
        const cat = await catalogo();
        mt.objetos = mt.objetos.filter(o => o.tipo !== 'item');
        for (const it of plano.itens) {
            const c = porNome(cat, it.nome);
            if (!c) throw new Error(`Item "${it.nome}" não existe em system/data/equipment.`);
            const p = Q(it.quadro);
            const o = {
                tipo: 'item', itemId: c.id, nome: c.nome || 'Item', url: c.imagem || c.imagemUrl || '',
                quantidade: Math.max(1, Number(it.quantidade) || 1), item: limparItem(c), x: p.x, y: p.y,
            };
            if (c.ehContainer) {
                o.fixo = !!it.fixo;
                o.itensDentro = (it.dentro || []).map((d, i) => {
                    const dc = porNome(cat, d.nome);
                    if (!dc) throw new Error(`Item "${d.nome}" (dentro de "${c.nome}") não existe no catálogo.`);
                    if (dc.ehContainer) throw new Error(`"${dc.nome}" é contêiner — baú dentro de baú não vale (mesma regra do Tabuleiro).`);
                    return { id: `wb${Date.now()}_${i}`, ...limparItem(dc), quantidade: Math.max(1, Number(d.quantidade) || 1) };
                });
                const t = await montarTranca(it.tranca);
                if (t) { o.trancado = true; o.tranca = t; }
                if (it.notaSecreta) o.notaSecreta = it.notaSecreta;
            } else if (it.dentro || it.tranca || it.fixo) {
                avisos.push(`"${c.nome}" não tem ehContainer:true — conteúdo, tranca e "fixo" seriam ignorados pelo Tabuleiro.`);
            }
            mt.objetos.push(o);
        }
    }

    /* ── Relatório ── */
    const n = (t) => mt.objetos.filter(o => o.tipo === t).length;
    console.log(`\n🗺️  ${local.nome}  (worldbuilding-geography/${local.id})`);
    console.log(`   imagem ${mt.imgW}×${mt.imgH}px · ${mt.larguraReal} ${mt.unidade} de largura · ${gridW.toFixed(0)} quadros · ${ppq.toFixed(1)} px/quadro`);
    console.log(`   ${mt.ambiente === 'dia' ? '☀️ dia' : '🌙 noite'} · luz dinâmica ${mt.luzAtiva !== false ? 'ligada' : 'desligada'}`);
    console.log(`   ${n('parede')} paredes · ${n('porta')} portas · ${n('janela')} janelas · ${n('luz')} luzes · ${n('npc')} NPCs · ${n('item')} itens`);
    for (const o of mt.objetos.filter(o => o.tipo === 'npc')) console.log(`   🎭 ${o.nome} @ ${o.x},${o.y} (${o.camada})`);
    for (const o of mt.objetos.filter(o => o.tipo === 'item')) {
        console.log(`   ${o.item?.ehContainer ? '🧰' : '📦'} ${o.nome} ×${o.quantidade} @ ${o.x},${o.y}` +
            (o.fixo ? ' 📌fixo' : '') + (o.trancado ? ` 🔒${o.tranca.tipo === 'tag' ? `tag:${o.tranca.tag}` : o.tranca.itemNome}` : ''));
        for (const d of (o.itensDentro || [])) console.log(`        ↳ ${d.nome} ×${d.quantidade}`);
    }
    if (novosVinculos.length) console.log(`   ➕ vínculo novo na ficha do Local: ${novosVinculos.map(v => v.name).join(', ')}`);
    for (const a of avisos) console.log(`   ⚠️  ${a}`);

    if (!APLICAR) {
        console.log('\n(dry-run) nada foi gravado. Rode de novo com --apply.\n');
        return;
    }

    if (novaImagem) {
        const bucket = admin.storage().bucket();
        const dest = `worldbuilding-images/locais/${Date.now()}_${basename(novaImagem.arquivo)}`;
        console.log(`\n⏳ subindo ${dest}…`);
        await bucket.upload(novaImagem.arquivo, {
            destination: dest,
            predefinedAcl: 'publicRead',   // sem isso a URL pública dá 403
            metadata: { contentType: dest.endsWith('.png') ? 'image/png' : dest.endsWith('.webp') ? 'image/webp' : 'image/jpeg' },
        });
        mt.url = `https://storage.googleapis.com/${bucket.name}/${dest}`;
    }
    const patch = { mapaTatico: mt };
    if (novosVinculos.length) patch.linkedNpcs = [...(local.linkedNpcs || []), ...novosVinculos];
    await db.doc(`worldbuilding-geography/${local.id}`).update(patch);
    console.log(`✔ Gravado. Abra o Tabuleiro → painel de Locais → "${local.nome}".\n`);
}

main().then(() => process.exit(0)).catch(e => { console.error(`\n❌ ${e.message}\n`); process.exit(1); });
