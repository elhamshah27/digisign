export const PRESETS = [
  {
    id: "minimal",
    name: "Minimal",
    description: "Clean, simple, and easy to read.",
  },
  { id: "dark", name: "Dark", description: "A bold look for darker spaces." },
  {
    id: "sky",
    name: "Sky",
    description: "A little atmosphere for your screen.",
  },
  {
    id: "forecast",
    name: "Forecast",
    description: "The next five days at a glance.",
  },
];
export const CUSTOM_DEFAULT = Object.freeze({
  background: "#ffffff",
  layout: "today",
  textSize: "standard",
  title: "",
  showIcon: true,
  showFeelsLike: true,
  showHighLow: true,
});
export function normalizeCustom(value) {
  const boolean = (key) =>
    typeof value?.[key] === "boolean" ? value[key] : CUSTOM_DEFAULT[key];
  return {
    background:
      typeof value?.background === "string" &&
      /^#[0-9a-f]{6}$/i.test(value.background)
        ? value.background.toLowerCase()
        : CUSTOM_DEFAULT.background,
    layout: ["today", "three-day", "five-day"].includes(value?.layout)
      ? value.layout
      : CUSTOM_DEFAULT.layout,
    textSize: value?.textSize === "large" ? "large" : "standard",
    title:
      typeof value?.title === "string"
        ? Array.from(value.title.trim()).slice(0, 40).join("")
        : "",
    showIcon: boolean("showIcon"),
    showFeelsLike: boolean("showFeelsLike"),
    showHighLow: boolean("showHighLow"),
  };
}
function luminance(hex) {
  const components = [1, 3, 5].map((index) => {
    const value = parseInt(hex.slice(index, index + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return (
    components[0] * 0.2126 + components[1] * 0.7152 + components[2] * 0.0722
  );
}
// Choose the more readable black/white text automatically; both text levels
// keep the same contrast so labels stay readable on any chosen background.
export function customPalette(background) {
  const safeBackground = normalizeCustom({ background }).background;
  const light = luminance(safeBackground);
  const darkContrast = (light + 0.05) / 0.05;
  const lightContrast = 1.05 / (light + 0.05);
  const ink = darkContrast >= lightContrast ? "#000000" : "#ffffff";
  return {
    background: safeBackground,
    ink,
    soft: ink,
    rule: ink === "#000000" ? "#00000033" : "#ffffff55",
  };
}
export const DEFAULT = {
  preset: "minimal",
  units: "fahrenheit",
  location: {
    name: "Boston",
    region: "Massachusetts, US",
    lat: 42.3601,
    lon: -71.0589,
  },
  custom: { ...CUSTOM_DEFAULT },
};
export const REFRESH_MS = 10 * 60 * 1000;
export const MAX_CACHE_AGE = 24 * 60 * 60 * 1000;
export function validLocation(value) {
  return (
    value &&
    typeof value.name === "string" &&
    value.name.trim().length > 0 &&
    value.name.length <= 160 &&
    Number.isFinite(value.lat) &&
    Math.abs(value.lat) <= 90 &&
    Number.isFinite(value.lon) &&
    Math.abs(value.lon) <= 180
  );
}
export function normalizeSettings(value) {
  return {
    preset:
      value?.preset === "custom" || PRESETS.some((p) => p.id === value?.preset)
        ? value.preset
        : DEFAULT.preset,
    units: value?.units === "celsius" ? "celsius" : "fahrenheit",
    location: validLocation(value?.location)
      ? {
          ...value.location,
          region: String(value.location.region ?? "").slice(0, 160),
        }
      : { ...DEFAULT.location },
    custom: normalizeCustom(value?.custom),
  };
}
export function settingsFromQuery(search, fallback) {
  const p = new URLSearchParams(search);
  if (!p.has("preset")) return normalizeSettings(fallback);
  const customKeys = [
    "background",
    "layout",
    "textSize",
    "title",
    "showIcon",
    "showFeelsLike",
    "showHighLow",
  ];
  const hasCustom = customKeys.some((key) => p.has(key));
  const custom = hasCustom
    ? {
        background: p.get("background"),
        layout: p.get("layout"),
        textSize: p.get("textSize"),
        title: p.get("title"),
        ...Object.fromEntries(
          ["showIcon", "showFeelsLike", "showHighLow"].map((key) => [
            key,
            p.get(key) === "1" ? true : p.get(key) === "0" ? false : undefined,
          ]),
        ),
      }
    : fallback?.custom;
  return normalizeSettings({
    preset: p.get("preset"),
    units: p.get("units"),
    custom,
    location: {
      name: p.get("city"),
      region: p.get("region"),
      lat: p.has("lat") ? Number(p.get("lat")) : NaN,
      lon: p.has("lon") ? Number(p.get("lon")) : NaN,
    },
  });
}
export function displayQuery(settings) {
  const { preset, units, location: l, custom } = normalizeSettings(settings);
  const query = new URLSearchParams({
    preset,
    units,
    city: l.name,
    region: l.region,
    lat: l.lat,
    lon: l.lon,
  });
  if (preset === "custom") {
    for (const [key, value] of Object.entries(custom)) {
      query.set(key, typeof value === "boolean" ? (value ? "1" : "0") : value);
    }
  }
  return query.toString();
}
export function condition(code, isDay = true) {
  if (code === 0)
    return {
      label: isDay ? "Clear skies" : "Clear night",
      icon: isDay ? "sun" : "moon",
    };
  if (code === 1 || code === 2)
    return {
      label: code === 1 ? "Mostly clear" : "Partly cloudy",
      icon: isDay ? "partly" : "night-cloud",
    };
  if (code === 3) return { label: "Overcast", icon: "cloud" };
  if ([45, 48].includes(code)) return { label: "Fog", icon: "fog" };
  if ([51, 53, 55, 56, 57].includes(code))
    return { label: "Drizzle", icon: "rain" };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code))
    return { label: "Rain", icon: "rain" };
  if ([71, 73, 75, 77, 85, 86].includes(code))
    return { label: "Snow", icon: "snow" };
  if ([95, 96, 99].includes(code))
    return { label: "Thunderstorms", icon: "storm" };
  return { label: "Conditions unavailable", icon: "unknown" };
}
export function rounded(value) {
  return Number.isFinite(value) ? String(Math.round(value)) : "—";
}
export function dayLabel(date, index) {
  if (index === 0) return "Today";
  return new Date(date + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
}
export function forecastUrl(settings) {
  const { location: l, units } = normalizeSettings(settings);
  return (
    "https://api.open-meteo.com/v1/forecast?" +
    new URLSearchParams({
      latitude: l.lat,
      longitude: l.lon,
      temperature_unit: units,
      wind_speed_unit: units === "fahrenheit" ? "mph" : "kmh",
      timezone: "auto",
      forecast_days: "5",
      current:
        "temperature_2m,apparent_temperature,relative_humidity_2m,is_day,weather_code,wind_speed_10m",
      daily:
        "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    })
  );
}
export function validWeather(data) {
  return (
    !!data?.current &&
    Number.isFinite(data.current.temperature_2m) &&
    Array.isArray(data.daily?.time) &&
    data.daily.time.length >= 5 &&
    data.daily.time.every(
      (t) => typeof t === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t),
    ) &&
    ["temperature_2m_max", "temperature_2m_min", "weather_code"].every(
      (k) =>
        Array.isArray(data.daily[k]) &&
        data.daily[k].length >= data.daily.time.length &&
        data.daily[k].every((v) => v === null || Number.isFinite(v)),
    )
  );
}
export function usableCache(entry, now = Date.now()) {
  return (
    validWeather(entry?.data) &&
    Number.isFinite(entry.savedAt) &&
    entry.savedAt <= now &&
    now - entry.savedAt < MAX_CACHE_AGE
  );
}
export function readStored(storage, key) {
  try {
    return JSON.parse(storage.getItem(key));
  } catch {
    return null;
  }
}
export function writeStored(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
// Both views share one cancellable request and a cache scoped to city + units.
export class WeatherSource {
  constructor({ fetcher = globalThis.fetch, storage, now = Date.now } = {}) {
    this.fetcher = (...args) => fetcher(...args);
    this.storage = storage;
    this.now = now;
    this.sequence = 0;
  }
  async load(settings, onChange) {
    const sequence = ++this.sequence;
    this.controller?.abort();
    const controller = (this.controller = new AbortController());
    const url = forecastUrl(settings),
      key = "digisign:weather:" + url;
    const cached = readStored(this.storage, key);
    const fallback = usableCache(cached, this.now()) ? cached : null;
    if (fallback && this.now() - fallback.savedAt < REFRESH_MS) {
      onChange({ ...fallback, status: "ready" });
      return;
    }
    onChange({ ...(fallback ?? { data: null }), status: "loading" });
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await this.fetcher(url, { signal: controller.signal });
      if (!response.ok) throw new Error("Weather service unavailable");
      const data = await response.json();
      if (!validWeather(data)) throw new Error("Incomplete forecast");
      if (sequence !== this.sequence) return;
      const entry = { data, savedAt: this.now() };
      writeStored(this.storage, key, entry);
      onChange({ ...entry, status: "ready" });
    } catch {
      if (sequence === this.sequence)
        onChange({ ...(fallback ?? { data: null }), status: "error" });
    } finally {
      clearTimeout(timeout);
    }
  }
}
