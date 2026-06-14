/// <reference path="./typography-engine.ts" />

type ApplySettings = TypotypoEngine.ApplySettings;
type LanguageStats = TypotypoEngine.LanguageStats;

figma.showUI(__html__, {
  width: 420,
  height: 1180,
});

const SETTINGS_STORAGE_KEY = "typographyFormatterSettings";

type TargetScope = "selection" | "currentPage";
type PreflightSkipReason = "hidden" | "locked" | "empty";

type TextNodeTarget = {
  targetScope: TargetScope;
  selectedCount: number;
  textNodes: TextNode[];
};

type TextNodeAvailabilitySummary = {
  totalTextNodeCount: number;
  availableTextNodeCount: number;
  skippedHiddenNodeCount: number;
  skippedLockedNodeCount: number;
  skippedEmptyNodeCount: number;
};

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
    await figma.clientStorage.setAsync(
      SETTINGS_STORAGE_KEY,
      TypotypoEngine.normalizeSettings(settings)
    );
  } catch (error) {
    console.error("Could not save settings:", error);
  }
}

function isNodeHiddenBySelfOrParent(node: BaseNode): boolean {
  let currentNode: BaseNode | null = node;

  while (currentNode) {
    if ("visible" in currentNode && currentNode.visible === false) {
      return true;
    }

    currentNode = currentNode.parent;
  }

  return false;
}

function isNodeLockedBySelfOrParent(node: BaseNode): boolean {
  let currentNode: BaseNode | null = node;

  while (currentNode) {
    if ("locked" in currentNode && currentNode.locked === true) {
      return true;
    }

    currentNode = currentNode.parent;
  }

  return false;
}

function getTextNodePreflightSkipReason(
  node: TextNode
): PreflightSkipReason | null {
  if (isNodeHiddenBySelfOrParent(node)) {
    return "hidden";
  }

  if (isNodeLockedBySelfOrParent(node)) {
    return "locked";
  }

  if (node.characters.trim().length === 0) {
    return "empty";
  }

  return null;
}

function collectTextNodesFromSceneNodeRoots(
  roots: readonly SceneNode[]
): TextNode[] {
  const textNodes: TextNode[] = [];
  const seenNodeIds = new Set<string>();

  function addTextNode(node: TextNode) {
    if (seenNodeIds.has(node.id)) {
      return;
    }

    seenNodeIds.add(node.id);
    textNodes.push(node);
  }

  function walk(node: SceneNode) {
    if (node.type === "TEXT") {
      addTextNode(node as TextNode);
      return;
    }

    if ("children" in node) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  for (const node of roots) {
    walk(node);
  }

  return textNodes;
}

function resolveTextNodeTarget(): TextNodeTarget {
  const selection = figma.currentPage.selection;

  if (selection.length === 0) {
    return {
      targetScope: "currentPage",
      selectedCount: 0,
      textNodes: collectTextNodesFromSceneNodeRoots(figma.currentPage.children),
    };
  }

  return {
    targetScope: "selection",
    selectedCount: selection.length,
    textNodes: collectTextNodesFromSceneNodeRoots(selection),
  };
}

function summarizeTextNodeAvailability(
  textNodes: TextNode[]
): TextNodeAvailabilitySummary {
  const summary: TextNodeAvailabilitySummary = {
    totalTextNodeCount: textNodes.length,
    availableTextNodeCount: 0,
    skippedHiddenNodeCount: 0,
    skippedLockedNodeCount: 0,
    skippedEmptyNodeCount: 0,
  };

  for (const node of textNodes) {
    const skipReason = getTextNodePreflightSkipReason(node);

    if (skipReason === "hidden") {
      summary.skippedHiddenNodeCount += 1;
      continue;
    }

    if (skipReason === "locked") {
      summary.skippedLockedNodeCount += 1;
      continue;
    }

    if (skipReason === "empty") {
      summary.skippedEmptyNodeCount += 1;
      continue;
    }

    summary.availableTextNodeCount += 1;
  }

  return summary;
}

function sendSelectionInfo() {
  const target = resolveTextNodeTarget();
  const availabilitySummary = summarizeTextNodeAvailability(target.textNodes);

  figma.ui.postMessage({
    type: "selection-info",
    targetScope: target.targetScope,
    selectedCount: target.selectedCount,
    textNodeCount: availabilitySummary.totalTextNodeCount,
    availableTextNodeCount: availabilitySummary.availableTextNodeCount,
    skippedHiddenNodeCount: availabilitySummary.skippedHiddenNodeCount,
    skippedLockedNodeCount: availabilitySummary.skippedLockedNodeCount,
    skippedEmptyNodeCount: availabilitySummary.skippedEmptyNodeCount,
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

  for (
    let currentOriginalIndex = originalIndex;
    currentOriginalIndex < maxOriginalIndex;
    currentOriginalIndex++
  ) {
    for (
      let currentFormattedIndex = formattedIndex;
      currentFormattedIndex < maxFormattedIndex;
      currentFormattedIndex++
    ) {
      if (
        originalText[currentOriginalIndex] !== formattedText[currentFormattedIndex]
      ) {
        continue;
      }

      const distance =
        currentOriginalIndex - originalIndex +
        currentFormattedIndex - formattedIndex;

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

    const nextOriginalIndex = nextMatch
      ? nextMatch.originalIndex
      : originalText.length;
    const nextFormattedIndex = nextMatch
      ? nextMatch.formattedIndex
      : formattedText.length;

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

async function loadFontsForTextNode(node: TextNode) {
  const fonts: FontName[] = [];

  function addFont(fontName: FontName | typeof figma.mixed) {
    if (fontName !== figma.mixed) {
      fonts.push(fontName as FontName);
    }
  }

  if (node.fontName !== figma.mixed) {
    addFont(node.fontName as FontName);
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

async function updateTextNodeCharactersPreservingStyles(
  node: TextNode,
  formattedText: string
) {
  const originalText = node.characters;
  const originalStyles = getTextStyleSnapshots(node);

  await loadFontsForTextNode(node);
  await loadFontsFromStyleSnapshots(originalStyles);

  node.characters = formattedText;
  applyStyleSnapshotsToFormattedText(
    node,
    originalText,
    formattedText,
    originalStyles
  );
}

async function applyTypographyRules(settings: ApplySettings) {
  const safeSettings = TypotypoEngine.normalizeSettings(settings);
  const target = resolveTextNodeTarget();

  let changedNodeCount = 0;
  let unchangedNodeCount = 0;
  let totalReplacementCount = 0;
  let skippedHiddenNodeCount = 0;
  let skippedLockedNodeCount = 0;
  let skippedEmptyNodeCount = 0;
  let errorNodeCount = 0;
  let skippedRuleCount = 0;

  const languageStats: LanguageStats = {
    ru: 0,
    en: 0,
    unknown: 0,
  };

  for (const node of target.textNodes) {
    const skipReason = getTextNodePreflightSkipReason(node);

    if (skipReason === "hidden") {
      skippedHiddenNodeCount += 1;
      continue;
    }

    if (skipReason === "locked") {
      skippedLockedNodeCount += 1;
      continue;
    }

    if (skipReason === "empty") {
      skippedEmptyNodeCount += 1;
      continue;
    }

    try {
      const originalText = node.characters;
      const language = TypotypoEngine.resolveLanguage(
        originalText,
        safeSettings.languageMode
      );

      languageStats[language] += 1;

      const result = TypotypoEngine.applyRulesToText(
        originalText,
        safeSettings,
        language
      );

      skippedRuleCount += result.skippedRuleCount;

      if (
        result.replacementCount === 0 ||
        result.formattedText === originalText
      ) {
        unchangedNodeCount += 1;
        continue;
      }

      await updateTextNodeCharactersPreservingStyles(
        node,
        result.formattedText
      );

      changedNodeCount += 1;
      totalReplacementCount += result.replacementCount;
    } catch (error) {
      console.error("Could not update text node:", error);
      errorNodeCount += 1;
    }
  }

  const skippedNodeCount =
    skippedHiddenNodeCount +
    skippedLockedNodeCount +
    skippedEmptyNodeCount +
    errorNodeCount;

  figma.ui.postMessage({
    type: "apply-result",
    targetScope: target.targetScope,
    selectedCount: target.selectedCount,
    totalTextNodeCount: target.textNodes.length,
    changedNodeCount,
    unchangedNodeCount,
    totalReplacementCount,
    skippedNodeCount,
    skippedHiddenNodeCount,
    skippedLockedNodeCount,
    skippedEmptyNodeCount,
    errorNodeCount,
    skippedRuleCount,
    languageStats,
  });

  figma.notify(
    `Updated ${changedNodeCount} text layer${changedNodeCount === 1 ? "" : "s"}` +
      (skippedNodeCount > 0 ? ` · Skipped ${skippedNodeCount}` : "")
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
    await saveSettings(message.settings);
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
