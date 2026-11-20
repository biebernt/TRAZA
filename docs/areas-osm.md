# Extracción geográfica por área (`GET /api/osm/area`)

Primera pieza de la Fase 0: un área de trabajo deja de ser un punto fijo y pasa a
ser una consulta real a OpenStreetMap, con límites y caché.

No se instala ninguna dependencia. La consulta, la normalización de geometrías y
los cálculos de área y longitud se hacen con JavaScript nativo.

## Uso

```
GET /api/osm/area?bbox=south,west,north,east
```

Ejemplo con el área piloto de Ciudad del Saber:

```bash
curl "http://localhost:5000/api/osm/area?bbox=9.000,-79.585,9.005,-79.580"
```

Respuesta (resumida):

```json
{
  "bbox": { "south": 9, "west": -79.585, "north": 9.005, "east": -79.58 },
  "areaKm2": 0.301,
  "query": "osm-area-v1",
  "source": "OpenStreetMap · Overpass API",
  "attribution": "© OpenStreetMap contributors · ODbL",
  "osmTimestamp": "2026-11-18T00:00:00Z",
  "fetchedAt": "2026-11-18T00:05:00.000Z",
  "cache": { "stale": false, "expiresAt": "2026-11-18T01:05:00.000Z" },
  "counts": { "street": 24, "building": 31, "green": 4, "service": 6 },
  "geometry": { "points": 6, "lines": 24, "polygons": 35 },
  "skipped": { "relations": 2, "invalid": 0, "untagged": 3 },
  "limitations": ["…"],
  "totalFeatures": 65,
  "features": [
    {
      "id": "way/123456",
      "kind": "building",
      "geometryType": "polygon",
      "coordinates": [{ "lat": 9.001, "lon": -79.583 }],
      "centroid": { "lat": 9.0011, "lon": -79.5831 },
      "areaM2": 412,
      "tags": { "building": "yes" }
    }
  ]
}
```

`kind` puede ser `street`, `building`, `green`, `commerce`, `service`, `landuse`,
`natural` u `other`. Las vías peatonales (`footway`, `path`, `pedestrian`, `steps`,
`living_street`, `sidewalk`, `corridor`) añaden `pedestrian: true`.

## Límites y por qué existen

| Límite | Valor por defecto | Variable |
|---|---|---|
| Área máxima | 2 km² | `OSM_MAX_AREA_KM2` |
| Elementos por área | 8 000 | constante del servicio |
| Vértices por geometría | 1 200 (simplificado) | constante del servicio |
| Tamaño de respuesta | 8 MB | constante del servicio |
| Caché | 60 min | constante del servicio |
| Enfriamiento tras fallo | 60 s (30 s si el proveedor responde 429) | constante del servicio |
| Espera del cliente | 45 s | constante del servicio |
| Límite de consulta en Overpass | 30 s | constante del servicio |

El área máxima no es arbitraria: Overpass es un servicio voluntario con un
presupuesto compartido por aplicación (del orden de 100 consultas y 10 MB al día
para uso recurrente, dos consultas simultáneas por IP). Un recinto grande puede
devolver megabytes y tardar decenas de segundos, así que URBI prefiere rechazar el
área con un mensaje claro antes que degradar el servicio o inventar resultados.

Si el área devuelve más elementos de los permitidos, responde `422 area-too-dense`
en lugar de truncar la geometría: un análisis parcial presentado como completo
sería un dato falso.

### Medición real del 18 de noviembre de 2026

Con el área de 0,3 km² de Ciudad del Saber, Overpass respondió en 30–40 s por
la cola del servidor y en otros momentos devolvió el aviso de capacidad en
menos de 200 ms. Dos consecuencias de diseño, ya aplicadas:

- El cliente espera 45 s. Con un límite de 25 s, una espera normal se
  convertía en un `503` falso y se abandonaba una consulta válida.
- El `502` de capacidad es instantáneo y no debe reintentarse en bucle: se
  traduce en `503` con `Retry-After` y enfriamiento.

Sin `User-Agent` propio, Overpass responde `406`; por eso la cabecera es fija
en el servicio.

Extracción real verificada con el servicio (0,305 km² de Ciudad del Saber,
base OSM del 2026-11-18T01:48:18Z): 243 elementos normalizados — 112 calles,
73 edificios, 12 áreas verdes, 30 servicios, 2 comercios y 3 usos de suelo;
88 polígonos con área calculada y 137 líneas con longitud calculada. La primera
tentativa agotó los 45 s de espera y devolvió `503`; la segunda respondió en
33,5 s. Es el comportamiento esperado bajo carga, no un fallo de la consulta.

## Comportamiento ante fallos

- Una sola consulta por área y ventana de caché, incluso con peticiones simultáneas.
- Si el proveedor falla y hay datos anteriores, se devuelven con `cache.stale: true`
  y la fecha original.
- Sin datos anteriores: `503`, cabecera `Retry-After` y código `osm-unavailable`.
- Un `429` se traduce en 30 s de espera; un `5xx` en 60 s.
- Overpass puede responder `200` con un `remark` de consulta incompleta: se rechaza.
- El `User-Agent` identifica a URBI y la consulta va por `POST`, fuera de la URL.

## Almacén de caché

`createAreaService` acepta un `store` con `get`, `set` y `delete`. Por defecto usa
memoria (se pierde al reiniciar). En una fase posterior se puede conectar un
almacén MongoDB sin reescribir el servicio: la clave ya está normalizada a cinco
decimales con `roundBbox`.

## Licencia y atribución

Los datos son de OpenStreetMap bajo ODbL. Cada respuesta incluye `attribution` y
`attributionUrl`; la interfaz debe mostrarlos siempre que pinte estas geometrías.
URBI **no escribe** en OpenStreetMap: las intervenciones del usuario vivirán en
colecciones propias del proyecto.

## Limitaciones conocidas de esta versión

- No se incluyen relaciones OSM (multipolígonos); se cuentan en `skipped.relations`.
- No hay teselas vectoriales: la representación seguirá siendo SVG propio sobre el
  mapa raster existente.
- La caché en memoria no sobrevive reinicios y no se comparte entre procesos.
- No se calculan todavía distancias peatonales por red ni tiempos de caminata.

## Pruebas y verificación sin MongoDB

```bash
cd backend
node --test --test-isolation=none --test-reporter=spec tests/geo.test.js
node --test --test-isolation=none --test-reporter=spec tests/osm.test.js
node --test --test-isolation=none --test-reporter=spec tests/osmRoute.test.js
node --test --test-isolation=none --test-reporter=spec tests/projectSchema.test.js
```

Las pruebas no usan red ni base de datos: el proveedor se inyecta con `fetchImpl`
y el esquema se valida con `validateSync()`.

Para comprobar disponibilidad real del proveedor (una sola consulta, sin bucle):

```bash
node -e "const {createAreaService}=require('./backend/services/osm');createAreaService({}).getArea([9.000,-79.585,9.005,-79.580]).then(r=>console.log(r.totalFeatures,'elementos',r.counts)).catch(e=>console.log('ERROR',e.status,e.code,e.message))"
```
