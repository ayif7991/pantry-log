import { beforeEach, describe, expect, it } from 'vitest';
import { byId, h, svg } from './dom';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('byId', () => {
  it('returns the element with the given id', () => {
    document.body.innerHTML = '<div id="thing"></div>';
    expect(byId('thing')).toBe(document.getElementById('thing'));
  });

  it('throws a descriptive error when the id is missing', () => {
    expect(() => byId('missing')).toThrow(/missing/);
  });
});

describe('h', () => {
  it('creates an element of the given tag', () => {
    const el = h('button');
    expect(el.tagName).toBe('BUTTON');
  });

  it('sets attributes', () => {
    const el = h('div', { class: 'row', 'data-id': 'abc' });
    expect(el.className).toBe('row');
    expect(el.getAttribute('data-id')).toBe('abc');
  });

  it('appends string children as text nodes', () => {
    const el = h('span', {}, ['hello']);
    expect(el.textContent).toBe('hello');
    expect(el.childNodes[0]?.nodeType).toBe(Node.TEXT_NODE);
  });

  it('appends node children as-is', () => {
    const child = h('em', {}, ['inner']);
    const el = h('div', {}, [child]);
    expect(el.firstElementChild).toBe(child);
  });

  it('mixes string and node children in order', () => {
    const child = h('b', {}, ['bold']);
    const el = h('div', {}, ['before ', child, ' after']);
    expect(el.textContent).toBe('before bold after');
  });

  it('defaults to no attributes and no children', () => {
    const el = h('div');
    expect(el.attributes.length).toBe(0);
    expect(el.childNodes.length).toBe(0);
  });
});

describe('svg', () => {
  it('parses trusted SVG markup into an element', () => {
    const el = svg('<svg viewBox="0 0 24 24"><circle cx="1" cy="1" r="1"/></svg>');
    expect(el).toBeInstanceOf(SVGElement);
    expect(el.tagName).toBe('svg');
  });

  it('trims surrounding whitespace before parsing', () => {
    const el = svg('\n  <svg></svg>\n  ');
    expect(el.tagName).toBe('svg');
  });

  it('throws when the markup is not an SVG element', () => {
    expect(() => svg('<div>not svg</div>')).toThrow(/svg/i);
  });
});
