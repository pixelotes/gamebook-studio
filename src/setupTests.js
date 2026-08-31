// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// jsdom doesn't expose window.localStorage under this Node/jsdom combo (Node's own
// experimental global localStorage takes precedence and needs --localstorage-file
// to work), so provide a minimal in-memory polyfill instead of depending on either.
// Guarded for server.test.js / GameSession.test.js, which run in the 'node'
// environment (no `window`) and don't need this.
if (typeof window !== 'undefined' && !window.localStorage) {
  const store = new Map();
  const localStorageMock = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
    clear: () => { store.clear(); },
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
  };
  Object.defineProperty(window, 'localStorage', { value: localStorageMock, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, configurable: true });
}

// jsdom doesn't implement the Web Worker API, but src/workers/workerClient.js
// constructs one eagerly at import time — stub it out so importing App.jsx
// (transitively) doesn't throw. Nothing in a render-only smoke test actually
// dispatches worker tasks.
if (typeof window !== 'undefined' && typeof window.Worker === 'undefined') {
  class WorkerStub {
    postMessage() {}
    terminate() {}
    addEventListener() {}
    removeEventListener() {}
  }
  window.Worker = WorkerStub;
  globalThis.Worker = WorkerStub;
}
