/**
 * يحوّل أي Blob صوت (زي webm/opus اللي بيطلع من MediaRecorder) لملف WAV قياسي.
 * السبب: واتساب وتطبيقات كتير بترفض ملفات webm الصوتية حتى لو الامتداد اتغيّر،
 * لكن WAV صيغة أساسية مدعومة من الجميع.
 */
export async function blobToWav(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioContextClass();
  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    return audioBufferToWavBlob(audioBuffer);
  } finally {
    audioCtx.close();
  }
}

function audioBufferToWavBlob(audioBuffer) {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const bitDepth = 16;

  const interleaved =
    numChannels === 2
      ? interleave(audioBuffer.getChannelData(0), audioBuffer.getChannelData(1))
      : audioBuffer.getChannelData(0);

  const dataLength = interleaved.length * (bitDepth / 8);
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  floatTo16BitPCM(view, 44, interleaved);

  return new Blob([view], { type: 'audio/wav' });
}

function interleave(left, right) {
  const length = left.length + right.length;
  const result = new Float32Array(length);
  let index = 0;
  let inputIndex = 0;
  while (index < length) {
    result[index++] = left[inputIndex];
    result[index++] = right[inputIndex];
    inputIndex++;
  }
  return result;
}

function floatTo16BitPCM(view, offset, input) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
