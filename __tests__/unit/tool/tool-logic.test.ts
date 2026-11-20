import { describe, it, expect } from 'vitest';
import {
  toNumeric,
  toSymbolic,
  toPlainSymbolic,
  fromNumeric,
  fromSymbolic,
  chmodCommand,
  defaultState,
  togglePermission,
  toggleSpecialBit,
  applyPreset,
  PRESETS,
  specialDigit,
  digitToPermissions,
  explainClass,
  executeBitExplanation,
} from '@/tool/chmod-logic';
import {
  chmodTool,
  setPermission,
  setSpecialBit,
  parseModeInput,
  applyPresetToState,
  serializeState,
  deserializeState,
  isChmodState,
} from '@/tool/tool-definition';
import type { ChmodState, PermissionSet, UserClass } from '@/tool/types';

const base = (): ChmodState => defaultState();

describe('numeric → symbolic conversion', () => {
  it('converts every digit 0-7 correctly per class', () => {
    const symbols: Record<number, string> = {
      0: '---',
      1: '--x',
      2: '-w-',
      3: '-wx',
      4: 'r--',
      5: 'r-x',
      6: 'rw-',
      7: 'rwx',
    };
    for (let d = 0; d <= 7; d++) {
      const state: ChmodState = {
        ...base(),
        user: digitToPermissions(d),
        group: digitToPermissions(d),
        other: digitToPermissions(d),
        setuid: false,
        setgid: false,
        sticky: false,
      };
      expect(toPlainSymbolic(state)).toBe(`${symbols[d]}${symbols[d]}${symbols[d]}`);
      expect(toNumeric(state)).toBe(`0${d}${d}${d}`);
    }
  });

  it('handles special bits 4xxx, 2xxx, 1xxx prefixes', () => {
    const setuid = { ...base(), setuid: true };
    expect(toNumeric(setuid)).toBe('4755');
    expect(toSymbolic(setuid)).toBe('rwsr-xr-x');

    const setgid = { ...base(), setgid: true };
    expect(toNumeric(setgid)).toBe('2755');
    expect(toSymbolic(setgid)).toBe('rwxr-sr-x');

    const sticky = { ...base(), sticky: true };
    expect(toNumeric(sticky)).toBe('1755');
    expect(toSymbolic(sticky)).toBe('rwxr-xr-t');
  });

  it('renders uppercase S/T when special bit set without execute', () => {
    const state: ChmodState = {
      ...base(),
      user: { read: true, write: true, execute: false },
      group: { read: true, write: false, execute: false },
      other: { read: true, write: false, execute: false },
      setuid: true,
    };
    expect(toSymbolic(state)).toBe('rwSr--r--');
    const stickyNoX: ChmodState = {
      ...base(),
      other: { read: true, write: false, execute: false },
      sticky: true,
    };
    expect(toSymbolic(stickyNoX)).toBe('rwxr-xr-T');
  });

  it('combines special bits (7 = setuid+setgid+sticky)', () => {
    const state = { ...base(), setuid: true, setgid: true, sticky: true };
    expect(specialDigit(state)).toBe(7);
    expect(toNumeric(state)).toBe('7755');
  });
});

describe('numeric → symbolic → numeric round-trip', () => {
  const modes = ['000', '111', '400', '444', '600', '644', '700', '751', '755', '777'];
  for (const mode of modes) {
    it(`round-trips ${mode}`, () => {
      const state = fromNumeric(mode);
      expect(state).not.toBeNull();
      if (!state) return;
      const rebuilt = fromSymbolic(toSymbolic(state));
      expect(rebuilt).not.toBeNull();
      if (!rebuilt) return;
      expect(toNumeric(rebuilt).slice(1)).toBe(mode);
    });
  }

  for (const special of ['4', '2', '1', '7']) {
    const mode = `${special}755`;
    it(`round-trips ${mode} including special bits`, () => {
      const state = fromNumeric(mode);
      expect(state).not.toBeNull();
      if (!state) return;
      const state2 = fromSymbolic(toSymbolic(state));
      expect(state2).not.toBeNull();
      if (!state2) return;
      // The essential check: numeric output matches original mode.
      expect(toNumeric(state2)).toBe(mode);
    });
  }
});

describe('checkbox toggles', () => {
  it('toggling user write changes numeric output immediately', () => {
    let state = base(); // 755
    expect(toNumeric(state)).toBe('0755');
    state = togglePermission(state, 'user', 'write');
    expect(toNumeric(state)).toBe('0555');
    expect(toPlainSymbolic(state)).toBe('r-xr-xr-x');
  });

  it('toggles every edge 000 and 777', () => {
    let state: ChmodState = {
      ...base(),
      user: { read: false, write: false, execute: false },
      group: { read: false, write: false, execute: false },
      other: { read: false, write: false, execute: false },
    };
    expect(toNumeric(state)).toBe('0000');
    const classes: UserClass[] = ['user', 'group', 'other'];
    for (const cls of classes) {
      state = togglePermission(state, cls, 'read');
    }
    expect(toNumeric(state)).toBe('0444');
    let all: ChmodState = {
      ...base(),
      user: { read: true, write: true, execute: true },
      group: { read: true, write: true, execute: true },
      other: { read: true, write: true, execute: true },
    };
    expect(toNumeric(all)).toBe('0777');
    all = togglePermission(all, 'group', 'read');
    expect(toNumeric(all)).toBe('0737');
  });

  it('toggling special bits updates numeric prefix', () => {
    let state = base();
    state = toggleSpecialBit(state, 'setuid');
    expect(toNumeric(state)).toBe('4755');
    state = toggleSpecialBit(state, 'setgid');
    expect(toNumeric(state)).toBe('6755');
    state = toggleSpecialBit(state, 'sticky');
    expect(toNumeric(state)).toBe('7755');
    state = toggleSpecialBit(state, 'setuid');
    expect(toNumeric(state)).toBe('3755');
  });

  it('setPermission and setSpecialBit wrappers behave the same', () => {
    const state = setPermission(base(), 'other', 'read');
    expect(state.other.read).toBe(false);
    const state2 = setSpecialBit(base(), 'sticky');
    expect(state2.sticky).toBe(true);
  });
});

describe('presets', () => {
  const expectations: Record<string, string> = {
    '755': '0755',
    '644': '0644',
    '600': '0600',
    '777': '0777',
    '1777': '1777',
  };
  it.each(Object.keys(expectations))('applies preset %s correctly', (id) => {
    const state = applyPreset(base(), id);
    expect(state).not.toBeNull();
    if (!state) return;
    expect(toNumeric(state)).toBe(expectations[id]);
  });

  it('returns null for unknown preset', () => {
    expect(applyPreset(base(), '999')).toBeNull();
  });

  it('validates preset ids', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(4);
  });

  it('applyPresetToState wrapper works', () => {
    const state = applyPresetToState(base(), '644');
    expect(state).not.toBeNull();
    if (state) expect(toNumeric(state)).toBe('0644');
  });
});

describe('parse mode input', () => {
  it('accepts numeric 3-digit and 4-digit modes', () => {
    const a = parseModeInput(base(), '640');
    expect(a.ok).toBe(true);
    expect(toNumeric(a.state)).toBe('0640');
    const b = parseModeInput(base(), '2750');
    expect(b.ok).toBe(true);
    expect(toNumeric(b.state)).toBe('2750');
  });

  it('accepts symbolic input', () => {
    const a = parseModeInput(base(), 'rwxr-x---');
    expect(a.ok).toBe(true);
    expect(toNumeric(a.state)).toBe('0750');
  });

  it('returns original state and ok=false for invalid input', () => {
    const original = base();
    const a = parseModeInput(original, '999');
    expect(a.ok).toBe(false);
    expect(a.state).toBe(original);
    const b = parseModeInput(original, 'not a mode');
    expect(b.ok).toBe(false);
    const c = parseModeInput(original, '');
    expect(c.ok).toBe(false);
  });
});

describe('serialize / deserialize', () => {
  it('round-trips state through serializeState/deserializeState', () => {
    const state: ChmodState = {
      ...base(),
      setuid: true,
      filename: 'run.sh',
      filenameType: 'file',
    };
    const json = serializeState(state);
    const result = deserializeState(JSON.parse(json));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(state);
    }
  });

  it('rejects invalid payloads', () => {
    expect(deserializeState(null).success).toBe(false);
    expect(deserializeState('string').success).toBe(false);
    expect(deserializeState({}).success).toBe(false);
    expect(deserializeState({ user: { read: true } }).success).toBe(false);
    const badType = { ...base(), filenameType: 'symlink' };
    expect(deserializeState(badType).success).toBe(false);
    const badPerm = { ...base(), user: { read: 'yes', write: true, execute: true } };
    expect(deserializeState(badPerm).success).toBe(false);
  });

  it('isChmodState guards correctly', () => {
    expect(isChmodState(base())).toBe(true);
    expect(isChmodState(null)).toBe(false);
    expect(isChmodState({})).toBe(false);
  });
});

describe('fromNumeric validation', () => {
  it('parses leading-zero 4-digit as special 0', () => {
    const state = fromNumeric('0755');
    expect(state?.setuid).toBe(false);
    expect(toNumeric(state!)).toBe('0755');
  });

  it('rejects non-octal and malformed input', () => {
    expect(fromNumeric('999')).toBeNull();
    expect(fromNumeric('8')).toBeNull();
    expect(fromNumeric('75')).toBeNull();
    expect(fromNumeric('')).toBeNull();
    expect(fromNumeric('abc')).toBeNull();
    expect(fromNumeric('75555')).toBeNull();
  });

  it('parses all digits 0-7 in each position', () => {
    for (let u = 0; u <= 7; u++) {
      for (let g = 0; g <= 7; g++) {
        for (let o = 0; o <= 7; o++) {
          const mode = `${u}${g}${o}`;
          const state = fromNumeric(mode);
          expect(state).not.toBeNull();
          if (!state) continue;
          expect(toNumeric(state)).toBe(`0${mode}`);
        }
      }
    }
  });
});

describe('fromSymbolic validation', () => {
  it('accepts standard 9-char symbolic', () => {
    expect(fromSymbolic('rw-r--r--')?.user).toEqual({ read: true, write: true, execute: false });
    expect(fromSymbolic('rwxrwxrwx')?.other).toEqual({ read: true, write: true, execute: true });
  });

  it('detects special chars s/S/t/T', () => {
    const s = fromSymbolic('rwsr-sr-t');
    expect(s?.setuid).toBe(true);
    expect(s?.setgid).toBe(true);
    expect(s?.sticky).toBe(true);
    const upper = fromSymbolic('rwSr--r-T');
    expect(upper?.setuid).toBe(true);
    expect(upper?.sticky).toBe(true);
    expect(upper?.user.execute).toBe(false);
    expect(upper?.other.execute).toBe(false);
  });

  it('rejects malformed symbolic', () => {
    expect(fromSymbolic('rwxr-x')).toBeNull();
    expect(fromSymbolic('rwzr-xr-x')).toBeNull();
    expect(fromSymbolic('')).toBeNull();
  });
});

describe('chmod command output', () => {
  it('uses 3-digit numeric when no special bits set', () => {
    expect(chmodCommand({ ...base(), filename: 'file.txt' })).toBe('chmod 755 file.txt');
  });

  it('uses 4-digit numeric with special bits', () => {
    expect(chmodCommand({ ...base(), setuid: true, filename: 'app' })).toBe('chmod 4755 app');
  });

  it('falls back to default name when filename empty', () => {
    const dirState: ChmodState = { ...base(), filename: '', filenameType: 'directory' };
    expect(chmodCommand(dirState)).toBe('chmod 755 mydir');
  });
});

describe('explanations', () => {
  it('explains each user class', () => {
    const perms: PermissionSet = { read: true, write: false, execute: true };
    expect(explainClass('user', perms)).toBe('Can read, execute (user)');
    expect(explainClass('other', { read: false, write: false, execute: false })).toBe(
      'No permissions for other'
    );
  });

  it('explains execute bit differently for files vs directories', () => {
    expect(executeBitExplanation('file')).toContain('run as a program');
    expect(executeBitExplanation('directory')).toContain('enter/search');
  });
});

describe('chmodTool definition', () => {
  it('exposes identity, config and exporters', () => {
    expect(chmodTool.id).toBe('chmod-calculator');
    expect(chmodTool.name).toBe('Chmod Symbolic Calculator');
    expect(chmodTool.exporters).toHaveLength(4);
  });

  it('serializes to JSON string and accepts own output', () => {
    const json = chmodTool.serialize(base());
    expect(typeof json).toBe('string');
    const result = chmodTool.deserialize(JSON.parse(json));
    expect(result.success).toBe(true);
  });
});
