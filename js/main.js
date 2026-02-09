// js/main.js

// 1. BLOQUEO DE GESTOS NATIVOS (Previene recargas indeseadas en móvil)
document.addEventListener('touchstart', e => { 
    if (e.touches.length > 1) e.preventDefault(); 
}, { passive: false });

let lastTouchEnd = 0;
document.addEventListener('touchend', e => {
    let now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
}, false);

// 2. GESTIÓN DE LAYOUTS
function changeLayout(newLayout) {
    const modal = document.getElementById('settingsModal');
    if (modal && modal.style.display !== 'none') toggleSettings();

    const dashboard = document.getElementById('main-dashboard');
    if (!dashboard) return;
    dashboard.className = newLayout;

    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (window.event && window.event.currentTarget) {
        window.event.currentTarget.classList.add('active');
    }

    requestAnimationFrame(() => {
        resizeAll(); 
        if (appState.planta) resetView('planta');
        if (appState.secciones && appState.secciones.length > 0) resetView('seccion');
        if (appState.perfil) resetView('perfil');
        syncAllViews(); 
    });
}

// 3. LECTOR DE ARCHIVOS (.TIQAL)
document.getElementById('fileInput').addEventListener('change', function(e) {
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const raw = JSON.parse(event.target.result);
            let datosCargados = false;

            // --- A. PLANTA ---
            const plantaArr = raw.planta_trazo || raw.planta;
            if (plantaArr) {
                appState.planta = raw; 
                let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity;
                
                plantaArr.forEach(pt => {
                    // Lógica inteligente: Si es [k,x,y] toma índices 1 y 2. Si es [x,y] toma 0 y 1.
                    const x = pt.length >= 3 ? pt[1] : pt[0];
                    const y = pt.length >= 3 ? pt[2] : pt[1];
                    
                    if (x < minE) minE = x; if (x > maxE) maxE = x;
                    if (y < minN) minN = y; if (y > maxN) maxN = y;
                });

                appState.limitesGlobales.planta = { 
                    minE: minE - 500, maxE: maxE + 500, 
                    minN: minN - 500, maxN: maxN + 500 
                };
                appState.encuadre.planta = { minE, maxE, minN, maxN };
                datosCargados = true;
            }

            // --- B. PERFIL ---
            if (raw.perfiles) {
                appState.perfil = raw.perfiles;
                let minK = Infinity, maxK = -Infinity, minZ = Infinity, maxZ = -Infinity;
                
                raw.perfiles.forEach(p => {
                    if (p.data) p.data.forEach(pt => {
                        const k = pt[0], z = pt[1];
                        if (k < minK) minK = k; if (k > maxK) maxK = k;
                        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
                    });
                });

                if (minK !== Infinity) {
                    const altoZ = maxZ - minZ;
                    appState.limitesGlobales.perfil = {
                        minK, maxK, 
                        minZ: minZ - (altoZ * 0.2), maxZ: maxZ + (altoZ * 0.2)
                    };
                    appState.encuadre.perfil = { minK, maxK, minZ, maxZ };
                    datosCargados = true;
                }
            }

            // --- C. SECCIONES ---
            if (raw.secciones) {
                appState.secciones = raw.secciones;
                let gMinY = Infinity, gMaxY = -Infinity;
                
                // Muestreo rápido
                const pasoScan = raw.secciones.length > 500 ? 10 : 1; 

                for (let k = 0; k < raw.secciones.length; k += pasoScan) {
                    const sec = raw.secciones[k];
                    const escanear = (listas) => {
                        if (!listas) return;
                        listas.forEach(obj => {
                            const arr = Array.isArray(obj) ? obj : (obj.p || []);
                            for (let i = 1; i < arr.length; i+=2) {
                                const y = arr[i];
                                if (y > -1000 && y < 8000) { 
                                    if (y < gMinY) gMinY = y; 
                                    if (y > gMaxY) gMaxY = y; 
                                }
                            }
                        });
                    };
                    escanear(sec.t); escanear(sec.c);
                }

                if (gMinY === Infinity) { gMinY = 0; gMaxY = 20; }
                const alto = gMaxY - gMinY;
                
                appState.limitesGlobales.seccion = {
                    minX: -50, maxX: 50,
                    minY: gMinY - (alto * 0.1), maxY: gMaxY + (alto * 0.1)
                };
                appState.encuadre.seccion = { minX: -20, maxX: 20, minY: gMinY, maxY: gMaxY };

                const slider = document.getElementById('stationSlider');
                slider.max = appState.secciones.length - 1;
                slider.value = 0;
                appState.currentIdx = 0;
                datosCargados = true;
            }

            if (datosCargados) {
                resizeAll();
                resetView('planta');
                resetView('perfil');
                resetView('seccion');
                syncAllViews();
                alert("✅ Archivo TiQAL cargado correctamente");
            } else {
                alert("⚠️ El archivo no contiene datos válidos.");
            }

        } catch (err) { 
            console.error(err);
            alert("❌ Error leyendo archivo."); 
        }
    };
    reader.readAsText(e.target.files[0]);
});

// 4. INTERACCIÓN UNIFICADA (MOUSE/TOUCH)
const canvasSec = document.getElementById('visorCanvas');
const canvasPlanta = document.getElementById('canvasPlanta');
const canvasPerfil = document.getElementById('canvasPerfil');

let isPanning = false;
let distInicial = null;

function getPos(e) { 
    return (e.touches && e.touches.length > 0) ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY }; 
}

function handleStart(e, tipo) {
    const pos = getPos(e);
    appState.lastMousePos = pos;
    isPanning = true;

    // Solo actualizamos HUD si hacemos clic en Sección
    if (tipo === 'seccion') { 
        appState.isDragging = true; 
        updateHUD(e); 
    }
    if (tipo === 'planta') { if(appState.planta) appState.isDraggingPlanta = true; }
    if (tipo === 'perfil') { if(appState.perfil) appState.isDraggingPerfil = true; }
}

// Asignar listeners
[{c: canvasSec, t: 'seccion'}, {c: canvasPlanta, t: 'planta'}, {c: canvasPerfil, t: 'perfil'}].forEach(item => {
    item.c.addEventListener('mousedown', e => handleStart(e, item.t));
    item.c.addEventListener('touchstart', e => {
        if (e.touches.length === 1) handleStart(e, item.t);
        else if (e.touches.length === 2) {
            // Guardamos distancia inicial para el pinch zoom
            distInicial = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
        }
    }, { passive: false });
});

window.addEventListener('mousemove', handleMove);
window.addEventListener('touchmove', e => {
    if (e.touches.length === 1 && isPanning) {
        if (e.target.tagName === 'CANVAS') e.preventDefault();
        handleMove(e);
    } else if (e.touches.length === 2 && distInicial) {
        e.preventDefault();
        handlePinchZoom(e); // Llama a la función dinámica
    }
}, { passive: false });

function handleMove(e) {
    if (!isPanning) return;
    const pos = getPos(e);
    const deltaX = (pos.x - appState.lastMousePos.x) * window.devicePixelRatio;
    const deltaY = (pos.y - appState.lastMousePos.y) * window.devicePixelRatio;

    if (appState.isDragging) { appState.cameras.seccion.x += deltaX; appState.cameras.seccion.y += deltaY; }
    if (appState.isDraggingPlanta) { appState.cameras.planta.x += deltaX; appState.cameras.planta.y += deltaY; }
    if (appState.isDraggingPerfil) { appState.cameras.perfil.x += deltaX; appState.cameras.perfil.y += deltaY; }

    appState.lastMousePos = pos;
    syncAllViews();
}

// ZOOM TÁCTIL DINÁMICO (Planta, Perfil y Sección)
function handlePinchZoom(e) {
    let cam = null;
    const targetId = e.target.id;
    
    // Detectamos qué cámara mover según qué canvas estamos tocando
    if (targetId === 'visorCanvas') cam = appState.cameras.seccion;
    else if (targetId === 'canvasPlanta') cam = appState.cameras.planta;
    else if (targetId === 'canvasPerfil') cam = appState.cameras.perfil;
    
    if (!cam) return; 

    const distActual = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
    const delta = distActual / distInicial;
    const oldZoom = cam.zoom;
    
    // Zoom con límites
    cam.zoom = Math.min(Math.max(cam.zoom * delta, 0.01), 100);
    
    // Zoom hacia el centro del gesto (Punto medio de los dos dedos)
    const midX = (e.touches[0].pageX + e.touches[1].pageX) / 2;
    const midY = (e.touches[0].pageY + e.touches[1].pageY) / 2;
    const rect = e.target.getBoundingClientRect();
    const ax = (midX - rect.left) * window.devicePixelRatio;
    const ay = (midY - rect.top) * window.devicePixelRatio;
    
    // Ajuste de paneo para mantener el centro
    cam.x -= (ax - cam.x) * (cam.zoom / oldZoom - 1);
    cam.y -= (ay - cam.y) * (cam.zoom / oldZoom - 1);
    
    distInicial = distActual;
    syncAllViews();
}

const stopAll = () => { isPanning = false; distInicial = null; appState.isDragging = false; appState.isDraggingPlanta = false; appState.isDraggingPerfil = false; };
window.addEventListener('mouseup', stopAll);
window.addEventListener('touchend', stopAll);

// Zoom Rueda Mouse (Universal)
function aplicarZoom(cam, e, canvasElement) {
    const rect = canvasElement.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * window.devicePixelRatio;
    const mouseY = (e.clientY - rect.top) * window.devicePixelRatio;
    const worldX = (mouseX - cam.x) / cam.zoom;
    const worldY = (mouseY - cam.y) / cam.zoom;
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    cam.zoom = Math.min(Math.max(cam.zoom * zoomFactor, 0.001), 100);
    cam.x = mouseX - (worldX * cam.zoom);
    cam.y = mouseY - (worldY * cam.zoom);
    syncAllViews();
}
canvasSec.addEventListener('wheel', e => { e.preventDefault(); aplicarZoom(appState.cameras.seccion, e, canvasSec); }, { passive: false });
canvasPlanta.addEventListener('wheel', e => { e.preventDefault(); aplicarZoom(appState.cameras.planta, e, canvasPlanta); }, { passive: false });
canvasPerfil.addEventListener('wheel', e => { e.preventDefault(); aplicarZoom(appState.cameras.perfil, e, canvasPerfil); }, { passive: false });

// HUD (Sección) - CÁLCULO PRECISO
function updateHUD(e) {
    // Si no se ha dibujado nada, appState.transform no existe y salimos
    if (!appState.secciones || !appState.transform) return;
    
    const pos = getPos(e);
    const cam = appState.cameras.seccion;
    const rect = canvasSec.getBoundingClientRect();
    
    // 1. Convertir Coordenada Pantalla -> Coordenada Canvas (Mundo Visual)
    const vx = ((pos.x - rect.left) * window.devicePixelRatio - cam.x) / cam.zoom;
    const vy = ((pos.y - rect.top) * window.devicePixelRatio - cam.y) / cam.zoom;
    
    appState.lastClick = { x: vx, y: vy }; 

    // 2. Convertir Coordenada Canvas -> Coordenada Ingeniería (Inversa de seccion.js)
    // Formula original: CanvasX = MarginX + (Valor - MinX) * Scale
    // Formula inversa:  Valor   = ((CanvasX - MarginX) / Scale) + MinX
    const rx = ((vx - appState.transform.mx) / appState.transform.scale) + appState.transform.minX;
    
    // Formula original Y: CanvasY = H - (MarginY + (Valor - MinY) * Scale)
    // Despejando: H - CanvasY = MarginY + (Valor - MinY) * Scale
    //             (H - CanvasY - MarginY) / Scale = Valor - MinY
    //             Valor = ((H - CanvasY - MarginY) / Scale) + MinY
    const ry = ((canvasSec.height - vy - appState.transform.my) / appState.transform.scale) + appState.transform.minY;
    
    const hud = document.getElementById('hud');
    if (hud) {
        hud.style.display = 'block';
        document.getElementById('hudX').innerText = rx.toFixed(2);
        document.getElementById('hudY').innerText = ry.toFixed(2);
    }
    syncAllViews();
}

// SLIDER Y BUSQUEDA
document.getElementById('stationSlider').addEventListener('input', (e) => {
    appState.currentIdx = parseInt(e.target.value);
    syncAllViews();
});
const kmInput = document.getElementById('kmInput');
kmInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') { buscarProgresiva(kmInput.value); kmInput.blur(); }
});
function buscarProgresiva(texto) {
    if (!appState.secciones) return;
    let valorBuscado = parseFloat(texto.replace('+', ''));
    if (isNaN(valorBuscado)) { syncAllViews(); return; }
    let mejorIndice = 0; let minimaDiferencia = Infinity;
    appState.secciones.forEach((seccion, index) => {
        let kActual = seccion.k || seccion.km || 0;
        let diferencia = Math.abs(kActual - valorBuscado);
        if (diferencia < minimaDiferencia) { minimaDiferencia = diferencia; mejorIndice = index; }
    });
    appState.currentIdx = mejorIndice;
    document.getElementById('stationSlider').value = mejorIndice;
    syncAllViews();
}

// RESIZE
function resizeAll() {
    ['visorCanvas', 'canvasPlanta', 'canvasPerfil'].forEach(id => {
        const c = document.getElementById(id);
        if (c && c.parentNode) {
            const parent = c.parentNode;
            if (parent.clientWidth > 0) {
                c.width = parent.clientWidth * window.devicePixelRatio;
                c.height = parent.clientHeight * window.devicePixelRatio;
            }
        }
    });
    syncAllViews();
}
function resetView(tipo) {
    if (appState.cameras[tipo]) { appState.cameras[tipo] = { x: 0, y: 0, zoom: 1 }; syncAllViews(); }
}
const observerPlanta = new ResizeObserver(entries => {
    for (let entry of entries) { if (entry.contentRect.width > 10) { resizeAll(); syncAllViews(); } }
});
if (document.getElementById('panel-planta')) observerPlanta.observe(document.getElementById('panel-planta'));

window.onload = resizeAll;
window.onresize = resizeAll;

// AJUSTES
function openTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.setting-tab').forEach(el => el.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    
    const buttons = document.querySelectorAll('.setting-tab');
    if (tabId === 'tab-general') buttons[0].classList.add('active');
    if (tabId === 'tab-planta')  buttons[1].classList.add('active');
    if (tabId === 'tab-perfil')  buttons[2].classList.add('active');
    if (tabId === 'tab-seccion') buttons[3].classList.add('active');
}

function toggleSettings() {
    const modal = document.getElementById('settingsModal');
    if (!modal) return;
    const isHidden = modal.style.display === 'none';
    modal.style.display = isHidden ? 'flex' : 'none';
    const btnSettings = document.querySelector('.btn-settings');
    if (btnSettings) { isHidden ? btnSettings.classList.add('active') : btnSettings.classList.remove('active'); }
    if (isHidden) cargarValoresAjustes();
}

function cargarValoresAjustes() {
    document.getElementById('chkTheme').checked = (appConfig.general.theme === 'light');
    document.getElementById('cfgTextScale').value = appConfig.general.textScale;
    document.getElementById('cfgGridPlanta').value = appConfig.planta.gridInterval;
    document.getElementById('cfgGridPlantaMulti').value = appConfig.planta.gridIntervalMulti;
    document.getElementById('chkShowGridPlanta').checked = appConfig.planta.showGrid;
    document.getElementById('cfgGridPerfilK').value = appConfig.perfil.gridK;
    document.getElementById('cfgGridPerfilKMulti').value = appConfig.perfil.gridKMulti || 1000;
    document.getElementById('cfgGridPerfilZ').value = appConfig.perfil.gridZ;
    document.getElementById('cfgGridPerfilZMulti').value = appConfig.perfil.gridZMulti || 50;
    document.getElementById('cfgExajPerfil').value = appConfig.perfil.exaj;
    document.getElementById('cfgTargetPerfil').value = appConfig.perfil.target;
    document.getElementById('cfgGridSeccionX').value = (appConfig.seccion && appConfig.seccion.gridX) ? appConfig.seccion.gridX : 5;
    document.getElementById('cfgGridSeccionY').value = (appConfig.seccion && appConfig.seccion.gridY) ? appConfig.seccion.gridY : 5;
}

function applySettingsAndClose() {
    appConfig.general.textScale = parseFloat(document.getElementById('cfgTextScale').value) || 1.0;
    if (!appConfig.planta) appConfig.planta = {};
    appConfig.planta.gridInterval = parseFloat(document.getElementById('cfgGridPlanta').value) || 200;
    appConfig.planta.gridIntervalMulti = parseFloat(document.getElementById('cfgGridPlantaMulti').value) || 500;
    appConfig.planta.showGrid = document.getElementById('chkShowGridPlanta').checked;
    if (!appConfig.perfil) appConfig.perfil = {};
    appConfig.perfil.gridK = parseFloat(document.getElementById('cfgGridPerfilK').value) || 100;
    appConfig.perfil.gridKMulti = parseFloat(document.getElementById('cfgGridPerfilKMulti').value) || 1000;
    appConfig.perfil.gridZ = parseFloat(document.getElementById('cfgGridPerfilZ').value) || 5;
    appConfig.perfil.gridZMulti = parseFloat(document.getElementById('cfgGridPerfilZMulti').value) || 50;
    appConfig.perfil.exaj = parseFloat(document.getElementById('cfgExajPerfil').value) || 10;
    appConfig.perfil.target = document.getElementById('cfgTargetPerfil').value;
    if (!appConfig.seccion) appConfig.seccion = {};
    appConfig.seccion.gridX = parseFloat(document.getElementById('cfgGridSeccionX').value) || 5;
    appConfig.seccion.gridY = parseFloat(document.getElementById('cfgGridSeccionY').value) || 5;
    syncAllViews();
    toggleSettings();
}

function toggleTheme(checkbox) { appConfig.general.theme = checkbox.checked ? 'light' : 'dark'; applyTheme(); }
function applyTheme() {
    if (appConfig.general.theme === 'light') document.body.classList.add('light-mode');
    else document.body.classList.remove('light-mode');
    syncAllViews();
}
window.addEventListener('DOMContentLoaded', () => { applyTheme(); });