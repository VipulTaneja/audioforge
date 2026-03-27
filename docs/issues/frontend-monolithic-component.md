# Issue: Frontend - Decompose Monolithic page.tsx Component

## Issue Description
The main project detail page (`frontend/src/app/projects/[id]/page.tsx`) is over 3000 lines, mixing concerns including UI rendering, audio state management, API calls, and complex effects. This makes the code difficult to maintain, test, and understand.

## Current Problems
1. **Single 3000+ line file** - All functionality in one component
2. **Mixed concerns** - UI, audio processing, state management, API calls all in one file
3. **Difficult to test** - Can't isolate and test individual features
4. **Hard to onboard** - New developers must understand entire file
5. **Fragile audio handling** - Web Audio API nodes managed in useEffect with complex cleanup logic

## Technical Details
- File: `frontend/src/app/projects/[id]/page.tsx`
- Lines: ~3300+
- Contains: React components, Web Audio API logic, state management, API calls, effects hooks

## Expected Solution
Break the component into smaller, focused components:

```
frontend/src/components/
├── mixer/
│   ├── AudioMixer.tsx        # Main mixer container
│   ├── TrackControls.tsx     # Volume, pan, mute, solo controls per track
│   ├── MeterBar.tsx          # Peak/RMS/Phase/LUFS meters
│   ├── Timeline.tsx          # Timeline with playhead
│   └── TrackRow.tsx          # Individual track row
├── effects/
│   ├── ReverbControl.tsx
│   └── DelayControl.tsx
└── ProjectDetailLayout.tsx   # Main layout wrapper
```

## Benefits
- Easier to test individual components
- Better code reuse
- Clearer separation of concerns
- Easier onboarding for new developers
- Better TypeScript typing

## Priority
Medium - Doesn't block functionality but impacts maintainability

## Related
- Technical Architecture: `docs/technical-architecture.md`
- Part of frontend code quality improvements
