import Regl from 'regl';
import frag from './mandelbulb.glsl';
import passThroughVert from './pass-through-vert.glsl';
import upSampleFrag from './upsample.glsl';
import PlayerControls from './player-controls';
import { mat4, vec3 } from 'gl-matrix';
import 'setimmediate';

const playerControls = new PlayerControls();

function init(count) {
    // The render function is divided into 9 steps;
    // In each step 1/9th (1/3rd horizontal and 1/3 vertical) of all pixels on the screen are rendered
    // If there is not enough time left to maintain a reasonable FPS, the renderer can bail at any time after the first step.
    const repeat = [3, 3];
    
    // Each render step gets an offset ([0, 0] in the first, mandatory step)
    // This controls what pixels are used to draw each render step
    const offsets = [
        [2, 2],
        [0, 2],
        [2, 0],
        [1, 1],
        [1, 0],
        [0, 1],
        [2, 1],
        [1, 2]
    ];
    
    // This controls the FPS (not in an extremely precise way, but good enough)
    // 30fps + 4ms timeslot for drawing to canvas and doing other things
    const threshold = 1000 / 30 - 4;
    
    playerControls.onPointerLock = () => {
        document.body.classList.toggle('has-pointer-lock');
    };
    
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
            onlyDistance: regl.prop('onlyDistance'),
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
    function* generateRenderSteps({ cameraDirection, cameraPosition }){
        const fbo = getSDFFBO();
        fbo.use(() => {
            renderSDF({
                screenSize: [width / repeat[0], height / repeat[1]],
                cameraDirection,
                cameraPosition,
                offset: [0,0],
                repeat,
                onlyDistance: false,
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
                    cameraDirection,
                    cameraPosition,
                    offset,
                    repeat,
                    onlyDistance: false,
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
            const newState = {
                cameraDirection: playerControls.directionMatrix,
                cameraPosition: vec3.copy(vec3.create(), playerControls.position),
            };
            if (!current
                || !mat4.equals(current.cameraDirection, newState.cameraDirection)
                || !vec3.equals(current.cameraPosition, newState.cameraPosition)) {
                current = newState;
            }
            return current; 
        }
    })();
    
    // In order to check if the state has changes, we poll the player controls every frame.
    // TODO: refactor this to a more functional approach
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

    let stop = false;
    
    function onEnterFrame(state) {
        console.log(count);
        const start = performance.now();
        const render = generateRenderSteps(state);
        let i = 0;
        (function step() {
            if (stop) return;
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

    return () => {
        stop = true;
        regl.destroy();
    }
}

let stopCurrentLoop = init(0);
let count = 1;
// reinit on resize
window.addEventListener('resize', () => {
    stopCurrentLoop();
    stopCurrentLoop = init(count);
    count++;
});
