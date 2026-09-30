import { describe, expect, it } from 'vitest';
import { actionForKey } from './keyboard';

describe('actionForKey', () => {
  it('maps the documented keys', () => {
    expect(actionForKey({ key: '1' })).toEqual({ type: 'glass', index: 0 });
    expect(actionForKey({ key: '5' })).toEqual({ type: 'glass', index: 4 });
    expect(actionForKey({ key: 'f' })).toEqual({ type: 'tool', tool: 'faucet' });
    expect(actionForKey({ key: 'S' })).toEqual({ type: 'tool', tool: 'sink' });
    expect(actionForKey({ key: 'z' })).toEqual({ type: 'undo' });
    expect(actionForKey({ key: ' ' })).toEqual({ type: 'melody' });
  });

  it('ignores other keys', () => {
    expect(actionForKey({ key: '6' })).toBeNull();
    expect(actionForKey({ key: '0' })).toBeNull();
    expect(actionForKey({ key: 'a' })).toBeNull();
    expect(actionForKey({ key: 'Enter' })).toBeNull();
  });

  it('ignores keys while typing or with a modifier held', () => {
    expect(actionForKey({ key: 'f', targetTag: 'INPUT' })).toBeNull();
    expect(actionForKey({ key: '1', targetTag: 'TEXTAREA' })).toBeNull();
    expect(actionForKey({ key: 'z', isContentEditable: true })).toBeNull();
    expect(actionForKey({ key: 'z', ctrlKey: true })).toBeNull();
    expect(actionForKey({ key: 's', metaKey: true })).toBeNull();
  });

  it('Space on a focused button does not also play the melody', () => {
    expect(actionForKey({ key: ' ', targetTag: 'BUTTON' })).toBeNull();
    expect(actionForKey({ key: ' ', targetTag: 'A' })).toBeNull();
    expect(actionForKey({ key: ' ', targetTag: 'DIV' })).toEqual({ type: 'melody' });
    // Other keys still work with a button focused.
    expect(actionForKey({ key: 'z', targetTag: 'BUTTON' })).toEqual({ type: 'undo' });
  });
});
