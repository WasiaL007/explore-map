import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

export async function saveBlob(blob: Blob, filename: string) {
  if (Capacitor.isNativePlatform()) {
    const data = await new Promise<string>((res, rej) => {
      const r = new FileReader()
      r.onload = () => res((r.result as string).split(',')[1])
      r.onerror = () => rej(r.error)
      r.readAsDataURL(blob)
    })
    const f = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache })
    await Share.share({ title: filename, url: f.uri, dialogTitle: 'ছবি সেভ বা শেয়ার করুন' })
    return
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}
