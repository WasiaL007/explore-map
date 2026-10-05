import type { Fmt } from './exportPng'

type C = { key: string; d: string }

const TOP = 80
const BAR = 90
const PAD = 24
const BASE = '#e7e1d3'
const MAPBG = '#f6f2ea'
const TRACK = '#e5e5e5'
const FILL = '#047857'

export function exportWorld(o: {
  format: Fmt
  list: C[]
  visited: Set<string>
  size: { w: number; h: number }
  total: number
}) {
  const { list, visited, size, total, format } = o
  const { w, h } = size
  const H = h + TOP + BAR
  const S = 3
  const y0 = TOP + h
  const bw = w - PAD * 2
  const fh = w * 0.6

  const pct = total ? Math.round((visited.size / total) * 100) : 0
  const pctText = pct.toLocaleString('bn-BD') + '%'
  const count = visited.size.toLocaleString('bn-BD')

  const vis = list.filter((c) => visited.has(c.key))
  const clip = vis.map((c) => `<path d="${c.d}"/>`).join('')
  const base = list.map((c) => `<path d="${c.d}" fill="${BASE}"/>`).join('')
  const lines = list
    .map((c) => `<path d="${c.d}" fill="none" stroke="white" stroke-opacity="0.9" stroke-width="0.6"/>`)
    .join('')
  const fillW = pct > 0 ? Math.max((bw * pct) / 100, 10) : 0

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * S}" height="${H * S}" viewBox="0 0 ${w} ${H}">
<rect width="${w}" height="${H}" fill="#ffffff"/>
<g transform="translate(0 ${TOP})">
<rect width="${w}" height="${h}" fill="${MAPBG}"/>
<defs><clipPath id="wclip">${clip}</clipPath></defs>
${base}
<g clip-path="url(#wclip)">
<rect x="0" y="${h / 2 - fh / 2}" width="${w}" height="${fh}" fill="#006a4e"/>
<circle cx="${w / 2}" cy="${h / 2}" r="${fh * 0.15}" fill="#f42a41"/>
</g>
${lines}
</g>
<text x="${w / 2}" y="46" text-anchor="middle" font-family="sans-serif" font-size="26" font-weight="800"><tspan fill="#f42a41">Explore</tspan><tspan fill="#006a4e"> World</tspan></text>
<rect x="${PAD}" y="${y0 + 14}" width="${bw}" height="10" rx="5" fill="${TRACK}"/>
<rect x="${PAD}" y="${y0 + 14}" width="${fillW}" height="10" rx="5" fill="${FILL}"/>
<text x="${PAD}" y="${y0 + 46}" font-family="sans-serif" font-size="15" font-weight="600" fill="#525252">${pctText} বিশ্ব ঘোরা হয়েছে</text>
<text x="${w - PAD}" y="${y0 + 46}" text-anchor="end" font-family="sans-serif" font-size="15" font-weight="600" fill="#525252">${count}টি দেশ ও অঞ্চল</text>
</svg>`

  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  const img = new Image()
  img.onload = () => {
    const c = document.createElement('canvas')
    c.width = w * S
    c.height = H * S
    c.getContext('2d')!.drawImage(img, 0, 0)
    URL.revokeObjectURL(url)
    if (format === 'pdf') {
      import('jspdf').then(({ jsPDF }) => {
        const pdf = new jsPDF({ orientation: w > H ? 'landscape' : 'portrait', unit: 'px', format: [w, H] })
        pdf.addImage(c.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, w, H)
        pdf.save('explore-world.pdf')
      })
      return
    }
    const mime = format === 'jpg' ? 'image/jpeg' : 'image/png'
    c.toBlob((b) => {
      if (!b) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b)
      a.download = 'explore-world.' + format
      a.click()
    }, mime, 0.95)
  }
  img.src = url
}
