# Piloto de caminabilidad: Ciudad del Saber

La primera entrega consulta un inventario real de lugares mediante Overpass API.
No calcula tiempos peatonales, no dibuja todavía un mapa y no demuestra cobertura
de necesidades básicas. Urban Studio y Location Intelligence conservan su funcionamiento.

## Uso

Iniciar el backend en `backend` con su `MONGODB_URI` configurada y `npm start`.
Iniciar el frontend en la raíz con `npm run dev` y abrir **Caminabilidad**.
Pulsar **Consultar servicios**; no se hacen consultas externas por cada render.

`GET /api/walkability/places` consulta un radio geográfico de 1500 metros desde
9.0025, -79.5804. Es un punto de referencia del piloto, no una delimitación oficial.
Incluye educación, salud, alimentos y parques registrados en OpenStreetMap.
Puede incluir lugares fuera del recinto de Ciudad del Saber.
Los centros de edificios/polígonos no equivalen a sus entradas peatonales.
Un resultado vacío no implica ausencia de servicios.

## Red y requisitos

No se añaden dependencias. El backend requiere Node.js con `fetch` nativo
y `AbortSignal.timeout` (el entorno está validado con Node.js 24).
Overpass no requiere clave para esta consulta; permitir `overpass-api.de` por HTTPS.
En entornos con proxy, iniciar con el soporte de proxy de Node.js 24:

```bash
cd /workspace/TRAZA/backend
NODE_USE_ENV_PROXY=1 npm start
```

Conservar el proxy y CA proporcionados por el entorno. En una computadora sin proxy
basta `npm start`. No desactivar TLS. `ORS_API_KEY` no se utiliza ni se expone en
esta entrega: la integración de tiempos de OpenRouteService será posterior.

## Comportamiento ante fallos

- Caché en memoria por 30 minutos, compartida por todos los usuarios del proceso.
- Una solicitud al proveedor para peticiones simultáneas.
- Tiempo límite de 25 segundos; pausa de un minuto después de un fallo.
- Si había datos, se conservan con fecha original y `cache.stale: true`.
- Sin datos anteriores, responde HTTP 503 y `Retry-After`; no inventa un inventario vacío.
- Una respuesta incompleta de Overpass, aunque tenga HTTP 200, se rechaza.
- Reiniciar el backend borra la caché. No hay persistencia de este inventario en MongoDB.
- Atribución OpenStreetMap/ODbL y enlace al registro original en cada tarjeta.

## Validación

```bash
node --test --test-isolation=none --test-reporter=spec backend/tests/walkability.test.js
npm run build
./node_modules/.bin/eslint src
```

Las pruebas de caché y los estados de interfaz utilizan respuestas simuladas.
La disponibilidad del proveedor debe verificarse separadamente con una consulta real.
