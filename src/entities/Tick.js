export default class Tick {

    /** @type {(number|string)} */
    id

    /** @type {number} */
    rank

    /** @type {number} */
    position

    constructor(id, position) {
        this.id = id
        this.position = position
    }

}