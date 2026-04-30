// Global functions for UI actions
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
    navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((reg) => reg.unregister());
    }).catch(() => {});
    if (window.caches && window.caches.keys) {
        window.caches.keys().then((keys) => {
            keys.filter((k) => k.startsWith('bwindi-')).forEach((k) => caches.delete(k));
        }).catch(() => {});
    }
}

window.renderView = renderView;
window.handleLogin = handleLogin;
window.handleForgotPassword = handleForgotPassword;
window.handleMFASetup = handleMFASetup;
window.handleRegistration = handleRegistration;
window.downloadOfflineContent = downloadOfflineContent;
window.toggleSidebar = toggleSidebar;
window.navigateTo = navigateTo;
window.startTour = startTour;
window.endActiveTour = endActiveTour;
window.quickSighting = quickSighting;
window.clockInOut = clockInOut;
window.clearAllCache = clearAllCache;
window.exportData = exportData;
window.resetApp = resetApp;
window.addSighting = addSighting;
window.Auth = Auth;
window.Geofence = Geofence;
window.Content = Content;
window.AI = AI;
window.OfflineSync = OfflineSync;
window.ITAPI = ITAPI;
window.Intranet = Intranet;

function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('Service worker registration failed:', error);
    });
}

function initHashRouting() {
    window.addEventListener('hashchange', () => {
        const hashView = window.location.hash.replace('#', '');
        if (!hashView) return;
        renderView(hashView, { updateHash: false });
    });
}

let accessContextPollTimer = null;
async function refreshAccessContext() {
    if (!Auth?.isAuthenticated?.()) return;
    try {
        const context = await Intranet.getAccessContext();
        if (context) {
            AppState.accessContext = {
                isIntranet: context.isIntranet === true,
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
    accessContextPollTimer = setInterval(() => {
        refreshAccessContext();
    }, 20000);
}

function initLiveAccessStatusHooks() {
    const refresh = () => {
        if (typeof window.refreshNetworkStatusBadge === 'function') {
            window.refreshNetworkStatusBadge();
        }
        if (typeof window.refreshParkAccessPanel === 'function') {
            window.refreshParkAccessPanel();
        }
    };
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    window.addEventListener('geofence:location', refresh);
}

async function init() {
    showLoading();
    registerServiceWorker();
    initHashRouting();
    initLiveAccessStatusHooks();
    initBackgroundAccessContext();

    // Never block first paint/login on geofence startup network calls.
    Geofence.init().catch((error) => {
        console.warn('Geofence initialization deferred:', error);
    });

    const users = JSON.parse(localStorage.getItem('registeredUsers') || '[]');

    if (!users.some(user => user.role === 'it_manager')) {
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

    const requestedView = window.location.hash.replace('#', '');

    // Render the first screen directly (and sync hash) to avoid
    // depending on hashchange event timing for initial paint.
    if (Auth.isAuthenticated()) {
        await renderView(requestedView || getLandingViewForUser(Auth.getCurrentUser()), { updateHash: true });
        return;
    }

    await renderView(requestedView === 'register' ? 'register' : 'login', { updateHash: true });
}

init();