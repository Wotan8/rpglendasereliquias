/* ═══════════════════════════════════════════════════════════
   wb-dossie.js — Dossiê completo de QUALQUER entidade
   ────────────────────────────────────────────────────────────
   Recebe um doc cru do ecossistema (NPC, Tribo, Local, Raça,
   Classe, Cultura, Religião, Rumor…) e devolve a ficha inteira
   dele, legível.

   ⚠️ Ele decide o formato pela FORMA do valor, nunca pelo nome
   do campo: texto curto vira linha de ficha, texto longo vira
   parágrafo, lista vira selos, objeto vira bloco aninhado.
   É o que faz um campo novo cadastrado amanhã no Painel do
   Criador aparecer aqui sozinho, sem ninguém tocar neste
   arquivo. O dicionário de rótulos abaixo é só cosmético — o
   que não estiver nele cai no prettify e continua funcionando.
   ═══════════════════════════════════════════════════════════ */

import { esc, imgOf } from './wb-utils.js';

/* Chaves técnicas: ruído de banco, não interessam a quem lê. */
const OCULTAS = new Set([
    'id', 'nome', 'titulo', 'tipo', 'imagem', 'imagemUrl', 'charImg',
    'lastUpdate', 'lastUpdateBy', 'createdAt', 'updatedAt', 'updatedBy',
    'criadoEm', 'atualizadoEm', 'ownerUid', 'ownerId', 'userId', 'uid',
    'order', 'mapaTatico', 'mesaId', 'criadorTriboId', 'fields',
    'publicado', 'searchTokens',
]);

/* Só cosmético — o que faltar aqui vira prettify(chave). */
const ROTULOS = {
    descricao: 'Descrição', notas: 'Notas', tags: 'Tags',
    clima: 'Clima', populacao: 'População', recursos: 'Recursos',
    governo: 'Governo', landmarks: 'Marcos', perigos: 'Perigos',
    historiaLocal: 'História do local', pertenceA: 'Pertence a',
    linkedNpcs: 'NPCs no local', linkedTribos: 'Tribos no local',
    linkedCulturas: 'Culturas', linkedNpcsProperty: 'NPCs ligados',
    linkedItems: 'Itens', lideranca: 'Liderança', ideologia: 'Ideologia',
    territorios: 'Territórios', aliados: 'Aliados', inimigos: 'Inimigos',
    era: 'Era', importancia: 'Importância', ordemCronologica: 'Ordem cronológica',
    dataInicio: 'Início', dataFim: 'Fim', participantes: 'Participantes',
    consequencias: 'Consequências', regiaoEnvolvida: 'Região envolvida',
    faccoesEnvolvidas: 'Tribos envolvidas', costumes: 'Costumes',
    tradicoes: 'Tradições', estruturaSocial: 'Estrutura social',
    idiomas: 'Idiomas', regras: 'Regras', limitacoes: 'Limitações',
    dominios: 'Domínios', simbolos: 'Símbolos', rituais: 'Rituais',
    localizacao: 'Localização', proprietario: 'Proprietário', valor: 'Valor',
    estado: 'Estado', tamanho: 'Tamanho', comodos: 'Cômodos',
    segredos: 'Segredos', submundo: 'Submundo', papelSubmundo: 'Papel no submundo',
    nomeDeSombra: 'Nome de sombra', nivelAcesso: 'Nível de acesso',
    especialidade: 'Especialidade', feirasQueFrequenta: 'Feiras que frequenta',
    pontosDeContato: 'Pontos de contato', marcas: 'Marcas',
    status: 'Status', veracidade: 'Veracidade', verdade: 'A verdade',
    recompensaInvestigar: 'Recompensa por investigar', fonte: 'Fonte',
    questRelacionada: 'Quest relacionada', nivel: 'Nível', raca: 'Raça',
    classe: 'Classe', tribo: 'Tribo', porte: 'Porte', papel: 'Papel',
    local: 'Local', atributos: 'Atributos', valoresDer: 'Valores derivados',
    peculiaridades: 'Peculiaridades', rolePlay: 'Role play', loot: 'Loot',
    ataques: 'Ataques', skillsTexto: 'Perícias (texto)',
    periciasEstruturadas: 'Perícias', modulosClasse: 'Módulos de classe',
    habitat: 'Habitat', comportamento: 'Comportamento', dieta: 'Dieta',
    nivelAmeaca: 'Nível de ameaça', visibilidade: 'Visibilidade',
    vinculos: 'Vínculos', expectativaVida: 'Expectativa de vida',
    tendencia: 'Tendência', arquetipo: 'Arquétipo', citacao: 'Citação',
    aparencia: 'Aparência', personalidade: 'Personalidade',
    trejeitos: 'Trejeitos', motivacao: 'Motivação', frases: 'Frases',
    historia: 'História', itens: 'Itens', luns: 'Luns', pistas: 'Pistas',
    complicacoes: 'Complicações', subtitulo: 'Subtítulo',
};

const prettify = (k) => {
    // Sigla (FOR, DES, VIG, EXP…) não é palavra: baixar a caixa vira "For".
    if (/^[A-ZÀ-Ý0-9]{2,5}$/.test(k)) return k;
    const s = String(k).replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim();
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};
const rotulo = (k) => ROTULOS[k] || prettify(k);

/* Vazio = não existe. Ninguém quer ler "Clima: —". */
function vazio(v) {
    if (v === null || v === undefined || v === false) return true;
    if (typeof v === 'string') return !v.trim();
    if (Array.isArray(v)) return !v.length;
    if (typeof v === 'object') return !Object.keys(v).length;
    return false;
}

/* Nome legível de um objeto de referência ({id, nome}, {nome, tipo}…). */
const nomeDe = (o) =>
    typeof o === 'object' && o ? (o.nome || o.titulo || o.label || o.name || '') : String(o ?? '');

const LONGO = 160;   // acima disto o texto ganha parágrafo próprio
const escLinhas = (s) => esc(String(s)).replace(/\n/g, '<br>');

function selo(txt) { return `<span class="wb-dos__chip">${esc(txt)}</span>`; }

/* ── Um par chave/valor, no formato que a FORMA do valor pede ── */
function campo(chave, valor, nivel) {
    const label = rotulo(chave);

    if (Array.isArray(valor)) {
        const nomes = valor.map(nomeDe).filter(Boolean);
        // Lista de coisas nomeáveis → selos. Lista de objetos sem nome →
        // blocos aninhados (ex.: peculiaridades com nivel/fonte).
        if (nomes.length === valor.length) {
            return { tipo: 'lista', html: `<div class="wb-dos__row">
                <dt class="wb-dos__k">${esc(label)}</dt>
                <dd class="wb-dos__v"><div class="wb-dos__chips">${nomes.map(selo).join('')}</div></dd>
            </div>` };
        }
        if (nivel >= 2) return null;
        return { tipo: 'bloco', html: `<section class="wb-dos__bloco">
            <h4 class="wb-dos__blocotitulo">${esc(label)}</h4>
            ${valor.map((v, i) => typeof v === 'object' && v
                ? `<div class="wb-dos__subbloco">${listaDeCampos(v, nivel + 1)}</div>`
                : `<p class="wb-dos__texto">${escLinhas(v)}</p>`).join('')}
        </section>` };
    }

    if (typeof valor === 'object') {
        const n = nomeDe(valor);
        // {id, nome} é uma referência, não um bloco: cabe numa linha.
        if (n && Object.keys(valor).every(k => ['id', 'nome', 'titulo', 'tipo', 'label', 'name'].includes(k))) {
            return { tipo: 'curto', html: linha(label, n + (valor.tipo ? ` · ${valor.tipo}` : '')) };
        }
        if (nivel >= 2) return null;
        return { tipo: 'bloco', html: `<section class="wb-dos__bloco">
            <h4 class="wb-dos__blocotitulo">${esc(label)}</h4>
            ${listaDeCampos(valor, nivel + 1)}
        </section>` };
    }

    if (valor === true) return { tipo: 'curto', html: linha(label, 'Sim') };

    const txt = String(valor);
    if (txt.length > LONGO || txt.includes('\n')) {
        return { tipo: 'texto', html: `<section class="wb-dos__bloco">
            <h4 class="wb-dos__blocotitulo">${esc(label)}</h4>
            <p class="wb-dos__texto">${escLinhas(txt)}</p>
        </section>` };
    }
    return { tipo: 'curto', html: linha(label, txt) };
}

const linha = (k, v) => `<div class="wb-dos__row">
    <dt class="wb-dos__k">${esc(k)}</dt>
    <dd class="wb-dos__v">${escLinhas(v)}</dd>
</div>`;

/* Campos de um objeto, já separados: ficha curta primeiro, blocos depois. */
function listaDeCampos(obj, nivel = 0) {
    const curtos = [], blocos = [];
    for (const [k, v] of Object.entries(obj)) {
        if (k.startsWith('_') || OCULTAS.has(k) || vazio(v)) continue;
        const c = campo(k, v, nivel);
        if (!c) continue;
        (c.tipo === 'curto' || c.tipo === 'lista' ? curtos : blocos).push(c.html);
    }
    if (!curtos.length && !blocos.length) return '';
    // Muitos pares curtíssimos (atributos, resistências, qualquer grade que o
    // Criador cadastre) leem melhor em grade que empilhados. Continua decisão
    // por FORMA — ninguém aqui sabe o que é "atributo".
    const grade = curtos.length >= 6 && curtos.every(h => h.length < 190);
    const cls = grade ? 'wb-dos__ficha wb-dos__ficha--grade' : 'wb-dos__ficha';
    return (curtos.length ? `<dl class="${cls}">${curtos.join('')}</dl>` : '') + blocos.join('');
}

/**
 * Dossiê completo de uma entidade.
 * @param {object} e      doc cru vindo do ecossistema
 * @param {object} kind   { icon, label } de KIND (wb-utils)
 */
export function dossieHTML(e, kind = {}) {
    if (!e) return '<p class="wb-dos__vazio">Entidade não encontrada no ecossistema.</p>';
    const nome = e.nome || e.titulo || '(sem nome)';
    const img = imgOf(e);
    const corpo = listaDeCampos(e);
    return `
    <div class="wb-dos">
        <header class="wb-dos__head">
            ${img ? `<img class="wb-dos__img" src="${esc(img)}" alt="" loading="lazy">` : ''}
            <div class="wb-dos__id">
                <span class="wb-dos__kind">${kind.icon || '📄'} ${esc(kind.label || '')}${e.tipo ? ` · ${esc(e.tipo)}` : ''}</span>
                <h3 class="wb-dos__nome">${esc(nome)}</h3>
                ${e.subtitulo ? `<p class="wb-dos__sub">${esc(e.subtitulo)}</p>` : ''}
            </div>
        </header>
        ${corpo || '<p class="wb-dos__vazio">Esta entidade ainda não tem nenhum campo preenchido.</p>'}
    </div>`;
}
