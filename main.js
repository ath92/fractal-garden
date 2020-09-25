import Regl from 'regl';
import fragmentShader from './mandelbulb.glsl';
import passThroughVert from './pass-through-vert.glsl';
import upSampleFrag from './upsample.glsl';
import Controller from './controller';
import 'setimmediate';

const controller = new Controller();

let perf = 3;
const getRenderSettings = () => {
    console.log(perf);
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
    if (perf === 1) return {
        repeat: [1, 1],
        offsets: [],
    };

    if (perf === 2) return {
        repeat: [2, 2],
        offsets: [
            [1, 1],
            [0, 1],
            [1, 0]
        ],
    };
    
    // Each render step gets an offset ([0, 0] in the first, mandatory step)
    // This controls what pixels are used to draw each render step
    if (perf === 3) return {
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

function init(frag = fragmentShader) {
    const { repeat, offsets } = getRenderSettings();
    
    // This controls the FPS (not in an extremely precise way, but good enough)
    // 60fps + 4ms timeslot for drawing to canvas and doing other things
    const threshold = 1000 / 60 - 4;
    
    const container = document.querySelector('.container');
    
    // resize to prevent rounding errors
    let width = window.innerWidth;
    let height = window.innerHeight;
    while (width % repeat[0]) width--;
    while (height % repeat[1]) height--;

    container.style.width = `${width}px`;
    container.style.height = `${height}px`;

    
    const regl = Regl(container); // no params = full screen canvas
    
    // The FBO the actual SDF samples are rendered into
    let sdfTexture = regl.texture({
        width: Math.round(width / repeat[0]),
        height: Math.round(height / repeat[1])
    });
    const sdfFBO = regl.framebuffer({ color: sdfTexture });
    const getSDFFBO = () => sdfFBO({ color: sdfTexture });
    
    // We need a double buffer in order to progressively add samples for each render step
    const createPingPongBuffers = textureOptions => {
        const tex1 = regl.texture(textureOptions);
        const tex2 = regl.texture(textureOptions);
        const one = regl.framebuffer({
          color: tex1
        });
        const two = regl.framebuffer({
          color: tex2
        });
        let counter = 0;
        return () => {
            counter++;
            if (counter % 2 === 0) {
                return one({ color: tex1 });
            }
            return two({ color: tex2 });
        }
    };
    
    let getScreenFBO = createPingPongBuffers({
        width,
        height,
    });
    
    // screen-filling rectangle
    const position = regl.buffer([
        [-1, -1],
        [1, -1],
        [1,  1],
        [-1, -1],   
        [1, 1,],
        [-1, 1]
    ]);
    
    const renderSDF = regl({
        context: {
        },
        frag,
        vert: passThroughVert,
        uniforms: {
            screenSize: regl.prop('screenSize'),
            cameraPosition: regl.prop('cameraPosition'),
            cameraDirection: regl.prop('cameraDirection'),
            offset: regl.prop('offset'),
            repeat: regl.prop('repeat'),
            scrollX: regl.prop('scrollX'),
            scrollY: regl.prop('scrollY'),
        },
        attributes: {
            position
        },
        count: 6,
    });
    
    // render texture to screen
    const drawToCanvas = regl({
        vert: passThroughVert,
        frag: `
            precision highp float;
            uniform sampler2D texture;
            varying vec2 uv;
    
            void main () {
              vec4 color = texture2D(texture, uv * 0.5 + 0.5);
              gl_FragColor = color;
            }
        `,
        uniforms: {
            texture: regl.prop('texture'),
        },
        attributes: {
            position
        },
        count: 6,
    });
    
    const upSample = regl({
        vert: passThroughVert,
        frag: upSampleFrag,
        uniforms: {
            sample: regl.prop('sample'), // sampler2D
            previous: regl.prop('previous'), // sampler2D
            repeat: regl.prop('repeat'), // vec2
            offset: regl.prop('offset'), // vec2
            screenSize: regl.prop('screenSize'), // vec2
        },
        attributes: {
            position
        },
        count: 6,
    });
    
    // This generates each of the render steps, to be used in the main animation loop
    // By pausing the execution of this function, we can let the main thread handle events, gc, etc. between steps
    // It also allows us to bail early in case we ran out of time
    function* generateRenderSteps(renderState){
        const fbo = getSDFFBO();
        fbo.use(() => {
            renderSDF({
                screenSize: [width / repeat[0], height / repeat[1]],
                offset: [0,0],
                repeat,
                ...renderState
            });
        });
    
        yield fbo;
        
        // draw 1/4 res SDF FBO to full res FBO
        let currentScreenBuffer = getScreenFBO();
        currentScreenBuffer.use(() => {
            drawToCanvas({ texture: fbo });
        });
    
        const performUpSample = (previousScreenBuffer, offset) => {
            const newSampleFBO = getSDFFBO();
            newSampleFBO.use(() => {
                renderSDF({
                    screenSize: [width / repeat[0], height / repeat[1]],
                    offset,
                    repeat,
                    ...renderState
                });
            });
    
            const newScreenBuffer = getScreenFBO();
            newScreenBuffer.use(() => {
                upSample({
                    sample: newSampleFBO,
                    previous: previousScreenBuffer,
                    repeat,
                    offset,
                    screenSize: [width, height],
                });
            });
            return newScreenBuffer;
        }
    
        for (let offset of offsets) {
            currentScreenBuffer = performUpSample(currentScreenBuffer, offset);
            yield currentScreenBuffer;
        }
        // also return the current screenbuffer so the last next() on the generator still gives a reference to what needs to be drawn
        return currentScreenBuffer;
    };
    
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
            drawToCanvas({ texture: lastFBO });
            const newState = getCurrentState();
            if (newState !== currentState) {
                callbackIfChanges(newState);
            } else {
                requestAnimationFrame(checkForChanges);
            }
        })();
    }

    let bail = false;
    let frameCallback = () => {};
    
    function onEnterFrame(state) {  
        if (bail) {
            regl.destroy();
            return;
        }
        const start = performance.now();
        const render = generateRenderSteps(state);
        let i = 0;
        (function step() {
            const { value: fbo, done } = render.next();
            i++;
    
            if (done) {
                drawToCanvas({ texture: fbo });
                pollForChanges(onEnterFrame, fbo);
                return;
            }
    
            const now = performance.now();
            const newState = getCurrentState();
            const stateHasChanges = newState !== state;
            if (now - start > threshold) {
                // out of time, draw to screen
                drawToCanvas({ texture: fbo });
                frameCallback();
                if (stateHasChanges) {
                    // console.log(i); // amount of render steps completed
                    requestAnimationFrame(() => onEnterFrame(newState));
                    return;
                }
            }
            setImmediate(step, 0);
        })();
    }
    
    onEnterFrame(getCurrentState());

    return {
        regl,
        stop() {
            bail = true;
        },
        startRecording(onFrame) {
            frameCallback = onFrame;
        },
        stopRecording() {
            frameCallback = () => {};
        }
    }
}

let instance = init();
// reinit on resize
window.addEventListener('resize', () => {
    instance.stop();
    instance = init();
});

let isRecording = false;
let mediaRecorder;
document.addEventListener('keydown', e => {
    if (['1', '2', '3', '4'].some(p => p === e.key)) {
        instance.stop();
        perf = parseInt(e.key);
        instance = init();
    }
    if (e.key === 'r') {
        if (!isRecording) {
            isRecording = true;
            const canvas = document.querySelector("canvas");
            const video = document.querySelector("video");
            const stream = canvas.captureStream(60);
            mediaRecorder = new MediaRecorder(stream, {
                videoBitsPerSecond : 25000000,
                mimeType : 'video/webm;codecs="vp9"'
            });
            const chunks = [];
            mediaRecorder.ondataavailable = function(e) {
                console.log(e.data);
              chunks.push(e.data);
            };
            mediaRecorder.onstop = function(e) {
                const blob = new Blob(chunks, { 'type' : 'video/webm' });
                const videoURL = URL.createObjectURL(blob);
                video.src = videoURL;
                video.play()
            };
            mediaRecorder.start();
        } else {
            isRecording = false;
            mediaRecorder.stop();
        }
    }
})
