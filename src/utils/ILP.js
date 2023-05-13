import axios from "axios";

export default class ILP {
    constructor(graph) {
        this.graph = graph
        this.verbose = false;
        this.model = {}
        this.mip = true
        this.zcount = 0
        this.initialGuess = {}
        this.m = 50
        this.result = {}

        this.options = {
            crossings_reduction_weight: 10,
            crossings_reduction_active: true,
            bendiness_reduction_weight: 1,
            bendiness_reduction_active: true,
            compactness_reduction_weight: 1,
            compactness_reduction_active: true,
            verticalPosition_reduction_option: 'Null',
            verticalPosition: -1,
            verticalPosition_reduction_weight: 1,
            verticalPosition_reduction_active: true
        };
    }

    setCrossingWeight(weight) {
        this.options.crossings_reduction_weight = weight;
    }

    setBendinessWeight(weight) {
        this.options.bendiness_reduction_weight = weight;
    }

    makeCrossingVariable(u1, w1, u2, w2) {
        let crossing_variable = "cross_" + u1.id  + "_" + w1.id + "_" + u2.id + "_" + w2.id;
        this.crossing_vars[crossing_variable] = "";
        return crossing_variable;
    }

    makeBasicVariable(u1, u2) {
        let basic_var = "x_" + u1.id + "_" + u2.id;
        this.defined_vars[basic_var] = "";
        return basic_var;
    }

    makeGroupVariable(groupID) {
        let variable = "g_" + groupID;
        this.group_vars[variable] = "";
        return variable;
    }

    makeCompactnessVariable(n1, n2) {
        let variable = "comp_g" + n1.groupID + "_g" + n2.groupID;
        this.compact_vars[variable] = "";
        return variable;
    }

    makeCurveVariable(u1, v1) {
        let variable = "z_" + u1.id + "_" + v1.id;
        this.bend_vars[variable] = "";
        return variable;
    }

    makeVerticalVariable(group_var) {
        let variable = "v_" + group_var;
        this.vertical_vars[variable] = "";
        return variable;
    }

    addCrossingsToMinimize() {
        for (let elem in this.crossing_vars) {
            this.model.minimize += this.options.crossings_reduction_weight + " " + elem + " + "
        }
    }

    addCrossingsToSubjectTo() {
        for (let i = 0; i < this.graph.virtualNodeIndex.length; i++) {
            let layerEdges = this.graph.virtualEdges.filter(e => e.startVirtualNode.tickRank === i)

            for (let j = 0; j < layerEdges.length; j++) {
                let u1v1 = layerEdges[j]
                // add bendiness constraint
                if (u1v1.edgeType === 'outer') {
                    this.addCurvatureToSubjectTo(u1v1)
                }

                for (let k = j + 1; k < layerEdges.length; k++) {
                    let u2v2 = layerEdges[k]

                    let u1 = u1v1.startVirtualNode
                    let v1 = u1v1.endVirtualNode
                    let u2 = u2v2.startVirtualNode
                    let v2 = u2v2.endVirtualNode

                    //TODO:
                    // let sameRankEdge = (u2.tickRank === v2.tickRank) || (u1.tickRank === v1.tickRank)

                    if (u1.id === u2.id || v1.id === v2.id || u1.id === v2.id || u2.id === v1.id) {
                        continue
                    }
                    // C_u1v1_u2v2
                    let crossing = this.makeCrossingVariable(u1, v1, u2, v2)

                    // C_u1v1_u2v2 + x_u1_u2 + x_v2_v1 >= 1
                    this.model.subjectTo += crossing + " + " + this.makeBasicVariable(u1, u2) + " + " + this.makeBasicVariable(v2, v1) + " >= 1\n"
                    // C_u1v1_u2v2 + x_u2_u1 + x_v1_v2 >= 1
                    this.model.subjectTo += crossing + " + " + this.makeBasicVariable(u2, u1) + " + " + this.makeBasicVariable(v1, v2) + " >= 1\n"
                }
            }
        }
    }

    addCurvatureToMinimize() {
        for (let elem in this.bend_vars) {
            this.model.minimize += this.options.bendiness_reduction_weight + " " + elem + " + "
        }
    }

    addCurvatureToSubjectTo(u1v1) {
        let u1 = u1v1.startVirtualNode
        let v1 = u1v1.endVirtualNode

        let computeNodeY = (node) => {
            if (node.nodeType === 'edge-anchor') {
                return this.makeGroupVariable(node.id)
            }
            else {
                return this.makeGroupVariable(node.groupID)
            }
        }

        let y1 = computeNodeY(u1)
        let y2 = computeNodeY(v1)
        let z = this.makeCurveVariable(u1, v1)

        this.model.subjectTo += y1 + " - " + y2 + " - " + z + " <= 0\n"
        this.model.subjectTo += y2 + " - " + y1 + " - " + z + " <= 0\n"
        this.model.subjectTo += z + " >= 0\n"
    }

    addGroupToSubjectTo() {
        for (let i = 0; i < this.graph.virtualNodeIndex.length; i++) {
            let layerNodes = this.graph.virtualNodeIndex[i]

            for (let j = 0; j < layerNodes.length; j++) {

                let curNode = layerNodes[j]
                let isAnchor = (curNode.nodeType === 'anchor')
                let isEdgeAnchor = (curNode.nodeType === 'edge-anchor')
                let info = ''
                let startIdx = j + 1
                if (!isAnchor && !isEdgeAnchor) {
                    info = this.makeGroupVariable(curNode.groupID)
                    startIdx = 0
                }
                else if (isEdgeAnchor) {
                    info = this.makeGroupVariable(curNode.id)
                    startIdx = 0
                }

                for (let k = startIdx; k < layerNodes.length; k++) {
                    if (j === k) continue
                    let nextNode = layerNodes[k]
                    if (!isAnchor) {
                        info += " - " + this.makeBasicVariable(nextNode, curNode)
                    }
                    this.model.subjectTo += this.makeBasicVariable(curNode, nextNode) + " + "
                        + this.makeBasicVariable(nextNode, curNode) + " = 1\n"
                }

                if (!isAnchor) {
                    this.model.subjectTo += info + " = 0\n"
                }
            }
        }
    }

    addLayerTransitivityToSubjectTo() {
        for (let i = 0; i < this.graph.virtualNodeIndex.length; i++) {
            let layerNodes = this.graph.virtualNodeIndex[i]
            for (let j = 0; j < layerNodes.length; j++) {
                let node_1 = layerNodes[j]
                for (let k = j + 1; k < layerNodes.length; k++) {
                    let node_2 = layerNodes[k]

                    for (let p = k + 1; p < layerNodes.length; p++) {
                        let node_3 = layerNodes[p]
                        this.model.subjectTo += this.makeBasicVariable(node_1, node_2) + " + "
                            + this.makeBasicVariable(node_2, node_3) + " - "
                            + this.makeBasicVariable(node_1, node_3) + " >= 0\n"
                        this.model.subjectTo += "- " + this.makeBasicVariable(node_1, node_2) + " - "
                            + this.makeBasicVariable(node_2, node_3) + " + "
                            + this.makeBasicVariable(node_1, node_3) + " >= -1\n"
                    }
                }
            }
        }
    }

    addCompactnessToSubjectTo() {
        for (let i = 0; i < this.graph.nodes.length; i++) {
            let node_1 = this.graph.nodes[i];
            let startIndex_1 = node_1.startVirtualNode.tickRank;
            let endIndex_1 = node_1.endVirtualNode.tickRank;
            for (let j = i + 1; j < this.graph.nodes.length; j++) {
                let node_2 = this.graph.nodes[j];
                let startIndex_2 = node_2.startVirtualNode.tickRank;
                let endIndex_2 = node_2.endVirtualNode.tickRank;
                if (startIndex_1 <= startIndex_2 <= endIndex_1 || startIndex_1 <= endIndex_2 <= endIndex_1) {
                    // comp_g1_g2 - g_1 + g_2 >= 0
                    this.model.subjectTo += this.makeCompactnessVariable(node_1, node_2) + " - " +
                        this.makeGroupVariable(node_1.groupID) + " + " + this.makeGroupVariable(node_2.groupID) + " >= 0\n";
                    // comp_g1_g2 - g_2 + g_1 >= 0
                    this.model.subjectTo += this.makeCompactnessVariable(node_1, node_2) + " - " +
                        this.makeGroupVariable(node_2.groupID) + " + " + this.makeGroupVariable(node_1.groupID) + " >= 0\n";
                }
            }
        }
    }

    addCompactnessToMinimize() {
        for (const elem in this.compact_vars) {
            this.model.minimize += this.options.compactness_reduction_weight + " " + elem + " + ";
        }
    }

    addVerticalPositionToSubjectTo() {
        switch (this.options.verticalPosition_reduction_option) {
            case "Null":
                this.options.verticalPosition = -1;
                this.options.verticalPosition_reduction_weight = 0;
                break;
            case "Top":
                this.options.verticalPosition = 0;
                break;
            case "Middle":
                this.options.verticalPosition = Math.floor(this.graph.MAX_INDEX / 2);
                break;
            case "Bottom":
                this.options.verticalPosition = this.graph.MAX_INDEX - 1;
                break;
        }
        if (this.options.verticalPosition === -1) {
            return;
        }

        for (const elem in this.group_vars) {
            let verticalVar = this.makeVerticalVariable(elem);
            this.model.subjectTo += elem + " - " + verticalVar + " <= " + this.options.verticalPosition + "\n";
            this.model.subjectTo += elem + " + " + verticalVar + " >= " + this.options.verticalPosition + "\n";
        }
    }

    addVerticalPositionToMinimize() {
        for (const elem in this.vertical_vars) {
          this.model.minimize += this.options.verticalPosition_reduction_weight + " " + elem + " + ";
        }
    }

    modelToString() {
        this.model.minimize = this.model.minimize.substring(0, this.model.minimize.length - 2) + "\n"
        return this.model.minimize + this.model.subjectTo + this.model.bounds + '\nEnd\n'
    }

    fillModel() {
        this.model.minimize = "Minimize \n";
        this.model.subjectTo = "Subject To \n";
        this.model.bounds = "\nBinaries \n";

        this.crossing_vars = {};
        this.defined_vars = {};
        this.group_vars = {};
        this.compact_vars = {};
        this.bend_vars = {};
        this.vertical_vars = {};

        // create variables and add them to subjection
        this.addLayerTransitivityToSubjectTo();
        this.addGroupToSubjectTo();
        this.addCrossingsToSubjectTo();
        this.addCompactnessToSubjectTo();
        this.addVerticalPositionToSubjectTo();

        // add variables to objective function
        this.addCrossingsToMinimize();
        this.addCurvatureToMinimize();
        this.addCompactnessToMinimize();
        this.addVerticalPositionToMinimize();

        // add binary constraints to variables
        for (let elem in this.defined_vars) {
            this.model.bounds += elem + " ";
        }
        for (let elem in this.crossing_vars) {
            this.model.bounds += elem + " ";
        }

        console.log("MIP Model:", JSON.stringify(this.model));
    }

    arrange() {
        this.fillModel()

        let _this = this

        return this.send_lp()
            .then(() => {
                _this.apply_solution()
            })
    }

    send_lp() {
        let BASE_ADDRESS = "http://127.0.0.1:5000/"

        let modelString = this.modelToString();

        let _this = this
        return new Promise(resolve => {
            axios.post(BASE_ADDRESS + "saveFile", {
                data: modelString,
                case: this.graph.caseName
            })
                .then(function (response) {
                    console.log(response)
                    if (response.status === 200) {
                        _this.result = response.data
                        resolve(response.data)
                    }
                })
        })
    }

    apply_solution() {
        console.log("apply the solution")
        return new Promise(resolve => {
            let i = 0
            for (;i < this.graph.virtualNodeIndex.length; i++) {
                let layerNodes = this.graph.virtualNodeIndex[i]
                layerNodes.sort((a, b) => {
                    let aid = a.id
                    let bid = b.id

                    if (this.result["x_" + aid + "_" + bid] === 0) return 1;
                    else if (this.result["x_" + aid + "_" + bid] === 1) return -1;
                    else if (this.result["x_" + bid + "_" + aid] === 1) return 1;
                    else if (this.result["x_" + bid + "_" + aid] === 0) return -1;
                })
            }

            if (i === this.graph.virtualNodeIndex.length) {
                resolve()
            }
        })
    }
}

export function createILP(g) {
    return new ILP(g)
}
