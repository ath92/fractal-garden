import passThroughVert from './pass-through-vert.glsl';
import upSampleFrag from './upsample.glsl';

function setupRenderer({
    frag,
    regl,
    repeat = [1, 1],
    offsets = [],
    width,
    height,
}) {
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
        frag,
        vert: passThroughVert.replace("#define GLSLIFY 1", ""),
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
        vert: passThroughVert.replace("#define GLSLIFY 1\n", ""),
        frag: `
            precision highp float;
            uniform sampler2D inputTexture;
            varying vec2 uv;
    
            void main () {
              vec4 color = texture2D(inputTexture, uv * 0.5 + 0.5);
            //   vec4 color = vec4(uv.x, uv.y, 0, 1);
              gl_FragColor = color;
            }
        `,
        uniforms: {
            inputTexture: regl.prop('texture'),
        },
        attributes: {
            position
        },
        count: 6,
    });
    
    const upSample = regl({
        vert: passThroughVert.replace("#define GLSLIFY 1\n", ""),
        frag: upSampleFrag.replace("#define GLSLIFY 1\n", ""),
        uniforms: {
            inputSample: regl.prop('sample'), // sampler2D
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
            // console.log("hier moet het eigenlijk 255 zijn", regl.read());
        });
        yield fbo;
        
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

    return {
        regl,
        drawToCanvas, // will draw fbo to canvas (or whatever was given as regl context)
        generateRenderSteps, // generator that yields FBOs, that can be drawn to the canvas
    }
}

export default setupRenderer;
