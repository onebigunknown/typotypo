"use strict";
figma.showUI(__html__, {
    width: 420,
    height: 680,
});
const SETTINGS_STORAGE_KEY = "typographyFormatterSettings";
const DEFAULT_SETTINGS = {
    languageMode: "auto",
    enabledRules: {
        invisibleCopyArtifacts: true,
        tabs: true,
        ellipsis: true,
        extraSpaces: true,
        trimTextEdges: true,
        spacesBeforePunctuation: true,
        russianQuotes: true,
        russianShortWordsNbsp: true,
    },
};
function isLanguageMode(value) {
    return value === "auto" || value === "ru" || value === "en";
}
function normalizeSettings(value) {
    const maybeSettings = typeof value === "object" && value !== null
        ? value
        : {};
    const maybeEnabledRules = typeof maybeSettings.enabledRules === "object" &&
        maybeSettings.enabledRules !== null
        ? maybeSettings.enabledRules
        : {};
    return {
        languageMode: isLanguageMode(maybeSettings.languageMode)
            ? maybeSettings.languageMode
            : DEFAULT_SETTINGS.languageMode,
        enabledRules: {
            invisibleCopyArtifacts: typeof maybeEnabledRules.invisibleCopyArtifacts === "boolean"
                ? maybeEnabledRules.invisibleCopyArtifacts
                : DEFAULT_SETTINGS.enabledRules.invisibleCopyArtifacts,
            tabs: typeof maybeEnabledRules.tabs === "boolean"
                ? maybeEnabledRules.tabs
                : DEFAULT_SETTINGS.enabledRules.tabs,
            ellipsis: typeof maybeEnabledRules.ellipsis === "boolean"
                ? maybeEnabledRules.ellipsis
                : DEFAULT_SETTINGS.enabledRules.ellipsis,
            extraSpaces: typeof maybeEnabledRules.extraSpaces === "boolean"
                ? maybeEnabledRules.extraSpaces
                : DEFAULT_SETTINGS.enabledRules.extraSpaces,
            trimTextEdges: typeof maybeEnabledRules.trimTextEdges === "boolean"
                ? maybeEnabledRules.trimTextEdges
                : DEFAULT_SETTINGS.enabledRules.trimTextEdges,
            spacesBeforePunctuation: typeof maybeEnabledRules.spacesBeforePunctuation === "boolean"
                ? maybeEnabledRules.spacesBeforePunctuation
                : DEFAULT_SETTINGS.enabledRules.spacesBeforePunctuation,
            russianQuotes: typeof maybeEnabledRules.russianQuotes === "boolean"
                ? maybeEnabledRules.russianQuotes
                : DEFAULT_SETTINGS.enabledRules.russianQuotes,
            russianShortWordsNbsp: typeof maybeEnabledRules.russianShortWordsNbsp === "boolean"
                ? maybeEnabledRules.russianShortWordsNbsp
                : DEFAULT_SETTINGS.enabledRules.russianShortWordsNbsp,
        },
    };
}
async function loadSettings() {
    try {
        const storedSettings = await figma.clientStorage.getAsync(SETTINGS_STORAGE_KEY);
        return normalizeSettings(storedSettings);
    }
    catch (error) {
        console.error("Could not load settings:", error);
        return DEFAULT_SETTINGS;
    }
}
async function saveSettings(settings) {
    try {
        await figma.clientStorage.setAsync(SETTINGS_STORAGE_KEY, settings);
    }
    catch (error) {
        console.error("Could not save settings:", error);
    }
}
function findTextNodesInSelection() {
    const textNodes = [];
    function walk(node) {
        if (node.type === "TEXT") {
            textNodes.push(node);
            return;
        }
        if ("children" in node) {
            for (const child of node.children) {
                walk(child);
            }
        }
    }
    for (const node of figma.currentPage.selection) {
        walk(node);
    }
    return textNodes;
}
function detectDominantLanguage(text) {
    const cyrillicMatches = text.match(/[А-Яа-яЁё]/g) || [];
    const latinMatches = text.match(/[A-Za-z]/g) || [];
    const cyrillicCount = cyrillicMatches.length;
    const latinCount = latinMatches.length;
    const totalLetterCount = cyrillicCount + latinCount;
    if (totalLetterCount < 3) {
        return "unknown";
    }
    const cyrillicRatio = cyrillicCount / totalLetterCount;
    const latinRatio = latinCount / totalLetterCount;
    if (cyrillicRatio >= 0.6) {
        return "ru";
    }
    if (latinRatio >= 0.6) {
        return "en";
    }
    return "unknown";
}
function resolveLanguage(text, languageMode) {
    if (languageMode === "ru") {
        return "ru";
    }
    if (languageMode === "en") {
        return "en";
    }
    return detectDominantLanguage(text);
}
function sendSelectionInfo() {
    const selectedTextNodes = findTextNodesInSelection();
    figma.ui.postMessage({
        type: "selection-info",
        selectedCount: figma.currentPage.selection.length,
        textNodeCount: selectedTextNodes.length,
    });
}
function applyInvisibleCopyArtifactsRule(text) {
    const regexp = /[\u00AD\u200B\uFEFF]/g;
    const matches = text.match(regexp);
    return {
        formattedText: text.replace(regexp, ""),
        replacementCount: matches ? matches.length : 0,
    };
}
function applyTabsRule(text) {
    const regexp = /\t+/g;
    const matches = text.match(regexp);
    return {
        formattedText: text.replace(regexp, " "),
        replacementCount: matches ? matches.length : 0,
    };
}
function applyEllipsisRule(text) {
    const matches = text.match(/\.{3}/g);
    return {
        formattedText: text.replace(/\.{3}/g, "…"),
        replacementCount: matches ? matches.length : 0,
    };
}
function applyExtraSpacesRule(text) {
    const matches = text.match(/[^\S\r\n]{2,}/g);
    return {
        formattedText: text.replace(/[^\S\r\n]{2,}/g, " "),
        replacementCount: matches ? matches.length : 0,
    };
}
function applyTrimTextEdgesRule(text) {
    const regexp = /^[ \t\u00A0]+|[ \t\u00A0]+$/g;
    const matches = text.match(regexp);
    return {
        formattedText: text.replace(regexp, ""),
        replacementCount: matches ? matches.length : 0,
    };
}
function applySpacesBeforePunctuationRule(text) {
    const regexp = /[ \t]+([,.;:!?])/g;
    const matches = text.match(regexp);
    return {
        formattedText: text.replace(regexp, "$1"),
        replacementCount: matches ? matches.length : 0,
    };
}
function applyRussianQuotesRule(text) {
    const matches = text.match(/"[^"\n]+"/g);
    return {
        formattedText: text.replace(/"([^"\n]+)"/g, "«$1»"),
        replacementCount: matches ? matches.length : 0,
    };
}
function applyRussianShortWordsNbspRule(text) {
    const shortWords = "а|в|во|и|к|ко|о|об|от|по|с|со|у|до|за|из|на|не|ни|но";
    const regexp = new RegExp("(^|[ \\t(«„“])(" + shortWords + ")[ \\t]+(?=[А-Яа-яЁёA-Za-z0-9])", "giu");
    const matches = text.match(regexp);
    return {
        formattedText: text.replace(regexp, function (_match, prefix, word) {
            return prefix + word + "\u00A0";
        }),
        replacementCount: matches ? matches.length : 0,
    };
}
const TYPOGRAPHY_RULES = [
    {
        id: "invisibleCopyArtifacts",
        supportedLanguages: "all",
        apply: applyInvisibleCopyArtifactsRule,
    },
    {
        id: "tabs",
        supportedLanguages: "all",
        apply: applyTabsRule,
    },
    {
        id: "ellipsis",
        supportedLanguages: "all",
        apply: applyEllipsisRule,
    },
    {
        id: "extraSpaces",
        supportedLanguages: "all",
        apply: applyExtraSpacesRule,
    },
    {
        id: "trimTextEdges",
        supportedLanguages: "all",
        apply: applyTrimTextEdgesRule,
    },
    {
        id: "spacesBeforePunctuation",
        supportedLanguages: "all",
        apply: applySpacesBeforePunctuationRule,
    },
    {
        id: "russianQuotes",
        supportedLanguages: ["ru"],
        apply: applyRussianQuotesRule,
    },
    {
        id: "russianShortWordsNbsp",
        supportedLanguages: ["ru"],
        apply: applyRussianShortWordsNbspRule,
    },
];
function isRuleSupportedForLanguage(rule, language) {
    if (rule.supportedLanguages === "all") {
        return true;
    }
    return rule.supportedLanguages.includes(language);
}
function applyRulesToText(text, enabledRules, language) {
    let formattedText = text;
    let replacementCount = 0;
    let skippedRuleCount = 0;
    for (const rule of TYPOGRAPHY_RULES) {
        if (!enabledRules[rule.id]) {
            continue;
        }
        if (!isRuleSupportedForLanguage(rule, language)) {
            skippedRuleCount += 1;
            continue;
        }
        const result = rule.apply(formattedText);
        formattedText = result.formattedText;
        replacementCount += result.replacementCount;
    }
    return {
        formattedText,
        replacementCount,
        skippedRuleCount,
    };
}
async function loadFontsForTextNode(node) {
    const fonts = [];
    function addFont(fontName) {
        if (fontName !== figma.mixed) {
            fonts.push(fontName);
        }
    }
    if (node.fontName !== figma.mixed) {
        addFont(node.fontName);
    }
    else {
        for (let i = 0; i < node.characters.length; i++) {
            addFont(node.getRangeFontName(i, i + 1));
        }
    }
    const uniqueFonts = Array.from(new Map(fonts.map((font) => [`${font.family}-${font.style}`, font])).values());
    await Promise.all(uniqueFonts.map((font) => figma.loadFontAsync(font)));
}
async function applyTypographyRules(settings) {
    const selectedTextNodes = findTextNodesInSelection();
    let changedNodeCount = 0;
    let totalReplacementCount = 0;
    let skippedNodeCount = 0;
    let skippedRuleCount = 0;
    const languageStats = {
        ru: 0,
        en: 0,
        unknown: 0,
    };
    for (const node of selectedTextNodes) {
        const originalText = node.characters;
        const language = resolveLanguage(originalText, settings.languageMode);
        languageStats[language] += 1;
        const result = applyRulesToText(originalText, settings.enabledRules, language);
        skippedRuleCount += result.skippedRuleCount;
        if (result.replacementCount === 0 || result.formattedText === originalText) {
            continue;
        }
        try {
            await loadFontsForTextNode(node);
            node.characters = result.formattedText;
            changedNodeCount += 1;
            totalReplacementCount += result.replacementCount;
        }
        catch (error) {
            console.error("Could not update text node:", error);
            skippedNodeCount += 1;
        }
    }
    figma.ui.postMessage({
        type: "apply-result",
        changedNodeCount,
        totalReplacementCount,
        skippedNodeCount,
        skippedRuleCount,
        languageStats,
    });
    figma.notify(`Updated ${changedNodeCount} text layer${changedNodeCount === 1 ? "" : "s"}`);
    sendSelectionInfo();
}
async function initializePlugin() {
    const settings = await loadSettings();
    figma.ui.postMessage({
        type: "settings-loaded",
        settings,
    });
    sendSelectionInfo();
}
figma.on("selectionchange", () => {
    sendSelectionInfo();
});
figma.ui.onmessage = async (message) => {
    if (message.type === "save-settings") {
        await saveSettings(message.settings);
    }
    if (message.type === "apply") {
        await saveSettings(message.settings);
        await applyTypographyRules(message.settings);
    }
    if (message.type === "close") {
        figma.closePlugin();
    }
};
initializePlugin();
