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

    function checkBoot() {
        if (window.__SIGTS_BOOT_OK) return;
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
        if (isInitialPlaceholder()) {
            if (typeof window.sigtsShowBootFailure === 'function') {
                window.sigtsShowBootFailure(
                    'Startup is taking too long.',
                    'Check that the API is running (e.g. port 8001) and reload.'
                );
            }
        }
    }

    window.setTimeout(checkBoot, 6000);
})();
