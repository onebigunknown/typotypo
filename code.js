"use strict";
figma.showUI(__html__, {
    width: 420,
    height: 1100,
});
const SETTINGS_STORAGE_KEY = "typographyFormatterSettings";
const DEFAULT_SETTINGS = {
    languageMode: "auto",
    options: {
        nonBreakingSpaceStyle: "regular",
    },
    enabledRules: {
        invisibleCopyArtifacts: true,
        tabs: true,
        ellipsis: true,
        extraSpaces: true,
        trimTextEdges: true,
        spacesBeforePunctuation: true,
        percentSignNoSpace: true,
        numberUnitsNbsp: true,
        specialSymbols: true,
        russianQuotes: true,
        russianNumberRangeDash: true,
        russianSentenceDash: true,
        russianShortWordsNbsp: true,
        russianInitialsNbsp: true,
        russianNumericAbbreviations: true,
        russianLargeNumbers: true,
        russianUiFinalPeriod: true,
    },
};
function isLanguageMode(value) {
    return value === "auto" || value === "ru" || value === "en";
}
function isNonBreakingSpaceStyle(value) {
    return value === "regular" || value === "narrow";
}
function normalizeSettings(value) {
    const maybeSettings = typeof value === "object" && value !== null
        ? value
        : {};
    const maybeOptions = typeof maybeSettings.options === "object" && maybeSettings.options !== null
        ? maybeSettings.options
        : {};
    const legacyOptions = maybeOptions;
    const maybeEnabledRules = typeof maybeSettings.enabledRules === "object" &&
        maybeSettings.enabledRules !== null
        ? maybeSettings.enabledRules
        : {};
    let nonBreakingSpaceStyle = DEFAULT_SETTINGS.options.nonBreakingSpaceStyle;
    if (isNonBreakingSpaceStyle(maybeOptions.nonBreakingSpaceStyle)) {
        nonBreakingSpaceStyle = maybeOptions.nonBreakingSpaceStyle;
    }
    else if (legacyOptions.numberUnitsSpace === "narrowNbsp") {
        nonBreakingSpaceStyle = "narrow";
    }
    else if (legacyOptions.numberUnitsSpace === "nbsp") {
        nonBreakingSpaceStyle = "regular";
    }
    return {
        languageMode: isLanguageMode(maybeSettings.languageMode)
            ? maybeSettings.languageMode
            : DEFAULT_SETTINGS.languageMode,
        options: {
            nonBreakingSpaceStyle,
        },
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
            percentSignNoSpace: typeof maybeEnabledRules.percentSignNoSpace === "boolean"
                ? maybeEnabledRules.percentSignNoSpace
                : DEFAULT_SETTINGS.enabledRules.percentSignNoSpace,
            numberUnitsNbsp: typeof maybeEnabledRules.numberUnitsNbsp === "boolean"
                ? maybeEnabledRules.numberUnitsNbsp
                : DEFAULT_SETTINGS.enabledRules.numberUnitsNbsp,
            specialSymbols: typeof maybeEnabledRules.specialSymbols === "boolean"
                ? maybeEnabledRules.specialSymbols
                : DEFAULT_SETTINGS.enabledRules.specialSymbols,
            russianQuotes: typeof maybeEnabledRules.russianQuotes === "boolean"
                ? maybeEnabledRules.russianQuotes
                : DEFAULT_SETTINGS.enabledRules.russianQuotes,
            russianNumberRangeDash: typeof maybeEnabledRules.russianNumberRangeDash === "boolean"
                ? maybeEnabledRules.russianNumberRangeDash
                : DEFAULT_SETTINGS.enabledRules.russianNumberRangeDash,
            russianSentenceDash: typeof maybeEnabledRules.russianSentenceDash === "boolean"
                ? maybeEnabledRules.russianSentenceDash
                : DEFAULT_SETTINGS.enabledRules.russianSentenceDash,
            russianShortWordsNbsp: typeof maybeEnabledRules.russianShortWordsNbsp === "boolean"
                ? maybeEnabledRules.russianShortWordsNbsp
                : DEFAULT_SETTINGS.enabledRules.russianShortWordsNbsp,
            russianInitialsNbsp: typeof maybeEnabledRules.russianInitialsNbsp === "boolean"
                ? maybeEnabledRules.russianInitialsNbsp
                : DEFAULT_SETTINGS.enabledRules.russianInitialsNbsp,
            russianNumericAbbreviations: typeof maybeEnabledRules.russianNumericAbbreviations === "boolean"
                ? maybeEnabledRules.russianNumericAbbreviations
                : DEFAULT_SETTINGS.enabledRules.russianNumericAbbreviations,
            russianLargeNumbers: typeof maybeEnabledRules.russianLargeNumbers === "boolean"
                ? maybeEnabledRules.russianLargeNumbers
                : DEFAULT_SETTINGS.enabledRules.russianLargeNumbers,
            russianUiFinalPeriod: typeof maybeEnabledRules.russianUiFinalPeriod === "boolean"
                ? maybeEnabledRules.russianUiFinalPeriod
                : DEFAULT_SETTINGS.enabledRules.russianUiFinalPeriod,
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
function getConfiguredNbsp(settings) {
    if (settings.options.nonBreakingSpaceStyle === "narrow") {
        return "\u202F";
    }
    return "\u00A0";
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
    const regexp = /^[ \t\u00A0\u202F]+|[ \t\u00A0\u202F]+$/g;
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
function applyPercentSignNoSpaceRule(text) {
    const regexp = /(\d+(?:[,.]\d+)?)[ \t\u00A0\u202F]+%/g;
    const matches = text.match(regexp);
    return {
        formattedText: text.replace(regexp, "$1%"),
        replacementCount: matches ? matches.length : 0,
    };
}
function applyNumberUnitsNbspRule(text, settings) {
    const units = "₽|руб\\.?|рублей|р\\.?|тыс\\.?|млн\\.?|млрд\\.?|трлн\\.?|кг|г|мг|л|мл|м|см|мм|км|с|сек|мин|ч|д|дн|КБ|МБ|ГБ|ТБ|KB|MB|GB|TB|px|dp|pt|rem|em|vw|vh";
    const regexp = new RegExp("(\\d+(?:[,.]\\d+)?)[ \\t\\u00A0\\u202F]+(" +
        units +
        ")(?=$|[ \\t\\n\\r,.;:!?\\)])", "giu");
    const space = getConfiguredNbsp(settings);
    let replacementCount = 0;
    const formattedText = text.replace(regexp, function (match, number, unit) {
        const normalized = number + space + unit;
        if (match === normalized) {
            return match;
        }
        replacementCount += 1;
        return normalized;
    });
    return {
        formattedText,
        replacementCount,
    };
}
function applySpecialSymbolsRule(text) {
    let formattedText = text;
    let replacementCount = 0;
    function replaceAndCount(regexp, replacement) {
        formattedText = formattedText.replace(regexp, function (match) {
            if (match === replacement) {
                return match;
            }
            replacementCount += 1;
            return replacement;
        });
    }
    replaceAndCount(/\([cс]\)/giu, "©");
    replaceAndCount(/\((tm|тм)\)/giu, "™");
    replaceAndCount(/\([rр]\)/giu, "®");
    replaceAndCount(/\+[\s\u00A0\u202F]*[-–—−]/g, "±");
    replaceAndCount(/<=/g, "≤");
    replaceAndCount(/>=/g, "≥");
    return {
        formattedText,
        replacementCount,
    };
}
function applyRussianQuotesRule(text) {
    const matches = text.match(/"[^"\n]+"/g);
    return {
        formattedText: text.replace(/"([^"\n]+)"/g, "«$1»"),
        replacementCount: matches ? matches.length : 0,
    };
}
function applyRussianNumberRangeDashRule(text) {
    const regexp = /(^|[^\d–—−-])(\d{1,4})[ \t\u00A0\u202F]*[-–—−][ \t\u00A0\u202F]*(\d{1,4})(?=$|[^\d–—−-])/g;
    let replacementCount = 0;
    const formattedText = text.replace(regexp, function (match, prefix, startNumber, endNumber) {
        const normalized = prefix + startNumber + "–" + endNumber;
        if (match === normalized) {
            return match;
        }
        replacementCount += 1;
        return normalized;
    });
    return {
        formattedText,
        replacementCount,
    };
}
function applyRussianSentenceDashRule(text) {
    const regexp = /([А-Яа-яЁёA-Za-z0-9»”’")\]\.!?…])([ \t\u00A0\u202F]+)[-–—−]([ \t\u00A0\u202F]+)([А-Яа-яЁёA-Za-z0-9«„“"(\[])/g;
    let replacementCount = 0;
    const formattedText = text.replace(regexp, function (match, leftChar, _leftSpace, _rightSpace, rightChar) {
        const isNumberRange = /\d/.test(leftChar) && /\d/.test(rightChar);
        if (isNumberRange) {
            return match;
        }
        const normalized = leftChar + "\u00A0— " + rightChar;
        if (match === normalized) {
            return match;
        }
        replacementCount += 1;
        return normalized;
    });
    return {
        formattedText,
        replacementCount,
    };
}
function applyRussianShortWordsNbspRule(text, settings) {
    const regularNbsp = "\u00A0";
    const abbreviationSpace = getConfiguredNbsp(settings);
    let formattedText = text;
    let replacementCount = 0;
    function replaceAndCount(regexp, replacer) {
        formattedText = formattedText.replace(regexp, function (...args) {
            const stringArgs = args.map(String);
            const match = stringArgs[0];
            const normalized = replacer(...stringArgs);
            if (match === normalized) {
                return match;
            }
            replacementCount += 1;
            return normalized;
        });
    }
    const shortWords = "а|в|во|и|к|ко|о|об|от|по|с|со|у|до|за|из|на|не|ни|но";
    replaceAndCount(new RegExp("(^|[ \\t\\u00A0\\u202F(«„“])(" +
        shortWords +
        ")[ \\t\\u00A0\\u202F]+(?=[А-Яа-яЁёA-Za-z0-9])", "giu"), function (_match, prefix, word) {
        return prefix + word + regularNbsp;
    });
    replaceAndCount(/(^|[^А-Яа-яЁёA-Za-z])([тТ])\.[ \t\u00A0\u202F]*([еЕкКдДпПчЧнНоО])\./g, function (_match, prefix, firstLetter, secondLetter) {
        return prefix + firstLetter + "." + abbreviationSpace + secondLetter + ".";
    });
    return {
        formattedText,
        replacementCount,
    };
}
function applyRussianInitialsNbspRule(text, settings) {
    const space = getConfiguredNbsp(settings);
    let formattedText = text;
    let replacementCount = 0;
    formattedText = formattedText.replace(/(^|[^А-Яа-яЁёA-Za-z])([А-ЯЁA-Z])\.[ \t\u00A0\u202F]*([А-ЯЁA-Z])\.[ \t\u00A0\u202F]+([А-ЯЁA-Z][А-Яа-яЁёA-Za-z-]+)/g, function (match, prefix, firstInitial, secondInitial, surname) {
        const normalized = prefix +
            firstInitial +
            "." +
            space +
            secondInitial +
            "." +
            space +
            surname;
        if (match === normalized) {
            return match;
        }
        replacementCount += 1;
        return normalized;
    });
    formattedText = formattedText.replace(/(^|[^А-Яа-яЁёA-Za-z])([А-ЯЁA-Z])\.[ \t\u00A0\u202F]+([А-ЯЁA-Z][А-Яа-яЁёA-Za-z-]+)/g, function (match, prefix, initial, surname) {
        const normalized = prefix + initial + "." + space + surname;
        if (match === normalized) {
            return match;
        }
        replacementCount += 1;
        return normalized;
    });
    return {
        formattedText,
        replacementCount,
    };
}
function applyRussianNumericAbbreviationsRule(text) {
    let formattedText = text;
    let replacementCount = 0;
    function replaceAndCount(regexp, replacer) {
        formattedText = formattedText.replace(regexp, function (...args) {
            const stringArgs = args.map(String);
            const match = stringArgs[0];
            const normalized = replacer(...stringArgs);
            if (match === normalized) {
                return match;
            }
            replacementCount += 1;
            return normalized;
        });
    }
    replaceAndCount(/(^|[^А-Яа-яЁёA-Za-z])((?:млн|млрд|трлн))\.(?=$|[ \t\u00A0\u202F\n\r,.;:!?…),])/giu, function (_match, prefix, abbreviation) {
        return prefix + abbreviation;
    });
    replaceAndCount(/(^|[^А-Яа-яЁёA-Za-z])([тТ]ыс)(?!\.)(?=$|[ \t\u00A0\u202F\n\r,;:!?…),])/g, function (_match, prefix, abbreviation) {
        return prefix + abbreviation + ".";
    });
    return {
        formattedText,
        replacementCount,
    };
}
function applyRussianLargeNumbersRule(text, settings) {
    const space = getConfiguredNbsp(settings);
    const regexp = /(^|[^0-9A-Za-zА-Яа-яЁё])([0-9](?:[0-9 \t\u00A0\u202F]*[0-9]){4,})(?=$|[^0-9A-Za-zА-Яа-яЁё,.-])/g;
    let replacementCount = 0;
    const formattedText = text.replace(regexp, function (match, prefix, numberWithPossibleSpaces) {
        const rawNumber = numberWithPossibleSpaces.replace(/[ \t\u00A0\u202F]/g, "");
        if (rawNumber.length < 5) {
            return match;
        }
        const formattedNumber = rawNumber.replace(/\B(?=([0-9]{3})+(?![0-9]))/g, space);
        const normalized = prefix + formattedNumber;
        if (match === normalized) {
            return match;
        }
        replacementCount += 1;
        return normalized;
    });
    return {
        formattedText,
        replacementCount,
    };
}
function shouldKeepRussianFinalPeriod(textEndingWithPeriod) {
    const protectedAbbreviations = /(^|[^А-Яа-яЁёA-Za-z])((?:т\.[ \t\u00A0\u202F]*[екдпчно]\.)|(?:и[ \t\u00A0\u202F]+т\.[ \t\u00A0\u202F]*[дп]\.)|(?:в[ \t\u00A0\u202F]+т\.[ \t\u00A0\u202F]*ч\.)|(?:руб\.|тыс\.|г\.|ул\.|д\.|стр\.))$/iu;
    return protectedAbbreviations.test(textEndingWithPeriod);
}
function applyRussianUiFinalPeriodRule(text) {
    const trailingWhitespaceMatch = text.match(/[ \t\r\n\u00A0\u202F]*$/);
    const trailingWhitespace = trailingWhitespaceMatch
        ? trailingWhitespaceMatch[0]
        : "";
    const textWithoutTrailingWhitespace = text.slice(0, text.length - trailingWhitespace.length);
    if (!textWithoutTrailingWhitespace.endsWith(".")) {
        return {
            formattedText: text,
            replacementCount: 0,
        };
    }
    if (shouldKeepRussianFinalPeriod(textWithoutTrailingWhitespace)) {
        return {
            formattedText: text,
            replacementCount: 0,
        };
    }
    return {
        formattedText: textWithoutTrailingWhitespace.slice(0, -1) + trailingWhitespace,
        replacementCount: 1,
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
        id: "percentSignNoSpace",
        supportedLanguages: "all",
        apply: applyPercentSignNoSpaceRule,
    },
    {
        id: "numberUnitsNbsp",
        supportedLanguages: "all",
        apply: applyNumberUnitsNbspRule,
    },
    {
        id: "specialSymbols",
        supportedLanguages: "all",
        apply: applySpecialSymbolsRule,
    },
    {
        id: "russianQuotes",
        supportedLanguages: ["ru"],
        apply: applyRussianQuotesRule,
    },
    {
        id: "russianNumberRangeDash",
        supportedLanguages: ["ru"],
        apply: applyRussianNumberRangeDashRule,
    },
    {
        id: "russianSentenceDash",
        supportedLanguages: ["ru"],
        apply: applyRussianSentenceDashRule,
    },
    {
        id: "russianShortWordsNbsp",
        supportedLanguages: ["ru"],
        apply: applyRussianShortWordsNbspRule,
    },
    {
        id: "russianInitialsNbsp",
        supportedLanguages: ["ru"],
        apply: applyRussianInitialsNbspRule,
    },
    {
        id: "russianNumericAbbreviations",
        supportedLanguages: ["ru"],
        apply: applyRussianNumericAbbreviationsRule,
    },
    {
        id: "russianLargeNumbers",
        supportedLanguages: ["ru"],
        apply: applyRussianLargeNumbersRule,
    },
    {
        id: "russianUiFinalPeriod",
        supportedLanguages: ["ru"],
        apply: applyRussianUiFinalPeriodRule,
    },
];
function isRuleSupportedForLanguage(rule, language) {
    if (rule.supportedLanguages === "all") {
        return true;
    }
    return rule.supportedLanguages.includes(language);
}
function applyRulesToText(text, settings, language) {
    let formattedText = text;
    let replacementCount = 0;
    let skippedRuleCount = 0;
    for (const rule of TYPOGRAPHY_RULES) {
        if (!settings.enabledRules[rule.id]) {
            continue;
        }
        if (!isRuleSupportedForLanguage(rule, language)) {
            skippedRuleCount += 1;
            continue;
        }
        const result = rule.apply(formattedText, settings);
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
        const result = applyRulesToText(originalText, settings, language);
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
