/// <reference path="./typography-engine.ts" />

type ApplySettings = TypotypoEngine.ApplySettings;
type LanguageStats = TypotypoEngine.LanguageStats;

figma.showUI(__html__, {
  width: 420,
  height: 1180,
});

const SETTINGS_STORAGE_KEY = "typographyFormatterSettings";

async function loadSettings(): Promise<ApplySettings> {
  try {
    const storedSettings = await figma.clientStorage.getAsync(
      SETTINGS_STORAGE_KEY
    );

    return TypotypoEngine.normalizeSettings(storedSettings);
  } catch (error) {
    console.error("Could not load settings:", error);
    return TypotypoEngine.DEFAULT_SETTINGS;
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

function sendSelectionInfo() {
  const selectedTextNodes = findTextNodesInSelection();

  figma.ui.postMessage({
    type: "selection-info",
    selectedCount: figma.currentPage.selection.length,
    textNodeCount: selectedTextNodes.length,
  });
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
  const safeSettings = TypotypoEngine.normalizeSettings(settings);
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
    const language = TypotypoEngine.resolveLanguage(originalText, safeSettings.languageMode);

    languageStats[language] += 1;

    const result = TypotypoEngine.applyRulesToText(originalText, safeSettings, language);

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
    await saveSettings(TypotypoEngine.normalizeSettings(message.settings));
  }

  if (message.type === "apply") {
    const safeSettings = TypotypoEngine.normalizeSettings(message.settings);

    await saveSettings(safeSettings);
    await applyTypographyRules(safeSettings);
  }

  if (message.type === "close") {
    figma.closePlugin();
  }
};

initializePlugin();

