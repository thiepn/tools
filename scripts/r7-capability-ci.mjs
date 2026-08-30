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
    // before CI reaches the manual Stop Camera click. QR Studio correctly
    // auto-stops its stream on a successful decode, which removes that button.
    // Accept either valid cleanup path, but never accept a missing stop control
    // while a captured camera track is still live.
    const stopClicked = await evaluate(cdp, \`(() => {
      const button = [...document.querySelectorAll('button')]
        .find((node) => node.textContent?.replace(/\\\\s+/g, ' ').trim().includes('Stop Camera'));
      if (!button) return false;
      button.click();
      return true;
    })()\`);
    await waitFor(
      async () => {
        const state = await userStreamsState(cdp);
        return state.tracks.length > 0 && state.tracks.every((track) => track.readyState === 'ended');
      },
      stopClicked ? 'QR manual camera track cleanup' : 'QR automatic camera track cleanup after early decode',
      3_000
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
