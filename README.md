# Eventos · Perpetuo

eventos.perpetuo.global: la cartelera pública de eventos de Perpetuo, con venta de boletos por Stripe, registro gratis, boletos por correo y un panel para administrar todo.

## Archivos
- `index.html`: el sitio público. Muestra la cartelera (cada evento es un boleto), la página de cada evento (`#/e/slug`) con el panel de compra y el boleto "impreso" después de pagar (`#/boleto`).
- `admin.html`: el panel (no aparece en buscadores). Abre en el **Resumen**: ingresos y lugares vendidos con comparación contra el periodo anterior, una gráfica por día (7, 30 o 90 días, en ingresos o en lugares), la ocupación de los próximos eventos y las ventas más recientes. Arriba dice si Stripe está conectado (y en qué modo) y cuántos correos quedan hoy. Desde ahí se crean y editan eventos con vista previa en vivo: foto principal, **invitados con foto** (nombre y quién es), y una descripción con negritas, cursivas y enlaces (`**negritas**`, `*cursivas*`, `[texto](https://…)`). También se ven asistentes, se pasa lista en la puerta, se mandan cortesías, se reenvían correos y se descarga un CSV.
- `assets/comun.js`: `CONFIG` (aquí va la URL del backend), la API, el modo demostración y los muñecos.
- `assets/comun.css`: colores, tipografías, botones y muñecos del brandbook.
- `assets/partes/`, `assets/logo.webp`: copiados de `ia-literatura`.
- `Eventos.gs`: el backend en Apps Script. No se publica: va en script.google.com y está en `.gitignore`.
- `CNAME`: `eventos.perpetuo.global` para GitHub Pages.

Todo está escrito a mano en HTML, CSS y JS, sin paso de compilación, igual que `escribe` e `ia-literatura`.

## Modo demostración
Con `CONFIG.API_URL` vacío (así viene), todo funciona en el navegador con `localStorage`:
- La cartelera trae cuatro eventos de ejemplo.
- El pago se simula: no pasa por Stripe.
- La clave del panel es `perpetuo`.

Sirve para probar el diseño y el flujo sin backend. En el navegador, `localStorage.removeItem("perpetuo-eventos-demo")` vuelve a los datos de ejemplo.

## Flujo de compra
1. La persona elige cuántos boletos quiere (de 1 a 10), escribe su nombre y su correo, y le da clic a **Pagar con tarjeta**.
2. `Eventos.gs` revisa que haya cupo, anota el registro como `pendiente` y crea una sesión de **Stripe Checkout** en pesos mexicanos y en español. El lugar queda apartado 31 minutos.
3. Stripe la regresa a `?pago=ok&session_id=…`. La página llama a `confirmar`, y el backend **le pregunta a Stripe** si la sesión está pagada (nunca le cree al navegador). Si sí, marca el registro como `pagado` y manda el boleto por correo una sola vez.
4. Si la persona cierra la ventana antes de volver, el disparador `revisarPendientes` (cada 10 min) confirma el pago y manda el boleto de todos modos. Las sesiones que vencen sin pago pasan a `expirado` y liberan el lugar.

En los eventos gratis (precio 0) no se pasa por Stripe: el registro queda `gratis` y el correo sale al momento.

**El correo** lleva el boleto con el color del evento, la fecha, la hora, el lugar, el folio, la nota opcional del evento y los botones **Agregar a mi calendario** y **Cómo llegar**, además de un `.ics` adjunto. Las respuestas llegan a general@perpetuo.global.

## Instalación

### 1. Stripe
1. En dashboard.stripe.com, ve a Desarrolladores → Claves de API y copia la **clave secreta**. Para probar, usa la de modo de prueba (`sk_test_…`); para cobrar de verdad, la `sk_live_…`.
2. Mejor todavía: crea una **clave restringida** que solo tenga permiso de escritura en *Checkout Sessions* y de lectura en *Account*.

### 2. Apps Script (desde jl@perpetuo.global)
1. En script.google.com, crea un proyecto llamado "Perpetuo · Eventos" y pega `Eventos.gs`.
2. En Configuración del proyecto:
   - Cambia la zona horaria a `America/Mexico_City`.
   - En Propiedades de la secuencia de comandos, agrega:
     - `STRIPE_SECRET`: la clave del paso 1.
     - `ADMIN_CLAVE`: una clave larga para el panel.
     - Opcional, `SLACK_TOKEN` (la misma de Suscriptores) y `SLACK_CANAL` (por ejemplo `#eventos`) para recibir un aviso con cada boleto.
3. Ejecuta `instalar()` y acepta los permisos. Esto crea la hoja **"Perpetuo · Eventos"** (pestañas Eventos y Registros) y el disparador de cada 10 minutos.
4. Ejecuta `probarStripe()`, que dice si la clave funciona y en qué modo está. Después ejecuta `probarCorreo()`, que te manda un boleto de muestra.
5. Ve a Implementar → Nueva implementación → Aplicación web, con Ejecutar como: **yo** y Quién tiene acceso: **cualquier usuario**.
6. Pega la URL `/exec` en `CONFIG.API_URL` de `assets/comun.js`.

Cada vez que cambie `Eventos.gs`, hay que entrar a Implementar → Administrar implementaciones → editar y elegir **Nueva versión**, para que la URL siga siendo la misma.

### 3. Publicar el sitio
1. Crea el repositorio `Perpetuo-aguante/eventos` y sube esta carpeta.
2. En Settings → Pages, elige Deploy from branch `main` / root. El dominio se toma de `CNAME`.
3. En el DNS de perpetuo.global, agrega un registro `CNAME` con nombre `eventos` que apunte a `perpetuo-aguante.github.io`.
4. Cuando el certificado esté listo, activa **Enforce HTTPS**.

### 4. Prueba completa
Con `sk_test_…`, compra un boleto con la tarjeta `4242 4242 4242 4242` (cualquier fecha futura y cualquier CVC). Revisa que:
- llegue el correo,
- el registro aparezca como `pagado` en el panel,
- y el cupo baje.

Después cambia a `sk_live_…`.

## Para tener en cuenta
- **Límite de correos.** Con una cuenta normal de Gmail, Apps Script manda como máximo unos 100 correos al día. Si un evento grande puede pasar de eso, publica el script desde una cuenta de Google Workspace (1,500 al día) o cambia `mandarBoleto_` a un servicio como Resend. En el panel, "Reenviar" sirve para volver a mandar los que fallen; la columna "Correo" dice cuáles salieron.
- **Reembolsos.** Se hacen en el dashboard de Stripe. Después, en la hoja, cambia el estado del registro a `reembolsado` para liberar el lugar.
- **Precio mínimo.** Stripe no cobra menos de $10 MXN. Para un evento gratis, pon precio 0.
- **Estados de un evento.** *Publicado* aparece en el sitio. *Borrador* y *oculto* no aparecen. Oculto sirve para quitar un evento sin perder sus registros.
- **Imágenes.** Las que se suben desde el panel van a la carpeta de Drive "Perpetuo · Eventos · Imágenes", compartidas con cualquiera que tenga el enlace. Si un evento no tiene imagen, se le genera un póster con su color y su signo.
- **Caché.** La lista pública se guarda 60 segundos en `CacheService` y se borra con cada compra o cambio. En el navegador también se guarda la última versión, para que la cartelera aparezca al instante.
