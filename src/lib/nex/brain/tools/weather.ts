// src/lib/nex/brain/tools/weather.ts
//
// Stage 3.35 · Phase E · Weather tool (Philip 2026-08-31).
//
// CONSTITUTIONAL: Never fabricates current weather.
//
// v1 discipline:
//   · No provider integration wired yet · returns honest `unavailable`
//   · Contract locks the shape so a real BMKG/OpenWeather integration
//     lands via provider adapter without touching callers
//   · Reply text explicitly says "I don't have live weather data" ·
//     never a generic "sunny and 28°C" fallback

export type WeatherLocation = {
  city?: string;   // e.g. "Yogyakarta"
  lat?: number;
  lng?: number;
};

export type WeatherObservation = {
  temperatureC: number;
  conditionSummary: string;   // "sunny" · "light rain" · etc.
  humidity?: number;
  windKph?: number;
  observedAt: string;         // ISO
  provider: string;           // "bmkg" · "openweather" · etc.
};

export type WeatherResult =
  | {
      obtained: true;
      location: WeatherLocation;
      observation: WeatherObservation;
      replyText: { en: string; id: string };
    }
  | {
      obtained: false;
      reason:
        | "provider_not_configured"
        | "provider_unavailable"
        | "location_not_extractable"
        | "location_not_supported";
      message: { en: string; id: string };
    };

/** Placeholder for a future provider adapter (BMKG for ID, etc). */
export interface WeatherProvider {
  fetchCurrent(location: WeatherLocation): Promise<WeatherObservation | null>;
}

/**
 * Weather runner. Honest v1: if no provider is registered, returns
 * `unavailable` with reason `provider_not_configured`. When a real
 * provider is wired (env-configured), the runner returns real data
 * with provenance.
 */
export async function runWeather(input: {
  message: string;
  location?: WeatherLocation;
  provider?: WeatherProvider;
}): Promise<WeatherResult> {
  // v1: no provider configured → honest unavailable state.
  if (!input.provider) {
    return {
      obtained: false,
      reason: "provider_not_configured",
      message: {
        en: "I don't have live weather data available right now — the weather provider isn't wired up yet. I won't guess the current conditions.",
        id: "Saya tidak punya data cuaca live saat ini — provider cuaca belum terhubung. Saya tidak akan menebak kondisinya.",
      },
    };
  }

  // Resolve location: explicit input → message parse → refuse.
  const location = input.location ?? extractLocation(input.message);
  if (!location) {
    return {
      obtained: false,
      reason: "location_not_extractable",
      message: {
        en: "I couldn't tell which city you're asking about. Please name a city (e.g. 'weather in Yogyakarta').",
        id: "Saya tidak bisa mengenali kota mana yang kamu tanyakan. Sebutkan kota (misal 'cuaca di Yogyakarta').",
      },
    };
  }

  let observation: WeatherObservation | null;
  try {
    observation = await input.provider.fetchCurrent(location);
  } catch {
    return {
      obtained: false,
      reason: "provider_unavailable",
      message: {
        en: `I couldn't reach the weather provider just now. I won't guess the current conditions in ${location.city ?? "that location"}.`,
        id: `Saya tidak bisa mengakses provider cuaca sekarang. Saya tidak akan menebak kondisi di ${location.city ?? "lokasi itu"}.`,
      },
    };
  }
  if (!observation) {
    return {
      obtained: false,
      reason: "location_not_supported",
      message: {
        en: `The weather provider doesn't have data for ${location.city ?? "that location"}.`,
        id: `Provider cuaca tidak punya data untuk ${location.city ?? "lokasi itu"}.`,
      },
    };
  }

  return {
    obtained: true,
    location,
    observation,
    replyText: {
      en: `Right now in ${location.city ?? "your area"}: ${observation.temperatureC}°C, ${observation.conditionSummary} (source: ${observation.provider}, observed ${observation.observedAt}).`,
      id: `Sekarang di ${location.city ?? "area kamu"}: ${observation.temperatureC}°C, ${observation.conditionSummary} (sumber: ${observation.provider}, diamati ${observation.observedAt}).`,
    },
  };
}

// Very lightweight location extractor · only pulls city names the app
// already knows. Extend when the weather provider supports more.
function extractLocation(message: string): WeatherLocation | undefined {
  const m = message.toLowerCase();
  if (/\b(jogja|jogjakarta|yogyakarta)\b/.test(m)) return { city: "Yogyakarta" };
  if (/\bjakarta\b/.test(m))                       return { city: "Jakarta" };
  if (/\bbali\b/.test(m))                          return { city: "Denpasar" };
  if (/\bbandung\b/.test(m))                       return { city: "Bandung" };
  return undefined;
}
