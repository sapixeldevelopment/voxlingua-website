const TARGET_SAMPLE_RATE = 16_000;
const MAX_SAMPLE_SECONDS = 45;
const MIN_SPEECH_SECONDS = 2.5;

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function encodePcmWav(samples: Float32Array, sampleRate: number) {
  const bytesPerSample = 2;
  const dataLength = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += bytesPerSample;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function frameRms(audioBuffer: AudioBuffer, start: number, length: number) {
  let sum = 0;
  let count = 0;
  for (let channelIndex = 0; channelIndex < audioBuffer.numberOfChannels; channelIndex += 1) {
    const channel = audioBuffer.getChannelData(channelIndex);
    const end = Math.min(channel.length, start + length);
    for (let index = start; index < end; index += 1) {
      sum += channel[index] * channel[index];
      count += 1;
    }
  }
  return count ? Math.sqrt(sum / count) : 0;
}

/**
 * Produces a short mono WAV containing only likely speech frames. The sample is
 * used transiently for audio-integrity analysis and is never the review recording.
 */
export async function createApplicantVoiceSample(source: Blob): Promise<Blob | null> {
  if (!source.size || typeof window === "undefined") return null;
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await source.arrayBuffer());
    if (!decoded.length || !decoded.numberOfChannels) return null;

    const frameLength = Math.max(1, Math.floor(decoded.sampleRate * 0.02));
    const frames: Array<{ start: number; length: number; rms: number }> = [];
    for (let start = 0; start < decoded.length; start += frameLength) {
      const length = Math.min(frameLength, decoded.length - start);
      frames.push({ start, length, rms: frameRms(decoded, start, length) });
    }
    const sortedLevels = frames.map((frame) => frame.rms).sort((a, b) => a - b);
    const noiseFloor = sortedLevels[Math.floor(sortedLevels.length * 0.2)] || 0;
    const speechThreshold = Math.max(0.009, noiseFloor * 2.8);
    const maxSamples = TARGET_SAMPLE_RATE * MAX_SAMPLE_SECONDS;
    const output: number[] = [];
    const includeFrame = frames.map((frame) => frame.rms >= speechThreshold);
    const paddedFrames = [...includeFrame];
    for (let index = 0; index < includeFrame.length; index += 1) {
      if (!includeFrame[index]) continue;
      for (let nearby = Math.max(0, index - 6); nearby <= Math.min(includeFrame.length - 1, index + 10); nearby += 1) {
        paddedFrames[nearby] = true;
      }
    }

    for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
      if (!paddedFrames[frameIndex]) continue;
      const frame = frames[frameIndex];
      const targetLength = Math.max(1, Math.floor(frame.length * TARGET_SAMPLE_RATE / decoded.sampleRate));
      for (let targetIndex = 0; targetIndex < targetLength && output.length < maxSamples; targetIndex += 1) {
        const sourceIndex = Math.min(decoded.length - 1, frame.start + Math.floor(targetIndex * decoded.sampleRate / TARGET_SAMPLE_RATE));
        let mono = 0;
        for (let channelIndex = 0; channelIndex < decoded.numberOfChannels; channelIndex += 1) {
          mono += decoded.getChannelData(channelIndex)[sourceIndex] || 0;
        }
        output.push(mono / decoded.numberOfChannels);
      }
      if (output.length >= maxSamples) break;
    }

    if (output.length < TARGET_SAMPLE_RATE * MIN_SPEECH_SECONDS) return null;
    return encodePcmWav(Float32Array.from(output), TARGET_SAMPLE_RATE);
  } finally {
    await context.close().catch(() => undefined);
  }
}
