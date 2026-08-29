/*
 * Kitchen timers.
 *
 * Three things drive the design:
 *
 *  1. A timer must survive a reload. Tablets get bumped, browsers reload tabs
 *     to reclaim memory, and a timer that quietly dies while the pasta boils is
 *     worse than no timer. So a running timer stores an *absolute* end time and
 *     the remaining figure is derived from the clock, never counted down in a
 *     variable. Close the tab for two minutes and come back: it is two minutes
 *     further along, exactly as a physical timer would be.
 *
 *  2. The alarm cannot depend on a file. There are no runtime network requests
 *     and no assets to fetch, so the chime is synthesised with the Web Audio
 *     API - three oscillator notes, built at the moment it rings.
 *
 *  3. Ticking must not repaint the app. The loop updates only the few text
 *     nodes and ring offsets that changed, so typing in a form or scrolling a
 *     recipe is never interrupted, and the loop stops entirely when nothing is
 *     running.
 *
 * Timers are device state, not pantry data: they are not part of the backup.
 */

const TIMERS_STORAGE_KEY = 'prepwise-timers';

const TIMER_LIMITS = {
    count: 24,
    // 99:59:59. The ceiling exists because the readout has to stay inside the
    // dial, and because a duration longer than this is a calendar, not a timer.
    seconds: 99 * 3600 + 59 * 60 + 59,
    hours: 99,
    label: 80
};

/** Presets covering most of what a recipe asks for. */
const TIMER_PRESETS = [
    { label: '1 min', seconds: 60 },
    { label: '3 min', seconds: 180 },
    { label: '5 min', seconds: 300 },
    { label: '10 min', seconds: 600 },
    { label: '15 min', seconds: 900 },
    { label: '20 min', seconds: 1200 },
    { label: '30 min', seconds: 1800 },
    { label: '45 min', seconds: 2700 },
    { label: '1 hour', seconds: 3600 }
];

let timers = [];
let tickHandle = null;
let audioContext = null;

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** 90 -> "1:30", 3720 -> "1:02:00". Always at least m:ss. */
function formatDuration(totalSeconds) {
    const seconds = Math.max(0, Math.round(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = seconds % 60;

    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
    }
    return `${minutes}:${String(rest).padStart(2, '0')}`;
}

/** "5 min", "1 min 30 sec" - for labels and screen readers. */
function describeDuration(totalSeconds) {
    const seconds = Math.max(0, Math.round(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = seconds % 60;

    const parts = [];
    if (hours) parts.push(`${hours} hr`);
    if (minutes) parts.push(`${minutes} min`);
    if (rest || !parts.length) parts.push(`${rest} sec`);
    return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function sanitizeTimer(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

    const duration = Number(raw.durationSeconds);
    if (!Number.isFinite(duration) || duration <= 0) return null;

    const status = ['running', 'paused', 'finished'].includes(raw.status) ? raw.status : 'paused';
    const endsAt = Number(raw.endsAt);

    const timer = {
        id: Number.isFinite(Number(raw.id)) ? Number(raw.id) : Date.now() + Math.floor(Math.random() * 10000),
        // Reuses app.js's sanitizer: control characters, bidi overrides,
        // trimming and the length cap all in one audited place.
        label: cleanString(raw.label, TIMER_LIMITS.label),
        durationSeconds: Math.min(Math.max(Math.round(duration), 1), TIMER_LIMITS.seconds),
        remainingSeconds: 0,
        endsAt: null,
        status,
        source: typeof raw.source === 'string' ? raw.source.slice(0, 120) : null
    };

    if (status === 'running' && Number.isFinite(endsAt)) {
        timer.endsAt = endsAt;
        // The clock moved while the page was closed; a timer whose moment has
        // passed comes back finished rather than as a stale countdown.
        if (endsAt <= Date.now()) {
            timer.status = 'finished';
            timer.endsAt = null;
            timer.remainingSeconds = 0;
        }
    } else {
        const remaining = Number(raw.remainingSeconds);
        timer.remainingSeconds = Number.isFinite(remaining)
            ? Math.min(Math.max(Math.round(remaining), 0), TIMER_LIMITS.seconds)
            : timer.durationSeconds;
        if (timer.status === 'running') timer.status = 'paused';
    }

    return timer;
}

function loadTimers() {
    try {
        const raw = localStorage.getItem(TIMERS_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        timers = (Array.isArray(parsed) ? parsed : [])
            .slice(0, TIMER_LIMITS.count)
            .map(sanitizeTimer)
            .filter(Boolean);
    } catch (error) {
        timers = [];
    }
    return timers;
}

function saveTimers() {
    try {
        localStorage.setItem(TIMERS_STORAGE_KEY, JSON.stringify(timers));
    } catch (error) {
        // Out of quota or private mode: the timers still run for this session.
    }
}

// ---------------------------------------------------------------------------
// Timer state
// ---------------------------------------------------------------------------

/** Seconds left, derived from the clock for running timers. */
function timerRemaining(timer) {
    if (timer.status === 'running' && timer.endsAt) {
        return Math.max(0, Math.round((timer.endsAt - Date.now()) / 1000));
    }
    return timer.remainingSeconds;
}

/**
 * Fraction of the ring to draw.
 *
 * This is *remaining*, not elapsed, so the ring winds down like the dial on a
 * mechanical timer rather than filling up like a progress bar - the question a
 * cook is asking is "how much is left", and the answer should be the amount of
 * ink on the dial. A finished timer draws the full ring in red instead of an
 * empty one, so it reads as an alarm rather than as nothing.
 */
function timerProgress(timer) {
    if (timer.status === 'finished') return 1;
    if (!timer.durationSeconds) return 0;
    return Math.min(1, Math.max(0, timerRemaining(timer) / timer.durationSeconds));
}

function findTimer(id) {
    return timers.find(timer => timer.id === Number(id)) || null;
}

/** The timer started from a given recipe step, if one is still around. */
function findTimerBySource(source) {
    return timers.find(timer => timer.source === source) || null;
}

function startTimer(seconds, label, source = null) {
    const duration = Math.min(Math.max(Math.round(Number(seconds) || 0), 1), TIMER_LIMITS.seconds);

    // Restarting the same step replaces its timer rather than stacking a second.
    if (source) {
        const existing = findTimerBySource(source);
        if (existing) timers = timers.filter(timer => timer !== existing);
    }
    if (timers.length >= TIMER_LIMITS.count) {
        timers = timers.filter(timer => timer.status !== 'finished').slice(-(TIMER_LIMITS.count - 1));
    }

    const timer = {
        id: Date.now() + Math.floor(Math.random() * 10000),
        label: String(label || '').trim().slice(0, TIMER_LIMITS.label) || describeDuration(duration),
        durationSeconds: duration,
        remainingSeconds: duration,
        endsAt: Date.now() + duration * 1000,
        status: 'running',
        source
    };

    timers.push(timer);
    saveTimers();
    primeAudio();
    ensureTicking();
    renderTimers();
    return timer;
}

function pauseTimer(id) {
    const timer = findTimer(id);
    if (!timer || timer.status !== 'running') return;
    timer.remainingSeconds = timerRemaining(timer);
    timer.endsAt = null;
    timer.status = 'paused';
    saveTimers();
    renderTimers();
}

function resumeTimer(id) {
    const timer = findTimer(id);
    if (!timer || timer.status === 'running') return;
    const remaining = timer.remainingSeconds > 0 ? timer.remainingSeconds : timer.durationSeconds;
    timer.endsAt = Date.now() + remaining * 1000;
    timer.remainingSeconds = remaining;
    timer.status = 'running';
    saveTimers();
    primeAudio();
    ensureTicking();
    renderTimers();
}

function addTimerTime(id, seconds) {
    const timer = findTimer(id);
    if (!timer) return;
    const extra = Math.round(Number(seconds) || 0);
    const remaining = Math.min(timerRemaining(timer) + extra, TIMER_LIMITS.seconds);

    timer.durationSeconds = Math.min(Math.max(timer.durationSeconds, remaining), TIMER_LIMITS.seconds);
    if (timer.status === 'running') {
        timer.endsAt = Date.now() + remaining * 1000;
    } else {
        timer.remainingSeconds = remaining;
        // Adding time to a finished timer restarts it - the usual "needs
        // another minute" move at the hob.
        if (timer.status === 'finished' && remaining > 0) {
            timer.status = 'running';
            timer.endsAt = Date.now() + remaining * 1000;
            ensureTicking();
        }
    }
    saveTimers();
    renderTimers();
}

function resetTimer(id) {
    const timer = findTimer(id);
    if (!timer) return;
    timer.remainingSeconds = timer.durationSeconds;
    timer.endsAt = null;
    timer.status = 'paused';
    saveTimers();
    renderTimers();
}

function dismissTimer(id) {
    timers = timers.filter(timer => timer.id !== Number(id));
    saveTimers();
    ensureTicking();
    renderTimers();
}

/**
 * Rename a timer in place.
 *
 * Only for timers you started yourself: one begun from a recipe already carries
 * the dish and step it belongs to, and overwriting that would lose the link the
 * label exists to express. Four "1 min" cards, though, are indistinguishable
 * until you can say which is the eggs and which is the toast.
 */
function beginRenameTimer(id) {
    const timer = findTimer(id);
    if (!timer || timer.source) return;

    const label = document.querySelector(`[data-timer-card="${timer.id}"] .timer-label`);
    if (!label || label.tagName === 'INPUT') return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'timer-label timer-label-input';
    input.value = timer.label;
    input.maxLength = TIMER_LIMITS.label;
    input.setAttribute('aria-label', 'Timer name');

    let settled = false;
    const finish = (keep) => {
        if (settled) return;
        settled = true;
        if (keep) {
            timer.label = cleanString(input.value, TIMER_LIMITS.label)
                || describeDuration(timer.durationSeconds);
            saveTimers();
        }
        renderTimers();
    };

    input.addEventListener('keydown', event => {
        if (event.key === 'Enter') { event.preventDefault(); finish(true); }
        if (event.key === 'Escape') { event.preventDefault(); finish(false); }
    });
    input.addEventListener('blur', () => finish(true));

    label.replaceWith(input);
    input.focus();
    input.select();
}

function clearFinishedTimers() {
    timers = timers.filter(timer => timer.status !== 'finished');
    saveTimers();
    renderTimers();
}

// ---------------------------------------------------------------------------
// The chime
// ---------------------------------------------------------------------------

/**
 * Browsers refuse to start audio without a user gesture, so the context is
 * created on the click that starts a timer - long before it needs to ring.
 */
function primeAudio() {
    try {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) return;
        if (!audioContext) audioContext = new AudioCtor();
        if (audioContext.state === 'suspended') audioContext.resume();
    } catch (error) {
        audioContext = null;
    }
}

/** A three-note rise, built from oscillators. No file, nothing to fetch. */
function playChime() {
    if (!audioContext) return;
    try {
        const now = audioContext.currentTime;
        [0, 0.18, 0.36].forEach((offset, index) => {
            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();

            oscillator.type = 'sine';
            oscillator.frequency.value = [660, 880, 1320][index];

            // Shaped rather than square, so it reads as a chime and not a beep.
            gain.gain.setValueAtTime(0, now + offset);
            gain.gain.linearRampToValueAtTime(0.22, now + offset + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.55);

            oscillator.connect(gain);
            gain.connect(audioContext.destination);
            oscillator.start(now + offset);
            oscillator.stop(now + offset + 0.6);
        });
    } catch (error) {
        // Audio is a nicety; the visual alarm carries the message regardless.
    }
}

// ---------------------------------------------------------------------------
// The loop
// ---------------------------------------------------------------------------

function hasRunningTimers() {
    return timers.some(timer => timer.status === 'running');
}

/** Run only while something is counting; stop dead otherwise. */
function ensureTicking() {
    if (hasRunningTimers() && !tickHandle) {
        tickHandle = setInterval(tickTimers, 250);
    } else if (!hasRunningTimers() && tickHandle) {
        clearInterval(tickHandle);
        tickHandle = null;
    }
}

function tickTimers() {
    let finishedAny = false;

    timers.forEach(timer => {
        if (timer.status !== 'running') return;
        if (timerRemaining(timer) > 0) return;

        timer.status = 'finished';
        timer.remainingSeconds = 0;
        timer.endsAt = null;
        finishedAny = true;

        if (typeof showNotification === 'function') {
            showNotification(`Timer finished: ${timer.label}`, 'success');
        }
    });

    if (finishedAny) {
        playChime();
        saveTimers();
        ensureTicking();
        renderTimers();
        return;
    }

    updateTimerDisplays();
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * How much room the figure needs.
 *
 * "5:00" and "99:59:59" are the same element at the same font size, and the
 * long one used to spill over the ring. The stylesheet steps the size down by
 * length rather than trying to guess a single size that suits both.
 */
function readoutLength(text) {
    if (text.length >= 8) return 'longest';
    if (text.length >= 6) return 'long';
    return 'short';
}

function timerTone(timer) {
    if (timer.status === 'finished') return 'is-finished';
    if (timer.status === 'paused') return 'is-paused';
    return timerRemaining(timer) <= 60 ? 'is-ending' : 'is-running';
}

function renderTimerCard(timer) {
    const remaining = timerRemaining(timer);
    const offset = RING_CIRCUMFERENCE * (1 - timerProgress(timer));
    // The clock form, not the wordy one: "of 99 hr 59 min 59 sec" wrapped onto
    // three lines and burst out of the ring. It also lets the eye compare the
    // two figures directly, since they are now in the same notation.
    const status = timer.status === 'finished'
        ? 'Finished'
        : timer.status === 'paused' ? 'Paused' : `of ${formatDuration(timer.durationSeconds)}`;

    return `
        <div class="timer-card ${timerTone(timer)}" data-timer-card="${timer.id}" role="group"
             aria-label="Timer: ${escapeHtml(timer.label)}">
            <div class="timer-dial">
                <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false">
                    <circle class="timer-track" cx="60" cy="60" r="${RING_RADIUS}"></circle>
                    <circle class="timer-progress" cx="60" cy="60" r="${RING_RADIUS}"
                            data-timer-ring="${timer.id}"
                            style="stroke-dasharray: ${RING_CIRCUMFERENCE.toFixed(1)}; stroke-dashoffset: ${offset.toFixed(1)}"></circle>
                </svg>
                <div class="timer-readout">
                    <span class="timer-remaining" data-timer-remaining="${timer.id}"
                          data-length="${readoutLength(formatDuration(remaining))}"
                          role="timer" aria-live="off">${formatDuration(remaining)}</span>
                    <span class="timer-status" data-timer-status="${timer.id}">${escapeHtml(status)}</span>
                </div>
            </div>

            ${timer.source
                ? `<p class="timer-label">${escapeHtml(timer.label)}</p>`
                : `<button type="button" class="timer-label timer-label-edit" data-action="timer-rename" data-id="${timer.id}"
                           aria-label="Rename timer: ${escapeHtml(timer.label)}">
                       ${escapeHtml(timer.label)}
                       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="timer-label-pencil">
                           <path d="M12 20h9"></path>
                           <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path>
                       </svg>
                   </button>`}

            <div class="timer-controls">
                ${timer.status === 'finished' ? `
                    <button type="button" data-action="timer-add" data-id="${timer.id}" data-seconds="60" class="btn-sm bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg">+1 min</button>
                    <button type="button" data-action="timer-reset" data-id="${timer.id}" class="btn-sm bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg">Restart</button>
                    <button type="button" data-action="timer-dismiss" data-id="${timer.id}" class="btn-sm bg-green-600 text-white hover:bg-green-700 rounded-lg">Done</button>
                ` : `
                    ${timer.status === 'running'
                        ? `<button type="button" data-action="timer-pause" data-id="${timer.id}" class="btn-sm bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg">Pause</button>`
                        : `<button type="button" data-action="timer-resume" data-id="${timer.id}" class="btn-sm bg-green-600 text-white hover:bg-green-700 rounded-lg">Resume</button>`}
                    <button type="button" data-action="timer-add" data-id="${timer.id}" data-seconds="60" class="btn-sm bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg">+1 min</button>
                    <button type="button" data-action="timer-dismiss" data-id="${timer.id}" class="btn-sm text-red-600 hover:bg-red-50 rounded-lg" aria-label="Cancel timer ${escapeHtml(timer.label)}">Cancel</button>
                `}
            </div>
        </div>
    `;
}

/** Full redraw of the Timers view. Called on state changes, not on every tick. */
function renderTimers() {
    const list = document.getElementById('timers-list');
    const empty = document.getElementById('timers-empty');

    if (list) {
        // Newest first, but anything ringing goes to the top.
        const ordered = [...timers].sort((a, b) => {
            if ((a.status === 'finished') !== (b.status === 'finished')) {
                return a.status === 'finished' ? -1 : 1;
            }
            return b.id - a.id;
        });

        list.innerHTML = ordered.map(renderTimerCard).join('');
        if (empty) empty.classList.toggle('hidden', timers.length > 0);
    }

    const clearButton = document.getElementById('clear-finished-timers');
    if (clearButton) {
        clearButton.classList.toggle('hidden', !timers.some(timer => timer.status === 'finished'));
    }

    updateTimerDisplays();
}

/**
 * The per-tick work: text and ring offsets only, so nothing else on the page
 * is disturbed.
 */
function updateTimerDisplays() {
    timers.forEach(timer => {
        const remaining = timerRemaining(timer);

        const readout = document.querySelector(`[data-timer-remaining="${timer.id}"]`);
        if (readout) {
            const text = formatDuration(remaining);
            readout.textContent = text;
            readout.dataset.length = readoutLength(text);
        }

        const ring = document.querySelector(`[data-timer-ring="${timer.id}"]`);
        if (ring) {
            ring.style.strokeDashoffset = (RING_CIRCUMFERENCE * (1 - timerProgress(timer))).toFixed(1);
        }

        const card = document.querySelector(`[data-timer-card="${timer.id}"]`);
        if (card) {
            card.classList.remove('is-running', 'is-paused', 'is-ending', 'is-finished');
            card.classList.add(timerTone(timer));
        }
    });

    updateStepTimerDisplays();
    updateTimerBadge();
}

/** The count on the nav tab, so a timer is visible from any view. */
function updateTimerBadge() {
    const badge = document.getElementById('timer-badge');
    if (!badge) return;

    const running = timers.filter(timer => timer.status === 'running').length;
    const finished = timers.filter(timer => timer.status === 'finished').length;
    const total = running + finished;

    badge.textContent = total ? String(total) : '';
    badge.classList.toggle('hidden', total === 0);
    badge.classList.toggle('is-ringing', finished > 0);
    badge.setAttribute('aria-label', finished
        ? `${finished} timer${finished === 1 ? '' : 's'} finished`
        : `${running} timer${running === 1 ? '' : 's'} running`);
}

const STEP_TIMER_ICON = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="step-timer-icon">
        <circle cx="12" cy="13" r="8"></circle>
        <path d="M12 9v4l2.5 2.5"></path>
        <path d="M9 2h6"></path>
    </svg>`;

/**
 * The controls beside a recipe step.
 *
 * Idle is a single button that starts the timer. Once it is counting, the chip
 * becomes a plain readout - not a button - and pause, reset and stop appear
 * beside it. Previously the running chip was still the start button, so tapping
 * it silently restarted the timer, which is the last thing you want mid-recipe.
 */
function renderStepTimerGroup(host, timer) {
    const idle = host.dataset.timerIdle || '';
    const seconds = host.dataset.timerSeconds || '0';
    const label = host.dataset.timerLabel || '';
    const step = host.dataset.timerStep || '';

    // `data-step-timer-readout` marks the one element the tick loop writes to,
    // and `.step-timer` is the chip - exactly one per group either way, so
    // neither selector is ever ambiguous.
    const startControl = (text, className) => `
        <button type="button" class="${className}"
                data-action="timer-from-step"
                data-seconds="${escapeHtml(seconds)}"
                data-label="${escapeHtml(label)}"
                data-source="${escapeHtml(host.dataset.timerSource)}"
                aria-label="Start a ${escapeHtml(idle)} timer for step ${escapeHtml(step)}">
            ${className === 'step-timer' ? STEP_TIMER_ICON : ''}${escapeHtml(text)}
        </button>`;

    if (!timer) return startControl(idle, 'step-timer');

    const action = (name, text) => `
        <button type="button" class="step-timer-action" data-action="timer-${name}" data-id="${timer.id}">
            ${escapeHtml(text)}
        </button>`;

    if (timer.status === 'finished') {
        return `
            <span class="step-timer is-finished" role="status">
                ${STEP_TIMER_ICON}<span data-step-timer-readout>Time!</span>
            </span>
            ${startControl('Start again', 'step-timer-action step-timer-restart')}
            ${action('dismiss', 'Dismiss')}
        `;
    }

    const running = timer.status === 'running';
    return `
        <span class="step-timer ${running ? 'is-active' : 'is-held'}" role="timer">
            ${STEP_TIMER_ICON}<span data-step-timer-readout>${escapeHtml(formatDuration(timerRemaining(timer)))}</span>
        </span>
        ${running ? action('pause', 'Pause') : action('resume', 'Resume')}
        ${action('reset', 'Reset')}
        ${action('dismiss', 'Stop')}
    `;
}

/**
 * Live countdown inside an open recipe, next to the step it belongs to.
 *
 * Rebuilds a group only when its state actually changes; the rest of the time
 * it just writes the new figure, so the buttons never flicker under a finger
 * that is about to press one.
 */
function updateStepTimerDisplays() {
    document.querySelectorAll('.step-timer-group').forEach(host => {
        const timer = findTimerBySource(host.dataset.timerSource);
        const state = timer ? `${timer.status}:${timer.id}` : 'idle';

        if (host.dataset.timerState !== state) {
            host.dataset.timerState = state;
            host.innerHTML = renderStepTimerGroup(host, timer);
            return;
        }

        if (!timer || timer.status === 'finished') return;

        const readout = host.querySelector('[data-step-timer-readout]');
        if (readout) readout.textContent = formatDuration(timerRemaining(timer));
    });
}

function renderTimerPresets() {
    const host = document.getElementById('timer-presets');
    if (!host || host.childElementCount) return;

    host.innerHTML = TIMER_PRESETS.map(preset => `
        <button type="button" class="timer-preset" data-action="timer-preset" data-seconds="${preset.seconds}">
            ${escapeHtml(preset.label)}
        </button>
    `).join('');
}

/** Read the custom-duration form and start what it describes. */
function startCustomTimer() {
    const hoursInput = document.getElementById('timer-hours');
    const minutesInput = document.getElementById('timer-minutes');
    const secondsInput = document.getElementById('timer-seconds');
    const labelInput = document.getElementById('timer-label');

    // Clamped again here even though the fields clamp on change: a value can
    // reach this function without ever firing one (autofill, paste-and-submit).
    const hours = Math.max(0, Math.min(Number(hoursInput?.value) || 0, TIMER_LIMITS.hours));
    const minutes = Math.max(0, Math.min(Number(minutesInput?.value) || 0, 59));
    const seconds = Math.max(0, Math.min(Number(secondsInput?.value) || 0, 59));
    const total = Math.min(hours * 3600 + minutes * 60 + seconds, TIMER_LIMITS.seconds);

    if (total <= 0) {
        if (typeof showNotification === 'function') {
            showNotification('Set a duration first', 'error');
        }
        (hoursInput || minutesInput)?.focus();
        return;
    }

    startTimer(total, (labelInput?.value || '').trim() || describeDuration(total));

    if (hoursInput) hoursInput.value = '';
    if (minutesInput) minutesInput.value = '';
    if (secondsInput) secondsInput.value = '';
    if (labelInput) labelInput.value = '';
}

function updateTimersView() {
    renderTimerPresets();
    renderTimers();
}

/** Called once at startup, after the DOM is ready. */
function initializeTimers() {
    loadTimers();
    ensureTicking();
    renderTimers();
}
