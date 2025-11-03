import OpenAI from 'openai';

// Singleton OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required for embeddings');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Generate a 768-dimensional embedding vector for the given text.
 * Uses OpenAI's text-embedding-3-small model configured for 768 dimensions.
 *
 * @param text - The text to embed
 * @returns Float32Array of 768 dimensions
 */
export async function generateEmbedding(text: string): Promise<Float32Array> {
  if (!text || text.trim().length === 0) {
    throw new Error('Cannot generate embedding for empty text');
  }

  const client = getOpenAIClient();

  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    dimensions: 768  // Match F32_BLOB(768) in schema
  });

  return new Float32Array(response.data[0].embedding);
}

/**
 * Generate embeddings for multiple texts in a single batch request.
 * More efficient than multiple individual calls.
 *
 * @param texts - Array of texts to embed (max 2048 per batch)
 * @returns Array of Float32Array embeddings
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<Float32Array[]> {
  if (texts.length === 0) {
    return [];
  }

  if (texts.length > 2048) {
    throw new Error('Batch size cannot exceed 2048 texts');
  }

  const client = getOpenAIClient();

  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: texts,
    dimensions: 768
  });

  return response.data.map(item => new Float32Array(item.embedding));
}

/**
 * Extract semantic content from a cognitive node for embedding.
 * Combines node ID, meanings, values, and other semantic information.
 *
 * @param node - The node data object
 * @returns Object with title and full semantic content
 */
export function extractNodeSemantics(node: any): { title: string; fullContent: string } {
  // Extract title from camelCase/PascalCase ID
  const title = node.id ? node.id.replace(/([A-Z])/g, ' $1').trim() : 'Unknown';

  // Extract description from meanings array
  const meaningContent = node.meanings
    ?.map((m: any) => m.content)
    .filter(Boolean)
    .join('\n') || '';

  // Extract values as key-value pairs
  const valuesSummary = node.values
    ? Object.entries(node.values)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
    : '';

  // Combine all semantic content
  const parts = [title];
  if (meaningContent) parts.push(meaningContent);
  if (valuesSummary) parts.push(`Attributes: ${valuesSummary}`);

  const fullContent = parts.join('\n\n');

  return { title, fullContent };
}

/**
 * Convert Float32Array to libSQL vector format string.
 * libSQL expects vectors in the format: [v1,v2,v3,...]
 *
 * @param embedding - Float32Array embedding vector
 * @returns String representation for libSQL
 */
export function serializeEmbedding(embedding: Float32Array): string {
  return `[${Array.from(embedding).join(',')}]`;
}
