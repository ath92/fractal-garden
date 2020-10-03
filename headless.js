import fragmentShader from './mandelbulb.glsl';
import setupRenderer from './renderer.js';
import headlessGL from "gl";

const setup = (width = 1000, height = 1000) => {
    const repeat = [1, 1];
    const offsets = [];
    const container = headlessGL(width, height, { preserveDrawingBuffer: true });

    const renderer = setupRenderer({
        frag: fragmentShader.replace("#define GLSLIFY 1", ""),
        reglContext: container,
        repeat,
        offsets,
        width,
        height,
    });

    const renderFrame = (state) => {
        const steps = renderer.generateRenderSteps(state);
        let step = steps.next();
        while (!step.done) { // this shouldn't be necessary since we shouldn't be generating more than one render step
            step = steps.next();
        }
        const fbo = step.value;
        renderer.drawToCanvas({ texture: fbo });
        console.log(renderer.regl.read());

       return renderer.regl.read();
    }

    const renderFrames = (frames, fps = 60) => {
        const first = frames[0];
        const last = frames[frames.length - 1];
        const timespan = (last.time - first.time) / 1000;
        const numFrames = Math.ceil(timespan / (1000 / fps));

        const outputs = [];

        for (let i = 0; i < numFrames; i++) {
            const time = i * (1000 / fps);
            const startFrameIndex = frames.findIndex((frame) => frame.time - first.time >= time);
            if (startFrameIndex === -1) break;
            console.log(startFrameIndex);
            const startFrame = frames[startFrameIndex];
            
            // now interpolate all state
            // const endFrame = frames[startFrameIndex + 1] || startFrame;
            // const progress = (time - startFrame.time) / (endFrame.time - startFrame.time);
            // For now, just take start frame and don't interpolate because it requires some refactoring
            // i.e. use quaternion instead of direction matrix so interpolation is easier
            // console.log(startFrame.state);
            outputs.push(renderFrame(startFrame.state));
        }
        return outputs//.map(image => image.filter(Boolean));
    }

    return { 
        renderFrame,
        renderFrames,
    };
};

export default setup;
