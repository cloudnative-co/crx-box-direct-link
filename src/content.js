(() => {
  "use strict";

  const ROW_SELECTOR = '.ReactVirtualized__Table__row.table-row[data-testid^="ListViewTableRow-"]';
  const DIRECT_BUTTON_CLASS = "crx-box-direct-link-button";
  const MENU_ITEM_CLASS = "crx-box-direct-link-menu-item";
  const TOAST_CLASS = "crx-box-direct-link-toast";
  const MENU_SELECTOR = "ul.aria-menu.item-menu";
  const MENU_DOWNLOAD_ITEM_SELECTOR = ':scope > li[data-testid="download-menu-item"]';
  const MORE_OPTIONS_BUTTON_SELECTOR = '[data-testid="more-options-bp-icon-button"], button[aria-label*="その他のオプション"]';
  const PRIMARY_LOCALE = (navigator.language || (navigator.languages && navigator.languages[0]) || "en").toLowerCase();
  const IS_JA = PRIMARY_LOCALE.startsWith("ja");
  const BUTTON_TEXT = IS_JA ? "直リンクをコピー" : "Copy direct link";
  const TOAST_SUCCESS_TEXT = IS_JA ? "直リンクをクリップボードにコピーしました" : "Direct link copied to clipboard";
  const TOAST_ERROR_TEXT = IS_JA ? "直リンクのコピーに失敗しました" : "Failed to copy direct link";

  let scheduled = false;
  let toastTimerId = 0;
  let lastContextItem = null;
  let lastContextName = "";
  let lastContextCapturedAt = 0;

  function createDirectLinkIcon() {
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

    if (toastTimerId) {
      window.clearTimeout(toastTimerId);
    }

    toastTimerId = window.setTimeout(() => {
      toast.classList.remove("is-visible");
    }, 1500);
  }

  function parseHrefItem(href) {
    if (!href) {
      return null;
    }

    const match = href.match(/\/(folder|file|files)\/(\d+)/);
    if (!match) {
      return null;
    }

    const kind = match[1] === "folder" ? "folder" : "file";
    return {
      kind,
      id: match[2]
    };
  }

  function getItemFromRow(row) {
    const folderId = row.getAttribute("data-resin-folder_id");
    if (folderId) {
      return {
        kind: "folder",
        id: folderId
      };
    }

    const fileId = row.getAttribute("data-resin-file_id");
    if (fileId) {
      return {
        kind: "file",
        id: fileId
      };
    }

    const link = row.querySelector('a.item-link[href*="/folder/"], a.item-link[href*="/file/"], a.item-link[href*="/files/"]');
    if (!link) {
      return null;
    }

    return parseHrefItem(link.getAttribute("href"));
  }

  function normalizeText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function getRowName(row) {
    const link = row.querySelector('.file-list-name a.item-link');
    return normalizeText(link?.textContent || "");
  }

  function findItemByRowName(name) {
    if (!name) {
      return null;
    }

    const normalizedName = normalizeText(name);
    if (!normalizedName) {
      return null;
    }

    const rows = document.querySelectorAll(ROW_SELECTOR);
    for (const row of rows) {
      if (getRowName(row) !== normalizedName) {
        continue;
      }

      const item = getItemFromRow(row);
      if (item) {
        return item;
      }
    }

    return null;
  }

  function captureContextFromRow(row) {
    const item = getItemFromRow(row);
    if (!item) {
      return;
    }

    lastContextItem = item;
    lastContextName = getRowName(row);
    lastContextCapturedAt = Date.now();
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

    const enMatch = text.match(/^(.+?)\\s+selected$/i);
    if (enMatch) {
      return enMatch[1];
    }

    return "";
  }

  function getContextItemForMenu(menu) {
    const headerName = extractMenuHeaderName(menu);
    const fromHeader = findItemByRowName(headerName);
    if (fromHeader) {
      return fromHeader;
    }

    if (lastContextItem && Date.now() - lastContextCapturedAt < 8000) {
      if (!headerName || normalizeText(headerName) === normalizeText(lastContextName)) {
        return lastContextItem;
      }
    }

    return null;
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

      let ok = false;
      try {
        ok = document.execCommand("copy");
      } finally {
        textarea.remove();
      }
      return ok;
    }
  }

  function flashButton(button, stateClass) {
    button.classList.add(stateClass);

    window.setTimeout(() => {
      button.classList.remove(stateClass);
    }, 1200);
  }

  async function copyItemDirectLink(item, anchorEl, feedbackEl) {
    if (!item) {
      if (feedbackEl) {
        flashButton(feedbackEl, "is-error");
      }
      showToast(TOAST_ERROR_TEXT, "error", anchorEl || feedbackEl || null);
      return false;
    }

    const directUrl = buildDirectUrl(item);
    const copied = await copyText(directUrl);

    if (feedbackEl) {
      flashButton(feedbackEl, copied ? "is-success" : "is-error");
    }

    showToast(copied ? TOAST_SUCCESS_TEXT : TOAST_ERROR_TEXT, copied ? "success" : "error", anchorEl || feedbackEl || null);
    return copied;
  }

  function createButton(row) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `btn-plain ${DIRECT_BUTTON_CLASS} in-name-cell`;
    button.setAttribute("aria-label", BUTTON_TEXT);
    button.setAttribute("title", BUTTON_TEXT);
    button.appendChild(createDirectLinkIcon());

    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      button.classList.add("is-pending");
      const item = getItemFromRow(row);
      await copyItemDirectLink(item, button, button);
      button.classList.remove("is-pending");
    });

    return button;
  }

  function attachButtonToRow(row) {
    const nameCell = row.querySelector(".file-list-name");
    if (!nameCell) {
      return;
    }

    if (nameCell.querySelector(`:scope > .${DIRECT_BUTTON_CLASS}.in-name-cell`)) {
      return;
    }

    nameCell.classList.add("crx-box-direct-link-name-cell");
    const button = createButton(row);
    nameCell.appendChild(button);
  }

  function createMenuItemIcon() {
    const icon = createDirectLinkIcon();
    icon.classList.add("crx-box-direct-link-menu-icon");
    icon.setAttribute("width", "1em");
    icon.setAttribute("height", "1em");
    return icon;
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
      event.preventDefault();
      event.stopPropagation();
      menuItem.classList.add("is-pending");
      await copyItemDirectLink(item, menuItem, menuItem);
      menuItem.classList.remove("is-pending");
    });

    return menuItem;
  }

  function injectMenuItems() {
    const menus = document.querySelectorAll(MENU_SELECTOR);
    menus.forEach((menu) => {
      const downloadItem = menu.querySelector(MENU_DOWNLOAD_ITEM_SELECTOR);
      if (!downloadItem) {
        return;
      }

      if (menu.querySelector(`:scope > .${MENU_ITEM_CLASS}`)) {
        return;
      }

      const contextItem = getContextItemForMenu(menu);
      if (!contextItem) {
        return;
      }

      const menuItem = createMenuCopyItem(contextItem);
      downloadItem.insertAdjacentElement("beforebegin", menuItem);
    });
  }

  function handleGlobalMouseDown(event) {
    if (!(event.target instanceof Element)) {
      return;
    }

    const trigger = event.target.closest(MORE_OPTIONS_BUTTON_SELECTOR);
    if (!trigger) {
      return;
    }

    const row = trigger.closest(ROW_SELECTOR);
    if (!row) {
      return;
    }

    captureContextFromRow(row);
  }

  function scanRows() {
    const rows = document.querySelectorAll(ROW_SELECTOR);
    rows.forEach((row) => attachButtonToRow(row));
    injectMenuItems();
  }

  function scheduleScan() {
    if (scheduled) {
      return;
    }

    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      scanRows();
    });
  }

  const observer = new MutationObserver(() => {
    scheduleScan();
  });

  function start() {
    scanRows();
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-resin-folder_id", "data-resin-file_id", "data-testid", "class"]
    });

    document.addEventListener("mousedown", handleGlobalMouseDown, true);
    window.addEventListener("popstate", scheduleScan);
    window.addEventListener("hashchange", scheduleScan);
    window.setInterval(scheduleScan, 1200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
