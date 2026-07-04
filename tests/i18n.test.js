/**
 * i18n.test.js — I18N module logic
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

function loadI18N() {
  const src = fs.readFileSync(path.join(ROOT, 'src/i18n.js'), 'utf-8');
  globalThis.window = globalThis.window || { dispatchEvent: vi.fn() };
  let I18N;

  const fn = new Function('window', `
    ${src};
    return I18N;
  `);
  I18N = fn(globalThis.window);
  globalThis.I18N = I18N;
  return I18N;
}

describe('I18N', () => {
  let I18N;
  beforeEach(() => {
    globalThis.window = { dispatchEvent: vi.fn() };
    I18N = loadI18N();
  });

  it('default locale is "en"', () => {
    expect(I18N.getLocale()).toBe('en');
  });

  it('en translation works', () => {
    const s = I18N.t('card.justNow');
    expect(s).toBe('Just now');
  });

  it('zh-CN translation works after switch', () => {
    I18N.setLocale('zh-CN');
    const s = I18N.t('card.justNow');
    expect(s).toBe('刚刚');
  });

  it('params interpolation {n}', () => {
    const s = I18N.t('card.secondsAgo', { n: 30 });
    expect(s).toBe('30s ago');
  });

  it('params interpolation {date}', () => {
    I18N.setLocale('zh-CN');
    const s = I18N.t('card.recentUsage', { date: '2026-07-04' });
    expect(s).toBe('最近用量 (2026-07-04)');
  });

  it('missing key → fallback to key string', () => {
    expect(I18N.t('nonexistent_key_xyz')).toBe('nonexistent_key_xyz');
  });

  it('unknown locale → falls back to en', () => {
    I18N.setLocale('xx-YY');
    expect(I18N.t('card.justNow')).toBe('Just now');
  });

  it('missing params → keep placeholder as literal', () => {
    expect(I18N.t('card.secondsAgo', {})).toBe('{n}s ago');
  });

  it('extra params → not a problem', () => {
    expect(I18N.t('card.justNow', { foo: 'bar' })).toBe('Just now');
  });

  it('dispatches locale change event', () => {
    I18N.setLocale('zh-CN');
    expect(globalThis.window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'i18n:locale-changed' })
    );
  });

  it('locale persists after setLocale', () => {
    I18N.setLocale('zh-CN');
    expect(I18N.getLocale()).toBe('zh-CN');
  });

  it('all en keys have zh-CN translations (no orphaned keys)', () => {
    const enKeys = Object.keys(I18N.translations.en);
    const zhKeys = Object.keys(I18N.translations['zh-CN']);
    const missingInZh = enKeys.filter((k) => !zhKeys.includes(k));
    expect(missingInZh).toEqual([]);
  });

  it('all zh-CN keys have en translations (no orphaned keys)', () => {
    const enKeys = Object.keys(I18N.translations.en);
    const zhKeys = Object.keys(I18N.translations['zh-CN']);
    const missingInEn = zhKeys.filter((k) => !enKeys.includes(k));
    expect(missingInEn).toEqual([]);
  });

  it('both locales have exactly the same number of keys', () => {
    const enCount = Object.keys(I18N.translations.en).length;
    const zhCount = Object.keys(I18N.translations['zh-CN']).length;
    expect(enCount).toBe(zhCount);
  });
});
