document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize core engines
    const audio = new AudioEngine();
    const gatekeeper = new ScaleGatekeeper();
    const markov = new MarkovChain();
    const lsystem = new LSystemEngine();
    const visualizer = new Visualizer();
    const rl = new RLAgent();

    // Timer refs
    let gatekeeperWalkInterval = null;
    let markovPlayInterval = null;
    let customMelodyInterval = null;
    let rlPlayInterval = null;
    let customMelodyIsPlaying = false;
    let customMelodyCurrentIndex = 0;
    let customMelodyNotes = [];

    // Cache DOM Elements
    const btnAudioInit = document.getElementById('btn-audio-init');
    const audioStatusLed = document.getElementById('audio-status-led');
    const masterVolume = document.getElementById('master-volume');
    const btnStopAll = document.getElementById('btn-stop-all');
    
    // Synth controls
    const selectSynthType = document.getElementById('synth-type');
    const sliderFilterCutoff = document.getElementById('filter-cutoff');
    const sliderAdsrA = document.getElementById('adsr-a');
    const sliderAdsrR = document.getElementById('adsr-r');

    // Scale Gatekeeper DOM
    const selectScale = document.getElementById('gatekeeper-scale-select');
    const selectRoot = document.getElementById('gatekeeper-root-select');
    const inputOctaveMin = document.getElementById('gatekeeper-octave-min');
    const inputOctaveMax = document.getElementById('gatekeeper-octave-max');
    const toggleWalk = document.getElementById('gatekeeper-walk-toggle');
    const btnGKTrigger = document.getElementById('btn-gatekeeper-trigger');
    const pianoGrid = document.getElementById('gatekeeper-piano-grid');
    const gkStatFreq = document.getElementById('gk-stat-freq');
    const gkStatStatus = document.getElementById('gk-stat-status');

    // Markov DOM
    const svgMarkov = document.getElementById('markov-svg-graph');
    const btnMarkovPresetAmbient = document.getElementById('btn-markov-preset-ambient');
    const btnMarkovPresetChaotic = document.getElementById('btn-markov-preset-chaotic');
    const tableBodyMatrix = document.getElementById('matrix-body');
    const tableHeaderRowMatrix = document.getElementById('matrix-header-row');
    const toggleMarkovPlay = document.getElementById('markov-play-toggle');
    const btnMarkovStep = document.getElementById('btn-markov-step');

    // L-System DOM
    const inputLSystemAxiom = document.getElementById('lsystem-axiom');
    const sliderLSystemIter = document.getElementById('lsystem-iterations');
    const inputLSystemRuleA = document.getElementById('lsystem-rule-a');
    const inputLSystemRuleB = document.getElementById('lsystem-rule-b');
    const displayLSystemDNA = document.getElementById('lsystem-output-string');
    const displayLSystemCursor = document.getElementById('lsystem-cursor-pos');
    const displayLSystemLen = document.getElementById('lsystem-total-len');
    const timelineTape = document.getElementById('lsystem-timeline-tape');
    const btnLSystemGenerate = document.getElementById('btn-lsystem-generate');
    const btnLSystemPlay = document.getElementById('btn-lsystem-play');

    // Custom Melody DOM
    const melodyInputRaw = document.getElementById('melody-input-raw');
    const btnMelodyTrain = document.getElementById('btn-melody-train');
    const btnMelodyPlay = document.getElementById('btn-melody-play');
    const melodyStatUnique = document.getElementById('melody-stat-unique');
    const melodyStatTotal = document.getElementById('melody-stat-total');
    const melodyStatStatus = document.getElementById('melody-stat-status');

    // Console DOM
    const consoleLogArea = document.getElementById('console-log-area');
    const btnClearConsole = document.getElementById('btn-clear-console');

    // ----------------------------------------------------
    // System Console Logging Logger
    // ----------------------------------------------------
    function log(tag, message, type = 'normal') {
        const timeStr = new Date().toTimeString().split(' ')[0];
        
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        
        const spanTime = document.createElement('span');
        spanTime.className = 'log-time';
        spanTime.textContent = `[${timeStr}]`;
        
        const spanTag = document.createElement('span');
        spanTag.className = `log-tag ${tag.toLowerCase().replace(/\s/g, '')}`;
        spanTag.textContent = tag.toUpperCase();
        
        const spanMsg = document.createElement('span');
        spanMsg.className = `log-msg ${type}`;
        spanMsg.textContent = message;
        
        entry.appendChild(spanTime);
        entry.appendChild(spanTag);
        entry.appendChild(spanMsg);
        
        consoleLogArea.appendChild(entry);
        
        // Auto scroll to bottom
        consoleLogArea.scrollTop = consoleLogArea.scrollHeight;
        
        // Cap lines at 120
        while (consoleLogArea.childElementCount > 120) {
            consoleLogArea.removeChild(consoleLogArea.firstChild);
        }
    }

    log('system', 'Lab environment parsed. Click [Initialize Audio] to boot synth engine.', 'warning');

    // ----------------------------------------------------
    // GUIDE MODAL
    // ----------------------------------------------------
    const guideOverlay   = document.getElementById('guide-modal-overlay');
    const btnCloseGuide  = document.getElementById('btn-close-guide');
    const btnStartGuide  = document.getElementById('btn-start-guide');
    const btnOpenGuide   = document.getElementById('btn-open-guide');

    const openGuide  = () => guideOverlay.classList.remove('hidden');
    const closeGuide = () => {
        guideOverlay.classList.add('hidden');
        log('system', 'Quick-start guide dismissed. Click [? GUIDE] in the header at any time to reopen it.');
    };

    // Auto-open on first load
    openGuide();

    btnCloseGuide.addEventListener('click', closeGuide);
    btnStartGuide.addEventListener('click', closeGuide);
    btnOpenGuide.addEventListener('click', openGuide);

    // Click overlay background to close
    guideOverlay.addEventListener('click', (e) => {
        if (e.target === guideOverlay) closeGuide();
    });

    // ----------------------------------------------------
    // Audio Context Setup
    // ----------------------------------------------------
    btnAudioInit.addEventListener('click', () => {
        try {
            audio.init();
            audioStatusLed.classList.add('active');
            btnAudioInit.textContent = "SYSTEM ACTIVE";
            btnAudioInit.disabled = true;
            btnAudioInit.style.opacity = '0.7';
            
            // Link visualizer canvas
            const canvasEl = document.getElementById('oscilloscope-canvas');
            visualizer.initCanvas(canvasEl, audio.analyser);

            // Link recorder to the live audio engine so it can tap the stream
            if (window.QuasarRecorder) {
                window.QuasarRecorder.init(audio);
            }
            
            log('system', 'Web Audio API Synth context activated. Oscilloscope visualization loop started.', 'highlight');
            log('system', 'Recorder ready — use the RECORD & EXPORT panel (step 05) to capture audio.', 'highlight');
            
            // Render graphics
            renderPianoRoll();
            syncMarkovMatrixUI();
            updateLSystemUI();
        } catch (err) {
            log('system', `Boot failed: ${err.message}`, 'warning');
        }
    });

    // ----------------------------------------------------
    // LCD Display Handlers (Non-Decimal UI conversion)
    // ----------------------------------------------------
    const volumeValDisplay = document.getElementById('volume-val-display');
    const cutoffValDisplay = document.getElementById('cutoff-val-display');
    const adsrAValDisplay = document.getElementById('adsr-a-val-display');
    const adsrRValDisplay = document.getElementById('adsr-r-val-display');
    const iterationsValDisplay = document.getElementById('lsystem-iterations-val-display');

    const updateVolumeDisplay = (val) => {
        const floatVal = parseFloat(val);
        if (floatVal === 0) {
            volumeValDisplay.textContent = "-inf dB";
        } else {
            const db = 20 * Math.log10(floatVal / 0.8);
            volumeValDisplay.textContent = db.toFixed(1) + " dB";
        }
    };

    const updateCutoffDisplay = (val) => {
        const num = parseFloat(val);
        if (num >= 1000) {
            cutoffValDisplay.textContent = (num / 1000).toFixed(2) + " kHz";
        } else {
            cutoffValDisplay.textContent = Math.round(num) + " Hz";
        }
    };

    const updateADSRDisplays = () => {
        adsrAValDisplay.textContent = Math.round(parseFloat(sliderAdsrA.value) * 1000) + " ms";
        
        const rVal = parseFloat(sliderAdsrR.value);
        if (rVal >= 1.0) {
            adsrRValDisplay.textContent = rVal.toFixed(2) + " s";
        } else {
            adsrRValDisplay.textContent = Math.round(rVal * 1000) + " ms";
        }
    };

    const updateIterationsDisplay = (val) => {
        const numerals = ['', 'GEN I', 'GEN II', 'GEN III', 'GEN IV', 'GEN V'];
        iterationsValDisplay.textContent = numerals[parseInt(val)] || `GEN ${val}`;
    };

    // Initialize LCD reads
    updateVolumeDisplay(masterVolume.value);
    updateCutoffDisplay(sliderFilterCutoff.value);
    updateADSRDisplays();
    updateIterationsDisplay(sliderLSystemIter.value);

    // ----------------------------------------------------
    // Main Control Handlers
    // ----------------------------------------------------
    btnStopAll.addEventListener('click', () => {
        // Stop audio
        audio.stopAll();
        
        // Stop loops
        if (gatekeeperWalkInterval) {
            clearInterval(gatekeeperWalkInterval);
            gatekeeperWalkInterval = null;
        }
        toggleWalk.checked = false;
        
        if (markovPlayInterval) {
            clearInterval(markovPlayInterval);
            markovPlayInterval = null;
        }
        toggleMarkovPlay.checked = false;
        
        stopRLPlayback();
        
        // Stop custom melody
        stopCustomMelodyPlayback();
        
        lsystem.stopPlayback();
        resetLSystemPlaybackUI();

        gkStatStatus.textContent = 'Idle';
        log('system', 'Emergency cut: halted all active playback streams and cleared audio stacks.');
    });

    masterVolume.addEventListener('input', (e) => {
        audio.setVolume(e.target.value);
        updateVolumeDisplay(e.target.value);
    });

    selectSynthType.addEventListener('change', (e) => {
        audio.setSynthType(e.target.value);
        log('system', `Synth voice set to [${e.target.value.toUpperCase()}] oscillator waveform.`);
    });

    sliderFilterCutoff.addEventListener('input', (e) => {
        audio.setFilterCutoff(e.target.value);
        updateCutoffDisplay(e.target.value);
    });

    const updateADSR = () => {
        audio.setADSR(sliderAdsrA.value, 0.15, 0.5, sliderAdsrR.value);
        updateADSRDisplays();
    };
    sliderAdsrA.addEventListener('input', updateADSR);
    sliderAdsrR.addEventListener('input', updateADSR);

    // ----------------------------------------------------
    // 1. SCALE GATEKEEPER ENGINE
    // ----------------------------------------------------
    
    // Load Scale Dropdown Options
    const allScales = gatekeeper.getAllScales();
    for (let key in allScales) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = allScales[key].name;
        selectScale.appendChild(opt);
    }

    function renderPianoRoll() {
        pianoGrid.innerHTML = '';
        
        // Render 24 semitones starting from Middle C (MIDI 60) up to C6 (MIDI 84)
        const startMidi = 60;
        const endMidi = 84;
        
        for (let m = startMidi; m <= endMidi; m++) {
            const keyBtn = document.createElement('div');
            keyBtn.className = 'piano-key';
            keyBtn.dataset.midi = m;
            
            const name = gatekeeper.midiToName(m);
            const isLegal = gatekeeper.legalNotes.some(n => n.midi === m);
            
            if (isLegal) {
                keyBtn.classList.add('legal');
            }
            
            // Show label
            keyBtn.innerHTML = `<span>${name}</span>`;
            
            keyBtn.addEventListener('click', () => {
                triggerGatekeeperValidation(m);
            });
            
            pianoGrid.appendChild(keyBtn);
        }
        if (typeof rl !== 'undefined') {
            rl.initQTable(gatekeeper.legalNotes.length);
            drawRLQTable();
        }
    }

    function triggerGatekeeperValidation(midi) {
        // Run verification/snapping
        const result = gatekeeper.validateAndSnap(midi);
        
        // Flash targeted piano key visually
        flashPianoKey(result.note.midi);
        
        // Play
        audio.triggerTone(result.note.freq, 0.35);
        visualizer.spawnParticle(result.note.midi, result.note.name);
        
        // Stats
        gkStatFreq.textContent = `${result.note.freq.toFixed(1)} Hz`;
        
        if (result.allowed) {
            gkStatStatus.innerHTML = `<span style="color: var(--color-cyan);">Consonant</span>`;
            log('gatekeeper', `APPROVED Note: ${result.note.name} (MIDI ${midi}) - Pitch matches active scale.`, 'highlight');
        } else {
            gkStatStatus.innerHTML = `<span style="color: var(--color-amber);">Snapped</span>`;
            const originalName = gatekeeper.midiToName(midi);
            log('gatekeeper', `BLOCKED Note: ${originalName} (MIDI ${midi}) is dissonant -> SNAPPED to closest legal Note: ${result.note.name} (MIDI ${result.note.midi})`, 'warning');
        }
    }

    function flashPianoKey(midi) {
        const keyEl = pianoGrid.querySelector(`[data-midi="${midi}"]`);
        if (keyEl) {
            keyEl.classList.add('active-trigger');
            setTimeout(() => keyEl.classList.remove('active-trigger'), 200);
        }
    }

    selectScale.addEventListener('change', (e) => {
        gatekeeper.setScale(e.target.value);
        renderPianoRoll();
        syncMarkovMatrixUI();
        melodyStatStatus.innerHTML = `<span style="color: var(--text-muted)">Untrained</span>`;
        log('gatekeeper', `Scale shifted to [${gatekeeper.getScaleInfo().name}]. Snap-grid updated.`);
    });

    selectRoot.addEventListener('change', (e) => {
        gatekeeper.setRoot(e.target.value);
        renderPianoRoll();
        syncMarkovMatrixUI();
        melodyStatStatus.innerHTML = `<span style="color: var(--text-muted)">Untrained</span>`;
        log('gatekeeper', `Scale root key changed to [${e.target.value}].`);
    });

    const handleOctaveChange = () => {
        const min = parseInt(inputOctaveMin.value) || 3;
        const max = parseInt(inputOctaveMax.value) || 6;
        gatekeeper.setOctaveRange(min, max);
        renderPianoRoll();
        syncMarkovMatrixUI();
        melodyStatStatus.innerHTML = `<span style="color: var(--text-muted)">Untrained</span>`;
        log('gatekeeper', `Frequencies locked to octave boundaries: ${min} to ${max}.`);
    };
    inputOctaveMin.addEventListener('change', handleOctaveChange);
    inputOctaveMax.addEventListener('change', handleOctaveChange);

    btnGKTrigger.addEventListener('click', () => {
        // Pick a completely random note within active range
        const rootMidi = gatekeeper.legalNotes[0] ? gatekeeper.legalNotes[0].midi : 60;
        const range = 24;
        const candidateMidi = rootMidi + Math.floor(Math.random() * range);
        
        triggerGatekeeperValidation(candidateMidi);
    });

    toggleWalk.addEventListener('change', (e) => {
        if (e.target.checked) {
            log('gatekeeper', 'Auto-play Walk started. Generating random candidate notes.');
            stopRLPlayback();
            gatekeeperWalkInterval = setInterval(() => {
                const rootMidi = gatekeeper.legalNotes[0] ? gatekeeper.legalNotes[0].midi : 60;
                const range = 30;
                const candidateMidi = rootMidi + Math.floor(Math.random() * range) - 5;
                triggerGatekeeperValidation(candidateMidi);
            }, 380);
        } else {
            if (gatekeeperWalkInterval) {
                clearInterval(gatekeeperWalkInterval);
                gatekeeperWalkInterval = null;
            }
            log('gatekeeper', 'Auto-play Walk stopped.');
        }
    });

    // ----------------------------------------------------
    // 2. MARKOV CHAIN ENGINE
    // ----------------------------------------------------
    function getMarkovNoteObj(stateIdx) {
        if (markov.customStates && markov.customStates[stateIdx]) {
            return markov.customStates[stateIdx];
        }
        const scaleNotes = gatekeeper.legalNotes;
        if (scaleNotes.length === 0) return { name: `Note ${stateIdx + 1}`, freq: 261.63, midi: 60 };
        // Arrange states to point to the middle octaves of the scale
        const centerIdx = Math.floor(scaleNotes.length / 2) - 2 + stateIdx;
        const clampedIdx = Math.max(0, Math.min(scaleNotes.length - 1, centerIdx));
        return scaleNotes[clampedIdx];
    }

    function syncMarkovMatrixUI() {
        // 1. Re-render SVG Graph
        visualizer.renderMarkovGraph(svgMarkov, markov, gatekeeper, (nodeIdx, midi) => {
            // Callback when clicking an SVG node
            const oldState = markov.currentStateIndex;
            markov.setCurrentState(nodeIdx);
            
            const noteObj = getMarkovNoteObj(nodeIdx);
            audio.triggerTone(noteObj.freq, 0.4);
            visualizer.spawnParticle(noteObj.midi, noteObj.name);
            flashPianoKey(noteObj.midi);
            
            visualizer.animateMarkovTransition(oldState, nodeIdx);
            log('markov', `Manual Jump: State ${oldState + 1} ──> State ${nodeIdx + 1} (Played ${noteObj.name})`);
        });

        // 2. Build Matrix Table Header
        tableHeaderRowMatrix.innerHTML = '<th>From \\ To</th>';
        for (let i = 0; i < markov.statesCount; i++) {
            const th = document.createElement('th');
            const noteObj = getMarkovNoteObj(i);
            th.textContent = `${noteObj.name} (S${i+1})`;
            tableHeaderRowMatrix.appendChild(th);
        }

        // 3. Build Matrix Rows
        tableBodyMatrix.innerHTML = '';
        for (let r = 0; r < markov.statesCount; r++) {
            const tr = document.createElement('tr');
            
            // Label column
            const tdLabel = document.createElement('td');
            const noteObj = getMarkovNoteObj(r);
            tdLabel.className = 'matrix-label';
            tdLabel.textContent = `${noteObj.name} (S${r+1})`;
            tr.appendChild(tdLabel);
            
            // Prob columns
            for (let c = 0; c < markov.statesCount; c++) {
                const tdVal = document.createElement('td');
                const input = document.createElement('input');
                input.type = 'number';
                input.className = 'matrix-input';
                input.min = '0';
                input.max = '100';
                input.value = Math.round(markov.matrix[r][c] * 100).toString();
                
                input.addEventListener('change', (e) => {
                    const parsedVal = Math.max(0, parseFloat(e.target.value) || 0);
                    markov.setProbability(r, c, parsedVal);
                    // Reload table inputs as probabilities normalise dynamically!
                    syncMarkovMatrixUI();
                    log('markov', `Modified Weight: State ${r+1} ──> State ${c+1} set to ${parsedVal}. Normalizing row.`);
                });
                
                tdVal.appendChild(input);
                tr.appendChild(tdVal);
            }
            tableBodyMatrix.appendChild(tr);
        }
    }

    btnMarkovPresetAmbient.addEventListener('click', () => {
        markov.loadPreset('ambient');
        syncMarkovMatrixUI();
        melodyStatStatus.innerHTML = `<span style="color: var(--text-secondary)">Preset Active</span>`;
        log('markov', 'Loaded [Ambient Presets]. Transitions biased toward adjacent scale steps.');
    });

    btnMarkovPresetChaotic.addEventListener('click', () => {
        markov.loadPreset('chaotic');
        syncMarkovMatrixUI();
        melodyStatStatus.innerHTML = `<span style="color: var(--text-secondary)">Preset Active</span>`;
        log('markov', 'Loaded [Chaotic Presets]. Transitions are highly uniform, introducing pitch leaps.');
    });

    function stepMarkovMelody() {
        const fromState = markov.currentStateIndex;
        const toState = markov.getNextState();
        
        const noteObj = getMarkovNoteObj(toState);
        
        // Play audio & graphics
        audio.triggerTone(noteObj.freq, 0.35);
        visualizer.spawnParticle(noteObj.midi, noteObj.name);
        flashPianoKey(noteObj.midi);
        
        // SVG transition trigger
        visualizer.animateMarkovTransition(fromState, toState);
        
        const prob = markov.matrix[fromState][toState];
        log('markov', `State ${fromState + 1} ──> State ${toState + 1} (probability ${Math.round(prob * 100)}%) ──> Play ${noteObj.name}`);
    }

    btnMarkovStep.addEventListener('click', () => {
        stepMarkovMelody();
    });

    toggleMarkovPlay.addEventListener('change', (e) => {
        if (e.target.checked) {
            log('markov', 'Markov melody stream started.');
            stopRLPlayback();
            markovPlayInterval = setInterval(stepMarkovMelody, 380);
        } else {
            if (markovPlayInterval) {
                clearInterval(markovPlayInterval);
                markovPlayInterval = null;
            }
            log('markov', 'Markov melody stream stopped.');
        }
    });

    // ----------------------------------------------------
    // 3. L-SYSTEM ENGINE
    // ----------------------------------------------------
    function updateLSystemUI() {
        const expanded = lsystem.expand();
        
        displayLSystemDNA.textContent = expanded;
        displayLSystemLen.textContent = expanded.length.toString();
        displayLSystemCursor.textContent = '0';
        
        // Render timeline capsules
        timelineTape.innerHTML = '';
        for (let i = 0; i < expanded.length; i++) {
            const charSpan = document.createElement('span');
            charSpan.className = 'timeline-char';
            charSpan.dataset.index = i;
            charSpan.textContent = expanded[i];
            timelineTape.appendChild(charSpan);
        }
    }

    btnLSystemGenerate.addEventListener('click', () => {
        const axiom = inputLSystemAxiom.value;
        const iter = sliderLSystemIter.value;
        const rules = {
            'A': inputLSystemRuleA.value,
            'B': inputLSystemRuleB.value
        };
        
        lsystem.setParams(axiom, rules, iter);
        updateLSystemUI();
        
        log('lsystem', `DNA Generated. Axiom: [${axiom}] | Iterations: [${iter}] | Final length: ${lsystem.expandedString.length} chars.`);
    });

    sliderLSystemIter.addEventListener('input', (e) => {
        // Live generate on slider pull
        const axiom = inputLSystemAxiom.value;
        const rules = {
            'A': inputLSystemRuleA.value,
            'B': inputLSystemRuleB.value
        };
        lsystem.setParams(axiom, rules, e.target.value);
        updateLSystemUI();
        updateIterationsDisplay(e.target.value);
    });

    btnLSystemPlay.addEventListener('click', () => {
        if (lsystem.isPlaying) {
            lsystem.stopPlayback();
            resetLSystemPlaybackUI();
            log('lsystem', 'Symphony sequencer playback stopped manually.');
        } else {
            log('lsystem', 'Symphony sequencer started. Executing recursively expanded structural layout...');
            stopRLPlayback();
            btnLSystemPlay.textContent = 'HALT SEQ';
            btnLSystemPlay.style.background = 'linear-gradient(135deg, #ff0055, #bb0033)';
            
            lsystem.startPlayback(
                audio, 
                gatekeeper,
                // Step callback
                (idx, char, desc, noteTriggered) => {
                    displayLSystemCursor.textContent = (idx + 1).toString();
                    
                    // Highlight active capsule
                    const timelineTape = document.getElementById('lsystem-timeline-tape');
                    const chars = timelineTape.querySelectorAll('.timeline-char');
                    
                    chars.forEach(c => c.classList.remove('active', 'triggered'));
                    
                    const activeEl = timelineTape.querySelector(`[data-index="${idx}"]`);
                    if (activeEl) {
                        activeEl.classList.add('active');
                        if (noteTriggered) {
                            activeEl.classList.add('triggered');
                            // Extract class details to spawn particle
                            const rootMidi = lsystem.getRootMidi(gatekeeper.activeRoot) + (lsystem.currentOctaveShift * 12);
                            const action = lsystem.mappings[char];
                            
                            if (action && action.type === 'chord') {
                                action.notes.forEach(offset => {
                                    const snapped = gatekeeper.validateAndSnap(rootMidi + offset);
                                    visualizer.spawnParticle(snapped.note.midi, snapped.note.name);
                                    flashPianoKey(snapped.note.midi);
                                });
                            } else if (action && action.type === 'note') {
                                const snapped = gatekeeper.validateAndSnap(rootMidi + action.midiOffset);
                                visualizer.spawnParticle(snapped.note.midi, snapped.note.name);
                                flashPianoKey(snapped.note.midi);
                            }
                        }
                        
                        // Scroll to center the active item in timeline
                        timelineTape.scrollLeft = activeEl.offsetLeft - (timelineTape.clientWidth / 2) + 11;
                    }
                    
                    log('lsystem', `Step ${idx+1}/${lsystem.expandedString.length} ──> Read: '${char}' ──> ${desc}`);
                },
                // Finish callback
                () => {
                    resetLSystemPlaybackUI();
                    log('lsystem', 'Symphony sequence completed all instruction sets.', 'highlight');
                }
            );
        }
    });

    function resetLSystemPlaybackUI() {
        btnLSystemPlay.textContent = 'PLAY SEQUENCE';
        btnLSystemPlay.style.background = 'linear-gradient(135deg, #a124ff, #7209b7)';
        displayLSystemCursor.textContent = '0';
        
        const chars = timelineTape.querySelectorAll('.timeline-char');
        chars.forEach(c => c.classList.remove('active', 'triggered'));
        timelineTape.scrollLeft = 0;
    }

    // ----------------------------------------------------
    // CONSOLE EVENTS
    // ----------------------------------------------------
    btnClearConsole.addEventListener('click', () => {
        consoleLogArea.innerHTML = '';
        log('system', 'Console clear complete.');
    });

    // ----------------------------------------------------
    // 4. MELODY TRANSCRIPTION LEARNER (Custom Trainer & Sequencer)
    // ----------------------------------------------------
    function parseMelodyString(str) {
        // Support notes C, C#, Db, D, D#, Eb, E, F, F#, Gb, G, G#, Ab, A, A#, Bb, B
        // optionally followed by an octave digit (2-7, defaults to 4)
        const regex = /^([A-G]#?|D[bB]|E[bB]|G[bB]|A[bB]|B[bB])([2-7])?$/i;
        const tokens = str.trim().split(/[\s,\-]+/);
        const parsedNotes = [];
        const noteNameToInterval = {
            'C': 0, 'C#': 1, 'DB': 1, 'D': 2, 'D#': 3, 'EB': 3, 'E': 4, 'F': 5, 'F#': 6, 'GB': 6, 'G': 7, 'G#': 8, 'AB': 8, 'A': 9, 'A#': 10, 'BB': 10, 'B': 11
        };
        
        for (let token of tokens) {
            if (!token) continue;
            const match = token.toUpperCase().match(regex);
            if (match) {
                const noteName = match[1];
                const octave = match[2] ? parseInt(match[2]) : 4;
                const interval = noteNameToInterval[noteName];
                const midi = (octave + 1) * 12 + interval;
                
                parsedNotes.push({
                    midi: midi,
                    freq: 440 * Math.pow(2, (midi - 69) / 12),
                    name: noteName + octave
                });
            }
        }
        return parsedNotes;
    }

    btnMelodyTrain.addEventListener('click', () => {
        const rawText = melodyInputRaw.value;
        const parsed = parseMelodyString(rawText);
        
        if (parsed.length < 2) {
            log('system', 'Melody training failed: Input must contain at least 2 valid notes.', 'warning');
            melodyStatStatus.innerHTML = `<span style="color: var(--color-pink)">Error</span>`;
            return;
        }

        // Find unique midis
        const uniqueMidis = [...new Set(parsed.map(n => n.midi))].sort((a, b) => a - b);
        
        if (uniqueMidis.length > 12) {
            log('system', 'Melody training warning: Too many unique notes. Capping at 12 unique notes.', 'warning');
            uniqueMidis.splice(12);
        }

        // Map midis to note objects
        const customStates = uniqueMidis.map(midi => {
            return {
                midi: midi,
                freq: 440 * Math.pow(2, (midi - 69) / 12),
                name: gatekeeper.midiToName(midi)
            };
        });

        // Initialize transition count matrix
        const size = customStates.length;
        const transitionCounts = Array(size).fill(0).map(() => Array(size).fill(0));

        // Fill transition counts
        for (let i = 0; i < parsed.length - 1; i++) {
            const currentMidi = parsed[i].midi;
            const nextMidi = parsed[i+1].midi;
            
            const currentIdx = uniqueMidis.indexOf(currentMidi);
            const nextIdx = uniqueMidis.indexOf(nextMidi);
            
            if (currentIdx !== -1 && nextIdx !== -1) {
                transitionCounts[currentIdx][nextIdx] += 1;
            }
        }

        // Configure Markov Chain
        markov.statesCount = size;
        markov.customStates = customStates;
        markov.currentStateIndex = 0;
        markov.matrix = transitionCounts.map(row => [...row]);
        markov.normalizeMatrix();

        // Update UI
        syncMarkovMatrixUI();
        
        melodyStatUnique.textContent = size.toString();
        melodyStatTotal.textContent = parsed.length.toString();
        melodyStatStatus.innerHTML = `<span style="color: var(--color-green)">Trained</span>`;
        
        log('markov', `Markov chain successfully trained on melody input. Unique notes: ${size}. Transitions mapped.`, 'highlight');
    });

    const resetCustomMelodyUI = () => {
        btnMelodyPlay.textContent = 'PLAY SONG';
        btnMelodyPlay.style.background = '';
    };

    const stopCustomMelodyPlayback = () => {
        customMelodyIsPlaying = false;
        if (customMelodyInterval) {
            clearTimeout(customMelodyInterval);
            customMelodyInterval = null;
        }
        resetCustomMelodyUI();
    };

    btnMelodyPlay.addEventListener('click', () => {
        if (customMelodyIsPlaying) {
            stopCustomMelodyPlayback();
            log('system', 'Melody playback stopped.');
            return;
        }

        const rawText = melodyInputRaw.value;
        customMelodyNotes = parseMelodyString(rawText);

        if (customMelodyNotes.length === 0) {
            log('system', 'Playback failed: No valid notes to play.', 'warning');
            return;
        }

        // Stop other playbacks
        audio.stopAll();
        if (gatekeeperWalkInterval) {
            clearInterval(gatekeeperWalkInterval);
            gatekeeperWalkInterval = null;
            toggleWalk.checked = false;
        }
        if (markovPlayInterval) {
            clearInterval(markovPlayInterval);
            markovPlayInterval = null;
            toggleMarkovPlay.checked = false;
        }
        stopRLPlayback();
        lsystem.stopPlayback();
        resetLSystemPlaybackUI();

        // Start playback
        customMelodyIsPlaying = true;
        customMelodyCurrentIndex = 0;
        btnMelodyPlay.textContent = 'STOP SONG';
        btnMelodyPlay.style.background = 'linear-gradient(135deg, #ff0055, #bb0033)';
        
        log('system', `Custom melody sequence started: playing ${customMelodyNotes.length} notes.`);

        const stepDuration = 350; // ms per note

        const playNextCustomNote = () => {
            if (!customMelodyIsPlaying) return;

            if (customMelodyCurrentIndex >= customMelodyNotes.length) {
                stopCustomMelodyPlayback();
                log('system', 'Custom melody playback complete.', 'highlight');
                return;
            }

            const noteObj = customMelodyNotes[customMelodyCurrentIndex];
            
            // Snap through the gatekeeper for pitch safety
            const result = gatekeeper.validateAndSnap(noteObj.midi);

            // Play tone
            audio.triggerTone(result.note.freq, (stepDuration / 1000) * 0.9);
            visualizer.spawnParticle(result.note.midi, result.note.name);
            flashPianoKey(result.note.midi);

            log('system', `Play note ${customMelodyCurrentIndex + 1}/${customMelodyNotes.length}: ${result.note.name}`);

            customMelodyCurrentIndex++;
            customMelodyInterval = setTimeout(playNextCustomNote, stepDuration);
        };

        playNextCustomNote();
    });

    // ----------------------------------------------------
    // 5. REINFORCEMENT LEARNING CONTROLLER
    // ----------------------------------------------------
    const canvasRL = document.getElementById('rl-qtable-canvas');
    const rlEpsilonSlider = document.getElementById('rl-epsilon-slider');
    const rlEpsilonValDisplay = document.getElementById('rl-epsilon-val-display');
    const rlAlphaSlider = document.getElementById('rl-alpha-slider');
    const rlAlphaValDisplay = document.getElementById('rl-alpha-val-display');
    const toggleRlPlay = document.getElementById('rl-play-toggle');
    const btnRlStep = document.getElementById('btn-rl-step');
    const btnRlLike = document.getElementById('btn-rl-like');
    const btnRlDislike = document.getElementById('btn-rl-dislike');

    let rlSteps = 0;

    function drawRLQTable() {
        if (canvasRL && audioStatusLed.classList.contains('active')) {
            rl.drawQTable(canvasRL, gatekeeper.legalNotes);
        }
    }

    function stopRLPlayback() {
        if (rlPlayInterval) {
            clearInterval(rlPlayInterval);
            rlPlayInterval = null;
        }
        if (toggleRlPlay) toggleRlPlay.checked = false;
    }

    function stepRLMelody() {
        if (!rl || gatekeeper.legalNotes.length === 0) return;
        
        const sCount = gatekeeper.legalNotes.length;
        const prevStateIdx = rl.lastActionIndex;
        const safePrevStateIdx = Math.max(0, Math.min(sCount - 1, prevStateIdx));
        
        // Decide exploit vs explore based on active slider
        const exploreThreshold = parseFloat(rlEpsilonSlider.value);
        const decisionText = Math.random() < exploreThreshold ? 'Explore' : 'Exploit';
        document.getElementById('rl-stat-decision').textContent = decisionText;
        
        // Select and trigger action note
        const actionIdx = rl.chooseAction(safePrevStateIdx);
        const noteObj = gatekeeper.legalNotes[actionIdx];
        
        if (!noteObj) return;
        
        // Synth play & visuals
        audio.triggerTone(noteObj.freq, 0.32);
        visualizer.spawnParticle(noteObj.midi, noteObj.name);
        flashPianoKey(noteObj.midi);
        
        // Calculate dynamic reward
        const heuristics = {
            consonance: document.getElementById('rl-reward-consonance').checked,
            stepwise: document.getElementById('rl-reward-stepwise').checked,
            variety: document.getElementById('rl-reward-variety').checked,
            resolution: document.getElementById('rl-reward-resolution').checked
        };
        
        let reward = rl.calculateHeuristicReward(safePrevStateIdx, actionIdx, gatekeeper.legalNotes, heuristics);
        
        // Add manual feedback rating
        if (rl.manualReward !== 0) {
            reward += rl.manualReward;
            rl.manualReward = 0;
        }
        
        document.getElementById('rl-stat-reward').textContent = reward.toFixed(2);
        
        // Q-table Update
        rl.updateQ(safePrevStateIdx, actionIdx, reward, actionIdx);
        
        rlSteps++;
        document.getElementById('rl-stat-steps').textContent = rlSteps.toString();
        
        drawRLQTable();
        
        log('rl', `Path: ${gatekeeper.legalNotes[safePrevStateIdx].name} ──> ${noteObj.name} | Reward: ${reward.toFixed(2)} (${decisionText})`);
    }

    rlEpsilonSlider.addEventListener('input', (e) => {
        rl.epsilon = parseFloat(e.target.value);
        rlEpsilonValDisplay.textContent = parseFloat(e.target.value).toFixed(2);
    });

    rlAlphaSlider.addEventListener('input', (e) => {
        rl.alpha = parseFloat(e.target.value);
        rlAlphaValDisplay.textContent = parseFloat(e.target.value).toFixed(2);
    });

    btnRlStep.addEventListener('click', () => {
        rl.epsilon = parseFloat(rlEpsilonSlider.value);
        rl.alpha = parseFloat(rlAlphaSlider.value);
        stepRLMelody();
    });

    toggleRlPlay.addEventListener('change', (e) => {
        if (e.target.checked) {
            log('rl', 'RL improvisation stream started.');
            rl.epsilon = parseFloat(rlEpsilonSlider.value);
            rl.alpha = parseFloat(rlAlphaSlider.value);
            
            // Stop other playing modes
            audio.stopAll();
            if (gatekeeperWalkInterval) {
                clearInterval(gatekeeperWalkInterval);
                gatekeeperWalkInterval = null;
                toggleWalk.checked = false;
            }
            if (markovPlayInterval) {
                clearInterval(markovPlayInterval);
                markovPlayInterval = null;
                toggleMarkovPlay.checked = false;
            }
            stopCustomMelodyPlayback();
            lsystem.stopPlayback();
            resetLSystemPlaybackUI();
            
            rlPlayInterval = setInterval(stepRLMelody, 380);
        } else {
            stopRLPlayback();
            log('rl', 'RL improvisation stream stopped.');
        }
    });

    btnRlLike.addEventListener('click', () => {
        rl.manualReward += 1.5;
        log('rl', 'Feedback: +1.5 enqueued for next transition.', 'highlight');
        btnRlLike.style.background = 'rgba(0, 245, 212, 0.2)';
        setTimeout(() => btnRlLike.style.background = '', 200);
    });

    btnRlDislike.addEventListener('click', () => {
        rl.manualReward -= 1.5;
        log('rl', 'Feedback: -1.5 enqueued for next transition.', 'warning');
        btnRlDislike.style.background = 'rgba(255, 0, 127, 0.2)';
        setTimeout(() => btnRlDislike.style.background = '', 200);
    });

    // Populate drop downs and execute initial draw
    renderPianoRoll();
    syncMarkovMatrixUI();
    updateLSystemUI();
});
