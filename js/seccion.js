function dibujarSeccion(seccion) {
    const canvas = document.getElementById('visorCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const isLight = appConfig.general.theme === 'light';
    const escalaTxt = appConfig.general.textScale || 1.0;

    const colorGrillaSec = isLight ? "#e0e0e0" : "#222";
    const colorGrillaEje = isLight ? "rgba(0,123,255,0.4)" : "rgba(0, 251, 255, 0.4)";
    const colorTexto     = isLight ? "#666" : "#666";
    const colorTextoEje  = isLight ? "#0056b3" : "#00fbff";
    const colorTerreno   = "#8b4513";
    const colorCorredor  = isLight ? "#007bff" : "#00fbff";
    const colorCursor    = isLight ? "#007bff" : "#00fbff";
    const colorCursorStroke = isLight ? "#fff" : "white";

    const rect = canvas.parentNode.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    if (!seccion) return;

    // Calcular límites locales
    let minX = -10, maxX = 10, minY = 9999, maxY = -9999;
    
    // Función helper para escanear arrays planos [x,y,x,y...]
    const escanear = (listas) => {
        if (!listas) return;
        listas.forEach(obj => {
            const arr = Array.isArray(obj) ? obj : (obj.p || []);
            for (let i = 0; i < arr.length; i += 2) {
                const x = arr[i], y = arr[i+1];
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
            }
        });
    };
    escanear(seccion.t);
    escanear(seccion.c);

    if (minY > maxY) { minY = 0; maxY = 10; }

    const rangeX = (maxX - minX) * 1.4;
    const rangeY = (maxY - minY) * 1.4;
    const scale = Math.min(W / rangeX, H / rangeY);
    const centroX = (minX + maxX) / 2;
    const centroY = (minY + maxY) / 2;

    const toX = (v) => (W / 2) + (v - centroX) * scale;
    const toY = (v) => (H / 2) - (v - centroY) * scale;

    ctx.save();
    const cam = appState.cameras.seccion;
    ctx.translate(cam.x, cam.y);
    ctx.scale(cam.zoom, cam.zoom);

    // --- GRILLA DESDE APPCONFIG (CORREGIDO) ---
    // Antes leía document.getElementById('inpGridX'), ¡eso estaba mal!
    let gStepX = appConfig.seccion.gridX || 5;
    let gStepY = appConfig.seccion.gridY || 5;
    if (gStepX <= 0) gStepX = 5; if (gStepY <= 0) gStepY = 5;

    ctx.font = `${(12 * escalaTxt) / cam.zoom}px Arial`;
    const yTextoFijo = (H - cam.y - 20) / cam.zoom;
    const xTextoFijo = (10 - cam.x) / cam.zoom;

    // Vertical
    const startX = Math.floor((centroX - (W/scale)) / gStepX) * gStepX;
    const endX = startX + (W*2/scale);
    for (let x = startX; x <= endX; x += gStepX) {
        let sx = toX(x);
        const esEje = Math.abs(x) < 0.01;
        ctx.strokeStyle = esEje ? colorGrillaEje : colorGrillaSec; 
        ctx.lineWidth = (esEje ? 2 : 1) / cam.zoom;
        ctx.beginPath(); ctx.moveTo(sx, -5000); ctx.lineTo(sx, 5000); ctx.stroke();
        ctx.fillStyle = esEje ? colorTextoEje : colorTexto;
        ctx.textAlign = "center";
        ctx.fillText(x.toFixed(1), sx, yTextoFijo);
    }

    // Horizontal
    const startY = Math.floor((centroY - (H/scale)) / gStepY) * gStepY;
    const endY = startY + (H*2/scale);
    for (let y = startY; y <= endY; y += gStepY) {
        let sy = toY(y);
        ctx.strokeStyle = colorGrillaSec; 
        ctx.lineWidth = 1 / cam.zoom;
        ctx.beginPath(); ctx.moveTo(-5000, sy); ctx.lineTo(5000, sy); ctx.stroke();
        ctx.fillStyle = colorTexto;       
        ctx.textAlign = "left";
        ctx.fillText(y.toFixed(1), xTextoFijo, sy);
    }

    // DIBUJAR CAPAS
    // Terreno (t) - Array de objetos o arrays planos
    if (seccion.t) {
        ctx.strokeStyle = colorTerreno;
        ctx.lineWidth = 2 / cam.zoom;
        seccion.t.forEach(obj => {
            const arr = Array.isArray(obj) ? obj : (obj.p || []);
            dibujarPolyFlat(ctx, arr, toX, toY);
        });
    }
    // Corredor (c)
    if (seccion.c) {
        ctx.strokeStyle = colorCorredor;
        ctx.lineWidth = 1.5 / cam.zoom;
        seccion.c.forEach(obj => {
            const arr = Array.isArray(obj) ? obj : (obj.p || []);
            dibujarPolyFlat(ctx, arr, toX, toY);
        });
    }

    // MIRA
    if (appState.lastClick) {
        const px = appState.lastClick.x; const py = appState.lastClick.y;
        ctx.save();
        ctx.shadowBlur = 15 / cam.zoom; ctx.shadowColor = colorCursor;
        ctx.fillStyle = colorCursor; ctx.beginPath(); ctx.arc(px, py, 4 / cam.zoom, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = colorCursorStroke; ctx.lineWidth = 1.5 / cam.zoom;
        const size = 10 / cam.zoom;
        ctx.beginPath(); ctx.moveTo(px - size, py); ctx.lineTo(px + size, py); ctx.moveTo(px, py - size); ctx.lineTo(px, py + size); ctx.stroke();
        ctx.restore();
    }
    ctx.restore();
}

function dibujarPolyFlat(ctx, arr, toX, toY) {
    if (arr.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(toX(arr[0]), toY(arr[1]));
    for (let i = 2; i < arr.length; i += 2) {
        ctx.lineTo(toX(arr[i]), toY(arr[i+1]));
    }
    ctx.stroke();
}