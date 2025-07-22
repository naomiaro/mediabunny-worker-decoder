import WorkerBunny from "./worker-bunny?worker";
import WorkerPeaks from "./worker-peaks?worker";

const workerBunny = new WorkerBunny();
const workerPeaks = new WorkerPeaks();

const input = document.createElement("input");
input.type = "file";
document.body.appendChild(input);

const ctx = new AudioContext();
const frameQueue = []; // Array of {channels: Float32Array[], frames: number}

workerBunny.onmessage = (e) => {
  if (e.data.type === "audio-frame") {
    const { channels, numberOfChannels, numberOfFrames, sampleRate } = e.data;

    const floats = channels.map((buf) => new Float32Array(buf));
    frameQueue.push({ channels: floats, frames: numberOfFrames, sampleRate });
  }

  if (e.data.type === "done") {
    const buffer = createAudioBufferFromFrames(ctx, frameQueue);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  }
};

input.onchange = async (e) => {
  const file = e.target.files[0];
  console.log("Received file");
  console.log(file);
  const buffer = await file.arrayBuffer();
  console.log(buffer);
  workerBunny.postMessage(buffer, [buffer]);
};

function createAudioBufferFromFrames(audioContext, frameQueue) {
  const numberOfChannels = frameQueue[0].channels.length;
  const sampleRate = frameQueue[0].sampleRate;
  const totalFrames = frameQueue.reduce((sum, f) => sum + f.frames, 0);

  const audioBuffer = audioContext.createBuffer(
    numberOfChannels,
    totalFrames,
    sampleRate
  );

  for (let ch = 0; ch < numberOfChannels; ch++) {
    const channelData = new Float32Array(totalFrames);
    let offset = 0;

    for (const frame of frameQueue) {
      const chunk = frame.channels[ch];
      channelData.set(chunk, offset);
      offset += chunk.length;
    }

    audioBuffer.copyToChannel(channelData, ch);
  }

  return audioBuffer;
}
