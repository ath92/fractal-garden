precision highp float;
uniform vec4 color;
uniform vec2 screenSize;
uniform float time;
uniform vec3 cameraPosition;
uniform mat4 cameraDirection; // mat4 because gl-matrix has nice simple lookAt helper fn

const int MAX_ITER = 128;
const float HIT_THRESHOLD = 0.0001;
const float variance = 0.01;
// const float PI = 3.14159265359;


vec3 getRay() {
    vec2 pixel = (gl_FragCoord.xy - 0.5 * screenSize) / min(screenSize.x, screenSize.y);
    // normalize fragCoord.xy to vec2 ranging from [-1, -1] to [1, 1]
    // normalize to get unit vector
    return (cameraDirection * normalize(vec4(pixel.x, -pixel.y, 1, 0))).xyz;
}

float makeHoles(vec3 p, float h) {
  p = min(abs(p) - h, 0.);
  return max(max(-max(p.z, p.y), -max(p.x, p.z)), -max(p.x, p.y));
}

float box(vec3 p, float b) {
    p = abs(p) - b;
    return length(max(p, 0.0)) + min(max(p.x, max(p.y, p.z)),  0.0);
}

vec3 opRepeat(vec3 p, vec3 distance) {
    return mod(p + 0.5 * distance, distance) - 0.5 * distance;
}

const int MENGER_ITERATIONS = 5;
float menger(vec3 p, float b, float h) {
    float box = box(p, b);
    float holes = makeHoles(p, h);
    float scale = h;
    for (int i = 0; i < MENGER_ITERATIONS; i++) {
        p = p + vec3(-2. * scale, -2. * scale, -2. * scale);
        holes = max(holes, makeHoles(opRepeat(p, vec3(2. * scale)), h * scale));
        scale = scale * h;
    }
    return max(box, holes);
}

float doModel(vec3 p) {
    return menger(
        opRepeat(p, vec3(5.)),
        2.,
        1. / 3. + variance
    );
}
// this is kinda contrived and does a bunch of stuff I'm not using right now, but I'll leave it like this for now
vec3 trace(vec3 origin, vec3 direction, out int iterations) {
    vec3 position = origin;
    for(int i = 0; i < MAX_ITER; i++) {
        iterations = i;
        float d = doModel(position);
        if (d < HIT_THRESHOLD) break;
        position += d * direction;
    }
    return position;
}
// stole this from iq
// vec3 calcNormal(vec3 p) {
//     const float h = 0.0001;
//     const vec2 k = vec2(1,-1);
//     return normalize( k.xyy*doModel( p + k.xyy * h ) + 
//                       k.yyx*doModel( p + k.yyx * h ) + 
//                       k.yxy*doModel( p + k.yxy * h ) + 
//                       k.xxx*doModel( p + k.xxx * h ) );
// }

// vec3 lightDirection = normalize(vec3(1, -1, -1));
float getIllumination(vec3 collision, int iterations) {
    // vec3 n = calcNormal(collision);
    float occlusionLight = 1. - float(iterations) / float(MAX_ITER);
    return occlusionLight;
    // return dot(n, lightDirection);
}

// const float col = 0.05; // amount of coloring

void main() {
    vec3 direction = getRay();

    float brightness = 0.;
    int iterations;
    vec3 collision = trace(cameraPosition, direction, iterations);
    if (iterations < MAX_ITER - 1) { // actual collision
        brightness = getIllumination(collision, iterations);
    }
    gl_FragColor = vec4(
        brightness,
        brightness,
        brightness,
        1.
    );
}