const STORAGE_KEYS = {
  students: "ruta_escolar_students",
  config: "ruta_escolar_config",
  logs: "ruta_escolar_logs",
  theme: "ruta_escolar_theme"
};

const DEFAULT_CONFIG = {
  channelMode: "business",
  backendUrl: "",
  apiKey: "",
  tone: "cercano"
};

let map;
let busMarker;
let watchId = null;
let state = {
  students: [],
  neighborhoods: [],
  config: { ...DEFAULT_CONFIG },
  logs: [],
  currentPosition: null,
  currentNeighborhood: "",
  currentStudentId: null,
  messageQueue: [],
  markers: []
};

const els = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindElements();
  bindEvents();
  loadTheme();
  await loadData();
  initMap();
  restoreConfig();
  renderAll();
  updatePreview("alistamiento");
}

function bindElements() {
  [
    "routeSelect","gpsStatus","backendStatus","currentNeighborhood","pickupOrderList","studentsList","logList",
    "messagePreview","channelMode","backendUrl","apiKey","toneSelect","studentForm","studentId","studentName",
    "guardianName","phoneNumber","studentNeighborhood","studentRoute","studentOrder","studentLat","studentLng",
    "totalActivos","totalPendientes","totalCompletados","colaMensajes","aiNotes"
  ].forEach(id => els[id] = document.getElementById(id));

  els.startRouteBtn = document.getElementById("startRouteBtn");
  els.stopRouteBtn = document.getElementById("stopRouteBtn");
  els.sendReadyBtn = document.getElementById("sendReadyBtn");
  els.sendSchoolArrivalBtn = document.getElementById("sendSchoolArrivalBtn");
  els.sendNeighborhoodBtn = document.getElementById("sendNeighborhoodBtn");
  els.sendCurrentStudentBtn = document.getElementById("sendCurrentStudentBtn");
  els.refreshOrderBtn = document.getElementById("refreshOrderBtn");
  els.reloadDataBtn = document.getElementById("reloadDataBtn");
  els.saveConfigBtn = document.getElementById("saveConfigBtn");
  els.testBackendBtn = document.getElementById("testBackendBtn");
  els.clearLogBtn = document.getElementById("clearLogBtn");
  els.improveReadyBtn = document.getElementById("improveReadyBtn");
  els.improveArrivalBtn = document.getElementById("improveArrivalBtn");
  els.improveCurrentBtn = document.getElementById("improveCurrentBtn");
  els.toggleThemeBtn = document.getElementById("toggleThemeBtn");
}

function bindEvents() {
  els.startRouteBtn.addEventListener("click", startGPS);
  els.stopRouteBtn.addEventListener("click", stopGPS);
  els.sendReadyBtn.addEventListener("click", sendReadyMessage);
  els.sendSchoolArrivalBtn.addEventListener("click", sendArrivalMessage);
  els.sendNeighborhoodBtn.addEventListener("click", sendNeighborhoodMessage);
  els.sendCurrentStudentBtn.addEventListener("click", sendCurrentStudentMessage);
  els.refreshOrderBtn.addEventListener("click", renderOrder);
  els.reloadDataBtn.addEventListener("click", reloadBaseData);
  els.saveConfigBtn.addEventListener("click", saveConfig);
  els.testBackendBtn.addEventListener("click", testBackend);
  els.clearLogBtn.addEventListener("click", clearLogs);
  els.studentForm.addEventListener("submit", saveStudent);
  els.routeSelect.addEventListener("change", () => {
    renderOrder();
    updatePreview("alistamiento");
  });
  els.toneSelect.addEventListener("change", () => updatePreview("alistamiento"));
  els.channelMode.addEventListener("change", saveConfig);
  els.backendUrl.addEventListener("change", saveConfig);
  els.apiKey.addEventListener("change", saveConfig);
  els.improveReadyBtn.addEventListener("click", () => updatePreview("alistamiento"));
  els.improveArrivalBtn.addEventListener("click", () => updatePreview("llegadaColegio"));
  els.improveCurrentBtn.addEventListener("click", () => updatePreview("estudianteActual"));
  els.toggleThemeBtn.addEventListener("click", toggleTheme);
}

async function loadData() {
  const [students, neighborhoods] = await Promise.all([
    loadStudents(),
    fetchJSON("data/barrios.json")
  ]);
  state.students = students;
  state.neighborhoods = neighborhoods;
  state.logs = JSON.parse(localStorage.getItem(STORAGE_KEYS.logs) || "[]");
  fillNeighborhoodSelect();
}

async function loadStudents() {
  const saved = localStorage.getItem(STORAGE_KEYS.students);
  if (saved) return JSON.parse(saved);
  const base = await fetchJSON("data/estudiantes.json");
  localStorage.setItem(STORAGE_KEYS.students, JSON.stringify(base));
  return base;
}

async function reloadBaseData() {
  const base = await fetchJSON("data/estudiantes.json");
  state.students = base;
  persistStudents();
  logEvent("Datos base recargados.");
  renderAll();
}

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`No se pudo cargar ${path}`);
  return res.json();
}

function restoreConfig() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.config) || "null") || DEFAULT_CONFIG;
  state.config = { ...DEFAULT_CONFIG, ...saved };
  els.channelMode.value = state.config.channelMode;
  els.backendUrl.value = state.config.backendUrl;
  els.apiKey.value = state.config.apiKey;
  els.toneSelect.value = state.config.tone;
}

function saveConfig() {
  state.config = {
    channelMode: els.channelMode.value,
    backendUrl: els.backendUrl.value.trim(),
    apiKey: els.apiKey.value.trim(),
    tone: els.toneSelect.value
  };
  localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(state.config));
  logEvent("Configuración guardada.");
}

function initMap() {
  map = L.map("map").setView([4.566, -75.751], 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap"
  }).addTo(map);

  busMarker = L.marker([4.566, -75.751]).addTo(map).bindPopup("Bus escolar");
  renderStudentMarkers();
}

function renderStudentMarkers() {
  state.markers.forEach(m => map.removeLayer(m));
  state.markers = state.students
    .filter(s => isFiniteNumber(s.lat) && isFiniteNumber(s.lng))
    .map(student => L.circleMarker([student.lat, student.lng], {
      radius: student.id === state.currentStudentId ? 9 : 6,
      weight: 2,
      color: student.id === state.currentStudentId ? "#22c55e" : "#38bdf8"
    }).addTo(map).bindPopup(`${student.nombre}<br>${student.barrio}`));
}

function startGPS() {
  if (!navigator.geolocation) {
    alert("Este celular no soporta GPS.");
    return;
  }
  if (watchId) return;
  watchId = navigator.geolocation.watchPosition(onPositionUpdate, onPositionError, {
    enableHighAccuracy: true,
    maximumAge: 2000,
    timeout: 10000
  });
  els.gpsStatus.textContent = "GPS activo";
  els.gpsStatus.classList.add("ok");
  logEvent("GPS iniciado.");
}

function stopGPS() {
  if (watchId) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  els.gpsStatus.textContent = "GPS inactivo";
  els.gpsStatus.classList.remove("ok");
  logEvent("GPS detenido.");
}

function onPositionError(err) {
  logEvent(`Error GPS: ${err.message}`);
}

function onPositionUpdate(position) {
  const lat = position.coords.latitude;
  const lng = position.coords.longitude;
  state.currentPosition = { lat, lng };
  busMarker.setLatLng([lat, lng]);
  map.setView([lat, lng], Math.max(map.getZoom(), 14));
  detectCurrentStudentAndNeighborhood();
}

function detectCurrentStudentAndNeighborhood() {
  if (!state.currentPosition) return;
  const routeStudents = getStudentsByRoute(currentRoute());
  let nearest = null;
  let bestDistance = Infinity;

  routeStudents.forEach(student => {
    if (!isFiniteNumber(student.lat) || !isFiniteNumber(student.lng)) return;
    const distance = calcMeters(state.currentPosition.lat, state.currentPosition.lng, student.lat, student.lng);
    if (distance < bestDistance) {
      bestDistance = distance;
      nearest = student;
    }
  });

  if (nearest) {
    state.currentStudentId = nearest.id;
    state.currentNeighborhood = nearest.barrio;
    els.currentNeighborhood.textContent = nearest.barrio;
    renderStudentMarkers();
    renderOrder();
    updatePreview("estudianteActual");
  }
}

function currentRoute() {
  return els.routeSelect.value;
}

function getStudentsByRoute(route) {
  return state.students
    .filter(s => s.ruta === route)
    .slice()
    .sort((a, b) => (a.orden || 999) - (b.orden || 999));
}

function renderAll() {
  renderOrder();
  renderStudents();
  renderStats();
  renderLogs();
  renderStudentMarkers();
}

function renderOrder() {
  const list = getStudentsByRoute(currentRoute());
  els.pickupOrderList.innerHTML = list.map(student => `
    <article class="student-card ${student.id === state.currentStudentId ? "active" : ""}">
      <div class="student-row">
        <div>
          <strong>${student.orden}. ${student.nombre}</strong>
          <div class="student-meta">${student.acudiente} · ${student.barrio}</div>
        </div>
        <span class="status-pill">${student.ruta}</span>
      </div>
    </article>
  `).join("");
}

function renderStudents() {
  els.studentsList.innerHTML = state.students
    .slice()
    .sort((a, b) => a.ruta.localeCompare(b.ruta) || (a.orden || 999) - (b.orden || 999))
    .map(student => `
      <article class="student-card ${student.id === state.currentStudentId ? "active" : ""}">
        <div class="student-row">
          <div>
            <strong>${student.nombre}</strong>
            <div class="student-meta">${student.ruta} · Orden ${student.orden} · ${student.barrio}</div>
            <div class="student-meta">${student.acudiente} · ${student.telefono}</div>
          </div>
        </div>
        <div class="student-actions">
          <button class="mini-btn" onclick="editStudent(${student.id})">Editar</button>
          <button class="mini-btn" onclick="setCurrentStudent(${student.id})">Actual</button>
          <button class="mini-btn danger" onclick="removeStudent(${student.id})">Borrar</button>
        </div>
      </article>
    `).join("");
}

function renderStats() {
  const routeStudents = getStudentsByRoute(currentRoute());
  const currentIndex = routeStudents.findIndex(s => s.id === state.currentStudentId);
  const completed = currentIndex >= 0 ? currentIndex : 0;
  const pending = Math.max(routeStudents.length - completed - (currentIndex >= 0 ? 1 : 0), 0);
  els.totalActivos.textContent = String(routeStudents.length);
  els.totalPendientes.textContent = String(pending);
  els.totalCompletados.textContent = String(completed);
  els.colaMensajes.textContent = String(state.messageQueue.length);
}

function renderLogs() {
  els.logList.innerHTML = state.logs.length
    ? state.logs.map(item => `
        <article class="log-item">
          <time>${item.time}</time>
          <div>${item.text}</div>
        </article>
      `).join("")
    : `<article class="log-item"><div>No hay eventos todavía.</div></article>`;
}

function fillNeighborhoodSelect() {
  els.studentNeighborhood.innerHTML = state.neighborhoods
    .map(name => `<option value="${name}">${name}</option>`)
    .join("");
}

function saveStudent(event) {
  event.preventDefault();
  const id = Number(els.studentId.value) || Date.now();
  const student = {
    id,
    nombre: els.studentName.value.trim(),
    acudiente: els.guardianName.value.trim(),
    telefono: normalizePhone(els.phoneNumber.value),
    barrio: els.studentNeighborhood.value,
    ruta: els.studentRoute.value,
    orden: Number(els.studentOrder.value),
    lat: Number(els.studentLat.value) || null,
    lng: Number(els.studentLng.value) || null,
    minutosEstimados: 3
  };
  const idx = state.students.findIndex(s => s.id === id);
  if (idx >= 0) state.students[idx] = student; else state.students.push(student);
  persistStudents();
  event.target.reset();
  els.studentId.value = "";
  logEvent(`Estudiante guardado: ${student.nombre}.`);
  renderAll();
}

window.editStudent = function editStudent(id) {
  const s = state.students.find(item => item.id === id);
  if (!s) return;
  els.studentId.value = s.id;
  els.studentName.value = s.nombre;
  els.guardianName.value = s.acudiente;
  els.phoneNumber.value = s.telefono;
  els.studentNeighborhood.value = s.barrio;
  els.studentRoute.value = s.ruta;
  els.studentOrder.value = s.orden;
  els.studentLat.value = s.lat ?? "";
  els.studentLng.value = s.lng ?? "";
};

window.removeStudent = function removeStudent(id) {
  state.students = state.students.filter(s => s.id !== id);
  persistStudents();
  logEvent("Estudiante eliminado.");
  renderAll();
};

window.setCurrentStudent = function setCurrentStudent(id) {
  state.currentStudentId = id;
  renderAll();
  updatePreview("estudianteActual");
};

function persistStudents() {
  localStorage.setItem(STORAGE_KEYS.students, JSON.stringify(state.students));
}

function clearLogs() {
  state.logs = [];
  localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(state.logs));
  renderLogs();
}

function logEvent(text) {
  state.logs.unshift({ text, time: new Date().toLocaleString("es-CO") });
  state.logs = state.logs.slice(0, 100);
  localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(state.logs));
  renderLogs();
}

async function testBackend() {
  saveConfig();
  if (!state.config.backendUrl) {
    setBackendStatus("Falta URL", false);
    return;
  }
  try {
    const res = await fetch(`${state.config.backendUrl.replace(/\/$/, "")}/health`, {
      headers: { "x-api-key": state.config.apiKey }
    });
    const data = await res.json();
    setBackendStatus(data.ok ? "Conectado" : "Error", !!data.ok);
  } catch (error) {
    setBackendStatus("Sin conexión", false);
  }
}

function setBackendStatus(text, ok) {
  els.backendStatus.textContent = text;
  els.backendStatus.classList.toggle("ok", ok);
  els.backendStatus.classList.toggle("warn", !ok);
}

function updatePreview(tipo) {
  const route = currentRoute();
  const list = getStudentsByRoute(route);
  const tone = els.toneSelect.value;
  let text = "";
  if (tipo === "alistamiento") text = sugerirMensajeAlistamiento(route, list, tone);
  if (tipo === "llegadaColegio") text = sugerirMensajeLlegada(route, tone);
  if (tipo === "estudianteActual") {
    const student = state.students.find(s => s.id === state.currentStudentId) || list[0];
    text = student ? sugerirMensajeEstudiante(student, route, tone) : "Selecciona un estudiante.";
  }
  els.messagePreview.value = text;
  els.aiNotes.textContent = `IA lista para ${tipo}. Puedes editar el mensaje antes de enviarlo.`;
}

async function sendReadyMessage() {
  const list = getStudentsByRoute(currentRoute());
  if (!list.length) return alert("No hay estudiantes en esta ruta.");
  updatePreview("alistamiento");
  await sendBulk(list, els.messagePreview.value, `Aviso masivo de alistamiento enviado a ${list.length} contactos.`);
}

async function sendArrivalMessage() {
  const list = getStudentsByRoute(currentRoute());
  if (!list.length) return alert("No hay estudiantes en esta ruta.");
  updatePreview("llegadaColegio");
  await sendBulk(list, els.messagePreview.value, `Aviso de llegada al colegio enviado a ${list.length} contactos.`);
}

async function sendNeighborhoodMessage() {
  const route = currentRoute();
  const barrio = state.currentNeighborhood || state.students.find(s => s.ruta === route)?.barrio;
  if (!barrio) return alert("No hay barrio detectado todavía.");
  const list = getStudentsByRoute(route).filter(s => s.barrio === barrio);
  if (!list.length) return alert("No hay estudiantes de este barrio en la ruta actual.");
  els.messagePreview.value = sugerirMensajeBarrio(route, barrio, els.toneSelect.value);
  await sendBulk(list, els.messagePreview.value, `Aviso de ingreso al barrio ${barrio} enviado a ${list.length} contactos.`);
}

async function sendCurrentStudentMessage() {
  const route = currentRoute();
  const student = state.students.find(s => s.id === state.currentStudentId) || getStudentsByRoute(route)[0];
  if (!student) return alert("No hay estudiante seleccionado.");
  els.messagePreview.value = sugerirMensajeEstudiante(student, route, els.toneSelect.value);
  await sendSingle(student, els.messagePreview.value);
}

async function sendBulk(students, message, successText) {
  for (const student of students) {
    await sendSingle(student, message);
  }
  logEvent(successText);
}

async function sendSingle(student, message) {
  state.messageQueue.push({ id: Date.now(), student: student.nombre });
  renderStats();
  try {
    if (state.config.channelMode === "demo") {
      logEvent(`[DEMO] ${student.nombre}: ${message}`);
      return;
    }
    if (state.config.channelMode === "app") {
      openWhatsApp(student.telefono, message);
      logEvent(`WhatsApp abierto para ${student.nombre}.`);
      return;
    }
    await sendViaBusiness(student.telefono, message);
    logEvent(`Mensaje enviado a ${student.nombre}.`);
  } catch (error) {
    logEvent(`Error con ${student.nombre}: ${error.message}`);
  } finally {
    state.messageQueue.shift();
    renderStats();
  }
}

async function sendViaBusiness(telefono, mensaje) {
  saveConfig();
  if (!state.config.backendUrl || !state.config.apiKey) throw new Error("Configura backend y API key.");
  const url = `${state.config.backendUrl.replace(/\/$/, "")}/send`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": state.config.apiKey
    },
    body: JSON.stringify({ telefono, mensaje })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || "Fallo de backend");
  return data;
}

function openWhatsApp(phone, message) {
  const clean = normalizePhone(phone).replace(/^57/, "57");
  const encoded = encodeURIComponent(message);
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const appUrl = `whatsapp://send?phone=${clean}&text=${encoded}`;
  const webUrl = `https://wa.me/${clean}?text=${encoded}`;
  window.open(isMobile ? appUrl : webUrl, "_blank");
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.startsWith("57") ? digits : `57${digits}`;
}

function calcMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function toRad(v) { return v * Math.PI / 180; }
function isFiniteNumber(v) { return typeof v === "number" && Number.isFinite(v); }

function toggleTheme() {
  document.body.classList.toggle("light");
  const isLight = document.body.classList.contains("light");
  localStorage.setItem(STORAGE_KEYS.theme, isLight ? "light" : "dark");
  els.toggleThemeBtn.textContent = isLight ? "☀️" : "🌙";
}

function loadTheme() {
  const theme = localStorage.getItem(STORAGE_KEYS.theme) || "dark";
  if (theme === "light") document.body.classList.add("light");
  els.toggleThemeBtn.textContent = theme === "light" ? "☀️" : "🌙";
}
