'use client';

import { useCallback, useMemo, useState } from 'react';
import SceneCanvas from './SceneCanvas';
import Overlay from './Overlay';
import TraceBox from './TraceBox';
import styles from './ui.module.css';
import { stationById, type Station } from '@/lib/cv-data';
import { plantMark } from '@/app/actions';
import type { Mark } from '@/lib/marks-types';

interface Props {
  initialMarks: Mark[];
  total: number;
  dbEnabled: boolean;
}

export default function Experience({ initialMarks, total: total0, dbEnabled }: Props) {
  const [ready, setReady] = useState(false);
  const [marks, setMarks] = useState<Mark[]>(initialMarks);
  const [total, setTotal] = useState(total0);
  const [hover, setHover] = useState<{ id: string | null; label: string | null }>({
    id: null,
    label: null,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [visited, setVisited] = useState<string[]>([]);

  const onHover = useCallback((id: string | null, label: string | null) => {
    setHover({ id, label });
  }, []);

  const onSelect = useCallback((id: string | null) => {
    setSelectedId(id);
    if (id) setVisited((v) => (v.includes(id) ? v : [...v, id]));
  }, []);

  const onReady = useCallback(() => setReady(true), []);
  const onClose = useCallback(() => setSelectedId(null), []);

  // Track the pointer (drives the hover tooltip). Pointer events also cover touch.
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    setPointer({ x: e.clientX, y: e.clientY });
  }, []);

  const selected: Station | null = selectedId ? stationById(selectedId) ?? null : null;

  // Plant a mark: persist via the server action, then add it to the scene + tally.
  const onPlant = useCallback(async (color: number, label: string) => {
    const res = await plantMark({ color, label });
    if (res.ok) {
      setMarks((m) => [...m, res.mark]);
      setTotal((t) => t + 1);
    }
    return res;
  }, []);

  // Most recent labelled traces (newest first) for the little chip list.
  const recent = useMemo(
    () =>
      [...marks]
        .filter((m) => m.label && m.label.trim())
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 6)
        .map((m) => m.label as string),
    [marks],
  );

  return (
    <main onPointerMove={onPointerMove}>
      <SceneCanvas
        className={styles.canvasMount}
        onHover={onHover}
        onSelect={onSelect}
        onReady={onReady}
        selectedId={selectedId}
        marks={marks}
      />
      <Overlay
        selected={selected}
        hoveredLabel={hover.label}
        pointer={pointer}
        visited={visited}
        onClose={onClose}
        onSelect={onSelect}
      />
      {!selected && (
        <TraceBox total={total} dbEnabled={dbEnabled} recent={recent} onPlant={onPlant} />
      )}
      <div className={`${styles.loader} ${ready ? styles.hide : ''}`}>
        <div className={styles.loaderInner}>
          <div className={styles.big}>DAEWON KIM</div>
          <div className={styles.loaderBar}>
            <div className={styles.loaderFill} />
          </div>
          <div className={styles.small}>warming up the archipelago…</div>
        </div>
      </div>
    </main>
  );
}
