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
import {calBasicScore, calGurobiScore} from "@/utils/scoreCalculation";
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
            let scores = calGurobiScore(this.graph, this.solver.result);
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
      let outer_color = '#1c1717';
      let node_colors = {'inner': '#656262', 'side': '#1e1b1b', 'edge-anchor': '#e530c7', 'anchor': '#96919a'}
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

          if (node.nodeType === 'edge-anchor') {
            node.userLayer = _this.userGraph.virtualNodeIndex[depth].indexOf(node);
            svg.append('circle')
                .attr('class', 'draggableItem')
                .attr("id", node.id)
                .attr('r', 5)
                .attr('cx', _this.getNodeCoordX(node))
                .attr('cy', _this.getNodeCoordY(node) + _this.userGraph.bar_height / 2)
                .attr('stroke-width', 0)
                .attr('fill', node_colors[node.nodeType])

            svg.append('text')
                .attr("id", "text_" + node.id)
                .text(node.id)
                .attr('text-anchor', 'middle')
                .style("font-family", "Arial")
                .attr('x', _this.getNodeCoordX(node) + 3)
                .attr('y', _this.getNodeCoordY(node)  + _this.userGraph.bar_height / 2 - 3)
                .attr('fill', '#1e1b1b')
                .style('font-size', '0.7em')
                .style("font-weight", "bold")
          }
          else if (node.realNode !== null) { // not anchor
            if (node.realNode.startVirtualNode === node) {
              node.userLayer = _this.userGraph.virtualNodeIndex[depth].indexOf(node);
              _this.nodeLayerMap[node.realNode.id] = node.userLayer;

              svg.append('rect')
                  .attr("class", "draggableItem")
                  .attr("id", node.realNode.id)
                  .attr('width', this.userGraph.xScale(node.realNode.endTime) - this.userGraph.xScale(node.realNode.startTime))
                  .attr("x", _this.getNodeCoordX(node))
                  .attr("y", _this.getNodeCoordY(node))
                  .attr('height', _this.userGraph.bar_height)
                  .style('fill', this.userGraph.color(this.userGraph.nodes.indexOf(node.realNode)))
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

      d3.selectAll(".draggableItem")
          .call(_this.dragItem())
    },

    dragItem() {
      let _this = this;

      function dragStarted() {
        console.log('start log....'); // 获取到的是当前拖拽的item 就是之前绑定的值。如：{id: 1, fill: 'black', x: 10, y: 10}
      }

      function dragged(e) {
        let isEdgeAnchor = this.id.startsWith("ea");
        const attributeY = isEdgeAnchor? "cy": "y";
        const currentY = e.y;

        d3.select(this)
            .attr(attributeY, currentY)

        d3.select("#text_" + this.id)
            .attr("y", currentY - 3)
      }

      function dragEnded(e) { // drag end
        let isEdgeAnchor = this.id.startsWith("ea");
        // fit to the nearest layer
        let prevDistance = Math.abs(e.y - _this.userGraph.paddingY);
        let finalY = _this.userGraph.paddingY;
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

        const attributeY = isEdgeAnchor? "cy": "y";
        const deltaY = isEdgeAnchor? _this.userGraph.bar_height / 2: 0;
        d3.select(this)
            .attr(attributeY, finalY + deltaY)

        d3.select("#text_" + this.id)
            .attr("y", finalY + deltaY - 3)

        _this.afterMoveNode(this.id, isEdgeAnchor, finalY);
      }

      return d3.drag()
          .on('start', dragStarted) // 开始
          .on('drag', dragged)  // 执行中
          .on('end', dragEnded); // 结束
    },

    afterMoveNode(id, isEdgeAnchor, y) {
      let _this = this;
      let edgeToNode, edgeFromNode;
      if (isEdgeAnchor) {
        let movedNode = this.userGraph.virtualNodes.find(e => e.id === id);
        edgeToNode = movedNode.inVirtualEdges;
        edgeFromNode = movedNode.outVirtualEdges;
        movedNode.userLayer = this.nodeLayerMap[id];
      }
      else {
        let movedNode = this.userGraph.nodes.find(e => e.id === parseInt(id))
        movedNode.startVirtualNode.userLayer = this.nodeLayerMap[id];
        movedNode.endVirtualNode.userLayer = this.nodeLayerMap[id];
        edgeToNode = movedNode.startVirtualNode.inVirtualEdges;
        edgeFromNode = movedNode.endVirtualNode.outVirtualEdges;
      }

      let line = d3.line().curve(d3.curveBasis);
      for (const edge of edgeToNode) {
        d3.select("#edge_" + edge.startVirtualNode.id + "-" + edge.endVirtualNode.id)
            .attr('d', () => {
              return line([
                [_this.getNodeCoordX(edge.startVirtualNode), _this.getNodeCoordY(edge.startVirtualNode) + _this.userGraph.bar_height / 2],
                [_this.getNodeCoordX(edge.endVirtualNode), y + _this.userGraph.bar_height / 2]
              ])
            })
      }

      for (const edge of edgeFromNode) {
        d3.select("#edge_" + edge.startVirtualNode.id + "-" + edge.endVirtualNode.id)
            .attr('d', () => {
              return line([
                [_this.getNodeCoordX(edge.startVirtualNode), y + _this.userGraph.bar_height / 2],
                [_this.getNodeCoordX(edge.endVirtualNode), _this.getNodeCoordY(edge.endVirtualNode) + _this.userGraph.bar_height / 2]
              ])
            })
      }
    },

    checkNodeOverlap() {
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

    getUserModifiedResult() {
      // reset the virtual nodes' matrix
      for (let i = 0; i < this.userGraph.virtualNodeIndex.length; i++) {
        for (let j = 0; j < this.userGraph.virtualNodeIndex[i].length; j++) {
          this.userGraph.virtualNodeIndex[i][j] = null;
        }
      }

      // layout the virtual nodes of nodes to the position after modified
      for (const node of this.userGraph.nodes) {
        let layer = this.nodeLayerMap[node.id];
        for (const virtualNode of node.childVirtualNodes) {
          let index = virtualNode.tickRank;
          virtualNode.userLayer = layer;
          this.userGraph.virtualNodeIndex[index][layer] = virtualNode;
        }
      }

      // layout the edge anchor nodes to the position after modified
      let edgeAnchorNodes = this.userGraph.virtualNodes.filter((n) => n.nodeType === 'edge-anchor');
      for (const edgeAnchorNode of edgeAnchorNodes) {
        let index = edgeAnchorNode.tickRank;
        this.userGraph.virtualNodeIndex[index][edgeAnchorNode.userLayer] = edgeAnchorNode;
      }

      // fill the virtual nodes' matrix
      let anchorID = 0;
      let spaceAnchorNodes = this.userGraph.virtualNodes.filter((n) => n.nodeType === 'anchor');
      for (let i = 0; i < this.userGraph.virtualNodeIndex.length; i++) {
        for (let j = 0; j < this.userGraph.virtualNodeIndex[i].length; j++) {
          if (this.userGraph.virtualNodeIndex[i][j] == null) {
            this.userGraph.virtualNodeIndex[i][j] = spaceAnchorNodes[anchorID++];
          }
        }
      }
    },

    checkNodeEdgeOverlap() {
      for (const node of this.userGraph.nodes) {
        let layer = this.nodeLayerMap[node.id];
        let startIndex = node.startVirtualNode.tickRank;
        let endIndex = node.endVirtualNode.tickRank;
        for (let i = startIndex; i <= endIndex; i++) {
          let existVirtualNode = this.userGraph.virtualNodeIndex[i][layer];
          if (existVirtualNode.nodeType === "edge-anchor") {
            let message = "Node " + node.id + " and Edge Anchor " + existVirtualNode.id + " are overlapped.\n" + "Please avoid overlapping nodes and edges."
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
      this.checkNodeOverlap();
      this.checkNodeEdgeOverlap();
      this.getUserModifiedResult();
      let scores = calBasicScore(this.userGraph);
      d3.select("#Modified_score").text("Crossing Score: " + scores[0] + " / Curvature Score: " + scores[1]);
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