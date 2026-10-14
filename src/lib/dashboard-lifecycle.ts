/** Mount one dashboard controller per routed document root and dispose it before Astro swaps. */
export function bindDashboardLifecycle(
  documentRef: Document,
  selector: string,
  setup: (root: Element, signal: AbortSignal, isCurrent: () => boolean) => void | (() => void),
): () => void {
  let root: Element | null = null;
  let controller: AbortController | null = null;
  let dispose: void | (() => void);

  const teardown = () => {
    controller?.abort();
    controller = null;
    dispose?.();
    dispose = undefined;
    root = null;
  };
  const initialize = () => {
    const next = documentRef.querySelector(selector);
    if (!next || next === root) return;
    teardown();
    root = next;
    controller = new AbortController();
    const signal = controller.signal;
    const isCurrent = () => !signal.aborted && documentRef.querySelector(selector) === next;
    dispose = setup(next, signal, isCurrent);
  };

  documentRef.addEventListener('astro:before-swap', teardown);
  documentRef.addEventListener('astro:page-load', initialize);
  initialize();
  return () => {
    documentRef.removeEventListener('astro:before-swap', teardown);
    documentRef.removeEventListener('astro:page-load', initialize);
    teardown();
  };
}
