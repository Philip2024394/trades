// Geometry Platform · LightingObject + 8 lighting profiles (Philip 2026-08-04).
//
// Renderer applies a lighting profile · never invents one.
//
// Doctrine: docs/brains/nex-phase-e2-unified-platforms-philip-2026-08-04.md

export type LightingProfileId =
  | "luxury_warm" | "modern_cool" | "industrial" | "showroom"
  | "daylight" | "golden_hour" | "studio" | "night_leds";

export type LightingObject = {
  id: LightingProfileId;
  display_name: string;
  ambient_intensity: number;             // 0..1
  ambient_color_hex: string;
  key_light: { color_hex: string; intensity: number; temperature_k?: number };
  fill_light?: { color_hex: string; intensity: number; temperature_k?: number };
  rim_light?: { color_hex: string; intensity: number; temperature_k?: number };
  shadows_enabled: boolean;
  shadow_softness?: number;              // 0..1
  hdri_ref?: string;
};

const LIGHTING_PROFILES: Record<LightingProfileId, LightingObject> = {
  luxury_warm: { id: "luxury_warm", display_name: "Luxury Warm (2700K)", ambient_intensity: 0.35, ambient_color_hex: "#FFEBC1", key_light: { color_hex: "#FFCC88", intensity: 1.6, temperature_k: 2700 }, fill_light: { color_hex: "#FFF3D4", intensity: 0.6, temperature_k: 3200 }, rim_light: { color_hex: "#FFE0AA", intensity: 0.8, temperature_k: 2500 }, shadows_enabled: true, shadow_softness: 0.7 },
  modern_cool: { id: "modern_cool", display_name: "Modern Cool (5000K)", ambient_intensity: 0.45, ambient_color_hex: "#E8F1FF", key_light: { color_hex: "#F0F4FF", intensity: 1.4, temperature_k: 5000 }, fill_light: { color_hex: "#FFFFFF", intensity: 0.7, temperature_k: 5600 }, shadows_enabled: true, shadow_softness: 0.5 },
  industrial: { id: "industrial", display_name: "Industrial (harsh key)", ambient_intensity: 0.20, ambient_color_hex: "#DDDDDD", key_light: { color_hex: "#FFFFFF", intensity: 2.0, temperature_k: 4500 }, shadows_enabled: true, shadow_softness: 0.2 },
  showroom: { id: "showroom", display_name: "Showroom (balanced)", ambient_intensity: 0.55, ambient_color_hex: "#FFFFFF", key_light: { color_hex: "#FFFFFF", intensity: 1.2, temperature_k: 4200 }, fill_light: { color_hex: "#FFFFFF", intensity: 0.8, temperature_k: 4200 }, rim_light: { color_hex: "#FFFFFF", intensity: 0.4 }, shadows_enabled: true, shadow_softness: 0.6 },
  daylight: { id: "daylight", display_name: "Daylight (6500K noon)", ambient_intensity: 0.60, ambient_color_hex: "#E8EEF7", key_light: { color_hex: "#FFF8E8", intensity: 1.8, temperature_k: 6500 }, fill_light: { color_hex: "#DFE7F2", intensity: 0.7, temperature_k: 8000 }, shadows_enabled: true, shadow_softness: 0.4 },
  golden_hour: { id: "golden_hour", display_name: "Golden Hour (3200K)", ambient_intensity: 0.35, ambient_color_hex: "#FFD9A2", key_light: { color_hex: "#FFB56B", intensity: 1.8, temperature_k: 3200 }, fill_light: { color_hex: "#FFD9A2", intensity: 0.5, temperature_k: 3500 }, rim_light: { color_hex: "#FFA45B", intensity: 1.0, temperature_k: 2800 }, shadows_enabled: true, shadow_softness: 0.6 },
  studio: { id: "studio", display_name: "Studio Softbox", ambient_intensity: 0.50, ambient_color_hex: "#FFFFFF", key_light: { color_hex: "#FFFFFF", intensity: 1.5, temperature_k: 5500 }, fill_light: { color_hex: "#FFFFFF", intensity: 1.0, temperature_k: 5500 }, rim_light: { color_hex: "#FFFFFF", intensity: 0.6 }, shadows_enabled: true, shadow_softness: 0.9 },
  night_leds: { id: "night_leds", display_name: "Night LEDs (dark scene · LED tread lighting)", ambient_intensity: 0.10, ambient_color_hex: "#101418", key_light: { color_hex: "#88BBFF", intensity: 0.4, temperature_k: 6500 }, fill_light: { color_hex: "#443322", intensity: 0.15, temperature_k: 3000 }, rim_light: { color_hex: "#FFDDA0", intensity: 0.9, temperature_k: 2500 }, shadows_enabled: true, shadow_softness: 0.5 },
};

export function resolveLighting(id: LightingProfileId): LightingObject { return LIGHTING_PROFILES[id]; }
export function listLightingProfiles(): readonly LightingProfileId[] { return Object.keys(LIGHTING_PROFILES) as LightingProfileId[]; }
