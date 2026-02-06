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

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const analizar = (pts) => {
        if (!pts || pts.length === 0) return;
        const esPlano = typeof pts[0] === 'number';
        for (let i = 0; i < pts.length; i += (esPlano ? 2 : 1)) {
            const p = esPlano ? { x: pts[i], y: pts[i+1] } : pts[i];
            if (p.y > -500) {
                if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
            }
        }
    };
    if (seccion.t) seccion.t.forEach(capa => analizar(capa.p));
    if (seccion.c) seccion.c.forEach(lista => analizar(lista));
    if (minX === Infinity) { minX = -20; maxX = 20; minY = 2900; maxY = 2920; }

    const gMinX = appState.limitesGlobales?.seccion?.minX || -100;
    const gMaxX = appState.limitesGlobales?.seccion?.maxX || 100;
    const gMinY = appState.limitesGlobales?.seccion?.minY || minY;
    const gMaxY = appState.limitesGlobales?.seccion?.maxY || maxY;

    const finalScale = Math.min(W / ((maxX - minX) * 1.4), H / ((maxY - minY) * 1.4));
    const marginX = (W - (maxX - minX) * finalScale) / 2;
    const marginY = (H - (maxY - minY) * finalScale) / 2 + 40; 
    
    appState.transform = { minX, minY, scale: finalScale, mx: marginX, my: marginY };
    const toX = (v) => marginX + (v - minX) * finalScale;
    const toY = (v) => H - (marginY + (v - minY) * finalScale);

    ctx.save();
    const cam = appState.cameras.seccion;
    ctx.translate(cam.x, cam.y);
    ctx.scale(cam.zoom, cam.zoom);

    let gStepX = appConfig.seccion.gridX || 5;
    let gStepY = appConfig.seccion.gridY || 5;
    if (gStepX <= 0) gStepX = 5; if (gStepY <= 0) gStepY = 5;

    ctx.font = `${(12 * escalaTxt) / cam.zoom}px Arial`;
    const yTextoFijo = (H - cam.y - 20) / cam.zoom;
    const xTextoFijo = (10 - cam.x) / cam.zoom;

    // Grilla Vertical
    for (let x = Math.floor(gMinX / gStepX) * gStepX; x <= gMaxX; x += gStepX) {
        let sx = toX(x);
        const esEje = Math.abs(x) < 0.01;
        ctx.strokeStyle = esEje ? colorGrillaEje : colorGrillaSec; 
        ctx.lineWidth = (esEje ? 2 : 1) / cam.zoom;
        ctx.beginPath(); ctx.moveTo(sx, toY(gMinY)); ctx.lineTo(sx, toY(gMaxY)); ctx.stroke();
        ctx.fillStyle = esEje ? colorTextoEje : colorTexto;
        ctx.textAlign = "center";
        ctx.fillText(x.toFixed(1), sx, yTextoFijo);
    }

    // Grilla Horizontal
    for (let y = Math.floor(gMinY / gStepY) * gStepY; y <= gMaxY; y += gStepY) {
        let sy = toY(y);
        ctx.strokeStyle = colorGrillaSec; 
        ctx.lineWidth = 1 / cam.zoom;
        ctx.beginPath(); ctx.moveTo(toX(gMinX), sy); ctx.lineTo(toX(gMaxX), sy); ctx.stroke();
        ctx.fillStyle = colorTexto;       
        ctx.textAlign = "left";
        ctx.fillText(y.toFixed(1), xTextoFijo, sy - 2 / cam.zoom);
    }

    // CAPAS
    if (seccion.t) seccion.t.forEach(capa => dibujarLinea(ctx, capa.p, colorTerreno, 2, toX, toY, cam.zoom));
    if (seccion.c) seccion.c.forEach(pts => dibujarLinea(ctx, pts, colorCorredor, 1.5, toX, toY, cam.zoom));

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

function dibujarLinea(ctx, pts, color, width, toX, toY, zoom) {
    ctx.strokeStyle = color; ctx.lineWidth = width / zoom;
    ctx.beginPath();
    const esPlano = typeof pts[0] === 'number';
    for (let i = 0; i < pts.length; i += (esPlano ? 2 : 1)) {
        const p = esPlano ? { x: pts[i], y: pts[i+1] } : pts[i];
        i === 0 ? ctx.moveTo(toX(p.x), toY(p.y)) : ctx.lineTo(toX(p.x), toY(p.y));
    }
    ctx.stroke();
}