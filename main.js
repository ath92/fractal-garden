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

const getSDFFBO = createPingPongBuffers({
    width: Math.round(window.innerWidth / 2),
    height: Math.round(window.innerHeight / 2)
});

const getScreenFBO = createPingPongBuffers({
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
        precision mediump float;
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
        precision mediump float;
        uniform sampler2D sample;
        uniform sampler2D previous;
        uniform vec2 offset;
        uniform vec2 repeat;
        varying vec2 uv;

        const vec2 pixelOffset = vec2(0.5, 0.5);

        float getMixFactor () {
            vec2 position = gl_FragCoord.xy - pixelOffset + offset;
            vec2 rest = mod(position, repeat);
            return 1. - min(max(rest.x, rest.y), 1.);
        }

        void main () {
            // if we're in one of the "useSample" pixels:
            // gl_FragColor = texture2D(sample, uv * 0.5 + 0.5);
            // if not:
            // gl_FragColor = texture2D(previous, uv * 0.5 + 0.5);

            vec4 previousColor = texture2D(previous, uv * 0.5 + 0.5);
            vec4 newColor = texture2D(sample, uv * 0.5 + 0.5);

            gl_FragColor = mix(previousColor, newColor, getMixFactor());
        }
    `,
    uniforms: {
        sample: regl.prop('sample'), // sampler2D
        previous: regl.prop('previous'), // sampler2D
        repeat: regl.prop('repeat'), // vec2
        offset: regl.prop('offset'), // vec2
    },
    attributes: {
        position
    },
    count: 6,
})

regl.frame(({ time }) => {
    const drawIfOutOfTime = ((threshold) => {
        const start = performance.now();
        return (callbackOutOfTime, callbackStillTime) => {
            if (performance.now() - start > threshold || true) {
                return callbackOutOfTime();
            }
            return callbackStillTime();
        };
    })(1000/60 - 8);

    const fbo = getSDFFBO();
    fbo.use(() => {
        renderSDF({
            color: [1, 0, 0, 1],
            screenSize: [window.innerWidth / 2, window.innerHeight / 2],
            time,
            cameraDirection: playerControls.directionMatrix,
            cameraPosition: playerControls.position,
            offset: [0,0]
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

    // if (currentScreenBuffer) {
    //     const newSampleFBO = getSDFFBO();
    //     newSampleFBO.use(() => {
    //         renderSDF({
    //             color: [1, 0, 0, 1],
    //             screenSize: [texture.width, texture.height],
    //             time,
    //             cameraDirection: playerControls.directionMatrix,
    //             cameraPosition: playerControls.position,
    //             offset: [1,0]
    //         });
    //     });

    //     upSample({
    //         sample: newSampleFBO,
    //         previous: currentScreenBuffer,
    //         repeat: [2, 2],
    //         offset: [1, 0],
    //     });

    //     // if there's still time left for another iteration, 
    //     // don't draw directly to the screen, but into a buffer that can be used for the next iteration instead
    //     // else just draw directly to the screen.
    // }

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
                    offset
                });
            });

            const newScreenBuffer = getScreenFBO();
            newScreenBuffer.use(() => {
                upSample({
                    sample: newSampleFBO,
                    previous: screenBuffer,
                    repeat: [2, 2],
                    offset,
                });
            });
            return newScreenBuffer;
        },
        () => {
            drawTexture({ texture: screenBuffer });
            return null;
        }
    );

    // for (let offset of [[1, 0], [1, 1], [0, 1]]) {
    for (let offset of [[1, 0], [1, 1], [0, 1]]) {
        currentScreenBuffer = upSampleIfTimeLeft(currentScreenBuffer, offset);
        if (!currentScreenBuffer) break;
    }
    drawTexture({ texture: currentScreenBuffer });
    // now we want to use renderSDF again, but with some offset, and then render that to the screen
    // rendering = taking newly drawn FBO, and texture of the full screen, and combining that with the offset
    // need to make sure that previous iterations always render to full screen FBO instead of directly to screen
    // So instead of rendering / not rendering, it should be draw to FBO / draw directly to screen.
    // then drawIfOutOfTime can either return a reference to the FBO it drew to, or null
    // if null, we stop executing for that particular frame, and just continue onto the next one.
    // (and draw whatever is in the fbo to the screen)
});

window.addEventListener('resize', () => {
    texture = regl.texture({
        width: Math.round(window.innerWidth / 2),
        height: Math.round(window.innerHeight / 2)
    });
});
