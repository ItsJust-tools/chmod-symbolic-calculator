import type { Tool, DeserializeResult, ToolExporterDefinition } from '@itsjust/core';
import toolConfig from './tool.config';
import type { ChmodState, FilenameType, PermissionSet, SpecialBit, UserClass } from './types';
import { USER_CLASSES, SPECIAL_BITS } from './types';
import {
  defaultState,
  toNumeric,
  fromNumeric,
  fromSymbolic,
  chmodCommand,
  applyPreset,
  togglePermission,
  toggleSpecialBit,
} from './chmod-logic';

function isPermissionSet(value: unknown): value is PermissionSet {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.read === 'boolean' && typeof v.write === 'boolean' && typeof v.execute === 'boolean';
}

export function isChmodState(value: unknown): value is ChmodState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ChmodState>;
  if (!USER_CLASSES.every((cls) => isPermissionSet(v[cls]))) return false;
  if (!SPECIAL_BITS.every((bit) => typeof v[bit as SpecialBit] === 'boolean')) return false;
  if (typeof v.filename !== 'string') return false;
  if (v.filenameType !== 'file' && v.filenameType !== 'directory') return false;
  return true;
}

export const chmodTool: Tool<ChmodState> = {
  id: toolConfig.id,
  name: toolConfig.name,
  version: toolConfig.version,
  config: toolConfig,
  initialState: defaultState(),
  serialize: (state) => JSON.stringify(state),
  deserialize: (data): DeserializeResult<ChmodState> => {
    try {
      if (isChmodState(data)) {
        return { success: true, data };
      }
      return {
        success: false,
        error: 'Invalid data format: expected valid chmod state',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Deserialization error';
      return { success: false, error: `Failed to deserialize state: ${message}` };
    }
  },
  exporters: [
    { format: 'png', loader: () => import('./exporters/png') },
    { format: 'jpeg', loader: () => import('./exporters/jpeg') },
    { format: 'webp', loader: () => import('./exporters/webp') },
    { format: 'pdf', loader: () => import('./exporters/pdf') },
  ] as ToolExporterDefinition[],
};

/** Set a permission checkbox. Not part of the Tool contract. */
export function setPermission(state: ChmodState, userClass: UserClass, permission: keyof PermissionSet): ChmodState {
  return togglePermission(state, userClass, permission);
}

/** Toggle a special bit (setuid / setgid / sticky). */
export function setSpecialBit(state: ChmodState, bit: SpecialBit): ChmodState {
  return toggleSpecialBit(state, bit);
}

/** Parse either numeric ("755", "4755") or symbolic ("rwxr-xr-x") text and update state. Returns original state when invalid. */
export function parseModeInput(state: ChmodState, input: string): { state: ChmodState; ok: boolean } {
  const trimmed = input.trim();
  if (!trimmed) return { state, ok: false };
  if (/^[0-7]{3,4}$/.test(trimmed.replace(/\s/g, ''))) {
    const parsed = fromNumeric(trimmed);
    return parsed ? { state: { ...parsed, filename: state.filename, filenameType: state.filenameType }, ok: true } : { state, ok: false };
  }
  const parsed = fromSymbolic(trimmed);
  return parsed
    ? { state: { ...parsed, filename: state.filename, filenameType: state.filenameType }, ok: true }
    : { state, ok: false };
}

/** Apply a preset by id; returns null when the preset is unknown. */
export function applyPresetToState(state: ChmodState, presetId: string): ChmodState | null {
  return applyPreset(state, presetId);
}

export function serializeState(state: ChmodState): string {
  return chmodTool.serialize(state);
}

export function deserializeState(data: unknown): DeserializeResult<ChmodState> {
  return chmodTool.deserialize(data);
}

export function getChmodCommand(state: ChmodState): string {
  return chmodCommand(state);
}

export function getFilenameType(state: ChmodState): FilenameType {
  return state.filenameType;
}

export { defaultState } from './chmod-logic';
