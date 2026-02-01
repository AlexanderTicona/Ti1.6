// js/main.js

// 1. BLOQUEO DE ZOOM NATIVO Y GESTOS (Mantenido)
document.addEventListener('touchstart', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', e => {
    let now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
}, false);

/**
 * Gestiona el cambio de pestañas laterales y layouts
 */
function changeLayout(newLayout) {
    const dashboard = document.getElementById('main-dashboard');
    if (!dashboard) return;

    dashboard.className = newLayout;

    // Actualizar estado de botones
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    if (window.event && window.event.currentTarget) {
        window.event.currentTarget.classList.add('active');
    }

    // --- RE-ENCUADRE AUTOMÁTICO CRUCIAL ---
    requestAnimationFrame(() => {
        resizeAll(); // Recalcula el tamaño de los canvas (ahora más pequeños en Mixto)
        
        // Forzamos el reset para que la data se ajuste al nuevo tamaño del panel
        if (appState.planta) resetView('planta');
        if (appState.secciones.length > 0) resetView('seccion');
        if (appState.perfil) resetView('perfil');
        
        syncAllViews(); 
    });
}

// LECTOR DE ARCHIVOS MEJORADO
document.getElementById('fileInput').addEventListener('change', function(e) {
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const raw = JSON.parse(event.target.result);

            // CASO A: Es Planta
            if (raw.geometria) {
                appState.planta = raw;
                let minE = Infinity, maxE = -Infinity, minN = Infinity, maxN = -Infinity;
                raw.geometria.forEach(p => {
                    if (p.e < minE) minE = p.e; if (p.e > maxE) maxE = p.e;
                    if (p.n < minN) minN = p.n; if (p.n > maxN) maxN = p.n;
                });

                // 1. Grilla con GAP
                appState.limitesGlobales.planta = { 
                    minE: minE - 1000, maxE: maxE + 1000, 
                    minN: minN - 1000, maxN: maxN + 1000 
                };
                
                // 2. Encuadre REAL
                appState.encuadre.planta = { minE, maxE, minN, maxN };

                // 3. Ejecución en orden
                resizeAll(); 
                resetView('planta'); 
                alert("✅ Planta cargada");
                return;
            }
            
            // CASO B: Es Perfil en main.js
            if (raw.perfiles) {
                appState.perfil = raw;

                let minK = Infinity, maxK = -Infinity, minZ = Infinity, maxZ = -Infinity;
                Object.values(raw.perfiles).forEach(p => {
                    p.datos.forEach(pt => {
                        if (pt.k < minK) minK = pt.k; if (pt.k > maxK) maxK = pt.k;
                        if (pt.z < minZ) minZ = pt.z; if (pt.z > maxZ) maxZ = pt.z;
                    });
                });

                const altoZ = maxZ - minZ;

                // LÍMITES DE GRILLA: Gap 0 en X (K), Gap 10% en Y (Z)
                appState.limitesGlobales.perfil = {
                    minK: minK, 
                    maxK: maxK,
                    minZ: minZ - (altoZ * 0.1),
                    maxZ: maxZ + (altoZ * 0.1)
                };

                // Encuadre exacto a la data
                appState.encuadre.perfil = { minK, maxK, minZ, maxZ };

                resizeAll();
                resetView('perfil');
                return;
            }

            // CASO C: Son Secciones
            appState.secciones = raw.data || (Array.isArray(raw) ? raw : []);
            if (appState.secciones.length > 0) {
                // 1. ESCANEO GLOBAL DE ELEVACIONES (Para la Grilla Maestra)
                let gMinY = Infinity, gMaxY = -Infinity;
                appState.secciones.forEach(sec => {
                    const capas = [];
                    if (sec.t) sec.t.forEach(c => capas.push(c.p));
                    if (sec.c) sec.c.forEach(c => capas.push(c));
                    
                    capas.forEach(pts => {
                        const esPlano = typeof pts[0] === 'number';
                        for (let i = 0; i < pts.length; i += (esPlano ? 2 : 1)) {
                            const p = esPlano ? { x: pts[i], y: pts[i+1] } : pts[i];
                            if (p && p.y > -500) {
                                if (p.y < gMinY) gMinY = p.y;
                                if (p.y > gMaxY) gMaxY = p.y;
                            }
                        }
                    });
                });

                if (gMinY === Infinity) { gMinY = 0; gMaxY = 100; }
                const altoOriginal = gMaxY - gMinY;

                // 2. GUARDAR LÍMITES DE GRILLA (Con el gap del 10% por lado)
                appState.limitesGlobales.seccion = {
                    minX: -100, maxX: 100,
                    minY: gMinY - (altoOriginal * 0.1),
                    maxY: gMaxY + (altoOriginal * 0.1)
                };

                // 3. NUEVO: ESCANEO DE DATA PURA (Para el Zoom/Reset perfecto)
                // Analizamos solo la primera sección para que el zoom inicial sea exacto
                let sMinX = Infinity, sMaxX = -Infinity, sMinY = Infinity, sMaxY = -Infinity;
                const sec1 = appState.secciones[0];
                const pts1 = [];
                if (sec1.t) sec1.t.forEach(c => pts1.push(...c.p));
                if (sec1.c) sec1.c.forEach(c => pts1.push(...c));

                pts1.forEach((p, idx) => {
                    const esNum = typeof p === 'number';
                    const x = esNum ? p : p.x;
                    // Si es array plano, la Y es el siguiente índice; si es objeto, es p.y
                    const y = esNum ? pts1[idx + 1] : p.y;
                    
                    if (esNum && idx % 2 !== 0) return; // Saltamos si estamos en una posición Y de array plano

                    if (x < sMinX) sMinX = x; if (x > sMaxX) sMaxX = x;
                    if (y > -500) {
                        if (y < sMinY) sMinY = y; if (y > sMaxY) sMaxY = y;
                    }
                });

                // Guardamos el encuadre limpio (sin gaps)
                appState.encuadre.seccion = { minX: sMinX, maxX: sMaxX, minY: sMinY, maxY: sMaxY };

                // 4. UI Y RESET
                const slider = document.getElementById('stationSlider');
                slider.max = appState.secciones.length - 1;
                slider.value = 0;
                appState.currentIdx = 0;

                resizeAll();    // Asegura dimensiones antes del reset
                resetView('seccion'); 
                alert("✅ Secciones cargadas");
            }
        } catch (err) { 
            console.error("Error:", err);
            alert("❌ Estructura de JSON no reconocida"); 
        }
    };
    reader.readAsText(e.target.files[0]);
});

/**
 * Control del Slider de Progresivas (Mantenido)
 */
document.getElementById('stationSlider').addEventListener('input', (e) => {
    appState.currentIdx = parseInt(e.target.value);
    syncAllViews();
});

// VARIABLES Y LISTENERS DE INTERACCIÓN
const canvasSec = document.getElementById('visorCanvas');
const canvasPlanta = document.getElementById('canvasPlanta');
const canvasPerfil = document.getElementById('canvasPerfil');

// Mousedown (Inicio de arrastre)
canvasSec.addEventListener('mousedown', e => { appState.isDragging = true; appState.lastMousePos = { x: e.clientX, y: e.clientY }; updateHUD(e); });
canvasPlanta.addEventListener('mousedown', e => { if (!appState.planta) return; appState.isDraggingPlanta = true; appState.lastMousePos = { x: e.clientX, y: e.clientY }; });
canvasPerfil.addEventListener('mousedown', e => { if (!appState.perfil) return; appState.isDraggingPerfil = true; appState.lastMousePos = { x: e.clientX, y: e.clientY }; });

window.addEventListener('mouseup', () => { appState.isDragging = false; appState.isDraggingPlanta = false; appState.isDraggingPerfil = false; });

// Mousemove (Arrastre activo)
window.addEventListener('mousemove', e => {
    const deltaX = e.clientX - appState.lastMousePos.x;
    const deltaY = e.clientY - appState.lastMousePos.y;

    if (appState.isDragging) {
        appState.cameras.seccion.x += deltaX * window.devicePixelRatio;
        appState.cameras.seccion.y += deltaY * window.devicePixelRatio;
    }
    if (appState.isDraggingPlanta) {
        appState.cameras.planta.x += deltaX * window.devicePixelRatio;
        appState.cameras.planta.y += deltaY * window.devicePixelRatio;
    }
    if (appState.isDraggingPerfil) {
        appState.cameras.perfil.x += deltaX * window.devicePixelRatio;
        appState.cameras.perfil.y += deltaY * window.devicePixelRatio;
    }

    if (appState.isDragging || appState.isDraggingPlanta || appState.isDraggingPerfil) {
        appState.lastMousePos = { x: e.clientX, y: e.clientY };
        syncAllViews();
    }
});

// --- LÓGICA DE ZOOM MEJORADA (Universal) ---
function aplicarZoom(cam, e, canvasElement) {
    const rect = canvasElement.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) * window.devicePixelRatio;
    const mouseY = (e.clientY - rect.top) * window.devicePixelRatio;

    const worldX = (mouseX - cam.x) / cam.zoom;
    const worldY = (mouseY - cam.y) / cam.zoom;

    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    // Límites de zoom: 0.001 para ver todo el proyecto, 100 para ver detalle
    const newZoom = Math.min(Math.max(cam.zoom * zoomFactor, 0.001), 100);

    cam.zoom = newZoom;
    cam.x = mouseX - (worldX * cam.zoom);
    cam.y = mouseY - (worldY * cam.zoom);

    syncAllViews();
}

// Rueda del mouse (Zoom)
canvasSec.addEventListener('wheel', e => { e.preventDefault(); aplicarZoom(appState.cameras.seccion, e, canvasSec); }, { passive: false });
canvasPlanta.addEventListener('wheel', e => { e.preventDefault(); aplicarZoom(appState.cameras.planta, e, canvasPlanta); }, { passive: false });
canvasPerfil.addEventListener('wheel', e => { e.preventDefault(); aplicarZoom(appState.cameras.perfil, e, canvasPerfil); }, { passive: false });

/**
 * HUD: Coordenadas de ingeniería (Mantenido)
 */
function updateHUD(e) {
    if (!appState.secciones || !appState.transform) return;
    const cam = appState.cameras.seccion;
    const rect = canvasSec.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) * window.devicePixelRatio - cam.x) / cam.zoom;
    const vy = ((e.clientY - rect.top) * window.devicePixelRatio - cam.y) / cam.zoom;
    const rx = ((vx - appState.transform.mx) / appState.transform.scale) + appState.transform.minX;
    const ry = ((canvasSec.height - vy - appState.transform.my) / appState.transform.scale) + appState.transform.minY;
    appState.lastClick = { x: rx, y: ry };
    document.getElementById('hud').style.display = 'block';
    document.getElementById('hudX').innerText = rx.toFixed(2);
    document.getElementById('hudY').innerText = ry.toFixed(2);
    syncAllViews();
}

/**
 * Reajusta el tamaño de los lienzos (Mantenido)
 */
function resizeAll() {
    ['visorCanvas', 'canvasPlanta', 'canvasPerfil'].forEach(id => {
        const c = document.getElementById(id);
        if (c && c.clientWidth > 0) {
            c.width = c.clientWidth * window.devicePixelRatio;
            c.height = c.clientHeight * window.devicePixelRatio;
        }
    });
    syncAllViews();
}

function resetView(tipo) {
    if (appState.cameras[tipo]) {
        // Volvemos a la base: posición 0,0 y zoom 1
        appState.cameras[tipo] = { x: 0, y: 0, zoom: 1 };
        syncAllViews();
    }
}

// Soporte Touch para Zoom (Mantenido para Sección)
let distInicial = null;
canvasSec.addEventListener('touchstart', e => {
    if (e.touches.length === 2) distInicial = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
}, { passive: false });

canvasSec.addEventListener('touchmove', e => {
    if (e.touches.length === 2 && distInicial) {
        e.preventDefault();
        const distActual = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
        const cam = appState.cameras.seccion;
        const delta = distActual / distInicial;
        const oldZoom = cam.zoom;
        cam.zoom = Math.min(Math.max(cam.zoom * delta, 0.1), 50);
        const midX = (e.touches[0].pageX + e.touches[1].pageX) / 2;
        const midY = (e.touches[0].pageY + e.touches[1].pageY) / 2;
        const rect = canvasSec.getBoundingClientRect();
        const ax = (midX - rect.left) * window.devicePixelRatio;
        const ay = (midY - rect.top) * window.devicePixelRatio;
        cam.x -= (ax - cam.x) * (cam.zoom / oldZoom - 1);
        cam.y -= (ay - cam.y) * (cam.zoom / oldZoom - 1);
        distInicial = distActual;
        syncAllViews();
    }
}, { passive: false });

canvasSec.addEventListener('touchend', () => { distInicial = null; });

// Búsqueda por PK (Mantenido)
const kmInput = document.getElementById('kmInput');
kmInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
        buscarProgresiva(kmInput.value);
        kmInput.blur();
    }
});

function buscarProgresiva(texto) {
    if (!appState.secciones) return;
    let valorBuscado = parseFloat(texto.replace('+', ''));
    if (isNaN(valorBuscado)) { syncAllViews(); return; }
    let mejorIndice = 0;
    let minimaDiferencia = Infinity;
    appState.secciones.forEach((seccion, index) => {
        let kActual = seccion.k || seccion.km || 0;
        let diferencia = Math.abs(kActual - valorBuscado);
        if (diferencia < minimaDiferencia) { minimaDiferencia = diferencia; mejorIndice = index; }
    });
    appState.currentIdx = mejorIndice;
    const slider = document.getElementById('stationSlider');
    if (slider) slider.value = mejorIndice;
    syncAllViews();
}

/**
 * OBSERVADOR DE TAMAÑO (Versión 1.6 Estable)
 */
const observerPlanta = new ResizeObserver(entries => {
    for (let entry of entries) {
        // Solo actuamos si el ancho es mayor a 0 (evita errores al ocultar pestañas)
        if (entry.contentRect.width > 10) { 
            resizeAll(); 
            // IMPORTANTE: Eliminamos el reset forzado a {x:0, y:0} que tenías antes
            // para que no mande el dibujo "al infinito".
            syncAllViews(); 
        }
    }
});

const panelAObservar = document.getElementById('panel-planta');
if (panelAObservar) observerPlanta.observe(panelAObservar);

window.onload = resizeAll;
window.onresize = resizeAll;