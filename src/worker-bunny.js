import {
  Input,
  ALL_FORMATS,
  BufferSource,
  EncodedPacketSink,
} from "mediabunny";

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

/**
 * Converts AudioData (any known format) to an array of Float32Arrays (one per channel).
 * Handles both interleaved and planar formats.
 *
 * @param {AudioData} audioData
 * @returns {Float32Array[]} channelData - array of Float32Array per channel
 */
function convertAudioDataToFloat32Arrays(audioData) {
  const {
    format,
    numberOfChannels: channels,
    numberOfFrames: frames,
  } = audioData;
  const channelData = [];

  const normalize = {
    s16: (x) => x / 32768,
    u8: (x) => (x - 128) / 128,
  };

  if (format === "f32-planar") {
    for (let ch = 0; ch < channels; ch++) {
      const buf = new Float32Array(frames);
      audioData.copyTo(buf, { planeIndex: ch });
      channelData.push(buf);
    }
  } else if (format === "s16-planar") {
    for (let ch = 0; ch < channels; ch++) {
      const intBuf = new Int16Array(frames);
      audioData.copyTo(intBuf, { planeIndex: ch });

      const floatBuf = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        floatBuf[i] = normalize.s16(intBuf[i]);
      }
      channelData.push(floatBuf);
    }
  } else if (format === "u8-planar") {
    for (let ch = 0; ch < channels; ch++) {
      const u8Buf = new Uint8Array(frames);
      audioData.copyTo(u8Buf, { planeIndex: ch });

      const floatBuf = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        floatBuf[i] = normalize.u8(u8Buf[i]);
      }
      channelData.push(floatBuf);
    }
  } else if (format === "f32") {
    const interleaved = new Float32Array(frames * channels);
    audioData.copyTo(interleaved);

    for (let ch = 0; ch < channels; ch++) {
      const chBuf = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        chBuf[i] = interleaved[i * channels + ch];
      }
      channelData.push(chBuf);
    }
  } else if (format === "s16") {
    const interleaved = new Int16Array(frames * channels);
    audioData.copyTo(interleaved);

    for (let ch = 0; ch < channels; ch++) {
      const chBuf = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        const sample = interleaved[i * channels + ch];
        chBuf[i] = normalize.s16(sample);
      }
      channelData.push(chBuf);
    }
  } else if (format === "u8") {
    const interleaved = new Uint8Array(frames * channels);
    audioData.copyTo(interleaved);

    for (let ch = 0; ch < channels; ch++) {
      const chBuf = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        const sample = interleaved[i * channels + ch];
        chBuf[i] = normalize.u8(sample);
      }
      channelData.push(chBuf);
    }
  } else {
    throw new Error(`Unsupported AudioData format: ${format}`);
  }

  return channelData;
}

function output(audioData) {
  console.log(audioData);
  const channels = audioData.numberOfChannels;
  const frames = audioData.numberOfFrames;
  const sampleRate = audioData.sampleRate;

  const channelData = convertAudioDataToFloat32Arrays(audioData);

  // Send buffers to main thread
  postMessage(
    {
      type: "audio-frame",
      sampleRate,
      numberOfChannels: channels,
      numberOfFrames: frames,
      channels: channelData.map((f32) => f32.buffer),
    },
    channelData.map((f32) => f32.buffer)
  ); // Transfer ownership
}

self.onmessage = async (e) => {
  const buffer = e.data;

  try {
    const input = new Input({
      formats: ALL_FORMATS,
      source: new BufferSource(buffer),
    });

    const format = await input.getFormat(); // => Mp4InputFormat
    console.log(format);
    const mimeType = await input.getMimeType(); // => 'video/mp4; codecs="avc1.42c032, mp4a.40.2"'
    console.log(mimeType);
    const duration = await input.computeDuration(); // => 1905.4615
    console.log(duration);

    postMessage({ type: "metadata", duration });

    const audioTrack = await input.getPrimaryAudioTrack(); // => InputAudioTrack | null

    const canDecode = await audioTrack.canDecode(); // => boolean
    console.log(`Can decode ${canDecode}`);

    // Get the number of audio channels:
    console.log(`Number of channels ${audioTrack.numberOfChannels}`);

    // Get the audio sample rate in hertz:
    console.log(`sample rate ${audioTrack.sampleRate}`);

    const decoderConfig = await audioTrack.getDecoderConfig(); // => AudioDecoderConfig | null

    console.log(decoderConfig);

    const sink = new EncodedPacketSink(audioTrack);

    const decoder = new AudioDecoder({
      output,
      error: console.error,
    });
    decoder.configure(decoderConfig);

    const start = performance.now();

    let currentPacket = await sink.getFirstPacket();
    while (currentPacket) {
      decoder.decode(currentPacket.toEncodedAudioChunk());
      currentPacket = await sink.getNextPacket(currentPacket);
    }

    await decoder.flush();
    const end = performance.now();
    console.log(end - start);
    postMessage({ type: "done" });
  } catch (err) {
    postMessage({ error: err.message });
  }
};
