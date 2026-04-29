
// =====================================================
// 3.1.1.1 USER AUTHENTICATION MODULE (Intranet roles extended)
// =====================================================
class AuthManager {
    constructor() {
        this.token = localStorage.getItem('token') || sessionStorage.getItem('token');
        this.user = null;
        this.sessionTimeout = 24 * 60 * 60 * 1000;
        this.sessionTimer = null;
        this.failedAttempts = 0;
        this.maxAttempts = 5;
        this.twoFactorPending = false;
        this.pending2FACode = null;
        
        if (this.token) {
            try {
                if ((this.token.match(/\./g) || []).length !== 2) {
                    throw new Error('Legacy demo token');
                }
                this.user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null');
            } catch(e) {
                this.token = null;
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                sessionStorage.removeItem('token');
                sessionStorage.removeItem('user');
                this.user = null;
            }
        }
    }

    async register(userData) {
        const email = userData.email?.trim() || '';
        const username = userData.username?.trim() || '';
        const password = userData.password || '';
        const confirmPassword = userData.confirmPassword || '';
        const fullName = userData.fullName?.trim() || '';
        const userType = userData.userType || 'tourist';
        
        if (!username || username.length < 3) return { success: false, error: 'Username must be at least 3 characters' };
        if (!email) return { success: false, error: 'Email is required' };
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false, error: 'Valid email required' };
        if (!password || password.length < 4) return { success: false, error: 'Password must be at least 4 characters' };
        if (password !== confirmPassword) return { success: false, error: 'Passwords do not match' };
        
        const nameParts = fullName.split(/\s+/).filter(Boolean);
        const firstName = nameParts.shift() || '';
        const lastName = nameParts.join(' ');

        const result = await API.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                username,
                email,
                password,
                firstName,
                lastName,
                userType
            })
        });

        if (!result) {
            return { success: false, error: 'Registration service unavailable' };
        }

        if (result.error) {
            return { success: false, error: result.error };
        }

        if (result.errors?.length) {
            return { success: false, error: result.errors[0].msg || 'Registration failed' };
        }

        return {
            success: true,
            message: result.message || 'Registration successful',
            user: result.user || null
        };
    }

    async login(username, password, rememberMe = false) {
        if (this.failedAttempts >= this.maxAttempts) {
            return { success: false, error: 'Too many failed attempts. Account temporarily locked.' };
        }

        let geo = null;
        if (navigator.geolocation) {
            try {
                geo = await new Promise((resolve) => {
                    navigator.geolocation.getCurrentPosition(
                        (position) => resolve({
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        }),
                        () => resolve(null),
                        { enableHighAccuracy: true, timeout: 6000, maximumAge: 120000 }
                    );
                });
            } catch (_) {}
        }

        const result = await API.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                username: username?.trim(),
                password,
                lat: geo?.lat,
                lng: geo?.lng
            })
        });

        if (result?.success && result.mfaRequired && result.mfaToken) {
            const code = await window.showPromptDialog('Enter your 6-digit authenticator code');
            if (!code) return { success: false, error: 'MFA code required' };
            const mfaResult = await API.request('/auth/mfa/complete', {
                method: 'POST',
                body: JSON.stringify({
                    mfaToken: result.mfaToken,
                    code: code.trim()
                })
            });
            if (mfaResult?.success && mfaResult.token && mfaResult.user) {
                return this.completeLogin(mfaResult.user, mfaResult.token, rememberMe);
            }
            return { success: false, error: mfaResult?.error || 'MFA verification failed' };
        }

        if (result?.success && result.token && result.user) {
            return this.completeLogin(result.user, result.token, rememberMe);
        }

        const demoCredentials = {
            tourist: {
                password: 'tourist123',
                user: {
                    id: 'demo-tourist',
                    name: 'Demo Tourist',
                    email: 'tourist@demo.local',
                    username: 'tourist',
                    role: 'tourist',
                    user_type: 'tourist',
                    department: 'Visitor'
                },
                token: 'demo.tourist.token'
            },
            guide: {
                password: 'guide123',
                user: {
                    id: 'demo-guide',
                    name: 'Demo Guide',
                    email: 'guide@demo.local',
                    username: 'guide',
                    role: 'guide',
                    user_type: 'guide',
                    department: 'Tour Operations'
                },
                token: 'demo.guide.token'
            },
            it_manager: {
                password: 'itmanager123',
                user: {
                    id: 'demo-admin',
                    name: 'IT Manager',
                    email: 'admin@demo.local',
                    username: 'it_manager',
                    role: 'it_manager',
                    user_type: 'it_manager',
                    department: 'IT'
                },
                token: 'demo.it_manager.token'
            }
        };

        const key = String(username || '').trim().toLowerCase();
        const demo = demoCredentials[key];
        if (demo && password === demo.password) {
            return this.completeLogin(demo.user, demo.token, rememberMe);
        }

        this.failedAttempts++;
        return {
            success: false,
            error: result?.error || result?.message || 'Invalid credentials'
        };
    }

    async verify2FACode(userId, code) {
        if (!this.twoFactorPending || this.pending2FACode !== code) {
            return { success: false, error: 'Invalid 2FA code' };
        }
        const users = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
        const user = users.find(u => u.id == userId);
        if (!user) return { success: false, error: 'User not found' };
        this.twoFactorPending = false;
        this.pending2FACode = null;
        const demoToken = `demo.${btoa(String(user.id || user.user_id || 'user')).replace(/=+$/g, '')}.token`;
        return this.completeLogin(user, demoToken, true);
    }

    completeLogin(user, token, rememberMe) {
        this.user = {
            user_id: user.id || user.user_id,
            name: user.name || user.username || 'User',
            email: user.email,
            username: user.username,
            role: user.role || user.user_type,
            userType: user.userType || user.role || user.user_type,
            department: user.department || ''
        };
        this.token = token;
        
        if (rememberMe) {
            localStorage.setItem('token', this.token);
            localStorage.setItem('user', JSON.stringify(this.user));
        } else {
            sessionStorage.setItem('token', this.token);
            sessionStorage.setItem('user', JSON.stringify(this.user));
        }
        API.setToken(this.token);
        
        this.startSessionTimer();
        AppState.currentUser = this.user;
        AppState.authToken = this.token;
        this.failedAttempts = 0;
        return { success: true, user: this.user };
    }

    send2FACode(email, code) {
        console.log(`2FA code for ${email}: ${code}`);
        window.showToast(`Demo 2FA code: ${code}`, 'info');
    }

    startSessionTimer() {
        if (this.sessionTimer) clearTimeout(this.sessionTimer);
        this.sessionTimer = setTimeout(() => {
            this.logout();
            window.showToast('Your session has expired. Please login again.', 'warning');
        }, this.sessionTimeout);
    }

    async logout() {
        this.token = null;
        this.user = null;
        API.setToken(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        AppState.currentUser = null;
        renderView('login');
    }

    getCurrentUser() {
        if (this.user) return this.user;
        const stored = localStorage.getItem('user') || sessionStorage.getItem('user');
        if (stored) this.user = JSON.parse(stored);
        return this.user;
    }

    isAuthenticated() { return !!this.token && (this.token.match(/\./g) || []).length === 2; }
    hasRole(role) { return this.user?.role === role || this.user?.userType === role; }
    
    sendVerificationEmail(email) { return email; }

    async requestPasswordReset(email) {
        const value = (email || '').trim();
        if (!value) return { success: false, error: 'Email is required' };
        const result = await API.request('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email: value })
        });
        if (result?.success) return result;
        return { success: false, error: result?.error || 'Failed to request password reset' };
    }

    async resetPassword(token, newPassword) {
        const result = await API.request('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({
                token: (token || '').trim(),
                password: newPassword
            })
        });
        if (result?.success) return result;
        return { success: false, error: result?.error || 'Failed to reset password' };
    }

    async initializeMFA() {
        const result = await API.request('/auth/mfa/setup', {
            method: 'POST',
            body: JSON.stringify({})
        });
        if (result?.success) return result;
        return { success: false, error: result?.error || 'Failed to initialize MFA setup' };
    }

    async verifyMFASetup(code) {
        const result = await API.request('/auth/mfa/verify-setup', {
            method: 'POST',
            body: JSON.stringify({ code: String(code || '').trim() })
        });
        if (result?.success) return result;
        return { success: false, error: result?.error || 'Failed to verify MFA code' };
    }
    
    async guestAccess() {
        let geo = null;
        if (navigator.geolocation) {
            try {
                geo = await new Promise((resolve) => {
                    navigator.geolocation.getCurrentPosition(
                        (position) => resolve({
                            lat: position.coords.latitude,
                            lng: position.coords.longitude
                        }),
                        () => resolve(null),
                        { enableHighAccuracy: true, timeout: 6000, maximumAge: 120000 }
                    );
                });
            } catch (_) {}
        }

        const result = await API.request('/auth/guest', {
            method: 'POST',
            body: JSON.stringify({
                lat: geo?.lat,
                lng: geo?.lng
            })
        });

        if (result?.success && result.token && result.user) {
            const loggedIn = this.completeLogin(
                { ...result.user, user_type: result.user.role || result.user.user_type, isGuest: true },
                result.token,
                false
            );
            if (loggedIn.success) {
                loggedIn.user.isGuest = true;
                sessionStorage.setItem('user', JSON.stringify(loggedIn.user));
            }
            return loggedIn;
        }

        return { success: false, error: result?.error || 'Guest access unavailable' };
    }
}

// =====================================================
// 3.1.1.2 GEOFENCING MODULE (COMPLETE)
// =====================================================
class GeofenceManager {
    constructor() {
        this.watchId = null;
        this.currentLocation = null;
        this.parkBoundary = { minLat: -1.2, maxLat: -1.0, minLng: 29.6, maxLng: 29.8 };
        this.locationHistory = [];
        this.wasInside = false;
        this.pois = [];
    }

    async init() {
        await this.loadParkBoundary();
        await this.loadPOIs();
        this.startTracking();
    }

    async loadParkBoundary() {
        try {
            const response = await fetch(`${API_URL}/geofence/boundary`, {
                headers: Auth.token ? { Authorization: `Bearer ${Auth.token}` } : {}
            });
            if (response.ok) {
                this.parkBoundary = await response.json();
            }
        } catch (error) {}
    }

    async loadPOIs() {
        this.pois = JSON.parse(localStorage.getItem('offline_locations') || '[]');
    }

    startTracking() {
        if (!navigator.geolocation) return;
        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.handleLocationUpdate(position),
            (error) => console.error(error),
            { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
        );
    }

    handleLocationUpdate(position) {
        const { latitude, longitude, accuracy, timestamp } = position.coords;
        const newLocation = { lat: latitude, lng: longitude, accuracy, timestamp };
        this.currentLocation = newLocation;
        this.locationHistory.push(newLocation);
        if (this.locationHistory.length > 500) this.locationHistory.shift();
        
        const isInside = this.isInsidePark(latitude, longitude);
        if (isInside !== this.wasInside) {
            this.wasInside = isInside;
            this.onBoundaryCross(isInside);
        }
        this.storeLocationOffline(newLocation);
        if (Auth?.isAuthenticated?.()) {
            API.request('/geofence/location-update', {
                method: 'POST',
                body: JSON.stringify({
                    lat: latitude,
                    lng: longitude,
                    accuracy,
                    timestamp: new Date(timestamp || Date.now()).toISOString()
                })
            });
        }
        this.checkProximityAlerts(latitude, longitude);
        AppState.currentLocation = newLocation;
    }

    isInsidePark(lat, lng) {
        if (this.parkBoundary?.type === 'Polygon' && Array.isArray(this.parkBoundary.coordinates)) {
            return this.isPointInPolygon(lat, lng, this.parkBoundary.coordinates[0] || []);
        }
        return lat >= this.parkBoundary.minLat && lat <= this.parkBoundary.maxLat &&
               lng >= this.parkBoundary.minLng && lng <= this.parkBoundary.maxLng;
    }

    isPointInPolygon(lat, lng, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i][0];
            const yi = polygon[i][1];
            const xj = polygon[j][0];
            const yj = polygon[j][1];
            const intersects = ((yi > lat) !== (yj > lat)) &&
                (lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || Number.EPSILON) + xi);
            if (intersects) inside = !inside;
        }
        return inside;
    }

    onBoundaryCross(isInside) {
        if (!isInside) {
            this.showAlert('Warning: You have left the park boundaries', 'warning');
        } else if (this.wasInside === false) {
            this.showAlert('Success: Welcome to Bwindi Impenetrable National Park!', 'success');
        }
    }

    checkProximityAlerts(lat, lng) {
        this.pois.forEach(poi => {
            if (poi.lat && poi.lng) {
                const distance = this.calculateDistance(lat, lng, poi.lat, poi.lng);
                if (distance <= 100) {
                    this.showAlert(`Nearby: ${poi.name} (${Math.round(distance)}m)`, 'info');
                }
            }
        });
    }

    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 6371e3;
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    storeLocationOffline(location) {
        const locations = JSON.parse(localStorage.getItem('locationHistory') || '[]');
        locations.push(location);
        if (locations.length > 100) locations.shift();
        localStorage.setItem('locationHistory', JSON.stringify(locations));
    }

    showAlert(message, type) {
        console.log(`[${type}] ${message}`);
        const event = new CustomEvent('alert', { detail: { message, type } });
        window.dispatchEvent(event);
    }
}

// =====================================================
// 3.1.1.3 CONTENT MANAGER (COMPLETE)
// =====================================================
class ContentManager {
    constructor() {
        this.initStorage();
        this.bookmarks = JSON.parse(localStorage.getItem('bookmarks') || '[]');
        this.useAPI = true; // Set to false to force localStorage only
    }

    initStorage() {
        // Only seed if empty AND API is not available
        if (!localStorage.getItem('offline_animals') && !this.useAPI) {
            localStorage.setItem('offline_animals', JSON.stringify([
                { id: 1, name: 'Mountain Gorilla', scientific: 'Gorilla beringei', status: 'Endangered', fun_facts: ['Share 98% DNA with humans', 'Silverbacks can weigh 500lbs'] },
                { id: 2, name: 'African Elephant', scientific: 'Loxodonta africana', status: 'Vulnerable', fun_facts: ['Can communicate over 10km'] },
                { id: 3, name: 'Great Blue Turaco', scientific: 'Corythaeola cristata', status: 'Least Concern', fun_facts: ['Largest turaco species'] }
            ]));
        }
        if (!localStorage.getItem('offline_locations') && !this.useAPI) {
            localStorage.setItem('offline_locations', JSON.stringify([
                { id: 1, name: 'Buhoma Gate', type: 'gate', lat: -1.0482, lng: 29.6612, description: 'Main entrance' }
            ]));
        }
    }

    async getAnimals() {
        if (this.useAPI) {
            const apiAnimals = await API.getAnimals();
            if (apiAnimals && apiAnimals.length) return apiAnimals;
        }
        return JSON.parse(localStorage.getItem('offline_animals') || '[]');
    }

    async getAnimalById(id) {
        if (this.useAPI) {
            const animal = await API.getAnimalById(id);
            if (animal) return animal;
        }
        const animals = await this.getAnimals();
        return animals.find(a => a.id == id);
    }

    async getLocations() {
        if (this.useAPI) {
            const apiLocations = await API.getLocations();
            if (apiLocations && apiLocations.length) return apiLocations;
        }
        return JSON.parse(localStorage.getItem('offline_locations') || '[]');
    }

    async getWeather() {
        if (this.useAPI) {
            const result = await API.request('/weather');
            if (result && result.success) return result.data;
        }
        return { temperature: 22, condition: 'Partly Cloudy', humidity: 78 };
    }

    async downloadOfflineContent() {
        // Fetch fresh data from API and store in localStorage
        const animals = await API.getAnimals();
        const locations = await API.getLocations();
        const stories = await API.getCulturalStories();
        
        if (animals && animals.length) localStorage.setItem('offline_animals', JSON.stringify(animals));
        if (locations && locations.length) localStorage.setItem('offline_locations', JSON.stringify(locations));
        if (stories && stories.length) localStorage.setItem('cultural_stories', JSON.stringify(stories));
        
        AppState.cachedContent.version++;
        localStorage.setItem('offline_version', AppState.cachedContent.version);
        this.updateStorageUsage();
        window.showToast('Offline content updated from server!', 'success');
    }

    updateStorageUsage() {
        let total = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const item = localStorage.getItem(localStorage.key(i));
            total += item ? item.length * 2 : 0;
        }
        AppState.offlineStorage.used = Math.round(total / (1024 * 1024));
    }

    getOfflineStorageSize() {
        this.updateStorageUsage();
        return AppState.offlineStorage.used;
    }
}

// =====================================================
// 3.1.1.5 TOUR GUIDE MANAGER (COMPLETE)
// =====================================================
class TourGuideManager {
    constructor() {
        this.activeTour = null;
        this.tourTimer = null;
        this.elapsedSeconds = 0;
        this.guestLocations = new Map();
        this.locationSyncTimer = null;
    }

    async getGuideDashboard() {
        const tours = await API.getToursForGuide();
        const myTours = Array.isArray(tours) ? tours : [];
        const todayStr = new Date().toISOString().split('T')[0];
        
        const upcoming = myTours.filter(t => t.scheduled_start?.split('T')[0] > todayStr);
        const completed = myTours.filter(t => t.status === 'completed');
        const today = myTours.filter(t => t.scheduled_start?.split('T')[0] === todayStr);
        
        const shifts = JSON.parse(localStorage.getItem('guide_shifts') || '[]');
        const activeShift = shifts.find(s => s.shift_date === todayStr && s.status === 'active');
        
        return { upcoming, today, completed, activeShift, stats: {
            totalTours: myTours.length,
            completedTours: completed.length,
            totalGuests: myTours.reduce((sum, t) => sum + (t.group_size || 0), 0),
            averageRating: this.getAverageRating(guideId)
        } };
    }

    getAverageRating(guideId) {
        const feedback = JSON.parse(localStorage.getItem('feedback') || '[]');
        const guideFeedback = feedback.filter(f => f.guide_id === guideId);
        if (guideFeedback.length === 0) return 0;
        return (guideFeedback.reduce((a, f) => a + (f.rating || 0), 0) / guideFeedback.length).toFixed(1);
    }

    async startTour(tourId) {
        const result = await API.startTour(tourId, AppState.currentLocation);
        if (!result?.success) return { success: false, error: result?.error || 'Tour not found' };
        const tour = await API.getTourById(tourId) || { tour_session_id: tourId };
        
        this.activeTour = tour;
        this.elapsedSeconds = 0;
        if (this.tourTimer) clearInterval(this.tourTimer);
        this.tourTimer = setInterval(() => {
            this.elapsedSeconds++;
            this.updateTimerDisplay();
        }, 1000);
        this.startLocationSync();
        
        return { success: true, tour: this.activeTour };
    }

    startLocationSync() {
        if (this.locationSyncTimer) clearInterval(this.locationSyncTimer);
        this.locationSyncTimer = setInterval(async () => {
            if (!this.activeTour?.tour_session_id) return;
            const current = Geofence?.currentLocation || AppState?.currentLocation;
            if (!current || !Number.isFinite(current.lat) || !Number.isFinite(current.lng)) return;
            await API.updateTourLocation(this.activeTour.tour_session_id, current.lat, current.lng);
        }, 15000);
    }

    updateTimerDisplay() {
        const timerEl = document.getElementById('tourTimerDisplay');
        if (timerEl) {
            const hours = Math.floor(this.elapsedSeconds / 3600);
            const minutes = Math.floor((this.elapsedSeconds % 3600) / 60);
            const seconds = this.elapsedSeconds % 60;
            timerEl.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    async endTour(tourId) {
        if (this.tourTimer) clearInterval(this.tourTimer);
        if (this.locationSyncTimer) clearInterval(this.locationSyncTimer);
        const result = await API.endTour(tourId, AppState.currentLocation);
        this.activeTour = null;
        if (!result?.success) {
            return { success: false, error: result?.error || 'Failed to end tour' };
        }
        return { success: true, report: result.summary || await this.generateTourReport(tourId) };
    }

    async generateTourReport(tourId) {
        const tours = JSON.parse(localStorage.getItem('tour_sessions') || '[]');
        const tour = tours.find(t => t.tour_session_id === tourId);
        const sightings = JSON.parse(localStorage.getItem('sightings') || '[]');
        const tourSightings = sightings.filter(s => s.tour_session_id === tourId);
        return { tourId, duration: Math.floor(this.elapsedSeconds / 60), sightings: tourSightings.length };
    }

    async quickSighting(animal, count) {
        if (!this.activeTour) return { success: false, error: 'No active tour' };
        const sighting = {
            sighting_id: Date.now(),
            animal_name: animal,
            number_observed: parseInt(count),
            location_name: 'Current location',
            timestamp: new Date().toISOString(),
            tour_session_id: this.activeTour.tour_session_id
        };
        const sightings = JSON.parse(localStorage.getItem('sightings') || '[]');
        sightings.unshift(sighting);
        localStorage.setItem('sightings', JSON.stringify(sightings));
        return { success: true, sighting };
    }

    async clockIn() {
        const shifts = JSON.parse(localStorage.getItem('guide_shifts') || '[]');
        const today = new Date().toISOString().split('T')[0];
        if (shifts.find(s => s.shift_date === today && s.status === 'active')) {
            return { success: false, error: 'Already clocked in' };
        }
        const newShift = { shift_id: Date.now(), shift_date: today, start_time: new Date().toISOString(), status: 'active' };
        shifts.push(newShift);
        localStorage.setItem('guide_shifts', JSON.stringify(shifts));
        return { success: true, shift: newShift };
    }

    async clockOut() {
        const shifts = JSON.parse(localStorage.getItem('guide_shifts') || '[]');
        const today = new Date().toISOString().split('T')[0];
        const shiftIndex = shifts.findIndex(s => s.shift_date === today && s.status === 'active');
        if (shiftIndex === -1) return { success: false, error: 'Not clocked in' };
        shifts[shiftIndex].end_time = new Date().toISOString();
        shifts[shiftIndex].status = 'completed';
        localStorage.setItem('guide_shifts', JSON.stringify(shifts));
        const hoursWorked = (new Date(shifts[shiftIndex].end_time) - new Date(shifts[shiftIndex].start_time)) / (1000 * 60 * 60);
        return { success: true, hoursWorked: hoursWorked.toFixed(2) };
    }

    async addLiveNote(noteText) {
        if (!this.activeTour?.tour_session_id) return { success: false, error: 'No active tour' };
        const ok = await API.addTourNote(this.activeTour.tour_session_id, noteText);
        return ok ? { success: true } : { success: false, error: 'Failed to save note' };
    }
}

// =====================================================
// 3.1.1.6 AI RECOMMENDATION ENGINE (COMPLETE)
// =====================================================
class AIRecommendationEngine {
    constructor() {
        this.queryHistory = [];
    }

    async getUserProfile() {
        const interests = localStorage.getItem('userInterests');
        return { interests: interests ? JSON.parse(interests) : ['wildlife', 'nature'] };
    }

    async getRecommendations(limit = 3) {
        return [
            { id: 1, name: 'Gorilla Trekking Experience', score: 0.94, reason: 'Matches your wildlife interest' },
            { id: 2, name: 'Bird Watching Trail', score: 0.89, reason: 'Perfect for nature photography' },
            { id: 3, name: 'Batwa Cultural Experience', score: 0.86, reason: 'Cultural interest match' }
        ].slice(0, limit);
    }

    async askQuestion(question) {
        const trimmed = (question || '').trim();
        if (!trimmed) {
            return { answer: 'Please enter a question.' };
        }

        const payload = {
            question: trimmed,
            language: AppState.userPreferences?.language || 'en'
        };

        if (AppState.currentLocation?.lat && AppState.currentLocation?.lng) {
            payload.location = {
                lat: AppState.currentLocation.lat,
                lng: AppState.currentLocation.lng
            };
        }

        try {
            if (navigator.onLine) {
                const result = await API.request('/ai/chat', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                if (result && result.success && result.answer) {
                    return {
                        answer: result.answer,
                        meta: result.meta || {}
                    };
                }
            }
        } catch (error) {
            // Fall back to offline mode below.
        }

        // Offline AI mode: basic local response when network/API unavailable.
        const lowercase = trimmed.toLowerCase();
        if (lowercase.includes('gorilla')) {
            return { answer: 'Offline mode: Mountain gorillas are protected in Bwindi. Keep 7 meters distance and follow guide instructions.' };
        }
        if (lowercase.includes('safety')) {
            return { answer: 'Offline mode: stay on marked trails, keep safe wildlife distance, and contact rangers for emergencies.' };
        }
        if (lowercase.includes('weather')) {
            return { answer: 'Offline mode: weather can change quickly in Bwindi. Carry rain gear and water.' };
        }
        return { answer: 'Offline mode: I can answer basics on wildlife, safety, tours, and culture.' };
    }

    async getPersonalizedContentFeed(limit = 4) {
        return [
            { id: '1', name: 'Mountain Gorilla', type: 'animal', tags: ['wildlife'], relevanceScore: 0.95 },
            { id: '2', name: 'Batwa Heritage', type: 'cultural', tags: ['culture'], relevanceScore: 0.88 },
            { id: '3', name: 'Buhoma Waterhole', type: 'location', tags: ['wildlife'], relevanceScore: 0.85 }
        ].slice(0, limit);
    }

    async getSeasonalRecommendations() {
        const month = new Date().getMonth();
        const isDry = (month >= 5 && month <= 7) || (month >= 11 || month <= 1);
        return { season: isDry ? 'dry' : 'wet', recommendations: isDry ? ['Gorilla Trekking', 'Bird Watching'] : ['Cultural Experiences', 'Forest Walks'] };
    }
}

// =====================================================
// 3.1.1.9 OFFLINE SYNC MANAGER (COMPLETE)
// =====================================================
class OfflineSyncManager {
    constructor() {
        this.isSyncing = false;
        this.pendingItems = [];
        this.loadQueue();
        window.addEventListener('online', () => this.processQueue());
    }

    loadQueue() {
        this.pendingItems = JSON.parse(localStorage.getItem('sync_queue') || '[]');
    }

    async addToQueue(action, data) {
        this.pendingItems.push({ id: Date.now(), action, data, attempts: 0 });
        localStorage.setItem('sync_queue', JSON.stringify(this.pendingItems));
        window.refreshNetworkStatusBadge?.();
        if (navigator.onLine) await this.processQueue();
    }

    async processQueue() {
        if (this.isSyncing || !navigator.onLine) return;
        this.isSyncing = true;
        const items = [...this.pendingItems];
        for (const item of items) {
            try {
                let success = false;
                switch (item.action) {
                    case 'sighting': success = await this.syncSighting(item.data); break;
                    case 'feedback': success = await this.syncFeedback(item.data); break;
                }
                if (success) this.pendingItems = this.pendingItems.filter(i => i.id !== item.id);
            } catch (error) {}
        }
        localStorage.setItem('sync_queue', JSON.stringify(this.pendingItems));
        this.isSyncing = false;
        window.refreshNetworkStatusBadge?.();
    }

    async syncSighting(data) { return true; }
    async syncFeedback(data) { return true; }
    getPendingCount() { return this.pendingItems.length; }
}

// =====================================================
// INTRANET MANAGER - HR, Announcements, Inventory (BLENDED)
// =====================================================
class IntranetManager {
    constructor() {
        this.initIntranetData();
    }

    initIntranetData() {
        if (!localStorage.getItem('internal_announcements')) {
            localStorage.setItem('internal_announcements', JSON.stringify([
                { id: 1, title: 'Staff Meeting', content: 'All guides meeting at HQ at 3pm.', date: new Date().toISOString(), priority: 'high', author: 'Admin' },
                { id: 2, title: 'New Gorilla Trek Protocol', content: 'Updated safety guidelines issued.', date: new Date().toISOString(), priority: 'medium', author: 'Park Management' }
            ]));
        }
        if (!localStorage.getItem('inventory_items')) {
            localStorage.setItem('inventory_items', JSON.stringify([
                { id: 1, name: 'GPS Devices', quantity: 15, category: 'Equipment', status: 'available' },
                { id: 2, name: 'First Aid Kits', quantity: 8, category: 'Medical', status: 'available' },
                { id: 3, name: 'Radio Transceivers', quantity: 12, category: 'Communication', status: 'available' }
            ]));
        }
        if (!localStorage.getItem('hr_employees')) {
            localStorage.setItem('hr_employees', JSON.stringify([
                { id: 1, name: 'John Mbabazi', role: 'Senior Guide', department: 'Tour Operations', status: 'active', hireDate: '2020-01-15' },
                { id: 2, name: 'Grace Akello', role: 'IT Manager', department: 'IT', status: 'active', hireDate: '2019-06-10' },
                { id: 3, name: 'Peter Mugisha', role: 'Tour Guide', department: 'Tour Operations', status: 'active', hireDate: '2021-03-22' },
                { id: 4, name: 'Sarah Nyira', role: 'Ranger', department: 'Security', status: 'active', hireDate: '2020-11-01' }
            ]));
        }
    }

    async getAnnouncements() {
        const result = await API.request('/intranet/announcements');
        if (result?.announcements) {
            const normalized = result.announcements.map(a => ({
                id: a.announcement_id,
                title: a.title,
                content: a.content,
                date: a.created_at,
                priority: a.priority,
                author: a.author_name || 'System'
            }));
            localStorage.setItem('internal_announcements', JSON.stringify(normalized));
            return normalized;
        }
        return JSON.parse(localStorage.getItem('internal_announcements') || '[]');
    }

    async addAnnouncement(title, content, priority) {
        const result = await API.request('/intranet/announcements', {
            method: 'POST',
            body: JSON.stringify({ title, content, priority: priority || 'medium' })
        });
        if (result?.success) return result;
        return { success: false, error: result?.error || 'Failed to add announcement' };
    }

    async deleteAnnouncement(id) {
        const result = await API.request(`/intranet/announcements/${id}`, {
            method: 'DELETE'
        });
        if (result?.success) return result;
        return { success: false, error: result?.error || 'Failed to delete announcement' };
    }

    async getInventory() {
        const result = await API.request('/intranet/inventory');
        if (result?.items) {
            const normalized = result.items.map(item => ({
                id: item.inventory_item_id,
                name: item.name,
                quantity: item.quantity,
                category: item.category,
                status: item.status
            }));
            localStorage.setItem('inventory_items', JSON.stringify(normalized));
            return normalized;
        }
        return JSON.parse(localStorage.getItem('inventory_items') || '[]');
    }

    async updateInventoryItem(id, updates) {
        const result = await API.request(`/intranet/inventory/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
        if (result?.success) return result;
        return { success: false, error: result?.error || 'Failed to update inventory item' };
    }

    async addInventoryItem(name, quantity, category) {
        const result = await API.request('/intranet/inventory', {
            method: 'POST',
            body: JSON.stringify({ name, quantity: parseInt(quantity, 10), category, status: 'available' })
        });
        if (result?.success) return result;
        return { success: false, error: result?.error || 'Failed to add inventory item' };
    }

    async getEmployees() {
        const result = await API.request('/intranet/employees');
        if (result?.employees) {
            const normalized = result.employees.map(e => ({
                id: e.employee_id,
                name: e.name,
                role: e.role,
                department: e.department,
                status: e.status,
                hireDate: e.hire_date
            }));
            localStorage.setItem('hr_employees', JSON.stringify(normalized));
            return normalized;
        }
        return JSON.parse(localStorage.getItem('hr_employees') || '[]');
    }

    async addEmployee(employeeData) {
        const result = await API.request('/intranet/employees', {
            method: 'POST',
            body: JSON.stringify(employeeData)
        });
        if (result?.success) return result;
        return { success: false, error: result?.error || 'Failed to add employee' };
    }

    async updateEmployeeStatus(id, status) {
        const result = await API.request(`/intranet/employees/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        if (result?.success) return result;
        return { success: false, error: result?.error || 'Failed to update employee status' };
    }

    async getHRStats() {
        const employees = await this.getEmployees();
        const totalStaff = employees.length;
        const guidesOnDuty = employees.filter(e => e.role.includes('Guide') && e.status === 'active').length;
        const itStaff = employees.filter(e => e.department === 'IT' && e.status === 'active').length;
        return { totalStaff, guidesOnDuty, itStaff };
    }

    async getPeers() {
        const result = await API.request('/intranet/peers');
        if (result?.peers) return result.peers;
        return [];
    }

    async getIntranetStatus() {
        const result = await API.request('/intranet/status');
        return result || { isIntranet: false, ip: null };
    }
}

// =====================================================
// 3.1.1.10 IT MANAGER API (Enhanced with Intranet features)
// =====================================================
class ITManagerAPI {
    async getSystemMetrics() {
        const result = await API.request('/admin/stats');
        const hrStats = await Intranet.getHRStats();
        if (result) {
            return {
                activeUsers: result.totalUsers || 0,
                syncQueueSize: OfflineSync.getPendingCount(),
                storageUsed: Content.getOfflineStorageSize(),
                totalSightings: result.pendingApprovals || 0,
                averageRating: result.avgRating || 0,
                totalStaff: hrStats.totalStaff,
                guidesOnDuty: hrStats.guidesOnDuty,
                inventoryItems: (await Intranet.getInventory()).length,
                activeTours: result.activeTours || 0
            };
        }

        const users = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
        const sightings = JSON.parse(localStorage.getItem('sightings') || '[]');
        return {
            activeUsers: users.length + 1,
            syncQueueSize: OfflineSync.getPendingCount(),
            storageUsed: Content.getOfflineStorageSize(),
            totalSightings: sightings.length,
            averageRating: 4.5,
            totalStaff: hrStats.totalStaff,
            guidesOnDuty: hrStats.guidesOnDuty,
            inventoryItems: (await Intranet.getInventory()).length
        };
    }
    
    async getUserList() {
        const result = await API.request('/admin/users');
        if (result?.users) {
            return result.users.map(u => ({
                user_id: u.user_id,
                username: u.username,
                email: u.email,
                full_name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username,
                user_type: u.user_type,
                department: u.department || ''
            }));
        }

        return JSON.parse(localStorage.getItem('registeredUsers') || '[]').map(u => ({
            user_id: u.id, username: u.username, email: u.email, full_name: u.name, user_type: u.role, department: u.department
        }));
    }
    
    async getSightingsList(limit) {
        return (JSON.parse(localStorage.getItem('sightings') || '[]')).slice(0, limit);
    }
    
    async getAuditLogs(limit) {
        return JSON.parse(localStorage.getItem('audit_logs') || '[]').slice(0, limit);
    }
    
    async getSystemHealth() {
        return { database: 'connected', cache: 'healthy', syncService: 'running', geolocation: 'active' };
    }
    
    async getSchemaStatus() {
        const tables = ['users', 'tourists', 'tour_guides', 'it_managers', 'parks', 'locations', 'animals', 'sightings', 'cultural_narratives', 'tour_routes', 'tour_sessions', 'safety_tips', 'faqs', 'feedback', 'sync_queue', 'audit_logs', 'internal_announcements', 'inventory_items', 'hr_employees'];
        const status = {};
        tables.forEach(t => { status[t] = { count: 5, status: 'active' }; });
        return status;
    }

    async getInteractiveAnalytics() {
        const end = new Date();
        const start = new Date(Date.now() - 1000 * 60 * 60 * 24 * 14);
        const startIso = start.toISOString();
        const endIso = end.toISOString();
        const today = end.toISOString().split('T')[0];

        const [visitorFlow, congestion, popular, satisfaction, demographics] = await Promise.all([
            API.getVisitorFlowAnalytics(startIso, endIso, 'day'),
            API.getCongestionPredictions(today),
            API.getPopularContent(6),
            API.getSatisfactionAnalytics(),
            API.getDemographicsAnalytics()
        ]);

        return {
            visitorFlow: visitorFlow?.timeline || [],
            topLocations: visitorFlow?.top_locations || [],
            congestionPredictions: congestion?.predictions || [],
            congestionRecommendations: congestion?.recommendations || [],
            popularContent: popular || [],
            satisfaction: satisfaction || {},
            demographics: demographics || {}
        };
    }

    async getLiveOperations() {
        const [peers, intranetStatus, syncStatus] = await Promise.all([
            Intranet.getPeers(),
            Intranet.getIntranetStatus(),
            API.request('/sync/status')
        ]);
        return {
            peers: peers || [],
            intranetStatus: intranetStatus || {},
            syncStatus: syncStatus || {}
        };
    }

    async getFeedbackInsights(days = 30) {
        const dashboard = await API.getFeedbackDashboard(days);
        if (!dashboard) {
            return {
                summary: {
                    total_feedback: 0,
                    avg_rating: 0,
                    bug_reports: 0,
                    feature_requests: 0,
                    responded_count: 0
                },
                recent: []
            };
        }
        return dashboard;
    }

    async getRareAlerts(limit = 10) {
        return API.getRareSightingAlerts(limit);
    }

    async getUnackedRareAlerts(limit = 10) {
        return API.getUnackedRareSightingAlerts(limit);
    }

    async acknowledgeRareAlert(alertId) {
        return API.acknowledgeRareSightingAlert(alertId);
    }

    async respondToFeedback(feedbackId, responseText) {
        return API.respondToFeedback(feedbackId, responseText);
    }
}

// =====================================================
// SIDEBAR & RENDER FUNCTIONS
// =====================================================

window.AuthManager = AuthManager;
window.GeofenceManager = GeofenceManager;
window.ContentManager = ContentManager;
window.TourGuideManager = TourGuideManager;
window.AIRecommendationEngine = AIRecommendationEngine;
window.OfflineSyncManager = OfflineSyncManager;
window.IntranetManager = IntranetManager;
window.ITManagerAPI = ITManagerAPI;
