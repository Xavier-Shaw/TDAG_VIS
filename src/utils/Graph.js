import Tick from "@/entities/Tick"
import Node from "@/entities/Node"
import Edge from "@/entities/Edge"
import VirtualNode from "@/entities/VirtualNode"
import VirtualEdge from "@/entities/VirtualEdge"
import * as d3 from "d3";

export default class Graph {
    width = 1400
    paddingX = 100
    paddingY = 20
    bar_height = 15
    origin_canvas_height = 300
    greedy_canvas_height = 300
    text_height = 12
    MIN_TIME = 0
    MAX_TIME = 1e9
    MAX_INDEX = 0
    color = d3.scaleOrdinal(d3.schemeCategory10)

    placed_nodes = []

    /** @type {Node[]} */
    nodes = []

    /** @type {Edge[]} */
    edges = []

    /** @type {Map<(number|string), Node>} */
    nodeMap = new Map()

    /** @type {Map<string, Edge>} */
    edgeMap = new Map()

    rowNodeIndex = [[], [], [], [], [], [], [], [], [], [], []]

    /** @type {Tick[]} */
    ticks = []

    /** @type {Map<number, number>} */
    tickMap = new Map()

    /** @type {VirtualNode[]} */
    virtualNodes = []

    /** @type {Map<string, VirtualNode>} */
    virtualNodeMap = new Map()

    /** @type {VirtualEdge[]} */
    virtualEdges = []

    virtualNodeIndex = []

    groups = []

    output_json_map = {nodes: [], edges: [], groups: []}

    constructor() {
    }


    setNode(id, name, startTime, endTime) {
        let node = new Node(id, name, startTime, endTime)
        this.nodes.push(node)
        this.nodeMap.set(node.id, node)
        return node
    }

    setEdge(srcNode_id, dstNode_id) {
        let srcNode = this.nodeMap.get(srcNode_id)
        let dstNode = this.nodeMap.get(dstNode_id)
        srcNode.childNodes.push(dstNode)
        let edge = new Edge(srcNode, dstNode)
        this.edges.push(edge)
        this.edgeMap.set(edge.getEdgeId(srcNode, dstNode), edge)
        srcNode.outEdges.push(edge)
        dstNode.inEdges.push(edge)
        dstNode.hasParent = true
        return edge
    }

    getTicks() {
        let id = 0
        this.nodes.forEach((node) => {
            let startTime_exist = this.tickMap.has(node.startTime)
            let endTime_exist = this.tickMap.has(node.endTime)

            if (!startTime_exist) {
                let startTick = new Tick(id++, node.startTime)
                this.ticks.push(startTick)
                this.tickMap.set(node.startTime, id)
            }

            if (!endTime_exist) {
                let endTick = new Tick(id++, node.endTime)
                this.ticks.push(endTick)
                this.tickMap.set(node.endTime, id)
            }
        })

        this.ticks.sort((tick_0, tick_1) => tick_0.position - tick_1.position)
        this.ticks.forEach((tick, index_in_array) => tick.rank = index_in_array)
    }


    createVirtualNodes() {
        let virtualNode_id = 0

        // create virtual nodes
        this.nodes.forEach((node) => {
            let startTime = node.startTime
            let endTime = node.endTime

            for (let i = 0; i < this.ticks.length; i++) {
                let tickTime = this.ticks.at(i).position
                let tickRank = this.ticks.at(i).rank

                if (tickTime < startTime) {
                    continue
                }

                if (tickTime > endTime) {
                    break
                }

                let virtualNode = new VirtualNode(virtualNode_id++, tickTime, tickRank, node)
                if (startTime === tickTime) {
                    node.startVirtualNode = virtualNode
                    virtualNode.nodeType = 'side'
                } else if (endTime === tickTime) {
                    node.endVirtualNode = virtualNode
                    virtualNode.nodeType = 'side'
                } else {
                    virtualNode.nodeType = 'inner'
                }

                this.virtualNodes.push(virtualNode)
                node.childVirtualNodes.push(virtualNode)
                this.virtualNodeMap.set(virtualNode.id, virtualNode)
                this.addLevelsToNodeIndex(virtualNode.tickRank)
                this.virtualNodeIndex[virtualNode.tickRank].push(virtualNode)
            }
        })
    }


    createVirtualEdges() {
        let anchorID = 0
        // create virtual edges
        this.nodes.forEach((node) => {
            let endVirtualNode = node.endVirtualNode

            node.outEdges.forEach((outEdge) => {
                let dstVirtualNode = outEdge.dstNode.startVirtualNode

                // anchor method
                let deltaLayers = dstVirtualNode.tickRank - endVirtualNode.tickRank


                if (deltaLayers < 0) {
                    let correctDstVirtualNode
                    for (const childNode of outEdge.dstNode.childVirtualNodes) {
                        if (childNode.tickRank === endVirtualNode.tickRank) {
                            correctDstVirtualNode = childNode
                            break
                        }
                    }
                    let virtualEdge = new VirtualEdge(endVirtualNode, correctDstVirtualNode, outEdge, 'outer')
                    outEdge.virtualEdges.push(virtualEdge)
                    this.virtualEdges.push(virtualEdge)
                    endVirtualNode.outVirtualEdges.push(virtualEdge)
                    correctDstVirtualNode.inVirtualEdges.push(virtualEdge)
                }
                else if (deltaLayers <= 1) {
                    let virtualEdge = new VirtualEdge(endVirtualNode, dstVirtualNode, outEdge, 'outer')
                    outEdge.virtualEdges.push(virtualEdge)
                    this.virtualEdges.push(virtualEdge)
                    endVirtualNode.outVirtualEdges.push(virtualEdge)
                    dstVirtualNode.inVirtualEdges.push(virtualEdge)
                } else {
                    // add anchors to the edges that cross multiple layers
                    let curVirtualNode = endVirtualNode
                    for (let i = 0; i < deltaLayers - 1; i++) {
                        let tickRank = curVirtualNode.tickRank + 1
                        let anchor
                        let edgeType = 'outer'
                        if (endVirtualNode.edgeAnchorNodes.length > i) {
                            anchor = endVirtualNode.edgeAnchorNodes[i]
                        }
                        else {
                            anchor = new VirtualNode('ea' + anchorID++, this.ticks.at(tickRank).position, tickRank, null)
                            anchor.nodeType = 'edge-anchor'
                            this.virtualNodeIndex[tickRank].push(anchor)
                            this.virtualNodes.push(anchor)
                            endVirtualNode.edgeAnchorNodes.push(anchor)
                            let virtualEdge = new VirtualEdge(curVirtualNode, anchor, null, edgeType)
                            curVirtualNode.outVirtualEdges.push(virtualEdge)
                            anchor.inVirtualEdges.push(virtualEdge)
                            this.virtualEdges.push(virtualEdge)
                            edgeType = 'fake'
                        }

                        curVirtualNode = anchor
                    }

                    let virtualEdge = new VirtualEdge(curVirtualNode, dstVirtualNode, null, 'outer')
                    curVirtualNode.outVirtualEdges.push(virtualEdge)
                    dstVirtualNode.inVirtualEdges.push(virtualEdge)
                    this.virtualEdges.push(virtualEdge)
                }
            })

            // create inner virtual edges
            for (let index = 0; index < node.childVirtualNodes.length - 1; index++) {
                let srcVirtualNode = node.childVirtualNodes[index]
                let dstVirtualNode = node.childVirtualNodes[index + 1]
                let virtualEdge = new VirtualEdge(srcVirtualNode, dstVirtualNode, null, 'inner')
                this.virtualEdges.push(virtualEdge)
                srcVirtualNode.outVirtualEdges.push(virtualEdge)
                dstVirtualNode.inVirtualEdges.push(virtualEdge)
            }
        })
    }

    createGroups() {
        // create group
        let num = 0
        this.nodes.forEach((node) => {
            this.addLevelsToGroup(num)
            node.childVirtualNodes.forEach((vNode) => {
                this.groups.at(num).push(vNode)
                vNode.groupID = num
            })
            num++
        })
    }

    createSpaceAnchors() {
        // create space anchors
        let anchorID = 0
        for (let i = 0; i < this.virtualNodeIndex.length; i++) {
            this.MAX_INDEX = Math.max(this.MAX_INDEX, this.virtualNodeIndex[i].length)
        }
        for (let i = 0; i < this.virtualNodeIndex.length; i++) {
            let delta = this.MAX_INDEX - this.virtualNodeIndex[i].length
            let correspondingTick = this.ticks.at(i)
            for (let j = 0; j < delta; j++) {
                let anchor = new VirtualNode('sa' + anchorID++, correspondingTick.position, correspondingTick.rank, null)
                anchor.nodeType = 'anchor'
                this.virtualNodeIndex[i].push(anchor)
                anchor.depth = anchor.tickRank
                this.virtualNodes.push(anchor)
            }
        }
    }

    /**
     * partition the nodes by ticks -> create virtual nodes and virtual edges
     *
     */
    getVirtualGraph() {
        this.getTicks()

        this.createVirtualNodes()

        this.createVirtualEdges()

        this.createGroups()

        this.createSpaceAnchors()

        for (let virtualNode of this.virtualNodes) {
            this.output_json_map.nodes.push({id: 'u' + virtualNode.id})
        }

        for (let virtualEdge of this.virtualEdges) {
            this.output_json_map.edges.push({nodes: ['u' + virtualEdge.startVirtualNode.id, 'u' + virtualEdge.endVirtualNode.id]})
        }

        for (let group of this.groups) {
            let groupNodes = []
            for (let node of group) {
                groupNodes.push('u' + node.id)
            }
            this.output_json_map.groups.push({nodes: groupNodes})
        }

        console.log(JSON.stringify(this.output_json_map))
    }

    addLevelsToNodeIndex(depth) {
        while (this.virtualNodeIndex.length <= depth) {
            this.virtualNodeIndex.push([]);
        }
    }

    addLevelsToGroup(num) {
        while (this.groups.length <= num) {
            this.groups.push([])
        }
    }

    getRootNodes() {
        this.MIN_TIME = Math.min.apply(Math, this.nodes.map(item => {
            return item.startTime
        }))
        this.MAX_TIME = Math.max.apply(Math, this.nodes.map(item => {
            return item.endTime
        }))

        return this.nodes.filter((n) => n.hasParent === false).sort((a, b) => a.startTime - b.startTime)
    }

    checkOverlap(node) {
        let overlap = false
        for (let placed_node of this.placed_nodes) {
            let x_overlap = (placed_node.startTime <= node.startTime && node.startTime <= placed_node.endTime)
                || (node.startTime <= placed_node.startTime && placed_node.startTime <= node.endTime)
            let y_overlap = (placed_node.y === node.y)

            if (x_overlap && y_overlap) {
                overlap = true
            }
        }

        return overlap
    }

    place_node_greedy(node, parent_node_y) {
        node.y = parent_node_y

        let overlap = false

        while (node.y + this.bar_height < this.greedy_canvas_height - this.paddingY) {
            overlap = this.checkOverlap(node)

            if (overlap) {
                node.y = node.y + this.bar_height + this.text_height
            } else {
                break
            }
        }

        return overlap
    }

    process_node_greedy(node, parent_node_y) {
        let place_out_bound = this.place_node_greedy(node, parent_node_y)
        if (place_out_bound) {
            this.greedy_canvas_height += this.bar_height
        }
        this.placed_nodes.push(node)

        for (let childNode of node.childNodes) {
            if (childNode.y !== undefined) continue
            this.process_node_greedy(childNode, node.y)
        }
    }

    draw_origin_graph(svg) {
        let link = d3.linkHorizontal()
        let positionY = this.paddingY

        this.getRootNodes()
        this.xScale = d3.scaleLinear()
            .domain([this.MIN_TIME, this.MAX_TIME])
            .range([this.paddingX, this.width - this.paddingX])

        let nodes_copy = this.nodes.concat()
        let sorted_nodes = nodes_copy.sort((a, b) => a.startTime - b.startTime)
        for (let node of sorted_nodes) {
            node.posY = positionY

            positionY += this.bar_height + this.text_height
            if (positionY + this.bar_height > this.origin_canvas_height - this.paddingY) {
                this.origin_canvas_height += this.bar_height + this.text_height
            }
        }

        svg.attr("width", this.width).attr("height", this.origin_canvas_height)

        for (let node of sorted_nodes) {
            svg.append('rect')
                .attr('x', this.xScale(node.startTime))
                .attr('y', node.posY)
                .attr('width', this.xScale(node.endTime) - this.xScale(node.startTime))
                .attr('height', this.bar_height)
                .style('fill', this.color(sorted_nodes.indexOf(node)))
                .append('title')
                .text(node.id)

            let node_end_x = this.xScale(node.endTime)
            let node_end_y = node.posY + this.bar_height / 2
            for (let childNode of node.childNodes) {
                let childNode_start_x = this.xScale(childNode.startTime)
                let childNode_start_y = childNode.posY + this.bar_height / 2

                let link_data = {
                    source: [node_end_x, node_end_y],
                    target: [childNode_start_x, childNode_start_y]
                }

                svg.append('path')
                    .attr('d', link(link_data))
                    .attr('stroke', 'black')
                    .attr('fill', 'none')
            }
        }
    }

    draw_greedy_graph(svg, align = true) {

        let link = d3.linkHorizontal()
        if (align) {
            // debugger
            let root_nodes = this.getRootNodes()

            for (let rootNode of root_nodes) {
                this.process_node_greedy(rootNode, this.paddingY)
            }
        }

        svg.attr("height", this.greedy_canvas_height).attr("width", this.width)

        this.xScale = d3.scaleLinear()
            .domain([this.MIN_TIME, this.MAX_TIME])
            .range([this.paddingX, this.width - this.paddingX])

        for (let node of this.nodes) {

            svg.append('rect')
                .attr('x', this.xScale(node.startTime))
                .attr('y', node.y)
                .attr('width', this.xScale(node.endTime) - this.xScale(node.startTime))
                .attr('height', this.bar_height)
                .style('fill', this.color(this.nodes.indexOf(node)))
                .append('title')
                .text(node.id)

            let text = node.name.replace('Map ', 'M')
            text = text.replace('Reducer ', 'R')
            svg.append('text')
                .text(text)
                .attr('text-anchor', 'middle')
                .style("font-family", "Arial")
                .attr('x', this.xScale(node.startTime) + 5)
                .attr('y', node.y - 2)
                .attr('fill', '#1e1b1b')
                .style('font-size', '0.7em')
                .style("font-weight", "bold")

            let node_end_x = this.xScale(node.endTime)
            let node_end_y = node.y + this.bar_height / 2
            for (let childNode of node.childNodes) {
                let childNode_start_x = Math.max(this.xScale(childNode.startTime), node_end_x + 2)
                let childNode_start_y = childNode.y + this.bar_height / 2

                let link_data = {
                    source: [node_end_x, node_end_y],
                    target: [childNode_start_x, childNode_start_y]
                }

                svg.append('path')
                    .attr('d', link(link_data))
                    .attr('stroke', 'black')
                    .attr('fill', 'none')
            }
        }
    }

    draw_virtualNodes(svg) {
        this.xScale = d3.scaleLinear()
            .domain([this.MIN_TIME, this.MAX_TIME])
            .range([this.paddingX, this.width - this.paddingX])

        for (let virtualNode of this.virtualNodes) {
            svg.append('circle')
                .attr('cx', this.xScale(virtualNode.positionX))
                .attr('cy', virtualNode.realNode.y + this.bar_height / 2)
                .attr('r', 5)
                .attr('fill', '#0a0a0a')

            svg.append('text')
                .text(virtualNode.id)
                .attr('text-anchor', 'middle')
                .style("font-family", "Arial")
                .attr('x', this.xScale(virtualNode.positionX))
                .attr('y', virtualNode.realNode.y - 2)
                .style('font-size', '0.7em')
                .style("font-weight", "bold")
        }
    }

    draw(svg, nodeYDistance, rect=false) {
        console.log("draw")
        console.log(svg)
        svg
            .attr("width", this.width)
            .attr("height", this.greedy_canvas_height)

        this.xScale = d3.scaleLinear()
            .domain([this.MIN_TIME, this.MAX_TIME])
            .range([this.paddingX, this.width - this.paddingX])

        let getNodeCoordX = (node) => (this.xScale(node.positionX));
        let getNodeCoordY = (node) => {
            let multi = this.virtualNodeIndex[node.tickRank].indexOf(node)
            return parseFloat(this.paddingY + multi * nodeYDistance)
        };

        let line = d3.line().curve(d3.curveBasis);
        let outer_color = '#ec7430'
        if (rect) outer_color = '#1c1717'

        let edge_colors = {'inner': '#6b6e79', 'outer': outer_color, 'fake': '#ec7430'};
        let node_colors = {'inner': '#656262', 'side': '#1e1b1b', 'edge-anchor': '#9572b2', 'anchor': '#96919a'}

        for (let edge of this.virtualEdges) {
            svg.append('path')
                .attr('class', 'edgepath')
                .attr('fill', 'none')
                // .attr('stroke', 'black')
                // .attr('stroke-width', 2)
                .attr('stroke', edge_colors[edge.edgeType])
                .attr('stroke-width', 2)
                .attr('d', () => {
                    return line([
                        [getNodeCoordX(edge.startVirtualNode), getNodeCoordY(edge.startVirtualNode)],
                        // [getNodeCoordX(edge.startVirtualNode) + m + s1, getNodeCoordY(edge.startVirtualNode)],
                        // [getNodeCoordX(edge.endVirtualNode) + m + s2, getNodeCoordY(edge.endVirtualNode)],
                        [getNodeCoordX(edge.endVirtualNode), getNodeCoordY(edge.endVirtualNode)]
                    ])
                })
        }

        for (let depth in this.virtualNodeIndex) {
            for (let node of this.virtualNodeIndex[depth]) {

                if ((node.nodeType === 'anchor' || node.nodeType === 'edge-anchor') && rect) continue
                let g = svg.append('g')
                    .attr('transform', 'translate(' + (getNodeCoordX(node)) + ',' + getNodeCoordY(node) + ')')

                if (node.realNode !== null && rect) {
                    if (node.realNode.startVirtualNode === node) {
                        g.append('rect')
                            .attr('width', this.xScale(node.realNode.endTime) - this.xScale(node.realNode.startTime))
                            .attr("y", -5)
                            .attr('height', 15)
                            .style('fill', this.color(this.nodes.indexOf(node.realNode)))
                            .append('title')
                            .text(node.realNode.id)
                    }
                }

                if (rect && node === node.realNode.startVirtualNode) {

                    let text = node.realNode.name.replace('Map ', 'M')
                    text = text.replace('Reducer ', 'R')
                    g.append('text')
                        .text(text)
                        .attr('text-anchor', 'middle')
                        .style("font-family", "Arial")
                        .attr('x', 3)
                        .attr('y', -5)
                        .attr('fill', '#1e1b1b')
                        .style('font-size', '0.7em')
                        .style("font-weight", "bold")
                }

                if (!rect) {
                    g.append('circle')
                        .datum(node)
                        .attr('class', 'node')
                        // .attr('fill', '#ccc')
                        // .attr('stroke', 'black')
                        // .attr('stroke-width', 2)
                        .attr('r', 5)
                        .attr('cx', 0)
                        .attr('cy', 0)
                        // .attr('stroke', '#303E3F')
                        .attr('stroke-width', 0)
                        .attr('fill', node_colors[node.nodeType])

                    g.append('text')
                        .text(node.id)
                        .attr('text-anchor', 'middle')
                        .style("font-family", "Arial")
                        .attr('x', 3)
                        .attr('y', -5)
                        .attr('fill', '#1e1b1b')
                        .style('font-size', '0.7em')
                        .style("font-weight", "bold")
                }
            }
        }
    }
}

export function createGraph() {
    return new Graph()
}
