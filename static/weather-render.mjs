import { condition, dayLabel, rounded } from "./weather-core.mjs";
export function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
// Inline SVG keeps the weather symbols consistent without an icon service.
export function icon(kind) {
  const sun =
    '<circle cx="30" cy="29" r="13" fill="#f5bd4b"/><path d="M30 7v5m0 34v5M8 29h5m34 0h5M14 13l4 4m24 24 4 4M14 45l4-4m24-24 4-4" stroke="#e9ae36" stroke-width="3" stroke-linecap="round"/>';
  const moon =
    '<path d="M38 10a22 22 0 1 0 16 34A23 23 0 0 1 38 10" fill="#d9e8f9" stroke="#98b9d4" stroke-width="1.5"/>';
  const cloud =
    '<path d="M21 51h30a12 12 0 0 0 0-24 17 17 0 0 0-32-3 14 14 0 0 0 2 27" fill="#e9f2f8" stroke="#9ab8ce" stroke-width="1.5"/>';
  let art =
    kind === "sun"
      ? sun
      : kind === "moon"
        ? moon
        : kind === "partly" || kind === "night-cloud"
          ? `<g transform="translate(-3 -6) scale(.85)">${kind === "partly" ? sun : moon}</g>${cloud}`
          : cloud;
  if (kind === "rain" || kind === "storm")
    art +=
      '<path d="m24 57-3 7m16-7-3 7m16-7-3 7" stroke="#63a8d8" stroke-width="3" stroke-linecap="round"/>';
  if (kind === "storm")
    art += '<path d="m39 35-11 18h9l-4 15 16-23H38l5-10" fill="#f4bd45"/>';
  if (kind === "snow")
    art +=
      '<g fill="#84b4d1"><circle cx="23" cy="60" r="3"/><circle cx="38" cy="64" r="3"/><circle cx="52" cy="59" r="3"/></g>';
  if (kind === "fog")
    art =
      '<path d="M12 24h48M6 36h48M16 48h48" stroke="#9db6c5" stroke-width="5" stroke-linecap="round"/>';
  if (kind === "unknown")
    art =
      '<circle cx="36" cy="36" r="24" fill="none" stroke="#9db6c5" stroke-width="2"/><path d="M25 36h22" stroke="#9db6c5" stroke-width="3"/>';
  return `<svg class="weather-icon" viewBox="0 0 72 72" aria-hidden="true">${art}</svg>`;
}
export function widgetMarkup(preset, settings, state = {}) {
  const { data, status } = state,
    cur = data?.current,
    daily = data?.daily;
  const wx = condition(cur?.weather_code, cur?.is_day !== 0);
  const unit = settings.units === "celsius" ? "C" : "F";
  const location = `<div><p class="widget-city">${escapeHtml(settings.location.name)}</p><p class="widget-region">${escapeHtml(settings.location.region)}</p></div>`;
  const top = `<div class="widget-top">${location}<span class="widget-kicker">${preset === "forecast" ? "5-day outlook" : "Current weather"}</span></div>`;
  const now = cur
    ? `<div class="widget-now"><div><div class="widget-temp">${rounded(cur.temperature_2m)}°<span class="widget-unit">${unit}</span></div><p class="widget-condition">${wx.label}</p></div>${icon(wx.icon)}</div>`
    : `<div class="widget-empty">${icon("unknown")}${status === "error" ? "Weather is temporarily unavailable.<br>Please try again." : "Loading your forecast…"}</div>`;
  let bottom = "";
  if (cur && preset === "forecast") {
    bottom = `<div class="forecast-days">${daily.time
      .slice(0, 5)
      .map((date, i) => {
        const forecast = condition(daily.weather_code[i]);
        const rain = daily.precipitation_probability_max?.[i];
        return `<div class="forecast-day"><span>${dayLabel(date, i)}</span><span role="img" aria-label="${forecast.label}">${icon(forecast.icon)}</span><div><strong>${rounded(daily.temperature_2m_max[i])}°</strong><span class="forecast-low">${rounded(daily.temperature_2m_min[i])}°</span></div><div class="rain-chance" aria-label="Precipitation probability ${rounded(rain)} percent">${Number.isFinite(rain) ? rounded(rain) + "% precip." : "—"}</div></div>`;
      })
      .join("")}</div>`;
  } else if (cur) {
    bottom = `<div class="widget-bottom"><span>H <strong>${rounded(daily.temperature_2m_max[0])}°</strong></span><span>L <strong>${rounded(daily.temperature_2m_min[0])}°</strong></span><span class="feels">Feels like <strong>${rounded(cur.apparent_temperature)}°</strong></span></div>`;
  }
  return `<article class="weather-widget widget-${preset}${cur?.is_day === 0 ? " is-night" : ""}" aria-label="${escapeHtml(preset)} weather for ${escapeHtml(settings.location.name)}">${top}${now}${bottom}</article>`;
}
