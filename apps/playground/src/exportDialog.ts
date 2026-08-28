import type { EugineDocument } from "eugine";
import { buildStandaloneHtmlDocument, exportDocumentToHtml, EXPORT_CSS } from "./exportHtml.js";
import { icon } from "./icons.js";
import { createZip, downloadBlob } from "./zip.js";
import { showToast } from "./toast.js";

type TabId = "html" | "css";

const TABS: { id: TabId; label: string }[] = [
  { id: "html", label: "HTML" },
  { id: "css", label: "CSS" },
];

let root: HTMLElement | null = null;
let activeTab: TabId = "html";
let currentHtml = "";
let currentCss = "";
let lastFocused: HTMLElement | null = null;

function build(): HTMLElement {
  const backdrop = document.createElement("div");
  backdrop.className = "eb-dialog-backdrop";
  backdrop.innerHTML = `
    <div class="eb-dialog" role="dialog" aria-modal="true" aria-labelledby="eb-dialog-title">
      <header class="eb-dialog-header">
        <h2 id="eb-dialog-title">Export site</h2>
        <button type="button" class="eb-icon-btn" data-action="close" aria-label="Close">${icon("close")}</button>
      </header>
      <div class="eb-dialog-tabs" role="tablist">
        ${TABS.map(
          (t, i) =>
            `<button type="button" class="eb-tab" role="tab" data-tab="${t.id}" aria-selected="${i === 0}">${t.label}</button>`,
        ).join("")}
        <span class="eb-tab-indicator" aria-hidden="true"></span>
      </div>
      <div class="eb-dialog-body">
        <div class="eb-code-toolbar">
          <span class="eb-code-filename" data-filename></span>
          <button type="button" class="eb-btn eb-btn-ghost eb-btn-sm" data-action="copy">
            ${icon("copy")}<span>Copy</span>
          </button>
        </div>
        <pre class="eb-code-block"><code data-code></code></pre>
      </div>
      <footer class="eb-dialog-footer">
        <p class="eb-dialog-hint">Downloads <code>index.html</code> + <code>styles.css</code> as a zip.</p>
        <button type="button" class="eb-btn eb-btn-primary" data-action="download">
          ${icon("package")}<span>Download ZIP</span>
        </button>
      </footer>
    </div>
  `;
  document.body.appendChild(backdrop);

  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close();
  });
  backdrop.querySelector('[data-action="close"]')!.addEventListener("click", () => close());
  backdrop.querySelector('[data-action="copy"]')!.addEventListener("click", (e) => copyActiveTab(e.currentTarget as HTMLButtonElement));
  backdrop.querySelector('[data-action="download"]')!.addEventListener("click", () => downloadZip());

  for (const tabBtn of backdrop.querySelectorAll<HTMLButtonElement>(".eb-tab")) {
    tabBtn.addEventListener("click", () => setActiveTab(tabBtn.dataset.tab as TabId));
  }

  // Attached at the document level rather than on `backdrop` — right after
  // open() the focus-move to the close button is scheduled via rAF, so a
  // keydown that arrives before that frame runs would still have focus
  // outside the backdrop and never bubble through a backdrop-scoped listener.
  document.addEventListener("keydown", (event) => {
    if (!backdrop.classList.contains("eb-dialog-open")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "Tab") {
      trapFocus(event, backdrop);
    }
  });

  return backdrop;
}

function trapFocus(event: KeyboardEvent, backdrop: HTMLElement): void {
  const focusable = Array.from(backdrop.querySelectorAll<HTMLElement>("button, [tabindex]")).filter(
    (el) => !el.hasAttribute("disabled"),
  );
  if (focusable.length === 0) return;
  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function setActiveTab(tab: TabId): void {
  activeTab = tab;
  if (!root) return;

  for (const tabBtn of root.querySelectorAll<HTMLButtonElement>(".eb-tab")) {
    tabBtn.setAttribute("aria-selected", String(tabBtn.dataset.tab === tab));
  }
  const index = TABS.findIndex((t) => t.id === tab);
  const indicator = root.querySelector<HTMLElement>(".eb-tab-indicator")!;
  indicator.style.transform = `translateX(${index * 100}%)`;

  const codeEl = root.querySelector<HTMLElement>("[data-code]")!;
  const filenameEl = root.querySelector<HTMLElement>("[data-filename]")!;
  if (tab === "html") {
    codeEl.textContent = currentHtml;
    filenameEl.textContent = "index.html";
  } else {
    codeEl.textContent = currentCss;
    filenameEl.textContent = "styles.css";
  }
}

async function copyActiveTab(button: HTMLButtonElement): Promise<void> {
  const text = activeTab === "html" ? currentHtml : currentCss;
  try {
    await navigator.clipboard.writeText(text);
    const original = button.innerHTML;
    button.innerHTML = `${icon("check")}<span>Copied</span>`;
    button.classList.add("eb-btn-success");
    setTimeout(() => {
      button.innerHTML = original;
      button.classList.remove("eb-btn-success");
    }, 1400);
  } catch {
    showToast("Couldn't copy — your browser blocked clipboard access.", "error");
  }
}

function downloadZip(): void {
  const zip = createZip([
    { name: "index.html", content: currentHtml },
    { name: "styles.css", content: currentCss },
  ]);
  downloadBlob(zip, "eugine-export.zip");
  showToast("Downloaded eugine-export.zip", "success");
}

export function openExportDialog(document_: EugineDocument): void {
  if (!root) root = build();

  const bodyHtml = exportDocumentToHtml(document_);
  currentHtml = buildStandaloneHtmlDocument(bodyHtml);
  currentCss = EXPORT_CSS;
  setActiveTab("html");

  lastFocused = document.activeElement as HTMLElement | null;
  root.classList.add("eb-dialog-open");
  document.body.classList.add("eb-scroll-lock");
  requestAnimationFrame(() => root!.querySelector<HTMLElement>('[data-action="close"]')?.focus());
}

function close(): void {
  if (!root) return;
  root.classList.remove("eb-dialog-open");
  document.body.classList.remove("eb-scroll-lock");
  lastFocused?.focus();
}
