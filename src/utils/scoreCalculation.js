// ====================== Calculate Gurobi Result ==========================
export function calGurobiScore(solver) {
    let scores = [];

    let crossingScore = calGurobiCrossingScore(solver);
    scores.push(crossingScore);

    let curvatureScore = calGurobiCurvatureScore(solver);
    scores.push(curvatureScore);

    let compactnessScore = calGurobiCompactnessScore(solver);
    scores.push(compactnessScore);

    let verticalPositionScore = calGurobiVerticalPositionScore(solver);
    scores.push(verticalPositionScore);

    return scores;
}

function calGurobiCrossingScore(solver) {
    let crossingScore = 0;
    for (const crossingVar in solver.crossing_vars) {
        crossingScore += solver.result[crossingVar];
    }

    return crossingScore;
}

function calGurobiCurvatureScore(solver) {
    let curvatureScore = 0;
    for (const bendVar in solver.bend_vars) {
        curvatureScore += solver.result[bendVar];
    }

    return curvatureScore;
}

function calGurobiCompactnessScore(solver) {
    let compactnessScore = 0;
    for (const compVar in solver.compact_vars) {
        compactnessScore += solver.result[compVar];
    }

    return compactnessScore;
}

function calGurobiVerticalPositionScore(solver) {
    let verticalPositionScore = 0;
    let position = solver.options.verticalPosition;
    if (position !== -1) {
        for (const groupVar in solver.group_vars) {
            // not consider edge anchor
            if (!groupVar.includes("ea")) {
                verticalPositionScore += Math.abs(solver.result[groupVar] - position);
            }
        }
    }

    return verticalPositionScore;
}

// =========================== Calculate User Graph ===========================
export function calBasicScore(graph, solver) {
    let scores = [];

    let cross_curve_scores = calBasicCrossingScore(graph);
    for (const score of cross_curve_scores) {
        scores.push(score);
    }

    let compact_score = calBasicCompactnessScore(graph);
    scores.push(compact_score);

    let verticalPos_score = calBasicVerticalPositionScore(graph, solver);
    scores.push(verticalPos_score);

    return scores;
}

function calBasicCrossingScore(graph) {
    let crossingScore = 0, curvatureScore = 0;
    for (let i = 0; i < graph.virtualNodeIndex.length; i++) {
        let layeredEdges = graph.virtualEdges.filter(e => e.startVirtualNode.tickRank === i)

        for (let j = 0; j < layeredEdges.length; j++) {
            let u1v1 = layeredEdges[j];
            let u1 = u1v1.startVirtualNode;
            let v1 = u1v1.endVirtualNode;

            if (u1v1.edgeType === 'outer') {
                curvatureScore += calBasicCurvatureScore(u1, v1);
            }

            for (let k = j + 1; k < layeredEdges.length; k++) {
                let u2v2 = layeredEdges[k];
                let u2 = u2v2.startVirtualNode;
                let v2 = u2v2.endVirtualNode;

                if (u1.id === u2.id || v1.id === v2.id || u1.id === v2.id || u2.id === v1.id) {
                    continue;
                }

                let crossingResult = (u1.userLayer - u2.userLayer) * (v1.userLayer - v2.userLayer);
                crossingScore += crossingResult >= 0? 0: 1;
            }
        }
    }

    return [crossingScore, curvatureScore];
}

function calBasicCurvatureScore(u1, v1) {
    let delta = u1.userLayer - v1.userLayer;
    return Math.abs(delta);
}

function calBasicCompactnessScore(graph) {
    let compactnessScore = 0;
    for (let i = 0; i < graph.nodes.length; i++) {
        let node_1 = graph.nodes[i];
        let startIndex_1 = node_1.startVirtualNode.tickRank;
        let endIndex_1 = node_1.endVirtualNode.tickRank;
        for (let j = i + 1; j < graph.nodes.length; j++) {
            let node_2 = graph.nodes[j];
            let startIndex_2 = node_2.startVirtualNode.tickRank;
            let endIndex_2 = node_2.endVirtualNode.tickRank;
            if (startIndex_1 <= startIndex_2 <= endIndex_1 || startIndex_1 <= endIndex_2 <= endIndex_1) {
                compactnessScore += Math.abs(node_1.startVirtualNode.userLayer - node_2.startVirtualNode.userLayer);
            }
        }
    }

    return compactnessScore;
}

function calBasicVerticalPositionScore(graph, solver) {
    let verticalPositionScore = 0;
    let position = solver.options.verticalPosition;
    if (position !== -1) {
        for (let i = 0; i < graph.nodes.length; i++) {
            let node = graph.nodes[i];
            verticalPositionScore += Math.abs(position - node.startVirtualNode.userLayer);
        }
    }

    return verticalPositionScore;
}

