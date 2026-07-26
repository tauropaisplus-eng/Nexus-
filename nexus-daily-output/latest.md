# NEXUS Daily — 2026-07-26

**NEXUS Daily — Resumen ejecutivo**

No se pudo extraer contenido real de titulares: lo recibido son solo fragmentos de código HTML (metadatos, headers, links de CSS/favicon), no el cuerpo de las noticias.

Estado por fuente:
- **Infobae Tecno**: solo head del sitio, sin notas visibles.
- **La Nación Tecnología**: se cuela una imagen sobre "semifinal del Mundial 2026", ajena a tech — posible error de scraping.
- **Inteligencia Argentina**: solo metadata (og:title, favicon), sin texto de artículos.
- **RedUsers**: solo hojas de estilo y config del theme.
- **KeepCoding**: script de compatibilidad IE, nada de contenido.
- **Investing.com**: error 403, bloqueado.

**Conclusión**: el crawler está capturando el `<head>` de las páginas, no el `<body>` con las notas. Hace falta ajustar el scraping (esperar renderizado JS o apuntar a selectores de artículos) para poder armar un resumen real de titulares.
