figma.showUI(__html__, {
  width: 420,
  height: 1180,
});

type LanguageCode = "ru" | "en" | "unknown";
type LanguageMode = "auto" | "ru" | "en";
type NonBreakingSpaceStyle = "regular" | "narrow";

type QuoteStyle =
  | "frenchGuillemets"
  | "germanLowHigh"
  | "englishDouble"
  | "programmerDouble"
  | "englishSingle"
  | "englishSingleReversed";

type QuotePair = {
  opening: string;
  closing: string;
};

type QuoteOptions = {
  primaryQuoteStyle: QuoteStyle;
  secondaryQuoteStyle: QuoteStyle;
};

type EnabledRules = {
  invisibleCopyArtifacts: boolean;
  tabs: boolean;
  manualLineBreaks: boolean;
  ellipsis: boolean;
  extraSpaces: boolean;
  trimTextEdges: boolean;
  spacesBeforePunctuation: boolean;
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

type TypographyOptions = {
  nonBreakingSpaceStyle: NonBreakingSpaceStyle;
  quoteOptions: {
    ru: QuoteOptions;
    en: QuoteOptions;
  };
};

type ApplySettings = {
  enabledRules: EnabledRules;
  languageMode: LanguageMode;
  options: TypographyOptions;
};

type RuleResult = {
  formattedText: string;
  replacementCount: number;
};

type TypographyRule = {
  id: keyof EnabledRules;
  supportedLanguages: "all" | LanguageCode[];
  apply: (
    text: string,
    settings: ApplySettings,
    language: LanguageCode
  ) => RuleResult;
};

type LanguageStats = Record<LanguageCode, number>;

const SETTINGS_STORAGE_KEY = "typographyFormatterSettings";

const DEFAULT_SETTINGS: ApplySettings = {
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
    spacesBeforePunctuation: true,
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

function normalizeSettings(value: unknown): ApplySettings {
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

      spacesBeforePunctuation:
        typeof maybeEnabledRules.spacesBeforePunctuation === "boolean"
          ? maybeEnabledRules.spacesBeforePunctuation
          : DEFAULT_SETTINGS.enabledRules.spacesBeforePunctuation,

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

async function loadSettings(): Promise<ApplySettings> {
  try {
    const storedSettings = await figma.clientStorage.getAsync(
      SETTINGS_STORAGE_KEY
    );

    return normalizeSettings(storedSettings);
  } catch (error) {
    console.error("Could not load settings:", error);
    return DEFAULT_SETTINGS;
  }
}

async function saveSettings(settings: ApplySettings) {
  try {
    await figma.clientStorage.setAsync(SETTINGS_STORAGE_KEY, settings);
  } catch (error) {
    console.error("Could not save settings:", error);
  }
}

function findTextNodesInSelection(): TextNode[] {
  const textNodes: TextNode[] = [];

  function walk(node: SceneNode) {
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

function detectDominantLanguage(text: string): LanguageCode {
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

function resolveLanguage(text: string, languageMode: LanguageMode): LanguageCode {
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

  const formattedText = normalizedLineEndings.replace(
    /([^\n])[ \t\u00A0\u202F]*\n[ \t\u00A0\u202F]*([^\n])/g,
    function (match: string, beforeBreak: string, afterBreak: string) {
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
  const matches = text.match(/\.{3}/g);

  return {
    formattedText: text.replace(/\.{3}/g, "…"),
    replacementCount: matches ? matches.length : 0,
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

function applySpacesBeforePunctuationRule(text: string): RuleResult {
  const regexp = /[ \t]+([,.;:!?])/g;
  const matches = text.match(regexp);

  return {
    formattedText: text.replace(regexp, "$1"),
    replacementCount: matches ? matches.length : 0,
  };
}

function applyPercentSignNoSpaceRule(text: string): RuleResult {
  const regexp = /(\d+(?:[,.]\d+)?)[ \t\u00A0\u202F]+%/g;
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
  settings: ApplySettings
): RuleResult {
  const space = getConfiguredNbsp(settings);
  const regexp = /([№§])[ \t\u00A0\u202F]*(?=\d)/g;

  let replacementCount = 0;

  const formattedText = text.replace(
    regexp,
    function (match: string, sign: string) {
      const normalized = sign + space;

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
  settings: ApplySettings
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

  return {
    formattedText,
    replacementCount,
  };
}

function shouldKeepRussianFinalPeriod(textEndingWithPeriod: string): boolean {
  const protectedAbbreviations =
    /(^|[^А-Яа-яЁёA-Za-z])((?:т\.[ \t\u00A0\u202F]*[екдпчно]\.)|(?:и[ \t\u00A0\u202F]+т\.[ \t\u00A0\u202F]*[дп]\.)|(?:в[ \t\u00A0\u202F]+т\.[ \t\u00A0\u202F]*ч\.)|(?:руб\.|тыс\.|г\.|ул\.|д\.|стр\.))$/iu;

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
  if (language === "ru") {
    return shouldKeepRussianFinalPeriod(textEndingWithPeriod);
  }

  if (language === "en") {
    return shouldKeepEnglishFinalPeriod(textEndingWithPeriod);
  }

  return true;
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
    /(^|[\s([{,.;:!?…—–-])["“„«‚‘]([^"“”„«»‚‘’\n]+)["”“»‘’](?=$|[\s.,;:!?…)\]}—–-])/g,
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

  let formattedText = text;
  let replacementCount = 0;

  formattedText = formattedText.replace(
    timeRangeRegexp,
    function (match, prefix, startTime, endTime) {
      const normalized = prefix + startTime + "–" + endTime;

      if (match === normalized) {
        return match;
      }

      replacementCount += 1;
      return normalized;
    }
  );

  formattedText = formattedText.replace(
    numberRangeRegexp,
    function (match, prefix, startNumber, endNumber) {
      const normalized = prefix + startNumber + "–" + endNumber;

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
  settings: ApplySettings
): RuleResult {
  const regularNbsp = "\u00A0";
  const abbreviationSpace = getConfiguredNbsp(settings);

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
    "а|в|во|и|к|ко|о|об|от|по|с|со|у|до|за|из|на|не|ни|но";

  replaceAndCount(
    new RegExp(
      "(^|[ \\t\\u00A0\\u202F(«„“])(" +
        shortWords +
        ")[ \\t\\u00A0\\u202F]+(?=[А-Яа-яЁёA-Za-z0-9])",
      "giu"
    ),
    function (_match, prefix, word) {
      return prefix + word + regularNbsp;
    }
  );

  replaceAndCount(
    /(^|[^А-Яа-яЁёA-Za-z])([тТ])\.[ \t\u00A0\u202F]*([еЕкКдДпПчЧнНоО])\./g,
    function (_match, prefix, firstLetter, secondLetter) {
      return prefix + firstLetter + "." + abbreviationSpace + secondLetter + ".";
    }
  );

  return {
    formattedText,
    replacementCount,
  };
}

function applyRussianInitialsNbspRule(
  text: string,
  settings: ApplySettings
): RuleResult {
  const space = getConfiguredNbsp(settings);
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
  const trailingWhitespaceMatch = text.match(/[ \t\r\n\u00A0\u202F]*$/);
  const trailingWhitespace = trailingWhitespaceMatch
    ? trailingWhitespaceMatch[0]
    : "";

  const textWithoutTrailingWhitespace = text.slice(
    0,
    text.length - trailingWhitespace.length
  );

  const closingQuoteCharacters = "»”\"’“‘";
  const lastCharacter = textWithoutTrailingWhitespace.slice(-1);
  const beforeLastCharacter = textWithoutTrailingWhitespace.slice(0, -1);

  if (
    closingQuoteCharacters.includes(lastCharacter) &&
    beforeLastCharacter.endsWith(".")
  ) {
    if (shouldKeepFinalPeriod(beforeLastCharacter, language)) {
      return {
        formattedText: text,
        replacementCount: 0,
      };
    }

    return {
      formattedText:
        beforeLastCharacter.slice(0, -1) + lastCharacter + trailingWhitespace,
      replacementCount: 1,
    };
  }

  if (!textWithoutTrailingWhitespace.endsWith(".")) {
    return {
      formattedText: text,
      replacementCount: 0,
    };
  }

  if (shouldKeepFinalPeriod(textWithoutTrailingWhitespace, language)) {
    return {
      formattedText: text,
      replacementCount: 0,
    };
  }

  return {
    formattedText:
      textWithoutTrailingWhitespace.slice(0, -1) + trailingWhitespace,
    replacementCount: 1,
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

function applyRulesToText(
  text: string,
  settings: ApplySettings,
  language: LanguageCode
): RuleResult & { skippedRuleCount: number } {
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

    const result = rule.apply(formattedText, settings, language);

    formattedText = result.formattedText;
    replacementCount += result.replacementCount;
  }

  return {
    formattedText,
    replacementCount,
    skippedRuleCount,
  };
}


type CharacterStyleSnapshot = {
  fontName: FontName | typeof figma.mixed;
  fontSize: number | typeof figma.mixed;
  fills: readonly Paint[] | typeof figma.mixed;
  textDecoration: TextDecoration | typeof figma.mixed;
  textCase: TextCase | typeof figma.mixed;
  letterSpacing: LetterSpacing | typeof figma.mixed;
  lineHeight: LineHeight | typeof figma.mixed;
};

function getCharacterStyleSnapshot(
  node: TextNode,
  index: number
): CharacterStyleSnapshot {
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

function getTextStyleSnapshots(node: TextNode): CharacterStyleSnapshot[] {
  const styles: CharacterStyleSnapshot[] = [];

  for (let i = 0; i < node.characters.length; i++) {
    styles.push(getCharacterStyleSnapshot(node, i));
  }

  return styles;
}

function findNextMatchingCharacter(
  originalText: string,
  formattedText: string,
  originalIndex: number,
  formattedIndex: number
): { originalIndex: number; formattedIndex: number } | null {
  const lookaheadLimit = 80;
  const maxOriginalIndex = Math.min(
    originalText.length,
    originalIndex + lookaheadLimit
  );
  const maxFormattedIndex = Math.min(
    formattedText.length,
    formattedIndex + lookaheadLimit
  );

  let bestMatch: { originalIndex: number; formattedIndex: number } | null = null;
  let bestDistance = Infinity;

  for (let currentOriginalIndex = originalIndex; currentOriginalIndex < maxOriginalIndex; currentOriginalIndex++) {
    for (let currentFormattedIndex = formattedIndex; currentFormattedIndex < maxFormattedIndex; currentFormattedIndex++) {
      if (originalText[currentOriginalIndex] !== formattedText[currentFormattedIndex]) {
        continue;
      }

      const distance =
        currentOriginalIndex - originalIndex + currentFormattedIndex - formattedIndex;

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

function mapFormattedCharactersToOriginalCharacters(
  originalText: string,
  formattedText: string
): number[] {
  const originalIndexByFormattedIndex: number[] = [];

  let originalIndex = 0;
  let formattedIndex = 0;

  while (formattedIndex < formattedText.length) {
    if (
      originalIndex < originalText.length &&
      originalText[originalIndex] === formattedText[formattedIndex]
    ) {
      originalIndexByFormattedIndex[formattedIndex] = originalIndex;
      originalIndex += 1;
      formattedIndex += 1;
      continue;
    }

    const nextMatch = findNextMatchingCharacter(
      originalText,
      formattedText,
      originalIndex,
      formattedIndex
    );

    const nextOriginalIndex = nextMatch ? nextMatch.originalIndex : originalText.length;
    const nextFormattedIndex = nextMatch ? nextMatch.formattedIndex : formattedText.length;

    const styleSourceIndex = Math.max(
      0,
      Math.min(
        originalText.length - 1,
        originalIndex < originalText.length ? originalIndex : originalIndex - 1
      )
    );

    while (formattedIndex < nextFormattedIndex) {
      originalIndexByFormattedIndex[formattedIndex] = styleSourceIndex;
      formattedIndex += 1;
    }

    originalIndex = nextOriginalIndex;
  }

  return originalIndexByFormattedIndex;
}

function getStyleKey(style: CharacterStyleSnapshot): string {
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

function applyStyleToRange(
  node: TextNode,
  start: number,
  end: number,
  style: CharacterStyleSnapshot
) {
  if (start >= end) {
    return;
  }

  function applySafely(propertyName: string, applyProperty: () => void) {
    try {
      applyProperty();
    } catch (error) {
      console.warn(
        `Could not restore ${propertyName} for range ${start}-${end}:`,
        error
      );
    }
  }

  if (style.fontName !== figma.mixed) {
    applySafely("fontName", () => {
      node.setRangeFontName(start, end, style.fontName as FontName);
    });
  }

  if (style.fontSize !== figma.mixed) {
    applySafely("fontSize", () => {
      node.setRangeFontSize(start, end, style.fontSize as number);
    });
  }

  if (style.fills !== figma.mixed) {
    applySafely("fills", () => {
      node.setRangeFills(start, end, style.fills as Paint[]);
    });
  }

  if (style.textDecoration !== figma.mixed) {
    applySafely("textDecoration", () => {
      node.setRangeTextDecoration(
        start,
        end,
        style.textDecoration as TextDecoration
      );
    });
  }

  if (style.textCase !== figma.mixed) {
    applySafely("textCase", () => {
      node.setRangeTextCase(start, end, style.textCase as TextCase);
    });
  }

  if (style.letterSpacing !== figma.mixed) {
    applySafely("letterSpacing", () => {
      node.setRangeLetterSpacing(
        start,
        end,
        style.letterSpacing as LetterSpacing
      );
    });
  }

  if (style.lineHeight !== figma.mixed) {
    applySafely("lineHeight", () => {
      node.setRangeLineHeight(start, end, style.lineHeight as LineHeight);
    });
  }
}

function applyStyleSnapshotsToFormattedText(
  node: TextNode,
  originalText: string,
  formattedText: string,
  originalStyles: CharacterStyleSnapshot[]
) {
  if (originalStyles.length === 0 || formattedText.length === 0) {
    return;
  }

  const originalIndexByFormattedIndex =
    mapFormattedCharactersToOriginalCharacters(originalText, formattedText);

  let rangeStart = 0;
  let currentStyle =
    originalStyles[originalIndexByFormattedIndex[0]] || originalStyles[0];
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

async function loadFontsFromStyleSnapshots(styles: CharacterStyleSnapshot[]) {
  const fonts = styles
    .map((style) => style.fontName)
    .filter((fontName): fontName is FontName => fontName !== figma.mixed);

  const uniqueFonts = Array.from(
    new Map(fonts.map((font) => [`${font.family}-${font.style}`, font])).values()
  );

  await Promise.all(uniqueFonts.map((font) => figma.loadFontAsync(font)));
}

async function updateTextNodeCharactersPreservingStyles(
  node: TextNode,
  formattedText: string
) {
  const originalText = node.characters;
  const originalStyles = getTextStyleSnapshots(node);

  await loadFontsForTextNode(node);
  await loadFontsFromStyleSnapshots(originalStyles);

  node.characters = formattedText;
  applyStyleSnapshotsToFormattedText(node, originalText, formattedText, originalStyles);
}

async function loadFontsForTextNode(node: TextNode) {
  const fonts: FontName[] = [];

  function addFont(fontName: FontName | typeof figma.mixed) {
    if (fontName !== figma.mixed) {
      fonts.push(fontName);
    }
  }

  if (node.fontName !== figma.mixed) {
    addFont(node.fontName);
  } else {
    for (let i = 0; i < node.characters.length; i++) {
      addFont(node.getRangeFontName(i, i + 1));
    }
  }

  const uniqueFonts = Array.from(
    new Map(fonts.map((font) => [`${font.family}-${font.style}`, font])).values()
  );

  await Promise.all(uniqueFonts.map((font) => figma.loadFontAsync(font)));
}

async function applyTypographyRules(settings: ApplySettings) {
  const safeSettings = normalizeSettings(settings);
  const selectedTextNodes = findTextNodesInSelection();

  let changedNodeCount = 0;
  let totalReplacementCount = 0;
  let skippedNodeCount = 0;
  let skippedRuleCount = 0;

  const languageStats: LanguageStats = {
    ru: 0,
    en: 0,
    unknown: 0,
  };

  for (const node of selectedTextNodes) {
    const originalText = node.characters;
    const language = resolveLanguage(originalText, safeSettings.languageMode);

    languageStats[language] += 1;

    const result = applyRulesToText(originalText, safeSettings, language);

    skippedRuleCount += result.skippedRuleCount;

    if (result.replacementCount === 0 || result.formattedText === originalText) {
      continue;
    }

    try {
      await updateTextNodeCharactersPreservingStyles(node, result.formattedText);

      changedNodeCount += 1;
      totalReplacementCount += result.replacementCount;
    } catch (error) {
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

  figma.notify(
    `Updated ${changedNodeCount} text layer${changedNodeCount === 1 ? "" : "s"}`
  );

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
    await saveSettings(normalizeSettings(message.settings));
  }

  if (message.type === "apply") {
    const safeSettings = normalizeSettings(message.settings);

    await saveSettings(safeSettings);
    await applyTypographyRules(safeSettings);
  }

  if (message.type === "close") {
    figma.closePlugin();
  }
};

initializePlugin();