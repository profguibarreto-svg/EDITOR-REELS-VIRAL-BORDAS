import JSZip from 'jszip';
import { VideoQueueItem } from '../types/video';

export async function downloadAllVideosAsZip(
  items: VideoQueueItem[],
  onProgress?: (percent: number) => void
): Promise<void> {
  const completed = items.filter(
    (item) => item.status === 'done' && item.outputBlob && item.outputBlob.size > 0
  );
  if (completed.length === 0) {
    throw new Error('Nenhum vídeo concluído disponível para compactar em ZIP.');
  }

  const zip = new JSZip();
  const folder = zip.folder('cortes_wifive_pro_hd');

  completed.forEach((item, index) => {
    const cleanName = item.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext =
      item.outputExtension || (item.outputBlob?.type.includes('mp4') ? 'mp4' : 'webm');
    const fileName = `${String(index + 1).padStart(2, '0')}_${cleanName}_wifive_pro.${ext}`;
    if (folder && item.outputBlob) {
      folder.file(fileName, item.outputBlob);
    }
  });

  const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
    if (onProgress) {
      onProgress(Math.round(metadata.percent));
    }
  });

  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cortes_wifive_pro_hd_${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function downloadSingleVideo(item: VideoQueueItem): void {
  if (!item.outputBlob || item.outputBlob.size === 0) return;
  const cleanName = item.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const ext =
    item.outputExtension || (item.outputBlob.type.includes('mp4') ? 'mp4' : 'webm');
  const shouldRevoke = !item.outputUrl;
  const url = item.outputUrl || URL.createObjectURL(item.outputBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${cleanName}_wifive_pro_hd.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (shouldRevoke) {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

export async function downloadLinuxPackage(): Promise<void> {
  const fileName = 'wifive-pro-studio-linux.zip';
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}${fileName}`);
    const ct = res.headers.get('content-type') || '';
    if (res.ok && !ct.includes('text/html')) {
      const blob = await res.blob();
      if (blob.size > 5000) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        return;
      }
    }
  } catch (err) {
    console.warn('Direct fetch failed, falling back to embedded package:', err);
  }

  // Fallback to embedded Base64 bundle (guarantees download even inside strict sandboxed iframes)
  const { LINUX_PACKAGE_BASE64 } = await import('./linuxPackageBase64');
  triggerBase64Download(LINUX_PACKAGE_BASE64, fileName, 'application/zip');
}

function triggerBase64Download(base64: string, fileName: string, mimeType: string): void {
  const byteCharacters = atob(base64);
  const byteArray = new Uint8Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteArray[i] = byteCharacters.charCodeAt(i);
  }
  const blob = new Blob([byteArray], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function downloadSourceCodeZip(): Promise<void> {
  const fileName = 'wifive-pro-studio-codigo-fonte.zip';
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}${fileName}`);
    const ct = res.headers.get('content-type') || '';
    if (res.ok && !ct.includes('text/html')) {
      const blob = await res.blob();
      if (blob.size > 5000) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        return;
      }
    }
  } catch (err) {
    console.warn('Direct fetch failed, falling back to embedded source zip:', err);
  }

  const { SOURCE_ZIP_BASE64 } = await import('./sourcePackageBase64');
  triggerBase64Download(SOURCE_ZIP_BASE64, fileName, 'application/zip');
}

export async function downloadSourceCodeTxt(): Promise<void> {
  const fileName = 'CODIGO_FONTE_GERAL.txt';
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}${fileName}`);
    const ct = res.headers.get('content-type') || '';
    if (res.ok && !ct.includes('text/html')) {
      const blob = await res.blob();
      if (blob.size > 5000) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        return;
      }
    }
  } catch (err) {
    console.warn('Direct fetch failed, falling back to embedded source txt:', err);
  }

  const { SOURCE_TXT_BASE64 } = await import('./sourcePackageBase64');
  triggerBase64Download(SOURCE_TXT_BASE64, fileName, 'text/plain;charset=utf-8');
}

