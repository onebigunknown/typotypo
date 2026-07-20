# Typotypo

Typography cleanup for Russian and English interface text in Figma.

Typotypo helps designers and writers clean up interface copy without leaving the design file. Select text layers, a frame, or a section—or run the plugin across the current page.

No AI, analytics, or network access.

## Features

- Formats selected text layers and text inside selected frames or sections
- Formats editable text layers on the current page when nothing is selected
- Supports Russian and English typography
- Automatically detects the text language or lets you choose it manually
- Applies configurable rules for spaces, line breaks, ellipses, quotes, apostrophes, dashes, numbers, units, symbols, and non-breaking spaces
- Preserves text formatting and linked styles where possible
- Skips hidden, locked, unavailable, or otherwise non-editable layers
- Includes Russian and English interfaces
- Supports light, dark, and system themes
- Stores rule preferences between launches

## How to use

1. Select one or more text layers, frames, or sections in Figma.
2. Open Typotypo.
3. Review the detected scope and available text layers.
4. Enable the typography rules you need.
5. Choose automatic, Russian, or English text language.
6. Click **Apply formatting**.

When nothing is selected, Typotypo works with editable text layers on the current page.

## Privacy

Typotypo does not collect, transmit, sell, or share personal data.

Text from Figma documents is processed locally inside the plugin and is not sent to external servers. The plugin does not use analytics and has no network access.

Interface preferences and typography settings may be stored locally using Figma client storage.

See [PRIVACY.md](PRIVACY.md) for the full privacy policy.

## Support

Found a bug or have an idea?

[Open an issue](https://github.com/onebigunknown/typotypo/issues).

Please include:

- what you expected to happen;
- what happened instead;
- the selected language and enabled rules;
- a minimal text example;
- your Figma platform and operating system.

## Development

Requirements:

- Node.js
- npm
- Figma desktop app

Install dependencies:

```bash
npm ci
```

Build the plugin (compiles `code.ts` to `code.js`):

```bash
npm run build
```

Run the build and lint checks together:

```bash
npm run check
```

Rebuild automatically on file changes:

```bash
npm run watch
```

### Import into Figma Desktop

1. Open the Figma desktop app.
2. Go to **Plugins → Development → Import plugin from manifest…**.
3. Select the `manifest.json` file in this repository.
4. The plugin appears under **Plugins → Development** and can be run from there.

## Support the project

Typotypo is free to use.

[Support the creator](https://pay.cloudtips.ru/p/7eebd503)

## License

See [LICENSE](LICENSE).
