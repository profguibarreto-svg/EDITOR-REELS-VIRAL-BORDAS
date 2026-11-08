import JSZip from 'jszip';
import { VideoQueueItem } from '../types/video';

export async function downloadAllVideosAsZip(
  items: VideoQueueItem[],
  onProgress?: (percent: number) => void
): Promise<void> {
  const completed = items.filter((item) => item.status === 'done' && item.outputBlob);
  if (completed.length === 0) return;

  const zip = new JSZip();
  const folder = zip.folder('cortes_wifive_pro_hd');

  completed.forEach((item, index) => {
    const cleanName = item.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = item.outputBlob?.type.includes('mp4') ? 'mp4' : 'webm';
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
  if (!item.outputBlob) return;
  const cleanName = item.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const ext = item.outputBlob.type.includes('mp4') ? 'mp4' : 'webm';
  const url = item.outputUrl || URL.createObjectURL(item.outputBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${cleanName}_wifive_pro_hd.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
