export interface MapCompressionOptions {
  features?: {
    compression?: boolean;
    decompression?: boolean;
    fastLoading?: boolean;
    monkeyPatching?: boolean;
  };
  
  compression?: {
    algorithm?: 'brotli' | 'gzip' | 'none';
    level?: number; // 1-9
    chunkSize?: number;
    useDelta?: boolean;
    useVarint?: boolean;
  };
  
  optimization?: {
    enabled?: boolean;
    monkeyPatch?: boolean;
    useChunks?: boolean;
    batchSize?: number;
    preParseCoordinates?: boolean;
  };
  
  loading?: {
    method?: 'default' | 'chunks' | 'monkeypatch' | 'hybrid';
    batchSize?: number;
    parallelChunks?: number;
    cacheStrategy?: 'none' | 'memory' | 'disk';
  };
  
  performance?: {
    maxMemory?: number;
    cacheCompressed?: boolean;
    reportMetrics?: boolean;
  };
  
  paths?: {
    mapFile?: string;
    compressedMap?: string;
    precomputedChunks?: string;
  };
  autoLoad?: {
    enabled?: boolean;
    createCache?: boolean;
    preferChunks?: boolean;
    fallbackToOriginal?: boolean;
    useHashInFilename?: boolean;  // Add hash to compressed filename
  };
  debug?: boolean;
  metrics?: boolean;
  logger?: (msg: string) => void;
  configFile?: string;  // Path to custom config file
}

export interface CompressionResult {
  data: Buffer | string;
  metadata: {
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    blockCount: number;
    entityCount?: number;
    compressionTime: number;
  };
  blockTypes: { [key: string]: number };
  bounds: {
    minX: number;
    minY: number;
    minZ: number;
    maxX: number;
    maxY: number;
    maxZ: number;
  };
  version: string;
}

export interface DecompressionResult {
  blocks: { [key: string]: number };
  blockTypes: { [key: string]: number };
  entities?: any;
  version?: string;
  metadata?: {
    decompressionTime: number;
    blockCount: number;
  };
}

export interface PerformanceMetrics {
  compressionRatio?: number;
  compressionTimeMs?: number;
  decompressionTimeMs?: number;
  loadTimeMs?: number;
  blocksLoaded?: number;
  method?: string;
  memoryUsedMB?: number;
}

export interface MapData {
  blocks: { [key: string]: number };
  blockTypes?: { [key: string]: number };
  entities?: any;
  version?: string;
}

export interface CompressedMapData {
  version: string;
  algorithm: string;
  data: string; // Base64 encoded
  blockTypes: any; // Can be array or object
  bounds: {
    minX: number;
    minY: number;
    minZ: number;
    maxX: number;
    maxY: number;
    maxZ: number;
  };
  entities?: any;
  mapVersion?: string;
  metadata?: {
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    blockCount: number;
  };
  options?: {
    useDelta?: boolean;
    useVarint?: boolean;
  };
  sourceHash?: string;  // Hash of original map file
}