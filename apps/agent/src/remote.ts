import { execSync } from 'child_process';
import * as crypto from 'crypto';
import { nativeImage } from 'electron';

const { Monitor } = require('node-screenshots');

interface CaptureFrame {
  frame: string;
  width: number;
  height: number;
  _buffer?: Buffer;
  _skipped?: boolean;
}

interface RemoteSessionOptions {
  quality?: number;
  interval?: number;
}

/**
 * RemoteDesktopHandler
 *
 * Screenshots: Uses screenshot-desktop first, then Electron desktopCapturer, then fallback PowerShell
 * Input: Uses PowerShell Add-Type/System.Windows.Forms for mouse and SendKeys for keyboard
 *
 * Note: captureFrame is called by main.ts using Electron's desktopCapturer API
 * because desktopCapturer requires the renderer process context.
 * We expose captureFrame as a callback that main.ts wires up.
 */
export class RemoteDesktopHandler {
  private streaming = false;
  private frameTimer: ReturnType<typeof setTimeout> | null = null;
  private currentSocket: any = null;
  private currentSessionId = '';
  private captureInFlight = false;
  private currentQuality = 55;
  private currentIntervalMs = 150;
  private lastCaptureErrorAt = 0;
  private lastFrameHash = '';
  private lastFrameWidth = 0;
  private lastFrameHeight = 0;
  private captureMonitor: any = null;

  async startSession(sessionId: string, socket: any, options?: RemoteSessionOptions): Promise<void> {
    this.stopSession();
    this.currentSessionId = sessionId;
    this.currentSocket = socket;
    this.streaming = true;
    this.currentQuality = Math.max(15, Math.min(95, options?.quality ?? this.currentQuality ?? 55));
    this.currentIntervalMs = Math.max(50, Math.min(1000, options?.interval ?? this.currentIntervalMs ?? 150));
    console.log(`[Remote] Session started: ${sessionId} (quality=${this.currentQuality}, interval=${this.currentIntervalMs}ms)`);
    // Start the capture loop using recursive setTimeout (no overlapping)
    this.scheduleNext();
  }

  stopSession(): void {
    this.streaming = false;
    if (this.frameTimer) {
      clearTimeout(this.frameTimer);
      this.frameTimer = null;
    }
    this.currentSocket = null;
    this.currentSessionId = '';
    this.captureInFlight = false;
    console.log('[Remote] Session stopped');
  }

  private scheduleNext(): void {
    if (!this.streaming) return;
    this.frameTimer = setTimeout(() => {
      this.captureAndSend().finally(() => {
        // Only schedule next if still streaming and no overlap
        if (this.streaming) {
          this.scheduleNext();
        }
      });
    }, this.currentIntervalMs);
  }

  private async captureAndSend(): Promise<void> {
    if (!this.streaming || !this.currentSocket || !this.currentSessionId) return;
    // Prevent overlapping captures
    if (this.captureInFlight) return;
    this.captureInFlight = true;
    try {
      let frameData: CaptureFrame | null = null;

      // Primary: node-screenshots (native DXGI capture, fast)
      frameData = await this.captureViaNodeScreenshots();

      // Fallback: PowerShell
      if (!frameData) {
        frameData = this.captureViaPS(this.currentQuality);
      }

      if (frameData) {
        if (frameData._skipped) {
          // Frame unchanged — skip emitting
          return;
        }
        // Send frame data + binary JPEG buffer as Socket.IO binary attachment
        // Socket.IO detects Buffer in the object and sends it as binary
        if (frameData._buffer) {
          this.currentSocket.emit('remote:frame', {
            sessionId: this.currentSessionId,
            width: frameData.width,
            height: frameData.height,
            frame: frameData._buffer,
          });
        } else {
          // Fallback to base64 (PowerShell path)
          this.currentSocket.emit('remote:frame', {
            sessionId: this.currentSessionId,
            width: frameData.width,
            height: frameData.height,
            frame: frameData.frame,
          });
        }
      }
    } catch (err) {
      const now = Date.now();
      if (now - this.lastCaptureErrorAt > 5000) {
        this.lastCaptureErrorAt = now;
        console.error('[Remote] Frame capture failed:', err);
      }
    } finally {
      this.captureInFlight = false;
    }
  }

  private async captureViaNodeScreenshots(): Promise<CaptureFrame | null> {
    try {
      // Get primary monitor
      const monitors = Monitor.all();
      if (!monitors || monitors.length === 0) {
        throw new Error('No monitors found');
      }

      const monitor = monitors[0];
      const w = monitor.width as number;
      const h = monitor.height as number;

      // Capture raw RGBA pixels for hash comparison and JPEG encoding
      const image = await monitor.captureImage();
      const rawBuffer: Buffer = await image.toRaw();

      // Fast hash comparison (first 8KB + last 8KB + total size = fast fingerprint)
      // This catches most frame changes without hashing the full buffer
      if (w === this.lastFrameWidth && h === this.lastFrameHeight) {
        const sampleSize = Math.min(8192, rawBuffer.length);
        const head = rawBuffer.subarray(0, sampleSize);
        const tail = rawBuffer.subarray(rawBuffer.length - sampleSize);
        const fingerprint = Buffer.concat([
          Buffer.from(String(rawBuffer.length)),
          head,
          tail,
        ]);
        const hash = crypto.createHash('md5').update(fingerprint).digest('hex');

        if (hash === this.lastFrameHash) {
          // Frame is unchanged — skip sending
          return { frame: '', width: w, height: h, _skipped: true };
        }
        this.lastFrameHash = hash;
      } else {
        // Resolution changed, reset hash
        this.lastFrameHash = '';
        this.lastFrameWidth = w;
        this.lastFrameHeight = h;
      }

      // Encode to JPEG using the native module's encoder
      const jpegBuffer: Buffer = await image.toJpeg();

      return {
        frame: jpegBuffer.toString('base64'),
        width: w,
        height: h,
        _buffer: jpegBuffer, // raw buffer for binary transport
      };
    } catch (err) {
      const now = Date.now();
      if (now - this.lastCaptureErrorAt > 5000) {
        this.lastCaptureErrorAt = now;
        console.warn('[Remote] node-screenshots capture failed, falling back:', err);
      }
      return null;
    }
  }

  /**
   * PowerShell-based screenshot fallback for Windows.
   * Uses .NET System.Drawing to capture the screen and save as JPEG.
   */
  private captureViaPS(quality: number): CaptureFrame | null {
    try {
      const tmpFile = require('path').join(require('os').tmpdir(), `resolv_frame_${Date.now()}.jpg`);
      const jpegQuality = Math.max(15, Math.min(95, Math.round(quality || 55)));
      const ps = `
        Add-Type -AssemblyName System.Drawing, System.Windows.Forms
        $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
        $bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
        $gfx = [System.Drawing.Graphics]::FromImage($bmp)
        $gfx.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
        $enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object {$_.MimeType -eq 'image/jpeg'}
        $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
        $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, ${jpegQuality}L)
        $bmp.Save('${tmpFile.replace(/\\/g, '\\\\')}', $enc, $params)
        $gfx.Dispose(); $bmp.Dispose()
        Write-Output "$($bounds.Width) $($bounds.Height)"
      `.trim();

      const out = execSync(`powershell -NonInteractive -Command "${ps.replace(/"/g, '\\"')}"`, {
        timeout: 3000,
        encoding: 'utf8',
      }).trim();

      const [w, h] = out.split(' ').map(Number);
      const buf = require('fs').readFileSync(tmpFile);
      require('fs').unlinkSync(tmpFile);
      return { frame: buf.toString('base64'), width: w || 1920, height: h || 1080 };
    } catch (err) {
      const now = Date.now();
      if (now - this.lastCaptureErrorAt > 5000) {
        this.lastCaptureErrorAt = now;
        console.error('[Remote] PowerShell capture failed:', err);
      }
      return null;
    }
  }

  handleInput(type: string, payload: any): void {
    try {
      switch (type) {
        case 'mousemove': {
          if (typeof payload.x === 'number' && typeof payload.y === 'number') {
            this.psMouseMove(Math.round(payload.x), Math.round(payload.y));
          }
          break;
        }
        case 'click': {
          this.psMouseClick(Math.round(payload.x || 0), Math.round(payload.y || 0), payload.button || 'left');
          break;
        }
        case 'keydown': {
          if (payload.key) {
            this.psSendKey(
              payload.key,
              payload.ctrl ?? payload.ctrlKey,
              payload.alt ?? payload.altKey,
              payload.shift ?? payload.shiftKey,
              payload.special
            );
          }
          break;
        }
        case 'scroll': {
          this.psScroll(Math.round(payload.deltaY || 0));
          break;
        }
      }
    } catch (err) {
      console.error(`[Remote] Input error (${type}):`, err);
    }
  }

  private psMouseMove(x: number, y: number) {
    execSync(
      `powershell -NonInteractive -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x},${y})"`,
      { timeout: 500 }
    );
  }

  private psMouseClick(x: number, y: number, button: string | number) {
    this.psMouseMove(x, y);
    const isRightClick = button === 'right' || button === '2';
    const downFlag = isRightClick ? 8 : 2;
    const upFlag = isRightClick ? 16 : 4;
    execSync(
      `powershell -NonInteractive -Command "Add-Type @'
using System.Runtime.InteropServices;
public class Mouse {
  [DllImport(\\"user32.dll\\")] public static extern void mouse_event(uint f,uint x,uint y,uint d,uint e);
}
'@; [Mouse]::mouse_event(${downFlag},0,0,0,0); [Mouse]::mouse_event(${upFlag},0,0,0,0)"`,
      { timeout: 1000 }
    );
  }

  private psSendKey(key: string, ctrl?: boolean, alt?: boolean, shift?: boolean, special?: boolean) {
    // Map common keys to SendKeys notation
    const keyMap: Record<string, string> = {
      Enter: '{ENTER}', Escape: '{ESC}', Backspace: '{BACKSPACE}',
      Tab: '{TAB}', Delete: '{DELETE}', Home: '{HOME}', End: '{END}',
      ArrowUp: '{UP}', ArrowDown: '{DOWN}', ArrowLeft: '{LEFT}', ArrowRight: '{RIGHT}',
      F1: '{F1}', F2: '{F2}', F3: '{F3}', F4: '{F4}', F5: '{F5}',
      F6: '{F6}', F7: '{F7}', F8: '{F8}', F9: '{F9}', F10: '{F10}',
      F11: '{F11}', F12: '{F12}', Insert: '{INSERT}', PageUp: '{PGUP}', PageDown: '{PGDN}',
    };
    let sendKey = special ? key : keyMap[key] || (key.length === 1 ? key : '');
    if (!sendKey) return;
    if (ctrl) sendKey = `^${sendKey}`;
    if (alt) sendKey = `%${sendKey}`;
    if (shift) sendKey = `+${sendKey}`;

    execSync(
      `powershell -NonInteractive -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${sendKey.replace(/'/g, "\\'")}')"`,
      { timeout: 1000 }
    );
  }

  private psScroll(deltaY: number) {
    const clicks = Math.sign(deltaY) * Math.min(3, Math.abs(Math.round(deltaY / 100)));
    if (clicks === 0) return;
    execSync(
      `powershell -NonInteractive -Command "Add-Type @'
using System.Runtime.InteropServices;
public class Mouse {
  [DllImport(\\"user32.dll\\")] public static extern void mouse_event(uint f,uint x,uint y,uint d,uint e);
}
'@; [Mouse]::mouse_event(0x0800,0,0,${clicks * 120},0)"`,
      { timeout: 500 }
    );
  }
}
