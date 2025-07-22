import extractPeaks from "webaudio-peaks";

self.onmessage = async (e) => {

  if (e.data.buffer) {
    const buffer = e.data.buffer;
    const peaks = new Float32Array(buffer);
  }

  try {
  } catch (err) {
    postMessage({ error: err.message });
  }
};
