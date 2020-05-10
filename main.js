import Regl from 'regl';
import frag from './frag.glsl';
import passThroughVert from './pass-through-vert.glsl';
import PlayerControls from './player-controls';
import { mat4, vec3 } from 'gl-matrix';

const playerControls = new PlayerControls();

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

playerControls.onPointerLock = val => {
    const message = document.querySelector('.message');
    if (val && message) {
        message.remove();
    }
}

const regl = Regl({}); // no params = full screen canvas

const sdfTexture = regl.texture({
    width: Math.round(window.innerWidth / repeat[0]),
    height: Math.round(window.innerHeight / repeat[1])
});
const getSDFFBO = () => regl.framebuffer({ color: sdfTexture });

// We need a double buffer in order to progressively add samples for each render step
let getScreenFBO = (() => {
    const textureOptions = {
        width: Math.round(window.innerWidth),
        height: Math.round(window.innerHeight)
    };
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
})();

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
    frag: `
        precision highp float;
        uniform sampler2D sample;
        uniform sampler2D previous;
        uniform vec2 offset;
        uniform vec2 repeat;
        uniform vec2 screenSize;

        const vec2 pixelOffset = vec2(0.5, 0.5);

        float getMixFactor () {
            vec2 position = gl_FragCoord.xy - pixelOffset;
            vec2 rest = mod(position, repeat);
            vec2 diff = abs(rest - offset);
            return 1. - min(max(diff.x, diff.y), 1.);
        }

        void main () {
            vec2 pixel = gl_FragCoord.xy / screenSize;

            vec4 previousColor = texture2D(previous, pixel);
            vec4 newColor = texture2D(sample, pixel);

            gl_FragColor = mix(previousColor, newColor, getMixFactor());
        }
    `,
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
            screenSize: [window.innerWidth / repeat[0], window.innerHeight / repeat[1]],
            cameraDirection,
            cameraPosition,
            offset: [0,0],
            repeat,
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
                screenSize: [window.innerWidth / repeat[0], window.innerHeight / repeat[1]],
                cameraDirection,
                cameraPosition,
                offset,
                repeat,
            });
        });

        const newScreenBuffer = getScreenFBO();
        newScreenBuffer.use(() => {
            upSample({
                sample: newSampleFBO,
                previous: previousScreenBuffer,
                repeat,
                offset,
                screenSize: [window.innerWidth, window.innerHeight],
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
function pollForChanges(callbackIfChanges) {
    const currentState = getCurrentState();
    (function checkForChanges() {
        const newState = getCurrentState();
        if (newState !== currentState) {
            callbackIfChanges(newState);
        } else {
            requestAnimationFrame(checkForChanges);
        }
    })();
}

function onEnterFrame(state) {
    const start = performance.now();
    const render = generateRenderSteps(state);
    let i = 0;
    (function step() {
        const { value: fbo, done } = render.next();
        i++;

        if (done) {
            drawToCanvas({
                texture: fbo
            });
            pollForChanges(onEnterFrame);
            return;
        }

        const now = performance.now();
        const newState = getCurrentState();
        const stateHasChanges = newState !== state;
        if (stateHasChanges && now - start > threshold) {
            // console.log(i); // amount of render steps completed
            // out of time, draw to screen
            drawToCanvas({
                texture: fbo
            });
            requestAnimationFrame(() => onEnterFrame(newState));
            return;
        }
        
        // schedule next step on event queue so events can interupt rendering
        setTimeout(step, 0);
    })();
}

onEnterFrame(getCurrentState());

// reinit FBO factories on window resize so the textures get resized appropriately
window.addEventListener('resize', () => {
    getSDFFBO = createPingPongBuffers({
        width: Math.round(window.innerWidth / repeat[0]),
        height: Math.round(window.innerHeight / repeat[1]),
    });
    
    getScreenFBO = createPingPongBuffers({
        width: Math.round(window.innerWidth),
        height: Math.round(window.innerHeight),
    });
});
