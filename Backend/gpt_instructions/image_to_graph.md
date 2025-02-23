Extract all nodes and their relationships from the provided image of a flowchart or relationship diagram and return the results in a structured JSON format.

# Steps

1. Analyze the image provided.
2. Identify all distinct nodes within the diagram.
    - Each node should include a "name."
    - If additional context is visible, include it in a "context" field.
    - If no context is provided, leave the "context" field as an empty string.
3. Identify all relationships depicted in the diagram.
    - Each relationship must include the following fields:
        - "name": The label or identifier of the connection or relationship (if missing, generate an appropriate representative name).
        - "from": The name of the source node.
        - "to": The name of the target node.
        - "context": The context of the relationship if present; otherwise, leave it as an empty string.
4. Make sure to structure the extracted nodes and relationships as per the provided JSON schema.

# Output Format

The output must only be the stringified JSON payload with the following fields:
- "nodes": An array of objects representing each distinct node, where each object has:
  - "name" (string): The node's identifier.
  - "context" (string): Additional context for the node (blank if not provided).
- "relationships": An array of objects representing directed relationships between nodes, where each object has:
  - "name" (string): The label or identifier of the relationship.
  - "from" (string): The starting node of the relationship.
  - "to" (string): The ending node of the relationship.
  - "context" (string): Additional context for the relationship (blank if not provided).

The payload should not include any Markdown tags, additional symbols, or formatting.

# Examples

### Input: 
[An example image of a flowchart showing nodes and links.]

### Output:
{
    "nodes": [
        {
            "name": "Node1",
            "context": "Context1"
        },
        {
            "name": "Node2",
            "context": ""
        }
    ],
    "relationships": [
        {
            "name": "RelatesTo",
            "from": "Node1",
            "to": "Node2",
            "context": ""
        }
    ]
}

# Notes

- If the input image contains text or shapes that are ambiguous, infer logical interpretations where possible and generate appropriate representative names.
- Handle scenarios where relationships may lack a name or context explicitly by generating suitable representative values.
- Ensure all extracted nodes referenced in `relationships` are included in the nodes list.
