/**
 * Utility functions for barcode generation
 */

/**
 * Get Code128B character set and patterns
 * @returns {Object} Mapping of characters to binary patterns
 */
export const getCode128B = () => {
  return {
    ' ': '11011001100', '!': '11001101100', '"': '11001100110', '#': '10010011000',
    '$': '10010001100', '%': '10001001100', '&': '10011001000', "'": '10011000100',
    '(': '10001100100', ')': '11001001000', '*': '11001000100', '+': '11000100100',
    ',': '10110011100', '-': '10011011100', '.': '10011001110', '/': '10111001100',
    '0': '10011101100', '1': '10011100110', '2': '11001110010', '3': '11001011100',
    '4': '11001001110', '5': '11011100100', '6': '11001110100', '7': '11101101110',
    '8': '11101001100', '9': '11100101100', ':': '11100100110', ';': '11101100100',
    '<': '11100110100', '=': '11100110010', '>': '11011011000', '?': '11011000110',
    '@': '11000110110', 'A': '10100011000', 'B': '10001011000', 'C': '10001000110',
    'D': '10110001000', 'E': '10001101000', 'F': '10001100010', 'G': '11010001000',
    'H': '11000101000', 'I': '11000100010', 'J': '10110111000', 'K': '10110001110',
    'L': '10001101110', 'M': '10111011000', 'N': '10111000110', 'O': '10001110110',
    'P': '11101110110', 'Q': '11010001110', 'R': '11000101110', 'S': '11011101000',
    'T': '11011100010', 'U': '11011101110', 'V': '11101011000', 'W': '11101000110',
    'X': '11100010110', 'Y': '11101101000', 'Z': '11101100010', '[': '11100011010',
    '\\': '11101111010', ']': '11001000010', '^': '11110001010', '_': '10100110000',
    '`': '10100001100', 'a': '10010110000', 'b': '10010000110', 'c': '10000101100',
    'd': '10000100110', 'e': '10110010000', 'f': '10110000100', 'g': '10011010000',
    'h': '10011000010', 'i': '10000110100', 'j': '10000110010', 'k': '11000010010',
    'l': '11001010000', 'm': '11110111010', 'n': '11000010100', 'o': '10001111010',
    'p': '10100111100', 'q': '10010111100', 'r': '10010011110', 's': '10111100100',
    't': '10011110100', 'u': '10011110010', 'v': '11110100100', 'w': '11110010100',
    'x': '11110010010', 'y': '11011011110', 'z': '11011110110', '{': '11110110110',
    '|': '10101111000', '}': '10100011110', '~': '10001011110',
    // Control characters
    FNC1: '10100110010', FNC2: '10010110100', FNC3: '10010110010', FNC4: '10110101000',
    // Special pattern codes
    START_B: '11010010000', STOP: '1100011101011'
  };
};

/**
 * Get values table for Code128B (for proper checksum calculation)
 * @returns {Object} Mapping of characters to their values (0-102)
 */
export const getCode128Values = () => {
  // Create a map of characters to their Code128B values
  const chars = Object.keys(getCode128B()).filter(k => k.length === 1);
  const valueMap = {};
  
  // Assign proper numerical values to each character (important for checksum)
  chars.forEach((char, index) => {
    valueMap[char] = index;
  });
  
  // Add control codes with their proper values
  valueMap['START_B'] = 104;
  valueMap['FNC1'] = 102;
  valueMap['FNC2'] = 97;
  valueMap['FNC3'] = 96;
  valueMap['FNC4'] = 100;
  
  return valueMap;
};

/**
 * Calculate Code128 checksum accurately
 * @param {string} value - String value to calculate checksum for
 * @returns {number} Checksum value (0-102)
 */
export const calculateChecksum = (value) => {
  const valueMap = getCode128Values();
  let sum = valueMap['START_B']; // START_B value (104)
  
  for (let i = 0; i < value.length; i++) {
    const char = value.charAt(i);
    // Get proper value for this character
    const charValue = valueMap[char];
    if (charValue !== undefined) {
      sum += charValue * (i + 1);
    }
  }
  
  return sum % 103; // Modulo 103
};

/**
 * Get the character representing a specific checksum value
 * @param {number} checksumValue - Numeric checksum value (0-102)
 * @returns {string} Character representing this value in Code128B
 */
export const getChecksumChar = (checksumValue) => {
  const valueMap = getCode128Values();
  // Reverse lookup - find character with this value
  return Object.keys(valueMap).find(k => valueMap[k] === checksumValue) || ' ';
};

/**
 * Generate binary pattern for Code128B barcode
 * @param {string} value - Value to encode
 * @returns {string} Binary pattern string (1s and 0s)
 */
export const generateCode128 = (value) => {
  const patterns = getCode128B();
  
  // Validate input - only use characters in Code128B charset
  const validChars = Object.keys(patterns).filter(k => 
    k.length === 1 && k !== 'START_B' && k !== 'STOP');
  
  // Keep only valid characters
  const sanitizedValue = value.split('')
    .filter(char => validChars.includes(char))
    .join('');
  
  // Start with START_B pattern
  let bits = patterns.START_B;
  
  // Add pattern for each character
  for (let i = 0; i < sanitizedValue.length; i++) {
    const char = sanitizedValue[i];
    if (patterns[char]) {
      bits += patterns[char];
    }
  }
  
  // Calculate checksum correctly
  const checksum = calculateChecksum(sanitizedValue);
  
  // Get proper character for this checksum value
  const checksumChar = getChecksumChar(checksum);
  
  // Add checksum pattern
  if (patterns[checksumChar]) {
    bits += patterns[checksumChar];
  }
  
  // Add STOP pattern
  bits += patterns.STOP;
  
  // Add quiet zone (minimum 10 modules on each side for reliable scanning)
  // 10X is the minimum recommended by specification 
  const quietZone = '0'.repeat(20);
  bits = quietZone + bits + quietZone;
  
  return bits;
};

/**
 * Generate SVG for Code128 barcode (as string)
 * @param {string} text - Text to encode in barcode
 * @param {number} width - SVG width
 * @param {number} height - SVG height
 * @param {boolean} includeText - Whether to include human-readable text below barcode
 * @returns {string} SVG markup as string
 */
export const generateBarcodeSVG = (text, width = 200, height = 50, includeText = true) => {
  // Generate binary pattern
  const binaryPattern = generateCode128(text);
  
  // Calculate dimensions - ensure consistent precise module widths
  // We need to make sure each module has an exact pixel width
  const totalModules = binaryPattern.length;
  const moduleWidth = Math.max(1, Math.floor(width / totalModules)); // Ensure at least 1px per module
  
  // Recalculate width to ensure precise modules (important for scanner readability)
  const adjustedWidth = moduleWidth * totalModules;
  
  // Calculate total height including space for text if needed
  const textHeight = includeText ? 20 : 0;
  const totalHeight = height + textHeight;
  
  // Create SVG elements
  let rects = [];
  let xPos = 0;
  let inBar = false;
  let barStart = 0;
  
  // Generate rectangles from binary pattern
  for (let i = 0; i < binaryPattern.length; i++) {
    const bit = binaryPattern[i];
    
    if (bit === '1' && !inBar) {
      // Start of a bar
      inBar = true;
      barStart = xPos;
    } else if ((bit === '0' && inBar) || (bit === '1' && i === binaryPattern.length - 1)) {
      // End of a bar (or last position with a '1')
      inBar = false;
      const barWidth = xPos - barStart;
      if (bit === '1' && i === binaryPattern.length - 1) {
        // If we're ending on a '1', add the last module width
        rects.push(`<rect x="${barStart}" y="0" width="${barWidth + moduleWidth}" height="${height}" fill="black" />`);
      } else {
        rects.push(`<rect x="${barStart}" y="0" width="${barWidth}" height="${height}" fill="black" />`);
      }
    }
    
    xPos += moduleWidth;
  }
  
  // Add human-readable text if requested
  const textElement = includeText ? 
    `<text x="${adjustedWidth / 2}" y="${height + 15}" text-anchor="middle" font-family="monospace" font-size="11" fill="black">${text}</text>` : 
    '';
  
  // Create complete SVG with proper viewBox for exact sizing
  const svg = `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="${adjustedWidth}"
      height="${totalHeight}"
      viewBox="0 0 ${adjustedWidth} ${totalHeight}"
      preserveAspectRatio="none"
      shape-rendering="crispEdges"
    >
      <rect x="0" y="0" width="${adjustedWidth}" height="${totalHeight}" fill="white" />
      ${rects.join('')}
      ${textElement}
    </svg>
  `;
  
  return svg;
};

/**
 * Generate React component for Code128 barcode
 * @param {string} text - Text to encode in barcode 
 * @param {number} width - SVG width
 * @param {number} height - SVG height
 * @returns {React.Component} SVG component for rendering
 */
export const Code128 = ({ text, width = 200, height = 50 }) => {
  // Generate binary pattern
  const binaryPattern = generateCode128(text);
  
  // Calculate dimensions - ensure consistent precise module widths
  const totalModules = binaryPattern.length;
  const moduleWidth = Math.max(1, Math.floor(width / totalModules));
  const adjustedWidth = moduleWidth * totalModules;
  
  // Create bars array for rendering
  const bars = [];
  let xPos = 0;
  let inBar = false;
  let barStart = 0;
  
  // Generate rectangles from binary pattern
  for (let i = 0; i < binaryPattern.length; i++) {
    const bit = binaryPattern[i];
    
    if (bit === '1' && !inBar) {
      inBar = true;
      barStart = xPos;
    } else if ((bit === '0' && inBar) || (bit === '1' && i === binaryPattern.length - 1)) {
      inBar = false;
      const barWidth = xPos - barStart;
      if (bit === '1' && i === binaryPattern.length - 1) {
        bars.push({
          x: barStart,
          width: barWidth + moduleWidth,
          key: `bar-${i}`
        });
      } else {
        bars.push({
          x: barStart,
          width: barWidth,
          key: `bar-${i}`
        });
      }
    }
    
    xPos += moduleWidth;
  }
  
  return {
    adjustedWidth,
    height,
    bars
  };
};

/**
 * Generate a unique reference ID for boxes
 * @param {number} boxNumber - Box number
 * @returns {string} Reference ID in format BOX-0000-000000
 */
export const generateBoxReference = (boxNumber) => {
  const prefix = 'BOX';
  const boxNum = boxNumber ? boxNumber.toString().padStart(4, '0') : '0000';
  const randomCode = Math.floor(Math.random() * 900000 + 100000).toString();
  
  return `${prefix}-${boxNum}-${randomCode}`;
};

export default {
  getCode128B,
  getCode128Values,
  calculateChecksum,
  getChecksumChar,
  generateCode128,
  generateBarcodeSVG,
  Code128,
  generateBoxReference
}; 