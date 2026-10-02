"use client";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { useLanguage } from "./LanguageProvider";
export type MapPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  href?: string;
  image?: string;
  description?: string;
};
export default function MapView({
  places,
  focusId,
  onSelect,
}: {
  places: MapPoint[];
  focusId?: string;
  onSelect?: (point: MapPoint) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(0);
  const mapRef = useRef<L.Map | null>(null);
  const markers = useRef<Map<string, L.Marker>>(new Map());
  const group = useRef<L.MarkerClusterGroup | null>(null);
  const callback = useRef(onSelect);
  callback.current = onSelect;
  const { locale, t } = useLanguage();
  useEffect(() => {
    if (!container.current) return;
    let disposed = false;
    let observer: ResizeObserver | undefined;
    const map = L.map(container.current, {
      scrollWheelZoom: false,
      zoomControl: false,
    }).setView([16.15, 107.8], 6);
    L.control.zoom({ position: "topright" }).addTo(map);
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map);
    async function addMarkers() {
      (window as unknown as { L: typeof L }).L = L;
      await import("leaflet.markercluster");
      if (disposed) return;
      const cluster = L.markerClusterGroup({
        iconCreateFunction: (cluster) =>
          L.divIcon({
            className: "atlas-cluster",
            html: `<span>${cluster.getChildCount()}</span>`,
            iconSize: [44, 44],
          }),
        showCoverageOnHover: false,
        animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        maxClusterRadius: 45,
      });
      group.current = cluster;
      markers.current.clear();
      for (const point of places) {
        const box = document.createElement("div");
        if (point.image) {
          const img = document.createElement("img");
          img.src = point.image;
          img.alt = point.name;
          img.style.cssText =
            "width:190px;height:100px;object-fit:cover;margin-bottom:10px";
          box.append(img);
        }
        const title = document.createElement("strong");
        title.textContent = point.name;
        box.append(title);
        if (point.description) {
          const p = document.createElement("p");
          p.textContent = point.description.slice(0, 140);
          box.append(p);
        }
        if (point.href) {
          const link = document.createElement("a");
          link.textContent = locale === "vi" ? "Khám phá ↗" : "Discover ↗";
          link.href = point.href;
          link.className = "popup-button";
          box.append(link);
        } else if (callback.current) {
          const button = document.createElement("button");
          button.textContent = locale === "vi" ? "Khám phá ↗" : "Discover ↗";
          button.onclick = () => callback.current?.(point);
          box.append(button);
        }
        const marker = L.marker([point.lat, point.lng], {
          title: point.name,
          alt: point.name,
          icon: L.divIcon({
            className: "atlas-marker",
            html: "<span></span>",
            iconSize: [22, 22],
          }),
        }).bindPopup(box);
        markers.current.set(point.id, marker);
        cluster.addLayer(marker);
      }
      map.addLayer(cluster);
      if (places.length === 1) map.setView([places[0].lat, places[0].lng], 11);
      else if (places.length > 1)
        map.fitBounds(cluster.getBounds(), { padding: [40, 40], maxZoom: 10 });
      observer = new ResizeObserver(() => map.invalidateSize());
      if (container.current) observer.observe(container.current);
      setReady((value) => value + 1);
    }
    void addMarkers();
    return () => {
      disposed = true;
      observer?.disconnect();
      map.remove();
      mapRef.current = null;
      markers.current.clear();
    };
  }, [places, locale]);
  useEffect(() => {
    if (!focusId) return;
    const marker = markers.current.get(focusId);
    if (!marker || !mapRef.current) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    group.current?.zoomToShowLayer(marker, () => {
      mapRef.current?.flyTo(
        marker.getLatLng(),
        Math.max(mapRef.current.getZoom(), 12),
        { duration: reduced ? 0 : 0.8, animate: !reduced },
      );
      marker.openPopup();
    });
  }, [focusId, ready]);
  return (
    <div
      className="map-canvas"
      ref={container}
      role="region"
      aria-label={t(
        "Bản đồ địa danh; danh sách văn bản cung cấp cùng liên kết",
        "Destination map; the text list provides the same links",
      )}
    />
  );
}
