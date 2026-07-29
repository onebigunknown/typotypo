/// <reference path="./typography-engine.ts" />

type ApplySettings = TypotypoEngine.ApplySettings;
type LanguageStats = TypotypoEngine.LanguageStats;

figma.showUI(__html__, {
  width: 420,
  height: 640,
});

const SETTINGS_STORAGE_KEY = "typographyFormatterSettings";
const UI_SETTINGS_STORAGE_KEY = "typotypoInterfaceSettings";

type UiLanguage = "ru" | "en";
type UiTheme = "light" | "dark" | "system";

type UiSettings = {
  uiLanguage?: UiLanguage;
  theme?: UiTheme;
};


type TargetScope = "selection" | "currentPage";
type ScopeType =
  | "currentPage"
  | "textLayer"
  | "frame"
  | "section"
  | "group"
  | "selectedLayers";
type PreflightSkipReason = "hidden" | "locked" | "empty";

type TextNodeTarget = {
  targetScope: TargetScope;
  scopeType: ScopeType;
  selectionKey: string;
  selectedCount: number;
  textNodes: TextNode[];
};

type TextNodeAvailabilitySummary = {
  totalTextNodeCount: number;
  availableTextNodeCount: number;
  skippedHiddenNodeCount: number;
  skippedLockedNodeCount: number;
  skippedEmptyNodeCount: number;
  skippedMissingFontsNodeCount: number;
};

type TextNodeAvailabilityState =
  | "available"
  | "hidden"
  | "locked"
  | "empty"
  | "missingFonts";

type TextNodeAvailabilityAnalysis = {
  summary: TextNodeAvailabilitySummary;
  states: Map<string, TextNodeAvailabilityState>;
};

type PageAvailabilityCacheEntry = {
  summary: TextNodeAvailabilitySummary | null;
  textNodes: Map<string, TextNode>;
  nodeStates: Map<string, TextNodeAvailabilityState>;
  dirty: boolean;
  revision: number;
  pending: Promise<TextNodeAvailabilitySummary> | null;
  updateQueue: Promise<void>;
  lastAccessedAt: number;
};

type PageNodeChangeSubscription = {
  page: PageNode;
  callback: (event: NodeChangeEvent) => void;
};

const PAGE_AVAILABILITY_RELEVANT_PROPERTIES = new Set<NodeChangeProperty>([
  "parent",
  "locked",
  "visible",
  "styledTextSegments",
  "fontName",
  "textStyleId",
  "componentPropertyReferences",
  "componentProperties",
  "type",
]);

const MAX_CACHED_PAGES = 10;

const pageAvailabilityCache = new Map<string, PageAvailabilityCacheEntry>();
const pageNodeChangeSubscriptions = new Map<
  string,
  PageNodeChangeSubscription
>();

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

function normalizeUiSettings(value: unknown): UiSettings {
  if (!value || typeof value !== "object") {
    return {};
  }

  const rawSettings = value as {
    uiLanguage?: unknown;
    uiLanguageMode?: unknown;
    theme?: unknown;
  };
  const rawLanguage = rawSettings.uiLanguage ?? rawSettings.uiLanguageMode;
  const safeUiSettings: UiSettings = {};

  if (rawLanguage === "ru" || rawLanguage === "en") {
    safeUiSettings.uiLanguage = rawLanguage;
  }

  if (
    rawSettings.theme === "light" ||
    rawSettings.theme === "dark" ||
    rawSettings.theme === "system"
  ) {
    safeUiSettings.theme = rawSettings.theme;
  }

  return safeUiSettings;
}

async function loadUiSettings(): Promise<UiSettings> {
  try {
    const storedUiSettings = await figma.clientStorage.getAsync(
      UI_SETTINGS_STORAGE_KEY
    );

    return normalizeUiSettings(storedUiSettings);
  } catch (error) {
    console.error("Could not load UI settings:", error);
    return {};
  }
}

async function saveUiSettings(uiSettings: unknown) {
  try {
    const safeUiSettings = normalizeUiSettings(uiSettings);

    if (!safeUiSettings.uiLanguage && !safeUiSettings.theme) {
      return;
    }

    await figma.clientStorage.setAsync(UI_SETTINGS_STORAGE_KEY, safeUiSettings);
  } catch (error) {
    console.error("Could not save UI settings:", error);
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

// Combined, cached hidden/locked ancestor resolution used only by
// analyzeTextNodeAvailability's pre-analysis pass. The cache is created fresh
// per analyzeTextNodeAvailability call (see there) so it never outlives a
// single analysis and cannot serve stale values across nodechange events.
// Semantics mirror isNodeHiddenBySelfOrParent/isNodeLockedBySelfOrParent
// exactly (same "in" guards, same OR-over-ancestors rule), just computed
// together in one walk instead of two, with results memoized per node id.
type AncestorAvailabilityFlags = {
  hidden: boolean;
  locked: boolean;
};

// Own visible/locked state of an ancestor, plus its parent link, read from
// Figma exactly once per ancestor per analysis and memoized by node object
// identity (no node.id reads on this hot path).
type AncestorLocalData = {
  parent: BaseNode | null;
  selfHidden: boolean;
  selfLocked: boolean;
};

function getAncestorLocalData(
  ancestor: BaseNode,
  ancestorLocalDataCache: Map<BaseNode, AncestorLocalData>
): AncestorLocalData {
  const cached = ancestorLocalDataCache.get(ancestor);

  if (cached) {
    return cached;
  }

  const localData: AncestorLocalData = {
    parent: ancestor.parent,
    selfHidden: "visible" in ancestor && ancestor.visible === false,
    selfLocked: "locked" in ancestor && ancestor.locked === true,
  };

  ancestorLocalDataCache.set(ancestor, localData);
  return localData;
}

// Combined, cached hidden/locked ancestor resolution used only by
// analyzeTextNodeAvailability's pre-analysis pass. Both caches are created
// fresh per analyzeTextNodeAvailability call (see there) so they never
// outlive a single analysis and cannot serve stale values across
// nodechange events. Keyed by node object identity, never by node.id, and
// the TextNode being analyzed is never inserted into either cache (only its
// ancestors are, since only ancestors can be shared between sibling text
// layers). Semantics mirror isNodeHiddenBySelfOrParent/
// isNodeLockedBySelfOrParent exactly (same "in" guards, same
// OR-over-ancestors rule), just computed together in one walk instead of
// two, with each ancestor's own properties read at most once.
function resolveAncestorAvailabilityFlags(
  parent: BaseNode | null,
  ancestorAvailabilityCache: Map<BaseNode, AncestorAvailabilityFlags>,
  ancestorLocalDataCache: Map<BaseNode, AncestorLocalData>
): AncestorAvailabilityFlags {
  if (!parent) {
    return { hidden: false, locked: false };
  }

  const chain: Array<{ node: BaseNode; localData: AncestorLocalData }> = [];
  let currentNode: BaseNode | null = parent;
  let inherited: AncestorAvailabilityFlags = { hidden: false, locked: false };

  while (currentNode) {
    const cachedFlags = ancestorAvailabilityCache.get(currentNode);

    if (cachedFlags) {
      inherited = cachedFlags;
      break;
    }

    const localData = getAncestorLocalData(currentNode, ancestorLocalDataCache);

    chain.push({ node: currentNode, localData });
    currentNode = localData.parent;
  }

  let effective = inherited;

  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const { node: chainNode, localData } = chain[index];

    effective = {
      hidden: effective.hidden || localData.selfHidden,
      locked: effective.locked || localData.selfLocked,
    };

    ancestorAvailabilityCache.set(chainNode, effective);
  }

  return effective;
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

function resolveSelectionScopeType(
  selection: readonly SceneNode[]
): ScopeType {
  if (selection.length === 0) {
    return "currentPage";
  }

  if (selection.length > 1) {
    return "selectedLayers";
  }

  const node = selection[0];

  if (node.type === "TEXT") {
    return "textLayer";
  }

  if (node.type === "SECTION") {
    return "section";
  }

  if (node.type === "GROUP") {
    return "group";
  }

  if (
    node.type === "FRAME" ||
    node.type === "COMPONENT" ||
    node.type === "INSTANCE" ||
    node.type === "COMPONENT_SET"
  ) {
    return "frame";
  }

  return "selectedLayers";
}

function getSelectionKey(selection: readonly SceneNode[]): string {
  if (selection.length === 0) {
    return `page:${figma.currentPage.id}`;
  }

  return `selection:${selection
    .map((node) => node.id)
    .sort()
    .join(",")}`;
}

function resolveTextNodeTarget(): TextNodeTarget {
  const selection = figma.currentPage.selection;
  const scopeType = resolveSelectionScopeType(selection);
  const selectionKey = getSelectionKey(selection);

  if (selection.length === 0) {
    return {
      targetScope: "currentPage",
      scopeType,
      selectionKey,
      selectedCount: 0,
      textNodes: collectTextNodesFromSceneNodeRoots(figma.currentPage.children),
    };
  }

  return {
    targetScope: "selection",
    scopeType,
    selectionKey,
    selectedCount: selection.length,
    textNodes: collectTextNodesFromSceneNodeRoots(selection),
  };
}

function getUniqueFontsForTextNode(node: TextNode): FontName[] {
  if (node.characters.length === 0) {
    return [];
  }

  const fonts: FontName[] = [];

  function addFont(fontName: FontName | typeof figma.mixed) {
    if (fontName !== figma.mixed) {
      fonts.push(fontName as FontName);
    }
  }

  if (node.fontName !== figma.mixed) {
    addFont(node.fontName as FontName);
  } else {
    try {
      for (const segment of node.getStyledTextSegments(["fontName"])) {
        addFont(segment.fontName);
      }
    } catch (error) {
      console.warn(
        "Could not read styled text segments while collecting fonts:",
        error
      );

      for (const fontName of node.getRangeAllFontNames(
        0,
        node.characters.length
      )) {
        addFont(fontName);
      }
    }
  }

  return Array.from(
    new Map(
      fonts.map((font) => [`${font.family}-${font.style}`, font])
    ).values()
  );
}

function createEmptyTextNodeAvailabilitySummary(): TextNodeAvailabilitySummary {
  return {
    totalTextNodeCount: 0,
    availableTextNodeCount: 0,
    skippedHiddenNodeCount: 0,
    skippedLockedNodeCount: 0,
    skippedEmptyNodeCount: 0,
    skippedMissingFontsNodeCount: 0,
  };
}

function adjustTextNodeAvailabilitySummary(
  summary: TextNodeAvailabilitySummary,
  state: TextNodeAvailabilityState,
  delta: 1 | -1
) {
  summary.totalTextNodeCount += delta;

  if (state === "available") {
    summary.availableTextNodeCount += delta;
    return;
  }

  if (state === "hidden") {
    summary.skippedHiddenNodeCount += delta;
    return;
  }

  if (state === "locked") {
    summary.skippedLockedNodeCount += delta;
    return;
  }

  if (state === "empty") {
    summary.skippedEmptyNodeCount += delta;
    return;
  }

  summary.skippedMissingFontsNodeCount += delta;
}

async function analyzeTextNodeAvailability(
  textNodes: TextNode[]
): Promise<TextNodeAvailabilityAnalysis> {
  const summary = createEmptyTextNodeAvailabilitySummary();
  const states = new Map<string, TextNodeAvailabilityState>();
  const documentHasMissingFont = figma.hasMissingFont;
  const ancestorAvailabilityCache = new Map<BaseNode, AncestorAvailabilityFlags>();
  const ancestorLocalDataCache = new Map<BaseNode, AncestorLocalData>();

  for (const node of textNodes) {
    const selfHidden = "visible" in node && node.visible === false;
    const selfLocked = "locked" in node && node.locked === true;

    const ancestorFlags = resolveAncestorAvailabilityFlags(
      node.parent,
      ancestorAvailabilityCache,
      ancestorLocalDataCache
    );

    const isHidden = selfHidden || ancestorFlags.hidden;
    const isLocked = selfLocked || ancestorFlags.locked;

    let skipReason: PreflightSkipReason | null = null;

    if (isHidden) {
      skipReason = "hidden";
    } else if (isLocked) {
      skipReason = "locked";
    } else if (node.characters.trim().length === 0) {
      skipReason = "empty";
    }

    if (skipReason) {
      states.set(node.id, skipReason);
      adjustTextNodeAvailabilitySummary(summary, skipReason, 1);
      continue;
    }

    const hasMissingFont = documentHasMissingFont
      ? node.hasMissingFont
      : false;

    const state: TextNodeAvailabilityState = hasMissingFont
      ? "missingFonts"
      : "available";

    states.set(node.id, state);
    adjustTextNodeAvailabilitySummary(summary, state, 1);
  }

  return { summary, states };
}

async function summarizeTextNodeAvailability(
  textNodes: TextNode[]
): Promise<TextNodeAvailabilitySummary> {
  const analysis = await analyzeTextNodeAvailability(textNodes);
  return analysis.summary;
}

type SelectionAvailabilitySummaryResult = {
  summary: TextNodeAvailabilitySummary;
  source: "page-cache" | "direct";
  cachedNodeCount: number;
  missingNodeCount: number;
};

async function getSelectionAvailabilitySummary(
  page: PageNode,
  textNodes: TextNode[]
): Promise<SelectionAvailabilitySummaryResult> {
  const entry = pageAvailabilityCache.get(page.id);

  if (!entry || !entry.summary || entry.dirty || entry.pending) {
    const summary = await summarizeTextNodeAvailability(textNodes);

    return {
      summary,
      source: "direct",
      cachedNodeCount: 0,
      missingNodeCount: textNodes.length,
    };
  }

  const summary = createEmptyTextNodeAvailabilitySummary();
  const missingNodes: TextNode[] = [];
  let cachedNodeCount = 0;

  for (const node of textNodes) {
    if (node.removed) {
      continue;
    }

    const cachedState = entry.nodeStates.get(node.id);

    if (cachedState) {
      adjustTextNodeAvailabilitySummary(summary, cachedState, 1);
      cachedNodeCount += 1;
    } else {
      missingNodes.push(node);
    }
  }

  if (missingNodes.length === 0) {
    return {
      summary,
      source: "page-cache",
      cachedNodeCount,
      missingNodeCount: 0,
    };
  }

  const revisionAtStart = entry.revision;
  const analysis = await analyzeTextNodeAvailability(missingNodes);

  for (const node of missingNodes) {
    const state = analysis.states.get(node.id);

    if (!state) {
      continue;
    }

    adjustTextNodeAvailabilitySummary(summary, state, 1);
  }

  const canMergeIntoPageCache =
    entry.summary !== null &&
    !entry.dirty &&
    !entry.pending &&
    entry.revision === revisionAtStart;

  if (canMergeIntoPageCache && entry.summary) {
    const nextSummary = { ...entry.summary };
    const nextTextNodes = new Map(entry.textNodes);
    const nextNodeStates = new Map(entry.nodeStates);

    for (const node of missingNodes) {
      const state = analysis.states.get(node.id);

      if (!state) {
        continue;
      }

      adjustTextNodeAvailabilitySummary(nextSummary, state, 1);
      nextNodeStates.set(node.id, state);
      nextTextNodes.set(node.id, node);
    }

    entry.summary = nextSummary;
    entry.textNodes = nextTextNodes;
    entry.nodeStates = nextNodeStates;
  }

  return {
    summary,
    source: "page-cache",
    cachedNodeCount,
    missingNodeCount: missingNodes.length,
  };
}

function getOrCreatePageAvailabilityCacheEntry(
  pageId: string
): PageAvailabilityCacheEntry {
  const existingEntry = pageAvailabilityCache.get(pageId);

  if (existingEntry) {
    return existingEntry;
  }

  const entry: PageAvailabilityCacheEntry = {
    summary: null,
    textNodes: new Map<string, TextNode>(),
    nodeStates: new Map<string, TextNodeAvailabilityState>(),
    dirty: true,
    revision: 0,
    pending: null,
    updateQueue: Promise.resolve(),
    lastAccessedAt: Date.now(),
  };

  pageAvailabilityCache.set(pageId, entry);
  return entry;
}

function markPageAvailabilityCacheDirty(pageId: string) {
  const entry = pageAvailabilityCache.get(pageId);

  if (!entry) {
    return;
  }

  entry.dirty = true;
  entry.revision += 1;
}

function forgetPageAvailabilityCache(pageId: string) {
  const subscription = pageNodeChangeSubscriptions.get(pageId);

  if (subscription) {
    subscription.page.off("nodechange", subscription.callback);
    pageNodeChangeSubscriptions.delete(pageId);
  }

  pageAvailabilityCache.delete(pageId);
}

function evictLeastRecentlyUsedPageAvailabilityCaches(currentPageId: string) {
  if (pageAvailabilityCache.size <= MAX_CACHED_PAGES) {
    return;
  }

  const evictionCandidates = Array.from(pageAvailabilityCache.entries())
    .filter(([pageId]) => pageId !== currentPageId)
    .sort(([, a], [, b]) => a.lastAccessedAt - b.lastAccessedAt);

  let excessCount = pageAvailabilityCache.size - MAX_CACHED_PAGES;

  for (const [pageId] of evictionCandidates) {
    if (excessCount <= 0) {
      break;
    }

    forgetPageAvailabilityCache(pageId);
    excessCount -= 1;
  }
}

function pruneRemovedPageAvailabilityCaches() {
  if (
    pageAvailabilityCache.size === 0 &&
    pageNodeChangeSubscriptions.size === 0
  ) {
    return;
  }

  const existingPageIds = new Set(
    figma.root.children.map((page) => page.id)
  );
  const trackedPageIds = new Set<string>([
    ...pageAvailabilityCache.keys(),
    ...pageNodeChangeSubscriptions.keys(),
  ]);

  for (const pageId of trackedPageIds) {
    if (!existingPageIds.has(pageId)) {
      forgetPageAvailabilityCache(pageId);
    }
  }
}

function isRemovedNode(
  node: SceneNode | RemovedNode
): node is RemovedNode {
  return "removed" in node && node.removed === true;
}

function collectTextNodesFromCreatedNode(node: SceneNode): TextNode[] {
  if (node.type === "TEXT") {
    return [node];
  }

  if ("findAllWithCriteria" in node) {
    return (node as SceneNode & ChildrenMixin).findAllWithCriteria({
      types: ["TEXT"],
    }) as TextNode[];
  }

  return collectTextNodesFromSceneNodeRoots([node]);
}

async function collectTextNodesFromPage(page: PageNode): Promise<TextNode[]> {
  await page.loadAsync();

  return page.findAllWithCriteria({
    types: ["TEXT"],
  });
}

function shouldReanalyzeTextNodeAfterPropertyChange(
  entry: PageAvailabilityCacheEntry,
  node: TextNode,
  properties: NodeChangeProperty[]
): boolean {
  if (properties.some((property) => PAGE_AVAILABILITY_RELEVANT_PROPERTIES.has(property))) {
    return true;
  }

  if (!properties.includes("characters")) {
    return false;
  }

  const previousState = entry.nodeStates.get(node.id);

  if (!previousState) {
    return true;
  }

  const wasEmpty = previousState === "empty";
  const isEmpty = node.characters.trim().length === 0;
  return wasEmpty !== isEmpty;
}

async function applyIncrementalPageAvailabilityChanges(
  page: PageNode,
  event: NodeChangeEvent
): Promise<boolean> {
  const entry = pageAvailabilityCache.get(page.id);

  if (!entry) {
    return false;
  }

  if (entry.pending) {
    try {
      await entry.pending;
    } catch {
      // The in-flight full recompute failed; the dirty/missing-summary
      // check below decides how to proceed.
    }
  }

  if (!entry.summary || entry.dirty) {
    markPageAvailabilityCacheDirty(page.id);
    return false;
  }

  entry.lastAccessedAt = Date.now();

  const revisionAtStart = entry.revision;
  const createdTextNodes = new Map<string, TextNode>();
  const textNodesToReanalyze = new Map<string, TextNode>();
  const deletedTextNodeIds = new Set<string>();
  let requiresFullRebuild = false;

  for (const change of event.nodeChanges) {
    if (change.type === "DELETE") {
      if (change.node.type !== "TEXT") {
        let cachedRemovedTextNodeCount = 0;

        for (const [textNodeId, textNode] of entry.textNodes) {
          if (textNode.removed) {
            deletedTextNodeIds.add(textNodeId);
            cachedRemovedTextNodeCount += 1;
          }
        }

        if (cachedRemovedTextNodeCount === 0) {
          requiresFullRebuild = true;
          break;
        }

        continue;
      }

      if (!entry.nodeStates.has(change.node.id)) {
        requiresFullRebuild = true;
        break;
      }

      deletedTextNodeIds.add(change.node.id);
      continue;
    }

    if (isRemovedNode(change.node)) {
      requiresFullRebuild = true;
      break;
    }

    if (change.type === "CREATE") {
      try {
        for (const textNode of collectTextNodesFromCreatedNode(change.node)) {
          if (!entry.textNodes.has(textNode.id)) {
            createdTextNodes.set(textNode.id, textNode);
          }
        }
      } catch (error) {
        console.warn("Could not inspect newly created node subtree:", error);
        requiresFullRebuild = true;
        break;
      }

      continue;
    }

    if (change.node.type === "TEXT") {
      const textNode = change.node as TextNode;

      if (!entry.textNodes.has(textNode.id)) {
        requiresFullRebuild = true;
        break;
      }

      if (
        shouldReanalyzeTextNodeAfterPropertyChange(
          entry,
          textNode,
          change.properties
        )
      ) {
        textNodesToReanalyze.set(textNode.id, textNode);
      }

      continue;
    }

    if (
      change.properties.some((property) =>
        PAGE_AVAILABILITY_RELEVANT_PROPERTIES.has(property)
      )
    ) {
      requiresFullRebuild = true;
      break;
    }
  }

  if (requiresFullRebuild) {
    markPageAvailabilityCacheDirty(page.id);
    return false;
  }

  for (const deletedId of deletedTextNodeIds) {
    createdTextNodes.delete(deletedId);
    textNodesToReanalyze.delete(deletedId);
  }

  const nodesToAnalyze = Array.from(
    new Map(
      [...createdTextNodes.values(), ...textNodesToReanalyze.values()].map(
        (node) => [node.id, node]
      )
    ).values()
  );
  const analysis = await analyzeTextNodeAvailability(nodesToAnalyze);

  if (entry.revision !== revisionAtStart || entry.dirty || !entry.summary) {
    return false;
  }

  const nextSummary = { ...entry.summary };
  const nextTextNodes = new Map(entry.textNodes);
  const nextNodeStates = new Map(entry.nodeStates);

  for (const deletedId of deletedTextNodeIds) {
    const previousState = nextNodeStates.get(deletedId);

    if (!previousState) {
      markPageAvailabilityCacheDirty(page.id);
      return false;
    }

    adjustTextNodeAvailabilitySummary(nextSummary, previousState, -1);
    nextNodeStates.delete(deletedId);
    nextTextNodes.delete(deletedId);
  }

  for (const node of nodesToAnalyze) {
    const nextState = analysis.states.get(node.id);

    if (!nextState) {
      markPageAvailabilityCacheDirty(page.id);
      return false;
    }

    const previousState = nextNodeStates.get(node.id);

    if (previousState) {
      if (previousState !== nextState) {
        adjustTextNodeAvailabilitySummary(nextSummary, previousState, -1);
        adjustTextNodeAvailabilitySummary(nextSummary, nextState, 1);
      }
    } else {
      adjustTextNodeAvailabilitySummary(nextSummary, nextState, 1);
    }

    nextNodeStates.set(node.id, nextState);
    nextTextNodes.set(node.id, node);
  }

  entry.summary = nextSummary;
  entry.nodeStates = nextNodeStates;
  entry.textNodes = nextTextNodes;
  return deletedTextNodeIds.size > 0 || nodesToAnalyze.length > 0;
}

function queueIncrementalPageAvailabilityChanges(
  page: PageNode,
  event: NodeChangeEvent
) {
  const entry = pageAvailabilityCache.get(page.id);

  if (!entry) {
    return;
  }

  const update = entry.updateQueue
    .then(() => applyIncrementalPageAvailabilityChanges(page, event))
    .catch((error) => {
      console.warn("Could not update the page text-layer cache:", error);
      markPageAvailabilityCacheDirty(page.id);
      return false;
    });

  entry.updateQueue = update.then(() => undefined);

  void update.then((didUpdate) => {
    if (
      didUpdate &&
      figma.currentPage.id === page.id &&
      page.selection.length === 0
    ) {
      void sendSelectionInfo();
    }
  });
}

function ensurePageAvailabilityCacheSubscription(page: PageNode) {
  if (pageNodeChangeSubscriptions.has(page.id)) {
    return;
  }

  const callback = (event: NodeChangeEvent) => {
    queueIncrementalPageAvailabilityChanges(page, event);
  };

  page.on("nodechange", callback);
  pageNodeChangeSubscriptions.set(page.id, { page, callback });
}

async function getPageAvailabilitySummary(
  page: PageNode
): Promise<TextNodeAvailabilitySummary> {
  ensurePageAvailabilityCacheSubscription(page);

  const entry = getOrCreatePageAvailabilityCacheEntry(page.id);
  entry.lastAccessedAt = Date.now();
  evictLeastRecentlyUsedPageAvailabilityCaches(page.id);

  await entry.updateQueue;

  if (entry.summary && !entry.dirty) {
    return entry.summary;
  }

  if (entry.pending) {
    return entry.pending;
  }

  const revisionAtStart = entry.revision;
  const pending = (async () => {
    const textNodes = await collectTextNodesFromPage(page);
    const analysis = await analyzeTextNodeAvailability(textNodes);

    if (entry.revision === revisionAtStart) {
      entry.summary = analysis.summary;
      entry.textNodes = new Map(textNodes.map((node) => [node.id, node]));
      entry.nodeStates = analysis.states;
      entry.dirty = false;
    }

    return analysis.summary;
  })();

  entry.pending = pending;

  let summary: TextNodeAvailabilitySummary;

  try {
    summary = await pending;
  } finally {
    if (entry.pending === pending) {
      entry.pending = null;
    }
  }

  if (entry.revision !== revisionAtStart) {
    return getPageAvailabilitySummary(page);
  }

  return summary;
}

async function warmPageAvailabilityCache(page: PageNode) {
  try {
    await getPageAvailabilitySummary(page);
  } catch (error) {
    console.warn("Could not warm the page text-layer cache:", error);
    markPageAvailabilityCacheDirty(page.id);
  }
}

let selectionInfoRequestId = 0;

async function sendSelectionInfo() {
  const requestId = ++selectionInfoRequestId;
  const page = figma.currentPage;
  const selection = page.selection;

  if (selection.length === 0) {
    const availabilitySummary = await getPageAvailabilitySummary(page);

    if (requestId !== selectionInfoRequestId) {
      return;
    }

    figma.ui.postMessage({
      type: "selection-info",
      targetScope: "currentPage",
      scopeType: "currentPage",
      selectionKey: `page:${page.id}`,
      selectedCount: 0,
      textNodeCount: availabilitySummary.totalTextNodeCount,
      availableTextNodeCount: availabilitySummary.availableTextNodeCount,
      skippedHiddenNodeCount: availabilitySummary.skippedHiddenNodeCount,
      skippedLockedNodeCount: availabilitySummary.skippedLockedNodeCount,
      skippedEmptyNodeCount: availabilitySummary.skippedEmptyNodeCount,
      skippedMissingFontsNodeCount:
        availabilitySummary.skippedMissingFontsNodeCount,
    });

    return;
  }

  const target = resolveTextNodeTarget();
  const selectionSummaryResult = await getSelectionAvailabilitySummary(
    page,
    target.textNodes
  );
  const availabilitySummary = selectionSummaryResult.summary;

  if (requestId !== selectionInfoRequestId) {
    return;
  }

  figma.ui.postMessage({
    type: "selection-info",
    targetScope: target.targetScope,
    scopeType: target.scopeType,
    selectionKey: target.selectionKey,
    selectedCount: target.selectedCount,
    textNodeCount: availabilitySummary.totalTextNodeCount,
    availableTextNodeCount: availabilitySummary.availableTextNodeCount,
    skippedHiddenNodeCount: availabilitySummary.skippedHiddenNodeCount,
    skippedLockedNodeCount: availabilitySummary.skippedLockedNodeCount,
    skippedEmptyNodeCount: availabilitySummary.skippedEmptyNodeCount,
    skippedMissingFontsNodeCount:
      availabilitySummary.skippedMissingFontsNodeCount,
  });
}

type CharacterStyleSnapshot = {
  textStyleId: string | typeof figma.mixed;
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
    textStyleId: node.getRangeTextStyleId(index, index + 1),
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
    textStyleId: style.textStyleId,
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

function getMappedStylesForFormattedText(
  originalText: string,
  formattedText: string,
  originalStyles: CharacterStyleSnapshot[]
): CharacterStyleSnapshot[] {
  const originalIndexByFormattedIndex =
    mapFormattedCharactersToOriginalCharacters(originalText, formattedText);

  return originalIndexByFormattedIndex.map(
    (originalIndex) => originalStyles[originalIndex] || originalStyles[0]
  );
}

async function applyTextStyleIdsToFormattedText(
  node: TextNode,
  mappedStyles: CharacterStyleSnapshot[]
) {
  if (mappedStyles.length === 0) {
    return;
  }

  let rangeStart = 0;
  let currentTextStyleId = mappedStyles[0].textStyleId;

  async function applyTextStyleIdToRange(
    start: number,
    end: number,
    textStyleId: string | typeof figma.mixed
  ) {
    if (
      start >= end ||
      textStyleId === figma.mixed ||
      textStyleId.length === 0
    ) {
      return;
    }

    try {
      await node.setRangeTextStyleIdAsync(start, end, textStyleId);
    } catch (error) {
      console.warn(
        `Could not restore textStyleId for range ${start}-${end}:`,
        error
      );
    }
  }

  for (let index = 1; index < mappedStyles.length; index++) {
    const textStyleId = mappedStyles[index].textStyleId;

    if (textStyleId === currentTextStyleId) {
      continue;
    }

    await applyTextStyleIdToRange(
      rangeStart,
      index,
      currentTextStyleId
    );

    rangeStart = index;
    currentTextStyleId = textStyleId;
  }

  await applyTextStyleIdToRange(
    rangeStart,
    mappedStyles.length,
    currentTextStyleId
  );
}

function applyVisualStylesToFormattedText(
  node: TextNode,
  formattedText: string,
  mappedStyles: CharacterStyleSnapshot[]
) {
  if (mappedStyles.length === 0 || formattedText.length === 0) {
    return;
  }

  let rangeStart = 0;
  let currentStyle = mappedStyles[0];
  let currentStyleKey = getStyleKey(currentStyle);

  for (let index = 1; index < formattedText.length; index++) {
    const style = mappedStyles[index] || currentStyle;
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

async function applyStyleSnapshotsToFormattedText(
  node: TextNode,
  originalText: string,
  formattedText: string,
  originalStyles: CharacterStyleSnapshot[]
) {
  if (originalStyles.length === 0 || formattedText.length === 0) {
    return;
  }

  const mappedStyles = getMappedStylesForFormattedText(
    originalText,
    formattedText,
    originalStyles
  );

  // Restore linked text styles first. Reapplying the saved visual properties
  // afterwards preserves local overrides without dropping the style link.
  await applyTextStyleIdsToFormattedText(node, mappedStyles);
  applyVisualStylesToFormattedText(node, formattedText, mappedStyles);
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

class MissingFontLoadError extends Error {
  readonly fontName: FontName;

  constructor(fontName: FontName, originalError: unknown) {
    super(
      `Could not load font ${fontName.family} ${fontName.style}: ${getErrorMessage(originalError)}`
    );
    this.name = "MissingFontLoadError";
    this.fontName = fontName;
  }
}

async function loadFontsForTextNode(node: TextNode) {
  const uniqueFonts = getUniqueFontsForTextNode(node);

  for (const font of uniqueFonts) {
    try {
      await figma.loadFontAsync(font);
    } catch (error) {
      throw new MissingFontLoadError(font, error);
    }
  }
}

type TextEditHunk = {
  start: number;
  end: number;
  insertedText: string;
};

function buildTextEditHunks(
  originalText: string,
  formattedText: string
): TextEditHunk[] {
  const hunks: TextEditHunk[] = [];

  let originalIndex = 0;
  let formattedIndex = 0;

  while (
    originalIndex < originalText.length ||
    formattedIndex < formattedText.length
  ) {
    if (
      originalIndex < originalText.length &&
      formattedIndex < formattedText.length &&
      originalText[originalIndex] === formattedText[formattedIndex]
    ) {
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

    hunks.push({
      start: originalIndex,
      end: nextOriginalIndex,
      insertedText: formattedText.slice(formattedIndex, nextFormattedIndex),
    });

    originalIndex = nextOriginalIndex;
    formattedIndex = nextFormattedIndex;
  }

  return hunks;
}

function applyTextEditHunk(node: TextNode, hunk: TextEditHunk) {
  const { start, end, insertedText } = hunk;

  if (start === end) {
    if (insertedText.length === 0) {
      return;
    }

    const useStyle: "BEFORE" | "AFTER" =
      start < node.characters.length ? "AFTER" : "BEFORE";

    node.insertCharacters(start, insertedText, useStyle);
    return;
  }

  if (insertedText.length === 0) {
    node.deleteCharacters(start, end);
    return;
  }

  // Insert before the original range and copy the style from its first
  // character. Then remove the shifted original range. This keeps linked
  // text styles, local overrides, mixed fonts, fills and other range styles
  // attached without rebuilding them property by property.
  node.insertCharacters(start, insertedText, "AFTER");
  node.deleteCharacters(
    start + insertedText.length,
    end + insertedText.length
  );
}

async function updateTextNodeCharactersPreservingStyles(
  node: TextNode,
  formattedText: string
) {
  const originalText = node.characters;

  await loadFontsForTextNode(node);

  const hunks = buildTextEditHunks(originalText, formattedText);

  for (let index = hunks.length - 1; index >= 0; index--) {
    applyTextEditHunk(node, hunks[index]);
  }

  if (node.characters !== formattedText) {
    throw new Error("Could not apply formatted text exactly");
  }
}


const LIST_LINE_BREAK_TOKEN_PREFIX = "\uE000";
const LIST_LINE_BREAK_TOKEN_SUFFIX = "\uE001";
const LIST_LINE_BREAK_TOKEN_MIDDLE_START = 0xe100;
const LIST_LINE_BREAK_TOKEN_MIDDLE_END = 0xf8ff;

type ProtectedListLineBreaks = {
  text: string;
  token: string | null;
};

function rangeHasListFormatting(
  node: TextNode,
  start: number,
  end: number
): boolean {
  if (start < 0 || end > node.characters.length || start >= end) {
    return false;
  }

  const getRangeListOptions = (node as any).getRangeListOptions;

  if (typeof getRangeListOptions !== "function") {
    return false;
  }

  try {
    const listOptions = getRangeListOptions.call(node, start, end);

    if (listOptions === figma.mixed) {
      return true;
    }

    if (!listOptions || typeof listOptions !== "object") {
      return false;
    }

    const listType = (listOptions as { type?: unknown }).type;

    return typeof listType === "string" && listType !== "NONE";
  } catch (error) {
    console.warn(
      `Could not read list formatting for range ${start}-${end}:`,
      error
    );
    return false;
  }
}

function isListParagraphBoundary(node: TextNode, index: number): boolean {
  const textLength = node.characters.length;

  if (index < 0 || index >= textLength || node.characters[index] !== "\n") {
    return false;
  }

  const adjacentRanges: Array<[number, number]> = [];

  if (index > 0) {
    adjacentRanges.push([index - 1, index]);
  }

  adjacentRanges.push([index, index + 1]);

  if (index + 1 < textLength) {
    adjacentRanges.push([index + 1, index + 2]);
  }

  return adjacentRanges.some(([start, end]) =>
    rangeHasListFormatting(node, start, end)
  );
}

function findUnusedListLineBreakToken(text: string): string | null {
  for (
    let codePoint = LIST_LINE_BREAK_TOKEN_MIDDLE_START;
    codePoint <= LIST_LINE_BREAK_TOKEN_MIDDLE_END;
    codePoint += 1
  ) {
    const token =
      LIST_LINE_BREAK_TOKEN_PREFIX +
      String.fromCharCode(codePoint) +
      LIST_LINE_BREAK_TOKEN_SUFFIX;

    if (!text.includes(token)) {
      return token;
    }
  }

  return null;
}

function protectListParagraphBreaks(
  node: TextNode,
  text: string
): ProtectedListLineBreaks {
  if (!text.includes("\n")) {
    return { text, token: null };
  }

  const token = findUnusedListLineBreakToken(text);

  if (!token) {
    console.warn("Could not reserve a token for list paragraph breaks");
    return { text, token: null };
  }

  let protectedText = "";
  let protectedBreakCount = 0;

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n" && isListParagraphBoundary(node, index)) {
      protectedText += token;
      protectedBreakCount += 1;
    } else {
      protectedText += text[index];
    }
  }

  return protectedBreakCount > 0
    ? { text: protectedText, token }
    : { text, token: null };
}

function restoreListParagraphBreaks(
  text: string,
  token: string | null
): string {
  return token ? text.split(token).join("\n") : text;
}

function getErrorMessage(error: unknown): string {
  return String(
    error instanceof Error ? error.message : error ?? ""
  ).toLowerCase();
}

function isProbablyMissingFontError(error: unknown): boolean {
  if (error instanceof MissingFontLoadError) {
    return true;
  }

  const message = getErrorMessage(error);

  if (!message.includes("font")) {
    return false;
  }

  return (
    message.includes("missing") ||
    message.includes("not found") ||
    message.includes("not available") ||
    message.includes("unavailable") ||
    message.includes("cannot load") ||
    message.includes("can't load") ||
    message.includes("could not load") ||
    message.includes("failed to load")
  );
}

function isProbablyNonEditableError(error: unknown): boolean {
  const message = getErrorMessage(error);

  return (
    message.includes("read only") ||
    message.includes("readonly") ||
    message.includes("not editable") ||
    message.includes("non-editable") ||
    message.includes("cannot edit") ||
    message.includes("can't edit") ||
    message.includes("cannot write") ||
    message.includes("can't write") ||
    message.includes("instance") ||
    message.includes("component")
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
  let skippedNonEditableNodeCount = 0;
  let skippedMissingFontsNodeCount = 0;
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

      const protectedListBreaks = protectListParagraphBreaks(
        node,
        originalText
      );
      const result = TypotypoEngine.applyRulesToText(
        protectedListBreaks.text,
        safeSettings,
        language
      );
      const formattedText = restoreListParagraphBreaks(
        result.formattedText,
        protectedListBreaks.token
      );

      skippedRuleCount += result.skippedRuleCount;

      if (
        result.replacementCount === 0 ||
        formattedText === originalText
      ) {
        unchangedNodeCount += 1;
        continue;
      }

      await updateTextNodeCharactersPreservingStyles(
        node,
        formattedText
      );

      changedNodeCount += 1;
      totalReplacementCount += result.replacementCount;
    } catch (error) {
      console.error("Could not update text node:", error);

      if (isProbablyMissingFontError(error)) {
        skippedMissingFontsNodeCount += 1;
      } else if (isProbablyNonEditableError(error)) {
        skippedNonEditableNodeCount += 1;
      } else {
        errorNodeCount += 1;
      }
    }
  }

  const skippedNodeCount =
    skippedHiddenNodeCount +
    skippedLockedNodeCount +
    skippedEmptyNodeCount +
    skippedNonEditableNodeCount +
    skippedMissingFontsNodeCount;

  figma.ui.postMessage({
    type: "apply-result",
    targetScope: target.targetScope,
    scopeType: target.scopeType,
    selectionKey: target.selectionKey,
    selectedCount: target.selectedCount,
    totalTextNodeCount: target.textNodes.length,
    availableTextNodeCount: changedNodeCount + unchangedNodeCount,
    checkedNodeCount: changedNodeCount + unchangedNodeCount,
    changedNodeCount,
    unchangedNodeCount,
    totalReplacementCount,
    skippedNodeCount,
    skippedHiddenNodeCount,
    skippedLockedNodeCount,
    skippedEmptyNodeCount,
    skippedNonEditableNodeCount,
    skippedMissingFontsNodeCount,
    errorNodeCount,
    skippedRuleCount,
    languageStats,
  });

  figma.notify(
    `Updated ${changedNodeCount} text layer${changedNodeCount === 1 ? "" : "s"}` +
      (skippedNodeCount > 0 ? ` · Skipped ${skippedNodeCount}` : "") +
      (errorNodeCount > 0 ? ` · Errors ${errorNodeCount}` : "")
  );

  await sendSelectionInfo();
}

async function initializePlugin() {
  const [settings, uiSettings] = await Promise.all([
    loadSettings(),
    loadUiSettings(),
  ]);
  const page = figma.currentPage;

  pruneRemovedPageAvailabilityCaches();
  ensurePageAvailabilityCacheSubscription(page);

  figma.ui.postMessage({
    type: "settings-loaded",
    settings,
    uiSettings,
  });

  await sendSelectionInfo();

  if (page.selection.length > 0) {
    void warmPageAvailabilityCache(page);
  }
}

figma.on("selectionchange", () => {
  void sendSelectionInfo();
});

figma.on("currentpagechange", () => {
  const page = figma.currentPage;

  pruneRemovedPageAvailabilityCaches();
  ensurePageAvailabilityCacheSubscription(page);
  void sendSelectionInfo();

  if (page.selection.length > 0) {
    void warmPageAvailabilityCache(page);
  }
});

figma.ui.onmessage = async (message) => {
  if (message.type === "save-settings") {
    await saveSettings(message.settings);
  }

  if (message.type === "save-ui-settings") {
    await saveUiSettings(message.uiSettings);
  }

  if (message.type === "apply") {
    const safeSettings = TypotypoEngine.normalizeSettings(message.settings);

    await Promise.all([
      saveSettings(safeSettings),
      saveUiSettings(message.uiSettings),
    ]);

    await applyTypographyRules(safeSettings);
  }

  if (message.type === "close") {
    await saveUiSettings(message.uiSettings);
    figma.closePlugin();
  }
};

initializePlugin();
