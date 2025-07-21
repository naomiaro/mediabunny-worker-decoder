import { Input, ALL_FORMATS, BufferSource } from 'mediabunny';

self.onmessage = async (e) => {
  const buffer = e.data;

  try {
    const input = new Input({
      formats: ALL_FORMATS,
      source: new BufferSource(buffer),
    });
    
    const format = await input.getFormat(); // => Mp4InputFormat
    console.log(format)
    const mimeType = await input.getMimeType(); // => 'video/mp4; codecs="avc1.42c032, mp4a.40.2"'
    console.log(mimeType)
    const duration = await input.computeDuration(); // => 1905.4615
    console.log(duration)


    postMessage({duration});
  } catch (err) {
    postMessage({ error: err.message });
  }
};
