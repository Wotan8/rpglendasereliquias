/**
 * Fase C3 do Núcleo v2 — o item: Qualidade, Afiação, Encantamento, Aura, Danificada.
 * Livro de 12 Páginas, p. 6.
 *
 *   node functions/v2-itens.mjs            dry-run: lista tudo, não grava nada
 *   node functions/v2-itens.mjs --apply    grava (antes salva o estado atual em BACKUP_DIR)
 *
 * O que faz:
 *  1. equipment: apaga `liga`, `blindagemQ0`, `integridadeBase` (a Integridade saiu; a
 *     Qualidade não é mais presa pela Liga); versao +0.01
 *  2. proteção de TORSO (tag Armadura, slot Torso): Blindagem = base fixa + Item: Qualidade
 *     + Item: Reforço — "o conjunto tem uma Q", e a Q do conjunto é a da peça do torso; as
 *     peças de cobertura (elmo, grevas, botas…) ficam com a base fixa que já têm
 *  3. Blindagem por tipo físico e por Essência saem: 17 VDs despublicados (Cortante,
 *     Perfurante, Contundente e as 14 de Essência); as 17 mecânicas-espelho idem; o vínculo
 *     "Blindagem Contundente" da Armadura de Torneio é removido; Consagrado passa a dar
 *     +2 de Blindagem Arcana. Só existem Blindagem e Blindagem Arcana.
 *  4. items (instâncias): apaga `liga`, `blindagemQ0`, `integridadeBase`, `avaria`,
 *     `integridade` e o `dominioId` que sobrou da Fase C2
 *
 * Os 14 VDs "Dano <Essência>" FICAM: são o registro dos canais (a Essência da magia, do
 * instrumento e da Afiação arcana) e continuam ligados a runicElements.canalDanoVdId.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const DEL = admin.firestore.FieldValue.delete();
const APPLY = process.argv.includes('--apply');
const BACKUP_DIR = 'D:/Imagem/US - Universo Soberano/RPG/Reliera/Backup Firestore 2026-09-03/scripts-backups';

const col = async (p) => (await db.collection(p).get()).docs.map(d => ({ ...d.data(), id: d.id }));
const proximaVersao = (v) => {
    const n = parseFloat(String(v ?? '').replace(',', '.').replace(/[^\d.]/g, ''));
    return Number.isFinite(n) && n > 0 ? (Math.round(n * 100 + 1) / 100).toFixed(2) : '1.00';
};
const agora = new Date().toISOString();
const ops = [];
const op = (caminho, data, antes, log) => ops.push({ ref: db.doc(caminho), data, antes, log });

const [eq, vds, mecs, bps, items] = await Promise.all([
    col('system/data/equipment'), col('system/data/derivedValues'), col('system/data/mechanics'),
    col('system/data/bodyParts'), col('items'),
]);
const vdPorNome = (n) => vds.find(v => v.nome === n);
const BLINDAGEM = vdPorNome('Blindagem'), ARCANA = vdPorNome('Blindagem Arcana');
if (!BLINDAGEM || !ARCANA) { console.error('VDs Blindagem / Blindagem Arcana não encontrados'); process.exit(1); }
const torsoId = bps.find(b => b.nome === 'Torso')?.id;
if (!torsoId) { console.error('parte do corpo Torso não encontrada'); process.exit(1); }

// ---------- 1 + 2. equipment ----------
const CAMPOS_MORTOS = ['liga', 'blindagemQ0', 'integridadeBase'];
const VDS_TIPADOS = vds.filter(v => /^Blindagem .+/.test(v.nome) && v.nome !== 'Blindagem Arcana');
const tipadoIds = new Set(VDS_TIPADOS.map(v => v.id));
let eqLimpos = 0, torsos = 0, tipadosRemovidos = 0;
for (const e of eq) {
    const data = {}; const antes = {}; const log = [];
    for (const k of CAMPOS_MORTOS) if (k in e) { data[k] = DEL; antes[k] = e[k]; }
    if (Object.keys(antes).length) { eqLimpos++; log.push(`sai ${Object.keys(antes).join('/')}`); }

    let vinc = Array.isArray(e.valoresDerivadosVinculados) ? e.valoresDerivadosVinculados.map(v => ({ ...v })) : null;
    let mudouVinc = false;
    if (vinc) {
        const semTipados = vinc.filter(v => !tipadoIds.has(v.id));
        if (semTipados.length !== vinc.length) { tipadosRemovidos += vinc.length - semTipados.length; mudouVinc = true; log.push('sai Blindagem tipada'); vinc = semTipados; }
        const ehTorso = e.tipo === 'Vestimenta' && (e.tags || []).includes('Armadura') && (e.equipavelEm || []).includes(torsoId);
        const bl = vinc.find(v => v.id === BLINDAGEM.id);
        if (ehTorso && bl) {
            const base = Array.isArray(bl.equacao) && bl.equacao.length ? bl.equacao : [{ tipo: 'fixo', valor: Number(bl.modificador) || 0 }];
            const jaTem = base.some(t => t.ref === 'Item: Qualidade');
            if (!jaTem) {
                bl.equacao = [...base, { op: '+', tipo: 'ficha', ref: 'Item: Qualidade' }, { op: '+', tipo: 'ficha', ref: 'Item: Reforço' }];
                bl.modificador = 0;
                mudouVinc = true; torsos++;
                log.push(`Blindagem = ${base.map(t => t.valor ?? t.ref).join(' + ')} + Qualidade + Reforço`);
            }
        }
    }
    if (mudouVinc) { data.valoresDerivadosVinculados = vinc; antes.valoresDerivadosVinculados = e.valoresDerivadosVinculados; }
    if (!Object.keys(data).length) continue;
    data.versao = proximaVersao(e.versao); data.updatedAt = Date.now();
    op(`system/data/equipment/${e.id}`, data, antes, `equipment ${e.nome}: ${log.join('; ')}`);
}

// ---------- 3. VDs tipados e mecânicas ----------
for (const v of VDS_TIPADOS) {
    if (v.publicado === false) continue;
    op(`system/data/derivedValues/${v.id}`, { publicado: false, aposentadoEm: agora, aposentadoPor: 'v2-C3: só Blindagem e Blindagem Arcana', versao: proximaVersao(v.versao), updatedAt: Date.now() },
        { publicado: v.publicado ?? null }, `VD ${v.nome}: despublicado`);
}
const nomesTipados = new Set(VDS_TIPADOS.map(v => v.nome));
for (const m of mecs) {
    if (m.publicado === false) continue;
    const calcs = m.config?.calculos || [];
    if (!calcs.length) continue;
    const alvosTipados = calcs.filter(c => nomesTipados.has(c.alvo));
    if (!alvosTipados.length) continue;
    // espelho "Blindagem X = Blindagem Arcana/Blindagem": morre com o VD
    const soEspelho = calcs.every(c => nomesTipados.has(c.alvo) && (c.equacao || []).length === 1 && /^Blindagem( Arcana)?$/.test(c.equacao[0]?.ref || ''));
    if (soEspelho) {
        op(`system/data/mechanics/${m.id}`, { publicado: false, aposentadoEm: agora, aposentadoPor: 'v2-C3', updatedAt: Date.now() }, { publicado: m.publicado ?? null }, `mecânica ${m.nome}: despublicada (espelho)`);
        continue;
    }
    // efeito real em Blindagem tipada (Consagrado +2 Necrótica/Abissal): vira UM +N em Blindagem Arcana
    const outros = calcs.filter(c => !nomesTipados.has(c.alvo));
    const maior = alvosTipados.map(c => Number(c.equacao?.[0]?.valor) || 0).reduce((a, b) => Math.max(a, b), 0);
    const novo = [...outros, { ...alvosTipados[0], alvo: 'Blindagem Arcana', equacao: [{ tipo: 'fixo', valor: maior }] }];
    op(`system/data/mechanics/${m.id}`, { 'config.calculos': novo, versao: proximaVersao(m.versao), updatedAt: Date.now() }, { calculos: calcs },
        `mecânica ${m.nome}: ${alvosTipados.map(c => c.alvo).join(' + ')} → Blindagem Arcana +${maior}`);
}

// ---------- 4. instâncias ----------
const CAMPOS_MORTOS_INST = ['liga', 'blindagemQ0', 'integridadeBase', 'avaria', 'integridade', 'dominioId'];
let instLimpas = 0;
for (const i of items) {
    const data = {}; const antes = {};
    for (const k of CAMPOS_MORTOS_INST) if (k in i) { data[k] = DEL; antes[k] = i[k]; }
    if (!Object.keys(data).length) continue;
    instLimpas++;
    op(`items/${i.id}`, data, antes, `item ${i.nome || i.name || i.id}: sai ${Object.keys(antes).join('/')}`);
}

// ---------- refs "Item: Liga" em equações (não pode sobrar) ----------
const citaLiga = [];
for (const m of mecs) if (JSON.stringify(m).includes('Item: Liga')) citaLiga.push(`mechanics/${m.id} ${m.nome}`);
for (const e of eq) if (JSON.stringify(e).includes('Item: Liga')) citaLiga.push(`equipment/${e.id} ${e.nome}`);

// ---------- relatório ----------
console.log(`equipment limpos: ${eqLimpos} | torsos com Q+Reforço: ${torsos} | vínculos tipados removidos: ${tipadosRemovidos} | VDs tipados: ${VDS_TIPADOS.length} | instâncias limpas: ${instLimpas}/${items.length}`);
for (const o of ops) console.log(' ', o.log);
if (citaLiga.length) { console.log('\n⚠️ "Item: Liga" ainda citado em:', citaLiga.join(' | ')); }

if (!APPLY) { console.log('\n(dry-run: nada gravado; use --apply)'); process.exit(0); }
if (citaLiga.length) { console.error('resolva as refs "Item: Liga" antes de aplicar'); process.exit(1); }

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const bk = path.join(BACKUP_DIR, `_backup-itens-${agora.replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(bk, JSON.stringify(ops.map(o => ({ doc: o.ref.path, antes: o.antes })), null, 1));
console.log('backup:', bk);
for (let i = 0; i < ops.length; i += 400) {
    const b = db.batch();
    ops.slice(i, i + 400).forEach(o => b.update(o.ref, o.data));
    await b.commit();
}
console.log(`gravado: ${ops.length} documentos`);
process.exit(0);
