'use server';

import { headers } from 'next/headers';
import { createMark } from '@/lib/marks';

/** Server Action: plant one visitor mark. Derives the IP for rate-limiting. */
export async function plantMark(input: { label: string; color: number }) {
  const h = await headers();
  const fwd = h.get('x-forwarded-for') ?? '';
  const ip = fwd.split(',')[0].trim() || h.get('x-real-ip') || '0.0.0.0';
  return createMark({ label: input.label, color: input.color, ip });
}
