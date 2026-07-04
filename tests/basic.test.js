/**
 * basic.test.js — Smoke test of project structure and config integrity
 */
import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';

const ROOT = path.resolve(__dirname, '..');

describe('project structure', () => {
  it('package.json is loadable', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
    expect(pkg.name).toBe('api-panel');
    expect(typeof pkg.main).toBe('string');
    expect(typeof pkg.build).toBe('object');
  });

  it('scripts has start, build, test', () => {
    const { scripts } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
    expect(scripts).toHaveProperty('start');
    expect(scripts).toHaveProperty('build');
    expect(scripts).toHaveProperty('test');
  });

  it('electron main file exists', () => {
    expect(fs.existsSync(path.join(ROOT, 'electron/main.js'))).toBe(true);
  });

  it('preload script exists', () => {
    expect(fs.existsSync(path.join(ROOT, 'electron/preload.js'))).toBe(true);
  });

  it('index.html exists with #app element', () => {
    const html = fs.readFileSync(path.join(ROOT, 'src/index.html'), 'utf-8');
    expect(html).toContain('id="app"');
  });

  it('render-side files exist', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/App.js'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'src/i18n.js'))).toBe(true);
  });

  it('component files exist', () => {
    const comps = ['PlatformCard', 'DetailSheet', 'SettingsModal', 'WelcomeWizard', 'AddCardModal'];
    comps.forEach((c) => {
      expect(fs.existsSync(path.join(ROOT, 'src/components/', c + '.js'))).toBe(true);
    });
  });

  it('CSS file exists with basic structure', () => {
    const css = fs.readFileSync(path.join(ROOT, 'src/assets/style.css'), 'utf-8');
    expect(css).toContain(':root');
  });

  it('electron-builder targets linux/win', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
    expect(pkg.build.linux).toBeDefined();
    expect(pkg.build.win).toBeDefined();
    expect(pkg.build.files).toContain('electron/**');
    expect(pkg.build.files).toContain('src/**');
  });

  it('valid semver format', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
    const re = /^\d+\.\d+\.\d+(-\w+(\.\w+)*)?$/;
    expect(re.test(pkg.version)).toBe(true);
  });

  it('all components have balanced braces', () => {
    const COMPS = ['App', 'components/PlatformCard', 'components/DetailSheet', 'components/SettingsModal', 'components/WelcomeWizard', 'components/AddCardModal'];
    COMPS.forEach((c) => {
      const content = fs.readFileSync(path.join(ROOT, 'src', c + '.js'), 'utf-8');
      const open = (content.match(/\{/g) || []).length;
      const close = (content.match(/\}/g) || []).length;
      expect(open).toBe(close);
    });
  });

  it('each component file references a template string', () => {
    const COMPS = ['components/PlatformCard', 'components/DetailSheet', 'components/SettingsModal', 'components/WelcomeWizard', 'components/AddCardModal'];
    COMPS.forEach((c) => {
      const content = fs.readFileSync(path.join(ROOT, 'src', c + '.js'), 'utf-8');
      expect(content).toContain('template:');
    });
  });
});
