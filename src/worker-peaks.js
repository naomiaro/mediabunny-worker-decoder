import extractPeaks from "webaudio-peaks";

self.onmessage = async (e) => {
  if (e.data.buffer) {
    const buffer = e.data.buffer;
    const data = new Float32Array(buffer);
    const peaks = extractPeaks(data, data.length, true);
    postMessage(
      {
        peaks,
      },
      [data.buffer]
    ); // Transfer back
  }

  try {
  } catch (err) {
    postMessage({ error: err.message });
  }
};
