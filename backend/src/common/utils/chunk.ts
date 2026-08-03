/**
 * Splits an array into chunks of a given size.
 *
 * @param array - The array to split
 * @param size - Maximum number of elements per chunk
 * @returns Array of chunks
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
