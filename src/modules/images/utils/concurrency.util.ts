/**
 * Run an async task over an array with bounded concurrency.
 * Preserves order in the output.
 */
export async function mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    task: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let cursor = 0;

    const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (true) {
            const index = cursor++;
            if (index >= items.length) return;
            results[index] = await task(items[index], index);
        }
    });

    await Promise.all(workers);
    return results;
}