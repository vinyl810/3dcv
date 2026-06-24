'use client';

import { useEffect, useRef } from 'react';
import type { DioramaApp } from '@/lib/three/engine';
import type { Mark } from '@/lib/marks-types';

interface Props {
  onHover: (id: string | null, label: string | null) => void;
  onSelect: (id: string | null) => void;
  onReady: () => void;
  selectedId: string | null;
  marks: Mark[];
  className?: string;
}

export default function SceneCanvas({
  onHover,
  onSelect,
  onReady,
  selectedId,
  marks,
  className,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<DioramaApp | null>(null);

  // Keep latest callbacks without re-running the heavy init effect.
  const cb = useRef({ onHover, onSelect, onReady });
  cb.current = { onHover, onSelect, onReady };

  // Latest marks, read at (async) construction time without re-running init.
  const marksRef = useRef(marks);
  marksRef.current = marks;

  useEffect(() => {
    let app: DioramaApp | null = null;
    let disposed = false;

    // Dynamic import keeps three.js entirely out of the SSR bundle.
    import('@/lib/three/engine').then(({ DioramaApp: App }) => {
      if (disposed || !mountRef.current) return;
      app = new App(
        mountRef.current,
        {
          onHover: (id, label) => cb.current.onHover(id, label),
          onSelect: (id) => cb.current.onSelect(id),
          onReady: () => cb.current.onReady(),
        },
        { initialMarks: marksRef.current },
      );
      appRef.current = app;
      // Catch any marks that arrived between render and async init.
      app.syncMarks(marksRef.current);
    });

    return () => {
      disposed = true;
      app?.dispose();
      appRef.current = null;
    };
  }, []);

  // Reflect the selected station into the scene (keeps it lifted + lit).
  useEffect(() => {
    appRef.current?.setSelected(selectedId);
  }, [selectedId]);

  // Spawn freshly-planted marks (idempotent — engine dedupes by id).
  useEffect(() => {
    appRef.current?.syncMarks(marks);
  }, [marks]);

  return <div ref={mountRef} className={className} />;
}
