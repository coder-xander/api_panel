/**
 * iconmap.test.js — Tests for IconMap.js
 *
 * Loads the source via fs + new Function (same pattern as other tests)
 * and verifies PLATFORM_ICONS mapping and getPlatformIcon behavior.
 */
import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');

function loadIconMap() {
  const src = fs.readFileSync(path.join(ROOT, 'src/components/IconMap.js'), 'utf-8');
  let PLATFORM_ICONS;
  let getPlatformIcon;
  const fn = new Function(`
    ${src};
    return { PLATFORM_ICONS, getPlatformIcon };
  `);
  const result = fn();
  PLATFORM_ICONS = result.PLATFORM_ICONS;
  getPlatformIcon = result.getPlatformIcon;
  return { PLATFORM_ICONS, getPlatformIcon };
}

describe('IconMap', () => {
  let ICONS, getIcon;
  beforeEach(() => {
    const loaded = loadIconMap();
    ICONS = loaded.PLATFORM_ICONS;
    getIcon = loaded.getPlatformIcon;
  });

  describe('PLATFORM_ICONS', () => {
    it('has 14 platform entries', () => {
      expect(Object.keys(ICONS)).toHaveLength(14);
    });

    it('contains deepseek mapping', () => {
      expect(ICONS.deepseek).toBe('assets/icons/deepseek.svg');
    });

    it('contains kimi mapping', () => {
      expect(ICONS.kimi).toBe('assets/icons/kimi.svg');
    });

    it('contains lumai mapping', () => {
      expect(ICONS.lumai).toBe('assets/icons/lumai.svg');
    });

    it('contains openrouter mapping', () => {
      expect(ICONS.openrouter).toBe('assets/icons/openrouter.svg');
    });

    it('contains openai mapping', () => {
      expect(ICONS.openai).toBe('assets/icons/openai.svg');
    });

    it('all values are SVG paths under assets/icons/', () => {
      Object.values(ICONS).forEach((val) => {
        expect(val).toMatch(/^assets\/icons\/.*\.svg$/);
      });
    });

    it('all keys are lowercase alphanumeric', () => {
      Object.keys(ICONS).forEach((key) => {
        expect(key).toMatch(/^[a-z0-9]+$/);
      });
    });
  });

  describe('getPlatformIcon', () => {
    it('returns correct icon for plain type ID', () => {
      expect(getIcon('deepseek')).toBe('assets/icons/deepseek.svg');
    });

    it('returns correct icon for instance ID with #', () => {
      expect(getIcon('deepseek#1')).toBe('assets/icons/deepseek.svg');
    });

    it('returns correct icon for instance ID with high number', () => {
      expect(getIcon('kimi#99')).toBe('assets/icons/kimi.svg');
    });

    it('returns null for unknown platform type', () => {
      expect(getIcon('unknown_platform')).toBeNull();
    });

    it('returns null for unknown instance ID', () => {
      expect(getIcon('nonexistent#1')).toBeNull();
    });

    it('handles type with special chars before #', () => {
      expect(getIcon('openai#3')).toBe('assets/icons/openai.svg');
    });

    it('handles all defined platforms with instance suffix', () => {
      const types = Object.keys(ICONS);
      types.forEach((type) => {
        expect(getIcon(`${type}#1`)).toBe(ICONS[type]);
      });
    });
  });
});
