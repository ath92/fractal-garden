
<h1 align="center">Fractal.garden</h1>
<p align="center">
  <a href="https://fractal.garden">Explore fractals in your browser in real time</a>
  <br />
  <br />    
  <img src="readme.gif" alt="animated" />
</p>

Fractal.garden is an interactive 3d fractal explorer. The fractals are rendered using a technique called [raymarching](https://www.iquilezles.org/www/articles/raymarchingdf/raymarchingdf.htm). The images are rendered at mostly acceptable framerates using WebGL (through a library called [regl](https://github.com/regl-project/regl)). To ensure that framerates stay interactive, images can be set to render at a lower resolution first, after which multiple lower-resolution images are sequentially combined into a full-resolution end result. If the renderer runs out of time while generating a frame, it can render one of the intermediate steps. This means it prioritizes interactivity over image quality.

This project also contains a headless rendering server, which can turn a set of frame states (each of which contains exactly the state needed to render an image) into a set of png images, one per frame. These can then be combined into a video (or the gif in this readme) using ffmpeg. Note that this server is quite unoptimized, so it takes a long time to render everything (i.e. much longer than the renderer in the browser would).