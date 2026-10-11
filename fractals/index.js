// maps fractal name (directory name) to the source of its fragment shader
const modules = import.meta.glob('./*/frag.glsl', { query: '?raw', import: 'default', eager: true });

const fragmentShaders = Object.fromEntries(
    Object.entries(modules).map(([path, source]) => [path.split('/')[1], source])
);

export default fragmentShaders;
