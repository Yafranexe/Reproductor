const CACHE_NAME = 'reproductor-cache-v2';
const urlsToCache = [
    '/',
    '/index.html',
    '/sw.js',
    'https://res.cloudinary.com/dkldlpgf5/image/upload/v1749505808/Pantallas%20PDV/COS002_hpnzgg.jpg',
    'https://res.cloudinary.com/dkldlpgf5/image/upload/v1749502579/Pantallas%20PDV/COS007_bchpfq.jpg',
    'https://res.cloudinary.com/dkldlpgf5/image/upload/v1749149190/6_nay78c.jpg',
    'https://res.cloudinary.com/dkldlpgf5/image/upload/v1749502580/Pantallas%20PDV/COS004_xk3qcp.jpg',
    'https://res.cloudinary.com/dkldlpgf5/image/upload/v1749572958/Pantallas%20PDV/COS003_kayfvd.jpg',
    'https://res.cloudinary.com/dkldlpgf5/image/upload/v1750210704/COS009_m0fuee.jpg',
    'https://res.cloudinary.com/dkldlpgf5/image/upload/v1750214976/COS008_fcucwg.jpg',
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
    // Forzar la activación inmediata
    self.skipWaiting();
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
    // Tomar control inmediatamente
    event.waitUntil(self.clients.claim());
});

// Función para verificar actualizaciones
async function checkForUpdates() {
    try {
        const cache = await caches.open(CACHE_NAME);
        
        for (const url of urlsToCache) {
            try {
                const response = await fetch(url, { 
                    method: 'HEAD',
                    cache: 'no-cache'
                });
                
                if (response.ok) {
                    const cachedResponse = await cache.match(url);
                    if (cachedResponse) {
                        const cachedDate = new Date(cachedResponse.headers.get('date') || 0);
                        const serverDate = new Date(response.headers.get('last-modified') || response.headers.get('date') || 0);
                        
                        if (serverDate > cachedDate) {
                            console.log(`Actualizando: ${url}`);
                            const newResponse = await fetch(url);
                            await cache.put(url, newResponse);
                            
                            // Notificar a la página principal
                            self.clients.matchAll().then(clients => {
                                clients.forEach(client => {
                                    client.postMessage({
                                        type: 'UPDATE_AVAILABLE',
                                        url: url
                                    });
                                });
                            });
                        }
                    }
                }
            } catch (error) {
                console.log(`Error verificando ${url}:`, error);
            }
        }
    } catch (error) {
        console.log('Error en verificación de actualizaciones:', error);
    }
}

// Verificar actualizaciones cada 5 minutos cuando hay conexión
let updateInterval;
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'START_UPDATE_CHECK') {
        // Limpiar intervalo anterior si existe
        if (updateInterval) {
            clearInterval(updateInterval);
        }
        
        // Verificar inmediatamente
        checkForUpdates();
        
        // Verificar cada 5 minutos
        updateInterval = setInterval(checkForUpdates, 5 * 60 * 1000);
    }
    
    if (event.data && event.data.type === 'STOP_UPDATE_CHECK') {
        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
        }
    }
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

// Estrategia de caché primero para imágenes con actualización en segundo plano
self.addEventListener('fetch', event => {
    if (event.request.destination === 'image') {
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    // Devolver la versión cacheada inmediatamente
                    const fetchPromise = fetch(event.request)
                        .then(response => {
                            // Si la respuesta es válida, actualizar el caché
                            if (response.ok) {
                                const responseToCache = response.clone();
                                caches.open(CACHE_NAME)
                                    .then(cache => {
                                        cache.put(event.request, responseToCache);
                                    });
                            }
                            return response;
                        })
                        .catch(() => {
                            // Si falla la red, no hacer nada
                        });

                    // Devolver la versión cacheada (si existe) o la nueva
                    return response || fetchPromise;
                })
        );
    }
}); 