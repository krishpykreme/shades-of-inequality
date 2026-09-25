# 🌡️ Shades of Inequality
### Mapping Sydney's Urban Heat Divide

An interactive data visualisation dashboard exposing how Sydney's tree canopy, and therefore its heat, is distributed by wealth rather than ecology.

**[→ View Live Demo](https://krishpykreme.github.io/shades-of-inequality/)** &nbsp;|&nbsp; Built for DECO3100, University of Sydney

---

## TL;DR

- 🗺️ Choropleth map of all **33 Sydney LGAs** across Canopy, Heat, and Wealth layers
- 📉 Statistical backbone: **R² = 0.62**, canopy predicts a **-0.19°C** temperature drop per 1% gain
- 🔗 Wealth-canopy correlation of **r = -0.81**, sourced from a University of Sydney 2016-2022 study
- 🧮 A "What If?" simulator and budget calculator that turns canopy targets into real planting costs
- 🧪 Validated through usability testing with 5 participants across two rounds of iteration

---

## The Problem

This project started with a personal observation. My suburb felt noticeably hotter than the leafier parts of inner-north Sydney. That feeling turned into a question: is tree canopy distributed by chance, or by wealth?

The answer, backed by three independent datasets, is wealth. This dashboard makes that case visually and lets the viewer feel the "so what" instead of just reading it.

It's built for two audiences. The public, who may never have thought about inequality having an environmental dimension. And civic planners, who need data to justify greening investment where it matters most.

---

## The Data

| Source | What it gives the project |
|---|---|
| NSW SEED (2019 / 2022) | LGA-level tree canopy % from satellite imagery |
| ABS 2021 Census (Table G33) | Median household income per LGA |
| Bureau of Meteorology (Feb 2026) | Observatory Hill vs Penrith Lakes station data, the "Postcode Penalty" |
| NSW Greening Our City Grant (2026) | Real cost basis for the budget calculator ($417/tree) |
| Treenet + i-Tree | Maintenance cost ($25/tree/yr) and ecosystem return ($126/tree/yr) |

Plotting canopy against summer peak temperature across all 33 LGAs gave a linear regression of **R² = 0.62**. That coefficient powers every projection in the simulator.

---

## How It Works

Six scroll-driven sections build one argument, from problem to solution.

1. **Hero** — sets the emotional tone
2. **Narrative Comparison** — Ku-ring-gai vs Cumberland, side by side
3. **Choropleth Map** — toggle between Canopy, Heat, and Wealth
4. **Ranked Strip** — all 33 LGAs, ranked
5. **Line Chart** — Observatory Hill vs Penrith Lakes, the temperature gap
6. **Simulator + Budget Calculator** — drag a canopy target, see the °C saved and the $ it would cost

The visual language borrows from National Geographic's editorial style. Left-aligned hero, oversized stacked type, DM Serif Display for headings, DM Sans for data labels. A green-to-red gradient carries the temperature story through every chart.

---

## Usability Testing

Tested with 5 participants using Think Aloud plus a Likert-scale questionnaire. The cohort spanned low to moderate geospatial tool familiarity, matching the project's real audience.

**What broke, and what I changed:**

| Issue found | Fix shipped |
|---|---|
| Map fill too dense, city names unreadable | Base opacity dropped 0.78 → 0.58 |
| Income scale too compressed to read | Widened to a 7-step high-contrast gradient |
| Slider didn't look draggable, got missed entirely | Bigger thumb, green border, always visible at 40% opacity |
| Second map (Section 5) went undiscovered | Added an animated scroll prompt + progress dots |
| No way to turn a canopy target into action | Built the Budget Calculator, directly from a participant's suggestion |

That last one came straight from a participant who wanted to see planting costs, not just temperature numbers, so an urban planner could take this to local government as a funding case. That single line of feedback became an entire new dashboard section.

---

## Tech Stack

- **Leaflet.js 1.9.4** — LGA choropleth rendering
- **Chart.js 4.4.1** — line and comparison charts
- **CartoDB Positron** — base map tiles
- **NSW Spatial ArcGIS FeatureServer** — live LGA boundary data, with an embedded GeoJSON fallback for zero-dependency loading
- **DM Serif Display / DM Sans** — typography, via Google Fonts
- Vanilla HTML, CSS, and JS. No framework overhead, kept deliberately lightweight.

---

## A Note on AI Use

Claude AI was used as a technical coding assistant for parts of the build, mainly debugging a Leaflet.js race condition and designing the 3-tier GeoJSON fetch strategy after suburb-level boundary matching kept failing. All narrative content, data sourcing, design direction, and structural decisions are my own. Full session context available on request.

---

## References

Full citation list, including NSW SEED, ABS Census, Bureau of Meteorology, and design references (National Geographic, Bloomberg), is in [`/docs/documentation.pdf`](./docs).

---

## Run It Locally

```bash
git clone https://github.com/your-username/shades-of-inequality.git
cd shades-of-inequality
open index.html
```

No build step. No dependencies to install. Just open it.

---

**Krishnendhu Remesh** · Interaction Design, University of Sydney
[Portfolio](https://krishnendhuremesh.framer.website) · [LinkedIn](https://www.linkedin.com/in/krishnendhuremesh)
