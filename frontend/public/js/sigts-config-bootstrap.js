/**
 * Committed runtime bootstrap — always load before app-data.js.
 * Optional public/runtime-config.js (generated) may override __SIGTS_CONFIG__.
 */
(function () {
    if (!window.__SIGTS_CONFIG__) {
        window.__SIGTS_CONFIG__ = {
            NODE_ENV: 'development',
            API_URL: null,
            API_PORT: 8000,
            MAP_TILES_URL: '/tiles',
            PARK_NAME: 'Bwindi Impenetrable National Park',
            DEFAULT_LANGUAGE: 'en'
        };
    }

    if (window.__SIGTS_API_BASE__) return;

    var cfg = window.__SIGTS_CONFIG__ || {};
    var pageOrigin =
        window.location && window.location.origin ? window.location.origin : 'http://localhost:3000';
    var pagePort =
        window.location && window.location.port
            ? window.location.port
            : window.location && window.location.protocol === 'https:'
              ? '443'
              : '80';

    function withApiSuffix(href) {
        var h = String(href || '').replace(/\/$/, '');
        if (!/\/api$/i.test(h)) {
            try {
                var u = new URL(h);
                h = u.origin + '/api';
            } catch (_) {
                h = h + '/api';
            }
        }
        return h;
    }

    if (pagePort === '3000') {
        var apiPort3000 = Number(cfg.API_PORT) || 8000;
        var host3000 = window.location && window.location.hostname ? window.location.hostname : 'localhost';
        if (cfg.API_URL) {
            try {
                var parsed3000 = new URL(cfg.API_URL, pageOrigin);
                var apiHost3000 = parsed3000.hostname || '';
                if (
                    host3000 &&
                    (apiHost3000 === 'localhost' || apiHost3000 === '127.0.0.1') &&
                    host3000 !== apiHost3000
                ) {
                    parsed3000.hostname = host3000;
                }
                window.__SIGTS_API_BASE__ = withApiSuffix(parsed3000.toString());
                return;
            } catch (_) {
                window.__SIGTS_API_BASE__ = withApiSuffix(cfg.API_URL);
                return;
            }
        }
        window.__SIGTS_API_BASE__ =
            (window.location.protocol || 'http:') + '//' + host3000 + ':' + apiPort3000 + '/api';
        return;
    }

    if (pagePort === '80' || pagePort === '443' || pagePort === '') {
        window.__SIGTS_API_BASE__ = withApiSuffix(pageOrigin);
        return;
    }

    if (pagePort === '8000' || pagePort === '8001') {
        window.__SIGTS_API_BASE__ = withApiSuffix(pageOrigin);
        return;
    }

    if (cfg.API_URL) {
        try {
            var parsed = new URL(cfg.API_URL, pageOrigin);
            window.__SIGTS_API_BASE__ = withApiSuffix(parsed.toString());
            return;
        } catch (_) {
            window.__SIGTS_API_BASE__ = withApiSuffix(cfg.API_URL);
            return;
        }
    }

    var protocol = window.location && window.location.protocol ? window.location.protocol : 'http:';
    var hostname = window.location && window.location.hostname ? window.location.hostname : 'localhost';
    var port = Number(cfg.API_PORT) || 8000;
    window.__SIGTS_API_BASE__ = protocol + '//' + hostname + ':' + port + '/api';
})();
