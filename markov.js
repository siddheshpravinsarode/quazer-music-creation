class MarkovChain {
    constructor() {
        this.statesCount = 5;
        this.currentStateIndex = 0;
        this.customStates = null;
        
        // Rows represent CURRENT state, Columns represent NEXT state probability
        this.matrix = [];
        
        this.presets = {
            'ambient': [
                [0.5, 0.4, 0.1, 0.0, 0.0], // From Note 1: stays on 1 or steps to 2
                [0.2, 0.5, 0.2, 0.1, 0.0], // From Note 2: steps to 1 or 3
                [0.0, 0.2, 0.5, 0.2, 0.1], // From Note 3: steps to 2 or 4
                [0.0, 0.0, 0.2, 0.5, 0.3], // From Note 4: steps to 3 or 5
                [0.0, 0.0, 0.1, 0.4, 0.5]  // From Note 5: stays on 5 or steps to 4
            ],
            'chaotic': [
                [0.1, 0.2, 0.2, 0.3, 0.2], // Highly dispersed transitions
                [0.2, 0.1, 0.3, 0.2, 0.2],
                [0.3, 0.2, 0.1, 0.2, 0.2],
                [0.2, 0.3, 0.2, 0.1, 0.2],
                [0.2, 0.2, 0.3, 0.2, 0.1]
            ],
            'ascending': [
                [0.1, 0.8, 0.1, 0.0, 0.0], // Heavy bias to go upwards
                [0.0, 0.1, 0.8, 0.1, 0.0],
                [0.0, 0.0, 0.1, 0.8, 0.1],
                [0.1, 0.0, 0.0, 0.1, 0.8],
                [0.8, 0.1, 0.0, 0.0, 0.1]  // Loops back to bottom
            ]
        };

        this.loadPreset('ambient');
    }

    loadPreset(presetKey) {
        if (this.presets[presetKey]) {
            this.customStates = null;
            this.statesCount = 5;
            // Deep copy preset matrix
            this.matrix = this.presets[presetKey].map(row => [...row]);
            this.normalizeMatrix();
        }
    }

    setProbability(fromState, toState, val) {
        const numVal = Math.max(0, parseFloat(val) || 0);
        this.matrix[fromState][toState] = numVal;
        this.normalizeMatrix();
    }

    normalizeMatrix() {
        for (let r = 0; r < this.statesCount; r++) {
            let rowSum = this.matrix[r].reduce((sum, val) => sum + val, 0);
            
            if (rowSum === 0) {
                // If row is empty, set uniform distribution
                this.matrix[r] = Array(this.statesCount).fill(1 / this.statesCount);
            } else {
                // Divide each element by the sum to make them sum to 1.0
                this.matrix[r] = this.matrix[r].map(val => val / rowSum);
            }
        }
    }

    // Roll dice to choose the next note index
    getNextState() {
        const probabilities = this.matrix[this.currentStateIndex];
        const rand = Math.random();
        
        let cumulativeProb = 0;
        for (let i = 0; i < this.statesCount; i++) {
            cumulativeProb += probabilities[i];
            if (rand <= cumulativeProb) {
                this.currentStateIndex = i;
                return i;
            }
        }
        
        // Fallback in case of rounding errors
        this.currentStateIndex = this.statesCount - 1;
        return this.currentStateIndex;
    }

    setCurrentState(index) {
        if (index >= 0 && index < this.statesCount) {
            this.currentStateIndex = index;
        }
    }
}

window.MarkovChain = MarkovChain;
