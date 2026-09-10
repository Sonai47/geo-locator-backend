export interface Partner {
  id: string;
  name: string;
  partnerType: string;
  status: "active" | "inactive" | string;
  latitude: number;
  longitude: number;
  address: string;
  npaRatioPercent: number;
}

export interface SchemeQuota {
  partnerId: string;
  schemeId: string;
  totalQuotaAmount: number;
  utilizedAmount: number;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ScoredPartner {
  partner: Partner;
  distanceKm: number;
  score: number;
}

export interface GeoRouterResult {
  partner: string;
  address: string;
  distanceKm: number;
  npaRatio: number;
  mapsLink: string;
}
