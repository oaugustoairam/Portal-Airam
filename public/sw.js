// Service worker do Portal Airam: guarda só os arquivos do próprio site (telas, estilos, ícones)
// para o app abrir rápido. Dados de clientes, documentos e login NUNCA ficam em cache.
const VERSAO = 'airam-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return // Supabase, ZapSign etc.: direto na rede

  // páginas: tenta a rede primeiro (sempre a versão mais nova); sem internet, usa a última salva
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copia = r.clone()
          caches.open(VERSAO).then((c) => c.put('./', copia))
          return r
        })
        .catch(() => caches.match('./'))
    )
    return
  }
  // arquivos com nome versionado (assets/…) e ícones: cache primeiro
  e.respondWith(
    caches.match(req).then(
      (salvo) =>
        salvo ||
        fetch(req).then((r) => {
          if (r.ok) {
            const copia = r.clone()
            caches.open(VERSAO).then((c) => c.put(req, copia))
          }
          return r
        })
    )
  )
})
