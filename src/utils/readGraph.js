// import jQuery from "jquery"
import axios from "axios";

export function readGraphFromJSON(caseName, graph, type) {
    let request_dst = "http://127.0.0.1:5000/getJSON"

    return new Promise((resolve) => {
        axios
            .get(request_dst, {
                params: {
                    caseName: caseName,
                    type: type
                }
            })
            .then(res => {
                console.log(res)
                graph = processData(graph, res.data, type)
                resolve()
            })
    })
}

function processData(graph, data, type) {
    if (type === 'TPCDS') {
        for (let vertex of data.vertices) {
            graph.setNode(vertex.idx, vertex.name, vertex.startTime, vertex.endTime)
        }
    }
    else if (type === 'Graph') {
        for (let node of data.nodes) {
            graph.setNode(node.idx, "Node " + node.idx, node.startTime, node.endTime)
        }
    }

    for (let edge of data.edges) {
        graph.setEdge(edge.src, edge.dst)
    }

    return graph
}

