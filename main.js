// main.js
// DECO3100 — Krishnendhu Remesh (KREM0023)
// Project: Shades of Inequality — Mapping Sydney's Urban Heat Divide
//
// This file contains all the interactive JavaScript for the dashboard.
// It depends on:
//   - Leaflet.js (inlined in shades_of_inequality.html — must load before this file)
//   - Chart.js   (loaded from CDN in shades_of_inequality.html)
//   - suburbs.js (must load before this file — provides window.SUBURBS array)
//
// Sections in this file:
//   1.  Scroll fade-in observer
//   2.  LGA choropleth map (Section 2 of the page) — uses Leaflet.js
//   3.  Canopy ranked strip (Section 3)
//   4.  Temperature line chart (Section 4) — uses Chart.js
//   5.  LGA simulator map (Section 5) — uses Leaflet.js
//   6.  Budget calculator (Section 6)
//   7.  Scroll progress dots + future projection badge (usability additions)
//   8.  Bootstrap / init

// ── SECTION 1: SCROLL FADE-IN ──────────────────────────────────────────────
// Used by: all .fade-in elements across every section in shades_of_inequality.html
// Watches each .fade-in element with IntersectionObserver; adds .visible class
// once the element enters the viewport, triggering the CSS opacity/transform transition.
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));



// ── SECTION 2: LGA CHOROPLETH MAP ───────────────────────────────────────────
// Used by: #lgaLeafletMap div in shades_of_inequality.html (Section 2 — "The Lockstep")
//
// This is the main interactive map showing canopy cover, heat risk, or median income
// per LGA across Greater Sydney. I built it using Leaflet.js with a CartoDB Positron
// tile base and a GeoJSON choropleth layer coloured by whichever data mode is active.
//
// NOTE ON AI ASSISTANCE (Claude AI — claude.ai):
// The map boundary fetching and fallback strategy was developed with help from Claude AI.
// Specifically, I asked Claude to help me figure out why the NSW ArcGIS FeatureServer
// returned 403 errors when fetched server-side (Python) but worked fine in the browser.
// Claude explained the CORS/User-Agent difference and suggested the 3-tier fetch strategy:
//   1. NSW Spatial FeatureServer (portal.spatial.nsw.gov.au) — official ABS 2021 LGA polygons
//   2. ABS ArcGIS MapServer ASGS2021 — backup official source
//   3. Embedded FALLBACK_GEOJSON below — hand-approximated polygons, renders instantly
// I also used Claude to help write the enrichFeature() name-matching logic that joins
// the ArcGIS feature names (e.g. "FAIRFIELD COUNCIL") to our CANOPY_DATA keys ("fairfield").
// The colour scale functions (canopyFill, heatFill, incomeFill) and the LGA data panel
// HTML were written by me; Claude helped debug the tile visibility issue caused by
// Leaflet's default mix-blend-mode: plus-lighter on overlapping tile layers.

// CANOPY_DATA — keyed by normalised LGA name (lowercase, no "council/shire/city" suffix)
// Source: NSW SEED 2022 & 2019 canopy data; ABS 2021 Census income; BOM 2026 peak temps
// Referenced by: enrichFeature(), renderLeafletMode(), initSimulator()
const CANOPY_DATA = {
  'ku-ring-gai':           {c22:44,c19:42,income:3075,peak:29.9},
  'hornsby':               {c22:42,c19:40,income:2519,peak:30.7},
  'northern beaches':      {c22:34,c19:32,income:2100,peak:30.5},
  'the hills shire':       {c22:29,c19:27,income:2000,peak:34.1},
  'the hills':             {c22:29,c19:27,income:2000,peak:34.1},
  'hawkesbury':            {c22:35,c19:33,income:1750,peak:33.0},
  'blue mountains':        {c22:60,c19:58,income:1620,peak:31.0},
  'penrith':               {c22:16,c19:15,income:1748,peak:37.7},
  'blacktown':             {c22:18,c19:16,income:1550,peak:37.4},
  'parramatta':            {c22:25,c19:23,income:1800,peak:35.5},
  'cumberland':            {c22:13,c19:12,income:1660,peak:38.5},
  'fairfield':             {c22:10,c19:9, income:1380,peak:39.3},
  'liverpool':             {c22:14,c19:13,income:1480,peak:38.2},
  'camden':                {c22:14,c19:13,income:1600,peak:38.2},
  'campbelltown':          {c22:18,c19:17,income:1550,peak:37.1},
  'canterbury-bankstown':  {c22:16,c19:15,income:1580,peak:37.7},
  'inner west':            {c22:19,c19:18,income:1680,peak:37.4},
  'city of sydney':        {c22:20,c19:19,income:1900,peak:36.6},
  'sydney':                {c22:20,c19:19,income:1900,peak:36.6},
  'bayside':               {c22:15,c19:14,income:1620,peak:37.8},
  'randwick':              {c22:16,c19:15,income:1900,peak:36.0},
  'woollahra':             {c22:22,c19:21,income:2800,peak:35.0},
  'north sydney':          {c22:29,c19:28,income:2300,peak:35.2},
  'willoughby':            {c22:30,c19:29,income:2100,peak:33.9},
  'mosman':                {c22:35,c19:33,income:3100,peak:32.5},
  'lane cove':             {c22:40,c19:38,income:2400,peak:31.2},
  'ryde':                  {c22:28,c19:27,income:1950,peak:34.4},
  'hunters hill':          {c22:35,c19:33,income:2300,peak:32.5},
  'canada bay':            {c22:22,c19:21,income:1950,peak:35.8},
  'strathfield':           {c22:17,c19:16,income:1750,peak:37.4},
  'burwood':               {c22:15,c19:14,income:1700,peak:38.0},
  'georges river':         {c22:21,c19:20,income:1700,peak:36.5},
  'sutherland shire':      {c22:29,c19:27,income:1880,peak:34.4},
  'sutherland':            {c22:29,c19:27,income:1880,peak:34.4},
  'wollondilly':           {c22:30,c19:28,income:1580,peak:33.5},
};

// FALLBACK_GEOJSON — approximate LGA boundary polygons embedded directly in this file.
// Used immediately on map init so the map shows without any network delay.
// If the live ArcGIS fetch succeeds, these are silently replaced with the official
// higher-detail ABS 2021 boundaries. Hand-approximated centroids/shapes by me;
// Claude AI helped convert the coordinate structure to valid GeoJSON format.
const FALLBACK_GEOJSON = {"type":"FeatureCollection","features":[{"type":"Feature","properties":{"LGA_NAME":"Ku-ring-gai","canopy_2022":44,"canopy_2019":42,"income":3075,"peak_temp":29.9},"geometry":{"type":"Polygon","coordinates":[[[151.048,-33.645],[151.068,-33.638],[151.088,-33.64],[151.108,-33.645],[151.128,-33.652],[151.148,-33.662],[151.165,-33.675],[151.178,-33.69],[151.188,-33.705],[151.195,-33.722],[151.198,-33.74],[151.195,-33.758],[151.188,-33.77],[151.178,-33.778],[151.165,-33.785],[151.148,-33.792],[151.138,-33.808],[151.125,-33.815],[151.112,-33.815],[151.098,-33.81],[151.085,-33.8],[151.068,-33.792],[151.052,-33.782],[151.038,-33.772],[151.025,-33.76],[151.018,-33.745],[151.012,-33.728],[151.005,-33.712],[150.998,-33.695],[150.99,-33.678],[150.985,-33.66],[150.992,-33.645],[151.008,-33.638],[151.028,-33.635],[151.048,-33.645]]]}},{"type":"Feature","properties":{"LGA_NAME":"Hornsby","canopy_2022":42,"canopy_2019":40,"income":2519,"peak_temp":30.7},"geometry":{"type":"Polygon","coordinates":[[[150.88,-33.535],[150.92,-33.535],[150.96,-33.535],[151.0,-33.535],[151.04,-33.535],[151.08,-33.535],[151.12,-33.535],[151.15,-33.54],[151.18,-33.548],[151.21,-33.558],[151.24,-33.57],[151.262,-33.582],[151.27,-33.598],[151.272,-33.615],[151.268,-33.632],[151.258,-33.645],[151.242,-33.655],[151.22,-33.66],[151.2,-33.66],[151.185,-33.658],[151.175,-33.652],[151.165,-33.642],[151.148,-33.635],[151.128,-33.628],[151.108,-33.622],[151.088,-33.618],[151.068,-33.615],[151.048,-33.618],[151.028,-33.625],[151.012,-33.635],[150.998,-33.648],[150.99,-33.662],[150.985,-33.678],[150.98,-33.695],[150.965,-33.705],[150.948,-33.712],[150.93,-33.718],[150.91,-33.722],[150.892,-33.72],[150.878,-33.712],[150.868,-33.698],[150.862,-33.682],[150.86,-33.665],[150.862,-33.648],[150.868,-33.632],[150.875,-33.618],[150.88,-33.6],[150.88,-33.568],[150.88,-33.535]]]}},{"type":"Feature","properties":{"LGA_NAME":"Northern Beaches","canopy_2022":34,"canopy_2019":32,"income":2100,"peak_temp":30.5},"geometry":{"type":"Polygon","coordinates":[[[151.262,-33.582],[151.272,-33.598],[151.29,-33.608],[151.312,-33.615],[151.335,-33.62],[151.358,-33.622],[151.38,-33.62],[151.398,-33.612],[151.412,-33.6],[151.422,-33.585],[151.428,-33.568],[151.428,-33.55],[151.422,-33.535],[151.41,-33.52],[151.395,-33.508],[151.375,-33.498],[151.35,-33.492],[151.325,-33.49],[151.3,-33.49],[151.278,-33.492],[151.258,-33.498],[151.24,-33.505],[151.225,-33.515],[151.212,-33.525],[151.202,-33.538],[151.195,-33.552],[151.192,-33.568],[151.195,-33.582],[151.202,-33.595],[151.212,-33.605],[151.225,-33.612],[151.24,-33.618],[151.258,-33.622],[151.262,-33.628],[151.26,-33.642],[151.252,-33.655],[151.24,-33.665],[151.225,-33.672],[151.208,-33.676],[151.192,-33.675],[151.178,-33.668],[151.165,-33.658],[151.148,-33.645],[151.148,-33.662],[151.165,-33.675],[151.178,-33.69],[151.188,-33.705],[151.195,-33.722],[151.198,-33.74],[151.212,-33.748],[151.228,-33.752],[151.245,-33.75],[151.26,-33.742],[151.272,-33.73],[151.28,-33.715],[151.285,-33.698],[151.285,-33.68],[151.28,-33.662],[151.272,-33.648],[151.262,-33.635],[151.258,-33.618],[151.262,-33.602],[151.268,-33.59],[151.272,-33.578],[151.268,-33.565],[151.262,-33.582]]]}},{"type":"Feature","properties":{"LGA_NAME":"The Hills","canopy_2022":29,"canopy_2019":27,"income":2000,"peak_temp":34.1},"geometry":{"type":"Polygon","coordinates":[[[150.64,-33.535],[150.7,-33.535],[150.76,-33.535],[150.82,-33.535],[150.88,-33.535],[150.88,-33.568],[150.88,-33.6],[150.875,-33.618],[150.868,-33.632],[150.862,-33.648],[150.86,-33.665],[150.862,-33.682],[150.868,-33.698],[150.878,-33.712],[150.892,-33.72],[150.908,-33.728],[150.922,-33.735],[150.935,-33.742],[150.948,-33.75],[150.958,-33.76],[150.965,-33.772],[150.968,-33.785],[150.968,-33.8],[150.962,-33.815],[150.952,-33.828],[150.938,-33.838],[150.922,-33.845],[150.905,-33.848],[150.888,-33.848],[150.872,-33.842],[150.858,-33.832],[150.845,-33.82],[150.835,-33.808],[150.828,-33.792],[150.822,-33.775],[150.818,-33.758],[150.815,-33.74],[150.812,-33.722],[150.808,-33.705],[150.802,-33.688],[150.795,-33.672],[150.785,-33.658],[150.772,-33.645],[150.758,-33.635],[150.742,-33.628],[150.725,-33.622],[150.708,-33.618],[150.69,-33.616],[150.672,-33.615],[150.654,-33.615],[150.636,-33.615],[150.618,-33.616],[150.6,-33.618],[150.582,-33.622],[150.564,-33.626],[150.548,-33.631],[150.535,-33.638],[150.524,-33.648],[150.515,-33.659],[150.509,-33.672],[150.506,-33.686],[150.505,-33.7],[150.507,-33.714],[150.512,-33.727],[150.52,-33.738],[150.53,-33.748],[150.542,-33.756],[150.556,-33.762],[150.572,-33.765],[150.588,-33.766],[150.605,-33.764],[150.622,-33.76],[150.64,-33.752],[150.64,-33.7],[150.64,-33.64],[150.64,-33.582],[150.64,-33.535]]]}},{"type":"Feature","properties":{"LGA_NAME":"Hawkesbury","canopy_2022":35,"canopy_2019":33,"income":1750,"peak_temp":33.0},"geometry":{"type":"Polygon","coordinates":[[[150.4,-33.35],[150.5,-33.35],[150.6,-33.35],[150.7,-33.35],[150.8,-33.35],[150.88,-33.35],[150.91,-33.35],[150.91,-33.395],[150.91,-33.44],[150.91,-33.48],[150.91,-33.52],[150.91,-33.535],[150.88,-33.535],[150.84,-33.535],[150.8,-33.535],[150.76,-33.535],[150.72,-33.535],[150.68,-33.535],[150.64,-33.535],[150.64,-33.49],[150.64,-33.445],[150.64,-33.4],[150.64,-33.355],[150.6,-33.352],[150.56,-33.351],[150.52,-33.35],[150.48,-33.35],[150.44,-33.35],[150.4,-33.35]]]}},{"type":"Feature","properties":{"LGA_NAME":"Blue Mountains","canopy_2022":60,"canopy_2019":58,"income":1620,"peak_temp":31.0},"geometry":{"type":"Polygon","coordinates":[[[150.05,-33.35],[150.15,-33.35],[150.25,-33.35],[150.35,-33.35],[150.4,-33.35],[150.44,-33.35],[150.48,-33.35],[150.52,-33.35],[150.56,-33.351],[150.6,-33.352],[150.64,-33.355],[150.64,-33.4],[150.64,-33.445],[150.64,-33.49],[150.64,-33.535],[150.618,-33.616],[150.6,-33.618],[150.582,-33.622],[150.564,-33.626],[150.548,-33.631],[150.535,-33.638],[150.53,-33.648],[150.522,-33.658],[150.515,-33.668],[150.51,-33.68],[150.508,-33.692],[150.507,-33.705],[150.508,-33.718],[150.51,-33.73],[150.515,-33.742],[150.52,-33.752],[150.528,-33.762],[150.538,-33.77],[150.55,-33.778],[150.562,-33.784],[150.575,-33.788],[150.555,-33.8],[150.535,-33.812],[150.515,-33.82],[150.495,-33.825],[150.475,-33.828],[150.455,-33.828],[150.435,-33.826],[150.415,-33.822],[150.395,-33.815],[150.375,-33.806],[150.355,-33.795],[150.335,-33.782],[150.315,-33.768],[150.295,-33.752],[150.275,-33.736],[150.255,-33.718],[150.235,-33.7],[150.215,-33.682],[150.195,-33.664],[150.175,-33.646],[150.155,-33.628],[150.135,-33.612],[150.115,-33.596],[150.095,-33.58],[150.075,-33.565],[150.06,-33.55],[150.052,-33.535],[150.05,-33.52],[150.05,-33.47],[150.05,-33.42],[150.05,-33.37],[150.05,-33.35]]]}},{"type":"Feature","properties":{"LGA_NAME":"Penrith","canopy_2022":16,"canopy_2019":15,"income":1748,"peak_temp":37.7},"geometry":{"type":"Polygon","coordinates":[[[150.54,-33.535],[150.56,-33.535],[150.59,-33.535],[150.62,-33.535],[150.64,-33.535],[150.64,-33.57],[150.64,-33.61],[150.64,-33.65],[150.64,-33.69],[150.64,-33.73],[150.64,-33.765],[150.628,-33.778],[150.612,-33.79],[150.595,-33.8],[150.578,-33.808],[150.56,-33.814],[150.542,-33.818],[150.524,-33.82],[150.506,-33.82],[150.488,-33.818],[150.47,-33.814],[150.453,-33.808],[150.438,-33.8],[150.424,-33.79],[150.412,-33.778],[150.402,-33.765],[150.395,-33.75],[150.39,-33.735],[150.388,-33.718],[150.388,-33.7],[150.39,-33.682],[150.395,-33.665],[150.402,-33.648],[150.411,-33.633],[150.422,-33.619],[150.435,-33.607],[150.45,-33.597],[150.466,-33.589],[150.483,-33.583],[150.501,-33.579],[150.519,-33.577],[150.537,-33.577],[150.54,-33.535]]]}},{"type":"Feature","properties":{"LGA_NAME":"Blacktown","canopy_2022":18,"canopy_2019":16,"income":1550,"peak_temp":37.4},"geometry":{"type":"Polygon","coordinates":[[[150.808,-33.535],[150.838,-33.535],[150.868,-33.535],[150.88,-33.535],[150.892,-33.535],[150.91,-33.535],[150.91,-33.57],[150.91,-33.606],[150.91,-33.642],[150.91,-33.678],[150.91,-33.714],[150.902,-33.728],[150.892,-33.74],[150.88,-33.75],[150.867,-33.758],[150.853,-33.763],[150.838,-33.766],[150.823,-33.767],[150.808,-33.765],[150.793,-33.762],[150.778,-33.756],[150.764,-33.748],[150.751,-33.738],[150.739,-33.727],[150.728,-33.714],[150.72,-33.7],[150.714,-33.685],[150.71,-33.669],[150.708,-33.653],[150.708,-33.636],[150.71,-33.62],[150.715,-33.604],[150.722,-33.589],[150.731,-33.575],[150.742,-33.562],[150.755,-33.55],[150.769,-33.54],[150.784,-33.534],[150.808,-33.535]]]}},{"type":"Feature","properties":{"LGA_NAME":"Parramatta","canopy_2022":25,"canopy_2019":23,"income":1800,"peak_temp":35.5},"geometry":{"type":"Polygon","coordinates":[[[150.938,-33.712],[150.958,-33.706],[150.978,-33.702],[150.998,-33.7],[151.018,-33.7],[151.035,-33.702],[151.05,-33.708],[151.062,-33.718],[151.07,-33.73],[151.075,-33.745],[151.075,-33.76],[151.072,-33.775],[151.065,-33.788],[151.055,-33.8],[151.042,-33.81],[151.028,-33.816],[151.012,-33.82],[150.995,-33.82],[150.978,-33.816],[150.962,-33.808],[150.948,-33.797],[150.936,-33.783],[150.928,-33.768],[150.922,-33.751],[150.92,-33.734],[150.92,-33.717],[150.928,-33.712],[150.938,-33.712]]]}},{"type":"Feature","properties":{"LGA_NAME":"Cumberland","canopy_2022":13,"canopy_2019":12,"income":1660,"peak_temp":38.5},"geometry":{"type":"Polygon","coordinates":[[[150.84,-33.77],[150.858,-33.762],[150.876,-33.756],[150.894,-33.752],[150.912,-33.75],[150.928,-33.75],[150.942,-33.752],[150.954,-33.758],[150.964,-33.766],[150.972,-33.776],[150.977,-33.788],[150.978,-33.801],[150.976,-33.815],[150.97,-33.828],[150.96,-33.839],[150.948,-33.848],[150.934,-33.854],[150.918,-33.857],[150.902,-33.857],[150.886,-33.854],[150.871,-33.847],[150.858,-33.837],[150.846,-33.825],[150.837,-33.811],[150.831,-33.796],[150.828,-33.78],[150.828,-33.764],[150.833,-33.749],[150.84,-33.77]]]}},{"type":"Feature","properties":{"LGA_NAME":"Fairfield","canopy_2022":10,"canopy_2019":9,"income":1380,"peak_temp":39.3},"geometry":{"type":"Polygon","coordinates":[[[150.84,-33.84],[150.858,-33.83],[150.876,-33.822],[150.894,-33.817],[150.912,-33.815],[150.928,-33.815],[150.942,-33.818],[150.954,-33.824],[150.964,-33.834],[150.972,-33.846],[150.977,-33.86],[150.978,-33.875],[150.975,-33.89],[150.968,-33.905],[150.958,-33.918],[150.944,-33.928],[150.928,-33.935],[150.912,-33.938],[150.895,-33.938],[150.879,-33.934],[150.864,-33.926],[150.851,-33.914],[150.84,-33.9],[150.832,-33.884],[150.828,-33.867],[150.827,-33.85],[150.832,-33.84],[150.84,-33.84]]]}},{"type":"Feature","properties":{"LGA_NAME":"Liverpool","canopy_2022":14,"canopy_2019":13,"income":1480,"peak_temp":38.2},"geometry":{"type":"Polygon","coordinates":[[[150.828,-33.857],[150.845,-33.847],[150.862,-33.84],[150.879,-33.836],[150.895,-33.835],[150.912,-33.836],[150.927,-33.84],[150.94,-33.847],[150.95,-33.857],[150.958,-33.87],[150.962,-33.884],[150.962,-33.899],[150.958,-33.914],[150.95,-33.927],[150.938,-33.938],[150.924,-33.946],[150.908,-33.95],[150.892,-33.952],[150.876,-33.95],[150.86,-33.944],[150.846,-33.934],[150.834,-33.921],[150.825,-33.905],[150.82,-33.888],[150.818,-33.871],[150.82,-33.854],[150.828,-33.857]]]}},{"type":"Feature","properties":{"LGA_NAME":"Camden","canopy_2022":14,"canopy_2019":13,"income":1600,"peak_temp":38.2},"geometry":{"type":"Polygon","coordinates":[[[150.708,-33.94],[150.725,-33.93],[150.742,-33.922],[150.76,-33.916],[150.778,-33.912],[150.796,-33.91],[150.814,-33.91],[150.83,-33.912],[150.845,-33.917],[150.858,-33.925],[150.869,-33.935],[150.878,-33.948],[150.884,-33.962],[150.887,-33.977],[150.886,-33.992],[150.882,-34.007],[150.875,-34.021],[150.864,-34.033],[150.851,-34.043],[150.836,-34.05],[150.82,-34.054],[150.803,-34.055],[150.787,-34.052],[150.771,-34.046],[150.757,-34.036],[150.745,-34.024],[150.735,-34.01],[150.728,-33.994],[150.724,-33.978],[150.722,-33.961],[150.723,-33.944],[150.708,-33.94]]]}},{"type":"Feature","properties":{"LGA_NAME":"Campbelltown","canopy_2022":18,"canopy_2019":17,"income":1550,"peak_temp":37.1},"geometry":{"type":"Polygon","coordinates":[[[150.83,-33.912],[150.845,-33.904],[150.86,-33.898],[150.876,-33.894],[150.892,-33.892],[150.908,-33.892],[150.924,-33.894],[150.938,-33.9],[150.95,-33.908],[150.96,-33.918],[150.968,-33.93],[150.972,-33.944],[150.974,-33.958],[150.972,-33.972],[150.968,-33.986],[150.96,-33.999],[150.95,-34.011],[150.938,-34.02],[150.924,-34.028],[150.909,-34.032],[150.893,-34.034],[150.877,-34.032],[150.861,-34.028],[150.847,-34.02],[150.835,-34.01],[150.825,-33.998],[150.817,-33.984],[150.813,-33.97],[150.811,-33.955],[150.812,-33.94],[150.82,-33.927],[150.83,-33.912]]]}},{"type":"Feature","properties":{"LGA_NAME":"Canterbury-Bankstown","canopy_2022":16,"canopy_2019":15,"income":1580,"peak_temp":37.7},"geometry":{"type":"Polygon","coordinates":[[[151.02,-33.82],[151.038,-33.818],[151.055,-33.818],[151.072,-33.82],[151.088,-33.825],[151.102,-33.832],[151.115,-33.842],[151.122,-33.855],[151.125,-33.868],[151.122,-33.882],[151.115,-33.895],[151.105,-33.906],[151.092,-33.915],[151.078,-33.922],[151.062,-33.925],[151.045,-33.925],[151.028,-33.922],[151.012,-33.915],[150.998,-33.905],[150.988,-33.892],[150.982,-33.878],[150.98,-33.862],[150.982,-33.846],[150.988,-33.832],[150.998,-33.82],[151.008,-33.815],[151.02,-33.82]]]}},{"type":"Feature","properties":{"LGA_NAME":"Inner West","canopy_2022":19,"canopy_2019":18,"income":1680,"peak_temp":37.4},"geometry":{"type":"Polygon","coordinates":[[[151.082,-33.828],[151.098,-33.825],[151.114,-33.825],[151.128,-33.828],[151.14,-33.835],[151.148,-33.844],[151.152,-33.855],[151.15,-33.867],[151.145,-33.878],[151.135,-33.888],[151.122,-33.896],[151.108,-33.902],[151.092,-33.905],[151.076,-33.905],[151.06,-33.902],[151.046,-33.895],[151.034,-33.885],[151.025,-33.873],[151.02,-33.86],[151.02,-33.846],[151.025,-33.832],[151.034,-33.822],[151.046,-33.816],[151.062,-33.816],[151.082,-33.828]]]}},{"type":"Feature","properties":{"LGA_NAME":"City of Sydney","canopy_2022":20,"canopy_2019":19,"income":1900,"peak_temp":36.6},"geometry":{"type":"Polygon","coordinates":[[[151.148,-33.844],[151.162,-33.84],[151.176,-33.838],[151.19,-33.84],[151.202,-33.845],[151.212,-33.852],[151.218,-33.862],[151.22,-33.874],[151.218,-33.886],[151.212,-33.897],[151.202,-33.906],[151.19,-33.912],[151.176,-33.915],[151.162,-33.914],[151.148,-33.91],[151.136,-33.902],[151.128,-33.892],[151.124,-33.88],[151.124,-33.867],[151.128,-33.854],[151.136,-33.847],[151.148,-33.844]]]}},{"type":"Feature","properties":{"LGA_NAME":"Bayside","canopy_2022":15,"canopy_2019":14,"income":1620,"peak_temp":37.8},"geometry":{"type":"Polygon","coordinates":[[[151.092,-33.905],[151.108,-33.902],[151.122,-33.903],[151.135,-33.908],[151.146,-33.916],[151.154,-33.927],[151.158,-33.94],[151.158,-33.954],[151.154,-33.968],[151.146,-33.98],[151.135,-33.99],[151.122,-33.996],[151.108,-33.999],[151.092,-33.998],[151.078,-33.993],[151.066,-33.984],[151.057,-33.972],[151.052,-33.958],[151.051,-33.944],[151.055,-33.93],[151.062,-33.918],[151.076,-33.909],[151.092,-33.905]]]}},{"type":"Feature","properties":{"LGA_NAME":"Randwick","canopy_2022":16,"canopy_2019":15,"income":1900,"peak_temp":36.0},"geometry":{"type":"Polygon","coordinates":[[[151.148,-33.844],[151.162,-33.84],[151.178,-33.84],[151.194,-33.843],[151.208,-33.849],[151.22,-33.858],[151.23,-33.87],[151.235,-33.884],[151.236,-33.898],[151.232,-33.912],[151.224,-33.924],[151.212,-33.934],[151.198,-33.94],[151.183,-33.943],[151.168,-33.942],[151.154,-33.937],[151.142,-33.928],[151.133,-33.916],[151.128,-33.902],[151.128,-33.888],[151.13,-33.873],[151.136,-33.858],[151.148,-33.844]]]}},{"type":"Feature","properties":{"LGA_NAME":"Woollahra","canopy_2022":22,"canopy_2019":21,"income":2800,"peak_temp":35.0},"geometry":{"type":"Polygon","coordinates":[[[151.202,-33.838],[151.218,-33.835],[151.234,-33.835],[151.248,-33.84],[151.26,-33.848],[151.268,-33.86],[151.272,-33.872],[151.27,-33.886],[151.262,-33.898],[151.25,-33.908],[151.236,-33.912],[151.22,-33.912],[151.205,-33.908],[151.192,-33.9],[151.182,-33.888],[151.176,-33.874],[151.174,-33.86],[151.176,-33.846],[151.183,-33.84],[151.194,-33.837],[151.202,-33.838]]]}},{"type":"Feature","properties":{"LGA_NAME":"North Sydney","canopy_2022":29,"canopy_2019":28,"income":2300,"peak_temp":35.2},"geometry":{"type":"Polygon","coordinates":[[[151.095,-33.8],[151.112,-33.796],[151.128,-33.796],[151.143,-33.8],[151.155,-33.808],[151.162,-33.82],[151.164,-33.833],[151.16,-33.846],[151.151,-33.857],[151.138,-33.865],[151.122,-33.868],[151.106,-33.866],[151.092,-33.86],[151.081,-33.85],[151.075,-33.838],[151.074,-33.824],[151.078,-33.811],[151.086,-33.8],[151.095,-33.8]]]}},{"type":"Feature","properties":{"LGA_NAME":"Willoughby","canopy_2022":30,"canopy_2019":29,"income":2100,"peak_temp":33.9},"geometry":{"type":"Polygon","coordinates":[[[151.075,-33.776],[151.092,-33.772],[151.108,-33.771],[151.124,-33.773],[151.138,-33.778],[151.15,-33.787],[151.158,-33.798],[151.16,-33.812],[151.157,-33.826],[151.149,-33.838],[151.136,-33.845],[151.12,-33.848],[151.104,-33.845],[151.09,-33.838],[151.079,-33.828],[151.072,-33.814],[151.07,-33.799],[151.075,-33.776]]]}},{"type":"Feature","properties":{"LGA_NAME":"Mosman","canopy_2022":35,"canopy_2019":33,"income":3100,"peak_temp":32.5},"geometry":{"type":"Polygon","coordinates":[[[151.192,-33.81],[151.21,-33.806],[151.228,-33.806],[151.244,-33.81],[151.258,-33.818],[151.268,-33.83],[151.272,-33.844],[151.27,-33.858],[151.262,-33.87],[151.25,-33.88],[151.235,-33.884],[151.218,-33.886],[151.203,-33.882],[151.19,-33.874],[151.18,-33.863],[151.175,-33.849],[151.174,-33.835],[151.178,-33.821],[151.187,-33.811],[151.192,-33.81]]]}},{"type":"Feature","properties":{"LGA_NAME":"Lane Cove","canopy_2022":40,"canopy_2019":38,"income":2400,"peak_temp":31.2},"geometry":{"type":"Polygon","coordinates":[[[151.062,-33.77],[151.078,-33.767],[151.094,-33.767],[151.108,-33.771],[151.12,-33.779],[151.128,-33.79],[151.13,-33.803],[151.126,-33.816],[151.116,-33.826],[151.102,-33.832],[151.086,-33.832],[151.072,-33.826],[151.062,-33.816],[151.056,-33.804],[151.054,-33.791],[151.057,-33.778],[151.062,-33.77]]]}},{"type":"Feature","properties":{"LGA_NAME":"Ryde","canopy_2022":28,"canopy_2019":27,"income":1950,"peak_temp":34.4},"geometry":{"type":"Polygon","coordinates":[[[151.025,-33.748],[151.042,-33.742],[151.058,-33.74],[151.075,-33.74],[151.09,-33.744],[151.103,-33.752],[151.112,-33.762],[151.116,-33.775],[151.114,-33.789],[151.108,-33.802],[151.097,-33.812],[151.082,-33.818],[151.067,-33.82],[151.052,-33.816],[151.04,-33.808],[151.03,-33.796],[151.024,-33.782],[151.022,-33.766],[151.025,-33.748]]]}},{"type":"Feature","properties":{"LGA_NAME":"Hunters Hill","canopy_2022":35,"canopy_2019":33,"income":2300,"peak_temp":32.5},"geometry":{"type":"Polygon","coordinates":[[[151.125,-33.82],[151.137,-33.816],[151.148,-33.816],[151.158,-33.82],[151.165,-33.828],[151.168,-33.84],[151.165,-33.852],[151.156,-33.862],[151.144,-33.866],[151.13,-33.865],[151.118,-33.86],[151.108,-33.852],[151.104,-33.84],[151.105,-33.827],[151.112,-33.82],[151.125,-33.82]]]}},{"type":"Feature","properties":{"LGA_NAME":"Canada Bay","canopy_2022":22,"canopy_2019":21,"income":1950,"peak_temp":35.8},"geometry":{"type":"Polygon","coordinates":[[[151.05,-33.838],[151.066,-33.834],[151.082,-33.832],[151.095,-33.834],[151.106,-33.84],[151.113,-33.85],[151.115,-33.862],[151.111,-33.874],[151.102,-33.882],[151.09,-33.887],[151.076,-33.887],[151.064,-33.882],[151.054,-33.874],[151.048,-33.862],[151.046,-33.85],[151.05,-33.838]]]}},{"type":"Feature","properties":{"LGA_NAME":"Strathfield","canopy_2022":17,"canopy_2019":16,"income":1750,"peak_temp":37.4},"geometry":{"type":"Polygon","coordinates":[[[151.046,-33.85],[151.062,-33.846],[151.078,-33.846],[151.09,-33.851],[151.098,-33.86],[151.1,-33.872],[151.095,-33.884],[151.084,-33.892],[151.07,-33.895],[151.056,-33.892],[151.044,-33.884],[151.038,-33.872],[151.04,-33.859],[151.046,-33.85]]]}},{"type":"Feature","properties":{"LGA_NAME":"Burwood","canopy_2022":15,"canopy_2019":14,"income":1700,"peak_temp":38.0},"geometry":{"type":"Polygon","coordinates":[[[151.082,-33.862],[151.095,-33.858],[151.108,-33.858],[151.118,-33.864],[151.124,-33.875],[151.122,-33.888],[151.114,-33.898],[151.1,-33.904],[151.086,-33.904],[151.074,-33.898],[151.066,-33.888],[151.064,-33.875],[151.07,-33.862],[151.082,-33.862]]]}},{"type":"Feature","properties":{"LGA_NAME":"Georges River","canopy_2022":21,"canopy_2019":20,"income":1700,"peak_temp":36.5},"geometry":{"type":"Polygon","coordinates":[[[151.042,-33.948],[151.06,-33.944],[151.078,-33.943],[151.095,-33.946],[151.11,-33.952],[151.122,-33.962],[151.13,-33.975],[151.133,-33.99],[151.13,-34.004],[151.122,-34.017],[151.11,-34.027],[151.095,-34.033],[151.079,-34.035],[151.062,-34.033],[151.046,-34.027],[151.032,-34.017],[151.022,-34.004],[151.016,-33.99],[151.016,-33.975],[151.02,-33.961],[151.029,-33.949],[151.042,-33.948]]]}},{"type":"Feature","properties":{"LGA_NAME":"Sutherland","canopy_2022":29,"canopy_2019":27,"income":1880,"peak_temp":34.4},"geometry":{"type":"Polygon","coordinates":[[[151.016,-33.99],[151.025,-33.982],[151.038,-33.976],[151.052,-33.972],[151.066,-33.972],[151.08,-33.975],[151.093,-33.981],[151.104,-33.991],[151.112,-34.003],[151.118,-34.016],[151.12,-34.03],[151.119,-34.044],[151.115,-34.058],[151.108,-34.071],[151.098,-34.082],[151.085,-34.091],[151.07,-34.097],[151.054,-34.1],[151.037,-34.099],[151.02,-34.095],[151.005,-34.087],[150.992,-34.076],[150.982,-34.062],[150.975,-34.046],[150.972,-34.03],[150.972,-34.014],[150.976,-33.998],[150.984,-33.984],[150.996,-33.972],[151.01,-33.966],[151.016,-33.99]]]}},{"type":"Feature","properties":{"LGA_NAME":"Wollondilly","canopy_2022":30,"canopy_2019":28,"income":1580,"peak_temp":33.5},"geometry":{"type":"Polygon","coordinates":[[[150.54,-33.82],[150.56,-33.812],[150.58,-33.806],[150.6,-33.802],[150.62,-33.8],[150.64,-33.8],[150.655,-33.804],[150.668,-33.812],[150.678,-33.822],[150.685,-33.835],[150.688,-33.848],[150.687,-33.862],[150.683,-33.876],[150.675,-33.888],[150.664,-33.898],[150.65,-33.906],[150.635,-33.91],[150.619,-33.911],[150.603,-33.909],[150.588,-33.904],[150.574,-33.896],[150.562,-33.885],[150.552,-33.872],[150.546,-33.858],[150.542,-33.843],[150.54,-33.82]]]}}]};

// Enrich a GeoJSON feature with our canopy data
function enrichFeature(feature) {
  const p = feature.properties;

  // LOG raw properties so we can see what the ArcGIS API actually returns
  if (!enrichFeature._logged) {
    console.log('[LGA feature properties]', JSON.stringify(p, null, 2));
    enrichFeature._logged = true;
  }

  // Extract LGA name — check EVERY string field
  // NSW Spatial / ABS ArcGIS use different field names depending on layer version
  let rawName = '';
  const nameFieldPriority = [
    'NSW_LGA_n','NSW_LGA_sh','NSW_LGA_1','NSW_LGA_2','NSW_LGA_3',
    'LGA_NAME_2021','LGA_NAME21','LGA_NAME','lga_name',
    'ABB_NAME','ABBREV','LocalGovernmentAreaName','LGA_NAME_S',
    'NAME','name','LGANAME','LgaName','label','Label',
  ];
  for (const f of nameFieldPriority) {
    if (p[f] && typeof p[f] === 'string' && p[f].trim().length > 2) {
      rawName = p[f].trim(); break;
    }
  }
  // Fallback: scan ALL properties for any string that looks like an LGA name
  if (!rawName) {
    for (const [k, v] of Object.entries(p)) {
      if (typeof v === 'string' && v.length > 2 && v.length < 60) {
        const clean = v.trim();
        if (/^[A-Za-z][A-Za-z\s\-'().]+$/.test(clean) && !k.toLowerCase().includes('code') && !k.toLowerCase().includes('date')) {
          rawName = clean; break;
        }
      }
    }
  }

  // Normalise key: lowercase, remove common suffixes
  const normalise = s => s.toLowerCase().trim()
    .replace(/\s+/g, ' ')
    .replace(/ shire$/,'').replace(/ city$/,'').replace(/ council$/,'')
    .replace(/ lga$/,'').replace(/-/g,' ').trim();

  const key = normalise(rawName);

  // Match against CANOPY_DATA — exact first, then partial
  const cdKeys = Object.keys(CANOPY_DATA);
  let data = CANOPY_DATA[key];
  if (!data) data = CANOPY_DATA[key + ' shire'] || CANOPY_DATA[key + ' city'];
  if (!data) {
    const normKey = k => normalise(k);
    for (const ck of cdKeys) {
      const nck = normKey(ck);
      if (nck === key || nck.includes(key) || key.includes(nck)) {
        data = CANOPY_DATA[ck]; break;
      }
    }
  }
  // Last resort: word-by-word match
  if (!data && key.length > 3) {
    const words = key.split(' ').filter(w => w.length > 3);
    for (const ck of cdKeys) {
      const nck = normalise(ck);
      if (words.some(w => nck.includes(w))) {
        data = CANOPY_DATA[ck]; break;
      }
    }
  }

  // Clean the raw name (strip ALLCAPS, remove "Council"/"Shire" suffixes)
  function cleanName(raw) {
    if (!raw) return raw;
    let s = (raw === raw.toUpperCase())
      ? raw.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
      : raw;
    return s.replace(/\s+(City\s+)?Council$/i,'')
             .replace(/\s+Shire\s+Council$/i,'')
             .replace(/\s+City$/i,'')
             .replace(/\s+Shire$/i,'')
             .trim();
  }
  const cleanedRaw = cleanName(rawName) || key || 'Unknown LGA';

  // Look up canonical display name
  const canonMap = {
    'ku-ring-gai':'Ku-ring-gai','hornsby':'Hornsby','northern beaches':'Northern Beaches',
    'the hills':'The Hills','hawkesbury':'Hawkesbury','blue mountains':'Blue Mountains',
    'penrith':'Penrith','blacktown':'Blacktown','parramatta':'Parramatta',
    'cumberland':'Cumberland','fairfield':'Fairfield','liverpool':'Liverpool',
    'camden':'Camden','campbelltown':'Campbelltown',
    'canterbury-bankstown':'Canterbury-Bankstown','inner west':'Inner West',
    'city of sydney':'Sydney','sydney':'Sydney','bayside':'Bayside',
    'randwick':'Randwick','woollahra':'Woollahra','north sydney':'North Sydney',
    'willoughby':'Willoughby','mosman':'Mosman','lane cove':'Lane Cove',
    'ryde':'Ryde','hunters hill':'Hunters Hill','canada bay':'Canada Bay',
    'strathfield':'Strathfield','burwood':'Burwood','georges river':'Georges River',
    'sutherland':'Sutherland','wollondilly':'Wollondilly',
  };
  const norm = s => s.toLowerCase().trim().replace(/\s+/g,' ').replace(/ shire$/,'').replace(/ city$/,'').replace(/-/g,' ').trim();
  const finalName = canonMap[norm(cleanedRaw)] || canonMap[key] || cleanedRaw;

  if (data) {
    feature.properties = { ...p, LGA_NAME: finalName, ...data };
  } else {
    console.warn('[LGA no match]', finalName, 'key:', key, 'available:', cdKeys.slice(0,5));
    feature.properties = { ...p, LGA_NAME: finalName, c22:20, c19:19, income:1700, peak:35.0 };
  }
  return feature;
}

// ── COLOUR SCALES ──────────────────────────────────────────────────────────
function canopyFill(v) {
  if (v >= 50) return '#1a6e1a'; if (v >= 40) return '#2d8a2e';
  if (v >= 35) return '#4aaa30'; if (v >= 30) return '#78be20';
  if (v >= 25) return '#a8d020'; if (v >= 22) return '#c8d820';
  if (v >= 18) return '#e8d020'; if (v >= 15) return '#f5b820';
  if (v >= 12) return '#f07830'; if (v >= 10) return '#e05018';
  return '#cc1a1a';
}
function heatFill(v) {
  const r=50-v;
  if(r>=40)return'#7f0000'; if(r>=35)return'#aa1500';
  if(r>=30)return'#cc2200'; if(r>=25)return'#dd5500';
  if(r>=20)return'#ee8800'; if(r>=15)return'#f5b820';
  if(r>=10)return'#7ec850'; return'#2d8a2e';
}
function incomeFill(v) {
  if(v>=2800)return'#03103a'; if(v>=2400)return'#08306b';
  if(v>=2100)return'#0d52a0'; if(v>=1800)return'#1a7abf';
  if(v>=1600)return'#3da8d8'; if(v>=1400)return'#7ecae8';
  if(v>=1200)return'#bce4f5'; return'#e8f4fc';
}

// ── MAP MODE CONFIG ────────────────────────────────────────────────────────
const LEAFLET_MODES = {
  canopy: {
    fillFn: p => canopyFill(p.c22 || p.canopy_2022 || 20),
    legendTitle: 'Canopy cover 2022',
    legendItems: [
      {color:'#2d8a2e',label:'≥40% — lush'},{color:'#78be20',label:'28–40%'},
      {color:'#e8d020',label:'18–28%'},{color:'#f07830',label:'12–18%'},
      {color:'#cc1a1a',label:'<12% — heat risk'},
    ],
    badge: 'Canopy cover · NSW SEED 2022'
  },
  heat: {
    fillFn: p => heatFill(p.c22 || p.canopy_2022 || 20),
    legendTitle: 'Heat risk',
    legendItems: [
      {color:'#7f0000',label:'Extreme — <12%'},{color:'#cc2200',label:'High — 12–18%'},
      {color:'#ee8800',label:'Moderate — 18–28%'},{color:'#7ec850',label:'Low — 28–40%'},
      {color:'#2d8a2e',label:'Resilient — >40%'},
    ],
    badge: 'Heat risk · BOM 2026'
  },
  income: {
    fillFn: p => incomeFill(p.income || 1700),
    legendTitle: 'Median weekly income',
    legendItems: [
      {color:'#03103a',label:'≥$2,800/wk'},{color:'#0d52a0',label:'$2,100–2,800'},
      {color:'#3da8d8',label:'$1,600–2,100'},{color:'#bce4f5',label:'<$1,400/wk'},
    ],
    badge: 'Median household income · ABS 2021'
  }
};

// ── LEAFLET MAP STATE ──────────────────────────────────────────────────────
let leafletMap    = null;
let geojsonLayer  = null;
let currentLGAMode = 'canopy';
let activeLGALayer = null;
let loadedGeoJSON  = null;  // cached after first fetch
const SYDNEY_AVG_CANOPY = 21.7;
const SYDNEY_AVG_INCOME = 1800;

// ── FETCH LIVE LGA BOUNDARIES ────────────────────────────────────────────
// Called by: initLeafletMap() and initSimMap() (both maps share the same source)
// Tries 3 sources in sequence, returns the first valid GeoJSON FeatureCollection.
// Falls back to FALLBACK_GEOJSON if all live sources fail or time out.
// Note: live fetch runs in background after instant fallback render — no visible lag.
// Tries NSW Spatial Services, then ABS ArcGIS, then falls back to embedded data.
// ArcGIS REST APIs include CORS * headers — they work from browsers.
async function fetchLGABoundaries() {
  const SYDNEY_BBOX = '150.3,-34.3,151.7,-33.4';
  const COMMON_PARAMS = `&geometry=${SYDNEY_BBOX}&geometryType=esriGeometryEnvelope&spatialRel=esriSpatialRelIntersects&returnGeometry=true&outSR=4326&f=geojson&resultRecordCount=100`;

  const sources = [
    // NSW Spatial Services — official NSW Government LGA boundaries
    `https://portal.spatial.nsw.gov.au/server/rest/services/Hosted/NSW_Boundary_Concordance/FeatureServer/0/query?where=1%3D1&outFields=*${COMMON_PARAMS}`,
    // ABS ASGS 2021 LGA layer — official ABS boundaries (authoritative for census)
    `https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/LGA/MapServer/0/query?where=STATE_NAME_2021%3D%27New+South+Wales%27&outFields=LGA_NAME_2021%2CLGA_CODE_2021${COMMON_PARAMS}`,
    // ABS alternative endpoint
    `https://geo.abs.gov.au/arcgis/rest/services/ASGS_Edition3/MapServer/6/query?where=STE_NAME21%3D%27New+South+Wales%27&outFields=LGA_NAME21${COMMON_PARAMS}`,
  ];

  for (const url of sources) {
    try {
      const res  = await fetch(url, {mode: 'cors'});
      if (!res.ok) continue;
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        console.log(`LGA data loaded from: ${url.split('/')[2]} (${data.features.length} features)`);
        // Enrich each feature with our canopy/income data
        data.features = data.features.map(enrichFeature);
        return data;
      }
    } catch(e) {
      console.warn(`LGA source failed: ${url.split('/')[2]}`, e.message);
    }
  }

  // All live sources failed — use embedded fallback instantly
  console.log('Using embedded fallback GeoJSON');
  return {
    type: 'FeatureCollection',
    features: FALLBACK_GEOJSON.features.map(f => {
      const p = f.properties;
      const name = p.LGA_NAME || '';
      const key = name.toLowerCase().replace(' shire','').replace(' city','').trim();
      const cd = CANOPY_DATA[key] || CANOPY_DATA[key+' shire'] || {};
      return {
        ...f,
        properties: {
          LGA_NAME: name,
          c22:    cd.c22    || p.canopy_2022 || 20,
          c19:    cd.c19    || p.canopy_2019 || 18,
          income: cd.income || p.income      || 1700,
          peak:   cd.peak   || p.peak_temp   || 35.0,
        }
      };
    })
  };
}

// ── INIT LEAFLET MAP ─────────────────────────────────────────────────────
// Called by: maybeInitMap() once the #lgaLeafletMap container enters the viewport.
// Renders instantly using FALLBACK_GEOJSON, then upgrades to live boundaries silently.
// NOTE: Leaflet.js must already be available (inlined in the HTML) before this runs.
function initLeafletMap() {
  const container = document.getElementById('lgaLeafletMap');
  if (!container || leafletMap) return;

  // Create map immediately — no waiting
  leafletMap = L.map('lgaLeafletMap', {
    center: [-33.82, 150.92],
    zoom: 9,
    scrollWheelZoom: false,
    zoomControl: true,
  });

  const cartoLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com">CARTO</a>',
    subdomains: 'abcd', maxZoom: 19, opacity: 0.82,
  });
  const osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
    maxZoom: 19, opacity: 0.80,
  });
  cartoLayer.addTo(leafletMap);
  cartoLayer.once('tileerror', () => { leafletMap.removeLayer(cartoLayer); osmLayer.addTo(leafletMap); });
  osmLayer.addTo(leafletMap);

  // ── INSTANT RENDER: use fallback GeoJSON immediately ──────────
  loadedGeoJSON = FALLBACK_GEOJSON;
  renderLeafletMode('canopy');

  // ── BACKGROUND UPGRADE: fetch live boundaries silently ────────
  fetchLGABoundaries().then(liveGJ => {
    if (liveGJ && liveGJ.features && liveGJ.features.length > 5) {
      loadedGeoJSON = liveGJ;
      // Re-render current mode with better boundaries
      const activeTab = document.querySelector('.map-tab.active');
      const mode = activeTab ? activeTab.dataset.mode : 'canopy';
      renderLeafletMode(mode);
    }
  }).catch(() => { /* keep fallback */ });

  // Invalidate size to fix blank tile issue when container was hidden during init
  setTimeout(() => {
    leafletMap.invalidateSize();
    if (geojsonLayer) {
      leafletMap.fitBounds(geojsonLayer.getBounds(), {padding: [30, 30]});
    }
  }, 100);
}

// ── RENDER MODE ────────────────────────────────────────────────────────
// Called by: initLeafletMap() on init, and by tab button click handlers.
// mode: "canopy" | "heat" | "income" — switches fill colour function and legend.
function renderLeafletMode(mode) {
  currentLGAMode = mode;
  const modeObj = LEAFLET_MODES[mode];
  if (!leafletMap || !loadedGeoJSON) return;

  // Update legend card
  const titleEl = document.getElementById('legendTitle');
  const itemsEl = document.getElementById('legendItems');
  const badge   = document.getElementById('mapModeBadge');
  if (titleEl) titleEl.textContent = modeObj.legendTitle;
  if (itemsEl) itemsEl.innerHTML = modeObj.legendItems.map(it =>
    `<div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;">
      <span style="width:13px;height:13px;border-radius:2px;background:${it.color};
        flex-shrink:0;display:inline-block;border:1px solid rgba(255,255,255,0.2);"></span>
      <span style="font-size:11px;color:rgba(255,255,255,0.85);">${it.label}</span>
    </div>`
  ).join('');
  if (badge) badge.textContent = modeObj.badge;

  // Remove old choropleth layer
  if (geojsonLayer) leafletMap.removeLayer(geojsonLayer);

  // Create new GeoJSON choropleth layer
  // Leaflet projects these coords using the same Web Mercator as the tile layer
  // → perfect alignment guaranteed
  geojsonLayer = L.geoJSON(loadedGeoJSON, {
    style: feature => ({
      fillColor:   modeObj.fillFn(feature.properties),
      fillOpacity: 0.58,
      color:       '#ffffff',
      weight:      1.2,
      opacity:     0.9,
    }),
    onEachFeature: (feature, layer) => {
      const p = feature.properties;
      layer.on('mouseover', () => {
        if (layer !== activeLGALayer) {
          layer.setStyle({fillOpacity: 0.75, weight: 2.2});
          layer.bringToFront();
        }
      });
      layer.on('mouseout', () => {
        if (layer !== activeLGALayer) geojsonLayer.resetStyle(layer);
      });
      layer.on('click', e => {
        if (activeLGALayer && activeLGALayer !== layer) { geojsonLayer.resetStyle(activeLGALayer); activeLGALayer.getElement()?.classList.remove('leaflet-selected-lga'); }
        activeLGALayer = layer;
        layer.setStyle({fillOpacity: 0.88, weight: 4, color: '#52b788', dashArray: null}); layer.getElement()?.classList.add('leaflet-selected-lga');
        layer.bringToFront();
        openLGAPanel(p);
        L.DomEvent.stopPropagation(e);
      });
    }
  }).addTo(leafletMap);

  leafletMap.on('click', () => {
    closeLGAPanel();
    if (activeLGALayer) { geojsonLayer.resetStyle(activeLGALayer); activeLGALayer = null; }
  });
}

// ── LGA DATA PANEL ─────────────────────────────────────────────────────
// Renders the slide-out info panel when a user clicks an LGA polygon.
// Panel HTML is injected into #lgaInfoPanel in shades_of_inequality.html.
// Shows: canopy %, income, peak temp, heat risk label, and a comparison to Sydney avg.
function heatRiskLabel(c) {
  if(c<12)return{label:'Extreme',  color:'#cc1a1a'};
  if(c<16)return{label:'High',     color:'#e05018'};
  if(c<20)return{label:'Elevated', color:'#f07830'};
  if(c<28)return{label:'Moderate', color:'#e8d020'};
  if(c<36)return{label:'Low',      color:'#78be20'};
  return        {label:'Resilient',color:'#2d8a2e'};
}

function openLGAPanel(p) {
  const panel = document.getElementById('lgaClickPanel');
  if (!panel) return;

  // Debug: log every click so we can see exact field names
  console.log('[LGA clicked] properties:', JSON.stringify(p));

  // Re-run name extraction at click time — safety net if enrichFeature missed it
  const nameFields = ['LGA_NAME','NSW_LGA_n','NSW_LGA_sh','NSW_LGA_1','NSW_LGA_2',
    'LGA_NAME_2021','LGA_NAME21','NAME','name','ABBREV','ABB_NAME'];
  let name = '';
  for (const f of nameFields) {
    if (p[f] && typeof p[f]==='string' && p[f].trim().length>2) { name=p[f].trim(); break; }
  }
  // Scan all string props as last resort
  if (!name) {
    for (const [k,v] of Object.entries(p)) {
      if (typeof v==='string' && v.length>2 && v.length<60 && /^[A-Za-z][A-Za-z\s\-'.()]+$/.test(v.trim())
          && !['date','code','id','pid','gid','area','state','objectid'].some(x=>k.toLowerCase().includes(x))) {
        name = v.trim(); break;
      }
    }
  }
  if (!name) name = 'Unknown LGA';

  // If properties weren't enriched with canopy data, do it now
  const normalise = s => s.toLowerCase().trim()
    .replace(/\s+/g,' ').replace(/ shire$/,'').replace(/ city$/,'')
    .replace(/ council$/,'').replace(/ lga$/,'').replace(/-/g,' ').trim();
  
  const key = normalise(name);
  let cd = CANOPY_DATA[key] || CANOPY_DATA[key+' shire'] || CANOPY_DATA[key+' city'];
  if (!cd) {
    for (const ck of Object.keys(CANOPY_DATA)) {
      const nck = normalise(ck);
      if (nck===key || nck.includes(key) || key.includes(nck)) { cd=CANOPY_DATA[ck]; break; }
    }
  }
  // Word match fallback
  if (!cd && key.length>3) {
    const words = key.split(' ').filter(w=>w.length>3);
    for (const ck of Object.keys(CANOPY_DATA)) {
      if (words.some(w=>normalise(ck).includes(w))) { cd=CANOPY_DATA[ck]; break; }
    }
  }

  // Use enriched data if available, otherwise use clicked feature's properties, then fallback
  const c22  = (cd && cd.c22)     || p.c22 || p.canopy_2022 || 20;
  const c19  = (cd && cd.c19)     || p.c19 || p.canopy_2019 || c22-2;
  const inc  = (cd && cd.income)  || p.income || 1700;
  const peak = (cd && cd.peak)    || p.peak || p.peak_temp || 35;
  
  // Use the canonical name from CANOPY_DATA if matched (better formatting)
  // Canonical display names — title case, no "Council"/"Shire"/"City" suffix
  // The ArcGIS API returns names in ALL CAPS with suffixes (e.g. "LIVERPOOL CITY COUNCIL")
  // We strip those and normalise to consistent title case
  const canonicalNames = {
    'ku-ring-gai':'Ku-ring-gai','hornsby':'Hornsby','northern beaches':'Northern Beaches',
    'the hills':'The Hills','the hills shire':'The Hills','hawkesbury':'Hawkesbury',
    'blue mountains':'Blue Mountains','penrith':'Penrith','blacktown':'Blacktown',
    'parramatta':'Parramatta','cumberland':'Cumberland','fairfield':'Fairfield',
    'liverpool':'Liverpool','camden':'Camden','campbelltown':'Campbelltown',
    'canterbury-bankstown':'Canterbury-Bankstown','inner west':'Inner West',
    'city of sydney':'Sydney','sydney':'Sydney','bayside':'Bayside',
    'randwick':'Randwick','woollahra':'Woollahra','north sydney':'North Sydney',
    'willoughby':'Willoughby','mosman':'Mosman','lane cove':'Lane Cove',
    'ryde':'Ryde','hunters hill':'Hunters Hill','canada bay':'Canada Bay',
    'strathfield':'Strathfield','burwood':'Burwood','georges river':'Georges River',
    'sutherland':'Sutherland','sutherland shire':'Sutherland','wollondilly':'Wollondilly',
  };

  // Clean raw name from ArcGIS before using as fallback:
  // 1. Convert ALL CAPS → Title Case
  // 2. Strip trailing "Council", "City Council", "Shire Council", "Shire", "City"
  function cleanLGAName(raw) {
    if (!raw) return '';
    // Convert all-caps to title case (leave mixed-case alone)
    let s = (raw === raw.toUpperCase())
      ? raw.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
      : raw;
    // Strip common suffixes
    s = s.replace(/\s+(City\s+)?Council$/i, '')
         .replace(/\s+Shire\s+Council$/i, '')
         .replace(/\s+City$/i, '')
         .replace(/\s+Shire$/i, '')
         .trim();
    return s;
  }

  const cleanedName = cleanLGAName(name);
  const displayName = canonicalNames[key] 
    || canonicalNames[normalise(name)] 
    || canonicalNames[normalise(cleanedName)]
    || cleanedName 
    || name;
  
  console.log('[LGA panel] name:', displayName, 'key:', key, 'matched:', !!cd, 'c22:', c22, 'income:', inc);
  const risk   = heatRiskLabel(c22);
  const fillCol = canopyFill(c22);
  const barW    = Math.round(c22/55*100);
  const trend   = (c22 - c19).toFixed(1);
  const vsAvgC  = (c22 - SYDNEY_AVG_CANOPY).toFixed(1);
  const vsAvgI  = inc - SYDNEY_AVG_INCOME;
  const heatDiff = (peak - 28.1).toFixed(1);

  panel.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:1rem;">
      <div>
        <p style="font-family:'DM Serif Display',serif;font-size:1.35rem;color:#fff;line-height:1.1;margin-bottom:3px;">${displayName}</p>
        <p style="font-size:10px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:0.12em;">Local Government Area</p>
      </div>
      <button id="closePanelBtn" style="background:rgba(255,255,255,0.08);border:none;color:rgba(255,255,255,0.5);width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:14px;flex-shrink:0;">✕</button>
    </div>
    <p style="font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-bottom:6px;">Tree canopy cover 2022</p>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
      <div style="flex:1;height:10px;background:rgba(255,255,255,0.1);border-radius:5px;overflow:hidden;">
        <div style="width:${barW}%;height:100%;background:${fillCol};border-radius:5px;"></div>
      </div>
      <span style="font-family:'DM Serif Display',serif;font-size:1.5rem;color:${fillCol};min-width:42px;text-align:right;">${c22}%</span>
    </div>
    <p style="font-size:11px;color:rgba(255,255,255,0.45);margin-bottom:2px;">${parseFloat(trend)>=0?'▲ +'+trend:'▼ '+trend}% since 2019</p>
    <p style="font-size:11px;color:${parseFloat(vsAvgC)>=0?'#52b788':'#e07a2f'};margin-bottom:1rem;">
      ${parseFloat(vsAvgC)>=0?'▲':'▼'} ${Math.abs(parseFloat(vsAvgC))}% ${parseFloat(vsAvgC)>=0?'above':'below'} Sydney avg (${SYDNEY_AVG_CANOPY}%)
    </p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:1rem;">
      <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:9px;padding:10px 12px;">
        <p style="font-size:9px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">Peak summer temp</p>
        <p style="font-family:'DM Serif Display',serif;font-size:1.4rem;color:#e07a2f;line-height:1;">${peak}°C</p>
        <p style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:2px;">+${heatDiff}°C above coastal</p>
      </div>
      <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:9px;padding:10px 12px;">
        <p style="font-size:9px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">Heat risk</p>
        <p style="font-family:'DM Serif Display',serif;font-size:1.4rem;line-height:1;color:${risk.color};">${risk.label}</p>
        <p style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:2px;">${c22}% canopy</p>
      </div>
    </div>
    <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:9px;padding:10px 12px;margin-bottom:1rem;">
      <p style="font-size:9px;color:rgba(255,255,255,0.35);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px;">Median household income</p>
      <div style="display:flex;align-items:baseline;gap:8px;">
        <p style="font-family:'DM Serif Display',serif;font-size:1.4rem;color:#fff;line-height:1;">$${inc.toLocaleString()}</p>
        <p style="font-size:11px;color:rgba(255,255,255,0.4);">per week</p>
      </div>
      <p style="font-size:11px;color:${vsAvgI>=0?'#52b788':'#e07a2f'};margin-top:3px;">
        ${vsAvgI>=0?'▲':'▼'} $${Math.abs(vsAvgI).toLocaleString()} ${vsAvgI>=0?'above':'below'} Sydney average
      </p>
    </div>
    <div style="border-left:2px solid ${fillCol};padding:8px 12px;background:rgba(255,255,255,0.04);border-radius:0 6px 6px 0;">
      <p style="font-size:12px;color:rgba(255,255,255,0.7);line-height:1.5;">
        ${c22<15
          ? `${displayName} has critically low tree cover. Residents endure <strong style="color:#e07a2f;">+${heatDiff}°C hotter</strong> summers — a direct consequence of underinvestment in urban greening.`
          : c22<25
          ? `${displayName} sits below the Sydney average. Targeted greening here would directly reduce heat exposure for thousands of residents.`
          : `${displayName}'s ${c22}% canopy is above average, providing meaningful cooling. This is what every Sydney suburb deserves.`}
      </p>
    </div>`;

  panel.style.transform = 'translateX(0)';
  document.getElementById('closePanelBtn').addEventListener('click', closeLGAPanel);
}

function closeLGAPanel() {
  const panel = document.getElementById('lgaClickPanel');
  if (panel) panel.style.transform = 'translateX(-320px)';
  if (activeLGALayer) { geojsonLayer.resetStyle(activeLGALayer); activeLGALayer = null; }
}

// ── TAB BUTTONS ────────────────────────────────────────────────────────
// Wires up the Canopy / Heat risk / Wealth toggle buttons above the LGA map.
// Each click calls renderLeafletMode() with the corresponding mode string.
document.querySelectorAll('.map-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.map-tab').forEach(b => {
      b.style.background='#fff'; b.style.color='#5a5a5a';
    });
    btn.style.background='#1a3a2a'; btn.style.color='#fff';
    renderLeafletMode(btn.dataset.mode);
  });
});

// ── MAP INIT TRIGGER ───────────────────────────────────────────────────
// maybeInitMap() checks if the map container is near the viewport before
// calling initLeafletMap(). Runs once on a 300ms delay and again on each scroll.
// Also wires up the LGA search input (#lgaMapSearch) after an 800ms delay
// to ensure the GeoJSON layer is ready for eachLayer() lookups.
// Use a small timeout so the DOM has fully painted before Leaflet measures the container
function maybeInitMap() {
  if (leafletMap) return;
  const el = document.getElementById('lgaLeafletMap');
  if (!el) return;
  const rect = el.getBoundingClientRect();
  if (rect.top < window.innerHeight + 400) {
    initLeafletMap();
  }
}
// Try after short delay (allows container to paint)
setTimeout(maybeInitMap, 300);
// Also try on scroll
window.addEventListener('scroll', maybeInitMap, {passive: true});

// ── LGA MAP SEARCH ─────────────────────────────────────────────────────
// Wires up the search input (#lgaMapSearch) added above the map tab buttons.
// Filters CANOPY_DATA keys, shows a dropdown, then on selection zooms the map,
// highlights the matching GeoJSON layer, and opens the LGA data panel.
// This was added in iteration 2 based on usability testing feedback (Issue 2:
// users couldn't identify which LGA they were clicking on the map).
// Wire up after a short delay to ensure DOM is ready
setTimeout(() => {
  const mapSearchEl = document.getElementById('lgaMapSearch');
  const mapDropEl   = document.getElementById('lgaMapDropdown');
  if (!mapSearchEl || !mapDropEl) return;

  const lgaNames = Object.keys(CANOPY_DATA)
    .filter(k => !['city of sydney','sydney'].includes(k))
    .map(k => ({
      key: k,
      label: k.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
               .replace('Canterbury-bankstown','Canterbury-Bankstown')
               .replace('Ku-ring-gai','Ku-ring-gai'),
      c22: CANOPY_DATA[k].c22
    }))
    .sort((a,b) => a.label.localeCompare(b.label));

  function canopyColour(v) {
    if(v>=50)return'#1a6e1a'; if(v>=40)return'#2d8a2e'; if(v>=35)return'#4aaa30';
    if(v>=30)return'#78be20'; if(v>=25)return'#a8d020'; if(v>=22)return'#c8d820';
    if(v>=18)return'#e8d020'; if(v>=15)return'#f5b820'; if(v>=12)return'#f07830';
    if(v>=10)return'#e05018'; return'#cc1a1a';
  }

  mapSearchEl.addEventListener('input', function() {
    const q = this.value.trim().toLowerCase();
    if (q.length < 1) { mapDropEl.style.display='none'; return; }
    const hits = lgaNames.filter(l => l.label.toLowerCase().includes(q)).slice(0,8);
    if (!hits.length) { mapDropEl.style.display='none'; return; }
    mapDropEl.innerHTML = hits.map(l =>
      '<div class="lga-map-hit" data-key="'+l.key+'" style="padding:9px 14px;cursor:pointer;'+
      'font-size:13px;color:#333;border-bottom:1px solid #f0ede8;display:flex;justify-content:space-between;align-items:center;">'+
      '<span>'+l.label+'</span>'+
      '<span style="font-size:11px;background:'+canopyColour(l.c22)+';color:#fff;padding:2px 7px;border-radius:10px;margin-left:8px;">'+l.c22+'%</span>'+
      '</div>'
    ).join('');
    mapDropEl.style.display='block';
    mapDropEl.querySelectorAll('.lga-map-hit').forEach(item => {
      item.addEventListener('mouseenter', () => item.style.background='#f5f0e8');
      item.addEventListener('mouseleave', () => item.style.background='#fff');
      item.addEventListener('click', () => {
        mapSearchEl.value = item.querySelector('span').textContent;
        mapDropEl.style.display = 'none';
        // Find the matching layer and highlight it
        if (typeof geojsonLayer !== 'undefined' && geojsonLayer && typeof leafletMap !== 'undefined') {
          const key = item.dataset.key;
          let found = null;
          geojsonLayer.eachLayer(layer => {
            const p = layer.feature?.properties;
            if (!p) return;
            const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
            if (norm(p.LGA_NAME||'') === norm(key) || norm(p.LGA_NAME||'').includes(norm(key)) || norm(key).includes(norm(p.LGA_NAME||''))) {
              found = layer;
            }
          });
          if (found) {
            // Reset previous selection
            if (typeof activeLGALayer !== 'undefined' && activeLGALayer) {
              geojsonLayer.resetStyle(activeLGALayer);
              activeLGALayer.getElement()?.classList.remove('leaflet-selected-lga');
            }
            // Highlight found layer
            activeLGALayer = found;
            found.setStyle({fillOpacity: 0.88, weight: 4, color: '#52b788', dashArray: null});
            found.getElement()?.classList.add('leaflet-selected-lga');
            found.bringToFront();
            // Zoom to it
            try { leafletMap.fitBounds(found.getBounds(), {padding:[60,60], maxZoom:12}); } catch(e){}
            // Open panel
            if (typeof openLGAPanel === 'function') {
              openLGAPanel(found.feature.properties);
            }
          }
        }
      });
    });
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#lgaMapSearch') && !e.target.closest('#lgaMapDropdown'))
      mapDropEl.style.display = 'none';
  });
  mapSearchEl.addEventListener('keydown', e => {
    if (e.key === 'Escape') mapDropEl.style.display = 'none';
  });
}, 800);

// lgaData array for the ranked strip below (derived from embedded canopy data)
const lgaData = Object.entries(CANOPY_DATA)
  .filter(([k]) => !['the hills shire','sutherland shire','city of sydney','sydney'].includes(k))
  .map(([k,v]) => ({
    name: k.split(' ').map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' '),
    canopy: v.c22, income: v.income
  }));

// ── SECTION 3: RANKED CANOPY STRIP ────────────────────────────────────────
// Used by: #rankStrip div in shades_of_inequality.html (Section 3 — "LGA by LGA")
// Also provides canopyColor() to the simulator section.
// Renders a horizontal bar for each LGA sorted by canopy % descending,
// with the colour scale matching the choropleth map above.
// Maps a canopy percentage to a hex colour matching the green→red scale.
// Defined here (outside initSimulator) so the ranked strip can use it too.
function canopyColor(v) {
  if (v >= 50) return '#1a6e1a';
  if (v >= 40) return '#2d8f2d';
  if (v >= 35) return '#4aaa30';
  if (v >= 30) return '#78be20';
  if (v >= 25) return '#a0c830';
  if (v >= 22) return '#c8d820';
  if (v >= 18) return '#e8d020';
  if (v >= 15) return '#f5b020';
  if (v >= 12) return '#f07820';
  if (v >= 10) return '#e04010';
  return '#cc1a1a';
}

// ── RANKED STRIP ──
// allLGAs: sort the GeoJSON-derived lgaData by canopy descending
const allLGAs = [...lgaData].sort((a,b) => b.canopy - a.canopy);
const strip = document.getElementById('rankStrip');
strip.innerHTML = allLGAs.map(d => {
  const col = canopyColor(d.canopy);
  const pct = (d.canopy / 50 * 100).toFixed(1);
  return `<div style="display:flex;align-items:center;gap:10px;">
    <span style="font-size:11px;color:#333;min-width:110px;text-align:right;">${d.name}</span>
    <div style="flex:1;height:18px;background:#e8e4dc;border-radius:4px;overflow:hidden;position:relative;">
      <div style="width:${pct}%;height:100%;background:${col};border-radius:4px;transition:width 0.6s ease;"></div>
    </div>
    <span style="font-size:11px;font-weight:600;color:${col};min-width:32px;">${d.canopy}%</span>
  </div>`;
}).join('');

// ── SECTION 4: TEMPERATURE LINE CHART ─────────────────────────────────────
// Used by: #tempChart canvas in shades_of_inequality.html (Section 4 — "The Postcode Penalty")
// Renders a Chart.js line chart comparing daily max temperatures for February 2026
// at Observatory Hill (coastal, high canopy) vs Penrith (western suburbs, low canopy).
// Data source: Bureau of Meteorology station records 066214 and 067113.
// Chart.js loaded via CDN in shades_of_inequality.html.
const obsTemps   = [28.1,22.6,25.2,27.3,34.6,30.0,30.1,23.8,29.1,29.0,31.7,24.2,22.1,25.9,25.4,27.2,28.0,36.6,28.0,26.1,32.2,31.6,29.3,30.3,30.4,26.6,24.1,26.8];
const penrithTemps=[32.3,23.1,24.9,31.8,39.0,30.8,34.6,23.0,29.8,31.1,36.8,27.9,21.9,23.3,23.4,27.6,31.1,37.3,32.2,28.6,34.8,34.8,29.9,32.8,31.5,26.4,23.5,25.8];
const febDays = Array.from({length: 28}, (_,i) => `Feb ${i+1}`);

new Chart(document.getElementById('tempChart'), {
  type: 'line',
  data: {
    labels: febDays,
    datasets: [
      {
        label: 'Observatory Hill (coastal)',
        data: obsTemps,
        borderColor: '#2d6a4f',
        backgroundColor: 'rgba(45,106,79,0.08)',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#2d6a4f',
        fill: false,
        tension: 0.3,
        borderDash: [5, 3],
      },
      {
        label: 'Penrith (western suburbs)',
        data: penrithTemps,
        borderColor: '#c1440e',
        backgroundColor: 'rgba(193,68,14,0.08)',
        borderWidth: 2.5,
        pointRadius: 3,
        pointBackgroundColor: '#c1440e',
        fill: false,
        tension: 0.3,
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw}°C` }
      },
      annotation: {}
    },
    scales: {
      x: {
        ticks: { color: '#5a5a5a', font: { size: 10 }, maxTicksLimit: 14, maxRotation: 0 },
        grid: { color: 'rgba(0,0,0,0.05)' }
      },
      y: {
        min: 18, max: 42,
        ticks: { callback: v => v + '°', color: '#5a5a5a', font: { size: 11 } },
        grid: { color: 'rgba(0,0,0,0.06)' }
      }
    }
  }
});

// ── SECTION 5: LGA CANOPY SIMULATOR ────────────────────────────────────────
// Used by: #lgaSimMap div + sidebar controls in shades_of_inequality.html (Section 5)
//
// This is the second interactive map — a "What If?" simulator letting users
// set a canopy target for all LGAs and see projected temperature changes.
// It reuses the same Leaflet.js setup and FALLBACK_GEOJSON/fetchLGABoundaries()
// from the LGA map above so boundaries are consistent across both maps.
//
// NOTE ON AI ASSISTANCE (Claude AI — claude.ai):
// The simulator went through several design iterations. My original plan was suburb-level
// using ABS suburb boundaries, but the NSW ArcGIS API kept returning too few results
// and name-matching was unreliable. I worked through the debugging with Claude AI —
// we identified that only ~128 of 600+ suburbs were matching — and decided to switch
// to LGA-level data instead, which is cleaner and consistent with the rest of the dashboard.
// Claude also helped write the getDisplayCanopy() logic (global slider raises all LGAs
// below target while those already above keep their actual value), and the enrichForSim()
// helper that reuses the existing live boundary fetch rather than duplicating the call.

function initSimulator() {

// ── LGA DATA ──────────────────────────────────────────────────────
const LGA_LIST = Object.entries(CANOPY_DATA)
.filter(([k]) => !['the hills shire','sutherland shire','city of sydney','sydney'].includes(k))
.map(([k, v]) => ({
  key: k,
  name: k.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        .replace('Ku-ring-gai', 'Ku-ring-gai')
        .replace('Canterbury-bankstown', 'Canterbury-Bankstown'),
  c22: v.c22, c19: v.c19, income: v.income, peak: v.peak
}))
.sort((a,b) => a.name.localeCompare(b.name));

// ── STATE ─────────────────────────────────────────────────────────
let selectedLGA  = LGA_LIST.find(l => l.key === 'fairfield') || LGA_LIST[0];
let targetSlider = 25;       // global canopy target applied to ALL LGAs in target mode
let currentMode  = '2019';   // '2019' | '2022' | 'target'
let simMap       = null;
let simGeoLayer  = null;

// ── COLOUR SCALE (canopy %) ───────────────────────────────────────
function simCanopyFill(v) {
if (v >= 50) return '#1a6e1a'; if (v >= 40) return '#2d8a2e';
if (v >= 35) return '#4aaa30'; if (v >= 30) return '#78be20';
if (v >= 25) return '#a8d020'; if (v >= 22) return '#c8d820';
if (v >= 18) return '#e8d020'; if (v >= 15) return '#f5b820';
if (v >= 12) return '#f07830'; if (v >= 10) return '#e05018';
return '#cc1a1a';
}

// ── GET CANOPY VALUE FOR AN LGA IN CURRENT MODE ────────────────────
// In target mode: all LGAs shift TOWARD the global target by the same delta
// (LGAs already above target keep their value)
function getDisplayCanopy(lga) {
if (currentMode === '2019') return lga.c19;
if (currentMode === '2022') return lga.c22;
// target mode: each LGA gets whichever is higher — its 2022 value or the target
return Math.max(lga.c22, targetSlider);
}

// ── PROJECTED PEAK TEMP ────────────────────────────────────────────
// Uses the regression model: -0.19°C per 1% canopy gain
function getProjTemp(lga) {
const gain = getDisplayCanopy(lga) - lga.c22;
return Math.max(lga.peak - gain * 0.19, 18);
}

// ── STYLE ─────────────────────────────────────────────────────────
function styleSimFeature(feature) {
const lgaKey = feature.properties._lgaKey;
const lga    = lgaKey ? LGA_LIST.find(l => l.key === lgaKey) : null;
const isSel  = lgaKey === selectedLGA.key;

if (!lga) {
  return { fillColor: '#2a2a2a', fillOpacity: 0.15, color: 'rgba(150,150,150,0.2)', weight: 0.5 };
}

return {
  fillColor:    simCanopyFill(getDisplayCanopy(lga)),
  fillOpacity:  isSel ? 0.90 : 0.65,
  color:        isSel ? '#52b788' : 'rgba(0,0,0,0.25)',
  weight:       isSel ? 2.5 : 0.6,
  opacity:      1,
};
}

// ── CARD UPDATE ───────────────────────────────────────────────────
function updateSimCard(lga) {
if (!lga) return;
const el    = id => document.getElementById(id);
const c19   = lga.c19;
const c22   = lga.c22;
const disp  = getDisplayCanopy(lga);
const proj  = getProjTemp(lga);
const saved = lga.peak - proj;
const hdays = Math.max(0, Math.round(8 - (disp - c22) * 0.22));

if (el('simLgaName'))     el('simLgaName').textContent     = lga.name;
if (el('simIncome'))      el('simIncome').textContent      = '$' + lga.income.toLocaleString() + '/wk';
if (el('simCurrentTemp')) el('simCurrentTemp').textContent = lga.peak.toFixed(1) + '°C';

// Bars
[[2019, c19], [2022, c22]].forEach(([yr, pct]) => {
  const b = el('simBar'+yr), p = el('simPct'+yr);
  if (b) { b.style.width = (pct/65*100)+'%'; b.style.background = simCanopyFill(pct); }
  if (p) p.textContent = Math.round(pct)+'%';
});
if (el('simBarTarget')) { el('simBarTarget').style.width = (disp/65*100)+'%'; el('simBarTarget').style.background = simCanopyFill(disp); }
if (el('simPctTarget')) el('simPctTarget').textContent = Math.round(disp)+'%';
if (el('simSliderBig')) el('simSliderBig').textContent = Math.round(targetSlider)+'%';
if (el('lgaTargetSlider')) el('lgaTargetSlider').value = targetSlider;

// Projections
if (el('simProjTemp')) {
  el('simProjTemp').textContent = proj.toFixed(1)+'°';
  el('simProjTemp').style.color = saved > 1 ? '#52b788' : '#e07a2f';
}
if (el('simTempSaved')) {
  el('simTempSaved').textContent = (saved >= 0 ? '−' : '+') + Math.abs(saved).toFixed(1)+'°';
  el('simTempSaved').style.color = saved >= 0 ? '#52b788' : '#e07a2f';
}
if (el('simHeatDays')) el('simHeatDays').textContent = hdays;
}

// ── LEGEND UPDATE ─────────────────────────────────────────────────
function updateSimLegend() {
const title = document.getElementById('lgaSimLegendTitle');
const badge = document.getElementById('lgaSimBadge');
if (currentMode === '2019') {
  if (title) title.textContent = 'Canopy cover 2019';
  if (badge) badge.textContent = 'Canopy cover · NSW SEED 2019';
} else if (currentMode === '2022') {
  if (title) title.textContent = 'Canopy cover 2022';
  if (badge) badge.textContent = 'Canopy cover · NSW SEED 2022';
} else {
  if (title) title.textContent = 'Target scenario';
  if (badge) badge.textContent = 'Projected ' + (new Date().getFullYear() + 12) + ' · all LGAs ≥ ' + Math.round(targetSlider) + '%';
}
}

// ── RESTYLE ───────────────────────────────────────────────────────
function restyleSimMap() {
if (simGeoLayer) simGeoLayer.setStyle(styleSimFeature);
updateSimLegend();
updateSimCard(selectedLGA);
}

// ── ZOOM TO LGA ───────────────────────────────────────────────────
function zoomToLGA(lga) {
if (!simMap || !simGeoLayer) return;
simGeoLayer.eachLayer(layer => {
  if (layer.feature?.properties?._lgaKey === lga.key) {
    try { simMap.fitBounds(layer.getBounds(), { padding:[60,60], maxZoom:12 }); } catch(e){}
  }
});
}

// ── INIT MAP ──────────────────────────────────────────────────────
function initSimMap() {
const container = document.getElementById('lgaSimMap');
if (!container || simMap) return;

simMap = L.map('lgaSimMap', {
  center: [-33.82, 150.92], zoom: 9,
  scrollWheelZoom: false, zoomControl: true,
});

const carto = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com">CARTO</a>',
  subdomains: 'abcd', maxZoom: 18, opacity: 0.75,
});
const osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors', maxZoom: 19, opacity: 0.75,
});
carto.addTo(simMap);
carto.once('tileerror', () => { simMap.removeLayer(carto); osm.addTo(simMap); });
osm.addTo(simMap);

// ── INSTANT RENDER: enrich and display fallback GeoJSON immediately ──
const norm = s => s.toLowerCase().trim()
  .replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ')
  .replace(/ shire$/,'').replace(/ city$/,'').replace(/ council$/,'').trim();

function enrichForSim(gj) {
  return {
    type: 'FeatureCollection',
    features: gj.features.map(f => {
      const ef = enrichFeature(JSON.parse(JSON.stringify(f)));
      const name = ef.properties.LGA_NAME || '';
      const normName = norm(name);
      const match = LGA_LIST.find(l =>
        norm(l.name) === normName || l.key === normName ||
        normName.includes(l.key) || l.key.includes(normName)
      );
      ef.properties._lgaKey  = match ? match.key  : null;
      ef.properties._lgaName = match ? match.name : name;
      return ef;
    })
  };
}

const enriched = enrichForSim(FALLBACK_GEOJSON);

simGeoLayer = L.geoJSON(enriched, {
  style: styleSimFeature,
  onEachFeature: (feature, layer) => {
    const lgaKey = feature.properties._lgaKey;
    const lga    = lgaKey ? LGA_LIST.find(l => l.key === lgaKey) : null;
    if (!lga) return;

    layer.on('click', () => {
      selectedLGA = lga;
      updateSimCard(lga);
      restyleSimMap();
      // Briefly flash the selected layer for clear feedback
      this.setStyle({ weight: 5, color: '#52b788', fillOpacity: 0.97 });
      const flashLayer = this;
      setTimeout(() => { if (simGeoLayer) simGeoLayer.setStyle(styleSimFeature); }, 600);
      const se = document.getElementById('lgaSimSearch');
      if (se) se.value = lga.name;
    });

    layer.on('mouseover', function(e) {
      const tip  = document.getElementById('lgaSimTooltip');
      const disp = getDisplayCanopy(lga);
      const proj = getProjTemp(lga);
      if (tip) {
        tip.innerHTML =
          '<strong style="color:#52b788">' + lga.name + '</strong>' +
          '<br>🌿 ' + disp + '% canopy' +
          (currentMode === 'target' && disp > lga.c22
            ? ' <span style="color:#52b788">(+' + (disp - lga.c22) + '%)</span>' : '') +
          '<br>🌡 ' + proj.toFixed(1) + '°C projected peak' +
          '<br>💰 $' + lga.income.toLocaleString() + '/wk';
        const rect = container.getBoundingClientRect();
        tip.style.left    = (e.originalEvent.clientX - rect.left + 14) + 'px';
        tip.style.top     = (e.originalEvent.clientY - rect.top  - 10) + 'px';
        tip.style.opacity = '1';
      }
      if (lgaKey !== selectedLGA.key)
        this.setStyle({ weight: 2, color: '#52b788', fillOpacity: 0.92 });
    });
    layer.on('mousemove', function(e) {
      const tip = document.getElementById('lgaSimTooltip');
      if (tip?.style.opacity === '1') {
        const rect = container.getBoundingClientRect();
        tip.style.left = (e.originalEvent.clientX - rect.left + 14) + 'px';
        tip.style.top  = (e.originalEvent.clientY - rect.top  - 10) + 'px';
      }
    });
    layer.on('mouseout', function() {
      const tip = document.getElementById('lgaSimTooltip');
      if (tip) tip.style.opacity = '0';
      this.setStyle(styleSimFeature(feature));
    });
  }
}).addTo(simMap);

try { simMap.fitBounds(simGeoLayer.getBounds(), { padding:[20,20] }); } catch(e){}
setTimeout(() => simMap.invalidateSize(), 100);

// Background upgrade to live boundaries (silent, non-blocking)
fetchLGABoundaries().then(liveGJ => {
  if (liveGJ?.features?.length > 5) {
    const liveEnriched = enrichForSim(liveGJ);
    simGeoLayer.clearLayers();
    simGeoLayer.addData(liveEnriched);
    simGeoLayer.setStyle(styleSimFeature);
  }
}).catch(() => { /* keep fallback */ });
}

// ── YEAR / MODE TABS ───────────────────────────────────────────────────────
// Wires up the 2019 / 2022 / Target buttons above the simulator map.
// Each click updates currentMode and calls restyleSimMap() to recolour all LGA polygons.
// In Target mode the slider block (#lgaSimSliderBlock) becomes active.
// The "Projected 20XX" badge (#simFutureBadge) is shown/hidden via CSS class toggle.
document.querySelectorAll('.sim-tab-btn').forEach(btn => {
btn.addEventListener('click', () => {
  document.querySelectorAll('.sim-tab-btn').forEach(b => {
    b.style.background = 'transparent'; b.style.color = 'rgba(255,255,255,0.5)';
  });
  btn.style.background = '#52b788'; btn.style.color = '#0a1a10';
  currentMode = btn.dataset.mode;

  // Enable/disable slider based on mode
  const sliderBlock = document.getElementById('lgaSimSliderBlock');
  if (sliderBlock) {
    const isTarget = currentMode === 'target';
    sliderBlock.style.opacity = isTarget ? '1' : '0.4';
    sliderBlock.style.pointerEvents = isTarget ? 'auto' : 'none';
    sliderBlock.title = isTarget ? '' : 'Click the Target tab above to enable';
  }

  restyleSimMap();
});
});

// ── TARGET CANOPY SLIDER ─────────────────────────────────────────────────
// Used by: #lgaTargetSlider in shades_of_inequality.html (only visible in Target mode)
// Moving the slider updates targetSlider value and calls restyleSimMap(),
// which recolours every LGA polygon — those below the target turn greener,
// those already above stay at their actual canopy colour.
const tSlider = document.getElementById('lgaTargetSlider');
if (tSlider) tSlider.addEventListener('input', function() {
targetSlider = parseInt(this.value);
restyleSimMap(); // recolours every LGA
});

// ── SIMULATOR SEARCH ──────────────────────────────────────────────────────
// Used by: #lgaSimSearch + #lgaSimDropdown in shades_of_inequality.html
// Same pattern as the LGA map search — filters LGA_LIST, shows dropdown,
// on selection updates the card, recolours the map, and zooms to the LGA.
const searchEl = document.getElementById('lgaSimSearch');
const dropEl   = document.getElementById('lgaSimDropdown');
if (searchEl && dropEl) {
searchEl.addEventListener('input', function() {
  const q = this.value.trim().toLowerCase();
  if (q.length < 1) { dropEl.style.display = 'none'; return; }
  const hits = LGA_LIST.filter(l => l.name.toLowerCase().includes(q)).slice(0, 10);
  if (!hits.length) { dropEl.style.display = 'none'; return; }
  dropEl.innerHTML = hits.map(l =>
    '<div class="lga-drop-item" data-key="' + l.key + '" style="padding:9px 14px;cursor:pointer;' +
    'font-size:13px;color:#e0f5ec;border-bottom:1px solid rgba(255,255,255,0.07);' +
    'display:flex;justify-content:space-between;align-items:center;">' +
    '<span>' + l.name + '</span>' +
    '<span style="font-size:11px;background:' + simCanopyFill(l.c22) + ';color:#fff;' +
    'padding:2px 7px;border-radius:10px;margin-left:8px;">' + l.c22 + '%</span></div>'
  ).join('');
  dropEl.style.display = 'block';
  dropEl.querySelectorAll('.lga-drop-item').forEach(item => {
    item.addEventListener('mouseenter', () => item.style.background = 'rgba(82,183,136,0.15)');
    item.addEventListener('mouseleave', () => item.style.background = 'transparent');
    item.addEventListener('click', () => {
      const lga = LGA_LIST.find(l => l.key === item.dataset.key);
      if (lga) {
        selectedLGA = lga;
        searchEl.value = lga.name;
        dropEl.style.display = 'none';
        updateSimCard(lga);
        restyleSimMap();
        zoomToLGA(lga);
      }
    });
  });
});
document.addEventListener('click', e => {
  if (!e.target.closest('#lgaSimSearch') && !e.target.closest('#lgaSimDropdown'))
    dropEl.style.display = 'none';
});
searchEl.addEventListener('keydown', e => {
  if (e.key === 'Escape') dropEl.style.display = 'none';
});
}

// ── SIMULATOR INIT ─────────────────────────────────────────────────────────
// Populates the initial card with Fairfield data, renders the legend,
// and sets up the IntersectionObserver to call initSimMap() when the user
// scrolls the simulator section into view.
updateSimCard(selectedLGA);
updateSimLegend();

// Slider always visible but dimmed when not in target mode
const sliderBlock = document.getElementById('lgaSimSliderBlock');
if (sliderBlock) {
sliderBlock.style.display = 'block';
sliderBlock.style.opacity = '0.4';
sliderBlock.style.pointerEvents = 'none';
sliderBlock.title = 'Click the Target tab above to enable';
}

const simContainer = document.getElementById('lgaSimMap');
if (simContainer) {
const obs = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting && !simMap) { initSimMap(); obs.disconnect(); } });
}, { threshold: 0.05, rootMargin: '200px' });
obs.observe(simContainer);
const rect = simContainer.getBoundingClientRect();
if (rect.top < window.innerHeight + 200 && !simMap) initSimMap();
}

} // end initSimulator()

// Direct map init — fires 500ms after all scripts parsed
// This is the final safety net to ensure the map renders
setTimeout(function() {
if (!leafletMap) {
  var el = document.getElementById('lgaLeafletMap');
  if (el) initLeafletMap();
}
}, 500);



// ── SECTION 6: BUDGET CALCULATOR + BOOTSTRAP ────────────────────────────────
// The budget calculator logic lives in an IIFE at the bottom of this file.
// It reads CANOPY_DATA + LGA_AREAS, wires up #budgetLgaSelect, and recalculates
// cost/ROI outputs live as the user changes LGA, target %, or timeframe.
// Data sources: NSW Greening Our City 2026 ($417/tree), Treenet ($25/tree/yr),
// i-Tree ($126/tree/yr), ABS 2021 LGA areas.
//
// We also prefetch the live LGA GeoJSON on page load so it's ready in memory
// before the user scrolls to either map — eliminates the fetch lag entirely.
// Prefetch live LGA GeoJSON immediately
let _prefetchedGeoJSON = null;
(function prefetchLGA() {
fetchLGABoundaries().then(gj => {
  if (gj && gj.features && gj.features.length > 5) {
    _prefetchedGeoJSON = gj;
  }
}).catch(() => {});
})();

// Monkey-patch fetchLGABoundaries to return prefetched data instantly if available
const _origFetch = fetchLGABoundaries;
// (fetchLGABoundaries already handles caching internally via the response)

if (document.readyState === 'loading') {
document.addEventListener('DOMContentLoaded', initSimulator);
} else {
initSimulator();
}
// ── SECTION 6: BUDGET CALCULATOR ─────────────────────────────────
(function() {

// LGA areas in km² (ABS 2021) — used to estimate trees needed
const LGA_AREAS = {"blacktown": 247, "blue mountains": 1431, "burwood": 7, "camden": 201, "campbelltown": 312, "canada bay": 19, "canterbury-bankstown": 68, "cumberland": 56, "fairfield": 101, "georges river": 38, "hawkesbury": 2770, "hornsby": 459, "hunters hill": 6, "inner west": 35, "ku-ring-gai": 84, "lane cove": 10, "liverpool": 305, "mosman": 8, "north sydney": 10, "northern beaches": 253, "parramatta": 84, "penrith": 404, "randwick": 36, "ryde": 44, "strathfield": 11, "sutherland": 370, "sydney": 26, "the hills": 380, "waverley": 9, "willoughby": 22, "wollondilly": 1617, "woollahra": 12, "bayside": 32};

// Constants from real NSW data
const COST_PER_TREE  = 417;   // NSW Greening Our City 2026: $10M / 24,000 trees
const MAINT_PER_TREE = 25;    // Treenet Australian LGA study median
const BENEFIT_PER_TREE = 126; // i-Tree / Univ of Sydney ecosystem services
const M2_PER_TREE    = 200;   // ~200m² canopy per mature street tree

const lgaSelect   = document.getElementById('budgetLgaSelect');
const targetSlider = document.getElementById('budgetTargetSlider');
const yearsSlider  = document.getElementById('budgetYearsSlider');

if (!lgaSelect || !targetSlider || !yearsSlider) return;

// Populate LGA dropdown from CANOPY_DATA
const lgas = Object.entries(CANOPY_DATA)
  .filter(([k]) => !['city of sydney','sydney'].includes(k))
  .map(([k, v]) => ({
    key: k,
    name: k.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
           .replace('Canterbury-bankstown','Canterbury-Bankstown')
           .replace('Ku-ring-gai','Ku-ring-gai'),
    c22: v.c22, income: v.income, peak: v.peak
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

lgas.forEach(l => {
  const opt = document.createElement('option');
  opt.value = l.key;
  opt.textContent = l.name + ' (' + l.c22 + '% canopy)';
  lgaSelect.appendChild(opt);
});
// Default to Fairfield
lgaSelect.value = 'fairfield';

function fmt(n) {
  if (n >= 1e6) return '$' + (n/1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + Math.round(n/1000) + 'k';
  return '$' + Math.round(n);
}
function fmtNum(n) {
  return n >= 1000 ? (n/1000).toFixed(1) + 'k' : n.toString();
}

function update() {
  const lgaKey    = lgaSelect.value;
  const lga       = lgas.find(l => l.key === lgaKey);
  const target    = parseInt(targetSlider.value);
  const years     = parseInt(yearsSlider.value);

  document.getElementById('budgetTargetLabel').textContent = target + '%';
  document.getElementById('budgetYearsLabel').textContent  = years + ' year' + (years > 1 ? 's' : '');

  if (!lga) return;

  const currentCanopy = lga.c22;
  const gain = Math.max(0, target - currentCanopy); // percentage points to gain

  if (gain <= 0) {
    // Already at or above target
    document.getElementById('budgetTreeCount').textContent   = '0';
    document.getElementById('budgetTreesPerYear').textContent = lga.name + ' already meets this target';
    document.getElementById('budgetTotalCost').textContent   = '$0';
    document.getElementById('budgetAnnualCost').textContent  = 'No planting needed';
    document.getElementById('budgetMaintenance').textContent = '—';
    document.getElementById('budgetROI').textContent         = '—';
    document.getElementById('budgetPayback').textContent     = lga.name + ' already has ' + currentCanopy + '% canopy — above your ' + target + '% target.';
    return;
  }

  // Estimate LGA area — use lookup or fallback to 100km²
  const areaSqKm  = LGA_AREAS[lgaKey] || LGA_AREAS[lga.name.toLowerCase()] || 100;
  const areaM2    = areaSqKm * 1e6;

  // Trees needed: gain% of total area / m² per tree canopy
  const canopyGainM2 = areaM2 * (gain / 100);
  const treesNeeded  = Math.round(canopyGainM2 / M2_PER_TREE);
  const treesPerYear = Math.round(treesNeeded / years);

  const totalPlanting = treesNeeded * COST_PER_TREE;
  const annualPlanting = totalPlanting / years;
  const annualMaint   = treesNeeded * MAINT_PER_TREE;
  const annualBenefit = treesNeeded * BENEFIT_PER_TREE;
  const paybackYears  = totalPlanting / (annualBenefit - annualMaint);

  document.getElementById('budgetTreeCount').textContent    = fmtNum(treesNeeded) + ' trees';
  document.getElementById('budgetTreesPerYear').textContent = fmtNum(treesPerYear) + ' per year over ' + years + ' years';
  document.getElementById('budgetTotalCost').textContent    = fmt(totalPlanting);
  document.getElementById('budgetAnnualCost').textContent   = fmt(annualPlanting) + ' per year';
  document.getElementById('budgetMaintenance').textContent  = fmt(annualMaint) + '/yr';
  document.getElementById('budgetROI').textContent          = fmt(annualBenefit) + '/yr';

  const paybackEl = document.getElementById('budgetPayback');
  if (paybackYears > 0 && paybackYears < 200) {
    const breakeven = Math.round(paybackYears);
    paybackEl.innerHTML =
      '<strong>Break-even in ~' + breakeven + ' years.</strong> ' +
      'At $' + BENEFIT_PER_TREE + ' ecosystem value per tree per year (shade, air quality, stormwater, health), ' +
      'the ' + fmtNum(treesNeeded) + ' trees needed to lift ' + lga.name + ' from ' + currentCanopy + '% to ' + target + '% canopy ' +
      'would generate <strong>' + fmt(annualBenefit) + '/yr</strong> in measurable community benefit — ' +
      'paying back the planting investment by ' + (new Date().getFullYear() + breakeven) + '.';
  } else {
    paybackEl.textContent = 'Ecosystem returns exceed maintenance costs once trees reach maturity (~10 years).';
  }
}

lgaSelect.addEventListener('change', update);
targetSlider.addEventListener('input', update);
yearsSlider.addEventListener('input', update);
update();

})();


// ── USABILITY: scroll progress dots ───────────────────────────────
(function() {
const dots = document.querySelectorAll('#scrollProgress .sp-dot');
if (!dots.length) return;
const sections = [
  document.querySelector('.hero'),
  document.querySelector('.section'),
  document.getElementById('lgaLeafletMap')?.closest('.section') || null,
  document.getElementById('tempChart')?.closest('.section') || null,
  document.getElementById('lgaSimMap')?.closest('div[style*="background:#0a1a10"]') || null,
  document.querySelector('footer'),
];
function updateDots() {
  const sy = window.scrollY + window.innerHeight * 0.45;
  let active = 0;
  sections.forEach((sec, i) => {
    if (sec && sec.getBoundingClientRect().top + window.scrollY <= sy) active = i;
  });
  dots.forEach((d, i) => d.classList.toggle('active', i === active));
}
window.addEventListener('scroll', updateDots, { passive: true });
updateDots();
})();

// ── USABILITY: Future projection badge on simulator ────────────────
(function() {
const badge = document.getElementById('simFutureBadge');
if (!badge) return;
// Show badge when Target tab is active (watch for class change on buttons)
document.querySelectorAll('.sim-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (badge) badge.classList.toggle('visible', btn.dataset.mode === 'target');
  });
});
})();