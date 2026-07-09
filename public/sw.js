self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("trade-journal-v1").then((cache) => cache.addAll(["/", "/manifest.webmanifest"]))
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request);
    })
  );
});
