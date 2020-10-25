import Regl from "regl";
import fragmentShaders from './fractals/**/frag.glsl';
// import frag from './mandelbulb.glsl';
import passThroughVert from './pass-through-vert.glsl';
import headlessGL from "gl";

const setup = (fractal = 'mandelbulb', width = 1000, height = 1000) => {
    const fragmentShader = fragmentShaders[fractal];

    const repeat = [1, 1];
    const offsets = [];

    // const renderFrame = (state) => {
    //     const steps = renderer.generateRenderSteps(state);
    //     let step = steps.next();
    //     while (!step.done) { // this shouldn't be necessary since we shouldn't be generating more than one render step
    //         step = steps.next();
    //     }
    //     const fbo = step.value;
    //     renderer.drawToCanvas({ texture: fbo });
    //     console.log(renderer.regl.read());

    //    return renderer.regl.read();
    // }
    const context = headlessGL(width, height, { preserveDrawingBuffer: true });
    const regl = Regl(context);

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
        frag: fragmentShader,
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

    const renderFrame = (state) => {
        regl.clear({
            depth: 1,
        });

        renderSDF({
            ...state,
            repeat,
            offset: [0, 0],
            screenSize: [width, height]
        });
        return regl.read();
    }

    function* renderFrames(frames, fps = 60) {
        const first = frames[0];
        const last = frames[frames.length - 1];
        const timespan = (last.time - first.time);
        console.log("timespan:", timespan)
        const numFrames = Math.ceil(timespan / (1000 / fps));
        for (let frame of frames) {
            yield renderFrame(frame.state);
        };

        // for (let i = 0; i < numFrames; i++) {
        //     const time = i * (1000 / fps);
        //     const startFrameIndex = frames.findIndex((frame) => frame.time - first.time >= time);
        //     if (startFrameIndex === -1) break;
        //     console.log(startFrameIndex);
        //     const startFrame = frames[startFrameIndex];
            
        //     // now interpolate all state
        //     // const endFrame = frames[startFrameIndex + 1] || startFrame;
        //     // const progress = (time - startFrame.time) / (endFrame.time - startFrame.time);
        //     // For now, just take start frame and don't interpolate because it requires some refactoring
        //     // i.e. use quaternion instead of direction matrix so interpolation is easier
        //     // console.log(startFrame.state);
        //     yield renderFrame(startFrame.state);
        // }
    }

    return { 
        renderFrame,
        renderFrames,
    };
};

export default setup;
