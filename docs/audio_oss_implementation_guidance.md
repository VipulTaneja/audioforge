# Audio OSS Implementation Guidance for the Team

## Purpose

This document translates the OSS audio research into implementation guidance for the engineering team building this project.

The goal is not to adopt every library. The goal is to choose a **small, stable core stack** and add specialized libraries only where they clearly solve a product requirement.

---

## Executive recommendation

### Recommended default stack

| Use case | Recommended library | Why |
|---|---|---|
| Container and codec handling, channel split/merge, robust media I/O | **PyAV** | Best FFmpeg-backed Python integration for serious media workflows |
| Simple edit operations like trim, concat, fade, export | **PyDub** | Fast to implement and easy for product workflows |
| CLI fallback and advanced filter graph execution | **FFmpeg CLI** | Most reliable backbone for edge-case media operations |
| Noise reduction for classical DSP preprocessing | **noisereduce** | Good lightweight denoise for offline preprocessing |
| Speech enhancement / speech pipelines | **SpeechBrain** | Strong maintained speech ML toolkit |
| Speaker diarization | **pyannote.audio** | Best-fit OSS option for diarization pipelines |
| Music stem separation | **Spleeter** initially | Easy adoption, popular, recent releases |
| Studio-style effects / plugin hosting | **Pedalboard** | Useful for effects chains, but watch GPL implications |
| Research-grade acoustic / array processing | **Acoular** or **pyfar** | Only if project truly needs microphone-array / spatial acoustics workflows |

### Not recommended as core dependencies

| Library | Recommendation | Why |
|---|---|---|
| **ffmpeg-python** | Avoid as primary core | Popular, but slow-moving; use only if it simplifies a narrow workflow |
| **Demucs** | Do not make it core without forking/vendor plan | Good tech, but maintenance posture is weak |
| **librosa** | Use for analysis only, not media backbone | Great for features and DSP analysis, not operational media workflows |
| **torchaudio** | Use only inside ML services | Good for tensor pipelines, but should not become the general platform media layer |
| **audiomentations** | Use only for training pipelines | Useful for augmentation, not for end-user audio editing |
| **madmom / OpenSoundscape / Matchering** | Use only for specific niche modules | Valuable, but not default foundation libraries |

---

## Architecture recommendation

Build the platform in **layers**:

### 1. Media I/O layer
Use:
- **PyAV**
- **FFmpeg CLI**

Responsibilities:
- read/write audio files
- inspect channels, codecs, durations, sample rates
- split multichannel tracks
- merge mono/stereo stems into final tracks
- transcode between formats
- normalize operational handling of WAV, MP3, AAC, FLAC, etc.

### 2. Editing layer
Use:
- **PyDub** for product-facing quick operations
- **FFmpeg CLI** for exact channel maps and complex transforms

Responsibilities:
- cut, trim, merge, fade
- create previews
- create clips
- export user-ready assets

### 3. DSP preprocessing layer
Use:
- **noisereduce**
- selective **librosa** / NumPy / SciPy utilities

Responsibilities:
- offline denoising
- silence analysis
- loudness / spectral analysis
- feature extraction where needed

### 4. ML intelligence layer
Use:
- **SpeechBrain** for speech enhancement / speech separation where applicable
- **pyannote.audio** for diarization
- **Spleeter** for music stem separation in first version

Responsibilities:
- speech cleanup
- speaker segmentation
- source separation
- future model-based enhancement features

### 5. Optional effects layer
Use:
- **Pedalboard**

Responsibilities:
- reverb, compressor, EQ, delay, plugin-based enhancement
- controlled offline rendering
- creative effects chain support

### 6. Specialized acoustics layer
Use only if justified:
- **Acoular**
- **pyfar**

Responsibilities:
- microphone array processing
- beamforming
- acoustic research workflows
- spatial/acoustics experimentation

---

## What to use when

## A. Noise reduction

### Use **noisereduce** when:
- input is single speaker or simple audio
- you need quick classical denoising
- workflow is offline and deterministic
- you want light dependency footprint

### Use **SpeechBrain** when:
- audio is speech-heavy
- denoising/enhancement quality matters more than simplicity
- GPU-backed inference is acceptable
- you want future extensibility into ASR / speech pipelines

### Do not:
- apply denoise blindly to every file
- stack multiple denoisers unless benchmarked
- denoise after aggressive compression or lossy transcoding if you can avoid it

### Best practice:
- denoise on high-quality PCM/WAV intermediate files
- benchmark with representative noisy samples
- track objective and subjective quality separately

---

## B. Multichannel split / merge / channel mapping

### Use **PyAV** and **FFmpeg CLI** when:
- splitting 5.1 / 7.1 / multichannel stems
- remapping channels
- extracting specific channels
- rebuilding output tracks from separated mono/stereo components

### Use **PyDub** when:
- working with simple stereo/mono product workflows
- creating previews or exports quickly
- operational precision is less complex

### Do not:
- rely on PyDub alone for serious multichannel workflows
- assume channel order is identical across all source files
- assume metadata is correct without validation

### Best practice:
- standardize an internal canonical channel order
- validate channel count and layout on ingest
- keep raw source untouched and create derived working assets
- store channel maps explicitly in metadata, not just filenames

---

## C. Stem separation

### Use **Spleeter** when:
- first version needs a working and known OSS separator quickly
- music separation is important
- TensorFlow dependency is acceptable

### Consider **Demucs** only when:
- you want to experiment with potentially better separation quality
- you are ready to vendor/fork
- the team accepts maintenance risk

### Do not:
- expose separation output as “perfect”
- treat separated stems as clean ground truth
- mix model outputs from different separators in one pipeline without calibration

### Best practice:
- define acceptable artifacts for product quality
- store confidence/quality metadata if possible
- keep separator service isolated from core product services

---

## D. Speaker diarization and speech intelligence

### Use **pyannote.audio** when:
- requirement is “who spoke when”
- meeting, interview, podcast, or multi-speaker segmentation is needed

### Use **SpeechBrain** when:
- diarization is only part of a larger speech intelligence stack
- enhancement, speech separation, or speech classification are nearby roadmap items

### Do not:
- expect perfect diarization in overlap-heavy audio
- run diarization on heavily downsampled or damaged audio unless tested

### Best practice:
- normalize sample rate before inference
- benchmark on your own domain audio
- separate diarization service from editing pipeline

---

## E. Audio effects and enhancement

### Use **Pedalboard** when:
- you need studio-style effects
- you want a programmable effects chain
- you may load third-party plugins

### Do not:
- bring Pedalboard into the core if GPL licensing is a legal problem
- allow arbitrary plugin loading in multi-tenant production without sandboxing
- combine creative FX and cleanup FX in the same uncontrolled chain

### Best practice:
- isolate effects rendering into a worker/service boundary
- define approved effect presets
- version every effect chain used in production

---

## F. Analysis and feature extraction

### Use **librosa** when:
- you need spectrograms, onset analysis, tempo/features, or DSP inspection
- you are building analytics, not operational media pipelines

### Use **torchaudio** when:
- tensors are already the standard representation
- workflow lives inside ML training/inference services

### Do not:
- use librosa as the main production I/O layer
- make torchaudio the default dependency for non-ML services

### Best practice:
- keep analysis code separate from media operations code
- use PCM intermediates for reproducible analysis

---

## Recommended implementation choices

## Choice 1: Core media stack
**Adopt**
- PyAV
- FFmpeg CLI
- PyDub

This should be the product foundation.

## Choice 2: Initial ML stack
**Adopt**
- noisereduce
- SpeechBrain
- pyannote.audio
- Spleeter

This is enough for:
- denoise
- enhancement
- diarization
- stem separation

## Choice 3: Optional controlled additions
**Add later only if needed**
- Pedalboard
- Acoular
- pyfar
- torchaudio
- librosa-heavy modules

---

## Do's

- Use **FFmpeg/PyAV as source of truth** for media handling.
- Keep **editing**, **DSP**, and **ML inference** in separate layers/services.
- Standardize on **WAV/PCM intermediates** for internal processing.
- Validate **sample rate**, **bit depth**, **channels**, and **duration** at ingest.
- Benchmark all algorithms on **your own project data**, not demo files.
- Treat OSS model-based output as **probabilistic**, not exact.
- Pin versions of all critical libraries and FFmpeg binaries.
- Build regression tests around representative audio fixtures.
- Preserve original uploaded file and generate derived artifacts immutably.
- Capture full processing lineage in metadata.

---

## Don'ts

- Do not build the product around a single “magic” audio library.
- Do not mix many overlapping libraries just because they exist.
- Do not let UI workflows directly depend on raw ML model APIs.
- Do not assume stereo-first libraries will safely generalize to multichannel.
- Do not assume open source popularity means production stability.
- Do not upgrade FFmpeg, PyTorch, TensorFlow, or model packages casually.
- Do not chain multiple lossy encodes during intermediate processing.
- Do not hide quality degradation from users or internal QA.

---

## Best practices

## 1. Use WAV internally
For almost all transformations:
- decode to WAV/PCM internally
- process in PCM
- encode only at final delivery stage

This reduces:
- generational loss
- inconsistent decoder behavior
- debugging difficulty

## 2. Separate synchronous and asynchronous work
Keep these synchronous:
- trim
- clip creation
- metadata inspection
- simple export

Move these to async workers:
- denoise
- diarization
- stem separation
- long effects rendering
- batch multichannel remapping

## 3. Version the pipeline
Every produced file should know:
- source file id
- pipeline version
- library versions
- model version
- FFmpeg build version
- settings used

## 4. Normalize ingest
Create a normalized ingest contract:
- canonical sample rate
- canonical channel metadata model
- canonical loudness/storage rules
- canonical intermediate format

## 5. Benchmark subjectively and objectively
For each important workflow, measure:
- latency
- memory
- failure rate
- perceptual quality
- artifact rate
- correctness of channel mapping

## 6. Guard licensing
Before production adoption, legal review is required especially for:
- Pedalboard GPL implications
- plugin hosting
- pretrained model licenses
- bundled binaries

## 7. Prefer service boundaries for risky components
Strong candidates for isolated workers/services:
- TensorFlow stack
- PyTorch model stack
- third-party plugin execution
- experimental acoustics libraries

This protects the core application from dependency churn.

---

## Suggested service split

| Service | Main libraries |
|---|---|
| Media ingest and inspection | PyAV, FFmpeg CLI |
| Editing/export service | PyDub, FFmpeg CLI |
| Speech processing service | noisereduce, SpeechBrain, pyannote.audio |
| Music separation service | Spleeter initially |
| Effects rendering service | Pedalboard |
| Research/spatial sandbox | Acoular, pyfar, librosa, torchaudio |

---

## Suggested rollout sequence

### Phase 1
- PyAV
- FFmpeg CLI
- PyDub

Deliver:
- ingest
- format conversion
- trim/split/merge
- multichannel extraction basics

### Phase 2
- noisereduce
- SpeechBrain
- pyannote.audio

Deliver:
- denoise
- speech enhancement
- diarization

### Phase 3
- Spleeter
- optional Pedalboard

Deliver:
- stem separation
- effects chains

### Phase 4
- evaluate Demucs fork strategy
- evaluate Acoular / pyfar if spatial roadmap becomes real

---

## Final recommendation

For this project, the safest and most practical approach is:

1. **Make PyAV + FFmpeg CLI the platform backbone**
2. **Use PyDub for high-speed product workflows**
3. **Use noisereduce for simple DSP denoise**
4. **Use SpeechBrain + pyannote.audio for speech intelligence**
5. **Use Spleeter first for stem separation**
6. **Add Pedalboard only with license review**
7. **Treat Demucs, Acoular, pyfar, torchaudio, librosa-heavy usage as specialized additions, not default core**

That gives the team:
- a stable operational foundation
- room for advanced ML features
- controlled complexity
- lower long-term maintenance risk

---

## Short version for the team

**Default answer:**
- media handling -> **PyAV + FFmpeg**
- simple edits -> **PyDub**
- denoise -> **noisereduce**
- speech ML -> **SpeechBrain**
- diarization -> **pyannote.audio**
- stem separation -> **Spleeter**
- effects -> **Pedalboard only if licensing is cleared**
- multichannel/spatial R&D -> **Acoular / pyfar only if truly needed**

