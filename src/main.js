import WorkerBunny from "./worker-bunny?worker";
import { AudioBufferPlayer } from "./AudioBufferPlayer.js";

const workerBunny = new WorkerBunny();

const input = document.createElement("input");
input.type = "file";
document.body.appendChild(input);

const ctx = new AudioContext();
const player = new AudioBufferPlayer(ctx);

// for dynamic append
let audioBuffer = null;
let writeOffset = 0;
let sampleRate = 48000;
let numberOfChannels = 2;
let expectedFrames = null;

workerBunny.onmessage = (e) => {
  if (e.data.type === "metadata") {
    const duration = e.data.duration;
    sampleRate = e.data.sampleRate;
    numberOfChannels = e.data.numberOfChannels;
    // Store expected total length of buffer
    console.log("Sample rate:", sampleRate);
    console.log("Number of channels:", numberOfChannels);
    console.log("Expected duration (s):", duration);

    expectedFrames = Math.ceil(duration * sampleRate);
    console.log("Expected total frames:", expectedFrames);

    const frames = expectedFrames ?? sampleRate * 300; // fallback estimate

    audioBuffer = ctx.createBuffer(numberOfChannels, frames, sampleRate);
    console.log("Created AudioBuffer with", frames, "frames");
  }

  if (e.data.type === "audio-frame") {
    const { channels, numberOfChannels, numberOfFrames, sampleRate } = e.data;

    // Append decoded frame
    channels.forEach((channelBuf, chIndex) => {
      const float32 = new Float32Array(channelBuf);
      audioBuffer.copyToChannel(float32, chIndex, writeOffset);
    });

    writeOffset += numberOfFrames;
  }

  if (e.data.type === "done") {
    player.loadBuffer(audioBuffer);
    player.play();

    const playBtn = document.createElement("button");
    playBtn.textContent = "▶️ Play/Pause";
    playBtn.onclick = () => player.toggle();
    document.body.appendChild(playBtn);

    const stopBtn = document.createElement("button");
    stopBtn.textContent = "⏹ Stop";
    stopBtn.onclick = () => player.stop();
    document.body.appendChild(stopBtn);
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
