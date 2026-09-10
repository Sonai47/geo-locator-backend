import axios from "axios";
import { Coordinates } from "./types";

const GOOGLE_GEOCODING_BASE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

/**
 * Fallback coordinate dictionary for common demonstration addresses
 * used when GOOGLE_MAPS_API_KEY is not configured or in testing environments.
 */
const KNOWN_MOCK_LOCATIONS: Record<string, Coordinates> = {
  "park street, kolkata": { lat: 22.5512, lng: 88.3524 },
  "bbd bagh, kolkata": { lat: 22.5726, lng: 88.3512 },
  "salt lake, kolkata": { lat: 22.5804, lng: 88.4378 },
  "howrah, kolkata": { lat: 22.5855, lng: 88.3415 },
  "gariahat, kolkata": { lat: 22.5194, lng: 88.3667 },
  "kolkata": { lat: 22.5726, lng: 88.3639 },
};

function getMockFallback(address: string): Coordinates {
  const normalized = address.trim().toLowerCase();
  for (const [knownAddress, coords] of Object.entries(KNOWN_MOCK_LOCATIONS)) {
    if (normalized.includes(knownAddress) || knownAddress.includes(normalized)) {
      return coords;
    }
  }
  return { lat: 22.5726, lng: 88.3639 };
}

/**
 * Geocodes an address string into geographic latitude and longitude coordinates
 * using Google Maps Geocoding API.
 *
 * @param address The human-readable address to geocode.
 * @param apiKey Google Maps API Key. If not passed, reads from process.env.GOOGLE_MAPS_API_KEY.
 * @returns Coordinates object { lat, lng }
 */
export async function geocodeAddress(
  address: string,
  apiKey?: string
): Promise<Coordinates> {
  const rawKey = apiKey || process.env.GOOGLE_MAPS_API_KEY || "";
  const key = rawKey.trim();

  const isPlaceholderKey =
    !key ||
    key.toLowerCase().includes("your_google_maps_api_key") ||
    key.toLowerCase() === "placeholder";

  if (isPlaceholderKey) {
    const coords = getMockFallback(address);
    console.warn(
      `[Geocoding] No valid GOOGLE_MAPS_API_KEY configured. Using mock coordinates for "${address}":`,
      coords
    );
    return coords;
  }

  try {
    const response = await axios.get(GOOGLE_GEOCODING_BASE_URL, {
      params: {
        address,
        key,
      },
      timeout: 10000,
    });

    const data = response.data;

    if (data.status === "OK" && data.results && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return {
        lat: location.lat,
        lng: location.lng,
      };
    }

    if (data.status === "ZERO_RESULTS") {
      throw new Error(`Geocoding failed: No coordinates found for address "${address}".`);
    }

    throw new Error(
      `Google Maps Geocoding API error: ${data.status} - ${data.error_message || "Unknown error"}`
    );
  } catch (error: any) {
    // If running offline or network fails with mock fallback available
    if (error.code === "EAI_AGAIN" || error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      console.warn(
        `[Geocoding] Network connection to Google Maps failed (${error.code}). Falling back to mock coordinates for demo.`
      );
      return getMockFallback(address);
    }

    if (error.response?.data?.error_message) {
      throw new Error(
        `Google Maps Geocoding API error: ${error.response.data.status} - ${error.response.data.error_message}`
      );
    }
    throw error;
  }
}
