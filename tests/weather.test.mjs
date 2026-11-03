import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT,
  PRESETS,
  MAX_CACHE_AGE,
  REFRESH_MS,
  normalizeSettings,
  displayQuery,
  settingsFromQuery,
  forecastUrl,
  condition,
  rounded,
  validWeather,
  WeatherSource,
} from "../static/weather-core.mjs";
import { widgetMarkup } from "../static/weather-render.mjs";
const data = {
  current: {
    temperature_2m: 62,
    apparent_temperature: 60,
    weather_code: 2,
    is_day: 1,
  },
  daily: {
    time: [
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
      "2026-11-07",
    ],
    temperature_2m_max: [64, 65, 63, 62, 60],
    temperature_2m_min: [44, 45, 43, 42, 40],
    weather_code: [2, 3, 61, 71, 0],
    precipitation_probability_max: [0, 20, 70, 80, 0],
  },
};
const response = (body) => ({ ok: true, json: async () => body });
const memory = () => {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
  };
};
test("display links preserve all presets, units and escaped location names", () => {
  for (const preset of PRESETS) {
    const s = {
      ...DEFAULT,
      preset: preset.id,
      units: "celsius",
      location: {
        name: "São Paulo & area",
        region: "BR",
        lat: -23.55,
        lon: -46.63,
      },
    };
    assert.deepEqual(settingsFromQuery(displayQuery(s)), s);
    assert.match(
      widgetMarkup(preset.id, s, { data }),
      new RegExp("widget-" + preset.id),
    );
  }
});
test("invalid saved settings and URL coordinates safely fall back", () => {
  assert.deepEqual(
    normalizeSettings({
      preset: "custom",
      units: "kelvin",
      location: { name: "x", lat: 100, lon: 1 },
    }),
    DEFAULT,
  );
  assert.deepEqual(
    settingsFromQuery("?preset=sky&city=x").location,
    DEFAULT.location,
  );
});
test("API uses the selected city, temperature and matching wind units", () => {
  const url = new URL(forecastUrl({ ...DEFAULT, units: "celsius" }));
  assert.equal(url.searchParams.get("temperature_unit"), "celsius");
  assert.equal(url.searchParams.get("wind_speed_unit"), "kmh");
  assert.equal(url.searchParams.get("forecast_days"), "5");
  assert.equal(url.searchParams.get("timezone"), "auto");
});
test("night, snow, fog, storm, unknown codes and missing temperatures render honestly", () => {
  assert.equal(condition(0, false).icon, "moon");
  assert.equal(condition(2, false).icon, "night-cloud");
  assert.equal(condition(48).icon, "fog");
  assert.equal(condition(77).icon, "snow");
  assert.equal(condition(99).icon, "storm");
  assert.equal(condition(null).icon, "unknown");
  assert.equal(rounded(null), "—");
  assert.equal(validWeather({ current: { temperature_2m: null } }), false);
  assert.equal(
    validWeather({ ...data, daily: { ...data.daily, time: ["bad"] } }),
    false,
  );
});
test("weather markup escapes untrusted city names and contains all five forecast days", () => {
  const html = widgetMarkup(
    "forecast",
    {
      ...DEFAULT,
      location: { ...DEFAULT.location, name: "<img src=x onerror=alert(1)>" },
    },
    { data },
  );
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;img"));
  assert.equal((html.match(/class="forecast-day"/g) || []).length, 5);
  assert.ok(
    !widgetMarkup("minimal", DEFAULT, { status: "error" }).includes("62°"),
  );
});
test("fresh cache avoids duplicate API calls; stale cache is labeled after an outage", async () => {
  let now = 1000000,
    calls = 0;
  const storage = memory();
  const source = new WeatherSource({
    storage,
    now: () => now,
    fetcher: async () => {
      calls++;
      return response(data);
    },
  });
  let states = [];
  await source.load(DEFAULT, (s) => states.push(s));
  assert.equal(states.at(-1).status, "ready");
  await source.load(DEFAULT, (s) => states.push(s));
  assert.equal(calls, 1);
  now += REFRESH_MS + 1;
  source.fetcher = async () => {
    throw new Error("offline");
  };
  await source.load(DEFAULT, (s) => states.push(s));
  assert.equal(states.at(-1).status, "error");
  assert.deepEqual(states.at(-1).data, data);
  now += MAX_CACHE_AGE;
  await source.load(DEFAULT, (s) => states.push(s));
  assert.equal(states.at(-1).data, null);
});
test("switching city or units never reuses weather from a different cache entry", async () => {
  const source = new WeatherSource({
    storage: memory(),
    fetcher: async () => response(data),
  });
  await source.load(DEFAULT, () => {});
  source.fetcher = async () => {
    throw new Error("offline");
  };
  let state;
  await source.load({ ...DEFAULT, units: "celsius" }, (s) => (state = s));
  assert.equal(state.data, null);
  await source.load(
    { ...DEFAULT, location: { name: "London", lat: 51.5, lon: -0.1 } },
    (s) => (state = s),
  );
  assert.equal(state.data, null);
});
test("a late response from the previous location cannot overwrite the current one", async () => {
  const requests = [];
  const source = new WeatherSource({
    storage: memory(),
    fetcher: () => new Promise((resolve) => requests.push(resolve)),
  });
  const states = [];
  const first = source.load(DEFAULT, (s) => states.push(s));
  const second = source.load({ ...DEFAULT, units: "celsius" }, (s) =>
    states.push(s),
  );
  const celsius = { ...data, current: { ...data.current, temperature_2m: 17 } };
  requests[1](response(celsius));
  await second;
  requests[0](response(data));
  await first;
  assert.equal(states.at(-1).data.current.temperature_2m, 17);
  assert.equal(states.filter((s) => s.status === "ready").length, 1);
});
test("unavailable storage, malformed payloads and HTTP errors do not crash", async () => {
  const storage = {
    getItem() {
      throw new Error();
    },
    setItem() {
      throw new Error();
    },
  };
  const source = new WeatherSource({
    storage,
    fetcher: async () => response(data),
  });
  let state;
  await source.load(DEFAULT, (s) => (state = s));
  assert.equal(state.status, "ready");
  source.fetcher = async () => response({});
  await source.load(DEFAULT, (s) => (state = s));
  assert.equal(state.status, "error");
  source.fetcher = async () => ({ ok: false });
  await source.load(DEFAULT, (s) => (state = s));
  assert.equal(state.data, null);
});
test("native fetch is invoked without binding the weather source as this", async () => {
  let receiver;
  const source = new WeatherSource({
    fetcher: async function () {
      receiver = this;
      return response(data);
    },
  });
  await source.load(DEFAULT, () => {});
  assert.equal(receiver, undefined);
});
