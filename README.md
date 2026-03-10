# Ruta Escolar Montenegro

Proyecto web listo para GitHub Pages.

## Incluye
- Interfaz mobile-first
- GPS con mapa Leaflet
- Mensajes con IA local
- WhatsApp Business por backend
- Modo demo y modo abrir WhatsApp
- Ruta Bachillerato 1 cargada

## Publicación
1. Sube la carpeta a GitHub.
2. Activa GitHub Pages en la rama `main` carpeta `/root`.
3. Abre la web publicada desde el celular.

## Backend
1. Despliega `backend/cloudflare-worker.js` en Cloudflare Workers.
2. Crea los secretos:
   - API_KEY
   - PHONE_NUMBER_ID
   - WHATSAPP_TOKEN
3. Copia la URL del Worker en la web.
4. En la interfaz selecciona `WhatsApp Business`.
5. Usa `Probar conexión`.

## Nota
Para que el GPS funcione bien, la página debe abrirse desde HTTPS o desde GitHub Pages.
