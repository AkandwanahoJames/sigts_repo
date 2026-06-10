/**
 * Final boot check — runs after app.js. Catches silent failures (e.g. app.js threw before init).
 */
(function () {
    function isInitialPlaceholder() {
        var app = document.getElementById('app');
        if (!app) return false;
        var p = app.querySelector('.loading-container p, p');
        return p && /^Loading SIGTS\.{3}$/i.test(String(p.textContent || '').trim());
    }

    // Total grace period before we surface a "taking too long" message. Serverless
    // cold starts plus database latency can legitimately push a logged-in user's first
    // render past several seconds, so we poll patiently instead of failing hard at 6s.
    var MAX_STARTUP_WAIT_MS = 18000;
    var POLL_INTERVAL_MS = 3000;
    var waited = 0;

    function checkBoot() {
        if (window.__SIGTS_BOOT_OK) return;

        // Scripts failed to load/parse — renderView never became available. This is a
        // genuine hard failure, so report it without waiting for the full grace period.
        if (typeof window.renderView !== 'function') {
            var src = window.__SIGTS_SCRIPT_ERROR || '';
            var hint = src
                ? 'Broken script: ' + src
                : 'Open DevTools → Console for the first red error. If you use port 3000, run: cd frontend && npm run dev';
            if (typeof window.sigtsShowBootFailure === 'function') {
                window.sigtsShowBootFailure('The app UI did not initialize.', hint);
            }
            return;
        }

        if (!isInitialPlaceholder()) return; // app rendered — all good.

        waited += POLL_INTERVAL_MS;
        if (waited < MAX_STARTUP_WAIT_MS) {
            window.setTimeout(checkBoot, POLL_INTERVAL_MS);
            return;
        }

        if (typeof window.sigtsShowBootFailure === 'function') {
            window.sigtsShowBootFailure(
                'Startup is taking longer than expected.',
                'This can happen on the first load after the server has been idle. Please reload — if it keeps happening, check your connection.'
            );
        }
    }

    window.setTimeout(checkBoot, 6000);
})();
