import type { ShareCardInput } from './types';
export function shareUrl(origin: string, n: number): string {
  return `${origin}/d/${n}?src=share`;
}
export function shareText(i: ShareCardInput): string {
  return `Clink #${i.puzzleNo} ${'⭐'.repeat(i.stars)}\n${'💧'.repeat(i.moves)} ${i.moves}/${i.par}\n${shareUrl(i.origin, i.puzzleNo)}`;
}
