export default class VirtualEdge {

    /** @type {VirtualNode} */
    startVirtualNode

    /** @type {VirtualNode} */
    endVirtualNode

    /** @type {Edge} */
    realEdge

    /** @type {string} inner / outer */
    edgeType

    constructor(startVirtualNode, endVirtualNode, realEdge = null, edgeType) {
        this.startVirtualNode = startVirtualNode
        this.endVirtualNode = endVirtualNode
        this.realEdge = realEdge
        this.edgeType = edgeType
    }
}
