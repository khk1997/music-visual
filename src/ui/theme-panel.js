export function createThemePanelController({
    themes,
    themePanel,
    themeList,
    themePreviewTitle,
    themePreviewDescription,
    themePreviewMedia,
    backgroundToggleButton,
    getCurrentBackgroundIndex,
    setCurrentBackgroundIndex,
    getHoveredThemeIndex,
    setHoveredThemeIndex,
    getThemePanelActiveIndex,
    setThemePanelActiveIndexState,
    getThemeDragState,
    setThemeDragState,
    getSuppressThemeClickUntil,
    setSuppressThemeClickUntil,
    getIsThemeSelectionTransitioning,
    setIsThemeSelectionTransitioning,
    getHasConfirmedThemeSelectionInCurrentFlow,
    setHasConfirmedThemeSelectionInCurrentFlow,
    getCurrentScreen,
    getIsFreePlayThemeSelection,
    themeSelectionTransitionTimers,
    getCurrentTheme,
    onThemeConfirm,
    onApplyTheme,
    onTransitionSound
}) {
    function getThemePanelPreviewIndex() {
        return getHoveredThemeIndex() === null ? getThemePanelActiveIndex() : getHoveredThemeIndex();
    }

    function updateThemeListVisuals(activeIndex) {
        if (!themeList) return;
        const themeButtons = themeList.querySelectorAll('.theme-list-item');

        for (const button of themeButtons) {
            const buttonIndex = Number(button.dataset.themeIndex);
            const offset = buttonIndex - activeIndex;
            const absOffset = Math.abs(offset);
            const clampedOffset = Math.max(-3, Math.min(3, offset));
            const translateY = clampedOffset * 96;
            const rotateX = clampedOffset * -16;
            const scale = 1 - Math.min(absOffset, 3) * 0.08;
            const opacity = absOffset === 0
                ? 1
                : absOffset === 1
                    ? 0.78
                    : absOffset === 2
                        ? 0.32
                        : 0.08;

            button.style.transform = `translateY(${translateY}px) rotateX(${rotateX}deg) scale(${scale})`;
            button.style.opacity = String(absOffset > 3 ? 0 : opacity);
            button.style.filter = absOffset === 0
                ? 'brightness(1.03)'
                : `blur(${Math.min(absOffset, 3) * 0.65}px) brightness(${1 - Math.min(absOffset, 3) * 0.08})`;
            button.style.zIndex = String(30 - Math.min(absOffset, 30));
            button.classList.toggle('is-faded', absOffset > 2);
            button.classList.toggle('is-active', buttonIndex === activeIndex);
            button.parentElement?.style.setProperty('z-index', String(30 - Math.min(absOffset, 30)));
        }
    }

    function setThemePanelActiveIndex(index, options = {}) {
        const { syncHover = true } = options;
        const boundedIndex = Math.max(0, Math.min(themes.length - 1, index));
        setThemePanelActiveIndexState(boundedIndex);
        if (syncHover) {
            setHoveredThemeIndex(null);
        }
        updateThemePanelSelection();
    }

    function updateThemePanelSelection() {
        const currentTheme = getCurrentTheme();
        const previewIndex = getThemePanelPreviewIndex();
        const previewTheme = themes[(previewIndex + themes.length) % themes.length];
        backgroundToggleButton.textContent = `Theme: ${currentTheme.label}`;

        if (themePreviewTitle) {
            themePreviewTitle.textContent = previewTheme.label;
        }
        if (themePreviewDescription) {
            themePreviewDescription.textContent = previewTheme.description || 'Theme preview';
        }
        if (themePreviewMedia) {
            themePreviewMedia.style.background = previewTheme.previewBackground || '';
        }

        if (!themeList || getIsThemeSelectionTransitioning()) return;
        const themeButtons = themeList.querySelectorAll('.theme-list-item');
        const shouldShowSelected = !(getCurrentScreen() === 'free-play'
            && getIsFreePlayThemeSelection()
            && !getHasConfirmedThemeSelectionInCurrentFlow());
        for (const button of themeButtons) {
            const buttonIndex = Number(button.dataset.themeIndex);
            button.classList.toggle('is-selected', shouldShowSelected && buttonIndex === getCurrentBackgroundIndex());
        }
        updateThemeListVisuals(previewIndex);
    }

    function closeThemePanel() {
        if (!themePanel) return;
        themePanel.classList.remove('is-open');
        themePanel.setAttribute('aria-hidden', 'true');
        backgroundToggleButton.classList.remove('is-active');
        setHoveredThemeIndex(null);
        setThemeDragState(null);
        updateThemePanelSelection();
    }

    function clearThemeSelectionTransitionTimers() {
        while (themeSelectionTransitionTimers.length) {
            clearTimeout(themeSelectionTransitionTimers.pop());
        }
    }

    function resetThemeSelectionVisualState() {
        clearThemeSelectionTransitionTimers();
        setIsThemeSelectionTransitioning(false);
        if (!themePanel) return;
        themePanel.classList.remove('is-transitioning', 'is-exiting');
        if (!themeList) return;
        const themeButtons = themeList.querySelectorAll('.theme-list-item');
        for (const button of themeButtons) {
            button.classList.remove('is-selected', 'is-muted', 'is-active', 'is-faded');
            button.style.removeProperty('transform');
            button.style.removeProperty('opacity');
            button.style.removeProperty('filter');
            button.style.removeProperty('z-index');
        }
    }

    function startThemeSelectionTransition(index) {
        if (!themePanel || !themeList || getIsThemeSelectionTransitioning()) return;
        const themeButtons = Array.from(themeList.querySelectorAll('.theme-list-item'));
        if (themeButtons.length === 0) return;

        onTransitionSound();

        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }

        for (const button of themeButtons) {
            const buttonIndex = Number(button.dataset.themeIndex);
            button.classList.toggle('is-selected', buttonIndex === index);
            button.classList.toggle('is-muted', buttonIndex !== index);
        }

        setIsThemeSelectionTransitioning(true);
        setHasConfirmedThemeSelectionInCurrentFlow(true);
        setHoveredThemeIndex(null);
        themePanel.classList.add('is-transitioning');
        onApplyTheme(index);

        themeSelectionTransitionTimers.push(window.setTimeout(() => {
            if (!themePanel) return;
            themePanel.classList.add('is-exiting');
        }, 300));

        themeSelectionTransitionTimers.push(window.setTimeout(() => {
            resetThemeSelectionVisualState();
            onThemeConfirm();
        }, 760));
    }

    function openThemePanel() {
        if (!themePanel) return;
        themePanel.classList.add('is-open');
        themePanel.setAttribute('aria-hidden', 'false');
        backgroundToggleButton.classList.add('is-active');
        setThemePanelActiveIndexState(getCurrentBackgroundIndex());
        setHoveredThemeIndex(null);
        updateThemePanelSelection();
    }

    function setupThemePanel() {
        if (!themeList) return;
        themeList.innerHTML = '';

        const handleThemeDragMove = (clientY) => {
            const themeDragState = getThemeDragState();
            if (!themeDragState) return;
            const deltaY = clientY - themeDragState.startY;
            const nextIndex = Math.max(
                0,
                Math.min(
                    themes.length - 1,
                    themeDragState.startIndex - Math.round(deltaY / 86)
                )
            );

            if (nextIndex !== getThemePanelActiveIndex()) {
                setThemePanelActiveIndexState(nextIndex);
                setHoveredThemeIndex(null);
                updateThemePanelSelection();
            }

            if (Math.abs(deltaY) > 10) {
                themeDragState.dragged = true;
            }
        };

        themeList.addEventListener('pointerdown', (event) => {
            if (!(event.target instanceof HTMLElement)) return;
            const targetButton = event.target.closest('.theme-list-item');
            if (!targetButton) return;

            setThemeDragState({
                pointerId: event.pointerId,
                startY: event.clientY,
                startIndex: getThemePanelActiveIndex(),
                dragged: false,
                targetIndex: Number(targetButton.dataset.themeIndex ?? -1),
                targetWasActive: targetButton.classList.contains('is-active')
            });
            themeList.setPointerCapture(event.pointerId);
        });

        themeList.addEventListener('pointermove', (event) => {
            const themeDragState = getThemeDragState();
            if (!themeDragState || themeDragState.pointerId !== event.pointerId) return;
            handleThemeDragMove(event.clientY);
        });

        const finishThemeDrag = (event) => {
            const themeDragState = getThemeDragState();
            if (!themeDragState || themeDragState.pointerId !== event.pointerId) return;

            if (themeDragState.dragged) {
                setSuppressThemeClickUntil(performance.now() + 180);
            } else if (
                themeDragState.targetIndex >= 0
                && performance.now() >= getSuppressThemeClickUntil()
            ) {
                if (!themeDragState.targetWasActive || getThemePanelActiveIndex() !== themeDragState.targetIndex) {
                    setThemePanelActiveIndex(themeDragState.targetIndex);
                } else {
                    startThemeSelectionTransition(themeDragState.targetIndex);
                }
            }
            if (themeList.hasPointerCapture(event.pointerId)) {
                themeList.releasePointerCapture(event.pointerId);
            }
            setThemeDragState(null);
        };

        themeList.addEventListener('pointerup', finishThemeDrag);
        themeList.addEventListener('pointercancel', finishThemeDrag);
        themeList.addEventListener('wheel', (event) => {
            event.preventDefault();
            if (getIsThemeSelectionTransitioning()) return;

            const direction = event.deltaY > 0 ? 1 : -1;
            if (direction === 0) return;

            const nextIndex = Math.max(
                0,
                Math.min(themes.length - 1, getThemePanelActiveIndex() + direction)
            );

            if (nextIndex !== getThemePanelActiveIndex()) {
                setThemePanelActiveIndexState(nextIndex);
                setHoveredThemeIndex(null);
                updateThemePanelSelection();
            }
        }, { passive: false });

        themes.forEach((theme, index) => {
            const item = document.createElement('li');
            item.className = 'theme-list-slot';
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'theme-list-item';
            button.dataset.themeIndex = String(index);
            button.textContent = theme.label;
            button.addEventListener('focus', () => {
                setThemePanelActiveIndex(index);
            });
            button.addEventListener('blur', () => {
                setHoveredThemeIndex(null);
                updateThemePanelSelection();
            });
            item.appendChild(button);
            themeList.appendChild(item);
        });

        setThemePanelActiveIndexState(getCurrentBackgroundIndex());
        updateThemePanelSelection();
    }

    function applyBackgroundTheme(index) {
        const nextIndex = (index + themes.length) % themes.length;
        setCurrentBackgroundIndex(nextIndex);
        onApplyTheme(nextIndex);
        updateThemePanelSelection();
    }

    return {
        applyBackgroundTheme,
        closeThemePanel,
        openThemePanel,
        resetThemeSelectionVisualState,
        setThemePanelActiveIndex,
        setupThemePanel,
        updateThemePanelSelection
    };
}
