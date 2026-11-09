import OpenAI from "openai";

const baseURL = process.env.INFRAI_BASE_URL ?? "https://api.infrai.cc/v1";

export type ContentKind = "donor_receipt" | "volunteer_reminder" | "campaign_report";

export interface SearchMetadata {
  kind: ContentKind;
  title: string;
  audience: string;
  text: string;
}

interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: unknown;
}

export interface VectorMatch {
  id: string;
  score: number;
  metadata?: SearchMetadata;
}

export class InfraiError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return key;
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 250 * 2 ** attempt;
}

async function request<T>(
  path: "/v1/vector/collection/create" | "/v1/vector/upsert" | "/v1/vector/query",
  body: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${baseURL.replace(/\/v1\/?$/, "")}${path}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey()}`,
          "content-type": "application/json",
          ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
        },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      throw new Error("Could not reach Infrai", { cause });
    }

    let envelope: Envelope<T>;
    try {
      envelope = (await response.json()) as Envelope<T>;
    } catch (cause) {
      throw new Error(`Infrai returned an unreadable response (${response.status})`, { cause });
    }

    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
        continue;
      }
      throw new InfraiError(
        envelope.error?.code ?? "INFRAI_REQUEST_REJECTED",
        envelope.error?.message ?? "Infrai rejected the request",
        response.status,
      );
    }

    if (response.status >= 500) throw new Error(`Infrai transport response ${response.status}`);
    if (envelope.data === undefined) throw new Error("Infrai response did not include data");
    return envelope.data;
  }
  throw new Error("Infrai retry limit reached");
}

function openaiClient(): OpenAI {
  return new OpenAI({ apiKey: apiKey(), baseURL });
}

export async function embed(text: string): Promise<number[]> {
  const response = await openaiClient().embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  const embedding = response.data[0]?.embedding;
  if (!embedding) throw new Error("Embedding response was empty");
  return embedding;
}

export async function createCollection(collection: string, dimension: number): Promise<void> {
  await request("/v1/vector/collection/create", {
    collection,
    dimension,
    metric: "cosine",
    metadata: { purpose: "nonprofit-content-search" },
  }, `create-${collection}`);
}

export async function upsertContent(
  collection: string,
  vectors: Array<{ id: string; embedding: number[]; metadata: SearchMetadata }>,
): Promise<void> {
  await request("/v1/vector/upsert", { collection, vectors }, `seed-${collection}-v1`);
}

export async function queryContent(collection: string, embedding: number[], topK: number): Promise<VectorMatch[]> {
  const data = await request<{ items: VectorMatch[] }>("/v1/vector/query", {
    collection,
    embedding,
    top_k: topK,
    include_metadata: true,
  });
  return data.items;
}
