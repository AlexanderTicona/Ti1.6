// js/planta.js
function dibujarPlanta() {
    const canvas = document.getElementById('canvasPlanta');
    if (!canvas || !appState.planta) return;
    const ctx = canvas.getContext('2d');
    
    const rect = canvas.parentNode.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    const W = canvas.width, H = canvas.height;

    const geo = appState.planta.geometria;
    if (!geo || geo.length === 0) return;

    // 1. USAR LÍMITES MAESTROS (Grilla)
    const { minE, maxE, minN, maxN } = appState.limitesGlobales.planta;

    // 2. LÍMITES DE ENCUADRE (Data pura)
    const { minE: dMinE, maxE: dMaxE, minN: dMinN, maxN: dMaxN } = appState.encuadre.planta;
    const centroE = (dMinE + dMaxE) / 2;
    const centroN = (dMinN + dMaxN) / 2;

    // Escala basada en la data pura para que el encuadre sea perfecto
    const anchoData = dMaxE - dMinE;
    const altoData = dMaxN - dMinN;
    const finalScale = Math.min(W / (anchoData * 1.2), H / (altoData * 1.2));

    // NUEVA LÓGICA: El punto (centroE, centroN) se dibujará en (W/2, H/2)
    const toX = (e) => (W / 2) + (e - centroE) * finalScale;
    const toY = (n) => (H / 2) - (n - centroN) * finalScale;

    ctx.save();
    const cam = appState.cameras.planta;
    // Ahora, si cam.x=0 y cam.y=0, el centro del proyecto está en el centro del canvas.
    ctx.translate(cam.x, cam.y);
    ctx.scale(cam.zoom, cam.zoom);

    // 2. GRILLA TIPO "CAJA" (Opción A)
    // Determinamos qué parte de la caja maestra es visible para no dibujar de más
    let gSize = 100;
    if (cam.zoom < 0.5) gSize = 500;
    if (cam.zoom < 0.1) gSize = 1000;
    if (cam.zoom < 0.02) gSize = 5000;

    ctx.lineWidth = 1 / cam.zoom;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = `${11 / cam.zoom}px monospace`;

    const yTextoFijo = (H - cam.y - 15) / cam.zoom;
    const xTextoFijo = (10 - cam.x) / cam.zoom;

    // Dibujo Este (X) limitado a la caja del proyecto
    for (let e = Math.ceil(minE / gSize) * gSize; e <= maxE; e += gSize) {
        let x = toX(e);
        ctx.beginPath();
        ctx.moveTo(x, toY(minN)); 
        ctx.lineTo(x, toY(maxN));
        ctx.stroke();
        ctx.fillText(e.toFixed(0), x + 2 / cam.zoom, yTextoFijo);
    }

    // Dibujo Norte (Y) limitado a la caja del proyecto
    for (let n = Math.ceil(minN / gSize) * gSize; n <= maxN; n += gSize) {
        let y = toY(n);
        ctx.beginPath();
        ctx.moveTo(toX(minE), y); 
        ctx.lineTo(toX(maxE), y);
        ctx.stroke();
        ctx.fillText(n.toFixed(0), xTextoFijo, y - 2 / cam.zoom);
    }

    // 3. DIBUJAR ALINEAMIENTO (Optimizado: Dibujo simple)
    ctx.beginPath();
    ctx.strokeStyle = "#00fbff";
    ctx.lineWidth = 2 / cam.zoom;
    geo.forEach((p, i) => {
        i === 0 ? ctx.moveTo(toX(p.e), toY(p.n)) : ctx.lineTo(toX(p.e), toY(p.n));
    });
    ctx.stroke();

    // --- 4. PUNTO ROJO DE SECCIÓN ACTUAL (Optimizado) ---
    if (appState.secciones && appState.secciones.length > 0) {
        const secActual = appState.secciones[appState.currentIdx];
        const mActual = secActual.k || secActual.km || 0;

        // Buscamos el punto con un margen de error pequeño (más rápido que reduce)
        const pRef = geo.find(p => Math.abs(p.k - mActual) < 2) || geo[0];

        if (pRef) {
            ctx.fillStyle = "red";
            ctx.beginPath();
            ctx.arc(toX(pRef.e), toY(pRef.n), 6 / cam.zoom, 0, Math.PI * 2);
            ctx.fill();
            
            // Texto del PK
            ctx.fillStyle = "white";
            ctx.font = `bold ${12 / cam.zoom}px Arial`;
            ctx.fillText(`PK ${mActual.toFixed(2)}`, toX(pRef.e) + 10 / cam.zoom, toY(pRef.n));
        }
    }
    ctx.restore();
}