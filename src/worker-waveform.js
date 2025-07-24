let ctx, width, height;
let samplesPerPixel;
let peaks;

self.onmessage = (e) => {
  if (e.data.type === "init") {
    const { canvas, samplesPerPixel: spp } = e.data;
    samplesPerPixel = spp;

    ctx = canvas.getContext("2d");
    peaks = new Array(canvas.width).fill([0, 0]);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  if (e.data.type === "frame") {
    const samples = new Float32Array(e.data.data);
    const startSample = e.data.offset;
    updatePeaks(samples, startSample);
    drawWaveform();
  }
};

function updatePeaks(samples, offset) {
  //console.log(`updatePeaks with offset ${offset}`);
  //console.log(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const globalSampleIndex = offset + i;
    // console.log(`globalSampleIndex ${globalSampleIndex}`);
    const pixelX = Math.floor(globalSampleIndex / samplesPerPixel);
    // console.log(`pixelX ${pixelX}`);
    if (pixelX >= peaks.length) continue;

    const [min, max] = peaks[pixelX];
    const s = samples[i];
    peaks[pixelX] = [Math.min(min, s), Math.max(max, s)];
  }
}

function drawWaveform() {
  console.log("drawing");
  console.log(peaks);
  const mid = height / 2;
  ctx.clearRect(0, 0, width, height);
  ctx.beginPath();
  for (let x = 0; x < width; x++) {
    const [min, max] = peaks[x];
    ctx.moveTo(x, mid + min * mid);
    ctx.lineTo(x, mid + max * mid);
  }
  ctx.strokeStyle = "#4e8";
  ctx.stroke();
}
