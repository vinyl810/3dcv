'use client';

import { useEffect, useRef } from 'react';
import styles from './ui.module.css';
import { profile, stations, type Station, type CVEntry } from '@/lib/cv-data';

function renderEntry(entry: CVEntry, key: React.Key) {
  return (
    <div className={styles.entry} key={key}>
      {entry.title && <h3>{entry.title}</h3>}
      {entry.subtitle && <p className={styles.sub}>{entry.subtitle}</p>}
      {(entry.period || entry.location) && (
        <p className={styles.meta}>
          {entry.period && <span>{entry.period}</span>}
          {entry.location && <span>{entry.location}</span>}
        </p>
      )}
      {entry.bullets && entry.bullets.length > 0 && (
        <ul>
          {entry.bullets.map((b, j) => (
            <li key={j}>{b}</li>
          ))}
        </ul>
      )}
      {entry.tags && entry.tags.length > 0 && (
        <div className={styles.tags}>
          {entry.tags.map((t) => (
            <span className={styles.tag} key={t}>
              {t}
            </span>
          ))}
        </div>
      )}
      {entry.link && (
        <a
          className={styles.panelLink}
          href={entry.link.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          {entry.link.label} ↗
        </a>
      )}
    </div>
  );
}

interface OverlayProps {
  selected: Station | null;
  hoveredLabel: string | null;
  pointer: { x: number; y: number } | null;
  visited: string[];
  onClose: () => void;
  onSelect: (id: string) => void;
}

export default function Overlay({
  selected,
  hoveredLabel,
  pointer,
  visited,
  onClose,
  onSelect,
}: OverlayProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  // Reset scroll to top whenever a new station opens.
  useEffect(() => {
    if (selected && bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [selected]);

  // Close on Escape.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, onClose]);

  const panelOpen = !!selected;

  return (
    <div className={styles.root}>
      {/* identity */}
      <div className={styles.identity}>
        <h1>
          {profile.name} <span className={styles.han}>{profile.hangul}</span>
        </h1>
        <p>{profile.title}</p>
      </div>

      {/* github */}
      <a
        className={styles.github}
        href={profile.github}
        target="_blank"
        rel="noopener noreferrer"
      >
        ▶ {profile.githubHandle}
      </a>

      {/* bottom hint — hidden while a panel is open */}
      {!panelOpen && (
        <div className={styles.hint}>
          <span className={styles.hintPulse} />
          <span>
            tap a landmark<span className={styles.hintWide}> to explore</span> ·{' '}
            {visited.length}/{stations.length}
            <span className={styles.hintTouch}> · pinch to zoom</span>
          </span>
        </div>
      )}

      {/* progress dots */}
      {!panelOpen && (
        <div className={styles.counter}>
          {stations.map((s) => (
            <button
              key={s.id}
              type="button"
              className={styles.dotBtn}
              title={s.label}
              aria-label={`Open ${s.label}`}
              onClick={() => onSelect(s.id)}
            >
              <span
                className={`${styles.dot} ${visited.includes(s.id) ? styles.on : ''}`}
              />
            </button>
          ))}
        </div>
      )}

      {/* hover tooltip */}
      {hoveredLabel && pointer && !panelOpen && (
        <div
          className={styles.tooltip}
          style={{ left: pointer.x, top: pointer.y }}
        >
          {hoveredLabel}
        </div>
      )}

      {/* mobile popup backdrop — dim + tap-to-close */}
      <div
        className={`${styles.backdrop} ${panelOpen ? styles.backdropOn : ''}`}
        onClick={onClose}
      />

      {/* info panel — side panel on desktop, centered popup on mobile */}
      <aside className={`${styles.panelWrap} ${panelOpen ? styles.open : ''}`}>
        {selected && (
          <>
            <div className={styles.panelHead}>
              <button
                className={styles.closeBtn}
                onClick={onClose}
                aria-label="Close panel"
              >
                ✕
              </button>
              <p className={styles.eyebrow}>{selected.eyebrow}</p>
              <h2>{selected.heading}</h2>
              {selected.intro && <p className={styles.intro}>{selected.intro}</p>}
            </div>
            <div className={`${styles.panelBody} pixel-scroll`} ref={bodyRef}>
              {selected.groups
                ? selected.groups.map((g, gi) => (
                    <section className={styles.group} key={gi}>
                      <h4 className={styles.groupHead}>{g.heading}</h4>
                      {g.entries.map((e, ei) => renderEntry(e, ei))}
                    </section>
                  ))
                : selected.entries?.map((e, i) => renderEntry(e, i))}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
