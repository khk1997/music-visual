function getKeyVisualPosition(key) {
    const row = "qwertyuiop".includes(key)
        ? "qwertyuiop"
        : "asdfghjkl".includes(key)
            ? "asdfghjkl"
            : "zxcvbnm";

    const x = (row.indexOf(key) / (row.length - 1)) * 12 - 6;
    const y = row === "qwertyuiop" ? 2.5 : row === "zxcvbnm" ? -2.5 : 0;

    return { x, y };
}

export function createKeyboardInputController({
    documentTarget = document,
    windowTarget = window,
    getCurrentScreen,
    isInteractivePlayback,
    getMidiFromScaleKey,
    initAudio,
    isInstrumentLoading,
    getCurrentSound,
    supportsHeldNotes,
    onHomeEnter,
    onPlayHeldMidi,
    onPlayTapMidi,
    onReleaseHeldKey,
    hasHeldKeyState,
    onVisualNoteOn,
    onVisualNoteOff,
    onRecordEvent,
    onStopAllLiveInput
}) {
    const activeVisualKeyStates = new Map();

    function stopActiveVisualKeys() {
        for (const [key, visualState] of Array.from(activeVisualKeyStates.entries())) {
            onRecordEvent({ type: 'note-off', midi: visualState.midi });
            onVisualNoteOff(visualState.midi);
            activeVisualKeyStates.delete(key);
        }
    }

    async function handleKeyDown(event) {
        if (!isInteractivePlayback()) {
            if (getCurrentScreen() === 'home' && event.key === 'Enter') {
                onHomeEnter();
            }
            return;
        }

        const key = event.key.toLowerCase();
        const midi = getMidiFromScaleKey(key, event.shiftKey, event.ctrlKey);

        if (midi === null) return;

        event.preventDefault();
        if (event.repeat) return;

        try {
            await initAudio();
            if (isInstrumentLoading()) return;

            const { x, y } = getKeyVisualPosition(key);
            const sustained = true;
            onVisualNoteOn(midi, x, y, sustained);
            onRecordEvent({ type: 'note-on', midi, ringX: x, ringY: y, sustained });
            activeVisualKeyStates.set(key, { midi });

            if (supportsHeldNotes(getCurrentSound())) {
                onPlayHeldMidi(key, midi);
            } else {
                onPlayTapMidi(midi);
            }
        } catch (err) {
            console.error('Audio init/play failed:', err);
        }
    }

    function handleKeyUp(event) {
        if (!isInteractivePlayback()) return;

        const key = event.key.toLowerCase();
        const visualState = activeVisualKeyStates.get(key);

        if (visualState) {
            onRecordEvent({ type: 'note-off', midi: visualState.midi });
            onVisualNoteOff(visualState.midi);
            activeVisualKeyStates.delete(key);
        }

        if (supportsHeldNotes(getCurrentSound()) && hasHeldKeyState(key)) {
            onReleaseHeldKey(key);
        }
    }

    function handleBlur() {
        onStopAllLiveInput();
    }

    function handleVisibilityChange() {
        if (documentTarget.visibilityState === 'hidden') {
            onStopAllLiveInput();
        }
    }

    function bind() {
        windowTarget.addEventListener('keydown', handleKeyDown);
        windowTarget.addEventListener('keyup', handleKeyUp);
        windowTarget.addEventListener('blur', handleBlur);
        documentTarget.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return {
        bind,
        stopActiveVisualKeys
    };
}
