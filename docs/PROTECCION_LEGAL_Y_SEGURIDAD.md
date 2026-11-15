# Protección legal y seguridad de Hipocampus, Anotomía y Teclado Científico

Documento de trabajo · 14 de noviembre de 2026 · Elaborado a partir de la auditoría del proyecto `herramientas-estudiantes-fmed`.

> Esto es una guía técnica y organizativa, **no asesoramiento legal**. Los textos de `/legal/*` y `LICENSE` son una base para
> revisar con un/a abogado/a matriculado/a (idealmente con experiencia en propiedad intelectual y datos personales).

## 0. Estado y lista de pendientes (en este orden)

| # | Tarea | Quién | Estado |
|---|---|---|---|
| 1 | Completar `TITULAR` en `app/lib/legal.js` y el nombre en `LICENSE` | Usted | **Pendiente (obligatorio antes de subir)** |
| 2 | Subir este .zip al repositorio y verificar el despliegue | Usted | Pendiente |
| 3 | Activar verificación en dos pasos en GitHub, Vercel, Resend, Google, Instagram/Meta y X | Usted | Pendiente |
| 4 | Decidir el esquema de repositorios (sección 2) | Usted + Claude | Pendiente de decisión |
| 5 | Probar una semana la CSP en modo informe y activarla (sección 4.2) | Usted | Pendiente |
| 6 | Registrar autoría en la DNDA (sección 3.1) | Usted | Recomendado |
| 7 | Revisión de los textos legales por un/a abogado/a (sección 3.4) | Usted | Recomendado |
| 8 | Solicitar marcas en el INPI (sección 3.2) | Usted | Recomendado |
| 9 | Resolver los puntos de las aplicaciones (sección 5) | Claude, con su aprobación | Próxima etapa |

Ya hecho en este .zip: páginas `/legal/terminos`, `/legal/privacidad` y `/legal/derechos-de-autor`; enlaces y aviso de derechos en
el pie; Google Tag Manager retirado (no se usa); cabeceras de seguridad;
CSP en modo informe; `robots.txt` y `security.txt`; formulario de contacto endurecido (origen, tamaño, límite por IP) con aviso de
privacidad; `LICENSE`, `SECURITY.md` y `THIRD_PARTY_NOTICES.md` (68 paquetes, textos de licencia incluidos);
ventana «Legal y licencia» dentro de Anotomía; limpieza de `.idea/` (contenía su nombre de usuario de Windows y rutas locales).

## 1. Qué se puede y qué no se puede proteger

- **El derecho de autor ya lo protege**: nace con la creación de la obra, sin registro (Ley 11.723). Copiar su código o su diseño
  sin permiso es una infracción, aunque se cambien nombres o colores.
- **Un repositorio público no es una licencia**, pero hace que copiar sea trivial y que probar y perseguir la copia sea difícil
  en la práctica. GitHub además permite a cualquiera hacer un «fork» de un repositorio público.
- **Lo que ya se publicó no se puede «despublicar»**: cualquiera pudo clonarlo. Pasarlo a privado frena copias futuras y oculta
  el código de ahora en adelante, pero no borra copias existentes. Lo que sí queda es su prueba de autoría y fechas.
- **El navegador siempre recibe su código web.** Quien abra Anotomía en el navegador descarga su JavaScript (minificado). No se
  puede impedir técnicamente; se desalienta con el repositorio privado, el aviso legal y la posibilidad de reclamar.
- **Los programas de escritorio** (Tauri) y el Teclado (Python con PyInstaller) pueden descompilarse con esfuerzo. Protegen la
  licencia, la firma de las actualizaciones y la posibilidad de reclamar, no la imposibilidad técnica.

## 2. Repositorio: cómo hacerlo privado sin romper las descargas ni las actualizaciones

**Problema:** las aplicaciones ya instaladas y la web buscan versiones en
`https://github.com/Juliancaba20/hipocampus/releases/...` (ver `apps/notas/src-tauri/tauri.conf.json`, `app/teclado/config.js`,
`apps/notas/src/pwa/escritorio.js`, `apps/teclado/teclado_griego.py`). Si ese repositorio pasa a privado, **las descargas y las
actualizaciones automáticas dejan de funcionar** para todos, porque GitHub no entrega «releases» de repositorios privados a
usuarios anónimos.

**Dato de la auditoría:** el `.git` incluido en el .zip apunta a `Juliancaba20/herramientas-estudiantes-fmed`, mientras que las apps y la web
apuntan a `Juliancaba20/hipocampus`. Lo más probable es que sea el mismo repositorio renombrado (GitHub redirige el nombre viejo), pero
**verifíquelo en GitHub** (Settings > General) antes de decidir. Además: el historial (45 *commits*) se revisó con patrones de claves
y tokens y **no se encontraron secretos**, pero sí estaba versionada la carpeta `.idea/` (su usuario de Windows y rutas locales).
Para quitarla del repositorio: `git rm -r --cached .idea` y luego *commit* y *push* (el `.gitignore` nuevo evita que vuelva).

**Esquema recomendado (dos repositorios):**

1. **`hipocampus` (el actual, público):** queda solo como «escaparate de descargas»: contiene únicamente README, `LICENSE` y los
   *releases* (instaladores, `latest.json`). Se conserva la dirección para que las apps instaladas sigan actualizándose.
2. **`hipocampus-fuente` (nuevo, privado):** guarda todo el código, el historial y los flujos de compilación (`.github/workflows`).
3. Los flujos compilan en el privado y **publican los releases en el público** usando un token con permiso mínimo (secreto
   `RELEASES_TOKEN`, un *fine-grained token* con «Contents: read and write» solo sobre el repositorio público). Esto requiere
   modificar los tres flujos de compilación; Claude puede hacerlo en la próxima etapa.
4. **Vercel** se reconecta al repositorio privado. El plan Hobby admite repositorios privados de cuenta personal, pero es solo para
   uso personal **no comercial**: si algún día agrega publicidad, pagos o clientes, hará falta el plan Pro.
5. **Minutos de GitHub Actions:** en repositorios privados el plan gratuito incluye 2.000 minutos Linux por mes; Windows cuenta
   doble y macOS diez veces. Con compilaciones de Windows, Mac, Linux y Android por versión conviene vigilar el consumo
   (Settings > Billing). En el público son ilimitados.

**Pasos para mover el código (en su PC, con Git):**
```
git clone https://github.com/Juliancaba20/hipocampus hipocampus-fuente
cd hipocampus-fuente
# crear en GitHub un repositorio PRIVADO vacío llamado hipocampus-fuente, y luego:
git remote set-url origin https://github.com/Juliancaba20/hipocampus-fuente.git
git push --all origin && git push --tags origin
```
Después, en el repositorio público, reemplazar el contenido por un README y `LICENSE` (commit nuevo, sin el código) y verificar
que los *releases* siguen visibles. Si desea que el historial anterior deje de estar accesible por dirección directa, hay que
reescribirlo y pedir a GitHub Support que purgue las vistas en caché; las copias y forks ya hechos no pueden recuperarse.

**Antes de cualquier cambio:** revise si alguna vez se subió un secreto al historial (el estado actual está limpio: no se
encontraron claves en los archivos). Ejecute en su PC `gitleaks detect` o `trufflehog git file://.` Si aparece algo, **rote la
clave** (Resend, Instagram, CRON_SECRET, claves de firma) en lugar de solo borrarla del repositorio.

**En la cuenta de GitHub:** verificación en dos pasos, protección de la rama `main` (exigir revisión o al menos prohibir
`force-push`), Secret scanning y Dependabot (Settings > Code security).

## 3. Marco legal en Argentina (a confirmar con un/a profesional)

### 3.1 Registro de autoría (DNDA)
La protección es automática, pero registrar da **fecha cierta y prueba de autoría**. La Dirección Nacional del Derecho de Autor
tiene dos trámites para software: *obra inédita* (depósito en custodia, opcional, para código no publicado) y *obra publicada*
(para software ya puesto en conocimiento público). Se inician por la plataforma TAD con CUIL y clave fiscal, con depósito digital
o físico y una tasa. El depósito admite resguardar el código fuente con reserva. Como Anotomía y el Teclado ya están publicados,
corresponde probablemente «obra publicada»; consúltelo en argentina.gob.ar o con un/a abogado/a antes de elegir.
Se registran por separado cada programa y versión relevante; no hace falta registrar cada actualización menor.

### 3.2 Marcas (INPI)
Los nombres «Hipocampus», «Anotomía» y «Teclado Científico» no están protegidos por el derecho de autor como marca. Para
protegerlos frente a terceros se solicita el registro en el INPI (clases de software y de servicios educativos). Primero conviene
hacer una búsqueda de antecedentes para saber si ya existen nombres iguales o parecidos.

### 3.3 Datos personales (Ley 25.326 y AAIP)
El formulario de contacto (correo y mensaje) y las estadísticas implican tratar datos personales. Esto exige informar al titular
de los datos (política publicada en `/legal/privacidad`), obtener su consentimiento y garantizar sus derechos de acceso,
rectificación y supresión. La autoridad de control es la AAIP. La obligación de **inscribir bases de datos** en el Registro
Nacional (arts. 21 y 22) es un punto que conviene confirmar con un/a abogado/a o con la AAIP para su caso concreto (la
inscripción se gestiona por TAD). La ley está en discusión de reforma: revise novedades cada tanto.
Los proveedores (Vercel, Resend, GitHub) están en el exterior: la política ya informa la transferencia internacional.

### 3.4 Revisión profesional
Pida que revisen: licencia y términos (alcance, cláusula de jurisdicción, exclusión de responsabilidad frente a normas de
consumo), la política de privacidad, el aviso de contenido educativo y el uso de las marcas. Es una revisión corta y de costo
acotado, y es lo que da validez práctica a estos documentos. Si algún día cobra o muestra publicidad, vuelva a consultar (consumo,
impuestos, plan Pro de Vercel).

## 4. Seguridad de la web

### 4.1 Cuentas (lo que más suele fallar)
Active verificación en dos pasos en GitHub, Vercel, Resend, Google, Meta/Instagram, X y en el correo
asociado. Use contraseñas únicas en un gestor. Un acceso a GitHub o Vercel equivale a controlar su web y las actualizaciones
de sus apps.

### 4.2 Cabeceras y CSP (`next.config.mjs`)
Ya se aplican: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`.
La **CSP está en modo informe** (no bloquea): navegue el sitio y Anotomía con F12 > Consola abierta durante una semana. Si no
aparecen avisos de «Content Security Policy», cambie `MODO_CSP` a `'Content-Security-Policy'`. Si aparece alguno, avise y se ajusta.

### 4.3 Secretos y API
Los secretos deben vivir solo en Vercel/GitHub Secrets. El formulario valida el origen, el tamaño y limita envíos por IP (límite
simple por instancia). `/api/instagram/publicar` exige `CRON_SECRET`. Conviene además activar en Vercel el *Firewall* con
límite de solicitudes para `/api/*`, y proteger los despliegues de vista previa (Deployment Protection).
`/api/frase-historia` genera imágenes con costo de CPU y es pública: Vercel la cachea, pero el límite de solicitudes la protege.

### 4.4 Dependencias
Active Dependabot y ejecute `npm audit` en la raíz y en `apps/notas` antes de cada versión. Regenere los avisos de terceros con
`node scripts/generar-avisos-terceros.mjs` cuando cambien dependencias.

## 5. Aplicaciones: puntos a resolver (próxima etapa, con su aprobación)

1. **Teclado Científico: autenticidad de las actualizaciones.** Hoy verifica un SHA-256 que informa GitHub, lo que detecta
   descargas corruptas pero **no protege si alguien tomara el control de la cuenta o del release**. Anotomía sí firma sus
   actualizaciones (clave privada en GitHub Secrets). Propuesta: firmar también el Teclado con una clave propia (Ed25519) y que el
   programa verifique la firma con una clave pública incluida. Requiere agregar una dependencia al programa y probar en los tres
   sistemas; no se tocó por el riesgo de dejar a los usuarios sin actualizaciones.
2. **CSP de Anotomía de escritorio:** `tauri.conf.json` tiene `"csp": null` (sin política). Se recomienda definir una, pero hay que
   probarla con `npm run tauri dev` en su PC antes de publicar, porque un error afectaría a todas las instalaciones.
3. **Firma de código:** Windows y macOS muestran avisos de seguridad porque los instaladores no están firmados por un
   desarrollador reconocido. Firmar cuesta dinero (certificado de Windows; Apple Developer para notarizar). Mientras tanto, las
   instrucciones de instalación ya explican los avisos.
4. **Íconos de procedencia no verificada:** `apps/notas/LICENCIAS.md` indica que 62 íconos del catálogo se generaron con Google AI
   Studio sin poder demostrar su origen (algunos parecen de Feather o Lucide, que exigen conservar su aviso). Es el único punto en el
   que usted podría infringir derechos ajenos. Recomendación: reemplazarlos por trazados de una colección con licencia verificada,
   como se hizo con los de Tabler. Mientras tanto, agregar los avisos de Lucide (ISC) y Feather (MIT).
5. **Bibliotecas LGPL en el Teclado (Mac y Linux):** `pynput` y `python-xlib` son LGPL. Se pueden usar en un programa propietario si
   se informa y se permite reemplazarlas; ya figuran en `THIRD_PARTY_NOTICES.md`. Confírmelo en la revisión legal.
6. **Avisos de las bibliotecas de Rust (Tauri):** se generan con `cargo about` al compilar; agregar al flujo de compilación.
7. **Instaladores:** mostrar la licencia en el instalador de Windows (opción de licencia del instalador NSIS de Tauri) y un
   «Acerca de / Legal» en el Teclado Científico, equivalente al de Anotomía.
8. **Respaldo de claves:** guarde fuera de GitHub (en dos lugares) la clave de firma de Anotomía y el `.jks` de Android. Si se
   pierde la de Android, no podrá actualizar la app instalada; si se filtra, hay que rotarla.
