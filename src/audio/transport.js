export function createTransportController({
    createPlaybackInstrument,
    getCurrentSound,
    getPlaybackInstrument,
    getTriggerTime,
    highlightKey,
    initAudio,
    isRecordingActive,
    nowSeconds,
    onPlaybackStateChange,
    onRecordingStateChange,
    playMidiWithInstrument,
    playVisualFeedback,
    releasePlaybackVisuals,
    supportsHeldNotes,
    tapDuration = 0.12,
    triggerPlaybackNoteOn,
    updateTransportButtons
}) {
    let recordedSoundType = 'synth';
    let recordingStartTime = 0;
    let recordedEvents = [];
    let isPlaybackActive = false;
    let playbackEndTimer = null;
    const playbackTimers = [];
    const playbackPianoNotes = new Map();
    let playbackLoopDuration = 0;

    function getRecordedEvents() {
        return recordedEvents;
    }

    function getIsPlaybackActive() {
        return isPlaybackActive;
    }

    function stopScheduledPlayback() {
        for (const timer of playbackTimers) {
            clearTimeout(timer);
        }
        playbackTimers.length = 0;

        if (playbackEndTimer !== null) {
            clearTimeout(playbackEndTimer);
            playbackEndTimer = null;
        }
    }

    function attackPlaybackPianoMidi(midi) {
        const playbackInstrument = getPlaybackInstrument();
        if (!playbackInstrument || !supportsHeldNotes(recordedSoundType) || playbackPianoNotes.has(midi)) return;

        const note = Tone.Frequency(midi, 'midi').toNote();
        const startTime = getTriggerTime();
        playbackInstrument.triggerAttack(note, startTime);
        playbackPianoNotes.set(midi, { note, startTime });
    }

    function releasePlaybackPianoMidi(midi) {
        const playbackInstrument = getPlaybackInstrument();
        if (!playbackInstrument) return;

        const state = playbackPianoNotes.get(midi);
        if (!state) return;

        const now = getTriggerTime();
        const heldFor = now - state.startTime;
        const releaseTime = heldFor < tapDuration
            ? now + (tapDuration - heldFor)
            : now;

        playbackInstrument.triggerRelease(state.note, releaseTime);
        playbackPianoNotes.delete(midi);
    }

    function stopPlayback() {
        stopScheduledPlayback();

        for (const midi of Array.from(playbackPianoNotes.keys())) {
            releasePlaybackPianoMidi(midi);
        }

        releasePlaybackVisuals();
        isPlaybackActive = false;
        onPlaybackStateChange(false);
        updateTransportButtons();
    }

    function stopRecording() {
        onRecordingStateChange(false);
        updateTransportButtons();
    }

    function startRecording() {
        stopPlayback();
        recordedEvents = [];
        recordedSoundType = getCurrentSound();
        recordingStartTime = nowSeconds();
        onRecordingStateChange(true);
        updateTransportButtons();
    }

    function recordPerformanceEvent(event) {
        if (!isRecordingActive()) return;

        recordedEvents.push({
            ...event,
            time: nowSeconds() - recordingStartTime
        });
        updateTransportButtons();
    }

    function schedulePlaybackLoopPass() {
        if (!isPlaybackActive) return;

        for (const event of recordedEvents) {
            const timer = setTimeout(() => {
                if (!isPlaybackActive) return;

                if (event.type === 'note-on') {
                    playVisualFeedback('playback', event.midi, event.ringX, event.ringY);
                    triggerPlaybackNoteOn(event.midi, !!event.sustained);

                    if (supportsHeldNotes(recordedSoundType) && event.sustained) {
                        attackPlaybackPianoMidi(event.midi);
                    } else {
                        playMidiWithInstrument(getPlaybackInstrument(), recordedSoundType, event.midi);
                    }
                } else if (event.type === 'note-off') {
                    highlightKey('playback', event.midi, false);
                    releasePlaybackVisuals(event.midi);
                    if (supportsHeldNotes(recordedSoundType)) {
                        releasePlaybackPianoMidi(event.midi);
                    }
                }
            }, Math.max(0, event.time * 1000));

            playbackTimers.push(timer);
        }

        playbackEndTimer = setTimeout(() => {
            for (const midi of Array.from(playbackPianoNotes.keys())) {
                releasePlaybackPianoMidi(midi);
            }

            schedulePlaybackLoopPass();
        }, playbackLoopDuration * 1000);
    }

    async function startPlayback() {
        if (recordedEvents.length === 0 || isRecordingActive()) return;

        stopPlayback();

        try {
            await initAudio();
            await createPlaybackInstrument(recordedSoundType);
        } catch (err) {
            console.error('Playback audio init failed:', err);
            return;
        }

        isPlaybackActive = true;
        onPlaybackStateChange(true);
        updateTransportButtons();
        playbackLoopDuration = recordedEvents.reduce((maxTime, event) => Math.max(maxTime, event.time), 0) + 0.25;
        schedulePlaybackLoopPass();
    }

    return {
        getIsPlaybackActive,
        getRecordedEvents,
        recordPerformanceEvent,
        startPlayback,
        startRecording,
        stopPlayback,
        stopRecording
    };
}
