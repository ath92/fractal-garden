import Regl from 'regl';
import frag from './frag.glsl';
import passThroughVert from './pass-through-vert.glsl';
import PlayerControls from './player-controls';

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
    width: Math.round(window.innerWidth / 2),
    height: Math.round(window.innerHeight / 2)
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
        color: regl.prop('color'),
        screenSize: regl.prop('screenSize'),
        time: regl.prop('time'),
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
            // if we're in one of the "useSample" pixels:
            // gl_FragColor = texture2D(sample, uv * 0.5 + 0.5);
            // if not:
            // gl_FragColor = texture2D(previous, uv * 0.5 + 0.5);

            vec2 pixel = gl_FragCoord.xy - vec2(0.5);
            pixel = pixel / screenSize;


            vec4 previousColor = texture2D(previous, pixel);
            vec4 newColor = texture2D(sample, pixel);
            // newColor = vec4((newColor - previousColor).xyz, 1);
            // newColor = vec4(uv * 0.5 + 0.5, 0, 1);

            // gl_FragColor = vec4((newColor - previousColor).xyz, getMixFactor());

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
})

regl.frame(({ time }) => {
    const drawIfOutOfTime = ((threshold) => {
        const start = performance.now();
        return (callbackStillTime, callbackOutOfTime) => {
            const timePassed = performance.now() - start;
            if (timePassed > threshold) {
                console.log('ran out of time :(');
                return callbackOutOfTime();
            }
            return callbackStillTime();
        };
    })(1000/30 - 1); // threshold = 30fps - 1ms for drawing to screen

    const fbo = getSDFFBO();
    fbo.use(() => {
        renderSDF({
            color: [1, 0, 0, 1],
            screenSize: [window.innerWidth / 2, window.innerHeight / 2],
            time,
            cameraDirection: playerControls.directionMatrix,
            cameraPosition: playerControls.position,
            offset: [0,0],
            repeat: [2, 2],
        });
    });

    let currentScreenBuffer = drawIfOutOfTime(
        () => {
            const screenFBO = getScreenFBO();
            screenFBO.use(() => {
                drawTexture({ texture: fbo });
            });
            return screenFBO;
        },
        () => {
            drawTexture({ texture: fbo });
            return null;
        },
    );

    const upSampleIfTimeLeft = (screenBuffer, offset) => drawIfOutOfTime(
        () => {
            const newSampleFBO = getSDFFBO();
            newSampleFBO.use(() => {
                renderSDF({
                    color: [1, 0, 0, 1],
                    screenSize: [window.innerWidth / 2, window.innerHeight / 2],
                    time,
                    cameraDirection: playerControls.directionMatrix,
                    cameraPosition: playerControls.position,
                    offset,
                    repeat: [2, 2],
                });
            });

            const newScreenBuffer = getScreenFBO();
            newScreenBuffer.use(() => {
                upSample({
                    sample: newSampleFBO,
                    previous: screenBuffer,
                    repeat: [2, 2],
                    offset,
                    screenSize: [window.innerWidth, window.innerHeight],
                });
            });
            return newScreenBuffer;
        },
        () => {
            drawTexture({ texture: screenBuffer });
            return null;
        }
    );

    for (let offset of [[1, 1], [0, 1], [1, 0]]) {
        if (!currentScreenBuffer) break;
        currentScreenBuffer = upSampleIfTimeLeft(currentScreenBuffer, offset);
    }
    
    // in case we haven't done an early exit yet: draw last screenbuffer to canvas
    if (currentScreenBuffer) {
        drawTexture({ texture: currentScreenBuffer });
    }
});

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
