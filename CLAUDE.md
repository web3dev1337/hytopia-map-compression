# Hytopia Map Compression Guidelines

## 🚨 FIRST STEPS 🚨
```bash
git fetch origin master:master
git checkout -b feature/name master
# OR if master checked out elsewhere:
git fetch origin master && git checkout -b feature/name origin/master
```

**NEVER**: commit to master or skip PR creation
**CHECK**: If on existing branch, verify it matches your current task (check ai-memory folder)

## 🚨 READ THESE 🚨
1. CODEBASE_DOCUMENTATION.md
2. README.md and README-ADVANCED.md
3. src/core/MapCompression.ts - Main API entry point
4. src/types/index.ts - Type definitions

## Overview
High-performance map compression plugin for Hytopia that achieves 99.5% compression ratios with 50x faster loading times. The plugin provides zero-config operation with automatic optimization, hash-based caching, and self-cleaning cache management.

## Code Style
- TypeScript strict mode
- Functional composition with class-based organization
- Comprehensive JSDoc comments for public APIs
- Buffer operations for performance-critical sections
- Async/await for all I/O operations

## Testing
```bash
npm test              # Run all tests
npm run lint          # Check code style
npm run build         # Build the project
bun test-integrity.ts # Test compression integrity
```

## Commands
```bash
npm run dev           # Watch mode development
npm run build         # Build for production
npm run precompute    # Generate pre-computed chunks
bun benchmark-real-map.ts # Run performance benchmarks
```

## Architecture
- **3-Stage Compression Pipeline**: Delta → Varint → Brotli
- **Automatic Optimization**: Hash-based cache with pre-computed chunks
- **Loading Strategies**: Direct chunk loading, compressed loading, fallback chains
- **Zero-Config Design**: Convention over configuration with sensible defaults
- **Memory Efficient**: Streaming operations, batched processing

## Key Patterns
- **Singleton World Instance**: Plugin attaches to Hytopia world object
- **Strategy Pattern**: Multiple loading strategies with automatic selection
- **Pipeline Pattern**: Composable compression/decompression stages
- **Cache Invalidation**: Hash-based detection of map changes
- **Progressive Enhancement**: Automatic optimization on subsequent runs

## Gotchas
- **Memory Limits**: Large maps (>500MB) may require increased Node.js heap
- **First Run Slower**: Initial compression creates cache files (subsequent runs 50x faster)
- **Hash Collisions**: Uses SHA-256, practically impossible but cache can be manually cleared
- **Chunk Format**: Binary format is version-specific, regenerated on plugin updates
- **Brotli Dependency**: Native Node.js module, no external dependencies
- **File Conventions**: Expects maps in `./assets/` by default

## Performance Tips
- Use `quickLoad()` for automatic optimization
- Pre-compute chunks for production deployments
- Enable debug mode only during development
- Batch size affects memory vs speed tradeoff
- DirectChunkLoaderV3 is fastest for large maps