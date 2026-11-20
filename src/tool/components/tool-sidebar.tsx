'use client';

import type { ChmodState } from '@/tool/types';
import { explainClass } from '@/tool/chmod-logic';

interface ToolSidebarProps {
  state: ChmodState;
  onChange: (state: ChmodState) => void;
}

const CLASS_ORDER = ['user', 'group', 'other'] as const;

export function ToolSidebar({ state, onChange }: ToolSidebarProps) {
  const totalBits = CLASS_ORDER.reduce(
    (count, cls) =>
      count +
      (state[cls].read ? 1 : 0) +
      (state[cls].write ? 1 : 0) +
      (state[cls].execute ? 1 : 0),
    0
  );

  return (
    <div className="chmod-sidebar">
      <div className="sidebar-section">
        <h3>Permission Summary</h3>
        <ul className="stats-list">
          {CLASS_ORDER.map((cls) => (
            <li key={cls} className="stat-row" data-testid={`explain-${cls}`}>
              {explainClass(cls, state[cls])}
            </li>
          ))}
          <li className="stat-row" data-testid="special-summary">
            Special bits:{' '}
            {state.setuid || state.setgid || state.sticky
              ? [state.setuid && 'setuid', state.setgid && 'setgid', state.sticky && 'sticky']
                  .filter(Boolean)
                  .join(', ')
              : 'none'}
          </li>
        </ul>
      </div>
      <div className="sidebar-section">
        <h3>Quick Actions</h3>
        <button
          type="button"
          className="sidebar-btn"
          onClick={() =>
            onChange({
              ...state,
              user: { read: true, write: true, execute: true },
              group: { read: true, write: true, execute: true },
              other: { read: true, write: true, execute: true },
            })
          }
        >
          Everyone everything
        </button>
        <button
          type="button"
          className="sidebar-btn"
          onClick={() =>
            onChange({
              ...state,
              user: { read: false, write: false, execute: false },
              group: { read: false, write: false, execute: false },
              other: { read: false, write: false, execute: false },
            })
          }
        >
          Nothing for anyone
        </button>
      </div>
      <div className="sidebar-section">
        <p className="chmod-sidebar-note">
          {totalBits} permission bit{totalBits === 1 ? '' : 's'} enabled across user, group, and other.
        </p>
      </div>
    </div>
  );
}
