// Writes latest.json for the updater: which version is newest, where to download it and its signature.
// The release workflow runs it on the collected downloads. Usage: node scripts/updater-manifest.ts <folder> <tag>
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [dir, tag] = process.argv.slice(2);
if (!dir || !tag) throw new Error('Usage: node scripts/updater-manifest.ts <folder> <tag>');
const version = tag.replace(/^v/, '');
const base = `https://github.com/VR0EM/Pixling/releases/download/${tag}`;

/** The download and its signature, if this platform was built. */
const entry = (file: string) => {
  const sig = join(dir, `${file}.sig`);
  return existsSync(sig) ? { signature: readFileSync(sig, 'utf8').trim(), url: `${base}/${file}` } : null;
};

const platforms: Record<string, { signature: string; url: string }> = {};
// One universal app for Apple Silicon and Intel.
const mac = entry('Pixling-mac.app.tar.gz');
if (mac) platforms['darwin-aarch64'] = platforms['darwin-x86_64'] = mac;
const windows = entry('Pixling-windows-setup.exe');
if (windows) platforms['windows-x86_64'] = windows;
if (!Object.keys(platforms).length) throw new Error(`No signed updates found in ${dir}.`);

const manifest = { version, notes: `Pixling ${version}`, pub_date: new Date().toISOString(), platforms };
writeFileSync(join(dir, 'latest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`latest.json for ${version}: ${Object.keys(platforms).join(', ')}`);
