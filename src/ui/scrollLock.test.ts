/**
 * @vitest-environment jsdom
 *
 * The nesting case is the whole reason this module exists.
 *
 * Sheets open on top of sheets — the movement picker opens the editor, the block sheet opens
 * the saved-workout list — and the previous implementation remembered `body.overflow` on the
 * way in and put it back on the way out. With two open, the inner one remembered the `hidden`
 * the outer one had just set and restored that, leaving the page locked on every screen until
 * the app was restarted.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { lockScroll, resetScrollLock } from './scrollLock';

const overflow = () => document.body.style.overflow;

beforeEach(() => {
  resetScrollLock();
  document.body.style.overflow = '';
});

describe('one sheet', () => {
  it('locks the page while open', () => {
    lockScroll();
    expect(overflow()).toBe('hidden');
  });

  it('unlocks it on close', () => {
    lockScroll()();
    expect(overflow()).toBe('');
  });

  it('puts back whatever was there before it opened', () => {
    document.body.style.overflow = 'scroll';
    lockScroll()();
    expect(overflow()).toBe('scroll');
  });
});

describe('sheets on top of sheets', () => {
  it('stays locked while the inner one closes', () => {
    const outer = lockScroll();
    const inner = lockScroll();

    inner();
    expect(overflow()).toBe('hidden');

    outer();
    expect(overflow()).toBe('');
  });

  /* The bug as reported: add a movement from the picker, then nothing scrolls anywhere. */
  it('does not leave the page locked after both have closed', () => {
    const picker = lockScroll();
    const editor = lockScroll();

    editor();
    picker();

    expect(overflow()).toBe('');
  });

  it('unlocks only when the last one closes, whatever the order', () => {
    const a = lockScroll();
    const b = lockScroll();
    const c = lockScroll();

    b();
    c();
    expect(overflow()).toBe('hidden');

    a();
    expect(overflow()).toBe('');
  });
});

describe('releasing twice', () => {
  /*
   * React runs effect cleanups twice under StrictMode. Counting a second release from the
   * same holder would unlock the page with a sheet still on screen.
   */
  it('ignores a repeated release from the same holder', () => {
    const outer = lockScroll();
    const inner = lockScroll();

    inner();
    inner();

    expect(overflow()).toBe('hidden');
    outer();
    expect(overflow()).toBe('');
  });
});
