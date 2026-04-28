export function createPianoFeedbackController({
    allKeysMap,
    getPlanes,
    createRingPoint,
    projectPointToPlane,
    triggerInteraction,
    spawnMist,
    spawnSparks,
    highlightDurationMs = 150
}) {
    const liveKeyHighlights = new Map();
    const playbackKeyHighlights = new Map();

    function updateKeyHighlightState(midi) {
        const keyEl = allKeysMap[midi];
        if (!keyEl) return;

        const hasLive = (liveKeyHighlights.get(midi) ?? 0) > 0;
        const hasPlayback = (playbackKeyHighlights.get(midi) ?? 0) > 0;

        keyEl.classList.remove('user-active', 'playback-active', 'mixed-active');

        if (hasLive && hasPlayback) keyEl.classList.add('mixed-active');
        else if (hasLive) keyEl.classList.add('user-active');
        else if (hasPlayback) keyEl.classList.add('playback-active');
    }

    function highlightKey(source, midi, active) {
        const targetMap = source === 'playback' ? playbackKeyHighlights : liveKeyHighlights;
        const currentCount = targetMap.get(midi) ?? 0;

        if (active) {
            targetMap.set(midi, currentCount + 1);
        } else if (currentCount <= 1) {
            targetMap.delete(midi);
        } else {
            targetMap.set(midi, currentCount - 1);
        }

        updateKeyHighlightState(midi);
    }

    function triggerTimedHighlight(source, midi) {
        highlightKey(source, midi, true);
        setTimeout(() => highlightKey(source, midi, false), highlightDurationMs);
    }

    function playVisualFeedback(source, midi, ringX, ringY) {
        const planes = getPlanes();
        const ringPoint = createRingPoint(ringX, ringY, planes.ring);
        const mistPoint = projectPointToPlane(ringPoint, planes.mist);
        const bgPoint = projectPointToPlane(ringPoint, planes.background);
        const sparkPoint = projectPointToPlane(ringPoint, planes.spark);

        triggerInteraction(source, bgPoint, midi);
        spawnMist(mistPoint, midi);
        spawnSparks(sparkPoint);
    }

    return {
        highlightKey,
        playVisualFeedback,
        triggerTimedHighlight
    };
}
