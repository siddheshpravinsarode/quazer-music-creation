const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const SCALES = {
    'minor_pentatonic': {
        name: 'Minor Pentatonic',
        intervals: [0, 3, 5, 7, 10],
        desc: 'Mellow, bluesy, and instantly sci-fi. Impossible to play a wrong note.'
    },
    'major_pentatonic': {
        name: 'Major Pentatonic',
        intervals: [0, 2, 4, 7, 9],
        desc: 'Bright, uplifting, and harmonious. Great for ambient acoustic textures.'
    },
    'blues': {
        name: 'Blues Scale',
        intervals: [0, 3, 5, 6, 7, 10],
        desc: 'Minor pentatonic with the "blue note" added. Gritty, expressive, and rocky.'
    },
    'dorian': {
        name: 'Dorian Mode',
        intervals: [0, 2, 3, 5, 7, 9, 10],
        desc: 'Mystical, medieval, and space-like. Used heavily in jazz and synth soundtracking.'
    },
    'hirajoshi': {
        name: 'Japanese Hirajoshi',
        intervals: [0, 2, 3, 7, 8],
        desc: 'Traditional Japanese pentatonic. Deeply meditative, dramatic, and exotic.'
    },
    'chromatic': {
        name: 'Chromatic (No Filter)',
        intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        desc: 'All 12 semitones. No rules. Sounds highly chaotic and dissonant when randomized.'
    }
};

class ScaleGatekeeper {
    constructor() {
        this.activeRoot = 'C';
        this.activeScaleKey = 'minor_pentatonic';
        this.minOctave = 3;
        this.maxOctave = 6;
        
        // Cache of active legal notes
        this.legalNotes = [];
        this.updateLegalNotes();
    }

    // Convert MIDI number to Frequency
    midiToFreq(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    // Convert MIDI to Note Name (e.g. 60 -> C4)
    midiToName(midi) {
        const noteIndex = midi % 12;
        const octave = Math.floor(midi / 12) - 1;
        return NOTE_NAMES[noteIndex] + octave;
    }

    // Update list of all allowed notes in range based on root and scale
    updateLegalNotes() {
        const rootIndex = NOTE_NAMES.indexOf(this.activeRoot);
        const scale = SCALES[this.activeScaleKey];
        const notes = [];

        for (let octave = this.minOctave; octave <= this.maxOctave; octave++) {
            const octaveBaseMidi = (octave + 1) * 12 + rootIndex;
            
            scale.intervals.forEach(interval => {
                const midi = octaveBaseMidi + interval;
                if (midi >= 0 && midi <= 127) {
                    notes.push({
                        midi: midi,
                        freq: this.midiToFreq(midi),
                        name: this.midiToName(midi)
                    });
                }
            });
        }
        
        // Sort ascending
        this.legalNotes = notes.sort((a, b) => a.midi - b.midi);
    }

    setRoot(root) {
        if (NOTE_NAMES.includes(root)) {
            this.activeRoot = root;
            this.updateLegalNotes();
        }
    }

    setScale(scaleKey) {
        if (SCALES[scaleKey]) {
            this.activeScaleKey = scaleKey;
            this.updateLegalNotes();
        }
    }

    setOctaveRange(min, max) {
        this.minOctave = parseInt(min);
        this.maxOctave = parseInt(max);
        this.updateLegalNotes();
    }

    // Gatekeeper function: validates candidate note
    // Returns { allowed: bool, note: NoteObject, originalMidi: number, snapped: bool }
    validateAndSnap(candidateMidi) {
        // Clamp candidate midi
        const clampedMidi = Math.max(12, Math.min(115, candidateMidi));
        
        // Check if the candidate is already legal
        const exactMatch = this.legalNotes.find(n => n.midi === clampedMidi);
        if (exactMatch) {
            return {
                allowed: true,
                note: exactMatch,
                originalMidi: clampedMidi,
                snapped: false
            };
        }

        // If not legal, we snap to nearest legal note (The Gatekeeper Matrix in action)
        let nearestNote = this.legalNotes[0];
        let minDiff = Math.abs(clampedMidi - nearestNote.midi);

        for (let i = 1; i < this.legalNotes.length; i++) {
            const diff = Math.abs(clampedMidi - this.legalNotes[i].midi);
            if (diff < minDiff) {
                minDiff = diff;
                nearestNote = this.legalNotes[i];
            }
        }

        return {
            allowed: false,
            note: nearestNote,
            originalMidi: clampedMidi,
            snapped: true
        };
    }

    // Get active scale list for UI
    getScaleInfo() {
        return SCALES[this.activeScaleKey];
    }

    getAllScales() {
        return SCALES;
    }
}

window.ScaleGatekeeper = ScaleGatekeeper;
