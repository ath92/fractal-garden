import Regl from 'regl';
import frag from './frag.glsl';
import passThroughVert from './pass-through-vert.glsl';
import PlayerControls from './player-controls';
import { mat4, vec3 } from 'gl-matrix';

const playerControls = new PlayerControls();

playerControls.onPointerLock = val => {
    const message = document.querySelector('.message');
    if (val && message) {
        message.remove();
    }
}

const regl = Regl({
    // pixelRatio: Math.min(1, 1600 * 900 / (window.innerWidth * window.innerHeight)),
    // 720p should be enough for most intents and purposes, above that performance suffers
}); // no params = full screen canvas

// ping pong fbo
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

let getSDFFBO = createPingPongBuffers({
    width: Math.round(window.innerWidth / 3),
    height: Math.round(window.innerHeight / 3)
});

let getScreenFBO = createPingPongBuffers({
    width: Math.round(window.innerWidth),
    height: Math.round(window.innerHeight)
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
    },
    attributes: {
        position
    },
    count: 6,
});

// render texture to screen
const drawTexture = regl({
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
        varying vec2 uv; // ranging from (-1, -1) to (1, 1)

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

function* generateRenderSteps({ cameraDirection, cameraPosition }){
    const repeat = [3, 3];

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
        drawTexture({ texture: fbo });
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

    const offsets = [
        [2, 2],
        [0, 2],
        [2, 0],
        [1, 1],
        [1, 0],
        [0, 1],
        [2, 1],
        [1, 2]
    ]

    for (let offset of offsets) {
        currentScreenBuffer = performUpSample(currentScreenBuffer, offset);
        yield currentScreenBuffer;
    }
    // also return the current screenbuffer so the last next() on the generator still gives a reference to what needs to be drawn
    return currentScreenBuffer;
};

// This controls the FPS (not in an extremely precise way, but good enough)
// 60fps + 2ms timeslot for drawing to canvasx
const threshold = 1000 / 60 - 2;

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
    (function step() {
        const { value: fbo, done } = render.next();

        if (done) {
            drawTexture({
                texture: fbo
            });
            pollForChanges(onEnterFrame);
            return;
        }

        const now = performance.now();
        const newState = getCurrentState();
        const stateHasChanges = newState !== state;
        if (stateHasChanges && now - start > threshold) {
            // out of time, draw to screen
            drawTexture({
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
        width: Math.round(window.innerWidth / 2),
        height: Math.round(window.innerHeight / 2)
    });
    
    getScreenFBO = createPingPongBuffers({
        width: Math.round(window.innerWidth),
        height: Math.round(window.innerHeight)
    });
});
