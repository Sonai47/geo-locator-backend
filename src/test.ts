import assert from "assert";
import { calculateHaversineDistance } from "./haversine.util";
import { calculatePartnerScore, findBestChannelPartner } from "./geo-router.service";
import { Partner, SchemeQuota } from "./types";

console.log("Running Geo-Router Test Suite...\n");

// Test 1: Haversine distance
{
  // Distance from Park Street (22.5512, 88.3524) to BBD Bagh (22.5726, 88.3512) in Kolkata is ~2.38 km
  const p1 = { lat: 22.5512, lng: 88.3524 };
  const p2 = { lat: 22.5726, lng: 88.3512 };
  const dist = calculateHaversineDistance(p1, p2);
  console.log(`[Haversine] Distance between Park Street and BBD Bagh: ${dist} km`);
  assert(dist > 2.0 && dist < 2.6, `Expected distance ~2.38 km, got ${dist}`);

  // Distance to itself should be 0 km
  const zeroDist = calculateHaversineDistance(p1, p1);
  assert.strictEqual(zeroDist, 0, "Distance to self should be 0 km");
  console.log("✔ Haversine distance calculations verified.");
}

// Test 2: Scoring function & edge cases
{
  // Score formula: (1/dist * 0.5) + (1/npa * 0.5)
  // Distance = 2 km, NPA = 2%:
  // (1/2 * 0.5) + (1/2 * 0.5) = 0.25 + 0.25 = 0.5
  const scoreStandard = calculatePartnerScore(2, 2);
  assert.strictEqual(scoreStandard, 0.5, "Standard score calculation mismatch");

  // Zero distance edge case should not be Infinity
  const scoreZeroDist = calculatePartnerScore(0, 2);
  assert(Number.isFinite(scoreZeroDist), "Zero distance should not yield Infinity");

  // Zero NPA edge case should not be Infinity
  const scoreZeroNpa = calculatePartnerScore(2, 0);
  assert(Number.isFinite(scoreZeroNpa), "Zero NPA ratio should not yield Infinity");

  // Lower distance & lower NPA should yield higher score
  const scoreCloser = calculatePartnerScore(1, 2);
  assert(scoreCloser > scoreStandard, "Closer partner should have higher score");

  const scoreBetterNpa = calculatePartnerScore(2, 1);
  assert(scoreBetterNpa > scoreStandard, "Lower NPA partner should have higher score");
  console.log("✔ Scoring function and zero division edge cases verified.");
}

// Test 3: Partner selection logic (Filtering and Ranking)
(async () => {
  const mockPartners: Partner[] = [
    {
      id: "p1-far-low-npa",
      name: "Partner Far Low NPA",
      partnerType: "psb",
      status: "active",
      latitude: 22.6500, // ~11 km away
      longitude: 88.3524,
      address: "North Kolkata",
      npaRatioPercent: 1.0,
    },
    {
      id: "p2-close-high-npa",
      name: "Partner Close High NPA",
      partnerType: "private",
      status: "active",
      latitude: 22.5520, // ~0.1 km away
      longitude: 88.3524,
      address: "Park Street Adjacent",
      npaRatioPercent: 5.0,
    },
    {
      id: "p3-inactive",
      name: "Partner Inactive",
      partnerType: "psb",
      status: "inactive",
      latitude: 22.5512,
      longitude: 88.3524,
      address: "Next Door",
      npaRatioPercent: 0.5,
    },
    {
      id: "p4-exhausted-quota",
      name: "Partner Quota Exhausted",
      partnerType: "psb",
      status: "active",
      latitude: 22.5512,
      longitude: 88.3524,
      address: "Next Door 2",
      npaRatioPercent: 0.5,
    },
  ];

  const mockQuotas: SchemeQuota[] = [
    {
      partnerId: "p1-far-low-npa",
      schemeId: "scheme-test",
      totalQuotaAmount: 1000,
      utilizedAmount: 500,
    },
    {
      partnerId: "p2-close-high-npa",
      schemeId: "scheme-test",
      totalQuotaAmount: 1000,
      utilizedAmount: 200,
    },
    {
      partnerId: "p3-inactive",
      schemeId: "scheme-test",
      totalQuotaAmount: 1000,
      utilizedAmount: 100,
    },
    {
      partnerId: "p4-exhausted-quota",
      schemeId: "scheme-test",
      totalQuotaAmount: 1000,
      utilizedAmount: 1000, // Exhausted
    },
  ];

  const result = await findBestChannelPartner("Park Street, Kolkata", "scheme-test", {
    partnersData: mockPartners,
    schemeQuotasData: mockQuotas,
  });

  assert(result !== null, "Expected a winning partner");
  // p2 is 0.09 km away: (1/0.09 * 0.5) + (1/5 * 0.5) = 5.55 + 0.1 = ~5.65
  // p1 is 11 km away: (1/11 * 0.5) + (1/1 * 0.5) = 0.045 + 0.5 = 0.545
  // Thus p2 should win despite higher NPA because distance is so close
  assert.strictEqual(result.partner, "Partner Close High NPA");
  assert.strictEqual(result.npaRatio, 5.0);
  assert(result.mapsLink.includes("22.552,88.3524"));
  console.log("✔ Partner filtering (status, quota exhaustion) and ranking verified.");

  // Test 4: Scheme with no match
  const noMatchResult = await findBestChannelPartner("Park Street, Kolkata", "non-existent-scheme", {
    partnersData: mockPartners,
    schemeQuotasData: mockQuotas,
  });
  assert.strictEqual(noMatchResult, null, "Should return null when no partner matches scheme");
  console.log("✔ Non-matching scheme handling verified.");

  console.log("\nAll tests passed successfully! ✨");
})();
