/**
 * Simplest usage of hytopia-map-compression plugin
 * Zero configuration required!
 */

import { MapCompression } from 'hytopia-map-compression';

// Option 1: Ultra-simple one-liner (convention over configuration)
// This automatically handles EVERYTHING:
// - Looks for ./assets/map.json
// - Creates compressed version on first run
// - Uses compressed version on subsequent runs
// - Creates pre-computed chunks for ultra-fast loading
// - Detects map changes via hash and re-compresses automatically
await MapCompression.quickLoad(world);

// Option 2: Simple instance with auto-loading
const mapCompression = new MapCompression(world);
await mapCompression.autoLoad(); // Uses ./assets/map.json by default

// Option 3: Custom map path
const mapCompression = new MapCompression(world);
await mapCompression.autoLoad('./maps/my-custom-map.json');

// Option 4: With custom config file
const mapCompression = new MapCompression(world);
await mapCompression.autoLoad('./assets/map.json', './config/my-config.yaml');

// That's it! The plugin handles everything else automatically:
// 
// First run (creates everything at once):
// 1. Loads original map.json
// 2. Creates map.<hash>.compressed.json (99.5% smaller)
// 3. Creates map.<hash>.chunks.bin (pre-computed chunks)
// 4. Both caches ready for next run!
//
// All subsequent runs:
// 1. Checks if map.json has changed (via hash)
// 2. If unchanged, loads from ultra-fast chunks (50x faster!)
// 3. If changed, creates new caches with new hash
//
// Old cache files are automatically cleaned up!