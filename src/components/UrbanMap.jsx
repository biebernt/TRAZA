import { useEffect, useMemo, useRef, useState } from "react";
import "./UrbanMap.css";

const INITIAL_CENTER = {
    lat: 8.99958,
    lon: -79.58348,
};

const INITIAL_ZOOM = 16;
const TILE_SIZE = 256;
const MIN_ZOOM = 13;
const MAX_ZOOM = 19;

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
}) {
    const mapRef = useRef(null);
    const dragRef = useRef(null);

    const [center, setCenter] = useState(INITIAL_CENTER);
    const [zoom, setZoom] = useState(INITIAL_ZOOM);
    const [size, setSize] = useState({ width: 0, height: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [suppressClick, setSuppressClick] = useState(false);

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

    function handlePointerDown(event) {
        if (event.button !== 0) return;

        const centerPixel = latLonToPixel(
            center.lat,
            center.lon,
            zoom
        );

        dragRef.current = {
            pointerX: event.clientX,
            pointerY: event.clientY,
            centerX: centerPixel.x,
            centerY: centerPixel.y,
            lastX: event.clientX,
            lastY: event.clientY,
        };

        event.currentTarget.setPointerCapture(event.pointerId);
        setIsDragging(true);
    }

    function handlePointerMove(event) {
        if (!dragRef.current) return;

        const drag = dragRef.current;
        drag.lastX = event.clientX;
        drag.lastY = event.clientY;

        const deltaX = event.clientX - drag.pointerX;
        const deltaY = event.clientY - drag.pointerY;

        const nextCenter = pixelToLatLon(
            drag.centerX - deltaX,
            drag.centerY - deltaY,
            zoom
        );

        setCenter(nextCenter);
    }

    function handlePointerUp() {
        if (dragRef.current) {
            const drag = dragRef.current;

            const moved =
                Math.abs(drag.pointerX - drag.lastX) > 5 ||
                Math.abs(drag.pointerY - drag.lastY) > 5;

            if (moved) {
                setSuppressClick(true);
            }
        }
        dragRef.current = null;
        setIsDragging(false)
    }

    function zoomIn() {
        setZoom((current) => Math.min(current + 1, MAX_ZOOM));
    }

    function zoomOut() {
        setZoom((current) => Math.max(current - 1, MIN_ZOOM));
    }

    function resetView() {
        setCenter(INITIAL_CENTER);
        setZoom(INITIAL_ZOOM);
    }

    function handleMapClick(event) {

        if (suppressClick) {
            setSuppressClick(false);
            return;
        }

        if (!mapRef.current || !onAddFeature) return;

        const rect = mapRef.current.getBoundingClientRect();

        const centerPixel = latLonToPixel(
            center.lat,
            center.lon,
            zoom
        );

        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;

        const worldX =
            centerPixel.x + clickX - rect.width / 2;

        const worldY =
            centerPixel.y + clickY - rect.height / 2;

        const coordinates = pixelToLatLon(
            worldX,
            worldY,
            zoom
        );

        onAddFeature({
            id: `${Date.now()}-${Math.random()}`,
            type: selectedTool,
            lat: coordinates.lat,
            lon: coordinates.lon,
        });
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

    const featureIcons = {
        road: "🛣️",
        house: "🏠",
        business: "🏢",
        park: "🌳",
        school: "🏫",
    };

    return (
        <section className="urban-map-section">
            <div className="urban-map-heading">
                <div>
                    <span className="traza-kicker">MAPA INTERACTIVO</span>
                    <h2>Ciudad del Saber</h2>
                    <p>
                        Explora el área y prepara tu escenario de planificación
                        urbana.
                    </p>
                </div>

                <button
                    type="button"
                    className="urban-map-reset"
                    onClick={resetView}
                >
                    Restablecer vista
                </button>
            </div>

            <div
                ref={mapRef}
                className={`urban-map-canvas ${isDragging ? "is-dragging" : ""
                    }`}
                onClick={handleMapClick}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
            >
                <div className="urban-map-tiles">
                    {tiles.map((tile) => (
                        <img
                            key={tile.key}
                            src={tile.url}
                            alt=""
                            draggable="false"
                            className="urban-map-tile"
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

                        return (
                            <button
                                key={feature.id}
                                type="button"
                                className="urban-map-feature"
                                style={{
                                    left: `${position.left}px`,
                                    top: `${position.top}px`,
                                }}
                                title={`Eliminar ${feature.type}`}
                                aria-label={`Eliminar elemento ${feature.type}`}
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onRemoveFeature?.(feature.id);
                                }}
                            >
                                {featureIcons[feature.type] || "📍"}
                            </button>
                        );
                    })}
                </div>

                <div
                    className="urban-map-controls"
                    onPointerDown={(event) => event.stopPropagation()}
                    onPointerMove={(event) => event.stopPropagation()}
                    onPointerUp={(event) => event.stopPropagation()}
                >
                    <button
                        type="button"
                        onClick={zoomIn}
                        disabled={zoom >= MAX_ZOOM}
                        aria-label="Acercar mapa"
                    >
                        +
                    </button>

                    <button
                        type="button"
                        onClick={zoomOut}
                        disabled={zoom <= MIN_ZOOM}
                        aria-label="Alejar mapa"
                    >
                        −
                    </button>
                </div>

                <div className="urban-map-zoom-label">
                    Zoom {zoom}
                </div>

                <div className="urban-map-attribution">
                    © <a
                        href="https://www.openstreetmap.org/copyright"
                        target="_blank"
                        rel="noreferrer"
                    >
                        OpenStreetMap
                    </a> contributors
                </div>
            </div>

            <p className="urban-map-instructions">
                Arrastra el mapa para desplazarte. Utiliza los botones + y −
                para cambiar el nivel de acercamiento.
            </p>
        </section>
    );
}