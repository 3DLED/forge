/**
 * @vitest-environment jsdom
 *
 * The native path, which is the whole reason this module exists and the one nobody can check
 * by using the app on a laptop.
 *
 * What is being defended is narrow and specific: that a save which did not happen is never
 * reported as one. The original bug was not a crash, it was a cheerful filename returned by a
 * function that had written nothing, and the only way that comes back is if someone collapses
 * these three outcomes into a boolean again.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const isNative = vi.fn(() => false);
const writeFile = vi.fn(async () => ({ uri: 'file:///cache/forge.json' }));
const share = vi.fn(async () => ({}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => isNative() },
}));
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile: (...args: unknown[]) => writeFile(...(args as [])) },
  Directory: { Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
}));
vi.mock('@capacitor/share', () => ({
  Share: { share: (...args: unknown[]) => share(...(args as [])) },
}));

const { saveTextFile } = await import('./fileSave');

beforeEach(() => {
  isNative.mockReturnValue(false);
  writeFile.mockClear();
  share.mockClear();
  writeFile.mockResolvedValue({ uri: 'file:///cache/forge.json' });
  share.mockResolvedValue({});
});

describe('on a phone', () => {
  beforeEach(() => isNative.mockReturnValue(true));

  it('writes the file and offers it to the share sheet', async () => {
    const result = await saveTextFile('forge-backup-2026-09-12.json', '{"a":1}');

    expect(writeFile).toHaveBeenCalledWith({
      path: 'forge-backup-2026-09-12.json',
      data: '{"a":1}',
      directory: 'CACHE',
      encoding: 'utf8',
    });
    expect(share).toHaveBeenCalledWith({
      title: 'forge-backup-2026-09-12.json',
      files: ['file:///cache/forge.json'],
    });
    expect(result).toEqual({ outcome: 'saved', filename: 'forge-backup-2026-09-12.json' });
  });

  /*
   * Changing your mind is not a failure. Reported as one, the app complains every time
   * somebody backs out of a share sheet, and messages that cry wolf stop being read.
   */
  it('calls a dismissed share sheet cancelled, not failed', async () => {
    share.mockRejectedValue(new Error('Share canceled'));
    const result = await saveTextFile('forge.json', '{}');
    expect(result.outcome).toBe('cancelled');
    expect(result.reason).toBeUndefined();
  });

  it('reports a real failure with something worth reading', async () => {
    writeFile.mockRejectedValue(new Error('Disk is full'));
    const result = await saveTextFile('forge.json', '{}');
    expect(result).toEqual({ outcome: 'failed', filename: 'forge.json', reason: 'Disk is full' });
    expect(share).not.toHaveBeenCalled();
  });

  it('never claims a save when the sheet was never reached', async () => {
    writeFile.mockRejectedValue(new Error('nope'));
    expect((await saveTextFile('forge.json', '{}')).outcome).not.toBe('saved');
  });
});

describe('in a browser', () => {
  it('downloads through an anchor and touches no plugin', async () => {
    const clicks: HTMLAnchorElement[] = [];
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
      clicks.push(this);
    };
    // jsdom implements neither of these, and the anchor path is built on both.
    URL.createObjectURL = vi.fn(() => 'blob:forge');
    URL.revokeObjectURL = vi.fn();

    const result = await saveTextFile('forge-plan-ocr.json', '{}');

    expect(clicks[0]?.download).toBe('forge-plan-ocr.json');
    expect(clicks[0]?.href).toBe('blob:forge');
    expect(writeFile).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
    expect(result).toEqual({ outcome: 'saved', filename: 'forge-plan-ocr.json' });

    HTMLAnchorElement.prototype.click = realClick;
  });
});
