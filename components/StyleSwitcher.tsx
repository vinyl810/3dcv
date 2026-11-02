'use client';

import { useEffect, useState } from 'react';
import styles from './ui.module.css';
import { DEFAULT_STYLE, STYLE_IDS, STYLE_LABELS, type StyleId } from '@/lib/three/styles';

/**
 * Comparison bar for the model-style experiment. Only rendered when the URL
 * already carries `?style=` (so normal visitors never see it). Each link keeps
 * the other query params (e.g. `?h=12`) and does a full reload, because the
 * style is chosen once when the scene is built.
 */
export default function StyleSwitcher() {
  const [current, setCurrent] = useState<StyleId | null>(null);
  const [params, setParams] = useState<URLSearchParams | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const s = p.get('style');
    if (s === null) return;
    setParams(p);
    setCurrent((STYLE_IDS as readonly string[]).includes(s) ? (s as StyleId) : DEFAULT_STYLE);
  }, []);

  if (!current || !params) return null;

  const href = (id: StyleId) => {
    const p = new URLSearchParams(params);
    p.set('style', id);
    return `?${p.toString()}`;
  };

  return (
    <nav className={styles.styleBar} aria-label="Model style">
      {STYLE_IDS.map((id) => (
        <a key={id} href={href(id)} className={id === current ? styles.styleOn : undefined}>
          {STYLE_LABELS[id]}
        </a>
      ))}
    </nav>
  );
}
