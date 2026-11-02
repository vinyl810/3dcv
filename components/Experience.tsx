'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

/** localStorage key holding the ids of fireflies this browser planted. */
const MINE_KEY = 'cv:my-fireflies';

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
  // Ids of fireflies THIS browser planted (persisted), plus a bump-counter that
  // fires the in-scene locator so the visitor can find their own.
  const [mineIds, setMineIds] = useState<number[]>([]);
  const [pingNonce, setPingNonce] = useState(0);

  // Restore the visitor's own firefly ids from a previous visit.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(MINE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setMineIds(arr.filter((n) => typeof n === 'number'));
      }
    } catch {
      /* private mode / disabled storage — fine, just no persistence */
    }
  }, []);

  const findMine = useCallback(() => setPingNonce((n) => n + 1), []);

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

  // Plant a mark: persist via the server action, then add it to the scene +
  // tally, remember it as "mine", and auto-locate it for the visitor.
  const onPlant = useCallback(async (color: number, label: string) => {
    const res = await plantMark({ color, label });
    if (res.ok) {
      setMarks((m) => [...m, res.mark]);
      setTotal((t) => t + 1);
      setMineIds((ids) => {
        if (ids.includes(res.mark.id)) return ids;
        const next = [...ids, res.mark.id];
        try {
          localStorage.setItem(MINE_KEY, JSON.stringify(next));
        } catch {
          /* storage unavailable — keep it in-memory for this session */
        }
        return next;
      });
      // Effects run in declaration order: marks sync → setMine → ping, so the
      // new beacon exists and is flagged mine before the locator fires.
      setPingNonce((n) => n + 1);
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
        mineIds={mineIds}
        pingNonce={pingNonce}
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
        <TraceBox
          total={total}
          dbEnabled={dbEnabled}
          recent={recent}
          onPlant={onPlant}
          myCount={mineIds.length}
          onFindMine={findMine}
        />
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
