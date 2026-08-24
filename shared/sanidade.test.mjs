// Rodar: node shared/sanidade.test.mjs
//
// Duas coisas são testadas aqui, e a primeira é a que importa mais:
//
//  1. ALVOS_FIXOS é uma CÓPIA da metade estática do TARGET_MAP da ficha. Cópia
//     sem guarda vira mentira: alguém acrescenta um alvo no mechanics-engine,
//     a aba Sanidade não sabe dele e passa a acusar como "quebrada" toda
//     mecânica que o use. O teste lê o arquivo real e exige igualdade.
//
//  2. Cada regra pega o caso que ela existe para pegar, e NÃO grita no caso
//     saudável. Regra que só sabe acusar é ruído; a aba inteira perde valor.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ALVOS_FIXOS, alvosConhecidos, sugerirParecido, REGRAS, auditar } from './sanidade.js';

const regra = (id) => {
    const r = REGRAS.find(x => x.id === id);
    assert.ok(r, `regra "${id}" sumiu`);
    return r;
};
const rodar = (id, sys) => regra(id).rodar(sys);

// ===== 1) o espelho do TARGET_MAP =====
{
    const src = fs.readFileSync(new URL('../ficha-v1.7_1/js/mechanics-engine.js', import.meta.url), 'utf8');
    const i = src.indexOf('const TARGET_MAP = {');
    assert.ok(i > -1, 'o TARGET_MAP mudou de nome ou de arquivo — reveja ALVOS_FIXOS');
    const corpo = src.slice(i, src.indexOf('\n};', i));
    const doArquivo = [...corpo.matchAll(/^\s*"([^"]+)"\s*:/gm)].map(m => m[1]);

    const faltando = doArquivo.filter(k => !ALVOS_FIXOS.includes(k));
    const sobrando = ALVOS_FIXOS.filter(k => !doArquivo.includes(k));
    assert.deepEqual(faltando, [],
        'alvo novo no TARGET_MAP que a Sanidade não conhece — acrescente em ALVOS_FIXOS');
    assert.deepEqual(sobrando, [],
        'ALVOS_FIXOS tem nome que saiu do TARGET_MAP — a Sanidade está perdoando ref quebrada');
    assert.equal(doArquivo.length, ALVOS_FIXOS.length);
}

// ===== o cadastro de mentirinha =====
const SYS = {
    skills: [{ id: 'sk1', nome: 'Esquiva' }, { id: 'sk2', nome: 'Atletismo' }],
    // "Esquiva" existe como perícia E como VD: é a colisão que quebra em silêncio
    derivedValues: [
        { id: 'dv1', nome: 'Defesa', key: 'DEFESA' },
        { id: 'dv2', nome: 'Esquiva', key: 'ESQUIVA_VD' },
        { id: 'dv3', nome: 'Aura', key: 'AURA', campoAtual: true },
    ],
    vitalStats: [{ nome: 'Vitalidade', key: 'VIT_MAX' }],
    bodyParts: [{ id: 'bp1', nome: 'Braço' }],
    classes: [], runicElements: [], conditions: [], classModules: [], mechanics: [],
};

// ===== 2) alvosConhecidos =====
{
    const c = alvosConhecidos(SYS);
    assert.ok(c.has('for'), 'sigla de atributo');
    assert.ok(c.has('defesa'), 'VD do cadastro');
    assert.ok(c.has('pericia: atletismo'), 'perícia com prefixo, sem acento');
    assert.ok(c.has('vitalidade maxima'), 'status vital vira "X Máxima"');
    assert.ok(c.has('aura (atual)'), 'VD com campoAtual ganha (Atual)');
    assert.ok(c.has('parte do corpo: braco'), 'parte do corpo');
    assert.ok(!c.has('reacao'), 'o VD Reação virou Defesa — não pode continuar resolvendo');
}

// ===== 2b) sugerirParecido — o "voce quis dizer" =====
{
    const c = alvosConhecidos({ derivedValues: [
        { nome: 'Desloc. Aquatico' }, { nome: 'Desloc. Vertical' }, { nome: 'Armadura' },
    ] });
    // o caso real do banco: a mecanica escrevia por extenso, o VD e abreviado
    assert.equal(sugerirParecido('Deslocamento Aquatico', c), 'Desloc. Aquatico');
    assert.equal(sugerirParecido('Desloc Vertical', c), 'Desloc. Vertical');
    assert.equal(sugerirParecido('Inspirar', c), null, 'sem parecido, cala a boca');
    assert.equal(sugerirParecido('Arma', c), null,
        'uma palavra so nao sugere: "Arma" nao e um erro de digitacao de "Armadura"');
    assert.equal(sugerirParecido('', c), null);
}

// ===== 3) ref-quebrada =====
{
    const mec = (nome, calculos) => ({ id: 'm_' + nome, nome, config: { calculos } });
    const sys = { ...SYS, mechanics: [
        mec('Guarda Alta', [{ alvo: 'Reação', equacao: [{ tipo: 'ficha', ref: 'FOR' }] }]),
        mec('Passo Firme', [{ alvo: 'Defesa', equacao: [{ tipo: 'ficha', ref: 'Reação' }] }]),
        mec('Sã', [{ alvo: 'Defesa', equacao: [{ tipo: 'ficha', ref: 'Perícia: Atletismo' }] }]),
        mec('Item', [{ alvo: 'Defesa', equacao: [{ tipo: 'ficha', ref: 'Item: peso' }] }]),
        mec('Solta', [{ alvo: 'Defesa', equacao: [{ tipo: 'valor', valor: 3 }] }]),
    ] };
    const r = rodar('ref-quebrada', sys);
    assert.equal(r.length, 2, 'só as duas que citam Reação');
    assert.ok(r.some(a => a.onde === 'Guarda Alta' && /alvo "Reação"/.test(a.problema)));
    assert.ok(r.every(a => !/era esse\?/.test(a.problema)),
        '"Reação" não se parece com "Defesa" — sugerir seria chute');
    assert.ok(r.some(a => a.onde === 'Passo Firme' && /lê "Reação"/.test(a.problema)));
    assert.equal(rodar('ref-quebrada', SYS).length, 0, 'cadastro vazio não acusa nada');

    // formato antigo (config.alvo direto, sem calculos[]) também é lido
    const velho = { ...SYS, mechanics: [{ id: 'v', nome: 'Antiga', config: { alvo: 'Reação', valor: 2 } }] };
    assert.equal(rodar('ref-quebrada', velho).length, 1, 'mecânica no formato antigo não pode escapar');
}

// ===== 4) ref-pericia =====
{
    const sys = { ...SYS, mechanics: [
        { id: 'a', nome: 'Ambígua', config: { calculos: [{ alvo: 'Esquiva', equacao: [] }] } },
        { id: 'b', nome: 'Explícita', config: { calculos: [{ alvo: 'Perícia: Esquiva', equacao: [] }] } },
        { id: 'c', nome: 'Sem colisão', config: { calculos: [{ alvo: 'Atletismo', equacao: [] }] } },
    ] };
    const r = rodar('ref-pericia', sys);
    assert.equal(r.length, 1, 'só acusa quando existe VD homônimo — aí a conta já está errada hoje');
    assert.equal(r[0].onde, 'Ambígua');
}

// ===== 5) nivel-condicao =====
{
    const sys = { ...SYS,
        conditions: [
            { nome: 'Célere' },                                        // sem acumulaNiveis
            { nome: 'Blindado', acumulaNiveis: true, nivelMaximo: 3 },
            { nome: 'Vigorado', acumulaNiveis: true },
        ],
        classModules: [{ id: 'mod1', titulo: 'Passos Sombrios', itensPredefinidos: [
            { nome: 'Correr', condicoesAplicadas: [{ condicao: 'Célere', nivel: 5 }] },
            { nome: 'Casca',  condicoesAplicadas: [{ condicao: 'Blindado', nivel: 8 }] },
            { nome: 'Fôlego', condicoesAplicadas: [{ condicao: 'Vigorado', nivel: 4 }] },
            { nome: 'Simples', condicoesAplicadas: [{ condicao: 'Célere' }] },
            { nome: 'Fantasma', condicoesAplicadas: [{ condicao: 'Inexistente', nivel: 2 }] },
        ] }],
    };
    const r = rodar('nivel-condicao', sys);
    assert.equal(r.length, 3);
    assert.ok(r.some(a => /Célere 5 entra em 1/.test(a.problema) && /não tem "acumula níveis"/.test(a.problema)));
    assert.ok(r.some(a => /Blindado 8 entra em 3/.test(a.problema) && /teto 3/.test(a.problema)));
    assert.ok(r.some(a => /não existe no cadastro/.test(a.problema)));
    assert.ok(r.every(a => a.modulo === 'classModules' && a.itemId === 'mod1'), 'o achado tem endereço');

    // módulo aposentado não vai à mesa: não pode aparecer na lista
    const off = { ...sys, classModules: [{ ...sys.classModules[0], publicado: false }] };
    assert.equal(rodar('nivel-condicao', off).length, 0);
}

// ===== 6) nivel-na-prosa =====
{
    const sys = { ...SYS,
        conditions: [{ nome: 'Blindado', acumulaNiveis: true, nivelMaximo: 3 }, { nome: 'Vigorado', acumulaNiveis: true }],
        classModules: [{ id: 'mod2', titulo: 'Fé', itensPredefinidos: [
            { nome: 'Escudo', descricao: 'O alvo fica Blindado 8 por 1 cena.', regua: { razao: 1.4 } },
            { nome: 'Bênção', descricao: 'O alvo fica Vigorado 4 por 1 cena.' },
            { nome: 'Toque', descricao: 'O alvo fica Blindado por 1 cena.' },
            { nome: 'Campo', descricao: '', valores: { 3: 'deixa o grupo Blindado 5' } },
        ] }],
    };
    const r = rodar('nivel-na-prosa', sys);
    assert.equal(r.length, 2, 'Blindado 8 e Blindado 5; Vigorado 4 chega inteiro e "Blindado" sem número não conta');
    assert.ok(r.some(a => /promete "Blindado 8", chega 3/.test(a.problema) && /carimbo 1.4×/.test(a.problema)));
    assert.ok(r.some(a => a.onde === 'Fé › Campo'), 'a prosa também mora nos campos do schema');
}

// ===== 7) condicao-repetida =====
{
    const sys = { ...SYS, classModules: [{ id: 'mod3', titulo: 'Bardo', itensPredefinidos: [
        { nome: 'Canção', condicoesAplicadas: [{ condicao: 'Célere' }, { condicao: 'célere' }] },
        { nome: 'Grito', condicoesAplicadas: [{ condicao: 'Célere' }, { condicao: 'Abalado' }] },
    ] }] };
    const r = rodar('condicao-repetida', sys);
    assert.equal(r.length, 1);
    assert.match(r[0].problema, /aparece mais de uma vez/);
}

// ===== 8) custo-carimbado =====
{
    const schema = [{ tipo: 'text', label: 'Custo:', key: '4' }];
    const pd = (nome, custo, valores) => ({
        nome, economia: 'combate', valores,
        regua: { custo, unidades: 2.5, razao: (2.5 / custo).toFixed(2), em: 'v1' },
    });
    const sys = { ...SYS, classModules: [{ id: 'mod4', titulo: 'Custo 2 — Ápice', schema, itensPredefinidos: [
        // 1 Energia (1,00) + Ação Padrão (1,00) = 2,00 — o carimbo diz 1,00: v1
        pd('Velha', 1.0, { 4: '1 Energia', acao: 'Ação Padrão' }),
        // mesma conta, carimbo certo
        pd('Nova', 2.0, { 4: '1 Energia', acao: 'Ação Padrão' }),
        // Ação Livre não soma nada
        pd('Livre', 1.0, { 4: '1 Energia', acao: 'Ação Livre' }),
    ] }] };
    const r = rodar('custo-carimbado', sys);
    assert.equal(r.length, 1);
    assert.equal(r[0].onde, 'Custo 2 — Ápice › Velha');
    assert.match(r[0].problema, /recursos \+ ação dão 2\.00/);

    // fora de combate a régua de dano não vale: não se julga custo
    const cena = { ...sys, classModules: [{ ...sys.classModules[0],
        itensPredefinidos: [{ ...pd('Velha', 1.0, { 4: '1 Energia', acao: 'Ação Padrão' }), economia: 'cena' }] }] };
    assert.equal(rodar('custo-carimbado', cena).length, 0);
}

// ===== 9) auditar() por inteiro =====
{
    const vazio = auditar({});
    assert.equal(vazio.total, 0, 'cadastro vazio não inventa problema');
    assert.equal(vazio.regras.length, REGRAS.length);
    assert.ok(vazio.regras.every(r => !r.quebrou), 'nenhuma regra pode estourar com sys vazio');
    assert.ok(vazio.regras.every(r => r.titulo && r.porque), 'achado sem explicação não ajuda ninguém');

    const sujo = auditar({ ...SYS, mechanics: [{ id: 'x', nome: 'X', config: { alvo: 'Reação', valor: 1 } }] });
    assert.equal(sujo.total, 1);
    assert.equal(sujo.graves, 1, 'ref quebrada é grave: a conta está errada agora');

    // regra que estoura vira achado, não derruba as outras
    const ruim = { ...REGRAS[0], id: 'boom', rodar() { throw new Error('estourou'); } };
    const original = REGRAS[0];
    REGRAS[0] = ruim;
    try {
        const res = auditar(SYS);
        assert.equal(res.regras[0].quebrou, 'estourou');
        assert.equal(res.regras.length, REGRAS.length, 'as outras regras rodaram assim mesmo');
    } finally { REGRAS[0] = original; }
}

console.log(`✅ sanidade: ${REGRAS.length} regras, ALVOS_FIXOS espelha o TARGET_MAP (${ALVOS_FIXOS.length} alvos)`);
