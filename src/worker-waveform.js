let ctx, width, height;
let samplesPerPixel;
let peaks;
let devicePixelRatio = 1;

const pixelSet = new Set();

self.onmessage = (e) => {
  if (e.data.type === "init") {
    const { canvas, samplesPerPixel: spp, devicePixelRatio: dpr = 1 } = e.data;
    samplesPerPixel = spp;
    devicePixelRatio = dpr;

    ctx = canvas.getContext("2d");
    ctx.scale(devicePixelRatio, devicePixelRatio);

    width = canvas.width / devicePixelRatio;
    height = canvas.height / devicePixelRatio;
    peaks = new Array(width).fill([0, 0]);
    ctx.clearRect(0, 0, width, height);
  }

  if (e.data.type === "frame") {
    const channelBuffers = e.data.data.map((buf) => new Float32Array(buf));

    // Mix the channels down to mono for display
    const samples = new Float32Array(channelBuffers[0].length);
    for (let i = 0; i < samples.length; i++) {
      let sum = 0;
      for (let ch = 0; ch < channelBuffers.length; ch++) {
        sum += channelBuffers[ch][i];
      }
      samples[i] = sum / channelBuffers.length;
    }
    const startSample = e.data.offset;
    updatePeaks(samples, startSample);
    maybeDrawWaveform();
  }
};

function updatePeaks(samples, offset) {
  for (let i = 0; i < samples.length; i++) {
    const globalSampleIndex = offset + i;

    // move left -> right through array as frames roll in. compare to previously saved min, max
    const pixelX = Math.floor(globalSampleIndex / samplesPerPixel);
    if (pixelX >= peaks.length) continue;

    pixelSet.add(pixelX);

    const [min, max] = peaks[pixelX];
    const s = samples[i];
    peaks[pixelX] = [Math.min(min, s), Math.max(max, s)];
  }
}

function drawWaveform() {
  const mid = height / 2;
  const pixelsToUpdate = [...pixelSet].sort((a, b) => a - b);
  const pixelWidth = pixelsToUpdate.length;

  if (pixelWidth === 0) {
    return;
  }

  // clear only where pixels need to be updated.
  ctx.clearRect(pixelsToUpdate[0], 0, pixelWidth, height);
  ctx.beginPath();
  for (let x = 0; x < pixelWidth; x++) {
    const peakIndex = pixelsToUpdate[x];
    const [min, max] = peaks[peakIndex];
    ctx.moveTo(peakIndex, mid + min * mid);
    ctx.lineTo(peakIndex, mid + max * mid);
  }
  ctx.strokeStyle = "#4e8";
  ctx.stroke();

  // remove need to draw these pixels
  pixelSet.clear();
}

let lastDraw = 0;
const DRAW_INTERVAL = 16; // ~60 FPS

function maybeDrawWaveform() {
  const now = performance.now();
  if (now - lastDraw >= DRAW_INTERVAL) {
    drawWaveform();
    lastDraw = now;
  }
}
