<template>
  <div>
    <el-cascader v-model="caseName" :options="options"/>
    <el-button type="primary" @click="readGraph">Layout</el-button>

    <h2>Greedy Fit Layout</h2>
    <h3 id="greedy_time"></h3>
    <svg id="svg_greedy"></svg>

    <h2>ILP Node-link</h2>
    <svg id="svg_node_link"></svg>

    <h2>ILP Gantt Graph</h2>
    <h3 id="ILP_time"></h3>
    <h3 id="ILP_score"></h3>
    <svg id="svg_gantt"></svg>

    <h2>Draggable Chart For User</h2>
    <svg id="draggableChart"></svg>
  </div>
</template>

<script>
import {createGraph} from "@/utils/Graph";
import {readGraphFromJSON} from "@/utils/readGraph"
import {createILP} from "@/utils/ILP";
import {calScore} from "@/utils/scoreCalculation";
import * as d3 from "d3";
import axios from "axios";
// import DraggableChart from "@/components/draggableChart";
// import draggable from 'vuedraggable'

export default {
  name: "ganttGraph",

  components: {

  },

  data() {

    return {
      BACKEND_ADDRESS: "http://127.0.0.1:5000/",
      options: [],
      graph_cases: {value: 'Graph', label: 'Graph', children: []},
      TPCDS_cases: {value: 'TPCDS', label: 'TPCDS', children: []},
      caseName: "",
      graph: null,
      currentMoveItem: null,
      nodeYDistance: 30,
      layersY: []
    }
  },

  methods: {
    readGraph() {
      console.log(this.caseName)

      this.graph = createGraph()
      this.graph.caseName = this.caseName[1]
      let type = this.caseName[0]

      readGraphFromJSON(this.caseName[1], this.graph, type)
          .then(
              this.layout
          )
    },

    layout() {
      let svg_greedy = d3.select("#svg_greedy")
      let svg_node_link = d3.select("#svg_node_link")
          .attr("width", "100%")
          .attr("height", "300px")
      let svg_gantt = d3.select("#svg_gantt")
          .attr("width", "100%")
          .attr("height", "400px")


      let greedyStartTime = new Date()
      this.graph.draw_greedy_graph(svg_greedy)
      let greedyEndTime = new Date()
      d3.select("#greedy_time").text((greedyEndTime - greedyStartTime) / 1000 + 's')

      // draw ticked graph
      this.graph.getVirtualGraph()

      let ilpStartTime = new Date()
      let myAlgorithm = createILP(this.graph)
      myAlgorithm.arrange()
          .then(() => {
            this.graph.draw(svg_node_link, 30, false)
            this.graph.draw(svg_gantt, 30, true)
            let ilpEndTime = new Date()
            d3.select("#ILP_time").text("ILP Time:" + (ilpEndTime - ilpStartTime) / 1000 + 's')
            let scores = calScore(this.graph, myAlgorithm.result)
            d3.select("#ILP_score").text("Crossing Score: " + scores[0] + " / Curvature Score: " + scores[1])
            this.drawDraggableChart()
          })
    },

    getCases() {
      axios.get(this.BACKEND_ADDRESS + "getCases")
          .then((resp) => {
            console.log(resp.data)

            for (let elem of resp.data.Graphs) {
              elem = elem.split(".")[0]
              this.graph_cases.children.push({value: elem, label: elem, children: []})
            }

            for (const elem of resp.data.TPCDS) {

              this.TPCDS_cases.children.push({value: elem, label: elem, children: []})
            }

            this.options.push(this.graph_cases)
            this.options.push(this.TPCDS_cases)
      })
    },

    getNodeCoordX(node) {
      return this.graph.xScale(node.positionX);
    },

    getNodeCoordY(node) {
      let multi = this.graph.virtualNodeIndex[node.tickRank].indexOf(node)
      return parseFloat(this.graph.paddingY + multi * this.nodeYDistance);
    },

    drawDraggableChart() {
      let svg = d3.select("#draggableChart");
      let _this = this

      svg
          .attr("width", this.graph.width)
          .attr("height", this.graph.greedy_canvas_height)

      let line = d3.line().curve(d3.curveBasis);
      let outer_color = '#1c1717'
      let color = d3.scaleOrdinal(d3.schemeCategory10)
      let edge_colors = {'inner': '#6b6e79', 'outer': outer_color, 'fake': '#ec7430'};

      for (let edge of this.graph.virtualEdges) {
        if (edge.edgeType !== 'outer') {
          continue
        }
        svg.append('path')
            .attr('id', 'edge_' + edge.startVirtualNode.id + "-" + edge.endVirtualNode.id)
            .attr('class', 'edgepath')
            .attr('fill', 'none')
            // .attr('stroke', 'black')
            // .attr('stroke-width', 2)
            .attr('stroke', edge_colors[edge.edgeType])
            .attr('stroke-width', 2)
            .attr('d', () => {
              return line([
                [_this.getNodeCoordX(edge.startVirtualNode), _this.getNodeCoordY(edge.startVirtualNode) + _this.graph.bar_height / 2],
                // [getNodeCoordX(edge.startVirtualNode) + m + s1, getNodeCoordY(edge.startVirtualNode)],
                // [getNodeCoordX(edge.endVirtualNode) + m + s2, getNodeCoordY(edge.endVirtualNode)],
                [_this.getNodeCoordX(edge.endVirtualNode), _this.getNodeCoordY(edge.endVirtualNode) + _this.graph.bar_height / 2]
              ])
            })
      }

      for (let depth in this.graph.virtualNodeIndex) {
        for (let node of this.graph.virtualNodeIndex[depth]) {

          if ((node.nodeType === 'anchor' || node.nodeType === 'edge-anchor')) continue
          // let g = svg.append('g')
          //     .attr('transform', 'translate(' + (getNodeCoordX(node)) + ',' + getNodeCoordY(node) + ')')

          if (node.realNode !== null) {
            if (node.realNode.startVirtualNode === node) {
              svg.append('rect')
                  .attr("class", "dragRect")
                  .attr("id", node.realNode.id)
                  .attr('width', this.graph.xScale(node.realNode.endTime) - this.graph.xScale(node.realNode.startTime))
                  .attr("x", _this.getNodeCoordX(node))
                  .attr("y", _this.getNodeCoordY(node))
                  .attr('height', _this.graph.bar_height)
                  .style('fill', color(this.graph.nodes.indexOf(node.realNode)))
                  .append('title')
                  .text(node.realNode.id)

              let text = node.realNode.name.replace('Map ', 'M')
              text = text.replace('Reducer ', 'R')
              svg.append('text')
                  .attr("id", "text_" + node.realNode.id)
                  .text(text)
                  .attr('text-anchor', 'middle')
                  .style("font-family", "Arial")
                  .attr('x', _this.getNodeCoordX(node) + 3)
                  .attr('y', _this.getNodeCoordY(node) - 3)
                  .attr('fill', '#1e1b1b')
                  .style('font-size', '0.7em')
                  .style("font-weight", "bold")
            }
          }
        }
      }

      d3.selectAll(".dragRect")
          .call(_this.dragRect())
    },

    dragRect() {
      let _this = this;

      function dragStarted() {
        console.log('start log....'); // 获取到的是当前拖拽的item 就是之前绑定的值。如：{id: 1, fill: 'black', x: 10, y: 10}
      }

      function dragged(e) {
        console.log(e, 'drag log....');

        const currentY = e.y;

        d3.select(this)
            .attr("y", currentY)

        d3.select("#text_" + this.id)
            .attr("y", currentY - 3)
      }

      function dragEnded(e) { // drag end
        console.log('end log....', e)

        // fit to the nearest layer
        let prevDistance = Math.abs(e.y - _this.graph.paddingY);
        let finalY = _this.graph.paddingY
        for (let i = 1; i < _this.graph.virtualNodeIndex[0].length; i++) {
          let nowDistance = Math.abs(e.y - (_this.graph.paddingY + i * _this.nodeYDistance));
          if (nowDistance > prevDistance) {
            break;
          }
          else {
            prevDistance = nowDistance;
            finalY = _this.graph.paddingY + i * _this.nodeYDistance
          }
        }

        d3.select(this)
            .attr("y", finalY)

        d3.select("#text_" + this.id)
            .attr("y", finalY - 3)

        console.log(this)
        console.log(this.id)
        _this.afterMoveNode(this.id, finalY)
      }

      return d3.drag()
          .on('start', dragStarted) // 开始
          .on('drag', dragged)  // 执行中
          .on('end', dragEnded); // 结束
    },

    afterMoveNode(id, y) {
      let _this = this;
      console.log(this.graph.nodes)
      let movedNode = this.graph.nodes.find(e => e.id === parseInt(id))

      let edgeToNode = movedNode.startVirtualNode.inVirtualEdges;
      let edgeFromNode = movedNode.endVirtualNode.outVirtualEdges;
      let line = d3.line().curve(d3.curveBasis);

      for (const edge of edgeToNode) {
        d3.select("#edge_" + edge.startVirtualNode.id + "-" + edge.endVirtualNode.id)
            .attr('d', () => {
              return line([
                [_this.getNodeCoordX(edge.startVirtualNode), _this.getNodeCoordY(edge.startVirtualNode) + _this.graph.bar_height / 2],
                [_this.getNodeCoordX(edge.endVirtualNode), y + _this.graph.bar_height / 2]
              ])
            })
      }

      for (const edge of edgeFromNode) {
        d3.select("#edge_" + edge.startVirtualNode.id + "-" + edge.endVirtualNode.id)
            .attr('d', () => {
              return line([
                [_this.getNodeCoordX(edge.startVirtualNode), y + _this.graph.bar_height / 2],
                [_this.getNodeCoordX(edge.endVirtualNode), _this.getNodeCoordY(edge.endVirtualNode) + _this.graph.bar_height / 2]
              ])
            })
      }

    }
  },

  mounted() {
    this.getCases()
  }
}
</script>

<style scoped>

</style>