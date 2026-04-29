import { pipeline, env } from '@huggingface/transformers';

// Disable native modules if we suspect they are causing the SIGTRAP
// Transformers.js will fall back to WASM if onnxruntime-node is disabled or fails
env.backends.onnx.enabled = false; 

// Disable fetch for models, use local if possible (though we set allowLocalModels = false)
// But env.allowRemoteModels = false might force it to stay within controlled paths
env.allowRemoteModels = true; // We need this to download if not cached

// Force single-threaded WASM to be extra safe
if (env.backends.onnx.wasm) {
  (env.backends.onnx.wasm as any).numThreads = 1;
}

// Cache model in ~/.cache/huggingface (default); disable local model check
env.allowLocalModels = false;

let _embedder: any = null;

async function getEmbedder(): Promise<any> {
  if (!_embedder) {
    console.log('[EmbeddingWorker] Loading model...');
    try {
      _embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        dtype: 'fp32',
      });
      console.log('[EmbeddingWorker] Model loaded successfully');
    } catch (err) {
      console.error('[EmbeddingWorker] Error loading model:', err);
      throw err;
    }
  }
  return _embedder;
}

async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const embedder = await getEmbedder();
  
  // Transformers.js feature-extraction returns a Tensor. 
  // For multiple texts, it's [batch_size, sequence_length, hidden_size] or similar depending on pooling.
  // We already use pooling: 'mean', normalize: true in getEmbedder's pipeline call.
  const output = await embedder(texts, { pooling: 'mean', normalize: true });
  
  // Convert tensor to nested JS array
  const result = output.tolist();
  return result;
}

process.on('message', async (message: { id: string, texts: string[] }) => {
  console.log(`[EmbeddingWorker] Received batch id: ${message.id} (${message.texts.length} texts)`);
  try {
    const vectors = await embed(message.texts);
    if (process.send) {
      process.send({ id: message.id, vectors });
    }
  } catch (error: any) {
    console.error(`[EmbeddingWorker] Error during embedding for id ${message.id}:`, error);
    if (process.send) {
      process.send({ id: message.id, error: error.message });
    }
  }
});

// Signal that the worker is ready after model is loaded
console.log('[EmbeddingWorker] Worker script starting...');
getEmbedder().then(() => {
  console.log('[EmbeddingWorker] Sending ready signal...');
  if (process.send) {
    process.send({ ready: true });
    console.log('[EmbeddingWorker] Ready signal sent');
  }
  
  // Keep the process alive
  setInterval(() => {}, 1000);
}).catch(err => {
  console.error('[EmbeddingWorker] Failed to load model:', err);
  process.exit(1);
});
