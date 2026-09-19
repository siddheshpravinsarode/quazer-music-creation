class AudioEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.delayNode = null;
        this.feedbackGain = null;
        this.filterNode = null;
        this.analyser = null;
        
        // Synth Settings
        this.synthType = 'triangle'; // triangle sounds naturally warmer/softer than sine/saw
        this.attack = 0.08;
        this.decay = 0.15;
        this.sustain = 0.5;
        this.release = 0.6;
        
        // Effects Settings
        this.delayTimeValue = 0.35;
        this.delayFeedbackValue = 0.4;
        this.filterCutoffValue = 2000;
        this.volumeValue = 0.4;
        
        // Active oscillators tracking (for polyphony)
        this.activeSources = [];
    }

    init() {
        if (this.ctx) return; // Already initialized

        // Create audio context (handle webkit prefix)
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContextClass();

        // 1. Master Gain Node
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.volumeValue, this.ctx.currentTime);

        // 2. Analyser Node (for visualization)
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 256;

        // 3. Filter Node (lowpass)
        this.filterNode = this.ctx.createBiquadFilter();
        this.filterNode.type = 'lowpass';
        this.filterNode.frequency.setValueAtTime(this.filterCutoffValue, this.ctx.currentTime);
        this.filterNode.Q.setValueAtTime(1.5, this.ctx.currentTime);

        // 4. Delay Nodes (Delay + Feedback Loop)
        this.delayNode = this.ctx.createDelay(1.0);
        this.delayNode.delayTime.setValueAtTime(this.delayTimeValue, this.ctx.currentTime);
        
        this.feedbackGain = this.ctx.createGain();
        this.feedbackGain.gain.setValueAtTime(this.delayFeedbackValue, this.ctx.currentTime);

        // Wire up the signal chain:
        // Synth Note -> Filter -> Master Gain -> Analyser -> Output
        //               Filter -> Delay -> Feedback -> Delay (loop)
        //                         Delay -> Master Gain
        this.filterNode.connect(this.masterGain);
        this.filterNode.connect(this.delayNode);
        
        this.delayNode.connect(this.feedbackGain);
        this.feedbackGain.connect(this.delayNode); // feedback loop
        this.delayNode.connect(this.masterGain);

        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    triggerTone(freq, duration = 0.5) {
        if (!this.ctx) this.init();
        this.resume();

        const now = this.ctx.currentTime;
        
        // Create Oscillator
        const osc = this.ctx.createOscillator();
        osc.type = this.synthType;
        osc.frequency.setValueAtTime(freq, now);

        // Create local gain node for ADSR envelope
        const noteGain = this.ctx.createGain();
        noteGain.gain.setValueAtTime(0, now);

        // Connect oscillator to note envelope, then to the main filter
        osc.connect(noteGain);
        noteGain.connect(this.filterNode);

        // Apply ADSR Envelope
        const attackTime = now + this.attack;
        const decayTime = attackTime + this.decay;
        const releaseTime = now + duration;
        const endTime = releaseTime + this.release;

        // Attack: slide volume from 0 up to 1
        noteGain.gain.linearRampToValueAtTime(0.8, attackTime);
        // Decay & Sustain: slide down to sustain level
        noteGain.gain.exponentialRampToValueAtTime(this.sustain * 0.8, decayTime);
        
        // Keep at sustain level until release
        noteGain.gain.setValueAtTime(this.sustain * 0.8, releaseTime);
        // Release: fade out completely
        noteGain.gain.exponentialRampToValueAtTime(0.0001, endTime);

        // Start and stop oscillator
        osc.start(now);
        osc.stop(endTime);

        // Keep track of source to allow stopping if necessary
        const sourceObj = { osc, noteGain, endTime };
        this.activeSources.push(sourceObj);
        
        // Cleanup reference after note ends
        setTimeout(() => {
            const index = this.activeSources.indexOf(sourceObj);
            if (index > -1) this.activeSources.splice(index, 1);
        }, (duration + this.release) * 1000 + 100);
    }

    triggerChord(freqs, duration = 0.8) {
        freqs.forEach(freq => this.triggerTone(freq, duration));
    }

    stopAll() {
        const now = this.ctx ? this.ctx.currentTime : 0;
        this.activeSources.forEach(src => {
            try {
                src.noteGain.gain.cancelScheduledValues(now);
                src.noteGain.gain.setValueAtTime(src.noteGain.gain.value, now);
                src.noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
                src.osc.stop(now + 0.12);
            } catch (e) {
                // Already stopped
            }
        });
        this.activeSources = [];
    }

    // Setters for live parameters
    setVolume(value) {
        this.volumeValue = parseFloat(value);
        if (this.masterGain && this.ctx) {
            this.masterGain.gain.linearRampToValueAtTime(this.volumeValue, this.ctx.currentTime + 0.05);
        }
    }

    setSynthType(type) {
        this.synthType = type;
    }

    setADSR(attack, decay, sustain, release) {
        this.attack = parseFloat(attack);
        this.decay = parseFloat(decay);
        this.sustain = parseFloat(sustain);
        this.release = parseFloat(release);
    }

    setDelayTime(value) {
        this.delayTimeValue = parseFloat(value);
        if (this.delayNode && this.ctx) {
            this.delayNode.delayTime.setValueAtTime(this.delayTimeValue, this.ctx.currentTime + 0.05);
        }
    }

    setDelayFeedback(value) {
        this.delayFeedbackValue = parseFloat(value);
        if (this.feedbackGain && this.ctx) {
            this.feedbackGain.gain.setValueAtTime(this.delayFeedbackValue, this.ctx.currentTime + 0.05);
        }
    }

    setFilterCutoff(value) {
        this.filterCutoffValue = parseFloat(value);
        if (this.filterNode && this.ctx) {
            this.filterNode.frequency.setValueAtTime(this.filterCutoffValue, this.ctx.currentTime + 0.05);
        }
    }
}

// Export for inclusion in global context
window.AudioEngine = AudioEngine;
