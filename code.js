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
        const enabledRules = safeSettings.enabledRules;
        const cleanedOriginalText = enabledRules.invisibleCopyArtifacts
            ? removeInvisibleCopyArtifacts(originalText)
            : originalText;
        const protectedText = protectSegments(cleanedOriginalText);
        let text = protectedText.text;
        let replacementCount = cleanedOriginalText !== originalText ? 1 : 0;
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
        applyRule(enabledRules.tabs, null, normalizeTabs);
        applyRule(enabledRules.specialSymbols, null, normalizeInchMarks);
        applyRule(enabledRules.englishApostrophes, ["en"], normalizeEnglishApostrophes);
        applyRule(enabledRules.englishQuotes, ["en"], (value) => normalizeEnglishQuotes(value, safeSettings.options.quoteOptions.en));
        applyRule(enabledRules.russianQuotes, ["ru"], (value) => normalizeQuotes(value, safeSettings.options.quoteOptions.ru));
        applyRule(enabledRules.manualLineBreaks, null, normalizeManualLineBreaks);
        applyRule(enabledRules.ellipsis, null, normalizeEllipsis);
        applyRule(enabledRules.percentSignNoSpace, null, normalizePercentSign);
        applyRule(enabledRules.specialSymbols, null, normalizeSpecialSymbols);
        applyRule(enabledRules.numberSigns, null, normalizeNumberSigns);
        applyRule(enabledRules.numberRangeDash, null, normalizeNumberRanges);
        applyRule(enabledRules.numberUnitsNbsp, null, (value) => normalizeNumberUnits(value, getNumericNbsp(safeSettings)));
        applyRule(enabledRules.russianNumericAbbreviations, ["ru"], (value) => normalizeRussianNumericAbbreviations(value, getNumericNbsp(safeSettings)));
        applyRule(enabledRules.russianLargeNumbers, ["ru"], (value) => normalizeRussianLargeNumbers(value, getNumericNbsp(safeSettings)));
        applyRule(enabledRules.russianSentenceDash, ["ru"], normalizeRussianSentenceDash);
        applyRule(enabledRules.russianInitialsNbsp, ["ru"], normalizeRussianInitials);
        applyRule(enabledRules.spacingCleanup, null, normalizeSpacing);
        applyRule(enabledRules.russianShortWordsNbsp, ["ru"], normalizeRussianShortWords);
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
        function protectValue(value) {
            const token = `\uE000${segments.length}\uE001`;
            segments.push({ token, value });
            return token;
        }
        function protectBalancedBraces(value) {
            let depth = 0;
            let segmentStart = -1;
            let untouchedStart = 0;
            let result = "";
            for (let index = 0; index < value.length; index += 1) {
                const character = value[index];
                if (character === "{") {
                    if (depth === 0) {
                        segmentStart = index;
                    }
                    depth += 1;
                    continue;
                }
                if (character !== "}" || depth === 0) {
                    continue;
                }
                depth -= 1;
                if (depth === 0 && segmentStart >= 0) {
                    result += value.slice(untouchedStart, segmentStart);
                    result += protectValue(value.slice(segmentStart, index + 1));
                    untouchedStart = index + 1;
                    segmentStart = -1;
                }
            }
            result += value.slice(untouchedStart);
            return result;
        }
        const bracesProtectedValue = protectBalancedBraces(text);
        const protectedPattern = /https?:\/\/[^\s<()]+|www\.[^\s<()]+|\b(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}(?:\/[^\s<()]*)?|[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|`[^`]*`|<!--[\s\S]*?-->|<\/?[A-Za-z][A-Za-z0-9:-]*(?:\s+[^\r\n<>]*?)?\s*\/?>|&[#A-Za-z0-9]+;|\{[^{}]*\}|\b[A-Za-z][A-Za-z0-9]*(?:[._/-][A-Za-z0-9]+){2,}\b/g;
        const protectedValue = bracesProtectedValue.replace(protectedPattern, (value) => protectValue(value));
        return {
            text: protectedValue,
            segments,
        };
    }
    function restoreSegments(text, segments) {
        let restoredText = text;
        for (let index = segments.length - 1; index >= 0; index -= 1) {
            const segment = segments[index];
            restoredText = restoredText.split(segment.token).join(segment.value);
        }
        return restoredText;
    }
    function isEmojiJoinBase(codePoint) {
        return (codePoint === 0x00a9 ||
            codePoint === 0x00ae ||
            codePoint === 0x203c ||
            codePoint === 0x2049 ||
            codePoint === 0x2122 ||
            codePoint === 0x2139 ||
            (codePoint >= 0x2194 && codePoint <= 0x2199) ||
            (codePoint >= 0x21a9 && codePoint <= 0x21aa) ||
            (codePoint >= 0x231a && codePoint <= 0x231b) ||
            codePoint === 0x2328 ||
            codePoint === 0x23cf ||
            (codePoint >= 0x23e9 && codePoint <= 0x23f3) ||
            (codePoint >= 0x23f8 && codePoint <= 0x23fa) ||
            codePoint === 0x24c2 ||
            (codePoint >= 0x25aa && codePoint <= 0x25ab) ||
            codePoint === 0x25b6 ||
            codePoint === 0x25c0 ||
            (codePoint >= 0x25fb && codePoint <= 0x25fe) ||
            (codePoint >= 0x2600 && codePoint <= 0x27bf) ||
            (codePoint >= 0x2934 && codePoint <= 0x2935) ||
            (codePoint >= 0x2b05 && codePoint <= 0x2b07) ||
            (codePoint >= 0x2b1b && codePoint <= 0x2b1c) ||
            codePoint === 0x2b50 ||
            codePoint === 0x2b55 ||
            codePoint === 0x3030 ||
            codePoint === 0x303d ||
            codePoint === 0x3297 ||
            codePoint === 0x3299 ||
            (codePoint >= 0x1f000 && codePoint <= 0x1faff));
    }
    function isEmojiVariationOrModifier(codePoint) {
        return (codePoint === 0xfe0e ||
            codePoint === 0xfe0f ||
            (codePoint >= 0x1f3fb && codePoint <= 0x1f3ff));
    }
    function findEmojiBaseBefore(characters, index) {
        for (let currentIndex = index - 1; currentIndex >= 0; currentIndex--) {
            const codePoint = characters[currentIndex].codePointAt(0);
            if (codePoint === undefined) {
                return null;
            }
            if (isEmojiVariationOrModifier(codePoint)) {
                continue;
            }
            return isEmojiJoinBase(codePoint) ? codePoint : null;
        }
        return null;
    }
    function findEmojiBaseAfter(characters, index) {
        for (let currentIndex = index + 1; currentIndex < characters.length; currentIndex++) {
            const codePoint = characters[currentIndex].codePointAt(0);
            if (codePoint === undefined) {
                return null;
            }
            if (isEmojiVariationOrModifier(codePoint)) {
                continue;
            }
            return isEmojiJoinBase(codePoint) ? codePoint : null;
        }
        return null;
    }
    function removeInvisibleCopyArtifacts(text) {
        const characters = Array.from(text);
        return characters
            .filter((character, index) => {
            const codePoint = character.codePointAt(0);
            if (codePoint === 0x200d) {
                return (findEmojiBaseBefore(characters, index) !== null &&
                    findEmojiBaseAfter(characters, index) !== null);
            }
            return (codePoint !== 0x200b &&
                codePoint !== 0x200c &&
                codePoint !== 0x2060 &&
                codePoint !== 0xfeff);
        })
            .join("");
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
        return text.replace(/\.{3,}/g, "…");
    }
    function normalizePercentSign(text) {
        return text.replace(/(\d)[ \t\u00A0\u202F]+%/g, "$1%");
    }
    function normalizeInchMarks(text) {
        return text.replace(/(^|[^"\d])(\d+(?:[.,]\d+)?)"(?=$|[ \t\n.,;:!?)}\]"'«»„“”‘’‚])/g, "$1$2″");
    }
    function normalizeSpecialSymbols(text) {
        const withBasicSymbols = normalizeInchMarks(text)
            .replace(/\(c\)/gi, "©")
            .replace(/\(tm\)/gi, "™")
            .replace(/\+\/-/g, "±")
            .replace(/!=/g, "≠")
            .replace(/<=/g, "≤")
            .replace(/>=/g, "≥")
            .replace(/(^|[ \t\n])->(?=[ \t\n]|$)/g, "$1→")
            .replace(/(^|[ \t\n])<-(?=[ \t\n]|$)/g, "$1←")
            .replace(/(\d)[ \t\u00A0\u202F]*[xх][ \t\u00A0\u202F]*(\d)/gi, "$1×$2");
        const fractions = [
            [/(^|[^\d/])1\/2(?![\d/])/g, "½"],
            [/(^|[^\d/])1\/3(?![\d/])/g, "⅓"],
            [/(^|[^\d/])2\/3(?![\d/])/g, "⅔"],
            [/(^|[^\d/])1\/4(?![\d/])/g, "¼"],
            [/(^|[^\d/])3\/4(?![\d/])/g, "¾"],
        ];
        return fractions.reduce((value, [pattern, replacement]) => value.replace(pattern, (_match, prefix) => `${prefix}${replacement}`), withBasicSymbols);
    }
    function normalizeNumberSigns(text) {
        return text.replace(/([№§])\s*(\d)/g, `$1${REGULAR_NBSP}$2`);
    }
    function normalizeNumberRanges(text) {
        const spaces = "[ \t\u00A0\u202F]*";
        const number = "[+-]?\\d+(?:[,.]\\d+)?";
        const numberSignChainPattern = new RegExp(`([№§]${spaces})(${number}(?:${spaces}[-–—]${spaces}${number})+)(?![+\-–—0-9A-Za-zА-Яа-яЁё])`, "g");
        const afterNumberSigns = text.replace(numberSignChainPattern, (_match, signWithSpace, chain) => {
            const rangeMatch = chain.match(new RegExp(`^(${number})${spaces}[-–—]${spaces}(${number})$`));
            if (!rangeMatch) {
                return `${signWithSpace}${chain}`;
            }
            return `${signWithSpace}${rangeMatch[1]}–${rangeMatch[2]}`;
        });
        const numericChainPattern = /(^|[^+\-–—0-9A-Za-zА-Яа-яЁё])([+-]?\d+(?:[,.]\d+)?(?:[ \t\u00A0\u202F]*[-–—][ \t\u00A0\u202F]*[+-]?\d+(?:[,.]\d+)?)+)(?![+\-–—0-9A-Za-zА-Яа-яЁё])/g;
        return afterNumberSigns.replace(numericChainPattern, (_match, prefix, chain) => {
            const rangeMatch = chain.match(/^([+-]?\d+(?:[,.]\d+)?)([ \t\u00A0\u202F]*)([-–—])([ \t\u00A0\u202F]*)([+-]?\d+(?:[,.]\d+)?)$/);
            if (!rangeMatch) {
                return `${prefix}${chain}`;
            }
            const [, start, spacesBefore, separator, spacesAfter, end] = rangeMatch;
            if (separator === "-" && (spacesBefore || spacesAfter)) {
                return `${prefix}${chain}`;
            }
            return `${prefix}${start}–${end}`;
        });
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
            .replace(/(\d+(?:[,.]\d+)?)[ \t\u00A0\u202F]*(тыс)(?:\.|(?=\s|$|[,!?:;)]))/gi, (_match, number, abbreviation) => `${number}${nbsp}${abbreviation}.`)
            .replace(/(\d+(?:[,.]\d+)?)[ \t\u00A0\u202F]*(млн|млрд|трлн)\.?(?=\s|$|[,.!?:;)])/gi, (_match, number, abbreviation) => `${number}${nbsp}${abbreviation}`);
    }
    function normalizeRussianLargeNumbers(text, nbsp) {
        const groupSeparator = nbsp;
        function formatLargeNumber(value) {
            const digitsOnly = value.replace(/[\s\u00A0\u202F\u2060]/g, "");
            if (!/^\d{5,}$/.test(digitsOnly)) {
                return value;
            }
            return digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator);
        }
        return text
            .replace(/\b\d{1,3}(?:[ \t\u00A0\u202F\u2060]+\d{3})+\b/g, formatLargeNumber)
            .replace(/\b\d{5,}\b/g, formatLargeNumber);
    }
    function normalizeEnglishApostrophes(text) {
        const protectedDelimiters = [];
        const delimiterPositions = new Set();
        function isOpeningDelimiterPosition(value, index) {
            const previousCharacter = value[index - 1];
            const nextCharacter = value[index + 1];
            const followingText = value.slice(index + 1);
            return ((index === 0 || /[\s([{<—–-]/.test(previousCharacter)) &&
                /[A-Za-z]/.test(nextCharacter || "") &&
                !/^(?:cause|em)\b/i.test(followingText));
        }
        function findClosingDelimiter(value, openingIndex) {
            for (let index = openingIndex + 1; index < value.length; index += 1) {
                if (value[index] !== "'") {
                    continue;
                }
                const previousCharacter = value[index - 1] || "";
                const nextCharacter = value[index + 1] || "";
                if (/[A-Za-z]/.test(previousCharacter) && /[A-Za-z]/.test(nextCharacter)) {
                    continue;
                }
                if (/[A-Za-z]/.test(previousCharacter) &&
                    (index === value.length - 1 || /[\s.,;:!?)}\]>—–-]/.test(nextCharacter))) {
                    return index;
                }
            }
            return -1;
        }
        for (let index = 0; index < text.length; index += 1) {
            if (text[index] !== "'" || !isOpeningDelimiterPosition(text, index)) {
                continue;
            }
            const closingIndex = findClosingDelimiter(text, index);
            if (closingIndex < 0) {
                continue;
            }
            const quotedContent = text.slice(index + 1, closingIndex);
            if (/^[nN]$/.test(quotedContent)) {
                continue;
            }
            delimiterPositions.add(index);
            delimiterPositions.add(closingIndex);
            index = closingIndex;
        }
        let protectedText = "";
        for (let index = 0; index < text.length; index += 1) {
            if (!delimiterPositions.has(index)) {
                protectedText += text[index];
                continue;
            }
            const token = `\uE200${protectedDelimiters.length}\uE201`;
            protectedDelimiters.push(text[index]);
            protectedText += token;
        }
        const normalized = protectedText
            .replace(/(^|[^A-Za-z0-9])'n'(?=$|[^A-Za-z0-9])/gi, "$1’n’")
            .replace(/(^|[\s([{<—–-])'(cause|em)\b/gi, "$1’$2")
            .replace(/([A-Za-z])'([A-Za-z])/g, "$1’$2")
            .replace(/\b([A-Za-z]+[sS])'(?=$|[\s.,;:!?)}\]])/g, "$1’")
            .replace(/(^|[^A-Za-z0-9])'(?=\d{2}(?:s\b|\b))/g, "$1’");
        return protectedDelimiters.reduce((value, delimiter, index) => value.split(`\uE200${index}\uE201`).join(delimiter), normalized);
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
    function normalizeQuotePairs(text, options) {
        const primaryQuotePair = getQuotePair(options.primaryQuoteStyle);
        const secondaryQuotePair = getQuotePair(options.secondaryQuoteStyle);
        const doubleQuoteCharacters = new Set(["\"", "«", "»", "„", "“", "”"]);
        const singleQuoteCharacters = new Set(["'", "‘", "’", "‚"]);
        function getQuoteKind(character) {
            if (doubleQuoteCharacters.has(character)) {
                return "double";
            }
            if (singleQuoteCharacters.has(character)) {
                return "single";
            }
            return null;
        }
        function isQuoteCharacter(character) {
            return getQuoteKind(character) !== null;
        }
        function getTokenBounds(value, index) {
            let start = index;
            let end = index + 1;
            while (start > 0 && !/\s/.test(value[start - 1])) {
                start -= 1;
            }
            while (end < value.length && !/\s/.test(value[end])) {
                end += 1;
            }
            return [start, end];
        }
        function isInsideEmailLikeToken(value, index) {
            const [start, end] = getTokenBounds(value, index);
            const token = value.slice(start, end);
            return token.includes("@") && /@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(token);
        }
        function previousNonSpaceIndex(value, index) {
            for (let current = index - 1; current >= 0; current -= 1) {
                if (!/\s/.test(value[current])) {
                    return current;
                }
            }
            return -1;
        }
        function nextNonSpaceIndex(value, index) {
            for (let current = index + 1; current < value.length; current += 1) {
                if (!/\s/.test(value[current])) {
                    return current;
                }
            }
            return -1;
        }
        function hasLaterSingleQuote(value, index) {
            for (let current = index + 1; current < value.length; current += 1) {
                if (singleQuoteCharacters.has(value[current]) &&
                    value[current - 1] !== "\\") {
                    return true;
                }
            }
            return false;
        }
        function isLikelyApostrophe(value, index, stack) {
            const character = value[index];
            if (!singleQuoteCharacters.has(character)) {
                return false;
            }
            const previousCharacter = value[index - 1] || "";
            const nextCharacter = value[index + 1] || "";
            const previousIsAlphaNumeric = /[A-Za-zА-Яа-яЁё0-9]/.test(previousCharacter);
            const nextIsAlphaNumeric = /[A-Za-zА-Яа-яЁё0-9]/.test(nextCharacter);
            if (previousIsAlphaNumeric && nextIsAlphaNumeric) {
                return true;
            }
            if (/\d/.test(previousCharacter) || /\d/.test(nextCharacter)) {
                return true;
            }
            const followingText = value.slice(index);
            if (/^[\'‘’‚](?:cause|em)\b/i.test(followingText)) {
                return true;
            }
            if (/^[\'‘’‚]n[\'‘’‚](?:\b|$)/i.test(followingText)) {
                return true;
            }
            const previousTwoCharacters = value.slice(Math.max(0, index - 2), index + 1);
            if (/[\'‘’‚]n[\'‘’‚]$/i.test(previousTwoCharacters)) {
                return true;
            }
            if (!previousIsAlphaNumeric) {
                return false;
            }
            const nextIndex = nextNonSpaceIndex(value, index);
            const nextNonSpace = nextIndex >= 0 ? value[nextIndex] : "";
            const followedByAnotherWord = /\s/.test(nextCharacter) &&
                /[A-Za-zА-Яа-яЁё0-9]/.test(nextNonSpace);
            if (followedByAnotherWord) {
                if (stack.length === 0 || stack[stack.length - 1].kind !== "single") {
                    return true;
                }
                if (hasLaterSingleQuote(value, index)) {
                    return true;
                }
            }
            return stack.length === 0;
        }
        function collectQuotePairs(value) {
            const pairs = [];
            const stack = [];
            for (let index = 0; index < value.length; index += 1) {
                const character = value[index];
                const kind = getQuoteKind(character);
                if (!kind || value[index - 1] === "\\") {
                    continue;
                }
                if (isInsideEmailLikeToken(value, index)) {
                    continue;
                }
                const previousIndex = previousNonSpaceIndex(value, index);
                const nextIndex = nextNonSpaceIndex(value, index);
                const previousCharacter = previousIndex >= 0 ? value[previousIndex] : "";
                const nextCharacter = nextIndex >= 0 ? value[nextIndex] : "";
                const immediatePrevious = value[index - 1] || "";
                const immediateNext = value[index + 1] || "";
                if (isLikelyApostrophe(value, index, stack)) {
                    continue;
                }
                if (stack.length === 0 && /\d/.test(immediatePrevious)) {
                    continue;
                }
                const openingSignal = nextIndex >= 0 &&
                    (previousIndex < 0 ||
                        /\s/.test(immediatePrevious) ||
                        /[([{<—–,:;!?-]/.test(previousCharacter) ||
                        isQuoteCharacter(immediatePrevious));
                const closingSignal = previousIndex >= 0 &&
                    (nextIndex < 0 ||
                        /\s/.test(immediateNext) ||
                        /[.,;:!?…\])}>—–-]/.test(nextCharacter) ||
                        isQuoteCharacter(immediateNext));
                if (stack.length === 0) {
                    if (openingSignal || isQuoteCharacter(immediateNext)) {
                        stack.push({ index, depth: 0, kind });
                    }
                    continue;
                }
                const strongClosing = nextIndex < 0 ||
                    isQuoteCharacter(immediateNext) ||
                    /[.,;:!?…\])}>—–-]/.test(nextCharacter);
                const strongOpening = openingSignal &&
                    !strongClosing &&
                    (previousIndex < 0 ||
                        /\s/.test(immediatePrevious) ||
                        isQuoteCharacter(immediatePrevious));
                if (strongOpening) {
                    stack.push({ index, depth: stack.length, kind });
                    continue;
                }
                if (closingSignal || !openingSignal) {
                    const opening = stack.pop();
                    if (opening) {
                        pairs.push({
                            start: opening.index,
                            end: index,
                            depth: opening.depth,
                        });
                    }
                    continue;
                }
                stack.push({ index, depth: stack.length, kind });
            }
            return pairs;
        }
        return text
            .split("\n")
            .map((line) => {
            const replacements = new Map();
            const quotePairs = collectQuotePairs(line);
            for (const pair of quotePairs) {
                const quotePair = pair.depth % 2 === 0 ? primaryQuotePair : secondaryQuotePair;
                replacements.set(pair.start, quotePair.open);
                replacements.set(pair.end, quotePair.close);
            }
            let result = "";
            for (let index = 0; index < line.length; index += 1) {
                result += replacements.get(index) || line[index];
            }
            return result;
        })
            .join("\n");
    }
    function normalizeEnglishQuotes(text, options) {
        return normalizeQuotePairs(text, options);
    }
    function normalizeQuotes(text, options) {
        return normalizeQuotePairs(text, options);
    }
    function normalizeRussianSentenceDash(text) {
        const tokenSpacePattern = /[ \t\r\n\u00A0\u202F]/;
        const getTokenBefore = (value, endIndex) => {
            let startIndex = endIndex - 1;
            while (startIndex >= 0 && !tokenSpacePattern.test(value[startIndex])) {
                startIndex -= 1;
            }
            return value.slice(startIndex + 1, endIndex);
        };
        const getTokenAfter = (value, startIndex) => {
            let endIndex = startIndex;
            while (endIndex < value.length && !tokenSpacePattern.test(value[endIndex])) {
                endIndex += 1;
            }
            return value.slice(startIndex, endIndex);
        };
        const cleanToken = (token) => token
            .replace(/^[([{«„“"']+/, "")
            .replace(/[)\]}»“”"'.,;:!?…]+$/, "");
        const shouldKeepSeparator = (value, leftTokenEnd, rightTokenStart) => {
            const leftToken = cleanToken(getTokenBefore(value, leftTokenEnd));
            const rightToken = cleanToken(getTokenAfter(value, rightTokenStart));
            const numericTokenPattern = /^[+-]?\d+(?:[.,]\d+)?$/;
            const latinVariablePattern = /^[A-Za-z]$/;
            return ((numericTokenPattern.test(leftToken) &&
                numericTokenPattern.test(rightToken)) ||
                (latinVariablePattern.test(leftToken) &&
                    latinVariablePattern.test(rightToken)));
        };
        const withSpacesOnBothSides = /([^\s])([ \t\u00A0\u202F]+)[-–—]([ \t\u00A0\u202F]+)([^\s])/g;
        const withNbspBeforeEmDash = /([^\s])([\u00A0\u202F])—([ \t\u00A0\u202F]*)([^\s])/g;
        return text
            .replace(withSpacesOnBothSides, (match, leftCharacter, leftSpaces, rightSpaces, rightCharacter, offset, value) => {
            const leftTokenEnd = offset + 1;
            const rightTokenStart = offset + 1 + leftSpaces.length + 1 + rightSpaces.length;
            if (shouldKeepSeparator(value, leftTokenEnd, rightTokenStart)) {
                return match;
            }
            return `${leftCharacter}${REGULAR_NBSP}— ${rightCharacter}`;
        })
            .replace(withNbspBeforeEmDash, (match, leftCharacter, _nbsp, spacesAfter, rightCharacter, offset, value) => {
            const leftTokenEnd = offset + 1;
            const rightTokenStart = offset + 1 + 1 + 1 + spacesAfter.length;
            if (shouldKeepSeparator(value, leftTokenEnd, rightTokenStart)) {
                return match;
            }
            return `${leftCharacter}${REGULAR_NBSP}— ${rightCharacter}`;
        });
    }
    function normalizeRussianInitials(text) {
        const initialsBeforeSurname = /(^|[^А-Яа-яЁё])([А-ЯЁ])\.[ \t\u00A0\u202F]*(?:([А-ЯЁ])\.[ \t\u00A0\u202F]*)?([А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?)/g;
        const surnameBeforeInitials = /(^|[^А-Яа-яЁё])([А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?)[ \t\u00A0\u202F]+([А-ЯЁ])\.[ \t\u00A0\u202F]*(?:([А-ЯЁ])\.)?(?=$|[ \t\u00A0\u202F]*[,;:!?)]|\n)/g;
        return text
            .replace(initialsBeforeSurname, (_match, prefix, firstInitial, secondInitial, familyName) => secondInitial
            ? `${prefix}${firstInitial}.${REGULAR_NBSP}${secondInitial}.${REGULAR_NBSP}${familyName}`
            : `${prefix}${firstInitial}.${REGULAR_NBSP}${familyName}`)
            .replace(surnameBeforeInitials, (_match, prefix, familyName, firstInitial, secondInitial) => secondInitial
            ? `${prefix}${familyName}${REGULAR_NBSP}${firstInitial}.${REGULAR_NBSP}${secondInitial}.`
            : `${prefix}${familyName}${REGULAR_NBSP}${firstInitial}.`);
    }
    function normalizeRussianShortWords(text) {
        const shortWords = "а|в|во|и|к|ко|с|со|у|о|об|обо|от|до|из|за|на|не|но|по|под|над|при|про|для|без|или|же|ли|бы";
        const horizontalSpacing = `[ \t${REGULAR_NBSP}${NARROW_NBSP}]`;
        const openingDelimiters = `[([{«„“‘‚"]*`;
        const shortWordPatternSource = `(^|[ \t${REGULAR_NBSP}${NARROW_NBSP}([{«„“])` +
            `(${shortWords})(${horizontalSpacing}+)(?=${openingDelimiters}[А-Яа-яЁёA-Za-z0-9])`;
        const abbreviationSpacing = `${horizontalSpacing}*`;
        const abbreviationBoundary = `(^|[^А-Яа-яЁё])`;
        const normalizeTwoPartAbbreviation = (input, first, second) => input.replace(new RegExp(`${abbreviationBoundary}${first}\\.${abbreviationSpacing}${second}\\.`, "gi"), (_match, prefix) => `${prefix}${first}.${REGULAR_NBSP}${second}.`);
        let result = text;
        result = normalizeTwoPartAbbreviation(result, "т", "е");
        result = normalizeTwoPartAbbreviation(result, "т", "к");
        result = normalizeTwoPartAbbreviation(result, "т", "д");
        result = normalizeTwoPartAbbreviation(result, "т", "п");
        result = result.replace(new RegExp(`${abbreviationBoundary}в${horizontalSpacing}+т\\.${abbreviationSpacing}ч\\.`, "gi"), (_match, prefix) => `${prefix}в${REGULAR_NBSP}т.${REGULAR_NBSP}ч.`);
        result = result
            .replace(/(^|[\s([{«„“])(г-н|г-жа|г-да|тов\.)[ \t\u00A0\u202F]+(?=[А-ЯЁA-Z])/g, `$1$2${REGULAR_NBSP}`)
            .replace(/(^|[\s([{«„“])(г\.|ул\.|пр-т|просп\.|пер\.|пл\.|о-в|о-ва|р-н|обл\.|с\.|д\.)[ \t\u00A0\u202F]+(?=[А-ЯЁA-Z])/g, `$1$2${REGULAR_NBSP}`)
            .replace(/(^|[\s([{«„“])(гл\.|рис\.|табл\.|стр\.|с\.|п\.|ч\.|разд\.|подп\.)[ \t\u00A0\u202F]+(?=[0-9IVXLCDM])/gi, `$1$2${REGULAR_NBSP}`);
        return result.replace(/[^\r\n]+/g, (line) => {
            let normalizedLine = line;
            let searchIndex = 0;
            while (searchIndex < normalizedLine.length) {
                const shortWordPattern = new RegExp(shortWordPatternSource, "gi");
                shortWordPattern.lastIndex = searchIndex;
                const match = shortWordPattern.exec(normalizedLine);
                if (!match) {
                    break;
                }
                const prefix = match[1];
                const word = match[2];
                const spacing = match[3];
                const spacingStart = match.index + prefix.length + word.length;
                normalizedLine =
                    normalizedLine.slice(0, spacingStart) +
                        REGULAR_NBSP +
                        normalizedLine.slice(spacingStart + spacing.length);
                searchIndex = spacingStart;
            }
            return normalizedLine;
        });
    }
    function normalizeSpacing(text) {
        const withoutSpacesBeforePunctuation = text.replace(/[ \t\u00A0\u202F]+([,.;:!?])/g, "$1");
        const afterCommaSemicolonOrColon = withoutSpacesBeforePunctuation.replace(/([,;:])([ \t\u00A0\u202F]*)(?=([^\s]))/g, (_match, punctuation, _spaces, nextCharacter, offset, source) => {
            const previousCharacter = source[offset - 1] || "";
            if (punctuation !== ";" &&
                /\d/.test(previousCharacter) &&
                /\d/.test(nextCharacter)) {
                return punctuation;
            }
            if (nextCharacter === "’") {
                const characterAfterApostrophe = source[offset + _match.length + 1] || "";
                if (/[A-Za-z0-9]/.test(characterAfterApostrophe)) {
                    return `${punctuation} `;
                }
            }
            if (/[\]})»”’.,;:!?]/.test(nextCharacter)) {
                return punctuation;
            }
            return `${punctuation} `;
        });
        const afterQuestionOrExclamationSeries = afterCommaSemicolonOrColon.replace(/([!?]+)([ \t\u00A0\u202F]*)(?=([^\s]))/g, (_match, punctuationSeries, _spaces, nextCharacter, offset, source) => {
            if (/[\]})»”’.,;:!?]/.test(nextCharacter)) {
                return punctuationSeries;
            }
            if (/[“"']/.test(nextCharacter)) {
                const characterAfterQuote = source[offset + _match.length + 1] || "";
                if (!characterAfterQuote ||
                    /[\s\]})»”’.,;:!?]/.test(characterAfterQuote)) {
                    return punctuationSeries;
                }
            }
            return `${punctuationSeries} `;
        });
        return afterQuestionOrExclamationSeries
            .replace(/\(\s+/g, "(")
            .replace(/\s+\)/g, ")")
            .replace(/\[\s+/g, "[")
            .replace(/\s+\]/g, "]")
            .replace(/\{\s+/g, "{")
            .replace(/\s+\}/g, "}");
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
        if (bodyWithoutFinalPeriod.endsWith(".")) {
            return text;
        }
        if (bodyWithoutFinalPeriod.length > 80) {
            return text;
        }
        if (/[.!?…]\s+/.test(bodyWithoutFinalPeriod)) {
            return text;
        }
        if (/(?:[А-ЯЁA-Z]\.|(?:^|[^А-Яа-яЁё])т\.[ \t\u00A0\u202F]*[едкпч]|(?:^|[^А-Яа-яЁё])в[ \t\u00A0\u202F]+т\.[ \t\u00A0\u202F]*ч|тыс|руб)$/i.test(bodyWithoutFinalPeriod)) {
            return text;
        }
        return text.slice(0, text.length - (text.length - trimmedRight.length) - 1) +
            text.slice(trimmedRight.length);
    }
})(TypotypoEngine || (TypotypoEngine = {}));
/// <reference path="./typography-engine.ts" />
figma.showUI(__html__, {
    width: 420,
    height: 640,
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
    const safeUiSettings = {};
    if (rawLanguage === "ru" || rawLanguage === "en") {
        safeUiSettings.uiLanguage = rawLanguage;
    }
    if (rawSettings.theme === "light" ||
        rawSettings.theme === "dark" ||
        rawSettings.theme === "system") {
        safeUiSettings.theme = rawSettings.theme;
    }
    return safeUiSettings;
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
        if (!safeUiSettings.uiLanguage && !safeUiSettings.theme) {
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
function resolveSelectionScopeType(selection) {
    if (selection.length === 0) {
        return "currentPage";
    }
    if (selection.length > 1) {
        return "selectedLayers";
    }
    const node = selection[0];
    if (node.type === "TEXT") {
        return "textLayer";
    }
    if (node.type === "SECTION") {
        return "section";
    }
    if (node.type === "GROUP") {
        return "group";
    }
    if (node.type === "FRAME" ||
        node.type === "COMPONENT" ||
        node.type === "INSTANCE" ||
        node.type === "COMPONENT_SET") {
        return "frame";
    }
    return "selectedLayers";
}
function getSelectionKey(selection) {
    if (selection.length === 0) {
        return `page:${figma.currentPage.id}`;
    }
    return `selection:${selection
        .map((node) => node.id)
        .sort()
        .join(",")}`;
}
function resolveTextNodeTarget() {
    const selection = figma.currentPage.selection;
    const scopeType = resolveSelectionScopeType(selection);
    const selectionKey = getSelectionKey(selection);
    if (selection.length === 0) {
        return {
            targetScope: "currentPage",
            scopeType,
            selectionKey,
            selectedCount: 0,
            textNodes: collectTextNodesFromSceneNodeRoots(figma.currentPage.children),
        };
    }
    return {
        targetScope: "selection",
        scopeType,
        selectionKey,
        selectedCount: selection.length,
        textNodes: collectTextNodesFromSceneNodeRoots(selection),
    };
}
function getUniqueFontsForTextNode(node) {
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
        for (let index = 0; index < node.characters.length; index += 1) {
            addFont(node.getRangeFontName(index, index + 1));
        }
    }
    return Array.from(new Map(fonts.map((font) => [`${font.family}-${font.style}`, font])).values());
}
async function summarizeTextNodeAvailability(textNodes) {
    const summary = {
        totalTextNodeCount: textNodes.length,
        availableTextNodeCount: 0,
        skippedHiddenNodeCount: 0,
        skippedLockedNodeCount: 0,
        skippedEmptyNodeCount: 0,
        skippedMissingFontsNodeCount: 0,
    };
    const candidateNodes = [];
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
        candidateNodes.push(node);
    }
    const fontAvailability = new Map();
    function canLoadFont(font) {
        const key = `${font.family}-${font.style}`;
        const existing = fontAvailability.get(key);
        if (existing) {
            return existing;
        }
        const availability = figma
            .loadFontAsync(font)
            .then(() => true)
            .catch((error) => {
            console.warn(`Could not load font during selection analysis: ${key}`, error);
            return false;
        });
        fontAvailability.set(key, availability);
        return availability;
    }
    const availabilityResults = await Promise.all(candidateNodes.map(async (node) => {
        try {
            const fonts = getUniqueFontsForTextNode(node);
            const loaded = await Promise.all(fonts.map(canLoadFont));
            return loaded.every(Boolean);
        }
        catch (error) {
            console.warn("Could not inspect text node fonts during selection analysis:", error);
            return false;
        }
    }));
    for (const isAvailable of availabilityResults) {
        if (isAvailable) {
            summary.availableTextNodeCount += 1;
        }
        else {
            summary.skippedMissingFontsNodeCount += 1;
        }
    }
    return summary;
}
let selectionInfoRequestId = 0;
async function sendSelectionInfo() {
    const requestId = ++selectionInfoRequestId;
    const target = resolveTextNodeTarget();
    const availabilitySummary = await summarizeTextNodeAvailability(target.textNodes);
    if (requestId !== selectionInfoRequestId) {
        return;
    }
    figma.ui.postMessage({
        type: "selection-info",
        targetScope: target.targetScope,
        scopeType: target.scopeType,
        selectionKey: target.selectionKey,
        selectedCount: target.selectedCount,
        textNodeCount: availabilitySummary.totalTextNodeCount,
        availableTextNodeCount: availabilitySummary.availableTextNodeCount,
        skippedHiddenNodeCount: availabilitySummary.skippedHiddenNodeCount,
        skippedLockedNodeCount: availabilitySummary.skippedLockedNodeCount,
        skippedEmptyNodeCount: availabilitySummary.skippedEmptyNodeCount,
        skippedMissingFontsNodeCount: availabilitySummary.skippedMissingFontsNodeCount,
    });
}
function getCharacterStyleSnapshot(node, index) {
    return {
        textStyleId: node.getRangeTextStyleId(index, index + 1),
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
        textStyleId: style.textStyleId,
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
function getMappedStylesForFormattedText(originalText, formattedText, originalStyles) {
    const originalIndexByFormattedIndex = mapFormattedCharactersToOriginalCharacters(originalText, formattedText);
    return originalIndexByFormattedIndex.map((originalIndex) => originalStyles[originalIndex] || originalStyles[0]);
}
async function applyTextStyleIdsToFormattedText(node, mappedStyles) {
    if (mappedStyles.length === 0) {
        return;
    }
    let rangeStart = 0;
    let currentTextStyleId = mappedStyles[0].textStyleId;
    async function applyTextStyleIdToRange(start, end, textStyleId) {
        if (start >= end ||
            textStyleId === figma.mixed ||
            textStyleId.length === 0) {
            return;
        }
        try {
            await node.setRangeTextStyleIdAsync(start, end, textStyleId);
        }
        catch (error) {
            console.warn(`Could not restore textStyleId for range ${start}-${end}:`, error);
        }
    }
    for (let index = 1; index < mappedStyles.length; index++) {
        const textStyleId = mappedStyles[index].textStyleId;
        if (textStyleId === currentTextStyleId) {
            continue;
        }
        await applyTextStyleIdToRange(rangeStart, index, currentTextStyleId);
        rangeStart = index;
        currentTextStyleId = textStyleId;
    }
    await applyTextStyleIdToRange(rangeStart, mappedStyles.length, currentTextStyleId);
}
function applyVisualStylesToFormattedText(node, formattedText, mappedStyles) {
    if (mappedStyles.length === 0 || formattedText.length === 0) {
        return;
    }
    let rangeStart = 0;
    let currentStyle = mappedStyles[0];
    let currentStyleKey = getStyleKey(currentStyle);
    for (let index = 1; index < formattedText.length; index++) {
        const style = mappedStyles[index] || currentStyle;
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
async function applyStyleSnapshotsToFormattedText(node, originalText, formattedText, originalStyles) {
    if (originalStyles.length === 0 || formattedText.length === 0) {
        return;
    }
    const mappedStyles = getMappedStylesForFormattedText(originalText, formattedText, originalStyles);
    // Restore linked text styles first. Reapplying the saved visual properties
    // afterwards preserves local overrides without dropping the style link.
    await applyTextStyleIdsToFormattedText(node, mappedStyles);
    applyVisualStylesToFormattedText(node, formattedText, mappedStyles);
}
async function loadFontsFromStyleSnapshots(styles) {
    const fonts = styles
        .map((style) => style.fontName)
        .filter((fontName) => fontName !== figma.mixed);
    const uniqueFonts = Array.from(new Map(fonts.map((font) => [`${font.family}-${font.style}`, font])).values());
    await Promise.all(uniqueFonts.map((font) => figma.loadFontAsync(font)));
}
class MissingFontLoadError extends Error {
    constructor(fontName, originalError) {
        super(`Could not load font ${fontName.family} ${fontName.style}: ${getErrorMessage(originalError)}`);
        this.name = "MissingFontLoadError";
        this.fontName = fontName;
    }
}
async function loadFontsForTextNode(node) {
    const uniqueFonts = getUniqueFontsForTextNode(node);
    for (const font of uniqueFonts) {
        try {
            await figma.loadFontAsync(font);
        }
        catch (error) {
            throw new MissingFontLoadError(font, error);
        }
    }
}
function buildTextEditHunks(originalText, formattedText) {
    const hunks = [];
    let originalIndex = 0;
    let formattedIndex = 0;
    while (originalIndex < originalText.length ||
        formattedIndex < formattedText.length) {
        if (originalIndex < originalText.length &&
            formattedIndex < formattedText.length &&
            originalText[originalIndex] === formattedText[formattedIndex]) {
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
        hunks.push({
            start: originalIndex,
            end: nextOriginalIndex,
            insertedText: formattedText.slice(formattedIndex, nextFormattedIndex),
        });
        originalIndex = nextOriginalIndex;
        formattedIndex = nextFormattedIndex;
    }
    return hunks;
}
function applyTextEditHunk(node, hunk) {
    const { start, end, insertedText } = hunk;
    if (start === end) {
        if (insertedText.length === 0) {
            return;
        }
        const useStyle = start < node.characters.length ? "AFTER" : "BEFORE";
        node.insertCharacters(start, insertedText, useStyle);
        return;
    }
    if (insertedText.length === 0) {
        node.deleteCharacters(start, end);
        return;
    }
    // Insert before the original range and copy the style from its first
    // character. Then remove the shifted original range. This keeps linked
    // text styles, local overrides, mixed fonts, fills and other range styles
    // attached without rebuilding them property by property.
    node.insertCharacters(start, insertedText, "AFTER");
    node.deleteCharacters(start + insertedText.length, end + insertedText.length);
}
async function updateTextNodeCharactersPreservingStyles(node, formattedText) {
    const originalText = node.characters;
    await loadFontsForTextNode(node);
    const hunks = buildTextEditHunks(originalText, formattedText);
    for (let index = hunks.length - 1; index >= 0; index--) {
        applyTextEditHunk(node, hunks[index]);
    }
    if (node.characters !== formattedText) {
        throw new Error("Could not apply formatted text exactly");
    }
}
const LIST_LINE_BREAK_TOKEN_PREFIX = "\uE000";
const LIST_LINE_BREAK_TOKEN_SUFFIX = "\uE001";
const LIST_LINE_BREAK_TOKEN_MIDDLE_START = 0xe100;
const LIST_LINE_BREAK_TOKEN_MIDDLE_END = 0xf8ff;
function rangeHasListFormatting(node, start, end) {
    if (start < 0 || end > node.characters.length || start >= end) {
        return false;
    }
    const getRangeListOptions = node.getRangeListOptions;
    if (typeof getRangeListOptions !== "function") {
        return false;
    }
    try {
        const listOptions = getRangeListOptions.call(node, start, end);
        if (listOptions === figma.mixed) {
            return true;
        }
        if (!listOptions || typeof listOptions !== "object") {
            return false;
        }
        const listType = listOptions.type;
        return typeof listType === "string" && listType !== "NONE";
    }
    catch (error) {
        console.warn(`Could not read list formatting for range ${start}-${end}:`, error);
        return false;
    }
}
function isListParagraphBoundary(node, index) {
    const textLength = node.characters.length;
    if (index < 0 || index >= textLength || node.characters[index] !== "\n") {
        return false;
    }
    const adjacentRanges = [];
    if (index > 0) {
        adjacentRanges.push([index - 1, index]);
    }
    adjacentRanges.push([index, index + 1]);
    if (index + 1 < textLength) {
        adjacentRanges.push([index + 1, index + 2]);
    }
    return adjacentRanges.some(([start, end]) => rangeHasListFormatting(node, start, end));
}
function findUnusedListLineBreakToken(text) {
    for (let codePoint = LIST_LINE_BREAK_TOKEN_MIDDLE_START; codePoint <= LIST_LINE_BREAK_TOKEN_MIDDLE_END; codePoint += 1) {
        const token = LIST_LINE_BREAK_TOKEN_PREFIX +
            String.fromCharCode(codePoint) +
            LIST_LINE_BREAK_TOKEN_SUFFIX;
        if (!text.includes(token)) {
            return token;
        }
    }
    return null;
}
function protectListParagraphBreaks(node, text) {
    if (!text.includes("\n")) {
        return { text, token: null };
    }
    const token = findUnusedListLineBreakToken(text);
    if (!token) {
        console.warn("Could not reserve a token for list paragraph breaks");
        return { text, token: null };
    }
    let protectedText = "";
    let protectedBreakCount = 0;
    for (let index = 0; index < text.length; index += 1) {
        if (text[index] === "\n" && isListParagraphBoundary(node, index)) {
            protectedText += token;
            protectedBreakCount += 1;
        }
        else {
            protectedText += text[index];
        }
    }
    return protectedBreakCount > 0
        ? { text: protectedText, token }
        : { text, token: null };
}
function restoreListParagraphBreaks(text, token) {
    return token ? text.split(token).join("\n") : text;
}
function getErrorMessage(error) {
    return String(error instanceof Error ? error.message : error !== null && error !== void 0 ? error : "").toLowerCase();
}
function isProbablyMissingFontError(error) {
    if (error instanceof MissingFontLoadError) {
        return true;
    }
    const message = getErrorMessage(error);
    if (!message.includes("font")) {
        return false;
    }
    return (message.includes("missing") ||
        message.includes("not found") ||
        message.includes("not available") ||
        message.includes("unavailable") ||
        message.includes("cannot load") ||
        message.includes("can't load") ||
        message.includes("could not load") ||
        message.includes("failed to load"));
}
function isProbablyNonEditableError(error) {
    const message = getErrorMessage(error);
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
    let skippedMissingFontsNodeCount = 0;
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
            const protectedListBreaks = protectListParagraphBreaks(node, originalText);
            const result = TypotypoEngine.applyRulesToText(protectedListBreaks.text, safeSettings, language);
            const formattedText = restoreListParagraphBreaks(result.formattedText, protectedListBreaks.token);
            skippedRuleCount += result.skippedRuleCount;
            if (result.replacementCount === 0 ||
                formattedText === originalText) {
                unchangedNodeCount += 1;
                continue;
            }
            await updateTextNodeCharactersPreservingStyles(node, formattedText);
            changedNodeCount += 1;
            totalReplacementCount += result.replacementCount;
        }
        catch (error) {
            console.error("Could not update text node:", error);
            if (isProbablyMissingFontError(error)) {
                skippedMissingFontsNodeCount += 1;
            }
            else if (isProbablyNonEditableError(error)) {
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
        skippedMissingFontsNodeCount;
    figma.ui.postMessage({
        type: "apply-result",
        targetScope: target.targetScope,
        scopeType: target.scopeType,
        selectionKey: target.selectionKey,
        selectedCount: target.selectedCount,
        totalTextNodeCount: target.textNodes.length,
        availableTextNodeCount: changedNodeCount + unchangedNodeCount,
        checkedNodeCount: changedNodeCount + unchangedNodeCount,
        changedNodeCount,
        unchangedNodeCount,
        totalReplacementCount,
        skippedNodeCount,
        skippedHiddenNodeCount,
        skippedLockedNodeCount,
        skippedEmptyNodeCount,
        skippedNonEditableNodeCount,
        skippedMissingFontsNodeCount,
        errorNodeCount,
        skippedRuleCount,
        languageStats,
    });
    figma.notify(`Updated ${changedNodeCount} text layer${changedNodeCount === 1 ? "" : "s"}` +
        (skippedNodeCount > 0 ? ` · Skipped ${skippedNodeCount}` : "") +
        (errorNodeCount > 0 ? ` · Errors ${errorNodeCount}` : ""));
    await sendSelectionInfo();
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
    await sendSelectionInfo();
}
figma.on("selectionchange", () => {
    void sendSelectionInfo();
});
figma.on("currentpagechange", () => {
    void sendSelectionInfo();
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
