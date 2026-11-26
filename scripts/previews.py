"""Genera una página /e/<slug>/ por evento para que los enlaces compartidos
(WhatsApp, iMessage, Facebook, X, LinkedIn…) muestren la imagen del evento.

Los buscadores y las apps de mensajería no ejecutan JavaScript ni ven lo que va
después de "#", así que /#/e/<slug> siempre se veía como la portada. Cada página
generada trae sus etiquetas og: y manda a la persona a /#/e/<slug> al instante.

Lo corre .github/workflows/previews.yml cada 15 minutos. A mano:
    pip install pillow && python scripts/previews.py
"""
import hashlib
import html
import io
import json
import re
import shutil
import urllib.request
from datetime import date
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

RAIZ = Path(__file__).resolve().parent.parent
SITIO = "https://eventos.perpetuo.global"
SALIDA = RAIZ / "e"
W, H = 1200, 630
PAPEL = (250, 246, 241)

MESES = "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split()
DIAS = "lunes martes miércoles jueves viernes sábado domingo".split()


def api_url():
    js = (RAIZ / "assets" / "comun.js").read_text(encoding="utf-8")
    m = re.search(r'API_URL:\s*"([^"]+)"', js)
    if not m:
        raise SystemExit("CONFIG.API_URL está vacío en assets/comun.js")
    return m.group(1)


def bajar(url):
    req = urllib.request.Request(url, headers={"User-Agent": "perpetuo-eventos-previews"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def fecha_larga(e):
    try:
        d = date.fromisoformat(str(e.get("fecha", ""))[:10])
    except ValueError:
        return ""
    s = f"{DIAS[d.weekday()]} {d.day} de {MESES[d.month - 1]}"
    return s + (f", {e['hora']}" if e.get("hora") else "")


def tarjeta(datos):
    """Imagen 1200x630 con el póster completo al centro sobre un fondo difuminado de sí mismo,
    para que los carteles verticales no pierdan el texto al recortarse."""
    im = Image.open(io.BytesIO(datos)).convert("RGB")
    esc = max(W / im.width, H / im.height)
    fondo = im.resize((round(im.width * esc), round(im.height * esc)), Image.LANCZOS)
    x, y = (fondo.width - W) // 2, (fondo.height - H) // 2
    fondo = fondo.crop((x, y, x + W, y + H)).filter(ImageFilter.GaussianBlur(40))
    fondo = ImageEnhance.Brightness(fondo).enhance(0.75)
    esc = min(W / im.width, H / im.height)
    frente = im.resize((round(im.width * esc), round(im.height * esc)), Image.LANCZOS)
    fondo.paste(frente, ((W - frente.width) // 2, (H - frente.height) // 2))
    return fondo


def tarjeta_general():
    """Imagen para la portada y para eventos sin foto: papel, logo y Punto."""
    c = Image.new("RGB", (W, H), PAPEL)
    logo = Image.open(RAIZ / "assets" / "logo.webp").convert("RGBA")
    logo = logo.resize((640, round(640 * logo.height / logo.width)), Image.LANCZOS)
    punto = Image.open(RAIZ / "assets" / "icono" / "icon-512.png").convert("RGBA")
    punto = punto.resize((300, 300), Image.LANCZOS)
    c.paste(punto, ((W - 300) // 2, 90), punto)
    c.paste(logo, ((W - logo.width) // 2, 430), logo)
    return c


def guardar_jpg(im, ruta):
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=85, optimize=True, progressive=True)
    datos = buf.getvalue()
    if not ruta.exists() or ruta.read_bytes() != datos:
        ruta.write_bytes(datos)
    return hashlib.sha1(datos).hexdigest()[:10]


def pagina(e, imagen, alt):
    slug = e["slug"]
    destino = "/#/e/" + slug
    titulo = f"{e.get('titulo', 'Evento')} · Perpetuo"
    partes = [e.get("subtitulo"), fecha_larga(e), e.get("lugar")]
    desc = " · ".join(str(p).strip() for p in partes if p and str(p).strip()) or "Aparta tu lugar en eventos.perpetuo.global."
    a = lambda s: html.escape(str(s), quote=True)
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{a(titulo)}</title>
<meta name="description" content="{a(desc)}">
<link rel="canonical" href="{SITIO}/e/{a(slug)}/">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/icono/favicon-32.png">
<link rel="apple-touch-icon" href="/assets/icono/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Perpetuo">
<meta property="og:locale" content="es_MX">
<meta property="og:title" content="{a(titulo)}">
<meta property="og:description" content="{a(desc)}">
<meta property="og:url" content="{SITIO}/e/{a(slug)}/">
<meta property="og:image" content="{a(imagen)}">
<meta property="og:image:secure_url" content="{a(imagen)}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="{W}">
<meta property="og:image:height" content="{H}">
<meta property="og:image:alt" content="{a(alt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{a(titulo)}">
<meta name="twitter:description" content="{a(desc)}">
<meta name="twitter:image" content="{a(imagen)}">
<meta name="theme-color" content="#074990">
<meta http-equiv="refresh" content="0; url={a(destino)}">
<script>location.replace("/" + location.search + {json.dumps(destino[1:])});</script>
</head>
<body style="background:#074990;color:#FAF6F1;font-family:system-ui,sans-serif;text-align:center;padding:40px 16px">
<p><a href="{a(destino)}" style="color:#FAF6F1">{a(e.get('titulo', 'Ver el evento'))}</a></p>
</body>
</html>
"""


def main():
    respuesta = json.loads(bajar(api_url() + "?accion=eventos"))
    if not respuesta.get("ok"):
        raise SystemExit(f"La API respondió: {respuesta}")
    eventos = [e for e in respuesta.get("eventos", []) if e.get("slug")]

    general = RAIZ / "assets" / "og.jpg"
    v_general = guardar_jpg(tarjeta_general(), general)

    SALIDA.mkdir(exist_ok=True)
    vigentes = set()
    for e in eventos:
        slug = e["slug"]
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", slug):
            print("slug raro, lo salto:", slug)
            continue
        carpeta = SALIDA / slug
        carpeta.mkdir(exist_ok=True)
        vigentes.add(slug)
        imagen, alt = f"{SITIO}/assets/og.jpg?v={v_general}", "Perpetuo"
        if e.get("imagen"):
            try:
                v = guardar_jpg(tarjeta(bajar(e["imagen"])), carpeta / "og.jpg")
                imagen, alt = f"{SITIO}/e/{slug}/og.jpg?v={v}", e.get("titulo", "")
            except Exception as err:  # una imagen rota no debe tumbar las demás
                print(f"{slug}: no pude bajar la imagen ({err}); uso la general")
        elif (carpeta / "og.jpg").exists():
            (carpeta / "og.jpg").unlink()
        nuevo = pagina(e, imagen, alt)
        idx = carpeta / "index.html"
        if not idx.exists() or idx.read_text(encoding="utf-8") != nuevo:
            idx.write_text(nuevo, encoding="utf-8")
        print("ok", slug)

    # eventos que ya no son públicos: su enlace sigue funcionando por 404.html
    for d in SALIDA.iterdir():
        if d.is_dir() and d.name not in vigentes:
            shutil.rmtree(d)
            print("quitado", d.name)


if __name__ == "__main__":
    main()
