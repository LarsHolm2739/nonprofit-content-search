import { embed, queryContent, type ContentKind, type VectorMatch } from "./infrai_search_client.js";

export const COLLECTION = process.env.INFRAI_COLLECTION?.trim();

export interface SearchResult {
  id: string;
  score: number;
  title: string;
  kind: ContentKind;
  text: string;
  nextAction: "open_receipt" | "send_reminder" | "review_report";
}

const actionByKind: Record<ContentKind, SearchResult["nextAction"]> = {
  donor_receipt: "open_receipt",
  volunteer_reminder: "send_reminder",
  campaign_report: "review_report",
};

export function presentMatches(matches: VectorMatch[], minimumScore: number): SearchResult[] {
  return matches.flatMap((match) => {
    const metadata = match.metadata;
    if (!metadata || match.score < minimumScore) return [];
    return [{
      id: match.id,
      score: match.score,
      title: metadata.title,
      kind: metadata.kind,
      text: metadata.text,
      nextAction: actionByKind[metadata.kind],
    }];
  });
}

export async function searchNonprofitContent(query: string, limit: number, minimumScore: number): Promise<SearchResult[]> {
  if (!COLLECTION) throw new Error("INFRAI_COLLECTION is required to search a retained index");
  const queryEmbedding = await embed(query);
  const matches = await queryContent(COLLECTION, queryEmbedding, limit);
  return presentMatches(matches, minimumScore);
}
