import packageJson from '../../package.json' with { type: 'json' };
import { normalizeVersion } from './updateChecker.js';

const packageVersion = normalizeVersion(packageJson.version);
if (!packageVersion) throw new Error(`backend/package.json contains an invalid release version: ${packageJson.version}`);

/** The backend package version is the release version source of truth. */
export const APP_VERSION = packageVersion;
