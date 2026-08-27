import { copyFile, mkdir, readFile } from 'node:fs/promises';

await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
const source = new URL('../src/db/schema.sql', import.meta.url);
const destination = new URL('../dist/schema.sql', import.meta.url);
if (process.argv.includes('--check')) {
    const [expected, actual] = await Promise.all([readFile(source), readFile(destination)]);
    if (!expected.equals(actual)) throw new Error('dist/schema.sql is not synchronized with src/db/schema.sql');
} else {
    await copyFile(source, destination);
}
