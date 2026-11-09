import { createServer } from "node:http";
import { z } from "zod";
import { InfraiError } from "./infrai_search_client.js";
import { searchNonprofitContent } from "./nonprofit_search.js";

const searchBody = z.object({
  query: z.string().trim().min(3).max(500),
  limit: z.number().int().min(1).max(20).default(5),
  minimumScore: z.number().min(0).max(1).default(0.65),
});

async function readJson(request: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 32_768) throw new Error("Request body is too large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/search") {
    send(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const body = searchBody.parse(await readJson(request));
    const results = await searchNonprofitContent(body.query, body.limit, body.minimumScore);
    send(response, 200, { query: body.query, results });
  } catch (error) {
    if (error instanceof SyntaxError) {
      send(response, 400, { error: "Request body must be valid JSON" });
      return;
    }
    if (error instanceof z.ZodError) {
      send(response, 400, { error: "Invalid request", issues: error.issues });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.message, code: error.code });
      return;
    }
    console.error(error);
    send(response, 500, { error: "Search request failed" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Nonprofit search listening on http://localhost:${port}`));
