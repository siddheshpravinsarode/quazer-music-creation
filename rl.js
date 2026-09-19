class RLAgent {
    constructor() {
        this.alpha = 0.1;       // Learning rate
        this.gamma = 0.9;       // Discount factor
        this.epsilon = 0.2;     // Exploration rate
        
        this.qTable = [];       // State-Action matrix
        this.statesCount = 0;
        
        // Active tracking
        this.lastStateIndex = 0;
        this.lastActionIndex = 0;
        this.history = [];      // Track last 4 actions to reward variety
        
        // Manual reward buffer
        this.manualReward = 0;
    }

    initQTable(size) {
        if (size <= 0) return;
        
        // If size is unchanged, keep existing learning states
        if (this.statesCount === size) return;
        
        const oldQTable = this.qTable;
        const oldSize = this.statesCount;
        
        // Initialize new Q-table of size x size with zeros
        this.qTable = Array(size).fill(0).map(() => Array(size).fill(0));
        
        // Try to transfer old weights where possible
        if (oldSize > 0) {
            const transferLimit = Math.min(oldSize, size);
            for (let r = 0; r < transferLimit; r++) {
                for (let c = 0; c < transferLimit; c++) {
                    this.qTable[r][c] = oldQTable[r][c];
                }
            }
        }
        
        this.statesCount = size;
        this.lastStateIndex = Math.floor(size / 2); // Start in the middle
        this.lastActionIndex = Math.floor(size / 2);
    }

    chooseAction(stateIndex) {
        if (this.statesCount === 0) return 0;
        
        // Ensure state index is safe
        const s = Math.max(0, Math.min(this.statesCount - 1, stateIndex));
        
        // Epsilon-greedy exploration
        if (Math.random() < this.epsilon) {
            return Math.floor(Math.random() * this.statesCount);
        }
        
        // Exploit: find action with maximum Q-value
        const qRow = this.qTable[s];
        let maxVal = -Infinity;
        let bestActions = [];
        
        for (let a = 0; a < this.statesCount; a++) {
            if (qRow[a] > maxVal) {
                maxVal = qRow[a];
                bestActions = [a];
            } else if (qRow[a] === maxVal) {
                bestActions.push(a);
            }
        }
        
        // If multiple actions have the same Q-value, pick randomly among them
        const chosenAction = bestActions[Math.floor(Math.random() * bestActions.length)];
        return chosenAction;
    }

    updateQ(stateIndex, actionIndex, reward, nextStateIndex) {
        if (this.statesCount === 0) return;
        
        const s = Math.max(0, Math.min(this.statesCount - 1, stateIndex));
        const a = Math.max(0, Math.min(this.statesCount - 1, actionIndex));
        const sNext = Math.max(0, Math.min(this.statesCount - 1, nextStateIndex));
        
        // Bellman Equation update: Q(s,a) = Q(s,a) + alpha * [ R + gamma * max_a' Q(s', a') - Q(s,a) ]
        const currentQ = this.qTable[s][a];
        const nextMaxQ = Math.max(...this.qTable[sNext]);
        
        const target = reward + this.gamma * nextMaxQ;
        this.qTable[s][a] = currentQ + this.alpha * (target - currentQ);
        
        // Update history
        this.history.push(a);
        if (this.history.length > 4) {
            this.history.shift();
        }
        
        this.lastStateIndex = s;
        this.lastActionIndex = a;
    }

    calculateHeuristicReward(prevStateIndex, actionIndex, legalNotes, heuristics) {
        if (this.statesCount <= 1) return 0;
        
        let reward = 0;
        
        const sNote = legalNotes[prevStateIndex];
        const aNote = legalNotes[actionIndex];
        
        if (!sNote || !aNote) return 0;
        
        const midiDiff = Math.abs(aNote.midi - sNote.midi);
        
        // 1. Consonance Bias
        if (heuristics.consonance) {
            const interval = midiDiff % 12;
            if (interval === 0 && midiDiff > 0) {
                reward += 0.8; // Octave resolve
            } else if (interval === 7) {
                reward += 0.6; // Perfect fifth
            } else if (interval === 5) {
                reward += 0.4; // Perfect fourth
            } else if (interval === 4 || interval === 3) {
                reward += 0.5; // Major/Minor third
            } else if (interval === 9) {
                reward += 0.4; // Major sixth
            } else if (interval === 2 || interval === 10) {
                reward += 0.1; // Mildly consonant major second/minor seventh
            } else {
                reward -= 0.3; // Dissonant intervals (tritone, minor second etc)
            }
        }
        
        // 2. Stepwise Motion Bias (prefer smooth melodies)
        if (heuristics.stepwise) {
            if (midiDiff === 0) {
                reward -= 0.2; // Discourage hitting the exact same note repeatedly
            } else if (midiDiff <= 2) {
                reward += 0.6; // Stepwise step (semitone or tone)
            } else if (midiDiff <= 4) {
                reward += 0.3; // Small leap
            } else if (midiDiff >= 12) {
                reward -= 0.5; // Giant octave-plus jumps penalized
            }
        }
        
        // 3. Variety Bias (discourage loops/repetition)
        if (heuristics.variety) {
            if (actionIndex === prevStateIndex) {
                reward -= 0.6; // Explicit note repetition penalty
            }
            
            // Penalize based on count in short memory history
            const occurrences = this.history.filter(idx => idx === actionIndex).length;
            if (occurrences > 0) {
                reward -= occurrences * 0.25;
            } else {
                reward += 0.3; // Novelty reward!
            }
        }
        
        // 4. Resolution Bias (prefer resolving back to root or key notes)
        if (heuristics.resolution) {
            const rootMidi = legalNotes[0] ? legalNotes[0].midi % 12 : 0;
            const noteMidiClass = aNote.midi % 12;
            
            if (noteMidiClass === rootMidi) {
                reward += 0.6; // Home resolution (tonic)
            } else if (noteMidiClass === (rootMidi + 7) % 12) {
                reward += 0.3; // Dominant resolution
            }
        }
        
        return reward;
    }

    drawQTable(canvas, legalNotes) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // Clear canvas
        ctx.fillStyle = '#080a0e';
        ctx.fillRect(0, 0, width, height);
        
        if (this.statesCount === 0) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = '11px "JetBrains Mono"';
            ctx.textAlign = 'center';
            ctx.fillText('Initializing Q-table grid...', width / 2, height / 2);
            return;
        }

        const margin = 32; // space for labels
        const gridW = width - margin - 10;
        const gridH = height - margin - 10;
        
        const cellW = gridW / this.statesCount;
        const cellH = gridH / this.statesCount;
        
        // Find max absolute Q-value to scale intensity
        let maxAbsQ = 0.01;
        for (let r = 0; r < this.statesCount; r++) {
            for (let c = 0; c < this.statesCount; c++) {
                const absVal = Math.abs(this.qTable[r][c]);
                if (absVal > maxAbsQ) maxAbsQ = absVal;
            }
        }
        
        // Draw Grid cells
        for (let s = 0; s < this.statesCount; s++) {
            for (let a = 0; a < this.statesCount; a++) {
                const qValue = this.qTable[s][a];
                const normVal = Math.min(1.0, Math.abs(qValue) / maxAbsQ);
                
                const cellX = margin + a * cellW;
                const cellY = s * cellH;
                
                if (qValue > 0) {
                    // Positive rewards: Green tint
                    ctx.fillStyle = `rgba(0, 245, 212, ${0.1 + normVal * 0.75})`;
                } else if (qValue < 0) {
                    // Negative rewards: Red/Pink tint
                    ctx.fillStyle = `rgba(255, 0, 127, ${0.1 + normVal * 0.75})`;
                } else {
                    // Unexplored: Dark gray background
                    ctx.fillStyle = '#11141a';
                }
                
                ctx.fillRect(cellX, cellY, cellW - 1, cellH - 1);
                
                // Draw thin grid border
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
                ctx.strokeRect(cellX, cellY, cellW, cellH);

                // Highlight active transition cell
                if (s === this.lastStateIndex && a === this.lastActionIndex) {
                    ctx.strokeStyle = '#00f0ff';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(cellX + 1, cellY + 1, cellW - 2, cellH - 2);
                }
            }
        }
        
        // Draw axis labels
        ctx.fillStyle = '#475569';
        ctx.font = '8px "JetBrains Mono"';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        
        // Draw Y-axis labels (State - From Note)
        const step = Math.ceil(this.statesCount / 8); // Skip some labels if too many notes
        for (let s = 0; s < this.statesCount; s++) {
            if (s % step === 0 && legalNotes[s]) {
                const noteY = s * cellH + cellH / 2;
                ctx.fillText(legalNotes[s].name, margin - 5, noteY);
            }
        }
        
        // Draw X-axis labels (Action - To Note) at the bottom
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let a = 0; a < this.statesCount; a++) {
            if (a % step === 0 && legalNotes[a]) {
                const noteX = margin + a * cellW + cellW / 2;
                ctx.fillText(legalNotes[a].name, noteX, gridH + 5);
            }
        }
    }
}

window.RLAgent = RLAgent;
