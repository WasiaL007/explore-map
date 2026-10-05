import { useEffect, useMemo, useState } from 'react'
import { geoMercator, geoPath } from 'd3-geo'
import type { FeatureCollection, Geometry } from 'geojson'
import bnNames from './bnNames.json'
import { exportMap, type Fmt } from './exportPng'

type Props = { ADM2_EN: string; ADM1_EN: string }
type FC = FeatureCollection<Geometry, Props>
type Info = { status: 'loading' | 'ok' | 'none'; text?: string; url?: string; src?: string }

const STORAGE_KEY = 'explore-bd-visited'
const RED = '#f42a41'
const GREEN = '#006a4e'
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
  const [visited, setVisited] = useState<Set<string>>(loadVisited)
  const [info, setInfo] = useState<Record<string, Info>>({})
  const [query, setQuery] = useState('')
  const [vw, setVw] = useState(window.innerWidth)

  useEffect(() => {
    fetch('/data/bd-districts.json').then((r) => r.json()).then(setData)
    const onResize = () => setVw(window.innerWidth)
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

  const mapW = Math.min(vw - 64, 520)
  const mapH = Math.round(mapW * 1.4)

  const map = useMemo(() => {
    if (!data) return null
    const pad = 8
    const projection = geoMercator().fitExtent([[pad, pad], [mapW - pad, mapH - pad]], data)
    const path = geoPath(projection)
    const [[x0, y0], [x1, y1]] = path.bounds(data)
    const bw = x1 - x0
    const bh = y1 - y0
    const fw = Math.max(bw, (bh * 10) / 6)
    const fh = fw * 0.6
    return {
      paths: data.features.map((f) => ({
        name: f.properties.ADM2_EN,
        division: f.properties.ADM1_EN,
        d: path(f) ?? '',
      })),
      flag: { fx: x0 + bw / 2 - fw / 2, fy: y0 + bh / 2 - fh / 2, fw, fh },
    }
  }, [data, mapW, mapH])

  const logo = useMemo(() => {
    if (!data) return null
    const p = geoPath(geoMercator().fitSize([34, 34], data))
    const [[x0, y0], [x1, y1]] = p.bounds(data)
    return { ds: data.features.map((f) => p(f) ?? ''), cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 }
  }, [data])

  const list = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    return data.features
      .map((f) => f.properties.ADM2_EN)
      .filter((n) => !q || n.toLowerCase().includes(q) || (bnD[n] ?? '').includes(q))
      .sort((a, b) => a.localeCompare(b))
  }, [data, query])

  const sel = map?.paths.find((p) => p.name === selected) ?? null
  const total = data?.features.length ?? 64
  const inf = sel ? info[sel.name] : undefined

  return (
    <div className={'min-h-screen bg-[#faf8f4] text-neutral-900 ' + (sel ? 'pb-80' : 'pb-12')}>
      <header className="flex items-center justify-center gap-3 pt-5 pb-3">
        <svg width="42" height="42" viewBox="0 0 42 42" className="rounded-xl bg-white shadow">
          {logo && (
            <g transform="translate(4 4)">
              {logo.ds.map((d, i) => (
                <path key={i} d={d} fill={GREEN} />
              ))}
              <circle cx={logo.cx} cy={logo.cy} r="3.2" fill={RED} />
            </g>
          )}
        </svg>
        <h1 className="text-2xl font-extrabold tracking-tight">
          <span style={{ color: RED }}>Explore</span> <span style={{ color: GREEN }}>Bangladesh</span>
        </h1>
      </header>

      <nav className="mx-4 flex gap-1 rounded-full bg-[#f1ece4] p-1.5 text-sm font-semibold">
        <button className="flex-1 rounded-full bg-white px-3 py-2.5 shadow">আমার ম্যাপ</button>
        <button disabled className="flex-1 px-3 py-2.5 text-neutral-400">
          প্ল্যানার <span className="text-[10px]">শীঘ্রই</span>
        </button>
        <button disabled className="flex-1 px-3 py-2.5 text-neutral-400">
          লিডারবোর্ড <span className="text-[10px]">শীঘ্রই</span>
        </button>
      </nav>

      <section className="relative mx-4 mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-[#006a4e] to-[#003d2d] px-6 py-10 text-center text-white">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#f42a41]/80" />
        <div className="relative">
          <span className="inline-block rounded-full bg-white/20 px-4 py-1.5 text-sm font-semibold">
            {bn(64)} জেলা · {bn(8)} বিভাগ
          </span>
          <h2 className="mt-5 text-3xl font-extrabold leading-tight">আপনার ভ্রমণের মানচিত্র আঁকুন</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/85">
            যেসব জেলায় গিয়েছেন সেগুলো মার্ক করুন, আর শেয়ার করুন পতাকার রঙে আঁকা নিজের মানচিত্র।
          </p>
          <a
            href="#map"
            className="mt-6 inline-block rounded-full bg-white px-7 py-3.5 font-bold text-neutral-900 shadow-lg"
          >
            জেলা বাছাই শুরু করুন ↓
          </a>
          <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/90">
            <span className="inline-flex items-center gap-2">
              <b className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/50">১</b>
              জেলা বাছাই করুন
            </span>
            <span className="inline-flex items-center gap-2">
              <b className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/50">২</b>
              PNG, JPG বা PDF নামান
            </span>
          </div>
        </div>
      </section>

      <section id="map" className="mx-4 mt-6 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-extrabold">যেসব জেলায় গিয়েছি</h3>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-800">
            {bn(visited.size)} / {bn(total)}
          </span>
        </div>

        {!data ? (
          <div className="py-24 text-center text-neutral-500">মানচিত্র লোড হচ্ছে...</div>
        ) : (
          <svg width={mapW} height={mapH} className="mx-auto mt-3 block touch-manipulation">
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
                  <rect x={map.flag.fx} y={map.flag.fy} width={map.flag.fw} height={map.flag.fh} fill={GREEN} />
                  <circle
                    cx={map.flag.fx + map.flag.fw / 2}
                    cy={map.flag.fy + map.flag.fh / 2}
                    r={map.flag.fh * 0.15}
                    fill={RED}
                  />
                </g>
                {map.paths.map((p) => {
                  const isVisited = visited.has(p.name)
                  const isSel = selected === p.name
                  return (
                    <path
                      key={p.name}
                      d={p.d}
                      fill={isVisited ? 'rgba(250,204,21,0.8)' : isSel ? 'rgba(255,255,255,0.4)' : 'transparent'}
                      stroke={isSel ? '#111827' : 'white'}
                      strokeOpacity={isSel ? 1 : 0.5}
                      strokeWidth={isSel ? 2.5 : 0.5}
                      onClick={() => setSelected(p.name)}
                      className="cursor-pointer"
                    />
                  )
                })}
              </>
            )}
          </svg>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <span className="text-sm font-semibold text-neutral-600">📷 ছবি নামান:</span>
          {(['png', 'jpg', 'pdf'] as Fmt[]).map((f) => (
            <button
              key={f}
              disabled={!map}
              onClick={() => map && exportMap({ format: f, paths: map.paths, flag: map.flag, visited, size: { w: mapW, h: mapH }, total })}
              className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 জেলা খুঁজুন..."
          className="mt-5 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-emerald-600"
        />
        <div className="mt-3 flex max-h-60 flex-wrap gap-2 overflow-y-auto">
          {list.map((n) => (
            <button
              key={n}
              onClick={() => setSelected(n)}
              className={
                'rounded-full px-3 py-1.5 text-sm font-semibold ' +
                (visited.has(n) ? 'bg-amber-300 text-black' : 'bg-neutral-100 text-neutral-700')
              }
            >
              {visited.has(n) ? '✓ ' : ''}
              {bnD[n] ?? n}
            </button>
          ))}
          {data && list.length === 0 && <span className="text-sm text-neutral-500">কোনো জেলা মেলেনি</span>}
        </div>
      </section>

      {sel && (
        <div className="fixed bottom-0 left-0 right-0 z-20 p-3">
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
        </div>
      )}
    </div>
  )
}
