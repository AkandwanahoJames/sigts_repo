function toggleSidebar() {
    document.querySelector('.sidebar')?.classList.toggle('open');
}

function closeSidebar() {
    if (window.innerWidth < 768) document.querySelector('.sidebar')?.classList.remove('open');
}

function escapeHtml(str) {
    if (!str) return '';
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
<<<<<<< HEAD
        note: '<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4"/><path d="M9 11h6M9 15h6"/>',
        mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
        lock: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
        eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
        at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
        check: '<path d="M20 6L9 17l-5-5"/>',
        arrowRight: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
        chevronDown: '<path d="M6 9l6 6 6-6"/>',
        sparkles: '<path d="M12 3l1.6 4.3L18 9l-4.4 1.7L12 15l-1.6-4.3L6 9l4.4-1.7z"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z"/><path d="M5 14l.7 1.8L8 16.5l-2.3.7L5 19l-.7-1.8L2 16.5l2.3-.7z"/>'
=======
        note: '<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4"/><path d="M9 11h6M9 15h6"/>'
        ,
        smile: '<circle cx="12" cy="12" r="9"/><path d="M8 10h.01M16 10h.01"/><path d="M8 15c1.2 1.2 2.3 1.8 4 1.8s2.8-.6 4-1.8"/>'
>>>>>>> upstream/master
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
    const titles = { dashboard: 'Dashboard', animals: 'Animals', map: 'Map', culture: 'Culture', sightings: 'Sightings', profile: 'Profile', info: 'Info', ai_chat: 'AI Assistant', guide_dashboard: 'Guide Dashboard', it_dashboard: 'Admin Dashboard', intranet: 'Intranet Hub' };
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

function navigateTo(view, options = {}) {
    const targetView = normalizeView(view);
    const shouldUpdateHash = options.updateHash !== false;

    if (shouldUpdateHash) {
        const targetHash = `#${targetView}`;
        if (window.location.hash !== targetHash) {
            window.location.hash = targetHash;
            return;
        }
    }

    renderView(targetView, { updateHash: false });
}

function formatRoleName(role = 'tourist') {
    return String(role)
        .replace(/_/g, ' ')
        .replace(/\b\w/g, letter => letter.toUpperCase());
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

function getGuideOpsManager() {
    if (!window.__guideOpsManager) {
        window.__guideOpsManager = new TourGuideManager();
    }
    return window.__guideOpsManager;
}

function renderMainLayout(content) {
    const user = Auth.getCurrentUser() || { name: 'Guest', role: 'tourist' };
    const isGuide = user?.role === 'guide' || user?.userType === 'guide';
    const isITManager = user?.role === 'it_manager' || user?.userType === 'it_manager';
<<<<<<< HEAD
    const roleLabel = formatRoleName(user.role || user.userType || 'tourist');
=======
    const roleLabel = (user.role || user.userType || 'tourist').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const avatarIcon = isITManager ? icon('chart', 'icon-md') : (isGuide ? icon('ticket', 'icon-md') : icon('user', 'icon-md'));
>>>>>>> upstream/master
    
    let navItems = [
        { id: 'dashboard', icon: 'home', label: 'Home' },
        { id: 'animals', icon: 'paw', label: 'Animals' },
        { id: 'map', icon: 'map', label: 'Map' },
        { id: 'culture', icon: 'book', label: 'Culture' },
        { id: 'ai_chat', icon: 'target', label: 'AI Chat' },
        { id: 'sightings', icon: 'camera', label: 'Sightings' },
        { id: 'profile', icon: 'user', label: 'Profile' }
    ];
    if (isGuide) navItems.push({ id: 'guide_dashboard', icon: 'ticket', label: 'Guide' });
    if (isITManager) {
        navItems.push({ id: 'it_dashboard', icon: 'chart', label: 'Admin' });
        navItems.push({ id: 'intranet', icon: 'building', label: 'Intranet' });
    }
    
<<<<<<< HEAD
    return `<div class="app-container">
        <button class="sidebar-toggle" onclick="toggleSidebar()">${icon('menu', 'icon-sm')}</button>
        <aside class="sidebar">
            <div class="sidebar-header">
                <div class="sidebar-logo"><img src="/icons/icon-192.svg" alt="SIGTS logo"></div>
                <div class="sidebar-title"><span class="sidebar-title-script">SIGTS</span><span>Platform</span></div>
            </div>
            <div class="sidebar-profile" onclick="navigateTo('profile')">
                <div class="sidebar-avatar sidebar-avatar-photo" aria-hidden="true"></div>
                <div class="sidebar-user-info">
                    <div class="sidebar-user-name">${escapeHtml(user.name)}</div>
                    <div class="sidebar-user-role">${escapeHtml(roleLabel)}</div>
                </div>
            </div>
            <nav class="sidebar-nav">
                ${navItems.map(item => `<div class="nav-item-vertical ${window.currentView === item.id ? 'active' : ''}" onclick="navigateTo('${item.id}')"><div class="nav-icon-vertical">${icon(item.icon, 'icon-md')}</div><div class="nav-label-vertical">${item.label}</div></div>`).join('')}
            </nav>
            <div class="sidebar-logout" onclick="Auth.logout()">${icon('logout', 'icon-md')} <span>Logout</span></div>
        </aside>
        <main class="main-content" onclick="closeSidebar()">
            <div class="content-header">
                <div class="header-left">
                    <h1>${getPageTitle(window.currentView)}</h1>
                    <p>${getPageSubtitle(window.currentView)}</p>
                </div>
                <div class="header-right">
                    <span class="header-status-badge">${icon('shield', 'icon-sm')} Secure Session</span>
                    <button class="icon-btn notification-btn" onclick="renderView('notifications')" aria-label="Notifications">${icon('bell', 'icon-md')}<span class="notification-dot">3</span></button>
                    <button class="header-profile" onclick="navigateTo('profile')" aria-label="Open profile">
                        <span class="header-avatar" aria-hidden="true"></span>
                        <span class="header-profile-copy"><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(roleLabel)}</small></span>
                        ${icon('chevronDown', 'icon-sm')}
                    </button>
                </div>
            </div>
            <div class="main-container">${content}</div>
        </main>
    </div>`;
=======
    const isOffline = !navigator.onLine;
    const pending = OfflineSync?.getPendingCount?.() || 0;
    const statusText = isOffline ? `Offline mode • ${pending} pending` : (pending ? `Online • ${pending} pending sync` : 'Online');
    return `<div class="app-container"><button class="sidebar-toggle" onclick="toggleSidebar()">${icon('menu', 'icon-sm')}</button><div class="sidebar"><div class="sidebar-header"><div class="sidebar-brand"><div class="sidebar-logo"><img src="/icons/icon-192.svg" alt="SIGTS logo"></div><div class="sidebar-title">Bwindi SIGTS</div></div></div><div class="sidebar-nav">${navItems.map(item => `<div class="nav-item-vertical ${window.currentView === item.id ? 'active' : ''}" onclick="navigateTo('${item.id}')"><div class="nav-icon-vertical">${icon(item.icon, 'icon-md')}</div><div class="nav-label-vertical">${item.label}</div></div>`).join('')}</div><div class="sidebar-logout" onclick="Auth.logout()">${icon('logout', 'icon-md')} Logout</div></div><div class="main-content" onclick="closeSidebar()"><div class="content-header"><h1>${getPageTitle(window.currentView)}</h1><div class="header-right"><span id="networkStatusBadge" class="net-status ${isOffline ? 'offline' : 'online'}">${statusText}</span><button class="icon-btn notif-btn" onclick="renderView('it_dashboard')">${icon('bell', 'icon-md')}<span id="rareAlertBadge" class="notif-badge hidden">0</span></button><button class="header-profile" onclick="navigateTo('profile')"><div class="header-avatar ${isITManager ? 'role-it' : (isGuide ? 'role-guide' : 'role-tourist')}">${avatarIcon}</div><div class="header-user-info"><div class="header-user-name">${escapeHtml(user.name)}</div><div class="header-user-role">${escapeHtml(roleLabel)}</div></div></button></div></div><div class="main-container">${content}</div></div></div>`;
>>>>>>> upstream/master
}

function getAnimalIconName(animalName = '') {
    const value = animalName.toLowerCase();
    if (value.includes('gorilla')) return 'gorilla';
    if (value.includes('elephant')) return 'elephant';
    if (value.includes('bird') || value.includes('turaco')) return 'bird';
    return 'paw';
}

// =====================================================
// CONTENT RENDER FUNCTIONS
// =====================================================
async function renderDashboardContent() {
    const animals = await Content.getAnimals();
    const recommendations = await AI.getRecommendations(3);
    const seasonal = await AI.getSeasonalRecommendations();
<<<<<<< HEAD
    const quickCards = [
        { id: 'animals', iconName: 'paw', label: 'Animals', count: `${animals.length || 3} species`, className: 'animals' },
        { id: 'map', iconName: 'map', label: 'Map', className: 'map' },
        { id: 'culture', iconName: 'book', label: 'Culture', className: 'culture' },
        { id: 'info', iconName: 'info', label: 'Info', className: 'info' }
    ];
    const seasonalTitle = seasonal.season === 'dry' ? `${icon('sun', 'icon-sm')} Dry Season` : `${icon('rain', 'icon-sm')} Wet Season`;
    const recommendationCategories = ['Wildlife', 'Nature', 'Culture'];
    const seasonalDetails = {
        'Gorilla Trekking': 'Clearer trails and better long-distance views.',
        'Bird Watching': 'Active forest birds and strong photography light.',
        'Cultural Experiences': 'Explore rich traditions and local heritage during the lush season.',
        'Forest Walks': 'Fresh vegetation, misty trails, and vivid rainforest color.'
    };

    return `<div class="dashboard-screen">
        <div class="quick-grid">
            ${quickCards.map(card => `<button class="quick-card feature-card quick-photo ${card.className}" onclick="navigateTo('${card.id}')">
                <span class="quick-icon">${icon(card.iconName, 'icon-xl')}</span>
                <span class="quick-label">${card.label}</span>
                ${card.count ? `<span class="quick-count">${card.count}</span>` : ''}
            </button>`).join('')}
        </div>
        <div class="dashboard-main-grid">
            <div class="dashboard-left-column">
                <section class="section-card recommendations-card card">
                    <div class="section-header"><h3>${icon('sparkles', 'icon-sm')} AI Recommendations</h3></div>
                    <div id="recList">
                        ${recommendations.map((r, index) => `<button class="rec-card recommendation-row" onclick="navigateTo('${index === 2 ? 'culture' : 'animals'}')">
                            <span class="rec-avatar" aria-hidden="true"></span>
                            <span class="rec-info">
                                <span class="rec-title">${escapeHtml(r.name)}</span>
                                <span class="rec-category-badge">${recommendationCategories[index] || 'Insight'}</span>
                                <span class="rec-reason">${escapeHtml(r.reason)}</span>
                            </span>
                            <span class="rec-arrow">${icon('arrowRight', 'icon-sm')}</span>
                        </button>`).join('')}
                    </div>
                </section>

                <section class="section-card seasonal-card seasonal-insight-card card">
                    <div class="seasonal-copy">
                        <h3>${icon('leaf', 'icon-sm')} Seasonal Insight</h3>
                        <p class="seasonal-phase">${seasonalTitle}</p>
                        <ul class="seasonal-list">
                            ${seasonal.recommendations.map(a => `<li><strong>${escapeHtml(a)}</strong><span>${escapeHtml(seasonalDetails[a] || 'Recommended for current park conditions.')}</span></li>`).join('')}
                        </ul>
                        <button class="seasonal-action" onclick="navigateTo('culture')">View Suggestions</button>
                    </div>
                    <div class="seasonal-thumb" aria-hidden="true"></div>
                </section>
            </div>

            <aside class="dashboard-right-column">
                <aside class="dashboard-quote-card card"><blockquote>"The best view comes after the hardest climb."</blockquote></aside>
                <section class="section-card quick-actions-card card">
                    <div class="section-header"><h3>${icon('target', 'icon-sm')} Quick Actions</h3></div>
                    <div class="quick-actions-list">
                        <button class="small-btn btn-secondary" onclick="navigateTo('map')">Open Map</button>
                        <button class="small-btn btn-secondary" onclick="navigateTo('sightings')">Log Sighting</button>
                        <button class="small-btn btn-secondary" onclick="navigateTo('info')">Safety Info</button>
                    </div>
                </section>
                <section class="section-card safety-notice-card card">
                    <div class="section-header"><h3>${icon('shield', 'icon-sm')} Safety Notice</h3></div>
                    <div class="safety-copy">Maintain guide instructions, wildlife distance rules, and route check-ins throughout active sessions.</div>
                </section>
            </aside>
        </div>
    </div>`;
=======
    return renderDashboardShell({
        primaryTitle: 'AI Recommendations',
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
    }).join('') || '<div class="empty-state">No items available.</div>'}</div></div><div class="dashboard-quote-card"><blockquote>${escapeHtml(quote)}</blockquote></div></div><div class="section-card seasonal-card"><div class="section-header"><h3>${icon('leaf', 'icon-sm')} Seasonal: ${seasonalTitle}</h3></div><div class="seasonal-list">${seasonalItems.map((a) => `<div class="seasonal-item">• ${escapeHtml(a)}</div>`).join('') || '<div class="seasonal-item">• No seasonal updates available</div>'}</div><div class="seasonal-bottom"><div class="seasonal-image-strip photo-leaf" aria-hidden="true"></div><button class="seasonal-action-btn">${escapeHtml(seasonalActionLabel || 'View Suggestions')}</button></div></div>`;
>>>>>>> upstream/master
}

async function renderAnimalsContent() {
    const animals = await Content.getAnimals();
    if (!animals.length) {
        return `<div class="section-card"><div class="empty-state">No animal records available yet.</div></div>`;
    }

    return `<div class="animals-list">${animals.map(animal => `
        <div class="animal-card">
            <div class="animal-icon">${icon(getAnimalIconName(animal.name), 'icon-xl')}</div>
            <div class="animal-info">
                <div class="animal-name">${escapeHtml(animal.name)}</div>
                <div class="animal-scientific">${escapeHtml(animal.scientific_name || 'Scientific name unavailable')}</div>
                <span class="animal-status status-${escapeHtml((animal.conservation_status || 'least_concern').replace(/_/g, '-'))}">
                    ${escapeHtml((animal.conservation_status || 'least_concern').replace(/_/g, ' '))}
                </span>
                <button class="small-btn" style="margin-top:10px;" onclick="submitContentHelpfulness('animal', '${animal.animal_id || animal.id}', '${escapeHtml(animal.name)}')">${icon('target', 'icon-sm')} Helpful?</button>
            </div>
        </div>`).join('')}</div>`;
}

function renderMapContent() {
    return `<div class="map-container"><div id="bwindiLiveMap" class="map-canvas"></div><div class="map-overlay"><div class="map-status" id="mapStatus">Loading Bwindi live map...</div><div class="map-coords" id="mapCoords">Lat: --, Lng: --</div><div class="map-guidance"><select id="mapLayer" class="map-destination" onchange="changeMapLayer()"><option value="standard">Standard</option><option value="topo">Terrain</option></select></div><div class="map-guidance"><input id="mapSearchInput" class="map-destination" placeholder="Search location..." /><button class="small-btn" onclick="searchMapLocation()">Find</button></div><div class="map-guidance"><select id="mapDestination" class="map-destination"><option value="">Select destination...</option></select><button class="small-btn" onclick="openMapGuidance()">Guide Me</button></div><div class="map-guidance"><button class="small-btn" onclick="startDistanceMeasure()">Set A</button><button class="small-btn" onclick="measureToCurrent()">A → Me</button></div><div class="map-guidance-text" id="mapGuidanceText">Select a destination to get turn-by-turn guidance.</div><div class="map-nearby" id="mapNearbyList">Nearby POIs will appear here.</div></div></div>`;
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
        const [locations, boundary, sightings, tours] = await Promise.all([
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

        const boundaryLatLngs = getBoundaryLatLngs(boundary);
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
                return createDivMarker(
                    coords.lat,
                    coords.lng,
                    markerClassForLocation(loc),
                    `<strong>${escapeHtml(loc.name || 'POI')}</strong><br>${escapeHtml(loc.type || 'location')}`
                );
            })
            .filter(Boolean);
        liveMapLayers.markers.push(...poiMarkers);

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

        const current = Geofence?.currentLocation || AppState?.currentLocation;
        if (current && Number.isFinite(current.lat) && Number.isFinite(current.lng)) {
            const userMarker = createDivMarker(current.lat, current.lng, 'map-marker-user', 'Your current location');
            userMarker.bindPopup('Your current location');
            liveMapLayers.markers.push(userMarker);
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
    liveMapTileLayers.standard.addTo(liveMapInstance);

    await refreshLiveMapData();
    liveMapRefreshTimer = setInterval(() => {
        refreshLiveMapData();
    }, 15000);
}

async function renderCultureContent() {
    const stories = await API.getCulturalStories();
    if (!stories.length) {
        return `<div class="section-card"><div class="empty-state">Cultural stories will appear here once they are published.</div></div>`;
    }

    const [featured, ...rest] = stories;
    const secondary = rest.slice(0, 3);

    return `
        <div class="story-card featured">
            <div class="story-image" style="background: linear-gradient(135deg, #795548, #5D4037);"></div>
            <div class="story-content">
                <span class="story-community">${escapeHtml(featured.community || 'Community story')}</span>
                <div class="story-title">${escapeHtml(featured.title_en || featured.title_local || 'Untitled story')}</div>
                <div class="story-storyteller">${escapeHtml(featured.storyteller_name || 'Unknown storyteller')}${featured.duration ? ` • ${featured.duration} min` : ''}</div>
                <button class="small-btn" style="margin-top:10px;" onclick="submitContentHelpfulness('cultural', '${featured.narrative_id || ''}', '${escapeHtml(featured.title_en || featured.title_local || 'story')}')">${icon('target', 'icon-sm')} Helpful?</button>
            </div>
        </div>
        ${secondary.map(story => `
            <div class="story-card">
                <div class="story-content">
                    <span class="story-community">${escapeHtml(story.community || 'Community story')}</span>
                    <div class="story-title">${escapeHtml(story.title_en || story.title_local || 'Untitled story')}</div>
                    <div class="story-storyteller">${escapeHtml(story.storyteller_name || 'Unknown storyteller')}${story.duration ? ` • ${story.duration} min` : ''}</div>
                    <button class="small-btn" style="margin-top:10px;" onclick="submitContentHelpfulness('cultural', '${story.narrative_id || ''}', '${escapeHtml(story.title_en || story.title_local || 'story')}')">${icon('target', 'icon-sm')} Helpful?</button>
                </div>
            </div>`).join('')}`;
}

async function renderSightingsContent() {
    const sightings = await API.getRecentSightings(10);
<<<<<<< HEAD
    return `<div class="section-card"><div class="section-header"><h3>${icon('camera', 'icon-sm')} Recent Sightings</h3><button class="add-btn btn-primary" onclick="addSighting()">${icon('plus', 'icon-sm')} Report</button></div><div class="sighting-list">${sightings.length ? sightings.map(sighting => `
=======
    const commentsBySighting = {};
    await Promise.all((sightings || []).map(async (sighting) => {
        const sid = sighting.sighting_id;
        if (!sid) return;
        commentsBySighting[sid] = await API.getSightingComments(sid, 3);
    }));
    return `<div class="section-card"><div class="section-header"><h3>${icon('camera', 'icon-sm')} Recent Sightings</h3><button class="add-btn" onclick="addSighting()">${icon('plus', 'icon-sm')} Report</button></div><div class="sighting-list">${sightings.length ? sightings.map(sighting => `
>>>>>>> upstream/master
        <div class="sighting-item">
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
    const currentLanguage = AppState.userPreferences?.language || 'en';
    return `<div class="profile-header"><div class="profile-avatar">${icon('user', 'icon-xl')}</div><div class="profile-name">${escapeHtml(user.name)}</div><div class="profile-role">${user.role || 'tourist'}</div><div class="profile-dept">${user.department || ''}</div></div><div class="section-card"><div class="section-header"><h3>${icon('note', 'icon-sm')} Experience Settings</h3></div><div style="padding:16px; display:grid; gap:12px;"><label class="auth-field"><span class="auth-field-label">Language</span><select id="profileLanguage" class="auth-select"><option value="en" ${currentLanguage === 'en' ? 'selected' : ''}>English</option><option value="fr" ${currentLanguage === 'fr' ? 'selected' : ''}>French</option><option value="sw" ${currentLanguage === 'sw' ? 'selected' : ''}>Swahili</option><option value="ruk" ${currentLanguage === 'ruk' ? 'selected' : ''}>Rukiga</option></select></label><button class="small-btn" onclick="saveLanguagePreference()">Save Language</button></div></div><div class="section-card"><div class="section-header"><h3>${icon('target', 'icon-sm')} Feedback Loop</h3></div><div style="padding:16px; display:grid; gap:12px;"><label class="auth-field"><span class="auth-field-label">Rate your recent experience</span><select id="feedbackRating" class="auth-select"><option value="5">5 - Excellent</option><option value="4">4 - Good</option><option value="3">3 - Average</option><option value="2">2 - Poor</option><option value="1">1 - Very Poor</option></select></label><label class="auth-field"><span class="auth-field-label">Category</span><select id="feedbackCategory" class="auth-select"><option value="tour">Tour</option><option value="guide">Guide</option><option value="content">Content</option><option value="app">App</option><option value="general">General</option></select></label><label class="auth-field"><span class="auth-field-label">Comment</span><textarea id="feedbackComment" class="auth-input" style="min-height:80px; padding-top:10px;" placeholder="Share what worked and what can improve..."></textarea></label><button class="small-btn" onclick="submitUserFeedback()">Submit Feedback</button><div id="feedbackList" class="seasonal-list"><div class="seasonal-item">Loading your recent feedback...</div></div></div></div><div class="profile-menu"><div class="menu-item" onclick="downloadOfflineContent()"><div class="menu-icon">${icon('download', 'icon-md')}</div><div class="menu-text">Download Offline Content</div></div>${isITManager ? `<div class="menu-item" onclick="handleMFASetup()"><div class="menu-icon">${icon('shield', 'icon-md')}</div><div class="menu-text">Configure MFA</div></div>` : ''}<div class="menu-item" onclick="Auth.logout()"><div class="menu-icon">${icon('logout', 'icon-md')}</div><div class="menu-text">Logout</div></div></div>`;
}

function renderInfoContent() {
    return `<div class="section-card"><div class="section-header"><h3>${icon('clock', 'icon-sm')} Opening Hours</h3></div><div style="padding:16px;">Park: 6:00 AM - 7:00 PM<br><button class="small-btn" style="margin-top:10px;" onclick="submitContentHelpfulness('info', '', 'Opening Hours')">${icon('target', 'icon-sm')} Helpful?</button></div></div><div class="section-card"><div class="section-header"><h3>${icon('phone', 'icon-sm')} Emergency</h3></div><div style="padding:16px;">${icon('shield', 'icon-sm')} Rangers: +256-77-XXX-XXXX<br><button class="small-btn" style="margin-top:10px;" onclick="submitContentHelpfulness('info', '', 'Emergency Contacts')">${icon('target', 'icon-sm')} Helpful?</button></div></div>`;
}

function renderAIChatContent() {
    return `<div class="section-card">
        <div class="section-header"><h3>${icon('target', 'icon-sm')} SIGTS AI Assistant</h3></div>
        <div id="aiChatMessages" style="padding:16px; max-height: 50vh; overflow-y: auto;">
            <div class="rec-card">
                <div class="rec-info">
                    <div class="rec-title">Assistant</div>
                    <div class="rec-reason">Ask about wildlife, safety, culture, routes, or local weather insights.</div>
                </div>
            </div>
        </div>
        <div style="padding:16px; border-top: 1px solid #E8EDDF; display:flex; gap:10px;">
            <input id="aiChatInput" class="auth-input" style="height:44px; flex:1;" placeholder="Type your question..." />
            <button class="login-btn" style="margin:0; white-space:nowrap;" onclick="sendAIChatMessage()">Send</button>
        </div>
    </div>`;
}

async function renderGuideDashboard() {
    const guideManager = getGuideOpsManager();
    const dashboard = await guideManager.getGuideDashboard();
<<<<<<< HEAD
    return `<div class="guide-dashboard"><div class="metrics-grid"><div class="metric-card"><div class="metric-value">${dashboard.stats.totalTours}</div><div class="metric-label">Total Tours</div></div><div class="metric-card"><div class="metric-value">${dashboard.stats.totalGuests}</div><div class="metric-label">Guests Served</div></div><div class="metric-card"><div class="metric-value">${dashboard.stats.averageRating}</div><div class="metric-label">Rating</div></div></div><div class="section-card"><div class="section-header"><h3>${icon('clock', 'icon-sm')} Today's Tours</h3></div>${dashboard.today.map(t => `<div class="tour-item"><div class="tour-name">${t.route_name || 'Gorilla Trek'}</div><div class="tour-time">${new Date(t.scheduled_start).toLocaleTimeString()}</div><button class="small-btn btn-secondary" onclick="startTour('${t.tour_session_id}')">Start Tour</button></div>`).join('') || '<div class="empty-state">No tours today</div>'}</div><div class="shift-controls"><button class="login-btn btn-primary" onclick="clockInOut()">${dashboard.activeShift ? 'Clock Out' : 'Clock In'}</button></div><div id="activeTourPanel" style="display:none"><div id="tourTimerDisplay" class="tour-timer">00:00:00</div><button class="small-btn btn-secondary" onclick="quickSighting()">Log Sighting</button><button class="small-btn btn-danger" onclick="endActiveTour()">End Tour</button></div></div>`;
=======
    const animals = await Content.getAnimals();
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
    })}<div class="section-card"><div class="section-header"><h3>${icon('clock', 'icon-sm')} Schedule Controls</h3></div><div class="seasonal-list">${(dashboard.today || []).length ? dashboard.today.map((t) => `<div class="seasonal-item"><strong>${escapeHtml(t.route_name || 'Tour Route')}</strong> - ${new Date(t.scheduled_start).toLocaleTimeString()} (${t.confirmed_guests || t.group_size || 0} guests) <button class="small-btn" onclick="startTour('${t.tour_session_id}')">Start</button></div>`).join('') : '<div class="seasonal-item">No tours today.</div>'}</div></div><div class="section-card"><div class="section-header"><h3>${icon('users', 'icon-sm')} Live Participants</h3></div><div class="seasonal-list">${participants.length ? participants.map((p) => `<div class="seasonal-item">${escapeHtml(p.first_name || p.username || 'Tourist')} ${escapeHtml(p.last_name || '')} - ${escapeHtml(p.pickup_location || 'In-session')}</div>`).join('') : '<div class="seasonal-item">No participants assigned yet.</div>'}</div></div><div class="shift-controls"><button class="login-btn" onclick="clockInOut()">${dashboard.activeShift ? 'Clock Out' : 'Clock In'}</button><button class="small-btn" onclick="addTourNotePrompt()">Add Tour Note</button></div><div id="activeTourPanel" style="${guideManager.activeTour ? 'display:block' : 'display:none'}"><div id="tourTimerDisplay" class="tour-timer">00:00:00</div><button onclick="quickSighting()">Log Sighting</button><button onclick="endActiveTour()">End Tour</button></div></div>`;
>>>>>>> upstream/master
}

async function renderITManagerDashboard() {
    const metrics = await ITAPI.getSystemMetrics();
    const users = await ITAPI.getUserList();
<<<<<<< HEAD
    const schemaStatus = await ITAPI.getSchemaStatus();
    return `<div class="it-dashboard"><div class="welcome-card"><h2>Welcome back, ${escapeHtml(Auth.getCurrentUser()?.name)}</h2></div><div class="metrics-grid"><div class="metric-card"><div class="metric-value">${metrics.activeUsers}</div><div class="metric-label">Active Users</div></div><div class="metric-card"><div class="metric-value">${metrics.syncQueueSize}</div><div class="metric-label">Pending Sync</div></div><div class="metric-card"><div class="metric-value">${metrics.totalSightings}</div><div class="metric-label">Sightings</div></div><div class="metric-card"><div class="metric-value">${metrics.totalStaff || 0}</div><div class="metric-label">Staff Total</div></div><div class="metric-card"><div class="metric-value">${metrics.guidesOnDuty || 0}</div><div class="metric-label">Guides Active</div></div><div class="metric-card"><div class="metric-value">${metrics.inventoryItems || 0}</div><div class="metric-label">Inventory Items</div></div></div><div class="section-card"><div class="section-header"><h3>${icon('users', 'icon-sm')} Users</h3></div>${users.map(u => `<div class="user-item">${u.full_name} (${u.user_type}) - ${u.department || ''}</div>`).join('')}</div><div class="section-card"><div class="section-header"><h3>${icon('database', 'icon-sm')} Database Schema (Extended)</h3></div><div class="schema-items">${Object.entries(schemaStatus).slice(0,12).map(([name, info]) => `<div class="schema-item">${icon('chart', 'icon-sm')} ${name}: ${info.count} records</div>`).join('')}</div></div><div class="admin-actions"><button class="admin-action-btn btn-primary" onclick="handleMFASetup()">${icon('shield', 'icon-sm')} Configure MFA</button><button class="admin-action-btn btn-secondary" onclick="clearAllCache()">Clear Cache</button><button class="admin-action-btn btn-secondary" onclick="exportData()">Export Data</button><button class="admin-action-btn danger btn-danger" onclick="resetApp()">Reset App</button></div></div>`;
=======
    const interactive = await ITAPI.getInteractiveAnalytics();
    const liveOps = await ITAPI.getLiveOperations();
    const feedbackInsights = await ITAPI.getFeedbackInsights(30);
    const rareAlerts = await ITAPI.getRareAlerts(6);
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
    const animals = await Content.getAnimals();
    return `<div class="it-dashboard">${renderDashboardShell({
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
    })}<div class="section-card"><div class="section-header"><h3>${icon('users', 'icon-sm')} Users</h3></div>${users.map(u => `<div class="user-item">${u.full_name} (${u.user_type}) - ${u.department || ''}</div>`).join('')}</div><div class="dashboard-feature-grid"><div class="section-card"><div class="section-header"><h3>${icon('chart', 'icon-sm')} Visitor Flow (7 days)</h3></div><div class="analytics-list">${flowBars}</div></div><div class="section-card"><div class="section-header"><h3>${icon('target', 'icon-sm')} Popular Content</h3></div><div class="analytics-list">${popularRows}</div></div></div><div class="dashboard-feature-grid"><div class="section-card"><div class="section-header"><h3>${icon('users', 'icon-sm')} User Type Demographics</h3></div><div class="analytics-list">${demographicRows}</div></div><div class="section-card"><div class="section-header"><h3>${icon('map', 'icon-sm')} Congestion Guidance</h3></div><div class="seasonal-list">${(interactive.congestionRecommendations || []).map((r) => `<div class="seasonal-item">• ${escapeHtml(r)}</div>`).join('') || '<div class="seasonal-item">• No congestion recommendations available</div>'}</div></div></div><div class="dashboard-feature-grid"><div class="section-card"><div class="section-header"><h3>${icon('building', 'icon-sm')} Intranet Connectivity</h3></div><div class="analytics-list"><div class="analytics-row"><span>Intranet</span><div class="analytics-bar"><div style="width:${liveOps.intranetStatus?.isIntranet ? 100 : 35}%;"></div></div><strong>${liveOps.intranetStatus?.isIntranet ? 'Connected' : 'External'}</strong></div><div class="analytics-row"><span>Device IP</span><span></span><strong>${escapeHtml(liveOps.intranetStatus?.ip || 'Unknown')}</strong></div><div class="analytics-row"><span>Pending Sync</span><span></span><strong>${liveOps.syncStatus?.pending || liveOps.syncStatus?.pending_items || 0}</strong></div></div></div><div class="section-card"><div class="section-header"><h3>${icon('user', 'icon-sm')} Live Peers / Guests</h3></div><div class="seasonal-list">${(liveOps.peers || []).length ? liveOps.peers.slice(0, 8).map((p) => `<div class="seasonal-item">• ${escapeHtml(p.name || 'Peer')} (${escapeHtml(p.type || 'user')})${p.location ? ` @ ${Number(p.location.lat).toFixed(4)}, ${Number(p.location.lng).toFixed(4)}` : ''}</div>`).join('') : '<div class="seasonal-item">• No live peers detected in last 5 minutes.</div>'}</div></div></div><div class="section-card"><div class="section-header"><h3>${icon('note', 'icon-sm')} Feedback & Improvements (30 days)</h3></div><div class="analytics-list"><div class="analytics-row"><span>Total Feedback</span><span></span><strong>${feedbackInsights.summary?.total_feedback || 0}</strong></div><div class="analytics-row"><span>Average Rating</span><span></span><strong>${feedbackInsights.summary?.avg_rating || 0}</strong></div><div class="analytics-row"><span>Bug Reports</span><span></span><strong>${feedbackInsights.summary?.bug_reports || 0}</strong></div><div class="analytics-row"><span>Feature Requests</span><span></span><strong>${feedbackInsights.summary?.feature_requests || 0}</strong></div><div class="analytics-row"><span>Responded</span><span></span><strong>${feedbackInsights.summary?.responded_count || 0}</strong></div></div><div class="seasonal-list">${(feedbackInsights.recent || []).slice(0, 5).map((item) => `<div class="seasonal-item">• ${escapeHtml(item.category)} - ${escapeHtml(item.comment || 'No comment')} ${item.response_text ? '<span style="color:#2E7D32;">(Responded)</span>' : `<button class=\"small-btn\" onclick=\"respondToFeedbackPrompt('${item.feedback_id}')\">Respond</button>`}</div>`).join('') || '<div class="seasonal-item">• No recent feedback</div>'}</div></div>${rareAlertsHtml}<div class="admin-actions"><button class="admin-action-btn" onclick="handleMFASetup()">${icon('shield', 'icon-sm')} Configure MFA</button><button class="admin-action-btn" onclick="clearAllCache()">Clear Cache</button><button class="admin-action-btn" onclick="exportData()">Export Data</button><button class="admin-action-btn danger" onclick="resetApp()">Reset App</button></div></div>`;
>>>>>>> upstream/master
}

// =====================================================
// INTRANET DASHBOARD (HR, Announcements, Inventory)
// =====================================================
async function renderIntranetDashboard() {
    const [announcements, inventory, employees, hrStats] = await Promise.all([
        Intranet.getAnnouncements(),
        Intranet.getInventory(),
        Intranet.getEmployees(),
        Intranet.getHRStats()
    ]);
    
    const animals = await Content.getAnimals();
    return `<div class="intranet-dashboard">
        ${renderDashboardShell({
            primaryTitle: 'Intranet Highlights',
            primaryIcon: 'megaphone',
            primaryItems: (announcements || []).slice(0, 3).map((a) => ({
                title: a.title,
                match: `${a.priority || 'normal'} priority`,
                reason: a.content
            })),
            quote: '"Clear internal communication powers smooth operations."',
            seasonalTitle: `${icon('users', 'icon-sm')} HR Snapshot`,
            seasonalItems: [
                `Total staff: ${hrStats.totalStaff}`,
                `Guides on duty: ${hrStats.guidesOnDuty}`,
                `IT team: ${hrStats.itStaff}`,
                `Inventory records: ${inventory.length}`
            ],
            seasonalActionLabel: 'View Suggestions',
            animalCount: animals.length
        })}
        <div class="section-card">
            <div class="section-header"><h3>${icon('megaphone', 'icon-sm')} Internal Announcements</h3><button class="add-btn btn-primary" onclick="showAddAnnouncementModal()">${icon('plus', 'icon-sm')} Post</button></div>
            <div id="announcementsList">${announcements.map(a => `<div class="announcement-item ${a.priority}"><div class="announcement-title">${escapeHtml(a.title)}</div><div class="announcement-meta">${new Date(a.date).toLocaleDateString()} by ${a.author}</div><div class="announcement-content">${escapeHtml(a.content)}</div><button class="small-btn btn-danger" onclick="deleteAnnouncement(${a.id})">Delete</button></div>`).join('') || '<div class="empty-state">No announcements</div>'}</div>
        </div>
        
        <div class="section-card">
            <div class="section-header"><h3>${icon('box', 'icon-sm')} Inventory Management</h3><button class="add-btn btn-primary" onclick="showAddInventoryModal()">${icon('plus', 'icon-sm')} Add Item</button></div>
            <div class="inventory-list">${inventory.map(i => `<div class="inventory-item"><span><strong>${escapeHtml(i.name)}</strong> - ${i.quantity} units (${i.category})</span><button class="small-btn btn-secondary" onclick="updateInventoryQuantity(${i.id})">Update</button></div>`).join('') || '<div class="empty-state">No inventory items</div>'}</div>
        </div>
        
        <div class="section-card">
            <div class="section-header"><h3>${icon('users', 'icon-sm')} Employee Directory</h3><button class="add-btn btn-primary" onclick="showAddEmployeeModal()">${icon('plus', 'icon-sm')} Add Employee</button></div>
            <div class="employee-list">${employees.map(e => `<div class="employee-item"><div><strong>${escapeHtml(e.name)}</strong> - ${e.role}<br><small>${e.department} | Status: ${e.status}</small></div><button class="small-btn ${e.status === 'active' ? 'btn-danger' : 'btn-secondary'}" onclick="toggleEmployeeStatus(${e.id}, '${e.status}')">${e.status === 'active' ? 'Deactivate' : 'Activate'}</button></div>`).join('') || '<div class="empty-state">No employees</div>'}</div>
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
    messages.innerHTML += `<div class="rec-card"><div class="rec-info"><div class="rec-title">Assistant</div><div class="rec-reason">${escapeHtml(answer)}</div></div></div>`;
    messages.scrollTop = messages.scrollHeight;
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
    const payload = { rating, category, comment };
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

window.ackRareAlertPrompt = async function (alertId) {
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
        return `<div class="seasonal-item"><strong>${'★'.repeat(Number(item.rating || 0))}</strong> ${escapeHtml(item.category || 'general')} - ${escapeHtml(item.comment || 'No comment')} <span style="color:#6B705C;">(${date})</span></div>`;
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
    const node = document.getElementById('authFeedback');
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
        userType: 'tourist'
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
        renderView('dashboard');
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

<<<<<<< HEAD
function exportData() {
    showToast('Data exported (demo)', 'info');
=======
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
    alert('Data exported successfully.');
>>>>>>> upstream/master
}

async function resetApp() {
    if (await showConfirmDialog('Reset all data?')) {
        localStorage.clear();
        location.reload();
    }
}

<<<<<<< HEAD
function addSighting() {
    showToast('Report sighting feature coming soon', 'info');
=======
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
    }
>>>>>>> upstream/master
}

async function startTour(tourId) {
    const m = getGuideOpsManager();
    await m.startTour(tourId);
    document.getElementById('activeTourPanel').style.display = 'block';
    showToast('Tour started!', 'success');
}

async function endActiveTour() {
    const m = getGuideOpsManager();
    const result = await m.endTour(m.activeTour?.tour_session_id);
    document.getElementById('activeTourPanel').style.display = 'none';
<<<<<<< HEAD
    showToast('Tour ended', 'info');
}

async function quickSighting() {
    const animal = await showPromptDialog('Animal seen?');
    if (animal) {
        const m = new TourGuideManager();
        await m.quickSighting(animal, 1);
        showToast('Sighting recorded!', 'success');
=======
    alert('Tour ended');
    const askFeedback = confirm('Would you like to submit completion feedback now?');
    if (askFeedback) {
        renderView('profile');
    }
}

async function quickSighting() {
    const [animals, locations] = await Promise.all([API.getAnimals(), API.getLocations()]);
    const animalText = prompt(`Animal seen? (${animals.slice(0, 5).map((a) => a.name).join(', ')})`);
    if (!animalText) return;
    const count = Number(prompt('How many observed?', '1') || '1');
    const animal = animals.find((a) => String(a.name).toLowerCase().includes(animalText.toLowerCase())) || animals[0];
    const nearest = locations[0];
    if (!animal || !nearest) {
        alert('Missing seeded animal/location data.');
        return;
>>>>>>> upstream/master
    }
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
    const m = new TourGuideManager();
    const s = await m.clockIn();
    if (!s.success) await m.clockOut();
    renderView('guide_dashboard');
}

<<<<<<< HEAD
function renderAuthPortal(activeTab = 'login') {
    const isLogin = activeTab === 'login';
    const heading = isLogin ? 'Welcome Back' : 'Create Account';
    const subheading = isLogin ? 'Access your SIGTS dashboard' : 'Register for secure park access';
    const trustCopy = isLogin
        ? 'Secure access for tourists, guides, park officials, and IT managers.'
        : 'Your information is protected and reviewed according to park access rules.';

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
                <h1>Smart Park Access & Information Portal</h1>
                <p>Manage wildlife insights, guide access, tourist profiles, sightings, and secure park information from one trusted platform.</p>
                <p class="auth-side-roles">Tourists • Guides • Officials • IT Managers</p>
            </div>

            <div class="auth-side-stats" aria-label="System access highlights">
                <div class="auth-side-stat">${icon('paw', 'icon-sm')} Wildlife Records</div>
                <div class="auth-side-stat">${icon('ticket', 'icon-sm')} Guide Access</div>
                <div class="auth-side-stat">${icon('megaphone', 'icon-sm')} Park Notices</div>
                <div class="auth-side-stat">${icon('shield', 'icon-sm')} Secure Roles</div>
            </div>

            <div class="auth-side-footer">
                ${icon('shield', 'icon-sm')}
                <span>Secure access for tourists, guides, and IT managers.</span>
            </div>
        </aside>

        <main class="auth-portal-main">
            <section class="auth-card">
                <div class="auth-tabs" role="tablist">
                    <button
                        type="button"
                        class="auth-tab ${isLogin ? 'active' : ''}"
                        onclick="renderView('login')">
                        Log In
                    </button>

                    <button
                        type="button"
                        class="auth-tab ${!isLogin ? 'active' : ''}"
                        onclick="renderView('register')">
                        Create Account
                    </button>
                </div>

                <div class="auth-form-head">
                    <span class="auth-kicker">${isLogin ? 'Secure Access Portal' : 'Role Enrollment'}</span>
                    <div class="auth-role-badge">${icon('shield', 'icon-sm')} <span>Role-based login enabled</span></div>
                    <h2>${heading}</h2>
                    <p>${subheading}</p>
                </div>

                ${isLogin ? renderLoginFormOnly() : renderRegisterFormOnly()}
                <div class="auth-trust-panel">${trustCopy}</div>
            </section>
        </main>
    </div>`;
}

function renderLoginFormOnly() {
    return `<form class="auth-form" onsubmit="event.preventDefault(); handleLogin();">
        <label class="auth-field">
            <span class="auth-field-label">Email or Username</span>
            <span class="auth-input-shell">
                ${icon('mail', 'icon-sm')}
                <input 
                    type="text" 
                    id="loginUsername" 
                    class="auth-input" 
                    placeholder="Enter your email or username"
                    autocomplete="username">
            </span>
        </label>

        <label class="auth-field">
            <span class="auth-field-label">Password</span>
            <span class="auth-input-shell">
                ${icon('lock', 'icon-sm')}
                <input 
                    type="password" 
                    id="loginPassword" 
                    class="auth-input" 
                    placeholder="Enter your password"
                    autocomplete="current-password">

                <button 
                    type="button" 
                    class="auth-ghost-icon" 
                    onclick="togglePasswordVisibility('loginPassword', this)" 
                    aria-label="Show password">
                    ${icon('eye', 'icon-sm')}
                </button>
            </span>
        </label>

        <div class="auth-options-row">
            <label class="auth-check">
                <input type="checkbox" id="rememberMe" checked>
                <span class="auth-check-box">${icon('check', 'icon-sm')}</span>
                <span>Remember me</span>
            </label>

            <button type="button" class="auth-link-btn" onclick="handleForgotPassword()">
                Forgot password?
            </button>
        </div>

        <button type="submit" class="auth-primary-btn">
            ${icon('leaf', 'icon-sm')} LOGIN TO DASHBOARD
        </button>

        <div class="auth-divider-lite"><span></span><em>OR</em><span></span></div>
        <button type="button" class="auth-social-btn" onclick="showToast('Google sign-in will be connected in production.', 'info')">
            ${icon('user', 'icon-sm')} Continue with Google
        </button>
        <p class="auth-inline-cta">New here? <button type="button" class="auth-link-btn" onclick="renderView('register')">Create account</button></p>
        <div id="authFeedback" class="auth-feedback" hidden></div>
    </form>`;
}

function renderRegisterFormOnly() {
    return `<form class="auth-form auth-register-form" onsubmit="event.preventDefault(); handleRegistration();">
        <div class="auth-grid">
            <label class="auth-field">
                <span class="auth-field-label">Full Name</span>
                <span class="auth-input-shell">
                    ${icon('user', 'icon-sm')}
                    <input 
                        type="text" 
                        id="regFullName" 
                        class="auth-input" 
                        placeholder="Your full name"
                        autocomplete="name">
                </span>
            </label>

            <label class="auth-field">
                <span class="auth-field-label">Username</span>
                <span class="auth-input-shell">
                    ${icon('at', 'icon-sm')}
                    <input 
                        type="text" 
                        id="regUsername" 
                        class="auth-input" 
                        placeholder="Choose username"
                        autocomplete="username">
                </span>
            </label>
        </div>

        <label class="auth-field">
            <span class="auth-field-label">Email</span>
            <span class="auth-input-shell">
                ${icon('mail', 'icon-sm')}
                <input 
                    type="email" 
                    id="regEmail" 
                    class="auth-input" 
                    placeholder="name@example.com"
                    autocomplete="email">
            </span>
        </label>

        <div class="auth-grid">
            <label class="auth-field">
                <span class="auth-field-label">Password</span>
                <span class="auth-input-shell">
                    ${icon('lock', 'icon-sm')}
                    <input 
                        type="password" 
                        id="regPassword" 
                        class="auth-input" 
                        placeholder="Create password"
                        autocomplete="new-password">

                    <button 
                        type="button" 
                        class="auth-ghost-icon" 
                        onclick="togglePasswordVisibility('regPassword', this)" 
                        aria-label="Show password">
                        ${icon('eye', 'icon-sm')}
                    </button>
                </span>
            </label>

            <label class="auth-field">
                <span class="auth-field-label">Confirm</span>
                <span class="auth-input-shell">
                    ${icon('lock', 'icon-sm')}
                    <input 
                        type="password" 
                        id="regConfirmPassword" 
                        class="auth-input" 
                        placeholder="Repeat password"
                        autocomplete="new-password">

                    <button 
                        type="button" 
                        class="auth-ghost-icon" 
                        onclick="togglePasswordVisibility('regConfirmPassword', this)" 
                        aria-label="Show password">
                        ${icon('eye', 'icon-sm')}
                    </button>
                </span>
            </label>
        </div>

        <button type="submit" class="auth-primary-btn">
            ${icon('leaf', 'icon-sm')} CREATE SECURE ACCOUNT
        </button>
        <div id="authFeedback" class="auth-feedback" hidden></div>

        <div class="auth-secure-note">
            ${icon('shield', 'icon-md')}
            <span>Your information is secure with us.</span>
        </div>
    </form>`;
}

function renderLoginScreen() {
    return renderAuthPortal('login');
}

function renderRegisterScreen() {
    return renderAuthPortal('register');
=======
window.addTourNotePrompt = async function () {
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
    return `<div class="login-container auth-merged-screen">
        <div class="auth-merged-wrap">
            <section class="auth-merged-pane auth-merged-login ${activePanel === 'login' ? 'active' : ''}">
                <div class="auth-merged-brand">
                    <div class="auth-brand-mark">${icon('map', 'icon-md')}</div>
                    <div>
                        <div class="auth-brand-name">Bwindi SIGTS</div>
                        <div class="auth-brand-meta">Smart Information Guide Tour System</div>
                    </div>
                </div>
                <div class="auth-kicker">Welcome Back</div>
                <h1 class="auth-title">Sign In</h1>
                <p class="auth-subtitle">Continue your wildlife guide experience with your account.</p>
                <p class="auth-switch">Don't have an account? <button class="auth-link-btn" onclick="renderView('register')">Create account</button></p>
                <div class="auth-form-card">
                    <label class="auth-field">
                        <span class="auth-field-label">Email or Username</span>
                        <input type="text" id="loginUsername" class="auth-input" placeholder="Enter your email or username">
                    </label>
                    <label class="auth-field">
                        <span class="auth-field-label">Password</span>
                        <input type="password" id="loginPassword" class="auth-input" placeholder="Enter your password">
                    </label>
                    <div class="auth-merged-actions">
                        <button onclick="handleLogin()" class="auth-primary-btn">Sign In</button>
                        <button onclick="handleForgotPassword()" class="auth-merged-link">Forgot password?</button>
                    </div>
                </div>
            </section>
            <section class="auth-merged-visual" aria-hidden="true"></section>
            <section class="auth-merged-pane auth-merged-register ${activePanel === 'register' ? 'active' : ''}">
                <div class="auth-kicker">Registration</div>
                <h1 class="auth-title">Create Account</h1>
                <p class="auth-subtitle">Build your profile and unlock tours, sightings, and park tools.</p>
                <p class="auth-switch">Already a member? <button class="auth-link-btn" onclick="renderView('login')">Log in</button></p>
                <div class="auth-form-card">
                    <div class="auth-grid">
                        <label class="auth-field">
                            <span class="auth-field-label">Full Name</span>
                            <input type="text" id="regFullName" class="auth-input" placeholder="Your full name">
                        </label>
                        <label class="auth-field">
                            <span class="auth-field-label">Username</span>
                            <input type="text" id="regUsername" class="auth-input" placeholder="Choose a username">
                        </label>
                    </div>
                    <label class="auth-field">
                        <span class="auth-field-label">Email</span>
                        <input type="email" id="regEmail" class="auth-input" placeholder="name@example.com">
                    </label>
                    <label class="auth-field">
                        <span class="auth-field-label">Password</span>
                        <input type="password" id="regPassword" class="auth-input" placeholder="Create a password">
                    </label>
                    <label class="auth-field">
                        <span class="auth-field-label">Confirm Password</span>
                        <input type="password" id="regConfirmPassword" class="auth-input" placeholder="Repeat your password">
                    </label>
                    <label class="auth-field">
                        <span class="auth-field-label">Role</span>
                        <select id="regUserType" class="auth-select">
                            <option value="tourist">Tourist</option>
                            <option value="guide">Tour Guide</option>
                            <option value="it_manager">IT Manager</option>
                        </select>
                    </label>
                    <div class="auth-merged-actions">
                        <button onclick="handleRegistration()" class="auth-primary-btn">Create Account</button>
                    </div>
                </div>
            </section>
        </div>
    </div>`;
>>>>>>> upstream/master
}
async function renderView(view, options = {}) {
    const safeView = normalizeView(view);
    const shouldUpdateHash = options.updateHash === true;
    window.currentView = safeView;

    if (shouldUpdateHash) {
        const targetHash = `#${safeView}`;
        if (window.location.hash !== targetHash) {
            window.location.hash = targetHash;
        }
    }

<<<<<<< HEAD
=======
function renderLoginScreen() {
    return renderAuthMergedScreen('login');
}

function renderRegisterScreen() {
    return renderAuthMergedScreen('register');
}

async function renderView(view) {
    window.currentView = view;
>>>>>>> upstream/master
    const app = document.getElementById('app');
    if (!app) return;

    document.body.classList.toggle('auth-page', PUBLIC_VIEWS.has(safeView));
    
    if (!Auth.isAuthenticated() && !PUBLIC_VIEWS.has(safeView)) {
        navigateTo('login');
        return;
    }

    if (view !== 'map') {
        teardownLiveMap();
    }
    
    let content = '';
    switch(safeView) {
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
    if (view === 'map') {
        await initializeLiveMap();
    } else if (view === 'profile') {
        await loadRecentFeedback();
    }
}

function refreshNetworkStatusBadge() {
    const badge = document.getElementById('networkStatusBadge');
    if (!badge) return;
    const isOffline = !navigator.onLine;
    const pending = OfflineSync?.getPendingCount?.() || 0;
    badge.classList.toggle('offline', isOffline);
    badge.classList.toggle('online', !isOffline);
    badge.textContent = isOffline ? `Offline mode • ${pending} pending` : (pending ? `Online • ${pending} pending sync` : 'Online');
}

window.refreshNetworkStatusBadge = refreshNetworkStatusBadge;

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
