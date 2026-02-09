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

    // GRILLA INTELIGENTE
    const dashboard = document.getElementById('main-dashboard');
    const esModoMini = dashboard && dashboard.classList.contains('layout-multi');

    let gStepK = esModoMini ? (appConfig.perfil.gridKMulti || 1000) : (appConfig.perfil.gridK || 100);
    let gStepZ = esModoMini ? (appConfig.perfil.gridZMulti || 50) : (appConfig.perfil.gridZ || 5);
    
    if (gStepK <= 0) gStepK = 100;
    if (gStepZ <= 0) gStepZ = 5;
    
    ctx.lineWidth = 1 / cam.zoom;
    ctx.font = `${(11 * escalaTxt) / cam.zoom}px monospace`;
    ctx.fillStyle = colorTexto; 

    const yTextoFijo = (H - cam.y - 30) / cam.zoom; 
    const xTextoFijo = (10 - cam.x) / cam.zoom;

    // Vertical
    const sK = Math.floor(minK / gStepK) * gStepK;
    for (let k = sK; k <= maxK; k += gStepK) {
        let sx = toX(k);
        ctx.strokeStyle = colorGrilla; 
        ctx.beginPath(); ctx.moveTo(sx, -50000); ctx.lineTo(sx, 50000); ctx.stroke();
        ctx.textAlign = "center";
        ctx.fillText(k.toFixed(0), sx, yTextoFijo);
    }
    
    // Horizontal
    const sZ = Math.floor(minZ / gStepZ) * gStepZ;
    for (let z = sZ; z <= maxZ; z += gStepZ) {
        let sy = toY(z);
        ctx.strokeStyle = colorGrilla; 
        ctx.beginPath(); ctx.moveTo(-50000, sy); ctx.lineTo(50000, sy); ctx.stroke();
        ctx.textAlign = "left";
        ctx.fillText(z.toFixed(1), xTextoFijo, sy - 2 / cam.zoom);
    }

    // PERFILES (Iterar Array de Objetos)
    appState.perfil.forEach(p => {
        ctx.beginPath();
        // Detección simple de tipo por nombre (o podrías exportar 'tipo' en el JSON)
        // Si no hay tipo explícito, asumimos Terreno si tiene "TN" o "Surface" en el nombre
        const esTerreno = (p.tipo && p.tipo.includes("Surface")) || (p.nombre && (p.nombre.includes("TN") || p.nombre.includes("Surface")));
        ctx.strokeStyle = esTerreno ? colorTerreno : colorRasante;
        
        ctx.lineWidth = (esTerreno ? 1.5 : 2.5) / cam.zoom;
        
        if (p.data) {
            p.data.forEach((pt, i) => {
                const k = pt[0], z = pt[1];
                if (i === 0) ctx.moveTo(toX(k), toY(z));
                else ctx.lineTo(toX(k), toY(z));
            });
        }
        ctx.stroke();
    });

    // PUNTO ROJO
    if (appState.secciones && appState.secciones.length > 0) {
        const pkActual = appState.secciones[appState.currentIdx].k;
        const xPos = toX(pkActual);

        ctx.setLineDash([5, 5]); ctx.strokeStyle = "rgba(255, 0, 0, 0.5)"; ctx.lineWidth = 1 / cam.zoom;
        ctx.beginPath(); ctx.moveTo(xPos, -5000); ctx.lineTo(xPos, 5000); ctx.stroke();
        ctx.setLineDash([]);

        const target = appConfig.perfil.target || 'all';

        appState.perfil.forEach(p => {
            const esTerreno = (p.tipo && p.tipo.includes("Surface"));
            if (target === 'rasante' && esTerreno) return;
            if (target === 'terreno' && !esTerreno) return;

            if (p.data) {
                // Buscar punto cercano
                const pt = p.data.find(d => Math.abs(d[0] - pkActual) < 5); 
                if (pt) {
                    ctx.fillStyle = "red";
                    ctx.beginPath(); ctx.arc(toX(pt[0]), toY(pt[1]), 6 / cam.zoom, 0, Math.PI * 2); ctx.fill();
                    
                    ctx.fillStyle = colorTxtPto; 
                    ctx.font = `bold ${(11 * escalaTxt) / cam.zoom}px Arial`;
                    ctx.textAlign = "left";
                    ctx.fillText(`Z: ${pt[1].toFixed(2)}`, toX(pt[0]) + 8 / cam.zoom, toY(pt[1]) - 8 / cam.zoom);
                }
            }
        });
    }
    ctx.restore();
}