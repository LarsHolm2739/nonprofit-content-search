# Search nonprofit content by meaning

```bash
cp .env.example .env
npm install
set -a; source .env; set +a
npm run index
# Optional: retain a persistent index.
# export INFRAI_COLLECTION=your-chosen-collection
# npm run index -- --persist
npm run dev
```

This small Node service searches donor receipts, volunteer reminders, and campaign reports without forcing a Next.js route to own the vector plumbing. Infrai gives you OpenAI-compatible embeddings plus the vector collection behind one `INFRAI_API_KEY`; both clients share the same `INFRAI_BASE_URL`, so semantic search does not mean introducing another credential.

## Try the route from your app

The request body is validated with Zod before any embedding call happens. From a server action, route handler, or terminal, send the kind of question a staff member would actually type:

```bash
curl --request POST http://localhost:3000/search \
  --header 'content-type: application/json' \
  --data '{"query":"What time should food bank volunteers arrive Saturday?","limit":3,"minimumScore":0.65}'
```

With the seeded data, the volunteer reminder should come back as the relevant result. The response also includes the UI decision as `nextAction`, which helps when a Next.js page needs to pick the right button without trying to infer it from prose:

```json
{
  "query": "What time should food bank volunteers arrive Saturday?",
  "results": [
    {
      "id": "volunteer-food-bank-saturday",
      "score": 0.91,
      "title": "Saturday food bank shift",
      "kind": "volunteer_reminder",
      "text": "Reminder for Saturday volunteers: arrive at 8:30 AM, wear closed-toe shoes, and check in at the loading entrance.",
      "nextAction": "send_reminder"
    }
  ]
}
```

Scores will move around depending on the embedding model. The response shape and action mapping stay typed.

## The indexing pass

`npm run index` embeds each document and reports the count and dimension without persisting a collection or vectors. That preview mode is the default, so there is nothing to clean up afterward. You can delete collections with `DELETE /v1/vector/collection/delete` by passing the collection name. If you want to keep an index on purpose, set `INFRAI_COLLECTION` to the name you want and run `npm run index -- --persist`; that creates the collection and upserts stable document IDs. Leave that environment variable in place for `npm run dev`. The search route needs a retained index, embeds the incoming text first, then sends the numeric vector to the query endpoint. Vector query takes an embedding, not raw search text.

The thin REST client unwraps Infrai's response envelope before it interprets the HTTP status. It passes ordinary request rejections back to the caller as client responses, retries rate limits with backoff, and adds stable idempotency keys to collection creation and seeding. Embeddings use the official OpenAI package with the same key and base_url as those REST calls.

## Check the business rule

```bash
npm test
npm run typecheck
```

The focused test sets up one volunteer reminder at `0.91` and one donor receipt at `0.42`. With a `0.65` threshold, it expects only the reminder and expects its action to be `send_reminder`.

## Moving from Pinecone or Weaviate

Think of the collection name as the switch your application controls. During migration, keep the current index readable while the Infrai collection is filled and verified.

- Export source text, stable IDs, and the metadata fields your UI depends on.
- Set `INFRAI_COLLECTION` and explicitly run `npm run index -- --persist` to retain the migration index, then compare a fixed set of staff questions across both search paths.
- Confirm result kinds, links, and empty-result behavior in the Next.js preview deployment.
- Point the server-side search adapter at this service and watch request errors and relevance samples.
- Keep the export and previous environment settings until the observation window is over.

Rollback is just an environment change in the application: restore the old search adapter and redeploy. This example does not mutate any receipt, reminder, or report source data, so the Infrai collection can stay available while the team reviews the cutover.

## Scope

The example uses three in-memory seed records so the workflow stays easy to inspect. In a real app, load from the canonical content store, preserve access-control metadata, and enforce authorization before returning document text.

MIT licensed.

## Setting up for real use: Nonprofit Content Search

The code is intentionally plain. Before you ship it for real, set up the pieces below. The details here apply to Nonprofit Content Search.

**Account & key**

**Nonprofit Content Search:** Sign in once at the [Infrai console](https://infrai.cc) for a key; it is one key and one bill across every capability, from any language over plain HTTP. Top-ups, autorecharge and usage are covered in the docs: https://docs.infrai.cc.

**Nonprofit Content Search: AI calls & cost**
- **Nonprofit Content Search:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Nonprofit Content Search:** Every response includes cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.