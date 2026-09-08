# PROT CARD

Landing estática de PROT CARD (cubrecárteres). Es un canvas de Claude Design (`.dc.html`) que se auto-hidrata en el browser cargando React 18 desde unpkg vía `support.js`.

## Estructura

- `index.html` — copia de `PROT CARD.dc.html` para servir en la raíz.
- `PROT CARD.dc.html` — archivo original del canvas (mismo contenido).
- `support.js` — runtime de dc (React loader + hidratador).
- `_ds/…` — bundle del design system + estilos.
- `assets/` — imágenes, logos, marcas, fotos.
- `uploads/` — assets subidos originalmente en el canvas.
- `vercel.json` — cache headers para assets inmutables.

## Deploy en Vercel

1. Importar este repo en https://vercel.com/new.
2. Framework preset: **Other** (sin build).
3. Output directory: raíz (default).
4. Deploy.

No hay build step, no hay variables de entorno.

## Desarrollo local

```bash
python3 -m http.server 8000
```

Abrir http://localhost:8000/ (o http://localhost:8000/PROT%20CARD.dc.html).

## Auditoría rápida

- ✅ Sin dependencias de servidor.
- ✅ Sin secretos ni claves en el código.
- ⚠️ `support.js` carga React y ReactDOM 18.3.1 desde `unpkg.com` con SRI — bloqueo de unpkg rompe la página. Si preocupa la disponibilidad, vendor esas dos URLs localmente.
- ⚠️ Fuentes cargadas desde Google Fonts.
- 📦 ~14 MB en assets/uploads (mayoría son las mismas fotos duplicadas entre `assets/fotos/`, `assets/img/` y `uploads/`). Se puede podar sin romper la página revisando qué paths usa `index.html`.
