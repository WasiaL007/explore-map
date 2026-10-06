const KEY = 'explore-avatar'

export function loadAvatar(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function saveAvatar(v: string | null) {
  try {
    if (v) localStorage.setItem(KEY, v)
    else localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export function fileToAvatar(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const S = 256
      const c = document.createElement('canvas')
      c.width = S
      c.height = S
      const m = Math.min(img.width, img.height)
      c.getContext('2d')!.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, S, S)
      URL.revokeObjectURL(url)
      res(c.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      rej(new Error('image'))
    }
    img.src = url
  })
}
