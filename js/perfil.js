function dibujarPerfil() {
    const canvas = document.getElementById('canvasPerfil');
    if (!canvas || !appState.perfil) return;
    const ctx = canvas.getContext('2d');
    
    const isLight = appConfig.general.theme === 'light';
    const escalaTxt = appConfig.general.textScale || 1.0;

    const colorGrilla = isLight ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.05)";
    const colorTexto  = isLight ? "#444" : "rgba(255, 255, 255, 0.4)";
    const colorTerreno= isLight ? "#2e7d32" : "#4CAF50"; 
    const colorRasante= isLight ? "#0056b3" : "#00fbff"; 
    const colorTxtPto = isLight ? "#000" : "white";      

    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const { minK, maxK, minZ, maxZ } = appState.encuadre.perfil;
    const { minK: gMinK, maxK: gMaxK, minZ: gMinZ, maxZ: gMaxZ } = appState.limitesGlobales.perfil;
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

    // --- GRILLA INTELIGENTE ---
    // 1. Detectar modo Mini
    const dashboard = document.getElementById('main-dashboard');
    const esModoMini = dashboard && dashboard.classList.contains('layout-multi');

    // 2. Seleccionar intervalo (PK)
    let gStepK = esModoMini 
        ? (appConfig.perfil.gridKMulti || 1000) 
        : (appConfig.perfil.gridK || 100);

    // 3. Seleccionar intervalo (Cota)
    let gStepZ = esModoMini 
        ? (appConfig.perfil.gridZMulti || 50) 
        : (appConfig.perfil.gridZ || 5);
    
    if (gStepK <= 0) gStepK = 100;
    if (gStepZ <= 0) gStepZ = 5;
    
    ctx.lineWidth = 1 / cam.zoom;
    ctx.font = `${(11 * escalaTxt) / cam.zoom}px monospace`;
    ctx.fillStyle = colorTexto; 

    const yTextoFijo = (H - cam.y - 30) / cam.zoom; 
    const xTextoFijo = (10 - cam.x) / cam.zoom;

    // Dibujo Vertical (PKs)
    for (let k = Math.ceil(gMinK / gStepK) * gStepK; k <= gMaxK; k += gStepK) {
        let sx = toX(k);
        ctx.strokeStyle = colorGrilla; 
        ctx.beginPath(); ctx.moveTo(sx, toY(gMinZ)); ctx.lineTo(sx, toY(gMaxZ)); ctx.stroke();
        ctx.textAlign = "center";
        ctx.fillText(k.toFixed(0), sx, yTextoFijo);
    }
    
    // Dibujo Horizontal (Cotas)
    for (let z = Math.ceil(gMinZ / gStepZ) * gStepZ; z <= gMaxZ; z += gStepZ) {
        let sy = toY(z);
        ctx.strokeStyle = colorGrilla; 
        ctx.beginPath(); ctx.moveTo(toX(gMinK), sy); ctx.lineTo(toX(gMaxK), sy); ctx.stroke();
        ctx.textAlign = "left";
        ctx.fillText(z.toFixed(1), xTextoFijo, sy - 2 / cam.zoom);
    }

    // --- PERFILES ---
    Object.values(appState.perfil.perfiles).forEach(p => {
        ctx.beginPath();
        ctx.strokeStyle = p.tipo.includes("Surface") ? colorTerreno : colorRasante;
        ctx.lineWidth = (p.tipo.includes("Surface") ? 1.5 : 2.5) / cam.zoom;
        p.datos.forEach((pt, i) => {
            if (i === 0) ctx.moveTo(toX(pt.k), toY(pt.z));
            else ctx.lineTo(toX(pt.k), toY(pt.z));
        });
        ctx.stroke();
    });

    // --- PUNTO ROJO ---
    if (appState.secciones && appState.secciones.length > 0) {
        const pkActual = appState.secciones[appState.currentIdx].k;
        const xPos = toX(pkActual);

        ctx.setLineDash([5, 5]); ctx.strokeStyle = "rgba(255, 0, 0, 0.5)"; ctx.lineWidth = 1 / cam.zoom;
        ctx.beginPath(); ctx.moveTo(xPos, toY(gMinZ)); ctx.lineTo(xPos, toY(gMaxZ)); ctx.stroke();
        ctx.setLineDash([]);

        // Lógica de "Target" (Qué puntos mostrar)
        const target = appConfig.perfil.target || 'all';

        Object.values(appState.perfil.perfiles).forEach(p => {
            // Filtrar si el usuario pidió solo Rasante o solo Terreno
            const esTerreno = p.tipo.includes("Surface");
            if (target === 'rasante' && esTerreno) return;
            if (target === 'terreno' && !esTerreno) return;

            const pt = p.datos.find(d => Math.abs(d.k - pkActual) < 5); 
            if (pt) {
                ctx.fillStyle = "red";
                ctx.beginPath(); ctx.arc(toX(pt.k), toY(pt.z), 6 / cam.zoom, 0, Math.PI * 2); ctx.fill();
                
                ctx.fillStyle = colorTxtPto; 
                ctx.font = `bold ${(11 * escalaTxt) / cam.zoom}px Arial`;
                ctx.textAlign = "left";
                ctx.fillText(`Z: ${pt.z.toFixed(2)}`, toX(pt.k) + 8 / cam.zoom, toY(pt.z) - 8 / cam.zoom);
            }
        });
    }
    ctx.restore();
}