// =====================================================
// SIGTS - SMART INFORMATION GUIDE TOUR SYSTEM
// BWINDI IMPENETRABLE NATIONAL PARK
// =====================================================
// APP STATE MANAGEMENT (Extended for Intranet)
// =====================================================

const RUNTIME_CONFIG = window.__SIGTS_CONFIG__ || {};
const API_BASE_URL = (() => {
    const configuredBase = RUNTIME_CONFIG.API_URL || window.__SIGTS_API_BASE__;
    if (typeof configuredBase === 'string' && configuredBase.trim()) {
        return configuredBase.replace(/\/$/, '');
    }

    const host = window.location.hostname;
    const isLocalHost = host === 'localhost' || host === '127.0.0.1';
    if (isLocalHost) {
        return 'http://localhost:8000/api';
    }

    return `${window.location.origin}/api`;
})();
class APIService {
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
        }
    }

    async request(endpoint, options = {}) {
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
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
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
                if (payload && typeof payload === 'object') {
                    return { ...payload, status: response.status };
                }
                return { error: `HTTP ${response.status}`, status: response.status, raw };
            }

            return payload;
        } catch (error) {
            if (error?.name === 'AbortError') {
                console.warn(`API timeout (${endpoint}) after ${timeoutMs}ms`);
            } else {
                console.error(`API Error (${endpoint}):`, error);
            }
            return null;
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
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
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

    // Sightings endpoints
    async getRecentSightings(limit = 20) {
        const result = await this.request(`/sightings/recent?limit=${limit}`);
        if (Array.isArray(result)) return result;
        if (result && result.success && result.data) return result.data;
        // Fallback to localStorage
        return JSON.parse(localStorage.getItem('sightings') || '[]').slice(0, limit);
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

    /** UNESCO wildlife theme tiles: guide session scripts (migration 009 + seed 004). */
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

    /** Full cultural narrative (includes narrative_en narrative_local, etc.). */
    async getCulturalNarrativeById(id) {
        const result = await this.request(`/cultural/${id}`);
        if (result?.narrative_id) return result;
        if (result && result.success && result.data) return result.data;
        return null;
    }

    // Locations endpoints
    async getLocations() {
        const result = await this.request('/locations');
        if (result?.locations) return result.locations;
        if (Array.isArray(result)) return result;
        if (result && result.success && result.data) return result.data;
        return JSON.parse(localStorage.getItem('offline_locations') || '[]');
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
        const tours = JSON.parse(localStorage.getItem('tour_sessions') || '[]');
        const guideId = AppState.currentUser?.user_id;
        return tours.filter(t => t.guide_id === guideId);
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

    async getSatisfactionAnalytics() {
        const result = await this.request('/analytics/satisfaction');
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

    // Sync queue
    async syncOfflineData(pendingItems) {
        const result = await this.request('/sync/upload', {
            method: 'POST',
            body: JSON.stringify({ items: pendingItems })
        });
        return result && result.success;
    }

    // Health check
    async checkHealth() {
        try {
            const response = await fetch(`${API_BASE_URL}/health`);
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
        if (result?.success) return result.feedback;
        return null;
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

    // User profile updates (language/preferences)
    async updateUserProfile(payload) {
        const result = await this.request('/users/profile', {
            method: 'PUT',
            body: JSON.stringify(payload)
        });
        return result;
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

    async bulkImportAnimals(animals) {
        return this.request('/admin/animals/bulk-json', {
            method: 'POST',
            body: JSON.stringify({ animals })
        });
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
        language: localStorage.getItem('language') || RUNTIME_CONFIG.DEFAULT_LANGUAGE || 'en',
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

const API_URL = API_BASE_URL;
