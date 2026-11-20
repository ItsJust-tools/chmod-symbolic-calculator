export interface PermissionSet {
  read: boolean;
  write: boolean;
  execute: boolean;
}

export type FilenameType = 'file' | 'directory';

export interface ChmodState {
  user: PermissionSet;
  group: PermissionSet;
  other: PermissionSet;
  setuid: boolean;
  setgid: boolean;
  sticky: boolean;
  filename: string;
  filenameType: FilenameType;
}

export const SPECIAL_BITS = ['setuid', 'setgid', 'sticky'] as const;
export type SpecialBit = (typeof SPECIAL_BITS)[number];
export const USER_CLASSES = ['user', 'group', 'other'] as const;
export type UserClass = (typeof USER_CLASSES)[number];
