/* eslint-disable */
const { loadFormatter, NBSP, visible } = require("./typography-regression-tests.cjs");

const FIGMA_LINE_SEPARATOR = "\u2028";

function toFigmaText(value) {
  return value.replace(/\r\n?/g, "\n").replace(/\n/g, FIGMA_LINE_SEPARATOR);
}

const stressCases = [
  {
    name: "1. CLEANUP AND SPACING",
    input: toFigmaText([
      "   Лишние   пробелы перед  и  после текста.   ",
      "Трек\t\tальбом\tартист",
      "Первая строка",
      "вторая строка",
      "",
      "Первый абзац.",
      "",
      "Второй абзац.",
      "До\u00ADба\u200Bвить\uFEFF трек",
      "Эмодзи с ZWJ должны сохраниться: 👨‍👩‍👧‍👦 👩‍💻 🧑‍🎨",
    ].join("\n")),
    expected: [
      `Лишние пробелы перед${NBSP}и после${NBSP}текста. Трек альбом артист Первая строка вторая строка`,
      "",
      "Первый абзац",
      "",
      `Второй абзац. Добавить трек Эмодзи с${NBSP}ZWJ должны сохраниться: 👨‍👩‍👧‍👦 👩‍💻 🧑‍🎨`,
    ].join("\n"),
  },
  {
    name: "2. UI SEPARATORS AND ENCLOSURES",
    input: toFigmaText([
      "Треки|альбомы. Артисты |плейлисты. Подкасты| радио.",
      "Tracks|Albums. Artists |Playlists. Podcasts| Radio.",
      "Треки·альбомы. Треки ·альбомы. Треки· альбомы.",
      "Tracks·Albums. Tracks ·Albums. Tracks· Albums.",
      "( текст внутри скобок )",
      "[ текст внутри квадратных скобок ]",
      "{ текст внутри фигурных скобок }",
      "« текст внутри кавычек »",
      "Кнопка:«Сохранить»",
      'Label:"Save"',
    ].join("\n")),
    expected: [
      "Треки | альбомы. Артисты | плейлисты. Подкасты | радио.",
      "Tracks | Albums. Artists | Playlists. Podcasts | Radio.",
      "Треки · альбомы. Треки · альбомы. Треки · альбомы.",
      "Tracks · Albums. Tracks · Albums. Tracks · Albums.",
      "(текст внутри скобок)",
      "[текст внутри квадратных скобок]",
      "{ текст внутри фигурных скобок }",
      "«текст внутри кавычек»",
      "Кнопка: «Сохранить»",
      'Label: "Save"',
    ].join(FIGMA_LINE_SEPARATOR),
  },
  {
    name: "3. PUNCTUATION",
    input: toFigmaText([
      "Привет ,мир !Как дела ?Всё хорошо ;да.",
      "Hello ,world !How are you ?Everything is fine ;yes.",
      "Что?!Правда!?Да!!",
      "Версия 1.2.3, цена 10,50 и время 12:30.",
      "Точка в конце короткого UI-текста.",
      "Это длинное предложение с несколькими частями. Его финальную точку нужно сохранить.",
    ].join("\n")),
    expected: `Привет, мир! Как${NBSP}дела? Всё${NBSP}хорошо; да. Hello, world! How are you? Everything is fine; yes. Что?! Правда?! Да! Версия 1.2.3, цена 10,50${NBSP}и${NBSP}время 12:30. Точка в${NBSP}конце короткого UI-текста. Это${NBSP}длинное предложение с${NBSP}несколькими частями. Его финальную точку нужно сохранить.`,
  },
  {
    name: "4. QUOTES AND APOSTROPHES",
    input: toFigmaText([
      '"Внешняя цитата и "внутренняя цитата"."',
      '"Outer quote and \'inner quote\'."',
      'Он сказал: "Это "очень" важно".',
      'She said: "It\'s John\'s album."',
      "rock 'n' roll",
      "'cause we're ready",
      "students' choice",
      "the '90s",
      '12" display',
      'Размер 15" и высота 20".',
    ].join("\n")),
    expected: [
      '"Внешняя цитата и "внутренняя цитата"."',
      '"Outer quote and \'inner quote\'."',
      'Он сказал: "Это "очень" важно".',
      'She said: "It\'s John\'s album."',
      "rock 'n' roll",
      "'cause we're ready",
      "students' choice",
      "the '90s",
      '12" display',
      'Размер 15" и высота 20".',
    ].join(FIGMA_LINE_SEPARATOR),
  },
  {
    name: "5. DASHES, RANGES, AND HYPHENS",
    input: toFigmaText([
      "Музыка - это жизнь.",
      "Музыка—это жизнь.",
      "Музыка – это жизнь.",
      "2020 - 2024",
      "2020–2024",
      "10:00 - 18:30",
      "январь - март",
      "понедельник—пятница",
      "XI - XII",
      "№ 5 - 7",
      "§ 10—12",
      "поп–музыка, онлайн—радио, рок−н−ролл.",
      "инди‑рок и пост‒панк.",
      "A - B",
      "x - y",
    ].join("\n")),
    expected: `Музыка${NBSP}— это${NBSP}жизнь. Музыка${NBSP}— это${NBSP}жизнь. Музыка${NBSP}— это${NBSP}жизнь. 2020–2024 2020–2024 10:00–18:30${NBSP}январь–март понедельник–пятница XI–XII №${NBSP}5–7 §${NBSP}10–12${NBSP}поп-музыка, онлайн-радио, рок-н-ролл. инди-рок и${NBSP}пост-панк. A${NBSP}— B x${NBSP}— y`,
  },
  {
    name: "6. NUMBERS, UNITS, AND SYMBOLS",
    input: toFigmaText([
      "300 МБ, 20 кг, 15 км, 12 px, 8 dp, 24 pt, 1.5 rem, 2 em.",
      "30 ° C, 25°С, 77 ° F.",
      "50 %, 100 %.",
      "№5, № 6, §7, § 8.",
      "12000, 1234567, 1 234 567, 9 876 543.",
      "1/2, 1/3, 2/3, 1/4, 3/4.",
      "1920 x 1080, 2х3.",
      "(c), (C), (tm), +/-, !=, <=, >=, ->, <-.",
      '5" screen, 12" record.',
    ].join("\n")),
    expected: `300${NBSP}МБ, 20${NBSP}кг, 15${NBSP}км, 12${NBSP}px, 8${NBSP}dp, 24${NBSP}pt, 1.5${NBSP}rem, 2${NBSP}em. 30${NBSP}°C, 25${NBSP}°C, 77${NBSP}°F. 50%, 100%. №${NBSP}5, №${NBSP}6, §${NBSP}7, §${NBSP}8. 12${NBSP}000, 1${NBSP}234${NBSP}567, 1${NBSP}234${NBSP}567, 9${NBSP}876${NBSP}543. ½, ⅓, ⅔, ¼, ¾. 1920×1080, 2×3. ©, ©, ™, ±, ≠, ≤, ≥, →, ←. 5" screen, 12" record`,
  },
  {
    name: "7. CURRENCY",
    input: toFigmaText([
      "Цена 100р. Музыка.",
      "Цена 100 р. Музыка.",
      "Цена 100 руб. Музыка.",
      "Цена 789 руб., 100 рублей, 50 RUB и 60 RUR.",
      "Стоимость 20usd, 30 EUR, $ 40 и 50€.",
      "Подписка стоит $10, 20$, €30, 40€, £50 и 60£.",
      "Цена 1 234,56 руб.",
      "Стоимость -100 руб. и +200 руб.",
      "Price: $ 10.50, 20.75 USD, EUR 30.25 and 40,50€.",
      "From $10 to $20.",
      "Тариф от 100 руб. до 500 руб.",
    ].join("\n")),
    expected: `Цена 100${NBSP}₽. Музыка. Цена 100${NBSP}₽. Музыка. Цена 100${NBSP}₽. Музыка. Цена 789${NBSP}₽, 100${NBSP}₽, 50${NBSP}₽ и${NBSP}60${NBSP}₽. Стоимость 20${NBSP}$, 30${NBSP}€, 40${NBSP}$ и${NBSP}50${NBSP}€. Подписка стоит 10${NBSP}$, 20${NBSP}$, 30${NBSP}€, 40${NBSP}€, £50${NBSP}и${NBSP}60£. Цена 1${NBSP}234,56${NBSP}₽. Стоимость −100${NBSP}₽ и +200${NBSP}₽. Price: $10.50, $20.75, €30.25 and €40.50. From $10 to $20. Тариф от${NBSP}100${NBSP}₽ до${NBSP}500${NBSP}₽`,
  },
  {
    name: "8. RUSSIAN NON-BREAKING SPACES",
    input: toFigmaText([
      "Я и ты в Москве.",
      "В доме и на улице.",
      "К нему, с ней, у нас.",
      "Это было бы хорошо.",
      "Сделали же всё правильно.",
      "См. гл. 5, рис. 2, табл. 3, стр. 10.",
      "г. Москва, ул. Тверская, д. 12, корп. 2, кв. 45.",
      'ООО "Ромашка", ПАО «Музыка», ИП Иванов.',
      "И. И. Иванов",
      "И.И. Иванов",
      "Иванов И. И.",
      "10 тыс, 20 тыс., 3 млн., 4 млрд., 5 трлн.",
      "100 человек, 25 треков, 3 альбома.",
    ].join("\n")),
    expected: [
      `Я и${NBSP}ты в${NBSP}Москве. В${NBSP}доме и${NBSP}на улице. К${NBSP}нему, с${NBSP}ней, у${NBSP}нас. Это${NBSP}было${NBSP}бы${NBSP}хорошо. Сделали${NBSP}же${NBSP}всё правильно. См.${NBSP}гл.${NBSP}5, рис.${NBSP}2, табл.${NBSP}3, стр.${NBSP}10`,
      `г.${NBSP}Москва, ул.${NBSP}Тверская, д.${NBSP}12, корп.${NBSP}2, кв.${NBSP}45`,
      `ООО${NBSP}«Ромашка», ПАО${NBSP}«Музыка», ИП${NBSP}Иванов`,
      `И.${NBSP}И.${NBSP}Иванов`,
      `И.${NBSP}И.${NBSP}Иванов`,
      `Иванов${NBSP}И.${NBSP}И. 10${NBSP}тыс., 20${NBSP}тыс., 3${NBSP}млн, 4${NBSP}млрд, 5${NBSP}трлн. 100${NBSP}человек, 25${NBSP}треков, 3${NBSP}альбома`,
    ].join("\n"),
  },
  {
    name: "9. LISTS",
    input: toFigmaText([
      "- Первый пункт",
      "-Второй пункт",
      "-  Третий пункт",
      "– Четвёртый пункт",
      "—Пятый пункт",
      "* Шестой пункт",
      "•Седьмой пункт",
      "1.Первый пункт",
      "2. Второй пункт",
      "10)Третий пункт",
      "a)English item",
      "b. Another item",
    ].join("\n")),
    expected: [
      "- Первый пункт",
      "- Второй пункт",
      "- Третий пункт",
      "— Четвёртый пункт",
      "— Пятый пункт",
      "* Шестой пункт",
      "• Седьмой пункт",
      "1. Первый пункт",
      "2. Второй пункт",
      "10) Третий пункт",
      "a) English item",
      "b. Another item",
    ].join("\n"),
  },
  {
    name: "10. PROTECTED CONTENT",
    input: toFigmaText([
      "https://example.com/path?q=rock-and-roll",
      "www.example.com/test",
      "hello@example.com",
      "user.name+music@example.co.uk",
      'const album_name = "rock - roll";',
      "`price = 100 руб.`",
      '<div class="card">Цена 100 руб.</div>',
      '<span data-label="Hello - world">Текст</span>',
      "&nbsp; &amp; &#160; &#x202F;",
      "{count}",
      "${price}",
      "{count, plural, one {# трек} few {# трека} many {# треков} other {# трека}}",
      "Добавьте {count, plural, one {# track} other {# tracks}}",
      "You have {count, plural, one {# трек} other {# треков}}",
      "%s %d %1$s",
      "./src/typography-engine.ts",
      "../assets/icon.svg",
      "~/Projects/typotypo",
      "C:\\Users\\Anton\\typotypo",
      "v1.0.3",
      "2.4.10-beta.1",
      "com.typotypo.plugin",
      "API_RESPONSE_CODE",
      "user_profile-card",
      "feature/optimize-scope-switch",
      "16/9-preview",
      "1/2",
      "12/24-format",
    ].join("\n")),
    expected: `https://example.com/path?q=rock-and-roll www.example.com/test hello@example.com user.name+music@example.co.uk const album_name = "rock - roll"; \`price = 100 руб.\` <div class="card">Цена 100${NBSP}₽</div> <span data-label="Hello - world">Текст</span> &nbsp;&amp; &#160;&#x202F;{count} \${price} {count, plural, one {# трек} few {# трека} many {# треков} other {# трека}} Добавьте {count, plural, one {# track} other {# tracks}} You have {count, plural, one {# трек} other {# треков}} %s %d %1$s ./src/typography-engine.ts ../assets/icon.svg ~/Projects/typotypo C:\\Users\\Anton\\typotypo v1.0.3 2.4.10-beta.1 com.typotypo.plugin API_RESPONSE_CODE user_profile-card feature/optimize-scope-switch 16/9-preview 1/2 12/24-format`,
    protectedFragments: [
      "https://example.com/path?q=rock-and-roll",
      "www.example.com/test",
      "hello@example.com",
      "user.name+music@example.co.uk",
      'const album_name = "rock - roll";',
      "`price = 100 руб.`",
      'class="card"',
      'data-label="Hello - world"',
      "&nbsp;&amp; &#160;&#x202F;",
      "{count}",
      "${price}",
      "{count, plural, one {# трек} few {# трека} many {# треков} other {# трека}}",
      "Добавьте {count, plural, one {# track} other {# tracks}}",
      "You have {count, plural, one {# трек} other {# треков}}",
      "%s %d %1$s",
      "./src/typography-engine.ts",
      "../assets/icon.svg",
      "~/Projects/typotypo",
      "C:\\Users\\Anton\\typotypo",
      "v1.0.3",
      "2.4.10-beta.1",
      "com.typotypo.plugin",
      "API_RESPONSE_CODE",
      "user_profile-card",
      "feature/optimize-scope-switch",
      "16/9-preview",
      "1/2",
      "12/24-format",
    ],
  },
  {
    name: "11. LANGUAGE DETECTION",
    input: toFigmaText([
      "Привет мир",
      "Hello world",
      "OK",
      "Да",
      "Привет Hello",
      "<b>Привет</b>&nbsp;{count}",
      "{count, plural, one {# трек} few {# трека} many {# треков} other {# трека}}",
      "До {count, plural, one {# трек} few {# трека} many {# треков} other {# трека}}",
    ].join("\n")),
    expected: `Привет мир Hello world OK Да${NBSP}Привет Hello <b>Привет</b>&nbsp;{count} {count, plural, one {# трек} few {# трека} many {# треков} other {# трека}} До${NBSP}{count, plural, one {# трек} few {# трека} many {# треков} other {# трека}}`,
  },
  {
    name: "12. IDEMPOTENCY",
    input: toFigmaText([
      `Музыка${NBSP}— это${NBSP}жизнь`,
      `Цена 100${NBSP}₽`,
      `300${NBSP}МБ`,
      `1\u202F234\u202F567`,
      "«Готовый текст»",
      "Tracks | Albums",
      "инди-рок",
      "2020–2024",
    ].join("\n")),
    expected: `Музыка${NBSP}— это${NBSP}жизнь Цена 100${NBSP}₽ 300${NBSP}МБ 1${NBSP}234${NBSP}567 «Готовый текст» Tracks | Albums инди-рок 2020–2024`,
  },
];

function run() {
  const formatter = loadFormatter();
  const failures = [];
  let protectionCheckCount = 0;

  for (const testCase of stressCases) {
    const firstPass = formatter.format(testCase.input);

    if (firstPass !== testCase.expected) {
      failures.push({
        type: "first pass",
        name: testCase.name,
        expected: testCase.expected,
        actual: firstPass,
      });
      continue;
    }

    const secondPass = formatter.format(firstPass);
    if (secondPass !== firstPass) {
      failures.push({
        type: "idempotency",
        name: testCase.name,
        expected: firstPass,
        actual: secondPass,
      });
    }

    for (const fragment of testCase.protectedFragments || []) {
      protectionCheckCount += 1;
      if (!firstPass.includes(fragment)) {
        failures.push({
          type: "protected content",
          name: testCase.name,
          expected: fragment,
          actual: firstPass,
        });
      }
    }
  }

  if (failures.length === 0) {
    console.log(`Typography stress tests passed: ${stressCases.length}/${stressCases.length}`);
    console.log(`Idempotency checks passed: ${stressCases.length}/${stressCases.length}`);
    console.log(`Protected-content checks passed: ${protectionCheckCount}/${protectionCheckCount}`);
    return;
  }

  console.error(`Typography stress tests failed: ${failures.length}`);
  for (const failure of failures) {
    console.error(`\n✗ [${failure.type}] ${failure.name}`);
    console.error("Expected:", visible(String(failure.expected)));
    console.error("Actual:  ", visible(String(failure.actual)));
  }
  process.exitCode = 1;
}

run();
