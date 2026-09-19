class Visualizer {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.animationId = null;
        this.particles = [];
        this.analyser = null;
        this.dataArray = null;
        
        // Markov SVG elements
        this.svg = null;
        this.svgNodes = [];
        this.svgEdges = [];
        
        // Palette
        this.colors = [
            '#00f0ff', // neon cyan
            '#ff007f', // neon pink
            '#a124ff', // neon violet
            '#ffaa00', // amber
            '#00ff66'  // neon green
        ];
    }

    initCanvas(canvasEl, analyser) {
        this.canvas = canvasEl;
        this.ctx = canvasEl.getContext('2d');
        this.analyser = analyser;
        
        if (analyser) {
            const bufferLength = analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);
        }

        // Resize handler
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        // Start animation loop
        this.animate();
    }

    resizeCanvas() {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    spawnParticle(midi, name) {
        if (!this.canvas) return;
        
        // Map MIDI notes (36 to 96) to X axis
        const minMidi = 36;
        const maxMidi = 96;
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        
        // Clamp and normalize
        const norm = (midi - minMidi) / (maxMidi - minMidi);
        const x = Math.max(0.1, Math.min(0.9, norm)) * width;
        
        // Choose color based on note name pitch class (C, C#, D...)
        const noteIndex = midi % 12;
        const color = this.colors[noteIndex % this.colors.length];

        this.particles.push({
            x: x,
            y: height - 10,
            vx: (Math.random() - 0.5) * 0.8,
            vy: -1.2 - Math.random() * 2.0,
            radius: 8 + Math.random() * 15,
            alpha: 1.0,
            decay: 0.008 + Math.random() * 0.012,
            color: color,
            name: name
        });
    }

    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        this.render();
    }

    render() {
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        
        // 1. Clear background with trails
        this.ctx.fillStyle = 'rgba(10, 5, 22, 0.2)';
        this.ctx.fillRect(0, 0, width, height);

        // 2. Draw Oscilloscope (Waveform)
        if (this.analyser && this.dataArray) {
            this.analyser.getByteTimeDomainData(this.dataArray);
            
            this.ctx.lineWidth = 2.5;
            // Create gradient for waveform
            const grad = this.ctx.createLinearGradient(0, 0, width, 0);
            grad.addColorStop(0, '#ff007f');
            grad.addColorStop(0.5, '#a124ff');
            grad.addColorStop(1, '#00f0ff');
            this.ctx.strokeStyle = grad;
            
            // Glow effect for oscilloscope
            this.ctx.shadowBlur = 8;
            this.ctx.shadowColor = '#a124ff';
            
            this.ctx.beginPath();
            const sliceWidth = width / this.dataArray.length;
            let x = 0;
            
            for (let i = 0; i < this.dataArray.length; i++) {
                const v = this.dataArray[i] / 128.0; // 0.0 to 2.0
                const y = (v * height) / 2; // Center horizontally
                
                if (i === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
                x += sliceWidth;
            }
            
            this.ctx.lineTo(width, height / 2);
            this.ctx.stroke();
            
            // Reset shadow
            this.ctx.shadowBlur = 0;
        }

        // 3. Update & Draw Particles
        this.particles.forEach((p, idx) => {
            p.x += p.vx;
            p.y += p.vy;
            p.alpha -= p.decay;
            
            // Draw particle glow
            this.ctx.save();
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = p.color;
            this.ctx.globalAlpha = p.alpha;
            this.ctx.fillStyle = p.color;
            
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Draw text inside larger particles
            if (p.radius > 12) {
                this.ctx.fillStyle = '#ffffff';
                this.ctx.font = 'bold 9px "JetBrains Mono", Courier';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(p.name, p.x, p.y);
            }
            
            this.ctx.restore();
            
            // Remove dead particles
            if (p.alpha <= 0 || p.y < -30) {
                this.particles.splice(idx, 1);
            }
        });
    }

    stop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }

    // ----------------------------------------------------
    // Markov Graph SVG Rendering
    // ----------------------------------------------------
    renderMarkovGraph(svgEl, markov, gatekeeper, onNodeClick) {
        this.svg = svgEl;
        this.svg.innerHTML = ''; // Clear SVG
        
        const width = svgEl.clientWidth || 300;
        const height = svgEl.clientHeight || 300;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) * 0.32; // Circle radius
        
        const nodesCount = markov.statesCount;
        this.svgNodes = [];
        
        // 1. Calculate positions for states
        for (let i = 0; i < nodesCount; i++) {
            const angle = (i * 2 * Math.PI) / nodesCount - Math.PI / 2;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            
            // Map state index to note details
            const scaleNotes = gatekeeper.legalNotes;
            let noteName = 'Note ' + (i + 1);
            let midi = 60;
            
            if (markov.customStates && markov.customStates[i]) {
                noteName = markov.customStates[i].name;
                midi = markov.customStates[i].midi;
            } else if (scaleNotes.length > 0) {
                // Find a nice middle index in the scale
                const centerIdx = Math.floor(scaleNotes.length / 2) - 2 + i;
                const noteObj = scaleNotes[Math.max(0, Math.min(scaleNotes.length - 1, centerIdx))];
                if (noteObj) {
                    noteName = noteObj.name;
                    midi = noteObj.midi;
                }
            }

            this.svgNodes.push({ index: i, name: noteName, midi: midi, x, y });
        }

        // Create arrows definition
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', 'arrow');
        marker.setAttribute('viewBox', '0 0 10 10');
        marker.setAttribute('refX', '24'); // Offset so arrow tip stops at node edge
        marker.setAttribute('refY', '5');
        marker.setAttribute('markerWidth', '6');
        marker.setAttribute('markerHeight', '6');
        marker.setAttribute('orient', 'auto-start-reverse');
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
        path.setAttribute('fill', 'rgba(255, 255, 255, 0.4)');
        
        marker.appendChild(path);
        defs.appendChild(marker);
        this.svg.appendChild(defs);

        // 2. Draw connections (transitions)
        for (let i = 0; i < nodesCount; i++) {
            for (let j = 0; j < nodesCount; j++) {
                const prob = markov.matrix[i][j];
                if (prob < 0.05) continue; // Skip weak paths to avoid clutter

                const from = this.svgNodes[i];
                const to = this.svgNodes[j];
                
                const edge = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                
                let d = '';
                if (i === j) {
                    // Self-loop: draw loop outward
                    const dx = from.x - centerX;
                    const dy = from.y - centerY;
                    const len = Math.sqrt(dx*dx + dy*dy);
                    const ux = dx / len;
                    const uy = dy / len;
                    
                    const loopRadius = 18;
                    const lx = from.x + ux * loopRadius * 1.5;
                    const ly = from.y + uy * loopRadius * 1.5;
                    
                    d = `M ${from.x - uy * 8} ${from.y + ux * 8} C ${lx - uy*10} ${ly + ux*10}, ${lx + uy*10} ${ly - ux*10}, ${from.x + uy * 8} ${from.y - ux * 8}`;
                } else {
                    // Curved line between nodes to distinguish forward vs backward
                    const mx = (from.x + to.x) / 2;
                    const my = (from.y + to.y) / 2;
                    // Normal vector for curve displacement
                    const dx = to.x - from.x;
                    const dy = to.y - from.y;
                    const len = Math.sqrt(dx*dx + dy*dy);
                    const nx = -dy / len;
                    const ny = dx / len;
                    
                    const offset = 18; // curve strength
                    const cx = mx + nx * offset;
                    const cy = my + ny * offset;
                    
                    d = `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
                }

                edge.setAttribute('d', d);
                edge.setAttribute('fill', 'none');
                edge.setAttribute('stroke', `rgba(161, 36, 255, ${Math.min(0.8, prob + 0.1)})`);
                edge.setAttribute('stroke-width', (1 + prob * 4.5).toString());
                edge.setAttribute('marker-end', 'url(#arrow)');
                edge.setAttribute('class', `transition-edge from-${i} to-${j}`);
                
                // Store connection probabilities
                edge.dataset.probability = prob.toFixed(2);
                
                this.svg.appendChild(edge);
            }
        }

        // 3. Draw nodes
        this.svgNodes.forEach((node) => {
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', `markov-node node-${node.index} ${node.index === markov.currentStateIndex ? 'active' : ''}`);
            g.style.cursor = 'pointer';
            
            // Outer glow ring
            const glow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            glow.setAttribute('cx', node.x.toString());
            glow.setAttribute('cy', node.y.toString());
            glow.setAttribute('r', '20');
            glow.setAttribute('class', 'node-glow');
            glow.setAttribute('fill', 'none');
            glow.setAttribute('stroke', this.colors[node.index % this.colors.length]);
            glow.setAttribute('stroke-width', '2');
            glow.setAttribute('opacity', node.index === markov.currentStateIndex ? '1' : '0.2');
            
            // Base Circle
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', node.x.toString());
            circle.setAttribute('cy', node.y.toString());
            circle.setAttribute('r', '17');
            circle.setAttribute('fill', 'rgba(25, 12, 50, 0.95)');
            circle.setAttribute('stroke', node.index === markov.currentStateIndex ? '#ffffff' : this.colors[node.index % this.colors.length]);
            circle.setAttribute('stroke-width', '1.5');
            circle.setAttribute('class', 'node-core');

            // Text Label
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', node.x.toString());
            text.setAttribute('y', (node.y + 4).toString());
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('fill', '#ffffff');
            text.setAttribute('font-size', '10px');
            text.setAttribute('font-family', '"JetBrains Mono", monospace');
            text.setAttribute('font-weight', 'bold');
            text.textContent = node.name;

            g.appendChild(glow);
            g.appendChild(circle);
            g.appendChild(text);

            // Interaction
            g.addEventListener('click', () => {
                if (onNodeClick) onNodeClick(node.index, node.midi);
            });

            this.svg.appendChild(g);
        });
    }

    animateMarkovTransition(fromIdx, toIdx) {
        if (!this.svg) return;
        
        const fromNode = this.svgNodes[fromIdx];
        const toNode = this.svgNodes[toIdx];
        if (!fromNode || !toNode) return;

        // 1. Pulse active node glow
        const nodes = this.svg.querySelectorAll('.markov-node');
        nodes.forEach(n => {
            n.classList.remove('active');
            const gl = n.querySelector('.node-glow');
            if (gl) {
                gl.setAttribute('opacity', '0.2');
                gl.setAttribute('stroke-width', '2');
            }
            const core = n.querySelector('.node-core');
            if (core) {
                const idx = parseInt(n.className.baseVal.match(/node-(\d+)/)[1]);
                core.setAttribute('stroke', this.colors[idx % this.colors.length]);
            }
        });
        
        const activeNodeEl = this.svg.querySelector(`.node-${toIdx}`);
        if (activeNodeEl) {
            activeNodeEl.classList.add('active');
            const gl = activeNodeEl.querySelector('.node-glow');
            if (gl) {
                gl.setAttribute('opacity', '1');
                gl.setAttribute('stroke-width', '3');
            }
            const core = activeNodeEl.querySelector('.node-core');
            if (core) {
                core.setAttribute('stroke', '#ffffff');
            }
        }

        // 2. Animate a particle packet along the SVG connection curve
        const pathEl = this.svg.querySelector(`.from-${fromIdx}.to-${toIdx}`);
        if (pathEl) {
            const length = pathEl.getTotalLength();
            
            const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            dot.setAttribute('r', '5');
            dot.setAttribute('fill', '#ffffff');
            // Give it a glowing shadow filter if desired, or simple neon fill
            dot.setAttribute('fill', this.colors[toIdx % this.colors.length]);
            dot.setAttribute('filter', 'drop-shadow(0 0 5px #fff)');

            this.svg.appendChild(dot);

            // Animate along path using Web Animations API or requestAnimationFrame
            let start = null;
            const duration = 280; // ms transition speed

            const step = (timestamp) => {
                if (!start) start = timestamp;
                const progress = (timestamp - start) / duration;

                if (progress < 1.0) {
                    const point = pathEl.getPointAtLength(progress * length);
                    dot.setAttribute('cx', point.x.toString());
                    dot.setAttribute('cy', point.y.toString());
                    requestAnimationFrame(step);
                } else {
                    dot.remove(); // Clean up dot at destination
                }
            };
            requestAnimationFrame(step);
        }
    }
}

window.Visualizer = Visualizer;
