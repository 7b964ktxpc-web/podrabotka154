'use client';

import Link from 'next/link';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import type { Job } from '@/lib/types';

export function JobsMap({ jobs }: { jobs: Job[] }) {
  // На карту попадают только точные координаты. Район, метро и ориентир
  // остаются в списке вакансий и не превращаются в ложную точку.
  const mapped = jobs.filter(
    j => j.location_precision === 'exact' && Number.isFinite(j.latitude) && Number.isFinite(j.longitude),
  );
  const center: [number, number] = mapped.length
    ? [Number(mapped[0].latitude), Number(mapped[0].longitude)]
    : [55.0302, 82.9204];

  return (
    <section className="jobs-map" aria-label="Карта подработки">
      <div className="jobs-map-head">
        <div>
          <span className="eyebrow">Карта</span>
          <h2>Подработка рядом</h2>
        </div>
        <span className="count">{mapped.length} точных точек</span>
      </div>
      <div className="jobs-map-frame">
        <MapContainer center={center} zoom={11} scrollWheelZoom className="leaflet-map">
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {mapped.map(job => (
            <CircleMarker
              key={job.id}
              center={[Number(job.latitude), Number(job.longitude)]}
              radius={9}
              pathOptions={{ weight: 3, fillOpacity: 0.9 }}
            >
              <Popup>
                <div className="map-popup">
                  <strong>{job.title}</strong>
                  {job.salary_max || job.salary_min ? (
                    <span>{job.salary_min && job.salary_max ? `${job.salary_min}–${job.salary_max} ₽` : `${job.salary_min || job.salary_max} ₽`}</span>
                  ) : null}
                  {job.address_raw || job.address_normalized ? <small>{job.address_raw || job.address_normalized}</small> : null}
                  <Link href={`/jobs/${job.id}`}>Открыть вакансию →</Link>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
        {!mapped.length && (
          <div className="jobs-map-empty">
            <strong>Точных координат пока нет</strong>
            <span>Если в вакансии указан только район, метро или ориентир, она остаётся в списке без ложной точности на карте.</span>
          </div>
        )}
      </div>
    </section>
  );
}
