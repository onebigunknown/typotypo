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
  ellipsis: boolean;
  extraSpaces: boolean;
  trimTextEdges: boolean;
  spacesBeforePunctuation: boolean;
  percentSignNoSpace: boolean;
  numberUnitsNbsp: boolean;
  specialSymbols: boolean;
  englishQuotes: boolean;
  russianQuotes: boolean;
  russianNumberRangeDash: boolean;
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
    ellipsis: true,
    extraSpaces: true,
    trimTextEdges: true,
    spacesBeforePunctuation: true,
    percentSignNoSpace: true,
    numberUnitsNbsp: true,
    specialSymbols: true,
    englishQuotes: true,
    russianQuotes: true,
    russianNumberRangeDash: true,
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

      specialSymbols:
        typeof maybeEnabledRules.specialSymbols === "boolean"
          ? maybeEnabledRules.specialSymbols
          : DEFAULT_SETTINGS.enabledRules.specialSymbols,

      englishQuotes:
        typeof maybeEnabledRules.englishQuotes === "boolean"
          ? maybeEnabledRules.englishQuotes
          : DEFAULT_SETTINGS.enabledRules.englishQuotes,

      russianQuotes:
        typeof maybeEnabledRules.russianQuotes === "boolean"
          ? maybeEnabledRules.russianQuotes
          : DEFAULT_SETTINGS.enabledRules.russianQuotes,

      russianNumberRangeDash:
        typeof maybeEnabledRules.russianNumberRangeDash === "boolean"
          ? maybeEnabledRules.russianNumberRangeDash
          : DEFAULT_SETTINGS.enabledRules.russianNumberRangeDash,

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
    "₽|руб\\.?|рублей|р\\.?|тыс\\.?|млн\\.?|млрд\\.?|трлн\\.?|кг|г|мг|л|мл|м|см|мм|км|с|сек|мин|ч|д|дн|КБ|МБ|ГБ|ТБ|KB|MB|GB|TB|px|dp|pt|rem|em|vw|vh";

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

function applySpecialSymbolsRule(text: string): RuleResult {
  let formattedText = text;
  let replacementCount = 0;

  function replaceAndCount(regexp: RegExp, replacement: string) {
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

function applyRussianNumberRangeDashRule(text: string): RuleResult {
  const regexp =
    /(^|[^\d–—−-])(\d{1,4})[ \t\u00A0\u202F]*[-–—−][ \t\u00A0\u202F]*(\d{1,4})(?=$|[^\d–—−-])/g;

  let replacementCount = 0;

  const formattedText = text.replace(
    regexp,
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
    /([А-Яа-яЁёA-Za-z0-9»”’")\]\.!?…])([ \t\u00A0\u202F]+)[-–—−]([ \t\u00A0\u202F]+)([А-Яа-яЁёA-Za-z0-9«„“"(\[])/g;

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
      await loadFontsForTextNode(node);

      node.characters = result.formattedText;

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