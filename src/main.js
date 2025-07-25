import WorkerBunny from "./worker-bunny?worker";
import WaveformWorker from "./worker-waveform.js?worker";
import { AudioBufferPlayer } from "./AudioBufferPlayer.js";

const workerBunny = new WorkerBunny();
const waveformWorker = new WaveformWorker();

const input = document.createElement("input");
input.type = "file";
document.body.appendChild(input);

const canvas = document.getElementById("waveform");

const playBtn = document.getElementById("play");
playBtn.onclick = () => player.toggle();

const stopBtn = document.getElementById("stop");
stopBtn.onclick = () => player.stop();

const ctx = new AudioContext();
const player = new AudioBufferPlayer(ctx);

// for dynamic append
let audioBuffer = null;
let writeOffset = 0;
let sampleRate = 48000;
let numberOfChannels = 2;
let expectedFrames = null;
let availableSeconds = 0;
let samplesPerPixel = 30000;

// how much decoded audio to wait for
const minStartSeconds = 0;
let isInitialised = false;

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

    player.loadBuffer(audioBuffer);

    const config = setupCanvas(canvas, expectedFrames, samplesPerPixel);
    waveformWorker.postMessage(
      {
        type: "init",
        ...config,
      },
      [config.canvas]
    );
  }

  if (e.data.type === "audio-frame") {
    const { channels, numberOfChannels, numberOfFrames, sampleRate } = e.data;

    // Append decoded frame
    channels.forEach((channelBuf, chIndex) => {
      const float32 = new Float32Array(channelBuf);
      if (writeOffset + numberOfFrames <= audioBuffer.length) {
        audioBuffer.copyToChannel(float32, chIndex, writeOffset);
      } else {
        console.warn("AudioBuffer overflow — skipping frame");
      }
    });

    writeOffset += numberOfFrames;

    // check if buffer might underun soon.
    availableSeconds = writeOffset / sampleRate;

    if (!isInitialised) {
      playBtn.disabled = false;
      stopBtn.disabled = false;
      isInitialised = true;
    }

    // Send all channel data to waveformWorker for mono conversion
    const allChannels = channels.map((buf) => new Float32Array(buf)); // clone
    const transferBuffers = allChannels.map((arr) => arr.buffer); // save before detaching

    waveformWorker.postMessage(
      {
        type: "frame",
        data: transferBuffers,
        offset: writeOffset,
        numberOfChannels,
      },
      transferBuffers
    );

    if (player.shouldRestartSoon(availableSeconds)) {
      const currentTime = player.getPlaybackPosition();

      player.stop();
      player.pausedAt = currentTime; // resume at current time
      player.play();
    }
  }

  if (e.data.type === "done") {
    if (player.isPlaying) {
      console.log("player should restart with finished buffer");
      const currentTime = player.getPlaybackPosition();

      player.stop();
      player.pausedAt = currentTime; // resume at current time
      player.play();

      console.log(
        "🔁 Restarted with updated buffer at",
        currentTime.toFixed(2),
        "seconds"
      );
    }
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

function setupCanvas(canvas, expectedFrames, samplesPerPixel) {
  const ratio = window.devicePixelRatio || 1;
  const width = Math.ceil(expectedFrames / samplesPerPixel);
  const height = 80;

  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  return {
    canvas: canvas.transferControlToOffscreen(),
    devicePixelRatio,
    samplesPerPixel,
  };
}
