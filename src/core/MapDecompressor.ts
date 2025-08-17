import { VarintEncoder } from '../encoders/VarintEncoder';
import { DeltaEncoder } from '../encoders/DeltaEncoder';
import { BrotliWrapper } from '../encoders/BrotliWrapper';
import { DecompressionResult, CompressedMapData, MapCompressionOptions } from '../types';

/**
 * Map decompression engine
 * Decompresses maps in ~20ms for 6.5M blocks
 */
export class MapDecompressor {
  private options: MapCompressionOptions;
  
  constructor(options: MapCompressionOptions = {}) {
    this.options = options;
  }
  
  /**
   * Decompress map data
   */
  async decompress(compressedData: CompressedMapData): Promise<DecompressionResult> {
    const startTime = Date.now();
    
    if (!compressedData.version || !compressedData.data || !compressedData.blockTypes) {
      throw new Error('Invalid compressed map format');
    }
    
    if (this.options.debug) {
      console.log('[MapDecompressor] Starting decompression...');
      console.log(`[MapDecompressor] Compressed size: ${(compressedData.data.length / 1024).toFixed(2)} KB`);
    }
    
    // Step 1: Brotli decompression
    const brotliStart = Date.now();
    const decompressed = await BrotliWrapper.decompressFromBase64(
      compressedData.data,
      compressedData.algorithm as 'brotli' | 'gzip' | 'none'
    );
    
    if (this.options.debug) {
      console.log(`[MapDecompressor] Brotli decompression: ${Date.now() - brotliStart}ms`);
    }
    
    // Step 2: Decode based on compression options
    let blocks: { [key: string]: number };
    
    if (compressedData.options?.useDelta && compressedData.options?.useVarint) {
      // Full pipeline: Varint + Delta
      const varintStart = Date.now();
      blocks = this.decodeVarintDelta(decompressed, compressedData);
      
      if (this.options.debug) {
        console.log(`[MapDecompressor] Varint + Delta decoding: ${Date.now() - varintStart}ms`);
      }
    } else if (compressedData.options?.useDelta) {
      // Delta only
      blocks = this.decodeDeltaOnly(decompressed);
    } else {
      // Direct encoding
      blocks = this.decodeDirect(decompressed);
    }
    
    const decompressionTime = Date.now() - startTime;
    
    if (this.options.debug || this.options.metrics) {
      console.log(`[MapDecompressor] Decompression complete:`);
      console.log(`  Blocks: ${Object.keys(blocks).length}`);
      console.log(`  Time: ${decompressionTime}ms`);
    }
    
    return {
      blocks,
      blockTypes: compressedData.blockTypes,
      entities: compressedData.entities,
      version: compressedData.mapVersion,
      metadata: {
        decompressionTime,
        blockCount: Object.keys(blocks).length
      }
    };
  }
  
  /**
   * Decode Varint + Delta encoded data
   */
  private decodeVarintDelta(buffer: Buffer, compressedData: CompressedMapData): { [key: string]: number } {
    let offset = 0;
    
    // Read block count
    const blockCount = buffer.readUInt32LE(offset);
    offset += 4;
    
    // Read RLE flag
    const isRLE = buffer[offset] === 1;
    offset += 1;
    
    // Read delta buffer size (we need to know where it ends)
    // Since we don't store it, we'll read both arrays from the remaining buffer
    const remaining = buffer.slice(offset);
    
    // Decode deltas (3 values per block)
    const deltaCount = blockCount * 3;
    let deltaOffset = 0;
    const deltas: number[] = new Array(deltaCount);
    
    for (let i = 0; i < deltaCount; i++) {
      const result = VarintEncoder.readVarintFast(remaining, deltaOffset);
      deltas[i] = VarintEncoder.decodeZigzag(result.value);
      deltaOffset = result.offset;
    }
    
    // Decode block IDs from remaining buffer
    const blockIdBuffer = remaining.slice(deltaOffset);
    const encodedBlockIds = VarintEncoder.decodeArray(blockIdBuffer);
    
    // Decode RLE if needed
    const blockIds = DeltaEncoder.decodeBlockIds(encodedBlockIds, isRLE);
    
    // Reconstruct blocks using delta decoding
    return DeltaEncoder.decodePositions(deltas, blockIds, compressedData.bounds);
  }
  
  /**
   * Fast varint + delta decoder with optimizations
   */
  decodeVarintDeltaFast(buffer: Buffer, compressedData: CompressedMapData): { [key: string]: number } {
    let offset = 0;
    const blockCount = buffer.readUInt32LE(offset);
    offset += 4;
    
    const isRLE = buffer[offset] === 1;
    offset += 1;
    
    // Pre-allocate result
    const blocks: { [key: string]: number } = Object.create(null);
    
    // String pool for coordinate keys
    const stringPool = new Map<number, string>();
    const getPooledString = (x: number, y: number, z: number): string => {
      const hash = x * 10000000 + y * 10000 + z;
      let str = stringPool.get(hash);
      if (!str) {
        str = `${x},${y},${z}`;
        if (stringPool.size < 100000) {
          stringPool.set(hash, str);
        }
      }
      return str;
    };
    
    let lastX = 0, lastY = 0, lastZ = 0;
    
    // Fast inline decoding
    for (let i = 0; i < blockCount; i++) {
      // Decode X delta
      let v = 0, s = 0, b = 0;
      do { b = buffer[offset++]; v |= (b & 0x7F) << s; s += 7; } while (b & 0x80);
      lastX += (v >>> 1) ^ -(v & 1);
      
      // Decode Y delta
      v = 0; s = 0;
      do { b = buffer[offset++]; v |= (b & 0x7F) << s; s += 7; } while (b & 0x80);
      lastY += (v >>> 1) ^ -(v & 1);
      
      // Decode Z delta
      v = 0; s = 0;
      do { b = buffer[offset++]; v |= (b & 0x7F) << s; s += 7; } while (b & 0x80);
      lastZ += (v >>> 1) ^ -(v & 1);
      
      // Decode block ID
      v = 0; s = 0;
      do { b = buffer[offset++]; v |= (b & 0x7F) << s; s += 7; } while (b & 0x80);
      const blockId = (v >>> 1) ^ -(v & 1);
      
      // Store block
      const key = getPooledString(lastX, lastY, lastZ);
      blocks[key] = blockId;
    }
    
    return blocks;
  }
  
  /**
   * Decode delta-only encoded data
   */
  private decodeDeltaOnly(buffer: Buffer): { [key: string]: number } {
    const int32Array = new Int32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
    const blockCount = int32Array.length / 4;
    
    const deltas: number[] = [];
    const blockIds: number[] = [];
    
    for (let i = 0; i < blockCount; i++) {
      deltas.push(int32Array[i * 4]);
      deltas.push(int32Array[i * 4 + 1]);
      deltas.push(int32Array[i * 4 + 2]);
      blockIds.push(int32Array[i * 4 + 3]);
    }
    
    return DeltaEncoder.decodePositions(deltas, blockIds);
  }
  
  /**
   * Decode directly encoded data
   */
  private decodeDirect(buffer: Buffer): { [key: string]: number } {
    const int32Array = new Int32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
    const blocks: { [key: string]: number } = {};
    
    for (let i = 0; i < int32Array.length; i += 4) {
      const x = int32Array[i];
      const y = int32Array[i + 1];
      const z = int32Array[i + 2];
      const id = int32Array[i + 3];
      blocks[`${x},${y},${z}`] = id;
    }
    
    return blocks;
  }
}