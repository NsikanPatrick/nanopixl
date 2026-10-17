import { createHash } from 'crypto';

/**
 * Answers the question: "Has this user already uploaded this exact image file?"
 * If yes, dont upload again. Nb: Just a slight cropping will make the image different
 * Compute a SHA-256 hash of every file bytes uploaded.
 * Deterministic: the same file always produces the same hash. 
 * * Returns a 64-character hex string.
 * i.e Checks files byte-for-byte to see if they're identical. The problem however
 * is that even a slight crop in the second image will produce a diff hash(sha256),
 * hence 2 images can be seen as diff even when they're actually the same.
 */
export function computeFileHash(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
}