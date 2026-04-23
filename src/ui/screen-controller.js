export function createScreenController({
    modeScreen,
    playbackScreen,
    bottomUi,
    absolutePitchUi,
    backgroundToggleButton,
    recordToggleButton,
    playbackToggleButton,
    modeStatus,
    modePanel,
    modeCards,
    getCurrentScreen,
    setCurrentScreen,
    getIsFreePlayThemeSelection,
    setIsFreePlayThemeSelection,
    setHasConfirmedThemeSelectionInCurrentFlow,
    getIsRecording,
    stopRecording,
    getIsPlaybackActive,
    stopPlayback,
    absolutePitch,
    themePanelController,
    modeTransitionTimers,
    getIsModeTransitioning,
    setIsModeTransitioning,
    onModeTransitionSound
}) {
    function resetModeTransitionState() {
        while (modeTransitionTimers.length) {
            clearTimeout(modeTransitionTimers.pop());
        }

        setIsModeTransitioning(false);
        modePanel.classList.remove('is-transitioning', 'is-exiting');
        for (const card of modeCards) {
            card.classList.remove('is-selected', 'is-muted');
        }
    }

    function setScreen(nextScreen, options = {}) {
        const { skipThemeSelection = false, forceThemeSelection = false } = options;
        const previousScreen = getCurrentScreen();
        setCurrentScreen(nextScreen);

        const isHome = nextScreen === 'home';
        const isFreePlay = nextScreen === 'free-play';
        const isAbsolutePitch = nextScreen === 'absolute-pitch';
        const isExperienceScreen = isFreePlay || isAbsolutePitch;
        const enteringFreePlay = isFreePlay && previousScreen !== 'free-play';

        if (isFreePlay) {
            const needsThemeSelection = forceThemeSelection || (enteringFreePlay && !skipThemeSelection);
            setIsFreePlayThemeSelection(needsThemeSelection);
            if (needsThemeSelection) {
                setHasConfirmedThemeSelectionInCurrentFlow(false);
            }
        } else {
            setIsFreePlayThemeSelection(false);
            setHasConfirmedThemeSelectionInCurrentFlow(false);
        }

        if (getIsFreePlayThemeSelection()) {
            if (getIsRecording()) stopRecording();
            if (getIsPlaybackActive()) stopPlayback();
        }

        if (!isFreePlay) {
            if (getIsRecording()) stopRecording();
            if (getIsPlaybackActive()) stopPlayback();
        }

        if (!isAbsolutePitch) {
            absolutePitch.updateIdleState();
            absolutePitch.resetIntro();
        }

        if (isHome) {
            resetModeTransitionState();
        }

        if (getIsFreePlayThemeSelection() || !isFreePlay) {
            themePanelController.resetThemeSelectionVisualState();
        }

        modeScreen.classList.toggle('hidden', !isHome);
        playbackScreen.classList.toggle('active', isExperienceScreen);
        playbackScreen.classList.toggle('theme-selecting', isFreePlay && getIsFreePlayThemeSelection());
        bottomUi.classList.toggle('hidden', !isFreePlay || getIsFreePlayThemeSelection());
        absolutePitchUi.classList.toggle('active', isAbsolutePitch);
        backgroundToggleButton.classList.toggle('ui-hidden', !isFreePlay || getIsFreePlayThemeSelection());
        recordToggleButton.classList.toggle('ui-hidden', !isFreePlay || getIsFreePlayThemeSelection());
        playbackToggleButton.classList.toggle('ui-hidden', !isFreePlay || getIsFreePlayThemeSelection());

        if (!isFreePlay) {
            themePanelController.closeThemePanel();
        } else if (getIsFreePlayThemeSelection()) {
            themePanelController.openThemePanel();
        } else {
            themePanelController.closeThemePanel();
        }

        modeStatus.textContent = getIsFreePlayThemeSelection()
            ? 'Select Theme'
            : isAbsolutePitch
                ? 'Perfect Pitch'
                : 'Free Play';
        document.body.style.cursor = isFreePlay && !getIsFreePlayThemeSelection() ? 'crosshair' : 'default';
        themePanelController.updateThemePanelSelection();
    }

    function transitionFromHome(selectedCard, nextScreen) {
        if (getIsModeTransitioning() || getCurrentScreen() !== 'home') return;

        setIsModeTransitioning(true);
        onModeTransitionSound();
        modePanel.classList.add('is-transitioning');

        for (const card of modeCards) {
            card.classList.toggle('is-selected', card === selectedCard);
            card.classList.toggle('is-muted', card !== selectedCard);
        }

        modeTransitionTimers.push(window.setTimeout(() => {
            modePanel.classList.add('is-exiting');
        }, 300));

        modeTransitionTimers.push(window.setTimeout(() => {
            setScreen(nextScreen);
            while (modeTransitionTimers.length) {
                clearTimeout(modeTransitionTimers.pop());
            }
            setIsModeTransitioning(false);
        }, 760));
    }

    return {
        resetModeTransitionState,
        setScreen,
        transitionFromHome
    };
}
