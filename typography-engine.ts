// Pure typography formatter engine.
// Keep this file free from Figma API calls so it can be tested outside Figma.

namespace TypotypoEngine {
  export type LanguageCode = "ru" | "en" | "unknown";

  export type LanguageMode = "auto" | "ru" | "en";

  export type NonBreakingSpaceStyle = "regular" | "narrow";

  export type QuoteStyle =
    | "frenchGuillemets"
    | "germanLowHigh"
    | "englishDouble"
    | "programmerDouble"
    | "englishSingle"
    | "englishSingleReversed";

  export type QuotePair = {
    opening: string;
    closing: string;
  };

  export type QuoteOptions = {
    primaryQuoteStyle: QuoteStyle;
    secondaryQuoteStyle: QuoteStyle;
  };

  export type EnabledRules = {
    invisibleCopyArtifacts: boolean;
    tabs: boolean;
    manualLineBreaks: boolean;
    ellipsis: boolean;
    extraSpaces: boolean;
    trimTextEdges: boolean;
    spacingCleanup: boolean;
    percentSignNoSpace: boolean;
    numberUnitsNbsp: boolean;
    numberSigns: boolean;
    specialSymbols: boolean;
    englishApostrophes: boolean;
    englishQuotes: boolean;
    russianQuotes: boolean;
    numberRangeDash: boolean;
    russianSentenceDash: boolean;
    russianShortWordsNbsp: boolean;
    russianInitialsNbsp: boolean;
    russianNumericAbbreviations: boolean;
    russianLargeNumbers: boolean;
    uiFinalPeriod: boolean;
  };

  export type TypographyOptions = {
    nonBreakingSpaceStyle: NonBreakingSpaceStyle;
    quoteOptions: {
      ru: QuoteOptions;
      en: QuoteOptions;
    };
  };

  export type ApplySettings = {
    enabledRules: EnabledRules;
    languageMode: LanguageMode;
    options: TypographyOptions;
  };

  export type RuleResult = {
    formattedText: string;
    replacementCount: number;
  };

  export type TypographyRule = {
    id: keyof EnabledRules;
    supportedLanguages: "all" | LanguageCode[];
    apply: (
      text: string,
      settings: ApplySettings,
      language: LanguageCode
    ) => RuleResult;
  };

  export type LanguageStats = Record<LanguageCode, number>;

  export const DEFAULT_SETTINGS: ApplySettings = {
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

  function isLanguageMode(value: unknown): value is LanguageMode {
    return value === "auto" || value === "ru" || value === "en";
  }

  function isNonBreakingSpaceStyle(
    value: unknown
  ): value is NonBreakingSpaceStyle {
    return value === "regular" || value === "narrow";
  }

  function isQuoteStyle(value: unknown): value is QuoteStyle {
    return (
      value === "frenchGuillemets" ||
      value === "germanLowHigh" ||
      value === "englishDouble" ||
      value === "programmerDouble" ||
      value === "englishSingle" ||
      value === "englishSingleReversed"
    );
  }

  function normalizeQuoteOptions(
    value: unknown,
    fallback: QuoteOptions
  ): QuoteOptions {
    const maybeQuoteOptions: Partial<QuoteOptions> =
      typeof value === "object" && value !== null
        ? (value as Partial<QuoteOptions>)
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

  function getQuotePair(style: QuoteStyle): QuotePair {
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

  function getRussianPrimaryQuotePair(settings: ApplySettings): QuotePair {
    return getQuotePair(settings.options.quoteOptions.ru.primaryQuoteStyle);
  }

  function getRussianSecondaryQuotePair(settings: ApplySettings): QuotePair {
    return getQuotePair(settings.options.quoteOptions.ru.secondaryQuoteStyle);
  }

  function getEnglishPrimaryQuotePair(settings: ApplySettings): QuotePair {
    return getQuotePair(settings.options.quoteOptions.en.primaryQuoteStyle);
  }

  function getEnglishSecondaryQuotePair(settings: ApplySettings): QuotePair {
    return getQuotePair(settings.options.quoteOptions.en.secondaryQuoteStyle);
  }

  function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function replaceQuotePairInText(
    input: string,
    fromPair: QuotePair,
    toPair: QuotePair
  ): RuleResult {
    if (
      fromPair.opening === toPair.opening &&
      fromPair.closing === toPair.closing
    ) {
      return {
        formattedText: input,
        replacementCount: 0,
      };
    }

    const opening = escapeRegExp(fromPair.opening);
    const closing = escapeRegExp(fromPair.closing);

    const regexp =
      fromPair.opening === fromPair.closing
        ? new RegExp(opening + "([^" + opening + "\\n]+?)" + closing, "g")
        : new RegExp(opening + "([^\\n]+?)" + closing, "g");

    let replacementCount = 0;

    const formattedText = input.replace(
      regexp,
      function (match: string, quoteContent: string) {
        const normalized = toPair.opening + quoteContent + toPair.closing;

        if (match === normalized) {
          return match;
        }

        replacementCount += 1;
        return normalized;
      }
    );

    return {
      formattedText,
      replacementCount,
    };
  }

  export function normalizeSettings(value: unknown): ApplySettings {
    const maybeSettings: Partial<ApplySettings> =
      typeof value === "object" && value !== null
        ? (value as Partial<ApplySettings>)
        : {};

    const maybeOptions: Partial<TypographyOptions> =
      typeof maybeSettings.options === "object" && maybeSettings.options !== null
        ? (maybeSettings.options as Partial<TypographyOptions>)
        : {};

    const legacyOptions = maybeOptions as Partial<TypographyOptions> & {
      numberUnitsSpace?: unknown;
    };

    const maybeQuoteOptions =
      typeof maybeOptions.quoteOptions === "object" &&
      maybeOptions.quoteOptions !== null
        ? maybeOptions.quoteOptions
        : {};

    const maybeQuoteOptionsRecord = maybeQuoteOptions as {
      ru?: unknown;
      en?: unknown;
    };

    const maybeEnabledRules =
      typeof maybeSettings.enabledRules === "object" &&
      maybeSettings.enabledRules !== null
        ? (maybeSettings.enabledRules as Partial<EnabledRules> & {
            russianUiFinalPeriod?: unknown;
            russianNumberRangeDash?: unknown;
            spacesBeforePunctuation?: unknown;
            spacesAfterPunctuation?: unknown;
          })
        : {};

    let nonBreakingSpaceStyle: NonBreakingSpaceStyle =
      DEFAULT_SETTINGS.options.nonBreakingSpaceStyle;

    if (isNonBreakingSpaceStyle(maybeOptions.nonBreakingSpaceStyle)) {
      nonBreakingSpaceStyle = maybeOptions.nonBreakingSpaceStyle;
    } else if (legacyOptions.numberUnitsSpace === "narrowNbsp") {
      nonBreakingSpaceStyle = "narrow";
    } else if (legacyOptions.numberUnitsSpace === "nbsp") {
      nonBreakingSpaceStyle = "regular";
    }

    const uiFinalPeriod =
      typeof maybeEnabledRules.uiFinalPeriod === "boolean"
        ? maybeEnabledRules.uiFinalPeriod
        : typeof maybeEnabledRules.russianUiFinalPeriod === "boolean"
          ? maybeEnabledRules.russianUiFinalPeriod
          : DEFAULT_SETTINGS.enabledRules.uiFinalPeriod;

    const legacySpacingValues = [
      maybeEnabledRules.spacesBeforePunctuation,
      maybeEnabledRules.spacesAfterPunctuation,
    ].filter((value): value is boolean => typeof value === "boolean");

    const spacingCleanup =
      typeof maybeEnabledRules.spacingCleanup === "boolean"
        ? maybeEnabledRules.spacingCleanup
        : legacySpacingValues.length > 0
          ? legacySpacingValues.some(Boolean)
          : DEFAULT_SETTINGS.enabledRules.spacingCleanup;

    return {
      languageMode: isLanguageMode(maybeSettings.languageMode)
        ? maybeSettings.languageMode
        : DEFAULT_SETTINGS.languageMode,

      options: {
        nonBreakingSpaceStyle,
        quoteOptions: {
          ru: normalizeQuoteOptions(
            maybeQuoteOptionsRecord.ru,
            DEFAULT_SETTINGS.options.quoteOptions.ru
          ),
          en: normalizeQuoteOptions(
            maybeQuoteOptionsRecord.en,
            DEFAULT_SETTINGS.options.quoteOptions.en
          ),
        },
      },

      enabledRules: {
        invisibleCopyArtifacts:
          typeof maybeEnabledRules.invisibleCopyArtifacts === "boolean"
            ? maybeEnabledRules.invisibleCopyArtifacts
            : DEFAULT_SETTINGS.enabledRules.invisibleCopyArtifacts,

        tabs:
          typeof maybeEnabledRules.tabs === "boolean"
            ? maybeEnabledRules.tabs
            : DEFAULT_SETTINGS.enabledRules.tabs,

        manualLineBreaks:
          typeof maybeEnabledRules.manualLineBreaks === "boolean"
            ? maybeEnabledRules.manualLineBreaks
            : DEFAULT_SETTINGS.enabledRules.manualLineBreaks,

        ellipsis:
          typeof maybeEnabledRules.ellipsis === "boolean"
            ? maybeEnabledRules.ellipsis
            : DEFAULT_SETTINGS.enabledRules.ellipsis,

        extraSpaces:
          typeof maybeEnabledRules.extraSpaces === "boolean"
            ? maybeEnabledRules.extraSpaces
            : DEFAULT_SETTINGS.enabledRules.extraSpaces,

        trimTextEdges:
          typeof maybeEnabledRules.trimTextEdges === "boolean"
            ? maybeEnabledRules.trimTextEdges
            : DEFAULT_SETTINGS.enabledRules.trimTextEdges,

        spacingCleanup,

        percentSignNoSpace:
          typeof maybeEnabledRules.percentSignNoSpace === "boolean"
            ? maybeEnabledRules.percentSignNoSpace
            : DEFAULT_SETTINGS.enabledRules.percentSignNoSpace,

        numberUnitsNbsp:
          typeof maybeEnabledRules.numberUnitsNbsp === "boolean"
            ? maybeEnabledRules.numberUnitsNbsp
            : DEFAULT_SETTINGS.enabledRules.numberUnitsNbsp,

        numberSigns:
          typeof maybeEnabledRules.numberSigns === "boolean"
            ? maybeEnabledRules.numberSigns
            : DEFAULT_SETTINGS.enabledRules.numberSigns,

        specialSymbols:
          typeof maybeEnabledRules.specialSymbols === "boolean"
            ? maybeEnabledRules.specialSymbols
            : DEFAULT_SETTINGS.enabledRules.specialSymbols,

        englishApostrophes:
          typeof maybeEnabledRules.englishApostrophes === "boolean"
            ? maybeEnabledRules.englishApostrophes
            : DEFAULT_SETTINGS.enabledRules.englishApostrophes,

        englishQuotes:
          typeof maybeEnabledRules.englishQuotes === "boolean"
            ? maybeEnabledRules.englishQuotes
            : DEFAULT_SETTINGS.enabledRules.englishQuotes,

        russianQuotes:
          typeof maybeEnabledRules.russianQuotes === "boolean"
            ? maybeEnabledRules.russianQuotes
            : DEFAULT_SETTINGS.enabledRules.russianQuotes,

        numberRangeDash:
          typeof maybeEnabledRules.numberRangeDash === "boolean"
            ? maybeEnabledRules.numberRangeDash
            : typeof maybeEnabledRules.russianNumberRangeDash === "boolean"
              ? maybeEnabledRules.russianNumberRangeDash
              : DEFAULT_SETTINGS.enabledRules.numberRangeDash,

        russianSentenceDash:
          typeof maybeEnabledRules.russianSentenceDash === "boolean"
            ? maybeEnabledRules.russianSentenceDash
            : DEFAULT_SETTINGS.enabledRules.russianSentenceDash,

        russianShortWordsNbsp:
          typeof maybeEnabledRules.russianShortWordsNbsp === "boolean"
            ? maybeEnabledRules.russianShortWordsNbsp
            : DEFAULT_SETTINGS.enabledRules.russianShortWordsNbsp,

        russianInitialsNbsp:
          typeof maybeEnabledRules.russianInitialsNbsp === "boolean"
            ? maybeEnabledRules.russianInitialsNbsp
            : DEFAULT_SETTINGS.enabledRules.russianInitialsNbsp,

        russianNumericAbbreviations:
          typeof maybeEnabledRules.russianNumericAbbreviations === "boolean"
            ? maybeEnabledRules.russianNumericAbbreviations
            : DEFAULT_SETTINGS.enabledRules.russianNumericAbbreviations,

        russianLargeNumbers:
          typeof maybeEnabledRules.russianLargeNumbers === "boolean"
            ? maybeEnabledRules.russianLargeNumbers
            : DEFAULT_SETTINGS.enabledRules.russianLargeNumbers,

        uiFinalPeriod,
      },
    };
  }

  function getIcuVariantTextForLanguageDetection(fragment: string): string {
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

  function replaceBalancedCurlyBraceFragmentsForLanguageDetection(
    text: string,
    includeIcuVariantText: boolean
  ): string {
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
      } else if (character === "}" && depth > 0) {
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

  function getTextForLanguageDetection(
    text: string,
    includeIcuVariantText = false
  ): string {
    const textWithoutProtectedSyntax = text
      .replace(/`[^`\n]+`/g, " ")
      .replace(/&(?:[A-Za-z][A-Za-z0-9]{1,31}|#\d{1,7}|#x[0-9A-Fa-f]{1,6});/g, " ")
      .replace(/<\/?[A-Za-z][A-Za-z0-9:-]*(?:\s+[A-Za-z_:][A-Za-z0-9:._-]*(?:=(?:"[^"\n]*"|'[^'\n]*'|[^\s"'=<>`]+))?)*\s*\/?>/g, " ");

    return replaceBalancedCurlyBraceFragmentsForLanguageDetection(
      textWithoutProtectedSyntax,
      includeIcuVariantText
    )
      .replace(/%(?:\d+\$)?[@sdif]/g, " ")
      .replace(/\$\d+\b/g, " ");
  }

  function detectLanguageFromPreparedText(languageDetectionText: string): LanguageCode {
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

  function getLetterCount(value: string): number {
    const cyrillicMatches = value.match(/[А-Яа-яЁё]/g) || [];
    const latinMatches = value.match(/[A-Za-z]/g) || [];

    return cyrillicMatches.length + latinMatches.length;
  }

  function detectDominantLanguage(text: string): LanguageCode {
    const surroundingText = getTextForLanguageDetection(text, false);
    const surroundingTextLanguage = detectLanguageFromPreparedText(
      surroundingText
    );

    if (surroundingTextLanguage !== "unknown") {
      return surroundingTextLanguage;
    }

    if (getLetterCount(surroundingText) === 0) {
      return "unknown";
    }

    return detectLanguageFromPreparedText(getTextForLanguageDetection(text, true));
  }

  export function resolveLanguage(text: string, languageMode: LanguageMode): LanguageCode {
    if (languageMode === "ru") {
      return "ru";
    }

    if (languageMode === "en") {
      return "en";
    }

    return detectDominantLanguage(text);
  }

  function getConfiguredNbsp(settings: ApplySettings): string {
    if (settings.options.nonBreakingSpaceStyle === "narrow") {
      return "\u202F";
    }

    return "\u00A0";
  }

  function applyInvisibleCopyArtifactsRule(text: string): RuleResult {
    const regexp = /[\u00AD\u200B\uFEFF]/g;
    const matches = text.match(regexp);

    return {
      formattedText: text.replace(regexp, ""),
      replacementCount: matches ? matches.length : 0,
    };
  }

  function applyTabsRule(text: string): RuleResult {
    const regexp = /\t+/g;
    const matches = text.match(regexp);

    return {
      formattedText: text.replace(regexp, " "),
      replacementCount: matches ? matches.length : 0,
    };
  }

  function applyManualLineBreaksRule(text: string): RuleResult {
    let replacementCount = 0;

    const normalizedLineEndings = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    function startsWithSupportedListMarker(line: string): boolean {
      return /^[ \t\u00A0\u202F]*(?:[•‣▪◦—–]|-[ \t\u00A0\u202F])/.test(line);
    }

    const formattedText = normalizedLineEndings.replace(
      /([^\n])[ \t\u00A0\u202F]*\n[ \t\u00A0\u202F]*([^\n])/g,
      function (
        match: string,
        beforeBreak: string,
        afterBreak: string,
        offset: number,
        fullText: string
      ) {
        const newlineIndex = offset + match.indexOf("\n");
        const currentLineStart = fullText.lastIndexOf("\n", offset) + 1;
        const currentLine = fullText.slice(currentLineStart, newlineIndex);
        const nextLineEnd = fullText.indexOf("\n", newlineIndex + 1);
        const nextLine = fullText.slice(
          newlineIndex + 1,
          nextLineEnd === -1 ? fullText.length : nextLineEnd
        );

        if (
          startsWithSupportedListMarker(currentLine) ||
          startsWithSupportedListMarker(nextLine)
        ) {
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
      }
    );

    if (normalizedLineEndings !== text && formattedText === normalizedLineEndings) {
      replacementCount += 1;
    }

    return {
      formattedText,
      replacementCount,
    };
  }


  function applyEllipsisRule(text: string): RuleResult {
    let formattedText = text;
    let replacementCount = 0;

    function replaceAndCount(regexp: RegExp, replacement: string) {
      formattedText = formattedText.replace(regexp, function (match: string) {
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

  function applyExtraSpacesRule(text: string): RuleResult {
    const matches = text.match(/[^\S\r\n]{2,}/g);

    return {
      formattedText: text.replace(/[^\S\r\n]{2,}/g, " "),
      replacementCount: matches ? matches.length : 0,
    };
  }

  function applyTrimTextEdgesRule(text: string): RuleResult {
    const regexp = /^[ \t\u00A0\u202F]+|[ \t\u00A0\u202F]+$/g;
    const matches = text.match(regexp);

    return {
      formattedText: text.replace(regexp, ""),
      replacementCount: matches ? matches.length : 0,
    };
  }

  function applySpacingCleanupRule(text: string): RuleResult {
    let replacementCount = 0;
    let normalizedText = text;

    function replaceAndCount(regexp: RegExp, replacement: string) {
      normalizedText = normalizedText.replace(regexp, function (match: string) {
        if (match === replacement) {
          return match;
        }

        replacementCount += 1;
        return replacement;
      });
    }

    normalizedText = normalizedText.replace(
      /[ \t\u00A0\u202F]+([,.…;:!?])/g,
      function (match: string, punctuation: string) {
        if (match === punctuation) {
          return match;
        }

        replacementCount += 1;
        return punctuation;
      }
    );

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

    normalizedText = normalizedText.replace(
      /([!?.,;:])\1+/g,
      function (
        match: string,
        punctuation: string,
        offset: number,
        fullText: string
      ) {
        if (
          punctuation === "." &&
          offset > 0 &&
          (fullText[offset - 1] === "?" || fullText[offset - 1] === "!")
        ) {
          return match;
        }

        replacementCount += 1;
        return punctuation;
      }
    );

    normalizedText = normalizedText.replace(
      /([А-Яа-яЁёA-Za-z0-9])\.([»”’])/g,
      function (
        match: string,
        characterBeforePeriod: string,
        closingQuote: string,
        offset: number,
        fullText: string
      ) {
        const textEndingWithPeriod = fullText.slice(0, offset + 2);

        if (
          shouldKeepRussianFinalPeriod(textEndingWithPeriod) ||
          shouldKeepEnglishFinalPeriod(textEndingWithPeriod)
        ) {
          return match;
        }

        const normalized = characterBeforePeriod + closingQuote + ".";

        if (match === normalized) {
          return match;
        }

        replacementCount += 1;
        return normalized;
      }
    );

    function isSpaceLike(character: string): boolean {
      return /[ \t\n\r\u00A0\u202F]/.test(character);
    }

    function isClosingPunctuationOrOperator(character: string): boolean {
      return /[,.;:!?)\]}»”’=<>]/.test(character);
    }

    function isOpeningPunctuation(character: string): boolean {
      return /[({[«„“"']/.test(character);
    }

    function shouldAddSpaceAfterPunctuation(
      punctuation: string,
      previousCharacter: string,
      nextCharacter: string
    ): boolean {
      if (!nextCharacter || isSpaceLike(nextCharacter)) {
        return false;
      }

      if (nextCharacter === PROTECTED_TEXT_TOKEN_START) {
        return false;
      }

      if (isClosingPunctuationOrOperator(nextCharacter)) {
        return false;
      }

      if (
        (punctuation === "," || punctuation === ":") &&
        /\d/.test(previousCharacter) &&
        /\d/.test(nextCharacter)
      ) {
        return false;
      }

      if (punctuation === ".") {
        if (/\d/.test(previousCharacter) && /\d/.test(nextCharacter)) {
          return false;
        }

        return (
          /[А-ЯЁA-Z]/.test(nextCharacter) ||
          isOpeningPunctuation(nextCharacter) ||
          nextCharacter === PROTECTED_TEXT_TOKEN_START
        );
      }

      return true;
    }

    function applyBracketSpacingCleanup(input: string): RuleResult {
      let bracketReplacementCount = 0;

      let output = input.replace(
        /([([])[ \t\u00A0\u202F]+(?=[А-Яа-яЁё0-9%№§])/g,
        function (match: string, openingBracket: string) {
          if (match === openingBracket) {
            return match;
          }

          bracketReplacementCount += 1;
          return openingBracket;
        }
      );

      output = output.replace(
        /([А-Яа-яЁё0-9%₽№§])[ \t\u00A0\u202F]+([)\]])/g,
        function (match: string, beforeBracket: string, closingBracket: string) {
          const normalized = beforeBracket + closingBracket;

          if (match === normalized) {
            return match;
          }

          bracketReplacementCount += 1;
          return normalized;
        }
      );

      output = output.replace(
        /([А-Яа-яЁё0-9»“”’")\].!?])([([])(?=[^ \t\n\r\u00A0\u202F)\]])/g,
        function (
          match: string,
          beforeBracket: string,
          openingBracket: string,
          offset: number,
          fullText: string
        ) {
          const nextCharacter =
            fullText[offset + beforeBracket.length + openingBracket.length] || "";

          if (/\d/.test(beforeBracket) && /\d/.test(nextCharacter)) {
            return match;
          }

          const normalized = beforeBracket + " " + openingBracket;

          if (match === normalized) {
            return match;
          }

          bracketReplacementCount += 1;
          return normalized;
        }
      );

      return {
        formattedText: output,
        replacementCount: bracketReplacementCount,
      };
    }

    function applyEnclosureSpacingCleanup(input: string): RuleResult {
      let enclosureReplacementCount = 0;

      function replaceAndCount(
        value: string,
        regexp: RegExp,
        replacer: (...args: string[]) => string
      ): string {
        return value.replace(regexp, function (...args: unknown[]) {
          const stringArgs = args.map((arg) =>
            typeof arg === "string" ? arg : ""
          );

          const match = stringArgs[0];
          const normalized = replacer(...stringArgs);

          if (match === normalized) {
            return match;
          }

          enclosureReplacementCount += 1;
          return normalized;
        });
      }

      let output = replaceAndCount(
        input,
        /([«„“‘‚"([])[ \t\u00A0\u202F]+(?=\S)/g,
        function (_match: string, openingSymbol: string) {
          return openingSymbol;
        }
      );

      output = replaceAndCount(
        output,
        /(„[^„“\n]*?)[ \t\u00A0\u202F]+“/g,
        function (_match: string, quoteContentBeforeClosing: string) {
          return quoteContentBeforeClosing + "“";
        }
      );

      output = replaceAndCount(
        output,
        /[ \t\u00A0\u202F]+([»”’"\])])/g,
        function (_match: string, closingSymbol: string) {
          return closingSymbol;
        }
      );

      return {
        formattedText: output,
        replacementCount: enclosureReplacementCount,
      };
    }

    function applyUiSeparatorSpacingCleanup(input: string): RuleResult {
      let separatorReplacementCount = 0;

      const formattedText = input.replace(
        /([^ \t\n\r\u00A0\u202F|·])([ \t\u00A0\u202F]*)([|·])([ \t\u00A0\u202F]*)([^ \t\n\r\u00A0\u202F|·])/g,
        function (
          match: string,
          leftCharacter: string,
          _leftSpacing: string,
          separator: string,
          _rightSpacing: string,
          rightCharacter: string
        ) {
          const normalized = leftCharacter + " " + separator + " " + rightCharacter;

          if (match === normalized) {
            return match;
          }

          separatorReplacementCount += 1;
          return normalized;
        }
      );

      return {
        formattedText,
        replacementCount: separatorReplacementCount,
      };
    }

    function applyListMarkerSpacingCleanup(input: string): RuleResult {
      let markerReplacementCount = 0;

      const formattedText = input.replace(
        /(^|\n)([ \t\u00A0\u202F]*)([•‣▪◦—–])([ \t\u00A0\u202F]*)(?=\S)/g,
        function (
          match: string,
          lineStart: string,
          indentation: string,
          marker: string,
          _markerSpacing: string
        ) {
          const normalizedMarker = marker === "–" ? "—" : marker;
          const normalized = lineStart + indentation + normalizedMarker + " ";

          if (match === normalized) {
            return match;
          }

          markerReplacementCount += 1;
          return normalized;
        }
      );

      return {
        formattedText,
        replacementCount: markerReplacementCount,
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

      if (
        shouldAddSpaceAfterPunctuation(
          character,
          previousCharacter,
          nextCharacter
        )
      ) {
        spacedText += " ";
        replacementCount += 1;
      }
    }

    const bracketSpacingResult = applyBracketSpacingCleanup(spacedText);
    const enclosureSpacingResult = applyEnclosureSpacingCleanup(
      bracketSpacingResult.formattedText
    );
    const secondBracketSpacingResult = applyBracketSpacingCleanup(
      enclosureSpacingResult.formattedText
    );
    const separatorSpacingResult = applyUiSeparatorSpacingCleanup(
      secondBracketSpacingResult.formattedText
    );
    const listMarkerSpacingResult = applyListMarkerSpacingCleanup(
      separatorSpacingResult.formattedText
    );

    return {
      formattedText: listMarkerSpacingResult.formattedText,
      replacementCount:
        replacementCount +
        bracketSpacingResult.replacementCount +
        enclosureSpacingResult.replacementCount +
        secondBracketSpacingResult.replacementCount +
        separatorSpacingResult.replacementCount +
        listMarkerSpacingResult.replacementCount,
    };
  }

  function applyPercentSignNoSpaceRule(text: string): RuleResult {
    const regexp = /((?:\d+(?:[,.]\d+)?)|(?:\uE100[\uE200-\uF8FF]\uE101))[ \t\u00A0\u202F]+%/g;
    const matches = text.match(regexp);

    return {
      formattedText: text.replace(regexp, "$1%"),
      replacementCount: matches ? matches.length : 0,
    };
  }

  function applyNumberUnitsNbspRule(
    text: string,
    settings: ApplySettings
  ): RuleResult {
    const units =
      "°[CFС]|₽|руб\\.?|рублей|р\\.?|тыс\\.?|млн\\.?|млрд\\.?|трлн\\.?|кг|г|мг|л|мл|м|см|мм|км|с|сек|мин|ч|д|дн|КБ|МБ|ГБ|ТБ|KB|MB|GB|TB|px|dp|pt|rem|em|vw|vh";

    const regexp = new RegExp(
      "(\\d+(?:[,.]\\d+)?)[ \\t\\u00A0\\u202F]+(" +
        units +
        ")(?=$|[ \\t\\n\\r,.;:!?\\)])",
      "giu"
    );

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

  function applyNumberSignsRule(
    text: string,
    _settings: ApplySettings
  ): RuleResult {
    const regularNbsp = "\u00A0";
    const regexp = /([№§])[ \t\u00A0\u202F]*(?=\d)/g;

    let replacementCount = 0;

    const formattedText = text.replace(
      regexp,
      function (match: string, sign: string) {
        const normalized = sign + regularNbsp;

        if (match === normalized) {
          return match;
        }

        replacementCount += 1;
        return normalized;
      }
    );

    return {
      formattedText,
      replacementCount,
    };
  }

  function applySpecialSymbolsRule(
    text: string,
    settings: ApplySettings,
    language: LanguageCode
  ): RuleResult {
    let formattedText = text;
    let replacementCount = 0;
    const space = getConfiguredNbsp(settings);

    function replaceAndCount(regexp: RegExp, replacement: string) {
      formattedText = formattedText.replace(regexp, function (match) {
        if (match === replacement) {
          return match;
        }

        replacementCount += 1;
        return replacement;
      });
    }

    function normalizeSignedNumber(number: string): string {
      return number
        .replace(/^([+−–—-])[ \t\u00A0\u202F]+(?=\d)/, "$1")
        .replace(/^[-–—−]/, "−");
    }

    function resolveCurrencyLanguage(
      rawCurrency: string,
      symbol: "₽" | "$" | "€",
      offset: number,
      fullText: string
    ): "ru" | "en" | null {
      if (settings.languageMode === "ru" || settings.languageMode === "en") {
        return settings.languageMode;
      }

      function isSentenceBoundaryAt(index: number): boolean {
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

      function getCurrencyLocalContext(): string {
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

        return fullText.slice(contextStart, contextEnd);
      }

      const localContext = getCurrencyLocalContext();

      const cyrillicMatches = localContext.match(/[А-Яа-яЁё]/g) || [];
      const latinMatches = localContext.match(/[A-Za-z]/g) || [];

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

    function normalizeCurrencyDecimalSeparator(
      number: string,
      currencyLanguage: "ru" | "en"
    ): string {
      const normalizedNumber = normalizeSignedNumber(number);
      const decimalSeparator = currencyLanguage === "ru" ? "," : ".";

      return normalizedNumber.replace(
        /([,.])(\d{1,2})$/,
        decimalSeparator + "$2"
      );
    }

    function splitSignedNumber(number: string): {
      sign: string;
      unsignedNumber: string;
    } {
      const sign = /^[+−]/.test(number) ? number.charAt(0) : "";
      const unsignedNumber = sign ? number.slice(1) : number;

      return { sign, unsignedNumber };
    }

    function formatCurrencyAmount(
      number: string,
      symbol: "₽" | "$" | "€",
      currencyLanguage: "ru" | "en"
    ): string {
      const normalizedNumber = normalizeCurrencyDecimalSeparator(
        number,
        currencyLanguage
      );

      if (currencyLanguage === "en") {
        const { sign, unsignedNumber } = splitSignedNumber(normalizedNumber);

        return sign + symbol + unsignedNumber;
      }

      return normalizedNumber + space + symbol;
    }

    function formatRubleKopeckAmount(
      rubles: string,
      kopecks: string,
      currencyLanguage: "ru" | "en"
    ): string {
      const normalizedRubles = normalizeSignedNumber(rubles).replace(
        /[,.]\d+$/,
        ""
      );
      const normalizedKopecks = kopecks.padStart(2, "0");

      if (currencyLanguage === "en") {
        const { sign, unsignedNumber } = splitSignedNumber(normalizedRubles);

        return sign + "₽" + unsignedNumber + "." + normalizedKopecks;
      }

      return normalizedRubles + "," + normalizedKopecks + space + "₽";
    }

    function replaceCurrencySuffix(
      regexp: RegExp,
      symbol: "₽" | "$" | "€"
    ) {
      formattedText = formattedText.replace(
        regexp,
        function (
          match: string,
          prefix: string,
          number: string,
          rawCurrency: string,
          offset: number,
          fullText: string
        ) {
          const currencyLanguage = resolveCurrencyLanguage(
            rawCurrency,
            symbol,
            offset,
            fullText
          );

          if (!currencyLanguage) {
            return match;
          }

          const normalized =
            prefix + formatCurrencyAmount(number, symbol, currencyLanguage);

          if (match === normalized) {
            return match;
          }

          replacementCount += 1;
          return normalized;
        }
      );
    }

    function replaceCurrencyPrefix(
      regexp: RegExp,
      symbol: "₽" | "$" | "€"
    ) {
      formattedText = formattedText.replace(
        regexp,
        function (
          match: string,
          prefix: string,
          rawCurrency: string,
          number: string,
          offset: number,
          fullText: string
        ) {
          const currencyLanguage = resolveCurrencyLanguage(
            rawCurrency,
            symbol,
            offset,
            fullText
          );

          if (!currencyLanguage) {
            return match;
          }

          const normalized =
            prefix + formatCurrencyAmount(number, symbol, currencyLanguage);

          if (match === normalized) {
            return match;
          }

          replacementCount += 1;
          return normalized;
        }
      );
    }

    function replaceCurrencyPrefixFractionalFirst(
      regexp: RegExp,
      symbol: "₽" | "$" | "€"
    ) {
      formattedText = formattedText.replace(
        regexp,
        function (
          match: string,
          prefix: string,
          rawCurrency: string,
          number: string,
          offset: number,
          fullText: string
        ) {
          const currencyLanguage = resolveCurrencyLanguage(
            rawCurrency,
            symbol,
            offset,
            fullText
          );

          if (!currencyLanguage) {
            return match;
          }

          const normalized =
            prefix + formatCurrencyAmount(number, symbol, currencyLanguage);

          if (match === normalized) {
            return match;
          }

          replacementCount += 1;
          return normalized;
        }
      );
    }

    function replaceRubleKopecks(regexp: RegExp) {
      formattedText = formattedText.replace(
        regexp,
        function (
          match: string,
          prefix: string,
          rubles: string,
          rawCurrency: string,
          kopecks: string,
          terminalPeriod: string,
          offset: number,
          fullText: string
        ) {
          const currencyLanguage = resolveCurrencyLanguage(
            rawCurrency,
            "₽",
            offset,
            fullText
          );

          if (!currencyLanguage) {
            return match;
          }

          const amount = formatRubleKopeckAmount(
            rubles,
            kopecks,
            currencyLanguage
          );
          const characterAfterMatch = fullText.slice(offset + match.length);
          const shouldKeepSentencePeriod =
            terminalPeriod === "." &&
            /^[ \t\u00A0\u202F]+[А-ЯЁA-Z]/.test(characterAfterMatch);
          const normalized =
            prefix + amount + (shouldKeepSentencePeriod ? "." : "");

          if (match === normalized) {
            return match;
          }

          replacementCount += 1;
          return normalized;
        }
      );
    }

    function repairSplitRubleFractionalAmounts(regexp: RegExp) {
      formattedText = formattedText.replace(
        regexp,
        function (
          match: string,
          prefix: string,
          rubles: string,
          kopecks: string,
          offset: number,
          fullText: string
        ) {
          const currencyLanguage = resolveCurrencyLanguage(
            "₽",
            "₽",
            offset,
            fullText
          );

          if (!currencyLanguage) {
            return match;
          }

          const normalized =
            prefix + formatRubleKopeckAmount(rubles, kopecks, currencyLanguage);

          if (match === normalized) {
            return match;
          }

          replacementCount += 1;
          return normalized;
        }
      );
    }

    replaceAndCount(/\([cс]\)/giu, "©");
    replaceAndCount(/\((tm|тм)\)/giu, "™");
    replaceAndCount(/\([rр]\)/giu, "®");
    replaceAndCount(/\+\/-/g, "±");
    replaceAndCount(/\+[\s\u00A0\u202F]*[-–—−]/g, "±");
    replaceAndCount(/<=/g, "≤");
    replaceAndCount(/>=/g, "≥");
    formattedText = formattedText.replace(
      /(\S)[ \t\u00A0\u202F]*!=[ \t\u00A0\u202F]*(?=\S)/g,
      function (match: string, leftCharacter: string) {
        const normalized = leftCharacter + " ≠ ";

        if (match === normalized) {
          return match;
        }

        replacementCount += 1;
        return normalized;
      }
    );

    replaceAndCount(/!=/g, "≠");
    replaceAndCount(/~=|≈=/g, "≈");

    const fractionReplacements: Record<string, string> = {
      "1/2": "½",
      "1/3": "⅓",
      "2/3": "⅔",
      "1/4": "¼",
      "3/4": "¾",
    };

    formattedText = formattedText.replace(
      /(^|[^0-9A-Za-zА-Яа-яЁё./\\])(1\/2|1\/3|2\/3|1\/4|3\/4)(?=$|[ \t\u00A0\u202F\n\r,.;:!?…)\]}»”’\uE100])/g,
      function (match: string, prefix: string, fraction: string) {
        const replacement = fractionReplacements[fraction];
        const normalized = prefix + replacement;

        if (match === normalized) {
          return match;
        }

        replacementCount += 1;
        return normalized;
      }
    );

    formattedText = formattedText.replace(
      /(\uE101)(1\/2|1\/3|2\/3|1\/4|3\/4)(?=\uE100)/g,
      function (match: string, prefix: string, fraction: string) {
        const replacement = fractionReplacements[fraction];
        const normalized = prefix + replacement;

        if (match === normalized) {
          return match;
        }

        replacementCount += 1;
        return normalized;
      }
    );

    const currencyPrefixBoundary = `(^|[ \t\u00A0\u202F([{«„“"'\uE101])`;
    const currencySuffixBoundary = `(?=$|[ \t\n\r,.;:!?…)\\]}»”’\uE100])`;
    const currencyNumber = `([+−–—-]?[ \t\u00A0\u202F]*\\d+(?:[,.]\\d+)?)`;

    replaceCurrencyPrefixFractionalFirst(
      new RegExp(
        currencyPrefixBoundary +
          `(₽|RUB|RUR)[ \t\u00A0\u202F]*` +
          `([+−–—-]?[ \t\u00A0\u202F]*\\d+[,.]\\d{1,2})` +
          currencySuffixBoundary,
        "giu"
      ),
      "₽"
    );

    replaceCurrencyPrefixFractionalFirst(
      new RegExp(
        currencyPrefixBoundary +
          `(\\$|USD)[ \t\u00A0\u202F]*` +
          `([+−–—-]?[ \t\u00A0\u202F]*\\d+[,.]\\d{1,2})` +
          currencySuffixBoundary,
        "giu"
      ),
      "$"
    );

    replaceCurrencyPrefixFractionalFirst(
      new RegExp(
        currencyPrefixBoundary +
          `(€|EUR)[ \t\u00A0\u202F]*` +
          `([+−–—-]?[ \t\u00A0\u202F]*\\d+[,.]\\d{1,2})` +
          currencySuffixBoundary,
        "giu"
      ),
      "€"
    );

    repairSplitRubleFractionalAmounts(
      new RegExp(
        currencyPrefixBoundary +
          `([+−–—-]?[ \t\u00A0\u202F]*\\d+)[ \t\u00A0\u202F]*₽[ \t\u00A0\u202F]*[,.](\\d{1,2})` +
          currencySuffixBoundary,
        "giu"
      )
    );

    replaceRubleKopecks(
      new RegExp(
        currencyPrefixBoundary +
          currencyNumber +
          `[ \t\u00A0\u202F]*(₽|р\\.?|руб\\.?|рублей|RUB|RUR)[ \t\u00A0\u202F]+(\\d{1,2})[ \t\u00A0\u202F]*(?:коп|копеек|копейки|копейка)(\\.)?` +
          currencySuffixBoundary,
        "giu"
      )
    );

    replaceCurrencySuffix(
      new RegExp(
        currencyPrefixBoundary +
          currencyNumber +
          `[ \t\u00A0\u202F]*(₽|р\\.?|руб\\.?|рублей|RUB|RUR)` +
          currencySuffixBoundary,
        "giu"
      ),
      "₽"
    );

    replaceCurrencyPrefix(
      new RegExp(
        currencyPrefixBoundary +
          `(₽|RUB|RUR)[ \t\u00A0\u202F]*` +
          currencyNumber +
          currencySuffixBoundary,
        "giu"
      ),
      "₽"
    );

    replaceCurrencySuffix(
      new RegExp(
        currencyPrefixBoundary +
          currencyNumber +
          `[ \t\u00A0\u202F]*(\\$|USD)` +
          currencySuffixBoundary,
        "giu"
      ),
      "$"
    );

    replaceCurrencyPrefix(
      new RegExp(
        currencyPrefixBoundary +
          `(\\$|USD)[ \t\u00A0\u202F]*` +
          currencyNumber +
          currencySuffixBoundary,
        "giu"
      ),
      "$"
    );

    replaceCurrencySuffix(
      new RegExp(
        currencyPrefixBoundary +
          currencyNumber +
          `[ \t\u00A0\u202F]*(€|EUR)` +
          currencySuffixBoundary,
        "giu"
      ),
      "€"
    );

    replaceCurrencyPrefix(
      new RegExp(
        currencyPrefixBoundary +
          `(€|EUR)[ \t\u00A0\u202F]*` +
          currencyNumber +
          currencySuffixBoundary,
        "giu"
      ),
      "€"
    );

    repairSplitRubleFractionalAmounts(
      new RegExp(
        currencyPrefixBoundary +
          `([+−–—-]?[ \t\u00A0\u202F]*\\d+)[ \t\u00A0\u202F]*₽[ \t\u00A0\u202F]*[,.](\\d{1,2})` +
          currencySuffixBoundary,
        "giu"
      )
    );

    formattedText = formattedText.replace(
      /<->|<[-–—−]|[-–—−]>/g,
      function (match: string) {
        const normalized =
          match === "<->"
            ? "←→"
            : match.startsWith("<")
              ? "←"
              : "→";

        if (match === normalized) {
          return match;
        }

        replacementCount += 1;
        return normalized;
      }
    );

    formattedText = formattedText.replace(
      /(^|[ \t\u00A0\u202F([{])[-–—−][ \t\u00A0\u202F]*(?=\d)/g,
      function (
        match: string,
        prefix: string,
        offset: number,
        fullText: string
      ) {
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
      }
    );

    formattedText = formattedText.replace(
      /(^|[^0-9A-Za-zА-Яа-яЁё])([+−–—-]?[ \t\u00A0\u202F]*\d+(?:[,.]\d+)?)[ \t\u00A0\u202F]*°?[ \t\u00A0\u202F]*([CFС])(?=$|[ \t\n\r,.;:!?)\]])/g,
      function (match: string, prefix: string, number: string, unit: string) {
        const normalizedUnit = unit === "F" ? "°F" : "°C";
        const normalizedNumber = normalizeSignedNumber(number);
        const normalized = prefix + normalizedNumber + space + normalizedUnit;

        if (match === normalized) {
          return match;
        }

        replacementCount += 1;
        return normalized;
      }
    );

    formattedText = formattedText.replace(
      /(^|[^0-9A-Za-zА-Яа-яЁё])([+−–—-]?[ \t\u00A0\u202F]*\d+(?:[,.]\d+)?)[ \t\u00A0\u202F]*(?:°|deg(?:rees?)?)(?=$|[ \t\n\r,.;:!?)\]])/gi,
      function (match: string, prefix: string, number: string) {
        const normalizedNumber = normalizeSignedNumber(number);
        const normalized = prefix + normalizedNumber + "°";

        if (match === normalized) {
          return match;
        }

        replacementCount += 1;
        return normalized;
      }
    );

    formattedText = formattedText.replace(
      /(\d+(?:[,.]\d+)?)[ \t\u00A0\u202F]*[xXхХ][ \t\u00A0\u202F]*(\d+(?:[,.]\d+)?)/g,
      function (match: string, leftNumber: string, rightNumber: string) {
        const normalized = leftNumber + "×" + rightNumber;

        if (match === normalized) {
          return match;
        }

        replacementCount += 1;
        return normalized;
      }
    );

    formattedText = formattedText.replace(
      /([!?.,;:])\1+/g,
      function (
        match: string,
        punctuation: string,
        offset: number,
        fullText: string
      ) {
        if (
          punctuation === "." &&
          offset > 0 &&
          (fullText[offset - 1] === "?" || fullText[offset - 1] === "!")
        ) {
          return match;
        }

        replacementCount += 1;
        return punctuation;
      }
    );

    return {
      formattedText,
      replacementCount,
    };
  }

  function shouldKeepRussianFinalPeriod(textEndingWithPeriod: string): boolean {
    const protectedAbbreviations =
      /(^|[^А-Яа-яЁёA-Za-z])((?:т\.[ \t\u00A0\u202F]*[екдпчно]\.)|(?:и[ \t\u00A0\u202F]+т\.[ \t\u00A0\u202F]*[дп]\.)|(?:в[ \t\u00A0\u202F]+т\.[ \t\u00A0\u202F]*ч\.)|(?:руб\.|р\.|тыс\.|г\.|ул\.|д\.|стр\.))$/iu;

    return protectedAbbreviations.test(textEndingWithPeriod);
  }

  function shouldKeepEnglishFinalPeriod(textEndingWithPeriod: string): boolean {
    const protectedAbbreviations =
      /(^|[^A-Za-z])((?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|No|Fig|Inc|Ltd|Co|Corp)\.|(?:e\.g\.|i\.e\.|a\.m\.|p\.m\.))$/i;

    const protectedTechnicalEnding =
      /(?:\b[A-Za-z0-9-]+\.[A-Za-z]{2,}|\bv?\d+(?:\.\d+)+)$/i;

    return (
      protectedAbbreviations.test(textEndingWithPeriod) ||
      protectedTechnicalEnding.test(textEndingWithPeriod)
    );
  }

  function shouldKeepFinalPeriod(
    textEndingWithPeriod: string,
    language: LanguageCode
  ): boolean {
    if (language === "unknown") {
      return true;
    }

    return (
      shouldKeepRussianFinalPeriod(textEndingWithPeriod) ||
      shouldKeepEnglishFinalPeriod(textEndingWithPeriod)
    );
  }

  function applyEnglishApostrophesRule(text: string): RuleResult {
    let formattedText = text;
    let replacementCount = 0;

    function replaceAndCount(
      regexp: RegExp,
      replacer: (...args: string[]) => string
    ) {
      formattedText = formattedText.replace(
        regexp,
        function (...args: unknown[]) {
          const stringArgs = args.map((arg) =>
            typeof arg === "string" ? arg : ""
          );

          const match = stringArgs[0];
          const normalized = replacer(...stringArgs);

          if (match === normalized) {
            return match;
          }

          replacementCount += 1;
          return normalized;
        }
      );
    }

    replaceAndCount(
      /([A-Za-z])'([A-Za-z])/g,
      function (_match, beforeApostrophe, afterApostrophe) {
        return beforeApostrophe + "’" + afterApostrophe;
      }
    );

    replaceAndCount(
      /(^|[\s([{—–-])'([nN])'(?=$|[\s.,;:!?)\]}—–-])/g,
      function (_match, prefix, letter) {
        return prefix + "’" + letter + "’";
      }
    );

    replaceAndCount(
      /(^|[\s([{—–-])'(\d{2}s\b)/g,
      function (_match, prefix, decade) {
        return prefix + "’" + decade;
      }
    );

    replaceAndCount(
      /([A-Za-z])'(?=\s+[A-Za-z])/g,
      function (_match, beforeApostrophe) {
        return beforeApostrophe + "’";
      }
    );

    return {
      formattedText,
      replacementCount,
    };
  }

  function applyRussianQuotesRule(
    text: string,
    settings: ApplySettings
  ): RuleResult {
    let formattedText = text;
    let replacementCount = 0;

    const internalPrimaryQuotePair: QuotePair = { opening: "«", closing: "»" };
    const internalSecondaryQuotePair: QuotePair = { opening: "„", closing: "“" };

    const selectedPrimaryQuotePair = getRussianPrimaryQuotePair(settings);
    const selectedSecondaryQuotePair = getRussianSecondaryQuotePair(settings);

    const protectedInnerQuotes: string[] = [];

    function addReplacementResult(result: RuleResult) {
      formattedText = result.formattedText;
      replacementCount += result.replacementCount;
    }

    function replaceAndCount(
      regexp: RegExp,
      replacer: (...args: string[]) => string
    ) {
      formattedText = formattedText.replace(
        regexp,
        function (...args: unknown[]) {
          const stringArgs = args.map((arg) =>
            typeof arg === "string" ? arg : ""
          );

          const match = stringArgs[0];
          const normalized = replacer(...stringArgs);

          if (match === normalized) {
            return match;
          }

          replacementCount += 1;
          return normalized;
        }
      );
    }

    function protectExistingSecondLevelQuotesInsideGuillemets(
      input: string
    ): string {
      return input.replace(
        /«([^«»\n]*?)»/g,
        function (_match: string, quoteContent: string) {
          const protectedQuoteContent = quoteContent.replace(
            /„([^„“\n]+)“/g,
            function (innerQuoteMatch: string) {
              const token =
                "\uE000INNER_QUOTE_" + protectedInnerQuotes.length + "\uE001";

              protectedInnerQuotes.push(innerQuoteMatch);

              return token;
            }
          );

          return "«" + protectedQuoteContent + "»";
        }
      );
    }

    function restoreProtectedInnerQuotes(input: string): string {
      return input.replace(
        /\uE000INNER_QUOTE_(\d+)\uE001/g,
        function (match: string, index: string) {
          return protectedInnerQuotes[Number(index)] || match;
        }
      );
    }

    addReplacementResult(
      replaceQuotePairInText(
        formattedText,
        selectedPrimaryQuotePair,
        internalPrimaryQuotePair
      )
    );

    replaceAndCount(
      /“([^“”\n]*?)‘([^‘’\n]+)’([^“”\n]*?)”/g,
      function (_match, beforeInnerQuote, innerQuoteContent, afterInnerQuote) {
        return (
          "«" +
          beforeInnerQuote +
          "„" +
          innerQuoteContent +
          "“" +
          afterInnerQuote +
          "»"
        );
      }
    );

    replaceAndCount(
      /“([^“”\n]*?)"([^"\n]+)"([^“”\n]*?)”/g,
      function (_match, beforeInnerQuote, innerQuoteContent, afterInnerQuote) {
        return (
          "«" +
          beforeInnerQuote +
          "„" +
          innerQuoteContent +
          "“" +
          afterInnerQuote +
          "»"
        );
      }
    );

    replaceAndCount(
      /"([^"\n]*?)‘([^‘’\n]+)’([^"\n]*?)"/g,
      function (_match, beforeInnerQuote, innerQuoteContent, afterInnerQuote) {
        return (
          "«" +
          beforeInnerQuote +
          "„" +
          innerQuoteContent +
          "“" +
          afterInnerQuote +
          "»"
        );
      }
    );

    addReplacementResult(
      replaceQuotePairInText(
        formattedText,
        selectedSecondaryQuotePair,
        internalSecondaryQuotePair
      )
    );

    formattedText = protectExistingSecondLevelQuotesInsideGuillemets(
      formattedText
    );

    replaceAndCount(
      /(^|[\s([{,.;:!?…—–-])["“„‚‘]([^"“”„«»‚‘’\n]+)["”“‘’](?=$|[\s.,;:!?…)\]}—–-])/g,
      function (_match, prefix, quoteContent) {
        return prefix + "«" + quoteContent + "»";
      }
    );

    formattedText = restoreProtectedInnerQuotes(formattedText);

    replaceAndCount(
      /«([^«»\n]*?)«([^«»\n]+)»([^«»\n]*?)»/g,
      function (_match, beforeInnerQuote, innerQuoteContent, afterInnerQuote) {
        return (
          "«" +
          beforeInnerQuote +
          "„" +
          innerQuoteContent +
          "“" +
          afterInnerQuote +
          "»"
        );
      }
    );

    replaceAndCount(
      /«([^«»\n]*?)»/g,
      function (_match, quoteContent) {
        const normalizedQuoteContent = quoteContent.replace(
          /(["“„‚‘])([^"“”„«»‚‘’\n]+)(["”“‘’])/g,
          function (
            _innerMatch: string,
            _openingQuote: string,
            innerContent: string
          ) {
            return "„" + innerContent + "“";
          }
        );

        return "«" + normalizedQuoteContent + "»";
      }
    );

    replaceAndCount(
      /«([^«»\n]*?)([.,;:])»([.,;:!?…])?/g,
      function (match, quoteContent, innerPunctuation, outerPunctuation) {
        const quoteContentWithPunctuation = quoteContent + innerPunctuation;

        if (
          innerPunctuation === "." &&
          shouldKeepRussianFinalPeriod(quoteContentWithPunctuation)
        ) {
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
      }
    );

    replaceAndCount(
      /«([^«»\n]*?)[ \t\u00A0\u202F]*[-–—−]»([.,;:!?…])?/g,
      function (_match, quoteContent, outerPunctuation) {
        const trimmedQuoteContent = quoteContent.replace(
          /[ \t\u00A0\u202F]+$/g,
          ""
        );

        const punctuation = outerPunctuation || "";

        return "«" + trimmedQuoteContent + "» —" + punctuation;
      }
    );

    addReplacementResult(
      replaceQuotePairInText(
        formattedText,
        internalSecondaryQuotePair,
        selectedSecondaryQuotePair
      )
    );

    addReplacementResult(
      replaceQuotePairInText(
        formattedText,
        internalPrimaryQuotePair,
        selectedPrimaryQuotePair
      )
    );

    return {
      formattedText,
      replacementCount,
    };
  }

  function applyEnglishQuotesRule(
    text: string,
    settings: ApplySettings
  ): RuleResult {
    let formattedText = text;
    let replacementCount = 0;

    const internalPrimaryQuotePair: QuotePair = { opening: "“", closing: "”" };
    const internalSecondaryQuotePair: QuotePair = { opening: "‘", closing: "’" };

    const selectedPrimaryQuotePair = getEnglishPrimaryQuotePair(settings);
    const selectedSecondaryQuotePair = getEnglishSecondaryQuotePair(settings);

    const protectedInnerQuotes: string[] = [];

    function addReplacementResult(result: RuleResult) {
      formattedText = result.formattedText;
      replacementCount += result.replacementCount;
    }

    function replaceAndCount(
      regexp: RegExp,
      replacer: (...args: string[]) => string
    ) {
      formattedText = formattedText.replace(
        regexp,
        function (...args: unknown[]) {
          const stringArgs = args.map((arg) =>
            typeof arg === "string" ? arg : ""
          );

          const match = stringArgs[0];
          const normalized = replacer(...stringArgs);

          if (match === normalized) {
            return match;
          }

          replacementCount += 1;
          return normalized;
        }
      );
    }

    function protectExistingSecondLevelQuotesInsidePrimaryQuotes(
      input: string
    ): string {
      return input.replace(
        /“([^“”\n]*?)”/g,
        function (_match: string, quoteContent: string) {
          const protectedQuoteContent = quoteContent.replace(
            /‘([^‘’\n]+)’/g,
            function (innerQuoteMatch: string) {
              const token =
                "\uE000EN_INNER_QUOTE_" + protectedInnerQuotes.length + "\uE001";

              protectedInnerQuotes.push(innerQuoteMatch);

              return token;
            }
          );

          return "“" + protectedQuoteContent + "”";
        }
      );
    }

    function restoreProtectedInnerQuotes(input: string): string {
      return input.replace(
        /\uE000EN_INNER_QUOTE_(\d+)\uE001/g,
        function (match: string, index: string) {
          return protectedInnerQuotes[Number(index)] || match;
        }
      );
    }

    addReplacementResult(
      replaceQuotePairInText(
        formattedText,
        selectedPrimaryQuotePair,
        internalPrimaryQuotePair
      )
    );

    addReplacementResult(
      replaceQuotePairInText(
        formattedText,
        selectedSecondaryQuotePair,
        internalSecondaryQuotePair
      )
    );

    replaceAndCount(
      /"([^"\n]*?)['‘]([^'‘’"\n]+)['’]([^"\n]*?)"/g,
      function (_match, beforeInnerQuote, innerQuoteContent, afterInnerQuote) {
        return (
          "“" +
          beforeInnerQuote +
          "‘" +
          innerQuoteContent +
          "’" +
          afterInnerQuote +
          "”"
        );
      }
    );

    replaceAndCount(
      /'([^'"\n]*?)"([^"\n]+)"([^'"\n]*?)'/g,
      function (_match, beforeInnerQuote, innerQuoteContent, afterInnerQuote) {
        return (
          "‘" +
          beforeInnerQuote +
          "“" +
          innerQuoteContent +
          "”" +
          afterInnerQuote +
          "’"
        );
      }
    );

    replaceAndCount(
      /(^|[\s([{,.;:!?…—–-])'([^'‘’"\n][^'\n]*?[^'‘’"\n])'(?=$|[\s.,;:!?…)\]}—–-])/g,
      function (_match, prefix, quoteContent) {
        return prefix + "‘" + quoteContent + "’";
      }
    );

    replaceAndCount(
      /«([^«»\n]*?)„([^„“\n]+)“([^«»\n]*?)»/g,
      function (_match, beforeInnerQuote, innerQuoteContent, afterInnerQuote) {
        return (
          "“" +
          beforeInnerQuote +
          "‘" +
          innerQuoteContent +
          "’" +
          afterInnerQuote +
          "”"
        );
      }
    );

    replaceAndCount(
      /«([^«»\n]*?)"([^"\n]+)"([^«»\n]*?)»/g,
      function (_match, beforeInnerQuote, innerQuoteContent, afterInnerQuote) {
        return (
          "“" +
          beforeInnerQuote +
          "‘" +
          innerQuoteContent +
          "’" +
          afterInnerQuote +
          "”"
        );
      }
    );

    replaceAndCount(
      /«([^«»\n]*?)‘([^‘’\n]+)’([^«»\n]*?)»/g,
      function (_match, beforeInnerQuote, innerQuoteContent, afterInnerQuote) {
        return (
          "“" +
          beforeInnerQuote +
          "‘" +
          innerQuoteContent +
          "’" +
          afterInnerQuote +
          "”"
        );
      }
    );

    formattedText =
      protectExistingSecondLevelQuotesInsidePrimaryQuotes(formattedText);

    replaceAndCount(
      /(^|[\s([{,.;:!?…—–-])["“„«]([^"“”„«»\n]+)["”“»](?=$|[\s.,;:!?…)\]}—–-])/g,
      function (_match, prefix, quoteContent) {
        return prefix + "“" + quoteContent + "”";
      }
    );

    formattedText = restoreProtectedInnerQuotes(formattedText);

    replaceAndCount(
      /“([^“”\n]*?)“([^“”\n]+)”([^“”\n]*?)”/g,
      function (_match, beforeInnerQuote, innerQuoteContent, afterInnerQuote) {
        return (
          "“" +
          beforeInnerQuote +
          "‘" +
          innerQuoteContent +
          "’" +
          afterInnerQuote +
          "”"
        );
      }
    );

    replaceAndCount(
      /“([^“”\n]*?)”/g,
      function (_match, quoteContent) {
        const normalizedQuoteContent = quoteContent.replace(
          /(["“„«‚‘])([^"“”„«»‚‘’\n]+)(["”“»‘’])/g,
          function (
            _innerMatch: string,
            _openingQuote: string,
            innerContent: string
          ) {
            return "‘" + innerContent + "’";
          }
        );

        return "“" + normalizedQuoteContent + "”";
      }
    );

    addReplacementResult(
      replaceQuotePairInText(
        formattedText,
        internalSecondaryQuotePair,
        selectedSecondaryQuotePair
      )
    );

    addReplacementResult(
      replaceQuotePairInText(
        formattedText,
        internalPrimaryQuotePair,
        selectedPrimaryQuotePair
      )
    );

    return {
      formattedText,
      replacementCount,
    };
  }

  function applyNumberRangeDashRule(text: string): RuleResult {
    const timeRangeRegexp =
      /(^|[^\d:])(\d{1,2}:\d{2})[ \t\u00A0\u202F]*[-–—−][ \t\u00A0\u202F]*(\d{1,2}:\d{2})(?=$|[^\d:])/g;

    const numberRangeRegexp =
      /(^|[^\d–—−-])(\d{1,4})[ \t\u00A0\u202F]*[-–—−][ \t\u00A0\u202F]*(\d{1,4})(?=$|[^\d–—−-])/g;

    const monthNames =
      "январь|февраль|март|апрель|май|июнь|июль|август|сентябрь|октябрь|ноябрь|декабрь";

    const weekdayNames =
      "понедельник|вторник|среда|четверг|пятница|суббота|воскресенье";

    const monthRangeRegexp = new RegExp(
      "(^|[^А-Яа-яЁё])(" +
        monthNames +
        ")[ \t\u00A0\u202F]*[-–—−][ \t\u00A0\u202F]*(" +
        monthNames +
        ")(?=$|[^А-Яа-яЁё])",
      "giu"
    );

    const weekdayRangeRegexp = new RegExp(
      "(^|[^А-Яа-яЁё])(" +
        weekdayNames +
        ")[ \t\u00A0\u202F]*[-–—−][ \t\u00A0\u202F]*(" +
        weekdayNames +
        ")(?=$|[^А-Яа-яЁё])",
      "giu"
    );

    const romanNumberRangeRegexp =
      /(^|[^A-Za-zА-Яа-яЁё0-9])([IVXLCDM]{1,8})[ \t\u00A0\u202F]*[-–—−][ \t\u00A0\u202F]*([IVXLCDM]{1,8})(?=$|[^A-Za-zА-Яа-яЁё0-9])/g;

    let formattedText = text;
    let replacementCount = 0;

    function replaceRangeAndCount(
      regexp: RegExp,
      getNormalized: (...args: string[]) => string
    ) {
      formattedText = formattedText.replace(
        regexp,
        function (...args: unknown[]) {
          const stringArgs = args.map((arg) =>
            typeof arg === "string" ? arg : ""
          );

          const match = stringArgs[0];
          const normalized = getNormalized(...stringArgs);

          if (match === normalized) {
            return match;
          }

          replacementCount += 1;
          return normalized;
        }
      );
    }

    replaceRangeAndCount(
      timeRangeRegexp,
      function (_match, prefix, startTime, endTime) {
        return prefix + startTime + "–" + endTime;
      }
    );

    replaceRangeAndCount(
      numberRangeRegexp,
      function (_match, prefix, startNumber, endNumber) {
        return prefix + startNumber + "–" + endNumber;
      }
    );

    replaceRangeAndCount(
      monthRangeRegexp,
      function (_match, prefix, startMonth, endMonth) {
        return prefix + startMonth + "–" + endMonth;
      }
    );

    replaceRangeAndCount(
      weekdayRangeRegexp,
      function (_match, prefix, startWeekday, endWeekday) {
        return prefix + startWeekday + "–" + endWeekday;
      }
    );

    replaceRangeAndCount(
      romanNumberRangeRegexp,
      function (_match, prefix, startNumber, endNumber) {
        return prefix + startNumber + "–" + endNumber;
      }
    );

    return {
      formattedText,
      replacementCount,
    };
  }

  function applyRussianSentenceDashRule(text: string): RuleResult {
    const regexp =
      /([А-Яа-яЁёA-Za-z0-9»”’")\].!?…])([ \t\u00A0\u202F]+)[-–—−]([ \t\u00A0\u202F]+)([А-Яа-яЁёA-Za-z0-9«„“"([])/g;

    let replacementCount = 0;

    const formattedText = text.replace(
      regexp,
      function (match, leftChar, _leftSpace, _rightSpace, rightChar) {
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
      }
    );

    return {
      formattedText,
      replacementCount,
    };
  }

  function applyRussianShortWordsNbspRule(
    text: string,
    _settings: ApplySettings
  ): RuleResult {
    const regularNbsp = "\u00A0";

    let formattedText = text;
    let replacementCount = 0;

    function replaceAndCount(
      regexp: RegExp,
      replacer: (...args: string[]) => string
    ) {
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

    const shortWords =
      "а|б|без|безо|бы|в|во|вне|вот|всё|где|да|даже|для|до|если|есть|ещё|же|за|и|из|изо|из-за|из-под|или|иль|к|ко|как|ли|ль|либо|между|на|над|надо|не|ни|но|о|об|обо|около|оно|от|перед|по|по-за|по-над|под|подо|после|при|про|ради|с|со|сквозь|так|также|там|тем|то|тогда|того|тоже|у|хоть|хотя|чего|через|что|чтобы|это";

    const trailingShortWords =
      "в|во|к|ко|о|об|обо|от|по|с|со|у|до|за|из|на|над|под|при|про|для";

    const particles = "б|бы|ж|же|ли|ль";

    const addressAbbreviations =
      "г|обл|кр|ст|пос|с|ул|пер|пр|пр-т|просп|пл|бул|б-р|наб|ш|туп|оф|кв|комн|под|мкр|уч|вл|влад|стр|корп|литер|эт|пт|гл|рис|илл";

    replaceAndCount(
      new RegExp(
        "(^|[ \t\u00A0\u202F(«„“])(" +
          shortWords +
          ")[ \t\u00A0\u202F]+(?=[А-Яа-яЁёA-Za-z0-9\uE100])",
        "giu"
      ),
      function (_match, prefix, word) {
        return prefix + word + regularNbsp;
      }
    );

    replaceAndCount(
      new RegExp(
        "(^|[^А-Яа-яЁёA-Za-z])(" +
          addressAbbreviations +
          ")\\.[ \t\u00A0\u202F]+(?=[А-Яа-яЁёA-Za-z0-9№§])",
        "giu"
      ),
      function (_match, prefix, abbreviation) {
        return prefix + abbreviation + "." + regularNbsp;
      }
    );


    replaceAndCount(
      /(^|[^А-Яа-яЁёA-Za-z])([дД])\.[ \t\u00A0\u202F]+(?=\d)/g,
      function (_match, prefix, abbreviation) {
        return prefix + abbreviation + "." + regularNbsp;
      }
    );
    replaceAndCount(
      /(^|[^А-Яа-яЁёA-Za-z])([тТ])\.[ \t\u00A0\u202F]*([еЕкКдДпПчЧнНоО])\./g,
      function (_match, prefix, firstLetter, secondLetter) {
        return prefix + firstLetter + "." + regularNbsp + secondLetter + ".";
      }
    );

    replaceAndCount(
      /(^|[^А-Яа-яЁёA-Za-z])([иИ])[ \t\u00A0\u202F]+([тТ])\.[ \t\u00A0\u202F]*([дДпП])\./g,
      function (_match, prefix, conjunction, firstLetter, secondLetter) {
        return (
          prefix +
          conjunction +
          regularNbsp +
          firstLetter +
          "." +
          regularNbsp +
          secondLetter +
          "."
        );
      }
    );

    replaceAndCount(
      /(^|[^А-Яа-яЁёA-Za-z])([иИ])[ \t\u00A0\u202F]+([дД]р)\./g,
      function (_match, prefix, conjunction, abbreviation) {
        return prefix + conjunction + regularNbsp + abbreviation + ".";
      }
    );

    replaceAndCount(
      /(^|[^0-9A-Za-zА-Яа-яЁё])([0-9]+(?:[,.][0-9]+)?)[ \t\u00A0\u202F]+(?=[А-Яа-яЁё])/g,
      function (_match, prefix, number) {
        return prefix + number + regularNbsp;
      }
    );

    replaceAndCount(
      new RegExp(
        "([А-Яа-яЁёA-Za-z0-9»”’)])([ \t\u00A0\u202F]+)(" +
          particles +
          ")(?=$|[ \t\u00A0\u202F\n\r,.;:!?…)])",
        "giu"
      ),
      function (_match, previousCharacter, _space, particle) {
        return previousCharacter + regularNbsp + particle;
      }
    );

    replaceAndCount(
      new RegExp(
        "([А-Яа-яЁёA-Za-z0-9»”’)])([ \t\u00A0\u202F]+)(" +
          trailingShortWords +
          ")(?=$|[\n\r,.;:!?…»”’)])",
        "giu"
      ),
      function (_match, previousCharacter, _space, word) {
        return previousCharacter + regularNbsp + word;
      }
    );

    return {
      formattedText,
      replacementCount,
    };
  }

  function applyRussianInitialsNbspRule(
    text: string,
    _settings: ApplySettings
  ): RuleResult {
    const space = "\u00A0";
    let formattedText = text;
    let replacementCount = 0;

    formattedText = formattedText.replace(
      /(^|[^А-Яа-яЁёA-Za-z])([А-ЯЁA-Z])\.[ \t\u00A0\u202F]*([А-ЯЁA-Z])\.[ \t\u00A0\u202F]+([А-ЯЁA-Z][А-Яа-яЁёA-Za-z-]+)/g,
      function (match, prefix, firstInitial, secondInitial, surname) {
        const normalized =
          prefix +
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
      }
    );

    formattedText = formattedText.replace(
      /(^|[^А-Яа-яЁёA-Za-z])([А-ЯЁA-Z])\.[ \t\u00A0\u202F]+([А-ЯЁA-Z][А-Яа-яЁёA-Za-z-]+)/g,
      function (match, prefix, initial, surname) {
        const normalized = prefix + initial + "." + space + surname;

        if (match === normalized) {
          return match;
        }

        replacementCount += 1;
        return normalized;
      }
    );

    return {
      formattedText,
      replacementCount,
    };
  }

  function applyRussianNumericAbbreviationsRule(text: string): RuleResult {
    let formattedText = text;
    let replacementCount = 0;

    function replaceAndCount(
      regexp: RegExp,
      replacer: (...args: string[]) => string
    ) {
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

    replaceAndCount(
      /(^|[^А-Яа-яЁёA-Za-z])((?:млн|млрд|трлн))\.(?=$|[ \t\u00A0\u202F\n\r,.;:!?…),])/giu,
      function (_match, prefix, abbreviation) {
        return prefix + abbreviation;
      }
    );

    replaceAndCount(
      /(^|[^А-Яа-яЁёA-Za-z])([тТ]ыс)(?!\.)(?=$|[ \t\u00A0\u202F\n\r,;:!?…),])/g,
      function (_match, prefix, abbreviation) {
        return prefix + abbreviation + ".";
      }
    );

    return {
      formattedText,
      replacementCount,
    };
  }

  function applyRussianLargeNumbersRule(
    text: string,
    settings: ApplySettings
  ): RuleResult {
    const space = getConfiguredNbsp(settings);

    const regexp =
      /(^|[^0-9A-Za-zА-Яа-яЁё])([0-9](?:[0-9 \t\u00A0\u202F]*[0-9]){4,})(?=$|[^0-9A-Za-zА-Яа-яЁё,.-])/g;

    let replacementCount = 0;

    const formattedText = text.replace(
      regexp,
      function (match, prefix, numberWithPossibleSpaces) {
        const rawNumber = numberWithPossibleSpaces.replace(
          /[ \t\u00A0\u202F]/g,
          ""
        );

        if (rawNumber.length < 5) {
          return match;
        }

        const formattedNumber = rawNumber.replace(
          /\B(?=([0-9]{3})+(?![0-9]))/g,
          space
        );

        const normalized = prefix + formattedNumber;

        if (match === normalized) {
          return match;
        }

        replacementCount += 1;
        return normalized;
      }
    );

    return {
      formattedText,
      replacementCount,
    };
  }

  function applyUiFinalPeriodRule(
    text: string,
    _settings: ApplySettings,
    language: LanguageCode
  ): RuleResult {
    let replacementCount = 0;

    function normalizeLine(line: string): string {
      const trailingWhitespaceMatch = line.match(/[ \t\u00A0\u202F]*$/);
      const trailingWhitespace = trailingWhitespaceMatch
        ? trailingWhitespaceMatch[0]
        : "";

      const lineWithoutTrailingWhitespace = line.slice(
        0,
        line.length - trailingWhitespace.length
      );

      const closingCharacters = "»”\"’“‘)]}";
      const lastCharacter = lineWithoutTrailingWhitespace.slice(-1);
      const beforeLastCharacter = lineWithoutTrailingWhitespace.slice(0, -1);

      if (
        closingCharacters.includes(lastCharacter) &&
        beforeLastCharacter.endsWith(".")
      ) {
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

    const formattedText = text.replace(
      /([^\r\n]*)(\r\n|\n|\r|$)/g,
      function (match: string, line: string, lineEnding: string) {
        if (match === "") {
          return match;
        }

        return normalizeLine(line) + lineEnding;
      }
    );

    return {
      formattedText,
      replacementCount,
    };
  }

  const TYPOGRAPHY_RULES: TypographyRule[] = [
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

  function isRuleSupportedForLanguage(
    rule: TypographyRule,
    language: LanguageCode
  ): boolean {
    if (rule.supportedLanguages === "all") {
      return true;
    }

    return rule.supportedLanguages.includes(language);
  }

  export type ProtectedTextFragment = {
    token: string;
    value: string;
  };

  const PROTECTED_TEXT_TOKEN_START = "\uE100";

  const PROTECTED_TEXT_TOKEN_END = "\uE101";

  const PROTECTED_TEXT_TOKEN_CHAR_OFFSET = 0xe200;

  function createProtectedTextToken(index: number): string {
    return (
      PROTECTED_TEXT_TOKEN_START +
      String.fromCharCode(PROTECTED_TEXT_TOKEN_CHAR_OFFSET + index) +
      PROTECTED_TEXT_TOKEN_END
    );
  }

  function splitTrailingPunctuation(value: string): {
    protectedValue: string;
    trailingPunctuation: string;
  } {
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

  function protectTextFragments(text: string): {
    protectedText: string;
    fragments: ProtectedTextFragment[];
  } {
    const fragments: ProtectedTextFragment[] = [];
    let protectedText = text;

    function protectValue(value: string, trailingPunctuation = ""): string {
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

    function protectByRegexp(regexp: RegExp) {
      protectedText = protectedText.replace(regexp, function (match: string) {
        const { protectedValue, trailingPunctuation } =
          splitTrailingPunctuation(match);

        return protectValue(protectedValue, trailingPunctuation);
      });
    }

    function protectExactByRegexp(regexp: RegExp) {
      protectedText = protectedText.replace(regexp, function (match: string) {
        return protectValue(match);
      });
    }

    function isRomanNumeralRange(value: string): boolean {
      return /^[IVXLCDM]{1,8}[-–—−][IVXLCDM]{1,8}$/.test(value);
    }

    function protectCodeLikeTokensByRegexp(regexp: RegExp) {
      protectedText = protectedText.replace(regexp, function (match: string) {
        if (isRomanNumeralRange(match)) {
          return match;
        }

        const { protectedValue, trailingPunctuation } =
          splitTrailingPunctuation(match);

        return protectValue(protectedValue, trailingPunctuation);
      });
    }

    function protectHtmlLikeTags() {
      protectByRegexp(
        /<\/?[A-Za-z][A-Za-z0-9:-]*(?:\s+[A-Za-z_:][A-Za-z0-9:._-]*(?:=(?:"[^"\n]*"|'[^'\n]*'|[^\s"'=<>`]+))?)*\s*\/?>/g
      );
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
        } else if (character === "}" && depth > 0) {
          depth -= 1;

          if (depth === 0 && placeholderStart >= 0) {
            const placeholderEnd = index + 1;
            const placeholder = protectedText.slice(
              placeholderStart,
              placeholderEnd
            );

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

    function hasCurrencyContext(textFragment: string): boolean {
      return /(?:цена|стоимость|стоить|стоит|стоили|тариф|подписк|скидк|плат[её]ж|оплат|за|от|до|price|cost|costs|subscription|discount|plan|payment|from|to)/iu.test(
        textFragment
      );
    }

    function protectDollarPlaceholders() {
      protectedText = protectedText.replace(
        /\$\d+\b/g,
        function (match: string, offset: number, fullText: string) {
          const contextWindow = 32;
          const localContext =
            fullText.slice(Math.max(0, offset - contextWindow), offset) +
            " " +
            fullText.slice(
              offset + match.length,
              Math.min(fullText.length, offset + match.length + contextWindow)
            );

          if (hasCurrencyContext(localContext)) {
            return match;
          }

          return protectValue(match);
        }
      );
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

  function restoreProtectedTextFragments(
    text: string,
    fragments: ProtectedTextFragment[]
  ): string {
    let restoredText = text;

    for (const fragment of fragments) {
      restoredText = restoredText.split(fragment.token).join(fragment.value);
    }

    restoredText = restoredText.replace(
      /([,.;:!?…])[ \t\u00A0\u202F]+(<\/[A-Za-z][A-Za-z0-9:-]*>)/g,
      "$1$2"
    );

    restoredText = restoredText.replace(
      /(&(?:nbsp|#160|#x202F);)[ \t\u00A0\u202F]+/gi,
      "$1"
    );

    return restoredText;
  }


  function repairSplitRubleFractionalAmountsAfterAllRules(
    text: string,
    settings: ApplySettings,
    language: LanguageCode
  ): RuleResult {
    const space = getConfiguredNbsp(settings);
    let replacementCount = 0;

    function isSentenceBoundaryAt(index: number, fullText: string): boolean {
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

    function resolveRepairLanguage(offset: number, fullText: string): "ru" | "en" {
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

    const formattedText = text.replace(
      /(^|[ \t\u00A0\u202F([{«„“"'\uE101])([+−]?\d+)[ \t\u00A0\u202F]*₽[ \t\u00A0\u202F]*[,.](\d{1,2})(?=$|[ \t\n\r,.;:!?…)\]}»”’\uE100])/gu,
      function (
        match: string,
        prefix: string,
        rubles: string,
        kopecks: string,
        offset: number,
        fullText: string
      ) {
        const repairLanguage = resolveRepairLanguage(offset, fullText);
        const isNegative = rubles.startsWith("−");
        const unsignedRubles = isNegative ? rubles.slice(1) : rubles;
        const normalized =
          repairLanguage === "en"
            ? prefix + (isNegative ? "−" : "") + "₽" + unsignedRubles + "." + kopecks
            : prefix + rubles + "," + kopecks + space + "₽";

        if (match === normalized) {
          return match;
        }

        replacementCount += 1;
        return normalized;
      }
    );

    return {
      formattedText,
      replacementCount,
    };
  }

  export function applyRulesToText(
    text: string,
    settings: ApplySettings,
    language: LanguageCode
  ): RuleResult & { skippedRuleCount: number } {
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
      const splitRubleRepairResult = repairSplitRubleFractionalAmountsAfterAllRules(
        formattedText,
        settings,
        language
      );

      formattedText = splitRubleRepairResult.formattedText;
      replacementCount += splitRubleRepairResult.replacementCount;
    }

    return {
      formattedText: restoreProtectedTextFragments(formattedText, fragments),
      replacementCount,
      skippedRuleCount,
    };
  }
}
