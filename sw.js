// =============================================
// SERVICE WORKER — Lendas e Relíquias (PWA Offline)
// Estratégia: Precache do app shell + Stale-While-Revalidate
// Atualização forçada: skipWaiting() + clients.claim()
//   (o cliente escuta 'controllerchange' e recarrega UMA vez)
//
// ⚠️ Para publicar uma atualização do app, incremente a VERSION
// abaixo. Isso troca o nome dos caches, força a reinstalação e
// todos os clientes abertos recarregam automaticamente.
// =============================================

const VERSION = 'v81';
const STATIC_CACHE = `lr-static-${VERSION}`;
const RUNTIME_CACHE = `lr-runtime-${VERSION}`;

// App shell + todos os recursos críticos (HTML, CSS, JS e SDKs de CDN)
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/404.html',
  '/criar-personagem/criacao.html',
  '/criar-personagem/css/styles.css',
  '/criar-personagem/css/styles_wizard.css',
  '/criar-personagem/js/app.js',
  '/criar-personagem/js/attributes-module.js',
  '/criar-personagem/js/data.js',
  '/criar-personagem/js/equipment-module.js',
  '/criar-personagem/js/exp-tracker.js',
  '/criar-personagem/js/finale-module.js',
  '/criar-personagem/js/firebase.js',
  '/criar-personagem/js/mechanics-simulator.js',
  '/criar-personagem/js/memory-manager.js',
  '/criar-personagem/js/npcs-module.js',
  '/criar-personagem/js/peculiarities-module.js',
  '/criar-personagem/js/race-module.js',
  '/criar-personagem/js/skills-module.js',
  '/criar-personagem/js/soul-module.js',
  '/criar-personagem/js/storage.js',
  '/criar-personagem/js/system-data-loader.js',
  '/criar-personagem/js/theme.js',
  '/criar-personagem/js/tribe-module.js',
  '/criar-personagem/js/wizard-engine.js',
  '/ficha-v1.7_1/css/combat-panel.css',
  '/ficha-v1.7_1/css/conhecimento.css',
  '/ficha-v1.7_1/css/equip-modal.css',
  '/ficha-v1.7_1/css/inventory.css',
  '/ficha-v1.7_1/css/print.css',
  '/ficha-v1.7_1/css/styles_v2.css',
  '/ficha-v1.7_1/ficha-v1.7_1.html',
  '/ficha-v1.7_1/js/aliado-inventario.js',
  '/ficha-v1.7_1/js/aliados.js',
  '/ficha-v1.7_1/js/app.js',
  '/ficha-v1.7_1/js/aura.js',
  '/ficha-v1.7_1/js/char-logger.js',
  '/ficha-v1.7_1/js/class-modules-renderer.js',
  '/ficha-v1.7_1/js/class-tests-data.js',
  '/ficha-v1.7_1/js/class-tests.js',
  '/ficha-v1.7_1/js/combat-panel.js',
  '/ficha-v1.7_1/js/conhecimento-calc.js',
  '/ficha-v1.7_1/js/conhecimento.js',
  '/ficha-v1.7_1/js/core.js',
  '/ficha-v1.7_1/js/data.js',
  '/ficha-v1.7_1/js/derived-values.js',
  '/ficha-v1.7_1/js/detail-modal.js',
  '/ficha-v1.7_1/js/drag-drop.js',
  '/ficha-v1.7_1/js/equipment.js',
  '/ficha-v1.7_1/js/exp-upgrade.js',
  '/ficha-v1.7_1/js/firebase.js',
  '/ficha-v1.7_1/js/inventory.js',
  '/ficha-v1.7_1/js/mechanics-engine.js',
  '/ficha-v1.7_1/js/mesa-tab.js',
  '/ficha-v1.7_1/js/notes.js',
  '/ficha-v1.7_1/js/print.js',
  '/ficha-v1.7_1/js/race-peculiarities.js',
  '/ficha-v1.7_1/js/runomancia-module.js',
  '/ficha-v1.7_1/js/storage.js',
  '/ficha-v1.7_1/js/system-data-loader.js',
  '/ficha-v1.7_1/js/theme.js',
  '/hexmap.html',
  '/hexmap.js',
  '/index.html',
  '/js/global-favicon.js',
  '/laboratorium-runarum/css/lab-print.css',
  '/laboratorium-runarum/css/laboratorium.css',
  '/laboratorium-runarum/js/canvas.js',
  '/laboratorium-runarum/js/compendium-data.js',
  '/laboratorium-runarum/js/lab-app.js',
  '/laboratorium-runarum/js/lab-firebase.js',
  '/laboratorium-runarum/js/rune-engine.js',
  '/laboratorium-runarum/js/rune-export.js',
  '/laboratorium-runarum/laboratorium.html',
  '/menu/css/menu.css',
  '/menu/js/menu-firebase.js',
  '/menu/menu.html',
  '/painel-criador/css/painel-criador.css',
  '/painel-criador/js/painel-firebase.js',
  '/painel-criador/js/painel-mechanics.js',
  '/painel-criador/js/painel-runic.js',
  '/painel-criador/js/settings-manager.js',
  '/painel-criador/js/shortcuts-manager.js',
  '/painel-criador/painel-criador.html',
  '/painel-mestre/css/area-apoio.css',
  '/painel-mestre/css/area-economica.css',
  '/painel-mestre/css/area-historico.css',
  '/painel-mestre/css/area-mesas.css',
  '/painel-mestre/css/area-npcs.css',
  '/painel-mestre/css/base.css',
  '/painel-mestre/css/layout.css',
  '/painel-mestre/css/modais.css',
  '/painel-mestre/css/tabs.css',
  '/painel-mestre/js/area-apoio.js',
  '/painel-mestre/js/area-economica.js',
  '/painel-mestre/js/area-historico.js',
  '/painel-mestre/js/area-mesas-condicoes.js',
  '/painel-mestre/js/area-mesas-config.js',
  '/painel-mestre/js/area-mesas-inventario.js',
  '/painel-mestre/js/area-mesas-logs.js',
  '/painel-mestre/js/area-mesas-notas.js',
  '/painel-mestre/js/area-mesas-npcs.js',
  '/painel-mestre/js/area-mesas-peculiaridades.js',
  '/painel-mestre/js/area-mesas-sessoes.js',
  '/painel-mestre/js/area-mesas.js',
  '/painel-mestre/js/area-npcs.js',
  '/painel-mestre/js/auth.js',
  '/painel-mestre/js/combat.js',
  '/painel-mestre/js/firebase-config.js',
  '/painel-mestre/js/log-viewer.js',
  '/painel-mestre/js/logs.js',
  '/painel-mestre/js/main.js',
  '/painel-mestre/js/npc-calc-engine.js',
  '/painel-mestre/js/npc-inventario.js',
  '/painel-mestre/js/npc-system-data.js',
  '/painel-mestre/js/repertorio.js',
  '/painel-mestre/js/state.js',
  '/painel-mestre/js/ui-utils.js',
  '/painel-mestre/painel-mestre.html',
  '/tabuleiro/tabuleiro.html',
  '/tabuleiro/css/tabuleiro.css',
  '/tabuleiro/js/tab-state.js',
  '/tabuleiro/js/tab-main.js',
  '/tabuleiro/js/tab-render.js',
  '/tabuleiro/js/tab-tools.js',
  '/tabuleiro/js/tab-objects.js',
  '/tabuleiro/js/tab-combat.js',
  '/tabuleiro/js/tab-mostrar.js',
  '/tabuleiro/js/tab-grid.js',
  '/tabuleiro/js/tab-templates.js',
  '/tabuleiro/js/tab-fog.js',
  '/tabuleiro/js/tab-presenca.js',
  '/tabuleiro/js/tab-hud.js',
  '/tabuleiro/js/tab-clima.js',
  '/tabuleiro/js/tab-cena.js',
  '/tabuleiro/js/tab-undo.js',
  '/tabuleiro/js/tab-musica.js',
  '/tabuleiro/js/tab-musica-calc.js',
  '/tabuleiro/js/tab-local.js',
  '/tabuleiro/js/tab-girar.js',
  '/shared/lendas-reliquias.css',
  '/shared/livro-vinculado.js',
  '/shared/local-tatico.js',
  '/shared/texto-mundo.css',
  '/shared/theme.js',
  '/shared/tokens.css',
  '/viewmap.html',
  '/worldbuilding/worldbuilding.html',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js',
  'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

// Hosts cujas respostas GET podem ser cacheadas (Stale-While-Revalidate)
const CACHEABLE_HOSTS = [
  self.location.host,
  'www.gstatic.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com',
  'firebasestorage.googleapis.com' // imagens de itens/fichas
];

// Hosts de API dinâmica — NUNCA interceptar (o SDK do Firestore
// tem seu próprio cache offline via IndexedDB)
const NETWORK_ONLY_HOSTS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'www.googleapis.com'
];

// ---------------------------------------------
// INSTALL — precache do shell + skipWaiting imediato
// ---------------------------------------------
self.addEventListener('install', event => {
  // ATUALIZAÇÃO FORÇADA (parte 1): o novo SW não espera o antigo morrer
  self.skipWaiting();

  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache =>
      // add() individual: um recurso indisponível não aborta a instalação inteira.
      // `cache: 'reload'` é ESSENCIAL: sem ele o precache é servido pelo cache
      // HTTP do navegador (os .js/.css vão com max-age=3600), então uma versão
      // nova do SW reinstalava com arquivos de até 1h atrás — no celular, que
      // fica dias sem recarregar, a correção simplesmente não chegava.
      Promise.allSettled(
        PRECACHE_URLS.map(url =>
          cache.add(new Request(url, { cache: 'reload' }))
            .catch(err => console.warn('[SW] Falha ao pré-cachear:', url, err))
        )
      )
    )
  );
});

// ---------------------------------------------
// ACTIVATE — limpa caches antigos + assume os clientes abertos
// ---------------------------------------------
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(n => n !== STATIC_CACHE && n !== RUNTIME_CACHE)
          .map(n => caches.delete(n))
      );
      // ATUALIZAÇÃO FORÇADA (parte 2): controla imediatamente todas as abas
      await self.clients.claim();
    })()
  );
});

// ---------------------------------------------
// FETCH — Stale-While-Revalidate
// Responde instantaneamente do cache e atualiza em segundo plano.
// ---------------------------------------------
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try { url = new URL(request.url); } catch (e) { return; }
  if (!url.protocol.startsWith('http')) return;

  // APIs dinâmicas: deixa passar direto (Firestore cuida do próprio offline)
  if (NETWORK_ONLY_HOSTS.includes(url.host)) return;

  // Hosts não listados: não intercepta
  if (!CACHEABLE_HOSTS.includes(url.host)) return;

  // Navegações (HTML): SWR com fallback offline para o shell
  if (request.mode === 'navigate') {
    event.respondWith(staleWhileRevalidate(request, { navigationFallback: true }));
    return;
  }

  // Demais recursos (CSS, JS, imagens, fontes): SWR
  event.respondWith(staleWhileRevalidate(request));
});

async function staleWhileRevalidate(request, opts = {}) {
  const cached = await caches.match(request, { ignoreSearch: false });

  const networkPromise = fetch(request)
    .then(async response => {
      // Cacheia apenas respostas válidas (200) ou opacas de CDN confiável
      if (response && (response.ok || response.type === 'opaque')) {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    // Stale: responde já; Revalidate: atualiza o cache em background
    networkPromise.catch(() => {});
    return cached;
  }

  const network = await networkPromise;
  if (network) return network;

  // Offline e sem cache exato
  if (opts.navigationFallback) {
    const shell = await caches.match('/index.html');
    if (shell) return shell;
  }
  return new Response('Offline — recurso ainda não disponível no cache.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

// Permite que a página peça a ativação imediata (canal alternativo de update)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
