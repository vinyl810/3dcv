import 'server-only';
import { neon } from '@neondatabase/serverless';
import { unstable_cache, revalidateTag } from 'next/cache';
import { createHash } from 'node:crypto';
import { type Mark, MAX_LABEL, RENDER_CAP } from './marks-types';

/**
 * Minimal Postgres (Neon) data layer for visitor marks.
 *
 * Resource posture: ONE table + ONE index; reads are cached (revalidate 60s) so
 * repeat visitors don't hit the DB; writes happen only on submit and are rate-
 * limited (1 / IP / hour). Everything degrades gracefully when no connection
 * string is set, so local dev / builds work before the DB is wired up.
 */

const CONN =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  '';

/** True once a Neon/Postgres connection string is present in the environment. */
export function dbEnabled(): boolean {
  return CONN.length > 0;
}

const db = () => neon(CONN);

// Lazily create the table once per (cold) runtime. CREATE ... IF NOT EXISTS is
// idempotent and cheap, so re-running on a fresh serverless instance is fine.
let ensured: Promise<void> | null = null;
function ensureTable(): Promise<void> {
  if (!ensured) {
    ensured = (async () => {
      const sql = db();
      await sql`CREATE TABLE IF NOT EXISTS marks (
        id serial PRIMARY KEY,
        x real NOT NULL,
        z real NOT NULL,
        color smallint NOT NULL DEFAULT 0,
        label text,
        ip_hash text,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS marks_created_idx ON marks (created_at DESC)`;
    })().catch((e) => {
      ensured = null; // allow a retry on the next call
      throw e;
    });
  }
  return ensured;
}

function toMark(r: Record<string, unknown>): Mark {
  const created = r.created_at;
  return {
    id: Number(r.id),
    x: Number(r.x),
    z: Number(r.z),
    color: Number(r.color),
    label: (r.label as string | null) ?? null,
    createdAt: created instanceof Date ? created.toISOString() : String(created),
  };
}

/**
 * Recent marks for rendering + a total count. Cached so the page can be served
 * from cache and the DB is touched at most once per `revalidate` window.
 */
const _getMarks = unstable_cache(
  async (): Promise<{ marks: Mark[]; total: number }> => {
    if (!dbEnabled()) return { marks: [], total: 0 };
    await ensureTable();
    const sql = db();
    const rows = await sql`SELECT id, x, z, color, label, created_at
      FROM marks ORDER BY created_at DESC LIMIT ${RENDER_CAP}`;
    const countRows = await sql`SELECT count(*)::int AS n FROM marks`;
    const total = Number(countRows[0]?.n ?? rows.length);
    return { marks: rows.map((r) => toMark(r as Record<string, unknown>)), total };
  },
  ['marks-v1'],
  { revalidate: 60, tags: ['marks'] },
);

export function getMarks(): Promise<{ marks: Mark[]; total: number }> {
  return _getMarks();
}

// Landmark keep-out (xz must mirror LANDMARKS in three/models.ts) so a planted
// firefly never lands on top of a landmark.
const KEEPOUT: [number, number, number][] = [
  [0, 0, 2.6], [0, -6, 2.2], [-6.5, 1, 2.2], [4.5, 2.5, 2.0],
  [-1, 5, 2.2], [-5, -4, 2.2], [3, -5.5, 2.2], [6, -1, 2.2],
];

/** Rejection-sample a free spot on the grass, away from the landmarks. */
function pickSpot(): { x: number; z: number } {
  for (let i = 0; i < 60; i++) {
    const x = (Math.random() * 2 - 1) * 6.2;
    const z = (Math.random() * 2 - 1) * 6.2;
    if (KEEPOUT.some(([bx, bz, r]) => (x - bx) ** 2 + (z - bz) ** 2 < r * r)) continue;
    return { x: +x.toFixed(2), z: +z.toFixed(2) };
  }
  const a = Math.random() * Math.PI * 2; // fallback: a point near the rim
  return { x: +(Math.cos(a) * 6).toFixed(2), z: +(Math.sin(a) * 6).toFixed(2) };
}

function ipHash(ip: string): string {
  const salt = process.env.MARK_SALT || 'dk-3dcv';
  return createHash('sha256').update(`${ip}|${salt}`).digest('hex').slice(0, 32);
}

type CreateResult = { ok: true; mark: Mark } | { ok: false; error: string };

/** Insert one mark (validated + rate-limited). Returns the new mark on success. */
export async function createMark(opts: {
  label: string | null;
  color: number;
  ip: string;
}): Promise<CreateResult> {
  if (!dbEnabled()) return { ok: false, error: "The guestbook isn't connected yet." };

  const color =
    Number.isInteger(opts.color) && opts.color >= 0 && opts.color < MARK_COLORS_LEN
      ? opts.color
      : 0;
  const label = (opts.label ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL);

  await ensureTable();
  const sql = db();
  const ih = ipHash(opts.ip);

  // Rate limit: one mark per IP per hour.
  const recent = await sql`SELECT 1 FROM marks
    WHERE ip_hash = ${ih} AND created_at > now() - interval '1 hour' LIMIT 1`;
  if (recent.length > 0) {
    return { ok: false, error: 'You can leave one trace per hour. Please try again later.' };
  }

  const { x, z } = pickSpot();
  const rows = await sql`INSERT INTO marks (x, z, color, label, ip_hash)
    VALUES (${x}, ${z}, ${color}, ${label || null}, ${ih})
    RETURNING id, x, z, color, label, created_at`;
  revalidateTag('marks');
  return { ok: true, mark: toMark(rows[0] as Record<string, unknown>) };
}

// Local copy of the count to keep this file free of a value import from the
// client-side constants (avoids any chance of bundling server code).
const MARK_COLORS_LEN = 5;
