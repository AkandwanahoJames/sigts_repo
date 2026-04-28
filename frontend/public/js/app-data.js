// =====================================================
// SIGTS - SMART INFORMATION GUIDE TOUR SYSTEM
// BWINDI IMPENETRABLE NATIONAL PARK
// =====================================================
// APP STATE MANAGEMENT (Extended for Intranet)
// =====================================================

const API_BASE_URL = 'http://localhost:8000/api';

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
        if (result && (result.sighting_id || result.success)) return result;
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

const API_URL = 'http://localhost:8000/api';
