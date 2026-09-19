class LSystemEngine {
    constructor() {
        this.axiom = 'A';
        this.rules = {
            'A': 'B+A',
            'B': 'C-[B]'
        };
        this.iterations = 3;
        this.expandedString = 'A';
        
        // Playback state
        this.currentIndex = 0;
        this.isPlaying = false;
        this.timeoutId = null;
        this.tempoBPM = 130;
        this.currentTempoFactor = 1.0;
        this.baseOctave = 4;
        this.currentOctaveShift = 0;
        this.octaveStack = [];
        
        // Define action mappings
        // Maps characters to MIDI offsets relative to a root note (e.g. C)
        // Or triggers specific chords/notes
        this.mappings = {
            'A': { type: 'chord', notes: [0, 4, 7], desc: 'Major Triad (Root)' },   // Root major
            'B': { type: 'chord', notes: [5, 9, 12], desc: 'Subdominant Chord' }, // IV chord
            'C': { type: 'chord', notes: [7, 11, 14], desc: 'Dominant Chord' },   // V chord
            'D': { type: 'chord', notes: [9, 12, 16], desc: 'Minor Triad' },      // vi chord
            'F': { type: 'note', midiOffset: 0, desc: 'Play Root Note' },
            'G': { type: 'note', midiOffset: 7, desc: 'Play Fifth Note' },
            '+': { type: 'tempo', factor: 0.65, desc: 'Speed Up Tempo' },         // Multiply note duration (smaller duration = faster)
            '-': { type: 'tempo', factor: 1.5, desc: 'Slow Down Tempo' },          // Divide note duration (larger duration = slower)
            '[': { type: 'push', desc: 'Push Octave Up' },
            ']': { type: 'pop', desc: 'Pop Octave Back' }
        };

        this.expand();
    }

    expand() {
        let current = this.axiom;
        const maxStringLength = 1500; // Safety cap to prevent browser hang
        
        for (let i = 0; i < this.iterations; i++) {
            let next = '';
            for (let char of current) {
                if (this.rules[char]) {
                    next += this.rules[char];
                } else {
                    next += char;
                }
            }
            current = next;
            
            if (current.length > maxStringLength) {
                current = current.substring(0, maxStringLength);
                console.warn('L-System string execution hit safety length limit.');
                break;
            }
        }
        
        this.expandedString = current;
        this.currentIndex = 0;
        return this.expandedString;
    }

    setParams(axiom, rules, iterations) {
        this.axiom = axiom.toUpperCase().replace(/\s/g, '');
        
        // Clean rules keys and values
        const cleanRules = {};
        for (let key in rules) {
            if (key.trim()) {
                cleanRules[key.trim().toUpperCase()] = rules[key].toUpperCase().replace(/\s/g, '');
            }
        }
        this.rules = cleanRules;
        this.iterations = Math.min(5, Math.max(0, parseInt(iterations) || 0));
        this.expand();
    }

    startPlayback(audioEngine, gatekeeper, onStepCallback, onFinishCallback) {
        this.stopPlayback();
        this.isPlaying = true;
        this.currentIndex = 0;
        this.currentTempoFactor = 1.0;
        this.currentOctaveShift = 0;
        this.octaveStack = [];
        
        const rootMidi = this.getRootMidi(gatekeeper.activeRoot);

        const playNextStep = () => {
            if (!this.isPlaying) return;
            
            if (this.currentIndex >= this.expandedString.length) {
                this.isPlaying = false;
                if (onFinishCallback) onFinishCallback();
                return;
            }

            const char = this.expandedString[this.currentIndex];
            const action = this.mappings[char];
            
            // Default step duration in seconds
            let stepDuration = (60 / this.tempoBPM) * this.currentTempoFactor;
            let noteTriggered = false;

            if (action) {
                const currentRoot = rootMidi + (this.currentOctaveShift * 12);
                
                switch (action.type) {
                    case 'chord':
                        // Map relative intervals to MIDI notes
                        const chordMidis = action.notes.map(interval => {
                            const candidate = currentRoot + interval;
                            // Snap notes through the gatekeeper for absolute scale safety
                            const snapped = gatekeeper.validateAndSnap(candidate);
                            return snapped.note.freq;
                        });
                        audioEngine.triggerChord(chordMidis, stepDuration * 0.95);
                        noteTriggered = true;
                        break;
                        
                    case 'note':
                        const noteMidi = currentRoot + action.midiOffset;
                        const snapped = gatekeeper.validateAndSnap(noteMidi);
                        audioEngine.triggerTone(snapped.note.freq, stepDuration * 0.95);
                        noteTriggered = true;
                        break;
                        
                    case 'tempo':
                        // Smoothly multiply tempo factor
                        this.currentTempoFactor = Math.max(0.2, Math.min(4.0, this.currentTempoFactor * action.factor));
                        // Re-calculate step duration for this spacer step
                        stepDuration = (60 / this.tempoBPM) * this.currentTempoFactor;
                        break;
                        
                    case 'push':
                        // Save current octave shift and shift up
                        this.octaveStack.push(this.currentOctaveShift);
                        this.currentOctaveShift = Math.min(2, this.currentOctaveShift + 1);
                        break;
                        
                    case 'pop':
                        // Restore previous octave shift
                        if (this.octaveStack.length > 0) {
                            this.currentOctaveShift = this.octaveStack.pop();
                        } else {
                            this.currentOctaveShift = Math.max(-1, this.currentOctaveShift - 1);
                        }
                        break;
                }
            }

            // Call UI update callback
            if (onStepCallback) {
                onStepCallback(this.currentIndex, char, action ? action.desc : 'No operation', noteTriggered);
            }

            this.currentIndex++;
            
            // Schedule next step
            this.timeoutId = setTimeout(playNextStep, stepDuration * 1000);
        };

        playNextStep();
    }

    stopPlayback() {
        this.isPlaying = false;
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }

    getRootMidi(rootName) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const rootIndex = notes.indexOf(rootName);
        return (this.baseOctave + 1) * 12 + rootIndex; // C4 is MIDI 60
    }
}

window.LSystemEngine = LSystemEngine;
