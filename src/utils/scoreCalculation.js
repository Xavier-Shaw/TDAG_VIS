export function calGurobiScore(graph, result) {
    let crossing_score = 0;
    let curvature_score = 0;

    for (let i = 0; i < graph.virtualNodeIndex.length; i++) {
        let layeredEdges = graph.virtualEdges.filter(e => e.startVirtualNode.tickRank === i)

        for (let j = 0; j < layeredEdges.length; j++) {
            let u1v1 = layeredEdges[j];
            let u1 = u1v1.startVirtualNode;
            let v1 = u1v1.endVirtualNode;

            if (u1v1.edgeType === 'outer') {
                curvature_score += calculateGurobiCurvatureScore(u1, v1, result);
            }

            for (let k = j + 1; k < layeredEdges.length; k++) {
                let u2v2 = layeredEdges[k];
                let u2 = u2v2.startVirtualNode;
                let v2 = u2v2.endVirtualNode;

                if (u1.id === u2.id || v1.id === v2.id || u1.id === v2.id || u2.id === v1.id) {
                    continue;
                }

                let crossing_variable = "c_" + u1.id  + "_" + v1.id + "_" + u2.id + "_" + v2.id;
                let crossing_res = result[crossing_variable];

                crossing_score += crossing_res;
            }
        }
    }

    return [crossing_score, curvature_score]
}

function calculateGurobiCurvatureScore(u1, v1, result) {
    let curvature_variable = "z_" + u1.id + "_" + v1.id

    return result[curvature_variable]
}


