# Mixer Waveform Display Issue

## Status: ✅ RESOLVED

## Resolution

The issue was that the backend returns a fixed 200 waveform peaks, but the canvas was drawing more bars than peaks on wide screens, which compressed the waveform into the left portion of the display.

**Fix Applied:**
1. Added `ResizeObserver` to measure the actual container width
2. Added `canvasSize` state to track container dimensions and trigger re-renders
3. Interpolated the 200 backend peaks across the full canvas width
4. Fixed timeline ruler to use percentage-based positioning for alignment
5. Cleaned up TypeScript issues around audio preloading and oscillator startup

**Files Modified:**
- `frontend/src/app/projects/[id]/page.tsx` - Waveform component with ResizeObserver and peak interpolation

---

## Problem Statement (Original)

In the mixer component of the AudioForge frontend, the waveform visualization has incorrect display issues:

1. **Timeline ruler** now shows correct duration (0:30 for 30-second audio)
2. **Waveform fills only ~50% of the area** instead of 100%
3. The red playhead and waveform coloring are in synch with each other, but not be in sync with actual audio playback

## Project Context

### Tech Stack
- **Frontend**: Next.js (React) with TypeScript
- **Backend**: FastAPI (Python)
- **Audio Processing**: Celery workers with Demucs
- **Storage**: MinIO (S3-compatible)
- **Styling**: Tailwind CSS

### Project Structure
```
/home/vipul/src/test-opencode/
├── frontend/src/app/projects/[id]/page.tsx   # Main project detail page (mixer component)
├── backend/app/api/assets.py                 # Waveform API endpoint
└── AGENTS.md                                 # Agent guidelines
```

## Known Facts

### Audio Duration
- All 4 stems (vocals, drums, bass, other) have correct duration: **30.77 seconds**
- `totalDuration` state IS being set correctly (confirmed by debug logs)
- `durationRef.current` is also set to 30.77

### Code Logic is Correct
- Math calculations for progress percentage are correct
- `effectiveDuration` and `progress` are computed correctly
- Timeline ruler now uses percentage-based positioning

### Susppected Root Cause
The waveform only fills ~50% of the area. Possible causes:
1. **CSS/Flexbox layout issue**: Waveform container not stretching to full width
2. **Canvas rendering issue**: Canvas width not matching container width
3. **Timing issue**: Effect not re-running when `audioDuration` is set (this was partially fixed by adding `audioDuration` to dependency array, but issue persists)

## Code Locations

### Main Mixer Component
**File**: `/home/vipul/src/test-opencode/frontend/src/app/projects/[id]/page.tsx`

Key sections:
- **Timeline ruler rendering**: Lines ~972-988
- **Waveform component call**: Lines ~1064-1071
- **Waveform component definition**: Lines ~1096-1241
- **Playhead position**: Line ~1084-1085

### Waveform API Endpoint
**File**: `/home/vipul/src/test-opencode/backend/app/api/assets.py`
- **Waveform endpoint**: Lines ~131-190
- Returns 200 peaks with duration

## Timeline Ruler Code (Current)

```jsx
<div className="flex-1 p-1 relative">
  <div className="absolute inset-x-0 text-xs text-gray-500 dark:text-gray-400 font-mono pointer-events-none">
    {Array.from({ length: Math.floor(totalDuration / 10) + 1 }, (_, i) => {
      const markerTime = i * 10;
      const position = totalDuration > 0 ? (markerTime / totalDuration) * 100 : 0;
      return (
        <span 
          key={i} 
          className="absolute text-center"
          style={{ left: `${position}%`, transform: 'translateX(-50%)' }}
        >
          {formatTime(markerTime)}
        </span>
      );
    })}
  </div>
</div>
```

## Waveform Component Code (Current)

```tsx
function Waveform({ assetId, color, currentTime, isPlaying, stemType, audioDuration }: { 
  assetId?: string;
  color: string; 
  currentTime: number;
  isPlaying: boolean;
  stemType: string;
  audioDuration?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // ... state for waveformData, waveformDuration, etc.

  // Fetch waveform data when assetId changes
  useEffect(() => {
    // Fetches from /api/v1/assets/{assetId}/waveform
    // Sets waveformDuration from API response
  }, [assetId]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    
    const width = rect.width;
    const height = rect.height;
    const barCount = Math.max(1, Math.floor(width / 4));
    
    const effectiveDuration = audioDuration || waveformDuration || 0;
    const clampedTime = Math.min(currentTime, effectiveDuration);
    const progress = effectiveDuration > 0 ? (clampedTime / effectiveDuration) * 100 : 0;
    const progressX = (Math.min(progress, 100) / 100) * width;
    
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      
      if (waveformData && waveformData.length > 0) {
        const samplesPerBar = Math.max(1, Math.floor(waveformData.length / barCount));
        
        for (let i = 0; i < barCount; i++) {
          const x = i * (width / barCount);
          const isPlayed = x < progressX;
          // ... draw bar
          ctx.fillRect(x, (height - barHeight) / 2, Math.max(1, width / barCount - 1), barHeight);
        }
      }
    };
    
    draw();
  }, [currentTime, waveformDuration, audioDuration, color, isPlaying, stemType, waveformData]);

  return (
    <div className="w-full h-full rounded flex items-center justify-center" style={{ minHeight: '72px', height: '72px' }}>
      <canvas ref={canvasRef} className="w-full h-full rounded" style={{ display: 'block', minHeight: '72px', height: '72px' }} />
    </div>
  );
}
```

## Things That Have Been Tried

1. **Fixed timeline ruler markers**: Changed from `Math.ceil()` to `Math.floor()` to not show markers beyond actual duration

2. **Fixed timeline ruler alignment**: Changed from flexbox `justify-between` to percentage-based positioning using `left: ${(time/totalDuration)*100}%`

3. **Added audioDuration to dependency array**: The Waveform's useEffect now re-runs when `audioDuration` changes

4. **Consolidated duration sources**: Had multiple duration variables (`totalDuration`, `durationRef`, `waveformDuration`, `audioDuration`) - tried to use single source

5. **Added debug logging**: Console.log statements to verify rect.width, barCount, effectiveDuration values

## Waveform Area Container Structure

```jsx
<div className="flex border-b dark:border-gray-700 last:border-b-0 min-h-[72px]">
  {/* Stem controls */}
  <div className="w-48 flex-shrink-0 p-2 bg-white dark:bg-gray-800 border-r dark:border-gray-700">
    {/* Controls like volume, pan, mute, solo */}
  </div>
  
  {/* Waveform area */}
  <div className="flex-1 relative min-h-[72px] cursor-pointer">
    <Waveform 
      assetId={stem.assetId}
      color={...}
      currentTime={currentTime}
      isPlaying={isPlaying && stem.isSelected && !stem.muted}
      stemType={stem.id}
      audioDuration={durationRef.current}
    />
    {/* Playhead */}
    <div 
      className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
      style={{ left: `${totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0}%` }}
    />
  </div>
</div>
```

## What to Check/Investigate

1. **Verify container width**: Is the waveform container div actually taking full width? Check if `flex-1` is working correctly

2. **Check canvas bounding rect**: Add debug to log actual `rect.width` from `canvas.getBoundingClientRect()`

3. **Check waveform data**: Does the API return correct 200 peaks? Does `waveformData.length` match?

4. **Check CSS specificity**: Are there any conflicting styles preventing the waveform from expanding?

5. **Browser DevTools**: Inspect the waveform container in browser DevTools to see its actual rendered width vs expected width

6. **Parent container issues**: Check if any parent element has `overflow: hidden` or other constraints

7. **Minimum width issues**: The waveform container uses `min-h-[72px]` - check if it also needs `min-w`

## Debug Suggestions

Add these console.log statements to the Waveform component:

```tsx
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  const rect = canvas.getBoundingClientRect();
  console.log(`[Waveform] rect.width: ${rect.width}, rect.height: ${rect.height}`);
  console.log(`[Waveform] canvas.width: ${canvas.width}, canvas.height: ${canvas.height}`);
  console.log(`[Waveform] audioDuration: ${audioDuration}, waveformDuration: ${waveformDuration}`);
  console.log(`[Waveform] waveformData length: ${waveformData?.length}`);
  console.log(`[Waveform] barCount: ${Math.max(1, Math.floor(rect.width / 4))}`);
  
  // ... rest of effect
}, [currentTime, waveformDuration, audioDuration, color, isPlaying, stemType, waveformData]);
```

## Expected Behavior

1. Timeline ruler should show markers at 0, 10, 20, 30 seconds
2. Each marker's position should align with corresponding time position on waveform
3. Waveform should fill 100% of the waveform area width
4. Red playhead should move in sync with audio playback
5. Waveform coloring (played vs unplayed) should match playhead position

## Files to Modify

Primary:
- `/home/vipul/src/test-opencode/frontend/src/app/projects/[id]/page.tsx` - Main mixer component

Secondary:
- `/home/vipul/src/test-opencode/backend/app/api/assets.py` - Waveform API (if data issue)
