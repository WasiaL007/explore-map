import { useEffect, useMemo, useState } from 'react'
import { geoMercator, geoPath } from 'd3-geo'
import type { FeatureCollection, Geometry } from 'geojson'
import bnNames from './bnNames.json'
import { exportMap, type Fmt } from './exportPng'

type Props = { ADM2_EN: string; ADM1_EN: string }
type FC = FeatureCollection<Geometry, Props>
type Info = { status: 'loading' | 'ok' | 'none'; text?: string; url?: string; src?: string }

const STORAGE_KEY = 'explore-bd-visited'
const bn = (n: number) => n.toLocaleString('bn-BD')
const bnD = bnNames.districts as Record<string, string>
const bnV = bnNames.divisions as Record<string, string>

function loadVisited(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

async function wikiSummary(lang: 'bn' | 'en', title: string) {
  const u = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`
  const r = await fetch(u)
  if (!r.ok) return null
  const j = await r.json()
  if (j.type === 'disambiguation' || !j.extract) return null
  return { text: j.extract as string, url: j.content_urls?.desktop?.page as string | undefined }
}

export default function App() {
  const [data, setData] = useState<FC | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [visited, setVisited] = useState<Set<string>>(loadVisited)
  const [info, setInfo] = useState<Record<string, Info>>({})
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })

  useEffect(() => {
    fetch('/data/bd-districts.json').then((r) => r.json()).then(setData)
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...visited]))
    } catch {
      /* ignore */
    }
  }, [visited])

  useEffect(() => {
    if (!selected || info[selected]) return
    const name = selected
    setInfo((p) => ({ ...p, [name]: { status: 'loading' } }))
    ;(async () => {
      try {
        const bnName = bnD[name]
        let res = bnName ? await wikiSummary('bn', `${bnName} জেলা`) : null
        let src = 'বাংলা উইকিপিডিয়া'
        if (!res) {
          res = await wikiSummary('en', `${name} District`)
          src = 'English Wikipedia'
        }
        setInfo((p) => ({
          ...p,
          [name]: res ? { status: 'ok', text: res.text, url: res.url, src } : { status: 'none' },
        }))
      } catch {
        setInfo((p) => {
          const n = { ...p }
          delete n[name]
          return n
        })
      }
    })()
  }, [selected, info])

  const toggleVisited = (name: string) =>
    setVisited((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })

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
      paths: data.features.map((f) => ({
        name: f.properties.ADM2_EN,
        division: f.properties.ADM1_EN,
        d: path(f) ?? '',
      })),
      flag: { fx, fy, fw, fh },
    }
  }, [data, size])

  const sel = map?.paths.find((p) => p.name === selected) ?? null
  const total = data?.features.length ?? 64
  const inf = sel ? info[sel.name] : undefined

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
            {map.paths.map((p) => {
              const isVisited = visited.has(p.name)
              const isSel = selected === p.name
              return (
                <path
                  key={p.name}
                  d={p.d}
                  fill={isVisited ? 'rgba(250,204,21,0.65)' : isSel ? 'rgba(255,255,255,0.35)' : 'transparent'}
                  stroke="white"
                  strokeOpacity={isSel ? 1 : 0.35}
                  strokeWidth={isSel ? 2 : 0.5}
                  onClick={() => setSelected(p.name)}
                  className="cursor-pointer"
                />
              )
            })}
          </>
        )}
      </svg>

      <div className="pointer-events-none absolute top-3 left-0 right-0 flex flex-col items-center gap-1">
        <h1 className="rounded-full bg-white px-5 py-1 text-2xl font-extrabold shadow-lg">
          <span className="text-[#f42a41]">Explore</span> <span className="text-[#006a4e]">Bangladesh</span>
        </h1>
        <div className="rounded-full bg-black/60 px-4 py-1 text-sm font-semibold text-amber-300">
          {bn(visited.size)} / {bn(total)} জেলা ঘোরা হয়েছে
        </div>
      </div>

      {!sel && (
        <>
          {menuOpen && <div className="absolute inset-0" onClick={() => setMenuOpen(false)} />}
          <div className="absolute bottom-28 left-0 right-0 flex flex-col items-center gap-2">
            {menuOpen && (
              <div className="flex overflow-hidden rounded-full bg-white text-black shadow-xl">
                {(['png', 'jpg', 'pdf'] as Fmt[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      setMenuOpen(false)
                      if (map) exportMap({ format: f, paths: map.paths, flag: map.flag, visited, size, total })
                    }}
                    className="px-5 py-3 text-center text-sm font-semibold active:bg-neutral-200"
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="rounded-full bg-white px-4 py-3 text-sm font-semibold text-black shadow-lg"
            >
              📷 ছবি
            </button>
          </div>
        </>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-3">
        {!data ? (
          <div className="text-center text-white">লোড হচ্ছে...</div>
        ) : sel ? (
          <div className="mx-auto max-w-md rounded-2xl bg-neutral-900/95 p-4 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-bold">
                  {bnD[sel.name] ?? sel.name}{' '}
                  <span className="text-sm font-normal text-neutral-400">{sel.name}</span>
                </div>
                <div className="text-sm text-neutral-400">{bnV[sel.division] ?? sel.division} বিভাগ</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleVisited(sel.name)}
                  className={
                    'rounded-xl px-4 py-2 font-semibold ' +
                    (visited.has(sel.name) ? 'bg-amber-400 text-black' : 'bg-emerald-600 text-white')
                  }
                >
                  {visited.has(sel.name) ? '✓ ঘুরেছি' : 'ঘুরেছি?'}
                </button>
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-full bg-neutral-700 px-3 py-2 text-sm"
                  aria-label="বন্ধ"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="mt-3 max-h-[28vh] overflow-y-auto border-t border-neutral-700 pt-3 text-sm leading-relaxed text-neutral-200">
              {!inf || inf.status === 'loading' ? (
                <span className="text-neutral-400">তথ্য লোড হচ্ছে...</span>
              ) : inf.status === 'none' ? (
                <span className="text-neutral-400">এই জেলার তথ্য এখন পাওয়া যায়নি।</span>
              ) : (
                <>
                  <p>{inf.text}</p>
                  <p className="mt-2 text-xs text-neutral-400">
                    সূত্র: {inf.src}
                    {inf.url && (
                      <>
                        {' · '}
                        <a href={inf.url} target="_blank" rel="noreferrer" className="text-emerald-400 underline">
                          বিস্তারিত
                        </a>
                      </>
                    )}
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="pb-1 text-center text-lg font-semibold text-white drop-shadow">একটা জেলায় ট্যাপ করো</div>
        )}
      </div>
    </div>
  )
}
