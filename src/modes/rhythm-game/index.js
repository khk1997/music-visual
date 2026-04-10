const LANE_KEYS = ['d', 'f', 'j', 'k'];
const LANE_MIDIS = [60, 64, 67, 72];
const LANE_VISUAL_X = [-1.8, -0.62, 0.62, 1.8];
const JUDGE_WINDOWS = {
    perfect: 0.04,
    good: 0.09,
    miss: 0.15
};
const TRAVEL_TIME = 1.8;
const LEAD_IN = 1.6;
const HOLD_VISUAL_GAP_PCT = 5;
const NOTE_VISUAL_GAP_PCT = 4;
const TAP_VISUAL_HEIGHT_PCT = 4;
const JUDGEMENT_VISIBLE_MS = 680;
const JUDGEMENT_PERFECT_REPLAY_GAP_MS = 240;
const JUDGEMENT_OTHER_REPLAY_GAP_MS = 120;
const RHYTHM_TRACK_URL = new URL('../../../music/1-1.mp3', import.meta.url).href;
const RHYTHM_TRACK_OFFSET_SECONDS = -0.87;
const RHYTHM_CHART_INTRO_SKIP_BEATS = 8;
let rhythmTrackDurationSeconds = 0;
let rhythmAudibleWindow = { start: 0, end: 0 };

function createRhythmChart(trackDurationSeconds = 0) {
    const bpm = 150;
    const secondsPerBeat = 60 / bpm;
    const safeDuration = Number.isFinite(trackDurationSeconds) && trackDurationSeconds > 0
        ? trackDurationSeconds
        : 48;
    const totalBeats = Math.max(64, Math.ceil(safeDuration / secondsPerBeat));
    const sectionLength = 8;
    const chartStartBeat = RHYTHM_CHART_INTRO_SKIP_BEATS;
    const sectionCount = Math.max(0, Math.ceil((totalBeats - chartStartBeat) / sectionLength));
    const notes = [];
    const templates = [
        [
            { beat: 0, lane: 0 },
            { beat: 2, lane: 1 },
            { beat: 4, lane: 0 },
            { beat: 6, lane: 1 },
            { beat: 7, lane: 3 }
        ],
        [
            { beat: 0, lane: 1 },
            { beat: 1, lane: 3 },
            { beat: 2, lane: 2 },
            { beat: 4, lane: 0, durationBeats: 1.25 },
            { beat: 7, lane: 2 }
        ],
        [
            { beat: 0, lane: 3 },
            { beat: 1, lane: 1 },
            { beat: 2.75, lane: 2 },
            { beat: 4, lane: 1 },
            { beat: 6, lane: 2 },
            { beat: 7, lane: 1 }
        ],
        [
            { beat: 0, lane: 0 },
            { beat: 1.5, lane: 1 },
            { beat: 3, lane: 0 },
            { beat: 4, lane: 2, durationBeats: 1.5 },
            { beat: 7, lane: 3 }
        ],
        [
            { beat: 0, lane: 2 },
            { beat: 1, lane: 3 },
            { beat: 2.5, lane: 0 },
            { beat: 4, lane: 1 },
            { beat: 6, lane: 0 },
            { beat: 7, lane: 2 }
        ],
        [
            { beat: 0, lane: 1 },
            { beat: 1.5, lane: 2 },
            { beat: 3, lane: 1 },
            { beat: 4.5, lane: 2 },
            { beat: 6, lane: 1, durationBeats: 1.25 },
            { beat: 7, lane: 3 }
        ],
        [
            { beat: 0, lane: 3 },
            { beat: 1, lane: 2 },
            { beat: 3, lane: 3 },
            { beat: 4, lane: 2 },
            { beat: 6, lane: 3 },
            { beat: 7, lane: 2 }
        ],
        [
            { beat: 0, lane: 0 },
            { beat: 1.5, lane: 2 },
            { beat: 3, lane: 1 },
            { beat: 4, lane: 0, durationBeats: 1.5 },
            { beat: 7, lane: 1 }
        ],
        [
            { beat: 0, lane: 1 },
            { beat: 1, lane: 3 },
            { beat: 2, lane: 1 },
            { beat: 4, lane: 3 },
            { beat: 6, lane: 1 },
            { beat: 7, lane: 2 }
        ]
    ];

    const laneShiftTable = [0, 1, 3, 2, 0, 2, 1, 3];

    for (let sectionIndex = 0; sectionIndex < sectionCount; sectionIndex += 1) {
        const startBeat = chartStartBeat + sectionIndex * sectionLength;
        const template = templates[sectionIndex % templates.length];
        const laneShift = laneShiftTable[sectionIndex % laneShiftTable.length];
        const mirror = sectionIndex % 3 === 2;

        for (const entry of template) {
            const beat = startBeat + entry.beat;
            if (beat >= totalBeats) continue;

            let lane = entry.lane;
            if (mirror) {
                lane = 3 - lane;
            }
            lane = (lane + laneShift) % 4;

            notes.push({
                beat,
                lane,
                durationBeats: entry.durationBeats ?? 0,
                type: entry.durationBeats ? 'hold' : 'tap'
            });
        }

        if (sectionIndex % 6 === 5) {
            notes.push({
                beat: startBeat + 4,
                lane: (sectionIndex + 3) % 4,
                durationBeats: 1.5,
                type: 'hold'
            });
        }
    }

    notes.sort((a, b) => a.beat - b.beat || a.lane - b.lane);
    notes.splice(-6, 6);

    return {
        bpm,
        offsetSeconds: RHYTHM_TRACK_OFFSET_SECONDS,
        title: '1-1 Adventure Battle',
        notes
    };
}

function getRhythmPlayerAudioBuffer(player) {
    const buffer = player?.buffer;
    if (!buffer) return null;

    if (typeof buffer.get === 'function') {
        try {
            const resolved = buffer.get();
            if (resolved && typeof resolved.getChannelData === 'function') {
                return resolved;
            }
        } catch {
            // Fall through to other access patterns.
        }
    }

    if (buffer._buffer && typeof buffer._buffer.getChannelData === 'function') {
        return buffer._buffer;
    }

    if (buffer.buffer && typeof buffer.buffer.getChannelData === 'function') {
        return buffer.buffer;
    }

    return null;
}

function detectRhythmAudibleWindow(audioBuffer, fallbackDurationSeconds = 0) {
    const duration = Number.isFinite(audioBuffer?.duration) && audioBuffer.duration > 0
        ? audioBuffer.duration
        : (Number.isFinite(fallbackDurationSeconds) && fallbackDurationSeconds > 0 ? fallbackDurationSeconds : 0);

    if (!audioBuffer || typeof audioBuffer.getChannelData !== 'function' || duration <= 0) {
        return { start: 0, end: duration };
    }

    const sampleRate = audioBuffer.sampleRate || 44100;
    const channelCount = audioBuffer.numberOfChannels || 1;
    const blockSize = 2048;
    let firstActiveSample = null;
    let lastActiveSample = null;

    for (let blockStart = 0; blockStart < audioBuffer.length; blockStart += blockSize) {
        const blockEnd = Math.min(audioBuffer.length, blockStart + blockSize);
        let blockPeak = 0;

        for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
            const channelData = audioBuffer.getChannelData(channelIndex);
            for (let sampleIndex = blockStart; sampleIndex < blockEnd; sampleIndex += 1) {
                const sample = Math.abs(channelData[sampleIndex] ?? 0);
                if (sample > blockPeak) {
                    blockPeak = sample;
                    if (blockPeak >= 0.008) {
                        break;
                    }
                }
            }
            if (blockPeak >= 0.008) break;
        }

        if (blockPeak >= 0.008) {
            if (firstActiveSample === null) {
                firstActiveSample = blockStart;
            }
            lastActiveSample = blockEnd;
        }
    }

    if (firstActiveSample === null || lastActiveSample === null) {
        return { start: 0, end: duration };
    }

    const start = Math.max(0, (firstActiveSample / sampleRate) - 0.18);
    const end = Math.min(duration, (lastActiveSample / sampleRate) + 0.18);

    if (end <= start) {
        return { start: 0, end: duration };
    }

    return { start, end };
}

function shouldKeepRhythmNote(noteTime, noteDuration, noteType) {
    const startSilence = Math.max(0, rhythmAudibleWindow.start ?? 0);
    const endSilence = Math.max(0, (rhythmTrackDurationSeconds || 0) - (rhythmAudibleWindow.end ?? rhythmTrackDurationSeconds));
    const hasStartSilence = startSilence > 0.18;
    const hasEndSilence = endSilence > 0.18;

    if (hasStartSilence && (noteTime - TRAVEL_TIME) < startSilence) {
        return false;
    }

    if (hasEndSilence) {
        const noteVisibleTail = noteType === 'hold'
            ? noteTime + noteDuration + TRAVEL_TIME
            : noteTime + TRAVEL_TIME;
        if (noteVisibleTail > rhythmAudibleWindow.end) {
            return false;
        }
    }

    return true;
}

function getJudgeBucket(deltaSeconds) {
    const absDelta = Math.abs(deltaSeconds);
    if (absDelta <= JUDGE_WINDOWS.perfect) {
        return 'perfect';
    }
    if (absDelta <= JUDGE_WINDOWS.good) {
        return 'good';
    }
    return 'miss';
}

function getTapReward(bucket) {
    if (bucket === 'perfect') {
        return { score: 1000, weight: 1, label: 'Perfect' };
    }
    if (bucket === 'good') {
        return { score: 650, weight: 0.72, label: 'Good' };
    }
    return { score: 0, weight: 0, label: 'Miss' };
}

function getHoldReward(bucket) {
    if (bucket === 'perfect') {
        return { score: 1400, weight: 1, label: 'Perfect' };
    }
    if (bucket === 'good') {
        return { score: 980, weight: 0.82, label: 'Good' };
    }
    return { score: 0, weight: 0, label: 'Miss' };
}

function getResultGrade(accuracy) {
    const thresholds = [
        { min: 98, label: 'S+' },
        { min: 95, label: 'S' },
        { min: 92, label: 'A+' },
        { min: 88, label: 'A' },
        { min: 84, label: 'B+' },
        { min: 80, label: 'B' },
        { min: 76, label: 'C+' },
        { min: 72, label: 'C' },
        { min: 68, label: 'D+' },
        { min: 0, label: 'D' }
    ];

    const safeAccuracy = Number.isFinite(accuracy) ? Math.max(0, Math.min(100, accuracy)) : 0;
    return thresholds.find((entry) => safeAccuracy >= entry.min)?.label ?? 'D';
}

export function createRhythmGameModule({
    container,
    initAudio,
    nowSeconds,
    createInstrumentInstance,
    disposeLofiChain,
    playMidiWithInstrument,
    playVisualFeedback
}) {
    const panel = container;
    const startButton = document.getElementById('rg-start-button');
    const scoreValue = document.getElementById('rg-score-value');
    const comboValue = document.getElementById('rg-combo-value');
    const accuracyValue = document.getElementById('rg-result-accuracy');
    const perfectValue = document.getElementById('rg-perfect-count');
    const goodValue = document.getElementById('rg-good-count');
    const missValue = document.getElementById('rg-miss-count');
    const progressValue = document.getElementById('rg-progress-value');
    const progressFill = document.getElementById('rhythm-progress-fill');
    const progressText = document.getElementById('rhythm-progress-text');
    const statusCopy = document.getElementById('rg-status-copy');
    const judgementValue = document.getElementById('rg-judgement-value');
    const sessionHint = document.getElementById('rg-session-hint');
    const results = document.getElementById('rg-results');
    const resultGrade = document.getElementById('rg-result-grade');
    const resultBias = document.getElementById('rg-result-bias');
    const resultCombo = document.getElementById('rg-result-combo');
    const finishModal = document.getElementById('rg-finish-modal');
    const finishBackdrop = document.getElementById('rg-finish-backdrop');
    const finishCopy = document.getElementById('rg-finish-copy');
    const finishScoreValue = document.getElementById('rg-finish-score-value');
    const finishResultValue = document.getElementById('rg-finish-result-value');
    const finishComboValue = document.getElementById('rg-finish-combo-value');
    const finishAccuracyValue = document.getElementById('rg-finish-accuracy-value');
    const finishPlayerIdInput = document.getElementById('rg-finish-player-id-input');
    const finishUploadButton = document.getElementById('rg-finish-upload-button');
    const finishRetryButton = document.getElementById('rg-finish-retry-button');
    const finishNote = document.getElementById('rg-finish-note');
    const leaderboardList = document.getElementById('rg-leaderboard-list');
    const playerIdInput = document.getElementById('rg-player-id-input');
    const laneElements = Array.from(container.querySelectorAll('.rhythm-game-lane'));
    const laneRailElements = laneElements.map((lane) => lane.querySelector('.rhythm-game-lane-rail'));

    let chart = createRhythmChart();
    let chartSecondsPerBeat = 60 / chart.bpm;
    let chartDuration = chart.notes.reduce((maxTime, note) => Math.max(maxTime, ((note.beat ?? 0) + (note.durationBeats ?? 0)) * chartSecondsPerBeat), 0);
    let maxPossibleScore = chart.notes.reduce((total, note) => {
        const reward = note.type === 'hold' ? getHoldReward('perfect') : getTapReward('perfect');
        return total + reward.score;
    }, 0);

    let rhythmInstrument = null;
    let rhythmLofiVibrato = null;
    let rhythmLofiFilter = null;
    let rhythmTrackPlayer = null;
    let rhythmTrackStartTime = null;
    let isActive = false;
    let isRunning = false;
    let runStartAt = 0;
    let animationFrameId = null;
    let autoStartTimerId = null;
    let laneFlashTimers = [];
    let notes = [];
    let score = 0;
    let combo = 0;
    let maxCombo = 0;
    let judgedCount = 0;
    let totalAccuracyWeight = 0;
    let timingOffsets = [];
    let perfectCount = 0;
    let goodCount = 0;
    let missCount = 0;
    const activeHoldNotes = new Map();
    const holdSprayTimers = new Map();
    let judgementHideTimerId = null;
    let judgementReplayTimerId = null;
    let judgementLastShownAt = 0;
    let pendingFinishResult = null;
    let isFinishModalOpen = false;
    const LEADERBOARD_LIMIT = 10;
    const LEADERBOARD_STORAGE_KEY = 'visual-music-game.rhythm.leaderboard.v3';
    const LEGACY_LEADERBOARD_STORAGE_KEY = 'visual-music-game.rhythm.leaderboard.v1';
    const PLAYER_ID_STORAGE_KEY = 'visual-music-game.rhythm.player-id.v1';
    let playerId = '';
    let leaderboardEntries = [];

    function readStoredJson(storageKey, fallbackValue) {
        try {
            const raw = window.localStorage.getItem(storageKey);
            if (!raw) return fallbackValue;
            return JSON.parse(raw);
        } catch {
            return fallbackValue;
        }
    }

    function writeStoredJson(storageKey, value) {
        try {
            window.localStorage.setItem(storageKey, JSON.stringify(value));
        } catch {
            // Local storage can be unavailable in private mode; the leaderboard still works in-memory.
        }
    }

    function clearLegacyLeaderboardStorage() {
        try {
            window.localStorage.removeItem(LEGACY_LEADERBOARD_STORAGE_KEY);
        } catch {
            // Ignore storage cleanup failures; the in-memory leaderboard still resets.
        }
    }

    function normalizePlayerId(value) {
        if (typeof value !== 'string') return '';
        return value.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 16);
    }

    function syncPlayerIdFields(nextId) {
        if (playerIdInput && playerIdInput.value !== nextId) {
            playerIdInput.value = nextId;
        }
        if (finishPlayerIdInput && finishPlayerIdInput.value !== nextId) {
            finishPlayerIdInput.value = nextId;
        }
    }

    function loadPlayerId() {
        const storedId = readStoredJson(PLAYER_ID_STORAGE_KEY, null);
        const nextId = normalizePlayerId(typeof storedId === 'string' ? storedId : '');
        writeStoredJson(PLAYER_ID_STORAGE_KEY, nextId);
        syncPlayerIdFields(nextId);
        return nextId;
    }

    function savePlayerId(value) {
        const nextId = normalizePlayerId(value);
        playerId = nextId;
        writeStoredJson(PLAYER_ID_STORAGE_KEY, playerId);
        syncPlayerIdFields(playerId);
        return playerId;
    }

    function normalizeLeaderboardEntry(entry) {
        return {
            playerId: entry && typeof entry.playerId === 'string' && entry.playerId.trim() ? entry.playerId.trim() : 'Guest',
            score: entry && Number.isFinite(entry.score) ? entry.score : 0,
            result: entry && typeof entry.result === 'string' && entry.result.trim() ? entry.result.trim() : '-',
            createdAt: entry && Number.isFinite(entry.createdAt) ? entry.createdAt : Date.now()
        };
    }

    function compareLeaderboardEntries(a, b) {
        return b.score - a.score || b.createdAt - a.createdAt;
    }

    function loadLeaderboardEntries() {
        const storedEntries = readStoredJson(LEADERBOARD_STORAGE_KEY, []);
        if (!Array.isArray(storedEntries)) {
            return [];
        }

        return storedEntries
            .map(normalizeLeaderboardEntry)
            .sort(compareLeaderboardEntries)
            .slice(0, LEADERBOARD_LIMIT);
    }

    function configureChart(trackDurationSeconds = 0) {
        chart = createRhythmChart(trackDurationSeconds);
        chartSecondsPerBeat = 60 / chart.bpm;
        chartDuration = chart.notes.reduce((maxTime, note) => Math.max(maxTime, ((note.beat ?? 0) + (note.durationBeats ?? 0)) * chartSecondsPerBeat), 0);
        maxPossibleScore = chart.notes.reduce((total, note) => {
            const reward = note.type === 'hold' ? getHoldReward('perfect') : getTapReward('perfect');
            return total + reward.score;
        }, 0);
    }

    function getLeaderboardScoreTone(scoreValue) {
        const ratio = maxPossibleScore <= 0 ? 0 : Math.max(0, Math.min(1, scoreValue / maxPossibleScore));
        const tone = getScoreTone(ratio);
        return {
            color: 'hsl(' + tone.hue.toFixed(1) + ' ' + tone.saturation.toFixed(1) + '% ' + tone.lightness.toFixed(1) + '%)',
            glow: 'hsla(' + tone.hue.toFixed(1) + ' ' + tone.saturation.toFixed(1) + '% 68% / ' + tone.glow.toFixed(3) + ')'
        };
    }

    function getLeaderboardResultTone(resultValue, scoreValue) {
        const ratio = maxPossibleScore <= 0 ? 0 : Math.max(0, Math.min(1, scoreValue / maxPossibleScore));
        const tone = getResultTone(resultValue, ratio * 100);
        return {
            color: 'hsl(' + tone.hue.toFixed(1) + ' ' + tone.saturation.toFixed(1) + '% ' + tone.lightness.toFixed(1) + '%)',
            glow: 'hsla(' + tone.hue.toFixed(1) + ' ' + tone.saturation.toFixed(1) + '% 68% / ' + tone.glow.toFixed(3) + ')'
        };
    }

    function renderLeaderboardEntries() {

        if (!leaderboardList) return;

        if (leaderboardEntries.length === 0) {
            leaderboardList.replaceChildren();
            const emptyRow = document.createElement('div');
            emptyRow.className = 'rhythm-game-leaderboard-row is-empty';

            const emptyRank = document.createElement('span');
            emptyRank.className = 'rhythm-game-leaderboard-rank';
            emptyRank.textContent = '-';

            const emptyId = document.createElement('span');
            emptyId.textContent = 'No scores yet';

            const emptyScore = document.createElement('span');
            emptyScore.className = 'rhythm-game-leaderboard-score';
            emptyScore.textContent = '-';

            const emptySpacer = document.createElement('span');
            emptySpacer.className = 'rhythm-game-leaderboard-spacer';
            emptySpacer.setAttribute('aria-hidden', 'true');

            const emptyResult = document.createElement('span');
            emptyResult.className = 'rhythm-game-leaderboard-result';
            emptyResult.textContent = '-';

            emptyRow.append(emptyRank, emptyId, emptyScore, emptySpacer, emptyResult);
            leaderboardList.append(emptyRow);
            return;
        }

        const rows = leaderboardEntries.map((entry, index) => {
            const rankNumber = index + 1;
            const row = document.createElement('div');
            row.className = 'rhythm-game-leaderboard-row';
            if (rankNumber <= 3) {
                row.classList.add(`is-rank-${rankNumber}`);
            }

            const rankCell = document.createElement('span');
            rankCell.className = 'rhythm-game-leaderboard-rank';
            rankCell.textContent = `#${rankNumber}`;

            const idCell = document.createElement('span');
            idCell.className = 'rhythm-game-leaderboard-id';
            idCell.textContent = entry.playerId;
            idCell.title = entry.playerId;

            const scoreCell = document.createElement('span');
            scoreCell.className = 'rhythm-game-leaderboard-score';
            scoreCell.textContent = entry.score.toLocaleString();

            const resultCell = document.createElement('span');
            resultCell.className = 'rhythm-game-leaderboard-result';
            resultCell.textContent = entry.result;

            const scoreTone = getLeaderboardScoreTone(entry.score);
            const resultTone = getLeaderboardResultTone(entry.result, entry.score);
            row.style.setProperty('--leaderboard-score-color', scoreTone.color);
            row.style.setProperty('--leaderboard-score-glow', scoreTone.glow);
            row.style.setProperty('--leaderboard-result-color', resultTone.color);
            row.style.setProperty('--leaderboard-result-glow', resultTone.glow);

            row.append(rankCell, idCell, scoreCell, resultCell);
            return row;
        });

        leaderboardList.replaceChildren(...rows);
    }

    function recordLeaderboardEntry(scoreValue, resultValue) {
        const nextEntry = normalizeLeaderboardEntry({
            playerId,
            score: scoreValue,
            result: resultValue,
            createdAt: Date.now()
        });

        leaderboardEntries = [nextEntry, ...leaderboardEntries]
            .sort(compareLeaderboardEntries)
            .slice(0, LEADERBOARD_LIMIT);

        writeStoredJson(LEADERBOARD_STORAGE_KEY, leaderboardEntries);
        renderLeaderboardEntries();
    }

    function focusPlayerIdInput(selectAll = false) {
        if (!playerIdInput) return;

        playerIdInput.focus();
        if (selectAll && typeof playerIdInput.select === 'function') {
            playerIdInput.select();
        }
    }

    function isTypingInTextField(event) {
        const target = event?.target;
        if (!target || !(target instanceof HTMLElement)) {
            return false;
        }

        if (target === playerIdInput || target === finishPlayerIdInput) {
            return true;
        }

        if (target.isContentEditable) {
            return true;
        }

        const tagName = target.tagName;
        return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
    }

    function bindPlayerIdField(input) {
        if (!input) return;

        input.addEventListener('input', () => {
            savePlayerId(input.value);

        });

        input.addEventListener('blur', () => {
            input.value = savePlayerId(input.value);

        });

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                input.value = savePlayerId(input.value);

                input.blur();
            }
        });
    }

    bindPlayerIdField(playerIdInput);
    bindPlayerIdField(finishPlayerIdInput);

    clearLegacyLeaderboardStorage();
    playerId = loadPlayerId();
    leaderboardEntries = loadLeaderboardEntries();
    renderLeaderboardEntries();

    function buildNotes() {
        notes = chart.notes.map((note, index) => {
            const time = (chart.offsetSeconds ?? 0) + ((note.beat ?? 0) * chartSecondsPerBeat);
            const duration = (note.durationBeats ?? 0) * chartSecondsPerBeat;

            if (!shouldKeepRhythmNote(time, duration, note.type)) {
                return null;
            }

            return {
                ...note,
                id: index,
                time,
                duration,
                endTime: time + duration,
                state: 'pending',
                element: null,
                keyHeld: false,
                holdBucket: null,
                holdStartedAt: null,
                startMissed: false,
                releaseReason: null,
            };
        }).filter(Boolean);

        chartDuration = notes.reduce((maxTime, note) => Math.max(maxTime, note.time + note.duration), 0);
        maxPossibleScore = notes.reduce((total, note) => {
            const reward = note.type === 'hold' ? getHoldReward('perfect') : getTapReward('perfect');
            return total + reward.score;
        }, 0);

        activeHoldNotes.clear();

        laneRailElements.forEach((rail) => {
            if (rail) {
                rail.innerHTML = '';
            }
        });

        for (const note of notes) {
            const el = document.createElement('div');
            el.className = note.type === 'hold' ? 'rhythm-game-note hold' : 'rhythm-game-note';
            el.dataset.noteId = String(note.id);

            if (note.type === 'hold') {
                const holdPercent = Math.max(14, (note.duration / TRAVEL_TIME) * 100 - HOLD_VISUAL_GAP_PCT);
                el.style.height = `${holdPercent}%`;
            }

            note.element = el;
            laneRailElements[note.lane]?.appendChild(el);
        }
    }
    function getJudgementVariant(label) {
        const normalized = typeof label === 'string' ? label.toLowerCase() : '';

        if (normalized.includes('perfect')) return 'is-perfect';
        if (normalized.includes('good')) return 'is-good';
        if (normalized.includes('miss')) return 'is-miss';
        if (normalized.includes('uploaded')) return 'is-success';
        if (normalized.includes('error')) return 'is-error';
        if (normalized.includes('too soon') || normalized.includes('empty')) return 'is-warning';
        if (normalized.includes('ready') || normalized.includes('lead in') || normalized.includes('idle') || normalized.includes('complete')) {
            return 'is-neutral';
        }

        return 'is-neutral';
    }

    function setJudgement(label) {
        if (!judgementValue) return;

        judgementValue.textContent = label;

        if (judgementHideTimerId !== null) {
            window.clearTimeout(judgementHideTimerId);
            judgementHideTimerId = null;
        }

        if (judgementReplayTimerId !== null) {
            window.clearTimeout(judgementReplayTimerId);
            judgementReplayTimerId = null;
        }

        const variant = getJudgementVariant(label);
        const now = performance.now();
        const elapsed = now - judgementLastShownAt;
        const replayGap = variant === 'is-perfect'
            ? JUDGEMENT_PERFECT_REPLAY_GAP_MS
            : JUDGEMENT_OTHER_REPLAY_GAP_MS;
        const replayDelay = Math.max(0, replayGap - elapsed);

        const showJudgement = () => {
            judgementValue.classList.remove(
                'is-perfect',
                'is-good',
                'is-miss',
                'is-warning',
                'is-success',
                'is-neutral',
                'is-ready',
                'is-error',
                'is-visible'
            );
            judgementValue.classList.add(variant);

            // Restart the transition so repeated taps still pop even when the same label repeats.
            void judgementValue.offsetWidth;
            judgementValue.classList.add('is-visible');
            judgementLastShownAt = performance.now();

            judgementHideTimerId = window.setTimeout(() => {
                judgementValue.classList.remove('is-visible');
                judgementHideTimerId = null;
            }, JUDGEMENT_VISIBLE_MS);
        };

        if (replayDelay > 0) {
            judgementValue.classList.remove('is-visible');
            judgementReplayTimerId = window.setTimeout(() => {
                judgementReplayTimerId = null;
                showJudgement();
            }, replayDelay);
            return;
        }

        showJudgement();
    }
    function getScoreTone(ratio) {
        const bands = [
            { min: 0.90, hue: 46, saturation: 98, lightness: 72, glow: 0.42, border: 0.28 },
            { min: 0.75, hue: 24, saturation: 96, lightness: 69, glow: 0.34, border: 0.24 },
            { min: 0.58, hue: 78, saturation: 92, lightness: 66, glow: 0.28, border: 0.20 },
            { min: 0.40, hue: 160, saturation: 86, lightness: 63, glow: 0.22, border: 0.17 },
            { min: 0.20, hue: 198, saturation: 80, lightness: 64, glow: 0.18, border: 0.14 },
            { min: 0.00, hue: 220, saturation: 56, lightness: 66, glow: 0.12, border: 0.12 }
        ];

        return bands.find((band) => ratio >= band.min) ?? bands[bands.length - 1];
    }

    function getResultTone(grade, accuracy = 0) {
        const palette = {
            'S+': { hue: 46, saturation: 100, lightness: 75, glow: 0.42, border: 0.28 },
            S: { hue: 28, saturation: 98, lightness: 72, glow: 0.38, border: 0.26 },
            'A+': { hue: 56, saturation: 96, lightness: 71, glow: 0.34, border: 0.24 },
            A: { hue: 86, saturation: 92, lightness: 68, glow: 0.30, border: 0.22 },
            'B+': { hue: 148, saturation: 86, lightness: 66, glow: 0.26, border: 0.20 },
            B: { hue: 178, saturation: 82, lightness: 66, glow: 0.23, border: 0.18 },
            'C+': { hue: 210, saturation: 82, lightness: 65, glow: 0.20, border: 0.16 },
            C: { hue: 232, saturation: 84, lightness: 65, glow: 0.18, border: 0.15 },
            'D+': { hue: 320, saturation: 86, lightness: 66, glow: 0.16, border: 0.14 },
            D: { hue: 344, saturation: 80, lightness: 66, glow: 0.14, border: 0.12 }
        };

        const baseTone = palette[grade] ?? palette.D;
        const accuracyValue = Number.isFinite(accuracy) ? Math.max(0, Math.min(100, accuracy)) : 0;
        const boost = accuracyValue / 100;

        return {
            hue: baseTone.hue,
            saturation: Math.min(100, baseTone.saturation + (boost * 6)),
            lightness: Math.min(78, baseTone.lightness + (boost * 4)),
            glow: baseTone.glow + (boost * 0.18),
            border: baseTone.border + (boost * 0.12)
        };
    }

    function updateScoreAppearance() {
        const scoreStat = scoreValue?.closest('.rhythm-game-stat');
        if (!scoreStat) return;

        if (score <= 0 || maxPossibleScore <= 0) {
            scoreStat.style.setProperty('--score-value-color', '#ffffff');
            scoreStat.style.setProperty('--score-text-glow', 'rgba(255,255,255,0.1)');
            scoreStat.style.setProperty('--score-glow', 'rgba(255,255,255,0.08)');
            scoreStat.style.setProperty('--score-border', 'rgba(255,255,255,0.07)');
            return;
        }

        const ratio = Math.max(0, Math.min(1, score / maxPossibleScore));
        const tone = getScoreTone(ratio);
        const textColor = `hsl(${tone.hue.toFixed(1)} ${tone.saturation.toFixed(1)}% ${tone.lightness.toFixed(1)}%)`;
        const glowColor = `hsla(${tone.hue.toFixed(1)} ${tone.saturation.toFixed(1)}% 68% / ${tone.glow.toFixed(3)})`;
        const borderColor = `hsla(${tone.hue.toFixed(1)} ${tone.saturation.toFixed(1)}% 58% / ${tone.border.toFixed(3)})`;

        scoreStat.style.setProperty('--score-value-color', textColor);
        scoreStat.style.setProperty('--score-text-glow', glowColor);
        scoreStat.style.setProperty('--score-glow', glowColor);
        scoreStat.style.setProperty('--score-border', borderColor);
    }

    function updateComboAppearance() {

        const comboStat = comboValue?.closest('.rhythm-game-stat');
        if (!comboStat) return;

        if (combo <= 0 || notes.length <= 0) {
            comboStat.style.setProperty('--combo-value-color', '#ffffff');
            comboStat.style.setProperty('--combo-text-glow', 'rgba(255,255,255,0.1)');
            comboStat.style.setProperty('--combo-glow', 'rgba(255,255,255,0.08)');
            comboStat.style.setProperty('--combo-border', 'rgba(255,255,255,0.07)');
            return;
        }

        const ratio = Math.max(0, Math.min(1, combo / notes.length));
        const eased = Math.pow(ratio, 0.72);
        const hue = 198 - (eased * 132);
        const saturation = 50 + (eased * 36);
        const lightness = 61 + (eased * 11);
        const glowAlpha = 0.10 + (eased * 0.30);
        const borderAlpha = 0.14 + (eased * 0.20);
        const textColor = `hsl(${hue.toFixed(1)} ${saturation.toFixed(1)}% ${lightness.toFixed(1)}%)`;
        const glowColor = `hsla(${hue.toFixed(1)} ${saturation.toFixed(1)}% 68% / ${glowAlpha.toFixed(3)})`;
        const borderColor = `hsla(${hue.toFixed(1)} ${saturation.toFixed(1)}% 58% / ${borderAlpha.toFixed(3)})`;

        comboStat.style.setProperty('--combo-value-color', textColor);
        comboStat.style.setProperty('--combo-text-glow', glowColor);
        comboStat.style.setProperty('--combo-glow', glowColor);
        comboStat.style.setProperty('--combo-border', borderColor);
    }

    function updateResultAppearance(accuracy = null, grade = '-') {
        const resultStat = resultGrade?.closest('.rhythm-game-stat');
        if (!resultStat) return;

        if (!grade || grade === '-' || !Number.isFinite(accuracy)) {
            resultStat.style.setProperty('--result-value-color', '#ffffff');
            resultStat.style.setProperty('--result-text-glow', 'rgba(255,255,255,0.1)');
            resultStat.style.setProperty('--result-glow', 'rgba(255,255,255,0.08)');
            resultStat.style.setProperty('--result-border', 'rgba(255,255,255,0.07)');
            return;
        }

        const tone = getResultTone(grade, accuracy);
        const textColor = `hsl(${tone.hue.toFixed(1)} ${tone.saturation.toFixed(1)}% ${tone.lightness.toFixed(1)}%)`;
        const glowColor = `hsla(${tone.hue.toFixed(1)} ${tone.saturation.toFixed(1)}% 68% / ${tone.glow.toFixed(3)})`;
        const borderColor = `hsla(${tone.hue.toFixed(1)} ${tone.saturation.toFixed(1)}% 58% / ${tone.border.toFixed(3)})`;

        resultStat.style.setProperty('--result-value-color', textColor);
        resultStat.style.setProperty('--result-text-glow', glowColor);
        resultStat.style.setProperty('--result-glow', glowColor);
        resultStat.style.setProperty('--result-border', borderColor);
    }

    function focusFinishPlayerIdInput(selectAll = false) {

        if (!finishPlayerIdInput) return;

        finishPlayerIdInput.focus();
        if (selectAll && typeof finishPlayerIdInput.select === 'function') {
            finishPlayerIdInput.select();
        }
    }

    function updateFinishUploadButtonState() {
        if (!finishUploadButton) return;

        const nextId = normalizePlayerId(finishPlayerIdInput?.value ?? '');
        const canUpload = Boolean(pendingFinishResult) && nextId.length > 0;
        finishUploadButton.disabled = !canUpload;
        finishUploadButton.classList.toggle('is-disabled', !canUpload);
        if (finishNote) {
            finishNote.textContent = canUpload
                ? '按下上傳後，成績會寫入排行榜。'
                : '如果沒有輸入 ID，按鈕會保持鎖定。';
        }
    }

    function setFinishModalVisible(nextVisible) {
        if (!finishModal) return;

        isFinishModalOpen = nextVisible;
        finishModal.classList.toggle('ui-hidden', !nextVisible);
        finishModal.classList.toggle('is-visible', nextVisible);
        finishModal.setAttribute('aria-hidden', nextVisible ? 'false' : 'true');
        updateFinishUploadButtonState();

        if (nextVisible) {
            window.setTimeout(() => focusFinishPlayerIdInput(true), 0);
        }
    }

    function openFinishModal({ score: finalScore, grade, accuracy, combo: finalCombo, biasLabel }) {
        pendingFinishResult = { score: finalScore, grade, accuracy, combo: finalCombo, biasLabel };

        if (finishScoreValue) finishScoreValue.textContent = finalScore.toLocaleString();
        if (finishResultValue) finishResultValue.textContent = grade;
        if (finishComboValue) finishComboValue.textContent = String(finalCombo);
        if (finishAccuracyValue) finishAccuracyValue.textContent = `${accuracy}%`;
        if (finishCopy) {
            finishCopy.textContent = '這局的結果已經算好了。現在輸入 ID，按上傳就會進排行榜。' + (biasLabel ? ` 你的節奏偏向 ${biasLabel}。` : '');
        }
        if (finishPlayerIdInput) {
            finishPlayerIdInput.value = playerId || '';
        }

        setFinishModalVisible(true);
    }

    function closeFinishModal() {
        setFinishModalVisible(false);
    }

    function submitFinishResult() {
        if (!pendingFinishResult) return;

        const nextId = savePlayerId(finishPlayerIdInput?.value ?? playerId);
        if (!nextId) {
            if (finishNote) {
                finishNote.textContent = '請先輸入 ID，再上傳結果。';
            }
            focusFinishPlayerIdInput(true);

            return;
        }

        recordLeaderboardEntry(pendingFinishResult.score, pendingFinishResult.grade);
        pendingFinishResult = null;
        closeFinishModal();
        setJudgement('Uploaded', '成績已寫入排行榜。');
        statusCopy.textContent = '成績已上傳，你可以直接再挑戰一次，或回到排行榜檢視結果。';

    }

    function updateHud() {
        scoreValue.textContent = String(score);
        comboValue.textContent = String(combo);
        progressValue.textContent = `${judgedCount} / ${notes.length}`;
        const accuracy = judgedCount === 0
            ? 100
            : Math.round((totalAccuracyWeight / judgedCount) * 100);
        accuracyValue.textContent = `${accuracy}%`;
        if (perfectValue) perfectValue.textContent = String(perfectCount);
        if (goodValue) goodValue.textContent = String(goodCount);
        if (missValue) missValue.textContent = String(missCount);
        updateScoreAppearance();
        updateComboAppearance();
    }

    function updateProgressBar(runTime) {
        if (!progressFill || !progressText) return;

        const totalRunDuration = LEAD_IN + chartDuration + 0.8;
        const elapsed = Math.max(0, Math.min(runTime + LEAD_IN, totalRunDuration));
        const percent = totalRunDuration <= 0 ? 0 : Math.max(0, Math.min(100, (elapsed / totalRunDuration) * 100));

        progressFill.style.width = `${percent.toFixed(2)}%`;
        progressText.textContent = `${Math.round(percent)}%`;
    }

    function resetStats() {
        score = 0;
        combo = 0;
        maxCombo = 0;
        judgedCount = 0;
        totalAccuracyWeight = 0;
        timingOffsets = [];
        perfectCount = 0;
        goodCount = 0;
        missCount = 0;
        updateHud();
    }

    function ensureRhythmTrackPlayer() {
        if (rhythmTrackPlayer) return rhythmTrackPlayer;
        if (typeof Tone === 'undefined' || typeof Tone.Player !== 'function') return null;

        rhythmTrackPlayer = new Tone.Player({
            url: RHYTHM_TRACK_URL,
            autostart: false,
            loop: false,
            volume: -5
        }).toDestination();

        return rhythmTrackPlayer;
    }

    async function loadRhythmTrackPlayer() {
        const player = ensureRhythmTrackPlayer();
        if (!player) return null;

        await Tone.loaded();
        const trackDurationSeconds = Number.isFinite(player.buffer?.duration) ? player.buffer.duration : 0;
        rhythmAudibleWindow = detectRhythmAudibleWindow(getRhythmPlayerAudioBuffer(player), trackDurationSeconds);
        configureChart(trackDurationSeconds);
        return player;
    }

    function startRhythmTrack() {
        const player = ensureRhythmTrackPlayer();
        if (!player || typeof Tone === 'undefined' || typeof Tone.now !== 'function') return;

        player.stop();
        player.seek = 0;
        rhythmTrackStartTime = Tone.now() + LEAD_IN;
        player.start(rhythmTrackStartTime);
    }

    function stopRhythmTrack() {
        if (!rhythmTrackPlayer) {
            rhythmTrackStartTime = null;
            return;
        }

        rhythmTrackPlayer.stop();
        rhythmTrackPlayer.seek = 0;
        rhythmTrackStartTime = null;
    }
    function setLaneHeld(laneIndex, held) {
        const lane = laneElements[laneIndex];
        if (!lane) return;
        lane.classList.toggle('is-held', held);
    }

    function clearLaneFlashes() {
        while (laneFlashTimers.length) {
            clearTimeout(laneFlashTimers.pop());
        }

        for (const lane of laneElements) {
            lane.classList.remove('is-hit', 'is-held');
        }
    }


    function spawnHitBurst(laneIndex, strength = 'tap') {
        const lane = laneElements[laneIndex];
        if (!lane) return;

        const burst = document.createElement('div');
        burst.className = 'rg-hit-burst';

        const count = strength === 'holdStart'
            ? 14
            : strength === 'hold'
                ? 12
                : 9;

        for (let i = 0; i < count; i++) {
            const particle = document.createElement('span');
            particle.className = 'rg-hit-particle';

            const angle = (Math.random() * Math.PI) - Math.PI; // upward fan
            const speed = strength === 'hold'
                ? 44 + Math.random() * 44
                : 36 + Math.random() * 38;

            const dx = Math.cos(angle) * speed * (0.55 + Math.random() * 0.55);
            const dy = Math.sin(angle) * speed - (24 + Math.random() * 34);

            const hue = 38 + Math.random() * 38;
            const size = strength === 'holdStart'
                ? 6 + Math.random() * 5
                : 5 + Math.random() * 4;

            const duration = strength === 'hold'
                ? 620 + Math.floor(Math.random() * 220)
                : 500 + Math.floor(Math.random() * 180);

            const delay = Math.floor(Math.random() * 80);

            particle.style.setProperty('--dx', `${dx.toFixed(1)}px`);
            particle.style.setProperty('--dy', `${dy.toFixed(1)}px`);
            particle.style.setProperty('--h', `${hue.toFixed(1)}`);
            particle.style.setProperty('--s', `${size.toFixed(1)}px`);
            particle.style.setProperty('--dur', `${duration}ms`);
            particle.style.setProperty('--dly', `${delay}ms`);
            particle.style.setProperty('--sc', `${(1.05 + Math.random() * 0.45).toFixed(2)}`);

            burst.appendChild(particle);
        }

        lane.appendChild(burst);
        window.setTimeout(() => {
            burst.remove();
        }, 980);
    }

    function startHoldSpray(laneIndex) {
        if (holdSprayTimers.has(laneIndex)) return;
        const timer = window.setInterval(() => {
            spawnHitBurst(laneIndex, 'hold');
        }, 120);
        holdSprayTimers.set(laneIndex, timer);
    }

    function stopHoldSpray(laneIndex) {
        const timer = holdSprayTimers.get(laneIndex);
        if (timer) {
            clearInterval(timer);
        }
        holdSprayTimers.delete(laneIndex);
    }
    function pulseLane(laneIndex, duration = 120) {
        const lane = laneElements[laneIndex];
        if (!lane) return;
        lane.classList.add('is-hit');
        const timer = window.setTimeout(() => {
            lane.classList.remove('is-hit');
        }, duration);
        laneFlashTimers.push(timer);
    }

    function resetNoteState() {
        buildNotes();
        resetStats();
        updateProgressBar(-LEAD_IN);
        results.classList.remove('active');
        resultGrade.textContent = '-';
        resultBias.textContent = '-';
        resultCombo.textContent = '0';
        updateResultAppearance();
        pendingFinishResult = null;
        closeFinishModal();
        panel.classList.remove('playing');
        updateStartButtonLabel(0);
        if (judgementValue) {
            if (judgementHideTimerId !== null) {
                window.clearTimeout(judgementHideTimerId);
                judgementHideTimerId = null;
            }
            if (judgementReplayTimerId !== null) {
                window.clearTimeout(judgementReplayTimerId);
                judgementReplayTimerId = null;
            }
            judgementLastShownAt = 0;
            if (judgementReplayTimerId !== null) {
                window.clearTimeout(judgementReplayTimerId);
                judgementReplayTimerId = null;
            }
            judgementLastShownAt = 0;
            judgementValue.textContent = '';
            judgementValue.classList.remove('is-perfect','is-good','is-miss','is-warning','is-success','is-neutral','is-ready','is-error','is-visible');
        }
        statusCopy.textContent = '按下 Start Run 後，節奏會先進入 lead-in，再開始掉 note。';
        if (sessionHint) {
            sessionHint.textContent = '預設鍵位是 D F J K。tap 是短按，hold 要接住起點後一路按到尾端。';
        }
        clearLaneFlashes();
    }


    function clearAutoStartTimer() {
        if (autoStartTimerId !== null) {
            window.clearTimeout(autoStartTimerId);
            autoStartTimerId = null;
        }
    }

    function scheduleAutoStart() {
        clearAutoStartTimer();
        autoStartTimerId = window.setTimeout(() => {
            autoStartTimerId = null;
            if (!isActive || isRunning) return;
            startRun().catch((err) => {
                console.error('Rhythm game auto-start failed:', err);
                setJudgement('Audio Error', '音訊初始化失敗，請確認瀏覽器允許播放音效。');
            });
        }, 1200);
    }
    function disposeInstrument() {
        disposeLofiChain(rhythmLofiVibrato, rhythmLofiFilter);
        if (rhythmInstrument && typeof rhythmInstrument.dispose === 'function') {
            rhythmInstrument.dispose();
        }
        if (rhythmTrackPlayer && typeof rhythmTrackPlayer.dispose === 'function') {
            rhythmTrackPlayer.dispose();
        }
        rhythmInstrument = null;
        rhythmLofiVibrato = null;
        rhythmLofiFilter = null;
        rhythmTrackPlayer = null;
        rhythmTrackStartTime = null;
    }

    async function ensureAudioTools() {
        await initAudio();

        if (!rhythmInstrument) {
            const created = await createInstrumentInstance('chiptune_lead');
            rhythmInstrument = created.instrument;
            rhythmLofiVibrato = created.lofiVibrato;
            rhythmLofiFilter = created.lofiFilter;
        }

        await loadRhythmTrackPlayer();
    }

    function currentRunTime() {
        if (rhythmTrackStartTime !== null && typeof Tone !== 'undefined' && typeof Tone.now === 'function') {
            return Tone.now() - rhythmTrackStartTime;
        }
        return nowSeconds() - runStartAt;
    }

    function formatMusicTime(totalSeconds) {
        const safeSeconds = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
        const minutes = Math.floor(safeSeconds / 60);
        const seconds = safeSeconds % 60;
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    }

    function updateStartButtonLabel(runTime = currentRunTime()) {
        if (!startButton) return;

        if (!isRunning) {
            startButton.textContent = 'Start Run';
            return;
        }

        startButton.textContent = formatMusicTime(Math.max(0, runTime));
    }

    function playLaneSound(laneIndex) {
        const midi = LANE_MIDIS[laneIndex] ?? 60;
        const visualX = LANE_VISUAL_X[laneIndex] ?? 0;
        playVisualFeedback('user', midi, visualX, -1.9);
    }

    function recordFinalResult(note, bucket, label, scoreDelta, accuracyWeight, offsetSeconds = null) {
        note.state = bucket === 'miss' ? 'missed' : 'hit';
        judgedCount += 1;
        totalAccuracyWeight += accuracyWeight;

        if (bucket === 'perfect') {
            perfectCount += 1;
        } else if (bucket === 'good') {
            goodCount += 1;
        } else {
            missCount += 1;
        }

        if (bucket === 'miss') {
            combo = 0;
        } else {
            combo += 1;
            maxCombo = Math.max(maxCombo, combo);
            score += scoreDelta;
            if (typeof offsetSeconds === 'number') {
                timingOffsets.push(offsetSeconds);
            }
            playLaneSound(note.lane);
            spawnHitBurst(note.lane, note.type === 'hold' ? 'hold' : 'tap');
            pulseLane(note.lane, note.type === 'hold' ? 180 : 120);
        }

        if (note.type === 'hold') {
            stopHoldSpray(note.lane);
            activeHoldNotes.delete(note.lane);
            setLaneHeld(note.lane, false);
        }

        if (note.element) {
            note.element.classList.remove('is-visible', 'is-holding');
            note.element.classList.remove('is-start-miss');
            note.element.classList.add(bucket === 'miss' ? 'is-miss' : 'is-hit');
        }

        setJudgement(label);
        updateHud();
    }

    function finalizeTap(note, deltaSeconds) {
        const bucket = getJudgeBucket(deltaSeconds);
        const reward = getTapReward(bucket);
        recordFinalResult(note, bucket, reward.label, reward.score, reward.weight, deltaSeconds);
    }

    function startHold(note, deltaSeconds) {
        const bucket = getJudgeBucket(deltaSeconds);
        if (bucket === 'miss') {
            recordFinalResult(note, 'miss', 'Miss', 0, 0, deltaSeconds);
            return;
        }

        note.state = 'holding';
        note.keyHeld = true;
        note.holdBucket = bucket;
        note.holdStartedAt = currentRunTime();
        activeHoldNotes.set(note.lane, note);
        setLaneHeld(note.lane, true);
        pulseLane(note.lane, 180);
        playLaneSound(note.lane);

        if (note.element) {
            note.element.classList.add('is-holding', 'is-visible');
        }

        spawnHitBurst(note.lane, 'holdStart');
        startHoldSpray(note.lane);

        const startLabel = bucket === 'perfect' ? 'Perfect' : 'Good';
        setJudgement(startLabel);
    }

    function completeHold(note, releaseOffset = 0, autoCompleted = false) {
        const bucket = note.holdBucket ?? 'good';
        const reward = getHoldReward(bucket);
        recordFinalResult(note, bucket, reward.label, reward.score, reward.weight, note.holdStartedAt !== null ? note.holdStartedAt - note.time : 0);
    }

    function failHoldRelease(note, runTime) {
        recordFinalResult(note, 'miss', 'Miss', 0, 0, runTime - note.time);
    }
    function processAutoMisses(runTime) {
        for (const note of notes) {
            if (note.state === 'pending') {
                if (note.type === 'hold') {
                    const holdStartMissWindow = note.time + JUDGE_WINDOWS.miss;
                    if (!note.startMissed && runTime > holdStartMissWindow) {
                        note.startMissed = true;
                        if (note.element) {
                            note.element.classList.add('is-start-miss');
                        }
                    }

                    const holdMissWindow = note.endTime + JUDGE_WINDOWS.miss;
                    if (runTime > holdMissWindow) {
                        recordFinalResult(note, 'miss', 'Miss', 0, 0, runTime - note.time);
                    }
                } else if (runTime - note.time > JUDGE_WINDOWS.miss) {
                    finalizeTap(note, runTime - note.time);
                }
                continue;
            }

            // If a hold has been started, it should resolve at its tail timing (not linger at the bottom).
            if (note.state === 'holding' && runTime >= note.endTime) {
                completeHold(note, 0, true);
                continue;
            }

            // Failsafe: if a hold somehow stays "holding" past its tail for too long, mark it as miss and remove.
            if (note.state === 'holding' && runTime - note.endTime > JUDGE_WINDOWS.miss) {
                recordFinalResult(note, 'miss', 'Miss', 0, 0, runTime - note.time);
            }
        }
    }
    function getCurrentNoteVisualState(note, runTime) {
        const timeUntilHit = note.time - runTime;
        const progress = 1 - (timeUntilHit / TRAVEL_TIME);
        const naturalBottomPercent = (1 - progress) * 100;

        if (note.type === 'hold' && note.state === 'holding') {
            const remaining = Math.max(0, note.endTime - runTime);
            return {
                bottom: 0,
                height: Math.max(0, (remaining / TRAVEL_TIME) * 100 - HOLD_VISUAL_GAP_PCT),
                holdExtra: (note.duration / TRAVEL_TIME) * 100,
                progress
            };
        }

        const height = note.type === 'hold'
            ? Math.max(0, (note.duration / TRAVEL_TIME) * 100 - HOLD_VISUAL_GAP_PCT)
            : TAP_VISUAL_HEIGHT_PCT;

        return {
            bottom: naturalBottomPercent,
            height,
            holdExtra: note.type === 'hold' ? (note.duration / TRAVEL_TIME) * 100 : 0,
            progress
        };
    }

    function getVisualNoteHeightPercent(note, runTime) {
        return getCurrentNoteVisualState(note, runTime).height;
    }

    function updateNotePositions(runTime) {
        const laneState = new Map();

        for (const note of notes) {
            if (!note.element) continue;

            const visualState = getCurrentNoteVisualState(note, runTime);
            const laneBottomLimit = laneState.get(note.lane) ?? -10_000;
            const visualBottomPercent = laneBottomLimit <= -9_000
                ? visualState.bottom
                : Math.max(visualState.bottom, laneBottomLimit);
            const visible = visualState.progress >= -0.08 && visualBottomPercent >= -(visualState.holdExtra + 18) && visualBottomPercent <= 118;

            note.element.classList.toggle('is-visible', visible || note.state === 'holding' || note.state === 'missed');

            if (note.type === 'hold' && note.state === 'holding') {
                note.element.style.bottom = `0%`;
                note.element.style.height = `${visualState.height}%`;
            } else {
                note.element.style.bottom = `${visualBottomPercent}%`;
                if (note.type === 'hold') {
                    note.element.style.height = `${visualState.height}%`;
                }
            }

            if (note.state === 'missed') {
                const missRemovalLimit = -(visualState.height + 24);
                if (visualBottomPercent <= missRemovalLimit) {
                    note.element.remove();
                    note.element = null;
                    continue;
                }
            }

            if (note.state === 'hit') {
                const hitRemovalLimit = -(visualState.height + 24);
                if (visualBottomPercent <= hitRemovalLimit) {
                    note.element.remove();
                    note.element = null;
                    continue;
                }
            }

            laneState.set(note.lane, visualBottomPercent + visualState.height + NOTE_VISUAL_GAP_PCT);
        }
    }


    function step() {
        animationFrameId = window.requestAnimationFrame(step);

        if (!isActive || !isRunning) return;

        const runTime = currentRunTime();
        updateStartButtonLabel(runTime);
        updateNotePositions(runTime);
        updateProgressBar(runTime);
        if (runTime >= 0) {
            processAutoMisses(runTime);
        }

        if (judgedCount === notes.length && runTime > chartDuration + 0.8) {
            finishRun();
        }
    }

    function startLoop() {
        if (animationFrameId !== null) return;
        animationFrameId = window.requestAnimationFrame(step);
    }

    function stopLoop() {
        if (animationFrameId !== null) {
            window.cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }

    async function startRun() {
        clearAutoStartTimer();
        await ensureAudioTools();
        clearAutoStartTimer();
        resetNoteState();
        isRunning = true;
        panel.classList.add('playing');
        results.classList.remove('active');
        runStartAt = nowSeconds() + LEAD_IN;
        startRhythmTrack();
        statusCopy.textContent = `${chart.title} 已載入。這輪除了 tap，也有幾顆 hold note 會混進來。`;
        if (sessionHint) {
            sessionHint.textContent = 'tap 是短按，hold 要從起點接住後一路按到尾端。這樣比較接近真正節奏遊戲的手感。';
        }
        updateHud();
        updateProgressBar(-LEAD_IN);
        updateStartButtonLabel(0);
        startLoop();
    }

    function resetRun() {
        clearAutoStartTimer();
        isRunning = false;
        stopRhythmTrack();
        for (const timer of holdSprayTimers.values()) { clearInterval(timer); }
        holdSprayTimers.clear();
        activeHoldNotes.clear();
        resetNoteState();
        updateProgressBar(-LEAD_IN);
    }

    function activate() {
        isActive = true;
        if (!isRunning) {
            if (judgementValue) {
                if (judgementHideTimerId !== null) {
                    window.clearTimeout(judgementHideTimerId);
                    judgementHideTimerId = null;
                }
                if (judgementReplayTimerId !== null) {
                    window.clearTimeout(judgementReplayTimerId);
                    judgementReplayTimerId = null;
                }
                judgementLastShownAt = 0;
                judgementValue.textContent = '';
                judgementValue.classList.remove('is-perfect','is-good','is-miss','is-warning','is-success','is-neutral','is-ready','is-error','is-visible');
            }
            if (playerIdInput && !playerId) {
                focusPlayerIdInput(true);
            }
        }
        startLoop();
    }

    function deactivate() {
        clearAutoStartTimer();
        isActive = false;
        isRunning = false;
        stopRhythmTrack();
        for (const timer of holdSprayTimers.values()) { clearInterval(timer); }
        holdSprayTimers.clear();
        activeHoldNotes.clear();
        pendingFinishResult = null;
        closeFinishModal();
        panel.classList.remove('playing');
        panel.classList.remove('finished');
        clearLaneFlashes();
        updateProgressBar(-LEAD_IN);
        stopLoop();
    }

    function pickCandidate(laneIndex, runTime) {
        let candidate = null;
        let candidateDelta = Infinity;

        for (const note of notes) {
            if (note.lane !== laneIndex || note.state !== 'pending') continue;
            const delta = runTime - note.time;
            const absDelta = Math.abs(delta);

            if (absDelta > JUDGE_WINDOWS.miss) continue;
            if (absDelta < candidateDelta) {
                candidate = note;
                candidateDelta = absDelta;
            }
        }

        return candidate;
    }

    function handleKeyDown(event) {
        const key = event.key.toLowerCase();
        const laneIndex = LANE_KEYS.indexOf(key);
        if (laneIndex === -1) return false;

        if (isFinishModalOpen) return false;
        if (isTypingInTextField(event)) return false;

        event.preventDefault();
        if (!isActive) return true;
        if (event.repeat) return true;

        spawnHitBurst(laneIndex, 'input');

        if (!isRunning) {
            pulseLane(laneIndex);
            setJudgement('Idle', '先按 Start Run 再開始判定。');
            return true;
        }

        if (activeHoldNotes.has(laneIndex)) {
            return true;
        }

        const runTime = currentRunTime();
        if (runTime < -0.08) {
            pulseLane(laneIndex);
            setJudgement('Too Soon', '還在 lead-in，等第一拍落下再按。');
            return true;
        }

        const candidate = pickCandidate(laneIndex, runTime);
        if (!candidate) {
            combo = 0;
            updateHud();
            pulseLane(laneIndex);
            setJudgement('Empty', '這個 lane 現在沒有可判定的 note。');
            return true;
        }

        if (candidate.type === 'hold') {
            startHold(candidate, runTime - candidate.time);
        } else {
            finalizeTap(candidate, runTime - candidate.time);
        }
        return true;
    }

    function handleKeyUp(event) {
        const key = event.key.toLowerCase();
        const laneIndex = LANE_KEYS.indexOf(key);
        if (laneIndex === -1) return false;

        if (isFinishModalOpen) return false;
        if (isTypingInTextField(event)) return false;

        event.preventDefault();
        if (!isActive || !isRunning) return true;

        const activeHold = activeHoldNotes.get(laneIndex);
        if (!activeHold) {
            return true;
        }

        stopHoldSpray(laneIndex);

        activeHold.keyHeld = false;
        setLaneHeld(laneIndex, false);

        const runTime = currentRunTime();
        const releaseOffset = runTime - activeHold.endTime;
        if (releaseOffset >= -JUDGE_WINDOWS.good) {
            completeHold(activeHold, releaseOffset, false);
        } else {
            failHoldRelease(activeHold, runTime);
        }

        return true;
    }

    function finishRun() {
        isRunning = false;
        panel.classList.remove('playing');
        panel.classList.add('finished');
        startButton.textContent = 'Retry';
        // Defensive cleanup: ensure no hold glow/bar stays stuck after the run completes.
        for (const timer of holdSprayTimers.values()) {
            clearInterval(timer);
        }
        holdSprayTimers.clear();
        activeHoldNotes.clear();
        clearLaneFlashes();
        updateProgressBar(chartDuration + 0.8);
        window.setTimeout(() => {
            for (const rail of laneRailElements) {
                if (!rail) continue;
                for (const node of Array.from(rail.querySelectorAll('.rhythm-game-note, .rg-hit-burst'))) {
                    node.remove();
                }
            }
        }, 120);
        const accuracy = judgedCount === 0 ? 0 : Math.round((totalAccuracyWeight / judgedCount) * 100);
        const averageOffsetMs = timingOffsets.length === 0
            ? 0
            : Math.round((timingOffsets.reduce((sum, offset) => sum + offset, 0) / timingOffsets.length) * 1000);
        const biasLabel = averageOffsetMs === 0
            ? 'Centered'
            : averageOffsetMs < 0
                ? `Early ${Math.abs(averageOffsetMs)}ms`
                : `Late ${averageOffsetMs}ms`;
        const grade = getResultGrade(accuracy);

        resultGrade.textContent = grade;
        resultBias.textContent = biasLabel;
        resultCombo.textContent = String(maxCombo);
        updateResultAppearance(accuracy, grade);
        openFinishModal({ score, grade, accuracy, combo: maxCombo, biasLabel });
        results.classList.add('active');
        setJudgement('Complete', `Perfect ${perfectCount} / Good ${goodCount} / Miss ${missCount}`);
        statusCopy.textContent = `這輪結束了。現在你可以一起感受 tap 與 hold 的節奏壓力，再決定判定窗和 note speed 要怎麼修。`;
        sessionHint.textContent = '如果 hold 常常斷掉，我們下一步可以調尾端容錯、長條可讀性，或是把 hold 的收尾提示做得更明顯。';
    }

    function bindControls() {
        startButton.addEventListener('click', () => {
            if (isRunning) return;
            startRun().catch((err) => {
                console.error('Rhythm game start failed:', err);
                setJudgement('Audio Error', '音訊初始化失敗，請確認瀏覽器允許播放音效。');
            });
        });

        finishUploadButton?.addEventListener('click', submitFinishResult);
        finishRetryButton?.addEventListener('click', () => {
            pendingFinishResult = null;
            closeFinishModal();
            resetRun();
        });
        finishBackdrop?.addEventListener('click', () => {
            focusFinishPlayerIdInput(true);
        });

        finishPlayerIdInput?.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                focusFinishPlayerIdInput(true);
            }
        });
    }

    configureChart();
    buildNotes();
    bindControls();
    renderLeaderboardEntries();
    resetRun();

    return {
        activate,
        deactivate,
        disposeInstrument,
        handleKeyDown,
        handleKeyUp,
        reset: resetRun
    };
}





















