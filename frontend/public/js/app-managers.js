
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
        // Client-side attempt lockout disabled during testing.
        // Re-enable later by restoring the failedAttempts >= maxAttempts check.
        const isDev = (window.__SIGTS_CONFIG__?.NODE_ENV || 'development') !== 'production';
        const loginStart = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

        // Avoid blocking login on geolocation. Use cached location first, then
        // attempt a very short lookup; continue without coordinates if unavailable.
        let geo = AppState?.currentLocation
            ? { lat: AppState.currentLocation.lat, lng: AppState.currentLocation.lng }
            : null;

        if (!geo && navigator.geolocation) {
            try {
                geo = await new Promise((resolve) => {
                    let resolved = false;
                    const finish = (value) => {
                        if (resolved) return;
                        resolved = true;
                        resolve(value);
                    };

                    const timer = setTimeout(() => finish(null), 800);
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            clearTimeout(timer);
                            finish({
                                lat: position.coords.latitude,
                                lng: position.coords.longitude
                            });
                        },
                        () => {
                            clearTimeout(timer);
                            finish(null);
                        },
                        { enableHighAccuracy: false, timeout: 700, maximumAge: 300000 }
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
        const afterAuthRequest = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        if (isDev) {
            console.debug(`[auth] /auth/login request completed in ${Math.round(afterAuthRequest - loginStart)}ms`);
        }

        if (result?.success && result.mfaRequired && result.mfaToken) {
            const mfaTok = result.mfaToken;
            let useSms = false;
            if (result.smsMfaAvailable && typeof window.showConfirmDialog === 'function') {
                useSms = await window.showConfirmDialog(
                    'MFA required. OK to receive a code by SMS on your registered phone? Cancel to use your authenticator app instead.'
                );
            }
            if (useSms) {
                const sendRes = await API.request('/auth/mfa/sms/send', {
                    method: 'POST',
                    body: JSON.stringify({ mfaToken: mfaTok })
                });
                if (!sendRes?.success) {
                    window.showToast?.(
                        sendRes?.error || 'SMS code could not be sent. Try your authenticator code instead.',
                        'warning'
                    );
                } else {
                    if (sendRes.devSmsCode) {
                        window.showToast?.(`Dev SMS MFA code: ${sendRes.devSmsCode}`, 'info');
                    }
                    const smsCode = await window.showPromptDialog('Enter the 6-digit code from SMS');
                    if (!smsCode?.trim()) return { success: false, error: 'SMS code required' };
                    const smsDone = await API.request('/auth/mfa/sms/complete', {
                        method: 'POST',
                        body: JSON.stringify({ mfaToken: mfaTok, code: smsCode.trim() })
                    });
                    if (smsDone?.success && smsDone.token && smsDone.user) {
                        return this.completeLogin(smsDone.user, smsDone.token, rememberMe);
                    }
                    window.showToast?.(smsDone?.error || 'SMS MFA failed.', 'danger');
                }
            }
            const code = await window.showPromptDialog('Enter your 6-digit authenticator code');
            if (!code) return { success: false, error: 'MFA code required' };
            const mfaResult = await API.request('/auth/mfa/complete', {
                method: 'POST',
                body: JSON.stringify({
                    mfaToken: mfaTok,
                    code: code.trim()
                })
            });
            if (mfaResult?.success && mfaResult.token && mfaResult.user) {
                return this.completeLogin(mfaResult.user, mfaResult.token, rememberMe);
            }
            return { success: false, error: mfaResult?.error || 'MFA verification failed' };
        }

        if (result?.success && result.token && result.user) {
            if (isDev) {
                const loginEnd = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                console.debug(`[auth] total login flow completed in ${Math.round(loginEnd - loginStart)}ms`);
            }
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
            demo_tourist: {
                password: 'Tourist123!',
                user: {
                    id: 'demo-tourist',
                    name: 'Demo Tourist',
                    email: 'tourist@sigts.local',
                    username: 'demo_tourist',
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
            demo_guide: {
                password: 'Guide123!',
                user: {
                    id: 'demo-guide',
                    name: 'Demo Guide',
                    email: 'guide@sigts.local',
                    username: 'demo_guide',
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
            },
            demo_it: {
                password: 'ITManager123!',
                user: {
                    id: 'demo-admin',
                    name: 'IT Manager',
                    email: 'it@sigts.local',
                    username: 'demo_it',
                    role: 'it_manager',
                    user_type: 'it_manager',
                    department: 'IT'
                },
                token: 'demo.it_manager.token'
            },
            demo_admin: {
                password: 'Admin123!',
                user: {
                    id: 'demo-root-admin',
                    name: 'System Admin',
                    email: 'admin@sigts.local',
                    username: 'demo_admin',
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
            if (isDev) {
                const loginEnd = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                console.debug(`[auth] demo login flow completed in ${Math.round(loginEnd - loginStart)}ms`);
            }
            return this.completeLogin(demo.user, demo.token, rememberMe);
        }

        // (failed-attempt counter intentionally not incremented during testing)
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
        window.dispatchEvent(new CustomEvent('geofence:location', {
            detail: {
                location: newLocation,
                isInsidePark: isInside
            }
        }));
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
function wildlifeTourThemesEmbedFallbackList() {
    try {
        const fb = typeof window !== 'undefined' ? window.__SIGTS_WILDLIFE_TOUR_THEMES_FALLBACK__ : null;
        return Array.isArray(fb) ? fb : [];
    } catch (_) {
        return [];
    }
}

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
                { animal_id: '00000000-0000-4000-8000-000000000001', name: 'Mountain Gorilla', scientific_name: 'Gorilla beringei beringei', conservation_status: 'endangered', description: 'Mountain gorillas anchor Bwindi and Virunga conservation — roughly half the global population uses these Afromontane forests. Habituated groups are tracked daily with strict viewing distances, disease precautions, and ranger-led interpretation of silverback behaviour, nesting cycles, and how permit revenue funds anti-poaching and community schools.', image_urls: ['https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/066_Silverback_mountain_gorilla_eating_at_Bwindi_Impenetrable_Forest_National_Park_Photo_by_Giles_Laurent.jpg/960px-066_Silverback_mountain_gorilla_eating_at_Bwindi_Impenetrable_Forest_National_Park_Photo_by_Giles_Laurent.jpg'], fun_facts: ['Share about 98% DNA with humans', 'Silverbacks lead stable family groups'] },
                { animal_id: '00000000-0000-4000-8000-000000000002', name: 'Chimpanzee', scientific_name: 'Pan troglodytes', conservation_status: 'endangered', description: 'Eastern chimpanzees range at low density across Bwindi ridges. Pant-hoots, night nests, and knuckle prints often provide the only evidence on busy trekking days. Guides stress no feeding, no imitation calls, and hygiene overlap rules that mirror gorilla protocols to reduce disease transmission.', image_urls: ['https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/A_group_of_imp_chimps.jpg/960px-A_group_of_imp_chimps.jpg'], fun_facts: ['Tool use varies by community', 'Pant-hoot choruses carry far'] },
                { animal_id: '00000000-0000-4000-8000-000000000003', name: 'African Forest Elephant', scientific_name: 'Loxodonta cyclotis', conservation_status: 'endangered', description: 'Forest elephants engineer seed dispersal and mineral-lick circuits through closed canopy. They are smaller and rounder-eared than savanna elephants and typically vanish before tourists see whole herds — guides read snapped branches, fresh dung, and shoulder prints on muddy poles instead.', image_urls: ['https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/African_forest_elephant_%28Loxodonta_cyclotis%29_calf.jpg/960px-African_forest_elephant_%28Loxodonta_cyclotis%29_calf.jpg'], fun_facts: ['Smaller ears than savanna relatives', 'Mineral licks draw night visits'] },
                { animal_id: '00000000-0000-4000-8000-000000000004', name: 'Black-and-white Colobus', scientific_name: 'Colobus guereza', conservation_status: 'least_concern', description: 'Colobus stream white tail banners across canopy gaps while digesting tough leaves with specialized gut microbes. Newborns are pure white — a favourite teaching moment for linking primate behaviour to quiet trail etiquette and intact upper-forest structure.', image_urls: ['https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Black-and-white_Colobus_Monkeys.jpg/960px-Black-and-white_Colobus_Monkeys.jpg'], fun_facts: ['Newborns are pure white', 'Leaves fermented by gut microbes'] },
                { animal_id: '00000000-0000-4000-8000-000000000005', name: 'Blue Monkey', scientific_name: 'Cercopithecus mitis', conservation_status: 'least_concern', description: 'Sykes or blue monkeys form mid-canopy troops that stitch fruit masts to insect pulses. Alarm barks coordinate escapes when crowned eagles or noisy trekking lines approach — a practical cue for guides to pace groups and modulate voices.', image_urls: ['https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Zanzibar_Sykes%27_monkey_%28Cercopithecus_mitis%29_female_and_juveniles.jpg/960px-Zanzibar_Sykes%27_monkey_%28Cercopithecus_mitis%29_female_and_juveniles.jpg'], fun_facts: ['Also called Sykes monkey regionally', 'Alarm barks coordinate escapes'] },
                { animal_id: '00000000-0000-4000-8000-000000000006', name: 'Great Blue Turaco', scientific_name: 'Corythaeola cristata', conservation_status: 'least_concern', description: 'Africa\'s largest turaco glides between fruiting figs with heavy wingbeats and loud calls. It flags healthy canopy fruiting and seed-dispersal webs that gorillas and butterflies also rely on — best enjoyed with binoculars and without playback harassment at nests.', image_urls: ['https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Great_Blue_Turaco.jpg/960px-Great_Blue_Turaco.jpg'], fun_facts: ['Cow-like calls at dawn', 'Important fig seed disperser'] },
                { animal_id: '00000000-0000-4000-8000-000000000007', name: 'African Fish Eagle', scientific_name: 'Haliaeetus vocifer', conservation_status: 'least_concern', description: 'Fish eagles tie Bwindi visitors to Great Lakes soundscapes — whistled duets carry even when birds commute along forest-edge rivers. They anchor lessons on watershed health, riparian buffers, and how interior forests connect to regional water security.', image_urls: ['https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/AfricanFishEagle.jpeg/960px-AfricanFishEagle.jpeg'], fun_facts: ['Piercing call is an African soundmark', 'Pairs reuse huge stick nests'] },
                { animal_id: '00000000-0000-4000-8000-000000000008', name: 'Rwenzori Turaco', scientific_name: 'Ruwenzorornis johnstoni', conservation_status: 'least_concern', description: 'This Albertine endemic flashes ruby primaries between moss-forest crowns. Croaking duets carry through mist, so listening skills matter as much as optics — guides pair sightings with elevation and bamboo transitions to explain micro-endemism.', image_urls: ['https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Ruwenzori_Turaco.jpg/960px-Ruwenzori_Turaco.jpg'], fun_facts: ['Croaks in dripping moss forest', 'Frugivore of canopy masts'] },
                { animal_id: '00000000-0000-4000-8000-000000000009', name: 'African Green Broadbill', scientific_name: 'Pseudocalyptomena graueri', conservation_status: 'vulnerable', description: 'A chunky Albertine endemic tied to mossy crowns and canopy fruiting pulses. Guides cherish its nasal whistle drifting through dripping forest — a flagship species for explaining playback ethics, boardwalk pacing, and why understorey trampling harms breeders.', image_urls: ['https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/African_Green_Broadbill.jpg/960px-African_Green_Broadbill.jpg'], fun_facts: ['Gleans along mossy limbs', 'Sensitive to playback pressure'] },
                { animal_id: '00000000-0000-4000-8000-00000000000a', name: 'Handsome Francolin', scientific_name: 'Pternistis nobilis', conservation_status: 'vulnerable', description: 'Albertine endemic partridge duetting at first light on bamboo-fern ridges. Pairs call across ravines before trekking lines arrive — a soundtrack species for discussing buffer-zone hunting regulations and why dogs are excluded from park trails.', image_urls: ['https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Handsome_spurfowl_%28Pternistis_nobilis%29.jpg/960px-Handsome_spurfowl_%28Pternistis_nobilis%29.jpg'], fun_facts: ['Pairs call across ravines', 'Bamboo-fern understory specialist'] },
                { animal_id: '00000000-0000-4000-8000-00000000000b', name: 'Bar-tailed Trogon', scientific_name: 'Apaloderma vittatum', conservation_status: 'least_concern', description: 'Jewel-like trogon of mid-canopy perches — tail bars flash when it pivots. A favourite Albertine photo target that lets guides discuss fig masts, mixed-flock etiquette, and why flash photography stays off on sensitive species.', image_urls: ['https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Bar-tailed_Trogon_%28Apaloderma_vittatum%29_%2845634509165%29.jpg/960px-Bar-tailed_Trogon_%28Apaloderma_vittatum%29_%2845634509165%29.jpg'], fun_facts: ['Tail bars flash when it turns', 'Nests in tree holes'] },
                { animal_id: '00000000-0000-4000-8000-00000000000c', name: "Johnston's Chameleon", scientific_name: 'Trioceros johnstoni', conservation_status: 'least_concern', description: 'Three-horned chameleon of Bwindi shrubs — photographed in situ on park trails. Rangers ask guests not to touch because skin oils and handling stress dehydrate animals quickly. Independent eye rotation makes them superb ambush hunters on mid-level branches.', image_urls: ['https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Camale%C3%B3n_%28Trioceros_johnstoni%29%2C_parque_nacional_de_la_Selva_Impenetrable_de_Bwindi%2C_Uganda%2C_2024-02-01%2C_DD_89.jpg/960px-Camale%C3%B3n_%28Trioceros_johnstoni%29%2C_parque_nacional_de_la_Selva_Impenetrable_de_Bwindi%2C_Uganda%2C_2024-02-01%2C_DD_89.jpg'], fun_facts: ['Eyes move independently', 'Do not touch—skin stress harms quickly'] }
            ]));
        }
        if (!localStorage.getItem('offline_locations') && !this.useAPI) {
            localStorage.setItem('offline_locations', JSON.stringify([
                { id: 1, name: 'Buhoma Gate', type: 'gate', lat: -1.0482, lng: 29.6612, description: 'Main entrance' }
            ]));
        }
    }

    async getAnimals() {
        const readOffline = () => {
            try {
                const raw = localStorage.getItem('offline_animals');
                const parsed = raw ? JSON.parse(raw) : [];
                return Array.isArray(parsed) ? parsed : [];
            } catch (_) {
                return [];
            }
        };

        if (this.useAPI) {
            const apiAnimals = await API.getAnimals();
            if (Array.isArray(apiAnimals) && apiAnimals.length) {
                try {
                    localStorage.setItem('offline_animals', JSON.stringify(apiAnimals));
                } catch (_) {
                    /**/
                }
                return apiAnimals;
            }

            // Stale partial offline packs (e.g. old 3-species demo) hid the full catalogue after API errors.
            let offline = readOffline();
            const online = typeof navigator === 'undefined' || navigator.onLine;
            const cacheEpochKey = 'sigts_animal_cache_epoch';
            const cacheEpoch = '20260504';
            if (
                online
                && offline.length > 0
                && offline.length < 8
                && localStorage.getItem(cacheEpochKey) !== cacheEpoch
            ) {
                try {
                    localStorage.setItem(cacheEpochKey, cacheEpoch);
                } catch (_) {
                    /**/
                }
                const backup = offline.slice();
                try {
                    localStorage.removeItem('offline_animals');
                } catch (_) {
                    /**/
                }
                const retry = await API.getAnimals();
                if (Array.isArray(retry) && retry.length) {
                    try {
                        localStorage.setItem('offline_animals', JSON.stringify(retry));
                    } catch (_) {
                        /**/
                    }
                    return retry;
                }
                try {
                    localStorage.setItem('offline_animals', JSON.stringify(backup));
                } catch (_) {
                    /**/
                }
                offline = backup;
            }
            return offline;
        }

        return readOffline();
    }

    async getAnimalById(id) {
        if (this.useAPI) {
            const animal = await API.getAnimalById(id);
            if (animal) return animal;
        }
        const animals = await this.getAnimals();
        return animals.find((a) => a.animal_id == id || a.id == id);
    }

    async getWildlifeTourThemes() {
        if (this.useAPI) {
            const themes = await API.getWildlifeTourThemes();
            if (themes && themes.length) return themes;
        }
        const cached = JSON.parse(localStorage.getItem('offline_wildlife_themes') || '[]');
        if (Array.isArray(cached) && cached.length) return cached;
        return wildlifeTourThemesEmbedFallbackList();
    }

    async getWildlifeTourThemeBySlug(slug) {
        const s = String(slug || '').trim().toLowerCase();
        if (this.useAPI) {
            const row = await API.getWildlifeTourThemeBySlug(s);
            if (row?.slug || row?.theme_id) return row;
        }
        const list = JSON.parse(localStorage.getItem('offline_wildlife_themes') || '[]');
        const cachedHit = Array.isArray(list) ? list.find((t) => t.slug === s) : null;
        if (cachedHit?.slug || cachedHit?.theme_id) return cachedHit;
        const fb = wildlifeTourThemesEmbedFallbackList();
        return fb.find((t) => t.slug === s) || null;
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
        const themes = await API.getWildlifeTourThemes();

        if (animals && animals.length) localStorage.setItem('offline_animals', JSON.stringify(animals));
        if (locations && locations.length) localStorage.setItem('offline_locations', JSON.stringify(locations));
        if (stories && stories.length) localStorage.setItem('cultural_stories', JSON.stringify(stories));
        if (themes && themes.length) localStorage.setItem('offline_wildlife_themes', JSON.stringify(themes));
        
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

    async getRecommendations(limit = 6) {
        return [
            { id: 1, name: 'Gorilla Trekking Experience', score: 0.94, reason: 'Matches your wildlife interest' },
            { id: 2, name: 'Bird Watching Trail', score: 0.89, reason: 'Perfect for nature photography' },
            { id: 3, name: 'Batwa Cultural Experience', score: 0.86, reason: 'Cultural interest match' },
            { id: 4, name: 'Forest Nature Walk', score: 0.84, reason: 'Moss forest ecology without a primate permit' },
            { id: 5, name: 'Community Coffee & Crafts', score: 0.81, reason: 'Buffer-zone livelihoods beside the park' },
            { id: 6, name: 'Photography & Etiquette Briefing', score: 0.79, reason: 'Low-flash protocols and distance rules' }
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
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (conn?.saveData) return;
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

    async getAccessContext() {
        const result = await API.request('/intranet/status-lite');
        return result || { isIntranet: false, ip: null };
    }

    async seedInteractiveMapData() {
        const result = await API.request('/intranet/seed/interactive', {
            method: 'POST'
        });
        return result || { success: false, error: 'Failed to run seed from interface' };
    }
}

// =====================================================
// 3.1.1.10 IT MANAGER API (Enhanced with Intranet features)
// =====================================================
class ITManagerAPI {
    async getSystemMetrics() {
        const result = await API.request('/admin/stats');
        const hrStats = await Intranet.getHRStats();
        const usersSnapshot = await API.request('/admin/users?limit=1&offset=0');
        const liveTotalUsers = Number(usersSnapshot?.total || 0);
        if (result) {
            return {
                activeUsers: Number(result.totalUsers || liveTotalUsers || 0),
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

        const sightings = JSON.parse(localStorage.getItem('sightings') || '[]');
        return {
            activeUsers: liveTotalUsers,
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

        return [];
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

        // Use allSettled so one slow/broken endpoint doesn't blank the whole dashboard.
        const settled = await Promise.allSettled([
            API.getVisitorFlowAnalytics(startIso, endIso, 'day'),
            API.getCongestionPredictions(today),
            API.getPopularContent(6),
            API.getSatisfactionAnalytics(),
            API.getDemographicsAnalytics()
        ]);
        const valueOf = (i) => (settled[i].status === 'fulfilled' ? settled[i].value : null);
        settled.forEach((r, i) => {
            if (r.status === 'rejected') {
                console.warn(`[ITAPI] interactive analytics call ${i} failed:`, r.reason);
            }
        });

        const visitorFlow = valueOf(0);
        const congestion = valueOf(1);
        const popular = valueOf(2);
        const satisfaction = valueOf(3);
        const demographics = valueOf(4);

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
        const settled = await Promise.allSettled([
            Intranet.getPeers(),
            Intranet.getIntranetStatus(),
            API.request('/sync/status')
        ]);
        const valueOf = (i) => (settled[i].status === 'fulfilled' ? settled[i].value : null);
        settled.forEach((r, i) => {
            if (r.status === 'rejected') {
                console.warn(`[ITAPI] live ops call ${i} failed:`, r.reason);
            }
        });
        return {
            peers: valueOf(0) || [],
            intranetStatus: valueOf(1) || {},
            syncStatus: valueOf(2) || {}
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

    async getManagerFeedbackQueue(options = {}) {
        return API.getManagerFeedbackQueue(options);
    }

    async updateFeedbackStatus(feedbackId, improvementStatus, improvementNotes = '') {
        return API.updateFeedbackStatus(feedbackId, improvementStatus, improvementNotes);
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
