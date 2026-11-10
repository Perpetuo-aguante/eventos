# Tienda · Perpetuo

La tienda de Perpetuo: muestra la mercancía de la revista y la vende con Stripe. Está hecha sobre el molde de `eventos` (mismo brandbook, mismas piezas, mismo flujo de pago), pero en blanco y con lo mínimo.

> **Estado: primer plano.** El sitio funciona completo en modo demostración, con productos de ejemplo y huecos rotulados donde van las fotos. Falta aprobar el diseño, subir las fotos reales y conectar Stripe.
>
> Vive por ahora en la carpeta `tienda/` del repositorio de `eventos` porque no existe todavía un repositorio propio. Al aprobarse, se muda tal cual a `Perpetuo-aguante/tienda` (tienda.perpetuo.global).

## Archivos
- `index.html`: el sitio público. La portada con la pieza destacada y la rejilla de productos, la página de cada pieza (`#/p/slug`), la bolsa (un cajón lateral) y el recibo después de pagar (`#/pedido`).
- `assets/comun.js`: `CONFIG` (aquí va la URL del backend), la API, el modo demostración con los productos de ejemplo y los muñecos.
- `assets/comun.css`: colores, tipografías, botones y muñecos del brandbook, sobre fondo blanco.
- `assets/partes/`, `assets/logo.webp`: copiados de `eventos`.
- `Tienda.gs`: el backend en Apps Script. No se publica: va en script.google.com y está en `.gitignore`.

Todo está escrito a mano en HTML, CSS y JS, sin paso de compilación, igual que `eventos`.

## Dónde va cada cosa

| Lugar | Qué muestra | Foto |
|---|---|---|
| Portada, a la derecha del titular | La pieza **destacada** (columna `destacado`) | Foto 1 de esa pieza |
| Rejilla "Todo lo que hay" | Todas las piezas publicadas, 3 por fila (2 en celular), con filtro por categoría | Foto 1; al pasar el cursor, la foto 2 |
| Página de la pieza | Galería, precio, descripción, tallas, cantidad y "Agregar a la bolsa" | Hasta 5 fotos |
| Bolsa y recibo | Renglones con miniatura | Foto 1 |

**Las fotos:** verticales, proporción **4:5**, de 1600 × 2000 px, en JPG o WebP. Se recortan al centro, así que conviene dejar aire alrededor del producto. Orden sugerido por pieza: de frente, el detalle, en uso, por atrás, el empaque. Con dos basta para empezar.

Cada producto es un renglón de la pestaña **Productos** de la hoja:

| Columna | Ejemplo | Notas |
|---|---|---|
| `id` | `p1` | No se cambia nunca: los pedidos lo usan. |
| `slug` | `playera-punto-y-seguido` | Lo que va en el enlace. |
| `estado` | `publicado` | `borrador` y `oculto` no aparecen. |
| `nombre`, `categoria`, `precio` | `Playera Punto y seguido`, `Ropa`, `450` | Precio en pesos. Las categorías se vuelven los filtros. |
| `variantes` | `CH:6, M:12, G:9, XG:4` | Talla y piezas fabricadas. Sin tallas, solo el número: `30`. |
| `resumen`, `descripcion`, `detalles` | | Aceptan `**negritas**`, `*cursivas*` y `[enlaces](https://…)`. |
| `imagenes` | `assets/productos/playera-1.webp` | Una por línea, en orden. |
| `etiqueta` | `Nuevo` | La pastilla sobre la foto. Opcional. |
| `destacado` | `sí` | La que sale junto al titular. |
| `orden` | `1` | De menor a mayor. |
| `signo`, `color` | `punto`, `azul` | El muñeco que acompaña a la pieza. |

**Existencias.** En `variantes` va lo que se fabricó, y no se toca con cada venta: lo disponible es eso menos lo que hay en pedidos `pendiente`, `pagado`, `enviado` o `entregado`. Para resurtir, sube el número.

## Modo demostración
Con `CONFIG.API_URL` vacío (así viene), todo funciona en el navegador con `localStorage`: ocho productos de ejemplo, pago simulado y recibo. En el navegador, `localStorage.removeItem("perpetuo-tienda-demo")` vuelve a las existencias de ejemplo.

Para verlo en la computadora:

```bash
python3 -m http.server 8000
```

y abrir http://localhost:8000.

## Flujo de compra
1. La persona agrega piezas a su bolsa (se guarda en su navegador) y le da clic a **Pagar con tarjeta**.
2. `Tienda.gs` revisa precios y existencias **contra la hoja** (nunca le cree al navegador), anota el pedido como `pendiente` y crea una sesión de **Stripe Checkout** en pesos y en español. Las piezas quedan apartadas 31 minutos.
3. En Stripe la persona escribe su correo, su teléfono, su **dirección de envío** y su tarjeta. El envío se cobra ahí: tarifa plana, o gratis a partir de cierto monto (`AJUSTES` en `Tienda.gs`).
4. Stripe la regresa a `?pago=ok&session_id=…`. La página llama a `confirmar` y el backend **le pregunta a Stripe** si la sesión está pagada. Si sí, guarda nombre, correo, teléfono y dirección, marca el pedido como `pagado` y manda el recibo por correo una sola vez.
5. Si la persona cierra la ventana antes de volver, el disparador `revisarPendientes` (cada 10 min) confirma el pago y manda el recibo de todos modos. Las sesiones que vencen sin pago pasan a `expirado` y liberan las piezas.

**Para surtir:** los pedidos `pagado` están en la pestaña **Pedidos** con artículos y dirección. Al mandar el paquete, cambia el estado a `enviado` y anota la guía.

## Instalación

### 1. Stripe
En dashboard.stripe.com → Desarrolladores → Claves de API, crea una **clave restringida** con permiso de escritura en *Checkout Sessions* y de lectura en *Account*. Para probar, hazlo en modo de prueba.

### 2. Apps Script
1. En script.google.com, crea un proyecto llamado "Perpetuo · Tienda" y pega `Tienda.gs`.
2. En Configuración del proyecto, cambia la zona horaria a `America/Mexico_City` y agrega la propiedad `STRIPE_SECRET` con la clave del paso 1.
3. Ejecuta `instalar()` y acepta los permisos. Crea la hoja **"Perpetuo · Tienda"** (pestañas Productos y Pedidos) y el disparador de cada 10 minutos.
4. Ejecuta `probarStripe()` y después `probarCorreo()`.
5. Implementar → Nueva implementación → Aplicación web, con Ejecutar como: **yo** y Quién tiene acceso: **cualquier usuario**.
6. Pega la URL `/exec` en `CONFIG.API_URL` de `assets/comun.js`.
7. Si el sitio no va a vivir en `https://tienda.perpetuo.global/`, cambia `AJUSTES.SITIOS` en `Tienda.gs`: es la lista de direcciones a las que Stripe puede regresar.

### 3. Prueba completa
Con la clave de prueba, compra algo con la tarjeta `4242 4242 4242 4242`. Revisa que llegue el correo, que el pedido aparezca como `pagado` en la hoja con su dirección y que las existencias bajen. Después cambia a la clave real.

## Para tener en cuenta
- **`Tienda.gs` todavía no se ha probado contra Stripe ni Apps Script reales**; solo se revisó su sintaxis. El paso 3 de arriba es esa prueba.
- **Falta el panel de administración** (como `admin.html` en `eventos`): por ahora, productos y pedidos se manejan directo en la hoja.
- **Reembolsos.** Se hacen en el dashboard de Stripe. Después, en la hoja, cambia el estado del pedido a `reembolsado` para liberar las piezas.
- **Límite de correos.** Apps Script manda unos 100 correos al día con Gmail normal y 1,500 con Workspace.
- **Precio mínimo.** Stripe no cobra menos de $10 MXN.
