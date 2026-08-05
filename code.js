// Pure typography formatter engine.
// Keep this file free from Figma API calls so it can be tested outside Figma.
var TypotypoEngine;
(function (TypotypoEngine) {
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
    function normalizeQuoteOptions(value, fallback) {
        const maybeQuoteOptions = typeof value === "object" && value !== null
            ? value
            : {};
        return {
            primaryQuoteStyle: isQuoteStyle(maybeQuoteOptions.primaryQuoteStyle)
                ? maybeQuoteOptions.primaryQuoteStyle
                : fallback.primaryQuoteStyle,
            secondaryQuoteStyle: isQuoteStyle(maybeQuoteOptions.secondaryQuoteStyle)
                ? maybeQuoteOptions.secondaryQuoteStyle
                : fallback.secondaryQuoteStyle,
        };
    }
    function getQuotePair(style) {
        if (style === "frenchGuillemets") {
            return { opening: "«", closing: "»" };
        }
        if (style === "germanLowHigh") {
            return { opening: "„", closing: "“" };
        }
        if (style === "englishDouble") {
            return { opening: "“", closing: "”" };
        }
        if (style === "programmerDouble") {
            return { opening: '"', closing: '"' };
        }
        if (style === "englishSingle") {
            return { opening: "‘", closing: "’" };
        }
        return { opening: "‚", closing: "‘" };
    }
    function getRussianPrimaryQuotePair(settings) {
        return getQuotePair(settings.options.quoteOptions.ru.primaryQuoteStyle);
    }
    function getRussianSecondaryQuotePair(settings) {
        return getQuotePair(settings.options.quoteOptions.ru.secondaryQuoteStyle);
    }
    function getEnglishPrimaryQuotePair(settings) {
        return getQuotePair(settings.options.quoteOptions.en.primaryQuoteStyle);
    }
    function getEnglishSecondaryQuotePair(settings) {
        return getQuotePair(settings.options.quoteOptions.en.secondaryQuoteStyle);
    }
    function escapeRegExp(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    function replaceQuotePairInText(input, fromPair, toPair) {
        if (fromPair.opening === toPair.opening &&
            fromPair.closing === toPair.closing) {
            return {
                formattedText: input,
                replacementCount: 0,
            };
        }
        const opening = escapeRegExp(fromPair.opening);
        const closing = escapeRegExp(fromPair.closing);
        const regexp = fromPair.opening === fromPair.closing
            ? new RegExp(opening + "([^" + opening + "\\n]+?)" + closing, "g")
            : new RegExp(opening + "([^\\n]+?)" + closing, "g");
        let replacementCount = 0;
        const formattedText = input.replace(regexp, function (match, quoteContent) {
            const normalized = toPair.opening + quoteContent + toPair.closing;
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
    function normalizeSettings(value) {
        const maybeSettings = typeof value === "object" && value !== null
            ? value
            : {};
        const maybeOptions = typeof maybeSettings.options === "object" && maybeSettings.options !== null
            ? maybeSettings.options
            : {};
        const legacyOptions = maybeOptions;
        const maybeQuoteOptions = typeof maybeOptions.quoteOptions === "object" &&
            maybeOptions.quoteOptions !== null
            ? maybeOptions.quoteOptions
            : {};
        const maybeQuoteOptionsRecord = maybeQuoteOptions;
        const maybeEnabledRules = typeof maybeSettings.enabledRules === "object" &&
            maybeSettings.enabledRules !== null
            ? maybeSettings.enabledRules
            : {};
        let nonBreakingSpaceStyle = TypotypoEngine.DEFAULT_SETTINGS.options.nonBreakingSpaceStyle;
        if (isNonBreakingSpaceStyle(maybeOptions.nonBreakingSpaceStyle)) {
            nonBreakingSpaceStyle = maybeOptions.nonBreakingSpaceStyle;
        }
        else if (legacyOptions.numberUnitsSpace === "narrowNbsp") {
            nonBreakingSpaceStyle = "narrow";
        }
        else if (legacyOptions.numberUnitsSpace === "nbsp") {
            nonBreakingSpaceStyle = "regular";
        }
        const uiFinalPeriod = typeof maybeEnabledRules.uiFinalPeriod === "boolean"
            ? maybeEnabledRules.uiFinalPeriod
            : typeof maybeEnabledRules.russianUiFinalPeriod === "boolean"
                ? maybeEnabledRules.russianUiFinalPeriod
                : TypotypoEngine.DEFAULT_SETTINGS.enabledRules.uiFinalPeriod;
        const legacySpacingValues = [
            maybeEnabledRules.spacesBeforePunctuation,
            maybeEnabledRules.spacesAfterPunctuation,
        ].filter((value) => typeof value === "boolean");
        const spacingCleanup = typeof maybeEnabledRules.spacingCleanup === "boolean"
            ? maybeEnabledRules.spacingCleanup
            : legacySpacingValues.length > 0
                ? legacySpacingValues.some(Boolean)
                : TypotypoEngine.DEFAULT_SETTINGS.enabledRules.spacingCleanup;
        return {
            languageMode: isLanguageMode(maybeSettings.languageMode)
                ? maybeSettings.languageMode
                : TypotypoEngine.DEFAULT_SETTINGS.languageMode,
            options: {
                nonBreakingSpaceStyle,
                quoteOptions: {
                    ru: normalizeQuoteOptions(maybeQuoteOptionsRecord.ru, TypotypoEngine.DEFAULT_SETTINGS.options.quoteOptions.ru),
                    en: normalizeQuoteOptions(maybeQuoteOptionsRecord.en, TypotypoEngine.DEFAULT_SETTINGS.options.quoteOptions.en),
                },
            },
            enabledRules: {
                invisibleCopyArtifacts: typeof maybeEnabledRules.invisibleCopyArtifacts === "boolean"
                    ? maybeEnabledRules.invisibleCopyArtifacts
                    : TypotypoEngine.DEFAULT_SETTINGS.enabledRules.invisibleCopyArtifacts,
                tabs: typeof maybeEnabledRules.tabs === "boolean"
                    ? maybeEnabledRules.tabs
                    : TypotypoEngine.DEFAULT_SETTINGS.enabledRules.tabs,
                manualLineBreaks: typeof maybeEnabledRules.manualLineBreaks === "boolean"
                    ? maybeEnabledRules.manualLineBreaks
                    : TypotypoEngine.DEFAULT_SETTINGS.enabledRules.manualLineBreaks,
                ellipsis: typeof maybeEnabledRules.ellipsis === "boolean"
                    ? maybeEnabledRules.ellipsis
                    : TypotypoEngine.DEFAULT_SETTINGS.enabledRules.ellipsis,
                extraSpaces: typeof maybeEnabledRules.extraSpaces === "boolean"
                    ? maybeEnabledRules.extraSpaces
                    : TypotypoEngine.DEFAULT_SETTINGS.enabledRules.extraSpaces,
                trimTextEdges: typeof maybeEnabledRules.trimTextEdges === "boolean"
                    ? maybeEnabledRules.trimTextEdges
                    : TypotypoEngine.DEFAULT_SETTINGS.enabledRules.trimTextEdges,
                spacingCleanup,
                percentSignNoSpace: typeof maybeEnabledRules.percentSignNoSpace === "boolean"
                    ? maybeEnabledRules.percentSignNoSpace
                    : TypotypoEngine.DEFAULT_SETTINGS.enabledRules.percentSignNoSpace,
                numberUnitsNbsp: typeof maybeEnabledRules.numberUnitsNbsp === "boolean"
                    ? maybeEnabledRules.numberUnitsNbsp
                    : TypotypoEngine.DEFAULT_SETTINGS.enabledRules.numberUnitsNbsp,
                numberSigns: typeof maybeEnabledRules.numberSigns === "boolean"
                    ? maybeEnabledRules.numberSigns
                    : TypotypoEngine.DEFAULT_SETTINGS.enabledRules.numberSigns,
                specialSymbols: typeof maybeEnabledRules.specialSymbols === "boolean"
                    ? maybeEnabledRules.specialSymbols
                    : TypotypoEngine.DEFAULT_SETTINGS.enabledRules.specialSymbols,
                englishApostrophes: typeof maybeEnabledRules.englishApostrophes === "boolean"
                    ? maybeEnabledRules.englishApostrophes
                    : TypotypoEngine.DEFAULT_SETTINGS.enabledRules.englishApostrophes,
                englishQuotes: typeof maybeEnabledRules.englishQuotes === "boolean"
                    ? maybeEnabledRules.englishQuotes
                    : TypotypoEngine.DEFAULT_SETTINGS.enabledRules.englishQuotes,
                russianQuotes: typeof maybeEnabledRules.russianQuotes === "boolean"
                    ? maybeEnabledRules.russianQuotes
                    : TypotypoEngine.DEFAULT_SETTINGS.enabledRules.russianQuotes,
                numberRangeDash: typeof maybeEnabledRules.numberRangeDash === "boolean"
                    ? maybeEnabledRules.numberRangeDash
                    : typeof maybeEnabledRules.russianNumberRangeDash === "boolean"
                        ? maybeEnabledRules.russianNumberRangeDash
                        : TypotypoEngine.DEFAULT_SETTINGS.enabledRules.numberRangeDash,
                russianSentenceDash: typeof maybeEnabledRules.russianSentenceDash === "boolean"
                    ? maybeEnabledRules.russianSentenceDash
                    : TypotypoEngine.DEFAULT_SETTINGS.enabledRules.russianSentenceDash,
                russianShortWordsNbsp: typeof maybeEnabledRules.russianShortWordsNbsp === "boolean"
                    ? maybeEnabledRules.russianShortWordsNbsp
                    : TypotypoEngine.DEFAULT_SETTINGS.enabledRules.russianShortWordsNbsp,
                russianInitialsNbsp: typeof maybeEnabledRules.russianInitialsNbsp === "boolean"
                    ? maybeEnabledRules.russianInitialsNbsp
                    : TypotypoEngine.DEFAULT_SETTINGS.enabledRules.russianInitialsNbsp,
                russianNumericAbbreviations: typeof maybeEnabledRules.russianNumericAbbreviations === "boolean"
                    ? maybeEnabledRules.russianNumericAbbreviations
                    : TypotypoEngine.DEFAULT_SETTINGS.enabledRules.russianNumericAbbreviations,
                russianLargeNumbers: typeof maybeEnabledRules.russianLargeNumbers === "boolean"
                    ? maybeEnabledRules.russianLargeNumbers
                    : TypotypoEngine.DEFAULT_SETTINGS.enabledRules.russianLargeNumbers,
                uiFinalPeriod,
            },
        };
    }
    TypotypoEngine.normalizeSettings = normalizeSettings;
    function getIcuVariantTextForLanguageDetection(fragment) {
        if (!/^\{\s*[^,{}]+,\s*(?:plural|select|selectordinal)\b/i.test(fragment)) {
            return " ";
        }
        let result = "";
        let depth = 0;
        for (let index = 0; index < fragment.length; index += 1) {
            const character = fragment[index];
            if (character === "{") {
                depth += 1;
                if (depth === 2) {
                    result += " ";
                }
                continue;
            }
            if (character === "}") {
                if (depth === 2) {
                    result += " ";
                }
                if (depth > 0) {
                    depth -= 1;
                }
                continue;
            }
            if (depth >= 2) {
                result += character;
            }
        }
        return result || " ";
    }
    function replaceBalancedCurlyBraceFragmentsForLanguageDetection(text, includeIcuVariantText) {
        let result = "";
        let lastIndex = 0;
        let depth = 0;
        let fragmentStart = -1;
        for (let index = 0; index < text.length; index += 1) {
            const character = text[index];
            if (character === "{") {
                if (depth === 0) {
                    fragmentStart =
                        index > lastIndex && text[index - 1] === "$" ? index - 1 : index;
                }
                depth += 1;
            }
            else if (character === "}" && depth > 0) {
                depth -= 1;
                if (depth === 0 && fragmentStart >= 0) {
                    const fragment = text.slice(fragmentStart, index + 1);
                    result += text.slice(lastIndex, fragmentStart);
                    result += includeIcuVariantText
                        ? getIcuVariantTextForLanguageDetection(fragment)
                        : " ";
                    lastIndex = index + 1;
                    fragmentStart = -1;
                }
            }
        }
        if (lastIndex === 0) {
            return text;
        }
        return result + text.slice(lastIndex);
    }
    function getTextForLanguageDetection(text, includeIcuVariantText = false) {
        const textWithoutProtectedSyntax = text
            .replace(/`[^`\n]+`/g, " ")
            .replace(/&(?:[A-Za-z][A-Za-z0-9]{1,31}|#\d{1,7}|#x[0-9A-Fa-f]{1,6});/g, " ")
            .replace(/<\/?[A-Za-z][A-Za-z0-9:-]*(?:\s+[A-Za-z_:][A-Za-z0-9:._-]*(?:=(?:"[^"\n]*"|'[^'\n]*'|[^\s"'=<>`]+))?)*\s*\/?>/g, " ");
        return replaceBalancedCurlyBraceFragmentsForLanguageDetection(textWithoutProtectedSyntax, includeIcuVariantText)
            .replace(/%(?:\d+\$)?[@sdif]/g, " ")
            .replace(/\$\d+\b/g, " ");
    }
    function detectLanguageFromPreparedText(languageDetectionText) {
        const cyrillicMatches = languageDetectionText.match(/[А-Яа-яЁё]/g) || [];
        const latinMatches = languageDetectionText.match(/[A-Za-z]/g) || [];
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
    function getLetterCount(value) {
        const cyrillicMatches = value.match(/[А-Яа-яЁё]/g) || [];
        const latinMatches = value.match(/[A-Za-z]/g) || [];
        return cyrillicMatches.length + latinMatches.length;
    }
    function detectDominantLanguage(text) {
        const surroundingText = getTextForLanguageDetection(text, false);
        const surroundingTextLanguage = detectLanguageFromPreparedText(surroundingText);
        if (surroundingTextLanguage !== "unknown") {
            return surroundingTextLanguage;
        }
        if (getLetterCount(surroundingText) === 0) {
            return "unknown";
        }
        return detectLanguageFromPreparedText(getTextForLanguageDetection(text, true));
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
    TypotypoEngine.resolveLanguage = resolveLanguage;
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
    function applyManualLineBreaksRule(text) {
        let replacementCount = 0;
        let normalizedLineEndings = text
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .replace(/\u2028/g, "\n")
            .replace(/\u2029/g, "\n\n");
        if (normalizedLineEndings !== text) {
            replacementCount += 1;
        }
        const normalizedParagraphBreaks = normalizedLineEndings.replace(/\n[ \t\u00A0\u202F]+\n/g, "\n\n");
        if (normalizedParagraphBreaks !== normalizedLineEndings) {
            replacementCount += 1;
            normalizedLineEndings = normalizedParagraphBreaks;
        }
        function startsWithSupportedListMarker(line) {
            return /^[ \t\u00A0\u202F]*(?:[•‣▪◦—–*](?:[ \t\u00A0\u202F]*)(?=\S)|-(?:[ \t\u00A0\u202F]+(?=\S)|(?=[A-Za-zА-Яа-яЁё«„“"']))|(?:\d{1,3}|[A-Za-zА-Яа-яЁё])[.)](?:[ \t\u00A0\u202F]+(?=\S)|(?=[A-Za-zА-Яа-яЁё«„“"'])))/.test(line);
        }
        const formattedText = normalizedLineEndings.replace(/([^\n])[ \t\u00A0\u202F]*\n[ \t\u00A0\u202F]*([^\n])/g, function (match, beforeBreak, afterBreak, offset, fullText) {
            const newlineIndex = offset + match.indexOf("\n");
            const currentLineStart = fullText.lastIndexOf("\n", offset) + 1;
            const currentLine = fullText.slice(currentLineStart, newlineIndex);
            const nextLineEnd = fullText.indexOf("\n", newlineIndex + 1);
            const nextLine = fullText.slice(newlineIndex + 1, nextLineEnd === -1 ? fullText.length : nextLineEnd);
            if (startsWithSupportedListMarker(currentLine) ||
                startsWithSupportedListMarker(nextLine)) {
                const normalized = beforeBreak + "\n" + afterBreak;
                if (match === normalized) {
                    return match;
                }
                replacementCount += 1;
                return normalized;
            }
            const normalized = beforeBreak + " " + afterBreak;
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
    function applyEllipsisRule(text) {
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
        replaceAndCount(/\.{3,}\?/g, "?..");
        replaceAndCount(/\?\.{3,}/g, "?..");
        replaceAndCount(/…\?/g, "?..");
        replaceAndCount(/\?…/g, "?..");
        replaceAndCount(/\.{3,}!/g, "!..");
        replaceAndCount(/!\.{3,}/g, "!..");
        replaceAndCount(/…!/g, "!..");
        replaceAndCount(/!…/g, "!..");
        replaceAndCount(/\.{3,}/g, "…");
        replaceAndCount(/…{2,}/g, "…");
        return {
            formattedText,
            replacementCount,
        };
    }
    function applyExtraSpacesRule(text) {
        const matches = text.match(/[^\S\r\n\u2028\u2029]{2,}/g);
        return {
            formattedText: text.replace(/[^\S\r\n\u2028\u2029]{2,}/g, " "),
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
    function applySpacingCleanupRule(text) {
        let replacementCount = 0;
        let normalizedText = text;
        function replaceAndCount(regexp, replacement) {
            normalizedText = normalizedText.replace(regexp, function (match) {
                if (match === replacement) {
                    return match;
                }
                replacementCount += 1;
                return replacement;
            });
        }
        normalizedText = normalizedText.replace(/[ \t\u00A0\u202F]+([,.…;:!?])/g, function (match, punctuation) {
            if (match === punctuation) {
                return match;
            }
            replacementCount += 1;
            return punctuation;
        });
        replaceAndCount(/!\?/g, "?!");
        replaceAndCount(/\.{3,}\?/g, "?..");
        replaceAndCount(/\?\.{3,}/g, "?..");
        replaceAndCount(/…\?/g, "?..");
        replaceAndCount(/\?…/g, "?..");
        replaceAndCount(/\.{3,}!/g, "!..");
        replaceAndCount(/!\.{3,}/g, "!..");
        replaceAndCount(/…!/g, "!..");
        replaceAndCount(/!…/g, "!..");
        replaceAndCount(/\.{3,}/g, "…");
        replaceAndCount(/…{2,}/g, "…");
        normalizedText = normalizedText.replace(/([!?.,;:])\1+/g, function (match, punctuation, offset, fullText) {
            if (punctuation === "." &&
                offset > 0 &&
                (fullText[offset - 1] === "?" || fullText[offset - 1] === "!")) {
                return match;
            }
            replacementCount += 1;
            return punctuation;
        });
        normalizedText = normalizedText.replace(/([А-Яа-яЁёA-Za-z0-9])\.([»”’])/g, function (match, characterBeforePeriod, closingQuote, offset, fullText) {
            const textEndingWithPeriod = fullText.slice(0, offset + 2);
            if (shouldKeepRussianFinalPeriod(textEndingWithPeriod) ||
                shouldKeepEnglishFinalPeriod(textEndingWithPeriod)) {
                return match;
            }
            const normalized = characterBeforePeriod + closingQuote + ".";
            if (match === normalized) {
                return match;
            }
            replacementCount += 1;
            return normalized;
        });
        function isSpaceLike(character) {
            return /[ \t\n\r\u00A0\u2028\u2029\u202F]/.test(character);
        }
        function isClosingPunctuationOrOperator(character) {
            return /[,.;:!?)\]}»”’=<>]/.test(character);
        }
        function isOpeningPunctuation(character) {
            return /[({[«„“"']/.test(character);
        }
        function shouldAddSpaceAfterPunctuation(punctuation, previousCharacter, nextCharacter) {
            if (!nextCharacter || isSpaceLike(nextCharacter)) {
                return false;
            }
            if (nextCharacter === PROTECTED_TEXT_TOKEN_START) {
                return false;
            }
            if (isClosingPunctuationOrOperator(nextCharacter)) {
                return false;
            }
            if ((punctuation === "," || punctuation === ":") &&
                /\d/.test(previousCharacter) &&
                /\d/.test(nextCharacter)) {
                return false;
            }
            if (punctuation === ".") {
                if (/\d/.test(previousCharacter) && /\d/.test(nextCharacter)) {
                    return false;
                }
                return (/[А-ЯЁA-Z]/.test(nextCharacter) ||
                    isOpeningPunctuation(nextCharacter) ||
                    nextCharacter === PROTECTED_TEXT_TOKEN_START);
            }
            return true;
        }
        function applyBracketSpacingCleanup(input) {
            let bracketReplacementCount = 0;
            let output = input.replace(/([([])[ \t\u00A0\u202F]+(?=[А-Яа-яЁё0-9%№§])/g, function (match, openingBracket) {
                if (match === openingBracket) {
                    return match;
                }
                bracketReplacementCount += 1;
                return openingBracket;
            });
            output = output.replace(/([А-Яа-яЁё0-9%₽№§])[ \t\u00A0\u202F]+([)\]])/g, function (match, beforeBracket, closingBracket) {
                const normalized = beforeBracket + closingBracket;
                if (match === normalized) {
                    return match;
                }
                bracketReplacementCount += 1;
                return normalized;
            });
            output = output.replace(/([А-Яа-яЁё0-9»“”’")\].!?])([([])(?=[^ \t\n\r\u00A0\u202F)\]])/g, function (match, beforeBracket, openingBracket, offset, fullText) {
                const nextCharacter = fullText[offset + beforeBracket.length + openingBracket.length] || "";
                if (/\d/.test(beforeBracket) && /\d/.test(nextCharacter)) {
                    return match;
                }
                const normalized = beforeBracket + " " + openingBracket;
                if (match === normalized) {
                    return match;
                }
                bracketReplacementCount += 1;
                return normalized;
            });
            return {
                formattedText: output,
                replacementCount: bracketReplacementCount,
            };
        }
        function applyEnclosureSpacingCleanup(input) {
            let enclosureReplacementCount = 0;
            function replaceAndCount(value, regexp, replacer) {
                return value.replace(regexp, function (...args) {
                    const stringArgs = args.map((arg) => typeof arg === "string" ? arg : "");
                    const match = stringArgs[0];
                    const normalized = replacer(...stringArgs);
                    if (match === normalized) {
                        return match;
                    }
                    enclosureReplacementCount += 1;
                    return normalized;
                });
            }
            let output = replaceAndCount(input, /([«„“‘‚([])[ \t\u00A0\u202F]+(?=\S)/g, function (_match, openingSymbol) {
                return openingSymbol;
            });
            output = replaceAndCount(output, /(^|[\s([{,.;:!?…—–-])"[ \t\u00A0\u202F]+(?=\S)/g, function (_match, prefix) {
                return prefix + '"';
            });
            output = replaceAndCount(output, /(„[^„“\n]*?)[ \t\u00A0\u202F]+“/g, function (_match, quoteContentBeforeClosing) {
                return quoteContentBeforeClosing + "“";
            });
            output = replaceAndCount(output, /[ \t\u00A0\u202F]+([»”’\])])/g, function (_match, closingSymbol) {
                return closingSymbol;
            });
            output = replaceAndCount(output, /([A-Za-zА-Яа-яЁё0-9.,;:!?])[ \t\u00A0\u202F]+(")(?=$|[\s.,;:!?…)\]}—–-])/g, function (_match, beforeQuote, closingQuote) {
                return beforeQuote + closingQuote;
            });
            output = replaceAndCount(output, /([»”])(?=[A-Za-zА-Яа-яЁё])/g, function (_match, closingQuote) {
                return closingQuote + " ";
            });
            output = replaceAndCount(output, /([A-Za-zА-Яа-яЁё.!?])"(?=[A-Za-zА-Яа-яЁё])/g, function (_match, beforeQuote) {
                return beforeQuote + '" ';
            });
            return {
                formattedText: output,
                replacementCount: enclosureReplacementCount,
            };
        }
        function applyUiSeparatorSpacingCleanup(input) {
            let separatorReplacementCount = 0;
            const formattedText = input.replace(/([^ \t\n\r\u00A0\u202F|·])([ \t\u00A0\u202F]*)([|·])([ \t\u00A0\u202F]*)([^ \t\n\r\u00A0\u202F|·])/g, function (match, leftCharacter, _leftSpacing, separator, _rightSpacing, rightCharacter) {
                const normalized = leftCharacter + " " + separator + " " + rightCharacter;
                if (match === normalized) {
                    return match;
                }
                separatorReplacementCount += 1;
                return normalized;
            });
            return {
                formattedText,
                replacementCount: separatorReplacementCount,
            };
        }
        function applyListMarkerSpacingCleanup(input) {
            let markerReplacementCount = 0;
            let output = input;
            function normalizeMarker(regexp, normalizeMarkerValue = (marker) => marker) {
                output = output.replace(regexp, function (match, lineStart, indentation, marker) {
                    const normalized = lineStart + indentation + normalizeMarkerValue(marker) + " ";
                    if (match === normalized) {
                        return match;
                    }
                    markerReplacementCount += 1;
                    return normalized;
                });
            }
            normalizeMarker(/(^|\n)([ \t\u00A0\u202F]*)([•‣▪◦—–*])[ \t\u00A0\u202F]*(?=\S)/g, function (marker) {
                return marker === "–" ? "—" : marker;
            });
            normalizeMarker(/(^|\n)([ \t\u00A0\u202F]*)(-)[ \t\u00A0\u202F]+(?=\S)/g);
            normalizeMarker(/(^|\n)([ \t\u00A0\u202F]*)(-)(?=[A-Za-zА-Яа-яЁё«„“"'])/g);
            normalizeMarker(/(^|\n)([ \t\u00A0\u202F]*)((?:\d{1,3}|[A-Za-zА-Яа-яЁё])[.)])[ \t\u00A0\u202F]+(?=\S)/g);
            normalizeMarker(/(^|\n)([ \t\u00A0\u202F]*)((?:\d{1,3}|[A-Za-zА-Яа-яЁё])[.)])(?=[A-Za-zА-Яа-яЁё«„“"'])/g);
            return {
                formattedText: output,
                replacementCount: markerReplacementCount,
            };
        }
        function applyHyphenInsideWordsCleanup(input) {
            let hyphenReplacementCount = 0;
            let output = input;
            function replaceAndCount(regexp, replacer) {
                output = output.replace(regexp, function (...args) {
                    const stringArgs = args.map((arg) => typeof arg === "string" ? arg : "");
                    const match = stringArgs[0];
                    const normalized = replacer(...stringArgs);
                    if (match === normalized) {
                        return match;
                    }
                    hyphenReplacementCount += 1;
                    return normalized;
                });
            }
            let previousOutput = "";
            while (previousOutput !== output) {
                previousOutput = output;
                replaceAndCount(/([A-Za-zА-Яа-яЁё])[‐‑‒–−]([A-Za-zА-Яа-яЁё])/g, function (_match, leftLetter, rightLetter) {
                    return leftLetter + "-" + rightLetter;
                });
            }
            const commonHyphenatedWordParts = [
                "арт",
                "аудио",
                "веб",
                "видео",
                "инди",
                "мини",
                "медиа",
                "онлайн",
                "офлайн",
                "поп",
                "пост",
                "рок",
                "смарт",
                "супер",
                "хип",
                "хоп",
                "экс",
                "кое",
                "ка",
                "либо",
                "нибудь",
                "таки",
                "то",
            ];
            replaceAndCount(/([A-Za-zА-Яа-яЁё]+)—([A-Za-zА-Яа-яЁё]+)/g, function (match, leftWord, rightWord) {
                const normalizedLeftWord = leftWord.toLowerCase();
                const normalizedRightWord = rightWord.toLowerCase();
                if (!commonHyphenatedWordParts.includes(normalizedLeftWord) &&
                    !commonHyphenatedWordParts.includes(normalizedRightWord)) {
                    return match;
                }
                return leftWord + "-" + rightWord;
            });
            return {
                formattedText: output,
                replacementCount: hyphenReplacementCount,
            };
        }
        let spacedText = "";
        for (let index = 0; index < normalizedText.length; index += 1) {
            const character = normalizedText[index];
            const nextCharacter = normalizedText[index + 1] || "";
            const previousCharacter = index > 0 ? normalizedText[index - 1] : "";
            spacedText += character;
            if (!/[,.;:!?]/.test(character)) {
                continue;
            }
            if (shouldAddSpaceAfterPunctuation(character, previousCharacter, nextCharacter)) {
                spacedText += " ";
                replacementCount += 1;
            }
        }
        const bracketSpacingResult = applyBracketSpacingCleanup(spacedText);
        const enclosureSpacingResult = applyEnclosureSpacingCleanup(bracketSpacingResult.formattedText);
        const secondBracketSpacingResult = applyBracketSpacingCleanup(enclosureSpacingResult.formattedText);
        const separatorSpacingResult = applyUiSeparatorSpacingCleanup(secondBracketSpacingResult.formattedText);
        const listMarkerSpacingResult = applyListMarkerSpacingCleanup(separatorSpacingResult.formattedText);
        const hyphenInsideWordsResult = applyHyphenInsideWordsCleanup(listMarkerSpacingResult.formattedText);
        return {
            formattedText: hyphenInsideWordsResult.formattedText,
            replacementCount: replacementCount +
                bracketSpacingResult.replacementCount +
                enclosureSpacingResult.replacementCount +
                secondBracketSpacingResult.replacementCount +
                separatorSpacingResult.replacementCount +
                listMarkerSpacingResult.replacementCount +
                hyphenInsideWordsResult.replacementCount,
        };
    }
    function applyPercentSignNoSpaceRule(text) {
        const regexp = /((?:\d+(?:[,.]\d+)?)|(?:\uE100[\uE200-\uF8FF]\uE101))[ \t\u00A0\u202F]+%/g;
        const matches = text.match(regexp);
        return {
            formattedText: text.replace(regexp, "$1%"),
            replacementCount: matches ? matches.length : 0,
        };
    }
    function applyNumberUnitsNbspRule(text, settings) {
        const units = "°[CFС]|₽|руб\\.?|рублей|р\\.?|тыс\\.?|млн\\.?|млрд\\.?|трлн\\.?|кг|г|мг|л|мл|м|см|мм|км|с|сек|мин|ч|д|дн|КБ|МБ|ГБ|ТБ|KB|MB|GB|TB|px|dp|pt|rem|em|vw|vh";
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
    function applyNumberSignsRule(text, _settings) {
        const regularNbsp = "\u00A0";
        const regexp = /([№§])[ \t\u00A0\u202F]*(?=\d)/g;
        let replacementCount = 0;
        const formattedText = text.replace(regexp, function (match, sign) {
            const normalized = sign + regularNbsp;
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
    function applySpecialSymbolsRule(text, settings, language) {
        let formattedText = text;
        let replacementCount = 0;
        const space = getConfiguredNbsp(settings);
        function replaceAndCount(regexp, replacement) {
            formattedText = formattedText.replace(regexp, function (match) {
                if (match === replacement) {
                    return match;
                }
                replacementCount += 1;
                return replacement;
            });
        }
        function normalizeSignedNumber(number) {
            return number
                .replace(/^([+−–—-])[ \t\u00A0\u202F]+(?=\d)/, "$1")
                .replace(/^[-–—−]/, "−");
        }
        function resolveCurrencyLanguage(rawCurrency, symbol, offset, fullText) {
            if (settings.languageMode === "ru" || settings.languageMode === "en") {
                return settings.languageMode;
            }
            function isSentenceBoundaryAt(index) {
                const character = fullText[index];
                if (character === "\n" || character === "\r") {
                    return true;
                }
                if (character !== "." && character !== "!" && character !== "?") {
                    return false;
                }
                const previousCharacter = index > 0 ? fullText[index - 1] : "";
                const nextCharacter = fullText[index + 1] || "";
                if (/\d/.test(previousCharacter) && /\d/.test(nextCharacter)) {
                    return false;
                }
                return true;
            }
            function getCurrencyLocalContext() {
                const contextWindow = 48;
                let contextStart = Math.max(0, offset - contextWindow);
                let contextEnd = Math.min(fullText.length, offset + contextWindow);
                for (let index = offset - 1; index >= contextStart; index -= 1) {
                    if (isSentenceBoundaryAt(index)) {
                        contextStart = index + 1;
                        break;
                    }
                }
                for (let index = offset; index < contextEnd; index += 1) {
                    if (isSentenceBoundaryAt(index)) {
                        contextEnd = index;
                        break;
                    }
                }
                return {
                    text: fullText.slice(contextStart, contextEnd),
                    start: contextStart,
                };
            }
            const { text: localContext, start: contextStart } = getCurrencyLocalContext();
            const localOffset = offset - contextStart;
            const contextWithoutCurrencyTokens = localContext.replace(/\b(?:RUB|RUR|USD|EUR|руб(?:лей)?|р)\.?\b/giu, function (currencyToken) {
                return " ".repeat(currencyToken.length);
            });
            let nearestCyrillicDistance = Number.POSITIVE_INFINITY;
            let nearestLatinDistance = Number.POSITIVE_INFINITY;
            for (let index = 0; index < contextWithoutCurrencyTokens.length; index += 1) {
                const character = contextWithoutCurrencyTokens[index];
                const distance = Math.abs(index - localOffset);
                if (/[А-Яа-яЁё]/.test(character)) {
                    nearestCyrillicDistance = Math.min(nearestCyrillicDistance, distance);
                }
                else if (/[A-Za-z]/.test(character)) {
                    nearestLatinDistance = Math.min(nearestLatinDistance, distance);
                }
            }
            if (nearestCyrillicDistance < nearestLatinDistance) {
                return "ru";
            }
            if (nearestLatinDistance < nearestCyrillicDistance) {
                return "en";
            }
            const cyrillicMatches = contextWithoutCurrencyTokens.match(/[А-Яа-яЁё]/g) || [];
            const latinMatches = contextWithoutCurrencyTokens.match(/[A-Za-z]/g) || [];
            if (cyrillicMatches.length > 0 && cyrillicMatches.length >= latinMatches.length) {
                return "ru";
            }
            if (latinMatches.length > 0 && latinMatches.length > cyrillicMatches.length) {
                return "en";
            }
            if (language === "ru" || language === "en") {
                return language;
            }
            if (symbol === "₽" && /^(?:₽|р\.?|руб\.?|рублей)$/iu.test(rawCurrency)) {
                return "ru";
            }
            return null;
        }
        function normalizeCurrencyDecimalSeparator(number, currencyLanguage) {
            const normalizedNumber = normalizeSignedNumber(number);
            const decimalSeparator = currencyLanguage === "ru" ? "," : ".";
            return normalizedNumber.replace(/([,.])(\d{1,2})$/, decimalSeparator + "$2");
        }
        function splitSignedNumber(number) {
            const sign = /^[+−]/.test(number) ? number.charAt(0) : "";
            const unsignedNumber = sign ? number.slice(1) : number;
            return { sign, unsignedNumber };
        }
        function formatCurrencyAmount(number, symbol, currencyLanguage) {
            const normalizedNumber = normalizeCurrencyDecimalSeparator(number, currencyLanguage);
            if (currencyLanguage === "en") {
                const { sign, unsignedNumber } = splitSignedNumber(normalizedNumber);
                return sign + symbol + unsignedNumber;
            }
            return normalizedNumber + space + symbol;
        }
        function formatRubleKopeckAmount(rubles, kopecks, currencyLanguage) {
            const normalizedRubles = normalizeSignedNumber(rubles).replace(/[,.]\d+$/, "");
            const normalizedKopecks = kopecks.padStart(2, "0");
            if (currencyLanguage === "en") {
                const { sign, unsignedNumber } = splitSignedNumber(normalizedRubles);
                return sign + "₽" + unsignedNumber + "." + normalizedKopecks;
            }
            return normalizedRubles + "," + normalizedKopecks + space + "₽";
        }
        function replaceCurrencySuffix(regexp, symbol) {
            formattedText = formattedText.replace(regexp, function (match, prefix, number, rawCurrency, offset, fullText) {
                const currencyLanguage = resolveCurrencyLanguage(rawCurrency, symbol, offset, fullText);
                if (!currencyLanguage) {
                    return match;
                }
                const characterAfterMatch = fullText.slice(offset + match.length);
                const shouldKeepSentencePeriod = /^(?:р\.|руб\.)$/iu.test(rawCurrency) &&
                    /^[ \t\n\r\u00A0\u202F]+[А-ЯЁA-Z0-9]/.test(characterAfterMatch);
                const normalized = prefix +
                    formatCurrencyAmount(number, symbol, currencyLanguage) +
                    (shouldKeepSentencePeriod ? "." : "");
                if (match === normalized) {
                    return match;
                }
                replacementCount += 1;
                return normalized;
            });
        }
        function isCurrencyPrefixAttachedToPreviousAmount(prefix, offset, fullText) {
            if (!/^[ \t\u00A0\u202F]+$/.test(prefix)) {
                return false;
            }
            const previousCharacter = offset > 0 ? fullText[offset - 1] : "";
            return /\d/.test(previousCharacter);
        }
        function replaceCurrencyPrefix(regexp, symbol) {
            formattedText = formattedText.replace(regexp, function (match, prefix, rawCurrency, number, offset, fullText) {
                if (isCurrencyPrefixAttachedToPreviousAmount(prefix, offset, fullText)) {
                    return match;
                }
                const currencyLanguage = resolveCurrencyLanguage(rawCurrency, symbol, offset, fullText);
                if (!currencyLanguage) {
                    return match;
                }
                const normalized = prefix + formatCurrencyAmount(number, symbol, currencyLanguage);
                if (match === normalized) {
                    return match;
                }
                replacementCount += 1;
                return normalized;
            });
        }
        function replaceCurrencyPrefixFractionalFirst(regexp, symbol) {
            formattedText = formattedText.replace(regexp, function (match, prefix, rawCurrency, number, offset, fullText) {
                if (isCurrencyPrefixAttachedToPreviousAmount(prefix, offset, fullText)) {
                    return match;
                }
                const currencyLanguage = resolveCurrencyLanguage(rawCurrency, symbol, offset, fullText);
                if (!currencyLanguage) {
                    return match;
                }
                const normalized = prefix + formatCurrencyAmount(number, symbol, currencyLanguage);
                if (match === normalized) {
                    return match;
                }
                replacementCount += 1;
                return normalized;
            });
        }
        function replaceRubleKopecks(regexp) {
            formattedText = formattedText.replace(regexp, function (match, prefix, rubles, rawCurrency, kopecks, terminalPeriod, offset, fullText) {
                const currencyLanguage = resolveCurrencyLanguage(rawCurrency, "₽", offset, fullText);
                if (!currencyLanguage) {
                    return match;
                }
                const amount = formatRubleKopeckAmount(rubles, kopecks, currencyLanguage);
                const characterAfterMatch = fullText.slice(offset + match.length);
                const shouldKeepSentencePeriod = terminalPeriod === "." &&
                    /^[ \t\u00A0\u202F]+[А-ЯЁA-Z]/.test(characterAfterMatch);
                const normalized = prefix + amount + (shouldKeepSentencePeriod ? "." : "");
                if (match === normalized) {
                    return match;
                }
                replacementCount += 1;
                return normalized;
            });
        }
        function repairSplitRubleFractionalAmounts(regexp) {
            formattedText = formattedText.replace(regexp, function (match, prefix, rubles, kopecks, offset, fullText) {
                const currencyLanguage = resolveCurrencyLanguage("₽", "₽", offset, fullText);
                if (!currencyLanguage) {
                    return match;
                }
                const normalized = prefix + formatRubleKopeckAmount(rubles, kopecks, currencyLanguage);
                if (match === normalized) {
                    return match;
                }
                replacementCount += 1;
                return normalized;
            });
        }
        replaceAndCount(/\([cс]\)/giu, "©");
        replaceAndCount(/\((tm|тм)\)/giu, "™");
        replaceAndCount(/\([rр]\)/giu, "®");
        replaceAndCount(/\+\/-/g, "±");
        replaceAndCount(/\+[\s\u00A0\u202F]*[-–—−]/g, "±");
        replaceAndCount(/<=/g, "≤");
        replaceAndCount(/>=/g, "≥");
        formattedText = formattedText.replace(/(\S)[ \t\u00A0\u202F]*!=[ \t\u00A0\u202F]*(?=\S)/g, function (match, leftCharacter, offset, fullText) {
            const nextCharacter = fullText[offset + match.length] || "";
            const trailingSpace = /[,.;:!?…)}\]»”’]/.test(nextCharacter) ? "" : " ";
            const normalized = leftCharacter + " ≠" + trailingSpace;
            if (match === normalized) {
                return match;
            }
            replacementCount += 1;
            return normalized;
        });
        replaceAndCount(/!=/g, "≠");
        replaceAndCount(/~=|≈=/g, "≈");
        const fractionReplacements = {
            "1/2": "½",
            "1/3": "⅓",
            "2/3": "⅔",
            "1/4": "¼",
            "3/4": "¾",
        };
        formattedText = formattedText.replace(/(^|[^0-9A-Za-zА-Яа-яЁё./\\])(1\/2|1\/3|2\/3|1\/4|3\/4)(?=$|[ \t\u00A0\u202F\n\r,.;:!?…)\]}»”’\uE100])/g, function (match, prefix, fraction) {
            const replacement = fractionReplacements[fraction];
            const normalized = prefix + replacement;
            if (match === normalized) {
                return match;
            }
            replacementCount += 1;
            return normalized;
        });
        formattedText = formattedText.replace(/(\uE101)(1\/2|1\/3|2\/3|1\/4|3\/4)(?=\uE100)/g, function (match, prefix, fraction) {
            const replacement = fractionReplacements[fraction];
            const normalized = prefix + replacement;
            if (match === normalized) {
                return match;
            }
            replacementCount += 1;
            return normalized;
        });
        const currencyPrefixBoundary = `(^|[ \t\u00A0\u202F([{«„“"'\uE101])`;
        const currencySuffixBoundary = `(?=$|[ \t\n\r,.;:!?…)\\]}»”’\uE100])`;
        const currencyNumber = `([+−–—-]?[ \t\u00A0\u202F]*\\d+(?:[,.]\\d+)?)`;
        replaceCurrencyPrefixFractionalFirst(new RegExp(currencyPrefixBoundary +
            `(₽|RUB|RUR)[ \t\u00A0\u202F]*` +
            `([+−–—-]?[ \t\u00A0\u202F]*\\d+[,.]\\d{1,2})` +
            currencySuffixBoundary, "giu"), "₽");
        replaceCurrencyPrefixFractionalFirst(new RegExp(currencyPrefixBoundary +
            `(\\$|USD)[ \t\u00A0\u202F]*` +
            `([+−–—-]?[ \t\u00A0\u202F]*\\d+[,.]\\d{1,2})` +
            currencySuffixBoundary, "giu"), "$");
        replaceCurrencyPrefixFractionalFirst(new RegExp(currencyPrefixBoundary +
            `(€|EUR)[ \t\u00A0\u202F]*` +
            `([+−–—-]?[ \t\u00A0\u202F]*\\d+[,.]\\d{1,2})` +
            currencySuffixBoundary, "giu"), "€");
        repairSplitRubleFractionalAmounts(new RegExp(currencyPrefixBoundary +
            `([+−–—-]?[ \t\u00A0\u202F]*\\d+)[ \t\u00A0\u202F]*₽[ \t\u00A0\u202F]*[,.](\\d{1,2})` +
            currencySuffixBoundary, "giu"));
        replaceRubleKopecks(new RegExp(currencyPrefixBoundary +
            currencyNumber +
            `[ \t\u00A0\u202F]*(₽|р\\.?|руб\\.?|рублей|RUB|RUR)[ \t\u00A0\u202F]+(\\d{1,2})[ \t\u00A0\u202F]*(?:коп|копеек|копейки|копейка)(\\.)?` +
            currencySuffixBoundary, "giu"));
        replaceCurrencySuffix(new RegExp(currencyPrefixBoundary +
            currencyNumber +
            `[ \t\u00A0\u202F]*(₽|р\\.?|руб\\.?|рублей|RUB|RUR)` +
            currencySuffixBoundary, "giu"), "₽");
        replaceCurrencyPrefix(new RegExp(currencyPrefixBoundary +
            `(₽|RUB|RUR)[ \t\u00A0\u202F]*` +
            currencyNumber +
            currencySuffixBoundary, "giu"), "₽");
        replaceCurrencySuffix(new RegExp(currencyPrefixBoundary +
            currencyNumber +
            `[ \t\u00A0\u202F]*(\\$|USD)` +
            currencySuffixBoundary, "giu"), "$");
        replaceCurrencyPrefix(new RegExp(currencyPrefixBoundary +
            `(\\$|USD)[ \t\u00A0\u202F]*` +
            currencyNumber +
            currencySuffixBoundary, "giu"), "$");
        replaceCurrencySuffix(new RegExp(currencyPrefixBoundary +
            currencyNumber +
            `[ \t\u00A0\u202F]*(€|EUR)` +
            currencySuffixBoundary, "giu"), "€");
        replaceCurrencyPrefix(new RegExp(currencyPrefixBoundary +
            `(€|EUR)[ \t\u00A0\u202F]*` +
            currencyNumber +
            currencySuffixBoundary, "giu"), "€");
        repairSplitRubleFractionalAmounts(new RegExp(currencyPrefixBoundary +
            `([+−–—-]?[ \t\u00A0\u202F]*\\d+)[ \t\u00A0\u202F]*₽[ \t\u00A0\u202F]*[,.](\\d{1,2})` +
            currencySuffixBoundary, "giu"));
        formattedText = formattedText.replace(/<->|<[-–—−]|[-–—−]>/g, function (match) {
            const normalized = match === "<->"
                ? "←→"
                : match.startsWith("<")
                    ? "←"
                    : "→";
            if (match === normalized) {
                return match;
            }
            replacementCount += 1;
            return normalized;
        });
        formattedText = formattedText.replace(/(^|[ \t\u00A0\u202F([{])[-–—−][ \t\u00A0\u202F]*(?=\d)/g, function (match, prefix, offset, fullText) {
            const dashIndex = offset + prefix.length;
            const previousNonSpaceCharacter = fullText
                .slice(0, dashIndex)
                .replace(/[ \t\u00A0\u202F]+$/g, "")
                .slice(-1);
            if (/\d/.test(previousNonSpaceCharacter)) {
                return match;
            }
            const normalized = prefix + "−";
            if (match === normalized) {
                return match;
            }
            replacementCount += 1;
            return normalized;
        });
        formattedText = formattedText.replace(/(^|[^0-9A-Za-zА-Яа-яЁё])([+−–—-]?[ \t\u00A0\u202F]*\d+(?:[,.]\d+)?)[ \t\u00A0\u202F]*°?[ \t\u00A0\u202F]*([CFС])(?=$|[ \t\n\r,.;:!?)\]])/g, function (match, prefix, number, unit) {
            const normalizedUnit = unit === "F" ? "°F" : "°C";
            const normalizedNumber = normalizeSignedNumber(number);
            const normalized = prefix + normalizedNumber + space + normalizedUnit;
            if (match === normalized) {
                return match;
            }
            replacementCount += 1;
            return normalized;
        });
        formattedText = formattedText.replace(/(^|[^0-9A-Za-zА-Яа-яЁё])([+−–—-]?[ \t\u00A0\u202F]*\d+(?:[,.]\d+)?)[ \t\u00A0\u202F]*(?:°|deg(?:rees?)?)(?=$|[ \t\n\r,.;:!?)\]])/gi, function (match, prefix, number) {
            const normalizedNumber = normalizeSignedNumber(number);
            const normalized = prefix + normalizedNumber + "°";
            if (match === normalized) {
                return match;
            }
            replacementCount += 1;
            return normalized;
        });
        formattedText = formattedText.replace(/(\d+(?:[,.]\d+)?)[ \t\u00A0\u202F]*[xXхХ][ \t\u00A0\u202F]*(\d+(?:[,.]\d+)?)/g, function (match, leftNumber, rightNumber) {
            const normalized = leftNumber + "×" + rightNumber;
            if (match === normalized) {
                return match;
            }
            replacementCount += 1;
            return normalized;
        });
        formattedText = formattedText.replace(/([!?.,;:])\1+/g, function (match, punctuation, offset, fullText) {
            if (punctuation === "." &&
                offset > 0 &&
                (fullText[offset - 1] === "?" || fullText[offset - 1] === "!")) {
                return match;
            }
            replacementCount += 1;
            return punctuation;
        });
        return {
            formattedText,
            replacementCount,
        };
    }
    function shouldKeepRussianFinalPeriod(textEndingWithPeriod) {
        const protectedAbbreviations = /(^|[^А-Яа-яЁёA-Za-z])((?:т\.[ \t\u00A0\u202F]*[екдпчно]\.)|(?:и[ \t\u00A0\u202F]+т\.[ \t\u00A0\u202F]*[дп]\.)|(?:в[ \t\u00A0\u202F]+т\.[ \t\u00A0\u202F]*ч\.)|(?:руб\.|р\.|тыс\.|г\.|ул\.|д\.|стр\.))$/iu;
        return protectedAbbreviations.test(textEndingWithPeriod);
    }
    function shouldKeepEnglishFinalPeriod(textEndingWithPeriod) {
        const protectedAbbreviations = /(^|[^A-Za-z])((?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|No|Fig|Inc|Ltd|Co|Corp)\.|(?:e\.g\.|i\.e\.|a\.m\.|p\.m\.))$/i;
        const protectedTechnicalEnding = /(?:\b[A-Za-z0-9-]+\.[A-Za-z]{2,}|\bv?\d+(?:\.\d+)+)$/i;
        return (protectedAbbreviations.test(textEndingWithPeriod) ||
            protectedTechnicalEnding.test(textEndingWithPeriod));
    }
    function shouldKeepFinalPeriod(textEndingWithPeriod, language) {
        if (language === "unknown") {
            return true;
        }
        return (shouldKeepRussianFinalPeriod(textEndingWithPeriod) ||
            shouldKeepEnglishFinalPeriod(textEndingWithPeriod));
    }
    function applyEnglishApostrophesRule(text) {
        let formattedText = text;
        let replacementCount = 0;
        function replaceAndCount(regexp, replacer) {
            formattedText = formattedText.replace(regexp, function (...args) {
                const stringArgs = args.map((arg) => typeof arg === "string" ? arg : "");
                const match = stringArgs[0];
                const normalized = replacer(...stringArgs);
                if (match === normalized) {
                    return match;
                }
                replacementCount += 1;
                return normalized;
            });
        }
        replaceAndCount(/([A-Za-z])'([A-Za-z])/g, function (_match, beforeApostrophe, afterApostrophe) {
            return beforeApostrophe + "’" + afterApostrophe;
        });
        replaceAndCount(/(^|[\s([{—–-])'([nN])'(?=$|[\s.,;:!?)\]}—–-])/g, function (_match, prefix, letter) {
            return prefix + "’" + letter + "’";
        });
        replaceAndCount(/(^|[\s([{—–-])'(\d{2}s\b)/g, function (_match, prefix, decade) {
            return prefix + "’" + decade;
        });
        replaceAndCount(/([A-Za-z])'(?=\s+[A-Za-z])/g, function (_match, beforeApostrophe) {
            return beforeApostrophe + "’";
        });
        return {
            formattedText,
            replacementCount,
        };
    }
    function applyRussianQuotesRule(text, settings) {
        let formattedText = text;
        let replacementCount = 0;
        const internalPrimaryQuotePair = { opening: "«", closing: "»" };
        const internalSecondaryQuotePair = { opening: "„", closing: "“" };
        const selectedPrimaryQuotePair = getRussianPrimaryQuotePair(settings);
        const selectedSecondaryQuotePair = getRussianSecondaryQuotePair(settings);
        const protectedInnerQuotes = [];
        function addReplacementResult(result) {
            formattedText = result.formattedText;
            replacementCount += result.replacementCount;
        }
        function replaceAndCount(regexp, replacer) {
            formattedText = formattedText.replace(regexp, function (...args) {
                const stringArgs = args.map((arg) => typeof arg === "string" ? arg : "");
                const match = stringArgs[0];
                const normalized = replacer(...stringArgs);
                if (match === normalized) {
                    return match;
                }
                replacementCount += 1;
                return normalized;
            });
        }
        function protectExistingSecondLevelQuotesInsideGuillemets(input) {
            return input.replace(/«([^«»\n]*?)»/g, function (_match, quoteContent) {
                const protectedQuoteContent = quoteContent.replace(/„([^„“\n]+)“/g, function (innerQuoteMatch) {
                    const token = "\uE000INNER_QUOTE_" + protectedInnerQuotes.length + "\uE001";
                    protectedInnerQuotes.push(innerQuoteMatch);
                    return token;
                });
                return "«" + protectedQuoteContent + "»";
            });
        }
        function restoreProtectedInnerQuotes(input) {
            return input.replace(/\uE000INNER_QUOTE_(\d+)\uE001/g, function (match, index) {
                return protectedInnerQuotes[Number(index)] || match;
            });
        }
        addReplacementResult(replaceQuotePairInText(formattedText, selectedPrimaryQuotePair, internalPrimaryQuotePair));
        replaceAndCount(/“([^“”\n]*?)‘([^‘’\n]+)’([^“”\n]*?)”/g, function (_match, beforeInnerQuote, innerQuoteContent, afterInnerQuote) {
            return ("«" +
                beforeInnerQuote +
                "„" +
                innerQuoteContent +
                "“" +
                afterInnerQuote +
                "»");
        });
        replaceAndCount(/“([^“”\n]*?)"([^"\n]+)"([^“”\n]*?)”/g, function (_match, beforeInnerQuote, innerQuoteContent, afterInnerQuote) {
            return ("«" +
                beforeInnerQuote +
                "„" +
                innerQuoteContent +
                "“" +
                afterInnerQuote +
                "»");
        });
        replaceAndCount(/"([^"\n]*?)‘([^‘’\n]+)’([^"\n]*?)"/g, function (_match, beforeInnerQuote, innerQuoteContent, afterInnerQuote) {
            return ("«" +
                beforeInnerQuote +
                "„" +
                innerQuoteContent +
                "“" +
                afterInnerQuote +
                "»");
        });
        addReplacementResult(replaceQuotePairInText(formattedText, selectedSecondaryQuotePair, internalSecondaryQuotePair));
        formattedText = protectExistingSecondLevelQuotesInsideGuillemets(formattedText);
        replaceAndCount(/(^|[\s([{,.;:!?…—–-])["“„‚‘]([^"“”„«»‚‘’\n]+)["”“‘’](?=$|[\s.,;:!?…)\]}—–-])/g, function (_match, prefix, quoteContent) {
            return prefix + "«" + quoteContent + "»";
        });
        formattedText = restoreProtectedInnerQuotes(formattedText);
        replaceAndCount(/«([^«»\n]*?)«([^«»\n]+)»([^«»\n]*?)»/g, function (_match, beforeInnerQuote, innerQuoteContent, afterInnerQuote) {
            return ("«" +
                beforeInnerQuote +
                "„" +
                innerQuoteContent +
                "“" +
                afterInnerQuote +
                "»");
        });
        replaceAndCount(/«([^«»\n]*?)»/g, function (_match, quoteContent) {
            const normalizedQuoteContent = quoteContent.replace(/(["“„‚‘])([^"“”„«»‚‘’\n]+)(["”“‘’])/g, function (_innerMatch, _openingQuote, innerContent) {
                return "„" + innerContent + "“";
            });
            return "«" + normalizedQuoteContent + "»";
        });
        replaceAndCount(/«([^«»\n]*?)([.,;:])»([.,;:!?…])?/g, function (match, quoteContent, innerPunctuation, outerPunctuation) {
            const quoteContentWithPunctuation = quoteContent + innerPunctuation;
            if (innerPunctuation === "." &&
                shouldKeepRussianFinalPeriod(quoteContentWithPunctuation)) {
                if (outerPunctuation === ".") {
                    return "«" + quoteContentWithPunctuation + "»";
                }
                if (outerPunctuation) {
                    return "«" + quoteContentWithPunctuation + "»" + outerPunctuation;
                }
                return match;
            }
            const punctuationToUse = outerPunctuation || innerPunctuation;
            return "«" + quoteContent + "»" + punctuationToUse;
        });
        replaceAndCount(/«([^«»\n]*?)[ \t\u00A0\u202F]*[-–—−]»([.,;:!?…])?/g, function (_match, quoteContent, outerPunctuation) {
            const trimmedQuoteContent = quoteContent.replace(/[ \t\u00A0\u202F]+$/g, "");
            const punctuation = outerPunctuation || "";
            return "«" + trimmedQuoteContent + "» —" + punctuation;
        });
        addReplacementResult(replaceQuotePairInText(formattedText, internalSecondaryQuotePair, selectedSecondaryQuotePair));
        addReplacementResult(replaceQuotePairInText(formattedText, internalPrimaryQuotePair, selectedPrimaryQuotePair));
        return {
            formattedText,
            replacementCount,
        };
    }
    function applyEnglishQuotesRule(text, settings) {
        let formattedText = text;
        let replacementCount = 0;
        const internalPrimaryQuotePair = { opening: "“", closing: "”" };
        const internalSecondaryQuotePair = { opening: "‘", closing: "’" };
        const selectedPrimaryQuotePair = getEnglishPrimaryQuotePair(settings);
        const selectedSecondaryQuotePair = getEnglishSecondaryQuotePair(settings);
        const protectedInnerQuotes = [];
        function addReplacementResult(result) {
            formattedText = result.formattedText;
            replacementCount += result.replacementCount;
        }
        function replaceAndCount(regexp, replacer) {
            formattedText = formattedText.replace(regexp, function (...args) {
                const stringArgs = args.map((arg) => typeof arg === "string" ? arg : "");
                const match = stringArgs[0];
                const normalized = replacer(...stringArgs);
                if (match === normalized) {
                    return match;
                }
                replacementCount += 1;
                return normalized;
            });
        }
        function protectExistingSecondLevelQuotesInsidePrimaryQuotes(input) {
            return input.replace(/“([^“”\n]*?)”/g, function (_match, quoteContent) {
                const protectedQuoteContent = quoteContent.replace(/‘([^‘’\n]+)’/g, function (innerQuoteMatch) {
                    const token = "\uE000EN_INNER_QUOTE_" + protectedInnerQuotes.length + "\uE001";
                    protectedInnerQuotes.push(innerQuoteMatch);
                    return token;
                });
                return "“" + protectedQuoteContent + "”";
            });
        }
        function restoreProtectedInnerQuotes(input) {
            return input.replace(/\uE000EN_INNER_QUOTE_(\d+)\uE001/g, function (match, index) {
                return protectedInnerQuotes[Number(index)] || match;
            });
        }
        addReplacementResult(replaceQuotePairInText(formattedText, selectedPrimaryQuotePair, internalPrimaryQuotePair));
        addReplacementResult(replaceQuotePairInText(formattedText, selectedSecondaryQuotePair, internalSecondaryQuotePair));
        replaceAndCount(/"([^"\n]*?)['‘]([^'‘’"\n]+)['’]([^"\n]*?)"/g, function (_match, beforeInnerQuote, innerQuoteContent, afterInnerQuote) {
            return ("“" +
                beforeInnerQuote +
                "‘" +
                innerQuoteContent +
                "’" +
                afterInnerQuote +
                "”");
        });
        replaceAndCount(/'([^'"\n]*?)"([^"\n]+)"([^'"\n]*?)'/g, function (_match, beforeInnerQuote, innerQuoteContent, afterInnerQuote) {
            return ("‘" +
                beforeInnerQuote +
                "“" +
                innerQuoteContent +
                "”" +
                afterInnerQuote +
                "’");
        });
        replaceAndCount(/(^|[\s([{,.;:!?…—–-])'([^'‘’"\n][^'\n]*?[^'‘’"\n])'(?=$|[\s.,;:!?…)\]}—–-])/g, function (_match, prefix, quoteContent) {
            return prefix + "‘" + quoteContent + "’";
        });
        replaceAndCount(/«([^«»\n]*?)„([^„“\n]+)“([^«»\n]*?)»/g, function (_match, beforeInnerQuote, innerQuoteContent, afterInnerQuote) {
            return ("“" +
                beforeInnerQuote +
                "‘" +
                innerQuoteContent +
                "’" +
                afterInnerQuote +
                "”");
        });
        replaceAndCount(/«([^«»\n]*?)"([^"\n]+)"([^«»\n]*?)»/g, function (_match, beforeInnerQuote, innerQuoteContent, afterInnerQuote) {
            return ("“" +
                beforeInnerQuote +
                "‘" +
                innerQuoteContent +
                "’" +
                afterInnerQuote +
                "”");
        });
        replaceAndCount(/«([^«»\n]*?)‘([^‘’\n]+)’([^«»\n]*?)»/g, function (_match, beforeInnerQuote, innerQuoteContent, afterInnerQuote) {
            return ("“" +
                beforeInnerQuote +
                "‘" +
                innerQuoteContent +
                "’" +
                afterInnerQuote +
                "”");
        });
        formattedText =
            protectExistingSecondLevelQuotesInsidePrimaryQuotes(formattedText);
        replaceAndCount(/(^|[\s([{,.;:!?…—–-])["“„«]([^"“”„«»\n]+)["”“»](?=$|[\s.,;:!?…)\]}—–-])/g, function (_match, prefix, quoteContent) {
            return prefix + "“" + quoteContent + "”";
        });
        formattedText = restoreProtectedInnerQuotes(formattedText);
        replaceAndCount(/“([^“”\n]*?)“([^“”\n]+)”([^“”\n]*?)”/g, function (_match, beforeInnerQuote, innerQuoteContent, afterInnerQuote) {
            return ("“" +
                beforeInnerQuote +
                "‘" +
                innerQuoteContent +
                "’" +
                afterInnerQuote +
                "”");
        });
        replaceAndCount(/“([^“”\n]*?)”/g, function (_match, quoteContent) {
            const normalizedQuoteContent = quoteContent.replace(/(["“„«‚‘])([^"“”„«»‚‘’\n]+)(["”“»‘’])/g, function (_innerMatch, _openingQuote, innerContent) {
                return "‘" + innerContent + "’";
            });
            return "“" + normalizedQuoteContent + "”";
        });
        addReplacementResult(replaceQuotePairInText(formattedText, internalSecondaryQuotePair, selectedSecondaryQuotePair));
        addReplacementResult(replaceQuotePairInText(formattedText, internalPrimaryQuotePair, selectedPrimaryQuotePair));
        return {
            formattedText,
            replacementCount,
        };
    }
    function applyNumberRangeDashRule(text) {
        const timeRangeRegexp = /(^|[^\d:])(\d{1,2}:\d{2})[ \t\u00A0\u202F]*[-–—−][ \t\u00A0\u202F]*(\d{1,2}:\d{2})(?=$|[^\d:])/g;
        const numberRangeRegexp = /(^|[^\d–—−-])(\d{1,4})[ \t\u00A0\u202F]*[-–—−][ \t\u00A0\u202F]*(\d{1,4})(?=$|[^\d–—−-])/g;
        const monthNames = "январь|февраль|март|апрель|май|июнь|июль|август|сентябрь|октябрь|ноябрь|декабрь";
        const weekdayNames = "понедельник|вторник|среда|четверг|пятница|суббота|воскресенье";
        const monthRangeRegexp = new RegExp("(^|[^А-Яа-яЁё])(" +
            monthNames +
            ")[ \t\u00A0\u202F]*[-–—−][ \t\u00A0\u202F]*(" +
            monthNames +
            ")(?=$|[^А-Яа-яЁё])", "giu");
        const weekdayRangeRegexp = new RegExp("(^|[^А-Яа-яЁё])(" +
            weekdayNames +
            ")[ \t\u00A0\u202F]*[-–—−][ \t\u00A0\u202F]*(" +
            weekdayNames +
            ")(?=$|[^А-Яа-яЁё])", "giu");
        const romanNumberRangeRegexp = /(^|[^A-Za-zА-Яа-яЁё0-9])([IVXLCDM]{1,8})[ \t\u00A0\u202F]*[-–—−][ \t\u00A0\u202F]*([IVXLCDM]{1,8})(?=$|[^A-Za-zА-Яа-яЁё0-9])/g;
        let formattedText = text;
        let replacementCount = 0;
        function replaceRangeAndCount(regexp, getNormalized) {
            formattedText = formattedText.replace(regexp, function (...args) {
                const stringArgs = args.map((arg) => typeof arg === "string" ? arg : "");
                const match = stringArgs[0];
                const normalized = getNormalized(...stringArgs);
                if (match === normalized) {
                    return match;
                }
                replacementCount += 1;
                return normalized;
            });
        }
        replaceRangeAndCount(timeRangeRegexp, function (_match, prefix, startTime, endTime) {
            return prefix + startTime + "–" + endTime;
        });
        replaceRangeAndCount(numberRangeRegexp, function (_match, prefix, startNumber, endNumber) {
            return prefix + startNumber + "–" + endNumber;
        });
        replaceRangeAndCount(monthRangeRegexp, function (_match, prefix, startMonth, endMonth) {
            return prefix + startMonth + "–" + endMonth;
        });
        replaceRangeAndCount(weekdayRangeRegexp, function (_match, prefix, startWeekday, endWeekday) {
            return prefix + startWeekday + "–" + endWeekday;
        });
        replaceRangeAndCount(romanNumberRangeRegexp, function (_match, prefix, startNumber, endNumber) {
            return prefix + startNumber + "–" + endNumber;
        });
        return {
            formattedText,
            replacementCount,
        };
    }
    function applyRussianSentenceDashRule(text) {
        const regexp = /([А-Яа-яЁёA-Za-z0-9»”’")\].!?…])([ \t\u00A0\u202F]+)[-–—−]([ \t\u00A0\u202F]+)([А-Яа-яЁёA-Za-z0-9«„“"([])/g;
        let replacementCount = 0;
        let formattedText = text.replace(regexp, function (match, leftChar, _leftSpace, _rightSpace, rightChar) {
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
        formattedText = formattedText.replace(/([А-Яа-яЁёA-Za-z0-9»”’")\].!?…])—([А-Яа-яЁёA-Za-z0-9«„“"([])/g, function (match, leftChar, rightChar) {
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
    function applyRussianShortWordsNbspRule(text, _settings) {
        const regularNbsp = "\u00A0";
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
        const shortWords = "а|б|без|безо|будто|бы|в|ведь|во|вне|вот|всё|где|да|даже|для|до|если|есть|ещё|же|за|и|из|изо|из-за|из-под|или|иль|к|ко|как|ли|ль|либо|между|на|над|надо|не|ни|но|о|об|обо|около|оно|от|ото|перед|по|по-за|по-над|под|подо|после|при|про|ради|с|со|сквозь|так|также|там|тем|то|тогда|того|тоже|у|хоть|хотя|чего|через|что|чтобы|это";
        const trailingShortWords = "в|во|к|ко|о|об|обо|от|ото|по|с|со|у|до|за|из|на|над|под|при|про|для";
        const particles = "б|бы|ж|же|ли|ль";
        const addressAbbreviations = "г|обл|кр|ст|пос|с|ул|пер|пр|пр-т|просп|пл|бул|б-р|наб|ш|туп|оф|кв|комн|под|мкр|уч|вл|влад|стр|корп|литер|эт|пгт|пт|гл|рис|илл";
        const legalEntityAbbreviations = "АО|ОАО|ЗАО|ООО|ПАО|ИП";
        replaceAndCount(new RegExp("(^|[ \t\u00A0\u202F(«„“])(" +
            shortWords +
            ")[ \t\u00A0\u202F]+(?=[А-Яа-яЁёA-Za-z0-9\uE100])", "giu"), function (_match, prefix, word) {
            return prefix + word + regularNbsp;
        });
        replaceAndCount(new RegExp("(^|[^А-Яа-яЁёA-Za-z])(" +
            addressAbbreviations +
            ")\\.[ \t\u00A0\u202F]+(?=[А-Яа-яЁёA-Za-z0-9№§])", "giu"), function (_match, prefix, abbreviation) {
            return prefix + abbreviation + "." + regularNbsp;
        });
        replaceAndCount(new RegExp("(^|[^А-Яа-яЁёA-Za-z])(" +
            legalEntityAbbreviations +
            ")[ \t\u00A0\u202F]+(?=[А-Яа-яЁёA-Za-z0-9«„“\"])", "g"), function (_match, prefix, abbreviation) {
            return prefix + abbreviation + regularNbsp;
        });
        replaceAndCount(new RegExp("(^|[^А-Яа-яЁёA-Za-z])(" +
            legalEntityAbbreviations +
            ")(?=[«„“\"])", "g"), function (_match, prefix, abbreviation) {
            return prefix + abbreviation + regularNbsp;
        });
        replaceAndCount(/(^|[^А-Яа-яЁёA-Za-z])(литер)[ \t\u00A0\u202F]+(?=[А-ЯЁA-Z0-9])/giu, function (_match, prefix, abbreviation) {
            return prefix + abbreviation + regularNbsp;
        });
        replaceAndCount(/(^|[^А-Яа-яЁёA-Za-z])([дД])\.[ \t\u00A0\u202F]+(?=\d)/g, function (_match, prefix, abbreviation) {
            return prefix + abbreviation + "." + regularNbsp;
        });
        replaceAndCount(/(^|[^А-Яа-яЁёA-Za-z])([тТ])\.[ \t\u00A0\u202F]*([еЕкКдДпПчЧнНоО])\./g, function (_match, prefix, firstLetter, secondLetter) {
            return prefix + firstLetter + "." + regularNbsp + secondLetter + ".";
        });
        replaceAndCount(/(^|[^А-Яа-яЁёA-Za-z])([иИ])[ \t\u00A0\u202F]+([тТ])\.[ \t\u00A0\u202F]*([дДпП])\./g, function (_match, prefix, conjunction, firstLetter, secondLetter) {
            return (prefix +
                conjunction +
                regularNbsp +
                firstLetter +
                "." +
                regularNbsp +
                secondLetter +
                ".");
        });
        replaceAndCount(/(^|[^А-Яа-яЁёA-Za-z])([иИ])[ \t\u00A0\u202F]+([дД]р)\./g, function (_match, prefix, conjunction, abbreviation) {
            return prefix + conjunction + regularNbsp + abbreviation + ".";
        });
        const numberUnitAbbreviations = new Set([
            "°c",
            "°f",
            "°с",
            "руб",
            "рублей",
            "р",
            "тыс",
            "млн",
            "млрд",
            "трлн",
            "кг",
            "г",
            "мг",
            "л",
            "мл",
            "м",
            "см",
            "мм",
            "км",
            "с",
            "сек",
            "мин",
            "ч",
            "д",
            "дн",
            "кб",
            "мб",
            "гб",
            "тб",
        ]);
        replaceAndCount(/(^|[^0-9A-Za-zА-Яа-яЁё])([0-9]+(?:[,.][0-9]+)?)[ \t\u00A0\u202F]+(?=([А-Яа-яЁё]+\.?))/g, function (match, prefix, number, nextWord) {
            const normalizedNextWord = nextWord
                .replace(/\.$/, "")
                .toLowerCase();
            if (numberUnitAbbreviations.has(normalizedNextWord)) {
                return match;
            }
            return prefix + number + regularNbsp;
        });
        replaceAndCount(new RegExp("([А-Яа-яЁёA-Za-z0-9»”’)])([ \t\u00A0\u202F]+)(" +
            particles +
            ")(?=$|[ \t\u00A0\u202F\n\r,.;:!?…)])", "giu"), function (_match, previousCharacter, _space, particle) {
            return previousCharacter + regularNbsp + particle;
        });
        replaceAndCount(new RegExp("([А-Яа-яЁёA-Za-z0-9»”’)])([ \t\u00A0\u202F]+)(" +
            trailingShortWords +
            ")(?=$|[\n\r,.;:!?…»”’)])", "giu"), function (_match, previousCharacter, _space, word) {
            return previousCharacter + regularNbsp + word;
        });
        return {
            formattedText,
            replacementCount,
        };
    }
    function applyRussianInitialsNbspRule(text, _settings) {
        const space = "\u00A0";
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
    function applyUiFinalPeriodRule(text, _settings, language) {
        let replacementCount = 0;
        function normalizeLine(line) {
            const trailingWhitespaceMatch = line.match(/[ \t\u00A0\u202F]*$/);
            const trailingWhitespace = trailingWhitespaceMatch
                ? trailingWhitespaceMatch[0]
                : "";
            const lineWithoutTrailingWhitespace = line.slice(0, line.length - trailingWhitespace.length);
            const closingCharacters = "»”\"’“‘)]}";
            const lastCharacter = lineWithoutTrailingWhitespace.slice(-1);
            const beforeLastCharacter = lineWithoutTrailingWhitespace.slice(0, -1);
            if (closingCharacters.includes(lastCharacter) &&
                beforeLastCharacter.endsWith(".")) {
                if (shouldKeepFinalPeriod(beforeLastCharacter, language)) {
                    return line;
                }
                replacementCount += 1;
                return beforeLastCharacter.slice(0, -1) + lastCharacter + trailingWhitespace;
            }
            if (!lineWithoutTrailingWhitespace.endsWith(".")) {
                return line;
            }
            if (/[?!]\.\.$/.test(lineWithoutTrailingWhitespace)) {
                return line;
            }
            if (shouldKeepFinalPeriod(lineWithoutTrailingWhitespace, language)) {
                return line;
            }
            replacementCount += 1;
            return lineWithoutTrailingWhitespace.slice(0, -1) + trailingWhitespace;
        }
        const formattedText = text.replace(/([^\r\n]*)(\r\n|\n|\r|$)/g, function (match, line, lineEnding) {
            if (match === "") {
                return match;
            }
            return normalizeLine(line) + lineEnding;
        });
        return {
            formattedText,
            replacementCount,
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
            id: "manualLineBreaks",
            supportedLanguages: "all",
            apply: applyManualLineBreaksRule,
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
            id: "spacingCleanup",
            supportedLanguages: "all",
            apply: applySpacingCleanupRule,
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
            id: "numberSigns",
            supportedLanguages: "all",
            apply: applyNumberSignsRule,
        },
        {
            id: "specialSymbols",
            supportedLanguages: "all",
            apply: applySpecialSymbolsRule,
        },
        {
            id: "englishApostrophes",
            supportedLanguages: ["en"],
            apply: applyEnglishApostrophesRule,
        },
        {
            id: "englishQuotes",
            supportedLanguages: ["en"],
            apply: applyEnglishQuotesRule,
        },
        {
            id: "russianQuotes",
            supportedLanguages: ["ru"],
            apply: applyRussianQuotesRule,
        },
        {
            id: "numberRangeDash",
            supportedLanguages: "all",
            apply: applyNumberRangeDashRule,
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
            id: "uiFinalPeriod",
            supportedLanguages: ["ru", "en"],
            apply: applyUiFinalPeriodRule,
        },
    ];
    function isRuleSupportedForLanguage(rule, language) {
        if (rule.supportedLanguages === "all") {
            return true;
        }
        return rule.supportedLanguages.includes(language);
    }
    const PROTECTED_TEXT_TOKEN_START = "\uE100";
    const PROTECTED_TEXT_TOKEN_END = "\uE101";
    const PROTECTED_TEXT_TOKEN_CHAR_OFFSET = 0xe200;
    function createProtectedTextToken(index) {
        return (PROTECTED_TEXT_TOKEN_START +
            String.fromCharCode(PROTECTED_TEXT_TOKEN_CHAR_OFFSET + index) +
            PROTECTED_TEXT_TOKEN_END);
    }
    function splitTrailingPunctuation(value) {
        const trailingPunctuationMatch = value.match(/[.,;:!?…]+$/);
        if (!trailingPunctuationMatch) {
            return {
                protectedValue: value,
                trailingPunctuation: "",
            };
        }
        const trailingPunctuation = trailingPunctuationMatch[0];
        return {
            protectedValue: value.slice(0, value.length - trailingPunctuation.length),
            trailingPunctuation,
        };
    }
    function protectTextFragments(text) {
        const fragments = [];
        let protectedText = text;
        function protectValue(value, trailingPunctuation = "") {
            if (value.length === 0) {
                return value + trailingPunctuation;
            }
            const token = createProtectedTextToken(fragments.length);
            fragments.push({
                token,
                value,
            });
            return token + trailingPunctuation;
        }
        function protectByRegexp(regexp) {
            protectedText = protectedText.replace(regexp, function (match) {
                const { protectedValue, trailingPunctuation } = splitTrailingPunctuation(match);
                return protectValue(protectedValue, trailingPunctuation);
            });
        }
        function protectExactByRegexp(regexp) {
            protectedText = protectedText.replace(regexp, function (match) {
                return protectValue(match);
            });
        }
        function isRomanNumeralRange(value) {
            return /^[IVXLCDM]{1,8}[-–—−][IVXLCDM]{1,8}$/.test(value);
        }
        function protectCodeLikeTokensByRegexp(regexp) {
            protectedText = protectedText.replace(regexp, function (match) {
                if (isRomanNumeralRange(match)) {
                    return match;
                }
                const { protectedValue, trailingPunctuation } = splitTrailingPunctuation(match);
                return protectValue(protectedValue, trailingPunctuation);
            });
        }
        function protectHtmlLikeTags() {
            protectByRegexp(/<\/?[A-Za-z][A-Za-z0-9:-]*(?:\s+[A-Za-z_:][A-Za-z0-9:._-]*(?:=(?:"[^"\n]*"|'[^'\n]*'|[^\s"'=<>`]+))?)*\s*\/?>/g);
        }
        function protectBalancedCurlyBraceFragments() {
            let result = "";
            let lastIndex = 0;
            let depth = 0;
            let placeholderStart = -1;
            for (let index = 0; index < protectedText.length; index += 1) {
                const character = protectedText[index];
                if (character === "{") {
                    if (depth === 0) {
                        placeholderStart =
                            index > lastIndex && protectedText[index - 1] === "$"
                                ? index - 1
                                : index;
                    }
                    depth += 1;
                }
                else if (character === "}" && depth > 0) {
                    depth -= 1;
                    if (depth === 0 && placeholderStart >= 0) {
                        const placeholderEnd = index + 1;
                        const placeholder = protectedText.slice(placeholderStart, placeholderEnd);
                        result += protectedText.slice(lastIndex, placeholderStart);
                        result += protectValue(placeholder);
                        lastIndex = placeholderEnd;
                        placeholderStart = -1;
                    }
                }
            }
            if (lastIndex === 0) {
                return;
            }
            protectedText = result + protectedText.slice(lastIndex);
        }
        function hasCurrencyContext(textFragment) {
            return /(?:цена|стоимость|стоить|стоит|стоили|тариф|подписк|скидк|плат[её]ж|оплат|за|от|до|price|cost|costs|subscription|discount|plan|payment|from|to)/iu.test(textFragment);
        }
        function protectDollarPlaceholders() {
            protectedText = protectedText.replace(/\$\d+\b/g, function (match, offset, fullText) {
                const contextWindow = 32;
                const localContext = fullText.slice(Math.max(0, offset - contextWindow), offset) +
                    " " +
                    fullText.slice(offset + match.length, Math.min(fullText.length, offset + match.length + contextWindow));
                if (hasCurrencyContext(localContext)) {
                    return match;
                }
                return protectValue(match);
            });
        }
        protectByRegexp(/`[^`\n]+`/g);
        protectHtmlLikeTags();
        protectBalancedCurlyBraceFragments();
        protectExactByRegexp(/&(?:[A-Za-z][A-Za-z0-9]{1,31}|#\d{1,7}|#x[0-9A-Fa-f]{1,6});/g);
        protectByRegexp(/%(?:\d+\$)?[@sdif]/g);
        protectDollarPlaceholders();
        protectByRegexp(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g);
        protectByRegexp(/\b[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s<>]+/g);
        protectByRegexp(/\bwww\.[^\s<>]+/gi);
        protectByRegexp(/(^|[\s([{])(?:\.{0,2}\/|~\/)[^\s<>]+/g);
        protectByRegexp(/\b[A-Za-z]:\\[^\s<>'"]+/g);
        protectByRegexp(/\b[A-Za-z0-9-]+\.(?:com|ru|net|org|io|dev|app|site|ai|co|me)(?:\/[^\s<>]*)?/gi);
        protectByRegexp(/\b(?:v\d+(?:\.\d+){1,}|\d+(?:\.\d+){2,})(?:[-+][A-Za-z0-9._-]+)?\b/g);
        protectByRegexp(/\b[A-Za-z][A-Za-z0-9]*(?:[_.-][A-Za-z0-9]+)+(?:\|[A-Za-z][A-Za-z0-9]*(?:[_.-][A-Za-z0-9]+)+)+\b/g);
        protectByRegexp(/\b[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*){2,}\b/g);
        protectCodeLikeTokensByRegexp(/\b[A-Za-z][A-Za-z0-9]*(?:[_-][A-Za-z0-9]+)+\b/g);
        protectCodeLikeTokensByRegexp(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g);
        protectByRegexp(/\b(?=[A-Za-z0-9/]*[A-Za-z])[A-Za-z0-9]+(?:\/[A-Za-z0-9]+)+\b/g);
        protectByRegexp(/\b\d+\/\d+-[A-Za-z0-9_-]+\b/g);
        protectByRegexp(/\b(?:const|let|var)\s+[A-Za-z_$][A-Za-z0-9_$]*\s*=\s*(['"])[^'"\n]*\1/g);
        return {
            protectedText,
            fragments,
        };
    }
    function restoreProtectedTextFragments(text, fragments) {
        let restoredText = text;
        for (const fragment of fragments) {
            restoredText = restoredText.split(fragment.token).join(fragment.value);
        }
        restoredText = restoredText.replace(/([,.;:!?…])[ \t\u00A0\u202F]+(<\/[A-Za-z][A-Za-z0-9:-]*>)/g, "$1$2");
        restoredText = restoredText.replace(/(&(?:nbsp|#160|#x202F);)[ \t\u00A0\u202F]+/gi, "$1");
        return restoredText;
    }
    function repairSplitRubleFractionalAmountsAfterAllRules(text, settings, language) {
        const space = getConfiguredNbsp(settings);
        let replacementCount = 0;
        function isSentenceBoundaryAt(index, fullText) {
            const character = fullText[index];
            if (character === "\n" || character === "\r") {
                return true;
            }
            if (character !== "." && character !== "!" && character !== "?") {
                return false;
            }
            const previousCharacter = index > 0 ? fullText[index - 1] : "";
            const nextCharacter = fullText[index + 1] || "";
            if (/\d/.test(previousCharacter) && /\d/.test(nextCharacter)) {
                return false;
            }
            return true;
        }
        function resolveRepairLanguage(offset, fullText) {
            if (settings.languageMode === "ru" || settings.languageMode === "en") {
                return settings.languageMode;
            }
            const contextWindow = 48;
            let contextStart = Math.max(0, offset - contextWindow);
            let contextEnd = Math.min(fullText.length, offset + contextWindow);
            for (let index = offset - 1; index >= contextStart; index -= 1) {
                if (isSentenceBoundaryAt(index, fullText)) {
                    contextStart = index + 1;
                    break;
                }
            }
            for (let index = offset; index < contextEnd; index += 1) {
                if (isSentenceBoundaryAt(index, fullText)) {
                    contextEnd = index;
                    break;
                }
            }
            const localContext = fullText.slice(contextStart, contextEnd);
            const cyrillicCount = (localContext.match(/[А-Яа-яЁё]/g) || []).length;
            const latinCount = (localContext.match(/[A-Za-z]/g) || []).length;
            if (cyrillicCount > 0 && cyrillicCount >= latinCount) {
                return "ru";
            }
            if (latinCount > 0 && latinCount > cyrillicCount) {
                return "en";
            }
            if (language === "en") {
                return "en";
            }
            return "ru";
        }
        const formattedText = text.replace(/(^|[ \t\u00A0\u202F([{«„“"'\uE101])([+−]?\d+)[ \t\u00A0\u202F]*₽[ \t\u00A0\u202F]*[,.](\d{1,2})(?=$|[ \t\n\r,.;:!?…)\]}»”’\uE100])/gu, function (match, prefix, rubles, kopecks, offset, fullText) {
            const repairLanguage = resolveRepairLanguage(offset, fullText);
            const isNegative = rubles.startsWith("−");
            const unsignedRubles = isNegative ? rubles.slice(1) : rubles;
            const normalized = repairLanguage === "en"
                ? prefix + (isNegative ? "−" : "") + "₽" + unsignedRubles + "." + kopecks
                : prefix + rubles + "," + kopecks + space + "₽";
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
    function applyRulesToText(text, settings, language) {
        const { protectedText, fragments } = protectTextFragments(text);
        let formattedText = protectedText;
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
            const result = rule.apply(formattedText, settings, language);
            formattedText = result.formattedText;
            replacementCount += result.replacementCount;
        }
        if (settings.enabledRules.specialSymbols) {
            const splitRubleRepairResult = repairSplitRubleFractionalAmountsAfterAllRules(formattedText, settings, language);
            formattedText = splitRubleRepairResult.formattedText;
            replacementCount += splitRubleRepairResult.replacementCount;
        }
        return {
            formattedText: restoreProtectedTextFragments(formattedText, fragments),
            replacementCount,
            skippedRuleCount,
        };
    }
    TypotypoEngine.applyRulesToText = applyRulesToText;
})(TypotypoEngine || (TypotypoEngine = {}));
/// <reference path="./typography-engine.ts" />
const SETTINGS_STORAGE_KEY = "typographyFormatterSettings";
const UI_SETTINGS_STORAGE_KEY = "typotypoInterfaceSettings";
const PAGE_AVAILABILITY_RELEVANT_PROPERTIES = new Set([
    "parent",
    "locked",
    "visible",
    "styledTextSegments",
    "fontName",
    "textStyleId",
    "componentPropertyReferences",
    "componentProperties",
    "type",
]);
const MAX_CACHED_PAGES = 10;
const pageAvailabilityCache = new Map();
const pageNodeChangeSubscriptions = new Map();
// Temporary end-to-end diagnostics for the "selected frame -> whole page"
// scope-switch lag investigation. Logs only counts, durations, booleans and
// a small allow-listed set of property names — never layer/page/font names
// or text content. Safe to delete wholesale once the investigation is done.
const SCOPE_SWITCH_DEBUG = true;
function scopeSwitchDebugNow() {
    if (typeof performance !== "undefined" && typeof performance.now === "function") {
        return performance.now();
    }
    return Date.now();
}
function scopeSwitchCacheDirtyLog(details) {
    if (SCOPE_SWITCH_DEBUG) {
        console.log("[page-cache-dirty]", details);
    }
}
const SCOPE_SWITCH_DIRTY_SAFE_PROPERTIES = new Set([
    "characters",
    "visible",
    "locked",
    "fontName",
    "textStyleId",
    "styledTextSegments",
]);
function summarizeScopeSwitchChangedProperties(event) {
    const seen = new Set();
    for (const change of event.nodeChanges) {
        if (change.type !== "PROPERTY_CHANGE") {
            continue;
        }
        for (const property of change.properties) {
            if (SCOPE_SWITCH_DIRTY_SAFE_PROPERTIES.has(property)) {
                seen.add(property);
            }
        }
    }
    return Array.from(seen);
}
function createScopeSwitchPageDebugInfo() {
    return {
        updateQueueWaitDurationMs: 0,
        pageLoadDurationMs: 0,
        collectTextNodesDurationMs: 0,
        analyzeTextNodesDurationMs: 0,
        backgroundPrewarm: false,
        batchSize: 0,
        batchCount: 0,
        yieldCount: 0,
        textNodeCount: 0,
        longestBatchDurationMs: 0,
        requestWasWaitingForPending: false,
        resultCommitted: false,
        resultDiscarded: false,
    };
}
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
function createInitialUiHtml(uiSettings) {
    const initialTheme = uiSettings.theme || "system";
    const initialThemeScript = `<script>
    (() => {
      const themeMode = ${JSON.stringify(initialTheme)};
      const systemIsDark = Boolean(
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      );
      const effectiveTheme = themeMode === "system"
        ? (systemIsDark ? "dark" : "light")
        : themeMode;

      document.documentElement.dataset.theme = effectiveTheme;

      try {
        window.localStorage.setItem("typotypoTheme", themeMode);
      } catch (error) {}
    })();
  </script>`;
    const firstStyleIndex = __html__.indexOf("<style>");
    if (firstStyleIndex < 0) {
        return initialThemeScript + __html__;
    }
    return (__html__.slice(0, firstStyleIndex) +
        initialThemeScript +
        __html__.slice(firstStyleIndex));
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
function getAncestorLocalData(ancestor, ancestorLocalDataCache) {
    const cached = ancestorLocalDataCache.get(ancestor);
    if (cached) {
        return cached;
    }
    const localData = {
        parent: ancestor.parent,
        selfHidden: "visible" in ancestor && ancestor.visible === false,
        selfLocked: "locked" in ancestor && ancestor.locked === true,
    };
    ancestorLocalDataCache.set(ancestor, localData);
    return localData;
}
// Combined, cached hidden/locked ancestor resolution used only by
// analyzeTextNodeAvailability's pre-analysis pass. Both caches are created
// fresh per analyzeTextNodeAvailability call (see there) so they never
// outlive a single analysis and cannot serve stale values across
// nodechange events. Keyed by node object identity, never by node.id, and
// the TextNode being analyzed is never inserted into either cache (only its
// ancestors are, since only ancestors can be shared between sibling text
// layers). Semantics mirror isNodeHiddenBySelfOrParent/
// isNodeLockedBySelfOrParent exactly (same "in" guards, same
// OR-over-ancestors rule), just computed together in one walk instead of
// two, with each ancestor's own properties read at most once.
function resolveAncestorAvailabilityFlags(parent, ancestorAvailabilityCache, ancestorLocalDataCache) {
    if (!parent) {
        return { hidden: false, locked: false };
    }
    const chain = [];
    let currentNode = parent;
    let inherited = { hidden: false, locked: false };
    while (currentNode) {
        const cachedFlags = ancestorAvailabilityCache.get(currentNode);
        if (cachedFlags) {
            inherited = cachedFlags;
            break;
        }
        const localData = getAncestorLocalData(currentNode, ancestorLocalDataCache);
        chain.push({ node: currentNode, localData });
        currentNode = localData.parent;
    }
    let effective = inherited;
    for (let index = chain.length - 1; index >= 0; index -= 1) {
        const { node: chainNode, localData } = chain[index];
        effective = {
            hidden: effective.hidden || localData.selfHidden,
            locked: effective.locked || localData.selfLocked,
        };
        ancestorAvailabilityCache.set(chainNode, effective);
    }
    return effective;
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
    // Deep fallback for a root whose type has no findAllWithCriteria (e.g. a
    // plain shape with no children). Never reads text/visibility/lock
    // properties, only .type and .children, same as before.
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
    for (const root of roots) {
        if (root.type === "TEXT") {
            addTextNode(root);
            continue;
        }
        if ("findAllWithCriteria" in root) {
            const descendantTextNodes = root.findAllWithCriteria({
                types: ["TEXT"],
            });
            for (const textNode of descendantTextNodes) {
                addTextNode(textNode);
            }
            continue;
        }
        walk(root);
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
    if (node.characters.length === 0) {
        return [];
    }
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
        try {
            for (const segment of node.getStyledTextSegments(["fontName"])) {
                addFont(segment.fontName);
            }
        }
        catch (error) {
            console.warn("Could not read styled text segments while collecting fonts:", error);
            for (const fontName of node.getRangeAllFontNames(0, node.characters.length)) {
                addFont(fontName);
            }
        }
    }
    return Array.from(new Map(fonts.map((font) => [`${font.family}-${font.style}`, font])).values());
}
function createEmptyTextNodeAvailabilitySummary() {
    return {
        totalTextNodeCount: 0,
        availableTextNodeCount: 0,
        skippedHiddenNodeCount: 0,
        skippedLockedNodeCount: 0,
        skippedEmptyNodeCount: 0,
        skippedMissingFontsNodeCount: 0,
    };
}
function adjustTextNodeAvailabilitySummary(summary, state, delta) {
    summary.totalTextNodeCount += delta;
    if (state === "available") {
        summary.availableTextNodeCount += delta;
        return;
    }
    if (state === "hidden") {
        summary.skippedHiddenNodeCount += delta;
        return;
    }
    if (state === "locked") {
        summary.skippedLockedNodeCount += delta;
        return;
    }
    if (state === "empty") {
        summary.skippedEmptyNodeCount += delta;
        return;
    }
    summary.skippedMissingFontsNodeCount += delta;
}
async function analyzeTextNodeAvailability(textNodes) {
    const summary = createEmptyTextNodeAvailabilitySummary();
    const states = new Map();
    const documentHasMissingFont = figma.hasMissingFont;
    const ancestorAvailabilityCache = new Map();
    const ancestorLocalDataCache = new Map();
    for (const node of textNodes) {
        const selfHidden = "visible" in node && node.visible === false;
        const selfLocked = "locked" in node && node.locked === true;
        const ancestorFlags = resolveAncestorAvailabilityFlags(node.parent, ancestorAvailabilityCache, ancestorLocalDataCache);
        const isHidden = selfHidden || ancestorFlags.hidden;
        const isLocked = selfLocked || ancestorFlags.locked;
        let skipReason = null;
        if (isHidden) {
            skipReason = "hidden";
        }
        else if (isLocked) {
            skipReason = "locked";
        }
        else if (node.characters.trim().length === 0) {
            skipReason = "empty";
        }
        if (skipReason) {
            states.set(node.id, skipReason);
            adjustTextNodeAvailabilitySummary(summary, skipReason, 1);
            continue;
        }
        const hasMissingFont = documentHasMissingFont
            ? node.hasMissingFont
            : false;
        const state = hasMissingFont
            ? "missingFonts"
            : "available";
        states.set(node.id, state);
        adjustTextNodeAvailabilitySummary(summary, state, 1);
    }
    return { summary, states };
}
// Full-page rebuild only. Same per-node algorithm and ancestor caches as
// analyzeTextNodeAvailability (kept untouched above for selection/
// missingNodes/CREATE/incremental use), just chunked so a large page doesn't
// block the single JS thread for one long synchronous stretch. The ancestor
// caches are created once and reused across batches; a yield only hands
// control back to the event loop, it never invalidates prior work.
const PAGE_ANALYSIS_BATCH_SIZE = 64;
// Minimum time between broadcast progress updates for a full-page analysis
// (the very first and very last updates always bypass this, see call site).
const PAGE_ANALYSIS_PROGRESS_THROTTLE_MS = 250;
function yieldToEventLoop() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}
const pageAnalysisProgressListeners = new Map();
function addPageAnalysisProgressListener(pageId, listener) {
    let listeners = pageAnalysisProgressListeners.get(pageId);
    if (!listeners) {
        listeners = new Set();
        pageAnalysisProgressListeners.set(pageId, listeners);
    }
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
            pageAnalysisProgressListeners.delete(pageId);
        }
    };
}
function notifyPageAnalysisProgress(pageId, progress) {
    const listeners = pageAnalysisProgressListeners.get(pageId);
    if (!listeners) {
        return;
    }
    for (const listener of listeners) {
        listener(progress);
    }
}
async function analyzeTextNodeAvailabilityInBatches(textNodes, isStillValid, scopeSwitchDebugInfo, onBatchProgress) {
    const summary = createEmptyTextNodeAvailabilitySummary();
    const states = new Map();
    const documentHasMissingFont = figma.hasMissingFont;
    const ancestorAvailabilityCache = new Map();
    const ancestorLocalDataCache = new Map();
    let batchCount = 0;
    let yieldCount = 0;
    let longestBatchDurationMs = 0;
    const reportBatchDebugInfo = () => {
        if (SCOPE_SWITCH_DEBUG && scopeSwitchDebugInfo) {
            scopeSwitchDebugInfo.batchSize = PAGE_ANALYSIS_BATCH_SIZE;
            scopeSwitchDebugInfo.batchCount = batchCount;
            scopeSwitchDebugInfo.yieldCount = yieldCount;
            scopeSwitchDebugInfo.longestBatchDurationMs = longestBatchDurationMs;
        }
    };
    for (let batchStart = 0; batchStart < textNodes.length; batchStart += PAGE_ANALYSIS_BATCH_SIZE) {
        if (!isStillValid()) {
            reportBatchDebugInfo();
            return null;
        }
        const batchStartedAt = SCOPE_SWITCH_DEBUG ? scopeSwitchDebugNow() : 0;
        const batchEnd = Math.min(batchStart + PAGE_ANALYSIS_BATCH_SIZE, textNodes.length);
        for (let index = batchStart; index < batchEnd; index += 1) {
            const node = textNodes[index];
            const selfHidden = "visible" in node && node.visible === false;
            const selfLocked = "locked" in node && node.locked === true;
            const ancestorFlags = resolveAncestorAvailabilityFlags(node.parent, ancestorAvailabilityCache, ancestorLocalDataCache);
            const isHidden = selfHidden || ancestorFlags.hidden;
            const isLocked = selfLocked || ancestorFlags.locked;
            let skipReason = null;
            if (isHidden) {
                skipReason = "hidden";
            }
            else if (isLocked) {
                skipReason = "locked";
            }
            else if (node.characters.trim().length === 0) {
                skipReason = "empty";
            }
            if (skipReason) {
                states.set(node.id, skipReason);
                adjustTextNodeAvailabilitySummary(summary, skipReason, 1);
                continue;
            }
            const hasMissingFont = documentHasMissingFont
                ? node.hasMissingFont
                : false;
            const state = hasMissingFont
                ? "missingFonts"
                : "available";
            states.set(node.id, state);
            adjustTextNodeAvailabilitySummary(summary, state, 1);
        }
        batchCount += 1;
        if (SCOPE_SWITCH_DEBUG) {
            const batchDurationMs = scopeSwitchDebugNow() - batchStartedAt;
            longestBatchDurationMs = Math.max(longestBatchDurationMs, batchDurationMs);
        }
        const isLastBatch = batchEnd >= textNodes.length;
        if (onBatchProgress) {
            onBatchProgress(batchEnd, textNodes.length, isLastBatch);
        }
        if (!isLastBatch) {
            yieldCount += 1;
            await yieldToEventLoop();
        }
    }
    if (!isStillValid()) {
        reportBatchDebugInfo();
        return null;
    }
    reportBatchDebugInfo();
    return { summary, states };
}
async function summarizeTextNodeAvailability(textNodes) {
    const analysis = await analyzeTextNodeAvailability(textNodes);
    return analysis.summary;
}
let selectionResultCache = null;
function selectionRootIdsMatch(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    for (let index = 0; index < a.length; index += 1) {
        if (a[index] !== b[index]) {
            return false;
        }
    }
    return true;
}
function readSelectionResultCache(page, selection) {
    const cached = selectionResultCache;
    if (!cached || cached.pageId !== page.id) {
        return null;
    }
    const entry = pageAvailabilityCache.get(page.id);
    // A cached selection remains valid while a full-page prewarm is merely
    // pending. The page revision and summary object reference below are the
    // actual invalidation signals: relevant document changes bump revision,
    // and every committed page-cache update replaces the summary object.
    // Rejecting all dirty/pending entries made selection -> currentPage -> the
    // same selection needlessly re-scan the selection while the silent page
    // prewarm was still running.
    if (!entry) {
        return null;
    }
    if (cached.pageRevisionAtCache !== entry.revision ||
        cached.pageSummaryRefAtCache !== entry.summary) {
        return null;
    }
    const currentSelectionRootIds = selection.map((node) => node.id);
    if (!selectionRootIdsMatch(cached.selectionRootIds, currentSelectionRootIds)) {
        return null;
    }
    return cached;
}
function writeSelectionResultCache(entry) {
    selectionResultCache = entry;
}
async function getSelectionAvailabilitySummary(page, textNodes) {
    const entry = pageAvailabilityCache.get(page.id);
    if (!entry || !entry.summary || entry.dirty || entry.pending) {
        const summary = await summarizeTextNodeAvailability(textNodes);
        return {
            summary,
            source: "direct",
            cachedNodeCount: 0,
            missingNodeCount: textNodes.length,
        };
    }
    const summary = createEmptyTextNodeAvailabilitySummary();
    const missingNodes = [];
    let cachedNodeCount = 0;
    for (const node of textNodes) {
        if (node.removed) {
            continue;
        }
        const cachedState = entry.nodeStates.get(node.id);
        if (cachedState) {
            adjustTextNodeAvailabilitySummary(summary, cachedState, 1);
            cachedNodeCount += 1;
        }
        else {
            missingNodes.push(node);
        }
    }
    if (missingNodes.length === 0) {
        return {
            summary,
            source: "page-cache",
            cachedNodeCount,
            missingNodeCount: 0,
        };
    }
    const revisionAtStart = entry.revision;
    const analysis = await analyzeTextNodeAvailability(missingNodes);
    for (const node of missingNodes) {
        const state = analysis.states.get(node.id);
        if (!state) {
            continue;
        }
        adjustTextNodeAvailabilitySummary(summary, state, 1);
    }
    const canMergeIntoPageCache = entry.summary !== null &&
        !entry.dirty &&
        !entry.pending &&
        entry.revision === revisionAtStart;
    if (canMergeIntoPageCache && entry.summary) {
        const nextSummary = { ...entry.summary };
        const nextTextNodes = new Map(entry.textNodes);
        const nextNodeStates = new Map(entry.nodeStates);
        for (const node of missingNodes) {
            const state = analysis.states.get(node.id);
            if (!state) {
                continue;
            }
            adjustTextNodeAvailabilitySummary(nextSummary, state, 1);
            nextNodeStates.set(node.id, state);
            nextTextNodes.set(node.id, node);
        }
        entry.summary = nextSummary;
        entry.textNodes = nextTextNodes;
        entry.nodeStates = nextNodeStates;
    }
    return {
        summary,
        source: "page-cache",
        cachedNodeCount,
        missingNodeCount: missingNodes.length,
    };
}
function getOrCreatePageAvailabilityCacheEntry(pageId) {
    const existingEntry = pageAvailabilityCache.get(pageId);
    if (existingEntry) {
        return existingEntry;
    }
    const entry = {
        summary: null,
        textNodes: new Map(),
        nodeStates: new Map(),
        dirty: true,
        revision: 0,
        pending: null,
        pendingProgress: null,
        updateQueue: Promise.resolve(),
        lastAccessedAt: Date.now(),
    };
    pageAvailabilityCache.set(pageId, entry);
    return entry;
}
function markPageAvailabilityCacheDirty(pageId, scopeSwitchDebugReason, scopeSwitchDebugExtra) {
    const entry = pageAvailabilityCache.get(pageId);
    if (!entry) {
        return;
    }
    if (SCOPE_SWITCH_DEBUG) {
        scopeSwitchCacheDirtyLog({
            pageId,
            reason: scopeSwitchDebugReason !== null && scopeSwitchDebugReason !== void 0 ? scopeSwitchDebugReason : "unspecified",
            cacheHadSummary: Boolean(entry.summary),
            previousDirty: entry.dirty,
            newDirty: true,
            revisionBefore: entry.revision,
            revisionAfter: entry.revision + 1,
            nodeChangeCount: scopeSwitchDebugExtra === null || scopeSwitchDebugExtra === void 0 ? void 0 : scopeSwitchDebugExtra.nodeChangeCount,
            changedProperties: scopeSwitchDebugExtra === null || scopeSwitchDebugExtra === void 0 ? void 0 : scopeSwitchDebugExtra.changedProperties,
        });
    }
    entry.dirty = true;
    entry.revision += 1;
}
function forgetPageAvailabilityCache(pageId, scopeSwitchDebugReason) {
    if (SCOPE_SWITCH_DEBUG) {
        const entry = pageAvailabilityCache.get(pageId);
        if (entry) {
            scopeSwitchCacheDirtyLog({
                pageId,
                reason: scopeSwitchDebugReason !== null && scopeSwitchDebugReason !== void 0 ? scopeSwitchDebugReason : "cache-entry-removed",
                cacheHadSummary: Boolean(entry.summary),
                previousDirty: entry.dirty,
                newDirty: true,
                revisionBefore: entry.revision,
                revisionAfter: entry.revision,
            });
        }
    }
    const subscription = pageNodeChangeSubscriptions.get(pageId);
    if (subscription) {
        subscription.page.off("nodechange", subscription.callback);
        pageNodeChangeSubscriptions.delete(pageId);
    }
    pageAvailabilityCache.delete(pageId);
}
function evictLeastRecentlyUsedPageAvailabilityCaches(currentPageId) {
    if (pageAvailabilityCache.size <= MAX_CACHED_PAGES) {
        return;
    }
    const evictionCandidates = Array.from(pageAvailabilityCache.entries())
        .filter(([pageId]) => pageId !== currentPageId)
        .sort(([, a], [, b]) => a.lastAccessedAt - b.lastAccessedAt);
    let excessCount = pageAvailabilityCache.size - MAX_CACHED_PAGES;
    for (const [pageId] of evictionCandidates) {
        if (excessCount <= 0) {
            break;
        }
        forgetPageAvailabilityCache(pageId, "lru-eviction");
        excessCount -= 1;
    }
}
function pruneRemovedPageAvailabilityCaches() {
    if (pageAvailabilityCache.size === 0 &&
        pageNodeChangeSubscriptions.size === 0) {
        return;
    }
    const existingPageIds = new Set(figma.root.children.map((page) => page.id));
    const trackedPageIds = new Set([
        ...pageAvailabilityCache.keys(),
        ...pageNodeChangeSubscriptions.keys(),
    ]);
    for (const pageId of trackedPageIds) {
        if (!existingPageIds.has(pageId)) {
            forgetPageAvailabilityCache(pageId, "page-removed-from-document");
        }
    }
}
function isRemovedNode(node) {
    return "removed" in node && node.removed === true;
}
function collectTextNodesFromCreatedNode(node) {
    if (node.type === "TEXT") {
        return [node];
    }
    if ("findAllWithCriteria" in node) {
        return node.findAllWithCriteria({
            types: ["TEXT"],
        });
    }
    return collectTextNodesFromSceneNodeRoots([node]);
}
async function collectTextNodesFromPage(page, scopeSwitchDebugInfo) {
    const pageLoadStartedAt = SCOPE_SWITCH_DEBUG && scopeSwitchDebugInfo ? scopeSwitchDebugNow() : 0;
    await page.loadAsync();
    if (SCOPE_SWITCH_DEBUG && scopeSwitchDebugInfo) {
        scopeSwitchDebugInfo.pageLoadDurationMs =
            scopeSwitchDebugNow() - pageLoadStartedAt;
    }
    return page.findAllWithCriteria({
        types: ["TEXT"],
    });
}
function shouldReanalyzeTextNodeAfterPropertyChange(entry, node, properties) {
    if (properties.some((property) => PAGE_AVAILABILITY_RELEVANT_PROPERTIES.has(property))) {
        return true;
    }
    if (!properties.includes("characters")) {
        return false;
    }
    const previousState = entry.nodeStates.get(node.id);
    if (!previousState) {
        return true;
    }
    const wasEmpty = previousState === "empty";
    const isEmpty = node.characters.trim().length === 0;
    return wasEmpty !== isEmpty;
}
async function applyIncrementalPageAvailabilityChanges(page, event) {
    const entry = pageAvailabilityCache.get(page.id);
    if (!entry) {
        return false;
    }
    const scopeSwitchDirtyDebugExtra = SCOPE_SWITCH_DEBUG
        ? {
            nodeChangeCount: event.nodeChanges.length,
            changedProperties: summarizeScopeSwitchChangedProperties(event),
        }
        : undefined;
    if (entry.pending) {
        try {
            await entry.pending;
        }
        catch {
            // The in-flight full recompute failed; the dirty/missing-summary
            // check below decides how to proceed.
        }
    }
    if (!entry.summary || entry.dirty) {
        markPageAvailabilityCacheDirty(page.id, "no-summary-or-already-dirty", scopeSwitchDirtyDebugExtra);
        return false;
    }
    entry.lastAccessedAt = Date.now();
    const revisionAtStart = entry.revision;
    const createdTextNodes = new Map();
    const textNodesToReanalyze = new Map();
    const deletedTextNodeIds = new Set();
    let requiresFullRebuild = false;
    for (const change of event.nodeChanges) {
        if (change.type === "DELETE") {
            if (change.node.type !== "TEXT") {
                let cachedRemovedTextNodeCount = 0;
                for (const [textNodeId, textNode] of entry.textNodes) {
                    if (textNode.removed) {
                        deletedTextNodeIds.add(textNodeId);
                        cachedRemovedTextNodeCount += 1;
                    }
                }
                if (cachedRemovedTextNodeCount === 0) {
                    requiresFullRebuild = true;
                    break;
                }
                continue;
            }
            if (!entry.nodeStates.has(change.node.id)) {
                requiresFullRebuild = true;
                break;
            }
            deletedTextNodeIds.add(change.node.id);
            continue;
        }
        if (isRemovedNode(change.node)) {
            requiresFullRebuild = true;
            break;
        }
        if (change.type === "CREATE") {
            try {
                for (const textNode of collectTextNodesFromCreatedNode(change.node)) {
                    if (!entry.textNodes.has(textNode.id)) {
                        createdTextNodes.set(textNode.id, textNode);
                    }
                }
            }
            catch (error) {
                console.warn("Could not inspect newly created node subtree:", error);
                requiresFullRebuild = true;
                break;
            }
            continue;
        }
        if (change.node.type === "TEXT") {
            const textNode = change.node;
            if (!entry.textNodes.has(textNode.id)) {
                requiresFullRebuild = true;
                break;
            }
            if (shouldReanalyzeTextNodeAfterPropertyChange(entry, textNode, change.properties)) {
                textNodesToReanalyze.set(textNode.id, textNode);
            }
            continue;
        }
        if (change.properties.some((property) => PAGE_AVAILABILITY_RELEVANT_PROPERTIES.has(property))) {
            requiresFullRebuild = true;
            break;
        }
    }
    if (requiresFullRebuild) {
        markPageAvailabilityCacheDirty(page.id, "full-rebuild-required", scopeSwitchDirtyDebugExtra);
        return false;
    }
    for (const deletedId of deletedTextNodeIds) {
        createdTextNodes.delete(deletedId);
        textNodesToReanalyze.delete(deletedId);
    }
    const nodesToAnalyze = Array.from(new Map([...createdTextNodes.values(), ...textNodesToReanalyze.values()].map((node) => [node.id, node])).values());
    const analysis = await analyzeTextNodeAvailability(nodesToAnalyze);
    if (entry.revision !== revisionAtStart || entry.dirty || !entry.summary) {
        return false;
    }
    const nextSummary = { ...entry.summary };
    const nextTextNodes = new Map(entry.textNodes);
    const nextNodeStates = new Map(entry.nodeStates);
    for (const deletedId of deletedTextNodeIds) {
        const previousState = nextNodeStates.get(deletedId);
        if (!previousState) {
            markPageAvailabilityCacheDirty(page.id, "deleted-node-missing-cached-state", scopeSwitchDirtyDebugExtra);
            return false;
        }
        adjustTextNodeAvailabilitySummary(nextSummary, previousState, -1);
        nextNodeStates.delete(deletedId);
        nextTextNodes.delete(deletedId);
    }
    for (const node of nodesToAnalyze) {
        const nextState = analysis.states.get(node.id);
        if (!nextState) {
            markPageAvailabilityCacheDirty(page.id, "analyzed-node-missing-result", scopeSwitchDirtyDebugExtra);
            return false;
        }
        const previousState = nextNodeStates.get(node.id);
        if (previousState) {
            if (previousState !== nextState) {
                adjustTextNodeAvailabilitySummary(nextSummary, previousState, -1);
                adjustTextNodeAvailabilitySummary(nextSummary, nextState, 1);
            }
        }
        else {
            adjustTextNodeAvailabilitySummary(nextSummary, nextState, 1);
        }
        nextNodeStates.set(node.id, nextState);
        nextTextNodes.set(node.id, node);
    }
    entry.summary = nextSummary;
    entry.nodeStates = nextNodeStates;
    entry.textNodes = nextTextNodes;
    return deletedTextNodeIds.size > 0 || nodesToAnalyze.length > 0;
}
function queueIncrementalPageAvailabilityChanges(page, event) {
    const entry = pageAvailabilityCache.get(page.id);
    if (!entry) {
        return;
    }
    const update = entry.updateQueue
        .then(() => applyIncrementalPageAvailabilityChanges(page, event))
        .catch((error) => {
        console.warn("Could not update the page text-layer cache:", error);
        markPageAvailabilityCacheDirty(page.id, "incremental-update-threw", SCOPE_SWITCH_DEBUG
            ? { nodeChangeCount: event.nodeChanges.length }
            : undefined);
        return false;
    });
    entry.updateQueue = update.then(() => undefined);
    void update.then((didUpdate) => {
        if (didUpdate &&
            figma.currentPage.id === page.id &&
            page.selection.length === 0) {
            void sendSelectionInfo();
        }
    });
}
function ensurePageAvailabilityCacheSubscription(page) {
    if (pageNodeChangeSubscriptions.has(page.id)) {
        return;
    }
    const callback = (event) => {
        queueIncrementalPageAvailabilityChanges(page, event);
    };
    page.on("nodechange", callback);
    pageNodeChangeSubscriptions.set(page.id, { page, callback });
}
async function getPageAvailabilitySummary(page, scopeSwitchDebugInfo) {
    ensurePageAvailabilityCacheSubscription(page);
    const entry = getOrCreatePageAvailabilityCacheEntry(page.id);
    entry.lastAccessedAt = Date.now();
    evictLeastRecentlyUsedPageAvailabilityCaches(page.id);
    const updateQueueWaitStartedAt = SCOPE_SWITCH_DEBUG && scopeSwitchDebugInfo ? scopeSwitchDebugNow() : 0;
    await entry.updateQueue;
    if (SCOPE_SWITCH_DEBUG && scopeSwitchDebugInfo) {
        scopeSwitchDebugInfo.updateQueueWaitDurationMs =
            scopeSwitchDebugNow() - updateQueueWaitStartedAt;
    }
    if (entry.summary && !entry.dirty) {
        return entry.summary;
    }
    if (entry.pending) {
        if (SCOPE_SWITCH_DEBUG && scopeSwitchDebugInfo) {
            scopeSwitchDebugInfo.requestWasWaitingForPending = true;
        }
        return entry.pending;
    }
    const revisionAtStart = entry.revision;
    const pending = (async () => {
        var _a;
        const collectStartedAt = SCOPE_SWITCH_DEBUG && scopeSwitchDebugInfo ? scopeSwitchDebugNow() : 0;
        const textNodes = await collectTextNodesFromPage(page, scopeSwitchDebugInfo);
        if (SCOPE_SWITCH_DEBUG && scopeSwitchDebugInfo) {
            scopeSwitchDebugInfo.collectTextNodesDurationMs =
                scopeSwitchDebugNow() - collectStartedAt;
            scopeSwitchDebugInfo.textNodeCount = textNodes.length;
        }
        entry.pendingProgress = {
            processedTextNodeCount: 0,
            totalTextNodeCount: textNodes.length,
        };
        notifyPageAnalysisProgress(page.id, entry.pendingProgress);
        let lastProgressNotifyAt = Date.now();
        const analyzeStartedAt = SCOPE_SWITCH_DEBUG && scopeSwitchDebugInfo ? scopeSwitchDebugNow() : 0;
        const analysis = await analyzeTextNodeAvailabilityInBatches(textNodes, () => pageAvailabilityCache.get(page.id) === entry &&
            entry.revision === revisionAtStart, scopeSwitchDebugInfo, (processedCount, totalCount, isLastBatch) => {
            const progress = {
                processedTextNodeCount: processedCount,
                totalTextNodeCount: totalCount,
            };
            entry.pendingProgress = progress;
            const now = Date.now();
            if (isLastBatch ||
                now - lastProgressNotifyAt >= PAGE_ANALYSIS_PROGRESS_THROTTLE_MS) {
                lastProgressNotifyAt = now;
                notifyPageAnalysisProgress(page.id, progress);
            }
        });
        if (SCOPE_SWITCH_DEBUG && scopeSwitchDebugInfo) {
            scopeSwitchDebugInfo.analyzeTextNodesDurationMs =
                scopeSwitchDebugNow() - analyzeStartedAt;
        }
        if (analysis &&
            pageAvailabilityCache.get(page.id) === entry &&
            entry.revision === revisionAtStart) {
            entry.summary = analysis.summary;
            entry.textNodes = new Map(textNodes.map((node) => [node.id, node]));
            entry.nodeStates = analysis.states;
            entry.dirty = false;
            if (SCOPE_SWITCH_DEBUG && scopeSwitchDebugInfo) {
                scopeSwitchDebugInfo.resultCommitted = true;
            }
            return analysis.summary;
        }
        if (SCOPE_SWITCH_DEBUG && scopeSwitchDebugInfo) {
            scopeSwitchDebugInfo.resultDiscarded = true;
        }
        return (_a = entry.summary) !== null && _a !== void 0 ? _a : createEmptyTextNodeAvailabilitySummary();
    })();
    entry.pending = pending;
    let summary;
    try {
        summary = await pending;
    }
    finally {
        if (entry.pending === pending) {
            entry.pending = null;
            entry.pendingProgress = null;
        }
    }
    if (entry.revision !== revisionAtStart) {
        return getPageAvailabilitySummary(page, scopeSwitchDebugInfo);
    }
    return summary;
}
async function warmPageAvailabilityCache(page, backgroundPrewarm = false) {
    const scopeSwitchDebugInfo = SCOPE_SWITCH_DEBUG
        ? createScopeSwitchPageDebugInfo()
        : undefined;
    if (scopeSwitchDebugInfo) {
        scopeSwitchDebugInfo.backgroundPrewarm = backgroundPrewarm;
    }
    const startedAt = SCOPE_SWITCH_DEBUG ? scopeSwitchDebugNow() : 0;
    try {
        await getPageAvailabilitySummary(page, scopeSwitchDebugInfo);
        if (SCOPE_SWITCH_DEBUG && scopeSwitchDebugInfo && backgroundPrewarm) {
            console.log("[scope-switch-main] request completed", {
                sequence: 0,
                pageId: page.id,
                requestedScope: "currentPage",
                resultSource: "page-background-prewarm",
                backgroundPrewarm: scopeSwitchDebugInfo.backgroundPrewarm,
                batchSize: scopeSwitchDebugInfo.batchSize,
                batchCount: scopeSwitchDebugInfo.batchCount,
                yieldCount: scopeSwitchDebugInfo.yieldCount,
                textNodeCount: scopeSwitchDebugInfo.textNodeCount,
                totalAnalysisDurationMs: scopeSwitchDebugInfo.analyzeTextNodesDurationMs,
                longestBatchDurationMs: scopeSwitchDebugInfo.longestBatchDurationMs,
                requestWasWaitingForPending: scopeSwitchDebugInfo.requestWasWaitingForPending,
                resultCommitted: scopeSwitchDebugInfo.resultCommitted,
                resultDiscarded: scopeSwitchDebugInfo.resultDiscarded,
                totalMainDurationMs: scopeSwitchDebugNow() - startedAt,
            });
        }
    }
    catch (error) {
        console.warn("Could not warm the page text-layer cache:", error);
        markPageAvailabilityCacheDirty(page.id, "warm-cache-failed");
    }
}
let initialRenderAckReceivedAt = null;
function scopeSwitchPrewarmLog(event, pageId, trigger, details = {}) {
    var _a, _b, _c, _d;
    if (!SCOPE_SWITCH_DEBUG) {
        return;
    }
    console.log(`[page-prewarm] ${event}`, {
        pageId,
        trigger,
        elapsedSinceInitialRenderMs: initialRenderAckReceivedAt !== null
            ? Date.now() - initialRenderAckReceivedAt
            : null,
        cacheHadSummary: (_a = details.cacheHadSummary) !== null && _a !== void 0 ? _a : null,
        cacheHadPending: (_b = details.cacheHadPending) !== null && _b !== void 0 ? _b : null,
        revisionMatched: (_c = details.revisionMatched) !== null && _c !== void 0 ? _c : null,
        reason: (_d = details.reason) !== null && _d !== void 0 ? _d : null,
    });
}
function attemptPageAvailabilityPrewarm(page, trigger, revisionAtSchedule) {
    const entry = pageAvailabilityCache.get(page.id);
    const cacheHadSummary = Boolean(entry && entry.summary && !entry.dirty);
    const cacheHadPending = Boolean(entry && entry.pending);
    const currentRevision = entry ? entry.revision : -1;
    const revisionMatched = currentRevision === revisionAtSchedule;
    if (figma.currentPage.id !== page.id) {
        scopeSwitchPrewarmLog("skipped", page.id, trigger, {
            cacheHadSummary,
            cacheHadPending,
            revisionMatched,
            reason: "current-page-changed",
        });
        return;
    }
    if (cacheHadSummary) {
        scopeSwitchPrewarmLog("skipped", page.id, trigger, {
            cacheHadSummary,
            cacheHadPending,
            revisionMatched,
            reason: "cache-already-has-summary",
        });
        return;
    }
    if (cacheHadPending) {
        scopeSwitchPrewarmLog("skipped", page.id, trigger, {
            cacheHadSummary,
            cacheHadPending,
            revisionMatched,
            reason: "pending-already-exists",
        });
        return;
    }
    scopeSwitchPrewarmLog("started", page.id, trigger, {
        cacheHadSummary,
        cacheHadPending,
        revisionMatched,
    });
    void warmPageAvailabilityCache(page, true);
}
function scheduleBackgroundPageAvailabilityPrewarm(page, trigger = "currentpagechange") {
    const entryAtSchedule = pageAvailabilityCache.get(page.id);
    const revisionAtSchedule = entryAtSchedule ? entryAtSchedule.revision : -1;
    scopeSwitchPrewarmLog("scheduled", page.id, trigger, {
        cacheHadSummary: Boolean(entryAtSchedule && entryAtSchedule.summary && !entryAtSchedule.dirty),
        cacheHadPending: Boolean(entryAtSchedule && entryAtSchedule.pending),
        revisionMatched: true,
    });
    setTimeout(() => {
        attemptPageAvailabilityPrewarm(page, trigger, revisionAtSchedule);
    }, 0);
}
let pendingInitialSelectionPrewarm = null;
function armInitialSelectionPrewarm(page) {
    pendingInitialSelectionPrewarm = { page };
}
function handleSelectionInfoRenderedMessage(message) {
    const armed = pendingInitialSelectionPrewarm;
    if (!armed) {
        return;
    }
    if (message.initialRender !== true) {
        return;
    }
    if (message.pageId !== armed.page.id) {
        return;
    }
    pendingInitialSelectionPrewarm = null;
    initialRenderAckReceivedAt = Date.now();
    scheduleBackgroundPageAvailabilityPrewarm(armed.page, "initial-render-ack");
}
function sendScopeAnalysisState(details) {
    figma.ui.postMessage({
        type: "scope-analysis-state",
        state: details.state,
        scope: details.scope,
        requestId: details.requestId,
        pageId: details.pageId,
        ...(details.progress
            ? {
                processedTextNodeCount: details.progress.processedTextNodeCount,
                totalTextNodeCount: details.progress.totalTextNodeCount,
            }
            : {}),
        ...(SCOPE_SWITCH_DEBUG
            ? {
                debugScopeSwitchSequence: details.debugScopeSwitchSequence,
                debugScopeSwitchStartedAt: details.debugScopeSwitchStartedAt,
            }
            : {}),
    });
}
let selectionInfoRequestId = 0;
async function sendSelectionInfo() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z;
    const requestId = ++selectionInfoRequestId;
    const page = figma.currentPage;
    const selection = page.selection;
    const debugScopeSwitchSequence = SCOPE_SWITCH_DEBUG ? requestId : 0;
    const debugScopeSwitchStartedAt = SCOPE_SWITCH_DEBUG ? Date.now() : 0;
    const scopeSwitchMainStartedAt = SCOPE_SWITCH_DEBUG ? scopeSwitchDebugNow() : 0;
    function logScopeSwitchMainRequestCompleted(fields) {
        if (!SCOPE_SWITCH_DEBUG) {
            return;
        }
        console.log("[scope-switch-main] request completed", {
            sequence: debugScopeSwitchSequence,
            pageId: page.id,
            totalMainDurationMs: scopeSwitchDebugNow() - scopeSwitchMainStartedAt,
            elapsedSinceUiRequestMs: Date.now() - debugScopeSwitchStartedAt,
            ...fields,
        });
    }
    if (selection.length === 0) {
        const cacheEntryAtStart = pageAvailabilityCache.get(page.id);
        const cacheExistedAtStart = Boolean(cacheEntryAtStart);
        const cacheHadSummaryAtStart = Boolean(cacheEntryAtStart && cacheEntryAtStart.summary);
        const cacheDirtyAtStart = cacheEntryAtStart ? cacheEntryAtStart.dirty : true;
        const cacheHadPendingAtStart = Boolean(cacheEntryAtStart && cacheEntryAtStart.pending);
        const hasReadySummaryAtStart = cacheHadSummaryAtStart && !cacheDirtyAtStart && !cacheHadPendingAtStart;
        const pageDebugInfo = SCOPE_SWITCH_DEBUG
            ? createScopeSwitchPageDebugInfo()
            : undefined;
        // True only if this request is both the latest one issued AND still
        // matches live reality: the user has not since selected something (which
        // means they want the selection scope, not currentPage) -- even if no
        // selectionchange event fired to say so. Figma does not always emit one
        // for a selection that already existed before this request's listeners
        // were attached, so requestId alone cannot catch that case. Self-corrects
        // at most once by kicking off a fresh request the first time the mismatch
        // is observed, so a currentPage analysis nobody wants never leaves the UI
        // stuck in loading; the cache write from the analysis itself still lands
        // either way.
        let staleSelectionDetected = false;
        function isCurrentPageRequestStillActive() {
            if (requestId !== selectionInfoRequestId) {
                return false;
            }
            if (page.selection.length > 0) {
                if (!staleSelectionDetected) {
                    staleSelectionDetected = true;
                    void sendSelectionInfo();
                }
                return false;
            }
            return true;
        }
        if (!hasReadySummaryAtStart) {
            sendScopeAnalysisState({
                state: "loading",
                scope: "currentPage",
                requestId,
                pageId: page.id,
                debugScopeSwitchSequence,
                debugScopeSwitchStartedAt,
                progress: cacheEntryAtStart ? cacheEntryAtStart.pendingProgress : null,
            });
        }
        const removeProgressListener = hasReadySummaryAtStart
            ? null
            : addPageAnalysisProgressListener(page.id, (progress) => {
                if (!isCurrentPageRequestStillActive()) {
                    return;
                }
                sendScopeAnalysisState({
                    state: "loading",
                    scope: "currentPage",
                    requestId,
                    pageId: page.id,
                    debugScopeSwitchSequence,
                    debugScopeSwitchStartedAt,
                    progress,
                });
            });
        let availabilitySummary;
        try {
            availabilitySummary = await getPageAvailabilitySummary(page, pageDebugInfo);
        }
        catch (error) {
            console.warn("Could not analyze the current page:", error);
            if (isCurrentPageRequestStillActive()) {
                sendScopeAnalysisState({
                    state: "error",
                    scope: "currentPage",
                    requestId,
                    pageId: page.id,
                    debugScopeSwitchSequence,
                    debugScopeSwitchStartedAt,
                });
            }
            logScopeSwitchMainRequestCompleted({
                requestedScope: "currentPage",
                resultSource: "page-analysis-error",
                cacheExistedAtStart,
                cacheHadSummaryAtStart,
                cacheDirtyAtStart,
                cacheHadPendingAtStart,
                cacheHadUpdateQueueAtStart: cacheExistedAtStart,
                updateQueueWaitDurationMs: (_a = pageDebugInfo === null || pageDebugInfo === void 0 ? void 0 : pageDebugInfo.updateQueueWaitDurationMs) !== null && _a !== void 0 ? _a : 0,
                pendingWaitDurationMs: 0,
                pageLoadDurationMs: (_b = pageDebugInfo === null || pageDebugInfo === void 0 ? void 0 : pageDebugInfo.pageLoadDurationMs) !== null && _b !== void 0 ? _b : 0,
                collectTextNodesDurationMs: (_c = pageDebugInfo === null || pageDebugInfo === void 0 ? void 0 : pageDebugInfo.collectTextNodesDurationMs) !== null && _c !== void 0 ? _c : 0,
                analyzeTextNodesDurationMs: (_d = pageDebugInfo === null || pageDebugInfo === void 0 ? void 0 : pageDebugInfo.analyzeTextNodesDurationMs) !== null && _d !== void 0 ? _d : 0,
                selectionCollectDurationMs: 0,
                selectionAnalyzeDurationMs: 0,
                postMessageCallDurationMs: 0,
                textNodeCount: 0,
                selectionRootCount: 0,
                missingNodeCount: 0,
                requestDropped: requestId !== selectionInfoRequestId,
                cacheDirtyAtEnd: (_f = (_e = pageAvailabilityCache.get(page.id)) === null || _e === void 0 ? void 0 : _e.dirty) !== null && _f !== void 0 ? _f : true,
            });
            return;
        }
        finally {
            removeProgressListener === null || removeProgressListener === void 0 ? void 0 : removeProgressListener();
        }
        if (!isCurrentPageRequestStillActive()) {
            logScopeSwitchMainRequestCompleted({
                requestedScope: "currentPage",
                resultSource: "dropped",
                cacheExistedAtStart,
                cacheHadSummaryAtStart,
                cacheDirtyAtStart,
                cacheHadPendingAtStart,
                cacheHadUpdateQueueAtStart: cacheExistedAtStart,
                updateQueueWaitDurationMs: (_g = pageDebugInfo === null || pageDebugInfo === void 0 ? void 0 : pageDebugInfo.updateQueueWaitDurationMs) !== null && _g !== void 0 ? _g : 0,
                pendingWaitDurationMs: 0,
                pageLoadDurationMs: (_h = pageDebugInfo === null || pageDebugInfo === void 0 ? void 0 : pageDebugInfo.pageLoadDurationMs) !== null && _h !== void 0 ? _h : 0,
                collectTextNodesDurationMs: (_j = pageDebugInfo === null || pageDebugInfo === void 0 ? void 0 : pageDebugInfo.collectTextNodesDurationMs) !== null && _j !== void 0 ? _j : 0,
                analyzeTextNodesDurationMs: (_k = pageDebugInfo === null || pageDebugInfo === void 0 ? void 0 : pageDebugInfo.analyzeTextNodesDurationMs) !== null && _k !== void 0 ? _k : 0,
                selectionCollectDurationMs: 0,
                selectionAnalyzeDurationMs: 0,
                postMessageCallDurationMs: 0,
                textNodeCount: 0,
                selectionRootCount: 0,
                missingNodeCount: 0,
                requestDropped: true,
                cacheDirtyAtEnd: (_m = (_l = pageAvailabilityCache.get(page.id)) === null || _l === void 0 ? void 0 : _l.dirty) !== null && _m !== void 0 ? _m : true,
            });
            return;
        }
        const resultSource = cacheHadPendingAtStart
            ? "page-pending-result"
            : cacheHadSummaryAtStart && !cacheDirtyAtStart
                ? "page-cache-hit"
                : "page-full-recompute";
        const postMessageStartedAt = SCOPE_SWITCH_DEBUG ? scopeSwitchDebugNow() : 0;
        figma.ui.postMessage({
            type: "selection-info",
            requestId,
            targetScope: "currentPage",
            scopeType: "currentPage",
            selectionKey: `page:${page.id}`,
            selectedCount: 0,
            textNodeCount: availabilitySummary.totalTextNodeCount,
            availableTextNodeCount: availabilitySummary.availableTextNodeCount,
            skippedHiddenNodeCount: availabilitySummary.skippedHiddenNodeCount,
            skippedLockedNodeCount: availabilitySummary.skippedLockedNodeCount,
            skippedEmptyNodeCount: availabilitySummary.skippedEmptyNodeCount,
            skippedMissingFontsNodeCount: availabilitySummary.skippedMissingFontsNodeCount,
            pageId: page.id,
            ...(SCOPE_SWITCH_DEBUG
                ? { debugScopeSwitchSequence, debugScopeSwitchStartedAt }
                : {}),
        });
        const postMessageCallDurationMs = SCOPE_SWITCH_DEBUG
            ? scopeSwitchDebugNow() - postMessageStartedAt
            : 0;
        logScopeSwitchMainRequestCompleted({
            requestedScope: "currentPage",
            resultSource,
            cacheExistedAtStart,
            cacheHadSummaryAtStart,
            cacheDirtyAtStart,
            cacheHadPendingAtStart,
            cacheHadUpdateQueueAtStart: cacheExistedAtStart,
            updateQueueWaitDurationMs: (_o = pageDebugInfo === null || pageDebugInfo === void 0 ? void 0 : pageDebugInfo.updateQueueWaitDurationMs) !== null && _o !== void 0 ? _o : 0,
            pendingWaitDurationMs: resultSource === "page-pending-result"
                ? scopeSwitchDebugNow() - scopeSwitchMainStartedAt
                : 0,
            pageLoadDurationMs: (_p = pageDebugInfo === null || pageDebugInfo === void 0 ? void 0 : pageDebugInfo.pageLoadDurationMs) !== null && _p !== void 0 ? _p : 0,
            collectTextNodesDurationMs: (_q = pageDebugInfo === null || pageDebugInfo === void 0 ? void 0 : pageDebugInfo.collectTextNodesDurationMs) !== null && _q !== void 0 ? _q : 0,
            analyzeTextNodesDurationMs: (_r = pageDebugInfo === null || pageDebugInfo === void 0 ? void 0 : pageDebugInfo.analyzeTextNodesDurationMs) !== null && _r !== void 0 ? _r : 0,
            selectionCollectDurationMs: 0,
            selectionAnalyzeDurationMs: 0,
            postMessageCallDurationMs,
            textNodeCount: availabilitySummary.totalTextNodeCount,
            selectionRootCount: 0,
            missingNodeCount: 0,
            requestDropped: false,
            cacheDirtyAtEnd: (_t = (_s = pageAvailabilityCache.get(page.id)) === null || _s === void 0 ? void 0 : _s.dirty) !== null && _t !== void 0 ? _t : true,
        });
        return;
    }
    // Create the page entry before reading/analyzing the selection so the
    // selection result can be cached even when the whole-page summary has not
    // been built yet. This is what keeps returning to the same selection
    // instant while the page is warming in the background.
    const selectionCacheEntryAtStart = getOrCreatePageAvailabilityCacheEntry(page.id);
    const selectionResultCacheHit = readSelectionResultCache(page, selection);
    if (selectionResultCacheHit) {
        const postMessageStartedAt = SCOPE_SWITCH_DEBUG ? scopeSwitchDebugNow() : 0;
        figma.ui.postMessage({
            type: "selection-info",
            requestId,
            targetScope: selectionResultCacheHit.targetScope,
            scopeType: selectionResultCacheHit.scopeType,
            selectionKey: selectionResultCacheHit.selectionKey,
            selectedCount: selectionResultCacheHit.selectedCount,
            textNodeCount: selectionResultCacheHit.summary.totalTextNodeCount,
            availableTextNodeCount: selectionResultCacheHit.summary.availableTextNodeCount,
            skippedHiddenNodeCount: selectionResultCacheHit.summary.skippedHiddenNodeCount,
            skippedLockedNodeCount: selectionResultCacheHit.summary.skippedLockedNodeCount,
            skippedEmptyNodeCount: selectionResultCacheHit.summary.skippedEmptyNodeCount,
            skippedMissingFontsNodeCount: selectionResultCacheHit.summary.skippedMissingFontsNodeCount,
            pageId: page.id,
            ...(SCOPE_SWITCH_DEBUG
                ? { debugScopeSwitchSequence, debugScopeSwitchStartedAt }
                : {}),
        });
        const postMessageCallDurationMs = SCOPE_SWITCH_DEBUG
            ? scopeSwitchDebugNow() - postMessageStartedAt
            : 0;
        logScopeSwitchMainRequestCompleted({
            requestedScope: selectionResultCacheHit.targetScope,
            resultSource: "selection-result-cache",
            cacheExistedAtStart: true,
            cacheHadSummaryAtStart: true,
            cacheDirtyAtStart: false,
            cacheHadPendingAtStart: false,
            cacheHadUpdateQueueAtStart: true,
            updateQueueWaitDurationMs: 0,
            pendingWaitDurationMs: 0,
            pageLoadDurationMs: 0,
            collectTextNodesDurationMs: 0,
            analyzeTextNodesDurationMs: 0,
            selectionCollectDurationMs: 0,
            selectionAnalyzeDurationMs: 0,
            postMessageCallDurationMs,
            textNodeCount: selectionResultCacheHit.summary.totalTextNodeCount,
            selectionRootCount: selectionResultCacheHit.selectedCount,
            missingNodeCount: 0,
            requestDropped: false,
            cacheDirtyAtEnd: (_v = (_u = pageAvailabilityCache.get(page.id)) === null || _u === void 0 ? void 0 : _u.dirty) !== null && _v !== void 0 ? _v : true,
        });
        return;
    }
    const selectionCollectStartedAt = SCOPE_SWITCH_DEBUG
        ? scopeSwitchDebugNow()
        : 0;
    const target = resolveTextNodeTarget();
    const selectionCollectDurationMs = SCOPE_SWITCH_DEBUG
        ? scopeSwitchDebugNow() - selectionCollectStartedAt
        : 0;
    const cacheEntryAtStart = selectionCacheEntryAtStart;
    const cacheExistedAtStart = true;
    const cacheHadSummaryAtStart = Boolean(cacheEntryAtStart && cacheEntryAtStart.summary);
    const cacheDirtyAtStart = cacheEntryAtStart ? cacheEntryAtStart.dirty : true;
    const cacheHadPendingAtStart = Boolean(cacheEntryAtStart && cacheEntryAtStart.pending);
    const selectionCacheRevisionAtStart = cacheEntryAtStart
        ? cacheEntryAtStart.revision
        : -1;
    const selectionAnalyzeStartedAt = SCOPE_SWITCH_DEBUG
        ? scopeSwitchDebugNow()
        : 0;
    const selectionSummaryResult = await getSelectionAvailabilitySummary(page, target.textNodes);
    const selectionAnalyzeDurationMs = SCOPE_SWITCH_DEBUG
        ? scopeSwitchDebugNow() - selectionAnalyzeStartedAt
        : 0;
    const availabilitySummary = selectionSummaryResult.summary;
    if (requestId !== selectionInfoRequestId) {
        logScopeSwitchMainRequestCompleted({
            requestedScope: target.targetScope,
            resultSource: "dropped",
            cacheExistedAtStart,
            cacheHadSummaryAtStart,
            cacheDirtyAtStart,
            cacheHadPendingAtStart,
            cacheHadUpdateQueueAtStart: cacheExistedAtStart,
            updateQueueWaitDurationMs: 0,
            pendingWaitDurationMs: 0,
            pageLoadDurationMs: 0,
            collectTextNodesDurationMs: 0,
            analyzeTextNodesDurationMs: 0,
            selectionCollectDurationMs,
            selectionAnalyzeDurationMs,
            postMessageCallDurationMs: 0,
            textNodeCount: 0,
            selectionRootCount: target.selectedCount,
            missingNodeCount: selectionSummaryResult.missingNodeCount,
            requestDropped: true,
            cacheDirtyAtEnd: (_x = (_w = pageAvailabilityCache.get(page.id)) === null || _w === void 0 ? void 0 : _w.dirty) !== null && _x !== void 0 ? _x : true,
        });
        return;
    }
    const resultSource = selectionSummaryResult.source === "direct"
        ? "selection-full-analysis"
        : selectionSummaryResult.missingNodeCount === 0
            ? "selection-page-cache"
            : "selection-partial-analysis";
    const cacheEntryAfterSelectionAnalysis = pageAvailabilityCache.get(page.id);
    if (cacheEntryAfterSelectionAnalysis &&
        cacheEntryAfterSelectionAnalysis.revision === selectionCacheRevisionAtStart) {
        writeSelectionResultCache({
            pageId: page.id,
            selectionRootIds: selection.map((node) => node.id),
            pageRevisionAtCache: cacheEntryAfterSelectionAnalysis.revision,
            pageSummaryRefAtCache: cacheEntryAfterSelectionAnalysis.summary,
            targetScope: target.targetScope,
            scopeType: target.scopeType,
            selectionKey: target.selectionKey,
            selectedCount: target.selectedCount,
            summary: availabilitySummary,
        });
    }
    const postMessageStartedAt = SCOPE_SWITCH_DEBUG ? scopeSwitchDebugNow() : 0;
    figma.ui.postMessage({
        type: "selection-info",
        requestId,
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
        pageId: page.id,
        ...(SCOPE_SWITCH_DEBUG
            ? { debugScopeSwitchSequence, debugScopeSwitchStartedAt }
            : {}),
    });
    const postMessageCallDurationMs = SCOPE_SWITCH_DEBUG
        ? scopeSwitchDebugNow() - postMessageStartedAt
        : 0;
    logScopeSwitchMainRequestCompleted({
        requestedScope: target.targetScope,
        resultSource,
        cacheExistedAtStart,
        cacheHadSummaryAtStart,
        cacheDirtyAtStart,
        cacheHadPendingAtStart,
        cacheHadUpdateQueueAtStart: cacheExistedAtStart,
        updateQueueWaitDurationMs: 0,
        pendingWaitDurationMs: 0,
        pageLoadDurationMs: 0,
        collectTextNodesDurationMs: 0,
        analyzeTextNodesDurationMs: 0,
        selectionCollectDurationMs,
        selectionAnalyzeDurationMs,
        postMessageCallDurationMs,
        textNodeCount: availabilitySummary.totalTextNodeCount,
        selectionRootCount: target.selectedCount,
        missingNodeCount: selectionSummaryResult.missingNodeCount,
        requestDropped: false,
        cacheDirtyAtEnd: (_z = (_y = pageAvailabilityCache.get(page.id)) === null || _y === void 0 ? void 0 : _y.dirty) !== null && _z !== void 0 ? _z : true,
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
// Selection/page events can fire while settings are still loading and before
// the UI has painted. Starting analysis from those early events could launch
// an unintended currentPage request which later replaced the selected scope.
// Fold them into the one authoritative request made after ui-ready.
let selectionInfoRequestsEnabled = false;
function requestSelectionInfoRefresh() {
    if (!selectionInfoRequestsEnabled) {
        return;
    }
    void sendSelectionInfo();
}
// Lets the UI's own first paint (its default loading skeleton, shown before
// any message from main) actually reach the screen before main starts the
// first -- potentially heavy -- analysis request. The UI sends "ui-ready"
// only after its own requestAnimationFrame following that first paint; see
// ui.html. No timeout fallback, matching the existing selection-info-rendered
// handshake this mirrors: a real browser tab always eventually paints and
// fires rAF, so this does not add a hang risk beyond what that pattern
// already accepted.
let uiReadyReceived = false;
let resolveUiReady = null;
const uiReadyPromise = new Promise((resolve) => {
    resolveUiReady = resolve;
});
function handleUiReadyMessage() {
    if (uiReadyReceived) {
        return;
    }
    uiReadyReceived = true;
    resolveUiReady === null || resolveUiReady === void 0 ? void 0 : resolveUiReady();
}
async function initializePlugin() {
    // Read the persisted interface theme before showing the window. This lets
    // the injected bootstrap script set data-theme before the first stylesheet
    // is parsed, so a light setup never flashes a dark startup frame (and vice
    // versa). Typography settings continue loading in parallel.
    const uiSettingsPromise = loadUiSettings();
    const settingsPromise = loadSettings();
    const uiSettings = await uiSettingsPromise;
    figma.showUI(createInitialUiHtml(uiSettings), {
        width: 420,
        height: 640,
    });
    const settings = await settingsPromise;
    const page = figma.currentPage;
    const initialTargetScope = page.selection.length > 0 ? "selection" : "currentPage";
    pruneRemovedPageAvailabilityCaches();
    ensurePageAvailabilityCacheSubscription(page);
    // Arm before the first selection-info can be acknowledged. Previously the
    // arm happened after sendSelectionInfo() returned, leaving a narrow race in
    // which the UI acknowledgement arrived first and the silent page prewarm
    // never started.
    if (initialTargetScope === "selection") {
        armInitialSelectionPrewarm(page);
    }
    figma.ui.postMessage({
        type: "settings-loaded",
        settings,
        uiSettings,
        initialTargetScope,
    });
    await uiReadyPromise;
    // Ignore/coalesce any startup selectionchange/currentpagechange events and
    // analyze the live state exactly once after the first UI paint.
    selectionInfoRequestsEnabled = true;
    await sendSelectionInfo();
}
figma.on("selectionchange", () => {
    requestSelectionInfoRefresh();
});
figma.on("currentpagechange", () => {
    const page = figma.currentPage;
    pruneRemovedPageAvailabilityCaches();
    ensurePageAvailabilityCacheSubscription(page);
    requestSelectionInfoRefresh();
    if (page.selection.length > 0) {
        scheduleBackgroundPageAvailabilityPrewarm(page);
    }
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
    if (message.type === "selection-info-rendered") {
        handleSelectionInfoRenderedMessage(message);
    }
    if (message.type === "ui-ready") {
        handleUiReadyMessage();
    }
};
initializePlugin();
