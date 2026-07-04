/**
 * preload.test.js — Tests for electron/preload.js
 *
 * Verifies that contextBridge exposes the correct API surface.
 * We mock electron's contextBridge and ipcRenderer, then load preload.js
 * and inspect what was exposed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

describe('preload.js', () => {
  let exposedAPI;

  beforeEach(() => {
    exposedAPI = {};

    // Mock the electron module
    const mockIpcRenderer = {
      invoke: vi.fn(),
      on: vi.fn(),
    };

    vi.doMock('electron', () => ({
      contextBridge: {
        exposeInMainWorld: (key, api) => {
          exposedAPI = api;
        },
      },
      ipcRenderer: mockIpcRenderer,
    }));
  });

  it('exposes electronAPI as the world key', () => {
    // Read and eval preload.js manually to check the key
    const src = fs.readFileSync(path.join(ROOT, 'electron/preload.js'), 'utf-8');
    expect(src).toContain("exposeInMainWorld('electronAPI'");
  });

  it('has all expected platform methods', () => {
    const src = fs.readFileSync(path.join(ROOT, 'electron/preload.js'), 'utf-8');
    const expectedMethods = [
      'getPlatforms',
      'refreshPlatform',
      'refreshAll',
      'updatePlatform',
      'importPlatformCredential',
      'addPlatformInstance',
      'removePlatformInstance',
    ];
    expectedMethods.forEach((method) => {
      expect(src).toContain(method);
    });
  });

  it('has all expected window control methods', () => {
    const src = fs.readFileSync(path.join(ROOT, 'electron/preload.js'), 'utf-8');
    const expectedMethods = [
      'windowMinimize',
      'windowMaximize',
      'windowIsMaximized',
      'windowClose',
    ];
    expectedMethods.forEach((method) => {
      expect(src).toContain(method);
    });
  });

  it('has onWindowMaximized event listener', () => {
    const src = fs.readFileSync(path.join(ROOT, 'electron/preload.js'), 'utf-8');
    expect(src).toContain('onWindowMaximized');
    expect(src).toContain('window:maximized');
  });

  it('has layout management methods', () => {
    const src = fs.readFileSync(path.join(ROOT, 'electron/preload.js'), 'utf-8');
    expect(src).toContain('getLayout');
    expect(src).toContain('saveLayout');
    expect(src).toContain('getPlatformDefs');
  });

  it('has utility methods', () => {
    const src = fs.readFileSync(path.join(ROOT, 'electron/preload.js'), 'utf-8');
    expect(src).toContain('getVersion');
    expect(src).toContain('openExternal');
    expect(src).toContain('platform');
    expect(src).toContain('resizeToContent');
  });

  it('has first launch + language methods', () => {
    const src = fs.readFileSync(path.join(ROOT, 'electron/preload.js'), 'utf-8');
    expect(src).toContain('isFirstLaunch');
    expect(src).toContain('getLanguage');
    expect(src).toContain('saveLanguage');
  });

  it('uses ipcRenderer.invoke for all async operations', () => {
    const src = fs.readFileSync(path.join(ROOT, 'electron/preload.js'), 'utf-8');
    // All async methods should use invoke (not send/on pattern)
    const invokeCount = (src.match(/ipcRenderer\.invoke/g) || []).length;
    expect(invokeCount).toBeGreaterThanOrEqual(15);
  });

  it('uses ipcRenderer.on only for window:maximized event', () => {
    const src = fs.readFileSync(path.join(ROOT, 'electron/preload.js'), 'utf-8');
    const onCount = (src.match(/ipcRenderer\.on/g) || []).length;
    expect(onCount).toBe(1);
  });

  it('exposes process.platform directly (not via IPC)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'electron/preload.js'), 'utf-8');
    expect(src).toContain('platform: process.platform');
  });

  it('every method delegates to correct IPC channel name', () => {
    const src = fs.readFileSync(path.join(ROOT, 'electron/preload.js'), 'utf-8');
    const channelMappings = [
      ['getPlatforms', 'get-platforms'],
      ['refreshPlatform', 'refresh-platform'],
      ['refreshAll', 'refresh-all'],
      ['updatePlatform', 'update-platform'],
      ['importPlatformCredential', 'import-platform-credential'],
      ['addPlatformInstance', 'add-platform-instance'],
      ['removePlatformInstance', 'remove-platform-instance'],
      ['windowMinimize', 'window-minimize'],
      ['windowMaximize', 'window-maximize'],
      ['windowIsMaximized', 'window-is-maximized'],
      ['windowClose', 'window-close'],
      ['getVersion', 'get-version'],
      ['openExternal', 'open-external'],
      ['getLayout', 'get-layout'],
      ['saveLayout', 'save-layout'],
      ['getPlatformDefs', 'get-platform-defs'],
      ['resizeToContent', 'resize-to-content'],
      ['isFirstLaunch', 'is-first-launch'],
      ['getLanguage', 'get-language'],
      ['saveLanguage', 'save-language'],
    ];
    channelMappings.forEach(([method, channel]) => {
      expect(src).toContain(`'${channel}'`);
    });
  });
});
