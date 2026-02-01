// js/state.js
const appState = {
    secciones: [],      
    planta: null,       
    perfil: null,       // Agregado: Almacén para el JSON de perfiles
    currentIdx: 0,

    limitesGlobales: {
    seccion: { minX: -100, maxX: 100, minY: 0, maxY: 100 },
    planta:  { minE: 0, maxE: 1000, minN: 0, maxN: 1000 }
    },
    encuadre: {
        seccion: { minX: -20, maxX: 20, minY: 0, maxY: 20 },
        planta:  { minE: 0, maxE: 1000, minN: 0, maxN: 1000 }
    },
    
    cameras: {
        seccion: { x: 0, y: 0, zoom: 1 },
        planta:  { x: 0, y: 0, zoom: 1 },
        perfil:  { x: 0, y: 0, zoom: 1 } // Cámara para el panel de perfil
    },
    
    isDragging: false,
    isDraggingPlanta: false,
    isDraggingPerfil: false, // Estado de arrastre para perfil
    lastMousePos: { x: 0, y: 0 },
    lastClick: null,
    transform: { minX: 0, minY: 0, scale: 1, mx: 0, my: 0 }
};

function syncAllViews() {
    // 1. Dibujos independientes (Se ejecutan siempre que existan datos)
    if (appState.planta && typeof dibujarPlanta === 'function') dibujarPlanta();
    if (appState.perfil && typeof dibujarPerfil === 'function') dibujarPerfil();

    // 2. Si no hay secciones, detenemos la sincronización del slider y el PK
    if (!appState.secciones || !appState.secciones[appState.currentIdx]) return;
    
    const seccionActual = appState.secciones[appState.currentIdx];
    
    // 3. Actualizar el Input de PK
    const kmInput = document.getElementById('kmInput');
    if (kmInput && document.activeElement !== kmInput) {
        const m = seccionActual.k || seccionActual.km || 0;
        const km = Math.floor(m / 1000);
        const rest = (m % 1000).toFixed(2).padStart(6, '0');
        kmInput.value = `${km}+${rest}`;
    }

    // 4. Dibujar Sección Transversal
    if (typeof dibujarSeccion === 'function') dibujarSeccion(seccionActual);
}