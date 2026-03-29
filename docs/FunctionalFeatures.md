# AudioForge - What You Can Do

AudioForge helps you work with music and audio. You can separate songs into parts (like vocals and drums), create simple melodies, and mix everything together.

---

## Organizing Your Work with Projects

Think of a project like a folder for one piece of work - maybe a song you're working on or a podcast you're editing.

### Starting Out
- Create a new project by clicking the button and giving it a name
- Your projects appear as cards that show the name and when you created them
- Click on any project to open it

### Inside a Project
Each project has sections (shown as tabs at the top):
- **Upload** - Add your audio files here
- **Separate** - Split songs into parts using AI
- **Denoise** - Remove background noise from recordings
- **Trim** - Cut specific portions of audio files
- **Mixer** - Adjust volumes, add effects, and mix everything together
- **Jobs** - View background processing tasks

---

## Managing Audio Files

### Uploading Files
- Drag your audio file onto the upload area, or click to browse
- Supported formats: MP3, WAV, FLAC, and similar
- Watch the progress bar while your file uploads
- Once uploaded, your file appears in the asset list

### Working with Assets
All your audio files (original uploads and AI-generated parts) are called "assets."

- **Preview**: Click the play button on any asset to listen
- **Rename**: Click the pencil icon to give it a better name
- **Delete**: Click the trash icon to remove (with confirmation)
- **Select multiple**: Check the boxes to select several files at once
- **Filter**: Show only uploads, only AI results, or everything
- **Sort**: Arrange by newest first, oldest first, name, or length
- **Search**: Find files by typing their name
- **Detect BPM**: Click the music note icon to detect the tempo (beats per minute) of any audio file
- **Detect Key**: Click the music icon to detect the musical key of any audio file

---

## Separating Music into Parts

The AI can take a complete song and split it into individual tracks.

### How It Works
1. Go to the **Separate** tab
2. Choose which uploaded file to process
3. Pick a separation style:
   - **4 Stems** - Gets you vocals, drums, bass, and other instruments separately
   - **Vocals** - Just extracts the singing voice and everything else

### Picking Quality Settings
- **HT Demucs** - Good balance of speed and quality for most songs
- **HT Demucs FT** - Slower but better quality detail
- **MDX** - Different approach that works well for certain music styles
- **MDX Extra** - Maximum detail, takes longer

### After Separation
- Wait while the AI processes (shows progress)
- When done, stems appear in your asset list
- Switch to the **Mixer** tab to start working with them

---

## Mixing Your Audio

The mixer lets you combine and adjust multiple audio tracks.

### Playing Audio
- Big play button starts/stops playback
- Time display shows where you are in the song (current / total)
- All selected tracks play together

### Controlling Individual Tracks
Each track (stem) has its own controls:

| Control | What It Does |
|---------|--------------|
| Checkbox | Select/deselect track for playback |
| Mute (speaker icon) | Silence this track |
| Solo (headphones icon) | Only play this track (mutes others) |
| V (Volume) | Adjust loudness of this track |
| P (Pan) | Move sound left or right in speakers |

### Level Meters
The colored bars show how loud each track is playing:
- Green = normal level
- Amber = getting loud
- Red = very loud (might be clipping)
- Master meter shows both **peak** and **RMS** levels for precise monitoring
- **Phase meter** shows stereo correlation (-100 to +100) to detect phase issues
- **Master Volume** - Overall loudness of everything
- **Reset Mix** - Put all settings back to defaults
- **Unmute All** - Turn all tracks back on
- **Clear Solo** - Stop soloing any track
- **Export** - Download the selected stem as a WAV file

### The Timeline
- Shows a visual representation of the audio (waveform)
- Red line is the playhead - where you are in the song
- Click anywhere on the waveform to jump to that position
- Time markers (0:10, 0:20, etc.) help you navigate

---

## Creating Simple Melodies

The **Composer** feature lets you make short audio clips using synthesized sounds.

### Getting Started
Click "New Asset" in a project to open the composer.

### Choose Your Sound
Pick an instrument:
- **Piano** - Classic bell-like tones
- **Lead Synth** - Electronic melody sound
- **Bass** - Low, punchy notes
- **Pad** - Soft, sustained textures

### Building a Melody
1. **Use the keyboard** - Click keys to add notes to your melody
2. **Choose a scale** - Makes sure notes sound good together
   - Major = bright and happy
   - Minor = darker, moodier
   - Minor Pentatonic = great for solos
   - Dorian = minor with a lifted note for groove
3. **Pick a root note** - Sets the key (C, D, E, etc.)

### Helpful Features
- **Presets** - Quick starting patterns like arpeggios or bass lines
- **Octave buttons** - Move all notes up or down an octave
- **Rest button** - Add silence between notes
- **Type manually** - Enter notes as text like "C4 E4 G4"

### Tempo and Timing
- **Tempo** - How fast to play (60-220 beats per minute)
- **Step Length** - How long each note lasts (eighth, quarter, half)

### Preview and Save
- Click **Preview** to hear your creation
- When it sounds right, click **Save** to add it to your project
- Give it a name and it appears in your asset list

---

## Admin Tools

The **Jobs** page (Admin > Jobs) shows all background tasks:

- See what separation jobs are running
- Check status: pending, running, completed, or failed
- Stop a job if it's taking too long
- See error messages for failed jobs

---

## Converting Audio Formats

Sometimes you need to change the format of your audio file - maybe you need MP3 for a website, or WAV for studio work.

### How to Convert
- Click the **Convert** tab in your project
- Select the audio file you want to convert
- Choose the output format (WAV, MP3, FLAC, AAC, OGG, M4A)
- For MP3/AAC/OGG, you can also choose the quality (bitrate)
- Pick your sample rate (44.1kHz or 48kHz) and channels (mono or stereo)
- Click "Convert to [format]" and wait for processing

### Format Options
| Format | Best For | Lossy? |
|--------|----------|---------|
| WAV | Studio work, maximum quality | No |
| MP3 | Web, small file size | Yes |
| FLAC | Archival, high quality | No |
| AAC | Modern devices | Yes |
| OGG | Open source projects | Yes |
| M4A | Apple devices | Yes |

### What Happens
- Your original file stays safe
- A new converted file is created
- The new file appears in your asset list

---

## Trimming Audio

Need to cut out just a portion of an audio file? The Trim feature lets you select a specific time range.

### How to Trim
- Click the **Trim** tab in your project
- Select the audio file you want to trim
- Enter the start time (in seconds)
- Enter the end time (in seconds)
- Optionally, give your trimmed file a name
- Click "Trim Audio" and wait for processing

### Quick Select Buttons
- **First 30s** - Quickly set the range to the first 30 seconds
- **Full Length** - Set the range to the entire file

### What Happens
- Your original file stays safe
- A new trimmed file is created with the selected portion
- The new file appears in your asset list
- The job is tracked in the Jobs tab

---

## Validating Audio Files

The system can validate your audio files to ensure they meet quality standards and are suitable for processing.

### How to Validate
- Click the **shield icon** on any asset in your list
- The system will inspect the file and display validation results

### What Gets Validated
- **Format** - Must be a supported format (WAV, MP3, FLAC, AAC, OGG, M4A)
- **Sample Rate** - Must be 44100Hz or 48000Hz
- **Channels** - Must be mono or stereo (multichannel configurable)
- **Duration** - Must not exceed the maximum allowed length
- **Codec** - Audio codec information is extracted

### Validation Results
- Valid files show a success message with detected properties
- Invalid files show specific error messages explaining what needs fixing
- Validation metadata is stored with the asset for future reference

---

## Tips and Tricks

### Best Practices
- Use MP3 for quick uploads, WAV for highest quality
- Start with 4-stem separation for full mixes
- Use "Vocals" mode for karaoke-style projects
- In the mixer, enable solo on one track at a time to hear each part clearly

### Navigating
- Click on the timeline to jump to any position
- Use the checkbox to quickly include/exclude tracks from playback

---

## What's Coming Next

We plan to add:

### Audio Cleanup & Enhancement
- **Noise Reduction** - Remove background hum, hissing, fan noise, and other unwanted sounds from recordings
- **De-clipping** - Fix audio that was recorded too loud and sounds distorted
- **De-reverb** - Reduce echo or reverb from recordings made in large rooms
- **Audio Repair** - Clean up old recordings, podcasts, or voice memos

### Pitch & Tempo Tools
- **Pitch Shifting** - Change the key of a recording without changing its speed
- **Time Stretching** - Change the tempo/speed without affecting the pitch
- **Key Detection** - Automatically identify what musical key a song is in

### Voice Processing
- **Voice Conversion** - Change a voice's character (make it sound deeper, robotic, etc.)
- **Vocal Harmonizer** - Automatically create harmonies from a single voice recording
- **Vocal Doubler** - Add a thick chorus effect to vocals
- **Auto-Tune / Pitch Correction** - Fix slightly off-key singing automatically
- **Voice Enhancement** - Make voice recordings clearer and more professional

### Effects & Creative Tools
- **Reverb** - Add space and atmosphere (cathedral, room, hall, etc.)
- **Delay / Echo** - Add repeating echoes for depth
- **Chorus & Flanger** - Add richness and movement to sounds
- **EQ (Equalizer)** - Adjust bass, mids, and treble frequencies
- **Compressor** - Control dynamic range and add punch
- **Lo-fi / Bitcrusher** - Add vintage, distorted character

### Analysis & Metering
- **Spectral Analyzer** - Visual representation of frequencies
- **Loudness Meter (LUFS)** - Measure loudness the way streaming services do
- **Phase Meter** ✅ - Check stereo compatibility (built into mixer)
- **Peak/RMS Meters** ✅ - Professional level monitoring (built into mixer)

### Stem & Remix Tools
- **Stem Generation** - Create missing instruments (drums, bass) for acapellas
- **Stem Swap** - Replace one instrument with another from a different song
- **Stem Match** - Match the style/character of different stems

### Automation & AI
- **AI Auto-Mix** - Get suggested volume levels and panning for your mix
- **AI Mastering** - One-click professional-sounding final output
- **Stem Enhancement** - Improve quality of separated stems
- **Audio to MIDI** - Convert audio recordings to editable notes

### Export & Sharing
- **Multiple Export Formats** - MP3, WAV, FLAC, AAC
- **Stem Export** ✅ - Download individual assets (built into mixer)
- **Mixdown** ✅ - Export selected stem as WAV
- **Video Export** - Export audio with video synchronization

### Spatial Audio
- **Binaural / 3D Audio** - Immersive headphone experience
- **Surround Sound** - 5.1 and 7.1 output for film/game audio

### Collaboration
- **Project Sharing** - Share projects with others
- **Comments & Markers** - Add notes at specific timestamps
- **Version History** - Go back to previous versions of a mix
