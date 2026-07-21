// Whisper transcription via Groq Cloud.
//
// Groq hosts Whisper large-v3 at generous free-tier speeds
// (~3-5s per 2-min video vs 15-45s on other providers).
// Returns raw text + optional word-level timestamps.
//
// Whisper large-v3 accepts MP4/MOV/WebM/M4A/MP3/OGG/WAV up to
// 25MB. For videos longer than that, we'd need audio-only
// extraction (Phase 3).

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions";
const WHISPER_MODEL = "whisper-large-v3";
const MAX_FILE_BYTES = 25 * 1024 * 1024;   // 25MB Groq limit

export type TranscriptionResult = {
  text:     string;
  duration?: number;
};

/** Download a video URL then send bytes to Groq Whisper.
 *  Returns null on any failure (missing key, network, oversized,
 *  Whisper rejection) — caller should fall back gracefully. */
export async function transcribeVideoUrl(videoUrl: string): Promise<TranscriptionResult | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    console.warn("[whisperTranscribe] GROQ_API_KEY missing");
    return null;
  }

  try {
    // Download the video into memory
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      console.error("[whisperTranscribe] video fetch failed:", videoRes.status);
      return null;
    }
    const videoBlob = await videoRes.blob();
    if (videoBlob.size > MAX_FILE_BYTES) {
      console.error("[whisperTranscribe] video too large:", videoBlob.size, ">", MAX_FILE_BYTES);
      return null;
    }

    // Send to Groq Whisper
    const filename = videoUrl.split("/").pop()?.split("?")[0] ?? "video.mp4";
    const form     = new FormData();
    form.append("file",           videoBlob, filename);
    form.append("model",          WHISPER_MODEL);
    form.append("language",       "en");         // UK English trades focus
    form.append("response_format","json");

    const transRes = await fetch(GROQ_ENDPOINT, {
      method:  "POST",
      headers: { "Authorization": `Bearer ${key}` },
      body:    form
    });
    if (!transRes.ok) {
      const errBody = await transRes.text();
      console.error("[whisperTranscribe] groq non-OK:", transRes.status, errBody.slice(0, 200));
      return null;
    }
    const data = await transRes.json() as { text: string; duration?: number };
    return {
      text:     data.text?.trim() ?? "",
      duration: data.duration
    };
  } catch (e) {
    console.error("[whisperTranscribe] error:", e instanceof Error ? e.message : String(e));
    return null;
  }
}
