export function createRecordSlotController({
    buttons,
    createInstrumentInstance,
    disposeLofiChain,
    getCurrentSound,
    getTriggerTime,
    highlightKey,
    initAudio,
    nowSeconds,
    playMidiWithInstrument,
    playVisualFeedback,
    releasePlaybackVisuals,
    supportsHeldNotes,
    tapDuration = 0.12,
    triggerPlaybackNoteOn
}) {
    const MIN_LOOP_DURATION = 0.5;
    const LOOP_EVENT_EPSILON = 0.01;

    const slots = buttons.map((button, index) => ({
        id: index + 1,
        button,
        events: [],
        soundType: 'synth',
        recordingStartTime: 0,
        state: 'empty',
        instrumentBundle: null,
        playbackEndTimer: null,
        playbackTimers: [],
        playbackPianoNotes: new Map(),
        playbackLoopDuration: 0
    }));

    let recordingSlot = null;
    let masterLoopDuration = 0;
    let masterLoopStartTime = 0;

    function hasMasterLoop() {
        return masterLoopDuration > 0;
    }

    function normalizeLoopTime(time, loopDuration = masterLoopDuration) {
        if (loopDuration <= 0) return Math.max(0, time);
        return ((time % loopDuration) + loopDuration) % loopDuration;
    }

    function getMasterPhase(referenceTime = nowSeconds()) {
        if (!hasMasterLoop()) return 0;
        return normalizeLoopTime(referenceTime - masterLoopStartTime);
    }

    function getSlotClipDuration(slot) {
        if (slot.events.length === 0) return 0;
        return Math.max(
            MIN_LOOP_DURATION,
            slot.events.reduce((maxTime, event) => Math.max(maxTime, event.time), 0) + 0.25
        );
    }

    function refreshMasterLoopState() {
        if (slots.some((slot) => slot.events.length > 0)) return;
        masterLoopDuration = 0;
        masterLoopStartTime = 0;
    }

    function disposeSlotInstrument(slot) {
        if (!slot.instrumentBundle) return;

        disposeLofiChain(slot.instrumentBundle.lofiVibrato, slot.instrumentBundle.lofiFilter);
        if (slot.instrumentBundle.instrument && typeof slot.instrumentBundle.instrument.dispose === 'function') {
            slot.instrumentBundle.instrument.dispose();
        }
        slot.instrumentBundle = null;
    }

    function getSlotInstrument(slot) {
        return slot.instrumentBundle?.instrument ?? null;
    }

    function updateSlotButton(slot) {
        const isRecording = slot.state === 'recording';
        const isPlaying = slot.state === 'playing';
        const hasClip = slot.events.length > 0;

        slot.button.classList.toggle('is-recording', isRecording);
        slot.button.classList.toggle('is-playing', isPlaying);
        slot.button.classList.toggle('has-clip', hasClip);
        slot.button.setAttribute('aria-pressed', String(isRecording || isPlaying));
        slot.button.dataset.state = slot.state;

        const status = slot.button.querySelector('.record-slot-status');
        if (status) {
            status.textContent = isRecording ? 'REC' : isPlaying ? 'PLAY' : hasClip ? 'READY' : 'REC';
        }
    }

    function updateAllButtons() {
        for (const slot of slots) {
            updateSlotButton(slot);
        }
    }

    function forgetPlaybackTimer(slot, timer) {
        const index = slot.playbackTimers.indexOf(timer);
        if (index >= 0) {
            slot.playbackTimers.splice(index, 1);
        }
    }

    function stopScheduledPlayback(slot) {
        for (const timer of slot.playbackTimers) {
            clearTimeout(timer);
        }
        slot.playbackTimers.length = 0;

        if (slot.playbackEndTimer !== null) {
            clearInterval(slot.playbackEndTimer);
            slot.playbackEndTimer = null;
        }
    }

    function attackPlaybackPianoMidi(slot, midi) {
        const instrument = getSlotInstrument(slot);
        if (!instrument || !supportsHeldNotes(slot.soundType) || slot.playbackPianoNotes.has(midi)) return;

        const note = Tone.Frequency(midi, 'midi').toNote();
        const startTime = getTriggerTime();
        instrument.triggerAttack(note, startTime);
        slot.playbackPianoNotes.set(midi, { note, startTime });
    }

    function releasePlaybackPianoMidi(slot, midi) {
        const instrument = getSlotInstrument(slot);
        if (!instrument) return;

        const state = slot.playbackPianoNotes.get(midi);
        if (!state) return;

        const now = getTriggerTime();
        const heldFor = now - state.startTime;
        const releaseTime = heldFor < tapDuration
            ? now + (tapDuration - heldFor)
            : now;

        instrument.triggerRelease(state.note, releaseTime);
        slot.playbackPianoNotes.delete(midi);
    }

    function stopPlayback(slot) {
        stopScheduledPlayback(slot);

        for (const midi of Array.from(slot.playbackPianoNotes.keys())) {
            releasePlaybackPianoMidi(slot, midi);
        }

        releasePlaybackVisuals();
        slot.state = slot.events.length > 0 ? 'ready' : 'empty';
        updateSlotButton(slot);
    }

    function clearSlot(slot) {
        stopScheduledPlayback(slot);

        for (const midi of Array.from(slot.playbackPianoNotes.keys())) {
            releasePlaybackPianoMidi(slot, midi);
        }

        if (recordingSlot === slot) {
            recordingSlot = null;
        }

        releasePlaybackVisuals();
        disposeSlotInstrument(slot);
        slot.events = [];
        slot.state = 'empty';
        slot.playbackLoopDuration = 0;
        refreshMasterLoopState();
        updateSlotButton(slot);
    }

    function stopRecording(slot) {
        if (recordingSlot === slot) {
            recordingSlot = null;
        }

        if (!hasMasterLoop() && slot.events.length > 0) {
            masterLoopDuration = Math.max(MIN_LOOP_DURATION, nowSeconds() - slot.recordingStartTime);
            masterLoopStartTime = slot.recordingStartTime;
            slot.playbackLoopDuration = masterLoopDuration;
        }

        slot.state = slot.events.length > 0 ? 'ready' : 'empty';
        updateSlotButton(slot);
    }

    function startRecording(slot) {
        if (recordingSlot && recordingSlot !== slot) {
            stopRecording(recordingSlot);
        }

        if (slot.state === 'playing') {
            stopPlayback(slot);
        }

        slot.events = [];
        slot.soundType = getCurrentSound();
        slot.recordingStartTime = nowSeconds();
        slot.state = 'recording';
        recordingSlot = slot;
        updateAllButtons();
    }

    function recordEvent(event) {
        if (!recordingSlot) return;

        const eventTime = hasMasterLoop()
            ? getMasterPhase()
            : nowSeconds() - recordingSlot.recordingStartTime;

        recordingSlot.events.push({
            ...event,
            time: eventTime
        });
        updateSlotButton(recordingSlot);
    }

    function playScheduledEvent(slot, event) {
        if (event.type === 'note-on') {
            playVisualFeedback('playback', event.midi, event.ringX, event.ringY);
            triggerPlaybackNoteOn(event.midi, !!event.sustained);

            if (supportsHeldNotes(slot.soundType) && event.sustained) {
                attackPlaybackPianoMidi(slot, event.midi);
            } else {
                playMidiWithInstrument(getSlotInstrument(slot), slot.soundType, event.midi);
            }
        } else if (event.type === 'note-off') {
            highlightKey('playback', event.midi, false);
            releasePlaybackVisuals(event.midi);
            if (supportsHeldNotes(slot.soundType)) {
                releasePlaybackPianoMidi(slot, event.midi);
            }
        }
    }

    function schedulePlaybackEvent(slot, event) {
        if (slot.state !== 'playing') return;

        const loopDuration = hasMasterLoop() ? masterLoopDuration : slot.playbackLoopDuration;
        if (loopDuration <= 0) return;

        const phase = hasMasterLoop() ? getMasterPhase() : 0;
        let delaySeconds = normalizeLoopTime(event.time, loopDuration) - phase;
        if (delaySeconds <= LOOP_EVENT_EPSILON) {
            delaySeconds += loopDuration;
        }

        const timer = setTimeout(() => {
            forgetPlaybackTimer(slot, timer);
            if (slot.state !== 'playing') return;
            playScheduledEvent(slot, event);
            schedulePlaybackEvent(slot, event);
        }, Math.max(0, delaySeconds * 1000));

        slot.playbackTimers.push(timer);
    }

    function schedulePlaybackLoopPass(slot) {
        if (slot.state !== 'playing') return;

        for (const event of slot.events) {
            schedulePlaybackEvent(slot, event);
        }

        const loopDuration = hasMasterLoop() ? masterLoopDuration : slot.playbackLoopDuration;
        slot.playbackEndTimer = setInterval(() => {
            if (slot.state !== 'playing') return;
            for (const midi of Array.from(slot.playbackPianoNotes.keys())) {
                releasePlaybackPianoMidi(slot, midi);
            }
        }, Math.max(MIN_LOOP_DURATION, loopDuration) * 1000);
    }

    async function startPlayback(slot) {
        if (slot.events.length === 0 || slot.state === 'recording') return;

        try {
            await initAudio();
            disposeSlotInstrument(slot);
            slot.instrumentBundle = await createInstrumentInstance(slot.soundType);
        } catch (err) {
            console.error('Record slot playback init failed:', err);
            return;
        }

        slot.state = 'playing';
        slot.playbackLoopDuration = hasMasterLoop()
            ? masterLoopDuration
            : getSlotClipDuration(slot);
        updateSlotButton(slot);
        schedulePlaybackLoopPass(slot);
    }

    async function triggerSlot(index) {
        const slot = slots[index];
        if (!slot) return;

        if (slot.state === 'recording') {
            stopRecording(slot);
            return;
        }

        if (slot.state === 'playing') {
            clearSlot(slot);
            return;
        }

        if (slot.events.length > 0) {
            await startPlayback(slot);
            return;
        }

        startRecording(slot);
    }

    function stopAll() {
        if (recordingSlot) {
            stopRecording(recordingSlot);
        }

        for (const slot of slots) {
            if (slot.state === 'playing') {
                stopPlayback(slot);
            }
        }
    }

    function bind() {
        buttons.forEach((button, index) => {
            button.addEventListener('click', () => {
                void triggerSlot(index);
            });
        });
        updateAllButtons();
    }

    return {
        bind,
        recordEvent,
        stopAll,
        triggerSlot
    };
}
