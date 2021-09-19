import Regl from "regl";
import fragmentShaders from './fractals/**/frag.glsl';
import PlayerControls from './player-controls';
import setupRenderer from './renderer';
import 'setimmediate';

const urlParams = new URLSearchParams(window.location.search);
const fractal = urlParams.get('fractal') || 'mandelbulb';

const fragmentShader = fragmentShaders[fractal];

const controlsMap = {
    klein: [0.001]
}

const controller = new PlayerControls(...(controlsMap[fractal] || {}));

const getRenderSettings = (performance) => {
    // On small screens, we do less upsampling, to reduce the amount of overhead introduced
    if (window.innerWidth <= 800) {
        return {
            repeat: [2, 2],
            offsets: [
                [1, 1],
                [0, 1],
                [1, 0]
            ]
        };
    }
    // For larger screens
    // The render function is divided into a certain number of steps. This is done horizontally and vertically;
    // In each step 1/(x*y)th (1/x horizontal and 1/y vertical) of all pixels on the screen are rendered
    // If there is not enough time left to maintain a reasonable FPS, the renderer can bail at any time after the first step.
    if (performance === 1) return {
        repeat: [1, 1],
        offsets: [],
    };

    if (performance === 2) return {
        repeat: [2, 2],
        offsets: [
            [1, 1],
            [0, 1],
            [1, 0]
        ],
    };
    
    // Each render step gets an offset ([0, 0] in the first, mandatory step)
    // This controls what pixels are used to draw each render step
    if (performance === 3) return {
        repeat: [3, 3],
        offsets: [
            [2, 2],
            [0, 2],
            [2, 0],
            [1, 1],
            [1, 0],
            [0, 1],
            [2, 1],
            [1, 2]
        ],
    };

    return {
        repeat: [4, 4],
        offsets: [
            [2, 2],
            [3, 0],
            [0, 3],
            [1, 1],
            [3, 3],
            [2, 1],
            [1, 2],
            [1, 0],
            [3, 1],
            [2, 3],
            [0, 2],
            [2, 0],
            [3, 2],
            [1, 3],
            [0, 1]
        ],
    }
}

const init = (performance) => {
    const { repeat, offsets } = getRenderSettings(performance);
    let canvas = document.querySelector('canvas');
    if (canvas) {
        canvas.remove();
    }
    canvas = document.createElement('canvas');
    document.querySelector('.container').appendChild(canvas);
    // resize to prevent rounding errors
    let width = window.innerWidth;
    let height = Math.min(window.innerHeight, Math.floor(width * (window.innerHeight / window.innerWidth)));
    while (width % repeat[0]) width--;
    while (height % repeat[1]) height--;
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
        repeat,
        offsets,
        width,
        height,
    });
    
    // This controls the FPS (not in an extremely precise way, but good enough)
    // 60fps + 4ms timeslot for drawing to canvas and doing other things
    const threshold = 1000 / 120;
    
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
    
    // In order to check if the state has changes, we poll the player controls every frame.
    // TODO: refactor this so state changes automatically schedules re-render
    function pollForChanges(callbackIfChanges, lastFBO) {
        const currentState = getCurrentState();
        (function checkForChanges() {
            // TODO: not sure why it is necessary to re-draw the last fbo here.
            // Sometimes the last FBO is not drawn in the render step.
            renderer.drawToCanvas({ texture: lastFBO });
            const newState = getCurrentState();
            if (newState !== currentState) {
                callbackIfChanges(newState);
            } else {
                requestAnimationFrame(checkForChanges);
            }
        })();
    }

    let bail = false;
    let frameCallback = null;
    function onEnterFrame(state) {
        if (bail) {
            renderer.regl.destroy();
            return;
        }
        if (frameCallback) {
            frameCallback(state);
        }
        const start = Date.now();
        const render = renderer.generateRenderSteps(state);
        let i = 0;
        (function step() {
            regl.clear({
                depth: 1,
            });
            i++;
            const { value: fbo, done } = render.next();
            const now = Date.now();
    
            if (done) {
                console.log("frametime",now-start)
                renderer.drawToCanvas({ texture: fbo });
                pollForChanges(onEnterFrame, fbo);
                return;
            }
    
            const newState = getCurrentState();
            const stateHasChanges = newState !== state;
            if (now - start > threshold) {
                // out of time, draw to screen
                renderer.drawToCanvas({ texture: fbo });
                // console.log(i); // amount of render steps completed
                if (stateHasChanges) {
                    requestAnimationFrame(() => onEnterFrame(newState));
                    return;
                }
            }
            setImmediate(step, 0);
        })();
    }
    onEnterFrame(getCurrentState());

    return {
        stop: () => {
            bail = true;
        },
        getFrameStates: callback => {
            frameCallback = callback;
        },
    }
}


let perf = 2;
let instance = init(perf);
// reinit on resize
window.addEventListener('resize', () => {
    instance.stop();
    instance = init(perf);
});

let recording = false;
let frames = [];
document.addEventListener('keydown', e => {
    if (['1', '2', '3', '4'].some(p => p === e.key)) {
        instance.stop();
        perf = parseInt(e.key);
        instance = init(perf);
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
