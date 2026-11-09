import { createCollection, embed, upsertContent, type SearchMetadata } from "./infrai_search_client.js";

const persist = process.argv.includes("--persist");
const collection = process.env.INFRAI_COLLECTION?.trim();
if (persist && !collection) {
  throw new Error("--persist requires an explicit INFRAI_COLLECTION");
}

const documents: Array<{ id: string; metadata: SearchMetadata }> = [
  {
    id: "receipt-year-end-2026",
    metadata: {
      kind: "donor_receipt",
      title: "Year-end donation receipt",
      audience: "donors",
      text: "Your year-end receipt confirms the tax-deductible donation and includes the gift date and amount.",
    },
  },
  {
    id: "volunteer-food-bank-saturday",
    metadata: {
      kind: "volunteer_reminder",
      title: "Saturday food bank shift",
      audience: "volunteers",
      text: "Reminder for Saturday volunteers: arrive at 8:30 AM, wear closed-toe shoes, and check in at the loading entrance.",
    },
  },
  {
    id: "report-spring-meals",
    metadata: {
      kind: "campaign_report",
      title: "Spring meals campaign report",
      audience: "program staff",
      text: "The spring campaign funded 12,400 meals, reached 86 percent of its target, and retained 61 percent of prior donors.",
    },
  },
];

const vectors = await Promise.all(documents.map(async (document) => ({
  id: document.id,
  embedding: await embed(`${document.metadata.title}\n${document.metadata.text}`),
  metadata: document.metadata,
})));

if (persist) {
  await createCollection(collection!, vectors[0]!.embedding.length);
  await upsertContent(collection!, vectors);
  console.log(`Indexed ${vectors.length} nonprofit documents into ${collection}`);
} else {
  console.log(`Previewed ${vectors.length} nonprofit document embeddings (${vectors[0]!.embedding.length} dimensions). No collection created or vectors stored. Use --persist with INFRAI_COLLECTION to retain an index.`);
}
