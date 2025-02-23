import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { Network, Options } from 'vis-network/standalone/esm/vis-network';
import { ChatService } from '../chat.service';
import { ImageUploadService } from '../image-upload.service';
import { Graph, VisGraph } from '../model';

@Component({
  selector: 'app-graph',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './graph.component.html',
  styleUrl: './graph.component.scss',
})
export class GraphComponent implements OnInit, OnDestroy {
  @ViewChild('graph') container: ElementRef;

  network: Network;
  networkOptions: Options = {
    autoResize: true,
    height: '75 vh',
    edges: {
      arrows: {
        to: {
          enabled: true,
          scaleFactor: 0.5,
        },
      },
      font: {
        align: 'middle',
      },
    },
    interaction: {
      hover: true,
      navigationButtons: true,
    },
    physics: {
      solver: 'barnesHut',
      barnesHut: { springLength: 250 },
    },
    manipulation: {
      enabled: true,
      editEdge: {
        editWithoutDrag: (edgeData, callback) => {
          let oldLabels = edgeData.id.split('#$#')[2].split(', ');
          Swal.fire({
            titleText: 'Edit Edge',
            text: 'Please enter edge label. Separate multiple labels with comma.',
            input: 'textarea',
            inputValue: oldLabels.join(', '),
            showCancelButton: true,
            confirmButtonText: 'Save',
            showLoaderOnConfirm: true,
            preConfirm: async (title) => {
              let newLabels = title.split(',').map((label) => label.trim());
              // List added labels and removed labels
              let addedLabels = newLabels.filter(
                (label) => !oldLabels.includes(label)
              );
              let removedLabels = oldLabels.filter(
                (label) => !newLabels.includes(label)
              );

              // Generate payload
              let editGraphPayload = {
                deletedEdges: removedLabels.map((label) => ({
                  from: edgeData.from,
                  to: edgeData.to,
                  label,
                })),
                addedEdges: addedLabels.map((label) => ({
                  from: edgeData.from,
                  to: edgeData.to,
                  label,
                })),
              };
              await this.imageUploadService
                .editGraph(editGraphPayload)
                .subscribe();
              this.relevantSubgraph = null;

              // Save new labels
              edgeData.label = title;
              return edgeData;
            },
          }).then((result) => {
            console.log('Result', result);
            if (result.isConfirmed) {
              callback(result.value);
            } else {
              callback(null);
            }
          });
        },
      },
      addEdge: (edgeData, callback) => {
        Swal.fire({
          titleText: 'Add Edge',
          text: 'Please enter edge label. Separate multiple labels with comma.',
          input: 'textarea',
          inputValue: 'Unnamed',
          showCancelButton: true,
          confirmButtonText: 'Save',
          showLoaderOnConfirm: true,
          preConfirm: async (title) => {
            let addedLabels = title.split(',').map((label) => label.trim());

            // Generate payload
            let editGraphPayload = {
              addedEdges: addedLabels.map((label) => ({
                from: edgeData.from,
                to: edgeData.to,
                label,
              })),
            };
            await this.imageUploadService
              .editGraph(editGraphPayload)
              .subscribe();
            this.relevantSubgraph = null;

            // Save new labels
            edgeData.label = title;
            edgeData.id = [edgeData.from, edgeData.to, title].join('#$#');
            return edgeData;
          },
        }).then((result) => {
          if (result.isConfirmed) {
            callback(result.value);
          } else {
            callback(null);
          }
        });
      },
      addNode: (nodeData, callback) => {
        Swal.fire({
          titleText: 'Add Node',
          text: 'Please enter node label',
          input: 'text',
          inputValue: 'Unnamed',
          showCancelButton: true,
          confirmButtonText: 'Save',
          showLoaderOnConfirm: true,
          preConfirm: async (title) => {
            // Generate payload
            let editGraphPayload = {
              editedNodes: [
                {
                  oldName: '',
                  newName: title,
                },
              ],
            };

            await this.imageUploadService
              .editGraph(editGraphPayload)
              .subscribe();
            this.relevantSubgraph = null;

            // Save new labels
            nodeData.label = title;
            nodeData.id = title;
            return nodeData;
          },
        }).then((result) => {
          if (result.isConfirmed) {
            callback(result.value);
          } else {
            callback(null);
          }
        });
      },
      editNode: (nodeData, callback) => {
        Swal.fire({
          titleText: 'Edit Node',
          text: 'Please enter node label',
          input: 'text',
          inputValue: nodeData.label,
          showCancelButton: true,
          confirmButtonText: 'Save',
          showLoaderOnConfirm: true,
          preConfirm: async (title) => {
            let oldLabel = nodeData.label;
            let newLabel = title;

            // Generate payload
            let editGraphPayload = {
              editedNodes: [
                {
                  oldName: oldLabel,
                  newName: newLabel,
                },
              ],
            };
            await this.imageUploadService
              .editGraph(editGraphPayload)
              .subscribe();
            this.relevantSubgraph = null;

            // Save new labels
            nodeData.label = title;
            nodeData.id = title;
            return nodeData;
          },
        }).then((result) => {
          if (result.isConfirmed) {
            callback(result.value);
          } else {
            callback(null);
          }
        });
      },
      deleteNode: (graphData, callback) => {
        Swal.fire({
          titleText: 'Delete Node',
          text: 'Are you sure you want to delete this node and connecting edges?',
          showCancelButton: true,
          confirmButtonText: 'Delete',
          showLoaderOnConfirm: true,
          preConfirm: async () => {
            let deletedEdges = [];
            graphData.edges.forEach((edgeID) => {
              let [from, to, labelStr] = edgeID.split('#$#');
              let labels = labelStr.split(', ');
              labels.forEach((label) => {
                deletedEdges.push({ from, to, label });
              });
            });

            // Generate payload
            let editGraphPayload = {
              editedNodes: graphData.nodes.map((nodeID) => ({
                oldName: nodeID,
                newName: '',
              })),
              deletedEdges,
            };
            await this.imageUploadService
              .editGraph(editGraphPayload)
              .subscribe();
            this.relevantSubgraph = null;
            return graphData;
          },
        }).then((result) => {
          if (result.isConfirmed) {
            callback(result.value);
          } else {
            callback(null);
          }
        });
      },
      deleteEdge: (graphData, callback) => {
        Swal.fire({
          titleText: 'Delete Edge',
          text: 'Are you sure you want to delete this edge?',
          showCancelButton: true,
          confirmButtonText: 'Delete',
          showLoaderOnConfirm: true,
          preConfirm: async () => {
            let deletedEdges = [];
            graphData.edges.forEach((edgeID) => {
              let [from, to, labelStr] = edgeID.split('#$#');
              let labels = labelStr.split(', ');
              labels.forEach((label) => {
                deletedEdges.push({ from, to, label });
              });
            });

            // Generate payload
            let editGraphPayload = {
              editedNodes: graphData.nodes.map((nodeID) => ({
                oldName: nodeID,
                newName: '',
              })),
              deletedEdges,
            };
            await this.imageUploadService
              .editGraph(editGraphPayload)
              .subscribe();
            this.relevantSubgraph = null;

            return graphData;
          },
        }).then((result) => {
          if (result.isConfirmed) {
            callback(result.value);
          } else {
            callback(null);
          }
        });
      },
    },
  };

  @Input() showRelevantImages: boolean;

  fullGraph: VisGraph;
  relevantSubgraph: VisGraph;

  loadingGraph = true;

  relevantSubgraphSubscription: Subscription;
  fullGraphSubscription: Subscription;

  constructor(
    private chatService: ChatService,
    private imageUploadService: ImageUploadService
  ) {}

  showCorrespondingGraph() {
    if (this.showRelevantImages && this.relevantSubgraph) {
      this.loadGraph(this.relevantSubgraph);
    } else {
      this.loadGraph(this.fullGraph);
    }
  }

  loadGraph(g: VisGraph) {
    if (this.network) {
      this.network.setData({ nodes: g.nodes, edges: g.edges });
    } else {
      this.network = new Network(
        this.container.nativeElement,
        { nodes: g.nodes, edges: g.edges },
        this.networkOptions
      );
    }
  }

  ngOnInit() {
    this.imageUploadService.queryFullGraph();

    this.relevantSubgraphSubscription = this.chatService
      .getRelevantSubgraph()
      .subscribe((subgraph) => {
        this.relevantSubgraph = this.convertRecievedGraphToNgxGraph(subgraph);
        this.showCorrespondingGraph();
      });

    this.fullGraphSubscription = this.imageUploadService
      .getFullGraph()
      .subscribe((graph) => {
        if (graph) {
          // console.log('Received full graph *** ', graph);
          if (graph.nodes.length) {
            this.fullGraph = this.convertRecievedGraphToNgxGraph(graph);
            this.showCorrespondingGraph();
          }
          this.loadingGraph = false;
        }
      });
  }

  ngOnChanges() {
    if (!this.loadingGraph) {
      this.showCorrespondingGraph();
    }
  }

  convertRecievedGraphToNgxGraph(graph: Graph): VisGraph {
    const nodes = graph.nodes.map((node) => {
      return {
        id: node.name,
        label: node.name,
        group: node.imageSources[0],
      };
    });

    // Merge relationships with same from and to
    // label will be a comma separated list of all labels
    const edgeMap = {};
    graph.relationships.forEach((relationship) => {
      const key = `${relationship.from}-${relationship.to}`;
      edgeMap[key] = edgeMap[key] || {
        from: relationship.from,
        to: relationship.to,
        label: [],
      };
      edgeMap[key].label.push(relationship.name);
    });

    const edges = Object.keys(edgeMap).map((key) => {
      let title = edgeMap[key].label.join(', ');
      return {
        from: edgeMap[key].from,
        to: edgeMap[key].to,
        title: title,
        id: [edgeMap[key].from, edgeMap[key].to, title].join('#$#'),
        // max 20 characters, otherwise it will be truncated with ...
        label: title.length > 20 ? title.substring(0, 20) + '...' : title,
      };
    });

    return { nodes, edges };
  }

  ngOnDestroy() {
    if (this.relevantSubgraphSubscription) {
      this.relevantSubgraphSubscription.unsubscribe();
    }

    if (this.fullGraphSubscription) {
      this.fullGraphSubscription.unsubscribe();
    }
  }
}
