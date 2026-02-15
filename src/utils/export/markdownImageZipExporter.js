import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const sanitizeFileName = (name = 'image') => {
  const cleaned = String(name)
    .replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5.]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'image';
};

const stripFileExt = (name = '') => {
  const idx = String(name).lastIndexOf('.');
  if (idx <= 0) return name;
  return name.slice(0, idx);
};

const parseDataUrl = (value) => {
  if (typeof value !== 'string') return null;
  const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/i);
  if (!match) return null;
  return {
    mimeType: match[1].toLowerCase(),
    base64: match[2].replace(/\s/g, '')
  };
};

const extFromMime = (mimeType = 'image/png') => {
  const map = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp'
  };
  return map[mimeType.toLowerCase()] || 'png';
};

const base64ToU8 = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const isImageAttachment = (attachment) => {
  if (!attachment) return false;
  if (attachment.is_embedded_image) return true;
  return typeof attachment.file_type === 'string' && attachment.file_type.startsWith('image/');
};

const extractEmbeddedImageData = (candidate) => {
  if (!candidate || typeof candidate !== 'object') return null;

  const sourceName = candidate.file_name || candidate.name || 'image';

  const linkData = parseDataUrl(candidate.link);
  if (linkData) {
    return {
      ...linkData,
      sourceName
    };
  }

  const embeddedRaw = candidate.embedded_image?.data;
  if (typeof embeddedRaw === 'string') {
    const embeddedDataUrl = parseDataUrl(embeddedRaw);
    if (embeddedDataUrl) {
      return {
        ...embeddedDataUrl,
        sourceName
      };
    }

    const fallbackMime = typeof candidate.file_type === 'string' && candidate.file_type.startsWith('image/')
      ? candidate.file_type
      : 'image/png';

    return {
      mimeType: fallbackMime,
      base64: embeddedRaw.replace(/\s/g, ''),
      sourceName
    };
  }

  return null;
};

const ensureUniqueFileName = (rawName, usedFileNames) => {
  const safeRaw = sanitizeFileName(rawName);
  if (!usedFileNames.has(safeRaw)) {
    usedFileNames.add(safeRaw);
    return safeRaw;
  }

  const base = stripFileExt(safeRaw);
  const ext = safeRaw.includes('.') ? safeRaw.split('.').pop() : '';
  let counter = 1;
  while (true) {
    const nextName = ext ? `${base}_${counter}.${ext}` : `${base}_${counter}`;
    if (!usedFileNames.has(nextName)) {
      usedFileNames.add(nextName);
      return nextName;
    }
    counter++;
  }
};

const collectMessageImageRefs = (messages, zip, usedFileNames) => {
  const refsByMessageKey = {};

  (messages || []).forEach((msg, messagePos) => {
    const candidates = [
      ...(Array.isArray(msg?.images) ? msg.images : []),
      ...(Array.isArray(msg?.attachments) ? msg.attachments.filter(isImageAttachment) : [])
    ];

    if (candidates.length === 0) return;

    const seenInMessage = new Set();
    const refs = [];
    const messageKey = String(msg?.index ?? msg?.uuid ?? (messagePos + 1));

    candidates.forEach((candidate, candidateIdx) => {
      const extracted = extractEmbeddedImageData(candidate);
      if (!extracted || !extracted.base64) return;

      const duplicateKey = `${extracted.base64.length}:${extracted.base64.slice(0, 80)}`;
      if (seenInMessage.has(duplicateKey)) return;
      seenInMessage.add(duplicateKey);

      const nameStem = sanitizeFileName(stripFileExt(extracted.sourceName || `image_${candidateIdx + 1}`));
      const ext = extFromMime(extracted.mimeType);
      const rawFileName = `msg_${sanitizeFileName(String(messageKey))}_${nameStem}.${ext}`;
      const uniqueFileName = ensureUniqueFileName(rawFileName, usedFileNames);

      zip.file(`images/${uniqueFileName}`, base64ToU8(extracted.base64), { binary: true });
      refs.push(`![${uniqueFileName}](images/${uniqueFileName})`);
    });

    if (refs.length > 0) {
      refsByMessageKey[messageKey] = refs;
    }
  });

  return refsByMessageKey;
};

export async function exportMarkdownWithImagesZip({
  scope = 'current',
  data = null,
  dataList = [],
  config = {},
  createMarkdown,
  singleMarkdownFileName = 'conversation.md',
  multipleMarkdownFileName = 'export.md'
}) {
  if (typeof createMarkdown !== 'function') {
    throw new Error('createMarkdown callback is required');
  }

  const sourceDataList = scope === 'current' ? (data ? [data] : []) : (Array.isArray(dataList) ? dataList : []);
  if (sourceDataList.length === 0) {
    throw new Error('No export data available');
  }

  const zip = new JSZip();
  const usedFileNames = new Set();

  const markdownParts = sourceDataList.map((item) => {
    const refsByMessageKey = collectMessageImageRefs(item?.chat_history || [], zip, usedFileNames);
    return createMarkdown(item, {
      ...config,
      imageRefsByMessageKey: refsByMessageKey
    });
  });

  const markdownContent = scope === 'current'
    ? markdownParts[0]
    : markdownParts.join('\n\n---\n---\n\n');

  const markdownFileName = scope === 'current' ? singleMarkdownFileName : multipleMarkdownFileName;
  zip.file(markdownFileName, markdownContent);

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const zipFileName = markdownFileName.replace(/\.md$/i, '') + '.zip';
  saveAs(zipBlob, zipFileName);
  return true;
}
