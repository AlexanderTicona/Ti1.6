function dibujarSeccion(seccion) {
    const canvas = document.getElementById('visorCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // --- ESTILOS ---
    const isLight = appConfig.general.theme === 'light';
    const escalaTxt = appConfig.general.textScale || 1.0;

    const colorGrillaSec = isLight ? "#e0e0e0" : "#222";
    const colorGrillaEje = isLight ? "rgba(0,123,255,0.4)" : "rgba(0, 251, 255, 0.4)";
    const colorTexto     = isLight ? "#666" : "#888"; 
    const colorTextoEje  = isLight ? "#0056b3" : "#00fbff";
    const colorCursor    = isLight ? "#007bff" : "#00fbff";
    const colorCursorStroke = isLight ? "#fff" : "white";

    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    if (!seccion) return;

    // 1. CÁLCULO DE LÍMITES Y ESCALAS
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
    escanear(seccion.t); escanear(seccion.c);

    if (minY > maxY) { minY = 0; maxY = 10; minX = -10; maxX = 10; }

    const rangeX = (maxX - minX) * 1.4;
    const rangeY = (maxY - minY) * 1.4;
    const scale = Math.min(W / rangeX, H / rangeY);
    const marginX = (W - (maxX - minX) * scale) / 2;
    const marginY = (H - (maxY - minY) * scale) / 2; 

    appState.transform = { minX, minY, scale, mx: marginX, my: marginY };

    const toX = (v) => marginX + (v - minX) * scale;
    const toY = (v) => H - (marginY + (v - minY) * scale);

    const cam = appState.cameras.seccion;

    // ============================================================
    // FASE 1: DIBUJO EN EL MUNDO (Líneas que se mueven con zoom)
    // ============================================================
    ctx.save();
    ctx.translate(cam.x, cam.y);
    ctx.scale(cam.zoom, cam.zoom);

    // Grilla
    let gX = appConfig.seccion.gridX || 5; if (gX <= 0) gX = 5;
    let gY = appConfig.seccion.gridY || 5; if (gY <= 0) gY = 5;

    const centroX = (minX + maxX) / 2;
    const centroY = (minY + maxY) / 2;

    // Calcular límites de grilla visibles (aprox) para no dibujar infinito
    const sX = Math.floor((centroX - (W/scale)/cam.zoom) / gX) * gX;
    const eX = sX + (W*2/scale)/cam.zoom;
    const sY = Math.floor((centroY - (H/scale)/cam.zoom) / gY) * gY;
    const eY = sY + (H*2/scale)/cam.zoom;

    // Dibujar Líneas Verticales
    for (let x = sX; x <= eX; x += gX) {
        let sx = toX(x);
        const esEje = Math.abs(x) < 0.01;
        ctx.strokeStyle = esEje ? colorGrillaEje : colorGrillaSec; 
        ctx.lineWidth = (esEje ? 2 : 1) / cam.zoom;
        ctx.beginPath(); ctx.moveTo(sx, -50000); ctx.lineTo(sx, 50000); ctx.stroke();
    }
    // Dibujar Líneas Horizontales
    for (let y = sY; y <= eY; y += gY) {
        let sy = toY(y);
        ctx.strokeStyle = colorGrillaSec; 
        ctx.lineWidth = 1 / cam.zoom;
        ctx.beginPath(); ctx.moveTo(-50000, sy); ctx.lineTo(50000, sy); ctx.stroke();
    }

    // Dibujar Capas (Terreno, Corredor)
    if (appConfig.layers && appConfig.layers.seccion) {
        Object.values(appConfig.layers.seccion).forEach(layer => {
            if (!layer.visible) return;
            ctx.strokeStyle = layer.color;
            ctx.lineWidth = layer.width / cam.zoom;
            if (layer.type === 't' && seccion.t && seccion.t[layer.idx]) {
                const d = seccion.t[layer.idx];
                dibujarPolyFlat(ctx, Array.isArray(d) ? d : d.p, toX, toY);
            } else if (layer.type === 'c' && seccion.c) {
                seccion.c.forEach(obj => dibujarPolyFlat(ctx, Array.isArray(obj) ? obj : obj.p, toX, toY));
            }
        });
    } else {
        // Fallback
        if (seccion.t) { ctx.strokeStyle = "#8b4513"; ctx.lineWidth = 2/cam.zoom; seccion.t.forEach(o => dibujarPolyFlat(ctx, Array.isArray(o)?o:o.p, toX, toY)); }
        if (seccion.c) { ctx.strokeStyle = "#007bff"; ctx.lineWidth = 1.5/cam.zoom; seccion.c.forEach(o => dibujarPolyFlat(ctx, Array.isArray(o)?o:o.p, toX, toY)); }
    }

    // Mira (Crosshair) - Puntos Mundo
    if (appState.lastMarker) {
        const px = toX(appState.lastMarker.x);
        const py = toY(appState.lastMarker.y);
        ctx.fillStyle = colorCursor; 
        ctx.beginPath(); ctx.arc(px, py, 4 / cam.zoom, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = colorCursorStroke; ctx.lineWidth = 1.5 / cam.zoom;
        const s = 10 / cam.zoom;
        ctx.beginPath(); ctx.moveTo(px-s, py); ctx.lineTo(px+s, py); ctx.moveTo(px, py-s); ctx.lineTo(px, py+s); ctx.stroke();
    }

    ctx.restore(); 
    // ============================================================
    // FIN FASE 1: Se cierra la matriz de transformación
    // ============================================================


    // ============================================================
    // FASE 2: DIBUJO HUD (Textos fijos en bordes)
    // ============================================================
    
    // CONFIGURACIÓN DE GAPS (MÁRGENES)
    const gapX = 10; // Margen lateral (izquierda/derecha)
    const gapY = 10; // Margen vertical (arriba/abajo)

    ctx.font = `${11 * escalaTxt}px monospace`; 
    
    // Función auxiliar para proyectar coordenada Mundo -> Pantalla
    const worldToScreenX = (valX) => (toX(valX) * cam.zoom) + cam.x;
    const worldToScreenY = (valY) => (toY(valY) * cam.zoom) + cam.y;

    // 1. Textos Verticales (Desfases X)
    for (let x = sX; x <= eX; x += gX) {
        const screenX = worldToScreenX(x);
        
        // Solo dibujamos si cae dentro de la pantalla (con un poco de margen)
        if (screenX > -20 && screenX < W + 20) {
            const esEje = Math.abs(x) < 0.01;
            ctx.fillStyle = esEje ? colorTextoEje : colorTexto;
            ctx.textAlign = "center";
            
            // Texto Abajo (H - gapY)
            ctx.textBaseline = "bottom"; 
            ctx.fillText(x.toFixed(1), screenX, H - gapY); 

            // Texto Arriba (gapY)
            ctx.textBaseline = "top"; 
            ctx.fillText(x.toFixed(1), screenX, gapY); 
        }
    }

    // 2. Textos Horizontales (Elevaciones Y)
    for (let y = sY; y <= eY; y += gY) {
        const screenY = worldToScreenY(y);
        
        if (screenY > -20 && screenY < H + 20) {
            ctx.fillStyle = colorTexto;
            ctx.textBaseline = "middle";

            // Texto Izquierda (gapX)
            ctx.textAlign = "left"; 
            ctx.fillText(y.toFixed(1), gapX, screenY); 

            // Texto Derecha (W - gapX)
            ctx.textAlign = "right"; 
            ctx.fillText(y.toFixed(1), W - gapX, screenY); 
        }
    }
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