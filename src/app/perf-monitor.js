const STATUS_COLORS = {
    good: '#8df7c5',
    warning: '#ffd36e',
    heavy: '#ff7f96',
    neutral: '#ffffff'
};

function formatNumber(value, digits = 0) {
    if (!Number.isFinite(value)) return '-';
    return value.toFixed(digits);
}

function getSeverityColor(severity) {
    return STATUS_COLORS[severity] ?? STATUS_COLORS.neutral;
}

function getMetricSeverity(value, thresholds, inverse = false) {
    if (!Number.isFinite(value)) return 'neutral';

    if (inverse) {
        if (value <= thresholds.good) return 'good';
        if (value <= thresholds.warning) return 'warning';
        return 'heavy';
    }

    if (value >= thresholds.good) return 'good';
    if (value >= thresholds.warning) return 'warning';
    return 'heavy';
}

export function createPerfMonitor({
    renderer,
    getThemeLabel,
    getPixelRatio,
    getStateSnapshot
}) {
    let visible = false;
    let frameCount = 0;
    let fps = 0;
    let lastFpsSampleAt = performance.now();
    let lastPanelUpdateAt = 0;
    let lastFrameTime = 0;

    const panel = document.createElement('aside');
    panel.setAttribute('aria-live', 'off');
    panel.style.position = 'fixed';
    panel.style.top = 'max(14px, env(safe-area-inset-top, 0px) + 14px)';
    panel.style.right = 'max(14px, env(safe-area-inset-right, 0px) + 14px)';
    panel.style.zIndex = '1000';
    panel.style.minWidth = '220px';
    panel.style.maxWidth = '260px';
    panel.style.padding = '12px 14px';
    panel.style.borderRadius = '16px';
    panel.style.border = '1px solid rgba(255,255,255,0.16)';
    panel.style.background = 'rgba(7, 11, 18, 0.84)';
    panel.style.backdropFilter = 'blur(14px)';
    panel.style.boxShadow = '0 14px 34px rgba(0,0,0,0.34)';
    panel.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    panel.style.color = '#eef7ff';
    panel.style.pointerEvents = 'none';
    panel.style.userSelect = 'none';
    panel.style.display = visible ? 'block' : 'none';

    const title = document.createElement('div');
    title.textContent = 'Performance';
    title.style.marginBottom = '10px';
    title.style.fontSize = '11px';
    title.style.letterSpacing = '0.18em';
    title.style.textTransform = 'uppercase';
    title.style.color = 'rgba(255,255,255,0.68)';
    panel.appendChild(title);

    const statusRow = document.createElement('div');
    statusRow.style.display = 'grid';
    statusRow.style.gridTemplateColumns = '1fr auto';
    statusRow.style.gap = '10px';
    statusRow.style.alignItems = 'baseline';
    statusRow.style.padding = '0 0 9px';
    statusRow.style.marginBottom = '4px';
    statusRow.style.borderBottom = '1px solid rgba(255,255,255,0.08)';

    const statusLabel = document.createElement('span');
    statusLabel.textContent = 'Status';
    statusLabel.style.fontSize = '11px';
    statusLabel.style.color = 'rgba(255,255,255,0.62)';

    const statusValue = document.createElement('span');
    statusValue.textContent = 'Checking';
    statusValue.style.fontSize = '12px';
    statusValue.style.fontWeight = '700';
    statusValue.style.letterSpacing = '0.04em';
    statusValue.style.color = STATUS_COLORS.neutral;

    statusRow.appendChild(statusLabel);
    statusRow.appendChild(statusValue);
    panel.appendChild(statusRow);

    const rows = new Map();

    function createRow(label) {
        const row = document.createElement('div');
        row.style.display = 'grid';
        row.style.gridTemplateColumns = '1fr auto';
        row.style.gap = '10px';
        row.style.alignItems = 'baseline';
        row.style.padding = '3px 0';

        const key = document.createElement('span');
        key.textContent = label;
        key.style.fontSize = '11px';
        key.style.color = 'rgba(255,255,255,0.62)';

        const value = document.createElement('span');
        value.textContent = '-';
        value.style.fontSize = '12px';
        value.style.color = '#ffffff';

        row.appendChild(key);
        row.appendChild(value);
        panel.appendChild(row);
        rows.set(label, { row, key, value });
    }

    [
        'FPS',
        'Frame',
        'Draw Calls',
        'Triangles',
        'Geometries',
        'Textures',
        'Bars',
        'Sparks',
        'Mists',
        'Jets',
        'Recorded',
        'Playback',
        'Theme',
        'Pixel Ratio',
        'JS Heap'
    ].forEach(createRow);

    const legend = document.createElement('div');
    legend.style.marginTop = '8px';
    legend.style.paddingTop = '7px';
    legend.style.borderTop = '1px solid rgba(255,255,255,0.08)';
    legend.style.fontSize = '10px';
    legend.style.lineHeight = '1.4';
    legend.style.color = 'rgba(255,255,255,0.56)';
    legend.textContent = 'Targets: FPS 55+, Frame <= 16.7ms, Draw Calls < 100';
    panel.appendChild(legend);

    document.body.appendChild(panel);

    function setVisible(nextVisible) {
        visible = nextVisible;
        panel.style.display = visible ? 'block' : 'none';
    }

    function updatePanel(nowMs) {
        if (!visible) return;
        if (nowMs - lastPanelUpdateAt < 250) return;
        lastPanelUpdateAt = nowMs;

        const snapshot = getStateSnapshot();
        const renderInfo = renderer.info.render;
        const memoryInfo = renderer.info.memory;
        const heapMb = performance.memory
            ? performance.memory.usedJSHeapSize / (1024 * 1024)
            : NaN;
        const fpsSeverity = getMetricSeverity(fps, { good: 55, warning: 45 });
        const frameSeverity = getMetricSeverity(lastFrameTime, { good: 16.7, warning: 22 }, true);
        const drawCallSeverity = getMetricSeverity(renderInfo.calls, { good: 100, warning: 300 }, true);
        const heapSeverity = Number.isFinite(heapMb)
            ? getMetricSeverity(heapMb, { good: 140, warning: 220 }, true)
            : 'neutral';

        let overallStatus = 'Good';
        let overallSeverity = 'good';

        if ([fpsSeverity, frameSeverity, drawCallSeverity, heapSeverity].includes('heavy')) {
            overallStatus = 'Heavy';
            overallSeverity = 'heavy';
        } else if ([fpsSeverity, frameSeverity, drawCallSeverity, heapSeverity].includes('warning')) {
            overallStatus = 'Warning';
            overallSeverity = 'warning';
        }

        statusValue.textContent = overallStatus;
        statusValue.style.color = getSeverityColor(overallSeverity);
        panel.style.borderColor = overallSeverity === 'heavy'
            ? 'rgba(255,127,150,0.42)'
            : overallSeverity === 'warning'
            ? 'rgba(255,211,110,0.34)'
            : 'rgba(255,255,255,0.16)';

        function setRow(label, text, severity = 'neutral') {
            const entry = rows.get(label);
            if (!entry) return;
            entry.value.textContent = text;
            entry.value.style.color = getSeverityColor(severity);
        }

        setRow('FPS', formatNumber(fps), fpsSeverity);
        setRow('Frame', `${formatNumber(lastFrameTime, 1)} ms`, frameSeverity);
        setRow('Draw Calls', formatNumber(renderInfo.calls), drawCallSeverity);
        setRow('Triangles', formatNumber(renderInfo.triangles));
        setRow('Geometries', formatNumber(memoryInfo.geometries));
        setRow('Textures', formatNumber(memoryInfo.textures));
        setRow('Bars', formatNumber(snapshot.activeBars));
        setRow('Sparks', formatNumber(snapshot.activeSparks));
        setRow('Mists', formatNumber(snapshot.activeMists));
        setRow('Jets', formatNumber(snapshot.activeJets));
        setRow('Recorded', formatNumber(snapshot.recordedEvents));
        setRow('Playback', snapshot.isPlaybackActive ? 'On' : 'Off', snapshot.isPlaybackActive ? 'warning' : 'good');
        setRow('Theme', getThemeLabel());
        setRow('Pixel Ratio', formatNumber(getPixelRatio(), 2));
        setRow('JS Heap', Number.isFinite(heapMb) ? `${formatNumber(heapMb, 1)} MB` : 'n/a', heapSeverity);
    }

    window.addEventListener('keydown', (event) => {
        if (!event.shiftKey || event.key.toLowerCase() !== 'p') return;

        const target = event.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable) {
            return;
        }

        event.preventDefault();
        setVisible(!visible);
    });

    return {
        sampleFrame(nowMs) {
            frameCount += 1;
            lastFrameTime = nowMs - (this._lastFrameAt ?? nowMs);
            this._lastFrameAt = nowMs;

            const elapsed = nowMs - lastFpsSampleAt;
            if (elapsed >= 500) {
                fps = (frameCount * 1000) / elapsed;
                frameCount = 0;
                lastFpsSampleAt = nowMs;
            }

            updatePanel(nowMs);
        }
    };
}
