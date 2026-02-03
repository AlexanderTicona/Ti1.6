// js/perfil.js
function dibujarPerfil() {
    const canvas = document.getElementById('canvasPerfil');
    if (!canvas || !appState.perfil) return;
    const ctx = canvas.getContext('2d');
    
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // 1. OBTENER LÍMITES DE ENCUADRE Y GRILLA
    const { minK, maxK, minZ, maxZ } = appState.encuadre.perfil;
    const { minK: gMinK, maxK: gMaxK, minZ: gMinZ, maxZ: gMaxZ } = appState.limitesGlobales.perfil;
    
    const centroK = (minK + maxK) / 2;
    const centroZ = (minZ + maxZ) / 2;

    // 2. CONFIGURACIÓN DE ESCALA
    const exajVertical = 10; 
    const rangeK = maxK - minK;
    const rangeZ = (maxZ - minZ) * exajVertical;
    const scale = Math.min(W / (rangeK * 1.1), H / (rangeZ * 1.1)); // Ajustado margen a 1.2

    const toX = (k) => (W / 2) + (k - centroK) * scale;
    const toY = (z) => (H / 2) - (z - centroZ) * exajVertical * scale;

    ctx.save();
    const cam = appState.cameras.perfil;
    ctx.translate(cam.x, cam.y);
    ctx.scale(cam.zoom, cam.zoom);

    // --- 3. DIBUJO DE GRILLA (Carga Manual desde UI) ---
    const gridInpK = document.getElementById('inpGridPerfilK');
    const gridInpZ = document.getElementById('inpGridPerfilZ');

    let gStepK = gridInpK ? parseFloat(gridInpK.value) : 100;
    let gStepZ = gridInpZ ? parseFloat(gridInpZ.value) : 5;
    
    if (isNaN(gStepK) || gStepK <= 0) gStepK = 100;
    if (isNaN(gStepZ) || gStepZ <= 0) gStepZ = 5;
    
    ctx.lineWidth = 1 / cam.zoom;
    ctx.font = `${11 / cam.zoom}px monospace`;

    const yTextoFijo = (H - cam.y - 30) / cam.zoom; // Ajustado a 35 para dar espacio
    const xTextoFijo = (10 - cam.x) / cam.zoom;

    // GRILLA VERTICAL (PKs)
    for (let k = Math.ceil(gMinK / gStepK) * gStepK; k <= gMaxK; k += gStepK) {
        let sx = toX(k);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.beginPath();
        ctx.moveTo(sx, toY(gMinZ)); ctx.lineTo(sx, toY(gMaxZ));
        ctx.stroke();
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.textAlign = "center";
        ctx.fillText(k.toFixed(0), sx, yTextoFijo);
    }

    // GRILLA HORIZONTAL (Elevaciones)
    for (let z = Math.ceil(gMinZ / gStepZ) * gStepZ; z <= gMaxZ; z += gStepZ) {
        let sy = toY(z);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.beginPath();
        ctx.moveTo(toX(gMinK), sy); ctx.lineTo(toX(gMaxK), sy);
        ctx.stroke();
        
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.textAlign = "left";
        ctx.fillText(z.toFixed(1), xTextoFijo, sy - 2 / cam.zoom);
    }

    // --- 4. DIBUJO DE PERFILES ---
    Object.values(appState.perfil.perfiles).forEach(p => {
        ctx.beginPath();
        ctx.strokeStyle = p.tipo.includes("Surface") ? "#4CAF50" : "#00fbff";
        ctx.lineWidth = (p.tipo.includes("Surface") ? 1.5 : 2.5) / cam.zoom;
        p.datos.forEach((pt, i) => {
            if (i === 0) ctx.moveTo(toX(pt.k), toY(pt.z));
            else ctx.lineTo(toX(pt.k), toY(pt.z));
        });
        ctx.stroke();
    });

    // --- 5. MARCADOR DE PK ACTUAL (LÍNEA + PUNTO) ---
    if (appState.secciones && appState.secciones.length > 0) {
        const pkActual = appState.secciones[appState.currentIdx].k;
        const xPos = toX(pkActual);

        // A) Línea Vertical Roja (Guía)
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
        ctx.lineWidth = 1 / cam.zoom;
        ctx.beginPath();
        ctx.moveTo(xPos, toY(gMinZ)); ctx.lineTo(xPos, toY(gMaxZ));
        ctx.stroke();
        ctx.setLineDash([]);

        // B) Puntos Rojos sobre los perfiles (NUEVO)
        Object.values(appState.perfil.perfiles).forEach(p => {
            // Buscamos el punto más cercano en este perfil al PK actual
            // Usamos un rango de búsqueda pequeño (ej. 5m) para encontrar el vértice
            const pt = p.datos.find(d => Math.abs(d.k - pkActual) < 5); 

            if (pt) {
                // Dibujar Círculo
                ctx.fillStyle = "red";
                ctx.beginPath();
                // Usamos toX(pt.k) para que el punto quede EXACTAMENTE sobre la línea del perfil
                // aunque visualmente podría saltar un poquito si la línea vertical no coincide exacta.
                ctx.arc(toX(pt.k), toY(pt.z), 6 / cam.zoom, 0, Math.PI * 2);
                ctx.fill();

                // Texto con la Elevación (Z)
                ctx.fillStyle = "white";
                ctx.font = `bold ${11 / cam.zoom}px Arial`;
                ctx.textAlign = "left";
                // Dibujamos el texto un poco arriba y a la derecha del punto
                ctx.fillText(`Z: ${pt.z.toFixed(2)}`, toX(pt.k) + 8 / cam.zoom, toY(pt.z) - 8 / cam.zoom);
            }
        });
    }

    ctx.restore();
}