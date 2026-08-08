/**
 * Caça efeito REDUNDANTE — dois pedaços da mesma habilidade mexendo no mesmo
 * eixo, o que obriga a mesa a fazer conta que não muda resultado.
 *
 * O caso que abriu a investigação: Salto Predatório dizia "com 5+ Graus de
 * acerto, ignora 1 de Reação" — mas 5 Graus JÁ derrubam 5 de Reação (Livro
 * §6.4). O degrau não entregava nada e ainda pedia uma conta.
 *
 * Seis famílias de redundância:
 *   1. GRAUS       — bônus por Grau sobre o que os Graus já fazem
 *   2. ENGOLIDA    — condição que outra condição da mesma habilidade já contém
 *   3. DUPLICADA   — condição nomeada E o efeito dela reescrito em números
 *   4. MESMO EIXO  — duas condições disputando a mesma estatística (§6.11)
 *   5. REPETIDA    — a mesma condição declarada duas vezes
 *   6. TEXTO×CAMPO — o texto nomeia condição que `condicoesAplicadas` não tem
 *                    (ou o contrário): a mesa e a régua leem coisas diferentes
 *
 * Só leitura.
 *   node functions/audit-redundancia.mjs
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(
    require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();

/* O que cada condição JÁ inclui, pela descrição cadastrada. Se A contém B,
   aplicar as duas é pedir conta de graça. */
const CONTEM = {
    Atordoado:   ['Lento', 'Desorientado', 'Prostrado', 'Agarrado', 'Imobilizado'], // perde o turno inteiro E a Reação
    Imobilizado: ['Lento'],          // Deslocamento já vai a zero
    Agarrado:    ['Lento'],
    Cego:        ['Ofuscado'],       // Cego é o Ofuscado levado ao fim
};
/* Eixo que cada condição ataca. Duas no mesmo eixo somam subaditivo (§6.11). */
const EIXO = {
    Atordoado: 'acao', 'Congelamento': 'acao',
    Lento: 'desloc', Imobilizado: 'desloc', Agarrado: 'desloc', Inabalável: 'desloc', Acelerado: 'desloc',
    Cego: 'acerto', Ofuscado: 'acerto', Desorientado: 'acerto', Amedrontado: 'acerto',
    Definhado: 'vit', Vigorado: 'vit',
};
/* O efeito escrito de cada condição — se aparecer junto com o nome, é conta
   dobrada (foi o caso da Cegueira da Fé I antes do reparo). */
const ESCRITA = {
    Lento:       /metade do (?:seu )?deslocamento|deslocamento pela metade|-\s*2\s*(?:na |de )?inici/i,
    Imobilizado: /deslocamento (?:vai a |=\s*)?(?:zero|0)|não pode se mover/i,
    Atordoado:   /perde o turno|não pode agir|perde a (?:sua )?a[çc][ãa]o/i,
    Ofuscado:    /desvantagem em ataques e defesas|-\s*\d+\s*no Alvo (?:de |em )?(?:testes de )?(?:percep|ataque)/i,
    Cego:        /não enxerga|-\s*4\s*no Alvo/i,
    Inabalável:  /\+\s*2\s*(?:de )?blindagem/i,
};

const mods = (await db.collection('system/data/classModules').get()).docs
    .map(d => ({ id: d.id, ...d.data() })).filter(m => m.publicado !== false);
const conds = (await db.collection('system/data/conditions').get()).docs.map(d => d.data().nome).filter(Boolean);

/* ═══ ASSERTS: o caso conhecido tem que ser pego ═══ */
const GRAUS_RE = /(\d+)\+?\s*Graus?[^.;]{0,40}(?:ignora|reduz|anula)[^.;]{0,20}(?:\d+\s*(?:de |da |na )?)?(?:Rea[çc][ãa]o|Alvo|defesa)/i;
assert.ok(GRAUS_RE.test('Com 5+ Graus de acerto, ignora 1 de Reação.'), 'o caso do Salto Predatório tem que casar');
assert.ok(!GRAUS_RE.test('Com 5+ Graus de acerto, ignora 6 de Reação.') === false, 'a versão corrigida ainda casa (é revisão humana)');
console.log('✅ 2 asserts.\n');

const achados = [];
for (const m of mods) {
    const lbl = Object.fromEntries((m.schema || []).map(f => [f.key, String(f.label || '')]));
    const kEfeito = Object.keys(lbl).find(k => /efeito|o que faz/i.test(lbl[k]));
    for (const it of (m.itensPredefinidos || [])) {
        /* Nem todo módulo chama o campo de "Efeito" — no Bardo o efeito mora
           num campo de outro rótulo, e ler só `descricao` + kEfeito deixava a
           magia inteira invisível para o detector. Lê todo texto longo. */
        const partes = [String(it.descricao || ''), String((it.valores || {})[kEfeito] || ''),
            ...Object.values(it.valores || {}).filter(v => typeof v === 'string' && v.length > 20)];
        const txt = [...new Set(partes.filter(Boolean))].join(' ').replace(/\s+/g, ' ');
        if (!txt) continue;
        const decl = (it.condicoesAplicadas || []).map(c => c.condicao);
        /* Citar o nome não é aplicar. Três coisas enganam o detector ingênuo:
           REMOVER a condição ("remove 1 condição mental: Amedrontado, Cego"),
           usar a palavra como ADJETIVO ("base cautelosa e inabalável") e
           nomear um alvo do mundo ("estabiliza um Nexo Corrompido"). Exige-se
           verbo de aplicação por perto, e o contexto de remoção elimina. */
        /* "Falha:" é o verbo de aplicação mais comum do sistema — quase toda
           magia de resistência escreve o efeito assim, sem verbo nenhum. */
        const APLICA = '(?:fica|ficam|est[áa]|entra em|entram em|aplica|aplicando|causa|causam|concede|ganha|ganham|sofre|sofrem|recebe|recebem|deixa|deixando|torna|vira|Falha(?:\\s+Cr[íi]tica)?\\s*:)';
        const REMOVE = '(?:ignora|remove|removendo|dissipa|encerra|limpa|imune a|protege contra|suspende|contra|estabiliza|corrompid)';
        const noTexto = conds.filter(c => {
            /* Sem `\b` depois do APLICA: quando ele termina em ":" (o "Falha:"
               do sistema), a borda de palavra nunca casa e a condição escapava.
               O "ou Atordoado" de um teste de resistência também conta. */
            const aplicado = new RegExp(`(?:${APLICA}|ou)[^.;]{0,45}?\\b${c}|\\b${c}\\b[^.;]{0,25}\\bpor\\s+\\d`, 'i').test(txt);
            const removido = new RegExp(`${REMOVE}\\b[^.;]{0,60}\\b${c}`, 'i').test(txt);
            return aplicado && !removido;
        });
        const reg = (tipo, msg) => achados.push({ tipo, modulo: m.titulo, nome: it.nome, msg, txt: txt.slice(0, 110) });

        // 1. bônus por Grau sobre o que os Graus já fazem
        const g = GRAUS_RE.exec(txt);
        if (g) reg('GRAUS', `"${g[0].trim().slice(0, 62)}" — Graus já derrubam a defesa (§6.4)`);

        // 2. condição engolida por outra da mesma habilidade
        const todas = [...new Set([...decl, ...noTexto])];
        for (const a of todas) for (const b of (CONTEM[a] || []))
            if (todas.includes(b)) reg('ENGOLIDA', `${a} já contém ${b} — aplicar os dois não muda nada`);

        // 3. condição nomeada E reescrita em números
        for (const c of todas) {
            const re = ESCRITA[c];
            if (re && re.test(txt)) reg('DUPLICADA', `nomeia "${c}" e reescreve o efeito dele em números`);
        }

        // 4. duas condições no mesmo eixo
        const porEixo = {};
        for (const c of todas) { const e = EIXO[c]; if (e) (porEixo[e] ??= []).push(c); }
        for (const [e, lista] of Object.entries(porEixo))
            if (lista.length > 1 && !lista.some(a => (CONTEM[a] || []).some(b => lista.includes(b))))
                reg('MESMO EIXO', `${lista.join(' + ')} disputam o eixo "${e}" — soma subaditiva (§6.11)`);

        // 5. mesma condição declarada duas vezes
        const dup = decl.filter((c, i) => decl.indexOf(c) !== i);
        if (dup.length) reg('REPETIDA', `condicoesAplicadas repete: ${[...new Set(dup)].join(', ')}`);

        // 6. texto e campo discordam
        if (it.condicoesAplicadas) {
            const soTexto = noTexto.filter(c => !decl.includes(c));
            const soCampo = decl.filter(c => !noTexto.includes(c));
            if (soTexto.length) reg('TEXTO×CAMPO', `o texto cita ${soTexto.join(', ')} e o campo não declara`);
            if (soCampo.length) reg('TEXTO×CAMPO', `o campo declara ${soCampo.join(', ')} e o texto não cita`);
        }
    }
}

console.log('═'.repeat(78));
console.log('REDUNDÂNCIA — efeito que pede conta e não muda resultado');
console.log('═'.repeat(78));
if (!achados.length) console.log('\n  ✅ Nada encontrado.');
const ORDEM = ['GRAUS', 'ENGOLIDA', 'DUPLICADA', 'MESMO EIXO', 'REPETIDA', 'TEXTO×CAMPO'];
for (const tipo of ORDEM) {
    const lista = achados.filter(a => a.tipo === tipo);
    if (!lista.length) continue;
    console.log(`\n── ${tipo} — ${lista.length} ──`);
    for (const a of lista) {
        console.log(`  ▸ ${a.nome}  [${a.modulo}]`);
        console.log(`     ${a.msg}`);
    }
}
console.log(`\n${'─'.repeat(78)}\n  ${achados.length} apontamentos em ${mods.length} módulos. Só leitura.`);
process.exit(0);
