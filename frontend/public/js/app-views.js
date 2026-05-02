function syncSidebarToggleA11y() {
    const sidebar = document.querySelector('.sidebar');
    const btn = document.querySelector('.sidebar-toggle');
    if (!sidebar || !btn) return;
    const open = sidebar.classList.contains('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
}

function toggleSidebar() {
    document.querySelector('.sidebar')?.classList.toggle('open');
    syncSidebarToggleA11y();
}

function closeSidebar() {
    if (window.innerWidth <= 860) document.querySelector('.sidebar')?.classList.remove('open');
    syncSidebarToggleA11y();
}

function escapeHtml(input) {
    if (input == null || input === '') return '';
    const str = typeof input === 'string' ? input : String(input);
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m));
}

function icon(name, className = '') {
    const classes = `ui-icon ${className}`.trim();
    const icons = {
        home: '<path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h5v-6h4v6h5V9.5"/>',
        paw: '<circle cx="8" cy="8" r="1.7"/><circle cx="12" cy="6.7" r="1.9"/><circle cx="16" cy="8" r="1.7"/><path d="M8.4 18.2c1.1 0 1.9-.4 3.6-.4s2.5.4 3.6.4c1.7 0 2.9-1.4 2.9-3.1 0-2-1.4-3.6-3.4-3.6-.9 0-1.7.3-3.1 1-.4.2-.9.2-1.3 0-1.4-.7-2.2-1-3.1-1-2 0-3.4 1.6-3.4 3.6 0 1.7 1.2 3.1 2.9 3.1z"/>',
        map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15"/><path d="M15 6v15"/>',
        book: '<path d="M4 6a3 3 0 0 1 3-3h11v14H7a3 3 0 0 0-3 3z"/><path d="M18 3a3 3 0 0 1 3 3v14h-1a3 3 0 0 0-3-3"/><path d="M8.5 8.5h6M8.5 11.5h6M8.5 14.5h4.5"/>',
        camera: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7l1.5-3h5L16 7"/><circle cx="12" cy="14" r="4"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
        ticket: '<path d="M3 9a3 3 0 0 0 0 6v4h18v-4a3 3 0 0 0 0-6V5H3z"/><path d="M12 5v14"/>',
        chart: '<path d="M4 19V5"/><path d="M4 19h16"/><rect x="7" y="11" width="3" height="5"/><rect x="12" y="8" width="3" height="8"/><rect x="17" y="6" width="3" height="10"/>',
        building: '<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 10h1.8M9 13.5h1.8M13.2 10H15M13.2 13.5H15"/><path d="M10.5 21v-4h3v4"/>',
        logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
        bell: '<path d="M15 17H5l1.5-2v-4a5.5 5.5 0 1 1 11 0v4L19 17z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
        info: '<circle cx="12" cy="12" r="9"/><path d="M12 10v6"/><circle cx="12" cy="7" r="1"/>',
        target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1.5"/>',
        leaf: '<path d="M5 15c6-8 13-8 14-8 0 8-5 12-10 12-2 0-3-.8-4-4z"/><path d="M7 18c3-4 7-8 12-11"/>',
        grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
        sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1l2.1-2.1M17 7l2.1-2.1"/>',
        rain: '<path d="M6 14a4 4 0 1 1 .2-8 5 5 0 0 1 9.6 1.5A3.5 3.5 0 1 1 17 14z"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/>',
        gorilla: '<path d="M6 18c0-4 2.8-7 6-7s6 3 6 7"/><circle cx="12" cy="8" r="3"/><circle cx="8" cy="9" r="1.2"/><circle cx="16" cy="9" r="1.2"/>',
        elephant: '<path d="M6 9h9a4 4 0 0 1 4 4v5h-4v-3h-2v3H9a3 3 0 0 1-3-3z"/><path d="M19 13h2a2 2 0 0 1 0 4h-2"/><circle cx="11" cy="11" r="1"/>',
        bird: '<path d="M4 14c4-5 9-8 16-8-2 8-7 12-13 12-2 0-3-1-3-4z"/><path d="M10 12h8"/>',
        pin: '<path d="M12 21s6-5.6 6-10a6 6 0 1 0-12 0c0 4.4 6 10 6 10z"/><circle cx="12" cy="11" r="2.5"/>',
        clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
        phone: '<path d="M7 4h4l1 4-2 2a14 14 0 0 0 4 4l2-2 4 1v4a2 2 0 0 1-2 2A15 15 0 0 1 5 6a2 2 0 0 1 2-2z"/>',
        shield: '<path d="M12 3l7 3v5c0 5-3.5 8.4-7 10-3.5-1.6-7-5-7-10V6z"/>',
        megaphone: '<path d="M3 12h4l9-5v10l-9-5H3z"/><path d="M7 17l1.5 3"/><path d="M19 9a4 4 0 0 1 0 6"/>',
        box: '<path d="M3 7l9-4 9 4-9 4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>',
        users: '<circle cx="9" cy="9" r="3"/><circle cx="16" cy="10" r="2.5"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M13 20a4.5 4.5 0 0 1 8 0"/>',
        database: '<ellipse cx="12" cy="5" rx="7" ry="3"/><path d="M5 5v12c0 1.7 3.1 3 7 3s7-1.3 7-3V5"/><path d="M5 11c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
        download: '<path d="M12 4v10"/><path d="M8 10l4 4 4-4"/><path d="M4 19h16"/>',
        plus: '<path d="M12 5v14M5 12h14"/>',
        menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
        note: '<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4"/><path d="M9 11h6M9 15h6"/>',
        mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
        lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
        key: '<circle cx="7.5" cy="12" r="3.5"/><path d="M11 12h10"/><path d="M18 12v3"/><path d="M15 12v2"/>',
        userPlus: '<circle cx="10" cy="8" r="4"/><path d="M3 21a7 7 0 0 1 14 0"/><path d="M19 8v6M16 11h6"/>',
        smile: '<circle cx="12" cy="12" r="9"/><path d="M8 10h.01M16 10h.01"/><path d="M8 15c1.2 1.2 2.3 1.8 4 1.8s2.8-.6 4-1.8"/>',
        x: '<path d="M6 18L18 6M6 6l12 12"/>'
    };
    const content = icons[name] || icons.info;
    return `<svg class="${classes}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${content}</svg>`;
}

function getPhotoClassFromText(value = '') {
    const text = String(value).toLowerCase();
    if (text.includes('gorilla')) return 'photo-gorilla';
    if (text.includes('bird')) return 'photo-bird';
    if (text.includes('culture') || text.includes('batwa')) return 'photo-culture';
    if (text.includes('info') || text.includes('leaf')) return 'photo-leaf';
    if (text.includes('map') || text.includes('route') || text.includes('trail')) return 'photo-forest';
    return 'photo-forest';
}

function getQuickCardPhotoClass(cardKey = '') {
    const key = String(cardKey).toLowerCase();
    if (key === 'animals') return 'photo-gorilla';
    if (key === 'map') return 'photo-forest';
    if (key === 'culture') return 'photo-culture';
    if (key === 'info') return 'photo-leaf';
    return 'photo-forest';
}

function getRecommendationPhotoClass(item = {}, index = 0) {
    const text = `${item.title || ''} ${item.reason || ''}`.toLowerCase();
    if (text.includes('forest walk')) return 'photo-forest-walk';
    if (text.includes('gorilla')) return 'photo-gorilla';
    if (text.includes('bird')) return 'photo-bird';
    if (text.includes('culture') || text.includes('batwa')) return 'photo-culture';
    if (text.includes('leaf') || text.includes('info')) return 'photo-leaf';
    if (index === 0) return 'photo-gorilla';
    if (index === 1) return 'photo-bird';
    if (index === 2) return 'photo-culture';
    return 'photo-forest';
}

function getPageTitle(view) {
    const titles = { dashboard: 'Dashboard', animals: 'Animals', map: 'Map', culture: 'Culture', sightings: 'Sightings', profile: 'Profile', info: 'Info', ai_chat: 'Tour help', guide_dashboard: 'Guide Dashboard', it_dashboard: 'Admin Dashboard', intranet: 'Intranet Hub' };
    return titles[view] || 'SIGTS Platform';
}

function getPageSubtitle(view) {
    const subtitles = {
        dashboard: "Welcome back, explore today's recommendations.",
        guide_dashboard: 'Track tours, guests, and active shifts.',
        it_dashboard: 'Monitor users, sync status, and platform health.',
        intranet: 'Manage staff communication and operations.'
    };
    return subtitles[view] || 'Role-based access with secure operational controls.';
}

const PUBLIC_VIEWS = new Set(['login', 'register']);
const APP_VIEWS = new Set([
    'login',
    'register',
    'dashboard',
    'animals',
    'map',
    'culture',
    'sightings',
    'profile',
    'info',
    'ai_chat',
    'guide_dashboard',
    'it_dashboard',
    'intranet'
]);

function normalizeView(view) {
    const candidate = String(view || '').trim();
    return APP_VIEWS.has(candidate) ? candidate : 'dashboard';
}

window.__SIGTS_normalizeView = normalizeView;

/** Normalized role string from stored user object. */
function getEffectiveRole(user) {
    return String(user?.userType || user?.role || user?.user_type || 'tourist').trim();
}

const SHARED_APP_VIEWS = new Set([
    'dashboard', 'animals', 'map', 'culture', 'sightings', 'profile', 'info', 'ai_chat'
]);

/** Whether the given role may open `view` (excludes login/register). */
function canUserAccessView(role, view) {
    if (PUBLIC_VIEWS.has(view)) return true;
    if (view === 'it_dashboard' || view === 'intranet') return role === 'it_manager';
    if (view === 'guide_dashboard') return role === 'guide';
    return SHARED_APP_VIEWS.has(view);
}

/** Default home screen after login / app open when no deep link hash is set. */
function getLandingViewForUser(user) {
    const role = String(user?.userType || user?.role || user?.user_type || 'tourist').trim();
    if (role === 'guide') return 'guide_dashboard';
    if (role === 'it_manager') return 'it_dashboard';
    return 'dashboard';
}

function navigateTo(view, options = {}) {
    const targetView = normalizeView(view);
    const shouldUpdateHash = options.updateHash !== false;

    if (shouldUpdateHash) {
        const targetHash = `#${targetView}`;
        if (window.location.hash !== targetHash) {
            window.location.hash = targetHash;
        }
    }

    return renderView(targetView, { ...options, updateHash: false });
}

function formatRoleName(role = 'tourist') {
    return String(role)
        .replace(/_/g, ' ')
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

function renderStatusBadge(value = 'info') {
    const normalized = String(value || '').trim().toLowerCase();
    const style =
        normalized === 'active' || normalized === 'success' ? 'success'
        : normalized === 'pending' || normalized === 'warning' ? 'warning'
        : normalized === 'rejected' || normalized === 'error' || normalized === 'danger' ? 'danger'
        : 'neutral';
    return `<span class="status-badge ${style}">${escapeHtml(formatRoleName(value || 'unknown'))}</span>`;
}

function renderKpiStrip(items = []) {
    if (!Array.isArray(items) || !items.length) return '';
    return `<div class="kpi-strip">${items.map((item) => `
        <div class="kpi-card">
            <div class="kpi-label">${escapeHtml(item.label || 'Metric')}</div>
            <div class="kpi-value">${escapeHtml(String(item.value ?? 0))}</div>
            ${item.hint ? `<div class="kpi-hint">${escapeHtml(item.hint)}</div>` : ''}
        </div>
    `).join('')}</div>`;
}

let liveMapInstance = null;
let liveMapLayers = {
    markers: [],
    boundary: null,
    route: null,
    activeTourRoute: null
};
let liveMapRefreshTimer = null;
let liveMapPOIs = [];
let activeGuidanceTarget = null;
let liveMapTileLayers = {};
let measureStartPoint = null;
let lastTurnAlertAt = 0;
let adminRealtimeUsersTimer = null;
let parkAccessSimulation = (() => {
    try {
        const saved = JSON.parse(localStorage.getItem('parkAccessSimulation') || '{}');
        return {
            boundary: ['auto', 'inside', 'outside'].includes(saved.boundary) ? saved.boundary : 'auto',
            network: ['auto', 'online', 'offline'].includes(saved.network) ? saved.network : 'auto'
        };
    } catch (_) {
        return { boundary: 'auto', network: 'auto' };
    }
})();

function saveParkAccessSimulation() {
    localStorage.setItem('parkAccessSimulation', JSON.stringify(parkAccessSimulation));
}

function getParkAccessState() {
    const live = Geofence?.currentLocation || AppState?.currentLocation || null;
    const liveInside = live ? !!Geofence?.isInsidePark?.(live.lat, live.lng) : null;
    const boundaryMode = parkAccessSimulation.boundary || 'auto';
    const networkMode = parkAccessSimulation.network || 'auto';
    const role = getEffectiveRole(Auth.getCurrentUser() || {});
    const intranetState = AppState?.accessContext?.isIntranet;
    const requiresIntranet = role === 'tourist' || role === 'guide';
    const insidePark = boundaryMode === 'auto'
        ? (liveInside === null ? true : liveInside)
        : boundaryMode === 'inside';
    let online = networkMode === 'auto'
        ? navigator.onLine
        : networkMode === 'online';
    if (networkMode === 'auto' && requiresIntranet && intranetState === false) {
        online = false;
    }
    const status = (!online || !insidePark) ? 'restricted' : 'active';
    return {
        status,
        online,
        insidePark,
        location: live,
        liveInside,
        boundaryMode,
        networkMode,
        requiresIntranet
    };
}

function getAccessStatusText(state) {
    if (!state.online && !state.insidePark) return 'Out of park boundary and network unavailable';
    if (!state.online) return 'Network unavailable for this park';
    if (!state.insidePark) return 'Outside approved park boundary';
    return 'Inside boundary and network available';
}

function renderParkAccessPanel() {
    const state = getParkAccessState();
    const hasCoords = Number.isFinite(Number(state.location?.lat)) && Number.isFinite(Number(state.location?.lng));
    const latText = hasCoords ? Number(state.location.lat).toFixed(5) : 'Waiting for GPS';
    const lngText = hasCoords ? Number(state.location.lng).toFixed(5) : '--';
    return `<section class="park-access-panel ${state.status}">
        <div class="park-access-head">
            <h3>${icon('shield', 'icon-sm')} Park Access Status</h3>
            ${renderStatusBadge(state.status === 'active' ? 'active' : 'warning')}
        </div>
        <p>${escapeHtml(getAccessStatusText(state))}</p>
        <div class="park-access-meta">
            <span class="park-chip ${state.insidePark ? 'ok' : 'warn'}">Boundary: ${state.insidePark ? 'Inside' : 'Outside'}</span>
            <span class="park-chip ${state.online ? 'ok' : 'warn'}">Network: ${state.online ? 'Online' : 'Offline'}</span>
            <span class="park-chip ${hasCoords ? '' : 'neutral'}">Lat: ${escapeHtml(latText)}${hasCoords ? ` • Lng: ${escapeHtml(lngText)}` : ''}</span>
        </div>
        <details class="park-access-sim">
            <summary>Demo simulation controls</summary>
            <div class="park-access-actions">
                <button type="button" class="small-btn ${state.boundaryMode === 'auto' ? 'btn-primary' : ''}" onclick="setParkBoundaryMode('auto')">Boundary Auto</button>
                <button type="button" class="small-btn ${state.boundaryMode === 'inside' ? 'btn-primary' : ''}" onclick="setParkBoundaryMode('inside')">Force Inside</button>
                <button type="button" class="small-btn ${state.boundaryMode === 'outside' ? 'btn-primary' : ''}" onclick="setParkBoundaryMode('outside')">Force Outside</button>
                <button type="button" class="small-btn ${state.networkMode === 'auto' ? 'btn-primary' : ''}" onclick="setParkNetworkMode('auto')">Network Auto</button>
                <button type="button" class="small-btn ${state.networkMode === 'online' ? 'btn-primary' : ''}" onclick="setParkNetworkMode('online')">Force Online</button>
                <button type="button" class="small-btn ${state.networkMode === 'offline' ? 'btn-primary' : ''}" onclick="setParkNetworkMode('offline')">Force Offline</button>
                <button type="button" class="small-btn" onclick="resetParkAccessSimulation()">Reset Simulation</button>
            </div>
            <div class="park-access-note">Use these controls to validate boundary and network restriction behavior.</div>
        </details>
    </section>`;
}

function getGuideOpsManager() {
    if (!window.__guideOpsManager) {
        window.__guideOpsManager = new TourGuideManager();
    }
    return window.__guideOpsManager;
}

function renderLiveUserRows(peers = []) {
    if (!Array.isArray(peers) || !peers.length) {
        return '<div class="user-item">No active users detected in the latest 5-minute window.</div>';
    }
    return peers.slice(0, 20).map((peer) => {
        const where = peer.location
            ? ` @ ${Number(peer.location.lat).toFixed(4)}, ${Number(peer.location.lng).toFixed(4)}`
            : ' @ location unavailable';
        return `<div class="user-item">${escapeHtml(peer.name || 'User')} (${escapeHtml(peer.type || 'user')})${where}</div>`;
    }).join('');
}

async function refreshAdminRealtimeUsers() {
    if (window.currentView !== 'it_dashboard') return;
    const listNode = document.getElementById('adminLiveUsersList');
    if (!listNode) return;
    const liveOps = await ITAPI.getLiveOperations();
    const peers = Array.isArray(liveOps?.peers) ? liveOps.peers : [];
    listNode.innerHTML = renderLiveUserRows(peers);
    const stampNode = document.getElementById('adminLiveUsersStamp');
    if (stampNode) {
        const usersSnapshot = await API.request('/admin/users?limit=1&offset=0');
        const totalUsers = Number(usersSnapshot?.total || 0);
        stampNode.textContent = `Updated ${new Date().toLocaleTimeString()} • ${peers.length} active now / ${totalUsers} total`;
    }
}

function stopAdminRealtimeUsersRefresh() {
    if (adminRealtimeUsersTimer) {
        clearInterval(adminRealtimeUsersTimer);
        adminRealtimeUsersTimer = null;
    }
}

function startAdminRealtimeUsersRefresh() {
    stopAdminRealtimeUsersRefresh();
    refreshAdminRealtimeUsers();
    adminRealtimeUsersTimer = setInterval(() => {
        refreshAdminRealtimeUsers();
    }, 15000);
}

function renderNotificationBell(user) {
    const isGuide = user?.role === 'guide' || user?.userType === 'guide';
    const isITManager = user?.role === 'it_manager' || user?.userType === 'it_manager';
    if (isITManager) {
        return `<button type="button" class="icon-btn notif-btn" onclick="navigateTo('it_dashboard')" aria-label="Alerts and admin">${icon('bell', 'icon-md')}<span id="rareAlertBadge" class="notif-badge hidden">0</span></button>`;
    }
    if (isGuide) {
        return `<button type="button" class="icon-btn notif-btn" onclick="navigateTo('guide_dashboard')" aria-label="Guide alerts">${icon('bell', 'icon-md')}<span id="rareAlertBadge" class="notif-badge hidden">0</span></button>`;
    }
    return '';
}

function renderMainLayout(content) {
    const user = Auth.getCurrentUser() || { name: 'Guest', role: 'tourist' };
    const isGuide = user?.role === 'guide' || user?.userType === 'guide';
    const isITManager = user?.role === 'it_manager' || user?.userType === 'it_manager';
    const roleLabel = formatRoleName(user.role ?? user.userType ?? user.user_type ?? 'tourist');
    const avatarIcon = isITManager ? icon('chart', 'icon-md') : (isGuide ? icon('ticket', 'icon-md') : icon('user', 'icon-md'));    
    let navItems = [
        { id: 'dashboard', icon: 'home', label: 'Home' },
        { id: 'animals', icon: 'paw', label: 'Animals' },
        { id: 'map', icon: 'map', label: 'Map' },
        { id: 'culture', icon: 'book', label: 'Culture' },
        { id: 'ai_chat', icon: 'target', label: 'Tour help' },
        { id: 'sightings', icon: 'camera', label: 'Sightings' },
        { id: 'profile', icon: 'user', label: 'Profile' }
    ];
    if (isGuide) navItems.push({ id: 'guide_dashboard', icon: 'ticket', label: 'Guide' });
    if (isITManager) {
        navItems.push({ id: 'it_dashboard', icon: 'chart', label: 'Admin' });
        navItems.push({ id: 'intranet', icon: 'building', label: 'Intranet' });
    }
    
    const accessState = getParkAccessState();
    const isOffline = !accessState.online;
    const pending = OfflineSync?.getPendingCount?.() || 0;
    const statusText = isOffline ? `Offline mode • ${pending} pending` : (pending ? `Online • ${pending} pending sync` : 'Online');
    return `<div class="app-container"><div id="app-sidebar" class="sidebar"><div class="sidebar-header"><div class="sidebar-brand"><div class="sidebar-logo"><img src="/icons/icon-192.svg" alt="SIGTS logo"></div><div class="sidebar-title">Bwindi SIGTS</div></div></div><div class="sidebar-nav">${navItems.map(item => `<div class="nav-item-vertical ${window.currentView === item.id ? 'active' : ''}" onclick="navigateTo('${item.id}')"><div class="nav-icon-vertical">${icon(item.icon, 'icon-md')}</div><div class="nav-label-vertical">${item.label}</div></div>`).join('')}</div><div class="sidebar-logout" onclick="Auth.logout()">${icon('logout', 'icon-md')} Logout</div></div><div class="main-content" onclick="closeSidebar()"><div class="content-header"><button type="button" class="sidebar-toggle" aria-label="Open navigation menu" aria-expanded="false" aria-controls="app-sidebar" onclick="toggleSidebar()">${icon('menu', 'icon-sm')}</button><h1>${getPageTitle(window.currentView)}</h1><div class="header-right"><span id="networkStatusBadge" class="net-status ${isOffline ? 'offline' : 'online'}">${statusText}</span>${renderNotificationBell(user)}<button type="button" class="header-profile" onclick="navigateTo('profile')"><div class="header-avatar ${isITManager ? 'role-it' : (isGuide ? 'role-guide' : 'role-tourist')}">${avatarIcon}</div><div class="header-user-info"><div class="header-user-name">${escapeHtml(user.name)}</div><div class="header-user-role">${escapeHtml(roleLabel)}</div></div></button></div></div><div class="main-container">${renderParkAccessPanel()}${content}</div></div></div>`;}

function getAnimalIconName(animalName = '') {
    const value = animalName.toLowerCase();
    if (value.includes('gorilla')) return 'gorilla';
    if (value.includes('elephant')) return 'elephant';
    if (value.includes('eagle')) return 'bird';
    if (value.includes('turaco')) return 'bird';
    if (value.includes('bee-eater')) return 'bird';
    if (value.includes('broadbill')) return 'bird';
    if (value.includes('colobus') || value.includes('monkey') || value.includes('chimp')) return 'paw';
    if (value.includes('bird')) return 'bird';
    return 'paw';
}

function truncateSnippet(text = '', max = 148) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    if (t.length <= max) return t;
    return `${t.slice(0, Math.max(0, max - 1))}…`;
}

function coerceStringArray(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map((s) => String(s || '').trim()).filter(Boolean);
    if (typeof raw === 'string') {
        const s = raw.trim();
        if (s.startsWith('{') && s.endsWith('}')) {
            try {
                const inner = s.slice(1, -1);
                const parts = inner.split(/,(?=(?:[^']*'[^']*')*[^']*$)/);
                const out = [];
                parts.forEach((p) => {
                    let v = p.trim();
                    if (v.startsWith("'") && v.endsWith("'")) v = v.slice(1, -1).replace(/''/g, "'");
                    else if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
                    if (v) out.push(v);
                });
                if (out.length) return out;
            } catch (_) {
                /**/
            }
        }
    }
    return [];
}

function firstSpeciesImage(animal = {}) {
    const urls = animal.image_urls ?? animal.primary_image_urls;
    if (Array.isArray(urls) && urls[0]) return String(urls[0]);
    if (typeof urls === 'string') {
        const s = urls.trim();
        try {
            const parsed = JSON.parse(s);
            if (Array.isArray(parsed) && parsed[0]) return String(parsed[0]);
        } catch (_) {
            if (s.startsWith('http')) return s.split(/[|,]/)[0]?.trim();
        }
    }
    return '';
}

function firstStoryImage(story = {}) {
    const u = story.image_urls;
    if (Array.isArray(u) && u[0]) return String(u[0]);
    return '';
}

function joinMaybeList(value) {
    if (!value) return '';
    const list = Array.isArray(value) ? value : [value];
    return list.map((v) => String(v || '').trim()).filter(Boolean).join(', ');
}

function speciesAIPromptFromRecord(animal = {}) {
    const sci = animal.scientific_name ? String(animal.scientific_name).trim() : '';
    const name = animal.name || 'this species';
    return `Field brief for Bwindi: ${name}${sci ? ` (${sci})` : ''}. Usual trail zones, habitat, visitor rules, seasonality, status, one rumor to correct. Rangers’ safety line comes first.`;
}

function culturalAIPromptFromRecord(story = {}) {
    const title = story.title_en || story.title_local || 'this story';
    return `Cultural note on "${title}": background for visitors near Bwindi; Batwa/Bakiga angle if it fits; respectful behavior; how it lines up with trekking regulations. Plain words, no drama.`;
}

function stripOverlayFromBody() {
    document.body.classList.remove('detail-modal-open');
}

function showRichContentModal({ title, heroUrl = '', heroAlt = '', bodyHtml = '', footerHtml = '' }) {
    const root = ensureFeedbackRoot();
    stripOverlayFromBody();
    document.body.classList.add('detail-modal-open');
    const overlay = document.createElement('div');
    overlay.className = 'ui-modal-overlay ui-modal-overlay-rich';
    const heroBlock = heroUrl
        ? `<div class="ui-modal-hero"><img src="${escapeHtml(heroUrl)}" alt="${escapeHtml(heroAlt || title || 'Illustration')}" loading="lazy" decoding="async" /></div>`
        : '';
    overlay.innerHTML = `
        <div class="ui-modal ui-modal-rich" role="dialog" aria-modal="true" tabindex="-1">
            <button type="button" class="ui-modal-close" aria-label="Close">${icon('x', 'icon-sm')}</button>
            <div class="ui-modal-title">${escapeHtml(title || 'Details')}</div>
            ${heroBlock}
            <div class="ui-modal-rich-body">${bodyHtml}</div>
            ${footerHtml || ''}
        </div>
    `.trim();

    const close = () => {
        overlay.remove();
        stripOverlayFromBody();
    };

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });

    overlay.querySelector('.ui-modal-close')?.addEventListener('click', close);

    overlay.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close();
    });

    root.appendChild(overlay);
    overlay.tabIndex = 0;
    overlay.focus({ preventScroll: true });
    return overlay;
}

function applySIGTSAIPrefill() {
    try {
        const raw = sessionStorage.getItem('sigts_ai_prefill');
        if (!raw) return;
        sessionStorage.removeItem('sigts_ai_prefill');
        const input = document.getElementById('aiChatInput');
        if (!input) return;
        input.value = raw;
        input.focus();
        const hint = document.getElementById('aiPrefillBanner');
        if (hint) {
            hint.textContent = 'Draft text from the last screen is in the box. Edit it, then tap Send.';
        }
    } catch (_) {
        /**/
    }
}

/** Session storage key: selected UNESCO / tour thematic filter on the Animals tab */
const SIGTS_TOUR_FOCUS_KEY = 'sigts_tour_focus';

const BWINDI_UNESCO_TOUR_THEMES = [
    {
        id: 'all',
        icon: 'grid',
        title: 'All species',
        subtitle: 'Browse everything in SIGTS'
    },
    {
        id: 'unesco_primates',
        icon: 'paw',
        title: 'Great apes & monkeys',
        subtitle: 'Gorillas, chimps & primate richness (WHC text)'
    },
    {
        id: 'unesco_large_mammals',
        icon: 'elephant',
        title: 'Elephants & large mammals',
        subtitle: 'Wide-ranging fauna beyond primates'
    },
    {
        id: 'unesco_albertine_birds',
        icon: 'bird',
        title: 'Albertine bird icons',
        subtitle: 'Passerines singled out under criterion x'
    },
    {
        id: 'unesco_swallowtails',
        icon: 'leaf',
        title: 'Swallowtail butterflies',
        subtitle: 'Canopy Lepidoptera called out by UNESCO'
    },
    {
        id: 'globally_threatened',
        icon: 'shield',
        title: 'Globally threatened',
        subtitle: 'Endangered, vulnerable & near-threatened picks'
    }
];

function normalizeTourLabel(raw) {
    return String(raw || '').toLowerCase().replace(/\u2019/g, "'").trim();
}

function animalMatchesBwindiTourFocus(animal, focusKey = 'all') {
    if (!focusKey || focusKey === 'all') return true;
    const name = normalizeTourLabel(animal.name);
    const sci = normalizeTourLabel(animal.scientific_name || '');
    const blob = `${name} ${sci}`;

    switch (focusKey) {
        case 'unesco_primates': {
            if (/bird|broadbill|flycatcher|warbler|swallowtail|butterfly|turaco|\bbee-eagle\b|\beagle\b/.test(blob)) return false;
            return (
                /\b(monkey|gorilla|chimp|chimpan|baboon|colobus|mangabey|guenon)\b/i.test(blob)
                || /hoest|'s monkey|golden monkey/i.test(blob)
                || /\b(pan gorilla|cercopithecus|chlorocebus|alophocebus|lophocebus|papio|papionini)\b/.test(blob)
            );
        }
        case 'unesco_large_mammals': {
            if (animalMatchesBwindiTourFocus(animal, 'unesco_primates')) return false;
            if (/bird|flycatcher|warbler|broadbill|swallowtail|butterfly|\bbat\b/.test(blob)) return false;
            if (/\b(mouse|rat|shrew|squirrel|dormouse)\b/i.test(blob)) return false;
            return /elephant|duiker|buffalo|cape buffalo|bushpig|hog|hyaena|civet|leopard/i.test(blob);
        }
        case 'unesco_albertine_birds': {
            if (/swallowtail|butterfly|papilio\b/.test(blob)) return false;
            const needles = ['broadbill', 'green broadbill', 'grauer', 'warbler', 'turner', 'eremomela', 'chapin', 'flycatcher', 'shelley', 'crimsonwing'];
            return needles.some((n) => name.includes(n));
        }
        case 'unesco_swallowtails':
            return /swallowtail|papilio\b/.test(blob);
        case 'globally_threatened': {
            const s = String(animal.conservation_status || '').toLowerCase().replace(/\s+/g, '_');
            return ['endangered', 'vulnerable', 'near_threatened'].includes(s);
        }
        default:
            return true;
    }
}

function getValidatedAnimalTourFocus() {
    const valid = new Set(BWINDI_UNESCO_TOUR_THEMES.map((t) => t.id));
    try {
        const raw = sessionStorage.getItem(SIGTS_TOUR_FOCUS_KEY);
        const k = typeof raw === 'string' ? raw.trim() : 'all';
        return valid.has(k) ? k : 'all';
    } catch (_) {
        return 'all';
    }
}

function tourFocusSpeciesCount(animals, focusKey) {
    return animals.filter((a) => animalMatchesBwindiTourFocus(a, focusKey)).length;
}

function renderBwindiTourThemeStrip(animals, activeFocus, imageBySlug = {}) {
    const cards = BWINDI_UNESCO_TOUR_THEMES.map((t) => {
        const count = t.id === 'all' ? animals.length : tourFocusSpeciesCount(animals, t.id);
        const active = activeFocus === t.id ? ' tour-focus-card--active' : '';
        const badge = `<span class="tour-focus-count">${count}</span>`;
        const safeId = escapeHtml(t.id);
        const thumbSrc = typeof imageBySlug[t.id] === 'string' ? imageBySlug[t.id].trim() : '';
        const thumbHtml = thumbSrc
            ? `<div class="tour-focus-thumb" aria-hidden="true"><img src="${escapeHtml(thumbSrc)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer-when-downgrade" /></div>`
            : `<div class="tour-focus-thumb tour-focus-thumb--placeholder" aria-hidden="true">${icon(t.icon || 'leaf', 'icon-lg')}</div>`;
        return `
        <div class="tour-focus-cell" role="listitem">
            <div class="tour-focus-card${active}" data-tour-focus="${safeId}">
                <div class="tour-focus-card-main" role="button" tabindex="0" aria-label="${escapeHtml(t.title)}. Opens guided session briefing."
                     onclick="openWildlifeTourThemeBriefing(${JSON.stringify(t.id)})"
                     onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openWildlifeTourThemeBriefing(${JSON.stringify(t.id)});}">
                    ${thumbHtml}
                    <div class="tour-focus-card-top">
                        <span class="tour-focus-icon">${icon(t.icon || 'leaf', 'icon-md')}</span>
                        ${badge}
                    </div>
                    <div class="tour-focus-title">${escapeHtml(t.title)}</div>
                    <div class="tour-focus-sub">${escapeHtml(t.subtitle)}</div>
                    <div class="tour-focus-open-hint">Tap for ranger-style session notes</div>
                </div>
                <div class="tour-focus-card-footer">
                    <button type="button" class="small-btn ghost-btn tour-focus-filter-btn" onclick="setAnimalTourFocus(${JSON.stringify(t.id)})">${icon('grid', 'icon-sm')} Match species grid</button>
                </div>
            </div>
        </div>`;
    }).join('');
    return `<section class="section-card tour-focus-section" aria-labelledby="tour-focus-heading">
        <div class="section-header"><h3 id="tour-focus-heading">${icon('target', 'icon-sm')} Pick a UNESCO tour wildlife theme</h3></div>
        <p class="animals-page-blurb tour-focus-explainer">
            These themes mirror biodiversity groups emphasized for Bwindi Impenetrable National Park (<a href="https://whc.unesco.org/en/list/682/" target="_blank" rel="noopener noreferrer">UNESCO list 682</a>).
            <strong>Tap the card body</strong> to open scripted session briefings for guides and guests; use <strong>Match species grid</strong> to filter tiles below mid-tour.
        </p>
        <div class="tour-focus-grid" role="list">${cards}</div>
    </section>`;
}

window.navigateToAIWithPrompt = async function navigateToAIWithPrompt(promptText) {
    const text = String(promptText || '').trim();
    if (text) sessionStorage.setItem('sigts_ai_prefill', text);
    await renderView('ai_chat', { updateHash: true, suppressAccessToast: true });
};

window.setAnimalTourFocus = async function setAnimalTourFocus(key) {
    const k = BWINDI_UNESCO_TOUR_THEMES.some((t) => t.id === key) ? key : 'all';
    try {
        sessionStorage.setItem(SIGTS_TOUR_FOCUS_KEY, k);
    } catch (_) {
        /**/
    }
    await navigateTo('animals', { updateHash: false, suppressAccessToast: true });
};

/** Close stacked rich modal (tour briefing / species) then apply species filter */
window.dismissRichModalAndSetAnimalTourFocus = async function dismissRichModalAndSetAnimalTourFocus(slug) {
    try {
        document.querySelector('.ui-modal-overlay-rich .ui-modal-close')?.click();
    } catch (_) {
        /**/
    }
    await window.setAnimalTourFocus(slug);
};

window.openWildlifeTourThemeBriefing = async function openWildlifeTourThemeBriefing(slug) {
    const s = String(slug || '').trim().toLowerCase();
    if (!s) return;
    try {
        const theme = await Content.getWildlifeTourThemeBySlug(s);
        if (!theme || (!theme.slug && !theme.theme_id)) {
            showToast('Tour session briefing unavailable for this tile. Reload the page; if it persists, ensure migration 009 is applied and the backend seed has run.', 'warning');
            return;
        }
        openWildlifeTourThemeBriefingModal(theme);
    } catch (err) {
        console.error('openWildlifeTourThemeBriefing', err);
        showToast('Could not open the tour briefing. Check your connection and try again.', 'danger');
    }
};

function openWildlifeTourThemeBriefingModal(theme) {
    const title = theme.session_title || theme.slug || 'Tour session';
    const points = coerceStringArray(theme.talking_points);
    const talkList = points.length
        ? `<ul class="ui-modal-facts">${points.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul>`
        : '';
    const body = `
        ${theme.subtitle ? `<p class="ui-modal-muted">${escapeHtml(theme.subtitle)}</p>` : ''}
        <p>${escapeHtml(theme.tourist_summary_en || '')}</p>
        ${theme.guide_script_en ? `<h4 class="ui-modal-section-title">${icon('users', 'icon-sm')} Guide briefing</h4><p>${escapeHtml(theme.guide_script_en)}</p>` : ''}
        ${talkList ? `<h4 class="ui-modal-section-title">${icon('note', 'icon-sm')} Talking points</h4>${talkList}` : ''}
        ${theme.safety_notes ? `<h4 class="ui-modal-section-title">${icon('shield', 'icon-sm')} Safety & distance</h4><p>${escapeHtml(theme.safety_notes)}</p>` : ''}
        ${theme.etiquette_notes ? `<h4 class="ui-modal-section-title">${icon('info', 'icon-sm')} Guest etiquette</h4><p>${escapeHtml(theme.etiquette_notes)}</p>` : ''}
        ${theme.unesco_note ? `<h4 class="ui-modal-section-title">${icon('book', 'icon-sm')} Conservation framing</h4><p>${escapeHtml(theme.unesco_note)}</p>` : ''}
        ${theme.suggested_duration_minutes
        ? `<p class="ui-modal-muted">Suggested pacing: about <strong>${escapeHtml(String(theme.suggested_duration_minutes))}</strong> minutes. Stretch or trim with ranger discretion.</p>`
        : ''}`;

    const footer = `
        <div class="ui-modal-chip-row" style="flex-wrap:wrap;gap:8px;justify-content:flex-start;">
          <button type="button" class="login-btn" onclick="dismissRichModalAndSetAnimalTourFocus(${JSON.stringify(theme.slug)})">${icon('grid', 'icon-sm')} Apply filter below</button>
          <button type="button" class="small-btn ghost-btn" onclick="document.querySelector('.ui-modal-overlay-rich .ui-modal-close')?.click();">${icon('x', 'icon-sm')} Close</button>
        </div>`;

    showRichContentModal({
        title,
        heroUrl: theme.image_url || '',
        heroAlt: title,
        bodyHtml: body,
        footerHtml: footer
    });
}

window.openAnimalSpeciesDetail = async function openAnimalSpeciesDetail(animalId) {
    const id = String(animalId || '').trim();
    if (!id) return showToast('Missing species reference', 'danger');
    const animal = await Content.getAnimalById(id);
    if (!animal?.name) return showToast('Unable to load that species.', 'danger');

    const facts = coerceStringArray(animal.fun_facts);
    const hero = firstSpeciesImage(animal);
    const factList = facts.length
        ? `<ul class="ui-modal-facts">${facts.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>`
        : '<p class="ui-modal-muted">Fun facts arriving soon.</p>';

    const body = `
        <p class="ui-modal-muted">${escapeHtml(animal.scientific_name || '')}</p>
        <div class="ui-modal-chip-row">
          <span class="animal-status status-${escapeHtml(String(animal.conservation_status || 'least_concern').replace(/_/g, '-'))}">${escapeHtml(String(animal.conservation_status || 'least_concern').replace(/_/g, ' '))}</span>
          <span class="animal-status neutral-chip">${escapeHtml(animal.diet || 'Mixed diet')}</span>
          <span class="animal-status neutral-chip">${escapeHtml(animal.lifespan ? `Lifespan: ${animal.lifespan}` : 'Lifespan: see guide')}</span>
        </div>
        <p>${escapeHtml(animal.description || 'Description coming soon via rangers.')}</p>
        <p><strong>${icon('leaf', 'icon-sm')} Habitat</strong><br>${escapeHtml(animal.habitat || 'Montane rainforest mosaic')}</p>
        ${joinMaybeList(animal.common_locations) ? `<p><strong>${icon('map', 'icon-sm')} Often near</strong><br>${escapeHtml(joinMaybeList(animal.common_locations))}</p>` : ''}
        <h4 class="ui-modal-section-title">${icon('target', 'icon-sm')} Field notes</h4>
        ${factList}`;

    const footer = `
        <div class="ui-modal-actions ui-modal-actions-rich">
          <button type="button" class="login-btn">${icon('target', 'icon-sm')} Open tour help (draft)</button>
          <button type="button" class="ui-btn ui-btn-secondary">Close</button>
        </div>`;

    const overlay = showRichContentModal({
        title: animal.name,
        heroUrl: hero,
        heroAlt: animal.name,
        bodyHtml: body,
        footerHtml: footer
    });

    overlay?.querySelector('.login-btn')?.addEventListener('click', async () => {
        await navigateToAIWithPrompt(speciesAIPromptFromRecord(animal));
    });
    overlay?.querySelector('.ui-btn-secondary')?.addEventListener('click', () => {
        overlay.querySelector('.ui-modal-close')?.click();
    });
};

window.openCulturalStoryDetail = async function openCulturalStoryDetail(narrativeId) {
    const id = String(narrativeId || '').trim();
    if (!id) return showToast('Missing narrative reference', 'danger');

    const story = await API.getCulturalNarrativeById(id);
    if (!story?.narrative_id) {
        showToast('Could not load that cultural story.', 'danger');
        return;
    }

    const hero = firstStoryImage(story);
    const body = `
        ${story?.story_type ? `<p class="ui-modal-muted">${escapeHtml(story.community || 'Community')} • ${escapeHtml(story.story_type)}</p>` : ''}
        <p>${escapeHtml(story?.narrative_en || story?.story || 'Full narrative unavailable offline.')}</p>
        ${story?.cultural_significance ? `<p><strong>${icon('book', 'icon-sm')} Why it matters</strong><br>${escapeHtml(story.cultural_significance)}</p>` : ''}
        ${joinMaybeList(story?.related_locations) ? `<p><strong>${icon('map', 'icon-sm')} Linked places</strong><br>${escapeHtml(joinMaybeList(story.related_locations))}</p>` : ''}`;

    const footer = `
        <div class="ui-modal-actions ui-modal-actions-rich">
          <button type="button" class="login-btn">${icon('target', 'icon-sm')} Open tour help (draft)</button>
          <button type="button" class="ui-btn ui-btn-secondary">Close</button>
        </div>`;

    const overlay = showRichContentModal({
        title: story.title_en || story.title_local || 'Cultural narrative',
        heroUrl: hero,
        heroAlt: story.title_en || '',
        bodyHtml: body,
        footerHtml: footer
    });

    overlay?.querySelector('.login-btn')?.addEventListener('click', async () => {
        await navigateToAIWithPrompt(culturalAIPromptFromRecord(story));
    });
    overlay?.querySelector('.ui-btn-secondary')?.addEventListener('click', () => {
        overlay.querySelector('.ui-modal-close')?.click();
    });
};

// =====================================================
// CONTENT RENDER FUNCTIONS
// =====================================================
async function renderDashboardContent() {
    const animals = await Content.getAnimals();
    const recommendations = await AI.getRecommendations(3);
    const seasonal = await AI.getSeasonalRecommendations();
    return renderDashboardShell({
        primaryTitle: 'Suggested for you',
        primaryIcon: 'target',
        primaryItems: recommendations.map((r) => ({
            title: r.name,
            match: `${Math.round(r.score * 100)}% match`,
            reason: r.reason
        })),
        quote: '"The best view comes after the hardest climb."',
        seasonalTitle: seasonal.season === 'dry' ? `${icon('sun', 'icon-sm')} Dry Season` : `${icon('rain', 'icon-sm')} Wet Season`,
        seasonalItems: seasonal.recommendations,
        seasonalActionLabel: 'View Suggestions',
        animalCount: animals.length
    });
}

function renderDashboardQuickGrid(animalCount = 0) {
    return `<div class="quick-grid"><div class="quick-card quick-photo ${getQuickCardPhotoClass('animals')}" onclick="navigateTo('animals')"><div class="quick-icon">${icon('paw', 'icon-xl')}</div><div class="quick-label">Animals</div><div class="quick-count">${animalCount} species</div></div><div class="quick-card quick-photo ${getQuickCardPhotoClass('map')}" onclick="navigateTo('map')"><div class="quick-icon">${icon('map', 'icon-xl')}</div><div class="quick-label">Map</div></div><div class="quick-card quick-photo ${getQuickCardPhotoClass('culture')}" onclick="navigateTo('culture')"><div class="quick-icon">${icon('book', 'icon-xl')}</div><div class="quick-label">Culture</div></div><div class="quick-card quick-photo ${getQuickCardPhotoClass('info')}" onclick="navigateTo('info')"><div class="quick-icon">${icon('info', 'icon-xl')}</div><div class="quick-label">Info</div></div></div>`;
}

function renderDashboardShell({
    primaryTitle,
    primaryIcon,
    primaryItems,
    quote,
    seasonalTitle,
    seasonalItems,
    seasonalActionLabel,
    animalCount
}) {
    return `${renderDashboardQuickGrid(animalCount)}<div class="dashboard-feature-grid"><div class="section-card"><div class="section-header"><h3>${icon(primaryIcon, 'icon-sm')} ${primaryTitle}</h3></div><div id="recList">${primaryItems.map((item, index) => {
        const recClass = item.avatarType === 'icon' ? 'rec-card system-rec' : 'rec-card';
        const iconOnlyAvatar = item.avatarType === 'icon'
            ? `<div class="rec-avatar metric-avatar metric-avatar-${escapeHtml(item.metricColor || 'default')}" aria-hidden="true"><span class="metric-avatar-icon">${icon(item.iconName || 'info', 'icon-md')}</span></div>`
            : `<div class="rec-avatar ${item.avatarClass || getRecommendationPhotoClass(item, index)}" aria-hidden="true">${item.iconName ? `<span class="rec-symbol">${icon(item.iconName, 'icon-md')}</span>` : ''}</div>`;
        return `<div class="${recClass}">${iconOnlyAvatar}<div class="rec-info"><div class="rec-title">${escapeHtml(item.title)}</div>${item.match ? `<div class="rec-match">${escapeHtml(item.match)}</div>` : ''}<div class="rec-reason">${escapeHtml(item.reason)}</div></div><button class="rec-go" aria-label="Open">${icon(item.goIcon || 'map', 'icon-sm')}</button></div>`;
    }).join('') || '<div class="empty-state">No items available.</div>'}</div></div><div class="dashboard-quote-card"><blockquote>${escapeHtml(quote)}</blockquote></div></div><div class="section-card seasonal-card"><div class="section-header"><h3>${icon('leaf', 'icon-sm')} Seasonal: ${seasonalTitle}</h3></div><div class="seasonal-list">${seasonalItems.map((a) => `<div class="seasonal-item">• ${escapeHtml(a)}</div>`).join('') || '<div class="seasonal-item">• No seasonal updates available</div>'}</div><div class="seasonal-bottom"><div class="seasonal-image-strip photo-leaf" aria-hidden="true"></div><button class="seasonal-action-btn">${escapeHtml(seasonalActionLabel || 'View Suggestions')}</button></div></div>`;}

async function renderAnimalsContent() {
    const animals = await Content.getAnimals();
    if (!animals.length) {
        return `<div class="section-card"><div class="empty-state">No animal records available yet. Run backend seed to load the Bwindi catalogue.</div></div>`;
    }

    const themeRows = await Content.getWildlifeTourThemes();
    const imageBySlug = {};
    if (Array.isArray(themeRows)) {
        themeRows.forEach((row) => {
            const u = row && typeof row.image_url === 'string' ? row.image_url.trim() : '';
            if (row?.slug && u) imageBySlug[row.slug] = u;
        });
    }

    const focusKey = getValidatedAnimalTourFocus();
    let filtered = animals.filter((a) => animalMatchesBwindiTourFocus(a, focusKey));
    const focusMeta = BWINDI_UNESCO_TOUR_THEMES.find((t) => t.id === focusKey);
    let filterBanner = '';
    if (focusKey !== 'all' && !filtered.length) {
        filterBanner = `<div class="tour-filter-note tour-filter-note--fallback" role="status">Nothing in this catalogue matched <strong>${escapeHtml(focusMeta?.title || 'that theme')}</strong> yet, so we’re showing every species instead. Choose another UNESCO theme above or rerun the extended seed script.</div>`;
        filtered = animals;
    } else if (focusKey !== 'all') {
        filterBanner = `<div class="tour-filter-note" role="status">${icon('leaf', 'icon-sm')} Showing <strong>${filtered.length}</strong> species for <strong>${escapeHtml(focusMeta?.title || focusKey)}</strong>. UNESCO reference: list <a href="https://whc.unesco.org/en/list/682/" target="_blank" rel="noopener noreferrer">682</a>.</div>`;
    }

    const tourStrip = renderBwindiTourThemeStrip(animals, focusKey, imageBySlug);

    const intro = `<div class="section-card animals-page-intro"><div class="section-header"><h3>${icon('leaf', 'icon-sm')} Bwindi biodiversity</h3></div><div class="animals-page-blurb">Use the UNESCO theme tiles to match the block your guide is running, or stay on <strong>All species</strong>. Gorillas get the limelight, but primates, Albertine forest birds, elephants, butterflies, and other Red List taxa are why this forest is on the World Heritage list. Open a species card for ranger-style notes. Tour help is optional if you want to expand a topic in your own words.</div><div class="info-chip-row"><button type="button" class="small-btn" onclick="navigateToAIWithPrompt(${JSON.stringify('Bwindi newcomer checklist: main sectors, wet vs dry pacing, gorilla visit etiquette (short bullets).')})">${icon('target', 'icon-sm')} Tour help: first trek</button><button type="button" class="small-btn" onclick="navigateToAIWithPrompt(${JSON.stringify('Birding from main Bwindi trailheads: which Albertine specialties are realistic without playback or nest pressure?')})">${icon('bird', 'icon-sm')} Tour help: birding</button></div></div>`;

    const cards = filtered.map((animal) => {
        const id = escapeHtml(animal.animal_id || animal.id || '');
        const thumb = firstSpeciesImage(animal);
        const teaserSource = animal.description ? String(animal.description) : 'Tap for field notes from the catalogue.';
        const teaser = escapeHtml(truncateSnippet(teaserSource, 164));
        const thumbHtml = thumb
            ? `<div class="animal-card-thumb"><img src="${escapeHtml(thumb)}" alt="" loading="lazy" decoding="async" /></div>`
            : `<div class="animal-card-thumb animal-card-thumb--fallback">${icon(getAnimalIconName(animal.name), 'icon-xl')}</div>`;

        return `<article class="animal-card animal-card--interactive" tabindex="0" aria-label="${escapeHtml(animal.name)} details" onclick="openAnimalSpeciesDetail('${id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openAnimalSpeciesDetail('${id}');}">
            ${thumbHtml}
            <div class="animal-info">
                <div class="animal-name">${escapeHtml(animal.name)}</div>
                <div class="animal-scientific">${escapeHtml(animal.scientific_name || 'Scientific name unavailable')}</div>
                <p class="animal-teaser">${teaser}</p>
                <span class="animal-status status-${escapeHtml(String(animal.conservation_status || 'least_concern').replace(/_/g, '-'))}">${escapeHtml(String(animal.conservation_status || 'least_concern').replace(/_/g, ' '))}</span>
                <div class="animal-card-actions">
                    <button type="button" class="small-btn" onclick="event.stopPropagation(); navigateToAIWithPrompt(${JSON.stringify(speciesAIPromptFromRecord(animal))});">${icon('target', 'icon-sm')} Tour help</button>
                    <button type="button" class="small-btn ghost-btn" onclick="event.stopPropagation(); submitContentHelpfulness('animal', '${id}', '${escapeHtml(animal.name)}');">${icon('target', 'icon-sm')} Helpful?</button>
                </div>
            </div>
        </article>`;
    }).join('');

    return `${tourStrip}${intro}${filterBanner}<div class="animals-list animals-list--responsive">${cards}</div>`;
}

function renderMapContent() {
    return `<div class="map-container"><div id="bwindiLiveMap" class="map-canvas"></div><div class="map-overlay"><div class="map-status" id="mapStatus">Loading Bwindi live map...</div><div class="map-coords" id="mapCoords">Lat: --, Lng: --</div><div class="map-guidance"><select id="mapLayer" class="map-destination" onchange="changeMapLayer()"><option value="standard">Standard</option><option value="topo">Terrain</option><option value="satellite">Satellite</option><option value="trails">Trails Focus</option></select><button class="small-btn" onclick="cacheVisibleMapTiles()">Cache Area</button><button type="button" class="small-btn" onclick="toggleSpeciesHeatmapLayer()">${icon('target', 'icon-sm')} Species heat</button></div><div class="map-guidance"><input id="mapSearchInput" class="map-destination" placeholder="Search location..." /><button class="small-btn" onclick="searchMapLocation()">Find</button></div><div class="map-guidance"><select id="mapDestination" class="map-destination"><option value="">Select destination...</option></select><button class="small-btn" onclick="openMapGuidance()">Guide Me</button></div><div class="map-guidance"><button class="small-btn" onclick="startDistanceMeasure()">Set A</button><button class="small-btn" onclick="setDistanceMeasurePointB()">Set B</button><button class="small-btn" onclick="measureToCurrent()">A → Me</button></div><div class="map-guidance-text" id="mapGuidanceText">Select a destination to get turn-by-turn guidance.</div><div id="mapDirectionsList" class="map-directions">Directions will appear here.</div><div id="mapCompassStatus" class="map-compass">Compass: --</div><div id="mapElevationProfile" class="map-elevation">Elevation profile unavailable.</div><div class="map-nearby" id="mapNearbyList">Nearby POIs will appear here.</div></div></div>`;
}

function normalizeCoordinatePair(point) {
    if (!Array.isArray(point) || point.length < 2) return null;
    const a = Number(point[0]);
    const b = Number(point[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    // GeoJSON commonly stores [lng, lat]. Heuristic keeps coordinates in valid lat/lng ranges.
    if (Math.abs(a) <= 90 && Math.abs(b) <= 180) return [a, b];
    return [b, a];
}

function getBoundaryLatLngs(boundary) {
    if (!boundary) return [];
    if (boundary.type === 'Polygon' && Array.isArray(boundary.coordinates?.[0])) {
        return boundary.coordinates[0]
            .map(normalizeCoordinatePair)
            .filter(Boolean);
    }
    if (
        Number.isFinite(Number(boundary.minLat)) &&
        Number.isFinite(Number(boundary.maxLat)) &&
        Number.isFinite(Number(boundary.minLng)) &&
        Number.isFinite(Number(boundary.maxLng))
    ) {
        const minLat = Number(boundary.minLat);
        const maxLat = Number(boundary.maxLat);
        const minLng = Number(boundary.minLng);
        const maxLng = Number(boundary.maxLng);
        return [
            [minLat, minLng],
            [minLat, maxLng],
            [maxLat, maxLng],
            [maxLat, minLng]
        ];
    }
    return [];
}

function clearLiveMapLayers() {
    if (!liveMapInstance) return;
    (liveMapLayers.markers || []).forEach((m) => {
        try { liveMapInstance.removeLayer(m); } catch (_) {}
    });
    liveMapLayers.markers = [];
    if (liveMapLayers.boundary) {
        try { liveMapInstance.removeLayer(liveMapLayers.boundary); } catch (_) {}
    }
    liveMapLayers.boundary = null;
    if (liveMapLayers.route) {
        try { liveMapInstance.removeLayer(liveMapLayers.route); } catch (_) {}
    }
    liveMapLayers.route = null;
    if (liveMapLayers.activeTourRoute) {
        try { liveMapInstance.removeLayer(liveMapLayers.activeTourRoute); } catch (_) {}
    }
    liveMapLayers.activeTourRoute = null;
}

function setMapStatus(text) {
    const node = document.getElementById('mapStatus');
    if (node) node.textContent = text;
}

function setMapCoords(lat, lng) {
    const node = document.getElementById('mapCoords');
    if (node) {
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            node.textContent = `Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`;
        } else {
            node.textContent = 'Lat: --, Lng: --';
        }
    }
}

function stopLiveMapRefresh() {
    if (liveMapRefreshTimer) {
        clearInterval(liveMapRefreshTimer);
        liveMapRefreshTimer = null;
    }
}

function buildTurnByTurnGuidance(from, to, destinationName) {
    const latDiff = to.lat - from.lat;
    const lngDiff = to.lng - from.lng;
    const ns = latDiff >= 0 ? 'north' : 'south';
    const ew = lngDiff >= 0 ? 'east' : 'west';
    const distanceMeters = Geofence.calculateDistance(from.lat, from.lng, to.lat, to.lng);
    const distanceKm = (distanceMeters / 1000).toFixed(2);
    const minutes = Math.max(3, Math.round((distanceMeters / 1000) / 4.2 * 60)); // ~4.2 km/h trekking speed
    const phaseOne = Math.max(1, Math.round(minutes * 0.45));
    const phaseTwo = Math.max(1, Math.round(minutes * 0.35));
    const phaseThree = Math.max(1, minutes - phaseOne - phaseTwo);
    return `Head ${ns} for ~${phaseOne} min, continue ${ew} for ~${phaseTwo} min, then follow park trail signs to ${destinationName} for ~${phaseThree} min. Total distance: ${distanceKm} km (${minutes} min walk).`;
}

function getTrailDifficulty(location = {}) {
    const source = `${location.difficulty || ''} ${location.name || ''} ${location.description || ''}`.toLowerCase();
    if (source.includes('hard') || source.includes('difficult') || source.includes('steep')) return 'difficult';
    if (source.includes('moderate') || source.includes('medium')) return 'moderate';
    return 'easy';
}

function trailDifficultyColor(level = 'easy') {
    if (level === 'difficult') return '#D62828';
    if (level === 'moderate') return '#F4A261';
    return '#2A9D8F';
}

function renderDirectionsList(from, to, destinationName) {
    const distanceMeters = Geofence.calculateDistance(from.lat, from.lng, to.lat, to.lng);
    const km = distanceMeters / 1000;
    const minutes = Math.max(3, Math.round(km / 4.2 * 60));
    const eta = new Date(Date.now() + minutes * 60000);
    const ns = to.lat >= from.lat ? 'north' : 'south';
    const ew = to.lng >= from.lng ? 'east' : 'west';
    return [
        `1. Face ${ns} and continue for ${(km * 0.45).toFixed(2)} km.`,
        `2. Keep ${ew} on the marked trail for ${(km * 0.35).toFixed(2)} km.`,
        `3. Follow ranger posts/signage to ${destinationName} for ${(km * 0.20).toFixed(2)} km.`,
        `ETA: ${minutes} min (arrive around ${eta.toLocaleTimeString()}).`
    ];
}

function updateCompassStatus(from, to) {
    const node = document.getElementById('mapCompassStatus');
    if (!node) return;
    if (!from || !to) {
        node.textContent = 'Compass: --';
        return;
    }
    const lat1 = from.lat * Math.PI / 180;
    const lat2 = to.lat * Math.PI / 180;
    const dLng = (to.lng - from.lng) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    const bearing = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    const cardinal = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(bearing / 45) % 8];
    node.textContent = `Compass: ${cardinal} (${Math.round(bearing)}° from north)`;
}

function renderElevationProfile(from, to, difficulty = 'easy') {
    const node = document.getElementById('mapElevationProfile');
    if (!node || !from || !to) return;
    const distanceKm = Math.max(0.1, Geofence.calculateDistance(from.lat, from.lng, to.lat, to.lng) / 1000);
    const baseGain = difficulty === 'difficult' ? 220 : (difficulty === 'moderate' ? 140 : 80);
    const elevationGain = Math.round(baseGain * distanceKm);
    const bars = Array.from({ length: 8 }).map((_, i) => {
        const h = 16 + Math.round((i + 1) / 8 * (difficulty === 'difficult' ? 40 : (difficulty === 'moderate' ? 30 : 22)));
        return `<span class="elev-bar" style="height:${h}px"></span>`;
    }).join('');
    node.innerHTML = `<div class="map-elev-title">Estimated elevation profile (${difficulty})</div><div class="map-elev-bars">${bars}</div><div class="map-elev-meta">Approx gain: ${elevationGain} m over ${distanceKm.toFixed(2)} km</div>`;
}

window.openMapGuidance = function () {
    const selector = document.getElementById('mapDestination');
    const guidanceNode = document.getElementById('mapGuidanceText');
    if (!selector || !guidanceNode) return;
    const selected = liveMapPOIs.find((p) => String(p.id) === selector.value);
    if (!selected) {
        guidanceNode.textContent = 'Select a destination to get turn-by-turn guidance.';
        return;
    }

    const current = Geofence?.currentLocation || AppState?.currentLocation;
    if (!current || !Number.isFinite(current.lat) || !Number.isFinite(current.lng)) {
        guidanceNode.textContent = 'Live location unavailable. Allow location access to generate guidance.';
        return;
    }

    const destination = coerceLatLng(selected);
    if (!destination) {
        guidanceNode.textContent = 'Destination coordinates unavailable.';
        return;
    }

    const guidance = buildTurnByTurnGuidance(current, destination, selected.name || 'destination');
    guidanceNode.textContent = guidance;
    const list = document.getElementById('mapDirectionsList');
    if (list) {
        const items = renderDirectionsList(current, destination, selected.name || 'destination');
        list.innerHTML = items.map((line) => `<div>• ${escapeHtml(line)}</div>`).join('');
    }
    updateCompassStatus(current, destination);
    renderElevationProfile(current, destination, getTrailDifficulty(selected));
    activeGuidanceTarget = {
        name: selected.name || 'destination',
        lat: destination.lat,
        lng: destination.lng
    };

    if (liveMapInstance) {
        if (liveMapLayers.activeTourRoute) {
            try { liveMapInstance.removeLayer(liveMapLayers.activeTourRoute); } catch (_) {}
        }
        liveMapLayers.activeTourRoute = window.L.polyline(
            [[current.lat, current.lng], [destination.lat, destination.lng]],
            { color: '#D62828', weight: 3, dashArray: '10,6', opacity: 0.9 }
        ).addTo(liveMapInstance);
        liveMapInstance.fitBounds(liveMapLayers.activeTourRoute.getBounds().pad(0.28));
    }
};

window.cacheVisibleMapTiles = async function () {
    if (!liveMapInstance || !window.caches) {
        setMapStatus('Tile caching unavailable in this browser.');
        return;
    }
    const layerName = document.getElementById('mapLayer')?.value || 'standard';
    const template = liveMapTileLayers[layerName]?._url || liveMapTileLayers.standard?._url;
    if (!template) {
        setMapStatus('No tile template available for caching.');
        return;
    }
    const zoom = liveMapInstance.getZoom();
    const bounds = liveMapInstance.getBounds();
    const nw = bounds.getNorthWest();
    const se = bounds.getSouthEast();
    const latLngToTile = (lat, lng, z) => {
        const n = 2 ** z;
        const x = Math.floor(((lng + 180) / 360) * n);
        const latRad = lat * Math.PI / 180;
        const y = Math.floor((1 - Math.log(Math.tan(latRad) + (1 / Math.cos(latRad))) / Math.PI) / 2 * n);
        return { x, y };
    };
    const a = latLngToTile(nw.lat, nw.lng, zoom);
    const b = latLngToTile(se.lat, se.lng, zoom);
    const minX = Math.min(a.x, b.x);
    const maxX = Math.max(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxY = Math.max(a.y, b.y);
    const urls = [];
    for (let x = minX; x <= maxX; x += 1) {
        for (let y = minY; y <= maxY; y += 1) {
            urls.push(template.replace('{s}', 'a').replace('{z}', String(zoom)).replace('{x}', String(x)).replace('{y}', String(y)));
        }
    }
    try {
        const cache = await caches.open('bwindi-map-tiles-v1');
        await Promise.all(urls.slice(0, 120).map((url) => cache.add(url).catch(() => null)));
        setMapStatus(`Cached ${Math.min(120, urls.length)} map tiles for offline use.`);
    } catch (_) {
        setMapStatus('Failed to cache map tiles. Check connection and retry.');
    }
};

window.changeMapLayer = function () {
    if (!liveMapInstance) return;
    const selected = document.getElementById('mapLayer')?.value || 'standard';
    Object.values(liveMapTileLayers).forEach((layer) => {
        try { liveMapInstance.removeLayer(layer); } catch (_) {}
    });
    const target = liveMapTileLayers[selected] || liveMapTileLayers.standard;
    if (target) target.addTo(liveMapInstance);
};

window.searchMapLocation = function () {
    const input = document.getElementById('mapSearchInput');
    const query = (input?.value || '').trim().toLowerCase();
    if (!query) return;
    const match = liveMapPOIs.find((p) => String(p.name || '').toLowerCase().includes(query));
    if (!match || !liveMapInstance) {
        setMapStatus('No matching location found');
        return;
    }
    const coords = coerceLatLng(match);
    if (!coords) return;
    liveMapInstance.setView([coords.lat, coords.lng], 14);
    setMapStatus(`Centered on ${match.name}`);
};

window.startDistanceMeasure = function () {
    const current = Geofence?.currentLocation || AppState?.currentLocation;
    if (!current || !Number.isFinite(current.lat) || !Number.isFinite(current.lng)) {
        setMapStatus('Cannot set point A without current location');
        return;
    }
    measureStartPoint = { lat: current.lat, lng: current.lng };
    setMapStatus(`Point A set at ${current.lat.toFixed(4)}, ${current.lng.toFixed(4)}`);
};

window.measureToCurrent = function () {
    if (!measureStartPoint) {
        setMapStatus('Set point A first');
        return;
    }
    const current = Geofence?.currentLocation || AppState?.currentLocation;
    if (!current || !Number.isFinite(current.lat) || !Number.isFinite(current.lng)) {
        setMapStatus('Current location unavailable');
        return;
    }
    const meters = Geofence.calculateDistance(measureStartPoint.lat, measureStartPoint.lng, current.lat, current.lng);
    setMapStatus(`Distance A → current: ${(meters / 1000).toFixed(2)} km`);
    if (liveMapInstance) {
        if (liveMapLayers.route) {
            try { liveMapInstance.removeLayer(liveMapLayers.route); } catch (_) {}
        }
        liveMapLayers.route = window.L.polyline(
            [[measureStartPoint.lat, measureStartPoint.lng], [current.lat, current.lng]],
            { color: '#7B1FA2', weight: 3, dashArray: '6,5', opacity: 0.9 }
        ).addTo(liveMapInstance);
    }
};

window.setDistanceMeasurePointB = function () {
    if (!liveMapInstance || !measureStartPoint) {
        setMapStatus('Set point A first, then click the map to set point B.');
        return;
    }
    setMapStatus('Tap/click map once to set point B.');
    const onceHandler = (event) => {
        const end = { lat: event.latlng.lat, lng: event.latlng.lng };
        const meters = Geofence.calculateDistance(measureStartPoint.lat, measureStartPoint.lng, end.lat, end.lng);
        setMapStatus(`Distance A → B: ${(meters / 1000).toFixed(2)} km`);
        if (liveMapLayers.route) {
            try { liveMapInstance.removeLayer(liveMapLayers.route); } catch (_) {}
        }
        liveMapLayers.route = window.L.polyline(
            [[measureStartPoint.lat, measureStartPoint.lng], [end.lat, end.lng]],
            { color: '#7B1FA2', weight: 3, dashArray: '6,5', opacity: 0.9 }
        ).addTo(liveMapInstance);
    };
    liveMapInstance.once('click', onceHandler);
};

function teardownLiveMap() {
    stopLiveMapRefresh();
    if (liveMapInstance) {
        clearLiveMapLayers();
        try { liveMapInstance.remove(); } catch (_) {}
        liveMapInstance = null;
    }
    liveMapTileLayers = {};
}

function markerClassForLocation(location = {}) {
    const type = String(location.type || '').toLowerCase();
    const name = String(location.name || '').toLowerCase();
    if (type.includes('gate')) return 'map-marker-gate';
    if (type.includes('ranger') || name.includes('ranger')) return 'map-marker-ranger';
    if (type.includes('camp') || type.includes('station')) return 'map-marker-station';
    return 'map-marker-poi';
}

function createDivMarker(lat, lng, className, label) {
    const marker = window.L.marker([lat, lng], {
        icon: window.L.divIcon({
            className: `map-marker ${className}`,
            iconSize: [14, 14],
            iconAnchor: [7, 7]
        })
    }).addTo(liveMapInstance);
    if (label) marker.bindPopup(label);
    return marker;
}

function coerceLatLng(record = {}) {
    const latKeys = ['lat', 'latitude', 'location_lat', 'current_lat'];
    const lngKeys = ['lng', 'longitude', 'location_lng', 'current_lng'];
    let lat;
    let lng;
    for (const key of latKeys) {
        const v = Number(record[key]);
        if (Number.isFinite(v)) { lat = v; break; }
    }
    for (const key of lngKeys) {
        const v = Number(record[key]);
        if (Number.isFinite(v)) { lng = v; break; }
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
}

async function refreshLiveMapData() {
    if (!liveMapInstance) return;
    clearLiveMapLayers();

    const defaultCenter = [-1.05, 29.7];

    try {
        const heatmapOn = () => localStorage.getItem('sigts_map_species_heat') === '1';
        let heatCells = [];

        const [locations, sightings, tours, boundaryGeo] = await Promise.all([
            API.getLocations(),
            API.getRecentSightings(50),
            API.getToursForGuide(),
            (async () => {
                try {
                    const response = await fetch(`${API_URL}/geofence/boundary`, {
                        headers: Auth?.token ? { Authorization: `Bearer ${Auth.token}` } : {}
                    });
                    if (response.ok) return await response.json();
                } catch (_) {}
                return Geofence?.parkBoundary || null;
            })()
        ]);

        if (heatmapOn() && Auth?.isAuthenticated?.()) {
            try {
                const hm = await API.getSightingsHeatmap({ limit: 180 });
                heatCells = Array.isArray(hm?.points) ? hm.points : [];
            } catch (_) {
                heatCells = [];
            }
        }

        const boundaryLatLngs = getBoundaryLatLngs(boundaryGeo);
        if (boundaryLatLngs.length >= 3) {
            liveMapLayers.boundary = window.L.polygon(boundaryLatLngs, {
                color: '#1B5E20',
                weight: 2,
                fillColor: '#2E7D32',
                fillOpacity: 0.12
            }).addTo(liveMapInstance);
        }

        const pois = (Array.isArray(locations) ? locations : []);
        liveMapPOIs = pois.filter((loc) => coerceLatLng(loc));
        const destinationSelect = document.getElementById('mapDestination');
        if (destinationSelect) {
            const currentValue = destinationSelect.value;
            destinationSelect.innerHTML = '<option value="">Select destination...</option>' +
                liveMapPOIs.map((loc, idx) => `<option value="${escapeHtml(String(loc.location_id || loc.id || idx))}">${escapeHtml(loc.name || 'POI')}</option>`).join('');
            if (currentValue && liveMapPOIs.some((loc, idx) => String(loc.location_id || loc.id || idx) === currentValue)) {
                destinationSelect.value = currentValue;
            }
            liveMapPOIs = liveMapPOIs.map((loc, idx) => ({ ...loc, id: String(loc.location_id || loc.id || idx) }));
        }

        const poiMarkers = pois
            .map((loc) => {
                const coords = coerceLatLng(loc);
                if (!coords) return null;
                const difficulty = getTrailDifficulty(loc);
                return createDivMarker(
                    coords.lat,
                    coords.lng,
                    markerClassForLocation(loc),
                    `<strong>${escapeHtml(loc.name || 'POI')}</strong><br>${escapeHtml(loc.type || 'location')}<br>Trail: ${escapeHtml(difficulty)}`
                );
            })
            .filter(Boolean);
        liveMapLayers.markers.push(...poiMarkers);

        const trailPolylines = liveMapPOIs
            .filter((loc) => String(loc.type || loc.location_type || '').toLowerCase().includes('trail'))
            .map((loc) => coerceLatLng(loc))
            .filter(Boolean)
            .sort((a, b) => a.lat - b.lat || a.lng - b.lng);
        if (trailPolylines.length > 1) {
            const difficulty = getTrailDifficulty({ name: 'trail', description: 'moderate' });
            const trailLayer = window.L.polyline(
                trailPolylines.map((p) => [p.lat, p.lng]),
                { color: trailDifficultyColor(difficulty), weight: 4, opacity: 0.7 }
            ).addTo(liveMapInstance);
            liveMapLayers.markers.push(trailLayer);
        }

        const sightingMarkers = (Array.isArray(sightings) ? sightings : [])
            .map((sighting) => {
                const coords = coerceLatLng(sighting);
                if (!coords) return null;
                return createDivMarker(
                    coords.lat,
                    coords.lng,
                    'map-marker-sighting',
                    `<strong>${escapeHtml(sighting.animal_name || 'Sighting')}</strong><br>${escapeHtml(sighting.location_name || 'Observed point')}`
                );
            })
            .filter(Boolean);
        liveMapLayers.markers.push(...sightingMarkers);

        if (heatCells.length && liveMapInstance) {
            const maxW = Math.max(...heatCells.map((c) => Number(c.weight) || 1), 1);
            heatCells.forEach((c) => {
                const lat = Number(c.lat);
                const lng = Number(c.lng);
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                const w = Number(c.weight) || 1;
                const t = Math.min(1, w / maxW);
                const cir = window.L.circle([lat, lng], {
                    radius: 450 + w * 90,
                    color: '#dc2626',
                    weight: 1,
                    fillColor: '#f97316',
                    fillOpacity: 0.12 + t * 0.35
                }).addTo(liveMapInstance);
                cir.bindTooltip(`${escapeHtml(c.animal_name || 'Sightings')} · weight ${w}`);
                liveMapLayers.markers.push(cir);
            });
        }

        const current = Geofence?.currentLocation || AppState?.currentLocation;
        if (current && Number.isFinite(current.lat) && Number.isFinite(current.lng)) {
            const userMarker = createDivMarker(current.lat, current.lng, 'map-marker-user', 'Your current location');
            userMarker.bindPopup('Your current location');
            liveMapLayers.markers.push(userMarker);
            if (Number.isFinite(Number(current.accuracy)) && Number(current.accuracy) > 0) {
                const accuracyCircle = window.L.circle([current.lat, current.lng], {
                    radius: Math.min(1200, Number(current.accuracy)),
                    color: '#2563eb',
                    fillColor: '#60a5fa',
                    fillOpacity: 0.12,
                    weight: 1
                }).addTo(liveMapInstance);
                liveMapLayers.markers.push(accuracyCircle);
            }
            setMapCoords(current.lat, current.lng);
            if (activeGuidanceTarget) {
                const remaining = Geofence.calculateDistance(current.lat, current.lng, activeGuidanceTarget.lat, activeGuidanceTarget.lng);
                const node = document.getElementById('mapGuidanceText');
                if (node) {
                    if (remaining <= 50) {
                        node.textContent = `You have reached ${activeGuidanceTarget.name}. Route complete. Please add feedback from your profile.`;
                    } else {
                        node.textContent = `Navigating to ${activeGuidanceTarget.name}. Remaining distance: ${(remaining / 1000).toFixed(2)} km.`;
                    }
                }
                updateCompassStatus(current, activeGuidanceTarget);
                if (remaining <= 200 && Date.now() - lastTurnAlertAt > 30000) {
                    lastTurnAlertAt = Date.now();
                    showToast(`Next turn alert: ${activeGuidanceTarget.name} is ${(remaining).toFixed(0)}m ahead.`, 'info');
                }
            }
            const nearby = liveMapPOIs
                .map((p) => {
                    const coords = coerceLatLng(p);
                    if (!coords) return null;
                    const dist = Geofence.calculateDistance(current.lat, current.lng, coords.lat, coords.lng);
                    return { name: p.name || 'POI', dist };
                })
                .filter(Boolean)
                .sort((a, b) => a.dist - b.dist)
                .slice(0, 4);
            const nearbyNode = document.getElementById('mapNearbyList');
            if (nearbyNode) {
                nearbyNode.innerHTML = nearby.length
                    ? nearby.map((n) => `• ${escapeHtml(n.name)} (${(n.dist / 1000).toFixed(2)} km)`).join('<br>')
                    : 'No nearby POIs available.';
            }
        } else {
            setMapCoords(null, null);
        }

        const historyPoints = (Geofence?.locationHistory || [])
            .slice(-120)
            .map((p) => [Number(p.lat), Number(p.lng)])
            .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
        if (historyPoints.length > 1) {
            liveMapLayers.route = window.L.polyline(historyPoints, {
                color: '#2A9D8F',
                weight: 3,
                opacity: 0.85
            }).addTo(liveMapInstance);
        }

        const activeTourPoints = (Array.isArray(tours) ? tours : [])
            .filter((t) => String(t.status || '').toLowerCase() === 'ongoing')
            .map((t) => coerceLatLng(t))
            .filter(Boolean)
            .map((p) => [p.lat, p.lng]);
        if (activeTourPoints.length > 1) {
            liveMapLayers.activeTourRoute = window.L.polyline(activeTourPoints, {
                color: '#D62828',
                weight: 3,
                opacity: 0.9,
                dashArray: '8,6'
            }).addTo(liveMapInstance);
        }

        const layers = [];
        if (liveMapLayers.boundary) layers.push(liveMapLayers.boundary);
        if (liveMapLayers.route) layers.push(liveMapLayers.route);
        if (liveMapLayers.activeTourRoute) layers.push(liveMapLayers.activeTourRoute);
        layers.push(...liveMapLayers.markers);
        if (layers.length) {
            const group = window.L.featureGroup(layers);
            liveMapInstance.fitBounds(group.getBounds().pad(0.18));
        } else {
            liveMapInstance.setView(defaultCenter, 11);
        }

        setMapStatus(`Bwindi live: ${poiMarkers.length} POIs, ${sightingMarkers.length} sightings`);
    } catch (error) {
        setMapStatus('Map loaded with limited data. Check API connectivity.');
    }
}

async function initializeLiveMap() {
    const mapNode = document.getElementById('bwindiLiveMap');
    if (!mapNode) return;

    if (!window.L || !window.L.map) {
        setMapStatus('Map library unavailable. Check internet/CDN access.');
        return;
    }

    teardownLiveMap();

    const defaultCenter = [-1.05, 29.7];
    liveMapInstance = window.L.map('bwindiLiveMap', { zoomControl: true }).setView(defaultCenter, 11);
    liveMapTileLayers.standard = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    });
    liveMapTileLayers.topo = window.L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: '&copy; OpenTopoMap contributors'
    });
    liveMapTileLayers.satellite = window.L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    });
    liveMapTileLayers.trails = window.L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        opacity: 0.95,
        attribution: '&copy; OpenTopoMap contributors'
    });
    liveMapTileLayers.standard.addTo(liveMapInstance);

    await refreshLiveMapData();
    liveMapRefreshTimer = setInterval(() => {
        refreshLiveMapData();
    }, 15000);
}

async function renderCultureContent() {
    const stories = await API.getCulturalStories();
    if (!stories.length) {
        return `<div class="section-card"><div class="empty-state">Cultural stories will appear here once guides publish narratives. Seed data adds Batwa/Bakiga-friendly demos automatically.</div></div>`;
    }

    const [featured, ...rest] = stories;
    const secondary = rest.slice(0, 5);
    const featImg = firstStoryImage(featured);
    const featuredBgStyle = featImg
        ? `background-image:url('${escapeHtml(featImg)}');`
        : 'background:linear-gradient(135deg,#795548,#5D4037);';
    const featId = escapeHtml(featured.narrative_id || '');

    const intro = `<div class="section-card culture-page-intro"><div class="section-header"><h3>${icon('users', 'icon-sm')} Living heritage</h3></div><div class="animals-page-blurb">Stories foreground Batwa forest knowledge and Bakiga highland rhythms around Bwindi. Cards carry consent-checked narratives and tie into trekking etiquette. Read here first. Tour help is only if you want a scratch draft to edit.</div><div class="info-chip-row"><button type="button" class="small-btn" onclick="navigateToAIWithPrompt(${JSON.stringify('Visiting Buhoma-area communities tied to trekking: manners around Batwa interpreters and homestead hosts (practical list).')});">${icon('target', 'icon-sm')} Tour help: community etiquette</button></div></div>`;

    const featuredMarkup = `
        <div class="story-card featured story-card--interactive" tabindex="0" onclick="openCulturalStoryDetail('${featId}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openCulturalStoryDetail('${featId}');}">
            <div class="story-image" style="${featuredBgStyle}" role="img" aria-label=""></div>
            <div class="story-content">
                <span class="story-community">${escapeHtml(featured.community || 'Community story')}</span>
                <div class="story-title">${escapeHtml(featured.title_en || featured.title_local || 'Untitled story')}</div>
                <div class="animal-teaser">${escapeHtml(truncateSnippet(featured.duration ? `About ${featured.duration}-minute listen.` : 'Tap for full stewardship notes.', 140))}</div>
                <div class="animal-card-actions">
                    <button type="button" class="small-btn" onclick="event.stopPropagation(); navigateToAIWithPrompt(${JSON.stringify(culturalAIPromptFromRecord(featured))});">${icon('target', 'icon-sm')} Tour help</button>
                    <button type="button" class="small-btn ghost-btn" onclick="event.stopPropagation(); submitContentHelpfulness('cultural', '${featId}', '${escapeHtml(featured.title_en || featured.title_local || 'story')}');">${icon('target', 'icon-sm')} Helpful?</button>
                </div>
                <div class="story-storyteller">${escapeHtml(featured.storyteller_name || 'Unknown storyteller')}${featured.duration ? ` • ${featured.duration} min` : ''}</div>
            </div>
        </div>`;

    const secondaryMarkup = secondary.map((story) => {
        const sid = escapeHtml(story.narrative_id || '');
        const simg = firstStoryImage(story);
        const thumb = simg
            ? `<div class="culture-card-thumb"><img src="${escapeHtml(simg)}" alt="" loading="lazy" decoding="async" /></div>`
            : `<div class="culture-card-thumb culture-card-thumb--fallback">${icon('book', 'icon-xl')}</div>`;

        return `<article class="story-card culture-card-mini story-card--interactive" tabindex="0" onclick="openCulturalStoryDetail('${sid}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openCulturalStoryDetail('${sid}');}">
            ${thumb}
            <div class="story-content">
                <span class="story-community">${escapeHtml(story.community || 'Community story')}</span>
                <div class="story-title">${escapeHtml(story.title_en || story.title_local || 'Untitled story')}</div>
                <div class="animal-teaser">${escapeHtml(truncateSnippet(story.verification_badge || 'Tap for narrative + etiquette prompts.', 120))}</div>
                <div class="animal-card-actions">
                    <button type="button" class="small-btn" onclick="event.stopPropagation(); navigateToAIWithPrompt(${JSON.stringify(culturalAIPromptFromRecord(story))});">${icon('target', 'icon-sm')} Tour help</button>
                    <button type="button" class="small-btn ghost-btn" onclick="event.stopPropagation(); submitContentHelpfulness('cultural', '${sid}', '${escapeHtml(story.title_en || story.title_local || 'story')}');">${icon('target', 'icon-sm')} Helpful?</button>
                </div>
            </div>
        </article>`;
    }).join('');

    return `${intro}${featuredMarkup}<div class="culture-card-grid">${secondaryMarkup}</div>`;
}

async function renderSightingsContent() {
    const sightings = await API.getRecentSightings(10);
    const commentsBySighting = {};
    await Promise.all((sightings || []).map(async (sighting) => {
        const sid = sighting.sighting_id;
        if (!sid) return;
        commentsBySighting[sid] = await API.getSightingComments(sid, 3);
    }));
    return `<div class="section-card"><div class="section-header"><h3>${icon('camera', 'icon-sm')} Recent Sightings</h3><button class="add-btn" onclick="addSighting()">${icon('plus', 'icon-sm')} Report</button></div><div class="sighting-list">${sightings.length ? sightings.map(sighting => `        <div class="sighting-item">
            <div class="sighting-icon">${icon(getAnimalIconName(sighting.animal_name), 'icon-lg')}</div>
            <div class="sighting-main">
                <div class="sighting-name">${escapeHtml(sighting.animal_name || 'Wildlife sighting')}</div>
                <div class="sighting-meta">${escapeHtml(sighting.location_name || 'Unknown location')} • ${new Date(sighting.timestamp).toLocaleString()}</div>
                <div class="sighting-comments">${(commentsBySighting[sighting.sighting_id] || []).length ? (commentsBySighting[sighting.sighting_id] || []).map((c) => `<div class="sighting-comment"><strong>${escapeHtml(c.full_name || c.username || 'Visitor')}:</strong> ${escapeHtml(c.comment_text || '')}</div>`).join('') : '<div class="sighting-comment muted">No comments yet.</div>'}</div>
                <button class="small-btn sighting-comment-btn" onclick="addSightingCommentPrompt('${sighting.sighting_id}')">${icon('note', 'icon-sm')} Comment</button>
            </div>
            <span class="sighting-badge">${icon('paw', 'icon-sm')} ${sighting.number_observed || 1}</span>
        </div>`).join('') : '<div class="empty-state">No verified sightings available yet.</div>'}</div></div>`;
}

function renderProfileContent() {
    const user = Auth.getCurrentUser() || { name: 'Tourist' };
    const isITManager = user?.role === 'it_manager' || user?.userType === 'it_manager';
    const isGuide = user?.role === 'guide' || user?.userType === 'guide';
    const currentLanguage = AppState.userPreferences?.language || 'en';
    return `<div class="profile-header"><div class="profile-avatar">${icon('user', 'icon-xl')}</div><div class="profile-name">${escapeHtml(user.name)}</div><div class="profile-role">${user.role || 'tourist'}</div><div class="profile-dept">${user.department || ''}</div></div>
    <div class="section-card"><div class="section-header"><h3>${icon('note', 'icon-sm')} Experience Settings</h3></div><div style="padding:16px; display:grid; gap:12px;"><label class="auth-field"><span class="auth-field-label">Language</span><select id="profileLanguage" class="auth-select"><option value="en" ${currentLanguage === 'en' ? 'selected' : ''}>English</option><option value="fr" ${currentLanguage === 'fr' ? 'selected' : ''}>French</option><option value="sw" ${currentLanguage === 'sw' ? 'selected' : ''}>Swahili</option><option value="ruk" ${currentLanguage === 'ruk' ? 'selected' : ''}>Rukiga</option></select></label><button class="small-btn" onclick="saveLanguagePreference()">Save Language</button></div></div>
    <div class="section-card"><div class="section-header"><h3>${icon('target', 'icon-sm')} Feedback Loop</h3></div><div style="padding:16px; display:grid; gap:12px;">
        <label class="auth-field"><span class="auth-field-label">Rate your recent experience</span><select id="feedbackRating" class="auth-select"><option value="5">5 - Excellent</option><option value="4">4 - Good</option><option value="3">3 - Average</option><option value="2">2 - Poor</option><option value="1">1 - Very Poor</option></select></label>
        <label class="auth-field"><span class="auth-field-label">Category</span><select id="feedbackCategory" class="auth-select"><option value="tour">Tour</option><option value="guide">Guide</option><option value="content">Content</option><option value="app">App</option><option value="general">General</option><option value="bug_report">Bug Report</option><option value="feature_suggestion">Feature Suggestion</option><option value="survey">Survey</option><option value="nps">NPS</option></select></label>
        <label class="auth-field"><span class="auth-field-label">Tour Session ID (optional)</span><input id="feedbackTourSession" class="auth-input" placeholder="Paste tour session UUID if available" /></label>
        <label class="auth-field"><span class="auth-field-label">NPS Score (0-10, optional)</span><input id="feedbackNPS" type="number" min="0" max="10" class="auth-input" placeholder="How likely are you to recommend SIGTS?" /></label>
        <label class="auth-field"><span class="auth-field-label">Screenshot URL (optional)</span><input id="feedbackScreenshot" class="auth-input" placeholder="For bug reports: screenshot link" /></label>
        <label class="auth-field"><span class="auth-field-label">Comment</span><textarea id="feedbackComment" class="auth-input" style="min-height:80px; padding-top:10px;" placeholder="Share what worked and what can improve..."></textarea></label>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button class="small-btn" onclick="submitUserFeedback()">Submit Feedback</button>
            <button class="small-btn" onclick="submitSatisfactionSurvey()">Quick Survey</button>
            <button class="small-btn" onclick="submitNPSFeedback()">Submit NPS</button>
            ${!isGuide ? '<button class="small-btn" onclick="submitTourCompletionFeedback()">Rate Last Tour</button><button class="small-btn" onclick="submitGuidePerformanceFeedback()">Rate Guide</button>' : ''}
            <button class="small-btn" onclick="submitBugReportPrompt()">Report Bug</button>
            <button class="small-btn" onclick="submitFeatureSuggestionPrompt()">Suggest Feature</button>
        </div>
        <div id="feedbackList" class="seasonal-list"><div class="seasonal-item">Loading your recent feedback...</div></div>
    </div></div>
    <div class="profile-menu"><div class="menu-item" onclick="downloadOfflineContent()"><div class="menu-icon">${icon('download', 'icon-md')}</div><div class="menu-text">Download Offline Content</div></div>${isITManager ? `<div class="menu-item" onclick="handleMFASetup()"><div class="menu-icon">${icon('shield', 'icon-md')}</div><div class="menu-text">Configure MFA</div></div>` : ''}<div class="menu-item" onclick="Auth.logout()"><div class="menu-icon">${icon('logout', 'icon-md')}</div><div class="menu-text">Logout</div></div></div>`;
}

function renderInfoContent() {
    const planPrompt = JSON.stringify(
        'One-week low-footprint trekking plan in southwest Uganda, Bwindi core: daily rhythm, water, altitude, tipping, rainforest kit, radio check with guides.');
    const unescoPrompt = JSON.stringify(
        'Bwindi World Heritage (criteria vii and x): plain-language gist for tourists. Why the listing matters for protection.');
    const birdPrompt = JSON.stringify(
        'Rough bird tally people quote for Bwindi; Albertine families worth learning without stressing nests or playback.');

    return `<div class="section-card"><div class="section-header"><h3>${icon('target', 'icon-sm')} Park snapshot</h3></div><div class="park-info-copy">Roughly <strong>331 km²</strong> of steep montane rainforest on the Albertine Rift shoulder. UNESCO cites exceptional biodiversity: gorillas, deep bird lists, elephants, thick primate mixes, layered trees and ferns (<a href="https://whc.unesco.org/en/list/682/" target="_blank" rel="noopener noreferrer">official summary</a>). SIGTS stitches maps, ranger copy, offline packs, and this app’s Tour help tab so groups can cross-check ecology, etiquette, culture, and safety on the trail.</div><div class="info-chip-row"><button type="button" class="small-btn" onclick="navigateToAIWithPrompt(${unescoPrompt});">${icon('book', 'icon-sm')} Tour help: UNESCO gist</button><button type="button" class="small-btn" onclick="navigateToAIWithPrompt(${birdPrompt});">${icon('bird', 'icon-sm')} Tour help: birds</button><button type="button" class="small-btn" onclick="navigateToAIWithPrompt(${planPrompt});">${icon('map', 'icon-sm')} Tour help: week pacing</button></div><button type="button" class="small-btn ghost-btn" style="margin-top:10px;" onclick="submitContentHelpfulness('info', '', 'Park snapshot')">${icon('target', 'icon-sm')} Helpful?</button></div>
    <div class="section-card"><div class="section-header"><h3>${icon('clock', 'icon-sm')} Opening Hours</h3></div><div style="padding:16px;">Typical UWA gate window: <strong>06:00 to 19:00</strong> (confirm with your issued permit).<div class="info-chip-row" style="margin-top:10px;"><button type="button" class="small-btn" onclick="navigateToAIWithPrompt(${JSON.stringify('Packing: dawn gorilla briefing vs afternoon forest walk in Bwindi.')});">${icon('target', 'icon-sm')} Tour help: gear timing</button></div><button class="small-btn" style="margin-top:10px;" onclick="submitContentHelpfulness('info', '', 'Opening Hours')">${icon('target', 'icon-sm')} Helpful?</button></div></div>
    <div class="section-card"><div class="section-header"><h3>${icon('phone', 'icon-sm')} Emergency</h3></div><div style="padding:16px;">${icon('shield', 'icon-sm')} UWA / emergency coordination: replace placeholder with live operations desk numbers before production.<br><button type="button" class="small-btn" style="margin-top:10px;" onclick="navigateToAIWithPrompt(${JSON.stringify('Trail injury before medics: who gets called first on a Bwindi trek (order of escalation).')});">${icon('target', 'icon-sm')} Tour help: casualty chain</button><br><button class="small-btn" style="margin-top:10px;" onclick="submitContentHelpfulness('info', '', 'Emergency Contacts')">${icon('target', 'icon-sm')} Helpful?</button></div></div>`;
}

function renderAIChatContent() {
    return `<div class="section-card">
        <div class="section-header"><h3>${icon('target', 'icon-sm')} Tour help</h3></div>
        <p id="aiPrefillBanner" class="ai-prefill-banner" aria-live="polite">Animals, Culture, or Info may drop starter text here. Always edit before sending.</p>
        <div id="aiChatMessages" style="padding:16px; max-height: 50vh; overflow-y: auto;">
            <div class="rec-card">
                <div class="rec-info">
                    <div class="rec-title">How this works</div>
                    <div class="rec-reason">Draft a question about wildlife, safety, culture, routes, or weather. Replies follow simple park-reference rules. Not a substitute for your guide or signposted rules.</div>
                </div>
            </div>
        </div>
        <div style="padding:16px; border-top: 1px solid #E8EDDF; display:flex; gap:10px;">
            <input id="aiChatInput" class="auth-input" style="height:44px; flex:1;" placeholder="Your question (edit any pre-filled draft)..." />
            <button type="button" class="small-btn" style="margin:0;" title="Speak your question (browser Speech Recognition)" onclick="startTourHelpVoiceCapture()">${icon('target', 'icon-sm')} Mic</button>
            <button class="login-btn" style="margin:0; white-space:nowrap;" onclick="sendAIChatMessage()">Send</button>
        </div>
    </div>`;
}

async function renderGuideDashboard() {
    const guideManager = getGuideOpsManager();
    const settled = await Promise.allSettled([
        guideManager.getGuideDashboard(),
        Content.getAnimals()
    ]);
    settled.forEach((r, i) => {
        if (r.status === 'rejected') {
            console.warn(`[Guide dashboard] section ${i} failed:`, r.reason);
        }
    });
    const dashboard = settled[0].status === 'fulfilled' && settled[0].value
        ? settled[0].value
        : { today: [], stats: { totalTours: 0, totalGuests: 0, averageRating: 0 }, activeShift: false };
    const animals = settled[1].status === 'fulfilled' && Array.isArray(settled[1].value) ? settled[1].value : [];
    const guideItems = (dashboard.today || []).slice(0, 3).map((t) => ({
        title: t.route_name || 'Gorilla Trek',
        match: `${new Date(t.scheduled_start).toLocaleTimeString()}`,
        reason: `Guests: ${t.current_participants || 0} • Tap Guide tab actions to start this tour`
    }));
    if (!guideItems.length) {
        guideItems.push({
            title: 'No tours scheduled',
            match: 'Today',
            reason: 'Your next tours will appear here once assigned.'
        });
    }
    const todaysTour = (dashboard.today || [])[0];
    const tourDetails = todaysTour?.tour_session_id ? await API.getTourById(todaysTour.tour_session_id) : null;
    const participants = Array.isArray(tourDetails?.participants) ? tourDetails.participants : [];
    return `<div class="guide-dashboard">${renderDashboardShell({
        primaryTitle: "Today's Tours",
        primaryIcon: 'clock',
        primaryItems: guideItems,
        quote: '"Great guiding turns every trek into a story."',
        seasonalTitle: `${icon('target', 'icon-sm')} Live Guide Status`,
        seasonalItems: [
            `Total tours: ${dashboard.stats.totalTours}`,
            `Guests served: ${dashboard.stats.totalGuests}`,
            `Average rating: ${dashboard.stats.averageRating}`,
            `Shift: ${dashboard.activeShift ? 'On duty' : 'Off duty'}`
        ],
        seasonalActionLabel: dashboard.activeShift ? 'Clock Out' : 'Clock In',
        animalCount: animals.length
    })}<div class="section-card"><div class="section-header"><h3>${icon('clock', 'icon-sm')} Schedule Controls</h3></div><div class="seasonal-list">${(dashboard.today || []).length ? dashboard.today.map((t) => `<div class="seasonal-item"><strong>${escapeHtml(t.route_name || 'Tour Route')}</strong> - ${new Date(t.scheduled_start).toLocaleTimeString()} (${t.confirmed_guests || t.group_size || 0} guests) <button class="small-btn" onclick="startTour('${t.tour_session_id}')">Start</button></div>`).join('') : '<div class="seasonal-item">No tours today.</div>'}</div></div><div class="section-card"><div class="section-header"><h3>${icon('users', 'icon-sm')} Live Participants</h3></div><div class="seasonal-list">${participants.length ? participants.map((p) => `<div class="seasonal-item">${escapeHtml(p.first_name || p.username || 'Tourist')} ${escapeHtml(p.last_name || '')} - ${escapeHtml(p.pickup_location || 'In-session')}</div>`).join('') : '<div class="seasonal-item">No participants assigned yet.</div>'}</div></div><div class="section-card"><div class="section-header"><h3>${icon('bell', 'icon-sm')} Guide-to-guide messages</h3></div><p class="animals-page-blurb">Operational notes to peers (DB migration 011).</p><div class="info-chip-row" style="flex-wrap:wrap;gap:8px;"><select id="guideMsgPeerSelect" class="map-destination" style="flex:1;min-width:180px;"><option value="">Select peer…</option></select></div><div id="guideMsgThread" class="seasonal-list" style="max-height:200px;overflow:auto;margin-top:8px;"><div class="seasonal-item">Loading…</div></div><textarea id="guideMsgBody" class="map-destination" style="margin-top:8px;min-height:72px;width:100%;box-sizing:border-box;" placeholder="Operational note"></textarea><div class="info-chip-row" style="margin-top:8px;"><button type="button" class="login-btn" onclick="sendGuideDeskNote()">${icon('target', 'icon-sm')} Send</button><button type="button" class="small-btn ghost-btn" onclick="refreshGuideDeskInbox()">${icon('grid', 'icon-sm')} Refresh</button></div></div><div class="shift-controls"><button class="login-btn" onclick="clockInOut()">${dashboard.activeShift ? 'Clock Out' : 'Clock In'}</button><button class="small-btn" onclick="addTourNotePrompt()">Add Tour Note</button></div><div id="activeTourPanel" style="${guideManager.activeTour ? 'display:block' : 'display:none'}"><div id="tourTimerDisplay" class="tour-timer">00:00:00</div><button onclick="quickSighting()">Log Sighting</button><button onclick="endActiveTour()">End Tour</button></div></div>`;}

async function renderITManagerDashboard() {
    // Resilient fan-out: if any single endpoint fails, fall back to a safe
    // default so the dashboard still renders for the IT manager.
    const settled = await Promise.allSettled([
        ITAPI.getSystemMetrics(),
        ITAPI.getUserList(),
        ITAPI.getInteractiveAnalytics(),
        ITAPI.getLiveOperations(),
        ITAPI.getFeedbackInsights(30),
        ITAPI.getRareAlerts(6)
    ]);
    settled.forEach((r, i) => {
        if (r.status === 'rejected') {
            console.warn(`[IT dashboard] section ${i} failed:`, r.reason);
        }
    });
    const valueOr = (i, fallback) => (settled[i].status === 'fulfilled' && settled[i].value != null ? settled[i].value : fallback);
    const metrics = valueOr(0, {});
    const users = valueOr(1, []);
    const interactive = valueOr(2, {
        visitorFlow: [],
        topLocations: [],
        congestionPredictions: [],
        congestionRecommendations: [],
        popularContent: [],
        satisfaction: {},
        demographics: {}
    });
    const liveOps = valueOr(3, { peers: [], intranetStatus: {}, syncStatus: {} });
    const feedbackInsights = valueOr(4, {
        summary: { total_feedback: 0, avg_rating: 0, bug_reports: 0, feature_requests: 0, responded_count: 0 },
        recent: []
    });
    const rareAlerts = valueOr(5, []);
    const managerQueue = await ITAPI.getManagerFeedbackQueue({ days: 30, limit: 12 });
    const flowBars = (interactive.visitorFlow || []).slice(-7).map((point) => {
        const value = Number(point.visitor_count || 0);
        const width = Math.min(100, value === 0 ? 6 : value);
        return `<div class="analytics-row"><span>${new Date(point.time_period).toLocaleDateString()}</span><div class="analytics-bar"><div style="width:${width}%;"></div></div><strong>${value}</strong></div>`;
    }).join('') || '<div class="empty-state">No visitor flow data yet.</div>';

    const popularRows = (interactive.popularContent || []).slice(0, 6).map((item) =>
        `<div class="analytics-row"><span>${escapeHtml(item.name || 'Item')}</span><span>${escapeHtml(item.type || 'content')}</span><strong>${item.view_count || 0}</strong></div>`
    ).join('') || '<div class="empty-state">No popular content data yet.</div>';
    const demographicRows = (interactive.demographics?.user_types || []).map((row) =>
        `<div class="analytics-row"><span>${escapeHtml(row.user_type || 'user')}</span><div class="analytics-bar"><div style="width:${Math.min(100, Number(row.count || 0) * 10)}%;"></div></div><strong>${row.count || 0}</strong></div>`
    ).join('') || '<div class="empty-state">No demographics data yet.</div>';
    const rareAlertsHtml = `<div class="section-card"><div class="section-header"><h3>${icon('bell', 'icon-sm')} Rare Sighting Alerts</h3></div><div class="seasonal-list">${(rareAlerts || []).length ? rareAlerts.map((a) => `<div class="seasonal-item rare-alert-item"><strong>${escapeHtml((a.risk_level || 'high').toUpperCase())}</strong> • ${escapeHtml(a.animal_name || 'Wildlife')} @ ${escapeHtml(a.location_name || 'Unknown')} (${a.number_observed || 0}) ${a.acknowledged ? '<span style="color:#2E7D32;">(Acknowledged)</span>' : `<button class=\"small-btn\" onclick=\"ackRareAlertPrompt('${a.alert_id}')\">Acknowledge</button>`}<br><span style="color:#6B705C;">${escapeHtml(a.reason || '')}</span></div>`).join('') : '<div class="seasonal-item">• No rare alerts in recent reports.</div>'}</div></div>`;
    const managerFeedbackControlHtml = `<div class="section-card"><div class="section-header"><h3>${icon('note', 'icon-sm')} Feedback Control Queue</h3></div><div class="seasonal-list">${(managerQueue || []).length ? managerQueue.map((item) => `<div class="seasonal-item"><strong>${escapeHtml(item.category || 'general')}</strong> • ${'★'.repeat(Number(item.rating || 0))} • <em>${escapeHtml(item.improvement_status || 'new')}</em><br>${escapeHtml(item.comment || 'No comment')}<br>${item.response_text ? `<span style=\"color:#2E7D32;\">Response sent</span>` : `<button class=\"small-btn\" onclick=\"respondToFeedbackPrompt('${item.feedback_id}')\">Respond</button>`} <button class=\"small-btn\" onclick=\"updateFeedbackStatusPrompt('${item.feedback_id}')\">Update Status</button></div>`).join('') : '<div class="seasonal-item">• No feedback items in queue.</div>'}</div></div>`;
    const itOpsShortcutsHtml = `<div class="section-card"><div class="section-header"><h3>${icon('chart', 'icon-sm')} Analytics & backups</h3></div><p class="animals-page-blurb">Quick checks for anomalies, training jobs, bundled reports, and backup index.</p><div class="info-chip-row" style="flex-wrap:wrap;gap:8px;"><button type="button" class="small-btn" onclick="itOpsPeekAnalyticsAnomalies()">${icon('target', 'icon-sm')} Anomalies</button><button type="button" class="small-btn" onclick="itOpsQueueModelRetrain()">${icon('database', 'icon-sm')} Queue retrain</button><button type="button" class="small-btn" onclick="itOpsRunReportBuild()">${icon('note', 'icon-sm')} Build report</button><button type="button" class="small-btn" onclick="itOpsPeekBackupsList()">${icon('download', 'icon-sm')} Backups</button></div></div>`;
    const animals = await Content.getAnimals();
    const itKpis = [
        { label: 'Active Users', value: metrics.activeUsers || 0, hint: 'Current sessions' },
        { label: 'Pending Sync', value: metrics.syncQueueSize || 0, hint: 'Waiting uploads' },
        { label: 'Sightings', value: metrics.totalSightings || 0, hint: 'Recorded entries' },
        { label: 'Avg Rating', value: Number(interactive.satisfaction?.overall || 0).toFixed(1), hint: '/ 5' }
    ];
    const liveUsersHtml = renderLiveUserRows(liveOps.peers || []);
    return `<div class="it-dashboard">${renderKpiStrip(itKpis)}${renderDashboardShell({
        primaryTitle: 'System Recommendations',
        primaryIcon: 'database',
        primaryItems: [
            {
                title: 'Active Users',
                match: `${metrics.activeUsers || 0} online`,
                reason: 'Current authenticated sessions in the system.',
                iconName: 'users',
                goIcon: 'users',
                avatarType: 'icon',
                metricColor: 'users'
            },
            {
                title: 'Pending Sync',
                match: `${metrics.syncQueueSize || 0} queued`,
                reason: 'Offline records waiting for server reconciliation.',
                iconName: 'database',
                goIcon: 'download',
                avatarType: 'icon',
                metricColor: 'sync'
            },
            {
                title: 'Visitor Satisfaction',
                match: `${Number(interactive.satisfaction?.overall || 0).toFixed(1)} / 5`,
                reason: `${interactive.satisfaction?.satisfaction_rate || 0}% positive ratings`,
                iconName: 'smile',
                goIcon: 'chart',
                avatarType: 'icon',
                metricColor: 'satisfaction'
            }
        ],
        quote: '"Reliable systems make better field decisions."',
        seasonalTitle: `${icon('chart', 'icon-sm')} Admin Snapshot`,
        seasonalItems: [
            `Total sightings: ${metrics.totalSightings || 0}`,
            `Total staff: ${metrics.totalStaff || 0}`,
            `Guides on duty: ${metrics.guidesOnDuty || 0}`,
            `Inventory items: ${metrics.inventoryItems || 0}`
        ],
        seasonalActionLabel: 'View Suggestions',
        animalCount: animals.length
    })}<div class="section-card"><div class="section-header"><h3>${icon('users', 'icon-sm')} Current Users (Realtime)</h3><span id="adminLiveUsersStamp" class="status-badge neutral">Updated just now • ${(liveOps.peers || []).length} active now / ${Number(metrics.activeUsers || 0)} total</span></div><div id="adminLiveUsersList">${liveUsersHtml}</div></div><div class="dashboard-feature-grid"><div class="section-card"><div class="section-header"><h3>${icon('chart', 'icon-sm')} Visitor Flow (7 days)</h3></div><div class="analytics-list">${flowBars}</div></div><div class="section-card"><div class="section-header"><h3>${icon('target', 'icon-sm')} Popular Content</h3></div><div class="analytics-list">${popularRows}</div></div></div><div class="dashboard-feature-grid"><div class="section-card"><div class="section-header"><h3>${icon('users', 'icon-sm')} User Type Demographics</h3></div><div class="analytics-list">${demographicRows}</div></div><div class="section-card"><div class="section-header"><h3>${icon('map', 'icon-sm')} Congestion Guidance</h3></div><div class="seasonal-list">${(interactive.congestionRecommendations || []).map((r) => `<div class="seasonal-item">• ${escapeHtml(r)}</div>`).join('') || '<div class="seasonal-item">• No congestion recommendations available</div>'}</div></div></div><div class="dashboard-feature-grid"><div class="section-card"><div class="section-header"><h3>${icon('building', 'icon-sm')} Intranet Connectivity</h3></div><div class="analytics-list"><div class="analytics-row"><span>Intranet</span><div class="analytics-bar"><div style="width:${liveOps.intranetStatus?.isIntranet ? 100 : 35}%;"></div></div><strong>${liveOps.intranetStatus?.isIntranet ? 'Connected' : 'External'}</strong></div><div class="analytics-row"><span>Device IP</span><span></span><strong>${escapeHtml(liveOps.intranetStatus?.ip || 'Unknown')}</strong></div><div class="analytics-row"><span>Pending Sync</span><span></span><strong>${liveOps.syncStatus?.pending || liveOps.syncStatus?.pending_items || 0}</strong></div></div></div><div class="section-card"><div class="section-header"><h3>${icon('user', 'icon-sm')} Live Peers / Guests</h3></div><div class="seasonal-list">${(liveOps.peers || []).length ? liveOps.peers.slice(0, 8).map((p) => `<div class="seasonal-item">• ${escapeHtml(p.name || 'Peer')} (${escapeHtml(p.type || 'user')})${p.location ? ` @ ${Number(p.location.lat).toFixed(4)}, ${Number(p.location.lng).toFixed(4)}` : ''}</div>`).join('') : '<div class="seasonal-item">• No live peers detected in last 5 minutes.</div>'}</div></div></div><div class="section-card"><div class="section-header"><h3>${icon('note', 'icon-sm')} Feedback & Improvements (30 days)</h3></div><div class="analytics-list"><div class="analytics-row"><span>Total Feedback</span><span></span><strong>${feedbackInsights.summary?.total_feedback || 0}</strong></div><div class="analytics-row"><span>Average Rating</span><span></span><strong>${feedbackInsights.summary?.avg_rating || 0}</strong></div><div class="analytics-row"><span>Bug Reports</span><span></span><strong>${feedbackInsights.summary?.bug_reports || 0}</strong></div><div class="analytics-row"><span>Feature Requests</span><span></span><strong>${feedbackInsights.summary?.feature_requests || 0}</strong></div><div class="analytics-row"><span>Surveys</span><span></span><strong>${feedbackInsights.summary?.survey_count || 0}</strong></div><div class="analytics-row"><span>Avg NPS</span><span></span><strong>${feedbackInsights.summary?.avg_nps || 0}</strong></div><div class="analytics-row"><span>Responded</span><span></span><strong>${feedbackInsights.summary?.responded_count || 0}</strong></div></div><div class="seasonal-list">${(feedbackInsights.recent || []).slice(0, 5).map((item) => `<div class="seasonal-item">• ${escapeHtml(item.category)} - ${escapeHtml(item.comment || 'No comment')} [${escapeHtml(item.improvement_status || 'new')}] ${item.response_text ? '<span style="color:#2E7D32;">(Responded)</span>' : `<button class=\"small-btn\" onclick=\"respondToFeedbackPrompt('${item.feedback_id}')\">Respond</button>`} <button class=\"small-btn\" onclick=\"updateFeedbackStatusPrompt('${item.feedback_id}')\">Status</button></div>`).join('') || '<div class="seasonal-item">• No recent feedback</div>'}</div></div>${managerFeedbackControlHtml}${itOpsShortcutsHtml}${rareAlertsHtml}<div class="admin-actions"><button class="admin-action-btn" onclick="handleMFASetup()">${icon('shield', 'icon-sm')} Configure MFA</button><button class="admin-action-btn" onclick="clearAllCache()">Clear Cache</button><button class="admin-action-btn" onclick="exportData()">Export Data</button><button class="admin-action-btn danger" onclick="resetApp()">Reset App</button></div></div>`;}

// =====================================================
// INTRANET DASHBOARD (HR, Announcements, Inventory)
// =====================================================
async function renderIntranetDashboard() {
    const settled = await Promise.allSettled([
        Intranet.getIntranetStatus(),
        Intranet.getPeers(),
        API.request('/geofence/events?limit=12'),
        Intranet.getEmployees()
    ]);
    const valueOr = (i, fallback) => (settled[i].status === 'fulfilled' && settled[i].value != null ? settled[i].value : fallback);
    const intranetStatus = valueOr(0, { isIntranet: false, ip: null });
    const peers = valueOr(1, []);
    const eventsResponse = valueOr(2, {});
    const employees = valueOr(3, []);
    const geofenceEvents = eventsResponse?.events || [];
    const insideCount = peers.filter((p) => p.location && Geofence?.isInsidePark?.(p.location.lat, p.location.lng)).length;
    const outsideCount = peers.filter((p) => p.location && !Geofence?.isInsidePark?.(p.location.lat, p.location.lng)).length;
    const unknownCount = Math.max(0, peers.length - insideCount - outsideCount);
    const activeEmployees = employees.filter((e) => String(e.status || '').toLowerCase() === 'active').length;

    return `<div class="intranet-dashboard">
        ${renderDashboardShell({
            primaryTitle: 'Access Governance',
            primaryIcon: 'shield',
            primaryItems: [
                {
                    title: 'Boundary Rule',
                    match: 'Inside park required',
                    reason: 'Users are expected to operate inside approved park boundaries for protected actions.'
                },
                {
                    title: 'Network Rule',
                    match: intranetStatus?.isIntranet ? 'Intranet linked' : 'External network',
                    reason: intranetStatus?.isIntranet
                        ? `Connected via trusted network (${intranetStatus?.ip || 'IP unavailable'}).`
                        : 'Currently outside the trusted intranet network; restricted workflows should be limited until connectivity is restored.'
                },
                {
                    title: 'Simulation Controls',
                    match: 'Simulation available',
                    reason: 'Use the Park Access Status simulation controls above to verify inside/outside and online/offline behavior safely.'
                }
            ],
            quote: '"Conservation systems are strongest when access is location-aware."',
            seasonalTitle: `${icon('users', 'icon-sm')} Team Snapshot`,
            seasonalItems: [
                `Active employees: ${activeEmployees}`,
                `Live peers tracked: ${peers.length}`,
                `Inside boundary: ${insideCount}`,
                `Outside/unknown: ${outsideCount + unknownCount}`
            ],
            seasonalActionLabel: 'Monitor Access',
            animalCount: activeEmployees
        })}
        <div class="dashboard-feature-grid">
            <div class="section-card">
                <div class="section-header"><h3>${icon('building', 'icon-sm')} Network & Boundary Compliance</h3></div>
                <div class="analytics-list">
                    <div class="analytics-row"><span>Intranet Link</span><div class="analytics-bar"><div style="width:${intranetStatus?.isIntranet ? 100 : 35}%;"></div></div><strong>${intranetStatus?.isIntranet ? 'Connected' : 'External'}</strong></div>
                    <div class="analytics-row"><span>Device IP</span><span></span><strong>${escapeHtml(intranetStatus?.ip || 'Unknown')}</strong></div>
                    <div class="analytics-row"><span>Peers inside boundary</span><span></span><strong>${insideCount}</strong></div>
                    <div class="analytics-row"><span>Peers outside boundary</span><span></span><strong>${outsideCount}</strong></div>
                </div>
            </div>
            <div class="section-card">
                <div class="section-header"><h3>${icon('user', 'icon-sm')} Live Access Presence</h3></div>
                <div class="seasonal-list">${(peers || []).length ? peers.slice(0, 12).map((p) => {
                    const isInside = p.location ? !!Geofence?.isInsidePark?.(p.location.lat, p.location.lng) : null;
                    const accessLabel = isInside === null ? 'Unknown location' : (isInside ? 'Inside boundary' : 'Outside boundary');
                    return `<div class="seasonal-item">• ${escapeHtml(p.name || 'Peer')} (${escapeHtml(p.type || 'user')}) - ${accessLabel}${p.location ? ` @ ${Number(p.location.lat).toFixed(4)}, ${Number(p.location.lng).toFixed(4)}` : ''}</div>`;
                }).join('') : '<div class="seasonal-item">• No live peers detected in the latest window.</div>'}</div>
            </div>
        </div>
        <div class="section-card">
            <div class="section-header"><h3>${icon('map', 'icon-sm')} Recent Boundary Events</h3></div>
            <div class="seasonal-list">${(geofenceEvents || []).length ? geofenceEvents.slice(0, 10).map((event) => `
                <div class="seasonal-item">
                    • ${String(event.event_type || '').toUpperCase()} at ${new Date(event.event_time || Date.now()).toLocaleString()}
                    ${Number.isFinite(Number(event.latitude)) && Number.isFinite(Number(event.longitude))
                        ? `<br><small>${Number(event.latitude).toFixed(5)}, ${Number(event.longitude).toFixed(5)}</small>`
                        : ''}
                </div>`).join('') : '<div class="seasonal-item">• No recent boundary entry/exit events.</div>'}
            </div>
        </div>
        <div class="section-card">
            <div class="section-header"><h3>${icon('target', 'icon-sm')} Access Validation Flow</h3></div>
            <div class="seasonal-list">
                <div class="seasonal-item">1) Keep simulation on <strong>Auto</strong> to show live field mode.</div>
                <div class="seasonal-item">2) Force <strong>Outside</strong> to verify boundary restriction messaging.</div>
                <div class="seasonal-item">3) Force <strong>Offline</strong> to verify network restriction messaging.</div>
                <div class="seasonal-item">4) Reset simulation to restore normal operations.</div>
            </div>
        </div>
        <div class="admin-actions">
            <button class="admin-action-btn" onclick="runInteractiveMapSeedFromUI()">${icon('database', 'icon-sm')} Seed Map Demo Data</button>
        </div>
    </div>`;
}

// Modal handlers for Intranet
window.showAddAnnouncementModal = async function() {
    const title = await showPromptDialog('Announcement Title');
    const content = await showPromptDialog('Announcement Content');
    const priority = await showPromptDialog('Priority (high/medium/low)', 'medium');
    if (title && content) {
        await Intranet.addAnnouncement(title, content, priority);
        renderView('intranet');
    }
};

window.deleteAnnouncement = async function(id) {
    if (await showConfirmDialog('Delete this announcement?')) {
        await Intranet.deleteAnnouncement(id);
        renderView('intranet');
    }
};

window.showAddInventoryModal = async function() {
    const name = await showPromptDialog('Item Name');
    const quantity = await showPromptDialog('Quantity');
    const category = await showPromptDialog('Category (Equipment/Medical/Communication)');
    const parsedQuantity = Number.parseInt(quantity, 10);
    if (name && Number.isFinite(parsedQuantity)) {
        await Intranet.addInventoryItem(name, parsedQuantity, category);
        renderView('intranet');
        return;
    }
    showToast('Enter a valid quantity.', 'warning');
};

window.updateInventoryQuantity = async function(id) {
    const newQty = await showPromptDialog('Enter new quantity');
    if (newQty !== null) {
        const parsedQuantity = Number.parseInt(newQty, 10);
        if (!Number.isFinite(parsedQuantity)) {
            showToast('Quantity must be a number.', 'warning');
            return;
        }
        await Intranet.updateInventoryItem(id, { quantity: parsedQuantity });
        renderView('intranet');
    }
};

window.showAddEmployeeModal = async function() {
    const name = await showPromptDialog('Employee Name');
    const role = await showPromptDialog('Role (e.g., Senior Guide, Ranger)');
    const department = await showPromptDialog('Department');
    if (name && role) {
        await Intranet.addEmployee({ name, role, department });
        renderView('intranet');
    }
};

window.toggleEmployeeStatus = async function(id, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    await Intranet.updateEmployeeStatus(id, newStatus);
    renderView('intranet');
};

window.runInteractiveMapSeedFromUI = async function () {
    if (!(await showConfirmDialog('Run interactive map seed now? This refreshes map and tour data.'))) return;
    showToast('Running interactive map seed...', 'info');
    const result = await Intranet.seedInteractiveMapData();
    if (!result?.success) {
        showToast(`Seed failed: ${result?.error || 'Unknown error'}`, 'danger');
        return;
    }
    showToast('Interactive map seed completed successfully.', 'success');
    if (window.currentView === 'intranet' || window.currentView === 'map') {
        await renderView(window.currentView, { updateHash: false, suppressAccessToast: true });
    }
};

window.sendAIChatMessage = async function() {
    const input = document.getElementById('aiChatInput');
    const messages = document.getElementById('aiChatMessages');
    if (!input || !messages) return;

    const question = input.value.trim();
    if (!question) return;

    messages.innerHTML += `<div class="rec-card"><div class="rec-info"><div class="rec-title">You</div><div class="rec-reason">${escapeHtml(question)}</div></div></div>`;
    input.value = '';

    const result = await AI.askQuestion(question);
    const answer = result?.answer || 'No response available.';
    messages.innerHTML += `<div class="rec-card"><div class="rec-info"><div class="rec-title">Park reference reply</div><div class="rec-reason">${escapeHtml(answer)}</div></div></div>`;
    messages.scrollTop = messages.scrollHeight;
};

window.toggleSpeciesHeatmapLayer = async function () {
    const cur = localStorage.getItem('sigts_map_species_heat') === '1';
    localStorage.setItem('sigts_map_species_heat', cur ? '0' : '1');
    showToast(cur ? 'Species heatmap off.' : 'Species heatmap on (heatmap requires sign-in).', cur ? 'info' : 'success');
    if (window.currentView === 'map' && typeof refreshLiveMapData === 'function') {
        await refreshLiveMapData();
    }
};

window.startTourHelpVoiceCapture = function () {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const input = document.getElementById('aiChatInput');
    if (!SR) {
        showToast('Speech recognition is not supported in this browser.', 'warning');
        return;
    }
    if (window.__sigtsTourHelpRecListening) return;
    const rec = new SR();
    const lang = AppState?.userPreferences?.language;
    rec.lang = lang === 'fr' ? 'fr-FR' : lang === 'sw' ? 'sw-TZ' : lang === 'ruk' ? 'rw-RW' : 'en-US';
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
        window.__sigtsTourHelpRecListening = false;
        const t = e.results[0]?.[0]?.transcript?.trim();
        if (t && input) input.value = `${(input.value || '').trim()}${input.value ? ' ' : ''}${t}`;
        showToast(t ? 'Speech added to the Tour help box.' : 'No speech captured.', t ? 'success' : 'warning');
    };
    rec.onerror = () => {
        window.__sigtsTourHelpRecListening = false;
        showToast('Mic capture failed or was denied.', 'warning');
    };
    rec.onend = () => {
        window.__sigtsTourHelpRecListening = false;
    };
    window.__sigtsTourHelpRecListening = true;
    try {
        rec.start();
    } catch (_) {
        window.__sigtsTourHelpRecListening = false;
        showToast('Could not start speech recognition.', 'warning');
    }
};

window.refreshGuideDeskInbox = async function () {
    const el = document.getElementById('guideMsgThread');
    if (!el) return;
    const raw = await API.request('/guides/messages?box=inbox&limit=60');
    if (raw?.error) {
        el.innerHTML = `<div class="seasonal-item">${escapeHtml(raw.error)}</div>`;
        return;
    }
    const rows = Array.isArray(raw?.messages) ? raw.messages : [];
    if (!rows.length) {
        el.innerHTML = '<div class="seasonal-item">No messages in inbox.</div>';
        return;
    }
    el.innerHTML = rows
        .map((m) => {
            const when = m.created_at ? new Date(m.created_at).toLocaleString() : '';
            const who = escapeHtml(m.peer_username || m.peer_id || 'Peer');
            return `<div class="seasonal-item"><strong>${who}</strong> <small>${escapeHtml(when)}</small><br>${escapeHtml(m.body || '')}</div>`;
        })
        .join('');
};

window.sendGuideDeskNote = async function () {
    const sel = document.getElementById('guideMsgPeerSelect');
    const bodyEl = document.getElementById('guideMsgBody');
    const toId = sel?.value;
    const body = (bodyEl?.value || '').trim();
    if (!toId) {
        showToast('Select a peer.', 'warning');
        return;
    }
    if (!body) {
        showToast('Message is empty.', 'warning');
        return;
    }
    const res = await API.sendGuideMessage(toId, body);
    if (res?.error || (res?.status && res.status >= 400)) {
        showToast(res.error || 'Send failed', 'danger');
        return;
    }
    if (bodyEl) bodyEl.value = '';
    showToast('Message sent.', 'success');
    await window.refreshGuideDeskInbox();
};

window.initGuideMessagingPanel = async function () {
    const sel = document.getElementById('guideMsgPeerSelect');
    if (!sel) return;
    const prev = sel.value;
    const rawPeers = await API.request('/guides/messages/peers');
    if (rawPeers?.error) {
        sel.innerHTML = `<option value="">${escapeHtml(rawPeers.error)}</option>`;
        await window.refreshGuideDeskInbox();
        return;
    }
    const peers = Array.isArray(rawPeers?.peers) ? rawPeers.peers : [];
    sel.innerHTML =
        '<option value="">Select peer…</option>' +
        peers
            .map((p) => {
                const id = escapeHtml(p.user_id);
                const lab = escapeHtml(p.display_name || p.username || id);
                const role = escapeHtml(p.user_type || '');
                return `<option value="${id}">${lab} (${role})</option>`;
            })
            .join('');
    if (prev && peers.some((p) => String(p.user_id) === prev)) sel.value = prev;
    await window.refreshGuideDeskInbox();
};

window.itOpsPeekAnalyticsAnomalies = async function () {
    const d = await API.getAnalyticsAnomalies(2.5);
    if (d?.status >= 400) {
        showToast(d?.error || 'Anomalies request failed.', 'danger');
        return;
    }
    const n = (d?.anomalies || []).length;
    showToast(`${n} anomaly row(s); details in console (F12).`, n ? 'info' : 'success');
    console.info('[SIGTS] analytics anomalies', d);
};

window.itOpsQueueModelRetrain = async function () {
    const r = await API.queuePredictiveTrainingJob('congestion_v1');
    if (r?.error || r?.status >= 400) showToast(r?.error || 'Queue retrain failed', 'danger');
    else showToast(r?.job?.job_id ? `Job ${r.job.job_id} queued.` : 'Retrain queued.', 'success');
};

window.itOpsRunReportBuild = async function () {
    const r = await API.buildAnalyticsReport(['visitor_flow', 'satisfaction', 'sightings_trend', 'popular_content']);
    if (r?.status >= 400) showToast(r?.error || 'Report build failed', 'danger');
    else {
        const keys = r?.sections ? Object.keys(r.sections) : [];
        const errs = r?.section_errors ? Object.keys(r.section_errors) : [];
        showToast(`Report built: ${keys.length} section(s); ${errs.length} error(s). See console.`, errs.length ? 'warning' : 'success');
        console.info('[SIGTS] report build', r);
    }
};

window.itOpsPeekBackupsList = async function () {
    const r = await API.request('/admin/backup/list');
    if (r?.status >= 400 || r?.error) {
        showToast(r?.error || 'Backup list failed', 'danger');
        return;
    }
    const n = (r?.backups || []).length;
    showToast(`${n} backup record(s); see console for list.`, 'info');
    console.info('[SIGTS] backups', r?.backups);
};

window.saveLanguagePreference = async function () {
    const language = document.getElementById('profileLanguage')?.value || 'en';
    const result = await API.updateUserProfile({ language_pref: language });
    if (result?.error) {
        alert(`Failed to save language: ${result.error}`);
        return;
    }
    AppState.userPreferences.language = language;
    localStorage.setItem('language', language);
    alert('Language preference saved.');
};

window.submitUserFeedback = async function () {
    const rating = Number(document.getElementById('feedbackRating')?.value || 5);
    const category = document.getElementById('feedbackCategory')?.value || 'general';
    const comment = (document.getElementById('feedbackComment')?.value || '').trim();
    const tourSessionId = (document.getElementById('feedbackTourSession')?.value || '').trim();
    const npsRaw = (document.getElementById('feedbackNPS')?.value || '').trim();
    const screenshotUrl = (document.getElementById('feedbackScreenshot')?.value || '').trim();
    const payload = { rating, category, comment };
    if (tourSessionId) payload.tour_session_id = tourSessionId;
    if (npsRaw !== '' && Number.isFinite(Number(npsRaw))) payload.nps_score = Number(npsRaw);
    if (screenshotUrl) payload.screenshot_url = screenshotUrl;
    const result = await API.submitFeedback(payload);

    if (!result) {
        // offline fallback to keep feedback loop interactive
        const feedback = JSON.parse(localStorage.getItem('feedback') || '[]');
        feedback.unshift({
            feedback_id: `local_${Date.now()}`,
            rating,
            category,
            comment,
            created_at: new Date().toISOString()
        });
        localStorage.setItem('feedback', JSON.stringify(feedback));
        alert('Feedback saved locally and will sync when online.');
    } else {
        alert('Thanks! Your feedback was submitted.');
    }
    const commentNode = document.getElementById('feedbackComment');
    if (commentNode) commentNode.value = '';
    await loadRecentFeedback();
};

window.submitTourCompletionFeedback = async function () {
    const tours = await API.getToursForGuide();
    const last = Array.isArray(tours) ? tours[0] : null;
    if (!last?.tour_session_id) {
        showToast('No recent tour session found to rate.', 'warning');
        return;
    }
    const rating = Number(await showPromptDialog('Rate the tour (1-5)', '5'));
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        showToast('Invalid tour rating.', 'warning');
        return;
    }
    const comment = await showPromptDialog('Tour review comment', 'Great route and pacing.');
    const saved = await API.submitFeedback({
        rating,
        category: 'tour',
        comment: comment || 'Tour feedback submitted.',
        tour_session_id: last.tour_session_id
    });
    showToast(saved ? 'Tour rating recorded.' : 'Tour rating queued/offline.', saved ? 'success' : 'info');
    await loadRecentFeedback();
};

window.submitGuidePerformanceFeedback = async function () {
    const guideId = await showPromptDialog('Guide ID to rate (optional if linked from tour)');
    const rating = Number(await showPromptDialog('Guide rating (1-5)', '5'));
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        showToast('Invalid guide rating.', 'warning');
        return;
    }
    const comment = await showPromptDialog('Guide feedback comment', 'Helpful and knowledgeable.');
    const payload = {
        rating,
        category: 'guide',
        comment: comment || 'Guide feedback submitted.'
    };
    if (guideId) payload.tourguide_id = guideId;
    const saved = await API.submitFeedback(payload);
    showToast(saved ? 'Guide rating recorded.' : 'Guide feedback queued/offline.', saved ? 'success' : 'info');
    await loadRecentFeedback();
};

window.submitBugReportPrompt = async function () {
    const issue = await showPromptDialog('Describe the issue you found');
    if (!issue) return;
    const screenshot = await showPromptDialog('Screenshot URL (optional)');
    const saved = await API.submitFeedback({
        rating: 2,
        category: 'bug_report',
        comment: issue,
        screenshot_url: screenshot || null
    });
    showToast(saved ? 'Bug report logged.' : 'Bug report saved offline.', saved ? 'success' : 'info');
    await loadRecentFeedback();
};

window.submitFeatureSuggestionPrompt = async function () {
    const suggestion = await showPromptDialog('Suggest an improvement');
    if (!suggestion) return;
    const saved = await API.submitFeedback({
        rating: 4,
        category: 'feature_suggestion',
        comment: suggestion
    });
    showToast(saved ? 'Feature suggestion logged.' : 'Feature suggestion saved offline.', saved ? 'success' : 'info');
    await loadRecentFeedback();
};

window.submitSatisfactionSurvey = async function () {
    const overall = Number(await showPromptDialog('Overall satisfaction (1-5)', '4'));
    if (!Number.isFinite(overall) || overall < 1 || overall > 5) {
        showToast('Invalid survey score.', 'warning');
        return;
    }
    const useAgain = await showPromptDialog('Would you use SIGTS again? (yes/no)', 'yes');
    const saved = await API.submitFeedback({
        rating: overall,
        category: 'survey',
        comment: `Survey response: reuse=${String(useAgain || 'yes').toLowerCase()}`
    });
    showToast(saved ? 'Survey response recorded.' : 'Survey response saved offline.', saved ? 'success' : 'info');
    await loadRecentFeedback();
};

window.submitNPSFeedback = async function () {
    const nps = Number(await showPromptDialog('NPS score (0-10)', '8'));
    if (!Number.isFinite(nps) || nps < 0 || nps > 10) {
        showToast('NPS must be between 0 and 10.', 'warning');
        return;
    }
    const why = await showPromptDialog('What is the main reason for your score?');
    const saved = await API.submitFeedback({
        rating: nps >= 9 ? 5 : (nps >= 7 ? 4 : 2),
        category: 'nps',
        nps_score: nps,
        comment: why || 'NPS response'
    });
    showToast(saved ? 'NPS response recorded.' : 'NPS response saved offline.', saved ? 'success' : 'info');
    await loadRecentFeedback();
};

window.submitContentHelpfulness = async function (contentType, contentId, contentName) {
    const helpful = confirm(`Was "${contentName}" helpful to you?`);
    const score = helpful ? 5 : 2;
    const payload = {
        rating: helpful ? 5 : 3,
        category: 'helpfulness',
        comment: `Helpfulness feedback for ${contentType}: ${contentName}`,
        source_content_id: contentId,
        source_content_type: contentType,
        helpfulness_rating: score
    };
    const saved = await API.submitFeedback(payload);
    if (saved) alert('Thanks! Content feedback recorded.');
    else alert('Feedback stored offline and will sync later.');
};

window.respondToFeedbackPrompt = async function (feedbackId) {
    if (!Auth.hasRole('it_manager')) {
        showToast('Only IT managers can respond to feedback.', 'warning');
        return;
    }
    const response = prompt('Enter response to this feedback:');
    if (!response) return;
    const saved = await ITAPI.respondToFeedback(feedbackId, response);
    if (saved) {
        alert('Feedback response saved.');
        renderView('it_dashboard');
    } else {
        alert('Failed to save response.');
    }
};

window.updateFeedbackStatusPrompt = async function (feedbackId) {
    if (!Auth.hasRole('it_manager')) {
        showToast('Only IT managers can update improvement status.', 'warning');
        return;
    }
    const status = await showPromptDialog('Status: new | in_review | planned | implemented | dismissed', 'in_review');
    if (!status) return;
    const notes = await showPromptDialog('Improvement notes (optional)');
    const saved = await ITAPI.updateFeedbackStatus(feedbackId, String(status).trim(), notes || '');
    if (!saved) {
        showToast('Failed to update improvement status.', 'danger');
        return;
    }
    showToast(`Feedback marked as ${saved.improvement_status}.`, 'success');
    if (window.currentView === 'it_dashboard') await renderView('it_dashboard', { updateHash: false, suppressAccessToast: true });
};

window.ackRareAlertPrompt = async function (alertId) {
    if (!Auth.hasRole('it_manager')) {
        showToast('Only IT managers can acknowledge admin alerts.', 'warning');
        return;
    }
    const saved = await ITAPI.acknowledgeRareAlert(alertId);
    if (!saved) {
        alert('Failed to acknowledge alert.');
        return;
    }
    alert('Rare alert acknowledged.');
    await refreshRareAlertBadge();
    if (window.currentView === 'it_dashboard') {
        await renderView('it_dashboard');
    }
};

async function loadRecentFeedback() {
    const list = document.getElementById('feedbackList');
    if (!list) return;
    const feedback = await API.getMyFeedback(5);
    if (!feedback.length) {
        list.innerHTML = '<div class="seasonal-item">No feedback submitted yet.</div>';
        return;
    }
    list.innerHTML = feedback.map((item) => {
        const date = new Date(item.created_at || Date.now()).toLocaleDateString();
        const status = item.improvement_status ? ` • ${item.improvement_status}` : '';
        const response = item.response_text ? `<br><small style="color:#2E7D32;">Manager response: ${escapeHtml(item.response_text)}</small>` : '';
        return `<div class="seasonal-item"><strong>${'★'.repeat(Number(item.rating || 0))}</strong> ${escapeHtml(item.category || 'general')}${status} - ${escapeHtml(item.comment || 'No comment')} <span style="color:#6B705C;">(${date})</span>${response}</div>`;
    }).join('');
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================
function showLoading() {
    const app = document.getElementById('app');
    if (app) {
        app.innerHTML = `<div class="loading-container"><div class="spinner"></div><p>Loading SIGTS Platform...</p></div>`;
    }
}

function setAuthFeedback(message, type = 'error') {
    const node = document.querySelector('.auth-merged-pane.active #authFeedback')
        || document.querySelector('.auth-portal-main #authFeedback')
        || document.getElementById('authFeedback');
    if (!node) return;
    if (!message) {
        node.textContent = '';
        node.className = 'auth-feedback';
        node.hidden = true;
        return;
    }
    node.textContent = String(message);
    node.className = `auth-feedback ${type === 'success' ? 'success' : 'error'}`;
    node.hidden = false;
}

function ensureFeedbackRoot() {
    let root = document.getElementById('ui-feedback-root');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'ui-feedback-root';
    root.className = 'ui-feedback-root';
    document.body.appendChild(root);
    return root;
}

function showToast(message, type = 'info') {
    const root = ensureFeedbackRoot();
    const toast = document.createElement('div');
    toast.className = `ui-toast ui-toast-${type}`;
    toast.textContent = String(message || '');
    root.appendChild(toast);
    window.setTimeout(() => toast.classList.add('visible'), 10);
    window.setTimeout(() => {
        toast.classList.remove('visible');
        window.setTimeout(() => toast.remove(), 220);
    }, 2600);
}

function showPromptDialog(message, defaultValue = '') {
    return new Promise((resolve) => {
        const root = ensureFeedbackRoot();
        const overlay = document.createElement('div');
        overlay.className = 'ui-modal-overlay';
        overlay.innerHTML = `
            <div class="ui-modal" role="dialog" aria-modal="true">
                <div class="ui-modal-title">${escapeHtml(message || 'Input required')}</div>
                <input class="ui-modal-input" type="text" value="${escapeHtml(defaultValue || '')}" />
                <div class="ui-modal-actions">
                    <button type="button" class="ui-btn ui-btn-secondary">Cancel</button>
                    <button type="button" class="ui-btn ui-btn-primary">OK</button>
                </div>
            </div>
        `;

        const input = overlay.querySelector('.ui-modal-input');
        const [cancelBtn, okBtn] = overlay.querySelectorAll('button');

        const cleanup = (value) => {
            overlay.remove();
            resolve(value);
        };

        cancelBtn.addEventListener('click', () => cleanup(null));
        okBtn.addEventListener('click', () => cleanup(input?.value ?? ''));
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) cleanup(null);
        });
        input?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') cleanup(input.value);
            if (event.key === 'Escape') cleanup(null);
        });

        root.appendChild(overlay);
        input?.focus();
        input?.select();
    });
}

function showConfirmDialog(message) {
    return new Promise((resolve) => {
        const root = ensureFeedbackRoot();
        const overlay = document.createElement('div');
        overlay.className = 'ui-modal-overlay';
        overlay.innerHTML = `
            <div class="ui-modal" role="dialog" aria-modal="true">
                <div class="ui-modal-title">${escapeHtml(message || 'Please confirm')}</div>
                <div class="ui-modal-actions">
                    <button type="button" class="ui-btn ui-btn-secondary">Cancel</button>
                    <button type="button" class="ui-btn ui-btn-danger">Confirm</button>
                </div>
            </div>
        `;

        const [cancelBtn, confirmBtn] = overlay.querySelectorAll('button');
        const cleanup = (accepted) => {
            overlay.remove();
            resolve(accepted);
        };

        cancelBtn.addEventListener('click', () => cleanup(false));
        confirmBtn.addEventListener('click', () => cleanup(true));
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) cleanup(false);
        });

        root.appendChild(overlay);
        confirmBtn?.focus();
    });
}

window.showToast = showToast;
window.showPromptDialog = showPromptDialog;
window.showConfirmDialog = showConfirmDialog;

async function handleRegistration() {
    setAuthFeedback('');
    const result = await Auth.register({
        fullName: document.getElementById('regFullName')?.value,
        email: document.getElementById('regEmail')?.value,
        username: document.getElementById('regUsername')?.value,
        password: document.getElementById('regPassword')?.value,
        confirmPassword: document.getElementById('regConfirmPassword')?.value,
        userType: document.getElementById('regUserType')?.value || 'tourist'
    });
    const message = result.message || (result.success ? 'Success! Please login.' : result.error);
    showToast(message, result.success ? 'success' : 'danger');
    setAuthFeedback(message, result.success ? 'success' : 'error');
    if (result.success) renderView('login');
}

async function handleLogin() {
    setAuthFeedback('');
    const result = await Auth.login(
        document.getElementById('loginUsername')?.value,
        document.getElementById('loginPassword')?.value,
        document.getElementById('rememberMe')?.checked || false
    );
    if (result.success) {
        navigateTo(getLandingViewForUser(result.user));
        return;
    }
    const message = 'Login failed: ' + result.error;
    showToast(message, 'danger');
    setAuthFeedback(message, 'error');
}

function quickLoginAs(role) {
    const presets = {
        tourist: {
            user_id: 'demo-tourist',
            name: 'Demo Tourist',
            email: 'tourist@demo.local',
            username: 'tourist',
            role: 'tourist',
            userType: 'tourist',
            department: 'Visitor',
            targetView: 'dashboard'
        },
        guide: {
            user_id: 'demo-guide',
            name: 'Demo Guide',
            email: 'guide@demo.local',
            username: 'guide',
            role: 'guide',
            userType: 'guide',
            department: 'Tour Operations',
            targetView: 'guide_dashboard'
        },
        it_manager: {
            user_id: 'demo-admin',
            name: 'IT Manager',
            email: 'admin@demo.local',
            username: 'admin',
            role: 'it_manager',
            userType: 'it_manager',
            department: 'IT',
            targetView: 'it_dashboard'
        }
    };

    const selected = presets[role];
    if (!selected) return;
    const token = `demo.${role}.token`;
    const { targetView, ...user } = selected;

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');

    Auth.token = token;
    Auth.user = user;
    AppState.currentUser = user;
    AppState.authToken = token;
    API.setToken(token);

    showToast(`Quick access: ${formatRoleName(role)}`, 'success');
    navigateTo(targetView);
}

function togglePasswordVisibility(inputId, button) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const shouldShow = input.type === 'password';
    input.type = shouldShow ? 'text' : 'password';
    button?.setAttribute('aria-label', shouldShow ? 'Hide password' : 'Show password');
    button?.classList.toggle('active', shouldShow);
}

async function handleForgotPassword() {
    setAuthFeedback('');
    const email = await showPromptDialog('Enter your account email to receive a password reset link');
    if (!email) return;

    const result = await Auth.requestPasswordReset(email);
    if (result.success) {
        const message = result.message || 'If the email exists, a reset link has been sent.';
        showToast(message, 'success');
        setAuthFeedback(message, 'success');
        return;
    }

    const message = 'Password reset request failed: ' + (result.error || 'Unknown error');
    showToast(message, 'danger');
    setAuthFeedback(message, 'error');
}

async function handleMFASetup() {
    const setup = await Auth.initializeMFA();
    if (!setup.success) {
        showToast('MFA setup failed: ' + (setup.error || 'Unknown error'), 'danger');
        return;
    }

    const preview = setup.secret ? `Secret: ${setup.secret}` : 'Secret generated';
    showToast(`MFA setup initialized. ${preview}`, 'info');

    const code = await showPromptDialog('Enter the 6-digit code from your authenticator app to enable MFA');
    if (!code) return;

    const verify = await Auth.verifyMFASetup(code.trim());
    if (!verify.success) {
        showToast('MFA verification failed: ' + (verify.error || 'Invalid code'), 'danger');
        return;
    }

    showToast(verify.message || 'MFA enabled successfully.', 'success');
}

async function downloadOfflineContent() {
    await Content.downloadOfflineContent();
    showToast('Downloaded!', 'success');
}

function clearAllCache() {
    localStorage.clear();
    location.reload();
}

async function exportData() {
    const [animals, locations, sightings, feedback] = await Promise.all([
        API.getAnimals(),
        API.getLocations(),
        API.getRecentSightings(200),
        API.getMyFeedback(100)
    ]);
    const payload = {
        generated_at: new Date().toISOString(),
        user: Auth.getCurrentUser(),
        data: { animals, locations, sightings, feedback }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sigts-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert('Data exported successfully.');}

async function resetApp() {
    if (await showConfirmDialog('Reset all data?')) {
        localStorage.clear();
        location.reload();
    }
}

async function addSighting() {
    const [animals, locations] = await Promise.all([API.getAnimals(), API.getLocations()]);
    if (!animals.length || !locations.length) {
        alert('No animals or locations available. Run seed data first.');
        return;
    }

    const animalName = prompt(`Animal name (${animals.slice(0, 6).map((a) => a.name).join(', ')})`);
    if (!animalName) return;
    const locationName = prompt(`Location name (${locations.slice(0, 6).map((l) => l.name).join(', ')})`);
    if (!locationName) return;
    const count = Number(prompt('Number observed', '1') || '1');

    const animal = animals.find((a) => String(a.name).toLowerCase().includes(animalName.toLowerCase()));
    const location = locations.find((l) => String(l.name).toLowerCase().includes(locationName.toLowerCase()));

    if (!animal || !location) {
        alert('Could not match animal/location. Please try with listed names.');
        return;
    }

    const result = await API.reportSighting({
        animal_id: animal.animal_id || animal.id,
        location_id: location.location_id || location.id,
        number_observed: Math.max(1, Number.isFinite(count) ? count : 1),
        behavior: 'Observed during field session',
        notes: 'Submitted from quick report'
    });

    if (result?.sighting_id || result?.success) {
        if (result?.rare_alert) {
            alert(`Rare sighting alert: ${result.rare_alert.animal_name || 'Wildlife'} (${String(result.rare_alert.risk_level || 'high').toUpperCase()})`);
        } else {
            alert('Sighting reported successfully.');
        }
        if (window.currentView === 'sightings') renderView('sightings');
    } else {
        alert('Failed to report sighting.');
    }}

async function startTour(tourId) {
    if (!Auth.hasRole('guide')) {
        showToast('Only tour guides can start tours.', 'warning');
        return;
    }
    const m = getGuideOpsManager();
    await m.startTour(tourId);
    document.getElementById('activeTourPanel').style.display = 'block';
    showToast('Tour started!', 'success');
}

async function endActiveTour() {
    if (!Auth.hasRole('guide')) {
        showToast('Only tour guides can end tours.', 'warning');
        return;
    }
    const m = getGuideOpsManager();
    const result = await m.endTour(m.activeTour?.tour_session_id);
    document.getElementById('activeTourPanel').style.display = 'none';
    alert('Tour ended');
    const askFeedback = confirm('Would you like to submit completion feedback now?');
    if (askFeedback) {
        renderView('profile');
    }
}

async function quickSighting() {
    if (!Auth.hasRole('guide')) {
        showToast('Only tour guides can log sightings from this shortcut.', 'warning');
        return;
    }
    const [animals, locations] = await Promise.all([API.getAnimals(), API.getLocations()]);
    const animalText = prompt(`Animal seen? (${animals.slice(0, 5).map((a) => a.name).join(', ')})`);
    if (!animalText) return;
    const count = Number(prompt('How many observed?', '1') || '1');
    const animal = animals.find((a) => String(a.name).toLowerCase().includes(animalText.toLowerCase())) || animals[0];
    const nearest = locations[0];
    if (!animal || !nearest) {
        alert('Missing seeded animal/location data.');
        return;    }
    const manager = getGuideOpsManager();
    const result = await API.reportSighting({
        animal_id: animal.animal_id || animal.id,
        location_id: nearest.location_id || nearest.id,
        number_observed: Math.max(1, Number.isFinite(count) ? count : 1),
        behavior: 'Quick guide report',
        notes: 'Quick sighting from guide dashboard',
        tour_session_id: manager.activeTour?.tour_session_id || null
    });
    if (result?.sighting_id || result?.success) {
        if (result?.rare_alert) {
            alert(`Rare sighting alert sent: ${result.rare_alert.animal_name || 'Wildlife'} (${String(result.rare_alert.risk_level || 'high').toUpperCase()})`);
        } else {
            alert('Sighting recorded!');
        }
    }
    else alert('Sighting submit failed.');
}

window.addSightingCommentPrompt = async function (sightingId) {
    const text = prompt('Add a comment to this sighting:');
    if (!text || !text.trim()) return;
    const saved = await API.addSightingComment(sightingId, text.trim());
    if (!saved) {
        alert('Failed to save comment.');
        return;
    }
    if (window.currentView === 'sightings') {
        await renderView('sightings');
    }
};

async function clockInOut() {
    if (!Auth.hasRole('guide')) {
        showToast('Only tour guides can use shift controls.', 'warning');
        return;
    }
    const m = new TourGuideManager();
    const s = await m.clockIn();
    if (!s.success) await m.clockOut();
    renderView('guide_dashboard');
}

window.addTourNotePrompt = async function () {
    if (!Auth.hasRole('guide')) {
        showToast('Only tour guides can add tour notes.', 'warning');
        return;
    }
    const note = prompt('Add a guide note for current/next tour:');
    if (!note) return;
    const m = getGuideOpsManager();
    if (!m.activeTour?.tour_session_id) {
        const schedule = await API.getToursForGuide();
        const active = (schedule || []).find((t) => t.status === 'ongoing') || (schedule || [])[0];
        if (!active?.tour_session_id) {
            alert('No tour available for notes right now.');
            return;
        }
        m.activeTour = { tour_session_id: active.tour_session_id };
    }
    const saved = await m.addLiveNote(note);
    if (saved.success) alert('Tour note saved.');
    else alert(saved.error || 'Failed to save note.');
};

function renderAuthMergedScreen(activePanel = 'login') {
    const isLogin = activePanel === 'login';
    return `<div class="auth-portal ${isLogin ? 'auth-mode-login' : 'auth-mode-register'}">
        <aside class="auth-portal-side">
            <div class="auth-side-brand">
                <div class="auth-side-logo">${icon('map', 'icon-lg')}</div>
                <div>
                    <div class="auth-side-title">Bwindi SIGTS</div>
                    <div class="auth-side-subtitle">Smart Information Guide Tour System</div>
                </div>
            </div>
            <div class="auth-side-message">
                <span class="auth-side-kicker">Welcome</span>
                <h1>Smart Information Access to<br>Bwindi Impenetrable National Park</h1>
                <p>Navigate trails, discover wildlife insights, and receive real-time guidance for a safer, richer park experience as you navigate with your prefered tour guide.</p>
            </div>
        </aside>
        <main class="auth-portal-main">
            <section class="auth-card">
                <div class="auth-tabs">
                    <button type="button" class="auth-tab ${isLogin ? 'active' : ''}" onclick="renderView('login')">${icon('user', 'icon-sm')} Log In</button>
                    <button type="button" class="auth-tab ${!isLogin ? 'active' : ''}" onclick="renderView('register')">${icon('userPlus', 'icon-sm')} Create Account</button>
                </div>
                ${isLogin ? `
                <form class="auth-form" onsubmit="event.preventDefault(); handleLogin();">
                    <label class="auth-field"><span class="auth-field-label">Email or Username</span><span class="auth-input-shell">${icon('mail', 'auth-input-icon')}<input type="text" id="loginUsername" class="auth-input auth-input-with-icon" placeholder="Enter your email or username"></span></label>
                    <label class="auth-field"><span class="auth-field-label">Password</span><span class="auth-input-shell">${icon('lock', 'auth-input-icon')}<input type="password" id="loginPassword" class="auth-input auth-input-with-icon" placeholder="Enter your password"></span></label>
                    <label class="auth-check"><input type="checkbox" id="rememberMe" checked><span>Remember me</span></label>
                    <button type="submit" class="auth-primary-btn">${icon('user', 'icon-sm')} Sign In</button>
                    <button type="button" class="auth-link-btn" onclick="handleForgotPassword()">${icon('key', 'icon-sm')} Forgot password?</button>
                    <div id="authFeedback" class="auth-feedback" hidden></div>
                </form>
                ` : `
                <form class="auth-form" onsubmit="event.preventDefault(); handleRegistration();">
                    <div class="auth-grid">
                        <label class="auth-field"><span class="auth-field-label">Full Name</span><span class="auth-input-shell">${icon('user', 'auth-input-icon')}<input type="text" id="regFullName" class="auth-input auth-input-with-icon" placeholder="Your full name"></span></label>
                        <label class="auth-field"><span class="auth-field-label">Username</span><span class="auth-input-shell">${icon('user', 'auth-input-icon')}<input type="text" id="regUsername" class="auth-input auth-input-with-icon" placeholder="Choose a username"></span></label>
                    </div>
                    <label class="auth-field"><span class="auth-field-label">Email</span><span class="auth-input-shell">${icon('mail', 'auth-input-icon')}<input type="email" id="regEmail" class="auth-input auth-input-with-icon" placeholder="name@example.com"></span></label>
                    <label class="auth-field"><span class="auth-field-label">Password</span><span class="auth-input-shell">${icon('lock', 'auth-input-icon')}<input type="password" id="regPassword" class="auth-input auth-input-with-icon" placeholder="Create a password"></span></label>
                    <label class="auth-field"><span class="auth-field-label">Confirm Password</span><span class="auth-input-shell">${icon('lock', 'auth-input-icon')}<input type="password" id="regConfirmPassword" class="auth-input auth-input-with-icon" placeholder="Repeat your password"></span></label>
                    <label class="auth-field"><span class="auth-field-label">Role</span><select id="regUserType" class="auth-select"><option value="tourist">Tourist</option><option value="guide">Tour Guide</option><option value="it_manager">IT Manager</option></select></label>
                    <button type="submit" class="auth-primary-btn">${icon('userPlus', 'icon-sm')} Create Account</button>
                    <div id="authFeedback" class="auth-feedback" hidden></div>
                </form>
                `}
            </section>
        </main>
    </div>`;
}
function renderLoginScreen() {
    return renderAuthMergedScreen('login');
}

function renderRegisterScreen() {
    return renderAuthMergedScreen('register');
}

async function renderView(view, options = {}) {
    const safeView = normalizeView(view);
    const shouldUpdateHash = options.updateHash === true;
    const suppressAccessToast = options.suppressAccessToast === true;

    const app = document.getElementById('app');
    if (!app) return;

    if (!Auth.isAuthenticated() && !PUBLIC_VIEWS.has(safeView)) {
        navigateTo('login');
        return;
    }

    if (Auth.isAuthenticated() && !PUBLIC_VIEWS.has(safeView)) {
        const role = getEffectiveRole(Auth.getCurrentUser());
        if (!canUserAccessView(role, safeView)) {
            if (!suppressAccessToast) {
                showToast('You do not have access to that area.', 'warning');
            }
            await renderView(getLandingViewForUser(Auth.getCurrentUser()), {
                updateHash: true,
                suppressAccessToast: true
            });
            return;
        }
    }

    window.currentView = safeView;

    if (shouldUpdateHash) {
        const targetHash = `#${safeView}`;
        if (window.location.hash !== targetHash) {
            window.location.hash = targetHash;
        }
    }

    document.body.classList.toggle('auth-page', PUBLIC_VIEWS.has(safeView));

    if (safeView !== 'map') {
        teardownLiveMap();
    }
    if (safeView !== 'it_dashboard') {
        stopAdminRealtimeUsersRefresh();
    }

    let content = '';
    switch (safeView) {
        case 'login': app.innerHTML = renderLoginScreen(); return;
        case 'register': app.innerHTML = renderRegisterScreen(); return;
        case 'dashboard': content = await renderDashboardContent(); break;
        case 'animals': content = await renderAnimalsContent(); break;
        case 'map': content = renderMapContent(); break;
        case 'culture': content = await renderCultureContent(); break;
        case 'sightings': content = await renderSightingsContent(); break;
        case 'profile': content = renderProfileContent(); break;
        case 'info': content = renderInfoContent(); break;
        case 'ai_chat': content = renderAIChatContent(); break;
        case 'guide_dashboard': content = await renderGuideDashboard(); break;
        case 'it_dashboard': content = await renderITManagerDashboard(); break;
        case 'intranet': content = await renderIntranetDashboard(); break;
        default: content = await renderDashboardContent();
    }

    app.innerHTML = renderMainLayout(content);
    refreshNetworkStatusBadge();
    await refreshRareAlertBadge();
    if (safeView === 'it_dashboard') {
        startAdminRealtimeUsersRefresh();
    }
    if (safeView === 'map') {
        await initializeLiveMap();
    } else if (safeView === 'profile') {
        await loadRecentFeedback();
    }
    if (safeView === 'ai_chat') {
        applySIGTSAIPrefill();
    }
    if (safeView === 'guide_dashboard') {
        requestAnimationFrame(() => {
            if (typeof window.initGuideMessagingPanel === 'function') {
                window.initGuideMessagingPanel();
            }
        });
    }
}

function refreshNetworkStatusBadge() {
    const badge = document.getElementById('networkStatusBadge');
    if (!badge) return;
    const state = getParkAccessState();
    const isOffline = !state.online;
    const pending = OfflineSync?.getPendingCount?.() || 0;
    badge.classList.toggle('offline', isOffline);
    badge.classList.toggle('online', !isOffline);
    badge.textContent = isOffline ? `Offline mode • ${pending} pending` : (pending ? `Online • ${pending} pending sync` : 'Online');
}

window.refreshNetworkStatusBadge = refreshNetworkStatusBadge;

function refreshParkAccessPanel() {
    const panel = document.querySelector('.park-access-panel');
    if (!panel) return;
    panel.outerHTML = renderParkAccessPanel();
    refreshNetworkStatusBadge();
}

window.refreshParkAccessPanel = refreshParkAccessPanel;

window.setParkBoundaryMode = function (mode) {
    if (!['auto', 'inside', 'outside'].includes(mode)) return;
    parkAccessSimulation.boundary = mode;
    saveParkAccessSimulation();
    refreshParkAccessPanel();
    if (mode === 'outside') showToast('Boundary simulation: OUTSIDE park', 'warning');
    if (mode === 'inside') showToast('Boundary simulation: INSIDE park', 'success');
};

window.setParkNetworkMode = function (mode) {
    if (!['auto', 'online', 'offline'].includes(mode)) return;
    parkAccessSimulation.network = mode;
    saveParkAccessSimulation();
    refreshParkAccessPanel();
    if (mode === 'offline') showToast('Network simulation: OFFLINE', 'warning');
    if (mode === 'online') showToast('Network simulation: ONLINE', 'success');
};

window.resetParkAccessSimulation = function () {
    parkAccessSimulation = { boundary: 'auto', network: 'auto' };
    saveParkAccessSimulation();
    refreshParkAccessPanel();
    showToast('Park access simulation reset to live mode.', 'info');
};

async function refreshRareAlertBadge() {
    const badge = document.getElementById('rareAlertBadge');
    if (!badge) return;
    const user = Auth.getCurrentUser() || {};
    const role = user.role || user.userType || user.user_type;
    if (role !== 'it_manager' && role !== 'guide') {
        badge.classList.add('hidden');
        return;
    }
    const alerts = await ITAPI.getUnackedRareAlerts(20);
    const count = Array.isArray(alerts) ? alerts.length : 0;
    badge.textContent = String(Math.min(99, count));
    badge.classList.toggle('hidden', count === 0);
}

window.refreshRareAlertBadge = refreshRareAlertBadge;
