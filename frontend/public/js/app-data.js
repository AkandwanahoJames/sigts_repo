// =====================================================
// SIGTS - SMART INFORMATION GUIDE TOUR SYSTEM
// BWINDI IMPENETRABLE NATIONAL PARK
// =====================================================
// APP STATE MANAGEMENT (Extended for Intranet)
// =====================================================

const RUNTIME_CONFIG = window.__SIGTS_CONFIG__ || {};

/** Ensure all API calls use `.../api` (never `http://host:port/auth/...`). */
function normalizeSigtsApiBaseUrl(raw) {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return '';

    try {
        const u = new URL(trimmed);
        let path = (u.pathname || '/').replace(/\/+$/, '');
        if (path === '/' || path === '') {
            path = '/api';
        } else if (!/\/api$/i.test(path)) {
            path = `${path}/api`;
        }
        return `${u.origin}${path}`.replace(/\/+$/, '');
    } catch (_) {
        const base = trimmed.replace(/\/+$/, '');
        return /\/api$/i.test(base) ? base : `${base}/api`;
    }
}

function resolveSigtsApiBaseUrl() {
    const pagePort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
    const pageOrigin = window.location.origin;

    // Backend serves the UI on the same port as /api (single-origin dev/demo)
    if (pagePort === '8000' || pagePort === '8001') {
        const sameOriginApi = normalizeSigtsApiBaseUrl(pageOrigin);
        if (sameOriginApi) return sameOriginApi;
    }

    // live-server on :3000 — call backend port directly (its /api proxy strips the prefix)
    if (pagePort === '3000') {
        const configuredBase = RUNTIME_CONFIG.API_URL || window.__SIGTS_API_BASE__;
        if (typeof configuredBase === 'string' && configuredBase.trim()) {
            try {
                const parsed = new URL(configuredBase, pageOrigin);
                const apiHost = parsed.hostname || '';
                const isLocalApiHost = apiHost === 'localhost' || apiHost === '127.0.0.1';
                if (window.location.hostname && isLocalApiHost && window.location.hostname !== apiHost) {
                    parsed.hostname = window.location.hostname;
                }
                return normalizeSigtsApiBaseUrl(parsed.toString());
            } catch (_) {
                return normalizeSigtsApiBaseUrl(configuredBase);
            }
        }
        const apiPort = Number(RUNTIME_CONFIG.API_PORT) || 8000;
        const host = window.location.hostname || 'localhost';
        return normalizeSigtsApiBaseUrl(`http://${host}:${apiPort}`);
    }

    // nginx / production: API on same host at /api
    if (pagePort === '80' || pagePort === '443' || pagePort === '') {
        const proxied = normalizeSigtsApiBaseUrl(pageOrigin);
        if (proxied) return proxied;
    }

    const configuredBase = RUNTIME_CONFIG.API_URL || window.__SIGTS_API_BASE__;
    if (typeof configuredBase === 'string' && configuredBase.trim()) {
        try {
            const parsed = new URL(configuredBase, pageOrigin);
            const cfgPort = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
            const sameHost = parsed.hostname === window.location.hostname;
            // Dev UI on :3000 but config still points at localhost API — keep explicit API port
            if (sameHost && pagePort === '3000' && (cfgPort === '8000' || cfgPort === '8001')) {
                return normalizeSigtsApiBaseUrl(configuredBase);
            }
            if (sameHost && (pagePort === '80' || pagePort === '443' || pagePort === '')) {
                return normalizeSigtsApiBaseUrl(pageOrigin);
            }
        } catch (_) {
            /**/
        }
        return normalizeSigtsApiBaseUrl(configuredBase);
    }

    const host = window.location.hostname;
    const isLocalHost = host === 'localhost' || host === '127.0.0.1';
    const apiPort = Number(RUNTIME_CONFIG.API_PORT) || 8000;
    if (isLocalHost) {
        return `http://localhost:${apiPort}/api`;
    }

    return normalizeSigtsApiBaseUrl(pageOrigin) || `${pageOrigin}/api`;
}

let API_BASE_URL = normalizeSigtsApiBaseUrl(resolveSigtsApiBaseUrl());

function getSigtsApiBaseUrl() {
    const base = API_BASE_URL || window.__SIGTS_API_BASE__ || resolveSigtsApiBaseUrl();
    return normalizeSigtsApiBaseUrl(base);
}

function isPublicAuthEndpoint(endpoint) {
    return /^\/auth\/(login|register|guest|forgot-password|verify-email|reset-password|refresh|check-availability)(\/|$|\?)/.test(
        String(endpoint || '')
    );
}

/** Probe localhost API ports when config points at an unreachable server. */
async function ensureSigtsApiReachable() {
    const host = window.location.hostname || 'localhost';
    const candidates = [];
    const add = (url) => {
        const n = normalizeSigtsApiBaseUrl(url);
        if (n && !candidates.includes(n)) candidates.push(n);
    };

    add(API_BASE_URL);
    add(window.__SIGTS_API_BASE__);
    const preferred = Number(RUNTIME_CONFIG.API_PORT) || 8000;
    const pagePort = window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
    if (host === 'localhost' || host === '127.0.0.1') {
        add(`http://${host}:${preferred}/api`);
        [8001, 8000, 8080].forEach((p) => add(`http://${host}:${p}/api`));
    } else if (pagePort === '3000') {
        const protocol = window.location.protocol || 'http:';
        add(`${protocol}//${host}:${preferred}/api`);
        [8001, 8000, 8080].forEach((p) => add(`${protocol}//${host}:${p}/api`));
    }

    for (const base of candidates) {
        const apiBase = normalizeSigtsApiBaseUrl(base);
        if (!apiBase || !/\/api$/i.test(apiBase)) continue;
        try {
            const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timer = ctrl ? window.setTimeout(() => ctrl.abort(), 2500) : null;
            const res = await fetch(`${apiBase}/health`, {
                method: 'GET',
                cache: 'no-store',
                ...(ctrl ? { signal: ctrl.signal } : {})
            });
            if (timer) window.clearTimeout(timer);
            if (!res.ok) continue;
            const body = await res.json().catch(() => null);
            if (!body || typeof body.database === 'undefined') continue;
            if (apiBase !== API_BASE_URL) {
                console.info('[SIGTS] API reachable at', apiBase);
            }
            API_BASE_URL = apiBase;
            API_URL = apiBase;
            window.__SIGTS_API_BASE__ = apiBase;
            return apiBase;
        } catch (_) {
            /** try next candidate */
        }
    }
    return getSigtsApiBaseUrl();
}

class APIService {
    constructor() {
        this.refreshPromise = null;
    }

    getLiveCoordinates() {
        const loc = window.Geofence?.currentLocation || window.AppState?.currentLocation;
        if (!loc) return null;
        const lat = Number(loc.lat);
        const lng = Number(loc.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { lat, lng };
    }

    getToken() {
        return localStorage.getItem('token') || sessionStorage.getItem('token');
    }

    setToken(token) {
        if (token) {
            this.token = token;
            return;
        }
        this.token = null;
    }

    getRefreshToken() {
        return localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
    }

    setRefreshToken(refreshToken, persistent = null) {
        const persistToLocal = persistent === null
            ? Boolean(localStorage.getItem('token'))
            : Boolean(persistent);
        if (!refreshToken) {
            localStorage.removeItem('refreshToken');
            sessionStorage.removeItem('refreshToken');
            return;
        }
        if (persistToLocal) {
            localStorage.setItem('refreshToken', refreshToken);
            sessionStorage.removeItem('refreshToken');
        } else {
            sessionStorage.setItem('refreshToken', refreshToken);
            localStorage.removeItem('refreshToken');
        }
    }

    async refreshAccessToken() {
        const refreshToken = this.getRefreshToken();
        if (!refreshToken) return null;
        if (this.refreshPromise) return this.refreshPromise;
        this.refreshPromise = (async () => {
            try {
                const response = await fetch(`${getSigtsApiBaseUrl()}/auth/refresh`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refreshToken })
                });
                const payload = await response.json().catch(() => null);
                const newAccess = payload?.accessToken || payload?.token;
                if (!response.ok || !payload?.success || !newAccess) {
                    this.setToken(null);
                    this.setRefreshToken(null);
                    return null;
                }
                const persistToLocal = Boolean(localStorage.getItem('token'));
                if (persistToLocal) localStorage.setItem('token', newAccess);
                else sessionStorage.setItem('token', newAccess);
                this.setToken(newAccess);
                if (payload.refreshToken) {
                    this.setRefreshToken(payload.refreshToken, persistToLocal);
                }
                return newAccess;
            } catch (_) {
                return null;
            } finally {
                this.refreshPromise = null;
            }
        })();
        return this.refreshPromise;
    }

    async request(endpoint, options = {}, meta = {}) {
        const method = String(options.method || 'GET').toUpperCase();
        const retryCount = Number(meta._retryCount) || 0;
        const maxRetries =
            method === 'GET' && !meta._noRetry ? Math.min(2, Number(meta._maxRetries ?? 2)) : 0;

        if (window.Auth?.touchSessionActivity) {
            window.Auth.touchSessionActivity();
        }
        const token = this.getToken();
        const publicAuth = isPublicAuthEndpoint(endpoint);
        const headers = {
            ...options.headers
        };

        if (!(options.body instanceof FormData) && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }
        if (token && !publicAuth) {
            headers.Authorization = `Bearer ${token}`;
        }
        if (!publicAuth) {
            const coords = this.getLiveCoordinates();
            if (coords && !headers['x-user-lat'] && !headers['x-user-lng']) {
                headers['x-user-lat'] = String(coords.lat);
                headers['x-user-lng'] = String(coords.lng);
            }
            try {
                const sim = JSON.parse(localStorage.getItem('parkAccessSimulation') || '{}');
                const boundary = ['auto', 'inside', 'outside'].includes(sim.boundary) ? sim.boundary : 'auto';
                const network = ['auto', 'online', 'offline'].includes(sim.network) ? sim.network : 'auto';
                headers['x-sigts-sim-boundary'] = boundary;
                headers['x-sigts-sim-network'] = network;
            } catch (_) {
                headers['x-sigts-sim-boundary'] = 'auto';
                headers['x-sigts-sim-network'] = 'auto';
            }
        }

        if (
            !publicAuth &&
            typeof window.isParkAccessBlocked === 'function' &&
            window.isParkAccessBlocked()
        ) {
            const pathOnly = String(endpoint || '').split('?')[0];
            const allowedWhileLocked =
                /^\/intranet\/status-lite$/i.test(pathOnly) ||
                /^\/auth\//i.test(pathOnly);
            if (!allowedWhileLocked) {
                return {
                    error: 'SIGTS is only available inside the Bwindi park boundary.',
                    code: 'PARK_ACCESS_DENIED',
                    status: 403,
                    parkAccessDenied: true
                };
            }
        }

        const opts = { ...options };
        delete opts.timeoutMs;
        const isFormData = opts.body instanceof FormData;
        let timeoutMs = options.timeoutMs;
        if (timeoutMs === undefined) {
            timeoutMs = isFormData ? 0 : 15000;
        }

        let controller;
        let timer;
        if (timeoutMs > 0 && typeof AbortController !== 'undefined') {
            controller = new AbortController();
            timer = window.setTimeout(() => controller.abort(), timeoutMs);
        }

        try {
            const response = await fetch(`${getSigtsApiBaseUrl()}${endpoint}`, {
                ...opts,
                headers,
                ...(controller ? { signal: controller.signal } : {})
            });
            const raw = await response.text();
            let payload = null;

            try {
                payload = raw ? JSON.parse(raw) : null;
            } catch {
                payload = raw;
            }

            if (!response.ok) {
                if (response.status === 429) {
                    return {
                        ...(payload && typeof payload === 'object' ? payload : {}),
                        error: payload?.error || payload?.message || 'Too many requests',
                        status: 429,
                        rateLimited: true,
                        ok: false,
                    };
                }
                if (response.status === 401 && payload?.code === 'SESSION_IDLE_EXPIRED') {
                    await window.Auth?.logout?.();
                    return { ...payload, status: response.status };
                }
                const canRetryWithRefresh =
                    response.status === 401
                    && !meta._retriedAfterRefresh
                    && !/^\/auth\/(login|refresh|guest)/.test(String(endpoint || ''));
                if (canRetryWithRefresh) {
                    const newToken = await this.refreshAccessToken();
                    if (newToken) {
                        return this.request(endpoint, options, { ...meta, _retriedAfterRefresh: true });
                    }
                }
                if (payload && typeof payload === 'object') {
                    return { ...payload, status: response.status, ok: false };
                }
                return { error: `HTTP ${response.status}`, status: response.status, raw };
            }

            if (payload && typeof payload === 'object') {
                return { ...payload, status: response.status, ok: true };
            }
            return payload;
        } catch (error) {
            const isTransient =
                error?.name === 'AbortError' ||
                error?.message === 'Failed to fetch' ||
                error?.message === 'NetworkError when attempting to fetch resource.';
            if (meta._rateLimited || meta._noRetry) {
                return {
                    error: error?.message || 'Request failed',
                    network: true,
                    status: 0,
                };
            }
            if (isTransient && retryCount < maxRetries) {
                const delayMs = 800 * (retryCount + 1);
                await new Promise((r) => window.setTimeout(r, delayMs));
                return this.request(endpoint, options, { ...meta, _retryCount: retryCount + 1 });
            }
            if (error?.name === 'AbortError') {
                console.warn(`API timeout (${endpoint}) after ${timeoutMs}ms`);
                return {
                    error: `Request timed out after ${Math.round(timeoutMs / 1000)}s`,
                    network: true,
                    status: 0
                };
            }
            console.error(`API Error (${endpoint}):`, error);
            return {
                error: error?.message || 'Network error',
                network: true,
                status: 0
            };
        } finally {
            if (timer !== undefined) window.clearTimeout(timer);
        }
    }

    async requestRaw(endpoint, options = {}) {
        if (window.Auth?.touchSessionActivity) {
            window.Auth.touchSessionActivity();
        }
        const token = this.getToken();
        const headers = {
            ...options.headers
        };

        if (!(options.body instanceof FormData) && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        }
        const coords = this.getLiveCoordinates();
        if (coords && !headers['x-user-lat'] && !headers['x-user-lng']) {
            headers['x-user-lat'] = String(coords.lat);
            headers['x-user-lng'] = String(coords.lng);
        }
        try {
            const sim = JSON.parse(localStorage.getItem('parkAccessSimulation') || '{}');
            const boundary = ['auto', 'inside', 'outside'].includes(sim.boundary) ? sim.boundary : 'auto';
            const network = ['auto', 'online', 'offline'].includes(sim.network) ? sim.network : 'auto';
            headers['x-sigts-sim-boundary'] = boundary;
            headers['x-sigts-sim-network'] = network;
        } catch (_) {
            headers['x-sigts-sim-boundary'] = 'auto';
            headers['x-sigts-sim-network'] = 'auto';
        }

        if (typeof window.isParkAccessBlocked === 'function' && window.isParkAccessBlocked()) {
            const pathOnly = String(endpoint || '').split('?')[0];
            if (!/^\/intranet\/status-lite$/i.test(pathOnly) && !/^\/auth\//i.test(pathOnly)) {
                throw new Error('PARK_ACCESS_DENIED');
            }
        }

        const opts = { ...options };
        delete opts.timeoutMs;
        const isFormData = opts.body instanceof FormData;
        let timeoutMs = options.timeoutMs;
        if (timeoutMs === undefined) {
            timeoutMs = isFormData ? 0 : 15000;
        }

        let controller;
        let timer;
        if (timeoutMs > 0 && typeof AbortController !== 'undefined') {
            controller = new AbortController();
            timer = window.setTimeout(() => controller.abort(), timeoutMs);
        }

        try {
            const response = await fetch(`${getSigtsApiBaseUrl()}${endpoint}`, {
                ...opts,
                headers,
                ...(controller ? { signal: controller.signal } : {})
            });
            const text = await response.text();
            return { ok: response.ok, status: response.status, headers: response.headers, text };
        } catch (error) {
            if (error?.name === 'AbortError') {
                console.warn(`API timeout (${endpoint}) after ${timeoutMs}ms`);
            } else {
                console.error(`API Error (${endpoint}):`, error);
            }
            return { ok: false, status: 0, headers: null, text: '', error };
        } finally {
            if (timer !== undefined) window.clearTimeout(timer);
        }
    }

    async getSightingBestTimes(animalId, options = {}) {
        if (!animalId) return null;
        const qs = new URLSearchParams();
        qs.set('animal_id', String(animalId));
        if (options.days) qs.set('days', String(options.days));
        if (options.location_id) qs.set('location_id', String(options.location_id));
        const result = await this.request(`/sightings/best-times?${qs.toString()}`);
        if (result && typeof result === 'object') return result;
        return null;
    }

    async getCulturalStoryOfDay() {
        const result = await this.request('/cultural/featured/today');
        if (result?.story) return result;
        return null;
    }

    async listAdminLocations(limit = 200) {
        const r = await this.request(`/admin/locations?limit=${encodeURIComponent(limit)}`);
        if (Array.isArray(r?.locations)) return r.locations;
        return [];
    }

    async listAdminSafeZones() {
        const r = await this.request('/admin/safe-zones');
        if (Array.isArray(r?.safe_zones)) return r;
        return { safe_zones: [], note: r?.note || '' };
    }

    async listAdminSafeZoneViolations({ limit = 40, unacked = true } = {}) {
        const qs = new URLSearchParams();
        qs.set('limit', String(limit));
        qs.set('unacked', unacked ? 'true' : 'false');
        const r = await this.request(`/admin/safe-zone-violations?${qs.toString()}`);
        if (Array.isArray(r?.violations)) return r.violations;
        return [];
    }

    async acknowledgeSafeZoneViolation(violationId) {
        const id = encodeURIComponent(String(violationId || '').trim());
        if (!id) return { success: false, error: 'Violation id required' };
        return this.request(`/admin/safe-zone-violations/${id}/ack`, { method: 'PUT', body: JSON.stringify({}) });
    }

    // Sightings endpoints
    async getRecentSightings(limit = 20) {
        const result = await this.request(`/sightings/recent?limit=${limit}`);
        if (Array.isArray(result)) return result;
        if (result && result.success && result.data) return result.data;
        try {
            const raw = localStorage.getItem('sightings');
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed.slice(0, limit) : [];
        } catch (_) {
            return [];
        }
    }

    async reportSighting(sightingData) {
        const result = await this.request('/sightings', {
            method: 'POST',
            body: JSON.stringify(sightingData)
        });
        if (result && (result.sighting_id || result.success)) {
            if (result.rare_alert) {
                const localAlerts = JSON.parse(localStorage.getItem('rare_sighting_alerts') || '[]');
                localAlerts.unshift(result.rare_alert);
                localStorage.setItem('rare_sighting_alerts', JSON.stringify(localAlerts.slice(0, 50)));
            }
            return result;
        }
        // Fallback to localStorage
        const sightings = JSON.parse(localStorage.getItem('sightings') || '[]');
        const newSighting = { sighting_id: Date.now(), ...sightingData, timestamp: new Date().toISOString(), verified: false };
        sightings.unshift(newSighting);
        localStorage.setItem('sightings', JSON.stringify(sightings));
        return newSighting;
    }

    async getSightingStats(animal = null, days = 30) {
        const result = await this.request(`/sightings/stats?animal=${animal || ''}&days=${days}`);
        if (result && result.total !== undefined) return result;
        if (result && result.success && result.data) return result.data;
        // Fallback to localStorage calculation
        const sightings = JSON.parse(localStorage.getItem('sightings') || '[]');
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const filtered = animal ? sightings.filter(s => s.animal_name === animal) : sightings;
        const recent = filtered.filter(s => new Date(s.timestamp) > cutoff);
        const byAnimal = {};
        recent.forEach(s => { byAnimal[s.animal_name] = (byAnimal[s.animal_name] || 0) + s.number_observed; });
        return { byAnimal, totalSightings: recent.length };
    }

    async getRareSightingAlerts(limit = 10) {
        const result = await this.request(`/sightings/alerts/rare?limit=${limit}`);
        if (Array.isArray(result)) return result;
        return JSON.parse(localStorage.getItem('rare_sighting_alerts') || '[]').slice(0, limit);
    }

    async getUnackedRareSightingAlerts(limit = 10) {
        const result = await this.request(`/sightings/alerts/rare?limit=${limit}&unacked=true`);
        if (Array.isArray(result)) return result;
        return JSON.parse(localStorage.getItem('rare_sighting_alerts') || '[]')
            .filter((a) => !a.acknowledged)
            .slice(0, limit);
    }

    async acknowledgeRareSightingAlert(alertId) {
        const result = await this.request(`/sightings/alerts/rare/${encodeURIComponent(alertId)}/ack`, {
            method: 'PUT'
        });
        if (result?.success) return result.alert;
        return null;
    }

    async getSightingComments(sightingId, limit = 10) {
        const result = await this.request(`/sightings/${encodeURIComponent(sightingId)}/comments?limit=${limit}`);
        if (Array.isArray(result)) return result;
        const allLocal = JSON.parse(localStorage.getItem('sighting_comments') || '{}');
        return Array.isArray(allLocal[sightingId]) ? allLocal[sightingId].slice(0, limit) : [];
    }

    async addSightingComment(sightingId, commentText) {
        const result = await this.request(`/sightings/${encodeURIComponent(sightingId)}/comments`, {
            method: 'POST',
            body: JSON.stringify({ comment_text: commentText })
        });
        if (result?.success && result.comment) return result.comment;

        const allLocal = JSON.parse(localStorage.getItem('sighting_comments') || '{}');
        if (!Array.isArray(allLocal[sightingId])) allLocal[sightingId] = [];
        allLocal[sightingId].unshift({
            comment_id: `local_${Date.now()}`,
            sighting_id: sightingId,
            comment_text: commentText,
            created_at: new Date().toISOString(),
            username: Auth?.getCurrentUser?.()?.name || 'You'
        });
        localStorage.setItem('sighting_comments', JSON.stringify(allLocal));
        return allLocal[sightingId][0];
    }

    // Animals endpoints
    async getAnimals() {
        const result = await this.request('/animals?limit=300');
        if (result && Array.isArray(result.animals)) return result.animals;
        if (Array.isArray(result)) return result;
        if (result && result.success && result.data) return result.data;
        return JSON.parse(localStorage.getItem('offline_animals') || '[]');
    }

    async getAnimalById(id) {
        const result = await this.request(`/animals/${id}`);
        if (result?.animal_id) return result;
        if (result && result.success && result.data) return result.data;
        const animals = await this.getAnimals();
        return animals.find((a) => a.animal_id == id || a.id == id);
    }

    async searchAnimals(query, limit = 40) {
        const q = encodeURIComponent(String(query || '').trim());
        if (!q) return [];
        const result = await this.request(`/animals?search=${q}&limit=${limit}`);
        if (result && Array.isArray(result.animals)) return result.animals;
        if (Array.isArray(result)) return result;
        return [];
    }

    async getAdminPendingContent() {
        const result = await this.request('/admin/content/pending');
        return Array.isArray(result?.pending) ? result.pending : [];
    }

    async approveAdminContent(id, status, notes = '') {
        const result = await this.request(`/admin/content/${id}/approve`, {
            method: 'POST',
            body: JSON.stringify({ status, notes })
        });
        return result?.success ? result : null;
    }

    async verifyCulturalNarrative(id, verified = true) {
        const result = await this.request(`/cultural/${id}/verify`, {
            method: 'PUT',
            body: JSON.stringify({ verified })
        });
        return result?.success ? result : null;
    }

    async publishCulturalNarrative(id) {
        const result = await this.request(`/cultural/${id}/publish`, { method: 'POST' });
        return result?.success ? result : null;
    }

    async getUserBookmarks() {
        const result = await this.request('/users/bookmarks');
        return result?.success && Array.isArray(result.bookmarks) ? result.bookmarks : null;
    }

    async syncUserBookmarks(bookmarks) {
        const result = await this.request('/users/bookmarks/sync', {
            method: 'PUT',
            body: JSON.stringify({ bookmarks })
        });
        return result?.success ? result.bookmarks : null;
    }

    async addUserBookmark(row) {
        const result = await this.request('/users/bookmarks', {
            method: 'POST',
            body: JSON.stringify(row)
        });
        return result?.success ? result.bookmark : null;
    }

    async removeUserBookmark(type, id) {
        const result = await this.request(`/users/bookmarks/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, {
            method: 'DELETE'
        });
        return result?.success;
    }

    async getUserNotifications(limit = 40) {
        const result = await this.request(`/users/me/notifications?limit=${limit}`);
        if (result?.success) {
            return { notifications: result.notifications || [], unread: result.unread_count || 0 };
        }
        return { notifications: [], unread: 0 };
    }

    async markNotificationRead(id) {
        return this.request(`/users/me/notifications/${id}/read`, { method: 'PUT' });
    }

    async markAllNotificationsRead() {
        return this.request('/users/me/notifications/read-all', { method: 'PUT' });
    }

    async getWalkingRoute(fromLat, fromLng, toLat, toLng) {
        const q = `from_lat=${fromLat}&from_lng=${fromLng}&to_lat=${toLat}&to_lng=${toLng}`;
        return this.request(`/geo/walking-route?${q}`);
    }

    async saveTourCompletionReport(tourId, guideNotes, status = 'draft') {
        return this.request(`/tours/${tourId}/completion-report`, {
            method: 'PUT',
            body: JSON.stringify({ guide_notes: guideNotes, status })
        });
    }

    async createAdminUser(payload) {
        return this.request('/admin/users', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

    async updateAdminUser(userId, payload) {
        return this.request(`/admin/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
    }

    async getAdminAuditLogs(limit = 50) {
        const result = await this.request(`/admin/audit-logs?limit=${limit}`);
        return result?.logs || [];
    }

    async getAdminSystemHealth() {
        return this.request('/admin/system-health');
    }

    async createAdminLocation(payload) {
        return this.request('/admin/locations', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
    }

    async updateAdminLocation(locationId, payload) {
        const id = encodeURIComponent(String(locationId || '').trim());
        return this.request(`/admin/locations/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
    }

    async deleteAdminLocation(locationId) {
        const id = encodeURIComponent(String(locationId || '').trim());
        return this.request(`/admin/locations/${id}`, { method: 'DELETE' });
    }

    async getAdminFaqs() {
        const result = await this.request('/admin/faqs');
        return Array.isArray(result?.faqs) ? result.faqs : [];
    }

    async createAdminFaq(payload) {
        return this.request('/admin/faqs', { method: 'POST', body: JSON.stringify(payload) });
    }

    async updateAdminFaq(faqId, payload) {
        return this.request(`/admin/faqs/${encodeURIComponent(faqId)}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
    }

    async getAdminSafetyTips() {
        const result = await this.request('/admin/safety-tips');
        return Array.isArray(result?.tips) ? result.tips : [];
    }

    async createAdminSafetyTip(payload) {
        return this.request('/admin/safety-tips', { method: 'POST', body: JSON.stringify(payload) });
    }

    async updateAdminSafetyTip(tipId, payload) {
        return this.request(`/admin/safety-tips/${encodeURIComponent(tipId)}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
    }

    async getAdminAlertRules() {
        const result = await this.request('/admin/alert-rules');
        return Array.isArray(result?.rules) ? result.rules : [];
    }

    async createAdminAlertRule(payload) {
        return this.request('/admin/alert-rules', { method: 'POST', body: JSON.stringify(payload) });
    }

    async updateAdminAlertRule(ruleId, payload) {
        return this.request(`/admin/alert-rules/${encodeURIComponent(ruleId)}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
    }

    /** Wildlife theme tiles: guide session scripts (migration 009 + seed 004). */
    async getWildlifeTourThemes() {
        const result = await this.request('/wildlife-tour-themes');
        if (result?.themes && Array.isArray(result.themes)) {
            try {
                localStorage.setItem('offline_wildlife_themes', JSON.stringify(result.themes));
            } catch (_) {
                /**/
            }
            return result.themes;
        }
        return JSON.parse(localStorage.getItem('offline_wildlife_themes') || '[]');
    }

    async getWildlifeTourThemeBySlug(slug) {
        const s = String(slug || '').trim().toLowerCase();
        if (!s) return null;
        const result = await this.request(`/wildlife-tour-themes/${encodeURIComponent(s)}`);
        if (result?.theme?.slug || result?.theme?.theme_id) {
            try {
                const raw = JSON.parse(localStorage.getItem('offline_wildlife_themes') || '[]');
                const list = Array.isArray(raw) ? raw : [];
                const idx = list.findIndex((t) => t.slug === result.theme.slug);
                if (idx >= 0) list[idx] = result.theme;
                else list.push(result.theme);
                localStorage.setItem('offline_wildlife_themes', JSON.stringify(list));
            } catch (_) {
                /**/
            }
            return result.theme;
        }
        const cached = JSON.parse(localStorage.getItem('offline_wildlife_themes') || '[]');
        return Array.isArray(cached) ? cached.find((t) => t.slug === s) || null : null;
    }

    /** Full cultural narrative (English content path). */
    async getCulturalNarrativeById(id) {
        const result = await this.request(`/cultural/${id}`);
        if (result?.narrative_id) return result;
        if (result && result.success && result.data) return result.data;
        return null;
    }

    // Locations endpoints
    async getLocations() {
        const result = await this.request('/locations');
        if (result?.locations?.length) return result.locations;
        if (Array.isArray(result) && result.length) return result;
        if (result?.success && Array.isArray(result.data) && result.data.length) return result.data;
        try {
            const pub = await fetch(`${getSigtsApiBaseUrl()}/locations/public`, { cache: 'no-store' });
            if (pub.ok) {
                const body = await pub.json();
                if (body?.locations?.length) {
                    try {
                        localStorage.setItem('offline_locations', JSON.stringify(body.locations));
                    } catch (_) {
                        /**/
                    }
                    return body.locations;
                }
            }
        } catch (_) {
            /**/
        }
        try {
            const raw = localStorage.getItem('offline_locations');
            const parsed = raw ? JSON.parse(raw) : [];
            if (Array.isArray(parsed) && parsed.length) return parsed;
        } catch (_) {
            /**/
        }
        return Array.isArray(window.BWINDI_MAP_FALLBACK_LOCATIONS) ? window.BWINDI_MAP_FALLBACK_LOCATIONS : [];
    }

    async getLocationById(id) {
        const sid = encodeURIComponent(String(id || '').trim());
        if (!sid) return null;
        const result = await this.request(`/locations/${sid}`);
        if (result?.location_id) return result;
        const list = await this.getLocations();
        return Array.isArray(list)
            ? list.find((loc) => String(loc.location_id || loc.id || '') === String(id))
            : null;
    }

    /** §3.1.1.3 visitor catalogue (public endpoints; cached offline below). */
    async getFaqs(category) {
        const qs = category ? `?category=${encodeURIComponent(category)}` : '';
        const result = await this.request(`/faqs${qs}`);
        if (result?.faqs && Array.isArray(result.faqs)) {
            try {
                localStorage.setItem('offline_faqs_cache', JSON.stringify(result.faqs));
            } catch (_) {
                /**/
            }
            return result.faqs;
        }
        try {
            const raw = localStorage.getItem('offline_faqs_cache');
            return raw ? JSON.parse(raw) : [];
        } catch (_) {
            return [];
        }
    }

    async markFaqHelpful(faqId) {
        return this.request(`/faqs/${encodeURIComponent(String(faqId))}/helpful`, {
            method: 'POST'
        });
    }

    async getSafetyTips(category) {
        const qs = category ? `?category=${encodeURIComponent(category)}` : '';
        const result = await this.request(`/safety-tips${qs}`);
        if (result?.tips && Array.isArray(result.tips)) {
            try {
                localStorage.setItem('offline_safety_tips_cache', JSON.stringify(result.tips));
            } catch (_) {
                /**/
            }
            return result.tips;
        }
        try {
            const raw = localStorage.getItem('offline_safety_tips_cache');
            return raw ? JSON.parse(raw) : [];
        } catch (_) {
            return [];
        }
    }

    async getTouristBiodiversity() {
        const result = await this.request('/tourist-biodiversity');
        if (result?.species && Array.isArray(result.species)) {
            try {
                localStorage.setItem('offline_tourist_biodiversity_cache', JSON.stringify(result));
            } catch (_) {
                /**/
            }
            return result;
        }
        try {
            const raw = localStorage.getItem('offline_tourist_biodiversity_cache');
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    }

    async getStayingSafeGuide() {
        const result = await this.request('/staying-safe-guide');
        if (result?.sections && Array.isArray(result.sections)) {
            try {
                localStorage.setItem('offline_staying_safe_guide_cache', JSON.stringify(result));
            } catch (_) {
                /**/
            }
            return result;
        }
        try {
            const raw = localStorage.getItem('offline_staying_safe_guide_cache');
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    }

    async getPublicRoutes() {
        const result = await this.request('/routes/public');
        if (result?.routes && Array.isArray(result.routes)) {
            try {
                localStorage.setItem('offline_public_routes_cache', JSON.stringify(result));
            } catch (_) {
                /**/
            }
            return result.routes;
        }
        try {
            const raw = localStorage.getItem('offline_public_routes_cache');
            const parsed = raw ? JSON.parse(raw) : null;
            return parsed?.routes && Array.isArray(parsed.routes) ? parsed.routes : [];
        } catch (_) {
            return [];
        }
    }

    async getParkGuide(category) {
        const qs = category ? `?category=${encodeURIComponent(category)}` : '';
        const result = await this.request(`/park-guide${qs}`);
        if (result?.items && Array.isArray(result.items)) {
            try {
                localStorage.setItem('offline_park_guide_cache', JSON.stringify(result.items));
            } catch (_) {
                /**/
            }
            return result.items;
        }
        try {
            const raw = localStorage.getItem('offline_park_guide_cache');
            return raw ? JSON.parse(raw) : [];
        } catch (_) {
            return [];
        }
    }

    async getContentCatalogMeta() {
        const result = await this.request('/content-catalog-meta');
        if (result?.updated_at || result?.counts) {
            try {
                localStorage.setItem('offline_catalog_meta_cache', JSON.stringify(result));
            } catch (_) {
                /**/
            }
            return result;
        }
        try {
            const raw = localStorage.getItem('offline_catalog_meta_cache');
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    }

    /** Weather capsule for dashboard / Info tab (offline-friendly fallback inside ContentManager too). */
    async getParkWeatherForecast() {
        const result = await this.request('/weather');
        if (result?.success && result.data) return result.data;
        return null;
    }

    // Cultural stories endpoints
    async getCulturalStories() {
        const result = await this.request('/cultural');
        if (result?.stories) return result.stories;
        if (Array.isArray(result)) return result;
        if (result && result.success && result.data) return result.data;
        return JSON.parse(localStorage.getItem('cultural_stories') || '[]');
    }

    // Tour endpoints
    async getToursForGuide() {
        const result = await this.request('/tours/schedule');
        if (Array.isArray(result)) return result;
        if (result && result.success && result.data) return result.data;
        try {
            const tours = JSON.parse(localStorage.getItem('tour_sessions') || '[]');
            const guideId = AppState.currentUser?.user_id;
            return Array.isArray(tours) ? tours.filter((t) => t.guide_id === guideId) : [];
        } catch (_) {
            return [];
        }
    }

    async getTourScheduleView(mode = 'daily', anchor = '') {
        const qs = new URLSearchParams();
        if (mode) qs.set('mode', mode);
        if (anchor) qs.set('anchor', anchor);
        return this.request(`/tours/schedule-view?${qs.toString()}`);
    }

    async startTour(tourId, location) {
        const result = await this.request(`/tours/${tourId}/start`, {
            method: 'PUT',
            body: JSON.stringify({
                current_lat: location?.lat ?? AppState.currentLocation?.lat,
                current_lng: location?.lng ?? AppState.currentLocation?.lng
            })
        });
        if (result && result.success) return result;
        const tours = JSON.parse(localStorage.getItem('tour_sessions') || '[]');
        const tour = tours.find(t => t.tour_session_id === tourId);
        if (tour) {
            tour.status = 'ongoing';
            tour.actual_start = new Date().toISOString();
            localStorage.setItem('tour_sessions', JSON.stringify(tours));
        }
        return tour;
    }

    async endTour(tourId, endLocation) {
        const result = await this.request(`/tours/${tourId}/end`, {
            method: 'PUT',
            body: JSON.stringify({
                current_lat: endLocation?.lat ?? AppState.currentLocation?.lat,
                current_lng: endLocation?.lng ?? AppState.currentLocation?.lng
            })
        });
        if (result && result.success) return result;
        const tours = JSON.parse(localStorage.getItem('tour_sessions') || '[]');
        const tour = tours.find(t => t.tour_session_id === tourId);
        if (tour) {
            tour.status = 'completed';
            tour.actual_end = new Date().toISOString();
            localStorage.setItem('tour_sessions', JSON.stringify(tours));
        }
        return tour;
    }

    async getTourById(tourId) {
        const result = await this.request(`/tours/${tourId}`);
        if (result?.tour_session_id) return result;
        return null;
    }

    async updateTourLocation(tourId, lat, lng) {
        const result = await this.request(`/tours/${tourId}/location`, {
            method: 'POST',
            body: JSON.stringify({ lat, lng })
        });
        return !!result?.success;
    }

    async addTourNote(tourId, notes) {
        const result = await this.request(`/tours/${tourId}/notes`, {
            method: 'POST',
            body: JSON.stringify({ notes })
        });
        return !!result?.success;
    }

    async getTourPreparation(tourId) {
        return this.request(`/tours/${encodeURIComponent(tourId)}/preparation`);
    }

    async getTourGuestList(tourId) {
        return this.request(`/tours/${encodeURIComponent(tourId)}/guest-list`);
    }

    async getGuestProfileForGuide(touristId) {
        return this.request(`/tours/guests/${encodeURIComponent(touristId)}/profile`);
    }

    async getActiveTourMode(tourId) {
        return this.request(`/tours/${encodeURIComponent(tourId)}/active-mode`);
    }

    async getTourCompletionReport(tourId) {
        return this.request(`/tours/${encodeURIComponent(tourId)}/completion-report`);
    }

    async getGuideShiftStatus() {
        return this.request('/tours/guide/shifts/status');
    }

    async clockInGuideShift() {
        return this.request('/tours/guide/shifts/clock-in', { method: 'POST', body: JSON.stringify({}) });
    }

    async clockOutGuideShift() {
        return this.request('/tours/guide/shifts/clock-out', { method: 'POST', body: JSON.stringify({}) });
    }

    async getGuideProfile() {
        return this.request('/tours/guide/profile');
    }

    async getGuidePerformance(start = '', end = '') {
        const qs = new URLSearchParams();
        if (start) qs.set('start', start);
        if (end) qs.set('end', end);
        return this.request(`/tours/guide/performance?${qs.toString()}`);
    }

    async getGuideEmergencyContacts() {
        return this.request('/tours/guide/emergency-contacts');
    }

    async listTourGuidesForAssignment() {
        return this.request('/tours/guides');
    }

    async listTourRoutesForAssignment() {
        return this.request('/tours/routes');
    }

    async createTourAssignment(payload) {
        return this.request('/tours/assignments', {
            method: 'POST',
            body: JSON.stringify(payload || {})
        });
    }

    async createWeeklyTourAssignments(payload) {
        return this.request('/tours/assignments/weekly', {
            method: 'POST',
            body: JSON.stringify(payload || {})
        });
    }

    async listTourAssignments({ start = '', end = '', guide_user_id = '', status = '' } = {}) {
        const qs = new URLSearchParams();
        if (start) qs.set('start', start);
        if (end) qs.set('end', end);
        if (guide_user_id) qs.set('guide_user_id', guide_user_id);
        if (status) qs.set('status', status);
        return this.request(`/tours/assignments?${qs.toString()}`);
    }

    // Analytics endpoints (IT Manager)
    async getVisitorFlowAnalytics(start, end, interval = 'day') {
        const result = await this.request(`/analytics/visitor-flow?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&interval=${encodeURIComponent(interval)}`);
        return result || null;
    }

    async getCongestionPredictions(date) {
        const result = await this.request(`/analytics/predictions/congestion?date=${encodeURIComponent(date)}`);
        return result || null;
    }

    async getAnalyticsDashboard(start, end, date) {
        const qs = new URLSearchParams();
        if (start) qs.set('start', start);
        if (end) qs.set('end', end);
        if (date) qs.set('date', date);
        const suffix = qs.toString() ? `?${qs.toString()}` : '';
        const result = await this.request(`/analytics/dashboard${suffix}`);
        return result || null;
    }

    async getPeakTimes(start, end) {
        const qs = new URLSearchParams();
        if (start) qs.set('start', start);
        if (end) qs.set('end', end);
        const result = await this.request(`/analytics/peak-times?${qs.toString()}`);
        return result || null;
    }

    async getResourceAllocation(date, locationId = '') {
        const qs = new URLSearchParams();
        if (date) qs.set('date', date);
        if (locationId) qs.set('location_id', locationId);
        const result = await this.request(`/analytics/resource-allocation?${qs.toString()}`);
        return result || null;
    }

    async getSightingsTrends(start, end, animalId = '') {
        const qs = new URLSearchParams();
        if (start) qs.set('start', start);
        if (end) qs.set('end', end);
        if (animalId) qs.set('animal_id', animalId);
        const result = await this.request(`/analytics/sightings-trends?${qs.toString()}`);
        return result || null;
    }

    async getPopularContent(limit = 10) {
        const result = await this.request(`/analytics/popular-content?limit=${limit}`);
        if (Array.isArray(result)) return result;
        return [];
    }

    async getSatisfactionAnalytics(startIso = '', endIso = '') {
        const qs = new URLSearchParams();
        if (startIso) qs.set('start', startIso);
        if (endIso) qs.set('end', endIso);
        const suffix = qs.toString() ? `?${qs}` : '';
        const result = await this.request(`/analytics/satisfaction${suffix}`);
        return result || null;
    }

    async getDemographicsAnalytics() {
        const result = await this.request('/analytics/demographics');
        return result || null;
    }

    async getAdminActiveUsers(windowMinutes = 5) {
        const result = await this.request(`/admin/active-users?window_minutes=${encodeURIComponent(windowMinutes)}`);
        return result || { count: 0, users: [] };
    }

    /** IT dashboard: full user directory with server-side aggregates (all rows up to 500). */
    async getAdminUserDirectory() {
        const result = await this.request('/admin/users/directory', {}, { timeoutMs: 20000 });
        if (!result || result.error) {
            return {
                users: [],
                total: 0,
                loaded: 0,
                complete: false,
                stats: null,
                error: result?.error || 'Failed to load user directory'
            };
        }
        return {
            users: Array.isArray(result.users) ? result.users : [],
            total: Number(result.total) || 0,
            loaded: Number(result.loaded) || (Array.isArray(result.users) ? result.users.length : 0),
            complete: result.complete !== false,
            stats: result.stats || null,
            generated_at: result.generated_at || null,
            error: null
        };
    }

    async pingPresence() {
        const coords = this.getLiveCoordinates();
        const body = coords ? JSON.stringify({ lat: coords.lat, lng: coords.lng }) : undefined;
        const token = this.getToken();
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        if (coords) {
            headers['x-user-lat'] = String(coords.lat);
            headers['x-user-lng'] = String(coords.lng);
        }
        try {
            const response = await fetch(`${getSigtsApiBaseUrl()}/auth/presence`, {
                method: 'POST',
                headers,
                body: body || '{}'
            });
            const raw = await response.text();
            let payload = null;
            try {
                payload = raw ? JSON.parse(raw) : null;
            } catch {
                payload = { error: raw };
            }
            if (!response.ok) {
                return { ...(payload && typeof payload === 'object' ? payload : {}), error: payload?.error || `HTTP ${response.status}`, status: response.status };
            }
            return payload;
        } catch (error) {
            return { error: error?.message || 'Network error', network: true };
        }
    }

    async getAdminAuditLogs(limit = 100) {
        const result = await this.request(`/admin/audit-logs?limit=${encodeURIComponent(limit)}`);
        if (Array.isArray(result?.logs)) return result.logs;
        return [];
    }

    async getAdminSystemHealth() {
        const result = await this.request('/admin/system-health');
        return result || null;
    }

    async getAdminSchemaStatus() {
        const result = await this.request('/admin/schema-status');
        return result?.status || {};
    }

    /** Self-service: sets `is_active` false and sends activity email when configured (POST /api/auth/deactivate). */
    async deactivateMyAccount() {
        return this.request('/auth/deactivate', {
            method: 'POST',
            body: JSON.stringify({ confirm: true })
        });
    }

    /** IT desk: deactivate another user (PUT /api/admin/users/:id/deactivate). */
    async adminDeactivateUser(userId) {
        const id = encodeURIComponent(String(userId || '').trim());
        if (!id) return { success: false, error: 'User id required' };
        return this.request(`/admin/users/${id}/deactivate`, { method: 'PUT' });
    }

    // Sync queue
    async syncOfflineData(pendingItems) {
        const result = await this.request('/sync/upload', {
            method: 'POST',
            body: JSON.stringify({ items: pendingItems })
        });
        if (!result?.success) {
            return {
                success: false,
                error: result?.error || 'Sync upload was rejected by the server.',
                results: result?.results || []
            };
        }
        const rows = Array.isArray(result.results) ? result.results : [];
        const failures = rows.filter((r) => r && r.success === false);
        return {
            success: failures.length === 0,
            processed: result.processed,
            failures,
            results: rows,
            partial: failures.length > 0
        };
    }

    // Health check
    async checkHealth() {
        try {
            const response = await fetch(`${getSigtsApiBaseUrl()}/health`);
            return response.ok;
        } catch {
            return false;
        }
    }

    // Feedback loop endpoints
    async submitFeedback(payload) {
        const result = await this.request('/feedback', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        if (result?.success && result.feedback) {
            return { success: true, feedback: result.feedback };
        }
        const msg =
            (Array.isArray(result?.errors) && result.errors.length
                ? result.errors.map((e) => e.msg || e.message || JSON.stringify(e)).join(' ')
                : null) ||
            result?.error ||
            (result?.status ? `Request failed (${result.status})` : 'Could not submit feedback');
        return { success: false, error: msg, errors: result?.errors, status: result?.status };
    }

    async getMyFeedback(limit = 20) {
        const result = await this.request(`/feedback/mine?limit=${limit}`);
        if (result?.success && Array.isArray(result.feedback)) return result.feedback;
        return JSON.parse(localStorage.getItem('feedback') || '[]').slice(0, limit);
    }

    async getFeedbackDashboard(days = 30) {
        const result = await this.request(`/feedback/dashboard?days=${days}`);
        return result?.success ? result : null;
    }

    async getManagerFeedbackQueue({ days = 30, limit = 60, category = '', status = '' } = {}) {
        const params = new URLSearchParams();
        params.set('days', String(days));
        params.set('limit', String(limit));
        if (category) params.set('category', category);
        if (status) params.set('status', status);
        const result = await this.request(`/feedback/manager?${params.toString()}`);
        if (result?.success && Array.isArray(result.feedback)) return result.feedback;
        return [];
    }

    async respondToFeedback(feedbackId, responseText) {
        const result = await this.request(`/feedback/${feedbackId}/respond`, {
            method: 'PUT',
            body: JSON.stringify({ response_text: responseText })
        });
        return result?.success ? result.feedback : null;
    }

    async updateFeedbackStatus(feedbackId, improvementStatus, improvementNotes = '') {
        const result = await this.request(`/feedback/${feedbackId}/status`, {
            method: 'PUT',
            body: JSON.stringify({
                improvement_status: improvementStatus,
                improvement_notes: improvementNotes || null
            })
        });
        return result?.success ? result.feedback : null;
    }

    // ---- User Acceptance Testing (SUS instrument) ----
    async getUatInstrument() {
        const result = await this.request('/uat/instrument');
        if (result?.success && Array.isArray(result.items)) return result;
        return null;
    }

    async getMyUatResponse() {
        const result = await this.request('/uat/mine');
        return result?.success ? (result.response || null) : null;
    }

    async submitUatResponse(payload) {
        const result = await this.request('/uat/responses', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        if (result?.success) {
            return { success: true, sus_score: result.sus_score, grade: result.grade, response: result.response };
        }
        const msg =
            (Array.isArray(result?.errors) && result.errors.length
                ? result.errors.map((e) => e.msg || e.message || JSON.stringify(e)).join(' ')
                : null) ||
            result?.error ||
            (result?.status ? `Request failed (${result.status})` : 'Could not submit UAT response');
        return { success: false, error: msg, errors: result?.errors, status: result?.status };
    }

    async getUatResults() {
        const result = await this.request('/uat/results');
        return result?.success ? result : null;
    }

    // User profile (GET /api/users/profile)
    async fetchUserProfile() {
        const result = await this.request('/users/profile');
        if (result?.error || result?.status >= 400) return null;
        return result;
    }

    // User profile updates (preferences)
    async updateUserProfile(payload) {
        const result = await this.request('/users/profile', {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
        return result;
    }

    /** Base origin for `/uploads/...` paths (API base without trailing `/api`). */
    getPublicAssetBaseUrl() {
        const base = String(API_BASE_URL || '').replace(/\/api\/?$/i, '');
        return base || (typeof window !== 'undefined' ? window.location.origin : '');
    }

    /** Resolve stored profile/media paths to an absolute URL for `<img src>`. */
    resolvePublicMediaUrl(maybeRelativePath) {
        const s = String(maybeRelativePath || '').trim();
        if (!s) return '';
        if (/^data:/i.test(s)) return s;
        if (/^https?:\/\//i.test(s)) return s;
        if (s.startsWith('/')) return `${this.getPublicAssetBaseUrl()}${s}`;
        return s;
    }

    async uploadUserProfilePhoto(file) {
        if (!file) return { error: 'No file' };
        const fd = new FormData();
        fd.append('profile_pic', file);
        return this.request('/users/profile/photo', { method: 'POST', body: fd });
    }

    async getMyConsents() {
        const result = await this.request('/users/me/consents');
        if (Array.isArray(result?.consents)) return result.consents;
        return [];
    }

    async setMyConsent(consentType, granted, policyVersion = 'v1') {
        return this.request('/users/me/consents', {
            method: 'POST',
            body: JSON.stringify({
                consent_type: String(consentType || '').trim(),
                granted: Boolean(granted),
                policy_version: policyVersion
            })
        });
    }

    async getSightingsHeatmap(filters = {}) {
        const qs = new URLSearchParams();
        if (filters.animal_id) qs.set('animal_id', filters.animal_id);
        if (filters.limit) qs.set('limit', String(filters.limit));
        const result = await this.request(`/sightings/heatmap?${qs.toString()}`);
        if (result?.points) return result;
        return { points: [], generated_at: null };
    }

    async geoDistance(fromLat, fromLng, toLat, toLng) {
        const q = `from_lat=${encodeURIComponent(fromLat)}&from_lng=${encodeURIComponent(fromLng)}&to_lat=${encodeURIComponent(toLat)}&to_lng=${encodeURIComponent(toLng)}`;
        return this.request(`/geo/distance?${q}`);
    }

    async geoBearing(fromLat, fromLng, toLat, toLng) {
        const q = `from_lat=${encodeURIComponent(fromLat)}&from_lng=${encodeURIComponent(fromLng)}&to_lat=${encodeURIComponent(toLat)}&to_lng=${encodeURIComponent(toLng)}`;
        return this.request(`/geo/bearing?${q}`);
    }

    async getGuideMessagePeers() {
        const result = await this.request('/guides/messages/peers');
        return Array.isArray(result?.peers) ? result.peers : [];
    }

    async getGuideMessages(box = 'inbox') {
        const result = await this.request(`/guides/messages?box=${encodeURIComponent(box)}&limit=60`);
        return Array.isArray(result?.messages) ? result.messages : [];
    }

    async sendGuideMessage(toUserId, body) {
        return this.request('/guides/messages', {
            method: 'POST',
            body: JSON.stringify({ to_user_id: toUserId, body })
        });
    }

    async getAnalyticsOperationsStatus() {
        return this.request('/analytics/operations/status');
    }

    async getAdminOperationalSnapshot(windowMinutes = 5) {
        return this.request(
            `/admin/operational-snapshot?window_minutes=${encodeURIComponent(windowMinutes)}`,
            {},
            { timeoutMs: 12000 }
        );
    }

    async getOperationalSummary(days = 14) {
        const d = Math.min(90, Math.max(7, Number(days) || 14));
        return this.request(`/analytics/operational-summary?days=${d}`, {}, { timeoutMs: 20000 });
    }

    async getAnalyticsAnomalies(z = 2.5) {
        const result = await this.request(`/analytics/anomalies?z=${encodeURIComponent(z)}`);
        return result || { anomalies: [] };
    }

    async queuePredictiveTrainingJob(modelKey = 'congestion_v1') {
        return this.request('/analytics/models/retrain-job', {
            method: 'POST',
            body: JSON.stringify({ model_key: modelKey })
        });
    }

    async buildAnalyticsReport(metrics = []) {
        return this.request('/analytics/reports/build', {
            method: 'POST',
            body: JSON.stringify({ metrics })
        });
    }

    async buildAnalyticsReportAdvanced(metrics = [], start = '', end = '', reportType = 'custom') {
        return this.request('/analytics/reports/build', {
            method: 'POST',
            body: JSON.stringify({
                metrics,
                start: start || undefined,
                end: end || undefined,
                report_type: reportType
            })
        });
    }

    async listReportSchedules() {
        return this.request('/analytics/reports/schedules');
    }

    async createReportSchedule(payload) {
        return this.request('/analytics/reports/schedules', {
            method: 'POST',
            body: JSON.stringify(payload || {})
        });
    }

    async runReportSchedule(scheduleId) {
        return this.request(`/analytics/reports/schedules/${encodeURIComponent(scheduleId)}/run`, {
            method: 'POST'
        });
    }

    async getAnalyticsReportHistory() {
        return this.request('/analytics/reports/history');
    }

    async exportAnalyticsData(metrics = [], start = '', end = '', format = 'json') {
        const qs = new URLSearchParams();
        if (metrics?.length) qs.set('metrics', metrics.join(','));
        if (start) qs.set('start', start);
        if (end) qs.set('end', end);
        if (format) qs.set('format', format);
        return this.request(`/analytics/reports/export?${qs.toString()}`);
    }

    async exportAnalyticsDataRaw(metrics = [], start = '', end = '', format = 'csv') {
        const qs = new URLSearchParams();
        if (metrics?.length) qs.set('metrics', metrics.join(','));
        if (start) qs.set('start', start);
        if (end) qs.set('end', end);
        if (format) qs.set('format', format);
        return this.requestRaw(`/analytics/reports/export?${qs.toString()}`);
    }

    async listRetrainJobs() {
        return this.request('/analytics/models/retrain-job');
    }

    async completeRetrainJob(jobId, status, message = '') {
        return this.request(`/analytics/models/retrain-job/${encodeURIComponent(jobId)}/complete`, {
            method: 'POST',
            body: JSON.stringify({ status, message: message || undefined })
        });
    }

    async listBackupRecords() {
        const result = await this.request('/admin/backup/list');
        return result || { backups: [] };
    }

    async createBackupRecord() {
        const result = await this.request('/admin/backup/create', {
            method: 'POST',
            body: JSON.stringify({})
        });
        return result || null;
    }

    async bulkImportAnimals(animals) {
        return this.request('/admin/animals/bulk-json', {
            method: 'POST',
            body: JSON.stringify({ animals })
        });
    }

    /** Tour help LLM status (model name, grounding tables) — requires auth. */
    async getAiChatStatus() {
        try {
            return await this.request('/ai/status');
        } catch (_) {
            return { success: false, llm_configured: false };
        }
    }
}

// Create global API instance
const API = new APIService();

const AppState = {
    currentUser: null,
    authToken: localStorage.getItem('token'),
    currentView: 'dashboard',
    currentLocation: null,
    offlineMode: !navigator.onLine,
    syncQueue: [],
    offlineStorage: {
        used: 0,
        max: 500,
        animals: [],
        locations: [],
        cultural: []
    },
    userPreferences: {
        language: 'en',
        theme: localStorage.getItem('theme') || 'light',
        offlineMode: localStorage.getItem('offlineMode') === 'true',
        notifications: true,
        batterySaveMode: false
    },
    cachedContent: {
        version: parseInt(localStorage.getItem('offline_version') || '1')
    },
    systemMetrics: {
        activeUsers: 0,
        syncQueueSize: 0,
        storageUsed: 0,
        locationUpdates: 0,
        apiCalls: 0
    },
    // Intranet specific extensions
    internalAnnouncements: [],
    inventoryItems: [],
    hrStats: { totalStaff: 0, guidesOnDuty: 0, itStaff: 0 },
    accessContext: {
        isIntranet: null,
        insideBoundary: null,
        accessGranted: null,
        source: 'live',
        mode: 'demo',
        reason: '',
        ip: null,
        lastUpdatedAt: null
    }
};

let API_URL = getSigtsApiBaseUrl();
window.ensureSigtsApiReachable = ensureSigtsApiReachable;
window.getSigtsApiBaseUrl = getSigtsApiBaseUrl;
