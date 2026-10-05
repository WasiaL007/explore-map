type P = { name: string; d: string }
type Flag = { fx: number; fy: number; fw: number; fh: number }

export type Fmt = 'png' | 'jpg' | 'pdf'

export function exportMap(o: {
  format: Fmt
  paths: P[]
  flag: Flag
  visited: Set<string>
  size: { w: number; h: number }
  total: number
}) {
  const { paths, flag, visited, size, total, format } = o
  const { w, h } = size
  const S = 3
  const count = visited.size.toLocaleString('bn-BD')
  const tot = total.toLocaleString('bn-BD')
  const clip = paths.map((p) => `<path d="${p.d}"/>`).join('')
  const lines = paths
    .map((p) => {
      const v = visited.has(p.name)
      return `<path d="${p.d}" fill="${v ? 'rgba(250,204,21,0.65)' : 'none'}" stroke="white" stroke-opacity="0.35" stroke-width="0.5"/>`
    })
    .join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * S}" height="${h * S}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="#ffffff"/>
<defs><clipPath id="bd">${clip}</clipPath></defs>
<g clip-path="url(#bd)">
<rect x="${flag.fx}" y="${flag.fy}" width="${flag.fw}" height="${flag.fh}" fill="#006a4e"/>
<circle cx="${flag.fx + flag.fw / 2}" cy="${flag.fy + flag.fh / 2}" r="${flag.fh * 0.15}" fill="#f42a41"/>
</g>
${lines}
<text x="${w / 2}" y="47" text-anchor="middle" font-family="sans-serif" font-size="26" font-weight="800"><tspan fill="#f42a41">Explore</tspan><tspan fill="#006a4e"> Bangladesh</tspan></text>
<rect x="${w / 2 - 125}" y="70" width="250" height="32" rx="16" fill="black" fill-opacity="0.6"/>
<text x="${w / 2}" y="92" text-anchor="middle" font-family="sans-serif" font-size="16" font-weight="700" fill="#fcd34d">${count} / ${tot} জেলা ঘোরা হয়েছে</text>
</svg>`

  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  const img = new Image()
  img.onload = () => {
    const c = document.createElement('canvas')
    c.width = w * S
    c.height = h * S
    c.getContext('2d')!.drawImage(img, 0, 0)
    URL.revokeObjectURL(url)
    if (format === 'pdf') {
      import('jspdf').then(({ jsPDF }) => {
        const pdf = new jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'px', format: [w, h] })
        pdf.addImage(c.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, w, h)
        pdf.save('explore-bangladesh.pdf')
      })
      return
    }
    const mime = format === 'jpg' ? 'image/jpeg' : 'image/png'
    c.toBlob((b) => {
      if (!b) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b)
      a.download = 'explore-bangladesh.' + format
      a.click()
    }, mime, 0.95)
  }
  img.src = url
}
