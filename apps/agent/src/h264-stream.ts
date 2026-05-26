// node-av — FFmpeg bindings with hardware-accelerated H.264 encoding
// Both DeviceAPI and FMP4Stream are available from the root package
const nodeAv: any = require('node-av');
const DeviceAPI: any = nodeAv.DeviceAPI;
const FMP4Stream: any = nodeAv.FMP4Stream;

/**
 * H264StreamHandler
 *
 * Uses node-av to capture the screen and encode it as H.264 via hardware-accelerated
 * FFmpeg. Output is fragmented MP4 (fMP4) suitable for MediaSource Extensions (MSE)
 * in the browser.
 *
 * Stream flow:
 *   DeviceAPI.openScreen() → Demuxer → FMP4Stream → fMP4 fragments → Socket.IO binary
 *
 * Two events are emitted:
 *   - remote:h264:init  → { sessionId, codec, data }  (ftyp+moov, once)
 *   - remote:h264:fragment → { sessionId, data }       (moof+mdat, per frame group)
 */
export class H264StreamHandler {
  private stream: any = null;
  private screenDevice: any = null;
  private active = false;

  /**
   * Start H.264 screen capture and streaming.
   * Emits init + fragment events over the given Socket.IO socket.
   */
  async startCapture(
    socket: any,
    sessionId: string,
    options?: { frameRate?: number; bitrate?: string; hardware?: boolean }
  ): Promise<void> {
    this.stopCapture();
    this.active = true;

    try {
      // ── Step 1: Open native screen capture ──────────────────────────────
      // Returns a Demuxer that can be fed into FMP4Stream
      this.screenDevice = await DeviceAPI.openScreen({
        frameRate: options?.frameRate || 30,
        drawMouse: true,
      });
      if (!this.active) { this.cleanup(); return; }

      console.log('[H264] Screen capture opened');

      // ── Step 2: Create fragmented MP4 stream ─────────────────────────────
      const bitrate = options?.bitrate || '5M';
      const useHardware = options?.hardware !== false;

      this.stream = FMP4Stream.create(this.screenDevice, {
        supportedCodecs: 'avc1.640029', // H.264 High 4.1
        hardware: useHardware ? 'auto' : 'off',
        bitrate,
        onChunk: (chunk: Buffer) => {
          if (!this.active || !socket?.connected) return;
          socket.emit('remote:h264:fragment', {
            sessionId,
            data: chunk,
          });
        },
      });

      // ── Step 3: Start the stream ────────────────────────────────────────
      await this.stream.start();

      // ── Step 4: Send init segment (ftyp+moov) for MSE initialization ────
      const codecString = this.stream.getCodecString();
      const initSegment: Buffer = await this.stream.initSegment;

      if (!this.active) { this.cleanup(); return; }

      if (socket?.connected && initSegment) {
        socket.emit('remote:h264:init', {
          sessionId,
          codec: codecString || 'avc1.640029',
          data: initSegment,
        });
        console.log('[H264] Stream started, codec:', codecString || 'avc1.640029');
      }

      // From here, onChunk receives fragments automatically
    } catch (err) {
      console.error('[H264] Capture error:', err);
      try {
        if (socket?.connected) {
          socket.emit('remote:h264:error', {
            sessionId,
            error: (err as Error).message || 'Unknown error',
          });
        }
      } catch {
        // Socket might be dead
      }
    }
  }

  /** Stop capture and release all resources */
  stopCapture(): void {
    this.active = false;
    this.cleanup();
  }

  /** Whether streaming is active */
  get isActive(): boolean {
    return this.active;
  }

  /** Internal cleanup of node-av resources */
  private cleanup(): void {
    if (this.stream) {
      try {
        const dispose = (this.stream as any)[Symbol.asyncDispose];
        if (dispose) dispose.call(this.stream);
      } catch { /* ignore */ }
      this.stream = null;
    }
    if (this.screenDevice) {
      try {
        const dispose = (this.screenDevice as any)[Symbol.asyncDispose];
        if (dispose) dispose.call(this.screenDevice);
      } catch { /* ignore */ }
      this.screenDevice = null;
    }
    console.log('[H264] Resources released');
  }
}
