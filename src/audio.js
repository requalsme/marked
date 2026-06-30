export class AudioManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.ambientOsc = null;
        this.ambientGain = null;
        this.lowPassFilter = null;
        
        this.sanityLevel = 100;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            this.ctx = new AudioContext();
            
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.5;
            this.masterGain.connect(this.ctx.destination);

            this.lowPassFilter = this.ctx.createBiquadFilter();
            this.lowPassFilter.type = 'lowpass';
            this.lowPassFilter.frequency.value = 20000;
            this.lowPassFilter.connect(this.masterGain);

            this.startAmbientLoop();
            
            this.initialized = true;
        } catch (e) {
            console.warn("WebAudio API not supported", e);
        }
    }

    startAmbientLoop() {
        if (!this.ctx) return;
        this.ambientOsc = this.ctx.createOscillator();
        this.ambientGain = this.ctx.createGain();
        
        this.ambientOsc.type = 'sine';
        this.ambientOsc.frequency.value = 55; // Low hum
        
        this.ambientGain.gain.value = 0.1;
        
        this.ambientOsc.connect(this.ambientGain);
        this.ambientGain.connect(this.lowPassFilter);
        
        this.ambientOsc.start();
    }

    updateSanity(sanity) {
        this.sanityLevel = sanity;
        if (!this.ctx || !this.ambientOsc) return;

        // As sanity drops, lower the filter frequency and add dissonance
        const normalizedSanity = Math.max(0, Math.min(100, sanity)) / 100;
        
        // Pitch shift the ambient hum slightly
        this.ambientOsc.frequency.value = 55 + (1 - normalizedSanity) * 15;
        
        // Lower the lowpass filter to make it sound muffled/underwater at low sanity
        const minFreq = 400;
        const maxFreq = 20000;
        this.lowPassFilter.frequency.value = minFreq + (maxFreq - minFreq) * normalizedSanity;

        // Random whispers at low sanity
        if (sanity < 40 && Math.random() < 0.003 * (1 - normalizedSanity)) {
            this.playWhisper();
        }
    }

    playWhisper() {
        if (!this.ctx) return;
        try {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            
            // Create a short noise burst with bandpass filtering
            const bufferSize = this.ctx.sampleRate * (0.5 + Math.random() * 0.5); // 0.5-1s
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            
            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;
            
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1000 + Math.random() * 2000; // speech-like range
            filter.Q.value = 2; // tight resonance
            
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0, this.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + buffer.duration);
            
            // Add a stereo panner for spatial disorientation
            const panner = this.ctx.createStereoPanner();
            panner.pan.value = Math.random() * 2 - 1; // Left or right ear
            
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(panner);
            panner.connect(this.masterGain);
            
            noise.start();
        } catch(e) {}
    }

    playClick() {
        if (!this.ctx) return;
        try {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(800, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.1);
            
            gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
            
            osc.connect(gain);
            gain.connect(this.masterGain);
            
            osc.start();
            osc.stop(this.ctx.currentTime + 0.1);
        } catch(e) {}
    }

    playHit() {
        if (!this.ctx) return;
        try {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.2);
            
            gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
            
            osc.connect(gain);
            gain.connect(this.masterGain);
            
            osc.start();
            osc.stop(this.ctx.currentTime + 0.2);
        } catch(e) {}
    }

    playDeath() {
        if (!this.ctx) return;
        try {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'square';
            osc.frequency.setValueAtTime(100, this.ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(10, this.ctx.currentTime + 1.0);
            
            gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 1.0);
            
            osc.connect(gain);
            gain.connect(this.masterGain);
            
            osc.start();
            osc.stop(this.ctx.currentTime + 1.0);
        } catch(e) {}
    }
    
    playLevelUp() {
        if (!this.ctx) return;
        try {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, this.ctx.currentTime);
            osc.frequency.setValueAtTime(554, this.ctx.currentTime + 0.2);
            osc.frequency.setValueAtTime(659, this.ctx.currentTime + 0.4);
            osc.frequency.setValueAtTime(880, this.ctx.currentTime + 0.6);
            
            gain.gain.setValueAtTime(0, this.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.5, this.ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.5, this.ctx.currentTime + 0.6);
            gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 1.2);
            
            osc.connect(gain);
            gain.connect(this.masterGain);
            
            osc.start();
            osc.stop(this.ctx.currentTime + 1.2);
        } catch(e) {}
    }
}

export const audioManager = new AudioManager();
