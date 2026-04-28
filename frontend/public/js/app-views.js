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
        note: '<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4"/><path d="M9 11h6M9 15h6"/>',
        mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
        lock: '<rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
        eye: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
        at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
        check: '<path d="M20 6L9 17l-5-5"/>',
        arrowRight: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
        chevronDown: '<path d="M6 9l6 6 6-6"/>',
        sparkles: '<path d="M12 3l1.6 4.3L18 9l-4.4 1.7L12 15l-1.6-4.3L6 9l4.4-1.7z"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z"/><path d="M5 14l.7 1.8L8 16.5l-2.3.7L5 19l-.7-1.8L2 16.5l2.3-.7z"/>'
    };
    const content = icons[name] || icons.info;
    return `<svg class="${classes}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${content}</svg>`;
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

function renderMainLayout(content) {
    const user = Auth.getCurrentUser() || { name: 'Guest', role: 'tourist' };
    const isGuide = user?.role === 'guide' || user?.userType === 'guide';
    const isITManager = user?.role === 'it_manager' || user?.userType === 'it_manager';
    const roleLabel = formatRoleName(user.role || user.userType || 'tourist');
    
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
            </div>
        </div>`).join('')}</div>`;
}

function renderMapContent() {
    return `<div class="map-container"><div class="map-placeholder">${icon('map', 'icon-lg')} Interactive Map<br>${icon('pin', 'icon-sm')} Your location: Buhoma Gate<br>${icon('gorilla', 'icon-sm')} Gorilla sightings nearby</div><div class="map-controls"><div class="map-control">+</div><div class="map-control">-</div><div class="map-control">${icon('pin', 'icon-sm')}</div></div></div>`;
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
            </div>
        </div>
        ${secondary.map(story => `
            <div class="story-card">
                <div class="story-content">
                    <span class="story-community">${escapeHtml(story.community || 'Community story')}</span>
                    <div class="story-title">${escapeHtml(story.title_en || story.title_local || 'Untitled story')}</div>
                    <div class="story-storyteller">${escapeHtml(story.storyteller_name || 'Unknown storyteller')}${story.duration ? ` • ${story.duration} min` : ''}</div>
                </div>
            </div>`).join('')}`;
}

async function renderSightingsContent() {
    const sightings = await API.getRecentSightings(10);
    return `<div class="section-card"><div class="section-header"><h3>${icon('camera', 'icon-sm')} Recent Sightings</h3><button class="add-btn btn-primary" onclick="addSighting()">${icon('plus', 'icon-sm')} Report</button></div><div class="sighting-list">${sightings.length ? sightings.map(sighting => `
        <div class="sighting-item">
            <div class="sighting-icon">${icon(getAnimalIconName(sighting.animal_name), 'icon-lg')}</div>
            <div>
                <div class="sighting-name">${escapeHtml(sighting.animal_name || 'Wildlife sighting')}</div>
                <div class="sighting-meta">${escapeHtml(sighting.location_name || 'Unknown location')} • ${new Date(sighting.timestamp).toLocaleString()}</div>
            </div>
            <span class="sighting-badge">${icon('paw', 'icon-sm')} ${sighting.number_observed || 1}</span>
        </div>`).join('') : '<div class="empty-state">No verified sightings available yet.</div>'}</div></div>`;
}

function renderProfileContent() {
    const user = Auth.getCurrentUser() || { name: 'Tourist' };
    const isITManager = user?.role === 'it_manager' || user?.userType === 'it_manager';
    return `<div class="profile-header"><div class="profile-avatar">${icon('user', 'icon-xl')}</div><div class="profile-name">${escapeHtml(user.name)}</div><div class="profile-role">${user.role || 'tourist'}</div><div class="profile-dept">${user.department || ''}</div></div><div class="profile-menu"><div class="menu-item" onclick="downloadOfflineContent()"><div class="menu-icon">${icon('download', 'icon-md')}</div><div class="menu-text">Download Offline Content</div></div>${isITManager ? `<div class="menu-item" onclick="handleMFASetup()"><div class="menu-icon">${icon('shield', 'icon-md')}</div><div class="menu-text">Configure MFA</div></div>` : ''}<div class="menu-item" onclick="Auth.logout()"><div class="menu-icon">${icon('logout', 'icon-md')}</div><div class="menu-text">Logout</div></div></div>`;
}

function renderInfoContent() {
    return `<div class="section-card"><div class="section-header"><h3>${icon('clock', 'icon-sm')} Opening Hours</h3></div><div style="padding:16px;">Park: 6:00 AM - 7:00 PM</div></div><div class="section-card"><div class="section-header"><h3>${icon('phone', 'icon-sm')} Emergency</h3></div><div style="padding:16px;">${icon('shield', 'icon-sm')} Rangers: +256-77-XXX-XXXX</div></div>`;
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
    const guideManager = new TourGuideManager();
    const dashboard = await guideManager.getGuideDashboard();
    return `<div class="guide-dashboard"><div class="metrics-grid"><div class="metric-card"><div class="metric-value">${dashboard.stats.totalTours}</div><div class="metric-label">Total Tours</div></div><div class="metric-card"><div class="metric-value">${dashboard.stats.totalGuests}</div><div class="metric-label">Guests Served</div></div><div class="metric-card"><div class="metric-value">${dashboard.stats.averageRating}</div><div class="metric-label">Rating</div></div></div><div class="section-card"><div class="section-header"><h3>${icon('clock', 'icon-sm')} Today's Tours</h3></div>${dashboard.today.map(t => `<div class="tour-item"><div class="tour-name">${t.route_name || 'Gorilla Trek'}</div><div class="tour-time">${new Date(t.scheduled_start).toLocaleTimeString()}</div><button class="small-btn btn-secondary" onclick="startTour('${t.tour_session_id}')">Start Tour</button></div>`).join('') || '<div class="empty-state">No tours today</div>'}</div><div class="shift-controls"><button class="login-btn btn-primary" onclick="clockInOut()">${dashboard.activeShift ? 'Clock Out' : 'Clock In'}</button></div><div id="activeTourPanel" style="display:none"><div id="tourTimerDisplay" class="tour-timer">00:00:00</div><button class="small-btn btn-secondary" onclick="quickSighting()">Log Sighting</button><button class="small-btn btn-danger" onclick="endActiveTour()">End Tour</button></div></div>`;
}

async function renderITManagerDashboard() {
    const metrics = await ITAPI.getSystemMetrics();
    const users = await ITAPI.getUserList();
    const schemaStatus = await ITAPI.getSchemaStatus();
    return `<div class="it-dashboard"><div class="welcome-card"><h2>Welcome back, ${escapeHtml(Auth.getCurrentUser()?.name)}</h2></div><div class="metrics-grid"><div class="metric-card"><div class="metric-value">${metrics.activeUsers}</div><div class="metric-label">Active Users</div></div><div class="metric-card"><div class="metric-value">${metrics.syncQueueSize}</div><div class="metric-label">Pending Sync</div></div><div class="metric-card"><div class="metric-value">${metrics.totalSightings}</div><div class="metric-label">Sightings</div></div><div class="metric-card"><div class="metric-value">${metrics.totalStaff || 0}</div><div class="metric-label">Staff Total</div></div><div class="metric-card"><div class="metric-value">${metrics.guidesOnDuty || 0}</div><div class="metric-label">Guides Active</div></div><div class="metric-card"><div class="metric-value">${metrics.inventoryItems || 0}</div><div class="metric-label">Inventory Items</div></div></div><div class="section-card"><div class="section-header"><h3>${icon('users', 'icon-sm')} Users</h3></div>${users.map(u => `<div class="user-item">${u.full_name} (${u.user_type}) - ${u.department || ''}</div>`).join('')}</div><div class="section-card"><div class="section-header"><h3>${icon('database', 'icon-sm')} Database Schema (Extended)</h3></div><div class="schema-items">${Object.entries(schemaStatus).slice(0,12).map(([name, info]) => `<div class="schema-item">${icon('chart', 'icon-sm')} ${name}: ${info.count} records</div>`).join('')}</div></div><div class="admin-actions"><button class="admin-action-btn btn-primary" onclick="handleMFASetup()">${icon('shield', 'icon-sm')} Configure MFA</button><button class="admin-action-btn btn-secondary" onclick="clearAllCache()">Clear Cache</button><button class="admin-action-btn btn-secondary" onclick="exportData()">Export Data</button><button class="admin-action-btn danger btn-danger" onclick="resetApp()">Reset App</button></div></div>`;
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
    
    return `<div class="intranet-dashboard">
        <div class="metrics-grid">
            <div class="metric-card"><div class="metric-value">${hrStats.totalStaff}</div><div class="metric-label">Total Staff</div></div>
            <div class="metric-card"><div class="metric-value">${hrStats.guidesOnDuty}</div><div class="metric-label">Guides on Duty</div></div>
            <div class="metric-card"><div class="metric-value">${hrStats.itStaff}</div><div class="metric-label">IT Team</div></div>
            <div class="metric-card"><div class="metric-value">${inventory.length}</div><div class="metric-label">Inventory Items</div></div>
        </div>
        
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

function exportData() {
    showToast('Data exported (demo)', 'info');
}

async function resetApp() {
    if (await showConfirmDialog('Reset all data?')) {
        localStorage.clear();
        location.reload();
    }
}

function addSighting() {
    showToast('Report sighting feature coming soon', 'info');
}

async function startTour(tourId) {
    const m = new TourGuideManager();
    await m.startTour(tourId);
    document.getElementById('activeTourPanel').style.display = 'block';
    showToast('Tour started!', 'success');
}

async function endActiveTour() {
    const m = new TourGuideManager();
    await m.endTour(m.activeTour?.tour_session_id);
    document.getElementById('activeTourPanel').style.display = 'none';
    showToast('Tour ended', 'info');
}

async function quickSighting() {
    const animal = await showPromptDialog('Animal seen?');
    if (animal) {
        const m = new TourGuideManager();
        await m.quickSighting(animal, 1);
        showToast('Sighting recorded!', 'success');
    }
}

async function clockInOut() {
    const m = new TourGuideManager();
    const s = await m.clockIn();
    if (!s.success) await m.clockOut();
    renderView('guide_dashboard');
}

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

    const app = document.getElementById('app');
    if (!app) return;

    document.body.classList.toggle('auth-page', PUBLIC_VIEWS.has(safeView));
    
    if (!Auth.isAuthenticated() && !PUBLIC_VIEWS.has(safeView)) {
        navigateTo('login');
        return;
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
}
