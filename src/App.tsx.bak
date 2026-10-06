import { useEffect, useMemo, useRef, useState } from 'react'
import { geoMercator, geoPath } from 'd3-geo'
import type { FeatureCollection, Geometry } from 'geojson'
import bnNames from './bnNames.json'
import { exportMap, type Fmt } from './exportPng'
import WorldMap from './WorldMap'

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

const BAD_IMG = /(^|[^a-z])(map|locator|flag|seal|logo|emblem|coat)([^a-z]|$)/i

async function wikiImage(bnTitle: string, enTitle: string): Promise<string | null> {
  const tries: ['bn' | 'en', string][] = [
    ['bn', bnTitle + ' জেলা'],
    ['en', enTitle + ' District'],
  ]
  for (const [lang, t] of tries) {
    try {
      const r = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t.replace(/ /g, '_'))}`)
      if (!r.ok) continue
      const j = await r.json()
      const thumb: string | undefined = j.thumbnail?.source
      const orig: string | undefined = j.originalimage?.source
      if (!thumb || !orig) continue
      const file = decodeURIComponent(orig.split('/').pop() ?? '')
      if (/\.svg$/i.test(file) || BAD_IMG.test(file)) continue
      return (j.originalimage?.width ?? 0) >= 960 ? thumb.replace(/\/\d+px-/, '/960px-') : orig
    } catch {
      /* try next */
    }
  }
  return null
}

export default function App() {
  const [data, setData] = useState<FC | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [visited, setVisited] = useState<Set<string>>(loadVisited)
  const [info, setInfo] = useState<Record<string, Info>>({})
  const [query, setQuery] = useState('')
  const [showNames, setShowNames] = useState(true)
  const [showAbout, setShowAbout] = useState(false)
  const [tab, setTab] = useState<'bd' | 'world'>('bd')
  const [vw, setVw] = useState(window.innerWidth)
  const [slides, setSlides] = useState<{ name: string; src: string }[]>([])
  const [shown, setShown] = useState<{ k: number; name: string; src: string }[]>([])
  const slidesRef = useRef(slides)
  slidesRef.current = slides

  useEffect(() => {
    if (!data) return
    let dead = false
    const names = data.features.map((f) => f.properties.ADM2_EN)
    for (let i = names.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[names[i], names[j]] = [names[j], names[i]]
    }
    let cache: Record<string, string | null> = {}
    try {
      cache = JSON.parse(localStorage.getItem('explore-bd-hero') || '{}')
    } catch {
      /* ignore */
    }
    const preload = (src: string) =>
      new Promise<boolean>((res) => {
        const im = new Image()
        im.onload = () => res(true)
        im.onerror = () => res(false)
        im.src = src
      })
    let next = 0
    const worker = async () => {
      while (!dead && next < names.length) {
        const n = names[next++]
        let src = cache[n]
        if (src === undefined) {
          src = await wikiImage(bnD[n] ?? n, n)
          cache[n] = src
          try {
            localStorage.setItem('explore-bd-hero', JSON.stringify(cache))
          } catch {
            /* ignore */
          }
        }
        if (src && !dead && (await preload(src)) && !dead) {
          const good = src
          setSlides((cur) => (cur.some((x) => x.name === n) ? cur : [...cur, { name: n, src: good }]))
        }
      }
    }
    void Promise.all([worker(), worker(), worker()])
    return () => {
      dead = true
    }
  }, [data])

  useEffect(() => {
    if (slides.length > 0) setShown((cur) => (cur.length ? cur : [{ k: 0, ...slides[0] }]))
  }, [slides])

  useEffect(() => {
    if (slides.length < 2) return
    const t = setInterval(() => {
      const all = slidesRef.current
      setShown((cur) => {
        const k = (cur[cur.length - 1]?.k ?? 0) + 1
        return [...cur.slice(-1), { k, ...all[k % all.length] }]
      })
    }, 3000)
    return () => clearInterval(t)
  }, [slides.length > 1])

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

  const setMany = (names: string[], on: boolean) =>
    setVisited((prev) => {
      const next = new Set(prev)
      names.forEach((x) => (on ? next.add(x) : next.delete(x)))
      return next
    })

  const mapW = Math.min(vw - 64, vw >= 768 ? 640 : 520)
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
        c: path.centroid(f),
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

  const groups = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    const m = new Map<string, string[]>()
    for (const f of data.features) {
      const d = f.properties.ADM1_EN
      m.set(d, [...(m.get(d) ?? []), f.properties.ADM2_EN])
    }
    return [...m.entries()]
      .map(([div, names]) => ({
        div,
        all: names.sort((a, b) => a.localeCompare(b)),
        shown: names.filter((n) => !q || n.toLowerCase().includes(q) || (bnD[n] ?? '').includes(q)),
      }))
      .filter((g) => g.shown.length > 0)
      .sort((a, b) => b.all.length - a.all.length)
  }, [data, query])

  const sel = map?.paths.find((p) => p.name === selected) ?? null
  const total = data?.features.length ?? 64
  const pct = Math.round((visited.size / total) * 100)
  const inf = sel ? info[sel.name] : undefined

  return (
    <div className={'flex min-h-screen flex-col bg-[#faf8f4] text-neutral-900 ' + (sel ? 'pb-80' : 'pb-0')}>
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

      <nav className="mx-4 md:mx-auto md:w-full md:max-w-3xl lg:max-w-4xl flex gap-1 rounded-full bg-[#f1ece4] p-1.5 text-[13px] font-semibold sm:text-sm">
        <button
          onClick={() => {
            setTab('bd')
            setSelected(null)
          }}
          className={'flex-1 whitespace-nowrap rounded-full px-2 py-2.5 ' + (tab === 'bd' ? 'bg-white shadow' : 'text-neutral-600')}
        >
          আমার ম্যাপ
        </button>
        <button
          onClick={() => {
            setTab('world')
            setSelected(null)
          }}
          className={'flex-1 whitespace-nowrap rounded-full px-2 py-2.5 ' + (tab === 'world' ? 'bg-white shadow' : 'text-neutral-600')}
        >
          বিশ্ব
        </button>
        <button disabled className="flex-1 whitespace-nowrap px-1.5 py-2.5 text-neutral-400">
          প্ল্যানার <span className="block text-[10px] leading-tight">শীঘ্রই</span>
        </button>
        <button disabled className="flex-1 whitespace-nowrap px-1.5 py-2.5 text-neutral-400">
          লিডারবোর্ড <span className="block text-[10px] leading-tight">শীঘ্রই</span>
        </button>
      </nav>

      {tab === 'bd' && (
        <>

      <section className="relative mx-4 md:mx-auto md:w-full md:max-w-3xl lg:max-w-4xl mt-4 overflow-hidden rounded-3xl bg-gradient-to-br from-[#006a4e] to-[#003d2d] px-6 py-10 text-center text-white">
        <style>{`
          @keyframes heroIn { from { opacity: 0 } to { opacity: 1 } }
          @keyframes heroZoom { from { transform: scale(1) } to { transform: scale(1.14) } }
          .hero-slide { animation: heroIn 1s ease-out both, heroZoom 4.5s ease-out both; }
          @media (prefers-reduced-motion: reduce) { .hero-slide { animation: heroIn 1s ease-out both; } }
        `}</style>
        {shown.length > 0 && (
          <div className="pointer-events-none absolute inset-0">
            {shown.map((sl) => (
              <img key={sl.k} src={sl.src} alt="" className="hero-slide absolute inset-0 h-full w-full object-cover" />
            ))}
            <div className="absolute inset-0 bg-gradient-to-b from-[#003d2d]/70 via-[#003d2d]/55 to-[#003d2d]/85" />
          </div>
        )}
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
          <div className="mx-auto mt-6 grid w-fit gap-3 text-left text-sm text-white/90 sm:grid-flow-col sm:gap-8">
            <span className="inline-flex items-center gap-2">
              <b className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/50">১</b>
              জেলা বাছাই করুন
            </span>
            <span className="inline-flex items-center gap-2">
              <b className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/50">২</b>
              PNG, JPG বা PDF নামান
            </span>
          </div>
          {shown.length > 0 && (
            <button
              onClick={() => setSelected(shown[shown.length - 1].name)}
              className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-black/35 px-3 py-1 text-xs text-white/85"
            >
              📍 {bnD[shown[shown.length - 1].name] ?? shown[shown.length - 1].name} · ছবি: Wikimedia
            </button>
          )}
        </div>
      </section>

      <section id="map" className="mx-4 md:mx-auto md:w-full md:max-w-3xl lg:max-w-4xl mt-6 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-extrabold">যেসব জেলায় গিয়েছি</h3>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-800">
            {bn(visited.size)} / {bn(total)}
          </span>
        </div>

        <label className="mt-3 flex cursor-pointer items-center gap-2 px-1 text-sm font-semibold text-neutral-700">
          <input type="checkbox" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} className="h-5 w-5 accent-emerald-700" />
          জেলার নাম দেখান
        </label>

        {!data ? (
          <div className="py-24 text-center text-neutral-500">মানচিত্র লোড হচ্ছে...</div>
        ) : (
          <svg width={mapW} height={mapH} className="mx-auto mt-3 block touch-manipulation">
            {map && (
              <>
                <defs>
                  <clipPath id="bd">
                    {map.paths.filter((p) => visited.has(p.name)).map((p) => (
                      <path key={p.name} d={p.d} />
                    ))}
                  </clipPath>
                </defs>
                <g>
                  {map.paths.map((p) => (
                    <path key={p.name} d={p.d} fill="#e7e1d3" />
                  ))}
                </g>
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
                  const isSel = selected === p.name
                  return (
                    <path
                      key={p.name}
                      d={p.d}
                      fill={isSel ? 'rgba(0,0,0,0.12)' : 'transparent'}
                      stroke={isSel ? '#111827' : 'white'}
                      strokeOpacity={isSel ? 1 : 0.9}
                      strokeWidth={isSel ? 2.5 : 0.5}
                      onClick={() => setSelected(p.name)}
                      className="cursor-pointer"
                    />
                  )
                })}
                {map.paths.filter((p) => visited.has(p.name) && Number.isFinite(p.c[0])).map((p) => (
                  <g key={'l' + p.name} pointerEvents="none">
                    <circle cx={p.c[0]} cy={p.c[1]} r="1.8" fill="#f42a41" stroke="white" strokeWidth="0.6" />
                    {showNames && (
                      <text
                        x={p.c[0]}
                        y={p.c[1] - 4}
                        textAnchor="middle"
                        fontSize="8"
                        fontWeight="700"
                        fill="#111"
                        stroke="white"
                        strokeWidth="2.4"
                        paintOrder="stroke"
                        strokeLinejoin="round"
                      >
                        {bnD[p.name] ?? p.name}
                      </text>
                    )}
                  </g>
                ))}
              </>
            )}
          </svg>
        )}

        <div className="mt-3 px-1">
          <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
            <div className="h-full bg-emerald-700" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-xs font-semibold text-neutral-600">
            <span>{bn(pct)}% বাংলাদেশ ঘোরা হয়েছে</span>
            <span>{bn(visited.size)}টি জেলা</span>
          </div>
        </div>

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
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {groups.map((g) => {
            const cnt = g.all.filter((n) => visited.has(n)).length
            const allOn = cnt === g.all.length
            return (
              <div key={g.div} className="rounded-2xl border border-neutral-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-extrabold text-neutral-900">
                    {bnV[g.div] ?? g.div} বিভাগ{' '}
                    <span className="ml-1 font-semibold text-neutral-500">
                      {bn(cnt)}/{bn(g.all.length)}
                    </span>
                  </div>
                  <button onClick={() => setMany(g.all, !allOn)} className="text-xs font-semibold text-emerald-700 underline">
                    {allOn ? 'মুছুন' : 'সব বাছাই'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {g.shown.map((n) => (
                    <button
                      key={n}
                      onClick={() => setSelected(n)}
                      className={
                        'rounded-full px-3 py-1.5 text-sm font-semibold ' +
                        (visited.has(n) ? 'bg-emerald-700 text-white' : 'bg-neutral-100 text-neutral-700') +
                        (selected === n ? ' ring-2 ring-neutral-900' : '')
                      }
                    >
                      {visited.has(n) ? '• ' : ''}
                      {bnD[n] ?? n}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          {data && groups.length === 0 && <span className="text-sm text-neutral-500">কোনো জেলা মেলেনি</span>}
        </div>
      </section>

        </>
      )}
      {tab === 'world' && <WorldMap />}

      <footer className="mx-auto mt-auto w-full max-w-xl px-4 pb-4 pt-6 text-center text-xs text-neutral-500">
        <p className="font-semibold text-neutral-700">
          Developed By{' '}
          <button onClick={() => setShowAbout(true)} className="font-semibold text-emerald-700 underline">
            Wasi AL
          </button>
        </p>
        <p className="mt-1">
          {tab === 'world' ? 'দেশের সারাংশ ও লিংক' : 'জেলার সারাংশ ও লিংক'}{' '}
          <a href="https://bn.wikipedia.org" target="_blank" rel="noreferrer" className="underline">
            উইকিপিডিয়া
          </a>{' '}
          থেকে নেওয়া (CC BY-SA 4.0)
          {tab === 'world' && ' · মানচিত্র: Natural Earth'}
        </p>
        <p className="mt-3 font-bold text-neutral-800">© স্বত্বাধিকারী: Wasi Al Enterprise</p>
      </footer>

      {showAbout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowAbout(false)}>
          <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="relative bg-neutral-200">
              <img src="/wasi.jpg" onError={(e) => { const im = e.currentTarget; if (!im.dataset.fb) { im.dataset.fb = "1"; im.src = "https://wasial.pages.dev/assets/hero.jpg" } }} alt="Wasi Al Mehedi" className="h-72 w-full object-cover object-center" />
              <button
                onClick={() => setShowAbout(false)}
                aria-label="Close"
                className="absolute right-3 top-3 h-9 w-9 rounded-full bg-black/50 text-lg text-white"
              >
                ✕
              </button>
            </div>
            <div className="p-5 text-center">
              <h3 className="text-xl font-extrabold text-neutral-900">Wasi Al Mehedi</h3>
              <p className="mt-1 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-emerald-700">Digital Builder · Software · ERP · Laravel Expert</p>
              <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                I'm Wasi Al Mehedi, a software developer. I build enterprise HRMS, restaurant ERP and automation systems. Explore Bangladesh is a travel-map project I created.
              </p>
              <div className="mt-4 flex justify-center gap-3">
                <a href="https://wasial.pages.dev/" target="_blank" rel="noreferrer" aria-label="Personal site" className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-900 text-white">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
                  </svg>
                </a>
                <a href="https://www.facebook.com/profile.php?id=100018759139361" target="_blank" rel="noreferrer" aria-label="Facebook" className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1877f2] text-white">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                    <path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12z" />
                  </svg>
                </a>
                <a href="https://www.instagram.com/_wasi_al" target="_blank" rel="noreferrer" aria-label="Instagram" className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 text-white">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="5" />
                    <circle cx="12" cy="12" r="4" />
                    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

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
