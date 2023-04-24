export default class VirtualNode {

    /** @type {string} */
    id

    /** @type {string} inner / side / edge-anchor / anchor */
    nodeType

    /** @type {number} */
    positionX

    /** @type {Node} */
    realNode

    /** @type {VirtualEdge[]} */
    inVirtualEdges = []

    /** @type {VirtualEdge[]} */
    outVirtualEdges = []

    /** @type {number} */
    tickRank

    /** @type {number} */
    groupID

    userLayer

    edgeAnchorNodes = []

    constructor(id, positionX, tickRank, realNode) {
        this.positionX = positionX
        this.tickRank = tickRank
        this.realNode = realNode
        this.id = id.toString()
            //realNode.id + '-' + realNode.childVirtualNodes.length
    }

}