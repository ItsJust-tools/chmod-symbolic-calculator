import type {
  ChmodState,
  FilenameType,
  PermissionSet,
  SpecialBit,
  UserClass,
} from './types';
import { SPECIAL_BITS, USER_CLASSES } from './types';

const DEFAULT_PERMISSIONS: PermissionSet = {
  read: false,
  write: false,
  execute: false,
};

export const PRESETS: Array<{ id: string; label: string; description: string; state: Pick<ChmodState, 'user' | 'group' | 'other' | 'setuid' | 'setgid' | 'sticky'> }> = [
  {
    id: '755',
    label: '755 — Executable',
    description: 'Executable script or publicly readable directory',
    state: {
      user: { read: true, write: true, execute: true },
      group: { read: true, write: false, execute: true },
      other: { read: true, write: false, execute: true },
      setuid: false,
      setgid: false,
      sticky: false,
    },
  },
  {
    id: '644',
    label: '644 — File',
    description: 'Regular file, owner-writable, world-readable',
    state: {
      user: { read: true, write: true, execute: false },
      group: { read: true, write: false, execute: false },
      other: { read: true, write: false, execute: false },
      setuid: false,
      setgid: false,
      sticky: false,
    },
  },
  {
    id: '600',
    label: '600 — Private',
    description: 'Private file, only the owner can access it',
    state: {
      user: { read: true, write: true, execute: false },
      group: { read: false, write: false, execute: false },
      other: { read: false, write: false, execute: false },
      setuid: false,
      setgid: false,
      sticky: false,
    },
  },
  {
    id: '777',
    label: '777 — Public',
    description: 'Full access for everyone (use with caution)',
    state: {
      user: { read: true, write: true, execute: true },
      group: { read: true, write: true, execute: true },
      other: { read: true, write: true, execute: true },
      setuid: false,
      setgid: false,
      sticky: false,
    },
  },
  {
    id: '1777',
    label: '1777 — Sticky dir',
    description: 'World-writable directory with sticky bit (like /tmp)',
    state: {
      user: { read: true, write: true, execute: true },
      group: { read: true, write: true, execute: true },
      other: { read: true, write: true, execute: true },
      setuid: false,
      setgid: false,
      sticky: true,
    },
  },
];

export function defaultState(): ChmodState {
  return {
    user: { read: true, write: true, execute: true },
    group: { read: true, write: false, execute: true },
    other: { read: true, write: false, execute: true },
    setuid: false,
    setgid: false,
    sticky: false,
    filename: 'script.sh',
    filenameType: 'file',
  };
}

function permissionDigit(p: PermissionSet): number {
  return (p.read ? 4 : 0) + (p.write ? 2 : 0) + (p.execute ? 1 : 0);
}

export function specialDigit(state: ChmodState): number {
  return (state.setuid ? 4 : 0) + (state.setgid ? 2 : 0) + (state.sticky ? 1 : 0);
}

/** Full octal mode, e.g. 4755 or "0755" — always a 4-digit string with leading special digit. */
export function toNumeric(state: ChmodState): string {
  const special = specialDigit(state);
  const user = permissionDigit(state.user);
  const group = permissionDigit(state.group);
  const other = permissionDigit(state.other);
  return `${special}${user}${group}${other}`;
}

function digitToSymbolic(digit: number): string {
  const read = (digit & 4) !== 0 ? 'r' : '-';
  const write = (digit & 2) !== 0 ? 'w' : '-';
  const execute = (digit & 1) !== 0 ? 'x' : '-';
  return `${read}${write}${execute}`;
}

function digitToSymbolicWithSpecial(digit: number, special: number, kind: 'user' | 'group' | 'other'): string {
  const base = digitToSymbolic(digit);
  const chars = base.split('');
  if (kind === 'user') {
    chars[2] = digit & 1 ? (special & 4 ? 's' : 'x') : special & 4 ? 'S' : '-';
  } else if (kind === 'group') {
    chars[2] = digit & 1 ? (special & 2 ? 's' : 'x') : special & 2 ? 'S' : '-';
  } else {
    chars[2] = digit & 1 ? (special & 1 ? 't' : 'x') : special & 1 ? 'T' : '-';
  }
  return chars.join('');
}

/** Symbolic notation, e.g. rwsr-xr-t (no special char when bit absent). */
export function toSymbolic(state: ChmodState): string {
  const special = specialDigit(state);
  return (
    digitToSymbolicWithSpecial(permissionDigit(state.user), special, 'user') +
    digitToSymbolicWithSpecial(permissionDigit(state.group), special, 'group') +
    digitToSymbolicWithSpecial(permissionDigit(state.other), special, 'other')
  );
}

/** Plain rwxr-xr-x style without setuid/setgid/sticky substitution — matches ls -l for simple modes. */
export function toPlainSymbolic(state: ChmodState): string {
  return (
    digitToSymbolic(permissionDigit(state.user)) +
    digitToSymbolic(permissionDigit(state.group)) +
    digitToSymbolic(permissionDigit(state.other))
  );
}

export interface ChmodCommandParts {
  numeric: string;
  command: string;
}

export function chmodCommand(state: ChmodState): string {
  const name = state.filename.trim() || (state.filenameType === 'directory' ? 'mydir' : 'file.txt');
  if (specialDigit(state) === 0) {
    return `chmod ${permissionDigit(state.user)}${permissionDigit(state.group)}${permissionDigit(state.other)} ${name}`;
  }
  return `chmod ${toNumeric(state)} ${name}`;
}

export function digitToPermissions(digit: number): PermissionSet {
  const clamped = Math.max(0, Math.min(7, digit));
  return {
    read: (clamped & 4) !== 0,
    write: (clamped & 2) !== 0,
    execute: (clamped & 1) !== 0,
  };
}

/** Parse octal mode digits (3 or 4 digits, e.g. 755, 4755, 0755) into state. */
export function fromNumeric(numeric: string): ChmodState | null {
  const cleaned = numeric.trim().replace(/^0(?=\d{3}$)/, '');
  if (!/^[0-7]{3,4}$/.test(cleaned)) return null;
  const padded = cleaned.padStart(4, '0');
  const special = parseInt(padded[0] ?? '0', 8);
  const user = parseInt(padded[1] ?? '0', 8);
  const group = parseInt(padded[2] ?? '0', 8);
  const other = parseInt(padded[3] ?? '0', 8);
  const base = defaultState();
  return {
    ...base,
    setuid: (special & 4) !== 0,
    setgid: (special & 2) !== 0,
    sticky: (special & 1) !== 0,
    user: digitToPermissions(user),
    group: digitToPermissions(group),
    other: digitToPermissions(other),
  };
}

function symbolicTripletToDigit(triplet: string): number {
  let digit = 0;
  if (triplet[0] === 'r') digit += 4;
  if (triplet[1] === 'w') digit += 2;
  // Only lowercase x/s/t carry the execute bit; uppercase S/T mean special bit without execute.
  if (triplet[2] === 'x' || triplet[2] === 's' || triplet[2] === 't') digit += 1;
  return digit;
}

/** Parse symbolic notation like rwsr-xr-t, rwxr-xr-x, rwxr-sr-x into state. Accepts 9-char triplets. */
export function fromSymbolic(symbolic: string): ChmodState | null {
  const trimmed = symbolic.trim();
  // Allow an optional leading file-type char from `ls -l` output (10-char lines).
  const cleaned = trimmed.length === 10 && /^[dlbcps-]/.test(trimmed) ? trimmed.slice(1, 10) : trimmed.slice(0, 9);
  if (cleaned.length !== 9) return null;
  if (!/^[r-][w-][xsSt-][r-][w-][xsSt-][r-][w-][xtT-]$/.test(cleaned)) return null;
  const base = defaultState();
  const state: ChmodState = {
    ...base,
    user: digitToPermissions(symbolicTripletToDigit(cleaned.slice(0, 3))),
    group: digitToPermissions(symbolicTripletToDigit(cleaned.slice(3, 6))),
    other: digitToPermissions(symbolicTripletToDigit(cleaned.slice(6, 9))),
    setuid: /[sS]/.test(cleaned.slice(0, 3)),
    setgid: /[sS]/.test(cleaned.slice(3, 6)),
    sticky: /[tT]/.test(cleaned.slice(6, 9)),
  };
  return state;
}

export function togglePermission(
  state: ChmodState,
  userClass: UserClass,
  permission: keyof PermissionSet
): ChmodState {
  const current = state[userClass];
  return {
    ...state,
    [userClass]: { ...current, [permission]: !current[permission] },
  } as ChmodState;
}

export function toggleSpecialBit(state: ChmodState, bit: SpecialBit): ChmodState {
  return { ...state, [bit]: !state[bit] };
}

/** Human explanation of each class's permissions. */
export function explainClass(userClass: UserClass, permissions: PermissionSet): string {
  if (!permissions.read && !permissions.write && !permissions.execute) {
    return `No permissions for ${userClass}`;
  }
  const parts: string[] = [];
  if (permissions.read) parts.push('read');
  if (permissions.write) parts.push('write');
  if (permissions.execute) parts.push('execute');
  return `Can ${parts.join(', ')} (${userClass})`;
}

/** Why the x bit shows differently for directories vs files. */
export function executeBitExplanation(filenameType: FilenameType): string {
  return filenameType === 'directory'
    ? 'For directories, the execute bit means "enter/search" — required to cd into the directory or access files inside it.'
    : 'For files, the execute bit means the file can be run as a program or script.';
}

export function isValidPresetId(id: string): boolean {
  return PRESETS.some((preset) => preset.id === id);
}

export function applyPreset(state: ChmodState, presetId: string): ChmodState | null {
  const preset = PRESETS.find((p) => p.id === presetId);
  if (!preset) return null;
  return {
    ...state,
    user: { ...preset.state.user },
    group: { ...preset.state.group },
    other: { ...preset.state.other },
    setuid: preset.state.setuid,
    setgid: preset.state.setgid,
    sticky: preset.state.sticky,
  };
}

// Back-compat aliases used by template-era tests and shared helpers.
export const notepadToolDefaults = defaultState;
export const USER_CLASSES_EXPORT = USER_CLASSES;
export const SPECIAL_BITS_EXPORT = SPECIAL_BITS;
