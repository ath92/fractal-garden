precision highp float;
uniform vec4 color;
uniform vec2 screenSize;
uniform float time;
uniform vec3 cameraPosition;
uniform mat4 cameraDirection; // mat4 because gl-matrix has nice simple lookAt helper fn

const int MAX_ITER = 120;
const float HIT_THRESHOLD = 0.01;

vec3 getRay() {
    // normalize fragCoord.xy to vec2 ranging from [-1, -1] to [1, 1]
    vec2 pixel = (gl_FragCoord.xy - 0.5 * screenSize) / min(screenSize.x, screenSize.y);
    // normalize to get unit vector
    return (cameraDirection * normalize(vec4(pixel.x, -pixel.y, 1, 0))).xyz;
}

float sphere(vec3 p, vec3 c, float radius) { // p = point in space, c = center of sphere
    return distance(c, p) - radius;
}
// not used right now, but gonna leave it in for later maybe
float floor(vec3 p, float y) {
    return y - p.y;
}

// stole this from iq
vec3 opRepeat(vec3 p, vec3 distance) {
    return mod(p + 0.5 * distance, distance) - 0.5 * distance;
}

float doModel(vec3 p) {
    vec3 spherePosition = vec3(0, 0, 0); // cannot change this position combined with opRepeat for now, need to figure out how to fix that.
    float sphereRadius = 1.;
    float sphereRepeat = 6.;

    // this is probably not a proper SDF anymore, but it looks cool
    float sint = 10. * sin(mod(0.15 * time, 6.38));
    vec3 p2 = vec3(p.x + sin(p.z / 10. * 0.1 * sint), p.y + cos(p.z / 10. * 0.1 * sint), p.z);

    return sphere(
        opRepeat(p2, vec3(sphereRepeat)),
        spherePosition,
        1.
    );

    return sphere(p, spherePosition, 1.);
}
// this is kinda contrived and does a bunch of stuff I'm not using right now, but I'll leave it like this for now
vec3 trace(vec3 origin, vec3 direction, out int iterations, out float nearest) {
    vec3 position = origin;
    for(int i = 0; i < MAX_ITER; i++) {
        iterations = i;
        float d = doModel(position);
        nearest = min(d, nearest);
        if (d < HIT_THRESHOLD) break;
        position += d * direction;
    }
    return position;
}
// stole this from iq
vec3 calcNormal(vec3 p) {
    const float h = 0.0001;
    const vec2 k = vec2(1,-1);
    return normalize( k.xyy*doModel( p + k.xyy*h ) + 
                      k.yyx*doModel( p + k.yyx*h ) + 
                      k.yxy*doModel( p + k.yxy*h ) + 
                      k.xxx*doModel( p + k.xxx*h ) );
}

vec3 lightDirection = normalize(vec3(1, -1, -1));
float getIllumination(vec3 collision, int iterations) {
    vec3 n = calcNormal(collision);
    // float occlusionLight = 1. - float(iterations) / float(MAX_ITER);
    return dot(n, lightDirection);
}

void main() {
    vec3 origin = cameraPosition;
    vec3 position = origin;
    vec3 direction = getRay();

    float color = 0.;
    int iterations;
    float nearest;
    vec3 collision = trace(origin, direction, iterations, nearest);
    if (iterations < MAX_ITER - 1) { // actual collision
        color = getIllumination(collision, iterations);
    }
    // some cheeky colors here, because why not
    gl_FragColor = vec4(
        color * 0.5 + 0.5 * sin(collision.x + time),
        color,
        color * 0.5 + 0.5 * sin(collision.z + time),
        1.
    );
}

// lighting and material