var TypotypoEngine;
(function (TypotypoEngine) {
    const REGULAR_NBSP = "\u00A0";
    const NARROW_NBSP = "\u202F";
    TypotypoEngine.DEFAULT_SETTINGS = {
        languageMode: "auto",
        options: {
            nonBreakingSpaceStyle: "regular",
            quoteOptions: {
                ru: {
                    primaryQuoteStyle: "frenchGuillemets",
                    secondaryQuoteStyle: "germanLowHigh",
                },
                en: {
                    primaryQuoteStyle: "englishDouble",
                    secondaryQuoteStyle: "englishSingle",
                },
            },
        },
        enabledRules: {
            invisibleCopyArtifacts: true,
            tabs: true,
            manualLineBreaks: true,
            ellipsis: true,
            extraSpaces: true,
            trimTextEdges: true,
            spacingCleanup: true,
            percentSignNoSpace: true,
            numberUnitsNbsp: true,
            numberSigns: true,
            specialSymbols: true,
            englishApostrophes: true,
            englishQuotes: true,
            russianQuotes: true,
            numberRangeDash: true,
            russianSentenceDash: true,
            russianShortWordsNbsp: true,
            russianInitialsNbsp: true,
            russianNumericAbbreviations: true,
            russianLargeNumbers: true,
            uiFinalPeriod: true,
        },
    };
    function cloneDefaultSettings() {
        return JSON.parse(JSON.stringify(TypotypoEngine.DEFAULT_SETTINGS));
    }
    function isBoolean(value) {
        return typeof value === "boolean";
    }
    function isLanguageMode(value) {
        return value === "auto" || value === "ru" || value === "en";
    }
    function isNonBreakingSpaceStyle(value) {
        return value === "regular" || value === "narrow";
    }
    function isQuoteStyle(value) {
        return (value === "frenchGuillemets" ||
            value === "germanLowHigh" ||
            value === "englishDouble" ||
            value === "programmerDouble" ||
            value === "englishSingle" ||
            value === "englishSingleReversed");
    }
    function normalizeSettings(input) {
        const result = cloneDefaultSettings();
        if (!input || typeof input !== "object") {
            return result;
        }
        const raw = input;
        if (isLanguageMode(raw.languageMode)) {
            result.languageMode = raw.languageMode;
        }
        if (raw.options && typeof raw.options === "object") {
            if (isNonBreakingSpaceStyle(raw.options.nonBreakingSpaceStyle)) {
                result.options.nonBreakingSpaceStyle = raw.options.nonBreakingSpaceStyle;
            }
            const quoteOptions = raw.options.quoteOptions;
            if (quoteOptions && typeof quoteOptions === "object") {
                for (const language of ["ru", "en"]) {
                    const languageQuoteOptions = quoteOptions[language];
                    if (!languageQuoteOptions || typeof languageQuoteOptions !== "object") {
                        continue;
                    }
                    if (isQuoteStyle(languageQuoteOptions.primaryQuoteStyle)) {
                        result.options.quoteOptions[language].primaryQuoteStyle =
                            languageQuoteOptions.primaryQuoteStyle;
                    }
                    if (isQuoteStyle(languageQuoteOptions.secondaryQuoteStyle)) {
                        result.options.quoteOptions[language].secondaryQuoteStyle =
                            languageQuoteOptions.secondaryQuoteStyle;
                    }
                }
            }
        }
        if (raw.enabledRules && typeof raw.enabledRules === "object") {
            for (const key of Object.keys(result.enabledRules)) {
                const value = raw.enabledRules[key];
                if (isBoolean(value)) {
                    result.enabledRules[key] = value;
                }
            }
            if (!isBoolean(raw.enabledRules.numberRangeDash) &&
                isBoolean(raw.enabledRules.russianNumberRangeDash)) {
                result.enabledRules.numberRangeDash =
                    raw.enabledRules.russianNumberRangeDash;
            }
            if (!isBoolean(raw.enabledRules.spacingCleanup)) {
                if (raw.enabledRules.spacesBeforePunctuation === false &&
                    raw.enabledRules.spacesAfterPunctuation !== true) {
                    result.enabledRules.spacingCleanup = false;
                }
            }
        }
        return result;
    }
    TypotypoEngine.normalizeSettings = normalizeSettings;
    function resolveLanguage(text, languageMode) {
        if (languageMode === "ru" || languageMode === "en") {
            return languageMode;
        }
        const cyrillicMatches = text.match(/[А-Яа-яЁё]/g) || [];
        const latinMatches = text.match(/[A-Za-z]/g) || [];
        if (cyrillicMatches.length === 0 && latinMatches.length === 0) {
            return "unknown";
        }
        return cyrillicMatches.length >= latinMatches.length ? "ru" : "en";
    }
    TypotypoEngine.resolveLanguage = resolveLanguage;
    function applyRulesToText(originalText, settings, language) {
        const safeSettings = normalizeSettings(settings);
        const protectedText = protectSegments(originalText);
        let text = protectedText.text;
        let replacementCount = 0;
        let skippedRuleCount = 0;
        function applyRule(enabled, allowedLanguages, rule) {
            if (!enabled) {
                return;
            }
            if (allowedLanguages && !allowedLanguages.includes(language)) {
                skippedRuleCount += 1;
                return;
            }
            const before = text;
            text = rule(text);
            if (text !== before) {
                replacementCount += 1;
            }
        }
        const enabledRules = safeSettings.enabledRules;
        applyRule(enabledRules.invisibleCopyArtifacts, null, removeInvisibleCopyArtifacts);
        applyRule(enabledRules.tabs, null, normalizeTabs);
        applyRule(enabledRules.manualLineBreaks, null, normalizeManualLineBreaks);
        applyRule(enabledRules.ellipsis, null, normalizeEllipsis);
        applyRule(enabledRules.percentSignNoSpace, null, normalizePercentSign);
        applyRule(enabledRules.specialSymbols, null, normalizeSpecialSymbols);
        applyRule(enabledRules.numberSigns, null, normalizeNumberSigns);
        applyRule(enabledRules.numberRangeDash, null, normalizeNumberRanges);
        applyRule(enabledRules.numberUnitsNbsp, null, (value) => normalizeNumberUnits(value, getNumericNbsp(safeSettings)));
        applyRule(enabledRules.russianNumericAbbreviations, ["ru"], (value) => normalizeRussianNumericAbbreviations(value, getNumericNbsp(safeSettings)));
        applyRule(enabledRules.russianLargeNumbers, ["ru"], (value) => normalizeRussianLargeNumbers(value, getNumericNbsp(safeSettings)));
        applyRule(enabledRules.englishApostrophes, ["en"], normalizeEnglishApostrophes);
        applyRule(enabledRules.englishQuotes, ["en"], (value) => normalizeQuotes(value, safeSettings.options.quoteOptions.en));
        applyRule(enabledRules.russianQuotes, ["ru"], (value) => normalizeQuotes(value, safeSettings.options.quoteOptions.ru));
        applyRule(enabledRules.russianSentenceDash, ["ru"], normalizeRussianSentenceDash);
        applyRule(enabledRules.russianInitialsNbsp, ["ru"], normalizeRussianInitials);
        applyRule(enabledRules.russianShortWordsNbsp, ["ru"], normalizeRussianShortWords);
        applyRule(enabledRules.spacingCleanup, null, normalizeSpacing);
        applyRule(enabledRules.extraSpaces, null, normalizeExtraSpaces);
        applyRule(enabledRules.trimTextEdges, null, trimTextEdges);
        applyRule(enabledRules.uiFinalPeriod, null, removeUiFinalPeriod);
        return {
            formattedText: restoreSegments(text, protectedText.segments),
            replacementCount,
            skippedRuleCount,
        };
    }
    TypotypoEngine.applyRulesToText = applyRulesToText;
    function getNumericNbsp(settings) {
        return settings.options.nonBreakingSpaceStyle === "narrow"
            ? NARROW_NBSP
            : REGULAR_NBSP;
    }
    function protectSegments(text) {
        const segments = [];
        const protectedPattern = /https?:\/\/[^\s<>()]+|www\.[^\s<>()]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|`[^`]*`|<[^>]+>|&[#A-Za-z0-9]+;|\{[^{}]*\}|\b[A-Za-z][A-Za-z0-9]*(?:[._/-][A-Za-z0-9]+){2,}\b/g;
        const protectedValue = text.replace(protectedPattern, (value) => {
            const token = `\uE000${segments.length}\uE001`;
            segments.push({ token, value });
            return token;
        });
        return {
            text: protectedValue,
            segments,
        };
    }
    function restoreSegments(text, segments) {
        let restoredText = text;
        for (const segment of segments) {
            restoredText = restoredText.split(segment.token).join(segment.value);
        }
        return restoredText;
    }
    function removeInvisibleCopyArtifacts(text) {
        return text.replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, "");
    }
    function normalizeTabs(text) {
        return text.replace(/\t/g, " ");
    }
    function normalizeManualLineBreaks(text) {
        const paragraphBreaks = [];
        const withProtectedParagraphs = text.replace(/\n{2,}/g, (value) => {
            const token = `\uE100${paragraphBreaks.length}\uE101`;
            paragraphBreaks.push(value);
            return token;
        });
        const normalized = withProtectedParagraphs.replace(/[ \t]*\n[ \t]*/g, " ");
        return paragraphBreaks.reduce((value, paragraphBreak, index) => value.split(`\uE100${index}\uE101`).join(paragraphBreak), normalized);
    }
    function normalizeEllipsis(text) {
        return text.replace(/\.\.\./g, "…");
    }
    function normalizePercentSign(text) {
        return text.replace(/(\d)[ \t\u00A0\u202F]+%/g, "$1%");
    }
    function normalizeSpecialSymbols(text) {
        return text
            .replace(/\(c\)/gi, "©")
            .replace(/\(tm\)/gi, "™")
            .replace(/\+\/-/g, "±")
            .replace(/!=/g, "≠")
            .replace(/<=/g, "≤")
            .replace(/>=/g, "≥")
            .replace(/(^|\s)-\>/g, "$1→")
            .replace(/<-(\s|$)/g, "←$1")
            .replace(/(\d)\s*[xх]\s*(\d)/gi, "$1×$2")
            .replace(/\b1\/2\b/g, "½")
            .replace(/\b1\/3\b/g, "⅓")
            .replace(/\b2\/3\b/g, "⅔")
            .replace(/\b1\/4\b/g, "¼")
            .replace(/\b3\/4\b/g, "¾");
    }
    function normalizeNumberSigns(text) {
        return text.replace(/([№§])\s*(\d)/g, `$1${REGULAR_NBSP}$2`);
    }
    function normalizeNumberRanges(text) {
        return text.replace(/(\d)[ \t\u00A0\u202F]*[-–—][ \t\u00A0\u202F]*(\d)/g, "$1–$2");
    }
    function normalizeNumberUnits(text, nbsp) {
        const unitPattern = /(\d+(?:[,.]\d+)?)[ \t\u00A0\u202F]*(км|м|см|мм|кг|г|мг|л|мл|КБ|МБ|ГБ|ТБ|kb|mb|gb|tb|px|dp|pt|rem|em|сек|с|мин|ч|дн|шт)(?=$|[\s,.;:!?)]|\uE000)/gi;
        return text
            .replace(/(\d+(?:[,.]\d+)?)[ \t\u00A0\u202F]*°[ \t\u00A0\u202F]*([CFС])/g, (_match, number, scale) => {
            const normalizedScale = scale === "С" ? "C" : scale;
            return `${number}${nbsp}°${normalizedScale}`;
        })
            .replace(unitPattern, (_match, number, unit) => `${number}${nbsp}${unit}`)
            .replace(/(\d+(?:[,.]\d+)?)[ \t\u00A0\u202F]*(\$|€|£|¥)/g, (_match, number, currency) => `${number}${nbsp}${currency}`)
            .replace(/(\d+(?:[,.]\d+)?)[ \t\u00A0\u202F]*(?:руб|р)\.(?=\s+[А-ЯЁA-Z])/g, (_match, number) => `${number}${nbsp}₽.`)
            .replace(/(\d+(?:[,.]\d+)?)[ \t\u00A0\u202F]*(?:руб|р)\.?(?![А-Яа-яЁёA-Za-z])/g, (_match, number) => `${number}${nbsp}₽`)
            .replace(/(\d+(?:[,.]\d+)?)[ \t\u00A0\u202F]*₽/g, (_match, number) => `${number}${nbsp}₽`);
    }
    function normalizeRussianNumericAbbreviations(text, nbsp) {
        return text
            .replace(/(\d+(?:[,.]\d+)?)[ \t\u00A0\u202F]*(тыс)\.?(?=\s|$|[,.!?:;)])/gi, (_match, number, abbreviation) => `${number}${nbsp}${abbreviation}.`)
            .replace(/(\d+(?:[,.]\d+)?)[ \t\u00A0\u202F]*(млн|млрд|трлн)\.?(?=\s|$|[,.!?:;)])/gi, (_match, number, abbreviation) => `${number}${nbsp}${abbreviation}`);
    }
    function normalizeRussianLargeNumbers(text, nbsp) {
        return text.replace(/\b\d{5,}\b/g, (value) => value.replace(/\B(?=(\d{3})+(?!\d))/g, nbsp));
    }
    function normalizeEnglishApostrophes(text) {
        return text
            .replace(/([A-Za-z])'([A-Za-z])/g, "$1’$2")
            .replace(/([A-Za-z])'s\b/g, "$1’s")
            .replace(/\b'(\d{2}s)\b/g, "’$1");
    }
    function getQuotePair(style) {
        switch (style) {
            case "frenchGuillemets":
                return { open: "«", close: "»" };
            case "germanLowHigh":
                return { open: "„", close: "“" };
            case "englishDouble":
                return { open: "“", close: "”" };
            case "programmerDouble":
                return { open: '"', close: '"' };
            case "englishSingle":
                return { open: "‘", close: "’" };
            case "englishSingleReversed":
                return { open: "‚", close: "‘" };
        }
    }
    function isOpeningQuotePosition(text, index) {
        const previousCharacter = text[index - 1];
        return (index === 0 ||
            /[\s([{<—–-]/.test(previousCharacter) ||
            previousCharacter === REGULAR_NBSP ||
            previousCharacter === NARROW_NBSP);
    }
    function normalizeQuotes(text, options) {
        const primaryQuotePair = getQuotePair(options.primaryQuoteStyle);
        const secondaryQuotePair = getQuotePair(options.secondaryQuoteStyle);
        const quoteCharacters = new Set(['"', "«", "»", "“", "”", "„"]);
        let result = "";
        let depth = 0;
        for (let index = 0; index < text.length; index++) {
            const character = text[index];
            if (!quoteCharacters.has(character)) {
                result += character;
                continue;
            }
            const isOpening = isOpeningQuotePosition(text, index);
            const pair = depth % 2 === 0 ? primaryQuotePair : secondaryQuotePair;
            if (isOpening) {
                result += pair.open;
                depth += 1;
            }
            else {
                const closingPair = Math.max(0, depth - 1) % 2 === 0 ? primaryQuotePair : secondaryQuotePair;
                result += closingPair.close;
                depth = Math.max(0, depth - 1);
            }
        }
        return result;
    }
    function normalizeRussianSentenceDash(text) {
        return text
            .replace(/([^\s])[ \t\u00A0\u202F]+[-–—][ \t\u00A0\u202F]+([^\s])/g, `$1${REGULAR_NBSP}— $2`)
            .replace(/([^\s])\u202F—[ \t\u00A0\u202F]*/g, `$1${REGULAR_NBSP}— `)
            .replace(/([^\s])\u00A0—[ \t\u00A0\u202F]*/g, `$1${REGULAR_NBSP}— `);
    }
    function normalizeRussianInitials(text) {
        return text.replace(/\b([А-ЯЁ])\.\s*([А-ЯЁ])\.\s*([А-ЯЁ][а-яё]+)/g, `$1.${REGULAR_NBSP}$2.${REGULAR_NBSP}$3`);
    }
    function normalizeRussianShortWords(text) {
        const shortWords = "а|в|во|и|к|ко|с|со|у|о|об|обо|от|до|из|за|на|не|но|по|под|над|при|про|для|без|или|же|ли|бы";
        const shortWordPattern = new RegExp(`(^|[\\s([{«„“])(${shortWords})\\s+([А-Яа-яЁёA-Za-z0-9])`, "gi");
        return text
            .replace(/\bт\.\s*е\./gi, `т.${REGULAR_NBSP}е.`)
            .replace(/\bт\.\s*к\./gi, `т.${REGULAR_NBSP}к.`)
            .replace(/\bт\.\s*д\./gi, `т.${REGULAR_NBSP}д.`)
            .replace(/\bт\.\s*п\./gi, `т.${REGULAR_NBSP}п.`)
            .replace(/\bв\s+т\.\s*ч\./gi, `в${REGULAR_NBSP}т.${REGULAR_NBSP}ч.`)
            .replace(shortWordPattern, (_match, prefix, word, next) => `${prefix}${word}${REGULAR_NBSP}${next}`);
    }
    function normalizeSpacing(text) {
        return text
            .replace(/[ \t\u00A0\u202F]+([,.;:!?])/g, "$1")
            .replace(/([,;:!?])(?=[^\s\uE001])/g, "$1 ")
            .replace(/\(\s+/g, "(")
            .replace(/\s+\)/g, ")")
            .replace(/\[\s+/g, "[")
            .replace(/\s+\]/g, "]")
            .replace(/\{\s+/g, "{")
            .replace(/\s+\}/g, "}")
            .replace(/!{2,}/g, "!")
            .replace(/\?{2,}/g, "?")
            .replace(/([!?])([А-Яа-яЁёA-Za-z])/g, "$1 $2");
    }
    function normalizeExtraSpaces(text) {
        return text.replace(/[ \t]{2,}/g, " ");
    }
    function trimTextEdges(text) {
        return text.trim();
    }
    function removeUiFinalPeriod(text) {
        const trimmedRight = text.replace(/[ \t\u00A0\u202F]+$/g, "");
        if (!trimmedRight.endsWith(".")) {
            return text;
        }
        const bodyWithoutFinalPeriod = trimmedRight.slice(0, -1);
        if (bodyWithoutFinalPeriod.length > 80) {
            return text;
        }
        if (/[.!?…]\s+/.test(bodyWithoutFinalPeriod)) {
            return text;
        }
        if (/(?:\b[А-ЯЁA-Z]\.|\bт\.\s*[едкпч]\.|тыс\.|руб\.)$/i.test(bodyWithoutFinalPeriod)) {
            return text;
        }
        return text.slice(0, text.length - (text.length - trimmedRight.length) - 1) +
            text.slice(trimmedRight.length);
    }
})(TypotypoEngine || (TypotypoEngine = {}));
/// <reference path="./typography-engine.ts" />
figma.showUI(__html__, {
    width: 420,
    height: 1180,
});
const SETTINGS_STORAGE_KEY = "typographyFormatterSettings";
const UI_SETTINGS_STORAGE_KEY = "typotypoInterfaceSettings";
async function loadSettings() {
    try {
        const storedSettings = await figma.clientStorage.getAsync(SETTINGS_STORAGE_KEY);
        return TypotypoEngine.normalizeSettings(storedSettings);
    }
    catch (error) {
        console.error("Could not load settings:", error);
        return TypotypoEngine.DEFAULT_SETTINGS;
    }
}
async function saveSettings(settings) {
    try {
        await figma.clientStorage.setAsync(SETTINGS_STORAGE_KEY, TypotypoEngine.normalizeSettings(settings));
    }
    catch (error) {
        console.error("Could not save settings:", error);
    }
}
function normalizeUiSettings(value) {
    var _a;
    if (!value || typeof value !== "object") {
        return {};
    }
    const rawSettings = value;
    const rawLanguage = (_a = rawSettings.uiLanguage) !== null && _a !== void 0 ? _a : rawSettings.uiLanguageMode;
    if (rawLanguage === "ru" || rawLanguage === "en") {
        return { uiLanguage: rawLanguage };
    }
    return {};
}
async function loadUiSettings() {
    try {
        const storedUiSettings = await figma.clientStorage.getAsync(UI_SETTINGS_STORAGE_KEY);
        return normalizeUiSettings(storedUiSettings);
    }
    catch (error) {
        console.error("Could not load UI settings:", error);
        return {};
    }
}
async function saveUiSettings(uiSettings) {
    try {
        const safeUiSettings = normalizeUiSettings(uiSettings);
        if (!safeUiSettings.uiLanguage) {
            return;
        }
        await figma.clientStorage.setAsync(UI_SETTINGS_STORAGE_KEY, safeUiSettings);
    }
    catch (error) {
        console.error("Could not save UI settings:", error);
    }
}
function isNodeHiddenBySelfOrParent(node) {
    let currentNode = node;
    while (currentNode) {
        if ("visible" in currentNode && currentNode.visible === false) {
            return true;
        }
        currentNode = currentNode.parent;
    }
    return false;
}
function isNodeLockedBySelfOrParent(node) {
    let currentNode = node;
    while (currentNode) {
        if ("locked" in currentNode && currentNode.locked === true) {
            return true;
        }
        currentNode = currentNode.parent;
    }
    return false;
}
function getTextNodePreflightSkipReason(node) {
    if (isNodeHiddenBySelfOrParent(node)) {
        return "hidden";
    }
    if (isNodeLockedBySelfOrParent(node)) {
        return "locked";
    }
    if (node.characters.trim().length === 0) {
        return "empty";
    }
    return null;
}
function collectTextNodesFromSceneNodeRoots(roots) {
    const textNodes = [];
    const seenNodeIds = new Set();
    function addTextNode(node) {
        if (seenNodeIds.has(node.id)) {
            return;
        }
        seenNodeIds.add(node.id);
        textNodes.push(node);
    }
    function walk(node) {
        if (node.type === "TEXT") {
            addTextNode(node);
            return;
        }
        if ("children" in node) {
            for (const child of node.children) {
                walk(child);
            }
        }
    }
    for (const node of roots) {
        walk(node);
    }
    return textNodes;
}
function resolveTextNodeTarget() {
    const selection = figma.currentPage.selection;
    if (selection.length === 0) {
        return {
            targetScope: "currentPage",
            selectedCount: 0,
            textNodes: collectTextNodesFromSceneNodeRoots(figma.currentPage.children),
        };
    }
    return {
        targetScope: "selection",
        selectedCount: selection.length,
        textNodes: collectTextNodesFromSceneNodeRoots(selection),
    };
}
function summarizeTextNodeAvailability(textNodes) {
    const summary = {
        totalTextNodeCount: textNodes.length,
        availableTextNodeCount: 0,
        skippedHiddenNodeCount: 0,
        skippedLockedNodeCount: 0,
        skippedEmptyNodeCount: 0,
    };
    for (const node of textNodes) {
        const skipReason = getTextNodePreflightSkipReason(node);
        if (skipReason === "hidden") {
            summary.skippedHiddenNodeCount += 1;
            continue;
        }
        if (skipReason === "locked") {
            summary.skippedLockedNodeCount += 1;
            continue;
        }
        if (skipReason === "empty") {
            summary.skippedEmptyNodeCount += 1;
            continue;
        }
        summary.availableTextNodeCount += 1;
    }
    return summary;
}
function sendSelectionInfo() {
    const target = resolveTextNodeTarget();
    const availabilitySummary = summarizeTextNodeAvailability(target.textNodes);
    figma.ui.postMessage({
        type: "selection-info",
        targetScope: target.targetScope,
        selectedCount: target.selectedCount,
        textNodeCount: availabilitySummary.totalTextNodeCount,
        availableTextNodeCount: availabilitySummary.availableTextNodeCount,
        skippedHiddenNodeCount: availabilitySummary.skippedHiddenNodeCount,
        skippedLockedNodeCount: availabilitySummary.skippedLockedNodeCount,
        skippedEmptyNodeCount: availabilitySummary.skippedEmptyNodeCount,
    });
}
function getCharacterStyleSnapshot(node, index) {
    return {
        fontName: node.getRangeFontName(index, index + 1),
        fontSize: node.getRangeFontSize(index, index + 1),
        fills: node.getRangeFills(index, index + 1),
        textDecoration: node.getRangeTextDecoration(index, index + 1),
        textCase: node.getRangeTextCase(index, index + 1),
        letterSpacing: node.getRangeLetterSpacing(index, index + 1),
        lineHeight: node.getRangeLineHeight(index, index + 1),
    };
}
function getTextStyleSnapshots(node) {
    const styles = [];
    for (let i = 0; i < node.characters.length; i++) {
        styles.push(getCharacterStyleSnapshot(node, i));
    }
    return styles;
}
function findNextMatchingCharacter(originalText, formattedText, originalIndex, formattedIndex) {
    const lookaheadLimit = 80;
    const maxOriginalIndex = Math.min(originalText.length, originalIndex + lookaheadLimit);
    const maxFormattedIndex = Math.min(formattedText.length, formattedIndex + lookaheadLimit);
    let bestMatch = null;
    let bestDistance = Infinity;
    for (let currentOriginalIndex = originalIndex; currentOriginalIndex < maxOriginalIndex; currentOriginalIndex++) {
        for (let currentFormattedIndex = formattedIndex; currentFormattedIndex < maxFormattedIndex; currentFormattedIndex++) {
            if (originalText[currentOriginalIndex] !== formattedText[currentFormattedIndex]) {
                continue;
            }
            const distance = currentOriginalIndex - originalIndex +
                currentFormattedIndex - formattedIndex;
            if (distance < bestDistance) {
                bestDistance = distance;
                bestMatch = {
                    originalIndex: currentOriginalIndex,
                    formattedIndex: currentFormattedIndex,
                };
            }
        }
    }
    return bestMatch;
}
function mapFormattedCharactersToOriginalCharacters(originalText, formattedText) {
    const originalIndexByFormattedIndex = [];
    let originalIndex = 0;
    let formattedIndex = 0;
    while (formattedIndex < formattedText.length) {
        if (originalIndex < originalText.length &&
            originalText[originalIndex] === formattedText[formattedIndex]) {
            originalIndexByFormattedIndex[formattedIndex] = originalIndex;
            originalIndex += 1;
            formattedIndex += 1;
            continue;
        }
        const nextMatch = findNextMatchingCharacter(originalText, formattedText, originalIndex, formattedIndex);
        const nextOriginalIndex = nextMatch
            ? nextMatch.originalIndex
            : originalText.length;
        const nextFormattedIndex = nextMatch
            ? nextMatch.formattedIndex
            : formattedText.length;
        const styleSourceIndex = Math.max(0, Math.min(originalText.length - 1, originalIndex < originalText.length ? originalIndex : originalIndex - 1));
        while (formattedIndex < nextFormattedIndex) {
            originalIndexByFormattedIndex[formattedIndex] = styleSourceIndex;
            formattedIndex += 1;
        }
        originalIndex = nextOriginalIndex;
    }
    return originalIndexByFormattedIndex;
}
function getStyleKey(style) {
    return JSON.stringify({
        fontName: style.fontName,
        fontSize: style.fontSize,
        fills: style.fills,
        textDecoration: style.textDecoration,
        textCase: style.textCase,
        letterSpacing: style.letterSpacing,
        lineHeight: style.lineHeight,
    });
}
function applyStyleToRange(node, start, end, style) {
    if (start >= end) {
        return;
    }
    function applySafely(propertyName, applyProperty) {
        try {
            applyProperty();
        }
        catch (error) {
            console.warn(`Could not restore ${propertyName} for range ${start}-${end}:`, error);
        }
    }
    if (style.fontName !== figma.mixed) {
        applySafely("fontName", () => {
            node.setRangeFontName(start, end, style.fontName);
        });
    }
    if (style.fontSize !== figma.mixed) {
        applySafely("fontSize", () => {
            node.setRangeFontSize(start, end, style.fontSize);
        });
    }
    if (style.fills !== figma.mixed) {
        applySafely("fills", () => {
            node.setRangeFills(start, end, style.fills);
        });
    }
    if (style.textDecoration !== figma.mixed) {
        applySafely("textDecoration", () => {
            node.setRangeTextDecoration(start, end, style.textDecoration);
        });
    }
    if (style.textCase !== figma.mixed) {
        applySafely("textCase", () => {
            node.setRangeTextCase(start, end, style.textCase);
        });
    }
    if (style.letterSpacing !== figma.mixed) {
        applySafely("letterSpacing", () => {
            node.setRangeLetterSpacing(start, end, style.letterSpacing);
        });
    }
    if (style.lineHeight !== figma.mixed) {
        applySafely("lineHeight", () => {
            node.setRangeLineHeight(start, end, style.lineHeight);
        });
    }
}
function applyStyleSnapshotsToFormattedText(node, originalText, formattedText, originalStyles) {
    if (originalStyles.length === 0 || formattedText.length === 0) {
        return;
    }
    const originalIndexByFormattedIndex = mapFormattedCharactersToOriginalCharacters(originalText, formattedText);
    let rangeStart = 0;
    let currentStyle = originalStyles[originalIndexByFormattedIndex[0]] || originalStyles[0];
    let currentStyleKey = getStyleKey(currentStyle);
    for (let index = 1; index < formattedText.length; index++) {
        const style = originalStyles[originalIndexByFormattedIndex[index]] || currentStyle;
        const styleKey = getStyleKey(style);
        if (styleKey === currentStyleKey) {
            continue;
        }
        applyStyleToRange(node, rangeStart, index, currentStyle);
        rangeStart = index;
        currentStyle = style;
        currentStyleKey = styleKey;
    }
    applyStyleToRange(node, rangeStart, formattedText.length, currentStyle);
}
async function loadFontsFromStyleSnapshots(styles) {
    const fonts = styles
        .map((style) => style.fontName)
        .filter((fontName) => fontName !== figma.mixed);
    const uniqueFonts = Array.from(new Map(fonts.map((font) => [`${font.family}-${font.style}`, font])).values());
    await Promise.all(uniqueFonts.map((font) => figma.loadFontAsync(font)));
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
async function updateTextNodeCharactersPreservingStyles(node, formattedText) {
    const originalText = node.characters;
    const originalStyles = getTextStyleSnapshots(node);
    await loadFontsForTextNode(node);
    await loadFontsFromStyleSnapshots(originalStyles);
    node.characters = formattedText;
    applyStyleSnapshotsToFormattedText(node, originalText, formattedText, originalStyles);
}
function isProbablyNonEditableError(error) {
    const message = String(error instanceof Error ? error.message : error !== null && error !== void 0 ? error : "").toLowerCase();
    return (message.includes("read only") ||
        message.includes("readonly") ||
        message.includes("not editable") ||
        message.includes("non-editable") ||
        message.includes("cannot edit") ||
        message.includes("can't edit") ||
        message.includes("cannot write") ||
        message.includes("can't write") ||
        message.includes("instance") ||
        message.includes("component"));
}
async function applyTypographyRules(settings) {
    const safeSettings = TypotypoEngine.normalizeSettings(settings);
    const target = resolveTextNodeTarget();
    let changedNodeCount = 0;
    let unchangedNodeCount = 0;
    let totalReplacementCount = 0;
    let skippedHiddenNodeCount = 0;
    let skippedLockedNodeCount = 0;
    let skippedEmptyNodeCount = 0;
    let skippedNonEditableNodeCount = 0;
    let errorNodeCount = 0;
    let skippedRuleCount = 0;
    const languageStats = {
        ru: 0,
        en: 0,
        unknown: 0,
    };
    for (const node of target.textNodes) {
        const skipReason = getTextNodePreflightSkipReason(node);
        if (skipReason === "hidden") {
            skippedHiddenNodeCount += 1;
            continue;
        }
        if (skipReason === "locked") {
            skippedLockedNodeCount += 1;
            continue;
        }
        if (skipReason === "empty") {
            skippedEmptyNodeCount += 1;
            continue;
        }
        try {
            const originalText = node.characters;
            const language = TypotypoEngine.resolveLanguage(originalText, safeSettings.languageMode);
            languageStats[language] += 1;
            const result = TypotypoEngine.applyRulesToText(originalText, safeSettings, language);
            skippedRuleCount += result.skippedRuleCount;
            if (result.replacementCount === 0 ||
                result.formattedText === originalText) {
                unchangedNodeCount += 1;
                continue;
            }
            await updateTextNodeCharactersPreservingStyles(node, result.formattedText);
            changedNodeCount += 1;
            totalReplacementCount += result.replacementCount;
        }
        catch (error) {
            console.error("Could not update text node:", error);
            if (isProbablyNonEditableError(error)) {
                skippedNonEditableNodeCount += 1;
            }
            else {
                errorNodeCount += 1;
            }
        }
    }
    const skippedNodeCount = skippedHiddenNodeCount +
        skippedLockedNodeCount +
        skippedEmptyNodeCount +
        skippedNonEditableNodeCount +
        errorNodeCount;
    figma.ui.postMessage({
        type: "apply-result",
        targetScope: target.targetScope,
        selectedCount: target.selectedCount,
        totalTextNodeCount: target.textNodes.length,
        changedNodeCount,
        unchangedNodeCount,
        totalReplacementCount,
        skippedNodeCount,
        skippedHiddenNodeCount,
        skippedLockedNodeCount,
        skippedEmptyNodeCount,
        skippedNonEditableNodeCount,
        errorNodeCount,
        skippedRuleCount,
        languageStats,
    });
    figma.notify(`Updated ${changedNodeCount} text layer${changedNodeCount === 1 ? "" : "s"}` +
        (skippedNodeCount > 0 ? ` · Skipped ${skippedNodeCount}` : ""));
    sendSelectionInfo();
}
async function initializePlugin() {
    const [settings, uiSettings] = await Promise.all([
        loadSettings(),
        loadUiSettings(),
    ]);
    figma.ui.postMessage({
        type: "settings-loaded",
        settings,
        uiSettings,
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
    if (message.type === "save-ui-settings") {
        await saveUiSettings(message.uiSettings);
    }
    if (message.type === "apply") {
        const safeSettings = TypotypoEngine.normalizeSettings(message.settings);
        await Promise.all([
            saveSettings(safeSettings),
            saveUiSettings(message.uiSettings),
        ]);
        await applyTypographyRules(safeSettings);
    }
    if (message.type === "close") {
        await saveUiSettings(message.uiSettings);
        figma.closePlugin();
    }
};
initializePlugin();
