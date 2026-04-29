import { fork, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class EmbeddingClient {
  private worker: ChildProcess | null = null;
  private pendingRequests: Map<string, (value: number[][]) => void> = new Map();
  private readyPromise: Promise<void> | null = null;

  private async getWorker(): Promise<ChildProcess> {
    if (this.worker) return this.worker;

    if (this.readyPromise) {
      await this.readyPromise;
      return this.worker!;
    }

    this.readyPromise = new Promise((resolve, reject) => {
      // Determine if we are running from source (.ts) or compiled (.js)
      const isTs = import.meta.url.endsWith('.ts');
      
      // In Electron production, we are inside an .asar file.
      const isAsar = import.meta.url.includes('app.asar');
      
      // In production/dist, we want to use the .js worker and NO loader
      const isDev = !isAsar && (isTs || process.env.NODE_ENV !== 'production' || process.argv.includes('watch') || process.env.JOBDASH_DEV === '1');

      console.log(`[EmbeddingClient] Starting worker. isTs: ${isTs}, isAsar: ${isAsar}, isDev: ${isDev}`);

      let workerPath: string;
      if (isTs) {
        // We are running the .ts file directly (e.g. via tsx)
        workerPath = path.join(__dirname, 'embeddingWorker.ts');
      } else {
        // We are running the compiled .js file
        workerPath = path.join(__dirname, 'embeddingWorker.js');
      }

      // Try to resolve tsx loader path to avoid ERR_MODULE_NOT_FOUND
      let loader: string | undefined;
      if (isDev && isTs) {
        try {
          loader = import.meta.resolve('tsx');
        } catch {
          loader = 'tsx';
        }
      }

      const tsconfigPath = path.resolve(__dirname, '../../tsconfig.json');
      
      console.log(`[EmbeddingClient] Forking worker at ${workerPath}`);
      
      this.worker = fork(workerPath, [], {
        execArgv: loader ? ['--import', loader] : [],
        env: { 
          ...process.env, 
          TSX_TSCONFIG_PATH: tsconfigPath,
          // Redirect Transformers.js cache to a writable directory in production
          // DATABASE_PATH is already set to the userData dir in electron/main.ts
          TRANSFORMERS_CACHE_DIR: process.env.DATABASE_PATH 
            ? path.join(path.dirname(process.env.DATABASE_PATH), 'model-cache')
            : undefined,
          // Disable multi-threading in ONNX to avoid potential fork issues/SIGTRAP
          OMP_NUM_THREADS: '1',
          MKL_NUM_THREADS: '1',
          // Try to disable some other native things
          NODE_OPTIONS: '--no-warnings'
        },
        stdio: ['inherit', 'inherit', 'inherit', 'ipc']
      });

      this.worker.on('message', (message: any) => {
        if (message.ready) {
          resolve();
        } else if (message.id && this.pendingRequests.has(message.id)) {
          const resolveReq = this.pendingRequests.get(message.id)!;
          this.pendingRequests.delete(message.id);
          if (message.error) {
            console.error(`[EmbeddingClient] Worker error: ${message.error}`);
            // Fallback or reject? For now, resolve with empty to not crash
            resolveReq([]);
          } else {
            resolveReq(message.vectors);
          }
        }
      });

      this.worker.on('exit', (code, signal) => {
        if (code !== 0 && code !== null) {
          console.error(`[EmbeddingClient] Worker exited with code ${code}`);
        } else if (signal) {
          console.error(`[EmbeddingClient] Worker killed by signal ${signal}`);
        } else if (code === null) {
          console.error(`[EmbeddingClient] Worker exited with code null (process killed)`);
        }
        this.worker = null;
        this.readyPromise = null;
      });

      this.worker.on('error', (err) => {
        console.error('[EmbeddingClient] Worker error:', err);
        reject(err);
      });
    });

    await this.readyPromise;
    return this.worker!;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    // Batching to prevent SIGTRAP/OOM with large payloads
    const BATCH_SIZE = 10;
    const results: number[][] = [];
    
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const batchResults = await this.embedBatch(batch);
      results.push(...batchResults);
    }
    
    return results;
  }

  private async embedBatch(texts: string[]): Promise<number[][]> {
    const worker = await this.getWorker();
    const id = Math.random().toString(36).substring(7);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Embedding request ${id} timed out`));
      }, 60000);

      this.pendingRequests.set(id, (vectors) => {
        clearTimeout(timeout);
        resolve(vectors);
      });
      
      worker.send({ id, texts });
    });
  }
}

export const embeddingClient = new EmbeddingClient();
