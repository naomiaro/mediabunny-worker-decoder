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
let availableSeconds = 0;

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
  }

  if (e.data.type === "audio-frame") {
    const { channels, numberOfChannels, numberOfFrames, sampleRate } = e.data;

    // Append decoded frame
    channels.forEach((channelBuf, chIndex) => {
      const float32 = new Float32Array(channelBuf);
      audioBuffer.copyToChannel(float32, chIndex, writeOffset);
    });

    writeOffset += numberOfFrames;

    // check if buffer might underun soon.
    availableSeconds = writeOffset / sampleRate;

    if (!isInitialised && availableSeconds > minStartSeconds) {
      const playBtn = document.createElement("button");
      playBtn.textContent = "▶️ Play/Pause";
      playBtn.onclick = () => player.toggle();
      document.body.appendChild(playBtn);

      const stopBtn = document.createElement("button");
      stopBtn.textContent = "⏹ Stop";
      stopBtn.onclick = () => player.stop();
      document.body.appendChild(stopBtn);

      isInitialised = true;
    }

    if (player.shouldRestartSoon(availableSeconds)) {
      console.log(`Available seconds ${availableSeconds}`);
      console.log("player should restart");
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

/*
	Creates a new buffer of exactly validFrames
	Copies only the decoded portion from the big buffer
	Ensures no trailing silence or junk gets replayed
*/
function trimAudioBuffer(buffer, numberOfChannels, validFrames) {
  if (buffer.length === validFrames) return buffer;

  const trimmed = ctx.createBuffer(
    numberOfChannels,
    validFrames,
    buffer.sampleRate
  );
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const tmp = new Float32Array(validFrames);
    buffer.copyFromChannel(tmp, ch, 0);
    trimmed.copyToChannel(tmp, ch, 0);
  }
  return trimmed;
}
