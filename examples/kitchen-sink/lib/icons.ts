/**
 * Small inline-SVG icon set (no icon-library dependency). 24x24 viewBox,
 * stroke-based, currentColor. Mirrors apps/playground/src/icons.ts so the
 * two apps' chrome (theme toggle, design-panel group headings) looks
 * consistent — kept as a separate copy rather than a shared package since
 * neither app depends on the other (see CLAUDE.md's package graph).
 */
const ICONS: Record<string, string> = {
  undo: '<polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>',
  redo: '<polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>',
  sun: '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>',
  code: '<polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline>',
  // Design-panel group headings (renderDesignSection in panels.ts).
  layout: '<rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="9" x2="9" y2="21"></line>',
  droplet: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>',
  type: '<polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line>',
  square: '<rect x="3" y="3" width="18" height="18" rx="2"></rect>',
  maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3"></path><path d="M21 8V5a2 2 0 0 0-2-2h-3"></path><path d="M3 16v3a2 2 0 0 0 2 2h3"></path><path d="M16 21h3a2 2 0 0 0 2-2v-3"></path>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>',
  play: '<polygon points="5 3 19 12 5 21 5 3"></polygon>',
  chevron: '<polyline points="9 18 15 12 9 6"></polyline>',
  resize:
    '<polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>',
  // Event log toggle button (Studio.tsx toolbar).
  terminal: '<polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>',
  // Design-panel Display toggle (keyed "display-<value>"), shapes after Lucide's
  // rows-2 / columns-3 / layout-grid and Feather's eye-off.
  "display-block": '<rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="12" x2="21" y2="12"></line>',
  "display-flex": '<rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line>',
  "display-grid": '<rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect>',
  "display-inline-block": '<rect x="7" y="7" width="10" height="10" rx="1"></rect><line x1="1" y1="12" x2="4" y2="12"></line><line x1="20" y1="12" x2="23" y2="12"></line>',
  "display-none": '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>',
  // Text align toggle — Feather's align-left/center/right/justify.
  "text-align-left": '<line x1="17" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="17" y1="18" x2="3" y2="18"></line>',
  "text-align-center": '<line x1="18" y1="10" x2="6" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="18" y1="18" x2="6" y2="18"></line>',
  "text-align-right": '<line x1="21" y1="10" x2="7" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="21" y1="18" x2="7" y2="18"></line>',
  "text-align-justify": '<line x1="21" y1="10" x2="3" y2="10"></line><line x1="21" y1="6" x2="3" y2="6"></line><line x1="21" y1="14" x2="3" y2="14"></line><line x1="21" y1="18" x2="3" y2="18"></line>',
  // Font weight toggle — a "B" drawn at each weight, so the buttons preview it.
  "font-weight-400": '<text x="12" y="18" text-anchor="middle" font-size="18" font-weight="400" fill="currentColor" stroke="none">B</text>',
  "font-weight-500": '<text x="12" y="18" text-anchor="middle" font-size="18" font-weight="500" fill="currentColor" stroke="none">B</text>',
  "font-weight-600": '<text x="12" y="18" text-anchor="middle" font-size="18" font-weight="600" fill="currentColor" stroke="none">B</text>',
  "font-weight-700": '<text x="12" y="18" text-anchor="middle" font-size="18" font-weight="700" fill="currentColor" stroke="none">B</text>',
  // Border style toggle — a line drawn in each style; "none" is Feather's slash.
  "border-style-none": '<circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>',
  "border-style-solid": '<line x1="3" y1="12" x2="21" y2="12" stroke-linecap="butt"></line>',
  "border-style-dashed": '<line x1="3" y1="12" x2="21" y2="12" stroke-linecap="butt" stroke-dasharray="4 3"></line>',
  "border-style-dotted": '<line x1="4" y1="12" x2="20" y2="12" stroke-dasharray="0 4"></line>',
  // Object fit toggle — a landscape frame holding a square "image", shown
  // stretched (fill), fitted (contain), overflowing top/bottom (cover), or at
  // natural size (none; scale-down adds inward arrows).
  "object-fit-fill": '<rect x="2" y="5" width="20" height="14" rx="2"></rect><rect x="5" y="8" width="14" height="8" rx="1"></rect>',
  "object-fit-contain": '<rect x="2" y="5" width="20" height="14" rx="2"></rect><rect x="8" y="8" width="8" height="8" rx="1"></rect>',
  "object-fit-cover": '<rect x="2" y="5" width="20" height="14" rx="2"></rect><rect x="6" y="2" width="12" height="20" rx="1"></rect>',
  "object-fit-none": '<rect x="2" y="5" width="20" height="14" rx="2"></rect><rect x="10" y="10" width="4" height="4" rx="0.5"></rect>',
  "object-fit-scale-down": '<rect x="2" y="5" width="20" height="14" rx="2"></rect><rect x="10" y="10" width="4" height="4" rx="0.5"></rect><polyline points="5 10 7 12 5 14"></polyline><polyline points="19 10 17 12 19 14"></polyline>',
  // Layout toggles. Direction: Feather arrows. Justify/Align: two filled
  // items between the container's edges (left/right walls for the main axis,
  // top/bottom for the cross axis), drawn for a row — not rotated for column.
  "flex-direction-row": '<line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline>',
  "flex-direction-column": '<line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline>',
  "flex-direction-row-reverse": '<line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline>',
  "flex-direction-column-reverse": '<line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline>',
  "justify-content-flex-start": '<line x1="2" y1="3" x2="2" y2="21"></line><line x1="22" y1="3" x2="22" y2="21"></line><rect x="4" y="6" width="3" height="12" rx="1" fill="currentColor" stroke="none"></rect><rect x="9" y="6" width="3" height="12" rx="1" fill="currentColor" stroke="none"></rect>',
  "justify-content-center": '<line x1="2" y1="3" x2="2" y2="21"></line><line x1="22" y1="3" x2="22" y2="21"></line><rect x="8" y="6" width="3" height="12" rx="1" fill="currentColor" stroke="none"></rect><rect x="13" y="6" width="3" height="12" rx="1" fill="currentColor" stroke="none"></rect>',
  "justify-content-flex-end": '<line x1="2" y1="3" x2="2" y2="21"></line><line x1="22" y1="3" x2="22" y2="21"></line><rect x="12" y="6" width="3" height="12" rx="1" fill="currentColor" stroke="none"></rect><rect x="17" y="6" width="3" height="12" rx="1" fill="currentColor" stroke="none"></rect>',
  "justify-content-space-between": '<line x1="2" y1="3" x2="2" y2="21"></line><line x1="22" y1="3" x2="22" y2="21"></line><rect x="4" y="6" width="3" height="12" rx="1" fill="currentColor" stroke="none"></rect><rect x="17" y="6" width="3" height="12" rx="1" fill="currentColor" stroke="none"></rect>',
  "justify-content-space-around": '<line x1="2" y1="3" x2="2" y2="21"></line><line x1="22" y1="3" x2="22" y2="21"></line><rect x="6.5" y="6" width="3" height="12" rx="1" fill="currentColor" stroke="none"></rect><rect x="14.5" y="6" width="3" height="12" rx="1" fill="currentColor" stroke="none"></rect>',
  "justify-content-space-evenly": '<line x1="2" y1="3" x2="2" y2="21"></line><line x1="22" y1="3" x2="22" y2="21"></line><rect x="7.33" y="6" width="3" height="12" rx="1" fill="currentColor" stroke="none"></rect><rect x="13.67" y="6" width="3" height="12" rx="1" fill="currentColor" stroke="none"></rect>',
  "align-items-stretch": '<line x1="3" y1="2" x2="21" y2="2"></line><line x1="3" y1="22" x2="21" y2="22"></line><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"></rect><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"></rect>',
  "align-items-flex-start": '<line x1="3" y1="2" x2="21" y2="2"></line><line x1="3" y1="22" x2="21" y2="22"></line><rect x="6" y="4" width="4" height="10" rx="1" fill="currentColor" stroke="none"></rect><rect x="14" y="4" width="4" height="6" rx="1" fill="currentColor" stroke="none"></rect>',
  "align-items-center": '<line x1="3" y1="2" x2="21" y2="2"></line><line x1="3" y1="22" x2="21" y2="22"></line><rect x="6" y="7" width="4" height="10" rx="1" fill="currentColor" stroke="none"></rect><rect x="14" y="9" width="4" height="6" rx="1" fill="currentColor" stroke="none"></rect>',
  "align-items-flex-end": '<line x1="3" y1="2" x2="21" y2="2"></line><line x1="3" y1="22" x2="21" y2="22"></line><rect x="6" y="10" width="4" height="10" rx="1" fill="currentColor" stroke="none"></rect><rect x="14" y="14" width="4" height="6" rx="1" fill="currentColor" stroke="none"></rect>',
  "align-items-baseline": '<line x1="3" y1="2" x2="21" y2="2"></line><line x1="3" y1="22" x2="21" y2="22"></line><rect x="6" y="4" width="4" height="8" rx="1" fill="currentColor" stroke="none"></rect><rect x="14" y="8" width="4" height="4" rx="1" fill="currentColor" stroke="none"></rect><line x1="3" y1="16" x2="21" y2="16" stroke-dasharray="2 2"></line>',
};

export function icon(name: keyof typeof ICONS, className = "ks-icon"): string {
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] ?? ""}</svg>`;
}
