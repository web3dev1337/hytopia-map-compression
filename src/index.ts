export { MapCompression } from './core/MapCompression';
export { MapCompressor } from './core/MapCompressor';
export { MapDecompressor } from './core/MapDecompressor';
export { FastLoader } from './optimization/FastLoader';
export { MonkeyPatchLoader } from './optimization/MonkeyPatchLoader';
export { DirectChunkLoader } from './optimization/DirectChunkLoader';

export type {
  MapCompressionOptions,
  CompressionResult,
  DecompressionResult,
  PerformanceMetrics
} from './types';