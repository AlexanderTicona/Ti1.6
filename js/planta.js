function dibujarPlanta() {
    const canvas = document.getElementById('canvasPlanta');
    if (!canvas || !appState.planta) return;
    const ctx = canvas.getContext('2d');
    
    // --- CONFIGURACIÓN GENERAL ---
    const isLight = appConfig.general.theme === 'light';
    const escalaTxt = appConfig.general.textScale || 1.0;
    
    // Colores Grilla (Estilo Aprobado)
    const colorGrilla = isLight ? "#e0e0e0" : "#222";       
    const colorTexto  = isLight ? "#666" : "#888";        
    const colorPunto  = isLight ? "#ff00dd" : "#fbff00" 
    const colorTxtPK  = isLight ? "#000000" : "#ffffff"; 

    // Configuración de Ticks (Desde Ajustes)
    // Si no existen (primera carga), usamos valores por defecto
    const verEtiquetas = appConfig.planta.showLabels !== false;
    const intMajor = appConfig.planta.ticksMajor || 1000;
    const intMinor = appConfig.planta.ticksMinor || 100;

    const rect = canvas.parentNode.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // 1. DATOS
    const trazo = appState.planta.planta_trazo || appState.planta.geometria || appState.planta.planta || [];
    const hitos = appState.planta.planta_hitos || [];

    if (!trazo || trazo.length === 0) return;

    // 2. ESCALAS
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

    // 3. GRILLA UNIFORME (4 LADOS) - TU CÓDIGO APROBADO
    const dashboard = document.getElementById('main-dashboard');
    const esModoMini = dashboard && dashboard.classList.contains('layout-multi');
    let gSize = esModoMini ? (appConfig.planta.gridIntervalMulti || 500) : (appConfig.planta.gridInterval || 200);
    if (gSize <= 0) gSize = 100;

    if (appConfig.planta.showGrid !== false) {
        ctx.lineWidth = 1 / cam.zoom;
        ctx.font = `${(11 * escalaTxt) / cam.zoom}px monospace`;
        
        const yAbajo = (H - cam.y - 15) / cam.zoom;
        const yArriba = (15 - cam.y) / cam.zoom;
        const xIzq = (10 - cam.x) / cam.zoom;
        const xDerecha = (W - cam.x - 50) / cam.zoom;

        // Grilla Vertical (Este)
        const startX = Math.floor((centroE - (W/scale)/cam.zoom) / gSize) * gSize;
        const endX = startX + (W*2/scale)/cam.zoom;
        
        ctx.strokeStyle = colorGrilla;
        
        for (let e = startX; e <= endX; e += gSize) {
            let x = toX(e);
            ctx.beginPath(); ctx.moveTo(x, -50000); ctx.lineTo(x, 50000); ctx.stroke();
            
            ctx.fillStyle = colorTexto;
            ctx.textAlign = "center";
            ctx.fillText(e.toFixed(0), x, yAbajo);
            ctx.fillText(e.toFixed(0), x, yArriba);
        }
        
        // Grilla Horizontal (Norte)
        const startY = Math.floor((centroN - (H/scale)/cam.zoom) / gSize) * gSize;
        const endY = startY + (H*2/scale)/cam.zoom;
        
        for (let n = startY; n <= endY; n += gSize) {
            let y = toY(n);
            ctx.beginPath(); ctx.moveTo(-50000, y); ctx.lineTo(50000, y); ctx.stroke();
            
            ctx.fillStyle = colorTexto;
            ctx.textAlign = "left";
            ctx.fillText(n.toFixed(0), xIzq, y);
            ctx.textAlign = "right";
            ctx.fillText(n.toFixed(0), xDerecha, y);
        }
    }

    // 4. ALINEAMIENTO (Con Gestor de Capas y Ticks)
    // Buscamos la capa 'Eje' en la configuración. Si no existe, usamos defaults.
    const layerEje = (appConfig.layers && appConfig.layers.planta && appConfig.layers.planta['Eje']) 
                     ? appConfig.layers.planta['Eje'] 
                     : { visible: true, color: isLight ? "#0056b3" : "#00fbff", width: 2 };

    if (layerEje.visible) {
        // A. DIBUJAR LÍNEA CONTINUA
        ctx.beginPath();
        ctx.strokeStyle = layerEje.color; 
        ctx.lineWidth = layerEje.width / cam.zoom;
        
        // Detectar si tenemos K: [k, x, y] (length 3)
        const esArray3 = Array.isArray(trazo[0]) && trazo[0].length === 3;
        const esArray2 = Array.isArray(trazo[0]) && trazo[0].length === 2;
        
        trazo.forEach((pt, i) => {
            let x, y;
            if (esArray3) { x = pt[1]; y = pt[2]; }
            else if (esArray2) { x = pt[0]; y = pt[1]; }
            else { x = pt.x || pt.e; y = pt.y || pt.n; }

            if (i === 0) ctx.moveTo(toX(x), toY(y)); 
            else ctx.lineTo(toX(x), toY(y));
        });
        ctx.stroke();

        // B. DIBUJAR TICKS (Solo si tenemos dato K)
        if (esArray3) {
            ctx.fillStyle = isLight ? "#000" : "#fff";
            ctx.font = `${(10 * escalaTxt) / cam.zoom}px Arial`;
            const sizeMajor = 8 / cam.zoom;
            const sizeMinor = 4 / cam.zoom;
            
            // NUEVO: Leemos si el usuario quiere ver las rayitas
            const verTicks = appConfig.planta.showTicks !== false; 

            for (let i = 0; i < trazo.length - 1; i++) {
                const p1 = trazo[i];
                const p2 = trazo[i+1];
                const k1 = p1[0];
                const k2 = p2[0];

                if (k2 <= k1) continue;

                // Ticks Mayores
                const nextMajor = Math.ceil(k1 / intMajor) * intMajor;
                if (nextMajor <= k2) {
                    // Pasamos 'verTicks' (true/false) a la función
                    drawTick(ctx, p1, p2, nextMajor, sizeMajor, true, verEtiquetas, verTicks, toX, toY, cam, isLight);
                }

                // Ticks Menores
                let kScan = Math.ceil(k1 / intMinor) * intMinor;
                while (kScan <= k2) {
                    if (kScan % intMajor !== 0) {
                        drawTick(ctx, p1, p2, kScan, sizeMinor, false, false, verTicks, toX, toY, cam, isLight);
                    }
                    kScan += intMinor;
                }
            }
        }
    }

    // 5. PUNTO ROJO DE RASTREO (Igual que antes)
    if (appState.secciones && appState.secciones.length > 0) {
        const secActual = appState.secciones[appState.currentIdx];
        const mActual = secActual.k || secActual.km || 0;
        let pRef = null;

        const esArray3 = Array.isArray(trazo[0]) && trazo[0].length === 3;

        if (esArray3) {
            // Buscamos el punto más cercano en K
            pRef = trazo.reduce((prev, curr) => {
                return (Math.abs(curr[0] - mActual) < Math.abs(prev[0] - mActual) ? curr : prev);
            });
            // Validación de distancia (por si hay saltos)
            if (pRef && Math.abs(pRef[0] - mActual) < 50) {
                pRef = { x: pRef[1], y: pRef[2] };
            } else { pRef = null; }
        }

        // Fallback a Hitos si no encontramos por K
        if (!pRef && hitos.length > 0) {
            const hito = hitos.find(h => Math.abs(h.k - mActual) < 2);
            if (hito) pRef = { x: hito.x, y: hito.y };
        }

        if (pRef) {
            ctx.fillStyle = colorPunto;
            ctx.beginPath(); ctx.arc(toX(pRef.x), toY(pRef.y), 6 / cam.zoom, 0, Math.PI * 2); ctx.fill();
            
            ctx.fillStyle = colorTxtPK;
            ctx.font = `bold ${(12 * escalaTxt) / cam.zoom}px Arial`;
            ctx.textAlign = "left";
            ctx.fillText(`PK ${mActual.toFixed(2)}`, toX(pRef.x) + 10 / cam.zoom, toY(pRef.y));
        }
    }
    ctx.restore();
}

// Función Auxiliar Actualizada (Recibe showLine)
function drawTick(ctx, p1, p2, targetK, size, isMajor, showLabel, showLine, toX, toY, cam, isLight) {
    // 1. Interpolación
    const k1 = p1[0], x1 = p1[1], y1 = p1[2];
    const k2 = p2[0], x2 = p2[1], y2 = p2[2];
    const fraction = (targetK - k1) / (k2 - k1);
    const x = x1 + (x2 - x1) * fraction;
    const y = y1 + (y2 - y1) * fraction;
    
    // 2. Coordenadas
    const sx = toX(x); const sy = toY(y);
    const sx1 = toX(x1); const sy1 = toY(y1);
    const sx2 = toX(x2); const sy2 = toY(y2);

    // 3. Vector
    const dx = sx2 - sx1;
    const dy = sy2 - sy1;
    const len = Math.sqrt(dx*dx + dy*dy);
    if (len === 0) return;

    // 4. Perpendicular
    const px = -dy / len;
    const py = dx / len;

    // 5. Dibujar Tick (SOLO SI showLine ES TRUE)
    if (showLine) {
        ctx.beginPath();
        ctx.strokeStyle = isLight ? "#444" : "#ccc";
        ctx.lineWidth = 1 / cam.zoom;
        ctx.moveTo(sx + px * size, sy + py * size);
        ctx.lineTo(sx - px * size, sy - py * size);
        ctx.stroke();
    }

    // 6. Dibujar Etiqueta
    if (isMajor && showLabel) {
        ctx.fillStyle = isLight ? "#000" : "#fff";
        ctx.save();
        ctx.translate(sx + px * (size + 5/cam.zoom), sy + py * (size + 5/cam.zoom));
        let angle = Math.atan2(dy, dx) - Math.PI/2; 
        if (angle > Math.PI/2 || angle < -Math.PI/2) angle += Math.PI;
        ctx.rotate(angle);
        ctx.textAlign = "center";
        ctx.fillText(targetK.toFixed(0), 0, 0);
        ctx.restore();
    }
}