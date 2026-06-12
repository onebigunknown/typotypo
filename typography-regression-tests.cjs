/* eslint-disable */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const CODE_PATH = path.join(process.cwd(), "code.ts");

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

const testCases = [
  {
    name: "spacing, brackets, punctuation, currency, fractions, ranges",
    input:
      "Привет ,мир. Ошибка:повторите(код 500). Готово!!! Ну правда...? 100р!! 1/2?? 2020 - 2024(период)",
    expected:
      `Привет, мир. Ошибка: повторите (код 500). Готово! Ну правда?.. 100${NBSP}₽! ½? 2020–2024 (период)`,
  },
  {
    name: "placeholders stay intact while surrounding text is formatted",
    input:
      "До {count} треков. Привет, {{name}}. Скидка {discount} %. Ошибка {code} != 0. Цена ${price} р. %d треков, %@ слушает сейчас.",
    expected:
      `До${NBSP}{count} треков. Привет, {{name}}. Скидка {discount}%. Ошибка {code} ≠ 0. Цена \${price} р. %d треков, %@ слушает сейчас`,
  },
  {
    name: "HTML-like tags are protected but visible text inside is formatted",
    input: "<b>100р</b>, <b>1/2</b>, <b>ошибка!=0</b>.",
    expected: `<b>100${NBSP}₽</b>, <b>½</b>, <b>ошибка ≠ 0</b>`,
  },
  {
    name: "HTML entities are protected and do not create extra spaces",
    input: "Ошибка&nbsp;!=0. Цена&nbsp;100р. Скидка&nbsp;1/2.",
    expected: `Ошибка&nbsp;≠ 0. Цена&nbsp;100${NBSP}₽ Скидка&nbsp;½`,
  },
  {
    name: "URLs, inline code, and code-like strings are protected",
    input:
      "Не ломать: https://example.com/a??b, `100р!!`, function(), array[index], if(a>b).",
    expected:
      "Не ломать: https://example.com/a??b, `100р!!`, function(), array[index], if(a>b)",
  },
  {
    name: "Russian non-breaking spaces for initials, short words, signs, and addresses",
    input: "А. А. Иванов, Петров К. П. до 5 треков, д. 5, № 5, § 3.",
    expected: `А.${NBSP}А.${NBSP}Иванов, Петров${NBSP}К. П. до${NBSP}5${NBSP}треков, д.${NBSP}5, №${NBSP}5, §${NBSP}3`,
    settings: { languageMode: "ru" },
  },
  {
    name: "special symbols, temperatures, multiplication, arrows, and comparisons",
    input: "25°C, - 45 deg, 10x20, ошибка<=0, ошибка>=1, a<->b.",
    expected: `25${NBSP}°C, −45°, 10×20, ошибка≤0, ошибка≥1, a←→b`,
  },
  {
    name: "English apostrophes",
    input: "don't, you're, artists' picks, James' album, rock 'n' roll, 5'11\".",
    expected: "don’t, you’re, artists’ picks, James’ album, rock ’n’ roll, 5'11\"",
    settings: { languageMode: "en" },
  },
  {
    name: "English quote nesting",
    input: "'First level with \"second level\" inside'",
    expected: "‘First level with “second level” inside’",
    settings: { languageMode: "en" },
  },
  {
    name: "UI final period preserves known abbreviations and technical endings",
    input: "Dr. example.com v2.0 т. д. 100 руб.",
    expected: `Dr. example.com v2.0 т. д. 100${NBSP}руб.`,
  },
  {
    name: "space-entities with common variants",
    input: "Ошибка&#160;!=0. Ошибка&#x202F;!=0. Цена&nbsp;100р.",
    expected: `Ошибка&#160;≠ 0. Ошибка&#x202F;≠ 0. Цена&nbsp;100${NBSP}₽`,
  },
  {
    name: "narrow NBSP remains limited around currency; Russian word pairs stay regular NBSP",
    input: "100 ₽, до 5 треков.",
    expected: `100 ₽, до${NBSP}5${NBSP}треков`,
    settings: {
      languageMode: "ru",
      options: { nonBreakingSpaceStyle: "narrow" },
    },
  },
];

function visible(value) {
  return value
    .replace(/\u00A0/g, "⍽")
    .replace(/\u202F/g, "⏤")
    .replace(/\n/g, "⏎\n");
}

function run() {
  const formatter = loadFormatter();
  const failures = [];

  for (const testCase of testCases) {
    const actual = formatter.format(testCase.input, testCase.settings || {});

    if (actual !== testCase.expected) {
      failures.push({ ...testCase, actual });
    }
  }

  if (failures.length === 0) {
    console.log(`Typography regression tests passed: ${testCases.length}/${testCases.length}`);
    return;
  }

  console.error(`Typography regression tests failed: ${failures.length}/${testCases.length}`);

  for (const failure of failures) {
    console.error(`\n✗ ${failure.name}`);
    console.error("Input:   ", visible(failure.input));
    console.error("Expected:", visible(failure.expected));
    console.error("Actual:  ", visible(failure.actual));
  }

  process.exitCode = 1;
}

run();
