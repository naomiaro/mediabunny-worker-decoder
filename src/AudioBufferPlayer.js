export class AudioBufferPlayer {
  constructor(audioContext) {
    this.ctx = audioContext;
    this.buffer = null;
    this.source = null;
    this.startTime = 0;
    this.pausedAt = 0;
    this.isPlaying = false;
  }

  loadBuffer(buffer) {
    this.buffer = buffer;
    this.pausedAt = 0;
    this.isPlaying = false;
  }

  getPlaybackPosition() {
    return this.isPlaying
      ? this.ctx.currentTime - this.startTime
      : this.pausedAt;
  }

  /*
    availableSeconds     How much audio has been decoded so far (writeOffset / sampleRate)
    padding              How soon before underrun you want to trigger (e.g. 0.5s)
  */
  shouldRestartSoon(availableSeconds, padding = 0.5) {
    if (!this.isPlaying) return false;
    const played = this.getPlaybackPosition();
    return availableSeconds - played < padding;
  }

  play() {
    if (!this.buffer || this.isPlaying) return;

    this.source = this.ctx.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.connect(this.ctx.destination);

    this.startTime = this.ctx.currentTime - this.pausedAt;
    this.source.start(0, this.pausedAt);

    this.source.onended = () => {
      if (this.ctx.currentTime - this.startTime >= this.buffer.duration) {
        this.pausedAt = 0;
        this.isPlaying = false;
        this.source = null;
      }
    };

    this.isPlaying = true;
  }

  pause() {
    if (!this.isPlaying || !this.source) return;

    this.pausedAt = this.ctx.currentTime - this.startTime;
    this.source.stop();
    this.source.disconnect();
    this.source = null;
    this.isPlaying = false;
  }

  stop() {
    if (this.source) {
      this.source.stop();
      this.source.disconnect();
      this.source = null;
    }
    this.pausedAt = 0;
    this.isPlaying = false;
  }

  toggle() {
    if (this.isPlaying) this.pause();
    else this.play();
  }
}
