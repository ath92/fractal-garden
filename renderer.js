import PoissonDisk from 'fast-2d-poisson-disk-sampling';
import passThroughVert from './pass-through-vert.glsl?raw';
import upSampleFrag from './upsample.glsl?raw';

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Each performance level renders the SDF at 1/repeat resolution (repeat = 2 ** level).
// Every render step uses a different sub-pixel offset; the samples are progressively blended into the
// full-resolution screen buffer, so the image keeps refining (and anti-aliasing) while the camera is still.
function setupRenderer({
    frag,
    regl,
    width,
    height,
    maxPerformance = 4,
}) {
    const precisionLevels = Array(maxPerformance).fill(0).map((_, i) => {
        const repeat = 2 ** i;
        const shape = [width / repeat, height / repeat];
        const fbo = regl.framebuffer({
            shape,
            depth: false,
            color: regl.texture({ shape }),
        });

        // Poisson disk sampling gives a uniform-ish but random spread of sub-pixel offsets
        const offsets = new PoissonDisk({
            shape: [repeat, repeat],
            radius: .2,
        }).fill();
        shuffleArray(offsets);
        offsets.unshift([0, 0]);

        return {
            fbo,
            shape,
            repeat,
            offsets,
        };
    });

    // We need a double buffer in order to progressively add samples for each render step
    const createScreenBuffer = () => regl.framebuffer({
        width,
        height,
        depth: false,
        color: regl.texture({
            width,
            height,
            mag: 'nearest',
        }),
    });
    const screenBuffers = [createScreenBuffer(), createScreenBuffer()];
    let pingpong = 0;
    let previous = screenBuffers[1];

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
        framebuffer: regl.prop('target'),
    });

    // render texture to screen
    const drawToCanvas = regl({
        vert: passThroughVert,
        frag: `
            precision highp float;
            uniform sampler2D inputTexture;
            varying vec2 uv;

            void main () {
              gl_FragColor = texture2D(inputTexture, uv * 0.5 + 0.5);
            }
        `,
        uniforms: {
            inputTexture: regl.prop('texture'),
        },
        attributes: {
            position
        },
        count: 6,
        // the canvas keeps its depth buffer between frames (preserveDrawingBuffer), so depth testing would discard every draw after the first
        depth: { enable: false },
    });

    const upSample = regl({
        vert: passThroughVert,
        frag: upSampleFrag,
        uniforms: {
            inputSample: regl.prop('sample'), // sampler2D
            previous: regl.prop('previous'), // sampler2D
            repeat: regl.prop('repeat'), // float
            offset: regl.prop('offset'), // vec2
            step: regl.prop('step'), // float
            screenSize: regl.prop('screenSize'), // vec2
        },
        attributes: {
            position
        },
        count: 6,
        framebuffer: regl.prop('target'),
    });

    const getStepCount = performance => precisionLevels[performance].offsets.length;

    // Renders a single step (one sub-pixel offset) and blends it into the screen buffer.
    // Returns the screen buffer containing the result so far.
    function renderStep(renderState, performance, step) {
        const { fbo, shape, repeat, offsets } = precisionLevels[performance];
        const offset = offsets[step];
        const target = screenBuffers[pingpong];
        pingpong = 1 - pingpong;

        renderSDF({
            ...renderState,
            screenSize: shape,
            offset,
            repeat: [repeat, repeat],
            target: fbo,
        });
        upSample({
            sample: fbo,
            previous,
            offset,
            step,
            repeat,
            screenSize: [width, height],
            target,
        });
        previous = target;
        return target;
    }

    return {
        regl,
        drawToCanvas, // will draw fbo to canvas (or whatever was given as regl context)
        renderStep,
        getStepCount,
    }
}

export default setupRenderer;
