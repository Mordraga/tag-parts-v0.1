// Downloads GeoNames cities15000 and outputs a compact JSON for offline reverse geocoding.
// Run once: node scripts/build-cities.mjs
// Output: src/data/cities.json

import { createWriteStream, createReadStream } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { pipeline } from 'stream/promises';
import { createInterface } from 'readline';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const ZIP_URL = 'https://download.geonames.org/export/dump/cities15000.zip';
const ZIP_PATH = join(ROOT, 'cities15000.zip');
const TXT_PATH = join(ROOT, 'cities15000.txt');
const OUT_PATH = join(ROOT, 'src', 'data', 'cities.json');

async function downloadFile(url, dest) {
  console.log(`Downloading ${url}…`);
  const res = await fetch(url, { headers: { 'User-Agent': 'InnerParts/build-script' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  await pipeline(res.body, createWriteStream(dest));
}

function unzipFile(zipPath, txtPath) {
  console.log('Extracting…');
  return new Promise((resolve, reject) => {
    const yauzl = require('yauzl');
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err) return reject(err);
      zipfile.readEntry();
      zipfile.on('entry', entry => {
        if (entry.fileName !== 'cities15000.txt') { zipfile.readEntry(); return; }
        zipfile.openReadStream(entry, (err, stream) => {
          if (err) return reject(err);
          const out = createWriteStream(txtPath);
          stream.pipe(out);
          out.on('finish', resolve);
          out.on('error', reject);
        });
      });
      zipfile.on('end', () => reject(new Error('cities15000.txt not found in zip')));
      zipfile.on('error', reject);
    });
  });
}

async function processFile(txtPath) {
  console.log('Processing…');
  const cities = [];
  const rl = createInterface({ input: createReadStream(txtPath), crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    const f = line.split('\t');
    // Fields: 0=geonameid, 1=name, 4=lat, 5=lng, 8=country, 10=admin1
    const name = f[1];
    const lat  = parseFloat(f[4]);
    const lng  = parseFloat(f[5]);
    const cc   = f[8];
    const a1   = f[10] || '';
    if (!name || isNaN(lat) || isNaN(lng)) continue;
    cities.push([name, parseFloat(lat.toFixed(2)), parseFloat(lng.toFixed(2)), cc, a1]);
  }

  console.log(`Writing ${cities.length} cities to ${OUT_PATH}…`);
  await mkdir(join(ROOT, 'src', 'data'), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(cities));
}

async function cleanup(...paths) {
  for (const p of paths) await unlink(p).catch(() => {});
}

(async () => {
  try {
    await downloadFile(ZIP_URL, ZIP_PATH);
    await unzipFile(ZIP_PATH, TXT_PATH);
    await processFile(TXT_PATH);
    await cleanup(ZIP_PATH, TXT_PATH);
    console.log('Done.');
  } catch (err) {
    await cleanup(ZIP_PATH, TXT_PATH);
    console.error('Failed:', err.message);
    process.exit(1);
  }
})();
