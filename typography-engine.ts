// WORD_JOINER_PATCH_20260701
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
  const WORD_JOINER = "\u2060";

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
    const protectedText = protectSegments(originalText);

    let text = protectedText.text;
    let replacementCount = 0;
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

    const enabledRules = safeSettings.enabledRules;

    applyRule(enabledRules.invisibleCopyArtifacts, null, removeInvisibleCopyArtifacts);
    applyRule(enabledRules.tabs, null, normalizeTabs);
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
    applyRule(enabledRules.englishApostrophes, ["en"], normalizeEnglishApostrophes);
    applyRule(enabledRules.englishQuotes, ["en"], (value) =>
      normalizeQuotes(value, safeSettings.options.quoteOptions.en)
    );
    applyRule(enabledRules.russianQuotes, ["ru"], (value) =>
      normalizeQuotes(value, safeSettings.options.quoteOptions.ru)
    );
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

    const protectedPattern =
      /ГОСТ\s+\d+(?:\.\d+)*(?:[-–—]\d+)?|[А-ЯЁA-Z]{2,}\.[0-9.]+\s+ТУ|ТУ\s+\d+(?:[-–—]\d+)+|https?:\/\/[^\s<>()]+|www\.[^\s<>()]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|`[^`]*`|<[^>]+>|&[#A-Za-z0-9]+;|\{[^{}]*\}|\b[A-Za-z][A-Za-z0-9]*(?:[._/-][A-Za-z0-9]+){2,}\b/g;

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

  function restoreSegments(text: string, segments: ProtectedSegment[]): string {
    let restoredText = text;

    for (const segment of segments) {
      restoredText = restoredText.split(segment.token).join(segment.value);
    }

    return restoredText;
  }

  function removeInvisibleCopyArtifacts(text: string): string {
    return text.replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, "");
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
    return text.replace(/\.\.\./g, "…");
  }

  function normalizePercentSign(text: string): string {
    return text.replace(/(\d)[ \t\u00A0\u202F]+%/g, "$1%");
  }

  function normalizeSpecialSymbols(text: string): string {
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

  function normalizeNumberSigns(text: string): string {
    return text.replace(/([№§])\s*(\d)/g, `$1${REGULAR_NBSP}$2`);
  }

  function normalizeNumberRanges(text: string): string {
    return text.replace(/(\d)[ \t\u00A0\u202F]*[-–—][ \t\u00A0\u202F]*(\d)/g, "$1–$2");
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
      .replace(/(\d+(?:[,.]\d+)?)[ \t\u00A0\u202F]*(тыс)\.?(?=\s|$|[,.!?:;)])/gi, (_match, number, abbreviation) => `${number}${nbsp}${abbreviation}.`)
      .replace(/(\d+(?:[,.]\d+)?)[ \t\u00A0\u202F]*(млн|млрд|трлн)\.?(?=\s|$|[,.!?:;)])/gi, (_match, number, abbreviation) => `${number}${nbsp}${abbreviation}`);
  }

  function normalizeRussianLargeNumbers(text: string, nbsp: string): string {
    const groupSeparator = `${WORD_JOINER}${nbsp}${WORD_JOINER}`;

    function formatLargeNumber(value: string): string {
      const digitsOnly = value.replace(/[\s\u00A0\u202F\u2060]/g, "");

      if (!/^\d{5,}$/.test(digitsOnly)) {
        return value;
      }

      return digitsOnly.replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator);
    }

    return text
      .replace(/\b\d{1,3}(?:[\s\u00A0\u202F\u2060]+\d{3})+\b/g, formatLargeNumber)
      .replace(/\b\d{5,}\b/g, formatLargeNumber);
  }

  function normalizeEnglishApostrophes(text: string): string {
    return text
      .replace(/([A-Za-z])'([A-Za-z])/g, "$1’$2")
      .replace(/([A-Za-z])'s\b/g, "$1’s")
      .replace(/\b'(\d{2}s)\b/g, "’$1");
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

  function normalizeQuotes(
    text: string,
    options: QuoteOptionsByLanguage
  ): string {
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
      } else {
        const closingPair = Math.max(0, depth - 1) % 2 === 0 ? primaryQuotePair : secondaryQuotePair;
        result += closingPair.close;
        depth = Math.max(0, depth - 1);
      }
    }

    return result;
  }

  function normalizeRussianSentenceDash(text: string): string {
    return text
      .replace(/([^\s])[ \t\u00A0\u202F]+[-–—][ \t\u00A0\u202F]+([^\s])/g, `$1${REGULAR_NBSP}— $2`)
      .replace(/([^\s])\u202F—[ \t\u00A0\u202F]*/g, `$1${REGULAR_NBSP}— `)
      .replace(/([^\s])\u00A0—[ \t\u00A0\u202F]*/g, `$1${REGULAR_NBSP}— `);
  }

  function normalizeRussianInitials(text: string): string {
    return text.replace(
      /\b([А-ЯЁ])\.\s*([А-ЯЁ])\.\s*([А-ЯЁ][а-яё]+)/g,
      `$1.${REGULAR_NBSP}$2.${REGULAR_NBSP}$3`
    );
  }

  function normalizeRussianShortWords(text: string): string {
    const leadingShortWords =
      "а|без|безо|в|во|вне|вот|всё|где|да|даже|для|до|если|есть|ещё|за|и|из|изо|из-за|из-под|или|иль|к|ко|как|либо|между|на|над|надо|не|ни|но|об|обо|около|оно|от|перед|по|по-за|по-над|под|подо|после|при|про|ради|с|со|сквозь|так|также|там|тем|то|того|тоже|туда|у|хоть|хотя|чего|через|что|чтоб|чтобы|это";

    const shortWordPattern = new RegExp(
      `(^|[\s([{«„“])(${leadingShortWords})[ \t\u00A0\u202F]+([А-Яа-яЁёA-Za-z0-9])`,
      "gi"
    );

    return text
      .replace(/и[ \t\u00A0\u202F]+т\.[ \t\u00A0\u202F]+д\./gi, `и${REGULAR_NBSP}т.${REGULAR_NBSP}д.`)
      .replace(/т\.[ \t\u00A0\u202F]+е\./gi, `т.${REGULAR_NBSP}е.`)
      .replace(/т\.[ \t\u00A0\u202F]+к\./gi, `т.${REGULAR_NBSP}к.`)
      .replace(/т\.[ \t\u00A0\u202F]+д\./gi, `т.${REGULAR_NBSP}д.`)
      .replace(/т\.[ \t\u00A0\u202F]+п\./gi, `т.${REGULAR_NBSP}п.`)
      .replace(/в[ \t\u00A0\u202F]+т\.[ \t\u00A0\u202F]+ч\./gi, `в${REGULAR_NBSP}т.${REGULAR_NBSP}ч.`)
      .replace(/а\.[ \t\u00A0\u202F]+е\./gi, `а.${REGULAR_NBSP}е.`)
      .replace(/н\.[ \t\u00A0\u202F]+э\./gi, `н.${REGULAR_NBSP}э.`)
      .replace(/до[ \t\u00A0\u202F]+н\.[ \t\u00A0\u202F]+э\./gi, `до${REGULAR_NBSP}н.${REGULAR_NBSP}э.`)
      .replace(/(^|[\s([{«„“])(г-н|г-жа|г-да|тов\.)[ \t\u00A0\u202F]+(?=[А-ЯЁA-Z])/g, `$1$2${REGULAR_NBSP}`)
      .replace(/(^|[\s([{«„“])(г\.|ул\.|пр-т|просп\.|пер\.|пл\.|о-в|о-ва|р-н|обл\.|с\.|д\.)[ \t\u00A0\u202F]+(?=[А-ЯЁA-Z])/g, `$1$2${REGULAR_NBSP}`)
      .replace(/(^|[\s([{«„“])(гл\.|рис\.|табл\.|стр\.|с\.|п\.|ч\.|разд\.|подп\.)[ \t\u00A0\u202F]+(?=[0-9IVXLCDM])/gi, `$1$2${REGULAR_NBSP}`)
      .replace(/(\d{3,4})[ \t\u00A0\u202F]+(г\.|гг\.|год|года|году|годом|лет)(?=$|[\s,.;:!?)]|\uE000)/gi, `$1${REGULAR_NBSP}$2`)
      .replace(/([А-Яа-яЁёA-Za-z0-9])[ \t\u00A0\u202F]+(бы|ли|же)(?=$|[^А-Яа-яЁёA-Za-z0-9])/gi, `$1${REGULAR_NBSP}$2`)
      .replace(shortWordPattern, (_match, prefix, word, next) => `${prefix}${word}${REGULAR_NBSP}${next}`);
  }

  function normalizeSpacing(text: string): string {
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

  function normalizeExtraSpaces(text: string): string {
    return text.replace(/[ \t]{2,}/g, " ");
  }

  function trimTextEdges(text: string): string {
    return text
      .split("\n")
      .map((line) =>
        line.replace(/^[ \t\u00A0\u202F]+/g, "").replace(/[ \t\u00A0\u202F]+$/g, "")
      )
      .join("\n")
      .trim();
  }

  function removeUiFinalPeriod(text: string): string {
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
}
