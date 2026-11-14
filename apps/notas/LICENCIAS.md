# Licencias de recursos visuales e íconos

Última revisión: 5 de noviembre de 2026 (auditoría previa a la versión 1.3).

## 1. Catálogo de íconos y pegatinas (`src/herramientas/iconos/catalogo.js`)

El catálogo tiene 80 íconos vectoriales (viewBox 24 × 24, trazo). Según su procedencia se dividen en tres grupos.

### 1.1 Íconos de Tabler Icons (licencia MIT)

Trece íconos son trazados de la colección **Tabler Icons** (versión 3.50.0, estilo «outline»), copiados sin modificar la forma:

| Ícono del catálogo | Ícono original de Tabler |
|---|---|
| `microscopio` | `microscope` |
| `atomo-bohr` | `atom` |
| `radioactividad` | `radioactive` |
| `jeringa` | `vaccine` |
| `curita-aposito` | `bandage` |
| `bifurcacion` | `arrows-split` |
| `ciclo-3` | `recycle` |
| `chincheta` | `pin` |
| `llave-seguridad` | `key` |
| `mochila` | `backpack` |
| `regla` | `ruler-2` |
| `frasco-jarabe` | `vaccine-bottle` |
| `adn-cadena` | `dna-2` |

Aviso de licencia exigido por la licencia MIT (debe conservarse en toda copia o redistribución de estos trazados):

```
MIT License

Copyright (c) 2020-2026 Paweł Kuna

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### 1.2 Íconos dibujados para el proyecto

Cinco íconos fueron dibujados a mano para Anotomía (no provienen de ninguna colección): `bisturi`, `molecula`, `celula-eucariota`, `neurona` y `gafas-seguridad`. Son obra del proyecto, sin restricciones de terceros.

### 1.3 Íconos heredados de la versión de Google AI Studio (sin procedencia verificada)

Los 62 íconos restantes se generaron durante el desarrollo con Google AI Studio. **No se puede demostrar de qué colección provienen**: algunos (por ejemplo, las flechas, el tilde, la cruz o la lupa) tienen la forma típica de colecciones como Feather o Lucide, que son de código abierto pero exigen conservar su aviso de licencia. La afirmación anterior de que todos eran «MIT / CC0» no estaba respaldada.

Antes de publicar la aplicación de forma abierta se recomienda una de dos vías: reemplazar estos íconos por trazados de una colección con licencia verificada (como se hizo con los de la sección 1.1), o incluir los avisos de Lucide (ISC) y Feather (MIT) en este archivo.

## 2. Tipografías y bibliotecas

- **Tipografías:** Bricolage Grotesque y Source Serif 4, incluidas mediante los paquetes `@fontsource-variable/*` (ver `src/estilos/tipografias.css`). Ambas se distribuyen bajo la licencia SIL Open Font License 1.1, que permite su uso y redistribución con la aplicación. El texto de cada licencia está en `node_modules/@fontsource-variable/<paquete>/LICENSE`.
- **Bibliotecas de código** (React, pdf.js, jsPDF y otras): sus licencias figuran en `package.json` y en `node_modules/<paquete>/LICENSE`. Si se agrega o cambia alguna dependencia o tipografía, debe registrarse aquí.
