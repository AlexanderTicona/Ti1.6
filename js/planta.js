function dibujarPlanta() {
    const canvas = document.getElementById('canvasPlanta');
    if (!canvas || !appState.planta) return;
    const ctx = canvas.getContext('2d');
    
    // Configuración Visual
    const isLight = appConfig.general.theme === 'light';
    const escalaTxt = appConfig.general.textScale || 1.0;
    
    const colorGrilla = isLight ? "rgba(0, 0, 0, 0.15)" : "rgba(255, 255, 255, 0.05)";
    const colorTexto  = isLight ? "#444444" : "rgba(255, 255, 255, 0.4)";
    const colorEje    = isLight ? "#0056b3" : "#00fbff"; 
    const colorPunto  = "red"; 
    const colorTxtPK  = isLight ? "#000000" : "#ffffff"; 

    const rect = canvas.parentNode.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    const geo = appState.planta.geometria;
    if (!geo || geo.length === 0) return;

    // Límites
    const { minE, maxE, minN, maxN } = appState.limitesGlobales.planta;
    const { minE: dMinE, maxE: dMaxE, minN: dMinN, maxN: dMaxN } = appState.encuadre.planta;
    const centroE = (dMinE + dMaxE) / 2;
    const centroN = (dMinN + dMaxN) / 2;
    const anchoData = dMaxE - dMinE;
    const altoData = dMaxN - dMinN;
    const finalScale = Math.min(W / (anchoData * 1.2), H / (altoData * 1.2));

    const toX = (e) => (W / 2) + (e - centroE) * finalScale;
    const toY = (n) => (H / 2) - (n - centroN) * finalScale;

    ctx.save();
    const cam = appState.cameras.planta;
    ctx.translate(cam.x, cam.y);
    ctx.scale(cam.zoom, cam.zoom);

    // --- LÓGICA INTELIGENTE DE GRILLA ---
    // 1. Detectamos si estamos en vista Mixta (clase 'layout-multi')
    const dashboard = document.getElementById('main-dashboard');
    const esModoMini = dashboard && dashboard.classList.contains('layout-multi');

    // 2. Elegimos el intervalo correcto
    let gSize = esModoMini 
        ? (appConfig.planta.gridIntervalMulti || 500) // Si es Mini
        : (appConfig.planta.gridInterval || 200);     // Si es Normal
    
    if (gSize <= 0) gSize = 100;

    const mostrarGrilla = appConfig.planta.showGrid !== false;

    if (mostrarGrilla) {
        ctx.lineWidth = 1 / cam.zoom;
        ctx.strokeStyle = colorGrilla; 
        ctx.fillStyle = colorTexto;    
        ctx.font = `${(11 * escalaTxt) / cam.zoom}px monospace`;

        const yTextoFijo = (H - cam.y - 15) / cam.zoom;
        
        for (let e = Math.ceil(minE / gSize) * gSize; e <= maxE; e += gSize) {
            let x = toX(e);
            ctx.beginPath(); ctx.moveTo(x, toY(minN)); ctx.lineTo(x, toY(maxN)); ctx.stroke();
            ctx.fillText(e.toFixed(0), x + 2 / cam.zoom, yTextoFijo);
        }
        for (let n = Math.ceil(minN / gSize) * gSize; n <= maxN; n += gSize) {
            let y = toY(n);
            ctx.beginPath(); ctx.moveTo(toX(minE), y); ctx.lineTo(toX(maxE), y); ctx.stroke();
            ctx.fillText(n.toFixed(0), (10 - cam.x) / cam.zoom, y - 2 / cam.zoom);
        }
    }

    // Alineamiento
    ctx.beginPath();
    ctx.strokeStyle = colorEje; 
    ctx.lineWidth = 2 / cam.zoom;
    geo.forEach((p, i) => {
        i === 0 ? ctx.moveTo(toX(p.e), toY(p.n)) : ctx.lineTo(toX(p.e), toY(p.n));
    });
    ctx.stroke();

    // Punto Rojo
    if (appState.secciones && appState.secciones.length > 0) {
        const secActual = appState.secciones[appState.currentIdx];
        const mActual = secActual.k || secActual.km || 0;
        const pRef = geo.find(p => Math.abs(p.k - mActual) < 2) || geo[0];

        if (pRef) {
            ctx.fillStyle = colorPunto;
            ctx.beginPath(); ctx.arc(toX(pRef.e), toY(pRef.n), 6 / cam.zoom, 0, Math.PI * 2); ctx.fill();
            
            ctx.fillStyle = colorTxtPK;
            ctx.font = `bold ${(12 * escalaTxt) / cam.zoom}px Arial`;
            ctx.fillText(`PK ${mActual.toFixed(2)}`, toX(pRef.e) + 10 / cam.zoom, toY(pRef.n));
        }
    }
    ctx.restore();
}