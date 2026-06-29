const CITIES = [
  { name: '서울', lat: 37.5665, lon: 126.9780 },
  { name: '부산', lat: 35.1796, lon: 129.0756 },
  { name: '인천', lat: 37.4563, lon: 126.7052 },
  { name: '대구', lat: 35.8714, lon: 128.6014 },
  { name: '대전', lat: 36.3504, lon: 127.3845 },
  { name: '광주', lat: 35.1595, lon: 126.8526 },
  { name: '울산', lat: 35.5384, lon: 129.3114 },
  { name: '세종', lat: 36.4800, lon: 127.2890 },
  { name: '제주', lat: 33.4996, lon: 126.5312 },
  { name: '수원', lat: 37.2636, lon: 127.0286 },
];

const WMO_CODES = {
  0: { desc: '맑음', icon: '☀️' },
  1: { desc: '대체로 맑음', icon: '🌤️' },
  2: { desc: '부분적으로 흐림', icon: '⛅' },
  3: { desc: '흐림', icon: '☁️' },
  45: { desc: '안개', icon: '🌫️' },
  48: { desc: '서리 안개', icon: '🌫️' },
  51: { desc: '이슬비 (약함)', icon: '🌦️' },
  53: { desc: '이슬비 (보통)', icon: '🌦️' },
  55: { desc: '이슬비 (강함)', icon: '🌧️' },
  56: { desc: '어는 이슬비 (약함)', icon: '🌧️' },
  57: { desc: '어는 이슬비 (강함)', icon: '🌧️' },
  61: { desc: '비 (약함)', icon: '🌧️' },
  63: { desc: '비 (보통)', icon: '🌧️' },
  65: { desc: '비 (강함)', icon: '🌧️' },
  66: { desc: '어는 비 (약함)', icon: '🌨️' },
  67: { desc: '어는 비 (강함)', icon: '🌨️' },
  71: { desc: '눈 (약함)', icon: '🌨️' },
  73: { desc: '눈 (보통)', icon: '❄️' },
  75: { desc: '눈 (강함)', icon: '❄️' },
  77: { desc: '진눈깨비', icon: '🌨️' },
  80: { desc: '소나기 (약함)', icon: '🌦️' },
  81: { desc: '소나기 (보통)', icon: '🌧️' },
  82: { desc: '소나기 (강함)', icon: '⛈️' },
  85: { desc: '눈 소나기 (약함)', icon: '🌨️' },
  86: { desc: '눈 소나기 (강함)', icon: '❄️' },
  95: { desc: '뇌우', icon: '⛈️' },
  96: { desc: '우박 동반 뇌우 (약함)', icon: '⛈️' },
  99: { desc: '우박 동반 뇌우 (강함)', icon: '⛈️' },
};

let map;
let markers = [];
let weatherData = [];

function getWeatherInfo(code) {
  return WMO_CODES[code] || { desc: '알 수 없음', icon: '🌡️' };
}

function getTempClass(temp) {
  if (temp < 0) return 'cold';
  if (temp < 10) return 'cool';
  if (temp < 20) return 'mild';
  if (temp < 28) return 'warm';
  return 'hot';
}

function windDirection(deg) {
  const dirs = ['북', '북동', '동', '남동', '남', '남서', '서', '북서'];
  return dirs[Math.round(deg / 45) % 8];
}

function formatTime(iso) {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function buildApiUrl() {
  const lats = CITIES.map(c => c.lat).join(',');
  const lons = CITIES.map(c => c.lon).join(',');
  const params = new URLSearchParams({
    latitude: lats,
    longitude: lons,
    current: [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'precipitation',
      'weather_code',
      'wind_speed_10m',
      'wind_direction_10m',
    ].join(','),
    timezone: 'Asia/Seoul',
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

async function fetchWeather() {
  const res = await fetch(buildApiUrl());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function normalizeResponse(data) {
  if (Array.isArray(data)) {
    return data.map((d, i) => ({ city: CITIES[i], current: d.current }));
  }
  if (data.current) {
    return [{ city: CITIES[0], current: data.current }];
  }
  return CITIES.map((city, i) => ({
    city,
    current: {
      time: data.current.time,
      temperature_2m: data.current.temperature_2m[i],
      relative_humidity_2m: data.current.relative_humidity_2m[i],
      apparent_temperature: data.current.apparent_temperature[i],
      precipitation: data.current.precipitation[i],
      weather_code: data.current.weather_code[i],
      wind_speed_10m: data.current.wind_speed_10m[i],
      wind_direction_10m: data.current.wind_direction_10m[i],
    },
  }));
}

function createMarkerIcon(temp) {
  const cls = getTempClass(temp);
  const rounded = Math.round(temp);
  return L.divIcon({
    className: 'weather-marker',
    html: `
      <div class="marker-pin">
        <div class="marker-bubble ${cls}">${rounded}°</div>
        <div class="marker-dot ${cls}"></div>
      </div>
    `,
    iconSize: [60, 40],
    iconAnchor: [30, 40],
    popupAnchor: [0, -40],
  });
}

function buildPopupHtml(entry) {
  const { city, current } = entry;
  const info = getWeatherInfo(current.weather_code);
  return `
    <div class="popup-title">${info.icon} ${city.name}</div>
    <div class="popup-temp">${Math.round(current.temperature_2m)}°C</div>
    <div class="popup-desc">${info.desc}</div>
    <div class="popup-grid">
      <span>체감</span><span>${Math.round(current.apparent_temperature)}°C</span>
      <span>습도</span><span>${current.relative_humidity_2m}%</span>
      <span>풍속</span><span>${current.wind_speed_10m} km/h (${windDirection(current.wind_direction_10m)})</span>
      <span>강수</span><span>${current.precipitation} mm</span>
    </div>
  `;
}

function initMap() {
  map = L.map('map', {
    center: [36.3, 127.8],
    zoom: 7,
    zoomControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
  }).addTo(map);
}

function clearMarkers() {
  markers.forEach(m => map.removeLayer(m));
  markers = [];
}

function renderMap(data) {
  clearMarkers();

  data.forEach((entry, index) => {
    const { city, current } = entry;
    const marker = L.marker([city.lat, city.lon], {
      icon: createMarkerIcon(current.temperature_2m),
    })
      .addTo(map)
      .bindPopup(buildPopupHtml(entry));

    marker.on('click', () => selectCity(index));
    markers.push(marker);
  });
}

function renderCityList(data) {
  const list = document.getElementById('cityList');
  list.innerHTML = data.map((entry, index) => {
    const { city, current } = entry;
    const info = getWeatherInfo(current.weather_code);
    const temp = Math.round(current.temperature_2m);
    return `
      <li class="city-item" data-index="${index}">
        <span class="city-icon">${info.icon}</span>
        <div class="city-info">
          <div class="city-name">${city.name}</div>
          <div class="city-desc">${info.desc}</div>
          <div class="city-details">
            <span>💧 ${current.relative_humidity_2m}%</span>
            <span>💨 ${current.wind_speed_10m} km/h</span>
            <span>🌡 ${Math.round(current.apparent_temperature)}° 체감</span>
          </div>
        </div>
        <div class="city-temp">${temp}<span class="unit">°C</span></div>
      </li>
    `;
  }).join('');

  list.querySelectorAll('.city-item').forEach(item => {
    item.addEventListener('click', () => {
      const index = Number(item.dataset.index);
      selectCity(index);
    });
  });
}

function selectCity(index) {
  document.querySelectorAll('.city-item').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });

  const entry = weatherData[index];
  if (!entry) return;

  map.flyTo([entry.city.lat, entry.city.lon], 9, { duration: 0.8 });
  markers[index]?.openPopup();
}

function setLoading(loading) {
  document.getElementById('loadingState').classList.toggle('hidden', !loading);
  document.getElementById('cityList').classList.toggle('hidden', loading);
  document.getElementById('errorState').classList.add('hidden');
}

function showError() {
  document.getElementById('loadingState').classList.add('hidden');
  document.getElementById('cityList').classList.add('hidden');
  document.getElementById('errorState').classList.remove('hidden');
}

async function loadWeather() {
  setLoading(true);
  try {
    const raw = await fetchWeather();
    weatherData = normalizeResponse(raw);
    renderMap(weatherData);
    renderCityList(weatherData);
    setLoading(false);

    const time = weatherData[0]?.current?.time;
    document.getElementById('lastUpdated').textContent = time
      ? formatTime(time)
      : new Date().toLocaleString('ko-KR');
  } catch {
    showError();
  }
}

document.getElementById('refreshBtn').addEventListener('click', async () => {
  const btn = document.getElementById('refreshBtn');
  btn.classList.add('spinning');
  await loadWeather();
  setTimeout(() => btn.classList.remove('spinning'), 700);
});

document.getElementById('retryBtn').addEventListener('click', loadWeather);

initMap();
loadWeather();
