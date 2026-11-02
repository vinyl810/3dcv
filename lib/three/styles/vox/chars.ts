/**
 * Character variant switch for the vox style (read only here):
 *   ?char=a   stylized toon folk at the landmark grain (0.125)
 *   ?char=b   stylized toon folk at half grain (0.0625)          ← default
 *   ?char=cur the previous semi-realistic detailed figures (0.0625)
 * Model keys: about_char{_a,_b,} / involvement_people{_a,_b,}.
 */
export type CharVariant = 'a' | 'b' | 'cur';
export const DEFAULT_CHAR: CharVariant = 'b';

export function charVariant(): { id: CharVariant; suffix: string; res: number } {
  let id: CharVariant = DEFAULT_CHAR;
  if (typeof location !== 'undefined') {
    const raw = new URLSearchParams(location.search).get('char');
    if (raw === 'a' || raw === 'b' || raw === 'cur') id = raw;
  }
  return { id, suffix: id === 'cur' ? '' : `_${id}`, res: id === 'a' ? 1 : 2 };
}
