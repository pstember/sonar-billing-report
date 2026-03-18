/**
 * Vitest setup: polyfill IndexedDB for Dexie in Node/jsdom.
 * Must run before any module that imports src/services/db.ts.
 */
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
