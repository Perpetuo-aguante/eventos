/* Eventos · Perpetuo — piezas compartidas por index.html y admin.html */

const CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycby6SrB0cvYGaZzlKO8H3WShalwzJ2AI0X9JHG5ntDq57FH41uWMljnC6K1idnmS5cX6Ww/exec", // URL /exec de la aplicación web de Eventos.gs; vacío = modo demostración (todo vive en este navegador)
  MAX_BOLETOS: 10,
  CLAVE_CACHE: "perpetuo-eventos-cache"
};

/* descripciones con formato mínimo: **negritas**, *cursivas*, [texto](https://…); los párrafos se separan con una línea en blanco */
function formato(t) {
  const linea = l => esc(l)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  return String(t || "").split(/\n\s*\n/).filter(p => p.trim()).map(p => `<p>${p.trim().split("\n").map(linea).join("<br>")}</p>`).join("");
}
/* lugares que se marcan como tomados a mano desde el panel (vendidos fuera de la página, apartados para invitados…):
   cuentan contra el cupo en lo que se ve, sin crear registros ni mandar correos */
const apartadosDe = e => Math.max(Number(e && e.apartados) || 0, 0);
const tomados = e => (Number(e.vendidos) || 0) + apartadosDe(e);
const conApartados = e => e.cupo && e.disponibles != null && apartadosDe(e) ? { ...e, disponibles: Math.max(e.disponibles - apartadosDe(e), 0) } : e;
const iniciales = n => String(n || "").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();

const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const correoOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const dinero = n => "$" + Number(n || 0).toLocaleString("es-MX", { maximumFractionDigits: 2 });

/* fechas: "2026-11-14" + "19:30"; se leen a mediodía para que la zona horaria no mueva el día */
const diaDe = f => new Date(f + "T12:00:00");
const fecha = {
  larga: f => diaDe(f).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" }),
  conAnio: f => diaDe(f).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
  dia: f => diaDe(f).getDate(),
  mes: f => diaDe(f).toLocaleDateString("es-MX", { month: "short" }).replace(".", ""),
  semana: f => diaDe(f).toLocaleDateString("es-MX", { weekday: "short" }).replace(".", ""),
  hora: h => {
    if (!h) return "";
    const [H, M] = h.split(":").map(Number);
    return (H % 12 || 12) + (M ? ":" + String(M).padStart(2, "0") : "") + (H < 12 ? " a. m." : " p. m.");
  }
};
const hoyISO = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

/* ---------------- muñecos ---------------- */
// Cada signo partido en cuerpo + extremidades (assets/partes). ox/oy: articulación en %;
// a: amplitud del giro; b: va en contrafase (pierna derecha y brazo izquierdo).
const BICHOS = {
  punto:         { w: 300, h: 267, p: [[19.7, 18.3, 14, 1], [75.2, 59.8, 14, 0], [37.7, 71.1, 18, 0], [59.2, 71.2, 18, 1]] },
  coma:          { w: 187, h: 300, p: [[72.9, 78.1, 18, 1], [41.4, 81.8, 18, 0]] },
  exclamacion:   { w: 220, h: 300, p: [[67.6, 59.5, 14, 0], [27.9, 58.8, 14, 1], [57.8, 76.3, 18, 1], [25.4, 82.9, 18, 0]] },
  interrogacion: { w: 213, h: 300, p: [[56.3, 81.7, 18, 1], [27.4, 83.8, 18, 0]] }
};
const SIGNOS = Object.keys(BICHOS);
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
  raiz.querySelectorAll("[data-b]").forEach(el => {
    if (!("vivo" in el.dataset)) { el.outerHTML = bicho(el.dataset.b); return; }
    const n = BICHOS[el.dataset.b] ? el.dataset.b : "punto", b = BICHOS[n];
    const v = document.createElement("span");
    v.className = "vivo"; v.style.setProperty("--ar", b.w + "/" + b.h);
    v.innerHTML = `<span class="v-mov"><span class="v-cuerpo">${bicho(n)}</span></span><span class="v-sombra"></span>`;
    el.replaceWith(v);
    vivir(v, n, { espera: parseFloat(el.dataset.vivo) || 0 });
  });
}

/* ---------------- muñecos vivos ----------------
   El motor de la Exclamación de cronicas.perpetuo.global, para los cuatro signos: resortes y gravedad.
   Cae a su lugar, respira, se mece, mira hacia el cursor y de vez en cuando salta, saluda o baila.
   Al darle clic salta y suelta chispas de su signo. Se duerme cuando no se ve. */
// qué pieza de assets/partes es cada extremidad: [derecha, izquierda]
const ROLES = {
  punto:         { brazos: [1, 0], piernas: [3, 2], chispa: "•" },
  exclamacion:   { brazos: [0, 1], piernas: [2, 3], chispa: "!" },
  coma:          { brazos: null,   piernas: [0, 1], chispa: "," },
  interrogacion: { brazos: null,   piernas: [0, 1], chispa: "?" }
};
function vivir(el, n, { espera: retraso = 0 } = {}) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const rol = ROLES[n] || ROLES.punto;
  const mov = el.querySelector(".v-mov"), cuerpo = el.querySelector(".v-cuerpo"), sombra = el.querySelector(".v-sombra");
  const cara = el.querySelector(".bicho .c"), imgs = el.querySelectorAll(".bicho .p");
  // extremidades en orden fijo: brazo der., brazo izq., pierna der., pierna izq. (null si no hay)
  const pieza = [...(rol.brazos || [null, null]), ...rol.piernas].map(i => i === null ? null : imgs[i]);
  el.classList.add("anima");

  const resorte = (x, k, z) => ({ x, v: 0, t: x, k, z });
  const paso = (r, dt) => { r.v += (r.k * (r.t - r.x) - 2 * r.z * Math.sqrt(r.k) * r.v) * dt; r.x += r.v * dt; };
  const inclina = resorte(0, 90, .5), aplasta = resorte(1, 320, .3), ola = resorte(0, 40, 1),
        baile = resorte(0, 30, 1), zapatea = resorte(0, 40, 1), mira = resorte(0, 25, .8);
  const pose = [resorte(0, 180, .5), resorte(0, 180, .5), resorte(0, 220, .6), resorte(0, 220, .6)];
  const POSES = { quieto: [0, 0, 0, 0], aire: [-48, 62, 26, -26], prepara: [12, -14, 10, -8] };
  const ponPose = k => POSES[k].forEach((a, i) => pose[i].t = a);

  let W = el.offsetWidth || 60, g = W * 14, t = 0, antes = 0, activo = false, corriendo = false, visible = false;
  let y = 0, vy = 0, alAterrizar = null;
  const timers = [];
  const espera = s => new Promise(r => timers.push({ en: t + s, r }));

  function polvo(k){
    for (let i = 0; i < k; i++){
      const p = document.createElement("span"), d = W * (.06 + Math.random() * .07);
      p.className = "v-polvo";
      p.style.cssText = `width:${d}px;height:${d}px;left:${30 + Math.random() * 40}%`;
      el.appendChild(p);
      const dx = (Math.random() < .5 ? -1 : 1) * W * (.2 + Math.random() * .45), dy = -W * (.05 + Math.random() * .18);
      p.animate([{ transform: "scale(.6)", opacity: .75 }, { transform: `translate(${dx}px,${dy}px) scale(1.7)`, opacity: 0 }],
        { duration: 500 + Math.random() * 350, easing: "cubic-bezier(.2,.7,.3,1)" }).onfinish = () => p.remove();
    }
  }
  function chispas(){
    for (let i = 0; i < 5; i++){
      const c = document.createElement("span"), ang = (-60 + i * 30 + (Math.random() - .5) * 14) * Math.PI / 180, dist = W * (.55 + Math.random() * .35);
      c.className = "v-chispa"; c.textContent = rol.chispa; c.style.fontSize = W * (.2 + Math.random() * .1) + "px";
      el.appendChild(c);
      c.animate([
        { transform: "translate(-50%,0) rotate(0) scale(.4)", opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.sin(ang) * dist}px), ${-Math.cos(ang) * dist}px) rotate(${ang * 60}deg) scale(1)`, opacity: 0 }
      ], { duration: 750, easing: "cubic-bezier(.15,.8,.3,1)" }).onfinish = () => c.remove();
    }
  }

  async function salto(alto = 1, conChispas = false){
    if (y > 0) return;
    ponPose("prepara"); aplasta.t = .8;
    await espera(.12);
    aplasta.t = 1; aplasta.v = 9; ponPose("aire");
    vy = Math.sqrt(2 * g * W * .55 * alto);
    if (conChispas) chispas();
    return new Promise(r => alAterrizar = r);
  }
  function aterriza(){
    aplasta.x = .78; aplasta.v = 0; ponPose("quieto");
    polvo(5);
    const r = alAterrizar; alAterrizar = null; r && r();
  }
  const saluda = async () => { if (rol.brazos) { ola.t = 1; await espera(1.8); ola.t = 0; } else { zapatea.t = 1; await espera(1.4); zapatea.t = 0; } };
  const bailecito = async () => { baile.t = 1; await espera(2.2); baile.t = 0; };

  async function entrada(){
    await espera(retraso);
    W = el.offsetWidth || W; g = W * 14;
    y = W * 1.6; vy = 0; ponPose("aire");           // cae desde arriba a su lugar
    el.classList.add("listo");
    await new Promise(r => alAterrizar = r);
    await espera(.2);
    await salto(.45);
    const acciones = [saluda, () => salto(.7), async () => { await salto(.5); await salto(.5); }, bailecito, saluda, () => salto(1, true)];
    for (let i = Math.floor(Math.random() * acciones.length);;){
      await espera(2.8 + Math.random() * 3.2);
      if (y === 0) await acciones[i++ % acciones.length]();
    }
  }

  function cuadro(ahora){
    if (!el.isConnected){ removeEventListener("pointermove", alMover); io.disconnect(); return; }
    if (!activo){ corriendo = false; return; }
    const dt = Math.min(1 / 30, antes ? (ahora - antes) / 1000 : 0); antes = ahora; t += dt;
    for (let i = timers.length - 1; i >= 0; i--) if (t >= timers[i].en){ const r = timers[i].r; timers.splice(i, 1); r(); }

    if (vy !== 0 || y > 0){
      vy -= g * dt; y += vy * dt;
      if (y <= 0){ y = 0; vy = 0; aterriza(); }
      else aplasta.t = vy > 0 ? 1.08 : .97;
    }
    const ritmo = Math.sin(t * Math.PI * 3.4);
    inclina.t = baile.x * ritmo * 11 + mira.x + (y > 0 ? -vy / g * 14 : 0) + Math.sin(t * 1.3) * 2.2;
    [inclina, aplasta, ola, baile, zapatea, mira, ...pose].forEach(r => paso(r, dt));

    const respira = Math.sin(t * 2.3), tap = Math.sin(t * Math.PI * 7);
    const ang = [
      pose[0].x + respira * 7 + ola.x * (-46 + Math.sin(t * Math.PI * 6.4) * 30) + baile.x * ritmo * 26,
      pose[1].x - respira * 7 + baile.x * Math.sin(t * Math.PI * 3.4 + 1) * 26,
      pose[2].x + Math.sin(t * 1.3) * 3 + zapatea.x * Math.max(0, tap) * 30 + baile.x * ritmo * 14,
      pose[3].x - Math.sin(t * 1.3) * 3 - zapatea.x * Math.max(0, -tap) * 30 - baile.x * ritmo * 14
    ];
    const bob = baile.x * Math.abs(ritmo) * W * .05 + zapatea.x * Math.abs(tap) * W * .02;

    cuerpo.style.transform = `translate3d(0,${-(y + bob)}px,0) rotate(${inclina.x}deg) scale(${2 - aplasta.x},${aplasta.x})`;
    cara.style.transform = `scale(${1 - respira * .012},${1 + respira * .018})`;
    pieza.forEach((p, i) => p && (p.style.transform = `rotate(${ang[i]}deg)`));
    const lejos = Math.min(1, (y + bob) / (W * .9));
    sombra.style.transform = `scale(${1 - lejos * .5})`;
    sombra.style.opacity = 1 - lejos * .6;
    requestAnimationFrame(cuadro);
  }
  const arrancar = () => { activo = visible && !document.hidden; if (!corriendo && activo){ corriendo = true; antes = 0; requestAnimationFrame(cuadro); } };
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; arrancar(); });
  io.observe(el);
  document.addEventListener("visibilitychange", arrancar);
  function alMover(e){
    const r = el.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2);
    mira.t = Math.max(-7, Math.min(7, dx / 60));
  }
  addEventListener("pointermove", alMover, { passive: true });
  el.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); if (y === 0) salto(1.2, true); });
  addEventListener("resize", () => { W = el.offsetWidth || W; g = W * 14; });
  entrada();
}

/* ---------------- API ---------------- */
// text/plain evita el preflight de CORS que Apps Script no contesta
// Google está dejando colgadas muchas peticiones a Apps Script (nunca llegan al script), al azar y de
// forma independiente. Así que no esperamos a una sola: si la primera no contesta en unos segundos,
// lanzamos otra en paralelo (y otra…) y nos quedamos con la primera respuesta. Las acciones que crean
// algo llevan un identificador «idem» igual en todas las copias, para que el servidor las haga una vez.
const LECTURAS = ["eventos", "confirmar", "admin.entrar", "admin.estado", "admin.eventos", "admin.resumen", "admin.registros"];
const azar = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join("");
async function api(accion, datos = {}) {
  if (!CONFIG.API_URL) return Demo(accion, datos);
  const lectura = LECTURAS.includes(accion);
  if (!lectura && !datos.idem) datos.idem = azar(16);
  if (accion === "admin.guardar" && datos.evento && !datos.evento.id) datos.evento = { ...datos.evento, id: azar(8) };
  const cuerpo = JSON.stringify({ accion, ...datos });
  // cada cuánto se lanza otra copia, cuántas como máximo y cuánto esperamos en total
  const [cada, copias, total] = accion === "admin.subirImagen" ? [12000, 3, 60000] : lectura ? [1500, 10, 25000] : [5000, 7, 45000];
  const cortes = [];
  try {
    return await new Promise((ok, mal) => {
      let vivas = 0, lanzadas = 0, listo = false, relojCopias;
      const fin = (f, v) => { if (!listo) { listo = true; clearInterval(relojCopias); clearTimeout(relojTotal); f(v); } };
      const lanzar = () => {
        if (listo || lanzadas >= copias) return;
        lanzadas++; vivas++;
        const corte = new AbortController(); cortes.push(corte);
        fetch(CONFIG.API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: cuerpo, signal: corte.signal })
          .then(r => r.json())
          .then(j => j.error ? fin(mal, new Error(j.error)) : fin(ok, j))
          .catch(e => {
            vivas--;
            if (!listo && e.name !== "AbortError") console.warn("Eventos: copia de " + accion + " falló", e);
            if (!listo && vivas === 0) lanzar(); // si todas fallaron rápido, no esperes al reloj
          });
      };
      const relojTotal = setTimeout(() => fin(mal, new Error("red")), total);
      relojCopias = setInterval(lanzar, cada);
      lanzar();
    });
  } finally { cortes.forEach(c => c.abort()); }
}

const ERRORES = {
  correo: "Revisa tu correo; parece que le falta algo.",
  nombre: "Escribe tu nombre.",
  cantidad: "Elige cuántos boletos quieres.",
  agotado: "Se acabaron los lugares para este evento.",
  cupo: "Ya no quedan tantos lugares. Elige menos boletos.",
  evento: "Este evento ya no está disponible.",
  pasado: "Este evento ya pasó.",
  stripe: "No pudimos abrir el pago. Inténtalo en un momento.",
  clave: "Esa no es la clave.",
  imagen: "La imagen pesa demasiado (máximo 5 MB) o no es JPG, PNG o WebP.",
  datos: "Faltan el título, la fecha o la hora.",
  precio: "Stripe no cobra menos de $10 MXN. Pon 0 para un evento gratis.",
  apartados: "Los lugares ya tomados no pueden ser más que el cupo.",
  folio: "No encontramos ese registro.",
  estado: "Ese registro no está confirmado.",
  registrado: "Ya te registraste para este evento. No te preocupes: ya tenemos tu lugar apartado. Tu boleto está en tu correo (revisa también el spam).",
  duplicado: "Ese correo ya tiene un lugar en este evento.",
  red: "La conexión con el servidor está lenta. Espera un momento e inténtalo de nuevo; si ya lo intentaste, revisa tu correo antes."
};
const errorTexto = e => ERRORES[e && e.message] || "Algo falló de nuestro lado. Revisa tu conexión e inténtalo de nuevo.";

/* ---------------- modo demostración ----------------
   Imita a Eventos.gs con localStorage para probar sin backend: el pago se simula
   (no pasa por Stripe) y la clave de administración es "perpetuo". */
const Demo = (() => {
  const K = "perpetuo-eventos-demo";
  const dias = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
  const semilla = () => ({
    registros: [],
    eventos: [
      { id: "demo1", slug: "noche-de-cronica", estado: "publicado", titulo: "Noche de crónica", subtitulo: "Cuatro autores del Estelar leen en voz alta lo que no cupo en la página.",
        fecha: dias(9), hora: "19:30", horaFin: "22:00", lugar: "Foro Perpetuo", direccion: "Colima 145, Roma Norte, CDMX", mapa: "",
        descripcion: "Una noche para escuchar **crónica como se escribe**: con pausas, digresiones y algún desvío.\n\nCuatro autoras y autores del Estelar leen fragmentos inéditos y conversan con el público. Hay mezcal de bienvenida y mesa de libros.",
        imagen: "", precio: 250, cupo: 60, signo: "exclamacion", color: "rojo", notaCorreo: "Las puertas abren a las 19:00. Llega temprano: no se aparta lugar.",
        invitados: [{ nombre: "Juan Millor", rol: "Cronista, autor de *Ciudad de paso*", foto: "" }, { nombre: "Daniela Ochoa", rol: "Editora del Estelar", foto: "" }] },
      { id: "demo2", slug: "taller-de-cronica", estado: "publicado", titulo: "Taller de crónica urbana", subtitulo: "Tres sesiones para salir a la calle con libreta y volver con un texto.",
        fecha: dias(16), hora: "11:00", horaFin: "14:00", lugar: "Biblioteca Vasconcelos", direccion: "Eje 1 Norte s/n, Buenavista, CDMX", mapa: "",
        descripcion: "Un taller práctico de tres sábados. Leemos crónicas clásicas, salimos a observar y editamos en grupo.\n\nCupo limitado a 15 personas. El mejor texto se publica en Perpetuo.",
        imagen: "", precio: 1200, cupo: 15, signo: "coma", color: "lima", notaCorreo: "Trae libreta y pluma. Te mandaremos las lecturas una semana antes." },
      { id: "demo3", slug: "fiesta-perpetuo", estado: "publicado", titulo: "Perpetuo cumple tres", subtitulo: "Fiesta, lecturas relámpago y un brindis por los que leen hasta el final.",
        fecha: dias(23), hora: "20:00", horaFin: "", lugar: "Salón Los Ángeles", direccion: "Lerdo 206, Guerrero, CDMX", mapa: "",
        descripcion: "Celebramos tres años de revista con quienes la hacen posible: ustedes.\n\nEntrada libre con registro.",
        imagen: "", precio: 0, cupo: 0, signo: "punto", color: "azul", notaCorreo: "" },
      { id: "demo4", slug: "la-vida-creativa-posthumana", estado: "publicado", titulo: "La vida creativa posthumana", subtitulo: "Mesa sobre inteligencia artificial, literatura y el futuro.",
        fecha: "2026-10-28", hora: "18:00", horaFin: "20:00", lugar: "Tech Week CDMX", direccion: "", mapa: "",
        descripcion: "La mesa de Perpetuo en Tech Week.", imagen: "", precio: 0, cupo: 120, signo: "interrogacion", color: "tinta", notaCorreo: "" }
    ]
  });
  // historial falso de las últimas semanas para que el dashboard tenga datos
  const historial = db => {
    const nombres = ["Lucía Ramírez", "Mateo Núñez", "Sofía Peña", "Diego Ortiz", "Valeria Muñoz", "Andrés León", "Camila Ríos", "Íñigo Sáenz"];
    const pesos = { demo1: 34, demo2: 9, demo3: 41 };
    let semillaRnd = 7; const rnd = () => (semillaRnd = (semillaRnd * 9301 + 49297) % 233280) / 233280;
    Object.entries(pesos).forEach(([id, n]) => {
      const e = db.eventos.find(x => x.id === id);
      for (let i = 0; i < n; i++) {
        const cantidad = rnd() < .7 ? 1 : rnd() < .8 ? 2 : 3;
        const d = new Date(); d.setDate(d.getDate() - Math.floor(Math.pow(rnd(), 1.6) * 28)); d.setHours(9 + Math.floor(rnd() * 13), Math.floor(rnd() * 60));
        db.registros.push({ folio: folio(), fecha: d.toISOString(), eventoId: id, evento: e.titulo, nombre: nombres[Math.floor(rnd() * nombres.length)],
          correo: "demo" + i + "@ejemplo.com", cantidad, total: e.precio * cantidad, estado: e.precio ? "pagado" : "gratis", stripeSesion: "", asistio: false });
      }
    });
    db.registros.sort((a, b) => a.fecha.localeCompare(b.fecha));
    return db;
  };
  const leer = () => { try { return JSON.parse(localStorage.getItem(K)) || historial(semilla()); } catch (e) { return historial(semilla()); } };
  const guardar = db => { try { localStorage.setItem(K, JSON.stringify(db)); } catch (e) {} };
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const folio = () => "PE-" + Array.from({ length: 6 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]).join("");
  const VALIDOS = ["pagado", "gratis", "cortesía"];
  const ocupados = (db, id) => db.registros.filter(r => r.eventoId === id && (VALIDOS.includes(r.estado) || r.estado === "pendiente")).reduce((s, r) => s + r.cantidad, 0);
  const publico = (db, e) => ({ ...e, notaCorreo: undefined, disponibles: e.cupo ? Math.max(e.cupo - ocupados(db, e.id), 0) : null, pasado: e.fecha < hoyISO() });
  const boleto = (db, r) => { const e = db.eventos.find(x => x.id === r.eventoId); return { folio: r.folio, nombre: r.nombre, correo: r.correo, cantidad: r.cantidad, total: r.total, estado: r.estado, evento: publico(db, e) }; };
  const falla = c => { throw new Error(c); };
  const admin = d => { if (d.clave !== "perpetuo") falla("clave"); };

  return async (accion, d) => {
    await espera(accion === "eventos" ? 250 : 700);
    const db = leer();
    if (accion === "eventos") return { ok: true, eventos: db.eventos.filter(e => e.estado === "publicado").map(e => publico(db, e)) };

    if (accion === "registrar") {
      const e = db.eventos.find(x => x.id === d.eventoId && x.estado === "publicado") || falla("evento");
      if (e.fecha < hoyISO()) falla("pasado");
      if (!String(d.nombre || "").trim()) falla("nombre");
      if (!correoOk(d.correo || "")) falla("correo");
      const cantidad = Number(d.cantidad);
      if (!(cantidad >= 1 && cantidad <= CONFIG.MAX_BOLETOS)) falla("cantidad");
      if (e.cupo) { const quedan = e.cupo - ocupados(db, e.id) - apartadosDe(e); if (quedan <= 0) falla("agotado"); if (cantidad > quedan) falla("cupo"); }
      const r = { folio: folio(), fecha: new Date().toISOString(), eventoId: e.id, evento: e.titulo, nombre: d.nombre.trim(), correo: d.correo.trim().toLowerCase(),
        cantidad, total: e.precio * cantidad, estado: e.precio > 0 ? "pendiente" : "gratis", stripeSesion: "", asistio: false };
      db.registros.push(r); guardar(db);
      console.info("[modo demostración] registro:", r);
      if (e.precio > 0) return { ok: true, url: location.pathname + "?pago=ok&session_id=cs_demo_" + r.folio + "#/e/" + e.slug };
      return { ok: true, boleto: boleto(db, r) };
    }

    if (accion === "confirmar") {
      const r = db.registros.find(x => "cs_demo_" + x.folio === d.session_id) || falla("evento");
      if (r.estado === "pendiente") { r.estado = "pagado"; guardar(db); console.info("[modo demostración] se habría mandado el correo a", r.correo); }
      return { ok: true, estado: r.estado, boleto: boleto(db, r) };
    }

    admin(d);
    const stats = e => {
      const rs = db.registros.filter(r => r.eventoId === e.id);
      return { ...e, vendidos: rs.filter(r => VALIDOS.includes(r.estado)).reduce((s, r) => s + r.cantidad, 0),
        ingresos: rs.filter(r => r.estado === "pagado").reduce((s, r) => s + r.total, 0), registros: rs.length };
    };
    if (accion === "admin.entrar") return { ok: true };
    if (accion === "admin.estado") return { ok: true, stripe: "demo" };
    if (accion === "admin.eventos") return { ok: true, eventos: db.eventos.map(stats) };
    if (accion === "admin.resumen") return { ok: true, eventos: db.eventos.map(stats),
      ventas: db.registros.filter(r => VALIDOS.includes(r.estado)).map(({ stripeSesion, asistio, correo, ...r }) => r) };
    if (accion === "admin.guardar") {
      const e = { ...d.evento, precio: Number(d.evento.precio) || 0, cupo: Number(d.evento.cupo) || 0, apartados: Number(d.evento.apartados) || 0 };
      if (!e.titulo || !e.fecha) falla("datos");
      if (!e.id) e.id = "e" + Date.now().toString(36);
      e.slug = (e.slug || e.titulo).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (db.eventos.some(x => x.slug === e.slug && x.id !== e.id)) e.slug += "-" + e.id.slice(-3);
      const i = db.eventos.findIndex(x => x.id === e.id);
      i < 0 ? db.eventos.push(e) : (db.eventos[i] = e);
      guardar(db);
      return { ok: true, evento: stats(e) };
    }
    if (accion === "admin.registros") return { ok: true, registros: db.registros.filter(r => r.eventoId === d.eventoId).slice().reverse() };
    if (accion === "admin.asistencia") { const r = db.registros.find(x => x.folio === d.folio); if (r) r.asistio = !!d.asistio; guardar(db); return { ok: true }; }
    if (accion === "admin.reenviar") { console.info("[modo demostración] se habría reenviado el correo de", d.folio); return { ok: true }; }
    if (accion === "admin.cortesia") {
      const e = db.eventos.find(x => x.id === d.eventoId) || falla("evento");
      if (!correoOk(d.correo || "")) falla("correo");
      const r = { folio: folio(), fecha: new Date().toISOString(), eventoId: e.id, evento: e.titulo, nombre: d.nombre, correo: d.correo.toLowerCase(),
        cantidad: Number(d.cantidad) || 1, total: 0, estado: "cortesía", stripeSesion: "", asistio: false };
      db.registros.push(r); guardar(db);
      return { ok: true, registro: r };
    }
    if (accion === "admin.subirImagen") return { ok: true, url: "data:" + d.tipo + ";base64," + d.datos };
    falla("accion");
  };
})();
