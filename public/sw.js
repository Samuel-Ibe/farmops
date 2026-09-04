const CACHE_NAME = "farmops-v1";
const STATIC_CACHE = "farmops-static-v1";
const DYNAMIC_CACHE = "farmops-dynamic-v1";

const STATIC_ASSETS = [
  "/",
  "/dashboard",
  "/inventory",
  "/transactions",
  "/qr",
  "/manifest.json",
  "/icons/icon.svg",
];

// Install - cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        console.log("Some assets failed to cache");
      });
    })
  );
  self.skipWaiting();
});

// Activate - clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch - network first with cache fallback
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip API routes (always network)
  if (url.pathname.startsWith("/api/")) return;

  // Skip auth routes
  if (url.pathname.startsWith("/login") || url.pathname.startsWith("/register")) return;

  // Static assets - cache first
  if (request.destination === "style" || request.destination === "script" || request.destination === "image") {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // HTML pages - network first, cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        const clone = response.clone();
        caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          if (cached) return cached;
          // Offline fallback page
          if (request.destination === "document") {
            return caches.match("/dashboard");
          }
          return new Response("Offline", { status: 503 });
        });
      })
  );
});

// Background sync for offline mutations
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-mutations") {
    event.waitUntil(syncPendingMutations());
  }
});

async function syncPendingMutations() {
  // Future: implement offline queue sync
  console.log("Background sync triggered");
}

// Push notifications
self.addEventListener("push", (event) => {
  const data = event.data?.json() || { title: "FarmOps", body: "You have a new notification" };
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-72.png",
      vibrate: [200, 100, 200],
      data: data.url || "/dashboard",
      actions: [
        { action: "open", title: "Open", icon: "/icons/icon-72.png" },
        { action: "dismiss", title: "Dismiss" },
      ],
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "open" || !event.action) {
    event.waitUntil(
      clients.openWindow(event.notification.data)
    );
  }
});
