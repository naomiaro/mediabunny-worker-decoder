import {
  Input,
  ALL_FORMATS,
  BufferSource,
  EncodedPacketSink,
} from "mediabunny";

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
  // console.log(audioData);
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

    const audioTrack = await input.getPrimaryAudioTrack(); // => InputAudioTrack | null

    const canDecode = await audioTrack.canDecode(); // => boolean
    console.log(`Can decode ${canDecode}`);

    // Get the number of audio channels:
    console.log(`Number of channels ${audioTrack.numberOfChannels}`);

    // Get the audio sample rate in hertz:
    console.log(`sample rate ${audioTrack.sampleRate}`);

    postMessage({
      type: "metadata",
      duration,
      sampleRate: audioTrack.sampleRate,
      numberOfChannels: audioTrack.numberOfChannels,
    });

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
    console.log(`Decoding took: ${end - start} seconds`);
    postMessage({ type: "done" });
  } catch (err) {
    postMessage({ error: err.message });
  }
};
