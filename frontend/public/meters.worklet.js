class MeterProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.spectrumBands = 16;
    this.historySize = 400;
    this.spectrumHistory = new Float32Array(this.spectrumBands * this.historySize);
    this.historyIndex = 0;
    this.frameCount = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0 || !input[0]) {
      return true;
    }

    const channelData = input[0];
    const channelCount = input.length;
    const frameCount = channelData.length;

    let sumSquares = 0;
    let peak = 0;
    let peakL = 0;
    let peakR = 0;

    const leftChannel = channelData;
    const rightChannel = channelCount > 1 ? input[1] : channelData;

    for (let i = 0; i < frameCount; i++) {
      const leftSample = leftChannel[i];
      const rightSample = rightChannel[i];

      sumSquares += leftSample * leftSample + rightSample * rightSample;

      const absLeft = Math.abs(leftSample);
      const absRight = Math.abs(rightSample);

      if (absLeft > peak) peak = absLeft;
      if (absLeft > peakL) peakL = absLeft;
      if (absRight > peakR) peakR = absRight;
    }

    const rms = Math.sqrt(sumSquares / (frameCount * 2));
    const peakLevel = Math.min(1, peak * 1.35);
    const rmsLevel = Math.min(1, rms * 2.5);
    const stereoLevel = {
      l: Math.min(1, peakL * 2),
      r: Math.min(1, peakR * 2)
    };

    const spectrumData = this.calculateSpectrum(leftChannel, frameCount);

    this.spectrumHistory.set(
      spectrumData,
      this.historyIndex * this.spectrumBands
    );
    this.historyIndex = (this.historyIndex + 1) % this.historySize;

    const loudness = this.calculateLoudness(rms);

    this.frameCount++;

    if (this.frameCount % 3 === 0) {
      const phaseCorrelation = this.calculatePhaseCorrelation(
        leftChannel,
        rightChannel,
        frameCount
      );

      this.port.postMessage({
        type: 'meter',
        peak: peakLevel,
        rms: rmsLevel,
        stereo: stereoLevel,
        spectrum: spectrumData,
        loudness: loudness,
        phase: phaseCorrelation
      });
    }

    return true;
  }

  calculateSpectrum(channelData, frameCount) {
    const bins = 128;
    const step = Math.floor(frameCount / bins);
    const result = new Float32Array(this.spectrumBands);

    if (step === 0) return result;

    const bandSize = Math.floor(bins / this.spectrumBands);

    for (let band = 0; band < this.spectrumBands; band++) {
      let sum = 0;
      const startBin = band * bandSize;
      const endBin = Math.min(startBin + bandSize, bins);

      for (let bin = startBin; bin < endBin; bin++) {
        const idx = bin * step;
        if (idx < frameCount) {
          sum += Math.abs(channelData[idx]);
        }
      }

      result[band] = sum / (endBin - startBin);
    }

    return result;
  }

  calculateLoudness(rms) {
    const dbfs = 20 * Math.log10(Math.max(rms, 0.0001));
    const lufs = dbfs - 0.691;
    return Math.max(-70, Math.min(0, lufs));
  }

  calculatePhaseCorrelation(left, right, frameCount) {
    const half = Math.floor(frameCount / 2);
    if (half === 0) return 1;

    let sum = 0;
    let sumLeft = 0;
    let sumRight = 0;

    for (let i = 0; i < half; i++) {
      const l = left[i * 2] || 0;
      const r = right[i * 2] || 0;
      sum += l * r;
      sumLeft += l * l;
      sumRight += r * r;
    }

    const denominator = Math.sqrt(sumLeft * sumRight);
    if (denominator === 0) return 1;
    return Math.max(-1, Math.min(1, sum / denominator));
  }
}

registerProcessor('meter-processor', MeterProcessor);
