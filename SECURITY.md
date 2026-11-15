# Política de seguridad

## Cómo informar una vulnerabilidad
Use el formulario de contacto del sitio (`/contacto`), elija «Otro motivo» y comience el mensaje con «SEGURIDAD».
No publique el problema ni lo explote antes de que se haya podido corregir. Se responderá a la brevedad.

## Qué está dentro del alcance
El sitio web, la API (`/api/*`), Anotomía (web, escritorio y Android) y Teclado Científico, incluido su mecanismo de actualización.

## Buenas prácticas del proyecto
- Los secretos (`RESEND_API_KEY`, `CRON_SECRET`, `INSTAGRAM_ACCESS_TOKEN`, claves de firma) viven solo en Vercel y en GitHub Secrets; nunca en el código.
- Las claves de firma de las actualizaciones (`*.key`, `*.jks`) se guardan fuera del repositorio.
- Las actualizaciones de Anotomía se verifican con firma digital (Tauri updater).
