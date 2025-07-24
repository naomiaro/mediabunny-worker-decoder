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

/**
 * Converts AudioData to a single interleaved Float32Array.
 * Supports f32, s16, u8 (interleaved or planar).
 *
 * @param {AudioData} audioData
 * @returns {Float32Array} interleavedSamples
 */
function convertAudioDataToInterleavedFloat32(audioData) {
  const {
    format,
    numberOfChannels: channels,
    numberOfFrames: frames,
  } = audioData;
  const interleaved = new Float32Array(frames * channels);

  const normalize = {
    s16: (x) => x / 32768,
    u8: (x) => (x - 128) / 128,
  };

  if (format === "f32") {
    audioData.copyTo(interleaved);
  } else if (format === "s16") {
    const int = new Int16Array(frames * channels);
    audioData.copyTo(int);
    for (let i = 0; i < int.length; i++) {
      interleaved[i] = normalize.s16(int[i]);
    }
  } else if (format === "u8") {
    const u8 = new Uint8Array(frames * channels);
    audioData.copyTo(u8);
    for (let i = 0; i < u8.length; i++) {
      interleaved[i] = normalize.u8(u8[i]);
    }
  } else if (format.endsWith("-planar")) {
    // Planar formats: collect per-channel and interleave manually
    for (let ch = 0; ch < channels; ch++) {
      let source;

      if (format === "f32-planar") {
        source = new Float32Array(frames);
        audioData.copyTo(source, { planeIndex: ch });
      } else if (format === "s16-planar") {
        const intBuf = new Int16Array(frames);
        audioData.copyTo(intBuf, { planeIndex: ch });
        source = new Float32Array(frames);
        for (let i = 0; i < frames; i++) {
          source[i] = normalize.s16(intBuf[i]);
        }
      } else if (format === "u8-planar") {
        const u8Buf = new Uint8Array(frames);
        audioData.copyTo(u8Buf, { planeIndex: ch });
        source = new Float32Array(frames);
        for (let i = 0; i < frames; i++) {
          source[i] = normalize.u8(u8Buf[i]);
        }
      } else {
        throw new Error(`Unsupported format: ${format}`);
      }

      for (let i = 0; i < frames; i++) {
        interleaved[i * channels + ch] = source[i];
      }
    }
  } else {
    throw new Error(`Unsupported AudioData format: ${format}`);
  }

  return interleaved;
}

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
