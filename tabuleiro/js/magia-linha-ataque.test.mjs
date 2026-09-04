/**
 * A magia que vira golpe. `node tabuleiro/js/magia-linha-ataque.test.mjs`
 *
 * `linhasAtaqueMagia` não é exportada e depende de `_sys` e do DOM do Tabuleiro,
 * então o teste recorta a função do arquivo e injeta o que ela usa. É frágil de
 * propósito: se a assinatura mudar, isto quebra e alguém olha.
 */
import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { redutorDaLinha, chaveDaPericiaPorId } from '../../shared/dominio-redutor.js';

const aqui = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(aqui, 'tab-ficha-win.js'), 'utf8').replace(/\r\n/g, '\n');
const recorta = (nome) => {
    const i = src.indexOf(`function ${nome}`);
    assert.ok(i > 0, `${nome} sumiu de tab-ficha-win.js`);
    return src.slice(i, src.indexOf('\n}\n', i) + 2);
};
const corpo = recorta('resolveDadoDaMagia') + '\n' + recorta('linhasAtaqueMagia');

const DV = [
    { id: 'vd_teste', nome: 'Inst. Sopro', icone: '🎵' },
    { id: 'vd_ess',   nome: 'Dano Sanguíneo', icone: '🩸' },
    { id: 'vd_bolha', nome: 'Carga de Sangue', campoAtual: true },
];
const _sys = { derivedValues: DV, classModulesById: {}, skills: [{ id: 'sk_sono', nome: 'Sonoromancia', categoria: 'exclusivo' }] };
// A chave tem que sair do MESMO normChave que o motor usa; o stub abaixo é
// minúsculas puras, então a chave é o nome do VD em minúsculas.
const dt = { 'inst. sopro': 7 };

// `atualDoVd` é injetada: no Tabuleiro ela lê o mapa VITAIS, que não existe aqui.
const atualDoVd = (ch, dv) => ch?._atuais?.[dv.nome] ?? null;
const linhasAtaqueMagia = new Function(
    '_sys', 'normChave', 'tplDoItem', 'redutorDaLinha', 'atualDoVd', 'chaveDaPericiaPorId',
    corpo + '\nreturn linhasAtaqueMagia;'
)(_sys, s => String(s).toLowerCase(), () => null, redutorDaLinha, atualDoVd, chaveDaPericiaPorId);

const modulo = {
    titulo: 'Sonoromancia', icone: '🎵', periciaId: 'sk_sono', custoExpPorItem: 0,
    schema: [{ key: '4', label: 'Inst. Sopro', tipo: 'select_vd' }],
    itensPredefinidos: [
        { id: 'p1', nome: 'NOTA PENETRANTE', qualidade: 3,
          valores: { '4': 'vd_teste', dado: '1d4', essencia: 'vd_ess', ataqueDireto: true } },
        { id: 'p2', nome: 'MELODIA CALMANTE', qualidade: 1,
          valores: { '4': 'vd_teste' } },                    // sem dano: não vira golpe
        { id: 'p3', nome: 'SÓ A FLAG', qualidade: 1,
          valores: { '4': 'vd_teste', ataqueDireto: true } }, // flag sem Dado: idem
    ],
};
_sys.classModulesById.mod_sono = modulo;

const ch = (nivel) => ({
    dots: { sk_classe_sonoromancia: nivel },
    classModuleData: { mod_sono: [{ _predefId: 'p1' }, { _predefId: 'p2' }, { _predefId: 'p3' }] },
});

/* Perícia 3 alcança a Qualidade 3: sem redutor. */
let l = linhasAtaqueMagia({ itens: [] }, ch(3), dt);
assert.equal(l.length, 1, 'só a magia com flag E dado vira golpe');
assert.equal(l[0].nome, 'NOTA PENETRANTE');
assert.equal(l[0].dano, '1d4');
assert.equal(l[0].acerto, 7, 'Alvo cheio quando a perícia alcança');
assert.equal(l[0].canais[0].nome, 'Dano Sanguíneo', 'o canal da Essência decide qual Blindagem barra');
assert.equal(l[0].magia, true);

/* Perícia 1 contra Qualidade 3: redutor 2. */
l = linhasAtaqueMagia({ itens: [] }, ch(1), dt);
assert.equal(l[0].acerto, 5, 'o Alvo do golpe já vem reduzido pela perícia');
assert.equal(l[0].redutorDominio, 2);

/* Sem a perícia: a linha existe mas avisa. */
l = linhasAtaqueMagia({ itens: [] }, { dots: {}, classModuleData: ch(0).classModuleData }, dt);
assert.equal(l[0].semDominio, true, 'sem a perícia a Arte não abre, e a linha diz isso');

/* Foco da mesma escola entra na conta do redutor. */
const win = { itens: [{ equipado: true, periciaId: 'sk_sono', qualidade: 5 }] };
l = linhasAtaqueMagia(win, ch(1), dt);
assert.equal(l[0].redutorDominio, 4, 'foco Q5 manda sobre a magia Q3 quando a perícia é 1');

/* Sem Essência declarada o dano é físico: nenhum canal. */
modulo.itensPredefinidos[0].valores.essencia = '';
l = linhasAtaqueMagia({ itens: [] }, ch(3), dt);
assert.equal(l[0].canais.length, 0, 'sem Essência, dano físico');

/* Referência a VD na fórmula: a Explosão Hemática joga fora a bolha inteira. */
modulo.itensPredefinidos.push({ id: 'p4', nome: 'EXPLOSÃO', qualidade: 4, formaArea: 'circulo',
    valores: { '4': 'vd_teste', dado: '1d8+[Carga de Sangue]', ataqueDireto: true } });
const comBolha = { dots: { sk_classe_sonoromancia: 4 }, _atuais: { 'Carga de Sangue': 7 },
    classModuleData: { mod_sono: [{ _predefId: 'p4' }] } };
l = linhasAtaqueMagia({ itens: [] }, comBolha, dt);
assert.equal(l[0].dano, '1d8+7', 'a bolha entra no dano com o valor ATUAL dela');

/* Carga vazia vira 0 — a magia existe, o dano é só o dado. */
l = linhasAtaqueMagia({ itens: [] }, { ...comBolha, _atuais: {} }, dt);
assert.equal(l[0].dano, '1d8+0');

/* VD que não existe fica visível em vez de sumir: o erro tem que aparecer. */
modulo.itensPredefinidos[3].valores.dado = '1d8+[Recurso Inventado]';
l = linhasAtaqueMagia({ itens: [] }, comBolha, dt);
assert.equal(l[0].dano, '1d8+[Recurso Inventado]');

console.log('magia-linha-ataque: ok');
