'use client';

import type { ChmodState, FilenameType, UserClass } from '@/tool/types';
import { toNumeric, toSymbolic, toPlainSymbolic, chmodCommand, PRESETS, executeBitExplanation } from '@/tool/chmod-logic';
import { applyPresetToState, parseModeInput } from '@/tool/tool-definition';

interface PermissionCheckboxProps {
  label: string;
  checked: boolean;
  onChange: () => void;
}

function PermissionCheckbox({ label, checked, onChange }: PermissionCheckboxProps) {
  return (
    <label className="chmod-permission-checkbox">
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={label} />
      <span>{label.toUpperCase()}</span>
    </label>
  );
}

interface ToolCanvasProps {
  state: ChmodState;
  canvasRef?: React.RefObject<HTMLDivElement | null>;
  onChange: (state: ChmodState) => void;
}

const CLASS_LABELS: Record<UserClass, string> = {
  user: 'User (owner)',
  group: 'Group',
  other: 'Others',
};

export function ToolCanvas({ state, canvasRef, onChange }: ToolCanvasProps) {
  const handlePermission = (userClass: UserClass, permission: 'read' | 'write' | 'execute') => {
    const current = state[userClass];
    onChange({ ...state, [userClass]: { ...current, [permission]: !current[permission] } } as ChmodState);
  };

  const handleSpecial = (bit: 'setuid' | 'setgid' | 'sticky') => {
    onChange({ ...state, [bit]: !state[bit] });
  };

  const applyPresetId = (id: string) => {
    const next = applyPresetToState(state, id);
    if (next) onChange(next);
  };

  const applyModeInput = (input: string) => {
    const { state: next } = parseModeInput(state, input);
    onChange(next);
  };

  return (
    <div ref={canvasRef} className="chmod-canvas" role="application" aria-label="Chmod calculator canvas">
      <section className="chmod-output" aria-label="Permission outputs">
        <div className="chmod-outputs-row">
          <div className="chmod-output-block">
            <span className="chmod-output-label">Numeric (octal)</span>
            <span className="chmod-output-value" data-testid="numeric-output">
              {toNumeric(state)}
            </span>
          </div>
          <div className="chmod-output-block">
            <span className="chmod-output-label">Symbolic</span>
            <span className="chmod-output-value" data-testid="symbolic-output">
              {toSymbolic(state)}
            </span>
          </div>
          <div className="chmod-output-block">
            <span className="chmod-output-label">ls -l view</span>
            <span className="chmod-output-value" data-testid="plain-symbolic-output">
              {toPlainSymbolic(state)}
            </span>
          </div>
          <div className="chmod-output-block">
            <span className="chmod-output-label">Command</span>
            <span className="chmod-output-value" data-testid="chmod-command-output">
              {chmodCommand(state)}
            </span>
          </div>
        </div>
        <div className="chmod-mode-input">
          <label htmlFor="chmod-mode-input">Paste a mode (e.g. 755, 4755, rwxr-xr-x)</label>
          <input
            id="chmod-mode-input"
            type="text"
            defaultValue=""
            placeholder="755 or rwxr-xr-x"
            aria-label="Mode input"
            onBlur={(e) => {
              applyModeInput(e.target.value);
              e.target.value = '';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                applyModeInput((e.target as HTMLInputElement).value);
                (e.target as HTMLInputElement).value = '';
              }
            }}
          />
        </div>
      </section>

      <section className="chmod-presets" aria-label="Preset modes">
        <h3>Presets</h3>
        <div className="chmod-presets-row">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className="chmod-preset-btn"
              title={preset.description}
              onClick={() => applyPresetId(preset.id)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      <section className="chmod-grid" aria-label="Permission grid">
        {(['user', 'group', 'other'] as UserClass[]).map((userClass) => {
          const permissions = state[userClass];
          return (
            <div key={userClass} className="chmod-class-row" data-testid={`class-${userClass}`}>
              <span className="chmod-class-label">{CLASS_LABELS[userClass]}</span>
              <PermissionCheckbox
                label={`${userClass} read`}
                checked={permissions.read}
                onChange={() => handlePermission(userClass, 'read')}
              />
              <PermissionCheckbox
                label={`${userClass} write`}
                checked={permissions.write}
                onChange={() => handlePermission(userClass, 'write')}
              />
              <PermissionCheckbox
                label={`${userClass} execute`}
                checked={permissions.execute}
                onChange={() => handlePermission(userClass, 'execute')}
              />
            </div>
          );
        })}
      </section>

      <section className="chmod-special" aria-label="Special bits">
        <h3>Special bits</h3>
        <div className="chmod-special-row">
          <label className="chmod-special-toggle">
            <input type="checkbox" checked={state.setuid} onChange={() => handleSpecial('setuid')} aria-label="setuid bit (+4)" />
            <span>Setuid (+4)</span>
          </label>
          <label className="chmod-special-toggle">
            <input type="checkbox" checked={state.setgid} onChange={() => handleSpecial('setgid')} aria-label="setgid bit (+2)" />
            <span>Setgid (+2)</span>
          </label>
          <label className="chmod-special-toggle">
            <input type="checkbox" checked={state.sticky} onChange={() => handleSpecial('sticky')} aria-label="sticky bit (+1)" />
            <span>Sticky (+1)</span>
          </label>
        </div>
      </section>

      <section className="chmod-target" aria-label="Target file settings">
        <label htmlFor="chmod-filename">File name</label>
        <input
          id="chmod-filename"
          type="text"
          value={state.filename}
          onChange={(e) => onChange({ ...state, filename: e.target.value })}
          aria-label="Target file name"
        />
        <div className="chmod-type-row">
          {(['file', 'directory'] as FilenameType[]).map((type) => (
            <label key={type} className="chmod-type-toggle">
              <input
                type="radio"
                name="chmod-filename-type"
                checked={state.filenameType === type}
                onChange={() => onChange({ ...state, filenameType: type })}
                aria-label={`Treat target as ${type}`}
              />
              <span>{type === 'file' ? '📄 File' : '📁 Directory'}</span>
            </label>
          ))}
        </div>
        <p className="chmod-execute-note">{executeBitExplanation(state.filenameType)}</p>
        <button
          type="button"
          className="chmod-copy-btn"
          onClick={() => navigator.clipboard.writeText(chmodCommand(state))}
        >
          Copy chmod command
        </button>
      </section>
    </div>
  );
}
