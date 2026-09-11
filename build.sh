#!/usr/bin/env bash
# PROTCARD — build: copia los archivos desplegables a dist/.
# Sitio estático (sin bundler): el "build" es armar la carpeta dist/
# con todo lo que se sube al hosting. Ejecutá:  bash build.sh
set -euo pipefail

DIST="dist"

rm -rf "$DIST"
mkdir -p "$DIST"

# Archivos sueltos de la raíz que se sirven al público.
cp \
  index.html \
  favicon.svg \
  .htaccess \
  support.js \
  pc-dropdown.js \
  pc-enhance.js \
  pc-enhance.css \
  pc-supabase.js \
  pc-supabase-config.js \
  "$DIST"/

# Carpetas completas.
cp -r admin  "$DIST"/
cp -r assets "$DIST"/
cp -r _ds    "$DIST"/

# SCHEMA.sql es documentación interna, no se publica.
rm -f "$DIST"/admin/SCHEMA.sql

echo "Build listo en ./$DIST/"
