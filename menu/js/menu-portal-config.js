/* =====================================================================
   ⚙️ CONFIG DO PORTAL (aba visível só para cargo criador)
   ---------------------------------------------------------------------
   Upload das imagens da sequência do hero para o Storage
   (app-assets/portal-hero/) e persistência da ordem no Firestore
   (portal-config/hero → { imagens: [url…] }). O menu-hero.js lê esse
   doc; sem imagens, o selo rúnico continua como fallback.

   Ativa quando o menu-firebase.js dispara 'portal:criador'.
   ===================================================================== */

let imagens = [];      // [{url, nome}] na ordem da animação
let ativo = false;

/* Como o título e o botão se põem por cima da arte. Vive no mesmo doc das
   imagens porque é a mesma decisão: uma paisagem com céu limpo em cima pede o
   texto lá, uma com o assunto ao centro pede embaixo. */
/* `vertical`/`horizontal` continuam sendo os do TÍTULO — o nome ficou do
   tempo em que texto e botão andavam grudados, e renomear quebraria o doc que
   já está salvo em portal-config/hero.
   `ctaV`/`ctaH` nascem em 'igual': o botão acompanha o título, que é o
   comportamento de sempre. Assim o documento antigo, sem estes campos, continua
   desenhando exatamente a mesma tela. */
const TEXTO_PADRAO = {
    titulo: true, cta: true,
    vertical: 'centro', horizontal: 'centro',
    ctaV: 'igual', ctaH: 'igual', ctaTam: 'medio',
    veu: 'medio', ritmo: 'normal',
};
const CAMPOS = {
    cfgMostrarTitulo: 'titulo', cfgMostrarCta: 'cta',
    cfgVertical: 'vertical', cfgHorizontal: 'horizontal', cfgVeu: 'veu',
    cfgCtaV: 'ctaV', cfgCtaH: 'ctaH', cfgCtaTam: 'ctaTam', cfgRitmo: 'ritmo',
};

/** Lê os selects. Os dois primeiros são "1"/"0" e viram booleano. */
function lerTexto() {
    const t = { ...TEXTO_PADRAO };
    for (const [id, chave] of Object.entries(CAMPOS)) {
        const el = $(id);
        if (!el) continue;
        t[chave] = (chave === 'titulo' || chave === 'cta') ? el.value === '1' : el.value;
    }
    return t;
}

function pintarTexto(t) {
    const v = { ...TEXTO_PADRAO, ...(t || {}) };
    for (const [id, chave] of Object.entries(CAMPOS)) {
        const el = $(id);
        if (!el) continue;
        el.value = (chave === 'titulo' || chave === 'cta') ? (v[chave] ? '1' : '0') : v[chave];
    }
}

const $ = (id) => document.getElementById(id);

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function status(msg) {
    const el = $('cfgStatus');
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || '';
}

function render() {
    const el = $('cfgSeqLista');
    if (!el) return;
    if (!imagens.length) {
        el.innerHTML = '<p class="notifications-info">Nenhuma imagem configurada — o Portal usa o selo rúnico.</p>';
        return;
    }
    el.innerHTML = imagens.map((img, i) =>
        '<div class="cfg-seq-item">' +
        '<span style="color:var(--lr-text-2);font-variant-numeric:tabular-nums">' + (i + 1) + '</span>' +
        '<img src="' + esc(img.url) + '" alt="" loading="lazy">' +
        '<span class="cfg-seq-nome" title="' + esc(img.nome) + '">' + esc(img.nome) + '</span>' +
        '<button onclick="portalCfgMover(' + i + ',-1)" title="Subir"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button onclick="portalCfgMover(' + i + ',1)" title="Descer"' + (i === imagens.length - 1 ? ' disabled' : '') + '>↓</button>' +
        '<button class="remover" onclick="portalCfgRemover(' + i + ')" title="Remover da sequência">✕</button>' +
        '</div>').join('');
}

window.portalCfgMover = function (i, d) {
    const j = i + d;
    if (j < 0 || j >= imagens.length) return;
    [imagens[i], imagens[j]] = [imagens[j], imagens[i]];
    render();
};

window.portalCfgRemover = function (i) {
    imagens.splice(i, 1);
    render();
};

async function carregarExistente() {
    try {
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        const snap = await getDoc(doc(window.db, 'portal-config', 'hero'));
        if (snap.exists()) {
            const d = snap.data();
            imagens = (d.imagens || []).map((url, i) => ({
                url, nome: (d.nomes && d.nomes[i]) || url.split('%2F').pop().split('?')[0]
            }));
            pintarTexto(d.texto);
        }
    } catch (e) {
        console.warn('Config do Portal: sem doc existente.', e);
    }
    render();
}

async function subirArquivos(files) {
    if (!files || !files.length) return;
    const { getApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    const { getStorage, ref, uploadBytes, getDownloadURL } =
        await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js');
    const storage = getStorage(getApp());

    let n = 0;
    for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        n++;
        status('Enviando ' + n + ' de ' + files.length + '… (' + file.name + ')');
        try {
            const caminho = 'app-assets/portal-hero/' + Date.now() + '-' + file.name.replace(/[^\w.\-]/g, '_');
            const r = ref(storage, caminho);
            await uploadBytes(r, file);
            const url = await getDownloadURL(r);
            imagens.push({ url, nome: file.name });
            render();
        } catch (e) {
            console.error('Upload falhou:', e);
            status('❌ Falha ao enviar ' + file.name + ': ' + e.message);
            return;
        }
    }
    status('✅ ' + n + ' imagem(ns) enviada(s). Ordene se precisar e clique em Salvar Portal.');
}

async function salvar() {
    status('Salvando…');
    try {
        const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        await setDoc(doc(window.db, 'portal-config', 'hero'), {
            imagens: imagens.map(i => i.url),
            nomes: imagens.map(i => i.nome),
            texto: lerTexto(),
            atualizadoEm: new Date().toISOString()
        });
        // O texto vale na hora; a sequência de imagens já está carregada e só
        // troca no próximo carregamento da página.
        window.portalHeroAplicarTexto?.(lerTexto());
        status('✅ Portal salvo! O texto já mudou; recarregue para ver a sequência.');
    } catch (e) {
        console.error('Salvar config falhou:', e);
        status('❌ Não foi possível salvar: ' + e.message);
    }
}

function ligar() {
    if (ativo) return;
    ativo = true;

    const zona = $('cfgDropzone');
    const input = $('cfgArquivos');

    zona.addEventListener('click', () => input.click());
    input.addEventListener('change', () => { subirArquivos([...input.files]); input.value = ''; });

    zona.addEventListener('dragover', (e) => { e.preventDefault(); zona.classList.add('arrastando'); });
    zona.addEventListener('dragleave', () => zona.classList.remove('arrastando'));
    zona.addEventListener('drop', (e) => {
        e.preventDefault();
        zona.classList.remove('arrastando');
        subirArquivos([...e.dataTransfer.files]);
    });

    $('btnSalvarPortalCfg').addEventListener('click', salvar);

    // Prévia ao vivo: mexer no select já mostra o resultado na animação.
    for (const id of Object.keys(CAMPOS)) {
        $(id)?.addEventListener('change', () => window.portalHeroAplicarTexto?.(lerTexto()));
    }

    carregarExistente();
}

document.addEventListener('portal:criador', ligar);
