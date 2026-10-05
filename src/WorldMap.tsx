import { useEffect, useMemo, useState } from 'react'
import { geoNaturalEarth1, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import { numericToAlpha2 } from 'i18n-iso-countries'
import type { FeatureCollection, Geometry } from 'geojson'
import { exportWorld } from './exportWorld'
import type { Fmt } from './exportPng'

const GREEN = '#006a4e'
const RED = '#f42a41'
const KEY = 'explore-world-visited'
const ZOOMS = [1, 2, 3, 4, 6]

const toBn = (n: number) => String(n).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)])

const dn = typeof Intl !== 'undefined' && 'DisplayNames' in Intl ? new Intl.DisplayNames(['bn'], { type: 'region' }) : null

function bnName(id: string | number | undefined, en: string): string {
  try {
    let a2: string | undefined = id !== undefined ? numericToAlpha2(String(id).padStart(3, '0')) : undefined
    if (!a2 && en === 'Kosovo') a2 = 'XK'
    const n = a2 ? dn?.of(a2) : undefined
    if (n && n !== a2) return n
  } catch {
    /* fall through */
  }
  return en
}

type FC = FeatureCollection<Geometry, { name: string }>
type Info = { text: string; url?: string; src: string }

function loadVisited(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

export default function WorldMap() {
  const [fc, setFc] = useState<FC | null>(null)
  const [visited, setVisited] = useState<Set<string>>(loadVisited)
  const [selected, setSelected] = useState<string | null>(null)
  const [info, setInfo] = useState<Record<string, Info>>({})
  const [query, setQuery] = useState('')
  const [zi, setZi] = useState(0)
  const [vw, setVw] = useState(window.innerWidth)

  useEffect(() => {
    fetch('/data/world-50m.json')
      .then((r) => r.json())
      .then((topo) => {
        const f = feature(topo, topo.objects.countries) as unknown as FC
        setFc({ ...f, features: f.features.filter((x) => x.properties.name !== 'Antarctica') })
      })
    const onResize = () => setVw(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify([...visited]))
    } catch {
      /* ignore */
    }
  }, [visited])

  const W = Math.min(vw - 64, 720)
  const H = Math.round(W * 0.54)

  const map = useMemo(() => {
    if (!fc) return null
    const projection = geoNaturalEarth1().fitExtent(
      [
        [4, 4],
        [W - 4, H - 4],
      ],
      fc,
    )
    const path = geoPath(projection)
    const list = fc.features.map((f) => ({
      key: f.properties.name,
      en: f.properties.name,
      bn: bnName(f.id, f.properties.name),
      d: path(f) ?? '',
    }))
    return { list }
  }, [fc, W, H])

  const sel = map?.list.find((c) => c.key === selected) ?? null

  useEffect(() => {
    if (!sel || info[sel.key] !== undefined) return
    let dead = false
    const key = sel.key
    ;(async () => {
      const tries: ['bn' | 'en', string][] = [
        ['bn', sel.bn],
        ['en', sel.en],
      ]
      for (const [lang, t] of tries) {
        try {
          const r = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t.replace(/ /g, '_'))}`)
          if (!r.ok) continue
          const j = await r.json()
          if (j.type === 'disambiguation' || !j.extract) continue
          if (!dead)
            setInfo((p) => ({
              ...p,
              [key]: { text: j.extract as string, url: j.content_urls?.desktop?.page as string | undefined, src: lang === 'bn' ? 'বাংলা উইকিপিডিয়া' : 'English Wikipedia' },
            }))
          return
        } catch {
          /* try next */
        }
      }
      if (!dead) setInfo((p) => ({ ...p, [key]: { text: '', src: '' } }))
    })()
    return () => {
      dead = true
    }
  }, [selected, sel?.key])

  const toggle = (k: string) =>
    setVisited((prev) => {
      const n = new Set(prev)
      if (n.has(k)) n.delete(k)
      else n.add(k)
      return n
    })

  const total = map?.list.length ?? 0
  const pct = total ? Math.round((visited.size / total) * 100) : 0
  const q = query.trim().toLowerCase()
  const results = !map
    ? []
    : q
      ? map.list.filter((c) => c.en.toLowerCase().includes(q) || c.bn.includes(q)).slice(0, 24)
      : map.list.filter((c) => visited.has(c.key)).sort((a, b) => a.bn.localeCompare(b.bn))
  const z = ZOOMS[zi]
  const fh = W * 0.6
  const inf = sel ? info[sel.key] : undefined

  return (
    <>
      <section className="mx-4 mt-6 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm md:mx-auto md:w-full md:max-w-3xl lg:max-w-4xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl font-extrabold">যেসব দেশে গিয়েছি</h2>
          <span className="shrink-0 rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-900">
            {toBn(visited.size)} / {toBn(total)}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => setZi((v) => Math.max(0, v - 1))}
            disabled={zi === 0}
            className="h-9 w-9 rounded-full bg-neutral-900 text-lg font-bold text-white disabled:opacity-30"
          >
            −
          </button>
          <button
            onClick={() => setZi((v) => Math.min(ZOOMS.length - 1, v + 1))}
            disabled={zi === ZOOMS.length - 1}
            className="h-9 w-9 rounded-full bg-neutral-900 text-lg font-bold text-white disabled:opacity-30"
          >
            +
          </button>
          <span className="text-xs text-neutral-500">জুম {toBn(z)}x · ছোট দেশ বাছতে জুম করুন বা নাম খুঁজুন</span>
        </div>

        {!map ? (
          <div className="py-24 text-center text-neutral-500">বিশ্ব মানচিত্র লোড হচ্ছে...</div>
        ) : (
          <div className="mt-3 overflow-auto rounded-2xl bg-[#f6f2ea]" style={{ maxHeight: '62vh' }}>
            <svg viewBox={`0 0 ${W} ${H}`} width={W * z} height={H * z} className="block touch-manipulation" style={{ maxWidth: 'none' }}>
              <defs>
                <clipPath id="wclip">
                  {map.list
                    .filter((c) => visited.has(c.key))
                    .map((c) => (
                      <path key={c.key} d={c.d} />
                    ))}
                </clipPath>
              </defs>
              {map.list.map((c) => (
                <path key={'b' + c.key} d={c.d} fill="#e7e1d3" />
              ))}
              <g clipPath="url(#wclip)">
                <rect x={0} y={H / 2 - fh / 2} width={W} height={fh} fill={GREEN} />
                <circle cx={W / 2} cy={H / 2} r={fh * 0.15} fill={RED} />
              </g>
              {map.list.map((c) => (
                <path
                  key={'t' + c.key}
                  d={c.d}
                  fill="transparent"
                  stroke="white"
                  strokeOpacity={0.9}
                  strokeWidth={0.6}
                  vectorEffect="non-scaling-stroke"
                  onClick={() => setSelected(c.key)}
                  className="cursor-pointer"
                />
              ))}
              {sel && <path d={sel.d} fill="none" stroke="#111827" strokeWidth={2.2} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
            </svg>
          </div>
        )}

        <div className="mt-3 px-1">
          <div className="h-2 overflow-hidden rounded-full bg-neutral-200">
            <div className="h-full bg-emerald-700" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-xs font-semibold text-neutral-600">
            <span>{toBn(pct)}% বিশ্ব ঘোরা হয়েছে</span>
            <span>{toBn(visited.size)}টি দেশ ও অঞ্চল</span>
          </div>
        </div>

        {map && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="text-sm font-semibold text-neutral-700">📷 ছবি নামান:</span>
            {(['png', 'jpg', 'pdf'] as Fmt[]).map((f) => (
              <button
                key={f}
                onClick={() => exportWorld({ format: f, list: map.list, visited, size: { w: W, h: H }, total })}
                className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-bold uppercase text-white"
              >
                {f}
              </button>
            ))}
          </div>
        )}

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="🔍 দেশ খুঁজুন..."
          className="mt-4 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none focus:border-emerald-600"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {results.map((c) => (
            <button
              key={c.key}
              onClick={() => setSelected(c.key)}
              className={
                'rounded-full px-3 py-1.5 text-sm font-semibold ' +
                (visited.has(c.key) ? 'bg-emerald-700 text-white' : 'bg-neutral-100 text-neutral-700') +
                (selected === c.key ? ' ring-2 ring-neutral-900' : '')
              }
            >
              {visited.has(c.key) ? '• ' : ''}
              {c.bn}
            </button>
          ))}
          {map && results.length === 0 && (
            <span className="text-sm text-neutral-500">{q ? 'কোনো দেশ মেলেনি' : 'ম্যাপে ট্যাপ করুন বা নাম খুঁজে দেশ বাছুন'}</span>
          )}
        </div>
      </section>

      {sel && <div className="h-80" />}
      {sel && (
        <div className="fixed inset-x-0 bottom-0 z-40 p-3">
          <div className="mx-auto max-w-md rounded-2xl bg-neutral-900/95 p-4 text-white shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-extrabold">{sel.bn}</div>
                <div className="text-sm text-neutral-400">{sel.en}</div>
              </div>
              <button onClick={() => setSelected(null)} aria-label="Close" className="h-8 w-8 rounded-full bg-white/15 text-white">
                ✕
              </button>
            </div>
            <button
              onClick={() => toggle(sel.key)}
              className={'mt-3 w-full rounded-full px-4 py-2.5 font-bold ' + (visited.has(sel.key) ? 'bg-emerald-600 text-white' : 'bg-white text-neutral-900')}
            >
              {visited.has(sel.key) ? '✓ ঘুরেছি (মুছতে ট্যাপ করুন)' : 'ঘুরেছি?'}
            </button>
            <div className="mt-3 max-h-40 overflow-y-auto text-sm leading-relaxed text-neutral-200">
              {inf === undefined ? (
                'লোড হচ্ছে...'
              ) : inf.text ? (
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
              ) : (
                'সারাংশ পাওয়া যায়নি'
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
