# AudioForge - Feature ToDo List

Complexity Scale: 1 = Easy, 10 = Very Hard

---

## Quick Wins (Complexity 1-3)

These are mostly UI additions or use existing libraries.

| Feature | Complexity | Status | Notes |
|---------|------------|--------|-------|
| **BPM Detection** | 2/10 | ✅ DONE | Backend: `/api/v1/assets/{id}/bpm`, Frontend: MusicNote icon button |
| **Key Detection** | 2/10 | ✅ DONE | Backend: `/api/v1/assets/{id}/key`, Frontend: Music icon button |
| **Peak/RMS Meters** | 2/10 | ✅ DONE | Master meter shows both peak and RMS levels |
| **Phase Meter** | 3/10 | ✅ DONE | Shows stereo phase correlation (+100 to -100) |
| **Lo-fi / Bitcrusher** | 3/10 | Skip | Requires complex audio processing pipeline |

---

## Straightforward (Complexity 3-5)

These require some audio processing but are well-documented.

| Feature | Complexity | Status | Notes |
|---------|------------|--------|-------|
| **Reverb** | 3/10 | Pending | Requires audio pipeline changes |
| **Delay / Echo** | 3/10 | Pending | Requires audio pipeline changes |
| **Chorus & Flanger** | 4/10 | Pending | LFO-modulated delay |
| **Multiple Export Formats** | 4/10 | Pending | Use ffmpeg or Python audio libraries |
| **Mixdown** | 3/10 | ✅ DONE | Basic export of selected stem |
| **Stem Export** | 3/10 | ✅ DONE | Download button in mixer |
| **Pitch Shifting** | 4/10 | Pending | Phase vocoder or PSOLA algorithm |
| **Time Stretching** | 4/10 | Pending | Phase vocoder or WSOLA |
| **Compressor** | 4/10 | Pending | Requires audio pipeline changes |
| **EQ (Equalizer)** | 4/10 | Pending | Requires audio pipeline changes |
| **Loudness Meter (LUFS)** | 4/10 | ✅ DONE | Per ITU-R BS.1770 standard |

---

## Moderate (Complexity 5-7)

These require more complex algorithms or integration work.

| Feature | Complexity | Notes |
|---------|------------|-------|
| **Noise Reduction** | 6/10 | RNNoise already integrated, expose UI |
| **De-reverb** | 6/10 | Deep learning model or adaptive filter |
| **De-clipping** | 6/10 | Interpolation + spectral repair |
| **Voice Enhancement** | 5/10 | Combine noise reduction + EQ + compression |
| **Vocal Doubler** | 5/10 | Time-stretch + pitch variation + delay |
| **Spectral Analyzer** | 5/10 | ✅ DONE | FFT visualization, real-time updates |
| **Vocal Harmonizer** | 6/10 | Pending | Pitch shifting + reverb + delay |
| **AI Auto-Mix** | 7/10 | Pending | Train model on professional mixes |
| **Stem Enhancement** | 6/10 | Pending | Upsampling + refinement models |
| **Comments & Markers** | 5/10 | ✅ DONE | Database + UI timeline markers |
| **Version History** | 5/10 | ✅ DONE | Snapshot assets/settings on save |

---

## Complex (Complexity 7-8)

These require significant ML models or complex integration.

| Feature | Complexity | Notes |
|---------|------------|-------|
| **Auto-Tune / Pitch Correction** | 7/10 | Celery + pitch detection + correction |
| **Voice Conversion** | 8/10 | RVC/SoVITS models, consent handling |
| **AI Mastering** | 8/10 | Train/mastered reference model |
| **Audio to MIDI** | 7/10 | CREPE for melody + onset detection |
| **Stem Generation** | 7/10 | Extend Demucs or train custom model |
| **Stem Swap** | 8/10 | Content matching + seamless blending |
| **Stem Match** | 7/10 | Style transfer or GAN-based |
| **Project Sharing** | 7/10 | Auth + permissions + data migration |

---

## Very Hard (Complexity 8-10)

These require significant research, training, or complex systems.

| Feature | Complexity | Notes |
|---------|------------|-------|
| **Binaural / 3D Audio** | 8/10 | HRTF processing, head tracking |
| **Surround Sound (5.1/7.1)** | 9/10 | Upmixing algorithm, speaker routing |
| **Video Export** | 8/10 | ffmpeg integration, sync handling |
| **Audio Repair** | 7/10 | Multi-band processing + declick |

---

## Priority Order (Recommended)

Based on complexity vs. user value:

### Phase 1: Quick Value (Do First)
1. ✅ **BPM Detection** (2/10) - DONE
2. ✅ **Key Detection** (2/10) - DONE
3. ✅ **Peak/RMS Meters** (2/10) - DONE
4. ✅ **Phase Meter** (3/10) - DONE
5. **Mixdown** (3/10) - Essential export feature
6. **Stem Export** (3/10) - Already have download
7. **Reverb** (3/10) - Popular effect
8. **Delay/Echo** (3/10) - Popular effect

### Phase 2: Enhance Existing
9. ✅ **Mixdown** (3/10) - Export selected stems (basic implementation)
10. ✅ **Stem Export** (3/10) - Download individual assets
11. **Reverb** (3/10) - Requires audio pipeline changes
12. **Delay/Echo** (3/10) - Requires audio pipeline changes
13. **Compressor** (4/10) - Requires audio pipeline changes
14. **EQ** (4/10) - Requires audio pipeline changes
15. **Noise Reduction** (6/10) - Already have RNNoise, needs UI exposure
16. **Pitch Shifting** (4/10) - Useful for composer
17. **Time Stretching** (4/10) - Tempo without pitch
18. **Loudness Meter** (4/10) - Streaming compliance

### Phase 3: Advanced Features
14. **Vocal Doubler** (5/10) - Quick effect
15. **Voice Enhancement** (5/10) - Quality improvement
16. **AI Auto-Mix** (7/10) - High value, needs training
17. **AI Mastering** (8/10) - High value, needs training
18. **Auto-Tune** (7/10) - Popular feature

### Phase 4: Future
19. Voice Conversion (8/10)
20. Stem Swap/Match (7-8/10)
21. Binaural Audio (8/10)
22. Video Export (8/10)

---

## Notes

- **Complexity factors**: ML model training, real-time processing, UI complexity, testing effort
- Features with existing libraries (librosa, scipy, pydub) are easier
- Features requiring custom ML training are hardest
- Real-time processing in browser is easier than server-side async jobs
