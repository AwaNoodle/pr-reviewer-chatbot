export function buildDiffLineKeys(lines: string[]): string[] {
  const seenCounts = new Map<string, number>();

  return lines.map((line) => {
    const nextCount = (seenCounts.get(line) ?? 0) + 1;
    seenCounts.set(line, nextCount);
    return `${line}::${nextCount}`;
  });
}
