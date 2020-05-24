# Raymarching fractals using regl

[demo](https://fractal.garden)

This is an experiment around raymarched 3d fractals. The goal was to allow users to explore these fractals in realtime at a decent framerate.

To read more about how to generate these fractals using shaders/webgl, check out the articles written by [Inigo Quilez](https://www.iquilezles.org/). In short, we draw two triangles that fill the entire window. After that, we can use a fragment shader to draw the fractal. This is run separately for each pixel, which means we can exploit the GPU to heavily parallelize things. That said, things get more expensive with a larger resolution, so achieving a reasonable framerate at full screen is not trivial.

To get a somewhat better framerate, rendering is broken up into steps. Each step renders the scene at a fraction (e.g. 1/9th) of the final resolution. After each step, the new image and what had already been rendered is combined to produce a higher fidelity image. This is repeated until there is no more time left within a frame, or until the scene has been rendered on full resolution.