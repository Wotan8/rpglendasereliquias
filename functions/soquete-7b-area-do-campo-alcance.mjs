/**
 * Passo 7b — completa `formaArea`/`tamanhoArea` lendo também o campo
 * "Alcance/Raio/Duração", que o passo 7 ignorou.
 *
 * Vários módulos guardam a área ali e não na prosa do efeito: a Névoa Sanguínea
 * diz "Raio 5m · 5 turnos" no campo e o efeito não repete isso. A régua lia como
 * alvo único e a magia aparecia em 0,85× sendo de área.
 *
 * SÓ PREENCHE O QUE ESTÁ VAZIO. Itens com `formaArea` já definida — inclusive os
 * ajustados à mão nas passadas de balanceamento — não são tocados.
 *
 *   node functions/soquete-7b-area-do-campo-alcance.mjs            (dry-run)
 *   node functions/soquete-7b-area-do-campo-alcance.mjs --apply
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { extrairArea, extrairAlcance } from './soquete-7-campos-tipados-lib.mjs';

const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APLICAR = process.argv.includes('--apply');

assert.deepEqual(extrairArea('Raio 5m · 5 turnos'), { formaArea: 'circulo', tamanhoArea: 5 },
    '"Raio 5m" no campo de alcance é área circular');
assert.deepEqual(extrairArea('Duração 1 cena'), { formaArea: 'nenhuma', tamanhoArea: null },
    'campo sem área não inventa área');
assert.equal(extrairAlcance('Alcance 15m'), 15);
console.log('✅ 3 asserts passaram.\n');

const col = db.collection('system/data/classModules');
const mods = (await col.get()).docs.map(d => ({ id: d.id, ...d.data() }));
const plano = [];
for (const m of mods) {
    const lbl = Object.fromEntries((m.schema || []).map(f => [f.key, String(f.label || '')]));
    const kD = Object.keys(lbl).find(k => /alcance|raio|dura/i.test(lbl[k]));
    if (!kD) continue;
    let mexeu = false;
    const itens = (m.itensPredefinidos || []).map(it => {
        const campo = String((it.valores || {})[kD] || '');
        if (!campo) return it;
        const out = { ...it };
        if (!it.formaArea || it.formaArea === 'nenhuma') {
            const a = extrairArea(campo);
            if (a.formaArea !== 'nenhuma') {
                Object.assign(out, a); mexeu = true;
                plano.push({ modulo: m.titulo, nome: it.nome, campo, ...a });
            }
        }
        if (out.alcance == null) {
            const al = extrairAlcance(campo);
            if (al != null) { out.alcance = al; mexeu = true; }
        }
        return out;
    });
    if (mexeu) m._novos = itens;
}

console.log('=== 7b: área vinda do campo Alcance ===\n');
for (const p of plano) console.log(`  ${p.modulo.slice(0, 24).padEnd(25)} ${p.nome.slice(0, 24).padEnd(25)} "${p.campo}" → ${p.formaArea} ${p.tamanhoArea ?? ''}m`);
console.log(`\n  ${plano.length} itens ganham área. Nenhum com formaArea já definida foi tocado.`);
if (!APLICAR) { console.log('\nDRY-RUN. Rode com --apply para gravar.'); process.exit(0); }
for (const m of mods.filter(x => x._novos)) await col.doc(m.id).update({ itensPredefinidos: m._novos, updatedAt: Date.now() });
console.log('\n✅ Gravado.');
process.exit(0);
