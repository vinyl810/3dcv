'use client';

import { useState } from 'react';
import styles from './ui.module.css';
import { MARK_COLORS, MARK_COLOR_NAMES, MAX_LABEL } from '@/lib/marks-types';

interface Props {
  total: number;
  dbEnabled: boolean;
  recent: string[];
  onPlant: (color: number, label: string) => Promise<{ ok: boolean; error?: string }>;
  /** How many fireflies this browser has planted (0 → hide the locator). */
  myCount: number;
  /** Fire the in-scene locator on the visitor's own fireflies. */
  onFindMine: () => void;
}

const hex = (i: number) => `#${MARK_COLORS[i].toString(16).padStart(6, '0')}`;

export default function TraceBox({
  total,
  dbEnabled,
  recent,
  onPlant,
  myCount,
  onFindMine,
}: Props) {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(0);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await onPlant(color, label.trim());
    setBusy(false);
    if (res.ok) {
      setDone(true);
      setLabel('');
    } else {
      setError(res.error ?? 'Something went wrong. Please try again.');
    }
  };

  return (
    <div className={styles.trace}>
      {open && (
        <div className={styles.tracePop}>
          {done ? (
            <div className={styles.traceDone}>
              <p>✨ You left your mark!</p>
              <p className={styles.traceHintTxt}>
                Your firefly is now glowing on the island — a pin floats above it
                so you can always find it again.
              </p>
            </div>
          ) : dbEnabled ? (
            <>
              <p className={styles.traceTitle}>Leave your trace</p>
              <div className={styles.traceSwatches} role="radiogroup" aria-label="Firefly color">
                {MARK_COLORS.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={color === i}
                    aria-label={MARK_COLOR_NAMES[i]}
                    className={`${styles.swatch} ${color === i ? styles.swatchOn : ''}`}
                    style={{ background: hex(i) }}
                    onClick={() => setColor(i)}
                  />
                ))}
              </div>
              <input
                className={styles.traceInput}
                value={label}
                onChange={(e) => setLabel(e.target.value.slice(0, MAX_LABEL))}
                maxLength={MAX_LABEL}
                placeholder="Say something (optional)"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit();
                }}
              />
              {error && <p className={styles.traceErr}>{error}</p>}
              <button
                className={styles.tracePlant}
                onClick={submit}
                disabled={busy}
                type="button"
              >
                {busy ? 'Lighting…' : 'Light a firefly'}
              </button>
            </>
          ) : (
            <div className={styles.traceDone}>
              <p>Coming soon ✨</p>
              <p className={styles.traceHintTxt}>The guestbook is being set up.</p>
            </div>
          )}
          {myCount > 0 && (
            <button className={styles.traceFind} onClick={onFindMine} type="button">
              {done ? '✨ Show me where it landed' : '✨ Find my firefly'}
              {myCount > 1 ? ` (${myCount})` : ''}
            </button>
          )}
          {recent.length > 0 && (
            <div className={styles.traceRecent}>
              {recent.map((r, i) => (
                <span key={i} className={styles.traceChip}>
                  {r}
                </span>
              ))}
            </div>
          )}
          <p className={styles.traceCredit}>
            firefly guestbook — thanks to{' '}
            <a
              className={styles.traceCreditLink}
              href="https://www.ajangeunajang.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              @ajangeunajang ↗
            </a>
          </p>
        </div>
      )}
      <button
        className={styles.traceToggle}
        onClick={() => setOpen((o) => !o)}
        type="button"
        aria-expanded={open}
      >
        ✨ <span className={styles.traceCount}>{total.toLocaleString()}</span> were here
      </button>
    </div>
  );
}
