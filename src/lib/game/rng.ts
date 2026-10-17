// Randomness — context-aware, weighted, seeded where it matters.
// هیچ Math.random خالی استفاده نمی‌شود؛ همه چیز وزن‌دار و قابل تکرار است.

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seedFrom(...parts: (string | number)[]): number {
  let h = 2166136261
  const s = parts.join("|")
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export interface Weighted {
  weight: number
}

export function weightedPick<T extends Weighted>(items: T[], rng: () => number): T | null {
  const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0)
  if (total <= 0) return null
  let roll = rng() * total
  for (const item of items) {
    roll -= Math.max(0, item.weight)
    if (roll <= 0) return item
  }
  return items[items.length - 1]
}

export function chance(p: number, rng: () => number): boolean {
  return rng() < p
}

export function randInt(min: number, max: number, rng: () => number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

export function pickOne<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export function round2(v: number): number {
  return Math.round(v * 100) / 100
}
