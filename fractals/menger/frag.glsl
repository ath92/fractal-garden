precision highp float;
uniform vec2 screenSize;
uniform vec2 offset;
uniform vec2 repeat;
uniform vec3 cameraPosition;
uniform mat4 cameraDirection;
uniform float scrollX;
uniform float scrollY;

const int MAX_ITER = 128;
const float HIT_THRESHOLD = 0.0001;
const float variance = 0.01;
// const float PI = 3.14159265359;

mat3 rotmat = mat3(
    1, 0, 0,
    0, cos(scrollX), sin(scrollX),
    0, -sin(scrollX), cos(scrollX)
);

vec3 getRay() {
    vec2 normalizedCoords = gl_FragCoord.xy - vec2(0.5) + (offset / repeat);
    vec2 pixel = (normalizedCoords - 0.5 * screenSize) / min(screenSize.x, screenSize.y);

    // as if the higher the pixel value, the more the offset is being applied
    // normalize to get unit vector
    return (cameraDirection * normalize(vec4(pixel.x, pixel.y, 1, 0))).xyz;
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

const int MENGER_ITERATIONS = 7;
float menger(vec3 p, float b, float h) {
    float box = box(p, b);
    float holes = makeHoles(p, h);
    float scale = h;
    for (int i = 0; i < MENGER_ITERATIONS; i++) {
        p = rotmat * p + vec3(-2. * scale, -2. * scale, -2. * scale);
        holes = max(holes, makeHoles(opRepeat(p, vec3(2. * scale)), h * scale));
        scale = scale * h;
    }
    return max(box, holes);
}

float doModel(vec3 p) {
    return menger(
        opRepeat(p, vec3(10.)),
        3.,
        1. / 3. + scrollY / 10.
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
    // gl_FragColor = vec4(offset / (repeat - vec2(1)), 0, 1);
    // return;

    float brightness = 0.;
    int iterations;
    vec3 collision = trace(cameraPosition * 20., direction, iterations);
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