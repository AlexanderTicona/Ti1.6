// js/main.js

// 1. BLOQUEO DE ZOOM NATIVO Y GESTOS DEL NAVEGADOR
document.addEventListener('touchstart', e => { 
    if (e.touches.length > 1) e.preventDefault(); 
}, { passive: false });

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

    // --- RE-ENCUADRE AUTOMÁTICO ---
    requestAnimationFrame(() => {
        resizeAll(); 
        if (appState.planta) resetView('planta');
        if (appState.secciones.length > 0) resetView('seccion');
        if (appState.perfil) resetView('perfil');
        syncAllViews(); 
    });
}

// 2. LECTOR DE ARCHIVOS MEJORADO
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

                appState.limitesGlobales.planta = { 
                    minE: minE - 1000, maxE: maxE + 1000, 
                    minN: minN - 1000, maxN: maxN + 1000 
                };
                appState.encuadre.planta = { minE, maxE, minN, maxN };

                resizeAll(); 
                resetView('planta'); 
                alert("✅ Planta cargada");
                return;
            }
            
            // CASO B: Es Perfil
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
                appState.limitesGlobales.perfil = {
                    minK: minK, maxK: maxK,
                    minZ: minZ - (altoZ * 0.1), maxZ: maxZ + (altoZ * 0.1)
                };
                appState.encuadre.perfil = { minK, maxK, minZ, maxZ };

                resizeAll();
                resetView('perfil');
                return;
            }

            // CASO C: Son Secciones
            appState.secciones = raw.data || (Array.isArray(raw) ? raw : []);
            if (appState.secciones.length > 0) {
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

                appState.limitesGlobales.seccion = {
                    minX: -100, maxX: 100,
                    minY: gMinY - (altoOriginal * 0.1),
                    maxY: gMaxY + (altoOriginal * 0.1)
                };

                let sMinX = Infinity, sMaxX = -Infinity, sMinY = Infinity, sMaxY = -Infinity;
                const sec1 = appState.secciones[0];
                const pts1 = [];
                if (sec1.t) sec1.t.forEach(c => pts1.push(...c.p));
                if (sec1.c) sec1.c.forEach(c => pts1.push(...c));

                pts1.forEach((p, idx) => {
                    const esNum = typeof p === 'number';
                    const x = esNum ? p : p.x;
                    const y = esNum ? pts1[idx + 1] : p.y;
                    if (esNum && idx % 2 !== 0) return;
                    if (x < sMinX) sMinX = x; if (x > sMaxX) sMaxX = x;
                    if (y > -500) { if (y < sMinY) sMinY = y; if (y > sMaxY) sMaxY = y; }
                });

                appState.encuadre.seccion = { minX: sMinX, maxX: sMaxX, minY: sMinY, maxY: sMaxY };

                const slider = document.getElementById('stationSlider');
                slider.max = appState.secciones.length - 1;
                slider.value = 0;
                appState.currentIdx = 0;

                resizeAll();
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

// 3. VARIABLES Y LISTENERS DE INTERACCIÓN UNIFICADOS
const canvasSec = document.getElementById('visorCanvas');
const canvasPlanta = document.getElementById('canvasPlanta');
const canvasPerfil = document.getElementById('canvasPerfil');

let isPanning = false;
let distInicial = null;

function getPos(e) {
    if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    return { x: e.clientX, y: e.clientY };
}

function handleStart(e, tipo) {
    const pos = getPos(e);
    appState.lastMousePos = pos;
    isPanning = true;

    if (tipo === 'seccion') { appState.isDragging = true; updateHUD(e); }
    if (tipo === 'planta') { if(appState.planta) appState.isDraggingPlanta = true; }
    if (tipo === 'perfil') { if(appState.perfil) appState.isDraggingPerfil = true; }
}

// Eventos Mouse y Touch para los 3 Canvas
[
    {c: canvasSec, t: 'seccion'},
    {c: canvasPlanta, t: 'planta'},
    {c: canvasPerfil, t: 'perfil'}
].forEach(item => {
    item.c.addEventListener('mousedown', e => handleStart(e, item.t));
    item.c.addEventListener('touchstart', e => {
        if (e.touches.length === 1) handleStart(e, item.t);
        else if (e.touches.length === 2 && item.t === 'seccion') {
            distInicial = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
        }
    }, { passive: false });
});

// Movimiento Universal (Mouse + Touch)
window.addEventListener('mousemove', handleMove);
window.addEventListener('touchmove', e => {
    if (e.touches.length === 1 && isPanning) {
        if (e.target.tagName === 'CANVAS') e.preventDefault();
        handleMove(e);
    } else if (e.touches.length === 2 && distInicial && e.target.id === 'visorCanvas') {
        e.preventDefault();
        handlePinchZoom(e);
    }
}, { passive: false });

function handleMove(e) {
    if (!isPanning) return;
    const pos = getPos(e);
    const deltaX = (pos.x - appState.lastMousePos.x) * window.devicePixelRatio;
    const deltaY = (pos.y - appState.lastMousePos.y) * window.devicePixelRatio;

    if (appState.isDragging) {
        appState.cameras.seccion.x += deltaX;
        appState.cameras.seccion.y += deltaY;
    }
    if (appState.isDraggingPlanta) {
        appState.cameras.planta.x += deltaX;
        appState.cameras.planta.y += deltaY;
    }
    if (appState.isDraggingPerfil) {
        appState.cameras.perfil.x += deltaX;
        appState.cameras.perfil.y += deltaY;
    }

    appState.lastMousePos = pos;
    syncAllViews();
}

function handlePinchZoom(e) {
    const distActual = Math.hypot(e.touches[0].pageX - e.touches[1].pageX, e.touches[0].pageY - e.touches[1].pageY);
    const cam = appState.cameras.seccion;
    const delta = distActual / distInicial;
    const oldZoom = cam.zoom;
    cam.zoom = Math.min(Math.max(cam.zoom * delta, 0.01), 100);
    
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

const stopAll = () => { 
    isPanning = false; 
    distInicial = null;
    appState.isDragging = appState.isDraggingPlanta = appState.isDraggingPerfil = false; 
};
window.addEventListener('mouseup', stopAll);
window.addEventListener('touchend', stopAll);

// 4. ZOOM RUEDA MOUSE
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

// 5. HUD Y CONTROLES DE GRILLA
function updateHUD(e) {
    if (!appState.secciones || !appState.transform) return;
    const pos = getPos(e);
    const cam = appState.cameras.seccion;
    const rect = canvasSec.getBoundingClientRect();
    
    // Coordenadas en el "mundo virtual" del canvas
    const vx = ((pos.x - rect.left) * window.devicePixelRatio - cam.x) / cam.zoom;
    const vy = ((pos.y - rect.top) * window.devicePixelRatio - cam.y) / cam.zoom;
    
    // NUEVO: Guardar la posición para que el renderizador sepa dónde dibujar el círculo
    appState.lastClick = { x: vx, y: vy }; 

    // Coordenadas reales de ingeniería
    const rx = ((vx - appState.transform.mx) / appState.transform.scale) + appState.transform.minX;
    const ry = ((canvasSec.height - vy - appState.transform.my) / appState.transform.scale) + appState.transform.minY;
    
    const hud = document.getElementById('hud');
    if (hud) {
        hud.style.display = 'block';
        document.getElementById('hudX').innerText = rx.toFixed(2);
        document.getElementById('hudY').innerText = ry.toFixed(2);
    }
    
    // Forzar redibujo para que el círculo aparezca inmediatamente
    syncAllViews();
}

document.getElementById('inpGridX').addEventListener('input', syncAllViews);
document.getElementById('inpGridY').addEventListener('input', syncAllViews);

/**
 * Slider y Búsqueda
 */
document.getElementById('stationSlider').addEventListener('input', (e) => {
    appState.currentIdx = parseInt(e.target.value);
    syncAllViews();
});

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
    document.getElementById('stationSlider').value = mejorIndice;
    syncAllViews();
}

/**
 * SISTEMA DE RENDERIZADO Y TAMAÑO
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
        appState.cameras[tipo] = { x: 0, y: 0, zoom: 1 };
        syncAllViews();
    }
}

const observerPlanta = new ResizeObserver(entries => {
    for (let entry of entries) {
        if (entry.contentRect.width > 10) { 
            resizeAll(); 
            syncAllViews(); 
        }
    }
});
const panelAObservar = document.getElementById('panel-planta');
if (panelAObservar) observerPlanta.observe(panelAObservar);

// Listener para la grilla de Planta
const gridPlanta = document.getElementById('inpGridPlanta');
if (gridPlanta) {
    gridPlanta.addEventListener('input', () => {
        // Solo redibujamos si hay datos de planta cargados
        if (appState.planta) syncAllViews();
    });
}

// Listeners para la grilla del Perfil
const gpK = document.getElementById('inpGridPerfilK');
const gpZ = document.getElementById('inpGridPerfilZ');

if (gpK) gpK.addEventListener('input', () => { if (appState.perfil) syncAllViews(); });
if (gpZ) gpZ.addEventListener('input', () => { if (appState.perfil) syncAllViews(); });

window.onload = resizeAll;
window.onresize = resizeAll;