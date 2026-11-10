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
  const K = "perpetuo-tienda-demo-2";
  const ENVIO = { costo: 100, gratisDesde: 0 }; // gratisDesde 0 = nunca gratis
  const una = n => [{ nombre: "", existencias: n }];
  const gorra = "Gabardina de seis gajos, visera curva y broche ajustable.";
  // Nombres y textos provisionales: se cambian cuando lleguen las fotos y los datos de cada pieza.
  const semilla = () => ({
    pedidos: [],
    productos: [
      { id: "g1", slug: "gorra-01", nombre: "Gorra 01", categoria: "Gorras", precio: 500, etiqueta: "", destacado: true, signo: "punto", color: "azul",
        resumen: "Texto provisional: una o dos líneas sobre esta gorra y el personaje que lleva.", descripcion: "Texto provisional. Aquí va la descripción de la primera gorra.\n\n" + gorra,
        detalles: "Talla única ajustable.", imagenes: [], variantes: una(20) },
      { id: "g2", slug: "gorra-02", nombre: "Gorra 02", categoria: "Gorras", precio: 500, etiqueta: "", signo: "coma", color: "rojo",
        resumen: "Texto provisional: una o dos líneas sobre esta gorra y el personaje que lleva.", descripcion: "Texto provisional. Aquí va la descripción de la segunda gorra.\n\n" + gorra,
        detalles: "Talla única ajustable.", imagenes: [], variantes: una(20) },
      { id: "g3", slug: "gorra-03", nombre: "Gorra 03", categoria: "Gorras", precio: 500, etiqueta: "", signo: "exclamacion", color: "lima",
        resumen: "Texto provisional: una o dos líneas sobre esta gorra y el personaje que lleva.", descripcion: "Texto provisional. Aquí va la descripción de la tercera gorra.\n\n" + gorra,
        detalles: "Talla única ajustable.", imagenes: [], variantes: una(20) },
      { id: "b1", slug: "tote", nombre: "Tote", categoria: "Bolsas", precio: 500, etiqueta: "", signo: "interrogacion", color: "tinta",
        resumen: "Texto provisional: una o dos líneas sobre la bolsa y lo que cabe en ella.", descripcion: "Texto provisional. Aquí va la descripción de la tote.",
        detalles: "Medidas y material, por confirmar.", imagenes: [], variantes: una(30) },
      { id: "s1", slug: "sueter", nombre: "Suéter", categoria: "Ropa", precio: 500, etiqueta: "", signo: "punto", color: "azul",
        resumen: "Texto provisional: una o dos líneas sobre el suéter.", descripcion: "Texto provisional. Aquí va la descripción del suéter.",
        detalles: "Material y cuidado, por confirmar.", imagenes: [], variantes: ["CH", "M", "G", "XG"].map(t => ({ nombre: t, existencias: 8 })) }
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
      const envio = ENVIO.gratisDesde && subtotal >= ENVIO.gratisDesde ? 0 : ENVIO.costo;
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
