(() => {
  "use strict";

  const LIST_ROW_SELECTOR = '.ReactVirtualized__Table__row.table-row[data-testid^="ListViewTableRow-"]';
  const GRID_ITEM_SELECTOR = '[data-testid="grid-view-item"]';
  const ITEM_CONTAINER_SELECTOR = `${LIST_ROW_SELECTOR}, ${GRID_ITEM_SELECTOR}`;

  const DIRECT_BUTTON_CLASS = "crx-box-direct-link-button";
  const GRID_OVERLAY_ROOT_CLASS = "crx-box-direct-link-grid-overlay-root";
  const MENU_ITEM_CLASS = "crx-box-direct-link-menu-item";
  const TOAST_CLASS = "crx-box-direct-link-toast";

  const MENU_SELECTOR = "ul.aria-menu.item-menu";
  const MENU_DOWNLOAD_ITEM_SELECTOR = ':scope > li[data-testid="download-menu-item"]';
  const MORE_OPTIONS_BUTTON_SELECTOR =
    '[data-testid="more-options-bp-icon-button"], button[aria-label*="その他のオプション"], button[aria-label*="More options"]';

  const GRID_BUTTON_INSET_PX = 16;
  const GRID_BUTTON_MIN_SIZE_PX = 24;
  const VIEWPORT_MARGIN_PX = 6;

  const TIMINGS = Object.freeze({
    toastVisibleMs: 1500,
    flashStateMs: 1200,
    contextTtlMs: 8000,
    periodicScanMs: 1200,
    menuCloseDelayMs: 180,
    menuCloseFallbackMs: 650,
    postMenuRescanDelaysMs: [0, 50, 120, 220, 360, 560, 820]
  });

  const PRIMARY_LOCALE = (navigator.language || (navigator.languages && navigator.languages[0]) || "en").toLowerCase();
  const IS_JA = PRIMARY_LOCALE.startsWith("ja");

  const BUTTON_TEXT = IS_JA ? "直リンクをコピー" : "Copy direct link";
  const TOAST_SUCCESS_TEXT = IS_JA ? "直リンクをクリップボードにコピーしました" : "Direct link copied to clipboard";
  const TOAST_ERROR_TEXT = IS_JA ? "直リンクのコピーに失敗しました" : "Failed to copy direct link";

  const SELECTED_CONTAINER_SELECTOR = [
    `${ITEM_CONTAINER_SELECTOR}[aria-selected="true"]`,
    `${ITEM_CONTAINER_SELECTOR}[data-is-selected="true"]`,
    `${ITEM_CONTAINER_SELECTOR}.selected`,
    `${ITEM_CONTAINER_SELECTOR}.is-selected`
  ].join(", ");

  const state = {
    scheduled: false,
    toastTimerId: 0,
    lastContextItem: null,
    lastContextName: "",
    lastContextCapturedAt: 0,
    overlayRoot: null,
    gridButtonsByKey: new Map(),
    itemByName: new Map()
  };

  const DIRECT_ICON_TEMPLATE = createDirectLinkIconTemplate();

  function createDirectLinkIconTemplate() {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 16 16");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("crx-box-direct-link-icon");

    const leftLink = document.createElementNS(ns, "path");
    leftLink.setAttribute("d", "M6.2 11.2 5.1 12.3a2.1 2.1 0 1 1-3-3l1.4-1.4a2.1 2.1 0 0 1 3 0");

    const rightLink = document.createElementNS(ns, "path");
    rightLink.setAttribute("d", "M9.8 4.8 10.9 3.7a2.1 2.1 0 1 1 3 3l-1.4 1.4a2.1 2.1 0 0 1-3 0");

    const connector = document.createElementNS(ns, "path");
    connector.setAttribute("d", "M5.8 10.2 10.2 5.8");

    svg.append(leftLink, rightLink, connector);
    return svg;
  }

  function createDirectLinkIcon() {
    return DIRECT_ICON_TEMPLATE.cloneNode(true);
  }

  function normalizeText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function parseHrefItem(href) {
    if (!href) {
      return null;
    }

    const match = href.match(/\/(folder|file|files)\/(\d+)/);
    if (!match) {
      return null;
    }

    return {
      kind: match[1] === "folder" ? "folder" : "file",
      id: match[2]
    };
  }

  function getItemFromContainer(container) {
    const folderId = container.getAttribute("data-resin-folder_id");
    if (folderId) {
      return { kind: "folder", id: folderId };
    }

    const fileId = container.getAttribute("data-resin-file_id");
    if (fileId) {
      return { kind: "file", id: fileId };
    }

    const link = container.querySelector('a.item-link[href*="/folder/"], a.item-link[href*="/file/"], a.item-link[href*="/files/"]');
    if (!link) {
      return null;
    }

    return parseHrefItem(link.getAttribute("href"));
  }

  function getContainerName(container) {
    const nameEl = container.querySelector(
      '.file-list-name a.item-link, .item-list-name a.item-link, .file-list-name .item-link, .item-list-name .item-link, .file-list-name, .item-list-name'
    );
    return normalizeText(nameEl?.textContent || "");
  }

  function getItemByName(name) {
    const normalized = normalizeText(name);
    if (!normalized) {
      return null;
    }
    return state.itemByName.get(normalized) || null;
  }

  function indexItemByName(name, item) {
    if (!item) {
      return;
    }
    const normalized = normalizeText(name);
    if (!normalized || state.itemByName.has(normalized)) {
      return;
    }
    state.itemByName.set(normalized, item);
  }

  function captureContextFromContainer(container) {
    const item = getItemFromContainer(container);
    if (!item) {
      return;
    }

    state.lastContextItem = item;
    state.lastContextName = getContainerName(container);
    state.lastContextCapturedAt = Date.now();
  }

  function extractMenuHeaderName(menu) {
    const header = menu.querySelector(':scope > [data-testid="bdl-MenuHeader"]');
    const text = normalizeText(header?.textContent || "");
    if (!text) {
      return "";
    }

    const jaMatch = text.match(/^(.+?)を選択中$/);
    if (jaMatch) {
      return jaMatch[1];
    }

    const enMatch = text.match(/^(.+?)\s+selected$/i);
    if (enMatch) {
      return enMatch[1];
    }

    return "";
  }

  function getRecentContextItem(headerName) {
    if (!state.lastContextItem) {
      return null;
    }

    if (Date.now() - state.lastContextCapturedAt > TIMINGS.contextTtlMs) {
      return null;
    }

    if (!headerName || normalizeText(headerName) === normalizeText(state.lastContextName)) {
      return state.lastContextItem;
    }

    return null;
  }

  function getFocusedContextItem() {
    if (!(document.activeElement instanceof Element)) {
      return null;
    }

    const container = document.activeElement.closest(ITEM_CONTAINER_SELECTOR);
    if (!container) {
      return null;
    }

    return getItemFromContainer(container);
  }

  function getSelectedContextItem() {
    const selectedContainer = document.querySelector(SELECTED_CONTAINER_SELECTOR);
    if (!selectedContainer) {
      return null;
    }

    return getItemFromContainer(selectedContainer);
  }

  function getContextItemForMenu(menu) {
    const headerName = extractMenuHeaderName(menu);

    const byHeader = getItemByName(headerName);
    if (byHeader) {
      return byHeader;
    }

    const recent = getRecentContextItem(headerName);
    if (recent) {
      return recent;
    }

    const focused = getFocusedContextItem();
    if (focused) {
      return focused;
    }

    return getSelectedContextItem();
  }

  function buildDirectUrl(item) {
    return new URL(`/${item.kind}/${item.id}`, window.location.origin).toString();
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_error) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "readonly");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();

      let copied = false;
      try {
        copied = document.execCommand("copy");
      } finally {
        textarea.remove();
      }

      return copied;
    }
  }

  function ensureToast() {
    let toast = document.querySelector(`.${TOAST_CLASS}`);
    if (toast) {
      return toast;
    }

    toast = document.createElement("div");
    toast.className = TOAST_CLASS;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
    return toast;
  }

  function positionToast(toast, anchorEl) {
    if (!anchorEl) {
      toast.dataset.placement = "bottom";
      toast.style.left = "50%";
      toast.style.top = "auto";
      toast.style.bottom = "24px";
      return;
    }

    const margin = 8;
    const rect = anchorEl.getBoundingClientRect();

    toast.style.bottom = "auto";
    toast.style.left = `${rect.left + rect.width / 2}px`;
    toast.style.top = `${rect.top - margin}px`;
    toast.dataset.placement = "top";

    const box = toast.getBoundingClientRect();

    let left = rect.left + rect.width / 2;
    left = Math.max(margin + box.width / 2, left);
    left = Math.min(window.innerWidth - margin - box.width / 2, left);

    let top = rect.top - margin;
    let placement = "top";
    if (top - box.height < margin) {
      top = rect.bottom + margin;
      placement = "bottom";
    }

    toast.style.left = `${left}px`;
    toast.style.top = `${top}px`;
    toast.dataset.placement = placement;
  }

  function showToast(message, type, anchorEl) {
    const toast = ensureToast();
    toast.textContent = message;
    toast.classList.remove("is-success", "is-error", "is-visible");
    toast.classList.add(type === "error" ? "is-error" : "is-success");
    positionToast(toast, anchorEl);

    window.requestAnimationFrame(() => {
      toast.classList.add("is-visible");
    });

    if (state.toastTimerId) {
      window.clearTimeout(state.toastTimerId);
    }

    state.toastTimerId = window.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, TIMINGS.toastVisibleMs);
  }

  function flashElement(element, stateClass) {
    element.classList.add(stateClass);
    window.setTimeout(() => {
      element.classList.remove(stateClass);
    }, TIMINGS.flashStateMs);
  }

  async function copyItemDirectLink(item, anchorEl, feedbackEl) {
    if (!item) {
      if (feedbackEl) {
        flashElement(feedbackEl, "is-error");
      }
      showToast(TOAST_ERROR_TEXT, "error", anchorEl || feedbackEl || null);
      return false;
    }

    const copied = await copyText(buildDirectUrl(item));

    if (feedbackEl) {
      flashElement(feedbackEl, copied ? "is-success" : "is-error");
    }

    showToast(copied ? TOAST_SUCCESS_TEXT : TOAST_ERROR_TEXT, copied ? "success" : "error", anchorEl || feedbackEl || null);
    return copied;
  }

  function stopEvent(event, preventDefault) {
    if (preventDefault) {
      event.preventDefault();
    }
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }
  }

  function getItemFromButton(button) {
    const container = button.closest(ITEM_CONTAINER_SELECTOR);
    if (container) {
      const fromContainer = getItemFromContainer(container);
      if (fromContainer) {
        return fromContainer;
      }
    }

    const kind = button.getAttribute("data-direct-kind");
    const id = button.getAttribute("data-direct-id");
    if ((kind === "folder" || kind === "file") && id) {
      return { kind, id };
    }

    return null;
  }

  async function copyFromButton(button) {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    if (button.classList.contains("is-pending")) {
      return;
    }

    const item = getItemFromButton(button);
    if (!item) {
      flashElement(button, "is-error");
      showToast(TOAST_ERROR_TEXT, "error", button);
      return;
    }

    button.classList.add("is-pending");
    try {
      await copyItemDirectLink(item, button, button);
    } finally {
      button.classList.remove("is-pending");
    }
  }

  function createDirectButton(placementClass, item, key) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `btn-plain ${DIRECT_BUTTON_CLASS} ${placementClass}`;
    button.setAttribute("aria-label", BUTTON_TEXT);
    button.setAttribute("title", BUTTON_TEXT);

    if (item) {
      button.setAttribute("data-direct-kind", item.kind);
      button.setAttribute("data-direct-id", item.id);
    }
    if (key) {
      button.setAttribute("data-direct-key", key);
    }

    button.appendChild(createDirectLinkIcon());

    button.addEventListener("mousedown", (event) => {
      stopEvent(event, false);
    });

    button.addEventListener("click", async (event) => {
      stopEvent(event, true);
      await copyFromButton(button);
    });

    return button;
  }

  function ensureGridOverlayRoot() {
    if (state.overlayRoot && state.overlayRoot.isConnected) {
      return state.overlayRoot;
    }

    const root = document.createElement("div");
    root.className = GRID_OVERLAY_ROOT_CLASS;
    document.body.appendChild(root);
    state.overlayRoot = root;
    return root;
  }

  function removeGridButton(key) {
    const button = state.gridButtonsByKey.get(key);
    if (!button) {
      return;
    }

    button.remove();
    state.gridButtonsByKey.delete(key);
  }

  function isGridContainerVisible(rect) {
    if (rect.width < GRID_BUTTON_MIN_SIZE_PX || rect.height < GRID_BUTTON_MIN_SIZE_PX) {
      return false;
    }

    if (rect.bottom < 0 || rect.right < 0 || rect.top > window.innerHeight || rect.left > window.innerWidth) {
      return false;
    }

    return true;
  }

  function positionGridButton(button, rect) {
    const left = Math.max(VIEWPORT_MARGIN_PX, rect.left + GRID_BUTTON_INSET_PX);
    const top = Math.max(VIEWPORT_MARGIN_PX, rect.top + GRID_BUTTON_INSET_PX);
    button.style.left = `${left}px`;
    button.style.top = `${top}px`;
  }

  function attachButtonToListRow(row) {
    const nameCell = row.querySelector(".file-list-name");
    if (!nameCell) {
      return;
    }

    if (nameCell.querySelector(`:scope > .${DIRECT_BUTTON_CLASS}.in-name-cell`)) {
      return;
    }

    nameCell.classList.add("crx-box-direct-link-name-cell");
    nameCell.appendChild(createDirectButton("in-name-cell"));
  }

  function syncGridButtons(gridTargets) {
    if (gridTargets.length === 0 && state.gridButtonsByKey.size === 0) {
      if (state.overlayRoot && state.overlayRoot.isConnected) {
        state.overlayRoot.remove();
      }
      state.overlayRoot = null;
      return;
    }

    const overlayRoot = ensureGridOverlayRoot();
    const aliveKeys = new Set();

    for (const target of gridTargets) {
      const key = `${target.item.kind}:${target.item.id}`;
      aliveKeys.add(key);

      const rect = target.container.getBoundingClientRect();
      if (!isGridContainerVisible(rect)) {
        removeGridButton(key);
        continue;
      }

      let button = state.gridButtonsByKey.get(key);
      if (!button) {
        button = createDirectButton("in-grid-overlay", target.item, key);
        state.gridButtonsByKey.set(key, button);
      } else {
        button.setAttribute("data-direct-kind", target.item.kind);
        button.setAttribute("data-direct-id", target.item.id);
      }

      if (button.parentElement !== overlayRoot) {
        overlayRoot.appendChild(button);
      }

      positionGridButton(button, rect);
    }

    for (const key of Array.from(state.gridButtonsByKey.keys())) {
      if (!aliveKeys.has(key)) {
        removeGridButton(key);
      }
    }

    if (state.gridButtonsByKey.size === 0 && state.overlayRoot && state.overlayRoot.isConnected) {
      state.overlayRoot.remove();
      state.overlayRoot = null;
    }
  }

  function createMenuItemIcon() {
    const icon = createDirectLinkIcon();
    icon.classList.add("crx-box-direct-link-menu-icon");
    icon.setAttribute("width", "1em");
    icon.setAttribute("height", "1em");
    return icon;
  }

  function closeMenuFromItem(menuItem) {
    const menu = menuItem.closest(MENU_SELECTOR);
    if (!menu) {
      return;
    }

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const dispatchEscape = (target) => {
      if (!target || typeof target.dispatchEvent !== "function") {
        return;
      }
      target.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Escape",
          code: "Escape",
          bubbles: true,
          cancelable: true
        })
      );
      target.dispatchEvent(
        new KeyboardEvent("keyup", {
          key: "Escape",
          code: "Escape",
          bubbles: true,
          cancelable: true
        })
      );
    };

    const scheduleScanBurst = () => {
      for (const delayMs of TIMINGS.postMenuRescanDelaysMs) {
        window.setTimeout(() => {
          scheduleScan();
          if (delayMs === 0) {
            window.requestAnimationFrame(scheduleScan);
          }
        }, delayMs);
      }
    };

    window.setTimeout(() => {
      dispatchEscape(menu);
      dispatchEscape(document);
      dispatchEscape(window);
      scheduleScanBurst();
    }, TIMINGS.menuCloseDelayMs);

    window.setTimeout(() => {
      if (menu.isConnected) {
        menu.remove();
      }
      scheduleScanBurst();
    }, TIMINGS.menuCloseFallbackMs);
  }

  function createMenuCopyItem(item) {
    const menuItem = document.createElement("li");
    menuItem.className = `menu-item ${MENU_ITEM_CLASS}`;
    menuItem.setAttribute("role", "menuitem");
    menuItem.setAttribute("tabindex", "-1");
    menuItem.setAttribute("data-testid", "direct-link-menu-item");
    menuItem.setAttribute("data-target-id", "MenuItem-copyDirectLink");

    const label = document.createElement("span");
    label.textContent = BUTTON_TEXT;

    menuItem.append(createMenuItemIcon(), label);

    menuItem.addEventListener("click", async (event) => {
      stopEvent(event, true);
      menuItem.classList.add("is-pending");
      try {
        const copied = await copyItemDirectLink(item, menuItem, menuItem);
        if (copied) {
          closeMenuFromItem(menuItem);
        }
      } finally {
        menuItem.classList.remove("is-pending");
      }
    });

    return menuItem;
  }

  function injectMenuItems() {
    const menus = document.querySelectorAll(MENU_SELECTOR);
    for (const menu of menus) {
      const downloadItem = menu.querySelector(MENU_DOWNLOAD_ITEM_SELECTOR);
      if (!downloadItem) {
        continue;
      }

      if (menu.querySelector(`:scope > .${MENU_ITEM_CLASS}`)) {
        continue;
      }

      const contextItem = getContextItemForMenu(menu);
      if (!contextItem) {
        continue;
      }

      downloadItem.insertAdjacentElement("beforebegin", createMenuCopyItem(contextItem));
    }
  }

  function handleGlobalContextCapture(event) {
    if (!(event.target instanceof Element)) {
      return;
    }

    if (event.target.closest(`.${DIRECT_BUTTON_CLASS}`)) {
      return;
    }

    const container = event.target.closest(ITEM_CONTAINER_SELECTOR);
    if (container) {
      captureContextFromContainer(container);
      return;
    }

    const moreOptions = event.target.closest(MORE_OPTIONS_BUTTON_SELECTOR);
    if (!moreOptions) {
      return;
    }

    const parentContainer = moreOptions.closest(ITEM_CONTAINER_SELECTOR);
    if (parentContainer) {
      captureContextFromContainer(parentContainer);
    }
  }

  function scanItems() {
    const containers = document.querySelectorAll(ITEM_CONTAINER_SELECTOR);
    const gridTargets = [];

    state.itemByName.clear();

    for (const container of containers) {
      const item = getItemFromContainer(container);
      const name = getContainerName(container);
      indexItemByName(name, item);

      if (container.matches(LIST_ROW_SELECTOR)) {
        attachButtonToListRow(container);
        continue;
      }

      if (container.matches(GRID_ITEM_SELECTOR) && item) {
        gridTargets.push({ container, item });
      }
    }

    syncGridButtons(gridTargets);
    injectMenuItems();
  }

  function scheduleScan() {
    if (state.scheduled) {
      return;
    }

    state.scheduled = true;
    window.requestAnimationFrame(() => {
      state.scheduled = false;
      scanItems();
    });
  }

  const observer = new MutationObserver((mutations) => {
    const overlayRoot = state.overlayRoot;

    for (const mutation of mutations) {
      if (
        overlayRoot &&
        mutation.target instanceof Node &&
        (mutation.target === overlayRoot || overlayRoot.contains(mutation.target))
      ) {
        continue;
      }

      scheduleScan();
      return;
    }
  });

  function start() {
    // Clean up any stale overlay roots/buttons left by hot-reload cycles.
    document.querySelectorAll(`.${GRID_OVERLAY_ROOT_CLASS}`).forEach((root) => root.remove());
    state.overlayRoot = null;
    state.gridButtonsByKey.clear();

    scanItems();

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-resin-folder_id", "data-resin-file_id", "data-testid"]
    });

    document.addEventListener("mousedown", handleGlobalContextCapture, true);
    document.addEventListener("contextmenu", handleGlobalContextCapture, true);
    window.addEventListener("scroll", scheduleScan, true);
    window.addEventListener("resize", scheduleScan);
    window.addEventListener("popstate", scheduleScan);
    window.addEventListener("hashchange", scheduleScan);

    window.setInterval(() => {
      if (document.visibilityState === "hidden") {
        return;
      }
      scheduleScan();
    }, TIMINGS.periodicScanMs);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
