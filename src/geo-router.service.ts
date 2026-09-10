import * as fs from "fs";
import * as path from "path";
import { Partner, SchemeQuota, GeoRouterResult, ScoredPartner } from "./types";
import { geocodeAddress } from "./geocoding.client";
import { calculateHaversineDistance } from "./haversine.util";

export interface GeoRouterOptions {
  partnersFilePath?: string;
  schemeQuotasFilePath?: string;
  partnersData?: Partner[];
  schemeQuotasData?: SchemeQuota[];
  apiKey?: string;
}

/**
 * Resolves standard data files from either cwd or relative build directories.
 */
function resolveDataPath(filename: string): string {
  const candidatePaths = [
    path.resolve(process.cwd(), "data", filename),
    path.resolve(__dirname, "../data", filename),
    path.resolve(__dirname, "../../data", filename),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidatePaths[0];
}

/**
 * Loads JSON data from a file path.
 */
function loadJsonFile<T>(filePath: string): T {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Data file not found at: ${resolvedPath}`);
  }
  const fileContent = fs.readFileSync(resolvedPath, "utf-8");
  return JSON.parse(fileContent) as T;
}

/**
 * Calculates routing score based on distance and NPA ratio.
 * Formula: score = (1/distance * 0.5) + (1/npaRatioPercent * 0.5)
 *
 * Edge cases:
 * - When distance <= 0, clamp to minimum 0.01 km (10m) to avoid division by zero.
 * - When npaRatioPercent <= 0, clamp to minimum 0.01% to avoid division by zero.
 */
export function calculatePartnerScore(
  distanceKm: number,
  npaRatioPercent: number
): number {
  const effectiveDistance = Math.max(distanceKm, 0.01);
  const effectiveNpa = Math.max(npaRatioPercent, 0.01);

  return (1 / effectiveDistance) * 0.5 + (1 / effectiveNpa) * 0.5;
}

/**
 * Finds the best channel partner who can serve the given scheme ID
 * for the given user address, scored by NPA ratio and distance.
 *
 * @param userAddress Text address of the user (e.g. "Park Street, Kolkata")
 * @param schemeId Target scheme identifier (e.g. "scheme-mcf-001")
 * @param options Optional paths, mock data, or API key configuration
 * @returns Best matched GeoRouterResult, or null if no partner is eligible
 */
export async function findBestChannelPartner(
  userAddress: string,
  schemeId: string,
  options?: GeoRouterOptions
): Promise<GeoRouterResult | null> {
  // 1. Load data
  const defaultPartnersPath = resolveDataPath("partners.json");
  const defaultQuotasPath = resolveDataPath("scheme_quotas.json");

  const partners: Partner[] =
    options?.partnersData ??
    loadJsonFile<Partner[]>(options?.partnersFilePath ?? defaultPartnersPath);

  const schemeQuotas: SchemeQuota[] =
    options?.schemeQuotasData ??
    loadJsonFile<SchemeQuota[]>(options?.schemeQuotasFilePath ?? defaultQuotasPath);

  // 2. Geocode user address
  const userCoords = await geocodeAddress(userAddress, options?.apiKey);

  // 3. Build lookup for eligible scheme quotas (matching schemeId and quota not exhausted)
  const quotaMap = new Map<string, SchemeQuota>();
  for (const quota of schemeQuotas) {
    if (
      quota.schemeId === schemeId &&
      quota.utilizedAmount < quota.totalQuotaAmount
    ) {
      quotaMap.set(quota.partnerId, quota);
    }
  }

  // 4. Filter partners
  const eligiblePartners = partners.filter(
    (partner) =>
      partner.status.toLowerCase() === "active" &&
      quotaMap.has(partner.id)
  );

  if (eligiblePartners.length === 0) {
    return null;
  }

  // 5. Score eligible partners
  const scoredPartners: ScoredPartner[] = eligiblePartners.map((partner) => {
    const distanceKm = calculateHaversineDistance(userCoords, {
      lat: partner.latitude,
      lng: partner.longitude,
    });
    const score = calculatePartnerScore(distanceKm, partner.npaRatioPercent);

    return {
      partner,
      distanceKm,
      score,
    };
  });

  // 6. Sort descending by score
  scoredPartners.sort((a, b) => b.score - a.score);

  const best = scoredPartners[0];

  // 7. Format output
  return {
    partner: best.partner.name,
    address: best.partner.address,
    distanceKm: best.distanceKm,
    npaRatio: best.partner.npaRatioPercent,
    mapsLink: `https://maps.google.com/?q=${best.partner.latitude},${best.partner.longitude}`,
  };
}
