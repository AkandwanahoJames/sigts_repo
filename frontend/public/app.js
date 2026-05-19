// Global functions for UI actions — guarded so a missing app-views.js does not leave a blank loader.
(function sigtsAppEntry() {
    function bootFail(message, detail) {
        if (typeof window.sigtsShowBootFailure === 'function') {
            window.sigtsShowBootFailure(message, detail);
        } else {
            console.error(message, detail || '');
        }
    }

    if (typeof AuthManager !== 'function') {
        bootFail('Core scripts did not load.', 'AuthManager is missing — check the browser console.');
        return;
    }

    var Auth = new AuthManager();
    var Geofence = new GeofenceManager();
    var Content = new ContentManager();
    var AI = new AIRecommendationEngine();
    var OfflineSync = new OfflineSyncManager();
    var ITAPI = new ITManagerAPI();
    var Intranet = new IntranetManager();
    var rareAlertPollTimer = null;

    // Prevent stale UI during rapid development updates on desktop/mobile browsers.
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker
            .getRegistrations()
            .then(function (registrations) {
                registrations.forEach(function (reg) {
                    reg.unregister();
                });
            })
            .catch(function () {});
        if (window.caches && window.caches.keys) {
            window.caches
                .keys()
                .then(function (keys) {
                    keys.filter(function (k) {
                        return k.startsWith('bwindi-');
                    }).forEach(function (k) {
                        caches.delete(k);
                    });
                })
                .catch(function () {});
        }
    }

    var requiredUiFns = {
        renderView: typeof renderView === 'function' ? renderView : null,
        handleLogin: typeof handleLogin === 'function' ? handleLogin : null,
        handleForgotPassword: typeof handleForgotPassword === 'function' ? handleForgotPassword : null,
        handleMFASetup: typeof handleMFASetup === 'function' ? handleMFASetup : null,
        handleRegistration: typeof handleRegistration === 'function' ? handleRegistration : null,
        downloadOfflineContent: typeof downloadOfflineContent === 'function' ? downloadOfflineContent : null,
        toggleSidebar: typeof toggleSidebar === 'function' ? toggleSidebar : null,
        navigateTo: typeof navigateTo === 'function' ? navigateTo : null,
        startTour: typeof startTour === 'function' ? startTour : null,
        endActiveTour: typeof endActiveTour === 'function' ? endActiveTour : null,
        quickSighting: typeof quickSighting === 'function' ? quickSighting : null,
        clockInOut: typeof clockInOut === 'function' ? clockInOut : null,
        clearAllCache: typeof clearAllCache === 'function' ? clearAllCache : null,
        exportData: typeof exportData === 'function' ? exportData : null,
        resetApp: typeof resetApp === 'function' ? resetApp : null,
        addSighting: typeof addSighting === 'function' ? addSighting : null
    };

    var missingUi = Object.keys(requiredUiFns).filter(function (k) {
        return typeof requiredUiFns[k] !== 'function';
    });
    if (missingUi.length) {
        bootFail(
            'The UI module did not load completely.',
            'Missing: ' + missingUi.join(', ') + '. Hard-refresh (Ctrl+Shift+R) or run npm run dev from frontend/.'
        );
        return;
    }

    window.renderView = requiredUiFns.renderView;
    window.handleLogin = requiredUiFns.handleLogin;
    window.handleForgotPassword = requiredUiFns.handleForgotPassword;
    window.handleMFASetup = requiredUiFns.handleMFASetup;
    window.handleRegistration = requiredUiFns.handleRegistration;
    window.downloadOfflineContent = requiredUiFns.downloadOfflineContent;
    window.toggleSidebar = requiredUiFns.toggleSidebar;
    window.navigateTo = requiredUiFns.navigateTo;
    window.startTour = requiredUiFns.startTour;
    window.endActiveTour = requiredUiFns.endActiveTour;
    window.quickSighting = requiredUiFns.quickSighting;
    window.clockInOut = requiredUiFns.clockInOut;
    window.clearAllCache = requiredUiFns.clearAllCache;
    window.exportData = requiredUiFns.exportData;
    window.resetApp = requiredUiFns.resetApp;
    window.addSighting = requiredUiFns.addSighting;
    window.Auth = Auth;
    window.Geofence = Geofence;
    window.Content = Content;
    window.AI = AI;
    window.OfflineSync = OfflineSync;
    window.ITAPI = ITAPI;
    window.Intranet = Intranet;

    function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        navigator.serviceWorker.register('/sw.js').catch(function (error) {
            console.error('Service worker registration failed:', error);
        });
    }

    function initHashRouting() {
        window.addEventListener('hashchange', function () {
            var hashView = window.location.hash.replace('#', '').trim();
            if (!hashView) return;
            var normalized =
                typeof window.__SIGTS_normalizeView === 'function'
                    ? window.__SIGTS_normalizeView(hashView)
                    : hashView;
            if (normalized === window.currentView) return;
            renderView(hashView, { updateHash: false });
        });
    }

    var accessContextPollTimer = null;
    async function refreshAccessContext() {
        if (!Auth?.isAuthenticated?.()) return;
        try {
            var context = await Intranet.getAccessContext();
            if (context) {
                AppState.accessContext = {
                    isIntranet: context.isIntranet === true,
                    insideBoundary:
                        typeof context.insideBoundary === 'boolean' ? context.insideBoundary : null,
                    accessGranted:
                        context.accessGranted === true
                            ? true
                            : context.accessGranted === false
                              ? false
                              : null,
                    source: context.source || 'live',
                    mode: context.mode || 'demo',
                    reason: context.reason || '',
                    ip: context.ip || null,
                    lastUpdatedAt: context.timestamp || new Date().toISOString()
                };
                if (typeof window.refreshParkAccessPanel === 'function') {
                    window.refreshParkAccessPanel();
                }
            }
        } catch (_) {}
    }

    function initBackgroundAccessContext() {
        if (accessContextPollTimer) clearInterval(accessContextPollTimer);
        refreshAccessContext();
        accessContextPollTimer = setInterval(function () {
            refreshAccessContext();
        }, 20000);
    }

    window.refreshAccessContext = refreshAccessContext;

    function initLiveAccessStatusHooks() {
        var refresh = function () {
            if (typeof window.refreshNetworkStatusBadge === 'function') {
                window.refreshNetworkStatusBadge();
            }
            if (typeof window.refreshParkAccessPanel === 'function') {
                window.refreshParkAccessPanel();
            }
        };
        window.addEventListener('online', refresh);
        window.addEventListener('offline', refresh);
        window.addEventListener('geofence:location', function () {
            refresh();
            if (window.currentView === 'map' && typeof window.updateMapPlaceContext === 'function') {
                var loc = Geofence?.currentLocation || AppState?.currentLocation;
                if (loc?.lat != null && loc?.lng != null) {
                    window.updateMapPlaceContext(loc.lat, loc.lng);
                }
            }
        });
        window.addEventListener('alert', function (event) {
            var message = event?.detail?.message;
            if (!message || typeof showToast !== 'function') return;
            var type = String(event.detail?.type || 'info').toLowerCase();
            var toastType = type === 'warning' ? 'warning' : type === 'success' ? 'success' : 'info';
            showToast(message, toastType);
        });
    }

    async function init() {
        try {
            if (typeof window.ensureDemoPresentationDefaults === 'function') {
                window.ensureDemoPresentationDefaults();
            }
            if (typeof ensureSigtsApiReachable === 'function') {
                await Promise.race([
                    ensureSigtsApiReachable(),
                    new Promise(function (resolve) {
                        window.setTimeout(function () {
                            resolve(null);
                        }, 4000);
                    })
                ]);
            }
            registerServiceWorker();
            initHashRouting();
            initLiveAccessStatusHooks();
            initBackgroundAccessContext();

            Geofence.init().catch(function (error) {
                console.warn('Geofence initialization deferred:', error);
            });

            var users = JSON.parse(localStorage.getItem('registeredUsers') || '[]');

            if (!users.some(function (user) {
                return user.role === 'it_manager';
            })) {
                users.push(
                    {
                        id: 'admin1',
                        name: 'IT Administrator',
                        email: 'admin@bwindi.com',
                        username: 'admin',
                        role: 'it_manager',
                        department: 'IT',
                        createdAt: new Date().toISOString()
                    },
                    {
                        id: 'guide1',
                        name: 'Demo Guide',
                        email: 'guide@bwindi.com',
                        username: 'guide',
                        role: 'guide',
                        department: 'Tour Operations',
                        createdAt: new Date().toISOString()
                    },
                    {
                        id: 'tourist1',
                        name: 'Demo Tourist',
                        email: 'tourist@example.com',
                        username: 'tourist',
                        role: 'tourist',
                        department: 'Visitor',
                        createdAt: new Date().toISOString()
                    }
                );

                localStorage.setItem('registeredUsers', JSON.stringify(users));
            }

            var requestedView = window.location.hash.replace('#', '').trim();
            var isResetPasswordPath = window.location.pathname.replace(/\/+$/, '') === '/reset-password';
            var isVerifyEmailPath = window.location.pathname.replace(/\/+$/, '') === '/verify-email';
            if (isResetPasswordPath) {
                await renderView('reset_password', { updateHash: false });
                window.__SIGTS_BOOT_OK = true;
                return;
            }
            if (isVerifyEmailPath) {
                var token = new URLSearchParams(window.location.search).get('token');
                var verifyResult = await Auth.verifyEmailToken(token);
                if (verifyResult?.success) {
                    showToast('Email verified successfully. You can now log in.', 'success');
                } else {
                    showToast(verifyResult?.error || 'Email verification link is invalid or expired.', 'warning');
                }
                window.history.replaceState({}, '', window.location.origin + '/#login');
            }

            if (Auth.isAuthenticated()) {
                await renderView(requestedView || getLandingViewForUser(Auth.getCurrentUser()), { updateHash: true });
            } else {
                await renderView(requestedView === 'register' ? 'register' : 'login', { updateHash: true });
            }
            window.__SIGTS_BOOT_OK = true;
        } catch (err) {
            console.error('SIGTS init failed:', err);
            bootFail('Something blocked startup.', String(err.message || err));
        }
    }

    init();
})();
