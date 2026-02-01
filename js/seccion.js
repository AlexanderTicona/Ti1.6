// js/seccion.js
function dibujarSeccion(seccion) {
    const canvas = document.getElementById('visorCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // 1. Sincronizar resolución (Mantenido tal cual)
    const rect = canvas.parentNode.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    if (!seccion) return;

    // 2. Lógica de análisis de puntos (Restaurada al 100%)
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
    
    // Si no hay datos, valores por defecto (Mantenido)
    if (minX === Infinity) { minX = -20; maxX = 20; minY = 2900; maxY = 2920; }

    // 3. Uso de límites globales para la grilla fija (Tu requerimiento nuevo)
    // Usamos los del estado si existen, si no, los de la sección actual
    const gMinX = appState.limitesGlobales?.seccion?.minX || -100;
    const gMaxX = appState.limitesGlobales?.seccion?.maxX || 100;
    const gMinY = appState.limitesGlobales?.seccion?.minY || minY;
    const gMaxY = appState.limitesGlobales?.seccion?.maxY || maxY;

    // 4. Transformaciones y Escalas (Mantenido con el margen de +40)
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

    // 5. Posiciones HUD (Texto pegado a bordes)
    const yTextoFijo = (H - cam.y - 15) / cam.zoom;
    const xTextoFijo = (10 - cam.x) / cam.zoom;

    const gStepX = parseFloat(document.getElementById('inpGridX').value) || 5;
    const gStepY = parseFloat(document.getElementById('inpGridY').value) || 5;

    ctx.font = `${12 / cam.zoom}px Arial`;

    // 6. GRILLA VERTICAL FIJA (Limitada al sector de la data)
    for (let x = Math.floor(gMinX / gStepX) * gStepX; x <= gMaxX; x += gStepX) {
        let sx = toX(x);
        const esEje = Math.abs(x) < 0.01;
        ctx.strokeStyle = esEje ? "rgba(0, 251, 255, 0.4)" : "#222"; 
        ctx.lineWidth = (esEje ? 2 : 1) / cam.zoom;
        
        ctx.beginPath(); 
        ctx.moveTo(sx, toY(gMinY)); // Solo dibuja hasta el límite de elevación
        ctx.lineTo(sx, toY(gMaxY)); 
        ctx.stroke();
        
        ctx.fillStyle = esEje ? "#00fbff" : "#666";
        ctx.textAlign = "center";
        ctx.fillText(x.toFixed(1), sx, yTextoFijo);
    }

    // 7. GRILLA HORIZONTAL FIJA (Limitada al sector del ancho)
    for (let y = Math.floor(gMinY / gStepY) * gStepY; y <= gMaxY; y += gStepY) {
        let sy = toY(y);
        ctx.strokeStyle = "#222";
        ctx.lineWidth = 1 / cam.zoom;
        ctx.beginPath(); 
        ctx.moveTo(toX(gMinX), sy); // Solo dibuja hasta el límite del ancho
        ctx.lineTo(toX(gMaxX), sy); 
        ctx.stroke();
        
        ctx.fillStyle = "#666";
        ctx.textAlign = "left";
        ctx.fillText(y.toFixed(1), xTextoFijo, sy - 2 / cam.zoom);
    }

    // 8. DIBUJAR CAPAS (Tu lógica original de dibujo de líneas)
    if (seccion.t) seccion.t.forEach(capa => dibujarLinea(ctx, capa.p, "#8b4513", 2, toX, toY, cam.zoom));
    if (seccion.c) seccion.c.forEach(pts => dibujarLinea(ctx, pts, "#00fbff", 1.5, toX, toY, cam.zoom));

    // 9. MIRA DE SELECCIÓN
    if (appState.lastClick) {
        const px = toX(appState.lastClick.x), py = toY(appState.lastClick.y);
        ctx.strokeStyle = "#bbff00"; ctx.lineWidth = 2 / cam.zoom;
        const size = 10 / cam.zoom;
        ctx.beginPath(); ctx.moveTo(px-size, py); ctx.lineTo(px+size, py);
        ctx.moveTo(px, py-size); ctx.lineTo(px, py+size); ctx.stroke();
        ctx.fillStyle = "#bbff00"; ctx.beginPath(); ctx.arc(px, py, 3/cam.zoom, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
}

// Función auxiliar de dibujo de líneas (Mantenida idéntica)
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