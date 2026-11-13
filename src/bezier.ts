export function cubicBezier(t: number, points: readonly number[]): number {
  const [x1, y1, x2, y2] = points;
  const evaluate = (u: number, a: number, b: number) => 3 * (1-u)**2 * u * a + 3 * (1-u) * u*u * b + u**3;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  let lo = 0, hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (evaluate(mid, x1, x2) < t) lo = mid; else hi = mid;
  }
  return evaluate((lo + hi) / 2, y1, y2);
}
