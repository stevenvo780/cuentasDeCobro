import { JSDOM } from 'jsdom';
import { autoResizeTextarea, toggleExportElements, calculateRowTotal } from '../utils.js';

describe('utils', () => {
  test('calculateRowTotal returns hours * rate', () => {
    expect(calculateRowTotal(2, 10)).toBe(20);
    expect(calculateRowTotal('3', '5')).toBe(15);
    expect(calculateRowTotal('', '')).toBe(0);
  });

  test('autoResizeTextarea sets height to scrollHeight', () => {
    const dom = new JSDOM(`<textarea style="height:0">hello</textarea>`);
    const ta = dom.window.document.querySelector('textarea');
    Object.defineProperty(ta, 'scrollHeight', { value: 42, configurable: true });
    autoResizeTextarea(ta);
    expect(ta.style.height).toBe('42px');
  });

  test('toggleExportElements hides and shows elements', () => {
    const dom = new JSDOM(`<div id="app-controls"></div><button class="no-print"></button>`);
    const { document } = dom.window;
    global.document = document;

    const controls = dom.window.document.getElementById('app-controls');
    const btn = dom.window.document.querySelector('.no-print');
    controls.style.display = 'block';
    btn.style.display = 'inline';

    toggleExportElements(false);
    expect(controls.style.display).toBe('none');
    expect(btn.style.display).toBe('none');

    toggleExportElements(true);
    expect(controls.style.display).toBe('block');
    expect(btn.style.display).toBe('inline');
    delete global.document;
  });
});
