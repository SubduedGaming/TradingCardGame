#!/usr/bin/env node
// Generates card art through a ComfyUI server using the Z-Image Turbo workflow.
// Usage: node tools/generate-art.mjs <prompts.json> [--host http://192.168.1.70:8188] [--only id,id] [--force] [--variant N]
// --variant N re-rolls the seed (default 0) for cards whose first result is unusable.
// Output: assets/<set>/<card id>.webp (skipped when it already exists unless --force).
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const promptsPath = args.find((a) => !a.startsWith('--'));
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
if (!promptsPath) {
  console.error('usage: generate-art.mjs <prompts.json> [--host URL] [--only ids] [--force]');
  process.exit(2);
}
const host = flag('host', 'http://192.168.1.70:8188');
const only = flag('only', '')?.split(',').filter(Boolean) ?? [];
const force = args.includes('--force');
const variant = Number(flag('variant', '0'));

const style = JSON.parse(readFileSync(join(root, 'art/style.json'), 'utf8'));
const prompts = JSON.parse(readFileSync(promptsPath, 'utf8'));

/** Deterministic seed per card, so a card's art can be regenerated identically. */
const seedFor = (id) =>
  Number(BigInt('0x' + createHash('sha256').update(variant ? `${id}#${variant}` : id).digest('hex').slice(0, 12)));

function workflow(text, seed, prefix) {
  return {
    1: { class_type: 'UNETLoader', inputs: { unet_name: style.model, weight_dtype: 'default' } },
    2: { class_type: 'CLIPLoader', inputs: { clip_name: style.textEncoder, type: 'lumina2', device: 'default' } },
    3: { class_type: 'VAELoader', inputs: { vae_name: style.vae } },
    4: { class_type: 'CLIPTextEncode', inputs: { text, clip: ['2', 0] } },
    5: { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['4', 0] } },
    6: { class_type: 'EmptySD3LatentImage', inputs: { width: style.width, height: style.height, batch_size: 1 } },
    7: { class_type: 'ModelSamplingAuraFlow', inputs: { model: ['1', 0], shift: 3 } },
    8: {
      class_type: 'KSampler',
      inputs: {
        model: ['7', 0], positive: ['4', 0], negative: ['5', 0], latent_image: ['6', 0],
        seed, steps: style.steps, cfg: 1, sampler_name: 'res_multistep', scheduler: 'simple', denoise: 1,
      },
    },
    9: { class_type: 'VAEDecode', inputs: { samples: ['8', 0], vae: ['3', 0] } },
    10: { class_type: 'SaveImage', inputs: { images: ['9', 0], filename_prefix: prefix } },
  };
}

/** Records how each image was made (art/provenance.json), so a result can be traced and re-rolled. */
function recordProvenance(id, text) {
  const file = join(root, 'art/provenance.json');
  const all = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  all[id] = {
    variant,
    seed: seedFor(id),
    model: style.model,
    styleHash: createHash('sha256').update(style.prefix + style.suffix).digest('hex').slice(0, 10),
    promptHash: createHash('sha256').update(text).digest('hex').slice(0, 10),
  };
  const sorted = Object.fromEntries(Object.entries(all).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(file, JSON.stringify(sorted, null, 2) + '\n');
}

async function api(path, init) {
  const res = await fetch(host + path, init);
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}: ${await res.text()}`);
  return res;
}

async function generate(id, text) {
  const outDir = join(root, 'assets', id.split('.')[0]);
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, `${id}.webp`);
  if (existsSync(out) && !force) return { id, skipped: true };

  const t0 = Date.now();
  const full = `${style.prefix}${text}${style.suffix}`;
  const body = JSON.stringify({ prompt: workflow(full, seedFor(id), `cards/${id}`) });
  const { prompt_id: promptId, node_errors: nodeErrors } = await (
    await api('/prompt', { method: 'POST', headers: { 'content-type': 'application/json' }, body })
  ).json();
  if (nodeErrors && Object.keys(nodeErrors).length) throw new Error(JSON.stringify(nodeErrors));

  let image;
  for (let i = 0; i < 600 && !image; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const hist = await (await api(`/history/${promptId}`)).json();
    const entry = hist[promptId];
    if (entry?.status?.status_str === 'error') throw new Error(`generation failed: ${JSON.stringify(entry.status)}`);
    image = entry?.outputs?.['10']?.images?.[0];
  }
  if (!image) throw new Error(`timed out waiting for ${id}`);

  const q = new URLSearchParams({ filename: image.filename, subfolder: image.subfolder, type: image.type });
  const png = Buffer.from(await (await api(`/view?${q}`)).arrayBuffer());
  const tmp = join(root, `.tmp-${process.pid}.png`);
  writeFileSync(tmp, png);
  try {
    // The model sometimes paints a white frame around the picture; trim it before converting.
    execFileSync('python3', ['-I', join(root, 'tools/trim_border.py'), tmp]);
    execFileSync('cwebp', ['-quiet', '-q', '86', tmp, '-o', out]);
  } finally {
    rmSync(tmp, { force: true });
  }
  recordProvenance(id, text);
  return { id, seconds: (Date.now() - t0) / 1000 };
}

const ids = Object.keys(prompts).filter((id) => only.length === 0 || only.includes(id));
let done = 0;
for (const id of ids) {
  try {
    const r = await generate(id, prompts[id]);
    done++;
    console.log(r.skipped ? `skip  ${id}` : `ok    ${id}  ${r.seconds.toFixed(1)}s  (${done}/${ids.length})`);
  } catch (e) {
    console.error(`FAIL  ${id}: ${e.message}`);
    process.exitCode = 1;
  }
}
