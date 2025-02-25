import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Generate a version timestamp
const timestamp = Date.now();

// Write to version.txt
const versionPath = path.join(__dirname, '..', 'public', 'version.txt');
fs.writeFileSync(versionPath, timestamp.toString());

// Also update version.json for compatibility
const jsonPath = path.join(__dirname, '..', 'public', 'version.json');
const version = {
  version: timestamp.toString(),
  buildDate: new Date().toISOString()
};
fs.writeFileSync(jsonPath, JSON.stringify(version, null, 2));

console.log(`Version updated to: ${timestamp}`);
