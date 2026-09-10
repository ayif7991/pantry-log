/** Look up an element by id, throwing if it is missing or the wrong type. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`Expected an element with id "${id}"`);
  return el as T;
}

/** Create an element with attributes and children in one call. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  for (const child of children) {
    el.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}

/** Parse a trusted SVG markup string into a node (used for the static icons). */
export function svg(markup: string): SVGElement {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = markup.trim();
  const node = wrapper.firstElementChild;
  if (!(node instanceof SVGElement)) throw new Error('Expected SVG markup');
  return node;
}
