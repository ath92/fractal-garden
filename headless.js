import Regl from "regl";
import fragmentShaders from './fractals/**/frag.glsl';
// import frag from './mandelbulb.glsl';
import passThroughVert from './pass-through-vert.glsl';
import headlessGL from "gl";
import { vec3, mat4, quat } from 'gl-matrix';

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
        const numFrames = Math.ceil(timespan / (1000 / fps));
        // for (let frame of frames) {
        //     yield renderFrame(frame.state);
        // };
        console.log("timespan:", timespan, "at", numFrames);
        /**
         * frame 3
         * 48 + firstime
         * 
         */
        for (let i = 0; i < numFrames; i++) {
            const time = i * (1000 / fps) + first.time;
            const endFrameIndex = frames.findIndex((frame) => frame.time >= time);
            if (endFrameIndex === -1) break;
            console.log("State frame", endFrameIndex);
            const endFrame = frames[endFrameIndex];
            
            // now interpolate all state
            const startFrame = endFrameIndex === 0 ? endFrame : frames[endFrameIndex - 1];
            const progress = (time - startFrame.time) / (endFrame.time - startFrame.time);
            console.log("Video frame", progress)
            const scrollX = (1 - progress) * startFrame.state.scrollX + progress * endFrame.state.scrollX;
            const scrollY = (1 - progress) * startFrame.state.scrollY + progress * endFrame.state.scrollY;
            const cameraPosition = vec3.add(vec3.create(), vec3.scale(vec3.create(), startFrame.state.cameraPosition, 1 - progress), vec3.scale(vec3.create(), endFrame.state.cameraPosition, progress));
            const cameraDirectionQuat = quat.add(quat.create(), quat.scale(quat.create(), startFrame.state.cameraDirectionQuat, 1 - progress), quat.scale(quat.create(), endFrame.state.cameraDirectionQuat, progress));
            const cameraDirection = mat4.fromQuat(mat4.create(), cameraDirectionQuat);
            const interpolatedState = {
                scrollX,
                scrollY,
                cameraPosition,
                cameraDirection,
            };
            yield renderFrame(interpolatedState);
        }
    }

    return { 
        renderFrame,
        renderFrames,
    };
};

export default setup;
