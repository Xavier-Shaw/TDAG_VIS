
export default class Edge {
    /** @type {string}*/
    id

    /** @type {Node}*/
    srcNode

    /** @type {Node}*/
    dstNode

    /** @type {VirtualEdge[]}*/
    virtualEdges = []

    /**
     *
     * @param {Node} src
     * @param {Node} dst
     */
    constructor(src, dst) {
        this.id = this.getEdgeId(src, dst)
        this.srcNode = src
        this.dstNode = dst
    }

    /**
     *
     * @param {Node} src
     * @param {Node} dst
     * @returns {string}
     */
    getEdgeId(src, dst) {
        return src.id + '-' + dst.id
    }
}
