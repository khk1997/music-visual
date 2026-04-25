function createThemeId(label) {
    return label
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function defineTheme(theme) {
    return {
        ...theme,
        id: theme.id ?? createThemeId(theme.label)
    };
}

export const BACKGROUND_THEMES = [
    defineTheme({
        label: 'PlayStation Style',
        color: 0x000000,
        exposure: 2.0,
        description: '經典霧化符號背景，亮度高、對比強，適合自由演奏時快速看清互動反饋。',
        previewBackground: 'radial-gradient(circle at 22% 18%, rgba(255,255,255,0.2), transparent 28%), radial-gradient(circle at 76% 70%, rgba(98, 142, 255, 0.24), transparent 34%), linear-gradient(180deg, rgba(30,36,48,0.96), rgba(14,18,26,0.96))'
    }),
    defineTheme({
        label: 'Piano Roll',
        color: 0x03111f,
        exposure: 1.75,
        description: '藍色長條與光暈音軌為主，節奏感更聚焦，適合 piano roll 視覺演出。',
        previewBackground: 'radial-gradient(circle at 70% 24%, rgba(115, 202, 255, 0.2), transparent 34%), radial-gradient(circle at 22% 76%, rgba(40, 124, 210, 0.24), transparent 38%), linear-gradient(180deg, rgba(8, 25, 42, 0.97), rgba(3, 13, 24, 0.97))'
    }),
    defineTheme({
        label: 'theme3',
        color: 0x120f22,
        exposure: 1.6,
        description: 'Theme placeholder 3.',
        previewBackground: 'radial-gradient(circle at 22% 18%, rgba(213, 142, 255, 0.22), transparent 30%), radial-gradient(circle at 74% 68%, rgba(87, 118, 255, 0.2), transparent 34%), linear-gradient(180deg, rgba(22, 16, 40, 0.96), rgba(10, 9, 24, 0.98))'
    }),
    defineTheme({
        label: 'theme4',
        color: 0x101820,
        exposure: 1.55,
        description: 'Theme placeholder 4.',
        previewBackground: 'radial-gradient(circle at 28% 22%, rgba(125, 232, 255, 0.18), transparent 26%), radial-gradient(circle at 78% 74%, rgba(51, 203, 179, 0.16), transparent 34%), linear-gradient(180deg, rgba(16, 28, 37, 0.96), rgba(8, 14, 20, 0.98))'
    }),
    defineTheme({
        label: 'theme5',
        color: 0x22140f,
        exposure: 1.58,
        description: 'Theme placeholder 5.',
        previewBackground: 'radial-gradient(circle at 26% 24%, rgba(255, 204, 130, 0.18), transparent 28%), radial-gradient(circle at 76% 68%, rgba(255, 125, 94, 0.18), transparent 32%), linear-gradient(180deg, rgba(36, 20, 16, 0.96), rgba(18, 10, 10, 0.98))'
    }),
    defineTheme({
        label: 'theme6',
        color: 0x0f182b,
        exposure: 1.62,
        description: 'Theme placeholder 6.',
        previewBackground: 'radial-gradient(circle at 24% 20%, rgba(177, 220, 255, 0.18), transparent 28%), radial-gradient(circle at 72% 72%, rgba(74, 114, 255, 0.24), transparent 34%), linear-gradient(180deg, rgba(15, 26, 46, 0.96), rgba(8, 13, 24, 0.98))'
    }),
    defineTheme({
        label: 'theme7',
        color: 0x1c1324,
        exposure: 1.64,
        description: 'Theme placeholder 7.',
        previewBackground: 'radial-gradient(circle at 24% 18%, rgba(255, 180, 227, 0.22), transparent 28%), radial-gradient(circle at 80% 74%, rgba(163, 126, 255, 0.2), transparent 34%), linear-gradient(180deg, rgba(29, 19, 40, 0.96), rgba(14, 10, 24, 0.98))'
    })
];
