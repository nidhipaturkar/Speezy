# Speezy: Payment Routing Network (interactive prototype)

The whole site is one persistent, interactive world map. Scrolling never switches pages or sections. It changes what is happening on the same map:

explore → country labels → connect two countries → currency pair + live rate → payment surfaces → route discovery (3 candidate paths) → route construction → foreign checkout paid through a familiar method

Any country can be connected to any other country.

## Run it

You don't need a build step or `npm install`.

- **Simplest:** double-click `index.html`. It opens in Chrome, Edge, Firefox or Safari.
- **In VS Code:** open the folder, right-click `index.html` and choose **Open with Live Server** (this needs the *Live Server* extension). Or run `npx serve .` from the folder.

The map data and libraries are bundled locally, so the map works offline. The live FX rates need an internet connection.

## How to use it

| Action | How |
|---|---|
| Hover a country | Shows its name and currency |
| Pick a source | Click a country |
| Connect a destination | Press on a country and **drag** to another one, or click a second country |
| Advance the story | Scroll |
| Zoom | `Ctrl/⌘ + scroll`, trackpad pinch, or the `+ − ⟲` buttons |
| Pan | Drag the ocean |
| Start over | Click any country, or press `Esc` |

On touch screens: tap one country, then tap a second one. One-finger swipes scroll the story.

If you scroll past the "connect" step without picking two countries, the map uses an example pair (Japan → Brazil) and labels it as an example.

## Project structure

```
index.html            One environment: map SVG, flow overlay SVG, light HUD
styles.css            Visual system (terminal-grade, quiet, no neon)
app.js                Map, interaction, scroll state machine, FX, route model
data/countries.js     237 countries keyed by ISO-3166 numeric:
                      name, iso2, iso3, currency, symbol, region, capital, lat/lon
data/world-50m.js     world-atlas@2 countries-50m TopoJSON (Natural Earth, public domain)
lib/d3.min.js         D3 v7
lib/topojson-client.min.js
```

## Live FX

The app fetches USD-based rates and computes any cross rate as `rates[B] / rates[A]`. For example, JPY→BRL never goes through a hard-coded USD display. It tries these sources in order:

1. `open.er-api.com/v6/latest/USD`
2. `cdn.jsdelivr.net/npm/@fawazahmed0/currency-api` (fallback)
3. `latest.currency-api.pages.dev` (mirror of #2)
4. `api.frankfurter.app` (ECB rates, fewer currencies)

- It checks again every **45 seconds** (`FX_REFRESH_MS` in `app.js`). It shows **UPDATED hh:mm:ss**, which is the last successful retrieval, along with the source and the source's own publish time.
- If every source fails, it keeps showing the **last successfully retrieved** rates, marked **STALE**. Those rates are also cached in `localStorage`, so they survive a reload.
- If there is no data at all, it shows **RATE UNAVAILABLE**. The checkout says it can't give a quote. It never makes up a number.
- Note: these free, keyless feeds publish new rates about **once a day**. Polling every 45 seconds picks up a new publish as soon as it appears, but the numbers won't change minute by minute. For intraday ticks, swap in a paid feed. Add it as the first entry of `FX_SOURCES` (each entry needs a `url` and a `parse()`).

## What is real and what is modeled

- **Real:** the geography, the country/currency data, and the FX rates.
- **Illustrative:** the payment surfaces (UPI, PIX, ACH, PayPay, SEPA Instant…), which are labeled *Supported payment surfaces*. Edit them in `SURFACES` in `app.js`.
- **Modeled:** the candidate routes and their fee, success rate and ETA. They're labeled **MODELED / SIMULATED**. The three paths are:
  - **A: card rail** via an acquirer hub (New York, London or Frankfurt)
  - **B: correspondent** via the nearest FX hub
  - **C: Speezy route**: the buyer's familiar method → Speezy → FX → the fastest local rail at the destination

  The winner is whichever scores best on `success − 3·fee − 2·log10(eta)`. The numbers come from currency liquidity plus a small deterministic variation per pair. To plug in a real engine, replace `buildRoutes()`.
- **Restricted corridors:** a few corridors are shown as "0 viable paths" (`RESTRICTED` in `app.js`). This is an illustrative screening rule.

## Tested

The prototype was tested in headless Chrome at 1440×880 and with a mobile viewport (390×844, touch). The checks covered:

- the page and map load; all 237 countries can be hit at default zoom
- Japan → JPY; Japan + Brazil → JPY→BRL with the cross rate
- payment surfaces appear for both countries
- the route line, candidate paths, selected route and moving particles all render
- only one text panel is visible at a time; the map stays fixed
- the ticker refreshes
- primary failure → fallback; total failure → STALE; no data and no cache → no number shown
- drag-to-connect works; choosing a new pair resets the flow
- other pairs work (USD→INR, INR→SGD, EUR→JPY, BRL→EUR, AUD→AED, EUR→EUR, KES→MXN, NOK→CLP)

The FX endpoints were mocked during testing, so check the live feed once on your own network.
