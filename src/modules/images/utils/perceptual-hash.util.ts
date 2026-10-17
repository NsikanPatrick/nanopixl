import sharp from 'sharp';

/**
 * Perceptual hashing answers the question: 
 * "Is this image visually similar to one I already have?" If yes dont upload again
 * Compute a difference hash (dHash) for an image buffer.
 * Returns a 16-char hex string (64-bit hash).
 * Useful if the user uploads a slightly-cropped variant of an image you already 
 * ran through the AI, reuse the previous generation result instead of paying 
 * again for a different AI generation
 *
 * Algorithm:
 *   1. Resize to 9x8 grayscale
 *   2. Compare each pixel to its right neighbor
 *   3. Set a bit for each comparison (1 if left > right, else 0)
 *   4. Pack the 64 bits into 16 hex chars
 */

export async function computePerceptualHash(buffer: Buffer): Promise<string> {
    const width = 9;
    const height = 8;

    const pixels = await sharp(buffer)
        .resize(width, height, { fit: 'fill' })
        .grayscale()
        .raw()
        .toBuffer();

    let bits = '';
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width - 1; x++) {
            const left = pixels[y * width + x];
            const right = pixels[y * width + x + 1];
            bits += left > right ? '1' : '0';
        }
    }

    // 64 bits → 16 hex chars
    let hex = '';
    for (let i = 0; i < bits.length; i += 4) {
        hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    }
    return hex;
}