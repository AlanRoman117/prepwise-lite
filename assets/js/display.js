/*
 * Display preferences, applied before the page paints.
 *
 * This is the one script loaded in <head> rather than at the end of <body>.
 * The text scale changes the root font size, and every size in the stylesheet
 * is in rem, so applying it after the first paint would show the whole layout
 * at one size and then visibly jump to another on every single load. The theme
 * is worse: a dark-mode user would get a flash of the full light palette. One
 * localStorage read is cheap enough to do before render.
 *
 * It cannot be an inline <script> either: script-src 'self' has no
 * 'unsafe-inline'. Hence a separate file.
 *
 * Deliberately standalone - it shares no globals with app.js, because it runs
 * long before app.js exists.
 */
(function () {
    'use strict';

    var STORAGE_KEY = 'prepwise-display-settings';

    // The only values the stylesheet knows how to render. Anything else in
    // storage - an older build, a typo, someone poking at devtools - falls back
    // to standard rather than being trusted.
    var TEXT_SCALES = ['standard', 'large', 'x-large', 'xx-large'];

    // What the user can choose. "system" is a preference, not a palette: it is
    // resolved to light or dark below, so the stylesheet only ever sees the two
    // real ones and can define the dark ramps in a single place.
    var THEMES = ['system', 'light', 'dark'];

    // The measures app.js offers. Kept here rather than imported because this
    // file deliberately shares nothing with app.js - it runs long before it.
    var UNITS = ['units', 'oz', 'lb', 'g', 'kg', 'cups', 'tbsp', 'tsp'];

    function readTextScale() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return 'standard';
            var parsed = JSON.parse(raw);
            var scale = parsed && parsed.textScale;
            return TEXT_SCALES.indexOf(scale) === -1 ? 'standard' : scale;
        } catch (error) {
            // Private browsing can throw on localStorage access, and a corrupt
            // value should never stop the app from rendering.
            return 'standard';
        }
    }

    function readSettings() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            var parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (error) {
            return {};
        }
    }

    function writeSettings(patch) {
        try {
            var next = readSettings();
            for (var key in patch) {
                if (Object.prototype.hasOwnProperty.call(patch, key)) next[key] = patch[key];
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch (error) {
            // Preference just will not persist; this session still honours it.
        }
    }

    /* The last unit the user picked, so the next item starts there. */
    function readUnit() {
        var unit = readSettings().lastUnit;
        return UNITS.indexOf(unit) === -1 ? 'units' : unit;
    }

    function saveUnit(unit) {
        if (UNITS.indexOf(unit) !== -1) writeSettings({ lastUnit: unit });
    }

    /* ----------------------------------------------------------------------
     * Theme
     * ------------------------------------------------------------------- */

    function readTheme() {
        var theme = readSettings().theme;
        return THEMES.indexOf(theme) === -1 ? 'system' : theme;
    }

    function prefersDark() {
        // matchMedia is missing in some very old embedded browsers; light is the
        // safer guess, since the app was designed light-first.
        return typeof window.matchMedia === 'function'
            && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    /** Turn a preference into the one of two palettes the stylesheet defines. */
    function resolveTheme(theme) {
        if (theme === 'light' || theme === 'dark') return theme;
        return prefersDark() ? 'dark' : 'light';
    }

    function applyTheme(theme) {
        var safe = THEMES.indexOf(theme) === -1 ? 'system' : theme;
        // Always explicit, even for "system". The stylesheet has no
        // prefers-color-scheme rule to fall back on - see styles.css.
        document.documentElement.setAttribute('data-theme', resolveTheme(safe));
        return safe;
    }

    function saveTheme(theme) {
        var safe = applyTheme(theme);
        writeSettings({ theme: safe });
        return safe;
    }

    /*
     * Following the system means following it while the app is open, too - a
     * laptop that switches to dark at sunset should take the app with it. Only
     * while the preference is "system"; an explicit choice ignores the OS.
     */
    function watchSystemTheme() {
        if (typeof window.matchMedia !== 'function') return;
        var query = window.matchMedia('(prefers-color-scheme: dark)');
        var onChange = function () {
            if (readTheme() === 'system') applyTheme('system');
        };
        if (typeof query.addEventListener === 'function') {
            query.addEventListener('change', onChange);
        } else if (typeof query.addListener === 'function') {
            query.addListener(onChange);   // Safari < 14
        }
    }

    function applyTextScale(scale) {
        var safe = TEXT_SCALES.indexOf(scale) === -1 ? 'standard' : scale;
        // Standard is the stylesheet's own default; leaving the attribute off
        // keeps the DOM honest about "no preference set".
        if (safe === 'standard') {
            document.documentElement.removeAttribute('data-text-scale');
        } else {
            document.documentElement.setAttribute('data-text-scale', safe);
        }
        return safe;
    }

    function saveTextScale(scale) {
        var safe = applyTextScale(scale);
        writeSettings({ textScale: safe });
        return safe;
    }

    applyTextScale(readTextScale());
    applyTheme(readTheme());
    watchSystemTheme();

    // app.js picks these up once it loads.
    window.prepwiseDisplay = {
        TEXT_SCALES: TEXT_SCALES,
        THEMES: THEMES,
        read: readTextScale,
        save: saveTextScale,
        readTheme: readTheme,
        saveTheme: saveTheme,
        resolveTheme: resolveTheme,
        readUnit: readUnit,
        saveUnit: saveUnit
    };
})();
