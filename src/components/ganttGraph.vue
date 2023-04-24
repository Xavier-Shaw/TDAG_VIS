<template>
  <div>
    <el-cascader v-model="caseName" :options="options"/>
    <el-button type="primary" @click="readGraph">Select</el-button>

    <h2>Greedy Fit Layout</h2>
    <h3 id="greedy_time"></h3>
    <svg id="svg_greedy"></svg>

    <!--    <h2>ILP Node-link</h2>-->
    <!--    <svg id="svg_node_link"></svg>-->
    <div style="display: flex; flex-direction: column">
      <el-row style="align-self: center" :gutter="20">
        <span>Crossing Weight:</span>
        <el-input-number v-model="crossingWeight" :min="0"/>
        <span>Curvature Weight:</span>
        <el-input-number v-model="bendinessWeight" :min="0"/>
      </el-row>
      <el-button style="width: 100px; align-self: center" type="primary" @click="setWeight">Set Weight</el-button>
      <el-button style="width: 100px; align-self: center" type="primary" @click="layout">Layout</el-button>
    </div>

    <h2>ILP Gantt Graph</h2>
    <h3 id="ILP_time"></h3>
    <h3 id="ILP_score"></h3>
    <svg id="svg_gantt"></svg>

    <h2>Draggable Chart For User</h2>
    <h3 id="Modified_score"></h3>
    <svg id="draggableChart"></svg>
    <div style="width: 100%; display: flex; flex-direction: column">
      <el-button style="align-self: center" type="primary" @click="submitUserResult">Submit My Modification</el-button>
    </div>
  </div>
</template>

<script>
import {createGraph} from "@/utils/Graph";
import {readGraphFromJSON} from "@/utils/readGraph"
import {createILP} from "@/utils/ILP";
import {calScore} from "@/utils/scoreCalculation";
import * as d3 from "d3";
import axios from "axios";
import {ElMessageBox} from "element-plus";
import _ from 'lodash';

// import DraggableChart from "@/components/draggableChart";
// import draggable from 'vuedraggable'

export default {
  name: "ganttGraph",

  components: {},

  data() {

    return {
      BACKEND_ADDRESS: "http://127.0.0.1:5000/",
      options: [],
      graph_cases: {value: 'Graph', label: 'Graph', children: []},
      TPCDS_cases: {value: 'TPCDS', label: 'TPCDS', children: []},
      caseName: "",
      graph: null,
      userGraph: null,
      currentMoveItem: null,
      nodeYDistance: 30,
      nodeLayerMap: {},
      crossingWeight: 0,
      bendinessWeight: 0,
      solver: null
    }
  },

  methods: {
    readGraph() {
      this.clearSVG();
      console.log(this.caseName)

      this.graph = createGraph()
      this.graph.caseName = this.caseName[1]
      let type = this.caseName[0]

      readGraphFromJSON(this.caseName[1], this.graph, type)
          .then(() => {
                let svg_greedy = d3.select("#svg_greedy");
                let greedyStartTime = new Date()
                this.graph.draw_greedy_graph(svg_greedy)
                let greedyEndTime = new Date()
                d3.select("#greedy_time").text((greedyEndTime - greedyStartTime) / 1000 + 's')
                let myAlgorithm = createILP(this.graph)
                this.solver = myAlgorithm;
                this.crossingWeight = myAlgorithm.options.crossings_reduction_weight;
                this.bendinessWeight = myAlgorithm.options.bendiness_reduction_weight;

                this.graph.getVirtualGraph()
              }
          )
    },

    clearSVG() {
      document.getElementById("svg_greedy").innerHTML = "";
      document.getElementById("svg_gantt").innerHTML = "";
      document.getElementById("draggableChart").innerHTML = "";
    },

    setWeight() {
      this.solver.options.crossings_reduction_weight = this.crossingWeight;
      this.solver.options.bendinessWeight = this.bendinessWeight;
    },

    layout() {
      document.getElementById("svg_gantt").innerHTML = "";
      document.getElementById("draggableChart").innerHTML = "";
      // let svg_node_link = d3.select("#svg_node_link")
      //     .attr("width", "100%")
      //     .attr("height", "300px")
      let svg_gantt = d3.select("#svg_gantt")
          .attr("width", "100%")
          .attr("height", "400px")

      let ilpStartTime = new Date();

      this.solver.arrange()
          .then(() => {
            // this.graph.draw(svg_node_link, 30, false)
            this.graph.draw(svg_gantt, 30, true);
            let ilpEndTime = new Date();
            d3.select("#ILP_time").text("ILP Time:" + (ilpEndTime - ilpStartTime) / 1000 + 's');
            let scores = calScore(this.graph, this.solver.result);
            d3.select("#ILP_score").text("Crossing Score: " + scores[0] + " / Curvature Score: " + scores[1]);
            this.createUserGraph();
            this.drawDraggableChart();
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
      let multi = node.userLayer;
      return parseFloat(this.userGraph.paddingY + multi * this.nodeYDistance);
    },

    createUserGraph() {
      this.userGraph = _.cloneDeep(this.graph);
      console.log("User Graph", this.userGraph);
    },

    drawDraggableChart() {
      let svg = d3.select("#draggableChart");
      let _this = this

      svg
          .attr("width", this.userGraph.width)
          .attr("height", this.userGraph.greedy_canvas_height)

      let line = d3.line().curve(d3.curveBasis);
      let outer_color = '#1c1717'
      let color = d3.scaleOrdinal(d3.schemeCategory10)
      let edge_colors = {'inner': '#6b6e79', 'outer': outer_color, 'fake': '#ec7430'};

      for (let edge of this.userGraph.virtualEdges) {
        if (edge.edgeType !== 'outer') {
          continue
        }

        edge.startVirtualNode.userLayer = this.userGraph.virtualNodeIndex[edge.startVirtualNode.tickRank].indexOf(edge.startVirtualNode);
        edge.endVirtualNode.userLayer = this.userGraph.virtualNodeIndex[edge.endVirtualNode.tickRank].indexOf(edge.endVirtualNode);

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
                [_this.getNodeCoordX(edge.startVirtualNode), _this.getNodeCoordY(edge.startVirtualNode) + _this.userGraph.bar_height / 2],
                [_this.getNodeCoordX(edge.endVirtualNode), _this.getNodeCoordY(edge.endVirtualNode) + _this.userGraph.bar_height / 2]
              ])
            })
      }

      for (let depth in this.userGraph.virtualNodeIndex) {
        for (let node of this.userGraph.virtualNodeIndex[depth]) {

          if ((node.nodeType === 'anchor' || node.nodeType === 'edge-anchor')) continue

          if (node.realNode !== null) {
            if (node.realNode.startVirtualNode === node) {
              node.userLayer = _this.userGraph.virtualNodeIndex[depth].indexOf(node);
              _this.nodeLayerMap[node.realNode.id] = node.userLayer;

              svg.append('rect')
                  .attr("class", "dragRect")
                  .attr("id", node.realNode.id)
                  .attr('width', this.userGraph.xScale(node.realNode.endTime) - this.userGraph.xScale(node.realNode.startTime))
                  .attr("x", _this.getNodeCoordX(node))
                  .attr("y", _this.getNodeCoordY(node))
                  .attr('height', _this.userGraph.bar_height)
                  .style('fill', color(this.userGraph.nodes.indexOf(node.realNode)))
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
        const currentY = e.y;

        d3.select(this)
            .attr("y", currentY)

        d3.select("#text_" + this.id)
            .attr("y", currentY - 3)
      }

      function dragEnded(e) { // drag end
        // fit to the nearest layer
        let prevDistance = Math.abs(e.y - _this.userGraph.paddingY);
        let finalY = _this.userGraph.paddingY
        _this.nodeLayerMap[this.id] = 0;
        for (let i = 1; i < _this.userGraph.virtualNodeIndex[0].length; i++) {
          let nowDistance = Math.abs(e.y - (_this.userGraph.paddingY + i * _this.nodeYDistance));
          if (nowDistance > prevDistance) {
            break;
          } else {
            prevDistance = nowDistance;
            finalY = _this.userGraph.paddingY + i * _this.nodeYDistance
            _this.nodeLayerMap[this.id] = i;
          }
        }

        d3.select(this)
            .attr("y", finalY)

        d3.select("#text_" + this.id)
            .attr("y", finalY - 3)

        _this.afterMoveNode(this.id, finalY)
      }

      return d3.drag()
          .on('start', dragStarted) // 开始
          .on('drag', dragged)  // 执行中
          .on('end', dragEnded); // 结束
    },

    afterMoveNode(id, y) {
      let _this = this;
      let movedNode = this.userGraph.nodes.find(e => e.id === parseInt(id))
      movedNode.startVirtualNode.userLayer = this.nodeLayerMap[id];
      movedNode.endVirtualNode.userLayer = this.nodeLayerMap[id];
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
    },

    checkOverlap() {
      for (let i = 0; i < this.userGraph.nodes.length; i++) {
        let node_1 = this.userGraph.nodes[i];
        for (let j = i + 1; j < this.userGraph.nodes.length; j++) {
          let node_2 = this.userGraph.nodes[j];
          let overlap_x = (node_2.startTime <= node_1.startTime && node_1.startTime < node_2.endTime)
              || (node_1.startTime <= node_2.startTime && node_2.startTime < node_1.endTime);
          let overlap_y = (this.nodeLayerMap[node_1.id] === this.nodeLayerMap[node_2.id]);
          if (overlap_x && overlap_y) {
            let message = "Node " + node_1.id + " and Node " + node_2.id + " are overlapped.\n" + "Please avoid overlapping nodes."
            ElMessageBox.alert(message, 'Modification Failed', {
              // if you want to disable its autofocus
              // autofocus: false,
              confirmButtonText: 'OK',
            })
            break;
          }
        }
      }
    },

    submitUserResult() {
      this.checkOverlap()

    }
  },

  mounted() {
    this.getCases()
  }
}
</script>

<style scoped>
.el-input-number {
  margin-left: 10px;
  margin-right: 30px;
  margin-bottom: 20px;
}
</style>