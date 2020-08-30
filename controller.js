import PlayerControls from './player-controls';

class Controller {
    constructor() {
        Object.assign(this, {
            scroll: 0,
        });
        this.playerControls = new PlayerControls();
        window.addEventListener("wheel", e => {
            this.scroll += e.deltaY / 1000;
        });
    }

    get state() {
        return {
            scroll: this.scroll,
            cameraPosition: [...this.playerControls.position],
            cameraDirection: this.playerControls.directionMatrix,
        }
    }
}

export default Controller;