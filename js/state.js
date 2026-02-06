// js/state.js

// 1. ESTADO DE DATOS
const appState = {
    secciones: [],      
    planta: null, perfil: null, currentIdx: 0,
    limitesGlobales: {
        seccion: { minX: -100, maxX: 100, minY: 0, maxY: 100 },
        planta:  { minE: 0, maxE: 1000, minN: 0, maxN: 1000 },
        perfil:  { minK: 0, maxK: 1000, minZ: 0, maxZ: 100 }
    },
    encuadre: {
        seccion: { minX: -20, maxX: 20, minY: 0, maxY: 20 },
        planta:  { minE: 0, maxE: 1000, minN: 0, maxN: 1000 },
        perfil:  { minK: 0, maxK: 1000, minZ: 0, maxZ: 100 }
    },
    cameras: {
        seccion: { x: 0, y: 0, zoom: 1 },
        planta:  { x: 0, y: 0, zoom: 1 },
        perfil:  { x: 0, y: 0, zoom: 1 } 
    },
    isDragging: false, isDraggingPlanta: false, isDraggingPerfil: false, 
    lastMousePos: { x: 0, y: 0 }, lastClick: null,
    transform: { minX: 0, minY: 0, scale: 1, mx: 0, my: 0 }
};

// 2. CONFIGURACIÓN (VOLÁTIL)
const appConfig = {
    general: {
        theme: 'dark', 
        textScale: 1.0
    },
    planta: { 
        gridInterval: 200,      // Normal
        gridIntervalMulti: 500, // Mini
        showGrid: true 
    },
    perfil: { 
        gridK: 500,       // PK Normal
        gridKMulti: 1000, // PK Mini (NUEVO)
        gridZ: 10,        // Cota Normal
        gridZMulti: 50,   // Cota Mini (NUEVO)
        exaj: 10,
        target: 'all'
    },
    seccion: { 
        gridX: 5, 
        gridY: 5 
    }
};

// 3. SINCRONIZADOR
function syncAllViews() {
    if (appState.planta && typeof dibujarPlanta === 'function') dibujarPlanta();
    if (appState.perfil && typeof dibujarPerfil === 'function') dibujarPerfil();

    if (!appState.secciones || !appState.secciones[appState.currentIdx]) return;
    
    const seccionActual = appState.secciones[appState.currentIdx];
    const kmInput = document.getElementById('kmInput');
    if (kmInput && document.activeElement !== kmInput) {
        const m = seccionActual.k || seccionActual.km || 0;
        const km = Math.floor(m / 1000);
        const rest = (m % 1000).toFixed(2).padStart(6, '0');
        kmInput.value = `${km}+${rest}`;
    }
    if (typeof dibujarSeccion === 'function') dibujarSeccion(seccionActual);
}