/** Drawer + hamburger layout matches `styles.css` `@media (max-width: …)`. */
const SIGTS_NAV_DRAWER_MAX_PX = 960;

function syncSidebarToggleA11y() {
    const sidebar = document.querySelector('.sidebar');
    const btn = document.querySelector('.sidebar-toggle');
    if (sidebar && btn) {
        const open = sidebar.classList.contains('open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        btn.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    }
    syncNavDrawerBodyLock();
}

function syncNavDrawerBodyLock() {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) {
        document.body.classList.remove('sigts-nav-drawer-open');
        return;
    }
    const open = sidebar.classList.contains('open');
    const drawer = window.innerWidth <= SIGTS_NAV_DRAWER_MAX_PX;
    document.body.classList.toggle('sigts-nav-drawer-open', Boolean(open && drawer));
}

function toggleSidebar() {
    document.querySelector('.sidebar')?.classList.toggle('open');
    syncSidebarToggleA11y();
}

function closeSidebar() {
    if (window.innerWidth <= SIGTS_NAV_DRAWER_MAX_PX) document.querySelector('.sidebar')?.classList.remove('open');
    syncSidebarToggleA11y();
}

function escapeHtml(input) {
    if (input == null || input === '') return '';
    const str = typeof input === 'string' ? input : String(input);
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m] || m));
}

function buildTourHelpMetaHtml(meta) {
    if (!meta || typeof meta !== 'object') return '';
    const parts = [];
    if (Array.isArray(meta.sources) && meta.sources.length) {
        parts.push(
            `<div class="ai-chat-sources"><strong>Sources</strong><ul class="ai-chat-sources-ul">${meta.sources.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul></div>`
        );
    }
    if (meta.time_context) {
        parts.push(`<p class="ai-chat-timectx"><strong>Time / context</strong> ${escapeHtml(meta.time_context)}</p>`);
    }
    if (meta.voice_transcript) {
        parts.push(`<p class="ai-chat-voice"><strong>Voice transcript</strong> ${escapeHtml(meta.voice_transcript)}</p>`);
    }
    if (meta.nlp_mode) {
        const nm = String(meta.nlp_mode);
        const readable =
            nm === 'rule_kb_v1'
                ? 'Bwindi rules + curated facts (consistent when offline)'
                : nm === 'llm_grounded_v1'
                  ? 'AI assistant grounded on SIGTS FAQs, safety copy, guides, themes & species rows'
                  : nm === 'rule_kb_v1_fallback'
                    ? 'Rules + curated facts (API mode unavailable — same as offline backup)'
                    : nm;
        parts.push(`<p class="ai-chat-nlp"><span class="ui-modal-muted">How answers are built</span> ${escapeHtml(readable)}</p>`);
    }
    if (meta.local_fallback) {
        parts.push('<p class="ai-chat-offline-flag">Offline AI mode: cached rules and catalogue on this device.</p>');
    }
    return parts.length ? `<div class="ai-chat-meta-block">${parts.join('')}</div>` : '';
}

function formatTourHelpAnswerHtml(rawText) {
    const text = String(rawText || '').replace(/\r\n/g, '\n').trim();
    if (!text) return '<p>No response available.</p>';

    const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
    const htmlBlocks = [];

    for (const block of blocks) {
        const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
        if (!lines.length) continue;

        const bulletLines = lines.filter((line) => /^[-*•]\s+/.test(line));
        const numberedLines = lines.filter((line) => /^\d+[.)]\s+/.test(line));

        if (bulletLines.length === lines.length) {
            const items = lines
                .map((line) => line.replace(/^[-*•]\s+/, ''))
                .map((line) => `<li>${escapeHtml(line)}</li>`)
                .join('');
            htmlBlocks.push(`<ul>${items}</ul>`);
            continue;
        }

        if (numberedLines.length === lines.length) {
            const items = lines
                .map((line) => line.replace(/^\d+[.)]\s+/, ''))
                .map((line) => `<li>${escapeHtml(line)}</li>`)
                .join('');
            htmlBlocks.push(`<ol>${items}</ol>`);
            continue;
        }

        htmlBlocks.push(`<p>${escapeHtml(lines.join(' '))}</p>`);
    }

    return htmlBlocks.join('');
}

/** Blend server/local rule answers into a normal chatbot-style voice; scope stays Bwindi-only. */
function formatBwindiChatAssistantPresentation(rawAnswer) {
    const a = String(rawAnswer || '').replace(/\r\n/g, '\n').trim();
    if (!a) {
        return "I didn't get a reply from the assistant—try a short question about Bwindi trekking, wildlife, maps, culture, permits in general terms, safety, or packing.";
    }
    const outOfScope =
        /I.m specialised for visits to Bwindi Impenetrable National Park through SIGTS:/i.test(a) ||
        /I can only answer SIGTS\/Bwindi topics/i.test(a) ||
        /I chat about Bwindi Impenetrable National Park only/i.test(a) ||
        /Tour help in SIGTS is limited/i.test(a) ||
        /^Please enter a question\.$/i.test(a);
    if (outOfScope) return a;
    if (/\b(ranger|guide|UWA)\b.*\b(always|first|override)\b/i.test(a) || /\bcomes first on the trail\b/i.test(a)) {
        return a;
    }
    return `${a}\n\n— On the trail, your ranger, guide, and posted UWA rules always override anything I say here.`;
}

const SIGTS_CHAT_HISTORY_KEY = 'sigts_bwindi_chat_history_v1';
const SIGTS_CHAT_HISTORY_MAX_TURNS = 36;

function readSigtsChatTurns() {
    try {
        const raw = localStorage.getItem(SIGTS_CHAT_HISTORY_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

function writeSigtsChatTurns(turns) {
    try {
        localStorage.setItem(SIGTS_CHAT_HISTORY_KEY, JSON.stringify(turns));
    } catch (_) {
        /**/
    }
}

function clearSigtsChatHistoryStorage() {
    try {
        localStorage.removeItem(SIGTS_CHAT_HISTORY_KEY);
    } catch (_) {
        /**/
    }
}

function slimSigtsChatMetaForStorage(meta) {
    if (!meta || typeof meta !== 'object') return {};
    const out = {};
    if (meta.local_fallback != null) out.local_fallback = meta.local_fallback;
    if (meta.offline != null) out.offline = meta.offline;
    if (Array.isArray(meta.sources)) out.sources = meta.sources.slice(0, 8);
    if (meta.location_name) out.location_name = String(meta.location_name).slice(0, 200);
    if (meta.nlp_mode) out.nlp_mode = String(meta.nlp_mode).slice(0, 48);
    if (meta.history_turns_client != null) out.history_turns_client = meta.history_turns_client;
    if (meta.time_context) out.time_context = String(meta.time_context).slice(0, 280);
    if (meta.response_time_ms != null) out.response_time_ms = meta.response_time_ms;
    return out;
}

function sigtsPriorTurnsToApiHistory(priorTurns) {
    const hist = [];
    for (const t of priorTurns) {
        const u = String(t?.user || '').trim().slice(0, 2000);
        const a = String(t?.answerRaw || '').trim().slice(0, 2000);
        if (!u) continue;
        hist.push({ role: 'user', text: u });
        if (a) hist.push({ role: 'assistant', text: a });
    }
    return hist.slice(-24);
}

function renderSigtsStoredTurnHtml(turn) {
    const presented = formatBwindiChatAssistantPresentation(String(turn?.answerRaw || ''));
    const formattedAnswer = formatTourHelpAnswerHtml(presented);
    const metaBlock = buildTourHelpMetaHtml(turn.meta && typeof turn.meta === 'object' ? turn.meta : {});
    return `<div class="ai-chat-turn ai-chat-turn--user" role="article"><div class="ai-chat-bubble ai-chat-bubble--user"><div class="ai-chat-bubble-text">${escapeHtml(
        String(turn?.user || '')
    )}</div></div></div><div class="ai-chat-turn ai-chat-turn--assistant" role="article"><span class="ai-chat-turn-label">Bwindi assistant</span><div class="ai-chat-bubble ai-chat-bubble--assistant"><div class="ai-chat-bubble-text ai-chat-response-block">${formattedAnswer}</div></div>${metaBlock}</div>`;
}

function getSigtsChatInitialMessagesHtml() {
    const turns = readSigtsChatTurns().filter((t) => t && typeof t.user === 'string');
    if (!turns.length) return getSigtsChatWelcomeHtml();
    const banner = `<div class="ai-chat-history-banner"><div class="ai-chat-history-banner-inner"><span class="ai-chat-history-banner-title">${icon('clock', 'icon-sm')} Chat history</span> <span class="ui-modal-muted">${turns.length} exchange${
        turns.length === 1 ? '' : 's'
    } saved on this device.</span> <button type="button" class="small-btn ghost-btn" onclick="clearSigtsChatThread()">Start fresh</button></div></div>`;
    return `${banner}${turns.map(renderSigtsStoredTurnHtml).join('')}`;
}

function getSigtsChatWelcomeHtml() {
    const starters = [
        'What should I wear for a muddy gorilla trek in Bwindi?',
        'What is the usual visitor distance rule around mountain gorillas?',
        'How is Buhoma different from Rushaga for a first-time visitor?',
        'What should I carry for rain and cold under the canopy?',
        'Where can I read Batwa-linked cultural stories in SIGTS?',
        'What mammals besides gorillas do people sometimes discuss for Bwindi?'
    ];
    const chips = starters
        .map(
            (s) =>
                `<button type="button" class="sigts-chat-starter" onclick="sigtsChatQuickAsk(${JSON.stringify(s)})">${escapeHtml(s)}</button>`
        )
        .join('');
    return `<div class="ai-chat-welcome-wrap">
        <div class="ai-chat-turn ai-chat-turn--assistant ai-chat-turn--welcome">
            <span class="ai-chat-turn-label">Bwindi assistant</span>
            <div class="ai-chat-bubble ai-chat-bubble--assistant">
                <div class="ai-chat-bubble-text"><p>${escapeHtml(
                    "Hi — I’m SIGTS’s Bwindi-focused assistant. Ask about gorilla visits, gates and sectors (Buhoma, Ruhija, Rushaga, Nkuringo), wildlife & birds in plain visitor language, etiquette, trekking fitness, Cultural narratives in the Culture tab, map POIs synced to this phone, FAQs, permits in general wording (confirm prices with UWA), or safety basics."
                )}</p><p>${escapeHtml(
                    'I’m not a doctor, lawyer, or live dispatch—emergencies go to your guide and official park channels. Offline, I use the same rule pack as when you’re online.'
                )}</p></div>
            </div>
        </div>
        <div class="ai-chat-starters" aria-label="Suggested questions"><span class="sigts-chat-starters-title">Try asking</span><div class="sigts-chat-starters-row">${chips}</div></div>
    </div>`;
}

const SIGTS_MIC_MAX_TRANSCRIPT_CHARS = 320;
const SIGTS_MIC_MAX_STARTS_PER_MINUTE = 6;
const SIGTS_MIC_CAPTURE_TIMEOUT_MS = 15000;

function sanitizeVoiceTranscript(raw) {
    const text = String(raw || '')
        .normalize('NFKC')
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!text) return '';
    return text.slice(0, SIGTS_MIC_MAX_TRANSCRIPT_CHARS);
}

function setTourHelpMicButtonState(listening) {
    const btn = document.getElementById('aiChatMicBtn');
    if (!btn) return;
    btn.disabled = Boolean(listening);
    btn.setAttribute('aria-busy', listening ? 'true' : 'false');
    btn.title = listening
        ? 'Listening... speak clearly and wait for capture'
        : 'Speak your question (browser Speech Recognition)';
}

function recordTourHelpMicStartAndCheckLimit() {
    const now = Date.now();
    const bucket = Array.isArray(window.__sigtsMicStartTimes) ? window.__sigtsMicStartTimes : [];
    const recent = bucket.filter((ts) => now - Number(ts) <= 60000);
    recent.push(now);
    window.__sigtsMicStartTimes = recent;
    return recent.length <= SIGTS_MIC_MAX_STARTS_PER_MINUTE;
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
        activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
        building: '<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 10h1.8M9 13.5h1.8M13.2 10H15M13.2 13.5H15"/><path d="M10.5 21v-4h3v4"/>',
        logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
        bell: '<path d="M15 17H5l1.5-2v-4a5.5 5.5 0 1 1 11 0v4L19 17z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
        info: '<circle cx="12" cy="12" r="9"/><path d="M12 10v6"/><circle cx="12" cy="7" r="1"/>',
        target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1.5"/>',
        feather: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
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
        eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>',
        eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M1 1l22 22"/>',
        key: '<circle cx="7.5" cy="12" r="3.5"/><path d="M11 12h10"/><path d="M18 12v3"/><path d="M15 12v2"/>',
        userPlus: '<circle cx="10" cy="8" r="4"/><path d="M3 21a7 7 0 0 1 14 0"/><path d="M19 8v6M16 11h6"/>',
        smile: '<circle cx="12" cy="12" r="9"/><path d="M8 10h.01M16 10h.01"/><path d="M8 15c1.2 1.2 2.3 1.8 4 1.8s2.8-.6 4-1.8"/>',
        bookmark: '<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
        chevronRight: '<polyline points="9 18 15 12 9 6"/>',
        mic: '<path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v4a3 3 0 0 0 3 3z"/><path d="M19 11a7 7 0 0 1-14 0"/><path d="M12 19v3"/><path d="M9 21h6"/>',
        search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
        x: '<path d="M6 18L18 6M6 6l12 12"/>',
        trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1v2"/>',
        edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
        message: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>',
        check: '<polyline points="20 6 9 17 4 12"/>'
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
    const titles = {
        dashboard: 'Home',
        animals: 'Animals',
        map: 'Map',
        culture: 'Culture',
        sightings: 'Sightings',
        saved: 'Saved',
        profile: 'Profile',
        info: 'Info',
        ai_chat: 'Bwindi assistant',
        guide_dashboard: 'Guide Dashboard',
        it_dashboard: 'Admin Dashboard',
        it_predictive_analytics: 'Predictive Analytics',
        it_tour_assignments: 'Tour Session Assignments',
        intranet: 'Intranet Hub'
    };
    return titles[view] || 'SIGTS Platform';
}

function getPageSubtitle(view) {
    const subtitles = {
        dashboard: "Search, browse categories, and pick up saved species or places.",
        saved: 'Bookmarks from your visits — tap to reopen details.',
        guide_dashboard: 'Track tours, guests, and active shifts.',
        it_dashboard: 'Monitor users, sync status, and platform health.',
        it_predictive_analytics: 'Historical signals, forecasts, exports, and schedules for park operations.',
        it_tour_assignments: 'Assign and manage guide tour sessions.',
        intranet: 'Manage staff communication and operations.',
        ai_chat: 'Chat-style help for Bwindi Impenetrable National Park only — not generic travel or medical advice.'
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
    'saved',
    'profile',
    'info',
    'ai_chat',
    'guide_dashboard',
    'it_dashboard',
    'it_predictive_analytics',
    'it_tour_assignments',
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
    'dashboard', 'animals', 'map', 'culture', 'sightings', 'saved', 'profile', 'info', 'ai_chat'
]);

/** Temporary guest sessions: browse-only core park content (3.1.1.1). */
const GUEST_ALLOWED_VIEWS = new Set([
    'dashboard', 'animals', 'map', 'culture', 'info', 'ai_chat', 'profile'
]);

/** Whether the given role may open `view` (excludes login/register). */
function canUserAccessView(role, view, user = null) {
    if (PUBLIC_VIEWS.has(view)) return true;
    if (user?.isGuest && !GUEST_ALLOWED_VIEWS.has(view)) return false;
    if (view === 'it_dashboard' || view === 'it_predictive_analytics' || view === 'it_tour_assignments' || view === 'intranet') return role === 'it_manager';
    if (view === 'guide_dashboard') return role === 'guide';
    return SHARED_APP_VIEWS.has(view);
}

/** Default home screen after login / app open when no deep link hash is set. */
function getLandingViewForUser(user) {
    if (user?.isGuest) return 'dashboard';
    const role = String(user?.userType || user?.role || user?.user_type || 'tourist').trim();
    if (role === 'guide') return 'guide_dashboard';
    if (role === 'it_manager') return 'it_dashboard';
    return 'dashboard';
}

function navigateTo(view, options = {}) {
    const targetView = normalizeView(view);
    try {
        if (typeof AI !== 'undefined' && AI.recordContentView) {
            AI.recordContentView('tab', targetView, [targetView]);
        }
    } catch (_) {
        /**/
    }
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
let guideDashboardRefreshTimer = null;
let assignmentDashboardRefreshTimer = null;
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
    const accessContext = AppState?.accessContext || {};
    const intranetState = accessContext.isIntranet;
    const requiresIntranet = role === 'tourist' || role === 'guide';
    const backendInside = typeof accessContext.insideBoundary === 'boolean' ? accessContext.insideBoundary : null;
    const insidePark = boundaryMode === 'auto'
        ? (backendInside === null ? (liveInside === null ? true : liveInside) : backendInside)
        : boundaryMode === 'inside';
    let online = networkMode === 'auto'
        ? (typeof intranetState === 'boolean' ? intranetState : navigator.onLine)
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
        requiresIntranet,
        policyMode: accessContext.mode || 'demo',
        decisionSource: accessContext.source || 'live',
        decisionReason: accessContext.reason || ''
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
            <span class="park-chip neutral">Mode: ${escapeHtml(state.policyMode)}</span>
            <span class="park-chip neutral">Source: ${escapeHtml(state.decisionSource)}</span>
            <span class="park-chip ${hasCoords ? '' : 'neutral'}">Lat: ${escapeHtml(latText)}${hasCoords ? ` • Lng: ${escapeHtml(lngText)}` : ''}</span>
        </div>
        <div class="park-access-note">Decision: ${escapeHtml(state.decisionReason || 'No policy reason provided')}</div>
        ${state.policyMode === 'demo' ? `<details class="park-access-sim">
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
        </details>` : '<div class="park-access-note">Simulation controls are disabled in production mode.</div>'}
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

/** IT dashboard: directory rows with per-account deactivation (server-backed). */
function renderItAccountDirectory(users, currentUserId) {
    if (!Array.isArray(users) || !users.length) {
        return `<div class="section-card"><div class="section-header"><h3>${icon('users', 'icon-sm')} Account directory</h3></div><div class="seasonal-list"><div class="seasonal-item">No accounts returned. Use a live IT session and check connectivity.</div></div></div>`;
    }
    const rows = users.slice(0, 100).map((u) => {
        const id = escAttrBareUuid(u.user_id);
        const active = u.is_active !== false;
        const self = String(u.user_id || '') === String(currentUserId || '');
        const action = active
            ? `<button type="button" class="small-btn danger" onclick="adminDeactivateAccountPrompt('${id}'${self ? ',true' : ''})">Deactivate</button>`
            : '<span class="status-badge neutral">Inactive</span>';
        return `<div class="seasonal-item" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between;"><div><strong>${escapeHtml(u.username || '')}</strong> <span class="ui-modal-muted">${escapeHtml(u.user_type || '')}</span>${self ? ' <span class="status-badge warning">You</span>' : ''}<br><small>${escapeHtml(u.email || '')}</small></div><div>${action}</div></div>`;
    }).join('');
    return `<div class="section-card"><div class="section-header"><h3>${icon('users', 'icon-sm')} Account directory</h3></div><p class="animals-page-blurb" style="margin:0 0 8px;">Deactivate blocks sign-in until an IT manager sets the account active again (user maintenance).</p><div class="seasonal-list" style="max-height:320px;overflow:auto;">${rows}</div></div>`;
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

function stopGuideDashboardRefresh() {
    if (guideDashboardRefreshTimer) {
        clearInterval(guideDashboardRefreshTimer);
        guideDashboardRefreshTimer = null;
    }
}

function startGuideDashboardRefresh() {
    stopGuideDashboardRefresh();
    guideDashboardRefreshTimer = setInterval(() => {
        if (window.currentView === 'guide_dashboard') {
            renderView('guide_dashboard', { updateHash: false, suppressAccessToast: true });
        }
    }, 30000);
}

function stopAssignmentDashboardRefresh() {
    if (assignmentDashboardRefreshTimer) {
        clearInterval(assignmentDashboardRefreshTimer);
        assignmentDashboardRefreshTimer = null;
    }
}

function startAssignmentDashboardRefresh() {
    stopAssignmentDashboardRefresh();
    assignmentDashboardRefreshTimer = setInterval(() => {
        if (window.currentView === 'it_tour_assignments') {
            renderView('it_tour_assignments', { updateHash: false, suppressAccessToast: true });
        }
    }, 30000);
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

/** Bottom tab bar on narrow screens for tourists/guides-without-extra-roles pattern (park visitor UX). */
function renderMobileTouristTabbar() {
    const user = Auth.getCurrentUser() || {};
    const isGuest = Boolean(user.isGuest);
    const tabs = isGuest
        ? [
            ['dashboard', 'home', 'Home'],
            ['animals', 'paw', 'Species'],
            ['map', 'map', 'Map'],
            ['profile', 'user', 'You']
        ]
        : [
            ['dashboard', 'home', 'Home'],
            ['animals', 'paw', 'Species'],
            ['map', 'map', 'Map'],
            ['saved', 'bookmark', 'Saved'],
            ['profile', 'user', 'You']
        ];
    const btns = tabs
        .map(
            ([id, ic, lab]) =>
                `<button type="button" class="sigts-mobile-tab ${window.currentView === id ? 'is-active' : ''}" onclick="navigateTo('${id}')">${icon(
                    ic,
                    'icon-md'
                )}<span>${escapeHtml(lab)}</span></button>`
        )
        .join('');
    return `<nav class="sigts-mobile-tabbar" aria-label="Quick navigation">${btns}</nav>`;
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
        { id: 'ai_chat', icon: 'feather', label: 'Chat' },
        { id: 'sightings', icon: 'camera', label: 'Sightings' },
        { id: 'saved', icon: 'bookmark', label: 'Saved' },
        { id: 'profile', icon: 'user', label: 'Profile' }
    ];
    if (user?.isGuest) {
        navItems = navItems.filter((item) => GUEST_ALLOWED_VIEWS.has(item.id));
    }
    if (isGuide) navItems.push({ id: 'guide_dashboard', icon: 'ticket', label: 'Guide' });
    if (isITManager) {
        navItems.push({ id: 'it_dashboard', icon: 'chart', label: 'Admin' });
        navItems.push({ id: 'it_predictive_analytics', icon: 'activity', label: 'Analytics' });
        navItems.push({ id: 'it_tour_assignments', icon: 'clock', label: 'Assignments' });
        navItems.push({ id: 'intranet', icon: 'building', label: 'Intranet' });
    }
    
    const accessState = getParkAccessState();
    const isOffline = !accessState.online;
    const pending = OfflineSync?.getPendingCount?.() || 0;
    const statusText = isOffline ? `Offline mode • ${pending} pending` : (pending ? `Online • ${pending} pending sync` : 'Online');
    const mainContainerClass =
        window.currentView === 'ai_chat' ? 'main-container main-container--tour-help' : 'main-container';
    const mobileTabbar = !isGuide && !isITManager ? renderMobileTouristTabbar() : '';
    return `<div class="app-container"><div id="app-sidebar" class="sidebar"><div class="sidebar-header"><div class="sidebar-brand"><div class="sidebar-logo"><img src="/icons/icon-192.svg" alt="SIGTS logo"></div><div class="sidebar-title">Bwindi SIGTS</div></div></div><div class="sidebar-nav">${navItems.map(item => `<div class="nav-item-vertical ${window.currentView === item.id ? 'active' : ''}" onclick="navigateTo('${item.id}'); closeSidebar();"><div class="nav-icon-vertical">${icon(item.icon, 'icon-md')}</div><div class="nav-label-vertical">${item.label}</div></div>`).join('')}</div><div class="sidebar-logout" onclick="Auth.logout(); closeSidebar();">${icon('logout', 'icon-md')} Logout</div></div><div class="sidebar-backdrop" aria-hidden="true" onclick="closeSidebar()"></div><div class="main-content"><div class="content-header"><button type="button" class="sidebar-toggle" aria-label="Open navigation menu" aria-expanded="false" aria-controls="app-sidebar" onclick="event.stopPropagation(); toggleSidebar();">${icon('menu', 'icon-md')}</button><h1>${getPageTitle(window.currentView)}</h1><div class="header-right"><span id="networkStatusBadge" class="net-status ${isOffline ? 'offline' : 'online'}">${statusText}</span>${renderNotificationBell(user)}<button type="button" class="header-profile" onclick="navigateTo('profile')"><div class="header-avatar ${isITManager ? 'role-it' : (isGuide ? 'role-guide' : 'role-tourist')}">${avatarIcon}</div><div class="header-user-info"><div class="header-user-name">${escapeHtml(user.name)}</div><div class="header-user-role">${escapeHtml(roleLabel)}</div></div></button></div></div><div class="${mainContainerClass}" onclick="closeSidebar()">${renderParkAccessPanel()}<div id="sigtsViewSlot">${content}</div></div></div>${mobileTabbar}</div>`;}

// =====================================================
// FAST TAB SWITCHING: skeleton-first + caching
// =====================================================
let __sigtsRenderNonce = 0;
const __sigtsViewHtmlCache = new Map(); // key -> { html, at }
const __sigtsViewInFlight = new Map(); // key -> Promise<string>

function getViewCacheKey(view) {
    const role = getEffectiveRole(Auth.getCurrentUser() || {});
    return `${role}::${String(view || '')}`;
}

function getCachedViewHtml(view) {
    if (view === 'ai_chat') return null;
    const key = getViewCacheKey(view);
    const item = __sigtsViewHtmlCache.get(key);
    if (!item) return null;
    if (Date.now() - item.at > 45000) return null;
    return item.html || null;
}

function setCachedViewHtml(view, html) {
    if (view === 'ai_chat') return;
    const key = getViewCacheKey(view);
    __sigtsViewHtmlCache.set(key, { html: String(html || ''), at: Date.now() });
}

/** Drop cached HTML for one view (e.g. after changing predictive filters). */
function invalidateSigtsViewCache(view) {
    __sigtsViewHtmlCache.delete(getViewCacheKey(view));
}

window.invalidateSigtsViewCache = invalidateSigtsViewCache;

function readPredictiveAnalyticsFilters() {
    const today = new Date().toISOString().slice(0, 10);
    let days = parseInt(sessionStorage.getItem('sigts.pa.days') || '14', 10);
    if (!Number.isFinite(days) || days < 1) days = 14;
    if (days > 365) days = 365;
    const congestionDate = sessionStorage.getItem('sigts.pa.congestion') || today;
    const animalId = sessionStorage.getItem('sigts.pa.animal') || '';
    return { days, congestionDate, animalId };
}

window.applyPredictiveAnalyticsFilters = function () {
    if (!requireITManagerAccess('predictive analytics')) return;
    const rd = document.getElementById('pa-range-days');
    const cd = document.getElementById('pa-congestion-date');
    const af = document.getElementById('pa-animal-filter');
    if (rd) sessionStorage.setItem('sigts.pa.days', String(rd.value || '14'));
    if (cd) sessionStorage.setItem('sigts.pa.congestion', String(cd.value || '').slice(0, 10));
    if (af) sessionStorage.setItem('sigts.pa.animal', String(af.value || ''));
    invalidateSigtsViewCache('it_predictive_analytics');
    renderView('it_predictive_analytics', { updateHash: false, suppressAccessToast: true });
};

window.paRunReportFromBuilder = async function () {
    if (!requireITManagerAccess('predictive analytics report builder')) return;
    const keys = [];
    if (document.getElementById('pa-metric-visitor_flow')?.checked) keys.push('visitor_flow');
    if (document.getElementById('pa-metric-sightings_trend')?.checked) keys.push('sightings_trend');
    if (document.getElementById('pa-metric-satisfaction')?.checked) keys.push('satisfaction');
    if (document.getElementById('pa-metric-popular_content')?.checked) keys.push('popular_content');
    if (!keys.length) {
        showToast('Select at least one metric.', 'warning');
        return;
    }
    const start = document.getElementById('pa-report-start')?.value?.trim() || '';
    const end = document.getElementById('pa-report-end')?.value?.trim() || '';
    const r = await API.buildAnalyticsReportAdvanced(keys, start, end, 'custom');
    if (r?.status >= 400) {
        showToast(r?.error || 'Report build failed', 'danger');
        return;
    }
    const sectionKeys = r?.sections ? Object.keys(r.sections) : [];
    const errs = r?.section_errors ? Object.keys(r.section_errors) : [];
    const sectionRows = sectionKeys.length
        ? sectionKeys.map((k) => `<div class="seasonal-item"><strong>${escapeHtml(k)}</strong> loaded</div>`).join('')
        : '<div class="seasonal-item">No sections were generated.</div>';
    const errRows = errs.length
        ? `<h4 class="ui-modal-section-title">${icon('shield', 'icon-sm')} Section errors</h4><div class="seasonal-list">${errs.map((k) => `<div class="seasonal-item">${escapeHtml(k)}: ${escapeHtml(String(r.section_errors[k] || 'error'))}</div>`).join('')}</div>`
        : '';
    showRichContentModal({
        title: 'Custom report result',
        bodyHtml: `<div class="seasonal-list">${sectionRows}</div>${errRows}`,
        footerHtml: `<button type="button" class="small-btn ghost-btn" onclick="document.querySelector('.ui-modal-overlay-rich .ui-modal-close')?.click();">${icon('x', 'icon-sm')} Close</button>`
    });
    showToast(`Report built: ${sectionKeys.length} section(s)`, errs.length ? 'warning' : 'success');
};

function ensureShimmerKeyframes() {
    if (document.getElementById('sigtsShimmerStyle')) return;
    const style = document.createElement('style');
    style.id = 'sigtsShimmerStyle';
    style.textContent = `@keyframes sigtsShimmer{0%{transform:translateX(-70%)}100%{transform:translateX(210%)}}`;
    document.head.appendChild(style);
}

function renderViewSkeleton(view) {
    const title = escapeHtml(getPageTitle(view));
    const card = (lines = 3) => `<div class="section-card" style="opacity:0.92;">
        <div class="section-header"><h3>${icon('sparkle', 'icon-sm')} Loading ${title}</h3></div>
        <div style="display:grid;gap:10px;padding:8px 0 2px;">
            ${Array.from({ length: lines }).map(() => `
                <div style="height:12px;border-radius:10px;background:rgba(13,27,20,0.08);overflow:hidden;position:relative;">
                    <div style="height:100%;width:55%;background:linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent);transform:translateX(-70%);animation:sigtsShimmer 1.05s ease-in-out infinite;"></div>
                </div>`).join('')}
        </div>
    </div>`;

    if (view === 'dashboard') return `${card(4)}${card(3)}`;
    if (view === 'saved') return `${card(4)}`;
    if (view === 'animals' || view === 'culture') return `${card(4)}${card(4)}`;
    if (view === 'it_dashboard' || view === 'it_predictive_analytics' || view === 'guide_dashboard' || view === 'intranet') return `${card(4)}${card(3)}`;
    return card(4);
}

async function computeViewContent(view) {
    switch (view) {
        case 'dashboard': return await renderDashboardContent();
        case 'animals': return await renderAnimalsContent();
        case 'map': return renderMapContent();
        case 'culture': return await renderCultureContent();
        case 'sightings': return await renderSightingsContent();
        case 'profile': return await renderProfileContent();
        case 'info': return await renderInfoContent();
        case 'saved': return await renderSavedContent();
        case 'ai_chat': return renderAIChatContent();
        case 'guide_dashboard': return await renderGuideDashboard();
        case 'it_dashboard': return await renderITManagerDashboard();
        case 'it_predictive_analytics': return await renderITPredictiveAnalyticsDashboard();
        case 'it_tour_assignments': return await renderITTourAssignmentsDashboard();
        case 'intranet': return await renderIntranetDashboard();
        default: return await renderDashboardContent();
    }
}

function getOrComputeViewContent(view) {
    const key = getViewCacheKey(view);
    const cached = getCachedViewHtml(view);
    if (cached) return Promise.resolve(cached);
    if (__sigtsViewInFlight.has(key)) return __sigtsViewInFlight.get(key);
    const p = (async () => {
        const html = await computeViewContent(view);
        setCachedViewHtml(view, html);
        return html;
    })().finally(() => {
        __sigtsViewInFlight.delete(key);
    });
    __sigtsViewInFlight.set(key, p);
    return p;
}

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

/** Normalises image_urls from API/pg (array, JSON string, or Postgres text[] string). */
function parseImageUrlsField(raw) {
    if (raw == null) return [];
    if (Array.isArray(raw)) return raw.map((u) => String(u || '').trim()).filter(Boolean);
    if (typeof raw === 'string') {
        const s = raw.trim();
        if (!s) return [];
        if (s.startsWith('{') && s.endsWith('}')) {
            const inner = s.slice(1, -1).trim();
            if (!inner) return [];
            const parts = [];
            let buf = '';
            let inQ = false;
            for (let i = 0; i < inner.length; i++) {
                const c = inner[i];
                if (c === '"') {
                    inQ = !inQ;
                    continue;
                }
                if (!inQ && c === ',') {
                    if (buf.trim()) parts.push(buf.trim());
                    buf = '';
                    continue;
                }
                buf += c;
            }
            if (buf.trim()) parts.push(buf.trim());
            return parts.map((p) => p.replace(/^"|"$/g, '').trim()).filter(Boolean);
        }
        try {
            const parsed = JSON.parse(s);
            if (Array.isArray(parsed)) return parsed.map((u) => String(u || '').trim()).filter(Boolean);
        } catch (_) {
            if (s.startsWith('http')) return [s.split(/[|,]/)[0]?.trim()].filter(Boolean);
        }
    }
    return [];
}

/** Last-resort Wikimedia thumbnails when DB or offline cache lacks image_urls (exact display name, lowercased). */
const SPECIES_IMAGE_FALLBACK_BY_NAME = {
    'mountain gorilla': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/066_Silverback_mountain_gorilla_eating_at_Bwindi_Impenetrable_Forest_National_Park_Photo_by_Giles_Laurent.jpg/960px-066_Silverback_mountain_gorilla_eating_at_Bwindi_Impenetrable_Forest_National_Park_Photo_by_Giles_Laurent.jpg',
    'african forest elephant': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/African_forest_elephant_%28Loxodonta_cyclotis%29_calf.jpg/960px-African_forest_elephant_%28Loxodonta_cyclotis%29_calf.jpg',
    'african elephant': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/63/African_elephants_%28Loxodonta_africana%29_in_water.jpg/960px-African_elephants_%28Loxodonta_africana%29_in_water.jpg',
    'great blue turaco': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Great_Blue_Turaco.jpg/960px-Great_Blue_Turaco.jpg',
    'chimpanzee': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/A_group_of_imp_chimps.jpg/960px-A_group_of_imp_chimps.jpg',
    'black-and-white colobus': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Black-and-white_Colobus_Monkeys.jpg/960px-Black-and-white_Colobus_Monkeys.jpg',
    'african fish eagle': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/AfricanFishEagle.jpeg/960px-AfricanFishEagle.jpeg',
    'rwenzori turaco': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Ruwenzori_Turaco.jpg/960px-Ruwenzori_Turaco.jpg',
    "l'hoest's monkey": 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/LHoests_monkey_%28Cercopithecus_lhoesti%29_captive.jpg/960px-LHoests_monkey_%28Cercopithecus_lhoesti%29_captive.jpg',
    'blue monkey': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Zanzibar_Sykes%27_monkey_%28Cercopithecus_mitis%29_female_and_juveniles.jpg/960px-Zanzibar_Sykes%27_monkey_%28Cercopithecus_mitis%29_female_and_juveniles.jpg',
    'african green broadbill': '/images/african-green-broadbill.png',
    'black bee-eater': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/24/Black_Bee-eater_%28Merops_gularis%29_Photo_by_Giles_Laurent.jpg/960px-Black_Bee-eater_%28Merops_gularis%29_Photo_by_Giles_Laurent.jpg',
    'handsome francolin': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Handsome_spurfowl_%28Pternistis_nobilis%29.jpg/960px-Handsome_spurfowl_%28Pternistis_nobilis%29.jpg',
    'bar-tailed trogon': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Bar-tailed_Trogon_%28Apaloderma_vittatum%29_%2845634509165%29.jpg/960px-Bar-tailed_Trogon_%28Apaloderma_vittatum%29_%2845634509165%29.jpg',
    "johnston's chameleon": 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/db/Camale%C3%B3n_%28Trioceros_johnstoni%29%2C_parque_nacional_de_la_Selva_Impenetrable_de_Bwindi%2C_Uganda%2C_2024-02-01%2C_DD_89.jpg/960px-Camale%C3%B3n_%28Trioceros_johnstoni%29%2C_parque_nacional_de_la_Selva_Impenetrable_de_Bwindi%2C_Uganda%2C_2024-02-01%2C_DD_89.jpg',
    'olive baboon': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Papio_anubis.jpg/960px-Papio_anubis.jpg',
    'african leopard': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/03/Panthera_pardus_close_up.jpg/960px-Panthera_pardus_close_up.jpg',
    'african golden cat': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c4/Caracal_aurata_2.jpg/960px-Caracal_aurata_2.jpg',
    'african civet': 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Civettictis_civetta_11.jpg',
    'african forest buffalo': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Syncerus_caffer_nanus_-_01.jpg/960px-Syncerus_caffer_nanus_-_01.jpg',
    'bushbuck': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Tragelaphus_scriptus.jpg/960px-Tragelaphus_scriptus.jpg',
    'crowned eagle': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/70/Stephanoaetus_coronatus.jpg/960px-Stephanoaetus_coronatus.jpg',
    'giant forest hog': 'https://upload.wikimedia.org/wikipedia/commons/3/3b/Hylochoerus_meinertzhageni.jpg',
    'mocker swallowtail': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Mocker_swallowtail_%28Papilio_dardanus_cenea%29_female_form_cenea_Maputo.jpg/960px-Mocker_swallowtail_%28Papilio_dardanus_cenea%29_female_form_cenea_Maputo.jpg',
    'yellow-backed duiker': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Cephalophus_silvicultor_154622618.jpg/960px-Cephalophus_silvicultor_154622618.jpg',
    'black-fronted duiker': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Cephalophus_nigrifrons.jpg/960px-Cephalophus_nigrifrons.jpg',
    "peter's duiker": 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Peters_Duiker_%28Cephalophus_callipygus%29_from_behind%2C_Campo_Maan_National_Park.jpg/960px-Peters_Duiker_%28Cephalophus_callipygus%29_from_behind%2C_Campo_Maan_National_Park.jpg',
    'bushpig': 'https://upload.wikimedia.org/wikipedia/commons/0/0e/Potamochoerus_larvatus_43594615.jpg',
    'potto': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Potto.jpg/960px-Potto.jpg',
    'black-and-white-casqued hornbill': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Bycanistes_subcylindricus_-_Forst_-_01.jpg/960px-Bycanistes_subcylindricus_-_Forst_-_01.jpg',
    'ruwenzori batis': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/Ruwenzori_Batis_RWD.jpg/960px-Ruwenzori_Batis_RWD.jpg',
    "archer's robin-chat": 'https://upload.wikimedia.org/wikipedia/commons/2/2d/Archersrobinchat.jpg',
    'regal sunbird': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4b/Regal_sunbird_%28Cinnyris_regius_regius%29_male_moulting.jpg/960px-Regal_sunbird_%28Cinnyris_regius_regius%29_male_moulting.jpg',
    'montane oriole': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Oriolus_percivali_-_avocat_-_602207636.jpeg/960px-Oriolus_percivali_-_avocat_-_602207636.jpeg',
    'strange weaver': 'https://upload.wikimedia.org/wikipedia/commons/8/85/Strange_weaver.jpg',
    "lagden's bush-shrike": 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/MalaconotusLagdeniKeulemans_%28cropped%29.jpg/960px-MalaconotusLagdeniKeulemans_%28cropped%29.jpg',
    'chestnut-throated apalis': 'https://upload.wikimedia.org/wikipedia/commons/6/60/Chestnut_throated_apalis1.jpg',
    'dusky crimsonwing': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/Cryptospiza_jacksoni_2.jpg/960px-Cryptospiza_jacksoni_2.jpg',
    "shelley's crimsonwing": 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Cryptospiza_shelleyi.jpg/960px-Cryptospiza_shelleyi.jpg',
    "chapin's flycatcher": 'https://upload.wikimedia.org/wikipedia/commons/4/44/Chapin%27s_Flycatcher_%28Muscicapa_lendu%29_JM.jpg',
    "grauer's swamp warbler": 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ed/Bradypterus_grandis_-_bureaubenjamin_-_119616564.jpeg/960px-Bradypterus_grandis_-_bureaubenjamin_-_119616564.jpeg',
    'african giant swallowtail': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Papilio_antimachus.jpg/640px-Papilio_antimachus.jpg',
    'cream-banded swallowtail': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/RebelAnnalendkkNaturhof1914TafXVII.jpg/960px-RebelAnnalendkkNaturhof1914TafXVII.jpg',
    "turner's eremomela": 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Range_Turner%27s_eremomela.png/960px-Range_Turner%27s_eremomela.png'
};

const SPECIES_IMAGE_FALLBACK_BY_SCIENTIFIC = {
    'pseudocalyptomena graueri': '/images/african-green-broadbill.png',
    'gorilla beringei beringei': SPECIES_IMAGE_FALLBACK_BY_NAME['mountain gorilla'],
    'pan troglodytes': SPECIES_IMAGE_FALLBACK_BY_NAME.chimpanzee,
    'loxodonta cyclotis': SPECIES_IMAGE_FALLBACK_BY_NAME['african forest elephant'],
    'cercopithecus lhoesti': SPECIES_IMAGE_FALLBACK_BY_NAME["l'hoest's monkey"],
    'papilio dardanus': SPECIES_IMAGE_FALLBACK_BY_NAME['mocker swallowtail'],
    'trioceros johnstoni': SPECIES_IMAGE_FALLBACK_BY_NAME["johnston's chameleon"]
};

function normalizeSpeciesKey(raw) {
    return String(raw || '')
        .toLowerCase()
        .replace(/\u2019/g, "'")
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

const SPECIES_IMAGE_FALLBACK_BY_NORMALIZED_NAME = Object.entries(SPECIES_IMAGE_FALLBACK_BY_NAME).reduce((acc, [name, url]) => {
    acc[normalizeSpeciesKey(name)] = url;
    return acc;
}, {});

function speciesWikimediaFallbackUrl(name, scientificName = '') {
    const k = String(name || '').trim().toLowerCase();
    if (SPECIES_IMAGE_FALLBACK_BY_NAME[k]) return SPECIES_IMAGE_FALLBACK_BY_NAME[k];

    const nk = normalizeSpeciesKey(name);
    if (SPECIES_IMAGE_FALLBACK_BY_NORMALIZED_NAME[nk]) return SPECIES_IMAGE_FALLBACK_BY_NORMALIZED_NAME[nk];

    const sci = normalizeSpeciesKey(scientificName);
    if (SPECIES_IMAGE_FALLBACK_BY_SCIENTIFIC[sci]) return SPECIES_IMAGE_FALLBACK_BY_SCIENTIFIC[sci];

    // Last pass: token overlap match (handles minor card-name wording shifts).
    for (const [entryName, url] of Object.entries(SPECIES_IMAGE_FALLBACK_BY_NAME)) {
        const en = normalizeSpeciesKey(entryName);
        if (!en) continue;
        if (nk.includes(en) || en.includes(nk)) return url;
    }
    return '';
}

function speciesHasDbImage(animal = {}) {
    return parseImageUrlsField(animal.image_urls ?? animal.primary_image_urls).length > 0;
}

function firstSpeciesImage(animal = {}) {
    const fromDb = parseImageUrlsField(animal.image_urls ?? animal.primary_image_urls);
    if (fromDb.length) return String(fromDb[0]);
    const fb = speciesWikimediaFallbackUrl(animal.name, animal.scientific_name || animal.scientific || '');
    return fb ? String(fb) : '';
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
    const sci = String(animal.scientific_name || animal.scientific || '').trim();
    const name = animal.name || 'this species';
    return `Field brief for Bwindi: ${name}${sci ? ` (${sci})` : ''}. Usual trail zones, habitat, visitor rules, seasonality, status, one rumor to correct. Rangers’ safety line comes first.`;
}

/** One catalogue tile (Animals tab + dashboard spotlight). */
function renderAnimalSpeciesCardHtml(animal) {
    const rawId = animal.animal_id || animal.id || '';
    const id = escapeHtml(String(rawId));
    const thumb = firstSpeciesImage(animal);
    const teaserSource = animal.description ? String(animal.description) : 'Tap for field notes from the catalogue.';
    const teaser = escapeHtml(truncateSnippet(teaserSource, 280));
    const sci = escapeHtml(String(animal.scientific_name || animal.scientific || 'Scientific name unavailable'));
    const status = String(animal.conservation_status || animal.status || 'least_concern').toLowerCase().replace(/\s+/g, '_');
    const statusLabel = escapeHtml(String(animal.conservation_status || animal.status || 'least_concern').replace(/_/g, ' '));
    const thumbHtml = thumb
        ? `<div class="animal-card-thumb"><img src="${escapeHtml(thumb)}" alt="${escapeHtml(animal.name || 'Species')}" loading="lazy" decoding="async" /></div>`
        : `<div class="animal-card-thumb animal-card-thumb--fallback">${icon(getAnimalIconName(animal.name), 'icon-xl')}</div>`;
    const aiPrompt = speciesAIPromptFromRecord(animal);
    const searchBlob = `${String(animal.name || '')} ${String(animal.scientific_name || animal.scientific || '')}`.toLowerCase().replace(/"/g, '');
    return `<article class="animal-card animal-card--interactive" tabindex="0" data-species-q="${escapeHtml(searchBlob)}" aria-label="${escapeHtml(animal.name)} details" onclick="openAnimalSpeciesDetail('${id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openAnimalSpeciesDetail('${id}');}">
            ${thumbHtml}
            <div class="animal-info">
                <div class="animal-name">${escapeHtml(animal.name)}</div>
                <div class="animal-scientific">${sci}</div>
                <p class="animal-teaser">${teaser}</p>
                <span class="animal-status status-${escapeHtml(status.replace(/_/g, '-'))}">${statusLabel}</span>
                <div class="animal-card-actions">
                    <button type="button" class="small-btn" onclick="event.stopPropagation(); navigateToAIWithPrompt(${JSON.stringify(aiPrompt)});">${icon('feather', 'icon-sm')} Let's Chat</button>
                    <button type="button" class="small-btn ghost-btn" onclick="event.stopPropagation(); submitContentHelpfulness('animal', '${id}', ${JSON.stringify(animal.name || '')});">${icon('target', 'icon-sm')} Helpful?</button>
                </div>
            </div>
        </article>`;
}

function pickDashboardSpotlightAnimals(animals, limit = 24) {
    if (!Array.isArray(animals) || !animals.length) return [];
    const rank = (name) => {
        const n = String(name || '').toLowerCase();
        if (n.includes('gorilla')) return 0;
        if (n.includes('chimp')) return 1;
        if (n.includes('elephant')) return 2;
        if (n.includes('turaco')) return 3;
        if (n.includes('colobus')) return 4;
        if (n.includes('crimson') || n.includes('broadbill') || n.includes('golden cat') || n.includes('leopard')) return 5;
        return 20;
    };
    return [...animals]
        .filter((a) => a && a.name && (a.animal_id || a.id))
        .sort((a, b) => {
            const d = rank(a.name) - rank(b.name);
            if (d !== 0) return d;
            const ia = speciesHasDbImage(a) ? 1 : 0;
            const ib = speciesHasDbImage(b) ? 1 : 0;
            if (ib !== ia) return ib - ia;
            return String(a.name).localeCompare(String(b.name));
        })
        .slice(0, limit);
}

function renderDashboardSpeciesSpotlight(animals) {
    const picks = pickDashboardSpotlightAnimals(animals, 24);
    if (!picks.length) return '';
    const cards = picks.map((a) => renderAnimalSpeciesCardHtml(a)).join('');
    return `<div class="section-card dashboard-species-spotlight"><div class="section-header"><h3>${icon('paw', 'icon-sm')} Species to explore</h3></div><p class="animals-page-blurb">A sample from the Bwindi catalogue on this device. Tap a card for ranger-style notes, or browse the full list.</p><div class="info-chip-row" style="margin-bottom:12px;"><button type="button" class="small-btn" onclick="navigateTo('animals')">${icon('grid', 'icon-sm')} Open full biodiversity list</button></div><div class="animals-list animals-list--responsive">${cards}</div></div>`;
}

function culturalAIPromptFromRecord(story = {}) {
    const title = story.title_en || 'this story';
    return `Cultural note on "${title}": background for visitors near Bwindi; Batwa/Bakiga angle if it fits; respectful behavior; how it lines up with trekking regulations. Plain words, no drama.`;
}

function stripOverlayFromBody() {
    document.body.classList.remove('detail-modal-open');
}

/**
 * Rich modal shell. Pass `destinationLayout: true` for Travel-style hero-first detail (bookmark in title row).
 */
function showRichContentModal(options = {}) {
    const title = options.title ?? 'Details';
    const subtitle = options.subtitle ?? '';
    const heroUrl = options.heroUrl ?? '';
    const heroAlt = options.heroAlt ?? '';
    const bodyHtml = options.bodyHtml ?? '';
    const footerHtml = options.footerHtml ?? '';
    const titleRowActionsHtml = options.titleRowActionsHtml ?? '';
    const destinationLayout = Boolean(options.destinationLayout);

    const root = ensureFeedbackRoot();
    stripOverlayFromBody();
    document.body.classList.add('detail-modal-open');
    const overlay = document.createElement('div');
    overlay.className = 'ui-modal-overlay ui-modal-overlay-rich';
    const heroBlock =
        heroUrl
            ? `<div class="ui-modal-hero${destinationLayout ? ' ui-modal-hero--destination' : ''}"><img src="${escapeHtml(heroUrl)}" alt="${escapeHtml(heroAlt || title || 'Illustration')}" loading="lazy" decoding="async" /></div>`
            : '';
    const modalInner =
        destinationLayout && heroBlock
            ? `
        <div class="ui-modal ui-modal-rich ui-modal-rich--destination" role="dialog" aria-modal="true" tabindex="-1">
            <button type="button" class="ui-modal-close" aria-label="Close">${icon('x', 'icon-sm')}</button>
            ${heroBlock}
            <div class="sigts-detail-meta">
                ${subtitle ? `<p class="sigts-detail-subtitle">${escapeHtml(String(subtitle))}</p>` : ''}
                <div class="sigts-detail-title-row">
                    <h2 class="sigts-detail-title">${escapeHtml(title || 'Details')}</h2>
                    <div class="sigts-detail-title-actions">${titleRowActionsHtml}</div>
                </div>
            </div>
            <p class="sigts-detail-details-label">${escapeHtml(options.detailsSectionLabel || 'Details')}</p>
            <div class="ui-modal-rich-body">${bodyHtml}</div>
            ${footerHtml || ''}
        </div>`
            : `
        <div class="ui-modal ui-modal-rich" role="dialog" aria-modal="true" tabindex="-1">
            <button type="button" class="ui-modal-close" aria-label="Close">${icon('x', 'icon-sm')}</button>
            <div class="ui-modal-title">${escapeHtml(title || 'Details')}</div>
            ${heroBlock}
            <div class="ui-modal-rich-body">${bodyHtml}</div>
            ${footerHtml || ''}
        </div>`;

    const modalInnerWide =
        destinationLayout && !heroBlock
            ? `
        <div class="ui-modal ui-modal-rich ui-modal-rich--destination sigts-detail-no-hero" role="dialog" aria-modal="true" tabindex="-1">
            <button type="button" class="ui-modal-close" aria-label="Close">${icon('x', 'icon-sm')}</button>
            <div class="sigts-detail-meta">
                ${subtitle ? `<p class="sigts-detail-subtitle">${escapeHtml(String(subtitle))}</p>` : ''}
                <div class="sigts-detail-title-row">
                    <h2 class="sigts-detail-title">${escapeHtml(title || 'Details')}</h2>
                    <div class="sigts-detail-title-actions">${titleRowActionsHtml}</div>
                </div>
            </div>
            <p class="sigts-detail-details-label">${escapeHtml(options.detailsSectionLabel || 'Details')}</p>
            <div class="ui-modal-rich-body">${bodyHtml}</div>
            ${footerHtml || ''}
        </div>`
            : null;

    overlay.innerHTML =
        modalInnerWide && destinationLayout && !heroBlock
            ? modalInnerWide.trim()
            : modalInner.trim();

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

function aiChatAutosizeTextarea(el) {
    if (!el || el.tagName !== 'TEXTAREA') return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(160, Math.max(44, el.scrollHeight))}px`;
}

window.aiChatAutosizeTextarea = aiChatAutosizeTextarea;

function applySIGTSAIPrefill() {
    try {
        const raw = sessionStorage.getItem('sigts_ai_prefill');
        if (!raw) return;
        sessionStorage.removeItem('sigts_ai_prefill');
        const input = document.getElementById('aiChatInput');
        if (!input) return;
        input.value = raw;
        aiChatAutosizeTextarea(input);
        input.focus();
        const hint = document.getElementById('aiPrefillBanner');
        if (hint) {
            hint.textContent = 'Draft text from the last screen is in the box. Edit it, then tap Send (Shift+Enter for a new line).';
        }
    } catch (_) {
        /**/
    }
}

/** Session storage key: selected tour thematic filter on the Animals tab */
const SIGTS_TOUR_FOCUS_KEY = 'sigts_tour_focus';

const BWINDI_TOUR_THEMES = [
    {
        id: 'all',
        icon: 'grid',
        title: 'All species',
        subtitle: 'Browse everything in SIGTS'
    },
    {
        id: 'primates',
        icon: 'paw',
        title: 'Great apes & monkeys',
        subtitle: 'Gorillas, chimps & primate richness (WHC text)'
    },
    {
        id: 'large_mammals',
        icon: 'elephant',
        title: 'Elephants & large mammals',
        subtitle: 'Wide-ranging fauna beyond primates'
    },
    {
        id: 'albertine_birds',
        icon: 'bird',
        title: 'Albertine bird icons',
        subtitle: 'Passerines singled out under criterion x'
    },
    {
        id: 'swallowtails',
        icon: 'leaf',
        title: 'Swallowtail butterflies',
        subtitle: 'Canopy Lepidoptera highlights'
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
        case 'primates': {
            if (/bird|broadbill|flycatcher|warbler|swallowtail|butterfly|turaco|\bbee-eagle\b|\beagle\b/.test(blob)) return false;
            return (
                /\b(monkey|gorilla|chimp|chimpan|baboon|colobus|mangabey|guenon|potto|galago)\b/i.test(blob)
                || /hoest|'s monkey|golden monkey/i.test(blob)
                || /\b(pan gorilla|cercopithecus|chlorocebus|alophocebus|lophocebus|papio|papionini|perodicticus)\b/.test(blob)
            );
        }
        case 'large_mammals': {
            if (animalMatchesBwindiTourFocus(animal, 'primates')) return false;
            if (/bird|flycatcher|warbler|broadbill|swallowtail|butterfly|\bbat\b/.test(blob)) return false;
            if (/\b(mouse|rat|shrew|squirrel|dormouse)\b/i.test(blob)) return false;
            return /elephant|duiker|buffalo|bushbuck|tragelaphus|cape buffalo|bushpig|hog|hyaena|civet|leopard|golden cat|caracal|forest hog|hylochoerus/i.test(blob);
        }
        case 'albertine_birds': {
            if (/swallowtail|butterfly|papilio\b/.test(blob)) return false;
            const needles = [
                'broadbill', 'green broadbill', 'grauer', 'warbler', 'turner', 'eremomela', 'chapin', 'flycatcher',
                'shelley', 'crimsonwing', 'francolin', 'trogon', 'hornbill', 'crowned', 'batis', 'robin',
                'sunbird', 'oriole', 'weaver', 'shrike', 'apalis', 'fish eagle', 'turaco', 'bee-eater'
            ];
            return needles.some((n) => name.includes(n));
        }
        case 'swallowtails':
            return /swallowtail|papilio\b|dardanus/i.test(blob);
        case 'globally_threatened': {
            const s = String(animal.conservation_status || '').toLowerCase().replace(/\s+/g, '_');
            return ['endangered', 'vulnerable', 'near_threatened'].includes(s);
        }
        default:
            return true;
    }
}

function getValidatedAnimalTourFocus() {
    const valid = new Set(BWINDI_TOUR_THEMES.map((t) => t.id));
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
    const cards = BWINDI_TOUR_THEMES.map((t) => {
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
        <div class="section-header"><h3 id="tour-focus-heading">${icon('target', 'icon-sm')} Pick a wildlife tour theme</h3></div>
        <p class="animals-page-blurb tour-focus-explainer">
            These themes mirror biodiversity groups commonly used for Bwindi ranger sessions.
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
    const k = BWINDI_TOUR_THEMES.some((t) => t.id === key) ? key : 'all';
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
        ${theme.conservation_note ? `<h4 class="ui-modal-section-title">${icon('book', 'icon-sm')} Conservation framing</h4><p>${escapeHtml(theme.conservation_note)}</p>` : ''}
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

    try {
        if (typeof AI !== 'undefined' && AI.recordContentView) {
            const tags = ['wildlife', String(animal.conservation_status || animal.status || '').toLowerCase()];
            AI.recordContentView('animal', id, tags);
        }
    } catch (_) {
        /**/
    }

    const similar = typeof AI !== 'undefined' && AI.getSimilarContent ? await AI.getSimilarContent('animal', id, 5).catch(() => []) : [];
    const similarHtml =
        similar.length > 0
            ? `<h4 class="ui-modal-section-title">${icon('grid', 'icon-sm')} Similar species</h4><ul class="ui-modal-facts">${similar
                  .map(
                      (s) =>
                          `<li><button type="button" class="small-btn ghost-btn" onclick="(function(){document.querySelector('.ui-modal-overlay-rich .ui-modal-close')?.click();openAnimalSpeciesDetail('${escAttrBareUuid(s.id)}');})()">${escapeHtml(s.name)}</button> <span class="ui-modal-muted">${Math.round(Number(s.similarity || 0) * 100)}% match</span></li>`
                  )
                  .join('')}</ul>`
            : '';

    const facts = coerceStringArray(animal.fun_facts);
    const hero = firstSpeciesImage(animal);
    const factList = facts.length
        ? `<ul class="ui-modal-facts">${facts.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>`
        : '<p class="ui-modal-muted">Fun facts arriving soon.</p>';

    const imgList = Array.isArray(animal.image_urls) ? animal.image_urls.map((u) => String(u || '').trim()).filter(Boolean) : [];
    const galleryExtra = imgList.slice(1, 7);
    const galleryHtml = galleryExtra.length
        ? `<h4 class="ui-modal-section-title">${icon('camera', 'icon-sm')} More images</h4><div class="ui-modal-gallery" style="display:flex;flex-wrap:wrap;gap:8px;">${galleryExtra
              .map((u) => `<img src="${escapeHtml(u)}" alt="" loading="lazy" decoding="async" style="max-width:120px;border-radius:8px;object-fit:cover;" />`)
              .join('')}</div>`
        : '';

    const videoUrl = String(animal.video_url || '').trim();
    const videoHtml =
        /^https?:\/\//i.test(videoUrl)
            ? `<h4 class="ui-modal-section-title">${icon('note', 'icon-sm')} Video</h4><div class="ui-modal-video"><video controls playsinline preload="metadata" style="width:100%;max-height:240px;border-radius:8px;" src="${escapeHtml(videoUrl)}"></video></div>`
            : '';

    const behParts = [];
    if (animal.social_structure) behParts.push(`<p><strong>Social structure</strong><br>${escapeHtml(animal.social_structure)}</p>`);
    if (animal.average_size) behParts.push(`<p><strong>Typical size</strong><br>${escapeHtml(animal.average_size)}</p>`);
    if (animal.gestation_period) behParts.push(`<p><strong>Gestation</strong><br>${escapeHtml(animal.gestation_period)}</p>`);
    const behHtml = behParts.length
        ? `<h4 class="ui-modal-section-title">${icon('paw', 'icon-sm')} Behaviour & biology</h4>${behParts.join('')}`
        : '';

    const body = `
        <div class="ui-modal-chip-row">
          <span class="animal-status status-${escapeHtml(String(animal.conservation_status || 'least_concern').replace(/_/g, '-'))}">${escapeHtml(String(animal.conservation_status || 'least_concern').replace(/_/g, ' '))}</span>
          <span class="animal-status neutral-chip">${escapeHtml(animal.diet || 'Mixed diet')}</span>
          <span class="animal-status neutral-chip">${escapeHtml(animal.lifespan ? `Lifespan: ${animal.lifespan}` : 'Lifespan: see guide')}</span>
        </div>
        ${videoHtml}
        <p>${escapeHtml(animal.description || 'Description coming soon via rangers.')}</p>
        <p><strong>${icon('leaf', 'icon-sm')} Habitat</strong><br>${escapeHtml(animal.habitat || 'Montane rainforest mosaic')}</p>
        ${joinMaybeList(animal.common_locations) ? `<p><strong>${icon('map', 'icon-sm')} Often near</strong><br>${escapeHtml(joinMaybeList(animal.common_locations))}</p>` : ''}
        ${behHtml}
        ${galleryHtml}
        ${similarHtml}
        <h4 class="ui-modal-section-title">${icon('target', 'icon-sm')} Field notes</h4>
        ${factList}`;

    const aid = String(animal.animal_id || id);
    const bookmarked = Content.isBookmarked('animal', aid);
    const titleRowActionsHtml = `<button type="button" class="sigts-detail-bookmark-btn${bookmarked ? ' is-saved' : ''}" aria-label="Save to list" aria-pressed="${bookmarked ? 'true' : 'false'}">${icon('bookmark', 'icon-md')}</button>`;
    const footer = `
        <div class="sigts-detail-footer-actions">
          <button type="button" class="login-btn sigts-animal-tourhelp">${icon('target', 'icon-sm')} Let's Chat (draft)</button>
          <button type="button" class="ui-btn ui-btn-secondary ui-btn--wide">Close</button>
        </div>`;

    const overlay = showRichContentModal({
        title: animal.name,
        subtitle: animal.scientific_name || 'Wildlife profile',
        heroUrl: hero,
        heroAlt: animal.name,
        bodyHtml: body,
        footerHtml: footer,
        destinationLayout: true,
        titleRowActionsHtml
    });

    const syncAnimalBookmarkUi = (btn, on) => {
        if (!btn) return;
        btn.classList.toggle('is-saved', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    };

    overlay?.querySelector('.sigts-animal-tourhelp')?.addEventListener('click', async () => {
        await navigateToAIWithPrompt(speciesAIPromptFromRecord(animal));
    });
    overlay?.querySelector('.sigts-detail-bookmark-btn')?.addEventListener('click', () => {
        const on = Content.toggleBookmark({ type: 'animal', id: aid, title: animal.name });
        syncAnimalBookmarkUi(overlay.querySelector('.sigts-detail-bookmark-btn'), on);
        showToast(on ? 'Saved — find it on the Saved tab.' : 'Removed from saved.', 'success');
    });
    overlay?.querySelector('.ui-btn-secondary')?.addEventListener('click', () => {
        overlay.querySelector('.ui-modal-close')?.click();
    });
};

window.openParkLocationDetail = async function openParkLocationDetail(locationId) {
    const id = String(locationId || '').trim();
    if (!id) return showToast('Missing location id', 'warning');
    const loc = await API.getLocationById(id);
    if (!loc?.name) {
        showToast('Could not load that location. Check connection or download offline content.', 'warning');
        return;
    }
    let facilities = loc.facilities;
    if (typeof facilities === 'string') {
        try {
            facilities = JSON.parse(facilities);
        } catch (_) {
            facilities = [];
        }
    }
    if (!Array.isArray(facilities)) facilities = [];
    const facLines = facilities.length
        ? `<ul class="ui-modal-facts">${facilities
              .map((f) => `<li>${escapeHtml(typeof f === 'string' ? f : f?.name || JSON.stringify(f))}</li>`)
              .join('')}</ul>`
        : '<p class="ui-modal-muted">No facilities list on file.</p>';

    const lat = Number(loc.latitude);
    const lng = Number(loc.longitude);
    const coordLine = Number.isFinite(lat) && Number.isFinite(lng) ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : '—';

    const imgs = Array.isArray(loc.image_urls) ? loc.image_urls.map((u) => String(u || '').trim()).filter(Boolean) : [];
    const imgBlock = imgs.length
        ? `<div class="ui-modal-gallery" style="display:flex;flex-wrap:wrap;gap:8px;">${imgs
              .slice(0, 6)
              .map(
                  (u) =>
                      `<img src="${escapeHtml(u)}" alt="" loading="lazy" decoding="async" style="max-width:140px;border-radius:8px;object-fit:cover;" />`
              )
              .join('')}</div>`
        : '';

    const audio = String(loc.audio_guide_url || '').trim();
    const audioHtml = /^https?:\/\//i.test(audio)
        ? `<div style="margin:12px 0;"><p class="ui-modal-muted">Audio guide</p><audio controls preload="none" style="width:100%;" src="${escapeHtml(audio)}"></audio></div>`
        : '';

    const lid = String(loc.location_id || id);
    const saved = Content.isBookmarked('location', lid);
    const locSubtitle = `${String(loc.location_type || 'place').replace(/_/g, ' ')} · ${coordLine}`;
    const titleRowActionsHtml = `<button type="button" class="sigts-detail-bookmark-btn${saved ? ' is-saved' : ''}" aria-label="Save place" aria-pressed="${saved ? 'true' : 'false'}">${icon('bookmark', 'icon-md')}</button>`;

    const body = `
        <p>${escapeHtml(loc.description || '')}</p>
        ${imgBlock}
        ${audioHtml}
        <h4 class="ui-modal-section-title">${icon('building', 'icon-sm')} Facilities</h4>
        ${facLines}
        ${loc.best_viewing_time ? `<p><strong>Best viewing</strong><br>${escapeHtml(loc.best_viewing_time)}</p>` : ''}`;

    const footer = `
        <div class="sigts-detail-footer-actions">
          <button type="button" class="login-btn sigts-loc-map">${icon('map', 'icon-sm')} Open map</button>
          <button type="button" class="ui-btn ui-btn-secondary ui-btn--wide">Close</button>
        </div>`;

    const overlay = showRichContentModal({
        title: loc.name,
        subtitle: locSubtitle,
        heroUrl: imgs[0] || '',
        heroAlt: loc.name,
        bodyHtml: body,
        footerHtml: footer,
        destinationLayout: true,
        titleRowActionsHtml
    });

    overlay?.querySelector('.sigts-loc-map')?.addEventListener('click', () => {
        overlay.querySelector('.ui-modal-close')?.click();
        navigateTo('map');
    });
    overlay?.querySelector('.sigts-detail-bookmark-btn')?.addEventListener('click', () => {
        const on = Content.toggleBookmark({ type: 'location', id: lid, title: loc.name });
        const btn = overlay.querySelector('.sigts-detail-bookmark-btn');
        btn?.classList.toggle('is-saved', on);
        btn?.setAttribute('aria-pressed', on ? 'true' : 'false');
        showToast(on ? 'Saved — open the Saved tab anytime.' : 'Removed from saved.', 'success');
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

    try {
        if (typeof AI !== 'undefined' && AI.recordContentView) {
            AI.recordContentView('story', String(story.narrative_id), ['culture']);
        }
    } catch (_) {
        /**/
    }

    const hero = firstStoryImage(story);
    const nid = String(story.narrative_id);
    const subtitle = [story.community, story.story_type].filter(Boolean).join(' · ') || 'Cultural narrative';
    const bm = Content.isBookmarked('cultural', nid);
    const titleRowActionsHtml = `<button type="button" class="sigts-detail-bookmark-btn${bm ? ' is-saved' : ''}" aria-label="Save story" aria-pressed="${bm ? 'true' : 'false'}">${icon('bookmark', 'icon-md')}</button>`;

    const body = `
        <p>${escapeHtml(story?.narrative_en || story?.story || 'Full narrative unavailable offline.')}</p>
        ${story?.cultural_significance ? `<p><strong>${icon('book', 'icon-sm')} Why it matters</strong><br>${escapeHtml(story.cultural_significance)}</p>` : ''}
        ${joinMaybeList(story?.related_locations) ? `<p><strong>${icon('map', 'icon-sm')} Linked places</strong><br>${escapeHtml(joinMaybeList(story.related_locations))}</p>` : ''}`;

    const footer = `
        <div class="sigts-detail-footer-actions">
          <button type="button" class="login-btn sigts-story-tourhelp">${icon('feather', 'icon-sm')} Let's Chat (draft)</button>
          <button type="button" class="ui-btn ui-btn-secondary ui-btn--wide">Close</button>
        </div>`;

    const overlay = showRichContentModal({
        title: story.title_en || 'Cultural narrative',
        subtitle,
        heroUrl: hero,
        heroAlt: story.title_en || '',
        bodyHtml: body,
        footerHtml: footer,
        destinationLayout: true,
        titleRowActionsHtml
    });

    overlay?.querySelector('.sigts-story-tourhelp')?.addEventListener('click', async () => {
        await navigateToAIWithPrompt(culturalAIPromptFromRecord(story));
    });
    overlay?.querySelector('.sigts-detail-bookmark-btn')?.addEventListener('click', () => {
        const on = Content.toggleBookmark({
            type: 'cultural',
            id: nid,
            title: story.title_en || 'Cultural story'
        });
        const hdr = overlay.querySelector('.sigts-detail-bookmark-btn');
        hdr?.classList.toggle('is-saved', on);
        hdr?.setAttribute('aria-pressed', on ? 'true' : 'false');
        showToast(on ? 'Saved — view under the Saved tab.' : 'Removed from saved.', 'success');
    });
    overlay?.querySelector('.ui-btn-secondary')?.addEventListener('click', () => {
        overlay.querySelector('.ui-modal-close')?.click();
    });
};

// =====================================================
// CONTENT RENDER FUNCTIONS
// =====================================================
function buildTourFocusThumbnailMap(animals) {
    if (!Array.isArray(animals) || !animals.length) return {};
    const pickImg = (predicate) => {
        const hit = animals.find(predicate);
        return hit ? firstSpeciesImage(hit) : '';
    };
    return {
        primates: pickImg((a) => /\b(gorilla|chimp)/i.test(String(a?.name || ''))),
        large_mammals: pickImg((a) => /\b(elephant|buffalo|bushbuck|duiker|leopard|hog)\b/i.test(String(a?.name || ''))),
        albertine_birds: pickImg((a) =>
            /\b(turaco|broadbill|francolin|warbler|eagle|hornbill)\b/i.test(String(a?.name || ''))),
        swallowtails: pickImg((a) => /\bswallowtail|Papilio/i.test(`${String(a?.name || '')} ${String(a?.scientific_name || '')}`)),
        globally_threatened: pickImg((a) => {
            const s = String(a?.conservation_status || '').toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
            return ['endangered', 'vulnerable', 'near_threatened'].includes(s);
        })
    };
}

/** §3.1.1.3 — cross-catalog search plus saved bookmarks (device-local). */
function renderTourismBookmarksRow() {
    const rows =
        typeof Content?.readBookmarks === 'function'
            ? Content.readBookmarks()
            : Array.isArray(Content?.bookmarks)
              ? Content.bookmarks
              : [];
    const items = [...rows].sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || ''))).slice(0, 10);
    if (!items.length) {
        return `<div class="section-card sigts-dashboard-saved"><div class="section-header"><h3>${icon('bookmark', 'icon-sm')} Saved content</h3></div>        <p class="animals-page-blurb">Tap the bookmark icon on species, places, or stories — shortcuts land here and on the <strong>Saved</strong> tab.</p></div>`;
    }
    const escAttr = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const chips = items
        .map((b) => {
            const rawId = String(b.id || '').trim();
            const safeId = escAttr(rawId);
            const lab = escapeHtml(String(b.title || b.id || 'Saved item'));
            if (b.type === 'animal')
                return `<button type="button" class="small-btn" onclick="openAnimalSpeciesDetail('${safeId}')">${icon('paw', 'icon-sm')} ${lab}</button>`;
            if (b.type === 'location')
                return `<button type="button" class="small-btn" onclick="openParkLocationDetail('${safeId}')">${icon('map', 'icon-sm')} ${lab}</button>`;
            if (b.type === 'cultural')
                return `<button type="button" class="small-btn" onclick="openCulturalStoryDetail('${safeId}')">${icon('book', 'icon-sm')} ${lab}</button>`;
            return `<button type="button" class="small-btn ghost-btn" disabled title="Open from original screen">${escapeHtml(String(b.type))}: ${lab}</button>`;
        })
        .join('');
    return `<div class="section-card sigts-dashboard-saved"><div class="section-header"><h3>${icon('bookmark', 'icon-sm')} Saved picks</h3></div><div class="info-chip-row" style="flex-wrap:wrap">${chips}</div></div>`;
}

/** Travel-style discovery header: hero search + horizontal category chips (tourist Home). */
function renderDiscoveryHomePanel() {
    const chipDefs = [
        ['animals', 'paw', 'Species'],
        ['map', 'map', 'Map'],
        ['culture', 'book', 'Culture'],
        ['info', 'info', 'Park info'],
        ['sightings', 'camera', 'Sightings'],
        ['ai_chat', 'feather', 'Chat']
    ];
    const chips = chipDefs
        .map(
            ([vid, ic, lab]) =>
                `<button type="button" class="sigts-disc-chip" onclick="navigateTo('${vid}')">${icon(ic, 'icon-md')}<span>${escapeHtml(lab)}</span></button>`
        )
        .join('');
    return `<section class="sigts-discovery-panel" aria-labelledby="sigts-discovery-heading">
        <div class="sigts-discovery-intro">
            <span class="sigts-discovery-eyebrow">Bwindi visitor guide</span>
            <h2 id="sigts-discovery-heading" class="sigts-discovery-heading">Explore the park</h2>
            <p class="sigts-discovery-tagline">Search wildlife, gates, trails, and cultural stories. Cache content from Profile for offline treks.</p>
        </div>
        <div class="sigts-discovery-search-row">
            <span class="sigts-discovery-search-prefix" aria-hidden="true">${icon('search', 'icon-md')}</span>
            <input id="sigtsUnifiedSearchInput" type="search" enterkeyhint="search" class="sigts-discovery-search-field" autocomplete="off" maxlength="220" placeholder="Try gorilla, Buhoma, permits…" onkeydown="if(event.key==='Enter'){event.preventDefault();runSigtsUnifiedSearch();}" />
            <button type="button" class="sigts-discovery-search-submit" onclick="runSigtsUnifiedSearch()">${icon('search', 'icon-sm')}</button>
        </div>
        <div class="sigts-discovery-chips-scroll" role="group" aria-label="Quick sections">${chips}</div>
        <div id="sigtsUnifiedSearchHighlight" class="sigts-discovery-search-hint" role="status" aria-live="polite" hidden></div>
        <div id="sigtsUnifiedSearchResults" class="sigts-discovery-results seasonal-list" hidden></div>
    </section>`;
}

async function renderSavedContent() {
    const rows =
        typeof Content?.readBookmarks === 'function'
            ? Content.readBookmarks()
            : Array.isArray(Content?.bookmarks)
              ? Content.bookmarks
              : [];
    const sorted = [...rows].sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')));
    const escAttr = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    if (!sorted.length) {
        return `<div class="sigts-saved-screen"><section class="sigts-saved-hero section-card">
            <div class="sigts-saved-hero-icon" aria-hidden="true">${icon('bookmark', 'icon-xl')}</div>
            <h3 class="sigts-saved-hero-title">Nothing saved yet</h3>
            <p class="animals-page-blurb">Open any species, map place, or culture story and tap the <strong>bookmark</strong> in the header to keep it here.</p>
            <div class="sigts-saved-hero-actions">
                <button type="button" class="login-btn" onclick="navigateTo('animals')">${icon('paw', 'icon-sm')} Browse species</button>
                <button type="button" class="small-btn ghost-btn" onclick="navigateTo('map')">${icon('map', 'icon-sm')} Open map</button>
            </div>
        </section></div>`;
    }
    const list = sorted
        .map((b) => {
            const rawId = String(b.id || '').trim();
            const safeId = escAttr(rawId);
            const title = escapeHtml(String(b.title || b.id || 'Item'));
            const meta = escapeHtml(String(b.type || ''));
            const when = escapeHtml(formatSigtsInstant(b.savedAt));
            let openFn = '';
            if (b.type === 'animal') openFn = `openAnimalSpeciesDetail('${safeId}')`;
            else if (b.type === 'location') openFn = `openParkLocationDetail('${safeId}')`;
            else if (b.type === 'cultural') openFn = `openCulturalStoryDetail('${safeId}')`;
            else openFn = `showToast('Open this item from its original tab.','info')`;
            const ic = b.type === 'location' ? 'map' : b.type === 'cultural' ? 'book' : b.type === 'animal' ? 'paw' : 'bookmark';
            const safeType = escAttr(String(b.type || ''));
            const remove =
                ['animal', 'location', 'cultural'].includes(String(b.type)) && rawId
                    ? `<button type="button" class="sigts-saved-row-remove" aria-label="Remove from saved" onclick="event.stopPropagation();sigtsRemoveSavedBookmark('${safeType}','${safeId}')">${icon(
                          'x',
                          'icon-sm'
                      )}</button>`
                    : '';
            return `<article class="sigts-saved-row"><button type="button" class="sigts-saved-row-main" onclick="${openFn}"><span class="sigts-saved-row-icon">${icon(ic, 'icon-md')}</span><span class="sigts-saved-row-text"><strong>${title}</strong><small>${meta} · saved ${when}</small></span><span class="sigts-saved-row-chevron" aria-hidden="true">${icon(
                'chevronRight',
                'icon-sm'
            )}</span></button>${remove}</article>`;
        })
        .join('');
    return `<div class="sigts-saved-screen"><div class="section-card"><div class="section-header"><h3>${icon('bookmark', 'icon-sm')} Your saved list</h3></div><p class="animals-page-blurb">Stored on this device. Remove items by opening them and tapping the bookmark again.</p></div><div class="sigts-saved-list">${list}</div></div>`;
}

async function renderDashboardContent() {
    const animals = await Content.getAnimals();
    const recommendations = await AI.getRecommendations(6);
    const seasonal = await AI.getSeasonalRecommendations();
    const personalized = await AI.getPersonalizedContentFeed(4).catch(() => []);
    const trending = await AI.getTrendingContent(5).catch(() => []);
    const profile = await AI.getUserProfile().catch(() => ({}));
    const shell = renderDashboardShell({
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
        seasonalActionLabel: 'Open tour help',
        seasonalFootnote: seasonal.conditionNote || '',
        animalCount: animals.length
    });
    const aiStrip = renderDashboardAiModuleStrip(recommendations, personalized, trending, profile);
    const tourismStrip = `${renderDiscoveryHomePanel()}${renderTourismBookmarksRow()}`;
    return `${tourismStrip}${shell}${aiStrip}${renderDashboardSpeciesSpotlight(animals)}`;
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
    seasonalFootnote = '',
    animalCount
}) {
    return `${renderDashboardQuickGrid(animalCount)}<div class="dashboard-feature-grid"><div class="section-card"><div class="section-header"><h3>${icon(primaryIcon, 'icon-sm')} ${primaryTitle}</h3></div><div id="recList">${primaryItems.map((item, index) => {
        const recClass = item.avatarType === 'icon' ? 'rec-card system-rec' : 'rec-card';
        const iconOnlyAvatar = item.avatarType === 'icon'
            ? `<div class="rec-avatar metric-avatar metric-avatar-${escapeHtml(item.metricColor || 'default')}" aria-hidden="true"><span class="metric-avatar-icon">${icon(item.iconName || 'info', 'icon-md')}</span></div>`
            : `<div class="rec-avatar ${item.avatarClass || getRecommendationPhotoClass(item, index)}" aria-hidden="true">${item.iconName ? `<span class="rec-symbol">${icon(item.iconName, 'icon-md')}</span>` : ''}</div>`;
        return `<div class="${recClass}">${iconOnlyAvatar}<div class="rec-info"><div class="rec-title">${escapeHtml(item.title)}</div>${item.match ? `<div class="rec-match">${escapeHtml(item.match)}</div>` : ''}<div class="rec-reason">${escapeHtml(item.reason)}</div></div><button class="rec-go" aria-label="Open">${icon(item.goIcon || 'map', 'icon-sm')}</button></div>`;
    }).join('') || '<div class="empty-state">No items available.</div>'}</div></div><div class="dashboard-quote-card"><blockquote>${escapeHtml(quote)}</blockquote></div></div><div class="section-card seasonal-card"><div class="section-header"><h3>${icon('leaf', 'icon-sm')} Seasonal: ${seasonalTitle}</h3></div><div class="seasonal-list">${seasonalItems.map((a) => `<div class="seasonal-item">• ${escapeHtml(a)}</div>`).join('') || '<div class="seasonal-item">• No seasonal updates available</div>'}</div>${seasonalFootnote ? `<p class="animals-page-blurb" style="padding:0 18px 12px;margin:0;">${escapeHtml(seasonalFootnote)}</p>` : ''}<div class="seasonal-bottom"><div class="seasonal-image-strip photo-leaf" aria-hidden="true"></div><button type="button" class="seasonal-action-btn" onclick="navigateTo('ai_chat')">${escapeHtml(seasonalActionLabel || 'View Suggestions')}</button></div></div>`;}

function renderDashboardAiModuleStrip(recommendations, personalized, trending, profile) {
    const pref =
        profile && typeof profile.preferenceScore === 'number'
            ? `<span class="status-badge neutral" style="margin-left:8px;">Interest signal ${(profile.preferenceScore * 100).toFixed(0)}%</span>`
            : '';
    const boosted = (recommendations || [])
        .slice(0, 4)
        .map(
            (r) =>
                `<button type="button" class="small-btn" onclick="window.sigtsBoostReco && window.sigtsBoostReco('${escapeHtml(String(r.id))}')">${icon('target', 'icon-sm')} ${escapeHtml(r.name)}</button>`
        )
        .join(' ');
    const pLines = (personalized || [])
        .map(
            (p) =>
                `<div class="seasonal-item"><strong>${escapeHtml(p.name)}</strong> <span class="tour-focus-count">${Math.round(Number(p.relevanceScore || 0) * 100)}%</span> — ${escapeHtml(p.type || '')}</div>`
        )
        .join('');
    const tLines = (trending || [])
        .map((t) => `<div class="seasonal-item">${escapeHtml(t.name)} — ${escapeHtml(t.reason || '')}</div>`)
        .join('');
    return `<div class="dashboard-feature-grid"><div class="section-card"><div class="section-header"><h3>${icon('paw', 'icon-sm')} Personalized content</h3>${pref}</div><div class="seasonal-list">${pLines || '<div class="seasonal-item">Browse Animals and Culture to train this list.</div>'}</div></div><div class="section-card"><div class="section-header"><h3>${icon('chart', 'icon-sm')} Popularity (this device)</h3></div><div class="seasonal-list">${tLines || '<div class="seasonal-item">Opens and catalogue views fill trending.</div>'}</div><div class="info-chip-row" style="padding:12px 16px 16px;flex-wrap:wrap;gap:8px;">${boosted}<button type="button" class="small-btn ghost-btn" onclick="navigateTo('ai_chat')">${icon('note', 'icon-sm')} Ask a question (NLP)</button></div></div></div>`;
}

async function renderAnimalsContent() {
    const animals = await Content.getAnimals();
    if (!animals.length) {
        return `<div class="section-card"><div class="empty-state">No animal records available yet. Run backend seed to load the Bwindi catalogue.</div></div>`;
    }

    const focus = getValidatedAnimalTourFocus();
    const filtered = animals.filter((a) => animalMatchesBwindiTourFocus(a, focus));
    const thumbs = buildTourFocusThumbnailMap(animals);
    const tourStrip = renderBwindiTourThemeStrip(animals, focus, thumbs);

    const filterBanner = '';

    const intro = `<div class="section-card animals-page-intro"><div class="section-header"><h3>${icon('leaf', 'icon-sm')} Bwindi biodiversity</h3></div><div class="animals-page-blurb">Browse the species catalogue for ranger-style notes across primates, forest birds, elephants, butterflies, and other Red List taxa. Use Tour help if you want AI-assisted prompts before or after your trek.</div><div class="info-chip-row"><button type="button" class="small-btn" onclick="navigateToAIWithPrompt(${JSON.stringify('Bwindi newcomer checklist: main sectors, wet vs dry pacing, gorilla visit etiquette (short bullets).')})">${icon('target', 'icon-sm')} Tour help: first trek</button><button type="button" class="small-btn" onclick="navigateToAIWithPrompt(${JSON.stringify('Birding from main Bwindi trailheads: which Albertine specialties are realistic without playback or nest pressure?')})">${icon('bird', 'icon-sm')} Tour help: birding</button></div></div>`;

    const searchToolbar = `<div class="section-card sigts-catalog-toolbar"><div class="section-header"><h3>${icon('search', 'icon-sm')} Find a species</h3></div><div class="info-chip-row" style="flex-wrap:wrap;"><input id="animals-catalog-search" type="search" class="auth-input" style="min-width:200px;flex:1;" placeholder="Search by name…" maxlength="220" autocomplete="off" /><button type="button" class="login-btn" onclick="applyAnimalsCatalogFilter()">${icon('search', 'icon-sm')} Filter</button><button type="button" class="small-btn ghost-btn" onclick="document.getElementById('animals-catalog-search').value='';applyAnimalsCatalogFilter();">Clear</button></div>${focus !== 'all' ? `<p class="animals-page-blurb" style="margin:8px 0 0;">Showing <strong>${focus.replace(/_/g, ' ')}</strong> — tap <strong>All species</strong> in themes above for the full list.</p>` : ''}</div>`;

    const cards = (filtered.length ? filtered : animals).map((animal) => renderAnimalSpeciesCardHtml(animal)).join('');

    return `${tourStrip}${intro}${searchToolbar}${filterBanner}<div id="animals-catalog-grid" class="animals-list animals-list--responsive">${cards}</div>`;
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
                const lid = escAttrBareUuid(loc.location_id || loc.id);
                const ltype = escapeHtml(String(loc.location_type || loc.type || 'location'));
                const popup = `<div><strong>${escapeHtml(loc.name || 'POI')}</strong><br>${ltype}<br>Trail: ${escapeHtml(difficulty)}<br><button type="button" class="small-btn" onclick="window.openParkLocationDetail('${lid}')">Details</button></div>`;
                return createDivMarker(coords.lat, coords.lng, markerClassForLocation(loc), popup);
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
                    return { name: p.name || 'POI', dist, id: p.location_id || p.id };
                })
                .filter(Boolean)
                .sort((a, b) => a.dist - b.dist)
                .slice(0, 4);
            const nearbyNode = document.getElementById('mapNearbyList');
            if (nearbyNode) {
                nearbyNode.innerHTML = nearby.length
                    ? nearby
                          .map(
                              (n) =>
                                  `• <a href="#" style="color:inherit;text-decoration:underline;" onclick="event.preventDefault();openParkLocationDetail('${escAttrBareUuid(n.id)}');">${escapeHtml(n.name)}</a> (${(n.dist / 1000).toFixed(2)} km)`
                          )
                          .join('<br>')
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
                <div class="story-title">${escapeHtml(featured.title_en || 'Untitled story')}</div>
                <div class="animal-teaser">${escapeHtml(truncateSnippet(featured.narrative_en || (featured.duration ? `About ${featured.duration}-minute listen.` : '') || 'Tap for full stewardship notes.', 140))}</div>
                <div class="animal-card-actions">
                    <button type="button" class="small-btn" onclick="event.stopPropagation(); navigateToAIWithPrompt(${JSON.stringify(culturalAIPromptFromRecord(featured))});">${icon('feather', 'icon-sm')} Let's Chat</button>
                    <button type="button" class="small-btn ghost-btn" onclick="event.stopPropagation(); submitContentHelpfulness('cultural', '${featId}', '${escapeHtml(featured.title_en || 'story')}');">${icon('target', 'icon-sm')} Helpful?</button>
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
                <div class="story-title">${escapeHtml(story.title_en || 'Untitled story')}</div>
                <div class="animal-teaser">${escapeHtml(truncateSnippet(story.narrative_en || story.cultural_significance || story.verification_badge || 'Tap for narrative + etiquette prompts.', 120))}</div>
                <div class="animal-card-actions">
                    <button type="button" class="small-btn" onclick="event.stopPropagation(); navigateToAIWithPrompt(${JSON.stringify(culturalAIPromptFromRecord(story))});">${icon('feather', 'icon-sm')} Let's Chat</button>
                    <button type="button" class="small-btn ghost-btn" onclick="event.stopPropagation(); submitContentHelpfulness('cultural', '${sid}', '${escapeHtml(story.title_en || 'story')}');">${icon('target', 'icon-sm')} Helpful?</button>
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

async function renderProfileContent() {
    const user = Auth.getCurrentUser() || { name: 'Tourist' };
    const isITManager = user?.role === 'it_manager' || user?.userType === 'it_manager';
    const isGuide = user?.role === 'guide' || user?.userType === 'guide';
    const isGuest = Boolean(user?.isGuest);

    let serverProfile = null;
    if (!isGuest) {
        try {
            serverProfile = await API.fetchUserProfile();
        } catch (_) {
            serverProfile = null;
        }
    }

    const firstNameRaw = String(serverProfile?.first_name || '').trim();
    const lastNameRaw = String(serverProfile?.last_name || '').trim();
    const emailRaw = String(serverProfile?.email || user.email || '').trim();
    const phoneRaw = String(serverProfile?.phone || '').trim();
    const photoUrlRaw = String(serverProfile?.profile_pic_url || '').trim();
    const emailVerified = Boolean(serverProfile?.email_verified);
    const nationalityRaw = String(serverProfile?.role_data?.nationality || '').trim();

    let interestSet = ['wildlife', 'nature'];
    try {
        if (typeof AI !== 'undefined' && AI.getUserProfile) {
            const p = await AI.getUserProfile();
            if (Array.isArray(p.interests) && p.interests.length) interestSet = p.interests;
        }
    } catch (_) {
        /**/
    }

    if (serverProfile?.user_type === 'tourist' && serverProfile?.role_data?.interests != null) {
        try {
            const rd = serverProfile.role_data.interests;
            const arr = typeof rd === 'string' ? JSON.parse(rd) : rd;
            if (Array.isArray(arr) && arr.length) {
                interestSet = [...new Set([...interestSet, ...arr.map(String)])];
            }
        } catch (_) {
            /**/
        }
    }

    let bioLocal = '';
    try {
        bioLocal = localStorage.getItem('sigts_profile_bio_v1') || '';
    } catch (_) {
        bioLocal = '';
    }

    let hasFeedback = false;
    try {
        const fb = await API.getMyFeedback(1);
        hasFeedback = Array.isArray(fb) && fb.length > 0;
    } catch (_) {
        hasFeedback = false;
    }

    const loc = window.Geofence?.currentLocation || window.AppState?.currentLocation;
    const lat = loc && Number.isFinite(Number(loc.lat)) ? Number(loc.lat) : null;
    const lng = loc && Number.isFinite(Number(loc.lng)) ? Number(loc.lng) : null;
    let insidePark = null;
    if (lat != null && lng != null && typeof window.Geofence?.isInsidePark === 'function') {
        try {
            insidePark = !!window.Geofence.isInsidePark(lat, lng);
        } catch (_) {
            insidePark = null;
        }
    }

    const offlineReady = Number(localStorage.getItem('offline_version') || '0') > 0;
    const phoneOk = phoneRaw.replace(/[^0-9+]/g, '').length >= 6;
    const nameOk = firstNameRaw.length + lastNameRaw.length > 1;

    const completionItems = [
        { ok: nameOk, weight: 12, label: 'Name on profile', action: 'scroll', scrollId: 'profile-section-personal' },
        { ok: emailRaw.length > 3, weight: 10, label: 'Email on account', action: 'scroll', scrollId: 'profile-section-personal' },
        { ok: phoneOk, weight: 18, label: 'Phone number', action: 'scroll', scrollId: 'profile-section-personal' },
        {
            ok: emailVerified,
            weight: 12,
            label: 'Email verified',
            action: emailVerified ? 'scroll' : 'hint-verify',
            scrollId: 'profile-section-personal'
        },
        { ok: lat != null && lng != null, weight: 18, label: 'GPS / park location', action: 'scroll', scrollId: 'profile-section-location' },
        { ok: (interestSet || []).length >= 2, weight: 12, label: 'AI tour interests', action: 'scroll', scrollId: 'profile-section-ai' },
        {
            ok: offlineReady,
            weight: 10,
            label: 'Offline content pack',
            action: 'scroll',
            scrollId: isGuest ? null : 'profile-section-offline'
        }
    ];
    if (!isITManager && !isGuest) {
        completionItems.push({
            ok: hasFeedback,
            weight: 8,
            label: 'Submitted feedback',
            action: 'scroll',
            scrollId: 'profile-section-feedback'
        });
    }
    let completion = 0;
    completionItems.forEach((r) => {
        completion += r.ok ? r.weight : 0;
    });
    completion = Math.min(100, Math.round(completion));

    const firstName = escapeHtml(firstNameRaw);
    const lastName = escapeHtml(lastNameRaw);
    const email = escapeHtml(emailRaw);
    const phone = escapeHtml(phoneRaw);
    const photoUrl = escapeHtml(photoUrlRaw);
    const nationality = escapeHtml(nationalityRaw);

    const interestChips = [
        { id: 'wildlife', label: 'Wildlife' },
        { id: 'bird', label: 'Birding' },
        { id: 'culture', label: 'Culture' },
        { id: 'photography', label: 'Photography' },
        { id: 'trek', label: 'Trekking' },
        { id: 'primate', label: 'Primates' },
        { id: 'nature', label: 'Nature walks' }
    ]
        .map(
            (c) =>
                `<label class="auth-check profile-check"><input type="checkbox" class="sigts-ai-interest-cb" value="${escapeHtml(c.id)}" ${interestSet.includes(c.id) ? 'checked' : ''}/> ${escapeHtml(c.label)}</label>`
        )
        .join('');

    const avatarInner =
        photoUrlRaw && /^https?:\/\//i.test(photoUrlRaw)
            ? `<img src="${escapeHtml(photoUrlRaw)}" alt="" class="profile-photo-img" loading="lazy" decoding="async" />`
            : `${icon('user', 'icon-xl')}`;

    const personalReadonly = isGuest ? 'disabled' : '';
    const guestBanner = isGuest
        ? `<div class="profile-guest-banner"><strong>Guest session.</strong> Park-only access — register for a full profile, sightings, and sync.</div>`
        : '';

    const profileLoadBanner =
        !isGuest && !serverProfile
            ? `<div class="profile-sync-banner" role="status"><strong>Could not load account details from the server.</strong> You can still use this tab; check your connection and open Profile again, or continue editing if fields appear below.</div>`
            : '';

    const navBtn = (sectionId, label) =>
        `<button type="button" class="profile-nav-link" onclick="sigtsProfileScrollTo('${sectionId}')">${escapeHtml(label)}</button>`;
    const feedbackBlock =
        !isITManager && !isGuest
            ? `<section class="profile-panel profile-panel--wide" id="profile-section-feedback">
        <div class="profile-panel-head"><h3>${icon('message', 'icon-sm')} Feedback</h3><span class="profile-panel-hint">Improve SIGTS from the field</span></div>
        <div class="profile-panel-body">
        <label class="auth-field"><span class="auth-field-label">Rate your recent experience</span><select id="feedbackRating" class="auth-select"><option value="5">5 - Excellent</option><option value="4">4 - Good</option><option value="3">3 - Average</option><option value="2">2 - Poor</option><option value="1">1 - Very Poor</option></select></label>
        <label class="auth-field"><span class="auth-field-label">Category</span><select id="feedbackCategory" class="auth-select"><option value="tour">Tour</option><option value="guide">Guide</option><option value="content">Content</option><option value="app">App</option><option value="general">General</option><option value="bug_report">Bug Report</option><option value="feature_suggestion">Feature Suggestion</option><option value="survey">Survey</option><option value="nps">NPS</option></select></label>
        <label class="auth-field"><span class="auth-field-label">Tour Session ID (optional)</span><input id="feedbackTourSession" class="auth-input" placeholder="Paste tour session UUID if available" /></label>
        <label class="auth-field"><span class="auth-field-label">NPS Score (0-10, optional)</span><input id="feedbackNPS" type="number" min="0" max="10" class="auth-input" placeholder="How likely are you to recommend SIGTS?" /></label>
        <label class="auth-field"><span class="auth-field-label">Screenshot URL (optional)</span><input id="feedbackScreenshot" class="auth-input" placeholder="For bug reports: screenshot link" /></label>
        <label class="auth-field"><span class="auth-field-label">Comment</span><textarea id="feedbackComment" class="auth-input profile-textarea" placeholder="Share what worked and what can improve..."></textarea></label>
        <div class="profile-btn-row">
            <button type="button" class="small-btn" onclick="submitUserFeedback()">Submit Feedback</button>
            <button type="button" class="small-btn" onclick="submitSatisfactionSurvey()">Quick Survey</button>
            <button type="button" class="small-btn" onclick="submitNPSFeedback()">Submit NPS</button>
            ${!isGuide ? '<button type="button" class="small-btn" onclick="submitTourCompletionFeedback()">Rate Last Tour</button><button type="button" class="small-btn" onclick="submitGuidePerformanceFeedback()">Rate Guide</button>' : ''}
            <button type="button" class="small-btn" onclick="submitBugReportPrompt()">Report Bug</button>
            <button type="button" class="small-btn" onclick="submitFeatureSuggestionPrompt()">Suggest Feature</button>
        </div>
        <div id="feedbackList" class="seasonal-list profile-feedback-list"><div class="seasonal-item">Loading your recent feedback...</div></div>
        </div></section>`
            : !isITManager && isGuest
              ? `<section class="profile-panel profile-panel--wide" id="profile-section-feedback"><div class="profile-panel-head"><h3>${icon('message', 'icon-sm')} Feedback</h3></div><div class="profile-panel-body"><p class="ui-modal-muted">Create a full account to submit structured feedback and NPS.</p></div></section>`
              : '';

    const secureBlock = !isGuest
        ? `<section class="profile-panel" id="profile-section-secure">
        <div class="profile-panel-head"><h3>${icon('shield', 'icon-sm')} Secure</h3></div>
        <div class="profile-panel-body profile-secure-grid">
            <button type="button" class="profile-secure-tile" onclick="navigateTo('login'); showToast('Use Forgot password on the sign-in screen.', 'info');">
                ${icon('key', 'icon-md')}<span>Password</span><small>Reset via email from login</small>
            </button>
            <button type="button" class="profile-secure-tile" onclick="handleMFASetup()">${icon('shield', 'icon-md')}<span>Access / MFA</span><small>Authenticator or SMS at sign-in</small></button>
            <div class="profile-secure-tile profile-secure-tile--muted">${icon('clock', 'icon-md')}<span>Sessions</span><small>Idle timeout protects your account on shared devices</small></div>
        </div></section>`
        : '';

    const deactivateBlock = !isGuest
        ? `<section class="profile-panel profile-panel--danger-zone" id="profile-section-delete">
        <div class="profile-panel-head"><h3>${icon('trash', 'icon-sm')} Account</h3></div>
        <div class="profile-panel-body">
            <p class="animals-page-blurb">Deactivating ends access immediately. An IT manager must re-enable your account before you can sign in again.</p>
            <button type="button" class="small-btn danger profile-delete-btn" onclick="deactivateMyAccountFromProfile()">${icon('user', 'icon-sm')} Delete / deactivate account</button>
        </div></section>`
        : '';

    return `<div class="profile-layout">
    <aside class="profile-layout-nav" aria-label="Profile sections">
        <div class="profile-nav-brand"><span class="profile-nav-logo">${icon('map', 'icon-sm')}</span><span>SIGTS</span></div>
        <div class="profile-nav-group">
            <div class="profile-nav-label">Profile</div>
            ${navBtn('profile-section-photo', 'Photo')}
            ${navBtn('profile-section-personal', 'Personal info')}
            ${navBtn('profile-section-location', 'Location')}
            ${navBtn('profile-section-bio', 'Bio')}
            ${navBtn('profile-section-ai', 'AI interests')}
            ${!isITManager ? navBtn('profile-section-feedback', 'Feedback') : ''}
            ${navBtn('profile-section-notifications', 'Notifications')}
            ${!isGuest ? navBtn('profile-section-offline', 'Offline & sync') : ''}
            ${!isGuest ? navBtn('profile-section-secure', 'Secure') : ''}
        </div>
        <div class="profile-nav-footer">
            <button type="button" class="profile-nav-link profile-nav-link--ghost" onclick="downloadOfflineContent()">${icon('download', 'icon-sm')} Offline pack</button>
            ${!isGuest ? `<button type="button" class="profile-nav-link profile-nav-link--ghost" onclick="handleMFASetup()">${icon('shield', 'icon-sm')} MFA setup</button>` : ''}
            <button type="button" class="profile-nav-link profile-nav-link--ghost" onclick="Auth.logout()">${icon('logout', 'icon-sm')} Log out</button>
            ${!isGuest ? `<button type="button" class="profile-nav-link profile-nav-link--danger" onclick="sigtsProfileScrollTo('profile-section-delete')">${icon('trash', 'icon-sm')} Delete account</button>` : ''}
        </div>
    </aside>

    <div class="profile-layout-main">
        <header class="profile-main-header">
            <h1 class="profile-main-title">Edit profile</h1>
            <p class="profile-main-sub">${escapeHtml(formatRoleName(user.role || user.userType || 'tourist'))} · ${escapeHtml(user.name || user.username || 'Visitor')}</p>
        </header>
        ${guestBanner}

        <section class="profile-panel" id="profile-section-photo">
            <div class="profile-panel-head"><h3>Profile photo</h3><span class="profile-panel-hint">Square image looks best in headers</span></div>
            <div class="profile-panel-body profile-photo-row">
                <div class="profile-avatar-large" aria-hidden="true">${avatarInner}</div>
                <div class="profile-photo-fields">
                    <label class="auth-field"><span class="auth-field-label">Image URL</span><input id="profilePhotoUrl" class="auth-input" placeholder="https://…" value="${photoUrl}" ${personalReadonly} /></label>
                    <p class="ui-modal-muted">At least 400×400 px recommended. Use a direct HTTPS link (JPG or PNG).</p>
                    <div class="profile-btn-row">
                        <button type="button" class="small-btn btn-primary" onclick="saveProfilePhotoUrl()" ${personalReadonly ? 'disabled' : ''}>Save photo</button>
                    </div>
                </div>
            </div>
        </section>

        <section class="profile-panel" id="profile-section-personal">
            <div class="profile-panel-head"><h3>Personal info</h3>${!isGuest ? `<button type="button" class="profile-panel-edit" onclick="sigtsProfileScrollTo('profile-section-personal')">${icon('edit', 'icon-sm')} Edit</button>` : ''}</div>
            <div class="profile-panel-body profile-form-grid">
                <label class="auth-field"><span class="auth-field-label">First name</span><input id="profileFirstName" class="auth-input" value="${firstName}" autocomplete="given-name" ${personalReadonly} /></label>
                <label class="auth-field"><span class="auth-field-label">Last name</span><input id="profileLastName" class="auth-input" value="${lastName}" autocomplete="family-name" ${personalReadonly} /></label>
                <label class="auth-field profile-field-span2"><span class="auth-field-label">Email</span><input id="profileEmail" class="auth-input" value="${email}" readonly title="Email changes are not supported in-app" /></label>
                <label class="auth-field profile-field-span2"><span class="auth-field-label">Phone</span><input id="profilePhone" class="auth-input" type="tel" value="${phone}" autocomplete="tel" placeholder="+256…" ${personalReadonly} /></label>
                ${!isGuide && !isITManager && !isGuest ? `<label class="auth-field profile-field-span2"><span class="auth-field-label">Nationality</span><input id="profileNationality" class="auth-input" value="${nationality}" autocomplete="country-name" /></label>` : ''}
                <div class="profile-field-span2 profile-btn-row">
                    <button type="button" class="small-btn btn-primary" onclick="saveProfilePersonalFromPanel()" ${personalReadonly ? 'disabled' : ''}>Save changes</button>
                </div>
            </div>
        </section>

        <section class="profile-panel" id="profile-section-location">
            <div class="profile-panel-head"><h3>${icon('pin', 'icon-sm')} Park location</h3><span class="profile-panel-hint">Used for geofencing and ranger visibility</span></div>
            <div class="profile-panel-body">
                <div class="profile-location-status ${insidePark === true ? 'is-inside' : insidePark === false ? 'is-outside' : 'is-unknown'}">
                    <strong>${insidePark === true ? 'Inside park boundary' : insidePark === false ? 'Outside park boundary' : 'GPS not yet available'}</strong>
                    <p class="ui-modal-muted">${lat != null && lng != null ? `Last fix: ${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'Allow location in the browser, then open the Map tab to refresh coordinates.'}</p>
                </div>
                <div class="profile-btn-row">
                    <button type="button" class="small-btn" onclick="navigateTo('map')">${icon('map', 'icon-sm')} Open map</button>
                    <button type="button" class="small-btn ghost-btn" onclick="tryRefreshProfileLocation()">${icon('target', 'icon-sm')} Refresh GPS</button>
                </div>
            </div>
        </section>

        <section class="profile-panel" id="profile-section-bio">
            <div class="profile-panel-head"><h3>Bio</h3><span class="profile-panel-hint">Stored on this device for drafts and notes</span></div>
            <div class="profile-panel-body">
                <label class="auth-field"><span class="auth-field-label">About you</span><textarea id="profileBioLocal" class="auth-input profile-textarea" placeholder="Interests, languages, accessibility needs for guides…">${escapeHtml(bioLocal)}</textarea></label>
                <div class="profile-btn-row">
                    <button type="button" class="small-btn btn-primary" onclick="saveProfileBioLocal()">Save bio locally</button>
                </div>
            </div>
        </section>

        <section class="profile-panel profile-panel--wide" id="profile-section-ai">
            <div class="profile-panel-head"><h3>${icon('target', 'icon-sm')} AI tour interests</h3><span class="profile-panel-hint">Dashboard ranking &amp; suggestions</span></div>
            <div class="profile-panel-body">
                <p class="animals-page-blurb">Synced with general profile interests for tourists. Voice: use the microphone on Tour help — speech stays in-browser until you send text.</p>
                <div class="profile-interest-grid">${interestChips}</div>
                <button type="button" class="small-btn btn-primary" onclick="saveAiTourInterestsFromProfile()">${icon('target', 'icon-sm')} Save AI interests</button>
            </div>
        </section>

        ${feedbackBlock}

        <section class="profile-panel" id="profile-section-notifications">
            <div class="profile-panel-head"><h3>${icon('bell', 'icon-sm')} Notifications &amp; privacy</h3></div>
            <div class="profile-panel-body"><div id="profileConsentsMount" class="profile-consents-mount"><p class="ui-modal-muted">Loading preferences…</p></div></div>
        </section>

        ${!isGuest ? `<section class="profile-panel" id="profile-section-offline">
            <div class="profile-panel-head"><h3>${icon('download', 'icon-sm')} Offline &amp; sync</h3></div>
            <div class="profile-panel-body">
                <p class="animals-page-blurb">Cache animals, map tiles, and safety copy before you lose signal inside the forest.</p>
                <button type="button" class="small-btn" onclick="downloadOfflineContent()">${icon('download', 'icon-sm')} Download offline content</button>
            </div></section>` : ''}

        ${secureBlock}
        ${deactivateBlock}
    </div>

    <aside class="profile-layout-aside" aria-label="Profile completion">
        <div class="profile-completion-card">
            <h3>Complete your profile</h3>
            <div class="profile-completion-ring" style="--p:${completion};" aria-label="${completion}% complete">
                <div class="profile-completion-ring-inner"><strong>${completion}%</strong><span>done</span></div>
            </div>
            <ul class="profile-completion-list">
                ${completionRows
                    .map(
                        (r) =>
                            `<li class="${r.ok ? 'is-done' : ''}"><span class="profile-completion-check">${r.ok ? icon('check', 'icon-sm') : '○'}</span><span>${escapeHtml(r.label)}</span><span class="profile-completion-w">${r.weight}%</span></li>`
                    )
                    .join('')}
            </ul>
            ${isGuest ? `<p class="ui-modal-muted">Guest progress is for this session only.</p>` : ''}
        </div>
    </aside>
</div>`;
}

/** Safe for inline HTML attributes fed with UUIDs only. */
function escAttrBareUuid(id) {
    return String(id || '').replace(/[^a-zA-Z0-9-]/g, '');
}

function formatSigtsInstant(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short'
        });
    } catch (_) {
        return String(iso);
    }
}

async function renderInfoContent() {
    const planPrompt = JSON.stringify(
        'One-week low-footprint trekking plan in southwest Uganda, Bwindi core: daily rhythm, water, altitude, tipping, rainforest kit, radio check with guides.');
    const conservationPrompt = JSON.stringify(
        'Bwindi conservation overview in plain language for tourists: key species groups, protection pressures, and why responsible trekking matters.');
    const birdPrompt = JSON.stringify(
        'Rough bird tally people quote for Bwindi; Albertine families worth learning without stressing nests or playback.');

    let weather = null;
    let catalogMeta = null;
    let faqs = [];
    let tips = [];
    let guide = [];
    try {
        weather = await API.getParkWeatherForecast();
        if (!weather) {
            const w = await Content.getWeather?.();
            if (w?.temperature !== undefined) {
                weather = {
                    temperatureC: w.temperature,
                    condition: w.condition || 'Partly cloudy / mist',
                    humidityPct: w.humidity,
                    forecastSlices: []
                };
            }
        }
    } catch (_) {
        weather = null;
    }

    try {
        [catalogMeta, faqs, tips, guide] = await Promise.all([
            API.getContentCatalogMeta().catch(() => null),
            API.getFaqs().catch(() => []),
            API.getSafetyTips().catch(() => []),
            API.getParkGuide().catch(() => [])
        ]);
    } catch (_) {
        /**/
    }

    const offlineV = Number(localStorage.getItem('offline_version') || '0');

    const guideHtml =
        guide && guide.length
            ? `<div class="section-card sigts-info-guide"><div class="section-header"><h3>${icon('info', 'icon-sm')} Park fees & rules (structured)</h3></div><div style="padding:0 18px 16px;">${guide
                  .map(
                      (item) =>
                          `<div style="margin-top:14px;"><strong>${escapeHtml(item.category || 'general').replace(/_/g, ' ')} · ${escapeHtml(item.title || 'Note')}</strong><p>${escapeHtml(
                              item.content_en || ''
                          )}</p></div>`
                  )
                  .join('')}</div></div>`
            : `<div class="section-card"><div class="section-header"><h3>${icon('info', 'icon-sm')} Park fees & rules</h3></div><p class="animals-page-blurb" style="padding:16px;margin:0;">Connect once and download offline content from Profile; structured fees and rules populate after the catalogue sync runs.</p></div>`;

    const weatherHtml = weather
        ? `<div class="section-card"><div class="section-header"><h3>${icon('rain', 'icon-sm')} Weather snapshot</h3></div><div style="padding:16px;line-height:1.6;">
            <strong>${escapeHtml(String(weather.label || 'Bwindi sector'))}</strong><br/>
            ${escapeHtml(String(weather.condition || 'Forecast'))} • <strong>${escapeHtml(String(weather.temperatureC))} °C</strong>
            ${Number.isFinite(weather.humidityPct) ? ` • Humidity ~${weather.humidityPct}%` : ''}
            ${Number.isFinite(weather.rainProbabilityPct)
            ? `<br>Rain outlook (next slices): ~${weather.rainProbabilityPct}% chance now`
            : ''}
           </div></div>`
        : '';

    const safetyHtml =
        tips && tips.length
            ? `<div class="section-card"><div class="section-header"><h3>${icon('shield', 'icon-sm')} Safety tips</h3></div><div style="padding:12px 18px;">${tips
                  .slice()
                  .sort((a, b) => Number(a.priority || 9) - Number(b.priority || 9))
                  .map(
                      (tip) =>
                          `<div class="seasonal-item" style="margin-bottom:8px;"><strong>${escapeHtml(tip.category || '')} • ${escapeHtml(
                              tip.title || 'Tip'
                          )}</strong><br/>${escapeHtml(tip.content || '')}<br/><span style="opacity:.72;">Priority ${escapeHtml(String(tip.priority ?? '–'))}</span></div>`
                  )
                  .join('')}</div></div>`
            : '';

    const faqsHtml =
        faqs && faqs.length
            ? `<div class="section-card"><div class="section-header"><h3>${icon('note', 'icon-sm')} FAQs</h3></div><div style="padding:12px 18px;">${faqs
                  .map(
                      (faq) =>
                          `<div class="seasonal-item" style="margin-bottom:10px;"><strong>${escapeHtml(faq.category || '').replace(/_/g, ' ')}</strong><details style="margin-top:6px;"><summary>${escapeHtml(
                              faq.question_en || ''
                          )}</summary><p>${escapeHtml(faq.answer_en || '')}</p><div style="margin-top:6px;"><button type="button" class="small-btn ghost-btn" onclick="sigtsSubmitFaqHelpful('${escAttrBareUuid(faq.faq_id)}')">${icon('smile', 'icon-sm')} Mark helpful (${escapeHtml(String(faq.helpful_count ?? 0))})</button><button type="button" class="small-btn ghost-btn" onclick="submitContentHelpfulness('faq','${escAttrBareUuid(faq.faq_id)}', ${JSON.stringify(faq.question_en || 'FAQ')} )">${icon('target', 'icon-sm')} Content feedback</button></div></details></div>`
                  )
                  .join('')}</div></div>`
            : '';

    const metaCounts = catalogMeta?.counts || {};
    const metaTimes = catalogMeta?.updated_at || {};
    const versionHtml = `<div class="section-card"><div class="section-header"><h3>${icon('clock', 'icon-sm')} Catalogue & offline version</h3></div><div style="padding:16px;">
        <strong>Offline pack rev.</strong> ${escapeHtml(String(offlineV))}<br/>
        <strong>Server catalogue rows</strong> — Animals: ${escapeHtml(String(metaCounts.animals ?? '—'))}, Locations: ${escapeHtml(String(metaCounts.locations ?? '—'))}<br/>
        <strong>Last updated (UTC snapshot)</strong><br/>
        Animals: ${escapeHtml(formatSigtsInstant(metaTimes.animals))}<br/>
        Locations: ${escapeHtml(formatSigtsInstant(metaTimes.locations))}<br/>
        FAQs: ${escapeHtml(formatSigtsInstant(metaTimes.faqs))}<br/>
        Safety tips: ${escapeHtml(formatSigtsInstant(metaTimes.safety_tips))}<br/>
        Park guide: ${escapeHtml(formatSigtsInstant(metaTimes.park_guide))}
       </div></div>`;

    return `${weatherHtml}<div class="section-card"><div class="section-header"><h3>${icon('target', 'icon-sm')} Park snapshot</h3></div><div class="park-info-copy">Roughly <strong>331 km²</strong> of steep montane rainforest on the Albertine Rift shoulder, known for mountain gorillas, rich birdlife, elephants, diverse primates, and dense montane vegetation. SIGTS stitches maps, ranger copy, offline packs, and this app’s Tour help tab so groups can cross-check ecology, etiquette, culture, and safety on the trail.</div><div class="info-chip-row"><button type="button" class="small-btn" onclick="navigateToAIWithPrompt(${conservationPrompt});">${icon('book', 'icon-sm')} Tour help: conservation gist</button><button type="button" class="small-btn" onclick="navigateToAIWithPrompt(${birdPrompt});">${icon('bird', 'icon-sm')} Tour help: birds</button><button type="button" class="small-btn" onclick="navigateToAIWithPrompt(${planPrompt});">${icon('map', 'icon-sm')} Tour help: week pacing</button></div><button type="button" class="small-btn ghost-btn" style="margin-top:10px;" onclick="submitContentHelpfulness('info', '', 'Park snapshot')">${icon('target', 'icon-sm')} Helpful?</button></div>
${guideHtml}
${safetyHtml}
${faqsHtml}
${versionHtml}
    <div class="section-card"><div class="section-header"><h3>${icon('clock', 'icon-sm')} Opening Hours</h3></div><div style="padding:16px;">Typical UWA gate window: <strong>06:00 to 19:00</strong> (confirm with your issued permit).<div class="info-chip-row" style="margin-top:10px;"><button type="button" class="small-btn" onclick="navigateToAIWithPrompt(${JSON.stringify('Packing: dawn gorilla briefing vs afternoon forest walk in Bwindi.')});">${icon('target', 'icon-sm')} Tour help: gear timing</button></div><button class="small-btn" style="margin-top:10px;" onclick="submitContentHelpfulness('info', '', 'Opening Hours')">${icon('target', 'icon-sm')} Helpful?</button></div></div>
    <div class="section-card"><div class="section-header"><h3>${icon('phone', 'icon-sm')} Emergency</h3></div><div style="padding:16px;">${icon('shield', 'icon-sm')} UWA / emergency coordination: replace placeholder with live operations desk numbers before production.<br><button type="button" class="small-btn" style="margin-top:10px;" onclick="navigateToAIWithPrompt(${JSON.stringify('Trail injury before medics: who gets called first on a Bwindi trek (order of escalation).')});">${icon('target', 'icon-sm')} Tour help: casualty chain</button><br><button class="small-btn" style="margin-top:10px;" onclick="submitContentHelpfulness('info', '', 'Emergency Contacts')">${icon('target', 'icon-sm')} Helpful?</button></div></div>`;
}

function renderAIChatContent() {
    return `<div class="section-card ai-chat-panel">
        <div class="section-header ai-chat-panel-header"><h3>${icon('feather', 'icon-sm')} Bwindi assistant</h3><button type="button" class="small-btn ghost-btn" onclick="clearSigtsChatThread()">Clear chat</button></div>
        <p id="aiPrefillBanner" class="ai-prefill-banner" aria-live="polite">Animals, Culture, or Info can drop a draft here. Shift+Enter adds a line; Enter sends.</p>
        <div id="aiChatMessages" class="ai-chat-messages" role="log" aria-relevant="additions text" aria-live="polite">${getSigtsChatInitialMessagesHtml()}</div>
    </div>
    <div class="ai-chat-composer-float" role="region" aria-label="Chat composer">
        <div class="ai-chat-composer">
            <textarea id="aiChatInput" class="auth-input ai-chat-textarea" rows="1" placeholder="Ask about your Bwindi visit…" onkeydown="handleAIChatInputKeydown(event)" oninput="aiChatAutosizeTextarea(this)"></textarea>
            <button type="button" id="aiChatMicBtn" class="small-btn" title="Speak your question (browser speech recognition)" onclick="startTourHelpVoiceCapture()">${icon('mic', 'icon-sm')} Mic</button>
            <button type="button" class="login-btn" id="aiChatSendBtn" onclick="sendAIChatMessage()">Send</button>
        </div>
    </div>`;
}

async function renderGuideDashboard() {
    const guideManager = getGuideOpsManager();
    const settled = await Promise.allSettled([
        guideManager.getGuideDashboard(),
        Content.getAnimals(),
        API.getTourScheduleView('weekly', new Date().toISOString()),
        API.getGuideProfile(),
        API.getGuidePerformance(),
        API.getGuideEmergencyContacts()
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
    const weeklyView = settled[2].status === 'fulfilled' ? settled[2].value : { tours: [] };
    const guideProfile = settled[3].status === 'fulfilled' ? settled[3].value?.profile : null;
    const performance = settled[4].status === 'fulfilled' ? settled[4].value : null;
    const emergencyContacts = settled[5].status === 'fulfilled' ? (settled[5].value?.contacts || []) : [];
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
    const [tourDetails, guestList, activeMode] = await Promise.all([
        todaysTour?.tour_session_id ? API.getTourPreparation(todaysTour.tour_session_id) : null,
        todaysTour?.tour_session_id ? API.getTourGuestList(todaysTour.tour_session_id) : null,
        guideManager.activeTour?.tour_session_id ? API.getActiveTourMode(guideManager.activeTour.tour_session_id) : null
    ]);
    const participants = Array.isArray(guestList?.guests) ? guestList.guests : [];
    const activeGuests = Array.isArray(activeMode?.live_map?.guests) ? activeMode.live_map.guests : [];
    const weeklyRows = Array.isArray(weeklyView?.tours) ? weeklyView.tours : [];
    const prepChecklist = Array.isArray(tourDetails?.checklist) ? tourDetails.checklist : [];
    const profileLine = guideProfile
        ? `${escapeHtml(guideProfile.certification_level || 'guide')} • ${escapeHtml(String(guideProfile.languages || '[]'))}`
        : 'Profile unavailable';
    return `<div class="guide-dashboard">${renderDashboardShell({
        primaryTitle: "Today's Tours",
        primaryIcon: 'clock',
        primaryItems: guideItems,
        quote: '"Great guiding turns every trek into a story."',
        seasonalTitle: `${icon('target', 'icon-sm')} Live Guide Status`,
        seasonalItems: [
            `Total tours: ${dashboard.stats.totalTours}`,
            `Guests served: ${dashboard.stats.totalGuests}`,
            `Average rating: ${performance?.average_rating || dashboard.stats.averageRating}`,
            `Shift: ${dashboard.activeShift ? 'On duty' : 'Off duty'}`
        ],
        seasonalActionLabel: dashboard.activeShift ? 'Clock Out' : 'Clock In',
        animalCount: animals.length
    })}<div class="dashboard-feature-grid"><div class="section-card"><div class="section-header"><h3>${icon('clock', 'icon-sm')} Tour Schedule (Today)</h3></div><div class="seasonal-list">${(dashboard.today || []).length ? dashboard.today.map((t) => `<div class="seasonal-item"><strong>${escapeHtml(t.route_name || 'Tour Route')}</strong> - ${new Date(t.scheduled_start).toLocaleTimeString()} (${t.confirmed_guests || t.group_size || 0} guests) <button class="small-btn" onclick="startTour('${t.tour_session_id}')">Start</button> <button class="small-btn" onclick="openTourPreparation('${t.tour_session_id}')">Prepare</button></div>`).join('') : '<div class="seasonal-item">No tours today.</div>'}</div></div><div class="section-card"><div class="section-header"><h3>${icon('grid', 'icon-sm')} Weekly Assignments</h3></div><div class="seasonal-list">${weeklyRows.length ? weeklyRows.slice(0, 8).map((t) => `<div class="seasonal-item">${new Date(t.scheduled_start).toLocaleDateString()} ${new Date(t.scheduled_start).toLocaleTimeString()} - ${escapeHtml(t.route_name || 'Route')} (${t.confirmed_guests || t.group_size || 0})</div>`).join('') : '<div class="seasonal-item">No weekly assignments.</div>'}</div></div></div><div class="dashboard-feature-grid"><div class="section-card"><div class="section-header"><h3>${icon('users', 'icon-sm')} Guest List Management</h3></div><div class="seasonal-list">${participants.length ? participants.slice(0, 10).map((p) => `<div class="seasonal-item">${escapeHtml(p.first_name || p.username || 'Tourist')} ${escapeHtml(p.last_name || '')} • ${escapeHtml(p.nationality || 'N/A')} <button class="small-btn" onclick="openGuestProfile('${p.tourist_id}')">Profile</button></div>`).join('') : '<div class="seasonal-item">No participants assigned yet.</div>'}</div></div><div class="section-card"><div class="section-header"><h3>${icon('target', 'icon-sm')} Tour Preparation Checklist</h3></div><div class="seasonal-list">${prepChecklist.length ? prepChecklist.map((c) => `<div class="seasonal-item">${c.done ? '✅' : '⬜'} ${escapeHtml(c.label || c.key)}</div>`).join('') : '<div class="seasonal-item">No checklist loaded.</div>'}</div></div></div><div class="dashboard-feature-grid"><div class="section-card"><div class="section-header"><h3>${icon('map', 'icon-sm')} Active Tour Mode</h3></div><div class="seasonal-list"><div class="seasonal-item">Guide profile: ${profileLine}</div><div class="seasonal-item">Tracked guests: ${activeGuests.length}</div><div class="seasonal-item">Elapsed: ${activeMode?.timer?.elapsed_minutes ?? 0} min • Remaining: ${activeMode?.timer?.remaining_minutes ?? 'N/A'} min</div>${activeGuests.slice(0, 5).map((g) => `<div class="seasonal-item">${escapeHtml(g.name || 'Guest')} - ${g.position ? `${Number(g.position.lat).toFixed(4)}, ${Number(g.position.lng).toFixed(4)}` : 'No GPS'}</div>`).join('') || ''}</div></div><div class="section-card"><div class="section-header"><h3>${icon('phone', 'icon-sm')} Emergency Communication</h3></div><div class="seasonal-list">${emergencyContacts.length ? emergencyContacts.slice(0, 6).map((c) => `<div class="seasonal-item">${escapeHtml(c.contact_type || 'Emergency')} - ${escapeHtml(c.name || 'Contact')} (${escapeHtml(c.phone || 'N/A')})</div>`).join('') : '<div class="seasonal-item">No emergency contacts available.</div>'}</div></div></div><div class="section-card"><div class="section-header"><h3>${icon('bell', 'icon-sm')} Guide-to-guide messages</h3></div><p class="animals-page-blurb">Operational notes to peers (DB migration 011).</p><div class="info-chip-row" style="flex-wrap:wrap;gap:8px;"><select id="guideMsgPeerSelect" class="map-destination" style="flex:1;min-width:180px;"><option value="">Select peer…</option></select></div><div id="guideMsgThread" class="seasonal-list" style="max-height:200px;overflow:auto;margin-top:8px;"><div class="seasonal-item">Loading…</div></div><textarea id="guideMsgBody" class="map-destination" style="margin-top:8px;min-height:72px;width:100%;box-sizing:border-box;" placeholder="Operational note"></textarea><div class="info-chip-row" style="margin-top:8px;"><button type="button" class="login-btn" onclick="sendGuideDeskNote()">${icon('target', 'icon-sm')} Send</button><button type="button" class="small-btn ghost-btn" onclick="refreshGuideDeskInbox()">${icon('grid', 'icon-sm')} Refresh</button></div></div><div class="shift-controls"><button class="login-btn" onclick="clockInOut()">${dashboard.activeShift ? 'Clock Out' : 'Clock In'}</button><button class="small-btn" onclick="addTourNotePrompt()">Add Tour Note</button><button class="small-btn" onclick="viewActiveTourCompletionReport()">Completion Report</button></div><div id="activeTourPanel" style="${guideManager.activeTour ? 'display:block' : 'display:none'}"><div id="tourTimerDisplay" class="tour-timer">00:00:00</div><button onclick="quickSighting()">Log Sighting</button><button onclick="endActiveTour()">End Tour</button></div></div>`;}

function isCurrentUserITManager() {
    const user = Auth.getCurrentUser?.() || null;
    return user?.role === 'it_manager' || user?.userType === 'it_manager';
}

function requireITManagerAccess(actionLabel = 'this module') {
    if (isCurrentUserITManager()) return true;
    showToast?.(`Only IT managers can access ${actionLabel}.`, 'warning');
    return false;
}

async function renderITManagerDashboard() {
    if (!isCurrentUserITManager()) {
        return `<div class="it-dashboard"><div class="section-card"><div class="section-header"><h3>${icon('shield', 'icon-sm')} Access restricted</h3></div><div class="seasonal-list"><div class="seasonal-item">Only users with the IT Manager role can access predictive analytics and reporting.</div></div></div></div>`;
    }
    // Resilient fan-out: if any single endpoint fails, fall back to a safe
    // default so the dashboard still renders for the IT manager.
    const settled = await Promise.allSettled([
        ITAPI.getSystemMetrics(),
        ITAPI.getLiveOperations(),
        ITAPI.getRareAlerts(6)
    ]);
    settled.forEach((r, i) => {
        if (r.status === 'rejected') {
            console.warn(`[IT dashboard] section ${i} failed:`, r.reason);
        }
    });
    const valueOr = (i, fallback) => (settled[i].status === 'fulfilled' && settled[i].value != null ? settled[i].value : fallback);
    const metrics = valueOr(0, {});
    const liveOps = valueOr(1, { peers: [], intranetStatus: {}, syncStatus: {} });
    const rareAlerts = valueOr(2, []);
    const rareAlertsHtml = `<div class="section-card"><div class="section-header"><h3>${icon('bell', 'icon-sm')} Rare Sighting Alerts</h3></div><div class="seasonal-list">${(rareAlerts || []).length ? rareAlerts.map((a) => `<div class="seasonal-item rare-alert-item"><strong>${escapeHtml((a.risk_level || 'high').toUpperCase())}</strong> • ${escapeHtml(a.animal_name || 'Wildlife')} @ ${escapeHtml(a.location_name || 'Unknown')} (${a.number_observed || 0}) ${a.acknowledged ? '<span style="color:#2E7D32;">(Acknowledged)</span>' : `<button class=\"small-btn\" onclick=\"ackRareAlertPrompt('${a.alert_id}')\">Acknowledge</button>`}<br><span style="color:#6B705C;">${escapeHtml(a.reason || '')}</span></div>`).join('') : '<div class="seasonal-item">• No rare alerts in recent reports.</div>'}</div></div>`;
    const predictiveCtaHtml = `<div class="section-card pa-admin-cta"><div class="section-header"><h3>${icon('chart', 'icon-sm')} Predictive Analytics & Reporting</h3></div><p class="animals-page-blurb">Forecast congestion, staffing, visitor flows, sightings, anomalies, satisfaction, demographics, exports, schedules, and model retraining—all in §3.1.1.11 tooling.</p><div class="info-chip-row" style="flex-wrap:wrap;gap:8px;"><button type="button" class="login-btn" onclick="navigateTo('it_predictive_analytics')">${icon('activity', 'icon-sm')} Open Predictive Analytics workspace</button></div></div>`;
    const animals = await Content.getAnimals();
    const avgStars = Number(metrics.averageRating || 0);
    const itKpis = [
        { label: 'Active Users', value: metrics.activeUsers || 0, hint: 'Current sessions' },
        { label: 'Pending Sync', value: metrics.syncQueueSize || 0, hint: 'Waiting uploads' },
        { label: 'Sightings', value: metrics.totalSightings || 0, hint: 'Recorded entries' },
        { label: 'Avg Rating', value: avgStars.toFixed(1), hint: '/ 5' }
    ];
    const liveUsersHtml = renderLiveUserRows(liveOps.peers || []);
    let accountDirHtml = '';
    try {
        const dir = await API.request('/admin/users?limit=100&offset=0');
        const list = Array.isArray(dir?.users) ? dir.users : [];
        accountDirHtml = renderItAccountDirectory(list, Auth.getCurrentUser()?.user_id);
    } catch (e) {
        console.warn('[IT dashboard] account directory failed:', e);
        accountDirHtml = renderItAccountDirectory([], Auth.getCurrentUser()?.user_id);
    }
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
                match: `${avgStars.toFixed(1)} / 5`,
                reason: `Administrative avg rating (${avgStars.toFixed(1)} / 5 rolling). Detailed satisfaction trends live under Predictive Analytics.`,
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
    })}<div class="section-card"><div class="section-header"><h3>${icon('users', 'icon-sm')} Current Users (Realtime)</h3><span id="adminLiveUsersStamp" class="status-badge neutral">Updated just now • ${(liveOps.peers || []).length} active now / ${Number(metrics.activeUsers || 0)} total</span></div><div id="adminLiveUsersList">${liveUsersHtml}</div></div>${accountDirHtml}${predictiveCtaHtml}<div class="dashboard-feature-grid"><div class="section-card"><div class="section-header"><h3>${icon('building', 'icon-sm')} Intranet Connectivity</h3></div><div class="analytics-list"><div class="analytics-row"><span>Intranet</span><div class="analytics-bar"><div style="width:${liveOps.intranetStatus?.isIntranet ? 100 : 35}%;"></div></div><strong>${liveOps.intranetStatus?.isIntranet ? 'Connected' : 'External'}</strong></div><div class="analytics-row"><span>Device IP</span><span></span><strong>${escapeHtml(liveOps.intranetStatus?.ip || 'Unknown')}</strong></div><div class="analytics-row"><span>Pending Sync</span><span></span><strong>${liveOps.syncStatus?.pending || liveOps.syncStatus?.pending_items || 0}</strong></div></div></div><div class="section-card"><div class="section-header"><h3>${icon('user', 'icon-sm')} Live Peers / Guests</h3></div><div class="seasonal-list">${(liveOps.peers || []).length ? liveOps.peers.slice(0, 8).map((p) => `<div class="seasonal-item">• ${escapeHtml(p.name || 'Peer')} (${escapeHtml(p.type || 'user')})${p.location ? ` @ ${Number(p.location.lat).toFixed(4)}, ${Number(p.location.lng).toFixed(4)}` : ''}</div>`).join('') : '<div class="seasonal-item">• No live peers detected in last 5 minutes.</div>'}</div></div></div>${rareAlertsHtml}<div class="admin-actions"><button class="admin-action-btn" onclick="handleMFASetup()">${icon('shield', 'icon-sm')} Configure MFA</button><button class="admin-action-btn" onclick="clearAllCache()">Clear Cache</button><button class="admin-action-btn" onclick="exportData()">Export Data</button><button class="admin-action-btn danger" onclick="resetApp()">Reset App</button></div></div>`;}

// =====================================================
// PREDICTIVE ANALYTICS (§3.1.1.11) — IT Manager workspace
// =====================================================
async function renderITPredictiveAnalyticsDashboard() {
    if (!isCurrentUserITManager()) {
        return `<div class="pa-shell"><div class="section-card"><div class="section-header"><h3>${icon('shield', 'icon-sm')} Access restricted</h3></div><div class="seasonal-list"><div class="seasonal-item">Only IT managers can open predictive analytics.</div></div></div></div>`;
    }
    const filters = readPredictiveAnalyticsFilters();
    let animals = [];
    let data = null;
    try {
        [animals, data] = await Promise.all([Content.getAnimals(), ITAPI.getPredictiveAnalyticsData(filters)]);
    } catch (err) {
        console.warn('[predictive analytics] load failed:', err);
    }
    if (!data) {
        return `<div class="pa-shell"><div class="section-card"><div class="empty-state">Predictive datasets could not be loaded. Check connectivity and JWT scope, then retry.</div></div></div>`;
    }
    const dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const donutColors = ['#a5ec60', '#419310', '#1c621b', '#487070', '#18333d', '#0b1e26'];
    const rf = filters;
    const range = data.range || {};
    const tl = data.visitorFlow?.timeline || [];
    const routes = (data.visitorFlow?.popularRoutes || []).slice(0, 8);
    const dwell = (data.visitorFlow?.dwellTimes || []).slice(0, 8);
    const congPred = data.congestion?.predictions || [];
    const congRec = data.congestion?.recommendations || [];
    const byHourSorted = [...(data.peakTimes?.byHour || [])].sort((a, b) => Number(a.hour) - Number(b.hour));
    const byDow = data.peakTimes?.byDayOfWeek || [];
    const resAlloc = (data.resourceAllocation || []).slice(0, 10);
    const pop = (data.popularContent || []).slice(0, 10);
    const sightTrend = (data.sightings?.trend || []).slice(-21);
    const species = (data.sightings?.species || []).slice(0, 8);
    const sat = data.satisfaction || {};
    const satTrend = sat.trend || [];
    const demoUt = data.demographics?.user_types || [];
    const demoNat = (data.demographics?.nationality || []).slice(0, 6);
    const anom = (data.anomalies || []).slice(0, 8);
    const maxFlow = Math.max(1, ...tl.map((p) => Number(p.visitor_count || 0)));
    const maxCong = Math.max(1, ...congPred.map((p) => Number(p.predicted_visitor_count || 0)));
    const maxPeakH = Math.max(1, ...byHourSorted.map((p) => Number(p.visitors || 0)));
    const maxPeakD = Math.max(1, ...byDow.map((p) => Number(p.visitors || 0)));
    const maxSight = Math.max(1, ...sightTrend.map((p) => Number(p.sightings || 0)));
    const maxPop = Math.max(1, ...pop.map((p) => Number(p.view_count || 0)));
    const totalDemoType = demoUt.reduce((s, r) => s + Number(r.count || 0), 0) || 1;
    let donutGradAcc = 0;
    const donutSlices = demoUt.map((row, i) => {
        const pct = (Number(row.count || 0) / totalDemoType) * 100;
        const from = donutGradAcc;
        donutGradAcc += pct;
        const col = donutColors[i % donutColors.length];
        return `${col} ${from.toFixed(2)}% ${donutGradAcc.toFixed(2)}%`;
    });
    const donutStyle = donutSlices.length ? `conic-gradient(${donutSlices.join(', ')})` : 'linear-gradient(135deg,#e2e8f0,#cbd5f5)';
    const lastFlow = tl.length ? Number(tl[tl.length - 1].visitor_count || 0) : 0;
    const prevFlow = tl.length > 1 ? Number(tl[tl.length - 2].visitor_count || 0) : lastFlow;
    const flowDelta = prevFlow ? Math.round(((lastFlow - prevFlow) / prevFlow) * 100) : 0;
    const sightSumRecent = sightTrend.slice(-7).reduce((s, r) => s + Number(r.sightings || 0), 0);
    const sightSumPrior = sightTrend.slice(-14, -7).reduce((s, r) => s + Number(r.sightings || 0), 0);
    const sightDelta = sightSumPrior ? Math.round(((sightSumRecent - sightSumPrior) / sightSumPrior) * 100) : 0;
    const avgSat = Number(sat.overall || 0);
    const satRate = Number(sat.satisfactionRate || 0);
    const peakVisitorEst = congPred.length ? Math.max(...congPred.map((p) => Number(p.predicted_visitor_count || 0))) : maxFlow;

    const animalOpts = `<option value="">${escapeHtml('All species')}</option>${(animals || [])
        .filter((a) => a?.animal_id)
        .slice(0, 120)
        .map(
            (a) =>
                `<option value="${escapeHtml(String(a.animal_id))}" ${String(a.animal_id) === String(rf.animalId || '') ? 'selected' : ''}>${escapeHtml(a.name || 'Species')}</option>`
        )
        .join('')}`;

    const flowSpark = tl
        .slice(-14)
        .map((p) => {
            const h = Math.round((Number(p.visitor_count || 0) / maxFlow) * 100);
            return `<span class="pa-spark-cell" style="height:${Math.max(8, h)}%" title="${escapeHtml(String(new Date(p.time_period).toLocaleDateString()))}"></span>`;
        })
        .join('');

    const flowRows =
        tl
            .slice(-10)
            .map((p) => {
                const v = Number(p.visitor_count || 0);
                const w = Math.min(100, Math.round((v / maxFlow) * 100));
                return `<div class="pa-metric-row"><span class="pa-metric-label">${escapeHtml(new Date(p.time_period).toLocaleDateString())}</span><div class="pa-track"><i style="width:${w}%"></i></div><strong>${v}</strong></div>`;
            })
            .join('') || '<div class="pa-empty">No visitor flow buckets in range.</div>';

    const routeRows =
        routes
            .map(
                (row) =>
                    `<div class="pa-table-row"><span>${escapeHtml(row.location_name || 'Route')}</span><strong>${escapeHtml(String(row.visit_count ?? row.visits ?? 0))}</strong><small>${escapeHtml(String(row.avg_dwell_minutes != null ? `${row.avg_dwell_minutes} min avg dwell` : '—'))}</small></div>`
            )
            .join('') || '<div class="pa-empty">No popular routes ranked.</div>';

    const dwellRows =
        dwell
            .map(
                (row) =>
                    `<div class="pa-table-row"><span>${escapeHtml(row.location_name || 'Stop')}</span><strong>${escapeHtml(String(row.avg_dwell_minutes ?? '—'))} min</strong><small>${escapeHtml(String(row.observations ?? '—'))} obs</small></div>`
            )
            .join('') || '<div class="pa-empty">Dwell summaries need more observations.</div>';

    const congestionRows =
        congPred
            .slice(0, 12)
            .map((p) => {
                const v = Number(p.predicted_visitor_count || 0);
                const w = Math.min(100, Math.round((v / maxCong) * 100));
                return `<div class="pa-metric-row"><span class="pa-metric-label">${String(p.predicted_hour).padStart(2, '0')}:00 · ${escapeHtml(p.location_name || 'Location')}</span><div class="pa-track"><i style="width:${w}%"></i></div><strong>${v}</strong></div>`;
            })
            .join('') || '<div class="pa-empty">No congestion model output for this date.</div>';

    const peakHourBars =
        byHourSorted
            .slice(0, 24)
            .map((row) => {
                const v = Number(row.visitors || 0);
                const w = Math.min(100, Math.round((v / maxPeakH) * 100));
                return `<div class="pa-metric-row"><span class="pa-metric-label">${String(row.hour).padStart(2, '0')}:00</span><div class="pa-track"><i style="width:${w}%"></i></div><strong>${v}</strong></div>`;
            })
            .join('') || '<div class="pa-empty">Peak hour aggregates unavailable.</div>';

    const peakDayBars =
        byDow
            .slice(0, 7)
            .map((row) => {
                const v = Number(row.visitors || 0);
                const w = Math.min(100, Math.round((v / maxPeakD) * 100));
                const lbl = dowNames[Number(row.day_of_week)] || row.day_of_week;
                return `<div class="pa-metric-row"><span class="pa-metric-label">${escapeHtml(String(lbl))}</span><div class="pa-track"><i style="width:${w}%"></i></div><strong>${v}</strong></div>`;
            })
            .join('') || '<div class="pa-empty">Day-of-week peaks unavailable.</div>';

    const resRows =
        resAlloc
            .map((row) => {
                const s = row.suggested_staffing || {};
                return `<div class="pa-table-row"><span>${escapeHtml(row.location_name || 'Area')} · ${escapeHtml(String(row.hour))}:00</span><strong>${escapeHtml(String(row.predicted_visitor_count || 0))}</strong><small>G${escapeHtml(String(s.guides || 1))} · R${escapeHtml(String(s.rangers || 1))} · Gt${escapeHtml(String(s.gate_staff || s.gate || 1))}</small></div>`;
            })
            .join('') || '<div class="pa-empty">No staffing grid for this congestion day.</div>';

    const popRows =
        pop
            .map((row) => {
                const v = Number(row.view_count || 0);
                const w = Math.min(100, Math.round((v / maxPop) * 100));
                return `<div class="pa-metric-row"><span class="pa-metric-label">${escapeHtml(row.name || row.title || 'Content')} <span class="pa-pill">${escapeHtml(row.type || 'item')}</span></span><div class="pa-track pa-track-accent"><i style="width:${w}%"></i></div><strong>${v}</strong></div>`;
            })
            .join('') || '<div class="pa-empty">Popular content aggregates empty.</div>';

    const demoLegend = demoUt
        .map(
            (row, i) =>
                `<div class="pa-legend-row"><span class="pa-dot" style="background:${donutColors[i % donutColors.length]}"></span><span>${escapeHtml(row.user_type || 'role')}</span><strong>${escapeHtml(String(row.count || 0))}</strong></div>`
        )
        .join('');

    const natRows = demoNat
        .map((row) => `<div class="pa-table-row"><span>${escapeHtml(row.nationality || 'Unknown')}</span><strong>${escapeHtml(String(row.count || 0))}</strong></div>`)
        .join('');

    const sightBars =
        sightTrend
            .map((row) => {
                const v = Number(row.sightings || 0);
                const w = Math.min(100, Math.round((v / maxSight) * 100));
                return `<div class="pa-metric-row"><span class="pa-metric-label">${escapeHtml(new Date(row.day).toLocaleDateString())}</span><div class="pa-track pa-track-earth"><i style="width:${w}%"></i></div><strong>${v}</strong></div>`;
            })
            .join('') || '<div class="pa-empty">No sightings trend slices.</div>';

    const speciesChips = species
        .map(
            (row) =>
                `<span class="pa-chip">${escapeHtml(row.name || 'Species')} · ${escapeHtml(String(row.sightings || row.count || 0))}</span>`
        )
        .join('') || `<span class="pa-chip ghost">Totals across ${escapeHtml(rf.animalId ? 'filter' : 'all species')}</span>`;

    const satBars =
        satTrend
            .slice(-14)
            .map((row) => {
                const v = Number(row.avg_rating ?? 0);
                const w = Math.min(100, (v / 5) * 100);
                const lbl = Number.isFinite(v) ? v.toFixed(1) : '—';
                return `<div class="pa-metric-row"><span class="pa-metric-label">${escapeHtml(new Date(row.day).toLocaleDateString())}</span><div class="pa-track pa-track-warm"><i style="width:${w}%"></i></div><strong>${escapeHtml(lbl)}</strong></div>`;
            })
            .join('') || '<div class="pa-empty">Satisfaction samples missing for selected window.</div>';

    const anomalyRows = anom
        .map(
            (row) =>
                `<div class="pa-table-row"><span>${escapeHtml(new Date(row.day).toLocaleDateString())}</span><strong>${escapeHtml(String(row.count || row.cnt || 0))}</strong><small>z ${escapeHtml(String(row.zscore || ''))}${row.high ? ' · spike' : row.low ? ' · dip' : ''}</small></div>`
        )
        .join('') || '<div class="pa-empty">No anomalies at current threshold.</div>';

    const congestionRecHtml = congRec
        .slice(0, 4)
        .map((t) => `<div class="pa-callout">${escapeHtml(String(t))}</div>`)
        .join('');

    const itOpsShortcutsHtml = `<div class="pa-toolbar pa-toolbar--sticky"><span class="pa-toolbar-title">${icon('chart', 'icon-sm')} Operations</span><div class="pa-toolbar-actions">${[
        ['itOpsPeekAnalyticsAnomalies()', 'Anomalies'],
        ['itOpsQueueModelRetrain()', 'Queue retrain'],
        ['itOpsCreateReportSchedulePrompt()', 'Schedule report'],
        ['itOpsRunLatestSchedule()', 'Run schedule'],
        ['itOpsExportAnalyticsPrompt()', 'Data export'],
        ['itOpsPeekTrainingJobs()', 'Training jobs'],
        ['navigateTo(\'it_tour_assignments\')', 'Assignments'],
        ['itOpsPeekBackupsList()', 'Backups']
    ]
        .map(
            ([fn, lab]) =>
                `<button type="button" class="small-btn" onclick="${fn}">${escapeHtml(lab)}</button>`
        )
        .join('')}</div></div>`;

    const reportDefaultsStart = range.start ? String(range.start).slice(0, 16) : '';
    const reportDefaultsEnd = range.end ? String(range.end).slice(0, 16) : '';

    return `<div class="pa-shell"><div class="pa-hero">${icon('database', 'icon-md')}
            <div>
                <p class="pa-eyebrow">§3.1.1.11 · Intelligent operations</p>
                <h2 class="pa-title">Predictive Analytics Workspace</h2>
                <p class="pa-subtitle">Interactive dashboards forecasting visitor strain, aligning guides, auditing satisfaction, surfacing sightings trends, anomalies, exports, schedules, and retraining workflows.</p>
            </div>
        </div>
        <div class="pa-toolbar">
            <span class="pa-toolbar-label">Inputs</span>
            <label class="pa-field"><span>Date range</span>
                <select id="pa-range-days" class="auth-select">${[7, 14, 30, 90]
                    .map((d) => `<option value="${d}" ${Number(rf.days) === d ? 'selected' : ''}>Last ${d} days</option>`)
                    .join('')}</select>
            </label>
            <label class="pa-field"><span>Congestion forecast day</span>
                <input id="pa-congestion-date" class="auth-input" type="date" value="${escapeHtml(String(rf.congestionDate || '').slice(0, 10))}">
            </label>
            <label class="pa-field"><span>Animal scope</span>
                <select id="pa-animal-filter" class="auth-select">${animalOpts}</select>
            </label>
            <button type="button" class="login-btn" onclick="applyPredictiveAnalyticsFilters()">${icon('target', 'icon-sm')} Apply filters</button>
            <button type="button" class="small-btn ghost-btn" onclick="navigateTo('it_dashboard');">${icon('chart', 'icon-sm')} Admin overview</button>
        </div>
        <section class="pa-kpi-strip">
            <article class="pa-kpi-card">
                <p class="pa-kpi-label">Visitor flow pulse</p>
                <strong class="pa-kpi-value">${escapeHtml(String(lastFlow))}</strong>
                <span class="pa-kpi-trend ${flowDelta >= 0 ? 'up' : 'down'}">${escapeHtml(String(flowDelta))}% vs prior bucket</span>
                <div class="pa-sparkline">${flowSpark || `<span class="pa-empty-inline">Insufficient timeline</span>`}</div>
            </article>
            <article class="pa-kpi-card">
                <p class="pa-kpi-label">Forecasted congestion peak</p>
                <strong class="pa-kpi-value">${escapeHtml(String(peakVisitorEst))}</strong>
                <span class="pa-kpi-muted">Visitors · ${escapeHtml(String(rf.congestionDate || '').slice(0, 10))}</span>
                <div class="pa-sparkline muted">${escapeHtml(`${congPred.length ? `${congPred.length} hourly rows` : 'No rows'}`)}</div>
            </article>
            <article class="pa-kpi-card">
                <p class="pa-kpi-label">Satisfaction pulse</p>
                <strong class="pa-kpi-value">${escapeHtml(avgSat.toFixed(1))}</strong>
                <span class="pa-kpi-trend">${escapeHtml(String(satRate))}% pleased</span>
                <div class="pa-mini-note">${escapeHtml(String(sat.totalRatings ?? sat.total_ratings ?? 0))} ratings counted</div>
            </article>
            <article class="pa-kpi-card">
                <p class="pa-kpi-label">Sightings momentum</p>
                <strong class="pa-kpi-value">${escapeHtml(String(sightSumRecent))}</strong>
                <span class="pa-kpi-trend ${sightDelta >= 0 ? 'up' : 'down'}">${escapeHtml(String(sightDelta))}% vs prior week</span>
                <div class="pa-mini-note">Verified encounters in window</div>
            </article>
        </section>
        <div class="pa-grid">
            <section class="pa-card pa-span-8">
                <header class="pa-card-head"><div><h3>${icon('map', 'icon-sm')} Visitor flow analysis</h3><p>Flow patterns, popular routes, dwell times</p></div><span class="pa-chip ghost">Range · ${escapeHtml(String(rf.days))}d</span></header>
                <div class="pa-split">
                    <div>
                        <h4>Timeline</h4>
                        ${flowRows}
                    </div>
                    <div>
                        <h4>Popular routes</h4>
                        <div class="pa-table">${routeRows}</div>
                        <h4>Dwell focus</h4>
                        <div class="pa-table">${dwellRows}</div>
                    </div>
                </div>
            </section>
            <section class="pa-card pa-span-4">
                <header class="pa-card-head"><div><h3>${icon('users', 'icon-sm')} User demographics</h3><p>Mix of active accounts + visitor nationality</p></div></header>
                <div class="pa-donut-wrap">
                    <div class="pa-donut" style="background:${donutStyle};"><div class="pa-donut-core"><strong>${escapeHtml(String(totalDemoType))}</strong><small>Accounts</small></div></div>
                    <div class="pa-legend">${demoLegend || '<div class="pa-empty">No role distribution</div>'}</div>
                </div>
                <h4>Top nationalities</h4>
                <div class="pa-table">${natRows || '<div class="pa-empty">No nationality data</div>'}</div>
            </section>
            <section class="pa-card pa-span-6">
                <header class="pa-card-head"><div><h3>${icon('target', 'icon-sm')} Congestion prediction</h3><p>Hourly occupancy & guidance</p></div><span class="pa-chip ghost">${escapeHtml(String(rf.congestionDate || ''))}</span></header>
                ${congestionRecHtml ? `<div class="pa-callout-row">${congestionRecHtml}</div>` : ''}
                ${congestionRows}
            </section>
            <section class="pa-card pa-span-6">
                <header class="pa-card-head"><div><h3>${icon('clock', 'icon-sm')} Peak time identification</h3><p>Historical visitor arrivals</p></div></header>
                <div class="pa-split">
                    <div><h4>By hour</h4>${peakHourBars}</div>
                    <div><h4>By weekday</h4>${peakDayBars}</div>
                </div>
            </section>
            <section class="pa-card pa-span-6">
                <header class="pa-card-head"><div><h3>${icon('shield', 'icon-sm')} Resource allocation recommendations</h3><p>Guides · rangers · gate</p></div></header>
                <div class="pa-table">${resRows}</div>
            </section>
            <section class="pa-card pa-span-6">
                <header class="pa-card-head"><div><h3>${icon('grid', 'icon-sm')} Popular content analytics</h3><p>Ranked artefacts & hotspots</p></div></header>
                ${popRows}
            </section>
            <section class="pa-card pa-span-8">
                <header class="pa-card-head"><div><h3>${icon('paw', 'icon-sm')} Sightings trends</h3><p>Verified wildlife reporting</p></div><span class="pa-chip">${escapeHtml(rf.animalId ? 'Filtered' : 'All species')}</span></header>
                <div class="pa-chip-row">${speciesChips}</div>
                ${sightBars}
            </section>
            <section class="pa-card pa-span-4">
                <header class="pa-card-head"><div><h3>${icon('smile', 'icon-sm')} Satisfaction metrics</h3><p>Feedback-derived scores</p></div></header>
                <div class="pa-stat">${escapeHtml(avgSat.toFixed(2))}<small>/5 avg</small></div>
                ${satBars}
            </section>
            <section class="pa-card pa-span-6">
                <header class="pa-card-head"><div><h3>${icon('bell', 'icon-sm')} Anomaly detection</h3><p>Visitor behaviour surprise spikes vs baseline</p></div><small class="pa-kpi-muted">z ≥ ${escapeHtml(String(data.anomalyStats?.z_threshold ?? 2.5))}</small></header>
                <div class="pa-table">${anomalyRows}</div>
            </section>
            <section class="pa-card pa-span-6">
                <header class="pa-card-head"><div><h3>${icon('note', 'icon-sm')} Custom report builder</h3><p>Metrics + bounded period</p></div></header>
                <div class="pa-check-grid">
                    <label class="pa-check"><input type="checkbox" id="pa-metric-visitor_flow" checked> visitor_flow</label>
                    <label class="pa-check"><input type="checkbox" id="pa-metric-sightings_trend" checked> sightings_trend</label>
                    <label class="pa-check"><input type="checkbox" id="pa-metric-satisfaction" checked> satisfaction</label>
                    <label class="pa-check"><input type="checkbox" id="pa-metric-popular_content" checked> popular_content</label>
                </div>
                <label class="pa-field"><span>Report start</span><input id="pa-report-start" class="auth-input" value="${escapeHtml(reportDefaultsStart)}" placeholder="ISO8601 start"></label>
                <label class="pa-field"><span>Report end</span><input id="pa-report-end" class="auth-input" value="${escapeHtml(reportDefaultsEnd)}" placeholder="ISO8601 end"></label>
                <div class="pa-toolbar-actions flush">
                    <button type="button" class="login-btn" onclick="paRunReportFromBuilder()">${icon('note', 'icon-sm')} Build report bundle</button>
                    <button type="button" class="small-btn" onclick="itOpsRunReportBuild()">${icon('play', 'icon-sm')} Quick default report</button>
                </div>
            </section>
            <section class="pa-card pa-span-12">
                <header class="pa-card-head"><div><h3>${icon('grid', 'icon-sm')} Dashboard visualization cues</h3><p>Value-style layout with cards, KPIs, progress tracks, donut mix, segmented controls.</p></div></header>
                <div class="pa-callout">${icon('shield', 'icon-sm')} Charts respect the filters above — apply changes to invalidate the cache. Data export delivers JSON bundles or CSV payloads (open CSV in Excel/Sheets). Report scheduling runs through the Operations band.</div>
            </section>
        </div>
        ${itOpsShortcutsHtml}
    </div>`;
}

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
    const parkState = getParkAccessState();
    const effectiveIntranet = parkState.networkMode === 'auto'
        ? (AppState?.accessContext?.isIntranet ?? intranetStatus?.isIntranet ?? false)
        : parkState.online;
    const effectiveIp = AppState?.accessContext?.ip || intranetStatus?.ip || 'Unknown';
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
                    match: effectiveIntranet ? 'Intranet linked' : 'External network',
                    reason: effectiveIntranet
                        ? `Connected via trusted network (${effectiveIp || 'IP unavailable'}).`
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
                    <div class="analytics-row"><span>Intranet Link</span><div class="analytics-bar"><div id="intranetLinkBar" style="width:${effectiveIntranet ? 100 : 35}%;"></div></div><strong id="intranetLinkValue">${effectiveIntranet ? 'Connected' : 'External'}</strong></div>
                    <div class="analytics-row"><span>Device IP</span><span></span><strong id="intranetIpValue">${escapeHtml(effectiveIp || 'Unknown')}</strong></div>
                    <div class="analytics-row"><span>Park Boundary</span><span></span><strong id="intranetBoundaryValue">${parkState.insidePark ? 'Inside' : 'Outside'}</strong></div>
                    <div class="analytics-row"><span>Network Status</span><span></span><strong id="intranetNetworkValue">${parkState.online ? 'Online' : 'Offline'}</strong></div>
                    <div class="analytics-row"><span>Policy Mode</span><span></span><strong>${escapeHtml(AppState?.accessContext?.mode || 'demo')}</strong></div>
                    <div class="analytics-row"><span>Decision Source</span><span></span><strong>${escapeHtml(AppState?.accessContext?.source || 'live')}</strong></div>
                    <div class="analytics-row"><span>Decision Reason</span><span></span><strong>${escapeHtml(AppState?.accessContext?.reason || 'Policy checks passed')}</strong></div>
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

function refreshIntranetParkStatusLinks() {
    if (window.currentView !== 'intranet') return;
    const linkValue = document.getElementById('intranetLinkValue');
    const linkBar = document.getElementById('intranetLinkBar');
    const ipValue = document.getElementById('intranetIpValue');
    const boundaryValue = document.getElementById('intranetBoundaryValue');
    const networkValue = document.getElementById('intranetNetworkValue');
    if (!linkValue || !linkBar || !ipValue || !boundaryValue || !networkValue) return;

    const state = getParkAccessState();
    const isIntranet = state.networkMode === 'auto'
        ? Boolean(AppState?.accessContext?.isIntranet)
        : Boolean(state.online);
    const ip = AppState?.accessContext?.ip || 'Unknown';

    linkValue.textContent = isIntranet ? 'Connected' : 'External';
    linkBar.style.width = isIntranet ? '100%' : '35%';
    ipValue.textContent = ip;
    boundaryValue.textContent = state.insidePark ? 'Inside' : 'Outside';
    networkValue.textContent = state.online ? 'Online' : 'Offline';
}

async function renderITTourAssignmentsDashboard() {
    if (!isCurrentUserITManager()) {
        return `<div class="it-dashboard"><div class="section-card"><div class="section-header"><h3>${icon('shield', 'icon-sm')} Access restricted</h3></div><div class="seasonal-list"><div class="seasonal-item">Only IT managers can access tour session assignment tools.</div></div></div></div>`;
    }
    const start = new Date(Date.now() - 7 * 86400000).toISOString();
    const end = new Date(Date.now() + 28 * 86400000).toISOString();
    const settled = await Promise.allSettled([
        API.listTourAssignments({ start, end }),
        API.listTourGuidesForAssignment(),
        API.listTourRoutesForAssignment()
    ]);
    const valueOr = (i, fallback) => (settled[i].status === 'fulfilled' && settled[i].value != null ? settled[i].value : fallback);
    const assignmentRows = Array.isArray(valueOr(0, {})?.assignments) ? valueOr(0, {}).assignments : [];
    const guides = Array.isArray(valueOr(1, {})?.guides) ? valueOr(1, {}).guides : [];
    const routes = Array.isArray(valueOr(2, {})?.routes) ? valueOr(2, {}).routes : [];

    const assignmentList = assignmentRows.length
        ? assignmentRows.slice(0, 12).map((a) => {
            const name = `${a.guide_first_name || ''} ${a.guide_last_name || ''}`.trim() || a.guide_username || 'Guide';
            return `<div class="seasonal-item"><strong>${new Date(a.scheduled_start).toLocaleString()}</strong> • ${escapeHtml(a.route_name || 'Route')} • ${escapeHtml(name)} • ${escapeHtml(a.status || 'scheduled')} (${a.confirmed_guests || 0} guests)</div>`;
        }).join('')
        : '<div class="seasonal-item">No assigned tour sessions found in selected range.</div>';

    return `<div class="it-dashboard">
        <div class="section-card">
            <div class="section-header"><h3>${icon('clock', 'icon-sm')} Tour Session Assignments</h3></div>
            <p class="animals-page-blurb">Create one-off tour session assignments for guides.</p>
            <div class="info-chip-row" style="padding:0 16px 12px;flex-wrap:wrap;gap:8px;">
                <button type="button" class="small-btn" onclick="itOpsAssignSingleTourPrompt()">${icon('clock', 'icon-sm')} Assign Tour Sessions</button>
                <button type="button" class="small-btn ghost-btn" onclick="renderView('it_tour_assignments')">${icon('grid', 'icon-sm')} Refresh</button>
            </div>
            <div class="analytics-list">
                <div class="analytics-row"><span>Active guides</span><strong>${guides.length}</strong></div>
                <div class="analytics-row"><span>Available routes</span><strong>${routes.length}</strong></div>
                <div class="analytics-row"><span>Assignments (5-week window)</span><strong>${assignmentRows.length}</strong></div>
            </div>
        </div>
        <div class="section-card">
            <div class="section-header"><h3>${icon('grid', 'icon-sm')} Weekly Assignments</h3></div>
            <p class="animals-page-blurb">Assign recurring sessions across selected weekdays for the week.</p>
            <div class="info-chip-row" style="padding:0 16px 12px;flex-wrap:wrap;gap:8px;">
                <button type="button" class="small-btn" onclick="itOpsAssignWeeklyToursPrompt()">${icon('grid', 'icon-sm')} Create Weekly Assignments</button>
                <button type="button" class="small-btn ghost-btn" onclick="navigateTo('it_dashboard')">${icon('chart', 'icon-sm')} Back to Admin Dashboard</button>
            </div>
            <div class="seasonal-list">${assignmentList}</div>
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

window.handleAIChatInputKeydown = function (event) {
    if (!event || event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    window.sendAIChatMessage();
};

window.clearSigtsChatThread = function clearSigtsChatThread() {
    clearSigtsChatHistoryStorage();
    const messages = document.getElementById('aiChatMessages');
    if (!messages) return;
    messages.innerHTML = getSigtsChatWelcomeHtml();
    window.__sigtsLastTourHelpQuestion = '';
    const ta = document.getElementById('aiChatInput');
    if (ta) {
        ta.value = '';
        aiChatAutosizeTextarea(ta);
    }
};

window.sigtsChatQuickAsk = function sigtsChatQuickAsk(text) {
    const q = String(text || '').trim();
    if (!q) return;
    const input = document.getElementById('aiChatInput');
    if (input) {
        input.value = q;
        aiChatAutosizeTextarea(input);
    }
    window.sendAIChatMessage();
};

window.sendAIChatMessage = async function () {
    const input = document.getElementById('aiChatInput');
    const messages = document.getElementById('aiChatMessages');
    const sendBtn = document.getElementById('aiChatSendBtn');
    if (!input || !messages) return;

    const question = String(input.value || '').trim();
    if (!question) return;
    if (question.length > 2000) {
        showToast('Message is too long. Please keep it under 2000 characters.', 'warning');
        return;
    }

    messages.querySelector('.ai-chat-starters')?.setAttribute('hidden', '');

    messages.insertAdjacentHTML(
        'beforeend',
        `<div class="ai-chat-turn ai-chat-turn--user" role="article"><div class="ai-chat-bubble ai-chat-bubble--user"><div class="ai-chat-bubble-text">${escapeHtml(question)}</div></div></div>`
    );
    input.value = '';
    aiChatAutosizeTextarea(input);

    messages.insertAdjacentHTML(
        'beforeend',
        `<div data-ai-typing="1" class="ai-chat-turn ai-chat-turn--assistant" aria-live="polite"><span class="ai-chat-turn-label">Bwindi assistant</span><div class="ai-chat-bubble ai-chat-bubble--assistant ai-chat-bubble--typing" aria-busy="true"><span></span><span></span><span></span></div></div>`
    );

    if (sendBtn) sendBtn.disabled = true;
    input.disabled = true;

    window.__sigtsLastTourHelpQuestion = question;

    const priorTurns = readSigtsChatTurns().filter((t) => t && typeof t.user === 'string');
    const apiHistory = sigtsPriorTurnsToApiHistory(priorTurns);

    try {
        const result = await AI.askQuestion(question, { history: apiHistory });
        messages.querySelector('[data-ai-typing="1"]')?.remove();
        const answerRaw = result?.answer || 'No response available.';
        const presented = formatBwindiChatAssistantPresentation(answerRaw);
        const formattedAnswer = formatTourHelpAnswerHtml(presented);
        const metaBlock = buildTourHelpMetaHtml(result?.meta);
        const feedbackRow = `<div class="ai-chat-feedback-row"><span class="ui-modal-muted">Was this helpful?</span><button type="button" class="small-btn" onclick="submitTourHelpFeedback(true)">${icon('smile', 'icon-sm')} Yes</button><button type="button" class="small-btn ghost-btn" onclick="submitTourHelpFeedback(false)">No</button></div>`;
        messages.insertAdjacentHTML(
            'beforeend',
            `<div class="ai-chat-turn ai-chat-turn--assistant" role="article"><span class="ai-chat-turn-label">Bwindi assistant</span><div class="ai-chat-bubble ai-chat-bubble--assistant"><div class="ai-chat-bubble-text ai-chat-response-block">${formattedAnswer}</div></div>${metaBlock}${feedbackRow}</div>`
        );

        const next = [...priorTurns, { user: question, answerRaw, meta: slimSigtsChatMetaForStorage(result?.meta || {}) }];
        while (next.length > SIGTS_CHAT_HISTORY_MAX_TURNS) next.shift();
        writeSigtsChatTurns(next);
    } catch (err) {
        console.error(err);
        messages.querySelector('[data-ai-typing="1"]')?.remove();
        const apology = escapeHtml(String(err?.message || 'Something went wrong. Try again, or switch to offline mode from Profile.'));
        messages.insertAdjacentHTML(
            'beforeend',
            `<div class="ai-chat-turn ai-chat-turn--assistant" role="article"><span class="ai-chat-turn-label">Bwindi assistant</span><div class="ai-chat-bubble ai-chat-bubble--assistant ai-chat-bubble--error"><div class="ai-chat-bubble-text"><p>Could not finish that reply. ${apology}</p></div></div></div>`
        );
    } finally {
        if (sendBtn) sendBtn.disabled = false;
        input.disabled = false;
        requestAnimationFrame(() => {
            messages.scrollTop = messages.scrollHeight;
        });
    }
};

window.sigtsBoostReco = function (tourId) {
    if (typeof AI === 'undefined' || !tourId || !AI.recordRecommendationFeedback) return;
    AI.recordRecommendationFeedback(String(tourId), 5);
    showToast('Thanks — this device will weight that tour higher.', 'success');
};

window.saveAiTourInterestsFromProfile = async function () {
    if (typeof AI === 'undefined' || !AI.saveTourInterestsForAi) return;
    const boxes = document.querySelectorAll('.sigts-ai-interest-cb:checked');
    const tags = Array.from(boxes).map((b) => b.value);
    AI.saveTourInterestsForAi(tags);
    const u = Auth.getCurrentUser();
    if (!u?.isGuest && (u?.role === 'tourist' || u?.userType === 'tourist')) {
        const res = await API.updateUserProfile({ interests: tags });
        if (res?.error || (typeof res?.status === 'number' && res.status >= 400)) {
            showToast(res?.error || 'Could not sync interests to your account', 'warning');
            return;
        }
    }
    showToast('AI interests saved.', 'success');
};

window.submitTourHelpFeedback = function (helpful) {
    if (typeof AI === 'undefined' || !AI.recordChatReplyFeedback) return;
    AI.recordChatReplyFeedback(Boolean(helpful), window.__sigtsLastTourHelpQuestion || '');
    showToast(helpful ? 'Thanks — feedback logged for ranking tweaks.' : 'Thanks — we noted this reply missed the mark.', 'info');
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
    const secureContextOk = window.isSecureContext || /^localhost$|^127\.0\.0\.1$/.test(window.location.hostname);
    if (!SR) {
        showToast('Speech recognition is not supported in this browser.', 'warning');
        return;
    }
    if (!secureContextOk) {
        showToast('Microphone requires a secure context (HTTPS or localhost).', 'warning');
        return;
    }
    if (!input) {
        showToast('Chat input is unavailable right now.', 'warning');
        return;
    }
    if (window.__sigtsTourHelpRecListening) return;
    if (!recordTourHelpMicStartAndCheckLimit()) {
        showToast('Too many mic requests. Please wait a moment and try again.', 'warning');
        return;
    }
    const rec = new SR();
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => {
        setTourHelpMicButtonState(true);
    };
    rec.onresult = (e) => {
        window.__sigtsTourHelpRecListening = false;
        const captured = e.results?.[0]?.[0]?.transcript;
        const t = sanitizeVoiceTranscript(captured);
        if (t) {
            input.value = `${(input.value || '').trim()}${input.value ? ' ' : ''}${t}`.trim();
        }
        showToast(t ? 'Speech added to your message box.' : 'No usable speech captured.', t ? 'success' : 'warning');
        aiChatAutosizeTextarea(input);
    };
    rec.onerror = (err) => {
        window.__sigtsTourHelpRecListening = false;
        const code = String(err?.error || 'unknown');
        if (code === 'not-allowed' || code === 'service-not-allowed') {
            showToast('Microphone permission denied. Allow mic access in browser settings.', 'warning');
            return;
        }
        if (code === 'no-speech') {
            showToast('No speech detected. Try again and speak clearly.', 'warning');
            return;
        }
        if (code === 'audio-capture') {
            showToast('No microphone device detected.', 'warning');
            return;
        }
        showToast('Mic capture failed. Please retry.', 'warning');
    };
    rec.onend = () => {
        window.__sigtsTourHelpRecListening = false;
        if (window.__sigtsTourHelpRecTimeout) {
            clearTimeout(window.__sigtsTourHelpRecTimeout);
            window.__sigtsTourHelpRecTimeout = null;
        }
        setTourHelpMicButtonState(false);
    };
    window.__sigtsTourHelpRecListening = true;
    try {
        rec.start();
        window.__sigtsTourHelpRecTimeout = setTimeout(() => {
            try {
                rec.stop();
            } catch (_) {
                /**/
            }
        }, SIGTS_MIC_CAPTURE_TIMEOUT_MS);
    } catch (_) {
        window.__sigtsTourHelpRecListening = false;
        setTourHelpMicButtonState(false);
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
    if (!requireITManagerAccess('predictive analytics operations')) return;
    const d = await API.getAnalyticsAnomalies(2.5);
    if (d?.status >= 400) {
        showToast(d?.error || 'Anomalies request failed.', 'danger');
        return;
    }
    const rows = Array.isArray(d?.anomalies) ? d.anomalies : [];
    const content = rows.length
        ? `<div class="seasonal-list">${rows.slice(0, 30).map((a) => `<div class="seasonal-item">${escapeHtml(String(a.day || 'N/A'))} - count ${escapeHtml(String(a.count || 0))} - z ${escapeHtml(String(a.zscore || 0))}</div>`).join('')}</div>`
        : '<div class="empty-state">No anomaly rows found for this threshold.</div>';
    showRichContentModal({
        title: 'Analytics anomalies',
        bodyHtml: content,
        footerHtml: `<button type="button" class="small-btn ghost-btn" onclick="document.querySelector('.ui-modal-overlay-rich .ui-modal-close')?.click();">${icon('x', 'icon-sm')} Close</button>`
    });
};

window.itOpsQueueModelRetrain = async function () {
    if (!requireITManagerAccess('predictive analytics operations')) return;
    const r = await API.queuePredictiveTrainingJob('congestion_v1');
    if (r?.error || r?.status >= 400) showToast(r?.error || 'Queue retrain failed', 'danger');
    else showToast(r?.job?.job_id ? `Job ${r.job.job_id} queued.` : 'Retrain queued.', 'success');
};

window.itOpsRunReportBuild = async function () {
    if (!requireITManagerAccess('predictive analytics operations')) return;
    const r = await API.buildAnalyticsReport(['visitor_flow', 'satisfaction', 'sightings_trend', 'popular_content']);
    if (r?.status >= 400) showToast(r?.error || 'Report build failed', 'danger');
    else {
        const keys = r?.sections ? Object.keys(r.sections) : [];
        const errs = r?.section_errors ? Object.keys(r.section_errors) : [];
        const sectionRows = keys.length
            ? keys.map((k) => `<div class="seasonal-item"><strong>${escapeHtml(k)}</strong> loaded</div>`).join('')
            : '<div class="seasonal-item">No sections were generated.</div>';
        const errRows = errs.length
            ? `<h4 class="ui-modal-section-title">${icon('shield', 'icon-sm')} Section errors</h4><div class="seasonal-list">${errs.map((k) => `<div class="seasonal-item">${escapeHtml(k)}: ${escapeHtml(String(r.section_errors[k] || 'error'))}</div>`).join('')}</div>`
            : '';
        showRichContentModal({
            title: 'Report build result',
            bodyHtml: `<div class="seasonal-list">${sectionRows}</div>${errRows}`,
            footerHtml: `<button type="button" class="small-btn ghost-btn" onclick="document.querySelector('.ui-modal-overlay-rich .ui-modal-close')?.click();">${icon('x', 'icon-sm')} Close</button>`
        });
        showToast(`Report built: ${keys.length} section(s); ${errs.length} error(s).`, errs.length ? 'warning' : 'success');
    }
};

window.itOpsCreateReportSchedulePrompt = async function () {
    if (!requireITManagerAccess('predictive analytics operations')) return;
    const name = await showPromptDialog('Schedule name', 'Weekly SIGTS analytics report');
    if (!name) return;
    const cron = await showPromptDialog('CRON expression', '0 9 * * 1');
    if (!cron) return;
    const recipientsRaw = await showPromptDialog('Recipients (comma-separated emails)', 'admin@bwindi.com');
    const metricsRaw = await showPromptDialog('Metrics (comma-separated)', 'visitor_flow,satisfaction,sightings_trend,popular_content');
    const recipients = String(recipientsRaw || '').split(',').map((v) => v.trim()).filter(Boolean);
    const metricKeys = String(metricsRaw || '').split(',').map((v) => v.trim()).filter(Boolean);
    const created = await API.createReportSchedule({
        name,
        cron_expression: cron,
        email_recipients: recipients,
        metric_keys: metricKeys
    });
    if (created?.status >= 400 || created?.error) {
        showToast(created?.error || 'Failed to create report schedule.', 'danger');
        return;
    }
    showToast('Report schedule created.', 'success');
};

window.itOpsRunLatestSchedule = async function () {
    if (!requireITManagerAccess('predictive analytics operations')) return;
    const list = await API.listReportSchedules();
    const rows = Array.isArray(list?.schedules) ? list.schedules : [];
    if (!rows.length) {
        showToast('No report schedules found. Create one first.', 'warning');
        return;
    }
    const latest = rows[0];
    const run = await API.runReportSchedule(latest.schedule_id);
    if (run?.status >= 400 || run?.error) {
        showToast(run?.error || 'Failed to run report schedule.', 'danger');
        return;
    }
    const report = run?.report || {};
    const delivered = Number(run?.emails_attempted || 0);
    showRichContentModal({
        title: 'Schedule execution result',
        bodyHtml: `<div class="seasonal-list"><div class="seasonal-item"><strong>Schedule:</strong> ${escapeHtml(latest.name || latest.schedule_id)}</div><div class="seasonal-item"><strong>Emails attempted:</strong> ${escapeHtml(String(delivered))}</div><div class="seasonal-item"><strong>Generated at:</strong> ${escapeHtml(String(report.generated_at || 'N/A'))}</div></div>`,
        footerHtml: `<button type="button" class="small-btn ghost-btn" onclick="document.querySelector('.ui-modal-overlay-rich .ui-modal-close')?.click();">${icon('x', 'icon-sm')} Close</button>`
    });
    showToast(`Schedule "${latest.name || latest.schedule_id}" executed.`, 'success');
};

window.itOpsExportAnalyticsPrompt = async function () {
    if (!requireITManagerAccess('predictive analytics operations')) return;
    const format = (await showPromptDialog('Export format (json/csv)', 'json') || 'json').toLowerCase();
    const metricsRaw = await showPromptDialog('Metrics (comma-separated)', 'visitor_flow,sightings_trend,satisfaction');
    const metrics = String(metricsRaw || '').split(',').map((v) => v.trim()).filter(Boolean);
    const start = await showPromptDialog('Start datetime (ISO8601, optional)', '');
    const end = await showPromptDialog('End datetime (ISO8601, optional)', '');
    if (format === 'csv') {
        const raw = await API.exportAnalyticsDataRaw(metrics, start || '', end || '', 'csv');
        if (!raw?.ok) {
            showToast(raw?.error?.message || `CSV export failed (HTTP ${raw?.status || 0}).`, 'danger');
            return;
        }
        const csv = String(raw.text || '');
        if (!csv.trim()) {
            showToast('CSV export returned no rows.', 'warning');
            return;
        }
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `sigts-analytics-${stamp}.csv`;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
        showToast(`CSV downloaded: ${fileName}`, 'success');
    } else {
        const out = await API.exportAnalyticsData(metrics, start || '', end || '', format);
        if (out?.status >= 400 || out?.error) {
            showToast(out?.error || 'Export failed.', 'danger');
            return;
        }
        const keys = Object.keys(out || {});
        const rows = keys.length
            ? keys.map((k) => `<div class="seasonal-item"><strong>${escapeHtml(k)}</strong></div>`).join('')
            : '<div class="seasonal-item">No export keys returned.</div>';
        showRichContentModal({
            title: 'Analytics JSON export summary',
            bodyHtml: `<div class="seasonal-list">${rows}</div>`,
            footerHtml: `<button type="button" class="small-btn ghost-btn" onclick="document.querySelector('.ui-modal-overlay-rich .ui-modal-close')?.click();">${icon('x', 'icon-sm')} Close</button>`
        });
        showToast(`JSON export ready with ${keys.length} top-level key(s).`, 'success');
    }
};

window.itOpsPeekTrainingJobs = async function () {
    if (!requireITManagerAccess('predictive analytics operations')) return;
    const r = await API.listRetrainJobs();
    if (r?.status >= 400 || r?.error) {
        showToast(r?.error || 'Failed to load training jobs.', 'danger');
        return;
    }
    const jobs = Array.isArray(r?.jobs) ? r.jobs : [];
    const html = jobs.length
        ? `<div class="seasonal-list">${jobs.slice(0, 40).map((j) => `<div class="seasonal-item"><strong>${escapeHtml(j.model_key || 'model')}</strong> - ${escapeHtml(j.status || 'queued')} (${escapeHtml(String(j.job_id || ''))})</div>`).join('')}</div>`
        : '<div class="empty-state">No training jobs found.</div>';
    showRichContentModal({
        title: 'Training jobs',
        bodyHtml: html,
        footerHtml: `<button type="button" class="small-btn ghost-btn" onclick="document.querySelector('.ui-modal-overlay-rich .ui-modal-close')?.click();">${icon('x', 'icon-sm')} Close</button>`
    });
    showToast(`${jobs.length} training job(s) loaded.`, jobs.length ? 'info' : 'success');
};

function openTourAssignmentModal({ mode, guides, routes }) {
    return new Promise((resolve) => {
        const root = ensureFeedbackRoot();
        const overlay = document.createElement('div');
        overlay.className = 'ui-modal-overlay';
        const isWeekly = mode === 'weekly';
        const guideOptions = guides
            .map((g) => `<option value="${escapeHtml(g.user_id)}">${escapeHtml(g.first_name || '')} ${escapeHtml(g.last_name || '')} (${escapeHtml(g.username || '')})</option>`)
            .join('');
        const routeOptions = routes
            .map((r) => `<option value="${escapeHtml(r.route_id)}">${escapeHtml(r.name || 'Route')} • ${escapeHtml(String(r.difficulty || ''))}</option>`)
            .join('');
        const startDateDefault = new Date().toISOString().slice(0, 10);
        const startTimeDefault = '08:00';

        overlay.innerHTML = `
            <div class="ui-modal ui-modal-assignment" role="dialog" aria-modal="true">
                <div class="ui-modal-title">${isWeekly ? 'Weekly Tour Assignment' : 'Assign Tour to Guide'}</div>
                <div class="ui-assignment-grid">
                    <label class="ui-assignment-field">
                        <span>Guide</span>
                        <select id="assignGuideSelect" class="ui-modal-input ui-modal-select">${guideOptions}</select>
                    </label>
                    <label class="ui-assignment-field">
                        <span>Route</span>
                        <select id="assignRouteSelect" class="ui-modal-input ui-modal-select">${routeOptions}</select>
                    </label>
                    <label class="ui-assignment-field">
                        <span>${isWeekly ? 'Week start date' : 'Date'}</span>
                        <input id="assignDate" class="ui-modal-input" type="date" value="${startDateDefault}" />
                    </label>
                    <label class="ui-assignment-field">
                        <span>${isWeekly ? 'Daily start time' : 'Start time'}</span>
                        <input id="assignTime" class="ui-modal-input" type="time" value="${startTimeDefault}" />
                    </label>
                    <label class="ui-assignment-field">
                        <span>Group size</span>
                        <input id="assignGroupSize" class="ui-modal-input" type="number" min="1" max="200" value="8" />
                    </label>
                    <label class="ui-assignment-field ui-assignment-field-full">
                        <span>Special requests (optional)</span>
                        <input id="assignSpecialReq" class="ui-modal-input" type="text" placeholder="Accessibility needs, language preference..." />
                    </label>
                    ${isWeekly ? `
                    <div class="ui-assignment-field ui-assignment-field-full">
                        <span>Assign days (Sun-Sat)</span>
                        <div class="ui-weekday-row">
                            <label><input type="checkbox" value="0"> Sun</label>
                            <label><input type="checkbox" value="1" checked> Mon</label>
                            <label><input type="checkbox" value="2" checked> Tue</label>
                            <label><input type="checkbox" value="3" checked> Wed</label>
                            <label><input type="checkbox" value="4" checked> Thu</label>
                            <label><input type="checkbox" value="5" checked> Fri</label>
                            <label><input type="checkbox" value="6"> Sat</label>
                        </div>
                    </div>` : ''}
                </div>
                <div class="ui-modal-actions">
                    <button type="button" class="ui-btn ui-btn-secondary" data-action="cancel">Cancel</button>
                    <button type="button" class="ui-btn ui-btn-primary" data-action="submit">${isWeekly ? 'Create Weekly Assignments' : 'Assign Tour'}</button>
                </div>
            </div>
        `;

        const cleanup = (value) => {
            overlay.remove();
            resolve(value);
        };
        const collect = () => {
            const guide = overlay.querySelector('#assignGuideSelect')?.value || '';
            const route = overlay.querySelector('#assignRouteSelect')?.value || '';
            const date = overlay.querySelector('#assignDate')?.value || '';
            const time = overlay.querySelector('#assignTime')?.value || '';
            const groupSize = Number(overlay.querySelector('#assignGroupSize')?.value || 0) || undefined;
            const specialRequests = overlay.querySelector('#assignSpecialReq')?.value?.trim() || undefined;
            const startIso = date && time ? new Date(`${date}T${time}:00`).toISOString() : '';
            if (!isWeekly) {
                return {
                    guide_user_id: guide,
                    route_id: route,
                    scheduled_start: startIso,
                    group_size: groupSize,
                    special_requests: specialRequests
                };
            }
            const days = Array.from(overlay.querySelectorAll('.ui-weekday-row input[type="checkbox"]:checked'))
                .map((n) => Number(n.value))
                .filter((n) => Number.isInteger(n));
            return {
                guide_user_id: guide,
                route_id: route,
                week_start: date ? new Date(`${date}T00:00:00`).toISOString() : '',
                days,
                start_time: time,
                group_size: groupSize,
                special_requests: specialRequests
            };
        };

        overlay.querySelector('[data-action="cancel"]')?.addEventListener('click', () => cleanup(null));
        overlay.querySelector('[data-action="submit"]')?.addEventListener('click', () => cleanup(collect()));
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) cleanup(null);
        });
        root.appendChild(overlay);
        overlay.querySelector('#assignGuideSelect')?.focus();
    });
}

window.itOpsAssignSingleTourPrompt = async function () {
    if (!requireITManagerAccess('tour assignment operations')) return;
    const [guidesRes, routesRes] = await Promise.all([
        API.listTourGuidesForAssignment(),
        API.listTourRoutesForAssignment()
    ]);
    const guides = Array.isArray(guidesRes?.guides) ? guidesRes.guides : [];
    const routes = Array.isArray(routesRes?.routes) ? routesRes.routes : [];
    if (!guides.length || !routes.length) {
        showToast('Need at least one active guide and one route to assign tours.', 'warning');
        return;
    }
    const payload = await openTourAssignmentModal({ mode: 'single', guides, routes });
    if (!payload) return;
    if (!payload.guide_user_id || !payload.route_id || !payload.scheduled_start) {
        showToast('Guide, route, and start date/time are required.', 'warning');
        return;
    }
    const out = await API.createTourAssignment(payload);
    if (out?.status >= 400 || out?.error) {
        showToast(out?.error || 'Failed to assign tour.', 'danger');
        return;
    }
    showToast('Tour assigned to guide successfully.', 'success');
};

window.itOpsAssignWeeklyToursPrompt = async function () {
    if (!requireITManagerAccess('tour assignment operations')) return;
    const [guidesRes, routesRes] = await Promise.all([
        API.listTourGuidesForAssignment(),
        API.listTourRoutesForAssignment()
    ]);
    const guides = Array.isArray(guidesRes?.guides) ? guidesRes.guides : [];
    const routes = Array.isArray(routesRes?.routes) ? routesRes.routes : [];
    if (!guides.length || !routes.length) {
        showToast('Need at least one active guide and one route to assign weekly tours.', 'warning');
        return;
    }
    const payload = await openTourAssignmentModal({ mode: 'weekly', guides, routes });
    if (!payload) return;
    if (!payload.guide_user_id || !payload.route_id || !payload.week_start || !payload.start_time) {
        showToast('Guide, route, week start date, and time are required.', 'warning');
        return;
    }
    if (!Array.isArray(payload.days) || payload.days.length === 0) {
        showToast('Select at least one weekday for weekly assignment.', 'warning');
        return;
    }
    const out = await API.createWeeklyTourAssignments(payload);
    if (out?.status >= 400 || out?.error) {
        showToast(out?.error || 'Failed to create weekly assignments.', 'danger');
        return;
    }
    showToast(`Weekly assignments created: ${out.created_count || 0}.`, 'success');
};

window.itOpsPeekBackupsList = async function () {
    if (!requireITManagerAccess('backup operations')) return;
    const create = await showConfirmDialog('Create a new backup now? This can take up to a few minutes.');
    if (create) {
        const created = await API.createBackupRecord();
        if (created?.error || created?.status >= 400) {
            showToast(created?.error || 'Backup creation failed', 'danger');
            return;
        }
        showToast(`Backup created: ${created.backup_id || 'new artifact'}`, 'success');
    }
    const r = await API.listBackupRecords();
    if (r?.status >= 400 || r?.error) {
        showToast(r?.error || 'Backup list failed', 'danger');
        return;
    }
    const backups = Array.isArray(r?.backups) ? r.backups : [];
    const n = backups.length;
    const html = backups.length
        ? `<div class="seasonal-list">${backups.slice(0, 40).map((b) => {
            const m = b.metrics && typeof b.metrics === 'object' ? b.metrics : {};
            const id = m.backupId || b.report_id || 'backup';
            return `<div class="seasonal-item"><strong>${escapeHtml(String(id))}</strong><br><small>${escapeHtml(String(b.generated_at || ''))}</small></div>`;
        }).join('')}</div>`
        : '<div class="empty-state">No backups found.</div>';
    showRichContentModal({
        title: `Backup records (${n})`,
        bodyHtml: html,
        footerHtml: `<button type="button" class="small-btn ghost-btn" onclick="document.querySelector('.ui-modal-overlay-rich .ui-modal-close')?.click();">${icon('x', 'icon-sm')} Close</button>`
    });
    showToast(`${n} backup record(s) loaded.`, 'info');
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

window.applyAnimalsCatalogFilter = function applyAnimalsCatalogFilter() {
    const input = document.getElementById('animals-catalog-search');
    const term = String(input?.value || '').trim().toLowerCase();
    const grid = document.getElementById('animals-catalog-grid');
    if (!grid) return;
    grid.querySelectorAll('.animal-card').forEach((card) => {
        const blob = String(card.getAttribute('data-species-q') || '').toLowerCase();
        card.style.display = !term || blob.includes(term) ? '' : 'none';
    });
};

window.sigtsSubmitFaqHelpful = async function sigtsSubmitFaqHelpful(faqId) {
    const id = escAttrBareUuid(faqId);
    if (!id) return;
    if (!Auth?.getToken?.()) {
        showToast('Sign in to record helpful votes on the server.', 'info');
        return;
    }
    const r = await API.markFaqHelpful(id);
    if (r?.success && r.helpful_count != null) showToast(`Thanks — ${r.helpful_count} helpful`, 'success');
    else showToast('Could not update helpful count.', 'warning');
};

window.sigtsRemoveSavedBookmark = async function sigtsRemoveSavedBookmark(type, id) {
    const t = String(type || '').trim();
    const i = String(id || '').trim();
    if (!t || !i || typeof Content?.toggleBookmark !== 'function') return;
    const row = Content.readBookmarks().find((b) => b.type === t && String(b.id) === i);
    if (!row) return;
    Content.toggleBookmark({ type: t, id: i, title: row.title || i });
    showToast('Removed from saved.', 'success');
    try {
        invalidateSigtsViewCache('saved');
        invalidateSigtsViewCache('dashboard');
    } catch (_) {
        /**/
    }
    if (window.currentView === 'saved') {
        await renderView('saved', { updateHash: false, suppressAccessToast: true });
    }
};

window.runSigtsUnifiedSearch = async function runSigtsUnifiedSearch() {
    const input = document.getElementById('sigtsUnifiedSearchInput');
    const hi = document.getElementById('sigtsUnifiedSearchHighlight');
    const box = document.getElementById('sigtsUnifiedSearchResults');
    const q = String(input?.value || '').trim().toLowerCase();
    if (!box || !hi) return;
    if (q.length < 2) {
        showToast('Enter at least 2 characters.', 'warning');
        hi.setAttribute('hidden', '');
        box.setAttribute('hidden', '');
        return;
    }
    hi.removeAttribute('hidden');
    box.removeAttribute('hidden');
    hi.textContent = `Results for "${q}"`;
    box.innerHTML = '<div class="seasonal-item">Searching…</div>';
    try {
        const [animals, locs, stories, faqRows] = await Promise.all([
            Content.getAnimals(),
            Content.getLocations(),
            Content.getCulturalStories(),
            API.getFaqs().catch(() => [])
        ]);
        const rows = [];
        (animals || []).forEach((a) => {
            const blob = `${a.name || ''} ${a.scientific_name || ''}`.toLowerCase();
            if (blob.includes(q)) {
                rows.push({
                    kind: 'Animal',
                    title: a.name,
                    onclick: `openAnimalSpeciesDetail('${escAttrBareUuid(a.animal_id)}')`,
                    detail: a.scientific_name || ''
                });
            }
        });
        (locs || []).forEach((loc) => {
            const blob = `${loc.name || ''} ${loc.description || ''}`.toLowerCase();
            if (blob.includes(q)) {
                rows.push({
                    kind: 'Location',
                    title: loc.name || 'Place',
                    onclick: `openParkLocationDetail('${escAttrBareUuid(loc.location_id || loc.id)}')`,
                    detail: String(loc.location_type || loc.type || '')
                });
            }
        });
        (stories || []).forEach((s) => {
            const blob = `${s.title_en || ''} ${s.narrative_en || s.story || ''}`.toLowerCase();
            if (blob.includes(q)) {
                rows.push({
                    kind: 'Culture',
                    title: s.title_en || 'Story',
                    onclick: `openCulturalStoryDetail('${escAttrBareUuid(s.narrative_id)}')`,
                    detail: 'Cultural narrative'
                });
            }
        });
        (faqRows || []).forEach((f) => {
            const blob = `${f.question_en || ''} ${f.answer_en || ''}`.toLowerCase();
            if (blob.includes(q)) {
                rows.push({
                    kind: 'FAQ',
                    title: f.question_en || 'Question',
                    onclick: `navigateTo('info')`,
                    detail: f.category || ''
                });
            }
        });
        const lim = rows.slice(0, 28);
        box.innerHTML = lim.length
            ? lim
                  .map(
                      (r) =>
                          `<div class="seasonal-item"><strong>${escapeHtml(r.kind)}</strong> · ${escapeHtml(r.title)}<br/><span class="ui-modal-muted">${escapeHtml(
                              r.detail || ''
                          )}</span><br/><button type="button" class="small-btn" onclick="${r.onclick}">Open</button></div>`
                  )
                  .join('')
            : '<div class="seasonal-item">No matches in the cached catalogue. Try another keyword or refresh offline content from Profile.</div>';
    } catch (e) {
        console.error(e);
        box.innerHTML = '<div class="seasonal-item">Search failed — check connection.</div>';
    }
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

window.sigtsProfileScrollTo = function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.saveProfilePersonalFromPanel = async function () {
    if (Auth.getCurrentUser()?.isGuest) return;
    const firstName = document.getElementById('profileFirstName')?.value?.trim() ?? '';
    const lastName = document.getElementById('profileLastName')?.value?.trim() ?? '';
    const phone = document.getElementById('profilePhone')?.value?.trim() ?? '';
    const payload = { firstName, lastName, phone };
    const nat = document.getElementById('profileNationality');
    if (nat) payload.nationality = nat.value?.trim() ?? '';
    const res = await API.updateUserProfile(payload);
    if (res?.error || (typeof res?.status === 'number' && res.status >= 400) || res?.errors?.length) {
        showToast(res.error || res.errors?.[0]?.msg || 'Could not update profile', 'danger');
        return;
    }
    showToast('Profile saved.', 'success');
    const u = Auth.getCurrentUser();
    if (u) {
        u.name = `${firstName} ${lastName}`.trim() || u.name;
        u.phone = phone;
        if (localStorage.getItem('token')) localStorage.setItem('user', JSON.stringify(u));
        else sessionStorage.setItem('user', JSON.stringify(u));
    }
};

window.saveProfilePhotoUrl = async function () {
    if (Auth.getCurrentUser()?.isGuest) return;
    const url = document.getElementById('profilePhotoUrl')?.value?.trim() ?? '';
    const res = await API.updateUserProfile({ profile_pic_url: url || null });
    if (res?.error || (typeof res?.status === 'number' && res.status >= 400)) {
        showToast(res.error || 'Could not save photo URL', 'danger');
        return;
    }
    showToast('Profile photo updated.', 'success');
    await renderView('profile', { updateHash: false, suppressAccessToast: true });
};

window.saveProfileBioLocal = function () {
    const v = document.getElementById('profileBioLocal')?.value ?? '';
    try {
        localStorage.setItem('sigts_profile_bio_v1', v);
        showToast('Bio saved on this device.', 'success');
    } catch (_) {
        showToast('Could not save bio locally.', 'danger');
    }
};

window.tryRefreshProfileLocation = function () {
    if (!navigator.geolocation) {
        showToast('This browser does not expose GPS.', 'warning');
        return;
    }
    navigator.geolocation.getCurrentPosition(
        (position) => {
            if (window.Geofence && typeof window.Geofence.handleLocationUpdate === 'function') {
                window.Geofence.handleLocationUpdate(position);
            } else {
                window.AppState = window.AppState || {};
                window.AppState.currentLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp || Date.now()
                };
            }
            showToast('Location updated.', 'success');
            renderView('profile', { updateHash: false, suppressAccessToast: true }).catch(() => {});
        },
        () => showToast('Location permission denied or unavailable.', 'warning'),
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
};

const PROFILE_CONSENT_DEFS = [
    { type: 'location_tracking', label: 'Location tracking', hint: 'Needed for geofence updates and map features.' },
    { type: 'analytics', label: 'Usage analytics', hint: 'Helps improve SIGTS flows.' },
    { type: 'push_notifications', label: 'Push notifications', hint: 'Tour reminders when the device supports them.' },
    { type: 'cultural_content_imagery', label: 'Cultural imagery', hint: 'Photos and audio on heritage stories.' }
];

async function loadProfileConsentsPanel() {
    const root = document.getElementById('profileConsentsMount');
    if (!root) return;
    if (Auth.getCurrentUser()?.isGuest) {
        root.innerHTML =
            '<p class="ui-modal-muted">Create a full account to manage privacy consents for notifications and location.</p>';
        return;
    }
    let consents = [];
    try {
        consents = await API.getMyConsents();
    } catch (_) {
        consents = [];
    }
    const latest = {};
    (consents || []).forEach((row) => {
        if (!row.consent_type) return;
        latest[row.consent_type] = row;
    });
    root.innerHTML = `<div class="profile-consent-list">${PROFILE_CONSENT_DEFS.map((def) => {
        const row = latest[def.type];
        const granted = Boolean(row?.granted) && !row?.revoked_at;
        const t = escapeHtml(def.type);
        return `<div class="profile-consent-row">
            <div><strong>${escapeHtml(def.label)}</strong><p class="ui-modal-muted" style="margin:4px 0 0;">${escapeHtml(def.hint)}</p></div>
            <label class="profile-consent-toggle"><input type="checkbox" data-consent-type="${t}" ${granted ? 'checked' : ''} onchange="sigtsToggleProfileConsent(this)" /><span class="profile-consent-state">${granted ? 'On' : 'Off'}</span></label>
        </div>`;
    }).join('')}</div>`;
}

window.sigtsToggleProfileConsent = async function (el) {
    const type = el?.dataset?.consentType;
    if (!type) return;
    const granted = Boolean(el.checked);
    const res = await API.setMyConsent(type, granted);
    if (!res || res.success !== true) {
        showToast(res?.error || 'Could not update preference', 'danger');
        el.checked = !granted;
        return;
    }
    const span = el.closest('.profile-consent-toggle')?.querySelector('.profile-consent-state');
    if (span) span.textContent = granted ? 'On' : 'Off';
    showToast('Preference saved.', 'success');
};

async function deactivateMyAccountFromProfile() {
    const u = Auth.getCurrentUser();
    if (u?.isGuest) {
        showToast('Guest access ends when you log out; there is no registered account to deactivate.', 'info');
        return;
    }
    if (!(await showConfirmDialog('Deactivate your account? You will be signed out and cannot sign in again until IT restores access.'))) return;
    const res = await API.deactivateMyAccount();
    if (res?.success) {
        showToast('Account deactivated.', 'success');
        await Auth.logout();
    } else {
        showToast(res?.error || res?.message || 'Could not deactivate. Try again when online with a valid session.', 'danger');
    }
}

async function adminDeactivateAccountPrompt(userId, isSelf) {
    if (!userId) return;
    if (!isCurrentUserITManager()) {
        showToast('Only IT managers can deactivate other accounts from this screen.', 'warning');
        return;
    }
    const msg = isSelf
        ? 'Deactivate your own IT account? You will be signed out immediately.'
        : 'Deactivate this user? They cannot sign in until an IT manager reactivates the account.';
    if (!(await showConfirmDialog(msg))) return;
    const res = await API.adminDeactivateUser(userId);
    if (res?.success) {
        showToast(res?.alreadyInactive ? 'Account was already inactive.' : 'Account deactivated.', res?.alreadyInactive ? 'info' : 'success');
        if (isSelf) await Auth.logout();
        else await renderView('it_dashboard', { updateHash: false, suppressAccessToast: true });
    } else {
        showToast(res?.error || res?.message || 'Deactivation failed.', 'danger');
    }
}

window.showToast = showToast;
window.togglePasswordVisibility = togglePasswordVisibility;
window.showPromptDialog = showPromptDialog;
window.showConfirmDialog = showConfirmDialog;
window.deactivateMyAccountFromProfile = deactivateMyAccountFromProfile;
window.adminDeactivateAccountPrompt = adminDeactivateAccountPrompt;

async function handleRegistration() {
    setAuthFeedback('');
    const result = await Auth.register({
        fullName: document.getElementById('regFullName')?.value,
        email: document.getElementById('regEmail')?.value,
        username: document.getElementById('regUsername')?.value,
        phone: document.getElementById('regPhone')?.value,
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
    if (button) {
        button.setAttribute('aria-label', shouldShow ? 'Hide password' : 'Show password');
        button.setAttribute('aria-pressed', shouldShow ? 'true' : 'false');
        button.classList.toggle('active', shouldShow);
        button.innerHTML = icon(shouldShow ? 'eyeOff' : 'eye', 'auth-password-toggle-icon');
    }
}

/** Password row with lock icon and reveal control (keeps text clear of the eye button). */
function renderAuthPasswordField(inputId, label, placeholder, autocomplete) {
    const ac = autocomplete === 'current-password' ? 'current-password' : 'new-password';
    return `<label class="auth-field"><span class="auth-field-label">${escapeHtml(label)}</span><span class="auth-input-shell auth-input-shell--has-password-toggle">${icon('lock', 'auth-input-icon')}<input type="password" id="${escapeHtml(inputId)}" class="auth-input auth-input-with-icon auth-input--password-toggle" placeholder="${escapeHtml(placeholder)}" autocomplete="${ac}"><button type="button" class="auth-password-toggle" aria-label="Show password" aria-pressed="false" onclick="togglePasswordVisibility('${inputId}', this)">${icon('eye', 'auth-password-toggle-icon')}</button></span></label>`;
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
    if (Auth.getCurrentUser()?.isGuest) {
        showToast('Guest accounts cannot enable MFA. Create a full account first.', 'warning');
        return;
    }
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

window.openTourPreparation = async function (tourId) {
    if (!Auth.hasRole('guide')) return;
    const prep = await API.getTourPreparation(tourId);
    if (!prep || prep.error) {
        showToast(prep?.error || 'Failed to load tour preparation.', 'danger');
        return;
    }
    const checklist = (prep.checklist || []).map((c) => `${c.done ? '✓' : '□'} ${c.label}`).join('\n');
    alert(`Tour preparation for ${prep.route?.name || 'route'}\nGuests: ${prep.guest_count || 0}\n\nChecklist:\n${checklist}`);
};

window.openGuestProfile = async function (touristId) {
    if (!Auth.hasRole('guide')) return;
    const profile = await API.getGuestProfileForGuide(touristId);
    if (!profile || profile.error) {
        showToast(profile?.error || 'Failed to load guest profile.', 'danger');
        return;
    }
    const p = profile.profile || {};
    const historyCount = Array.isArray(profile.history) ? profile.history.length : 0;
    alert(`Guest: ${(p.first_name || '')} ${(p.last_name || '')}\nNationality: ${p.nationality || 'N/A'}\nInterests: ${JSON.stringify(p.interests || [])}\nPast tours found: ${historyCount}`);
};

window.viewActiveTourCompletionReport = async function () {
    if (!Auth.hasRole('guide')) return;
    const m = getGuideOpsManager();
    const tourId = m.activeTour?.tour_session_id || (await API.getToursForGuide())?.find((t) => t.status === 'ongoing')?.tour_session_id;
    if (!tourId) {
        showToast('No active tour for completion report.', 'warning');
        return;
    }
    const report = await API.getTourCompletionReport(tourId);
    if (!report || report.error) {
        showToast(report?.error || 'Failed to load completion report.', 'danger');
        return;
    }
    alert(`Completion report\nRoute: ${report.route_name || 'N/A'}\nDuration: ${report.duration_minutes || 0} min\nDistance: ${report.distance_km || 0} km\nSightings: ${report.sightings?.total_sightings || 0}\nAvg rating: ${report.feedback_summary?.average_guest_rating || 0}`);
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
            <details class="auth-side-message-wrap" open>
                <summary class="auth-side-toggle" aria-label="Toggle welcome information">Welcome information</summary>
                <div class="auth-side-message">
                    <span class="auth-side-kicker">Welcome</span>
                    <h1>Smart Information Access to<br>Bwindi Impenetrable National Park</h1>
                    <p>Navigate trails, discover wildlife insights, and receive real-time guidance for a safer, richer park experience as you navigate with your prefered tour guide.</p>
                </div>
            </details>
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
                    ${renderAuthPasswordField('loginPassword', 'Password', 'Enter your password', 'current-password')}
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
                    <label class="auth-field"><span class="auth-field-label">Phone</span><span class="auth-input-shell">${icon('phone', 'auth-input-icon')}<input type="tel" id="regPhone" class="auth-input auth-input-with-icon" placeholder="Include country code" autocomplete="tel"></span></label>
                    ${renderAuthPasswordField('regPassword', 'Password', 'Create a password', 'new-password')}
                    ${renderAuthPasswordField('regConfirmPassword', 'Confirm Password', 'Repeat your password', 'new-password')}
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

let __sigtsAIViewportHooksBound = false;
function syncAIComposerViewportOffset() {
    const root = document.documentElement;
    if (!root) return;
    if (window.currentView !== 'ai_chat') {
        root.style.setProperty('--sigts-ai-bottom-offset', '0px');
        root.style.setProperty('--sigts-ai-composer-height', '88px');
        return;
    }
    const composer = document.querySelector('.ai-chat-composer-float .ai-chat-composer');
    const composerHeight = composer ? Math.ceil(composer.getBoundingClientRect().height) : 88;
    root.style.setProperty('--sigts-ai-composer-height', `${composerHeight}px`);
    const vv = window.visualViewport;
    if (!vv) {
        root.style.setProperty('--sigts-ai-bottom-offset', '0px');
        return;
    }
    const layoutHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const visualBottom = vv.offsetTop + vv.height;
    const hiddenBottom = Math.max(0, layoutHeight - visualBottom);
    root.style.setProperty('--sigts-ai-bottom-offset', `${Math.ceil(hiddenBottom)}px`);
}

function bindAIViewportHooksOnce() {
    if (__sigtsAIViewportHooksBound) return;
    __sigtsAIViewportHooksBound = true;
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', syncAIComposerViewportOffset);
        window.visualViewport.addEventListener('scroll', syncAIComposerViewportOffset);
    }
    window.addEventListener('resize', syncAIComposerViewportOffset);
    window.addEventListener('orientationchange', () => {
        window.setTimeout(syncAIComposerViewportOffset, 60);
    });
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
        if (!canUserAccessView(role, safeView, Auth.getCurrentUser())) {
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
    const renderNonce = ++__sigtsRenderNonce;

    if (shouldUpdateHash) {
        const targetHash = `#${safeView}`;
        if (window.location.hash !== targetHash) {
            window.location.hash = targetHash;
        }
    }

    document.body.classList.toggle('auth-page', PUBLIC_VIEWS.has(safeView));
    document.body.classList.toggle('ai-chat-view', safeView === 'ai_chat');
    document.body.classList.toggle('pa-analytics-view', safeView === 'it_predictive_analytics');

    const u = Auth.getCurrentUser() || {};
    const isGuide = u?.role === 'guide' || u?.userType === 'guide';
    const isITManager = u?.role === 'it_manager' || u?.userType === 'it_manager';
    document.body.classList.toggle('sigts-has-mobile-tabs', Auth.isAuthenticated() && !PUBLIC_VIEWS.has(safeView) && !isGuide && !isITManager);
    bindAIViewportHooksOnce();
    syncAIComposerViewportOffset();

    if (safeView !== 'map') {
        teardownLiveMap();
    }
    if (safeView !== 'it_dashboard') {
        stopAdminRealtimeUsersRefresh();
    }
    if (safeView !== 'guide_dashboard') {
        stopGuideDashboardRefresh();
    }
    if (safeView !== 'it_tour_assignments') {
        stopAssignmentDashboardRefresh();
    }

    // Public views render immediately (no heavy switching needs).
    if (safeView === 'login') {
        app.innerHTML = renderLoginScreen();
        syncNavDrawerBodyLock();
        return;
    }
    if (safeView === 'register') {
        app.innerHTML = renderRegisterScreen();
        syncNavDrawerBodyLock();
        return;
    }

    ensureShimmerKeyframes();

    // 1) Paint instantly: cached view if available, otherwise a lightweight skeleton.
    const cached = getCachedViewHtml(safeView);
    app.innerHTML = renderMainLayout(cached || renderViewSkeleton(safeView));
    syncSidebarToggleA11y();
    refreshNetworkStatusBadge();

    // Never block UX on badge fetches.
    Promise.resolve().then(() => refreshRareAlertBadge()).catch(() => {});

    // 2) Compute heavy view content and swap only the slot.
    try {
        const html = await getOrComputeViewContent(safeView);
        if (renderNonce !== __sigtsRenderNonce || window.currentView !== safeView) return;
        const slot = document.getElementById('sigtsViewSlot');
        if (slot) slot.innerHTML = html;
        setCachedViewHtml(safeView, html);
    } catch (err) {
        if (renderNonce !== __sigtsRenderNonce || window.currentView !== safeView) return;
        const slot = document.getElementById('sigtsViewSlot');
        if (slot) {
            slot.innerHTML = `<div class="section-card"><div class="empty-state">Could not load this tab. ${escapeHtml(String(err?.message || err || ''))}</div></div>`;
        }
    }

    // 3) Post-render hooks (async; do not block switching).
    if (renderNonce !== __sigtsRenderNonce || window.currentView !== safeView) return;

    if (safeView === 'it_dashboard') startAdminRealtimeUsersRefresh();
    if (safeView === 'guide_dashboard') startGuideDashboardRefresh();
    if (safeView === 'it_tour_assignments') startAssignmentDashboardRefresh();

    if (safeView === 'map') {
        requestAnimationFrame(() => {
            initializeLiveMap().catch(() => {});
        });
    } else if (safeView === 'profile') {
        requestAnimationFrame(() => {
            if (!isCurrentUserITManager()) {
                loadRecentFeedback().catch(() => {});
            }
            loadProfileConsentsPanel().catch(() => {});
        });
    }
    if (safeView === 'ai_chat') {
        requestAnimationFrame(() => {
            applySIGTSAIPrefill();
            const ta = document.getElementById('aiChatInput');
            if (ta) aiChatAutosizeTextarea(ta);
            syncAIComposerViewportOffset();
        });
    }
    if (safeView === 'guide_dashboard') {
        requestAnimationFrame(() => {
            if (typeof window.initGuideMessagingPanel === 'function') {
                window.initGuideMessagingPanel();
            }
        });
    }
    if (safeView === 'intranet') {
        requestAnimationFrame(() => refreshIntranetParkStatusLinks());
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
    refreshIntranetParkStatusLinks();
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

(function initResponsiveNavigationChrome() {
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (window.innerWidth > SIGTS_NAV_DRAWER_MAX_PX) {
                document.querySelector('.sidebar')?.classList.remove('open');
            }
            syncSidebarToggleA11y();
        }, 120);
    });
    window.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (window.innerWidth > SIGTS_NAV_DRAWER_MAX_PX) return;
        if (!document.querySelector('.sidebar')?.classList.contains('open')) return;
        e.preventDefault();
        closeSidebar();
    });
})();
