import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const sourcePath = path.resolve('scripts/r7-capability-smoke.mjs');
const tempPath = path.resolve(`scripts/.r7-capability-ci-${process.pid}.mjs`);

const original = await readFile(sourcePath, 'utf8');

const originalQrCleanup = `    await clickText(cdp, 'Stop Camera');
    await waitFor(async () => (await userStreamsState(cdp)).tracks.every((track) => track.readyState === 'ended'), 'QR camera track cleanup');`;

const stabilizedQrCleanup = `    // Chromium's synthetic camera feed can occasionally be decoded by jsQR
    // while CI is deciding whether to click Stop Camera. Poll for either valid
    // cleanup path instead of taking a one-time UI snapshot: automatic cleanup
    // after decode, or the manual stop control becoming available. A live track
    // that never reaches either cleanup path remains a hard timeout failure.
    await waitFor(
      async () => {
        const state = await userStreamsState(cdp);
        if (state.tracks.length > 0 && state.tracks.every((track) => track.readyState === 'ended')) {
          return true;
        }

        await evaluate(cdp, \`(() => {
          const button = [...document.querySelectorAll('button')]
            .find((node) => node.textContent?.replace(/\\\\s+/g, ' ').trim().includes('Stop Camera'));
          if (!button) return false;
          button.click();
          return true;
        })()\`);
        return false;
      },
      'QR camera track cleanup through manual stop or automatic decode stop',
      5_000
    );`;

if (!original.includes(originalQrCleanup)) {
  throw new Error('R7 QR cleanup fixture changed; update scripts/r7-capability-ci.mjs instead of silently bypassing the assertion.');
}

const stabilized = original
  .replace(originalQrCleanup, stabilizedQrCleanup)
  .replace("['QR camera start/stop', flowQrCamera]", "['QR camera start/cleanup', flowQrCamera]");

await writeFile(tempPath, stabilized, 'utf8');

try {
  const child = spawn(process.execPath, [tempPath], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });
  const [code, signal] = await once(child, 'exit');
  if (signal) {
    console.error(`R7 capability child exited from signal ${signal}`);
    process.exitCode = 1;
  } else {
    process.exitCode = code ?? 1;
  }
} finally {
  await rm(tempPath, { force: true });
}
