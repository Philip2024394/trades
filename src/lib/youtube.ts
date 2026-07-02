// YouTube URL utilities — extract video ID, build embed + thumbnail
// URLs. Supports every common YT URL variant.

export function youtubeVideoId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  // youtu.be/VIDEO_ID
  const short = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
  if (short) return short[1];
  // youtube.com/watch?v=VIDEO_ID
  const watch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
  if (watch) return watch[1];
  // youtube.com/embed/VIDEO_ID
  const embed = trimmed.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/);
  if (embed) return embed[1];
  // youtube.com/shorts/VIDEO_ID
  const shorts = trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/);
  if (shorts) return shorts[1];
  return null;
}

export function youtubeThumbnailUrl(url: string): string | null {
  const id = youtubeVideoId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

export function youtubeEmbedUrl(url: string): string | null {
  const id = youtubeVideoId(url);
  return id ? `https://www.youtube.com/embed/${id}?rel=0` : null;
}
