/**
 * Icatmar Buoy Data Viewer - Vanilla JavaScript Core Application
 */

// Global state
let state = {
  buoys: [],
  selectedBuoyId: null,
  timeOffsetDays: 0, // Devised offset in days from current moment
  buoyDataCache: {}, // Stores records fetched per buoy
  loadingBuoys: false,
  loadingData: false,
  isDemoMode: false,
  map: null,
  markers: {},
  activeSensorTab: null
};

// Colors mapping matching design request
const COLORS = {
  blue: 'rgb(20, 120, 167)',
  darkBlue: 'rgb(15, 48, 98)',
  lightBlue: 'rgb(82, 181, 217)',
  red: 'rgb(255, 115, 105)'
};

// Parameter configs: label, unit, scale factor
const PARAMETER_CONFIGS = {
  // Air Temperature
  DRYT: { label: "Air Temp", unit: "°C", scaleFactor: 10 },
  DRYTM: { label: "Max Air Temp", unit: "°C", scaleFactor: 10 },
  DRYTL: { label: "Min Air Temp", unit: "°C", scaleFactor: 10 },
  DEWT: { label: "Dew Point", unit: "°C", scaleFactor: 10 },
  
  // Water Temperature
  temperature: { label: "Water Temp", unit: "°C", scaleFactor: 1 },

  // Humidities
  RELH: { label: "Rel Humid", unit: "%", scaleFactor: 10 },
  RELHM: { label: "Max Rel Humid", unit: "%", scaleFactor: 10 },
  RELHL: { label: "Min Rel Humid", unit: "%", scaleFactor: 10 },

  // Atmospheric Pressure
  ATMS: { label: "Pres", unit: "hPa", scaleFactor: 10 },

  // Wind Speeds
  WSPD: { label: "Wind Spd", unit: "m/s", scaleFactor: 100 },
  GSPD: { label: "Gust Spd", unit: "m/s", scaleFactor: 100 },

  // Wind Directions
  WDIR: { label: "Wind Dir", unit: "°", scaleFactor: 1 },
  GDIR: { label: "Gust Dir", unit: "°", scaleFactor: 1 },

  // Waves
  VGHS: { label: "Wave Hgt (Sig)", unit: "m", scaleFactor: 1 },
  VMAX: { label: "Wave Hgt (Max)", unit: "m", scaleFactor: 1 },
  VGHMAX: { label: "Wave Hgt (Max)", unit: "m", scaleFactor: 1 },
  VGMX: { label: "Wave Hgt (Max)", unit: "m", scaleFactor: 1 },
  VGTPK: { label: "Wave Period (Pk)", unit: "s", scaleFactor: 1 },
  VPED: { label: "Wave Dir (Mean)", unit: "°", scaleFactor: 1 },
  VMDR: { label: "Wave Dir (Pk)", unit: "°", scaleFactor: 1 },

  // CTD
  PSAL: { label: "CTD Salinity", unit: "psu", scaleFactor: 10000 },
  SNUM: { label: "CTD Number of Samples", unit: "", scaleFactor: 1 }
};

// Advanced context-sensitive parameter configurator
function getParamConfig(key, sensorName = "") {
  const isCTDSensor = sensorName && (sensorName.toUpperCase().includes("CTD") || sensorName.toUpperCase().includes("SBE37"));
  const lowerKey = key.toLowerCase();

  if (isCTDSensor) {
    if (lowerKey === "temperature" || lowerKey === "temp") {
      return { label: "CTD Temperature", unit: "°C" };
    }
    if (lowerKey === "salinity" || lowerKey === "sal" || lowerKey === "psal") {
      return { label: "CTD Salinity", unit: "psu" };
    }
    if (lowerKey === "pressure" || lowerKey === "pres") {
      return { label: "CTD Pressure", unit: "dbar" };
    }
    if (lowerKey === "snum") {
      return { label: "CTD Number of Samples", unit: "" };
    }
  }

  // Fallbacks
  if (lowerKey === "salinity" || lowerKey === "sal" || lowerKey === "psal") {
    return { label: "CTD Salinity", unit: "psu" };
  }
  if (lowerKey === "pressure" || lowerKey === "pres") {
    return { label: "Pressure", unit: "dbar" };
  }
  if (lowerKey === "snum") {
    return { label: "CTD Number of Samples", unit: "" };
  }
  if (lowerKey === "vmax" || lowerKey === "vghmax" || lowerKey === "vgmx") {
    return { label: "Wave Hgt (Max)", unit: "m" };
  }

  return PARAMETER_CONFIGS[key] || { label: key, unit: "" };
}

// Grouping system to bundle multiple parameters of the same nature inside 1 chart
function getParamGrouping(paramKey, sensorName = "") {
  const isCTDSensor = sensorName && (sensorName.toUpperCase().includes("CTD") || sensorName.toUpperCase().includes("SBE37"));
  const lowerKey = paramKey.toLowerCase();

  if (isCTDSensor) {
    if (lowerKey === "temperature" || lowerKey === "temp") {
      return { id: "ctd_temp", name: "CTD Water Temperature", unit: "°C" };
    }
    if (lowerKey === "salinity" || lowerKey === "sal" || lowerKey === "psal") {
      return { id: "ctd_sal", name: "CTD Salinity", unit: "psu" };
    }
    if (lowerKey === "pressure" || lowerKey === "pres") {
      return { id: "ctd_pres", name: "CTD Hydrostatic Pressure", unit: "dbar" };
    }
    if (lowerKey === "snum") {
      return { id: "ctd_snum", name: "Miscellaneous Stats", unit: "" };
    }
  }

  const config = getParamConfig(paramKey, sensorName);
  const unit = config ? config.unit : "";

  switch (paramKey) {
    case "DRYT":
    case "DRYTM":
    case "DRYTL":
    case "DEWT":
    case "temperature":
      return { id: "temp", name: "Temperatures", unit };
    case "RELH":
    case "RELHM":
    case "RELHL":
      return { id: "humidity", name: "Relative Humidity", unit };
    case "ATMS":
      return { id: "pressure", name: "Barometric Pressure", unit };
    case "WSPD":
    case "GSPD":
      return { id: "wind_speed", name: "Wind Magnitudes", unit };
    case "WDIR":
    case "GDIR":
      return { id: "wind_dir", name: "Wind Directions", unit };
    case "VGHS":
    case "VMAX":
    case "VGHMAX":
    case "VGMX":
      return { id: "wave_height", name: "Wave Heights", unit };
    case "VGTPK":
      return { id: "wave_period", name: "Wave Periods", unit };
    case "VPED":
    case "VMDR":
      return { id: "wave_dir", name: "Wave Directions", unit };
    default:
      return { id: "other", name: "Miscellaneous Stats", unit };
  }
}

// Convert degrees to a readable compass direction name
function getCompassDirection(degrees) {
  if (degrees === null || degrees === undefined || isNaN(degrees)) return "";
  const sectors = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = Math.round(degrees / 22.5) % 16;
  return sectors[index];
}

// Fallbacks
const FALLBACK_BUOYS = [
  {
    id: "865583042277664",
    name: "CDCR (Cadaqués)",
    lat: 42.3211716,
    lon: 3.3493733,
    latestTimestamp: new Date(Date.now() - 34 * 60 * 1000).toISOString(), // 34 mins ago (Green)
    source: "graphql_discovery",
  },
  {
    id: "865583042281872",
    name: "BLANES",
    lat: 41.600305,
    lon: 2.7698883,
    latestTimestamp: new Date(Date.now() - 4.2 * 60 * 60 * 1000).toISOString(), // 4.2 hours ago (Green)
    source: "graphql_discovery",
  },
  {
    id: "865583042292325",
    name: "TARRAGONA",
    lat: 41.0764716,
    lon: 1.3466933,
    latestTimestamp: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(), // 18 hours ago (Yellow)
    source: "graphql_discovery",
  },
  {
    id: "865583042292465",
    name: "TORTOSA (Delta)",
    lat: 40.71457,
    lon: 0.9849866,
    latestTimestamp: new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString(), // 50 hours ago (Gray)
    source: "graphql_discovery",
  }
];

// Helper to determine status based on difference
function calculateStatus(latestTimestamp) {
  const latestDate = new Date(latestTimestamp);
  const diffMs = Date.now() - latestDate.getTime();
  const diffHours = Math.max(0, diffMs / (1000 * 60 * 60));

  let status = "gray";
  let labelColor = "text-slate-400";
  let badgeColor = "bg-slate-400";

  if (diffHours < 5) {
    status = "green";
    labelColor = "text-emerald-500";
    badgeColor = "bg-emerald-500";
  } else if (diffHours < 48) {
    status = "yellow";
    labelColor = "text-amber-500";
    badgeColor = "bg-amber-500";
  }

  let timeString = "";
  if (diffHours < 1) {
    const mins = Math.round(diffHours * 60);
    timeString = mins === 1 ? "1 min ago" : `${mins} mins ago`;
  } else if (diffHours < 24) {
    const hrs = Math.round(diffHours);
    timeString = hrs === 1 ? "1 hr ago" : `${hrs} hrs ago`;
  } else {
    const days = Math.floor(diffHours / 24);
    timeString = days === 1 ? "1 day ago" : `${days} days ago`;
  }

  return { status, hours: diffHours, timeString, labelColor, badgeColor };
}

// Generate simulation records back up to 15 days in case of offline/CORS blocker
function generateMockRecords(buoyId, buoyName) {
  const datMap = {};
  const current = new Date();

  for (let i = 0; i < 24 * 14; i++) {
    const recDate = new Date(current.getTime() - i * 60 * 60 * 1000);
    const dateStr = recDate.toISOString();

    const hr = recDate.getHours();
    const cycle = Math.sin(((hr - 6) * Math.PI) / 12);

    const waveH = 0.3 * Math.abs(Math.sin(i / 14)) + 0.2 + Math.random() * 0.15;
    const waveP = 3.2 + 3.0 * Math.abs(Math.cos(i / 18)) + Math.random() * 0.3;

    const dryTempK = 220 + Math.round(35 * cycle) + Math.round(Math.random() * 8);
    const relHVal = 650 - Math.round(100 * cycle) + Math.round(Math.random() * 20);

    const pressure = 10130 + Math.round(50 * Math.cos(i / 36)) + Math.round(Math.random() * 5);
    const windSpeed = 150 + Math.round(400 * Math.abs(Math.sin(i / 12))) + Math.round(Math.random() * 25);
    const windDirection = Math.round((200 + 70 * Math.sin(i / 15)) % 360);

    datMap[dateStr] = {
      "HMP155-2": {
        RELH: String(relHVal),
        DRYT: String(dryTempK),
        DRYTM: String(dryTempK + 6),
        DRYTL: String(dryTempK - 4),
        RELHM: String(relHVal + 12),
        RELHL: String(relHVal - 10)
      },
      "Gill": {
        WDIR: String(windDirection),
        WSPD: String(windSpeed),
        GDIR: String((windDirection + 12) % 360),
        GSPD: String(Math.round(windSpeed * 1.3)),
        ATMS: String(pressure),
        RELH: String(relHVal),
        DRYT: String(dryTempK),
        DEWT: String(dryTempK - 32)
      },
      "ADCP": {
        temperature: (21.4 + 2.0 * Math.sin(i / 30) + Math.random() * 0.1).toFixed(1)
      },
      "CTD": {
        temperature: String(Math.round((18.5 + 1.2 * Math.sin(i / 15) + Math.random() * 0.1) * 10000)), // scales to ~18.5°C
        PSAL: String(Math.round((37.8 + 0.25 * Math.cos(i / 20) + Math.random() * 0.05) * 10000)), // Practical salinity, scales to ~37.8 psu
        pressure: String((12.4 + 0.3 * Math.sin(i / 10) + Math.random() * 0.02).toFixed(2)), // in dbar
        SNUM: String(54300 + i) // samples counter
      },
      "Olas": {
        VGHS: waveH.toFixed(3),
        VMAX: (waveH * 1.6 + Math.random() * 0.08).toFixed(3), // Peak maximum wave height, always taller than significant
        VGHMAX: (waveH * 1.6 + Math.random() * 0.08).toFixed(3),
        VGMX: (waveH * 1.6 + Math.random() * 0.08).toFixed(3),
        VGTPK: waveP.toFixed(3),
        VPED: ((160 + 40 * Math.cos(i / 12)) % 360).toFixed(1),
        VMDR: ((165 + 30 * Math.sin(i / 11)) % 360).toFixed(1)
      }
    };
  }

  return {
    buoy_id: buoyId,
    buoy_name: buoyName,
    records: 336,
    data: datMap
  };
}

// Map real raw keys to actual numbers
function parseValue(key, rawVal, sensorName = "") {
  if (rawVal === null || rawVal === undefined || rawVal === "") return null;
  const str = String(rawVal).trim();
  const float = parseFloat(str);
  if (isNaN(float)) return null;

  const isCTDSensor = sensorName && (sensorName.toUpperCase().includes("CTD") || sensorName.toUpperCase().includes("SBE37"));
  const lowerKey = key.toLowerCase();

  // If this is a CTD sensor, parse according to specific rules
  if (isCTDSensor) {
    if (lowerKey === "temperature" || lowerKey === "temp") {
      return float * 0.0001; // Scale factor 0.0001 as specified
    }
    if (lowerKey === "salinity" || lowerKey === "sal" || lowerKey === "psal") {
      return float * 0.0001; // Scale factor 0.0001 as specified
    }
    if (lowerKey === "pressure" || lowerKey === "pres") {
      return float; // Hydrostatic pressure returned raw in dbar (usually decimal or custom)
    }
    if (lowerKey === "snum") {
      return float;
    }
  }

  const conf = PARAMETER_CONFIGS[key];
  if (!conf) return float;

  // If float conversion contains '.', it was already parsed
  if (str.includes(".")) return float;

  // Scale it down
  return float / conf.scaleFactor;
}

// Get sliding time boundaries
function getTimeBoundaries() {
  let baseEnd = new Date(); // fallback to actual now

  // If we have cached downloaded data for the selected buoy, detect its latest timestamp to set the baseline
  const cached = state.buoyDataCache[state.selectedBuoyId];
  if (cached && cached.data) {
    const epochs = Object.keys(cached.data)
      .map(t => new Date(t.trim().replace(" ", "T")).getTime())
      .filter(t => !isNaN(t));
    if (epochs.length > 0) {
      const maxEpoch = Math.max(...epochs);
      baseEnd = new Date(maxEpoch);
    }
  }

  const currentEnd = new Date(baseEnd.getTime());
  currentEnd.setDate(currentEnd.getDate() + state.timeOffsetDays);
  
  const currentStart = new Date(currentEnd.getTime() - 7 * 24 * 60 * 60 * 1000);
  return { start: currentStart, end: currentEnd };
}

// Initialize Leaflet Map
function setupMap() {
  if (!window.L || state.map) return;

  const container = document.getElementById("leaflet-map-canvas");
  if (!container) return;

  state.map = window.L.map(container, {
    center: [41.5, 2.2],
    zoom: 7,
    scrollWheelZoom: false
  });

  window.L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; OsmContributors &copy; CartoDB',
    subdomains: "abcd",
    maxZoom: 18
  }).addTo(state.map);
}

// Update Map markers
function updateMapMarkers() {
  if (!state.map) return;

  // Clear existing
  Object.values(state.markers).forEach(m => state.map.removeLayer(m));
  state.markers = {};

  const bounds = window.L.latLngBounds([]);

  state.buoys.forEach(buoy => {
    const { status, timeString, badgeColor } = calculateStatus(buoy.latestTimestamp);
    const isSelected = buoy.id === state.selectedBuoyId;

    const dotColor = isSelected ? COLORS.red : (status === "green" ? "#10b981" : status === "yellow" ? "#f59e0b" : "#9ca3af");

    const marker = window.L.circleMarker([buoy.lat, buoy.lon], {
      radius: isSelected ? 12 : 8,
      fillColor: dotColor,
      color: "#ffffff",
      weight: isSelected ? 3.5 : 2,
      fillOpacity: 0.95,
      className: isSelected ? "pulse-active-selected" : ""
    });

    marker.bindPopup(`
      <div class="font-sans text-xs p-1">
        <b class="text-sm block text-brandDarkBlue border-b pb-1 mb-1">${buoy.name}</b>
        <span>Lat: ${buoy.lat.toFixed(4)} • Lon: ${buoy.lon.toFixed(4)}</span><br/>
        <span class="mt-1 block">Latency: <b class="capitalize" style="color: ${dotColor}">${status}</b> (${timeString})</span>
      </div>
    `);

    marker.on("click", () => {
      selectBuoy(buoy.id);
    });

    marker.addTo(state.map);
    state.markers[buoy.id] = marker;
    bounds.extend([buoy.lat, buoy.lon]);
  });

  // Fit bounds nicely if any buoys
  if (state.buoys.length > 0) {
    state.map.fitBounds(bounds, { padding: [30, 30] });
  }
}

// Render buoy switch list buttons
function renderBuoyList() {
  const container = document.getElementById("buoy-buttons-list");
  if (!container) return;

  container.innerHTML = "";

  state.buoys.forEach(buoy => {
    const isSelected = buoy.id === state.selectedBuoyId;
    const { status, timeString, badgeColor } = calculateStatus(buoy.latestTimestamp);

    // Create wrapper button
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `w-full text-left p-3.5 rounded-xl border flex items-center justify-between transition-all duration-300 transform active:scale-[0.98] outline-none group text-white`;

    // Interactive custom styling to guarantee rich dark-blue tones
    if (isSelected) {
      btn.style.backgroundColor = COLORS.red;
      btn.style.borderColor = COLORS.red;
    } else {
      btn.style.backgroundColor = "rgb(12, 30, 60)"; // True dark blue
      btn.style.borderColor = "rgba(255, 255, 255, 0.12)";
      
      btn.addEventListener("mouseenter", () => {
        btn.style.backgroundColor = "rgb(22, 50, 92)";
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.backgroundColor = "rgb(12, 30, 60)";
      });
    }

    // Status dot color inside buttons list
    const dotHex = status === "green" ? "#34d399" : status === "yellow" ? "#fbbf24" : "#9ca3af";

    btn.innerHTML = `
      <div class="flex flex-col gap-0.5">
        <span class="text-sm font-extrabold tracking-tight group-hover:translate-x-0.5 transition-transform duration-300">
          ${buoy.name}
        </span>
        <span class="text-[10px] opacity-75">
          ID: ${buoy.id} • Lat: ${buoy.lat.toFixed(2)}
        </span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[10px] opacity-90 font-mono text-right">${timeString}</span>
        <span class="w-2.5 h-2.5 rounded-full border border-slate-900 inline-block" style="background-color: ${dotHex}"></span>
      </div>
    `;

    btn.addEventListener("click", () => {
      selectBuoy(buoy.id);
    });

    container.appendChild(btn);
  });
}

// Selection coordinator
function selectBuoy(buoyId) {
  state.selectedBuoyId = buoyId;
  
  // Update view
  renderBuoyList();
  updateMapMarkers();

  // Center maps on selecting
  const found = state.buoys.find(b => b.id === buoyId);
  if (found && state.map) {
    state.map.setView([found.lat, found.lon], 9, { animate: true });
    // Open marker popup slowly
    const mark = state.markers[buoyId];
    if (mark) {
      setTimeout(() => mark.openPopup(), 400);
    }
  }

  // Fetch detailed variables
  fetchBuoyData(buoyId);
}

// Fetch detailed data for selected buoy
function fetchBuoyData(buoyId, requestedLimit = 5000, forceRefresh = false) {
  const buoyObj = state.buoys.find(b => b.id === buoyId);
  if (!buoyObj) return;

  const buoyName = buoyObj.name;

  const cached = state.buoyDataCache[buoyId];
  if (!forceRefresh && cached && !cached._isDemo && cached._limit >= requestedLimit) {
    state.activeSensorTab = getAvailableSensors(cached)[0] || null;
    renderSensorsTabBar();
    renderPlottedGraphs();
    return;
  }

  state.loadingData = true;
  
  // Show spinner if no cached data exists
  const detailViewer = document.getElementById("analytics-charts-renderer");
  if (detailViewer && !cached) {
    detailViewer.innerHTML = `
      <div class="h-[280px] flex flex-col items-center justify-center text-center p-8">
        <div class="w-8 h-8 rounded-full border-2 border-[rgb(20,120,167)] border-t-transparent animate-spin mb-3"></div>
        <h4 class="text-sm font-bold text-slate-700">Connecting fast database nodes</h4>
        <p class="text-xs text-slate-400 mt-1 max-w-sm">Gathering specific instrument registers and wave parameters for ${buoyName}...</p>
      </div>
    `;
  }

  fetch(`https://api.icatmar.cat/MSM_fast_api/buoys/${buoyId}/data?limit=${requestedLimit}`)
    .then(res => {
      if (!res.ok) throw new Error("API responded status: " + res.status);
      return res.json();
    })
    .then(payload => {
      if (payload && payload.data && Object.keys(payload.data).length > 0) {
        payload._limit = requestedLimit;
        payload._isDemo = false;
        state.buoyDataCache[buoyId] = payload;
      } else {
        throw new Error("Empty registers payload from API");
      }
    })
    .catch(err => {
      console.warn(`Could not reach live API for detailed data of (${buoyName}), loading client-side wave engine simulators.`, err);
      // Construct rich high fidelity mock
      const mockObj = generateMockRecords(buoyId, buoyName);
      mockObj._limit = requestedLimit;
      mockObj._isDemo = true;
      state.buoyDataCache[buoyId] = mockObj;
    })
    .finally(() => {
      state.loadingData = false;
      const doneCached = state.buoyDataCache[buoyId];
      if (doneCached && (!state.activeSensorTab || !getAvailableSensors(doneCached).includes(state.activeSensorTab))) {
        state.activeSensorTab = getAvailableSensors(doneCached)[0] || null;
      }
      renderSensorsTabBar();
      renderPlottedGraphs();
    });
}

function getAvailableSensors(payload) {
  if (!payload || !payload.data) return [];
  const sensors = new Set();
  Object.values(payload.data).forEach(sList => {
    Object.keys(sList).forEach(sName => {
      if (sName !== "parsedJson") {
        sensors.add(sName);
      }
    });
  });
  return Array.from(sensors);
}

function refreshBuoyList() {
  fetch("https://api.icatmar.cat/MSM_fast_api/buoys")
    .then(res => {
      if (!res.ok) throw new Error("API base response status: " + res.status);
      return res.json();
    })
    .then(data => {
      if (!data || !Array.isArray(data.buoys) || data.buoys.length === 0) return;

      const newBuoys = data.buoys;
      const oldMap = Object.fromEntries(state.buoys.map(b => [b.id, b.latestTimestamp]));
      let changed = newBuoys.length !== state.buoys.length;

      newBuoys.forEach(b => {
        if (!oldMap[b.id] || oldMap[b.id] !== b.latestTimestamp) {
          changed = true;
        }
      });

      if (!changed) return;

      const oldSelectedTimestamp = oldMap[state.selectedBuoyId];
      const newSelected = newBuoys.find(b => b.id === state.selectedBuoyId);
      const selectedChanged = newSelected && newSelected.latestTimestamp !== oldSelectedTimestamp;

      state.buoys = newBuoys;
      if (!newSelected && newBuoys.length > 0) {
        state.selectedBuoyId = newBuoys[0].id;
      }

      renderBuoyList();
      updateMapMarkers();

      if (!newSelected && state.selectedBuoyId) {
        selectBuoy(state.selectedBuoyId);
      } else if (selectedChanged && state.selectedBuoyId) {
        fetchBuoyData(state.selectedBuoyId, 5000, true);
      }
    })
    .catch(err => {
      console.warn("Buoy refresh failed", err);
    });
}

// Render interactive sensor toggle buttons
function renderSensorsTabBar() {
  const container = document.getElementById("sensors-tabs-list");
  if (!container) return;

  container.innerHTML = "";

  const cached = state.buoyDataCache[state.selectedBuoyId];
  if (!cached) return;

  const sensorNames = getAvailableSensors(cached);
  if (sensorNames.length === 0) {
    container.innerHTML = `<span class="text-xs text-gray-400">No telemetry sensors mounted on this deck</span>`;
    return;
  }

  // Set default tabs if null
  if (!state.activeSensorTab || !sensorNames.includes(state.activeSensorTab)) {
    state.activeSensorTab = sensorNames[0];
  }

  sensorNames.forEach(sensor => {
    const isActive = sensor === state.activeSensorTab;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `px-4 py-2 rounded-xl text-xs font-bold border transition-all duration-300 outline-none active:scale-[0.97] flex items-center gap-1.5 ${
      isActive
        ? "bg-[rgb(20,120,167)] border-[rgb(20,120,167)] text-white shadow"
        : "bg-slate-50 border-slate-200/60 text-slate-600 hover:bg-slate-100 hover:text-slate-800"
    }`;

    // Insert icons dynamically
    let emoji = "🧭";
    if (sensor === "Olas") emoji = "🌊";
    if (sensor === "Gill" || sensor.includes("WND")) emoji = "💨";
    if (sensor === "ADCP" || sensor.includes("TMP")) emoji = "🌡️";

    btn.innerHTML = `<span>${emoji}</span><span>${sensor}</span>`;
    btn.addEventListener("click", () => {
      state.activeSensorTab = sensor;
      renderSensorsTabBar();
      renderPlottedGraphs();
    });

    container.appendChild(btn);
  });
}

// Render actual plots
function renderPlottedGraphs() {
  const container = document.getElementById("analytics-charts-renderer");
  if (!container) return;

  container.innerHTML = "";

  const cached = state.buoyDataCache[state.selectedBuoyId];
  if (!cached || !state.activeSensorTab) {
    container.innerHTML = `
      <div class="h-[200px] flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-2xl border-2 border-dashed border-[rgb(82,181,217)]/40">
        <span class="text-xs text-gray-400 animate-pulse">Select an active marine sensor track to observe metrics</span>
      </div>
    `;
    return;
  }

  // Gather parameters found with actual non-null registers
  const activeSensor = state.activeSensorTab;
  const rawData = cached.data || {};
  
  // Collect logs points chronologically
  const rawList = [];
  Object.entries(rawData).forEach(([timestampStr, sensorMap]) => {
    // Robust date parsing replacing any space with "T" (Safari bugfix)
    const cleanStr = timestampStr.trim().replace(" ", "T");
    const epoch = new Date(cleanStr).getTime();
    if (isNaN(epoch)) return;

    const sensorObj = sensorMap[activeSensor];
    if (sensorObj) {
      const pointValues = {};
      Object.entries(sensorObj).forEach(([k, v]) => {
        pointValues[k] = parseValue(k, v, activeSensor);
      });
      rawList.push({
        time: epoch,
        values: pointValues
      });
    }
  });

  // Sort chronological
  rawList.sort((a, b) => a.time - b.time);

  // Group registers dynamically
  const paramKeys = Array.from(new Set(rawList.flatMap(pt => Object.keys(pt.values))));
  const groupings = {};

  paramKeys.forEach(pKey => {
    const gp = getParamGrouping(pKey, activeSensor);
    if (!groupings[gp.id]) {
      groupings[gp.id] = {
        name: gp.name,
        unit: gp.unit,
        keys: []
      };
    }
    if (!groupings[gp.id].keys.includes(pKey)) {
      groupings[gp.id].keys.push(pKey);
    }
  });

  const activeGroupings = Object.entries(groupings).filter(([id, data]) => {
    // Filter out raw wind and wave 0-360 degree direction graphs to prevent clutter
    if (id === "wind_dir" || id === "wave_dir") {
      return false;
    }
    // Make sure we have at least 1 point with valid scalar data
    return rawList.some(pt => data.keys.some(k => pt.values[k] !== null && pt.values[k] !== undefined));
  });

  if (activeGroupings.length === 0) {
    container.innerHTML = `
      <div class="h-[200px] flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
        <span class="text-xs text-gray-400">No measurable metrics returned under this sensor inside this sliding database window</span>
      </div>
    `;
    return;
  }

  // Create grid cells
  const grid = document.createElement("div");
  grid.className = "grid grid-cols-1 md:grid-cols-2 gap-6";
  container.appendChild(grid);

  const { start, end } = getTimeBoundaries();

  activeGroupings.forEach(([groupId, info]) => {
    // Cell wrapper
    const card = document.createElement("div");
    // Light blue frames as required: "frames of graphs in light blue" e.g., border-2 border-[rgb(82,181,217)]
    card.className = "w-full h-[320px] rounded-2xl bg-white p-3 border-2 border-[rgb(82,181,217)] shadow-sm hover:shadow-md transition-all duration-300";
    card.id = `highchart-group-card-${groupId}`;
    grid.appendChild(card);

    // Highcharts dynamic series builder
    const seriesList = info.keys.map((key, index) => {
      const conf = getParamConfig(key, activeSensor);
      const nameLabel = conf ? conf.label : key;

      const seriesColors = [
        'rgb(20, 120, 167)',  // --blue
        'rgb(255, 115, 105)', // --red
        'rgb(15, 48, 98)',   // --darkBlue
        'rgb(82, 181, 217)',  // --lightBlue
        '#f59e0b',
        '#10b981'
      ];

      // Format to Highcharts point standard: [[epoch, numeric], ...]
      const points = rawList
        .map(pt => {
          const val = pt.values[key];
          return (val !== null && val !== undefined) ? [pt.time, val] : null;
        })
        .filter(p => p !== null);

      const isDirectionalTrack = key === "WSPD" || key === "VGHS";

      return {
        name: nameLabel,
        data: points,
        color: seriesColors[index % seriesColors.length],
        lineWidth: 2.2,
        marker: {
          enabled: points.length < 150,
          radius: 3
        },
        tooltip: {
          valueSuffix: ` ${info.unit}`
        },
        dataLabels: {
          enabled: isDirectionalTrack,
          useHTML: true,
          allowOverlap: true,
          crop: false,
          overflow: 'allow',
          zIndex: 1,
          formatter: function() {
            const ptTime = this.x;
            const ptObj = rawList.find(pt => pt.time === ptTime);
            if (!ptObj) return null;

            let deg = null;
            if (key === "WSPD") {
              deg = ptObj.values["WDIR"];
            } else if (key === "VGHS") {
              deg = (ptObj.values["VPED"] !== null && ptObj.values["VPED"] !== undefined)
                ? ptObj.values["VPED"]
                : ptObj.values["VMDR"];
            }
            if (deg === null || deg === undefined || isNaN(deg)) return null;

            const chart = this.series.chart;
            const extremes = chart.xAxis[0].getExtremes();
            const visiblePoints = this.series.points.filter(pt => pt.x >= extremes.min && pt.x <= extremes.max);
            const step = Math.max(1, Math.ceil(visiblePoints.length / 12));
            const visibleIndex = visiblePoints.findIndex(pt => pt.x === this.x);
            if (visibleIndex < 0 || visibleIndex % step !== 0) return null;

            return `<span style="display:inline-block; transform: rotate(${deg}deg); font-size: 11px; color: rgb(20,120,167); line-height: 1; text-shadow: 0 0 1px rgba(0,0,0,0.2);">↑</span>`;
          },
          style: {
            textOutline: 'none'
          }
        }
      };
    });

    // Invoke Highcharts constructor
    window.Highcharts.chart(card, {
      chart: {
        type: 'spline',
        zoomType: 'x',
        pinchType: 'x',
        events: {
          render: function() {
            const chart = this;
            const fixedY = chart.plotTop * 0;
            chart.series.forEach(series => {
              if (!series.options || !series.options.dataLabels || !series.options.dataLabels.enabled) return;
              if (!series.points) return;
              series.points.forEach(point => {
                if (point.dataLabel) {
                  point.dataLabel.attr({ y: fixedY });
                }
              });
            });
          }
        },
        resetZoomButton: {
          theme: {
            fill: 'rgba(20,120,167,0.08)',
            stroke: 'rgb(20,120,167)',
            r: 8,
            style: {
              color: '#0f3062',
              fontSize: '11px'
            }
          }
        },
        backgroundColor: '#ffffff',
        style: {
          fontFamily: 'Inter, system-ui, sans-serif'
        }
      },
      title: {
        text: info.name,
        align: 'left',
        style: {
          fontSize: '13px',
          fontWeight: '800',
          color: 'rgb(15, 48, 98)'
        }
      },
      subtitle: {
        text: (groupId === 'wind_speed' || groupId === 'wave_height') 
          ? `Sensor: ${activeSensor} • Unit: ${info.unit || "N/A"} • ↑ Arrows show direction degrees`
          : `Sensor: ${activeSensor} • Unit: ${info.unit || "N/A"}`,
        align: 'left',
        style: {
          fontSize: '10px',
          color: '#64748b'
        }
      },
      xAxis: {
        type: 'datetime',
        min: start.getTime(),
        max: end.getTime(),
        gridLineWidth: 1,
        gridLineColor: '#f1f5f9',
        labels: {
          style: {
            fontSize: '9px',
            color: '#64748b'
          }
        }
      },
      yAxis: {
        gridLineColor: '#f1f5f9',
        title: {
          text: info.unit || null,
          style: {
            fontSize: '10px',
            color: 'rgb(20, 120, 167)'
          }
        },
        labels: {
          style: {
            fontSize: '9px',
            color: '#64748b'
          }
        }
      },
      tooltip: {
        shared: true,
        crosshairs: true,
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderColor: 'rgb(82, 181, 217)',
        borderRadius: 8,
        borderWidth: 1.5,
        shadow: true,
        useHTML: true,
        style: {
          zIndex: '999999'
        },
        formatter: function() {
          const ptTime = this.x;
          const ptObj = rawList.find(pt => pt.time === ptTime);
          
          let html = `<div style="padding: 6px; font-family: 'Inter', sans-serif; font-size: 11px;">`;
          html += `<b style="color: rgb(15, 48, 98); display: block; margin-bottom: 4px; border-bottom: 1px solid #f1f5f9; padding-bottom: 2px;">${new Date(ptTime).toLocaleString("en-US", { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</b>`;
          
          this.points.forEach(p => {
            const keyName = p.series.name;
            const valSuffix = p.series.tooltipOptions.valueSuffix || "";
            let dirInfo = "";

            if (ptObj) {
              let degrees = null;
              if (keyName.includes("Wind Spd") || keyName.includes("Air Speed") || p.series.options.name.includes("WSPD")) {
                degrees = ptObj.values["WDIR"];
              } else if (keyName.includes("Gust Spd") || p.series.options.name.includes("GSPD")) {
                degrees = ptObj.values["GDIR"];
              } else if (keyName.includes("Wave Hgt") || p.series.options.name.includes("VGHS")) {
                degrees = ptObj.values["VPED"] !== null ? ptObj.values["VPED"] : ptObj.values["VMDR"];
              }

              if (degrees !== null && degrees !== undefined && !isNaN(degrees)) {
                const dirName = getCompassDirection(degrees);
                dirInfo = ` <span style="color: rgb(255, 115, 105); font-weight: 700; margin-left: 6px; display: inline-flex; align-items: inline-flex; justify-content: middle; gap: 2px;">` +
                          `<span style="display: inline-block; transform: rotate(${degrees}deg); font-size: 12px; line-height: 1; font-weight: 900;">↑</span>` +
                          `(${Math.round(degrees)}° ${dirName})` +
                          `</span>`;
              }
            }

            html += `<div style="margin: 3px 0; display: flex; align-items: center; justify-content: space-between; gap: 10px;">` +
                    `<span style="color: ${p.series.color}; font-weight: 600;">● ${keyName}:</span>` +
                    `<span><b style="color: rgb(15, 48, 98);">${p.y.toFixed(2)}${valSuffix}</b>${dirInfo}</span>` +
                    `</div>`;
          });

          html += `</div>`;
          return html;
        }
      },
      legend: {
        enabled: true,
        itemStyle: {
          fontSize: '10px',
          color: '#334155'
        }
      },
      credits: {
        enabled: false
      },
      accessibility: {
        enabled: false
      },
      series: seriesList
    });
  });
}

// Slidings controller
function setupSlidingControls() {
  const btnShiftLeft = document.getElementById("shift-left-btn");
  const btnShiftRight = document.getElementById("shift-right-btn");
  const btnResetNow = document.getElementById("reset-now-btn");

  if (btnShiftLeft) {
    btnShiftLeft.addEventListener("click", () => {
      state.timeOffsetDays -= 3;
      updateSlidingLabelsAndButtons();
      // Load more data with dynamic high-capacity limit (5000 records) to back up our timeline
      fetchBuoyData(state.selectedBuoyId, 5000);
    });
  }

  if (btnShiftRight) {
    btnShiftRight.addEventListener("click", () => {
      // Shift forward
      state.timeOffsetDays += 3;
      if (state.timeOffsetDays > 0) {
        state.timeOffsetDays = 0; // Absolute celling is present time "now"
      }
      updateSlidingLabelsAndButtons();
      renderPlottedGraphs();
    });
  }

  if (btnResetNow) {
    btnResetNow.addEventListener("click", () => {
      state.timeOffsetDays = 0;
      updateSlidingLabelsAndButtons();
      renderPlottedGraphs();
    });
  }

  updateSlidingLabelsAndButtons();
}

// Dynamic visible controller for right buttons
function updateSlidingLabelsAndButtons() {
  const { start, end } = getTimeBoundaries();

  // Draw readable sliding dates on timeline bar
  const formatLabel = (d) => {
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const labelSpan = document.getElementById("analysis-window-dates-label");
  if (labelSpan) {
    labelSpan.innerHTML = `
      <span class="text-[rgb(20,120,167)]">${formatLabel(start)}</span>
      <span class="text-slate-300">to</span>
      <span class="text-[rgb(255,115,105)] font-extrabold">${formatLabel(end)}</span>
    `;
  }

  const containerRight = document.getElementById("sliding-controls-right-side");
  if (!containerRight) return;

  // Now condition: Now is defined as state.timeOffsetDays === 0.
  // "The now and +3 days ahead should only appear when the "now" is not visible in the data graphs"
  const isNowInGraph = state.timeOffsetDays >= 0;

  if (isNowInGraph) {
    // Hide buttons cleanly
    containerRight.classList.add("hidden");
    containerRight.classList.remove("flex");
  } else {
    // Show buttons cleanly
    containerRight.classList.remove("hidden");
    containerRight.classList.add("flex");
  }
}

// Core boot up
document.addEventListener("DOMContentLoaded", () => {
  state.loadingBuoys = true;

  const buoysSwitchSection = document.getElementById("buoys-switcher-section");

  fetch("https://api.icatmar.cat/MSM_fast_api/buoys")
    .then(res => {
      if (!res.ok) throw new Error("API base response status: " + res.status);
      return res.json();
    })
    .then(data => {
      if (data && Array.isArray(data.buoys) && data.buoys.length > 0) {
        state.buoys = data.buoys;
      } else {
        throw new Error("Empty array of buoys");
      }
    })
    .catch(err => {
      console.warn("Unable to connect live ICATMAR server, loading robust client simulator.", err);
      state.buoys = FALLBACK_BUOYS;
      state.isDemoMode = true;
      
      const demoBadge = document.getElementById("demo-mode-indicator-badge");
      if (demoBadge) {
        demoBadge.classList.remove("hidden");
      }
    })
    .finally(() => {
      state.loadingBuoys = false;
      
      // Select first buoy standard
      if (state.buoys.length > 0) {
        state.selectedBuoyId = state.buoys[0].id;
      }

      // Build layouts
      setupMap();
      renderBuoyList();
      updateMapMarkers();
      setupSlidingControls();

      // Trigger initial detailed variables
      if (state.selectedBuoyId) {
        selectBuoy(state.selectedBuoyId);
      }
    });

  // Poll the buoy list once per minute and only redraw if latest timestamps changed
  setInterval(refreshBuoyList, 60_000);

  // Start internal ticker for standard user readability
  const systemTicker = document.getElementById("utc-clock-value");
  if (systemTicker) {
    setInterval(() => {
      systemTicker.innerText = new Date().toLocaleTimeString();
    }, 1000);
  }
});
