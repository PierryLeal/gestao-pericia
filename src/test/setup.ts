import '@testing-library/jest-dom/vitest';

// Polyfill ResizeObserver for jsdom environment (used by cmdk)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Polyfill scrollIntoView for jsdom environment (used by cmdk)
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom never computes real layout, so offsetWidth/offsetHeight are always 0.
// @tanstack/react-virtual reads these to measure its scroll container on
// mount — with a 0-height viewport it believes nothing is visible and
// renders no rows at all. A fixed non-zero size is plenty for tests, which
// only ever render a handful of rows well under this height.
Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 1000 });
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 1000 });
