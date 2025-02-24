import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const versionPath = path.join(__dirname, '..', 'public', 'version.json');
const version = {
  version: Date.now().toString()
};

fs.writeFileSync(versionPath, JSON.stringify(version, null, 2));
