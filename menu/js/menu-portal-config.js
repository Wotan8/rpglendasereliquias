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
            atualizadoEm: new Date().toISOString()
        });
        status('✅ Portal salvo! Recarregue a página para ver a sequência no hero.');
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

    carregarExistente();
}

document.addEventListener('portal:criador', ligar);
