// cohub-task.mjs — submit a `cohub generate` task asynchronously, poll it, download the output.
//
// Synchronous `cohub generate` can block for minutes on edit-mode image models even when the task
// itself finished in seconds. Always submit with --async and poll `cohub tasks get`.
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

function run(cmd, args, { timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 32 * 1024 * 1024, timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) { error.stdout = stdout; error.stderr = stderr; reject(error); return; }
      resolve(stdout);
    });
  });
}

function parseJson(text) {
  const start = text.indexOf('{');
  if (start < 0) throw new Error(`no JSON in cohub output: ${text.slice(0, 300)}`);
  return JSON.parse(text.slice(start));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * @param {object} o
 * @param {string} o.model           e.g. 'qwen-image-2.1', 'birefnet-general'
 * @param {string} o.prompt
 * @param {string[]} [o.images]      https URLs or local paths (local paths are uploaded by the CLI)
 * @param {object} [o.params]        generation parameters, passed as --param key=value
 * @param {number} [o.pollMs]
 * @param {number} [o.timeoutMs]     overall wait for the task
 * @returns {Promise<{taskRunId:string,url:string,cost:number|null}>}
 */
export async function generate({ model, prompt, images = [], params = {}, pollMs = 4000, timeoutMs = 8 * 60 * 1000 }) {
  const args = ['generate', prompt, '-m', model, '--async', '--json'];
  for (const image of images) args.push('--image', image);
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') args.push('--param', `${key}=${value}`);
  const submitted = parseJson(await run('cohub', args));
  const id = submitted.taskRunId;
  if (!id) throw new Error(`cohub generate returned no taskRunId: ${JSON.stringify(submitted).slice(0, 300)}`);
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    await sleep(pollMs);
    let info;
    try { info = parseJson(await run('cohub', ['tasks', 'get', id, '--json'])).run; }
    catch (error) { if (Date.now() > deadline) throw error; continue; }
    const status = info?.status;
    if (status === 'completed') {
      const output = info.result?.output || [];
      const url = output.find(o => o?.source?.url)?.source?.url;
      if (!url) throw Object.assign(new Error(`task ${id} completed without an output URL`), { taskRunId: id });
      return { taskRunId: id, url, cost: info.result?.cost ?? null };
    }
    if (status === 'failed' || status === 'cancelled' || status === 'canceled') {
      const reason = info.error || info.result?.error || info.errorMessage || status;
      throw Object.assign(new Error(`task ${id} ${status}: ${typeof reason === 'string' ? reason : JSON.stringify(reason).slice(0, 400)}`), { taskRunId: id });
    }
    if (Date.now() > deadline) throw Object.assign(new Error(`task ${id} still ${status} after ${Math.round(timeoutMs / 1000)}s`), { taskRunId: id });
  }
}

export async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error(`download ${url}: empty body`);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buf);
  return buf.length;
}

export function extOf(url, fallback = '.png') {
  const m = /\.(png|webp|jpe?g)(?:$|[?#])/i.exec(url);
  return m ? `.${m[1].toLowerCase().replace('jpeg', 'jpg')}` : fallback;
}

/** Run async jobs with a fixed concurrency. */
export async function pool(items, size, worker) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }));
  return results;
}
