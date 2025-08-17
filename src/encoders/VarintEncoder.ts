/**
 * Variable-length integer encoding/decoding
 * Small numbers use fewer bytes (1-5 bytes depending on value)
 */
export class VarintEncoder {
  /**
   * Encode a signed integer using zigzag encoding + varint
   */
  static encodeZigzag(value: number): number {
    return (value << 1) ^ (value >> 31);
  }
  
  /**
   * Decode a zigzag encoded varint back to signed integer
   */
  static decodeZigzag(value: number): number {
    return (value >>> 1) ^ -(value & 1);
  }
  
  /**
   * Write a varint to a buffer (returns new offset like working version)
   */
  static writeVarint(buffer: Buffer, offset: number, value: number): number {
    while ((value & ~0x7F) !== 0) {
      buffer[offset++] = (value & 0x7F) | 0x80;
      value >>>= 7;
    }
    
    buffer[offset++] = value & 0x7F;
    return offset; // Return the NEW offset, not bytes written
  }
  
  /**
   * Write a signed varint with zigzag encoding (matches working version exactly)
   */
  static writeSignedVarint(buffer: Buffer, offset: number, value: number): number {
    // Zigzag encode first
    value = (value << 1) ^ (value >> 31);
    
    // Then write as varint
    while (value > 0x7F) {
      buffer[offset++] = (value & 0x7F) | 0x80;
      value >>>= 7;
    }
    buffer[offset++] = value & 0x7F;
    
    return offset;
  }
  
  /**
   * Read a varint from a buffer
   */
  static readVarint(buffer: Buffer, offset: number): { value: number; bytesRead: number } {
    let value = 0;
    let shift = 0;
    let bytesRead = 0;
    let byte: number;
    
    do {
      byte = buffer[offset + bytesRead];
      value |= (byte & 0x7F) << shift;
      shift += 7;
      bytesRead++;
    } while (byte & 0x80);
    
    return { value, bytesRead };
  }
  
  /**
   * Encode an array of signed integers
   */
  static encodeArray(values: number[]): Buffer {
    // Estimate max size (5 bytes per value worst case)
    const buffer = Buffer.allocUnsafe(values.length * 5 + 4);
    let offset = 0;
    
    // Write count
    offset += this.writeVarint(buffer, offset, values.length);
    
    // Write values
    for (const value of values) {
      const zigzag = this.encodeZigzag(value);
      offset += this.writeVarint(buffer, offset, zigzag);
    }
    
    return buffer.slice(0, offset);
  }
  
  /**
   * Decode an array of signed integers
   */
  static decodeArray(buffer: Buffer): number[] {
    let offset = 0;
    
    // Read count
    const { value: count, bytesRead } = this.readVarint(buffer, offset);
    offset += bytesRead;
    
    const values: number[] = new Array(count);
    
    // Read values
    for (let i = 0; i < count; i++) {
      const { value: zigzag, bytesRead } = this.readVarint(buffer, offset);
      offset += bytesRead;
      values[i] = this.decodeZigzag(zigzag);
    }
    
    return values;
  }
  
  /**
   * Fast inline varint reading (optimized for performance)
   */
  static readVarintFast(buffer: Buffer, offset: number): { value: number; offset: number } {
    let v = 0, s = 0, b = 0;
    
    do {
      b = buffer[offset++];
      v |= (b & 0x7F) << s;
      s += 7;
    } while (b & 0x80);
    
    return { value: v, offset };
  }
}