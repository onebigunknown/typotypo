/* eslint-disable */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function loadFormatter() {
  const enginePath = path.join(process.cwd(), "typography-engine.ts");

  if (!fs.existsSync(enginePath)) {
    throw new Error(`Cannot find typography-engine.ts in ${process.cwd()}`);
  }

  const source = fs.readFileSync(enginePath, "utf8");
  const testBridge = `
;(globalThis).__typotypoTestApi = {
  DEFAULT_SETTINGS: TypotypoEngine.DEFAULT_SETTINGS,
  normalizeSettings: TypotypoEngine.normalizeSettings,
  resolveLanguage: TypotypoEngine.resolveLanguage,
  applyRulesToText: TypotypoEngine.applyRulesToText,
  format(input, settingsOverride = {}) {
    const overrideOptions = settingsOverride.options || {};
    const overrideQuoteOptions = overrideOptions.quoteOptions || {};
    const settings = TypotypoEngine.normalizeSettings({
      ...TypotypoEngine.DEFAULT_SETTINGS,
      ...settingsOverride,
      options: {
        ...TypotypoEngine.DEFAULT_SETTINGS.options,
        ...overrideOptions,
        quoteOptions: {
          ...TypotypoEngine.DEFAULT_SETTINGS.options.quoteOptions,
          ...overrideQuoteOptions,
        },
      },
      enabledRules: {
        ...TypotypoEngine.DEFAULT_SETTINGS.enabledRules,
        ...(settingsOverride.enabledRules || {}),
      },
    });

    const language = TypotypoEngine.resolveLanguage(input, settings.languageMode);
    return TypotypoEngine.applyRulesToText(input, settings, language).formattedText;
  },
  detect(input, languageMode = "auto") {
    return TypotypoEngine.resolveLanguage(input, languageMode);
  },
};
`;

  const compiled = ts.transpileModule(source + testBridge, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2019,
      module: ts.ModuleKind.None,
    },
  }).outputText;

  const context = { console };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(compiled, context, { filename: "typography-engine.ts" });

  if (!context.__typotypoTestApi) {
    throw new Error("Could not expose formatter test API from typography-engine.ts");
  }

  return context.__typotypoTestApi;
}

const NBSP = "\u00A0";
const NNBSP = "\u202F";

const formatCases = [
  // Cleanup
  {
    group: "cleanup",
    name: "removes invisible copy artifacts",
    input: "До\u00ADба\u200Bвить\uFEFF трек",
    expected: "Добавить трек",
  },
  {
    group: "cleanup",
    name: "replaces tabs with one regular space",
    input: "Трек\t\tальбом",
    expected: "Трек альбом",
  },
  {
    group: "cleanup",
    name: "single manual line break becomes a space",
    input: "Первая строка\nвторая строка",
    expected: "Первая строка вторая строка",
  },
  {
    group: "cleanup",
    name: "paragraph break is preserved",
    input: "Первый абзац\n\nВторой абзац",
    expected: "Первый абзац\n\nВторой абзац",
  },
  {
    group: "cleanup",
    name: "extra spaces and text edges are cleaned",
    input: "  Привет   мир  ",
    expected: "Привет мир",
  },
  {
    group: "cleanup",
    name: "regular and non-breaking repeated spaces collapse",
    input: `Привет${NBSP}${NBSP}мир   сейчас`,
    expected: "Привет мир сейчас",
  },

  // Spacing cleanup and punctuation
  {
    group: "spacing cleanup",
    name: "spaces before punctuation are removed and spaces after punctuation are added",
    input: "Привет ,мир:ошибка;повторите,готово?да!нет.Продолжить",
    expected: "Привет, мир: ошибка; повторите, готово? да! нет. Продолжить",
  },
  {
    group: "spacing cleanup",
    name: "decimal numbers and time stay intact",
    input: "Версия 1.2.3, цена 1,5, время 10:00.",
    expected: "Версия 1.2.3, цена 1,5, время 10:00",
  },
  {
    group: "spacing cleanup",
    name: "repeated punctuation is normalized",
    input: "Готово!!! Удалить?? Что!? Правда...? Точно...!",
    expected: "Готово! Удалить? Что?! Правда?.. Точно!..",
  },
  {
    group: "spacing cleanup",
    name: "bracket spacing is cleaned",
    input: "Плейлист(обновлён). Скидка ( 30% ). До 5 треков(максимум).",
    expected: `Плейлист (обновлён). Скидка (30%). До${NBSP}5${NBSP}треков (максимум)`,
  },
  {
    group: "spacing cleanup",
    name: "number brackets are not converted into multiplication or ranges",
    input: "Версия 2(10), значение 5(6).",
    expected: "Версия 2(10), значение 5(6)",
  },

  {
    group: "spacing cleanup",
    name: "spaces inside Russian quotes and brackets are removed",
    input: "« текст » ( тест ) [ ещё ].",
    expected: "«текст» (тест) [ещё]",
  },
  {
    group: "spacing cleanup",
    name: "spaces inside straight quotes are cleaned before Russian quote normalization",
    input: "\" текст \".",
    expected: "«текст»",
  },
  {
    group: "spacing cleanup",
    name: "space before ellipsis is removed",
    input: "Подождите … Готово .",
    expected: "Подождите… Готово",
  },
  {
    group: "spacing cleanup",
    name: "English quote and bracket inner spacing is cleaned",
    input: "Hello “ text ” and ( more ).",
    expected: "Hello “text” and (more)",
    settings: { languageMode: "en" },
  },
  {
    group: "spacing cleanup",
    name: "English feet and inches notation is preserved",
    input: "5' 11\"",
    expected: "5' 11\"",
    settings: { languageMode: "en" },
  },

  // UI separators
  {
    group: "ui separators",
    name: "vertical bar gets one regular space on both sides in Russian UI text",
    input: "Треки|альбомы. Артисты |плейлисты. Подкасты| радио.",
    expected: "Треки | альбомы. Артисты | плейлисты. Подкасты | радио",
  },
  {
    group: "ui separators",
    name: "middle dot gets one regular space on both sides",
    input: "Треки·альбомы. Треки ·альбомы. Треки· альбомы.",
    expected: "Треки · альбомы. Треки · альбомы. Треки · альбомы",
  },
  {
    group: "ui separators",
    name: "English vertical bar separator is normalized",
    input: "Tracks|Albums",
    expected: "Tracks | Albums",
    settings: { languageMode: "en" },
  },
  {
    group: "ui separators",
    name: "slashes are not treated as UI separators",
    input: "Треки/альбомы.",
    expected: "Треки/альбомы",
  },
  {
    group: "ui separators",
    name: "repeated pipes are preserved",
    input: "A||B",
    expected: "A||B",
    settings: { languageMode: "en" },
  },
  {
    group: "ui separators",
    name: "code-like tokens around a pipe are protected",
    input: "button_primary|row_secondary.",
    expected: "button_primary|row_secondary",
    settings: { languageMode: "en" },
  },
  {
    group: "ui separators",
    name: "HTML-like tags around visible separators stay protected",
    input: "<b>Треки</b>|<i>альбомы</i>.",
    expected: "<b>Треки</b> | <i>альбомы</i>",
  },

  // List markers
  {
    group: "list markers",
    name: "bullet markers get one space after marker",
    input: "•Треки\n•  Альбомы\n◦Плейлисты",
    expected: "• Треки\n• Альбомы\n◦ Плейлисты",
  },
  {
    group: "list markers",
    name: "dash markers get one space after marker",
    input: "—Треки\n—  Альбомы\n–Плейлисты",
    expected: "— Треки\n— Альбомы\n— Плейлисты",
  },
  {
    group: "list markers",
    name: "hyphen markdown-like lists are not normalized",
    input: "-Треки\n- Альбомы",
    expected: "-Треки\n- Альбомы",
  },
  {
    group: "list markers",
    name: "inline em dashes are not treated as list markers",
    input: "Музыка—это настроение.",
    expected: "Музыка—это настроение",
  },


  // UI final period
  {
    group: "ui final period",
    name: "short UI final period is removed",
    input: "Плейлист создан.",
    expected: "Плейлист создан",
  },
  {
    group: "ui final period",
    name: "question and exclamation ellipsis variants are preserved",
    input: "Ну правда?.. Точно!..",
    expected: "Ну правда?.. Точно!..",
  },
  {
    group: "ui final period",
    name: "Russian abbreviations keep final period",
    input: "и т. д.",
    expected: `и${NBSP}т.${NBSP}д.`,
  },
  {
    group: "ui final period",
    name: "English abbreviations and technical endings keep final period",
    input: "Dr.",
    expected: "Dr.",
    settings: { languageMode: "en" },
  },
  {
    group: "ui final period",
    name: "ruble abbreviation is normalized instead of keeping the abbreviation period",
    input: "100 руб.",
    expected: `100${NBSP}₽`,
  },

  // Number spacing, units, and signs
  {
    group: "number spacing",
    name: "percent sign is glued to number and placeholders",
    input: "Скидка 50 %. Скидка {discount} %.",
    expected: "Скидка 50%. Скидка {discount}%",
  },
  {
    group: "number spacing",
    name: "units and file sizes use configured NBSP",
    input: "5 км, 300 МБ, 25 °C.",
    expected: `5${NBSP}км, 300${NBSP}МБ, 25${NBSP}°C`,
  },
  {
    group: "number spacing",
    name: "temperature without space is normalized",
    input: "25°C, -5 C",
    expected: `25${NBSP}°C, −5${NBSP}°C`,
  },
  {
    group: "number spacing",
    name: "number and section signs use regular NBSP",
    input: "№5, § 3.",
    expected: `№${NBSP}5, §${NBSP}3.`,
  },
  {
    group: "number spacing",
    name: "large Russian numbers are grouped and glued to following word",
    input: "1000000 треков.",
    expected: `1${NBSP}000${NBSP}000${NBSP}треков`,
    settings: { languageMode: "ru" },
  },
  {
    group: "number spacing",
    name: "numeric abbreviations are normalized",
    input: "5 тыс, 3 млн., 2 млрд.",
    expected: `5${NBSP}тыс., 3${NBSP}млн, 2${NBSP}млрд`,
    settings: { languageMode: "ru" },
  },
  {
    group: "number spacing",
    name: "narrow NBSP affects units but Russian word pairs stay regular NBSP",
    input: "100 ₽, до 5 треков.",
    expected: `100${NNBSP}₽, до${NBSP}5${NBSP}треков`,
    settings: {
      languageMode: "ru",
      options: { nonBreakingSpaceStyle: "narrow" },
    },
  },

  // Russian NBSP rules
  {
    group: "russian nbsp",
    name: "short prepositions and particles are glued",
    input: "до 5 треков, в мире, я бы пошёл, он же сказал.",
    expected: `до${NBSP}5${NBSP}треков, в${NBSP}мире, я${NBSP}бы${NBSP}пошёл, он${NBSP}же${NBSP}сказал`,
    settings: { languageMode: "ru" },
  },
  {
    group: "russian nbsp",
    name: "initials are glued to each other and surname",
    input: "А. А. Иванов написал текст.",
    expected: `А.${NBSP}А.${NBSP}Иванов написал текст`,
    settings: { languageMode: "ru" },
  },
  {
    group: "russian nbsp",
    name: "address abbreviation does not become broken d-dot case",
    input: "до 5 треков, д. 5.",
    expected: `до${NBSP}5${NBSP}треков, д.${NBSP}5`,
    settings: { languageMode: "ru" },
  },

  {
    group: "russian nbsp",
    name: "expanded short words are glued",
    input: "будто сейчас, ведь правда, ото всех.",
    expected: `будто${NBSP}сейчас, ведь${NBSP}правда, ото${NBSP}всех`,
    settings: { languageMode: "ru" },
  },
  {
    group: "russian nbsp",
    name: "legal entity abbreviations are glued to names",
    input: 'ООО "Ромашка", ПАО Сбер и ИП Иванов.',
    expected: `ООО${NBSP}"Ромашка", ПАО${NBSP}Сбер и${NBSP}ИП${NBSP}Иванов`,
    settings: { languageMode: "ru" },
  },
  {
    group: "russian nbsp",
    name: "expanded address abbreviations are glued",
    input: "пгт. Лесной, корп. 2, литер А, эт. 5.",
    expected: `пгт.${NBSP}Лесной, корп.${NBSP}2, литер${NBSP}А, эт.${NBSP}5`,
    settings: { languageMode: "ru" },
  },

  // Special symbols
  {
    group: "symbols",
    name: "copyright, trademark, registered, plus-minus, and approximation",
    input: "(C), (TM), (R), +/-, + -, ~=.",
    expected: "©, ™, ®, ±, ±, ≈",
  },
  {
    group: "symbols",
    name: "comparisons are normalized in text expressions",
    input: "ошибка!=0, ошибка<=0, ошибка>=1.",
    expected: "ошибка ≠ 0, ошибка≤0, ошибка≥1",
  },
  {
    group: "symbols",
    name: "fractions are normalized before punctuation",
    input: "1/2? 1/3! 2/3, 1/4; 3/4:",
    expected: "½? ⅓! ⅔, ¼; ¾:",
  },
  {
    group: "symbols",
    name: "short ruble sign is normalized for signed and unsigned values",
    input: "100р, 100 р., -100р, +100 р.",
    expected: `100${NBSP}₽, 100${NBSP}₽, −100${NBSP}₽, +100${NBSP}₽`,
  },
  {
    group: "symbols",
    name: "latin p is not treated as Cyrillic ruble abbreviation",
    input: "100р! 100p!",
    expected: `100${NBSP}₽! 100p!`,
  },
  {
    group: "currency",
    name: "Russian ruble aliases are normalized after the amount",
    input: "Цена 789 руб., 100 рублей, 50 RUB и 60 RUR.",
    expected: `Цена 789${NBSP}₽, 100${NBSP}₽, 50${NBSP}₽ и${NBSP}60${NBSP}₽`,
    settings: { languageMode: "ru" },
  },
  {
    group: "currency",
    name: "Russian USD and EUR aliases are normalized after the amount",
    input: "Стоимость 20usd, 30 EUR, $ 40 и 50€.",
    expected: `Стоимость 20${NBSP}$, 30${NBSP}€, 40${NBSP}$ и${NBSP}50${NBSP}€`,
    settings: { languageMode: "ru" },
  },
  {
    group: "currency",
    name: "Russian compact USD and EUR prefixes are normalized after the amount",
    input: "Стоимость $20, €30, $40 и 50€.",
    expected: `Стоимость 20${NBSP}$, 30${NBSP}€, 40${NBSP}$ и${NBSP}50${NBSP}€`,
    settings: { languageMode: "ru" },
  },
  {
    group: "currency",
    name: "English USD and EUR aliases are normalized before the amount",
    input: "Price 20usd, 30 EUR, $ 40 and 50€.",
    expected: "Price $20, €30, $40 and €50",
    settings: { languageMode: "en" },
  },
  {
    group: "currency",
    name: "English ruble aliases are normalized before the amount",
    input: "Price 789 RUB, RUR 100 and 50 rub.",
    expected: "Price ₽789, ₽100 and ₽50",
    settings: { languageMode: "en" },
  },
  {
    group: "currency",
    name: "bare dollar placeholder-like value stays protected in auto mode",
    input: "$100",
    expected: "$100",
  },
  {
    group: "currency",
    name: "mixed Russian and English currency contexts use local ordering",
    input:
      "Цена 789 руб., 100 рублей, 50 RUB и 60 RUR. Стоимость $20, €30, $40 и 50€. Price $20, €30, $40 and 50€. Price 789 RUB, RUR 100 and 50 rub. 100p и $100",
    expected:
      `Цена 789${NBSP}₽, 100${NBSP}₽, 50${NBSP}₽ и 60${NBSP}₽. Стоимость 20${NBSP}$, 30${NBSP}€, 40${NBSP}$ и 50${NBSP}€. Price $20, €30, $40 and €50. Price ₽789, ₽100 and ₽50. 100p и $100`,
  },
  {
    group: "currency",
    name: "manual Russian currency mode overrides local English context",
    input:
      "Цена 789 руб., 100 рублей, 50 RUB и 60 RUR. Стоимость $20, €30, $40 и 50€. Price $20, €30, $40 and 50€. Price 789 RUB, RUR 100 and 50 rub. 100p и $100",
    expected:
      `Цена 789${NBSP}₽, 100${NBSP}₽, 50${NBSP}₽ и${NBSP}60${NBSP}₽. Стоимость 20${NBSP}$, 30${NBSP}€, 40${NBSP}$ и${NBSP}50${NBSP}€. Price 20${NBSP}$, 30${NBSP}€, 40${NBSP}$ and 50${NBSP}€. Price 789${NBSP}₽, 100${NBSP}₽ and 50${NBSP}₽. 100p и${NBSP}$100`,
    settings: { languageMode: "ru" },
  },
  {
    group: "currency",
    name: "manual English currency mode overrides local Russian context",
    input:
      "Цена 789 руб., 100 рублей, 50 RUB и 60 RUR. Стоимость $20, €30, $40 и 50€. Price $20, €30, $40 and 50€. Price 789 RUB, RUR 100 and 50 rub. 100p и $100",
    expected:
      "Цена ₽789, ₽100, ₽50 и ₽60. Стоимость $20, €30, $40 и €50. Price $20, €30, $40 and €50. Price ₽789, ₽100 and ₽50. 100p и $100",
    settings: { languageMode: "en" },
  },
  {
    group: "currency",
    name: "Russian decimal amounts use comma before suffix currency",
    input: "Стоимость 143.56 $, 20.5 EUR и $30.05.",
    expected: `Стоимость 143,56${NBSP}$, 20,5${NBSP}€ и${NBSP}30,05${NBSP}$`,
    settings: { languageMode: "ru" },
  },
  {
    group: "currency",
    name: "English decimal amounts use period after prefix currency",
    input: "Price 143,56 $, 20,5 EUR and €30,05.",
    expected: "Price $143.56, €20.5 and €30.05",
    settings: { languageMode: "en" },
  },
  {
    group: "currency",
    name: "Russian rubles and kopecks are folded into decimal rubles",
    input: "Цена 45 руб. 5 коп., 45 рублей 50 копеек и 45 ₽ 7 коп.",
    expected: `Цена 45,05${NBSP}₽, 45,50${NBSP}₽ и${NBSP}45,07${NBSP}₽`,
    settings: { languageMode: "ru" },
  },
  {
    group: "currency",
    name: "English rubles and kopecks are folded into decimal rubles",
    input: "Price 45 руб. 5 коп. and 45 RUB 50 коп.",
    expected: "Price ₽45.05 and ₽45.50",
    settings: { languageMode: "en" },
  },
  {
    group: "currency",
    name: "Auto mode uses local context for fractional currency",
    input: "Стоимость 143.56 $ и 45 руб. 5 коп. Price 143,56 $ and 45 RUB 5 коп.",
    expected: `Стоимость 143,56${NBSP}$ и${NBSP}45,05${NBSP}₽. Price $143.56 and ₽45.05`,
  },
  {
    group: "currency",
    name: "Auto mode uses sentence-local context for prefix ruble decimals",
    input: "Цена 45 руб. 5 коп., ₽45.50 и ₽45.07. Price ₽45.05 and ₽45.50",
    expected: `Цена 45,05${NBSP}₽, 45,50${NBSP}₽ и 45,07${NBSP}₽. Price ₽45.05 and ₽45.50`,
  },
  {
    group: "currency",
    name: "Russian mode normalizes prefix ruble decimals after amount",
    input: "Цена ₽45.50 и ₽45.07. Price ₽45.05 and ₽45.50",
    expected: `Цена 45,50${NBSP}₽ и${NBSP}45,07${NBSP}₽. Price 45,05${NBSP}₽ and 45,50${NBSP}₽`,
    settings: { languageMode: "ru" },
  },
  {
    group: "currency",
    name: "Auto mode repairs split ruble fractional amounts by local context",
    input: "Цена 45 ₽.50 и 45 ₽.07. Price 45 ₽.50",
    expected: `Цена 45,50${NBSP}₽ и 45,07${NBSP}₽. Price ₽45.50`,
  },
  {
    group: "currency",
    name: "Manual modes repair split ruble fractional amounts by selected locale",
    input: "Цена 45 ₽.50 и 45 ₽.07",
    expected: "Цена ₽45.50 и ₽45.07",
    settings: { languageMode: "en" },
  },
  {
    group: "currency",
    name: "Prefix ruble fractional amounts are handled before generic currency move",
    input: "Цена ₽45.50, ₽45,07 и ₽45.5",
    expected: `Цена 45,50${NBSP}₽, 45,07${NBSP}₽ и${NBSP}45,5${NBSP}₽`,
  },
  {
    group: "currency",
    name: "Already split prefix ruble fractional amounts are repaired",
    input: "Цена 45 ₽.50 и 45 ₽.07",
    expected: `Цена 45,50${NBSP}₽ и${NBSP}45,07${NBSP}₽`,
  },
  {
    group: "currency",
    name: "Prefix ruble decimal fifty is repaired in mixed UI text",
    input: "Стоимость 143.56 $, 20.5 EUR и $30.05. Цена 45 руб. 5 коп., ₽45.50 и ₽45.07. Price $143.56, €20.5 and €30.05. Price ₽45.05 and ₽45.50",
    expected: `Стоимость 143,56${NBSP}$, 20,5${NBSP}€ и 30,05${NBSP}$. Цена 45,05${NBSP}₽, 45,50${NBSP}₽ и 45,07${NBSP}₽. Price $143.56, €20.5 and €30.05. Price ₽45.05 and ₽45.50`,
  },
  {
    group: "symbols",
    name: "degrees and degree words are normalized",
    input: "-5 C, 25 ° С, 90 degrees, 45deg.",
    expected: `−5${NBSP}°C, 25${NBSP}°C, 90°, 45°`,
  },
  {
    group: "symbols",
    name: "multiplication sign is only used between numbers",
    input: "10x20, 2 х 3, iPhone X, x-axis.",
    expected: "10×20, 2×3, iPhone X, x-axis",
  },
  {
    group: "symbols",
    name: "arrows are normalized but fat arrow is preserved",
    input: "a -> b, a <- b, a <-> b, a => b.",
    expected: "a → b, a ← b, a ←→ b, a => b",
  },

  // Ranges and dashes
  {
    group: "ranges and dashes",
    name: "numeric ranges use en dash without spaces",
    input: "2020 - 2024, 1–5, 10:00 - 12:00",
    expected: "2020–2024, 1–5, 10:00–12:00",
  },
  {
    group: "ranges and dashes",
    name: "month ranges use en dash without spaces",
    input: "январь - март, май-июнь, Сентябрь — декабрь.",
    expected: "январь–март, май–июнь, Сентябрь–декабрь",
    settings: { languageMode: "ru" },
  },
  {
    group: "ranges and dashes",
    name: "weekday ranges use en dash without spaces",
    input: "понедельник-суббота, среда — пятница.",
    expected: "понедельник–суббота, среда–пятница",
    settings: { languageMode: "ru" },
  },
  {
    group: "ranges and dashes",
    name: "roman numeral ranges use en dash without spaces",
    input: "Главы XI - XII и IV-V.",
    expected: `Главы XI–XII и${NBSP}IV–V`,
    settings: { languageMode: "ru" },
  },
  {
    group: "ranges and dashes",
    name: "ordinary hyphenated words are not treated as name ranges",
    input: "поп-музыка, онлайн-радио, рок-н-ролл.",
    expected: "поп-музыка, онлайн-радио, рок-н-ролл",
    settings: { languageMode: "ru" },
  },
  {
    group: "ranges and dashes",
    name: "Russian sentence dash uses em dash with regular NBSP before",
    input: "Музыка - настроение.",
    expected: `Музыка${NBSP}— настроение`,
    settings: { languageMode: "ru" },
  },
  {
    group: "ranges and dashes",
    name: "minus sign before number is normalized",
    input: "Температура -5, баланс - 100.",
    expected: "Температура −5, баланс −100",
    settings: { languageMode: "ru" },
  },

  // Quotes
  {
    group: "quotes ru",
    name: "straight Russian quotes become guillemets",
    input: '"Подписка подключена"',
    expected: "«Подписка подключена»",
    settings: { languageMode: "ru" },
  },
  {
    group: "quotes ru",
    name: "Russian quote punctuation moves outside and final period is removed in UI text",
    input: "«Подписка подключена.»",
    expected: "«Подписка подключена»",
    settings: { languageMode: "ru" },
  },
  {
    group: "quotes ru",
    name: "Russian abbreviation period inside quotes is preserved",
    input: "«и т. д.»",
    expected: `«и${NBSP}т.${NBSP}д.»`,
    settings: { languageMode: "ru" },
  },
  {
    group: "quotes en",
    name: "English apostrophes are normalized in words and decades",
    input: "don't, you're, artists' picks, James' album, rock 'n' roll, '80s.",
    expected: "don’t, you’re, artists’ picks, James’ album, rock ’n’ roll, ’80s",
    settings: { languageMode: "en" },
  },
  {
    group: "quotes en",
    name: "English double and single nested quotes are normalized",
    input: "\"First level with 'second level' inside\".",
    expected: "“First level with ‘second level’ inside”",
    settings: { languageMode: "en" },
  },
  {
    group: "quotes en",
    name: "English height notation is not converted to apostrophes",
    input: "Height 5'11\".",
    expected: "Height 5'11\"",
    settings: { languageMode: "en" },
  },

  // Protection layer
  {
    group: "protection",
    name: "URLs, emails, and deep links are protected",
    input: "https://example.com/a??b. www.example.com/test, mail@example.com, app://open/item?id=1.",
    expected: "https://example.com/a??b. www.example.com/test, mail@example.com, app://open/item?id=1",
  },
  {
    group: "protection",
    name: "file paths are protected",
    input: "./src/code.ts, ../ui.html, ~/file, C:\\Users\\Name\\file.txt.",
    expected: "./src/code.ts, ../ui.html, ~/file, C:\\Users\\Name\\file.txt",
  },
  {
    group: "protection",
    name: "inline code is protected but surrounding text is formatted",
    input: "`100р!!` и 100р!!",
    expected: `\`100р!!\` и${NBSP}100${NBSP}₽!`,
    settings: { languageMode: "ru" },
  },
  {
    group: "protection",
    name: "code-like tokens are protected",
    input: "button_primary, domain.surface.screen, release-1.2.3.",
    expected: "button_primary, domain.surface.screen, release-1.2.3",
  },
  {
    group: "protection",
    name: "placeholders stay intact while surrounding text is formatted",
    input: "До {count} треков. Привет, {{name}}. Скидка {discount} %. Ошибка {code} != 0. Цена ${price} р. %d треков, %@ слушает сейчас.",
    expected: `До${NBSP}{count} треков. Привет, {{name}}. Скидка {discount}%. Ошибка {code} ≠ 0. Цена \${price} р. %d треков, %@ слушает сейчас`,
  },
  {
    group: "protection",
    name: "HTML-like tags are protected and visible text inside is formatted",
    input: '<b>100р</b>, <a href="{url}">1/2</a>, <b>ошибка!=0</b>.',
    expected: `<b>100${NBSP}₽</b>, <a href="{url}">½</a>, <b>ошибка ≠ 0</b>`,
  },
  {
    group: "protection",
    name: "HTML entities are protected",
    input: "&nbsp;, &amp;, &quot;, &laquo;, &raquo;, &#160;, &#x202F;.",
    expected: "&nbsp;, &amp;, &quot;, &laquo;, &raquo;, &#160;, &#x202F;.",
  },
  {
    group: "protection",
    name: "space entities do not create extra regular spaces",
    input: "Ошибка&nbsp;!=0. Ошибка&#160;!=0. Ошибка&#x202F;!=0.",
    expected: "Ошибка&nbsp;≠ 0. Ошибка&#160;≠ 0. Ошибка&#x202F;≠ 0",
  },
  {
    group: "protection",
    name: "entities can sit next to formatted visible text",
    input: "Цена&nbsp;100р. Скидка&nbsp;1/2.",
    expected: `Цена&nbsp;100${NBSP}₽ Скидка&nbsp;½`,
  },
  {
    group: "icu protection",
    name: "plural block is protected while short surrounding Russian text is auto-detected",
    input: "До {count, plural, one {# трек} few {# трека} many {# треков} other {# трека}}.",
    expected: `До${NBSP}{count, plural, one {# трек} few {# трека} many {# треков} other {# трека}}`,
  },
  {
    group: "icu protection",
    name: "select block is protected while final period is removed",
    input: "Статус:{gender, select, male {Он готов} female {Она готова} other {Готово}}.",
    expected: "Статус:{gender, select, male {Он готов} female {Она готова} other {Готово}}",
  },
  {
    group: "icu protection",
    name: "nested select and plural block is protected",
    input: "{gender, select, male {{count, plural, one {# track} other {# tracks}}} other {No tracks}}",
    expected: "{gender, select, male {{count, plural, one {# track} other {# tracks}}} other {No tracks}}",
  },
  {
    group: "icu protection",
    name: "number skeleton block is protected and outside percent is glued",
    input: "Скидка {discount, number, percent} %.",
    expected: "Скидка {discount, number, percent}%",
  },
  {
    group: "icu protection",
    name: "English sentence around plural block is formatted without touching ICU syntax",
    input: "You have {count, plural, one {# track} other {# tracks}}.",
    expected: "You have {count, plural, one {# track} other {# tracks}}",
    settings: { languageMode: "auto" },
  },
];

const languageCases = [
  { name: "detects Russian text", input: "Привет мир", expected: "ru" },
  { name: "detects English text", input: "Hello world", expected: "en" },
  { name: "ignores HTML tags, entities, and placeholders", input: "<b>Привет</b>&nbsp;{count}", expected: "ru" },
  { name: "returns unknown for placeholder-only text", input: "{count}", expected: "unknown" },
  { name: "returns unknown for ICU-only text", input: "{count, plural, one {# трек} few {# трека} many {# треков} other {# трека}}", expected: "unknown" },
  { name: "uses ICU variant text for very short surrounding Russian text", input: "До {count, plural, one {# трек} few {# трека} many {# треков} other {# трека}}", expected: "ru" },
  { name: "ignores ICU internals when detecting surrounding Russian text", input: "Добавьте {count, plural, one {# track} other {# tracks}}", expected: "ru" },
  { name: "ignores ICU internals when detecting surrounding English text", input: "You have {count, plural, one {# трек} other {# треков}}", expected: "en" },
  { name: "returns unknown for very short latin text", input: "OK", expected: "unknown" },
  { name: "returns unknown for balanced mixed text", input: "Привет Hello", expected: "unknown" },
  { name: "forced Russian mode wins over auto-detect", input: "Hello world", mode: "ru", expected: "ru" },
  { name: "forced English mode wins over auto-detect", input: "Привет мир", mode: "en", expected: "en" },
];

function visible(value) {
  return value
    .replace(/\u00A0/g, "⍽")
    .replace(/\u202F/g, "⏤")
    .replace(/\n/g, "⏎\n");
}

function incrementGroupCount(groupCounts, group) {
  groupCounts.set(group, (groupCounts.get(group) || 0) + 1);
}

function run() {
  const formatter = loadFormatter();
  const failures = [];
  const groupCounts = new Map();

  for (const testCase of formatCases) {
    const actual = formatter.format(testCase.input, testCase.settings || {});
    incrementGroupCount(groupCounts, testCase.group);

    if (actual !== testCase.expected) {
      failures.push({ type: "format", ...testCase, actual });
    }
  }

  for (const testCase of languageCases) {
    const actual = formatter.detect(testCase.input, testCase.mode || "auto");
    incrementGroupCount(groupCounts, "language detection");

    if (actual !== testCase.expected) {
      failures.push({ type: "language", ...testCase, actual });
    }
  }

  const totalCount = formatCases.length + languageCases.length;

  if (failures.length === 0) {
    console.log(`Typography regression tests passed: ${totalCount}/${totalCount}`);
    console.log("\nCoverage by group:");
    for (const [group, count] of [...groupCounts.entries()].sort()) {
      console.log(`- ${group}: ${count}`);
    }
    return;
  }

  console.error(`Typography regression tests failed: ${failures.length}/${totalCount}`);

  for (const failure of failures) {
    console.error(`\n✗ [${failure.group || "language detection"}] ${failure.name}`);
    console.error("Input:   ", visible(failure.input));
    console.error("Expected:", visible(String(failure.expected)));
    console.error("Actual:  ", visible(String(failure.actual)));
  }

  process.exitCode = 1;
}

run();
