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
        note: '<path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4"/><path d="M9 11h6M9 15h6"/>'
    };
    const content = icons[name] || icons.info;
    return `<svg class="${classes}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${content}</svg>`;
}

function getPageTitle(view) {
    const titles = { dashboard: 'Dashboard', animals: 'Animals', map: 'Map', culture: 'Culture', sightings: 'Sightings', profile: 'Profile', info: 'Info', ai_chat: 'AI Assistant', guide_dashboard: 'Guide Dashboard', it_dashboard: 'Admin Dashboard', intranet: 'Intranet Hub' };
    return titles[view] || 'Bwindi Tour Guide';
}

function navigateTo(view) {
    window.currentView = view;
    renderView(view);
}

function renderMainLayout(content) {
    const user = Auth.getCurrentUser() || { name: 'Guest', role: 'tourist' };
    const isGuide = user?.role === 'guide' || user?.userType === 'guide';
    const isITManager = user?.role === 'it_manager' || user?.userType === 'it_manager';
    
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
    
    return `<div class="app-container"><button class="sidebar-toggle" onclick="toggleSidebar()">${icon('menu', 'icon-sm')}</button><div class="sidebar"><div class="sidebar-header"><div class="sidebar-logo"><img src="/icons/icon-192.svg" alt="SIGTS logo"></div><div class="sidebar-title">Bwindi SIGTS</div></div><div class="sidebar-profile" onclick="navigateTo('profile')"><div class="sidebar-avatar">${icon('user', 'icon-md')}</div><div class="sidebar-user-info"><div class="sidebar-user-name">${escapeHtml(user.name)}</div><div class="sidebar-user-role">${user.role || 'tourist'}</div></div></div><div class="sidebar-nav">${navItems.map(item => `<div class="nav-item-vertical ${window.currentView === item.id ? 'active' : ''}" onclick="navigateTo('${item.id}')"><div class="nav-icon-vertical">${icon(item.icon, 'icon-md')}</div><div class="nav-label-vertical">${item.label}</div></div>`).join('')}</div><div class="sidebar-logout" onclick="Auth.logout()">${icon('logout', 'icon-md')} Logout</div></div><div class="main-content" onclick="closeSidebar()"><div class="content-header"><h1>${getPageTitle(window.currentView)}</h1><div class="header-right"><button class="icon-btn" onclick="renderView('notifications')">${icon('bell', 'icon-md')}</button></div></div><div class="main-container">${content}</div></div></div>`;
}

// =====================================================
// CONTENT RENDER FUNCTIONS
// =====================================================
async function renderDashboardContent() {
    const animals = await Content.getAnimals();
    const recommendations = await AI.getRecommendations(3);
    const seasonal = await AI.getSeasonalRecommendations();
    return `<div class="quick-grid"><div class="quick-card animals" onclick="navigateTo('animals')"><div class="quick-icon">${icon('paw', 'icon-xl')}</div><div class="quick-label">Animals</div><div class="quick-count">${animals.length} species</div></div><div class="quick-card map" onclick="navigateTo('map')"><div class="quick-icon">${icon('map', 'icon-xl')}</div><div class="quick-label">Map</div></div><div class="quick-card culture" onclick="navigateTo('culture')"><div class="quick-icon">${icon('book', 'icon-xl')}</div><div class="quick-label">Culture</div></div><div class="quick-card info" onclick="navigateTo('info')"><div class="quick-icon">${icon('info', 'icon-xl')}</div><div class="quick-label">Info</div></div></div><div class="section-card"><div class="section-header"><h3>${icon('target', 'icon-sm')} AI Recommendations</h3></div><div id="recList">${recommendations.map(r => `<div class="rec-card"><div class="rec-info"><div class="rec-title">${r.name}</div><div class="rec-match">${Math.round(r.score * 100)}% match</div><div class="rec-reason">${r.reason}</div></div></div>`).join('')}</div></div><div class="section-card"><div class="section-header"><h3>${icon('leaf', 'icon-sm')} Seasonal: ${seasonal.season === 'dry' ? `${icon('sun', 'icon-sm')} Dry Season` : `${icon('rain', 'icon-sm')} Wet Season`}</h3></div><div class="seasonal-list">${seasonal.recommendations.map(a => `<div class="seasonal-item">• ${a}</div>`).join('')}</div></div>`;
}

function renderAnimalsContent() {
    return `<div class="animals-list"><div class="animal-card"><div class="animal-icon">${icon('gorilla', 'icon-xl')}</div><div class="animal-info"><div class="animal-name">Mountain Gorilla</div><div class="animal-scientific">Gorilla beringei</div><span class="animal-status status-endangered">Endangered</span></div></div><div class="animal-card"><div class="animal-icon">${icon('elephant', 'icon-xl')}</div><div class="animal-info"><div class="animal-name">African Elephant</div><div class="animal-scientific">Loxodonta africana</div><span class="animal-status status-vulnerable">Vulnerable</span></div></div><div class="animal-card"><div class="animal-icon">${icon('bird', 'icon-xl')}</div><div class="animal-info"><div class="animal-name">Great Blue Turaco</div><div class="animal-scientific">Corythaeola cristata</div><span class="animal-status status-least-concern">Least Concern</span></div></div></div>`;
}

function renderMapContent() {
    return `<div class="map-container"><div class="map-placeholder">${icon('map', 'icon-lg')} Interactive Map<br>${icon('pin', 'icon-sm')} Your location: Buhoma Gate<br>${icon('gorilla', 'icon-sm')} Gorilla sightings nearby</div><div class="map-controls"><div class="map-control">+</div><div class="map-control">-</div><div class="map-control">${icon('pin', 'icon-sm')}</div></div></div>`;
}

function renderCultureContent() {
    return `<div class="story-card featured"><div class="story-image" style="background: linear-gradient(135deg, #795548, #5D4037);"></div><div class="story-content"><span class="story-community">Batwa</span><div class="story-title">The Legend of the Misty Mountain</div><div class="story-storyteller">Elder Mukasa • 15 min</div></div></div><div class="story-card"><div class="story-content"><span class="story-community">Batwa</span><div class="story-title">How the Gorilla Learned to be Gentle</div><div class="story-storyteller">Elder Grace • 12 min</div></div></div>`;
}

function renderSightingsContent() {
    return `<div class="section-card"><div class="section-header"><h3>${icon('camera', 'icon-sm')} Recent Sightings</h3><button class="add-btn" onclick="addSighting()">${icon('plus', 'icon-sm')} Report</button></div><div class="sighting-list"><div class="sighting-item"><div class="sighting-icon">${icon('gorilla', 'icon-lg')}</div><div><div class="sighting-name">Gorilla Family</div><div class="sighting-meta">Buhoma • 10 min ago</div></div><span class="sighting-badge">${icon('paw', 'icon-sm')} 5</span></div></div></div>`;
}

function renderProfileContent() {
    const user = Auth.getCurrentUser() || { name: 'Tourist' };
    return `<div class="profile-header"><div class="profile-avatar">${icon('user', 'icon-xl')}</div><div class="profile-name">${escapeHtml(user.name)}</div><div class="profile-role">${user.role || 'tourist'}</div><div class="profile-dept">${user.department || ''}</div></div><div class="profile-menu"><div class="menu-item" onclick="downloadOfflineContent()"><div class="menu-icon">${icon('download', 'icon-md')}</div><div class="menu-text">Download Offline Content</div></div><div class="menu-item" onclick="Auth.logout()"><div class="menu-icon">${icon('logout', 'icon-md')}</div><div class="menu-text">Logout</div></div></div>`;
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
                    <div class="rec-reason">Ask about wildlife, safety, culture, routes, or weather in Bwindi.</div>
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
    return `<div class="guide-dashboard"><div class="metrics-grid"><div class="metric-card"><div class="metric-value">${dashboard.stats.totalTours}</div><div class="metric-label">Total Tours</div></div><div class="metric-card"><div class="metric-value">${dashboard.stats.totalGuests}</div><div class="metric-label">Guests Served</div></div><div class="metric-card"><div class="metric-value">${dashboard.stats.averageRating}</div><div class="metric-label">Rating</div></div></div><div class="section-card"><div class="section-header"><h3>${icon('clock', 'icon-sm')} Today's Tours</h3></div>${dashboard.today.map(t => `<div class="tour-item"><div class="tour-name">${t.route_name || 'Gorilla Trek'}</div><div class="tour-time">${new Date(t.scheduled_start).toLocaleTimeString()}</div><button class="small-btn" onclick="startTour('${t.tour_session_id}')">Start Tour</button></div>`).join('') || '<div class="empty-state">No tours today</div>'}</div><div class="shift-controls"><button class="login-btn" onclick="clockInOut()">${dashboard.activeShift ? 'Clock Out' : 'Clock In'}</button></div><div id="activeTourPanel" style="display:none"><div id="tourTimerDisplay" class="tour-timer">00:00:00</div><button onclick="quickSighting()">Log Sighting</button><button onclick="endActiveTour()">End Tour</button></div></div>`;
}

async function renderITManagerDashboard() {
    const metrics = await ITAPI.getSystemMetrics();
    const users = await ITAPI.getUserList();
    const schemaStatus = await ITAPI.getSchemaStatus();
    return `<div class="it-dashboard"><div class="welcome-card"><h2>Welcome back, ${escapeHtml(Auth.getCurrentUser()?.name)}</h2></div><div class="metrics-grid"><div class="metric-card"><div class="metric-value">${metrics.activeUsers}</div><div class="metric-label">Active Users</div></div><div class="metric-card"><div class="metric-value">${metrics.syncQueueSize}</div><div class="metric-label">Pending Sync</div></div><div class="metric-card"><div class="metric-value">${metrics.totalSightings}</div><div class="metric-label">Sightings</div></div><div class="metric-card"><div class="metric-value">${metrics.totalStaff || 0}</div><div class="metric-label">Staff Total</div></div><div class="metric-card"><div class="metric-value">${metrics.guidesOnDuty || 0}</div><div class="metric-label">Guides Active</div></div><div class="metric-card"><div class="metric-value">${metrics.inventoryItems || 0}</div><div class="metric-label">Inventory Items</div></div></div><div class="section-card"><div class="section-header"><h3>${icon('users', 'icon-sm')} Users</h3></div>${users.map(u => `<div class="user-item">${u.full_name} (${u.user_type}) - ${u.department || ''}</div>`).join('')}</div><div class="section-card"><div class="section-header"><h3>${icon('database', 'icon-sm')} Database Schema (Extended)</h3></div><div class="schema-items">${Object.entries(schemaStatus).slice(0,12).map(([name, info]) => `<div class="schema-item">${icon('chart', 'icon-sm')} ${name}: ${info.count} records</div>`).join('')}</div></div><div class="admin-actions"><button class="admin-action-btn" onclick="clearAllCache()">Clear Cache</button><button class="admin-action-btn" onclick="exportData()">Export Data</button><button class="admin-action-btn danger" onclick="resetApp()">Reset App</button></div></div>`;
}

// =====================================================
// INTRANET DASHBOARD (HR, Announcements, Inventory)
// =====================================================
async function renderIntranetDashboard() {
    const announcements = Intranet.getAnnouncements();
    const inventory = Intranet.getInventory();
    const employees = Intranet.getEmployees();
    const hrStats = Intranet.getHRStats();
    
    return `<div class="intranet-dashboard">
        <div class="metrics-grid">
            <div class="metric-card"><div class="metric-value">${hrStats.totalStaff}</div><div class="metric-label">Total Staff</div></div>
            <div class="metric-card"><div class="metric-value">${hrStats.guidesOnDuty}</div><div class="metric-label">Guides on Duty</div></div>
            <div class="metric-card"><div class="metric-value">${hrStats.itStaff}</div><div class="metric-label">IT Team</div></div>
            <div class="metric-card"><div class="metric-value">${inventory.length}</div><div class="metric-label">Inventory Items</div></div>
        </div>
        
        <div class="section-card">
            <div class="section-header"><h3>${icon('megaphone', 'icon-sm')} Internal Announcements</h3><button class="add-btn" onclick="showAddAnnouncementModal()">${icon('plus', 'icon-sm')} Post</button></div>
            <div id="announcementsList">${announcements.map(a => `<div class="announcement-item ${a.priority}"><div class="announcement-title">${escapeHtml(a.title)}</div><div class="announcement-meta">${new Date(a.date).toLocaleDateString()} by ${a.author}</div><div class="announcement-content">${escapeHtml(a.content)}</div><button class="small-btn" onclick="deleteAnnouncement(${a.id})">Delete</button></div>`).join('') || '<div class="empty-state">No announcements</div>'}</div>
        </div>
        
        <div class="section-card">
            <div class="section-header"><h3>${icon('box', 'icon-sm')} Inventory Management</h3><button class="add-btn" onclick="showAddInventoryModal()">${icon('plus', 'icon-sm')} Add Item</button></div>
            <div class="inventory-list">${inventory.map(i => `<div class="inventory-item"><span><strong>${escapeHtml(i.name)}</strong> - ${i.quantity} units (${i.category})</span><button class="small-btn" onclick="updateInventoryQuantity(${i.id})">Update</button></div>`).join('') || '<div class="empty-state">No inventory items</div>'}</div>
        </div>
        
        <div class="section-card">
            <div class="section-header"><h3>${icon('users', 'icon-sm')} Employee Directory</h3><button class="add-btn" onclick="showAddEmployeeModal()">${icon('plus', 'icon-sm')} Add Employee</button></div>
            <div class="employee-list">${employees.map(e => `<div class="employee-item"><div><strong>${escapeHtml(e.name)}</strong> - ${e.role}<br><small>${e.department} | Status: ${e.status}</small></div><button class="small-btn" onclick="toggleEmployeeStatus(${e.id}, '${e.status}')">${e.status === 'active' ? 'Deactivate' : 'Activate'}</button></div>`).join('') || '<div class="empty-state">No employees</div>'}</div>
        </div>
    </div>`;
}

// Modal handlers for Intranet
window.showAddAnnouncementModal = function() {
    const title = prompt('Announcement Title:');
    const content = prompt('Announcement Content:');
    const priority = prompt('Priority (high/medium/low):', 'medium');
    if (title && content) {
        Intranet.addAnnouncement(title, content, priority);
        renderView('intranet');
    }
};

window.deleteAnnouncement = function(id) {
    if (confirm('Delete this announcement?')) {
        Intranet.deleteAnnouncement(id);
        renderView('intranet');
    }
};

window.showAddInventoryModal = function() {
    const name = prompt('Item Name:');
    const quantity = prompt('Quantity:');
    const category = prompt('Category (Equipment/Medical/Communication):');
    if (name && quantity) {
        Intranet.addInventoryItem(name, parseInt(quantity), category);
        renderView('intranet');
    }
};

window.updateInventoryQuantity = function(id) {
    const newQty = prompt('Enter new quantity:');
    if (newQty !== null) {
        Intranet.updateInventoryItem(id, { quantity: parseInt(newQty) });
        renderView('intranet');
    }
};

window.showAddEmployeeModal = function() {
    const name = prompt('Employee Name:');
    const role = prompt('Role (e.g., Senior Guide, Ranger):');
    const department = prompt('Department:');
    if (name && role) {
        Intranet.addEmployee({ name, role, department });
        renderView('intranet');
    }
};

window.toggleEmployeeStatus = function(id, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    Intranet.updateEmployeeStatus(id, newStatus);
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
        app.innerHTML = `<div class="loading-container"><div class="spinner"></div><p>Loading Bwindi SIGTS...</p></div>`;
    }
}

function renderLoginScreen() {
    return `<div class="login-container"><div class="login-card"><div class="login-logo"><img src="/icons/icon-192.svg" alt="SIGTS logo"></div><h1 class="login-title">Welcome to Bwindi</h1><p class="login-subtitle">Smart Information Tour Guide System</p><input type="text" id="loginUsername" class="login-input" placeholder="Username"><input type="password" id="loginPassword" class="login-input" placeholder="Password"><button onclick="handleLogin()" class="login-btn">Login</button><button onclick="renderView('register')" class="register-btn">Create Account</button><div class="demo-credentials"><strong>Demo:</strong> "admin" / "password" or "tourist" / "password"</div></div></div>`;
}

function renderRegisterScreen() {
    return `<div class="login-container"><div class="login-card"><div class="login-logo">${icon('note', 'icon-xl')}</div><h1 class="login-title">Create Account</h1><input type="text" id="regFullName" placeholder="Full Name"><input type="email" id="regEmail" placeholder="Email"><input type="text" id="regUsername" placeholder="Username"><input type="password" id="regPassword" placeholder="Password"><input type="password" id="regConfirmPassword" placeholder="Confirm Password"><select id="regUserType"><option value="tourist">Tourist</option><option value="guide">Tour Guide</option><option value="it_manager">IT Manager</option></select><button onclick="handleRegistration()" class="login-btn">Register</button><button onclick="renderView('login')" class="register-btn">Back</button></div></div>`;
}

async function handleRegistration() {
    const result = await Auth.register({
        fullName: document.getElementById('regFullName')?.value,
        email: document.getElementById('regEmail')?.value,
        username: document.getElementById('regUsername')?.value,
        password: document.getElementById('regPassword')?.value,
        confirmPassword: document.getElementById('regConfirmPassword')?.value,
        userType: document.getElementById('regUserType')?.value
    });
    alert(result.message || (result.success ? 'Success! Please login.' : result.error));
    if (result.success) renderView('login');
    else renderView('register');
}

async function handleLogin() {
    const result = await Auth.login(
        document.getElementById('loginUsername')?.value,
        document.getElementById('loginPassword')?.value
    );
    if (result.success) renderView('dashboard');
    else alert('Login failed: ' + result.error);
}

async function downloadOfflineContent() {
    await Content.downloadOfflineContent();
    alert('Downloaded!');
}

function clearAllCache() {
    localStorage.clear();
    location.reload();
}

function exportData() {
    alert('Data exported (demo)');
}

function resetApp() {
    if (confirm('Reset all data?')) {
        localStorage.clear();
        location.reload();
    }
}

function addSighting() {
    alert('Report sighting feature coming soon');
}

async function startTour(tourId) {
    const m = new TourGuideManager();
    await m.startTour(tourId);
    document.getElementById('activeTourPanel').style.display = 'block';
    alert('Tour started!');
}

async function endActiveTour() {
    const m = new TourGuideManager();
    await m.endTour(m.activeTour?.tour_session_id);
    document.getElementById('activeTourPanel').style.display = 'none';
    alert('Tour ended');
}

async function quickSighting() {
    const animal = prompt('Animal seen?');
    if (animal) {
        const m = new TourGuideManager();
        await m.quickSighting(animal, 1);
        alert('Sighting recorded!');
    }
}

async function clockInOut() {
    const m = new TourGuideManager();
    const s = await m.clockIn();
    if (!s.success) await m.clockOut();
    renderView('guide_dashboard');
}

function renderLoginScreen() {
    return `<div class="login-container auth-screen auth-screen-login">
        <div class="auth-stage">
            <div class="auth-topbar">
                <div class="auth-brand">
                    <div class="auth-brand-mark">${icon('map', 'icon-md')}</div>
                    <div>
                        <div class="auth-brand-name">Bwindi SIGTS</div>
                        <div class="auth-brand-meta">Smart Information Guide Tour System</div>
                    </div>
                </div>
            </div>
            <div class="auth-panel">
                <div class="auth-copy">
                    <div class="auth-kicker">Welcome</div>
                    <h1 class="auth-title">Sign In</h1>
                    <p class="auth-subtitle">Continue your wildlife guide experience with your account.</p>
                    <p class="auth-switch">Don't have an account? <button class="auth-link-btn" onclick="renderView('register')">Create account</button></p>
                </div>
                <div class="auth-form-card">
                    <label class="auth-field">
                        <span class="auth-field-label">Email or Username</span>
                        <input type="text" id="loginUsername" class="auth-input" placeholder="Enter your username">
                    </label>
                    <label class="auth-field">
                        <span class="auth-field-label">Password</span>
                        <input type="password" id="loginPassword" class="auth-input" placeholder="Enter your password">
                    </label>
                    <div class="auth-actions">
                        <button onclick="handleLogin()" class="auth-primary-btn">Login</button>
                        <button onclick="renderView('register')" class="auth-secondary-btn">Create Account</button>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

function renderRegisterScreen() {
    return `<div class="login-container auth-screen auth-screen-register">
        <div class="auth-stage">
            <div class="auth-topbar">
                <div class="auth-brand">
                    <div class="auth-brand-mark">${icon('map', 'icon-md')}</div>
                    <div>
                        <div class="auth-brand-name">Bwindi SIGTS</div>
                        <div class="auth-brand-meta">Smart Information Guide Tour System</div>
                    </div>
                </div>
            </div>
            <div class="auth-panel">
                <div class="auth-copy">
                    <div class="auth-kicker">Registration</div>
                    <h1 class="auth-title">Create Account</h1>
                    <p class="auth-subtitle">Build your profile and unlock tours, sightings, and park tools.</p>
                    <p class="auth-switch">Already a member? <button class="auth-link-btn" onclick="renderView('login')">Log in</button></p>
                </div>
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
                    <div class="auth-actions">
                        <button onclick="handleRegistration()" class="auth-primary-btn">Create Account</button>
                        <button onclick="renderView('login')" class="auth-secondary-btn">Back to Login</button>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

async function renderView(view) {
    window.currentView = view;
    const app = document.getElementById('app');
    if (!app) return;

    document.body.classList.toggle('auth-page', view === 'login' || view === 'register');
    
    if (!Auth.isAuthenticated() && view !== 'login' && view !== 'register') {
        renderView('login');
        return;
    }
    
    let content = '';
    switch(view) {
        case 'login': app.innerHTML = renderLoginScreen(); return;
        case 'register': app.innerHTML = renderRegisterScreen(); return;
        case 'dashboard': content = await renderDashboardContent(); break;
        case 'animals': content = renderAnimalsContent(); break;
        case 'map': content = renderMapContent(); break;
        case 'culture': content = renderCultureContent(); break;
        case 'sightings': content = renderSightingsContent(); break;
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
