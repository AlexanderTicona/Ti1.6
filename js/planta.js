function dibujarPlanta() {
    const canvas = document.getElementById('canvasPlanta');
    if (!canvas || !appState.planta) return;
    const ctx = canvas.getContext('2d');
    
    // Configuración Visual
    const isLight = appConfig.general.theme === 'light';
    const escalaTxt = appConfig.general.textScale || 1.0;
    
    const colorGrilla = isLight ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.05)";
    const colorTexto  = isLight ? "#444444" : "rgba(255, 255, 255, 0.4)";
    const colorEje    = isLight ? "#0056b3" : "#00fbff"; 
    const colorPunto  = "red"; 
    const colorTxtPK  = isLight ? "#000000" : "#ffffff"; 

    const rect = canvas.parentNode.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // 1. OBTENER DATOS (Soporte Híbrido)
    // Tu C# nuevo genera 'planta_trazo', versiones viejas 'geometria' o 'planta'
    const trazo = appState.planta.planta_trazo || appState.planta.geometria || appState.planta.planta || [];
    
    if (!trazo || trazo.length === 0) return;

    // 2. ESCALAS Y TRANSFORMCIONES
    const { minE, maxE, minN, maxN } = appState.encuadre.planta;
    const centroE = (minE + maxE) / 2;
    const centroN = (minN + maxN) / 2;
    const scale = Math.min(W / ((maxE - minE) * 1.2), H / ((maxN - minN) * 1.2));

    const toX = (e) => (W / 2) + (e - centroE) * scale;
    const toY = (n) => (H / 2) - (n - centroN) * scale;

    ctx.save();
    const cam = appState.cameras.planta;
    ctx.translate(cam.x, cam.y);
    ctx.scale(cam.zoom, cam.zoom);

    // 3. GRILLA INTELIGENTE
    const dashboard = document.getElementById('main-dashboard');
    const esModoMini = dashboard && dashboard.classList.contains('layout-multi');
    let gSize = esModoMini ? (appConfig.planta.gridIntervalMulti || 500) : (appConfig.planta.gridInterval || 200);
    if (gSize <= 0) gSize = 100;

    if (appConfig.planta.showGrid !== false) {
        ctx.lineWidth = 1 / cam.zoom;
        ctx.strokeStyle = colorGrilla; 
        ctx.fillStyle = colorTexto;    
        ctx.font = `${(11 * escalaTxt) / cam.zoom}px monospace`;

        const yTextoFijo = (H - cam.y - 15) / cam.zoom;
        
        // Optimización: Solo dibujar grilla visible
        const startX = Math.floor((centroE - (W/scale)/cam.zoom) / gSize) * gSize;
        const endX = startX + (W*2/scale)/cam.zoom;
        
        for (let e = startX; e <= endX; e += gSize) {
            let x = toX(e);
            ctx.beginPath(); ctx.moveTo(x, -50000); ctx.lineTo(x, 50000); ctx.stroke();
            ctx.fillText(e.toFixed(0), x + 2 / cam.zoom, yTextoFijo);
        }
        
        const startY = Math.floor((centroN - (H/scale)/cam.zoom) / gSize) * gSize;
        const endY = startY + (H*2/scale)/cam.zoom;
        
        for (let n = startY; n <= endY; n += gSize) {
            let y = toY(n);
            ctx.beginPath(); ctx.moveTo(-50000, y); ctx.lineTo(50000, y); ctx.stroke();
            ctx.fillText(n.toFixed(0), (10 - cam.x) / cam.zoom, y - 2 / cam.zoom);
        }
    }

    // 4. DIBUJAR ALINEAMIENTO (Línea Azul)
    ctx.beginPath();
    ctx.strokeStyle = colorEje; 
    ctx.lineWidth = 2 / cam.zoom;
    
    // Detectamos formato del primer punto para saber qué índices leer
    // Formato Nuevo C#: [k, x, y] (longitud 3) -> x=1, y=2
    // Formato Viejo: {x:..., y:...} o [x, y] -> x=0, y=1
    const esArray3 = Array.isArray(trazo[0]) && trazo[0].length === 3;
    const esArray2 = Array.isArray(trazo[0]) && trazo[0].length === 2;
    
    trazo.forEach((pt, i) => {
        let x, y;
        if (esArray3) { x = pt[1]; y = pt[2]; }
        else if (esArray2) { x = pt[0]; y = pt[1]; }
        else { x = pt.x || pt.e; y = pt.y || pt.n; } // Soporte objetos viejos

        if (i === 0) ctx.moveTo(toX(x), toY(y)); 
        else ctx.lineTo(toX(x), toY(y));
    });
    ctx.stroke();

    // 5. PUNTO ROJO DE SEGUIMIENTO (Corregido)
    if (appState.secciones && appState.secciones.length > 0) {
        const secActual = appState.secciones[appState.currentIdx];
        const mActual = secActual.k || secActual.km || 0;
        
        let pRef = null;

        // A. Intentar buscar por PK exacto si tenemos data [k, x, y]
        if (esArray3) {
            // Buscamos el punto con el K más cercano
            pRef = trazo.reduce((prev, curr) => {
                return (Math.abs(curr[0] - mActual) < Math.abs(prev[0] - mActual) ? curr : prev);
            });
            // Si encontramos uno cercano (menos de 10m de error), lo usamos
            if (pRef && Math.abs(pRef[0] - mActual) < 10) {
                pRef = { x: pRef[1], y: pRef[2] };
            } else {
                pRef = null;
            }
        }

        // B. Si falló A, intentamos con los "Hitos" (si existen)
        if (!pRef && appState.planta.planta_hitos) {
            const hito = appState.planta.planta_hitos.find(h => Math.abs(h.k - mActual) < 2);
            if (hito) pRef = { x: hito.x, y: hito.y };
        }

        // C. DIBUJAR PUNTO
        if (pRef) {
            ctx.fillStyle = colorPunto; // Rojo
            ctx.beginPath();
            ctx.arc(toX(pRef.x), toY(pRef.y), 6 / cam.zoom, 0, Math.PI * 2);
            ctx.fill();
            
            // Texto del PK
            ctx.fillStyle = colorTxtPK;
            ctx.font = `bold ${(12 * escalaTxt) / cam.zoom}px Arial`;
            ctx.fillText(`PK ${mActual.toFixed(2)}`, toX(pRef.x) + 10 / cam.zoom, toY(pRef.y));
        }
    }
    ctx.restore();
}