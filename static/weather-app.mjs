import {
  PRESETS,
  REFRESH_MS,
  WeatherSource,
  normalizeSettings,
  settingsFromQuery,
  displayQuery,
  readStored,
  writeStored,
  validLocation,
} from "./weather-core.mjs";
import { widgetMarkup, escapeHtml } from "./weather-render.mjs";
const $ = (id) => document.getElementById(id);
const KEY = "digisign:weather-settings:v1";
let storage;
try {
  storage = window.localStorage;
} catch {
  /* Private browsing can deny storage. */
}
let settings = settingsFromQuery(location.search, readStored(storage, KEY));
let state = { status: "loading", data: null };
const isDisplay = document.body.dataset.view === "display";
const source = new WeatherSource({ storage });
let timer;

function render() {
  $("widget-preview").innerHTML = widgetMarkup(
    settings.preset,
    settings,
    state,
  );
  const fetched = state.savedAt
    ? new Date(state.savedAt).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
  $("weather-status").textContent =
    state.status === "loading"
      ? state.data
        ? `Refreshing · Showing saved weather from ${fetched}`
        : "Loading live weather…"
      : state.status === "error"
        ? state.data
          ? `Connection unavailable · Showing saved weather from ${fetched}`
          : "Could not load weather. Check your connection and try again."
        : `Updated ${fetched} · Refreshes every 10 minutes`;
  $("retry").hidden = state.status !== "error";
  if (isDisplay) {
    $("back-to-editor").href = "index.html?" + displayQuery(settings);
    document.title = `${settings.location.name} weather · DigiSign`;
    return;
  }
  document.querySelector(".preview-badge").textContent =
    state.status === "ready"
      ? "LIVE WEATHER"
      : state.data
        ? "SAVED WEATHER"
        : state.status === "error"
          ? "UNAVAILABLE"
          : "CONNECTING";
  $("location-label").textContent = settings.location.name;
  $("region-label").textContent = settings.location.region;
  $("selected-name").textContent = PRESETS.find(
    (p) => p.id === settings.preset,
  ).name;
  $("open-display").href = "display.html?" + displayQuery(settings);
  document.querySelectorAll('input[name="units"]').forEach((el) => {
    el.checked = el.value === settings.units;
  });
  // Update existing buttons so keyboard focus survives a selection or refresh.
  for (const preset of PRESETS) {
    const button = document.querySelector(`[data-preset="${preset.id}"]`);
    button.setAttribute("aria-pressed", String(preset.id === settings.preset));
    button.querySelector(".selection-circle").textContent =
      preset.id === settings.preset ? "✓" : "";
    button.querySelector(".widget-host").innerHTML = widgetMarkup(
      preset.id,
      settings,
      state,
    );
  }
}
function save() {
  const saved = writeStored(storage, KEY, settings);
  // A return link carries explicit settings; keep it in sync on later edits.
  if (!isDisplay && location.search)
    history.replaceState(
      null,
      "",
      location.pathname + "?" + displayQuery(settings),
    );
  if (!isDisplay)
    $("save-status").textContent = saved
      ? "Selection saved on this browser."
      : "Storage unavailable. Open display to keep your selection in its link.";
}
async function loadWeather() {
  clearTimeout(timer);
  await source.load(settings, (next) => {
    state = next;
    render();
  });
  // Scheduling after completion prevents simultaneous refresh requests.
  clearTimeout(timer);
  timer = setTimeout(loadWeather, REFRESH_MS);
}
if (!isDisplay) {
  $("preset-list").innerHTML = PRESETS.map(
    (p) =>
      `<button type="button" class="preset-option" data-preset="${p.id}" aria-label="Select ${p.name} widget" aria-pressed="false"><div class="thumbnail" aria-hidden="true"><div class="widget-host"></div></div><div class="preset-meta"><strong>${p.name}</strong><span class="selection-circle" aria-hidden="true"></span></div><p class="preset-description">${p.description}</p></button>`,
  ).join("");
  $("preset-list").addEventListener("click", (event) => {
    const button = event.target.closest("[data-preset]");
    if (!button) return;
    settings = normalizeSettings({
      ...settings,
      preset: button.dataset.preset,
    });
    save();
    render();
  });
  document.querySelectorAll('input[name="units"]').forEach((el) =>
    el.addEventListener("change", () => {
      settings.units = el.value;
      save();
      loadWeather();
    }),
  );
  let searchController,
    searchSequence = 0,
    results = [];
  const input = $("city-search"),
    feedback = $("search-feedback"),
    resultsEl = $("city-results");
  function clearSearch() {
    ++searchSequence;
    searchController?.abort();
    results = [];
    resultsEl.innerHTML = "";
    feedback.textContent = "";
    $("search-button").disabled = false;
  }
  input.addEventListener("input", clearSearch);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") clearSearch();
  });
  $("city-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    clearSearch();
    const query = input.value.trim();
    if (query.length < 2) {
      feedback.textContent = "Enter at least two characters.";
      return;
    }
    const sequence = searchSequence;
    const controller = (searchController = new AbortController());
    const timeout = setTimeout(() => controller.abort(), 10000);
    feedback.textContent = "Searching…";
    $("search-button").disabled = true;
    try {
      const response = await fetch(
        "https://geocoding-api.open-meteo.com/v1/search?" +
          new URLSearchParams({
            name: query,
            count: "5",
            language: "en",
            format: "json",
          }),
        { signal: controller.signal },
      );
      if (!response.ok) throw new Error();
      const body = await response.json();
      if (sequence !== searchSequence) return;
      results = (Array.isArray(body.results) ? body.results : [])
        .map((r) => ({
          name: r.name,
          region: [r.admin1, r.country_code].filter(Boolean).join(", "),
          lat: r.latitude,
          lon: r.longitude,
        }))
        .filter(validLocation);
      feedback.textContent = results.length
        ? "Choose a matching location below."
        : "No cities found. Try a nearby city or add a country.";
      resultsEl.innerHTML = results
        .map(
          (r, i) =>
            `<button type="button" data-result="${i}">${escapeHtml(r.name)}<small>${escapeHtml(r.region)}</small></button>`,
        )
        .join("");
    } catch {
      if (sequence === searchSequence)
        feedback.textContent = "City search is unavailable. Please try again.";
    } finally {
      clearTimeout(timeout);
      if (sequence === searchSequence) $("search-button").disabled = false;
    }
  });
  resultsEl.addEventListener("click", (event) => {
    const button = event.target.closest("[data-result]");
    if (!button) return;
    settings.location = results[Number(button.dataset.result)];
    clearSearch();
    input.value = "";
    input.focus();
    save();
    loadWeather();
  });
}
$("retry").addEventListener("click", loadWeather);
window.addEventListener("online", loadWeather);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) loadWeather();
});
save();
render();
loadWeather();
