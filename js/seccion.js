// js/seccion.js

function dibujarSeccion(seccion) {
    const canvas = document.getElementById('visorCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // CONFIGURACIÓN DE ESTILOS UNIFICADA
    const isLight = appConfig.general.theme === 'light';
    const escalaTxt = appConfig.general.textScale || 1.0;

    const colorGrillaSec = isLight ? "#e0e0e0" : "#222";
    const colorGrillaEje = isLight ? "rgba(0,123,255,0.4)" : "rgba(0, 251, 255, 0.4)";
    const colorTexto     = isLight ? "#666" : "#888"; // Unificado
    const colorTextoEje  = isLight ? "#0056b3" : "#00fbff";
    const colorTerreno   = "#8b4513";
    const colorCorredor  = isLight ? "#007bff" : "#00fbff";
    const colorCursor    = isLight ? "#007bff" : "#00fbff";
    const colorCursorStroke = isLight ? "#fff" : "white";

    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    if (!seccion) return;

    // 1. CÁLCULO DE LÍMITES
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
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

    if (minY > maxY) { minY = 0; maxY = 10; minX = -10; maxX = 10; }

    const rangeX = (maxX - minX) * 1.4;
    const rangeY = (maxY - minY) * 1.4;
    const scale = Math.min(W / rangeX, H / rangeY);
    
    const centroX = (minX + maxX) / 2;
    const centroY = (minY + maxY) / 2;

    const marginX = (W - (maxX - minX) * scale) / 2;
    const marginY = (H - (maxY - minY) * scale) / 2; // Centrado vertical

    // GUARDAR TRANSFORMACIÓN PARA HUD (CRÍTICO)
    appState.transform = { minX, minY, scale, mx: marginX, my: marginY };

    const toX = (v) => marginX + (v - minX) * scale;
    const toY = (v) => H - (marginY + (v - minY) * scale);

    ctx.save();
    const cam = appState.cameras.seccion;
    ctx.translate(cam.x, cam.y);
    ctx.scale(cam.zoom, cam.zoom);

    // 2. GRILLA (4 LADOS)
    let gX = appConfig.seccion.gridX || 5;
    let gY = appConfig.seccion.gridY || 5;
    if (gX <= 0) gX = 5; if (gY <= 0) gY = 5;

    ctx.font = `${(11 * escalaTxt) / cam.zoom}px monospace`;
    
    // Posiciones fijas de los textos (Espejo)
    const yAbajo = (H - cam.y - 15) / cam.zoom;
    const yArriba = (15 - cam.y) / cam.zoom;
    const xIzq = (10 - cam.x) / cam.zoom;
    const xDerecha = (W - cam.x - 40) / cam.zoom; // 40px margen derecho

    // Verticales (X)
    const sX = Math.floor((centroX - (W/scale)/cam.zoom) / gX) * gX;
    const eX = sX + (W*2/scale)/cam.zoom;
    
    for (let x = sX; x <= eX; x += gX) {
        let sx = toX(x);
        const esEje = Math.abs(x) < 0.01;
        ctx.strokeStyle = esEje ? colorGrillaEje : colorGrillaSec; 
        ctx.lineWidth = (esEje ? 2 : 1) / cam.zoom;
        
        ctx.beginPath(); ctx.moveTo(sx, -50000); ctx.lineTo(sx, 50000); ctx.stroke();
        
        ctx.fillStyle = esEje ? colorTextoEje : colorTexto;
        ctx.textAlign = "center";
        ctx.fillText(x.toFixed(1), sx, yAbajo);  // Abajo
        ctx.fillText(x.toFixed(1), sx, yArriba); // Arriba
    }

    // Horizontales (Y)
    const sY = Math.floor((centroY - (H/scale)/cam.zoom) / gY) * gY;
    const eY = sY + (H*2/scale)/cam.zoom;

    for (let y = sY; y <= eY; y += gY) {
        let sy = toY(y);
        ctx.strokeStyle = colorGrillaSec; 
        ctx.lineWidth = 1 / cam.zoom;
        
        ctx.beginPath(); ctx.moveTo(-50000, sy); ctx.lineTo(50000, sy); ctx.stroke();
        
        ctx.fillStyle = colorTexto;       
        ctx.textAlign = "left";
        ctx.fillText(y.toFixed(1), xIzq, sy); // Izquierda
        
        ctx.textAlign = "right";
        ctx.fillText(y.toFixed(1), xDerecha, sy); // Derecha
    }

    // 3. DIBUJAR CAPAS
    if (seccion.t) {
        ctx.strokeStyle = colorTerreno; ctx.lineWidth = 2 / cam.zoom;
        seccion.t.forEach(obj => dibujarPolyFlat(ctx, Array.isArray(obj) ? obj : obj.p, toX, toY));
    }
    if (seccion.c) {
        ctx.strokeStyle = colorCorredor; ctx.lineWidth = 1.5 / cam.zoom;
        seccion.c.forEach(obj => dibujarPolyFlat(ctx, Array.isArray(obj) ? obj : obj.p, toX, toY));
    }

    // 4. MIRA (CROSSHAIR)
    if (appState.lastClick) {
        const px = appState.lastClick.x; const py = appState.lastClick.y;
        ctx.save();
        ctx.shadowBlur = 10 / cam.zoom; ctx.shadowColor = colorCursor;
        ctx.fillStyle = colorCursor; ctx.beginPath(); ctx.arc(px, py, 4 / cam.zoom, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = colorCursorStroke; ctx.lineWidth = 1.5 / cam.zoom;
        const s = 10 / cam.zoom;
        ctx.beginPath(); ctx.moveTo(px-s, py); ctx.lineTo(px+s, py); ctx.moveTo(px, py-s); ctx.lineTo(px, py+s); ctx.stroke();
        ctx.restore();
    }
    ctx.restore();
}

function dibujarPolyFlat(ctx, arr, toX, toY) {
    if (!arr || arr.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(toX(arr[0]), toY(arr[1]));
    for (let i = 2; i < arr.length; i += 2) {
        ctx.lineTo(toX(arr[i]), toY(arr[i+1]));
    }
    ctx.stroke();
}