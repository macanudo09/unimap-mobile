// ============================================================
//  Unimap Mobile — Service Worker
//  버전 변경 시 CACHE_VERSION 숫자를 올리면 강제 캐시 초기화
// ============================================================

const CACHE_VERSION = 'unimap-mobile-v3';

const CACHE_FILES = [
    './',
    './index.html',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
];

// ── 설치: 캐시 대상 파일 저장 ──
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then(cache => {
            return cache.addAll(CACHE_FILES).catch(err => {
                // 아이콘 등 일부 파일 없어도 설치 실패 방지
                console.warn('[SW] 일부 파일 캐시 실패:', err);
            });
        })
    );
    // 새 SW 즉시 활성화 (기존 페이지 대기 없이)
    self.skipWaiting();
});

// ── 활성화: 구버전 캐시 삭제 ──
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== CACHE_VERSION)
                    .map(key => caches.delete(key))
            )
        ).then(() => {
            // 현재 열려 있는 모든 탭에 즉시 적용
            return self.clients.claim();
        })
    );
});

// ── Fetch: Cache First 전략 ──
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // mobile.json / result*.json 은 캐시 제외 (항상 네트워크)
    if (
        url.pathname.includes('mobile.json') ||
        url.pathname.includes('result') && url.pathname.endsWith('.json')
    ) {
        return; // 브라우저 기본 동작
    }

    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                // 정상 응답만 캐시에 저장
                if (response && response.status === 200 && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => {
                // 오프라인 + 캐시 미스: index.html 폴백
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});

// ── 업데이트 감지: 클라이언트에 메시지 전송 ──
self.addEventListener('message', event => {
    if (event.data === 'CHECK_UPDATE') {
        self.clients.matchAll().then(clients => {
            clients.forEach(client => client.postMessage('SW_UPDATED'));
        });
    }
});
