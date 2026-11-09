import assert from "node:assert/strict";
import test from "node:test";
import { presentMatches } from "./nonprofit_search.js";

test("keeps relevant content and assigns the workflow action for its kind", () => {
  const results = presentMatches([
    {
      id: "volunteer-food-bank-saturday",
      score: 0.91,
      metadata: {
        kind: "volunteer_reminder",
        title: "Saturday food bank shift",
        audience: "volunteers",
        text: "Arrive at 8:30 AM and check in at the loading entrance.",
      },
    },
    {
      id: "receipt-year-end-2026",
      score: 0.42,
      metadata: {
        kind: "donor_receipt",
        title: "Year-end donation receipt",
        audience: "donors",
        text: "Receipt details for a year-end gift.",
      },
    },
  ], 0.65);

  assert.deepEqual(results.map(({ id, nextAction }) => ({ id, nextAction })), [
    { id: "volunteer-food-bank-saturday", nextAction: "send_reminder" },
  ]);
});
