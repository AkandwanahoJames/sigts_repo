// =====================================================
// SIGTS - SMART INFORMATION GUIDE TOUR SYSTEM
// BWINDI IMPENETRABLE NATIONAL PARK
// =====================================================
// APP STATE MANAGEMENT (Extended for Intranet)
// =====================================================

<<<<<<< HEAD
const API_BASE_URL = (() => {
    const configuredBase = window.__SIGTS_API_BASE__;
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
=======
function resolveApiBaseUrl() {
    const explicit = window.localStorage?.getItem('sigts_api_base_url');
    if (explicit) return explicit.replace(/\/$/, '');
    const configured = window.__SIGTS_API_BASE_URL__;
    if (configured) return String(configured).replace(/\/$/, '');
    const protocol = window.location.protocol || 'http:';
    const hostname = window.location.hostname || 'localhost';
    return `${protocol}//${hostname}:8000/api`;
}

const API_BASE_URL = resolveApiBaseUrl();
>>>>>>> upstream/master

class APIService {
    getToken() {
        return localStorage.getItem('token') || sessionStorage.getItem('token');
    }

    setToken(token) {
        if (token) {
            this.token = token;
        }
    }

    async request(endpoint, options = {}) {
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

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                ...options,
                headers
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
            console.error(`API Error (${endpoint}):`, error);
            // Fallback to localStorage if API fails
            return null;
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
        const result = await this.request('/animals');
        if (result?.animals) return result.animals;
        if (Array.isArray(result)) return result;
        if (result && result.success && result.data) return result.data;
        return JSON.parse(localStorage.getItem('offline_animals') || '[]');
    }

    async getAnimalById(id) {
        const result = await this.request(`/animals/${id}`);
        if (result?.animal_id) return result;
        if (result && result.success && result.data) return result.data;
        const animals = await this.getAnimals();
        return animals.find(a => a.id == id);
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

    // Analytics endpoints (IT Manager)
    async getVisitorFlowAnalytics(start, end, interval = 'day') {
        const result = await this.request(`/analytics/visitor-flow?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&interval=${encodeURIComponent(interval)}`);
        return result || null;
    }

    async getCongestionPredictions(date) {
        const result = await this.request(`/analytics/predictions/congestion?date=${encodeURIComponent(date)}`);
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

    async respondToFeedback(feedbackId, responseText) {
        const result = await this.request(`/feedback/${feedbackId}/respond`, {
            method: 'PUT',
            body: JSON.stringify({ response_text: responseText })
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
        language: localStorage.getItem('language') || 'en',
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
    hrStats: { totalStaff: 0, guidesOnDuty: 0, itStaff: 0 }
};

const API_URL = API_BASE_URL;
