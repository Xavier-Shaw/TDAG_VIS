export default class Node {
    /** @type {(number|string)} */
    id

    /** @type {string} */
    name

    /** @type {number} */
    startTime

    /** @type {number} */
    endTime

    /** @type {boolean} */
    hasParent = false

    /** @type {Node[]} */
    childNodes = []

    /** @type {Edge[]} */
    inEdges = []

    /** @type {Edge[]} */
    outEdges = []

    /** @type {VirtualNode[]} */
    childVirtualNodes = []

    /** @type {VirtualNode} */
    startVirtualNode

    /** @type {VirtualNode} */
    endVirtualNode

    /** @type {number} */
    y

    /** @type {number} */
    groupID

    /**
     *
     * @param {(number|string)} id
     * @param {string} name
     * @param {number} startTime
     * @param {number} endTime
     */
    constructor(id, name, startTime, endTime) {
        this.id = id
        this.name = name
        this.startTime = startTime
        this.endTime = endTime
    }

}
