precision highp float;
uniform vec2 screenSize;
uniform vec2 offset;
uniform vec2 repeat;
uniform float time;
uniform vec3 cameraPosition;
uniform mat4 cameraDirection;

const int MAX_ITER = 128;
const float HIT_THRESHOLD = 0.001;
const float variance = 0.01;
// const float PI = 3.14159265359;


vec3 getRay() {
    vec2 normalizedCoords = gl_FragCoord.xy - vec2(0.5) + (offset / repeat);
    vec2 pixel = (normalizedCoords - 0.5 * screenSize) / min(screenSize.x, screenSize.y);

    // as if the higher the pixel value, the more the offset is being applied
    // normalize to get unit vector
    return (cameraDirection * normalize(vec4(pixel.x, pixel.y, 1, 0))).xyz;
}

vec3 zRotate(vec3 p, float zRotationRads) {
    float cosTheta = cos(zRotationRads);
    float sinTheta = sin(zRotationRads);
    mat3 rotation = mat3(
        1, 0, 0,
        0, cosTheta, -sinTheta,
        0, sinTheta, cosTheta
    );
    return rotation * p;
}

vec3 xMirror(vec3 p) {
    return vec3(abs(p.x), p.y, p.z);
}

vec3 yMirror(vec3 p) {
    return vec3(p.x, abs(p.y), p.z);
}

vec3 zMirror(vec3 p) {
    return vec3(p.x, p.y, abs(p.z));
}


vec3 opRepeat(vec3 p, vec3 distance) {
    return mod(p + 0.5 * distance, distance) - 0.5 * distance;
}

float trunk(vec3 p, vec2 xz, float b) {
    vec3 nearest = vec3(xz.x, p.y, xz.y);
    return distance(nearest, p) - b;
}

vec3 curl(vec3 p, float k) {
    float c = cos(k*p.y);
    float s = sin(k*p.y);
    mat2  m = mat2(c,-s,s,c);
    return vec3(m*p.xz,p.y);
}

float doModel(vec3 p) {
    vec3 repeated = opRepeat(p, vec3(15., 30., 199.));
    vec3 transformed = zRotate(zMirror(yMirror(repeated)), 1.);
    return trunk(
        curl(p, 0.5),
        vec2(1., 1.),
        1.
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