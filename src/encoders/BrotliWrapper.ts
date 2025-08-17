import * as zlib from 'zlib';
import { promisify } from 'util';

const brotliCompress = promisify(zlib.brotliCompress);
const brotliDecompress = promisify(zlib.brotliDecompress);
const gzipCompress = promisify(zlib.gzip);
const gzipDecompress = promisify(zlib.gunzip);

/**
 * Wrapper for Brotli and Gzip compression
 * Brotli achieves 20-30% better compression than gzip
 */
export class BrotliWrapper {
  /**
   * Compress data using Brotli algorithm
   */
  static async compress(
    data: Buffer,
    options?: {
      algorithm?: 'brotli' | 'gzip' | 'none';
      level?: number;
    }
  ): Promise<Buffer> {
    const algorithm = options?.algorithm || 'brotli';
    const level = options?.level || 9; // Maximum compression by default
    
    if (algorithm === 'none') {
      return data;
    }
    
    if (algorithm === 'gzip') {
      return gzipCompress(data, { level });
    }
    
    // Brotli compression
    return brotliCompress(data, {
      params: {
        [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_GENERIC,
        [zlib.constants.BROTLI_PARAM_QUALITY]: level,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.length,
      }
    });
  }
  
  /**
   * Decompress data
   */
  static async decompress(
    data: Buffer,
    algorithm: 'brotli' | 'gzip' | 'none' = 'brotli'
  ): Promise<Buffer> {
    if (algorithm === 'none') {
      return data;
    }
    
    if (algorithm === 'gzip') {
      return gzipDecompress(data);
    }
    
    return brotliDecompress(data);
  }
  
  /**
   * Compress to base64 string (for JSON storage)
   */
  static async compressToBase64(
    data: Buffer,
    options?: {
      algorithm?: 'brotli' | 'gzip' | 'none';
      level?: number;
    }
  ): Promise<string> {
    const compressed = await this.compress(data, options);
    return compressed.toString('base64');
  }
  
  /**
   * Decompress from base64 string
   */
  static async decompressFromBase64(
    base64: string,
    algorithm: 'brotli' | 'gzip' | 'none' = 'brotli'
  ): Promise<Buffer> {
    const buffer = Buffer.from(base64, 'base64');
    return this.decompress(buffer, algorithm);
  }
  
  /**
   * Calculate compression ratio
   */
  static calculateRatio(originalSize: number, compressedSize: number): number {
    return 1 - (compressedSize / originalSize);
  }
  
  /**
   * Format compression ratio as percentage
   */
  static formatRatio(ratio: number): string {
    return `${(ratio * 100).toFixed(1)}%`;
  }
}