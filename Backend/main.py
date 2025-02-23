from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import json
import logging
from dotenv import load_dotenv
import concurrent.futures
from typing import List

load_dotenv()

from neo4j_utils import (
    get_all_nodes_from_neo4j,
    get_subgraph_from_neo4j,
    get_fullgraph_from_neo4j,
    save_to_neo4j,
    delete_all_from_neo4j,
    process_edit_graph,
)
from gpt_utils import (
    get_gpt_response,
    identify_relevant_nodes_from_user_input,
)
from image_utils import (
    divide_image_with_adaptive_threshold_base64,
    encode_image_to_base64,
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),  # Output to console
        logging.FileHandler("app.log"),  # Output to file
    ],
)
logger = logging.getLogger(__name__)


# Load GPT instructions from file
image_to_graph_prompt = open("gpt_instructions/image_to_graph.md", "r").read()
find_relevant_nodes_prompt = open("gpt_instructions/find_relevant_nodes.md", "r").read()
flowchart_query_prompt = open("gpt_instructions/flowchart_query.md", "r").read()
merge_nodes_and_fix_graph_prompt = open(
    "gpt_instructions/merge_nodes_and_fix_graph.md", "r"
).read()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Define request and response models
class FlowchartRequest(BaseModel):
    image_base64_array: List[str]
    image_name_array: List[str]
    rows: int = 2
    cols: int = 2
    overlap: int = 50


class QueryRequest(BaseModel):
    user_input: str
    conversation_history: list
    use_relevant_context: bool = True


class GraphEditRequest(BaseModel):
    editedNodes: List[dict] = []
    deletedEdges: List[dict] = []
    addedEdges: List[dict] = []


class FullGraphResponse(BaseModel):
    full_graph: dict


class QueryResponse(BaseModel):
    response: str
    image_names: List[str]
    relevant_subgraph: dict


def get_relevant_subgraph_from_neo4j(user_input):
    nodes = get_all_nodes_from_neo4j()
    logger.debug(f"Nodes in Neo4j: {[node['name'] for node in nodes]}")

    relevant_nodes = identify_relevant_nodes_from_user_input(
        user_input, nodes, find_relevant_nodes_prompt
    )
    logger.info(f"Relevant nodes based on user input: {relevant_nodes}")

    if len(relevant_nodes) == 0:
        relevant_nodes = [node["name"] for node in nodes]

    subgraph = get_subgraph_from_neo4j(relevant_nodes)
    logger.debug(f"Subgraph from Neo4j based on relevant nodes: {subgraph}")

    return subgraph


def process_query(user_input, conversation_history, use_relevant_context):
    logger.info("Querying GPT with user input.")
    relevant_subgraph = (
        get_relevant_subgraph_from_neo4j(user_input)
        if use_relevant_context
        else get_fullgraph_from_neo4j()
    )
    logger.debug(f"Relevant subgraph from Neo4j: {relevant_subgraph}")

    messages = [
        {
            "role": "system",
            "content": flowchart_query_prompt,
        },
        {
            "role": "user",
            "content": "Here is the data for a flowchart: "
            + json.dumps(relevant_subgraph),
        },
    ]

    conversation_history = (
        messages
        + conversation_history[-10:]
        + [{"role": "user", "content": user_input}]
    )

    logger.debug(f"Conversation history: {conversation_history}")

    response = get_gpt_response(conversation_history)

    if response is None:
        return None, relevant_subgraph

    conversation_history.append({"role": "assistant", "content": response})
    logger.info(response)

    try:
        response = json.loads(response)
    except json.JSONDecodeError:
        response = {"text": response, "imageSources": []}

    return response["text"], response["imageSources"], relevant_subgraph


def convert_image_section_to_graph(image_section, section_coordinates):
    logger.debug("Sending image section to GPT.")
    encoded_image = encode_image_to_base64(image_section)

    messages = [
        {
            "role": "system",
            "content": image_to_graph_prompt,
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{encoded_image}"},
                },
                {
                    "type": "text",
                    "text": f"Section coordinates: {section_coordinates}.",
                },
            ],
        },
    ]

    return get_gpt_response(messages)


def fix_and_recreate_graph():

    current_graph = get_fullgraph_from_neo4j()

    # Send the graph to GPT to merge similar nodes
    messages = [
        {
            "role": "system",
            "content": merge_nodes_and_fix_graph_prompt,
        },
        {
            "role": "user",
            "content": json.dumps(current_graph),
        },
    ]

    # Retry upto 3 times
    # If the response is not a valid JSON, retry
    # Also if all nodes in relationships are not present in the nodes, retry
    for i in range(3):
        logger.debug(f"Fixing graph attempt {i + 1}.")
        response = get_gpt_response(messages)
        try:
            new_graph = json.loads(response)

            # Check if all nodes(from/to) in relationships are present in the nodes(name)
            node_names = [node["name"] for node in new_graph["nodes"]]
            relationship_nodes = [
                relationship["from"] for relationship in new_graph["relationships"]
            ] + [relationship["to"] for relationship in new_graph["relationships"]]
            if all(node in node_names for node in relationship_nodes):
                # Delete the current graph from Neo4j
                delete_all_from_neo4j()
                # Save the new graph to Neo4j
                save_to_neo4j(new_graph)
                logger.info("New graph saved to Neo4j.")
                return new_graph
            # If i is 2, then it is the last iteration
            # Raise an exception if the graph is still not valid
            if i == 2:
                raise ValueError("Invalid graph response from GPT after 3 attempts.")

        except json.JSONDecodeError:
            continue


def process_flowchart_images(
    image_base64_arr, image_name_array, rows=2, cols=2, overlap=50
):
    logger.info("Processing flowchart with GPT.")

    def process_section(section, coord, image_name):
        gpt_response = convert_image_section_to_graph(section, coord)
        if gpt_response:
            graph = json.loads(gpt_response)

            for node in graph["nodes"]:
                node["imageSources"] = [image_name]
                if not node["context"]:
                    node["context"] = []
                else:
                    node["context"] = [node["context"]]
            for relationship in graph["relationships"]:
                relationship["imageSources"] = [image_name]
                if not relationship["context"]:
                    relationship["context"] = []
                else:
                    relationship["context"] = [relationship["context"]]

            save_to_neo4j(graph)

    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = []
        for index, image_base64 in enumerate(image_base64_arr):
            sections, coordinates = divide_image_with_adaptive_threshold_base64(
                image_base64, rows, cols, overlap
            )
            for i, (section, coord) in enumerate(zip(sections, coordinates)):
                logger.info(
                    f"Submitting section {i + 1} of image {image_name_array[index]} for processing."
                )
                futures.append(
                    executor.submit(
                        process_section, section, coord, image_name_array[index]
                    )
                )

        for future in concurrent.futures.as_completed(futures):
            future.result()

    logger.info("Flowchart processing complete.")

    # Analyze the full graph and merge nodes with similar names
    return fix_and_recreate_graph()


@app.post("/upload", response_model=FullGraphResponse)
async def upload_flowchart(request: FlowchartRequest):
    try:
        logger.info("Received request to process flowchart.")
        response = process_flowchart_images(
            request.image_base64_array,
            request.image_name_array,
            request.rows,
            request.cols,
            request.overlap,
        )
        return {"full_graph": response}
    except Exception as e:
        logger.error(f"Error processing flowchart: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest):
    try:
        logger.info("Received query for GPT.")
        response, image_names, relevant_subgraph = process_query(
            request.user_input,
            request.conversation_history,
            request.use_relevant_context,
        )
        return {
            "response": response,
            "image_names": image_names,
            "relevant_subgraph": relevant_subgraph,
        }
    except Exception as e:
        logger.error(f"Error querying GPT: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/fullgraph", response_model=FullGraphResponse)
async def get_fullgraph():
    try:
        logger.info("Received request for full graph.")
        response = get_fullgraph_from_neo4j()
        return {"full_graph": response}
    except Exception as e:
        logger.error(f"Error getting full graph: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/editgraph", response_model=FullGraphResponse)
async def edit_graph(request: GraphEditRequest):
    try:
        logger.info("Received request to edit graph.")
        response = process_edit_graph(
            request.editedNodes, request.deletedEdges, request.addedEdges
        )
        return {"full_graph": response}
    except Exception as e:
        logger.error(f"Error editing graph: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/healthcheck")
async def healthcheck():
    return {"status": "ok"}


# Run the FastAPI application
if __name__ == "__main__":

    logger.info("Starting Flowchart Query System FastAPI application.")

    uvicorn.run(app, host="0.0.0.0", port=8000)
