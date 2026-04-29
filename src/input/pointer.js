function isEventInsideElement(event, element) {
    if (!element) return false;

    const rect = element.getBoundingClientRect();
    return event.clientX >= rect.left
        && event.clientX <= rect.right
        && event.clientY >= rect.top
        && event.clientY <= rect.bottom;
}

export function createPointerInputController({
    windowTarget = window,
    isInteractivePlayback,
    getExcludedElements = () => [],
    initAudio,
    isInstrumentLoading,
    getDefaultMidi,
    getRingPoint,
    onLiveNoteOn
}) {
    async function handleMouseDown(event) {
        if (!isInteractivePlayback()) return;

        const isBlockedByUi = getExcludedElements().some((element) => isEventInsideElement(event, element));
        if (isBlockedByUi) return;

        try {
            await initAudio();
            if (isInstrumentLoading()) return;

            const midi = getDefaultMidi();
            const ringPoint = getRingPoint(event.clientX, event.clientY);
            onLiveNoteOn({ midi, ringX: ringPoint.x, ringY: ringPoint.y, sustained: false });
        } catch (err) {
            console.error('Mouse audio init/play failed:', err);
        }
    }

    function bind() {
        windowTarget.addEventListener('mousedown', handleMouseDown);
    }

    return {
        bind
    };
}
