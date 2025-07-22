import { Input, ALL_FORMATS, BufferSource, EncodedPacketSink } from 'mediabunny';

self.onmessage = async (e) => {
  const buffer = e.data;

  try {
    const input = new Input({
      formats: ALL_FORMATS,
      source: new BufferSource(buffer),
    });
    
    const format = await input.getFormat(); // => Mp4InputFormat
    console.log(format)
    const mimeType = await input.getMimeType(); // => 'video/mp4; codecs="avc1.42c032, mp4a.40.2"'
    console.log(mimeType)
    const duration = await input.computeDuration(); // => 1905.4615
    console.log(duration)

    const audioTrack = await input.getPrimaryAudioTrack(); // => InputAudioTrack | null

    const canDecode = await audioTrack.canDecode(); // => boolean
    console.log(`Can decode ${canDecode}`)

    // Get the number of audio channels:
    console.log(`Number of channels ${audioTrack.numberOfChannels}`)

    // Get the audio sample rate in hertz:
    console.log(`sample rate ${audioTrack.sampleRate}`)

    const decoderConfig = await audioTrack.getDecoderConfig(); // => AudioDecoderConfig | null

    console.log(decoderConfig)

    const sink = new EncodedPacketSink(audioTrack);

    const decoder = new AudioDecoder({
      output: console.log,
      error: console.error,
    });
    decoder.configure(decoderConfig);

    let currentPacket = await sink.getKeyPacket(0);
    while (currentPacket && currentPacket.timestamp < duration) {
      decoder.decode(currentPacket.toEncodedAudioChunk());
      currentPacket = await sink.getNextPacket(currentPacket);
    }

    await decoder.flush();


    postMessage({duration});
  } catch (err) {
    postMessage({ error: err.message });
  }
};
