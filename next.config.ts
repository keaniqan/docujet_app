import type { NextConfig } from "next";

/**
 * What Transformers.js needs on disk at runtime, and cannot be traced to.
 *
 * `onnxruntime-node` locates its binding at runtime, from
 * `path.join(__dirname, 'bin', 'napi-v6', process.platform, process.arch)`.
 * Nothing about that is statically analysable, so file tracing includes none of
 * them — verified in `.next/server/app/api/chat/route.js.nft.json`, which
 * listed 95 files from the library and not one `.node` or `.so` among them.
 * A function built without them throws on `require('onnxruntime-node')` with
 * `libonnxruntime.so.1: cannot open shared object file`, before a line of code
 * in this repository runs.
 *
 * Both Linux architectures, since the deployment target may be either, and
 * together they are 53 MB against the 160 MB the excludes below remove.
 */
const EMBEDDING_RUNTIME_FILES = [
  "node_modules/onnxruntime-node/bin/napi-v6/linux/**",
  // The embedding model itself, downloaded by the `prebuild` script. Ships with
  // the function so the running server never has to write to disk or reach
  // Hugging Face — see scripts/warm-embeddings.ts.
  ".cache/transformers/**",
];

const nextConfig: NextConfig = {
  /**
   * Transformers.js embeds the chat assistant's questions on the server (see
   * src/lib/chat/embeddings.ts). It is left out of the bundle because it loads
   * its ONNX runtime and its model weights from the filesystem at runtime —
   * bundling would either break those paths or drag tens of megabytes of
   * binaries through the compiler for no benefit.
   */
  serverExternalPackages: ["@huggingface/transformers"],

  /**
   * Keep the other platforms' ONNX runtimes out of the deployed function.
   *
   * `onnxruntime-node` ships a prebuilt CPU runtime for every platform it
   * supports — 211 MB of node_modules, of which a Linux x64 host loads 34 MB
   * and ignores the rest. File tracing cannot tell that, because the binding is
   * chosen at runtime from `process.platform`, so without this it copies all of
   * them into the bundle and a serverless deploy runs into its size limit.
   *
   * Excluded by path rather than by "keep only linux/x64" so that a Linux arm64
   * host (a container, a CI runner) still works; only the platforms a server
   * cannot be are removed.
   */
  outputFileTracingExcludes: {
    "**": [
      "node_modules/onnxruntime-node/bin/napi-v6/win32/**",
      "node_modules/onnxruntime-node/bin/napi-v6/darwin/**",
    ],
  },

  /**
   * ...and put the one it does need back in, for every entry point that embeds.
   *
   * `/api/chat` embeds the visitor's question. `/superadmin/settings/chatbot`
   * renders KnowledgeManager, whose "use server" actions in
   * src/lib/chat/actions.ts embed a Q&A entry before storing it — server
   * actions are built into the page that imports them, so they need their own
   * copy of the runtime. This entry has to move whenever that page does; it was
   * `/admin/settings` until the settings pages were split.
   *
   * A route left off this list still builds and still ships the Transformers.js
   * JavaScript, because JavaScript is all file tracing can see. It fails only
   * at runtime, on the deployed host, on the first call that touches the model.
   */
  outputFileTracingIncludes: {
    "/api/chat": EMBEDDING_RUNTIME_FILES,
    "/superadmin/settings/chatbot": EMBEDDING_RUNTIME_FILES,
  },
};

export default nextConfig;
