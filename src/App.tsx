import { useEffect, useMemo, useState } from 'react'
import { geoMercator, geoPath } from 'd3-geo'
import type { FeatureCollection, Geometry } from 'geojson'

type Props = { ADM2_EN: string; ADM1_EN: string }
type FC = FeatureCollection<Geometry, Props>

export default function App() {
  const [data, setData] = useState<FC | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })

  useEffect(() => {
    fetch('/data/bd-districts.json').then((r) => r.json()).then(setData)
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const map = useMemo(() => {
    if (!data) return null
    const pad = 12
    const projection = geoMercator().fitExtent(
      [[pad, pad], [size.w - pad, size.h - pad]],
      data
    )
    const path = geoPath(projection)
    const [[x0, y0], [x1, y1]] = path.bounds(data)
    const bw = x1 - x0
    const bh = y1 - y0
    const fw = Math.max(bw, (bh * 10) / 6)
    const fh = fw * 0.6
    const fx = x0 + bw / 2 - fw / 2
    const fy = y0 + bh / 2 - fh / 2
    return {
      paths: data.features.map((f) => ({ name: f.properties.ADM2_EN, d: path(f) ?? '' })),
      flag: { fx, fy, fw, fh },
    }
  }, [data, size])

  return (
    <div className="fixed inset-0 bg-neutral-950">
      <svg width={size.w} height={size.h} className="block touch-manipulation">
        {map && (
          <>
            <defs>
              <clipPath id="bd">
                {map.paths.map((p) => (
                  <path key={p.name} d={p.d} />
                ))}
              </clipPath>
            </defs>
            <g clipPath="url(#bd)">
              <rect x={map.flag.fx} y={map.flag.fy} width={map.flag.fw} height={map.flag.fh} fill="#006a4e" />
              <circle
                cx={map.flag.fx + map.flag.fw / 2}
                cy={map.flag.fy + map.flag.fh / 2}
                r={map.flag.fh * 0.15}
                fill="#f42a41"
              />
            </g>
            {map.paths.map((p) => (
              <path
                key={p.name}
                d={p.d}
                fill={selected === p.name ? 'rgba(255,255,255,0.45)' : 'transparent'}
                stroke="white"
                strokeOpacity={selected === p.name ? 1 : 0.35}
                strokeWidth={selected === p.name ? 1.5 : 0.5}
                onClick={() => setSelected(p.name)}
                className="cursor-pointer"
              />
            ))}
          </>
        )}
      </svg>
      <h1 className="pointer-events-none absolute top-3 left-0 right-0 text-center text-xl font-bold text-white drop-shadow">
        Explore Bangladesh
      </h1>
      <div className="pointer-events-none absolute bottom-4 left-0 right-0 text-center text-lg font-semibold text-white drop-shadow">
        {data ? selected ?? 'একটা জেলায় ট্যাপ করো' : 'লোড হচ্ছে...'}
      </div>
    </div>
  )
}
