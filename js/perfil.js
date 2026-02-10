function dibujarPerfil() {
    const canvas = document.getElementById('canvasPerfil');
    if (!canvas || !appState.perfil) return;
    const ctx = canvas.getContext('2d');
    
    // --- ESTILOS GENERALES ---
    const isLight = appConfig.general.theme === 'light';
    const escalaTxt = appConfig.general.textScale || 1.0;

    // Grilla Unificada (Gris)
    const colorGrilla = isLight ? "#e0e0e0" : "#222";
    const colorTexto  = isLight ? "#666" : "#888";
    const colorTxtPto = isLight ? "#000" : "white";      

    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const { minK, maxK, minZ, maxZ } = appState.encuadre.perfil;
    const centroK = (minK + maxK) / 2;
    const centroZ = (minZ + maxZ) / 2;

    const exajVertical = appConfig.perfil.exaj || 10; 

    const rangeK = maxK - minK;
    const rangeZ = (maxZ - minZ) * exajVertical;
    const scale = Math.min(W / (rangeK * 1.1), H / (rangeZ * 1.1)); 

    const toX = (k) => (W / 2) + (k - centroK) * scale;
    const toY = (z) => (H / 2) - (z - centroZ) * exajVertical * scale;

    ctx.save();
    const cam = appState.cameras.perfil;
    ctx.translate(cam.x, cam.y);
    ctx.scale(cam.zoom, cam.zoom);

    // --- GRILLA UNIFORME CON COLCHÓN (GAP) ---
    const dashboard = document.getElementById('main-dashboard');
    const esModoMini = dashboard && dashboard.classList.contains('layout-multi');

    let gStepK = esModoMini ? (appConfig.perfil.gridKMulti || 1000) : (appConfig.perfil.gridK || 100);
    let gStepZ = esModoMini ? (appConfig.perfil.gridZMulti || 50) : (appConfig.perfil.gridZ || 5);
    
    if (gStepK <= 0) gStepK = 100;
    if (gStepZ <= 0) gStepZ = 5;
    
    ctx.lineWidth = 1 / cam.zoom;
    ctx.font = `${(11 * escalaTxt) / cam.zoom}px monospace`;
    ctx.strokeStyle = colorGrilla; 
    
    const yAbajo = (H - cam.y - 30) / cam.zoom; 
    const yArriba = (15 - cam.y) / cam.zoom;
    const xIzq = (10 - cam.x) / cam.zoom;
    const xDerecha = (W - cam.x - 50) / cam.zoom;

    // --- AQUÍ ESTÁ EL TRUCO DEL GAP ---
    const lineasExtra = 5; // <--- Cambia este número: 5 líneas más de margen
    const gapK = gStepK * lineasExtra; // Ej: 500m extra a cada lado
    const gapZ = gStepZ * lineasExtra; // Ej: 25m extra arriba y abajo

    // 1. Vertical (PK) - Con Gap
    // Empezamos antes del mínimo y terminamos después del máximo
    const startK = Math.floor((minK - gapK) / gStepK) * gStepK;
    const endK   = maxK + gapK;

    for (let k = startK; k <= endK; k += gStepK) {
        let sx = toX(k);
        // Dibujamos líneas muy largas verticales para cubrir el gap de altura
        ctx.beginPath(); ctx.moveTo(sx, -50000); ctx.lineTo(sx, 50000); ctx.stroke();
        
        ctx.fillStyle = colorTexto;
        ctx.textAlign = "center";
        ctx.fillText(k.toFixed(0), sx, yAbajo);
        ctx.fillText(k.toFixed(0), sx, yArriba);
    }
    
    // 2. Horizontal (Cota) - Con Gap
    // Empezamos más abajo del mínimo y terminamos más arriba del máximo
    const startZ = Math.floor((minZ - gapZ) / gStepZ) * gStepZ;
    const endZ   = maxZ + gapZ;

    for (let z = startZ; z <= endZ; z += gStepZ) {
        let sy = toY(z);
        // Dibujamos líneas muy largas horizontales para cubrir el gap de ancho
        ctx.beginPath(); ctx.moveTo(-50000, sy); ctx.lineTo(50000, sy); ctx.stroke();
        
        ctx.fillStyle = colorTexto;
        ctx.textAlign = "left";
        ctx.fillText(z.toFixed(1), xIzq, sy - 2 / cam.zoom);
        ctx.textAlign = "right";
        ctx.fillText(z.toFixed(1), xDerecha, sy - 2 / cam.zoom);
    }

    // --- DIBUJAR PERFILES (CON GESTOR DE CAPAS) ---
    // Usamos appConfig.layers.perfil para obtener colores y visibilidad
    appState.perfil.forEach((p, idx) => {
        const nombre = p.nombre || `Perfil ${idx+1}`;
        
        // Buscar estilo en la configuración (si existe)
        // Si no existe (caso raro de carga asíncrona), usa fallback
        const style = (appConfig.layers && appConfig.layers.perfil && appConfig.layers.perfil[nombre])
                      ? appConfig.layers.perfil[nombre]
                      : { visible: true, color: '#fff', width: 2 };

        // Si la capa está apagada, saltamos
        if (!style.visible) return;

        ctx.beginPath();
        ctx.strokeStyle = style.color;
        ctx.lineWidth = style.width / cam.zoom;
        
        if (p.data) {
            p.data.forEach((pt, i) => {
                const k = pt[0], z = pt[1];
                if (i === 0) ctx.moveTo(toX(k), toY(z));
                else ctx.lineTo(toX(k), toY(z));
            });
        }
        ctx.stroke();
    });

    // --- PUNTO ROJO (RASTREO INTELIGENTE) ---
    if (appState.secciones && appState.secciones.length > 0) {
        const pkActual = appState.secciones[appState.currentIdx].k;
        const xPos = toX(pkActual);

        // Línea guía vertical
        ctx.setLineDash([5, 5]); ctx.strokeStyle = "rgba(255, 0, 0, 0.5)"; ctx.lineWidth = 1 / cam.zoom;
        ctx.beginPath(); ctx.moveTo(xPos, -5000); ctx.lineTo(xPos, 5000); ctx.stroke();
        ctx.setLineDash([]);

        // Configuración de Rastreo
        const targetName = appConfig.perfil.target || 'auto';
        let foundAuto = false; // Flag para rastrear solo UNO si es auto

        appState.perfil.forEach((p, idx) => {
            const nombre = p.nombre || `Perfil ${idx+1}`;
            
            // Si el modo es específico y el nombre no coincide, saltar
            if (targetName !== 'auto' && nombre !== targetName) return;

            // Si el modo es Auto y ya encontramos uno, saltar (para no llenar de puntos)
            if (targetName === 'auto' && foundAuto) return;

            // Verificar si la capa es visible (no rastrear capas ocultas)
            const style = (appConfig.layers && appConfig.layers.perfil && appConfig.layers.perfil[nombre]);
            if (style && !style.visible) return;

            if (p.data) {
                // Buscar punto cercano (umbral 2 metros)
                const pt = p.data.find(d => Math.abs(d[0] - pkActual) < 2); 
                if (pt) {
                    // Dibujar Punto
                    ctx.fillStyle = isLight ? "#ff00dd" : "#fbff00";
                    ctx.beginPath(); ctx.arc(toX(pt[0]), toY(pt[1]), 6 / cam.zoom, 0, Math.PI * 2); ctx.fill();
                    
                    // Texto Cota
                    ctx.fillStyle = colorTxtPto; 
                    ctx.font = `bold ${(12 * escalaTxt) / cam.zoom}px Arial`;
                    ctx.textAlign = "left";
                    ctx.fillText(`Z: ${pt[1].toFixed(2)}`, toX(pt[0]) + 8 / cam.zoom, toY(pt[1]) - 8 / cam.zoom);
                    
                    if (targetName === 'auto') foundAuto = true; // Marcar que ya rastreamos uno
                }
            }
        });
    }
    ctx.restore();
}