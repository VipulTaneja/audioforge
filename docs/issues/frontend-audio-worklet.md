# Issue: Frontend - Add Audio Worklet for Compute-Intensive DSP

## Issue Description
The current Web Audio API implementation runs on the main thread, which can cause audio glitches during compute-intensive DSP operations (metering, effects). Audio Worklets run on a separate thread for smoother playback.

## Current Problems
1. **Main thread blocking**: Metering, reverb IR, delay processing all on main thread
2. **Audio glitches**: Possible dropouts during heavy processing
3. **No offline processing**: Can't do non-real-time rendering
4. **Limited nodes**: Custom DSP requires ScriptProcessorNode (deprecated)

## Expected Solution
Implement Audio Worklet for metering:
```typescript
// meters.worklet.ts
class MeterProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      // Calculate RMS, peak
      // Send to main thread via port.postMessage()
    }
    return true;
  }
}

registerProcessor('meter-processor', MeterProcessor);
```

And use it in the main code:
```typescript
const audioContext = new AudioContext();
await audioContext.audioWorklet.addModule('/meters.worklet.js');
const meterNode = new AudioWorkletNode(audioContext, 'meter-processor');
source.connect(meterNode);
meterNode.port.onmessage = (event) => {
  // Update meters
};
```

## Priority
Medium - Enhances reliability for professional use

## Related
- Technical Architecture: `docs/technical-architecture.md`
