const CACHE_NAME = 'reproductor-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/sw.js',
    'https://res.cloudinary.com/dkldlpgf5/image/upload/v1749505808/Pantallas%20PDV/COS002_hpnzgg.jpg',
    'https://res.cloudinary.com/dkldlpgf5/image/upload/v1749502579/Pantallas%20PDV/COS007_bchpfq.jpg',
    'https://res.cloudinary.com/dkldlpgf5/image/upload/v1749149190/6_nay78c.jpg',
    'https://res.cloudinary.com/dkldlpgf5/image/upload/v1749502580/Pantallas%20PDV/COS004_xk3qcp.jpg',
    'https://res.cloudinary.com/dkldlpgf5/image/upload/v1749572958/Pantallas%20PDV/COS003_kayfvd.jpg'
];

// Instalación del Service Worker
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Cache abierto');
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.log('Error al cachear:', error);
            })
    );
});

// Activación del Service Worker
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Eliminando cache antiguo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Interceptar todas las peticiones
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Si está en caché, devolverlo
                if (response) {
                    return response;
                }

                // Si no está en caché, intentar obtenerlo de la red
                return fetch(event.request)
                    .then(response => {
                        // Verificar que la respuesta sea válida
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clonar la respuesta para cachearla
                        const responseToCache = response.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    })
                    .catch(() => {
                        // Si falla la red, devolver una respuesta por defecto
                        if (event.request.destination === 'image') {
                            return new Response('', {
                                status: 200,
                                statusText: 'OK',
                                headers: {
                                    'Content-Type': 'image/jpeg'
                                }
                            });
                        }
                    });
            })
    );
});

// Estrategia de caché primero para imágenes
self.addEventListener('fetch', event => {
    if (event.request.destination === 'image') {
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    return response || fetch(event.request)
                        .then(response => {
                            const responseToCache = response.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(event.request, responseToCache);
                                });
                            return response;
                        });
                })
        );
    }
}); 