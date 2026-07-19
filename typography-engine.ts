namespace TypotypoEngine {
  export type Language = "ru" | "en" | "unknown";
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
    open: string;
    close: string;
  };

  export type QuoteOptionsByLanguage = {
    primaryQuoteStyle: QuoteStyle;
    secondaryQuoteStyle: QuoteStyle;
  };

  export type ApplySettings = {
    languageMode: LanguageMode;
    options: {
      nonBreakingSpaceStyle: NonBreakingSpaceStyle;
      quoteOptions: {
        ru: QuoteOptionsByLanguage;
        en: QuoteOptionsByLanguage;
      };
    };
    enabledRules: {
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
  };

  export type LanguageStats = Record<Language, number>;

  export type ApplyRulesResult = {
    formattedText: string;
    replacementCount: number;
    skippedRuleCount: number;
  };

  const REGULAR_NBSP = "\u00A0";
  const NARROW_NBSP = "\u202F";

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

  type ProtectedSegment = {
    token: string;
    value: string;
  };

  function cloneDefaultSettings(): ApplySettings {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as ApplySettings;
  }

  function isBoolean(value: unknown): value is boolean {
    return typeof value === "boolean";
  }

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

  export function normalizeSettings(input: unknown): ApplySettings {
    const result = cloneDefaultSettings();

    if (!input || typeof input !== "object") {
      return result;
    }

    const raw = input as Partial<ApplySettings> & {
      enabledRules?: Partial<ApplySettings["enabledRules"]> & {
        russianNumberRangeDash?: boolean;
        spacesBeforePunctuation?: boolean;
        spacesAfterPunctuation?: boolean;
      };
    };

    if (isLanguageMode(raw.languageMode)) {
      result.languageMode = raw.languageMode;
    }

    if (raw.options && typeof raw.options === "object") {
      if (isNonBreakingSpaceStyle(raw.options.nonBreakingSpaceStyle)) {
        result.options.nonBreakingSpaceStyle = raw.options.nonBreakingSpaceStyle;
      }

      const quoteOptions = raw.options.quoteOptions;

      if (quoteOptions && typeof quoteOptions === "object") {
        for (const language of ["ru", "en"] as const) {
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
      for (const key of Object.keys(result.enabledRules) as Array<
        keyof ApplySettings["enabledRules"]
      >) {
        const value = raw.enabledRules[key];

        if (isBoolean(value)) {
          result.enabledRules[key] = value;
        }
      }

      if (
        !isBoolean(raw.enabledRules.numberRangeDash) &&
        isBoolean(raw.enabledRules.russianNumberRangeDash)
      ) {
        result.enabledRules.numberRangeDash =
          raw.enabledRules.russianNumberRangeDash;
      }

      if (!isBoolean(raw.enabledRules.spacingCleanup)) {
        if (
          raw.enabledRules.spacesBeforePunctuation === false &&
          raw.enabledRules.spacesAfterPunctuation !== true
        ) {
          result.enabledRules.spacingCleanup = false;
        }
      }
    }

    return result;
  }

  export function resolveLanguage(
    text: string,
    languageMode: LanguageMode
  ): Language {
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

  export function applyRulesToText(
    originalText: string,
    settings: ApplySettings,
    language: Language
  ): ApplyRulesResult {
    const safeSettings = normalizeSettings(settings);
    const enabledRules = safeSettings.enabledRules;
    const cleanedOriginalText = enabledRules.invisibleCopyArtifacts
      ? removeInvisibleCopyArtifacts(originalText)
      : originalText;
    const protectedText = protectSegments(cleanedOriginalText);

    let text = protectedText.text;
    let replacementCount = cleanedOriginalText !== originalText ? 1 : 0;
    let skippedRuleCount = 0;

    function applyRule(
      enabled: boolean,
      allowedLanguages: Language[] | null,
      rule: (value: string) => string
    ) {
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
    applyRule(enabledRules.englishQuotes, ["en"], (value) =>
      normalizeEnglishQuotes(value, safeSettings.options.quoteOptions.en)
    );
    applyRule(enabledRules.russianQuotes, ["ru"], (value) =>
      normalizeQuotes(value, safeSettings.options.quoteOptions.ru)
    );
    applyRule(enabledRules.manualLineBreaks, null, normalizeManualLineBreaks);
    applyRule(enabledRules.ellipsis, null, normalizeEllipsis);
    applyRule(enabledRules.percentSignNoSpace, null, normalizePercentSign);
    applyRule(enabledRules.specialSymbols, null, normalizeSpecialSymbols);
    applyRule(enabledRules.numberSigns, null, normalizeNumberSigns);
    applyRule(enabledRules.numberRangeDash, null, normalizeNumberRanges);
    applyRule(enabledRules.numberUnitsNbsp, null, (value) =>
      normalizeNumberUnits(value, getNumericNbsp(safeSettings))
    );
    applyRule(enabledRules.russianNumericAbbreviations, ["ru"], (value) =>
      normalizeRussianNumericAbbreviations(value, getNumericNbsp(safeSettings))
    );
    applyRule(enabledRules.russianLargeNumbers, ["ru"], (value) =>
      normalizeRussianLargeNumbers(value, getNumericNbsp(safeSettings))
    );
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

  function getNumericNbsp(settings: ApplySettings): string {
    return settings.options.nonBreakingSpaceStyle === "narrow"
      ? NARROW_NBSP
      : REGULAR_NBSP;
  }

  function protectSegments(text: string): {
    text: string;
    segments: ProtectedSegment[];
  } {
    const segments: ProtectedSegment[] = [];

    function protectValue(value: string): string {
      const token = `\uE000${segments.length}\uE001`;
      segments.push({ token, value });
      return token;
    }

    function protectBalancedBraces(value: string): string {
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
    const protectedPattern =
      /https?:\/\/[^\s<()]+|www\.[^\s<()]+|\b(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}(?:\/[^\s<()]*)?|[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|`[^`]*`|<!--[\s\S]*?-->|<\/?[A-Za-z][A-Za-z0-9:-]*(?:\s+[^\r\n<>]*?)?\s*\/?>|&[#A-Za-z0-9]+;|\{[^{}]*\}|\b[A-Za-z][A-Za-z0-9]*(?:[._/-][A-Za-z0-9]+){2,}\b/g;

    const protectedValue = bracesProtectedValue.replace(
      protectedPattern,
      (value) => protectValue(value)
    );

    return {
      text: protectedValue,
      segments,
    };
  }

  function restoreSegments(text: string, segments: ProtectedSegment[]): string {
    let restoredText = text;

    for (let index = segments.length - 1; index >= 0; index -= 1) {
      const segment = segments[index];
      restoredText = restoredText.split(segment.token).join(segment.value);
    }

    return restoredText;
  }

  function isEmojiJoinBase(codePoint: number): boolean {
    return (
      codePoint === 0x00a9 ||
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
      (codePoint >= 0x1f000 && codePoint <= 0x1faff)
    );
  }

  function isEmojiVariationOrModifier(codePoint: number): boolean {
    return (
      codePoint === 0xfe0e ||
      codePoint === 0xfe0f ||
      (codePoint >= 0x1f3fb && codePoint <= 0x1f3ff)
    );
  }

  function findEmojiBaseBefore(characters: string[], index: number): number | null {
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

  function findEmojiBaseAfter(characters: string[], index: number): number | null {
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

  function removeInvisibleCopyArtifacts(text: string): string {
    const characters = Array.from(text);

    return characters
      .filter((character, index) => {
        const codePoint = character.codePointAt(0);

        if (codePoint === 0x200d) {
          return (
            findEmojiBaseBefore(characters, index) !== null &&
            findEmojiBaseAfter(characters, index) !== null
          );
        }

        return (
          codePoint !== 0x200b &&
          codePoint !== 0x200c &&
          codePoint !== 0x2060 &&
          codePoint !== 0xfeff
        );
      })
      .join("");
  }

  function normalizeTabs(text: string): string {
    return text.replace(/\t/g, " ");
  }

  function normalizeManualLineBreaks(text: string): string {
    const paragraphBreaks: string[] = [];

    const withProtectedParagraphs = text.replace(/\n{2,}/g, (value) => {
      const token = `\uE100${paragraphBreaks.length}\uE101`;
      paragraphBreaks.push(value);
      return token;
    });

    const normalized = withProtectedParagraphs.replace(/[ \t]*\n[ \t]*/g, " ");

    return paragraphBreaks.reduce(
      (value, paragraphBreak, index) =>
        value.split(`\uE100${index}\uE101`).join(paragraphBreak),
      normalized
    );
  }

  function normalizeEllipsis(text: string): string {
    return text.replace(/\.{3,}/g, "…");
  }

  function normalizePercentSign(text: string): string {
    return text.replace(/(\d)[ \t\u00A0\u202F]+%/g, "$1%");
  }

  function normalizeInchMarks(text: string): string {
    return text.replace(
      /(^|[^"\d])(\d+(?:[.,]\d+)?)"(?=$|[ \t\n.,;:!?)}\]"'«»„“”‘’‚])/g,
      "$1$2″"
    );
  }

  function normalizeSpecialSymbols(text: string): string {
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

    const fractions: Array<[RegExp, string]> = [
      [/(^|[^\d/])1\/2(?![\d/])/g, "½"],
      [/(^|[^\d/])1\/3(?![\d/])/g, "⅓"],
      [/(^|[^\d/])2\/3(?![\d/])/g, "⅔"],
      [/(^|[^\d/])1\/4(?![\d/])/g, "¼"],
      [/(^|[^\d/])3\/4(?![\d/])/g, "¾"],
    ];

    return fractions.reduce(
      (value, [pattern, replacement]) =>
        value.replace(pattern, (_match, prefix) => `${prefix}${replacement}`),
      withBasicSymbols
    );
  }

  function normalizeNumberSigns(text: string): string {
    return text.replace(/([№§])\s*(\d)/g, `$1${REGULAR_NBSP}$2`);
  }

  function normalizeNumberRanges(text: string): string {
    const spaces = "[ \t\u00A0\u202F]*";
    const number = "[+-]?\\d+(?:[,.]\\d+)?";

    const numberSignChainPattern = new RegExp(
      `([№§]${spaces})(${number}(?:${spaces}[-–—]${spaces}${number})+)(?![+\-–—0-9A-Za-zА-Яа-яЁё])`,
      "g"
    );

    const afterNumberSigns = text.replace(
      numberSignChainPattern,
      (_match, signWithSpace: string, chain: string) => {
        const rangeMatch = chain.match(
          new RegExp(`^(${number})${spaces}[-–—]${spaces}(${number})$`)
        );

        if (!rangeMatch) {
          return `${signWithSpace}${chain}`;
        }

        return `${signWithSpace}${rangeMatch[1]}–${rangeMatch[2]}`;
      }
    );

    const numericChainPattern =
      /(^|[^+\-–—0-9A-Za-zА-Яа-яЁё])([+-]?\d+(?:[,.]\d+)?(?:[ \t\u00A0\u202F]*[-–—][ \t\u00A0\u202F]*[+-]?\d+(?:[,.]\d+)?)+)(?![+\-–—0-9A-Za-zА-Яа-яЁё])/g;

    return afterNumberSigns.replace(
      numericChainPattern,
      (_match, prefix: string, chain: string) => {
        const rangeMatch = chain.match(
          /^([+-]?\d+(?:[,.]\d+)?)([ \t\u00A0\u202F]*)([-–—])([ \t\u00A0\u202F]*)([+-]?\d+(?:[,.]\d+)?)$/
        );

        if (!rangeMatch) {
          return `${prefix}${chain}`;
        }

        const [, start, spacesBefore, separator, spacesAfter, end] = rangeMatch;

        if (separator === "-" && (spacesBefore || spacesAfter)) {
          return `${prefix}${chain}`;
        }

        return `${prefix}${start}–${end}`;
      }
    );
  }

  function normalizeNumberUnits(text: string, nbsp: string): string {
    const unitPattern =
      /(\d+(?:[,.]\d+)?)[ \t\u00A0\u202F]*(км|м|см|мм|кг|г|мг|л|мл|КБ|МБ|ГБ|ТБ|kb|mb|gb|tb|px|dp|pt|rem|em|сек|с|мин|ч|дн|шт)(?=$|[\s,.;:!?)]|\uE000)/gi;

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

  function normalizeRussianNumericAbbreviations(text: string, nbsp: string): string {
    return text
      .replace(/(\d+(?:[,.]\d+)?)[ \t\u00A0\u202F]*(тыс)(?:\.|(?=\s|$|[,!?:;)]))/gi, (_match, number, abbreviation) => `${number}${nbsp}${abbreviation}.`)
      .replace(/(\d+(?:[,.]\d+)?)[ \t\u00A0\u202F]*(млн|млрд|трлн)\.?(?=\s|$|[,.!?:;)])/gi, (_match, number, abbreviation) => `${number}${nbsp}${abbreviation}`);
  }

  function normalizeRussianLargeNumbers(text: string, nbsp: string): string {
    const groupSeparator = nbsp;

    function formatLargeNumber(value: string): string {
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

  function normalizeEnglishApostrophes(text: string): string {
    const protectedDelimiters: string[] = [];
    const delimiterPositions = new Set<number>();

    function isOpeningDelimiterPosition(value: string, index: number): boolean {
      const previousCharacter = value[index - 1];
      const nextCharacter = value[index + 1];

      const followingText = value.slice(index + 1);

      return (
        (index === 0 || /[\s([{<—–-]/.test(previousCharacter)) &&
        /[A-Za-z]/.test(nextCharacter || "") &&
        !/^(?:cause|em)\b/i.test(followingText)
      );
    }

    function findClosingDelimiter(value: string, openingIndex: number): number {
      for (let index = openingIndex + 1; index < value.length; index += 1) {
        if (value[index] !== "'") {
          continue;
        }

        const previousCharacter = value[index - 1] || "";
        const nextCharacter = value[index + 1] || "";

        if (/[A-Za-z]/.test(previousCharacter) && /[A-Za-z]/.test(nextCharacter)) {
          continue;
        }

        if (
          /[A-Za-z]/.test(previousCharacter) &&
          (index === value.length - 1 || /[\s.,;:!?)}\]>—–-]/.test(nextCharacter))
        ) {
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

    return protectedDelimiters.reduce(
      (value, delimiter, index) =>
        value.split(`\uE200${index}\uE201`).join(delimiter),
      normalized
    );
  }

  function getQuotePair(style: QuoteStyle): QuotePair {
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

  function isOpeningQuotePosition(text: string, index: number): boolean {
    const previousCharacter = text[index - 1];

    return (
      index === 0 ||
      /[\s([{<—–-]/.test(previousCharacter) ||
      previousCharacter === REGULAR_NBSP ||
      previousCharacter === NARROW_NBSP
    );
  }

  type QuoteKind = "double" | "single";

  type QuoteStackItem = {
    index: number;
    depth: number;
    kind: QuoteKind;
  };

  type QuotePairMatch = {
    start: number;
    end: number;
    depth: number;
  };

  function normalizeQuotePairs(
    text: string,
    options: QuoteOptionsByLanguage
  ): string {
    const primaryQuotePair = getQuotePair(options.primaryQuoteStyle);
    const secondaryQuotePair = getQuotePair(options.secondaryQuoteStyle);
    const doubleQuoteCharacters = new Set(["\"", "«", "»", "„", "“", "”"]);
    const singleQuoteCharacters = new Set(["'", "‘", "’", "‚"]);

    function getQuoteKind(character: string): QuoteKind | null {
      if (doubleQuoteCharacters.has(character)) {
        return "double";
      }

      if (singleQuoteCharacters.has(character)) {
        return "single";
      }

      return null;
    }

    function isQuoteCharacter(character: string): boolean {
      return getQuoteKind(character) !== null;
    }

    function getTokenBounds(value: string, index: number): [number, number] {
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

    function isInsideEmailLikeToken(value: string, index: number): boolean {
      const [start, end] = getTokenBounds(value, index);
      const token = value.slice(start, end);

      return token.includes("@") && /@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(token);
    }

    function previousNonSpaceIndex(value: string, index: number): number {
      for (let current = index - 1; current >= 0; current -= 1) {
        if (!/\s/.test(value[current])) {
          return current;
        }
      }

      return -1;
    }

    function nextNonSpaceIndex(value: string, index: number): number {
      for (let current = index + 1; current < value.length; current += 1) {
        if (!/\s/.test(value[current])) {
          return current;
        }
      }

      return -1;
    }

    function hasLaterSingleQuote(value: string, index: number): boolean {
      for (let current = index + 1; current < value.length; current += 1) {
        if (
          singleQuoteCharacters.has(value[current]) &&
          value[current - 1] !== "\\"
        ) {
          return true;
        }
      }

      return false;
    }

    function isLikelyApostrophe(
      value: string,
      index: number,
      stack: QuoteStackItem[]
    ): boolean {
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
      const followedByAnotherWord =
        /\s/.test(nextCharacter) &&
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

    function collectQuotePairs(value: string): QuotePairMatch[] {
      const pairs: QuotePairMatch[] = [];
      const stack: QuoteStackItem[] = [];

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

        const openingSignal =
          nextIndex >= 0 &&
          (previousIndex < 0 ||
            /\s/.test(immediatePrevious) ||
            /[([{<—–,:;!?-]/.test(previousCharacter) ||
            isQuoteCharacter(immediatePrevious));

        const closingSignal =
          previousIndex >= 0 &&
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

        const strongClosing =
          nextIndex < 0 ||
          isQuoteCharacter(immediateNext) ||
          /[.,;:!?…\])}>—–-]/.test(nextCharacter);

        const strongOpening =
          openingSignal &&
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
        const replacements = new Map<number, string>();
        const quotePairs = collectQuotePairs(line);

        for (const pair of quotePairs) {
          const quotePair =
            pair.depth % 2 === 0 ? primaryQuotePair : secondaryQuotePair;
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

  function normalizeEnglishQuotes(
    text: string,
    options: QuoteOptionsByLanguage
  ): string {
    return normalizeQuotePairs(text, options);
  }

  function normalizeQuotes(
    text: string,
    options: QuoteOptionsByLanguage
  ): string {
    return normalizeQuotePairs(text, options);
  }

  function normalizeRussianSentenceDash(text: string): string {
    const tokenSpacePattern = /[ \t\r\n\u00A0\u202F]/;

    const getTokenBefore = (value: string, endIndex: number): string => {
      let startIndex = endIndex - 1;

      while (startIndex >= 0 && !tokenSpacePattern.test(value[startIndex])) {
        startIndex -= 1;
      }

      return value.slice(startIndex + 1, endIndex);
    };

    const getTokenAfter = (value: string, startIndex: number): string => {
      let endIndex = startIndex;

      while (endIndex < value.length && !tokenSpacePattern.test(value[endIndex])) {
        endIndex += 1;
      }

      return value.slice(startIndex, endIndex);
    };

    const cleanToken = (token: string): string =>
      token
        .replace(/^[([{«„“"']+/, "")
        .replace(/[)\]}»“”"'.,;:!?…]+$/, "");

    const shouldKeepSeparator = (
      value: string,
      leftTokenEnd: number,
      rightTokenStart: number
    ): boolean => {
      const leftToken = cleanToken(getTokenBefore(value, leftTokenEnd));
      const rightToken = cleanToken(getTokenAfter(value, rightTokenStart));
      const numericTokenPattern = /^[+-]?\d+(?:[.,]\d+)?$/;
      const latinVariablePattern = /^[A-Za-z]$/;

      return (
        (numericTokenPattern.test(leftToken) &&
          numericTokenPattern.test(rightToken)) ||
        (latinVariablePattern.test(leftToken) &&
          latinVariablePattern.test(rightToken))
      );
    };

    const withSpacesOnBothSides =
      /([^\s])([ \t\u00A0\u202F]+)[-–—]([ \t\u00A0\u202F]+)([^\s])/g;

    const withNbspBeforeEmDash =
      /([^\s])([\u00A0\u202F])—([ \t\u00A0\u202F]*)([^\s])/g;

    return text
      .replace(
        withSpacesOnBothSides,
        (match, leftCharacter, leftSpaces, rightSpaces, rightCharacter, offset, value) => {
          const leftTokenEnd = offset + 1;
          const rightTokenStart =
            offset + 1 + leftSpaces.length + 1 + rightSpaces.length;

          if (shouldKeepSeparator(value, leftTokenEnd, rightTokenStart)) {
            return match;
          }

          return `${leftCharacter}${REGULAR_NBSP}— ${rightCharacter}`;
        }
      )
      .replace(
        withNbspBeforeEmDash,
        (match, leftCharacter, _nbsp, spacesAfter, rightCharacter, offset, value) => {
          const leftTokenEnd = offset + 1;
          const rightTokenStart = offset + 1 + 1 + 1 + spacesAfter.length;

          if (shouldKeepSeparator(value, leftTokenEnd, rightTokenStart)) {
            return match;
          }

          return `${leftCharacter}${REGULAR_NBSP}— ${rightCharacter}`;
        }
      );
  }

  function normalizeRussianInitials(text: string): string {
    const initialsBeforeSurname =
      /(^|[^А-Яа-яЁё])([А-ЯЁ])\.[ \t\u00A0\u202F]*(?:([А-ЯЁ])\.[ \t\u00A0\u202F]*)?([А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?)/g;

    const surnameBeforeInitials =
      /(^|[^А-Яа-яЁё])([А-ЯЁ][а-яё]+(?:-[А-ЯЁ][а-яё]+)?)[ \t\u00A0\u202F]+([А-ЯЁ])\.[ \t\u00A0\u202F]*(?:([А-ЯЁ])\.)?(?=$|[ \t\u00A0\u202F]*[,;:!?)]|\n)/g;

    return text
      .replace(
        initialsBeforeSurname,
        (_match, prefix, firstInitial, secondInitial, familyName) =>
          secondInitial
            ? `${prefix}${firstInitial}.${REGULAR_NBSP}${secondInitial}.${REGULAR_NBSP}${familyName}`
            : `${prefix}${firstInitial}.${REGULAR_NBSP}${familyName}`
      )
      .replace(
        surnameBeforeInitials,
        (_match, prefix, familyName, firstInitial, secondInitial) =>
          secondInitial
            ? `${prefix}${familyName}${REGULAR_NBSP}${firstInitial}.${REGULAR_NBSP}${secondInitial}.`
            : `${prefix}${familyName}${REGULAR_NBSP}${firstInitial}.`
      );
  }

  function normalizeRussianShortWords(text: string): string {
    const shortWords =
      "а|в|во|и|к|ко|с|со|у|о|об|обо|от|до|из|за|на|не|но|по|под|над|при|про|для|без|или|же|ли|бы";
    const horizontalSpacing = `[ \t${REGULAR_NBSP}${NARROW_NBSP}]`;

    const openingDelimiters = `[([{«„“‘‚"]*`;
    const shortWordPatternSource =
      `(^|[ \t${REGULAR_NBSP}${NARROW_NBSP}([{«„“])` +
      `(${shortWords})(${horizontalSpacing}+)(?=${openingDelimiters}[А-Яа-яЁёA-Za-z0-9])`;

    const abbreviationSpacing = `${horizontalSpacing}*`;
    const abbreviationBoundary = `(^|[^А-Яа-яЁё])`;

    const normalizeTwoPartAbbreviation = (
      input: string,
      first: string,
      second: string
    ) =>
      input.replace(
        new RegExp(
          `${abbreviationBoundary}${first}\\.${abbreviationSpacing}${second}\\.`,
          "gi"
        ),
        (_match, prefix) =>
          `${prefix}${first}.${REGULAR_NBSP}${second}.`
      );

    let result = text;

    result = normalizeTwoPartAbbreviation(result, "т", "е");
    result = normalizeTwoPartAbbreviation(result, "т", "к");
    result = normalizeTwoPartAbbreviation(result, "т", "д");
    result = normalizeTwoPartAbbreviation(result, "т", "п");

    result = result.replace(
      new RegExp(
        `${abbreviationBoundary}в${horizontalSpacing}+т\\.${abbreviationSpacing}ч\\.`,
        "gi"
      ),
      (_match, prefix) =>
        `${prefix}в${REGULAR_NBSP}т.${REGULAR_NBSP}ч.`
    );

    result = result
      .replace(
        /(^|[\s([{«„“])(г-н|г-жа|г-да|тов\.)[ \t\u00A0\u202F]+(?=[А-ЯЁA-Z])/g,
        `$1$2${REGULAR_NBSP}`
      )
      .replace(
        /(^|[\s([{«„“])(г\.|ул\.|пр-т|просп\.|пер\.|пл\.|о-в|о-ва|р-н|обл\.|с\.|д\.)[ \t\u00A0\u202F]+(?=[А-ЯЁA-Z])/g,
        `$1$2${REGULAR_NBSP}`
      )
      .replace(
        /(^|[\s([{«„“])(гл\.|рис\.|табл\.|стр\.|с\.|п\.|ч\.|разд\.|подп\.)[ \t\u00A0\u202F]+(?=[0-9IVXLCDM])/gi,
        `$1$2${REGULAR_NBSP}`
      );

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

  function normalizeSpacing(text: string): string {
    const withoutSpacesBeforePunctuation = text.replace(
      /[ \t\u00A0\u202F]+([,.;:!?])/g,
      "$1"
    );

    const afterCommaSemicolonOrColon = withoutSpacesBeforePunctuation.replace(
      /([,;:])([ \t\u00A0\u202F]*)(?=([^\s]))/g,
      (_match, punctuation, _spaces, nextCharacter, offset, source) => {
        const previousCharacter = source[offset - 1] || "";

        if (
          punctuation !== ";" &&
          /\d/.test(previousCharacter) &&
          /\d/.test(nextCharacter)
        ) {
          return punctuation;
        }

        if (nextCharacter === "’") {
          const characterAfterApostrophe =
            source[offset + _match.length + 1] || "";

          if (/[A-Za-z0-9]/.test(characterAfterApostrophe)) {
            return `${punctuation} `;
          }
        }

        if (/[\]})»”’.,;:!?]/.test(nextCharacter)) {
          return punctuation;
        }

        return `${punctuation} `;
      }
    );

    const afterQuestionOrExclamationSeries = afterCommaSemicolonOrColon.replace(
      /([!?]+)([ \t\u00A0\u202F]*)(?=([^\s]))/g,
      (_match, punctuationSeries, _spaces, nextCharacter, offset, source) => {
        if (/[\]})»”’.,;:!?]/.test(nextCharacter)) {
          return punctuationSeries;
        }

        if (/[“"']/.test(nextCharacter)) {
          const characterAfterQuote =
            source[offset + _match.length + 1] || "";

          if (
            !characterAfterQuote ||
            /[\s\]})»”’.,;:!?]/.test(characterAfterQuote)
          ) {
            return punctuationSeries;
          }
        }

        return `${punctuationSeries} `;
      }
    );

    return afterQuestionOrExclamationSeries
      .replace(/\(\s+/g, "(")
      .replace(/\s+\)/g, ")")
      .replace(/\[\s+/g, "[")
      .replace(/\s+\]/g, "]")
      .replace(/\{\s+/g, "{")
      .replace(/\s+\}/g, "}");
  }

  function normalizeExtraSpaces(text: string): string {
    return text.replace(/[ \t]{2,}/g, " ");
  }

  function trimTextEdges(text: string): string {
    return text.trim();
  }

  function removeUiFinalPeriod(text: string): string {
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

    if (
      /(?:[А-ЯЁA-Z]\.|(?:^|[^А-Яа-яЁё])т\.[ \t\u00A0\u202F]*[едкпч]|(?:^|[^А-Яа-яЁё])в[ \t\u00A0\u202F]+т\.[ \t\u00A0\u202F]*ч|тыс|руб)$/i.test(
        bodyWithoutFinalPeriod
      )
    ) {
      return text;
    }

    return text.slice(0, text.length - (text.length - trimmedRight.length) - 1) +
      text.slice(trimmedRight.length);
  }
}
