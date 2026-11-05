# DigiSign

Digital signage project with four ready-made weather widgets—**Minimal**, **Dark**, **Sky**, and **Forecast**—and a guided custom widget editor.

## Run locally

With Node.js 22 or newer:

```sh
npm start
```

Open http://127.0.0.1:4173. No dependencies or build step are required. Alternatively, serve this folder with any static HTTP server. Use HTTP rather than opening an HTML file directly, because the JavaScript uses ES modules.

## Use the widgets

1. Search for a city and select the matching location. Boston is the default.
2. Choose Fahrenheit or Celsius.
3. Select Minimal, Dark, Sky, or Forecast. Each thumbnail and the large preview use the same real weather data.
4. Select **Open display** for the selected widget's display page. Its URL includes the style, city coordinates, and units, so it can be bookmarked, shared, or embedded in a signage layout using an iframe.

Selection is saved in this browser, not in a server account. The display URL also works when local storage is unavailable.

## Make a custom widget

Choose **Make my widget** to open a three-step editor beside a live preview:

1. **Choose a look:** select a background color or use the color picker. Text switches automatically to a readable color. Add an optional heading, or leave it blank to show just the city.
2. **Choose what to show:** select today, three days, or five days. Turn weather pictures, feels-like temperature, and today's high/low on or off. Current temperature and conditions always remain visible.
3. **Make it easy to read:** choose Standard or Bigger text, then select **Use this widget** to save and select the design.

**Undo last change** reverses an edit. **Start over** restores the default design and can itself be undone. **Cancel** discards design changes and returns to the previous selection. City and temperature-unit settings apply immediately, independently of the design draft.

After saving, **Edit my widget** reopens the design and **Use my saved widget** restores it after trying a preset. **Open display** includes every custom design option in its link, so the appearance is preserved when bookmarked or opened on another screen. An imported custom design remains available locally after switching presets and reloading.

The original drag-and-drop proof of concept is preserved at `layout-prototype.html` and linked from the header. The weather display is not yet integrated into that prototype's drag-and-drop editor.

## Weather behavior

- Current temperature, conditions, high/low and feels-like temperature for Minimal, Dark, and Sky.
- Sky changes to a night palette after sunset according to the API's day/night flag.
- Forecast shows today and the next four days, including highs, lows, conditions, and precipitation probability.
- Data comes from [Open-Meteo Forecast API](https://open-meteo.com/en/docs); city search uses its [Geocoding API](https://open-meteo.com/en/docs/geocoding-api). Attribution is visible in both views. This student project uses the free noncommercial API; commercial use requires reviewing the provider's terms and plan.
- Refreshes every 10 minutes and when the page becomes visible or the network reconnects. Fresh cached responses avoid redundant requests.
- Network requests time out, late responses from previous selections are ignored, and stored data is scoped by coordinates and units.
- On failure, saved data less than 24 hours old is shown with its retrieval time and an explicit connection warning. Older saved data is not displayed. With no usable data, an unavailable state and retry control appear. There is no fabricated fallback weather.

## Files and testing

`static/weather-core.mjs` handles settings, API requests and caching. `static/weather-render.mjs` renders the reusable widgets. `static/weather-app.mjs` connects the selector and display pages. `static/custom-editor.mjs` manages the guided editor, temporary design draft, and undo history. Styling is isolated in `static/weather.css`, leaving the original prototype CSS and JavaScript intact.

```sh
npm test
```

Tests cover display-link round trips, input validation, units, weather codes, escaped location names, forecast rendering, outages, storage failure, cache expiration, and overlapping requests. Custom-widget tests cover all serialized design options, invalid colors and settings, escaped headings, readable color contrast, layout day counts, and optional details.

Manual browser checks: select each preset, switch units, choose a search result, refresh to verify persistence, open the display, return to the selector, and check narrow and wide layouts. In the custom editor, check every step, Undo, Start over, Cancel, applying a design, re-editing it, and restoring it after a preset switch. Check shared custom links in a fresh browser, long headings, Bigger text, and forecasts with pictures switched off. Only the original prototype has drag-and-drop functionality; the custom weather editor uses guided controls.
