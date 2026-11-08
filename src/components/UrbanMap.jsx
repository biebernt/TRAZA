import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CELL_TYPES } from "../utils/urbanAnalysis";
import "./UrbanMap.css";

const INITIAL_CENTER = {
    lat: 8.99958,
    lon: -79.58348,
};

const INITIAL_ZOOM = 16;
const TILE_SIZE = 256;
const MIN_ZOOM = 13;
const MAX_ZOOM = 19;
const DRAG_THRESHOLD = 5;
const KEYBOARD_PAN = 90;
const CLICK_AFTER_DRAG_MS = 350;

const FEATURE_ICONS = {
    road: "🛣️",
    house: "🏠",
    business: "🏢",
    park: "🌳",
    school: "🏫",
};

function featureLabel(type) {
    return CELL_TYPES[type]?.label ?? "Elemento";
}

function featureColor(type) {
    return CELL_TYPES[type]?.color ?? "#159c83";
}

function latLonToPixel(lat, lon, zoom) {
    const scale = TILE_SIZE * 2 ** zoom;
    const safeLat = Math.max(-85.0511, Math.min(85.0511, lat));
    const sinLat = Math.sin((safeLat * Math.PI) / 180);

    return {
        x: ((lon + 180) / 360) * scale,
        y:
            (0.5 -
                Math.log((1 + sinLat) / (1 - sinLat)) /
                (4 * Math.PI)) *
            scale,
    };
}

function pixelToLatLon(x, y, zoom) {
    const scale = TILE_SIZE * 2 ** zoom;
    const lon = (x / scale) * 360 - 180;
    const n = Math.PI - (2 * Math.PI * y) / scale;
    const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));

    return { lat, lon };
}

function wrapTileX(x, total) {
    return ((x % total) + total) % total;
}

export default function UrbanMap({
    features = [],
    selectedTool = "house",
    onAddFeature,
    onRemoveFeature,
    onClearFeatures,
}) {
    const mapRef = useRef(null);
    const dragRef = useRef(null);
    const lastDragEndRef = useRef(0);

    const [center, setCenter] = useState(INITIAL_CENTER);
    const [zoom, setZoom] = useState(INITIAL_ZOOM);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [tilesState, setTilesState] = useState("loading");
    const [announcement, setAnnouncement] = useState("");

    const isIdle = selectedTool === "empty";

    useEffect(() => {
        const element = mapRef.current;
        if (!element) return;

        const observer = new ResizeObserver(([entry]) => {
            setSize({
                width: entry.contentRect.width,
                height: entry.contentRect.height,
            });
        });

        observer.observe(element);

        return () => observer.disconnect();
    }, []);

    const tiles = useMemo(() => {
        if (!size.width || !size.height) return [];

        const centerPixel = latLonToPixel(
            center.lat,
            center.lon,
            zoom
        );

        const left = centerPixel.x - size.width / 2;
        const top = centerPixel.y - size.height / 2;

        const startX = Math.floor(left / TILE_SIZE) - 1;
        const endX =
            Math.floor((left + size.width) / TILE_SIZE) + 1;

        const startY = Math.floor(top / TILE_SIZE) - 1;
        const endY =
            Math.floor((top + size.height) / TILE_SIZE) + 1;

        const totalTiles = 2 ** zoom;
        const result = [];

        for (let x = startX; x <= endX; x++) {
            for (let y = startY; y <= endY; y++) {
                if (y < 0 || y >= totalTiles) continue;

                result.push({
                    key: `${zoom}-${x}-${y}`,
                    url: `https://tile.openstreetmap.org/${zoom}/${wrapTileX(
                        x,
                        totalTiles
                    )}/${y}.png`,
                    left: x * TILE_SIZE - left,
                    top: y * TILE_SIZE - top,
                });
            }
        }

        return result;
    }, [center, zoom, size]);

    const zoomAt = useCallback(
        (nextZoom, anchorX, anchorY) => {
            const target = Math.max(
                MIN_ZOOM,
                Math.min(MAX_ZOOM, nextZoom)
            );

            if (target === zoom) return;

            if (!size.width || !size.height) {
                setZoom(target);
                return;
            }

            const offsetX =
                (anchorX ?? size.width / 2) - size.width / 2;
            const offsetY =
                (anchorY ?? size.height / 2) - size.height / 2;

            const centerPixel = latLonToPixel(
                center.lat,
                center.lon,
                zoom
            );

            const anchor = pixelToLatLon(
                centerPixel.x + offsetX,
                centerPixel.y + offsetY,
                zoom
            );

            const anchorPixel = latLonToPixel(
                anchor.lat,
                anchor.lon,
                target
            );

            setCenter(
                pixelToLatLon(
                    anchorPixel.x - offsetX,
                    anchorPixel.y - offsetY,
                    target
                )
            );
            setZoom(target);
        },
        [center, zoom, size]
    );

    // La rueda del ratón necesita un listener no pasivo para no desplazar la página.
    useEffect(() => {
        const element = mapRef.current;
        if (!element) return;

        function handleWheel(event) {
            event.preventDefault();

            const rect = element.getBoundingClientRect();
            const step = event.deltaY > 0 ? -1 : 1;

            zoomAt(
                zoom + step,
                event.clientX - rect.left,
                event.clientY - rect.top
            );
        }

        element.addEventListener("wheel", handleWheel, {
            passive: false,
        });

        return () => element.removeEventListener("wheel", handleWheel);
    }, [zoom, zoomAt]);

    function panBy(deltaX, deltaY) {
        const centerPixel = latLonToPixel(
            center.lat,
            center.lon,
            zoom
        );

        setCenter(
            pixelToLatLon(
                centerPixel.x + deltaX,
                centerPixel.y + deltaY,
                zoom
            )
        );
    }

    function handlePointerDown(event) {
        if (event.button !== 0) return;

        const centerPixel = latLonToPixel(
            center.lat,
            center.lon,
            zoom
        );

        dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            centerX: centerPixel.x,
            centerY: centerPixel.y,
            moved: false,
        };

        event.currentTarget.setPointerCapture(event.pointerId);
        setIsDragging(true);
    }

    function handlePointerMove(event) {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;

        const deltaX = event.clientX - drag.startX;
        const deltaY = event.clientY - drag.startY;

        if (
            Math.abs(deltaX) > DRAG_THRESHOLD ||
            Math.abs(deltaY) > DRAG_THRESHOLD
        ) {
            drag.moved = true;
        }

        setCenter(
            pixelToLatLon(
                drag.centerX - deltaX,
                drag.centerY - deltaY,
                zoom
            )
        );
    }

    function handlePointerUp(event) {
        const drag = dragRef.current;
        if (!drag) return;

        dragRef.current = null;
        setIsDragging(false);

        // Un arrastre no debe colocar un elemento al soltar el puntero.
        if (drag.moved) {
            lastDragEndRef.current = Date.now();
        }

        if (
            event.currentTarget.hasPointerCapture?.(drag.pointerId)
        ) {
            event.currentTarget.releasePointerCapture(
                drag.pointerId
            );
        }
    }

    function placeFeatureAt(offsetX, offsetY) {
        if (!mapRef.current || !onAddFeature) return false;

        if (isIdle) {
            setAnnouncement(
                "Selecciona una herramienta de construcción para colocar elementos."
            );
            return false;
        }

        const centerPixel = latLonToPixel(
            center.lat,
            center.lon,
            zoom
        );

        const coordinates = pixelToLatLon(
            centerPixel.x + offsetX - size.width / 2,
            centerPixel.y + offsetY - size.height / 2,
            zoom
        );

        onAddFeature({
            id: `${Date.now()}-${Math.random()
                .toString(36)
                .slice(2, 8)}`,
            type: selectedTool,
            lat: coordinates.lat,
            lon: coordinates.lon,
        });

        setAnnouncement(
            `${featureLabel(selectedTool)} añadido al mapa.`
        );

        return true;
    }

    function handleMapClick(event) {
        if (Date.now() - lastDragEndRef.current < CLICK_AFTER_DRAG_MS) {
            return;
        }

        if (!mapRef.current) return;

        const rect = mapRef.current.getBoundingClientRect();

        placeFeatureAt(
            event.clientX - rect.left,
            event.clientY - rect.top
        );
    }

    function handleKeyDown(event) {
        if (event.target !== event.currentTarget) return;

        const step = event.shiftKey
            ? KEYBOARD_PAN * 2
            : KEYBOARD_PAN;

        switch (event.key) {
            case "ArrowLeft":
                event.preventDefault();
                panBy(-step, 0);
                break;
            case "ArrowRight":
                event.preventDefault();
                panBy(step, 0);
                break;
            case "ArrowUp":
                event.preventDefault();
                panBy(0, -step);
                break;
            case "ArrowDown":
                event.preventDefault();
                panBy(0, step);
                break;
            case "+":
            case "=":
                event.preventDefault();
                zoomAt(zoom + 1);
                break;
            case "-":
            case "_":
                event.preventDefault();
                zoomAt(zoom - 1);
                break;
            case "Enter":
            case " ":
                event.preventDefault();
                placeFeatureAt(size.width / 2, size.height / 2);
                break;
            default:
                break;
        }
    }

    function getFeaturePosition(feature) {
        const centerPixel = latLonToPixel(
            center.lat,
            center.lon,
            zoom
        );

        const featurePixel = latLonToPixel(
            feature.lat,
            feature.lon,
            zoom
        );

        return {
            left:
                featurePixel.x - centerPixel.x + size.width / 2,
            top:
                featurePixel.y - centerPixel.y + size.height / 2,
        };
    }

    function removeFeature(feature) {
        onRemoveFeature?.(feature.id);
        setAnnouncement(
            `${featureLabel(feature.type)} eliminado del mapa.`
        );
    }

    function clearFeatures() {
        if (!features.length) return;

        onClearFeatures?.();
        setAnnouncement("Se quitaron todos los elementos del mapa.");
    }

    const placedGroups = useMemo(() => {
        const counts = new Map();

        features.forEach(({ type }) => {
            counts.set(type, (counts.get(type) ?? 0) + 1);
        });

        return [...counts.entries()];
    }, [features]);

    function handleTileLoad() {
        setTilesState((current) =>
            current === "loading" ? "ready" : current
        );
    }

    function handleTileError() {
        setTilesState((current) =>
            current === "ready" ? current : "error"
        );
    }

    return (
        <section className="urban-map-section" aria-labelledby="urban-map-title">
            <div className="urban-map-heading">
                <div>
                    <span className="traza-kicker">MAPA INTERACTIVO</span>
                    <h2 id="urban-map-title">Ciudad del Saber</h2>
                    <p>
                        Explora el área y prepara tu escenario de planificación
                        urbana.
                    </p>
                </div>

                <button
                    type="button"
                    className="urban-map-reset"
                    onClick={() => {
                        setCenter(INITIAL_CENTER);
                        setZoom(INITIAL_ZOOM);
                        setAnnouncement("Vista del mapa restablecida.");
                    }}
                >
                    Restablecer vista
                </button>
            </div>

            <div
                ref={mapRef}
                className={[
                    "urban-map-canvas",
                    isDragging ? "is-dragging" : "",
                    isIdle ? "is-idle" : "is-placing",
                ]
                    .filter(Boolean)
                    .join(" ")}
                role="region"
                aria-label="Mapa interactivo de Ciudad del Saber"
                aria-describedby="urban-map-instructions"
                tabIndex={0}
                onClick={handleMapClick}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onKeyDown={handleKeyDown}
            >
                <div className="urban-map-tiles">
                    {tiles.map((tile) => (
                        <img
                            key={tile.key}
                            src={tile.url}
                            alt=""
                            draggable="false"
                            loading="eager"
                            decoding="async"
                            className="urban-map-tile"
                            onLoad={handleTileLoad}
                            onError={handleTileError}
                            style={{
                                left: `${tile.left}px`,
                                top: `${tile.top}px`,
                            }}
                        />
                    ))}
                </div>

                <div className="urban-map-features">
                    {features.map((feature) => {
                        const position = getFeaturePosition(feature);
                        const label = featureLabel(feature.type);

                        return (
                            <button
                                key={feature.id}
                                type="button"
                                className="urban-map-feature"
                                style={{
                                    left: `${position.left}px`,
                                    top: `${position.top}px`,
                                    "--feature-color": featureColor(
                                        feature.type
                                    ),
                                }}
                                title={`Quitar ${label}`}
                                aria-label={`Quitar ${label} del mapa`}
                                onPointerDown={(event) =>
                                    event.stopPropagation()
                                }
                                onClick={(event) => {
                                    event.stopPropagation();
                                    removeFeature(feature);
                                }}
                            >
                                {FEATURE_ICONS[feature.type] || "📍"}
                            </button>
                        );
                    })}
                </div>

                <div
                    className="urban-map-controls"
                    onPointerDown={(event) => event.stopPropagation()}
                    onPointerMove={(event) => event.stopPropagation()}
                    onPointerUp={(event) => event.stopPropagation()}
                    onClick={(event) => event.stopPropagation()}
                >
                    <button
                        type="button"
                        onClick={() => zoomAt(zoom + 1)}
                        disabled={zoom >= MAX_ZOOM}
                        aria-label="Acercar mapa"
                    >
                        +
                    </button>

                    <button
                        type="button"
                        onClick={() => zoomAt(zoom - 1)}
                        disabled={zoom <= MIN_ZOOM}
                        aria-label="Alejar mapa"
                    >
                        −
                    </button>
                </div>

                <div className="urban-map-zoom-label">
                    Zoom {zoom}
                </div>

                <div className="urban-map-tool-hint">
                    <span
                        className="urban-map-tool-dot"
                        style={{
                            background: isIdle
                                ? "#cbd5df"
                                : featureColor(selectedTool),
                        }}
                        aria-hidden="true"
                    />
                    {isIdle
                        ? "Sin herramienta activa"
                        : `Colocando: ${featureLabel(selectedTool)}`}
                </div>

                {tilesState !== "ready" && (
                    <div className="urban-map-tile-status" role="status">
                        {tilesState === "error"
                            ? "No se pudo cargar el mapa base. Revisa tu conexión."
                            : "Cargando mapa…"}
                    </div>
                )}

                <div
                    className="urban-map-attribution"
                    onClick={(event) => event.stopPropagation()}
                >
                    ©{" "}
                    <a
                        href="https://www.openstreetmap.org/copyright"
                        target="_blank"
                        rel="noreferrer"
                    >
                        OpenStreetMap
                    </a>{" "}
                    contributors
                </div>
            </div>

            {features.length > 0 && (
                <div className="urban-map-legend">
                    <p className="urban-map-legend-title">
                        {features.length}{" "}
                        {features.length === 1
                            ? "elemento colocado"
                            : "elementos colocados"}
                    </p>

                    <ul>
                        {placedGroups.map(([type, count]) => (
                            <li key={type}>
                                <span
                                    className="urban-map-legend-dot"
                                    style={{
                                        background: featureColor(type),
                                    }}
                                    aria-hidden="true"
                                />
                                {featureLabel(type)}
                                <strong>{count}</strong>
                            </li>
                        ))}
                    </ul>

                    <button
                        type="button"
                        className="urban-map-legend-clear"
                        onClick={clearFeatures}
                    >
                        Quitar todos
                    </button>
                </div>
            )}

            <p
                className="urban-map-instructions"
                id="urban-map-instructions"
            >
                Arrastra el mapa para desplazarte y usa la rueda o los
                botones + y − para cambiar el acercamiento. Con el teclado,
                las flechas desplazan el mapa, + y − ajustan el zoom e Intro
                coloca el elemento seleccionado en el centro. Haz clic en el
                mapa para colocar un elemento y en un marcador para quitarlo.
            </p>

            <p className="traza-sr-only" role="status">
                {announcement}
            </p>
        </section>
    );
}
