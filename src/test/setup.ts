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
