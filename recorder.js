/**
 * recorder.js — Quasar Synth Audio Recorder
 * Captures the live AudioContext output and lets the user download it.
 *
 * Usage:
 *   window.QuasarRecorder.init(audioEngine);   // call once audio is initialized
 *   window.QuasarRecorder.start();
 *   window.QuasarRecorder.stop();
 */
(function () {
    'use strict';

    // ── DOM refs (assigned on DOMContentLoaded) ─────────────────────────────
    let btnStart, btnStop, recDot, recStatusText, recTimer, recWaveformInner, recDownloadsList;

    // ── State ────────────────────────────────────────────────────────────────
    let mediaRecorder = null;
    let recordedChunks = [];
    let timerInterval = null;
    let elapsedSeconds = 0;
    let streamDestination = null;
    let audioEngineRef = null;
    let recordingCount = 0;

    // ── Init: wire the audio engine's output into a MediaStream ──────────────
    function init(audioEngine) {
        audioEngineRef = audioEngine;
        // Once the AudioContext exists, create a stream from it
        if (audioEngine.ctx) {
            _connectStream(audioEngine);
        } else {
            // AudioContext may not be created yet — we'll do it lazily in start()
        }
    }

    function _connectStream(audioEngine) {
        if (streamDestination) return; // already connected
        if (!audioEngine.ctx) return;

        streamDestination = audioEngine.ctx.createMediaStreamDestination();

        // Tap off the master gain node so we capture the full mix
        if (audioEngine.masterGain) {
            audioEngine.masterGain.connect(streamDestination);
        } else if (audioEngine.analyser) {
            audioEngine.analyser.connect(streamDestination);
        }
    }

    // ── Start recording ──────────────────────────────────────────────────────
    function start() {
        if (!audioEngineRef) {
            _log('Recorder: Audio engine not linked. Initialize the system first.', 'warn');
            return;
        }

        // Make sure the audio context is running
        if (!audioEngineRef.ctx) {
            _log('Recorder: Boot the audio engine first (click INITIALIZE SYSTEM).', 'warn');
            _setStatus('⚠ Initialize the audio engine first!');
            return;
        }

        // Connect if not already
        _connectStream(audioEngineRef);

        if (!streamDestination) {
            _log('Recorder: Could not create media stream. Try re-initializing.', 'warn');
            return;
        }

        recordedChunks = [];
        elapsedSeconds = 0;
        _updateTimer(0);

        // Pick best supported mime type
        const mimeType = _getBestMimeType();
        const options = mimeType ? { mimeType } : {};

        try {
            mediaRecorder = new MediaRecorder(streamDestination.stream, options);
        } catch (e) {
            // Fallback: no options
            mediaRecorder = new MediaRecorder(streamDestination.stream);
        }

        mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                recordedChunks.push(e.data);
            }
        };

        mediaRecorder.onstop = _onStop;

        // Request data every 100ms for smoother chunks
        mediaRecorder.start(100);

        // UI
        recDot.classList.add('recording');
        _setStatus('● RECORDING — playing anything now will be captured');
        btnStart.disabled = true;
        btnStart.style.opacity = '0.5';
        btnStop.disabled = false;
        btnStop.style.opacity = '1';

        // Animate waveform bar
        _startWaveformAnim();

        // Start timer
        timerInterval = setInterval(() => {
            elapsedSeconds++;
            _updateTimer(elapsedSeconds);
        }, 1000);

        _log('Recorder: Recording started. Play any panels to capture audio.');
    }

    // ── Stop recording ───────────────────────────────────────────────────────
    function stop() {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
        mediaRecorder.stop();
        _cleanup();
    }

    function _cleanup() {
        clearInterval(timerInterval);
        timerInterval = null;
        _stopWaveformAnim();

        recDot.classList.remove('recording');
        btnStart.disabled = false;
        btnStart.style.opacity = '1';
        btnStop.disabled = true;
        btnStop.style.opacity = '';
        _setStatus('Processing… preparing download');
    }

    function _onStop() {
        if (recordedChunks.length === 0) {
            _setStatus('IDLE — No audio was captured.');
            return;
        }

        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(recordedChunks, { type: mimeType });
        const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm';

        // Build filename
        const trackNameInput = document.getElementById('rec-track-name');
        const rawName = (trackNameInput && trackNameInput.value.trim()) || 'quasar-track';
        const safeName = rawName.replace(/[^a-zA-Z0-9\-_]/g, '_');
        const filename = `${safeName}-${_timestamp()}.${ext}`;

        // Create object URL & trigger download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Add to downloads list
        recordingCount++;
        const sizeKb = Math.round(blob.size / 1024);
        _addDownloadEntry(url, filename, sizeKb);

        _setStatus(`✔ Saved: ${filename}  (${sizeKb} KB)`);
        _log(`Recorder: Download triggered — ${filename} (${sizeKb} KB, ${elapsedSeconds}s)`);

        recordedChunks = [];
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    function _getBestMimeType() {
        const candidates = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/ogg',
            'audio/mp4',
        ];
        for (const t of candidates) {
            if (MediaRecorder.isTypeSupported(t)) return t;
        }
        return '';
    }

    function _updateTimer(s) {
        const mm = String(Math.floor(s / 60)).padStart(2, '0');
        const ss = String(s % 60).padStart(2, '0');
        if (recTimer) recTimer.textContent = `${mm}:${ss}`;
    }

    function _setStatus(msg) {
        if (recStatusText) recStatusText.textContent = msg;
    }

    function _addDownloadEntry(url, filename, sizeKb) {
        if (!recDownloadsList) return;

        // Remove placeholder
        const placeholder = recDownloadsList.querySelector('span');
        if (placeholder) placeholder.remove();

        const item = document.createElement('div');
        item.className = 'rec-download-item';
        item.innerHTML = `
            <a href="${url}" download="${filename}" title="Download ${filename}">
                ↓ ${filename}
            </a>
            <span class="rec-size">${sizeKb} KB</span>
        `;
        recDownloadsList.prepend(item);
    }

    let waveAnimId = null;
    let waveDir = 1;
    let waveWidth = 0;

    function _startWaveformAnim() {
        function animFrame() {
            waveWidth += waveDir * (Math.random() * 3 + 1);
            if (waveWidth >= 95) waveDir = -1;
            if (waveWidth <= 10) waveDir = 1;
            if (recWaveformInner) recWaveformInner.style.width = waveWidth.toFixed(1) + '%';
            waveAnimId = requestAnimationFrame(animFrame);
        }
        waveAnimId = requestAnimationFrame(animFrame);
    }

    function _stopWaveformAnim() {
        if (waveAnimId) {
            cancelAnimationFrame(waveAnimId);
            waveAnimId = null;
        }
        if (recWaveformInner) recWaveformInner.style.width = '0%';
    }

    function _timestamp() {
        const d = new Date();
        return [
            d.getFullYear(),
            String(d.getMonth() + 1).padStart(2, '0'),
            String(d.getDate()).padStart(2, '0'),
            String(d.getHours()).padStart(2, '0'),
            String(d.getMinutes()).padStart(2, '0'),
        ].join('');
    }

    function _log(msg, type) {
        // Pipe into the app console if it exists
        const logArea = document.getElementById('console-log-area');
        if (!logArea) return;
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        const timeStr = new Date().toTimeString().split(' ')[0];
        entry.innerHTML = `<span class="log-time">[${timeStr}]</span><span class="log-tag" style="color:#39ff14;">RECORDER</span><span class="log-msg ${type === 'warn' ? 'warning' : ''}">${msg}</span>`;
        logArea.appendChild(entry);
        logArea.scrollTop = logArea.scrollHeight;
    }

    // ── Bootstrap on DOM ready ───────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        btnStart         = document.getElementById('btn-rec-start');
        btnStop          = document.getElementById('btn-rec-stop');
        recDot           = document.getElementById('rec-dot');
        recStatusText    = document.getElementById('rec-status-text');
        recTimer         = document.getElementById('rec-timer');
        recWaveformInner = document.getElementById('rec-waveform-inner');
        recDownloadsList = document.getElementById('rec-downloads-list');

        if (btnStart) {
            btnStart.addEventListener('click', () => {
                start();
            });
        }

        if (btnStop) {
            btnStop.addEventListener('click', () => {
                stop();
            });
        }
    });

    // ── Public API ───────────────────────────────────────────────────────────
    window.QuasarRecorder = { init, start, stop };

})();
