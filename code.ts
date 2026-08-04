/// <reference path="./typography-engine.ts" />

type ApplySettings = TypotypoEngine.ApplySettings;
type LanguageStats = TypotypoEngine.LanguageStats;

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
  pendingProgress: PageAnalysisProgress | null;
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

// Temporary end-to-end diagnostics for the "selected frame -> whole page"
// scope-switch lag investigation. Logs only counts, durations, booleans and
// a small allow-listed set of property names — never layer/page/font names
// or text content. Safe to delete wholesale once the investigation is done.
const SCOPE_SWITCH_DEBUG = true;

function scopeSwitchDebugNow(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
}

function scopeSwitchCacheDirtyLog(details: Record<string, unknown>) {
  if (SCOPE_SWITCH_DEBUG) {
    console.log("[page-cache-dirty]", details);
  }
}

const SCOPE_SWITCH_DIRTY_SAFE_PROPERTIES = new Set<NodeChangeProperty>([
  "characters",
  "visible",
  "locked",
  "fontName",
  "textStyleId",
  "styledTextSegments",
]);

function summarizeScopeSwitchChangedProperties(
  event: NodeChangeEvent
): string[] {
  const seen = new Set<string>();

  for (const change of event.nodeChanges) {
    if (change.type !== "PROPERTY_CHANGE") {
      continue;
    }

    for (const property of change.properties) {
      if (SCOPE_SWITCH_DIRTY_SAFE_PROPERTIES.has(property)) {
        seen.add(property);
      }
    }
  }

  return Array.from(seen);
}

type ScopeSwitchPageDebugInfo = {
  updateQueueWaitDurationMs: number;
  pageLoadDurationMs: number;
  collectTextNodesDurationMs: number;
  analyzeTextNodesDurationMs: number;
  backgroundPrewarm: boolean;
  batchSize: number;
  batchCount: number;
  yieldCount: number;
  textNodeCount: number;
  longestBatchDurationMs: number;
  requestWasWaitingForPending: boolean;
  resultCommitted: boolean;
  resultDiscarded: boolean;
};

function createScopeSwitchPageDebugInfo(): ScopeSwitchPageDebugInfo {
  return {
    updateQueueWaitDurationMs: 0,
    pageLoadDurationMs: 0,
    collectTextNodesDurationMs: 0,
    analyzeTextNodesDurationMs: 0,
    backgroundPrewarm: false,
    batchSize: 0,
    batchCount: 0,
    yieldCount: 0,
    textNodeCount: 0,
    longestBatchDurationMs: 0,
    requestWasWaitingForPending: false,
    resultCommitted: false,
    resultDiscarded: false,
  };
}

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

function createInitialUiHtml(uiSettings: UiSettings): string {
  const initialTheme: UiTheme = uiSettings.theme || "system";
  const initialThemeScript = `<script>
    (() => {
      const themeMode = ${JSON.stringify(initialTheme)};
      const systemIsDark = Boolean(
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      );
      const effectiveTheme = themeMode === "system"
        ? (systemIsDark ? "dark" : "light")
        : themeMode;

      document.documentElement.dataset.theme = effectiveTheme;

      try {
        window.localStorage.setItem("typotypoTheme", themeMode);
      } catch (error) {}
    })();
  </script>`;
  const firstStyleIndex = __html__.indexOf("<style>");

  if (firstStyleIndex < 0) {
    return initialThemeScript + __html__;
  }

  return (
    __html__.slice(0, firstStyleIndex) +
    initialThemeScript +
    __html__.slice(firstStyleIndex)
  );
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

  // Deep fallback for a root whose type has no findAllWithCriteria (e.g. a
  // plain shape with no children). Never reads text/visibility/lock
  // properties, only .type and .children, same as before.
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

  for (const root of roots) {
    if (root.type === "TEXT") {
      addTextNode(root as TextNode);
      continue;
    }

    if ("findAllWithCriteria" in root) {
      const descendantTextNodes = (
        root as SceneNode & ChildrenMixin
      ).findAllWithCriteria({
        types: ["TEXT"],
      }) as TextNode[];

      for (const textNode of descendantTextNodes) {
        addTextNode(textNode);
      }

      continue;
    }

    walk(root);
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

// Full-page rebuild only. Same per-node algorithm and ancestor caches as
// analyzeTextNodeAvailability (kept untouched above for selection/
// missingNodes/CREATE/incremental use), just chunked so a large page doesn't
// block the single JS thread for one long synchronous stretch. The ancestor
// caches are created once and reused across batches; a yield only hands
// control back to the event loop, it never invalidates prior work.
const PAGE_ANALYSIS_BATCH_SIZE = 64;

// Minimum time between broadcast progress updates for a full-page analysis
// (the very first and very last updates always bypass this, see call site).
const PAGE_ANALYSIS_PROGRESS_THROTTLE_MS = 250;

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// Lightweight pub-sub so the currently-active foreground request (if any) can
// observe progress of a full-page analysis, regardless of whether that
// analysis was started by the foreground request itself or by an unrelated
// background prewarm. Broadcasting to zero listeners (pure silent prewarm)
// is a no-op, so this never turns prewarm into UI-visible work on its own.
type PageAnalysisProgress = {
  processedTextNodeCount: number;
  totalTextNodeCount: number;
};

type PageAnalysisProgressListener = (progress: PageAnalysisProgress) => void;

const pageAnalysisProgressListeners = new Map<
  string,
  Set<PageAnalysisProgressListener>
>();

function addPageAnalysisProgressListener(
  pageId: string,
  listener: PageAnalysisProgressListener
): () => void {
  let listeners = pageAnalysisProgressListeners.get(pageId);

  if (!listeners) {
    listeners = new Set();
    pageAnalysisProgressListeners.set(pageId, listeners);
  }

  listeners.add(listener);

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0) {
      pageAnalysisProgressListeners.delete(pageId);
    }
  };
}

function notifyPageAnalysisProgress(pageId: string, progress: PageAnalysisProgress) {
  const listeners = pageAnalysisProgressListeners.get(pageId);

  if (!listeners) {
    return;
  }

  for (const listener of listeners) {
    listener(progress);
  }
}

async function analyzeTextNodeAvailabilityInBatches(
  textNodes: TextNode[],
  isStillValid: () => boolean,
  scopeSwitchDebugInfo?: ScopeSwitchPageDebugInfo,
  onBatchProgress?: (
    processedCount: number,
    totalCount: number,
    isLastBatch: boolean
  ) => void
): Promise<TextNodeAvailabilityAnalysis | null> {
  const summary = createEmptyTextNodeAvailabilitySummary();
  const states = new Map<string, TextNodeAvailabilityState>();
  const documentHasMissingFont = figma.hasMissingFont;
  const ancestorAvailabilityCache = new Map<BaseNode, AncestorAvailabilityFlags>();
  const ancestorLocalDataCache = new Map<BaseNode, AncestorLocalData>();

  let batchCount = 0;
  let yieldCount = 0;
  let longestBatchDurationMs = 0;

  const reportBatchDebugInfo = () => {
    if (SCOPE_SWITCH_DEBUG && scopeSwitchDebugInfo) {
      scopeSwitchDebugInfo.batchSize = PAGE_ANALYSIS_BATCH_SIZE;
      scopeSwitchDebugInfo.batchCount = batchCount;
      scopeSwitchDebugInfo.yieldCount = yieldCount;
      scopeSwitchDebugInfo.longestBatchDurationMs = longestBatchDurationMs;
    }
  };

  for (
    let batchStart = 0;
    batchStart < textNodes.length;
    batchStart += PAGE_ANALYSIS_BATCH_SIZE
  ) {
    if (!isStillValid()) {
      reportBatchDebugInfo();
      return null;
    }

    const batchStartedAt = SCOPE_SWITCH_DEBUG ? scopeSwitchDebugNow() : 0;
    const batchEnd = Math.min(
      batchStart + PAGE_ANALYSIS_BATCH_SIZE,
      textNodes.length
    );

    for (let index = batchStart; index < batchEnd; index += 1) {
      const node = textNodes[index];
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

    batchCount += 1;

    if (SCOPE_SWITCH_DEBUG) {
      const batchDurationMs = scopeSwitchDebugNow() - batchStartedAt;
      longestBatchDurationMs = Math.max(longestBatchDurationMs, batchDurationMs);
    }

    const isLastBatch = batchEnd >= textNodes.length;

    if (onBatchProgress) {
      onBatchProgress(batchEnd, textNodes.length, isLastBatch);
    }

    if (!isLastBatch) {
      yieldCount += 1;
      await yieldToEventLoop();
    }
  }

  if (!isStillValid()) {
    reportBatchDebugInfo();
    return null;
  }

  reportBatchDebugInfo();
  return { summary, states };
}

async function summarizeTextNodeAvailability(
  textNodes: TextNode[]
): Promise<TextNodeAvailabilitySummary> {
  const analysis = await analyzeTextNodeAvailability(textNodes);
  return analysis.summary;
}

// Single-slot cache of the last successful selection result. Keyed by page +
// exact ordered selection root ids + the page availability cache's revision
// and summary object reference at the time of caching. Both revision (bumped
// by every markPageAvailabilityCacheDirty call, i.e. every full-rebuild
// trigger) and the summary reference (reassigned to a fresh object by every
// commit path — full recompute, incremental merge, and the page-cache merge
// inside getSelectionAvailabilitySummary itself) already change on every
// event that could make a cached selection result stale, so reusing them as
// the invalidation signal needs no separate observers. A plain selection
// scope switch (selection -> currentPage -> same selection) never touches
// either value, so it never invalidates this cache on its own.
type SelectionResultCacheEntry = {
  pageId: string;
  selectionRootIds: string[];
  pageRevisionAtCache: number;
  pageSummaryRefAtCache: TextNodeAvailabilitySummary | null;
  targetScope: TargetScope;
  scopeType: ScopeType;
  selectionKey: string;
  selectedCount: number;
  summary: TextNodeAvailabilitySummary;
};

let selectionResultCache: SelectionResultCacheEntry | null = null;

function selectionRootIdsMatch(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }

  return true;
}

function readSelectionResultCache(
  page: PageNode,
  selection: readonly SceneNode[]
): SelectionResultCacheEntry | null {
  const cached = selectionResultCache;

  if (!cached || cached.pageId !== page.id) {
    return null;
  }

  const entry = pageAvailabilityCache.get(page.id);

  // A cached selection remains valid while a full-page prewarm is merely
  // pending. The page revision and summary object reference below are the
  // actual invalidation signals: relevant document changes bump revision,
  // and every committed page-cache update replaces the summary object.
  // Rejecting all dirty/pending entries made selection -> currentPage -> the
  // same selection needlessly re-scan the selection while the silent page
  // prewarm was still running.
  if (!entry) {
    return null;
  }

  if (
    cached.pageRevisionAtCache !== entry.revision ||
    cached.pageSummaryRefAtCache !== entry.summary
  ) {
    return null;
  }

  const currentSelectionRootIds = selection.map((node) => node.id);

  if (!selectionRootIdsMatch(cached.selectionRootIds, currentSelectionRootIds)) {
    return null;
  }

  return cached;
}

function writeSelectionResultCache(entry: SelectionResultCacheEntry) {
  selectionResultCache = entry;
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
    pendingProgress: null,
    updateQueue: Promise.resolve(),
    lastAccessedAt: Date.now(),
  };

  pageAvailabilityCache.set(pageId, entry);
  return entry;
}

function markPageAvailabilityCacheDirty(
  pageId: string,
  scopeSwitchDebugReason?: string,
  scopeSwitchDebugExtra?: {
    nodeChangeCount?: number;
    changedProperties?: string[];
  }
) {
  const entry = pageAvailabilityCache.get(pageId);

  if (!entry) {
    return;
  }

  if (SCOPE_SWITCH_DEBUG) {
    scopeSwitchCacheDirtyLog({
      pageId,
      reason: scopeSwitchDebugReason ?? "unspecified",
      cacheHadSummary: Boolean(entry.summary),
      previousDirty: entry.dirty,
      newDirty: true,
      revisionBefore: entry.revision,
      revisionAfter: entry.revision + 1,
      nodeChangeCount: scopeSwitchDebugExtra?.nodeChangeCount,
      changedProperties: scopeSwitchDebugExtra?.changedProperties,
    });
  }

  entry.dirty = true;
  entry.revision += 1;
}

function forgetPageAvailabilityCache(pageId: string, scopeSwitchDebugReason?: string) {
  if (SCOPE_SWITCH_DEBUG) {
    const entry = pageAvailabilityCache.get(pageId);

    if (entry) {
      scopeSwitchCacheDirtyLog({
        pageId,
        reason: scopeSwitchDebugReason ?? "cache-entry-removed",
        cacheHadSummary: Boolean(entry.summary),
        previousDirty: entry.dirty,
        newDirty: true,
        revisionBefore: entry.revision,
        revisionAfter: entry.revision,
      });
    }
  }

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

    forgetPageAvailabilityCache(pageId, "lru-eviction");
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
      forgetPageAvailabilityCache(pageId, "page-removed-from-document");
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

async function collectTextNodesFromPage(
  page: PageNode,
  scopeSwitchDebugInfo?: ScopeSwitchPageDebugInfo
): Promise<TextNode[]> {
  const pageLoadStartedAt =
    SCOPE_SWITCH_DEBUG && scopeSwitchDebugInfo ? scopeSwitchDebugNow() : 0;
  await page.loadAsync();
  if (SCOPE_SWITCH_DEBUG && scopeSwitchDebugInfo) {
    scopeSwitchDebugInfo.pageLoadDurationMs =
      scopeSwitchDebugNow() - pageLoadStartedAt;
  }

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

  const scopeSwitchDirtyDebugExtra = SCOPE_SWITCH_DEBUG
    ? {
        nodeChangeCount: event.nodeChanges.length,
        changedProperties: summarizeScopeSwitchChangedProperties(event),
      }
    : undefined;

  if (entry.pending) {
    try {
      await entry.pending;
    } catch {
      // The in-flight full recompute failed; the dirty/missing-summary
      // check below decides how to proceed.
    }
  }

  if (!entry.summary || entry.dirty) {
    markPageAvailabilityCacheDirty(
      page.id,
      "no-summary-or-already-dirty",
      scopeSwitchDirtyDebugExtra
    );
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
    markPageAvailabilityCacheDirty(
      page.id,
      "full-rebuild-required",
      scopeSwitchDirtyDebugExtra
    );
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
      markPageAvailabilityCacheDirty(
        page.id,
        "deleted-node-missing-cached-state",
        scopeSwitchDirtyDebugExtra
      );
      return false;
    }

    adjustTextNodeAvailabilitySummary(nextSummary, previousState, -1);
    nextNodeStates.delete(deletedId);
    nextTextNodes.delete(deletedId);
  }

  for (const node of nodesToAnalyze) {
    const nextState = analysis.states.get(node.id);

    if (!nextState) {
      markPageAvailabilityCacheDirty(
        page.id,
        "analyzed-node-missing-result",
        scopeSwitchDirtyDebugExtra
      );
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
      markPageAvailabilityCacheDirty(
        page.id,
        "incremental-update-threw",
        SCOPE_SWITCH_DEBUG
          ? { nodeChangeCount: event.nodeChanges.length }
          : undefined
      );
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
  page: PageNode,
  scopeSwitchDebugInfo?: ScopeSwitchPageDebugInfo
): Promise<TextNodeAvailabilitySummary> {
  ensurePageAvailabilityCacheSubscription(page);

  const entry = getOrCreatePageAvailabilityCacheEntry(page.id);
  entry.lastAccessedAt = Date.now();
  evictLeastRecentlyUsedPageAvailabilityCaches(page.id);

  const updateQueueWaitStartedAt =
    SCOPE_SWITCH_DEBUG && scopeSwitchDebugInfo ? scopeSwitchDebugNow() : 0;
  await entry.updateQueue;
  if (SCOPE_SWITCH_DEBUG && scopeSwitchDebugInfo) {
    scopeSwitchDebugInfo.updateQueueWaitDurationMs =
      scopeSwitchDebugNow() - updateQueueWaitStartedAt;
  }

  if (entry.summary && !entry.dirty) {
    return entry.summary;
  }

  if (entry.pending) {
    if (SCOPE_SWITCH_DEBUG && scopeSwitchDebugInfo) {
      scopeSwitchDebugInfo.requestWasWaitingForPending = true;
    }
    return entry.pending;
  }

  const revisionAtStart = entry.revision;
  const pending = (async () => {
    const collectStartedAt =
      SCOPE_SWITCH_DEBUG && scopeSwitchDebugInfo ? scopeSwitchDebugNow() : 0;
    const textNodes = await collectTextNodesFromPage(page, scopeSwitchDebugInfo);
    if (SCOPE_SWITCH_DEBUG && scopeSwitchDebugInfo) {
      scopeSwitchDebugInfo.collectTextNodesDurationMs =
        scopeSwitchDebugNow() - collectStartedAt;
      scopeSwitchDebugInfo.textNodeCount = textNodes.length;
    }

    entry.pendingProgress = {
      processedTextNodeCount: 0,
      totalTextNodeCount: textNodes.length,
    };
    notifyPageAnalysisProgress(page.id, entry.pendingProgress);

    let lastProgressNotifyAt = Date.now();

    const analyzeStartedAt =
      SCOPE_SWITCH_DEBUG && scopeSwitchDebugInfo ? scopeSwitchDebugNow() : 0;
    const analysis = await analyzeTextNodeAvailabilityInBatches(
      textNodes,
      () =>
        pageAvailabilityCache.get(page.id) === entry &&
        entry.revision === revisionAtStart,
      scopeSwitchDebugInfo,
      (processedCount, totalCount, isLastBatch) => {
        const progress: PageAnalysisProgress = {
          processedTextNodeCount: processedCount,
          totalTextNodeCount: totalCount,
        };
        entry.pendingProgress = progress;

        const now = Date.now();
        if (
          isLastBatch ||
          now - lastProgressNotifyAt >= PAGE_ANALYSIS_PROGRESS_THROTTLE_MS
        ) {
          lastProgressNotifyAt = now;
          notifyPageAnalysisProgress(page.id, progress);
        }
      }
    );
    if (SCOPE_SWITCH_DEBUG && scopeSwitchDebugInfo) {
      scopeSwitchDebugInfo.analyzeTextNodesDurationMs =
        scopeSwitchDebugNow() - analyzeStartedAt;
    }

    if (
      analysis &&
      pageAvailabilityCache.get(page.id) === entry &&
      entry.revision === revisionAtStart
    ) {
      entry.summary = analysis.summary;
      entry.textNodes = new Map(textNodes.map((node) => [node.id, node]));
      entry.nodeStates = analysis.states;
      entry.dirty = false;

      if (SCOPE_SWITCH_DEBUG && scopeSwitchDebugInfo) {
        scopeSwitchDebugInfo.resultCommitted = true;
      }

      return analysis.summary;
    }

    if (SCOPE_SWITCH_DEBUG && scopeSwitchDebugInfo) {
      scopeSwitchDebugInfo.resultDiscarded = true;
    }

    return entry.summary ?? createEmptyTextNodeAvailabilitySummary();
  })();

  entry.pending = pending;

  let summary: TextNodeAvailabilitySummary;

  try {
    summary = await pending;
  } finally {
    if (entry.pending === pending) {
      entry.pending = null;
      entry.pendingProgress = null;
    }
  }

  if (entry.revision !== revisionAtStart) {
    return getPageAvailabilitySummary(page, scopeSwitchDebugInfo);
  }

  return summary;
}

async function warmPageAvailabilityCache(
  page: PageNode,
  backgroundPrewarm = false
) {
  const scopeSwitchDebugInfo = SCOPE_SWITCH_DEBUG
    ? createScopeSwitchPageDebugInfo()
    : undefined;

  if (scopeSwitchDebugInfo) {
    scopeSwitchDebugInfo.backgroundPrewarm = backgroundPrewarm;
  }

  const startedAt = SCOPE_SWITCH_DEBUG ? scopeSwitchDebugNow() : 0;

  try {
    await getPageAvailabilitySummary(page, scopeSwitchDebugInfo);

    if (SCOPE_SWITCH_DEBUG && scopeSwitchDebugInfo && backgroundPrewarm) {
      console.log("[scope-switch-main] request completed", {
        sequence: 0,
        pageId: page.id,
        requestedScope: "currentPage",
        resultSource: "page-background-prewarm",
        backgroundPrewarm: scopeSwitchDebugInfo.backgroundPrewarm,
        batchSize: scopeSwitchDebugInfo.batchSize,
        batchCount: scopeSwitchDebugInfo.batchCount,
        yieldCount: scopeSwitchDebugInfo.yieldCount,
        textNodeCount: scopeSwitchDebugInfo.textNodeCount,
        totalAnalysisDurationMs: scopeSwitchDebugInfo.analyzeTextNodesDurationMs,
        longestBatchDurationMs: scopeSwitchDebugInfo.longestBatchDurationMs,
        requestWasWaitingForPending: scopeSwitchDebugInfo.requestWasWaitingForPending,
        resultCommitted: scopeSwitchDebugInfo.resultCommitted,
        resultDiscarded: scopeSwitchDebugInfo.resultDiscarded,
        totalMainDurationMs: scopeSwitchDebugNow() - startedAt,
      });
    }
  } catch (error) {
    console.warn("Could not warm the page text-layer cache:", error);
    markPageAvailabilityCacheDirty(page.id, "warm-cache-failed");
  }
}

type PagePrewarmTrigger = "initial-render-ack" | "currentpagechange";

let initialRenderAckReceivedAt: number | null = null;

function scopeSwitchPrewarmLog(
  event: "scheduled" | "started" | "skipped",
  pageId: string,
  trigger: PagePrewarmTrigger,
  details: {
    cacheHadSummary?: boolean;
    cacheHadPending?: boolean;
    revisionMatched?: boolean;
    reason?: string;
  } = {}
) {
  if (!SCOPE_SWITCH_DEBUG) {
    return;
  }

  console.log(`[page-prewarm] ${event}`, {
    pageId,
    trigger,
    elapsedSinceInitialRenderMs:
      initialRenderAckReceivedAt !== null
        ? Date.now() - initialRenderAckReceivedAt
        : null,
    cacheHadSummary: details.cacheHadSummary ?? null,
    cacheHadPending: details.cacheHadPending ?? null,
    revisionMatched: details.revisionMatched ?? null,
    reason: details.reason ?? null,
  });
}

function attemptPageAvailabilityPrewarm(
  page: PageNode,
  trigger: PagePrewarmTrigger,
  revisionAtSchedule: number
) {
  const entry = pageAvailabilityCache.get(page.id);
  const cacheHadSummary = Boolean(entry && entry.summary && !entry.dirty);
  const cacheHadPending = Boolean(entry && entry.pending);
  const currentRevision = entry ? entry.revision : -1;
  const revisionMatched = currentRevision === revisionAtSchedule;

  if (figma.currentPage.id !== page.id) {
    scopeSwitchPrewarmLog("skipped", page.id, trigger, {
      cacheHadSummary,
      cacheHadPending,
      revisionMatched,
      reason: "current-page-changed",
    });
    return;
  }

  if (cacheHadSummary) {
    scopeSwitchPrewarmLog("skipped", page.id, trigger, {
      cacheHadSummary,
      cacheHadPending,
      revisionMatched,
      reason: "cache-already-has-summary",
    });
    return;
  }

  if (cacheHadPending) {
    scopeSwitchPrewarmLog("skipped", page.id, trigger, {
      cacheHadSummary,
      cacheHadPending,
      revisionMatched,
      reason: "pending-already-exists",
    });
    return;
  }

  scopeSwitchPrewarmLog("started", page.id, trigger, {
    cacheHadSummary,
    cacheHadPending,
    revisionMatched,
  });

  void warmPageAvailabilityCache(page, true);
}

function scheduleBackgroundPageAvailabilityPrewarm(
  page: PageNode,
  trigger: PagePrewarmTrigger = "currentpagechange"
) {
  const entryAtSchedule = pageAvailabilityCache.get(page.id);
  const revisionAtSchedule = entryAtSchedule ? entryAtSchedule.revision : -1;

  scopeSwitchPrewarmLog("scheduled", page.id, trigger, {
    cacheHadSummary: Boolean(
      entryAtSchedule && entryAtSchedule.summary && !entryAtSchedule.dirty
    ),
    cacheHadPending: Boolean(entryAtSchedule && entryAtSchedule.pending),
    revisionMatched: true,
  });

  setTimeout(() => {
    attemptPageAvailabilityPrewarm(page, trigger, revisionAtSchedule);
  }, 0);
}

type PendingInitialSelectionPrewarm = {
  page: PageNode;
};

let pendingInitialSelectionPrewarm: PendingInitialSelectionPrewarm | null =
  null;

function armInitialSelectionPrewarm(page: PageNode) {
  pendingInitialSelectionPrewarm = { page };
}

function handleSelectionInfoRenderedMessage(message: Record<string, unknown>) {
  const armed = pendingInitialSelectionPrewarm;

  if (!armed) {
    return;
  }

  if (message.initialRender !== true) {
    return;
  }

  if (message.pageId !== armed.page.id) {
    return;
  }

  pendingInitialSelectionPrewarm = null;
  initialRenderAckReceivedAt = Date.now();

  scheduleBackgroundPageAvailabilityPrewarm(armed.page, "initial-render-ack");
}

// Real (not diagnostics-only) UI-facing loading/error signal for a
// currently-in-flight currentPage analysis. Never sent for the selection
// scope: selection analysis is not batched/chunked and is not the source of
// the long-analysis UX problem this message exists to fix.
type ScopeAnalysisState = "loading" | "error";

function sendScopeAnalysisState(details: {
  state: ScopeAnalysisState;
  scope: TargetScope;
  requestId: number;
  pageId: string;
  debugScopeSwitchSequence: number;
  debugScopeSwitchStartedAt: number;
  progress?: PageAnalysisProgress | null;
}) {
  figma.ui.postMessage({
    type: "scope-analysis-state",
    state: details.state,
    scope: details.scope,
    requestId: details.requestId,
    pageId: details.pageId,
    ...(details.progress
      ? {
          processedTextNodeCount: details.progress.processedTextNodeCount,
          totalTextNodeCount: details.progress.totalTextNodeCount,
        }
      : {}),
    ...(SCOPE_SWITCH_DEBUG
      ? {
          debugScopeSwitchSequence: details.debugScopeSwitchSequence,
          debugScopeSwitchStartedAt: details.debugScopeSwitchStartedAt,
        }
      : {}),
  });
}

let selectionInfoRequestId = 0;

async function sendSelectionInfo() {
  const requestId = ++selectionInfoRequestId;
  const page = figma.currentPage;
  const selection = page.selection;

  const debugScopeSwitchSequence = SCOPE_SWITCH_DEBUG ? requestId : 0;
  const debugScopeSwitchStartedAt = SCOPE_SWITCH_DEBUG ? Date.now() : 0;
  const scopeSwitchMainStartedAt = SCOPE_SWITCH_DEBUG ? scopeSwitchDebugNow() : 0;

  function logScopeSwitchMainRequestCompleted(fields: Record<string, unknown>) {
    if (!SCOPE_SWITCH_DEBUG) {
      return;
    }

    console.log("[scope-switch-main] request completed", {
      sequence: debugScopeSwitchSequence,
      pageId: page.id,
      totalMainDurationMs: scopeSwitchDebugNow() - scopeSwitchMainStartedAt,
      elapsedSinceUiRequestMs: Date.now() - debugScopeSwitchStartedAt,
      ...fields,
    });
  }

  if (selection.length === 0) {
    const cacheEntryAtStart = pageAvailabilityCache.get(page.id);
    const cacheExistedAtStart = Boolean(cacheEntryAtStart);
    const cacheHadSummaryAtStart = Boolean(
      cacheEntryAtStart && cacheEntryAtStart.summary
    );
    const cacheDirtyAtStart = cacheEntryAtStart ? cacheEntryAtStart.dirty : true;
    const cacheHadPendingAtStart = Boolean(
      cacheEntryAtStart && cacheEntryAtStart.pending
    );
    const hasReadySummaryAtStart =
      cacheHadSummaryAtStart && !cacheDirtyAtStart && !cacheHadPendingAtStart;
    const pageDebugInfo = SCOPE_SWITCH_DEBUG
      ? createScopeSwitchPageDebugInfo()
      : undefined;

    // True only if this request is both the latest one issued AND still
    // matches live reality: the user has not since selected something (which
    // means they want the selection scope, not currentPage) -- even if no
    // selectionchange event fired to say so. Figma does not always emit one
    // for a selection that already existed before this request's listeners
    // were attached, so requestId alone cannot catch that case. Self-corrects
    // at most once by kicking off a fresh request the first time the mismatch
    // is observed, so a currentPage analysis nobody wants never leaves the UI
    // stuck in loading; the cache write from the analysis itself still lands
    // either way.
    let staleSelectionDetected = false;

    function isCurrentPageRequestStillActive(): boolean {
      if (requestId !== selectionInfoRequestId) {
        return false;
      }

      if (page.selection.length > 0) {
        if (!staleSelectionDetected) {
          staleSelectionDetected = true;
          void sendSelectionInfo();
        }

        return false;
      }

      return true;
    }

    if (!hasReadySummaryAtStart) {
      sendScopeAnalysisState({
        state: "loading",
        scope: "currentPage",
        requestId,
        pageId: page.id,
        debugScopeSwitchSequence,
        debugScopeSwitchStartedAt,
        progress: cacheEntryAtStart ? cacheEntryAtStart.pendingProgress : null,
      });
    }

    const removeProgressListener = hasReadySummaryAtStart
      ? null
      : addPageAnalysisProgressListener(page.id, (progress) => {
          if (!isCurrentPageRequestStillActive()) {
            return;
          }

          sendScopeAnalysisState({
            state: "loading",
            scope: "currentPage",
            requestId,
            pageId: page.id,
            debugScopeSwitchSequence,
            debugScopeSwitchStartedAt,
            progress,
          });
        });

    let availabilitySummary: TextNodeAvailabilitySummary;

    try {
      availabilitySummary = await getPageAvailabilitySummary(
        page,
        pageDebugInfo
      );
    } catch (error) {
      console.warn("Could not analyze the current page:", error);

      if (isCurrentPageRequestStillActive()) {
        sendScopeAnalysisState({
          state: "error",
          scope: "currentPage",
          requestId,
          pageId: page.id,
          debugScopeSwitchSequence,
          debugScopeSwitchStartedAt,
        });
      }

      logScopeSwitchMainRequestCompleted({
        requestedScope: "currentPage",
        resultSource: "page-analysis-error",
        cacheExistedAtStart,
        cacheHadSummaryAtStart,
        cacheDirtyAtStart,
        cacheHadPendingAtStart,
        cacheHadUpdateQueueAtStart: cacheExistedAtStart,
        updateQueueWaitDurationMs: pageDebugInfo?.updateQueueWaitDurationMs ?? 0,
        pendingWaitDurationMs: 0,
        pageLoadDurationMs: pageDebugInfo?.pageLoadDurationMs ?? 0,
        collectTextNodesDurationMs: pageDebugInfo?.collectTextNodesDurationMs ?? 0,
        analyzeTextNodesDurationMs: pageDebugInfo?.analyzeTextNodesDurationMs ?? 0,
        selectionCollectDurationMs: 0,
        selectionAnalyzeDurationMs: 0,
        postMessageCallDurationMs: 0,
        textNodeCount: 0,
        selectionRootCount: 0,
        missingNodeCount: 0,
        requestDropped: requestId !== selectionInfoRequestId,
        cacheDirtyAtEnd: pageAvailabilityCache.get(page.id)?.dirty ?? true,
      });

      return;
    } finally {
      removeProgressListener?.();
    }

    if (!isCurrentPageRequestStillActive()) {
      logScopeSwitchMainRequestCompleted({
        requestedScope: "currentPage",
        resultSource: "dropped",
        cacheExistedAtStart,
        cacheHadSummaryAtStart,
        cacheDirtyAtStart,
        cacheHadPendingAtStart,
        cacheHadUpdateQueueAtStart: cacheExistedAtStart,
        updateQueueWaitDurationMs: pageDebugInfo?.updateQueueWaitDurationMs ?? 0,
        pendingWaitDurationMs: 0,
        pageLoadDurationMs: pageDebugInfo?.pageLoadDurationMs ?? 0,
        collectTextNodesDurationMs: pageDebugInfo?.collectTextNodesDurationMs ?? 0,
        analyzeTextNodesDurationMs: pageDebugInfo?.analyzeTextNodesDurationMs ?? 0,
        selectionCollectDurationMs: 0,
        selectionAnalyzeDurationMs: 0,
        postMessageCallDurationMs: 0,
        textNodeCount: 0,
        selectionRootCount: 0,
        missingNodeCount: 0,
        requestDropped: true,
        cacheDirtyAtEnd: pageAvailabilityCache.get(page.id)?.dirty ?? true,
      });

      return;
    }

    const resultSource = cacheHadPendingAtStart
      ? "page-pending-result"
      : cacheHadSummaryAtStart && !cacheDirtyAtStart
        ? "page-cache-hit"
        : "page-full-recompute";

    const postMessageStartedAt = SCOPE_SWITCH_DEBUG ? scopeSwitchDebugNow() : 0;
    figma.ui.postMessage({
      type: "selection-info",
      requestId,
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
      pageId: page.id,
      ...(SCOPE_SWITCH_DEBUG
        ? { debugScopeSwitchSequence, debugScopeSwitchStartedAt }
        : {}),
    });
    const postMessageCallDurationMs = SCOPE_SWITCH_DEBUG
      ? scopeSwitchDebugNow() - postMessageStartedAt
      : 0;

    logScopeSwitchMainRequestCompleted({
      requestedScope: "currentPage",
      resultSource,
      cacheExistedAtStart,
      cacheHadSummaryAtStart,
      cacheDirtyAtStart,
      cacheHadPendingAtStart,
      cacheHadUpdateQueueAtStart: cacheExistedAtStart,
      updateQueueWaitDurationMs: pageDebugInfo?.updateQueueWaitDurationMs ?? 0,
      pendingWaitDurationMs:
        resultSource === "page-pending-result"
          ? scopeSwitchDebugNow() - scopeSwitchMainStartedAt
          : 0,
      pageLoadDurationMs: pageDebugInfo?.pageLoadDurationMs ?? 0,
      collectTextNodesDurationMs: pageDebugInfo?.collectTextNodesDurationMs ?? 0,
      analyzeTextNodesDurationMs: pageDebugInfo?.analyzeTextNodesDurationMs ?? 0,
      selectionCollectDurationMs: 0,
      selectionAnalyzeDurationMs: 0,
      postMessageCallDurationMs,
      textNodeCount: availabilitySummary.totalTextNodeCount,
      selectionRootCount: 0,
      missingNodeCount: 0,
      requestDropped: false,
      cacheDirtyAtEnd: pageAvailabilityCache.get(page.id)?.dirty ?? true,
    });

    return;
  }

  // Create the page entry before reading/analyzing the selection so the
  // selection result can be cached even when the whole-page summary has not
  // been built yet. This is what keeps returning to the same selection
  // instant while the page is warming in the background.
  const selectionCacheEntryAtStart =
    getOrCreatePageAvailabilityCacheEntry(page.id);
  const selectionResultCacheHit = readSelectionResultCache(page, selection);

  if (selectionResultCacheHit) {
    const postMessageStartedAt = SCOPE_SWITCH_DEBUG ? scopeSwitchDebugNow() : 0;
    figma.ui.postMessage({
      type: "selection-info",
      requestId,
      targetScope: selectionResultCacheHit.targetScope,
      scopeType: selectionResultCacheHit.scopeType,
      selectionKey: selectionResultCacheHit.selectionKey,
      selectedCount: selectionResultCacheHit.selectedCount,
      textNodeCount: selectionResultCacheHit.summary.totalTextNodeCount,
      availableTextNodeCount:
        selectionResultCacheHit.summary.availableTextNodeCount,
      skippedHiddenNodeCount:
        selectionResultCacheHit.summary.skippedHiddenNodeCount,
      skippedLockedNodeCount:
        selectionResultCacheHit.summary.skippedLockedNodeCount,
      skippedEmptyNodeCount:
        selectionResultCacheHit.summary.skippedEmptyNodeCount,
      skippedMissingFontsNodeCount:
        selectionResultCacheHit.summary.skippedMissingFontsNodeCount,
      pageId: page.id,
      ...(SCOPE_SWITCH_DEBUG
        ? { debugScopeSwitchSequence, debugScopeSwitchStartedAt }
        : {}),
    });
    const postMessageCallDurationMs = SCOPE_SWITCH_DEBUG
      ? scopeSwitchDebugNow() - postMessageStartedAt
      : 0;

    logScopeSwitchMainRequestCompleted({
      requestedScope: selectionResultCacheHit.targetScope,
      resultSource: "selection-result-cache",
      cacheExistedAtStart: true,
      cacheHadSummaryAtStart: true,
      cacheDirtyAtStart: false,
      cacheHadPendingAtStart: false,
      cacheHadUpdateQueueAtStart: true,
      updateQueueWaitDurationMs: 0,
      pendingWaitDurationMs: 0,
      pageLoadDurationMs: 0,
      collectTextNodesDurationMs: 0,
      analyzeTextNodesDurationMs: 0,
      selectionCollectDurationMs: 0,
      selectionAnalyzeDurationMs: 0,
      postMessageCallDurationMs,
      textNodeCount: selectionResultCacheHit.summary.totalTextNodeCount,
      selectionRootCount: selectionResultCacheHit.selectedCount,
      missingNodeCount: 0,
      requestDropped: false,
      cacheDirtyAtEnd: pageAvailabilityCache.get(page.id)?.dirty ?? true,
    });

    return;
  }

  const selectionCollectStartedAt = SCOPE_SWITCH_DEBUG
    ? scopeSwitchDebugNow()
    : 0;
  const target = resolveTextNodeTarget();
  const selectionCollectDurationMs = SCOPE_SWITCH_DEBUG
    ? scopeSwitchDebugNow() - selectionCollectStartedAt
    : 0;

  const cacheEntryAtStart = selectionCacheEntryAtStart;
  const cacheExistedAtStart = true;
  const cacheHadSummaryAtStart = Boolean(
    cacheEntryAtStart && cacheEntryAtStart.summary
  );
  const cacheDirtyAtStart = cacheEntryAtStart ? cacheEntryAtStart.dirty : true;
  const cacheHadPendingAtStart = Boolean(
    cacheEntryAtStart && cacheEntryAtStart.pending
  );
  const selectionCacheRevisionAtStart = cacheEntryAtStart
    ? cacheEntryAtStart.revision
    : -1;

  const selectionAnalyzeStartedAt = SCOPE_SWITCH_DEBUG
    ? scopeSwitchDebugNow()
    : 0;
  const selectionSummaryResult = await getSelectionAvailabilitySummary(
    page,
    target.textNodes
  );
  const selectionAnalyzeDurationMs = SCOPE_SWITCH_DEBUG
    ? scopeSwitchDebugNow() - selectionAnalyzeStartedAt
    : 0;
  const availabilitySummary = selectionSummaryResult.summary;

  if (requestId !== selectionInfoRequestId) {
    logScopeSwitchMainRequestCompleted({
      requestedScope: target.targetScope,
      resultSource: "dropped",
      cacheExistedAtStart,
      cacheHadSummaryAtStart,
      cacheDirtyAtStart,
      cacheHadPendingAtStart,
      cacheHadUpdateQueueAtStart: cacheExistedAtStart,
      updateQueueWaitDurationMs: 0,
      pendingWaitDurationMs: 0,
      pageLoadDurationMs: 0,
      collectTextNodesDurationMs: 0,
      analyzeTextNodesDurationMs: 0,
      selectionCollectDurationMs,
      selectionAnalyzeDurationMs,
      postMessageCallDurationMs: 0,
      textNodeCount: 0,
      selectionRootCount: target.selectedCount,
      missingNodeCount: selectionSummaryResult.missingNodeCount,
      requestDropped: true,
      cacheDirtyAtEnd: pageAvailabilityCache.get(page.id)?.dirty ?? true,
    });

    return;
  }

  const resultSource =
    selectionSummaryResult.source === "direct"
      ? "selection-full-analysis"
      : selectionSummaryResult.missingNodeCount === 0
        ? "selection-page-cache"
        : "selection-partial-analysis";

  const cacheEntryAfterSelectionAnalysis = pageAvailabilityCache.get(page.id);

  if (
    cacheEntryAfterSelectionAnalysis &&
    cacheEntryAfterSelectionAnalysis.revision === selectionCacheRevisionAtStart
  ) {
    writeSelectionResultCache({
      pageId: page.id,
      selectionRootIds: selection.map((node) => node.id),
      pageRevisionAtCache: cacheEntryAfterSelectionAnalysis.revision,
      pageSummaryRefAtCache: cacheEntryAfterSelectionAnalysis.summary,
      targetScope: target.targetScope,
      scopeType: target.scopeType,
      selectionKey: target.selectionKey,
      selectedCount: target.selectedCount,
      summary: availabilitySummary,
    });
  }

  const postMessageStartedAt = SCOPE_SWITCH_DEBUG ? scopeSwitchDebugNow() : 0;
  figma.ui.postMessage({
    type: "selection-info",
    requestId,
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
    pageId: page.id,
    ...(SCOPE_SWITCH_DEBUG
      ? { debugScopeSwitchSequence, debugScopeSwitchStartedAt }
      : {}),
  });
  const postMessageCallDurationMs = SCOPE_SWITCH_DEBUG
    ? scopeSwitchDebugNow() - postMessageStartedAt
    : 0;

  logScopeSwitchMainRequestCompleted({
    requestedScope: target.targetScope,
    resultSource,
    cacheExistedAtStart,
    cacheHadSummaryAtStart,
    cacheDirtyAtStart,
    cacheHadPendingAtStart,
    cacheHadUpdateQueueAtStart: cacheExistedAtStart,
    updateQueueWaitDurationMs: 0,
    pendingWaitDurationMs: 0,
    pageLoadDurationMs: 0,
    collectTextNodesDurationMs: 0,
    analyzeTextNodesDurationMs: 0,
    selectionCollectDurationMs,
    selectionAnalyzeDurationMs,
    postMessageCallDurationMs,
    textNodeCount: availabilitySummary.totalTextNodeCount,
    selectionRootCount: target.selectedCount,
    missingNodeCount: selectionSummaryResult.missingNodeCount,
    requestDropped: false,
    cacheDirtyAtEnd: pageAvailabilityCache.get(page.id)?.dirty ?? true,
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

// Selection/page events can fire while settings are still loading and before
// the UI has painted. Starting analysis from those early events could launch
// an unintended currentPage request which later replaced the selected scope.
// Fold them into the one authoritative request made after ui-ready.
let selectionInfoRequestsEnabled = false;

function requestSelectionInfoRefresh() {
  if (!selectionInfoRequestsEnabled) {
    return;
  }

  void sendSelectionInfo();
}

// Lets the UI's own first paint (its default loading skeleton, shown before
// any message from main) actually reach the screen before main starts the
// first -- potentially heavy -- analysis request. The UI sends "ui-ready"
// only after its own requestAnimationFrame following that first paint; see
// ui.html. No timeout fallback, matching the existing selection-info-rendered
// handshake this mirrors: a real browser tab always eventually paints and
// fires rAF, so this does not add a hang risk beyond what that pattern
// already accepted.
let uiReadyReceived = false;
let resolveUiReady: (() => void) | null = null;
const uiReadyPromise = new Promise<void>((resolve) => {
  resolveUiReady = resolve;
});

function handleUiReadyMessage() {
  if (uiReadyReceived) {
    return;
  }

  uiReadyReceived = true;
  resolveUiReady?.();
}

async function initializePlugin() {
  // Read the persisted interface theme before showing the window. This lets
  // the injected bootstrap script set data-theme before the first stylesheet
  // is parsed, so a light setup never flashes a dark startup frame (and vice
  // versa). Typography settings continue loading in parallel.
  const uiSettingsPromise = loadUiSettings();
  const settingsPromise = loadSettings();
  const uiSettings = await uiSettingsPromise;

  figma.showUI(createInitialUiHtml(uiSettings), {
    width: 420,
    height: 640,
  });

  const settings = await settingsPromise;
  const page = figma.currentPage;
  const initialTargetScope: TargetScope =
    page.selection.length > 0 ? "selection" : "currentPage";

  pruneRemovedPageAvailabilityCaches();
  ensurePageAvailabilityCacheSubscription(page);

  // Arm before the first selection-info can be acknowledged. Previously the
  // arm happened after sendSelectionInfo() returned, leaving a narrow race in
  // which the UI acknowledgement arrived first and the silent page prewarm
  // never started.
  if (initialTargetScope === "selection") {
    armInitialSelectionPrewarm(page);
  }

  figma.ui.postMessage({
    type: "settings-loaded",
    settings,
    uiSettings,
    initialTargetScope,
  });

  await uiReadyPromise;

  // Ignore/coalesce any startup selectionchange/currentpagechange events and
  // analyze the live state exactly once after the first UI paint.
  selectionInfoRequestsEnabled = true;
  await sendSelectionInfo();
}

figma.on("selectionchange", () => {
  requestSelectionInfoRefresh();
});

figma.on("currentpagechange", () => {
  const page = figma.currentPage;

  pruneRemovedPageAvailabilityCaches();
  ensurePageAvailabilityCacheSubscription(page);
  requestSelectionInfoRefresh();

  if (page.selection.length > 0) {
    scheduleBackgroundPageAvailabilityPrewarm(page);
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

  if (message.type === "selection-info-rendered") {
    handleSelectionInfoRenderedMessage(message);
  }

  if (message.type === "ui-ready") {
    handleUiReadyMessage();
  }
};

initializePlugin();
