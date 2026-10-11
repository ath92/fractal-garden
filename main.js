import Regl from "regl";
import fragmentShaders from './fractals/index.js';
import PlayerControls from './player-controls.js';
import setupRenderer from './renderer.js';

const urlParams = new URLSearchParams(window.location.search);
const fractal = urlParams.get('fractal') || 'mandelbulb';

const fragmentShader = fragmentShaders[fractal];

const controlsMap = {
    klein: [0.0005]
}

const currentControls = controlsMap[fractal]
let controller;
if (currentControls){
    controller = new PlayerControls(currentControls)
} else {
    controller = new PlayerControls()
}

const maxPerformance = 4;

const init = (initialPerformance, autoAdjust) => {
    // performance level n renders at 1/(2 ** n) resolution and refines over subsequent frames
    let performance = initialPerformance;
    let canvas = document.querySelector('canvas');
    if (canvas) {
        canvas.remove();
    }
    canvas = document.createElement('canvas');
    document.querySelector('.container').appendChild(canvas);
    // resize to a multiple of the largest repeat to prevent rounding errors
    const maxRepeat = 2 ** (maxPerformance - 1);
    const width = window.innerWidth - (window.innerWidth % maxRepeat);
    const height = window.innerHeight - (window.innerHeight % maxRepeat);
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("webgl", {
        preserveDrawingBuffer: true,
        desynchronized: true,
    });

    const regl = Regl(context); // no params = full screen canvas

    const renderer = setupRenderer({
        frag: fragmentShader,
        regl,
        width,
        height,
        maxPerformance,
    });

    // This essentially checks if the state has changed by doing a deep equals
    // If there are changes, it returns a new object so in other places, we can just check if the references are the same
    const getCurrentState = (() => {
        let current;
        return () => {
            const newState = controller.state;
            if (JSON.stringify(current) !== JSON.stringify(newState)) {
                current = newState;
            }
            return current;
        }
    })();

    // Automatically lower or raise the resolution of each render step to stay between 60 and 120 fps
    let avgFrameTime = 1000 / 60;
    const numSamples = 20;
    let measuredFrames = 0;
    const autoAdjustInterval = 600;
    function adjustPerformance(frameTime) {
        avgFrameTime = ((numSamples - 1) * avgFrameTime + frameTime) / numSamples;
        measuredFrames++;
        if (!autoAdjust || measuredFrames % autoAdjustInterval !== 0) return;
        const fps = 1000 / avgFrameTime;
        if (fps > 120) {
            performance = Math.max(0, performance - 1);
        } else if (fps < 60) {
            performance = Math.min(maxPerformance - 1, performance + 1);
        }
    }

    let bail = false;
    let frameCallback = null;
    let state = null;
    let step = 0;
    function loop() {
        if (bail) {
            renderer.regl.destroy();
            return;
        }
        const start = Date.now();
        const newState = getCurrentState();
        if (newState !== state) {
            state = newState;
            step = 0;
            if (frameCallback) {
                frameCallback(state);
            }
        }

        if (step < renderer.getStepCount(performance)) {
            const fbo = renderer.renderStep(state, performance, step);
            renderer.drawToCanvas({ texture: fbo });
            // reading a pixel forces gl to finish drawing, so the measured frame time is accurate
            fbo.use(() => regl.read({ width: 1, height: 1 }));
            step++;
            adjustPerformance(Date.now() - start);
        }

        requestAnimationFrame(loop);
    }
    loop();

    return {
        stop: () => {
            bail = true;
        },
        getFrameStates: callback => {
            frameCallback = callback;
        },
    }
}


let perf = 1;
let autoAdjust = true;
let instance = init(perf, autoAdjust);
// reinit on resize
window.addEventListener('resize', () => {
    instance.stop();
    instance = init(perf, autoAdjust);
});

let recording = false;
let frames = [];
document.addEventListener('keydown', e => {
    if (['1', '2', '3', '4'].some(p => p === e.key)) {
        // manually selecting a quality level disables automatic adjustment
        instance.stop();
        perf = parseInt(e.key) - 1;
        autoAdjust = false;
        instance = init(perf, autoAdjust);
    }
    if (e.key === 'r') {
        // record
        // renderSingleFrame(controller.state);
        if (!recording) {
            frames = [];
            instance.getFrameStates((state) => frames.push({ time: Date.now(), state }));
        } else {
            console.log(frames);
            fetch(`http://localhost:3000/render/${fractal}`, {
                headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json'
                },
                method: 'post',
                body: JSON.stringify({ frames }),
            }).then(console.log);
            frames = [];
        }
        recording = !recording;
    }
})
