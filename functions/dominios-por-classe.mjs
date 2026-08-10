/**
 * Domínios: um doc por Domínio, escada de 3 níveis, e a classe herda o seu.
 *
 * 1) ESCADA — as 10 mecânicas "Domínio de … — Teto de Ofício: X" viram evolutivas
 *    de 3 níveis, +10 por nível (10 / 20 / 30 no teto). Preço: 12 / 25 / 40.
 *    Nv1 continua vindo da mecanicaExpCriacao da avulsa (12 EXP na criação);
 *    quem herda pela classe entra no Nv1 de graça e paga do 2 em diante.
 *    Teto máximo = atributo + 30, que cobre Qualidade+Afiação 30 (Liga 3 afiada) —
 *    é por isso que a escada para no 3: o Nv3 já destrava tudo que existe.
 *
 * 2) SEM GÊMEOS — a classe passa a apontar para o PRÓPRIO doc do Domínio, em vez
 *    de ter uma peculiaridade de sabor que faz a mesma coisa com outro nome.
 *    "Mestre em Armas", "Armas de Punho" e "Armas de Precisão à Distância" saem
 *    da classe e são despublicadas (não apagadas — dá para reverter).
 *    Nas classes de magia a pec da escola (lore + acesso) fica INTACTA: ela não
 *    é a mesma coisa que o Domínio, que é só o teto do foco.
 *
 * Depende de: criar-personagem/js/peculiarities-module.js esconder do mercado a
 * avulsa que o personagem já herdou — senão dá para comprar o próprio Domínio.
 *
 * node functions/dominios-por-classe.mjs           (dry-run)
 * node functions/dominios-por-classe.mjs --apply
 */
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('./rpg-lendasereliquias-firebase-adminsdk-fbsvc-1c3d60aa29.json')) });
const db = admin.firestore();
const APPLY = process.argv.includes('--apply');

/* Escada: nível → { soma no teto, custo em EXP para CHEGAR nele }.
   Nv1 custa 0 aqui porque a entrada já é cobrada pela mecanicaExpCriacao (12). */
const ESCADA = { 1: { valor: 10, custo: 0 }, 2: { valor: 20, custo: 25 }, 3: { valor: 30, custo: 40 } };

/* classe → Domínio que ela herda; `aposentar` = pec de sabor que fazia o mesmo. */
const CLASSES = [
    { classe: 'Guerreiro',            dominio: 'Domínio de Armas de Braço',    aposentar: 'Mestre em Armas' },
    { classe: 'Caçador',              dominio: 'Domínio de Disparo',           aposentar: 'Armas de Precisão à Distância' },
    { classe: 'Ladino',               dominio: 'Domínio de Armas de Precisão', aposentar: 'Armas de Punho' },
    { classe: 'Adepto de Thannathog', dominio: 'Domínio de Necromancia' },
    { classe: 'Bardo',                dominio: 'Domínio de Sonoromancia' },
    { classe: 'Invocador do Abismo',  dominio: 'Domínio de Abismancia' },
    { classe: 'Pallacerdote',         dominio: 'Domínio de Pallomancia' },
    { classe: 'Runimago',             dominio: 'Domínio de Runomancia' },
    { classe: 'Xamã',                 dominio: 'Domínio de Totemancia' },
];

const grab = async col => (await db.collection(`system/data/${col}`).get()).docs;
const [pecDocs, mecDocs, clsDocs] = await Promise.all(['peculiarities', 'mechanics', 'classes'].map(grab));
const pecPorNome = n => pecDocs.find(d => d.data().nome === n);
const clsPorNome = n => clsDocs.find(d => d.data().nome === n);

const erros = [];
const backup = {};
const escritas = [];   // { ref, dados, log }

/* ---- 1. escada de níveis nas mecânicas de Domínio ---- */
const dominios = pecDocs.filter(d => /^Domínio de /.test(d.data().nome || ''));
for (const pd of dominios) {
    const pec = pd.data();
    const mecId = (pec.mecanicaIds || [])[0];
    if (!mecId) { console.log(`  · ${pec.nome}: sem mecânica, pulado (rúnico ainda não implementado)`); continue; }
    const md = mecDocs.find(d => d.id === mecId);
    if (!md) { erros.push(`${pec.nome}: mecânica ${mecId} órfã`); continue; }
    const mec = md.data();

    const calc = mec.config?.calculos?.[0];
    const termo = calc?.equacao?.[0];
    if (!calc?.alvo?.startsWith('Teto de Ofício: ') || termo === undefined) {
        erros.push(`${pec.nome}: mecânica "${mec.nome}" não tem a forma esperada (+N em Teto de Ofício)`);
        continue;
    }
    if (Number(termo.valor) !== 10) {
        erros.push(`${pec.nome}: termo base é ${termo.valor}, esperava 10 — escada já mexida?`);
        continue;
    }

    const progressao = {};
    for (const [nv, { valor, custo }] of Object.entries(ESCADA)) {
        progressao[nv] = { custoExp: custo, termos: { '0': valor } };
    }

    backup['mec:' + md.id] = { nome: mec.nome, evoluivel: mec.evoluivel, nivelMaximo: mec.nivelMaximo, progressao: mec.progressao, descricao: mec.descricao, previewTexto: mec.previewTexto };
    escritas.push({
        ref: md.ref,
        dados: {
            evoluivel: true,
            nivelMaximo: 3,
            progressao,
            progressaoApenasCriacao: false,   // dá para subir depois da criação
            progressaoTipoExp: 'custo',
            descricao: `O treino destrava o Ofício: +10 por nível em ${calc.alvo} (Nv1 +10 · Nv2 +20 · Nv3 +30).`,
            previewTexto: `+10 em ${calc.alvo}`,
        },
        log: `ESCADA  ${pec.nome.padEnd(30)} 1 nível → 3 (+10/+20/+30, custo 0/${ESCADA[2].custo}/${ESCADA[3].custo})`,
    });
}

/* ---- 2. classe herda o próprio Domínio ---- */
for (const c of CLASSES) {
    const cd = clsPorNome(c.classe);
    if (!cd) { erros.push(`classe "${c.classe}" não existe`); continue; }
    const dom = pecPorNome(c.dominio);
    if (!dom) { erros.push(`peculiaridade "${c.dominio}" não existe`); continue; }

    const cls = cd.data();
    const atuais = (cls.peculiaridadeIds || []).map(x => typeof x === 'object' ? x.id : x);
    let novos = [...atuais];

    if (c.aposentar) {
        const velha = pecPorNome(c.aposentar);
        if (!velha) { erros.push(`peculiaridade "${c.aposentar}" não existe`); continue; }
        novos = novos.filter(id => id !== velha.id);
        if (!backup['pec:' + velha.id]) {
            backup['pec:' + velha.id] = { nome: c.aposentar, publicado: velha.data().publicado };
            escritas.push({
                ref: velha.ref,
                dados: { publicado: false },
                log: `APOSENTA ${c.aposentar.padEnd(30)} despublicada (fazia o mesmo que ${c.dominio})`,
            });
        }
    }
    if (!novos.includes(dom.id)) novos.push(dom.id);

    if (JSON.stringify(novos) !== JSON.stringify(atuais)) {
        backup['cls:' + cd.id] = { nome: cls.nome, peculiaridadeIds: cls.peculiaridadeIds };
        escritas.push({
            ref: cd.ref,
            dados: { peculiaridadeIds: novos },
            log: `CLASSE  ${c.classe.padEnd(30)} herda "${c.dominio}"${c.aposentar ? `, sai "${c.aposentar}"` : ''}`,
        });
    } else {
        console.log(`  · ${c.classe}: já está como o plano quer`);
    }
}

if (erros.length) {
    console.error('\n❌ Conferência falhou, nada foi escrito:');
    erros.forEach(e => console.error('   ' + e));
    process.exit(1);
}

console.log('\n' + escritas.map(e => '  ' + e.log).join('\n'));

if (!APPLY) {
    console.log(`\n🔎 DRY-RUN — ${escritas.length} escrita(s). Rode com --apply para gravar.`);
    process.exit(0);
}

const fs = await import('node:fs');
const arq = `functions/_backup-dominios-${Date.now()}.json`;
fs.writeFileSync(arq, JSON.stringify(backup, null, 2), 'utf8');

const batch = db.batch();
for (const e of escritas) batch.update(e.ref, e.dados);
await batch.commit();
console.log(`\n✅ ${escritas.length} escrita(s) aplicadas. Backup: ${arq}`);
process.exit(0);
