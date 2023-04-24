// ====================== Calculate Gurobi Result ==========================
export function calGurobiScore(graph, result) {
    let scores = [];

    let temp_scores = calGurobiCrossingScore(graph, result);
    for (const score of temp_scores) {
        scores.push(score);
    }

    return scores;
}

function calGurobiCrossingScore(graph, result) {
    let crossingScore = 0, curvatureScore = 0;
    for (let i = 0; i < graph.virtualNodeIndex.length; i++) {
        let layeredEdges = graph.virtualEdges.filter(e => e.startVirtualNode.tickRank === i)

        for (let j = 0; j < layeredEdges.length; j++) {
            let u1v1 = layeredEdges[j];
            let u1 = u1v1.startVirtualNode;
            let v1 = u1v1.endVirtualNode;

            if (u1v1.edgeType === 'outer') {
                curvatureScore += calGurobiCurvatureScore(u1, v1, result);
            }

            for (let k = j + 1; k < layeredEdges.length; k++) {
                let u2v2 = layeredEdges[k];
                let u2 = u2v2.startVirtualNode;
                let v2 = u2v2.endVirtualNode;

                if (u1.id === u2.id || v1.id === v2.id || u1.id === v2.id || u2.id === v1.id) {
                    continue;
                }

                let crossing_variable = "cross_" + u1.id  + "_" + v1.id + "_" + u2.id + "_" + v2.id;
                let crossing_res = result[crossing_variable];

                crossingScore += crossing_res;
            }
        }
    }

    return [crossingScore, curvatureScore];
}

function calGurobiCurvatureScore(u1, v1, result) {
    let curvature_variable = "z_" + u1.id + "_" + v1.id;

    return result[curvature_variable];
}


// =========================== Calculate User Graph ===========================
export function calBasicScore(graph) {
    let scores = [];

    let temp_scores = calBasicCrossingScore(graph);
    for (const score of temp_scores) {
        scores.push(score);
    }

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