precision highp float;
uniform vec2 screenSize;
uniform vec2 offset;
uniform vec2 repeat;
uniform float time;
uniform vec3 cameraPosition;
uniform mat4 cameraDirection;
uniform bool onlyDistance;
uniform float scrollX;
uniform float scrollY;

const float hitThreshold = 0.00015;
const int MAX_ITER = 200;

const vec3 spaceRepetition = vec3(3.5);

vec3 getRay() {
    vec2 normalizedCoords = gl_FragCoord.xy - vec2(0.5) + (offset / repeat);
    vec2 pixel = (normalizedCoords - 0.5 * screenSize) / min(screenSize.x, screenSize.y);

    // as if the higher the pixel value, the more the offset is being applied
    // normalize to get unit vector
    return (cameraDirection * normalize(vec4(pixel.x, pixel.y, 1, 0))).xyz;
}

vec3 opRepeat(vec3 p, vec3 distance) {
    return mod(p + 0.5 * distance, distance) - 0.5 * distance;
}

float doModel(vec3 p) {
    vec3 pos = opRepeat(p, spaceRepetition);
	vec3 z = pos;
	float dr = 1.;
	float r = 0.0;
	for (int i = 0; i < 10; i++) {
		r = length(z);
		if (r > 4.) break;
		
		// convert to polar coordinates
		float theta = acos(z.z / r);
		float phi = atan(z.y, z.x);
        float power = 12. + sin(scrollY) * 10.;
		dr =  pow(r, power - 1.) * power * dr + 1.5;
		
		// scale and rotate the point
		float zr = pow(r, power);
		theta = theta * power;
		phi = phi * power;
		
		// convert back to cartesian coordinates
		z = zr * vec3(sin(theta) * cos(phi), sin(phi) * sin(theta), cos(theta));
		z += pos;
	}
	return abs(0.5 * log(r) * r / dr);
}
// this is kinda contrived and does a bunch of stuff I'm not using right now, but I'll leave it like this for now
vec3 trace(vec3 origin, vec3 direction, out int iterations) {
    vec3 position = origin;
    float distanceTraveled = 0.;
    mat3 scrollXRotate = mat3(
        1,  sin(scrollX) * 0.05, 0,
        -sin(scrollX) * 0.05, 1, 0,
        0,             0,            1
    );
    for(int i = 0; i < MAX_ITER; i++) {
        iterations = i;
        float d = doModel(position);
        if (d < hitThreshold * distanceTraveled) break;
        position += d * direction;
        direction = scrollXRotate * direction;
        distanceTraveled += d;
    }
    return position;
}

float getIllumination(vec3 collision, int iterations) {
    float occlusionLight = 1. - float(iterations) / float(MAX_ITER);
    return occlusionLight;
}

// const float col = 0.05; // amount of coloring

vec3 hsl2rgb( in vec3 c ) {
    vec3 rgb = clamp( abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );
    return c.z + c.y * (rgb-0.5)*(1.0-abs(2.0*c.z-1.0));
}

vec3 getColor(float it, float d) {
    return hsl2rgb(vec3(
        d,
        0.5,
        1. - pow(it, 0.8)
    ));
}

void main() {
    vec3 direction = getRay();
    // gl_FragColor = vec4(offset / (repeat - vec2(1)), 0, 1);
    // return;

    // gl_FragColor = vec4(opRepeat(cameraPosition, vec3(2.5)), 1);
    // return;

    int iterations;
    vec3 collision = trace(cameraPosition, direction, iterations);
    gl_FragColor = vec4(
        getColor(float(iterations) / float(MAX_ITER), distance(collision, spaceRepetition / 2.)),
        1.
    );
    // gl_FragColor = vec4(1., 0, 0, 1);
    // return;
}