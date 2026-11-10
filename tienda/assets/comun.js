/* Tienda · Perpetuo — piezas compartidas */

const CONFIG = {
  API_URL: "", // URL /exec de la aplicación web de Tienda.gs; vacío = modo demostración (todo vive en este navegador)
  MAX_POR_ARTICULO: 10,
  CLAVE_CACHE: "perpetuo-tienda-cache",
  CLAVE_BOLSA: "perpetuo-tienda-bolsa"
};

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const dinero = n => "$" + Number(n || 0).toLocaleString("es-MX", { maximumFractionDigits: 2 });

/* descripciones con formato mínimo: **negritas**, *cursivas*, [texto](https://…); los párrafos se separan con una línea en blanco */
function formato(t) {
  const linea = l => esc(l)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return String(t || "").split(/\n\s*\n/).filter(p => p.trim()).map(p => `<p>${p.trim().split("\n").map(linea).join("<br>")}</p>`).join("");
}

/* ---------------- muñecos ---------------- */
// Cada signo partido en cuerpo + extremidades (assets/partes). ox/oy: articulación en %;
// a: amplitud del giro; b: va en contrafase (pierna derecha y brazo izquierdo).
const BICHOS = {
  punto:         { w: 300, h: 267, p: [[19.7, 18.3, 14, 1], [75.2, 59.8, 14, 0], [37.7, 71.1, 18, 0], [59.2, 71.2, 18, 1]] },
  coma:          { w: 187, h: 300, p: [[72.9, 78.1, 18, 1], [41.4, 81.8, 18, 0]] },
  exclamacion:   { w: 220, h: 300, p: [[67.6, 59.5, 14, 0], [27.9, 58.8, 14, 1], [57.8, 76.3, 18, 1], [25.4, 82.9, 18, 0]] },
  interrogacion: { w: 213, h: 300, p: [[56.3, 81.7, 18, 1], [27.4, 83.8, 18, 0]] }
};
const COLORES = ["azul", "rojo", "lima", "tinta"];

function bicho(n) {
  const b = BICHOS[n] || BICHOS.punto;
  n = BICHOS[n] ? n : "punto";
  return `<span class="bicho" style="aspect-ratio:${b.w}/${b.h}">` +
    b.p.map(([ox, oy, a, fase], i) =>
      `<img class="p${fase ? " b" : ""}" alt="" src="assets/partes/${n}-${i}.webp" style="--ox:${ox}%;--oy:${oy}%;--a:${a}deg">`).join("") +
    `<img class="c" alt="" src="assets/partes/${n}-cuerpo.webp"></span>`;
}
function pintarBichos(raiz = document) {
  raiz.querySelectorAll("[data-b]").forEach(el => { el.outerHTML = bicho(el.dataset.b); });
}

/* ---------------- API ---------------- */
// text/plain evita el preflight de CORS que Apps Script no contesta
async function api(accion, datos = {}) {
  if (!CONFIG.API_URL) return Demo(accion, datos);
  const r = await fetch(CONFIG.API_URL, {
    method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ accion, ...datos })
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j;
}

const ERRORES = {
  bolsa: "Tu bolsa está vacía.",
  producto: "Una de las piezas de tu bolsa ya no está disponible. La quitamos.",
  existencias: "Ya no quedan tantas piezas. Ajustamos tu bolsa a lo que hay.",
  stripe: "No pudimos abrir el pago. Inténtalo en un momento.",
  pedido: "No encontramos ese pedido."
};
const errorTexto = e => ERRORES[e && e.message] || "Algo falló de nuestro lado. Revisa tu conexión e inténtalo de nuevo.";

/* ---------------- modo demostración ----------------
   Imita a Tienda.gs con localStorage para probar sin backend: el pago se simula (no pasa por Stripe).
   Los productos de abajo son DE EJEMPLO: sirven para ver dónde va cada cosa. Sin fotos, cada espacio
   se pinta como un hueco rotulado. */
const Demo = (() => {
  const K = "perpetuo-tienda-demo";
  const ENVIO = { costo: 99, gratisDesde: 1200 };
  const tallas = (...n) => ["CH", "M", "G", "XG"].map((t, i) => ({ nombre: t, existencias: n[i] }));
  const semilla = () => ({
    pedidos: [],
    productos: [
      { id: "p1", slug: "playera-punto-y-seguido", nombre: "Playera Punto y seguido", categoria: "Ropa", precio: 450, etiqueta: "Nuevo", destacado: true, signo: "punto", color: "azul",
        resumen: "Algodón grueso, corte recto, el punto bordado en el pecho.",
        descripcion: "La playera de la casa. **Algodón peinado de 220 g**, corte recto y cuello que no se cuelga.\n\nEl punto va bordado, no impreso: aguanta las lavadas que haga falta.",
        detalles: "100 % algodón. Hecha en México.\nLavar con agua fría, del revés. No usar secadora.",
        imagenes: [], variantes: tallas(6, 12, 9, 4) },
      { id: "p2", slug: "bolsa-leer-hasta-el-final", nombre: "Bolsa Leer hasta el final", categoria: "Para cargar", precio: 320, etiqueta: "", signo: "exclamacion", color: "rojo",
        resumen: "Loneta cruda con asas largas. Caben seis libros y un suéter.",
        descripcion: "Bolsa de loneta cruda de 12 oz con asas largas para colgarla al hombro.\n\nCaben seis libros, un suéter y lo que compres de regreso.",
        detalles: "38 × 42 cm. Serigrafía a una tinta.\nLavar a mano.",
        imagenes: [], variantes: [{ nombre: "", existencias: 30 }] },
      { id: "p3", slug: "sudadera-admiracion", nombre: "Sudadera Admiración", categoria: "Ropa", precio: 890, etiqueta: "", signo: "exclamacion", color: "lima",
        resumen: "Felpa pesada, sin capucha, con el signo en la espalda.",
        descripcion: "Sudadera de cuello redondo en felpa perchada de 400 g. Al frente, el logotipo chico; en la espalda, el signo grande.",
        detalles: "80 % algodón, 20 % poliéster. Hecha en México.\nLavar con agua fría, del revés.",
        imagenes: [], variantes: tallas(3, 0, 5, 2) },
      { id: "p4", slug: "libreta-borrador", nombre: "Libreta Borrador", categoria: "Para escribir", precio: 220, etiqueta: "", signo: "coma", color: "tinta",
        resumen: "Cosida a mano, 96 hojas lisas, lomo descubierto.",
        descripcion: "Para lo que todavía no es texto. **96 hojas lisas** de papel bond de 90 g, cosidas a mano con el lomo a la vista para que abra plana.",
        detalles: "14 × 21 cm. Tapas de cartón gris serigrafiado.",
        imagenes: [], variantes: [{ nombre: "", existencias: 40 }] },
      { id: "p5", slug: "gorra-coma", nombre: "Gorra Coma", categoria: "Ropa", precio: 380, etiqueta: "", signo: "coma", color: "azul",
        resumen: "Seis gajos, visera curva, la coma bordada al frente.",
        descripcion: "Gorra de gabardina de seis gajos con visera curva y broche metálico ajustable. La coma va bordada al frente.",
        detalles: "100 % algodón. Talla única ajustable.",
        imagenes: [], variantes: [{ nombre: "", existencias: 18 }] },
      { id: "p6", slug: "cartel-los-signos", nombre: "Cartel Los signos", categoria: "Para la pared", precio: 280, etiqueta: "Últimas piezas", signo: "interrogacion", color: "rojo",
        resumen: "Risografía a tres tintas, numerada. Tiraje de 100.",
        descripcion: "Los cuatro signos de Perpetuo en risografía a tres tintas sobre papel de 200 g. Cada cartel va numerado y viaja enrollado en tubo.",
        detalles: "A3 (29.7 × 42 cm). Tiraje de 100.",
        imagenes: [], variantes: [{ nombre: "", existencias: 3 }] },
      { id: "p7", slug: "calcomanias-los-cuatro", nombre: "Calcomanías Los cuatro", categoria: "Para escribir", precio: 90, etiqueta: "", signo: "punto", color: "lima",
        resumen: "Los cuatro signos en vinil mate, para la compu o el termo.",
        descripcion: "Cuatro calcomanías de vinil mate recortadas a la forma: punto, coma, admiración e interrogación.",
        detalles: "De 5 a 7 cm cada una. Resisten el agua.",
        imagenes: [], variantes: [{ nombre: "", existencias: 120 }] },
      { id: "p8", slug: "taza-perpetuo", nombre: "Taza Perpetuo", categoria: "Para la casa", precio: 260, etiqueta: "", signo: "punto", color: "tinta",
        resumen: "Peltre blanco con el logotipo en tinta. Para el café de las correcciones.",
        descripcion: "Taza de peltre blanco de 350 ml con el logotipo esmaltado en tinta.",
        detalles: "350 ml. No apta para microondas.",
        imagenes: [], variantes: [{ nombre: "", existencias: 0 }] }
    ]
  });
  const leer = () => { try { return JSON.parse(localStorage.getItem(K)) || semilla(); } catch (e) { return semilla(); } };
  const guardar = db => { try { localStorage.setItem(K, JSON.stringify(db)); } catch (e) {} };
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const folio = () => "PT-" + Array.from({ length: 6 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]).join("");
  const APARTAN = ["pendiente", "pagado", "enviado", "entregado"];
  const apartadas = (db, id, variante) => db.pedidos.filter(o => APARTAN.includes(o.estado))
    .reduce((s, o) => s + o.items.filter(i => i.id === id && i.variante === variante).reduce((t, i) => t + i.cantidad, 0), 0);
  const publico = (db, p) => ({ ...p, variantes: p.variantes.map(v => ({ nombre: v.nombre, disponibles: Math.max(v.existencias - apartadas(db, p.id, v.nombre), 0) })) });
  const recibo = o => ({ folio: o.folio, nombre: o.nombre, correo: o.correo, direccion: o.direccion, items: o.items, subtotal: o.subtotal, envio: o.envio, total: o.total, estado: o.estado });
  const falla = c => { throw new Error(c); };

  return async (accion, d) => {
    await espera(accion === "productos" ? 250 : 700);
    const db = leer();
    if (accion === "productos") return { ok: true, productos: db.productos.map(p => publico(db, p)), envio: ENVIO };

    if (accion === "pedido") {
      if (!Array.isArray(d.items) || !d.items.length) falla("bolsa");
      const items = d.items.map(i => {
        const p = db.productos.find(x => x.id === i.id) || falla("producto");
        const v = publico(db, p).variantes.find(x => x.nombre === i.variante) || falla("producto");
        const cantidad = Number(i.cantidad);
        if (!(cantidad >= 1 && cantidad <= CONFIG.MAX_POR_ARTICULO)) falla("bolsa");
        if (cantidad > v.disponibles) falla("existencias");
        return { id: p.id, nombre: p.nombre, variante: v.nombre, cantidad, precio: p.precio };
      });
      const subtotal = items.reduce((s, i) => s + i.precio * i.cantidad, 0);
      const envio = subtotal >= ENVIO.gratisDesde ? 0 : ENVIO.costo;
      const o = { folio: folio(), fecha: new Date().toISOString(), estado: "pendiente", items, subtotal, envio, total: subtotal + envio, nombre: "", correo: "", direccion: "" };
      db.pedidos.push(o); guardar(db);
      console.info("[modo demostración] pedido:", o);
      return { ok: true, url: location.pathname + "?pago=ok&session_id=cs_demo_" + o.folio };
    }

    if (accion === "confirmar") {
      const o = db.pedidos.find(x => "cs_demo_" + x.folio === d.session_id) || falla("pedido");
      if (o.estado === "pendiente") {
        // en el sitio real, estos datos los captura Stripe Checkout
        Object.assign(o, { estado: "pagado", nombre: "Persona de Prueba", correo: "prueba@ejemplo.com", direccion: "Colima 145, Roma Norte, 06700 Ciudad de México, CDMX" });
        guardar(db);
        console.info("[modo demostración] se habría mandado el recibo a", o.correo);
      }
      return { ok: true, estado: o.estado, pedido: recibo(o) };
    }
    falla("accion");
  };
})();
