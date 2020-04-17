# Raymarching fractals using regl

[demo](http://regl-raymarching.netlify.com)

This is an experiment around raymarched 3d fractals, as popularized by [Inigo Quilez](https://www.iquilezles.org/). I'm using regl as an abstraction on top of webgl, which makes things a lot simpler.

To get started, all we need to do is to create a regl function, which will create a 'scene' for us, with nothing more than two triangles, each of which fill half the screen. The vertex shader is very simple (just a pass-through really). All the magic happens in the fragment shader (i.e. the actual rendering of the fractals).

I also added a rather simple player controls class that allows the user to move through the scene using mouse/keyboard and/or touch controls.
