// Loudness with ffmpeg (docs/SOUND_PLAN.md: effects about −16 LUFS, voices
// −19, music −23, peaks ≤ −3 dBTP). Short clips (under ~0.4 s) have no
// integrated loudness; they are matched by their true peak instead.
import { spawnSync } from 'node:child_process';

/** Integrated loudness (LUFS) and true peak (dBTP) of a file. */
export function measure(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'loudnorm=print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
  const block = /\{[^{}]*"input_i"[^{}]*\}/.exec(r.stderr);
  if (!block) throw new Error(`no loudness for ${file}: ${r.stderr.slice(-300)}`);
  const json = JSON.parse(block[0]);
  return { lufs: Number(json.input_i), peak: Number(json.input_tp) };
}

/**
 * Gain `input` to `lufs` (a limiter keeps peaks at `peak` dBTP) and encode it:
 * `mono` folds to one channel; `codec` 'mp3' or 'aac' (.m4a) at `kbps`;
 * `trim` cuts silence at both ends.
 */
export function normalize(input, output, { lufs, peak = -3, mono = false, codec = 'mp3', kbps = 128, trim = false }) {
  const m = measure(input);
  const gain = Number.isFinite(m.lufs) && m.lufs > -70 ? lufs - m.lufs : peak - m.peak;
  const limit = Math.pow(10, peak / 20).toFixed(4);
  // `trim`: cut silence at both ends (clips start on the beat and download less), with tiny fades.
  const cut = 'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.02';
  const ends = trim ? `${cut},areverse,${cut},areverse,afade=t=in:d=0.005,` : '';
  const args = ['-hide_banner', '-loglevel', 'error', '-y', '-i', input, '-af', `${ends}volume=${gain.toFixed(2)}dB,alimiter=limit=${limit}:level=false:latency=true`];
  if (mono) args.push('-ac', '1');
  args.push(...(codec === 'aac' ? ['-c:a', 'aac', '-b:a', `${kbps}k`, '-movflags', '+faststart'] : ['-c:a', 'libmp3lame', '-b:a', `${kbps}k`]), output);
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffmpeg failed on ${input}: ${r.stderr}`);
  return { ...m, gain };
}
