let container: HTMLElement | null = null;

function getContainer(): HTMLElement {
  if (container) return container;
  container = document.createElement("div");
  container.className = "eb-toast-stack";
  container.setAttribute("role", "status");
  container.setAttribute("aria-live", "polite");
  document.body.appendChild(container);
  return container;
}

export type ToastTone = "default" | "success" | "error";

export function showToast(message: string, tone: ToastTone = "default", durationMs = 2600): void {
  const stack = getContainer();
  const toast = document.createElement("div");
  toast.className = `eb-toast eb-toast-${tone}`;
  toast.textContent = message;
  stack.appendChild(toast);

  // Force layout so the enter transition actually plays.
  requestAnimationFrame(() => toast.classList.add("eb-toast-visible"));

  const dismiss = () => {
    toast.classList.remove("eb-toast-visible");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  };
  setTimeout(dismiss, durationMs);
}
