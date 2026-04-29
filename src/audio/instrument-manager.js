import {
    BIG_BEN_SAMPLE_CONFIG,
    HARP_SAMPLE_CONFIG,
    INSTRUMENT_VOLUMES,
    LOW_LATENCY_CONFIG,
    PIANO_RELEASE,
    PIANO_SAMPLE_CONFIG
} from '../core/config.js';

export function createInstrumentManager({
    soundSelect,
    onStopLiveInput
}) {
    let instrument = null;
    let reverb = null;
    let limiter = null;
    let audioStarted = false;
    let currentSound = 'synth';
    let isInstrumentLoading = false;
    let instrumentSwitchToken = 0;
    let lofiVibrato = null;
    let lofiFilter = null;
    let uiClickSynth = null;

    function getInstrument() {
        return instrument;
    }

    function getCurrentSound() {
        return currentSound;
    }

    function getIsInstrumentLoading() {
        return isInstrumentLoading;
    }

    function getToneContext() {
        if (typeof Tone.getContext === 'function') return Tone.getContext();
        return Tone.context;
    }

    function applyLowLatencyMode() {
        const toneContext = getToneContext();
        if (toneContext) {
            toneContext.lookAhead = LOW_LATENCY_CONFIG.lookAhead;
            toneContext.updateInterval = LOW_LATENCY_CONFIG.updateInterval;
        }
    }

    function getTriggerTime() {
        if (typeof Tone.immediate === 'function') {
            return Tone.immediate();
        }
        return Tone.now();
    }

    function supportsHeldNotes(soundType) {
        return soundType === 'piano'
            || soundType === 'chiptune_lead'
            || soundType === 'saw_lead';
    }

    function ensureUiClickSynth() {
        if (uiClickSynth) return uiClickSynth;

        uiClickSynth = new Tone.Synth({
            oscillator: {
                type: 'triangle'
            },
            envelope: {
                attack: 0.002,
                decay: 0.07,
                sustain: 0,
                release: 0.08
            }
        }).connect(limiter);

        uiClickSynth.volume.value = -14;
        return uiClickSynth;
    }

    async function playModeCardClickSound() {
        try {
            if (!audioStarted) {
                await initAudio();
            }

            const clickSynth = ensureUiClickSynth();
            const triggerTime = getTriggerTime();
            clickSynth.triggerAttackRelease('E5', 0.09, triggerTime);
            clickSynth.triggerAttackRelease('B5', 0.07, triggerTime + 0.045);
        } catch (err) {
            console.error('Mode card click sound failed:', err);
        }
    }

    async function playBackHomeClickSound() {
        try {
            if (!audioStarted) {
                await initAudio();
            }

            const clickSynth = ensureUiClickSynth();
            const triggerTime = getTriggerTime();
            clickSynth.triggerAttackRelease('D6', 0.045, triggerTime, 0.7);
            clickSynth.triggerAttackRelease('A5', 0.055, triggerTime + 0.032, 0.62);
            clickSynth.triggerAttackRelease('E5', 0.1, triggerTime + 0.078, 0.82);
        } catch (err) {
            console.error('Back home click sound failed:', err);
        }
    }

    function applyInstrumentVolumeTo(targetInstrument, type) {
        if (!targetInstrument || !targetInstrument.volume) return;
        targetInstrument.volume.value = INSTRUMENT_VOLUMES[type] ?? 0;
    }

    function disposeLofiChain(vibratoRef, filterRef) {
        if (vibratoRef && typeof vibratoRef.dispose === 'function') {
            vibratoRef.dispose();
        }
        if (filterRef && typeof filterRef.dispose === 'function') {
            filterRef.dispose();
        }
    }

    function setInstrumentLoadingState(loading) {
        isInstrumentLoading = loading;
        soundSelect.disabled = loading;
    }

    function swapCurrentInstrument(created, type) {
        const previousInstrument = instrument;
        const previousLofiVibrato = lofiVibrato;
        const previousLofiFilter = lofiFilter;

        instrument = created.instrument;
        lofiVibrato = created.lofiVibrato;
        lofiFilter = created.lofiFilter;
        currentSound = type;

        disposeLofiChain(previousLofiVibrato, previousLofiFilter);
        if (previousInstrument && typeof previousInstrument.dispose === 'function') {
            previousInstrument.dispose();
        }
    }

    async function createInstrumentInstance(type) {
        let nextInstrument = null;
        let nextLofiVibrato = null;
        let nextLofiFilter = null;

        if (type === 'piano') {
            nextInstrument = new Tone.Sampler({
                urls: PIANO_SAMPLE_CONFIG.urls,
                baseUrl: PIANO_SAMPLE_CONFIG.baseUrl,
                release: PIANO_RELEASE
            }).connect(reverb);

            await Tone.loaded();
        }
        else if (type === 'harp') {
            nextInstrument = new Tone.Sampler({
                urls: HARP_SAMPLE_CONFIG.urls,
                baseUrl: HARP_SAMPLE_CONFIG.baseUrl
            }).connect(reverb);

            await Tone.loaded();
        }
        else if (type === 'big_ben') {
            nextInstrument = new Tone.Sampler({
                urls: BIG_BEN_SAMPLE_CONFIG.urls,
                baseUrl: BIG_BEN_SAMPLE_CONFIG.baseUrl,
                release: 4.0
            });

            if (nextInstrument.detune) {
                nextInstrument.detune.value = 400;
            }

            nextLofiFilter = new Tone.Compressor({
                threshold: -22,
                ratio: 10,
                attack: 0.003,
                release: 0.28
            });

            nextInstrument.chain(nextLofiFilter, limiter);

            await Tone.loaded();
        }
        else if (type === 'synth') {
            nextInstrument = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: 'triangle' },
                envelope: {
                    attack: 0.005,
                    decay: 0.1,
                    sustain: 0.3,
                    release: 1.2
                }
            }).connect(reverb);
        }
        else if (type === 'bell') {
            nextInstrument = new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: 8,
                modulationIndex: 12,
                envelope: {
                    attack: 0.001,
                    decay: 1.2,
                    sustain: 0,
                    release: 1.5
                },
                modulation: {
                    type: 'sine'
                },
                modulationEnvelope: {
                    attack: 0.002,
                    decay: 0.3,
                    sustain: 0,
                    release: 0.8
                }
            }).connect(reverb);
        }
        else if (type === 'pluck') {
            nextInstrument = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: 'triangle' },
                envelope: {
                    attack: 0.001,
                    decay: 0.16,
                    sustain: 0.0,
                    release: 0.1
                }
            }).connect(reverb);
        }
        else if (type === 'chiptune_lead') {
            nextInstrument = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: 'square' },
                envelope: {
                    attack: 0.002,
                    decay: 0.08,
                    sustain: 0.45,
                    release: 0.12
                }
            }).connect(reverb);
        }
        else if (type === 'saw_lead') {
            nextInstrument = new Tone.PolySynth(Tone.Synth, {
                oscillator: { type: 'sawtooth' },
                envelope: {
                    attack: 0.01,
                    decay: 0.22,
                    sustain: 0.14,
                    release: 0.16
                }
            }).connect(reverb);
        }
        else if (type === 'lofi_ep') {
            nextInstrument = new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: 1.5,
                modulationIndex: 3.5,
                detune: 0,
                oscillator: { type: 'triangle' },
                envelope: {
                    attack: 0.015,
                    decay: 0.35,
                    sustain: 0.28,
                    release: 1.1
                },
                modulation: { type: 'sine' },
                modulationEnvelope: {
                    attack: 0.02,
                    decay: 0.2,
                    sustain: 0.0,
                    release: 0.6
                }
            });

            nextLofiVibrato = new Tone.Vibrato({
                frequency: 4.2,
                depth: 0.08,
                type: 'sine'
            });
            nextLofiFilter = new Tone.Filter({
                type: 'lowpass',
                frequency: 3600,
                rolloff: -24,
                Q: 0.8
            });

            nextInstrument.chain(nextLofiVibrato, nextLofiFilter, reverb);
        }

        applyInstrumentVolumeTo(nextInstrument, type);
        return {
            instrument: nextInstrument,
            lofiVibrato: nextLofiVibrato,
            lofiFilter: nextLofiFilter
        };
    }

    async function createInstrument(type) {
        const created = await createInstrumentInstance(type);
        swapCurrentInstrument(created, type);
    }

    async function initAudio() {
        if (audioStarted) return;

        await Tone.start();
        applyLowLatencyMode();

        limiter = new Tone.Limiter(-1).toDestination();
        reverb = new Tone.Reverb({
            decay: 2.5,
            wet: 0.3
        }).connect(limiter);

        await createInstrument(currentSound);
        audioStarted = true;
    }

    async function switchInstrument(type) {
        const switchToken = ++instrumentSwitchToken;
        onStopLiveInput?.();
        setInstrumentLoadingState(true);

        try {
            await createInstrument(type);
        } catch (err) {
            console.error('Failed to switch instrument:', err);
            soundSelect.value = currentSound;
        } finally {
            if (switchToken === instrumentSwitchToken) {
                setInstrumentLoadingState(false);
            }
        }
    }

    function bindSoundSelect() {
        soundSelect.addEventListener('change', async () => {
            if (!audioStarted) return;
            await switchInstrument(soundSelect.value);
        });
    }

    function playMidiWithInstrument(targetInstrument, soundType, midi) {
        if (!targetInstrument || isInstrumentLoading) return;
        const note = Tone.Frequency(midi, 'midi').toNote();
        const triggerTime = getTriggerTime();

        if (soundType === 'piano') {
            targetInstrument.triggerAttackRelease(note, 1.4, triggerTime);
        } else if (soundType === 'big_ben') {
            targetInstrument.triggerAttackRelease(note, 3.5, triggerTime);
        } else if (soundType === 'harp') {
            targetInstrument.triggerAttackRelease(note, 2.0, triggerTime);
        } else if (soundType === 'bell') {
            targetInstrument.triggerAttackRelease(note, '2n', triggerTime);
        } else if (soundType === 'pluck') {
            targetInstrument.triggerAttackRelease(note, '16n', triggerTime);
        } else if (soundType === 'chiptune_lead') {
            targetInstrument.triggerAttackRelease(note, '16n', triggerTime);
        } else if (soundType === 'saw_lead') {
            targetInstrument.triggerAttackRelease(note, '8n', triggerTime);
        } else if (soundType === 'lofi_ep') {
            targetInstrument.triggerAttackRelease(note, '4n', triggerTime);
        } else {
            targetInstrument.triggerAttackRelease(note, '8n', triggerTime);
        }
    }

    function playMidi(midi) {
        playMidiWithInstrument(instrument, currentSound, midi);
    }

    return {
        bindSoundSelect,
        createInstrumentInstance,
        disposeLofiChain,
        getCurrentSound,
        getInstrument,
        getIsInstrumentLoading,
        getTriggerTime,
        initAudio,
        playBackHomeClickSound,
        playMidi,
        playMidiWithInstrument,
        playModeCardClickSound,
        supportsHeldNotes,
        switchInstrument
    };
}
