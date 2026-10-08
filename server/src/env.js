// Load server/.env (if present) before anything reads process.env.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const file = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env');
if (fs.existsSync(file)) process.loadEnvFile(file);
