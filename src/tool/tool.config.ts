import type { ToolConfig } from '@itsjust/core';
import packageJson from '../../package.json';

export const templateBaseVersion = packageJson.version;

const toolConfig = {
  id: 'chmod-calculator',
  name: 'Chmod Symbolic Calculator',
  description: 'Convert between chmod numeric (octal) modes and symbolic (rwx) notation with live permission visualizations.',
  version: '1.0.0',
  exportFormats: ['json', 'png', 'jpeg', 'webp', 'pdf'],
  features: {
    export: true,
    autoSave: true,
    undoRedo: true,
    sidebar: true,
    statusBar: true,
    darkMode: true,
  },
  theme: {
    accent: '#f59e0b',
    accentHover: '#d97706',
    accentSubtle: 'rgba(245, 158, 11, 0.08)',
    brand: 'Chmod Calculator',
    icon: '🔐',
  },
  shortcuts: [
    {
      title: 'Chmod Calculator',
      shortcuts: [
        { keys: 'Ctrl+Shift+E', label: 'Export All', description: 'exports all formats at once' },
      ],
    },
  ],
} satisfies ToolConfig;

export default toolConfig;
