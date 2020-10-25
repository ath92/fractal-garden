import { vec3, mat4, quat } from 'gl-matrix';
import getCurrentDistance from './get-speed';

const forward = vec3.fromValues(0, 0, 1);
const backward = vec3.fromValues(0, 0, -1);
const left = vec3.fromValues(-1, 0, 0);
const right = vec3.fromValues(1, 0, 0);

const minSpeed = 0.00005;

function getTouchEventCoordinates(touchEvent) {
    const lastTouch = touchEvent.touches[touchEvent.touches.length - 1];
    return {
        x: lastTouch.clientX,
        y: lastTouch.clientY,
    }
}

export default class PlayerControls {
    constructor(acceleration = 0.00010, friction = 0.12, mouseSensitivity = 0.15, touchSensitivity = 0.012) {
        // TODO: cleanup event listeners
        this.acceleration = acceleration;
        this.friction = friction;
        this.speed = vec3.fromValues(0, 0, 0.01);
        this.mouseSensitivity = mouseSensitivity;
        this.touchSensitivity = touchSensitivity;
        this.position = vec3.fromValues(0, 0, -9);
        this.direction = quat.create();
        this.isPanning = false;
        this.mouseX = 0;
        this.mouseY = 0;
        this.touchX = 0;
        this.touchY = 0;
        this.touchStartX = window.innerWidth / 2;
        this.touchStartY = window.innerHeight / 2;
        this.scrollX = 0;
        this.scrollY = 0;
        this.directionKeys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
        };
        this.sprintMode = false;
        this.isTouching = false;

        this.onPointerLock = () => {};

        this.handleKeyboardEvent = keyboardEvent => {
            const { code, type, shiftKey } = keyboardEvent;
            const value = type === 'keydown';
            if (code === 'KeyW' || code === 'ArrowUp') this.directionKeys.forward = value;
            if (code === 'KeyS' || code === 'ArrowDown') this.directionKeys.backward = value;
            if (code === 'KeyA' || code === 'ArrowLeft') this.directionKeys.left = value;
            if (code === 'KeyD' || code === 'ArrowRight') this.directionKeys.right = value;
            this.sprintMode = shiftKey;

            if (type === 'keydown' && code === 'KeyF') {
                if (!!document.pointerLockElement) {
                    document.exitPointerLock();
                } else {
                    document.querySelector('body').requestPointerLock();
                }
            }
        };

        document.addEventListener('keydown', this.handleKeyboardEvent);
        document.addEventListener('keyup', this.handleKeyboardEvent);

        document.addEventListener('mousedown', (e) => {
            if (e.target.tagName !== 'CANVAS') {
                return;
            }
            this.isPanning = true;
        });

        document.addEventListener('mouseup', (e) => {
            this.isPanning = false;
        });

        document.addEventListener('pointerlockchange', () => {
            this.isPanning = !!document.pointerLockElement;
        }, false);

        document.addEventListener('mousemove', e => {
            if (!this.isPanning && !this.isTouching) return;
            this.hasMovedSinceMousedown = true;
            this.mouseX += e.movementX * this.mouseSensitivity;
            this.mouseY += e.movementY * this.mouseSensitivity;
        });

        document.addEventListener('touchstart', e => {
            this.directionKeys.forward = true;
            this.isTouching = true;
            const { x, y } = getTouchEventCoordinates(e);
            this.touchX = x;
            this.touchY = y;
            this.touchStartX = x;
            this.touchStartY = y;
        });

        document.addEventListener('touchmove', e => {
            const { x, y } = getTouchEventCoordinates(e);
            this.touchX = x;
            this.touchY = y;
        });

        const onTouchOver = () => {
            this.directionKeys.forward = false;
            this.isTouching = false;
        }

        window.addEventListener("wheel", e => {
            this.scrollY += e.deltaY / 5000;
            this.scrollX += e.deltaX / 5000;
        });

        document.addEventListener('touchend', onTouchOver);
        document.addEventListener('touchcancel', onTouchOver);
        document.addEventListener('mouseup', onTouchOver);

        requestAnimationFrame(() => this.loop());
    }
    
    loop() {
        if (this.isTouching) {
            this.mouseX += (this.touchX - this.touchStartX) * this.touchSensitivity;
            this.mouseY += (this.touchY - this.touchStartY) * this.touchSensitivity;
        }
        this.mouseY = Math.min(this.mouseY, 90);
        this.mouseY = Math.max(this.mouseY, -90);

        quat.fromEuler(
            this.direction,
            this.mouseY,
            this.mouseX,
            0
        );
    
        // strafing with keys
        const diff = vec3.create();
        if (this.directionKeys.forward) vec3.add(diff, diff, forward);
        if (this.directionKeys.backward) vec3.add(diff, diff, backward);
        if (this.directionKeys.left) vec3.add(diff, diff, left);
        if (this.directionKeys.right) vec3.add(diff, diff, right);
        // vec3.normalize(diff, diff);
        vec3.transformQuat(diff, diff, this.direction);
        vec3.scale(diff, diff, (this.sprintMode ? 4 : 1) * this.acceleration);
        // const currentDistance = getCurrentDistance(this.position)
        vec3.scale(this.speed, this.speed, 1 - this.friction);
        if (vec3.length(this.speed) < minSpeed) {
            vec3.set(this.speed, 0, 0, 0);
        }
        vec3.add(this.speed, this.speed, diff);
        vec3.add(this.position, this.position, this.speed);
    
        requestAnimationFrame(() => this.loop());
    }

    get state() {
        return {
            scrollX: this.scrollX,
            scrollY: this.scrollY,
            cameraPosition: [...this.position],
            cameraDirection: mat4.fromQuat(mat4.create(), this.direction),
            cameraDirectionQuat: [...this.direction],
        }
    }
}
