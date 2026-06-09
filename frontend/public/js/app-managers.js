
// =====================================================
// 3.1.1.1 USER AUTHENTICATION MODULE (Intranet roles extended)
// =====================================================
class AuthManager {
    constructor() {
        this.token = localStorage.getItem('token') || sessionStorage.getItem('token');
        this.user = null;
        this.sessionTimeout = 30 * 60 * 1000;
        this.sessionTimer = null;
        this.failedAttempts = 0;
        this.maxAttempts = 5;
        this.twoFactorPending = false;
        this.pending2FACode = null;
        this.activityMonitorBound = false;
        this.activityHandler = null;
        this.activityThrottleUntil = 0;
        
        if (this.token) {
            try {
                if ((this.token.match(/\./g) || []).length !== 2) {
                    throw new Error('Legacy demo token');
                }
                this.user = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || 'null');
                this.startSessionTimer();
                this.bindActivityMonitor();
                this.startPresenceHeartbeat();
            } catch(e) {
                this.token = null;
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('refreshToken');
                sessionStorage.removeItem('token');
                sessionStorage.removeItem('user');
                sessionStorage.removeItem('refreshToken');
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
        const phone = String(userData.phone || '').trim();

        if (!username || username.length < 3) return { success: false, error: 'Username must be at least 3 characters' };
        if (!email) return { success: false, error: 'Email is required' };
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false, error: 'Valid email required' };
        if (!phone || phone.length < 6) return { success: false, error: 'Phone number is required (at least 6 characters)' };
        if (!password || password.length < 4) return { success: false, error: 'Password must be at least 4 characters' };
        if (password !== confirmPassword) return { success: false, error: 'Passwords do not match' };

        if (typeof ensureSigtsApiReachable === 'function') {
            await ensureSigtsApiReachable();
        }
        
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
                phone,
                userType
            })
        });

        const apiBase = typeof getSigtsApiBaseUrl === 'function'
            ? getSigtsApiBaseUrl()
            : (typeof API_URL !== 'undefined' ? API_URL : (window.__SIGTS_API_BASE__ || 'API'));

        if (!result) {
            return {
                success: false,
                error: `Cannot reach the registration server (${apiBase}). Start the backend (npm run dev --workspace=backend) or open http://localhost:8001/`
            };
        }

        if (result.network) {
            return {
                success: false,
                error: result.error || `Cannot reach the registration server (${apiBase}).`
            };
        }

        const registeredOk =
            result.success === true
            || result.code === 'REGISTRATION_SUCCESS'
            || (result.ok === true && (result.status === 201 || result.status === 200));

        if (registeredOk) {
            const emailSent = Boolean(result.notifications?.email || result.emailSent);
            const verificationSent = Boolean(
                result.notifications?.verificationEmail || result.verificationEmailSent
            );
            let message = result.message || 'Your account was created successfully. You can sign in now.';
            if (emailSent) {
                message += ` A confirmation email was sent to ${email}.`;
            } else if (!verificationSent) {
                message += ' (Welcome email could not be sent — check server mail settings.)';
            }
            return {
                success: true,
                message,
                user: result.user || null,
                emailSent,
                verificationEmailSent: verificationSent
            };
        }

        if (result.conflict?.error && result.available === false) {
            return {
                success: false,
                error: result.conflict.error,
                field: result.conflict.field || null,
                code: result.conflict.code || null
            };
        }

        if (result.code === 'DATABASE_UNAVAILABLE' || result.status === 503 || result.status === 504) {
            return {
                success: false,
                error:
                    result.error
                    || 'The server database is unavailable right now, so new accounts cannot be created. Demo accounts may still work offline, but live registration needs the hosted database restored.',
                code: result.code || 'DATABASE_UNAVAILABLE',
            };
        }

        if (result.error) {
            const detail = result.detail ? ` (${result.detail})` : '';
            const suggestLogin = ['USERNAME_TAKEN', 'EMAIL_TAKEN', 'CREDENTIALS_TAKEN'].includes(result.code);
            return {
                success: false,
                error: suggestLogin
                    ? `${result.error} If you just finished registering, try signing in instead.`
                    : `${result.error}${detail}`,
                field: result.field || null,
                code: result.code || null,
                suggestLogin
            };
        }

        if (result.errors?.length) {
            const first = result.errors[0];
            const field = first.path || first.param || 'field';
            return { success: false, error: `${field}: ${first.msg || first.message || 'invalid'}`, field };
        }

        if (result.success === false) {
            return { success: false, error: result.message || 'Registration failed' };
        }

        if (result.status && result.status >= 400) {
            return {
                success: false,
                error: result.message || result.error || 'Registration failed',
                field: result.field
            };
        }

        return {
            success: false,
            error: result.message || result.error || 'Registration failed'
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

        if (typeof ensureSigtsApiReachable === 'function') {
            await ensureSigtsApiReachable();
        }

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
                        return this.completeLogin(smsDone.user, smsDone.token, rememberMe, smsDone.refreshToken);
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
                return this.completeLogin(mfaResult.user, mfaResult.token, rememberMe, mfaResult.refreshToken);
            }
            return { success: false, error: mfaResult?.error || 'MFA verification failed' };
        }

        if (result?.success && result.token && result.user) {
            if (isDev) {
                const loginEnd = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                console.debug(`[auth] total login flow completed in ${Math.round(loginEnd - loginStart)}ms`);
            }
            return this.completeLogin(result.user, result.token, rememberMe, result.refreshToken);
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
                    role: 'admin',
                    user_type: 'admin',
                    department: 'IT'
                },
                token: 'demo.admin.token'
            }
        };

        const key = String(username || '').trim().toLowerCase();
        const demo = demoCredentials[key];
        const demoPasswords = demo
            ? [password, demo.password, 'Test123!', 'ITManager123!', 'Admin123!'].filter(Boolean)
            : [];
        const uniqueDemoPasswords = [...new Set(demoPasswords.map((p) => String(p)))];
        if (demo && uniqueDemoPasswords.includes(String(password))) {
            for (const pw of uniqueDemoPasswords) {
                const apiLogin = await API.request('/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ username: key, password: pw })
                });
                if (apiLogin?.success && (apiLogin.token || apiLogin.accessToken) && apiLogin.user) {
                    return this.completeLogin(
                        apiLogin.user,
                        apiLogin.token || apiLogin.accessToken,
                        rememberMe,
                        apiLogin.refreshToken || null
                    );
                }
            }
            if (isDev) {
                const loginEnd = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                console.debug(`[auth] offline demo login (no API JWT) in ${Math.round(loginEnd - loginStart)}ms`);
            }
            showToast?.(
                'Server sign-in failed — using offline demo mode. Operations and admin APIs need a live login (e.g. demo_it / Test123!).',
                'warning'
            );
            return this.completeLogin(demo.user, demo.token, rememberMe, null);
        }

        if (result?.network) {
            const apiBase = typeof getSigtsApiBaseUrl === 'function' ? getSigtsApiBaseUrl() : 'API';
            return {
                success: false,
                error: result.error || `Cannot reach the sign-in server (${apiBase}). Start the backend and hard-refresh this page.`
            };
        }

        if (result?.code === 'USER_NOT_FOUND') {
            const id = String(username || '').trim();
            const looksLikeName = /\s/.test(id) && !id.includes('@');
            return {
                success: false,
                error: looksLikeName
                    ? 'No account matched that name. Sign in with your username or email address.'
                    : 'No account found with that username or email.'
            };
        }
        if (result?.code === 'INVALID_PASSWORD') {
            return {
                success: false,
                error: 'Incorrect password. Use Forgot password if you need to set a new one.'
            };
        }
        if (result?.code === 'ACCOUNT_INACTIVE' || (result?.error || '').toLowerCase().includes('deactivated')) {
            return { success: false, error: result?.error || 'This account is deactivated. Contact support.' };
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
        return this.completeLogin(user, demoToken, true, null);
    }

    completeLogin(user, token, rememberMe, refreshToken = null) {
        this.user = {
            user_id: user.id || user.user_id,
            name: user.name || user.username || 'User',
            email: user.email,
            username: user.username,
            role: user.role || user.user_type,
            userType: user.userType || user.role || user.user_type,
            department: user.department || ''
        };
        if (user.isGuest || user.guest) this.user.isGuest = true;
        this.token = token;
        
        if (rememberMe) {
            localStorage.setItem('token', this.token);
            localStorage.setItem('user', JSON.stringify(this.user));
        } else {
            sessionStorage.setItem('token', this.token);
            sessionStorage.setItem('user', JSON.stringify(this.user));
        }
        API.setToken(this.token);
        if (typeof API.setRefreshToken === 'function') {
            API.setRefreshToken(refreshToken || null, rememberMe);
        }
        
        this.startSessionTimer();
        this.bindActivityMonitor();
        this.startPresenceHeartbeat();
        this._pingPresenceNow();
        if (typeof navigator !== 'undefined' && navigator.onLine && typeof Intranet?.clearLegacyDemoIntranetCache === 'function') {
            Intranet.clearLegacyDemoIntranetCache();
        }
        AppState.currentUser = this.user;
        AppState.authToken = this.token;
        this.failedAttempts = 0;
        if (typeof Content?.pullBookmarksFromServer === 'function') {
            Content.pullBookmarksFromServer().catch(() => {});
        }
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

    touchSessionActivity() {
        if (!this.token || !this.user) return;
        const now = Date.now();
        if (now < this.activityThrottleUntil) return;
        this.activityThrottleUntil = now + 1000;
        this.startSessionTimer();
        /** Presence uses the 20s heartbeat only — do not ping on every API call (avoids rate limits). */
    }

    _pingPresenceNow() {
        if (!this.token || !this.user || String(this.token).startsWith('demo.')) return;
        if (this._presencePingInFlight) return;
        this._presencePingInFlight = true;
        if (typeof API?.pingPresence !== 'function') {
            this._presencePingInFlight = false;
            return;
        }
        API.pingPresence()
            .then((res) => {
                if (res && res.success !== false && !res.error) {
                    this._lastPresencePingAt = Date.now();
                }
            })
            .catch(() => {})
            .finally(() => {
                this._presencePingInFlight = false;
            });
    }

    _schedulePresencePing() {
        if (!this.token || !this.user || String(this.token).startsWith('demo.')) return;
        const now = Date.now();
        if (this._lastPresencePingAt && now - this._lastPresencePingAt < 12000) return;
        this._pingPresenceNow();
    }

    startPresenceHeartbeat() {
        this.stopPresenceHeartbeat();
        if (!this.token || !this.user || String(this.token).startsWith('demo.')) return;
        this._pingPresenceNow();
        this.presenceHeartbeatTimer = window.setInterval(() => {
            this._pingPresenceNow();
        }, 20000);
    }

    stopPresenceHeartbeat() {
        if (this.presenceHeartbeatTimer) {
            clearInterval(this.presenceHeartbeatTimer);
            this.presenceHeartbeatTimer = null;
        }
    }

    bindActivityMonitor() {
        if (this.activityMonitorBound || !this.token || !this.user) return;
        this.activityHandler = () => this.touchSessionActivity();
        ['click', 'keydown', 'touchstart', 'mousemove', 'scroll'].forEach((eventName) => {
            window.addEventListener(eventName, this.activityHandler, { passive: true });
        });
        this.activityMonitorBound = true;
    }

    unbindActivityMonitor() {
        if (!this.activityMonitorBound || !this.activityHandler) return;
        ['click', 'keydown', 'touchstart', 'mousemove', 'scroll'].forEach((eventName) => {
            window.removeEventListener(eventName, this.activityHandler, { passive: true });
        });
        this.activityMonitorBound = false;
        this.activityHandler = null;
    }

    async logout() {
        this.stopPresenceHeartbeat();
        this.token = null;
        this.user = null;
        API.setToken(null);
        if (typeof API.setRefreshToken === 'function') {
            API.setRefreshToken(null);
        }
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('refreshToken');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('refreshToken');
        AppState.currentUser = null;
        if (this.sessionTimer) {
            clearTimeout(this.sessionTimer);
            this.sessionTimer = null;
        }
        this.unbindActivityMonitor();
        renderView('login');
    }

    getCurrentUser() {
        if (this.user) return this.user;
        const stored = localStorage.getItem('user') || sessionStorage.getItem('user');
        if (stored) this.user = JSON.parse(stored);
        return this.user;
    }

    isAuthenticated() { return !!this.token && (this.token.match(/\./g) || []).length === 2; }
    hasRole(role) {
        const mine = String(this.user?.role || this.user?.userType || this.user?.user_type || '')
            .trim()
            .toLowerCase();
        const want = String(role || '').trim().toLowerCase();
        if (want === 'it_manager') {
            return mine === 'it_manager' || mine === 'admin';
        }
        return mine === want;
    }

    async syncRoleFromProfile() {
        if (!this.isAuthenticated() || typeof API?.request !== 'function') return null;
        const profile = await API.request('/users/profile');
        const role = profile?.user_type;
        if (!role || profile?.error || profile?.status >= 400) return null;
        const user = this.getCurrentUser() || {};
        user.role = role;
        user.userType = role;
        user.user_type = role;
        this.user = user;
        AppState.currentUser = user;
        const persistLocal = Boolean(localStorage.getItem('token'));
        const storage = persistLocal ? localStorage : sessionStorage;
        storage.setItem('user', JSON.stringify(user));
        return role;
    }
    
    sendVerificationEmail(email) { return email; }

    async requestPasswordReset(email) {
        const value = (email || '').trim();
        if (!value) return { success: false, error: 'Email is required' };
        const result = await API.request('/auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email: value })
        });
        if (result?.success) return result;
        if (result?.network) {
            return {
                success: false,
                error: result.error || 'Cannot reach the server. Check that the backend is running.'
            };
        }
        return { success: false, error: result?.error || 'Failed to request password reset' };
    }

    async verifyEmailToken(token) {
        const t = String(token || '').trim();
        if (!t) return { success: false, error: 'Verification token is required' };
        const result = await API.request('/auth/verify-email', {
            method: 'POST',
            body: JSON.stringify({ token: t })
        });
        if (result?.success) return result;
        return { success: false, error: result?.error || 'Email verification failed' };
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
                false,
                result.refreshToken
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
        this.proximityCooldown = new Map();
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
        const cached = JSON.parse(localStorage.getItem('offline_locations') || '[]');
        if (Auth?.isAuthenticated?.() && typeof API?.getLocations === 'function') {
            try {
                const list = await API.getLocations();
                if (Array.isArray(list) && list.length) {
                    localStorage.setItem('offline_locations', JSON.stringify(list));
                    this.pois = list.map((loc) => this.normalizePoiRecord(loc));
                    return;
                }
            } catch (_) {
                /**/
            }
        }
        this.pois = (Array.isArray(cached) ? cached : []).map((loc) => this.normalizePoiRecord(loc));
    }

    normalizePoiRecord(loc = {}) {
        const lat = Number(loc.lat ?? loc.latitude);
        const lng = Number(loc.lng ?? loc.longitude);
        return {
            ...loc,
            location_id: loc.location_id || loc.id || null,
            lat: Number.isFinite(lat) ? lat : null,
            lng: Number.isFinite(lng) ? lng : null
        };
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
        const { latitude, longitude, accuracy } = position.coords;
        const timestamp = position.timestamp || Date.now();
        const newLocation = { lat: latitude, lng: longitude, accuracy, timestamp };
        this.currentLocation = newLocation;
        this.locationHistory.push(newLocation);
        if (this.locationHistory.length > 500) this.locationHistory.shift();
        
        const isInside = this.isInsidePark(latitude, longitude);
        const prevInside = this.wasInside;
        if (isInside !== this.wasInside) {
            this.wasInside = isInside;
            this.onBoundaryCross(isInside, prevInside);
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
            }).then(async (result) => {
                const applyOperationalAlerts = (r) => {
                    const list = Array.isArray(r?.operational_alerts) ? r.operational_alerts : [];
                    for (const a of list) {
                        if (!a?.message || typeof window.showToast !== 'function') continue;
                        const sev = String(a.severity || '').toLowerCase();
                        window.showToast(a.message, sev === 'high' ? 'danger' : 'warning');
                    }
                };
                if (result?.code === 'CONSENT_REQUIRED' && result?.consent_type) {
                    const grant = await API.setMyConsent(result.consent_type, true);
                    if (grant?.success) {
                        const retry = await API.request('/geofence/location-update', {
                            method: 'POST',
                            body: JSON.stringify({
                                lat: latitude,
                                lng: longitude,
                                accuracy,
                                timestamp: new Date(timestamp || Date.now()).toISOString()
                            })
                        });
                        applyOperationalAlerts(retry);
                    }
                    return;
                }
                applyOperationalAlerts(result);
                if (Array.isArray(result?.proximity_alerts) && result.proximity_alerts.length) {
                    for (const p of result.proximity_alerts) {
                        if (typeof window.showToast === 'function') {
                            window.showToast(`Nearby: ${p.name} (${p.distance_m} m)`, 'info');
                        }
                        if (typeof window.maybeSigtsBrowserNotify === 'function') {
                            window.maybeSigtsBrowserNotify('SIGTS — nearby POI', `${p.name} (~${p.distance_m} m)`);
                        }
                    }
                    if (typeof window.refreshUserNotificationBadge === 'function') {
                        window.refreshUserNotificationBadge().catch(() => {});
                    }
                }
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

    onBoundaryCross(isInside, wasInside) {
        if (!isInside) {
            this.showAlert('Warning: You have left the park boundaries', 'warning');
        } else if (wasInside === false) {
            this.showAlert('Success: Welcome to Bwindi Impenetrable National Park!', 'success');
        }
    }

    checkProximityAlerts(lat, lng) {
        const now = Date.now();
        this.pois.forEach((poi) => {
            const plat = Number(poi.lat);
            const plng = Number(poi.lng);
            if (!Number.isFinite(plat) || !Number.isFinite(plng)) return;
            const distance = this.calculateDistance(lat, lng, plat, plng);
            const radius = Number(poi.trigger_radius) > 0 ? Number(poi.trigger_radius) : 120;
            if (distance > radius) return;
            const key = String(poi.location_id || poi.name || `${plat},${plng}`);
            const last = this.proximityCooldown.get(key) || 0;
            if (now - last < 600000) return;
            this.proximityCooldown.set(key, now);
            this.showAlert(`Nearby: ${poi.name} (${Math.round(distance)} m)`, 'info');
            if (typeof window.maybeSigtsBrowserNotify === 'function') {
                window.maybeSigtsBrowserNotify('SIGTS — nearby POI', `${poi.name} (~${Math.round(distance)} m)`);
            }
            if (typeof window.refreshUserNotificationBadge === 'function') {
                window.refreshUserNotificationBadge().catch(() => {});
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
        this.bookmarksStorageKey = 'sigts_bookmarks_v1';
        this.initStorage();
        this.bookmarks = this.readBookmarks();
        this.useAPI = true; // Set to false to force localStorage only
        this.maybeMigrateLegacyBookmarks();
    }

    maybeMigrateLegacyBookmarks() {
        try {
            const legacy = localStorage.getItem('bookmarks');
            if (!legacy || legacy === '[]') return;
            const parsed = JSON.parse(legacy);
            if (!Array.isArray(parsed) || !parsed.length) return;
            const next = [...this.bookmarks];
            parsed.forEach((row) => {
                if (!row || !row.type || !row.id) return;
                if (!next.some((b) => b.type === row.type && String(b.id) === String(row.id))) next.push(row);
            });
            this.bookmarks = next;
            localStorage.removeItem('bookmarks');
            this.persistBookmarks();
        } catch (_) {
            /**/
        }
    }

    readBookmarks() {
        try {
            const raw = localStorage.getItem(this.bookmarksStorageKey);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    }

    persistBookmarks(list, opts = {}) {
        const rows = Array.isArray(list) ? list : this.bookmarks;
        this.bookmarks = rows;
        try {
            localStorage.setItem(this.bookmarksStorageKey, JSON.stringify(rows));
        } catch (_) {
            /**/
        }
        try {
            if (typeof window !== 'undefined' && typeof window.invalidateSigtsViewCache === 'function') {
                window.invalidateSigtsViewCache('dashboard');
                window.invalidateSigtsViewCache('saved');
            }
        } catch (_) {
            /**/
        }
        if (!opts.skipSync) {
            this.scheduleBookmarkServerSync();
        }
    }

    scheduleBookmarkServerSync() {
        if (!this.useAPI || typeof API?.syncUserBookmarks !== 'function') return;
        if (this._bookmarkSyncTimer) clearTimeout(this._bookmarkSyncTimer);
        this._bookmarkSyncTimer = setTimeout(() => {
            API.syncUserBookmarks(this.bookmarks).catch(() => {});
        }, 800);
    }

    async pullBookmarksFromServer() {
        if (!this.useAPI || typeof API?.getUserBookmarks !== 'function') return;
        try {
            const remote = await API.getUserBookmarks();
            if (!remote || !Array.isArray(remote)) return;
            if (!remote.length && this.bookmarks.length) {
                await API.syncUserBookmarks(this.bookmarks);
                return;
            }
            if (remote.length) {
                this.persistBookmarks(remote, { skipSync: true });
            }
        } catch (_) {
            /**/
        }
    }

    isBookmarked(type, id) {
        const sid = String(id || '').trim();
        return this.bookmarks.some((b) => b.type === type && String(b.id) === sid);
    }

    toggleBookmark(payload) {
        const type = String(payload?.type || '').trim();
        const id = String(payload?.id || '').trim();
        const title = String(payload?.title || id || '').trim();
        if (!type || !id) return false;
        const ix = this.bookmarks.findIndex((b) => b.type === type && String(b.id) === id);
        if (ix >= 0) {
            const next = this.bookmarks.slice();
            next.splice(ix, 1);
            this.persistBookmarks(next);
            return false;
        }
        const row = {
            type,
            id,
            title,
            savedAt: new Date().toISOString()
        };
        this.persistBookmarks(this.bookmarks.concat(row));
        return true;
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
                { animal_id: '00000000-0000-4000-8000-000000000006', name: 'Great Blue Turaco', scientific_name: 'Corythaeola cristata', conservation_status: 'least_concern', description: 'Africa\'s largest turaco glides between fruiting figs with heavy wingbeats and loud calls. It flags healthy canopy fruiting and seed-dispersal webs that gorillas and butterflies also rely on — best enjoyed with binoculars and without playback harassment at nests.', image_urls: ['https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Great_Blue_Turaco.jpg/960px-Great_Blue_Turaco.jpg'], fun_facts: ['Cow-like calls at dawn', 'Important fig seed disperser'] },
                { animal_id: '00000000-0000-4000-8000-000000000007', name: 'African Fish Eagle', scientific_name: 'Haliaeetus vocifer', conservation_status: 'least_concern', description: 'Fish eagles tie Bwindi visitors to Great Lakes soundscapes — whistled duets carry even when birds commute along forest-edge rivers. They anchor lessons on watershed health, riparian buffers, and how interior forests connect to regional water security.', image_urls: ['https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/AfricanFishEagle.jpeg/960px-AfricanFishEagle.jpeg'], fun_facts: ['Piercing call is an African soundmark', 'Pairs reuse huge stick nests'] },
                { animal_id: '00000000-0000-4000-8000-000000000008', name: 'Rwenzori Turaco', scientific_name: 'Ruwenzorornis johnstoni', conservation_status: 'least_concern', description: 'This Albertine endemic flashes ruby primaries between moss-forest crowns. Croaking duets carry through mist, so listening skills matter as much as optics — guides pair sightings with elevation and bamboo transitions to explain micro-endemism.', image_urls: ['https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Ruwenzori_Turaco.jpg/960px-Ruwenzori_Turaco.jpg'], fun_facts: ['Croaks in dripping moss forest', 'Frugivore of canopy masts'] },
                { animal_id: '00000000-0000-4000-8000-000000000009', name: 'African Green Broadbill', scientific_name: 'Pseudocalyptomena graueri', conservation_status: 'vulnerable', description: 'A chunky Albertine endemic tied to mossy crowns and canopy fruiting pulses. Guides cherish its nasal whistle drifting through dripping forest — a flagship species for explaining playback ethics, boardwalk pacing, and why understorey trampling harms breeders.', image_urls: ['/images/african-green-broadbill.png'], fun_facts: ['Gleans along mossy limbs', 'Sensitive to playback pressure'] },
                { animal_id: '00000000-0000-4000-8000-00000000000a', name: 'Handsome Francolin', scientific_name: 'Pternistis nobilis', conservation_status: 'vulnerable', description: 'Albertine endemic partridge duetting at first light on bamboo-fern ridges. Pairs call across ravines before trekking lines arrive — a soundtrack species for discussing buffer-zone hunting regulations and why dogs are excluded from park trails.', image_urls: ['https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Handsome_spurfowl_%28Pternistis_nobilis%29.jpg/960px-Handsome_spurfowl_%28Pternistis_nobilis%29.jpg'], fun_facts: ['Pairs call across ravines', 'Bamboo-fern understory specialist'] },
                { animal_id: '00000000-0000-4000-8000-00000000000b', name: 'Bar-tailed Trogon', scientific_name: 'Apaloderma vittatum', conservation_status: 'least_concern', description: 'Jewel-like trogon of mid-canopy perches — tail bars flash when it pivots. A favourite Albertine photo target that lets guides discuss fig masts, mixed-flock etiquette, and why flash photography stays off on sensitive species.', image_urls: ['https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Bar-tailed_Trogon_%28Apaloderma_vittatum%29_%2845634509165%29.jpg/960px-Bar-tailed_Trogon_%28Apaloderma_vittatum%29_%2845634509165%29.jpg'], fun_facts: ['Tail bars flash when it turns', 'Nests in tree holes'] },
                { animal_id: '00000000-0000-4000-8000-00000000000c', name: "Johnston's Chameleon", scientific_name: 'Trioceros johnstoni', conservation_status: 'least_concern', description: 'Three-horned chameleon of Bwindi shrubs — photographed in situ on park trails. Rangers ask guests not to touch because skin oils and handling stress dehydrate animals quickly. Independent eye rotation makes them superb ambush hunters on mid-level branches.', image_urls: ['https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Camale%C3%B3n_%28Trioceros_johnstoni%29%2C_parque_nacional_de_la_Selva_Impenetrable_de_Bwindi%2C_Uganda%2C_2024-02-01%2C_DD_89.jpg/960px-Camale%C3%B3n_%28Trioceros_johnstoni%29%2C_parque_nacional_de_la_Selva_Impenetrable_de_Bwindi%2C_Uganda%2C_2024-02-01%2C_DD_89.jpg'], fun_facts: ['Eyes move independently', 'Do not touch—skin stress harms quickly'] }
            ]));
        }
        if (!localStorage.getItem('offline_locations') && !this.useAPI) {
            const fallback = Array.isArray(window.BWINDI_MAP_FALLBACK_LOCATIONS)
                ? window.BWINDI_MAP_FALLBACK_LOCATIONS
                : [
                      {
                          location_id: 'fb-loc-buhoma-gate',
                          name: 'Buhoma Gate',
                          location_type: 'gate',
                          latitude: -1.0482,
                          longitude: 29.6612,
                          description: 'Main entrance'
                      }
                  ];
            localStorage.setItem('offline_locations', JSON.stringify(fallback));
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
            const cacheEpoch = '20260511';
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
            if (result && result.success && result.data) {
                const d = result.data;
                return {
                    temperature: d.temperatureC ?? d.temperature ?? 22,
                    temperatureC: d.temperatureC ?? d.temperature ?? 22,
                    condition: d.condition || 'Partly cloudy',
                    humidity: d.humidityPct ?? d.humidity ?? 78,
                    source: d.source || 'api',
                    forecastSlices: d.forecastSlices || []
                };
            }
        }
        return { temperature: 22, temperatureC: 22, condition: 'Partly Cloudy', humidity: 78 };
    }

    async downloadOfflineContent() {
        // Fetch fresh data from API and store in localStorage
        const [animals, locations, stories, themes, faqs, tips, guide, catalogMeta, touristBio, stayingGuide, publicRoutes] =
            await Promise.all([
                API.getAnimals(),
                API.getLocations(),
                API.getCulturalStories(),
                API.getWildlifeTourThemes(),
                API.getFaqs().catch(() => []),
                API.getSafetyTips().catch(() => []),
                API.getParkGuide().catch(() => []),
                API.getContentCatalogMeta().catch(() => null),
                API.getTouristBiodiversity().catch(() => null),
                API.getStayingSafeGuide().catch(() => null),
                API.getPublicRoutes().catch(() => [])
            ]);

        if (animals && animals.length) localStorage.setItem('offline_animals', JSON.stringify(animals));
        if (locations && locations.length) localStorage.setItem('offline_locations', JSON.stringify(locations));
        if (stories && stories.length) localStorage.setItem('cultural_stories', JSON.stringify(stories));
        if (themes && themes.length) localStorage.setItem('offline_wildlife_themes', JSON.stringify(themes));
        try {
            if (Array.isArray(faqs) && faqs.length) localStorage.setItem('offline_faqs_cache', JSON.stringify(faqs));
            if (Array.isArray(tips) && tips.length) localStorage.setItem('offline_safety_tips_cache', JSON.stringify(tips));
            if (Array.isArray(guide) && guide.length) localStorage.setItem('offline_park_guide_cache', JSON.stringify(guide));
            if (catalogMeta && typeof catalogMeta === 'object') {
                localStorage.setItem('offline_catalog_meta_cache', JSON.stringify(catalogMeta));
            }
            if (touristBio && touristBio.species) {
                localStorage.setItem('offline_tourist_biodiversity_cache', JSON.stringify(touristBio));
            }
            if (stayingGuide && stayingGuide.sections) {
                localStorage.setItem('offline_staying_safe_guide_cache', JSON.stringify(stayingGuide));
            }
            if (Array.isArray(publicRoutes) && publicRoutes.length) {
                localStorage.setItem('offline_public_routes_cache', JSON.stringify({ routes: publicRoutes }));
            }
        } catch (_) {
            /**/
        }
        
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
        const [tours, shiftStatus, performance] = await Promise.all([
            API.getToursForGuide(),
            API.getGuideShiftStatus(),
            API.getGuidePerformance()
        ]);
        const myTours = Array.isArray(tours) ? tours : [];
        const toLocalYmd = (value) => {
            const d = value ? new Date(value) : new Date();
            if (Number.isNaN(d.getTime())) return '';
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };
        const todayStr = toLocalYmd(new Date());
        
        const upcoming = myTours.filter(t => toLocalYmd(t.scheduled_start) > todayStr);
        const completed = myTours.filter(t => t.status === 'completed');
        const today = myTours.filter(t => toLocalYmd(t.scheduled_start) === todayStr);
        
        const activeShift = shiftStatus?.shift?.status === 'active' ? shiftStatus.shift : null;
        
        return { upcoming, today, completed, activeShift, stats: {
            totalTours: myTours.length,
            completedTours: completed.length,
            totalGuests: myTours.reduce((sum, t) => sum + (t.group_size || 0), 0),
            averageRating: Number(performance?.average_rating || this.getAverageRating()).toFixed(1)
        } };
    }

    getAverageRating() {
        const feedback = JSON.parse(localStorage.getItem('feedback') || '[]');
        const guideFeedback = feedback.filter(f => f.category === 'guide');
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
        const result = await API.clockInGuideShift();
        if (result?.success) return { success: true, shift: result.shift };
        return { success: false, error: result?.error || 'Already clocked in' };
    }

    async clockOut() {
        const result = await API.clockOutGuideShift();
        if (result?.success) return { success: true, hoursWorked: Number(result.worked_hours || 0).toFixed(2) };
        return { success: false, error: result?.error || 'Not clocked in' };
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

function sigtsClampStr(value, max) {
    if (value == null) return '';
    const t = String(value).replace(/\s+/g, ' ').trim();
    if (!t) return '';
    return t.length <= max ? t : `${t.slice(0, Math.max(0, max - 1))}…`;
}

function sigtsNormalizeQuestion(question) {
    try {
        return String(question || '')
            .normalize('NFKC')
            .replace(/[\u200b-\u200d\ufeff]/g, '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    } catch (_) {
        return String(question || '')
            .toLowerCase()
            .replace(/\s+/g, ' ')
            .trim();
    }
}

function sigtsWantsAnimalCatalogContext(q) {
    return (
        /\b(animals?|species|biodiversity|catalogues?|catalogs?|catalogue|catalog|present|listed|grid|field brief|which|how many)\b/.test(q) ||
        q.includes('species to')
    );
}

function sigtsWantsTourThemeContext(q) {
    return /\b(tours?|activities?|activity|theme|themes|briefing|session|guided|tile|tiles)\b/.test(q);
}

function sigtsFindMentionedAnimal(qLower, animals) {
    if (!Array.isArray(animals) || !animals.length) return null;
    const sorted = [...animals].sort((a, b) => (b.name || '').length - (a.name || '').length);
    for (const a of sorted) {
        const n = String(a.name || '').toLowerCase().trim();
        if (n.length >= 3 && qLower.includes(n)) {
            return a;
        }
    }
    return null;
}

/** Mirrors backend `buildAnswerFromAppContext` for offline / failed API. */
function sigtsLocalAnswerFromAppContext(latestUserPlain, mergedThreadPlain, appContext, locationName) {
    void mergedThreadPlain;
    if (!appContext) return null;
    const q = sigtsNormalizeQuestion(latestUserPlain);
    if (!q.length || sigtsIsBareSocialUtterance(q)) return null;
    const mentioned = sigtsFindMentionedAnimal(q, appContext.animals);
    const wantAnimals = Boolean(appContext.animals?.length && (sigtsWantsAnimalCatalogContext(q) || mentioned));
    const wantThemes = Boolean(appContext.themes?.length && sigtsWantsTourThemeContext(q));
    if (!wantAnimals && !wantThemes) return null;

    const parts = [];
    if (wantThemes && appContext.themes.length) {
        parts.push(
            'Here is what this SIGTS install currently carries under tour session briefings (Wildlife tab tiles). Use the in-app modal for the full script; this is a short digest:'
        );
        for (const t of appContext.themes.slice(0, 10)) {
            const head = t.session_title || t.slug || 'Tour session';
            const sub = t.subtitle ? ` (${t.subtitle})` : '';
            const body = sigtsClampStr(t.tourist_summary_en, 420);
            parts.push(`• ${head}${sub}: ${body || 'Open the theme card in the app for the full briefing.'}`);
        }
        if (appContext.themes.length > 10) {
            parts.push(`(${appContext.themes.length - 10} additional themes are in the Wildlife tab—open each tile for the full script.)`);
        }
    }
    if (wantAnimals && appContext.animals.length) {
        const n = appContext.animals.length;
        const sample = appContext.animals.slice(0, 28).map((a) => a.name);
        const extra = n > sample.length ? ` …and ${n - sample.length} more in the full Animals list` : '';
        parts.push(
            `Animals catalogue for Bwindi: ${n} species. Examples: ${sample.join(', ')}.${extra} Open each species card for ranger-style notes, status, and etiquette—always defer to your guide and posted park rules.`
        );
        if (mentioned) {
            const sci = mentioned.scientific_name ? ` (${mentioned.scientific_name})` : '';
            parts.push(
                `Your message references “${mentioned.name}”${sci}. Cross-check habitat, seasonality, and distance rules on that species card; treat this reply as a draft, not a permit or safety briefing.`
            );
        }
    }
    let text = parts.join('\n\n');
    text = sigtsClampStr(text, 3900);
    if (locationName) {
        text += ` Nearby map label in data: ${locationName} (confirm on the ground).`;
    }
    return text;
}

function sigtsIsBwindiParkContextQuery(q) {
    if (q.includes('bwindi')) return true;
    if (/\b(buhoma|ruhija|rushaga|nkuringo)\b/i.test(q)) return true;
    if (/\bbwindi[-\s]?impenetrable\b/i.test(q)) return true;
    if (/\bimpenetrable\s+national\s+park\b/i.test(q)) return true;
    if (/\b(binp|bwindi\s+imp\.?\s*n\.?p\.?|bwindi\s+np)\b/i.test(q)) return true;
    if (/\buganda\s+wildlife\b/i.test(q) || /\buwa\b/i.test(q)) return true;
    if (/\b(kanungu|kisoro|kabale)\b/i.test(q)) return true;
    if (/\b(south-?western|southwestern)\s+uganda\b/i.test(q)) return true;
    if (/\bworld\s+heritage\b/i.test(q) && (/\b682\b/.test(q) || /\bbwindi\b/i.test(q))) return true;
    if (/\balbertine\b/i.test(q) && /\b(forest|rift|gorilla|endemic)\b/i.test(q)) return true;
    if (/\b(gorilla\s+trek|gorilla\s+tracking|habituation\s+trek|gorilla\s+habituation)\b/i.test(q)) return true;
    if (/\b(primate\s+trek|forest\s+habituation|nature\s+walk)\b/i.test(q) && /\b(uganda|bwindi|forest)\b/i.test(q)) {
        return true;
    }
    if (/\b(national\s+park)\b/i.test(q) && /\b(uganda|western|montane|rainforest)\b/i.test(q)) return true;
    if (/\b(this\s+park|the\s+park)\b/i.test(q) && /\b(visit|trek|size|rules|animals|here|sigts)\b/i.test(q)) return true;
    if (/\bimpenetrable\s+forest\b/i.test(q)) return true;
    if (/\bwestern\s+uganda\b/i.test(q)) return true;
    if (/\buganda\b/i.test(q) && /\b(forest|gorilla|trek|rainforest|primate|montane)\b/i.test(q)) return true;
    if (/\bsigts\b/i.test(q)) return true;
    return false;
}

function sigtsLooksClearlyOffTopic(q) {
    return /\b(python|javascript|typescript|sql\s+query|react\.?js|node\.?js|excel\s+formula|homework\s+problem|nba\s+score|stock\s+price|netflix|movie\s+times|recipe|pizza\s+dough|tax\s+return\s+software)\b/i.test(
        q
    );
}

function sigtsIsNatureTourismTopic(q) {
    return /\b(wildlife|trek|trekking|trail|hike|hiking|forest|jungle|rainforest|safari|monkey|ape|birding|bird\s|primates?|ranger|guide\s|permit|sightings?|ecology|conservation|national\s+park|buffer\s*zone|fauna|flora|endemic|montane|elevat|tracking)\b/i.test(
        q
    );
}

/** Match backend `isBareSocialUtterance` — must use the latest visitor message only, never the merged transcript. */
function sigtsIsBareSocialUtterance(qlLatest) {
    const inner = String(qlLatest || '')
        .trim()
        .replace(/^[\u00a1\u00bf]+\s*/i, '')
        .replace(/^[!….,\-–—:;'`"]+/, '')
        .replace(/[!….,\-–—:;'`"]+$/, '')
        .trim();
    if (!inner || inner.length > 112) return false;
    if (sigtsLooksClearlyOffTopic(inner)) return false;

    return (
        /^(hi|hello|hey|yo|sup|howdy|greetings)(\s+(there|everyone|everybody|team|buddy|friend|sir|madam|folks|again))?$/i.test(
            inner
        ) ||
        /^good\s+(morning|afternoon|evening)(\s+(there|everyone|everybody|all))?$/i.test(inner) ||
        /^thank\s+you(\s+(so\s+much|very\s+much|again))?$/i.test(inner) ||
        /^thanks(\s+(so\s+much|a\s+lot|again))?$/i.test(inner) ||
        /^ty$/i.test(inner) ||
        /^(ok+|okay+)(\s+(thanks|thank\s+you))?$/i.test(inner) ||
        /^(morning|afternoon)$/i.test(inner) ||
        /^what'?s\s+up(\s+(buddy|friend|there))?$/i.test(inner)
    );
}

function sigtsSocialGreetingReply(locationName) {
    const geo = locationName
        ? ` If the map thumbnail is open, SIGTS loosely pins you near “${locationName}”—still verify on paper maps and ranger briefings.`
        : '';
    return `Hi there—glad you’re here. I’m the in-app Bwindi guide: think of me as a calm voice before you meet your ranger team.${geo} Are you tilting toward gorilla-day logistics, forest walking & bird snippets, Culture stories here in SIGTS, or something else entirely?`;
}

function sigtsBuildBwindiScopedAnswer(question, locationName, appContext) {
    const q = sigtsNormalizeQuestion(question);
    const extras = [];
    if (/\bwhat\s+(is|are)\s+bwindi\b/.test(q) || (/\bwhat\s+is\b/.test(q) && q.includes('bwindi'))) {
        extras.push(
            'In plain terms: Bwindi is a Ugandan national park dominated by ancient montane rainforest; it is globally known for mountain gorilla tracking and for very high biodiversity in the Albertine Rift.'
        );
    }
    if (/\b(permit|fee|cost|price|ticket)\b/.test(q)) {
        extras.push(
            'Permits and fees change by season and policy: confirm the current Uganda Wildlife Authority (UWA) tariff and your issued permit details—SIGTS cannot quote live prices.'
        );
    }
    if (/\b(bird|birding|ornith)\b/.test(q)) {
        extras.push(
            'Bwindi is an Albertine Rift hotspot with many regional endemics; quiet trails, no playback near sensitive species, and ranger guidance matter.'
        );
    }
    if (/\b(season|dry|wet|when\s+to\s+visit|best\s+time)\b/.test(q)) {
        extras.push(
            'Many visitors target drier windows for comfort underfoot, but rain is always possible in montane forest—plan layers and grip footwear year-round.'
        );
    }
    if (/\b(size|area|km2|km²|hectare|acre|how\s+big)\b/.test(q)) {
        extras.push(
            'The park is often cited around 331 km² of dense montane rainforest on steep terrain—use official UWA figures for planning.'
        );
    }
    if (/\b(elevation|altitude|steep|terrain|hiking\s+hard)\b/.test(q)) {
        extras.push(
            'Expect steep, muddy, high-elevation forest walking; fitness and pacing matter more than flat-trail expectations.'
        );
    }
    if (/\b(chimp|elephant|buffalo|leopard)\b/.test(q)) {
        extras.push(
            'Large mammals and other primates occur in forest mosaics; sightings vary by sector and luck—follow distance and group conduct rules at all times.'
        );
    }
    let tail = '';
    if (appContext?.animals?.length || appContext?.themes?.length) {
        const bits = [];
        if (appContext.animals?.length) bits.push(`${appContext.animals.length} species in the Animals catalogue`);
        if (appContext.themes?.length) bits.push(`${appContext.themes.length} tour theme briefings`);
        tail = ` SIGTS for Bwindi also holds ${bits.join(' and ')} here—open the Wildlife tab for tiles and species cards.`;
    }
    const core = `Bwindi Impenetrable National Park (BINP) in southwestern Uganda protects a large block of montane rainforest famous for mountain gorillas and exceptional Albertine Rift biodiversity. Typical visitor threads are regulated gorilla tracking or habituation, guided forest walks, birding, and community-linked cultural experiences. Stay with your assigned ranger team, respect UWA distance and health rules (wildlife diseases cut both ways), avoid flash where restricted, and treat SIGTS as a planning companion—your permit, briefing, and on-ground signs override any app text.${tail}${locationName ? ` Nearby map label in SIGTS: ${locationName} (verify on the ground).` : ''}`;
    const extraBlock = extras.length ? `\n\n${extras.join('\n\n')}` : '';
    return sigtsClampStr(`${core}${extraBlock}`, 3900);
}

/** Merge prior user/assistant turns so short follow-ups still match Bwindi rule paths offline. */
function sigtsComposeLocalThreadQuestion(question, history) {
    const q = String(question || '').trim();
    const rows = Array.isArray(history) ? history : [];
    if (!rows.length) return q;
    const chunks = [];
    for (const h of rows.slice(-24)) {
        const role = h.role === 'assistant' ? 'Assistant' : 'Visitor';
        const text = String(h.text || '').trim().slice(0, 1800);
        if (!text) continue;
        chunks.push(`${role}: ${text}`);
    }
    if (!chunks.length) return q;
    chunks.push(`Follow-up: ${q}`);
    let out = chunks.join('\n\n');
    if (out.length > 8000) out = out.slice(-8000);
    return out;
}

/**
 * Same decision order as backend `buildRuleBasedAnswer` — used when /ai/chat is unavailable
 * or returns no answer, so Tour help stays useful offline.
 * @param {string} trimmed - Latest visitor message only.
 * @param {string|null} mergedThread - Same shape as backend merge (Assistant + Visitor + Follow-up); optional.
 */
function sigtsLocalTourHelpCompose(trimmed, mergedThread, appContext, locationName) {
    const ql = sigtsNormalizeQuestion(trimmed);
    const threadRaw =
        mergedThread != null && String(mergedThread).trim() !== '' ? String(mergedThread) : String(trimmed);
    const qt = sigtsNormalizeQuestion(threadRaw);

    if (!ql) return 'Please enter a question.';
    if (sigtsLooksClearlyOffTopic(ql)) {
        return 'I chat about Bwindi Impenetrable National Park only—trekking, gorillas & other wildlife context in SIGTS, map POIs cached here, Culture-tab stories, etiquette, permits in broad terms (confirm exact fees with UWA), packing, weather patterns, Buhoma/Ruhija/Rushaga/Nkuringo sector framing.\n\nThat question looks unrelated. Try something like muddy-trail footwear, gorilla-distance etiquette, Albertine birds as a visitor, Batwa-linked cultural narratives in the app—always within Bwindi.';
    }

    if (sigtsIsBareSocialUtterance(ql)) {
        return sigtsSocialGreetingReply(locationName);
    }

    if (/\bgorilla\b/i.test(ql)) {
        return `Totally fair—gorillas are why most of us memorize “Bwindi” in the first place. Stay calm, whisper when guides whisper, skip flash forever, keep that ~7 m bubble, and let rangers reposition you if branches narrow the sightline.${locationName ? ` Looks like SIGTS loosely tags you near “${locationName}”—verify with your group’s ranger map.` : ''} Want etiquette for mud & gloves next, or how Culture stories sit alongside trekking briefings?`;
    }
    if (/\bsafety\b/i.test(ql) || /\bsafe\b/i.test(ql)) {
        return `Safety first—it’s steep forest, slippery roots, and occasional wildlife corridors. Stick to ranger lines, shout if you tumble (so the sweep hears you), hydrate before you slam elevation, and never split the formation for a selfie.${locationName ? ` SIGTS pings you loosely around “${locationName}”; never treat that dot as evacuation intel.` : ''} Need health/packing angles or large-mammal etiquette?`;
    }
    if (/\b(weather|rain|rainy)\b/i.test(ql)) {
        return `Cloud forest mood: mist can flirt with sunshine on the same ascent. Toss a breathable rain shell plus quick-drying layers in your sack even if sunrise looks tame—trail shoes with real bite trump fashion trainers every time.\n\nIf you’d rather talk dry-season pacing vs rainforest drizzle psychology, poke me either way.`;
    }
    if (/\b(culture|cultural|batwa|bakiga)\b/i.test(ql)) {
        return `Culture here isn’t garnish—it’s intertwined with stewardship of the ridges. Dive into SIGTS Culture cards for narrator-approved Batwa/Bakiga stories, then treat community visits like listening sessions: ask before recording, honor taboos spelled out inside each card, and defer to interpreters on compensation norms.\n\nCurious where cultural walks meet gorilla-sector logistics? Say the word.`;
    }
    if (/\b(route|routes|map|direction)\b/i.test(ql)) {
        return `Map tab is your campfire GPS inside SIGTS: gate labels, lodges, viewpoints, and ranger POIs—but paper park maps still win offline surprises.${locationName ? ` Rough pin: “${locationName}”; please double-check onsite.` : ''} Want sector-by-sector moods (Buhoma vs Rushaga energy) instead?`;
    }

    const fromCat = sigtsLocalAnswerFromAppContext(trimmed, threadRaw, appContext, locationName);
    if (fromCat) return fromCat;

    if (sigtsIsBwindiParkContextQuery(qt) || sigtsIsNatureTourismTopic(qt)) {
        return sigtsBuildBwindiScopedAnswer(threadRaw, locationName, appContext);
    }

    return `Hmm—I’m happiest when we’re unpacking Bwindi together: trekking headspace, mammal & bird breadcrumbs in the Animals catalogue, Culture narrators stored here, FAQs, soggy-boot logistics, permits at a conceptual level (UWA tariffs change), or sector vibes across Buhoma, Ruhija, Rushaga, Nkuringo.\n\nI’ll gently bounce truly off-grid topics.\n\nPick one itch—mud dread, binocular ethics, Batwa storyline timing, whichever—and we’ll riff from this cached SIGTS playbook offline.`;
}

/** 3.1.1.6 — local persistence for profiling, popularity, feedback, offline query log */
const SIGTS_AI_PROFILE_KEY = 'sigts_ai_user_profile_v1';
const SIGTS_AI_POPULARITY_KEY = 'sigts_ai_popularity_v1';
const SIGTS_POPULARITY_WINDOW_DAYS = 30;
const SIGTS_POPULARITY_DEBOUNCE_MS = 2500;
const SIGTS_POPULARITY_MAX_KEYS = 240;
const SIGTS_AI_RECO_FEEDBACK_KEY = 'sigts_ai_reco_feedback_v1';
const SIGTS_AI_CHAT_FEEDBACK_KEY = 'sigts_ai_chat_feedback_v1';
const SIGTS_AI_QUERY_LOG_KEY = 'sigts_ai_query_log_v1';
const SIGTS_AI_TRAINING_SIGNAL_KEY = 'sigts_ai_training_signal_v1';

const BWINDI_TOUR_CATALOG = [
    { id: 'gorilla_tracking', name: 'Mountain gorilla tracking', tags: ['wildlife', 'primate', 'trek'], seasonBoost: ['dry', 'wet'] },
    { id: 'gorilla_habituation', name: 'Gorilla habituation experience', tags: ['wildlife', 'primate', 'trek'], seasonBoost: ['dry', 'wet'] },
    { id: 'forest_nature_walk', name: 'Forest nature walk', tags: ['nature', 'forest', 'bird'], seasonBoost: ['wet', 'dry'] },
    { id: 'birding_albertine', name: 'Albertine Rift birding', tags: ['bird', 'wildlife', 'forest'], seasonBoost: ['dry', 'wet'] },
    { id: 'batwa_cultural', name: 'Batwa cultural trail', tags: ['culture', 'heritage'], seasonBoost: ['wet', 'dry'] },
    { id: 'community_crafts', name: 'Buffer-zone community visit', tags: ['culture', 'community'], seasonBoost: ['dry', 'wet'] },
    { id: 'photography_briefing', name: 'Photography & field etiquette', tags: ['photography', 'wildlife'], seasonBoost: ['dry', 'wet'] },
    { id: 'primate_other', name: 'Other primate tracking', tags: ['wildlife', 'primate'], seasonBoost: ['dry', 'wet'] }
];

function sigtsAiReadJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (raw == null || raw === '') return fallback;
        const v = JSON.parse(raw);
        return v === undefined ? fallback : v;
    } catch (_) {
        return fallback;
    }
}

function sigtsAiWriteJson(key, val) {
    try {
        localStorage.setItem(key, JSON.stringify(val));
    } catch (_) {
        /**/
    }
}

class AIRecommendationEngine {
    constructor() {
        this.queryHistory = [];
        this._lastPopularityRecord = null;
    }

    _normalizeContentKey(contentType, contentId) {
        const type = String(contentType || 'view').trim().toLowerCase();
        let id = String(contentId || 'unknown').trim();
        if (type === 'tab' && id === 'animals') id = 'wildlife';
        return `${type}:${id}`;
    }

    _popDayKey(ts = Date.now()) {
        return new Date(ts).toISOString().slice(0, 10);
    }

    _popRecentCount(entry, windowDays = SIGTS_POPULARITY_WINDOW_DAYS) {
        if (!entry || typeof entry !== 'object') return 0;
        if (entry.daily && typeof entry.daily === 'object') {
            const minDay = this._popDayKey(Date.now() - windowDays * 86400000);
            return Object.entries(entry.daily).reduce(
                (sum, [day, n]) => (day >= minDay ? sum + (Number(n) || 0) : sum),
                0
            );
        }
        const lastAt = Number(entry.lastAt) || 0;
        if (lastAt < Date.now() - windowDays * 86400000) return 0;
        return Number(entry.count) || 0;
    }

    _pruneDailyBuckets(daily) {
        const minDay = this._popDayKey(Date.now() - 90 * 86400000);
        const next = {};
        Object.entries(daily || {}).forEach(([day, n]) => {
            const c = Number(n) || 0;
            if (day >= minDay && c > 0) next[day] = c;
        });
        return next;
    }

    _prunePopularityDoc(pop) {
        const keys = Object.keys(pop || {});
        if (keys.length <= SIGTS_POPULARITY_MAX_KEYS) return pop;
        const ranked = keys
            .map((k) => ({
                k,
                score: this._popRecentCount(pop[k]),
                lastAt: Number(pop[k]?.lastAt) || 0
            }))
            .sort((a, b) => b.score - a.score || b.lastAt - a.lastAt);
        const keep = new Set(ranked.slice(0, SIGTS_POPULARITY_MAX_KEYS).map((r) => r.k));
        const next = {};
        keys.forEach((k) => {
            if (keep.has(k)) next[k] = pop[k];
        });
        return next;
    }

    async buildAppContextForTourHelp() {
        if (typeof Content === 'undefined' || !Content.getWildlifeTourThemes || !Content.getAnimals) {
            return null;
        }
        try {
            const settled = await Promise.allSettled([
                Content.getWildlifeTourThemes(),
                Content.getAnimals(),
                Content.getLocations?.(),
                Content.getCulturalStories?.(),
                typeof API !== 'undefined' && API.getFaqs ? API.getFaqs() : Promise.resolve([]),
                typeof API !== 'undefined' && API.getTouristBiodiversity ? API.getTouristBiodiversity() : Promise.resolve(null),
                typeof API !== 'undefined' && API.getParkWeatherForecast ? API.getParkWeatherForecast() : Promise.resolve(null),
                typeof API !== 'undefined' && API.getContentCatalogMeta ? API.getContentCatalogMeta() : Promise.resolve(null),
            ]);

            const pick = (i, fallback) => (settled[i].status === 'fulfilled' ? settled[i].value : fallback);
            const themes = pick(0, []);
            const animals = pick(1, []);
            const locations = pick(2, []);
            const stories = pick(3, []);
            const faqs = pick(4, []);
            const biodiv = pick(5, null);
            const weather = pick(6, null);
            const catalogMeta = pick(7, null);

            const themeList = (Array.isArray(themes) ? themes : []).slice(0, 24).map((t) => ({
                slug: t.slug,
                session_title: t.session_title,
                subtitle: t.subtitle,
                tourist_summary_en:
                    typeof t.tourist_summary_en === 'string' ? t.tourist_summary_en.slice(0, 650) : '',
            }));

            const animalList = (Array.isArray(animals) ? animals : []).slice(0, 300).map((a) => ({
                name: a.name,
                scientific_name: a.scientific_name || a.scientific,
            }));

            const locationList = (Array.isArray(locations) ? locations : []).slice(0, 48).map((l) => ({
                name: l.name,
                location_type: l.location_type || l.type,
                description: typeof l.description === 'string' ? l.description.slice(0, 280) : '',
            }));

            const storyList = (Array.isArray(stories) ? stories : []).slice(0, 24).map((s) => ({
                title: s.title_en || s.title,
                community: s.community,
                summary:
                    typeof s.narrative_en === 'string'
                        ? s.narrative_en.slice(0, 400)
                        : typeof s.story === 'string'
                          ? s.story.slice(0, 400)
                          : '',
            }));

            const faqList = (Array.isArray(faqs) ? faqs : []).slice(0, 32).map((f) => ({
                question: f.question_en || f.question,
                answer: typeof (f.answer_en || f.answer) === 'string' ? (f.answer_en || f.answer).slice(0, 400) : '',
                category: f.category,
            }));

            const safetySpecies = Array.isArray(biodiv?.species)
                ? biodiv.species.slice(0, 14).map((s) => ({
                      name: s.name,
                      safety_tip: s.safety_tip || '',
                  }))
                : [];

            const weatherCapsule = weather
                ? {
                      condition: weather.condition,
                      temperatureC: weather.temperatureC,
                      rainProbabilityPct: weather.rainProbabilityPct,
                  }
                : null;

            const metaCounts = catalogMeta?.counts
                ? { animals: catalogMeta.counts.animals, locations: catalogMeta.counts.locations }
                : { animals: animalList.length, locations: locationList.length };

            if (
                !themeList.length &&
                !animalList.length &&
                !locationList.length &&
                !storyList.length &&
                !faqList.length
            ) {
                return null;
            }

            return {
                themes: themeList,
                animals: animalList,
                locations: locationList,
                stories: storyList,
                faqs: faqList,
                safety_species: safetySpecies,
                weather: weatherCapsule,
                catalog_meta: metaCounts,
            };
        } catch (_) {
            return null;
        }
    }

    _defaultInterests() {
        return ['wildlife', 'nature'];
    }

    _loadProfileDoc() {
        const doc = sigtsAiReadJson(SIGTS_AI_PROFILE_KEY, {});
        const legacy = localStorage.getItem('userInterests');
        let interests = Array.isArray(doc.interests) && doc.interests.length ? doc.interests : this._defaultInterests();
        if ((!doc.interests || !doc.interests.length) && legacy) {
            try {
                const p = JSON.parse(legacy);
                if (Array.isArray(p) && p.length) interests = p;
            } catch (_) {
                /**/
            }
        }
        interests = interests.map((x) => String(x || '').trim().toLowerCase()).filter(Boolean);
        if (!interests.length) interests = this._defaultInterests();
        return {
            interests,
            viewCounts: doc.viewCounts && typeof doc.viewCounts === 'object' ? doc.viewCounts : {},
            searchHistory: Array.isArray(doc.searchHistory) ? doc.searchHistory.slice(-80) : [],
            topicWeights: doc.topicWeights && typeof doc.topicWeights === 'object' ? doc.topicWeights : {}
        };
    }

    _saveProfileDoc(doc) {
        sigtsAiWriteJson(SIGTS_AI_PROFILE_KEY, { ...doc, updatedAt: new Date().toISOString() });
        try {
            localStorage.setItem('userInterests', JSON.stringify(doc.interests || this._defaultInterests()));
        } catch (_) {
            /**/
        }
    }

    saveTourInterestsForAi(interests) {
        const list = (Array.isArray(interests) ? interests : [])
            .map((t) => String(t || '').trim().toLowerCase())
            .filter(Boolean);
        const doc = this._loadProfileDoc();
        doc.interests = list.length ? list : this._defaultInterests();
        this._saveProfileDoc(doc);
        return doc.interests;
    }

    recordContentView(contentType, contentId, tags = []) {
        const key = this._normalizeContentKey(contentType, contentId);
        const now = Date.now();
        if (
            this._lastPopularityRecord?.key === key &&
            now - (Number(this._lastPopularityRecord.at) || 0) < SIGTS_POPULARITY_DEBOUNCE_MS
        ) {
            return;
        }
        this._lastPopularityRecord = { key, at: now };

        const doc = this._loadProfileDoc();
        doc.viewCounts[key] = (Number(doc.viewCounts[key]) || 0) + 1;
        const tagList = Array.isArray(tags) ? tags : [];
        tagList.forEach((t) => {
            const k = String(t || '').trim().toLowerCase();
            if (!k) return;
            doc.topicWeights[k] = (Number(doc.topicWeights[k]) || 0) + 0.35;
        });
        this._saveProfileDoc(doc);

        let pop = sigtsAiReadJson(SIGTS_AI_POPULARITY_KEY, {});
        const prev = pop[key] && typeof pop[key] === 'object' ? pop[key] : { count: 0 };
        const daily = this._pruneDailyBuckets(prev.daily);
        const dayKey = this._popDayKey(now);
        daily[dayKey] = (Number(daily[dayKey]) || 0) + 1;
        const parts = key.split(':');
        pop[key] = {
            count: (Number(prev.count) || 0) + 1,
            lastAt: now,
            daily,
            type: parts[0] || contentType,
            id: parts.slice(1).join(':') || String(contentId || '')
        };
        pop = this._prunePopularityDoc(pop);
        sigtsAiWriteJson(SIGTS_AI_POPULARITY_KEY, pop);
    }

    recordSearchQuery(text) {
        const q = String(text || '').trim();
        if (q.length < 2 || q.length > 400) return;
        const doc = this._loadProfileDoc();
        doc.searchHistory.push({ q, at: Date.now() });
        doc.searchHistory = doc.searchHistory.slice(-80);
        this._saveProfileDoc(doc);
    }

    async getUserProfile() {
        const doc = this._loadProfileDoc();
        const interestVector = {};
        doc.interests.forEach((i) => {
            interestVector[i] = (Number(interestVector[i]) || 0) + 1;
        });
        Object.keys(doc.topicWeights).forEach((k) => {
            interestVector[k] = (Number(interestVector[k]) || 0) + Number(doc.topicWeights[k]) || 0;
        });
        const pref = Object.values(interestVector).reduce((a, b) => a + b, 0);
        const preferenceScore = Math.min(1, pref / (pref + 4));
        return {
            interests: doc.interests,
            interestVector,
            preferenceScore: Number(preferenceScore.toFixed(3)),
            viewCounts: doc.viewCounts,
            searchHistory: doc.searchHistory.slice(-12)
        };
    }

    _recoFeedbackMap() {
        return sigtsAiReadJson(SIGTS_AI_RECO_FEEDBACK_KEY, {});
    }

    recordRecommendationFeedback(tourId, rating) {
        const id = String(tourId || '').trim();
        if (!id) return;
        const r = Math.max(1, Math.min(5, Number(rating) || 3));
        const map = this._recoFeedbackMap();
        const prev = map[id] && typeof map[id] === 'object' ? map[id] : { sum: 0, n: 0 };
        map[id] = { sum: prev.sum + r, n: prev.n + 1, lastAt: Date.now() };
        sigtsAiWriteJson(SIGTS_AI_RECO_FEEDBACK_KEY, map);
        const train = sigtsAiReadJson(SIGTS_AI_TRAINING_SIGNAL_KEY, []);
        train.push({ kind: 'recommendation_rating', tourId: id, rating: r, at: Date.now() });
        sigtsAiWriteJson(SIGTS_AI_TRAINING_SIGNAL_KEY, train.slice(-200));
    }

    recordChatReplyFeedback(helpful, questionSnippet = '') {
        const list = sigtsAiReadJson(SIGTS_AI_CHAT_FEEDBACK_KEY, []);
        list.push({ helpful: Boolean(helpful), q: String(questionSnippet || '').slice(0, 200), at: Date.now() });
        sigtsAiWriteJson(SIGTS_AI_CHAT_FEEDBACK_KEY, list.slice(-200));
        const train = sigtsAiReadJson(SIGTS_AI_TRAINING_SIGNAL_KEY, []);
        train.push({ kind: 'chat_helpfulness', helpful: Boolean(helpful), at: Date.now() });
        sigtsAiWriteJson(SIGTS_AI_TRAINING_SIGNAL_KEY, train.slice(-200));
    }

    getLastTrainingSignals(limit = 20) {
        return sigtsAiReadJson(SIGTS_AI_TRAINING_SIGNAL_KEY, []).slice(-limit);
    }

    getOfflineQueryLog(limit = 30) {
        return sigtsAiReadJson(SIGTS_AI_QUERY_LOG_KEY, []).slice(-limit);
    }

    _logQueryEntry(entry) {
        const log = sigtsAiReadJson(SIGTS_AI_QUERY_LOG_KEY, []);
        log.push({ ...entry, at: Date.now() });
        sigtsAiWriteJson(SIGTS_AI_QUERY_LOG_KEY, log.slice(-120));
    }

    buildTimeContextNote() {
        const h = new Date().getHours();
        const loc = AppState?.currentLocation;
        const hasLoc = loc && Number.isFinite(Number(loc.lat)) && Number.isFinite(Number(loc.lng));
        let t = '';
        if (h < 11) t = 'Local time note: morning forest treks often start cool with heavy dew—grip footwear and rain shell.';
        else if (h >= 17) t = 'Local time note: light fades early under canopy—plan headlamps for exits and lodge transfers.';
        else t = 'Local time note: midday heat in clearings can contrast with cool forest core—carry water.';
        if (hasLoc) t += ' GPS context is available for map-aware replies when online.';
        return t;
    }

    _deriveLocalSources(trimmed, appContext) {
        const s = ['SIGTS on-device interpreter (rule stack + Bwindi knowledge base)'];
        if (appContext?.animals?.length) s.push(`Animals catalogue snapshot (${appContext.animals.length} species)`);
        if (appContext?.themes?.length) s.push(`tour theme briefings (${appContext.themes.length} tiles)`);
        if (trimmed.length) s.push(`User question (${trimmed.length} chars)`);
        return s;
    }

    async getRecommendations(limit = 6) {
        const profile = await this.getUserProfile();
        const seasonal = await this.getSeasonalRecommendations();
        const fb = this._recoFeedbackMap();
        const scored = BWINDI_TOUR_CATALOG.map((tour) => {
            let score = 0.55;
            const tagHits = tour.tags.filter((tag) => profile.interests.includes(tag)).length;
            score += tagHits * 0.12;
            tour.tags.forEach((tag) => {
                score += (Number(profile.interestVector[tag]) || 0) * 0.04;
            });
            if (tour.seasonBoost && tour.seasonBoost.includes(seasonal.season)) {
                score += 0.06;
            }
            const f = fb[tour.id];
            if (f && f.n > 0) {
                score += ((f.sum / f.n) - 3) * 0.04;
            }
            const reasonParts = [];
            if (tagHits) reasonParts.push(`${tagHits} tag match(es) to your interests`);
            if (f && f.n >= 2) reasonParts.push(`avg rating ${(f.sum / f.n).toFixed(1)}/5 from your feedback`);
            else reasonParts.push('popularity-weighted default for BINP visitors');
            if (tour.seasonBoost && tour.seasonBoost.includes(seasonal.season)) reasonParts.push(`fits ${seasonal.season} season pacing`);
            return {
                id: tour.id,
                name: tour.name,
                score: Math.min(0.99, Math.max(0.35, score)),
                reason: reasonParts.join(' • ')
            };
        });
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, limit);
    }

    async askQuestion(question, options = {}) {
        const history = Array.isArray(options.history) ? options.history : [];
        const trimmed = (question || '').trim();
        if (!trimmed) {
            return { answer: 'Please enter a question.', meta: {} };
        }

        this.recordSearchQuery(trimmed);
        this.queryHistory.push({ q: trimmed, at: Date.now() });
        if (this.queryHistory.length > 40) this.queryHistory.shift();

        let appContext = null;
        try {
            appContext = await this.buildAppContextForTourHelp();
        } catch (_) {
            appContext = null;
        }

        const payload = {
            question: trimmed,
            language: 'en',
            client_time: new Date().toISOString()
        };

        if (appContext) {
            payload.app_context = appContext;
        }

        if (AppState.currentLocation?.lat && AppState.currentLocation?.lng) {
            payload.location = {
                lat: AppState.currentLocation.lat,
                lng: AppState.currentLocation.lng
            };
        }

        if (history.length) {
            payload.history = history.slice(-24);
        }

        const timeHint = this.buildTimeContextNote();

        try {
            if (navigator.onLine) {
                const result = await API.request('/ai/chat', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                if (result && result.success && result.answer) {
                    const meta = {
                        ...(result.meta || {}),
                        knowledge_base:
                            result.meta?.nlp_mode === 'llm_grounded_v1'
                                ? 'SIGTS LLM grounded on live database + device catalogue'
                                : 'BINP + SIGTS curated rules',
                    };
                    if (!meta.sources || !meta.sources.length) {
                        meta.sources = [
                            'Server park interpreter',
                            ...(appContext?.animals?.length ? [`Animals snapshot (${appContext.animals.length})`] : []),
                            ...(appContext?.themes?.length ? [`Tour themes (${appContext.themes.length})`] : []),
                            ...(meta.location_name ? [`Nearest POI label: ${meta.location_name}`] : [])
                        ];
                    }
                    if (timeHint && !meta.time_context) meta.time_context = timeHint;
                    this._logQueryEntry({ channel: 'online', question: trimmed, responseChars: String(result.answer).length });
                    return {
                        answer: result.answer,
                        meta
                    };
                }
            }
        } catch (error) {
            /**/
        }

        const locName = null;
        const threadQ = history.length ? sigtsComposeLocalThreadQuestion(trimmed, history) : null;
        const localAnswer = sigtsLocalTourHelpCompose(trimmed, threadQ, appContext, locName);
        const meta = {
            local_fallback: true,
            offline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
            sources: this._deriveLocalSources(trimmed, appContext),
            time_context: timeHint,
            knowledge_base: 'Offline SIGTS interpreter + cached catalogue'
        };
        this._logQueryEntry({ channel: 'offline', question: trimmed, responseChars: String(localAnswer).length });
        return {
            answer: localAnswer,
            meta
        };
    }

    /** Voice path: browser supplies transcript (Web Speech API); optional server STT can wrap this later. */
    async askQuestionFromVoiceTranscript(transcript) {
        const t = String(transcript || '').trim();
        if (!t) {
            return { answer: 'No transcribed speech to answer yet.', meta: { voice: true, empty_transcript: true } };
        }
        const out = await this.askQuestion(t);
        return {
            ...out,
            meta: { ...(out.meta || {}), voice: true, voice_transcript: t }
        };
    }

    async getPersonalizedContentFeed(limit = 4) {
        if (typeof Content === 'undefined') return [];
        const profile = await this.getUserProfile();
        const pop = sigtsAiReadJson(SIGTS_AI_POPULARITY_KEY, {});
        const popScore = (type, id) => {
            const k = this._normalizeContentKey(type, id);
            const row = pop[k];
            return this._popRecentCount(row);
        };

        let animals = [];
        let stories = [];
        try {
            [animals, stories] = await Promise.all([Content.getAnimals(), Content.getCulturalStories()]);
        } catch (_) {
            return [];
        }
        animals = Array.isArray(animals) ? animals : [];
        stories = Array.isArray(stories) ? stories : [];

        const scoredAnimals = animals.slice(0, 120).map((a) => {
            const name = String(a.name || '').toLowerCase();
            const status = String(a.conservation_status || a.status || '').toLowerCase();
            let rel = 0.5;
            profile.interests.forEach((tag) => {
                if (tag === 'wildlife' && /(gorilla|monkey|ape|elephant|bird|butterfly|frog)/.test(name)) rel += 0.08;
                if (tag === 'bird' && /(bird|eagle|turaco|robin|sunbird|crane)/.test(name)) rel += 0.12;
                if (tag === 'culture' && /(batwa|human)/.test(name)) rel += 0.05;
            });
            rel += Math.min(0.2, popScore('animal', a.animal_id || a.id) * 0.02);
            if (/endangered|vulnerable|critically/.test(status)) rel += 0.05;
            return {
                id: String(a.animal_id || a.id),
                name: a.name || 'Species',
                type: 'animal',
                tags: ['wildlife'],
                relevanceScore: Math.min(0.99, rel)
            };
        });
        const scoredStories = stories.slice(0, 40).map((s) => {
            let rel = 0.52;
            if (profile.interests.includes('culture')) rel += 0.15;
            rel += Math.min(0.15, popScore('story', s.narrative_id || s.id) * 0.02);
            return {
                id: String(s.narrative_id || s.id),
                name: s.title_en || 'Story',
                type: 'cultural',
                tags: ['culture'],
                relevanceScore: Math.min(0.99, rel)
            };
        });
        return [...scoredAnimals, ...scoredStories].sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, limit);
    }

    async getTrendingContent(limit = 6) {
        const pop = sigtsAiReadJson(SIGTS_AI_POPULARITY_KEY, {});
        const excludedTabs = new Set(['login', 'register', 'reset_password']);
        const rows = Object.entries(pop)
            .map(([k, v]) => {
                const parts = k.split(':');
                const type = parts[0] || 'view';
                const id = parts.slice(1).join(':') || '';
                const recentCount = this._popRecentCount(v);
                const lastAt = v && typeof v === 'object' ? Number(v.lastAt) || 0 : 0;
                const count = v && typeof v === 'object' ? Number(v.count) || 0 : 0;
                return { key: k, type, id, count, recentCount, lastAt };
            })
            .filter((r) => r.recentCount > 0)
            .filter((r) => !(r.type === 'tab' && excludedTabs.has(r.id)))
            .sort(
                (a, b) =>
                    b.recentCount - a.recentCount ||
                    b.lastAt - a.lastAt ||
                    String(a.id).localeCompare(String(b.id))
            )
            .slice(0, limit);
        let animals = [];
        let stories = [];
        try {
            if (typeof Content !== 'undefined') {
                [animals, stories] = await Promise.all([Content.getAnimals(), Content.getCulturalStories()]);
            }
        } catch (_) {
            /**/
        }
        const animalById = new Map((animals || []).map((a) => [String(a.animal_id || a.id), a]));
        const storyById = new Map((stories || []).map((s) => [String(s.narrative_id || s.id), s]));
        const tabLabels = {
            wildlife: 'Wildlife',
            animals: 'Wildlife',
            map: 'Map',
            culture: 'Culture',
            info: 'Park info',
            dashboard: 'Home',
            ai_chat: 'Tour help',
            sightings: 'Sightings',
            saved: 'Saved',
            profile: 'Profile',
            it_dashboard: 'IT Admin',
            it_predictive_analytics: 'Predictive Analytics',
            it_tour_assignments: 'Tour assignments',
            guide_dashboard: 'Guide dashboard',
            intranet: 'Staff intranet'
        };
        return rows.map((r) => {
            let name = r.id;
            if (r.type === 'animal') {
                name = animalById.get(r.id)?.name || `Species ${r.id.slice(0, 8)}`;
            } else if (r.type === 'cultural' || r.type === 'story') {
                name = storyById.get(r.id)?.title_en || `Story ${r.id.slice(0, 8)}`;
            } else if (r.type === 'tab') {
                name =
                    tabLabels[r.id] ||
                    String(r.id)
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, (c) => c.toUpperCase());
            }
            const n = r.recentCount;
            const reason =
                n === 1
                    ? `1 view in the last ${SIGTS_POPULARITY_WINDOW_DAYS} days on this device`
                    : `${n} views in the last ${SIGTS_POPULARITY_WINDOW_DAYS} days on this device`;
            return {
                id: r.id,
                type: r.type,
                name,
                trendScore: r.recentCount,
                reason
            };
        });
    }

    async getSimilarContent(contentType, contentId, limit = 6) {
        if (typeof Content === 'undefined' || !contentId) return [];
        const id = String(contentId);
        const animals = await Content.getAnimals().catch(() => []);
        if (contentType === 'animal' && Array.isArray(animals)) {
            const cur = animals.find((a) => String(a.animal_id || a.id) === id);
            if (!cur) return [];
            const status = String(cur.conservation_status || cur.status || '').toLowerCase();
            const tokens = String(cur.name || '')
                .toLowerCase()
                .split(/\s+/)
                .filter((w) => w.length > 2);
            return animals
                .filter((a) => String(a.animal_id || a.id) !== id)
                .map((a) => {
                    let s = 0.3;
                    const an = String(a.name || '').toLowerCase();
                    if (String(a.conservation_status || a.status || '').toLowerCase() === status) s += 0.25;
                    tokens.forEach((t) => {
                        if (an.includes(t)) s += 0.12;
                    });
                    const popRow =
                        sigtsAiReadJson(SIGTS_AI_POPULARITY_KEY, {})[
                            this._normalizeContentKey('animal', a.animal_id || a.id)
                        ];
                    const pc = this._popRecentCount(popRow);
                    s += Math.min(0.2, pc * 0.02);
                    return { id: String(a.animal_id || a.id), name: a.name, type: 'animal', similarity: Math.min(0.99, s) };
                })
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, limit);
        }
        if (contentType === 'location' && Content.getLocations) {
            const locs = await Content.getLocations().catch(() => []);
            return (Array.isArray(locs) ? locs : [])
                .filter((l) => String(l.location_id || l.id) !== id)
                .slice(0, limit)
                .map((l) => ({
                    id: String(l.location_id || l.id),
                    name: l.name || 'Location',
                    type: 'location',
                    similarity: 0.55
                }));
        }
        return [];
    }

    async getSeasonalRecommendations() {
        const month = new Date().getMonth();
        const hour = new Date().getHours();
        const isDry = (month >= 5 && month <= 7) || (month >= 11 || month <= 1);
        const season = isDry ? 'dry' : 'wet';
        const recs =
            season === 'dry'
                ? ['Gorilla trekking (firmer trails)', 'Albertine birding', 'Photography decks']
                : ['Forest nature walks', 'Cultural indoor sessions', 'Moss ecology interpretation'];
        let timeBand = 'midday';
        if (hour < 6) timeBand = 'night';
        else if (hour < 12) timeBand = 'morning';
        else if (hour < 17) timeBand = 'afternoon';
        else timeBand = 'evening';
        let conditionNote =
            season === 'wet'
                ? 'Wet-season pacing: expect slower trail segments; plan rain layers.'
                : 'Dry-season pacing: dustier ridges; carry extra water on exposed climbs.';
        try {
            if (typeof API !== 'undefined' && API.getParkWeatherForecast) {
                const w = await API.getParkWeatherForecast();
                if (w?.condition) {
                    conditionNote += ` Live forecast: ${w.condition}, ${w.temperatureC ?? '—'}°C.`;
                }
            }
        } catch (_) {
            /**/
        }
        return {
            season,
            recommendations: recs,
            hour,
            timeBand,
            month,
            conditionNote
        };
    }
}

// =====================================================
// 3.1.1.9 OFFLINE SYNC MANAGER (COMPLETE)
// =====================================================
class OfflineSyncManager {
    constructor() {
        this.isSyncing = false;
        this.pendingItems = [];
        this.maxAttempts = 5;
        this.loadQueue();
        window.addEventListener('online', () => this.processQueue());
        window.setInterval(() => {
            if (navigator.onLine && this.pendingItems.length) this.processQueue();
        }, 45000);
    }

    loadQueue() {
        try {
            this.pendingItems = JSON.parse(localStorage.getItem('sync_queue') || '[]');
        } catch (_) {
            this.pendingItems = [];
        }
    }

    _persistQueue() {
        localStorage.setItem('sync_queue', JSON.stringify(this.pendingItems));
        window.refreshNetworkStatusBadge?.();
    }

    _backoffMs(attempts) {
        return Math.min(60000, 2000 * 2 ** Math.min(attempts, 5));
    }

    async addToQueue(action, data) {
        this.pendingItems.push({
            id: Date.now(),
            action,
            data,
            attempts: 0,
            lastError: null,
            queuedAt: new Date().toISOString(),
        });
        this._persistQueue();
        if (navigator.onLine) await this.processQueue();
    }

    async processQueue() {
        if (this.isSyncing || !navigator.onLine) return;
        const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (conn?.saveData && this.pendingItems.length < 3) return;
        this.isSyncing = true;
        const items = [...this.pendingItems];
        for (const item of items) {
            if ((item.attempts || 0) >= this.maxAttempts) continue;
            const wait = this._backoffMs(item.attempts || 0);
            if (item.nextRetryAt && Date.now() < new Date(item.nextRetryAt).getTime()) continue;
            try {
                let success = false;
                switch (item.action) {
                    case 'sighting':
                        success = await this.syncSighting(item.data);
                        break;
                    case 'feedback':
                        success = await this.syncFeedback(item.data);
                        break;
                }
                if (success) {
                    this.pendingItems = this.pendingItems.filter((i) => i.id !== item.id);
                } else {
                    item.attempts = (item.attempts || 0) + 1;
                    item.lastError = 'Server rejected payload';
                    item.nextRetryAt = new Date(Date.now() + this._backoffMs(item.attempts)).toISOString();
                }
            } catch (error) {
                item.attempts = (item.attempts || 0) + 1;
                item.lastError = String(error?.message || error || 'sync failed');
                item.nextRetryAt = new Date(Date.now() + this._backoffMs(item.attempts)).toISOString();
            }
        }
        this._persistQueue();
        this.isSyncing = false;
    }

    getFailedCount() {
        return this.pendingItems.filter((i) => (i.attempts || 0) >= this.maxAttempts).length;
    }

    async syncSighting(data) {
        const payload = data && typeof data === 'object' ? data : {};
        const result = await API.reportSighting(payload);
        return Boolean(result && (result.sighting_id || result.id || result.success));
    }

    async syncFeedback(data) {
        const payload = data && typeof data === 'object' ? data : {};
        const normalized = {
            rating: Number(payload.rating) >= 1 && Number(payload.rating) <= 5 ? Number(payload.rating) : 4,
            comment: String(payload.comment || payload.text || '').trim() || null,
            category: String(payload.category || 'general').trim() || 'general',
            tour_session_id: payload.tour_session_id || null,
            tourguide_id: payload.tourguide_id || null,
            source_content_id: payload.source_content_id || null,
            source_content_type: payload.source_content_type || null,
            nps_score: Number.isInteger(payload.nps_score) ? payload.nps_score : null,
            helpfulness_rating: Number.isInteger(payload.helpfulness_rating) ? payload.helpfulness_rating : null,
            screenshot_url: payload.screenshot_url || null
        };
        const result = await API.submitFeedback(normalized);
        return Boolean(result?.success && result.feedback);
    }
    getPendingCount() {
        return this.pendingItems.filter((i) => (i.attempts || 0) < this.maxAttempts).length;
    }

    getQueueSummary() {
        const pending = this.getPendingCount();
        const failed = this.getFailedCount();
        return { pending, failed, total: this.pendingItems.length };
    }
}

// =====================================================
// INTRANET MANAGER - HR, Announcements, Inventory (BLENDED)
// =====================================================
class IntranetManager {
    constructor() {
        this.initIntranetData();
    }

    initIntranetData() {
        /** No static HR/inventory demo rows — panel and intranet must reflect PostgreSQL via /api/intranet/*. */
    }

    /** Drop legacy browser-only demo rows so IT views cannot show stale static counts. */
    clearLegacyDemoIntranetCache() {
        ['inventory_items', 'hr_employees'].forEach((key) => {
            try {
                localStorage.removeItem(key);
            } catch (_) {
                /**/
            }
        });
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
        try {
            const result = await API.request('/intranet/inventory');
            if (result && !result.error) {
                const items = Array.isArray(result.items) ? result.items : [];
                const normalized = items.map((item) => ({
                    id: item.inventory_item_id,
                    name: item.name,
                    quantity: item.quantity,
                    category: item.category,
                    status: item.status
                }));
                localStorage.setItem('sigts_inventory_api_cache', JSON.stringify(normalized));
                return normalized;
            }
        } catch (_) {
            /** API unavailable — use last successful API cache only */
        }
        try {
            const cached = localStorage.getItem('sigts_inventory_api_cache');
            if (cached) return JSON.parse(cached);
        } catch (_) {
            /**/
        }
        return [];
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
        try {
            const result = await API.request('/intranet/employees');
            if (result && !result.error) {
                const employees = Array.isArray(result.employees) ? result.employees : [];
                const normalized = employees.map((e) => ({
                    id: e.employee_id,
                    name: e.name,
                    role: e.role,
                    department: e.department,
                    status: e.status,
                    hireDate: e.hire_date
                }));
                localStorage.setItem('sigts_hr_employees_api_cache', JSON.stringify(normalized));
                return normalized;
            }
        } catch (_) {
            /** API unavailable — use last successful API cache only */
        }
        try {
            const cached = localStorage.getItem('sigts_hr_employees_api_cache');
            if (cached) return JSON.parse(cached);
        } catch (_) {
            /**/
        }
        return [];
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
        try {
            const snap = await API.getAdminOperationalSnapshot(5);
            if (snap && !snap.error && snap.totalStaff != null) {
                return {
                    totalStaff: Number(snap.totalStaff) || 0,
                    guidesOnDuty: Number(snap.guidesOnDuty) || 0,
                    itStaff: 0
                };
            }
        } catch (_) {
            /**/
        }
        const employees = await this.getEmployees();
        if (!employees.length) {
            return { totalStaff: 0, guidesOnDuty: 0, itStaff: 0 };
        }
        const totalStaff = employees.filter((e) => e.status === 'active').length;
        const guidesOnDuty = employees.filter(
            (e) => e.status === 'active' && /guide|ranger/i.test(String(e.role || ''))
        ).length;
        const itStaff = employees.filter(
            (e) => e.status === 'active' && String(e.department || '').toLowerCase() === 'it'
        ).length;
        return { totalStaff, guidesOnDuty, itStaff };
    }

    async getOperationalSnapshot(windowMinutes = 5) {
        const snap = await API.getAdminOperationalSnapshot(windowMinutes);
        if (snap && !snap.error) return snap;
        return null;
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
        const settled = await Promise.allSettled([
            API.request('/admin/stats'),
            Intranet.getHRStats(),
            API.request('/admin/users?limit=1&offset=0'),
            Intranet.getInventory(),
            API.getSightingStats(null, 3650),
            API.getAdminActiveUsers(5),
            API.getAdminSystemHealth()
        ]);
        const valueOf = (i, fallback) => (settled[i].status === 'fulfilled' && settled[i].value != null ? settled[i].value : fallback);

        const adminStats = valueOf(0, {});
        const hrStats = valueOf(1, { totalStaff: 0, guidesOnDuty: 0, itStaff: 0 });
        const usersSnapshot = valueOf(2, {});
        const inventory = valueOf(3, []);
        const sightingStats = valueOf(4, {});
        const activeNow = valueOf(5, { count: 0, users: [] });
        const systemHealth = valueOf(6, {});
        const liveTotalUsers = Number(usersSnapshot?.total || 0);
        const activeSessions =
            Number(activeNow?.count) ||
            Number(adminStats?.activeSessionsNow) ||
            (Array.isArray(activeNow?.users) ? activeNow.users.length : 0);

        let operationalSnap = null;
        try {
            operationalSnap = await Intranet.getOperationalSnapshot(5);
        } catch (_) {
            operationalSnap = null;
        }

        const totalSightings = Number(
            operationalSnap?.totalSightings ??
            sightingStats?.total ??
            sightingStats?.totalSightings ??
            0
        );
        const globalPendingSync = Number(systemHealth?.checks?.pending_sync_items);
        const localPendingSync = OfflineSync.getPendingCount();

        return {
            activeUsers: activeSessions,
            totalRegisteredUsers: Number(
                liveTotalUsers ||
                adminStats?.totalAccounts ||
                adminStats?.totalUsers ||
                0
            ),
            totalActiveAccounts: Number(adminStats?.totalUsers || 0),
            syncQueueSize: Number.isFinite(globalPendingSync) ? globalPendingSync : localPendingSync,
            localSyncQueueSize: localPendingSync,
            storageUsed: Content.getOfflineStorageSize(),
            totalSightings,
            averageRating: Number(adminStats?.avgRating || 0),
            totalStaff: Number(operationalSnap?.totalStaff ?? hrStats?.totalStaff ?? 0),
            guidesOnDuty: Number(operationalSnap?.guidesOnDuty ?? hrStats?.guidesOnDuty ?? 0),
            inventoryItems: Number(
                operationalSnap?.inventoryItems ?? (Array.isArray(inventory) ? inventory.length : 0)
            ),
            sightingsLast24h: Number(operationalSnap?.sightingsLast24h ?? 0),
            operationalSnapshotAt: operationalSnap?.generated_at || null,
            activeTours: Number(adminStats?.activeTours || 0)
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
                department: u.department || '',
                is_active: u.is_active !== false
            }));
        }

        return [];
    }
    
    async getSightingsList(limit) {
        return (JSON.parse(localStorage.getItem('sightings') || '[]')).slice(0, limit);
    }
    
    async getAuditLogs(limit) {
        const logs = await API.getAdminAuditLogs(limit || 100);
        if (Array.isArray(logs) && logs.length) {
            localStorage.setItem('audit_logs', JSON.stringify(logs));
            return logs;
        }
        return JSON.parse(localStorage.getItem('audit_logs') || '[]').slice(0, limit || 100);
    }
    
    async getSystemHealth() {
        const result = await API.getAdminSystemHealth();
        if (result && typeof result === 'object') return result;
        return { database: 'unknown', syncService: 'unknown', geolocation: 'unknown', feedbackIngest: 'unknown' };
    }
    
    async getSchemaStatus() {
        const status = await API.getAdminSchemaStatus();
        if (status && typeof status === 'object' && Object.keys(status).length) return status;
        return {};
    }

    async getInteractiveAnalytics() {
        const end = new Date();
        const start = new Date(Date.now() - 1000 * 60 * 60 * 24 * 14);
        const startIso = start.toISOString();
        const endIso = end.toISOString();
        const today = end.toISOString().split('T')[0];

        // Use allSettled so one slow/broken endpoint doesn't blank the whole dashboard.
        const settled = await Promise.allSettled([
            API.getAnalyticsDashboard(startIso, endIso, today),
            API.getPeakTimes(startIso, endIso),
            API.getResourceAllocation(today),
            API.getSightingsTrends(startIso, endIso),
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

        const dashboard = valueOf(0);
        const peakTimes = valueOf(1);
        const resourceAllocation = valueOf(2);
        const sightingsTrends = valueOf(3);
        const popular = valueOf(4);
        const satisfaction = valueOf(5);
        const demographics = valueOf(6);
        const visitorFlow = dashboard?.visitor_flow || {};
        const congestion = {
            predictions: dashboard?.congestion_forecast || [],
            recommendations: (resourceAllocation?.recommendations || [])
                .slice(0, 6)
                .map((r) => {
                    const staff = r.suggested_staffing || {};
                    return `${r.location_name || 'Location'} @ ${r.hour}:00 - guides ${staff.guides || 1}, rangers ${staff.rangers || 1}, gate ${staff.gate_staff || 1}`;
                })
        };

        return {
            visitorFlow: visitorFlow?.timeline || [],
            topLocations: visitorFlow?.popular_routes || visitorFlow?.top_locations || [],
            congestionPredictions: congestion?.predictions || [],
            congestionRecommendations: congestion?.recommendations || [],
            popularContent: (dashboard?.popular_content_rankings || popular || []),
            satisfaction: (dashboard?.satisfaction_metrics || satisfaction || {}),
            demographics: (dashboard?.demographics ? { user_types: dashboard.demographics } : demographics || {}),
            peakTimes: peakTimes?.by_hour || dashboard?.peak_time_chart || [],
            resourceAllocation: resourceAllocation?.recommendations || [],
            sightingsTrends: sightingsTrends?.trend || dashboard?.sightings_trends || [],
            anomalyAlerts: dashboard?.anomaly_alerts || [],
            dashboardRange: dashboard?.range || { start: startIso, end: endIso }
        };
    }

    async getLiveOperations(windowMinutes = 5) {
        const settled = await Promise.allSettled([
            API.getAdminActiveUsers(windowMinutes),
            Intranet.getIntranetStatus(),
            API.getAdminSystemHealth()
        ]);
        const valueOf = (i) => (settled[i].status === 'fulfilled' ? settled[i].value : null);
        settled.forEach((r, i) => {
            if (r.status === 'rejected') {
                console.warn(`[ITAPI] live ops call ${i} failed:`, r.reason);
            }
        });
        const health = valueOf(2) || {};
        const liveUsers = (valueOf(0)?.users || []).map((u) => ({
            ...u,
            id: u.user_id || u.id
        }));
        return {
            peers: liveUsers,
            activeCount: Number(valueOf(0)?.count) || liveUsers.length,
            windowMinutes,
            intranetStatus: valueOf(1) || {},
            syncStatus: {
                pending_items: Number(health?.checks?.pending_sync_items || 0),
                total_items: Number(health?.checks?.total_sync_items || 0),
                location_updates_last_15m: Number(health?.checks?.location_updates_last_15m || 0)
            },
            systemHealth: health
        };
    }

    /** Bundled predictive analytics + reporting datasets (§3.1.1.11); filters via options. */
    async getPredictiveAnalyticsData(opts = {}) {
        const days = Math.min(365, Math.max(1, Number(opts.days) || 14));
        const end = new Date();
        const start = new Date(Date.now() - days * 86400000);
        const startIso = start.toISOString();
        const endIso = end.toISOString();
        const congestionDate =
            opts.congestionDate && String(opts.congestionDate).trim()
                ? String(opts.congestionDate).slice(0, 10)
                : endIso.slice(0, 10);
        const animalId = opts.animalId ? String(opts.animalId).trim() : '';
        const interval = ['hour', 'day', 'week'].includes(opts.interval) ? opts.interval : 'day';

        const settled = await Promise.allSettled([
            API.getAnalyticsDashboard(startIso, endIso, congestionDate),
            API.getVisitorFlowAnalytics(startIso, endIso, interval),
            API.getCongestionPredictions(congestionDate),
            API.getPeakTimes(startIso, endIso),
            API.getResourceAllocation(congestionDate),
            API.getSightingsTrends(startIso, endIso, animalId || undefined),
            API.getPopularContent(14),
            API.getSatisfactionAnalytics(startIso, endIso),
            API.getDemographicsAnalytics(),
            API.getAnalyticsAnomalies(2.5)
        ]);
        const val = (i, fallback) =>
            settled[i].status === 'fulfilled' && settled[i].value != null ? settled[i].value : fallback;
        settled.forEach((r, i) => {
            if (r.status === 'rejected') {
                console.warn(`[ITAPI] predictive analytics call ${i} failed:`, r.reason);
            }
        });

        const dashboard = val(0, {}) || {};
        const visitorFlow = val(1, {}) || {};
        const congestion = val(2, {}) || {};
        const peakTimes = val(3, {}) || {};
        const resourceAlloc = val(4, {}) || {};
        const sightings = val(5, {}) || {};
        const popular = val(6, []) || [];
        const satisfaction = val(7, {}) || {};
        const demographics = val(8, {}) || {};
        const anomalies = val(9, {}) || {};

        const visitorTimeline = visitorFlow.timeline || dashboard.visitor_flow?.timeline || [];
        const topLocations = visitorFlow.top_locations || visitorFlow.popular_routes || [];
        const dwellTimes = visitorFlow.dwell_times || [];

        return {
            range: { start: startIso, end: endIso, days, congestionDate, interval },
            visitorFlow: {
                timeline: visitorTimeline,
                popularRoutes: topLocations,
                dwellTimes,
                averageDwell: visitorFlow.average_dwell_time ?? null
            },
            congestion: {
                predictions: congestion.predictions || [],
                recommendations: congestion.recommendations || []
            },
            peakTimes: {
                byHour: peakTimes.by_hour || [],
                byDayOfWeek: peakTimes.by_day_of_week || [],
                peakHour: peakTimes.peak_hour || null,
                peakDay: peakTimes.peak_day || null
            },
            resourceAllocation: resourceAlloc.recommendations || [],
            sightings: {
                trend: sightings.trend || [],
                species: sightings.species_breakdown || []
            },
            popularContent: Array.isArray(popular) ? popular : [],
            satisfaction: {
                overall: satisfaction.overall ?? satisfaction.avg_rating ?? 0,
                satisfactionRate: satisfaction.satisfaction_rate ?? 0,
                totalRatings: satisfaction.total_ratings ?? 0,
                trend: satisfaction.trend || []
            },
            demographics: demographics || {},
            anomalies: anomalies.anomalies || [],
            anomalyStats: anomalies.stats || {},
            dashboardExtras: {
                congestionForecast: dashboard.congestion_forecast || [],
                anomalyAlerts: dashboard.anomaly_alerts || []
            }
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
