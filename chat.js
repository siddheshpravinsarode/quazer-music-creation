/**
 * chat.js — Quasar Synth AI Music Assistant
 * A knowledgeable music-chat assistant that understands the Quasar Synth app,
 * music theory, and can suggest melodies/scales/tips.
 */
(function () {
    'use strict';

    // ── DOM refs ─────────────────────────────────────────────────────────────
    let chatPanel, chatFab, chatCloseBtn, chatMessages, chatInput, chatSendBtn;

    // ── Knowledge Base ────────────────────────────────────────────────────────
    const KB = [
        // ── APP SPECIFIC ─────────────────────────────────────────────────────
        {
            keys: ['initialize', 'boot', 'start', 'audio', 'click'],
            reply: `<strong>QUASAR AI</strong> Click <b>INITIALIZE SYSTEM</b> in the top header bar first — this boots the Web Audio API engine. The green LED will light up. Without this, no sound plays. You only need to do it once per session.`
        },
        {
            keys: ['record', 'download', 'save', 'export', 'capture', 'recording'],
            reply: `<strong>QUASAR AI</strong> Use the <b>RECORD & EXPORT</b> panel (step 05). Hit <b>● START REC</b>, play whatever you like across any panel, then hit <b>■ STOP & SAVE</b>. A <code>.webm</code> audio file downloads immediately. You can name your track before recording!`
        },
        {
            keys: ['markov', 'chain', 'probability', 'matrix', 'state'],
            reply: `<strong>QUASAR AI</strong> A Markov chain picks the <b>next note</b> based on probability weights. In the <b>PROBABILITY MATRIX</b> panel: each row is the "current note" and each column is the "next note probability". Higher number = more likely. Try the <b>AMBIENT</b> preset for smooth melodies, or <b>CHAOTIC</b> for wild jumps!`
        },
        {
            keys: ['lsystem', 'l-system', 'fractal', 'dna', 'cellular', 'expand', 'axiom'],
            reply: `<strong>QUASAR AI</strong> The <b>FRACTAL CELLULAR SYSTEM</b> uses an L-System — a string rewriting algorithm. The Axiom (e.g. <code>A</code>) expands using rules like <code>A → B+A</code>. After clicking <b>EXPAND DNA</b>, hit <b>PLAY SEQUENCE</b>. Characters: <code>A/B/C</code> = chords, <code>+/-</code> = tempo change, <code>[/]</code> = octave shift.`
        },
        {
            keys: ['scale', 'gatekeeper', 'snap', 'constraint', 'key', 'mode'],
            reply: `<strong>QUASAR AI</strong> The <b>SCALE GATEKEEPER</b> (step 01) locks all notes to a musical scale. Pick a <b>Root Key</b> (e.g. C) and a <b>Scale Mode</b> (e.g. Minor Pentatonic). Any dissonant note played by the AI gets auto-snapped to the nearest legal pitch — so everything always sounds good!`
        },
        {
            keys: ['train', 'melody', 'learn', 'input', 'teach'],
            reply: `<strong>QUASAR AI</strong> In the <b>MELODY LEARNING MACHINE</b> (step 02), type notes like <code>C4 E4 G4 A4 G4 E4</code> and click <b>TRAIN TRANSITIONS</b>. This teaches the Markov chain your note sequence patterns. Then enable <b>Play Melody Stream</b> in step 03 to hear an infinite AI variation of your style!`
        },
        {
            keys: ['wave', 'synth', 'oscillator', 'triangle', 'sine', 'sawtooth', 'square'],
            reply: `<strong>QUASAR AI</strong> The <b>SYNTH WAVE</b> selector in the oscilloscope bar changes the character: <br>• <b>Triangle</b> — warm, soft, great for pads<br>• <b>Sine</b> — pure tone, minimal harmonics<br>• <b>Sawtooth</b> — harsh, buzzy, great for leads<br>• <b>Square</b> — hollow, retro 8-bit sound`
        },
        {
            keys: ['cutoff', 'filter', 'brightness', 'dark', 'warm', 'muffled'],
            reply: `<strong>QUASAR AI</strong> The <b>CUTOFF</b> slider controls a low-pass filter. Low cutoff (~500 Hz) = dark, muffled sound. High cutoff (~5000 Hz) = bright and crisp. Try a low cutoff with Sawtooth wave for a classic analog synth vibe!`
        },
        {
            keys: ['adsr', 'attack', 'release', 'envelope'],
            reply: `<strong>QUASAR AI</strong> <b>A</b> (Attack) = time to reach full volume after a note starts. Low attack = punchy/percussive. High = slow, swelling pads. <b>R</b> (Release) = how long the note fades after ending. Long release = reverb-like trail. Short release = staccato, tight.`
        },
        {
            keys: ['volume', 'loud', 'quiet', 'master', 'gain'],
            reply: `<strong>QUASAR AI</strong> Use the <b>MASTER VOL</b> slider in the top header. The LCD shows the value in decibels (dB). 0 dB = unity gain (loudest). -inf dB = silence. Keep it around -6 dB to avoid clipping distortion when multiple notes play at once.`
        },

        // ── MUSIC THEORY ─────────────────────────────────────────────────────
        {
            keys: ['lo-fi', 'lofi', 'chill', 'relaxed', 'lazy'],
            reply: `<strong>QUASAR AI</strong> For <b>lo-fi vibes</b>: Use <b>Minor Pentatonic</b> or <b>Dorian</b> scale in Db or F. Set synth to <b>Triangle</b>, cutoff ~1200 Hz, attack ~150ms, release ~800ms. Load <b>AMBIENT</b> preset in the Markov panel for gentle transitions. Try BPM feeling of around 70–85.`
        },
        {
            keys: ['sad', 'melancholy', 'emotional', 'sorrow', 'dark melody'],
            reply: `<strong>QUASAR AI</strong> For a <b>sad/emotional melody</b>: Use <b>Natural Minor</b> or <b>Phrygian</b> scale in A or D. Try this melody input: <code>A4 G4 F4 E4 D4 C4 D4 E4</code>. Slow the playback feeling by setting Release to ~1.2s. The descending pattern creates natural emotional pull.`
        },
        {
            keys: ['happy', 'upbeat', 'bright', 'cheerful', 'major'],
            reply: `<strong>QUASAR AI</strong> For a <b>happy/upbeat feel</b>: Use <b>Major</b> or <b>Major Pentatonic</b> scale in C or G. Try melody: <code>C4 E4 G4 E4 C4 D4 E4 F4 G4</code>. Use <b>Triangle</b> or <b>Sine</b> wave, cutoff high (~4000 Hz), short attack and release for a bouncy feel.`
        },
        {
            keys: ['dramatic', 'epic', 'cinematic', 'intense', 'powerful'],
            reply: `<strong>QUASAR AI</strong> For a <b>dramatic/cinematic</b> sound: Use <b>Harmonic Minor</b> in E or A. Try: <code>E3 B3 E4 D#4 E4 F4 E4 D4 C4 B3</code>. Use <b>Sawtooth</b> wave, cutoff ~3000 Hz, Attack ~200ms, Release ~1.5s. Load CHAOTIC preset then manually increase higher-interval transitions.`
        },
        {
            keys: ['jazz', 'blue', 'blues', 'swing'],
            reply: `<strong>QUASAR AI</strong> For <b>jazz flavors</b>: Use <b>Blues</b> or <b>Dorian</b> scale in Bb or F. Try melody: <code>Bb3 D4 F4 Ab4 Bb4 Ab4 F4 Eb4 D4</code>. The flat 7th (Ab in Bb) gives that classic jazz tension. Use long release and moderate attack for a piano-like envelope.`
        },
        {
            keys: ['ambient', 'space', 'atmospheric', 'meditative', 'drone'],
            reply: `<strong>QUASAR AI</strong> For <b>ambient/space music</b>: Use <b>Lydian</b> scale in C or D. Set Attack ~400ms, Release ~1.5s. Triangle or Sine wave, cutoff ~1500 Hz. Enable the <b>AMBIENT</b> Markov preset and turn on <b>Play Melody Stream</b> — it will generate an infinite atmospheric flow on its own.`
        },
        {
            keys: ['pentatonic', 'penta'],
            reply: `<strong>QUASAR AI</strong> The <b>Pentatonic</b> scale only has 5 notes per octave — no "wrong" notes! Almost anything you play will sound good. It's used in blues, rock, folk, and pop everywhere. Try <b>Minor Pentatonic in A</b>: <code>A3 C4 D4 E4 G4 A4</code>. It's beginner-friendly and always effective.`
        },
        {
            keys: ['chord', 'harmony', 'triad', 'progression'],
            reply: `<strong>QUASAR AI</strong> Chords are triggered in the <b>FRACTAL CELLULAR SYSTEM</b>: characters A, B, C each play multi-note chords. Common progressions in music: I–V–vi–IV (C-G-Am-F), or i–VII–VI–VII (Am-G-F-G) for minor. The L-system naturally creates repeating but varied chord structures.`
        },
        {
            keys: ['twinkle', 'mary', 'birthday', 'classic', 'simple song'],
            reply: `<strong>QUASAR AI</strong> Some classics to try in the Melody Input box:<br>🎵 Twinkle Twinkle: <code>C4 C4 G4 G4 A4 A4 G4</code><br>🎵 Happy Birthday: <code>C4 C4 D4 C4 F4 E4</code><br>🎵 Ode to Joy: <code>E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4 D4 D4</code><br>Train them and let the Markov chain improvise!`
        },
        {
            keys: ['tempo', 'speed', 'bpm', 'fast', 'slow'],
            reply: `<strong>QUASAR AI</strong> Tempo is controlled differently in each panel. The Markov melody stream runs at ~380ms per note (~158 BPM feel). The L-System <code>+</code> character speeds up, <code>-</code> slows down internally. For a slower feel, increase the <b>Release</b> time — notes will overlap and create a legato, slower sensation even at the same interval.`
        },
        {
            keys: ['minor', 'major', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian', 'mode'],
            reply: `<strong>QUASAR AI</strong> Quick mood guide for modes:<br>• <b>Major</b> = happy, bright<br>• <b>Minor</b> = sad, dark<br>• <b>Dorian</b> = jazzy, mysterious<br>• <b>Phrygian</b> = flamenco, exotic<br>• <b>Lydian</b> = dreamy, magical<br>• <b>Mixolydian</b> = bluesy rock<br>• <b>Locrian</b> = eerie, unstable<br>Set your mode in the <b>SCALE GATEKEEPER</b> panel!`
        },
        {
            keys: ['note', 'notation', 'write', 'syntax', 'format', 'how to type'],
            reply: `<strong>QUASAR AI</strong> Note syntax in the Melody Input: write the note letter + optional sharp/flat + octave number. Examples: <code>C4</code> (middle C), <code>G#3</code>, <code>Bb5</code>, <code>F#4</code>. No octave = defaults to 4. Separate notes with spaces. Supported: C, C#, Db, D, D#, Eb, E, F, F#, Gb, G, G#, Ab, A, A#, Bb, B.`
        },
        {
            keys: ['help', 'what can', 'how does', 'guide', 'tutorial', 'how to use'],
            reply: `<strong>QUASAR AI</strong> Here's the Quasar Synth workflow:<br><b>01</b> Initialize → pick scale/key<br><b>02</b> Type a melody → train Markov<br><b>03</b> Enable melody stream for infinite AI music<br><b>04</b> Use L-System for fractal compositions<br><b>05</b> Hit Record & Export to download your creation!<br>Click <b>? GUIDE</b> in the header for the full guide.`
        },
        {
            keys: ['hi', 'hello', 'hey', 'what up', 'yo', 'sup'],
            reply: `<strong>QUASAR AI</strong> Hey! I'm your AI music assistant for Quasar Synth. Ask me anything — how to create a certain vibe, what notes to use, how the panels work, or just say "give me a melody idea" and I'll suggest something! 🎵`
        },
        {
            keys: ['melody idea', 'give me', 'suggest', 'random', 'idea'],
            reply: `<strong>QUASAR AI</strong> Here are some melody ideas to try right now:<br>🌙 <b>Nocturne</b> (Am): <code>A4 E4 C4 E4 G4 E4 F4 E4</code><br>🔥 <b>Epic Rise</b>: <code>C4 D4 E4 G4 A4 G4 E4 C5</code><br>🌊 <b>Wave</b> (Dm): <code>D4 F4 A4 G4 F4 E4 D4 C4 D4</code><br>Paste any into the Melody Input and train it!`
        },
    ];

    // ── Typing delay simulation ───────────────────────────────────────────────
    function _getReply(userText) {
        const lower = userText.toLowerCase();
        for (const entry of KB) {
            if (entry.keys.some(k => lower.includes(k))) {
                return entry.reply;
            }
        }
        // Fallback generic
        return `<strong>QUASAR AI</strong> Hmm, I don't have a specific answer for that, but here's a tip: try experimenting with the <b>Minor Pentatonic</b> scale in A — it's the most forgiving scale for beginners. Type notes like <code>A3 C4 D4 E4 G4 A4</code> into the Melody Input and click Train! Ask me about scales, chords, recording, or any panel.`;
    }

    function _appendMessage(html, role) {
        const div = document.createElement('div');
        div.className = `chat-msg ${role}`;
        div.innerHTML = html;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return div;
    }

    function _showTyping() {
        const div = document.createElement('div');
        div.className = 'chat-msg ai chat-typing-bubble';
        div.innerHTML = `<div class="chat-typing"><span></span><span></span><span></span></div>`;
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return div;
    }

    function _sendMessage(text) {
        text = text.trim();
        if (!text) return;

        // Show user message
        _appendMessage(text, 'user');
        chatInput.value = '';

        // Show typing indicator
        const typingBubble = _showTyping();

        // Simulate thinking delay (400–900ms)
        const delay = 400 + Math.random() * 500;
        setTimeout(() => {
            typingBubble.remove();
            const reply = _getReply(text);
            _appendMessage(reply, 'ai');
        }, delay);
    }

    // ── Bootstrap ─────────────────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        chatPanel    = document.getElementById('chat-panel');
        chatFab      = document.getElementById('chat-fab');
        chatCloseBtn = document.getElementById('chat-close-btn');
        chatMessages = document.getElementById('chat-messages');
        chatInput    = document.getElementById('chat-input');
        chatSendBtn  = document.getElementById('chat-send-btn');

        if (!chatPanel) return; // guard

        // Open / Close
        chatFab.addEventListener('click', () => {
            chatPanel.classList.toggle('hidden');
            if (!chatPanel.classList.contains('hidden') && chatMessages.childElementCount === 0) {
                // Welcome message
                setTimeout(() => {
                    _appendMessage(
                        `<strong>QUASAR AI</strong> Welcome to Quasar Synth! 🎵 I can help you:<br>• Create melodies and suggest notes<br>• Explain how each panel works<br>• Recommend scales for any mood<br>• Guide you through recording<br><br>What would you like to create today?`,
                        'ai'
                    );
                }, 200);
            }
        });

        chatCloseBtn.addEventListener('click', () => {
            chatPanel.classList.add('hidden');
        });

        // Send on button click
        chatSendBtn.addEventListener('click', () => {
            _sendMessage(chatInput.value);
        });

        // Send on Enter key
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                _sendMessage(chatInput.value);
            }
        });

        // Quick prompts
        document.querySelectorAll('.chat-quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const q = btn.dataset.q;
                if (q) {
                    // Open chat if closed
                    chatPanel.classList.remove('hidden');
                    _sendMessage(q);
                }
            });
        });
    });

})();
