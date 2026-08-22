// node criar-personagem/js/group-selection.test.mjs
// Seleção de grupos (Atributos e Perícias): reclique desmarca, roubar um grupo
// libera o passo antigo, e qualquer mudança zera os pontos distribuídos.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));

const ctx = vm.createContext({
    document: { getElementById: () => null, querySelectorAll: () => [] },
    ExpTracker: { updateDisplay() {} },
    revalidarCompras() {},   // vive em app.js, fora do escopo deste teste
    forceRerender() {},
    getPhaseIndex: () => 3,
    saveWizardToStorage() {},
    showWizardToast() {},
    escHtml: (s) => s,
    createNarratorBox: () => '',
    createMemoryBox: () => '',
    GRUPOS_ATRIBUTOS: ['Mental', 'Fisico', 'Social'],
    ATRIBUTOS: { Mental: [], Fisico: [], Social: [] },
    REGRAS_CRIACAO: {
        atributos: { primario: 7, intermediario: 5, fraco: 3, base_inicial: 1, limite_max_por_atributo: 4, custo_quinta_bolinha: 2 },
        pericias: { primario: 6, segundo: 4, terceiro: 3, fraco: 2, limite_max_por_pericia: 3 },
        compra_exp: { teto_nivel: 5, custo_atributo_por_nivel: 5, custo_pericia_padrao: 4 }
    },
    wizardState: {
        grupoPrimario: null, grupoFraco: null,
        atributos: { attr_for: 0 },
        atributosExp: {},
        pericias: { sk_x: 0 },
        periciasExp: {},
        grupoPericiaPrimario: null, grupoPericia2: null, grupoPericiaFraco: null, grupoPericia3: null
    }
});
ctx.window = ctx;

for (const f of ['attributes-module.js', 'skills-module.js']) {
    vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx);
}
const st = ctx.wizardState;

// --- Atributos ---
ctx.selectPrimaryGroup('Mental');
ctx.selectWeakGroup('Social');
assert.equal(st.grupoPrimario, 'Mental');
assert.equal(st.grupoFraco, 'Social');

st.atributos.attr_for = 3;
ctx.selectPrimaryGroup('Social');            // rouba o grupo que era o fraco
assert.equal(st.grupoPrimario, 'Social');
assert.equal(st.grupoFraco, null, 'passo do fraco deve ficar livre');
assert.equal(st.atributos.attr_for, 0, 'pontos distribuídos devem zerar');

ctx.selectPrimaryGroup('Social');            // reclique desmarca
assert.equal(st.grupoPrimario, null);

// --- Perícias (mesma regra) ---
ctx.selectSkillStep(0, 'mental');
ctx.selectSkillStep(1, 'fisico');
ctx.selectSkillStep(2, 'social');
assert.equal(st.grupoPericia3, 'combate', '4º grupo é atribuído sozinho');

st.pericias.sk_x = 2;
ctx.selectSkillStep(0, 'social');             // rouba o grupo do passo 3
assert.equal(st.grupoPericiaPrimario, 'social');
assert.equal(st.grupoPericiaFraco, null);
assert.equal(st.grupoPericia3, null, 'sem os 3 passos preenchidos não há 4º');
assert.equal(st.pericias.sk_x, 0, 'perícias distribuídas devem zerar');

ctx.selectSkillStep(0, 'social');             // reclique desmarca
assert.equal(st.grupoPericiaPrimario, null);

console.log('OK');
